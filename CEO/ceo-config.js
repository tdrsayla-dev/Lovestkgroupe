// ================================================================
// CEO-CONFIG.JS — การตั้งค่า Supabase เฉพาะระบบ CEO Dashboard
// ไฟล์นี้เป็นของระบบ CEO โดยเฉพาะ ไม่ขึ้นกับ root config.js ของระบบอื่น
// ================================================================

(function () {
  'use strict';

  // 1. Supabase Config — CEO System
  const CEO_CONFIG = {
    SUPABASE_URL:      'https://mfpkeyrykqnrywyksyqp.supabase.co',
    SUPABASE_ANON_KEY: 'sb_publishable_807NIkuj6MAs1KZY-m4tug_Fm1Mk-AO'
  };

  // 2. Expose ไปที่ window (เพื่อให้ ceo-function.js และ ceo-login.html ใช้งานได้)
  window.CEO_CONFIG        = CEO_CONFIG;
  window.APP_CONFIG        = CEO_CONFIG;
  window.SUPABASE_URL      = CEO_CONFIG.SUPABASE_URL;
  window.SUPABASE_ANON_KEY = CEO_CONFIG.SUPABASE_ANON_KEY;
  window.SUPABASE_REST_URL = CEO_CONFIG.SUPABASE_URL + '/rest/v1';
  window.SUPABASE_HEADERS  = {
    'Content-Type':  'application/json',
    'apikey':        CEO_CONFIG.SUPABASE_ANON_KEY,
    'Authorization': 'Bearer ' + CEO_CONFIG.SUPABASE_ANON_KEY,
    'Prefer':        'return=representation'
  };

  // 3. Helper: supabaseSelect พร้อม In-Memory Cache
  const _queryCache = new Map();
  const _CACHE_TTL = {
    'stk_products':        3 * 60 * 1000,
    'stk_customer_types':  5 * 60 * 1000,
    'stk_closers':         5 * 60 * 1000,
    'stk_business_teams':  5 * 60 * 1000,
    'stk_system_settings': 5 * 60 * 1000,
    'stk_members':         2 * 60 * 1000,
    'v_ceo_sales_data':    1 * 60 * 1000
  };

  if (typeof window.supabaseSelect !== 'function') {
    window.supabaseSelect = async function (table, query) {
      const isNoCache  = query && query.includes('nocache=true');
      const cleanQuery = query ? query.replace(/&?nocache=true/g, '').replace(/^\?/, '') : '';
      const cacheKey   = table + (cleanQuery ? '?' + cleanQuery : '');
      const ttl        = _CACHE_TTL[table] || 0;

      if (!isNoCache && ttl > 0 && _queryCache.has(cacheKey)) {
        const cached = _queryCache.get(cacheKey);
        if (Date.now() - cached.timestamp < ttl) {
          return JSON.parse(JSON.stringify(cached.data));
        }
      }

      const url = window.SUPABASE_REST_URL + '/' + table + (cleanQuery ? '?' + cleanQuery : '');
      try {
        const res = await fetch(url, { method: 'GET', headers: window.SUPABASE_HEADERS });
        if (!res.ok) {
          const t = await res.text();
          throw new Error('SELECT ' + table + ': ' + res.status + ' ' + t);
        }
        const data = await res.json();
        if (ttl > 0) _queryCache.set(cacheKey, { timestamp: Date.now(), data });
        return data;
      } catch (e) {
        console.warn('[CEO-Config] supabaseSelect error:', e.message);
        return null;
      }
    };
  }

  console.log('%c CEO Config Loaded', 'color:#0d9488;font-weight:bold;', CEO_CONFIG.SUPABASE_URL);
})();
