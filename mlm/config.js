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
    'stk_members': 3 * 60 * 1000,          // รายชื่อสมาชิก 3 นาที
    'stk_sales': 45 * 1000,                // ยอดขาย 45 วินาที
    'stk_customers': 60 * 1000,            // ข้อมูลลูกค้า 1 นาที
    'stk_payout_logs': 45 * 1000           // ล็อกการจ่ายคอมมิชชั่น 45 วินาที
  };

  // กำหนดคอลัมน์มาตรฐานสำหรับตารางต่างๆ (รวม id_card_url เพื่อให้รูปโปรไฟล์แสดงผล และ image_url เพื่อให้รูปสินค้าแสดงผล)
  const DEFAULT_TABLE_SELECT = {
    'stk_members': 'user_id,username,name,business_team,permission_role,status,id_card_url,sponsor_id,phone_number,email,address,line_id,line_uid,bank_name,bank_account_no,bank_account_name,accumulated_pv,created_at',
    'stk_products': 'product_id,name,category,price_full,price_member,price_promo,give_pv,current_stock,status,image_url,self_fee,level_1_fee,level_2_fee,level_3_fee,level_4_fee,level_5_fee,self_percent_full,level_1_percent_full,level_2_percent_full,level_3_percent_full,level_4_percent_full,level_5_percent_full,self_percent_member,level_1_percent_member,level_2_percent_member,level_3_percent_member,level_4_percent_member,level_5_percent_member,barcode,is_bundle,base_product,bundle_qty,full_margin_amount,full_margin_currency'
  };

  function invalidateTableCache(table) {
    for (const key of queryCache.keys()) {
      if (key === table || key.startsWith(table + ':') || key.startsWith(table + '?')) {
        queryCache.delete(key);
      }
    }
  }

  // 4. Helper Functions สำหรับเรียก REST API Supabase (SELECT, INSERT, UPDATE, UPSERT, DELETE)
  if (typeof window.supabaseSelect !== 'function') {
    window.supabaseSelect = async function (table, query) {
      const isNoCache = query && query.includes('nocache=true');
      let cleanQuery = query ? query.replace(/&?nocache=true/g, '').replace(/^\?/, '') : '';
      
      // Auto-filter heavy Base64: หากไม่ได้ระบุ select= มา ให้ใช้ Safe Columns อัตโนมัติ (ประหยัด Egress 85-98%)
      if (DEFAULT_TABLE_SELECT[table] && (!cleanQuery || (!cleanQuery.includes('select=') && !cleanQuery.includes('*')))) {
        cleanQuery = (cleanQuery ? cleanQuery + '&' : '') + 'select=' + DEFAULT_TABLE_SELECT[table];
      }

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
