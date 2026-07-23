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

    if (data && data.length > 0) {
        if (currentSheet === 'Fingerprint_Logs') {
            data.sort((a, b) => {
                let rA = a.Date; let rB = b.Date;
                if (!rA || !rB) return 0;
                let pA = String(rA).split('/'); let dA = new Date(pA[2], pA[1] - 1, pA[0]);
                let pB = String(rB).split('/'); let dB = new Date(pB[2], pB[1] - 1, pB[0]);
                return dB - dA;
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
    let tYear = new Date().getFullYear();
    let tMonth = new Date().getMonth() + 1;
    if (calMonthInput && calMonthInput.value.trim()) {
        const mp = calMonthInput.value.trim().split('-');
        if (mp.length === 2) {
            tYear = parseInt(mp[0], 10);
            tMonth = parseInt(mp[1], 10);
        }
    }

    if (currentSheet === 'Fingerprint_Logs' || currentSheet === 'Attendance_Logs') {
        let sDate = `${tYear}-${String(tMonth).padStart(2, '0')}-01`;
        let eDateObj = new Date(tYear, tMonth, 0);
        let eDate = `${tYear}-${String(tMonth).padStart(2, '0')}-${String(eDateObj.getDate()).padStart(2, '0')}`;

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
            // ALL EMPLOYEES: Run fillMissingDays for every employee to ensure complete datasets
            let empIdSet = new Set();
            dataToExport.forEach(r => {
                const rEmp = String(r.Employee_ID || r.employee_id || r.Emp_ID || '').trim().toUpperCase();
                if (rEmp) empIdSet.add(rEmp);
            });

            if (tableCache['staff'] && Array.isArray(tableCache['staff'].data)) {
                tableCache['staff'].data.forEach(s => {
                    const sEmp = String(s.employee_id || s.emp_id || s.Employee_ID || '').trim().toUpperCase();
                    if (sEmp) empIdSet.add(sEmp);
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

    data.forEach(row => {
        let late = parseFloat(getFuzzyValue(row, ['Late_Hours', 'late_hours', 'late_hrs']) || 0) || 0;
        let early = parseFloat(getFuzzyValue(row, ['Early_Leave_Hours', 'early_leave_hours', 'early_hrs']) || 0) || 0;
        let ot = parseFloat(getFuzzyValue(row, ['OT_Amount', 'ot_amount', 'ot']) || 0) || 0;

        let status = String(getFuzzyValue(row, ['Attendance_Status', 'attendance_status', 'Status', 'status']) || '').toLowerCase();

        let checkIn = getFuzzyValue(row, ['Check_In', 'check_in', 'in']);
        let checkOut = getFuzzyValue(row, ['Check_Out', 'check_out', 'out']);
        let shiftStart = getFuzzyValue(row, ['Shift_Start', 'shift_start', 'start']);
        let shiftEnd = getFuzzyValue(row, ['Shift_End', 'shift_end', 'end']);
        let rawDateStr = getFuzzyValue(row, ['Date', 'date', 'วันที่']);

        let rowDate = (typeof parseDateStr === 'function') ? parseDateStr(rawDateStr) : null;
        let isPastOrToday = rowDate ? (rowDate <= today) : true;

        if (late === 0 && checkIn && checkIn !== '-' && shiftStart && shiftStart !== '-') {
            let inMins = parseInt(String(checkIn).split(':')[0] || 0) * 60 + parseInt(String(checkIn).split(':')[1] || 0);
            let startMins = parseInt(String(shiftStart).split(':')[0] || 0) * 60 + parseInt(String(shiftStart).split(':')[1] || 0);
            if (inMins > startMins) late = (inMins - startMins) / 60;
        }

        if (early === 0 && checkOut && checkOut !== '-' && shiftEnd && shiftEnd !== '-') {
            let outMins = parseInt(String(checkOut).split(':')[0] || 0) * 60 + parseInt(String(checkOut).split(':')[1] || 0);
            let endMins = parseInt(String(shiftEnd).split(':')[0] || 0) * 60 + parseInt(String(shiftEnd).split(':')[1] || 0);
            if (outMins < endMins && outMins > 0) early = (endMins - outMins) / 60;
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
    }

    scopeText.innerText = empFilterStr;

    let monthFilterStr = 'ทั้งหมด (All Period)';
    const calMonthInput = document.getElementById('calendarMonth');
    if (calMonthInput && calMonthInput.value.trim()) {
        monthFilterStr = calMonthInput.value.trim();
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

    let globalScopeStr = empKeys.length === 1 ? `พนักงาน: ${empKeys[0]}` : `พนักงานทั้งหมด (${empKeys.length} คน)`;

    return `
    <div style="padding: 16px 20px; font-family: 'Prompt', 'Inter', sans-serif; color: #1e293b; background: #ffffff;">
        <div style="display: flex; justify-content: space-between; align-items: flex-end; border-bottom: 3px solid #4f46e5; padding-bottom: 10px; margin-bottom: 14px;">
            <div>
                <h1 style="font-size: 18px; font-weight: 800; color: #3730a3; margin: 0; letter-spacing: -0.5px;">LOVE STK GROUPE</h1>
                <p style="font-size: 11px; font-weight: 600; color: #64748b; margin: 2px 0 0 0;">รายงานสรุปประวัติการลงเวลาทำงานรายบุคคล (Individual Attendance & Performance Report)</p>
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

    const headers = currentHeaders || (exportData.length > 0 ? Object.keys(exportData[0]) : []);
    const cleanHeaders = headers.filter(h => {
        const lw = String(h).toLowerCase().trim();
        return lw !== 'signature' && lw !== 'photos' && lw !== 'photo' && lw !== 'profile' && !lw.startsWith('__') && lw !== 'action' && lw !== 'จัดกา' && lw !== 'จัดการ';
    });

    const dateStr = new Date().toISOString().slice(0, 10);
    const filename = `${sheetName}_Report_${dateStr}.xlsx`;

    if (typeof XLSX !== 'undefined') {
        try {
            const worksheet = XLSX.utils.json_to_sheet([], { header: cleanHeaders });

            if (isAttendance) {
                let aoaData = [
                    [`LOVE STK GROUPE - รายงานสรุปประวัติการลงเวลาทำงานรายบุคคล`],
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
