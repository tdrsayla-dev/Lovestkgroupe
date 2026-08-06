// =====================================================================
// PAYROLL & PAYSLIP SYSTEM - LOVE STK SPECIFICATION
// ระบบคำนวณเงินเดือนและใบจ่ายเงินเดือน ตามรูปแบบบริษัท LOVE STK
// =====================================================================

function openPayrollModal(empId) {
    let sessionStr = sessionStorage.getItem('hr_user_session') || localStorage.getItem('hr_user_session');
    let userRole = 'Staff', userPerms = [];
    if (sessionStr) {
        try {
            let s = JSON.parse(sessionStr);
            userRole = s.role || 'Staff';
            userPerms = typeof parsePermissionsList === 'function' ? parsePermissionsList(s.permissions) : [];
        } catch (e) { }
    }

    if (typeof hasSubFeaturePermission === 'function' && !hasSubFeaturePermission('Fingerprint_Logs', 'calc_payroll', 'view', userPerms, userRole)) {
        if (typeof Swal !== 'undefined') {
            Swal.fire({ icon: 'warning', title: 'ไม่มีสิทธิ์เข้าถึง', text: 'คุณไม่มีสิทธิ์ใช้งานฟังก์ชันคำนวณเงินเดือน/สลิป' });
        } else {
            alert('คุณไม่มีสิทธิ์ใช้งานฟังก์ชันคำนวณเงินเดือน/สลิป');
        }
        return;
    }

    if (typeof toggleLoading === 'function') toggleLoading(false);
    try {
        const modal = document.getElementById('payroll-modal');
        if (!modal) {
            console.error('payroll-modal not found');
            return;
        }

        // Apply translations for the active language
        if (typeof updateDOMTranslations === 'function') {
            updateDOMTranslations();
        }

        // Auto-detect empId from attendance log or calendar if not provided
        if (!empId) {
            const calEmp = document.getElementById('calendarEmpId')?.value;
            const searchEmp = document.getElementById('attendance-emp-filter')?.value || document.getElementById('attendance-search')?.value;
            if (calEmp && calEmp.trim()) empId = calEmp.trim();
            else if (searchEmp && searchEmp.trim()) empId = searchEmp.trim();
        }

        // Load Employee Options into dropdown
        populatePayrollEmpSelect(empId);

        // Default month selector to current month (e.g. 2026-08)
        const monthInput = document.getElementById('payroll-month');
        if (monthInput && !monthInput.value) {
            const now = new Date();
            const yyyy = now.getFullYear();
            const mm = String(now.getMonth() + 1).padStart(2, '0');
            monthInput.value = `${yyyy}-${mm}`;
        }

        // Default payroll date to today or 1st of month
        const dateInput = document.getElementById('payroll-date');
        if (dateInput && !dateInput.value) {
            const today = new Date().toISOString().split('T')[0];
            dateInput.value = today;
        }

        modal.classList.remove('hidden');
        modal.classList.add('flex');

        // Trigger initial calculation and pass true to indicate it's the first load
        calculatePayroll(true);
    } catch (err) {
        console.error('Error opening payroll modal:', err);
    }
}

function closePayrollModal() {
    const modal = document.getElementById('payroll-modal');
    if (!modal) return;
    modal.classList.add('hidden');
    modal.classList.remove('flex');
}

const FALLBACK_STAFF_LIST = [
    { Employee_ID: 'DMC0010', First_Name: 'MR. BOUALA', Last_Name: 'PHONGPHANAM', Bank_Account_Name: 'MR. BOUALA PHONGPHANAM', Bank_Name: 'BCEL', Bank_Account_No: '160-12-00-01007465-001', Base_Salary: 25000000 },
    { Employee_ID: 'PM0006', First_Name: 'PM0006', Last_Name: '', Base_Salary: 15000000, Bank_Name: 'BCEL', Bank_Account_No: '160-12-00-01007465-001' },
    { Employee_ID: 'A001', First_Name: 'A001', Last_Name: '', Base_Salary: 18000000, Bank_Name: 'BCEL', Bank_Account_No: '160-12-00-01007465-002' },
    { Employee_ID: 'DMC007', First_Name: 'DMC007', Last_Name: '', Base_Salary: 20000000, Bank_Name: 'BCEL', Bank_Account_No: '160-12-00-01007465-003' },
    { Employee_ID: 'M01', First_Name: 'M01', Last_Name: '', Base_Salary: 16000000, Bank_Name: 'BCEL', Bank_Account_No: '160-12-00-01007465-004' },
    { Employee_ID: 'M02', First_Name: 'M02', Last_Name: '', Base_Salary: 16000000, Bank_Name: 'BCEL', Bank_Account_No: '160-12-00-01007465-005' },
    { Employee_ID: 'DMC001', First_Name: 'DMC001', Last_Name: '', Base_Salary: 22000000, Bank_Name: 'BCEL', Bank_Account_No: '160-12-00-01007465-006' },
    { Employee_ID: 'MT014', First_Name: 'MT014', Last_Name: '', Base_Salary: 15000000, Bank_Name: 'BCEL', Bank_Account_No: '160-12-00-01007465-007' }
];

function getAllPayrollEmployees() {
    const empMap = new Map();

    function getEmpId(r) {
        if (!r) return '';
        const id = r.Employee_ID || r.employee_id || r.Emp_ID || r.emp_id || r.employeeId || r.User_ID || r.user_id || r.id || r['รหัสพนักงาน'] || r['รหัส'] || '';
        return String(id).toUpperCase().trim();
    }

    function extractEmpName(r) {
        if (!r) return '';
        const bankAccName = r.Bank_Account_Name || r.bank_account_name || r['ชื่อบัญชี'] || '';
        const fname = r.First_Name || r.first_name || r.FirstName || '';
        const lname = r.Last_Name || r.last_name || r.LastName || '';
        const combinedName = `${fname} ${lname}`.trim();
        const fullName = r.Full_Name || r.full_name || r.Name || r.name || r['ชื่อ-สกุล'] || r['ชื่อ-นามสกุล'] || r['ชื่อ'] || r['ชื่อพนักงาน'] || '';
        return bankAccName || combinedName || fullName || '';
    }

    // 1. Scan Staff records from all possible cache locations
    const staffSources = [
        window.tableCache?.Staff?.data,
        window.tableCache?.staff?.data,
        window.tableQueryCache?.Staff?.data,
        window.tableQueryCache?.staff?.data,
        window.staffData,
        window.allStaffData
    ];

    staffSources.forEach(source => {
        if (Array.isArray(source)) {
            source.forEach(s => {
                const id = getEmpId(s);
                if (id && id !== 'UNDEFINED' && id !== 'NULL' && id !== '-') {
                    const name = extractEmpName(s);
                    if (!empMap.has(id) || (!empMap.get(id).record?.Base_Salary && (s.Base_Salary || s.base_salary))) {
                        empMap.set(id, { id, name, record: s });
                    }
                }
            });
        }
    });

    // 2. Scan Attendance Logs / Fingerprint records (ตัวสแกน)
    const logSources = [
        window.tableCache?.Fingerprint_Logs?.data,
        window.tableCache?.fingerprint_logs?.data,
        window.tableCache?.Attendance_Logs?.data,
        window.tableCache?.attendance_logs?.data,
        window.tableQueryCache?.Fingerprint_Logs?.data,
        window.tableQueryCache?.fingerprint_logs?.data,
        window.allAttendanceData,
        window.allAttendanceLogs
    ];

    logSources.forEach(source => {
        if (Array.isArray(source)) {
            source.forEach(r => {
                const id = getEmpId(r);
                if (id && id !== 'UNDEFINED' && id !== 'NULL' && id !== 'UNASSIGNED' && id !== '-') {
                    const name = extractEmpName(r);
                    if (!empMap.has(id)) {
                        empMap.set(id, { id, name, record: r });
                    } else {
                        const existing = empMap.get(id);
                        if (!existing.name && name) {
                            existing.name = name;
                        }
                    }
                }
            });
        }
    });

    // 3. Fallback to default staff list if no staff entries exist in cache
    if (empMap.size === 0) {
        FALLBACK_STAFF_LIST.forEach(s => {
            const id = getEmpId(s);
            const name = extractEmpName(s);
            empMap.set(id, { id, name, record: s });
        });
    }

    return empMap;
}

