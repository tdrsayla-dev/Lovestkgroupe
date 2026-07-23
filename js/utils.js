// ─────────────────────────────────────────────────────────────────────────────
// js/utils.js - Core Utilities, Date Helpers, Clock, Modals & Toasts
// ─────────────────────────────────────────────────────────────────────────────

function escapeHtml(value) {
    return String(value === undefined || value === null ? '' : value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function parsePermissionsList(val) {
    if (!val) return [];
    if (Array.isArray(val)) {
        return val.map(v => String(v).trim().toLowerCase()).filter(Boolean);
    }
    let str = String(val).trim();
    if (str.startsWith('[') && str.endsWith(']')) {
        try {
            let parsed = JSON.parse(str);
            if (Array.isArray(parsed)) {
                return parsed.map(v => String(v).trim().toLowerCase()).filter(Boolean);
            }
        } catch (e) { }
    }
    // Remove brackets and quotes
    str = str.replace(/[\[\]"']/g, '');
    return str.split(',').map(v => String(v).trim().toLowerCase()).filter(Boolean);
}

function isMenuPermissionChecked(menuId, checkedList) {
    if (!checkedList || checkedList.length === 0) return false;
    if (checkedList.includes('all')) return true;

    const norm = (str) => String(str || '').trim().toLowerCase().replace(/[\s_-]+/g, '');
    const target = norm(menuId);

    return checkedList.some(item => {
        const itemNorm = norm(item);
        if (target === itemNorm) return true;

        // Alias & typo handling
        if ((target.includes('orientat') || target.includes('orentat')) && (itemNorm.includes('orientat') || itemNorm.includes('orentat'))) return true;
        if ((target.includes('ranting') || target.includes('rating')) && (itemNorm.includes('ranting') || itemNorm.includes('rating'))) return true;
        return false;
    });
}

// URL CLEANER — ลบ .html ออกจากช่องที่อยู่เบราว์เซอร์อัตโนมัติ
if (window.location.protocol !== 'file:' && window.location.pathname.endsWith('.html')) {
    const cleanPath = window.location.pathname.replace(/\.html$/, '');
    window.history.replaceState(null, '', cleanPath + window.location.search + window.location.hash);
}

/* =====================================================================
 * 📌 ส่วนที่ 1: DATA FORMATTING & CALENDAR HELPER (ฟังก์ชันจัดการข้อมูลและปฏิทิน)
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
        let dbDateStr = `${year}-${month}-${day}`;

        let recordExists = rawData.find(r => {
            let rEmp = String(r.Employee_ID || r.Employee_Id || r.employee_id || r.Emp_ID || '').toUpperCase().trim();
            if (rEmp !== targetEmpId.toUpperCase().trim()) return false;
            let rDate = String(r.Date || r.date || '').trim();
            if (rDate === dateStr || rDate === dbDateStr || rDate.startsWith(dbDateStr)) return true;
            let parsedRDate = parseDateStr(rDate);
            if (parsedRDate && parsedRDate.getFullYear() === year && (parsedRDate.getMonth() + 1) === Number(month) && parsedRDate.getDate() === Number(day)) return true;
            return false;
        });

        if (recordExists) {
            let copy = Object.assign({}, recordExists);
            copy.Date = dateStr;
            completeList.push(copy);
        } else {
            let dayOfWeek = d.getDay();
            let isWeekend = (dayOfWeek === 0); // 📌 เปลี่ยนให้มีแค่วันอาทิตย์ (0) ที่เป็นวันหยุด
            let isPastOrToday = (d <= today);

            let statusLabel = isWeekend ? (t('holiday') || "Holiday") : (isPastOrToday ? (t('absent') || "ABSENT") : (t('not_yet_arrived') || "Not yet"));

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

/* =====================================================================
 * 📌 ส่วนที่ 2: ATTENDANCE CALENDAR RENDERER (ฟังก์ชันแสดงปฏิทินการเข้างาน)
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
        let currentDate = new Date(year, month - 1, day);
        let dateStr = `${String(day).padStart(2, '0')}/${String(month).padStart(2, '0')}/${year}`;
        let dbDateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

        let isWeekend = currentDate.getDay() === 0; // วันหยุด (อาทิตย์)
        let isPastOrToday = currentDate <= today;

        let logFound = logs.find(r => r.Date === dateStr || r.Date === dbDateStr);

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

        let boxClass = "h-10 sm:h-12 rounded-xl flex items-center justify-center text-xs font-bold relative transition-all border cursor-pointer hover:scale-105 active:scale-95 shadow-sm ";
        let innerHtml = `<span>${day}</span>`;

        if (logFound) {
            boxClass += "bg-emerald-50 border-emerald-200 text-emerald-600 hover:bg-emerald-100";
            innerHtml += `<span class="absolute bottom-1.5 w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-sm"></span>`;
        } else if (isOnLeave) {
            boxClass += "bg-yellow-50 border-yellow-200 text-yellow-600 hover:bg-yellow-100";
            innerHtml = `<div class="w-7 h-7 flex items-center justify-center rounded-full bg-yellow-400 text-white shadow-md">${day}</div>`;
        } else if (isWeekend) {
            boxClass += "bg-gray-100 border-gray-200 text-gray-400 hover:bg-gray-200";
        } else if (isPastOrToday) {
            boxClass += "bg-red-50 border-red-200 text-red-500 hover:bg-red-100";
            innerHtml = `<div class="w-7 h-7 flex items-center justify-center rounded-full bg-red-500 text-white shadow-md">${day}</div>`;
            absentCount++;
        } else {
            boxClass += "bg-white border-dashed border-gray-200 text-gray-400 hover:bg-indigo-50";
        }

        calDiv.innerHTML += `<div onclick="openAttendanceEditModalByDate('${targetEmpId}', '${dbDateStr}')" class="${boxClass}" title="Click to edit ${dateStr}">${innerHtml}</div>`;
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
let isProcessingScan = false;

let confirmOkCallback = null;
let confirmCancelCallback = null;

/* =====================================================================
 * 📌 ส่วนที่ 3: MODALS & ALERTS (ฟังก์ชันหน้าต่างแจ้งเตือนและยืนยัน)
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
    else if (sName.includes('ranting') || sName.includes('rating')) targetKeys = ['ranting_id', 'rating_id', 'id'];
    else if (sName.includes('budget')) targetKeys = ['id_budget', 'budget_id', 'id'];
    else targetKeys = ['id_leave', 'leave_id', 'log_id', 'asset_id', 'course_id', 'department_id', 'employee_id', 'emp_id', 'ranting_id', 'rating_id', 'id_budget', 'budget_id', 'id'];

    for (let key of targetKeys) {
        let foundKey = Object.keys(row).find(k => String(k).toLowerCase().trim() === key);
        if (foundKey) return row[foundKey];
    }
    return Object.values(row)[0];
}

function normalizeRatingPhoto(photoValue, fallbackName) {
    if (!photoValue || photoValue === '-' || photoValue === 'null') {
        return `https://ui-avatars.com/api/?background=e0e7ff&color=4f46e5&bold=true&name=${encodeURIComponent(fallbackName || 'EMP')}`;
    }
    const s = String(photoValue).trim();
    // Array string เช่น ["url1","url2"]
    if (s.startsWith('[')) {
        try {
            const arr = JSON.parse(s);
            if (Array.isArray(arr) && arr.length > 0) return String(arr[0]).trim();
        } catch (e) { }
    }
    // base64 ที่ไม่มี prefix
    if (s.length > 200 && !s.startsWith('http') && !s.startsWith('data:')) {
        return `data:image/jpeg;base64,${s}`;
    }
    return s;
}

function isEmployeeRatingSheet(sheetName = currentSheet) {
    const s = String(sheetName || '').toLowerCase().trim();
    const isRating = s.includes('ranting') || s.includes('rating') || s.includes('employees_rating');
    console.log("[isEmployeeRatingSheet] sheetName:", sheetName, "-> result:", isRating);
    return isRating;
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
 * 📌 ส่วนที่ 5: REALTIME CLOCK (ฟังก์ชันนาฬิกา)
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

/* =====================================================================
 * 📌 ส่วนที่ 9: LOADING & TOASTS (ฟังก์ชันหน้าต่างโหลดข้อมูลและข้อความแจ้งเตือนสั้นๆ)
 * ===================================================================== */
function toggleLoading(show, text = 'PROCESSING...') {
    document.getElementById('loading-text').innerText = text;
    document.getElementById('main-loading').classList.toggle('hidden', !show);
}

function showToast(msg, type = 'success') {
    const container = document.getElementById('toast-container');
    if (!container) return;

    // Prevent duplicate toasts with the same message
    const existing = Array.from(container.children).find(t => {
        const txt = t.querySelector('.ml-4');
        return txt && txt.textContent.trim() === String(msg).trim();
    });
    if (existing) return;

    // Limit to maximum of 3 toasts
    while (container.children.length >= 3) {
        container.removeChild(container.firstChild);
    }

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
    if (!source || String(source).trim() === '' || String(source).trim() === '-') {
        showToast(t('no_attachment') || 'No attachment found for this item', 'error');
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

// DOMContentLoaded listener for session routing and modal confirmations
document.addEventListener("DOMContentLoaded", () => {
    startRealtimeClock();
    const savedSession = localStorage.getItem('hr_user_session') || sessionStorage.getItem('hr_user_session');
    if (savedSession) {
        showApp();
    } else {
        window.location.href = 'login.html';
        return;
    }

    document.getElementById('btn-confirm-ok').addEventListener('click', () => {
        hideConfirmModal();
        if (confirmOkCallback) confirmOkCallback();
    });
    document.getElementById('btn-confirm-cancel').addEventListener('click', () => {
        hideConfirmModal();
        if (confirmCancelCallback) confirmCancelCallback();
    });
});

if (typeof google === 'undefined') {
    window.google = {
        script: {
            run: {
                withSuccessHandler: function (cb) { this._success = cb; return this; },
                withFailureHandler: function (cb) { this._failure = cb; return this; },
                getDashboardData: function () { setTimeout(() => this._success && this._success({ success: true, data: { staff: 15, leaves: 5, logs: 42, lateHours: 3.5, earlyHours: 1.5, absents: 2, otAmount: 500000, assets: 12, trainings: 4, pendingLeaves: [], recentCards: [] } }), 500); },
                getSheetData: function (sheetName, forceRefresh) { setTimeout(() => this._success && this._success({ success: true, headers: ['ID', 'NAME'], data: [{ ID: '1', NAME: 'Test' }] }), 500); },
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
