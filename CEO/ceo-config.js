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

  // 3. Session & Inactivity Configuration (ระบบรักษาความปลอดภัยและประหยัด Data Egress)
  const CEO_SESSION_CONFIG = {
    SESSION_KEY:               'stk_ceo_session',
    ACTIVITY_KEY:              'stk_ceo_last_activity',
    ACTIVITY_DATE_KEY:         'stk_ceo_last_activity_date',
    LOGOUT_REASON_KEY:         'stk_ceo_logout_reason',
    INACTIVITY_TIMEOUT_MS:     60 * 60 * 1000, // 60 นาที (3,600,000 มิลลิวินาที)
    WARNING_BEFORE_TIMEOUT_MS: 2 * 60 * 1000   // แจ้งเตือนล่วงหน้า 2 นาที (120,000 มิลลิวินาที)
  };

  window.CEO_SESSION_CONFIG = CEO_SESSION_CONFIG;

  function getLocalDateStr() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }

  // 🔒 ตรวจสอบว่าผู้ใช้งานล็อกอินอยู่จริง และเซสชันยังไม่หมดอายุ
  function isCeoAuthenticated() {
    try {
      const sessionStr = localStorage.getItem(CEO_SESSION_CONFIG.SESSION_KEY);
      if (!sessionStr) return false;
      const session = JSON.parse(sessionStr);
      if (!session || !session.id) return false;

      const now = Date.now();
      const lastActivity = Number(localStorage.getItem(CEO_SESSION_CONFIG.ACTIVITY_KEY) || 0);
      if (lastActivity > 0 && (now - lastActivity >= CEO_SESSION_CONFIG.INACTIVITY_TIMEOUT_MS)) {
        return false;
      }

      const todayStr = getLocalDateStr();
      const lastDate = localStorage.getItem(CEO_SESSION_CONFIG.ACTIVITY_DATE_KEY);
      if (lastDate && lastDate !== todayStr) {
        return false;
      }

      return true;
    } catch (e) {
      return false;
    }
  }
  window.isCeoAuthenticated = isCeoAuthenticated;

  // 4. Helper: supabaseSelect พร้อม In-Memory Cache & Egress Protection
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

  // ล้างแคชทั้งหมดทันทีเมื่อออกจากระบบ
  window.clearCeoDbCache = function () {
    _queryCache.clear();
  };

  if (typeof window.supabaseSelect !== 'function') {
    window.supabaseSelect = async function (table, query) {
      // 🛡️ EGRESS PROTECTION: บล็อกการยิง Request เด็ดขาดหากไม่ได้เข้าสู่ระบบหรือเซสชันหมดอายุ
      if (!isCeoAuthenticated()) {
        console.warn(`[CEO-Config] 🛑 Supabase fetch blocked for table '${table}': No active or valid CEO session (Egress Saved)`);
        return null;
      }

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

  // 5. Helper: clinicSupabaseSelect พร้อม In-Memory Cache & Egress Protection
  if (typeof window.clinicSupabaseSelect !== 'function') {
    window.clinicSupabaseSelect = async function (table, query) {
      // 🛡️ EGRESS PROTECTION: บล็อกการยิง Request คลินิกเด็ดขาดหากไม่ได้เข้าสู่ระบบหรือเซสชันหมดอายุ
      if (!isCeoAuthenticated()) {
        console.warn(`[CEO-Config] 🛑 Clinic Supabase fetch blocked for table '${table}': No active or valid CEO session (Egress Saved)`);
        return null;
      }

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

  // 6. ระบบ Inactivity Auto-Logout Manager (ตรวจจับการไม่ใช้งาน 60 นาที & ข้ามวัน)
  (function initCeoInactivityManager() {
    let lastRecordedActivityTime = 0;
    let warningBannerEl = null;
    let isLoggedOut = false;

    // A) ตรวจสอบทันทีตอนเริ่มต้น (Synchronous Check)
    try {
      const sessionStr = localStorage.getItem(CEO_SESSION_CONFIG.SESSION_KEY);
      if (sessionStr) {
        const now = Date.now();
        const todayStr = getLocalDateStr();
        const lastDate = localStorage.getItem(CEO_SESSION_CONFIG.ACTIVITY_DATE_KEY);
        const lastActivity = Number(localStorage.getItem(CEO_SESSION_CONFIG.ACTIVITY_KEY) || 0);

        const isCrossDay = lastDate && lastDate !== todayStr;
        const isTimedOut = lastActivity > 0 && (now - lastActivity >= CEO_SESSION_CONFIG.INACTIVITY_TIMEOUT_MS);

        if (isCrossDay || isTimedOut) {
          performCeoAutoLogout(isCrossDay ? 'cross_day' : 'inactivity');
          return;
        } else {
          // ยังใช้งานได้ อัปเดตเวลาล่าสุด
          localStorage.setItem(CEO_SESSION_CONFIG.ACTIVITY_KEY, String(now));
          localStorage.setItem(CEO_SESSION_CONFIG.ACTIVITY_DATE_KEY, todayStr);
        }
      }
    } catch (e) {}

    // B) ฟังก์ชันบันทึกกิจกรรมผู้ใช้ (Throttled ทุก 5 วินาที)
    function recordActivity() {
      if (isLoggedOut) return;
      const now = Date.now();
      if (now - lastRecordedActivityTime > 5000) {
        lastRecordedActivityTime = now;
        try {
          if (localStorage.getItem(CEO_SESSION_CONFIG.SESSION_KEY)) {
            const todayStr = getLocalDateStr();
            const lastDate = localStorage.getItem(CEO_SESSION_CONFIG.ACTIVITY_DATE_KEY);

            // หากเปิดข้ามคืนเข้าสู่วันใหม่
            if (lastDate && lastDate !== todayStr) {
              performCeoAutoLogout('cross_day');
              return;
            }

            localStorage.setItem(CEO_SESSION_CONFIG.ACTIVITY_KEY, String(now));
            localStorage.setItem(CEO_SESSION_CONFIG.ACTIVITY_DATE_KEY, todayStr);
            hideWarningBanner();
          }
        } catch (e) {}
      }
    }

    window.resetCeoActivity = function () {
      if (isLoggedOut) return;
      const now = Date.now();
      lastRecordedActivityTime = now;
      try {
        localStorage.setItem(CEO_SESSION_CONFIG.ACTIVITY_KEY, String(now));
        localStorage.setItem(CEO_SESSION_CONFIG.ACTIVITY_DATE_KEY, getLocalDateStr());
        hideWarningBanner();
      } catch (e) {}
    };

    // ดักจับ Event ผู้ใช้งาน
    ['mousemove', 'mousedown', 'keydown', 'touchstart', 'scroll', 'click'].forEach(evt => {
      window.addEventListener(evt, recordActivity, { passive: true });
    });

    // C) แสดงและซ่อนแบนเนอร์แจ้งเตือนก่อนหมดเวลา
    function showWarningBanner(secondsRemaining) {
      if (isLoggedOut) return;
      if (!warningBannerEl) {
        warningBannerEl = document.createElement('div');
        warningBannerEl.id = 'ceo-inactivity-warning';
        warningBannerEl.style.cssText = `
          position: fixed;
          bottom: 24px;
          right: 24px;
          background: #0f172a;
          color: #ffffff;
          padding: 16px 20px;
          border-radius: 16px;
          box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.4), 0 0 0 1px rgba(255, 255, 255, 0.1);
          z-index: 999998;
          display: flex;
          align-items: center;
          gap: 14px;
          font-family: inherit;
          max-width: 440px;
          animation: ceoSlideInUp 0.3s ease-out;
        `;
        document.body.appendChild(warningBannerEl);
      }

      const mins = Math.floor(secondsRemaining / 60);
      const secs = secondsRemaining % 60;
      const timeDisplay = mins > 0 ? `${mins} นาที ${secs} วินาที` : `${secs} วินาที`;

      warningBannerEl.innerHTML = `
        <style>
          @keyframes ceoSlideInUp {
            from { transform: translateY(20px); opacity: 0; }
            to { transform: translateY(0); opacity: 1; }
          }
        </style>
        <div style="width: 40px; height: 40px; border-radius: 10px; background: #f59e0b; color: #ffffff; display: flex; align-items: center; justify-content: center; font-size: 20px; shrink-0;">
          ⏳
        </div>
        <div style="flex: 1;">
          <div style="font-size: 13px; font-weight: 700; color: #f8fafc; margin-bottom: 2px;">
            จะออกจากระบบอัตโนมัติใน ${timeDisplay}
          </div>
          <div style="font-size: 11px; color: #94a3b8; line-height: 1.3;">
            เนื่องจากไม่มีการเคลื่อนไหว เพื่อความปลอดภัยและประหยัด Data Egress
          </div>
        </div>
        <button id="btnCeoExtendSession" style="
          background: #0d9488;
          color: #ffffff;
          border: none;
          padding: 8px 14px;
          border-radius: 10px;
          font-size: 12px;
          font-weight: 700;
          cursor: pointer;
          white-space: nowrap;
          transition: background 0.15s ease;
        ">
          ใช้งานต่อ
        </button>
      `;

      const extendBtn = document.getElementById('btnCeoExtendSession');
      if (extendBtn) {
        extendBtn.onclick = function (e) {
          e.stopPropagation();
          window.resetCeoActivity();
        };
      }
    }

    function hideWarningBanner() {
      if (warningBannerEl && document.body && document.body.contains(warningBannerEl)) {
        try { document.body.removeChild(warningBannerEl); } catch (e) {}
        warningBannerEl = null;
      }
    }

    // D) ฟังก์ชัน Auto-Logout
    function performCeoAutoLogout(reason = 'inactivity') {
      if (isLoggedOut) return;
      isLoggedOut = true;
      hideWarningBanner();

      // ล้างข้อมูลเซสชันและแคชทั้งหมด
      try {
        localStorage.removeItem(CEO_SESSION_CONFIG.SESSION_KEY);
        localStorage.removeItem(CEO_SESSION_CONFIG.ACTIVITY_KEY);
        localStorage.removeItem(CEO_SESSION_CONFIG.ACTIVITY_DATE_KEY);
        sessionStorage.setItem(CEO_SESSION_CONFIG.LOGOUT_REASON_KEY, reason);
      } catch (e) {}

      if (typeof window.clearCeoDbCache === 'function') {
        window.clearCeoDbCache();
      }

      // ถ้าอยู่บนหน้า ceo-login.html อยู่แล้ว ไม่ต้องทำอะไรเพิ่ม
      if (window.location.pathname.includes('ceo-login.html')) return;

      // แสดง Popup แจ้งเตือนสวยงามก่อนเปลี่ยนหน้า หรือเปลี่ยนหน้าทันที
      if (document.getElementById('ceo-timeout-overlay')) return;

      const isCrossDay = reason === 'cross_day';
      const icon = isCrossDay ? '🌅' : '⏳';
      const title = isCrossDay ? 'ขึ้นวันใหม่ (รีเซ็ตเซสชันอัตโนมัติ)' : 'หมดเวลาการใช้งาน (Auto-Logout)';
      const msg = isCrossDay
        ? 'ระบบได้เข้าสู่วันใหม่เรียบร้อยแล้ว<br>เพื่อความถูกต้องของข้อมูลทางการเงินและประหยัด Data Egress<br>ระบบได้ออกจากระบบอัตโนมัติ กรุณาเข้าสู่ระบบใหม่'
        : 'ไม่มีการใช้งานระบบ CEO Dashboard เกิน 60 นาที<br>ระบบได้ออกจากระบบอัตโนมัติและหยุดดึงข้อมูลทุกรายการ<br>เพื่อความปลอดภัยและประหยัด Data Egress ของเซิร์ฟเวอร์';

      const overlay = document.createElement('div');
      overlay.id = 'ceo-timeout-overlay';
      overlay.style.cssText = `
        position: fixed;
        inset: 0;
        background: rgba(15, 23, 42, 0.75);
        backdrop-filter: blur(8px);
        z-index: 9999999;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 20px;
        animation: ceoFadeIn 0.25s ease-out;
      `;

      overlay.innerHTML = `
        <style>
          @keyframes ceoFadeIn { from { opacity: 0; } to { opacity: 1; } }
          @keyframes ceoPopUp { from { transform: scale(0.92); opacity: 0; } to { transform: scale(1); opacity: 1; } }
        </style>
        <div style="background: #ffffff; border-radius: 24px; padding: 36px 28px; max-width: 400px; width: 100%; text-align: center; box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.35); animation: ceoPopUp 0.3s cubic-bezier(0.16, 1, 0.3, 1);">
          <div style="width: 68px; height: 68px; background: #fef2f2; color: #ef4444; border-radius: 20px; display: flex; align-items: center; justify-content: center; font-size: 32px; margin: 0 auto 18px auto; border: 1px solid #fee2e2;">
            ${icon}
          </div>
          <h3 style="font-size: 19px; font-weight: 800; color: #0f172a; margin-bottom: 10px; font-family: inherit;">${title}</h3>
          <p style="font-size: 13px; color: #64748b; line-height: 1.6; margin-bottom: 24px; font-family: inherit;">${msg}</p>
          <button id="btnCeoTimeoutLogin" style="width: 100%; padding: 12px 20px; background: #0d9488; color: #ffffff; border: none; border-radius: 14px; font-size: 14px; font-weight: 700; cursor: pointer; box-shadow: 0 4px 14px rgba(13, 148, 136, 0.35); transition: background 0.15s ease;">
            เข้าสู่ระบบใหม่
          </button>
        </div>
      `;

      document.body.appendChild(overlay);

      const btn = document.getElementById('btnCeoTimeoutLogin');
      if (btn) {
        btn.onclick = () => {
          window.location.replace('ceo-login.html');
        };
      }

      // ป้องกันการค้าง ให้ redirect อัตโนมัติใน 4 วินาที
      setTimeout(() => {
        window.location.replace('ceo-login.html');
      }, 4000);
    }
    window.performCeoAutoLogout = performCeoAutoLogout;

    // E) ตรวจสอบรอบเวลาอย่างสม่ำเสมอทุกๆ 10 วินาที
    setInterval(() => {
      if (isLoggedOut) return;
      try {
        if (!localStorage.getItem(CEO_SESSION_CONFIG.SESSION_KEY)) return;

        const now = Date.now();
        const lastActivity = Number(localStorage.getItem(CEO_SESSION_CONFIG.ACTIVITY_KEY) || 0);
        const todayStr = getLocalDateStr();
        const lastDate = localStorage.getItem(CEO_SESSION_CONFIG.ACTIVITY_DATE_KEY);

        // 1. ตรวจสอบข้ามวัน
        if (lastDate && lastDate !== todayStr) {
          performCeoAutoLogout('cross_day');
          return;
        }

        // 2. ตรวจสอบการหมดเวลา 60 นาที
        const inactiveMs = now - lastActivity;
        if (lastActivity > 0 && inactiveMs >= CEO_SESSION_CONFIG.INACTIVITY_TIMEOUT_MS) {
          performCeoAutoLogout('inactivity');
          return;
        }

        // 3. ตรวจสอบการแจ้งเตือนล่วงหน้า 2 นาที
        if (lastActivity > 0 && inactiveMs >= (CEO_SESSION_CONFIG.INACTIVITY_TIMEOUT_MS - CEO_SESSION_CONFIG.WARNING_BEFORE_TIMEOUT_MS)) {
          const secondsRemaining = Math.max(1, Math.ceil((CEO_SESSION_CONFIG.INACTIVITY_TIMEOUT_MS - inactiveMs) / 1000));
          showWarningBanner(secondsRemaining);
        } else {
          hideWarningBanner();
        }
      } catch (e) {}
    }, 10000);
  })();

  console.log('%c CEO Config Loaded with Auto-Logout & Egress Saver', 'color:#0d9488;font-weight:bold;', CEO_CONFIG.SUPABASE_URL);
})();
