// ─────────────────────────────────────────────────────────────────────────────
// js/dashboard.js - Dashboard Stats, Charts, and Mini Calendar
// ─────────────────────────────────────────────────────────────────────────────

let lateChartInstance = null;
let employeeMonthChartInst = null;
let attChartInstance = null;

let dashCalDate = new Date();
let dashCalStartDateStr = null; // ตัวแปรเก็บวันเริ่มเลือกช่วง
let dashCalEndDateStr = null; // ตัวแปรเก็บวันสิ้นสุดเลือกช่วง

/* =====================================================================
 * 📌 ส่วนที่ 11: DASHBOARD CORE (ฟังก์ชันหลักของหน้าแดชบอร์ด)
 * ===================================================================== */
function loadDashboard() {
    try {
        const startDate = (typeof dashCalStartDateStr !== 'undefined' && dashCalStartDateStr) ? dashCalStartDateStr : '';
        const endDate = (typeof dashCalEndDateStr !== 'undefined' && dashCalEndDateStr) ? dashCalEndDateStr : (startDate ? startDate : '');

        lastDashStartDate = startDate;
        lastDashEndDate = endDate;

        const loader = document.getElementById('dash-inline-loader');
        if (loader) loader.classList.remove('hidden');

        const statIds = ['dash-staff', 'dash-leaves', 'dash-logs', 'dash-assets', 'dash-trainings', 'dash-late', 'dash-early', 'dash-absent', 'dash-ot', 'dash-overview-absent'];
        statIds.forEach(id => {
            let el = document.getElementById(id);
            if (el) el.classList.add('opacity-30', 'scale-95', 'transition-all', 'duration-300');
        });

        let reqStaff = !tableCache['staff'];
        let reqLogs = !tableCache['Fingerprint_Logs'];
        let reqAnnounce = !tableCache['Announcements'];
        let reqLeaves = !tableCache['Leave application'];
        let reqRatings = !tableCache['Employees Ranting '] && !tableCache['Employees Ranting'] && !tableCache['Employees Rating'] && !tableCache['employees_rating'];

        if (reqStaff || reqLogs || reqAnnounce || reqLeaves || reqRatings) {
            renderDashboardExtras();
            let checkCount = 0;
            let checkInterval = setInterval(() => {
                let ready = tableCache['staff'] && tableCache['Fingerprint_Logs'] && tableCache['Leave application'];
                if (ready || checkCount > 30) {
                    clearInterval(checkInterval);
                    finishLoadDashboardUI();
                }
                checkCount++;
            }, 500);
        } else {
            finishLoadDashboardUI();
        }

    } catch (error) {
        console.error("Error in loadDashboard:", error);
    }
}

function finishLoadDashboardUI() {
    if (typeof checkAndRenderCharts === 'function') checkAndRenderCharts();
    if (typeof renderDashboardTopRatings === 'function') renderDashboardTopRatings();
    if (tableCache['Announcements'] && typeof renderAnnouncements === 'function') {
        renderAnnouncements(tableCache['Announcements'].data);
    }

    const safeUpdate = (id, val) => { const el = document.getElementById(id); if (el) el.innerText = val; };

    if (tableCache['Leave application']) {
        let pending = tableCache['Leave application'].data.filter(r => String(r.status || r.signature || '').toLowerCase().includes('pending'));
        if (typeof renderDashboardPendingLeaves === 'function') renderDashboardPendingLeaves(pending);
    }
    if (tableCache['Asset_Tracking']) {
        safeUpdate('dash-assets', tableCache['Asset_Tracking'].data.length);
    } else {
        google.script.run.withSuccessHandler(res => {
            if (res.success) { tableCache['Asset_Tracking'] = { headers: res.headers, data: res.data }; safeUpdate('dash-assets', res.data.length); }
        }).getSheetData('Asset_Tracking');
    }
    if (tableCache['Training']) {
        safeUpdate('dash-trainings', tableCache['Training'].data.length);
    } else {
        google.script.run.withSuccessHandler(res => {
            if (res.success) { tableCache['Training'] = { headers: res.headers, data: res.data }; safeUpdate('dash-trainings', res.data.length); }
        }).getSheetData('Training');
    }

    const loader = document.getElementById('dash-inline-loader');
    if (loader) loader.classList.add('hidden');
    const statIds = ['dash-staff', 'dash-leaves', 'dash-logs', 'dash-assets', 'dash-trainings', 'dash-late', 'dash-early', 'dash-absent', 'dash-ot', 'dash-overview-absent'];
    statIds.forEach(id => {
        let el = document.getElementById(id);
        if (el) el.classList.remove('opacity-30', 'scale-95');
    });
}

function updateDashboardUI(data) {
    const safeSetText = (id, text) => {
        const el = document.getElementById(id);
        if (el) el.innerText = text;
    };

    safeSetText('dash-staff', data.staff || 0);
    safeSetText('dash-leaves', data.leaves || 0);
    safeSetText('dash-logs', data.logs || 0);
    safeSetText('dash-assets', data.assets !== undefined ? data.assets : '-');
    safeSetText('dash-trainings', data.trainings !== undefined ? data.trainings : '-');
    safeSetText('dash-late', data.lateHours || 0);
    safeSetText('dash-early', data.earlyHours || 0);
    safeSetText('dash-absent', data.absents || 0);
    safeSetText('dash-overview-absent', data.absents || 0);
    safeSetText('dash-ot', new Intl.NumberFormat('th-TH').format(data.otAmount || 0));

    if (typeof renderDashboardPendingLeaves === 'function') renderDashboardPendingLeaves(data.pendingLeaves || []);
    if (typeof renderDashboardRecentCards === 'function') renderDashboardRecentCards(data.recentCards || []);
    if (typeof renderDashboardExtras === 'function') renderDashboardExtras();
}

