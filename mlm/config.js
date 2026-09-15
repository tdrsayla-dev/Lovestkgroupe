// ================================================================
// ⚙️ CONFIG.JS - การตั้งค่าระบบและการเชื่อมต่อ Supabase Database กลาง
// LOVE STK GROUPE System Configuration
// ================================================================

(function () {
  'use strict';

  // 1. ตั้งค่า Environments & API Keys
  const CONFIG = {
    SUPABASE_URL: 'https://mfpkeyrykqnrywyksyqp.supabase.co',
    SUPABASE_ANON_KEY: 'sb_publishable_807NIkuj6MAs1KZY-m4tug_Fm1Mk-AO'
  };

  // Expose CONFIG ไปที่ window
  window.APP_CONFIG = CONFIG;
  window.SUPABASE_URL = CONFIG.SUPABASE_URL;
  window.SUPABASE_ANON_KEY = CONFIG.SUPABASE_ANON_KEY;
  window.SUPABASE_REST_URL = CONFIG.SUPABASE_URL + '/rest/v1';
  window.SUPABASE_HEADERS = {
    'Content-Type': 'application/json',
    'apikey': CONFIG.SUPABASE_ANON_KEY,
    'Authorization': 'Bearer ' + CONFIG.SUPABASE_ANON_KEY,
    'Prefer': 'return=representation'
  };

  // 2. Initialise Supabase Client SDK (ถ้ามี Library supabase โหลดเข้ามา)
  if (typeof supabase !== 'undefined' && (!window.supabaseClient || typeof window.supabaseClient.from !== 'function')) {
    try {
      window.supabaseClient = supabase.createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_ANON_KEY);
      console.log('%c✅ Supabase Connected via config.js!', 'color:#10b981;font-weight:bold;', CONFIG.SUPABASE_URL);
    } catch (e) {
      console.warn('Supabase Client init error:', e);
    }
  }

  // 3. ระบบ Smart In-Memory Cache (TTL) สำหรับลดปริมาณการดึงข้อมูลซ้ำซ้อน (Egress)
  const queryCache = new Map();
  // กำหนดอายุแคชตามประเภทตาราง (มิลลิวินาที)
  const CACHE_TTL_CONFIG = {
    'stk_products': 3 * 60 * 1000,         // สินค้า 3 นาที
    'stk_customer_types': 5 * 60 * 1000,   // ประเภทลูกค้า 5 นาที
    'stk_closers': 5 * 60 * 1000,          // หมอ/ผู้ปิดการขาย 5 นาที
    'stk_business_teams': 5 * 60 * 1000,   // สายงาน/ทีม 5 นาที
    'stk_system_settings': 5 * 60 * 1000,  // ตั้งค่าระบบ 5 นาที
    'stk_members': 2 * 60 * 1000           // รายชื่อสมาชิก 2 นาที
  };

  function invalidateTableCache(table) {
    for (const key of queryCache.keys()) {
      if (key.startsWith(table + ':') || key.startsWith(table + '?')) {
        queryCache.delete(key);
      }
    }
  }

  // 4. Helper Functions สำหรับเรียก REST API Supabase (SELECT, INSERT, UPDATE, UPSERT, DELETE)
  if (typeof window.supabaseSelect !== 'function') {
    window.supabaseSelect = async function (table, query) {
      const isNoCache = query && query.includes('nocache=true');
      const cleanQuery = query ? query.replace(/&?nocache=true/g, '').replace(/^\?/, '') : '';
      const cacheKey = table + (cleanQuery ? '?' + cleanQuery : '');
      const ttl = CACHE_TTL_CONFIG[table] || 0;

      // ถ้าตารางอยู่ในรายการที่มีแคช และไม่ได้สั่ง nocache และแคชยังไม่หมดอายุ
      if (!isNoCache && ttl > 0 && queryCache.has(cacheKey)) {
        const cached = queryCache.get(cacheKey);
        if (Date.now() - cached.timestamp < ttl) {
          return JSON.parse(JSON.stringify(cached.data)); // คืนข้อมูลจากแคชทันที ไม่เสีย Egress
        }
      }

      const url = window.SUPABASE_REST_URL + '/' + table + (cleanQuery ? '?' + cleanQuery : '');
      const res = await fetch(url, { method: 'GET', headers: window.SUPABASE_HEADERS });
      if (!res.ok) {
        const t = await res.text();
        throw new Error('SELECT ' + table + ': ' + res.status + ' ' + t);
      }
      const data = await res.json();

      if (ttl > 0) {
        queryCache.set(cacheKey, { timestamp: Date.now(), data: data });
      }
      return data;
    };
  }

  if (typeof window.supabaseInsert !== 'function') {
    window.supabaseInsert = async function (table, data) {
      invalidateTableCache(table);
      const res = await fetch(window.SUPABASE_REST_URL + '/' + table, {
        method: 'POST',
        headers: window.SUPABASE_HEADERS,
        body: JSON.stringify(data)
      });
      if (!res.ok) {
        const t = await res.text();
        throw new Error('INSERT ' + table + ': ' + res.status + ' ' + t);
      }
      return res.json();
    };
  }

  if (typeof window.supabaseUpdate !== 'function') {
    window.supabaseUpdate = async function (table, id, data, pk = 'id') {
      invalidateTableCache(table);
      const url = window.SUPABASE_REST_URL + '/' + table + '?' + pk + '=eq.' + encodeURIComponent(id);
      const res = await fetch(url, {
        method: 'PATCH',
        headers: window.SUPABASE_HEADERS,
        body: JSON.stringify(data)
      });
      if (!res.ok) {
        const t = await res.text();
        throw new Error('UPDATE ' + table + ': ' + res.status + ' ' + t);
      }
      return res.json();
    };
  }

  if (typeof window.supabaseDelete !== 'function') {
    window.supabaseDelete = async function (table, id, pk = 'id') {
      invalidateTableCache(table);
      const headers = Object.assign({}, window.SUPABASE_HEADERS, { 'Prefer': 'return=minimal' });
      const url = window.SUPABASE_REST_URL + '/' + table + '?' + pk + '=eq.' + encodeURIComponent(id);
      const res = await fetch(url, { method: 'DELETE', headers: headers });
      if (!res.ok) {
        const t = await res.text();
        throw new Error('DELETE ' + table + ': ' + res.status + ' ' + t);
      }
      return true;
    };
  }

  if (typeof window.supabaseUpsert !== 'function') {
    window.supabaseUpsert = async function (table, data) {
      invalidateTableCache(table);
      const headers = Object.assign({}, window.SUPABASE_HEADERS, { 'Prefer': 'resolution=merge-duplicates,return=representation' });
      const url = window.SUPABASE_REST_URL + '/' + table;
      const res = await fetch(url, {
        method: 'POST',
        headers: headers,
        body: JSON.stringify(data)
      });
      if (!res.ok) {
        const t = await res.text();
        throw new Error('UPSERT ' + table + ': ' + res.status + ' ' + t);
      }
      return res.json();
    };
  }

})();
