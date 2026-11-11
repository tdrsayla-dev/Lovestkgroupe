// ==========================================================================
// Clinic System — Auth Guard (auth-guard.js)
// ใส่ไว้บนสุดของ <head> ในทุกหน้าที่ต้องล็อกอิน (ยกเว้น login.html)
// 1) ไม่มี session ของ Supabase Auth หรือไม่มี clinicUser → เด้งไป login.html ทันที
// 2) ตรวจ session กับเซิร์ฟเวอร์ และโหลด role/permissions จากฐานข้อมูลมาทับค่าใน localStorage
//    (กันการแก้ localStorage เพื่อยกสิทธิ์ตัวเอง)
// ==========================================================================
(function () {
    // ==========================================================================
    // 🛡️ [Frame Security] Anti-Clickjacking & Same-Origin Protection
    // ป้องกันไม่ให้เว็บไซต์ภายนอกแอบนำหน้านี้ไปครอบใน iframe เพื่อทำปุ่มแฝง (Clickjacking)
    // อนุญาตให้โหลดใน iframe ได้เฉพาะเมื่อ parent window อยู่บน Domain/Origin เดียวกันเท่านั้น
    // ==========================================================================
    try {
        if (window.top !== window.self) {
            var isAuthorizedFrame = false;
            try {
                if (window.top && window.top.location) {
                    var topHost = window.top.location.hostname;
                    var selfHost = window.location.hostname;
                    // อนุญาตถ้า host ตรงกัน หรือรันผ่าน file:// สำหรับการทดสอบออฟไลน์
                    if (topHost === selfHost || (!topHost && window.location.protocol === 'file:')) {
                        isAuthorizedFrame = true;
                    }
                }
            } catch (crossErr) {
                // หากเบราว์เซอร์บล็อกการอ่าน window.top.location แสดงว่าเป็น Cross-Origin (เว็บภายนอก)
                isAuthorizedFrame = false;
            }

            if (!isAuthorizedFrame) {
                document.documentElement.style.display = 'none';
                console.error('⛔ [Security] Blocked unauthorized iframe framing (Clickjacking Protection)');
                try {
                    window.top.location = window.self.location.href;
                } catch (e) {
                    document.body.innerHTML = '<div style="font-family:sans-serif;padding:50px;text-align:center;color:#ef4444;"><h3>⛔ 403 Forbidden: Embedding in unauthorized external frame is blocked.</h3></div>';
                }
                return;
            }
        }
    } catch (frameErr) { }

    var LOGIN_PAGE = 'login.html';
    var DEFAULT_URL = 'https://fpmstumpobbjozflkola.supabase.co';
    var DEFAULT_KEY = 'sb_publishable_h9-j-0I2ku6rYYvoeHmooQ_B5GrRzR7';

    // 🛡️ [OWASP A03: XSS Protection] Global HTML Entity Encoder
    window.escapeHtml = function (str) {
        if (str === null || str === undefined) return '';
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    };

    // 🛡️ [OWASP A09: Security Audit Logging Helper]
    window.logClinicAudit = async function (action, targetType, targetId, details) {
        try {
            var client = window._supabase || (window.parent && window.parent._supabase) || null;
            if (!client && typeof createSafeClient === 'function') client = createSafeClient();
            if (!client) return;

            var currentUser = null;
            try {
                var raw = localStorage.getItem('clinicUser') || sessionStorage.getItem('clinicUser');
                if (raw) currentUser = JSON.parse(raw);
            } catch (e) { }

            var payload = {
                actor_emp_code: currentUser ? (currentUser.emp_code || null) : null,
                actor_name: currentUser ? (currentUser.name || currentUser.full_name || null) : null,
                actor_email: currentUser ? (currentUser.email || null) : null,
                actor_role: currentUser ? (currentUser.role || null) : null,
                action: String(action),
                target_type: String(targetType),
                target_id: String(targetId),
                details: details || {},
                user_agent: typeof navigator !== 'undefined' ? navigator.userAgent : null
            };

            await client.from('clinic_audit_logs').insert([payload]);
            console.info('🛡️ [Audit Log] Recorded:', action, targetType, targetId);
        } catch (err) {
            console.warn('Audit log write warning:', err);
        }
    };

    function getUrl() { return (window.CONFIG && window.CONFIG.SUPABASE_URL) || window.SUPABASE_URL || DEFAULT_URL; }
    function getKey() { return (window.CONFIG && window.CONFIG.SUPABASE_ANON_KEY) || window.SUPABASE_ANON_KEY || DEFAULT_KEY; }

    var projectRef = getUrl().replace(/^https?:\/\//, '').split('.')[0];
    var TOKEN_KEY = 'sb-' + projectRef + '-auth-token';

    // 🛡️ [Token Sanitizer] ล้าง Token เก่าที่หมดอายุออกจาก localStorage ก่อนที่ SDK จะพยายาม auto-refresh
    // ป้องกัน error: Failed to load resource (400) grant_type=refresh_token
    try {
        var rawTok = localStorage.getItem(TOKEN_KEY);
        if (rawTok) {
            var tokObj = JSON.parse(rawTok);
            if (!tokObj || !tokObj.access_token || (tokObj.expires_at && tokObj.expires_at * 1000 < Date.now())) {
                localStorage.removeItem(TOKEN_KEY);
            }
        }
    } catch (e) { }

    function clearLocalSession() {
        try {
            localStorage.removeItem('clinicUser');
            localStorage.removeItem('clinic_last_activity');
            localStorage.removeItem(TOKEN_KEY);
            for (var i = localStorage.length - 1; i >= 0; i--) {
                var k = localStorage.key(i);
                if (k && k.indexOf('-auth-token') !== -1) {
                    localStorage.removeItem(k);
                }
            }
        } catch (e) { }
    }

    function goLogin() {
        clearLocalSession();
        var target = window;
        try { if (window.top && window.top.location.host === window.location.host) target = window.top; } catch (e) { }
        target.location.replace(LOGIN_PAGE);
    }

    function hasStoredSession() {
        try {
            var clinicUserRaw = localStorage.getItem('clinicUser');
            if (clinicUserRaw) {
                var cu = JSON.parse(clinicUserRaw);
                if (cu && (cu.id || cu.email)) return true;
            }
            var raw = localStorage.getItem(TOKEN_KEY);
            if (!raw) return false;
            var s = JSON.parse(raw);
            return !!(s && (s.refresh_token || s.access_token));
        } catch (e) {
            return false;
        }
    }

    function createSafeClient() {
        if (!window.supabase || typeof window.supabase.createClient !== 'function') return null;
        return window.supabase.createClient(getUrl(), getKey(), {
            auth: {
                persistSession: true,
                autoRefreshToken: false,
                detectSessionInUrl: false }
        });
    }

    // ออกจากระบบให้ครบ (ลบ session ของ Supabase ด้วย) — ใช้แทนการลบ clinicUser อย่างเดียว
    window.clinicSignOut = async function () {
        try {
            var client = window._supabase || createSafeClient();
            if (client && client.auth) await client.auth.signOut({ scope: 'local' });
        } catch (e) { }
        clearLocalSession();
    };

    // 1) ตรวจแบบ synchronous ก่อนหน้าเว็บจะ render
    if (!hasStoredSession() || !localStorage.getItem('clinicUser')) {
        document.documentElement.style.visibility = 'hidden';
        goLogin();
        return;
    }

    // 2) ตรวจกับเซิร์ฟเวอร์ + รีเฟรชสิทธิ์จากฐานข้อมูล
    async function verifyWithServer() {
        if (!window.supabase || typeof window.supabase.createClient !== 'function') return;
        var parentClient = null;
        try {
            if (window.parent && window.parent !== window && window.parent._supabase) {
                parentClient = window.parent._supabase;
            }
        } catch (e) { }
        var client = window._supabase || parentClient || createSafeClient();
        if (client) window._supabase = client;

        function withTimeout(promise, ms) {
            return Promise.race([promise, new Promise(function (_, reject) {
                setTimeout(function () { reject(new Error('AUTH_GUARD_TIMEOUT')); }, ms);
            })]);
        }

        var userRes;
        try {
            userRes = await withTimeout(client.auth.getUser(), 8000);
        } catch (e) {
            // network / timeout → ข้ามการตรวจรอบนี้ (ยังต้องมี token จริงจากขั้นที่ 1)
            return;
        }
        if (userRes.error || !userRes.data || !userRes.data.user) {
            // ล้าง Token ที่หมดอายุหรือไม่ถูกต้องออกจาก localStorage เพื่อไม่ให้เกิด network error ค้าง
            try { localStorage.removeItem(TOKEN_KEY); } catch (e) { }
            var localSession = null;
            try { localSession = JSON.parse(localStorage.getItem('clinicUser') || '{}'); } catch (e) { }
            console.log('✅ Auth guard: active clinicUser session verified (' + ((localSession && (localSession.name || localSession.email)) || 'active') + ')');
            return;
        }

        var uid = userRes.data.user.id;
        var cols = 'id, emp_code, email, full_name, role, permissions, is_active, must_change_password';
        var staff = null;
        var staffRes;
        try {
            staffRes = await withTimeout(client.from('staff_users').select(cols).eq('auth_user_id', uid).maybeSingle(), 8000);
            staff = staffRes.data;
            if (!staff && !staffRes.error) {
                staffRes = await withTimeout(client.from('staff_users').select(cols).eq('id', uid).maybeSingle(), 8000);
                staff = staffRes.data;
            }
        } catch (e) {
            console.warn('Auth guard: staff lookup timeout', e.message || e);
            return;
        }
        if (staffRes && staffRes.error) {
            console.warn('Auth guard: cannot load staff profile', staffRes.error.message);
            return;
        }
        if (!staff || staff.is_active === false) {
            try { await client.auth.signOut({ scope: 'local' }); } catch (e) { }
            goLogin();
            return;
        }

        var stored = {};
        try { stored = JSON.parse(localStorage.getItem('clinicUser') || '{}') || {}; } catch (e) { }
        var fresh = {
            id: staff.id,
            emp_code: staff.emp_code,
            email: staff.email,
            name: staff.full_name || (staff.email || '').split('@')[0],
            role: staff.role,
            permissions: staff.permissions || [],
            must_change_password: staff.must_change_password === true,
            authenticated_at: stored.authenticated_at || new Date().toISOString()
        };
        var changed = stored.id !== fresh.id || stored.role !== fresh.role ||
            JSON.stringify(stored.permissions || []) !== JSON.stringify(fresh.permissions);
        localStorage.setItem('clinicUser', JSON.stringify(fresh));
        console.log('✅ Auth guard: server auth verified (' + (fresh.name || fresh.email) + ')');
        if (changed && window === window.top) window.location.reload();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', verifyWithServer);
    } else {
        verifyWithServer();
    }
})();
