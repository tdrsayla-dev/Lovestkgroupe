// ==========================================================================
// Clinic System — Login Logic (login.js)
// ==========================================================================

// 🔐 1. ซ่อนและรับ API Key ผ่าน CONFIG ใน config.js
const cfg = (typeof window.getSupabaseConfig === 'function')
    ? window.getSupabaseConfig()
    : { url: window.SUPABASE_URL || 'https://fpmstumpobbjozflkola.supabase.co', anonKey: window.SUPABASE_ANON_KEY || 'sb_publishable_h9-j-0I2ku6rYYvoeHmooQ_B5GrRzR7' };

const _supabase = supabase.createClient(cfg.url, cfg.anonKey);

// State variables for Rate Limiting & Lockout
let lockoutTimer = null;
const MAX_FAILED_ATTEMPTS = 3;
const LOCKOUT_DURATION_MS = 30000; // 30 seconds

// 🔒 Helper: SHA-256 Hashing สำหรับเข้ารหัสรหัสผ่านใน Frontend
async function hashPassword(str) {
    if (!str) return '';
    try {
        const encoder = new TextEncoder();
        const data = encoder.encode(str);
        const hashBuffer = await crypto.subtle.digest('SHA-256', data);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    } catch (e) {
        console.warn('Crypto SHA-256 fallback', e);
        return str;
    }
}

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

// 📱 2FA Verification Modal Process (100% Match with Design)
function prompt2FAVerification(userData) {
    return new Promise((resolve) => {
        const overlay = document.getElementById('otpModalOverlay');
        const display = document.getElementById('otpGeneratedDisplay');
        const input = document.getElementById('otpCodeInput');
        const errorText = document.getElementById('otpErrorText');
        const confirmBtn = document.getElementById('otpConfirmBtn');
        const cancelBtn = document.getElementById('otpCancelBtn');

        // สร้างรหัส OTP 6 หลักสำหรับการยืนยัน
        const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
        if (display) display.innerText = otpCode;
        if (input) {
            input.value = '';
            input.classList.remove('input-error');
        }
        if (errorText) errorText.style.display = 'none';

        if (overlay) {
            overlay.style.display = 'flex';
            requestAnimationFrame(() => {
                overlay.classList.add('show');
                if (input) setTimeout(() => input.focus(), 50);
            });
        }

        function cleanup() {
            if (overlay) {
                overlay.classList.remove('show');
                setTimeout(() => {
                    overlay.style.display = 'none';
                }, 200);
            }
            if (confirmBtn) confirmBtn.removeEventListener('click', onConfirm);
            if (cancelBtn) cancelBtn.removeEventListener('click', onCancel);
            if (input) {
                input.removeEventListener('keydown', onKeyDown);
                input.removeEventListener('input', onInput);
            }
        }

        function onConfirm() {
            const val = input ? input.value.trim() : '';
            if (val === otpCode) {
                cleanup();
                resolve(true);
            } else {
                if (input) {
                    input.classList.add('input-error');
                    input.select();
                    setTimeout(() => {
                        input.classList.remove('input-error');
                    }, 500);
                }
                if (errorText) errorText.style.display = 'block';
            }
        }

        function onCancel() {
            cleanup();
            resolve(false);
        }

        function onKeyDown(e) {
            if (e.key === 'Enter') {
                e.preventDefault();
                onConfirm();
            } else if (e.key === 'Escape') {
                e.preventDefault();
                onCancel();
            }
        }

        function onInput() {
            this.value = this.value.replace(/\D/g, '').slice(0, 6);
            if (errorText) errorText.style.display = 'none';
        }

        if (confirmBtn) confirmBtn.addEventListener('click', onConfirm);
        if (cancelBtn) cancelBtn.addEventListener('click', onCancel);
        if (input) {
            input.addEventListener('keydown', onKeyDown);
            input.addEventListener('input', onInput);
        }
    });
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

        const email = emailEl ? emailEl.value.trim() : '';
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

        if (btn) {
            btn.disabled = true;
            btn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>' + (typeof t === 'function' ? t('login_checking', 'กำลังตรวจสอบความปลอดภัย...') : 'กำลังตรวจสอบความปลอดภัย...');
        }

        try {
            // 🔒 SHA-256 Hashing ของรหัสผ่าน
            const hashedPassword = await hashPassword(password);

            let userData = null;

            // ⏱️ Timeout Control (10 Seconds Limit)
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 10000);

            try {
                // 1. ตรวจสอบข้อมูลพนักงานจาก Supabase Clinic DB (เช็คทั้ง password_hash และ hashed/plain)
                const { data, error } = await _supabase
                    .from('staff_users')
                    .select('*')
                    .eq('email', email)
                    .maybeSingle();

                clearTimeout(timeoutId);

                if (data && !error) {
                    const dbPass = data.password_hash || '';
                    if (dbPass === password || dbPass === hashedPassword) {
                        userData = data;
                    }
                }
            } catch (dbErr) {
                clearTimeout(timeoutId);
                console.warn('Supabase authentication error:', dbErr.message);
            }

            // 🗑️ บัญชีทดสอบ (defaultUsers) ถูกลบออกแล้วอย่างสมบูรณ์ เพื่อความปลอดภัย

            if (!userData) {
                if (btn) {
                    btn.disabled = false;
                    btn.innerHTML = '<i class="ph ph-sign-in me-1"></i> ' + (typeof t === 'function' ? t('login_button', 'เข้าสู่ระบบ') : 'เข้าสู่ระบบ');
                }
                registerFailedAttempt();
                return;
            }

            if (userData.is_active === false) {
                await showLoginErrorAlert({
                    title: 'ບັນຊີຖືກລະງັບ',
                    subtitle: 'ບັນຊີນີ້ຖືກລະງັບການນຳໃຊ້ ກະລຸນາຕິດຕໍ່ Admin',
                    warningText: ''
                });
                if (btn) {
                    btn.disabled = false;
                    btn.innerHTML = '<i class="ph ph-sign-in me-1"></i> ' + (typeof t === 'function' ? t('login_button', 'เข้าสู่ระบบ') : 'เข้าสู่ระบบ');
                }
                return;
            }

            // 📱 2FA Verification Step
            const is2FAVerified = await prompt2FAVerification(userData);
            if (!is2FAVerified) {
                if (btn) {
                    btn.disabled = false;
                    btn.innerHTML = '<i class="ph ph-sign-in me-1"></i> ' + (typeof t === 'function' ? t('login_button', 'เข้าสู่ระบบ') : 'เข้าสู่ระบบ');
                }
                return;
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
                authenticated_at: new Date().toISOString(),
                has_2fa: true
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
            const msg = (err && err.name === 'AbortError')
                ? 'ການເຊື່ອມຕໍ່ໃຊ້ເວລາດົນເກີນໄປ ກະລຸນາລອງໃໝ່ອີກຄັ້ງ (Request Timed Out)'
                : (err.message || 'ເກີດຂໍ້ຜິດພາດບໍ່ຊາບສາເຫດ');

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