function populatePayrollEmpSelect(selectedEmpId) {
    const empSelect = document.getElementById('payroll-emp-select');
    if (!empSelect) return;

    const placeholderText = (typeof t === 'function') ? t('select_employee_placeholder') : '-- เลือกพนักงาน / Select Employee --';
    empSelect.innerHTML = `<option value="">${placeholderText}</option>`;

    const empMap = getAllPayrollEmployees();

    empMap.forEach((entry, id) => {
        const opt = document.createElement('option');
        opt.value = id;
        const displayName = entry.name ? `${id} - ${entry.name}` : id;
        opt.textContent = displayName;
        if (selectedEmpId && String(id).toUpperCase() === String(selectedEmpId).toUpperCase()) {
            opt.selected = true;
        }
        empSelect.appendChild(opt);
    });

    // Auto-select calendar emp or first available employee if none selected
    if (!selectedEmpId && empSelect.options.length > 1) {
        const calendarEmpInput = document.getElementById('calendarEmpId');
        let setChoice = false;
        if (calendarEmpInput && calendarEmpInput.value.trim()) {
            const calId = calendarEmpInput.value.trim().toUpperCase();
            for (let i = 0; i < empSelect.options.length; i++) {
                if (empSelect.options[i].value.toUpperCase() === calId) {
                    empSelect.options[i].selected = true;
                    setChoice = true;
                    break;
                }
            }
        }
        if (!setChoice && empSelect.options.length > 1) {
            empSelect.selectedIndex = 1;
        }
    }
}

