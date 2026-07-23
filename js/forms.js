// ─────────────────────────────────────────────────────────────────────────────
// js/forms.js - Form Management, Submission, Validation & Bill Editor
// ─────────────────────────────────────────────────────────────────────────────

/* =====================================================================
 * 📌 ส่วนที่ 18: DATA ENTRY FORM (ฟังก์ชันฟอร์มเพิ่ม/แก้ไขข้อมูล)
 * - เปิดฟอร์มเพื่อกรอกข้อมูลหรือแก้ไขข้อมูลพนักงาน/การเข้างาน/ตารางกะ ฯลฯ
 * ===================================================================== */
/* =====================================================================
 * 📌 Attendance Auto-Calculation Helper
 * ===================================================================== */
function autoCalculateAttendanceTimes() {
    const form = document.getElementById('record-form');
    if (!form) return;

    const getVal = (names) => {
        for (let n of names) {
            let el = form.querySelector(`[name="${n}"]`);
            if (el) return el;
        }
        return null;
    };

    const inEl = getVal(['Check_In', 'check_in']);
    const outEl = getVal(['Check_Out', 'check_out']);
    const startEl = getVal(['Shift_Start', 'shift_start']);
    const endEl = getVal(['Shift_End', 'shift_end']);
    const lateEl = getVal(['Late_Hours', 'late_hours']);
    const earlyEl = getVal(['Early_Leave_Hours', 'early_leave_hours']);
    const statusEl = getVal(['Attendance_Status', 'attendance_status']);

    const parseMins = (timeStr) => {
        if (!timeStr || !timeStr.includes(':')) return null;
        const p = timeStr.trim().split(':');
        const h = parseInt(p[0], 10);
        const m = parseInt(p[1], 10);
        if (isNaN(h) || isNaN(m)) return null;
        return h * 60 + m;
    };

    const inMins = inEl ? parseMins(inEl.value) : null;
    const outMins = outEl ? parseMins(outEl.value) : null;
    const startMins = startEl ? parseMins(startEl.value) : null;
    const endMins = endEl ? parseMins(endEl.value) : null;

    if (inMins !== null && startMins !== null && lateEl) {
        if (inMins > startMins) {
            const diffHrs = Math.round(((inMins - startMins) / 60) * 100) / 100;
            lateEl.value = diffHrs;
            if (statusEl && statusEl.value !== 'LATE' && statusEl.value !== 'ON LEAVE' && statusEl.value !== 'OFF') {
                statusEl.value = 'LATE';
            }
        } else {
            lateEl.value = '0';
            if (statusEl && statusEl.value === 'LATE') {
                statusEl.value = 'PRESENT';
            }
        }
    }

    if (outMins !== null && endMins !== null && earlyEl) {
        if (outMins < endMins && outMins > 0) {
            const diffHrs = Math.round(((endMins - outMins) / 60) * 100) / 100;
            earlyEl.value = diffHrs;
        } else {
            earlyEl.value = '0';
        }
    }
}

/* =====================================================================
 * 📌 Helper i18n & Validation Functions
 * ===================================================================== */
function getFieldI18nKey(h) {
    if (!h) return '';
    const lw = String(h).trim().toLowerCase().replace(/[\s_]+/g, '');
    if (lw === 'employeeid' || lw === 'empid' || lw === 'employeesid' || lw === 'id') return 'employee_id_label';
    if (lw === 'prefix') return 'prefix_label';
    if (lw === 'firstname' || lw === 'first') return 'first_name_label';
    if (lw === 'lastname' || lw === 'last') return 'last_name_label';
    if (lw === 'departmentid' || lw === 'department') return 'department_label';
    if (lw === 'positionid' || lw === 'position') return 'position_label';
    if (lw === 'contact' || lw === 'phone' || lw === 'tel') return 'contact_label';
    if (lw === 'email') return 'email_label';
    if (lw === 'role') return 'role_label';
    if (lw === 'status') return 'status_label';
    if (lw === 'basesalary' || lw === 'salary') return 'base_salary_label';
    if (lw === 'dailyrateformula' || lw === 'dailyrate') return 'daily_rate_label';
    if (lw === 'isevaluator' || lw === 'evaluator') return 'is_evaluator_label';
    if (lw.includes('start') && lw.includes('date')) return 'start_date_label';
    if (lw.includes('end') && lw.includes('date')) return 'end_date_label';
    if (lw.includes('total') || lw.includes('days')) return 'total_days_label';
    if (lw.includes('handover') || lw.includes('work')) return 'work_handover_label';
    if (lw === 'object' || lw === 'reason') return 'reason_label';
    if (lw === 'type') return 'type_label';
    if (lw === 'category') return 'category_label';
    if (lw === 'comment' || lw === 'remark') return 'comment_label';
    if (lw === 'giveby') return 'give_by_label';
    if (lw === 'starpoint' || lw === 'score') return 'star_point_label';
    if (lw.includes('rating') && lw.includes('date')) return 'rating_date_label';
    if (lw === 'audience') return 'audience_label';
    if (lw === 'format') return 'format_label';
    if (lw === 'photo' || lw === 'profile' || lw === 'attachment') return 'photo_label';
    if (lw === 'permissions') return 'permissions_label';
    return String(h).trim();
}

function getFieldLabel(h) {
    const key = getFieldI18nKey(h);
    if (typeof t === 'function') {
        const val = t(key);
        if (val && val !== key) return val;
    }
    return h;
}

function getFieldPlaceholderKey(h) {
    if (!h) return 'enter_details';
    const lw = String(h).trim().toLowerCase().replace(/[\s_]+/g, '');
    if (lw === 'employeeid' || lw === 'empid' || lw === 'employeesid') return 'enter_employee_id';
    if (lw === 'firstname') return 'enter_first_name';
    if (lw === 'lastname') return 'enter_last_name';
    if (lw === 'email') return 'enter_email';
    if (lw === 'comment' || lw === 'remark') return 'enter_comment';
    if (lw === 'prefix') return 'select_prefix';
    if (lw === 'positionid' || lw === 'position') return 'select_position';
    if (lw === 'departmentid' || lw === 'department') return 'select_department';
    if (lw === 'role') return 'select_role';
    if (lw === 'status') return 'select_status';
    if (lw === 'format') return 'select_format';
    if (lw === 'giveby') return 'select_evaluator';
    return 'enter_details';
}

function getFieldPlaceholder(h) {
    const key = getFieldPlaceholderKey(h);
    if (typeof t === 'function') {
        const val = t(key);
        if (val && val !== key) return val;
    }
    const label = getFieldLabel(h);
    const lang = typeof getCurrentLanguage === 'function' ? getCurrentLanguage() : 'la';
    if (lang === 'la') {
        return 'ປ້ອນ' + label + '...';
    }
    return 'Enter ' + label + '...';
}

