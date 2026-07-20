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
        const displayProfilePic = document.getElementById('display-profile-pic');
        const displayProfileIcon = document.getElementById('display-profile-icon');
        
        if (displayUser) displayUser.innerText = username || 'Unknown';
        if (displayRole) displayRole.innerText = role;

        // Fetch profile pic from staff or users if empId exists
        if (empId) {
            google.script.run.withSuccessHandler(res => {
                try {
                    let picUrl = null;
                    if (res && Array.isArray(res) && res.length > 0) {
                        const row = res[0];
                        picUrl = row.Photos || row.photos || row.photo || row.profile || row.pic || row.image || null;
                    }
                    if (picUrl && displayProfilePic && String(picUrl).trim() !== '-') {
                        displayProfilePic.src = picUrl;
                        displayProfilePic.classList.remove('hidden');
                        if (displayProfileIcon) displayProfileIcon.classList.add('hidden');
                    } else if (displayProfilePic && username) {
                        displayProfilePic.src = `https://ui-avatars.com/api/?background=e0e7ff&color=4f46e5&name=${encodeURIComponent(username)}`;
                        displayProfilePic.classList.remove('hidden');
                        if (displayProfileIcon) displayProfileIcon.classList.add('hidden');
                    }
                } catch(e) {}
            }).getSheetData('staff', `Employee_ID=eq.${empId}`);
        } else if (displayProfilePic && username) {
            displayProfilePic.src = `https://ui-avatars.com/api/?background=e0e7ff&color=4f46e5&name=${encodeURIComponent(username)}`;
            displayProfilePic.classList.remove('hidden');
            if (displayProfileIcon) displayProfileIcon.classList.add('hidden');
        }

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
        const email = String(document.getElementById('login-email').value || '').toLowerCase().trim();
        const pass = String(document.getElementById('login-password').value || '').trim();
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

function openChangePasswordModal() {
    const modal = document.getElementById('change-password-modal');
    if (modal) {
        modal.classList.remove('hidden');
        modal.classList.add('flex');
        
        // Populate user info
        const sessionStr = localStorage.getItem('hr_user_session') || sessionStorage.getItem('hr_user_session');
        if (sessionStr) {
            try {
                const sessionData = JSON.parse(sessionStr);
                const displayUser = document.getElementById('cp-display-username');
                const displayEmail = document.getElementById('cp-display-email');
                if (displayUser) displayUser.innerText = sessionData.username || 'Unknown';
                if (displayEmail) displayEmail.innerText = sessionData.email || '';
            } catch(e) {}
        }
    }
}

function closeChangePasswordModal() {
    const modal = document.getElementById('change-password-modal');
    if (modal) {
        modal.classList.add('hidden');
        modal.classList.remove('flex');
    }
}

function submitChangePassword(e) {
    e.preventDefault();
    const oldPass = document.getElementById('old-password').value;
    const newPass = document.getElementById('new-password').value;
    const confirmPass = document.getElementById('confirm-new-password').value;
    
    if (newPass !== confirmPass) {
        showToast(t('password_mismatch') || 'Passwords do not match', 'error');
        return;
    }
    
    const sessionStr = localStorage.getItem('hr_user_session') || sessionStorage.getItem('hr_user_session');
    if (!sessionStr) return;
    const sessionData = JSON.parse(sessionStr);
    const email = sessionData.username || sessionData.email;
    
    toggleLoading(true, 'Updating Password...');
    google.script.run
        .withSuccessHandler(res => {
            toggleLoading(false);
            if (res && res.success) {
                showToast(t('password_updated') || 'Password updated successfully', 'success');
                closeChangePasswordModal();
                document.getElementById('form-change-password').reset();
            } else {
                showToast(res ? res.message : 'Error updating password', 'error');
            }
        })
        .withFailureHandler(err => {
            toggleLoading(false);
            showToast('Connection failed: ' + err.message, 'error');
        })
        .changeUserPassword(email, oldPass, newPass);
}

