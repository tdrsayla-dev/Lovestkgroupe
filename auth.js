// ─────────────────────────────────────────────────────────────────────────────
// js/auth.js - Roles, Permissions, Authentication & Sidebar UI
// ─────────────────────────────────────────────────────────────────────────────

/* =====================================================================
 * 📌 ส่วนที่ 6: ROLES & PERMISSIONS (ฟังก์ชันจัดการสิทธิ์การใช้งาน)
 * - ใช้ตรวจสอบสิทธิ์ Admin / User เพื่อซ่อนหรือแสดงเมนูต่างๆ
 * ===================================================================== */
function applyRolePermissions(role, permissions = '') {
    try {
        const roleStr = String(role).toLowerCase();
        const isAdmin = roleStr.includes('admin') || roleStr.includes('manager');
        const allowedMenus = permissions ? String(permissions).split(',').map(m => m.trim().toLowerCase()) : [];
        const publicMenus = ['scan', 'staff-dashboard'];

        document.querySelectorAll('.nav-btn').forEach(btn => {
            let pageId = String(btn.getAttribute('data-page')).toLowerCase().trim();
            if (isAdmin || allowedMenus.includes(pageId) || publicMenus.includes(pageId) || (pageId === 'dashboard' && roleStr !== 'staff')) {
                btn.classList.remove('hidden'); btn.classList.add('flex');
            } else {
                btn.classList.add('hidden'); btn.classList.remove('flex');
            }
        });

        document.querySelectorAll('.group-wrapper').forEach(wrapper => {
            let visibleBtns = wrapper.querySelectorAll('.nav-btn.flex');
            if (visibleBtns.length > 0 || isAdmin) wrapper.classList.remove('hidden'); else wrapper.classList.add('hidden');
        });

        document.querySelectorAll('p.admin-only').forEach(el => {
            if (isAdmin) { el.classList.remove('hidden'); } else {
                let nextSibling = el.nextElementSibling; let hasVisibleMenu = false;
                while (nextSibling && !nextSibling.matches('p.admin-only')) {
                    if (nextSibling.classList.contains('flex') || (nextSibling.classList.contains('group-wrapper') && !nextSibling.classList.contains('hidden'))) { hasVisibleMenu = true; break; }
                    nextSibling = nextSibling.nextElementSibling;
                }
                if (hasVisibleMenu) el.classList.remove('hidden'); else el.classList.add('hidden');
            }
        });

        const empInput = document.getElementById('manualEmpId');
        if (empInput) {
            if (roleStr === 'staff') {
                empInput.readOnly = true; empInput.classList.add('bg-gray-100', 'cursor-not-allowed', 'text-gray-500'); empInput.classList.remove('bg-white', 'text-gray-900', 'focus:ring-brandindigo');
            } else {
                empInput.readOnly = false; empInput.classList.remove('bg-gray-100', 'cursor-not-allowed', 'text-gray-500'); empInput.classList.add('bg-white', 'text-gray-900', 'focus:ring-brandindigo');
            }
        }
    } catch (error) {
        console.error("Error in applyRolePermissions:", error);
        window.dispatchEvent(new ErrorEvent('error', { error: error, message: "applyRolePermissions: " + error.message }));
    }
}

/* =====================================================================
 * 📌 ส่วนที่ 7: AUTHENTICATION (ฟังก์ชันเข้าสู่ระบบ/ออกจากระบบ)
 * ===================================================================== */
function showApp() {
    try {
        // 📌 ซ่อน login screen และแสดง app layout ด้วย inline style (ป้องกัน Tailwind class conflict)
        const loginScreen = document.getElementById('login-screen');
        if (loginScreen) loginScreen.style.display = 'none';
        document.getElementById('app-layout').style.display = 'flex';

        const sessionStr = localStorage.getItem('hr_user_session') || sessionStorage.getItem('hr_user_session');
        let role = 'Staff', username = '', empId = '', permissions = '';
        if (sessionStr) {
            try {
                const sessionData = JSON.parse(sessionStr);
                role = sessionData.role || 'Staff';
                username = sessionData.username || '';
                empId = sessionData.empId || '';
                permissions = sessionData.permissions || '';
            } catch (e) { }
        }

        const displayUser = document.getElementById('display-username');
        const displayRole = document.getElementById('display-role');
        if (displayUser) displayUser.innerText = username || 'Unknown';
        if (displayRole) displayRole.innerText = role;

        applyRolePermissions(role, permissions);

        let roleLower = String(role).toLowerCase();
        if (roleLower === 'staff') navigate('staff-dashboard', 'My Dashboard');
        else navigate('dashboard', 'Dashboard');
    } catch (error) {
        console.error("Error in showApp:", error);
        window.dispatchEvent(new ErrorEvent('error', { error: error, message: "showApp: " + error.message }));
    }
}

