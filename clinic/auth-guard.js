// ==========================================================================
// Clinic System — Auth Guard (auth-guard.js)
// ใส่ไว้บนสุดของ <head> ในทุกหน้าที่ต้องล็อกอิน (ยกเว้น login.html)
// 1) ไม่มี session ของ Supabase Auth หรือไม่มี clinicUser → เด้งไป login.html ทันที
// 2) ตรวจ session กับเซิร์ฟเวอร์ และโหลด role/permissions จากฐานข้อมูลมาทับค่าใน localStorage
//    (กันการแก้ localStorage เพื่อยกสิทธิ์ตัวเอง)
// ==========================================================================
(function () {
    var LOGIN_PAGE = 'login.html';
    var DEFAULT_URL = 'https://fpmstumpobbjozflkola.supabase.co';
    var DEFAULT_KEY = 'sb_publishable_h9-j-0I2ku6rYYvoeHmooQ_B5GrRzR7';

    function getUrl() { return (window.CONFIG && window.CONFIG.SUPABASE_URL) || window.SUPABASE_URL || DEFAULT_URL; }
    function getKey() { return (window.CONFIG && window.CONFIG.SUPABASE_ANON_KEY) || window.SUPABASE_ANON_KEY || DEFAULT_KEY; }

    var projectRef = getUrl().replace(/^https?:\/\//, '').split('.')[0];
    var TOKEN_KEY = 'sb-' + projectRef + '-auth-token';

    function clearLocalSession() {
        try {
            localStorage.removeItem('clinicUser');
            localStorage.removeItem('clinic_last_activity');
            localStorage.removeItem(TOKEN_KEY);
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
            var raw = localStorage.getItem(TOKEN_KEY);
            if (!raw) return false;
            var s = JSON.parse(raw);
            return !!(s && (s.refresh_token || s.access_token));
        } catch (e) {
            return false;
        }
    }

    // ออกจากระบบให้ครบ (ลบ session ของ Supabase ด้วย) — ใช้แทนการลบ clinicUser อย่างเดียว
    window.clinicSignOut = async function () {
        try {
            var client = window._supabase || (window.supabase && window.supabase.createClient(getUrl(), getKey()));
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
        var client = window.supabase.createClient(getUrl(), getKey());

        var userRes;
        try {
            userRes = await client.auth.getUser();
        } catch (e) {
            console.warn('Auth guard: network error, skip verification', e);
            return;
        }
        if (userRes.error || !userRes.data || !userRes.data.user) {
            // ไม่ใช่ network error → session ใช้ไม่ได้แล้ว
            if (userRes.error && /fetch|network/i.test(userRes.error.message || '')) return;
            goLogin();
            return;
        }

        var uid = userRes.data.user.id;
        var cols = 'id, emp_code, email, full_name, role, permissions, is_active';
        var staffRes = await client.from('staff_users').select(cols).eq('auth_user_id', uid).maybeSingle();
        var staff = staffRes.data;
        if (!staff && !staffRes.error) {
            staffRes = await client.from('staff_users').select(cols).eq('id', uid).maybeSingle();
            staff = staffRes.data;
        }
        if (staffRes.error) {
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
            authenticated_at: stored.authenticated_at || new Date().toISOString()
        };
        var changed = stored.id !== fresh.id || stored.role !== fresh.role ||
            JSON.stringify(stored.permissions || []) !== JSON.stringify(fresh.permissions);
        localStorage.setItem('clinicUser', JSON.stringify(fresh));
        if (changed && window === window.top) window.location.reload();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', verifyWithServer);
    } else {
        verifyWithServer();
    }
})();
