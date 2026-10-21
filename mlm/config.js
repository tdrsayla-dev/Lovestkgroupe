// ================================================================
// ⚙️ CONFIG.JS - การตั้งค่าระบบและการเชื่อมต่อ Supabase Database กลาง
// LOVE STK GROUPE System Configuration
// ================================================================

(function () {
  'use strict';

  // 0. Global App Version for Cache-Busting & Egress Optimization
  const APP_VERSION = '2026.10.21.01';
  window.APP_VERSION = APP_VERSION;

  // 🛡️ Auto-Purge Cache On New Version Deploy (User doesn't have to clear cache manually)
  try {
    const savedVer = localStorage.getItem('stk_app_version');
    if (savedVer && savedVer !== APP_VERSION) {
      console.log(`%c🔄 New App Version detected (${savedVer} -> ${APP_VERSION}). Refreshing cache...`, 'color:#3b82f6;font-weight:bold;');
      localStorage.removeItem('stk_app_cache_data');
      localStorage.removeItem('stk_reports_cache_data');
      localStorage.removeItem('stk_app_cache_time');
      localStorage.removeItem('stk_clinic_doctors_cache');
      sessionStorage.removeItem('stk_admin_products_full');
      sessionStorage.removeItem('stk_warehouse_audit_cache');
      for (let i = sessionStorage.length - 1; i >= 0; i--) {
        const k = sessionStorage.key(i);
        if (k && (k.startsWith('stk_qc_') || k.startsWith('stk_warehouse_'))) sessionStorage.removeItem(k);
        if (k && k.startsWith('stk_campaign_eval_')) sessionStorage.removeItem(k);
      }
      for (let i = localStorage.length - 1; i >= 0; i--) {
        const k = localStorage.key(i);
        if (k && k.startsWith('stk_campaign_eval_')) localStorage.removeItem(k);
      }
    }
    localStorage.setItem('stk_app_version', APP_VERSION);
  } catch (e) {}

  // 🛡️ Global Safe JSON Parser Helper
  window.safeJsonParse = function(raw, fallback) {
    if (raw === null || raw === undefined) return fallback !== undefined ? fallback : null;
    if (typeof raw !== 'string') return raw;
    try {
      return JSON.parse(raw);
    } catch (e) {
      return fallback !== undefined ? fallback : null;
    }
  };


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

  // 1.1 Clinic Database Config (Supabase คลินิกภายนอก)
  const CLINIC_CONFIG = {
    SUPABASE_URL: 'https://fpmstumpobbjozflkola.supabase.co',
    SUPABASE_ANON_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZwbXN0dW1wb2Jiam96Zmxrb2xhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODM5MDE0NDcsImV4cCI6MjA5OTQ3NzQ0N30.qTn4UHISBY9A5fX83ANk0mu3JSgK42ByLZ9xPh2TEvM'
  };

  window.CLINIC_CONFIG = CLINIC_CONFIG;
  window.CLINIC_SUPABASE_URL = CLINIC_CONFIG.SUPABASE_URL;
  window.CLINIC_SUPABASE_ANON_KEY = CLINIC_CONFIG.SUPABASE_ANON_KEY;
  window.CLINIC_SUPABASE_REST_URL = CLINIC_CONFIG.SUPABASE_URL + '/rest/v1';
  window.CLINIC_SUPABASE_HEADERS = {
    'Content-Type': 'application/json',
    'apikey': CLINIC_CONFIG.SUPABASE_ANON_KEY,
    'Authorization': 'Bearer ' + CLINIC_CONFIG.SUPABASE_ANON_KEY,
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
    'stk_nutrient_orders': 30 * 1000,      // ออเดอร์สั่งจ่ายยา 30 วินาที
    'stk_customers': 60 * 1000,            // ข้อมูลลูกค้า 1 นาที
    'stk_payout_logs': 45 * 1000,          // ล็อกการจ่ายคอมมิชชั่น 45 วินาที
    'stk_campaigns': 2 * 60 * 1000,        // แคมเปญแข่งขัน 2 นาที
    'stk_campaign_results': 60 * 1000,     // ผลแคมเปญ 1 นาที
    'stk_b2b_price_tiers': 3 * 60 * 1000,  // เรทราคาส่ง B2B 3 นาที
    'stk_b2b_orders': 45 * 1000,           // ออเดอร์ขายส่ง B2B 45 วินาที
    'stk_daily_balance': 30 * 1000         // กระทบยอดสต๊อกประจำวัน แคช 30 วินาที
  };

  // กำหนดคอลัมน์มาตรฐานสำหรับตารางต่างๆ (รวม id_card_url เพื่อให้รูปโปรไฟล์แสดงผล, image_url รูปสินค้า, และ extra_details_json สำหรับทีมผู้ปิด)
  const DEFAULT_TABLE_SELECT = {
    'stk_members': 'user_id,username,name,business_team,permission_role,status,id_card_url,sponsor_id,phone_number,email,address,line_id,line_uid,bank_name,bank_account_no,bank_account_name,bank_account_status,accumulated_pv,created_at',
    'stk_products': 'product_id,name,category,price_full,price_member,price_promo,give_pv,current_stock,status,barcode,is_bundle,base_product,bundle_qty,image_url',
    'stk_customers': 'customer_id,name,phone,line_id,customer_type,symptom_disease,closer_id,owner_member_id,extra_details_json,created_at',
    'stk_daily_balance': 'id,balance_date,warehouse_id,product_id,domain_type,opening_qty,transfer_in_qty,transfer_out_qty,sales_qty,system_closing_qty,physical_count_qty,diff_qty,audited_by,audit_status,audit_notes,created_at',
    'stk_sales': 'order_id,date,seller_id,customer_id,sale_type,total_amount,total_bottles,status,recorded_by,items_json,payment_note,payments_json,exchange_rate,created_at',
    'stk_b2b_orders': 'order_id,order_date,buyer_type,buyer_id,buyer_name,buyer_phone,warehouse_id,items_json,total_qty,total_amount,payment_method,notes,recorded_by,status,created_at',
    'stk_stock_movements': 'movement_id,date,product_id,type,sub_type,quantity,lot_id,notes,created_by,created_at',
    'stk_nutrient_orders': 'id,order_id,visit_id,hn,customer_name,recorded_by,date,status,items_json,created_at,customer_phone,symptom,closer_dr,sale_order_id,customer_type,order_by_type,closer_team',
    'stk_payout_logs': 'id,payout_id,member_id,member_name,team_name,amount,currency,payout_date,period_start,period_end,status,payment_method,paid_by,reference_note,created_at,updated_at,start_date,end_date,payout_type,paid_at,promo_deduct_boxes,promo_deduct_amount'
  };

  const SESSION_CACHE_PREFIX = 'stk_qc_';

  function getFromCache(key, ttl) {
    if (ttl <= 0) return null;
    const now = Date.now();
    // 1. In-memory Map
    if (queryCache.has(key)) {
      const entry = queryCache.get(key);
      if (now - entry.timestamp < ttl) {
        return entry.data;
      }
      queryCache.delete(key);
    }
    // 2. sessionStorage (แชร์ข้ามหน้าต่างในแท็บเดียวกัน ลด Egress 100% เมื่อเปลี่ยนหน้า)
    try {
      const raw = sessionStorage.getItem(SESSION_CACHE_PREFIX + key);
      if (raw) {
        const entry = JSON.parse(raw);
        if (now - entry.timestamp < ttl) {
          queryCache.set(key, entry);
          return entry.data;
        }
        sessionStorage.removeItem(SESSION_CACHE_PREFIX + key);
      }
    } catch (e) {}
    return null;
  }

  function setToCache(key, data, ttl) {
    if (ttl <= 0) return;
    const entry = { timestamp: Date.now(), data: data };
    queryCache.set(key, entry);
    try {
      const str = JSON.stringify(entry);
      // จำกัดขนาดไม่เกิน 1.5MB ต่อรายการเพื่อความปลอดภัยของโควต้าพื้นที่
      if (str.length < 1500000) {
        sessionStorage.setItem(SESSION_CACHE_PREFIX + key, str);
      }
    } catch (e) {
      try {
        for (let i = sessionStorage.length - 1; i >= 0; i--) {
          const k = sessionStorage.key(i);
          if (k && k.startsWith(SESSION_CACHE_PREFIX)) sessionStorage.removeItem(k);
        }
      } catch (ex) {}
    }
  }

  function invalidateTableCache(table) {
    if (!table) {
      queryCache.clear();
      try {
        for (let i = sessionStorage.length - 1; i >= 0; i--) {
          const k = sessionStorage.key(i);
          if (k && k.startsWith(SESSION_CACHE_PREFIX)) sessionStorage.removeItem(k);
        }
      } catch (e) {}
      return;
    }
    for (const key of queryCache.keys()) {
      if (key === table || key.startsWith(table + ':') || key.startsWith(table + '?')) {
        queryCache.delete(key);
      }
    }
    try {
      for (let i = sessionStorage.length - 1; i >= 0; i--) {
        const k = sessionStorage.key(i);
        if (k && k.startsWith(SESSION_CACHE_PREFIX)) {
          const rawKey = k.replace(SESSION_CACHE_PREFIX, '');
          if (rawKey === table || rawKey.startsWith(table + ':') || rawKey.startsWith(table + '?')) {
            sessionStorage.removeItem(k);
          }
        }
      }
    } catch (e) {}
  }

  window.invalidateTableCache = invalidateTableCache;

  // 4. Helper Functions สำหรับเรียก REST API Supabase (SELECT, INSERT, UPDATE, UPSERT, DELETE)
  if (typeof window.supabaseSelect !== 'function') {
    window.supabaseSelect = async function (table, query) {
      const isNoCache = query && (query.includes('nocache=true') || query.includes('nocache=1'));
      let cleanQuery = query ? query.replace(/[?&]?nocache=[^&]+&?/g, '&').replace(/[?&]?_t=[^&]+&?/g, '&').replace(/^[?&]+/, '').replace(/&$/, '') : '';
      
      // Auto-filter heavy Base64: หากไม่ได้ระบุ select= มา ให้ใช้ Safe Columns อัตโนมัติ (ประหยัด Egress 85-98%)
      if (DEFAULT_TABLE_SELECT[table] && (!cleanQuery || (!cleanQuery.includes('select=') && !cleanQuery.includes('*')))) {
        cleanQuery = (cleanQuery ? cleanQuery + '&' : '') + 'select=' + DEFAULT_TABLE_SELECT[table];
      }

      // 🛡️ Auto Schema Normalizer: ป้องกันการเรียกชื่อคอลัมน์ผิดข้าม Database อัตโนมัติ ป้องกัน Error 400 และ Egress รั่วไหล
      if (table === 'stk_sales' && cleanQuery) {
        cleanQuery = cleanQuery
          .replace(/\bselect=id\b/g, 'select=order_id')
          .replace(/\bselect=id,/g, 'select=order_id,')
          .replace(/,id,/g, ',order_id,')
          .replace(/,id&/g, ',order_id&')
          .replace(/,id$/g, ',order_id')
          .replace(/\bbill_id\b/g, 'order_id');
      } else if (table === 'stk_customers' && cleanQuery) {
        cleanQuery = cleanQuery
          .replace(/,member_id,/g, ',')
          .replace(/,member_id&/g, '&')
          .replace(/,member_id$/g, '')
          .replace(/,member_name,/g, ',')
          .replace(/,member_name&/g, '&')
          .replace(/,member_name$/g, '');
      } else if (table === 'patients' && cleanQuery) {
        cleanQuery = cleanQuery.replace(/\bphone_number\b/g, 'phone');
      }

      const cacheKey = table + (cleanQuery ? '?' + cleanQuery : '');
      const ttl = CACHE_TTL_CONFIG[table] || 0;

      // ถ้าตารางอยู่ในรายการที่มีแคช และไม่ได้สั่ง nocache และแคชยังไม่หมดอายุ (ตรวจทั้ง Memory และ sessionStorage)
      if (!isNoCache && ttl > 0) {
        const cachedData = getFromCache(cacheKey, ttl);
        if (cachedData !== null) {
          return JSON.parse(JSON.stringify(cachedData)); // คืนข้อมูลจากแคชทันที ไม่เสีย Egress แม้เปลี่ยนหน้า
        }
      }

      const url = window.SUPABASE_REST_URL + '/' + table + (cleanQuery ? '?' + cleanQuery : '');
      const fetchHeaders = isNoCache
        ? Object.assign({}, window.SUPABASE_HEADERS, { 'Cache-Control': 'no-cache, no-store, must-revalidate', 'Pragma': 'no-cache' })
        : window.SUPABASE_HEADERS;
      let res;
      try {
        res = await fetch(url, { method: 'GET', headers: fetchHeaders, cache: isNoCache ? 'no-store' : 'default' });
      } catch (fetchErr) {
        if (window.supabaseClient && typeof window.supabaseClient.from === 'function') {
          console.warn(`[config.js] fetch failed for ${table}, attempting fallback via supabaseClient:`, fetchErr);
          try {
            const selectCols = cleanQuery.includes('select=') ? cleanQuery.replace(/.*select=([^&]+).*/, '$1') : '*';
            const { data, error } = await window.supabaseClient.from(table).select(selectCols);
            if (!error && Array.isArray(data)) {
              if (ttl > 0) setToCache(cacheKey, data, ttl);
              return data;
            }
          } catch (sdkErr) {}
        }
        throw fetchErr;
      }
      if (!res.ok) {
        const t = await res.text();
        throw new Error('SELECT ' + table + ': ' + res.status + ' ' + t);
      }
      const data = await res.json();

      if (ttl > 0) {
        setToCache(cacheKey, data, ttl);
      }
      return data;
    };
  }

  // 4.05 Supabase SELECT All (Auto-pagination for Historical Reports & Complete Data Fetch)
  // แก้ปัญหา PostgREST Server Limit 1,000 แถว โดยทำการดึงแบบ page ทีละ 1,000 แถวอัตโนมัติจนครบ 100%
  if (typeof window.supabaseSelectAll !== 'function') {
    window.supabaseSelectAll = async function (table, query, options = {}) {
      const maxPages = options.maxPages || 50; // Safety ceiling (รองรับสูงสุด 50,000 แถว)
      const pageSize = options.pageSize || 1000;
      let allData = [];
      let offset = 0;
      let hasMore = true;
      let page = 0;

      // ลบ limit และ offset ที่อาจติดมากับ query ต้นทางออก
      let baseQuery = query ? query.replace(/[?&]?limit=[^&]+&?/g, '&').replace(/[?&]?offset=[^&]+&?/g, '&').replace(/^[?&]+/, '').replace(/&$/, '') : '';

      while (hasMore && page < maxPages) {
        const pagedQuery = (baseQuery ? baseQuery + '&' : '') + `limit=${pageSize}&offset=${offset}`;
        const chunk = await window.supabaseSelect(table, pagedQuery);
        if (Array.isArray(chunk) && chunk.length > 0) {
          allData = allData.concat(chunk);
          offset += chunk.length;
          if (chunk.length < pageSize) {
            hasMore = false;
          }
        } else {
          hasMore = false;
        }
        page++;
      }
      return allData;
    };
  }

  // 4.06 Clinic Supabase SELECT All (Auto-pagination for Clinic Database)
  if (typeof window.clinicSupabaseSelectAll !== 'function') {
    window.clinicSupabaseSelectAll = async function (table, query, options = {}) {
      const maxPages = options.maxPages || 50;
      const pageSize = options.pageSize || 1000;
      let allData = [];
      let offset = 0;
      let hasMore = true;
      let page = 0;

      let baseQuery = query ? query.replace(/[?&]?limit=[^&]+&?/g, '&').replace(/[?&]?offset=[^&]+&?/g, '&').replace(/^[?&]+/, '').replace(/&$/, '') : '';

      while (hasMore && page < maxPages) {
        const pagedQuery = (baseQuery ? baseQuery + '&' : '') + `limit=${pageSize}&offset=${offset}`;
        const chunk = await window.clinicSupabaseSelect(table, pagedQuery);
        if (Array.isArray(chunk) && chunk.length > 0) {
          allData = allData.concat(chunk);
          offset += chunk.length;
          if (chunk.length < pageSize) {
            hasMore = false;
          }
        } else {
          hasMore = false;
        }
        page++;
      }
      return allData;
    };
  }

  // 4.1 Clinic Supabase SELECT Helper (with Smart Caching)
  if (typeof window.clinicSupabaseSelect !== 'function') {
    window.clinicSupabaseSelect = async function (table, query) {
      const isNoCache = query && (query.includes('nocache=true') || query.includes('nocache=1'));
      let cleanQuery = query ? query.replace(/[?&]?nocache=[^&]+&?/g, '&').replace(/[?&]?_t=[^&]+&?/g, '&').replace(/^[?&]+/, '').replace(/&$/, '') : '';

      // 🛡️ Auto Schema Normalizer: ป้องกันคอลัมน์คลินิกผิดพลาด (เช่น phone_number -> phone)
      if (table === 'patients' && cleanQuery) {
        cleanQuery = cleanQuery.replace(/\bphone_number\b/g, 'phone');
      }

      const cacheKey = 'clinic_' + table + (cleanQuery ? '?' + cleanQuery : '');
      const ttl = 60 * 1000; // 1 นาที

      if (!isNoCache && ttl > 0) {
        const cachedData = getFromCache(cacheKey, ttl);
        if (cachedData !== null) {
          return JSON.parse(JSON.stringify(cachedData));
        }
      }

      const url = window.CLINIC_SUPABASE_REST_URL + '/' + table + (cleanQuery ? '?' + cleanQuery : '');
      const fetchHeaders = isNoCache
        ? Object.assign({}, window.CLINIC_SUPABASE_HEADERS, { 'Cache-Control': 'no-cache, no-store, must-revalidate', 'Pragma': 'no-cache' })
        : window.CLINIC_SUPABASE_HEADERS;
      const res = await fetch(url, { method: 'GET', headers: fetchHeaders, cache: isNoCache ? 'no-store' : 'default' });
      if (!res.ok) {
        const t = await res.text();
        throw new Error('CLINIC SELECT ' + table + ': ' + res.status + ' ' + t);
      }
      const data = await res.json();
      if (ttl > 0) {
        setToCache(cacheKey, data, ttl);
      }
      return data;
    };
  }

  // 4.2 Helper ดึงรายชื่อหมอ/แพทย์จากฝั่งคลินิก (ตาราง staff_users พร้อม Stale-While-Revalidate & Persistent Cache)
  // 🛡️ ทำงานแบบ Fault-Tolerant: ดึงจากตาราง staff_users คัดกรอง role = 'doctor' ตรงตามโครงสร้างฐานข้อมูลคลินิก
  window.fetchClinicDoctors = async function () {
    const CACHE_KEY = 'stk_clinic_doctors_cache_v2';
    let cachedDoctors = [];
    try {
      localStorage.removeItem('stk_clinic_doctors_cache'); // ลบแคชรุ่นเก่าที่เคยดึงจากตาราง staff ออก
      const raw = localStorage.getItem(CACHE_KEY);
      if (raw) cachedDoctors = JSON.parse(raw);
    } catch (e) {}

    // ถ้ามีฟังก์ชัน clinicSupabaseSelect ให้ดึงข้อมูลล่าสุดจากตาราง staff_users ของคลินิก
    if (typeof window.clinicSupabaseSelect === 'function') {
      try {
        const staffUsers = await window.clinicSupabaseSelect('staff_users', 'select=id,emp_code,full_name,role,email&order=emp_code.asc&nocache=true');
        if (Array.isArray(staffUsers) && staffUsers.length > 0) {
          const docs = staffUsers
            .filter(s => {
              if (!s) return false;
              const role = String(s.role || '').trim().toLowerCase();
              // คัดกรองเฉพาะ role ที่เป็น doctor หรือมีคำว่าแพทย์/หมอ
              return role === 'doctor' || role.includes('doctor') || role.includes('แพทย์') || role.includes('หมอ');
            })
            .map(s => {
              const empCode = String(s.emp_code || s.id || '').trim();
              const fullName = String(s.full_name || s.name || empCode).trim();
              return {
                id: empCode,
                emp_code: empCode,
                name: fullName,
                full_name: fullName,
                team: 'Center',
                role: s.role || 'doctor',
                email: s.email || '',
                source: 'clinic'
              };
            });

          if (docs.length > 0) {
            try {
              localStorage.setItem(CACHE_KEY, JSON.stringify(docs));
            } catch (e) {}
            return docs;
          }
        }
      } catch (err) {
        console.warn('[config.js] fetchClinicDoctors (staff_users) notice:', err.message);
      }
    }

    // หากดึงไม่สำเร็จหรือติด Error ให้ใช้ข้อมูลแคชเดิมที่เคยจำไว้เสมอ ป้องกันข้อมูลหลุดหรือหน้าจอว่างเปล่า
    return Array.isArray(cachedDoctors) && cachedDoctors.length > 0 ? cachedDoctors : [];
  };

  window.getClinicDoctorsSync = function () {
    try {
      const raw = localStorage.getItem('stk_clinic_doctors_cache_v2');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch (e) {}
    return [];
  };

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

  // ================================================================
  // 4. ระบบ Session Inactivity & Cross-Day Auto-Logout
  // ล็อกเอาต์อัตโนมัติเมื่อ: 
  //   1) ไม่มีการใช้งานเกิน 60 นาที
  //   2) ข้ามวัน (Midnight / เข้าสู่วันใหม่)
  // เพื่อป้องกันการเปิดแท็บทิ้งไว้กิน Data Egress และรักษาความปลอดภัยของระบบ
  // ================================================================
  (function initSessionInactivityManager() {
    const INACTIVITY_TIMEOUT_MS = 60 * 60 * 1000; // 60 นาที (3,600,000 มิลลิวินาที)
    const WARNING_BEFORE_TIMEOUT_MS = 2 * 60 * 1000; // แจ้งเตือนล่วงหน้า 2 นาที (120,000 มิลลิวินาที)
    const ACTIVITY_STORAGE_KEY = 'stk_last_activity';
    const ACTIVITY_DATE_KEY = 'stk_last_activity_date';
    const LOGOUT_REASON_KEY = 'stk_logout_reason';
    const BROADCAST_KEY = 'stk_broadcast_session_event';

    let lastRecordedTime = 0;
    let warningBannerEl = null;

    function getLocalDateStr() {
      const d = new Date();
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    }

    // 0) ตรวจสอบทันที ณ วินาทีแรกที่โหลดไฟล์สคริปต์ (Synchronous Boot Check)
    // หากพบว่าข้ามวัน หรือหมดเวลา 60 นาที ให้ล้างข้อมูลผู้ใช้ทันทีก่อนที่ React จะเริ่มทำงาน
    try {
      const existingUser = localStorage.getItem('stk_current_user');
      if (existingUser) {
        let isDeactivated = false;
        try {
          const parsed = JSON.parse(existingUser);
          if (parsed && (parsed.status === 'ระงับ' || parsed.status === 'deactivated' || parsed.status === 'inactive')) {
            isDeactivated = true;
          }
        } catch (e) {}

        const now = Date.now();
        const todayStr = getLocalDateStr();
        const lastDate = localStorage.getItem(ACTIVITY_DATE_KEY);
        const lastActivity = Number(localStorage.getItem(ACTIVITY_STORAGE_KEY) || 0);

        const isCrossDay = lastDate && lastDate !== todayStr;
        const isTimedOut = lastActivity > 0 && (now - lastActivity >= INACTIVITY_TIMEOUT_MS);

        if (isDeactivated || isCrossDay || isTimedOut) {
          localStorage.removeItem('stk_current_user');
          localStorage.removeItem(ACTIVITY_STORAGE_KEY);
          localStorage.removeItem(ACTIVITY_DATE_KEY);
          sessionStorage.setItem(LOGOUT_REASON_KEY, isDeactivated ? 'deactivated' : (isCrossDay ? 'cross_day' : 'inactivity_60m'));
          if (typeof window.clearDbCache === 'function') window.clearDbCache();
        } else {
          // เซสชันยังใช้งานได้ปกติ ให้บันทึกเวลาและวันปัจจุบัน
          localStorage.setItem(ACTIVITY_STORAGE_KEY, String(now));
          localStorage.setItem(ACTIVITY_DATE_KEY, todayStr);
        }
      }
    } catch (e) {
      console.warn('Session boot check error:', e);
    }

    // 1) ดักจับความเคลื่อนไหวของผู้ใช้ (User Activity) แบบ Throttled
    function recordActivity() {
      const now = Date.now();
      if (now - lastRecordedTime > 5000) {
        lastRecordedTime = now;
        try {
          if (localStorage.getItem('stk_current_user')) {
            const todayStr = getLocalDateStr();
            const lastDate = localStorage.getItem(ACTIVITY_DATE_KEY);

            // ถ้าพบว่าใช้งานต่อเนื่องจนข้ามเที่ยงคืนเข้าสู่วันใหม่
            if (lastDate && lastDate !== todayStr) {
              performAutoLogout('cross_day');
              return;
            }

            localStorage.setItem(ACTIVITY_STORAGE_KEY, String(now));
            localStorage.setItem(ACTIVITY_DATE_KEY, todayStr);
          }
        } catch (e) {}
      }
      hideInactivityWarning();
    }

    // ติดตั้ง Event Listeners ดักจับการกระทำของผู้ใช้
    const trackedEvents = ['mousemove', 'mousedown', 'keydown', 'touchstart', 'scroll', 'click'];
    trackedEvents.forEach(evt => {
      window.addEventListener(evt, recordActivity, { passive: true });
    });

    // 2) แสดงแถบแจ้งเตือนล่วงหน้าก่อนหมดเวลา 2 นาที
    function showInactivityWarning(minutesRemaining) {
      if (!document.body) return;
      if (warningBannerEl && document.body.contains(warningBannerEl)) return;

      warningBannerEl = document.createElement('div');
      warningBannerEl.id = 'stk-inactivity-warning';
      warningBannerEl.style.cssText = [
        'position: fixed',
        'top: 18px',
        'left: 50%',
        'transform: translateX(-50%)',
        'z-index: 9999999',
        'background: linear-gradient(135deg, #f59e0b, #d97706)',
        'color: #ffffff',
        'padding: 12px 24px',
        'border-radius: 9999px',
        'box-shadow: 0 10px 25px -5px rgba(217, 119, 6, 0.5), 0 8px 10px -6px rgba(217, 119, 6, 0.3)',
        'font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
        'font-size: 13px',
        'font-weight: 700',
        'display: flex',
        'align-items: center',
        'gap: 10px',
        'cursor: pointer',
        'transition: all 0.3s ease',
        'border: 2px solid rgba(255, 255, 255, 0.4)'
      ].join(';');

      warningBannerEl.innerHTML = `
        <span style="font-size: 16px;">⏳</span>
        <span>ไม่มีการใช้งานนานเกินไป ระบบจะออกจากระบบอัตโนมัติในอีก ${minutesRemaining} นาที (คลิกที่นี่เพื่อใช้งานต่อ)</span>
      `;

      warningBannerEl.addEventListener('click', () => {
        recordActivity();
      });

      document.body.appendChild(warningBannerEl);
    }

    function hideInactivityWarning() {
      if (warningBannerEl && document.body && document.body.contains(warningBannerEl)) {
        try { document.body.removeChild(warningBannerEl); } catch (e) {}
        warningBannerEl = null;
      }
    }

    // 3) ตัวสั่งการ Logout เมื่อหมดเวลา 60 นาที หรือข้ามวัน
    function performAutoLogout(reason = 'inactivity_60m') {
      hideInactivityWarning();
      try {
        localStorage.removeItem('stk_current_user');
        localStorage.removeItem(ACTIVITY_STORAGE_KEY);
        localStorage.removeItem(ACTIVITY_DATE_KEY);
        sessionStorage.setItem(LOGOUT_REASON_KEY, reason);
        localStorage.setItem(BROADCAST_KEY, JSON.stringify({ action: 'logout', reason: reason, time: Date.now() }));
      } catch (e) {}

      if (typeof window.clearDbCache === 'function') {
        window.clearDbCache();
      }

      // ถ้ามีหน้าต่างเดิมอยู่แล้ว ไม่ต้องสร้างซ้ำ
      if (document.getElementById('stk-timeout-overlay')) return;

      const isCrossDay = reason === 'cross_day';
      const icon = isCrossDay ? '🌅' : '⏳';
      const title = isCrossDay ? 'ขึ้นวันใหม่ (ระบบรีเซ็ตเซสชัน)' : 'หมดเวลาการใช้งาน';
      const msg = isCrossDay
        ? 'เข้าสู่วันใหม่เรียบร้อยแล้ว<br>ระบบได้ออกจากระบบอัตโนมัติ<br>กรุณาเข้าสู่ระบบใหม่เพื่อความถูกต้องของข้อมูล'
        : 'ท่านไม่มีการใช้งานระบบเกิน 60 นาที<br>ระบบได้ออกจากระบบอัตโนมัติ<br>เพื่อความปลอดภัยของข้อมูล';

      const overlay = document.createElement('div');
      overlay.id = 'stk-timeout-overlay';
      overlay.style.cssText = 'position: fixed; inset: 0; background: rgba(15, 23, 42, 0.7); backdrop-filter: blur(6px); z-index: 9999999; display: flex; align-items: center; justify-content: center; padding: 20px; animation: stkFadeIn 0.3s ease-out;';
      
      const popup = document.createElement('div');
      popup.style.cssText = 'background: white; border-radius: 24px; padding: 32px; max-width: 380px; width: 100%; text-align: center; box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25); transform: scale(0.95); animation: popIn 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards;';
      
      popup.innerHTML = `
        <style>@keyframes popIn { to { transform: scale(1); } }</style>
        <div style="width: 72px; height: 72px; background: #fff1f2; color: #f43f5e; border-radius: 24px; display: flex; align-items: center; justify-content: center; font-size: 36px; margin: 0 auto 20px auto; box-shadow: inset 0 0 0 2px #ffe4e6;">${icon}</div>
        <h3 style="font-size: 22px; font-weight: 900; color: #0f172a; margin: 0 0 12px 0; font-family: sans-serif; letter-spacing: -0.5px;">${title}</h3>
        <p style="font-size: 14px; color: #64748b; margin: 0 0 28px 0; line-height: 1.6; font-weight: 500; font-family: sans-serif;">${msg}</p>
        <button id="stk-timeout-btn" style="width: 100%; padding: 14px; background: #2563eb; color: white; border: none; border-radius: 14px; font-size: 15px; font-weight: 800; cursor: pointer; transition: all 0.2s; box-shadow: 0 4px 14px rgba(37, 99, 235, 0.3);">เข้าสู่ระบบใหม่</button>
      `;

      overlay.appendChild(popup);
      document.body.appendChild(overlay);

      const doReload = () => {
        try {
          if (window.top && window.top.location && window.top !== window) {
            window.top.location.reload();
            return;
          }
        } catch (e) {}
        window.location.reload();
      };

      const btn = document.getElementById('stk-timeout-btn');
      if (btn) {
        btn.addEventListener('click', doReload);
        btn.onmouseover = () => btn.style.backgroundColor = '#1d4ed8';
        btn.onmouseout = () => btn.style.backgroundColor = '#2563eb';
      }
    }

    // 4) Watchdog Timer ตรวจสอบสถานะทุก 10 วินาที
    setInterval(() => {
      try {
        const userStr = localStorage.getItem('stk_current_user');
        if (!userStr) {
          hideInactivityWarning();
          return;
        }

        const now = Date.now();
        const todayStr = getLocalDateStr();
        const lastDate = localStorage.getItem(ACTIVITY_DATE_KEY);
        const lastActivity = Number(localStorage.getItem(ACTIVITY_STORAGE_KEY) || 0);

        // เช็คเงื่อนไขข้ามวัน
        if (lastDate && lastDate !== todayStr) {
          performAutoLogout('cross_day');
          return;
        }

        if (!lastActivity || isNaN(lastActivity)) {
          localStorage.setItem(ACTIVITY_STORAGE_KEY, String(now));
          localStorage.setItem(ACTIVITY_DATE_KEY, todayStr);
          return;
        }

        const inactiveDuration = now - lastActivity;

        // ถ้าไม่มีการใช้งานเกิน 60 นาที -> Logout อัตโนมัติทันที
        if (inactiveDuration >= INACTIVITY_TIMEOUT_MS) {
          performAutoLogout('inactivity_60m');
          return;
        }

        // ถ้าเข้าสู่ช่วง 2 นาทีสุดท้ายก่อนหมดเวลา -> แสดงแถบเตือนล่วงหน้า
        if (inactiveDuration >= (INACTIVITY_TIMEOUT_MS - WARNING_BEFORE_TIMEOUT_MS)) {
          const minsRemaining = Math.max(1, Math.ceil((INACTIVITY_TIMEOUT_MS - inactiveDuration) / 60000));
          showInactivityWarning(minsRemaining);
        } else {
          hideInactivityWarning();
        }
      } catch (e) {}
    }, 10000);

    // 5) ตรวจสอบทันทีเมื่อกลับมาที่แท็บ (เช่น เครื่องตื่นจาก Sleep หรือคลิกกลับมาดูแท็บ)
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) {
        try {
          const userStr = localStorage.getItem('stk_current_user');
          if (!userStr) return;

          const now = Date.now();
          const todayStr = getLocalDateStr();
          const lastDate = localStorage.getItem(ACTIVITY_DATE_KEY);
          const lastActivity = Number(localStorage.getItem(ACTIVITY_STORAGE_KEY) || 0);

          if ((lastDate && lastDate !== todayStr) || (lastActivity > 0 && now - lastActivity >= INACTIVITY_TIMEOUT_MS)) {
            performAutoLogout(lastDate && lastDate !== todayStr ? 'cross_day' : 'inactivity_60m');
          }
        } catch (e) {}
      }
    });

    // 6) ซิงค์ข้ามแท็บ (Cross-Tab Sync): เมื่อแท็บใดแท็บหนึ่งออกจากระบบ ทุกแท็บจะออกจากระบบทันที
    window.addEventListener('storage', (e) => {
      if (e.key === BROADCAST_KEY || (e.key === 'stk_current_user' && !e.newValue)) {
        if (!sessionStorage.getItem(LOGOUT_REASON_KEY)) {
          sessionStorage.setItem(LOGOUT_REASON_KEY, 'synced_logout');
        }
        try {
          if (window.top && window.top.location && window.top !== window) {
            window.top.location.reload();
            return;
          }
        } catch (err) {}
        window.location.reload();
      }
    });

    // 7) ฟังก์ชันรีเซ็ตเวลาสำหรับเรียกใช้ภายนอก (เช่น เมื่อเพิ่งกดเข้าสู่ระบบสำเร็จ)
    window.resetSessionInactivityTimer = function () {
      try {
        const now = Date.now();
        const todayStr = getLocalDateStr();
        localStorage.setItem(ACTIVITY_STORAGE_KEY, String(now));
        localStorage.setItem(ACTIVITY_DATE_KEY, todayStr);
        hideInactivityWarning();
      } catch (e) {}
    };
  })();

})();
