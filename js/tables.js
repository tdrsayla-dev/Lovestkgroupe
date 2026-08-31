// ─────────────────────────────────────────────────────────────────────────────
// js/tables.js - Table Rendering & Grid Formatter
// ─────────────────────────────────────────────────────────────────────────────

/* =====================================================================
 * 📌 ส่วนที่ 17: TABLE RENDERING (ฟังก์ชันตารางแสดงข้อมูล)
 * - แสดงตารางข้อมูลพนักงาน, การเข้างาน ฯลฯ และจัดการหน้าแบ่งข้อมูล (Pagination)
 * ===================================================================== */
function renderTable(data) {
    let sheetToRender = currentSheet;
    if (typeof data === 'string') {
        sheetToRender = data;
        data = null;
    }

    if (!Array.isArray(data)) {
        const cacheObj = tableCache[sheetToRender] || tableCache[currentSheet];
        data = cacheObj && Array.isArray(cacheObj.data) ? cacheObj.data : [];
    }

    const searchInput = document.getElementById('searchInput');
    const isSearching = searchInput && searchInput.value.trim() !== '';

    if (!isSearching && sheetToRender && (sheetToRender.toLowerCase() === 'user' || sheetToRender.toLowerCase() === 'users')) {
        const staffData = tableCache['staff'] && Array.isArray(tableCache['staff'].data) ? tableCache['staff'].data : [];
        const existingEmpIds = new Set(data.map(u => String(u.Employee_ID || u.employee_id || u.emp_id || u.Username || u.username || '').trim().toUpperCase()).filter(Boolean));
        
        staffData.forEach(stf => {
            const empId = String(stf.Employee_ID || stf.employee_id || stf.emp_id || '').trim().toUpperCase();
            if (empId && !existingEmpIds.has(empId)) {
                const email = stf.Email || stf.email || (empId.toLowerCase() + '@company.com');
                data.push({
                    Employee_ID: empId,
                    employee_id: empId,
                    Username: email,
                    username: email,
                    Password: '****',
                    Role: 'Staff',
                    role: 'Staff',
                    Permissions: 'Dashboard:view',
                    permissions: 'Dashboard:view'
                });
                existingEmpIds.add(empId);
            }
        });
    }
    document.getElementById('table-controls-wrapper').classList.remove('hidden');
    document.getElementById('org-chart-wrapper').classList.add('hidden');

    const sessionStr = localStorage.getItem('hr_user_session') || sessionStorage.getItem('hr_user_session');
    let role = 'Staff';
    let sessionEmpId = '';
    let userPerms = [];
    if (sessionStr) {
        try {
            let s = JSON.parse(sessionStr);
            role = s.role || 'Staff';
            sessionEmpId = String(s.empId || s.employeeId || s.username || '').trim().toUpperCase();
            if (s.permissions) userPerms = parsePermissionsList(s.permissions);
        } catch (e) { }
    }

    const isSuperAdmin = String(role).trim().toLowerCase() === 'super admin' || String(role).trim().toLowerCase() === 'superadmin';
    const isAttendanceLogs = (currentSheet === 'Fingerprint_Logs' || currentSheet === 'fingerprint_logs' || String(currentSheet).toLowerCase().includes('fingerprint') || String(currentSheet).toLowerCase().includes('attendance'));

    const isAdminUser = String(role).toLowerCase().includes('admin') || String(role).toLowerCase().includes('super');
    const canEdit = isAttendanceLogs ? isSuperAdmin : (isAdminUser || (typeof hasActionPermission === 'function' ? hasActionPermission(currentSheet, 'edit', userPerms) : (role !== 'Staff')));
    const canDelete = isAttendanceLogs ? isSuperAdmin : (isAdminUser || (typeof hasActionPermission === 'function' ? hasActionPermission(currentSheet, 'delete', userPerms) : (role !== 'Staff')));
    const canAdd = isAdminUser || (typeof hasActionPermission === 'function' ? (hasActionPermission(currentSheet, 'add', userPerms) || hasActionPermission(currentSheet, 'edit', userPerms)) : (role !== 'Staff' || currentSheet === 'Leave application' || currentSheet.includes('Budget')));

    const tHead = document.getElementById('table-head'), tBody = document.getElementById('table-body');
    const summaryDiv = document.getElementById('table-summary');
    const calSec = document.getElementById('calendar-section');
    const addDataBtn = document.getElementById('btn-add-record');
    const tableWrapper = document.getElementById('table-wrapper');
    const cardWrapper = document.getElementById('card-wrapper');

    const tableDateFilter = document.getElementById('table-date-filter');
    const totalCountDiv = document.getElementById('table-total-count');
    const totalDaysSpan = document.getElementById('display-total-days');
    const searchWrapper = document.getElementById('table-search-wrapper');

    tHead.innerHTML = '';

    // 📌 Logic สำหรับตารางประวัติการลงเวลา + ปฏิทิน
    if (currentSheet === 'Fingerprint_Logs') {
        if (typeof applyEmployeeShiftAssignmentsToLogs === 'function') {
            applyEmployeeShiftAssignmentsToLogs(data);
        }
        if (typeof updateAttendanceSubFeatureButtons === 'function') {
            updateAttendanceSubFeatureButtons();
        }
        summaryDiv.classList.remove('hidden');
        if (calSec) calSec.classList.remove('hidden');
        const deptBanner = document.getElementById('attendance-dept-banner');
        if (deptBanner) deptBanner.classList.remove('hidden');
        if (addDataBtn) addDataBtn.classList.add('hidden');
        if (searchWrapper) searchWrapper.classList.add('hidden');

        // 🏢 Render Department Filter Tabs (แท็บแผนกอิงตามพะแนกตัวจริง Department)
        if (typeof renderAttendanceDepartmentTabs === 'function') {
            renderAttendanceDepartmentTabs();
        }

        // 🏢 Department Filter (อิงตามรหัสพนักงาน Employee ID Prefix และ Department ตัวจริง)
        let deptFilter = window.activeAttendanceDept || (document.getElementById('attendance-dept-filter') ? document.getElementById('attendance-dept-filter').value : '') || 'all';
        if (deptFilter && deptFilter !== 'all') {
            const staffCache = tableCache['staff'] || tableCache['Staff'];
            const staffData = (staffCache && Array.isArray(staffCache.data)) ? staffCache.data : [];
            const staffMap = {};
            staffData.forEach(s => {
                let eId = String(s.employee_id || s.emp_id || s.Employee_ID || '').toUpperCase().trim();
                if (eId) staffMap[eId] = s;
            });

            data = data.filter(r => {
                let eId = String(r.Employee_ID || r.employee_id || r.Emp_ID || r.emp_id || r['รหัสพนักงาน'] || '').toUpperCase().trim();
                if (!eId) return false;
                let deptInfo = (typeof getDepartmentByEmployeeId === 'function')
                    ? getDepartmentByEmployeeId(eId, staffMap[eId])
                    : null;
                if (!deptInfo) return false;

                let target = deptFilter.toLowerCase().trim();
                return (
                    deptInfo.id.toLowerCase() === target ||
                    deptInfo.name.toLowerCase() === target ||
                    deptInfo.code.toLowerCase() === target ||
                    (Array.isArray(deptInfo.prefix) && deptInfo.prefix.some(p => p.toLowerCase() === target)) ||
                    (target.length > 2 && (deptInfo.name.toLowerCase().includes(target) || target.includes(deptInfo.name.toLowerCase())))
                );
            });
        }

        let shiftFilter = document.getElementById('attendance-shift-filter') ? document.getElementById('attendance-shift-filter').value.trim() : '';
        if (shiftFilter) {
            const cleanFilter = shiftFilter.replace(/^0/, '');
            const assignments = loadShiftAssignments();
            const configs = loadShiftConfigs();

            // 🥇 Priority 1: ใช้ assignment ที่ HR กำหนดไว้
            const matchingShiftIds = new Set(
                configs.filter(c => c.start.includes(shiftFilter) || c.start.replace(/^0/, '').includes(cleanFilter)).map(c => c.id)
            );
            const assignedEmpIds = new Set();
            Object.entries(assignments).forEach(([empId, shiftId]) => {
                if (matchingShiftIds.has(shiftId)) assignedEmpIds.add(empId.toUpperCase());
            });

            if (assignedEmpIds.size > 0) {
                // ใช้ assignment-based (แม่นยำ 100%)
                data = data.filter(r => {
                    const empId = String(r.Employee_ID || r.employee_id || r.Emp_ID || '').toUpperCase().trim();
                    return assignedEmpIds.has(empId);
                });
            } else {
                // 🥈 Fallback: กรองระดับพนักงานจาก Shift_Start ใน log
                const empIdsWithShift = new Set();
                data.forEach(r => {
                    let sStart = String(r.Shift_Start || r.shift_start || r['Shift Start'] || r['เวลาเข้างาน'] || '').trim();
                    if (!sStart || sStart === '-') return;
                    const cleanStart = sStart.replace(/^0/, '');
                    if (sStart.includes(shiftFilter) || cleanStart.includes(cleanFilter)) {
                        const empId = String(r.Employee_ID || r.employee_id || r.Emp_ID || '').toUpperCase().trim();
                        if (empId) empIdsWithShift.add(empId);
                    }
                });
                if (empIdsWithShift.size > 0) {
                    data = data.filter(r => {
                        const empId = String(r.Employee_ID || r.employee_id || r.Emp_ID || '').toUpperCase().trim();
                        return empIdsWithShift.has(empId);
                    });
                } else {
                    data = [];
                }
            }
        }


        let calMonthInput = document.getElementById('calendarMonth');
        let calYearInput = document.getElementById('calendarYear');
        let calEmpInput = document.getElementById('calendarEmpId');
        let periodMode = window._attendancePeriodMode || 'month';

        if (periodMode === 'month' && !calMonthInput.value) {
            let d = new Date();
            calMonthInput.value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        }

        if (role === 'Staff') {
            calEmpInput.value = sessionEmpId;
            calEmpInput.readOnly = true;
            calEmpInput.classList.add('bg-gray-100', 'text-gray-500');
        }

        let targetEmp = calEmpInput.value.toUpperCase().trim();
        let tYear, tMonth;

        if (periodMode === 'year') {
            tYear = parseInt(calYearInput ? calYearInput.value : new Date().getFullYear());
            tMonth = null; // ไม่กรองเดือน — ดึงทั้งปี
        } else {
            tYear = parseInt(calMonthInput.value.split('-')[0]);
            tMonth = parseInt(calMonthInput.value.split('-')[1]);
        }

        let sumLate = 0, sumEarly = 0, sumAbsent = 0, sumOT = 0;
        let sumEarlyIn = 0, sumLateOut = 0;

        if (tYear && tMonth) {
            // Monthly mode: กรองเฉพาะเดือนนั้น
            data = data.filter(row => {
                let rDate = getFuzzyValue(row, ['date', 'วันที่']);
                if (!rDate || rDate === '-') return false;
                let p = String(rDate).split('/');
                if (p.length === 3 && parseInt(p[1]) === tMonth && parseInt(p[2]) === tYear) return true;
                let p2 = String(rDate).split('-');
                if (p2.length === 3 && parseInt(p2[1]) === tMonth && parseInt(p2[0]) === tYear) return true;
                return false;
            });
        } else if (tYear && !tMonth) {
            // Yearly mode: กรองเฉพาะปีนั้น (ทุกเดือน)
            data = data.filter(row => {
                let rDate = getFuzzyValue(row, ['date', 'วันที่']);
                if (!rDate || rDate === '-') return false;
                let p = String(rDate).split('/');
                if (p.length === 3 && parseInt(p[2]) === tYear) return true;
                let p2 = String(rDate).split('-');
                if (p2.length === 3 && parseInt(p2[0]) === tYear) return true;
                return false;
            });
        }

        if (targetEmp && tYear && tMonth) {
            // Monthly mode with employee: show calendar + fill missing days
            let empLogs = data.filter(r => String(r.Employee_ID || r.employee_id || r.Emp_ID || r.emp_id || r['รหัสพนักงาน'] || '').toUpperCase().trim() === targetEmp);
            let absentCount = renderAttendanceCalendar(tYear, tMonth, empLogs, targetEmp);

            let sDate = `${tYear}-${String(tMonth).padStart(2, '0')}-01`;
            let eDateObj = new Date(tYear, tMonth, 0);
            let eDate = `${tYear}-${String(tMonth).padStart(2, '0')}-${String(eDateObj.getDate()).padStart(2, '0')}`;

            data = fillMissingDays(empLogs, sDate, eDate, targetEmp);
        } else if (targetEmp && tYear && !tMonth) {
            // Yearly mode with employee: fill missing days for all 12 months
            let empLogs = data.filter(r => String(r.Employee_ID || r.employee_id || r.Emp_ID || r.emp_id || r['รหัสพนักงาน'] || '').toUpperCase().trim() === targetEmp);
            let allYearData = [];
            for (let m = 1; m <= 12; m++) {
                let sDate = `${tYear}-${String(m).padStart(2, '0')}-01`;
                let eDateObj = new Date(tYear, m, 0);
                let eDate = `${tYear}-${String(m).padStart(2, '0')}-${String(eDateObj.getDate()).padStart(2, '0')}`;
                let filled = fillMissingDays(empLogs, sDate, eDate, targetEmp);
                allYearData.push(...filled);
            }
            data = allYearData;
            // ซ่อนปฏิทินรายเดือนในโหมดรายปี
            if (document.getElementById('attendance-calendar-grid')) {
                document.getElementById('attendance-calendar-grid').innerHTML = `<div class="col-span-7 text-center py-8 text-indigo-400 text-xs font-bold uppercase tracking-widest border border-dashed border-indigo-200 rounded-xl bg-indigo-50">📅 โหมดสรุปรายปี ${tYear} — แสดงข้อมูลทั้งปี</div>`;
            }
        } else {
            if (document.getElementById('attendance-calendar-grid')) {
                document.getElementById('attendance-calendar-grid').innerHTML = '<div class="col-span-7 text-center py-8 text-gray-400 text-xs font-bold uppercase tracking-widest border border-dashed border-gray-200 rounded-xl">Specify an Employee ID to view calendar</div>';
            }
        }

        // 📌 คำนวณยอดสรุปสำหรับ Stat Cards 7 กล่องจาก data ของพนักงานหรือมุมมองที่เลือก (หน่วยเป็น นาที)
        const currentOtSettings = typeof getOtSettings === 'function' ? getOtSettings() : null;
        let staffMapForOt = {};
        if (typeof tableCache !== 'undefined' && tableCache['staff'] && tableCache['staff'].data) {
            tableCache['staff'].data.forEach(s => {
                let sId = String(s.Employee_ID || s.employee_id || '').trim().toUpperCase();
                if (sId) staffMapForOt[sId] = s;
            });
        }

        data.forEach(row => {
            let checkIn = row.Check_In || row.check_in || (typeof getFuzzyValue === 'function' ? getFuzzyValue(row, ['Check_In', 'check_in', 'in']) : '');
            let checkOut = row.Check_Out || row.check_out || (typeof getFuzzyValue === 'function' ? getFuzzyValue(row, ['Check_Out', 'check_out', 'out']) : '');
            let shiftStart = row.Shift_Start || row.shift_start || (typeof getFuzzyValue === 'function' ? getFuzzyValue(row, ['Shift_Start', 'shift_start', 'start']) : '');
            let shiftEnd = row.Shift_End || row.shift_end || (typeof getFuzzyValue === 'function' ? getFuzzyValue(row, ['Shift_End', 'shift_end', 'end']) : '');

            let late = 0;
            let earlyIn = 0;
            if (checkIn && checkIn !== '-' && shiftStart && shiftStart !== '-') {
                let inMins = parseInt(String(checkIn).split(':')[0] || 0) * 60 + parseInt(String(checkIn).split(':')[1] || 0);
                let startMins = parseInt(String(shiftStart).split(':')[0] || 0) * 60 + parseInt(String(shiftStart).split(':')[1] || 0);
                if (inMins > startMins) {
                    late = inMins - startMins; // นาที
                } else if (inMins < startMins) {
                    earlyIn = startMins - inMins; // นาที
                }
            } else if (row.Late_Hours || row.late_hours) {
                late = Math.round((parseFloat(row.Late_Hours || row.late_hours) || 0) * 60);
            }

            let early = 0;
            let lateOut = 0;
            if (checkOut && checkOut !== '-' && shiftEnd && shiftEnd !== '-') {
                let outMins = parseInt(String(checkOut).split(':')[0] || 0) * 60 + parseInt(String(checkOut).split(':')[1] || 0);
                let endMins = parseInt(String(shiftEnd).split(':')[0] || 0) * 60 + parseInt(String(shiftEnd).split(':')[1] || 0);
                if (outMins < endMins && outMins > 0) {
                    early = endMins - outMins; // นาที
                } else if (outMins > endMins) {
                    lateOut = outMins - endMins; // นาที
                }
            } else if (row.Early_Leave_Hours || row.early_leave_hours) {
                early = Math.round((parseFloat(row.Early_Leave_Hours || row.early_leave_hours) || 0) * 60);
            }

            let rEmpId = String(row.Employee_ID || row.employee_id || '').trim().toUpperCase();
            let rowStaff = staffMapForOt[rEmpId] || null;
            let ot = typeof calculateRowOt === 'function' ? calculateRowOt(row, rowStaff, currentOtSettings) : (parseFloat(row.OT_Amount || row.ot_amount || 0) || 0);
            let rowStatus = String(getFuzzyValue(row, ['attendance_status', 'status'])).toLowerCase();

            sumLate += late;
            sumEarly += early;
            sumEarlyIn += earlyIn;
            sumLateOut += lateOut;
            sumOT += ot;
            if (rowStatus.includes('missing') || rowStatus.includes('absent') || rowStatus.includes('ขาด')) sumAbsent++;
        });

        const formatMins = v => new Intl.NumberFormat('th-TH').format(Math.round(v));
        const netOffset = (sumEarlyIn + sumLateOut) - (sumLate + sumEarly);

        if (document.getElementById('filter-late')) document.getElementById('filter-late').innerText = formatMins(sumLate);
        if (document.getElementById('filter-early')) document.getElementById('filter-early').innerText = formatMins(sumEarly);
        if (document.getElementById('filter-early-in')) document.getElementById('filter-early-in').innerText = formatMins(sumEarlyIn);
        if (document.getElementById('filter-late-out')) document.getElementById('filter-late-out').innerText = formatMins(sumLateOut);
        if (document.getElementById('filter-absent')) document.getElementById('filter-absent').innerText = sumAbsent;
        if (document.getElementById('filter-ot')) document.getElementById('filter-ot').innerText = new Intl.NumberFormat('th-TH').format(sumOT);

        const netEl = document.getElementById('filter-net-balance');
        if (netEl) {
            const formattedNet = (netOffset >= 0 ? '+' : '') + formatMins(netOffset);
            netEl.innerText = formattedNet;
            if (netOffset >= 0) {
                netEl.className = 'text-xl font-black text-purple-600';
            } else {
                netEl.className = 'text-xl font-black text-rose-600';
            }
        }

        if (tableDateFilter) tableDateFilter.classList.add('hidden');

    } else {
        summaryDiv.classList.add('hidden');
        if (calSec) calSec.classList.add('hidden');
        const deptBanner = document.getElementById('attendance-dept-banner');
        if (deptBanner) deptBanner.classList.add('hidden');
        const deptTabs = document.getElementById('attendance-dept-tabs-container');
        if (deptTabs) deptTabs.classList.add('hidden');
        if (addDataBtn) {
            if (!canAdd) {
                addDataBtn.classList.add('hidden');
            } else {
                addDataBtn.classList.remove('hidden');
            }
        }
        if (searchWrapper) searchWrapper.classList.remove('hidden');
    }

    let validRowsCount = 0;
    let sumLeaveDays = 0;
    let sumBudgetTHB = 0;
    let sumBudgetLAK = 0;
    let sumBudgetUSD = 0;

    data.forEach(row => {
        const isEmpty = currentHeaders.every(h => !row[h] || String(row[h]).trim() === '');
        if (isEmpty) return;
        validRowsCount++;

        if (currentSheet === 'Leave application') {
            for (let k in row) {
                if (k.toLowerCase().includes('total_days') || k.toLowerCase().trim() === 'total days') {
                    sumLeaveDays += parseFloat(row[k]) || 0;
                }
            }
        }
        if (currentSheet === 'Budget Request' || currentSheet === 'Budget_Requests' || String(currentSheet).toLowerCase().includes('budget')) {
            const rawAmt = parseFloat(row.Amount || row.amount || 0) || 0;
            const cur = String(row.currency || row.Currency || 'THB').toUpperCase().trim();
            if (cur === 'LAK' || cur.includes('กิ๊บ') || cur.includes('กีบ')) {
                sumBudgetLAK += rawAmt;
            } else if (cur === 'USD' || cur === '$') {
                sumBudgetUSD += rawAmt;
            } else {
                sumBudgetTHB += rawAmt;
            }
        }
    });

    if (totalCountDiv) totalCountDiv.classList.remove('hidden');
    if (currentSheet !== 'Fingerprint_Logs' && tableDateFilter) tableDateFilter.classList.remove('hidden');
    const rowsCountEl = document.getElementById('display-total-rows');
    if (rowsCountEl) rowsCountEl.innerText = validRowsCount;

    if (currentSheet === 'Leave application') {
        if (totalDaysSpan) {
            totalDaysSpan.classList.remove('hidden');
            document.getElementById('sum-leave-days').innerText = sumLeaveDays;
        }
    } else {
        if (totalDaysSpan) totalDaysSpan.classList.add('hidden');
    }

    const totalAmountSpan = document.getElementById('display-total-amount');
    if (currentSheet === 'Budget Request' || currentSheet === 'Budget_Requests' || String(currentSheet).toLowerCase().includes('budget')) {
        if (totalAmountSpan) {
            totalAmountSpan.classList.remove('hidden');
            const parts = [];
            if (sumBudgetTHB > 0) {
                parts.push(`${new Intl.NumberFormat('th-TH').format(sumBudgetTHB)} บาท`);
            }
            if (sumBudgetLAK > 0) {
                parts.push(`${new Intl.NumberFormat('th-TH').format(sumBudgetLAK)} ກີບ`);
            }
            if (sumBudgetUSD > 0) {
                parts.push(`$ ${new Intl.NumberFormat('th-TH', { minimumFractionDigits: 2 }).format(sumBudgetUSD)}`);
            }
            if (parts.length === 0) {
                parts.push(`0 บาท`);
            }
            const labelEl = document.getElementById('sum-budget-amount');
            if (labelEl) {
                labelEl.innerText = parts.join(' | ');
            }
        }
    } else {
        if (totalAmountSpan) totalAmountSpan.classList.add('hidden');
    }

    if (currentSheet === 'Training' || currentSheet === 'Asset_Tracking' || currentSheet === 'Announcements' || currentSheet === 'News' || currentSheet.includes('Ranting') || currentSheet.includes('Rating') || currentSheet.trim() === 'Policy' || currentSheet.trim() === 'Documents' || currentSheet === 'Leave application' || currentSheet === 'Leave Requests' || String(currentSheet).toLowerCase().includes('leave')) {
        tableWrapper.classList.add('hidden');
        cardWrapper.classList.remove('hidden');
        cardWrapper.innerHTML = '';
        summaryDiv.classList.add('hidden');
        if (addDataBtn) {
            if (canAdd) {
                addDataBtn.classList.remove('hidden');
            } else {
                addDataBtn.classList.add('hidden');
            }
        }

        let isRatingPage = currentSheet.includes('Ranting') || currentSheet.includes('Rating');

        let topBarWrapper = document.getElementById('table-controls-wrapper');
        let topBar = topBarWrapper ? topBarWrapper.firstElementChild : null;

        if (isRatingPage && role === 'Staff') {
            if (topBar) topBar.style.display = 'none';
        } else {
            if (topBar) topBar.style.display = '';
        }

        let qrBtn = document.getElementById('qr-scan-btn');
        if (isRatingPage) {
            if (!qrBtn && addDataBtn) {
                let btnContainer = addDataBtn.parentElement;
                if (btnContainer) {
                    btnContainer.classList.add('flex-wrap', 'justify-end', 'gap-2');
                    btnContainer.classList.remove('space-x-2');
                }

                qrBtn = document.createElement('button');
                qrBtn.id = 'qr-scan-btn';
                qrBtn.className = 'text-white bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 font-bold px-4 py-2.5 rounded-xl transition-all shadow-md flex items-center justify-center w-full md:w-auto';
                qrBtn.innerHTML = '<i class="fa-solid fa-camera mr-2"></i>สแกน QR ให้ดาว';
                qrBtn.onclick = typeof openQRScanner === 'function' ? openQRScanner : function () {
                    showToast(t('qr_not_ready') || 'QR function not ready', 'error');
                };

                addDataBtn.classList.add('w-full', 'md:w-auto');
                btnContainer.insertBefore(qrBtn, addDataBtn);
            }
            if (qrBtn) qrBtn.style.display = '';
        } else {
            if (qrBtn) qrBtn.style.display = 'none';
        }

        let uiCheckCount = 0;
        let uiFixInterval = setInterval(() => {
            let totalBadge = document.getElementById('totalCount');
            let dateInputs = document.querySelectorAll('#tableStartDate, #tableEndDate');
            let searchInput = document.querySelector('input[placeholder*="Search"]');

            if (isRatingPage) {
                if (totalBadge && totalBadge.parentElement) {
                    totalBadge.parentElement.classList.add('hidden-important');
                }
                dateInputs.forEach(input => {
                    let dateContainer = input.closest('.space-x-2') || input.parentElement.parentElement;
                    if (dateContainer) {
                        dateContainer.classList.add('hidden-important');
                    }
                });
                if (searchInput) {
                    let searchBox = searchInput.closest('.relative') || searchInput.parentElement;
                    if (searchBox) {
                        searchBox.classList.remove('hidden-important');
                        searchBox.style.cssText = 'display: block !important; width: 100%;';
                    }
                }
            } else {
                if (totalBadge && totalBadge.parentElement) {
                    totalBadge.parentElement.classList.remove('hidden-important');
                }
                dateInputs.forEach(input => {
                    let dateContainer = input.closest('.space-x-2') || input.parentElement.parentElement;
                    if (dateContainer) {
                        dateContainer.classList.remove('hidden-important');
                    }
                });
            }

            uiCheckCount++;
            if (uiCheckCount > 20) clearInterval(uiFixInterval);
        }, 100);

        if (isRatingPage) {
            if (totalCountDiv) totalCountDiv.classList.add('hidden');
            renderEmployeeRatingPageFromScratch(data || []);
            return;
        }

        if (!currentHeaders.length || data.length === 0) {
            let noRecordsTxt = window.t ? window.t('no_records') : 'No records found';
            cardWrapper.innerHTML = '<div class="col-span-full flex flex-col items-center justify-center py-20 text-gray-400 bg-gray-50 rounded-3xl border border-dashed border-gray-200"><i class="fa-regular fa-folder-open text-6xl mb-4 text-gray-300"></i><p class="font-bold tracking-widest uppercase text-sm">' + noRecordsTxt + '</p></div>';
            return;
        }

        let cardsHtml = '';
        if (currentSheet === 'Training') {
            data.forEach(row => {
                const isEmpty = currentHeaders.every(h => !row[h] || String(row[h]).trim() === '');
                if (isEmpty) return;

                const rowId = getRecordId(row);
                const encodedRow = encodeURIComponent(JSON.stringify(row)).replace(/'/g, "%27");

                let title = getFuzzyValue(row, ['course', 'หลักสูตร', 'subject', 'หัวข้อ', 'name', 'ชื่อ', 'detail', 'รายละเอียด'], 1) || 'No Title';
                let photoUrl = getFuzzyValue(row, ['photo', 'รูป', 'pic', 'image', 'รูปภาพ']);

                let ytUrl = getFuzzyValue(row, ['youtube', 'yt', 'ยูทูป', 'video', 'วิดีโอ']);
                let fbUrl = getFuzzyValue(row, ['facebook', 'fb', 'เฟสบุ๊ค', 'เพจ']);
                let generalUrl = getFuzzyValue(row, ['link', 'url', 'ลิงก์', 'เอกสาร']);

                if (photoUrl && photoUrl.includes('drive.google.com')) {
                    let fileId = '';
                    if (photoUrl.includes('id=')) fileId = photoUrl.split('id=')[1].split('&')[0];
                    else if (photoUrl.includes('/d/')) fileId = photoUrl.split('/d/')[1].split('/')[0];
                    if (fileId) photoUrl = 'https://drive.google.com/thumbnail?id=' + fileId + '&sz=w800';
                }

                let cardArr = [];
                cardArr.push(`<div onclick="showTrainingDetail('${encodedRow}')" class="bg-white rounded-[1.5rem] shadow-sm border border-gray-100 overflow-hidden flex flex-col relative transition-all duration-300 hover:shadow-xl hover:-translate-y-1 cursor-pointer group">`);

                if (canEdit || canDelete) {
                    cardArr.push('<div class="absolute top-3 right-3 flex space-x-2 z-10 bg-white/90 backdrop-blur-sm rounded-lg p-1.5" onclick="event.stopPropagation()">');
                    if (canEdit) cardArr.push('<button onclick="openFormModal(\'', encodedRow, '\')" class="text-gray-500 hover:text-gray-800 transition-colors" title="Edit"><i class="fa-regular fa-pen-to-square text-lg"></i></button>');
                    if (canDelete) cardArr.push('<button onclick="deleteRecord(\'', rowId, '\')" class="text-gray-500 hover:text-red-500 transition-colors" title="Delete"><i class="fa-regular fa-trash-can text-lg"></i></button>');
                    cardArr.push('</div>');
                }

                cardArr.push('<div class="p-5 pb-3">');
                cardArr.push('<p class="text-sm text-gray-800 font-medium whitespace-pre-line pr-16 leading-relaxed line-clamp-3 group-hover:text-brandindigo transition-colors" title="', escapeHtml(title), '">', escapeHtml(title), '</p>');
                cardArr.push('</div>');

                if (photoUrl && photoUrl !== '-' && photoUrl.trim() !== '') {
                    cardArr.push('<div class="w-full px-5 pb-4 mt-auto">');
                    cardArr.push('<img src="', photoUrl, '" alt="Training Image" class="w-full h-auto max-h-[300px] object-cover rounded-2xl border border-gray-100" onerror="this.style.display=\'none\'">');
                    cardArr.push('</div>');
                } else {
                    cardArr.push('<div class="w-full flex-1 min-h-[100px]"></div>');
                }

                let targetUrl = '';
                let linkIcon = 'fa-link';
                let linkText = t('learning_doc') || 'Document';
                let btnColor = 'text-brandindigo bg-indigo-50 hover:bg-indigo-100';

                if (generalUrl && generalUrl !== '-' && generalUrl.trim() !== '') { targetUrl = generalUrl; }
                else if (ytUrl && ytUrl !== '-' && ytUrl.trim() !== '') { targetUrl = ytUrl; linkIcon = 'fa-youtube'; linkText = t('learn_youtube') || 'Learn via YouTube'; btnColor = 'text-red-600 bg-red-50 hover:bg-red-100'; }
                else if (fbUrl && fbUrl !== '-' && fbUrl.trim() !== '') { targetUrl = fbUrl; linkIcon = 'fa-facebook'; linkText = t('watch_fb') || 'Watch via Facebook'; btnColor = 'text-blue-600 bg-blue-50 hover:bg-blue-100'; }

                if (targetUrl) {
                    cardArr.push(`<div class="w-full px-5 pb-5" onclick="event.stopPropagation()">`);
                    cardArr.push(`<a href="${targetUrl}" target="_blank" rel="noopener noreferrer" class="w-full flex items-center justify-center px-4 py-2.5 rounded-xl ${btnColor} transition-colors text-[11px] font-bold tracking-wide gap-2">`);
                    cardArr.push(`<i class="fa-solid ${linkIcon} text-sm"></i> ${linkText}`);
                    cardArr.push(`</a></div>`);
                } else {
                    cardArr.push('<div class="pb-2"></div>');
                }

                cardArr.push('</div>');
                cardsHtml += cardArr.join('');
            });
        }
        else if (currentSheet === 'Asset_Tracking') {
            if (!window.showAssetFromId) {
                window.showAssetFromId = function (id) {
                    const row = tableCache['Asset_Tracking'].data.find(r => String(getRecordId(r)) === String(id));
                    if (row) showAssetDetail(encodeURIComponent(JSON.stringify(row)).replace(/'/g, "%27"));
                };
                window.editAssetFromId = function (id, event) {
                    event.stopPropagation();
                    const row = tableCache['Asset_Tracking'].data.find(r => String(getRecordId(r)) === String(id));
                    if (row) openFormModal(encodeURIComponent(JSON.stringify(row)).replace(/'/g, "%27"));
                };
            }



            data.forEach(row => {
                const isEmpty = currentHeaders.every(h => !row[h] || String(row[h]).trim() === '');
                if (isEmpty) return;

                const rowId = getRecordId(row);

                let assetName = getFuzzyValue(row, ['asset', 'ทรัพย์สิน', 'name', 'ชื่อ'], 1) || 'No Title';
                let employee = getFuzzyValue(row, ['employee', 'ผู้ถือครอง', 'ລະຫັດພະນັກງານ'], 3) || '-';
                let dateVal = getFuzzyValue(row, ['date', 'วันที่', 'เวลา', 'issue', 'ວັນເລີ່ມໃຊ້ງານ'], 2) || '-';
                let status = getFuzzyValue(row, ['status', 'สถานะ', 'ສະຖານະ']);
                let photoUrl = getFuzzyValue(row, ['photo', 'รูป', 'pic', 'image', 'รูปภาพ']);

                if (typeof photoUrl === 'string') {
                    if (photoUrl.startsWith('data:image')) {
                        photoUrl = photoUrl.replace(/[\r\n\t\s]+/g, "");
                    } else if (photoUrl.includes('drive.google.com')) {
                        let fileId = '';
                        if (photoUrl.includes('id=')) fileId = photoUrl.split('id=')[1].split('&')[0];
                        else if (photoUrl.includes('/d/')) fileId = photoUrl.split('/d/')[1].split('/')[0];
                        if (fileId) photoUrl = 'https://drive.google.com/thumbnail?id=' + fileId + '&sz=w800';
                    }
                }

                let safeTopic = encodeURIComponent(String(assetName).substring(0, 20));
                let fallbackImg = `https://ui-avatars.com/api/?background=f8fafc&color=94a3b8&size=800&font-size=0.1&name=${safeTopic}`;

                if (!photoUrl || photoUrl === '-' || String(photoUrl).trim() === '') {
                    photoUrl = fallbackImg;
                }

                let statusLower = String(status).toLowerCase();
                let statusColor = 'text-gray-600';
                if (statusLower.includes('complete') || statusLower.includes('กำลังใช้งาน') || statusLower.includes('ໃຊ້ງານ') || statusLower === 'active') {
                    statusColor = 'text-green-500';
                }
                else if (statusLower.includes('cancel') || statusLower.includes('เพแล้ว') || statusLower.includes('ເພແລ້ວ') || statusLower.includes('เสีย') || statusLower.includes('inactive') || statusLower.includes('broken') || statusLower.includes('พัง')) {
                    statusColor = 'text-red-500';
                }
                else if (statusLower.includes('ongoing') || statusLower.includes('กำลังซ่อม') || statusLower.includes('ສ້ອມ') || statusLower.includes('ซ่อม') || statusLower.includes('repair')) {
                    statusColor = 'text-orange-500';
                }

                let cardArr = [];
                cardArr.push(`<div onclick="showAssetFromId('${rowId}')" class="bg-white rounded-3xl shadow-sm border border-gray-200 overflow-hidden flex flex-col relative transition-all duration-300 hover:shadow-xl hover:-translate-y-1 cursor-pointer group p-4 pb-0">`);

                cardArr.push('<div class="flex justify-between items-start mb-2">');
                cardArr.push(`<div class="font-bold text-[13px] tracking-wide text-gray-800">ສະຖານະ: <span class="${statusColor}">${escapeHtml(status || '-')}</span></div>`);

                if (canEdit || canDelete) {
                    cardArr.push('<div class="flex space-x-2 z-10 bg-white" onclick="event.stopPropagation()">');
                    if (canEdit) cardArr.push(`<button onclick="editAssetFromId('${rowId}', event)" class="text-gray-400 hover:text-gray-800 transition-colors" title="Edit"><i class="fa-regular fa-pen-to-square text-[15px]"></i></button>`);
                    if (canDelete) cardArr.push(`<button onclick="event.stopPropagation(); deleteRecord('${rowId}')" class="text-gray-400 hover:text-red-500 transition-colors" title="Delete"><i class="fa-regular fa-trash-can text-[15px]"></i></button>`);
                    cardArr.push('</div>');
                } else {
                    cardArr.push('<div></div>');
                }
                cardArr.push('</div>');

                cardArr.push('<div class="flex justify-between items-end mb-3">');
                cardArr.push('<div class="text-[11px] text-gray-600 leading-tight space-y-0.5">');
                cardArr.push(`<div>${t('emp_id_label') || 'Employee ID:'} <span class="font-medium text-gray-800">${escapeHtml(employee)}</span></div>`);
                cardArr.push(`<div>${t('asset_number_label') || 'Asset Number:'} <span class="font-medium text-gray-800">${escapeHtml(rowId)}</span></div>`);
                cardArr.push('</div>');

                cardArr.push('<div class="text-[11px] text-gray-600 text-right leading-tight space-y-0.5">');
                cardArr.push('<div>วันเริ่มใช้งาน:</div>');
                cardArr.push(`<div class="font-medium text-gray-800">${escapeHtml(dateVal)}</div>`);
                cardArr.push('</div>');
                cardArr.push('</div>');

                cardArr.push('<div class="w-full mt-auto pb-4">');
                cardArr.push(`<img src="${photoUrl}" alt="Asset" class="w-full aspect-square object-cover rounded-[1rem] border border-gray-100" onerror="this.onerror=null; this.src='${fallbackImg}';">`);
                cardArr.push('</div>');

                cardArr.push('</div>');
                cardsHtml += cardArr.join('');
            });
        }
        else if (currentSheet === 'Announcements') {
            if (!window.showAnnounceFromId) {
                window.showAnnounceFromId = function (id) {
                    const row = tableCache['Announcements'].data.find(r => String(getRecordId(r)) === String(id));
                    if (row) showAnnouncementDetail(encodeURIComponent(JSON.stringify(row)).replace(/'/g, "%27"));
                };
                window.editAnnounceFromId = function (id, event) {
                    event.stopPropagation();
                    const row = tableCache['Announcements'].data.find(r => String(getRecordId(r)) === String(id));
                    if (row) openFormModal(encodeURIComponent(JSON.stringify(row)).replace(/'/g, "%27"));
                };
            }

            data.forEach(row => {
                const isEmpty = currentHeaders.every(h => !row[h] || String(row[h]).trim() === '');
                if (isEmpty) return;

                const rowId = getRecordId(row);

                let topic = getFuzzyValue(row, ['topic', 'หัวข้อ', 'เรื่อง', 'รายละเอียด', 'detail']) || 'Announcement';
                if (topic === '-') topic = 'Announcement';
                let type = getFuzzyValue(row, ['type', 'ประเภท']) || 'General';

                let photoUrl = row['photo'] || row['Photo'] || getFuzzyValue(row, ['photo', 'รูป', 'pic', 'image', 'รูปภาพ']) || '';

                if (typeof photoUrl === 'string') {
                    if (photoUrl.startsWith('data:image')) {
                        photoUrl = photoUrl.replace(/[\r\n\t\s]+/g, "");
                    } else if (photoUrl.includes('drive.google.com')) {
                        let fileId = '';
                        if (photoUrl.includes('id=')) fileId = photoUrl.split('id=')[1].split('&')[0];
                        else if (photoUrl.includes('/d/')) fileId = photoUrl.split('/d/')[1].split('/')[0];
                        if (fileId) photoUrl = 'https://drive.google.com/thumbnail?id=' + fileId + '&sz=w800';
                    }
                }

                let safeTopic = encodeURIComponent(String(topic).substring(0, 20));
                let fallbackImg = `https://ui-avatars.com/api/?background=e0e7ff&color=4f46e5&size=800&font-size=0.1&name=${safeTopic}`;

                if (!photoUrl || photoUrl === '-' || String(photoUrl).trim() === '') {
                    photoUrl = fallbackImg;
                }

                let cardArr = [];
                cardArr.push(`<div onclick="showAnnounceFromId('${rowId}')" class="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden flex flex-col relative transition-all duration-300 hover:shadow-lg hover:-translate-y-1 cursor-pointer group">`);

                cardArr.push('<div class="flex justify-between items-start px-4 py-3 bg-white z-10 border-b border-gray-50 shrink-0 gap-2">');

                cardArr.push('<div class="flex flex-col min-w-0">');
                cardArr.push(`<span class="text-[10px] font-bold text-brandindigo uppercase tracking-widest mb-0.5" title="${escapeHtml(type)}">${escapeHtml(type)}</span>`);
                cardArr.push(`<h3 class="text-sm font-bold text-gray-800 line-clamp-2 leading-snug" title="${escapeHtml(topic)}">${escapeHtml(topic)}</h3>`);
                cardArr.push('</div>');

                if (canEdit || canDelete) {
                    cardArr.push('<div class="flex space-x-2 shrink-0 mt-0.5" onclick="event.stopPropagation()">');
                    if (canEdit) cardArr.push(`<button onclick="editAnnounceFromId('${rowId}', event)" class="text-gray-400 hover:text-brandindigo transition-colors" title="Edit"><i class="fa-regular fa-pen-to-square text-[15px]"></i></button>`);
                    if (canDelete) cardArr.push(`<button onclick="event.stopPropagation(); deleteRecord('${rowId}')" class="text-gray-400 hover:text-red-500 transition-colors" title="Delete"><i class="fa-regular fa-trash-can text-[15px]"></i></button>`);
                    cardArr.push('</div>');
                }
                cardArr.push('</div>');

                cardArr.push('<div class="w-full aspect-[4/5] bg-gray-50 flex flex-col items-center justify-center p-3 relative">');
                cardArr.push(`<img src="${photoUrl}" alt="Announcement" class="w-full h-full object-cover rounded-xl shadow-sm border border-gray-100" onerror="this.onerror=null; this.src='${fallbackImg}';">`);
                cardArr.push('</div>');

                cardArr.push('</div>');

                cardsHtml += cardArr.join('');
            });
        }
        else if (currentSheet === 'News') {
            if (!window.showNewsFromId) {
                window.showNewsFromId = function (id) {
                    const row = tableCache['News'].data.find(r => String(getRecordId(r)) === String(id));
                    if (row) showNewsDetail(encodeURIComponent(JSON.stringify(row)).replace(/'/g, "%27"));
                };
                window.editNewsFromId = function (id, event) {
                    event.stopPropagation();
                    const row = tableCache['News'].data.find(r => String(getRecordId(r)) === String(id));
                    if (row) openFormModal(encodeURIComponent(JSON.stringify(row)).replace(/'/g, "%27"));
                };
            }

            data.forEach(row => {
                const isEmpty = currentHeaders.every(h => !row[h] || String(row[h]).trim() === '');
                if (isEmpty) return;

                const rowId = getRecordId(row);

                let topic = getFuzzyValue(row, ['topic', 'หัวข้อ', 'เรื่อง']) || 'News Title';
                let content = getFuzzyValue(row, ['content', 'รายละเอียด', 'เนื้อหา']) || '';
                let type = getFuzzyValue(row, ['type', 'ประเภท']) || 'General';
                let audience = getFuzzyValue(row, ['audience', 'เป้าหมาย', 'กลุ่มผู้ฟัง']) || 'Public';

                let photoUrl = row['photo'] || row['Photo'] || getFuzzyValue(row, ['photo', 'รูป', 'pic', 'image', 'รูปภาพ']) || '';

                if (typeof photoUrl === 'string') {
                    if (photoUrl.startsWith('data:image')) {
                        photoUrl = photoUrl.replace(/[\r\n\t\s]+/g, "");
                    } else if (photoUrl.includes('drive.google.com')) {
                        let fileId = '';
                        if (photoUrl.includes('id=')) fileId = photoUrl.split('id=')[1].split('&')[0];
                        else if (photoUrl.includes('/d/')) fileId = photoUrl.split('/d/')[1].split('/')[0];
                        if (fileId) photoUrl = 'https://drive.google.com/thumbnail?id=' + fileId + '&sz=w800';
                    }
                }

                let safeTopic = encodeURIComponent(String(topic).substring(0, 20));
                let fallbackImg = `https://ui-avatars.com/api/?background=e0e7ff&color=4f46e5&size=800&font-size=0.1&name=${safeTopic}`;

                if (!photoUrl || photoUrl === '-' || String(photoUrl).trim() === '') {
                    photoUrl = fallbackImg;
                }

                let cardArr = [];
                cardArr.push(`<div onclick="showNewsFromId('${rowId}')" class="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden flex flex-col relative transition-all duration-300 hover:shadow-lg hover:-translate-y-1 cursor-pointer group">`);

                cardArr.push('<div class="flex justify-between items-start px-4 py-3 bg-white z-10 border-b border-gray-50 shrink-0 gap-2">');

                cardArr.push('<div class="flex flex-col min-w-0">');
                const audColor = String(audience).toLowerCase() === 'public' ? 'text-green-600 bg-green-50' : 'text-amber-600 bg-amber-50';
                const audText = String(audience).toLowerCase() === 'public' ? 'Public (สาธารณะ)' : 'Internal (ภายใน)';
                cardArr.push(`<div class="flex items-center gap-1.5 mb-1 flex-wrap">`);
                cardArr.push(`<span class="text-[9px] font-extrabold text-brandindigo uppercase tracking-wider bg-indigo-50 px-1.5 py-0.5 rounded" title="${escapeHtml(type)}">${escapeHtml(type)}</span>`);
                cardArr.push(`<span class="text-[9px] font-extrabold ${audColor} uppercase tracking-wider px-1.5 py-0.5 rounded" title="${escapeHtml(audText)}">${escapeHtml(audText)}</span>`);
                cardArr.push(`</div>`);
                cardArr.push(`<h3 class="text-sm font-bold text-gray-800 line-clamp-2 leading-snug" title="${escapeHtml(topic)}">${escapeHtml(topic)}</h3>`);
                cardArr.push('</div>');

                if (canEdit || canDelete) {
                    cardArr.push('<div class="flex space-x-2 shrink-0 mt-0.5" onclick="event.stopPropagation()">');
                    if (canEdit) cardArr.push(`<button onclick="editNewsFromId('${rowId}', event)" class="text-gray-400 hover:text-brandindigo transition-colors" title="Edit"><i class="fa-regular fa-pen-to-square text-[15px]"></i></button>`);
                    if (canDelete) cardArr.push(`<button onclick="event.stopPropagation(); deleteRecord('${rowId}')" class="text-gray-400 hover:text-red-500 transition-colors" title="Delete"><i class="fa-regular fa-trash-can text-[15px]"></i></button>`);
                    cardArr.push('</div>');
                }
                cardArr.push('</div>');

                cardArr.push('<div class="w-full aspect-[4/5] bg-gray-50 flex flex-col items-center justify-center p-3 relative">');
                cardArr.push(`<img src="${photoUrl}" alt="News Image" class="w-full h-full object-cover rounded-xl shadow-sm border border-gray-100" onerror="this.onerror=null; this.src='${fallbackImg}';">`);
                cardArr.push('</div>');

                cardArr.push('</div>');

                cardsHtml += cardArr.join('');
            });
        }
        else if (currentSheet.trim() === 'Policy') {
            data.forEach(row => {
                const isEmpty = currentHeaders.every(h => !row[h] || String(row[h]).trim() === '');
                if (isEmpty) return;

                const rowId = getRecordId(row);
                const encodedRow = encodeURIComponent(JSON.stringify(row)).replace(/'/g, "%27");

                let topic = getFuzzyValue(row, ['head_name', 'หัวข้อ', 'ชื่อ']) || 'เอกสารนโยบาย / Policy';
                let fileUrl = getFuzzyValue(row, ['link', 'url', 'ไฟล์', 'document']) || '';
                let originalUrl = fileUrl;

                let isPdf = false;
                if (typeof originalUrl === 'string') {
                    isPdf = originalUrl.toLowerCase().includes('.pdf') || originalUrl.startsWith('data:application/pdf');
                }

                if (fileUrl.includes('drive.google.com/file/d/')) {
                    let fileId = fileUrl.split('/d/')[1].split('/')[0];
                    fileUrl = 'https://drive.google.com/thumbnail?id=' + fileId + '&sz=w1000';
                }

                let safeTopic = encodeURIComponent(String(topic).substring(0, 15));
                let fallbackImg = `https://ui-avatars.com/api/?background=f8fafc&color=4f46e5&size=800&font-size=0.1&name=${safeTopic}`;

                if (!fileUrl || fileUrl === '-' || String(fileUrl).trim() === '') {
                    fileUrl = fallbackImg;
                }

                let cardArr = [];
                cardArr.push(`<div onclick="showPolicyDetail('${encodedRow}')" class="bg-white rounded-3xl shadow-sm border border-gray-200 overflow-hidden flex flex-col relative transition-all duration-300 hover:shadow-xl hover:-translate-y-1 cursor-pointer group p-4 pb-0">`);

                cardArr.push('<div class="flex justify-between items-start mb-3">');
                cardArr.push(`<div class="font-bold text-[11px] tracking-widest text-brandindigo uppercase bg-indigo-50 px-2.5 py-1 rounded-md border border-indigo-100 flex items-center"><i class="fa-solid fa-file-contract mr-1.5"></i> Policy</div>`);

                if (canEdit || canDelete) {
                    cardArr.push('<div class="flex space-x-2 z-10 bg-white" onclick="event.stopPropagation()">');
                    if (canEdit) cardArr.push(`<button onclick="openFormModal('${encodedRow}')" class="text-gray-400 hover:text-gray-800 transition-colors" title="Edit"><i class="fa-regular fa-pen-to-square text-[15px]"></i></button>`);
                    if (canDelete) cardArr.push(`<button onclick="event.stopPropagation(); deleteRecord('${rowId}')" class="text-gray-400 hover:text-red-500 transition-colors" title="Delete"><i class="fa-regular fa-trash-can text-[15px]"></i></button>`);
                    cardArr.push('</div>');
                } else {
                    cardArr.push('<div></div>');
                }
                cardArr.push('</div>');

                cardArr.push('<div class="mb-4 px-1">');
                cardArr.push(`<h3 class="text-sm font-bold text-gray-900 leading-snug line-clamp-2 group-hover:text-brandindigo transition-colors">${topic}</h3>`);
                cardArr.push('</div>');

                cardArr.push('<div class="w-full mt-auto pb-4">');
                cardArr.push(`<div class="relative w-full aspect-square rounded-[1rem] overflow-hidden border border-gray-100 bg-gray-50 group-hover:shadow-md transition-all flex flex-col items-center justify-center">`);

                if (isPdf) {
                    cardArr.push(`<i class="fa-solid fa-file-pdf text-[5rem] text-red-500 group-hover:scale-110 transition-transform mb-3"></i>`);
                    cardArr.push(`<span class="text-[10px] font-bold text-gray-400 uppercase tracking-widest">PDF Document</span>`);
                } else {
                    cardArr.push(`<div class="absolute inset-0 flex items-center justify-center opacity-[0.03]"><i class="fa-solid fa-book-open text-[8rem] text-brandindigo"></i></div>`);
                    cardArr.push(`<img src="${fileUrl}" alt="Policy Document" class="relative z-10 w-full h-full object-cover" onerror="this.onerror=null; this.src='${fallbackImg}';">`);
                }

                cardArr.push(`</div>`);
                cardArr.push('</div>');

                cardArr.push(`</div>`);
                cardsHtml += cardArr.join('');
            });
        }
        else if (currentSheet.trim() === 'Documents') {
            data.forEach(row => {
                const isEmpty = currentHeaders.every(h => !row[h] || String(row[h]).trim() === '');
                if (isEmpty) return;

                const rowId = getRecordId(row);
                const encodedRow = encodeURIComponent(JSON.stringify(row)).replace(/'/g, "%27");

                let topic = getFuzzyValue(row, ['document_name', 'document name', 'ชื่อเอกสาร', 'หัวข้อ', 'ชื่อ']) || 'เอกสาร / Document';
                let docType = getFuzzyValue(row, ['document_types', 'document types ', 'ประเภท', 'type']) || 'General';

                let fileUrl = row['Photo'] || row['photo'] || getFuzzyValue(row, ['photo', 'file', 'link', 'url', 'ไฟล์', 'document', 'ไฟล์แนบ']) || '';

                if (typeof fileUrl === 'string' && fileUrl.startsWith('data:')) {
                    fileUrl = fileUrl.replace(/[\r\n\t\s]+/g, "");
                }

                let originalUrl = fileUrl;

                let isPdf = false;
                if (typeof originalUrl === 'string') {
                    isPdf = originalUrl.toLowerCase().includes('.pdf') || originalUrl.startsWith('data:application/pdf');
                }

                if (fileUrl.includes('drive.google.com/file/d/')) {
                    let fileId = fileUrl.split('/d/')[1].split('/')[0];
                    fileUrl = 'https://drive.google.com/thumbnail?id=' + fileId + '&sz=w1000';
                }

                let safeTopic = encodeURIComponent(String(topic).substring(0, 15));
                let fallbackImg = `https://ui-avatars.com/api/?background=f8fafc&color=4f46e5&size=800&font-size=0.1&name=${safeTopic}`;

                if (!fileUrl || fileUrl === '-' || String(fileUrl).trim() === '') {
                    fileUrl = fallbackImg;
                }

                let cardArr = [];
                cardArr.push(`<div onclick="showDocumentDetail('${encodedRow}')" class="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden flex flex-col relative transition-all duration-300 hover:shadow-lg hover:-translate-y-1 cursor-pointer group">`);

                cardArr.push('<div class="flex flex-col min-w-0">');
                cardArr.push(`<span class="text-[10px] font-bold text-brandindigo uppercase tracking-widest mb-0.5" title="${escapeHtml(docType)}">${escapeHtml(docType)}</span>`);
                cardArr.push(`<h3 class="text-sm font-bold text-gray-800 line-clamp-2 leading-snug" title="${escapeHtml(topic)}">${escapeHtml(topic)}</h3>`);
                cardArr.push('</div>');

                if (canEdit || canDelete) {
                    cardArr.push('<div class="flex space-x-2 shrink-0 mt-0.5" onclick="event.stopPropagation()">');
                    if (canEdit) cardArr.push(`<button onclick="openFormModal('${encodedRow}')" class="text-gray-400 hover:text-brandindigo transition-colors" title="Edit"><i class="fa-regular fa-pen-to-square text-[15px]"></i></button>`);
                    if (canDelete) cardArr.push(`<button onclick="event.stopPropagation(); deleteRecord('${rowId}')" class="text-gray-400 hover:text-red-500 transition-colors" title="Delete"><i class="fa-regular fa-trash-can text-[15px]"></i></button>`);
                    cardArr.push('</div>');
                }
                cardArr.push('</div>');

                cardArr.push('<div class="w-full aspect-[4/5] bg-gray-50 flex flex-col items-center justify-center p-3 relative">');

                if (isPdf) {
                    cardArr.push(`<i class="fa-solid fa-file-pdf text-[5rem] text-red-500 group-hover:scale-110 transition-transform mb-3"></i>`);
                    cardArr.push(`<span class="text-[10px] font-bold text-gray-400 uppercase tracking-widest">PDF Document</span>`);
                } else {
                    cardArr.push(`<img src="${fileUrl}" alt="Document" class="w-full h-full object-cover rounded-xl shadow-sm border border-gray-100" onerror="this.onerror=null; this.src='${fallbackImg}';">`);
                }

                cardArr.push('</div>');
                cardArr.push('</div>');

                cardsHtml += cardArr.join('');
            });
        }
        else if (currentSheet === 'Leave application' || currentSheet === 'Leave Requests' || String(currentSheet).toLowerCase().includes('leave')) {
            const leaveTabsContainer = document.getElementById('leave-status-tabs-container');
            if (leaveTabsContainer) leaveTabsContainer.classList.remove('hidden');

            const leaveDateFilterWrapper = document.getElementById('leave-date-filter-wrapper');
            if (leaveDateFilterWrapper) leaveDateFilterWrapper.classList.remove('hidden');

            // Populate year dropdown for leave filter if empty
            const ySelect = document.getElementById('leaveYearInput');
            if (ySelect && ySelect.options.length === 0) {
                let yearsSet = new Set();
                yearsSet.add(new Date().getFullYear());
                (rawData || data || []).forEach(r => {
                    let sStr = getFuzzyValue(r, ['start_date', 'เริ่ม', 'วันที่เริ่ม', 'date']);
                    let d = typeof parseDateStr === 'function' ? parseDateStr(sStr) : new Date(sStr);
                    if (d && !isNaN(d.getFullYear())) yearsSet.add(d.getFullYear());
                });
                let sortedYears = Array.from(yearsSet).sort((a, b) => b - a);
                ySelect.innerHTML = sortedYears.map(y => `<option value="${y}">${y}</option>`).join('');
            }

            const staffCache = tableCache['staff'] || tableCache['Staff'];
            const staffRows = (staffCache && Array.isArray(staffCache.data)) ? staffCache.data : [];

            // Background fetch staff data if not loaded yet so names and avatars render properly
            if (!staffRows.length && typeof google !== 'undefined' && google.script && google.script.run && !window._fetchingStaffForLeaves) {
                window._fetchingStaffForLeaves = true;
                google.script.run.withSuccessHandler(res => {
                    window._fetchingStaffForLeaves = false;
                    if (res && res.success && Array.isArray(res.data)) {
                        tableCache['staff'] = { headers: res.headers || [], data: res.data };
                        if (typeof renderTable === 'function' && currentSheet === 'Leave application' && rawData) {
                            renderTable(rawData);
                        }
                    }
                }).getSheetData('staff');
            }

            // Compute counts for all tabs from filtered data
            let allCount = 0, pendingCount = 0, approvedCount = 0, rejectedCount = 0;
            const countSource = Array.isArray(data) ? data : (rawData || []);
            countSource.forEach(r => {
                let rawStatus = String(getFuzzyValue(r, ['signature', 'status', 'อนุมัติ', 'approval_status']) || 'Pending').toLowerCase().trim();
                let isApproved = rawStatus.includes('approve') || rawStatus.includes('hr') || rawStatus.includes('อนุมัติ') || rawStatus.includes('อนุญาต') || rawStatus.includes('dept head') || rawStatus.includes('ceo') || rawStatus.includes('coo') || rawStatus.includes('cfo');
                let isRejected = rawStatus.includes('reject') || rawStatus.includes('ไม่อนุมัติ') || rawStatus.includes('ปฏิเสธ') || rawStatus.includes('denied');
                allCount++;
                if (isApproved) approvedCount++;
                else if (isRejected) rejectedCount++;
                else pendingCount++;
            });

            const bAll = document.getElementById('leave-badge-all');
            const bPending = document.getElementById('leave-badge-pending');
            const bApproved = document.getElementById('leave-badge-approved');
            const bRejected = document.getElementById('leave-badge-rejected');
            if (bAll) bAll.innerText = allCount;
            if (bPending) bPending.innerText = pendingCount;
            if (bApproved) bApproved.innerText = approvedCount;
            if (bRejected) bRejected.innerText = rejectedCount;

            if (typeof updateSidebarPendingBadges === 'function') {
                updateSidebarPendingBadges(tableCache['Leave application']?.data || rawData || data);
            }

            // Update tab visual active state
            const currentTab = window.activeLeaveStatusFilter || 'all';
            ['all', 'pending', 'approved', 'rejected'].forEach(tabKey => {
                const btn = document.getElementById(`leave-tab-${tabKey}`);
                if (!btn) return;
                if (tabKey === currentTab) {
                    if (tabKey === 'pending') {
                        btn.className = 'leave-status-tab px-4 py-2.5 rounded-2xl text-xs font-black transition-all flex items-center gap-2 bg-amber-500 text-white shadow-md border border-amber-500';
                        btn.querySelector('i')?.classList.remove('text-amber-500');
                        btn.querySelector('i')?.classList.add('text-white');
                    } else if (tabKey === 'approved') {
                        btn.className = 'leave-status-tab px-4 py-2.5 rounded-2xl text-xs font-black transition-all flex items-center gap-2 bg-emerald-600 text-white shadow-md border border-emerald-600';
                        btn.querySelector('i')?.classList.remove('text-emerald-500');
                        btn.querySelector('i')?.classList.add('text-white');
                    } else if (tabKey === 'rejected') {
                        btn.className = 'leave-status-tab px-4 py-2.5 rounded-2xl text-xs font-black transition-all flex items-center gap-2 bg-red-500 text-white shadow-md border border-red-500';
                        btn.querySelector('i')?.classList.remove('text-red-500');
                        btn.querySelector('i')?.classList.add('text-white');
                    } else {
                        btn.className = 'leave-status-tab px-4 py-2.5 rounded-2xl text-xs font-black transition-all flex items-center gap-2 bg-brandindigo text-white shadow-md border border-brandindigo';
                    }
                } else {
                    if (tabKey === 'pending') {
                        btn.className = 'leave-status-tab px-4 py-2.5 rounded-2xl text-xs font-black transition-all flex items-center gap-2 bg-white text-gray-600 hover:bg-amber-50 hover:text-amber-600 border border-gray-200 shadow-2xs';
                        btn.querySelector('i')?.classList.remove('text-white');
                        btn.querySelector('i')?.classList.add('text-amber-500');
                    } else if (tabKey === 'approved') {
                        btn.className = 'leave-status-tab px-4 py-2.5 rounded-2xl text-xs font-black transition-all flex items-center gap-2 bg-white text-gray-600 hover:bg-emerald-50 hover:text-emerald-600 border border-gray-200 shadow-2xs';
                        btn.querySelector('i')?.classList.remove('text-white');
                        btn.querySelector('i')?.classList.add('text-emerald-500');
                    } else if (tabKey === 'rejected') {
                        btn.className = 'leave-status-tab px-4 py-2.5 rounded-2xl text-xs font-black transition-all flex items-center gap-2 bg-white text-gray-600 hover:bg-red-50 hover:text-red-600 border border-gray-200 shadow-2xs';
                        btn.querySelector('i')?.classList.remove('text-white');
                        btn.querySelector('i')?.classList.add('text-red-500');
                    } else {
                        btn.className = 'leave-status-tab px-4 py-2.5 rounded-2xl text-xs font-black transition-all flex items-center gap-2 bg-white text-gray-600 hover:bg-indigo-50 hover:text-brandindigo border border-gray-200 shadow-2xs';
                    }
                }
            });

            // Filter displayData by active tab
            let displayData = data;
            if (currentTab === 'pending') {
                displayData = data.filter(row => {
                    let rawStatus = String(getFuzzyValue(row, ['signature', 'status', 'อนุมัติ', 'approval_status']) || 'Pending').toLowerCase().trim();
                    let isApproved = rawStatus.includes('approve') || rawStatus.includes('hr') || rawStatus.includes('อนุมัติ') || rawStatus.includes('อนุญาต') || rawStatus.includes('dept head') || rawStatus.includes('ceo') || rawStatus.includes('coo') || rawStatus.includes('cfo');
                    let isRejected = rawStatus.includes('reject') || rawStatus.includes('ไม่อนุมัติ') || rawStatus.includes('ปฏิเสธ') || rawStatus.includes('denied');
                    return !isApproved && !isRejected;
                });
            } else if (currentTab === 'approved') {
                displayData = data.filter(row => {
                    let rawStatus = String(getFuzzyValue(row, ['signature', 'status', 'อนุมัติ', 'approval_status']) || 'Pending').toLowerCase().trim();
                    return rawStatus.includes('approve') || rawStatus.includes('hr') || rawStatus.includes('อนุมัติ') || rawStatus.includes('อนุญาต') || rawStatus.includes('dept head') || rawStatus.includes('ceo') || rawStatus.includes('coo') || rawStatus.includes('cfo');
                });
            } else if (currentTab === 'rejected') {
                displayData = data.filter(row => {
                    let rawStatus = String(getFuzzyValue(row, ['signature', 'status', 'อนุมัติ', 'approval_status']) || 'Pending').toLowerCase().trim();
                    return rawStatus.includes('reject') || rawStatus.includes('ไม่อนุมัติ') || rawStatus.includes('ปฏิเสธ') || rawStatus.includes('denied');
                });
            }

            const totalCountDiv = document.getElementById('table-total-count');
            if (totalCountDiv) totalCountDiv.classList.remove('hidden');

            const rowsCountEl = document.getElementById('display-total-rows');
            if (rowsCountEl) rowsCountEl.innerText = displayData.length;

            const totalDaysSpan = document.getElementById('display-total-days');
            const sumDaysEl = document.getElementById('sum-leave-days');
            if (totalDaysSpan && sumDaysEl) {
                totalDaysSpan.classList.remove('hidden');
                let sumLeaveDays = 0;
                displayData.forEach(r => {
                    let d = parseFloat(getFuzzyValue(r, ['total_days', 'total days', 'days', 'จำนวนวัน', 'ມື້'])) || 0;
                    sumLeaveDays += d;
                });
                sumDaysEl.innerText = sumLeaveDays;
            }

            if (displayData.length === 0) {
                let noRecordsTxt = window.t ? window.t('no_records') : 'No records found';
                cardWrapper.innerHTML = '<div class="col-span-full flex flex-col items-center justify-center py-20 text-gray-400 bg-gray-50 rounded-3xl border border-dashed border-gray-200"><i class="fa-regular fa-folder-open text-6xl mb-4 text-gray-300"></i><p class="font-bold tracking-widest uppercase text-sm">' + noRecordsTxt + '</p></div>';
                return;
            }

            displayData.forEach(row => {
                const isEmpty = currentHeaders.every(h => !row[h] || String(row[h]).trim() === '');
                if (isEmpty) return;

                const rowId = getRecordId(row);
                const encodedRow = encodeURIComponent(JSON.stringify(row)).replace(/'/g, "%27");

                let empId = String(getFuzzyValue(row, ['employee_id', 'emp_id', 'id_leave', 'id'])).toUpperCase().trim();
                let staffMatch = staffRows.find(s => String(s.employee_id || s.emp_id).toUpperCase().trim() === empId);

                let firstName = getFuzzyValue(row, ['first_name', 'ชื่อ', 'name']) || '';
                let lastName = getFuzzyValue(row, ['last_name', 'นามสกุล']) || '';
                let rawName = `${firstName} ${lastName}`.trim();
                let fullName = (staffMatch ? (staffMatch.name || staffMatch.full_name || `${staffMatch.first_name || ''} ${staffMatch.last_name || ''}`.trim()) : '') || rawName || getFuzzyValue(row, ['full_name', 'name', 'first_name', 'ชื่อ-นามสกุล', 'ชื่อ']) || empId;

                let profilePic = (staffMatch ? (staffMatch.profile || staffMatch.pic || staffMatch.image) : '') || getFuzzyValue(row, ['photo', 'profile', 'pic', 'image']);
                if (!profilePic || profilePic === '-' || profilePic.trim() === '') {
                    profilePic = `https://ui-avatars.com/api/?background=fef3c7&color=d97706&name=${encodeURIComponent(fullName)}`;
                }

                let deptName = getFuzzyValue(row, ['department_id', 'department', 'แผนก', 'ພະແນກ']) || (staffMatch ? (staffMatch.department || staffMatch.department_id) : '') || '';
                let posName = getFuzzyValue(row, ['position_id', 'position', 'ตำแหน่ง', 'ຕຳແໜ່ງ']) || (staffMatch ? (staffMatch.position || staffMatch.position_id) : '') || '';
                let contact = getFuzzyValue(row, ['contact', 'phone', 'เบอร์โทร', 'ເບີໂທ']) || (staffMatch ? staffMatch.contact : '') || '';
                let leaveType = getFuzzyValue(row, ['type', 'Type ', 'TYPE', 'ประเภท', 'ประเภทการลา', 'ປະເພດ']) || 'Leave';
                let startDate = getFuzzyValue(row, ['start_date', 'เริ่ม', 'วันที่เริ่ม', 'ວັນທີເລີ່ມ']) || '-';
                let endDate = getFuzzyValue(row, ['end_date', 'สิ้นสุด', 'วันที่สิ้นสุด', 'ວັນທີສິ້ນສຸດ']) || '-';
                let totalDays = getFuzzyValue(row, ['total_days', 'total days', 'days', 'จำนวนวัน', 'ມື້']) || '1';
                let reason = getFuzzyValue(row, ['object', 'Object ', 'OBJECT', 'reason', 'วัตถุประสงค์', 'สาเหตุ', 'ເຫດຜົນ']) || '';
                let handover = getFuzzyValue(row, ['work handover', 'work_handover', 'WORK HANDOVER', 'ส่งมอบงาน', 'ມອບວຽກ']) || '';
                let photoUrl = getFuzzyValue(row, ['photo', 'รูป', 'pic', 'image', 'รูปภาพ', 'attachment']) || '';

                if (photoUrl && photoUrl.includes('drive.google.com')) {
                    let fileId = '';
                    if (photoUrl.includes('id=')) fileId = photoUrl.split('id=')[1].split('&')[0];
                    else if (photoUrl.includes('/d/')) fileId = photoUrl.split('/d/')[1].split('/')[0];
                    if (fileId) photoUrl = 'https://drive.google.com/thumbnail?id=' + fileId + '&sz=w800';
                }

                let signatureCol = currentHeaders.find(h => ['signature', 'status', 'approval_status', 'อนุมัติ', 'ลายเซ็น'].includes(String(h).toLowerCase().trim())) || 'SIGNATURE';
                let rawStatus = String(getFuzzyValue(row, ['signature', 'status', 'อนุมัติ', 'approval_status']) || 'Pending').trim();

                let isApproved = rawStatus.toLowerCase().includes('approve') || rawStatus.toLowerCase().includes('hr') || rawStatus.toLowerCase().includes('อนุมัติ') || rawStatus.toLowerCase().includes('อนุญาต') || rawStatus.toLowerCase().includes('dept head') || rawStatus.toLowerCase().includes('ceo') || rawStatus.toLowerCase().includes('coo') || rawStatus.toLowerCase().includes('cfo');
                let isRejected = rawStatus.toLowerCase().includes('reject') || rawStatus.toLowerCase().includes('ไม่อนุมัติ') || rawStatus.toLowerCase().includes('ปฏิเสธ') || rawStatus.toLowerCase().includes('denied');
                let isPending = !isApproved && !isRejected;

                let statusBadge = '';
                let statusAccent = 'bg-amber-400';
                let cardBorder = 'border-gray-100 hover:border-amber-300';

                if (isApproved) {
                    statusBadge = `<span class="px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-600 border border-emerald-200 flex items-center gap-1"><i class="fa-solid fa-check"></i> ${escapeHtml(rawStatus)}</span>`;
                    statusAccent = 'bg-emerald-500';
                    cardBorder = 'border-emerald-100/80 hover:border-emerald-300';
                } else if (isRejected) {
                    statusBadge = `<span class="px-2.5 py-1 rounded-full text-[10px] font-bold bg-red-50 text-red-500 border border-red-100 flex items-center gap-1"><i class="fa-solid fa-xmark"></i> ${escapeHtml(rawStatus)}</span>`;
                    statusAccent = 'bg-red-500';
                    cardBorder = 'border-red-100/80 hover:border-red-300';
                } else {
                    statusBadge = `<span class="px-2.5 py-1 rounded-full text-[10px] font-bold bg-amber-50 text-amber-600 border border-amber-200 flex items-center gap-1"><i class="fa-solid fa-clock"></i> ${escapeHtml(rawStatus || 'Pending')}</span>`;
                    statusAccent = 'bg-amber-400';
                    cardBorder = 'border-amber-100/80 hover:border-amber-300';
                }

                let cardArr = [];
                cardArr.push(`<div class="bg-white rounded-3xl p-5 md:p-6 shadow-sm border ${cardBorder} hover:shadow-lg transition-all duration-300 flex flex-col justify-between group relative overflow-hidden">`);
                cardArr.push(`<div class="absolute top-0 left-0 right-0 h-1.5 ${statusAccent}"></div>`);

                cardArr.push(`<div>`);
                // Header: Profile Avatar + Name + EmpId + Dept + Status Badge
                cardArr.push(`<div class="flex items-start justify-between gap-3 mb-4">`);
                cardArr.push(`  <div class="flex items-center gap-3 min-w-0">`);
                cardArr.push(`    <img src="${profilePic}" class="w-12 h-12 rounded-2xl object-cover border border-gray-100 shadow-sm flex-shrink-0" onerror="this.src='https://ui-avatars.com/api/?background=fef3c7&color=d97706&name=${encodeURIComponent(fullName)}'">`);
                cardArr.push(`    <div class="min-w-0">`);
                cardArr.push(`      <h4 class="text-sm md:text-base font-black text-gray-900 leading-snug truncate" title="${escapeHtml(fullName)}">${escapeHtml(fullName)}</h4>`);
                cardArr.push(`      <div class="flex items-center gap-2 mt-0.5 flex-wrap">`);
                cardArr.push(`        <span class="text-[10px] font-bold text-gray-500 bg-gray-100 px-2 py-0.5 rounded-md">${escapeHtml(empId)}</span>`);
                if (deptName) cardArr.push(`        <span class="text-[10px] font-medium text-gray-400 truncate max-w-[130px]"><i class="fa-regular fa-building text-[9px] mr-1"></i>${escapeHtml(deptName)}</span>`);
                if (posName) cardArr.push(`        <span class="text-[10px] font-medium text-indigo-500 bg-indigo-50 px-1.5 py-0.5 rounded">${escapeHtml(posName)}</span>`);
                cardArr.push(`      </div>`);
                cardArr.push(`    </div>`);
                cardArr.push(`  </div>`);
                cardArr.push(`  <div class="flex-shrink-0">${statusBadge}</div>`);
                cardArr.push(`</div>`);

                // Main Info Box: Leave Type + Total Days + Period + Reason
                cardArr.push(`<div class="bg-gradient-to-br from-amber-50/70 via-orange-50/40 to-yellow-50/60 rounded-2xl p-3.5 border border-amber-100/80 mb-3 space-y-2">`);
                cardArr.push(`  <div class="flex items-center justify-between gap-2 flex-wrap">`);
                cardArr.push(`    <span class="bg-amber-500 text-white font-black text-[11px] px-2.5 py-0.5 rounded-lg shadow-sm flex items-center gap-1.5">`);
                cardArr.push(`      <i class="fa-solid fa-tag text-[9px]"></i> ${escapeHtml(leaveType)}`);
                cardArr.push(`    </span>`);
                cardArr.push(`    <span class="text-amber-900 font-black text-xs bg-white/90 border border-amber-200 px-2.5 py-0.5 rounded-lg shadow-2xs">`);
                cardArr.push(`      <i class="fa-solid fa-clock-rotate-left text-[10px] text-amber-500 mr-1"></i>${escapeHtml(totalDays)} ${t('days_unit') || 'ມື້'}`);
                cardArr.push(`    </span>`);
                cardArr.push(`  </div>`);

                cardArr.push(`  <div class="flex items-center gap-2 text-gray-800 text-xs font-bold pt-1">`);
                cardArr.push(`    <i class="fa-regular fa-calendar-days text-amber-500 text-sm flex-shrink-0"></i>`);
                cardArr.push(`    <span class="tracking-wide">${escapeHtml(startDate)} <span class="text-gray-400 font-normal">➔</span> ${escapeHtml(endDate)}</span>`);
                cardArr.push(`  </div>`);

                if (reason && reason !== '-') {
                    cardArr.push(`  <div class="text-[11px] text-gray-600 font-medium bg-white/80 rounded-xl p-2.5 border border-amber-100/70 mt-1.5 flex items-start gap-1.5">`);
                    cardArr.push(`    <i class="fa-regular fa-comment-dots text-amber-400 mt-0.5 text-xs flex-shrink-0"></i>`);
                    cardArr.push(`    <span class="italic leading-relaxed">${escapeHtml(reason)}</span>`);
                    cardArr.push(`  </div>`);
                }
                cardArr.push(`</div>`);

                // Additional Info: Contact + Work Handover
                if ((contact && contact !== '-') || (handover && handover !== '-')) {
                    cardArr.push(`<div class="grid grid-cols-2 gap-2 text-[10px] text-gray-500 mb-3 px-1">`);
                    if (contact && contact !== '-') {
                        cardArr.push(`  <div class="flex items-center gap-1.5 truncate">`);
                        cardArr.push(`    <i class="fa-solid fa-phone text-gray-400 flex-shrink-0"></i>`);
                        cardArr.push(`    <span class="truncate font-semibold text-gray-700">${escapeHtml(contact)}</span>`);
                        cardArr.push(`  </div>`);
                    } else {
                        cardArr.push(`  <div></div>`);
                    }
                    if (handover && handover !== '-') {
                        cardArr.push(`  <div class="flex items-center gap-1.5 truncate justify-end" title="${escapeHtml(handover)}">`);
                        cardArr.push(`    <i class="fa-solid fa-user-gear text-gray-400 flex-shrink-0"></i>`);
                        cardArr.push(`    <span class="truncate">ມອບວຽກ: ${escapeHtml(handover)}</span>`);
                        cardArr.push(`  </div>`);
                    } else {
                        cardArr.push(`  <div></div>`);
                    }
                    cardArr.push(`</div>`);
                }

                cardArr.push(`</div>`); // End top content

                // Card Footer: Approver Dropdown & Action Buttons (Edit, Delete, Attachment)
                cardArr.push(`<div class="pt-3 border-t border-gray-100 flex items-center justify-between gap-2 mt-auto">`);
                cardArr.push(`  <div class="flex-1 min-w-0">`);
                if (canEdit || role !== 'Staff') {
                    cardArr.push(`    <select onchange="changeApprovalStatus('${rowId}', '${signatureCol}', this)" class="bg-gray-50 hover:bg-gray-100 border border-gray-200 text-gray-800 text-[11px] font-bold rounded-xl focus:ring-brandindigo focus:border-brandindigo block py-1.5 px-2.5 cursor-pointer outline-none transition-colors w-full shadow-2xs">`);
                    cardArr.push(`      <option value="" disabled selected>${t('change_status') || 'ປ່ຽນສະຖານະ...'}</option>`);
                    cardArr.push(`      <option value="Pending">⏳ Pending (รออนุมัติ)</option>`);
                    cardArr.push(`      <option value="Dept Head">✓ Approve (Dept Head)</option>`);
                    cardArr.push(`      <option value="HR Manager">✓ Approve (Manager)</option>`);
                    cardArr.push(`      <option value="HR Admin">✓ Approve (Admin)</option>`);
                    cardArr.push(`      <option value="CEO">✓ Approve (CEO)</option>`);
                    cardArr.push(`      <option value="Rejected">✗ Reject (ไม่อนุมัติ)</option>`);
                    cardArr.push(`    </select>`);
                } else {
                    cardArr.push(`    <span class="text-[10px] font-bold text-gray-400 uppercase tracking-widest">${escapeHtml(rawStatus)}</span>`);
                }
                cardArr.push(`  </div>`);

                cardArr.push(`  <div class="flex items-center gap-1 flex-shrink-0">`);
                if (photoUrl && photoUrl !== '-' && photoUrl.trim() !== '') {
                    cardArr.push(`    <button onclick="if(typeof showAttachmentPreview==='function'){showAttachmentPreview('${photoUrl}','Attachment')}else{window.open('${photoUrl}','_blank')}" class="w-8 h-8 rounded-xl bg-blue-50 hover:bg-blue-100 text-blue-600 flex items-center justify-center transition-colors shadow-2xs" title="View Attachment">`);
                    cardArr.push(`      <i class="fa-regular fa-image text-xs"></i>`);
                    cardArr.push(`    </button>`);
                }
                if (canEdit) {
                    cardArr.push(`    <button onclick="openFormModal('${encodedRow}')" class="w-8 h-8 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-brandindigo flex items-center justify-center transition-colors shadow-2xs" title="Edit">`);
                    cardArr.push(`      <i class="fa-solid fa-pen-to-square text-xs"></i>`);
                    cardArr.push(`    </button>`);
                }
                if (canDelete) {
                    cardArr.push(`    <button onclick="deleteRecord('${rowId}')" class="w-8 h-8 rounded-xl bg-red-50 hover:bg-red-100 text-red-500 flex items-center justify-center transition-colors shadow-2xs" title="Delete">`);
                    cardArr.push(`      <i class="fa-solid fa-trash-can text-xs"></i>`);
                    cardArr.push(`    </button>`);
                }
                cardArr.push(`  </div>`);

                cardArr.push(`</div>`); // End footer
                cardArr.push(`</div>`); // End card
                cardsHtml += cardArr.join('');
            });
        }

        cardWrapper.innerHTML = cardsHtml;
        return;

    } else {
        const leaveTabsContainer = document.getElementById('leave-status-tabs-container');
        if (leaveTabsContainer) leaveTabsContainer.classList.add('hidden');

        const leaveDateFilterWrapper = document.getElementById('leave-date-filter-wrapper');
        if (leaveDateFilterWrapper) leaveDateFilterWrapper.classList.add('hidden');

        tableWrapper.classList.remove('hidden');
        cardWrapper.classList.add('hidden');

        let qrBtn = document.getElementById('qr-scan-btn');
        if (qrBtn) {
            qrBtn.style.display = 'none';
        }
    }

    let displayHeaders = currentHeaders;
    if (currentSheet === 'Budget Request' || currentSheet === 'Budget_Requests' || String(currentSheet).toLowerCase().includes('budget')) {
        const hiddenBudgetFields = [
            'prefix', 'first_name', 'last_name', 'department_id', 'position_id',
            'title', 'description', 'dept_head_sign', 'approver_sign',
            'dept_head_img', 'approver_img', 'currency'
        ];
        displayHeaders = currentHeaders.filter(h => !hiddenBudgetFields.includes(String(h).toLowerCase().trim()));
    }

    if (!displayHeaders.length) {
        let noDataTxt = window.t ? window.t('no_data') : 'NO DATA FOUND';
        tBody.innerHTML = '<tr><td colspan="100%" class="text-center py-12 text-gray-400 font-bold tracking-widest uppercase">' + noDataTxt + '</td></tr>';
        return;
    }



    let trHead = '<tr>';
    displayHeaders.forEach(h => {
        const isPhotoColumn = /^(photo|photos|profile|pic|image)$/i.test(String(h).trim());
        let displayH = (currentSheet.toLowerCase() === 'user' && (h.toLowerCase().trim() === 'user name' || h.toLowerCase().trim() === 'username')) ? 'EMAIL' : h;
        let translatedH = window.t ? window.t(displayH) : displayH;
        trHead += `<th class="px-6 py-4 whitespace-nowrap font-bold tracking-widest text-gray-500 ${isPhotoColumn ? 'w-28 text-center' : ''}" data-i18n-th="${displayH}">${translatedH}</th>`;
    });
    if (canEdit || canDelete) {
        let actionTxt = window.t ? window.t('Action') : 'Action';
        trHead += `<th class="px-6 py-4 whitespace-nowrap text-center sticky right-0 bg-gray-50 z-10 shadow-[-10px_0_15px_-5px_rgba(0,0,0,0.05)] border-l border-gray-200 print-hide text-gray-500 font-bold tracking-widest">${actionTxt}</th>`;
    }
    trHead += `</tr>`;
    tHead.innerHTML = trHead;

    let htmlRows = '';

    if (data && data.length > 0) {
        if (currentSheet === 'Fingerprint_Logs') {
            data.sort((a, b) => {
                let rA = a.Date || a.date || (typeof getFuzzyValue === 'function' ? getFuzzyValue(a, ['date', 'วันที่']) : '');
                let rB = b.Date || b.date || (typeof getFuzzyValue === 'function' ? getFuzzyValue(b, ['date', 'วันที่']) : '');
                if (!rA || !rB) return 0;
                let dA = typeof parseDateStr === 'function' ? parseDateStr(rA) : new Date(rA);
                let dB = typeof parseDateStr === 'function' ? parseDateStr(rB) : new Date(rB);
                let tA = (dA && !isNaN(dA.getTime())) ? dA.getTime() : 0;
                let tB = (dB && !isNaN(dB.getTime())) ? dB.getTime() : 0;
                return tB - tA;
            });
        } else {
            // Sort by Employee_ID (natural alphanumeric: A001, A002... DMC001... MT001...)
            data.sort((a, b) => {
                let empIdA = (typeof getFuzzyValue === 'function' ? getFuzzyValue(a, ['employee_id', 'emp_id', 'employees id', 'id']) : '') || '';
                let empIdB = (typeof getFuzzyValue === 'function' ? getFuzzyValue(b, ['employee_id', 'emp_id', 'employees id', 'id']) : '') || '';

                if (empIdA && empIdB && empIdA !== '-' && empIdB !== '-') {
                    return String(empIdA).localeCompare(String(empIdB), undefined, { numeric: true, sensitivity: 'base' });
                }

                let valA = empIdA || (typeof getFuzzyValue === 'function' ? getFuzzyValue(a, ['first_name', 'name', 'full_name', 'email']) : '') || Object.values(a)[0] || '';
                let valB = empIdB || (typeof getFuzzyValue === 'function' ? getFuzzyValue(b, ['first_name', 'name', 'full_name', 'email']) : '') || Object.values(b)[0] || '';
                return String(valA).localeCompare(String(valB), undefined, { numeric: true, sensitivity: 'base' });
            });
        }
    }

    data.forEach(row => {
        const isEmpty = displayHeaders.every(h => {
            const v = (row[h] !== undefined && row[h] !== null) ? row[h] : (typeof getFuzzyValue === 'function' ? getFuzzyValue(row, [h, h.toLowerCase(), h.toLowerCase().replace(/_/g, ' ')]) : '');
            return v === undefined || v === null || String(v).trim() === '';
        });
        if (isEmpty) return;

        let tr = '<tr class="bg-white hover:bg-gray-50 transition-colors">';
        displayHeaders.forEach(h => {
            let val = (row[h] !== undefined && row[h] !== null) ? row[h] : (typeof getFuzzyValue === 'function' ? getFuzzyValue(row, [h, h.toLowerCase(), h.toLowerCase().replace(/_/g, ' ')]) : '');
            const lw = h.toLowerCase().trim();
            const isPhotoCol = /^(photo|photos|profile|pic|image)$/i.test(lw);

            if (isPhotoCol) {
                if (!val || val === '' || val === '-' || val === 'null' || val === 'undefined') {
                    if (typeof getFuzzyValue === 'function') {
                        val = getFuzzyValue(row, ['Photos', 'photos', 'photo', 'profile', 'pic', 'image', 'picture', 'Photo', 'PHOTOS']) || val;
                    }
                }
                if (typeof normalizeRatingPhoto === 'function') {
                    val = normalizeRatingPhoto(val, (typeof getFuzzyValue === 'function' ? getFuzzyValue(row, ['first_name', 'name', 'full_name']) : '') || row.Employee_ID || 'Pic');
                }
            }

            if (lw === 'full_name' || lw === 'full name' || lw === 'fullname' || lw === 'name' || lw === 'employee name' || lw === 'ชื่อ-นามสกุล' || lw === 'ชื่อพนักงาน') {
                const empId = String(row.Employee_ID || row.employee_id || row.Emp_ID || row.emp_id || '').toUpperCase().trim();
                const realName = getEmployeeFullName(empId, val);
                if (realName && realName !== '-') {
                    val = realName;
                }
            }

            if (lw === 'is evaluator' || lw === 'is_evaluator') {
                const isEval = String(val).toLowerCase() === 'true' || val === true || String(val).toLowerCase() === 'yes';
                let color = isEval ? 'bg-indigo-50 text-brandindigo border border-indigo-200' : 'bg-gray-50 text-gray-400 border border-gray-200';
                let displayText = isEval ? 'Yes' : 'No';
                val = `<span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold ${color}">${displayText}</span>`;
            }

            if (currentSheet === 'Fingerprint_Logs') {
                if (lw === 'ot_amount' || lw === 'ot amount' || lw === 'ot' || lw === 'ot_total') {
                    const rEmpId = String(row.Employee_ID || row.employee_id || '').trim().toUpperCase();
                    const staffCacheData = (typeof tableCache !== 'undefined' && tableCache['staff']) ? tableCache['staff'].data : [];
                    const rowStaff = (staffCacheData || []).find(s => String(s.Employee_ID || s.employee_id || '').trim().toUpperCase() === rEmpId);
                    const otCalculated = typeof calculateRowOt === 'function' ? calculateRowOt(row, rowStaff) : (parseFloat(val) || 0);

                    let rawDate = row.Date || row.date || (typeof getFuzzyValue === 'function' ? getFuzzyValue(row, ['Date', 'date', 'วันที่']) : '');
                    let dateObj = (typeof parseDateStr === 'function') ? parseDateStr(rawDate) : new Date(rawDate);
                    const isSunday = dateObj && !isNaN(dateObj.getTime()) && dateObj.getDay() === 0;

                    if (otCalculated > 0) {
                        val = `<span class="inline-flex items-center gap-1 font-bold text-emerald-600">${new Intl.NumberFormat('th-TH').format(otCalculated)}${isSunday ? ' <span class="px-1.5 py-0.5 rounded text-[10px] bg-amber-100 text-amber-800 font-bold">OT อา.</span>' : ''}</span>`;
                    } else {
                        val = `<span class="text-gray-300">0</span>`;
                    }
                } else if (lw === 'late_hours' || lw === 'late hours' || lw === 'late_hrs') {
                    let lateMins = 0;
                    let checkIn = row.Check_In || row.check_in || '';
                    let shiftStart = row.Shift_Start || row.shift_start || '';
                    if (checkIn && checkIn !== '-' && shiftStart && shiftStart !== '-') {
                        let inM = parseInt(String(checkIn).split(':')[0] || 0) * 60 + parseInt(String(checkIn).split(':')[1] || 0);
                        let stM = parseInt(String(shiftStart).split(':')[0] || 0) * 60 + parseInt(String(shiftStart).split(':')[1] || 0);
                        if (inM > stM) lateMins = inM - stM;
                    } else if (val && parseFloat(val) > 0) {
                        lateMins = Math.round(parseFloat(val) * 60);
                    }
                    val = lateMins > 0 ? `<span class="font-bold text-red-500">${lateMins} น.</span>` : `<span class="text-gray-300">-</span>`;
                } else if (lw === 'early_leave_hours' || lw === 'early leave hours' || lw === 'early_hrs') {
                    let earlyMins = 0;
                    let checkOut = row.Check_Out || row.check_out || '';
                    let shiftEnd = row.Shift_End || row.shift_end || '';
                    if (checkOut && checkOut !== '-' && shiftEnd && shiftEnd !== '-') {
                        let outM = parseInt(String(checkOut).split(':')[0] || 0) * 60 + parseInt(String(checkOut).split(':')[1] || 0);
                        let endM = parseInt(String(shiftEnd).split(':')[0] || 0) * 60 + parseInt(String(shiftEnd).split(':')[1] || 0);
                        if (outM < endM && outM > 0) earlyMins = endM - outM;
                    } else if (val && parseFloat(val) > 0) {
                        earlyMins = Math.round(parseFloat(val) * 60);
                    }
                    val = earlyMins > 0 ? `<span class="font-bold text-amber-500">${earlyMins} น.</span>` : `<span class="text-gray-300">-</span>`;
                }
            }

            if (lw.includes('status') || lw === 'signature' || lw.includes('role')) {
                const isBudgetSheet = currentSheet === 'Budget Request' || currentSheet === 'Budget_Requests' || String(currentSheet).toLowerCase().includes('budget');

                if (isBudgetSheet) {
                    const statusVal = String(val || row.Status || row.status || row.Signature || row.signature || '').trim();
                    const statusValLower = statusVal.toLowerCase();
                    const deptSignVal = String(row.dept_head_sign || row.Dept_Head_Sign || '').trim();
                    const approverSignVal = String(row.approver_sign || row.Approver_Sign || '').trim();

                    const hasDeptHeadSign = !!deptSignVal && !deptSignVal.startsWith('DEPT-');
                    const hasApproverSign = !!approverSignVal && !approverSignVal.startsWith('DEPT-');

                    let color = 'bg-amber-50 text-amber-600 border border-amber-200';
                    let displayText = 'รออนุมัติ (Pending)';

                    if (hasApproverSign || statusValLower === 'approved') {
                        color = 'bg-emerald-500 text-white font-bold shadow-sm';
                        displayText = 'Approved (อนุมัติแล้ว)';
                    } else if (hasDeptHeadSign || statusValLower.includes('dept head') || statusValLower.includes('checked')) {
                        color = 'bg-indigo-50 text-brandindigo border border-indigo-200 font-bold';
                        displayText = 'Checked (Dept Head)';
                    } else if (statusValLower.includes('reject')) {
                        color = 'bg-red-50 text-red-600 border border-red-200 font-bold';
                        displayText = 'Rejected (ไม่อนุมัติ)';
                    }

                    val = `<span class="inline-block px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${color}">${displayText}</span>`;
                } else {
                    const isApproved = val !== 'Pending' && val !== 'Rejected' && val !== '' && val !== '-';
                    let color = 'bg-gray-100 text-gray-600 border border-gray-200';
                    let displayText = val || '-';

                    if (['active', 'present', 'admin', 'hr', 'เข้างานแล้ว', 'เลิกงานแล้ว'].includes(val.toLowerCase())) { color = 'bg-emerald-50 text-emerald-600 border border-emerald-200'; }
                    else if (['inactive', 'missing out', 'absent', 'rejected', 'ขาดงาน'].includes(val.toLowerCase()) || val === 'Rejected') {
                        color = 'bg-red-50 text-red-600 border border-red-200'; displayText = val === 'Rejected' ? 'Rejected' : displayText;
                    }
                    else if (['pending', 'staff', 'on leave', 'ยังไม่ถึง'].includes(val.toLowerCase())) {
                        color = 'bg-amber-50 text-amber-600 border border-amber-200'; displayText = val === 'Pending' ? 'Pending' : displayText;
                    }
                    else if (['วันหยุด'].includes(val.toLowerCase()) || ['on leave', 'ON LEAVE'].includes(val.toUpperCase())) {
                        color = val.toUpperCase() === 'ON LEAVE' ? 'bg-yellow-50 text-yellow-600 border border-yellow-200' : 'bg-gray-100 text-gray-500 border border-gray-200';
                    }
                    else if (lw === 'signature' && isApproved) {
                        let displayRole = val;
                        if (val === 'Dept Head') displayRole = 'Dept Head (หัวหน้าแผนก)';
                        else if (val === 'HR Manager') displayRole = 'HR Manager (ผู้จัดการ)';
                        else if (val === 'HR Admin') displayRole = 'HR Admin (ผู้บริหาร)';
                        else if (val === 'CEO') displayRole = 'CEO';
                        else if (val === 'COO') displayRole = 'COO';
                        else if (val === 'CFO') displayRole = 'CFO';
                        color = 'bg-emerald-50 text-emerald-600 border border-emerald-200'; displayText = 'Approved (' + displayRole + ')';
                    }

                    if ((currentSheet.toLowerCase() === 'user' || currentSheet.toLowerCase() === 'users') && lw.includes('status')) {
                        const rowId = getRecordId(row);
                        const statusVal = typeof getUserStatus === 'function' ? getUserStatus(row) : String(val || row.Status || row.status || 'Active').trim();
                        const isDisabled = ['disabled', 'suspended', 'inactive', 'ระงับใช้งาน', 'ปิดใช้งาน'].includes(statusVal.toLowerCase());
                        const isAct = !isDisabled;
                        
                        let color = isAct ? 'bg-emerald-50 text-emerald-600 border border-emerald-200' : 'bg-red-50 text-red-600 border border-red-200';
                        let displayText = isAct ? 'Active' : 'Disabled';

                        const canManageStatus = role === 'Admin' || role === 'Super Admin' || String(role).toLowerCase().includes('admin') || String(role).toLowerCase().includes('super');
                        if (canManageStatus) {
                            val = `
                                <div class="flex items-center space-x-2">
                                    <span class="px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest ${color}">${displayText}</span>
                                    <select onchange="changeApprovalStatus('${rowId}', '${h}', this)" class="bg-white border border-gray-300 text-gray-800 text-xs font-bold rounded-lg focus:ring-brandindigo focus:border-brandindigo block py-1 px-1.5 cursor-pointer hover:bg-gray-50 outline-none transition-colors shadow-sm">
                                        <option value="Active" ${isAct ? 'selected' : ''}>Active (เปิดใช้งาน)</option>
                                        <option value="Disabled" ${isDisabled ? 'selected' : ''}>Disabled (ระงับใช้งาน)</option>
                                    </select>
                                </div>`;
                        } else {
                            val = `<span class="px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest ${color}">${displayText}</span>`;
                        }
                    } else if ((currentSheet.toLowerCase() === 'user' || currentSheet.toLowerCase() === 'users') && (lw === 'device_id' || lw === 'device id' || lw === 'device')) {
                        if (val && val !== '-' && val !== 'null' && val !== 'undefined') {
                            val = `<span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-mono font-bold bg-slate-100 text-slate-700 border border-slate-200" title="${val}"><i class="fa-solid fa-mobile-screen text-indigo-500"></i> ${String(val).substring(0, 15)}...</span>`;
                        } else {
                            val = `<span class="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-bold bg-amber-50 text-amber-600 border border-amber-200"><i class="fa-solid fa-triangle-exclamation"></i> ยังไม่ผูกเครื่อง</span>`;
                        }
                    } else if (currentSheet === 'Leave application' && lw === 'signature') {
                        const rowId = getRecordId(row);
                        if (canEdit || role !== 'Staff') {
                            val = `
                                    <div class="flex items-center space-x-3">
                                        <span class="px-3 py-1 rounded-md text-[10px] font-bold uppercase tracking-widest ${color}">${displayText}</span>
                                        <select onchange="changeApprovalStatus('${rowId}', '${h}', this)" class="bg-white border border-gray-300 text-gray-800 text-xs font-bold rounded-lg focus:ring-brandindigo focus:border-brandindigo block py-1.5 px-2 cursor-pointer hover:bg-gray-50 outline-none transition-colors shadow-sm">
                                            <option value="" disabled selected>Change Status...</option>
                                            <option value="Pending">Pending (รออนุมัติ)</option>
                                            <option value="Dept Head">Approve (Dept Head / หัวหน้าแผนก)</option>
                                            <option value="HR Manager">Approve (Manager / ผู้จัดการ)</option>
                                            <option value="HR Admin">Approve (HR Admin / ผู้บริหาร)</option>
                                            <option value="CEO">Approve (CEO)</option>
                                            <option value="COO">Approve (COO)</option>
                                            <option value="CFO">Approve (CFO)</option>
                                            <option value="Rejected">Reject (ไม่อนุมัติ)</option>
                                        </select>
                                    </div>`;
                        } else {
                            val = `<span class="px-3 py-1 rounded-md text-[10px] font-bold uppercase tracking-widest ${color}">${displayText}</span>`;
                        }
                    } else {
                        val = `<span class="px-3 py-1 rounded-md text-[10px] font-bold uppercase tracking-widest ${color}">${displayText}</span>`;
                    }
                }
            }
            if (lw === 'items') {
                const encodedRow = encodeURIComponent(JSON.stringify(row)).replace(/'/g, "%27");
                let count = 0;
                try {
                    let decoded = val;
                    if (String(decoded).includes('%')) {
                        try {
                            decoded = decodeURIComponent(decoded);
                        } catch (e) {}
                    }
                    const arr = JSON.parse(decoded || '[]');
                    if (Array.isArray(arr)) count = arr.length;
                } catch (e) { }

                if (count > 0) {
                    val = `
                                <button type="button" onclick="showBillDetailsModal('${encodedRow}')" class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-brandindigo border border-indigo-200 text-xs font-bold transition-all shadow-sm hover:shadow" title="ดูรายละเอียดบิล">
                                    <i class="fa-solid fa-receipt text-sm"></i>
                                    <span>บิล ${count} รายการ</span>
                                </button>
                            `;
                } else {
                    val = `<span class="text-xs text-gray-400 font-medium italic">- ไม่มีรายการบิล -</span>`;
                }
            }

            let valStr = String(val).trim();
            const isPhotoColumn = /^(photo|photos|profile|pic|image)$/i.test(String(h).trim());

            if (isPhotoColumn && typeof normalizeRatingPhoto === 'function') {
                valStr = normalizeRatingPhoto(valStr, (typeof getFuzzyValue === 'function' ? getFuzzyValue(row, ['first_name', 'name', 'full_name']) : '') || row.Employee_ID || 'Pic');
            }

            if (isPhotoColumn && valStr.includes('drive.google.com')) {
                let fileId = '';
                if (valStr.includes('id=')) fileId = valStr.split('id=')[1].split('&')[0];
                else if (valStr.includes('/d/')) fileId = valStr.split('/d/')[1].split('/')[0];
                if (fileId) valStr = 'https://drive.google.com/thumbnail?id=' + fileId + '&sz=w800';
            }

            const isImageData = /^data:image\//i.test(valStr) && valStr.length > 30;
            const isPdfData = /^data:application\/pdf(?:;base64)?,/i.test(valStr);
            const isPdfUrl = /\.pdf(?:[?#]|$)/i.test(valStr);

            if (isPhotoColumn) {
                if (isPdfData || isPdfUrl) {
                    val = `<button type="button" data-src="${valStr}" onclick="showAttachmentPreview(this.dataset.src, 'Attachment PDF')" class="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 text-xs font-bold transition-colors shadow-sm" title="Open PDF">
                                <i class="fa-solid fa-file-pdf text-base"></i><span>PDF</span>
                            </button>`;
                } else if (isImageData || /^https?:\/\//i.test(valStr) || /^blob:/i.test(valStr)) {
                    val = `<button type="button" onclick="showAttachmentPreview(this.querySelector('img').src, 'Profile photo')" class="block mx-auto rounded-full overflow-hidden border border-indigo-100 shadow-sm hover:shadow-md hover:scale-110 transition-all cursor-zoom-in group" title="Click to view photo">
                                <img src="${valStr}" alt="Profile photo" class="w-10 h-10 object-cover bg-gray-50 mx-auto" onerror="this.onerror=null; this.src='https://ui-avatars.com/api/?background=e0e7ff&color=4f46e5&name=Pic';">
                            </button>`;
                } else {
                    val = `<div class="w-10 h-10 rounded-full bg-indigo-50/60 border border-indigo-100 flex items-center justify-center mx-auto text-indigo-400 font-bold text-xs shadow-sm">
                                <i class="fa-solid fa-user text-xs"></i>
                            </div>`;
                }
            } else if (valStr.match(/^https?:\/\//i)) {
                let isImage = valStr.match(/\.(jpeg|jpg|gif|png|webp)(\?.*)?$/i) != null || valStr.toLowerCase().includes('drive.google.com');
                let linkIcon = isImage ? 'fa-image text-brandpurple' : 'fa-link text-brandindigo';
                let linkText = isImage ? 'View Image' : 'Open Link';

                val = `
                            <a href="${valStr}" target="_blank" rel="noopener noreferrer" class="inline-flex items-center px-4 py-2 rounded-xl bg-gray-50 hover:bg-gray-100 text-gray-700 hover:text-brandindigo transition-colors border border-gray-200 text-xs font-bold tracking-wide shadow-sm" title="${valStr}">
                                <i class="fa-solid ${linkIcon} mr-2 flex-shrink-0"></i>
                                <span>${linkText}</span>
                            </a>
                        `;
            }

            let alignClass = "";
            if (currentSheet === 'Fingerprint_Logs') {
                if (lw.includes('check_in') || lw.includes('check_out') || lw.includes('shift') || lw.includes('hours') || lw.includes('amount')) alignClass = "text-center";
            }

            tr += `<td class="px-6 py-5 font-medium text-gray-700 ${isPhotoColumn ? 'w-28 max-w-28 text-center overflow-hidden' : 'whitespace-nowrap'} ${alignClass}">${val}</td>`;
        });

        const rowId = getRecordId(row);
        const encodedRow = encodeURIComponent(JSON.stringify(row)).replace(/'/g, "%27");

        if (canEdit || canDelete) {
            tr += `<td class="px-6 py-5 whitespace-nowrap text-center sticky right-0 bg-white group-hover:bg-gray-50 shadow-[-10px_0_15px_-5px_rgba(0,0,0,0.05)] border-l border-gray-200 print-hide transition-colors">
                        <div class="flex justify-center space-x-2">
                            ${canEdit ? `<button onclick="openFormModal('${encodedRow}')" class="text-gray-400 hover:text-brandindigo hover:bg-indigo-50 p-2 rounded-xl transition-colors border border-transparent hover:border-indigo-100" title="Edit"><i class="fa-solid fa-pen-to-square"></i></button>` : ''}
                            ${canDelete ? `<button onclick="deleteRecord('${rowId}')" class="text-gray-400 hover:text-red-500 hover:bg-red-50 p-2 rounded-xl transition-colors border border-transparent hover:border-red-100" title="Delete"><i class="fa-solid fa-trash"></i></button>` : ''}
                        </div>
                    </td>`;
        }
        htmlRows += tr + '</tr>';
    });
    tBody.innerHTML = htmlRows;
}

function renderEmployeeRatingPageFromScratch(ratingRows) {
    const sessionStr = localStorage.getItem('hr_user_session') || sessionStorage.getItem('hr_user_session');
    let role = 'Staff';
    let loggedInEmpId = '';
    let userPerms = [];
    if (sessionStr) {
        try {
            const sessionData = JSON.parse(sessionStr);
            role = sessionData.role || 'Staff';
            loggedInEmpId = String(sessionData.empId || sessionData.employeeId || sessionData.username || '').trim().toUpperCase();
            if (sessionData.permissions) {
                userPerms = typeof parsePermissionsList === 'function' ? parsePermissionsList(sessionData.permissions) : sessionData.permissions;
            }
        } catch (e) { }
    }

    const sheetName = typeof currentSheet !== 'undefined' && currentSheet ? currentSheet : 'Employees Ranting';
    const isAdminUser = String(role).toLowerCase().includes('admin') || String(role).toLowerCase().includes('super');
    const canEdit = isAdminUser || (typeof hasActionPermission === 'function' ? hasActionPermission(sheetName, 'edit', userPerms) : (role !== 'Staff'));
    const canDelete = isAdminUser || (typeof hasActionPermission === 'function' ? hasActionPermission(sheetName, 'delete', userPerms) : (role !== 'Staff'));

    const cardWrapper = document.getElementById('card-wrapper');
    if (!cardWrapper) return;

    const staffCache = tableCache['staff'] || tableCache['Staff'];
    const staffRows = staffCache && Array.isArray(staffCache.data) ? staffCache.data : [];

    if (!staffRows.length) {
        cardWrapper.innerHTML = '<div class="col-span-full flex flex-col items-center justify-center py-20 text-gray-400 bg-gray-50 rounded-3xl border border-dashed border-gray-200"><i class="fa-solid fa-spinner fa-spin text-4xl mb-4 text-brandindigo"></i><p class="font-bold tracking-widest uppercase text-sm">Loading staff...</p></div>';
        google.script.run.withSuccessHandler(res => {
            if (res && res.success && Array.isArray(res.data)) {
                tableCache['staff'] = { headers: res.headers || [], data: res.data };
                renderEmployeeRatingPageFromScratch(ratingRows || []);
            } else {
                cardWrapper.innerHTML = '<div class="col-span-full flex flex-col items-center justify-center py-20 text-gray-400 bg-gray-50 rounded-3xl border border-dashed border-gray-200"><i class="fa-regular fa-folder-open text-6xl mb-4 text-gray-300"></i><p class="font-bold tracking-widest uppercase text-sm">No staff found</p></div>';
            }
        }).withFailureHandler(err => {
            cardWrapper.innerHTML = '<div class="col-span-full p-6 rounded-2xl bg-red-50 border border-red-100 text-red-600 font-bold">โหลดข้อมูล Staff ไม่สำเร็จ: ' + escapeHtml(err && err.message ? err.message : err) + '</div>';
        }).getSheetData('staff');
        return;
    }

    // editRatingByRowId is already defined globally in features.js
    // Always assign addRatingForEmpId so it's accessible from onclick attributes
    window.addRatingForEmpId = function (empId, empName, event) {
        if (event) event.stopPropagation();
        const template = {};
        (currentHeaders || []).forEach(h => {
            const key = String(h).toLowerCase().trim();
            template[h] = '';
            if (key === 'employees id' || key === 'employee_id' || key === 'emp_id') template[h] = empId;
            else if (key === 'employees name' || key === 'employee_name' || key === 'first_name' || key === 'name') template[h] = empName;
            else if (key === 'ranting date' || key === 'rating date' || key === 'date') template[h] = new Date().toISOString().slice(0, 10);
            else if (key === 'status') template[h] = 'Active';
            else if (key === 'give by' || key === 'give_by') {
                let sessionUser = {};
                try { sessionUser = JSON.parse(localStorage.getItem('hr_user_session') || sessionStorage.getItem('hr_user_session') || '{}'); } catch (e) { }
                template[h] = sessionUser.username || sessionUser.empId || '';
            }
        });
        openFormModal(encodeURIComponent(JSON.stringify(template)).replace(/'/g, "%27"));
    };

    const ratingByEmp = {};
    (ratingRows || []).forEach(row => {
        const empId = String(getFuzzyValue(row, ['employees id', 'employee_id', 'emp_id'])).trim();
        if (!empId || empId === '-') return;
        const key = empId.toLowerCase();
        let pts = parseFloat(getFuzzyValue(row, ['star point', 'star_point', 'rating', 'score'])) || 0;
        if (pts > 0 && pts <= 5) {
            pts = pts * 100; // 1 star = 100 points
        }

        if (!ratingByEmp[key]) ratingByEmp[key] = { total: 0, count: 0, latestComment: '', latestRowId: '', categoryScores: {} };
        ratingByEmp[key].total += pts;
        ratingByEmp[key].count += 1;

        const category = getFuzzyValue(row, ['Category ', 'category']);
        if (category && category !== '-') ratingByEmp[key].categoryScores[String(category).trim()] = pts;

        const comment = getFuzzyValue(row, ['comment', 'review', 'remark']);
        if (comment && comment !== '-') ratingByEmp[key].latestComment = comment;

        ratingByEmp[key].latestRowId = getRecordId(row);
    });

    let visibleStaff = staffRows.filter(row => {
        const empId = String(getFuzzyValue(row, ['employee_id', 'emp_id', 'employees id']) || '').trim().toUpperCase();
        if (!empId || empId === '-') return false;
        if (role === 'Staff') {
            return empId === loggedInEmpId;
        }
        return true;
    });

    const searchInput = document.getElementById('searchInput');
    const keyword = searchInput ? searchInput.value.toLowerCase().trim() : '';

    if (keyword) {
        const terms = keyword.split(/\s+/).filter(Boolean);
        const matched = [];

        visibleStaff.forEach(staff => {
            const empId = String(getFuzzyValue(staff, ['employee_id', 'emp_id', 'employees id']) || '').trim().toLowerCase();
            const fName = String(getFuzzyValue(staff, ['first_name', 'name', 'full_name']) || '').trim().toLowerCase();
            const lName = String(getFuzzyValue(staff, ['last_name', 'นามสกุล']) || '').trim().toLowerCase();
            const fullName = `${fName} ${lName}`.trim().toLowerCase();
            const email = String(getFuzzyValue(staff, ['email', 'contact']) || '').trim().toLowerCase();
            const position = String(getFuzzyValue(staff, ['position_id', 'position']) || '').trim().toLowerCase();
            const department = String(getFuzzyValue(staff, ['department_id', 'department']) || '').trim().toLowerCase();

            const searchHaystack = `${empId} ${fName} ${lName} ${fullName} ${email} ${position} ${department}`;

            const isMatch = terms.every(term => searchHaystack.includes(term));
            if (isMatch) {
                let score = 0;
                if (empId === keyword || fName === keyword || fullName === keyword) {
                    score += 100;
                } else if (fullName.startsWith(keyword) || fName.startsWith(keyword) || empId.startsWith(keyword)) {
                    score += 50;
                } else {
                    score += 10;
                }
                matched.push({ staff, score });
            }
        });

        matched.sort((a, b) => b.score - a.score);
        visibleStaff = matched.map(m => m.staff);
    }

    if (!visibleStaff.length) {
        cardWrapper.innerHTML = '<div class="col-span-full flex flex-col items-center justify-center py-20 text-gray-400 bg-gray-50 rounded-3xl border border-dashed border-gray-200"><i class="fa-regular fa-folder-open text-6xl mb-4 text-gray-300"></i><p class="font-bold tracking-widest uppercase text-sm">ไม่พบพนักงานที่ค้นหา</p></div>';
        return;
    }

    let html = '';
    visibleStaff.forEach(staff => {
        const empId = String(getFuzzyValue(staff, ['employee_id', 'emp_id', 'employees id'])).trim();
        const firstName = getFuzzyValue(staff, ['first_name', 'name', 'full_name']) || empId;
        const position = getFuzzyValue(staff, ['position_id', 'position']) || 'Staff';
        const department = getFuzzyValue(staff, ['department_id', 'department']) || 'General';
        const photo = normalizeRatingPhoto(getFuzzyValue(staff, ['photos', 'photo', 'profile', 'image', 'pic']), firstName);
        const stat = ratingByEmp[empId.toLowerCase()] || { total: 0, count: 0, latestComment: '', latestRowId: '', categoryScores: {} };
        const totalPoints = stat.total;
        const starVal = Math.min(5, Math.max(0, totalPoints / 100));

        let starsHtml = '<div class="flex items-center justify-center gap-1.5 my-2" title="' + Math.round(totalPoints) + ' คะแนน = ' + (Math.round(starVal * 10) / 10) + ' ดาว">';
        for (let i = 1; i <= 5; i++) {
            let pct = 0;
            if (starVal >= i) pct = 100;
            else if (starVal > i - 1) pct = Math.round((starVal - (i - 1)) * 100);
            
            starsHtml += `
                <div class="relative inline-block text-2xl">
                    <i class="fa-solid fa-star text-gray-200"></i>
                    ${pct > 0 ? `
                        <div class="absolute top-0 left-0 overflow-hidden h-full text-[#FACC15] transition-all duration-300" style="width: ${pct}%">
                            <i class="fa-solid fa-star"></i>
                        </div>
                    ` : ''}
                </div>
            `;
        }
        starsHtml += '</div>';

        const safeEmp = escapeHtml(empId);
        const safeName = escapeHtml(firstName);
        const safePosition = escapeHtml(position);
        const safeDept = escapeHtml(department);
        const safeComment = escapeHtml(stat.latestComment || (t('no_comment') || 'No comments yet'));
        const safeNameUrl = encodeURIComponent(firstName);
        const safeNameJs = String(firstName).replace(/\\/g, '\\\\').replace(/'/g, "\\'");

        const safeRowId = String(stat.latestRowId || '').replace(/\\/g, '\\\\').replace(/'/g, "\\'");

        html += `
                    <div class="bg-white rounded-3xl hover:shadow-2xl transition-all duration-300 overflow-hidden flex flex-col group relative border border-gray-200 w-full max-w-[320px] mx-auto pb-5">
                        
                        <!-- Purple Banner Top -->
                        <div class="h-[120px] w-full bg-gradient-to-r from-purple-600 via-indigo-600 to-brandindigo relative overflow-hidden">
                            <div class="absolute -right-6 -bottom-6 w-24 h-24 bg-white/10 rounded-full blur-xl"></div>
                        </div>
                        
                        <!-- Circular Avatar Overlapping Top Banner -->
                        <div class="relative -mt-[48px] flex justify-center z-10">
                            <div class="w-[96px] h-[96px] rounded-full border-4 border-white overflow-hidden bg-white shadow-xl shadow-purple-500/10">
                                <img src="${photo}" onerror="this.src='https://ui-avatars.com/api/?background=e0e7ff&color=4f46e5&bold=true&name=${encodeURIComponent(firstName)}'" class="w-full h-full object-cover" alt="Profile">
                            </div>
                        </div>

                        <!-- Name & Badges -->
                        <div class="text-center px-5 mt-2">
                            <h2 class="text-xl font-extrabold text-gray-900 mb-1.5 tracking-tight">${safeName}</h2>
                            <div class="flex items-center justify-center gap-1.5 flex-wrap">
                                <span class="text-[10px] font-extrabold text-indigo-700 bg-indigo-50 px-2.5 py-0.5 rounded-md border border-indigo-100 uppercase tracking-wider">${safePosition}</span>
                                <span class="text-[10px] font-semibold text-gray-600 bg-gray-100 px-2 py-0.5 rounded-md">ID: ${safeEmp}</span>
                                <span class="text-[10px] font-semibold text-purple-700 bg-purple-50 px-2 py-0.5 rounded-md">${safeDept}</span>
                            </div>
                        </div>

                        <!-- Proportional Star Rating Display -->
                        <div class="px-5 mt-3 text-center">
                            ${starsHtml}
                            <p class="text-[11px] font-extrabold text-indigo-600 tracking-wide mt-1">
                                ${Math.round(totalPoints)} Score = ${(Math.round(starVal * 10) / 10)} Star
                            </p>
                            <h3 class="text-2xl font-black tracking-wider uppercase text-transparent bg-clip-text bg-gradient-to-r from-purple-600 to-indigo-600 mt-0.5 mb-2">STK WOW</h3>
                        </div>

                        <!-- Action Toolbar Row at Bottom of Card -->
                        <div class="flex justify-center items-center gap-2 px-4 mt-auto pt-3 border-t border-gray-100">
                            <button onclick="showRatingHistory('${safeEmp}', '${safeNameJs}')" class="w-8 h-8 rounded-full bg-gray-100 hover:bg-blue-50 text-gray-500 hover:text-blue-600 flex items-center justify-center transition-all shadow-sm" title="ประวัติการให้ดาว">
                                <i class="fa-solid fa-clock-rotate-left text-xs"></i>
                            </button>
                            <button onclick="showEmpQRCode('${safeEmp}', '${safeNameUrl}')" class="w-8 h-8 rounded-full bg-gray-100 hover:bg-indigo-50 text-gray-500 hover:text-brandindigo flex items-center justify-center transition-all shadow-sm" title="QR Code">
                                <i class="fa-solid fa-qrcode text-xs"></i>
                            </button>
                            ${role !== 'Staff' ? `
                                <button onclick="addRatingForEmpId('${safeEmp}', '${safeNameJs}', event)" class="w-8 h-8 rounded-full bg-emerald-50 hover:bg-emerald-500 text-emerald-600 hover:text-white flex items-center justify-center transition-all shadow-sm" title="ให้ดาว">
                                    <i class="fa-solid fa-star text-xs"></i>
                                </button>
                            ` : ''}
                            ${stat.latestRowId && role !== 'Staff' ? `
                                <button onclick="editRatingByRowId('${safeRowId}', event)" class="w-8 h-8 rounded-full bg-gray-100 hover:bg-purple-50 text-gray-500 hover:text-purple-600 flex items-center justify-center transition-all shadow-sm" title="แก้ไขคะแนนล่าสุด">
                                    <i class="fa-solid fa-pen-to-square text-xs"></i>
                                </button>
                            ` : ''}
                            ${stat.latestRowId && (canDelete || canEdit) ? `
                                <button onclick="event.stopPropagation(); deleteRecord('${safeRowId}')" class="w-8 h-8 rounded-full bg-gray-100 hover:bg-red-50 text-gray-500 hover:text-red-600 flex items-center justify-center transition-all shadow-sm" title="ลบ">
                                    <i class="fa-solid fa-trash text-xs"></i>
                                </button>
                            ` : ''}
                        </div>

                    </div>`;
    });
    cardWrapper.innerHTML = html;
}

/* =====================================================================
 * 📌 ส่วนที่ 18: DATA EXPORT ENGINE (Export Excel & Export PDF Functions)
 * ===================================================================== */
let pendingExportType = null;
let pendingExportSheet = null;

function getActiveTableExportData() {
    let dataToExport = [];
    if (typeof filteredData !== 'undefined' && Array.isArray(filteredData) && filteredData.length > 0) {
        dataToExport = [...filteredData];
    } else if (tableCache[currentSheet] && Array.isArray(tableCache[currentSheet].data) && tableCache[currentSheet].data.length > 0) {
        dataToExport = [...tableCache[currentSheet].data];
    } else if (typeof rawData !== 'undefined' && Array.isArray(rawData) && rawData.length > 0) {
        dataToExport = [...rawData];
    }

    let empIdFilter = '';
    const calEmpInput = document.getElementById('calendarEmpId');
    const searchInput = document.getElementById('searchInput');

    if (calEmpInput && calEmpInput.value.trim()) {
        empIdFilter = calEmpInput.value.trim().toUpperCase();
    } else if (searchInput && searchInput.value.trim() && (currentSheet === 'Fingerprint_Logs' || currentSheet === 'Attendance_Logs')) {
        empIdFilter = searchInput.value.trim().toUpperCase();
    }

    let calMonthInput = document.getElementById('calendarMonth');
    let calYearInput = document.getElementById('calendarYear');
    let periodMode = window._attendancePeriodMode || 'month';
    let tYear = new Date().getFullYear();
    let tMonth = (periodMode === 'year') ? null : (new Date().getMonth() + 1);

    if (periodMode === 'year') {
        tYear = parseInt(calYearInput && calYearInput.value ? calYearInput.value : tYear);
        // กรองรายปีในข้อมูลก่อน fillMissingDays
        dataToExport = dataToExport.filter(row => {
            let rDate = String(row.Date || row.date || '');
            let p = rDate.split('/');
            if (p.length === 3 && parseInt(p[2]) === tYear) return true;
            let p2 = rDate.split('-');
            if (p2.length === 3 && parseInt(p2[0]) === tYear) return true;
            return false;
        });
    } else {
        if (calMonthInput && calMonthInput.value.trim()) {
            const mp = calMonthInput.value.trim().split('-');
            if (mp.length === 2) {
                tYear = parseInt(mp[0], 10);
                tMonth = parseInt(mp[1], 10);
            }
        }
    }

    if (currentSheet === 'Fingerprint_Logs' || currentSheet === 'Attendance_Logs') {
        if (typeof applyEmployeeShiftAssignmentsToLogs === 'function') {
            applyEmployeeShiftAssignmentsToLogs(dataToExport);
        }
        // Determine date range: monthly = 1 month, yearly = full 12 months
        let rangeMonths = (periodMode === 'year') ? [...Array(12).keys()].map(i => i + 1) : [tMonth];
        let sDate = periodMode === 'year' ? `${tYear}-01-01` : `${tYear}-${String(tMonth).padStart(2, '0')}-01`;
        let eDateObj = periodMode === 'year' ? new Date(tYear, 12, 0) : new Date(tYear, tMonth, 0);
        let eDate = periodMode === 'year' ? `${tYear}-12-31` : `${tYear}-${String(tMonth).padStart(2, '0')}-${String(eDateObj.getDate()).padStart(2, '0')}`;

        if (empIdFilter) {
            let empLogs = dataToExport.filter(r => {
                const rEmp = String(r.Employee_ID || r.employee_id || r.Emp_ID || '').trim().toUpperCase();
                return rEmp === empIdFilter || rEmp.includes(empIdFilter);
            });

            if (typeof fillMissingDays === 'function') {
                dataToExport = fillMissingDays(empLogs, sDate, eDate, empIdFilter);
            } else {
                dataToExport = empLogs;
            }
        } else {
            // ALL EMPLOYEES or DEPARTMENT FILTERED EMPLOYEES
            const staffCache = tableCache['staff'] || tableCache['Staff'];
            const staffData = (staffCache && Array.isArray(staffCache.data)) ? staffCache.data : [];
            const staffMap = {};
            staffData.forEach(s => {
                let eId = String(s.employee_id || s.emp_id || s.Employee_ID || '').toUpperCase().trim();
                if (eId) staffMap[eId] = s;
            });

            let deptFilter = window.activeAttendanceDept || (document.getElementById('attendance-dept-filter') ? document.getElementById('attendance-dept-filter').value : '') || 'all';

            // Filter dataToExport by department first if active
            if (deptFilter && deptFilter !== 'all') {
                dataToExport = dataToExport.filter(r => {
                    let eId = String(r.Employee_ID || r.employee_id || r.Emp_ID || r.emp_id || r['รหัสพนักงาน'] || '').toUpperCase().trim();
                    if (!eId) return false;
                    let deptInfo = (typeof getDepartmentByEmployeeId === 'function')
                        ? getDepartmentByEmployeeId(eId, staffMap[eId])
                        : null;
                    if (!deptInfo) return false;

                    let target = deptFilter.toLowerCase().trim();
                    return (
                        deptInfo.id.toLowerCase() === target ||
                        deptInfo.name.toLowerCase() === target ||
                        deptInfo.code.toLowerCase() === target ||
                        (Array.isArray(deptInfo.prefix) && deptInfo.prefix.some(p => p.toLowerCase() === target)) ||
                        (target.length > 2 && (deptInfo.name.toLowerCase().includes(target) || target.includes(deptInfo.name.toLowerCase())))
                    );
                });
            }

            let empIdSet = new Set();
            dataToExport.forEach(r => {
                const rEmp = String(r.Employee_ID || r.employee_id || r.Emp_ID || '').trim().toUpperCase();
                if (rEmp) empIdSet.add(rEmp);
            });

            if (staffData.length > 0) {
                staffData.forEach(s => {
                    let status = String(s.status || s.Status || s['สถานะ'] || 'Active').toLowerCase();
                    if (status.includes('resign') || status.includes('inactive') || status.includes('ออก')) return;

                    const sEmp = String(s.employee_id || s.emp_id || s.Employee_ID || '').trim().toUpperCase();
                    if (!sEmp) return;

                    if (deptFilter && deptFilter !== 'all') {
                        let deptInfo = (typeof getDepartmentByEmployeeId === 'function')
                            ? getDepartmentByEmployeeId(sEmp, s)
                            : null;
                        if (!deptInfo) return;
                        let target = deptFilter.toLowerCase().trim();
                        let isMatch = (
                            deptInfo.id.toLowerCase() === target ||
                            deptInfo.name.toLowerCase() === target ||
                            deptInfo.code.toLowerCase() === target ||
                            (Array.isArray(deptInfo.prefix) && deptInfo.prefix.some(p => p.toLowerCase() === target)) ||
                            (target.length > 2 && (deptInfo.name.toLowerCase().includes(target) || target.includes(deptInfo.name.toLowerCase())))
                        );
                        if (!isMatch) return;
                    }
                    empIdSet.add(sEmp);
                });
            }

            let allEmpFilledLogs = [];
            const empList = Array.from(empIdSet).sort();

            empList.forEach(empId => {
                let empLogs = dataToExport.filter(r => {
                    const rEmp = String(r.Employee_ID || r.employee_id || r.Emp_ID || '').trim().toUpperCase();
                    return rEmp === empId;
                });

                if (typeof fillMissingDays === 'function') {
                    const filled = fillMissingDays(empLogs, sDate, eDate, empId);
                    allEmpFilledLogs.push(...filled);
                } else {
                    allEmpFilledLogs.push(...empLogs);
                }
            });

            if (allEmpFilledLogs.length > 0) {
                dataToExport = allEmpFilledLogs;
            }
        }
    } else if (empIdFilter) {
        dataToExport = dataToExport.filter(r => {
            const rEmp = String(r.Employee_ID || r.employee_id || r.Emp_ID || '').trim().toUpperCase();
            return rEmp === empIdFilter || rEmp.includes(empIdFilter);
        });
    }

    let shiftFilter = document.getElementById('attendance-shift-filter') ? document.getElementById('attendance-shift-filter').value.trim() : '';
    if (shiftFilter) {
        const cleanFilter = shiftFilter.replace(/^0/, '');
        const assignments = loadShiftAssignments();
        const configs = loadShiftConfigs();

        const matchingShiftIds = new Set(
            configs.filter(c => c.start.includes(shiftFilter) || c.start.replace(/^0/, '').includes(cleanFilter)).map(c => c.id)
        );
        const assignedEmpIds = new Set();
        Object.entries(assignments).forEach(([empId, shiftId]) => {
            if (matchingShiftIds.has(shiftId)) assignedEmpIds.add(empId.toUpperCase());
        });

        if (assignedEmpIds.size > 0) {
            dataToExport = dataToExport.filter(r => {
                const empId = String(r.Employee_ID || r.employee_id || r.Emp_ID || '').toUpperCase().trim();
                return assignedEmpIds.has(empId);
            });
        } else {
            // Fallback: employee-level log-based filter
            const empIdsWithShift = new Set();
            dataToExport.forEach(r => {
                let sStart = String(r.Shift_Start || r.shift_start || r['Shift Start'] || r['เวลาเข้างาน'] || '').trim();
                if (!sStart || sStart === '-') return;
                const cleanStart = sStart.replace(/^0/, '');
                if (sStart.includes(shiftFilter) || cleanStart.includes(cleanFilter)) {
                    const empId = String(r.Employee_ID || r.employee_id || r.Emp_ID || '').toUpperCase().trim();
                    if (empId) empIdsWithShift.add(empId);
                }
            });
            if (empIdsWithShift.size > 0) {
                dataToExport = dataToExport.filter(r => {
                    const empId = String(r.Employee_ID || r.employee_id || r.Emp_ID || '').toUpperCase().trim();
                    return empIdsWithShift.has(empId);
                });
            } else {
                dataToExport = [];
            }
        }
    }

    // Sort FIRST by Employee_ID (grouped sequentially per staff), SECOND by Date
    dataToExport.sort((a, b) => {
        const empA = String(a.Employee_ID || a.employee_id || a.Emp_ID || '').trim().toUpperCase();
        const empB = String(b.Employee_ID || b.employee_id || b.Emp_ID || '').trim().toUpperCase();

        if (empA !== empB) {
            return empA.localeCompare(empB, undefined, { numeric: true, sensitivity: 'base' });
        }

        let dateA = String(a.Date || a.date || '');
        let dateB = String(b.Date || b.date || '');

        if (dateA.includes('/')) {
            const p = dateA.split('/');
            if (p.length === 3) dateA = `${p[2]}-${p[1].padStart(2, '0')}-${p[0].padStart(2, '0')}`;
        }
        if (dateB.includes('/')) {
            const p = dateB.split('/');
            if (p.length === 3) dateB = `${p[2]}-${p[1].padStart(2, '0')}-${p[0].padStart(2, '0')}`;
        }

        return dateA.localeCompare(dateB);
    });

    return dataToExport;
}

function calculateAttendanceSummary(data) {
    let totalLateHrs = 0;
    let totalEarlyHrs = 0;
    let totalAbsentDays = 0;
    let totalOT = 0;

    let today = new Date();
    today.setHours(0, 0, 0, 0);

    const otSettings = typeof getOtSettings === 'function' ? getOtSettings() : null;
    let staffMap = {};
    if (typeof tableCache !== 'undefined' && tableCache['staff'] && tableCache['staff'].data) {
        tableCache['staff'].data.forEach(s => {
            let sId = String(s.Employee_ID || s.employee_id || '').trim().toUpperCase();
            if (sId) staffMap[sId] = s;
        });
    }

    data.forEach(row => {
        let late = parseFloat(getFuzzyValue(row, ['Late_Hours', 'late_hours', 'late_hrs']) || 0) || 0;
        let early = parseFloat(getFuzzyValue(row, ['Early_Leave_Hours', 'early_leave_hours', 'early_hrs']) || 0) || 0;

        let rEmp = String(row.Employee_ID || row.employee_id || '').trim().toUpperCase();
        let staffObj = staffMap[rEmp] || null;
        let ot = typeof calculateRowOt === 'function' ? calculateRowOt(row, staffObj, otSettings) : (parseFloat(getFuzzyValue(row, ['OT_Amount', 'ot_amount', 'ot']) || 0) || 0);

        let status = String(getFuzzyValue(row, ['Attendance_Status', 'attendance_status', 'Status', 'status']) || '').toLowerCase();

        let checkIn = getFuzzyValue(row, ['Check_In', 'check_in', 'in']);
        let checkOut = getFuzzyValue(row, ['Check_Out', 'check_out', 'out']);
        let shiftStart = getFuzzyValue(row, ['Shift_Start', 'shift_start', 'start']);
        let shiftEnd = getFuzzyValue(row, ['Shift_End', 'shift_end', 'end']);
        let rawDateStr = getFuzzyValue(row, ['Date', 'date', 'วันที่']);

        let rowDate = (typeof parseDateStr === 'function') ? parseDateStr(rawDateStr) : null;
        let isPastOrToday = rowDate ? (rowDate <= today) : true;

        if (checkIn && checkIn !== '-' && shiftStart && shiftStart !== '-') {
            let inMins = parseInt(String(checkIn).split(':')[0] || 0) * 60 + parseInt(String(checkIn).split(':')[1] || 0);
            let startMins = parseInt(String(shiftStart).split(':')[0] || 0) * 60 + parseInt(String(shiftStart).split(':')[1] || 0);
            late = inMins > startMins ? (inMins - startMins) / 60 : 0;
        }

        if (checkOut && checkOut !== '-' && shiftEnd && shiftEnd !== '-') {
            let outMins = parseInt(String(checkOut).split(':')[0] || 0) * 60 + parseInt(String(checkOut).split(':')[1] || 0);
            let endMins = parseInt(String(shiftEnd).split(':')[0] || 0) * 60 + parseInt(String(shiftEnd).split(':')[1] || 0);
            early = (outMins < endMins && outMins > 0) ? (endMins - outMins) / 60 : 0;
        }

        totalLateHrs += late;
        totalEarlyHrs += early;
        totalOT += ot;

        if (status.includes('absent') || status.includes('missing') || status.includes('ขาด')) {
            totalAbsentDays++;
        }
    });

    const lateMinsTotal = Math.round(totalLateHrs * 60);
    const earlyMinsTotal = Math.round(totalEarlyHrs * 60);

    const lateFormatted = `${(Math.round(totalLateHrs * 100) / 100)} ชม. (${lateMinsTotal} นาที)`;
    const earlyFormatted = `${(Math.round(totalEarlyHrs * 100) / 100)} ชม. (${earlyMinsTotal} นาที)`;

    return {
        lateHrs: Math.round(totalLateHrs * 100) / 100,
        lateMins: lateMinsTotal,
        lateFormatted,
        earlyHrs: Math.round(totalEarlyHrs * 100) / 100,
        earlyMins: earlyMinsTotal,
        earlyFormatted,
        absentDays: totalAbsentDays,
        otTotal: totalOT
    };
}

function exportToExcel(targetSheetName = null) {
    openExportPreviewModal('EXCEL', targetSheetName);
}

function exportToPDF(targetSheetName = null) {
    openExportPreviewModal('PDF', targetSheetName);
}

function openExportPreviewModal(type, targetSheetName = null) {
    pendingExportType = type;
    pendingExportSheet = targetSheetName || currentSheet || 'Attendance_Logs';
    const data = getActiveTableExportData();

    if (!data || data.length === 0) {
        showToast('ไม่พบข้อมูลสำหรับส่งออก (No data to export)', 'error');
        return;
    }

    const modal = document.getElementById('export-preview-modal');
    if (!modal) {
        if (type === 'PDF') performPDFExport(pendingExportSheet, data);
        else performExcelExport(pendingExportSheet, data);
        return;
    }

    const badgeContainer = document.getElementById('export-modal-badge');
    const formatText = document.getElementById('export-format-text');
    const scopeText = document.getElementById('export-scope-text');
    const periodText = document.getElementById('export-period-text');
    const countText = document.getElementById('export-count-text');
    const summaryBox = document.getElementById('export-summary-preview-box');

    if (type === 'PDF') {
        badgeContainer.innerHTML = `<span class="bg-rose-50 text-rose-700 border border-rose-200 px-3 py-1 rounded-full font-bold text-xs flex items-center gap-1.5"><i class="fa-solid fa-file-pdf"></i> PDF Document (.pdf)</span>`;
        formatText.innerText = 'PDF Document (.pdf)';
    } else {
        badgeContainer.innerHTML = `<span class="bg-emerald-50 text-emerald-700 border border-emerald-200 px-3 py-1 rounded-full font-bold text-xs flex items-center gap-1.5"><i class="fa-solid fa-file-excel"></i> Excel Spreadsheet (.xlsx)</span>`;
        formatText.innerText = 'Excel Spreadsheet (.xlsx)';
    }

    let empFilterStr = 'พนักงานทั้งหมด (All Staff)';
    const calEmpInput = document.getElementById('calendarEmpId');
    const searchInput = document.getElementById('searchInput');

    if (calEmpInput && calEmpInput.value.trim()) {
        empFilterStr = `พนักงานเฉพาะราย: ${calEmpInput.value.trim().toUpperCase()}`;
    } else if (searchInput && searchInput.value.trim() && currentSheet === 'Fingerprint_Logs') {
        empFilterStr = `พนักงานเฉพาะราย: ${searchInput.value.trim().toUpperCase()}`;
    } else if (window.activeAttendanceDept && window.activeAttendanceDept !== 'all' && currentSheet === 'Fingerprint_Logs') {
        const coreDepts = [
            { id: 'DEPT-ULK0S', name: 'Housekeeper', code: 'HKP' },
            { id: 'DEPT-9HQYN', name: 'Doctor', code: 'DMC' },
            { id: 'DEPT-DQMTT', name: 'SOWROM', code: 'SR' },
            { id: 'DEPT-VNIE2', name: 'Marketing', code: 'MT' },
            { id: 'DEPT-CAX5G', name: 'MANAGER', code: 'M' },
            { id: 'DEPT-Y646E', name: 'Project Manager', code: 'PM' },
            { id: 'DEPT-MRIH7', name: 'CFO', code: 'CFO' }
        ];
        let found = coreDepts.find(d => d.id === window.activeAttendanceDept || d.name === window.activeAttendanceDept || d.code === window.activeAttendanceDept);
        let deptDisplayName = found ? `${found.name} (${found.code})` : window.activeAttendanceDept;
        empFilterStr = `แผนก (Department): ${deptDisplayName}`;
    }

    scopeText.innerText = empFilterStr;

    let monthFilterStr = 'ทั้งหมด (All Period)';
    const calMonthInput = document.getElementById('calendarMonth');
    const calYearInput = document.getElementById('calendarYear');
    const periodMode = window._attendancePeriodMode || 'month';

    if (periodMode === 'year' && calYearInput && calYearInput.value) {
        const y = parseInt(calYearInput.value);
        monthFilterStr = `📅 สรุปรายปี ปี ${y} (พ.ศ. ${y + 543})`;
    } else if (calMonthInput && calMonthInput.value.trim()) {
        monthFilterStr = calMonthInput.value.trim();
    }
    const shiftSelect = document.getElementById('attendance-shift-filter');
    if (shiftSelect && shiftSelect.value.trim()) {
        const selectedOptText = shiftSelect.options[shiftSelect.selectedIndex] ? shiftSelect.options[shiftSelect.selectedIndex].text : shiftSelect.value;
        monthFilterStr += ` | กะเวลา: ${selectedOptText}`;
    }
    periodText.innerText = monthFilterStr;
    countText.innerText = `${data.length} รายการ`;

    // Render Live Table Preview of Attendance Logs in Modal
    const thead = document.getElementById('export-preview-thead');
    const tbody = document.getElementById('export-preview-tbody');
    const showingCount = document.getElementById('export-preview-showing-count');

    if (thead && tbody && data.length > 0) {
        const headers = currentHeaders || Object.keys(data[0]);
        const cleanHeaders = headers.filter(h => {
            const lw = String(h).toLowerCase().trim();
            return lw !== 'signature' && lw !== 'photos' && lw !== 'photo' && lw !== 'profile' && !lw.startsWith('__') && lw !== 'action' && lw !== 'จัดกา' && lw !== 'จัดการ';
        });

        thead.innerHTML = cleanHeaders.map(h => `<th class="p-2.5 uppercase tracking-wider text-[10.5px] border-b border-indigo-800">${h}</th>`).join('');

        const previewRows = data.slice(0, 15);
        if (showingCount) {
            showingCount.innerText = data.length > 15 ? `แสดงตัวอย่าง 15 จาก ${data.length} รายการ` : `แสดงทั้งหมด ${data.length} รายการ`;
        }

        tbody.innerHTML = previewRows.map((row, idx) => {
            const bg = idx % 2 === 0 ? 'bg-white' : 'bg-gray-50/50';
            const tds = cleanHeaders.map(h => {
                let val = row[h];
                if (val === undefined || val === null) val = '-';
                let strVal = String(val);
                let badgeClass = '';

                if (h === 'Attendance_Status' || h === 'attendance_status' || h === 'Status') {
                    const upper = strVal.toUpperCase();
                    if (upper.includes('PRESENT')) badgeClass = 'text-green-600 font-bold bg-green-50 px-2 py-0.5 rounded-full border border-green-200';
                    else if (upper.includes('LATE')) badgeClass = 'text-red-600 font-bold bg-red-50 px-2 py-0.5 rounded-full border border-red-200';
                    else if (upper.includes('ABSENT')) badgeClass = 'text-rose-600 font-bold bg-rose-50 px-2 py-0.5 rounded-full border border-rose-200';
                    else if (upper.includes('LEAVE')) badgeClass = 'text-amber-600 font-bold bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200';
                    else if (upper.includes('OFF')) badgeClass = 'text-gray-500 font-bold bg-gray-100 px-2 py-0.5 rounded-full border border-gray-200';
                }

                return `<td class="p-2.5 text-[11px] whitespace-nowrap"><span class="${badgeClass}">${strVal}</span></td>`;
            }).join('');

            return `<tr class="${bg} hover:bg-indigo-50/30 transition-colors">${tds}</tr>`;
        }).join('');
    }

    const isAttendance = (pendingExportSheet === 'Fingerprint_Logs' || currentSheet === 'Fingerprint_Logs');
    if (isAttendance && summaryBox) {
        const summary = calculateAttendanceSummary(data);
        summaryBox.innerHTML = `
            <div class="bg-red-50 border border-red-100 p-2 rounded-xl">
                <div class="text-[10px] text-red-600 font-bold">มาสายรวม</div>
                <div class="text-xs font-extrabold text-red-800">${summary.lateFormatted}</div>
            </div>
            <div class="bg-orange-50 border border-orange-100 p-2 rounded-xl">
                <div class="text-[10px] text-orange-600 font-bold">กลับก่อนรวม</div>
                <div class="text-xs font-extrabold text-orange-800">${summary.earlyFormatted}</div>
            </div>
            <div class="bg-green-50 border border-green-100 p-2 rounded-xl">
                <div class="text-[10px] text-green-600 font-bold">ขาดงาน</div>
                <div class="text-xs font-extrabold text-green-800">${summary.absentDays} วัน</div>
            </div>
            <div class="bg-blue-50 border border-blue-100 p-2 rounded-xl">
                <div class="text-[10px] text-blue-600 font-bold">OT รวม</div>
                <div class="text-xs font-extrabold text-blue-800">${summary.otTotal.toLocaleString()}</div>
            </div>
        `;
        summaryBox.classList.remove('hidden');
    } else if (summaryBox) {
        summaryBox.innerHTML = '';
        summaryBox.classList.add('hidden');
    }

    modal.classList.remove('hidden');
    modal.classList.add('flex');
}

function closeExportPreviewModal() {
    const modal = document.getElementById('export-preview-modal');
    if (modal) {
        modal.classList.add('hidden');
        modal.classList.remove('flex');
    }
}

function executeConfirmedExport() {
    closeExportPreviewModal();
    const data = getActiveTableExportData();
    if (pendingExportType === 'PDF') {
        performPDFExport(pendingExportSheet, data);
    } else {
        performExcelExport(pendingExportSheet, data);
    }
}

function buildPDFReportHtml(data, sheetName) {
    const isAttendance = (sheetName === 'Fingerprint_Logs' || currentSheet === 'Fingerprint_Logs');

    let monthFilterStr = 'ทั้งหมด (All Period)';
    const calendarMonthInput = document.getElementById('calendarMonth');
    if (calendarMonthInput && calendarMonthInput.value.trim()) {
        monthFilterStr = calendarMonthInput.value.trim();
    }

    const todayStr = new Date().toLocaleDateString('th-TH', { year: 'numeric', month: 'long', day: 'numeric' });

    const headers = currentHeaders || (data.length > 0 ? Object.keys(data[0]) : []);
    const cleanHeaders = headers.filter(h => {
        const lw = String(h).toLowerCase().trim();
        return lw !== 'signature' && lw !== 'photos' && lw !== 'photo' && lw !== 'profile' && !lw.startsWith('__') && lw !== 'action' && lw !== 'จัดกา' && lw !== 'จัดการ';
    });

    let thHtml = cleanHeaders.map(h => `<th style="padding: 8px 7px; border: 1px solid #cbd5e1; font-size: 10px; font-weight: 700; text-transform: uppercase; text-align: left;">${h}</th>`).join('');

    // Group data by Employee_ID
    let empGroups = {};
    if (isAttendance) {
        data.forEach(row => {
            const empId = String(row.Employee_ID || row.employee_id || row.Emp_ID || 'UNASSIGNED').trim().toUpperCase();
            if (!empGroups[empId]) empGroups[empId] = [];
            empGroups[empId].push(row);
        });
    }

    const empKeys = Object.keys(empGroups);
    let mainContentHtml = '';

    if (isAttendance && empKeys.length > 0) {
        mainContentHtml = empKeys.map((empId, eIdx) => {
            const empRows = empGroups[empId];
            const empSummary = calculateAttendanceSummary(empRows);
            const empName = empRows[0]?.Full_Name || empRows[0]?.full_name || empId;

            let trsHtml = empRows.map((row, idx) => {
                const bg = idx % 2 === 0 ? '#ffffff' : '#f8fafc';
                let tds = cleanHeaders.map(h => {
                    let val = row[h];
                    if (val === undefined || val === null) val = '-';
                    let strVal = String(val);
                    let styleExtra = '';

                    if (h === 'Attendance_Status' || h === 'attendance_status' || h === 'Status') {
                        const upper = strVal.toUpperCase();
                        if (upper.includes('PRESENT')) styleExtra = 'color: #16a34a; font-weight: bold;';
                        else if (upper.includes('LATE')) styleExtra = 'color: #dc2626; font-weight: bold;';
                        else if (upper.includes('ABSENT')) styleExtra = 'color: #ef4444; font-weight: bold;';
                        else if (upper.includes('LEAVE')) styleExtra = 'color: #eab308; font-weight: bold;';
                        else if (upper.includes('OFF')) styleExtra = 'color: #6b7280; font-weight: bold;';
                    }

                    return `<td style="padding: 6px 7px; border: 1px solid #e2e8f0; font-size: 10px; ${styleExtra}">${strVal}</td>`;
                }).join('');

                return `<tr style="background: ${bg};">${tds}</tr>`;
            }).join('');

            const pageBreakStyle = empKeys.length > 1 && eIdx < empKeys.length - 1 ? 'page-break-after: always; margin-bottom: 24px;' : 'margin-bottom: 20px;';

            return `
            <div style="${pageBreakStyle}">
                <div style="background: #eef2ff; border: 1.5px solid #c7d2fe; border-radius: 10px; padding: 8px 14px; margin-bottom: 10px; display: flex; justify-content: space-between; align-items: center;">
                    <div style="font-size: 12.5px; font-weight: 800; color: #3730a3;">
                        👤 พนักงาน (Employee): <span style="color: #4f46e5;">${empId} - ${empName}</span>
                    </div>
                    <div style="font-size: 10.5px; font-weight: 700; color: #4338ca;">
                        จำนวน: ${empRows.length} รายการ
                    </div>
                </div>

                <!-- Individual Employee Summary Cards -->
                <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin-bottom: 12px;">
                    <div style="background: #fef2f2; border: 1px solid #fecaca; border-radius: 8px; padding: 7px 9px; text-align: center;">
                        <div style="font-size: 9.5px; color: #dc2626; font-weight: 700; text-transform: uppercase;">⏰ มาสายรวม (Late)</div>
                        <div style="font-size: 13px; font-weight: 800; color: #991b1b; margin-top: 2px;">${empSummary.lateFormatted}</div>
                    </div>
                    <div style="background: #fff7ed; border: 1px solid #fed7aa; border-radius: 8px; padding: 7px 9px; text-align: center;">
                        <div style="font-size: 9.5px; color: #ea580c; font-weight: 700; text-transform: uppercase;">🏃 กลับก่อนรวม (Early)</div>
                        <div style="font-size: 13px; font-weight: 800; color: #9a3412; margin-top: 2px;">${empSummary.earlyFormatted}</div>
                    </div>
                    <div style="background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px; padding: 7px 9px; text-align: center;">
                        <div style="font-size: 9.5px; color: #16a34a; font-weight: 700; text-transform: uppercase;">❌ ขาดงานรวม (Absent)</div>
                        <div style="font-size: 13px; font-weight: 800; color: #166534; margin-top: 2px;">${empSummary.absentDays} วัน</div>
                    </div>
                    <div style="background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 8px; padding: 7px 9px; text-align: center;">
                        <div style="font-size: 9.5px; color: #2563eb; font-weight: 700; text-transform: uppercase;">💰 OT รวม (OT Amount)</div>
                        <div style="font-size: 13px; font-weight: 800; color: #1e40af; margin-top: 2px;">${empSummary.otTotal.toLocaleString()}</div>
                    </div>
                </div>

                <table style="width: 100%; border-collapse: collapse;">
                    <thead>
                        <tr style="background: #3730a3; color: #ffffff;">
                            ${thHtml}
                        </tr>
                    </thead>
                    <tbody>
                        ${trsHtml}
                    </tbody>
                </table>
            </div>`;
        }).join('');
    } else {
        let trsHtml = data.map((row, idx) => {
            const bg = idx % 2 === 0 ? '#ffffff' : '#f8fafc';
            let tds = cleanHeaders.map(h => `<td style="padding: 6px 7px; border: 1px solid #e2e8f0; font-size: 10px;">${row[h] || '-'}</td>`).join('');
            return `<tr style="background: ${bg};">${tds}</tr>`;
        }).join('');

        mainContentHtml = `
        <table style="width: 100%; border-collapse: collapse; margin-top: 6px;">
            <thead>
                <tr style="background: #3730a3; color: #ffffff;">
                    ${thHtml}
                </tr>
            </thead>
            <tbody>
                ${trsHtml}
            </tbody>
        </table>`;
    }

    let deptNameStr = '';
    if (window.activeAttendanceDept && window.activeAttendanceDept !== 'all' && isAttendance) {
        const coreDepts = [
            { id: 'DEPT-ULK0S', name: 'Housekeeper', code: 'HKP' },
            { id: 'DEPT-9HQYN', name: 'Doctor', code: 'DMC' },
            { id: 'DEPT-DQMTT', name: 'SOWROM', code: 'SR' },
            { id: 'DEPT-VNIE2', name: 'Marketing', code: 'MT' },
            { id: 'DEPT-CAX5G', name: 'MANAGER', code: 'M' },
            { id: 'DEPT-Y646E', name: 'Project Manager', code: 'PM' },
            { id: 'DEPT-MRIH7', name: 'CFO', code: 'CFO' }
        ];
        let found = coreDepts.find(d => d.id === window.activeAttendanceDept || d.name === window.activeAttendanceDept || d.code === window.activeAttendanceDept);
        deptNameStr = found ? `${found.name} (${found.code})` : window.activeAttendanceDept;
    }

    let globalScopeStr = empKeys.length === 1 
        ? `พนักงาน: ${empKeys[0]}` 
        : (deptNameStr ? `แผนก: ${deptNameStr} (${empKeys.length} คน)` : `พนักงานทุกแผนกทั้งหมด (${empKeys.length} คน)`);

    return `
    <div style="padding: 16px 20px; font-family: 'Prompt', 'Inter', sans-serif; color: #1e293b; background: #ffffff;">
        <div style="display: flex; justify-content: space-between; align-items: flex-end; border-bottom: 3px solid #4f46e5; padding-bottom: 10px; margin-bottom: 14px;">
            <div>
                <h1 style="font-size: 18px; font-weight: 800; color: #3730a3; margin: 0; letter-spacing: -0.5px;">LOVE STK GROUPE</h1>
                <p style="font-size: 11px; font-weight: 600; color: #64748b; margin: 2px 0 0 0;">รายงานสรุปประวัติการลงเวลาทำงานรายบุคคล (Individual Attendance & Performance Report)${deptNameStr ? ' - แผนก ' + deptNameStr : ''}</p>
            </div>
            <div style="text-align: right; font-size: 10px; color: #475569; line-height: 1.4;">
                <div><strong>วันที่พิมพ์:</strong> ${todayStr}</div>
                <div><strong>ขอบเขตรายงาน:</strong> ${globalScopeStr}</div>
                <div><strong>งวดประจำเดือน:</strong> ${monthFilterStr}</div>
            </div>
        </div>

        ${mainContentHtml}

        <div style="margin-top: 24px; display: flex; justify-content: space-between; padding: 0 40px; font-size: 10px; color: #64748b; page-break-inside: avoid;">
            <div style="text-align: center; width: 170px;">
                <div style="border-bottom: 1px solid #94a3b8; height: 32px; margin-bottom: 4px;"></div>
                <div>ลงชื่อ พนักงาน (Employee)</div>
            </div>
            <div style="text-align: center; width: 170px;">
                <div style="border-bottom: 1px solid #94a3b8; height: 32px; margin-bottom: 4px;"></div>
                <div>ลงชื่อ เจ้าหน้าที่ HR (HR Officer)</div>
            </div>
        </div>
    </div>`;
}

function performExcelExport(targetSheetName = null, data = null) {
    const sheetName = targetSheetName || pendingExportSheet || currentSheet || 'Data_Export';
    const exportData = data || getActiveTableExportData();

    if (!exportData || exportData.length === 0) {
        showToast('ไม่พบข้อมูลสำหรับส่งออก (No data to export)', 'error');
        return;
    }

    const isAttendance = (sheetName === 'Fingerprint_Logs' || currentSheet === 'Fingerprint_Logs');

    let deptNameSuffix = '';
    let deptTitleStr = '';
    if (window.activeAttendanceDept && window.activeAttendanceDept !== 'all' && isAttendance) {
        const coreDepts = [
            { id: 'DEPT-ULK0S', name: 'Housekeeper', code: 'HKP' },
            { id: 'DEPT-9HQYN', name: 'Doctor', code: 'DMC' },
            { id: 'DEPT-DQMTT', name: 'SOWROM', code: 'SR' },
            { id: 'DEPT-VNIE2', name: 'Marketing', code: 'MT' },
            { id: 'DEPT-CAX5G', name: 'MANAGER', code: 'M' },
            { id: 'DEPT-Y646E', name: 'Project Manager', code: 'PM' },
            { id: 'DEPT-MRIH7', name: 'CFO', code: 'CFO' }
        ];
        let found = coreDepts.find(d => d.id === window.activeAttendanceDept || d.name === window.activeAttendanceDept || d.code === window.activeAttendanceDept);
        deptNameSuffix = found ? `_${found.name}` : `_${window.activeAttendanceDept}`;
        deptTitleStr = found ? ` แผนก ${found.name} (${found.code})` : ` แผนก ${window.activeAttendanceDept}`;
    }

    const headers = currentHeaders || (exportData.length > 0 ? Object.keys(exportData[0]) : []);
    const cleanHeaders = headers.filter(h => {
        const lw = String(h).toLowerCase().trim();
        return lw !== 'signature' && lw !== 'photos' && lw !== 'photo' && lw !== 'profile' && !lw.startsWith('__') && lw !== 'action' && lw !== 'จัดกา' && lw !== 'จัดการ';
    });

    const dateStr = new Date().toISOString().slice(0, 10);
    const filename = `${sheetName}${deptNameSuffix}_Report_${dateStr}.xlsx`;

    if (typeof XLSX !== 'undefined') {
        try {
            const worksheet = XLSX.utils.json_to_sheet([], { header: cleanHeaders });

            if (isAttendance) {
                let aoaData = [
                    [`LOVE STK GROUPE - รายงานสรุปประวัติการลงเวลาทำงานรายบุคคล${deptTitleStr}`],
                    [`วันที่พิมพ์: ${new Date().toLocaleDateString('th-TH')}`],
                    []
                ];

                let empGroups = {};
                exportData.forEach(row => {
                    const empId = String(row.Employee_ID || row.employee_id || row.Emp_ID || 'UNASSIGNED').trim().toUpperCase();
                    if (!empGroups[empId]) empGroups[empId] = [];
                    empGroups[empId].push(row);
                });

                Object.keys(empGroups).forEach((empId) => {
                    const empRows = empGroups[empId];
                    const empSummary = calculateAttendanceSummary(empRows);
                    const empName = empRows[0]?.Full_Name || empRows[0]?.full_name || empId;

                    aoaData.push([`=== พนักงาน (Employee): ${empId} - ${empName} (${empRows.length} รายการ) ===`]);
                    aoaData.push([`สรุปผล: มาสายรวม: ${empSummary.lateFormatted} | กลับก่อนรวม: ${empSummary.earlyFormatted} | ขาดงานรวม: ${empSummary.absentDays} วัน | OT รวม: ${empSummary.otTotal.toLocaleString()}`]);
                    aoaData.push(cleanHeaders);

                    empRows.forEach(row => {
                        let rowVals = cleanHeaders.map(h => String(row[h] === undefined || row[h] === null ? '' : row[h]));
                        aoaData.push(rowVals);
                    });

                    aoaData.push([]);
                });

                XLSX.utils.sheet_add_aoa(worksheet, aoaData, { origin: 'A1' });
            } else {
                const exportRows = exportData.map(row => {
                    const item = {};
                    cleanHeaders.forEach(h => {
                        let val = row[h];
                        if (val === undefined || val === null) val = '';
                        item[h] = String(val);
                    });
                    return item;
                });
                XLSX.utils.sheet_add_json(worksheet, exportRows, { origin: 'A1', header: cleanHeaders });
            }

            const workbook = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(workbook, worksheet, sheetName.substring(0, 30));
            XLSX.writeFile(workbook, filename);
            showToast(`ส่งออกไฟล์ Excel สำเร็จ! (${filename})`, 'success');
            return;
        } catch (err) {
            console.warn('[SheetJS export failed, falling back to CSV]', err);
        }
    }

    try {
        let csvContent = '\uFEFF';

        if (isAttendance) {
            csvContent += `"LOVE STK GROUPE - รายงานสรุปประวัติการลงเวลาทำงานรายบุคคล"\n\n`;

            let empGroups = {};
            exportData.forEach(row => {
                const empId = String(row.Employee_ID || row.employee_id || row.Emp_ID || 'UNASSIGNED').trim().toUpperCase();
                if (!empGroups[empId]) empGroups[empId] = [];
                empGroups[empId].push(row);
            });

            Object.keys(empGroups).forEach((empId) => {
                const empRows = empGroups[empId];
                const empSummary = calculateAttendanceSummary(empRows);
                const empName = empRows[0]?.Full_Name || empRows[0]?.full_name || empId;

                csvContent += `"=== พนักงาน (Employee): ${empId} - ${empName} (${empRows.length} รายการ) ==="\n`;
                csvContent += `"สรุปผล: มาสายรวม: ${empSummary.lateFormatted} | กลับก่อนรวม: ${empSummary.earlyFormatted} | ขาดงานรวม: ${empSummary.absentDays} วัน | OT รวม: ${empSummary.otTotal.toLocaleString()}"\n`;
                csvContent += cleanHeaders.map(h => `"${String(h).replace(/"/g, '""')}"`).join(',') + '\n';

                empRows.forEach(row => {
                    const line = cleanHeaders.map(h => {
                        const val = String(row[h] === undefined || row[h] === null ? '' : row[h]).replace(/"/g, '""');
                        return `"${val}"`;
                    }).join(',');
                    csvContent += line + '\n';
                });
                csvContent += '\n';
            });
        } else {
            csvContent += cleanHeaders.map(h => `"${String(h).replace(/"/g, '""')}"`).join(',') + '\n';

            exportData.forEach(row => {
                const line = cleanHeaders.map(h => {
                    const val = String(row[h] === undefined || row[h] === null ? '' : row[h]).replace(/"/g, '""');
                    return `"${val}"`;
                }).join(',');
                csvContent += line + '\n';
            });
        }

        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.setAttribute('href', url);
        link.setAttribute('download', filename.replace('.xlsx', '.csv'));
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        showToast(`ส่งออกไฟล์ข้อมูลสำเร็จ! (${filename.replace('.xlsx', '.csv')})`, 'success');
    } catch (e) {
        showToast('เกิดข้อผิดพลาดในการส่งออกไฟล์: ' + e.message, 'error');
    }
}

function performPDFExport(targetSheetName = null, data = null) {
    const sheetName = targetSheetName || pendingExportSheet || currentSheet || 'Attendance_Logs';
    const exportData = data || getActiveTableExportData();

    if (!exportData || exportData.length === 0) {
        showToast('ไม่พบข้อมูลสำหรับส่งออก PDF (No data to export)', 'error');
        return;
    }

    toggleLoading(true, 'กำลังสร้างไฟล์ PDF...');

    const exportContainer = document.createElement('div');
    exportContainer.id = 'pdf-export-render-wrapper';
    exportContainer.style.position = 'fixed';
    exportContainer.style.top = '0';
    exportContainer.style.left = '0';
    exportContainer.style.width = '1050px';
    exportContainer.style.zIndex = '99999';
    exportContainer.style.background = '#ffffff';
    exportContainer.style.boxShadow = '0 25px 50px -12px rgba(0, 0, 0, 0.25)';

    exportContainer.innerHTML = buildPDFReportHtml(exportData, sheetName);
    document.body.appendChild(exportContainer);

    const dateStr = new Date().toISOString().slice(0, 10);
    const filename = `${sheetName}_Report_${dateStr}.pdf`;

    setTimeout(() => {
        if (typeof html2pdf !== 'undefined') {
            try {
                const opt = {
                    margin:       [6, 6, 6, 6],
                    filename:     filename,
                    image:        { type: 'jpeg', quality: 0.98 },
                    html2canvas:  { scale: 2, useCORS: true, logging: false, width: 1050, windowWidth: 1050 },
                    jsPDF:        { unit: 'mm', format: 'a4', orientation: 'landscape' }
                };
                html2pdf().set(opt).from(exportContainer).save().then(() => {
                    toggleLoading(false);
                    if (document.body.contains(exportContainer)) document.body.removeChild(exportContainer);
                    showToast('ส่งออกรายงาน PDF สำเร็จ!', 'success');
                }).catch(err => {
                    console.error('[html2pdf error]', err);
                    toggleLoading(false);
                    if (document.body.contains(exportContainer)) document.body.removeChild(exportContainer);
                    window.print();
                });
            } catch (e) {
                toggleLoading(false);
                if (document.body.contains(exportContainer)) document.body.removeChild(exportContainer);
            }
        } else {
            toggleLoading(false);
            printAttendanceReport();
        }
    }, 150);
}

/* =====================================================================
 * 📌 Dedicated Print Report Engine (iframe isolation - zero blank page)
 * ===================================================================== */
function printAttendanceReport() {
    const data = getActiveTableExportData();
    if (!data || data.length === 0) {
        showToast('ไม่พบข้อมูลสำหรับพิมพ์ (No data to print)', 'error');
        return;
    }

    const sheetName = currentSheet || 'Attendance_Logs';
    const reportHtml = buildPDFReportHtml(data, sheetName);

    let printFrame = document.getElementById('print-iframe');
    if (printFrame && document.body.contains(printFrame)) {
        document.body.removeChild(printFrame);
    }

    printFrame = document.createElement('iframe');
    printFrame.id = 'print-iframe';
    printFrame.style.position = 'fixed';
    printFrame.style.right = '0';
    printFrame.style.bottom = '0';
    printFrame.style.width = '0';
    printFrame.style.height = '0';
    printFrame.style.border = '0';
    document.body.appendChild(printFrame);

    const doc = printFrame.contentWindow.document;
    doc.open();
    doc.write(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>HRSYS - Attendance Report</title>
            <link href="https://fonts.googleapis.com/css2?family=Prompt:wght@400;600;700&display=swap" rel="stylesheet">
            <style>
                @page { size: A4 landscape; margin: 8mm; }
                body { margin: 0; padding: 0; font-family: 'Prompt', 'Inter', sans-serif; background: #fff; color: #1e293b; }
                table { width: 100%; border-collapse: collapse; page-break-inside: auto; margin-top: 6px; }
                tr { page-break-inside: avoid; page-break-after: auto; }
                th, td { border: 1px solid #cbd5e1; padding: 6px 8px; font-size: 10.5px; }
                th { background-color: #3730a3 !important; color: white !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
                * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
            </style>
        </head>
        <body>
            ${reportHtml}
        </body>
        </html>
    `);
    doc.close();

    setTimeout(() => {
        printFrame.contentWindow.focus();
        printFrame.contentWindow.print();
    }, 250);
}

/* =====================================================================
 * ⚙️ SHIFT SETTINGS MODAL — ฟังก์ชันตั้งค่ากะเวลาเข้างาน
 * เก็บข้อมูลใน localStorage['hr_shift_configs']
 * ===================================================================== */

const SHIFT_STORAGE_KEY = 'hr_shift_configs';

/** โหลด shift configs จาก localStorage */
function loadShiftConfigs() {
    try {
        const raw = localStorage.getItem(SHIFT_STORAGE_KEY);
        if (raw) return JSON.parse(raw);
    } catch (e) {}
    // default shifts ถ้ายังไม่มีการตั้งค่า
    return [
        { id: 's1', start: '08:00', end: '17:00', label: 'กะเช้า (8 โมง)' },
        { id: 's2', start: '09:00', end: '17:00', label: 'กะเช้า (9 โมง)' }
    ];
}

/** บันทึก shift configs ลง localStorage */
function saveShiftConfigs(configs) {
    localStorage.setItem(SHIFT_STORAGE_KEY, JSON.stringify(configs));
}

/** สร้าง unique id */
function genShiftId() {
    return 's_' + Date.now().toString(36);
}

/** โหลด options เข้า dropdown #attendance-shift-filter */
function populateShiftDropdown() {
    const sel = document.getElementById('attendance-shift-filter');
    if (!sel) return;
    const configs = loadShiftConfigs();
    // เก็บค่าที่เลือกอยู่ก่อน
    const prevVal = sel.value;
    sel.innerHTML = `<option value="">กะเวลาทั้งหมด (All Shifts)</option>`;
    configs.forEach(cfg => {
        const opt = document.createElement('option');
        opt.value = cfg.start;
        opt.textContent = `${cfg.start} - ${cfg.end}${cfg.label ? '  (' + cfg.label + ')' : ''}`;
        sel.appendChild(opt);
    });
    // คืนค่าที่เลือกไว้ถ้ายังอยู่ใน list
    if ([...sel.options].some(o => o.value === prevVal)) sel.value = prevVal;
}

function updateAttendanceSubFeatureButtons() {
    let sessionStr = sessionStorage.getItem('hr_user_session') || localStorage.getItem('hr_user_session');
    let userRole = 'Staff', userPerms = [];
    if (sessionStr) {
        try {
            let s = JSON.parse(sessionStr);
            userRole = s.role || 'Staff';
            userPerms = typeof parsePermissionsList === 'function' ? parsePermissionsList(s.permissions) : [];
        } catch (e) { }
    }

    const canShift = typeof hasSubFeaturePermission === 'function' ? hasSubFeaturePermission('Fingerprint_Logs', 'shift_settings', 'view', userPerms, userRole) : true;
    const canCalc = typeof hasSubFeaturePermission === 'function' ? hasSubFeaturePermission('Fingerprint_Logs', 'calc_payroll', 'view', userPerms, userRole) : true;
    const canHist = typeof hasSubFeaturePermission === 'function' ? hasSubFeaturePermission('Fingerprint_Logs', 'payroll_history', 'view', userPerms, userRole) : true;
    const canExp = typeof hasSubFeaturePermission === 'function' ? hasSubFeaturePermission('Fingerprint_Logs', 'export', 'view', userPerms, userRole) : true;

    const shiftBtn = document.getElementById('btn-attendance-shift-settings');
    if (shiftBtn) shiftBtn.style.display = canShift ? 'flex' : 'none';

    const calcBtn = document.getElementById('btn-attendance-calc-payroll');
    if (calcBtn) calcBtn.style.display = canCalc ? 'flex' : 'none';

    const histBtn = document.getElementById('btn-attendance-payroll-history');
    if (histBtn) histBtn.style.display = canHist ? 'flex' : 'none';

    ['btn-attendance-excel', 'btn-attendance-pdf', 'btn-attendance-print'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.style.display = canExp ? 'flex' : 'none';
    });
}
window.updateAttendanceSubFeatureButtons = updateAttendanceSubFeatureButtons;

/** เปิด Modal */
function openShiftSettingsModal() {
    let sessionStr = sessionStorage.getItem('hr_user_session') || localStorage.getItem('hr_user_session');
    let userRole = 'Staff', userPerms = [];
    if (sessionStr) {
        try {
            let s = JSON.parse(sessionStr);
            userRole = s.role || 'Staff';
            userPerms = typeof parsePermissionsList === 'function' ? parsePermissionsList(s.permissions) : [];
        } catch (e) { }
    }

    if (typeof hasSubFeaturePermission === 'function' && !hasSubFeaturePermission('Fingerprint_Logs', 'shift_settings', 'view', userPerms, userRole)) {
        if (typeof Swal !== 'undefined') {
            Swal.fire({ icon: 'warning', title: 'ไม่มีสิทธิ์เข้าถึง', text: 'คุณไม่มีสิทธิ์ใช้งานฟังก์ชันตั้งค่ากะเวลาเข้างาน' });
        } else {
            alert('คุณไม่มีสิทธิ์ใช้งานฟังก์ชันตั้งค่ากะเวลาเข้างาน');
        }
        return;
    }

    if (typeof toggleLoading === 'function') toggleLoading(false);
    try {
        const modal = document.getElementById('shift-settings-modal');
        if (!modal) {
            console.error('shift-settings-modal not found');
            return;
        }
        renderShiftConfigList();
        renderEmployeeAssignmentList(); // โหลดรายชื่อพนักงานด้วยเสมอ
        switchShiftTab('config'); // เริ่มที่แท็บ 1 เสมอ
        modal.classList.remove('hidden');
        modal.classList.add('flex');
    } catch (err) {
        console.error('Error opening shift settings modal:', err);
    }
}

/** ปิด Modal */
function closeShiftSettingsModal() {
    const modal = document.getElementById('shift-settings-modal');
    if (!modal) return;
    modal.classList.add('hidden');
    modal.classList.remove('flex');
}

/** Render รายการกะเวลาใน Modal */
function renderShiftConfigList() {
    const listEl = document.getElementById('shift-config-list');
    const emptyMsg = document.getElementById('shift-empty-msg');
    if (!listEl) return;
    const configs = loadShiftConfigs();
    listEl.innerHTML = '';

    if (!configs.length) {
        emptyMsg && emptyMsg.classList.remove('hidden');
        return;
    }
    emptyMsg && emptyMsg.classList.add('hidden');

    configs.forEach((cfg, idx) => {
        const row = document.createElement('div');
        row.className = 'flex items-center justify-between bg-white border border-gray-200 rounded-xl px-4 py-3 shadow-sm group hover:border-indigo-300 transition-all';
        row.innerHTML = `
            <div class="flex items-center gap-3">
                <div class="w-8 h-8 rounded-xl bg-gradient-to-br from-indigo-100 to-purple-100 flex items-center justify-center text-indigo-600 font-bold text-xs">
                    ${idx + 1}
                </div>
                <div>
                    <p class="font-bold text-gray-800 text-sm font-mono">${cfg.start} – ${cfg.end}</p>
                    ${cfg.label ? `<p class="text-gray-400 text-xs mt-0.5">${cfg.label}</p>` : ''}
                </div>
            </div>
            <button onclick="deleteShiftConfig('${cfg.id}')"
                class="text-gray-300 hover:text-rose-500 transition-colors text-sm opacity-0 group-hover:opacity-100">
                <i class="fa-solid fa-trash-can"></i>
            </button>
        `;
        listEl.appendChild(row);
    });
}

/** เพิ่มกะเวลาใหม่ */
function addShiftConfig() {
    const startEl = document.getElementById('shift-new-start');
    const endEl = document.getElementById('shift-new-end');
    const labelEl = document.getElementById('shift-new-label');

    const start = startEl ? startEl.value.trim() : '';
    const end = endEl ? endEl.value.trim() : '';
    const label = labelEl ? labelEl.value.trim() : '';

    if (!start || !end) {
        alert('กรุณาระบุเวลาเข้างานและเวลาเลิกงาน');
        return;
    }
    if (start >= end) {
        alert('เวลาเข้างานต้องน้อยกว่าเวลาเลิกงาน');
        return;
    }

    const configs = loadShiftConfigs();
    // ตรวจสอบซ้ำ
    const dup = configs.find(c => c.start === start && c.end === end);
    if (dup) {
        alert(`กะเวลา ${start} - ${end} มีอยู่แล้วครับ`);
        return;
    }

    configs.push({ id: genShiftId(), start, end, label });
    saveShiftConfigs(configs);
    renderShiftConfigList();

    // reset form
    if (startEl) startEl.value = '08:00';
    if (endEl) endEl.value = '17:00';
    if (labelEl) labelEl.value = '';
}

/** ลบกะเวลา */
function deleteShiftConfig(id) {
    let configs = loadShiftConfigs();
    const target = configs.find(c => c.id === id);
    if (!target) return;

    if (typeof showConfirmModal === 'function') {
        showConfirmModal(
            'ยืนยันการลบกะเวลา',
            `คุณต้องการลบกะเวลา <strong class="font-mono text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-md border border-indigo-100">${target.start} - ${target.end}</strong> ใช่หรือไม่?`,
            () => {
                let currentConfigs = loadShiftConfigs();
                currentConfigs = currentConfigs.filter(c => c.id !== id);
                saveShiftConfigs(currentConfigs);
                renderShiftConfigList();
                if (typeof showToast === 'function') {
                    showToast(`ลบกะเวลา ${target.start} - ${target.end} เรียบร้อยแล้ว`, 'success');
                }
            },
            null,
            true,
            'ตกลง',
            'ยกเลิก'
        );
    } else {
        if (!confirm(`ลบกะเวลา ${target.start} - ${target.end} ใช่ไหมครับ?`)) return;
        configs = configs.filter(c => c.id !== id);
        saveShiftConfigs(configs);
        renderShiftConfigList();
    }
}

/** บันทึกและใช้งาน — อัพเดต dropdown แล้วปิด modal */
function applyShiftSettings() {
    saveAllEmployeeShiftAssignments(); // บันทึกการกำหนดกะของพนักงาน
    populateShiftDropdown();
    closeShiftSettingsModal();
    // re-render ตารางถ้ามีข้อมูล
    if (typeof renderTable === 'function' && tableCache[currentSheet] && tableCache[currentSheet].data) {
        renderTable(tableCache[currentSheet].data);
    }
}

// ✅ Auto-init: โหลด dropdown เมื่อ DOM พร้อม
document.addEventListener('DOMContentLoaded', function () {
    populateShiftDropdown();
});
// fallback ถ้า DOMContentLoaded ผ่านไปแล้ว
if (document.readyState !== 'loading') {
    populateShiftDropdown();
    initYearSelector();
}

/* =====================================================================
 * 📅 PERIOD MODE (Monthly / Yearly Toggle)
 * ===================================================================== */

/** สลับโหมด: 'month' หรือ 'year' */
function setPeriodMode(mode) {
    window._attendancePeriodMode = mode;

    const btnMonth = document.getElementById('btn-period-month');
    const btnYear = document.getElementById('btn-period-year');
    const monthPicker = document.getElementById('calendarMonth');
    const yearPicker = document.getElementById('calendarYear');

    if (mode === 'year') {
        // Active: year
        if (btnYear) {
            btnYear.classList.add('bg-white', 'text-indigo-600', 'shadow-sm');
            btnYear.classList.remove('text-gray-500');
        }
        if (btnMonth) {
            btnMonth.classList.remove('bg-white', 'text-indigo-600', 'shadow-sm');
            btnMonth.classList.add('text-gray-500');
        }
        if (monthPicker) monthPicker.classList.add('hidden');
        if (yearPicker) yearPicker.classList.remove('hidden');
    } else {
        // Active: month
        window._attendancePeriodMode = 'month';
        if (btnMonth) {
            btnMonth.classList.add('bg-white', 'text-indigo-600', 'shadow-sm');
            btnMonth.classList.remove('text-gray-500');
        }
        if (btnYear) {
            btnYear.classList.remove('bg-white', 'text-indigo-600', 'shadow-sm');
            btnYear.classList.add('text-gray-500');
        }
        if (monthPicker) monthPicker.classList.remove('hidden');
        if (yearPicker) yearPicker.classList.add('hidden');
    }

    // Re-render table
    if (typeof renderTable === 'function' && tableCache[currentSheet] && tableCache[currentSheet].data) {
        renderTable(tableCache[currentSheet].data);
    }
}

/** สร้าง options ในปี selector (ปีปัจจุบัน ย้อนหลัง 10 ปี) */
function initYearSelector() {
    const sel = document.getElementById('calendarYear');
    if (!sel) return;
    const currentYear = new Date().getFullYear();
    sel.innerHTML = '';
    for (let y = currentYear; y >= currentYear - 10; y--) {
        const opt = document.createElement('option');
        opt.value = y;
        opt.textContent = `ปี ${y} (${y + 543})`; // แสดงทั้ง ค.ศ. และ พ.ศ.
        if (y === currentYear) opt.selected = true;
        sel.appendChild(opt);
    }
}

// Init on DOM ready
document.addEventListener('DOMContentLoaded', initYearSelector);

/* =====================================================================
 * 👥 SHIFT ASSIGNMENT SYSTEM — กำหนดกะเวลาให้พนักงานรายคน
 * เก็บใน localStorage['hr_shift_assignments']
 * Format: { "EMP001": "s1", "EMP002": "s2" }
 * ===================================================================== */

const SHIFT_ASSIGN_KEY = 'hr_shift_assignments';

/** โหลด assignment จาก localStorage */
function loadShiftAssignments() {
    try {
        const raw = localStorage.getItem(SHIFT_ASSIGN_KEY);
        return raw ? JSON.parse(raw) : {};
    } catch (e) { return {}; }
}

/** บันทึก assignment ลง localStorage */
function saveShiftAssignments(data) {
    localStorage.setItem(SHIFT_ASSIGN_KEY, JSON.stringify(data));
}

/** ดึงชื่อ-นามสกุลจริงของพนักงานจาก tableCache (Staff) หรืออิงจาก empId */
function getEmployeeFullName(empId, existingName) {
    const cleanId = String(empId || '').toUpperCase().trim();
    const existingStr = String(existingName || '').trim();

    if (existingStr && existingStr !== '-' && existingStr.toUpperCase() !== cleanId) {
        return existingStr;
    }

    if (!cleanId || cleanId === 'UNDEFINED' || cleanId === 'NULL' || cleanId === '-') return existingStr || '-';

    // 1. ค้นหาจาก tableCache Staff/staff
    const staffCache = tableCache['Staff'] || tableCache['staff'];
    if (staffCache && Array.isArray(staffCache.data)) {
        const match = staffCache.data.find(s => {
            const sId = String(s.Employee_ID || s.employee_id || s.Emp_ID || s.emp_id || s.id || '').toUpperCase().trim();
            return sId === cleanId;
        });
        if (match) {
            const bankName = String(match.Bank_Account_Name || match.bank_account_name || '').trim();
            const first = String(match.First_Name || match.first_name || match.FirstName || match.Name_TH || match['ชื่อ'] || '').trim();
            const last = String(match.Last_Name || match.last_name || match.LastName || match['นามสกุล'] || '').trim();
            const combined = [first, last].filter(Boolean).join(' ').trim();
            const rawName = String(match.Full_Name || match.full_name || match.Name || match.name || match['ชื่อ-นามสกุล'] || match['ชื่อพนักงาน'] || '').trim();

            const finalName = bankName || combined || rawName;
            if (finalName && finalName !== '-' && finalName.toUpperCase() !== cleanId) {
                return finalName;
            }
        }
    }

    // 2. ค้นหาจากตารางอื่นๆ ใน tableCache ที่มี Employee_ID ตรงกัน
    for (const key of Object.keys(tableCache)) {
        const cacheEntry = tableCache[key];
        if (cacheEntry && Array.isArray(cacheEntry.data)) {
            const match = cacheEntry.data.find(s => {
                const sId = String(s.Employee_ID || s.employee_id || s.Emp_ID || s.emp_id || '').toUpperCase().trim();
                const nameCandidate = String(s.Full_Name || s.full_name || s.Name || s.name || s.Bank_Account_Name || s['ชื่อ-นามสกุล'] || '').trim();
                return sId === cleanId && nameCandidate && nameCandidate.toUpperCase() !== cleanId && nameCandidate !== '-';
            });
            if (match) {
                const n = String(match.Full_Name || match.full_name || match.Name || match.name || match.Bank_Account_Name || match['ชื่อ-นามสกุล'] || '').trim();
                if (n && n.toUpperCase() !== cleanId) return n;
            }
        }
    }

    return cleanId;
}

/** อัปเดต Shift_Start, Shift_End และ Full_Name ของ log ตามพนักงานแต่ละคน */
function applyEmployeeShiftAssignmentsToLogs(rows) {
    if (!Array.isArray(rows) || !rows.length) return rows;
    const assignments = typeof loadShiftAssignments === 'function' ? loadShiftAssignments() : {};
    const configs = typeof loadShiftConfigs === 'function' ? loadShiftConfigs() : [];

    rows.forEach(r => {
        const empId = String(r.Employee_ID || r.employee_id || r.Emp_ID || r.emp_id || '').toUpperCase().trim();
        if (!empId) return;

        // Auto-enrich Full_Name if missing or showing empId
        const realName = getEmployeeFullName(empId, r.Full_Name || r.full_name || r['FULL NAME'] || r['Full Name']);
        if (realName && realName !== empId) {
            r.Full_Name = realName;
            if ('full_name' in r) r.full_name = realName;
            if ('FULL NAME' in r) r['FULL NAME'] = realName;
            if ('Full Name' in r) r['Full Name'] = realName;
        }

        if (!configs.length || !Object.keys(assignments).length) return;

        const shiftId = assignments[empId];
        if (shiftId) {
            const cfg = configs.find(c => c.id === shiftId || c.start === shiftId);
            if (cfg) {
                if ('Shift_Start' in r) r.Shift_Start = cfg.start;
                if ('shift_start' in r) r.shift_start = cfg.start;
                if ('Shift Start' in r) r['Shift Start'] = cfg.start;
                if (!r.Shift_Start && !r.shift_start && !r['Shift Start']) r.Shift_Start = cfg.start;

                if ('Shift_End' in r) r.Shift_End = cfg.end;
                if ('shift_end' in r) r.shift_end = cfg.end;
                if ('Shift End' in r) r['Shift End'] = cfg.end;
                if (!r.Shift_End && !r.shift_end && !r['Shift End']) r.Shift_End = cfg.end;
            }
        }
    });
    return rows;
}

/** แสดงรายชื่อพนักงานพร้อม dropdown เลือกกะ */
function renderEmployeeAssignmentList() {
    const listEl = document.getElementById('shift-assign-list');
    const emptyEl = document.getElementById('shift-assign-empty');
    if (!listEl) return;

    // ถ้าผู้ใช็กำลังคลิกหรือเปิด dropdown select อยู่ ห้าม re-render ทำลาย DOM
    if (document.activeElement && document.activeElement.tagName === 'SELECT' && listEl.contains(document.activeElement)) {
        return;
    }

    // ดึงรายชื่อพนักงานจากทุกแหล่งใน tableCache (staff, logs, users ฯลฯ)
    const empMap = new Map();

    function extractName(obj) {
        if (!obj) return '';
        // ดึง empId ก่อนเพื่อหลีกเลี่ยงการเอา empId มาแสดงเป็นชื่อ
        const empIdStr = String(obj.Employee_ID || obj.employee_id || obj.Emp_ID || obj.emp_id || obj.User_ID || obj.user_id || '').toUpperCase().trim();

        // ใช้วิธีเช็ค property ตรงๆ แทน getFuzzyValue เพื่อลดการประมวลผลที่ทำให้เบราว์เซอร์ค้าง
        const first = obj.first_name || obj.name || obj.full_name || obj['Employees Name'] || obj.employee_name || obj['ชื่อ'] || obj['ชื่อ-นามสกุล'] || obj.Full_Name || obj.fullname || obj.Firstname_TH || obj.Name_TH || obj.display_name;
        const last = obj.last_name || obj['นามสกุล'] || obj.Lastname;
        
        const firstStr = (first && first !== '-') ? String(first).trim() : '';
        const lastStr  = (last  && last  !== '-') ? String(last).trim()  : '';
        const combined = [firstStr, lastStr].filter(Boolean).join(' ').trim();
        if (combined && combined.toUpperCase() !== empIdStr) return combined;

        // fallback: ค้นชื่อด้วย property access โดยตรง
        const possibleName =
            obj.name || obj.Full_Name || obj.full_name || obj.fullname || obj.Fullname ||
            obj['ชื่อ-นามสกุล'] || obj['ชื่อ'] || obj.Name || obj.Firstname_TH ||
            obj.Name_TH || obj.display_name || obj.DisplayName ||
            obj['ชื่อพนักงาน'] || obj['ชื่อ-สกุล'] || obj.first_name || obj.FirstName || '';
        if (possibleName && String(possibleName).trim() !== '' && String(possibleName).trim().toUpperCase() !== empIdStr) {
            return String(possibleName).trim();
        }
        return '';
    }

    // สแกนข้อมูลจากทุกตารางที่มีอยู่ใน tableCache
    Object.keys(tableCache).forEach(key => {
        const cacheEntry = tableCache[key];
        if (cacheEntry && Array.isArray(cacheEntry.data)) {
            cacheEntry.data.forEach(r => {
                const empId = String(r.Employee_ID || r.employee_id || r.Emp_ID || r.emp_id || r.employeeId || r.User_ID || r.user_id || '').toUpperCase().trim();
                if (empId && empId !== 'UNDEFINED' && empId !== 'NULL' && empId !== 'UNASSIGNED') {
                    const name = extractName(r);
                    if (!empMap.has(empId)) {
                        empMap.set(empId, { empId, name });
                    } else if (name && !empMap.get(empId).name) {
                        empMap.get(empId).name = name;
                    }
                }
            });
        }
    });

    // 📌 โหลดข้อมูล staff จากเซิร์ฟเวอร์อัตโนมัติหากยังไม่มีข้อมูลชื่อพนักงานใน cache (ทำแค่ครั้งเดียวเพื่อป้องกัน infinite loop)
    const hasMissingNames = Array.from(empMap.values()).some(e => !e.name);
    const hasStaffCache = tableCache['staff'] && Array.isArray(tableCache['staff'].data) && tableCache['staff'].data.length > 0;

    if ((!hasStaffCache || hasMissingNames) && typeof google !== 'undefined' && google.script && google.script.run && !window._fetchingStaffForShift && !window._hasFetchedStaffForShift) {
        window._fetchingStaffForShift = true;
        window._hasFetchedStaffForShift = true; // Mark as fetched to prevent loop
        google.script.run.withSuccessHandler(res => {
            window._fetchingStaffForShift = false;
            if (res && res.success && Array.isArray(res.data)) {
                tableCache['staff'] = { headers: res.headers || [], data: res.data };
                renderEmployeeAssignmentList();
            }
        }).withFailureHandler(() => {
            window._fetchingStaffForShift = false;
        }).getSheetData('staff');
    }

    const employees = Array.from(empMap.values());
    employees.sort((a, b) => a.empId.localeCompare(b.empId, undefined, { numeric: true }));

    if (!employees.length) {
        listEl.innerHTML = '';
        emptyEl && emptyEl.classList.remove('hidden');
        return;
    }
    emptyEl && emptyEl.classList.add('hidden');

    const configs = loadShiftConfigs();
    const assignments = loadShiftAssignments();

    // Save globally to allow filtering without DOM manipulation
    window._allEmployeesForShift = employees;
    window._shiftConfigs = configs;
    window._shiftAssignments = assignments;

    // Render only first 50 initially to prevent Tailwind CDN freeze
    renderEmployeeAssignRows('');
}

/** Render employee rows to DOM with limit */
function renderEmployeeAssignRows(query) {
    const listEl = document.getElementById('shift-assign-list');
    if (!listEl) return;
    
    let filtered = window._allEmployeesForShift || [];
    if (query) {
        filtered = filtered.filter(emp => 
            emp.empId.toLowerCase().includes(query) || 
            (emp.name || '').toLowerCase().includes(query)
        );
    }
    
    // Only render top 100 to avoid Tailwind CDN bottleneck
    const toRender = filtered.slice(0, 100);
    
    const configs = window._shiftConfigs || [];
    const assignments = window._shiftAssignments || {};
    
    const shiftOptionsHtml = `
        <option value="">— ยังไม่กำหนด —</option>
        ${configs.map(c => `<option value="${c.id}">${c.start} - ${c.end}${c.label ? ' (' + c.label + ')' : ''}</option>`).join('')}
    `;

    listEl.innerHTML = toRender.map(emp => {
        const assigned = assignments[emp.empId] || '';
        const assignedCfg = configs.find(c => c.id === assigned || c.start === assigned);
        const badgeHtml = assignedCfg
            ? `<span class="badge-item text-[10px] font-mono font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full">${assignedCfg.start}</span>`
            : `<span class="badge-item text-[10px] text-gray-300">-</span>`;

        const displayName = emp.name || '-';

        return `
        <div class="emp-assign-row flex items-center justify-between bg-white border border-gray-200 rounded-xl px-3 py-2.5 hover:border-indigo-200 transition-all"
             data-empid="${emp.empId}">
            <div class="flex items-center gap-2.5 flex-1 min-w-0">
                <div class="w-7 h-7 rounded-xl bg-gradient-to-br from-indigo-100 to-purple-100 flex items-center justify-center text-indigo-600 font-bold text-xs flex-shrink-0">
                    ${emp.empId.slice(0, 2)}
                </div>
                <div class="min-w-0">
                    <p class="font-bold text-gray-800 text-xs truncate">${emp.empId}</p>
                    <p class="text-gray-400 text-[10px] truncate" title="${displayName}">${displayName}</p>
                </div>
            </div>
            <div class="flex items-center gap-2 ml-2">
                <div class="badge-container shrink-0">${badgeHtml}</div>
                <select data-empid="${emp.empId}"
                    onchange="quickAssignShift(this)"
                    class="bg-gray-50 border border-gray-200 text-gray-700 text-xs font-medium rounded-xl px-2.5 py-1.5 focus:ring-2 focus:ring-indigo-400 focus:border-indigo-400 outline-none cursor-pointer min-w-[140px] z-10 relative">
                    ${shiftOptionsHtml}
                </select>
            </div>
        </div>`;
    }).join('');

    // Update select values
    listEl.querySelectorAll('select[data-empid]').forEach(sel => {
        const empId = sel.getAttribute('data-empid');
        if (assignments[empId]) {
            const val = assignments[empId];
            const matchingCfg = configs.find(c => c.id === val || c.start === val);
            if (matchingCfg) {
                sel.value = matchingCfg.id;
            } else {
                sel.value = val;
            }
        }
    });
    
    if (filtered.length > 100) {
        listEl.innerHTML += `<div class="text-center text-xs text-gray-400 py-2">...และอีก ${filtered.length - 100} รายการ (พิมพ์ค้นหาเพื่อดูเพิ่มเติม)</div>`;
    }
}

/** กรองรายชื่อพนักงานตาม search */
function filterEmployeeAssignList() {
    const q = (document.getElementById('shift-assign-search')?.value || '').toLowerCase().trim();
    renderEmployeeAssignRows(q);
}

/** บันทึกการกำหนดกะแบบ real-time เมื่อเลือก dropdown */
function quickAssignShift(selectEl) {
    const empId = selectEl.getAttribute('data-empid');
    const shiftId = selectEl.value;
    if (!empId) return;
    const assignments = loadShiftAssignments();
    if (shiftId) {
        assignments[empId] = shiftId;
    } else {
        delete assignments[empId];
    }
    saveShiftAssignments(assignments);
    // แสดง badge "บันทึกแล้ว"
    const badge = document.getElementById('shift-assign-saved-badge');
    if (badge) {
        badge.classList.remove('hidden');
        clearTimeout(badge._hideTimer);
        badge._hideTimer = setTimeout(() => badge.classList.add('hidden'), 2500);
    }
    // อัพเดต badge ใน row
    const row = selectEl.closest('.emp-assign-row');
    if (row) {
        const configs = loadShiftConfigs();
        const assignedCfg = configs.find(c => c.id === shiftId || c.start === shiftId);
        const badgeContainer = row.querySelector('.badge-container');
        if (badgeContainer) {
            if (assignedCfg) {
                badgeContainer.innerHTML = `<span class="badge-item text-[10px] font-mono font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full">${assignedCfg.start}</span>`;
            } else {
                badgeContainer.innerHTML = `<span class="badge-item text-[10px] text-gray-300">-</span>`;
            }
        }
    }
}

/** บันทึก assignment ทั้งหมดจาก dropdown ใน list (เรียกตอนกด บันทึกและใช้งาน) */
function saveAllEmployeeShiftAssignments() {
    const assignments = loadShiftAssignments();
    document.querySelectorAll('select[data-empid]').forEach(sel => {
        const empId = sel.getAttribute('data-empid');
        const shiftId = sel.value;
        if (empId && shiftId) {
            assignments[empId] = shiftId;
        } else if (empId) {
            delete assignments[empId];
        }
    });
    saveShiftAssignments(assignments);
}

/** สลับแท็บใน modal */
function switchShiftTab(tab) {
    const tabConfig = document.getElementById('shift-tab-config');
    const tabAssign = document.getElementById('shift-tab-assign');
    const btnConfig = document.getElementById('shift-tab-btn-config');
    const btnAssign = document.getElementById('shift-tab-btn-assign');

    if (tab === 'assign') {
        tabConfig && tabConfig.classList.add('hidden');
        tabAssign && tabAssign.classList.remove('hidden');
        btnConfig && (btnConfig.className = 'flex-1 py-3 text-xs font-bold text-gray-400 border-b-2 border-transparent transition-all hover:text-indigo-500');
        btnAssign && (btnAssign.className = 'flex-1 py-3 text-xs font-bold text-indigo-600 border-b-2 border-indigo-600 transition-all');
        renderEmployeeAssignmentList(); // refresh
    } else {
        tabAssign && tabAssign.classList.add('hidden');
        tabConfig && tabConfig.classList.remove('hidden');
        btnAssign && (btnAssign.className = 'flex-1 py-3 text-xs font-bold text-gray-400 border-b-2 border-transparent transition-all hover:text-indigo-500');
        btnConfig && (btnConfig.className = 'flex-1 py-3 text-xs font-bold text-indigo-600 border-b-2 border-indigo-600 transition-all');
    }
}

// ── ⏰ OT RULES & SETTINGS LOGIC ──────────────────────────────────────────
window.getOtSettings = function () {
    try {
        const saved = localStorage.getItem('hr_ot_settings');
        if (saved) return JSON.parse(saved);
    } catch (e) { }

    return {
        sundayOtEnabled: true,
        sundayMode: 'hourly_multiplier', // 'hourly_multiplier' | 'flat_per_day' | 'flat_per_hour'
        sundayMultiplier: 2.0,
        sundayHoursSource: 'actual_worked', // 'actual_worked' | 'shift_hours'
        sundayFlatDay: 100000,
        sundayFlatHour: 20000,
        sundayMinMins: 60,
        sundayNoCheckout: 'shift_hours',
        weekdayOtEnabled: false,
        weekdayMultiplier: 1.5,
        weekdayMinMins: 30
    };
};

window.openOtSettingsModal = function () {
    const modal = document.getElementById('ot-settings-modal');
    if (!modal) return;

    const s = getOtSettings();
    const sundayEnable = document.getElementById('ot-sunday-enable');
    const sundayMode = document.getElementById('ot-sunday-mode');
    const sundayMultiplier = document.getElementById('ot-sunday-multiplier');
    const sundayHoursSource = document.getElementById('ot-sunday-hours-source');
    const sundayFlatDay = document.getElementById('ot-sunday-flat-day');
    const sundayFlatHour = document.getElementById('ot-sunday-flat-hour');
    const sundayMinMins = document.getElementById('ot-sunday-min-mins');
    const sundayNoCheckout = document.getElementById('ot-sunday-no-checkout');
    const weekdayEnable = document.getElementById('ot-weekday-enable');
    const weekdayMultiplier = document.getElementById('ot-weekday-multiplier');
    const weekdayMinMins = document.getElementById('ot-weekday-min-mins');

    if (sundayEnable) sundayEnable.checked = s.sundayOtEnabled !== false;
    if (sundayMode) sundayMode.value = s.sundayMode || 'hourly_multiplier';
    if (sundayMultiplier) sundayMultiplier.value = s.sundayMultiplier || 2.0;
    if (sundayHoursSource) sundayHoursSource.value = s.sundayHoursSource || 'actual_worked';
    if (sundayFlatDay) sundayFlatDay.value = s.sundayFlatDay || 100000;
    if (sundayFlatHour) sundayFlatHour.value = s.sundayFlatHour || 20000;
    if (sundayMinMins) sundayMinMins.value = s.sundayMinMins || 60;
    if (sundayNoCheckout) sundayNoCheckout.value = s.sundayNoCheckout || 'shift_hours';
    if (weekdayEnable) weekdayEnable.checked = s.weekdayOtEnabled === true;
    if (weekdayMultiplier) weekdayMultiplier.value = s.weekdayMultiplier || 1.5;
    if (weekdayMinMins) weekdayMinMins.value = s.weekdayMinMins || 30;

    toggleSundayOtFields();
    onSundayModeChange();
    toggleWeekdayOtFields();

    modal.classList.remove('hidden');
    modal.classList.add('flex');
};

window.closeOtSettingsModal = function () {
    const modal = document.getElementById('ot-settings-modal');
    if (modal) {
        modal.classList.add('hidden');
        modal.classList.remove('flex');
    }
};

window.toggleSundayOtFields = function () {
    const chk = document.getElementById('ot-sunday-enable');
    const fields = document.getElementById('ot-sunday-fields');
    if (fields) {
        if (chk && chk.checked) fields.classList.remove('hidden');
        else fields.classList.add('hidden');
    }
};

window.onSundayModeChange = function () {
    const mode = document.getElementById('ot-sunday-mode')?.value || 'hourly_multiplier';
    const fieldMult = document.getElementById('ot-field-multiplier');
    const fieldFlatDay = document.getElementById('ot-field-flat-day');
    const fieldFlatHour = document.getElementById('ot-field-flat-hour');

    if (fieldMult) fieldMult.classList.toggle('hidden', mode !== 'hourly_multiplier');
    if (fieldFlatDay) fieldFlatDay.classList.toggle('hidden', mode !== 'flat_per_day');
    if (fieldFlatHour) fieldFlatHour.classList.toggle('hidden', mode !== 'flat_per_hour');
};

window.toggleWeekdayOtFields = function () {
    const chk = document.getElementById('ot-weekday-enable');
    const fields = document.getElementById('ot-weekday-fields');
    if (fields) {
        if (chk && chk.checked) fields.classList.remove('hidden');
        else fields.classList.add('hidden');
    }
};

window.saveOtSettings = function () {
    const s = {
        sundayOtEnabled: document.getElementById('ot-sunday-enable')?.checked ?? true,
        sundayMode: document.getElementById('ot-sunday-mode')?.value || 'hourly_multiplier',
        sundayMultiplier: parseFloat(document.getElementById('ot-sunday-multiplier')?.value || 2.0) || 2.0,
        sundayHoursSource: document.getElementById('ot-sunday-hours-source')?.value || 'actual_worked',
        sundayFlatDay: parseFloat(document.getElementById('ot-sunday-flat-day')?.value || 100000) || 100000,
        sundayFlatHour: parseFloat(document.getElementById('ot-sunday-flat-hour')?.value || 20000) || 20000,
        sundayMinMins: parseInt(document.getElementById('ot-sunday-min-mins')?.value || 60, 10) || 60,
        sundayNoCheckout: document.getElementById('ot-sunday-no-checkout')?.value || 'shift_hours',
        weekdayOtEnabled: document.getElementById('ot-weekday-enable')?.checked ?? false,
        weekdayMultiplier: parseFloat(document.getElementById('ot-weekday-multiplier')?.value || 1.5) || 1.5,
        weekdayMinMins: parseInt(document.getElementById('ot-weekday-min-mins')?.value || 30, 10) || 30
    };

    localStorage.setItem('hr_ot_settings', JSON.stringify(s));
    closeOtSettingsModal();

    if (typeof showToast === 'function') {
        showToast('บันทึกเงื่อนไข OT เรียบร้อยแล้ว', 'success');
    }

    // Re-render attendance table and calendar with new OT rules
    if (typeof renderTable === 'function' && typeof currentSheet !== 'undefined' && currentSheet === 'Fingerprint_Logs' && typeof tableCache !== 'undefined' && tableCache['Fingerprint_Logs']) {
        renderTable(tableCache['Fingerprint_Logs'].data);
    }
};

window.calculateRowOt = function (row, staffObj, otSettings) {
    if (!otSettings) otSettings = getOtSettings();
    let rowOt = parseFloat(row.OT_Amount || row.ot_amount || 0) || 0;

    let rawDate = row.Date || row.date || (typeof getFuzzyValue === 'function' ? getFuzzyValue(row, ['Date', 'date', 'วันที่']) : '');
    let checkIn = row.Check_In || row.check_in || (typeof getFuzzyValue === 'function' ? getFuzzyValue(row, ['Check_In', 'check_in', 'in']) : '');
    let checkOut = row.Check_Out || row.check_out || (typeof getFuzzyValue === 'function' ? getFuzzyValue(row, ['Check_Out', 'check_out', 'out']) : '');
    let shiftStart = row.Shift_Start || row.shift_start || '09:00';
    let shiftEnd = row.Shift_End || row.shift_end || '17:00';

    let dateObj = (typeof parseDateStr === 'function') ? parseDateStr(rawDate) : new Date(rawDate);
    if (!dateObj || isNaN(dateObj.getTime())) return rowOt;

    const isSunday = dateObj.getDay() === 0;

    // Daily Rate and Hourly Rate
    let dailyRate = 0;
    if (staffObj) {
        dailyRate = parseFloat(staffObj.Daily_Rate || staffObj.daily_rate || staffObj.DAILY_RATE_FORMULA || ((parseFloat(staffObj.Base_Salary || staffObj.base_salary || 0)) / 30) || 0);
    }
    const hourlyRate = dailyRate > 0 ? (dailyRate / 8) : 15000; // fallback standard hourly rate if salary not set

    // 1. Sunday OT Rule
    if (isSunday && otSettings.sundayOtEnabled && checkIn && checkIn !== '-') {
        let workedMins = 0;
        if (checkOut && checkOut !== '-') {
            let inM = parseInt(String(checkIn).split(':')[0] || 0) * 60 + parseInt(String(checkIn).split(':')[1] || 0);
            let outM = parseInt(String(checkOut).split(':')[0] || 0) * 60 + parseInt(String(checkOut).split(':')[1] || 0);
            if (outM > inM) workedMins = outM - inM;
        } else {
            if (otSettings.sundayNoCheckout === 'shift_hours') workedMins = 8 * 60;
            else if (otSettings.sundayNoCheckout === 'half_day') workedMins = 4 * 60;
            else workedMins = 0;
        }

        if (workedMins >= otSettings.sundayMinMins) {
            let workedHours = otSettings.sundayHoursSource === 'shift_hours' ? 8 : (workedMins / 60);

            if (otSettings.sundayMode === 'hourly_multiplier') {
                let sundayOt = Math.round(workedHours * hourlyRate * otSettings.sundayMultiplier);
                return Math.max(rowOt, sundayOt);
            } else if (otSettings.sundayMode === 'flat_per_day') {
                return Math.max(rowOt, otSettings.sundayFlatDay);
            } else if (otSettings.sundayMode === 'flat_per_hour') {
                let sundayOt = Math.round(workedHours * otSettings.sundayFlatHour);
                return Math.max(rowOt, sundayOt);
            }
        }
    }

    // 2. Weekday OT Rule
    if (!isSunday && otSettings.weekdayOtEnabled && checkOut && checkOut !== '-' && shiftEnd && shiftEnd !== '-') {
        let outM = parseInt(String(checkOut).split(':')[0] || 0) * 60 + parseInt(String(checkOut).split(':')[1] || 0);
        let endM = parseInt(String(shiftEnd).split(':')[0] || 0) * 60 + parseInt(String(shiftEnd).split(':')[1] || 0);
        if (outM > endM) {
            let lateOutMins = outM - endM;
            if (lateOutMins >= otSettings.weekdayMinMins) {
                let otHours = lateOutMins / 60;
                let weekdayOt = Math.round(otHours * hourlyRate * otSettings.weekdayMultiplier);
                return rowOt + weekdayOt;
            }
        }
    }

    return rowOt;
};

/* =====================================================================
 * 🗂️ Leave Status Tab Filter (แท็บ: ทั้งหมด / รออนุมัติ / อนุมัติแล้ว / ปฏิเสธ)
 * ===================================================================== */
window.activeLeaveStatusFilter = 'all';

window.setLeaveStatusFilter = function (status) {
    window.activeLeaveStatusFilter = status || 'all';
    if (typeof filterData === 'function') {
        filterData();
    } else if (typeof renderTable === 'function' && tableCache[currentSheet]) {
        renderTable(tableCache[currentSheet].data);
    }
};

/* =====================================================================
 * 📅 Leave Date/Period Filter (เฉพาะหน้า Leave Requests)
 * ===================================================================== */
window.activeLeavePeriodMode = 'all';

window.setLeavePeriodMode = function (mode) {
    window.activeLeavePeriodMode = mode || 'all';
    const modes = ['all', 'month', 'range', 'year'];
    modes.forEach(m => {
        const btn = document.getElementById(`btn-leave-period-${m}`);
        if (btn) {
            if (m === window.activeLeavePeriodMode) {
                btn.className = 'px-3 py-1.5 rounded-lg text-xs font-bold transition-all bg-white text-brandindigo shadow-sm';
            } else {
                btn.className = 'px-3 py-1.5 rounded-lg text-xs font-bold transition-all text-gray-600 hover:text-gray-900';
            }
        }
        const picker = document.getElementById(`leave-picker-${m}`);
        if (picker) {
            if (m === window.activeLeavePeriodMode && m !== 'all') {
                picker.classList.remove('hidden');
            } else {
                picker.classList.add('hidden');
            }
        }
    });

    if (window.activeLeavePeriodMode === 'month') {
        const mInput = document.getElementById('leaveMonthInput');
        if (mInput && !mInput.value) {
            const today = new Date();
            mInput.value = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
        }
    } else if (window.activeLeavePeriodMode === 'year') {
        const yInput = document.getElementById('leaveYearInput');
        if (yInput && !yInput.value) {
            yInput.value = String(new Date().getFullYear());
        }
    }

    if (typeof filterData === 'function') {
        filterData();
    }
};

/* =====================================================================
 * 🏢 Attendance Department Tabs Renderer & Filter System (Mapped by ID Prefix)
 * ===================================================================== */
window.activeAttendanceDept = window.activeAttendanceDept || 'all';

function getDepartmentByEmployeeId(empId, staffRow = null) {
    let cleanId = String(empId || '').toUpperCase().trim();
    if (!cleanId) return null;

    // 1. Direct Employee ID Prefix mapping (อิงตามรหัสพนักงานตามที่กำหนด)
    if (cleanId.startsWith('DMC') || cleanId.startsWith('DM')) {
        return { id: 'DEPT-9HQYN', name: 'Doctor', code: 'DMC', prefix: ['DMC', 'DM'], icon: 'fa-user-doctor' };
    }
    if (cleanId.startsWith('SR')) {
        return { id: 'DEPT-DQMTT', name: 'SOWROM', code: 'SR', prefix: ['SR'], icon: 'fa-warehouse' };
    }
    if (cleanId.startsWith('PM')) {
        return { id: 'DEPT-Y646E', name: 'Project Manager', code: 'PM', prefix: ['PM'], icon: 'fa-list-check' };
    }
    if (cleanId.startsWith('MT') || cleanId.startsWith('MKT')) {
        return { id: 'DEPT-VNIE2', name: 'Marketing', code: 'MT', prefix: ['MT', 'MKT'], icon: 'fa-bullhorn' };
    }
    if (cleanId.startsWith('HKP') || cleanId.startsWith('HK')) {
        return { id: 'DEPT-ULK0S', name: 'Housekeeper', code: 'HKP', prefix: ['HKP', 'HK'], icon: 'fa-broom' };
    }
    if (cleanId.startsWith('CFO') || cleanId.startsWith('CF')) {
        return { id: 'DEPT-MRIH7', name: 'CFO', code: 'CFO', prefix: ['CFO', 'CF'], icon: 'fa-coins' };
    }
    if (/^M\d+/i.test(cleanId) || cleanId.startsWith('MGR') || cleanId.startsWith('MAN')) {
        return { id: 'DEPT-CAX5G', name: 'MANAGER', code: 'M', prefix: ['M'], icon: 'fa-user-tie' };
    }

    // 2. Fallback to staffRow metadata
    if (staffRow) {
        let sDeptId = String(staffRow.Department_ID || staffRow.department_id || staffRow.department || staffRow['แผนก'] || staffRow['ພະແນກ'] || '').trim().toUpperCase();
        let sDeptName = String(staffRow.department_name || staffRow.Department_Name || staffRow.department || '').trim().toLowerCase();

        if (sDeptId.includes('9HQYN') || sDeptName.includes('doc') || sDeptId.includes('DOC') || sDeptName.includes('หมอ') || sDeptName.includes('ແພດ')) {
            return { id: 'DEPT-9HQYN', name: 'Doctor', code: 'DMC', prefix: ['DMC', 'DM'], icon: 'fa-user-doctor' };
        }
        if (sDeptId.includes('DQMTT') || sDeptName.includes('sowrom') || sDeptId.includes('SR')) {
            return { id: 'DEPT-DQMTT', name: 'SOWROM', code: 'SR', prefix: ['SR'], icon: 'fa-warehouse' };
        }
        if (sDeptId.includes('Y646E') || sDeptName.includes('project') || sDeptId.includes('PM')) {
            return { id: 'DEPT-Y646E', name: 'Project Manager', code: 'PM', prefix: ['PM'], icon: 'fa-list-check' };
        }
        if (sDeptId.includes('VNIE2') || sDeptName.includes('market') || sDeptId.includes('MT') || sDeptName.includes('maket') || sDeptName.includes('การตลาด')) {
            return { id: 'DEPT-VNIE2', name: 'Marketing', code: 'MT', prefix: ['MT', 'MKT'], icon: 'fa-bullhorn' };
        }
        if (sDeptId.includes('ULK0S') || sDeptName.includes('house') || sDeptId.includes('HK') || sDeptName.includes('แม่บ้าน') || sDeptName.includes('ແມ່ບ້ານ')) {
            return { id: 'DEPT-ULK0S', name: 'Housekeeper', code: 'HKP', prefix: ['HKP', 'HK'], icon: 'fa-broom' };
        }
        if (sDeptId.includes('MRIH7') || sDeptName.includes('cfo') || sDeptId.includes('CF') || sDeptName.includes('การเงิน')) {
            return { id: 'DEPT-MRIH7', name: 'CFO', code: 'CFO', prefix: ['CFO', 'CF'], icon: 'fa-coins' };
        }
        if (sDeptId.includes('CAX5G') || sDeptName.includes('manager') || sDeptId.includes('MGR') || sDeptName.includes('ผู้จัดการ')) {
            return { id: 'DEPT-CAX5G', name: 'MANAGER', code: 'M', prefix: ['M'], icon: 'fa-user-tie' };
        }
    }

    return null;
}

function renderAttendanceDepartmentTabs() {
    const container = document.getElementById('attendance-dept-tabs-container');
    const banner = document.getElementById('attendance-dept-banner');
    if (!container) return;

    if (typeof currentSheet === 'undefined' || currentSheet !== 'Fingerprint_Logs') {
        container.innerHTML = '';
        if (banner) banner.classList.add('hidden');
        container.classList.add('hidden');
        return;
    }
    if (banner) banner.classList.remove('hidden');
    container.classList.remove('hidden');

    // 1. Staff and Logs data
    const staffCache = (typeof tableCache !== 'undefined') ? (tableCache['staff'] || tableCache['Staff']) : null;
    const staffList = (staffCache && Array.isArray(staffCache.data)) ? staffCache.data : [];
    const logList = (tableCache['Fingerprint_Logs'] && Array.isArray(tableCache['Fingerprint_Logs'].data)) ? tableCache['Fingerprint_Logs'].data : [];

    // 2. Base Department configurations with exact prefixes
    const coreDepts = [
        { id: 'DEPT-ULK0S', name: 'Housekeeper', code: 'HKP', prefix: ['HKP', 'HK'], icon: 'fa-broom', staffCount: 0 },
        { id: 'DEPT-9HQYN', name: 'Doctor', code: 'DMC', prefix: ['DMC', 'DM'], icon: 'fa-user-doctor', staffCount: 0 },
        { id: 'DEPT-DQMTT', name: 'SOWROM', code: 'SR', prefix: ['SR'], icon: 'fa-warehouse', staffCount: 0 },
        { id: 'DEPT-VNIE2', name: 'Marketing', code: 'MT', prefix: ['MT', 'MKT'], icon: 'fa-bullhorn', staffCount: 0 },
        { id: 'DEPT-CAX5G', name: 'MANAGER', code: 'M', prefix: ['M'], icon: 'fa-user-tie', staffCount: 0 },
        { id: 'DEPT-Y646E', name: 'Project Manager', code: 'PM', prefix: ['PM'], icon: 'fa-list-check', staffCount: 0 },
        { id: 'DEPT-MRIH7', name: 'CFO', code: 'CFO', prefix: ['CFO', 'CF'], icon: 'fa-coins', staffCount: 0 }
    ];

    // Count employees in staffList
    let totalActiveStaff = 0;
    if (staffList.length > 0) {
        staffList.forEach(s => {
            let status = String(s.status || s.Status || s['สถานะ'] || 'Active').toLowerCase();
            if (status.includes('resign') || status.includes('inactive') || status.includes('ออก')) return;
            totalActiveStaff++;

            let eId = String(s.employee_id || s.emp_id || s.Employee_ID || '').toUpperCase().trim();
            let dept = getDepartmentByEmployeeId(eId, s);
            if (dept) {
                let match = coreDepts.find(d => d.id === dept.id || d.code === dept.code);
                if (match) match.staffCount++;
            }
        });
    } else {
        // Count from logs unique employee IDs if staff table not loaded
        const seenEmpIds = new Set();
        logList.forEach(l => {
            let eId = String(l.Employee_ID || l.employee_id || l.Emp_ID || '').toUpperCase().trim();
            if (!eId || seenEmpIds.has(eId)) return;
            seenEmpIds.add(eId);
            totalActiveStaff++;
            let dept = getDepartmentByEmployeeId(eId);
            if (dept) {
                let match = coreDepts.find(d => d.id === dept.id || d.code === dept.code);
                if (match) match.staffCount++;
            }
        });
    }

    // 3. Generate Tabs HTML
    const currentActive = window.activeAttendanceDept || 'all';
    const isAllActive = (currentActive === 'all' || !currentActive);
    let allLabel = (typeof t === 'function') ? (t('dept_all') || 'ທັງໝົດ') : 'ທັງໝົດ';

    let html = `
        <button type="button" onclick="setAttendanceDeptFilter('all')"
            class="attendance-dept-tab group px-3.5 py-2 rounded-xl text-xs font-black transition-all flex items-center gap-2 shrink-0 whitespace-nowrap cursor-pointer transform hover:-translate-y-0.5 ${
                isAllActive
                    ? 'bg-gradient-to-r from-brandindigo via-indigo-600 to-brandpurple text-white shadow-md shadow-indigo-500/25 border border-indigo-400 ring-2 ring-indigo-300/40'
                    : 'bg-slate-50/90 hover:bg-indigo-50/80 text-gray-700 hover:text-brandindigo border border-gray-200/90 hover:border-indigo-300 font-bold shadow-2xs'
            }">
            <i class="fa-solid fa-layer-group text-[12px] ${isAllActive ? 'text-indigo-200' : 'text-gray-400 group-hover:text-brandindigo'} transition-colors"></i>
            <span>${allLabel} (All)</span>
            <span class="${isAllActive ? 'bg-white/25 text-white' : 'bg-gray-200/80 group-hover:bg-indigo-100 text-gray-700 group-hover:text-indigo-800'} text-[10px] font-black px-2 py-0.5 rounded-full transition-colors">${totalActiveStaff}</span>
        </button>
    `;

    coreDepts.forEach(dept => {
        const isActive = (
            currentActive === dept.id ||
            currentActive === dept.name ||
            currentActive === dept.code ||
            currentActive.toLowerCase() === dept.id.toLowerCase() ||
            currentActive.toLowerCase() === dept.name.toLowerCase() ||
            currentActive.toLowerCase() === dept.code.toLowerCase()
        );

        const badgeStyle = isActive
            ? 'bg-white/25 text-white'
            : 'bg-indigo-50 group-hover:bg-indigo-100 text-indigo-700 group-hover:text-indigo-900';

        const iconStyle = isActive
            ? 'text-indigo-200'
            : 'text-gray-400 group-hover:text-brandindigo';

        html += `
            <button type="button" onclick="setAttendanceDeptFilter('${dept.id}')"
                title="${dept.name} (${dept.code} - ${dept.prefix.join('/')})"
                class="attendance-dept-tab group px-3.5 py-2 rounded-xl text-xs font-black transition-all flex items-center gap-2 shrink-0 whitespace-nowrap cursor-pointer transform hover:-translate-y-0.5 ${
                    isActive
                        ? 'bg-gradient-to-r from-brandindigo via-indigo-600 to-brandpurple text-white shadow-md shadow-indigo-500/25 border border-indigo-400 ring-2 ring-indigo-300/40'
                        : 'bg-slate-50/90 hover:bg-indigo-50/80 text-gray-700 hover:text-brandindigo border border-gray-200/90 hover:border-indigo-300 font-bold shadow-2xs'
                }">
                <i class="fa-solid ${dept.icon || 'fa-users'} text-[12px] ${iconStyle} transition-colors"></i>
                <span>${dept.name}</span>
                <span class="${badgeStyle} text-[10px] font-black px-2 py-0.5 rounded-full transition-colors">${dept.staffCount}</span>
            </button>
        `;
    });

    container.innerHTML = html;
}

window.setAttendanceDeptFilter = function (deptId) {
    window.activeAttendanceDept = deptId || 'all';

    // Clear single-employee input for Admin/Manager to show full department records
    const sessionStr = localStorage.getItem('hr_user_session') || sessionStorage.getItem('hr_user_session');
    let userRole = 'Staff';
    if (sessionStr) {
        try { userRole = JSON.parse(sessionStr).role || 'Staff'; } catch (e) {}
    }
    if (userRole !== 'Staff') {
        const calEmpInput = document.getElementById('calendarEmpId');
        if (calEmpInput) calEmpInput.value = '';
        const searchInput = document.getElementById('searchInput');
        if (searchInput) searchInput.value = '';
    }

    // Sync with hidden select if present
    const sel = document.getElementById('attendance-dept-filter');
    if (sel) sel.value = (deptId === 'all' ? '' : deptId);

    // Update active tab buttons visual state
    renderAttendanceDepartmentTabs();

    // Re-render table data and summary stats
    if (typeof renderTable === 'function' && typeof currentSheet !== 'undefined' && currentSheet === 'Fingerprint_Logs') {
        const rawLogs = (tableCache['Fingerprint_Logs'] && Array.isArray(tableCache['Fingerprint_Logs'].data))
            ? tableCache['Fingerprint_Logs'].data
            : (window.rawData || []);
        renderTable(rawLogs);
    }
};

window.getDepartmentByEmployeeId = getDepartmentByEmployeeId;
window.renderAttendanceDepartmentTabs = renderAttendanceDepartmentTabs;