function openMyProfileModal() {
    const modal = document.getElementById('my-profile-modal');
    if (!modal) return;
    
    modal.classList.remove('hidden');
    modal.classList.add('flex');
    
    // Fetch user data
    const sessionStr = localStorage.getItem('hr_user_session') || sessionStorage.getItem('hr_user_session');
    if (!sessionStr) return;
    const sessionData = JSON.parse(sessionStr);
    const empId = sessionData.empId;
    
    if (!empId) return;
    
    toggleLoading(true, 'Loading Profile...');
    google.script.run
        .withSuccessHandler(res => {
            toggleLoading(false);
            if (res && res.success && res.data && res.data.length > 0) {
                const profile = res.data.find(r => String(r.Employee_ID || r.employee_id || '').trim().toUpperCase() === String(empId).trim().toUpperCase());
                if (profile) {
                    document.getElementById('my-profile-firstname').value = profile.First_Name || '';
                    document.getElementById('my-profile-lastname').value = profile.Last_Name || '';
                document.getElementById('my-profile-birthday').value = profile.Birthday || profile.Birthday_ || profile['Birthday '] || '';
                document.getElementById('my-profile-tel').value = profile.Tel || '';
                document.getElementById('my-profile-email').value = profile.Email || '';
                document.getElementById('my-profile-line').value = profile.Line || '';
                document.getElementById('my-profile-bankname').value = profile.Bank_Name || '';
                document.getElementById('my-profile-bankaccountname').value = profile.Bank_Account_Name || '';
                document.getElementById('my-profile-bankaccountno').value = profile.Bank_Account_No || '';
                document.getElementById('my-profile-photo-url').value = profile.Photos || '';
                if(profile.Photos && profile.Photos !== '-') {
                    document.getElementById('my-profile-photo-preview').src = profile.Photos;
                }
                } // End if (profile)
            }
        })
        .withFailureHandler(err => {
            toggleLoading(false);
            showToast('Failed to load profile', 'error');
        })
        .getSheetData('staff', { select: 'First_Name,Last_Name,Birthday,Tel,Email,Line,Bank_Name,Bank_Account_Name,Bank_Account_No,Photos', filter: `Employee_ID=eq.${empId}` });
}

function closeMyProfileModal() {
    const modal = document.getElementById('my-profile-modal');
    if (modal) {
        modal.classList.add('hidden');
        modal.classList.remove('flex');
    }
}

function submitMyProfile(e) {
    e.preventDefault();
    
    const sessionStr = localStorage.getItem('hr_user_session') || sessionStorage.getItem('hr_user_session');
    if (!sessionStr) return;
    const sessionData = JSON.parse(sessionStr);
    const empId = sessionData.empId;
    
    if (!empId) return;
    
    const payload = {
        'First_Name': document.getElementById('my-profile-firstname').value,
        'Last_Name': document.getElementById('my-profile-lastname').value,
        'Birthday ': document.getElementById('my-profile-birthday').value,
        'Tel': document.getElementById('my-profile-tel').value,
        'Email': document.getElementById('my-profile-email').value,
        'Line': document.getElementById('my-profile-line').value,
        'Bank_Name': document.getElementById('my-profile-bankname').value,
        'Bank_Account_Name': document.getElementById('my-profile-bankaccountname').value,
        'Bank_Account_No': document.getElementById('my-profile-bankaccountno').value,
        'Photos': document.getElementById('my-profile-photo-url').value
    };
    
    toggleLoading(true, 'Updating Profile...');
    
    // Handle photo upload if a new file is selected
    const fileInput = document.getElementById('my-profile-photo-file');
    if (fileInput && fileInput.files.length > 0) {
        let file = fileInput.files[0];
        if (typeof compressImageFile === 'function') {
            compressImageFile(file, 480, 0.72).then(function (base64Data) {
                google.script.run.withSuccessHandler(function (url) {
                    payload['Photos'] = url;
                    doSubmitMyProfile(empId, payload, sessionData);
                }).withFailureHandler(function (err) {
                    toggleLoading(false);
                    showToast('Failed to upload image: ' + err.message, 'error');
                }).uploadImageToDrive(base64Data, file.name);
            }).catch(function (err) {
                toggleLoading(false);
                showToast('Image compression error: ' + err.message, 'error');
            });
            return; // Wait for upload
        } else {
            // Fallback if compressImageFile is not available
            let reader = new FileReader();
            reader.onload = function(e) {
                let base64Data = e.target.result;
                google.script.run.withSuccessHandler(function (url) {
                    payload['Photos'] = url;
                    doSubmitMyProfile(empId, payload, sessionData);
                }).withFailureHandler(function (err) {
                    toggleLoading(false);
                    showToast('Failed to upload image: ' + err.message, 'error');
                }).uploadImageToDrive(base64Data, file.name);
            };
            reader.readAsDataURL(file);
            return;
        }
    }
    
    doSubmitMyProfile(empId, payload, sessionData);
}

function doSubmitMyProfile(empId, payload, sessionData) {
    google.script.run
        .withSuccessHandler(res => {
            toggleLoading(false);
            if (res && res.success) {
                showToast(t('profile_updated') || 'Profile updated successfully', 'success');
                
                // Update local session if email changed
                const newEmail = document.getElementById('my-profile-email').value;
                if (newEmail && newEmail !== sessionData.email) {
                    sessionData.email = newEmail;
                    sessionData.username = newEmail;
                    if (localStorage.getItem('hr_user_session')) localStorage.setItem('hr_user_session', JSON.stringify(sessionData));
                    if (sessionStorage.getItem('hr_user_session')) sessionStorage.setItem('hr_user_session', JSON.stringify(sessionData));
                }
                
                closeMyProfileModal();
            } else {
                showToast(res ? res.message : 'Error updating profile', 'error');
            }
        })
        .withFailureHandler(err => {
            toggleLoading(false);
            showToast('Connection failed: ' + err.message, 'error');
        })
        .updateMyProfile(empId, payload);
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
