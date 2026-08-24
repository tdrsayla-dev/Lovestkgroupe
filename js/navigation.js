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
        const allowedMenus = typeof parsePermissionsList === 'function' ? parsePermissionsList(permissions) : (permissions ? String(permissions).split(',').map(m => m.trim().toLowerCase()) : []);
        const publicMenus = ['scan', 'dashboard', 'staff-dashboard'];

        // เช็คว่า User คนนี้มีสิทธิ์เข้าหน้านี้หรือไม่
        if (!isAdmin && !publicMenus.includes(targetPage)) {
            const isAllowed = allowedMenus.includes('all') || (typeof isMenuPermissionChecked === 'function' ? isMenuPermissionChecked(targetPage, allowedMenus) : allowedMenus.includes(targetPage));
            if (!isAllowed) {
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
            'ตั้งค่าหน้าเว็บหลัก': 'menu_web_settings',
            'Chart of Accounts': 'menu_chart_of_accounts',
            'Expense Vouchers': 'menu_expense_vouchers',
            'General Ledger': 'menu_general_ledger',
            'Invoices & Revenue': 'menu_invoices',
            'Financial Reports': 'menu_financial_reports'
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
            if (typeof updateDOMTranslations === 'function') updateDOMTranslations();
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
        else if (pageId === 'facebook-budget') {
            if (typeof switchFbTab === 'function') switchFbTab('dashboard');
            else if (typeof loadFacebookBudgetDashboard === 'function') loadFacebookBudgetDashboard();
        }
        else if (pageId === 'chart-of-accounts') { if (typeof loadChartOfAccounts === 'function') loadChartOfAccounts(); }
        else if (pageId === 'expense-vouchers') { if (typeof loadExpenseVouchers === 'function') loadExpenseVouchers(); }
        else if (pageId === 'general-ledger') { if (typeof loadGeneralLedger === 'function') loadGeneralLedger(); }
        else if (pageId === 'invoices') { if (typeof loadInvoices === 'function') loadInvoices(); }
        else if (pageId === 'financial-reports') { if (typeof loadFinancialReports === 'function') loadFinancialReports(); }
        else if (pageId === 'table') {
            const isAttendance = (sheetName === 'Fingerprint_Logs' || sheetName === 'fingerprint_logs');
            if (isAttendance) {
                let calMonthInput = document.getElementById('calendarMonth');
                if (calMonthInput && !calMonthInput.value) {
                    let d = new Date();
                    calMonthInput.value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
                }
            }
            fetchData(sheetName, isAttendance);
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
        const sessionUserEmail = String(session.username || session.email || '').trim().toLowerCase();
        let rawEmpId = String(session.empId || session.employeeId || '').trim().toUpperCase();
        let empId = (!rawEmpId || rawEmpId.includes('@')) ? '' : rawEmpId;

        if (!empId && !sessionUserEmail) return;

        const getSheetDataSafe = (sheetName, cb) => {
            if (typeof google !== 'undefined' && google.script && google.script.run) {
                google.script.run.withSuccessHandler(cb).getSheetData(sheetName);
            } else if (typeof tableCache !== 'undefined' && tableCache[sheetName] && tableCache[sheetName].data) {
                cb({ success: true, data: tableCache[sheetName].data });
            } else if (typeof fetchData === 'function') {
                fetchData(sheetName).then(data => cb({ success: true, data: data || [] })).catch(() => cb({ success: false, data: [] }));
            } else {
                cb({ success: false, data: [] });
            }
        };

        // Try to resolve true employee_id from users table if not already known
        if (!empId && typeof tableCache !== 'undefined' && tableCache['users'] && tableCache['users'].data) {
            const uMatch = tableCache['users'].data.find(u => {
                const uName = String(u.username || u.Username || '').trim().toLowerCase();
                const uEmail = String(u.email || u.Email || '').trim().toLowerCase();
                return uName === sessionUserEmail || uEmail === sessionUserEmail;
            });
            if (uMatch) {
                empId = String(uMatch.employee_id || uMatch.Employee_ID || '').trim().toUpperCase();
            }
        }

        // 1. ดึงข้อมูลพนักงาน (Staff Details)
        getSheetDataSafe('staff', res => {
            if (res && res.success) {
                const staffList = res.data || [];
                
                // Priority 1: Match by exact Employee_ID
                let staffMember = null;
                if (empId) {
                    staffMember = staffList.find(r => String(r.Employee_ID || r.employee_id || r.Emp_ID || '').trim().toUpperCase() === empId);
                }

                // Priority 2: Match by exact Email
                if (!staffMember && sessionUserEmail) {
                    const matchesByEmail = staffList.filter(r => String(r.Email || r.email || '').trim().toLowerCase() === sessionUserEmail);
                    if (matchesByEmail.length === 1) {
                        staffMember = matchesByEmail[0];
                    } else if (matchesByEmail.length > 1) {
                        const emailPrefix = sessionUserEmail.split('@')[0].toLowerCase();
                        const token = emailPrefix.split(/[._-]/).pop();
                        staffMember = matchesByEmail.find(r => {
                            const fullName = (String(r.First_Name || '') + ' ' + String(r.Last_Name || '')).toLowerCase();
                            return token && token.length > 2 && fullName.includes(token);
                        }) || matchesByEmail[0];
                    }
                }

                if (staffMember) {
                    const resolvedEmpId = String(staffMember.Employee_ID || staffMember.employee_id || staffMember.Emp_ID || empId).trim().toUpperCase();
                    empId = resolvedEmpId;
                    window.staffCalTargetEmpId = resolvedEmpId;

                    // Update session in storage
                    if (session.empId !== resolvedEmpId) {
                        session.empId = resolvedEmpId;
                        localStorage.setItem('hr_user_session', JSON.stringify(session));
                        if (sessionStorage.getItem('hr_user_session')) sessionStorage.setItem('hr_user_session', JSON.stringify(session));
                    }

                    const rawFirst = staffMember.First_Name || staffMember.first_name || '';
                    const rawLast = staffMember.Last_Name || staffMember.last_name || '';
                    const firstName = String(rawFirst).replace(/<[^>]*>/g, '').trim();
                    const lastName = String(rawLast).replace(/<[^>]*>/g, '').trim();
                    const fullName = `${firstName} ${lastName}`.trim() || resolvedEmpId;

                    const welcomeEl = document.getElementById('staff-welcome-name');
                    const quotaEl = document.getElementById('staff-leave-quota');
                    const rankEl = document.getElementById('staff-rank');
                    const rewardEl = document.getElementById('staff-reward-points');
                    const calInfoEl = document.getElementById('staff-cal-emp-info');

                    if (welcomeEl) welcomeEl.innerText = fullName;
                    if (quotaEl) quotaEl.innerText = (staffMember.Leave_Quota || '-') + ' วัน';
                    if (rankEl) rankEl.innerText = staffMember.Position_ID || staffMember.position_id || '-';
                    if (rewardEl) rewardEl.innerText = staffMember['Reward Level'] || staffMember.reward_level || '-';
                    if (calInfoEl) calInfoEl.innerText = `ประวัติการลงเวลาของ ${fullName} (${resolvedEmpId})`;

                    // If logs were already loaded before staff resolved, re-render calendar
                    if (window.staffCalCachedLogs && window.staffCalCachedLogs.length > 0) {
                        const targetYear = window.staffCalCurrentDate.getFullYear();
                        const targetMonth = window.staffCalCurrentDate.getMonth() + 1;
                        renderStaffAttendanceCalendar(targetYear, targetMonth, window.staffCalCachedLogs, window.staffCalCachedLeaves || [], resolvedEmpId);
                    }
                }
            }
        });

        // 2. ดึงเวลาเข้างานวันนี้ และ ข้อมูลปฏิทินการเข้างาน (Fingerprint_Logs)
        const now = new Date();
        const offset = now.getTimezoneOffset() * 60000;
        const todayStr = (new Date(now.getTime() - offset)).toISOString().slice(0, 10);

        getSheetDataSafe('Fingerprint_Logs', res => {
            if (res && res.success) {
                const allLogs = res.data || [];
                const currentTargetId = window.staffCalTargetEmpId || empId;
                const myLogs = allLogs.filter(r => {
                    const rEmp = String(r.Employee_ID || r.employee_id || r.Emp_ID || '').trim().toUpperCase();
                    const rEmail = String(r.Email || r.email || '').trim().toLowerCase();
                    return (currentTargetId && rEmp === currentTargetId) || (empId && rEmp === empId) || (sessionUserEmail && rEmail === sessionUserEmail && !rEmp.startsWith('VIP'));
                });

                window.staffCalCachedLogs = myLogs;

                const todayLog = myLogs.find(r => {
                    const rDate = String(r.Date || r.date || '').trim();
                    if (!rDate) return false;

                    // Match exact YYYY-MM-DD
                    if (rDate.slice(0, 10) === todayStr) return true;

                    // Match DD/MM/YYYY format
                    const parts = todayStr.split('-');
                    const thFormat = `${parts[2]}/${parts[1]}/${parts[0]}`;
                    if (rDate.includes(thFormat)) return true;

                    // Match via Date object
                    const parsed = typeof parseDateStr === 'function' ? parseDateStr(rDate) : new Date(rDate);
                    if (parsed && !isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === todayStr) return true;

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

                // Render calendar with current month
                const targetYear = window.staffCalCurrentDate.getFullYear();
                const targetMonth = window.staffCalCurrentDate.getMonth() + 1;
                const monthInput = document.getElementById('staffCalendarMonth');
                if (monthInput && !monthInput.value) {
                    monthInput.value = `${targetYear}-${String(targetMonth).padStart(2, '0')}`;
                }
                renderStaffAttendanceCalendar(targetYear, targetMonth, myLogs, window.staffCalCachedLeaves || [], window.staffCalTargetEmpId || empId);
            }
        });

        // 3. ดึงประวัติการลา (Leave Applications)
        getSheetDataSafe('Leave application', res => {
            if (res && res.success) {
                const allLeaves = res.data || [];
                const myAllLeaves = allLeaves.filter(r => {
                    const rEmp = String(r.Employee_ID || r.employee_id || r.Emp_ID || '').trim().toUpperCase();
                    const rEmail = String(r.Email || r.email || '').trim().toLowerCase();
                    return (empId && rEmp === empId) || (sessionUserEmail && rEmail === sessionUserEmail);
                });

                window.staffCalCachedLeaves = myAllLeaves;

                // Re-render calendar with leaves data if already loaded
                if (window.staffCalCachedLogs) {
                    const targetYear = window.staffCalCurrentDate.getFullYear();
                    const targetMonth = window.staffCalCurrentDate.getMonth() + 1;
                    renderStaffAttendanceCalendar(targetYear, targetMonth, window.staffCalCachedLogs, myAllLeaves, window.staffCalTargetEmpId || empId);
                }

                const myLeaves = [...myAllLeaves]
                    .sort((a, b) => {
                        const dateA = typeof parseDateStr === 'function' ? parseDateStr(a.Start_Date || a.start_date) : new Date(a.Start_Date || a.start_date);
                        const dateB = typeof parseDateStr === 'function' ? parseDateStr(b.Start_Date || b.start_date) : new Date(b.Start_Date || b.start_date);
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
                                            <td class="py-3 font-semibold">${escapeHtml(type)}</td>
                                            <td class="py-3">${escapeHtml(start)}</td>
                                            <td class="py-3 text-right">
                                                <span class="inline-block px-2.5 py-1 text-xs font-bold rounded-full ${statusClass}">${escapeHtml(statusText)}</span>
                                            </td>
                                        </tr>
                                    `;
                        }).join('');
                    } else {
                        leavesTbody.innerHTML = `<tr><td colspan="3" class="py-10 text-center text-gray-400">ไม่มีประวัติการลางาน</td></tr>`;
                    }
                }
            }
        });

        // 3.5. ดึงประวัติการขออนุมัติงบประมาณ (Budget Requests)
        getSheetDataSafe('Budget Request', res => {
            if (res && res.success) {
                const myBudgets = (res.data || [])
                    .filter(r => {
                        const rEmp = String(r.Employee_ID || r.employee_id || r.Emp_ID || '').trim().toUpperCase();
                        const rEmail = String(r.Email || r.email || '').trim().toLowerCase();
                        return (empId && rEmp === empId) || (sessionUserEmail && rEmail === sessionUserEmail);
                    })
                    .sort((a, b) => {
                        const dateA = typeof parseDateStr === 'function' ? parseDateStr(a.Request_Date || a.request_date) : new Date(a.Request_Date || a.request_date);
                        const dateB = typeof parseDateStr === 'function' ? parseDateStr(b.Request_Date || b.request_date) : new Date(b.Request_Date || b.request_date);
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
                                                <span>${escapeHtml(title)}</span>
                                            </td>
                                            <td class="py-3 text-right">${amountStr}</td>
                                            <td class="py-3 text-right">
                                                <span class="inline-block px-2.5 py-1 text-xs font-bold rounded-full ${statusClass}">${escapeHtml(statusText)}</span>
                                            </td>
                                        </tr>
                                    `;
                        }).join('');
                    } else {
                        budgetsTbody.innerHTML = `<tr><td colspan="3" class="py-10 text-center text-gray-400">ไม่มีคำขอเบิกงบประมาณ</td></tr>`;
                    }
                }
            }
        });

        // 4. ดึงประกาศล่าสุด (Latest Announcements)
        getSheetDataSafe('Announcements', res => {
            if (res && res.success) {
                const activeAnns = (res.data || [])
                    .filter(r => {
                        const status = String(r.Status || r.status || '').toLowerCase().trim();
                        return status === 'active' || status === '-' || status === '';
                    })
                    .sort((a, b) => {
                        const dateA = typeof parseDateStr === 'function' ? parseDateStr(a.Date || a.date) : new Date(a.Date || a.date);
                        const dateB = typeof parseDateStr === 'function' ? parseDateStr(b.Date || b.date) : new Date(b.Date || b.date);
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
                            const parsedDate = typeof parseDateStr === 'function' ? parseDateStr(r.Date || r.date) : new Date(r.Date || r.date);
                            const dateStr = parsedDate && !isNaN(parsedDate.getTime()) ? parsedDate.toLocaleDateString('th-TH', { month: 'short', day: 'numeric' }) : '';

                            return `
                                        <div class="p-4 rounded-xl bg-gray-50 border border-gray-100 hover:bg-indigo-50/30 hover:border-indigo-100/50 transition-all">
                                            <div class="flex items-center justify-between mb-2">
                                                <span class="inline-block px-2 py-0.5 text-[10px] font-bold bg-indigo-50 text-brandindigo rounded-md">${escapeHtml(type)}</span>
                                                <span class="text-xs text-gray-400 font-medium">${escapeHtml(dateStr)}</span>
                                            </div>
                                            <h4 class="text-sm font-bold text-gray-800 line-clamp-2">${escapeHtml(topic)}</h4>
                                        </div>
                                    `;
                        }).join('');
                    } else {
                        annContainer.innerHTML = `<p class="text-sm text-gray-400 text-center py-10">ไม่มีประกาศใหม่</p>`;
                    }
                }
            }
        });
    } catch (e) {
        console.warn('[StaffDashboard]', e);
    }
}

