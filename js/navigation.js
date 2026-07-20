// ─────────────────────────────────────────────────────────────────────────────
// js/navigation.js - Navigation & Router
// ─────────────────────────────────────────────────────────────────────────────

/* =====================================================================
 * 📌 ส่วนที่ 10: NAVIGATION (ฟังก์ชันการเปลี่ยนหน้าจอ)
 * - ควบคุมการเปลี่ยนหน้าระหว่าง Dashboard, ตารางข้อมูล และอื่นๆ
 * ===================================================================== */
function navigate(pageId, title, sheetName = '') {
    try {
        const sessionStr = localStorage.getItem('hr_user_session') || sessionStorage.getItem('hr_user_session');
        let role = 'Staff', permissions = '';
        if (sessionStr) { try { let s = JSON.parse(sessionStr); role = s.role || 'Staff'; permissions = s.permissions || ''; } catch (e) { } }

        const roleStr = String(role).toLowerCase();
        const targetPage = String(sheetName || pageId).toLowerCase().trim();
        const isAdmin = roleStr.includes('admin') || roleStr.includes('manager');
        const allowedMenus = permissions ? String(permissions).split(',').map(m => m.trim().toLowerCase()) : [];
        const publicMenus = ['scan', 'dashboard', 'staff-dashboard'];

        // เช็คว่า User คนนี้มีสิทธิ์เข้าหน้านี้หรือไม่
        if (!isAdmin && !publicMenus.includes(targetPage)) {
            if (!allowedMenus.includes(targetPage)) {
                showToast('Access denied. You do not have permission to view this page.', 'error');
                return;
            }
        }

        const titleToKey = {
            'My Dashboard': 'menu_my_dashboard',
            'Dashboard': 'menu_dashboard',
            'Time Tracking': 'menu_time_tracking',
            'Leave Requests': 'menu_leave_requests',
            'Budget Requests': 'menu_budget_requests',
            'Attendance Logs': 'menu_attendance_logs',
            'Staff Directory': 'menu_staff_directory',
            'Digital Card': 'menu_digital_card',
            'Organization': 'menu_organization',
            'Employee Rating': 'menu_stk_wow',
            'KPI Records': 'menu_kpi',
            'Org Structure': 'menu_org_struct',
            'Department': 'menu_department',
            'Assets': 'menu_assets',
            'Announcements': 'menu_announcements',
            'News': 'menu_news',
            'Documents': 'menu_documents',
            'Training': 'menu_training',
            'Orientation': 'menu_orientation',
            'Policy': 'menu_policy',
            'Users': 'menu_users',
            'ตั้งค่าหน้าเว็บหลัก': 'menu_web_settings'
        };
        const key = titleToKey[title] || title;
        const titleEl = document.getElementById('page-title');
        if (titleEl) {
            titleEl.setAttribute('data-i18n', key);
            titleEl.innerText = typeof window.t === 'function' ? window.t(key) : title;
        }

        currentSheet = sheetName;

        document.querySelectorAll('.page-section').forEach(el => el.classList.add('hidden'));
        const targetSec = document.getElementById(`section-${pageId}`);
        if (targetSec) {
            targetSec.classList.remove('hidden');
        } else {
            throw new Error(`Section element #section-${pageId} not found in DOM`);
        }

        const menuId = sheetName || pageId;

        document.querySelectorAll('.nav-btn').forEach(btn => {
            btn.classList.remove('bg-gradient-to-r', 'from-brandindigo', 'to-brandpurple', 'text-white', 'shadow-md', 'shadow-indigo-500/30', 'bg-indigo-50');
            if (btn.closest('.submenu-container')) {
                btn.classList.add('hover:text-brandindigo', 'hover:bg-indigo-50', 'text-gray-500');
                const dot = btn.querySelector('span.w-1\\.5'); if (dot) { dot.classList.remove('bg-brandindigo'); dot.classList.add('bg-gray-300'); }
            } else {
                btn.classList.add('hover:bg-gray-50', 'text-gray-500');
            }
            const icon = btn.querySelector('i'); if (icon) icon.classList.remove('text-white', 'text-brandindigo');
        });

        const activeBtn = document.querySelector(`.nav-btn[data-page="${menuId}"]`);
        if (activeBtn) {
            if (activeBtn.closest('.submenu-container')) {
                activeBtn.classList.remove('hover:text-brandindigo', 'hover:bg-indigo-50', 'text-gray-500'); activeBtn.classList.add('bg-indigo-50', 'text-brandindigo', 'font-bold');
                const dot = activeBtn.querySelector('span.w-1\\.5'); if (dot) { dot.classList.remove('bg-gray-300'); dot.classList.add('bg-brandindigo'); }
            } else {
                activeBtn.classList.remove('hover:bg-gray-50', 'text-gray-500'); activeBtn.classList.add('bg-gradient-to-r', 'from-brandindigo', 'to-brandpurple', 'text-white', 'shadow-md', 'shadow-indigo-500/30');
                const icon = activeBtn.querySelector('i'); if (icon) icon.classList.add('text-white');
            }
        }

        if (window.innerWidth < 768) { document.getElementById('sidebar').classList.add('-translate-x-full'); document.getElementById('sidebar-backdrop').classList.add('hidden'); }

        if (pageId === 'dashboard') { loadDashboard(); }
        else if (pageId === 'digital-card') { loadDigitalCard(); }
        else if (pageId === 'company-settings') { loadCompanySettings(); }
        else if (pageId === 'staff-dashboard') { loadStaffDashboard(); }
        else if (pageId === 'table') {
            if (sheetName === 'Fingerprint_Logs') {
                let calMonthInput = document.getElementById('calendarMonth');
                if (!calMonthInput.value) { let d = new Date(); calMonthInput.value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`; }
            }
            fetchData(sheetName);
        }
        else if (pageId === 'scan') {
            initScanner(); loadTodayAttendance(); setTimeout(() => { if (map) map.invalidateSize(); }, 200);
        }
    } catch (error) {
        console.error("Error in navigate:", error);
        window.dispatchEvent(new ErrorEvent('error', { error: error, message: "navigate: " + error.message }));
    }
}

function filterDashboardItems() {
    const keyword = document.getElementById('dashSearchInput').value.toLowerCase();
    const pendingRows = document.querySelectorAll('#dash-pending-body tr');
    pendingRows.forEach(row => {
        if (row.innerText.includes('ไม่มีรายการรออนุมัติ')) return;
        const text = row.innerText.toLowerCase();
        row.style.display = text.includes(keyword) ? '' : 'none';
    });
    const trainingCards = document.querySelectorAll('#dash-recent-cards > div');
    trainingCards.forEach(card => {
        const text = card.innerText.toLowerCase();
        card.style.display = text.includes(keyword) ? '' : 'none';
    });
}

function clearDashboardDateFilter() {
    dashCalStartDateStr = null;
    dashCalEndDateStr = null;
    
    const clearBtns = document.querySelectorAll('#btn-clear-dash-date');
    clearBtns.forEach(btn => btn.classList.add('hidden'));

    loadDashboard();
}

async function loadStaffDashboard() {
    try {
        const sessionStr = localStorage.getItem('hr_user_session') || sessionStorage.getItem('hr_user_session');
        if (!sessionStr) return;
        const session = JSON.parse(sessionStr);
        const empId = String(session.empId || session.username || '').trim().toUpperCase();

        if (!empId) return;

        // 1. ดึงข้อมูลพนักงาน (Staff Details)
        google.script.run.withSuccessHandler(res => {
            if (res && res.success) {
                const staffMember = (res.data || []).find(r => String(r.Employee_ID || r.employee_id || '').trim().toUpperCase() === empId);
                if (staffMember) {
                    const firstName = staffMember.First_Name || staffMember.first_name || '';
                    const lastName = staffMember.Last_Name || staffMember.last_name || '';
                    const fullName = `${firstName} ${lastName}`.trim() || empId;

                    const welcomeEl = document.getElementById('staff-welcome-name');
                    const quotaEl = document.getElementById('staff-leave-quota');
                    const rankEl = document.getElementById('staff-rank');
                    const rewardEl = document.getElementById('staff-reward-points');

                    if (welcomeEl) welcomeEl.innerText = fullName;
                    if (quotaEl) quotaEl.innerText = (staffMember.Leave_Quota || '-') + ' วัน';
                    if (rankEl) rankEl.innerText = staffMember.Position_ID || staffMember.position_id || '-';
                    if (rewardEl) rewardEl.innerText = staffMember['Reward Level'] || staffMember.reward_level || '-';
                }
            }
        }).getSheetData('staff');

        // 2. ดึงเวลาเข้างานวันนี้ (Today's Attendance)
        const now = new Date();
        const offset = now.getTimezoneOffset() * 60000;
        const todayStr = (new Date(now.getTime() - offset)).toISOString().slice(0, 10);

        google.script.run.withSuccessHandler(res => {
            if (res && res.success) {
                const todayLog = (res.data || []).find(r => {
                    const rEmp = String(r.Employee_ID || r.employee_id || '').trim().toUpperCase();
                    if (rEmp !== empId) return false;
                    const rDate = String(r.Date || r.date || '').trim();
                    if (!rDate) return false;

                    // Match exact YYYY-MM-DD
                    if (rDate.slice(0, 10) === todayStr) return true;

                    // Match DD/MM/YYYY format
                    const parts = todayStr.split('-');
                    const thFormat = `${parts[2]}/${parts[1]}/${parts[0]}`;
                    if (rDate.includes(thFormat)) return true;

                    // Match via Date object
                    const parsed = parseDateStr(rDate);
                    if (parsed && parsed.toISOString().slice(0, 10) === todayStr) return true;

                    return false;
                });
                const timeEl = document.getElementById('staff-today-time');
                if (timeEl) {
                    if (todayLog) {
                        const inTime = todayLog.Check_In || todayLog.check_in || '-';
                        const outTime = todayLog.Check_Out || todayLog.check_out || '-';
                        timeEl.innerText = `${inTime} / ${outTime}`;
                    } else {
                        timeEl.innerText = '- / -';
                    }
                }
            }
        }).getSheetData('Fingerprint_Logs');

        // 3. ดึงประวัติการลา (Leave Applications)
        google.script.run.withSuccessHandler(res => {
            if (res && res.success) {
                const myLeaves = (res.data || [])
                    .filter(r => String(r.Employee_ID || r.employee_id || '').trim().toUpperCase() === empId)
                    .sort((a, b) => {
                        const dateA = parseDateStr(a.Start_Date || a.start_date);
                        const dateB = parseDateStr(b.Start_Date || b.start_date);
                        if (dateA && dateB) return dateB - dateA;
                        return 0;
                    })
                    .slice(0, 5);

                const leavesTbody = document.getElementById('staff-leaves-tbody');
                if (leavesTbody) {
                    if (myLeaves.length > 0) {
                        leavesTbody.innerHTML = myLeaves.map(r => {
                            const type = r['Type '] || r.Type || r.leave_type || 'ลาอื่นๆ';
                            const start = r.Start_Date || r.start_date || '';
                            const rawStatus = r.Signature || r.signature || r.Status || r.status || 'Pending';
                            const statusLower = String(rawStatus).toLowerCase();
                            const isApproved = rawStatus !== 'Pending' && rawStatus !== 'Rejected' && rawStatus !== '' && rawStatus !== '-';

                            let statusText = rawStatus;
                            let statusClass = 'text-amber-500 bg-amber-50';

                            if (statusLower.includes('approve') || statusLower.includes('อนุมัติ') || isApproved) {
                                statusClass = 'text-emerald-500 bg-emerald-50';
                                statusText = 'Approved';
                            } else if (statusLower.includes('reject') || statusLower.includes('ปฏิเสธ') || statusLower === 'rejected') {
                                statusClass = 'text-rose-500 bg-rose-50';
                                statusText = 'Rejected';
                            } else {
                                statusText = 'Pending';
                            }

                            return `
                                        <tr>
                                            <td class="py-3 font-semibold">${type}</td>
                                            <td class="py-3">${start}</td>
                                            <td class="py-3 text-right">
                                                <span class="inline-block px-2.5 py-1 text-xs font-bold rounded-full ${statusClass}">${statusText}</span>
                                            </td>
                                        </tr>
                                    `;
                        }).join('');
                    } else {
                        leavesTbody.innerHTML = `<tr><td colspan="3" class="py-10 text-center text-gray-400">ไม่มีประวัติการลางาน</td></tr>`;
                    }
                }
            }
        }).getSheetData('Leave application');

        // 3.5. ดึงประวัติการขออนุมัติงบประมาณ (Budget Requests)
        google.script.run.withSuccessHandler(res => {
            if (res && res.success) {
                const myBudgets = (res.data || [])
                    .filter(r => String(r.Employee_ID || r.employee_id || '').trim().toUpperCase() === empId)
                    .sort((a, b) => {
                        const dateA = parseDateStr(a.Request_Date || a.request_date);
                        const dateB = parseDateStr(b.Request_Date || b.request_date);
                        if (dateA && dateB) return dateB - dateA;
                        return 0;
                    })
                    .slice(0, 5);

                const budgetsTbody = document.getElementById('staff-budgets-tbody');
                if (budgetsTbody) {
                    if (myBudgets.length > 0) {
                        budgetsTbody.innerHTML = myBudgets.map(r => {
                            const title = r.Title || r.title || 'ของบประมาณ';
                            const rawAmt = r.Amount || r.amount || 0;
                            const amountStr = new Intl.NumberFormat('th-TH').format(rawAmt) + ' บาท';
                            const rawStatus = r.Signature || r.signature || r.Status || r.status || 'Pending';
                            const statusLower = String(rawStatus).toLowerCase();
                            const isApproved = rawStatus !== 'Pending' && rawStatus !== 'Rejected' && rawStatus !== '' && rawStatus !== '-';

                            let statusText = rawStatus;
                            let statusClass = 'text-amber-500 bg-amber-50';

                            if (statusLower.includes('approve') || statusLower.includes('อนุมัติ') || isApproved) {
                                statusClass = 'text-emerald-500 bg-emerald-50';
                                statusText = 'Approved';
                            } else if (statusLower.includes('reject') || statusLower.includes('ปฏิเสธ') || statusLower === 'rejected') {
                                statusClass = 'text-rose-500 bg-rose-50';
                                statusText = 'Rejected';
                            } else {
                                statusText = 'Pending';
                            }

                            const encodedRow = encodeURIComponent(JSON.stringify(r)).replace(/'/g, "%27");
                            return `
                                        <tr class="cursor-pointer hover:bg-gray-50/80 transition-colors" onclick="showBillDetailsModal('${encodedRow}')" title="คลิกเพื่อดูรายละเอียดบิล">
                                            <td class="py-3 font-semibold text-brandindigo hover:underline flex items-center gap-1">
                                                <i class="fa-solid fa-receipt text-[10px] opacity-75"></i>
                                                <span>${title}</span>
                                            </td>
                                            <td class="py-3 text-right">${amountStr}</td>
                                            <td class="py-3 text-right">
                                                <span class="inline-block px-2.5 py-1 text-xs font-bold rounded-full ${statusClass}">${statusText}</span>
                                            </td>
                                        </tr>
                                    `;
                        }).join('');
                    } else {
                        budgetsTbody.innerHTML = `<tr><td colspan="3" class="py-10 text-center text-gray-400">ไม่มีประวัติการขออนุมัติงบประมาณ</td></tr>`;
                    }
                }
            }
        }).getSheetData('Budget Request');

        // 4. ดึงประกาศล่าสุด (Latest Announcements)
        google.script.run.withSuccessHandler(res => {
            if (res && res.success) {
                const activeAnns = (res.data || [])
                    .filter(r => {
                        const status = String(r.Status || r.status || '').toLowerCase().trim();
                        return status === 'active' || status === '-' || status === '';
                    })
                    .sort((a, b) => {
                        const dateA = parseDateStr(a.Date || a.date);
                        const dateB = parseDateStr(b.Date || b.date);
                        if (dateA && dateB) return dateB - dateA;
                        return 0;
                    })
                    .slice(0, 3);

                const annContainer = document.getElementById('staff-announcements-container');
                if (annContainer) {
                    if (activeAnns.length > 0) {
                        annContainer.innerHTML = activeAnns.map(r => {
                            const topic = r.Topic || r.topic || 'ประกาศ';
                            const type = r.Type || r.type || 'ประกาศ';
                            const parsedDate = parseDateStr(r.Date || r.date);
                            const dateStr = parsedDate ? parsedDate.toLocaleDateString('th-TH', { month: 'short', day: 'numeric' }) : '';

                            return `
                                        <div class="p-4 rounded-xl bg-gray-50 border border-gray-100 hover:bg-indigo-50/30 hover:border-indigo-100/50 transition-all">
                                            <div class="flex items-center justify-between mb-2">
                                                <span class="inline-block px-2 py-0.5 text-[10px] font-bold bg-indigo-50 text-brandindigo rounded-md">${type}</span>
                                                <span class="text-xs text-gray-400 font-medium">${dateStr}</span>
                                            </div>
                                            <h4 class="text-sm font-bold text-gray-800 line-clamp-2">${topic}</h4>
                                        </div>
                                    `;
                        }).join('');
                    } else {
                        annContainer.innerHTML = `<p class="text-sm text-gray-400 text-center py-10">ไม่มีประกาศใหม่</p>`;
                    }
                }
            }
        }).getSheetData('Announcements');
    } catch (e) {
        console.warn('[StaffDashboard]', e);
    }
}
