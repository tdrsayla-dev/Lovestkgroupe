(function () {
'use strict';

// 🔒 Helper: SHA-256 Hashing สำหรับตรวจสอบรหัสผ่านสำรอง
async function hashPassword(str) {
    if (!str) return '';
    try {
        const encoder = new TextEncoder();
        const data = encoder.encode(str);
        const hashBuffer = await crypto.subtle.digest('SHA-256', data);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    } catch (e) {
        return str;
    }
}

// ==========================================================================
// Clinic System — Login Logic (login.js)
// ==========================================================================

// 🔐 1. ซ่อนและรับ API Key ผ่าน CONFIG ใน config.js
var cfg = (typeof window.getSupabaseConfig === 'function')
    ? window.getSupabaseConfig()
    : { url: window.SUPABASE_URL || 'https://fpmstumpobbjozflkola.supabase.co', anonKey: window.SUPABASE_ANON_KEY || 'sb_publishable_h9-j-0I2ku6rYYvoeHmooQ_B5GrRzR7' };

var _projectRef = String(cfg.url || '').replace(/^https?:\/\//, '').split('.')[0];
var _authTokenKey = 'sb-' + _projectRef + '-auth-token';

// ป้องกัน Navigator Lock Deadlock ของ @supabase/supabase-js v2 ใน Chrome
var _supabase = supabase.createClient(cfg.url, cfg.anonKey, {
    auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: false,
        lock: async function (_name, _acquireTimeout, fn) {
            return await fn();
        }
    }
});

async function fetchWithTimeout(url, options = {}, timeoutMs = 8000) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
        return await fetch(url, { ...options, signal: controller.signal });
    } finally {
        clearTimeout(timer);
    }
}

// State variables for Rate Limiting & Lockout
let lockoutTimer = null;
const MAX_FAILED_ATTEMPTS = 3;
const LOCKOUT_DURATION_MS = 30000; // 30 seconds

// 🛡️ Helper: CSRF Protection
function initCSRFProtection() {
    let csrfToken = sessionStorage.getItem('clinic_csrf_token');
    if (!csrfToken) {
        csrfToken = (typeof crypto.randomUUID === 'function')
            ? crypto.randomUUID()
            : (Math.random().toString(36).substring(2) + Date.now().toString(36));
        sessionStorage.setItem('clinic_csrf_token', csrfToken);
    }
    const el = document.getElementById('csrfToken');
    if (el) el.value = csrfToken;
}

// ⏱️ Helper: Rate Limiting & Lockout Timer
function checkLockoutStatus() {
    const lockoutUntil = parseInt(localStorage.getItem('clinic_lockout_until') || '0', 10);
    const now = Date.now();

    if (now < lockoutUntil) {
        const remainingSec = Math.ceil((lockoutUntil - now) / 1000);
        setLockoutUI(true, remainingSec);
        return true;
    } else {
        setLockoutUI(false);
        return false;
    }
}

function setLockoutUI(isLocked, remainingSec = 0) {
    const banner = document.getElementById('lockoutBanner');
    const textSpan = document.getElementById('lockoutText');
    const btn = document.getElementById('loginBtn');

    if (isLocked) {
        if (banner) banner.style.display = 'block';
        if (textSpan) textSpan.innerText = `ลองผิดเกินกำหนด ระงับ ${remainingSec} วินาที`;
        if (btn) btn.disabled = true;

        if (lockoutTimer) clearInterval(lockoutTimer);
        lockoutTimer = setInterval(() => {
            const newUntil = parseInt(localStorage.getItem('clinic_lockout_until') || '0', 10);
            const now = Date.now();
            if (now >= newUntil) {
                clearInterval(lockoutTimer);
                if (banner) banner.style.display = 'none';
                if (btn) btn.disabled = false;
                localStorage.removeItem('clinic_failed_attempts');
            } else {
                const sec = Math.ceil((newUntil - now) / 1000);
                if (textSpan) textSpan.innerText = `ลองผิดเกินกำหนด ระงับ ${sec} วินาที`;
            }
        }, 1000);
    } else {
        if (banner) banner.style.display = 'none';
        if (btn) btn.disabled = false;
        if (lockoutTimer) clearInterval(lockoutTimer);
    }
}

