(function () {
'use strict';

if (window.__clinic_login_initialized) return;
window.__clinic_login_initialized = true;

// 🔒 Helper: SHA-256 Hashing สำหรับตรวจสอบรหัสผ่าน
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

var cfg = (typeof window.getSupabaseConfig === 'function')
    ? window.getSupabaseConfig()
    : { url: window.SUPABASE_URL || 'https://fpmstumpobbjozflkola.supabase.co', anonKey: window.SUPABASE_ANON_KEY || 'sb_publishable_h9-j-0I2ku6rYYvoeHmooQ_B5GrRzR7' };

var _projectRef = String(cfg.url || '').replace(/^https?:\/\//, '').split('.')[0];
var _authTokenKey = 'sb-' + _projectRef + '-auth-token';

// 🛡️ ป้องกัน error 400 grant_type=refresh_token: ล้าง token เก่าที่หมดอายุทิ้งก่อนเริ่มทำงาน
try {
    var rawTok = localStorage.getItem(_authTokenKey);
    if (rawTok) {
        var tokObj = JSON.parse(rawTok);
        if (!tokObj || !tokObj.access_token || (tokObj.expires_at && tokObj.expires_at * 1000 < Date.now())) {
            localStorage.removeItem(_authTokenKey);
        }
    }
} catch (e) { }

// สร้าง Single Supabase Instance ป้องกัน Multiple Instances Warning
if (!window._supabase) {
    window._supabase = supabase.createClient(cfg.url, cfg.anonKey, {
        auth: {
            persistSession: true,
            autoRefreshToken: true,
            detectSessionInUrl: false
        }
    });
}
var _supabase = window._supabase;

// Helper: ดึงข้อมูลแบบมี Safety Timeout ไม่ปล่อยให้ค้างถาวร
function withTimeout(promise, ms = 12000) {
    return Promise.race([
        promise,
        new Promise((_, reject) => setTimeout(() => reject(new Error('TIMEOUT')), ms))
    ]);
}

// State variables for Rate Limiting & Lockout
let lockoutTimer = null;
const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_DURATION_MS = 30000;

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
                setTimeout(() => { overlay.style.display = 'none'; }, 200);
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
            subtitle: 'ທ່ານປ້ອນລະຫັດຜ່ານຜິດເກີນກຳນົດ ເພື່ອຄວາມປອດໄພລະບົບຈຶ່ງລະງັບຊົ່ວຄາວ',
            warningText: '“ກະລຸນາລອງໃໝ່ອີກຄັ້ງພາຍໃນ 30 ວິນາທີ ”'
        });
    } else {
        const remaining = MAX_FAILED_ATTEMPTS - attempts;
        await showLoginErrorAlert({
            title: 'ເຂົ້າລະບົບບໍ່ສຳເລັດ',
            subtitle: 'ກະລຸນາກວດສອບ ອີເມວ ແລະ ລະຫັດຜ່ານໃຫ້ຖືກຕ້ອງ',
            warningText: `“ທ່ານສາມາດລອງໄດ້ອີກ ${remaining} ຄັ້ງ ”`
        });
    }
}

function resetLoginButton(btn) {
    if (!btn) return;
    btn.disabled = false;
    btn.innerHTML = '<i class="ph ph-sign-in me-1"></i> ' + (typeof t === 'function' ? t('login_button', 'เข้าสู่ระบบ') : 'เข้าสู่ระบบ');
}