function renderDashboardExtras() {
    const extrasSection = document.getElementById('dashboard-extras-section');
    if (extrasSection) {
        const sessionStr = localStorage.getItem('hr_user_session') || sessionStorage.getItem('hr_user_session');
        let role = 'Staff';
        if (sessionStr) { try { role = JSON.parse(sessionStr).role || 'Staff'; } catch (e) { } }
        if (role !== 'Staff') extrasSection.classList.remove('hidden');
    }

    let reqStaff = !tableCache['staff'];
    let reqLogs = !tableCache['Fingerprint_Logs'];
    let reqAnnounce = !tableCache['Announcements'];
    let reqLeaves = !tableCache['Leave application'];
    let reqRatings = !tableCache['Employees Ranting '] && !tableCache['Employees Ranting'] && !tableCache['Employees Rating'] && !tableCache['employees_rating'];

    let pendingReq = (reqStaff ? 1 : 0) + (reqLogs ? 1 : 0) + (reqAnnounce ? 1 : 0) + (reqLeaves ? 1 : 0) + (reqRatings ? 1 : 0);

    if (pendingReq === 0) {
        checkAndRenderCharts();
        if (tableCache['Announcements']) renderAnnouncements(tableCache['Announcements'].data);
        return;
    }

    if (reqStaff) {
        google.script.run.withSuccessHandler(res => {
            if (res.success) tableCache['staff'] = { headers: (res.headers || []).map(String), data: res.data || [] };
            pendingReq--;
            if (pendingReq === 0) executeRenderExtras();
        }).getSheetData('staff');
    }
    if (reqLogs) {
        google.script.run.withSuccessHandler(res => {
            if (res.success) tableCache['Fingerprint_Logs'] = { headers: (res.headers || []).map(String), data: res.data || [] };
            pendingReq--;
            if (pendingReq === 0) executeRenderExtras();
        }).getSheetData('Fingerprint_Logs');
    }
    if (reqAnnounce) {
        google.script.run.withSuccessHandler(res => {
            if (res.success) tableCache['Announcements'] = { headers: (res.headers || []).map(String), data: res.data || [] };
            pendingReq--;
            if (pendingReq === 0) executeRenderExtras();
        }).getSheetData('Announcements');
    }
    if (reqLeaves) {
        google.script.run.withSuccessHandler(res => {
            if (res.success) tableCache['Leave application'] = { headers: (res.headers || []).map(String), data: res.data || [] };
            pendingReq--;
            if (pendingReq === 0) executeRenderExtras();
        }).getSheetData('Leave application');
    }
    if (reqRatings) {
        google.script.run.withSuccessHandler(res => {
            if (res.success) {
                const cleaned = { headers: (res.headers || []).map(String), data: res.data || [] };
                tableCache['Employees Ranting '] = cleaned;
                tableCache['Employees Ranting'] = cleaned;
                tableCache['Employees Rating'] = cleaned;
                tableCache['employees_rating'] = cleaned;
            }
            pendingReq--;
            if (pendingReq === 0) executeRenderExtras();
        }).getSheetData('Employees Ranting ');
    }
}

function executeRenderExtras() {
    if (tableCache['staff'] && tableCache['Fingerprint_Logs']) checkAndRenderCharts();
    if (tableCache['Announcements'] && tableCache['Announcements'].data) {
        renderAnnouncements(tableCache['Announcements'].data);
    } else {
        const annEl = document.getElementById('dashboard-announcements');
        if (annEl) annEl.innerHTML = '<p class="text-sm text-indigo-200 text-center py-4 font-medium">No announcements</p>';
    }
    if (typeof renderDashboardTopRatings === 'function') renderDashboardTopRatings();
    if (typeof renderEmployeeMonthChart === 'function') renderEmployeeMonthChart();
}

function renderAnnouncements(data) {
    const container = document.getElementById('dashboard-announcements');
    if (!container) return;

    if (!data || data.length === 0) {
        container.innerHTML = '<p class="text-sm text-indigo-200 text-center py-4 font-medium">No announcements</p>';
        return;
    }

    let html = '';
    let validAnnouncements = 0;

    const activeData = data.filter(row => {
        let status = String(getFuzzyValue(row, ['status', 'สถานะ'])).toLowerCase();
        return status === 'active' || status === '-' || status === '';
    });

    activeData.reverse().forEach(row => {
        const isEmpty = Object.values(row).every(v => !v || String(v).trim() === '');
        if (isEmpty) return;

        let dateStr = escapeHtml(getFuzzyValue(row, ['date', 'วันที่'], 0));
        let type = escapeHtml(getFuzzyValue(row, ['type', 'ประเภท'], 1) || '📢 Update');
        let topic = escapeHtml(getFuzzyValue(row, ['topic', 'หัวข้อ', 'เรื่อง', 'รายละเอียด'], 2) || 'No Subject');

        if (topic.length > 60) topic = topic.substring(0, 60) + '...';

        html += `
                    <div class="bg-white/10 rounded-xl p-3 backdrop-blur-sm border border-white/20 hover:bg-white/20 transition-colors">
                        <div class="flex justify-between items-start mb-1.5">
                            <p class="text-xs text-indigo-100 font-bold tracking-wide uppercase">${type}</p>
                            <span class="text-[10px] text-indigo-200 ml-2 font-medium">${dateStr !== '-' ? dateStr : ''}</span>
                        </div>
                        <p class="text-sm font-semibold text-white leading-snug">${topic}</p>
                    </div>
                `;
        validAnnouncements++;
    });

    if (validAnnouncements === 0) {
        container.innerHTML = '<p class="text-sm text-indigo-200 text-center py-4 font-medium">No active announcements</p>';
    } else {
        container.innerHTML = html;
    }
}

/* =====================================================================
 * 📌 ส่วนที่ 12: DASHBOARD CHARTS (ฟังก์ชันแผนภูมิบนแดชบอร์ด)
 * ===================================================================== */
