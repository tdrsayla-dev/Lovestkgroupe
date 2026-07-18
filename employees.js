// ─────────────────────────────────────────────────────────────────────────────
// js/employees.js - Employee Profiles, Autocomplete, Ratings, & Digital Card
// ─────────────────────────────────────────────────────────────────────────────

let digitalCardQrCode = null;
let _qrScannerStream = null;
let _qrScannerAnimFrame = null;
let _qrLastScan = 0;
const QR_SCANNER_MODAL_ID = 'qr-rating-scanner-modal';

/* =====================================================================
 * 📌 ส่วนที่ 4: EMPLOYEE AUTO-FILL (ฟังก์ชันดึงข้อมูลพนักงานอัตโนมัติ)
 * ===================================================================== */
function autoFillEmployeeData(empId) {
    if (!empId) return;
    const quotaDisplay = document.getElementById('leave-quota-display');
    if (quotaDisplay) quotaDisplay.innerHTML = '<i class="fa-solid fa-spinner fa-spin text-brandindigo"></i>';

    const staffCache = tableCache['staff'] || tableCache['Staff'];
    const sheetData = staffCache ? staffCache.data : [];
    if (!sheetData || sheetData.length === 0) return;

    const empRow = findStaffRowById(empId, sheetData);

    if (empRow) {
        let quota = parseInt(getFuzzyValue(empRow, ['leave_quota', 'quota', 'โควต้า', 'วันลาพักร้อน'])) || 0;
        let usedDays = 0;
        const leaveCache = tableCache['Leave application'];
        if (leaveCache && leaveCache.data) {
            leaveCache.data.forEach(r => {
                let rEmpId = String(r.Employee_ID || r.employee_id || '').toUpperCase().trim();
                if (rEmpId === String(empId).toUpperCase().trim()) {
                    usedDays += parseFloat(r.Total_Days || r.total_days || 0) || 0;
                }
            });
        }
        const remaining = quota - usedDays;
        window._currentLeaveQuota = quota;
        window._currentLeaveUsed = usedDays;
        window._currentLeaveRemaining = remaining;

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

        const form = document.getElementById('dynamic-form');
        if (!form) return;

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
                input.value = getFuzzyValue(empRow, ['contact', 'phone', 'เบอร์โทร', 'ติดต่อ', 'tel']);
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

/* =====================================================================
 * 📌 ส่วนที่ 14: EMPLOYEE DROPDOWN (ฟังก์ชันจัดการ Dropdown เลือกพนักงาน)
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

/* =====================================================================
 * 📌 ส่วนที่ 15: EMPLOYEE PROFILE (ฟังก์ชันแสดงโปรไฟล์พนักงาน)
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

/* =====================================================================
 * 📌 ส่วนที่ 21: DIGITAL CARD (ระบบบัตรพนักงานดิจิทัล)
 * ===================================================================== */
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

    if (picUrl && picUrl.includes('drive.google.com')) {
        let fileId = '';
        if (picUrl.includes('id=')) {
            fileId = picUrl.split('id=')[1].split('&')[0];
        } else if (picUrl.includes('/d/')) {
            fileId = picUrl.split('/d/')[1].split('/')[0];
        }
        if (fileId) {
            picUrl = 'https://drive.google.com/thumbnail?id=' + fileId + '&sz=w500';
        }
    }

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
    const photoElement = document.getElementById('card-photo');
    if (empData['PHOTOS'] && empData['PHOTOS'] !== '-') {
        photoElement.src = empData['PHOTOS'];
    } else {
        photoElement.src = 'https://ui-avatars.com/api/?name=' + empData['NAME'];
    }

    document.getElementById('card-name').innerText = empData['NAME'] || '-';
    document.getElementById('card-position').innerText = empData['POSITION_ID'] || '-';

    document.getElementById('card-phone').innerText = empData['PHONE'] || '-';
    document.getElementById('card-email').innerText = empData['EMAIL'] || '-';
    document.getElementById('card-line').innerText = empData['LINE_ID'] || '-';
}

/* =====================================================================
 * 📌 ส่วนที่ 22: QR SCANNER FOR RATING (สแกน QR เพื่อให้ดาวพนักงาน)
 * ===================================================================== */
function openQRScanner() {
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
                                <div class="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 border-emerald-400 rounded-tl-lg" style="box-shadow: -2px -2px 0 0 rgba(52,211,153,0.3);"></div>
                                <div class="absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 border-emerald-400 rounded-tr-lg" style="box-shadow: 2px -2px 0 0 rgba(52,211,153,0.3);"></div>
                                <div class="absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 border-emerald-400 rounded-bl-lg" style="box-shadow: -2px 2px 0 0 rgba(52,211,153,0.3);"></div>
                                <div class="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 border-emerald-400 rounded-br-lg" style="box-shadow: 2px 2px 0 0 rgba(52,211,153,0.3);"></div>
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

function _tickQRScan() {
    const video = document.getElementById('qr-scanner-video');
    const canvas = document.getElementById('qr-scanner-canvas');
    if (!video || !canvas || video.readyState !== video.HAVE_ENOUGH_DATA) {
        _qrScannerAnimFrame = requestAnimationFrame(_tickQRScan);
        return;
    }

    const now = Date.now();
    if (now - _qrLastScan < 300) {
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
            return;
        }
    }

    _qrScannerAnimFrame = requestAnimationFrame(_tickQRScan);
}

function _onQRDetected(empId) {
    const flash = document.getElementById('qr-success-flash');
    const statusText = document.getElementById('qr-scan-status-text');
    if (flash) { flash.classList.remove('hidden'); setTimeout(() => flash.classList.add('hidden'), 600); }
    if (statusText) statusText.textContent = `✅ พบรหัส: ${empId}`;

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
    let ratingData = tableCache['Employees Ranting ']?.data || tableCache['Employees Ranting']?.data || tableCache['Employees Rating']?.data || tableCache['employees_rating']?.data || [];
    let existingRows = ratingData.filter(r => String(getFuzzyValue(r, ['employees id', 'emp_id', 'employee_id'])).toUpperCase().trim() === empId);

    if (existingRows.length > 0) {
        ratingTemplate = Object.assign({}, existingRows[existingRows.length - 1]);
        delete ratingTemplate.__db_id;
        delete ratingTemplate.id;
    } else {
        let headers = tableCache['Employees Ranting ']?.headers || tableCache['Employees Ranting']?.headers || tableCache['Employees Rating']?.headers || ['Ranting_Id', 'Employees Id', 'Employees Name', 'Ranting Date', 'Star Point', 'Category ', 'Comment', 'Give By', 'Status'];
        headers.forEach(h => ratingTemplate[h] = '');
    }

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

    const encodedTemplate = encodeURIComponent(JSON.stringify(ratingTemplate));
    showToast(`✅ พบพนักงาน ${empId} — กรุณาประเมิน`, 'success');

    setTimeout(() => {
        if (typeof openFormModal === 'function') openFormModal(encodedTemplate);
    }, 300);
}

function closeQRScanner() {
    if (_qrScannerAnimFrame) { cancelAnimationFrame(_qrScannerAnimFrame); _qrScannerAnimFrame = null; }
    if (_qrScannerStream) { _qrScannerStream.getTracks().forEach(t => t.stop()); _qrScannerStream = null; }
    const modal = document.getElementById(QR_SCANNER_MODAL_ID);
    if (modal) {
        modal.style.opacity = '0';
        modal.style.transition = 'opacity 0.3s';
        setTimeout(() => modal.remove(), 300);
    }
    const style = document.getElementById('qr-scanner-styles');
    if (style) style.remove();
}