function handleLogin(e) {
    try {
        e.preventDefault();
        const email = document.getElementById('login-email').value;
        const pass = document.getElementById('login-password').value;
        const remember = document.getElementById('remember-me').checked;

        // ตรวจสอบรูปแบบอีเมล
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            showToast('รูปแบบอีเมลไม่ถูกต้อง', 'error');
            return;
        }

        let deviceId = localStorage.getItem('hr_device_id');
        if (!deviceId) {
            deviceId = 'DEV-' + Math.random().toString(36).substr(2, 9) + '-' + Date.now();
            localStorage.setItem('hr_device_id', deviceId);
        }

        toggleLoading(true, 'AUTHENTICATING...');
        google.script.run
            .withSuccessHandler(res => {
                try {
                    toggleLoading(false);
                    if (res.success) {
                        showToast('Login successful', 'success');
                        if (remember) localStorage.setItem('hr_user_session', JSON.stringify({ username: res.username || email.split('@')[0], email: email, role: res.role, empId: res.empId, permissions: res.permissions }));
                        else sessionStorage.setItem('hr_user_session', JSON.stringify({ username: res.username || email.split('@')[0], email: email, role: res.role, empId: res.empId, permissions: res.permissions }));
                        showApp();
                    } else showToast(res.message, 'error');
                } catch (errInner) {
                    toggleLoading(false);
                    console.error("Error in login success handler:", errInner);
                    window.dispatchEvent(new ErrorEvent('error', { error: errInner, message: "Login Callback: " + errInner.message }));
                }
            })
            .withFailureHandler(err => {
                toggleLoading(false);
                showToast('Connection failed: ' + err.message, 'error');
            })
            .verifyLogin(email, pass, deviceId);
    } catch (error) {
        console.error("Error in handleLogin submit:", error);
        window.dispatchEvent(new ErrorEvent('error', { error: error, message: "handleLogin: " + error.message }));
    }
}

function logout() {
    // ลบข้อมูล Session การล็อกอินเดิมออก
    localStorage.removeItem('hr_user_session');
    sessionStorage.removeItem('hr_user_session');

    // สั่งให้กระโดดกลับไปยังหน้าแรกของเว็บไซต์ทันที
    window.location.href = 'login.html';
}

/* =====================================================================
 * 📌 ส่วนที่ 8: SIDEBAR UI (ฟังก์ชันควบคุมเมนูแถบข้าง)
 * ===================================================================== */
let isDesktopSidebarCollapsed = false;

function toggleSidebar() {
    const sidebar = document.getElementById('sidebar');
    const backdrop = document.getElementById('sidebar-backdrop');
    if (!sidebar) return;

    if (window.innerWidth >= 768) {
        // Desktop Collapse
        isDesktopSidebarCollapsed = !isDesktopSidebarCollapsed;
        const mainContent = document.getElementById('main-content');
        if (isDesktopSidebarCollapsed) {
            sidebar.classList.add('w-20'); sidebar.classList.remove('w-64');
            if (mainContent) { mainContent.classList.add('md:ml-20'); mainContent.classList.remove('md:ml-64'); }
            collapseSidebarText();
        } else {
            sidebar.classList.add('w-64'); sidebar.classList.remove('w-20');
            if (mainContent) { mainContent.classList.add('md:ml-64'); mainContent.classList.remove('md:ml-20'); }
            expandSidebarText();
        }
    } else {
        // Mobile Toggle
        if (sidebar.classList.contains('-translate-x-full')) {
            sidebar.classList.remove('-translate-x-full');
            if (backdrop) backdrop.classList.remove('hidden');
        } else {
            sidebar.classList.add('-translate-x-full');
            if (backdrop) backdrop.classList.add('hidden');
        }
    }
}

function collapseSidebarText() {
    document.querySelectorAll('.sidebar-text').forEach(el => el.classList.add('hidden'));
    document.querySelectorAll('.nav-btn').forEach(btn => {
        btn.classList.add('justify-center', 'px-2');
        btn.classList.remove('px-4');
    });
    const headerDiv = document.getElementById('sidebar-header-content');
    if (headerDiv) {
        headerDiv.classList.remove('justify-between', 'px-6');
        headerDiv.classList.add('justify-center');
        const titleSpan = headerDiv.querySelector('.sidebar-text');
        if (titleSpan) titleSpan.classList.add('hidden');
    }
}

function expandSidebarText() {
    document.querySelectorAll('.sidebar-text').forEach(el => el.classList.remove('hidden'));
    document.querySelectorAll('.nav-btn').forEach(btn => {
        btn.classList.add('px-4');
        btn.classList.remove('justify-center', 'px-2');
    });
    const headerDiv = document.getElementById('sidebar-header-content');
    if (headerDiv) {
        headerDiv.classList.add('justify-between', 'px-6');
        headerDiv.classList.remove('justify-center');
        const titleSpan = headerDiv.querySelector('.sidebar-text');
        if (titleSpan) titleSpan.classList.remove('hidden');
    }
}

function toggleSubMenu(menuId, btnElement) {
    if (isDesktopSidebarCollapsed) toggleSidebar();
    const submenu = document.getElementById(menuId);
    const icon = btnElement.querySelector('.fa-chevron-down');
    if (submenu.classList.contains('hidden')) {
        document.querySelectorAll('.submenu-container').forEach(el => el.classList.add('hidden'));
        document.querySelectorAll('.nav-group-btn .fa-chevron-down').forEach(el => el.classList.remove('rotate-180'));
        document.querySelectorAll('.nav-group-btn').forEach(btn => btn.classList.remove('bg-indigo-50', 'text-brandindigo'));

        btnElement.classList.add('bg-indigo-50', 'text-brandindigo');
        submenu.classList.remove('hidden');
        submenu.classList.add('flex');
        if (icon) icon.classList.add('rotate-180');
    } else {
        submenu.classList.add('hidden');
        submenu.classList.remove('flex');
        if (icon) icon.classList.remove('rotate-180');
        btnElement.classList.remove('bg-indigo-50', 'text-brandindigo');
    }
}