// ── 📌 Staff Attendance Calendar Logic ──────────────────────────────────────
window.staffCalCurrentDate = window.staffCalCurrentDate || new Date();
window.staffCalCachedLogs = [];
window.staffCalCachedLeaves = [];
window.staffCalTargetEmpId = '';

window.changeStaffCalMonth = function (delta) {
    if (!window.staffCalCurrentDate) window.staffCalCurrentDate = new Date();
    window.staffCalCurrentDate.setMonth(window.staffCalCurrentDate.getMonth() + delta);
    const targetYear = window.staffCalCurrentDate.getFullYear();
    const targetMonth = window.staffCalCurrentDate.getMonth() + 1;
    const monthInput = document.getElementById('staffCalendarMonth');
    if (monthInput) {
        monthInput.value = `${targetYear}-${String(targetMonth).padStart(2, '0')}`;
    }
    renderStaffAttendanceCalendar(targetYear, targetMonth, window.staffCalCachedLogs || [], window.staffCalCachedLeaves || [], window.staffCalTargetEmpId || '');
};

window.onStaffCalendarMonthChange = function (val) {
    if (!val) return;
    const [yStr, mStr] = val.split('-');
    const y = parseInt(yStr, 10);
    const m = parseInt(mStr, 10);
    if (!isNaN(y) && !isNaN(m)) {
        window.staffCalCurrentDate = new Date(y, m - 1, 1);
        renderStaffAttendanceCalendar(y, m, window.staffCalCachedLogs || [], window.staffCalCachedLeaves || [], window.staffCalTargetEmpId || '');
    }
};

