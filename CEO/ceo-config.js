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

  // 2.1 Clinic Database Config (ดึงจาก window.CLINIC_CONFIG นอกโฟลเดอร์ CEO ถ้ามี หรือใช้ค่ามาตรฐานระบบคลินิก)
  const CLINIC_CONFIG = (window.CLINIC_CONFIG && window.CLINIC_CONFIG.SUPABASE_URL) ? window.CLINIC_CONFIG : {
    SUPABASE_URL:      'https://fpmstumpobbjozflkola.supabase.co',
    SUPABASE_ANON_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZwbXN0dW1wb2Jiam96Zmxrb2xhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODM5MDE0NDcsImV4cCI6MjA5OTQ3NzQ0N30.qTn4UHISBY9A5fX83ANk0mu3JSgK42ByLZ9xPh2TEvM'
  };

  window.CLINIC_CONFIG            = CLINIC_CONFIG;
  window.CLINIC_SUPABASE_URL      = CLINIC_CONFIG.SUPABASE_URL;
  window.CLINIC_SUPABASE_ANON_KEY = CLINIC_CONFIG.SUPABASE_ANON_KEY;
  window.CLINIC_SUPABASE_REST_URL = CLINIC_CONFIG.SUPABASE_URL + '/rest/v1';
  window.CLINIC_SUPABASE_HEADERS  = {
    'Content-Type':  'application/json',
    'apikey':        CLINIC_CONFIG.SUPABASE_ANON_KEY,
    'Authorization': 'Bearer ' + CLINIC_CONFIG.SUPABASE_ANON_KEY,
    'Prefer':        'return=representation'
  };

  // 3. Helper: supabaseSelect พร้อม In-Memory Cache (ช่วยลด Request & Egress)
  const _queryCache = new Map();
  const _CACHE_TTL = {
    'stk_products':        5 * 60 * 1000,
    'stk_customer_types':  10 * 60 * 1000,
    'stk_closers':         10 * 60 * 1000,
    'system_users':        10 * 60 * 1000,
    'stk_business_teams':  10 * 60 * 1000,
    'stk_system_settings': 10 * 60 * 1000,
    'stk_members':         5 * 60 * 1000,
    'v_ceo_sales_data':    3 * 60 * 1000
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
        if (ttl > 0 && data) _queryCache.set(cacheKey, { timestamp: Date.now(), data });
        return data;
      } catch (e) {
        console.warn('[CEO-Config] supabaseSelect error:', e.message);
        return null;
      }
    };
  }

  // 4. Helper: clinicSupabaseSelect พร้อม In-Memory Cache (สำหรับเชื่อมต่อดึงข้อมูลจากระบบ Clinic)
  if (typeof window.clinicSupabaseSelect !== 'function') {
    window.clinicSupabaseSelect = async function (table, query) {
      const isNoCache  = query && query.includes('nocache=true');
      const cleanQuery = query ? query.replace(/&?nocache=true/g, '').replace(/^\?/, '') : '';
      const cacheKey   = 'clinic_' + table + (cleanQuery ? '?' + cleanQuery : '');
      const ttl        = 3 * 60 * 1000; // แคชข้อมูลคลินิก 3 นาที (ลด egress & เร่งความเร็ว)

      if (!isNoCache && ttl > 0 && _queryCache.has(cacheKey)) {
        const cached = _queryCache.get(cacheKey);
        if (Date.now() - cached.timestamp < ttl) {
          return JSON.parse(JSON.stringify(cached.data));
        }
      }

      const url = window.CLINIC_SUPABASE_REST_URL + '/' + table + (cleanQuery ? '?' + cleanQuery : '');
      try {
        const res = await fetch(url, { method: 'GET', headers: window.CLINIC_SUPABASE_HEADERS });
        if (!res.ok) {
          const t = await res.text();
          throw new Error('SELECT CLINIC ' + table + ': ' + res.status + ' ' + t);
        }
        const data = await res.json();
        if (ttl > 0 && data) _queryCache.set(cacheKey, { timestamp: Date.now(), data });
        return data;
      } catch (e) {
        console.warn('[CEO-Config] clinicSupabaseSelect error:', e.message);
        return null;
      }
    };
  }

  console.log('%c CEO Config Loaded (Main & Clinic DB Connected)', 'color:#0d9488;font-weight:bold;', CEO_CONFIG.SUPABASE_URL, CLINIC_CONFIG.SUPABASE_URL);
})();