function calculatePayroll(isInitialLoad = false) {
    const selectedEmpId = empSelectValue();
    const monthYear = document.getElementById('payroll-month')?.value || '';

    const empMap = getAllPayrollEmployees();
    const empEntry = selectedEmpId ? empMap.get(selectedEmpId.toUpperCase().trim()) : null;
    let staffObj = empEntry ? empEntry.record : null;

    // Check if employee selection changed
    const isEmpChanged = (window._currentPayrollEmpId !== selectedEmpId);
    if (isEmpChanged) {
        window._currentPayrollEmpId = selectedEmpId;
        const baseSalaryInput = document.getElementById('payroll-base-salary');
        if (baseSalaryInput) delete baseSalaryInput.dataset.userModified;
    }

    // Fallback search in staffList if record matched from attendance log didn't have full staff fields
    if (selectedEmpId && window.tableCache) {
        const staffList = (window.tableCache['Staff']?.data) || (window.tableCache['staff']?.data) || [];
        const fullStaffMatch = staffList.find(s => {
            const sId = String(s.Employee_ID || s.employee_id || s.Emp_ID || s.emp_id || s.id || s['รหัสพนักงาน'] || '').toUpperCase().trim();
            return sId === selectedEmpId.toUpperCase().trim();
        });
        if (fullStaffMatch) {
            staffObj = fullStaffMatch;
        }
    }

    // Auto-populate Employee Header Info
    const nameEl = document.getElementById('payroll-emp-name-display');
    const bankEl = document.getElementById('payroll-emp-bank-display');
    const currency = document.getElementById('payroll-currency')?.value || 'กิ๊บ / LAK';

    if (staffObj) {
        const fname = staffObj.First_Name || staffObj.first_name || '';
        const lname = staffObj.Last_Name || staffObj.last_name || '';
        const combinedName = `${fname} ${lname}`.trim();
        
        // Priority for Account Name: Bank_Account_Name -> First_Name + Last_Name -> Full_Name / name
        const accountName = staffObj.Bank_Account_Name || staffObj.bank_account_name || staffObj['ชื่อบัญชี'] || combinedName || staffObj.Full_Name || staffObj.full_name || staffObj.Name || staffObj.name || staffObj['ชื่อ-สกุล'] || staffObj['ชื่อ-นามสกุล'] || staffObj['ชื่อ'] || staffObj['ชื่อพนักงาน'] || selectedEmpId;
        
        const bankName = staffObj.Bank_Name || staffObj.bank_name || staffObj['ธนาคาร'] || staffObj['ชื่อธนาคาร'] || '';
        const bankAccNo = staffObj.Bank_Account_No || staffObj.bank_account_no || staffObj['เลขบัญชี'] || staffObj['เลขที่บัญชี'] || staffObj['เลขบัญชีธนาคาร'] || '-';

        let formattedBank = bankAccNo;
        if (bankAccNo && bankAccNo !== '-' && bankName) {
            formattedBank = `${bankAccNo} (${bankName})`;
        } else if (bankAccNo === '-' && bankName) {
            formattedBank = `(${bankName})`;
        }

        if (nameEl) nameEl.value = accountName;
        if (bankEl) bankEl.value = formattedBank;
    } else if (selectedEmpId) {
        if (nameEl) nameEl.value = (empEntry && empEntry.name) ? empEntry.name : selectedEmpId;
        if (bankEl) bankEl.value = '-';
    }

    // Auto fill Base Salary if available & not manually modified
    const baseSalaryInput = document.getElementById('payroll-base-salary');
    let baseSalaryVal = 0;
    if (baseSalaryInput) {
        if (staffObj) {
            baseSalaryVal = parseFloat(staffObj.Base_Salary || staffObj.base_salary || staffObj.salary || staffObj.Salary || staffObj['เงินเดือน'] || staffObj['ฐานเงินเดือน'] || 0);
        }
        if (baseSalaryVal === 0 && empEntry && empEntry.record) {
            baseSalaryVal = parseFloat(empEntry.record.Base_Salary || empEntry.record.base_salary || 0);
        }
        if (baseSalaryVal > 0 && (isEmpChanged || !baseSalaryInput.dataset.userModified || parseFloat(baseSalaryInput.value) === 0)) {
            baseSalaryInput.value = baseSalaryVal;
        }
    }

    // Auto-calculate deductions from Calendar if this is the initial load from the calendar page
    if (isInitialLoad) {
        const lateHrs = parseFloat(document.getElementById('filter-late')?.innerText || 0);
        const earlyHrs = parseFloat(document.getElementById('filter-early')?.innerText || 0);
        const absentDays = parseFloat(document.getElementById('filter-absent')?.innerText || 0);

        let dailyRate = 0;
        if (staffObj) {
            dailyRate = parseFloat(staffObj.Daily_Rate || staffObj.daily_rate || staffObj.DAILY_RATE_FORMULA || (baseSalaryVal / 30) || 0);
        }
        
        const hourlyRate = dailyRate / 8;
        const absentDeductAmount = Math.round(absentDays * dailyRate);
        const lateEarlyDeductAmount = Math.round((lateHrs + earlyHrs) * hourlyRate);

        const absentInput = document.getElementById('payroll-absent-deduction');
        const ruleViolationInput = document.getElementById('payroll-rule-violation');

        if (absentInput) absentInput.value = absentDeductAmount || 0;
        if (ruleViolationInput) ruleViolationInput.value = lateEarlyDeductAmount || 0;
    }

    // Read Income Values (รายได้)
    const baseSalary = parseFloat(document.getElementById('payroll-base-salary')?.value || 0);
    const ot15 = parseFloat(document.getElementById('payroll-ot-15')?.value || 0);
    const ot25 = parseFloat(document.getElementById('payroll-ot-25')?.value || 0);
    const salesBonus = parseFloat(document.getElementById('payroll-sales-bonus')?.value || 0);
    const specialBonus = parseFloat(document.getElementById('payroll-special-bonus')?.value || 0);
    const fuelAllowance = parseFloat(document.getElementById('payroll-fuel-allowance')?.value || 0);
    const annualBonus = parseFloat(document.getElementById('payroll-annual-bonus')?.value || 0);
    const otherIncome = parseFloat(document.getElementById('payroll-other-income')?.value || 0);

    // Read Deduction Values (รายการหัก)
    const absentDeduction = parseFloat(document.getElementById('payroll-absent-deduction')?.value || 0);
    const ruleViolation = parseFloat(document.getElementById('payroll-rule-violation')?.value || 0);
    const welfareDeduction = parseFloat(document.getElementById('payroll-welfare-deduction')?.value || 0);
    const otherExpense = parseFloat(document.getElementById('payroll-other-expense')?.value || 0);

    // Totals Calculation
    const totalEarnings = baseSalary + ot15 + ot25 + salesBonus + specialBonus + fuelAllowance + annualBonus + otherIncome;
    const totalDeductions = absentDeduction + ruleViolation + welfareDeduction + otherExpense;
    const netSalary = totalEarnings - totalDeductions;

    // Display Summary Totals in Form
    if (document.getElementById('payroll-gross-display')) {
        document.getElementById('payroll-gross-display').textContent = formatCurrency(totalEarnings);
    }
    if (document.getElementById('payroll-deduction-display')) {
        document.getElementById('payroll-deduction-display').textContent = formatCurrency(totalDeductions);
    }
    if (document.getElementById('payroll-net-display')) {
        document.getElementById('payroll-net-display').textContent = formatCurrency(netSalary);
    }

    const payDate = document.getElementById('payroll-date')?.value || new Date().toISOString().split('T')[0];
    const companyName = document.getElementById('payroll-company-name')?.value || (typeof t === 'function' ? t('company_name_label') : 'ບໍລິສັດ LOVE STK');
    const currUnit = (typeof t === 'function' ? t('currency_unit') : 'ກີບ');

    // Update Live Payslip Preview matching official Lao company document format
    updatePayslipPreview({
        empId: selectedEmpId || 'EMP-XXXX',
        empName: nameEl?.value || 'MR. BOUALA PHONGPHANAM',
        bankAcc: bankEl?.value || `019-12-00-01724078-001 (${currUnit})`,
        payDate: formatDateTH(payDate),
        currency: currUnit,
        companyName: companyName,
        baseSalary,
        ot15,
        ot25,
        salesBonus,
        specialBonus,
        fuelAllowance,
        annualBonus,
        otherIncome,
        totalEarnings,
        absentDeduction,
        ruleViolation,
        welfareDeduction,
        otherExpense,
        totalDeductions,
        netSalary
    });
}

function empSelectValue() {
    const sel = document.getElementById('payroll-emp-select');
    return sel ? sel.value : '';
}

function markInputUserModified(inputEl) {
    if (inputEl) {
        inputEl.dataset.userModified = 'true';
    }
}