function checkAndRenderCharts() {
    if (!tableCache['staff'] || !tableCache['Fingerprint_Logs']) return;

    let staffData = tableCache['staff'].data;
    let logData = tableCache['Fingerprint_Logs'].data;
    let leaveData = tableCache['Leave application'] ? tableCache['Leave application'].data : [];

    let activeStaffIds = [];
    let empNamesMapFull = {};
    staffData.forEach(s => {
        let st = String(getFuzzyValue(s, ['status', 'สถานะ'])).toLowerCase();
        let eId = String(getFuzzyValue(s, ['employee_id', 'emp_id'])).toUpperCase().trim();
        let name = getFuzzyValue(s, ['first_name', 'name', 'full_name', 'ชื่อ']);
        if (st.includes('active') || st === '-' || st === '') {
            if (eId && eId !== '-') {
                activeStaffIds.push(eId);
                empNamesMapFull[eId] = name !== '-' ? name : eId;
            }
        }
    });

    let staffCount = activeStaffIds.length;
    let staffEl = document.getElementById('dash-staff');
    if (staffEl) staffEl.innerText = staffCount;

    let startRangeStr = (typeof dashCalStartDateStr !== 'undefined' && dashCalStartDateStr) ? dashCalStartDateStr : new Date().toISOString().slice(0, 10);
    let endRangeStr = (typeof dashCalEndDateStr !== 'undefined' && dashCalEndDateStr) ? dashCalEndDateStr : startRangeStr;

    const tStartObj = new Date(startRangeStr);
    tStartObj.setHours(0, 0, 0, 0);
    const tEndObj = new Date(endRangeStr);
    tEndObj.setHours(0, 0, 0, 0);

    let sumLate = 0, sumEarly = 0, sumOT = 0;
    let presentSet = new Set();

    logData.forEach(l => {
        let rDateStr = getFuzzyValue(l, ['date', 'วันที่']);
        if (!rDateStr || rDateStr === '-') return;

        let d = new Date(rDateStr);
        if (isNaN(d.getTime())) {
            let parts = String(rDateStr).split(/[\/\-]/);
            if (parts.length === 3) {
                if (parts[2].length === 4) d = new Date(`${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`);
                else if (parts[0].length === 4) d = new Date(`${parts[0]}-${parts[1].padStart(2, '0')}-${parts[2].padStart(2, '0')}`);
            }
        }

        if (d && !isNaN(d.getTime())) {
            d.setHours(0, 0, 0, 0);
            if (d.getTime() >= tStartObj.getTime() && d.getTime() <= tEndObj.getTime()) {
                let eId = String(getFuzzyValue(l, ['employee_id', 'emp_id'])).toUpperCase().trim();
                let status = String(getFuzzyValue(l, ['attendance_status', 'status', 'สถานะ'])).toLowerCase();

                if (!status.includes('missing') && !status.includes('absent') && !status.includes('ขาด')) {
                    presentSet.add(eId);
                }

                sumLate += parseFloat(getFuzzyValue(l, ['late_hours', 'มาช้า'])) || 0;
                sumEarly += parseFloat(getFuzzyValue(l, ['early_leave_hours', 'กลับก่อน'])) || 0;
                sumOT += parseFloat(getFuzzyValue(l, ['ot_amount', 'ยอดเงินโอที'])) || 0;
            }
        }
    });

    let presentCount = presentSet.size;

    let sumAbsent = 0;
    let absentListHTML = '';
    let leaveListHTML = '';
    let presentListHTML = '';
    let absentDetailsCount = 0;
    let leaveDetailsCount = 0;
    let presentDetailsCount = 0;

    let allLeavesForDay = [];
    leaveData.forEach(r => {
        let empId = String(getFuzzyValue(r, ['employee_id', 'emp_id'])).toUpperCase().trim();
        let lStartStr = getFuzzyValue(r, ['start_date', 'เริ่ม']);
        let lEndStr = getFuzzyValue(r, ['end_date', 'สิ้นสุด']);
        let dStart = parseDateStr(lStartStr);
        let dEnd = parseDateStr(lEndStr);
        if (dStart && dEnd) {
            let ds = new Date(dStart); ds.setHours(0, 0, 0, 0);
            let de = new Date(dEnd); de.setHours(0, 0, 0, 0);
            if (ds.getTime() <= tEndObj.getTime() && de.getTime() >= tStartObj.getTime()) {
                allLeavesForDay.push({ ...r, _empId: empId });
            }
        }
    });

    let displayDateStr = "";
    if (startRangeStr === endRangeStr) {
        displayDateStr = `${String(tStartObj.getDate()).padStart(2, '0')}/${String(tStartObj.getMonth() + 1).padStart(2, '0')}/${tStartObj.getFullYear()}`;
    } else {
        displayDateStr = `${String(tStartObj.getDate()).padStart(2, '0')}/${String(tStartObj.getMonth() + 1).padStart(2, '0')}/${tStartObj.getFullYear()} - ${String(tEndObj.getDate()).padStart(2, '0')}/${String(tEndObj.getMonth() + 1).padStart(2, '0')}/${tEndObj.getFullYear()}`;
    }

    allLeavesForDay.forEach(lv => {
        let empId = lv._empId;
        let empName = empNamesMapFull[empId] || empId;
        let leaveType = getFuzzyValue(lv, ['type', 'ประเภท', 'ประเภทการลา']) || 'Leave';
        let rawStatus = String(getFuzzyValue(lv, ['signature', 'status', 'อนุมัติ', 'approval_status']) || '').toLowerCase();
        let leaveStart = getFuzzyValue(lv, ['start_date', 'เริ่ม']);
        let leaveEnd = getFuzzyValue(lv, ['end_date', 'สิ้นสุด']);

        let statusBadge = '';
        let dotColor = 'bg-gray-400';
        if (rawStatus.includes('approve') || rawStatus.includes('hr') || rawStatus.includes('อนุมัติ') || rawStatus.includes('อนุญาต')) {
            statusBadge = `<span class="text-[9px] bg-emerald-50 text-emerald-600 px-2 py-1 rounded-md font-bold border border-emerald-200 tracking-widest uppercase flex items-center gap-1"><i class="fa-solid fa-check"></i> ${t('status_approved')}</span>`;
            dotColor = 'bg-emerald-400';
        } else if (rawStatus.includes('reject') || rawStatus.includes('ปฏิเสธ') || rawStatus.includes('ไม่อนุมัติ') || rawStatus.includes('denied')) {
            statusBadge = `<span class="text-[9px] bg-red-50 text-red-500 px-2 py-1 rounded-md font-bold border border-red-100 tracking-widest uppercase flex items-center gap-1"><i class="fa-solid fa-times"></i> ${t('status_rejected')}</span>`;
            dotColor = 'bg-red-400';
        } else {
            statusBadge = `<span class="text-[9px] bg-amber-50 text-amber-500 px-2 py-1 rounded-md font-bold border border-amber-200 tracking-widest uppercase flex items-center gap-1"><i class="fa-solid fa-clock"></i> ${t('status_pending')}</span>`;
            dotColor = 'bg-amber-400';
        }

        leaveListHTML += `<li class="flex items-start justify-between py-2.5 px-3 rounded-xl border border-gray-100 bg-white hover:shadow-sm transition-all mb-1.5">
                    <div class="flex flex-col gap-1 min-w-0 flex-1">
                        <div class="flex items-center justify-between gap-2">
                            <div class="flex items-center gap-2 min-w-0">
                                <span class="w-2 h-2 rounded-full ${dotColor} flex-shrink-0"></span>
                                <span class="text-sm font-black text-gray-900 truncate">${empName}</span>
                            </div>
                            ${statusBadge}
                        </div>
                        <div class="flex items-center gap-2 pl-4 text-[10px] text-gray-400 font-medium flex-wrap">
                            <span class="bg-gray-50 px-1.5 py-0.5 rounded text-[9px] font-bold text-gray-600 border border-gray-200">${leaveType}</span>
                            <span>${leaveStart} – ${leaveEnd}</span>
                        </div>
                    </div>
                </li>`;
        leaveDetailsCount++;
    });

    activeStaffIds.forEach(empId => {
        let empName = empNamesMapFull[empId] || empId;
        let isOnLeave = allLeavesForDay.some(lv => {
            if (lv._empId !== empId) return false;
            let rawStatus = String(getFuzzyValue(lv, ['signature', 'status', 'อนุมัติ', 'approval_status']) || '').toLowerCase();
            return !rawStatus.includes('reject') && !rawStatus.includes('ปฏิเสธ') && !rawStatus.includes('ไม่อนุมัติ') && !rawStatus.includes('denied');
        });

        if (presentSet.has(empId)) {
            let logEntry = logData.find(l => {
                let rDateStr = getFuzzyValue(l, ['date', 'วันที่']);
                let d = parseDateStr(rDateStr);
                if (!d) return false;
                d.setHours(0, 0, 0, 0);
                let empCheck = String(getFuzzyValue(l, ['employee_id', 'emp_id'])).toUpperCase().trim();
                return d.getTime() >= tStartObj.getTime() && d.getTime() <= tEndObj.getTime() && empCheck === empId;
            });
            let checkIn = logEntry ? (getFuzzyValue(logEntry, ['check_in', 'เวลาเข้า', 'checkin']) || '-') : '-';
            let checkOut = logEntry ? (getFuzzyValue(logEntry, ['check_out', 'เวลาออก', 'checkout']) || '-') : '-';
            let lateHrs = logEntry ? (parseFloat(getFuzzyValue(logEntry, ['late_hours', 'มาช้า'])) || 0) : 0;
            let lateTag = lateHrs > 0 ? `<span class="text-[9px] bg-orange-50 text-orange-500 px-1.5 py-0.5 rounded border border-orange-100 font-bold ml-1">${t('status_late')} ${lateHrs}h</span>` : '';

            presentListHTML += `<li class="flex items-center justify-between py-2 px-3 rounded-xl hover:bg-emerald-50 transition-colors border border-transparent hover:border-emerald-100">
                        <div class="flex items-center gap-2.5 min-w-0">
                            <span class="w-2 h-2 rounded-full bg-emerald-500 flex-shrink-0"></span>
                            <div class="min-w-0">
                                <p class="text-sm font-black text-gray-900 leading-tight truncate">${empName} ${lateTag}</p>
                                <p class="text-[10px] text-gray-400 font-medium mt-0.5">In: ${checkIn} &nbsp;|&nbsp; Out: ${checkOut}</p>
                            </div>
                        </div>
                        <div class="flex items-center space-x-3">
                            <span class="text-[9px] bg-emerald-50 text-emerald-600 px-2 py-1 rounded-md font-bold border border-emerald-200 tracking-widest uppercase flex-shrink-0">${t('status_present')}</span>
                        </div>
                    </li>`;
            presentDetailsCount++;
        } else if (!isOnLeave) {
            let todayObj = new Date();
            todayObj.setHours(0, 0, 0, 0);
            if (tStartObj <= todayObj && tStartObj.getDay() !== 0) {
                sumAbsent++;
                absentListHTML += `<li class="flex items-center justify-between py-3 px-4 rounded-2xl hover:bg-gray-50 transition-colors border border-transparent hover:border-gray-100">
                                <div class="flex items-center gap-3">
                                    <span class="w-2 h-2 rounded-full bg-red-500 flex-shrink-0"></span>
                                    <span class="text-sm font-black text-gray-900">${empName}</span>
                                </div>
                                <span class="text-[9px] bg-red-50 text-red-500 px-3 py-1 rounded-lg font-bold uppercase border border-red-100 tracking-widest">${t('status_absent')}</span>
                            </li>`;
                absentDetailsCount++;
            }
        }
    });

    const sectionContainer = document.getElementById('dashboard-absent-leave-section');
    const absentUl = document.getElementById('dash-absent-list');
    const leaveUl = document.getElementById('dash-leave-list');
    const presentUl = document.getElementById('dash-present-list');

    if (sectionContainer) {
        sectionContainer.classList.remove('hidden');
        sectionContainer.classList.add('grid', 'grid-cols-1', 'lg:grid-cols-3');
    }

    if (presentUl) {
        if (presentDetailsCount > 0) presentUl.innerHTML = presentListHTML;
        else presentUl.innerHTML = `<li class="py-8 text-center text-gray-400 text-xs font-medium border border-dashed border-gray-200 rounded-xl bg-gray-50 flex flex-col items-center justify-center"><i class="fa-solid fa-door-open text-2xl mb-2 text-gray-300"></i> ${t('no_present_staff')}</li>`;
    }
    const presentBadge = document.getElementById('dash-present-count-badge');
    if (presentBadge) presentBadge.innerText = `${presentDetailsCount} ${t('people_unit')}`;

    if (absentUl) {
        if (absentDetailsCount > 0) absentUl.innerHTML = absentListHTML;
        else absentUl.innerHTML = `<li class="py-8 text-center text-gray-400 text-xs font-medium border border-dashed border-gray-200 rounded-xl bg-gray-50 flex flex-col items-center justify-center"><i class="fa-solid fa-user-check text-2xl mb-2 text-gray-300"></i> ${t('no_absent_staff')} 🎉</li>`;
    }
    const absentBadge = document.getElementById('dash-absent-count-badge');
    if (absentBadge) absentBadge.innerText = `${absentDetailsCount} ${t('people_unit')}`;

    if (leaveUl) {
        if (leaveDetailsCount > 0) leaveUl.innerHTML = leaveListHTML;
        else leaveUl.innerHTML = `<li class="py-8 text-center text-gray-400 text-xs font-medium border border-dashed border-gray-200 rounded-xl bg-gray-50 flex flex-col items-center justify-center"><i class="fa-solid fa-clipboard-check text-2xl mb-2 text-gray-300"></i> ${t('no_leave_records')}</li>`;
    }
    const leaveBadge = document.getElementById('dash-leave-count-badge');
    if (leaveBadge) leaveBadge.innerText = `${leaveDetailsCount} ${t('people_unit')}`;

    const safeUpdate = (id, val) => { const el = document.getElementById(id); if (el) el.innerText = val; };
    safeUpdate('dash-logs', presentCount);
    safeUpdate('dash-late', (Math.round(sumLate * 100) / 100));
    safeUpdate('dash-early', (Math.round(sumEarly * 100) / 100));
    safeUpdate('dash-absent', sumAbsent);
    safeUpdate('dash-overview-absent', sumAbsent);
    safeUpdate('dash-ot', new Intl.NumberFormat('th-TH').format(sumOT));
    safeUpdate('dash-leaves', leaveDetailsCount);

    if (typeof updateAttendanceRateChart === 'function') updateAttendanceRateChart(staffCount, presentCount);

    let currentMonth = tStartObj.getMonth() + 1;
    let birthdaysHtml = '';
    let bdCount = 0;

    staffData.forEach(s => {
        let dob = getFuzzyValue(s, ['birth_date', 'birthdate', 'birth date', 'dob', 'birthday', 'วันเกิด', 'วัน/เดือน/ปีเกิด']);
        if (dob && dob !== '-') {
            let d = null;
            let dobStr = String(dob).trim();

            let ddmmyyyy = dobStr.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/);
            if (ddmmyyyy) {
                d = new Date(`${ddmmyyyy[3]}-${ddmmyyyy[2].padStart(2, '0')}-${ddmmyyyy[1].padStart(2, '0')}`);
            } else {
                let yyyymmdd = dobStr.match(/^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})/);
                if (yyyymmdd) d = new Date(`${yyyymmdd[1]}-${yyyymmdd[2].padStart(2, '0')}-${yyyymmdd[3].padStart(2, '0')}`);
                else d = new Date(dobStr);
            }

            if (d && !isNaN(d.getTime()) && (d.getMonth() + 1) === currentMonth) {
                let name = getFuzzyValue(s, ['name', 'full_name', 'ชื่อ-นามสกุล', 'first_name', 'ชื่อ']);
                let pic = getFuzzyValue(s, ['profile', 'รูป', 'pic', 'image']);
                if (!pic || pic === '-') pic = `https://ui-avatars.com/api/?background=fce7f3&color=be185d&name=${name}`;

                const engMonths = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
                let bdDisplay = `${d.getDate()} ${engMonths[d.getMonth()]}`;

                birthdaysHtml += `
                            <div class="flex items-center space-x-4 p-3 hover:bg-gray-50 rounded-xl transition-colors border border-transparent hover:border-gray-100 group w-full">
                                <img src="${pic}" class="w-10 h-10 rounded-full object-cover border border-gray-200 shadow-sm group-hover:border-pink-400 transition-colors" onerror="this.src='https://ui-avatars.com/api/?background=fce7f3&color=be185d&name=NA'">
                                <div class="flex-1 min-w-0 text-left">
                                    <p class="text-sm font-bold text-gray-900 leading-tight truncate" title="${name}">${name}</p>
                                    <p class="text-[11px] text-pink-500 font-bold mt-1 tracking-wider uppercase">${bdDisplay}</p>
                                </div>
                            </div>
                        `;
                bdCount++;
            }
        }
    });

    const bdContainer = document.getElementById('dashboard-birthdays');
    if (bdContainer) {
        if (bdCount === 0) {
            bdContainer.innerHTML = `<p class="text-xs text-gray-500 text-center py-6 bg-gray-50 rounded-xl border border-dashed border-gray-200 font-medium">${t('no_birthdays')}</p>`;
        } else {
            bdContainer.classList.remove('justify-center', 'items-center');
            bdContainer.innerHTML = birthdaysHtml;
        }
    }
}

