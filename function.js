// ─────────────────────────────────────────────────────────────────────────────
// BLOCK 6: Main Script (📌 Script หลัก)
// ─────────────────────────────────────────────────────────────────────────────
// ─────────────────────────────────────────
// URL CLEANER — ลบ .html ออกจากช่องที่อยู่เบราว์เซอร์อัตโนมัติ
// ─────────────────────────────────────────
if (window.location.protocol !== 'file:' && window.location.pathname.endsWith('.html')) {
    const cleanPath = window.location.pathname.replace(/\.html$/, '');
    window.history.replaceState(null, '', cleanPath + window.location.search + window.location.hash);
}

// ฟังก์ชันช่วยเติมวันที่ขาดหาย สำหรับสร้างตารางประวัติให้สมบูรณ์
/* =====================================================================
 * 📌 ส่วนที่ 1: DATA FORMATTING & CALENDAR HELPER (ฟังก์ชันจัดการข้อมูลและปฏิทิน)
 * - ใช้สำหรับเติมวันที่ขาดหายและจัดรูปแบบวันที่
 * ===================================================================== */
function fillMissingDays(rawData, startDateStr, endDateStr, targetEmpId) {
    if (!startDateStr || !endDateStr || !targetEmpId) return rawData;
    let start = new Date(startDateStr);
    let end = new Date(endDateStr);
    let completeList = [];
    let today = new Date();
    today.setHours(0, 0, 0, 0);

    // ดึงข้อมูลการลาของพนักงานคนนี้
    let leaveData = tableCache['Leave application'] ? tableCache['Leave application'].data : [];
    let empLeaves = leaveData.filter(r => {
        let eId = String(getFuzzyValue(r, ['employee_id', 'emp_id'])).toUpperCase().trim();
        let status = String(getFuzzyValue(r, ['signature', 'status'])).toLowerCase();
        return eId === targetEmpId.toUpperCase().trim() && (status.includes('approve') || status.includes('hr'));
    });

    let empName = targetEmpId;
    let foundLog = rawData.find(r => (String(r.Employee_ID || r.Emp_ID).trim() === targetEmpId) && r.Full_Name);
    if (foundLog) empName = foundLog.Full_Name;
    else if (tableCache['staff'] && tableCache['staff'].data) {
        let sMatch = tableCache['staff'].data.find(s => String(s.employee_id || s.emp_id).trim() === targetEmpId);
        if (sMatch) empName = sMatch.name || sMatch.full_name || sMatch['ชื่อ-นามสกุล'] || targetEmpId;
    }

    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
        let day = String(d.getDate()).padStart(2, '0');
        let month = String(d.getMonth() + 1).padStart(2, '0');
        let year = d.getFullYear();
        let dateStr = `${day}/${month}/${year}`;
        let dbDateStr = `${year}-${month}-${day}`; // 📌 รองรับรูปแบบวันที่จาก Database (YYYY-MM-DD)

        let recordExists = rawData.find(r =>
            (r.Date === dateStr || r.Date === dbDateStr) &&
            String(r.Employee_ID || r.Emp_ID).trim() === targetEmpId
        );

        // 📌 ปรับ Format กลับให้แสดงผลในตารางสวยงามเป็น DD/MM/YYYY
        if (recordExists && recordExists.Date === dbDateStr) {
            recordExists.Date = dateStr;
        }
        if (recordExists) {
            completeList.push(recordExists);
        } else {
            let dayOfWeek = d.getDay();
            let isWeekend = (dayOfWeek === 0); // 📌 เปลี่ยนให้มีแค่วันอาทิตย์ (0) ที่เป็นวันหยุด
            let isPastOrToday = (d <= today);

            let statusLabel = isWeekend ? "วันหยุด" : (isPastOrToday ? "ABSENT" : "ยังไม่ถึง");

            // 📌 ตรวจสอบว่าตรงกับวันที่ลางานหรือไม่
            let isOnLeave = false;
            for (let lv of empLeaves) {
                let lStartStr = getFuzzyValue(lv, ['start_date', 'เริ่ม']);
                let lEndStr = getFuzzyValue(lv, ['end_date', 'สิ้นสุด']);
                let lStart = parseDateStr(lStartStr);
                let lEnd = parseDateStr(lEndStr);

                if (lStart && lEnd && d >= lStart && d <= lEnd) {
                    isOnLeave = true;
                    break;
                }
            }

            if (isOnLeave) statusLabel = "ON LEAVE";

            completeList.push({
                Log_ID: '-', Employee_ID: targetEmpId, Full_Name: empName, Date: dateStr, Shift_Start: '-', Shift_End: '-',
                Check_In: '-', Check_Out: '-', Attendance_Status: statusLabel, Late_Hours: '-', Early_Leave_Hours: '-', OT_Amount: '-'
            });
        }
    }
    return completeList;
}

// Helper function for parsing dates
function parseDateStr(dateStr) {
    if (!dateStr || dateStr === '-') return null;
    let d = new Date(dateStr);
    if (isNaN(d.getTime())) {
        let parts = String(dateStr).split(/[\/\-]/);
        if (parts.length === 3) {
            if (parts[2].length === 4) d = new Date(`${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`);
            else if (parts[0].length === 4) d = new Date(`${parts[0]}-${parts[1].padStart(2, '0')}-${parts[2].padStart(2, '0')}`);
        }
    }
    if (!isNaN(d.getTime())) {
        d.setHours(12, 0, 0, 0);
        return d;
    }
    return null;
}

// ฟังก์ชันวาดปฏิทิน
/* =====================================================================
 * 📌 ส่วนที่ 2: ATTENDANCE CALENDAR RENDERER (ฟังก์ชันแสดงปฏิทินการเข้างาน)
 * - ใช้แสดงปฏิทินและประวัติการเข้างานแบบรายเดือน
 * ===================================================================== */
function renderAttendanceCalendar(year, month, logs, targetEmpId) {
    const calDiv = document.getElementById('attendance-calendar-grid');
    if (!calDiv) return 0;
    calDiv.innerHTML = '';

    let absentCount = 0;
    const daysInMonth = new Date(year, month, 0).getDate();
    const firstDayOfWeek = new Date(year, month - 1, 1).getDay();
    let today = new Date();
    today.setHours(0, 0, 0, 0);

    // ดึงข้อมูลการลาของพนักงานคนนี้
    let leaveData = tableCache['Leave application'] ? tableCache['Leave application'].data : [];
    let empLeaves = leaveData.filter(r => {
        let eId = String(getFuzzyValue(r, ['employee_id', 'emp_id'])).toUpperCase().trim();
        let status = String(getFuzzyValue(r, ['signature', 'status'])).toLowerCase();
        return eId === targetEmpId.toUpperCase().trim() && (status.includes('approve') || status.includes('hr'));
    });

    for (let i = 0; i < firstDayOfWeek; i++) {
        calDiv.innerHTML += `<div class="p-2"></div>`;
    }

    for (let day = 1; day <= daysInMonth; day++) {


        // 👇 เพิ่มตัวแปรที่ขาดหายไปตรงนี้ 👇
        let currentDate = new Date(year, month - 1, day);
        let dateStr = `${String(day).padStart(2, '0')}/${String(month).padStart(2, '0')}/${year}`;
        let dbDateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

        let isWeekend = currentDate.getDay() === 0; // วันหยุด (อาทิตย์)
        let isPastOrToday = currentDate <= today;

        let logFound = logs.find(r => r.Date === dateStr || r.Date === dbDateStr);
        // 👆 สิ้นสุดส่วนที่เพิ่ม 👆



        // 📌 ตรวจสอบว่าตรงกับวันที่ลางานหรือไม่
        let isOnLeave = false;
        for (let lv of empLeaves) {
            let lStartStr = getFuzzyValue(lv, ['start_date', 'เริ่ม']);
            let lEndStr = getFuzzyValue(lv, ['end_date', 'สิ้นสุด']);
            let lStart = parseDateStr(lStartStr);
            let lEnd = parseDateStr(lEndStr);

            if (lStart && lEnd && currentDate >= lStart && currentDate <= lEnd) {
                isOnLeave = true;
                break;
            }
        }

        let boxClass = "h-10 sm:h-12 rounded-xl flex items-center justify-center text-xs font-bold relative transition-all border ";
        let innerHtml = `<span>${day}</span>`;

        if (logFound) {
            boxClass += "bg-emerald-50 border-emerald-200 text-emerald-600";
            innerHtml += `<span class="absolute bottom-1.5 w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-sm"></span>`;
        } else if (isOnLeave) {
            // 📌 วงกลมสีเหลืองสำหรับวันลา
            boxClass += "bg-yellow-50 border-yellow-200 text-yellow-600";
            innerHtml = `<div class="w-7 h-7 flex items-center justify-center rounded-full bg-yellow-400 text-white shadow-md">${day}</div>`;
        } else if (isWeekend) {
            boxClass += "bg-gray-100 border-gray-200 text-gray-400";
        } else if (isPastOrToday) {
            // 📌 วันจันทร์-เสาร์ ที่ผ่านไปแล้วแต่ไม่มาทำงาน/ไม่ได้ลา = ขาดงาน (แดง)
            boxClass += "bg-red-50 border-red-200 text-red-500";
            innerHtml = `<div class="w-7 h-7 flex items-center justify-center rounded-full bg-red-500 text-white shadow-md">${day}</div>`;
            absentCount++;
        } else {
            boxClass += "bg-white border-dashed border-gray-200 text-gray-400";
        }

        calDiv.innerHTML += `<div class="${boxClass}">${innerHtml}</div>`;
    }
    return absentCount;
}

const BRANCHES = [
    { id: 'B1', name: 'HQ Branch (Main)', lat: 17.9604167, lng: 102.6424722, radius: 20 },
    { id: 'B2', name: 'Branch 2', lat: 17.96075, lng: 102.6438056, radius: 90 }
];

function calculateDistance(lat1, lon1, lat2, lon2) {
    var R = 6371e3;
    var dLat = (lat2 - lat1) * Math.PI / 180;
    var dLon = (lon2 - lon1) * Math.PI / 180;
    var a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
    var c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
}

let currentSheet = '';
let currentHeaders = [];
let rawData = [];
let tableCache = {};
let dashboardCache = null;
let lastDashStartDate = null;
let lastDashEndDate = null;
let editingRecordId = null;

let map = null;
let userMarker = null;

// 📌 ฟังก์ชันควบคุม Custom Confirm Modal
let confirmOkCallback = null;
let confirmCancelCallback = null;

/* =====================================================================
 * 📌 ส่วนที่ 3: MODALS & ALERTS (ฟังก์ชันหน้าต่างแจ้งเตือนและยืนยัน)
 * - ใช้แสดง Popup แจ้งเตือนความสำเร็จ หรือยืนยันการทำรายการ
 * ===================================================================== */
function showConfirmModal(title, message, onOk, onCancel = null, isDanger = true) {
    const modal = document.getElementById('confirm-modal');
    const modalBox = modal.querySelector('div.bg-white');

    document.getElementById('confirm-title').innerText = title;
    document.getElementById('confirm-message').innerHTML = message;

    const iconBg = document.getElementById('confirm-icon-bg');
    const icon = document.getElementById('confirm-icon');
    const btnOk = document.getElementById('btn-confirm-ok');

    if (isDanger) {
        iconBg.className = "w-20 h-20 rounded-full bg-red-50 border border-red-100 text-red-500 flex items-center justify-center mx-auto mb-6 transition-colors shadow-md";
        icon.className = "fa-solid fa-trash-can text-4xl";
        btnOk.className = "px-5 py-3 bg-red-600 hover:bg-red-500 text-white rounded-xl text-sm font-bold transition-colors shadow-lg shadow-red-600/20 w-1/2";
    } else {
        iconBg.className = "w-20 h-20 rounded-full bg-indigo-50 border border-indigo-100 text-brandindigo flex items-center justify-center mx-auto mb-6 transition-colors shadow-md";
        icon.className = "fa-solid fa-circle-question text-4xl";
        btnOk.className = "px-5 py-3 bg-gradient-to-r from-brandindigo to-brandpurple hover:brightness-110 text-white rounded-xl text-sm font-bold transition-colors shadow-lg shadow-indigo-500/20 w-1/2";
    }

    confirmOkCallback = onOk;
    confirmCancelCallback = onCancel;

    modal.classList.remove('hidden');
    void modal.offsetWidth;
    modal.classList.remove('opacity-0');
    modalBox.classList.remove('scale-95');
    modalBox.classList.add('scale-100');
}

function hideConfirmModal() {
    const modal = document.getElementById('confirm-modal');
    const modalBox = modal.querySelector('div.bg-white');

    modal.classList.add('opacity-0');
    modalBox.classList.remove('scale-100');
    modalBox.classList.add('scale-95');

    setTimeout(() => {
        modal.classList.add('hidden');
    }, 300);
}

function showSuccessModal(title, message) {
    const modal = document.getElementById('success-modal');
    const modalBox = modal.querySelector('div.bg-white');

    document.getElementById('success-title').innerText = title;
    document.getElementById('success-message').innerHTML = message;

    modal.classList.remove('hidden');
    void modal.offsetWidth;
    modal.classList.remove('opacity-0');
    modalBox.classList.remove('scale-95');
    modalBox.classList.add('scale-100');
}

function hideSuccessModal() {
    const modal = document.getElementById('success-modal');
    const modalBox = modal.querySelector('div.bg-white');

    modal.classList.add('opacity-0');
    modalBox.classList.remove('scale-100');
    modalBox.classList.add('scale-95');

    setTimeout(() => {
        modal.classList.add('hidden');
    }, 300);
}

function getRecordId(row) {
    if (!row) return null;
    // Prefer the immutable database UUID. Business IDs can be blank or
    // changed by the user, especially in older imported Department rows.
    if (row.__db_id) return row.__db_id;
    const sName = String(currentSheet).toLowerCase().trim();
    let targetKeys = ['id'];
    if (sName.includes('leave')) targetKeys = ['id_leave', 'leave_id', 'id'];
    else if (sName.includes('log') || sName.includes('attendance')) targetKeys = ['log_id', 'id'];
    else if (sName.includes('asset')) targetKeys = ['asset_id', 'id'];
    else if (sName.includes('training')) targetKeys = ['course_id', 'id'];
    else if (sName.includes('department')) targetKeys = ['department_id', 'id'];
    else if (sName.includes('organization')) targetKeys = ['organization id', 'organization_id', 'id'];
    else if (sName === 'staff' || sName === 'user') targetKeys = ['employee_id', 'emp_id', 'id'];
    // 👇 เพิ่มเงื่อนไขให้รู้จัก Ranting_ID
    else if (sName.includes('ranting') || sName.includes('rating')) targetKeys = ['ranting_id', 'rating_id', 'id'];
    else if (sName.includes('budget')) targetKeys = ['id_budget', 'budget_id', 'id'];
    else targetKeys = ['id_leave', 'leave_id', 'log_id', 'asset_id', 'course_id', 'department_id', 'employee_id', 'emp_id', 'ranting_id', 'rating_id', 'id_budget', 'budget_id', 'id'];

    for (let key of targetKeys) {
        let foundKey = Object.keys(row).find(k => String(k).toLowerCase().trim() === key);
        if (foundKey) return row[foundKey];
    }
    return Object.values(row)[0];
}

function isEmployeeRatingSheet(sheetName = currentSheet) {
    const s = String(sheetName || '').toLowerCase();
    return s.includes('ranting') || s.includes('rating') || s.includes('employees_rating');
}

function getEmployeeRatingHeaders() {
    return ['Ranting_Id', 'Employees Id', 'Employees Name', 'Ranting Date', 'Star Point', 'Category ', 'Comment', 'Give By', 'Status'];
}

function ensureHeadersForSheet(sheetName, headers) {
    const cleaned = (headers || []).map(h => String(h)).filter(h => h.trim() !== '');
    if (isEmployeeRatingSheet(sheetName) && cleaned.length === 0) return getEmployeeRatingHeaders();
    return cleaned;
}

/* =====================================================================
 * 📌 ส่วนที่ 4: EMPLOYEE AUTO-FILL (ฟังก์ชันดึงข้อมูลพนักงานอัตโนมัติ)
 * - ใช้ดึงข้อมูลพนักงานมาเติมในฟอร์มเมื่อมีการเลือกพนักงาน
 * ===================================================================== */
function autoFillEmployeeData(empId) {
    if (!empId) return;
    const staffCache = tableCache['staff'] || tableCache['Staff'];
    const sheetData = staffCache ? staffCache.data : [];
    if (!sheetData || sheetData.length === 0) return;

    const empRow = findStaffRowById(empId, sheetData);

    if (empRow) {
        const form = document.getElementById('dynamic-form');
        if (!form) return;

        let quotaVal = getFuzzyValue(empRow, ['leave_quota', 'quota', 'โควต้า', 'วันลาพักร้อน']);
        const quotaDisplay = document.getElementById('leave-quota-display');
        if (quotaDisplay) {
            if (quotaVal && quotaVal !== '-' && !isNaN(quotaVal)) {
                quotaDisplay.innerHTML = `<span class="font-bold text-gray-900">${quotaVal} Days</span>`;
            } else {
                quotaDisplay.innerHTML = `<span class="text-gray-500">N/A</span>`;
            }
        }

        const inputs = form.querySelectorAll('input, select');
        inputs.forEach(input => {
            const nameLower = input.name.toLowerCase().trim();
            if (nameLower === 'first_name' || nameLower === 'ชื่อ' || nameLower === 'full_name' || nameLower === 'name' || nameLower === 'employees name') {
                input.value = getFuzzyValue(empRow, ['first_name', 'name', 'full_name', 'ชื่อ']);
                input.readOnly = true; input.classList.add('bg-gray-50', 'text-gray-500', 'border-gray-200'); input.classList.remove('bg-white', 'text-gray-900');
            }
            else if (nameLower === 'last_name' || nameLower === 'นามสกุล') {
                input.value = getFuzzyValue(empRow, ['last_name', 'นามสกุล']);
                input.readOnly = true; input.classList.add('bg-gray-50', 'text-gray-500', 'border-gray-200'); input.classList.remove('bg-white', 'text-gray-900');
            }
            else if (nameLower === 'department_id' || nameLower === 'แผนก' || nameLower === 'department') {
                let dVal = getFuzzyValue(empRow, ['department_id', 'department', 'แผนก']);
                input.value = dVal; input.readOnly = true; input.classList.add('bg-gray-50', 'text-gray-500', 'border-gray-200'); input.classList.remove('bg-white', 'text-gray-900');
            }
            else if (nameLower === 'prefix' || nameLower === 'คำนำหน้า') {
                input.value = getFuzzyValue(empRow, ['prefix', 'คำนำหน้า']);
                input.readOnly = true; input.classList.add('bg-gray-50', 'text-gray-500', 'border-gray-200'); input.classList.remove('bg-white', 'text-gray-900');
            }
            else if (nameLower === 'position_id' || nameLower === 'position' || nameLower === 'ตำแหน่ง') {
                input.value = getFuzzyValue(empRow, ['position_id', 'position', 'ตำแหน่ง']);
                input.readOnly = true; input.classList.add('bg-gray-50', 'text-gray-500', 'border-gray-200'); input.classList.remove('bg-white', 'text-gray-900');
            }
            else if (nameLower === 'contact' || nameLower === 'phone' || nameLower === 'เบอร์โทร' || nameLower === 'ติดต่อ') {
                input.value = getFuzzyValue(empRow, ['contact', 'phone', 'เบอร์โทร', 'ติดต่อ']);
                input.readOnly = true; input.classList.add('bg-gray-50', 'text-gray-500', 'border-gray-200'); input.classList.remove('bg-white', 'text-gray-900');
            }
        });
        updateRatingEmployeePreview(empRow, empId);
    }
}

function findStaffRowById(empId, staffRows) {
    if (!empId) return null;
    const target = String(empId).toLowerCase().trim();
    const rows = staffRows || (tableCache['staff'] && tableCache['staff'].data) || (tableCache['Staff'] && tableCache['Staff'].data) || [];
    return rows.find(r => {
        return Object.keys(r).some(k => {
            const key = String(k).toLowerCase().trim();
            return (key === 'employee_id' || key === 'emp_id' || key === 'employees id' || key === 'staff_id' || key === 'staff id')
                && String(r[k]).toLowerCase().trim() === target;
        });
    }) || null;
}

function updateRatingEmployeePreview(empRow, empId) {
    const preview = document.getElementById('rating-employee-preview');
    if (!preview || !empRow) return;
    const nameVal = getFuzzyValue(empRow, ['full_name', 'name', 'first_name', 'Employees Name', 'employee_name']);
    const lastNameVal = getFuzzyValue(empRow, ['last_name']);
    const fullName = [nameVal, lastNameVal].filter(v => v && v !== '-').join(' ') || '-';
    const positionVal = getFuzzyValue(empRow, ['position_id', 'position']);
    const deptVal = getFuzzyValue(empRow, ['department_id', 'department']);
    const photoVal = getFuzzyValue(empRow, ['photos', 'photo', 'profile', 'image', 'pic']);
    const avatarSrc = photoVal && photoVal !== '-'
        ? photoVal
        : `https://ui-avatars.com/api/?background=e0e7ff&color=4f46e5&name=${encodeURIComponent(fullName || empId || 'Staff')}`;
    preview.classList.remove('hidden');
    preview.innerHTML = `
                <div class="flex items-center gap-4">
                    <img src="${avatarSrc}" onerror="this.src='https://ui-avatars.com/api/?background=e0e7ff&color=4f46e5&name=Staff'" class="w-16 h-16 rounded-2xl object-cover border border-white shadow-sm bg-white">
                    <div class="min-w-0">
                        <p class="text-xs font-black text-brandindigo uppercase tracking-widest mb-1">Selected Staff</p>
                        <h4 class="text-lg font-black text-gray-900 truncate">${fullName}</h4>
                        <p class="text-sm text-gray-500 font-bold truncate">${empId || '-'}${positionVal && positionVal !== '-' ? ' · ' + positionVal : ''}</p>
                        <p class="text-xs text-gray-400 font-bold truncate">${deptVal && deptVal !== '-' ? deptVal : ''}</p>
                    </div>
                </div>`;
}

function handleRatingEmployeeIdInput(inputEl) {
    const empId = inputEl ? inputEl.value.trim() : '';
    const preview = document.getElementById('rating-employee-preview');
    if (!empId) {
        if (preview) {
            preview.classList.add('hidden');
            preview.innerHTML = '';
        }
        return;
    }
    const finishLookup = () => {
        const empRow = findStaffRowById(empId);
        if (!empRow) {
            if (preview) {
                preview.classList.remove('hidden');
                preview.innerHTML = `<div class="text-sm font-bold text-red-500"><i class="fa-solid fa-circle-exclamation mr-2"></i>ไม่พบ Staff ID: ${empId}</div>`;
            }
            return;
        }
        autoFillEmployeeData(empId);
    };
    if ((tableCache['staff'] && tableCache['staff'].data && tableCache['staff'].data.length) || (tableCache['Staff'] && tableCache['Staff'].data && tableCache['Staff'].data.length)) {
        finishLookup();
        return;
    }
    google.script.run.withSuccessHandler(res => {
        if (res && res.success && Array.isArray(res.data)) {
            tableCache['staff'] = { headers: res.headers || [], data: res.data };
        }
        finishLookup();
    }).withFailureHandler(() => finishLookup()).getSheetData('staff');
}

if (typeof google === 'undefined') {
    window.google = {
        script: {
            run: {
                withSuccessHandler: function (cb) { this._success = cb; return this; },
                withFailureHandler: function (cb) { this._failure = cb; return this; },
                getDashboardData: function () { setTimeout(() => this._success && this._success({ success: true, data: { staff: 15, leaves: 5, logs: 42, lateHours: 3.5, earlyHours: 1.5, absents: 2, otAmount: 500000, assets: 12, trainings: 4, pendingLeaves: [], recentCards: [] } }), 500); },
                getSheetData: function () { setTimeout(() => this._success && this._success({ success: true, headers: ['ID', 'NAME'], data: [{ ID: '1', NAME: 'Test' }] }), 500); },
                updateRecordData: function () { setTimeout(() => this._success && this._success({ success: true }), 500); },
                saveData: function () { setTimeout(() => this._success && this._success({ success: true }), 500); },
                updateEntireRecord: function () { setTimeout(() => this._success && this._success({ success: true }), 500); },
                deleteRecordData: function () { setTimeout(() => this._success && this._success({ success: true }), 500); },
                recordAttendance: function () { setTimeout(() => this._success && this._success({ success: true }), 500); },
                verifyLogin: function (email, p, d) { setTimeout(() => this._success && this._success({ success: true, role: "Admin", empId: "A001", username: String(email).split('@')[0] }), 500); },

                getTodayAttendance: function () { setTimeout(() => this._success && this._success({ success: true, data: { checkIn: "-", checkOut: "-", status: "-" } }), 500); },
                uploadImageToDrive: function (base64Data, fileName) { setTimeout(() => this._success && this._success({ success: true, url: "https://ui-avatars.com/api/?background=e0e7ff&color=4f46e5&name=Upload+Success" }), 500); }
            }
        }
    };
}

document.addEventListener("DOMContentLoaded", () => {
    startRealtimeClock();
    const savedSession = localStorage.getItem('hr_user_session') || sessionStorage.getItem('hr_user_session');
    if (savedSession) {
        showApp();
    }
    // ถ้าไม่มี session → login-screen โชว์อยู่แล้วตั้งแต่ HTML render (display:flex default)

    document.getElementById('btn-confirm-ok').addEventListener('click', () => {
        hideConfirmModal();
        if (confirmOkCallback) confirmOkCallback();
    });
    document.getElementById('btn-confirm-cancel').addEventListener('click', () => {
        hideConfirmModal();
        if (confirmCancelCallback) confirmCancelCallback();
    });
});

/* =====================================================================
 * 📌 ส่วนที่ 5: REALTIME CLOCK (ฟังก์ชันนาฬิกา)
 * - จัดการนาฬิกาเวลาปัจจุบันที่แสดงในระบบ
 * ===================================================================== */
function startRealtimeClock() {
    setInterval(() => {
        const now = new Date();
        const timeStr = now.toLocaleTimeString('en-US', { hour12: false });
        const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
        const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        const dateStr = `${days[now.getDay()]}, ${now.getDate()} ${months[now.getMonth()]} ${now.getFullYear()}`;

        const clockEl = document.getElementById('realtime-clock');
        const dateEl = document.getElementById('realtime-date');
        if (clockEl) clockEl.innerText = timeStr;
        if (dateEl) dateEl.innerText = dateStr;
    }, 1000);
}

function loadTodayAttendance() {
    const empInput = document.getElementById('manualEmpId');
    if (!empInput) return;

    let empId = empInput.value.trim().toUpperCase();
    if (!empId) {
        try {
            const session = JSON.parse(localStorage.getItem('hr_user_session') || '{}');
            empId = String(session.empId || session.employeeId || '').trim().toUpperCase();
            if (empId) empInput.value = empId;
        } catch (e) { }
    }

    const checkInEl = document.getElementById('display-checkin');
    const checkOutEl = document.getElementById('display-checkout');
    const statusEl = document.getElementById('display-status');
    if (!empId) {
        if (checkInEl) checkInEl.innerText = '-';
        if (checkOutEl) checkOutEl.innerText = '-';
        if (statusEl) statusEl.innerText = 'Enter employee ID';
        return;
    }

    google.script.run
        .withSuccessHandler(res => {
            if (!res || !res.success) {
                if (statusEl) statusEl.innerText = 'Unable to load';
                showToast((res && res.message) || 'Unable to load attendance', 'error');
                return;
            }
            const data = res.data || {};
            if (checkInEl) checkInEl.innerText = data.checkIn || '-';
            if (checkOutEl) checkOutEl.innerText = data.checkOut || '-';
            if (statusEl) statusEl.innerText = data.status || '-';

            // ── อัปเดต Radio Buttons ตามสถานะวันนี้ ──────────────────
            const radioIn = document.querySelector('input[name="scanType"][value="IN"]');
            const radioOut = document.querySelector('input[name="scanType"][value="OUT"]');
            const scanBtn = document.getElementById('scan-submit-btn') || document.querySelector('button[onclick*="handleManualScan"]');
            const scanNote = document.getElementById('scan-status-note');

            const hasIn = data.checkIn && data.checkIn !== '-';
            const hasOut = data.checkOut && data.checkOut !== '-';

            if (radioIn && radioOut) {
                if (!hasIn && !hasOut) {
                    // ยังไม่ได้ Check-In เลย → บังคับให้เลือก IN เท่านั้น
                    radioIn.checked = true;
                    radioIn.disabled = false;
                    radioOut.disabled = true;
                    if (scanNote) { scanNote.textContent = ''; scanNote.className = ''; }
                } else if (hasIn && !hasOut) {
                    // Check-In แล้ว รอ Check-Out → บังคับ OUT
                    radioOut.checked = true;
                    radioIn.disabled = true;
                    radioOut.disabled = false;
                    if (scanNote) {
                        scanNote.textContent = '✅ Check-In แล้วเวลา ' + data.checkIn + ' น. — กรุณา Check-Out';
                        scanNote.className = 'text-xs font-semibold text-emerald-600 mt-1 block';
                    }
                } else if (hasIn && hasOut) {
                    // Check-In + Check-Out แล้ว → ล็อกทั้งคู่
                    radioIn.disabled = true;
                    radioOut.disabled = true;
                    if (scanBtn) scanBtn.disabled = true;
                    if (scanNote) {
                        scanNote.textContent = '🔒 บันทึกครบแล้ววันนี้ (IN: ' + data.checkIn + ' / OUT: ' + data.checkOut + ')';
                        scanNote.className = 'text-xs font-semibold text-indigo-600 mt-1 block';
                    }
                }
            }
        })
        .withFailureHandler(err => {
            if (statusEl) statusEl.innerText = 'Connection failed';
            showToast('Connection failed: ' + err.message, 'error');
        })
        .getTodayAttendance(empId);
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

function showApp() {
    try {
        // 📌 ซ่อน login screen และแสดง app layout ด้วย inline style (ป้องกัน Tailwind class conflict)
        document.getElementById('login-screen').style.display = 'none';
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
/* =====================================================================
 * 📌 ส่วนที่ 7: AUTHENTICATION (ฟังก์ชันเข้าสู่ระบบ/ออกจากระบบ)
 * - ตรวจสอบผู้ใช้และจัดการ Session การเข้าสู่ระบบ
 * ===================================================================== */
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
    window.location.href = 'index.html';
}

let isDesktopSidebarCollapsed = false;

/* =====================================================================
 * 📌 ส่วนที่ 8: SIDEBAR UI (ฟังก์ชันควบคุมเมนูแถบข้าง)
 * - ใช้ย่อ/ขยาย หรือเปิด/ปิด เมนูด้านข้าง
 * ===================================================================== */
function toggleSidebar() {
    const sidebar = document.getElementById('sidebar');
    const backdrop = document.getElementById('sidebar-backdrop');
    const isMobile = window.innerWidth < 768;

    if (isMobile) {
        if (sidebar.classList.contains('-translate-x-full')) {
            sidebar.classList.remove('-translate-x-full');
            backdrop.classList.remove('hidden');
            if (isDesktopSidebarCollapsed) expandSidebarUI(sidebar);
        } else {
            sidebar.classList.add('-translate-x-full');
            backdrop.classList.add('hidden');
        }
    } else {
        isDesktopSidebarCollapsed = !isDesktopSidebarCollapsed;
        if (isDesktopSidebarCollapsed) collapseSidebarUI(sidebar);
        else expandSidebarUI(sidebar);
    }
    setTimeout(() => { if (map) map.invalidateSize(); }, 300);
}

function collapseSidebarUI(sidebar) {
    sidebar.classList.remove('w-64');
    sidebar.classList.add('w-20');
    document.querySelectorAll('.sidebar-text').forEach(el => el.classList.add('opacity-0', 'w-0'));
    document.querySelectorAll('.nav-btn, .sidebar-action-btn, .nav-group-btn').forEach(btn => {
        btn.classList.remove('px-4');
        btn.classList.add('justify-center', 'px-2');
    });
    const headerDiv = document.getElementById('sidebar-header-content');
    if (headerDiv) {
        headerDiv.classList.remove('justify-between', 'px-6');
        headerDiv.classList.add('justify-center');
        const titleSpan = headerDiv.querySelector('.sidebar-text');
        if (titleSpan) titleSpan.classList.add('hidden');
    }
    document.querySelectorAll('.submenu-container').forEach(el => {
        el.classList.add('hidden');
        el.classList.remove('flex');
    });
    document.querySelectorAll('.nav-group-btn .fa-chevron-down').forEach(el => el.classList.remove('rotate-180'));
}

function expandSidebarUI(sidebar) {
    sidebar.classList.remove('w-20');
    sidebar.classList.add('w-64');
    document.querySelectorAll('.sidebar-text').forEach(el => el.classList.remove('opacity-0', 'w-0'));
    document.querySelectorAll('.nav-btn, .sidebar-action-btn, .nav-group-btn').forEach(btn => {
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

/* =====================================================================
 * 📌 ส่วนที่ 9: LOADING & TOASTS (ฟังก์ชันหน้าต่างโหลดข้อมูลและข้อความแจ้งเตือนสั้นๆ)
 * - แสดงหน้าจอโหลดและแจ้งเตือนสถานะต่างๆ ที่มุมจอ
 * ===================================================================== */
function toggleLoading(show, text = 'PROCESSING...') {
    document.getElementById('loading-text').innerText = text;
    document.getElementById('main-loading').classList.toggle('hidden', !show);
}

function showToast(msg, type = 'success') {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    const color = type === 'success' ? 'bg-white border-gray-100 text-gray-800' : 'bg-white border-red-100 text-gray-800';
    const iconColor = type === 'success' ? 'text-emerald-500 bg-emerald-50' : 'text-red-500 bg-red-50';
    const icon = type === 'success' ? 'fa-check' : 'fa-xmark';

    toast.className = `flex items-center w-full max-w-sm p-4 ${color} rounded-2xl shadow-xl border pointer-events-auto transform transition-all duration-300 -translate-y-5 opacity-0`;
    toast.innerHTML = `
                <div class="inline-flex items-center justify-center flex-shrink-0 w-10 h-10 rounded-full ${iconColor}">
                    <i class="fa-solid ${icon} text-lg"></i>
                </div>
                <div class="ml-4 text-sm font-bold flex-1 tracking-wide">${msg}</div>
                <button onclick="this.parentElement.remove()" class="ml-auto -mx-1.5 -my-1.5 bg-transparent hover:bg-gray-100 rounded-lg p-2 inline-flex items-center justify-center h-8 w-8 transition-colors">
                    <i class="fa-solid fa-xmark text-gray-400"></i>
                </button>
            `;

    container.appendChild(toast);

    requestAnimationFrame(() => {
        setTimeout(() => {
            toast.classList.remove('-translate-y-5', 'opacity-0');
            toast.classList.add('translate-y-0', 'opacity-100');
        }, 10);
    });

    setTimeout(() => {
        if (toast.parentElement) {
            toast.classList.remove('translate-y-0', 'opacity-100');
            toast.classList.add('-translate-y-5', 'opacity-0');
            setTimeout(() => { if (toast.parentElement) toast.remove(); }, 300);
        }
    }, 3000);
}

function showImagePreview(imageSrc, imageAlt = 'Image preview') {
    let modal = document.getElementById('image-preview-modal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'image-preview-modal';
        modal.className = 'fixed inset-0 z-[300] hidden items-center justify-center bg-gray-950/80 backdrop-blur-sm p-4';
        modal.innerHTML = `
                    <div class="relative max-w-5xl w-full max-h-[92vh] flex items-center justify-center" onclick="event.stopPropagation()">
                        <button type="button" onclick="closeImagePreview()" class="absolute -top-2 right-0 md:-right-2 z-10 w-11 h-11 rounded-full bg-white text-gray-700 hover:text-red-500 shadow-xl flex items-center justify-center transition-colors" aria-label="Close image preview">
                            <i class="fa-solid fa-xmark text-xl"></i>
                        </button>
                        <img id="image-preview-content" class="max-w-full max-h-[88vh] object-contain rounded-2xl bg-white shadow-2xl border border-white/20" alt="">
                    </div>`;
        modal.addEventListener('click', closeImagePreview);
        document.body.appendChild(modal);
    }
    const image = document.getElementById('image-preview-content');
    image.src = imageSrc;
    image.alt = imageAlt;
    modal.classList.remove('hidden');
    modal.classList.add('flex');
    document.body.style.overflow = 'hidden';
}

function closeImagePreview() {
    const modal = document.getElementById('image-preview-modal');
    if (!modal) return;
    modal.classList.add('hidden');
    modal.classList.remove('flex');
    document.body.style.overflow = '';
}

function showAttachmentPreview(source, title = 'Attachment') {
    // 🛡️ กันไว้ก่อน: ถ้าไม่มีค่า source เลย (undefined/null/ว่าง) ห้ามไปตั้ง src ของ iframe/img
    // เพราะการตั้ง src="" จะทำให้เบราว์เซอร์พยายามโหลด "หน้าเพจปัจจุบัน" ซ้อนเข้าไปในเฟรม
    // ซึ่งจะโดนบล็อกด้วย error: "Unsafe attempt to load URL ... from frame with URL ..."
    if (!source || String(source).trim() === '' || String(source).trim() === '-') {
        showToast('ไม่พบไฟล์แนบสำหรับรายการนี้', 'error');
        return;
    }

    const isPdf = /^data:application\/pdf/i.test(source) || /\.pdf(?:[?#]|$)/i.test(source);
    if (!isPdf) {
        showImagePreview(source, title);
        return;
    }

    let modal = document.getElementById('attachment-preview-modal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'attachment-preview-modal';
        modal.className = 'fixed inset-0 z-[310] hidden items-center justify-center bg-gray-950/80 backdrop-blur-sm p-3 md:p-6';
        modal.innerHTML = `
                    <div class="relative w-full max-w-6xl h-[92vh] bg-white rounded-2xl shadow-2xl overflow-hidden flex flex-col" onclick="event.stopPropagation()">
                        <div class="h-14 px-5 flex items-center justify-between border-b border-gray-200 bg-white shrink-0">
                            <h3 id="attachment-preview-title" class="font-bold text-gray-800"><i class="fa-solid fa-file-pdf text-red-500 mr-2"></i>Attachment</h3>
                            <button type="button" onclick="closeAttachmentPreview()" class="w-10 h-10 rounded-full hover:bg-red-50 text-gray-500 hover:text-red-500 transition-colors" aria-label="Close attachment"><i class="fa-solid fa-xmark text-xl"></i></button>
                        </div>
                        <iframe id="attachment-preview-frame" class="w-full flex-1 bg-gray-100" title="PDF attachment"></iframe>
                    </div>`;
        modal.addEventListener('click', closeAttachmentPreview);
        document.body.appendChild(modal);
    }
    document.getElementById('attachment-preview-title').innerHTML = `<i class="fa-solid fa-file-pdf text-red-500 mr-2"></i>${title}`;
    document.getElementById('attachment-preview-frame').src = source;
    modal.classList.remove('hidden');
    modal.classList.add('flex');
    document.body.style.overflow = 'hidden';
}

function closeAttachmentPreview() {
    const modal = document.getElementById('attachment-preview-modal');
    if (!modal) return;
    modal.classList.add('hidden');
    modal.classList.remove('flex');
    const frame = document.getElementById('attachment-preview-frame');
    if (frame) frame.src = 'about:blank';
    document.body.style.overflow = '';
}

document.addEventListener('keydown', event => {
    if (event.key === 'Escape') {
        closeImagePreview();
        closeAttachmentPreview();
    }
});

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

        document.getElementById('page-title').innerText = title;
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
    document.getElementById('dashStartDate').value = '';
    document.getElementById('dashEndDate').value = '';
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

/* =====================================================================
 * 📌 ส่วนที่ 11: DASHBOARD CORE (ฟังก์ชันหลักของหน้าแดชบอร์ด)
 * - คำนวณและแสดงผลสถิติหลักในหน้าแดชบอร์ด
 * ===================================================================== */
function loadDashboard() {
    try {
        // ดึงค่าจากตัวแปรปฏิทินที่ถูกจิ้มเลือกแบบช่วงวันที่
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

        // 🌟 ระบบใหม่: เลิกดึงข้อมูลผ่าน Network ซ้ำซ้อน (แก้ปัญหา Timeout 100%)
        // เช็คว่ามีข้อมูลใน Cache ครบหรือยัง
        let reqStaff = !tableCache['staff'];
        let reqLogs = !tableCache['Fingerprint_Logs'];
        let reqAnnounce = !tableCache['Announcements'];
        let reqLeaves = !tableCache['Leave application'];
        let reqRatings = !tableCache['Employees Ranting '];

        if (reqStaff || reqLogs || reqAnnounce || reqLeaves || reqRatings) {
            // ถ้ายังเพิ่งเข้าเว็บและโหลดยังไม่ครบ ให้สั่งโหลดแค่รอบเดียว
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
            // ถ้ามี Cache ครบแล้ว กรองข้อมูลขึ้นหน้าจอได้ทันทีแบบไม่ต้องรอโหลด (เร็วมาก!)
            finishLoadDashboardUI();
        }

    } catch (error) {
        console.error("Error in loadDashboard:", error);
    }
}

// 🌟 ฟังก์ชันตัวช่วย: อัปเดตข้อมูลกราฟและตัวเลขทั้งหมดบนหน้าจอจาก Cache
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

    // ปิดกล่อง Loading และคืนความชัดให้ตัวเลข
    const loader = document.getElementById('dash-inline-loader');
    if (loader) loader.classList.add('hidden');
    const statIds = ['dash-staff', 'dash-leaves', 'dash-logs', 'dash-assets', 'dash-trainings', 'dash-late', 'dash-early', 'dash-absent', 'dash-ot', 'dash-overview-absent'];
    statIds.forEach(id => {
        let el = document.getElementById(id);
        if (el) el.classList.remove('opacity-30', 'scale-95');
    });
}

function updateDashboardUI(data) {
    // 🛡️ ฟังก์ชันตัวช่วยสำหรับใส่ค่า ป้องกัน Error ถ้าหากล่อง HTML ไม่เจอ
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

    // ตรวจสอบก่อนเรียกใช้งานฟังก์ชันตกแต่งหน้าจอ
    if (typeof renderDashboardPendingLeaves === 'function') renderDashboardPendingLeaves(data.pendingLeaves || []);
    if (typeof renderDashboardRecentCards === 'function') renderDashboardRecentCards(data.recentCards || []);
    if (typeof renderDashboardExtras === 'function') renderDashboardExtras();
}

let lateChartInstance = null;

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
    let reqRatings = !tableCache['Employees Ranting ']; // 📌 เพิ่มตัวแปรเช็คการโหลด Rating

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
    // 📌 เพิ่มคำสั่งโหลดตาราง Rating อัตโนมัติ เพื่อให้ Dashboard เอาไปคำนวณ Top 3 ได้
    if (reqRatings) {
        google.script.run.withSuccessHandler(res => {
            if (res.success) tableCache['Employees Ranting '] = { headers: (res.headers || []).map(String), data: res.data || [] };
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
    // 🏆 วาด Top Rating หลังจากข้อมูลทุกอย่างโหลดครบแล้ว
    if (typeof renderDashboardTopRatings === 'function') renderDashboardTopRatings();
    // 📊 วาด Employee of Month chart ด้วย
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
 * - วาดกราฟวงกลมสรุปสถานะการเข้างาน (มาตรงเวลา, สาย, ขาด, ลา)
 * ===================================================================== */
function checkAndRenderCharts() {
    if (!tableCache['staff'] || !tableCache['Fingerprint_Logs']) return;

    let staffData = tableCache['staff'].data;
    let logData = tableCache['Fingerprint_Logs'].data;
    let leaveData = tableCache['Leave application'] ? tableCache['Leave application'].data : [];

    // 1. นับจำนวนพนักงานทั้งหมด
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

    // 🌟 2. ระบุช่วงวันที่เป้าหมาย (จากที่คลิกเลือกช่วงในปฏิทิน ถ้าไม่ได้เลือกให้ใช้วันนี้)
    let startRangeStr = (typeof dashCalStartDateStr !== 'undefined' && dashCalStartDateStr) ? dashCalStartDateStr : new Date().toISOString().slice(0, 10);
    let endRangeStr = (typeof dashCalEndDateStr !== 'undefined' && dashCalEndDateStr) ? dashCalEndDateStr : startRangeStr;

    const tStartObj = new Date(startRangeStr);
    tStartObj.setHours(0, 0, 0, 0);
    const tEndObj = new Date(endRangeStr);
    tEndObj.setHours(0, 0, 0, 0);

    let sumLate = 0, sumEarly = 0, sumOT = 0;
    let presentSet = new Set(); // เก็บรายชื่อคนที่มาสแกน

    // 🌟 3. คำนวณ มาทำงาน, สาย, กลับก่อน, โอที (เฉพาะวันนั้น)
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
            // ตรวจสอบว่าวันที่อยู่ในช่วงเริ่มต้นและสิ้นสุดที่เลือกหรือไม่
            if (d.getTime() >= tStartObj.getTime() && d.getTime() <= tEndObj.getTime()) {
                let eId = String(getFuzzyValue(l, ['employee_id', 'emp_id'])).toUpperCase().trim();
                let status = String(getFuzzyValue(l, ['attendance_status', 'status', 'สถานะ'])).toLowerCase();

                if (!status.includes('missing') && !status.includes('absent') && !status.includes('ขาด')) {
                    presentSet.add(eId); // นับคนที่มาสแกน (นับแค่คนละ 1 ครั้ง)
                }

                sumLate += parseFloat(getFuzzyValue(l, ['late_hours', 'มาช้า'])) || 0;
                sumEarly += parseFloat(getFuzzyValue(l, ['early_leave_hours', 'กลับก่อน'])) || 0;
                sumOT += parseFloat(getFuzzyValue(l, ['ot_amount', 'ยอดเงินโอที'])) || 0;
            }
        }
    });

    let presentCount = presentSet.size;

    // 🌟 4. คำนวณ ขาดงาน, ลางาน, และ คนมาทำงาน (เฉพาะวันนั้น)
    let sumAbsent = 0;
    let absentListHTML = '';
    let leaveListHTML = '';
    let presentListHTML = '';
    let absentDetailsCount = 0;
    let leaveDetailsCount = 0;
    let presentDetailsCount = 0;

    // ดึงใบลา ALL (ทุกสถานะ) สำหรับวันนั้น เพื่อแสดงสถานะอนุมัติ/ไม่อนุมัติ
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
            // ตรวจสอบความทับซ้อนระหว่างช่วงลางานและช่วงที่เลือกดูบนแดชบอร์ด
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

    // 🟢 สร้างรายการ Leave Requests (แสดงทุกใบลาที่มีในวันนั้น พร้อมสถานะ)
    allLeavesForDay.forEach(lv => {
        let empId = lv._empId;
        let empName = empNamesMapFull[empId] || empId;
        let leaveType = getFuzzyValue(lv, ['type', 'ประเภท', 'ประเภทการลา']) || 'Leave';
        let rawStatus = String(getFuzzyValue(lv, ['signature', 'status', 'อนุมัติ', 'approval_status']) || '').toLowerCase();
        let leaveStart = getFuzzyValue(lv, ['start_date', 'เริ่ม']);
        let leaveEnd = getFuzzyValue(lv, ['end_date', 'สิ้นสุด']);

        // กำหนด badge สถานะ
        let statusBadge = '';
        let dotColor = 'bg-gray-400';
        if (rawStatus.includes('approve') || rawStatus.includes('hr') || rawStatus.includes('อนุมัติ') || rawStatus.includes('อนุญาต')) {
            statusBadge = `<span class="text-[9px] bg-emerald-50 text-emerald-600 px-2 py-1 rounded-md font-bold border border-emerald-200 tracking-widest uppercase flex items-center gap-1"><i class="fa-solid fa-check"></i> อนุมัติ</span>`;
            dotColor = 'bg-emerald-400';
        } else if (rawStatus.includes('reject') || rawStatus.includes('ปฏิเสธ') || rawStatus.includes('ไม่อนุมัติ') || rawStatus.includes('denied')) {
            statusBadge = `<span class="text-[9px] bg-red-50 text-red-500 px-2 py-1 rounded-md font-bold border border-red-100 tracking-widest uppercase flex items-center gap-1"><i class="fa-solid fa-times"></i> ไม่อนุมัติ</span>`;
            dotColor = 'bg-red-400';
        } else {
            statusBadge = `<span class="text-[9px] bg-amber-50 text-amber-500 px-2 py-1 rounded-md font-bold border border-amber-200 tracking-widest uppercase flex items-center gap-1"><i class="fa-solid fa-clock"></i> รอพิจารณา</span>`;
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
            // 🟢 คนที่มาสแกน — หาข้อมูล check-in/out จาก logData
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
            let lateTag = lateHrs > 0 ? `<span class="text-[9px] bg-orange-50 text-orange-500 px-1.5 py-0.5 rounded border border-orange-100 font-bold ml-1">สาย ${lateHrs}h</span>` : '';

            presentListHTML += `<li class="flex items-center justify-between py-2 px-3 rounded-xl hover:bg-emerald-50 transition-colors border border-transparent hover:border-emerald-100">
                        <div class="flex items-center gap-2.5 min-w-0">
                            <span class="w-2 h-2 rounded-full bg-emerald-500 flex-shrink-0"></span>
                            <div class="min-w-0">
                                <p class="text-sm font-black text-gray-900 leading-tight truncate">${empName} ${lateTag}</p>
                                <p class="text-[10px] text-gray-400 font-medium mt-0.5">In: ${checkIn} &nbsp;|&nbsp; Out: ${checkOut}</p>
                            </div>
                        </div>
                        <span class="text-[9px] bg-emerald-50 text-emerald-600 px-2 py-1 rounded-md font-bold border border-emerald-200 tracking-widest uppercase flex-shrink-0">มาทำงาน</span>
                    </li>`;
            presentDetailsCount++;
        } else if (!isOnLeave) {
            // 🔴 ไม่ลา และ ไม่ได้สแกนนิ้ว = ขาดงาน
            let todayObj = new Date();
            todayObj.setHours(0, 0, 0, 0);
            if (tStartObj <= todayObj && tStartObj.getDay() !== 0) {
                sumAbsent++;
                absentListHTML += `<li class="flex items-center justify-between py-3 px-4 rounded-2xl hover:bg-gray-50 transition-colors border border-transparent hover:border-gray-100">
                                <div class="flex items-center gap-3">
                                    <span class="w-2 h-2 rounded-full bg-red-500 flex-shrink-0"></span>
                                    <span class="text-sm font-black text-gray-900">${empName}</span>
                                </div>
                                <span class="text-[9px] bg-red-50 text-red-500 px-3 py-1 rounded-lg font-bold uppercase border border-red-100 tracking-widest">ABSENT</span>
                            </li>`;
                absentDetailsCount++;
            }
        }
    });

    // 🌟 5. อัปเดต HTML หน้าจอ
    const sectionContainer = document.getElementById('dashboard-absent-leave-section');
    const absentUl = document.getElementById('dash-absent-list');
    const leaveUl = document.getElementById('dash-leave-list');
    const presentUl = document.getElementById('dash-present-list');

    if (sectionContainer) {
        sectionContainer.classList.remove('hidden');
        sectionContainer.classList.add('grid', 'grid-cols-1', 'lg:grid-cols-3');
    }

    // อัปเดตการ์ดคนมาทำงาน
    if (presentUl) {
        if (presentDetailsCount > 0) presentUl.innerHTML = presentListHTML;
        else presentUl.innerHTML = '<li class="py-8 text-center text-gray-400 text-xs font-medium border border-dashed border-gray-200 rounded-xl bg-gray-50 flex flex-col items-center justify-center"><i class="fa-solid fa-door-open text-2xl mb-2 text-gray-300"></i> ยังไม่มีผู้มาทำงาน</li>';
    }
    const presentBadge = document.getElementById('dash-present-count-badge');
    if (presentBadge) presentBadge.innerText = `${presentDetailsCount} คน`;

    // อัปเดตการ์ดคนขาด
    if (absentUl) {
        if (absentDetailsCount > 0) absentUl.innerHTML = absentListHTML;
        else absentUl.innerHTML = '<li class="py-8 text-center text-gray-400 text-xs font-medium border border-dashed border-gray-200 rounded-xl bg-gray-50 flex flex-col items-center justify-center"><i class="fa-solid fa-user-check text-2xl mb-2 text-gray-300"></i> ไม่มีคนขาดงาน 🎉</li>';
    }
    const absentBadge = document.getElementById('dash-absent-count-badge');
    if (absentBadge) absentBadge.innerText = `${absentDetailsCount} คน`;

    // อัปเดตการ์ดใบลา
    if (leaveUl) {
        if (leaveDetailsCount > 0) leaveUl.innerHTML = leaveListHTML;
        else leaveUl.innerHTML = '<li class="py-8 text-center text-gray-400 text-xs font-medium border border-dashed border-gray-200 rounded-xl bg-gray-50 flex flex-col items-center justify-center"><i class="fa-solid fa-clipboard-check text-2xl mb-2 text-gray-300"></i> No leave records found.</li>';
    }
    const leaveBadge = document.getElementById('dash-leave-count-badge');
    if (leaveBadge) leaveBadge.innerText = `${leaveDetailsCount} คน`;

    // 🌟 อัปเดตตัวเลขทั้งหมด
    const safeUpdate = (id, val) => { const el = document.getElementById(id); if (el) el.innerText = val; };
    safeUpdate('dash-logs', presentCount); // อัปเดตช่องสแกนนิ้ว
    safeUpdate('dash-late', (Math.round(sumLate * 100) / 100));
    safeUpdate('dash-early', (Math.round(sumEarly * 100) / 100));
    safeUpdate('dash-absent', sumAbsent);
    safeUpdate('dash-overview-absent', sumAbsent);
    safeUpdate('dash-ot', new Intl.NumberFormat('th-TH').format(sumOT));
    safeUpdate('dash-leaves', leaveDetailsCount);

    // อัปเดตกราฟวงกลม
    if (typeof updateAttendanceRateChart === 'function') updateAttendanceRateChart(staffCount, presentCount);

    // 🎂 BIRTHDAYS (ปล่อยไว้เป็นรายเดือนเหมือนเดิม)
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
            bdContainer.innerHTML = '<p class="text-xs text-gray-500 text-center py-6 bg-gray-50 rounded-xl border border-dashed border-gray-200 font-medium">No birthdays this month 🎉</p>';
        } else {
            bdContainer.classList.remove('justify-center', 'items-center');
            bdContainer.innerHTML = birthdaysHtml;
        }
    }
}

/* =====================================================================
 * 📊 กราฟวงกลม Daily Attendance Rate
 * ===================================================================== */
function updateAttendanceRateChart(totalStaff, presentCount) {
    const ctx = document.getElementById('attendanceRateChart');
    const percentText = document.getElementById('dash-attendance-percent');

    // คำนวณ %
    let total = parseInt(totalStaff) || 0;
    let present = parseInt(presentCount) || 0;
    let percent = total > 0 ? Math.round((present / total) * 100) : 0;
    if (percent > 100) percent = 100;

    // อัปเดตตัวเลข
    if (percentText) percentText.innerText = percent + '%';
    if (!ctx) return;

    // ล้างกราฟเก่าก่อนวาดใหม่
    if (window.attChartInstance) {
        window.attChartInstance.destroy();
        window.attChartInstance = null;
    }

    let absent = Math.max(0, total - present);

    try {
        window.attChartInstance = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: ['มาทำงาน', 'ขาด/ลา'],
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

/* =====================================================================
 * 🏆 TOP Rating – ดึงจากหน้า Employee Rating เรียงตามดาวมากสุด
 * ===================================================================== */
function renderDashboardTopRatings() {
    const container = document.getElementById('dashboard-top-ratings');
    if (!container) return;

    // ถ้ายังไม่มีข้อมูลให้ดึงจาก Supabase ก่อน
    if (!tableCache['Employees Ranting '] && !tableCache['employees_rating']) {
        container.innerHTML = '<p class="text-sm text-white/50 text-center py-4"><i class="fa-solid fa-spinner fa-spin mr-2"></i>กำลังดึงข้อมูลคะแนนดาว...</p>';
        google.script.run.withSuccessHandler(res => {
            if (res && res.success) {
                tableCache['Employees Ranting '] = { headers: res.headers || [], data: res.data || [] };
                renderDashboardTopRatings();
            } else {
                container.innerHTML = '<p class="text-sm text-white/50 text-center py-4">ไม่พบข้อมูลการประเมิน</p>';
            }
        }).withFailureHandler(() => {
            container.innerHTML = '<p class="text-sm text-red-300 text-center py-4">โหลดข้อมูลไม่สำเร็จ</p>';
        }).getSheetData('Employees Ranting ');
        return;
    }

    let ratingData = (tableCache['Employees Ranting '] || tableCache['employees_rating'])?.data || [];

    if (!ratingData.length) {
        container.innerHTML = '<p class="text-sm text-white/50 text-center py-4">ยังไม่มีข้อมูลการประเมินดาว</p>';
        return;
    }

    // รวมคะแนนของพนักงานแต่ละคน
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

    // จัดอันดับ: ค่าเฉลี่ยดาวสูงสุด → จำนวนรีวิวเยอะกว่า
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
        // พยายามดึงรูปโปรไฟล์จาก Staff cache
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

        // วาดดาว
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

    // อัปเดต Bar chart "Employee of Month" ด้วย
    if (typeof renderEmployeeMonthChart === 'function') renderEmployeeMonthChart();
}

/* =====================================================================
 * 📊 Bar Chart – Employee of the Month (คำนวณจากสถิติเข้างาน: ไม่ขาด ไม่ลา ไม่สาย)
 * ===================================================================== */
let employeeMonthChartInst = null;
function renderEmployeeMonthChart() {
    const ctx = document.getElementById('employeeMonthChart');
    if (!ctx) return;

    if (!tableCache['staff'] || !tableCache['Fingerprint_Logs']) return;

    let staffData = tableCache['staff'].data;
    let logData = tableCache['Fingerprint_Logs'].data;
    let leaveData = tableCache['Leave application'] ? tableCache['Leave application'].data : [];

    // 1. ดึงรายชื่อพนักงานที่ Active
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

    // 2. ระบุช่วงวันที่ของเดือนเป้าหมาย
    const targetDateStr = (typeof dashCalStartDateStr !== 'undefined' && dashCalStartDateStr) ? dashCalStartDateStr : new Date().toISOString().slice(0, 10);
    const tDateObj = new Date(targetDateStr);
    const targetYear = tDateObj.getFullYear();
    const targetMonth = tDateObj.getMonth(); // 0-11

    // 3. กรองข้อมูลการลาที่ได้รับการอนุมัติ
    let approvedLeaves = leaveData.filter(r => {
        let status = String(getFuzzyValue(r, ['signature', 'status', 'อนุมัติ'])).toLowerCase();
        return status.includes('approve') || status.includes('hr') || status.includes('อนุมัติ') || status.includes('อนุญาต');
    });

    // 4. คำนวณวันทำงานในเดือนนั้น (ไม่นับวันอาทิตย์)
    let lastDay = new Date(targetYear, targetMonth + 1, 0).getDate();
    let today = new Date();
    // หากเป็นเดือนปัจจุบัน ให้ประเมินถึงแค่วันนี้
    if (today.getFullYear() === targetYear && today.getMonth() === targetMonth) {
        lastDay = today.getDate();
    }

    let evaluationDays = [];
    for (let d = 1; d <= lastDay; d++) {
        let date = new Date(targetYear, targetMonth, d);
        if (date.getDay() !== 0) { // ยกเว้นวันอาทิตย์
            evaluationDays.push(date);
        }
    }

    if (evaluationDays.length === 0) return;

    // 5. Index ข้อมูลเพื่อการค้นหาที่รวดเร็ว (ป้องกันการเกิดลูปซ้อนลูปขนาดใหญ่)
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

    // 6. คำนวณคะแนนพนักงานแต่ละคน
    let sortedData = activeStaff.map(emp => {
        let perfectDays = 0;
        evaluationDays.forEach(date => {
            let dateKey = date.toISOString().slice(0, 10);
            let empId = emp.id;
            let logKey = `${empId}_${dateKey}`;
            let leaveKey = `${empId}_${dateKey}`;

            let hasLeave = leaveLookup[leaveKey] || false;
            let log = logLookup[logKey];

            // เงื่อนไข: ไม่ขาด (มี log), ไม่ลา (ไม่มี leave), ไม่สาย (late_hours <= 0)
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

    // เรียงลำดับจากเปอร์เซ็นต์เข้างานสูงสุด
    sortedData.sort((a, b) => b.rate - a.rate || b.perfect - a.perfect);

    // ดึงข้อมูล 10 คนแรก
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

    // 👇 🛑 เพิ่มบรรทัดนี้ลงไป: ป้องกัน Error ถ้าหากหน้าจอไม่มีส่วนนี้
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

    // 👇 🛑 เพิ่มบรรทัดนี้ลงไป: ถ้าไม่เจอกล่องในหน้าจอ ให้หยุดทำงานเลย ไม่ต้อง Error
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


    // 👇 🛠️ โค้ดที่แก้ใหม่: อนุญาตให้ Staff เห็นข้อมูลทั้งหมด
    if (currentSheet.includes('Ranting') || currentSheet.includes('Rating') || currentSheet === 'Announcements' || currentSheet === 'News' || currentSheet === 'Training' || currentSheet === 'Asset_Tracking') {
        return data;
    }

    return data.filter(row => {
        let isOwner = false;
        // 👇 🛠️ อัปเดตคอลัมน์ให้รองรับ employees id ด้วย
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
 * 📌 ส่วนที่ 13: DATA FETCHING & API (ฟังก์ชันดึงข้อมูลจาก Google Sheets)
 * - ดึงข้อมูลพนักงาน, การเข้างาน, ข้อมูลการลา ฯลฯ
 * ===================================================================== */
function fetchData(sheetName, forceRefresh = false) {

    // 👇👇 โค้ดที่วางแทรก เพื่อบังคับให้ดึงข้อมูล Staff มาวาดแผนผัง 👇👇
    if (sheetName.trim() === 'Organization Structure') {
        currentSheet = sheetName;

        document.getElementById('searchInput').value = '';
        if (document.getElementById('tableStartDate')) document.getElementById('tableStartDate').value = '';
        if (document.getElementById('tableEndDate')) document.getElementById('tableEndDate').value = '';

        // ถ้ามีข้อมูลพนักงานโหลดไว้อยู่แล้ว ให้วาดได้เลย
        if (tableCache['staff'] && !forceRefresh) {
            rawData = filterDataForUser(tableCache['staff'].data);
            renderOrgChart(rawData);
            return;
        }

        // ถ้ายังไม่มี ให้บังคับดึงข้อมูลตาราง "staff" แทน
        toggleLoading(true, 'FETCHING ORG DATA...');
        google.script.run
            .withSuccessHandler(res => {
                toggleLoading(false);
                if (res.success) {
                    tableCache['staff'] = { headers: res.headers || [], data: res.data || [] };
                    rawData = filterDataForUser(res.data || []);
                    renderOrgChart(rawData);
                } else {
                    showToast(res.message, 'error');
                }
            })
            .withFailureHandler(err => {
                toggleLoading(false);
                showToast('Connection failed: ' + err.message, 'error');
            })
            .getSheetData('staff'); // บังคับดึงข้อมูลจากตารางพนักงาน
        return;
    }

    // ตรวจสอบ Cache หากได้รับการโหลดข้อมูลตารางนี้ไว้แล้วและไม่ได้บังคับรีเฟรช
    if (tableCache[sheetName] && !forceRefresh) {
        currentHeaders = tableCache[sheetName].headers;
        rawData = filterDataForUser(tableCache[sheetName].data);
        if (sheetName === 'Organization Structure ') {
            renderOrgChart(rawData);
        } else {
            renderTable(rawData);
        }
        return;
    }

    toggleLoading(true, 'FETCHING DATA...');
    google.script.run
        .withSuccessHandler(res => {
            try {
                if (res.success) {
                    const cleanedHeaders = ensureHeadersForSheet(sheetName, res.headers);
                    tableCache[sheetName] = { headers: cleanedHeaders, data: res.data || [] };
                    currentHeaders = cleanedHeaders;
                    rawData = filterDataForUser(res.data || []);

                    if (sheetName === 'Organization Structure ') {
                        renderOrgChart(rawData);
                    } else {
                        renderTable(rawData);
                    }
                } else {
                    showToast(res.message, 'error');
                }
            } catch (error) {
                console.error("Render Table Error:", error);
                showToast('ดึงข้อมูลสำเร็จ แต่พบปัญหาการแสดงผลตาราง', 'error');
            } finally {
                toggleLoading(false);
            }
        })
        .withFailureHandler(err => {
            showToast('Connection failed: ' + err.message, 'error');
            toggleLoading(false);
        })
        .getSheetData(sheetName, forceRefresh);
}

function filterData() {
    const keyword = document.getElementById('searchInput').value.toLowerCase();
    const startDateStr = document.getElementById('tableStartDate') ? document.getElementById('tableStartDate').value : '';
    const endDateStr = document.getElementById('tableEndDate') ? document.getElementById('tableEndDate').value : '';

    let filtered = rawData;

    if (keyword) {
        filtered = filtered.filter(row => Object.values(row).some(v => String(v).toLowerCase().includes(keyword)));
    }

    if (startDateStr || endDateStr) {
        let startObj = startDateStr ? new Date(startDateStr) : null;
        let endObj = endDateStr ? new Date(endDateStr) : null;
        if (startObj) startObj.setHours(0, 0, 0, 0);
        if (endObj) endObj.setHours(23, 59, 59, 999);

        filtered = filtered.filter(row => {
            let rowDateStr = null;
            for (let key in row) {
                let lwK = String(key).toLowerCase().trim();
                if (lwK === 'start_date' || lwK === 'date' || lwK.includes('วันที่') || lwK === 'start date') {
                    rowDateStr = row[key];
                    break;
                }
            }

            if (!rowDateStr || rowDateStr === '-') return true;

            let rowDate = new Date(rowDateStr);
            if (isNaN(rowDate.getTime())) {
                let parts = String(rowDateStr).split(/[\/\-]/);
                if (parts.length === 3) {
                    if (parts[2].length === 4) {
                        rowDate = new Date(`${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`);
                    } else if (parts[0].length === 4) {
                        rowDate = new Date(`${parts[0]}-${parts[1].padStart(2, '0')}-${parts[2].padStart(2, '0')}`);
                    }
                }
            }

            if (isNaN(rowDate.getTime())) return true;
            rowDate.setHours(12, 0, 0, 0);

            if (startObj && rowDate < startObj) return false;
            if (endObj && rowDate > endObj) return false;

            return true;
        });
    }

    if (currentSheet === 'Organization Structure ') renderOrgChart(filtered);
    else renderTable(filtered);
}

function changeApprovalStatus(id, columnName, selectElement) {
    const newValue = selectElement.value;
    if (!newValue) return;

    let isDanger = newValue === 'Rejected' || newValue === 'Inactive';

    showConfirmModal(
        'Confirm Status Change',
        `Are you sure you want to change status to <br><b class="${isDanger ? 'text-red-500' : 'text-brandindigo'} uppercase tracking-wide">"${newValue}"</b>?`,
        () => {
            const rowIndex = rawData.findIndex(r => getRecordId(r) === id);
            if (rowIndex > -1) {
                rawData[rowIndex][columnName] = newValue;
                if (tableCache[currentSheet]) tableCache[currentSheet].data = rawData;
                renderTable(rawData);
            }

            toggleLoading(true, 'SAVING STATUS...');
            google.script.run
                .withSuccessHandler(res => {
                    toggleLoading(false);
                    if (res.success) showSuccessModal("Status Updated", `Successfully changed status to <b>${newValue}</b>`);
                    else { showToast(res.message, 'error'); fetchData(currentSheet, true); }
                })
                .withFailureHandler(err => {
                    toggleLoading(false);
                    showToast('Connection failed: ' + err.message, 'error');
                    fetchData(currentSheet, true);
                })
                .updateRecordData(currentSheet, id, columnName, newValue);
        },
        () => {
            renderTable(rawData);
        },
        isDanger
    );
}

function getFuzzyValue(row, searchKeys, defaultIndex = null) {
    for (let k in row) {
        let lwK = k.toLowerCase().trim();
        for (let searchKey of searchKeys) {
            if (lwK.includes(searchKey.toLowerCase())) return row[k];
        }
    }
    if (defaultIndex !== null && Object.keys(row).length > defaultIndex) return Object.values(row)[defaultIndex];
    return '-';
}

/* =====================================================================
 * 📌 ส่วนที่ 14: EMPLOYEE DROPDOWN (ฟังก์ชันจัดการ Dropdown เลือกพนักงาน)
 * - ดึงรายชื่อพนักงานมาแสดงในช่องเลือกและค้นหาแบบพิมพ์หาได้ (Autocomplete)
 * ===================================================================== */
function populateEmpDropdown() {
    const dropdown = document.getElementById('emp-dropdown-list');
    if (!dropdown) return;

    let empMap = new Map();

    const staffCache = tableCache['staff'] || tableCache['Staff'];
    if (staffCache && staffCache.data) {
        staffCache.data.forEach(r => {
            let eId = getFuzzyValue(r, ['employee_id', 'emp_id']);
            let name = getFuzzyValue(r, ['name', 'ชื่อ', 'full_name', 'first_name']);
            if (eId && eId !== '-') empMap.set(eId.toUpperCase().trim(), name);
        });
    }

    const logData = tableCache['Fingerprint_Logs'] ? tableCache['Fingerprint_Logs'].data : rawData;
    if (logData) {
        logData.forEach(r => {
            let eId = r.Employee_ID || r.Emp_ID;
            let name = r.Full_Name || r.Name;
            if (eId && !empMap.has(String(eId).toUpperCase().trim())) {
                empMap.set(String(eId).toUpperCase().trim(), name || '-');
            }
        });
    }

    let html = '<ul class="py-2 text-sm text-gray-700 m-0 p-0">';
    if (empMap.size === 0) {
        html += `<li class="px-4 py-3 text-gray-500 text-xs text-center italic">No staff found</li>`;
    } else {
        empMap.forEach((name, id) => {
            html += `<li class="px-4 py-2 hover:bg-gray-50 cursor-pointer flex flex-col border-b border-gray-100 last:border-0 transition-colors" onclick="selectEmpDropdown('${id}')">
                                <span class="font-bold text-brandindigo text-xs uppercase tracking-wide">${id}</span>
                                <span class="text-[11px] text-gray-500 truncate">${name}</span>
                             </li>`;
        });
    }
    html += '</ul>';
    dropdown.innerHTML = html;
}

function showEmpDropdown() {
    const sessionStr = localStorage.getItem('hr_user_session') || sessionStorage.getItem('hr_user_session');
    let role = 'Staff';
    if (sessionStr) { try { role = JSON.parse(sessionStr).role || 'Staff'; } catch (e) { } }

    if (role === 'Staff') return;

    if (!tableCache['staff']) {
        google.script.run.withSuccessHandler(res => {
            if (res.success) {
                tableCache['staff'] = { headers: (res.headers || []).map(String), data: res.data || [] };
                populateEmpDropdown();
                filterEmpDropdown();
            }
        }).getSheetData('staff');
    }

    populateEmpDropdown();
    document.getElementById('emp-dropdown-list').classList.remove('hidden');
    filterEmpDropdown();
}

function hideEmpDropdownDelayed() {
    setTimeout(() => {
        let dropdown = document.getElementById('emp-dropdown-list');
        if (dropdown) dropdown.classList.add('hidden');
    }, 250);
}

function selectEmpDropdown(id) {
    let input = document.getElementById('calendarEmpId');
    if (input) {
        input.value = id;
        if (tableCache[currentSheet]) renderTable(tableCache[currentSheet].data);
    }
}

function filterEmpDropdown() {
    let input = document.getElementById('calendarEmpId');
    if (!input) return;
    let filter = input.value.toUpperCase().trim();
    let dropdown = document.getElementById('emp-dropdown-list');
    if (!dropdown) return;
    let li = dropdown.getElementsByTagName('li');
    for (let i = 0; i < li.length; i++) {
        let txtValue = li[i].textContent || li[i].innerText;
        if (txtValue.toUpperCase().indexOf(filter) > -1) {
            li[i].style.display = "";
        } else {
            li[i].style.display = "none";
        }
    }
}

// 📌 ฟังก์ชันสำหรับเปิด/ปิดหน้าต่าง Profile (อัปเดตให้รองรับสถานะ)
/* =====================================================================
 * 📌 ส่วนที่ 15: EMPLOYEE PROFILE (ฟังก์ชันแสดงโปรไฟล์พนักงาน)
 * - เปิดหน้าต่างแสดงรายละเอียดข้อมูลส่วนตัวของพนักงานที่เลือก
 * ===================================================================== */
function showEmployeeProfile(encodedData) {
    const data = JSON.parse(decodeURIComponent(encodedData));

    let name = getFuzzyValue(data, ['name', 'ชื่อ', 'full_name', 'first_name']);
    let position = getFuzzyValue(data, ['position', 'ตำแหน่ง']);
    let empId = getFuzzyValue(data, ['employee_id', 'emp_id', 'id']);
    let dept = getFuzzyValue(data, ['department_name', 'department', 'แผนก', 'department_id']);
    let contact = getFuzzyValue(data, ['contact', 'phone', 'เบอร์โทร', 'ติดต่อ']);
    let picUrl = getFuzzyValue(data, ['profile', 'รูป', 'pic', 'image']);
    let status = getFuzzyValue(data, ['status', 'สถานะ']);

    if (!picUrl || picUrl === '-') picUrl = 'https://ui-avatars.com/api/?background=e0e7ff&color=4f46e5&name=' + name;

    document.getElementById('profile-modal-img').src = picUrl;
    document.getElementById('profile-modal-img').onerror = function () { this.src = 'https://ui-avatars.com/api/?background=e0e7ff&color=4f46e5&name=NA'; };
    document.getElementById('profile-modal-name').innerText = name !== '-' ? name : 'Unknown';
    document.getElementById('profile-modal-position').innerText = position !== '-' ? position : 'No Position';
    document.getElementById('profile-modal-id').innerText = empId !== '-' ? empId : '-';
    document.getElementById('profile-modal-dept').innerText = dept !== '-' ? dept : '-';
    document.getElementById('profile-modal-contact').innerText = contact !== '-' ? contact : '-';

    // 📌 เช็คและแสดงสถานะให้ถูกต้อง
    let statusEl = document.getElementById('profile-modal-status');
    if (statusEl) {
        if (String(status).toLowerCase().includes('inactive') || String(status).includes('ลาออก') || String(status).includes('พ้นสภาพ')) {
            statusEl.innerHTML = '<i class="fa-solid fa-circle-xmark mr-1 text-sm"></i> Inactive';
            statusEl.className = 'text-base font-bold text-red-500';
        } else if (String(status).toLowerCase().includes('leave') || String(status).includes('ลาพัก')) {
            statusEl.innerHTML = '<i class="fa-solid fa-circle-pause mr-1 text-sm"></i> On Leave';
            statusEl.className = 'text-base font-bold text-amber-500';
        } else {
            statusEl.innerHTML = '<i class="fa-solid fa-circle-check mr-1 text-sm"></i> Active Employee';
            statusEl.className = 'text-base font-bold text-emerald-600';
        }
    }

    const modal = document.getElementById('profile-modal');
    const modalBox = modal.querySelector('div.bg-white');

    modal.classList.remove('hidden');
    void modal.offsetWidth;
    modal.classList.remove('opacity-0');
    modalBox.classList.remove('scale-95');
    modalBox.classList.add('scale-100');
}

function closeEmployeeProfile() {
    const modal = document.getElementById('profile-modal');
    const modalBox = modal.querySelector('div.bg-white');

    modal.classList.add('opacity-0');
    modalBox.classList.remove('scale-100');
    modalBox.classList.add('scale-95');

    setTimeout(() => {
        modal.classList.add('hidden');
    }, 300);
}

// 📌 ฟังก์ชันสุ่มสีสำหรับพื้นหลัง Avatar ย่อ
function getRandomColor(name) {
    const colors = ['1abc9c', '3498db', '9b59b6', 'f1c40f', 'e67e22', 'e74c3c', '34495e', '16a085', '27ae60', '2980b9'];
    let hash = 0;
    if (!name || name.length === 0) return colors[0];
    for (let i = 0; i < name.length; i++) {
        hash = name.charCodeAt(i) + ((hash << 5) - hash);
        hash = hash & hash;
    }
    hash = ((hash % colors.length) + colors.length) % colors.length;
    return colors[hash];
}

function createOrgCard(person) {
    let picUrl = getFuzzyValue(person, ['photos', 'photo', 'profile', 'รูป', 'pic', 'image']);
    let name = getFuzzyValue(person, ['first_name', 'name', 'ชื่อ', 'full_name', 'employee']);
    let lastName = getFuzzyValue(person, ['last_name', 'นามสกุล']);
    let fullName = name !== '-' ? (lastName !== '-' ? name + ' ' + lastName : name) : 'Unknown';

    let empId = getFuzzyValue(person, ['employee_id', 'emp_id', 'id']) || '';

    let cleanFullName = fullName;
    if (empId && cleanFullName.toUpperCase().includes(empId.toUpperCase())) {
        cleanFullName = cleanFullName.replace(new RegExp(empId, 'ig'), '').trim();
        if (cleanFullName.startsWith('-')) cleanFullName = cleanFullName.substring(1).trim();
    }

    let displayName = empId && cleanFullName === 'Unknown' ? empId : (empId ? empId + '<br>' + cleanFullName : cleanFullName);

    // 🌟 สร้างชุดสีแบบไดนามิก เพื่อให้ขอบวงกลมแต่ละคนมีสีแตกต่างกัน (เหมือนรูปต้นแบบ)
    const colors = ['#0ea5e9', '#0d9488', '#16a34a', '#ea580c', '#c026d3', '#7c3aed', '#2563eb'];
    let hash = 0;
    for (let i = 0; i < cleanFullName.length; i++) {
        hash = cleanFullName.charCodeAt(i) + ((hash << 5) - hash);
    }
    let themeColor = colors[Math.abs(hash) % colors.length];

    const encodedName = encodeURIComponent(cleanFullName);
    const fallbackAvatar = `https://ui-avatars.com/api/?background=${themeColor.replace('#', '')}&color=ffffff&name=${encodedName}&size=100&bold=true`;

    if (picUrl && picUrl.includes('drive.google.com')) {
        let fileId = picUrl.includes('id=') ? picUrl.split('id=')[1].split('&')[0] : (picUrl.includes('/d/') ? picUrl.split('/d/')[1].split('/')[0] : '');
        if (fileId) picUrl = 'https://drive.google.com/thumbnail?id=' + fileId + '&sz=w200';
    }

    if (!picUrl || picUrl === '-' || picUrl.trim() === '') {
        picUrl = fallbackAvatar;
    }

    let position = getFuzzyValue(person, ['position', 'ตำแหน่ง', 'position_id']) || '-';
    let dept = getFuzzyValue(person, ['department_name', 'department', 'แผนก', 'department_id']) || '';
    let displayPos = position;
    if (dept && dept !== '-' && !position.toLowerCase().includes(dept.toLowerCase())) {
        displayPos = `${position} - ${dept}`;
    }

    const rowId = getRecordId(person);
    const encodedPerson = encodeURIComponent(JSON.stringify(person)).replace(/'/g, "%27");

    const sessionStr = localStorage.getItem('hr_user_session') || sessionStorage.getItem('hr_user_session');
    let role = 'Staff';
    if (sessionStr) { try { let s = JSON.parse(sessionStr); role = s.role || 'Staff'; } catch (e) { } }

    // 🌟 ดีไซน์ใหม่: Infographic Circle (ขอบสีหนา, ไส้ในขาว, รูปโปรไฟล์เล็กๆ ตรงกลาง)
    return `
            <div class="inline-flex flex-col items-center group relative cursor-pointer mx-4 mt-2" onclick="showEmployeeProfile('${encodedPerson}')">
                
                ${role !== 'Staff' ? `
                <div class="absolute -top-4 -right-4 bg-white rounded-lg shadow-md border border-gray-100 p-1 flex space-x-1 z-30 opacity-0 group-hover:opacity-100 transition-opacity" onclick="event.stopPropagation()">
                    <button onclick="openFormModal('${encodedPerson}')" class="text-blue-600 hover:bg-blue-50 w-6 h-6 rounded-md flex items-center justify-center transition-colors"><i class="fa-solid fa-pen-to-square text-[10px]"></i></button>
                    <button onclick="deleteRecord('${rowId}')" class="text-red-500 hover:bg-red-50 w-6 h-6 rounded-md flex items-center justify-center transition-colors"><i class="fa-solid fa-trash text-[10px]"></i></button>
                </div>` : ''}

                <div class="absolute -top-2 left-1/2 transform -translate-x-1/2 w-2.5 h-2.5 rounded-full z-30" style="background-color: ${themeColor};"></div>

                <div class="w-36 h-36 rounded-full p-[6px] z-20 relative shadow-[0_10px_20px_-5px_rgba(0,0,0,0.15)] group-hover:shadow-[0_15px_25px_-5px_rgba(0,0,0,0.25)] transition-all duration-300 group-hover:-translate-y-1" style="background: ${themeColor};">
                    
                    <div class="w-full h-full bg-white rounded-full flex flex-col items-center justify-center shadow-inner p-3 relative overflow-hidden">
                        
                        <div class="w-10 h-10 rounded-full border border-gray-100 mb-1.5 overflow-hidden shrink-0 bg-gray-50">
                            <img src="${picUrl}" alt="${cleanFullName}" class="w-full h-full object-cover" onerror="this.onerror=null; this.src='${fallbackAvatar}'">
                        </div>
                        
                        <h3 class="font-bold text-[10px] text-gray-800 leading-tight w-full text-center line-clamp-2" title="${displayName}">${displayName}</h3>
                        
                        <div class="w-4 h-[1px] my-1 opacity-60" style="background-color: ${themeColor};"></div>
                        
                        <p class="text-[8px] font-bold text-gray-500 uppercase tracking-widest truncate w-full text-center" title="${displayPos}">${displayPos}</p>
                    </div>
                </div>
            </div>`;
}
/* =====================================================================
 * 📌 ส่วนที่ 16: ORGANIZATION CHART (ฟังก์ชันแผนผังองค์กร)
 * - สร้างและแสดงแผนผังโครงสร้างองค์กรจากข้อมูลพนักงาน
 * ===================================================================== */
function renderOrgChart(data) {
    const orgWrapper = document.getElementById('org-chart-wrapper');

    // ปิดตารางอื่นๆ ทิ้ง
    ['table-controls-wrapper', 'table-wrapper', 'card-wrapper', 'table-summary', 'calendar-section'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.classList.add('hidden');
    });
    orgWrapper.classList.remove('hidden');

    if (!data || data.length === 0) {
        orgWrapper.innerHTML = '<div class="flex flex-col items-center justify-center py-20 text-gray-500 mt-10"><i class="fa-solid fa-sitemap text-5xl mb-4 text-gray-300"></i><p class="font-medium">No organizational data available.</p></div>';
        return;
    }

    // 🌟 1. จัดกลุ่มตำแหน่ง (แก้บั๊กพนักงานซ้ำ)
    let ceos = [], clevels = [];
    let depts = {}; // จัดกลุ่มระดับหัวหน้าและพนักงานตามแผนก

    data.forEach(emp => {
        let status = String(getFuzzyValue(emp, ['status', 'สถานะ'])).toLowerCase();
        if (status.includes('inactive') || status.includes('ลาออก') || status.includes('พ้นสภาพ')) return;

        let pos = String(getFuzzyValue(emp, ['position', 'ตำแหน่ง', 'position_id'])).toLowerCase();
        let dept = String(getFuzzyValue(emp, ['department_name', 'department', 'แผนก', 'department_id']) || 'General').toUpperCase().trim();

        // CEO และ C-Level ให้อยู่รวมกันด้านบนสุด
        if (pos.includes('ceo') || pos.includes('ประธาน') || pos.includes('md') || pos.includes('managing')) {
            ceos.push(emp);
        } else if (pos.includes('cfo') || pos.includes('coo') || pos.includes('cto') || pos.includes('cmo') || pos.includes('director') || pos.includes('ผู้อำนวยการ') || pos.includes('ผู้บริหาร') || pos.includes('c-level')) {
            clevels.push(emp);
        } else {
            // แยกระดับล่างลงมาตามแผนก (Manager -> Head -> Staff)
            if (!depts[dept]) depts[dept] = { managers: [], heads: [], staffs: [] };
            if (pos.includes('manager') || pos.includes('ผู้จัดการ') || pos.includes('mgr')) {
                depts[dept].managers.push(emp);
            } else if (pos.includes('head') || pos.includes('หัวหน้า') || pos.includes('lead') || pos.includes('supervisor')) {
                depts[dept].heads.push(emp);
            } else {
                depts[dept].staffs.push(emp);
            }
        }
    });

    // 🌟 2. ประกอบร่างแผนผังจากล่างขึ้นบน
    let deptBranchesHtml = '';

    // สร้างเส้นสายงานแยกตามแผนก
    Object.keys(depts).sort().forEach(deptName => {
        let d = depts[deptName];
        let staffHtml = d.staffs.length > 0 ? `<ul><li><div class="flex justify-center gap-4">${d.staffs.map(e => createOrgCard(e)).join('')}</div></li></ul>` : '';
        let headHtml = d.heads.length > 0 ? `<ul><li><div class="flex justify-center gap-4">${d.heads.map(e => createOrgCard(e)).join('')}</div>${staffHtml}</li></ul>` : staffHtml;

        let branchLi = '';
        if (d.managers.length > 0) {
            branchLi = `<li><div class="flex justify-center gap-4">${d.managers.map(e => createOrgCard(e)).join('')}</div>${headHtml}</li>`;
        } else if (d.heads.length > 0) {
            branchLi = `<li><div class="flex justify-center gap-4">${d.heads.map(e => createOrgCard(e)).join('')}</div>${staffHtml}</li>`;
        } else if (d.staffs.length > 0) {
            branchLi = `<li><div class="flex justify-center gap-4">${d.staffs.map(e => createOrgCard(e)).join('')}</div></li>`;
        }
        deptBranchesHtml += branchLi;
    });

    let deptsUl = deptBranchesHtml ? `<ul>${deptBranchesHtml}</ul>` : '';

    // ประกอบเข้ากับกลุ่มผู้บริหารด้านบน
    let clevelHtml = '';
    if (clevels.length > 0) {
        // เอาผู้บริหารระดับ C-Level มัดรวมกันใน 1 โหนด (แก้บั๊กเส้นสายซ้ำซ้อน)
        clevelHtml = `<ul><li><div class="flex justify-center gap-6 relative z-10">${clevels.map(e => createOrgCard(e)).join('')}</div>${deptsUl}</li></ul>`;
    } else {
        clevelHtml = deptsUl;
    }

    let finalHtml = '';
    if (ceos.length > 0) {
        // เอา CEO ทุกคนมัดรวมกันใน 1 โหนดสูงสุด
        finalHtml = `<ul><li><div class="flex justify-center gap-6 relative z-10">${ceos.map(e => createOrgCard(e)).join('')}</div>${clevelHtml}</li></ul>`;
    } else {
        finalHtml = clevelHtml;
    }

    // 🌟 3. CSS ดีไซน์เส้นประสีน้ำเงินให้ตรงตามรูปเป๊ะๆ
    // 🌟 3. CSS ดีไซน์เส้นตรงสีน้ำเงิน
    // 🌟 3. CSS ดีไซน์เส้นตรงขอบมน (Rounded Lines) ให้เข้ากับ Infographic
    let styles = `<style>
                .org-tree * { margin: 0; padding: 0; box-sizing: border-box; }
                .org-tree { display: flex; justify-content: center; width: 100%; overflow-x: auto; padding-bottom: 50px; }
                .org-tree ul { padding-top: 25px; position: relative; transition: all 0.5s; display: flex; justify-content: center; white-space: nowrap; }
                .org-tree li { float: left; text-align: center; list-style-type: none; position: relative; padding: 25px 5px 0 5px; transition: all 0.5s; }
                
                /* เส้นแนวนอนด้านบนของแต่ละโหนด (สีเทาฟ้าเพื่อให้จุดกลมเด่น) */
                .org-tree li::before, .org-tree li::after { content: ''; position: absolute; top: 0; right: 50%; border-top: 1.5px solid #0284c7; width: 50%; height: 25px; }
                .org-tree li::after { right: auto; left: 50%; border-left: 1.5px solid #0284c7; }
                
                /* ซ่อนเส้นถ้ามีแค่โหนดเดียว */
                .org-tree li:only-child::after, .org-tree li:only-child::before { display: none; }
                .org-tree li:only-child { padding-top: 0; }
                
                /* ลบเส้นส่วนเกินซ้ายขวาสุด */
                .org-tree li:first-child::before, .org-tree li:last-child::after { border: 0 none; }
                
                /* โค้งมนตรงมุมเส้น เหมือนในภาพ */
                .org-tree li:last-child::before { border-right: 1.5px solid #0284c7; border-radius: 0 8px 0 0; }
                .org-tree li:first-child::after { border-radius: 8px 0 0 0; }
                
                /* เส้นแนวตั้งลากลงมาหากลุ่มลูก */
                .org-tree ul ul::before { content: ''; position: absolute; top: 0; left: 50%; border-left: 1.5px solid #0284c7; width: 0; height: 25px; transform: translateX(-50%); }
            </style>`;

    orgWrapper.innerHTML = styles + '<div class="org-tree inline-block min-w-max pt-10">' + finalHtml + '</div>';
}

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

                // 🤖 เพิ่มระบบคำนวณเวลา มาช้า/กลับก่อน อัตโนมัติจากเวลาที่สแกนเทียบกับเวลากะ
                if (late === 0 && row.Check_In && row.Check_In !== '-' && row.Shift_Start && row.Shift_Start !== '-') {
                    let inMins = parseInt(String(row.Check_In).split(':')[0] || 0) * 60 + parseInt(String(row.Check_In).split(':')[1] || 0);
                    let startMins = parseInt(String(row.Shift_Start).split(':')[0] || 0) * 60 + parseInt(String(row.Shift_Start).split(':')[1] || 0);
                    if (inMins > startMins) late = (inMins - startMins) / 60; // แปลงเป็นชั่วโมง
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

                // 🤖 ระบบคำนวณเวลาอัตโนมัติ
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
        if (addDataBtn) addDataBtn.classList.remove('hidden');
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

    // 📌 เริ่มบล็อกที่แก้ใหม่: เพิ่ม Employee Rating ให้แสดงเป็นการ์ดพร้อมระบบดาว
    // 📌 เริ่มบล็อกการ์ดแสดงผล (Training / Asset / Employee Rating)
    if (currentSheet === 'Training' || currentSheet === 'Asset_Tracking' || currentSheet === 'Announcements' || currentSheet === 'News' || currentSheet.includes('Ranting') || currentSheet.includes('Rating') || currentSheet.trim() === 'Policy' || currentSheet.trim() === 'Documents') {
        tableWrapper.classList.add('hidden');
        cardWrapper.classList.remove('hidden');
        cardWrapper.innerHTML = '';
        summaryDiv.classList.add('hidden');
        if (addDataBtn) addDataBtn.classList.remove('hidden');

        // 👇 แทรกโค้ดตรงนี้: ปิดปุ่ม Add Record ถ้าเป็น Staff
        if ((currentSheet === 'Announcements' || currentSheet === 'News' || currentSheet === 'Training' || currentSheet === 'Asset_Tracking') && role === 'Staff') {
            if (addDataBtn) addDataBtn.classList.add('hidden');
        }


        let isRatingPage = currentSheet.includes('Ranting') || currentSheet.includes('Rating');

        // 👇👇 🛠️ โค้ดที่แก้ใหม่: ซ่อนแค่กรอบสีแดง แต่ปล่อยให้ข้อมูลแสดงตามปกติ 👇👇
        let topBarWrapper = document.getElementById('table-controls-wrapper');
        let topBar = topBarWrapper ? topBarWrapper.firstElementChild : null;

        if (isRatingPage && role === 'Staff') {
            // ซ่อนแถบเครื่องมือด้านบนทั้งหมด (กรอบสีแดง) สำหรับ Staff
            if (topBar) topBar.style.display = 'none';
        } else if (isRatingPage && role !== 'Staff') {
            // คืนค่าให้ Admin มองเห็นแถบเครื่องมือได้ตามปกติ
            if (topBar) topBar.style.display = '';
        }
        // 👆👆 🛠️ สิ้นสุดโค้ดที่แก้ใหม่ 👆👆

        // 🎯 1. จัดการปุ่มสแกน QR ให้แสดงผลบนมือถือได้สวยงาม (แก้ปัญหาปุ่มตกขอบ)
        let qrBtn = document.getElementById('qr-scan-btn');
        if (isRatingPage) {
            if (!qrBtn && addDataBtn) {
                // ปรับแต่งกล่องครอบปุ่มให้รองรับมือถือ
                let btnContainer = addDataBtn.parentElement;
                if (btnContainer) {
                    btnContainer.classList.add('flex-wrap', 'justify-end', 'gap-2');
                    btnContainer.classList.remove('space-x-2');
                }

                qrBtn = document.createElement('button');
                qrBtn.id = 'qr-scan-btn';
                // เพิ่มคลาส w-full สำหรับมือถือ
                qrBtn.className = 'text-white bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 font-bold px-4 py-2.5 rounded-xl transition-all shadow-md flex items-center justify-center w-full md:w-auto';
                qrBtn.innerHTML = '<i class="fa-solid fa-camera mr-2"></i>สแกน QR ให้ดาว';
                // ✅ ป้องกัน Error โดยเช็คก่อนว่ามีการสร้างฟังก์ชันไว้หรือยัง ถ้ายังไม่มีให้ขึ้นแจ้งเตือนแทน
                qrBtn.onclick = typeof openQRScanner === 'function' ? openQRScanner : function () {
                    showToast('ฟังก์ชันแสกน QR ยังไม่พร้อมใช้งาน', 'error');
                };

                addDataBtn.classList.add('w-full', 'md:w-auto'); // ให้ปุ่ม Add รองรับมือถือด้วย
                btnContainer.insertBefore(qrBtn, addDataBtn);
            }
            if (qrBtn) qrBtn.style.display = '';
        } else {
            if (qrBtn) qrBtn.style.display = 'none';
        }

        // 🎯 2. สั่งลบกล่อง Total และวันที่แบบขุดรากถอนโคน
        let uiCheckCount = 0;
        let uiFixInterval = setInterval(() => {
            let totalBadge = document.getElementById('totalCount');
            let dateInputs = document.querySelectorAll('input[type="date"]');
            let searchInput = document.querySelector('input[placeholder*="Search"]');

            if (isRatingPage) {
                // ซ่อนกล่อง Total ให้เด็ดขาด
                if (totalBadge && totalBadge.parentElement) {
                    totalBadge.parentElement.style.cssText = 'display: none !important;';
                }
                // ซ่อนกล่องวันที่
                dateInputs.forEach(input => {
                    let dateContainer = input.closest('.space-x-2') || input.parentElement.parentElement;
                    if (dateContainer && !dateContainer.querySelector('input[placeholder*="Search"]')) {
                        dateContainer.style.cssText = 'display: none !important;';
                    }
                });
                if (searchInput) {
                    let searchBox = searchInput.closest('.relative') || searchInput.parentElement;
                    if (searchBox) searchBox.style.cssText = 'display: block !important; width: 100%;';
                }
            } else {
                if (totalBadge && totalBadge.parentElement) totalBadge.parentElement.style.cssText = '';
                dateInputs.forEach(input => {
                    let dateContainer = input.closest('.space-x-2') || input.parentElement.parentElement;
                    if (dateContainer) dateContainer.style.cssText = '';
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
            cardWrapper.innerHTML = '<div class="col-span-full flex flex-col items-center justify-center py-20 text-gray-400 bg-gray-50 rounded-3xl border border-dashed border-gray-200"><i class="fa-regular fa-folder-open text-6xl mb-4 text-gray-300"></i><p class="font-bold tracking-widest uppercase text-sm">No records found</p></div>';
            return;
        }

        let cardsHtml = '';
        // 👉 1. โหมดหน้าการ์ด Training (ดีไซน์ใหม่ 100% + คลิกดูรายละเอียดได้)
        if (currentSheet === 'Training') {
            data.forEach(row => {
                const isEmpty = currentHeaders.every(h => !row[h] || String(row[h]).trim() === '');
                if (isEmpty) return;

                const rowId = getRecordId(row);
                const encodedRow = encodeURIComponent(JSON.stringify(row)).replace(/'/g, "%27");

                let title = getFuzzyValue(row, ['course', 'หลักสูตร', 'subject', 'หัวข้อ', 'name', 'ชื่อ', 'detail', 'รายละเอียด'], 1) || 'No Title';
                let photoUrl = getFuzzyValue(row, ['photo', 'รูป', 'pic', 'image', 'รูปภาพ']);

                // 🌐 ดึงข้อมูลลิงก์
                let ytUrl = getFuzzyValue(row, ['youtube', 'yt', 'ยูทูป', 'video', 'วิดีโอ']);
                let fbUrl = getFuzzyValue(row, ['facebook', 'fb', 'เฟสบุ๊ค', 'เพจ']);
                let generalUrl = getFuzzyValue(row, ['link', 'url', 'ลิงก์', 'เอกสาร']);

                // 🛠️ แปลงลิงก์ Google Drive ให้แสดงผลได้
                if (photoUrl && photoUrl.includes('drive.google.com')) {
                    let fileId = '';
                    if (photoUrl.includes('id=')) fileId = photoUrl.split('id=')[1].split('&')[0];
                    else if (photoUrl.includes('/d/')) fileId = photoUrl.split('/d/')[1].split('/')[0];
                    if (fileId) photoUrl = 'https://drive.google.com/thumbnail?id=' + fileId + '&sz=w800';
                }

                let cardArr = [];
                // พื้นหลังการ์ดสีขาว ขอบมน มีเงา คลิกได้
                cardArr.push(`<div onclick="showTrainingDetail('${encodedRow}')" class="bg-white rounded-[1.5rem] shadow-sm border border-gray-100 overflow-hidden flex flex-col relative transition-all duration-300 hover:shadow-xl hover:-translate-y-1 cursor-pointer group">`);

                // ส่วนหัว (ปุ่ม Edit/Delete ซ้ายขวาตามรูป)
                if (role !== 'Staff') {
                    cardArr.push('<div class="absolute top-3 right-3 flex space-x-2 z-10 bg-white/90 backdrop-blur-sm rounded-lg p-1.5" onclick="event.stopPropagation()">');
                    cardArr.push('<button onclick="openFormModal(\'', encodedRow, '\')" class="text-gray-500 hover:text-gray-800 transition-colors" title="Edit"><i class="fa-regular fa-pen-to-square text-lg"></i></button>');
                    cardArr.push('<button onclick="deleteRecord(\'', rowId, '\')" class="text-gray-500 hover:text-red-500 transition-colors" title="Delete"><i class="fa-regular fa-trash-can text-lg"></i></button>');
                    cardArr.push('</div>');
                }

                // ข้อความด้านบน (Topic)
                cardArr.push('<div class="p-5 pb-3">');
                cardArr.push('<p class="text-sm text-gray-800 font-medium whitespace-pre-line pr-16 leading-relaxed line-clamp-3 group-hover:text-brandindigo transition-colors" title="', escapeHtml(title), '">', escapeHtml(title), '</p>');
                cardArr.push('</div>');

                // รูปภาพตรงกลาง (ถ้ามี)
                if (photoUrl && photoUrl !== '-' && photoUrl.trim() !== '') {
                    cardArr.push('<div class="w-full px-5 pb-4 mt-auto">');
                    cardArr.push('<img src="', photoUrl, '" alt="Training Image" class="w-full h-auto max-h-[300px] object-cover rounded-2xl border border-gray-100" onerror="this.style.display=\'none\'">');
                    cardArr.push('</div>');
                } else {
                    cardArr.push('<div class="w-full flex-1 min-h-[100px]"></div>'); // ดันปุ่มลงล่างถ้ารูปไม่มี
                }

                // ปุ่ม Link ด้านล่างสุด (ถ้ามี)
                let targetUrl = '';
                let linkIcon = 'fa-link';
                let linkText = 'เอกสารประกอบการเรียน';
                let btnColor = 'text-brandindigo bg-indigo-50 hover:bg-indigo-100';

                if (generalUrl && generalUrl !== '-' && generalUrl.trim() !== '') { targetUrl = generalUrl; }
                else if (ytUrl && ytUrl !== '-' && ytUrl.trim() !== '') { targetUrl = ytUrl; linkIcon = 'fa-youtube'; linkText = 'เรียนผ่าน YouTube'; btnColor = 'text-red-600 bg-red-50 hover:bg-red-100'; }
                else if (fbUrl && fbUrl !== '-' && fbUrl.trim() !== '') { targetUrl = fbUrl; linkIcon = 'fa-facebook'; linkText = 'ดูผ่าน Facebook'; btnColor = 'text-blue-600 bg-blue-50 hover:bg-blue-100'; }

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
        // 👉 1.1 โหมดหน้าการ์ด Asset (ดีไซน์ใหม่ 100% ภาษาลาวตามรูป + แก้ปัญหา Base64 ทำหน้าเว็บพัง)
        else if (currentSheet === 'Asset_Tracking') {

            // 🛠️ 1. สร้างฟังก์ชันตัวช่วย เพื่อหลีกเลี่ยงการยัดข้อความ Base64 ยาวๆ ลงไปใน HTML โดยตรง
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

            // กรองทรัพย์สินให้แสดงเฉพาะของตัวเอง หากเป็นพนักงาน (Staff)
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

                // อ่านข้อมูล
                let assetName = getFuzzyValue(row, ['asset', 'ทรัพย์สิน', 'name', 'ชื่อ'], 1) || 'No Title';
                let employee = getFuzzyValue(row, ['employee', 'ผู้ถือครอง', 'ລະຫັດພະນັກງານ'], 3) || '-';
                let dateVal = getFuzzyValue(row, ['date', 'วันที่', 'เวลา', 'issue', 'ວັນເລີ່ມໃຊ້ງານ'], 2) || '-';
                let status = getFuzzyValue(row, ['status', 'สถานะ', 'ສະຖານະ']);
                let photoUrl = getFuzzyValue(row, ['photo', 'รูป', 'pic', 'image', 'รูปภาพ']);

                // 🛠️ 2. คลีนข้อมูล Base64 (ลบช่องว่าง) และจัดการ Google Drive
                if (typeof photoUrl === 'string') {
                    if (photoUrl.startsWith('data:image')) {
                        photoUrl = photoUrl.replace(/[\r\n\t\s]+/g, ""); // ลบช่องว่างที่ทำให้การ์ดพังทิ้ง
                    } else if (photoUrl.includes('drive.google.com')) {
                        let fileId = '';
                        if (photoUrl.includes('id=')) fileId = photoUrl.split('id=')[1].split('&')[0];
                        else if (photoUrl.includes('/d/')) fileId = photoUrl.split('/d/')[1].split('/')[0];
                        if (fileId) photoUrl = 'https://drive.google.com/thumbnail?id=' + fileId + '&sz=w800';
                    }
                }

                // เตรียมรูปภาพเริ่มต้น (Fallback) กรณีไม่มีรูป หรือรูปพัง
                let safeTopic = encodeURIComponent(String(assetName).substring(0, 20));
                let fallbackImg = `https://ui-avatars.com/api/?background=f8fafc&color=94a3b8&size=800&font-size=0.1&name=${safeTopic}`;

                if (!photoUrl || photoUrl === '-' || String(photoUrl).trim() === '') {
                    photoUrl = fallbackImg;
                }

                // ตรวจสอบสีสถานะ (Status Colors)
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

                // 🛠️ 3. ใช้ showAssetFromId ส่งแค่ ID สั้นๆ แทนการส่งข้อมูลทั้งก้อน
                cardArr.push(`<div onclick="showAssetFromId('${rowId}')" class="bg-white rounded-3xl shadow-sm border border-gray-200 overflow-hidden flex flex-col relative transition-all duration-300 hover:shadow-xl hover:-translate-y-1 cursor-pointer group p-4 pb-0">`);

                // Top Section (Status & Action Buttons)
                cardArr.push('<div class="flex justify-between items-start mb-2">');
                cardArr.push(`<div class="font-bold text-[13px] tracking-wide text-gray-800">ສະຖານະ: <span class="${statusColor}">${escapeHtml(status || '-')}</span></div>`);

                if (role !== 'Staff') {
                    cardArr.push('<div class="flex space-x-2 z-10 bg-white" onclick="event.stopPropagation()">');
                    // 🛠️ 4. ใช้ editAssetFromId ส่งแค่ ID
                    cardArr.push(`<button onclick="editAssetFromId('${rowId}', event)" class="text-gray-400 hover:text-gray-800 transition-colors" title="Edit"><i class="fa-regular fa-pen-to-square text-[15px]"></i></button>`);
                    cardArr.push(`<button onclick="event.stopPropagation(); deleteRecord('${rowId}')" class="text-gray-400 hover:text-red-500 transition-colors" title="Delete"><i class="fa-regular fa-trash-can text-[15px]"></i></button>`);
                    cardArr.push('</div>');
                } else {
                    cardArr.push('<div></div>');
                }
                cardArr.push('</div>');

                // Middle Section (Details: Employee ID, Serial, Date)
                cardArr.push('<div class="flex justify-between items-end mb-3">');
                cardArr.push('<div class="text-[11px] text-gray-600 leading-tight space-y-0.5">');
                cardArr.push(`<div>ລະຫັດພະນັກງານ: <span class="font-medium text-gray-800">${escapeHtml(employee)}</span></div>`);
                cardArr.push(`<div>ໝາຍເລກ: <span class="font-medium text-gray-800">${escapeHtml(rowId)}</span></div>`);
                cardArr.push('</div>');

                cardArr.push('<div class="text-[11px] text-gray-600 text-right leading-tight space-y-0.5">');
                cardArr.push('<div>ວันเริ่มใช้งาน:</div>');
                cardArr.push(`<div class="font-medium text-gray-800">${escapeHtml(dateVal)}</div>`);
                cardArr.push('</div>');
                cardArr.push('</div>');

                // Image Section
                cardArr.push('<div class="w-full mt-auto pb-4">');
                // 🛠️ 5. เพิ่ม onerror ป้องกันรูปล้ม
                cardArr.push(`<img src="${photoUrl}" alt="Asset" class="w-full aspect-square object-cover rounded-[1rem] border border-gray-100" onerror="this.onerror=null; this.src='${fallbackImg}';">`);
                cardArr.push('</div>');

                cardArr.push('</div>');
                cardsHtml += cardArr.join('');
            });
        }

        // 👉 โหมดหน้าการ์ด Announcements (ตาม UI ใหม่ 100% รูปแบบโปสเตอร์ + คลีน Base64 + โชว์ Topic)
        else if (currentSheet === 'Announcements') {

            // สร้างฟังก์ชันตัวช่วยแยก เพื่อไม่ให้ Base64 ยาวๆ ทำหน้าเว็บพัง
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

                // 🛠️ 1. ดึงข้อมูลรูปภาพ
                let photoUrl = row['photo'] || row['Photo'] || getFuzzyValue(row, ['photo', 'รูป', 'pic', 'image', 'รูปภาพ']) || '';

                // 🛠️ 2. คลีนข้อมูล Base64 และจัดการ Google Drive
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

                // เตรียมรูปโปสเตอร์เริ่มต้น
                let safeTopic = encodeURIComponent(String(topic).substring(0, 20));
                let fallbackImg = `https://ui-avatars.com/api/?background=e0e7ff&color=4f46e5&size=800&font-size=0.1&name=${safeTopic}`;

                if (!photoUrl || photoUrl === '-' || String(photoUrl).trim() === '') {
                    photoUrl = fallbackImg;
                }

                let cardArr = [];

                cardArr.push(`<div onclick="showAnnounceFromId('${rowId}')" class="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden flex flex-col relative transition-all duration-300 hover:shadow-lg hover:-translate-y-1 cursor-pointer group">`);

                // 🌟 3. แถบด้านบน (แสดง Type, Topic และปุ่มจัดการ)
                cardArr.push('<div class="flex justify-between items-start px-4 py-3 bg-white z-10 border-b border-gray-50 shrink-0 gap-2">');

                // ฝั่งซ้าย: โชว์ประเภท (Type) สีม่วงเล็กๆ และ หัวข้อ (Topic) ตัวหนา
                cardArr.push('<div class="flex flex-col min-w-0">');
                cardArr.push(`<span class="text-[10px] font-bold text-brandindigo uppercase tracking-widest mb-0.5" title="${escapeHtml(type)}">${escapeHtml(type)}</span>`);
                cardArr.push(`<h3 class="text-sm font-bold text-gray-800 line-clamp-2 leading-snug" title="${escapeHtml(topic)}">${escapeHtml(topic)}</h3>`);
                cardArr.push('</div>');

                // ฝั่งขวา: ปุ่มจัดการ
                if (role !== 'Staff') {
                    cardArr.push('<div class="flex space-x-2 shrink-0 mt-0.5">');
                    cardArr.push(`<button onclick="editAnnounceFromId('${rowId}', event)" class="text-gray-400 hover:text-brandindigo transition-colors" title="Edit"><i class="fa-regular fa-pen-to-square text-[15px]"></i></button>`);
                    cardArr.push(`<button onclick="event.stopPropagation(); deleteRecord('${rowId}')" class="text-gray-400 hover:text-red-500 transition-colors" title="Delete"><i class="fa-regular fa-trash-can text-[15px]"></i></button>`);
                    cardArr.push('</div>');
                }
                cardArr.push('</div>'); // ปิดแถบด้านบน

                // พื้นที่แสดงรูปภาพ
                cardArr.push('<div class="w-full aspect-[4/5] bg-gray-50 flex flex-col items-center justify-center p-3 relative">');
                cardArr.push(`<img src="${photoUrl}" alt="Announcement" class="w-full h-full object-cover rounded-xl shadow-sm border border-gray-100" onerror="this.onerror=null; this.src='${fallbackImg}';">`);
                cardArr.push('</div>');

                cardArr.push('</div>');

                cardsHtml += cardArr.join('');
            });
        }
        // 👉 โหมดหน้าการ์ด News (ข่าวสาร)
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

                // 🛠️ 1. ดึงข้อมูลรูปภาพ
                let photoUrl = row['photo'] || row['Photo'] || getFuzzyValue(row, ['photo', 'รูป', 'pic', 'image', 'รูปภาพ']) || '';

                // 🛠️ 2. คลีนข้อมูล Base64 และจัดการ Google Drive
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

                // เตรียมรูปโปสเตอร์เริ่มต้น
                let safeTopic = encodeURIComponent(String(topic).substring(0, 20));
                let fallbackImg = `https://ui-avatars.com/api/?background=e0e7ff&color=4f46e5&size=800&font-size=0.1&name=${safeTopic}`;

                if (!photoUrl || photoUrl === '-' || String(photoUrl).trim() === '') {
                    photoUrl = fallbackImg;
                }

                let cardArr = [];

                cardArr.push(`<div onclick="showNewsFromId('${rowId}')" class="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden flex flex-col relative transition-all duration-300 hover:shadow-lg hover:-translate-y-1 cursor-pointer group">`);

                // 🌟 3. แถบด้านบน (แสดง Type, Topic, Audience และปุ่มจัดการ)
                cardArr.push('<div class="flex justify-between items-start px-4 py-3 bg-white z-10 border-b border-gray-50 shrink-0 gap-2">');

                // ฝั่งซ้าย: โชว์ประเภท (Type) สีฟ้า/ม่วง และกลุ่มเป้าหมาย (Audience)
                cardArr.push('<div class="flex flex-col min-w-0">');
                const audColor = String(audience).toLowerCase() === 'public' ? 'text-green-600 bg-green-50' : 'text-amber-600 bg-amber-50';
                const audText = String(audience).toLowerCase() === 'public' ? 'Public (สาธารณะ)' : 'Internal (ภายใน)';
                cardArr.push(`<div class="flex items-center gap-1.5 mb-1 flex-wrap">`);
                cardArr.push(`<span class="text-[9px] font-extrabold text-brandindigo uppercase tracking-wider bg-indigo-50 px-1.5 py-0.5 rounded" title="${escapeHtml(type)}">${escapeHtml(type)}</span>`);
                cardArr.push(`<span class="text-[9px] font-extrabold ${audColor} uppercase tracking-wider px-1.5 py-0.5 rounded" title="${escapeHtml(audText)}">${escapeHtml(audText)}</span>`);
                cardArr.push(`</div>`);
                cardArr.push(`<h3 class="text-sm font-bold text-gray-800 line-clamp-2 leading-snug" title="${escapeHtml(topic)}">${escapeHtml(topic)}</h3>`);
                cardArr.push('</div>');

                // ฝั่งขวา: ปุ่มจัดการ
                if (role !== 'Staff') {
                    cardArr.push('<div class="flex space-x-2 shrink-0 mt-0.5">');
                    cardArr.push(`<button onclick="editNewsFromId('${rowId}', event)" class="text-gray-400 hover:text-brandindigo transition-colors" title="Edit"><i class="fa-regular fa-pen-to-square text-[15px]"></i></button>`);
                    cardArr.push(`<button onclick="event.stopPropagation(); deleteRecord('${rowId}')" class="text-gray-400 hover:text-red-500 transition-colors" title="Delete"><i class="fa-regular fa-trash-can text-[15px]"></i></button>`);
                    cardArr.push('</div>');
                }
                cardArr.push('</div>'); // ปิดแถบด้านบน

                // พื้นที่แสดงรูปภาพ
                cardArr.push('<div class="w-full aspect-[4/5] bg-gray-50 flex flex-col items-center justify-center p-3 relative">');
                cardArr.push(`<img src="${photoUrl}" alt="News Image" class="w-full h-full object-cover rounded-xl shadow-sm border border-gray-100" onerror="this.onerror=null; this.src='${fallbackImg}';">`);
                cardArr.push('</div>');

                cardArr.push('</div>');

                cardsHtml += cardArr.join('');
            });
        }
        // 👇👇 นำโค้ด Policy มาวางแทรกตรงนี้ (ก่อนหน้า Employee Rating) 👇👇

        // 👉 โหมดหน้าการ์ด Policy (นโยบาย)
        // 👉 โหมดหน้าการ์ด Policy (นโยบาย) สไตล์เดียวกับ Assets
        // 👉 โหมดหน้าการ์ด Policy (นโยบาย) สไตล์เดียวกับ Assets + รองรับโลโก้ PDF
        else if (currentSheet.trim() === 'Policy') {
            data.forEach(row => {
                const isEmpty = currentHeaders.every(h => !row[h] || String(row[h]).trim() === '');
                if (isEmpty) return;

                const rowId = getRecordId(row);
                const encodedRow = encodeURIComponent(JSON.stringify(row)).replace(/'/g, "%27");

                let topic = getFuzzyValue(row, ['head_name', 'หัวข้อ', 'ชื่อ']) || 'เอกสารนโยบาย / Policy';
                let fileUrl = getFuzzyValue(row, ['link', 'url', 'ไฟล์', 'document']) || '';
                let originalUrl = fileUrl; // เก็บ URL ต้นฉบับไว้เช็คประเภทไฟล์

                // 🌟 เช็คว่าเป็นไฟล์ PDF หรือไม่
                let isPdf = false;
                if (typeof originalUrl === 'string') {
                    isPdf = originalUrl.toLowerCase().includes('.pdf') || originalUrl.startsWith('data:application/pdf');
                }

                // ถ้าเป็นลิงก์ Google Drive ให้ดึง Thumbnail
                if (fileUrl.includes('drive.google.com/file/d/')) {
                    let fileId = fileUrl.split('/d/')[1].split('/')[0];
                    fileUrl = 'https://drive.google.com/thumbnail?id=' + fileId + '&sz=w1000';
                }

                // เตรียมรูปภาพสำรอง (Fallback)
                let safeTopic = encodeURIComponent(String(topic).substring(0, 15));
                let fallbackImg = `https://ui-avatars.com/api/?background=f8fafc&color=4f46e5&size=800&font-size=0.1&name=${safeTopic}`;

                if (!fileUrl || fileUrl === '-' || String(fileUrl).trim() === '') {
                    fileUrl = fallbackImg;
                }

                let cardArr = [];

                // 🌟 สร้างการ์ด
                cardArr.push(`<div onclick="showPolicyDetail('${encodedRow}')" class="bg-white rounded-3xl shadow-sm border border-gray-200 overflow-hidden flex flex-col relative transition-all duration-300 hover:shadow-xl hover:-translate-y-1 cursor-pointer group p-4 pb-0">`);

                // 🌟 Top Section
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

                // 🌟 Middle Section
                cardArr.push('<div class="mb-4 px-1">');
                cardArr.push(`<h3 class="text-sm font-bold text-gray-900 leading-snug line-clamp-2 group-hover:text-brandindigo transition-colors">${topic}</h3>`);
                cardArr.push('</div>');

                // 🌟 Image Section (แยกกรณี PDF และ รูปภาพ)
                cardArr.push('<div class="w-full mt-auto pb-4">');
                cardArr.push(`<div class="relative w-full aspect-square rounded-[1rem] overflow-hidden border border-gray-100 bg-gray-50 group-hover:shadow-md transition-all flex flex-col items-center justify-center">`);

                if (isPdf) {
                    // ✅ ถ้าเป็น PDF ให้โชว์ไอคอนสีแดงใหญ่ๆ
                    cardArr.push(`<i class="fa-solid fa-file-pdf text-[5rem] text-red-500 group-hover:scale-110 transition-transform mb-3"></i>`);
                    cardArr.push(`<span class="text-[10px] font-bold text-gray-400 uppercase tracking-widest">PDF Document</span>`);
                } else {
                    // ✅ ถ้าเป็นรูป ให้โชว์รูปปกติ
                    cardArr.push(`<div class="absolute inset-0 flex items-center justify-center opacity-[0.03]"><i class="fa-solid fa-book-open text-[8rem] text-brandindigo"></i></div>`);
                    cardArr.push(`<img src="${fileUrl}" alt="Policy Document" class="relative z-10 w-full h-full object-cover" onerror="this.onerror=null; this.src='${fallbackImg}';">`);
                }

                cardArr.push(`</div>`);
                cardArr.push('</div>');

                cardArr.push(`</div>`);
                cardsHtml += cardArr.join('');
            });
        }

        // 👆👆 สิ้นสุดโค้ด Policy 👆👆

        // 👉 โหมดหน้าการ์ด Documents (เอกสาร) สไตล์ Announcements + PDF Logo
        // 👉 โหมดหน้าการ์ด Documents (เอกสาร) สไตล์ Announcements + PDF Logo
        else if (currentSheet.trim() === 'Documents') {
            data.forEach(row => {
                const isEmpty = currentHeaders.every(h => !row[h] || String(row[h]).trim() === '');
                if (isEmpty) return;

                const rowId = getRecordId(row);
                const encodedRow = encodeURIComponent(JSON.stringify(row)).replace(/'/g, "%27");

                let topic = getFuzzyValue(row, ['document_name', 'document name', 'ชื่อเอกสาร', 'หัวข้อ', 'ชื่อ']) || 'เอกสาร / Document';
                let docType = getFuzzyValue(row, ['document_types', 'document types ', 'ประเภท', 'type']) || 'General';

                // 🌟 ดึงข้อมูลไฟล์ (ดึงจากคอลัมน์ Photo โดยตรงด้วยเพื่อความชัวร์)
                let fileUrl = row['Photo'] || row['photo'] || getFuzzyValue(row, ['photo', 'file', 'link', 'url', 'ไฟล์', 'document', 'ไฟล์แนบ']) || '';

                // 🌟 คลีนข้อมูล Base64 (สำคัญมาก! ตัดช่องว่างทิ้งป้องกันรูปล้ม)
                if (typeof fileUrl === 'string' && fileUrl.startsWith('data:')) {
                    fileUrl = fileUrl.replace(/[\r\n\t\s]+/g, "");
                }

                let originalUrl = fileUrl; // เก็บ URL ที่คลีนแล้วไว้

                // 🌟 เช็คว่าเป็นไฟล์ PDF หรือไม่
                let isPdf = false;
                if (typeof originalUrl === 'string') {
                    isPdf = originalUrl.toLowerCase().includes('.pdf') || originalUrl.startsWith('data:application/pdf');
                }

                // ถ้าเป็นลิงก์ Google Drive ดึง Thumbnail
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

                // 🌟 สร้างการ์ด เมื่อคลิกจะเรียก Pop-up
                cardArr.push(`<div onclick="showDocumentDetail('${encodedRow}')" class="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden flex flex-col relative transition-all duration-300 hover:shadow-lg hover:-translate-y-1 cursor-pointer group">`);

                // 🌟 แถบด้านบน (แสดง Type และ Topic)
                cardArr.push('<div class="flex justify-between items-start px-4 py-3 bg-white z-10 border-b border-gray-50 shrink-0 gap-2">');
                cardArr.push('<div class="flex flex-col min-w-0">');
                cardArr.push(`<span class="text-[10px] font-bold text-brandindigo uppercase tracking-widest mb-0.5" title="${docType}">${docType}</span>`);
                cardArr.push(`<h3 class="text-sm font-bold text-gray-800 line-clamp-2 leading-snug" title="${String(topic).replace(/"/g, '&quot;')}">${topic}</h3>`);
                cardArr.push('</div>');

                // ปุ่ม Edit / Delete สำหรับ Admin
                if (role !== 'Staff') {
                    cardArr.push('<div class="flex space-x-2 shrink-0 mt-0.5" onclick="event.stopPropagation()">');
                    cardArr.push(`<button onclick="openFormModal('${encodedRow}')" class="text-gray-400 hover:text-brandindigo transition-colors" title="Edit"><i class="fa-regular fa-pen-to-square text-[15px]"></i></button>`);
                    cardArr.push(`<button onclick="deleteRecord('${rowId}')" class="text-gray-400 hover:text-red-500 transition-colors" title="Delete"><i class="fa-regular fa-trash-can text-[15px]"></i></button>`);
                    cardArr.push('</div>');
                }
                cardArr.push('</div>');

                // 🌟 พื้นที่แสดงรูปภาพ หรือ โลโก้ PDF
                cardArr.push('<div class="w-full aspect-[4/5] bg-gray-50 flex flex-col items-center justify-center p-3 relative">');
                if (isPdf) {
                    // ✅ ถ้าเป็น PDF ให้โชว์ไอคอนสีแดง
                    cardArr.push(`<i class="fa-solid fa-file-pdf text-[5rem] text-red-500 group-hover:scale-110 transition-transform mb-3 drop-shadow-sm"></i>`);
                    cardArr.push(`<span class="text-[10px] font-bold text-gray-500 uppercase tracking-widest bg-white px-3 py-1 rounded-full shadow-sm border border-gray-100">PDF Document</span>`);
                } else {
                    // ✅ ถ้าเป็นรูป ให้โชว์รูป
                    cardArr.push(`<img src="${fileUrl}" alt="Document" class="w-full h-full object-cover rounded-xl shadow-sm border border-gray-100" onerror="this.onerror=null; this.src='${fallbackImg}';">`);
                }
                cardArr.push('</div>');
                cardArr.push('</div>');

                cardsHtml += cardArr.join('');
            });
        }

        // 👉 2. โหมดหน้าการ์ด Employee Rating
        else {
            let empStats = {};

            data.forEach(row => {
                const isEmpty = currentHeaders.every(h => !row[h] || String(row[h]).trim() === '');
                if (isEmpty) return;

                let empId = String(getFuzzyValue(row, ['employees id', 'emp_id', 'employee_id'])).toUpperCase().trim();
                if (!empId || empId === '-') return;

                let empName = getFuzzyValue(row, ['employees name', 'name', 'ชื่อ', 'employee', 'พนักงาน']) || 'Unknown';
                let categoryRaw = getFuzzyValue(row, ['category', 'หมวดหมู่']);
                let category = categoryRaw && categoryRaw !== '-' ? String(categoryRaw).trim() : '-';
                let comment = getFuzzyValue(row, ['comment', 'review', 'ความคิดเห็น', 'ข้อเสนอแนะ', 'remark']);
                let starPoint = parseFloat(getFuzzyValue(row, ['star point', 'star_point', 'ดาว', 'rating', 'score'])) || 0;
                let dateStr = getFuzzyValue(row, ['ranting date', 'date', 'วันที่', 'เดือน']);
                let position = getFuzzyValue(row, ['position', 'ตำแหน่ง']) || 'Staff';

                let rowId = getRecordId(row);
                let encodedRow = encodeURIComponent(JSON.stringify(row)).replace(/'/g, "%27");

                if (!empStats[empId]) {
                    empStats[empId] = {
                        empId: empId,
                        empName: empName,
                        position: position,
                        categoryScores: {},
                        latestComment: '-',
                        latestDate: '-',
                        latestRowId: rowId,
                        latestEncodedRow: encodedRow
                    };
                }

                if (category && category !== '-') {
                    let currentStars = empStats[empId].categoryScores[category] || 0;
                    let newStars = currentStars + starPoint;
                    if (newStars > 5) newStars = 5;
                    empStats[empId].categoryScores[category] = newStars;
                }

                if (comment && comment !== '-') empStats[empId].latestComment = comment;
                if (dateStr && dateStr !== '-') empStats[empId].latestDate = dateStr;
                empStats[empId].latestRowId = rowId;
                empStats[empId].latestEncodedRow = encodedRow;
            });

            Object.values(empStats).forEach(emp => {
                let dept = 'General';
                let safeNameUrl = encodeURIComponent(emp.empName).replace(/'/g, "%27");
                let picUrlArray = ['https://ui-avatars.com/api/?background=e0e7ff&color=4f46e5&name=', safeNameUrl, '&bold=true'];
                let picUrl = picUrlArray.join('');

                let staffSheetKey = Object.keys(tableCache).find(k =>
                    (k.toLowerCase().includes('staff') || k.toLowerCase().includes('directory') || k.toLowerCase().includes('พนักงาน')) &&
                    !k.toLowerCase().includes('rating') &&
                    !k.toLowerCase().includes('ranting')
                );
                if (!staffSheetKey && tableCache['staff']) staffSheetKey = 'staff';
                if (!staffSheetKey && tableCache['Staff']) staffSheetKey = 'Staff';
                if (!staffSheetKey && tableCache['Staff Directory']) staffSheetKey = 'Staff Directory';

                if (staffSheetKey && tableCache[staffSheetKey]) {
                    let staffRow = tableCache[staffSheetKey].data.find(r => String(getFuzzyValue(r, ['employee_id', 'emp_id', 'รหัสพนักงาน'])).toUpperCase().trim() === emp.empId);
                    if (staffRow) {
                        let fetchedPic = getFuzzyValue(staffRow, ['photos', 'profile', 'รูป', 'pic', 'image', 'รูปภาพ']);
                        if (fetchedPic && fetchedPic !== '-') {
                            if (fetchedPic.includes('drive.google.com')) {
                                let fileId = '';
                                if (fetchedPic.includes('id=')) fileId = fetchedPic.split('id=')[1].split('&')[0];
                                else if (fetchedPic.includes('/d/')) fileId = fetchedPic.split('/d/')[1].split('/')[0];
                                if (fileId) fetchedPic = 'https://drive.google.com/thumbnail?id=' + fileId + '&sz=w500';
                            }
                            picUrl = fetchedPic;
                        }
                        let fetchedPos = getFuzzyValue(staffRow, ['position', 'ตำแหน่ง', 'position_id']);
                        if (fetchedPos && fetchedPos !== '-') emp.position = fetchedPos;
                    }
                }

                let totalCats = Object.keys(emp.categoryScores).length;
                let sumAllStars = 0;
                Object.values(emp.categoryScores).forEach(val => sumAllStars += val);
                let avgStar = totalCats > 0 ? (sumAllStars / 10) : 0;

                let starsArray = [];
                for (let i = 1; i <= 5; i++) {
                    if (i <= avgStar) starsArray.push('<i class="fa-solid fa-star text-[#FACC15] text-2xl mx-1.5 drop-shadow-sm"></i>');
                    else if (i - 0.5 <= avgStar) starsArray.push('<i class="fa-solid fa-star-half-stroke text-[#FACC15] text-2xl mx-1.5 drop-shadow-sm"></i>');
                    else starsArray.push('<i class="fa-regular fa-star text-gray-200 text-2xl mx-1.5"></i>');
                }
                let starsHtml = starsArray.join('');

                const allCategories = [
                    'ตรงต่อเวลา', 'ทำยอดขายได้ดี', 'ช่วยเหลือเพื่อนร่วมงาน', 'บริการลูกค้าดี',
                    'ทำงานเป็นทีม', 'แก้ปัญหาได้ดี', 'ทำงานเกินเป้าหมาย', 'สร้างไอเดียใหม่',
                    'ไม่ขาดงาน', 'พนักงานดีเด่นประจำเดือน'
                ];

                Object.keys(emp.categoryScores).forEach(c => {
                    let isExist = allCategories.some(base => base.toLowerCase() === c.toLowerCase());
                    if (!isExist) allCategories.unshift(c);
                });

                let skillsHtmlArray = [];
                allCategories.forEach(skillName => {
                    let catStars = emp.categoryScores[skillName] || 0;
                    let displayVal = catStars * 20;

                    // ปรับสีให้ดูทันสมัยและเป็นทางการมากขึ้น
                    let barColor = displayVal > 0 ? 'bg-gradient-to-r from-brandindigo to-brandpurple' : 'bg-gray-200';
                    let textColor = displayVal > 0 ? 'text-gray-700 font-bold' : 'text-gray-400 font-medium';
                    let safeSkillName = String(skillName).replace(/"/g, '&quot;');

                    skillsHtmlArray.push('<div class="flex items-center justify-between text-xs mb-3">');
                    skillsHtmlArray.push('<span class="w-[45%] ', textColor, ' truncate" title="', safeSkillName, '">', skillName, '</span>');
                    skillsHtmlArray.push('<div class="w-[45%] h-1.5 bg-gray-100 flex-1 mx-3 overflow-hidden rounded-full shadow-inner">');
                    skillsHtmlArray.push('<div class="h-full ', barColor, ' transition-all duration-1000 rounded-full" style="width: ', displayVal, '%;"></div>');
                    skillsHtmlArray.push('</div>');
                    skillsHtmlArray.push('<span class="w-[10%] text-right text-gray-500 font-bold text-[10px]">', displayVal, '%</span>');
                    skillsHtmlArray.push('</div>');
                });
                let skillsHtml = skillsHtmlArray.join('');

                let safeRowId = String(emp.latestRowId).replace(/'/g, "\\'").replace(/"/g, '&quot;');
                let fallbackArray = ['https://ui-avatars.com/api/?background=fef08a&color=a16207&name=', safeNameUrl, '&bold=true'];
                let safeFallbackSrc = fallbackArray.join('');
                let safeCommentAttr = String(emp.latestComment).replace(/"/g, '&quot;');

                let decodedLatest = JSON.parse(decodeURIComponent(emp.latestEncodedRow));
                if (currentHeaders && currentHeaders.length > 0) {
                    decodedLatest[currentHeaders[0]] = '';
                }

                let ratingKeysToClear = ['ranting_id', 'ranting id', 'rating_id', 'rating id', 'id_leave', 'leave_id', 'log_id', 'asset_id', 'course_id', 'star point', 'star_point', 'ดาว', 'rating', 'score', 'category', 'หมวดหมู่', 'comment', 'review', 'ความคิดเห็น', 'ข้อเสนอแนะ', 'remark', 'date', 'วันที่', 'เดือน', 'ranting date'];
                Object.keys(decodedLatest).forEach(actualKey => {
                    if (ratingKeysToClear.includes(actualKey.toLowerCase().trim())) {
                        decodedLatest[actualKey] = '';
                    }
                });
                let safeAddRatingEncodedRow = encodeURIComponent(JSON.stringify(decodedLatest)).replace(/'/g, "%27");

                let adminActionsArray = [];
                if (role !== 'Staff') {
                    let safeNameForJS = String(emp.empName).replace(/'/g, "\\'").replace(/"/g, '&quot;');
                    adminActionsArray.push('<div class="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity bg-white/20 backdrop-blur-md rounded-xl shadow-lg p-1.5 flex space-x-1 z-20 border border-white/30">');
                    adminActionsArray.push('<button onclick="showRatingHistory(\'' + emp.empId + '\', \'' + safeNameForJS + '\')" class="text-white hover:bg-blue-500 w-8 h-8 rounded-lg flex items-center justify-center transition-colors font-bold" title="ดูประวัติผู้ให้ดาว"><i class="fa-solid fa-clock-rotate-left"></i></button>');
                    adminActionsArray.push('<button onclick="openFormModal(\'' + safeAddRatingEncodedRow + '\')" class="text-white hover:bg-emerald-500 w-8 h-8 rounded-lg flex items-center justify-center transition-colors font-bold" title="เพิ่มดาว / ประเมินหัวข้อใหม่"><i class="fa-solid fa-plus"></i></button>');
                    adminActionsArray.push('<button onclick="openFormModal(\'' + emp.latestEncodedRow + '\')" class="text-white hover:bg-white/30 w-8 h-8 rounded-lg flex items-center justify-center transition-colors" title="แก้ไขผลประเมินล่าสุด"><i class="fa-solid fa-pen-to-square"></i></button>');
                    adminActionsArray.push('<button onclick="deleteRecord(\'' + safeRowId + '\')" class="text-white hover:bg-red-500 hover:text-white w-8 h-8 rounded-lg flex items-center justify-center transition-colors" title="ลบผลประเมินล่าสุด"><i class="fa-solid fa-trash"></i></button>');
                    adminActionsArray.push('</div>');
                }
                let adminActions = adminActionsArray.join('');

                let commentHtmlArray = [];
                if (emp.latestComment !== '-') {
                    commentHtmlArray.push('<div class="px-8 text-[12px] text-gray-400 italic text-center mt-auto pb-2" title="', safeCommentAttr, '">');
                    commentHtmlArray.push('"', emp.latestComment, '"');
                    commentHtmlArray.push('</div>');
                }
                let commentHtml = commentHtmlArray.join('');

                let cardArray = [];
                // 1. ปรับกรอบการ์ดให้มนพอดีๆ (rounded-3xl) ขอบคลีนสะอาดตาขึ้น
                cardArray.push('<div class="bg-white rounded-3xl hover:shadow-xl transition-all duration-300 overflow-hidden flex flex-col group relative transform hover:-translate-y-1 border border-gray-200 w-full max-w-[360px] mx-auto pb-5">');

                cardArray.push(adminActions);

                // 2. ส่วนบน: ใช้สีจากดีไซน์เว็บ (brandindigo -> brandpurple) และลดความสูงลงให้ดูโมเดิร์น ไม่หนาเทอะทะ
                cardArray.push('<div class="h-[100px] w-full bg-gradient-to-r from-brandindigo to-brandpurple relative z-0 shadow-sm"></div>');

                // 3. รูปโปรไฟล์: ปรับขนาดและระยะเยื้องขึ้นบนให้ออกมาสมดุล ดูเป็นระเบียบเรียบร้อย
                cardArray.push('<div class="relative -mt-[50px] flex justify-center z-10">');
                cardArray.push('<div class="w-[100px] h-[100px] rounded-full border-4 border-white overflow-hidden bg-gray-50 shadow-md">');
                cardArray.push('<img src="', picUrl, '" onerror="this.src=\'' + safeFallbackSrc + '\'" class="w-full h-full object-cover" alt="Profile">');
                cardArray.push('</div></div>');

                // 4. ข้อมูลพนักงาน: ใช้ฟอนต์มาตรฐานที่ดูสะอาดตา จัดระเบียบป้ายกำกับ
                cardArray.push('<div class="text-center px-6 mt-3">');
                cardArray.push('<h2 class="text-xl font-bold text-gray-900 mb-1.5 tracking-tight">', emp.empName, '</h2>');
                cardArray.push('<div class="flex items-center justify-center gap-2">');
                cardArray.push('<span class="text-[10px] font-bold text-brandindigo bg-indigo-50 px-2 py-0.5 rounded border border-indigo-100 uppercase tracking-widest">', emp.position, '</span>');
                cardArray.push('<span class="text-[11px] text-gray-400 font-medium">ID: ', emp.empId, '</span>');
                cardArray.push('<button onclick="showEmpQRCode(\'', emp.empId, '\', \'', safeNameUrl, '\')" class="text-gray-400 hover:text-brandindigo transition-colors ml-1" title="สร้าง QR Code"><i class="fa-solid fa-qrcode"></i></button>');
                cardArray.push('</div>');
                cardArray.push('</div>');

                // 5. ดาวประเมิน: รวมไว้ในกล่องสีเทาอ่อนให้ดูเป็นสัดส่วน
                cardArray.push('<div class="flex justify-center items-center mt-5 mb-5 bg-gray-50/50 py-2.5 mx-6 rounded-xl border border-gray-100" title="Overall Average Rating">');
                cardArray.push(starsHtml);
                cardArray.push('</div>');

                // 6. หลอดคะแนน
                cardArray.push('<div class="px-7 flex-1 flex flex-col justify-center">');
                cardArray.push(skillsHtml);
                cardArray.push('</div>');

                // 7. กล่องคอมเมนต์
                if (emp.latestComment !== '-') {
                    cardArray.push('<div class="px-6 mt-4">');
                    cardArray.push('<div class="text-xs text-gray-500 italic text-center bg-gray-50 p-3 rounded-xl border border-gray-100" title="', safeCommentAttr, '">');
                    cardArray.push('<i class="fa-solid fa-quote-left text-gray-300 mr-1.5"></i>', emp.latestComment, '<i class="fa-solid fa-quote-right text-gray-300 ml-1.5"></i>');
                    cardArray.push('</div></div>');
                } else {
                    // ใส่ช่องว่างไว้ดัน layout ให้เท่ากันกรณีไม่มีคอมเมนต์
                    cardArray.push('<div class="mt-4"></div>');
                }

                cardArray.push('</div>');

                cardsHtml += cardArray.join('');
            });
        }


        cardWrapper.innerHTML = cardsHtml;
        return;

    } else {
        tableWrapper.classList.remove('hidden');
        cardWrapper.classList.add('hidden');


        // 🛠️ เพิ่มคำสั่งซ่อนปุ่มสแกน QR ให้ชัวร์ๆ ในหน้าตารางอื่นๆ ทั้งหมด
        let qrBtn = document.getElementById('qr-scan-btn');
        if (qrBtn) {
            qrBtn.style.display = 'none';
        }
    }
    if (!currentHeaders.length) {
        tBody.innerHTML = '<tr><td colspan="100%" class="text-center py-12 text-gray-400 font-bold tracking-widest uppercase">NO DATA FOUND</td></tr>';
        return;
    }

    let trHead = '<tr>';
    currentHeaders.forEach(h => {
        const isPhotoColumn = /^(photo|photos|profile|pic|image)$/i.test(String(h).trim());
        let displayH = (currentSheet.toLowerCase() === 'user' && (h.toLowerCase().trim() === 'user name' || h.toLowerCase().trim() === 'username')) ? 'EMAIL' : h;
        trHead += `<th class="px-6 py-4 whitespace-nowrap font-bold tracking-widest text-gray-500 ${isPhotoColumn ? 'w-28 text-center' : ''}">${displayH}</th>`;
    });
    if (role !== 'Staff') trHead += `<th class="px-6 py-4 whitespace-nowrap text-center sticky right-0 bg-gray-50 z-10 shadow-[-10px_0_15px_-5px_rgba(0,0,0,0.05)] border-l border-gray-200 print-hide text-gray-500 font-bold tracking-widest">Action</th>`;
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



/* =====================================================================
 * 📌 ส่วนที่ 18: DATA ENTRY FORM (ฟังก์ชันฟอร์มเพิ่ม/แก้ไขข้อมูล)
 * - เปิดฟอร์มเพื่อกรอกข้อมูลหรือแก้ไขข้อมูลพนักงาน/การเข้างาน/ตารางกะ ฯลฯ
 * ===================================================================== */
function getRatingFormValue(rowData, names) {
    for (const name of names) {
        const found = Object.keys(rowData || {}).find(k => String(k).toLowerCase().trim() === String(name).toLowerCase().trim());
        if (found && rowData[found] !== undefined && rowData[found] !== null) return rowData[found];
    }
    return '';
}

function getRatingCategories() {
    return ['ตรงต่อเวลา', 'ทำยอดขายได้ดี', 'ช่วยเหลือเพื่อนร่วมงาน', 'บริการลูกค้าดี', 'ทำงานเป็นทีม', 'แก้ปัญหาได้ดี', 'ทำงานเกินเป้าหมาย', 'สร้างไอเดียใหม่', 'ไม่ขาดงาน', 'พนักงานดีเด่นประจำเดือน'];
}

// 🛠️ 1. อัปเดตฟังก์ชันสร้างฟอร์มให้แข็งแรงขึ้น (รองรับกรณีฟอร์มเปล่า 100%)
function renderEmployeeRatingForm(rowData = {}) {
    try {
        // ดึงค่าอย่างปลอดภัย ป้องกัน Error พังหน้าจอ
        const safeGet = (names) => {
            for (const name of names) {
                const found = Object.keys(rowData || {}).find(k => String(k).toLowerCase().trim() === String(name).toLowerCase().trim());
                if (found && rowData[found] !== undefined && rowData[found] !== null) return rowData[found];
            }
            return '';
        };

        const ratingId = safeGet(['Ranting_Id', 'rating_id']) || '';
        const empId = safeGet(['Employees Id', 'employee_id', 'emp_id']) || '';
        const empName = safeGet(['Employees Name', 'employee_name', 'first_name', 'name']) || '';
        const ratingDate = safeGet(['Ranting Date', 'rating_date', 'date']) || new Date().toISOString().slice(0, 10);
        const starPoint = parseInt(safeGet(['Star Point', 'star_point', 'rating', 'score'])) || 0;
        const category = safeGet(['Category ', 'category']) || '';
        const comment = safeGet(['Comment', 'comment', 'remark']) || '';
        const giveBy = safeGet(['Give By', 'give_by']) || '';
        const status = safeGet(['Status', 'status']) || 'Active';

        const allCats = ['ตรงต่อเวลา', 'ทำยอดขายได้ดี', 'ช่วยเหลือเพื่อนร่วมงาน', 'บริการลูกค้าดี', 'ทำงานเป็นทีม', 'แก้ปัญหาได้ดี', 'ทำงานเกินเป้าหมาย', 'สร้างไอเดียใหม่', 'ไม่ขาดงาน', 'พนักงานดีเด่นประจำเดือน'];
        const categoryTagsHtml = allCats.map(c => {
            const escaped = String(c).replace(/'/g, "\\'");
            return `<span class="cursor-pointer text-[11px] px-2.5 py-1 rounded-full bg-white text-gray-700 hover:bg-brandindigo hover:text-white transition-all font-medium border border-gray-200 shadow-sm" onclick="document.getElementById('rating-category-input').value='${escaped}'">${c}</span>`;
        }).join('');

        const formFields = document.getElementById('form-fields');

        // สร้างโครงสร้างฟอร์ม HTML
        formFields.innerHTML = `
                    <input type="hidden" name="Ranting_Id" value="${String(ratingId).replace(/"/g, '&quot;')}">
                    <input type="hidden" name="Status" value="${String(status).replace(/"/g, '&quot;')}">
                    
                    <div class="col-span-1 sm:col-span-2 bg-indigo-50/60 p-5 rounded-2xl border border-indigo-100 mb-2">
                        <label class="block mb-2 text-xs font-bold text-gray-700 uppercase tracking-wider">รหัสพนักงาน (EMPLOYEES ID) <span class="text-brandindigo">*</span></label>
                        <select id="rating-employee-select" name="Employees Id" required onchange="if(typeof onRatingEmployeeSelected === 'function') onRatingEmployeeSelected(this.value)" class="bg-white border border-gray-300 text-gray-900 text-sm rounded-xl focus:ring-brandindigo focus:border-brandindigo block w-full p-3 transition-colors shadow-sm">
                            <option value="${String(empId).replace(/"/g, '&quot;')}" selected>${empId ? empId : 'Loading staff...'}</option>
                        </select>
                    </div>
                    
                    <div><label class="block mb-2 text-xs font-bold text-gray-700 uppercase tracking-wider">ชื่อพนักงาน (NAME) <span class="text-brandindigo">*</span></label><input id="rating-employee-name" type="text" name="Employees Name" value="${String(empName).replace(/"/g, '&quot;')}" required readonly class="bg-gray-50 border border-gray-300 text-gray-600 text-sm rounded-xl block w-full p-3 shadow-sm cursor-not-allowed"></div>
                    
                    <div><label class="block mb-2 text-xs font-bold text-gray-700 uppercase tracking-wider">วันที่ประเมิน (DATE) <span class="text-brandindigo">*</span></label><input type="date" name="Ranting Date" value="${String(ratingDate).slice(0, 10)}" required class="bg-white border border-gray-300 text-gray-900 text-sm rounded-xl focus:ring-brandindigo focus:border-brandindigo block w-full p-3 transition-colors shadow-sm"></div>
                    
                    <div class="col-span-1 sm:col-span-2"><label class="block mb-2 text-xs font-bold text-gray-700 uppercase tracking-wider">คะแนนดาว (STAR POINT) <span class="text-brandindigo">*</span></label><div class="flex flex-col items-center justify-center bg-gray-50 p-4 rounded-xl border border-gray-200 min-h-[88px]"><div class="flex">${[1, 2, 3, 4, 5].map(i => `<i class="${i <= starPoint ? 'fa-solid fa-star text-yellow-400' : 'fa-regular fa-star text-gray-300'} text-4xl cursor-pointer hover:scale-110 transition-transform mx-1" onclick="if(typeof setFormStarRating === 'function') setFormStarRating(${i})" id="form-star-${i}"></i>`).join('')}</div><p id="form-star-text" class="mt-2 text-sm font-bold text-brandindigo">${starPoint > 0 ? starPoint + ' / 5' : 'คลิกเพื่อให้คะแนน'}</p></div><input type="hidden" name="Star Point" id="hidden-star-input" value="${starPoint || ''}" required></div>
                    
                    <div>
                        <label class="block mb-2 text-xs font-bold text-gray-700 uppercase tracking-wider">หมวดหมู่ (CATEGORY) <span class="text-brandindigo">*</span></label>
                        <input type="text" id="rating-category-input" name="Category " value="${String(category).replace(/"/g, '&quot;')}" required
                            class="bg-white border border-gray-300 text-gray-900 text-sm rounded-xl focus:ring-brandindigo focus:border-brandindigo block w-full p-3 transition-colors shadow-sm"
                            placeholder="พิมพ์หมวดหมู่ หรือกดเลือกจากแถบด้านล่าง...">
                        <div class="mt-2 flex flex-wrap gap-1.5 max-h-[85px] overflow-y-auto p-1 bg-gray-50 rounded-xl border border-gray-100">
                            ${categoryTagsHtml}
                        </div>
                    </div>
                    
                    <div><label class="block mb-2 text-xs font-bold text-gray-700 uppercase tracking-wider">ข้อเสนอแนะ (COMMENT) <span class="text-brandindigo">*</span></label><input type="text" name="Comment" value="${String(comment).replace(/"/g, '&quot;')}" required placeholder="คำชมเชย / ข้อเสนอแนะ..." class="bg-white border border-gray-300 text-gray-900 text-sm rounded-xl focus:ring-brandindigo focus:border-brandindigo block w-full p-3 transition-colors shadow-sm"></div>
                    
                    <div class="col-span-1 sm:col-span-2"><label class="block mb-2 text-xs font-bold text-gray-700 uppercase tracking-wider">ผู้ประเมิน (GIVE BY) <span class="text-brandindigo">*</span></label><select id="rating-give-by-select" name="Give By" required class="bg-white border border-gray-300 text-gray-900 text-sm rounded-xl focus:ring-brandindigo focus:border-brandindigo block w-full p-3 transition-colors shadow-sm"><option value="${String(giveBy).replace(/"/g, '&quot;')}" selected>${giveBy ? giveBy : 'Loading evaluators...'}</option></select></div>
                `;

        // โหลดตัวเลือกพนักงานและผู้บริหารใส่ Dropdown ให้สมบูรณ์
        if (typeof loadRatingStaffOptions === 'function') {
            loadRatingStaffOptions(empId, giveBy);
        }
    } catch (err) {
        console.error("Error generating form:", err);
        // แสดงสาเหตุของ Error ให้ชัดเจนขึ้น
        document.getElementById('form-fields').innerHTML = `<div class="col-span-full text-center p-4"><p class="text-red-500 font-bold mb-2">เกิดข้อผิดพลาดในการสร้างฟอร์ม</p><p class="text-xs text-gray-500">Error: ${err.message}</p></div>`;
    }
}
// ==========================================
// 🛠️ ฟังก์ชันตัวช่วยสำหรับฟอร์ม Rating (โหลดตัวเลือกพนักงาน และผู้ประเมิน)
// ==========================================
function loadRatingStaffOptions(selectedEmpId, selectedGiveBy) {
    const staffCache = tableCache['staff'] || tableCache['Staff'];
    if (staffCache && staffCache.data && staffCache.data.length > 0) {
        populateRatingDropdowns(staffCache.data, selectedEmpId, selectedGiveBy);
    } else {
        google.script.run.withSuccessHandler(res => {
            if (res && res.success && res.data) {
                tableCache['staff'] = { headers: res.headers || [], data: res.data };
                populateRatingDropdowns(res.data, selectedEmpId, selectedGiveBy);
            }
        }).getSheetData('staff');
    }
}

function populateRatingDropdowns(staffData, selectedEmpId, selectedGiveBy) {
    const empSelect = document.getElementById('rating-employee-select');
    const giveBySelect = document.getElementById('rating-give-by-select');

    let empOptions = `<option value="" disabled ${!selectedEmpId ? 'selected' : ''}>เลือกพนักงาน...</option>`;
    let giveByOptions = `<option value="" disabled ${!selectedGiveBy ? 'selected' : ''}>เลือกผู้ประเมิน...</option>`;
    let giveByManagerOptions = '';
    let foundGiveBy = false;

    staffData.forEach(row => {
        // ตัวเลือก Employees ID
        let eId = String(getFuzzyValue(row, ['employee_id', 'emp_id'])).toUpperCase().trim();
        let name = getFuzzyValue(row, ['first_name', 'name', 'full_name', 'ชื่อ']);
        let lastName = getFuzzyValue(row, ['last_name', 'นามสกุล']);
        let fullName = name !== '-' ? (lastName !== '-' ? name + ' ' + lastName : name) : 'Unknown';

        if (eId && eId !== '-') {
            empOptions += `<option value="${eId}" ${eId === selectedEmpId ? 'selected' : ''}>${eId} - ${fullName}</option>`;
        }

        // ตัวเลือก Give By (คัดเฉพาะผู้ประเมิน/หัวหน้า)
        let posKey = Object.keys(row).find(k => ['position', 'position_id', 'ตำแหน่ง'].includes(k.toLowerCase().trim()));
        let pos = posKey ? String(row[posKey]).toLowerCase() : '';

        let isManager = pos.includes('ceo') || pos.includes('сео') ||
            pos.includes('coo') || pos.includes('соо') ||
            pos.includes('cfo') || pos.includes('сfо') || pos.includes('cfо') ||
            pos.includes('manager') || pos.includes('head') ||
            pos.includes('ผู้บริหาร') || pos.includes('admin') ||
            pos.includes('director') || pos.includes('ผู้อำนวยการ');
        if (isManager) {
            let displayPos = posKey ? row[posKey] : '';
            giveByManagerOptions += `<option value="${fullName}" ${fullName === selectedGiveBy ? 'selected' : ''}>${fullName}${displayPos ? ' (' + displayPos + ')' : ''}</option>`;
            foundGiveBy = true;
        }
    });

    // ถ้าไม่เจอผู้บริหาร ให้ใช้พนักงานทั้งหมด
    if (!foundGiveBy) {
        staffData.forEach(row => {
            let name = getFuzzyValue(row, ['first_name', 'name', 'full_name', 'ชื่อ']);
            let lastName = getFuzzyValue(row, ['last_name', 'นามสกุล']);
            let fullName = name !== '-' ? (lastName !== '-' ? name + ' ' + lastName : name) : '';
            if (fullName) giveByManagerOptions += `<option value="${fullName}" ${fullName === selectedGiveBy ? 'selected' : ''}>${fullName}</option>`;
        });
    }
    giveByOptions += giveByManagerOptions;

    if (empSelect) empSelect.innerHTML = empOptions;
    if (giveBySelect) giveBySelect.innerHTML = giveByOptions;

    if (selectedEmpId) autoFillEmployeeData(selectedEmpId);
}

function onRatingEmployeeSelected(empId) {
    if (empId) autoFillEmployeeData(empId);
}

// 🛠️ 2. อัปเดตฟังก์ชันเปิดหน้าต่าง ให้ป้องกัน Error ล่องหน
function openFormModal(rowDataStr = null) {
    editingRecordId = null;
    let rowData = {};

    const sessionStr = localStorage.getItem('hr_user_session') || sessionStorage.getItem('hr_user_session');
    let role = 'Staff';
    let loggedInEmpId = '';

    if (sessionStr) {
        try {
            const sessionData = JSON.parse(sessionStr);
            role = sessionData.role || 'Staff';
            loggedInEmpId = String(sessionData.empId || '').toLowerCase().trim();
        } catch (e) { }
    }

    // 🌟 ระบบตรวจสอบสถานะฟอร์ม (Add หรือ Edit)
    if (rowDataStr && typeof rowDataStr === 'string') {
        try {
            rowData = JSON.parse(decodeURIComponent(rowDataStr));
            editingRecordId = getRecordId(rowData);

            // 👉 เช็คว่าเป็นข้อมูลใหม่จากการแสกน QR หรือไม่ (ดูจาก Ranting_Id ที่เราจงใจตั้งให้เป็นค่าว่าง)
            let isNewFromQR = rowData['Ranting_Id'] === '' || rowData['rating_id'] === '';

            // ถ้ามี ID จริงๆ และไม่ใช่ข้อมูลจาก QR ให้เปิดโหมดแก้ไข
            if (editingRecordId && !isNewFromQR && String(editingRecordId).trim() !== '' && !String(editingRecordId).startsWith('NEW-')) {
                document.getElementById('modal-title').innerHTML = `<i class="fa-solid fa-pen-to-square text-brandindigo mr-3"></i> Edit Record`;
            } else {
                document.getElementById('modal-title').innerHTML = `<i class="fa-solid fa-plus text-brandindigo mr-3"></i> Add Record`;
                editingRecordId = null; // บังคับให้เป็นโหมด Add Record
            }
        } catch (err) {
            rowData = {};
            document.getElementById('modal-title').innerHTML = `<i class="fa-solid fa-plus text-brandindigo mr-3"></i> Add Record`;
        }
    } else {
        document.getElementById('modal-title').innerHTML = `<i class="fa-solid fa-plus text-brandindigo mr-3"></i> Add Record`;
    }

    const formFields = document.getElementById('form-fields');
    formFields.innerHTML = '';
    currentHeaders = ensureHeadersForSheet(currentSheet, currentHeaders);
    // วาดฟอร์มให้ดาวพนักงาน
    if (isEmployeeRatingSheet(currentSheet)) {
        renderEmployeeRatingForm(rowData);
        document.getElementById('form-modal').classList.remove('hidden');
        return;
    }

    // ... (โค้ดลูปสร้างฟอร์มของตารางอื่นๆ ปล่อยไว้เหมือนเดิมครับ ไม่ต้องไปยุ่งกับมัน)

    currentHeaders.forEach((h, index) => {
        const lw = h.toLowerCase().trim();

        if (lw === 'signature') return;
        if (lw === 'status' && currentSheet.toLowerCase() !== 'staff' && currentSheet.toLowerCase() !== 'training') return;



        const val = rowData ? (rowData[h] || '') : '';
        const safeVal = String(val).replace(/"/g, '&quot;');
        // 📌 1. ซ่อนคอลัมน์ Ranking และ Reward Level ให้เป็น Hidden
        if (currentSheet.toLowerCase() === 'staff' && (lw === 'ranking' || lw === 'reward level' || lw === 'reward_level')) {
            formFields.insertAdjacentHTML('beforeend', `<input type="hidden" name="${h}" value="${safeVal}">`);
            return;
        }

        // 📌 1. ระบบ Checkbox สิทธิ์การเข้าถึง (เฉพาะชีท user)
        if ((lw === 'permissions' || lw === 'สิทธิ์' || lw === 'สิทธิ์การเข้าถึง') && currentSheet.toLowerCase() === 'user') {
            const allMenus = [
                { id: 'dashboard', name: 'Dashboard (หน้าหลัก)' },
                { id: 'scan', name: 'Time Tracking (ลงเวลา)' },
                { id: 'Leave application', name: 'Leave Requests (คำขอลา)' },
                { id: 'Budget Request', name: 'Budget Requests (ขออนุมัติงบ)' },
                { id: 'Fingerprint_Logs', name: 'Attendance Logs (ประวัติลงเวลา)' },
                { id: 'staff', name: 'Staff Directory (รายชื่อพนักงาน)' },
                { id: 'digital-card', name: 'Digital Card (บัตรพนักงาน)' },
                { id: 'Organization ', name: 'Organization (ข้อมูลองค์กร)' },
                { id: 'Organization Structure ', name: 'Org Structure (แผนผัง)' },
                { id: 'Department ', name: 'Department (แผนก)' },
                { id: 'Asset_Tracking', name: 'Assets (ทรัพย์สิน)' },
                { id: 'Announcements', name: 'Announcements (ประกาศ)' },
                { id: 'Documents ', name: 'Documents (เอกสาร)' },
                { id: 'Training', name: 'Training (การฝึกอบรม)' },
                { id: 'Orentation ', name: 'Orientation (ปฐมนิเทศ)' },
                { id: 'Policy ', name: 'Policy (นโยบาย)' },
                { id: 'user', name: 'Users Management (จัดการผู้ใช้งาน)' },
                { id: 'Employees Ranting ', name: 'Employee Rating (ประเมินพนักงาน)' },
                { id: 'KPI Records ', name: 'KPI Records (บันทึก KPI)' }
            ];

            // ปรับค่าเดิมให้เป็นตัวพิมพ์เล็กทั้งหมดเพื่อแก้บั๊กเช็คไม่ติด
            let checkedValues = val ? val.split(',').map(v => String(v).trim().toLowerCase()) : [];

            let checkboxesHtml = `
                        <div class="col-span-1 sm:col-span-2 bg-indigo-50/30 p-5 rounded-2xl border border-indigo-100 mt-2 mb-2">
                            <label class="block mb-4 text-sm font-bold text-brandindigo uppercase tracking-wider"><i class="fa-solid fa-user-shield mr-2"></i> กำหนดสิทธิ์ฟังก์ชันให้ผู้ใช้งาน</label>
                            <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 max-h-60 overflow-y-auto custom-scrollbar p-3 bg-white rounded-xl border border-gray-200 shadow-inner">`;

            allMenus.forEach(menu => {
                let isChecked = checkedValues.includes(String(menu.id).toLowerCase()) ? 'checked' : '';
                checkboxesHtml += `
                            <label class="flex items-center space-x-3 cursor-pointer group hover:bg-indigo-50 p-2.5 rounded-lg transition-colors border border-transparent hover:border-indigo-100">
                                <input type="checkbox" name="${h}" value="${menu.id}" class="w-5 h-5 rounded border-gray-300 text-brandindigo focus:ring-brandindigo transition-colors shadow-sm" ${isChecked}> 
                                <span class="text-xs font-bold text-gray-700 group-hover:text-brandindigo transition-colors">${menu.name}</span>
                            </label>`;
            });

            checkboxesHtml += `</div></div>`;
            formFields.insertAdjacentHTML('beforeend', checkboxesHtml);
            return;
        }

        // 📌 2. Dropdown เลือกระดับผู้ใช้งาน (Role) เฉพาะหน้า User
        if (lw === 'role' && currentSheet.toLowerCase() === 'user') {
            formFields.insertAdjacentHTML('beforeend', `
                        <div><label class="block mb-2 text-xs font-bold text-gray-700 uppercase tracking-wider">${h} <span class="text-brandindigo">*</span></label>
                        <select name="${h}" required class="bg-white border border-gray-300 text-gray-900 text-sm rounded-xl focus:ring-brandindigo focus:border-brandindigo block w-full p-3 transition-colors shadow-sm">
                            <option value="" disabled ${!val ? 'selected' : ''}>Select Role...</option>
                            <option value="Admin" ${val === 'Admin' ? 'selected' : ''}>Admin (ผู้ดูแลระบบสูงสุด)</option>
                            <option value="HR Manager" ${val === 'HR Manager' ? 'selected' : ''}>HR Manager (ผู้จัดการ)</option>
                            <option value="Staff" ${val === 'Staff' ? 'selected' : ''}>Staff (พนักงานทั่วไป)</option>
                        </select></div>
                    `);
            return;
        }

        if ((lw === 'employee_id' || lw === 'emp_id' || lw === 'employees id') && currentSheet.toLowerCase() !== 'staff' && currentSheet.toLowerCase() !== 'user') {
            const isRatingForm = currentSheet.toLowerCase().includes('ranting') || currentSheet.toLowerCase().includes('rating');
            if (isRatingForm) {
                formFields.insertAdjacentHTML('beforeend', `
                            <div class="col-span-1 sm:col-span-2 bg-gradient-to-br from-indigo-50 to-purple-50 p-5 rounded-2xl border border-indigo-100 mb-2">
                                <label class="block mb-2 text-xs font-bold text-gray-700 uppercase tracking-wider">${h} <span class="text-brandindigo">*</span></label>
                                <div class="flex gap-2">
                                    <input type="text" name="${h}" value="${safeVal}" required oninput="handleRatingEmployeeIdInput(this)" onchange="handleRatingEmployeeIdInput(this)" placeholder="กรอก Staff ID / Employee ID..." class="bg-white border border-gray-300 text-gray-900 text-sm rounded-xl focus:ring-brandindigo focus:border-brandindigo block w-full p-3 transition-colors shadow-sm">
                                    <button type="button" onclick="handleRatingEmployeeIdInput(this.parentElement.querySelector('input'))" class="px-4 rounded-xl bg-brandindigo hover:bg-brandpurple text-white font-bold shadow-sm transition-colors"><i class="fa-solid fa-magnifying-glass"></i></button>
                                </div>
                                <div id="rating-employee-preview" class="hidden mt-4 p-4 bg-white/80 border border-white rounded-2xl shadow-sm"></div>
                            </div>
                        `);

                // ใช้ cache ก่อน — ถ้ามีแล้วไม่ต้องดึงใหม่
                if (tableCache['staff'] && tableCache['staff'].data && tableCache['staff'].data.length > 0) {
                    if (val) setTimeout(() => handleRatingEmployeeIdInput(document.querySelector('#dynamic-form input[name="' + h.replace(/"/g, '\\"') + '"]')), 50);
                } else {
                    google.script.run.withSuccessHandler(res => {
                        if (res && res.success && Array.isArray(res.data)) {
                            tableCache['staff'] = { headers: res.headers || [], data: res.data };
                            if (val) setTimeout(() => handleRatingEmployeeIdInput(document.querySelector('#dynamic-form input[name="' + h.replace(/"/g, '\\"') + '"]')), 50);
                        }
                    }).getSheetData('staff');
                }

                return;
            }

            const selectId = 'dropdown-' + lw;
            const showQuota = currentSheet === 'Leave application';
            formFields.insertAdjacentHTML('beforeend', `
                        <div class="col-span-1 sm:col-span-2 bg-indigo-50/50 p-5 rounded-2xl border border-indigo-100 mb-2 relative overflow-hidden">
                            ${showQuota ? `<p class="text-xs font-bold text-gray-500 mb-4 flex items-center tracking-widest uppercase"><i class="fa-solid fa-chart-pie mr-2 text-brandindigo"></i> Leave Quota Balance: <span id="leave-quota-display" class="ml-auto bg-white px-3 py-1 rounded-lg border border-gray-200 text-gray-900 shadow-sm">Loading...</span></p>` : ''}
                            <label class="block mb-2 text-xs font-bold text-gray-700 uppercase tracking-wider">${h} <span class="text-brandindigo">*</span></label>
                            <select id="${selectId}" name="${h}" required onchange="autoFillEmployeeData(this.value)" class="bg-white border border-gray-300 text-gray-900 text-sm rounded-xl focus:ring-brandindigo focus:border-brandindigo block w-full p-3 transition-colors shadow-sm">
                                <option value="${safeVal}" selected>${safeVal ? safeVal : 'Loading staff data...'}</option>
                            </select>
                        </div>
                    `);

            // ใช้ cache ก่อน — ถ้ามีแล้วไม่ต้องดึงใหม่
            var populateStaffSelect = function (res) {
                const selectEl = document.getElementById(selectId);
                if (selectEl && res.success && res.data && res.data.length > 0) {
                    if (!tableCache['staff']) tableCache['staff'] = { headers: res.headers || [], data: res.data };
                    else tableCache['staff'].data = res.data;

                    let options = '';

                    if (role !== 'Staff') {
                        options = `<option value="" disabled ${!val ? 'selected' : ''}>Select Employee...</option>`;
                    }

                    let actualMatchedEmpId = '';

                    res.data.forEach(row => {
                        let keyId = Object.keys(row).find(k => k.toLowerCase().trim() === 'employee_id' || k.toLowerCase().trim() === 'emp_id') || Object.keys(row)[0];
                        let empIdVal = row[keyId] || '';

                        if (empIdVal) {
                            let displayValue = empIdVal;
                            let safeEmpIdVal = String(empIdVal).toLowerCase().trim();

                            if (role === 'Staff') {
                                if (safeEmpIdVal === loggedInEmpId && loggedInEmpId !== '') {
                                    options += `<option value="${empIdVal}" selected>${displayValue}</option>`;
                                    actualMatchedEmpId = empIdVal;
                                }
                            } else {
                                options += `<option value="${empIdVal}" ${val === empIdVal ? 'selected' : ''}>${displayValue}</option>`;
                            }
                        }
                    });

                    if (role === 'Staff' && options === '') {
                        options = `<option value="" disabled selected>ID not found in database</option>`;
                    }

                    selectEl.innerHTML = options;

                    if (role === 'Staff') {
                        selectEl.style.pointerEvents = "none";
                        selectEl.classList.add('bg-gray-100', 'text-gray-500');
                        if (actualMatchedEmpId) {
                            autoFillEmployeeData(actualMatchedEmpId);
                        }
                    }
                    else if (editingRecordId && val) {
                        autoFillEmployeeData(val);
                    }
                } else if (selectEl) {
                    selectEl.innerHTML = '<option value="" disabled selected>No staff data</option>';
                }
            };

            // เรียกด้วย cache ก่อน — ถ้ามีแล้วไม่ต้องดึงใหม่
            if (tableCache['staff'] && tableCache['staff'].data && tableCache['staff'].data.length > 0) {
                populateStaffSelect({ success: true, headers: tableCache['staff'].headers, data: tableCache['staff'].data });
            } else {
                google.script.run.withSuccessHandler(populateStaffSelect).getSheetData('staff');
            }

            return;
        }


        if (lw === 'items') {
            formFields.insertAdjacentHTML('beforeend', `
                                <div class="col-span-1 sm:col-span-2 bg-indigo-50/20 p-5 rounded-2xl border border-indigo-100/50 mb-4 mt-2">
                                    <label class="block mb-2 text-xs font-bold text-gray-700 uppercase tracking-wider">${h}</label>
                                    <div class="overflow-x-auto w-full mb-3 rounded-xl border border-gray-200 shadow-inner bg-white p-2">
                                        <table class="w-full text-xs text-left text-gray-700 divide-y divide-gray-100 min-w-[500px]">
                                            <thead>
                                                <tr class="text-[10px] text-gray-400 font-bold uppercase tracking-wider">
                                                    <th class="p-2 w-12 text-center">ลำดับ</th>
                                                    <th class="p-2">รายการสินค้า/บริการ</th>
                                                    <th class="p-2 w-20 text-center">จำนวน</th>
                                                    <th class="p-2 w-32 text-right">ราคา/หน่วย</th>
                                                    <th class="p-2 w-32 text-right">ราคารวม</th>
                                                    <th class="p-2 w-10 text-center">ลบ</th>
                                                </tr>
                                            </thead>
                                            <tbody id="bill-items-tbody" class="divide-y divide-gray-100">
                                            </tbody>
                                        </table>
                                    </div>
                                    <div class="flex justify-between items-center">
                                        <button type="button" onclick="addBillRow()" class="px-4 py-2 bg-brandindigo hover:bg-brandpurple text-white text-xs font-bold rounded-xl transition-all flex items-center shadow-md">
                                            <i class="fa-solid fa-plus mr-1"></i> เพิ่มรายการ
                                        </button>
                                        <div class="text-right text-xs font-bold text-gray-600">
                                            ยอดรวมในบิล: <span id="bill-total-price-display" class="text-brandindigo text-sm font-black">0</span> บาท
                                        </div>
                                    </div>
                                    <input type="hidden" id="hidden-bill-items-input" name="${h}" value="">
                                </div>
                            `);

            // Initialize after DOM update
            setTimeout(() => {
                initializeBillEditor(safeVal);
            }, 50);

            return;
        }

        if (lw === 'id' || lw === 'leave_id' || lw === 'log_id' || lw === 'asset_id' || lw === 'course_id' || (index === 0 && lw !== 'employee_id' && lw !== 'emp_id' && currentSheet.toLowerCase() !== 'staff' && currentSheet.toLowerCase() !== 'user')) {
            formFields.insertAdjacentHTML('beforeend', `
                        <input type="hidden" name="${h}" value="${safeVal}">
                    `);
            return;
        }
        if (lw === 'email' && currentSheet.toLowerCase() === 'user') {
            formFields.insertAdjacentHTML('beforeend', `
                                <div><label class="block mb-2 text-xs font-bold text-gray-700 uppercase tracking-wider">EMAIL <span class="text-brandindigo">*</span></label>
                                <input type="email" name="${h}" value="${safeVal}" required class="bg-white border border-gray-300 text-gray-900 text-sm rounded-xl focus:ring-brandindigo focus:border-brandindigo block w-full p-3 transition-colors shadow-sm" placeholder="Enter email address..."></div>
                            `);
            return;
        }
        if (index === 0 && (currentSheet.toLowerCase() === 'staff' || currentSheet.toLowerCase() === 'user')) {
            if (!editingRecordId) {
                formFields.insertAdjacentHTML('beforeend', `
                                    <div><label class="block mb-2 text-xs font-bold text-gray-700 uppercase tracking-wider">${h} <span class="text-brandindigo">*</span></label>
                                    <input type="text" name="${h}" required placeholder="Enter ${h}..." class="bg-white border border-gray-300 text-gray-900 text-sm rounded-xl focus:ring-brandindigo focus:border-brandindigo block w-full p-3 transition-colors shadow-sm"></div>
                                `);
            } else {
                formFields.insertAdjacentHTML('beforeend', `
                                    <div><label class="block mb-2 text-xs font-bold text-gray-700 uppercase tracking-wider">${h}</label>
                                    <input type="text" name="${h}" value="${val}" readonly class="bg-gray-100 border border-gray-200 text-gray-500 text-sm rounded-xl block w-full p-3 cursor-not-allowed font-medium shadow-inner"></div>
                                `);
            }
            return;
        }

        const isDate = lw.includes('date') || lw.includes('birthday') || lw.includes('วันเกิด');
        let displayVal = val;
        if (isDate && val && val !== '-') {
            let d = new Date(val);
            if (!isNaN(d.getTime())) {
                let year = d.getFullYear();
                let month = String(d.getMonth() + 1).padStart(2, '0');
                let day = String(d.getDate()).padStart(2, '0');
                displayVal = `${year}-${month}-${day}`;
            } else {
                let parts = String(val).split(/[\/\-]/);
                if (parts.length === 3) {
                    if (parts[2].length === 4) {
                        displayVal = `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
                    } else if (parts[0].length === 4) {
                        displayVal = `${parts[0]}-${parts[1].padStart(2, '0')}-${parts[2].padStart(2, '0')}`;
                    }
                }
            }
        }
        const safeDisplayVal = String(displayVal).replace(/"/g, '&quot;');
        const isOptional = (lw === 'adjusted_status' || lw === 'reference_leave_id' || lw === 'device id' || lw.includes('link') || lw.includes('url') || lw.includes('ลิงก์') || lw.includes('youtube') || lw.includes('facebook') || lw.includes('participant') || lw.includes('ผู้เข้าร่วม'));
        const requiredAttr = isOptional ? '' : 'required';

        if (lw === 'status' && currentSheet.toLowerCase() === 'staff') {
            formFields.insertAdjacentHTML('beforeend', `
                                <div><label class="block mb-2 text-xs font-bold text-gray-700 uppercase tracking-wider">${h}</label>
                                <select name="${h}" required class="bg-white border border-gray-300 text-gray-900 text-sm rounded-xl focus:ring-brandindigo focus:border-brandindigo block w-full p-3 transition-colors shadow-sm">
                                    <option value="Active" ${val === 'Active' ? 'selected' : ''}>Active</option>
                                    <option value="On Leave" ${val === 'On Leave' ? 'selected' : ''}>On Leave</option>
                                    <option value="Inactive" ${val === 'Inactive' ? 'selected' : ''}>Inactive</option>
                                </select></div>
                            `);
        }
        else if (lw === 'prefix' && currentSheet.toLowerCase() === 'staff') {
            formFields.insertAdjacentHTML('beforeend', `
                                <div><label class="block mb-2 text-xs font-bold text-gray-700 uppercase tracking-wider">${h} <span class="text-brandindigo">*</span></label>
                                <select name="${h}" required class="bg-white border border-gray-300 text-gray-900 text-sm rounded-xl focus:ring-brandindigo focus:border-brandindigo block w-full p-3 transition-colors shadow-sm">
                                    <option value="" disabled ${!val ? 'selected' : ''}>Select Prefix...</option>
                                    <option value="Mr" ${val === 'Mr' ? 'selected' : ''}>Mr</option>
                                    <option value="Mrs" ${val === 'Mrs' ? 'selected' : ''}>Mrs</option>
                                    <option value="Miss" ${val === 'Miss' ? 'selected' : ''}>Miss</option>
                                    <option value="Dr." ${val === 'Dr.' ? 'selected' : ''}>Dr.</option>
                                    <option value="CEO" ${val === 'CEO' ? 'selected' : ''}>CEO</option>
                                    <option value="COO" ${val === 'COO' ? 'selected' : ''}>COO</option>
                                    <option value="CFO" ${val === 'CFO' ? 'selected' : ''}>CFO</option>
                                </select></div>
                            `);
        }
        // 👇👇 เริ่มโค้ด: ช่อง TYPE (ประเภทการลา) แบบ Dropdown 👇👇
        // 👉 1. เพิ่ม Dropdown สำหรับ TYPE ของ Announcements
        else if (lw === 'type' && currentSheet.toLowerCase() === 'announcements') {
            formFields.insertAdjacentHTML('beforeend', `
                                <div><label class="block mb-2 text-xs font-bold text-gray-700 uppercase tracking-wider">${h} <span class="text-brandindigo">*</span></label>
                                <select name="${h}" required class="bg-white border border-gray-300 text-gray-900 text-sm rounded-xl focus:ring-brandindigo focus:border-brandindigo block w-full p-3 transition-colors shadow-sm">
                                    <option value="" disabled ${!val ? 'selected' : ''}>เลือกประเภทประกาศ...</option>
                                    <option value="Company" ${val === 'Company' ? 'selected' : ''}>Company (ประกาศบริษัท)</option>
                                    <option value="Meetings" ${val === 'Meetings' ? 'selected' : ''}>Meetings (นัดประชุม)</option>
                                    <option value="Events" ${val === 'Events' ? 'selected' : ''}>Events (กิจกรรม)</option>
                                    <option value="General" ${val === 'General' ? 'selected' : ''}>General (ทั่วไป)</option>
                                </select></div>
                            `);
        }
        // 👉 1.2 เพิ่ม Dropdown สำหรับ TYPE ของ News
        else if (lw === 'type' && currentSheet.toLowerCase() === 'news') {
            formFields.insertAdjacentHTML('beforeend', `
                                <div><label class="block mb-2 text-xs font-bold text-gray-700 uppercase tracking-wider">${h} <span class="text-brandindigo">*</span></label>
                                <select name="${h}" required class="bg-white border border-gray-300 text-gray-900 text-sm rounded-xl focus:ring-brandindigo focus:border-brandindigo block w-full p-3 transition-colors shadow-sm">
                                    <option value="" disabled ${!val ? 'selected' : ''}>เลือกประเภทข่าวสาร...</option>
                                    <option value="กิจกรรม" ${val === 'กิจกรรม' ? 'selected' : ''}>กิจกรรม (Activities)</option>
                                    <option value="บริการ" ${val === 'บริการ' ? 'selected' : ''}>บริการ (Services)</option>
                                    <option value="สินค้าใหม่" ${val === 'สินค้าใหม่' ? 'selected' : ''}>สินค้าใหม่ (New Products)</option>
                                    <option value="ทั่วไป" ${val === 'ทั่วไป' ? 'selected' : ''}>ทั่วไป (General)</option>
                                </select></div>
                            `);
        }
        // 👉 1.3 เพิ่ม Dropdown สำหรับ AUDIENCE (กลุ่มเป้าหมาย) ของ News
        else if (lw === 'audience' || lw === 'กลุ่มเป้าหมาย' || lw === 'เป้าหมาย') {
            formFields.insertAdjacentHTML('beforeend', `
                                <div><label class="block mb-2 text-xs font-bold text-gray-700 uppercase tracking-wider">${h} <span class="text-brandindigo">*</span></label>
                                <select name="${h}" required class="bg-white border border-gray-300 text-gray-900 text-sm rounded-xl focus:ring-brandindigo focus:border-brandindigo block w-full p-3 transition-colors shadow-sm">
                                    <option value="Public" ${val === 'Public' ? 'selected' : ''}>Public (เผยแพร่สาธารณะ)</option>
                                    <option value="Internal" ${val === 'Internal' ? 'selected' : ''}>Internal (ภายในองค์กรเท่านั้น)</option>
                                </select></div>
                            `);
        }
        // 👉 2. เปลี่ยนช่อง TOPIC ให้เป็นกล่องข้อความกว้างๆ (Textarea)
        else if ((lw === 'topic' || lw === 'detail' || lw === 'รายละเอียด') && currentSheet.toLowerCase() === 'announcements') {
            formFields.insertAdjacentHTML('beforeend', `
                                <div class="col-span-1 sm:col-span-2"><label class="block mb-2 text-xs font-bold text-gray-700 uppercase tracking-wider">${h} <span class="text-brandindigo">*</span></label>
                                <textarea name="${h}" required rows="4" class="bg-white border border-gray-300 text-gray-900 text-sm rounded-xl focus:ring-brandindigo focus:border-brandindigo block w-full p-3 transition-colors shadow-sm" placeholder="พิมพ์รายละเอียดประกาศ...">${safeDisplayVal}</textarea></div>
                            `);
        }
        // 👆👆 สิ้นสุดโค้ดช่อง TYPE 👆👆

        else if (lw === 'status' && currentSheet.toLowerCase() === 'training') {
            formFields.insertAdjacentHTML('beforeend', `
                                <div><label class="block mb-2 text-xs font-bold text-gray-700 uppercase tracking-wider">${h} <span class="text-brandindigo">*</span></label>
                                <select name="${h}" required class="bg-white border border-gray-300 text-gray-900 text-sm rounded-xl focus:ring-brandindigo focus:border-brandindigo block w-full p-3 transition-colors shadow-sm">
                                    <option value="" disabled ${!val ? 'selected' : ''}>Select Status...</option>
                                    <option value="Upcoming" ${String(val).toLowerCase().includes('upcoming') ? 'selected' : ''}>Upcoming</option>
                                    <option value="Ongoing" ${String(val).toLowerCase().includes('ongoing') ? 'selected' : ''}>Ongoing</option>
                                    <option value="Completed" ${String(val).toLowerCase().includes('complete') ? 'selected' : ''}>Completed</option>
                                    <option value="Cancelled" ${String(val).toLowerCase().includes('cancel') ? 'selected' : ''}>Cancelled</option>
                                </select></div>
                            `);
        }
        else if (lw === 'status') {
            formFields.insertAdjacentHTML('beforeend', `
                                <div><label class="block mb-2 text-xs font-bold text-gray-700 uppercase tracking-wider">${h}</label>
                                <select name="${h}" required class="bg-white border border-gray-300 text-gray-900 text-sm rounded-xl focus:ring-brandindigo focus:border-brandindigo block w-full p-3 transition-colors shadow-sm">
                                    <option value="Active" ${val === 'Active' || !val ? 'selected' : ''}>Active</option>
                                    <option value="Inactive" ${val === 'Inactive' ? 'selected' : ''}>Inactive</option>
                                </select></div>
                            `);
        }
        else if (lw === 'format' || lw === 'รูปแบบ') {
            formFields.insertAdjacentHTML('beforeend', `
                                <div><label class="block mb-2 text-xs font-bold text-gray-700 uppercase tracking-wider">${h} <span class="text-brandindigo">*</span></label>
                                <select name="${h}" required class="bg-white border border-gray-300 text-gray-900 text-sm rounded-xl focus:ring-brandindigo focus:border-brandindigo block w-full p-3 transition-colors shadow-sm">
                                    <option value="" disabled ${!val ? 'selected' : ''}>Select Format...</option>
                                    <option value="Online" ${val === 'Online' ? 'selected' : ''}>Online</option>
                                    <option value="In-Company" ${val === 'In-Company' ? 'selected' : ''}>In-Company</option>
                                    <option value="Public Training" ${val === 'Public Training' ? 'selected' : ''}>Public Training</option>
                                </select></div>
                            `);
        }
        else if ((lw === 'position_id' || lw === 'position') && currentSheet.toLowerCase() === 'staff') {
            formFields.insertAdjacentHTML('beforeend', `
                                <div><label class="block mb-2 text-xs font-bold text-gray-700 uppercase tracking-wider">${h} <span class="text-brandindigo">*</span></label>
                                <select name="${h}" required class="bg-white border border-gray-300 text-gray-900 text-sm rounded-xl focus:ring-brandindigo focus:border-brandindigo block w-full p-3 transition-colors shadow-sm">
                                    <option value="" disabled ${!val ? 'selected' : ''}>Select Position...</option>
                                    <option value="CEO" ${val === 'CEO' ? 'selected' : ''}>CEO</option>
                                    <option value="COO" ${val === 'COO' ? 'selected' : ''}>COO</option>
                                    <option value="CFO" ${val === 'CFO' ? 'selected' : ''}>CFO</option>
                                    <option value="Managers" ${val === 'Managers' ? 'selected' : ''}>Managers</option>
                                    <option value="Head Leaders" ${val === 'Head Leaders' ? 'selected' : ''}>Head Leaders</option>
                                    <option value="Managers HR" ${val === 'Managers HR' ? 'selected' : ''}>Managers HR</option>
                                    <option value="Staff" ${val === 'Staff' ? 'selected' : ''}>Staff</option>
                                </select></div>
                            `);
        }
        // 1. จัดการช่องแผนก (Department) ของเดิมในองค์กร
        else if (lw === 'department_id' && currentSheet.toLowerCase() === 'staff') {
            const selectId = 'dropdown-' + lw;
            formFields.insertAdjacentHTML('beforeend', `
                                <div><label class="block mb-2 text-xs font-bold text-gray-700 uppercase tracking-wider">${h} <span class="text-brandindigo">*</span></label>
                                <select id="${selectId}" name="${h}" required class="bg-white border border-gray-300 text-gray-900 text-sm rounded-xl focus:ring-brandindigo focus:border-brandindigo block w-full p-3 transition-colors shadow-sm">
                                    <option value="${safeDisplayVal}" selected>${safeDisplayVal ? safeDisplayVal : 'Loading data...'}</option>
                                </select></div>
                            `);

            google.script.run.withSuccessHandler(res => {
                const selectEl = document.getElementById(selectId);
                if (selectEl && res.success && res.data && res.data.length > 0) {
                    let options = `<option value="" disabled ${!val ? 'selected' : ''}>Select Department...</option>`;
                    res.data.forEach(row => {
                        let keyId = Object.keys(row).find(k => k.toLowerCase().trim() === 'department_id') || Object.keys(row)[0];
                        let keyName = Object.keys(row).find(k => k.toLowerCase().trim() === 'department_name') || Object.keys(row)[1];
                        let colAValue = row[keyId] || '';
                        let colBValue = row[keyName] || '';
                        if (colAValue) {
                            let displayValue = colBValue ? `${colAValue} - ${colBValue}` : colAValue;
                            options += `<option value="${colAValue}" ${val === colAValue ? 'selected' : ''}>${displayValue}</option>`;
                        }
                    });
                    selectEl.innerHTML = options;
                }
            }).getSheetData('Department ');
        }

        // 👉 เริ่มโค้ดที่แทรกเพิ่ม: จัดการช่อง GIVE BY (ผู้ประเมิน)

        else if (lw === 'give by' || lw === 'give_by') {
            const selectId = 'dropdown-' + lw.replace(/\s+/g, '-');
            formFields.insertAdjacentHTML('beforeend', `
                                <div><label class="block mb-2 text-xs font-bold text-gray-700 uppercase tracking-wider">${h} <span class="text-brandindigo">*</span></label>
                                <select id="${selectId}" name="${h}" required class="bg-white border border-gray-300 text-gray-900 text-sm rounded-xl focus:ring-brandindigo focus:border-brandindigo block w-full p-3 transition-colors shadow-sm">
                                    <option value="${safeVal}" selected>${safeVal ? safeVal : 'Loading evaluators...'}</option>
                                </select></div>
                            `);

            // ใช้ cache ก่อน — ถ้ามีแล้วไม่ต้องดึงใหม่
            var populateGiveBy = function (res) {
                const selectEl = document.getElementById(selectId);
                if (selectEl && res.success && res.data && res.data.length > 0) {
                    let options = `<option value="" disabled ${!val ? 'selected' : ''}>Select Evaluator...</option>`;
                    let foundAny = false;

                    res.data.forEach(row => {
                        let posKey = Object.keys(row).find(k => ['position', 'position_id', 'ตำแหน่ง'].includes(k.toLowerCase().trim()));
                        let pos = posKey ? String(row[posKey]).toLowerCase() : '';

                        let isManager = pos.includes('ceo') || pos.includes('сео') ||
                            pos.includes('coo') || pos.includes('соо') ||
                            pos.includes('cfo') || pos.includes('сfо') || pos.includes('cfо') ||
                            pos.includes('manager') || pos.includes('head') ||
                            pos.includes('ผู้บริหาร') || pos.includes('admin') ||
                            pos.includes('director') || pos.includes('ผู้อำนวยการ');
                        if (isManager) {
                            let nameKey = Object.keys(row).find(k => ['name', 'full_name', 'first_name', 'ชื่อ'].includes(k.toLowerCase().trim()));
                            let lastKey = Object.keys(row).find(k => k.toLowerCase().trim() === 'last_name');
                            let name = nameKey ? row[nameKey] : '';
                            if (lastKey && row[lastKey]) name += ' ' + row[lastKey];
                            name = name.trim() || 'Unknown';
                            let displayPos = posKey ? row[posKey] : '';
                            options += `<option value="${name}" ${val === name ? 'selected' : ''}>${name}${displayPos ? ' (' + displayPos + ')' : ''}</option>`;
                            foundAny = true;
                        }
                    });

                    // ถ้าไม่เจอผู้บริหาร ให้แสดงพนักงานทั้งหมดแทน
                    if (!foundAny) {
                        res.data.forEach(row => {
                            let nameKey = Object.keys(row).find(k => ['name', 'full_name', 'first_name', 'ชื่อ'].includes(k.toLowerCase().trim()));
                            let lastKey = Object.keys(row).find(k => k.toLowerCase().trim() === 'last_name');
                            let name = nameKey ? row[nameKey] : '';
                            if (lastKey && row[lastKey]) name += ' ' + row[lastKey];
                            name = name.trim();
                            if (name) options += `<option value="${name}" ${val === name ? 'selected' : ''}>${name}</option>`;
                        });
                    }
                    selectEl.innerHTML = options;
                } else if (selectEl) {
                    selectEl.innerHTML = '<option value="" disabled>Failed to load data</option>';
                }
            };

            if (tableCache['staff'] && tableCache['staff'].data && tableCache['staff'].data.length > 0) {
                populateGiveBy({ success: true, headers: tableCache['staff'].headers, data: tableCache['staff'].data });
            } else {
                google.script.run.withSuccessHandler(res => {
                    if (res && res.success) tableCache['staff'] = { headers: res.headers || [], data: res.data || [] };
                    populateGiveBy(res);
                }).getSheetData('staff');
            }
        }
        // 👉 จบส่วน GIVE BY

        // 3. จัดการช่อง STAR POINT (ดาว 5 ดวง)
        else if (lw === 'star point' || lw === 'star_point') {
            let currentRating = parseInt(val) || 0;
            let starsHtml = '';
            for (let i = 1; i <= 5; i++) {
                let starClass = i <= currentRating ? 'fa-solid fa-star text-yellow-400' : 'fa-regular fa-star text-gray-300';
                starsHtml += `<i class="${starClass} text-3xl cursor-pointer hover:scale-110 transition-transform mx-1" onclick="setFormStarRating(${i})" id="form-star-${i}"></i>`;
            }

            formFields.insertAdjacentHTML('beforeend', `
                                <div>
                                    <label class="block mb-2 text-xs font-bold text-gray-700 uppercase tracking-wider">${h} <span class="text-brandindigo">*</span></label>
                                    <div class="flex flex-col items-center justify-center bg-gray-50 p-4 rounded-xl border border-gray-200">
                                        <div class="flex">${starsHtml}</div>
                                        <p id="form-star-text" class="mt-2 text-sm font-bold text-brandindigo">${currentRating > 0 ? currentRating + ' / 5' : 'คลิกเพื่อให้คะแนน'}</p>
                                    </div>
                                    <input type="hidden" name="${h}" id="hidden-star-input" value="${currentRating > 0 ? currentRating : ''}" required>
                                </div>
                            `);
        }
        // 👇👇 โค้ดใหม่สำหรับเปลี่ยนช่อง PHOTO เป็นปุ่มอัปโหลดไฟล์ (รูป/PDF) แบบไม่บังคับ 👇👇
        else if (lw === 'photo' || lw === 'document' || lw === 'ไฟล์แนบ' || lw === 'attachment' || (currentSheet.trim() === 'Policy' && lw === 'link') || (currentSheet.trim() === 'Documents' && (lw === 'file' || lw === 'link' || lw === 'ไฟล์'))) {
            formFields.insertAdjacentHTML('beforeend', `
                                <div class="col-span-1 sm:col-span-2">
                                    <label class="block mb-2 text-xs font-bold text-gray-700 uppercase tracking-wider">${h} <span class="text-gray-400 font-normal ml-1" style="text-transform: none;">(ไม่บังคับ / Optional)</span></label>
                                    <div class="flex items-center bg-white border border-gray-300 rounded-xl p-1.5 shadow-sm focus-within:border-brandindigo focus-within:ring-1 focus-within:ring-brandindigo transition-all">
                                        <div class="w-10 h-10 bg-indigo-50 text-brandindigo rounded-lg flex items-center justify-center shrink-0 mr-3">
                                            <i class="fa-solid fa-file-arrow-up text-lg"></i>
                                        </div>
                                        <div class="flex-1">
                                            <input type="file" accept="image/*, application/pdf" class="block w-full text-sm text-gray-500 file:mr-4 file:py-1.5 file:px-4 file:rounded-lg file:border-0 file:text-xs file:font-bold file:bg-gray-100 file:text-gray-700 hover:file:bg-gray-200 transition-colors cursor-pointer outline-none">
                                            
                                            <input type="hidden" name="${h}" id="hidden-profile-input" value="${safeVal}">
                                        </div>
                                    </div>
                                    ${safeVal && safeVal !== '-' ? `<div class="mt-2 text-xs"><a href="${safeVal}" target="_blank" class="inline-flex items-center px-3 py-1 rounded-md bg-indigo-50 text-brandindigo hover:bg-indigo-100 transition-colors font-medium"><i class="fa-solid fa-paperclip mr-1.5"></i>เปิดดูไฟล์แนบเดิม</a></div>` : ''}
                                </div>
                            `);
        }
        // 👆👆 สิ้นสุดโค้ดอัปโหลดไฟล์แนบ 👆👆
        // 👉 เริ่มโค้ดที่แทรกเพิ่ม: เปลี่ยนช่องใส่รูประบุพนักงาน/Photos เป็น "ปุ่มอัปโหลด"
        else if (lw === 'profile' || lw === 'รูป' || lw === 'pic' || lw === 'image' || lw === 'photos' || lw === 'photo') {
            formFields.insertAdjacentHTML('beforeend', `
                                <div class="col-span-1 sm:col-span-2 bg-indigo-50/30 p-4 rounded-xl border border-indigo-100">
                                    <label class="block mb-3 text-xs font-bold text-gray-700 uppercase tracking-wider">${h}</label>
                                    <div class="flex items-center space-x-4">
                                        <div class="w-16 h-16 rounded-full border border-gray-200 overflow-hidden bg-white shrink-0 shadow-sm">
                                            <img id="preview-profile-img" src="${safeVal && safeVal !== '-' ? safeVal : 'https://ui-avatars.com/api/?background=e0e7ff&color=4f46e5&name=Pic'}" class="w-full h-full object-cover">
                                        </div>
                                        <div class="flex-1">
                                            <input type="file" accept="image/*" class="block w-full text-sm text-gray-500 file:mr-4 file:py-2.5 file:px-4 file:rounded-xl file:border-0 file:text-sm file:font-bold file:bg-white file:text-brandindigo hover:file:bg-indigo-100 transition-colors cursor-pointer border border-dashed border-indigo-200 rounded-xl p-2 bg-white" onchange="if(this.files[0]){ let r = new FileReader(); r.onload=e=>document.getElementById('preview-profile-img').src=e.target.result; r.readAsDataURL(this.files[0]); }">
                                            <input type="hidden" name="${h}" id="hidden-profile-input" value="${safeVal}">
                                        </div>
                                    </div>
                                </div>
                            `);
        }

        // จบส่วนปุ่มอัปโหลด


        // 👇👇👇 ก๊อปปี้โค้ดชุดนี้ ไปวางแทรกตรงนี้ได้เลยครับ 👇👇👇
        else if (lw === 'category' || lw === 'หมวดหมู่') {
            const uniqueInputId = 'gen-category-input-' + Date.now();
            const allCats = ['ตรงต่อเวลา', 'ทำยอดขายได้ดี', 'ช่วยเหลือเพื่อนร่วมงาน', 'บริการลูกค้าดี', 'ทำงานเป็นทีม', 'แก้ปัญหาได้ดี', 'ทำงานเกินเป้าหมาย', 'สร้างไอเดียใหม่', 'ไม่ขาดงาน', 'พนักงานดีเด่นประจำเดือน'];
            const tagsHtml = allCats.map(c => {
                const escaped = String(c).replace(/'/g, "\\'");
                return `<span class="cursor-pointer text-[11px] px-2.5 py-1 rounded-full bg-white text-gray-700 hover:bg-brandindigo hover:text-white transition-all font-medium border border-gray-200 shadow-sm" onclick="document.getElementById('${uniqueInputId}').value='${escaped}'">${c}</span>`;
            }).join('');

            formFields.insertAdjacentHTML('beforeend', `
                                <div>
                                    <label class="block mb-2 text-xs font-bold text-gray-700 uppercase tracking-wider">${h} <span class="text-brandindigo">*</span></label>
                                    <input type="text" id="${uniqueInputId}" name="${h}" value="${safeVal}" required
                                        class="bg-white border border-gray-300 text-gray-900 text-sm rounded-xl focus:ring-brandindigo focus:border-brandindigo block w-full p-3 transition-colors shadow-sm"
                                        placeholder="พิมพ์หมวดหมู่ หรือกดเลือกจากแถบด้านล่าง...">
                                    <div class="mt-2 flex flex-wrap gap-1.5 max-h-[85px] overflow-y-auto p-1 bg-gray-50 rounded-xl border border-gray-100">
                                        ${tagsHtml}
                                    </div>
                                </div>
                            `);
        }
        // 👆👆👆 สิ้นสุดโค้ดที่ต้องก๊อปปี้ 👆👆👆

        // 👇👇 เริ่มก๊อปปี้ตรงนี้: ทำให้ช่อง OBJECT กางเต็มหน้าจอและเป็น Textarea 👇👇
        else if (lw === 'object' || lw === 'เหตุผล' || lw === 'reason' || lw === 'content' || lw === 'รายละเอียด' || lw === 'เนื้อหา') {
            formFields.insertAdjacentHTML('beforeend', `
                                <div class="col-span-1 sm:col-span-2">
                                    <label class="block mb-2 text-xs font-bold text-gray-700 uppercase tracking-wider">${h} <span class="text-brandindigo">*</span></label>
                                    <textarea name="${h}" required rows="4" class="bg-white border border-gray-300 text-gray-900 text-sm rounded-xl focus:ring-brandindigo focus:border-brandindigo block w-full p-3 transition-colors shadow-sm resize-y" placeholder="ระบุเหตุผล / Enter ${h}...">${safeDisplayVal}</textarea>
                                </div>
                            `);
        }

        else {
            let inputType = 'text';
            let colSpan = '';
            if (lw.includes('password')) inputType = 'password';
            else if (isDate) inputType = 'date';
            else if (lw.includes('link') || lw.includes('url') || lw.includes('logo') || lw.includes('website')) {
                inputType = 'url';
                colSpan = 'col-span-1 sm:col-span-2';
            }

            formFields.insertAdjacentHTML('beforeend', `
                                <div class="${colSpan}"><label class="block mb-2 text-xs font-bold text-gray-700 uppercase tracking-wider">${h} ${isOptional ? '<span class="text-gray-400 font-normal ml-1">(Optional)</span>' : '<span class="text-brandindigo">*</span>'}</label>
                                <input type="${inputType}" name="${h}" value="${safeDisplayVal}" ${requiredAttr} class="bg-white border border-gray-300 text-gray-900 text-sm rounded-xl focus:ring-brandindigo focus:border-brandindigo block w-full p-3 transition-colors shadow-sm" placeholder="Enter ${h}..."></div>
                            `);
        }
    });

    if (currentSheet.toLowerCase().includes('leave')) {
        setTimeout(() => {
            const form = document.getElementById('dynamic-form');
            const inputs = Array.from(form.querySelectorAll('input'));

            const startInput = inputs.find(i => i.name.toLowerCase().includes('start') || i.name.toLowerCase().includes('เริ่ม'));
            const endInput = inputs.find(i => i.name.toLowerCase().includes('end') || i.name.toLowerCase().includes('สิ้นสุด'));
            const totalInput = inputs.find(i => i.name.toLowerCase().includes('total') || i.name.toLowerCase().includes('days') || i.name.toLowerCase().includes('รวม'));

            if (startInput && endInput && totalInput) {
                totalInput.setAttribute('readonly', true);
                totalInput.classList.add('bg-gray-100', 'text-gray-500', 'cursor-not-allowed', 'border-gray-200');
                totalInput.classList.remove('bg-white');

                const calcDays = () => {
                    if (startInput.value && endInput.value) {
                        const d1 = new Date(startInput.value);
                        const d2 = new Date(endInput.value);
                        const diffTime = d2 - d1;
                        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
                        totalInput.value = diffDays > 0 ? diffDays : 0;
                    } else {
                        totalInput.value = '';
                    }
                };
                startInput.addEventListener('change', calcDays);
                endInput.addEventListener('change', calcDays);
            }
        }, 100);
    }
    // 📌 6. คำนวณ Daily Rate จาก Base Salary อัตโนมัติ (สมมติว่าหาร 30 วัน)
    if (currentSheet.toLowerCase() === 'staff') {
        setTimeout(() => {
            const form = document.getElementById('dynamic-form');
            const inputs = Array.from(form.querySelectorAll('input'));

            // ดึงช่อง Base Salary และ Daily Rate
            const baseInput = inputs.find(i => i.name.toLowerCase().trim() === 'base_salary' || i.name.toLowerCase().includes('salary'));
            const dailyInput = inputs.find(i => i.name.toLowerCase().trim() === 'daily_rate_formula' || i.name.toLowerCase().includes('daily'));

            if (baseInput && dailyInput) {
                // ล็อกช่อง Daily Rate ให้พิมพ์ไม่ได้ (รอคำนวณอย่างเดียว)
                dailyInput.setAttribute('readonly', true);
                dailyInput.classList.add('bg-gray-100', 'text-gray-500', 'cursor-not-allowed', 'border-gray-200');
                dailyInput.classList.remove('bg-white');

                const calcDaily = () => {
                    let salary = parseFloat(baseInput.value) || 0;
                    // หาร 30 วันเพื่อให้ได้รายวัน (คุณสามารถแก้เลข 30 ตรงนี้ได้ถ้านโยบายคือหาร 22 หรือตัวเลขอื่น)
                    dailyInput.value = salary > 0 ? (salary / 30).toFixed(2) : '';
                };

                // สั่งให้คำนวณทันทีเมื่อมีการพิมพ์แก้ไขเงินเดือน
                baseInput.addEventListener('input', calcDaily);

                // ถ้าเป็นการกด Edit และมีเงินเดือนอยู่แล้ว ให้คำนวณแสดงไว้เลย
                if (!dailyInput.value && baseInput.value) calcDaily();
            }
        }, 50);
    }

    document.getElementById('form-modal').classList.remove('hidden');
}
function closeFormModal() {
    document.getElementById('form-modal').classList.add('hidden');
    editingRecordId = null;
}

/* =====================================================================
 * 📌 ฟังก์ชัน autoFillEmployeeData: ดึงข้อมูล Leave Quota และคำนวณวันคงเหลือ
 * - เรียกเมื่อผู้ใช้เลือกพนักงานในฟอร์มขอลา
 * ===================================================================== */
function autoFillEmployeeData(empId) {
    if (!empId) return;

    const quotaDisplay = document.getElementById('leave-quota-display');
    if (quotaDisplay) quotaDisplay.innerHTML = '<i class="fa-solid fa-spinner fa-spin text-brandindigo"></i>';

    // ดึง Leave_Quota จาก staff cache
    const staffCache = tableCache['staff'] || tableCache['Staff'];
    let quota = 0;
    if (staffCache && staffCache.data) {
        const staffRow = staffCache.data.find(r => {
            let eId = String(r.Employee_ID || r.employee_id || '').toUpperCase().trim();
            return eId === String(empId).toUpperCase().trim();
        });
        if (staffRow) {
            quota = parseInt(
                staffRow.Leave_Quota || staffRow.leave_quota ||
                staffRow['Leave_Quota'] || 0
            ) || 0;
        }
    }

    // คำนวณวันที่ใช้ไปแล้วจาก leave_applications cache
    const leaveCache = tableCache['Leave application'];
    let usedDays = 0;
    if (leaveCache && leaveCache.data) {
        leaveCache.data.forEach(r => {
            let rEmpId = String(
                r.Employee_ID || r.employee_id || r['Employee_ID'] || ''
            ).toUpperCase().trim();
            if (rEmpId === String(empId).toUpperCase().trim()) {
                let days = parseFloat(
                    r.Total_Days || r.total_days || r['Total_Days'] || 0
                ) || 0;
                usedDays += days;
            }
        });
    }

    const remaining = quota - usedDays;

    // กำหนด window variable เพื่อใช้ตรวจสอบตอน submit
    window._currentLeaveQuota = quota;
    window._currentLeaveUsed = usedDays;
    window._currentLeaveRemaining = remaining;

    // แสดงผลใน leave-quota-display
    if (quotaDisplay) {
        let colorClass = 'text-emerald-600';
        let bgClass = 'bg-emerald-50 border-emerald-200';
        let icon = 'fa-circle-check';

        if (remaining <= 0) {
            colorClass = 'text-red-600';
            bgClass = 'bg-red-50 border-red-200';
            icon = 'fa-circle-xmark';
        } else if (remaining <= 3) {
            colorClass = 'text-amber-600';
            bgClass = 'bg-amber-50 border-amber-200';
            icon = 'fa-circle-exclamation';
        }

        quotaDisplay.innerHTML = `
                    <span class="inline-flex items-center gap-2 ${bgClass} border px-3 py-1 rounded-lg">
                        <i class="fa-solid ${icon} ${colorClass}"></i>
                        <span class="font-bold ${colorClass}">${remaining} วัน</span>
                        <span class="text-gray-400 text-[10px] font-normal">(ใช้ ${usedDays}/${quota} วัน)</span>
                    </span>
                `;
    }

    // Auto-fill ข้อมูลพนักงานอื่นๆ ในฟอร์ม (ชื่อ, แผนก, ตำแหน่ง, เบอร์โทร)
    if (staffCache && staffCache.data) {
        const staffRow = staffCache.data.find(r => {
            let eId = String(r.Employee_ID || r.employee_id || '').toUpperCase().trim();
            return eId === String(empId).toUpperCase().trim();
        });
        if (staffRow) {
            const form = document.getElementById('dynamic-form');
            if (!form) return;

            // Map ชื่อ field ในฟอร์มกับข้อมูลจาก staff
            const fieldMap = {
                'Prefix': staffRow.Prefix || staffRow.prefix || '',
                'First_Name': staffRow.First_Name || staffRow.first_name || '',
                'Last_Name': staffRow.Last_Name || staffRow.last_name || '',
                'Department_ID': staffRow.Department_ID || staffRow.department_id || '',
                'Position_ID': staffRow.Position_ID || staffRow.position_id || '',
                'Contact': staffRow.Tel || staffRow.tel || staffRow.Phone || staffRow.phone || '',
                'prefix': staffRow.Prefix || staffRow.prefix || '',
                'first_name': staffRow.First_Name || staffRow.first_name || '',
                'last_name': staffRow.Last_Name || staffRow.last_name || '',
                'department_id': staffRow.Department_ID || staffRow.department_id || '',
                'position_id': staffRow.Position_ID || staffRow.position_id || '',
                'contact': staffRow.Tel || staffRow.tel || staffRow.Phone || staffRow.phone || ''
            };

            Object.entries(fieldMap).forEach(([fieldName, value]) => {
                const input = form.querySelector(`[name="${fieldName}"]`);
                if (input && !input.readOnly && value && value !== '-') {
                    input.value = value;
                }
            });
        }
    }
}

/* =====================================================================
 * 🖼️ ฟังก์ชันย่อ/บีบอัดรูปก่อนแปลงเป็น base64
 * - ระบบนี้เก็บรูปเป็น base64 ตรงในคอลัมน์ของตาราง (ดู uploadImageToDrive
 *   ใน Hr.html ที่แค่คืนค่า base64 กลับมาเป็น "url" โดยไม่ได้อัปโหลดขึ้น Storage จริง)
 * - ถ้าไม่ย่อรูปก่อน ไฟล์จากมือถือ/กล้อง (มักหลาย MB ต่อรูป) จะทำให้ทุกครั้งที่มีการ
 *   ดึงข้อมูลพนักงานทั้งหมด (getSheetData('staff')) ต้องโหลด base64 ก้อนใหญ่ของ
 *   พนักงานทุกคนพร้อมกัน ส่งผลให้หน้า "Loading staff..." ค้าง/ช้ามาก
 * - ฟังก์ชันนี้ย่อขนาดรูปให้ไม่เกิน maxDim px และบีบอัดเป็น JPEG คุณภาพ quality
 *   ทำให้ไฟล์เล็กลงจากหลัก MB เหลือหลักสิบ KB โดยยังคมชัดพอสำหรับแสดงเป็นรูปโปรไฟล์
 * ===================================================================== */
function compressImageFile(file, maxDim = 480, quality = 0.72) {
    return new Promise(function (resolve, reject) {
        if (!file) { reject(new Error('ไม่มีไฟล์')); return; }
        const reader = new FileReader();
        reader.onerror = function () { reject(new Error('อ่านไฟล์ไม่สำเร็จ')); };
        reader.onload = function (e) {
            const img = new Image();
            img.onerror = function () { reject(new Error('ไฟล์รูปไม่ถูกต้อง')); };
            img.onload = function () {
                let width = img.width;
                let height = img.height;
                if (width > maxDim || height > maxDim) {
                    if (width >= height) {
                        height = Math.round(height * (maxDim / width));
                        width = maxDim;
                    } else {
                        width = Math.round(width * (maxDim / height));
                        height = maxDim;
                    }
                }
                const canvas = document.createElement('canvas');
                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, width, height);
                try {
                    resolve(canvas.toDataURL('image/jpeg', quality));
                } catch (err) {
                    reject(err);
                }
            };
            img.src = e.target.result;
        };
        reader.readAsDataURL(file);
    });
}

/* =====================================================================
 * 📌 ส่วนที่ 19: FORM SUBMISSION (ฟังก์ชันส่งข้อมูลขึ้น Google Sheets)
 * - ส่งข้อมูลจากฟอร์มบันทึก, แก้ไข ไปยังเซิร์ฟเวอร์
 * ===================================================================== */
function submitData(e) {
    e.preventDefault();
    const dataObj = {};
    let permissionsArray = [];
    let permKeyName = '';

    currentHeaders.forEach(h => {
        dataObj[h] = '';
        let lwK = h.toLowerCase().trim();
        if (lwK === 'permissions' || lwK === 'สิทธิ์' || lwK === 'สิทธิ์การเข้าถึง') {
            permKeyName = h;
        }
    });

    new FormData(e.target).forEach((v, k) => {
        let lwK = k.toLowerCase().trim();
        if (lwK === 'permissions' || lwK === 'สิทธิ์' || lwK === 'สิทธิ์การเข้าถึง') {
            permissionsArray.push(v);
        } else if (v instanceof File) {
            // ข้ามไฟล์ไปก่อน เราจะจัดการมันข้างล่าง
        } else {
            if (v === 'สร้างอัตโนมัติ (Auto)' || v === 'Auto Generated') {
                if (currentSheet.toLowerCase().includes('department')) {
                    // ถ้าเป็นแผนก สร้างรหัสสุ่ม 5 หลัก
                    v = 'DEPT-' + Math.random().toString(36).substring(2, 7).toUpperCase();
                } else {
                    v = 'NEW-' + Date.now();
                }
            }
            dataObj[k] = v;
        }
    });

    if (permKeyName) dataObj[permKeyName] = permissionsArray.join(', ');

    const currentEditId = editingRecordId;

    // 📌 ตรวจสอบว่ามีการอัปโหลดไฟล์รูปหรือไม่
    let fileInput = e.target.querySelector('input[type="file"]');
    let hiddenImgInput = document.getElementById('hidden-profile-input');

    if (fileInput && fileInput.files.length > 0) {
        toggleLoading(true, 'PREPARING IMAGE...');
        let file = fileInput.files[0];
        // 🛠️ ย่อ/บีบอัดรูปก่อนแปลงเป็น base64 เสมอ
        // เหตุผล: ระบบเก็บรูปเป็น base64 ตรงในคอลัมน์ของตาราง (ไม่ได้อัปโหลดขึ้น Storage จริงๆ)
        // ถ้าไม่ย่อ รูปต้นฉบับจากมือถือ/กล้อง (มักหลาย MB ต่อรูป) จะทำให้ทุกครั้งที่มีการ
        // getSheetData('staff') ต้องโหลดข้อมูล base64 ก้อนใหญ่ของพนักงานทุกคนพร้อมกัน
        // ส่งผลให้หน้า "Loading staff..." ค้าง/ช้ามาก โดยเฉพาะเมื่อพนักงานมีจำนวนมาก
        compressImageFile(file, 480, 0.72).then(function (base64Data) {
            // โยนไฟล์ไปให้ Google Apps Script
            google.script.run
                .withSuccessHandler(res => {
                    if (res.success) {
                        // ถ้ารูปอัปสำเร็จ เอา URL ไปยัดใส่ข้อมูลที่จะบันทึก
                        if (hiddenImgInput) {
                            let imgColName = hiddenImgInput.name;
                            dataObj[imgColName] = res.url;
                        }
                        executeSaveToSheet(dataObj, currentEditId); // ไปเซฟข้อมูลหลักต่อ
                    } else {
                        toggleLoading(false);
                        showToast('Image upload failed: ' + res.message, 'error');
                    }
                })
                .withFailureHandler(err => {
                    toggleLoading(false);
                    showToast('Connection failed: ' + err.message, 'error');
                })
                .uploadImageToDrive(base64Data, file.name);
        }).catch(function (err) {
            toggleLoading(false);
            showToast('ไม่สามารถเตรียมรูปภาพได้: ' + (err && err.message ? err.message : err), 'error');
        });
    } else {
        // ถ้าไม่มีการอัปโหลดไฟล์ใหม่ ให้ใช้ลิงก์ URL รูปเดิมที่มีอยู่
        if (hiddenImgInput) {
            let imgColName = hiddenImgInput.name;
            dataObj[imgColName] = hiddenImgInput.value;
        }
        executeSaveToSheet(dataObj, currentEditId);
    }
}


// 📌 ฟังก์ชันย่อยสำหรับบันทึกข้อมูลหลัก หลังจากรูปอัปโหลดเสร็จแล้ว

function executeSaveToSheet(dataObj, currentEditId) {
    // 📌 ตรวจสอบ Leave Quota ก่อน Submit (เฉพาะตอน Add ใหม่ ไม่ใช่แก้ไข)
    if (currentSheet === 'Leave application' && !currentEditId) {
        // หาจำนวนวันที่ขอ
        let requestedDays = 0;
        for (let k in dataObj) {
            if (k.toLowerCase().includes('total') || k.toLowerCase().includes('days')) {
                requestedDays = parseFloat(dataObj[k]) || 0;
                break;
            }
        }

        const remaining = typeof window._currentLeaveRemaining !== 'undefined'
            ? window._currentLeaveRemaining
            : null;
        const quota = typeof window._currentLeaveQuota !== 'undefined'
            ? window._currentLeaveQuota
            : null;

        // บล็อกถ้าเกิน quota (และ quota > 0)
        if (quota !== null && quota > 0 && requestedDays > remaining) {
            showToast(
                `⚠️ ไม่สามารถยื่นขอลาได้! วันที่ขอ (${requestedDays} วัน) เกินโควตาคงเหลือ (${remaining} วัน)`,
                'error'
            );
            toggleLoading(false);
            return;
        }
    }

    closeFormModal();
    if (currentSheet === 'Leave application' && !currentEditId) {
        let sigKey = currentHeaders.find(h => h.toLowerCase().trim() === 'signature') || 'Signature';
        dataObj[sigKey] = 'Pending';
    }

    // Imported rows may have a null/blank business ID. PostgreSQL allows
    // several NULLs, but submitting the form turns them into the same empty
    // string and violates the unique constraint. Assign a real unique ID.
    const businessIdCol = currentHeaders.find(h => {
        const key = h.toLowerCase().trim();
        return key === 'id' || key === 'id_leave' || key === 'leave_id' || key === 'log_id' ||
            key === 'asset_id' || key === 'course_id' || key === 'department_id' ||
            key === 'organization_id' || key === 'orgid' || key === 'category_id' ||
            key === 'point_id' || key === 'ranting_id' || key === 'rating_id' || key === 'kpi_id';
    });
    if (businessIdCol && !String(dataObj[businessIdCol] || '').trim()) {
        const isDept = currentSheet.toLowerCase().includes('department');
        const prefix = isDept ? 'DEPT' : 'NEW';
        const randomCode = Math.random().toString(36).substring(2, 7).toUpperCase();

        if (isDept) {
            // รหัสแผนกสั้นๆ DEPT-XXXXX
            dataObj[businessIdCol] = `${prefix}-${randomCode}`;
        } else {
            dataObj[businessIdCol] = `${prefix}-${Date.now()}-${randomCode}`;
        }
    }

    if (!currentEditId) {
        // 👇 ตรวจจับ Ranting_ID และคำว่า Auto Generated
        const idCol = businessIdCol;
        if (idCol && (!dataObj[idCol] || dataObj[idCol] === 'สร้างอัตโนมัติ (Auto)' || dataObj[idCol] === 'Auto Generated')) {
            if (currentSheet.toLowerCase().includes('department')) {
                dataObj[idCol] = 'DEPT-' + Math.random().toString(36).substring(2, 7).toUpperCase();
            } else {
                dataObj[idCol] = 'NEW-' + new Date().getTime();
            }
        }
        rawData.unshift(dataObj);
    } else {
        const rowIndex = rawData.findIndex(r => getRecordId(r) === currentEditId);
        if (rowIndex > -1) { Object.keys(dataObj).forEach(k => rawData[rowIndex][k] = dataObj[k]); }
    }

    if (tableCache[currentSheet]) tableCache[currentSheet].data = rawData;
    renderTable(rawData);

    toggleLoading(true, 'SAVING DATA...');

    if (currentEditId) {
        google.script.run
            .withSuccessHandler(res => {
                toggleLoading(false);
                if (res.success) { showSuccessModal("Record Updated", "Database updated successfully."); fetchData(currentSheet, true); }
                else { showToast(res.message, 'error'); fetchData(currentSheet, true); }
            })
            .withFailureHandler(err => { toggleLoading(false); showToast('Connection failed: ' + err.message, 'error'); fetchData(currentSheet, true); })
            .updateEntireRecord(currentSheet, currentEditId, dataObj);
    } else {
        google.script.run
            .withSuccessHandler(res => {
                toggleLoading(false);
                if (res.success) { showSuccessModal("Record Added", "New data saved to database."); fetchData(currentSheet, true); }
                else { showToast(res.message, 'error'); }
            })
            .withFailureHandler(err => { toggleLoading(false); showToast('Connection failed: ' + err.message, 'error'); })
            .saveData(currentSheet, dataObj);
    }
}
function deleteRecord(id) {
    showConfirmModal(
        'Confirm Deletion',
        `Are you sure you want to delete record <b>${id}</b>?<br><span class="text-[11px] text-gray-500 mt-2 block uppercase tracking-widest font-medium">This action cannot be undone</span>`,
        () => {
            rawData = rawData.filter(r => getRecordId(r) !== id);
            if (tableCache[currentSheet]) tableCache[currentSheet].data = rawData;
            renderTable(rawData);

            toggleLoading(true, 'DELETING RECORD...');

            google.script.run
                .withSuccessHandler(res => {
                    toggleLoading(false);
                    if (res.success) { showSuccessModal("Record Deleted", "Data has been removed from database."); }
                    else { showToast(res.message, 'error'); fetchData(currentSheet, true); }
                })
                .withFailureHandler(err => {
                    toggleLoading(false);
                    showToast('Connection failed: ' + err.message, 'error');
                    fetchData(currentSheet, true);
                })
                .deleteRecordData(currentSheet, id);
        },
        null,
        true
    );
}

/* =====================================================================
 * 📌 ส่วนที่ 20: SCANNER & CHECK-IN (ฟังก์ชันแสกน QR Code และเข้างาน)
 * - ควบคุมกล้องสำหรับแสกน QR และจัดการบันทึกเวลาเข้า/ออก
 * ===================================================================== */
function initScanner() {
    try {
        const gpsCoordsEl = document.getElementById('gps-coords');
        if (gpsCoordsEl) {
            gpsCoordsEl.innerHTML = 'Locating GPS <i class="fa-solid fa-spinner fa-spin"></i>';
        }

        try {
            if (!map) {
                map = L.map('map').setView([BRANCHES[0].lat, BRANCHES[0].lng], 16);
                // Light theme map tiles (Standard OSM)
                L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                    maxZoom: 19,
                    attribution: '&copy; <a href="https://openstreetmap.org/copyright">OpenStreetMap</a>'
                }).addTo(map);

                let bounds = [];
                BRANCHES.forEach(b => {
                    L.circle([b.lat, b.lng], { color: '#4f46e5', fillColor: '#4f46e5', fillOpacity: 0.2, radius: b.radius }).addTo(map).bindPopup(b.name);
                    L.marker([b.lat, b.lng]).addTo(map).bindTooltip(b.name, { permanent: true, direction: 'top' });
                    bounds.push([b.lat, b.lng]);
                });

                if (bounds.length > 0) map.fitBounds(bounds, { padding: [30, 30] });
            }
            setTimeout(() => { if (map) map.invalidateSize(); }, 400);
        } catch (error) {
            console.error("Leaflet Map Load Error:", error);
        }

        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(
                pos => {
                    try {
                        const lat = pos.coords.latitude, lng = pos.coords.longitude;
                        const gpsText = document.getElementById('gps-coords');
                        if (gpsText) {
                            gpsText.innerText = `Current Location: Lat ${lat.toFixed(4)}, Lng ${lng.toFixed(4)}`;
                        }

                        if (userMarker) { userMarker.setLatLng([lat, lng]); }
                        else if (map) {
                            const userIcon = L.divIcon({ className: 'custom-div-icon', html: "<div class='bg-brandindigo rounded-full w-5 h-5 border-2 border-white shadow-lg'></div>", iconSize: [20, 20], iconAnchor: [10, 10] });
                            userMarker = L.marker([lat, lng], { icon: userIcon }).addTo(map).bindPopup('You are here').openPopup();
                        }
                    } catch (eInner) {
                        console.error("Error in GPS success handler:", eInner);
                    }
                },
                err => {
                    const gpsText = document.getElementById('gps-coords');
                    if (gpsText) {
                        gpsText.innerHTML = '<span class="text-red-500">Failed to get location. Enable GPS.</span>';
                    }
                },
                { enableHighAccuracy: true }
            );
        }

        const sessionStr = localStorage.getItem('hr_user_session') || sessionStorage.getItem('hr_user_session');
        let role = 'Staff';
        let loggedInEmpId = '';
        if (sessionStr) {
            try {
                const sessionData = JSON.parse(sessionStr);
                role = sessionData.role || 'Staff';
                loggedInEmpId = sessionData.empId || sessionData.username || '';
            } catch (e) { }
        }

        const empInput = document.getElementById('manualEmpId');
        if (empInput) {
            if (role === 'Staff') {
                empInput.value = loggedInEmpId;
                empInput.readOnly = true;
                empInput.classList.add('bg-gray-100', 'cursor-not-allowed', 'text-gray-500');
                empInput.classList.remove('bg-white', 'text-gray-900');
            } else {
                empInput.readOnly = false;
                empInput.classList.remove('bg-gray-100', 'cursor-not-allowed', 'text-gray-500');
                empInput.classList.add('bg-white', 'text-gray-900');
                setTimeout(() => { empInput.focus(); }, 300);
            }
        }
    } catch (error) {
        console.error("Error in initScanner:", error);
        window.dispatchEvent(new ErrorEvent('error', { error: error, message: "initScanner: " + error.message }));
    }
}

function handleManualScan(e) {
    e.preventDefault();
    const sessionStr = localStorage.getItem('hr_user_session') || sessionStorage.getItem('hr_user_session');
    let role = 'Staff';
    if (sessionStr) { try { role = JSON.parse(sessionStr).role || 'Staff'; } catch (e) { } }

    if (typeof isProcessingScan !== 'undefined' && isProcessingScan) return;
    isProcessingScan = true;
    processAttendance(document.getElementById('manualEmpId').value, role === 'Staff' ? 'Scanned via App' : 'Manual Entry by Admin');
}

function processAttendance(empId, scannedText = null) {
    const scanType = document.querySelector('input[name="scanType"]:checked').value;
    let locationText = "Unknown Location";

    if (scannedText && scannedText !== 'Manual Entry by Admin') {
        let foundBranch = BRANCHES.find(b => b.id === scannedText || b.name === scannedText);
        if (foundBranch) {
            locationText = foundBranch.name;
        } else {
            locationText = scannedText;
        }
    } else if (scannedText === 'Manual Entry by Admin') {
        locationText = scannedText;
    }

    toggleLoading(true, `CHECKING GPS...`);

    const sessionStr = localStorage.getItem('hr_user_session') || sessionStorage.getItem('hr_user_session');
    let role = 'Staff';
    if (sessionStr) { try { role = JSON.parse(sessionStr).role || 'Staff'; } catch (e) { } }

    navigator.geolocation.getCurrentPosition(pos => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;


        let currentBranch = null;
        let minDistance = Infinity;

        BRANCHES.forEach(branch => {
            let dist = calculateDistance(lat, lng, branch.lat, branch.lng);
            if (dist <= branch.radius && dist < minDistance) {
                minDistance = dist;
                currentBranch = branch.name;
            }
        });

        if (!currentBranch && role === 'Staff') {
            toggleLoading(false);
            showToast("Out of branch area. Cannot scan.", "error");
            setTimeout(() => { isProcessingScan = false; }, 2000);
            return;
        }

        let finalLocation = role === 'Staff' ? `${locationText} (${currentBranch || 'Offsite'})` : locationText;

        toggleLoading(true, `SAVING RECORD...`);

        google.script.run
            .withSuccessHandler(res => {
                toggleLoading(false);
                if (res.success) {
                    showSuccessModal("Scan Successful!", `Your attendance has been recorded.<br><span class="text-xs text-gray-500 mt-3 block font-medium">Loc: ${finalLocation}</span>`);
                    loadTodayAttendance();
                    if (role !== 'Staff') document.getElementById('manualEmpId').value = '';
                } else {
                    showToast(res.message, 'error');
                }
                setTimeout(() => { isProcessingScan = false; }, 3000);
            })
            .withFailureHandler(err => {
                showToast('Connection failed: ' + err.message, 'error');
                toggleLoading(false);
                setTimeout(() => { isProcessingScan = false; }, 3000);
            })
            .recordAttendance(empId.trim().toUpperCase(), scanType, lat, lng, finalLocation);
    }, err => {
        toggleLoading(false);
        showToast("Failed to get GPS location. Please wait.", 'error');
        setTimeout(() => { isProcessingScan = false; }, 2000);
    }, { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 });
}
/* =====================================================================
 * 📌 ส่วนที่ 21: DIGITAL CARD (ระบบบัตรพนักงานดิจิทัล)
 * ===================================================================== */
let digitalCardQrCode = null;

function loadDigitalCard() {
    toggleLoading(true, 'LOADING CARD DATA...');
    if (tableCache['staff']) {
        setupDigitalCardData(tableCache['staff'].data);
        toggleLoading(false);
    } else {
        google.script.run.withSuccessHandler(res => {
            toggleLoading(false);
            if (res.success) {
                tableCache['staff'] = { headers: (res.headers || []).map(String), data: res.data || [] };
                setupDigitalCardData(res.data);
            } else showToast(res.message, 'error');
        }).getSheetData('staff');
    }
}

function setupDigitalCardData(staffData) {
    const select = document.getElementById('digital-card-emp-select');
    const sessionStr = localStorage.getItem('hr_user_session') || sessionStorage.getItem('hr_user_session');
    let role = 'Staff', currentEmpId = '';

    if (sessionStr) {
        try {
            let s = JSON.parse(sessionStr);
            role = s.role || 'Staff';
            currentEmpId = String(s.empId || s.username || '').toUpperCase().trim();
        } catch (e) { }
    }

    let options = '';
    let defaultId = '';

    // ถ้าระดับ Staff จะล็อคช่องเลือก ให้ดูได้แค่บัตรตัวเอง
    if (role === 'Staff') {
        select.disabled = true;
        select.classList.add('bg-gray-100', 'cursor-not-allowed');
    } else {
        select.disabled = false;
        select.classList.remove('bg-gray-100', 'cursor-not-allowed');
    }

    staffData.forEach(row => {
        let eId = String(getFuzzyValue(row, ['employee_id', 'emp_id'])).toUpperCase().trim();
        let name = getFuzzyValue(row, ['first_name', 'name', 'full_name', 'ชื่อ']);
        let lastName = getFuzzyValue(row, ['last_name', 'นามสกุล']);
        let fullName = name !== '-' ? (lastName !== '-' ? name + ' ' + lastName : name) : 'Unknown';

        if (eId && eId !== '-') {
            if (role === 'Staff' && eId !== currentEmpId) return;

            let isSelected = (eId === currentEmpId) ? 'selected' : '';
            if (isSelected) defaultId = eId;
            options += `<option value="${eId}" ${isSelected}>${eId} - ${fullName}</option>`;
        }
    });

    if (!options) options = `<option value="">ไม่พบข้อมูลพนักงาน</option>`;
    select.innerHTML = options;

    if (role !== 'Staff' && !defaultId && select.options.length > 0) {
        defaultId = select.options[0].value;
    }

    if (defaultId) updateDigitalCardUI(defaultId);
}

function updateDigitalCardUI(empId) {
    if (!tableCache['staff']) return;
    const staffData = tableCache['staff'].data;
    const empRow = staffData.find(r => String(getFuzzyValue(r, ['employee_id', 'emp_id'])).toUpperCase().trim() === empId);

    if (!empRow) return;

    let name = getFuzzyValue(empRow, ['first_name', 'name', 'full_name', 'ชื่อ']);
    let lastName = getFuzzyValue(empRow, ['last_name', 'นามสกุล']);
    let fullName = name !== '-' ? (lastName !== '-' ? name + ' ' + lastName : name) : 'Unknown';
    let position = getFuzzyValue(empRow, ['position', 'ตำแหน่ง', 'position_id']);
    let dept = getFuzzyValue(empRow, ['department_name', 'department', 'แผนก', 'department_id']);

    let picUrl = getFuzzyValue(empRow, ['photos', 'photo', 'profile', 'รูป', 'pic', 'image']);

    let phone = getFuzzyValue(empRow, ['phone', 'tel', 'mobile', 'เบอร์โทร', 'เบอร์']);
    let email = getFuzzyValue(empRow, ['email', 'e-mail', 'อีเมล']);
    let line = getFuzzyValue(empRow, ['line_id', 'line', 'ไลน์']);

    // 🛠️ ทริคปลดล็อก: แปลงลิงก์ Google Drive ให้แสดงรูปบนเว็บได้ชัวร์ๆ
    if (picUrl && picUrl.includes('drive.google.com')) {
        let fileId = '';
        if (picUrl.includes('id=')) {
            fileId = picUrl.split('id=')[1].split('&')[0];
        } else if (picUrl.includes('/d/')) {
            fileId = picUrl.split('/d/')[1].split('/')[0];
        }
        if (fileId) {
            // ใช้ลิงก์ Thumbnail เพื่อบายพาสระบบบล็อกของ Google
            picUrl = 'https://drive.google.com/thumbnail?id=' + fileId + '&sz=w500';
        }
    }

    // ใช้ Avatar สีม่วงสวยๆ ถ้าไม่มีรูปโปรไฟล์ใน Sheet
    if (!picUrl || picUrl === '-' || picUrl.trim() === '') {
        picUrl = 'https://ui-avatars.com/api/?background=e0e7ff&color=4f46e5&name=' + encodeURIComponent(fullName) + '&size=256&bold=true';
    }

    const imgElement = document.getElementById('digital-card-pic');
    imgElement.src = picUrl;
    imgElement.onerror = function () {
        this.src = 'https://ui-avatars.com/api/?background=e0e7ff&color=4f46e5&name=NA';
    };

    document.getElementById('digital-card-name').innerText = fullName;
    document.getElementById('digital-card-position').innerText = position !== '-' ? position : 'Employee';
    document.getElementById('digital-card-dept').innerText = dept !== '-' ? dept : '';
    document.getElementById('digital-card-id').innerText = empId;

    document.getElementById('digital-card-phone').innerText = phone !== '-' ? phone : '-';
    document.getElementById('digital-card-email').innerText = email !== '-' ? email : '-';
    document.getElementById('digital-card-line').innerText = line !== '-' ? line : '-';

    const qrContainer = document.getElementById('digital-card-qr');
    qrContainer.innerHTML = '';
    if (typeof digitalCardQrCode !== 'undefined' && digitalCardQrCode) { try { digitalCardQrCode.clear(); } catch (e) { } }

    digitalCardQrCode = new QRCode(qrContainer, {
        text: empId,
        width: 56,
        height: 56,
        colorDark: "#0f172a",
        colorLight: "#ffffff",
        correctLevel: QRCode.CorrectLevel.L
    });
}
function updateDigitalCard(empData) {
    // 1. อัปเดตรูปภาพ
    const photoElement = document.getElementById('card-photo');
    // สมมติว่าคอลัมน์เก็บรูปชื่อ 'PHOTOS'
    if (empData['PHOTOS'] && empData['PHOTOS'] !== '-') {
        photoElement.src = empData['PHOTOS']; // ใส่ลิงก์รูปที่อัปโหลดไว้
    } else {
        photoElement.src = 'https://ui-avatars.com/api/?name=' + empData['NAME']; // ถ้ารูปไม่มี ให้ใช้รูปตัวอักษรย่อแทน
    }

    // 2. อัปเดตข้อความต่างๆ (ตรวจสอบชื่อคอลัมน์ให้ตรงกับใน Sheet)
    document.getElementById('card-name').innerText = empData['NAME'] || '-';
    document.getElementById('card-position').innerText = empData['POSITION_ID'] || '-';

    // 3. อัปเดตข้อมูลติดต่อ (ถ้าเพิ่มเข้ามาในการ์ด)
    document.getElementById('card-phone').innerText = empData['PHONE'] || '-';
    document.getElementById('card-email').innerText = empData['EMAIL'] || '-';
    document.getElementById('card-line').innerText = empData['LINE_ID'] || '-';
}

/* =====================================================================
 * 📌 ส่วนที่ 22: COMPANY SETTINGS (ระบบแก้ไขข้อมูลหน้าแรก)
 * ===================================================================== */
let deletedSubsidiaries = [];

function loadCompanySettings() {
    toggleLoading(true, 'LOADING COMPANY INFO...');
    google.script.run.withSuccessHandler(res => {
        toggleLoading(false);
        if (res.success) {
            deletedSubsidiaries = [];
            const infoMap = {};
            if (Array.isArray(res.info)) {
                res.info.forEach(row => {
                    infoMap[row.key] = row.value;
                });
            }

            document.getElementById('comp-about-title').value = infoMap['about_title'] || '';
            document.getElementById('comp-about-desc').value = infoMap['about_desc'] || '';
            document.getElementById('comp-vision').value = infoMap['vision'] || '';
            document.getElementById('comp-values').value = infoMap['values_desc'] || '';
            document.getElementById('comp-subsidiaries-desc').value = infoMap['subsidiaries_desc'] || '';
            document.getElementById('comp-mission-mastering').value = infoMap['mission_mastering'] || '';
            document.getElementById('comp-mission-commanding').value = infoMap['mission_commanding'] || '';
            document.getElementById('comp-mission-unifying').value = infoMap['mission_unifying'] || '';

            // Logo loading logic
            const logoUrl = infoMap['company_logo'] || '';
            const preview = document.getElementById('comp-logo-preview');
            const placeholder = document.getElementById('comp-logo-placeholder');
            const urlInput = document.getElementById('comp-logo-url');

            urlInput.value = logoUrl;
            if (logoUrl && logoUrl.trim() !== '') {
                preview.src = logoUrl;
                preview.classList.remove('hidden');
                placeholder.classList.add('hidden');
            } else {
                preview.src = '';
                preview.classList.add('hidden');
                placeholder.classList.remove('hidden');
            }

            renderSubsidiariesSettingsList(res.subsidiaries || []);

            // Load Careers/Jobs list
            let jobs = [];
            try {
                jobs = JSON.parse(infoMap['careers'] || '[]');
            } catch (e) {
                console.error('Failed to parse careers JSON', e);
            }
            renderJobsSettingsList(jobs);

            // Load Contact Info fields
            document.getElementById('comp-address').value = infoMap['contact_address'] || '';
            document.getElementById('comp-facebook').value = infoMap['contact_facebook'] || '';
            document.getElementById('comp-instagram').value = infoMap['contact_instagram'] || '';
            document.getElementById('comp-line').value = infoMap['contact_line'] || '';

            // Load Map Location fields
            document.getElementById('comp-map-lat').value = infoMap['map_lat'] || '';
            document.getElementById('comp-map-lng').value = infoMap['map_lng'] || '';
            document.getElementById('comp-map-label').value = infoMap['map_label'] || '';

        } else {
            showToast(res.message || 'Failed to load company profile data', 'error');
        }
    }).getCompanyProfile();
}

function previewCompanyLogo(input) {
    const file = input.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = function (e) {
            const preview = document.getElementById('comp-logo-preview');
            const placeholder = document.getElementById('comp-logo-placeholder');
            const urlInput = document.getElementById('comp-logo-url');

            preview.src = e.target.result;
            preview.classList.remove('hidden');
            placeholder.classList.add('hidden');
            urlInput.value = e.target.result;
        };
        reader.readAsDataURL(file);
    }
}

function clearCompanyLogo() {
    const preview = document.getElementById('comp-logo-preview');
    const placeholder = document.getElementById('comp-logo-placeholder');
    const urlInput = document.getElementById('comp-logo-url');
    const fileInput = document.getElementById('comp-logo-file');

    preview.src = '';
    preview.classList.add('hidden');
    placeholder.classList.remove('hidden');
    urlInput.value = '';
    fileInput.value = '';
}

function triggerSubLogoUpload(subId) {
    const input = document.getElementById(`sub-file-${subId}`);
    if (input) input.click();
}

function previewSubLogo(subId, input) {
    const file = input.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = function (e) {
            const card = document.querySelector(`[data-sub-id="${subId}"]`);
            if (card) {
                const preview = card.querySelector('.sub-logo-preview');
                const placeholder = card.querySelector('.sub-logo-placeholder');
                const valInput = document.getElementById(`sub-val-${subId}`);

                preview.src = e.target.result;
                preview.style.display = 'block';
                placeholder.style.display = 'none';
                valInput.value = e.target.result;
            }
        };
        reader.readAsDataURL(file);
    }
}
function clearSubLogo(subId) {
    const card = document.querySelector(`[data-sub-id="${subId}"]`);
    if (card) {
        const preview = card.querySelector('.sub-logo-preview');
        const placeholder = card.querySelector('.sub-logo-placeholder');
        const valInput = document.getElementById(`sub-val-${subId}`);
        const fileInput = document.getElementById(`sub-file-${subId}`);

        preview.src = '';
        preview.style.display = 'none';
        placeholder.innerHTML = '🏢';
        placeholder.style.display = 'block';
        valInput.value = '🏢';
        fileInput.value = '';
    }
}

function renderSubsidiariesSettingsList(subsList) {
    const container = document.getElementById('subsidiaries-list-container');
    if (!container) return;

    if (!subsList || subsList.length === 0) {
        container.innerHTML = `<p class="text-gray-500 text-sm text-center py-4">ไม่มีข้อมูลบริษัทในเครือ</p>`;
        return;
    }

    container.innerHTML = subsList.map((sub, i) => {
        const isUrl = sub.emoji && (sub.emoji.startsWith('http') || sub.emoji.startsWith('data:image'));
        return `
                <div class="p-5 border border-gray-200 rounded-xl space-y-4 bg-gray-50/50 shadow-inner hover:border-indigo-200 transition-all" data-sub-id="${sub.id}">
                    <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b border-gray-100 pb-3">
                        <div class="flex items-center gap-2">
                            <span class="text-xs font-bold px-2 py-1 bg-brandindigo/10 text-brandindigo rounded-md uppercase tracking-wider">${sub.id}</span>
                            <span class="text-sm font-bold text-gray-700">ลำดับ:</span>
                            <input type="number" class="w-16 bg-white border border-gray-300 text-gray-900 text-sm rounded-lg p-1 text-center font-bold sub-sort-order" value="${sub.sort_order || (i + 1)}">
                        </div>
                        
                        <!-- Logo Upload controls for Subsidiary -->
                        <div class="flex items-center gap-3 w-full sm:w-auto">
                            <div class="relative w-12 h-12 rounded-lg border border-gray-200 bg-white flex items-center justify-center overflow-hidden shadow-inner flex-shrink-0">
                                <img class="w-full h-full object-contain p-1 sub-logo-preview" src="${isUrl ? sub.emoji : ''}" style="${isUrl ? '' : 'display:none;'}" />
                                <div class="text-gray-400 text-xs font-bold uppercase tracking-wider text-center p-1 sub-logo-placeholder" style="${isUrl ? 'display:none;' : ''}">${sub.emoji || '🏢'}</div>
                            </div>
                            <div class="flex flex-col gap-1 w-full sm:w-auto">
                                <div class="flex gap-2">
                                    <button type="button" onclick="triggerSubLogoUpload('${sub.id}')" class="bg-white border border-gray-300 hover:bg-gray-50 text-[10px] font-bold py-1 px-2.5 rounded-lg shadow-sm transition-colors text-gray-700">
                                        <i class="fa-solid fa-upload mr-1"></i>อัปโหลดโลโก้
                                    </button>
                                    <button type="button" onclick="clearSubLogo('${sub.id}')" class="bg-red-50 hover:bg-red-100 text-red-600 text-[10px] font-bold py-1 px-2.5 rounded-lg transition-colors">
                                        <i class="fa-solid fa-trash-can mr-1"></i>ลบ
                                    </button>
                                </div>
                                <input type="file" id="sub-file-${sub.id}" accept="image/*" class="hidden" onchange="previewSubLogo('${sub.id}', this)" />
                                <input type="text" class="w-full sm:w-64 bg-white border border-gray-300 text-gray-900 text-xs rounded-lg p-1 px-2 sub-emoji" value="${sub.emoji || '🏢'}" id="sub-val-${sub.id}">
                            </div>
                        </div>
                    </div>
                    
                    <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div class="space-y-1">
                            <label class="text-xs font-bold text-gray-600">ชื่อบริษัท (Name)</label>
                            <input type="text" class="w-full bg-white border border-gray-300 text-gray-900 text-sm rounded-lg p-2 sub-name" value="${sub.name || ''}">
                        </div>
                        <div class="space-y-1">
                            <label class="text-xs font-bold text-gray-600">สโลแกน / หัวข้อย่อย (Title)</label>
                            <input type="text" class="w-full bg-white border border-gray-300 text-gray-900 text-sm rounded-lg p-2 sub-title" value="${sub.title || ''}">
                        </div>
                    </div>
                    
                    <div class="space-y-1">
                        <label class="text-xs font-bold text-gray-600">คำอธิบายรายละเอียด (Description)</label>
                        <textarea rows="3" class="w-full bg-white border border-gray-300 text-gray-900 text-sm rounded-lg p-2 sub-desc">${sub.description || ''}</textarea>
                    </div>
                    
                    <div class="flex justify-end pt-1 border-t border-gray-100/50">
                        <button type="button" onclick="deleteSubsidiaryCard('${sub.id}')" class="text-red-500 hover:text-red-700 text-xs font-bold flex items-center gap-1.5 transition-colors">
                            <i class="fa-solid fa-trash-can"></i> ลบข้อมูลบริษัทนี้
                        </button>
                    </div>
                </div>
                `;
    }).join('');
}

function renderJobsSettingsList(jobsList) {
    const container = document.getElementById('jobs-list-container');
    if (!container) return;

    if (!jobsList || jobsList.length === 0) {
        container.innerHTML = `<p class="text-gray-500 text-sm text-center py-4 col-span-2">ไม่มีข้อมูลตำแหน่งงานที่เปิดรับ</p>`;
        return;
    }

    container.innerHTML = jobsList.map((job, i) => {
        const tempId = `JOB-${i}-${Date.now()}`;
        return `
                <div class="p-4 border border-gray-200 rounded-xl space-y-3 bg-gray-50/50 hover:border-indigo-200 transition-all relative" data-job-id="${tempId}">
                    <div class="flex justify-between items-center border-b border-gray-100 pb-2">
                        <span class="text-xs font-bold text-gray-500"><i class="fa-solid fa-briefcase mr-1"></i> ตำแหน่งงาน #${i + 1}</span>
                        <button type="button" onclick="removeJobPositionCard('${tempId}')" class="text-red-500 hover:text-red-700 text-xs font-bold flex items-center gap-1 transition-colors">
                            <i class="fa-solid fa-trash-can"></i> ลบ
                        </button>
                    </div>
                    <div class="space-y-2">
                        <div class="space-y-1">
                            <label class="text-[11px] font-bold text-gray-500">ชื่อตำแหน่ง (Job Title)</label>
                            <input type="text" class="w-full bg-white border border-gray-300 text-gray-900 text-sm rounded-lg p-2 job-title" value="${escapeHtml(job.title || '')}" placeholder="เช่น นักพัฒนาซอฟต์แวร์">
                        </div>
                        <div class="grid grid-cols-2 gap-2">
                            <div class="space-y-1">
                                <label class="text-[11px] font-bold text-gray-500">แผนก (Department)</label>
                                <input type="text" class="w-full bg-white border border-gray-300 text-gray-900 text-sm rounded-lg p-2 job-dept" value="${escapeHtml(job.dept || '')}" placeholder="เช่น แผนกเทคโนโลยี">
                            </div>
                            <div class="space-y-1">
                                <label class="text-[11px] font-bold text-gray-500">จำนวนที่เปิดรับ (Badge)</label>
                                <input type="text" class="w-full bg-white border border-gray-300 text-gray-900 text-sm rounded-lg p-2 job-badge" value="${escapeHtml(job.badge || '')}" placeholder="เช่น 2 อัตรา">
                            </div>
                        </div>
                    </div>
                </div>
                `;
    }).join('');
}

function addNewJobPositionCard() {
    const container = document.getElementById('jobs-list-container');
    if (!container) return;

    const emptyPlaceholder = container.querySelector('p.text-gray-500');
    if (emptyPlaceholder) emptyPlaceholder.remove();

    const tempId = `JOB-NEW-${Date.now()}`;
    const count = container.querySelectorAll('[data-job-id]').length + 1;

    const cardHtml = `
            <div class="p-4 border border-dashed border-indigo-300 rounded-xl space-y-3 bg-indigo-50/10 hover:border-indigo-400 transition-all relative" data-job-id="${tempId}">
                <div class="flex justify-between items-center border-b border-gray-100 pb-2">
                    <span class="text-xs font-bold text-brandindigo"><i class="fa-solid fa-briefcase mr-1"></i> ตำแหน่งงาน #${count} (ใหม่)</span>
                    <button type="button" onclick="removeJobPositionCard('${tempId}')" class="text-red-500 hover:text-red-700 text-xs font-bold flex items-center gap-1 transition-colors">
                        <i class="fa-solid fa-trash-can"></i> ลบ
                    </button>
                </div>
                <div class="space-y-2">
                    <div class="space-y-1">
                        <label class="text-[11px] font-bold text-gray-500">ชื่อตำแหน่ง (Job Title)</label>
                        <input type="text" class="w-full bg-white border border-indigo-200 text-gray-900 text-sm rounded-lg p-2 job-title" value="" placeholder="เช่น นักพัฒนาซอฟต์แวร์">
                    </div>
                    <div class="grid grid-cols-2 gap-2">
                            <label class="text-[11px] font-bold text-gray-500">แผนก (Department)</label>
                            <input type="text" class="w-full bg-white border border-gray-300 text-gray-900 text-sm rounded-lg p-2 job-dept" value="" placeholder="เช่น แผนกเทคโนโลยี">
                        </div>
                        <div class="space-y-1">
                            <label class="text-[11px] font-bold text-gray-500">จำนวนที่เปิดรับ (Badge)</label>
                            <input type="text" class="w-full bg-white border border-gray-300 text-gray-900 text-sm rounded-lg p-2 job-badge" value="" placeholder="เช่น 2 อัตรา">
                        </div>
                    </div>
                </div>
            </div>
            `;
    container.insertAdjacentHTML('beforeend', cardHtml);
}

function removeJobPositionCard(tempId) {
    const card = document.querySelector(`[data-job-id="${tempId}"]`);
    if (card) {
        card.remove();
        const container = document.getElementById('jobs-list-container');
        if (container && container.querySelectorAll('[data-job-id]').length === 0) {
            container.innerHTML = `<p class="text-gray-500 text-sm text-center py-4 col-span-2">ไม่มีข้อมูลตำแหน่งงานที่เปิดรับ</p>`;
        }
    }
}

function addNewSubsidiaryCard() {
    const container = document.getElementById('subsidiaries-list-container');
    if (!container) return;

    // Remove empty list placeholder if it exists
    const emptyPlaceholder = container.querySelector('p.text-gray-500');
    if (emptyPlaceholder) {
        emptyPlaceholder.remove();
    }

    const tempId = `LSTK-TEMP-${Date.now()}`;
    const count = container.querySelectorAll('[data-sub-id]').length + 1;

    const cardHtml = `
            <div class="p-5 border border-dashed border-indigo-300 rounded-xl space-y-4 bg-indigo-50/20 shadow-inner hover:border-indigo-400 transition-all animate-pulse-once" data-sub-id="${tempId}">
                <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b border-gray-100 pb-3">
                    <div class="flex flex-wrap items-center gap-2">
                        <div class="flex items-center gap-1.5">
                            <span class="text-xs font-bold text-gray-600">รหัสอ้างอิง (ID):</span>
                            <input type="text" class="w-36 bg-white border border-indigo-200 text-brandindigo text-xs font-bold rounded-lg p-1.5 uppercase tracking-wider sub-id-input" placeholder="LSTK-XXXX" value="">
                        </div>
                        <span class="text-sm font-bold text-gray-700">ลำดับ:</span>
                        <input type="number" class="w-16 bg-white border border-gray-300 text-gray-900 text-sm rounded-lg p-1 text-center font-bold sub-sort-order" value="${count}">
                        <span class="text-xs text-red-500 font-bold ml-2">(บริษัทใหม่)</span>
                    </div>
                    
                    <!-- Logo Upload controls for Subsidiary -->
                    <div class="flex items-center gap-3 w-full sm:w-auto">
                        <div class="relative w-12 h-12 rounded-lg border border-gray-200 bg-white flex items-center justify-center overflow-hidden shadow-inner flex-shrink-0">
                            <img class="w-full h-full object-contain p-1 sub-logo-preview" src="" style="display:none;" />
                            <div class="text-gray-400 text-xs font-bold uppercase tracking-wider text-center p-1 sub-logo-placeholder">🏢</div>
                        </div>
                        <div class="flex flex-col gap-1 w-full sm:w-auto">
                            <div class="flex gap-2">
                                <button type="button" onclick="triggerSubLogoUpload('${tempId}')" class="bg-white border border-gray-300 hover:bg-gray-50 text-[10px] font-bold py-1 px-2.5 rounded-lg shadow-sm transition-colors text-gray-700">
                                    <i class="fa-solid fa-upload mr-1"></i>อัปโหลดโลโก้
                                </button>
                                <button type="button" onclick="clearSubLogo('${tempId}')" class="bg-red-50 hover:bg-red-100 text-red-600 text-[10px] font-bold py-1 px-2.5 rounded-lg transition-colors">
                                    <i class="fa-solid fa-trash-can mr-1"></i>ลบ
                                </button>
                            </div>
                            <input type="file" id="sub-file-${tempId}" accept="image/*" class="hidden" onchange="previewSubLogo('${tempId}', this)" />
                            <input type="text" class="w-full sm:w-64 bg-white border border-gray-300 text-gray-900 text-xs rounded-lg p-1 px-2 sub-emoji" value="🏢" id="sub-val-${tempId}">
                        </div>
                    </div>
                </div>
                
                <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div class="space-y-1">
                        <label class="text-xs font-bold text-gray-600">ชื่อบริษัท (Name) <span class="text-red-500">*</span></label>
                        <input type="text" class="w-full bg-white border border-gray-300 text-gray-900 text-sm rounded-lg p-2 sub-name" placeholder="ชื่อบริษัทเต็ม..." value="">
                    </div>
                    <div class="space-y-1">
                        <label class="text-xs font-bold text-gray-600">สโลแกน / หัวข้อย่อย (Title)</label>
                        <input type="text" class="w-full bg-white border border-gray-300 text-gray-900 text-sm rounded-lg p-2 sub-title" placeholder="เช่น HEALTH CENTER..." value="">
                    </div>
                </div>
                
                <div class="space-y-1">
                    <label class="text-xs font-bold text-gray-600">คำอธิบายรายละเอียด (Description)</label>
                    <textarea rows="3" class="w-full bg-white border border-gray-300 text-gray-900 text-sm rounded-lg p-2 sub-desc" placeholder="คำอธิบายสั้นๆ ของธุรกิจย่อยนี้..."></textarea>
                </div>
                
                <div class="flex justify-end pt-1">
                    <button type="button" onclick="removeUnsavedSubCard('${tempId}')" class="text-red-500 hover:text-red-700 text-xs font-bold flex items-center gap-1">
                        <i class="fa-solid fa-xmark"></i> ยกเลิกบริษัทย่อยนี้
                    </button>
                </div>
            </div>
            `;

    container.insertAdjacentHTML('beforeend', cardHtml);

    const newCard = container.querySelector(`[data-sub-id="${tempId}"]`);
    if (newCard) {
        newCard.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
}

function removeUnsavedSubCard(tempId) {
    const card = document.querySelector(`[data-sub-id="${tempId}"]`);
    if (card) {
        card.remove();

        const container = document.getElementById('subsidiaries-list-container');
        if (container && container.querySelectorAll('[data-sub-id]').length === 0) {
            container.innerHTML = `<p class="text-gray-500 text-sm text-center py-4">ไม่มีข้อมูลบริษัทในเครือ</p>`;
        }
    }
}

function deleteSubsidiaryCard(subId) {
    showConfirmModal(
        'ยืนยันการลบบริษัท',
        `คุณแน่ใจหรือไม่ว่าต้องการลบบริษัท <b>${subId}</b>?<br><span class="text-[11px] text-red-500 mt-2 block uppercase tracking-widest font-medium">การลบนี้จะมีผลถาวรหลังจากคลิก "บันทึกทั้งหมด"</span>`,
        () => {
            deletedSubsidiaries.push(subId);
            const card = document.querySelector(`[data-sub-id="${subId}"]`);
            if (card) {
                card.remove();
            }
            const container = document.getElementById('subsidiaries-list-container');
            if (container && container.querySelectorAll('[data-sub-id]').length === 0) {
                container.innerHTML = `<p class="text-gray-500 text-sm text-center py-4">ไม่มีข้อมูลบริษัทในเครือ</p>`;
            }
        }
    );
}

function saveCompanySettings() {
    toggleLoading(true, 'SAVING COMPANY INFO...');

    const logoValue = document.getElementById('comp-logo-url').value;

    // Gather Careers/Jobs inputs
    const jobsUpdates = [];
    const jobCards = document.querySelectorAll('[data-job-id]');
    jobCards.forEach(card => {
        const title = card.querySelector('.job-title').value.trim();
        const dept = card.querySelector('.job-dept').value.trim();
        const badge = card.querySelector('.job-badge').value.trim();
        if (title) {
            jobsUpdates.push({ title, dept, badge });
        }
    });
    const doSave = (finalLogoUrl, finalSubUpdates) => {
        const infoUpdates = [
            { key: 'about_title', value: document.getElementById('comp-about-title').value },
            { key: 'about_desc', value: document.getElementById('comp-about-desc').value },
            { key: 'vision', value: document.getElementById('comp-vision').value },
            { key: 'values_desc', value: document.getElementById('comp-values').value },
            { key: 'subsidiaries_desc', value: document.getElementById('comp-subsidiaries-desc').value },
            { key: 'mission_mastering', value: document.getElementById('comp-mission-mastering').value },
            { key: 'mission_commanding', value: document.getElementById('comp-mission-commanding').value },
            { key: 'mission_unifying', value: document.getElementById('comp-mission-unifying').value },
            { key: 'company_logo', value: finalLogoUrl },
            { key: 'careers', value: JSON.stringify(jobsUpdates) },
            { key: 'contact_address', value: document.getElementById('comp-address').value },
            { key: 'contact_facebook', value: document.getElementById('comp-facebook').value },
            { key: 'contact_instagram', value: document.getElementById('comp-instagram').value },
            { key: 'contact_line', value: document.getElementById('comp-line').value },
            { key: 'map_lat', value: document.getElementById('comp-map-lat').value },
            { key: 'map_lng', value: document.getElementById('comp-map-lng').value },
            { key: 'map_label', value: document.getElementById('comp-map-label').value }
        ];

        google.script.run.withSuccessHandler(res => {
            toggleLoading(false);
            if (res.success) {
                showToast('บันทึกข้อมูลบริษัทสำเร็จแล้ว!', 'success');
                loadCompanySettings(); // Reload to refresh list with actual IDs
            } else {
                showToast(res.message || 'บันทึกข้อมูลไม่สำเร็จ', 'error');
            }
        }).saveCompanyProfile(infoUpdates, finalSubUpdates, deletedSubsidiaries);
    };

    // 1. Gather all inputs & validate
    const subUpdatesRaw = [];
    const subCards = document.querySelectorAll('[data-sub-id]');
    let hasError = false;

    subCards.forEach(card => {
        if (hasError) return;

        let id = card.getAttribute('data-sub-id');
        const idInput = card.querySelector('.sub-id-input');
        if (idInput) {
            id = idInput.value.trim().toUpperCase();
            if (!id) {
                showToast('กรุณาระบุ รหัสอ้างอิง (ID) สำหรับบริษัทใหม่', 'warning');
                idInput.focus();
                hasError = true;
                return;
            }
            if (id.startsWith('LSTK-TEMP-')) {
                showToast('รหัสอ้างอิง (ID) ไม่สามารถขึ้นต้นด้วย LSTK-TEMP-', 'warning');
                idInput.focus();
                hasError = true;
                return;
            }
        }

        const name = card.querySelector('.sub-name').value.trim();
        if (!name) {
            showToast('กรุณาระบุ ชื่อบริษัท', 'warning');
            card.querySelector('.sub-name').focus();
            hasError = true;
            return;
        }

        const title = card.querySelector('.sub-title').value;
        const description = card.querySelector('.sub-desc').value;
        const emoji = card.querySelector('.sub-emoji').value;
        const sort_order = Number(card.querySelector('.sub-sort-order').value || 99);

        subUpdatesRaw.push({ id, name, title, description, emoji, sort_order });
    });

    if (hasError) {
        toggleLoading(false);
        return;
    }

    // 2. Identify what needs to be uploaded
    const uploadPromises = [];

    // A. Check main logo
    let mainLogoPromise;
    if (logoValue && logoValue.startsWith('data:image')) {
        const fileInput = document.getElementById('comp-logo-file');
        const file = fileInput.files[0];
        const fileName = file ? file.name : 'logo.png';
        mainLogoPromise = new Promise((resolve, reject) => {
            google.script.run.withSuccessHandler(res => {
                if (res.success) resolve(res.url);
                else reject(new Error(res.message));
            }).withFailureHandler(reject).uploadImageToDrive(logoValue, fileName);
        });
    } else {
        mainLogoPromise = Promise.resolve(logoValue);
    }
    uploadPromises.push(mainLogoPromise);

    // B. Check subsidiaries logos
    subUpdatesRaw.forEach((sub, index) => {
        let subLogoPromise;
        if (sub.emoji && sub.emoji.startsWith('data:image')) {
            const fileInput = document.getElementById(`sub-file-${sub.id}`) || document.getElementById(`sub-file-${subCards[index].getAttribute('data-sub-id')}`);
            const file = fileInput ? fileInput.files[0] : null;
            const fileName = file ? file.name : `${sub.id}-logo.png`;
            subLogoPromise = new Promise((resolve, reject) => {
                google.script.run.withSuccessHandler(res => {
                    if (res.success) resolve({ index, url: res.url });
                    else reject(new Error(res.message));
                }).withFailureHandler(reject).uploadImageToDrive(sub.emoji, fileName);
            });
        } else {
            subLogoPromise = Promise.resolve({ index, url: sub.emoji });
        }
        uploadPromises.push(subLogoPromise);
    });

    // 3. Run all uploads in parallel
    Promise.all(uploadPromises)
        .then(results => {
            const finalMainLogoUrl = results[0];
            const subResults = results.slice(1);

            // Map uploaded URLs back to subUpdatesRaw
            subResults.forEach(item => {
                subUpdatesRaw[item.index].emoji = item.url;
            });

            // Proceed to save
            doSave(finalMainLogoUrl, subUpdatesRaw);
        })
        .catch(err => {
            toggleLoading(false);
            showToast('อัปโหลดไฟล์ล้มเหลว: ' + err.message, 'error');
        });
}

// 📌 ฟังก์ชันจัดการคลิกดาวในฟอร์ม (เอาไปวางไว้ล่างสุดของสคริปต์)
function setFormStarRating(rating) {
    document.getElementById('hidden-star-input').value = rating;
    document.getElementById('form-star-text').innerText = rating + ' / 5';

    for (let i = 1; i <= 5; i++) {
        let star = document.getElementById('form-star-' + i);
        if (star) {
            if (i <= rating) {
                star.className = 'fa-solid fa-star text-yellow-400 text-3xl cursor-pointer hover:scale-110 transition-transform mx-1';
            } else {
                star.className = 'fa-regular fa-star text-gray-300 text-3xl cursor-pointer hover:scale-110 transition-transform mx-1';
            }
        }
    }
}
// ==========================================
// 🕒 ฟังก์ชันสำหรับแสดง Popup ประวัติการได้ดาว
// ==========================================
function escapeHtml(value) {
    return String(value === undefined || value === null ? '' : value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function normalizeRatingPhoto(photoUrl, fallbackName) {
    let src = photoUrl && photoUrl !== '-' ? String(photoUrl).trim() : '';
    if (src && src.includes('drive.google.com')) {
        let fileId = '';
        if (src.includes('id=')) fileId = src.split('id=')[1].split('&')[0];
        else if (src.includes('/d/')) fileId = src.split('/d/')[1].split('/')[0];
        if (fileId) src = 'https://drive.google.com/thumbnail?id=' + fileId + '&sz=w500';
    }
    if (!src) src = 'https://ui-avatars.com/api/?background=e0e7ff&color=4f46e5&bold=true&name=' + encodeURIComponent(fallbackName || 'Staff');
    return src;
}

function buildRatingTemplateForStaff(empId, firstName) {
    const template = {};
    (currentHeaders || []).forEach(h => {
        const key = String(h).toLowerCase().trim();
        template[h] = '';
        if (key === 'employees id' || key === 'employee_id' || key === 'emp_id') template[h] = empId;
        else if (key === 'employees name' || key === 'employee_name' || key === 'first_name' || key === 'name') template[h] = firstName;
        else if (key === 'ranting date' || key === 'rating date' || key === 'date') template[h] = new Date().toISOString().slice(0, 10);
        else if (key === 'status') template[h] = 'Active';
        else if (key === 'give by' || key === 'give_by') {
            let sessionUser = {};
            try {
                sessionUser = JSON.parse(localStorage.getItem('hr_user_session') || sessionStorage.getItem('hr_user_session') || '{}');
            } catch (e) { sessionUser = {}; }
            template[h] = sessionUser.username || sessionUser.empId || '';
        }
    });
    return encodeURIComponent(JSON.stringify(template)).replace(/'/g, "%27");
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

    // --- 🛠️ 1. เพิ่มระบบดึงข้อมูลจาก ID ป้องกันการส่งข้อมูลยาวๆ ผ่านปุ่ม ---
    if (!window.editRatingByRowId) {
        window.editRatingByRowId = function (rowId, event) {
            if (event) event.stopPropagation();
            const rawData = tableCache[currentSheet] ? tableCache[currentSheet].data : [];
            const row = rawData.find(r => String(getRecordId(r)) === String(rowId));
            if (row) {
                openFormModal(encodeURIComponent(JSON.stringify(row)).replace(/'/g, "%27"));
            }
        };
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
    }
    // --------------------------------------------------------

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
        const safeComment = escapeHtml(stat.latestComment || 'ยังไม่มีคอมเมนต์');
        const safeNameUrl = encodeURIComponent(firstName);
        const safeNameJs = String(firstName).replace(/\\/g, '\\\\').replace(/'/g, "\\'");

        // 🛠️ 2. ดึงค่า ID มาเตรียมไว้
        const safeRowId = String(stat.latestRowId || '').replace(/\\/g, '\\\\').replace(/'/g, "\\'");

        const barsHtml = getRatingCategories().map(cat => {
            const val = Math.max(0, Math.min(5, parseFloat(stat.categoryScores[cat]) || 0));
            const pct = Math.round((val / 5) * 100);
            return `<div class="flex items-center justify-between text-xs mb-3"><span class="w-[45%] ${pct ? 'text-gray-700 font-bold' : 'text-gray-400 font-medium'} truncate">${escapeHtml(cat)}</span><div class="w-[45%] h-1.5 bg-gray-100 flex-1 mx-3 overflow-hidden rounded-full shadow-inner"><div class="h-full ${pct ? 'bg-gradient-to-r from-brandindigo to-brandpurple' : 'bg-gray-200'} rounded-full" style="width:${pct}%"></div></div><span class="w-[10%] text-right text-gray-500 font-bold text-[10px]">${pct}%</span></div>`;
        }).join('');

        // 🛠️ 3. แก้ไขปุ่มกด ให้เรียกฟังก์ชันใหม่ที่ส่งไปแค่ ID
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
                        <div class="flex justify-center items-center mt-5 mb-2 bg-gray-50/50 py-2.5 mx-6 rounded-xl border border-gray-100">${starsHtml}</div>
                        <p class="text-center text-sm font-black text-brandindigo">${avg} / 5 <span class="text-gray-400 font-bold text-xs">(${stat.count} rating)</span></p>
                        <div class="px-7 mt-5">${barsHtml}</div>
                        <div class="px-6 mt-4"><div class="text-xs text-gray-500 italic text-center bg-gray-50 p-3 rounded-xl border border-gray-100">${safeComment}</div></div>
                    </div>`;
    });

    cardWrapper.innerHTML = html;
}

function showRatingHistory(empId, empName) {
    // 1. ดึงข้อมูลทั้งหมดจากตาราง Employee Rating
    let rawData = tableCache[currentSheet] ? tableCache[currentSheet].data : [];

    // 2. คัดกรองเอาเฉพาะข้อมูลของพนักงานคนที่ถูกคลิก
    let historyData = rawData.filter(row => {
        let id = String(getFuzzyValue(row, ['employees id', 'emp_id', 'employee_id'])).toUpperCase().trim();
        return id === empId;
    });

    // สลับให้ข้อมูลล่าสุดขึ้นก่อน (ถ้าในชีตเรียงจากเก่าไปใหม่)
    // historyData.reverse(); 

    let modalId = 'history-modal-' + new Date().getTime();

    // 3. สร้างหน้าต่าง Popup
    let html = `
            <div id="${modalId}" class="fixed inset-0 z-[100] flex items-center justify-center bg-gray-900/40 backdrop-blur-sm transition-opacity">
                <div class="bg-white rounded-3xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[85vh] m-4 animate-fade-in-up border border-gray-100">
                    
                    <div class="px-6 py-5 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
                        <div class="flex items-center">
                            <div class="w-10 h-10 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center mr-3">
                                <i class="fa-solid fa-clock-rotate-left text-lg"></i>
                            </div>
                            <div>
                                <h3 class="text-lg font-bold text-gray-800 leading-tight">ประวัติการได้ดาว</h3>
                                <p class="text-xs text-gray-500">${empName} (${empId})</p>
                            </div>
                        </div>
                        <button onclick="document.getElementById('${modalId}').remove()" class="text-gray-400 hover:text-red-500 hover:bg-red-50 w-8 h-8 rounded-full flex items-center justify-center transition-colors">
                            <i class="fa-solid fa-times text-lg"></i>
                        </button>
                    </div>

                    <div class="p-6 overflow-y-auto flex-1 bg-gray-50/30">
                        <div class="space-y-3">
            `;

    if (historyData.length === 0) {
        html += `<div class="text-center text-gray-400 py-10"><i class="fa-solid fa-box-open text-4xl mb-3 opacity-50"></i><br>ไม่พบประวัติการประเมิน</div>`;
    } else {
        historyData.forEach(row => {
            let date = getFuzzyValue(row, ['ranting date', 'date', 'วันที่', 'เดือน']) || '-';
            let category = getFuzzyValue(row, ['category', 'หมวดหมู่']) || '-';
            let stars = parseFloat(getFuzzyValue(row, ['star point', 'star_point', 'ดาว', 'rating', 'score'])) || 0;
            // ดึงชื่อคนให้ดาว (ผู้ประเมิน)
            let giver = getFuzzyValue(row, ['give by', 'given by', 'ผู้ประเมิน', 'ผู้ให้', 'หัวหน้า', 'give_by']) || 'ไม่ระบุตัวตน';
            let comment = getFuzzyValue(row, ['comment', 'review', 'ความคิดเห็น', 'ข้อเสนอแนะ', 'remark']);

            let starsHtml = '';
            for (let i = 1; i <= 5; i++) {
                if (i <= stars) starsHtml += '<i class="fa-solid fa-star text-[#FACC15] text-[10px] mx-[1px]"></i>';
                else starsHtml += '<i class="fa-regular fa-star text-gray-200 text-[10px] mx-[1px]"></i>';
            }

            html += `
                    <div class="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm hover:shadow-md hover:border-blue-200 transition-all flex flex-col md:flex-row md:items-center justify-between gap-3">
                        <div class="flex-1">
                            <div class="flex items-center gap-2 mb-1.5">
                                <span class="font-bold text-gray-800 text-sm">${category}</span>
                                <span class="text-[10px] bg-blue-50 text-blue-600 px-2 py-0.5 rounded-md font-bold tracking-wider uppercase border border-blue-100"><i class="fa-regular fa-calendar mr-1"></i>${date}</span>
                            </div>
                            <p class="text-xs text-gray-500 mb-1"><i class="fa-solid fa-user-pen mr-1.5 text-gray-400"></i>ให้ดาวโดย: <span class="font-bold text-gray-700">${giver}</span></p>
                            ${comment && comment !== '-' ? `<p class="text-[11px] text-gray-400 italic bg-gray-50 p-2 rounded-lg mt-2 border border-gray-100">"${comment}"</p>` : ''}
                        </div>
                        <div class="flex flex-col items-end justify-center bg-gray-50/80 px-4 py-2 rounded-xl border border-gray-100 md:min-w-[120px]">
                            <div class="flex items-center mb-1">${starsHtml}</div>
                            <span class="text-[10px] font-bold text-gray-400">ได้มา <span class="text-gray-800 text-sm">${stars}</span> ดาว</span>
                        </div>
                    </div>`;
        });
    }

    html += `
                        </div>
                    </div>
                    
                    <div class="p-4 border-t border-gray-100 bg-white flex justify-end">
                        <button onclick="document.getElementById('${modalId}').remove()" class="px-6 py-2.5 bg-gray-900 hover:bg-gray-800 text-white rounded-xl text-sm font-bold transition-colors shadow-lg shadow-gray-200">ปิดหน้าต่าง</button>
                    </div>
                </div>
            </div>`;

    // นำ Popup ไปแปะไว้หน้าสุดของเว็บไซต์
    document.body.insertAdjacentHTML('beforeend', html);
}

//----------------------------
// ========================================================
// 📱 ฟังก์ชันสำหรับแสดง Popup รูป QR Code ประจำตัวพนักงาน
// ========================================================
function showEmpQRCode(empId, encodedName) {
    // 1. แปลงชื่อกลับมาให้อ่านได้ปกติ
    let empName = decodeURIComponent(encodedName);
    let modalId = 'qr-modal-' + new Date().getTime();

    // 2. สร้างโครงสร้าง HTML สำหรับ Popup
    let html = `
            <div id="${modalId}" class="fixed inset-0 z-[130] flex items-center justify-center bg-gray-900/60 backdrop-blur-sm transition-opacity">
                <div class="bg-white rounded-3xl shadow-2xl w-full max-w-sm overflow-hidden flex flex-col m-4 animate-fade-in-up border border-gray-100 p-8 text-center relative transform scale-95 transition-transform duration-300" id="${modalId}-box">
                    
                    <button onclick="closeEmpQRCode('${modalId}')" class="absolute top-4 right-4 text-gray-400 hover:text-red-500 bg-gray-50 hover:bg-red-50 w-8 h-8 rounded-full flex items-center justify-center transition-colors">
                        <i class="fa-solid fa-times text-lg"></i>
                    </button>
 
                    <div class="w-16 h-16 rounded-full bg-indigo-50 text-brandindigo flex items-center justify-center mx-auto mb-4 shadow-sm">
                        <i class="fa-solid fa-qrcode text-3xl"></i>
                    </div>

                    <h3 class="text-xl font-bold text-gray-900 mb-1 tracking-tight">QR Code ประจำตัว</h3>
                    <p class="text-sm font-bold text-gray-500 mb-6">${empName} <br><span class="text-brandindigo tracking-wider">${empId}</span></p>

                    <div class="flex justify-center bg-white p-4 rounded-2xl border border-gray-200 shadow-inner inline-block mx-auto">
                        <div id="qr-container-${modalId}"></div>
                    </div>

                    <div class="mt-8">
                         <button onclick="closeEmpQRCode('${modalId}')" class="w-full px-5 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl text-sm font-bold transition-colors shadow-sm">ปิดหน้าต่าง</button>
                    </div>
                </div>
            </div>`;

    // 3. นำ Popup ไปแปะไว้ที่หน้าเว็บ
    document.body.insertAdjacentHTML('beforeend', html);

    // ทำให้มี Animation เด้งขึ้นมา
    setTimeout(() => {
        let box = document.getElementById(`${modalId}-box`);
        if (box) {
            box.classList.remove('scale-95');
            box.classList.add('scale-100');
        }
    }, 10);

    // 4. สั่งวาด QR Code ใส่ลงไปในกล่องที่เตรียมไว้
    let qrContainer = document.getElementById(`qr-container-${modalId}`);
    new QRCode(qrContainer, {
        text: empId, // นำรหัสพนักงานมาสร้างเป็น QR Code
        width: 160,
        height: 160,
        colorDark: "#0f172a",
        colorLight: "#ffffff",
        correctLevel: QRCode.CorrectLevel.H
    });
}

// ฟังก์ชันสำหรับปิด Popup QR Code พร้อม Animation
function closeEmpQRCode(modalId) {
    let modal = document.getElementById(modalId);
    let box = document.getElementById(`${modalId}-box`);
    if (modal && box) {
        modal.classList.add('opacity-0');
        box.classList.remove('scale-100');
        box.classList.add('scale-95');
        setTimeout(() => {
            modal.remove();
        }, 300);
    }
}

/* =====================================================================
 * 📌 ส่วนที่ 22: QR SCANNER FOR RATING (สแกน QR เพื่อให้ดาวพนักงาน)
 * - เปิดกล้อง, อ่าน QR Code ของพนักงาน, แล้วเปิดฟอร์มให้ดาวทันที
 * ===================================================================== */
let _qrScannerStream = null;
let _qrScannerAnimFrame = null;
const QR_SCANNER_MODAL_ID = 'qr-rating-scanner-modal';

function openQRScanner() {
    // ป้องกันเปิดซ้ำ
    if (document.getElementById(QR_SCANNER_MODAL_ID)) return;

    const modalHtml = `
            <div id="${QR_SCANNER_MODAL_ID}" class="fixed inset-0 z-[200] flex items-center justify-center bg-gray-950/80 backdrop-blur-md"
                 style="animation: qrFadeIn 0.3s ease;">
                <div id="${QR_SCANNER_MODAL_ID}-box" class="relative w-full max-w-sm mx-4 flex flex-col items-center"
                     style="animation: qrSlideUp 0.35s cubic-bezier(.22,1,.36,1);">

                    <!-- Header -->
                    <div class="w-full flex items-center justify-between mb-4 px-1">
                        <div class="flex items-center gap-3">
                            <div class="w-10 h-10 rounded-full bg-emerald-500/20 border border-emerald-400/40 flex items-center justify-center">
                                <i class="fa-solid fa-camera text-emerald-400 text-lg"></i>
                            </div>
                            <div>
                                <h3 class="text-white font-bold text-base leading-tight">สแกน QR ให้ดาว</h3>
                                <p class="text-gray-400 text-xs">เล็งกล้องไปที่ QR Code ประจำตัวพนักงาน</p>
                            </div>
                        </div>
                        <button onclick="closeQRScanner()" class="w-9 h-9 rounded-full bg-white/10 hover:bg-red-500/30 text-gray-300 hover:text-white flex items-center justify-center transition-all border border-white/10">
                            <i class="fa-solid fa-xmark text-base"></i>
                        </button>
                    </div>

                    <!-- Camera Viewfinder -->
                    <div class="relative w-full rounded-3xl overflow-hidden bg-black border border-white/10 shadow-2xl" style="aspect-ratio:1/1;">
                        <video id="qr-scanner-video" autoplay playsinline muted class="w-full h-full object-cover"></video>
                        <canvas id="qr-scanner-canvas" class="hidden"></canvas>

                        <!-- Overlay corners (scanner frame) -->
                        <div class="absolute inset-0 flex items-center justify-center pointer-events-none">
                            <div class="relative w-52 h-52">
                                <!-- Top-left -->
                                <div class="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 border-emerald-400 rounded-tl-lg" style="box-shadow: -2px -2px 0 0 rgba(52,211,153,0.3);"></div>
                                <!-- Top-right -->
                                <div class="absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 border-emerald-400 rounded-tr-lg" style="box-shadow: 2px -2px 0 0 rgba(52,211,153,0.3);"></div>
                                <!-- Bottom-left -->
                                <div class="absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 border-emerald-400 rounded-bl-lg" style="box-shadow: -2px 2px 0 0 rgba(52,211,153,0.3);"></div>
                                <!-- Bottom-right -->
                                <div class="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 border-emerald-400 rounded-br-lg" style="box-shadow: 2px 2px 0 0 rgba(52,211,153,0.3);"></div>
                                <!-- Scan line -->
                                <div id="qr-scan-line" class="absolute left-2 right-2 h-0.5 bg-gradient-to-r from-transparent via-emerald-400 to-transparent rounded-full top-0"
                                     style="animation: qrScanLine 2s ease-in-out infinite; box-shadow: 0 0 8px 2px rgba(52,211,153,0.6);"></div>
                            </div>
                        </div>

                        <!-- Status overlay -->
                        <div id="qr-scan-status" class="absolute bottom-4 left-4 right-4 flex items-center justify-center">
                            <div class="bg-black/60 backdrop-blur-sm border border-white/10 rounded-2xl px-4 py-2 flex items-center gap-2">
                                <div class="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></div>
                                <span id="qr-scan-status-text" class="text-white text-xs font-bold tracking-wide">กำลังเปิดกล้อง...</span>
                            </div>
                        </div>

                        <!-- Success Flash -->
                        <div id="qr-success-flash" class="absolute inset-0 bg-emerald-400/30 rounded-3xl hidden pointer-events-none" style="transition:opacity 0.3s;"></div>
                    </div>

                    <!-- Manual Input -->
                    <div class="w-full mt-4 bg-white/5 border border-white/10 rounded-2xl p-4 backdrop-blur-sm">
                        <p class="text-gray-400 text-xs font-bold uppercase tracking-widest mb-3 text-center">หรือพิมพ์รหัสพนักงานด้วยตนเอง</p>
                        <div class="flex gap-2">
                            <input id="qr-manual-empid" type="text" placeholder="เช่น PM001, EMP001..."
                                class="flex-1 bg-white/10 border border-white/20 text-white placeholder-gray-500 rounded-xl px-4 py-2.5 text-sm font-bold uppercase tracking-widest focus:outline-none focus:ring-2 focus:ring-emerald-400/50 focus:border-emerald-400/50 transition-all"
                                onkeydown="if(event.key==='Enter'){submitQRResult(this.value.trim().toUpperCase())}">
                            <button onclick="submitQRResult(document.getElementById('qr-manual-empid').value.trim().toUpperCase())"
                                class="bg-emerald-500 hover:bg-emerald-400 text-white font-bold px-5 py-2.5 rounded-xl text-sm transition-all shadow-lg shadow-emerald-500/30 whitespace-nowrap">
                                <i class="fa-solid fa-arrow-right"></i>
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            <style id="qr-scanner-styles">
                @keyframes qrFadeIn { from { opacity: 0; } to { opacity: 1; } }
                @keyframes qrSlideUp { from { transform: translateY(30px) scale(0.95); opacity: 0; } to { transform: translateY(0) scale(1); opacity: 1; } }
                @keyframes qrScanLine { 0% { top: 8px; opacity: 1; } 45% { top: calc(100% - 8px); opacity: 1; } 50% { opacity: 0; } 55% { top: 8px; opacity: 0; } 60% { opacity: 1; } 100% { top: calc(100% - 8px); opacity: 1; } }
            </style>`;

    document.body.insertAdjacentHTML('beforeend', modalHtml);
    _startQRCamera();
}

async function _startQRCamera() {
    const video = document.getElementById('qr-scanner-video');
    const statusText = document.getElementById('qr-scan-status-text');
    if (!video) return;

    try {
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
            throw new Error("getUserMedia not supported");
        }

        let stream;
        try {
            stream = await navigator.mediaDevices.getUserMedia({
                video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 1280 } }
            });
        } catch (e) {
            stream = await navigator.mediaDevices.getUserMedia({ video: true });
        }

        _qrScannerStream = stream;
        video.srcObject = stream;
        video.setAttribute("playsinline", "true");

        video.onloadedmetadata = async () => {
            try {
                await video.play();
                if (statusText) statusText.textContent = 'เล็งกล้องไปที่ QR Code ของพนักงาน';
                _qrScannerAnimFrame = requestAnimationFrame(_tickQRScan);
            } catch (err) {
                if (statusText) statusText.textContent = 'แตะที่หน้าจอเพื่อเริ่มกล้อง';
                video.onclick = async () => {
                    await video.play();
                    if (statusText) statusText.textContent = 'เล็งกล้องไปที่ QR Code ของพนักงาน';
                    _qrScannerAnimFrame = requestAnimationFrame(_tickQRScan);
                };
            }
        };
    } catch (err) {
        console.warn('QR Camera error:', err); alert('Camera Error: ' + (err.message || err.name || err));

        if (statusText) {
            statusText.innerHTML = '<i class="fa-solid fa-upload mr-2"></i>แตะเพื่ออัปโหลดรูป QR Code';
            statusText.parentElement.classList.add('cursor-pointer', 'hover:bg-black/80', 'transition-colors');

            let fileInput = document.getElementById('qr-fallback-upload');
            if (!fileInput) {
                fileInput = document.createElement('input');
                fileInput.type = 'file';
                fileInput.id = 'qr-fallback-upload';
                fileInput.accept = 'image/*';
                fileInput.className = 'hidden';

                fileInput.onchange = function (e) {
                    const file = e.target.files[0];
                    if (!file) return;
                    const reader = new FileReader();
                    reader.onload = function (event) {
                        const img = new Image();
                        img.onload = function () {
                            const canvas = document.getElementById('qr-scanner-canvas');
                            if (!canvas) return;
                            canvas.width = img.width;
                            canvas.height = img.height;
                            const ctx = canvas.getContext('2d');
                            ctx.drawImage(img, 0, 0, img.width, img.height);
                            const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
                            if (typeof jsQR === 'function') {
                                const code = jsQR(imageData.data, imageData.width, imageData.height, { inversionAttempts: 'dontInvert' });
                                if (code && code.data) {
                                    if (typeof _onQRDetected === 'function') _onQRDetected(code.data.trim().toUpperCase());
                                } else {
                                    alert('ไม่พบ QR Code ในรูปภาพ กรุณาลองใหม่');
                                }
                            }
                        };
                        img.src = event.target.result;
                    };
                    reader.readAsDataURL(file);
                };
                document.body.appendChild(fileInput);
            }
            statusText.parentElement.onclick = () => fileInput.click();
        }

        const dot = document.querySelector('#qr-scan-status .w-2');
        if (dot) { dot.classList.remove('bg-emerald-400'); dot.classList.add('bg-amber-400'); }

        video.style.display = 'none';
        const container = video.parentElement;
        let fallbackUI = document.getElementById('qr-fallback-ui');
        if (!fallbackUI) {
            fallbackUI = document.createElement('div');
            fallbackUI.id = 'qr-fallback-ui';
            fallbackUI.className = 'absolute inset-0 flex flex-col items-center justify-center text-gray-500 bg-black';
            fallbackUI.innerHTML = '<i class="fa-solid fa-camera-slash text-4xl mb-3"></i><p class="text-sm font-bold mt-2">ไม่สามารถเปิดกล้องได้</p><p class="text-xs mt-1">กรุณาแตะที่ปุ่มด้านล่างเพื่ออัปโหลดรูป</p>';
            container.appendChild(fallbackUI);
        }
    }
}

let _qrLastScan = 0;
function _tickQRScan() {
    const video = document.getElementById('qr-scanner-video');
    const canvas = document.getElementById('qr-scanner-canvas');
    if (!video || !canvas || video.readyState !== video.HAVE_ENOUGH_DATA) {
        _qrScannerAnimFrame = requestAnimationFrame(_tickQRScan);
        return;
    }

    const now = Date.now();
    if (now - _qrLastScan < 300) { // Throttle: ตรวจสอบทุก 300ms
        _qrScannerAnimFrame = requestAnimationFrame(_tickQRScan);
        return;
    }
    _qrLastScan = now;

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

    if (typeof jsQR === 'function') {
        const code = jsQR(imageData.data, imageData.width, imageData.height, { inversionAttempts: 'dontInvert' });
        if (code && code.data) {
            _onQRDetected(code.data.trim().toUpperCase());
            return; // หยุด loop หลังเจอ QR
        }
    }

    _qrScannerAnimFrame = requestAnimationFrame(_tickQRScan);
}

function _onQRDetected(empId) {
    // แสดง flash success
    const flash = document.getElementById('qr-success-flash');
    const statusText = document.getElementById('qr-scan-status-text');
    if (flash) { flash.classList.remove('hidden'); setTimeout(() => flash.classList.add('hidden'), 600); }
    if (statusText) statusText.textContent = `✅ พบรหัส: ${empId}`;

    // เล่นเสียง beep (ถ้าเบราว์เซอร์รองรับ)
    try {
        const ctx = new (window.AudioContext || window.webkitAudioContext)();
        const osc = ctx.createOscillator(); const gain = ctx.createGain();
        osc.connect(gain); gain.connect(ctx.destination);
        osc.frequency.value = 1200; osc.type = 'sine';
        gain.gain.setValueAtTime(0.3, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.15);
        osc.start(ctx.currentTime); osc.stop(ctx.currentTime + 0.15);
    } catch (e) { }

    setTimeout(() => submitQRResult(empId), 500);
}

function submitQRResult(empId) {
    if (!empId) { showToast('กรุณาระบุรหัสพนักงาน', 'error'); return; }

    // หาชีทพนักงาน
    let staffSheetKey = Object.keys(tableCache).find(k => (k.toLowerCase().includes('staff') || k.toLowerCase() === 'staff') && !k.toLowerCase().includes('rating') && !k.toLowerCase().includes('ranting'));
    if (!staffSheetKey && tableCache['staff']) staffSheetKey = 'staff';
    if (!staffSheetKey && tableCache['Staff']) staffSheetKey = 'Staff';

    const staffData = staffSheetKey && tableCache[staffSheetKey] ? tableCache[staffSheetKey].data : [];
    const empRow = staffData.find(r => String(getFuzzyValue(r, ['employee_id', 'emp_id'])).toUpperCase().trim() === empId);

    if (typeof closeQRScanner === 'function') closeQRScanner();

    if (!empRow) {
        showToast(`ไม่พบพนักงานรหัส "${empId}" ในระบบ`, 'error');
        return;
    }

    let ratingTemplate = {};
    let ratingData = tableCache['Employees Ranting ']?.data || tableCache['Employees Rating']?.data || tableCache['employees_rating']?.data || [];
    let existingRows = ratingData.filter(r => String(getFuzzyValue(r, ['employees id', 'emp_id', 'employee_id'])).toUpperCase().trim() === empId);

    if (existingRows.length > 0) {
        ratingTemplate = Object.assign({}, existingRows[existingRows.length - 1]);

        // 🛑 ลบ ID ทิ้งอย่างเด็ดขาด! เพื่อให้ระบบรู้ว่านี่คือการเพิ่มใหม่ (Add Record) ไม่ใช่การแก้ของเดิม
        delete ratingTemplate.__db_id;
        delete ratingTemplate.id;
    } else {
        let headers = tableCache['Employees Ranting ']?.headers || ['Ranting_Id', 'Employees Id', 'Employees Name', 'Ranting Date', 'Star Point', 'Category ', 'Comment', 'Give By', 'Status'];
        headers.forEach(h => ratingTemplate[h] = '');
    }

    // ล้างข้อมูลเก่าที่ต้องกรอกใหม่
    const keysToClear = ['ranting_id', 'ranting id', 'rating_id', 'rating id', 'star point', 'star_point', 'ดาว', 'rating', 'score', 'category', 'หมวดหมู่', 'comment', 'review', 'ความคิดเห็น', 'ข้อเสนอแนะ', 'remark', 'date', 'วันที่', 'เดือน', 'ranting date', 'give by', 'give_by'];
    Object.keys(ratingTemplate).forEach(k => {
        if (keysToClear.includes(k.toLowerCase().trim())) ratingTemplate[k] = '';
        if (k.toLowerCase().includes('id') && (k.toLowerCase().includes('ranting') || k.toLowerCase().includes('rating'))) ratingTemplate[k] = '';
    });

    // ใส่ชื่อและรหัสให้ตรงกับคนที่สแกน
    Object.keys(ratingTemplate).forEach(k => {
        const lk = k.toLowerCase().trim();
        if (lk === 'employees id' || lk === 'emp_id' || lk === 'employee_id') ratingTemplate[k] = empId;
        const nameVal = getFuzzyValue(empRow, ['first_name', 'name', 'full_name', 'ชื่อ']);
        if (lk === 'employees name' || lk === 'name' || lk === 'ชื่อ' || lk === 'full_name') ratingTemplate[k] = nameVal !== '-' ? nameVal : '';
    });

    // ส่งข้อมูลไปเปิดฟอร์ม
    const encodedTemplate = encodeURIComponent(JSON.stringify(ratingTemplate));
    showToast(`✅ พบพนักงาน ${empId} — กรุณาประเมิน`, 'success');

    setTimeout(() => {
        if (typeof openFormModal === 'function') openFormModal(encodedTemplate);
    }, 300);
}

function closeQRScanner() {
    // หยุด animation frame
    if (_qrScannerAnimFrame) { cancelAnimationFrame(_qrScannerAnimFrame); _qrScannerAnimFrame = null; }
    // หยุดกล้อง
    if (_qrScannerStream) { _qrScannerStream.getTracks().forEach(t => t.stop()); _qrScannerStream = null; }
    // ลบ modal
    const modal = document.getElementById(QR_SCANNER_MODAL_ID);
    if (modal) {
        modal.style.opacity = '0';
        modal.style.transition = 'opacity 0.3s';
        setTimeout(() => modal.remove(), 300);
    }
    // ลบ style
    const style = document.getElementById('qr-scanner-styles');
    if (style) style.remove();
}

function showTrainingDetail(encodedRow) {
    const row = JSON.parse(decodeURIComponent(encodedRow));

    let topic = getFuzzyValue(row, ['course', 'หลักสูตร', 'subject', 'หัวข้อ', 'name', 'ชื่อ', 'detail', 'รายละเอียด'], 1) || '-';
    let photoUrl = getFuzzyValue(row, ['photo', 'รูป', 'pic', 'image', 'รูปภาพ']);
    let dateDetail = getFuzzyValue(row, ['date', 'วันที่', 'เวลา', 'training date', 'วันอบรม']) || '-';
    let status = getFuzzyValue(row, ['status', 'สถานะ', 'ສະຖານະ']) || '-';
    let trainer = getFuzzyValue(row, ['trainer', 'วิทยากร', 'ผู้สอน']) || '-';
    let location = getFuzzyValue(row, ['location', 'สถานที่', 'place', 'venue', 'รูปแบบ']) || '-';
    let ytUrl = getFuzzyValue(row, ['youtube', 'yt', 'ยูทูป', 'video', 'วิดีโอ']);
    let fbUrl = getFuzzyValue(row, ['facebook', 'fb', 'เฟสบุ๊ค', 'เพจ']);
    let generalUrl = getFuzzyValue(row, ['link', 'url', 'ลิงก์', 'เอกสาร']);

    if (photoUrl && photoUrl.includes('drive.google.com')) {
        let fileId = '';
        if (photoUrl.includes('id=')) fileId = photoUrl.split('id=')[1].split('&')[0];
        else if (photoUrl.includes('/d/')) fileId = photoUrl.split('/d/')[1].split('/')[0];
        if (fileId) photoUrl = 'https://drive.google.com/thumbnail?id=' + fileId + '&sz=w1000';
    }

    const imgEl = document.getElementById('train-modal-img');
    const imgContainer = document.getElementById('train-modal-img-container');
    if (photoUrl && photoUrl !== '-' && photoUrl.trim() !== '') {
        imgEl.src = photoUrl;
        imgContainer.classList.remove('hidden'); imgContainer.classList.add('flex');
    } else {
        imgContainer.classList.add('hidden'); imgContainer.classList.remove('flex');
    }

    // ใส่ข้อความ
    document.getElementById('train-modal-topic').innerText = topic;
    document.getElementById('train-modal-status').innerText = status;
    document.getElementById('train-modal-date').innerHTML = `<i class="fa-regular fa-calendar mr-1.5"></i>${dateDetail}`;
    document.getElementById('train-modal-trainer').innerHTML = `<b>วิทยากร:</b> ${trainer}`;
    document.getElementById('train-modal-location').innerHTML = `<b>สถานที่/รูปแบบ:</b> ${location}`;

    // สร้างปุ่มลิงก์
    let linksHtml = '';
    if (ytUrl && ytUrl !== '-' && ytUrl.trim() !== '') {
        linksHtml += `<a href="${ytUrl}" target="_blank" rel="noopener noreferrer" class="flex justify-center px-4 py-3 rounded-xl bg-red-50 hover:bg-red-100 text-red-600 font-bold text-sm transition-colors gap-2"><i class="fa-brands fa-youtube mt-0.5"></i> เรียนผ่าน YouTube</a>`;
    }
    if (fbUrl && fbUrl !== '-' && fbUrl.trim() !== '') {
        linksHtml += `<a href="${fbUrl}" target="_blank" rel="noopener noreferrer" class="flex justify-center px-4 py-3 rounded-xl bg-blue-50 hover:bg-blue-100 text-blue-600 font-bold text-sm transition-colors gap-2"><i class="fa-brands fa-facebook mt-0.5"></i> ดูผ่าน Facebook</a>`;
    }
    if (generalUrl && generalUrl !== '-' && generalUrl.trim() !== '') {
        linksHtml += `<a href="${generalUrl}" target="_blank" rel="noopener noreferrer" class="flex justify-center px-4 py-3 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-brandindigo font-bold text-sm transition-colors gap-2"><i class="fa-solid fa-link mt-0.5"></i> เอกสารประกอบการเรียน</a>`;
    }
    document.getElementById('train-modal-links-container').innerHTML = linksHtml;

    // แสดง Modal
    const modal = document.getElementById('training-modal');
    const modalBox = modal.querySelector('div.bg-white');
    modal.classList.remove('hidden'); void modal.offsetWidth;
    modal.classList.remove('opacity-0'); modalBox.classList.remove('scale-95'); modalBox.classList.add('scale-100');
}

function closeTrainingDetail() {
    const modal = document.getElementById('training-modal');
    const modalBox = modal.querySelector('div.bg-white');
    modal.classList.add('opacity-0'); modalBox.classList.remove('scale-100'); modalBox.classList.add('scale-95');
    setTimeout(() => { modal.classList.add('hidden'); }, 300);
}
// 📚 ฟังก์ชันสำหรับหน้าต่าง Popup การฝึกอบรม (Training)
// ==========================================
// 💻 ฟังก์ชันสำหรับหน้าต่าง Popup ทรัพย์สิน (Assets)
// ==========================================
function showAssetDetail(encodedRow) {
    const row = JSON.parse(decodeURIComponent(encodedRow));

    let name = getFuzzyValue(row, ['asset', 'ทรัพย์สิน', 'name', 'ชื่อ'], 1) || '-';
    let photoUrl = getFuzzyValue(row, ['photo', 'รูป', 'pic', 'image', 'รูปภาพ']);
    let dateDetail = getFuzzyValue(row, ['date', 'วันที่', 'เวลา', 'issue', 'ວັນເລີ່ມໃຊ້ງານ'], 2) || '-';
    let status = getFuzzyValue(row, ['status', 'สถานะ', 'ສະຖານະ']) || 'Active';
    let employee = getFuzzyValue(row, ['employee', 'ผู้ถือครอง', 'ລະຫັດພະນักງານ'], 3) || '-';
    let type = getFuzzyValue(row, ['type', 'ประเภท', 'ປະເພດ'], 4) || '-';
    let assetId = getRecordId(row) || '-';

    // จัดการรูปภาพความละเอียดสูง
    if (photoUrl && photoUrl.includes('drive.google.com')) {
        let fileId = '';
        if (photoUrl.includes('id=')) fileId = photoUrl.split('id=')[1].split('&')[0];
        else if (photoUrl.includes('/d/')) fileId = photoUrl.split('/d/')[1].split('/')[0];
        if (fileId) photoUrl = 'https://drive.google.com/thumbnail?id=' + fileId + '&sz=w1000';
    }

    const imgEl = document.getElementById('asset-modal-img');
    const imgContainer = document.getElementById('asset-modal-img-container');
    if (photoUrl && photoUrl !== '-' && photoUrl.trim() !== '') {
        imgEl.src = photoUrl;
        imgContainer.classList.remove('hidden'); imgContainer.classList.add('flex');
    } else {
        imgContainer.classList.add('hidden'); imgContainer.classList.remove('flex');
    }

    // ใส่ข้อความใน Popup
    document.getElementById('asset-modal-name').innerText = name;
    document.getElementById('asset-modal-status').innerText = status;
    document.getElementById('asset-modal-date').innerHTML = `<i class="fa-regular fa-calendar mr-1.5"></i>${dateDetail}`;
    document.getElementById('asset-modal-emp').innerText = employee;
    document.getElementById('asset-modal-id').innerText = assetId;
    document.getElementById('asset-modal-type').innerText = type;

    // แสดง Modal
    const modal = document.getElementById('asset-modal');
    const modalBox = modal.querySelector('div.bg-white');
    modal.classList.remove('hidden'); void modal.offsetWidth;
    modal.classList.remove('opacity-0'); modalBox.classList.remove('scale-95'); modalBox.classList.add('scale-100');
}

function closeAssetDetail() {
    const modal = document.getElementById('asset-modal');
    const modalBox = modal.querySelector('div.bg-white');
    modal.classList.add('opacity-0'); modalBox.classList.remove('scale-100'); modalBox.classList.add('scale-95');
    setTimeout(() => { modal.classList.add('hidden'); }, 300);
}

// 📢 ฟังก์ชันสำหรับหน้าต่าง Popup ประกาศ (Announcements)
// ==========================================
function showAnnouncementDetail(encodedRow) {
    const row = JSON.parse(decodeURIComponent(encodedRow));

    let topic = getFuzzyValue(row, ['topic', 'หัวข้อ', 'เรื่อง', 'รายละเอียด', 'detail']) || '-';
    if (topic === '-') topic = 'Announcement'; // กันกรณีว่างเปล่า
    let type = getFuzzyValue(row, ['type', 'ประเภท']) || 'General';
    let date = getFuzzyValue(row, ['date', 'วันที่']) || '-';

    // 🛠️ 1. ดึงข้อมูลรูปภาพ
    let photoUrl = row['photo'] || row['Photo'] || getFuzzyValue(row, ['photo', 'รูป', 'pic', 'image', 'รูปภาพ']) || '';

    // 🛠️ 2. คลีนข้อมูล Base64 (ลบช่องว่าง) และจัดการ Google Drive
    if (typeof photoUrl === 'string') {
        if (photoUrl.startsWith('data:image')) {
            photoUrl = photoUrl.replace(/[\r\n\t\s]+/g, ""); // คลีน Base64
        } else if (photoUrl.includes('drive.google.com')) {
            let fileId = '';
            if (photoUrl.includes('id=')) fileId = photoUrl.split('id=')[1].split('&')[0];
            else if (photoUrl.includes('/d/')) fileId = photoUrl.split('/d/')[1].split('/')[0];
            if (fileId) photoUrl = 'https://drive.google.com/thumbnail?id=' + fileId + '&sz=w1000';
        }
    }

    // 🌟 3. เตรียมรูปโปสเตอร์เริ่มต้น (Fallback)
    let safeTopic = encodeURIComponent(String(topic).substring(0, 20));
    let fallbackImg = `https://ui-avatars.com/api/?background=e0e7ff&color=4f46e5&size=800&font-size=0.1&name=${safeTopic}`;

    if (!photoUrl || photoUrl === '-' || String(photoUrl).trim() === '') {
        photoUrl = fallbackImg;
    }

    const imgEl = document.getElementById('announce-modal-img');
    const imgContainer = document.getElementById('announce-modal-img-container');

    // ใส่รูปภาพ พร้อมระบบดักจับ Error ถ้าโหลดรูปไม่ขึ้นให้เปลี่ยนเป็นรูปสีฟ้า
    imgEl.src = photoUrl;
    imgEl.onerror = function () {
        this.onerror = null;
        this.src = fallbackImg;
    };

    // แสดงกล่องรูปภาพเสมอ (เพราะเรามี Fallback แล้ว)
    imgContainer.classList.remove('hidden');
    imgContainer.classList.add('flex');

    // ใส่ข้อความ
    const titleEl = document.getElementById('announce-modal-title');
    if (titleEl) titleEl.classList.add('hidden');

    document.getElementById('announce-modal-topic').innerText = topic;
    document.getElementById('announce-modal-type').innerText = type;
    document.getElementById('announce-modal-date').innerHTML = `<i class="fa-regular fa-calendar mr-1.5"></i>${date}`;

    // แสดง Modal
    const modal = document.getElementById('announcement-modal');
    const modalBox = modal.querySelector('div.bg-white');

    modal.classList.remove('hidden');
    void modal.offsetWidth;
    modal.classList.remove('opacity-0');
    modalBox.classList.remove('scale-95');
    modalBox.classList.add('scale-100');
}

// 📢 ฟังก์ชันสำหรับหน้าต่าง Popup ข่าวสาร (News)
function showNewsDetail(encodedRow) {
    const row = JSON.parse(decodeURIComponent(encodedRow));

    let topic = getFuzzyValue(row, ['topic', 'หัวข้อ', 'เรื่อง']) || '-';
    let content = getFuzzyValue(row, ['content', 'รายละเอียด', 'เนื้อหา']) || '-';
    let type = getFuzzyValue(row, ['type', 'ประเภท']) || 'General';
    let date = getFuzzyValue(row, ['date', 'วันที่']) || '-';

    // 🛠️ 1. ดึงข้อมูลรูปภาพ
    let photoUrl = row['photo'] || row['Photo'] || getFuzzyValue(row, ['photo', 'รูป', 'pic', 'image', 'รูปภาพ']) || '';

    // 🛠️ 2. คลีนข้อมูล Base64 และจัดการ Google Drive
    if (typeof photoUrl === 'string') {
        if (photoUrl.startsWith('data:image')) {
            photoUrl = photoUrl.replace(/[\r\n\t\s]+/g, ""); // คลีน Base64
        } else if (photoUrl.includes('drive.google.com')) {
            let fileId = '';
            if (photoUrl.includes('id=')) fileId = photoUrl.split('id=')[1].split('&')[0];
            else if (photoUrl.includes('/d/')) fileId = photoUrl.split('/d/')[1].split('/')[0];
            if (fileId) photoUrl = 'https://drive.google.com/thumbnail?id=' + fileId + '&sz=w1000';
        }
    }

    // 🌟 3. เตรียมรูปโปสเตอร์เริ่มต้น (Fallback)
    let safeTopic = encodeURIComponent(String(topic).substring(0, 20));
    let fallbackImg = `https://ui-avatars.com/api/?background=e0e7ff&color=4f46e5&size=800&font-size=0.1&name=${safeTopic}`;

    if (!photoUrl || photoUrl === '-' || String(photoUrl).trim() === '') {
        photoUrl = fallbackImg;
    }

    const imgEl = document.getElementById('announce-modal-img');
    const imgContainer = document.getElementById('announce-modal-img-container');

    imgEl.src = photoUrl;
    imgEl.onerror = function () {
        this.onerror = null;
        this.src = fallbackImg;
    };

    imgContainer.classList.remove('hidden');
    imgContainer.classList.add('flex');

    // ใส่ข้อความข่าวสาร
    const titleEl = document.getElementById('announce-modal-title');
    if (titleEl) {
        titleEl.innerText = topic;
        titleEl.classList.remove('hidden');
    }
    document.getElementById('announce-modal-topic').innerText = content;
    document.getElementById('announce-modal-type').innerText = type;
    document.getElementById('announce-modal-date').innerHTML = `<i class="fa-regular fa-calendar mr-1.5"></i>${date}`;

    // แสดง Modal
    const modal = document.getElementById('announcement-modal');
    const modalBox = modal.querySelector('div.bg-white');

    modal.classList.remove('hidden');
    void modal.offsetWidth;
    modal.classList.remove('opacity-0');
    modalBox.classList.remove('scale-95');
    modalBox.classList.add('scale-100');
}
// ฟังก์ชันสำหรับปิดหน้าต่าง Popup ประกาศ
function closeAnnouncementModal() {
    const modal = document.getElementById('announcement-modal');
    if (!modal) return;

    const modalBox = modal.querySelector('div.bg-white');

    modal.classList.add('opacity-0');
    if (modalBox) {
        modalBox.classList.remove('scale-100');
        modalBox.classList.add('scale-95');
    }

    setTimeout(() => {
        modal.classList.add('hidden');
    }, 300);
}

// 📅 Mini Calendar หน้า Dashboard
// ==========================================
let dashCalDate = new Date();
let dashCalStartDateStr = null; // ตัวแปรเก็บวันเริ่มเลือกช่วง
let dashCalEndDateStr = null; // ตัวแปรเก็บวันสิ้นสุดเลือกช่วง

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

    // สร้างช่องว่างสำหรับวันก่อนวันที่ 1
    for (let i = 0; i < firstDay; i++) {
        html += `<div class="aspect-square flex items-center justify-center text-[10px] text-transparent">0</div>`;
    }

    // สร้างตัวเลขวันที่ที่กดคลิกได้
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

        // สั่งให้คลิกแล้วเรียกฟังก์ชัน selectDashDate
        html += `<div class="${baseClasses}" onclick="selectDashDate('${currentDateStr}')">${d}</div>`;
    }
    grid.innerHTML = html;
}

function changeDashMonth(offset) {
    dashCalDate.setMonth(dashCalDate.getMonth() + offset);
    renderDashMiniCalendar();
}

// 🌟 ฟังก์ชันเมื่อคลิกวันที่บนปฏิทิน (เลือกช่วงวันที่แบบลากผ่าน)
function selectDashDate(dateStr) {
    if (!dashCalStartDateStr || (dashCalStartDateStr && dashCalEndDateStr)) {
        // เลือกครั้งแรก: ตั้งค่าวันเริ่ม และเคลียร์วันสิ้นสุด
        dashCalStartDateStr = dateStr;
        dashCalEndDateStr = null;
    } else if (dashCalStartDateStr && !dashCalEndDateStr) {
        if (dateStr >= dashCalStartDateStr) {
            // เลือกครั้งสอง: วันที่กดมากกว่าหรือเท่ากับวันเริ่ม ให้เซ็ตเป็นวันสิ้นสุด
            dashCalEndDateStr = dateStr;
        } else {
            // ถ้าวันที่กดใหม่น้อยกว่าวันเริ่มเดิม ให้เปลี่ยนวันเริ่มใหม่เป็นวันปัจจุบันแทน
            dashCalStartDateStr = dateStr;
        }
    }

    // แสดงปุ่มยกเลิกการเลือก
    let btnClear = document.getElementById('btn-clear-dash-date');
    if (btnClear) btnClear.classList.remove('hidden');

    renderDashMiniCalendar(); // วาดสีไฮไลท์ใหม่
    loadDashboard(); // สั่งให้ดึงข้อมูลตามช่วงวันทันที!
}

// 🌟 ฟังก์ชันล้างค่า (ดูข้อมูลแบบเดือน/ทั้งหมด)
function clearDashboardDateFilter() {
    dashCalStartDateStr = null;
    dashCalEndDateStr = null;
    let btnClear = document.getElementById('btn-clear-dash-date');
    if (btnClear) btnClear.classList.add('hidden');

    renderDashMiniCalendar();
    loadDashboard();
}

renderDashMiniCalendar();



// สั่งให้ปฏิทินวาดตัวเองทันทีเมื่อโหลดโค้ดเสร็จ
renderDashMiniCalendar();
// ==========================================
// 📚 ฟังก์ชันสำหรับหน้าต่าง Popup นโยบาย (Policy)
// ==========================================
function showPolicyDetail(encodedRow) {
    const row = JSON.parse(decodeURIComponent(encodedRow));

    let topic = getFuzzyValue(row, ['head_name', 'หัวข้อ', 'ชื่อ']) || 'เอกสารนโยบาย / Policy';
    let fileUrl = getFuzzyValue(row, ['link', 'url', 'ไฟล์', 'document']) || '';
    let originalUrl = fileUrl; // เก็บ URL จริงไว้สำหรับปุ่ม "เปิดอ่านเอกสารฉบับเต็ม"

    // 🌟 เช็คว่าเป็นไฟล์ PDF หรือไม่
    let isPdf = false;
    if (typeof originalUrl === 'string') {
        isPdf = originalUrl.toLowerCase().includes('.pdf') || originalUrl.startsWith('data:application/pdf');
    }

    // ถ้าเป็นลิงก์ Google Drive ดึงภาพ Thumbnail
    if (fileUrl.includes('drive.google.com/file/d/')) {
        let fileId = fileUrl.split('/d/')[1].split('/')[0];
        fileUrl = 'https://drive.google.com/thumbnail?id=' + fileId + '&sz=w1000';
    }

    let safeTopic = encodeURIComponent(String(topic).substring(0, 15));
    let fallbackImg = `https://ui-avatars.com/api/?background=f8fafc&color=4f46e5&size=800&font-size=0.1&name=${safeTopic}`;

    if (!fileUrl || fileUrl === '-' || String(fileUrl).trim() === '') {
        fileUrl = fallbackImg;
    }

    // 🌟 อัปเดตส่วนแสดงผลฝั่งซ้าย (โชว์รูป หรือ โลโก้ PDF)
    const imgContainer = document.getElementById('policy-modal-img-container');
    if (isPdf) {
        // ถ้าเป็น PDF โชว์ไอคอน
        imgContainer.innerHTML = `
                    <div class="absolute inset-0 flex items-center justify-center opacity-5"><i class="fa-solid fa-file-contract text-[10rem] text-brandindigo"></i></div>
                    <div class="relative z-10 flex flex-col items-center justify-center">
                        <i class="fa-solid fa-file-pdf text-[8rem] text-red-500 mb-6 drop-shadow-md"></i>
                        <span class="text-sm font-bold text-gray-500 uppercase tracking-widest bg-white px-4 py-1.5 rounded-full shadow-sm border border-gray-100">PDF Document</span>
                    </div>`;
    } else {
        // ถ้าเป็นรูป โชว์รูป
        imgContainer.innerHTML = `
                    <div class="absolute inset-0 flex items-center justify-center opacity-5"><i class="fa-solid fa-file-contract text-[10rem] text-brandindigo"></i></div>
                    <img id="policy-modal-img" src="${fileUrl}" alt="Policy Cover" class="w-full h-full object-contain relative z-10" onerror="this.onerror=null; this.src='${fallbackImg}';">
                `;
    }

    // ใส่หัวข้อ
    document.getElementById('policy-modal-topic').innerText = topic;

    // ตั้งค่าปุ่มอ่านเอกสารฉบับเต็ม
    const readBtn = document.getElementById('policy-modal-read-btn');
    readBtn.onclick = function () {
        showAttachmentPreview(originalUrl, topic);
    };

    // เปิดแสดง Modal
    const modal = document.getElementById('policy-modal');
    const modalBox = modal.querySelector('div.bg-white');

    modal.classList.remove('hidden');
    void modal.offsetWidth;
    modal.classList.remove('opacity-0');
    modalBox.classList.remove('scale-95');
    modalBox.classList.add('scale-100');
}

function closePolicyModal() {
    const modal = document.getElementById('policy-modal');
    if (!modal) return;
    const modalBox = modal.querySelector('div.bg-white');

    modal.classList.add('opacity-0');
    if (modalBox) {
        modalBox.classList.remove('scale-100');
        modalBox.classList.add('scale-95');
    }

    setTimeout(() => {
        modal.classList.add('hidden');
    }, 300);
}
// ==========================================
// 📚 ฟังก์ชันสำหรับหน้าต่าง Popup เอกสาร (Documents)
// ==========================================
// ==========================================
// 📚 ฟังก์ชันสำหรับหน้าต่าง Popup เอกสาร (Documents)
// ==========================================
function showDocumentDetail(encodedRow) {
    const row = JSON.parse(decodeURIComponent(encodedRow));

    let topic = getFuzzyValue(row, ['document_name', 'document name', 'ชื่อเอกสาร', 'หัวข้อ', 'ชื่อ']) || 'เอกสาร / Document';
    let docType = getFuzzyValue(row, ['document_types', 'document types ', 'ประเภท', 'type']) || 'DOCUMENT';

    // 🌟 ดึงข้อมูลไฟล์
    let fileUrl = row['Photo'] || row['photo'] || getFuzzyValue(row, ['photo', 'file', 'link', 'url', 'ไฟล์', 'document', 'ไฟล์แนบ']) || '';

    // 🌟 คลีนข้อมูล Base64
    if (typeof fileUrl === 'string' && fileUrl.startsWith('data:')) {
        fileUrl = fileUrl.replace(/[\r\n\t\s]+/g, "");
    }

    let originalUrl = fileUrl;

    // 🌟 เช็คว่าเป็นไฟล์ PDF หรือไม่
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

    // 🌟 อัปเดตส่วนแสดงผลฝั่งซ้าย (โชว์รูป หรือ โลโก้ PDF)
    const imgContainer = document.getElementById('document-modal-img-container');
    if (isPdf) {
        imgContainer.innerHTML = `
                    <div class="absolute inset-0 flex items-center justify-center opacity-5"><i class="fa-solid fa-folder-open text-[10rem] text-brandindigo"></i></div>
                    <div class="relative z-10 flex flex-col items-center justify-center">
                        <i class="fa-solid fa-file-pdf text-[8rem] text-red-500 mb-6 drop-shadow-md"></i>
                        <span class="text-sm font-bold text-gray-500 uppercase tracking-widest bg-white px-4 py-1.5 rounded-full shadow-sm border border-gray-100">PDF Document</span>
                    </div>`;
    } else {
        imgContainer.innerHTML = `
                    <div class="absolute inset-0 flex items-center justify-center opacity-5"><i class="fa-solid fa-folder-open text-[10rem] text-brandindigo"></i></div>
                    <img id="document-modal-img" src="${fileUrl}" alt="Document Cover" class="w-full h-full object-contain relative z-10" onerror="this.onerror=null; this.src='${fallbackImg}';">
                `;
    }

    // ใส่หัวข้อและประเภท
    document.getElementById('document-modal-topic').innerText = topic;
    document.getElementById('document-modal-type').innerHTML = `<i class="fa-solid fa-file-lines mr-1.5"></i> ${docType}`;

    // 🎯 การทำงานของปุ่ม "อ่านเอกสาร"

    const readBtn = document.getElementById('document-modal-read-btn');
    readBtn.onclick = function () {
        showAttachmentPreview(originalUrl, topic);
    };

    // 🎯 การทำงานของปุ่ม "ดาวน์โหลด"
    const downloadBtn = document.getElementById('document-modal-download-btn');
    downloadBtn.onclick = function () {
        const a = document.createElement('a');
        a.href = originalUrl;
        a.download = topic; // พยายามบังคับตั้งชื่อไฟล์ตอนโหลด
        a.target = '_blank';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
    };

    // เปิดแสดง Modal
    const modal = document.getElementById('document-modal');
    const modalBox = modal.querySelector('div.bg-white');

    modal.classList.remove('hidden');
    void modal.offsetWidth;
    modal.classList.remove('opacity-0');
    modalBox.classList.remove('scale-95');
    modalBox.classList.add('scale-100');
}

function closeDocumentModal() {
    const modal = document.getElementById('document-modal');
    if (!modal) return;
    const modalBox = modal.querySelector('div.bg-white');

    modal.classList.add('opacity-0');
    if (modalBox) {
        modalBox.classList.remove('scale-100');
        modalBox.classList.add('scale-95');
    }

    setTimeout(() => {
        modal.classList.add('hidden');
    }, 300);
}

window.addBillRow = function (no = '', name = '', qty = '', price = '', total = '') {
    const tbody = document.getElementById('bill-items-tbody');
    if (!tbody) return;
    const rowCount = tbody.children.length;
    const itemNo = no || (rowCount + 1);

    const tr = document.createElement('tr');
    tr.className = 'hover:bg-gray-50/50';
    tr.innerHTML = `
                <td class="p-2 font-bold text-gray-400 text-center bill-row-no">${itemNo}</td>
                <td class="p-2">
                    <input type="text" value="${String(name).replace(/"/g, '&quot;')}" placeholder="ชื่อรายการ..." required oninput="updateBillJsonAndTotal()" class="w-full bg-white border border-gray-200 text-gray-900 rounded-lg p-2 text-xs focus:ring-brandindigo focus:border-brandindigo">
                </td>
                <td class="p-2">
                    <input type="number" min="1" value="${qty}" placeholder="0" required oninput="calculateBillRow(this); updateBillJsonAndTotal()" class="w-full bg-white border border-gray-200 text-gray-900 rounded-lg p-2 text-xs text-center focus:ring-brandindigo focus:border-brandindigo bill-item-qty">
                </td>
                <td class="p-2">
                    <input type="number" min="0" step="any" value="${price}" placeholder="0.00" required oninput="calculateBillRow(this); updateBillJsonAndTotal()" class="w-full bg-white border border-gray-200 text-gray-900 rounded-lg p-2 text-xs text-right focus:ring-brandindigo focus:border-brandindigo bill-item-price">
                </td>
                <td class="p-2 text-right font-black text-gray-900 bill-item-total">${new Intl.NumberFormat('th-TH').format(parseFloat(total) || 0)}</td>
                <td class="p-2 text-center">
                    <button type="button" onclick="deleteBillRow(this)" class="text-red-500 hover:text-red-700 transition-colors p-1.5"><i class="fa-solid fa-trash-can text-sm"></i></button>
                </td>
            `;
    tbody.appendChild(tr);
    updateBillJsonAndTotal();
};

window.calculateBillRow = function (inputEl) {
    const tr = inputEl.closest('tr');
    const qty = parseFloat(tr.querySelector('.bill-item-qty').value) || 0;
    const price = parseFloat(tr.querySelector('.bill-item-price').value) || 0;
    const total = qty * price;
    tr.querySelector('.bill-item-total').innerText = new Intl.NumberFormat('th-TH').format(total);
};

window.deleteBillRow = function (btnEl) {
    const tr = btnEl.closest('tr');
    tr.remove();

    // Re-index row numbers
    const tbody = document.getElementById('bill-items-tbody');
    if (tbody) {
        Array.from(tbody.children).forEach((child, idx) => {
            child.querySelector('.bill-row-no').innerText = idx + 1;
        });
    }
    updateBillJsonAndTotal();
};

window.updateBillJsonAndTotal = function () {
    const tbody = document.getElementById('bill-items-tbody');
    if (!tbody) return;

    const rows = Array.from(tbody.children);
    const items = [];
    let grandTotal = 0;

    rows.forEach(tr => {
        const no = parseInt(tr.querySelector('.bill-row-no').innerText) || 0;
        const name = tr.querySelector('td:nth-child(2) input').value.trim();
        const qty = parseFloat(tr.querySelector('.bill-item-qty').value) || 0;
        const price = parseFloat(tr.querySelector('.bill-item-price').value) || 0;
        const total = qty * price;

        items.push({ no, name, qty, price, total });
        grandTotal += total;
    });

    // Update hidden input JSON string
    const hiddenInput = document.getElementById('hidden-bill-items-input');
    if (hiddenInput) {
        hiddenInput.value = JSON.stringify(items);
    }

    // Update displayed subtotal
    const displayTotal = document.getElementById('bill-total-price-display');
    if (displayTotal) {
        displayTotal.innerText = new Intl.NumberFormat('th-TH').format(grandTotal);
    }

    // Auto-update main form Amount field
    const amountInput = document.querySelector('#dynamic-form input[name="Amount"], #dynamic-form input[name="amount"]');
    if (amountInput) {
        amountInput.value = grandTotal;
        amountInput.readOnly = true;
        amountInput.classList.add('bg-gray-100', 'text-gray-500', 'cursor-not-allowed');
    }
};

window.initializeBillEditor = function (jsonStr) {
    const tbody = document.getElementById('bill-items-tbody');
    if (!tbody) return;
    tbody.innerHTML = '';

    try {
        let decoded = jsonStr;
        // 🛠️ กันไม่ให้พยายาม parse ค่า placeholder ทั่วไป (ว่าง/-) เป็น JSON
        // เดิมถ้า jsonStr เป็น '-' (placeholder มาตรฐานของระบบนี้) โค้ดจะพยายาม JSON.parse('-')
        // ซึ่ง error เสมอ แล้วเข้า catch ทุกครั้งที่เปิด record ใหม่/ที่ไม่มีรายการบิล
        if (decoded === undefined || decoded === null || String(decoded).trim() === '' || String(decoded).trim() === '-') {
            decoded = '[]';
        }
        if (String(decoded).includes('%')) {
            decoded = decodeURIComponent(decoded);
        }
        const items = JSON.parse(decoded || '[]');
        if (Array.isArray(items) && items.length > 0) {
            items.forEach(item => {
                addBillRow(item.no, item.name, item.qty, item.price, item.total);
            });
        } else {
            addBillRow(); // Add one blank row
        }
    } catch (e) {
        console.warn('Failed to parse bill items JSON, adding blank row:', e);
        addBillRow(); // Add one blank row fallback
    }
};

window.showBillDetailsModal = function (encodedRow) {
    try {
        const row = JSON.parse(decodeURIComponent(encodedRow));

        // Set text fields
        document.getElementById('bill-modal-id').innerText = row.Id_Budget || row.budget_id || '-';
        document.getElementById('bill-modal-date').innerText = row.Request_Date || row.request_date || '-';

        const status = row.Signature || row.signature || 'Pending';
        const isApproved = status.toLowerCase().includes('approve') || (!status.toLowerCase().includes('pending') && !status.toLowerCase().includes('reject') && status !== '-' && status !== '');

        const statusEl = document.getElementById('bill-modal-status');
        if (statusEl) {
            statusEl.innerText = status;
            statusEl.className = 'inline-block px-3 py-1 text-[10px] font-bold rounded-full uppercase tracking-wider';
            if (isApproved) {
                statusEl.classList.add('bg-emerald-50', 'border', 'border-emerald-100', 'text-emerald-600');
            } else if (status.toLowerCase().includes('reject')) {
                statusEl.classList.add('bg-red-50', 'border', 'border-red-100', 'text-red-600');
            } else {
                statusEl.classList.add('bg-amber-50', 'border', 'border-amber-100', 'text-amber-600');
            }
        }

        const fullName = `${row.Prefix || ''} ${row.First_Name || ''} ${row.Last_Name || ''}`.trim() || '-';
        document.getElementById('bill-modal-requester-name').innerText = fullName;
        document.getElementById('bill-modal-requester-id').innerText = row.Employee_ID || row.employee_id || '-';
        document.getElementById('bill-modal-requester-dept').innerText = row.Department_ID || row.department_id || '-';
        document.getElementById('bill-modal-requester-pos').innerText = row.Position_ID || row.position_id || '-';

        document.getElementById('bill-modal-title').innerText = row.Title || row.title || '-';
        document.getElementById('bill-modal-desc').innerText = row.Description || row.description || '-';

        // Parse items list
        const tbody = document.getElementById('bill-modal-items-tbody');
        tbody.innerHTML = '';

        let decodedItems = row.Items || row.items || '[]';
        if (String(decodedItems).includes('%')) {
            decodedItems = decodeURIComponent(decodedItems);
        }

        let itemsList = [];
        try {
            itemsList = JSON.parse(decodedItems);
        } catch (e) {
            console.warn(e);
        }

        let grandTotal = 0;
        if (Array.isArray(itemsList) && itemsList.length > 0) {
            itemsList.forEach((item, idx) => {
                const tr = document.createElement('tr');
                tr.innerHTML = `
                            <td class="px-4 py-3 text-center text-gray-400 font-bold">${item.no || (idx + 1)}</td>
                            <td class="px-4 py-3 font-semibold text-gray-900">${item.name || '-'}</td>
                            <td class="px-4 py-3 text-center">${item.qty || 0}</td>
                            <td class="px-4 py-3 text-right">${new Intl.NumberFormat('th-TH').format(item.price || 0)} บาท</td>
                            <td class="px-4 py-3 text-right font-black text-gray-900">${new Intl.NumberFormat('th-TH').format(item.total || 0)} บาท</td>
                        `;
                tbody.appendChild(tr);
                grandTotal += parseFloat(item.total) || 0;
            });
        } else {
            // Fallback to single amount if list is empty
            const rawAmt = parseFloat(row.Amount || row.amount) || 0;
            const tr = document.createElement('tr');
            tr.innerHTML = `
                        <td class="px-4 py-3 text-center text-gray-400 font-bold">1</td>
                        <td class="px-4 py-3 font-semibold text-gray-900">${row.Title || row.title || 'ของบประมาณ'}</td>
                        <td class="px-4 py-3 text-center">1</td>
                        <td class="px-4 py-3 text-right">${new Intl.NumberFormat('th-TH').format(rawAmt)} บาท</td>
                        <td class="px-4 py-3 text-right font-black text-gray-900">${new Intl.NumberFormat('th-TH').format(rawAmt)} บาท</td>
                    `;
            tbody.appendChild(tr);
            grandTotal = rawAmt;
        }

        document.getElementById('bill-modal-subtotal').innerText = new Intl.NumberFormat('th-TH').format(grandTotal) + ' บาท';

        const grandTotalEl = document.getElementById('bill-modal-grandtotal');
        if (grandTotalEl) {
            grandTotalEl.innerText = new Intl.NumberFormat('th-TH').format(grandTotal) + ' บาท';
            grandTotalEl.className = 'text-lg font-black transition-colors duration-300';
            if (isApproved) {
                grandTotalEl.classList.add('text-emerald-600');
            } else if (status.toLowerCase().includes('reject')) {
                grandTotalEl.classList.add('text-red-600');
            } else {
                grandTotalEl.classList.add('text-brandindigo');
            }
        }

        document.getElementById('bill-modal-sign-requester').innerText = fullName;

        const approverEl = document.getElementById('bill-modal-sign-approver');
        if (approverEl) {
            approverEl.innerText = isApproved ? status : '- ยังไม่ได้รับการอนุมัติ -';
            approverEl.className = 'h-16 flex items-end justify-center border-b border-gray-200 pb-1 max-w-[200px] mx-auto text-sm transition-colors duration-300';
            if (isApproved) {
                approverEl.classList.add('text-emerald-600', 'font-black');
            } else if (status.toLowerCase().includes('reject')) {
                approverEl.classList.add('text-red-500', 'font-bold');
            } else {
                approverEl.classList.add('text-gray-400', 'font-normal');
            }
        }

        // Show modal with animation
        const modal = document.getElementById('bill-modal');
        const modalBox = modal.querySelector('div');
        modal.classList.remove('hidden');
        void modal.offsetWidth;
        modal.classList.remove('opacity-0');
        modalBox.classList.remove('scale-95');
        modalBox.classList.add('scale-100');
    } catch (error) {
        console.error(error);
        alert("เกิดข้อผิดพลาดในการดึงข้อมูลรายละเอียดบิล");
    }
};

window.closeBillModal = function () {
    const modal = document.getElementById('bill-modal');
    if (!modal) return;
    const modalBox = modal.querySelector('div');
    modal.classList.add('opacity-0');
    if (modalBox) {
        modalBox.classList.remove('scale-100');
        modalBox.classList.add('scale-95');
    }
    setTimeout(() => {
        modal.classList.add('hidden');
    }, 300);
};

window.printBill = function () {
    window.print();
};