// ==========================================================================
// Clinic System — Deleted Records Sync (deleted-sync.js)
// รายการที่ลบแล้ว (clinic_deleted_bills / stk_deleted_nutrient_orders) เดิมอยู่ใน localStorage ของแต่ละเครื่อง
// ไฟล์นี้ทำให้ทุกเครื่องเห็นตรงกัน:
//   1) ทุกครั้งที่โค้ดเดิมเขียน key เหล่านี้ลง localStorage → ส่ง ID ที่เพิ่มใหม่ขึ้นตาราง clinic_deleted_records
//   2) ตอนเปิดหน้า (เฉพาะหน้าบนสุด) → ดึงรายการจากฐานข้อมูลมารวมกับ localStorage
//      และส่งรายการเก่าที่มีแค่ในเครื่องนี้ขึ้นไปด้วย (ย้ายข้อมูลเดิมครั้งแรก)
// โค้ดอื่นยังอ่านจาก localStorage ได้เหมือนเดิม ไม่ต้องแก้
// ==========================================================================
(function () {
    var KEYS = ['clinic_deleted_bills', 'stk_deleted_nutrient_orders'];
    var TABLE = 'clinic_deleted_records';
    var DEFAULT_URL = 'https://fpmstumpobbjozflkola.supabase.co';
    var DEFAULT_KEY = 'sb_publishable_h9-j-0I2ku6rYYvoeHmooQ_B5GrRzR7';
    var originalSetItem = Storage.prototype.setItem;
    var client = null;
    var pendingPush = [];

    function readList(key) {
        try {
            var arr = JSON.parse(localStorage.getItem(key) || '[]');
            if (!Array.isArray(arr)) return [];
            return arr.map(function (x) { return String(x == null ? '' : x).trim(); }).filter(Boolean);
        } catch (e) {
            return [];
        }
    }

    function getClient() {
        if (client) return client;
        if (window._supabase) {
            client = window._supabase;
            return client;
        }
        try {
            if (window.parent && window.parent !== window && window.parent._supabase) {
                client = window.parent._supabase;
                window._supabase = client;
                return client;
            }
        } catch (e) { }
        if (!window.supabase || typeof window.supabase.createClient !== 'function') return null;
        var url = (window.CONFIG && window.CONFIG.SUPABASE_URL) || window.SUPABASE_URL || DEFAULT_URL;
        var key = (window.CONFIG && window.CONFIG.SUPABASE_ANON_KEY) || window.SUPABASE_ANON_KEY || DEFAULT_KEY;
        client = window.supabase.createClient(url, key);
        window._supabase = client;
        return client;
    }

    async function push(listKey, ids) {
        if (!ids || !ids.length) return;
        var c = getClient();
        if (!c) {
            pendingPush.push([listKey, ids]);
            return;
        }
        try {
            var rows = ids.map(function (id) { return { list_key: listKey, record_id: id }; });
            for (var i = 0; i < rows.length; i += 500) {
                var chunk = rows.slice(i, i + 500);
                var res = await Promise.race([
                    c.from(TABLE).upsert(chunk, { onConflict: 'list_key,record_id', ignoreDuplicates: true }),
                    new Promise(function (_, reject) { setTimeout(function () { reject(new Error('timeout')); }, 5000); })
                ]);
                if (res && res.error) {
                    console.debug('Deleted records sync push notice:', res.error.message);
                    return;
                }
            }
        } catch (err) {
            console.debug('Deleted records sync push skipped:', err && err.message ? err.message : err);
        }
    }

    // 1) ดักการเขียน key รายการที่ลบ → ส่งเฉพาะ ID ที่เพิ่มใหม่ขึ้นฐานข้อมูล
    Storage.prototype.setItem = function (k, v) {
        if (this === window.localStorage && KEYS.indexOf(k) !== -1) {
            var before = {};
            readList(k).forEach(function (id) { before[id] = true; });
            originalSetItem.call(this, k, v);
            var added = readList(k).filter(function (id) { return !before[id]; });
            if (added.length) push(k, added);
            return;
        }
        return originalSetItem.call(this, k, v);
    };

    // 2) รวมรายการจากฐานข้อมูลกับเครื่องนี้ (ทำเฉพาะหน้าบนสุด เพื่อไม่ให้ iframe ดึงซ้ำ)
    async function syncDown() {
        var c = getClient();
        if (!c) return;

        try {
            while (pendingPush.length) {
                var p = pendingPush.shift();
                await push(p[0], p[1]);
            }
            if (window !== window.top) return;

            var serverRows = [];
            for (var from = 0; from < 5000; from += 1000) {
                var res = await Promise.race([
                    c.from(TABLE).select('list_key, record_id').range(from, from + 999),
                    new Promise(function (_, reject) { setTimeout(function () { reject(new Error('timeout')); }, 5000); })
                ]);
                if (res && res.error) {
                    console.debug('Deleted records sync (pull) notice:', res.error.message);
                    return;
                }
                serverRows = serverRows.concat((res && res.data) || []);
                if (!res || !res.data || res.data.length < 1000) break;
            }

            var changed = false;
            for (var i = 0; i < KEYS.length; i++) {
                var key = KEYS[i];
                var local = readList(key);
                var server = {};
                serverRows.forEach(function (r) { if (r.list_key === key) server[r.record_id] = true; });

                var localOnly = local.filter(function (id) { return !server[id]; });
                if (localOnly.length) await push(key, localOnly);

                var merged = local.slice();
                var seen = {};
                local.forEach(function (id) { seen[id] = true; });
                Object.keys(server).forEach(function (id) { if (!seen[id]) { merged.push(id); seen[id] = true; } });
                if (merged.length !== local.length) {
                    originalSetItem.call(localStorage, key, JSON.stringify(merged));
                    changed = true;
                }
            }

            if (changed) {
                try { window.dispatchEvent(new CustomEvent('clinic-deleted-records-synced')); } catch (e) { }
            }
        } catch (err) {
            console.debug('Deleted records syncDown skipped:', err && err.message ? err.message : err);
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', syncDown);
    } else {
        syncDown();
    }
})();