function updateAttendanceRateChart(totalStaff, presentCount) {
    const ctx = document.getElementById('attendanceRateChart');
    const percentText = document.getElementById('dash-attendance-percent');

    let total = parseInt(totalStaff) || 0;
    let present = parseInt(presentCount) || 0;
    let percent = total > 0 ? Math.round((present / total) * 100) : 0;
    if (percent > 100) percent = 100;

    if (percentText) percentText.innerText = percent + '%';
    if (!ctx) return;

    if (window.attChartInstance) {
        window.attChartInstance.destroy();
        window.attChartInstance = null;
    }

    let absent = Math.max(0, total - present);

    try {
        window.attChartInstance = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: [t('status_present'), t('status_absent_leave')],
                datasets: [{
                    data: total > 0 ? [present, absent] : [0, 1],
                    backgroundColor: total > 0 ? ['#7c50ff', '#e2e8f0'] : ['#e2e8f0', '#e2e8f0'],
                    borderWidth: 0,
                    cutout: '80%'
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { display: false }, tooltip: { enabled: false } },
                animation: { animateScale: true, animateRotate: true }
            }
        });
    } catch (e) { console.warn('Chart error:', e); }
}

function renderDashboardTopRatings() {
    const container = document.getElementById('dashboard-top-ratings');
    if (!container) return;

    if (!tableCache['Employees Ranting '] && !tableCache['Employees Ranting'] && !tableCache['Employees Rating'] && !tableCache['employees_rating']) {
        container.innerHTML = `<p class="text-sm text-white/50 text-center py-4"><i class="fa-solid fa-spinner fa-spin mr-2"></i>${t('loading_star_data')}</p>`;
        google.script.run.withSuccessHandler(res => {
            if (res && res.success) {
                const cleaned = { headers: res.headers || [], data: res.data || [] };
                tableCache['Employees Ranting '] = cleaned;
                tableCache['Employees Ranting'] = cleaned;
                tableCache['Employees Rating'] = cleaned;
                tableCache['employees_rating'] = cleaned;
                renderDashboardTopRatings();
            } else {
                container.innerHTML = `<p class="text-sm text-white/50 text-center py-4">${t('no_evaluation_data')}</p>`;
            }
        }).withFailureHandler(() => {
            container.innerHTML = `<p class="text-sm text-red-300 text-center py-4">${t('load_data_failed')}</p>`;
        }).getSheetData('Employees Ranting ');
        return;
    }

    let ratingData = (tableCache['Employees Ranting '] || tableCache['Employees Ranting'] || tableCache['Employees Rating'] || tableCache['employees_rating'])?.data || [];

    if (!ratingData.length) {
        container.innerHTML = `<p class="text-sm text-white/50 text-center py-4">${t('no_star_eval_data')}</p>`;
        return;
    }

    let empStats = {};
    ratingData.forEach(row => {
        let empId = String(getFuzzyValue(row, ['Employees Id', 'employees id', 'emp_id', 'employee_id', 'Employees_Id'])).toUpperCase().trim();
        if (!empId || empId === '-') return;

        let name = getFuzzyValue(row, ['Employees Name', 'employees name', 'name', 'ชื่อ', 'full_name']) || empId;
        let stars = parseFloat(getFuzzyValue(row, ['Star Point', 'star point', 'star_point', 'rating', 'score', 'ดาว'])) || 0;

        if (!empStats[empId]) empStats[empId] = { id: empId, name: name, totalStars: 0, count: 0 };
        empStats[empId].totalStars += stars;
        empStats[empId].count += 1;
    });

    let sorted = Object.values(empStats).map(e => ({
        ...e, avg: e.count > 0 ? e.totalStars / e.count : 0
    })).sort((a, b) => b.avg - a.avg || b.count - a.count);

    let top3 = sorted.slice(0, 3);
    if (!top3.length) {
        container.innerHTML = '<p class="text-sm text-white/50 text-center py-4">ยังไม่มีข้อมูลการประเมินดาว</p>';
        return;
    }

    const medals = [
        '<i class="fa-solid fa-medal text-yellow-400 text-2xl drop-shadow-md"></i>',
        '<i class="fa-solid fa-medal text-gray-300 text-xl drop-shadow-sm"></i>',
        '<i class="fa-solid fa-medal text-amber-600 text-lg drop-shadow-sm"></i>'
    ];
    const starColors = ['text-yellow-400', 'text-gray-300', 'text-amber-500'];

    let html = '';
    top3.forEach((emp, i) => {
        let picUrl = `https://ui-avatars.com/api/?background=ffffff&color=211252&name=${encodeURIComponent(emp.name)}&bold=true`;
        let staffData = (tableCache['staff'] || tableCache['Staff'])?.data;
        if (staffData) {
            let sRow = staffData.find(r => String(getFuzzyValue(r, ['employee_id', 'emp_id'])).toUpperCase().trim() === emp.id);
            if (sRow) {
                let photo = getFuzzyValue(sRow, ['Photos', 'photos', 'photo', 'profile', 'รูป', 'pic']);
                if (photo && photo !== '-') {
                    if (photo.includes('drive.google.com')) {
                        let fid = photo.includes('id=') ? photo.split('id=')[1].split('&')[0] :
                            (photo.includes('/d/') ? photo.split('/d/')[1].split('/')[0] : '');
                        if (fid) photo = 'https://drive.google.com/thumbnail?id=' + fid + '&sz=w100';
                    }
                    picUrl = photo;
                }
            }
        }

        let starsHtml = '';
        let fullStars = Math.floor(emp.avg);
        let halfStar = (emp.avg - fullStars) >= 0.5;
        for (let s = 0; s < 5; s++) {
            if (s < fullStars) starsHtml += `<i class="fa-solid fa-star ${starColors[i] || 'text-yellow-400'} text-xs"></i>`;
            else if (s === fullStars && halfStar) starsHtml += `<i class="fa-solid fa-star-half-stroke ${starColors[i] || 'text-yellow-400'} text-xs"></i>`;
            else starsHtml += `<i class="fa-regular fa-star text-white/20 text-xs"></i>`;
        }

        html += `
                <div class="flex items-center justify-between p-3 rounded-2xl bg-white/5 border border-white/10 hover:bg-white/10 transition-colors mb-2 last:mb-0">
                    <div class="flex items-center gap-3 min-w-0">
                        <div class="w-8 flex-shrink-0 flex justify-center">${medals[i] || ''}</div>
                        <img src="${picUrl}" class="w-10 h-10 rounded-full object-cover border-2 border-white/20 flex-shrink-0" onerror="this.src='https://ui-avatars.com/api/?background=ffffff&color=211252&name=${encodeURIComponent(emp.name)}'">
                        <div class="min-w-0">
                            <p class="text-sm font-bold text-white leading-tight truncate">${emp.name}</p>
                            <p class="text-[10px] text-white/50 tracking-wider">${emp.id}</p>
                        </div>
                    </div>
                    <div class="flex flex-col items-end flex-shrink-0 ml-2">
                        <div class="flex items-center gap-0.5 mb-1">${starsHtml}</div>
                        <span class="text-[10px] ${starColors[i] || 'text-yellow-400'} font-black">${emp.avg.toFixed(1)} ⭐</span>
                        <span class="text-[9px] text-white/40">${emp.count} รีวิว</span>
                    </div>
                </div>`;
    });

    container.innerHTML = html;

    if (typeof renderEmployeeMonthChart === 'function') renderEmployeeMonthChart();
}