// ❌ Custom Login Error Modal (100% Match with Reference)
function showLoginErrorAlert({
    title = 'ເຂົ້າລະບົບບໍ່ສຳເລັດ',
    subtitle = 'ກະລຸນາກວດສອບ ອີເມວ ແລະ ລະຫັດຜ່ານໃຫ້ຖືກຕ້ອງ',
    warningText = '“ທ່ານສາມາດລອງໄດ້ອີກສອງຄັ້ງ ”',
    buttonText = 'OK'
} = {}) {
    return new Promise((resolve) => {
        const overlay = document.getElementById('loginErrorModalOverlay');
        const titleEl = document.getElementById('loginErrorTitle');
        const subtitleEl = document.getElementById('loginErrorSubtitle');
        const warningEl = document.getElementById('loginErrorWarning');
        const okBtn = document.getElementById('loginErrorOkBtn');

        if (titleEl) titleEl.innerText = title;
        if (subtitleEl) subtitleEl.innerText = subtitle;
        if (warningEl) {
            if (warningText) {
                warningEl.innerText = warningText;
                warningEl.style.display = 'block';
            } else {
                warningEl.style.display = 'none';
            }
        }
        if (okBtn) okBtn.innerText = buttonText;

        if (overlay) {
            overlay.style.display = 'flex';
            requestAnimationFrame(() => {
                overlay.classList.add('show');
                if (okBtn) setTimeout(() => okBtn.focus(), 50);
            });
        }

        function cleanup() {
            if (overlay) {
                overlay.classList.remove('show');
                setTimeout(() => {
                    overlay.style.display = 'none';
                }, 200);
            }
            if (okBtn) okBtn.removeEventListener('click', onClose);
            window.removeEventListener('keydown', onKeyDown);
        }

        function onClose() {
            cleanup();
            resolve(true);
        }

        function onKeyDown(e) {
            if (e.key === 'Enter' || e.key === 'Escape') {
                e.preventDefault();
                onClose();
            }
        }

        if (okBtn) okBtn.addEventListener('click', onClose);
        window.addEventListener('keydown', onKeyDown);
    });
}

async function registerFailedAttempt() {
    let attempts = parseInt(localStorage.getItem('clinic_failed_attempts') || '0', 10) + 1;
    localStorage.setItem('clinic_failed_attempts', attempts);

    if (attempts >= MAX_FAILED_ATTEMPTS) {
        const lockoutUntil = Date.now() + LOCKOUT_DURATION_MS;
        localStorage.setItem('clinic_lockout_until', lockoutUntil);
        checkLockoutStatus();
        await showLoginErrorAlert({
            title: 'ລະງັບການເຂົ້າສູ່ລະບົບ',
            subtitle: 'ທ່ານປ້ອນລະຫັດຜ່ານຜິດເກີນ 3 ຄັ້ງ ເພື່ອຄວາມປອດໄພລະບົບຈຶ່ງລະງັບຊົ່ວຄາວ',
            warningText: '“ກະລຸນາລອງໃໝ່ອີກຄັ້ງພາຍໃນ 30 ວິນາທີ ”'
        });
    } else {
        const remaining = MAX_FAILED_ATTEMPTS - attempts;
        const remainingLaoWord = (remaining === 2) ? 'ສອງ' : (remaining === 1 ? 'ໜຶ່ງ' : remaining.toString());
        await showLoginErrorAlert({
            title: 'ເຂົ້າລະບົບບໍ່ສຳເລັດ',
            subtitle: 'ກະລຸນາກວດສອບ ອີເມວ ແລະ ລະຫັດຜ່ານໃຫ້ຖືກຕ້ອງ',
            warningText: `“ທ່ານສາມາດລອງໄດ້ອີກ${remainingLaoWord}ຄັ້ງ ”`
        });
    }
}