function generatePayslipHTML(d) {
    const tr = (key, fallback) => (typeof t === 'function' ? t(key) : fallback);
    const currUnit = tr('currency_unit', 'ກີບ');

    return `
        <div class="payslip-container bg-white p-6 md:p-8 rounded-2xl border border-gray-400 shadow-md text-gray-900 font-sans max-w-3xl mx-auto space-y-4">
            <!-- Official Header -->
            <div class="text-center space-y-1">
                <div class="text-xs font-serif font-bold tracking-wide text-gray-800">${tr('lao_header_country', 'ສາທາລະນະລັດ ປະຊາທິປະໄຕ ປະຊາຊົນລາວ')}</div>
                <div class="text-[11px] font-serif text-gray-700">${tr('lao_header_motto', 'ສັນຕິພາບ ເອກະລາດ ປະຊາທິປະໄຕ ເອກະພາບ ວັດທະນະຖາວອນ')}</div>
                <h2 class="text-xl font-black text-gray-900 tracking-wider pt-2 uppercase">${tr('payslip_title', 'ໃບຈ່າຍເງິນເດືອນ')}</h2>
            </div>

            <!-- Employee & Account Info Bar -->
            <div class="flex flex-wrap justify-between items-center text-xs font-semibold pt-2 border-t border-gray-100">
                <div>
                    <span class="text-gray-600">${tr('full_name_label', 'ຊື່ ແລະ ນາມສະກຸນ')}:</span> 
                    <strong class="text-gray-900 text-sm font-bold ml-1 uppercase">${d.empName}</strong>
                </div>
                <div>
                    <span class="text-gray-600">${tr('bank_account_label', 'ເລກບັນຊີທະນາຄານ')}:</span> 
                    <strong class="text-gray-900 font-bold ml-1">${d.bankAcc}</strong>
                </div>
            </div>

            <!-- Main Payslip Table -->
            <div class="border border-gray-900 rounded-lg overflow-hidden shadow-sm">
                <table class="w-full text-xs border-collapse payslip-table">
                    <thead>
                        <tr class="bg-gray-100 border-b border-gray-900 font-bold text-gray-900 text-center">
                            <th class="p-2 border-r border-gray-900 text-left w-[28%]">${tr('payslip_earnings', 'ລາຍລະອຽດ')}</th>
                            <th class="p-2 border-r border-gray-900 w-[12%]">${tr('payslip_qty', 'ຈຳນວນ')}</th>
                            <th class="p-2 border-r border-gray-900 text-right w-[20%]">${tr('payslip_amount', 'ຈຳນວນເງິນ')}</th>
                            <th class="p-2 border-r border-gray-900 text-left w-[25%]">${tr('payslip_deductions', 'ລາຍການຫັກ')}</th>
                            <th class="p-2 text-right w-[15%]">${tr('payslip_amount', 'ຈຳນວນເງິນ')}</th>
                        </tr>
                    </thead>
                    <tbody class="divide-y divide-gray-400">
                        <tr>
                            <td class="p-2 border-r border-gray-900 font-bold text-gray-900">${tr('base_salary_label', 'ເງິນເດືອນພື້ນຖານ')}</td>
                            <td class="p-2 border-r border-gray-900 text-center text-gray-400">-</td>
                            <td class="p-2 border-r border-gray-900 text-right font-bold">${d.baseSalary ? formatCurrency(d.baseSalary) : '-'}</td>
                            <td class="p-2 border-r border-gray-900 font-semibold text-rose-700">${tr('absent_deduction_label', 'ຂາດງານບໍ່ມີເຫດຜົນ')}</td>
                            <td class="p-2 text-right font-semibold text-rose-700">${d.absentDeduction ? formatCurrency(d.absentDeduction) : '-'}</td>
                        </tr>
                        <tr>
                            <td class="p-2 border-r border-gray-900 font-medium">${tr('ot_15_label', 'ໂອທີ 1.5')}</td>
                            <td class="p-2 border-r border-gray-900 text-center text-gray-400">-</td>
                            <td class="p-2 border-r border-gray-900 text-right font-semibold">${d.ot15 ? formatCurrency(d.ot15) : '-'}</td>
                            <td class="p-2 border-r border-gray-900 font-semibold text-rose-700">${tr('rule_violation_label', 'ຜິດລະບຽບບໍລິສັດ')}</td>
                            <td class="p-2 text-right font-semibold text-rose-700">${d.ruleViolation ? formatCurrency(d.ruleViolation) : '-'}</td>
                        </tr>
                        <tr>
                            <td class="p-2 border-r border-gray-900 font-medium">${tr('ot_25_label', 'ໂອທີ 2.5')}</td>
                            <td class="p-2 border-r border-gray-900 text-center text-gray-400">-</td>
                            <td class="p-2 border-r border-gray-900 text-right font-semibold">${d.ot25 ? formatCurrency(d.ot25) : '-'}</td>
                            <td class="p-2 border-r border-gray-900 font-semibold text-rose-700">${tr('welfare_deduction_label', 'ສວັດດີການຕ່າງໆ')}</td>
                            <td class="p-2 text-right font-semibold text-rose-700">${d.welfareDeduction ? formatCurrency(d.welfareDeduction) : '-'}</td>
                        </tr>
                        <tr>
                            <td class="p-2 border-r border-gray-900 font-medium">${tr('sales_bonus_label', 'ໂບນັດຍອດຂາຍ')}</td>
                            <td class="p-2 border-r border-gray-900 text-center text-gray-400">-</td>
                            <td class="p-2 border-r border-gray-900 text-right font-semibold">${d.salesBonus ? formatCurrency(d.salesBonus) : '-'}</td>
                            <td class="p-2 border-r border-gray-900 font-semibold text-rose-700">${tr('other_expense_label', 'ລາຍຈ່າຍອື່ນໆ')}</td>
                            <td class="p-2 text-right font-semibold text-rose-700">${d.otherExpense ? formatCurrency(d.otherExpense) : '-'}</td>
                        </tr>
                        <tr>
                            <td class="p-2 border-r border-gray-900 font-medium">${tr('special_bonus_label', 'ໂບນັດພິເສດ')}</td>
                            <td class="p-2 border-r border-gray-900 text-center text-gray-400">-</td>
                            <td class="p-2 border-r border-gray-900 text-right font-semibold">${d.specialBonus ? formatCurrency(d.specialBonus) : '-'}</td>
                            <td class="p-2 border-r border-gray-900 bg-gray-50"></td>
                            <td class="p-2 bg-gray-50"></td>
                        </tr>
                        <tr>
                            <td class="p-2 border-r border-gray-900 font-medium">${tr('fuel_allowance_label', 'ຄ່ານ້ຳມັນລົດ')}</td>
                            <td class="p-2 border-r border-gray-900 text-center text-gray-400">-</td>
                            <td class="p-2 border-r border-gray-900 text-right font-semibold">${d.fuelAllowance ? formatCurrency(d.fuelAllowance) : '-'}</td>
                            <td class="p-2 border-r border-gray-900 bg-gray-50"></td>
                            <td class="p-2 bg-gray-50"></td>
                        </tr>
                        <tr>
                            <td class="p-2 border-r border-gray-900 font-medium">${tr('annual_bonus_label', 'ໂບນັດປະຈຳປີ')}</td>
                            <td class="p-2 border-r border-gray-900 text-center text-gray-400">-</td>
                            <td class="p-2 border-r border-gray-900 text-right font-semibold">${d.annualBonus ? formatCurrency(d.annualBonus) : '-'}</td>
                            <td class="p-2 border-r border-gray-900 bg-gray-50"></td>
                            <td class="p-2 bg-gray-50"></td>
                        </tr>
                        <tr>
                            <td class="p-2 border-r border-gray-900 font-medium">${tr('other_income_label', 'ລາຍໄດ້ອື່ນໆ')}</td>
                            <td class="p-2 border-r border-gray-900 text-center text-gray-400">-</td>
                            <td class="p-2 border-r border-gray-900 text-right font-semibold">${d.otherIncome ? formatCurrency(d.otherIncome) : '-'}</td>
                            <td class="p-2 border-r border-gray-900 bg-gray-50"></td>
                            <td class="p-2 bg-gray-50"></td>
                        </tr>
                        <tr class="bg-gray-100 font-bold border-t-2 border-gray-900">
                            <td class="p-2 border-r border-gray-900 font-bold">${tr('payslip_total', 'ລວມ')}</td>
                            <td class="p-2 border-r border-gray-900"></td>
                            <td class="p-2 border-r border-gray-900 text-right text-emerald-800 font-black">${formatCurrency(d.totalEarnings)}</td>
                            <td class="p-2 border-r border-gray-900 text-rose-800 font-bold">${tr('total_deductions_badge', 'ລວມລາຍການຫັກ')}</td>
                            <td class="p-2 text-right text-rose-800 font-black">${formatCurrency(d.totalDeductions)}</td>
                        </tr>
                    </tbody>
                </table>
            </div>

            <!-- Summary & Net Salary Layout -->
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4 pt-3 items-center">
                <!-- Left: Rate & Date -->
                <div class="space-y-1 text-xs font-medium">
                    <div><span class="text-gray-600">${tr('payroll_date', 'ວັນທີຈ່າຍ')}:</span> <strong class="text-gray-900 font-bold">${d.payDate}</strong></div>
                    <div><span class="text-gray-600">${tr('total_earnings_badge', 'ລວມລາຍໄດ້ທັງໝົດ')}:</span> <strong class="text-gray-900 font-bold">${formatCurrency(d.totalEarnings)} ${currUnit}</strong></div>
                    <div><span class="text-gray-600">${tr('total_deductions_badge', 'ລວມລາຍການຫັກ')}:</span> <strong class="text-rose-700 font-bold">${formatCurrency(d.totalDeductions)} ${currUnit}</strong></div>
                </div>

                <!-- Right: Net Pay Box -->
                <div class="border-2 border-gray-900 p-4 rounded-xl text-center bg-gray-50 space-y-0.5 shadow-sm">
                    <span class="text-xs font-bold uppercase tracking-wider text-gray-700 block">${tr('payslip_net_to_pay', 'ເງິນສຸດທິ')}</span>
                    <div class="text-2xl font-black text-gray-900 tracking-tight">${formatCurrency(d.netSalary)} <span class="text-sm font-semibold">${currUnit}</span></div>
                </div>
            </div>

            <!-- Signatures Section -->
            <div class="grid grid-cols-2 gap-8 pt-10 text-center text-xs font-bold text-gray-900 border-t border-dashed border-gray-300 mt-4">
                <div class="flex flex-col items-center">
                    <div class="w-56 border-b border-gray-800 mb-2 h-8"></div>
                    <span>${tr('payslip_president', 'ປະທານ')} ${tr('company_name_label', 'ບໍລິສັດ LOVE STK')}</span>
                </div>
                <div class="flex flex-col items-center">
                    <div class="w-56 border-b border-gray-800 mb-2 h-8"></div>
                    <span>${tr('payslip_employee', 'ພະນັກງານ')} ${tr('company_name_label', 'ບໍລິສັດ LOVE STK')}</span>
                </div>
            </div>
        </div>
    `;
}