function renderEmployeeMonthChart() {
    const ctx = document.getElementById('employeeMonthChart');
    if (!ctx) return;

    if (!tableCache['staff'] || !tableCache['Fingerprint_Logs']) return;

    let staffData = tableCache['staff'].data;
    let logData = tableCache['Fingerprint_Logs'].data;
    let leaveData = tableCache['Leave application'] ? tableCache['Leave application'].data : [];

    let activeStaff = [];
    staffData.forEach(s => {
        let st = String(getFuzzyValue(s, ['status', 'สถานะ'])).toLowerCase();
        let eId = String(getFuzzyValue(s, ['employee_id', 'emp_id'])).toUpperCase().trim();
        let name = getFuzzyValue(s, ['first_name', 'name', 'full_name', 'ชื่อ']);
        if (st.includes('active') || st === '-' || st === '') {
            if (eId && eId !== '-') {
                activeStaff.push({ id: eId, name: name !== '-' ? name : eId });
            }
        }
    });

    const targetDateStr = (typeof dashCalStartDateStr !== 'undefined' && dashCalStartDateStr) ? dashCalStartDateStr : new Date().toISOString().slice(0, 10);
    const tDateObj = new Date(targetDateStr);
    const targetYear = tDateObj.getFullYear();
    const targetMonth = tDateObj.getMonth();

    let approvedLeaves = leaveData.filter(r => {
        let status = String(getFuzzyValue(r, ['signature', 'status', 'อนุมัติ'])).toLowerCase();
        return status.includes('approve') || status.includes('hr') || status.includes('อนุมัติ') || status.includes('อนุญาต');
    });

    let lastDay = new Date(targetYear, targetMonth + 1, 0).getDate();
    let today = new Date();
    if (today.getFullYear() === targetYear && today.getMonth() === targetMonth) {
        lastDay = today.getDate();
    }

    let evaluationDays = [];
    for (let d = 1; d <= lastDay; d++) {
        let date = new Date(targetYear, targetMonth, d);
        if (date.getDay() !== 0) {
            evaluationDays.push(date);
        }
    }

    if (evaluationDays.length === 0) return;

    let logLookup = {};
    logData.forEach(l => {
        let rDateStr = getFuzzyValue(l, ['date', 'วันที่']);
        let dObj = parseDateStr(rDateStr);
        if (dObj && dObj.getFullYear() === targetYear && dObj.getMonth() === targetMonth) {
            let empId = String(getFuzzyValue(l, ['employee_id', 'emp_id'])).toUpperCase().trim();
            let dateKey = dObj.toISOString().slice(0, 10);
            logLookup[`${empId}_${dateKey}`] = l;
        }
    });

    let leaveLookup = {};
    approvedLeaves.forEach(lv => {
        let empId = String(getFuzzyValue(lv, ['employee_id', 'emp_id'])).toUpperCase().trim();
        let lStartStr = getFuzzyValue(lv, ['start_date', 'เริ่ม']);
        let lEndStr = getFuzzyValue(lv, ['end_date', 'สิ้นสุด']);
        let dStart = parseDateStr(lStartStr);
        let dEnd = parseDateStr(lEndStr);
        if (dStart && dEnd) {
            let cur = new Date(dStart);
            while (cur <= dEnd) {
                if (cur.getFullYear() === targetYear && cur.getMonth() === targetMonth) {
                    let dateKey = cur.toISOString().slice(0, 10);
                    leaveLookup[`${empId}_${dateKey}`] = true;
                }
                cur.setDate(cur.getDate() + 1);
            }
        }
    });

    let sortedData = activeStaff.map(emp => {
        let perfectDays = 0;
        evaluationDays.forEach(date => {
            let dateKey = date.toISOString().slice(0, 10);
            let empId = emp.id;
            let logKey = `${empId}_${dateKey}`;
            let leaveKey = `${empId}_${dateKey}`;

            let hasLeave = leaveLookup[leaveKey] || false;
            let log = logLookup[logKey];

            if (!hasLeave && log) {
                let status = String(getFuzzyValue(log, ['attendance_status', 'status', 'สถานะ'])).toLowerCase();
                let isAbsent = status.includes('missing') || status.includes('absent') || status.includes('ขาด');
                if (!isAbsent) {
                    let lateHours = parseFloat(getFuzzyValue(log, ['late_hours', 'มาช้า'])) || 0;
                    let earlyHours = parseFloat(getFuzzyValue(log, ['early_leave_hours', 'กลับก่อน'])) || 0;
                    if (lateHours <= 0 && earlyHours <= 0) {
                        perfectDays++;
                    }
                }
            }
        });

        let attendanceRate = Math.round((perfectDays / evaluationDays.length) * 100);
        return {
            id: emp.id,
            name: emp.name,
            rate: attendanceRate,
            perfect: perfectDays,
            total: evaluationDays.length
        };
    });

    sortedData.sort((a, b) => b.rate - a.rate || b.perfect - a.perfect);

    let top10 = sortedData.slice(0, 10);
    if (top10.length === 0) return;

    if (employeeMonthChartInst) {
        employeeMonthChartInst.destroy();
        employeeMonthChartInst = null;
    }

    let labels = top10.map(d => `${d.id} (${d.rate}%)`);
    let data = top10.map(d => d.rate);

    employeeMonthChartInst = new Chart(ctx, {
        type: 'bar',
        data: {
            labels,
            datasets: [{
                data,
                backgroundColor: '#ffffff',
                borderRadius: { topLeft: 8, topRight: 8 },
                barPercentage: 0.7,
                borderSkipped: false
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                x: {
                    grid: { display: false },
                    ticks: { color: '#ffffff', font: { size: 10, weight: 'bold' } },
                    border: { color: '#ffffff', width: 2 }
                },
                y: {
                    display: false,
                    min: 0,
                    max: 100
                }
            },
            plugins: {
                legend: { display: false },
                tooltip: {
                    enabled: true,
                    callbacks: {
                        label: function (context) {
                            let emp = top10[context.dataIndex];
                            return ` อัตราเข้างานปกติ: ${emp.rate}% (${emp.perfect}/${emp.total} วัน)`;
                        }
                    }
                }
            },
            animation: { duration: 800 }
        }
    });
}

function renderDashboardRecentCards(cards) {
    const container = document.getElementById('dash-recent-cards');
    const section = document.getElementById('dashboard-recent-cards-section');

    if (!container || !section) return;

    if (!cards || cards.length === 0) {
        section.classList.add('hidden');
        return;
    }
    section.classList.remove('hidden');
    document.getElementById('dashboard-recent-cards-section').classList.remove('hidden');

    let html = '';
    cards.forEach(row => {
        let sheetType = row._sheetType;
        let title = getFuzzyValue(row, ['course', 'หลักสูตร', 'subject', 'หัวข้อ', 'name', 'ชื่อ', 'asset', 'ทรัพย์สิน'], 1) || 'ไม่ระบุชื่อ';
        let detail1 = getFuzzyValue(row, ['date', 'วันที่', 'เวลา', 'issue'], 2);
        let status = getFuzzyValue(row, ['status', 'สถานะ']);
        let detail2 = getFuzzyValue(row, ['trainer', 'วิทยากร', 'ผู้สอน', 'employee', 'ผู้ถือครอง'], 3);

        let statusLower = String(status).toLowerCase();
        let badgeColor = 'bg-gray-100 text-gray-600 border-gray-200';
        let icon = 'fa-circle-info';

        if (statusLower.includes('complete') || statusLower.includes('เสร็จ') || statusLower.includes('ผ่าน') || statusLower === 'active') { badgeColor = 'bg-emerald-50 text-emerald-600 border-emerald-200'; icon = 'fa-check-circle'; }
        else if (statusLower.includes('ongoing') || statusLower.includes('กำลัง') || statusLower.includes('ซ่อม')) { badgeColor = 'bg-indigo-50 text-brandindigo border-indigo-200'; icon = 'fa-spinner fa-spin'; }
        else if (statusLower.includes('upcoming') || statusLower.includes('รอ') || statusLower.includes('pending')) { badgeColor = 'bg-amber-50 text-amber-600 border-amber-200'; icon = 'fa-clock'; }
        else if (statusLower.includes('cancel') || statusLower.includes('ยกเลิก') || statusLower.includes('inactive')) { badgeColor = 'bg-red-50 text-red-600 border-red-200'; icon = 'fa-times-circle'; }

        let iconTheme = sheetType === 'Training' ? 'fa-person-chalkboard' : 'fa-laptop';

        html += `
                <div class="glass-card rounded-2xl hover:border-indigo-300 hover:shadow-lg transition-all duration-300 overflow-hidden flex flex-col relative transform hover:-translate-y-1 cursor-pointer group" onclick="navigate('table', '${sheetType === 'Training' ? 'Training' : 'Assets'}', '${sheetType}')">
                    <div class="h-1.5 w-full ${badgeColor.split(' ')[0]}"></div>
                    <div class="p-5 flex-1 flex flex-col justify-between">
                        <div>
                            <div class="mb-3 flex justify-between items-center">
                                <span class="px-2.5 py-1 rounded-md text-[10px] font-bold border uppercase tracking-widest ${badgeColor} inline-flex items-center">
                                    <i class="fa-solid ${icon} mr-1.5"></i> ${status || 'N/A'}
                                </span>
                                <span class="text-[10px] text-gray-400 font-bold uppercase tracking-widest">${sheetType === 'Training' ? 'TRN' : 'AST'}</span>
                            </div>
                            <h4 class="text-sm font-bold text-gray-900 mb-4 leading-snug line-clamp-2 group-hover:text-brandindigo transition-colors" title="${title}">${title}</h4>
                        </div>
                        <div class="space-y-2 mt-auto pt-4 border-t border-gray-100 text-xs text-gray-500 font-medium">
                            <p class="flex items-start"><i class="fa-regular fa-calendar mt-0.5 mr-2.5 text-gray-400 w-3 text-center"></i> <span class="truncate">${detail1}</span></p>
                            <p class="flex items-start"><i class="fa-solid ${iconTheme} mt-0.5 mr-2.5 text-gray-400 w-3 text-center"></i> <span class="truncate">${detail2}</span></p>
                        </div>
                    </div>
                </div>`;
    });
    container.innerHTML = html;
}

function renderDashboardPendingLeaves(pendingData) {
    const tHead = document.getElementById('dash-pending-head');
    const tBody = document.getElementById('dash-pending-body');

    if (!tHead || !tBody) return;

    if (!pendingData || pendingData.length === 0) {
        tHead.innerHTML = '';
        tBody.innerHTML = '<tr><td class="text-center py-10 text-gray-500 font-medium">🎉 No pending requests. You are all caught up!</td></tr>';
        return;
    }

    const headers = Object.keys(pendingData[0]);

    const exactOrder = [
        'id', 'leave_id', 'id_leave', 'employee_id', 'emp_id',
        'prefix', 'first_name', 'name', 'full_name', 'ชื่อ', 'last_name', 'นามสกุล',
        'type', 'ประเภท', 'ประเภทการลา',
        'start_date', 'เริ่ม',
        'end_date', 'สิ้นสุด',
        'total_days', 'รวม', 'จำนวนวัน',
        'object', 'reason', 'เหตุผล',
        'contact', 'ติดต่อ',
        'work handover', 'work_handover', 'ผู้รับมอบ'
    ];

    headers.sort((a, b) => {
        let aLower = a.toLowerCase().trim();
        let bLower = b.toLowerCase().trim();
        let idxA = exactOrder.findIndex(k => aLower === k || aLower.includes(k));
        let idxB = exactOrder.findIndex(k => bLower === k || bLower.includes(k));
        if (idxA === -1) idxA = 999;
        if (idxB === -1) idxB = 999;
        return idxA - idxB;
    });

    let trHead = '<tr>';
    headers.forEach(h => {
        if (h.toLowerCase() !== 'signature' && h.toLowerCase() !== 'status') {
            trHead += `<th class="px-5 py-4 whitespace-nowrap font-bold tracking-wider">${h}</th>`;
        }
    });
    trHead += `<th class="px-5 py-4 whitespace-nowrap text-center sticky right-0 bg-gray-50 shadow-[-10px_0_15px_-5px_rgba(0,0,0,0.05)] border-l border-gray-200">Action</th></tr>`;
    tHead.innerHTML = trHead;

    let htmlRows = '';
    pendingData.forEach(row => {
        let tr = '<tr class="bg-white border-b border-gray-100 hover:bg-gray-50 transition-colors">';
        const rowId = getRecordId(row);

        let statusColName = headers.find(h => h.toLowerCase() === 'signature' || h.toLowerCase() === 'status') || 'Signature';

        headers.forEach(h => {
            if (h.toLowerCase() !== 'signature' && h.toLowerCase() !== 'status') {
                tr += `<td class="px-5 py-4 whitespace-nowrap font-medium text-gray-700">${escapeHtml(row[h] || '-')}</td>`;
            }
        });

        tr += `<td class="px-5 py-4 whitespace-nowrap text-center sticky right-0 bg-white shadow-[-10px_0_15px_-5px_rgba(0,0,0,0.05)] border-l border-gray-200 group-hover:bg-gray-50">
                    <div class="flex justify-center">
                        <select onchange="approveLeaveFromDashboard('${rowId}', '${statusColName}', this)" class="bg-white border border-gray-300 text-gray-900 text-xs font-bold rounded-lg focus:ring-brandindigo focus:border-brandindigo block py-2 px-3 cursor-pointer hover:bg-gray-50 outline-none transition-colors w-full min-w-[140px] shadow-sm">
                            <option value="" disabled selected>Action...</option>
                            <option value="HR Manager">Approve (Manager)</option>
                            <option value="HR Admin">Approve (Admin)</option>
                            <option value="Rejected">Reject</option>
                        </select>
                    </div>
                </td></tr>`;
        htmlRows += tr;
    });
    tBody.innerHTML = htmlRows;
}

function approveLeaveFromDashboard(id, colName, selectElement) {
    const status = selectElement.value;
    if (!status) return;

    let actionText = status === 'Rejected' ? 'Reject Request' : `Approve as ${status}`;
    let isDanger = status === 'Rejected';

    showConfirmModal(
        'Confirm Action',
        `Are you sure you want to <br><b class="${isDanger ? 'text-red-500' : 'text-brandindigo'} uppercase tracking-wide">"${actionText}"</b><br> this request?`,
        () => {
            toggleLoading(true, 'SAVING STATUS...');
            google.script.run
                .withSuccessHandler(res => {
                    toggleLoading(false);
                    if (res.success) {
                        showSuccessModal("Status Updated", "The leave request status has been saved.");
                        loadDashboard();
                        if (tableCache['Leave application']) delete tableCache['Leave application'];
                    } else showToast(res.message, 'error');
                })
                .withFailureHandler(err => {
                    toggleLoading(false);
                    showToast('Connection failed: ' + err.message, 'error');
                })
                .updateRecordData('Leave application', id, colName, status);
        },
        () => {
            selectElement.value = "";
        },
        isDanger
    );
}

function filterDataForUser(data) {
    const sessionStr = localStorage.getItem('hr_user_session') || sessionStorage.getItem('hr_user_session');
    let role = 'Staff', username = '', empId = '';
    if (sessionStr) {
        try {
            const sessionData = JSON.parse(sessionStr);
            role = sessionData.role || 'Staff';
            username = sessionData.username || '';
            empId = sessionData.empId || '';
        } catch (e) { }
    }

    if (role !== 'Staff') return data;

    if (currentSheet.includes('Ranting') || currentSheet.includes('Rating') || currentSheet === 'Announcements' || currentSheet === 'News' || currentSheet === 'Training' || currentSheet === 'Asset_Tracking' || currentSheet.trim() === 'Documents') {
        return data;
    }

    return data.filter(row => {
        let isOwner = false;
        const idCols = ['employee_id', 'id', 'log_id', 'full name', 'name', 'email', 'ชื่อ', 'ชื่อผู้ใช้งาน', 'employees id'];

        for (let key in row) {
            if (idCols.includes(String(key).toLowerCase().trim())) {
                let val = String(row[key]).toLowerCase().trim();
                let u = String(username).toLowerCase().trim();
                let eId = String(empId).toLowerCase().trim();
                if (val === u || (eId !== '' && val === eId)) { isOwner = true; break; }
            }
        }
        return isOwner;
    });
}

/* =====================================================================
 * 📅 Mini Calendar หน้า Dashboard
 * ===================================================================== */
function renderDashMiniCalendar() {
    const grid = document.getElementById('dash-mini-calendar-grid');
    const monthYearLabel = document.getElementById('dash-cal-month-year');
    if (!grid || !monthYearLabel) return;

    const year = dashCalDate.getFullYear();
    const month = dashCalDate.getMonth();
    const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

    if (monthYearLabel) monthYearLabel.innerText = `${monthNames[month]} ${year}`;

    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const today = new Date();
    const isCurrentMonth = (today.getFullYear() === year && today.getMonth() === month);
    const currentDay = today.getDate();

    let html = '';

    for (let i = 0; i < firstDay; i++) {
        html += `<div class="aspect-square flex items-center justify-center text-[10px] text-transparent">0</div>`;
    }

    for (let d = 1; d <= daysInMonth; d++) {
        let isToday = isCurrentMonth && d === currentDay;
        let currentDateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;

        let isStart = (dashCalStartDateStr === currentDateStr);
        let isEnd = (dashCalEndDateStr === currentDateStr);
        let isInRange = false;
        if (dashCalStartDateStr && dashCalEndDateStr) {
            isInRange = (currentDateStr >= dashCalStartDateStr && currentDateStr <= dashCalEndDateStr);
        }

        let baseClasses = "aspect-square flex items-center justify-center text-[10px] font-bold rounded-full transition-all cursor-pointer ";

        if (isStart || isEnd) {
            baseClasses += "bg-brandpurple text-white shadow-lg scale-110 ring-2 ring-purple-200";
        } else if (isInRange) {
            baseClasses += "bg-purple-100 text-brandpurple font-bold shadow-sm scale-105";
        } else if (isToday) {
            baseClasses += "bg-brandindigo text-white shadow-md";
        } else {
            baseClasses += "text-gray-600 hover:bg-indigo-50 hover:text-brandindigo";
        }

        html += `<div class="${baseClasses}" onclick="selectDashDate('${currentDateStr}')">${d}</div>`;
    }
    grid.innerHTML = html;
}

function changeDashMonth(offset) {
    dashCalDate.setMonth(dashCalDate.getMonth() + offset);
    renderDashMiniCalendar();
}

function selectDashDate(dateStr) {
    if (!dashCalStartDateStr || (dashCalStartDateStr && dashCalEndDateStr)) {
        dashCalStartDateStr = dateStr;
        dashCalEndDateStr = null;
    } else if (dashCalStartDateStr && !dashCalEndDateStr) {
        if (dateStr >= dashCalStartDateStr) {
            dashCalEndDateStr = dateStr;
        } else {
            dashCalStartDateStr = dateStr;
        }
    }

    let btnClear = document.getElementById('btn-clear-dash-date');
    if (btnClear) btnClear.classList.remove('hidden');

    renderDashMiniCalendar();
    loadDashboard();
}

// สั่งให้ปฏิทินวาดตัวเองทันทีเมื่อโหลดโค้ดเสร็จ
renderDashMiniCalendar();