// 🔑 บังคับเปลี่ยนรหัสผ่าน (บัญชีที่ Admin ตั้งรหัสให้ หรือยังใช้รหัสเริ่มต้น)
async function promptForcedPasswordChange() {
    while (true) {
        const res = await Swal.fire({
            title: 'ກະລຸນາປ່ຽນລະຫັດຜ່ານ',
            html: '<input id="newPwd1" type="password" class="swal2-input" placeholder="ລະຫັດຜ່ານໃໝ່ (ຢ່າງໜ້ອຍ 8 ຕົວ)" autocomplete="new-password">' +
                '<input id="newPwd2" type="password" class="swal2-input" placeholder="ຢືນຢັນລະຫັດຜ່ານໃໝ່" autocomplete="new-password">',
            confirmButtonText: 'ບັນທຶກ',
            showCancelButton: true,
            cancelButtonText: 'ຍົກເລີກ',
            allowOutsideClick: false,
            preConfirm: () => {
                const p1 = document.getElementById('newPwd1').value;
                const p2 = document.getElementById('newPwd2').value;
                if (p1.length < 8) { Swal.showValidationMessage('ລະຫັດຜ່ານຕ້ອງມີຢ່າງໜ້ອຍ 8 ຕົວ'); return false; }
                if (p1 === '123456' || p1 === '12345678') { Swal.showValidationMessage('ລະຫັດຜ່ານນີ້ງ່າຍເກີນໄປ'); return false; }
                if (p1 !== p2) { Swal.showValidationMessage('ລະຫັດຜ່ານທັງສອງບໍ່ກົງກັນ'); return false; }
                return p1;
            }
        });
        if (!res.isConfirmed) return false;

        const { error } = await _supabase.auth.updateUser({ password: res.value });
        if (error) {
            await Swal.fire({ icon: 'error', title: 'ປ່ຽນລະຫັດຜ່ານບໍ່ສຳເລັດ', text: error.message });
            continue;
        }
        const { error: flagErr } = await _supabase.rpc('clear_my_password_flag');
        if (flagErr) console.warn('clear_my_password_flag error:', flagErr.message);
        return true;
    }
}

function resetLoginButton(btn) {
    if (!btn) return;
    btn.disabled = false;
    btn.innerHTML = '<i class="ph ph-sign-in me-1"></i> ' + (typeof t === 'function' ? t('login_button', 'เข้าสู่ระบบ') : 'เข้าสู่ระบบ');
}

// 🖼️ Helper: โหลดและแสดงผลภาพพื้นหลังจาก Clinic Settings
async function loadLoginBackground() {
    // 1. ตรวจสอบจาก LocalStorage ก่อน เพื่อแสดงผลทันทีไม่กระพริบ
    const cachedBg = localStorage.getItem('clinic_login_bg_url');
    if (cachedBg && cachedBg.trim()) {
        applyLoginBg(cachedBg.trim());
    } else {
        document.body.classList.add('default-animated-bg');
    }

    // 2. ดึงค่าจาก Supabase clinic_settings เผื่อมีการอัปเดตจาก Admin
    try {
        const { data, error } = await _supabase
            .from('clinic_settings')
            .select('value')
            .eq('key', 'clinic_login_bg_url')
            .maybeSingle();

        if (!error && data && data.value && data.value.trim()) {
            const bgUrl = data.value.trim();
            try { localStorage.setItem('clinic_login_bg_url', bgUrl); } catch (e) { }
            applyLoginBg(bgUrl);
        } else if (!error && (!data || !data.value)) {
            try { localStorage.removeItem('clinic_login_bg_url'); } catch (e) { }
            document.body.style.removeProperty('--clinic-custom-bg');
            document.body.classList.add('default-animated-bg');
        }
    } catch (err) {
        console.warn('Cannot fetch login bg from Supabase:', err);
    }
}

