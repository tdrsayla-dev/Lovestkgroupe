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
    'stk_payout_logs': 45 * 1000,          // ล็อกการจ่ายคอมมิชชั่น 45 วินาที
    'stk_campaigns': 2 * 60 * 1000         // แคมเปญแข่งขัน 2 นาที
  };

  // กำหนดคอลัมน์มาตรฐานสำหรับตารางต่างๆ (รวม id_card_url เพื่อให้รูปโปรไฟล์แสดงผล และ image_url เพื่อให้รูปสินค้าแสดงผล)
  // stk_customers: ตัด extra_details_json ออก เพราะเป็น JSON ขนาดใหญ่ที่ไม่ได้ใช้แสดงผลในตาราง ลด Egress ได้มาก
  const DEFAULT_TABLE_SELECT = {
    'stk_members': 'user_id,username,name,business_team,permission_role,status,id_card_url,sponsor_id,phone_number,email,address,line_id,line_uid,bank_name,bank_account_no,bank_account_name,accumulated_pv,created_at',
    'stk_products': 'product_id,name,category,price_full,price_member,price_promo,give_pv,current_stock,status,image_url,self_fee,level_1_fee,level_2_fee,level_3_fee,level_4_fee,level_5_fee,self_percent_full,level_1_percent_full,level_2_percent_full,level_3_percent_full,level_4_percent_full,level_5_percent_full,self_percent_member,level_1_percent_member,level_2_percent_member,level_3_percent_member,level_4_percent_member,level_5_percent_member,barcode,is_bundle,base_product,bundle_qty,full_margin_amount,full_margin_currency',
    'stk_customers': 'customer_id,name,phone,line_id,customer_type,symptom_disease,closer_id,owner_member_id,created_at'
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

  // ================================================================
  // 4. ระบบ Session Inactivity Timeout (ระบบล็อกเอาต์อัตโนมัติเมื่อไม่มีการใช้งาน 60 นาที)
  // ป้องกันการเปิดแท็บทิ้งไว้กิน Data Egress และรักษาความปลอดภัยของระบบ
  // ================================================================
  (function initSessionInactivityManager() {
    const INACTIVITY_TIMEOUT_MS = 60 * 60 * 1000; // 60 นาที (3,600,000 มิลลิวินาที)
    const WARNING_BEFORE_TIMEOUT_MS = 2 * 60 * 1000; // แจ้งเตือนล่วงหน้า 2 นาที (120,000 มิลลิวินาที)
    const ACTIVITY_STORAGE_KEY = 'stk_last_activity';
    const LOGOUT_REASON_KEY = 'stk_logout_reason';
    const BROADCAST_KEY = 'stk_broadcast_session_event';

    let lastRecordedTime = 0;
    let warningBannerEl = null;

    // 1) ดักจับความเคลื่อนไหวของผู้ใช้ (User Activity) แบบ Throttled
    function recordActivity() {
      const now = Date.now();
      if (now - lastRecordedTime > 5000) {
        lastRecordedTime = now;
        try {
          if (localStorage.getItem('stk_current_user')) {
            localStorage.setItem(ACTIVITY_STORAGE_KEY, String(now));
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

    // 3) ตัวสั่งการ Logout เมื่อหมดเวลา 60 นาที
    function performAutoLogout() {
      hideInactivityWarning();
      try {
        localStorage.removeItem('stk_current_user');
        sessionStorage.setItem(LOGOUT_REASON_KEY, 'inactivity_60m');
        localStorage.setItem(BROADCAST_KEY, JSON.stringify({ action: 'logout', reason: 'inactivity_60m', time: Date.now() }));
      } catch (e) {}

      // สร้าง Custom Popup แทน alert() พื้นฐาน
      const overlay = document.createElement('div');
      overlay.style.cssText = 'position: fixed; inset: 0; background: rgba(15, 23, 42, 0.7); backdrop-filter: blur(6px); z-index: 9999999; display: flex; align-items: center; justify-content: center; padding: 20px; animation: stkFadeIn 0.3s ease-out;';
      
      const popup = document.createElement('div');
      popup.style.cssText = 'background: white; border-radius: 24px; padding: 32px; max-width: 380px; width: 100%; text-align: center; box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25); transform: scale(0.95); animation: popIn 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards;';
      
      popup.innerHTML = `
        <style>@keyframes popIn { to { transform: scale(1); } }</style>
        <div style="width: 72px; height: 72px; background: #fff1f2; color: #f43f5e; border-radius: 24px; display: flex; align-items: center; justify-content: center; font-size: 36px; margin: 0 auto 20px auto; box-shadow: inset 0 0 0 2px #ffe4e6;">⏳</div>
        <h3 style="font-size: 22px; font-weight: 900; color: #0f172a; margin: 0 0 12px 0; font-family: sans-serif; letter-spacing: -0.5px;">หมดเวลาการใช้งาน</h3>
        <p style="font-size: 14px; color: #64748b; margin: 0 0 28px 0; line-height: 1.6; font-weight: 500; font-family: sans-serif;">ท่านไม่มีการใช้งานระบบเกิน 60 นาที<br>ระบบได้ออกจากระบบอัตโนมัติ<br>เพื่อความปลอดภัยของข้อมูล</p>
        <button id="stk-timeout-btn" style="width: 100%; padding: 14px; background: #2563eb; color: white; border: none; border-radius: 14px; font-size: 15px; font-weight: 800; cursor: pointer; transition: all 0.2s; box-shadow: 0 4px 14px rgba(37, 99, 235, 0.3);">เข้าสู่ระบบใหม่</button>
      `;

      overlay.appendChild(popup);
      document.body.appendChild(overlay);

      // เมื่อกดปุ่มค่อยทำการรีเฟรชหน้าเว็บ
      document.getElementById('stk-timeout-btn').addEventListener('click', () => {
         try {
          if (window.top && window.top.location && window.top !== window) {
            window.top.location.reload();
            return;
          }
        } catch (e) {}
        window.location.reload();
      });

      // ดักจับการนำเมาส์ไปชี้ปุ่มให้มีเอฟเฟกต์
      const btn = document.getElementById('stk-timeout-btn');
      btn.onmouseover = () => btn.style.backgroundColor = '#1d4ed8';
      btn.onmouseout = () => btn.style.backgroundColor = '#2563eb';
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
        let lastActivity = Number(localStorage.getItem(ACTIVITY_STORAGE_KEY) || 0);
        if (!lastActivity || isNaN(lastActivity)) {
          lastActivity = now;
          localStorage.setItem(ACTIVITY_STORAGE_KEY, String(now));
        }

        const inactiveDuration = now - lastActivity;

        // ถ้าไม่มีการใช้งานเกิน 60 นาที -> Logout อัตโนมัติทันที
        if (inactiveDuration >= INACTIVITY_TIMEOUT_MS) {
          performAutoLogout();
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

    // 5) ซิงค์ข้ามแท็บ (Cross-Tab Sync): เมื่อแท็บใดแท็บหนึ่งออกจากระบบ ทุกแท็บจะออกจากระบบทันที
    window.addEventListener('storage', (e) => {
      if (e.key === BROADCAST_KEY || (e.key === 'stk_current_user' && !e.newValue)) {
        if (sessionStorage.getItem(LOGOUT_REASON_KEY) !== 'inactivity_60m') {
          sessionStorage.setItem(LOGOUT_REASON_KEY, 'inactivity_60m');
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

    // 6) ฟังก์ชันรีเซ็ตเวลาสำหรับเรียกใช้ภายนอก (เช่น เมื่อเพิ่งกดเข้าสู่ระบบสำเร็จ)
    window.resetSessionInactivityTimer = function () {
      try {
        const now = Date.now();
        localStorage.setItem(ACTIVITY_STORAGE_KEY, String(now));
        hideInactivityWarning();
      } catch (e) {}
    };
  })();

})();