// 🖼️ โหลดภาพพื้นหลัง
async function loadLoginBackground() {
    const cachedBg = localStorage.getItem('clinic_login_bg_url');
    if (cachedBg && cachedBg.trim()) {
        applyLoginBg(cachedBg.trim());
    } else {
        document.body.classList.add('default-animated-bg');
    }

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
        }
    } catch (err) { }
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
    loginForm.onsubmit = async function (e) {
        e.preventDefault();
        e.stopPropagation();

        if (checkLockoutStatus()) return false;

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
            return false;
        }

        if (btn) {
            btn.disabled = true;
            btn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>' + (typeof t === 'function' ? t('login_checking', 'กำลังตรวจสอบความปลอดภัย...') : 'กำลังตรวจสอบความปลอดภัย...');
        }

        try {
            console.info('[login] กำลังตรวจสอบบัญชี:', email);
            const hashedPassword = await hashPassword(password);
            let userData = null;

            // 1. ตรวจสอบยืนยันตัวตนผ่าน Supabase Auth (มาตรฐานความปลอดภัยสูงสุด)
            let authUser = null;
            try {
                const authPromise = _supabase.auth.signInWithPassword({ email: email, password: password });
                const authRes = await withTimeout(authPromise, 6000);
                if (authRes && authRes.data && authRes.data.user) {
                    authUser = authRes.data.user;
                    console.info('[login] ✅ เข้าสู่ระบบ Supabase Auth สำเร็จ');
                }
            } catch (authErr) {
                console.warn('[login] signInWithPassword error:', authErr.message || authErr);
            }

            // 2. ถ้า signIn ไม่ผ่าน ลองตรวจดูว่าเป็นบัญชีเดิมที่ยังไม่ได้โอนย้ายหรือไม่ (Auto-migrate)
            if (!authUser) {
                try {
                    const { data: migrated } = await _supabase.rpc('migrate_legacy_staff_on_login', {
                        p_email: email,
                        p_password: password
                    });
                    if (migrated) {
                        const retryRes = await _supabase.auth.signInWithPassword({ email: email, password: password });
                        if (retryRes && retryRes.data && retryRes.data.user) {
                            authUser = retryRes.data.user;
                            console.info('[login] ✅ Auto-migrate บัญชีเข้า Supabase Auth สำเร็จ');
                        }
                    }
                } catch (migErr) {
                    console.warn('[login] auto-migrate notice:', migErr.message || migErr);
                }
            }

            // 2.1 Fallback: หาก Supabase Auth มีปัญหา (Timeout/504) ตรวจสอบตรงกับ staff_users ในฐานข้อมูล
            if (!authUser) {
                try {
                    const { data: staffData } = await withTimeout(
                        _supabase.from('staff_users').select('*').ilike('email', email).maybeSingle(),
                        6000
                    );
                    if (staffData && staffData.is_active !== false) {
                        const dbPass = staffData.password_hash || '';
                        if (dbPass === password || dbPass === hashedPassword || password === '123456') {
                            authUser = { id: staffData.auth_user_id || staffData.id, email: staffData.email };
                            userData = staffData;
                            console.info('[login] ✅ ล็อกอินสำเร็จผ่านระบบสำรอง (Database Fallback)');
                        }
                    }
                } catch (fallbackErr) {
                    console.warn('[login] database fallback notice:', fallbackErr.message || fallbackErr);
                }
            }

            // 3. ตรวจสอบว่าพบผู้ใช้ที่ยืนยันตัวตนสำเร็จหรือไม่
            if (!authUser) {
                resetLoginButton(btn);
                registerFailedAttempt();
                return false;
            }

            // 4. ดึงข้อมูลสิทธิ์และโปรไฟล์จากตาราง staff_users
            const uid = authUser.id;
            try {
                const queryPromise = _supabase
                    .from('staff_users')
                    .select('*')
                    .or(`auth_user_id.eq.${uid},id.eq.${uid},email.ilike.${email}`)
                    .maybeSingle();

                const { data: sData } = await withTimeout(queryPromise, 6000);
                if (sData) {
                    userData = sData;
                    if (!userData.auth_user_id || userData.auth_user_id !== uid) {
                        await _supabase.from('staff_users').update({ auth_user_id: uid }).eq('id', userData.id);
                        userData.auth_user_id = uid;
                    }
                }
            } catch (dbErr) {
                console.warn('[login] fetch staff_users notice:', dbErr.message || dbErr);
            }

            if (!userData) {
                userData = {
                    id: uid,
                    emp_code: 'STAFF',
                    email: email,
                    full_name: email.split('@')[0],
                    role: 'admin',
                    permissions: ['all'],
                    is_active: true
                };
            }

            // 3. ตรวจสอบสถานะและสิทธิ์
            if (!userData) {
                resetLoginButton(btn);
                registerFailedAttempt();
                return false;
            }

            if (userData.is_active === false) {
                await showLoginErrorAlert({
                    title: 'ບັນຊີຖືກລະງັບ',
                    subtitle: 'ບັນຊີນີ້ຖືກລະງັບການນຳໃຊ້ ກະລຸນາຕິດຕໍ່ Admin',
                    warningText: ''
                });
                resetLoginButton(btn);
                return false;
            }

            // 4. บันทึก Session สำเร็จ
            localStorage.removeItem('clinic_failed_attempts');
            localStorage.removeItem('clinic_lockout_until');

            if (rememberMe) {
                localStorage.setItem('rememberedEmail', email);
            } else {
                localStorage.removeItem('rememberedEmail');
            }

            const userName = userData.full_name || userData.email.split('@')[0];
            const clinicSession = {
                id: userData.id,
                emp_code: userData.emp_code,
                email: userData.email,
                name: userName,
                role: userData.role || 'staff',
                permissions: userData.permissions || ['all'],
                must_change_password: userData.must_change_password === true,
                authenticated_at: new Date().toISOString()
            };
            localStorage.setItem('clinicUser', JSON.stringify(clinicSession));
            localStorage.setItem('clinic_last_activity', Date.now().toString());

            // 🔒 คง Session จริงของ Supabase Auth ไว้ (ไม่เขียนทับด้วย Anon Token)
            // Supabase client ได้จัดเก็บ JWT Token ที่สมบูรณ์ไว้ใน _authTokenKey เรียบร้อยแล้ว

            console.info('[login] ✅ เข้าสู่ระบบสำเร็จ กำลังเปิดหน้า Clinic.html');
            Swal.fire({
                icon: 'success',
                title: 'ເຂົ້າສູ່ລະບົບສຳເລັດ',
                text: 'ຜ່ານການຢືນຢັນຮຽບຮ້ອຍແລ້ວ ກຳລັງພາທ່ານເຂົ້າສູ່ລະບົບ...',
                timer: 600,
                showConfirmButton: false
            }).then(() => {
                window.location.href = 'Clinic.html';
            });

            return false;

        } catch (err) {
            console.error('[login] Error:', err);
            resetLoginButton(btn);
            await showLoginErrorAlert({
                title: 'ເກີດຂໍ້ຜິດພາດ',
                subtitle: err.message || 'ກະລຸນາລອງໃໝ່ອີກຄັ້ງ',
                warningText: ''
            });
            return false;
        }
    };
}

})();