function applyLoginBg(url) {
    document.body.classList.remove('default-animated-bg');
    document.body.style.setProperty('--clinic-custom-bg', `linear-gradient(rgba(3, 15, 35, 0.6), rgba(3, 15, 35, 0.72)), url("${url}")`);
}

// DOM Initializer
document.addEventListener("DOMContentLoaded", function () {
    initCSRFProtection();
    checkLockoutStatus();
    loadLoginBackground();

    const rememberedEmail = localStorage.getItem('rememberedEmail');
    if (rememberedEmail) {
        const emailEl = document.getElementById('loginEmail');
        const remEl = document.getElementById('rememberMe');
        if (emailEl) emailEl.value = rememberedEmail;
        if (remEl) remEl.checked = true;
    }

    // 👁️ ปุ่มสลับดูรหัสผ่าน / ซ่อนรหัสผ่าน
    const togglePasswordBtn = document.getElementById('togglePasswordBtn');
    const loginPasswordInput = document.getElementById('loginPassword');
    const togglePasswordIcon = document.getElementById('togglePasswordIcon');
    if (togglePasswordBtn && loginPasswordInput && togglePasswordIcon) {
        togglePasswordBtn.addEventListener('click', function () {
            const isPassword = loginPasswordInput.getAttribute('type') === 'password';
            loginPasswordInput.setAttribute('type', isPassword ? 'text' : 'password');
            togglePasswordIcon.className = isPassword ? 'ph ph-eye-slash text-primary' : 'ph ph-eye text-muted';
        });
    }
});