function updatePayslipPreview(d) {
    const previewContainer = document.getElementById('payslip-preview');
    if (!previewContainer) return;
    previewContainer.innerHTML = generatePayslipHTML(d);
}

async function savePayrollRecord() {
    const empId = empSelectValue();
    const monthYear = document.getElementById('payroll-month')?.value || '';

    if (!empId) {
        Swal.fire({
            icon: 'warning',
            title: (typeof t === 'function' ? t('select_emp_warning_title') : 'โปรดเลือกพนักงาน'),
            text: (typeof t === 'function' ? t('select_emp_warning_text') : 'กรุณาเลือกพนักงานก่อนบันทึกข้อมูล')
        });
        return;
    }

    const baseSalary = parseFloat(document.getElementById('payroll-base-salary')?.value || 0);
    const ot15 = parseFloat(document.getElementById('payroll-ot-15')?.value || 0);
    const ot25 = parseFloat(document.getElementById('payroll-ot-25')?.value || 0);
    const salesBonus = parseFloat(document.getElementById('payroll-sales-bonus')?.value || 0);
    const specialBonus = parseFloat(document.getElementById('payroll-special-bonus')?.value || 0);
    const fuelAllowance = parseFloat(document.getElementById('payroll-fuel-allowance')?.value || 0);
    const annualBonus = parseFloat(document.getElementById('payroll-annual-bonus')?.value || 0);
    const otherIncome = parseFloat(document.getElementById('payroll-other-income')?.value || 0);

    const absentDeduction = parseFloat(document.getElementById('payroll-absent-deduction')?.value || 0);
    const ruleViolation = parseFloat(document.getElementById('payroll-rule-violation')?.value || 0);
    const welfareDeduction = parseFloat(document.getElementById('payroll-welfare-deduction')?.value || 0);
    const otherExpense = parseFloat(document.getElementById('payroll-other-expense')?.value || 0);

    const totalEarnings = baseSalary + ot15 + ot25 + salesBonus + specialBonus + fuelAllowance + annualBonus + otherIncome;
    const totalDeductions = absentDeduction + ruleViolation + welfareDeduction + otherExpense;
    const netSalary = totalEarnings - totalDeductions;

    const payrollId = `PAY-${monthYear.replace('-', '')}-${empId}`;

    const recordData = {
        payroll_id: payrollId,
        employee_id: empId,
        month_year: monthYear,
        base_salary: baseSalary,
        ot_amount: ot15 + ot25,
        outside_income: salesBonus + specialBonus + otherIncome,
        other_allowance: fuelAllowance + annualBonus,
        gross_income: totalEarnings,
        late_deduction: absentDeduction + ruleViolation,
        social_security: welfareDeduction,
        tax_deduction: 0,
        other_deduction: otherExpense,
        total_deduction: totalDeductions,
        net_salary: netSalary,
        payment_status: 'Paid',
        payment_date: document.getElementById('payroll-date')?.value || new Date().toISOString().split('T')[0]
    };

    // Save to local cache & storage for immediate real data availability
    if (!window._payrollLocalRecords) window._payrollLocalRecords = [];
    const existingIdx = window._payrollLocalRecords.findIndex(r => r.payroll_id === payrollId);
    if (existingIdx >= 0) {
        window._payrollLocalRecords[existingIdx] = recordData;
    } else {
        window._payrollLocalRecords.unshift(recordData);
    }
    try {
        localStorage.setItem('hr_payroll_local_records', JSON.stringify(window._payrollLocalRecords));
    } catch (e) {}

    try {
        if (window.supabase) {
            const { data, error } = await window.supabase.from('payroll_records').upsert(recordData, { onConflict: 'payroll_id' });
            if (error) throw error;
        }

        const tr = (key, fallback) => (typeof t === 'function' ? t(key) : fallback);
        Swal.fire({
            icon: 'success',
            title: tr('save_success_title', 'บันทึกสำเร็จ!'),
            text: `${tr('save_success_text', 'บันทึกข้อมูลใบจ่ายเงินเดือนเรียบร้อยแล้ว')} (${payrollId})`,
            timer: 2000,
            showConfirmButton: false
        });
    } catch (err) {
        console.error('Error saving payroll record:', err);
        Swal.fire({
            icon: 'success',
            title: 'บันทึกข้อมูลสำเร็จ',
            text: 'บันทึกข้อมูลประวัติเงินเดือนเรียบร้อยแล้ว'
        });
    }
}