function checkDuplicateEmployeeId(inputEl) {
    if (!inputEl) return false;
    const val = inputEl.value.trim();
    const isEditing = Boolean(editingRecordId);
    let container = inputEl.parentElement;
    let warningEl = container.querySelector('#emp-id-duplicate-alert');

    if (!warningEl) {
        warningEl = document.createElement('div');
        warningEl.id = 'emp-id-duplicate-alert';
        container.appendChild(warningEl);
    }

    if (!val || isEditing) {
        warningEl.innerHTML = '';
        inputEl.classList.remove('border-red-500', 'bg-red-50', 'border-emerald-500', 'bg-emerald-50');
        return false;
    }

    let rowsToCheck = [];
    const sheet = typeof currentSheet === 'string' ? currentSheet.toLowerCase() : '';

    if (sheet === 'user') {
        // When adding/editing a User login account, check duplicate ONLY within existing USER accounts!
        rowsToCheck = (tableCache['user'] && tableCache['user'].data) || [];
        if (rowsToCheck.length === 0 && Array.isArray(rawData) && typeof activeTable === 'string' && activeTable.toLowerCase() === 'user') {
            rowsToCheck = rawData;
        }
    } else if (sheet === 'staff') {
        // When adding a new Staff member, check duplicate in staff table
        rowsToCheck = (tableCache['staff'] && tableCache['staff'].data) || [];
        if (rowsToCheck.length === 0 && Array.isArray(rawData) && typeof activeTable === 'string' && activeTable.toLowerCase() === 'staff') {
            rowsToCheck = rawData;
        }
    } else {
        let staffRows = (tableCache['staff'] && tableCache['staff'].data) || [];
        let userRows = (tableCache['user'] && tableCache['user'].data) || [];
        rowsToCheck = [...staffRows, ...userRows];
    }

    const targetUpper = val.toUpperCase();
    const isDuplicate = rowsToCheck.some(r => {
        // ONLY check employee code fields, NEVER match position_id, department_id, or row primary key id!
        let eId = r.employee_id || r.Employee_ID || r['employees id'] || r['Employees Id'] || r.emp_id || r.staff_id || r.username || r.Username;
        return eId && String(eId).trim().toUpperCase() === targetUpper;
    });

    if (isDuplicate) {
        inputEl.classList.add('border-red-500', 'bg-red-50');
        inputEl.classList.remove('border-emerald-500', 'bg-emerald-50');
        warningEl.className = 'mt-2 text-xs font-bold flex items-center gap-1.5 p-2.5 bg-red-50 text-red-600 rounded-xl border border-red-200 shadow-sm';
        warningEl.innerHTML = `<i class="fa-solid fa-triangle-exclamation text-red-500 text-sm"></i> <span data-i18n="emp_id_exists">${t('emp_id_exists')}</span> (${val})`;
        return true;
    } else {
        inputEl.classList.remove('border-red-500', 'bg-red-50');
        inputEl.classList.add('border-emerald-500', 'bg-emerald-50');
        warningEl.className = 'mt-2 text-xs font-bold flex items-center gap-1.5 p-2.5 bg-emerald-50 text-emerald-600 rounded-xl border border-emerald-200 shadow-sm';
        warningEl.innerHTML = `<i class="fa-solid fa-circle-check text-emerald-500 text-sm"></i> <span data-i18n="emp_id_available">${t('emp_id_available')}</span>`;
        return false;
    }
}

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