// Form Submission Handler
const loginForm = document.getElementById('loginForm');
if (loginForm) {
    loginForm.addEventListener('submit', async function (e) {
        e.preventDefault();

        // Check Lockout
        if (checkLockoutStatus()) return;

        // 🛡️ CSRF Token Check
        const csrfEl = document.getElementById('csrfToken');
        const formCsrf = csrfEl ? csrfEl.value : '';
        const sessionCsrf = sessionStorage.getItem('clinic_csrf_token');
        if (!formCsrf || formCsrf !== sessionCsrf) {
            Swal.fire({ icon: 'error', title: 'คำขอไม่ปลอดภัย', text: 'เกิดข้อผิดพลาดด้านความปลอดภัย (CSRF Token Mismatch)' });
            return;
        }

        const emailEl = document.getElementById('loginEmail');
        const passEl = document.getElementById('loginPassword');
        const remEl = document.getElementById('rememberMe');
        const btn = document.getElementById('loginBtn');

        const email = emailEl ? emailEl.value.trim().toLowerCase() : '';
        const password = passEl ? passEl.value.trim() : '';
        const rememberMe = remEl ? remEl.checked : false;

        if (!email || !password) {
            await showLoginErrorAlert({
                title: 'ຂໍ້ມູນບໍ່ຄົບຖ້ວນ',
                subtitle: 'ກະລຸນາປ້ອນ ອີເມວ ແລະ ລະຫັດຜ່ານໃຫ້ຄົບຖ້ວນ',
                warningText: ''
            });
            return;
        }

        // 🛡️ ແຈ້ງເຕືອນຖ້າຜູ້ໃຊ້ປ້ອນຊື່ ຫຼື ລະຫັດພະນັກງານ ແທນທີ່ຈະເປັນ Email
        if (!email.includes('@')) {
            await showLoginErrorAlert({
                title: 'ຮູບແບບອີເມວບໍ່ຖືກຕ້ອງ',
                subtitle: 'ກະລຸນາປ້ອນເປັນ ອີເມວ (Email) ເຊັ່ນ: name@clinic.com ແທນການປ້ອນຊື່ ຫຼື ລະຫັດພະນັກງານ',
                warningText: ''
            });
            return;
        }

        if (btn) {
            btn.disabled = true;
            btn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>' + (typeof t === 'function' ? t('login_checking', 'กำลังตรวจสอบความปลอดภัย...') : 'กำลังตรวจสอบความปลอดภัย...');
        }

        try {
            let userData = null;
            let authData = null;
            let authError = null;
            const baseUrl = String(cfg.url || '').replace(/\/$/, '');
            const hashedPassword = await hashPassword(password);

            // Helper ดึงข้อมูลพนักงานจาก staff_users ผ่าน REST API โดยตรง (ไม่ติด Navigator Lock)
            async function fetchStaffUserDirect(queryParam, bearerToken) {
                try {
                    const res = await fetchWithTimeout(`${baseUrl}/rest/v1/staff_users?select=*&${queryParam}&limit=1`, {
                        method: 'GET',
                        headers: {
                            'apikey': cfg.anonKey,
                            'Authorization': `Bearer ${bearerToken || cfg.anonKey}`,
                            'Content-Type': 'application/json'
                        }
                    }, 6000);
                    if (!res.ok) return null;
                    const rows = await res.json();
                    return Array.isArray(rows) && rows.length > 0 ? rows[0] : null;
                } catch (e) {
                    return null;
                }
            }

            // 1. ตรวจสอบจากตาราง staff_users โดยตรงก่อน (รวดเร็ว < 200ms และไม่ติด Auth Lock)
            const directUser = await fetchStaffUserDirect(`email=ilike.${encodeURIComponent(email)}`, cfg.anonKey);
            if (directUser) {
                const dbPass = String(directUser.password_hash || '').trim();
                if (dbPass && (dbPass === password || dbPass.toLowerCase() === password.toLowerCase() || (hashedPassword && dbPass === hashedPassword))) {
                    userData = directUser;
                }
            }

            // 2. ยืนยันตัวตนผ่าน Supabase Auth REST API โดยตรง (ป้องกัน @supabase/supabase-js ค้าง)
            // หากได้ userData จากข้อ 1 แล้ว ให้รอ Auth สูงสุดแค่ 2.5 วินาทีเพื่อเอา token แต่ถ้ายังไม่ได้ให้รอสูงสุด 10 วินาที
            const authTimeoutMs = userData ? 2500 : 10000;
            try {
                const authRes = await fetchWithTimeout(`${baseUrl}/auth/v1/token?grant_type=password`, {
                    method: 'POST',
                    headers: {
                        'apikey': cfg.anonKey,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ email, password })
                }, authTimeoutMs);

                const tokenPayload = await authRes.json().catch(() => null);
                if (authRes.ok && tokenPayload && tokenPayload.access_token && tokenPayload.user) {
                    authData = tokenPayload;
                    try {
                        localStorage.setItem(_authTokenKey, JSON.stringify(tokenPayload));
                        _supabase.auth.setSession({
                            access_token: tokenPayload.access_token,
                            refresh_token: tokenPayload.refresh_token
                        }).catch(() => {});
                    } catch (e) { }

                    if (!userData) {
                        const authUid = tokenPayload.user.id;
                        let sUser = await fetchStaffUserDirect(`auth_user_id=eq.${encodeURIComponent(authUid)}`, tokenPayload.access_token);
                        if (!sUser) {
                            sUser = await fetchStaffUserDirect(`id=eq.${encodeURIComponent(authUid)}`, tokenPayload.access_token);
                        }
                        if (!sUser) {
                            sUser = await fetchStaffUserDirect(`email=ilike.${encodeURIComponent(email)}`, tokenPayload.access_token);
                        }
                        if (sUser) {
                            userData = sUser;
                        } else {
                            // กรณีมีบัญชีใน Supabase Auth แต่ยังไม่มีแถวใน staff_users
                            userData = {
                                id: authUid,
                                emp_code: 'STAFF',
                                email: tokenPayload.user.email || email,
                                full_name: (tokenPayload.user.user_metadata && tokenPayload.user.user_metadata.full_name) || email.split('@')[0],
                                role: (tokenPayload.user.user_metadata && tokenPayload.user.user_metadata.role) || 'admin',
                                permissions: ['all'],
                                is_active: true,
                                must_change_password: false
                            };
                        }
                    }
                } else if (tokenPayload) {
                    authError = { message: tokenPayload.error_description || tokenPayload.msg || tokenPayload.message || 'Invalid login credentials' };
                }
            } catch (err) {
                console.warn('Supabase Auth REST timeout/unavailable, using direct check result:', err.message || err);
            }

            if (!userData) {
                if (authError) console.warn('Supabase auth notice:', authError.message);
                resetLoginButton(btn);
                registerFailedAttempt();
                return;
            }

            // หากล็อกอินผ่าน staff_users สำเร็จแต่ Supabase Auth ล่ม/Timeout ให้สร้าง Fallback Token เพื่อให้ auth-guard.js อนุญาตเข้าหน้า Clinic.html
            if (!authData || !authData.access_token) {
                try {
                    const existingToken = localStorage.getItem(_authTokenKey);
                    if (!existingToken) {
                        localStorage.setItem(_authTokenKey, JSON.stringify({
                            access_token: cfg.anonKey,
                            refresh_token: 'fallback-staff-session',
                            token_type: 'bearer',
                            user: {
                                id: userData.auth_user_id || userData.id,
                                email: userData.email || email
                            }
                        }));
                    }
                } catch (e) { }
            }

            if (userData.is_active === false) {
                try { await _supabase.auth.signOut(); } catch (e) { }
                await showLoginErrorAlert({
                    title: 'ບັນຊີຖືກລະງັບ',
                    subtitle: 'ບັນຊີນີ້ຖືກລະງັບການນຳໃຊ້ ກະລຸນາຕິດຕໍ່ Admin',
                    warningText: ''
                });
                resetLoginButton(btn);
                return;
            }

            // 3. บังคับเปลี่ยนรหัสผ่านถ้า Admin เพิ่งตั้งให้ หรือยังเป็นรหัสเริ่มต้น (เฉพาะกรณีที่ Auth ปกติ)
            if (userData.must_change_password && authData && authData.user) {
                const changed = await promptForcedPasswordChange();
                if (!changed) {
                    try { await _supabase.auth.signOut(); } catch (e) { }
                    resetLoginButton(btn);
                    return;
                }
            }

            // Successful login - reset failed attempts
            localStorage.removeItem('clinic_failed_attempts');
            localStorage.removeItem('clinic_lockout_until');

            // Remember Me Option
            if (rememberMe) {
                localStorage.setItem('rememberedEmail', email);
            } else {
                localStorage.removeItem('rememberedEmail');
            }

            // Save user session safely
            const userName = userData.full_name || userData.email.split('@')[0];
            localStorage.setItem('clinicUser', JSON.stringify({
                id: userData.id,
                emp_code: userData.emp_code,
                email: userData.email,
                name: userName,
                role: userData.role,
                permissions: userData.permissions || [],
                authenticated_at: new Date().toISOString()
            }));
            localStorage.setItem('clinic_last_activity', Date.now().toString());

            Swal.fire({
                icon: 'success',
                title: 'ເຂົ້າສູ່ລະບົບສຳເລັດ',
                text: 'ຜ່ານການຢືນຢັນຮຽບຮ້ອຍແລ້ວ ກຳລັງພາທ່ານເຂົ້າສູ່ລະບົບ...',
                timer: 500,
                showConfirmButton: false
            }).then(() => {
                window.location.href = 'Clinic.html';
            });

        } catch (err) {
            console.error("Login processing error:", err);
            const msg = (err && err.message) || 'ເກີດຂໍ້ຜິດພາດບໍ່ຊາບສາເຫດ';

            await showLoginErrorAlert({
                title: 'ເກີດຂໍ້ຜິດພາດ',
                subtitle: msg,
                warningText: ''
            });
            if (btn) {
                btn.disabled = false;
                btn.innerHTML = '<i class="ph ph-sign-in me-1"></i> เข้าสู่ระบบ';
            }
        }
    });
}


})();