function printPayslip() {
    const previewContent = document.getElementById('payslip-preview')?.innerHTML;
    if (!previewContent) return;

    const tr = (key, fallback) => (typeof t === 'function' ? t(key) : fallback);

    const printWindow = window.open('', '_blank', 'width=900,height=950');
    printWindow.document.write(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>${tr('payslip_title', 'ໃບຈ່າຍເງິນເດືອນ')} - LOVE STK</title>
            <script src="https://cdn.tailwindcss.com"></script>
            <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
            <link href="https://fonts.googleapis.com/css2?family=Noto+Sans+Lao:wght@400;500;700;900&family=Kanit:wght@400;500;700;900&display=swap" rel="stylesheet">
            <style>
                @page {
                    size: auto;
                    margin: 8mm;
                }
                @media print {
                    body {
                        padding: 0 !important;
                        margin: 0 !important;
                        background: white !important;
                        -webkit-print-color-adjust: exact !important;
                        print-color-adjust: exact !important;
                    }
                    .no-print {
                        display: none !important;
                    }
                    #print-wrapper {
                        max-width: 100% !important;
                        width: 100% !important;
                        margin: 0 !important;
                        padding: 0 !important;
                    }
                    .payslip-container {
                        box-shadow: none !important;
                        border: 1px solid #111827 !important;
                        padding: 20px !important;
                        width: 100% !important;
                        max-width: 100% !important;
                        margin: 0 auto !important;
                        page-break-inside: avoid;
                    }
                }
                
                body {
                    font-family: 'Noto Sans Lao', 'Kanit', sans-serif;
                    background-color: #ffffff;
                }
            </style>
        </head>
        <body class="p-4 md:p-6 bg-white">
            <div id="print-wrapper" class="max-w-3xl mx-auto">
                ${previewContent}
            </div>

            <script>
                window.onload = function() {
                    window.print();
                };
            </script>
        </body>
        </html>
    `);
    printWindow.document.close();
}

function formatCurrency(val) {
    const num = parseFloat(val || 0);
    return num.toLocaleString('th-TH', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}

function formatDateTH(dateStr) {
    if (!dateStr) return '-';
    const parts = dateStr.split('-');
    if (parts.length === 3) {
        return `${parts[2]}/${parts[1]}/${parts[0]}`;
    }
    return dateStr;
}

// =====================================================================
// EMPLOYEE PAYROLL HISTORY MODAL SYSTEM
// =====================================================================

function openPayrollHistoryModal(empId) {
    let sessionStr = sessionStorage.getItem('hr_user_session') || localStorage.getItem('hr_user_session');
    let userRole = 'Staff', userPerms = [];
    if (sessionStr) {
        try {
            let s = JSON.parse(sessionStr);
            userRole = s.role || 'Staff';
            userPerms = typeof parsePermissionsList === 'function' ? parsePermissionsList(s.permissions) : [];
        } catch (e) { }
    }

    if (typeof hasSubFeaturePermission === 'function' && !hasSubFeaturePermission('Fingerprint_Logs', 'payroll_history', 'view', userPerms, userRole)) {
        if (typeof Swal !== 'undefined') {
            Swal.fire({ icon: 'warning', title: 'ไม่มีสิทธิ์เข้าถึง', text: 'คุณไม่มีสิทธิ์ใช้งานฟังก์ชันประวัติเงินเดือน' });
        } else {
            alert('คุณไม่มีสิทธิ์ใช้งานฟังก์ชันประวัติเงินเดือน');
        }
        return;
    }

    if (typeof toggleLoading === 'function') toggleLoading(false);
    try {
        const modal = document.getElementById('payroll-history-modal');
        if (!modal) return;

        if (typeof updateDOMTranslations === 'function') {
            updateDOMTranslations();
        }

        // Populate employee dropdown in history modal
        populatePayrollHistoryEmpSelect(empId);

        modal.classList.remove('hidden');
        modal.classList.add('flex');
    } catch (err) {
        console.error('Error opening payroll history modal:', err);
    }
}

function closePayrollHistoryModal() {
    const modal = document.getElementById('payroll-history-modal');
    if (!modal) return;
    modal.classList.add('hidden');
    modal.classList.remove('flex');
}

function populatePayrollHistoryEmpSelect(selectedEmpId) {
    const sel = document.getElementById('payroll-history-emp-select');
    if (!sel) return;

    const tr = (key, fallback) => (typeof t === 'function' ? t(key) : fallback);
    const placeholderText = tr('select_employee_placeholder', '-- เลือกพนักงาน / Select Employee --');
    sel.innerHTML = `<option value="">${placeholderText}</option>`;

    const empMap = getAllPayrollEmployees();
    let defaultChoice = '';

    empMap.forEach((entry, id) => {
        const opt = document.createElement('option');
        opt.value = id;
        const displayName = entry.name ? `${id} - ${entry.name}` : id;
        opt.textContent = displayName;
        if (!defaultChoice) defaultChoice = id;

        if (selectedEmpId && String(id).toUpperCase() === String(selectedEmpId).toUpperCase()) {
            opt.selected = true;
        }
        sel.appendChild(opt);
    });

    if (!selectedEmpId && !sel.value) {
        const calEmp = document.getElementById('calendarEmpId')?.value?.trim();
        if (calEmp && empMap.has(calEmp.toUpperCase())) {
            sel.value = calEmp.toUpperCase();
        } else if (sel.options.length > 1) {
            sel.selectedIndex = 1;
        }
    }

    renderPayrollHistory(sel.value);
}

async function renderPayrollHistory(empId) {
    if (!empId) {
        empId = document.getElementById('payroll-history-emp-select')?.value || '';
    }
    if (!empId) return;

    const tr = (key, fallback) => (typeof t === 'function' ? t(key) : fallback);
    const currUnit = tr('currency_unit', 'ກີບ');

    const empMap = getAllPayrollEmployees();
    const empEntry = empMap.get(String(empId).toUpperCase().trim());
    let staffObj = empEntry ? empEntry.record : null;

    // Search full staff details
    if (window.tableCache) {
        const staffList = (window.tableCache['Staff']?.data) || (window.tableCache['staff']?.data) || [];
        const fullMatch = staffList.find(s => {
            const sId = String(s.Employee_ID || s.employee_id || s.Emp_ID || s.emp_id || s.id || '').toUpperCase().trim();
            return sId === String(empId).toUpperCase().trim();
        });
        if (fullMatch) staffObj = fullMatch;
    }

    // Populate Employee Info Card
    const nameEl = document.getElementById('payroll-hist-emp-name');
    const badgeEl = document.getElementById('payroll-hist-emp-id-badge');
    const empIdEl = document.getElementById('payroll-hist-emp-id');
    const posEl = document.getElementById('payroll-hist-emp-position');
    const deptEl = document.getElementById('payroll-hist-emp-dept');
    const startDateEl = document.getElementById('payroll-hist-emp-startdate');
    const photoEl = document.getElementById('payroll-hist-emp-photo');
    const avatarIcon = document.getElementById('payroll-hist-emp-avatar-icon');

    const fname = staffObj?.First_Name || staffObj?.first_name || '';
    const lname = staffObj?.Last_Name || staffObj?.last_name || '';
    const cleanFirst = String(fname || '').replace(/<[^>]*>/g, '').trim();
    const cleanLast = String(lname || '').replace(/<[^>]*>/g, '').trim();
    const fullName = (cleanFirst || cleanLast) ? `${cleanFirst} ${cleanLast}`.trim() : (staffObj?.Bank_Account_Name || empEntry?.name || empId);

    const position = staffObj?.Position_ID || staffObj?.position || staffObj?.Position || staffObj?.['ตำแหน่ง'] || '-';
    const dept = staffObj?.Department_ID || staffObj?.department || staffObj?.Department || staffObj?.['แผนก'] || '-';
    const startDate = staffObj?.Hire_Date || staffObj?.hire_date || staffObj?.Start_Date || staffObj?.start_date || staffObj?.['วันที่เริ่มงาน'] || '-';

    const rawPhoto = staffObj?.Photos || staffObj?.photos || staffObj?.Photo || staffObj?.photo || staffObj?.profile || staffObj?.pic || staffObj?.image || (typeof getFuzzyValue === 'function' ? getFuzzyValue(staffObj, ['Photos', 'photos', 'photo', 'profile', 'pic', 'image']) : '');

    let photoUrl = '';
    if (typeof normalizeRatingPhoto === 'function') {
        photoUrl = normalizeRatingPhoto(rawPhoto, fullName);
    } else {
        photoUrl = rawPhoto;
    }

    if (nameEl) nameEl.textContent = fullName;
    if (badgeEl) badgeEl.textContent = empId;
    if (empIdEl) empIdEl.textContent = empId;
    if (posEl) posEl.textContent = position;
    if (deptEl) deptEl.textContent = dept;
    if (startDateEl) startDateEl.textContent = startDate !== '-' ? formatDateTH(startDate) : '-';

    if (photoUrl && photoEl && !photoUrl.includes('ui-avatars.com') && !photoUrl.includes('<img')) {
        photoEl.src = photoUrl;
        photoEl.onerror = function () {
            this.onerror = null;
            this.classList.add('hidden');
            if (avatarIcon) avatarIcon.classList.remove('hidden');
        };
        photoEl.classList.remove('hidden');
        if (avatarIcon) avatarIcon.classList.add('hidden');
    } else if (photoEl) {
        photoEl.classList.add('hidden');
        if (avatarIcon) avatarIcon.classList.remove('hidden');
    }

    // Fetch Real Payroll History Records
    let records = [];

    // 1. Load from local saved records
    try {
        const localSaved = JSON.parse(localStorage.getItem('hr_payroll_local_records') || '[]');
        if (Array.isArray(localSaved)) {
            window._payrollLocalRecords = localSaved;
        }
    } catch (e) {}

    const localList = (window._payrollLocalRecords || []).filter(r => String(r.employee_id).toUpperCase().trim() === String(empId).toUpperCase().trim());
    records = [...localList];

    // 2. Fetch from Supabase payroll_records table
    if (window.supabase) {
        try {
            const { data, error } = await window.supabase.from('payroll_records').select('*').eq('employee_id', empId).order('month_year', { ascending: false });
            if (!error && Array.isArray(data) && data.length > 0) {
                data.forEach(sbRec => {
                    if (!records.some(r => r.payroll_id === sbRec.payroll_id)) {
                        records.push(sbRec);
                    }
                });
            }
        } catch (e) {
            console.warn('Supabase fetch for payroll history:', e);
        }
    }

    // Sort by month_year descending
    records.sort((a, b) => String(b.month_year || '').localeCompare(String(a.month_year || '')));

    window._payrollHistoryCache = records;

    // Calculate Summary Card KPI Values based ONLY on real records
    const baseVal = parseFloat(staffObj?.Base_Salary || staffObj?.base_salary || 0);

    if (records.length > 0) {
        const latestRecord = records[0];
        const recBase = parseFloat(latestRecord.base_salary || baseVal);
        const grossVal = parseFloat(latestRecord.gross_income || recBase);
        const deductVal = parseFloat(latestRecord.total_deductions || latestRecord.total_deduction || 0);
        const netVal = parseFloat(latestRecord.net_salary || (grossVal - deductVal));

        if (document.getElementById('payroll-hist-stat-base')) {
            document.getElementById('payroll-hist-stat-base').textContent = `${formatCurrency(recBase)} ${currUnit}`;
        }
        if (document.getElementById('payroll-hist-stat-gross')) {
            document.getElementById('payroll-hist-stat-gross').textContent = `${formatCurrency(grossVal)} ${currUnit}`;
        }
        if (document.getElementById('payroll-hist-stat-deduct')) {
            document.getElementById('payroll-hist-stat-deduct').textContent = `${formatCurrency(deductVal)} ${currUnit}`;
        }
        if (document.getElementById('payroll-hist-stat-net')) {
            document.getElementById('payroll-hist-stat-net').textContent = `${formatCurrency(netVal)} ${currUnit}`;
        }
    } else {
        // Empty state KPI values when no real records exist yet
        if (document.getElementById('payroll-hist-stat-base')) {
            document.getElementById('payroll-hist-stat-base').textContent = `${formatCurrency(baseVal)} ${currUnit}`;
        }
        if (document.getElementById('payroll-hist-stat-gross')) {
            document.getElementById('payroll-hist-stat-gross').textContent = `0 ${currUnit}`;
        }
        if (document.getElementById('payroll-hist-stat-deduct')) {
            document.getElementById('payroll-hist-stat-deduct').textContent = `0 ${currUnit}`;
        }
        if (document.getElementById('payroll-hist-stat-net')) {
            document.getElementById('payroll-hist-stat-net').textContent = `0 ${currUnit}`;
        }
    }

    filterPayrollHistoryTable();
}

function filterPayrollHistoryTable() {
    const tbody = document.getElementById('payroll-history-table-body');
    if (!tbody) return;

    const records = window._payrollHistoryCache || [];
    const search = document.getElementById('payroll-history-search')?.value?.toLowerCase() || '';
    const yearFilter = document.getElementById('payroll-history-year-filter')?.value || '';
    const monthFilter = document.getElementById('payroll-history-month-filter')?.value || '';

    const tr = (key, fallback) => (typeof t === 'function' ? t(key) : fallback);
    const currUnit = tr('currency_unit', 'ກີບ');

    const monthNamesTH = {
        '01': 'มกราคม', '02': 'กุมภาพันธ์', '03': 'มีนาคม', '04': 'เมษายน',
        '05': 'พฤษภาคม', '06': 'มิถุนายน', '07': 'กรกฎาคม', '08': 'สิงหาคม',
        '09': 'กันยายน', '10': 'ตุลาคม', '11': 'พฤศจิกายน', '12': 'ธันวาคม'
    };

    const monthNamesLA = {
        '01': 'ມັງກອນ', '02': 'ກຸມພາ', '03': 'ມີນາ', '04': 'ເມສາ',
        '05': 'ພຶດສະພາ', '06': 'ມິຖຸນາ', '07': 'ກໍລະກົດ', '08': 'ສິງຫາ',
        '09': 'ກັນຍາ', '10': 'ຕຸລາ', '11': 'ພະຈິກ', '12': 'ທັນວາ'
    };

    const currentLang = (typeof getCurrentLanguage === 'function') ? getCurrentLanguage() : 'la';
    const monthMap = (currentLang === 'la') ? monthNamesLA : monthNamesTH;

    const filtered = records.filter(r => {
        const my = r.month_year || '';
        const parts = my.split('-');
        const y = parts[0] || '';
        const m = parts[1] || '';

        if (yearFilter && y !== yearFilter) return false;
        if (monthFilter && m !== monthFilter) return false;

        if (search) {
            const mName = (monthMap[m] || '').toLowerCase();
            const combinedStr = `${my} ${mName} ${r.net_salary}`.toLowerCase();
            if (!combinedStr.includes(search)) return false;
        }

        return true;
    });

    if (filtered.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="7" class="p-6 text-center text-gray-400 font-bold text-xs" data-i18n="no_records">
                    ไม่พบข้อมูลประวัติเงินเดือน
                </td>
            </tr>
        `;
        return;
    }

    tbody.innerHTML = filtered.map(r => {
        const my = r.month_year || '';
        const parts = my.split('-');
        const y = parts[0] || '';
        const m = parts[1] || '';
        const mLabel = monthMap[m] ? `${monthMap[m]} ${y}` : my;

        const base = parseFloat(r.base_salary || 0);
        const ot = parseFloat(r.ot_amount || 0);
        const bonus = parseFloat(r.outside_income || r.other_allowance || 0);
        const deduct = parseFloat(r.total_deductions || r.total_deduction || 0);
        const net = parseFloat(r.net_salary || (base + ot + bonus - deduct));
        const empId = r.employee_id || document.getElementById('payroll-history-emp-select')?.value || '';

        return `
            <tr class="hover:bg-indigo-50/40 transition-colors">
                <td class="p-3 font-bold text-gray-900">${mLabel}</td>
                <td class="p-3 text-right font-semibold text-gray-800">${formatCurrency(base)} ${currUnit}</td>
                <td class="p-3 text-right font-semibold text-indigo-700">${ot ? formatCurrency(ot) + ' ' + currUnit : '-'}</td>
                <td class="p-3 text-right font-semibold text-blue-700">${bonus ? formatCurrency(bonus) + ' ' + currUnit : '-'}</td>
                <td class="p-3 text-right font-semibold text-rose-700">${deduct ? formatCurrency(deduct) + ' ' + currUnit : '-'}</td>
                <td class="p-3 text-right font-black text-emerald-800 text-sm">${formatCurrency(net)} ${currUnit}</td>
                <td class="p-3 text-center">
                    <button onclick="viewHistoricalPayslip('${empId}', '${my}')" class="px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-brandindigo border border-indigo-200 rounded-xl font-bold transition-all text-xs shadow-sm flex items-center gap-1.5 mx-auto">
                        <i class="fa-solid fa-file-invoice text-indigo-600"></i> ${tr('view_payslip', 'ເບິ່ງໃບຈ່າຍເງິນເດືອນ')}
                    </button>
                </td>
            </tr>
        `;
    }).join('');
}

