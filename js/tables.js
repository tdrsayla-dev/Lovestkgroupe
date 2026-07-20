// ─────────────────────────────────────────────────────────────────────────────
// js/tables.js - Table Rendering & Grid Formatter
// ─────────────────────────────────────────────────────────────────────────────

/* =====================================================================
 * 📌 ส่วนที่ 17: TABLE RENDERING (ฟังก์ชันตารางแสดงข้อมูล)
 * - แสดงตารางข้อมูลพนักงาน, การเข้างาน ฯลฯ และจัดการหน้าแบ่งข้อมูล (Pagination)
 * ===================================================================== */
function renderTable(data) {
    document.getElementById('table-controls-wrapper').classList.remove('hidden');
    document.getElementById('org-chart-wrapper').classList.add('hidden');

    const sessionStr = localStorage.getItem('hr_user_session') || sessionStorage.getItem('hr_user_session');
    let role = 'Staff';
    let sessionEmpId = '';
    if (sessionStr) {
        try {
            let s = JSON.parse(sessionStr);
            role = s.role || 'Staff';
            sessionEmpId = String(s.empId || s.employeeId || s.username || '').trim().toUpperCase();
        } catch (e) { }
    }

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
        summaryDiv.classList.remove('hidden');
        if (calSec) calSec.classList.remove('hidden');
        if (addDataBtn) addDataBtn.classList.add('hidden');
        if (searchWrapper) searchWrapper.classList.add('hidden');

        let deptFilter = document.getElementById('attendance-dept-filter') ? document.getElementById('attendance-dept-filter').value : '';
        if (deptFilter) {
            const staffCache = tableCache['staff'] || tableCache['Staff'];
            const staffData = staffCache ? staffCache.data : [];
            data = data.filter(r => {
                let eId = String(r.Employee_ID || r.Emp_ID).toUpperCase().trim();
                let staffRow = staffData.find(s => String(s.employee_id || s.emp_id).toUpperCase().trim() === eId);
                if (staffRow) {
                    let staffDept = String(staffRow['department'] || staffRow['department_id'] || staffRow['แผนก'] || '').toLowerCase();
                    return staffDept.includes(deptFilter.toLowerCase());
                }
                return false;
            });
        }

        let calMonthInput = document.getElementById('calendarMonth');
        let calEmpInput = document.getElementById('calendarEmpId');

        if (!calMonthInput.value) {
            let d = new Date();
            calMonthInput.value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        }

        if (role === 'Staff') {
            calEmpInput.value = sessionEmpId;
            calEmpInput.readOnly = true;
            calEmpInput.classList.add('bg-gray-100', 'text-gray-500');
        }

        let targetEmp = calEmpInput.value.toUpperCase().trim();
        let tYear = parseInt(calMonthInput.value.split('-')[0]);
        let tMonth = parseInt(calMonthInput.value.split('-')[1]);
        let sumLate = 0, sumEarly = 0, sumAbsent = 0, sumOT = 0;

        if (tYear && tMonth) {
            data = data.filter(row => {
                let rDate = getFuzzyValue(row, ['date', 'วันที่']);
                if (!rDate || rDate === '-') return false;
                let p = String(rDate).split('/');
                if (p.length === 3 && parseInt(p[1]) === tMonth && parseInt(p[2]) === tYear) return true;
                let p2 = String(rDate).split('-');
                if (p2.length === 3 && parseInt(p2[1]) === tMonth && parseInt(p2[0]) === tYear) return true;
                return false;
            });
        }

        if (targetEmp && tYear && tMonth) {
            let empLogs = data.filter(r => String(r.Employee_ID || r.Emp_ID).toUpperCase().trim() === targetEmp);
            let absentCount = renderAttendanceCalendar(tYear, tMonth, empLogs, targetEmp);

            let sDate = `${tYear}-${String(tMonth).padStart(2, '0')}-01`;
            let eDateObj = new Date(tYear, tMonth, 0);
            let eDate = `${tYear}-${String(tMonth).padStart(2, '0')}-${String(eDateObj.getDate()).padStart(2, '0')}`;

            data = fillMissingDays(empLogs, sDate, eDate, targetEmp);

            data.forEach(row => {
                let late = parseFloat(row.Late_Hours || row.late_hours || 0) || 0;
                let early = parseFloat(row.Early_Leave_Hours || row.early_leave_hours || 0) || 0;
                let ot = parseFloat(row.OT_Amount || row.ot_amount || 0) || 0;

                if (late === 0 && row.Check_In && row.Check_In !== '-' && row.Shift_Start && row.Shift_Start !== '-') {
                    let inMins = parseInt(String(row.Check_In).split(':')[0] || 0) * 60 + parseInt(String(row.Check_In).split(':')[1] || 0);
                    let startMins = parseInt(String(row.Shift_Start).split(':')[0] || 0) * 60 + parseInt(String(row.Shift_Start).split(':')[1] || 0);
                    if (inMins > startMins) late = (inMins - startMins) / 60;
                }
                if (early === 0 && row.Check_Out && row.Check_Out !== '-' && row.Shift_End && row.Shift_End !== '-') {
                    let outMins = parseInt(String(row.Check_Out).split(':')[0] || 0) * 60 + parseInt(String(row.Check_Out).split(':')[1] || 0);
                    let endMins = parseInt(String(row.Shift_End).split(':')[0] || 0) * 60 + parseInt(String(row.Shift_End).split(':')[1] || 0);
                    if (outMins < endMins && outMins > 0) early = (endMins - outMins) / 60;
                }

                sumLate += late;
                sumEarly += early;
                sumOT += ot;
            });
            sumAbsent = absentCount;
        } else {
            if (document.getElementById('attendance-calendar-grid')) {
                document.getElementById('attendance-calendar-grid').innerHTML = '<div class="col-span-7 text-center py-8 text-gray-400 text-xs font-bold uppercase tracking-widest border border-dashed border-gray-200 rounded-xl">Specify an Employee ID to view calendar</div>';
            }

            data.forEach(row => {
                let late = parseFloat(row.Late_Hours || row.late_hours || 0) || 0;
                let early = parseFloat(row.Early_Leave_Hours || row.early_leave_hours || 0) || 0;
                let ot = parseFloat(row.OT_Amount || row.ot_amount || 0) || 0;
                let status = String(getFuzzyValue(row, ['attendance_status', 'status'])).toLowerCase();

                if (late === 0 && row.Check_In && row.Check_In !== '-' && row.Shift_Start && row.Shift_Start !== '-') {
                    let inMins = parseInt(String(row.Check_In).split(':')[0] || 0) * 60 + parseInt(String(row.Check_In).split(':')[1] || 0);
                    let startMins = parseInt(String(row.Shift_Start).split(':')[0] || 0) * 60 + parseInt(String(row.Shift_Start).split(':')[1] || 0);
                    if (inMins > startMins) late = (inMins - startMins) / 60;
                }
                if (early === 0 && row.Check_Out && row.Check_Out !== '-' && row.Shift_End && row.Shift_End !== '-') {
                    let outMins = parseInt(String(row.Check_Out).split(':')[0] || 0) * 60 + parseInt(String(row.Check_Out).split(':')[1] || 0);
                    let endMins = parseInt(String(row.Shift_End).split(':')[0] || 0) * 60 + parseInt(String(row.Shift_End).split(':')[1] || 0);
                    if (outMins < endMins && outMins > 0) early = (endMins - outMins) / 60;
                }

                sumLate += late;
                sumEarly += early;
                sumOT += ot;
                if (status.includes('missing') || status.includes('absent') || status.includes('ขาด')) sumAbsent++;
            });
        }

        document.getElementById('filter-late').innerText = (Math.round(sumLate * 100) / 100);
        document.getElementById('filter-early').innerText = (Math.round(sumEarly * 100) / 100);
        document.getElementById('filter-absent').innerText = sumAbsent;
        document.getElementById('filter-ot').innerText = new Intl.NumberFormat('th-TH').format(sumOT);

        if (tableDateFilter) tableDateFilter.classList.add('hidden');

    } else {
        summaryDiv.classList.add('hidden');
        if (calSec) calSec.classList.add('hidden');
        if (addDataBtn) {
            if (role === 'Staff' && currentSheet !== 'Leave application' && currentSheet !== 'Budget_Requests' && currentSheet !== 'Budget Request') {
                addDataBtn.classList.add('hidden');
            } else {
                addDataBtn.classList.remove('hidden');
            }
        }
        if (searchWrapper) searchWrapper.classList.remove('hidden');
    }

    let validRowsCount = 0;
    let sumLeaveDays = 0;
    let sumBudgetAmount = 0;

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
        if (currentSheet === 'Budget Request') {
            for (let k in row) {
                if (k.toLowerCase().includes('amount')) {
                    sumBudgetAmount += parseFloat(row[k]) || 0;
                }
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
    if (currentSheet === 'Budget Request') {
        if (totalAmountSpan) {
            totalAmountSpan.classList.remove('hidden');
            document.getElementById('sum-budget-amount').innerText = new Intl.NumberFormat('th-TH').format(sumBudgetAmount);
        }
    } else {
        if (totalAmountSpan) totalAmountSpan.classList.add('hidden');
    }

    if (currentSheet === 'Training' || currentSheet === 'Asset_Tracking' || currentSheet === 'Announcements' || currentSheet === 'News' || currentSheet.includes('Ranting') || currentSheet.includes('Rating') || currentSheet.trim() === 'Policy' || currentSheet.trim() === 'Documents') {
        tableWrapper.classList.add('hidden');
        cardWrapper.classList.remove('hidden');
        cardWrapper.innerHTML = '';
        summaryDiv.classList.add('hidden');
        if (addDataBtn) addDataBtn.classList.remove('hidden');

        if ((currentSheet === 'Announcements' || currentSheet === 'News' || currentSheet === 'Training' || currentSheet === 'Asset_Tracking' || currentSheet.trim() === 'Documents' || currentSheet.trim() === 'Policy') && role === 'Staff') {
            if (addDataBtn) addDataBtn.classList.add('hidden');
        }

        let isRatingPage = currentSheet.includes('Ranting') || currentSheet.includes('Rating');

        let topBarWrapper = document.getElementById('table-controls-wrapper');
        let topBar = topBarWrapper ? topBarWrapper.firstElementChild : null;

        if (isRatingPage && role === 'Staff') {
            if (topBar) topBar.style.display = 'none';
        } else if (isRatingPage && role !== 'Staff') {
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

                if (role !== 'Staff') {
                    cardArr.push('<div class="absolute top-3 right-3 flex space-x-2 z-10 bg-white/90 backdrop-blur-sm rounded-lg p-1.5" onclick="event.stopPropagation()">');
                    cardArr.push('<button onclick="openFormModal(\'', encodedRow, '\')" class="text-gray-500 hover:text-gray-800 transition-colors" title="Edit"><i class="fa-regular fa-pen-to-square text-lg"></i></button>');
                    cardArr.push('<button onclick="deleteRecord(\'', rowId, '\')" class="text-gray-500 hover:text-red-500 transition-colors" title="Delete"><i class="fa-regular fa-trash-can text-lg"></i></button>');
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

            if (role === 'Staff' && sessionEmpId) {
                data = data.filter(row => {
                    const empId = String(getFuzzyValue(row, ['employee_id', 'employee', 'ผู้ถือครอง', 'ລະຫັດພະນັກງານ']) || '').trim().toUpperCase();
                    return empId === sessionEmpId;
                });
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
                else if (statusLower.includes('cancel') || statusLower.includes('เพแล้ว') || statusLower.includes('ເພແລ້ວ') || statusLower.includes('เสีย') || statusLower.includes('inactive')) {
                    statusColor = 'text-red-500';
                }
                else if (statusLower.includes('ongoing') || statusLower.includes('กำลังซ่อม') || statusLower.includes('ສ້ອມ') || statusLower.includes('ซ่อม')) {
                    statusColor = 'text-orange-500';
                }

                let cardArr = [];
                cardArr.push(`<div onclick="showAssetFromId('${rowId}')" class="bg-white rounded-3xl shadow-sm border border-gray-200 overflow-hidden flex flex-col relative transition-all duration-300 hover:shadow-xl hover:-translate-y-1 cursor-pointer group p-4 pb-0">`);

                cardArr.push('<div class="flex justify-between items-start mb-2">');
                cardArr.push(`<div class="font-bold text-[13px] tracking-wide text-gray-800">ສະຖານະ: <span class="${statusColor}">${escapeHtml(status || '-')}</span></div>`);

                if (role !== 'Staff') {
                    cardArr.push('<div class="flex space-x-2 z-10 bg-white" onclick="event.stopPropagation()">');
                    cardArr.push(`<button onclick="editAssetFromId('${rowId}', event)" class="text-gray-400 hover:text-gray-800 transition-colors" title="Edit"><i class="fa-regular fa-pen-to-square text-[15px]"></i></button>`);
                    cardArr.push(`<button onclick="event.stopPropagation(); deleteRecord('${rowId}')" class="text-gray-400 hover:text-red-500 transition-colors" title="Delete"><i class="fa-regular fa-trash-can text-[15px]"></i></button>`);
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

                if (role !== 'Staff') {
                    cardArr.push('<div class="flex space-x-2 shrink-0 mt-0.5">');
                    cardArr.push(`<button onclick="editAnnounceFromId('${rowId}', event)" class="text-gray-400 hover:text-brandindigo transition-colors" title="Edit"><i class="fa-regular fa-pen-to-square text-[15px]"></i></button>`);
                    cardArr.push(`<button onclick="event.stopPropagation(); deleteRecord('${rowId}')" class="text-gray-400 hover:text-red-500 transition-colors" title="Delete"><i class="fa-regular fa-trash-can text-[15px]"></i></button>`);
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

                if (role !== 'Staff') {
                    cardArr.push('<div class="flex space-x-2 shrink-0 mt-0.5">');
                    cardArr.push(`<button onclick="editNewsFromId('${rowId}', event)" class="text-gray-400 hover:text-brandindigo transition-colors" title="Edit"><i class="fa-regular fa-pen-to-square text-[15px]"></i></button>`);
                    cardArr.push(`<button onclick="event.stopPropagation(); deleteRecord('${rowId}')" class="text-gray-400 hover:text-red-500 transition-colors" title="Delete"><i class="fa-regular fa-trash-can text-[15px]"></i></button>`);
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

                if (role !== 'Staff') {
                    cardArr.push('<div class="flex space-x-2 z-10 bg-white" onclick="event.stopPropagation()">');
                    cardArr.push(`<button onclick="openFormModal('${encodedRow}')" class="text-gray-400 hover:text-gray-800 transition-colors" title="Edit"><i class="fa-regular fa-pen-to-square text-[15px]"></i></button>`);
                    cardArr.push(`<button onclick="event.stopPropagation(); deleteRecord('${rowId}')" class="text-gray-400 hover:text-red-500 transition-colors" title="Delete"><i class="fa-regular fa-trash-can text-[15px]"></i></button>`);
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

                cardArr.push('<div class="flex justify-between items-start px-4 py-3 bg-white z-10 border-b border-gray-50 shrink-0 gap-2">');

                cardArr.push('<div class="flex flex-col min-w-0">');
                cardArr.push(`<span class="text-[10px] font-bold text-brandindigo uppercase tracking-widest mb-0.5" title="${escapeHtml(docType)}">${escapeHtml(docType)}</span>`);
                cardArr.push(`<h3 class="text-sm font-bold text-gray-800 line-clamp-2 leading-snug" title="${escapeHtml(topic)}">${escapeHtml(topic)}</h3>`);
                cardArr.push('</div>');

                if (role !== 'Staff') {
                    cardArr.push('<div class="flex space-x-2 shrink-0 mt-0.5">');
                    cardArr.push(`<button onclick="openFormModal('${encodedRow}')" class="text-gray-400 hover:text-brandindigo transition-colors" title="Edit"><i class="fa-regular fa-pen-to-square text-[15px]"></i></button>`);
                    cardArr.push(`<button onclick="event.stopPropagation(); deleteRecord('${rowId}')" class="text-gray-400 hover:text-red-500 transition-colors" title="Delete"><i class="fa-regular fa-trash-can text-[15px]"></i></button>`);
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

        cardWrapper.innerHTML = cardsHtml;
        return;

    } else {
        tableWrapper.classList.remove('hidden');
        cardWrapper.classList.add('hidden');

        let qrBtn = document.getElementById('qr-scan-btn');
        if (qrBtn) {
            qrBtn.style.display = 'none';
        }
    }

    if (!currentHeaders.length) {
        let noDataTxt = window.t ? window.t('no_data') : 'NO DATA FOUND';
        tBody.innerHTML = '<tr><td colspan="100%" class="text-center py-12 text-gray-400 font-bold tracking-widest uppercase">' + noDataTxt + '</td></tr>';
        return;
    }

    let trHead = '<tr>';
    currentHeaders.forEach(h => {
        const isPhotoColumn = /^(photo|photos|profile|pic|image)$/i.test(String(h).trim());
        let displayH = (currentSheet.toLowerCase() === 'user' && (h.toLowerCase().trim() === 'user name' || h.toLowerCase().trim() === 'username')) ? 'EMAIL' : h;
        let translatedH = window.t ? window.t(displayH) : displayH;
        trHead += `<th class="px-6 py-4 whitespace-nowrap font-bold tracking-widest text-gray-500 ${isPhotoColumn ? 'w-28 text-center' : ''}" data-i18n-th="${displayH}">${translatedH}</th>`;
    });
    if (role !== 'Staff') {
        let actionTxt = window.t ? window.t('Action') : 'Action';
        trHead += `<th class="px-6 py-4 whitespace-nowrap text-center sticky right-0 bg-gray-50 z-10 shadow-[-10px_0_15px_-5px_rgba(0,0,0,0.05)] border-l border-gray-200 print-hide text-gray-500 font-bold tracking-widest">${actionTxt}</th>`;
    }
    trHead += `</tr>`;
    tHead.innerHTML = trHead;

    let htmlRows = '';

    if (currentSheet === 'Fingerprint_Logs') {
        data.sort((a, b) => {
            let rA = a.Date; let rB = b.Date;
            if (!rA || !rB) return 0;
            let pA = String(rA).split('/'); let dA = new Date(pA[2], pA[1] - 1, pA[0]);
            let pB = String(rB).split('/'); let dB = new Date(pB[2], pB[1] - 1, pB[0]);
            return dB - dA;
        });
    }

    data.forEach(row => {
        const isEmpty = currentHeaders.every(h => !row[h] || String(row[h]).trim() === '');
        if (isEmpty) return;

        let tr = '<tr class="bg-white hover:bg-gray-50 transition-colors">';
        currentHeaders.forEach(h => {
            let val = row[h] || '';
            const lw = h.toLowerCase();

            if (lw === 'is evaluator' || lw === 'is_evaluator') {
                const isEval = String(val).toLowerCase() === 'true' || val === true || String(val).toLowerCase() === 'yes';
                let color = isEval ? 'bg-indigo-50 text-brandindigo border border-indigo-200' : 'bg-gray-50 text-gray-400 border border-gray-200';
                let displayText = isEval ? 'Yes' : 'No';
                val = `<span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold ${color}">${displayText}</span>`;
            }

            if (lw.includes('status') || lw === 'signature' || lw.includes('role')) {
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
                    color = 'bg-emerald-50 text-emerald-600 border border-emerald-200'; displayText = 'Approved (' + val + ')';
                }

                if ((currentSheet === 'Leave application' || currentSheet === 'Budget Request') && lw === 'signature') {
                    const rowId = getRecordId(row);
                    if (role !== 'Staff') {
                        val = `
                                <div class="flex items-center space-x-3">
                                    <span class="px-3 py-1 rounded-md text-[10px] font-bold uppercase tracking-widest ${color}">${displayText}</span>
                                    <select onchange="changeApprovalStatus('${rowId}', '${h}', this)" class="bg-white border border-gray-300 text-gray-800 text-xs font-bold rounded-lg focus:ring-brandindigo focus:border-brandindigo block py-1.5 px-2 cursor-pointer hover:bg-gray-50 outline-none transition-colors shadow-sm">
                                        <option value="" disabled selected>Change Status...</option>
                                        <option value="Pending">Pending</option>
                                        <option value="HR Manager">Approve (Manager)</option>
                                        <option value="HR Admin">Approve (Admin)</option>
                                        <option value="Rejected">Reject</option>
                                    </select>
                                </div>`;
                    } else {
                        val = `<span class="px-3 py-1 rounded-md text-[10px] font-bold uppercase tracking-widest ${color}">${displayText}</span>`;
                    }
                } else {
                    val = `<span class="px-3 py-1 rounded-md text-[10px] font-bold uppercase tracking-widest ${color}">${displayText}</span>`;
                }
            }
            if (lw === 'items') {
                const encodedRow = encodeURIComponent(JSON.stringify(row)).replace(/'/g, "%27");
                let count = 0;
                try {
                    let decoded = val;
                    if (String(decoded).includes('%')) {
                        decoded = decodeURIComponent(decoded);
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
            const isImageData = /^data:image\/[a-z0-9.+-]+;base64,/i.test(valStr);
            const isPdfData = /^data:application\/pdf(?:;base64)?,/i.test(valStr);
            const isPdfUrl = /\.pdf(?:[?#]|$)/i.test(valStr);
            if (isPhotoColumn && (isPdfData || isPdfUrl)) {
                val = `<button type="button" data-src="${valStr}" onclick="showAttachmentPreview(this.dataset.src, 'Leave request attachment')" class="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 text-xs font-bold transition-colors shadow-sm" title="Open PDF">
                            <i class="fa-solid fa-file-pdf text-lg"></i><span>View PDF</span>
                        </button>`;
            } else if (isPhotoColumn && (isImageData || valStr.match(/^https?:\/\//i))) {
                val = `<button type="button" onclick="showAttachmentPreview(this.querySelector('img').src, 'Attachment image')" class="block mx-auto rounded-xl overflow-hidden border border-gray-200 shadow-sm hover:shadow-lg hover:scale-105 transition-all cursor-zoom-in" title="Click to enlarge">
                            <img src="${valStr}" alt="Profile photo" class="w-14 h-14 object-cover bg-gray-50" onerror="this.closest('button').innerHTML='<span class=&quot;text-xs text-red-500 px-2&quot;>Image unavailable</span>'">
                        </button>`;
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

        if (role !== 'Staff') {
            tr += `<td class="px-6 py-5 whitespace-nowrap text-center sticky right-0 bg-white group-hover:bg-gray-50 shadow-[-10px_0_15px_-5px_rgba(0,0,0,0.05)] border-l border-gray-200 print-hide transition-colors">
                        <div class="flex justify-center space-x-2">
                            <button onclick="openFormModal('${encodedRow}')" class="text-gray-400 hover:text-brandindigo hover:bg-indigo-50 p-2 rounded-xl transition-colors border border-transparent hover:border-indigo-100" title="Edit"><i class="fa-solid fa-pen-to-square"></i></button>
                            <button onclick="deleteRecord('${rowId}')" class="text-gray-400 hover:text-red-500 hover:bg-red-50 p-2 rounded-xl transition-colors border border-transparent hover:border-red-100" title="Delete"><i class="fa-solid fa-trash"></i></button>
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
    if (sessionStr) {
        try {
            const sessionData = JSON.parse(sessionStr);
            role = sessionData.role || 'Staff';
            loggedInEmpId = String(sessionData.empId || sessionData.employeeId || sessionData.username || '').trim().toUpperCase();
        } catch (e) { }
    }

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
        const stars = Math.max(0, Math.min(5, parseFloat(getFuzzyValue(row, ['star point', 'star_point', 'rating', 'score'])) || 0));

        if (!ratingByEmp[key]) ratingByEmp[key] = { total: 0, count: 0, latestComment: '', latestRowId: '', categoryScores: {} };
        ratingByEmp[key].total += stars;
        ratingByEmp[key].count += 1;

        const category = getFuzzyValue(row, ['Category ', 'category']);
        if (category && category !== '-') ratingByEmp[key].categoryScores[String(category).trim()] = stars;

        const comment = getFuzzyValue(row, ['comment', 'review', 'remark']);
        if (comment && comment !== '-') ratingByEmp[key].latestComment = comment;

        ratingByEmp[key].latestRowId = getRecordId(row);
    });

    const visibleStaff = staffRows.filter(row => {
        const empId = String(getFuzzyValue(row, ['employee_id', 'emp_id', 'employees id']) || '').trim().toUpperCase();
        if (!empId || empId === '-') return false;
        if (role === 'Staff') {
            return empId === loggedInEmpId;
        }
        return true;
    });

    if (!visibleStaff.length) {
        cardWrapper.innerHTML = '<div class="col-span-full flex flex-col items-center justify-center py-20 text-gray-400 bg-gray-50 rounded-3xl border border-dashed border-gray-200"><i class="fa-regular fa-folder-open text-6xl mb-4 text-gray-300"></i><p class="font-bold tracking-widest uppercase text-sm">No staff found</p></div>';
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
        const avg = stat.count ? Math.round((stat.total / stat.count) * 10) / 10 : 0;

        let starsHtml = '';
        for (let i = 1; i <= 5; i++) {
            starsHtml += i <= Math.round(avg) ? '<i class="fa-solid fa-star text-[#FACC15] text-2xl mx-1"></i>' : '<i class="fa-regular fa-star text-gray-200 text-2xl mx-1"></i>';
        }

        const safeEmp = escapeHtml(empId);
        const safeName = escapeHtml(firstName);
        const safePosition = escapeHtml(position);
        const safeDept = escapeHtml(department);
        const safeComment = escapeHtml(stat.latestComment || (t('no_comment') || 'No comments yet'));
        const safeNameUrl = encodeURIComponent(firstName);
        const safeNameJs = String(firstName).replace(/\\/g, '\\\\').replace(/'/g, "\\'");

        const safeRowId = String(stat.latestRowId || '').replace(/\\/g, '\\\\').replace(/'/g, "\\'");

        const barsHtml = getRatingCategories().map(cat => {
            const val = Math.max(0, Math.min(5, parseFloat(stat.categoryScores[cat]) || 0));
            const pct = Math.round((val / 5) * 100);
            return `<div class="flex items-center justify-between text-xs mb-3"><span class="w-[45%] ${pct ? 'text-gray-700 font-bold' : 'text-gray-400 font-medium'} truncate">${escapeHtml(cat)}</span><div class="w-[45%] h-1.5 bg-gray-100 flex-1 mx-3 overflow-hidden rounded-full shadow-inner"><div class="h-full ${pct ? 'bg-gradient-to-r from-brandindigo to-brandpurple' : 'bg-gray-200'} rounded-full" style="width:${pct}%"></div></div><span class="w-[10%] text-right text-gray-500 font-bold text-[10px]">${pct}%</span></div>`;
        }).join('');

        html += `
                    <div class="bg-white rounded-3xl hover:shadow-xl transition-all duration-300 overflow-hidden flex flex-col group relative border border-gray-200 w-full max-w-[360px] mx-auto pb-5">
                        
                        <div class="absolute top-3 right-3 flex gap-0.5 z-20 bg-white/95 backdrop-blur-md rounded-lg shadow-lg p-1 border border-gray-100 opacity-0 group-hover:opacity-100 transition-all duration-300">
                            <button onclick="showRatingHistory('${safeEmp}', '${safeNameJs}')" class="text-gray-500 hover:bg-blue-50 hover:text-blue-600 w-7 h-7 rounded-md flex items-center justify-center transition-colors" title="ประวัติการให้ดาว"><i class="fa-solid fa-clock-rotate-left text-[13px]"></i></button>
                            <button onclick="showEmpQRCode('${safeEmp}', '${safeNameUrl}')" class="text-gray-500 hover:bg-indigo-50 hover:text-brandindigo w-7 h-7 rounded-md flex items-center justify-center transition-colors" title="QR Code"><i class="fa-solid fa-qrcode text-[13px]"></i></button>
                            
                            ${role !== 'Staff' ? `<button onclick="addRatingForEmpId('${safeEmp}', '${safeNameJs}', event)" class="text-gray-500 hover:bg-emerald-50 hover:text-emerald-600 w-7 h-7 rounded-md flex items-center justify-center transition-colors" title="ให้ดาว"><i class="fa-solid fa-star text-[13px]"></i></button>` : ''}
                            
                            ${stat.latestRowId && role !== 'Staff' ? `<button onclick="editRatingByRowId('${safeRowId}', event)" class="text-gray-500 hover:bg-indigo-50 hover:text-brandindigo w-7 h-7 rounded-md flex items-center justify-center transition-colors" title="แก้ไขคะแนนล่าสุด"><i class="fa-solid fa-pen-to-square text-[13px]"></i></button>` : ''}
                            
                            ${stat.latestRowId && role !== 'Staff' ? `<button onclick="event.stopPropagation(); deleteRecord('${safeRowId}')" class="text-gray-500 hover:bg-red-50 hover:text-red-600 w-7 h-7 rounded-md flex items-center justify-center transition-colors" title="ลบ"><i class="fa-solid fa-trash text-[13px]"></i></button>` : ''}
                        </div>

                        <div class="h-[100px] w-full bg-gradient-to-r from-brandindigo to-brandpurple"></div>
                        <div class="relative -mt-[50px] flex justify-center z-10">
                            <div class="w-[100px] h-[100px] rounded-full border-4 border-white overflow-hidden bg-gray-50 shadow-md">
                                <img src="${photo}" onerror="this.src='https://ui-avatars.com/api/?background=e0e7ff&color=4f46e5&bold=true&name=${encodeURIComponent(firstName)}'" class="w-full h-full object-cover" alt="Profile">
                            </div>
                        </div>
                        <div class="text-center px-6 mt-3">
                            <h2 class="text-xl font-bold text-gray-900 mb-1.5 tracking-tight">${safeName}</h2>
                            <div class="flex items-center justify-center gap-2 flex-wrap">
                                <span class="text-[10px] font-bold text-brandindigo bg-indigo-50 px-2 py-0.5 rounded border border-indigo-100 uppercase tracking-widest">${safePosition}</span>
                                <span class="text-[11px] text-gray-400 font-medium">ID: ${safeEmp}</span>
                            </div>
                            <p class="text-[11px] text-gray-400 mt-1 font-bold">${safeDept}</p>
                        </div>

                        <div class="flex justify-center items-center mt-5 mb-5 bg-gray-50/50 py-2.5 mx-6 rounded-xl border border-gray-100" title="Overall Average Rating">
                            ${starsHtml}
                        </div>

                        <div class="px-7 flex-1 flex flex-col justify-center">
                            ${barsHtml}
                        </div>

                        ${stat.latestComment !== '-' ? `
                        <div class="px-6 mt-4">
                            <div class="text-xs text-gray-500 italic text-center bg-gray-50 p-3 rounded-xl border border-gray-100" title="${safeComment}">
                                <i class="fa-solid fa-quote-left text-gray-300 mr-1.5"></i>${stat.latestComment}<i class="fa-solid fa-quote-right text-gray-300 ml-1.5"></i>
                            </div>
                        </div>` : '<div class="mt-4"></div>'}

                    </div>`;
    });
    cardWrapper.innerHTML = html;
}