function renderEmployeeRatingForm(rowData = {}) {
    console.log("[renderEmployeeRatingForm] starting with rowData:", rowData);
    try {
        const safeGet = (names) => {
            for (const name of names) {
                const found = Object.keys(rowData || {}).find(k => String(k).toLowerCase().trim() === String(name).toLowerCase().trim());
                if (found && rowData[found] !== undefined && rowData[found] !== null) {
                    console.log("[renderEmployeeRatingForm] safeGet name found:", name, "-> value:", rowData[found]);
                    return rowData[found];
                }
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

        console.log("[renderEmployeeRatingForm] parsed values:", { ratingId, empId, empName, ratingDate, starPoint, category, comment, giveBy, status });

        const allCats = ['ตรงต่อเวลา', 'ทำยอดขายได้ดี', 'ช่วยเหลือเพื่อนร่วมงาน', 'บริการลูกค้าดี', 'ทำงานเป็นทีม', 'แก้ปัญหาได้ดี', 'ทำงานเกินเป้าหมาย', 'สร้างไอเดียใหม่', 'ไม่ขาดงาน', 'พนักงานดีเด่นประจำเดือน'];
        const categoryTagsHtml = allCats.map(c => {
            const escaped = String(c).replace(/'/g, "\\'");
            return `<span class="cursor-pointer text-[11px] px-2.5 py-1 rounded-full bg-white text-gray-700 hover:bg-brandindigo hover:text-white transition-all font-medium border border-gray-200 shadow-sm" onclick="document.getElementById('rating-category-input').value='${escaped}'">${c}</span>`;
        }).join('');

        const formFields = document.getElementById('form-fields');
        console.log("[renderEmployeeRatingForm] formFields element:", formFields);

        formFields.innerHTML = `
                    <input type="hidden" name="Ranting_Id" value="${String(ratingId).replace(/"/g, '&quot;')}">
                    <input type="hidden" name="Status" value="${String(status).replace(/"/g, '&quot;')}">
                    
                    <div class="col-span-1 sm:col-span-2 bg-indigo-50/60 p-5 rounded-2xl border border-indigo-100 mb-2">
                        <label class="block mb-2 text-xs font-bold text-gray-700 uppercase tracking-wider"><span data-i18n="employee_id_label">${t('employee_id_label')}</span> <span class="text-brandindigo">*</span></label>
                        <select id="rating-employee-select" name="Employees Id" required onchange="if(typeof onRatingEmployeeSelected === 'function') onRatingEmployeeSelected(this.value)" class="bg-white border border-gray-300 text-gray-900 text-sm rounded-xl focus:ring-brandindigo focus:border-brandindigo block w-full p-3 transition-colors shadow-sm">
                            <option value="${String(empId).replace(/"/g, '&quot;')}" selected>${empId ? empId : t('loading')}</option>
                        </select>
                    </div>
                    
                    <div><label class="block mb-2 text-xs font-bold text-gray-700 uppercase tracking-wider"><span data-i18n="first_name_label">${t('first_name_label')}</span> <span class="text-brandindigo">*</span></label><input id="rating-employee-name" type="text" name="Employees Name" value="${String(empName).replace(/"/g, '&quot;')}" required readonly class="bg-gray-50 border border-gray-300 text-gray-600 text-sm rounded-xl block w-full p-3 shadow-sm cursor-not-allowed"></div>
                    
                    <div><label class="block mb-2 text-xs font-bold text-gray-700 uppercase tracking-wider"><span data-i18n="rating_date_label">${t('rating_date_label')}</span> <span class="text-brandindigo">*</span></label><input type="date" name="Ranting Date" value="${String(ratingDate).slice(0, 10)}" required class="bg-white border border-gray-300 text-gray-900 text-sm rounded-xl focus:ring-brandindigo focus:border-brandindigo block w-full p-3 transition-colors shadow-sm"></div>
                    
                    <div class="col-span-1 sm:col-span-2"><label class="block mb-2 text-xs font-bold text-gray-700 uppercase tracking-wider"><span data-i18n="star_point_label">${t('star_point_label')}</span> <span class="text-brandindigo">*</span></label><div class="flex flex-col items-center justify-center bg-gray-50 p-4 rounded-xl border border-gray-200 min-h-[88px]"><div class="flex">${[1, 2, 3, 4, 5].map(i => `<i class="${i <= starPoint ? 'fa-solid fa-star text-yellow-400' : 'fa-regular fa-star text-gray-300'} text-4xl cursor-pointer hover:scale-110 transition-transform mx-1" onclick="if(typeof setFormStarRating === 'function') setFormStarRating(${i})" id="form-star-${i}"></i>`).join('')}</div><p id="form-star-text" class="mt-2 text-sm font-bold text-brandindigo" data-i18n="${starPoint > 0 ? '' : 'click_to_rate'}">${starPoint > 0 ? starPoint + ' / 5' : t('click_to_rate')}</p></div><input type="hidden" name="Star Point" id="hidden-star-input" value="${starPoint || ''}" required></div>
                    
                    <div>
                        <label class="block mb-2 text-xs font-bold text-gray-700 uppercase tracking-wider"><span data-i18n="category_label">${t('category_label')}</span> <span class="text-brandindigo">*</span></label>
                        <input type="text" id="rating-category-input" name="Category " value="${String(category).replace(/"/g, '&quot;')}" required
                            class="bg-white border border-gray-300 text-gray-900 text-sm rounded-xl focus:ring-brandindigo focus:border-brandindigo block w-full p-3 transition-colors shadow-sm"
                            placeholder="พิมพ์หมวดหมู่ หรือกดเลือกจากแถบด้านล่าง...">
                        <div class="mt-2 flex flex-wrap gap-1.5 max-h-[85px] overflow-y-auto p-1 bg-gray-50 rounded-xl border border-gray-100">
                            ${categoryTagsHtml}
                        </div>
                    </div>
                    
                    <div><label class="block mb-2 text-xs font-bold text-gray-700 uppercase tracking-wider"><span data-i18n="comment_label">${t('comment_label')}</span> <span class="text-brandindigo">*</span></label><input type="text" name="Comment" value="${String(comment).replace(/"/g, '&quot;')}" required placeholder="${t('enter_comment')}" data-i18n-placeholder="enter_comment" class="bg-white border border-gray-300 text-gray-900 text-sm rounded-xl focus:ring-brandindigo focus:border-brandindigo block w-full p-3 transition-colors shadow-sm"></div>
                    
                    <div class="col-span-1 sm:col-span-2"><label class="block mb-2 text-xs font-bold text-gray-700 uppercase tracking-wider"><span data-i18n="give_by_label">${t('give_by_label')}</span> <span class="text-brandindigo">*</span></label><select id="rating-give-by-select" name="Give By" required class="bg-white border border-gray-300 text-gray-900 text-sm rounded-xl focus:ring-brandindigo focus:border-brandindigo block w-full p-3 transition-colors shadow-sm"><option value="${String(giveBy).replace(/"/g, '&quot;')}" selected>${giveBy ? giveBy : t('loading')}</option></select></div>
                `;
        console.log("[renderEmployeeRatingForm] HTML set. Calling loadRatingStaffOptions");

        if (typeof loadRatingStaffOptions === 'function') {
            loadRatingStaffOptions(empId, giveBy);
        } else {
            console.warn("[renderEmployeeRatingForm] loadRatingStaffOptions is NOT a function!");
        }
    } catch (err) {
        console.error("Error generating form:", err);
        document.getElementById('form-fields').innerHTML = `<div class="col-span-full text-center p-4"><p class="text-red-500 font-bold mb-2">เกิดข้อผิดพลาดในการสร้างฟอร์ม</p><p class="text-xs text-gray-500">Error: ${err.message}</p></div>`;
    }
}

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
        let eId = String(getFuzzyValue(row, ['employee_id', 'emp_id'])).toUpperCase().trim();
        let name = getFuzzyValue(row, ['first_name', 'name', 'full_name', 'ชื่อ']);
        let lastName = getFuzzyValue(row, ['last_name', 'นามสกุล']);
        let fullName = name !== '-' ? (lastName !== '-' ? name + ' ' + lastName : name) : 'Unknown';

        if (eId && eId !== '-') {
            empOptions += `<option value="${eId}" ${eId === selectedEmpId ? 'selected' : ''}>${eId} - ${fullName}</option>`;
        }

        let posKey = Object.keys(row).find(k => ['position', 'position_id', 'ตำแหน่ง'].includes(k.toLowerCase().trim()));
        let pos = posKey ? String(row[posKey]).toLowerCase() : '';

        let isEvalVal = getFuzzyValue(row, ['Is Evaluator', 'is_evaluator']);
        let isExplicitEvaluator = String(isEvalVal).toLowerCase() === 'true' || isEvalVal === true || String(isEvalVal).toLowerCase() === 'yes';
        let isExplicitNonEvaluator = String(isEvalVal).toLowerCase() === 'false' || isEvalVal === false || String(isEvalVal).toLowerCase() === 'no';

        let isManager = pos.includes('ceo') || pos.includes('сео') ||
            pos.includes('coo') || pos.includes('соо') ||
            pos.includes('cfo') || pos.includes('сfо') || pos.includes('cfо') ||
            pos.includes('manager') || pos.includes('head') ||
            pos.includes('ผู้บริหาร') || pos.includes('admin') ||
            pos.includes('director') || pos.includes('ผู้อำนวยการ');

        let canEvaluate = isExplicitEvaluator || (isManager && !isExplicitNonEvaluator);
        if (canEvaluate) {
            let displayPos = posKey ? row[posKey] : '';
            giveByManagerOptions += `<option value="${fullName}" ${fullName === selectedGiveBy ? 'selected' : ''}>${fullName}${displayPos ? ' (' + displayPos + ')' : ''}</option>`;
            foundGiveBy = true;
        }
    });

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

function populateUserEmailDatalist() {
    const datalist = document.getElementById('staff-emails-list');
    if (!datalist) return;

    const buildOptions = (staffData) => {
        let options = '';
        (staffData || []).forEach(r => {
            const email = String(r.Email || r.email || r.Username || r.username || '').trim();
            const empId = String(r.Employee_ID || r.employee_id || r.emp_id || '').trim();
            const fName = String(r.First_Name || r.first_name || r.name || '').trim();
            const lName = String(r.Last_Name || r.last_name || '').trim();
            const fullName = `${fName} ${lName}`.trim() || empId;
            if (email && email !== '-') {
                options += `<option value="${email}">${fullName} (${empId})</option>`;
            }
        });
        datalist.innerHTML = options;
    };

    if (tableCache['staff'] && tableCache['staff'].data && tableCache['staff'].data.length > 0) {
        buildOptions(tableCache['staff'].data);
    } else {
        google.script.run.withSuccessHandler(res => {
            if (res && res.success && res.data) {
                tableCache['staff'] = { headers: res.headers || [], data: res.data };
                buildOptions(res.data);
            }
        }).getSheetData('staff');
    }
}

function autoFillUserEmpIdByEmail(emailVal) {
    if (currentSheet.toLowerCase() !== 'user') return;
    const cleanEmail = String(emailVal || '').trim().toLowerCase();
    if (!cleanEmail) return;

    const empIdInput = document.getElementById('user-emp-id-input') || document.querySelector('#dynamic-form input[name="Employee_ID"], #dynamic-form input[name="employee_id"]');
    if (!empIdInput) return;

    const lookupAndSet = (staffData) => {
        const match = (staffData || []).find(r => {
            const rEmail = String(r.Email || r.email || r.Username || r.username || '').trim().toLowerCase();
            return rEmail === cleanEmail;
        });
        if (match) {
            const matchedEmpId = String(match.Employee_ID || match.employee_id || match.emp_id || '').trim();
            if (matchedEmpId) {
                empIdInput.value = matchedEmpId;
                if (typeof checkDuplicateEmployeeId === 'function') {
                    checkDuplicateEmployeeId(empIdInput);
                }
                empIdInput.classList.add('bg-indigo-50', 'border-brandindigo');
                setTimeout(() => empIdInput.classList.remove('bg-indigo-50', 'border-brandindigo'), 1200);
            }
        }
    };

    if (tableCache['staff'] && tableCache['staff'].data && tableCache['staff'].data.length > 0) {
        lookupAndSet(tableCache['staff'].data);
    } else {
        google.script.run.withSuccessHandler(res => {
            if (res && res.success && res.data) {
                tableCache['staff'] = { headers: res.headers || [], data: res.data };
                lookupAndSet(res.data);
            }
        }).getSheetData('staff');
    }
}

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

    if (rowDataStr && typeof rowDataStr === 'string') {
        try {
            rowData = JSON.parse(decodeURIComponent(rowDataStr));
            editingRecordId = getRecordId(rowData);
            if (editingRecordId === '-') editingRecordId = null;

            let isNewFromQR = rowData['Ranting_Id'] === '' || rowData['rating_id'] === '';

            if (editingRecordId && !isNewFromQR && String(editingRecordId).trim() !== '' && !String(editingRecordId).startsWith('NEW-')) {
                document.getElementById('modal-title').innerHTML = `<i class="fa-solid fa-pen-to-square text-brandindigo mr-3"></i> <span data-i18n="edit_record">${t('edit_record')}</span>`;
            } else {
                document.getElementById('modal-title').innerHTML = `<i class="fa-solid fa-plus text-brandindigo mr-3"></i> <span data-i18n="add_record">${t('add_record')}</span>`;
                editingRecordId = null;
            }
        } catch (err) {
            rowData = {};
            document.getElementById('modal-title').innerHTML = `<i class="fa-solid fa-plus text-brandindigo mr-3"></i> <span data-i18n="add_record">${t('add_record')}</span>`;
        }
    } else {
        document.getElementById('modal-title').innerHTML = `<i class="fa-solid fa-plus text-brandindigo mr-3"></i> <span data-i18n="add_record">${t('add_record')}</span>`;
    }

    const formFields = document.getElementById('form-fields');
    formFields.classList.remove('hidden-important');
    formFields.style.cssText = '';
    formFields.innerHTML = '';
    
    console.log("[openFormModal] currentSheet:", currentSheet, "initial currentHeaders:", currentHeaders);
    currentHeaders = ensureHeadersForSheet(currentSheet, currentHeaders);
    console.log("[openFormModal] after ensureHeadersForSheet - currentHeaders:", currentHeaders);

    if (isEmployeeRatingSheet(currentSheet)) {
        console.log("[openFormModal] matches employee rating sheet, calling renderEmployeeRatingForm");
        renderEmployeeRatingForm(rowData);
        document.getElementById('form-modal').classList.remove('hidden');
        return;
    } else {
        console.log("[openFormModal] does NOT match employee rating sheet, building generic form. Headers length:", (currentHeaders || []).length);
    }

    currentHeaders.forEach((h, index) => {
        const lw = h.toLowerCase().trim();

        if (lw === 'signature') return;
        if (lw === 'status' && currentSheet.toLowerCase() !== 'staff' && currentSheet.toLowerCase() !== 'training') return;

        const val = rowData ? (rowData[h] || '') : '';
        const safeVal = String(val).replace(/"/g, '&quot;');

        if (currentSheet.toLowerCase() === 'staff' && (lw === 'ranking' || lw === 'reward level' || lw === 'reward_level')) {
            formFields.insertAdjacentHTML('beforeend', `<input type="hidden" name="${h}" value="${safeVal}">`);
            return;
        }

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
                { id: 'News', name: 'News & PR (ข่าวสาร)' },
                { id: 'Documents ', name: 'Documents (เอกสาร)' },
                { id: 'Training', name: 'Training (การฝึกอบรม)' },
                { id: 'orientation', name: 'Orientation (ปฐมนิเทศ)' },
                { id: 'Policy ', name: 'Policy (นโยบาย)' },
                { id: 'user', name: 'Users Management (จัดการผู้ใช้งาน)' },
                { id: 'Employees Ranting', name: 'Employee Rating (ประเมินพนักงาน)' },
                { id: 'KPI Records ', name: 'KPI Records (บันทึก KPI)' }
            ];

            let checkedValues = typeof parsePermissionsList === 'function' ? parsePermissionsList(val) : (val ? val.split(',').map(v => String(v).trim().toLowerCase()) : []);

            let checkboxesHtml = `
                        <div class="col-span-1 sm:col-span-2 bg-indigo-50/30 p-5 rounded-2xl border border-indigo-100 mt-2 mb-2">
                            <label class="block mb-4 text-sm font-bold text-brandindigo uppercase tracking-wider"><i class="fa-solid fa-user-shield mr-2"></i> กำหนดสิทธิ์ฟังก์ชันให้ผู้ใช้งาน</label>
                            <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 max-h-60 overflow-y-auto custom-scrollbar p-3 bg-white rounded-xl border border-gray-200 shadow-inner">`;

            allMenus.forEach(menu => {
                let isChecked = (typeof isMenuPermissionChecked === 'function' ? isMenuPermissionChecked(menu.id, checkedValues) : checkedValues.includes(String(menu.id).toLowerCase())) ? 'checked' : '';
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
                            <label class="block mb-2 text-xs font-bold text-gray-700 uppercase tracking-wider"><span data-i18n="employee_id_label">${t('employee_id_label')}</span> <span class="text-brandindigo">*</span></label>
                            <select id="${selectId}" name="${h}" required onchange="autoFillEmployeeData(this.value)" class="bg-white border border-gray-300 text-gray-900 text-sm rounded-xl focus:ring-brandindigo focus:border-brandindigo block w-full p-3 transition-colors shadow-sm">
                                <option value="${safeVal}" selected data-i18n="${safeVal ? '' : 'loading'}">${safeVal ? safeVal : t('loading')}</option>
                            </select>
                        </div>
                    `);

            var populateStaffSelect = function (res) {
                const selectEl = document.getElementById(selectId);
                if (selectEl && res.success && res.data && res.data.length > 0) {
                    if (!tableCache['staff']) tableCache['staff'] = { headers: res.headers || [], data: res.data };
                    else tableCache['staff'].data = res.data;

                    let options = '';

                    if (role !== 'Staff') {
                        options = `<option value="" disabled ${!val ? 'selected' : ''} data-i18n="select_employee">${t('select_employee')}</option>`;
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
                                <input type="email" id="user-email-input" name="${h}" value="${safeVal}" required list="staff-emails-list" oninput="autoFillUserEmpIdByEmail(this.value)" onchange="autoFillUserEmpIdByEmail(this.value)" class="bg-white border border-gray-300 text-gray-900 text-sm rounded-xl focus:ring-brandindigo focus:border-brandindigo block w-full p-3 transition-colors shadow-sm" placeholder="Enter or select staff email...">
                                <datalist id="staff-emails-list"></datalist>
                                </div>
                            `);
            setTimeout(() => populateUserEmailDatalist(), 50);
            return;
        }
        if (index === 0 && (currentSheet.toLowerCase() === 'staff' || currentSheet.toLowerCase() === 'user')) {
            const labelText = getFieldLabel(h);
            formFields.insertAdjacentHTML('beforeend', `
                                <div><label class="block mb-2 text-xs font-bold text-gray-700 uppercase tracking-wider"><span data-i18n="${lw === 'employee_id' || lw === 'emp_id' ? 'employee_id_label' : h}">${labelText}</span> <span class="text-brandindigo">*</span></label>
                                <input type="text" id="user-emp-id-input" name="${h}" value="${val}" required oninput="checkDuplicateEmployeeId(this)" onblur="checkDuplicateEmployeeId(this)" placeholder="${t('enter_employee_id')}" data-i18n-placeholder="enter_employee_id" class="bg-white border border-gray-300 text-gray-900 text-sm rounded-xl focus:ring-brandindigo focus:border-brandindigo block w-full p-3 transition-colors shadow-sm">
                                <div id="emp-id-duplicate-alert"></div>
                                </div>
                            `);
            if (val) setTimeout(() => {
                const inputEl = document.querySelector(`#dynamic-form input[name="${h.replace(/"/g, '\\"')}"]`);
                if (inputEl) checkDuplicateEmployeeId(inputEl);
            }, 100);
            return;
        }

/* =====================================================================
 * 📌 Date Formatting Helper for ISO Dates (YYYY-MM-DD)
 * ===================================================================== */
function formatToIsoDate(val) {
    if (!val || val === '-' || val === 'null' || val === 'undefined') return '';
    const str = String(val).trim();

    if (/^\d{4}-\d{2}-\d{2}$/.test(str)) return str;

    if (str.includes('/')) {
        const parts = str.split('/');
        if (parts.length === 3) {
            let day = parts[0].padStart(2, '0');
            let month = parts[1].padStart(2, '0');
            let year = parts[2];
            if (year.length === 4) return `${year}-${month}-${day}`;
        }
    }

    if (str.includes('-')) {
        const parts = str.split('-');
        if (parts.length === 3) {
            if (parts[0].length === 4) {
                return `${parts[0]}-${parts[1].padStart(2, '0')}-${parts[2].padStart(2, '0')}`;
            } else if (parts[2].length === 4) {
                return `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
            }
        }
    }

    if (str.includes('T')) return str.split('T')[0];
    return str;
}

function openAttendanceEditModalByDate(empId, dateStr) {
    if (!empId || !dateStr) return;
    
    currentSheet = 'Fingerprint_Logs';
    const logs = (tableCache['Fingerprint_Logs'] && Array.isArray(tableCache['Fingerprint_Logs'].data)) ? tableCache['Fingerprint_Logs'].data : [];
    const targetDateIso = formatToIsoDate(dateStr);

    let rowIndex = logs.findIndex(r => {
        let rEmp = String(r.Employee_ID || r.employee_id || r.Emp_ID || '').toUpperCase().trim();
        let rDateIso = formatToIsoDate(r.Date || r.date || '');
        return rEmp === empId.toUpperCase().trim() && rDateIso === targetDateIso;
    });

    if (rowIndex >= 0) {
        openFormModal(rowIndex);
    } else {
        openFormModal(null);
        setTimeout(() => {
            const form = document.getElementById('record-form');
            if (form) {
                const empEl = form.querySelector('[name="Employee_ID"], [name="employee_id"]');
                const dateEl = form.querySelector('[name="Date"], [name="date"]');
                if (empEl) empEl.value = empId;
                if (dateEl) dateEl.value = targetDateIso;
                if (typeof autoCalculateAttendanceTimes === 'function') {
                    autoCalculateAttendanceTimes();
                }
            }
        }, 120);
    }
}

        const isDate = lw.includes('date') || lw.includes('birthday') || lw.includes('วันเกิด');
        let displayVal = val;
        if (isDate && val && val !== '-') {
            displayVal = formatToIsoDate(val);
        }
        const safeDisplayVal = String(displayVal).replace(/"/g, '&quot;');
        const isOptional = (lw === 'adjusted_status' || lw === 'reference_leave_id' || lw === 'device id' || lw.includes('link') || lw.includes('url') || lw.includes('ลิงก์') || lw.includes('youtube') || lw.includes('facebook') || lw.includes('participant') || lw.includes('ผู้เข้าร่วม'));
        const requiredAttr = isOptional ? '' : 'required';

        if (lw === 'status' && currentSheet.toLowerCase() === 'staff') {
            formFields.insertAdjacentHTML('beforeend', `
                                <div><label class="block mb-2 text-xs font-bold text-gray-700 uppercase tracking-wider"><span data-i18n="status_label">${t('status_label')}</span></label>
                                <select name="${h}" required class="bg-white border border-gray-300 text-gray-900 text-sm rounded-xl focus:ring-brandindigo focus:border-brandindigo block w-full p-3 transition-colors shadow-sm">
                                    <option value="Active" ${val === 'Active' ? 'selected' : ''} data-i18n="status_present">${t('status_present')}</option>
                                    <option value="On Leave" ${val === 'On Leave' ? 'selected' : ''} data-i18n="status_absent_leave">${t('status_absent_leave')}</option>
                                    <option value="Inactive" ${val === 'Inactive' ? 'selected' : ''} data-i18n="status_absent">${t('status_absent')}</option>
                                </select></div>
                            `);
        }
        else if (lw === 'prefix' && currentSheet.toLowerCase() === 'staff') {
            formFields.insertAdjacentHTML('beforeend', `
                                <div><label class="block mb-2 text-xs font-bold text-gray-700 uppercase tracking-wider"><span data-i18n="prefix_label">${t('prefix_label')}</span> <span class="text-brandindigo">*</span></label>
                                <select name="${h}" required class="bg-white border border-gray-300 text-gray-900 text-sm rounded-xl focus:ring-brandindigo focus:border-brandindigo block w-full p-3 transition-colors shadow-sm">
                                    <option value="" disabled ${!val ? 'selected' : ''} data-i18n="select_prefix">${t('select_prefix')}</option>
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
        else if ((lw === 'is evaluator' || lw === 'is_evaluator') && currentSheet.toLowerCase() === 'staff') {
            const isChecked = String(val).toLowerCase() === 'true' || val === true || String(val).toLowerCase() === 'yes';
            formFields.insertAdjacentHTML('beforeend', `
                                <div class="col-span-1 sm:col-span-2 bg-indigo-50/50 p-4 rounded-xl border border-indigo-100 flex items-center justify-between">
                                    <div class="min-w-0 pr-4">
                                        <label class="block text-sm font-bold text-gray-700" data-i18n="is_evaluator_label">${t('is_evaluator_label')}</label>
                                        <p class="text-xs text-gray-500 font-medium mt-1" data-i18n="is_evaluator_desc">${t('is_evaluator_desc')}</p>
                                    </div>
                                    <label class="relative inline-flex items-center cursor-pointer select-none">
                                        <input type="checkbox" name="${h}" value="true" ${isChecked ? 'checked' : ''} class="sr-only peer">
                                        <div class="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-indigo-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-brandindigo"></div>
                                    </label>
                                </div>
                            `);
        }
        else if (lw === 'type' && currentSheet.toLowerCase() === 'announcements') {
            formFields.insertAdjacentHTML('beforeend', `
                                <div><label class="block mb-2 text-xs font-bold text-gray-700 uppercase tracking-wider"><span data-i18n="type_label">${t('type_label')}</span> <span class="text-brandindigo">*</span></label>
                                <select name="${h}" required class="bg-white border border-gray-300 text-gray-900 text-sm rounded-xl focus:ring-brandindigo focus:border-brandindigo block w-full p-3 transition-colors shadow-sm">
                                    <option value="" disabled ${!val ? 'selected' : ''} data-i18n="select_announcement_type">${t('select_announcement_type')}</option>
                                    <option value="Company" ${val === 'Company' ? 'selected' : ''}>Company (ประกาศบริษัท)</option>
                                    <option value="Meetings" ${val === 'Meetings' ? 'selected' : ''}>Meetings (นัดประชุม)</option>
                                    <option value="Events" ${val === 'Events' ? 'selected' : ''}>Events (กิจกรรม)</option>
                                    <option value="General" ${val === 'General' ? 'selected' : ''}>General (ทั่วไป)</option>
                                </select></div>
                            `);
        }
        else if (lw === 'type' && currentSheet.toLowerCase() === 'news') {
            formFields.insertAdjacentHTML('beforeend', `
                                <div><label class="block mb-2 text-xs font-bold text-gray-700 uppercase tracking-wider"><span data-i18n="type_label">${t('type_label')}</span> <span class="text-brandindigo">*</span></label>
                                <select name="${h}" required class="bg-white border border-gray-300 text-gray-900 text-sm rounded-xl focus:ring-brandindigo focus:border-brandindigo block w-full p-3 transition-colors shadow-sm">
                                    <option value="" disabled ${!val ? 'selected' : ''} data-i18n="select_news_type">${t('select_news_type')}</option>
                                    <option value="กิจกรรม" ${val === 'กิจกรรม' ? 'selected' : ''}>กิจกรรม (Activities)</option>
                                    <option value="บริการ" ${val === 'บริการ' ? 'selected' : ''}>บริการ (Services)</option>
                                    <option value="สินค้าใหม่" ${val === 'สินค้าใหม่' ? 'selected' : ''}>สินค้าใหม่ (New Products)</option>
                                    <option value="ทั่วไป" ${val === 'ทั่วไป' ? 'selected' : ''}>ทั่วไป (General)</option>
                                </select></div>
                            `);
        }
        else if (lw === 'audience' || lw === 'กลุ่มเป้าหมาย' || lw === 'เป้าหมาย') {
            formFields.insertAdjacentHTML('beforeend', `
                                <div><label class="block mb-2 text-xs font-bold text-gray-700 uppercase tracking-wider"><span data-i18n="audience_label">${t('audience_label')}</span> <span class="text-brandindigo">*</span></label>
                                <select name="${h}" required class="bg-white border border-gray-300 text-gray-900 text-sm rounded-xl focus:ring-brandindigo focus:border-brandindigo block w-full p-3 transition-colors shadow-sm">
                                    <option value="Public" ${val === 'Public' ? 'selected' : ''}>Public (เผยแพร่สาธารณะ)</option>
                                    <option value="Internal" ${val === 'Internal' ? 'selected' : ''}>Internal (ภายในองค์กรเท่านั้น)</option>
                                </select></div>
                            `);
        }
        else if ((lw === 'topic' || lw === 'detail' || lw === 'รายละเอียด') && currentSheet.toLowerCase() === 'announcements') {
            formFields.insertAdjacentHTML('beforeend', `
                                <div class="col-span-1 sm:col-span-2"><label class="block mb-2 text-xs font-bold text-gray-700 uppercase tracking-wider"><span data-i18n="reason_label">${t('reason_label')}</span> <span class="text-brandindigo">*</span></label>
                                <textarea name="${h}" required rows="4" class="bg-white border border-gray-300 text-gray-900 text-sm rounded-xl focus:ring-brandindigo focus:border-brandindigo block w-full p-3 transition-colors shadow-sm" placeholder="พิมพ์รายละเอียดประกาศ...">${safeDisplayVal}</textarea></div>
                            `);
        }
        else if (lw === 'status' && currentSheet.toLowerCase() === 'training') {
            formFields.insertAdjacentHTML('beforeend', `
                                <div><label class="block mb-2 text-xs font-bold text-gray-700 uppercase tracking-wider"><span data-i18n="status_label">${t('status_label')}</span> <span class="text-brandindigo">*</span></label>
                                <select name="${h}" required class="bg-white border border-gray-300 text-gray-900 text-sm rounded-xl focus:ring-brandindigo focus:border-brandindigo block w-full p-3 transition-colors shadow-sm">
                                    <option value="" disabled ${!val ? 'selected' : ''} data-i18n="select_status">${t('select_status')}</option>
                                    <option value="Upcoming" ${String(val).toLowerCase().includes('upcoming') ? 'selected' : ''}>Upcoming</option>
                                    <option value="Ongoing" ${String(val).toLowerCase().includes('ongoing') ? 'selected' : ''}>Ongoing</option>
                                    <option value="Completed" ${String(val).toLowerCase().includes('complete') ? 'selected' : ''}>Completed</option>
                                    <option value="Cancelled" ${String(val).toLowerCase().includes('cancel') ? 'selected' : ''}>Cancelled</option>
                                </select></div>
                            `);
        }
        else if ((lw === 'log_id' || lw === 'log id') && (currentSheet.toLowerCase().includes('log') || currentSheet.toLowerCase().includes('fingerprint'))) {
            let autoId = safeDisplayVal;
            if (!autoId || autoId === '-' || autoId === 'undefined' || autoId === 'null') {
                const randomCode = Math.random().toString(36).substring(2, 7).toUpperCase();
                autoId = `LOG-${Date.now()}-${randomCode}`;
            }
            const labelKey = getFieldI18nKey(h);
            const labelText = getFieldLabel(h);
            formFields.insertAdjacentHTML('beforeend', `
                <div><label class="block mb-2 text-xs font-bold text-gray-700 uppercase tracking-wider"><span data-i18n="${labelKey}">${labelText}</span> <span class="text-xs text-brandindigo font-bold ml-1">(Auto Generated)</span></label>
                <input type="text" name="${h}" value="${autoId}" readonly required class="bg-gray-100 border border-gray-300 text-gray-700 text-sm rounded-xl focus:ring-brandindigo focus:border-brandindigo block w-full p-3 font-mono font-bold transition-colors shadow-sm cursor-not-allowed"></div>
            `);
        }
        else if ((lw === 'attendance_status' || lw === 'attendance status') && (currentSheet.toLowerCase().includes('log') || currentSheet.toLowerCase().includes('fingerprint'))) {
            const valUpper = String(val || '').toUpperCase();
            formFields.insertAdjacentHTML('beforeend', `
                <div><label class="block mb-2 text-xs font-bold text-gray-700 uppercase tracking-wider"><span data-i18n="attendance_status">Attendance Status</span> <span class="text-brandindigo">*</span></label>
                <select name="${h}" required class="bg-white border border-gray-300 text-gray-900 text-sm rounded-xl focus:ring-brandindigo focus:border-brandindigo block w-full p-3 font-bold transition-colors shadow-sm">
                    <option value="PRESENT" ${valUpper.includes('PRESENT') || valUpper.includes('มาทำงาน') || valUpper.includes('ปกติ') ? 'selected' : ''}>PRESENT (มาทำงาน / ปกติ)</option>
                    <option value="LATE" ${valUpper.includes('LATE') || valUpper.includes('สาย') ? 'selected' : ''}>LATE (มาสาย)</option>
                    <option value="ABSENT" ${valUpper.includes('ABSENT') || valUpper.includes('ขาด') ? 'selected' : ''}>ABSENT (ขาดงาน)</option>
                    <option value="ON LEAVE" ${valUpper.includes('LEAVE') || valUpper.includes('ลา') ? 'selected' : ''}>ON LEAVE (ลากิจ/ลาป่วย)</option>
                    <option value="OFF" ${valUpper.includes('OFF') || valUpper.includes('หยุด') || valUpper.includes('HOLIDAY') ? 'selected' : ''}>OFF (วันหยุด)</option>
                </select></div>
            `);
        }
        else if ((lw === 'check_in' || lw === 'check_out' || lw === 'shift_start' || lw === 'shift_end') && (currentSheet.toLowerCase().includes('log') || currentSheet.toLowerCase().includes('fingerprint'))) {
            let defaultTime = safeDisplayVal;
            if (!defaultTime || defaultTime === '-' || defaultTime === 'undefined') {
                if (lw === 'shift_start') defaultTime = '09:00';
                else if (lw === 'shift_end') defaultTime = '17:00';
                else if (lw === 'check_in') defaultTime = '08:58';
                else if (lw === 'check_out') defaultTime = '17:00';
            }
            const labelKey = getFieldI18nKey(h);
            const labelText = getFieldLabel(h);
            formFields.insertAdjacentHTML('beforeend', `
                <div><label class="block mb-2 text-xs font-bold text-gray-700 uppercase tracking-wider"><span data-i18n="${labelKey}">${labelText}</span> <span class="text-brandindigo">*</span></label>
                <input type="text" name="${h}" value="${defaultTime}" oninput="autoCalculateAttendanceTimes()" required placeholder="e.g. 09:00" class="bg-white border border-gray-300 text-gray-900 text-sm rounded-xl focus:ring-brandindigo focus:border-brandindigo block w-full p-3 font-semibold transition-colors shadow-sm"></div>
            `);
        }
        else if ((lw === 'late_hours' || lw === 'early_leave_hours' || lw === 'ot_amount') && (currentSheet.toLowerCase().includes('log') || currentSheet.toLowerCase().includes('fingerprint'))) {
            let defaultNum = safeDisplayVal;
            if (!defaultNum || defaultNum === '-' || defaultNum === 'undefined') defaultNum = '0';
            const labelKey = getFieldI18nKey(h);
            const labelText = getFieldLabel(h);
            formFields.insertAdjacentHTML('beforeend', `
                <div><label class="block mb-2 text-xs font-bold text-gray-700 uppercase tracking-wider"><span data-i18n="${labelKey}">${labelText}</span></label>
                <input type="text" name="${h}" value="${defaultNum}" class="bg-white border border-gray-300 text-gray-900 text-sm rounded-xl focus:ring-brandindigo focus:border-brandindigo block w-full p-3 font-semibold transition-colors shadow-sm"></div>
            `);
        }
        else if (lw === 'status') {
            formFields.insertAdjacentHTML('beforeend', `
                                <div><label class="block mb-2 text-xs font-bold text-gray-700 uppercase tracking-wider"><span data-i18n="status_label">${t('status_label')}</span></label>
                                <select name="${h}" required class="bg-white border border-gray-300 text-gray-900 text-sm rounded-xl focus:ring-brandindigo focus:border-brandindigo block w-full p-3 transition-colors shadow-sm">
                                    <option value="Active" ${val === 'Active' || !val ? 'selected' : ''} data-i18n="status_present">${t('status_present')}</option>
                                    <option value="Inactive" ${val === 'Inactive' ? 'selected' : ''} data-i18n="status_absent">${t('status_absent')}</option>
                                </select></div>
                            `);
        }
        else if (lw === 'format' || lw === 'รูปแบบ') {
            formFields.insertAdjacentHTML('beforeend', `
                                <div><label class="block mb-2 text-xs font-bold text-gray-700 uppercase tracking-wider"><span data-i18n="format_label">${t('format_label')}</span> <span class="text-brandindigo">*</span></label>
                                <select name="${h}" required class="bg-white border border-gray-300 text-gray-900 text-sm rounded-xl focus:ring-brandindigo focus:border-brandindigo block w-full p-3 transition-colors shadow-sm">
                                    <option value="" disabled ${!val ? 'selected' : ''} data-i18n="select_format">${t('select_format')}</option>
                                    <option value="Online" ${val === 'Online' ? 'selected' : ''}>Online</option>
                                    <option value="In-Company" ${val === 'In-Company' ? 'selected' : ''}>In-Company</option>
                                    <option value="Public Training" ${val === 'Public Training' ? 'selected' : ''}>Public Training</option>
                                </select></div>
                            `);
        }
        else if ((lw === 'position_id' || lw === 'position') && currentSheet.toLowerCase() === 'staff') {
            formFields.insertAdjacentHTML('beforeend', `
                                <div><label class="block mb-2 text-xs font-bold text-gray-700 uppercase tracking-wider"><span data-i18n="position_label">${t('position_label')}</span> <span class="text-brandindigo">*</span></label>
                                <select name="${h}" required class="bg-white border border-gray-300 text-gray-900 text-sm rounded-xl focus:ring-brandindigo focus:border-brandindigo block w-full p-3 transition-colors shadow-sm">
                                    <option value="" disabled ${!val ? 'selected' : ''} data-i18n="select_position">${t('select_position')}</option>
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
        else if (lw === 'department_id' && currentSheet.toLowerCase() === 'staff') {
            const selectId = 'dropdown-' + lw;
            formFields.insertAdjacentHTML('beforeend', `
                                <div><label class="block mb-2 text-xs font-bold text-gray-700 uppercase tracking-wider"><span data-i18n="department_label">${t('department_label')}</span> <span class="text-brandindigo">*</span></label>
                                <select id="${selectId}" name="${h}" required class="bg-white border border-gray-300 text-gray-900 text-sm rounded-xl focus:ring-brandindigo focus:border-brandindigo block w-full p-3 transition-colors shadow-sm">
                                    <option value="${safeDisplayVal}" selected data-i18n="${safeDisplayVal ? '' : 'loading'}">${safeDisplayVal ? safeDisplayVal : t('loading')}</option>
                                </select></div>
                            `);

            google.script.run.withSuccessHandler(res => {
                const selectEl = document.getElementById(selectId);
                if (selectEl && res.success && res.data && res.data.length > 0) {
                    let options = `<option value="" disabled ${!val ? 'selected' : ''} data-i18n="select_department">${t('select_department')}</option>`;
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
        else if (lw === 'give by' || lw === 'give_by') {
            const selectId = 'dropdown-' + lw.replace(/\s+/g, '-');
            formFields.insertAdjacentHTML('beforeend', `
                                <div><label class="block mb-2 text-xs font-bold text-gray-700 uppercase tracking-wider"><span data-i18n="give_by_label">${t('give_by_label')}</span> <span class="text-brandindigo">*</span></label>
                                <select id="${selectId}" name="${h}" required class="bg-white border border-gray-300 text-gray-900 text-sm rounded-xl focus:ring-brandindigo focus:border-brandindigo block w-full p-3 transition-colors shadow-sm">
                                    <option value="${safeVal}" selected data-i18n="${safeVal ? '' : 'loading'}">${safeVal ? safeVal : t('loading')}</option>
                                </select></div>
                            `);

            var populateGiveBy = function (res) {
                const selectEl = document.getElementById(selectId);
                if (selectEl && res.success && res.data && res.data.length > 0) {
                    let options = `<option value="" disabled ${!val ? 'selected' : ''} data-i18n="select_evaluator">${t('select_evaluator')}</option>`;
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
        else if (lw === 'star point' || lw === 'star_point') {
            let currentRating = parseInt(val) || 0;
            let starsHtml = '';
            for (let i = 1; i <= 5; i++) {
                let starClass = i <= currentRating ? 'fa-solid fa-star text-yellow-400' : 'fa-regular fa-star text-gray-300';
                starsHtml += `<i class="${starClass} text-3xl cursor-pointer hover:scale-110 transition-transform mx-1" onclick="setFormStarRating(${i})" id="form-star-${i}"></i>`;
            }

            formFields.insertAdjacentHTML('beforeend', `
                                <div>
                                    <label class="block mb-2 text-xs font-bold text-gray-700 uppercase tracking-wider"><span data-i18n="star_point_label">${t('star_point_label')}</span> <span class="text-brandindigo">*</span></label>
                                    <div class="flex flex-col items-center justify-center bg-gray-50 p-4 rounded-xl border border-gray-200">
                                        <div class="flex">${starsHtml}</div>
                                        <p id="form-star-text" class="mt-2 text-sm font-bold text-brandindigo">${currentRating > 0 ? currentRating + ' / 5' : 'คลิกเพื่อให้คะแนน'}</p>
                                    </div>
                                    <input type="hidden" name="${h}" id="hidden-star-input" value="${currentRating > 0 ? currentRating : ''}" required>
                                </div>
                            `);
        }
        else if (lw === 'photo' || lw === 'document' || lw === 'ไฟล์แนบ' || lw === 'attachment' || (currentSheet.trim() === 'Policy' && lw === 'link') || (currentSheet.trim() === 'Documents' && (lw === 'file' || lw === 'link' || lw === 'ไฟล์'))) {
            const labelKey = getFieldI18nKey(h);
            const labelText = getFieldLabel(h);
            formFields.insertAdjacentHTML('beforeend', `
                                <div class="col-span-1 sm:col-span-2">
                                    <label class="block mb-2 text-xs font-bold text-gray-700 uppercase tracking-wider"><span data-i18n="${labelKey}">${labelText}</span> <span class="text-gray-400 font-normal ml-1" style="text-transform: none;">(Optional)</span></label>
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
        else if (lw === 'profile' || lw === 'รูป' || lw === 'pic' || lw === 'image' || lw === 'photos' || lw === 'photo') {
            const labelKey = getFieldI18nKey(h);
            const labelText = getFieldLabel(h);
            formFields.insertAdjacentHTML('beforeend', `
                                <div class="col-span-1 sm:col-span-2 bg-indigo-50/30 p-4 rounded-xl border border-indigo-100">
                                    <label class="block mb-3 text-xs font-bold text-gray-700 uppercase tracking-wider"><span data-i18n="${labelKey}">${labelText}</span></label>
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
        else if (lw === 'category' || lw === 'หมวดหมู่') {
            const uniqueInputId = 'gen-category-input-' + Date.now();
            const allCats = ['ตรงต่อเวลา', 'ทำยอดขายได้ดี', 'ช่วยเหลือเพื่อนร่วมงาน', 'บริการลูกค้าดี', 'ทำงานเป็นทีม', 'แก้ปัญหาได้ดี', 'ทำงานเกินเป้าหมาย', 'สร้างไอเดียใหม่', 'ไม่ขาดงาน', 'พนักงานดีเด่นประจำเดือน'];
            const tagsHtml = allCats.map(c => {
                const escaped = String(c).replace(/'/g, "\\'");
                return `<span class="cursor-pointer text-[11px] px-2.5 py-1 rounded-full bg-white text-gray-700 hover:bg-brandindigo hover:text-white transition-all font-medium border border-gray-200 shadow-sm" onclick="document.getElementById('${uniqueInputId}').value='${escaped}'">${c}</span>`;
            }).join('');

            formFields.insertAdjacentHTML('beforeend', `
                                <div>
                                    <label class="block mb-2 text-xs font-bold text-gray-700 uppercase tracking-wider"><span data-i18n="category_label">${t('category_label')}</span> <span class="text-brandindigo">*</span></label>
                                    <input type="text" id="${uniqueInputId}" name="${h}" value="${safeVal}" required
                                        class="bg-white border border-gray-300 text-gray-900 text-sm rounded-xl focus:ring-brandindigo focus:border-brandindigo block w-full p-3 transition-colors shadow-sm"
                                        placeholder="พิมพ์หมวดหมู่ หรือกดเลือกจากแถบด้านล่าง...">
                                    <div class="mt-2 flex flex-wrap gap-1.5 max-h-[85px] overflow-y-auto p-1 bg-gray-50 rounded-xl border border-gray-100">
                                        ${tagsHtml}
                                    </div>
                                </div>
                            `);
        }
        else if (lw === 'object' || lw === 'เหตุผล' || lw === 'reason' || lw === 'content' || lw === 'รายละเอียด' || lw === 'เนื้อหา') {
            const labelKey = getFieldI18nKey(h);
            const labelText = getFieldLabel(h);
            const placeholderKey = getFieldPlaceholderKey(h);
            const placeholderText = getFieldPlaceholder(h);
            formFields.insertAdjacentHTML('beforeend', `
                                <div class="col-span-1 sm:col-span-2">
                                    <label class="block mb-2 text-xs font-bold text-gray-700 uppercase tracking-wider"><span data-i18n="${labelKey}">${labelText}</span> <span class="text-brandindigo">*</span></label>
                                    <textarea name="${h}" required rows="4" class="bg-white border border-gray-300 text-gray-900 text-sm rounded-xl focus:ring-brandindigo focus:border-brandindigo block w-full p-3 transition-colors shadow-sm resize-y" placeholder="${placeholderText}" data-i18n-placeholder="${placeholderKey}">${safeDisplayVal}</textarea>
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

            const labelKey = getFieldI18nKey(h);
            const labelText = getFieldLabel(h);
            const placeholderKey = getFieldPlaceholderKey(h);
            const placeholderText = getFieldPlaceholder(h);

            formFields.insertAdjacentHTML('beforeend', `
                                <div class="${colSpan}"><label class="block mb-2 text-xs font-bold text-gray-700 uppercase tracking-wider"><span data-i18n="${labelKey}">${labelText}</span> ${isOptional ? '<span class="text-gray-400 font-normal ml-1">(Optional)</span>' : '<span class="text-brandindigo">*</span>'}</label>
                                <input type="${inputType}" name="${h}" value="${safeDisplayVal}" ${requiredAttr} class="bg-white border border-gray-300 text-gray-900 text-sm rounded-xl focus:ring-brandindigo focus:border-brandindigo block w-full p-3 transition-colors shadow-sm" placeholder="${placeholderText}" data-i18n-placeholder="${placeholderKey}"></div>
                            `);
        }
    });

    if (currentSheet.toLowerCase().includes('log') || currentSheet.toLowerCase().includes('fingerprint')) {
        setTimeout(autoCalculateAttendanceTimes, 100);
    }
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
    if (currentSheet.toLowerCase() === 'staff') {
        setTimeout(() => {
            const form = document.getElementById('dynamic-form');
            const inputs = Array.from(form.querySelectorAll('input'));

            const baseInput = inputs.find(i => i.name.toLowerCase().trim() === 'base_salary' || i.name.toLowerCase().includes('salary'));
            const dailyInput = inputs.find(i => i.name.toLowerCase().trim() === 'daily_rate_formula' || i.name.toLowerCase().includes('daily'));

            if (baseInput && dailyInput) {
                dailyInput.setAttribute('readonly', true);
                dailyInput.classList.add('bg-gray-100', 'text-gray-500', 'cursor-not-allowed', 'border-gray-200');
                dailyInput.classList.remove('bg-white');

                const calcDaily = () => {
                    let salary = parseFloat(baseInput.value) || 0;
                    dailyInput.value = salary > 0 ? (salary / 30).toFixed(2) : '';
                };

                baseInput.addEventListener('input', calcDaily);
                if (!dailyInput.value && baseInput.value) calcDaily();
            }
        }, 50);
    }

    if (typeof updateDOMTranslations === 'function') updateDOMTranslations();
    document.getElementById('form-modal').classList.remove('hidden');
}

function closeFormModal() {
    document.getElementById('form-modal').classList.add('hidden');
    editingRecordId = null;
}

/* =====================================================================
 * 🖼️ ฟังก์ชันย่อ/บีบอัดรูปก่อนแปลงเป็น base64
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
            // Skip file here, handled below
        } else {
            if (v === 'สร้างอัตโนมัติ (Auto)' || v === 'Auto Generated') {
                if (currentSheet.toLowerCase().includes('department')) {
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

    let fileInput = e.target.querySelector('input[type="file"]');
    let hiddenImgInput = document.getElementById('hidden-profile-input');

    if (fileInput && fileInput.files.length > 0) {
        toggleLoading(true, 'PREPARING IMAGE...');
        let file = fileInput.files[0];
        compressImageFile(file, 480, 0.72).then(function (base64Data) {
            google.script.run
                .withSuccessHandler(res => {
                    if (res.success) {
                        if (hiddenImgInput) {
                            let imgColName = hiddenImgInput.name;
                            dataObj[imgColName] = res.url;
                        }
                        executeSaveToSheet(dataObj, currentEditId);
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
        if (hiddenImgInput) {
            let imgColName = hiddenImgInput.name;
            dataObj[imgColName] = hiddenImgInput.value;
        }
        executeSaveToSheet(dataObj, currentEditId);
    }
}

function executeSaveToSheet(dataObj, currentEditId) {
    if (currentEditId === '-' || currentEditId === 'NEW-' || String(currentEditId || '').trim() === '') {
        currentEditId = null;
    }
    if (!currentEditId && (currentSheet.toLowerCase() === 'staff' || currentSheet.toLowerCase() === 'user')) {
        let empIdVal = getFuzzyValue(dataObj, ['employee_id', 'emp_id', 'employees id', 'staff_id', 'id', 'username']);
        if (empIdVal) {
            const targetUpper = String(empIdVal).trim().toUpperCase();
            let staffRows = (tableCache['staff'] && tableCache['staff'].data) || rawData || [];
            let userRows = (tableCache['user'] && tableCache['user'].data) || [];
            let allRows = [...staffRows, ...userRows];
            const isDup = allRows.some(r => {
                let eId = getFuzzyValue(r, ['employee_id', 'emp_id', 'employees id', 'staff_id', 'id', 'username']);
                return eId && String(eId).trim().toUpperCase() === targetUpper;
            });

            if (isDup) {
                toggleLoading(false);
                showToast(t('emp_id_exists') || `⚠️ ລະຫັດພະນັກງານນີ້ມີຢູ່ໃນລະບົບແລ້ວ! (${empIdVal})`, 'error');
                const empIdInput = document.querySelector('#dynamic-form input[name="Employee_ID"], #dynamic-form input[name="emp_id"], #dynamic-form input[name="User_ID"]');
                if (empIdInput) {
                    checkDuplicateEmployeeId(empIdInput);
                    empIdInput.focus();
                }
                return;
            }
        }
    }

    if (currentSheet === 'Leave application' && !currentEditId) {
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
            dataObj[businessIdCol] = `${prefix}-${randomCode}`;
        } else {
            dataObj[businessIdCol] = `${prefix}-${Date.now()}-${randomCode}`;
        }
    }

    if (!currentEditId) {
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
 * 📌 ส่วนที่ 20: BUDGET BILL EDITOR
 * ===================================================================== */
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

    const hiddenInput = document.getElementById('hidden-bill-items-input');
    if (hiddenInput) {
        hiddenInput.value = JSON.stringify(items);
    }

    const displayTotal = document.getElementById('bill-total-price-display');
    if (displayTotal) {
        displayTotal.innerText = new Intl.NumberFormat('th-TH').format(grandTotal);
    }

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
            addBillRow();
        }
    } catch (e) {
        console.warn('Failed to parse bill items JSON, adding blank row:', e);
        addBillRow();
    }
};

window.showBillDetailsModal = function (encodedRow) {
    try {
        const row = JSON.parse(decodeURIComponent(encodedRow));

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