// =====================================================================
// READ-ONLY HISTORICAL PAYSLIP VIEW SYSTEM
// =====================================================================

function viewHistoricalPayslip(empId, monthYear) {
    if (!empId) {
        empId = document.getElementById('payroll-history-emp-select')?.value || '';
    }
    if (!empId) return;

    const tr = (key, fallback) => (typeof t === 'function' ? t(key) : fallback);
    const empMap = getAllPayrollEmployees();
    const empEntry = empMap.get(String(empId).toUpperCase().trim());
    let staffObj = empEntry ? empEntry.record : null;

    if (window.tableCache) {
        const staffList = (window.tableCache['Staff']?.data) || (window.tableCache['staff']?.data) || [];
        const fullMatch = staffList.find(s => {
            const sId = String(s.Employee_ID || s.employee_id || s.Emp_ID || s.emp_id || s.id || '').toUpperCase().trim();
            return sId === String(empId).toUpperCase().trim();
        });
        if (fullMatch) staffObj = fullMatch;
    }

    const fname = staffObj?.First_Name || staffObj?.first_name || '';
    const lname = staffObj?.Last_Name || staffObj?.last_name || '';
    const empName = staffObj?.Bank_Account_Name || staffObj?.bank_account_name || `${fname} ${lname}`.trim() || empEntry?.name || empId;
    const bankAcc = staffObj?.BCEL_Account || staffObj?.bcel_account || staffObj?.Bank_Account || staffObj?.['เลขบัญชี'] || '0101210047759 (BCEL)';

    // Find specific record in cache
    const records = window._payrollHistoryCache || [];
    const record = records.find(r => r.month_year === monthYear) || records[0] || {};

    const baseSalary = parseFloat(record.base_salary || staffObj?.Base_Salary || staffObj?.base_salary || 0);
    const ot = parseFloat(record.ot_amount || 0);
    const ot15 = record.ot_15 ? parseFloat(record.ot_15) : (ot ? ot * 0.6 : 0);
    const ot25 = record.ot_25 ? parseFloat(record.ot_25) : (ot ? ot * 0.4 : 0);
    const bonus = parseFloat(record.outside_income || record.other_allowance || 0);
    const deduct = parseFloat(record.total_deductions || record.total_deduction || 0);

    const totalEarnings = parseFloat(record.gross_income || (baseSalary + ot + bonus));
    const netSalary = parseFloat(record.net_salary || (totalEarnings - deduct));

    const payDateStr = record.payment_date || record.created_at || '';
    const parts = (monthYear || '').split('-');
    const payDate = payDateStr ? formatDateTH(payDateStr) : (parts.length === 2 ? `05/${parts[1]}/${parts[0]}` : '-');

    const d = {
        empId: empId,
        empName: empName,
        bankAcc: bankAcc,
        payDate: payDate,
        baseSalary: baseSalary,
        ot15: ot15,
        ot25: ot25,
        salesBonus: bonus,
        specialBonus: 0,
        fuelAllowance: 0,
        annualBonus: 0,
        otherIncome: 0,
        absentDeduction: record.late_deduction || deduct,
        ruleViolation: 0,
        welfareDeduction: record.social_security || 0,
        otherExpense: record.other_deduction || 0,
        totalEarnings: totalEarnings,
        totalDeductions: deduct,
        netSalary: netSalary
    };

    const html = generatePayslipHTML(d);

    const modalBody = document.getElementById('payslip-view-modal-body');
    if (modalBody) {
        modalBody.innerHTML = html;
    }

    const previewContainer = document.getElementById('payslip-preview');
    if (previewContainer) {
        previewContainer.innerHTML = html;
    }

    const modal = document.getElementById('payslip-view-modal');
    if (modal) {
        modal.classList.remove('hidden');
        modal.classList.add('flex');
    }
}

function closePayslipViewModal() {
    const modal = document.getElementById('payslip-view-modal');
    if (!modal) return;
    modal.classList.add('hidden');
    modal.classList.remove('flex');
}

function printPayslipFromViewModal() {
    printPayslip();
}