window.renderStaffAttendanceCalendar = function (year, month, logs, leaves, targetEmpId) {
    const calDiv = document.getElementById('staff-attendance-calendar-grid');
    if (!calDiv) return;
    calDiv.innerHTML = '';

    const daysInMonth = new Date(year, month, 0).getDate();
    const firstDayOfWeek = new Date(year, month - 1, 1).getDay();
    let today = new Date();
    today.setHours(0, 0, 0, 0);

    let presentCount = 0;
    let absentCount = 0;
    let leaveCount = 0;
    let totalLateMins = 0;

    // Filter leaves for this staff (approved or pending, non-rejected)
    const empLeaves = (leaves || []).filter(r => {
        let status = String(r.Signature || r.signature || r.Status || r.status || (typeof getFuzzyValue === 'function' ? getFuzzyValue(r, ['signature', 'status', 'อนุมัติ', 'approval_status']) : '') || '').toLowerCase();
        return !status.includes('reject') && !status.includes('ไม่อนุมัติ') && !status.includes('ปฏิเสธ') && !status.includes('denied');
    });

    // Padding for days before start of month
    for (let i = 0; i < firstDayOfWeek; i++) {
        calDiv.innerHTML += `<div class="p-2"></div>`;
    }

    for (let day = 1; day <= daysInMonth; day++) {
        const currentDate = new Date(year, month - 1, day);
        const dateStr = `${String(day).padStart(2, '0')}/${String(month).padStart(2, '0')}/${year}`;
        const dbDateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

        const isSunday = currentDate.getDay() === 0;
        const isSaturday = currentDate.getDay() === 6;
        const isWeekend = isSunday; // default Sunday as primary weekend
        const isPastOrToday = currentDate <= today;

        const logFound = (logs || []).find(r => {
            let rDate = String(r.Date || r.date || (typeof getFuzzyValue === 'function' ? getFuzzyValue(r, ['date', 'วันที่']) : '') || '').trim();
            if (!rDate) return false;
            if (rDate === dateStr || rDate === dbDateStr || rDate.slice(0, 10) === dbDateStr || rDate.startsWith(dbDateStr)) return true;
            let parsed = typeof parseDateStr === 'function' ? parseDateStr(rDate) : new Date(rDate);
            if (parsed && !isNaN(parsed.getTime()) && parsed.getFullYear() === year && (parsed.getMonth() + 1) === month && parsed.getDate() === day) return true;
            return false;
        });

        let isOnLeave = false;
        let leaveTypeName = '';
        for (let lv of empLeaves) {
            let lStartStr = lv.Start_Date || lv.start_date || (typeof getFuzzyValue === 'function' ? getFuzzyValue(lv, ['start_date', 'เริ่ม']) : '');
            let lEndStr = lv.End_Date || lv.end_date || (typeof getFuzzyValue === 'function' ? getFuzzyValue(lv, ['end_date', 'สิ้นสุด']) : '');
            let lStart = typeof parseDateStr === 'function' ? parseDateStr(lStartStr) : new Date(lStartStr);
            let lEnd = typeof parseDateStr === 'function' ? parseDateStr(lEndStr) : new Date(lEndStr);

            if (lStart && lEnd && !isNaN(lStart.getTime()) && !isNaN(lEnd.getTime())) {
                let s = new Date(lStart);
                s.setHours(0, 0, 0, 0);
                let e = new Date(lEnd);
                e.setHours(23, 59, 59, 999);
                let cur = new Date(currentDate);
                cur.setHours(12, 0, 0, 0);

                if (cur >= s && cur <= e) {
                    isOnLeave = true;
                    leaveTypeName = lv['Type '] || lv.Type || lv.leave_type || 'ลาพัก';
                    break;
                }
            }
        }

        let boxClass = "h-14 sm:h-16 md:h-20 rounded-2xl flex flex-col items-center justify-center relative transition-all border cursor-pointer hover:scale-105 active:scale-95 shadow-sm ";
        let innerHtml = `<span class="text-sm md:text-base font-black">${day}</span>`;
        let itemTitle = `${dateStr}`;

        if (logFound && (logFound.Check_In || logFound.check_in || logFound.Attendance_Status || logFound.attendance_status)) {
            presentCount++;
            boxClass += "bg-emerald-50/80 border-emerald-200 text-emerald-700 hover:bg-emerald-100 hover:border-emerald-300";
            innerHtml += `<span class="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_6px_rgba(16,185,129,0.8)] mt-1"></span>`;

            let isLate = String(logFound.Attendance_Status || logFound.attendance_status || '').toLowerCase().includes('late');
            const checkInDisplay = logFound.Check_In || logFound.check_in || '-';
            const checkOutDisplay = logFound.Check_Out || logFound.check_out || '-';
            const shiftStart = logFound.Shift_Start || logFound.shift_start || '';

            let lateMins = 0;
            if (checkInDisplay && checkInDisplay !== '-' && shiftStart && shiftStart !== '-') {
                let inParts = checkInDisplay.split(':');
                let startParts = shiftStart.split(':');
                if (inParts.length >= 2 && startParts.length >= 2) {
                    let inM = parseInt(inParts[0], 10) * 60 + parseInt(inParts[1], 10);
                    let stM = parseInt(startParts[0], 10) * 60 + parseInt(startParts[1], 10);
                    if (inM > stM) lateMins = inM - stM;
                }
            } else if (logFound.Late_Hours || logFound.late_hours) {
                lateMins = Math.round((parseFloat(logFound.Late_Hours || logFound.late_hours) || 0) * 60);
            }

            if (lateMins > 0) totalLateMins += lateMins;

            if (isLate || lateMins > 0) {
                itemTitle = `มาทำงาน (สาย ${lateMins} นาที) | เข้างาน: ${checkInDisplay} | ออกงาน: ${checkOutDisplay}`;
            } else {
                itemTitle = `มาทำงานตรงเวลา | เข้างาน: ${checkInDisplay} | ออกงาน: ${checkOutDisplay}`;
            }
        } else if (isOnLeave) {
            leaveCount++;
            boxClass += "bg-yellow-50/80 border-yellow-200 text-yellow-700 hover:bg-yellow-100 hover:border-yellow-300";
            innerHtml = `<div class="w-8 h-8 flex items-center justify-center rounded-full bg-amber-400 text-white font-black text-xs md:text-sm shadow-md">${day}</div>`;
            itemTitle = `ลางาน (${leaveTypeName}) - ${dateStr}`;
        } else if (isWeekend) {
            boxClass += "bg-gray-100/70 border-gray-200 text-gray-400 hover:bg-gray-200/80";
            itemTitle = `วันหยุด (Weekend) - ${dateStr}`;
        } else if (isPastOrToday) {
            absentCount++;
            boxClass += "bg-red-50/80 border-red-200 text-red-600 hover:bg-red-100 hover:border-red-300";
            innerHtml = `<div class="w-8 h-8 flex items-center justify-center rounded-full bg-red-500 text-white font-black text-xs md:text-sm shadow-md">${day}</div>`;
            itemTitle = `ขาดงาน (Absent) - ${dateStr}`;
        } else {
            boxClass += "bg-white border-dashed border-gray-200 text-gray-300 hover:bg-indigo-50/50 hover:border-indigo-200";
            itemTitle = `ยังไม่ถึงกำหนด - ${dateStr}`;
        }

        calDiv.innerHTML += `<div class="${boxClass}" title="${itemTitle}">${innerHtml}</div>`;
    }

    // Update quick stats badges
    const pEl = document.getElementById('staff-cal-present-count');
    const aEl = document.getElementById('staff-cal-absent-count');
    const lEl = document.getElementById('staff-cal-leave-count');
    const ltEl = document.getElementById('staff-cal-late-mins');

    if (pEl) pEl.innerText = presentCount;
    if (aEl) aEl.innerText = absentCount;
    if (lEl) lEl.innerText = leaveCount;
    if (ltEl) ltEl.innerText = totalLateMins;
};

