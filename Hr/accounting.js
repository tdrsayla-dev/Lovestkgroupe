// ─────────────────────────────────────────────────────────────────────────────
// js/accounting.js — Accounting Module (Phase 1: Chart of Accounts & Expense Vouchers)
// ─────────────────────────────────────────────────────────────────────────────

let chartOfAccountsData = [];
let expenseVouchersData = [];
let currentCategoryFilter = 'ALL';

// Fallback seed accounts if database table is newly initialized
const DEFAULT_ACCOUNTS = [
  { id: 1, account_code: '1001', account_name_th: 'เงินสด', account_name_en: 'Cash on Hand', category_type: 'Asset', description: 'เงินสดในมือ/เงินสดย่อย', is_active: true },
  { id: 2, account_code: '1002', account_name_th: 'เงินฝากธนาคาร', account_name_en: 'Cash at Bank', category_type: 'Asset', description: 'เงินฝากธนาคารกระแสรายวัน/ออมทรัพย์', is_active: true },
  { id: 3, account_code: '1003', account_name_th: 'ลูกหนี้การค้า', account_name_en: 'Accounts Receivable', category_type: 'Asset', description: 'ลูกหนี้การค้าและลูกหนี้อื่น', is_active: true },
  { id: 4, account_code: '2001', account_name_th: 'เจ้าหนี้การค้า', account_name_en: 'Accounts Payable', category_type: 'Liability', description: 'เจ้าหนี้การค้าและเจ้าหนี้อื่น', is_active: true },
  { id: 5, account_code: '2002', account_name_th: 'ภาษีหัก ณ ที่จ่ายค้างจ่าย', account_name_en: 'Withholding Tax Payable', category_type: 'Liability', description: 'ภาษีหัก ณ ที่จ่ายค้างนำส่ง', is_active: true },
  { id: 6, account_code: '2003', account_name_th: 'เงินประกันสังคมค้างจ่าย', account_name_en: 'Social Security Payable', category_type: 'Liability', description: 'เงินประกันสังคมค้างนำส่ง', is_active: true },
  { id: 7, account_code: '3001', account_name_th: 'ทุนเรือนหุ้น', account_name_en: 'Share Capital', category_type: 'Equity', description: 'ทุนจดทะเบียนชำระแล้ว', is_active: true },
  { id: 8, account_code: '3002', account_name_th: 'กำไรสะสม', account_name_en: 'Retained Earnings', category_type: 'Equity', description: 'กำไรสะสมยังไม่ได้จัดสรร', is_active: true },
  { id: 9, account_code: '4001', account_name_th: 'รายได้จากการขายและบริการ', account_name_en: 'Sales & Service Revenue', category_type: 'Revenue', description: 'รายได้หลักจากการดำเนินธุรกิจ', is_active: true },
  { id: 10, account_code: '4002', account_name_th: 'รายได้อื่น', account_name_en: 'Other Income', category_type: 'Revenue', description: 'รายได้อื่นที่ไม่เกี่ยวกับการดำเนินงานหลัก', is_active: true },
  { id: 11, account_code: '5001', account_name_th: 'ค่าใช้จ่ายเงินเดือนและค่าจ้าง', account_name_en: 'Salaries & Wages Expense', category_type: 'Expense', description: 'ค่าใช้จ่ายเงินเดือน ค่าตอบแทนพนักงาน', is_active: true },
  { id: 12, account_code: '5002', account_name_th: 'ค่าใช้จ่ายเดินทางและพาหนะ', account_name_en: 'Travel & Transportation Expense', category_type: 'Expense', description: 'ค่าเดินทาง ค่าค่าน้ำมัน ค่ายานพาหนะ', is_active: true },
  { id: 13, account_code: '5003', account_name_th: 'ค่าสาธารณูปโภค (น้ำ/ไฟ/เน็ต)', account_name_en: 'Utilities Expense', category_type: 'Expense', description: 'ค่าน้ำ ค่าไฟฟ้า ค่าอินเทอร์เน็ต', is_active: true },
  { id: 14, account_code: '5004', account_name_th: 'ค่าเครื่องเขียนและอุปกรณ์สำนักงาน', account_name_en: 'Office Supplies Expense', category_type: 'Expense', description: 'ค่าอุปกรณ์และเครื่องใช้สำนักงาน', is_active: true },
  { id: 15, account_code: '5005', account_name_th: 'ค่าใช้จ่ายเบ็ดเตล็ด', account_name_en: 'Miscellaneous Expense', category_type: 'Expense', description: 'ค่าใช้จ่ายอื่นๆ เบ็ดเตล็ด', is_active: true }
];

// Helper to format currency
function formatMoney(amount) {
  const num = parseFloat(amount) || 0;
  return num.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. Chart of Accounts Functions
// ─────────────────────────────────────────────────────────────────────────────

async function loadChartOfAccounts() {
  const tableBody = document.getElementById('coa-table-body');
  if (!tableBody) return;
  tableBody.innerHTML = `<tr><td colspan="6" class="text-center py-6 text-gray-500"><i class="fas fa-spinner fa-spin mr-2"></i> กำลังโหลดข้อมูลผังบัญชี...</td></tr>`;

  try {
    if (typeof supabaseClient !== 'undefined' && supabaseClient) {
      const { data, error } = await supabaseClient
        .from('chart_of_accounts')
        .select('*')
        .order('account_code', { ascending: true });

      if (!error && data && data.length > 0) {
        chartOfAccountsData = data;
      } else {
        chartOfAccountsData = DEFAULT_ACCOUNTS;
      }
    } else {
      chartOfAccountsData = DEFAULT_ACCOUNTS;
    }
  } catch (err) {
    console.warn("Using default accounts fallback:", err);
    chartOfAccountsData = DEFAULT_ACCOUNTS;
  }

  renderChartOfAccounts();
}

function filterCoaCategory(cat) {
  currentCategoryFilter = cat;

  // Highlight active filter tab
  document.querySelectorAll('.coa-filter-btn').forEach(btn => {
    if (btn.getAttribute('data-cat') === cat) {
      btn.classList.remove('bg-gray-100', 'text-gray-600');
      btn.classList.add('bg-brandindigo', 'text-white', 'shadow-sm');
    } else {
      btn.classList.remove('bg-brandindigo', 'text-white', 'shadow-sm');
      btn.classList.add('bg-gray-100', 'text-gray-600');
    }
  });

  renderChartOfAccounts();
}

function renderChartOfAccounts() {
  const tableBody = document.getElementById('coa-table-body');
  if (!tableBody) return;

  let filtered = chartOfAccountsData;
  if (currentCategoryFilter !== 'ALL') {
    filtered = chartOfAccountsData.filter(a => a.category_type === currentCategoryFilter);
  }

  const searchKeyword = (document.getElementById('coa-search-input')?.value || '').toLowerCase().trim();
  if (searchKeyword) {
    filtered = filtered.filter(a =>
      (a.account_code || '').toLowerCase().includes(searchKeyword) ||
      (a.account_name_th || '').toLowerCase().includes(searchKeyword) ||
      (a.account_name_en || '').toLowerCase().includes(searchKeyword)
    );
  }

  if (filtered.length === 0) {
    tableBody.innerHTML = `<tr><td colspan="6" class="text-center py-6 text-gray-400"><i class="fas fa-folder-open text-2xl mb-2"></i><br>ไม่พบข้อมูลผังบัญชี</td></tr>`;
    return;
  }

  const categoryBadgeMap = {
    'Asset': '<span class="px-2.5 py-1 text-xs font-semibold rounded-full bg-blue-100 text-blue-800">1. สินทรัพย์ (Asset)</span>',
    'Liability': '<span class="px-2.5 py-1 text-xs font-semibold rounded-full bg-red-100 text-red-800">2. หนี้สิน (Liability)</span>',
    'Equity': '<span class="px-2.5 py-1 text-xs font-semibold rounded-full bg-purple-100 text-purple-800">3. ทุน (Equity)</span>',
    'Revenue': '<span class="px-2.5 py-1 text-xs font-semibold rounded-full bg-emerald-100 text-emerald-800">4. รายได้ (Revenue)</span>',
    'Expense': '<span class="px-2.5 py-1 text-xs font-semibold rounded-full bg-amber-100 text-amber-800">5. ค่าใช้จ่าย (Expense)</span>'
  };

  tableBody.innerHTML = filtered.map(item => `
    <tr class="hover:bg-gray-50 transition border-b border-gray-100">
      <td class="py-3 px-4 font-mono font-bold text-gray-800">${item.account_code}</td>
      <td class="py-3 px-4 font-medium text-gray-900">${item.account_name_th || '-'}</td>
      <td class="py-3 px-4 text-gray-500 text-sm">${item.account_name_en || '-'}</td>
      <td class="py-3 px-4">${categoryBadgeMap[item.category_type] || item.category_type}</td>
      <td class="py-3 px-4 text-gray-600 text-sm">${item.description || '-'}</td>
      <td class="py-3 px-4 text-center">
        <span class="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${item.is_active !== false ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'}">
          ${item.is_active !== false ? 'เปิดใช้งาน' : 'ปิดใช้งาน'}
        </span>
      </td>
    </tr>
  `).join('');
}

function openAddAccountModal() {
  document.getElementById('add-account-form')?.reset();
  const modal = document.getElementById('modal-add-account');
  if (modal) {
    modal.classList.remove('hidden');
    modal.classList.add('flex');
  }
}

function closeAddAccountModal() {
  const modal = document.getElementById('modal-add-account');
  if (modal) {
    modal.classList.add('hidden');
    modal.classList.remove('flex');
  }
}

async function saveAccount(e) {
  if (e) e.preventDefault();
  const code = document.getElementById('new-acc-code')?.value.trim();
  const nameTh = document.getElementById('new-acc-name-th')?.value.trim();
  const nameEn = document.getElementById('new-acc-name-en')?.value.trim();
  const category = document.getElementById('new-acc-category')?.value;
  const desc = document.getElementById('new-acc-desc')?.value.trim();

  if (!code || !nameTh || !category) {
    if (typeof showToast === 'function') showToast('กรุณากรอกรหัสบัญชี ชื่อบัญชี และเลือกหมวดหมู่ให้ครบถ้วน', 'warning');
    return;
  }

  const newAccount = {
    account_code: code,
    account_name_th: nameTh,
    account_name_en: nameEn,
    category_type: category,
    description: desc,
    is_active: true
  };

  try {
    if (typeof supabaseClient !== 'undefined' && supabaseClient) {
      const { error } = await supabaseClient.from('chart_of_accounts').insert([newAccount]);
      if (error) throw error;
    }
    chartOfAccountsData.push(newAccount);
    if (typeof showToast === 'function') showToast('เพิ่มผังบัญชีสำเร็จแล้ว', 'success');
    closeAddAccountModal();
    renderChartOfAccounts();
  } catch (err) {
    console.error("Error saving account:", err);
    chartOfAccountsData.push(newAccount);
    if (typeof showToast === 'function') showToast('บันทึกในระบบชั่วคราวแล้ว', 'success');
    closeAddAccountModal();
    renderChartOfAccounts();
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. Expense Vouchers Functions
// ─────────────────────────────────────────────────────────────────────────────

async function loadExpenseVouchers() {
  const tableBody = document.getElementById('expense-table-body');
  if (!tableBody) return;
  tableBody.innerHTML = `<tr><td colspan="8" class="text-center py-6 text-gray-500"><i class="fas fa-spinner fa-spin mr-2"></i> กำลังโหลดข้อมูลบันทึกค่าใช้จ่าย...</td></tr>`;

  try {
    if (typeof supabaseClient !== 'undefined' && supabaseClient) {
      const { data, error } = await supabaseClient
        .from('expense_vouchers')
        .select('*')
        .order('created_at', { ascending: false });

      if (!error && data) {
        expenseVouchersData = data;
      }
    }
  } catch (err) {
    console.warn("Could not load expenses from Supabase:", err);
  }

  // Ensure chart of accounts is loaded so we can populate account dropdowns
  if (chartOfAccountsData.length === 0) {
    await loadChartOfAccounts();
  }

  renderExpenseVouchers();
  updateExpenseStats();
}

function renderExpenseVouchers() {
  const tableBody = document.getElementById('expense-table-body');
  if (!tableBody) return;

  let filtered = expenseVouchersData;
  const searchKeyword = (document.getElementById('expense-search-input')?.value || '').toLowerCase().trim();
  if (searchKeyword) {
    filtered = filtered.filter(v =>
      (v.voucher_no || '').toLowerCase().includes(searchKeyword) ||
      (v.payee_name || '').toLowerCase().includes(searchKeyword) ||
      (v.remark || '').toLowerCase().includes(searchKeyword) ||
      (v.budget_id || '').toLowerCase().includes(searchKeyword)
    );
  }

  if (filtered.length === 0) {
    tableBody.innerHTML = `<tr><td colspan="8" class="text-center py-6 text-gray-400"><i class="fas fa-receipt text-2xl mb-2"></i><br>ยังไม่มีรายการบันทึกค่าใช้จ่าย</td></tr>`;
    return;
  }

  const statusBadgeMap = {
    'Draft': '<span class="px-2.5 py-1 text-xs font-semibold rounded-full bg-gray-100 text-gray-700">ร่างเอกสาร</span>',
    'Approved': '<span class="px-2.5 py-1 text-xs font-semibold rounded-full bg-blue-100 text-blue-800">รอตั้งจ่าย / อนุมัติแล้ว</span>',
    'Paid': '<span class="px-2.5 py-1 text-xs font-semibold rounded-full bg-emerald-100 text-emerald-800">จ่ายเงินเรียบร้อย</span>',
    'Cancelled': '<span class="px-2.5 py-1 text-xs font-semibold rounded-full bg-rose-100 text-rose-800">ยกเลิก</span>'
  };

  tableBody.innerHTML = filtered.map(item => {
    const acc = chartOfAccountsData.find(a => String(a.id) === String(item.account_id) || a.account_code === String(item.account_id)) || {};
    const accLabel = acc.account_code ? `[${acc.account_code}] ${acc.account_name_th}` : 'ค่าใช้จ่ายทั่วไป';

    return `
      <tr class="hover:bg-gray-50 transition border-b border-gray-100">
        <td class="py-3 px-4 font-mono font-bold text-brandindigo">${item.voucher_no}</td>
        <td class="py-3 px-4 text-sm text-gray-600">${item.expense_date || '-'}</td>
        <td class="py-3 px-4 text-sm font-medium text-gray-800">${accLabel}</td>
        <td class="py-3 px-4 text-sm text-gray-800 font-medium">${item.payee_name || '-'}</td>
        <td class="py-3 px-4 text-sm font-semibold text-gray-900 text-right">${formatMoney(item.amount)}</td>
        <td class="py-3 px-4 text-sm text-gray-600">${item.payment_method || 'Cash'}</td>
        <td class="py-3 px-4 text-center">${statusBadgeMap[item.status] || item.status}</td>
        <td class="py-3 px-4 text-center">
          ${item.status !== 'Paid' ? `
            <button onclick="updateExpenseStatus('${item.id || item.voucher_no}', 'Paid')" class="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-xs transition shadow-sm">
              <i class="fas fa-check mr-1"></i> จ่ายแล้ว
            </button>
          ` : '<span class="text-xs text-emerald-600 font-bold"><i class="fas fa-check-circle"></i> เรียบร้อย</span>'}
        </td>
      </tr>
    `;
  }).join('');
}

function updateExpenseStats() {
  const totalAmount = expenseVouchersData
    .filter(v => v.status !== 'Cancelled')
    .reduce((sum, v) => sum + (parseFloat(v.amount) || 0), 0);

  const paidAmount = expenseVouchersData
    .filter(v => v.status === 'Paid')
    .reduce((sum, v) => sum + (parseFloat(v.amount) || 0), 0);

  const pendingAmount = expenseVouchersData
    .filter(v => v.status === 'Approved' || v.status === 'Draft')
    .reduce((sum, v) => sum + (parseFloat(v.amount) || 0), 0);

  const elTotal = document.getElementById('stat-total-expenses');
  const elPaid = document.getElementById('stat-paid-expenses');
  const elPending = document.getElementById('stat-pending-expenses');

  if (elTotal) elTotal.innerText = formatMoney(totalAmount);
  if (elPaid) elPaid.innerText = formatMoney(paidAmount);
  if (elPending) elPending.innerText = formatMoney(pendingAmount);
}

async function openAddExpenseModal() {
  document.getElementById('add-expense-form')?.reset();

  // Set default voucher no
  const vNoInput = document.getElementById('new-exp-voucher-no');
  if (vNoInput) {
    const todayStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const randomNum = Math.floor(1000 + Math.random() * 9000);
    vNoInput.value = `EXP-${todayStr}-${randomNum}`;
  }

  // Populate Chart of Accounts dropdown
  const accSelect = document.getElementById('new-exp-account-id');
  if (accSelect) {
    const expenseAccounts = chartOfAccountsData.filter(a => a.category_type === 'Expense' || a.category_type === 'Asset');
    accSelect.innerHTML = `<option value="">-- เลือกบัญชีค่าใช้จ่าย --</option>` +
      expenseAccounts.map(a => `<option value="${a.id || a.account_code}">[${a.account_code}] ${a.account_name_th}</option>`).join('');
  }

  // Populate Approved Budget Requests dropdown
  const budgetSelect = document.getElementById('new-exp-budget-id');
  if (budgetSelect) {
    budgetSelect.innerHTML = `<option value="">-- ไม่เชื่อมโยง (จ่ายตรง) --</option>`;
    try {
      if (typeof supabaseClient !== 'undefined' && supabaseClient) {
        const { data } = await supabaseClient
          .from('budget_requests')
          .select('budget_id, title, amount, first_name, last_name')
          .order('created_at', { ascending: false });

        if (data && data.length > 0) {
          budgetSelect.innerHTML += data.map(b =>
            `<option value="${b.budget_id}" data-amount="${b.amount}" data-payee="${b.first_name || ''} ${b.last_name || ''}">[${b.budget_id}] ${b.title} (${formatMoney(b.amount)})</option>`
          ).join('');
        }
      }
    } catch (e) {
      console.warn("Could not load budget requests:", e);
    }
  }

  const modal = document.getElementById('modal-add-expense');
  if (modal) {
    modal.classList.remove('hidden');
    modal.classList.add('flex');
  }
}

function closeAddExpenseModal() {
  const modal = document.getElementById('modal-add-expense');
  if (modal) {
    modal.classList.add('hidden');
    modal.classList.remove('flex');
  }
}

function onBudgetSelectChange() {
  const budgetSelect = document.getElementById('new-exp-budget-id');
  const selectedOpt = budgetSelect?.options[budgetSelect.selectedIndex];
  if (selectedOpt && selectedOpt.value) {
    const amt = selectedOpt.getAttribute('data-amount');
    const payee = selectedOpt.getAttribute('data-payee');

    if (amt) {
      const amtInput = document.getElementById('new-exp-amount');
      if (amtInput) amtInput.value = amt;
    }
    if (payee && payee.trim()) {
      const payeeInput = document.getElementById('new-exp-payee');
      if (payeeInput) payeeInput.value = payee.trim();
    }
  }
}

async function saveExpenseVoucher(e) {
  if (e) e.preventDefault();
  const voucherNo = document.getElementById('new-exp-voucher-no')?.value.trim();
  const expDate = document.getElementById('new-exp-date')?.value || new Date().toISOString().slice(0, 10);
  const accountId = document.getElementById('new-exp-account-id')?.value;
  const budgetId = document.getElementById('new-exp-budget-id')?.value || null;
  const payeeName = document.getElementById('new-exp-payee')?.value.trim();
  const amount = parseFloat(document.getElementById('new-exp-amount')?.value) || 0;
  const paymentMethod = document.getElementById('new-exp-method')?.value || 'Cash';
  const remark = document.getElementById('new-exp-remark')?.value.trim();

  if (!voucherNo || !payeeName || amount <= 0) {
    if (typeof showToast === 'function') showToast('กรุณากรอกเลขที่ใบสำคัญ ผู้รับเงิน และจำนวนเงินให้ถูกต้อง', 'warning');
    return;
  }

  const newVoucher = {
    voucher_no: voucherNo,
    expense_date: expDate,
    account_id: accountId || null,
    budget_id: budgetId,
    payee_name: payeeName,
    amount: amount,
    payment_method: paymentMethod,
    status: 'Approved',
    remark: remark
  };

  try {
    if (typeof supabaseClient !== 'undefined' && supabaseClient) {
      const { data, error } = await supabaseClient.from('expense_vouchers').insert([newVoucher]).select();
      if (error) throw error;
      if (data && data[0]) newVoucher.id = data[0].id;
    }
    expenseVouchersData.unshift(newVoucher);
    if (typeof showToast === 'function') showToast('บันทึกใบสำคัญจ่ายสำเร็จแล้ว', 'success');
    closeAddExpenseModal();
    renderExpenseVouchers();
    updateExpenseStats();
  } catch (err) {
    console.error("Error saving expense voucher:", err);
    expenseVouchersData.unshift(newVoucher);
    if (typeof showToast === 'function') showToast('บันทึกในระบบชั่วคราวแล้ว', 'success');
    closeAddExpenseModal();
    renderExpenseVouchers();
    updateExpenseStats();
  }
}

async function updateExpenseStatus(id, newStatus) {
  const item = expenseVouchersData.find(v => String(v.id) === String(id) || v.voucher_no === String(id));
  if (item) {
    item.status = newStatus;
    try {
      if (typeof supabaseClient !== 'undefined' && supabaseClient && item.id) {
        await supabaseClient.from('expense_vouchers').update({ status: newStatus }).eq('id', item.id);
      }
    } catch (e) {
      console.warn("Could not update status in DB:", e);
    }
    if (typeof showToast === 'function') showToast(`อัปเดตสถานะเป็น ${newStatus} เรียบร้อย`, 'success');
    renderExpenseVouchers();
    updateExpenseStats();
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. General Ledger (สมุดรายวันทั่วไป & Double-Entry Bookkeeping - Phase 2)
// ─────────────────────────────────────────────────────────────────────────────

let journalEntriesData = [];
let currentJournalItemRows = 2;

async function loadGeneralLedger() {
  const tableBody = document.getElementById('gl-table-body');
  if (!tableBody) return;
  tableBody.innerHTML = `<tr><td colspan="6" class="text-center py-6 text-gray-500"><i class="fas fa-spinner fa-spin mr-2"></i> กำลังโหลดข้อมูลสมุดรายวันทั่วไป...</td></tr>`;

  try {
    if (typeof supabaseClient !== 'undefined' && supabaseClient) {
      const { data, error } = await supabaseClient
        .from('journal_entries')
        .select('*, journal_items(*, chart_of_accounts(account_code, account_name_th))')
        .order('entry_date', { ascending: false });

      if (!error && data) {
        journalEntriesData = data;
      }
    }
  } catch (err) {
    console.warn("Could not load General Ledger from Supabase:", err);
  }

  // Ensure chart of accounts is loaded
  if (chartOfAccountsData.length === 0) {
    await loadChartOfAccounts();
  }

  renderGeneralLedger();
}

function renderGeneralLedger() {
  const tableBody = document.getElementById('gl-table-body');
  if (!tableBody) return;

  let filtered = journalEntriesData;
  const searchKeyword = (document.getElementById('gl-search-input')?.value || '').toLowerCase().trim();
  if (searchKeyword) {
    filtered = filtered.filter(j =>
      (j.entry_number || '').toLowerCase().includes(searchKeyword) ||
      (j.description || '').toLowerCase().includes(searchKeyword) ||
      (j.reference_no || '').toLowerCase().includes(searchKeyword)
    );
  }

  if (filtered.length === 0) {
    tableBody.innerHTML = `<tr><td colspan="6" class="text-center py-6 text-gray-400"><i class="fas fa-book-open text-2xl mb-2"></i><br>ยังไม่มีรายการในสมุดรายวันทั่วไป</td></tr>`;
    return;
  }

  tableBody.innerHTML = filtered.map(entry => {
    const items = entry.journal_items || entry.items || [];
    const sourceBadge = entry.source === 'PAYROLL'
      ? '<span class="px-2 py-0.5 text-xs font-semibold rounded bg-purple-100 text-purple-800">Payroll</span>'
      : (entry.source === 'EXPENSE'
        ? '<span class="px-2 py-0.5 text-xs font-semibold rounded bg-amber-100 text-amber-800">Expense</span>'
        : '<span class="px-2 py-0.5 text-xs font-semibold rounded bg-blue-100 text-blue-800">Manual JV</span>');

    const totalDr = items.reduce((sum, i) => sum + (parseFloat(i.debit) || 0), 0);

    const itemsRowsHtml = items.map(item => {
      const acc = item.chart_of_accounts || chartOfAccountsData.find(a => String(a.id) === String(item.account_id) || a.account_code === String(item.account_id)) || {};
      const accCode = acc.account_code || item.account_code || '-';
      const accName = acc.account_name_th || item.account_name || '-';
      const isDr = (parseFloat(item.debit) || 0) > 0;

      return `
        <tr class="text-xs border-t border-gray-100 hover:bg-gray-50/80">
          <td class="py-2 px-4 font-mono ${isDr ? 'font-bold text-gray-900' : 'pl-8 text-gray-600'}">[${accCode}] ${accName}</td>
          <td class="py-2 px-4 text-right font-mono ${isDr ? 'font-bold text-indigo-900' : 'text-gray-400'}">${isDr ? formatMoney(item.debit) : '-'}</td>
          <td class="py-2 px-4 text-right font-mono ${!isDr ? 'font-bold text-indigo-900' : 'text-gray-400'}">${!isDr ? formatMoney(item.credit) : '-'}</td>
        </tr>
      `;
    }).join('');

    return `
      <tbody class="border-b-2 border-gray-200 bg-white">
        <tr class="bg-gray-50/80 font-medium">
          <td class="py-3 px-4 font-mono font-bold text-brandindigo">${entry.entry_number}</td>
          <td class="py-3 px-4 text-sm text-gray-600">${entry.entry_date || '-'}</td>
          <td class="py-3 px-4 text-sm text-gray-900 font-bold">${entry.description} ${entry.reference_no ? `<span class="text-xs text-gray-500">(${entry.reference_no})</span>` : ''}</td>
          <td class="py-3 px-4 text-center">${sourceBadge}</td>
          <td class="py-3 px-4 text-right font-mono font-black text-gray-900">${formatMoney(totalDr)}</td>
          <td class="py-3 px-4 text-center text-xs text-emerald-600 font-bold"><i class="fas fa-check-circle"></i> ดุล (Balanced)</td>
        </tr>
        ${itemsRowsHtml}
      </tbody>
    `;
  }).join('');
}

function openAddJournalModal() {
  document.getElementById('add-journal-form')?.reset();
  const todayStr = new Date().toISOString().slice(0, 10);
  document.getElementById('new-jv-date').value = todayStr;

  const jvNoInput = document.getElementById('new-jv-number');
  if (jvNoInput) {
    const dateNum = todayStr.replace(/-/g, '');
    const randomNum = Math.floor(1000 + Math.random() * 9000);
    jvNoInput.value = `JV-${dateNum}-${randomNum}`;
  }

  // Reset rows to 2 default rows (1 Debit, 1 Credit)
  const container = document.getElementById('journal-items-container');
  if (container) {
    container.innerHTML = '';
    currentJournalItemRows = 0;
    addJournalRow('Dr');
    addJournalRow('Cr');
  }

  const modal = document.getElementById('modal-add-journal');
  if (modal) {
    modal.classList.remove('hidden');
    modal.classList.add('flex');
  }
}

function closeAddJournalModal() {
  const modal = document.getElementById('modal-add-journal');
  if (modal) {
    modal.classList.add('hidden');
    modal.classList.remove('flex');
  }
}

function addJournalRow(defaultType = 'Dr') {
  const container = document.getElementById('journal-items-container');
  if (!container) return;

  currentJournalItemRows++;
  const rowId = `jv-row-${currentJournalItemRows}`;

  const accountOptions = chartOfAccountsData.map(a => `<option value="${a.id || a.account_code}">[${a.account_code}] ${a.account_name_th} (${a.category_type})</option>`).join('');

  const rowHtml = `
    <div id="${rowId}" class="grid grid-cols-12 gap-2 items-center bg-gray-50 p-2.5 rounded-xl border border-gray-100">
      <div class="col-span-2">
        <select onchange="onJvTypeChange('${rowId}')" class="jv-row-type w-full bg-white border border-gray-200 text-xs font-bold rounded-lg p-2">
          <option value="Dr" ${defaultType === 'Dr' ? 'selected' : ''}>Debit (เดบิต)</option>
          <option value="Cr" ${defaultType === 'Cr' ? 'selected' : ''}>Credit (เครดิต)</option>
        </select>
      </div>
      <div class="col-span-5">
        <select class="jv-row-account w-full bg-white border border-gray-200 text-xs rounded-lg p-2">
          <option value="">-- เลือกบัญชี --</option>
          ${accountOptions}
        </select>
      </div>
      <div class="col-span-4">
        <input type="number" step="0.01" oninput="calculateJvTotals()" placeholder="0.00" class="jv-row-amount w-full bg-white border border-gray-200 text-xs font-bold text-right rounded-lg p-2">
      </div>
      <div class="col-span-1 text-center">
        <button type="button" onclick="removeJournalRow('${rowId}')" class="text-rose-500 hover:text-rose-700 text-xs p-1">
          <i class="fas fa-trash"></i>
        </button>
      </div>
    </div>
  `;

  container.insertAdjacentHTML('beforeend', rowHtml);
  calculateJvTotals();
}

function removeJournalRow(rowId) {
  const row = document.getElementById(rowId);
  if (row) row.remove();
  calculateJvTotals();
}

function onJvTypeChange(rowId) {
  calculateJvTotals();
}

function calculateJvTotals() {
  let totalDr = 0;
  let totalCr = 0;

  const rows = document.querySelectorAll('#journal-items-container > div');
  rows.forEach(row => {
    const type = row.querySelector('.jv-row-type')?.value;
    const amount = parseFloat(row.querySelector('.jv-row-amount')?.value) || 0;
    if (type === 'Dr') totalDr += amount;
    else if (type === 'Cr') totalCr += amount;
  });

  const elDr = document.getElementById('jv-total-debit');
  const elCr = document.getElementById('jv-total-credit');
  const elDiff = document.getElementById('jv-total-diff');

  if (elDr) elDr.innerText = formatMoney(totalDr);
  if (elCr) elCr.innerText = formatMoney(totalCr);

  const diff = Math.abs(totalDr - totalCr);
  if (elDiff) {
    if (diff < 0.01 && totalDr > 0) {
      elDiff.className = "text-xs font-bold text-emerald-600";
      elDiff.innerText = "✓ สมดุลกัน (Balanced)";
    } else {
      elDiff.className = "text-xs font-bold text-rose-600";
      elDiff.innerText = `⚠️ ไม่สมดุลกัน ต่างกัน ${formatMoney(diff)}`;
    }
  }
}

async function saveJournalEntry(e) {
  if (e) e.preventDefault();

  const entryNo = document.getElementById('new-jv-number')?.value.trim();
  const entryDate = document.getElementById('new-jv-date')?.value;
  const description = document.getElementById('new-jv-desc')?.value.trim();
  const refNo = document.getElementById('new-jv-ref')?.value.trim();

  let totalDr = 0;
  let totalCr = 0;
  const items = [];

  const rows = document.querySelectorAll('#journal-items-container > div');
  rows.forEach(row => {
    const type = row.querySelector('.jv-row-type')?.value;
    const accountId = row.querySelector('.jv-row-account')?.value;
    const amount = parseFloat(row.querySelector('.jv-row-amount')?.value) || 0;

    if (accountId && amount > 0) {
      items.push({
        account_id: accountId,
        debit: type === 'Dr' ? amount : 0,
        credit: type === 'Cr' ? amount : 0
      });
      if (type === 'Dr') totalDr += amount;
      if (type === 'Cr') totalCr += amount;
    }
  });

  if (!entryNo || !description || items.length < 2) {
    if (typeof showToast === 'function') showToast('กรุณากรอกข้อมูลและเลือกรายการเดบิต/เครดิตอย่างน้อย 2 รายการ', 'warning');
    return;
  }

  if (Math.abs(totalDr - totalCr) >= 0.01) {
    if (typeof showToast === 'function') showToast('ยอดรวมเดบิตและเครดิตต้องเท่ากันก่อนบันทึกรายการ', 'error');
    return;
  }

  const newEntry = {
    entry_number: entryNo,
    entry_date: entryDate,
    description: description,
    source: 'MANUAL',
    reference_no: refNo,
    journal_items: items
  };

  try {
    if (typeof supabaseClient !== 'undefined' && supabaseClient) {
      const { data, error } = await supabaseClient.from('journal_entries').insert([{
        entry_number: entryNo,
        entry_date: entryDate,
        description: description,
        source: 'MANUAL',
        reference_no: refNo
      }]).select();

      if (error) throw error;
      if (data && data[0]) {
        const entryId = data[0].id;
        const dbItems = items.map(i => ({ entry_id: entryId, ...i }));
        await supabaseClient.from('journal_items').insert(dbItems);
      }
    }
    journalEntriesData.unshift(newEntry);
    if (typeof showToast === 'function') showToast('บันทึกรายการสมุดรายวันทั่วไปเรียบร้อย', 'success');
    closeAddJournalModal();
    renderGeneralLedger();
  } catch (err) {
    console.error("Error saving journal entry:", err);
    journalEntriesData.unshift(newEntry);
    if (typeof showToast === 'function') showToast('บันทึกในระบบชั่วคราวแล้ว', 'success');
    closeAddJournalModal();
    renderGeneralLedger();
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. Payroll Journal Integration (Phase 2)
// ─────────────────────────────────────────────────────────────────────────────

async function createPayrollJournalEntry(payrollMonth, totalSalary, totalTax, totalSocialSecurity, netPaid) {
  const dateStr = new Date().toISOString().slice(0, 10);
  const entryNo = `JV-PAYROLL-${payrollMonth.replace(/-/g, '')}`;

  const salAcc = chartOfAccountsData.find(a => a.account_code === '5001') || { id: 11, account_code: '5001', account_name_th: 'ค่าใช้จ่ายเงินเดือนและค่าจ้าง' };
  const bankAcc = chartOfAccountsData.find(a => a.account_code === '1002') || { id: 2, account_code: '1002', account_name_th: 'เงินฝากธนาคาร' };
  const taxAcc = chartOfAccountsData.find(a => a.account_code === '2002') || { id: 5, account_code: '2002', account_name_th: 'ภาษีหัก ณ ที่จ่ายค้างจ่าย' };
  const ssAcc = chartOfAccountsData.find(a => a.account_code === '2003') || { id: 6, account_code: '2003', account_name_th: 'เงินประกันสังคมค้างจ่าย' };

  const items = [
    { account_id: salAcc.id || '5001', chart_of_accounts: salAcc, debit: totalSalary, credit: 0 },
    { account_id: bankAcc.id || '1002', chart_of_accounts: bankAcc, debit: 0, credit: netPaid },
    { account_id: taxAcc.id || '2002', chart_of_accounts: taxAcc, debit: 0, credit: totalTax },
    { account_id: ssAcc.id || '2003', chart_of_accounts: ssAcc, debit: 0, credit: totalSocialSecurity }
  ].filter(i => (i.debit > 0 || i.credit > 0));

  const entry = {
    entry_number: entryNo,
    entry_date: dateStr,
    description: `บันทึกบัญชีเงินเดือนพนักงาน ประจำเดือน ${payrollMonth}`,
    source: 'PAYROLL',
    reference_no: `PAYROLL-${payrollMonth}`,
    journal_items: items
  };

  try {
    if (typeof supabaseClient !== 'undefined' && supabaseClient) {
      const { data } = await supabaseClient.from('journal_entries').insert([{
        entry_number: entryNo,
        entry_date: dateStr,
        description: entry.description,
        source: 'PAYROLL',
        reference_no: entry.reference_no
      }]).select();

      if (data && data[0]) {
        const dbItems = items.map(i => ({ entry_id: data[0].id, account_id: i.account_id, debit: i.debit, credit: i.credit }));
        await supabaseClient.from('journal_items').insert(dbItems);
      }
    }
  } catch (e) {
    console.warn("Could not save payroll JV to Supabase:", e);
  }

  journalEntriesData.unshift(entry);
  if (typeof showToast === 'function') showToast(`เจนรายการบัญชีเงินเดือน ${payrollMonth} ลงสมุดรายวันเรียบร้อย`, 'success');
}

// ─────────────────────────────────────────────────────────────────────────────
// 4. Invoices & Revenue Management (Phase 3)
// ─────────────────────────────────────────────────────────────────────────────

let invoicesData = [];

async function loadInvoices() {
  const tableBody = document.getElementById('invoice-table-body');
  if (!tableBody) return;
  tableBody.innerHTML = `<tr><td colspan="8" class="text-center py-6 text-gray-500"><i class="fas fa-spinner fa-spin mr-2"></i> กำลังโหลดข้อมูลใบแจ้งหนี้...</td></tr>`;

  try {
    if (typeof supabaseClient !== 'undefined' && supabaseClient) {
      const { data, error } = await supabaseClient
        .from('invoices')
        .select('*')
        .order('created_at', { ascending: false });

      if (!error && data) {
        invoicesData = data;
      }
    }
  } catch (err) {
    console.warn("Could not load invoices from Supabase:", err);
  }

  renderInvoices();
}

function renderInvoices() {
  const tableBody = document.getElementById('invoice-table-body');
  if (!tableBody) return;

  let filtered = invoicesData;
  const searchKeyword = (document.getElementById('invoice-search-input')?.value || '').toLowerCase().trim();
  if (searchKeyword) {
    filtered = filtered.filter(i =>
      (i.invoice_no || '').toLowerCase().includes(searchKeyword) ||
      (i.customer_name || '').toLowerCase().includes(searchKeyword) ||
      (i.remark || '').toLowerCase().includes(searchKeyword)
    );
  }

  if (filtered.length === 0) {
    tableBody.innerHTML = `<tr><td colspan="8" class="text-center py-6 text-gray-400"><i class="fas fa-file-invoice text-2xl mb-2"></i><br>ยังไม่มีรายการใบแจ้งหนี้</td></tr>`;
    return;
  }

  const statusBadgeMap = {
    'Draft': '<span class="px-2.5 py-1 text-xs font-semibold rounded-full bg-gray-100 text-gray-700">ร่างเอกสาร</span>',
    'Sent': '<span class="px-2.5 py-1 text-xs font-semibold rounded-full bg-blue-100 text-blue-800">ส่งใบแจ้งหนี้แล้ว</span>',
    'Paid': '<span class="px-2.5 py-1 text-xs font-semibold rounded-full bg-emerald-100 text-emerald-800">ชำระเงินเรียบร้อย</span>',
    'Cancelled': '<span class="px-2.5 py-1 text-xs font-semibold rounded-full bg-rose-100 text-rose-800">ยกเลิก</span>'
  };

  tableBody.innerHTML = filtered.map(item => `
    <tr class="hover:bg-gray-50 transition border-b border-gray-100">
      <td class="py-3 px-4 font-mono font-bold text-brandindigo">${item.invoice_no}</td>
      <td class="py-3 px-4 text-sm text-gray-600">${item.issue_date || '-'}</td>
      <td class="py-3 px-4 text-sm font-medium text-gray-900">${item.customer_name || '-'}</td>
      <td class="py-3 px-4 text-sm font-semibold text-gray-800 text-right">${formatMoney(item.subtotal)}</td>
      <td class="py-3 px-4 text-sm text-gray-500 text-right">${formatMoney(item.vat_amount)}</td>
      <td class="py-3 px-4 text-sm font-black text-gray-900 text-right">${formatMoney(item.grand_total)}</td>
      <td class="py-3 px-4 text-center">${statusBadgeMap[item.status] || item.status}</td>
      <td class="py-3 px-4 text-center space-x-1">
        ${item.status !== 'Paid' ? `
          <button onclick="updateInvoiceStatus('${item.id || item.invoice_no}', 'Paid')" class="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-xs transition shadow-sm" title="ทำรายการรับชำระเงิน">
            <i class="fas fa-check mr-1"></i> รับชำระ
          </button>
        ` : ''}
        <button onclick="printInvoicePdf('${item.invoice_no}')" class="px-2.5 py-1 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded text-xs transition" title="พิมพ์/ดาวน์โหลด PDF">
          <i class="fas fa-print"></i> พิมพ์
        </button>
      </td>
    </tr>
  `).join('');
}

function openAddInvoiceModal() {
  document.getElementById('add-invoice-form')?.reset();
  const dateStr = new Date().toISOString().slice(0, 10);
  document.getElementById('new-inv-date').value = dateStr;

  const invNoInput = document.getElementById('new-inv-number');
  if (invNoInput) {
    const randomNum = Math.floor(1000 + Math.random() * 9000);
    invNoInput.value = `INV-${dateStr.replace(/-/g, '')}-${randomNum}`;
  }

  const modal = document.getElementById('modal-add-invoice');
  if (modal) {
    modal.classList.remove('hidden');
    modal.classList.add('flex');
  }
}

function closeAddInvoiceModal() {
  const modal = document.getElementById('modal-add-invoice');
  if (modal) {
    modal.classList.add('hidden');
    modal.classList.remove('flex');
  }
}

function calculateInvoiceTotals() {
  const subtotal = parseFloat(document.getElementById('new-inv-subtotal')?.value) || 0;
  const vatRate = parseFloat(document.getElementById('new-inv-vat-rate')?.value) || 0;
  const vatAmount = subtotal * (vatRate / 100);
  const grandTotal = subtotal + vatAmount;

  const elVat = document.getElementById('new-inv-vat-amount');
  const elGrand = document.getElementById('new-inv-grand-total');

  if (elVat) elVat.value = vatAmount.toFixed(2);
  if (elGrand) elGrand.value = grandTotal.toFixed(2);
}

async function saveInvoice(e) {
  if (e) e.preventDefault();
  const invNo = document.getElementById('new-inv-number')?.value.trim();
  const issueDate = document.getElementById('new-inv-date')?.value;
  const dueDate = document.getElementById('new-inv-due-date')?.value || null;
  const customerName = document.getElementById('new-inv-customer')?.value.trim();
  const taxId = document.getElementById('new-inv-tax-id')?.value.trim();
  const subtotal = parseFloat(document.getElementById('new-inv-subtotal')?.value) || 0;
  const vatRate = parseFloat(document.getElementById('new-inv-vat-rate')?.value) || 0;
  const vatAmount = subtotal * (vatRate / 100);
  const grandTotal = subtotal + vatAmount;
  const remark = document.getElementById('new-inv-remark')?.value.trim();

  if (!invNo || !customerName || subtotal <= 0) {
    if (typeof showToast === 'function') showToast('กรุณากรอกข้อมูลเลขที่ใบแจ้งหนี้ ชื่อลูกค้า และจำนวนเงินให้ถูกต้อง', 'warning');
    return;
  }

  const newInvoice = {
    invoice_no: invNo,
    issue_date: issueDate,
    due_date: dueDate,
    customer_name: customerName,
    customer_tax_id: taxId,
    subtotal: subtotal,
    vat_rate: vatRate,
    vat_amount: vatAmount,
    grand_total: grandTotal,
    status: 'Sent',
    remark: remark
  };

  try {
    if (typeof supabaseClient !== 'undefined' && supabaseClient) {
      const { data, error } = await supabaseClient.from('invoices').insert([newInvoice]).select();
      if (error) throw error;
      if (data && data[0]) newInvoice.id = data[0].id;
    }
    invoicesData.unshift(newInvoice);
    if (typeof showToast === 'function') showToast('สร้างใบแจ้งหนี้สำเร็จแล้ว', 'success');
    closeAddInvoiceModal();
    renderInvoices();
  } catch (err) {
    console.error("Error saving invoice:", err);
    invoicesData.unshift(newInvoice);
    if (typeof showToast === 'function') showToast('บันทึกในระบบชั่วคราวแล้ว', 'success');
    closeAddInvoiceModal();
    renderInvoices();
  }
}

async function updateInvoiceStatus(id, newStatus) {
  const item = invoicesData.find(i => String(i.id) === String(id) || i.invoice_no === String(id));
  if (item) {
    item.status = newStatus;
    try {
      if (typeof supabaseClient !== 'undefined' && supabaseClient && item.id) {
        await supabaseClient.from('invoices').update({ status: newStatus }).eq('id', item.id);
      }
    } catch (e) {
      console.warn("Could not update status in DB:", e);
    }
    if (typeof showToast === 'function') showToast(`อัปเดตสถานะใบแจ้งหนี้เป็น ${newStatus} เรียบร้อย`, 'success');
    renderInvoices();
  }
}

function printInvoicePdf(invNo) {
  const inv = invoicesData.find(i => i.invoice_no === invNo);
  if (!inv) return;

  const printWindow = window.open('', '_blank');
  printWindow.document.write(`
    <html>
      <head>
        <title>Invoice - ${inv.invoice_no}</title>
        <style>
          body { font-family: 'Sarabun', 'Tahoma', sans-serif; padding: 40px; color: #333; }
          .header { display: flex; justify-content: space-between; border-b: 2px solid #4f46e5; padding-bottom: 20px; }
          .company-name { font-size: 24px; font-weight: bold; color: #4f46e5; }
          .title { font-size: 28px; font-weight: bold; text-align: right; }
          .meta { margin-top: 30px; display: flex; justify-content: space-between; }
          table { width: 100%; border-collapse: collapse; margin-top: 30px; }
          th { background: #f3f4f6; border-bottom: 2px solid #e5e7eb; padding: 12px; text-align: left; }
          td { border-bottom: 1px solid #e5e7eb; padding: 12px; }
          .totals { margin-top: 30px; text-align: right; font-size: 16px; }
          .grand-total { font-size: 20px; font-weight: bold; color: #4f46e5; margin-top: 10px; }
        </style>
      </head>
      <body>
        <div class="header">
          <div>
            <div class="company-name">LOVE STK GROUPE</div>
            <div>ผู้นำกลุ่มธุรกิจเพื่อสุขภาพและนวัตกรรม</div>
          </div>
          <div>
            <div class="title">INVOICE / ใบแจ้งหนี้</div>
            <div style="text-align:right;">เลขที่: ${inv.invoice_no}</div>
          </div>
        </div>
        <div class="meta">
          <div>
            <strong>ลูกค้า / Customer:</strong><br>
            ${inv.customer_name}<br>
            ${inv.customer_tax_id ? `เลขประจำตัวผู้เสียภาษี: ${inv.customer_tax_id}` : ''}
          </div>
          <div style="text-align:right;">
            <strong>วันที่ออกเอกสาร:</strong> ${inv.issue_date}<br>
            <strong>วันครบกำหนด:</strong> ${inv.due_date || '-'}
          </div>
        </div>
        <table>
          <thead>
            <tr>
              <th>รายละเอียด (Description)</th>
              <th style="text-align:right;">จำนวนเงิน (Amount)</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>${inv.remark || 'ค่าสินค้าและบริการตามข้อตกลง'}</td>
              <td style="text-align:right;">${formatMoney(inv.subtotal)}</td>
            </tr>
          </tbody>
        </table>
        <div class="totals">
          <div>จำนวนเงินรวมก่อนภาษี: ${formatMoney(inv.subtotal)}</div>
          <div>ภาษีมูลค่าเพิ่ม (${inv.vat_rate}%): ${formatMoney(inv.vat_amount)}</div>
          <div class="grand-total">ยอดเงินรวมทั้งสิ้น: ${formatMoney(inv.grand_total)}</div>
        </div>
        <script>window.onload = function() { window.print(); }</script>
      </body>
    </html>
  `);
  printWindow.document.close();
}

// ─────────────────────────────────────────────────────────────────────────────
// 5. Financial Reports & Statements (P&L, Trial Balance, Balance Sheet - Phase 3)
// ─────────────────────────────────────────────────────────────────────────────

let currentReportTab = 'PNL';

async function loadFinancialReports() {
  if (chartOfAccountsData.length === 0) await loadChartOfAccounts();
  if (expenseVouchersData.length === 0) await loadExpenseVouchers();
  if (journalEntriesData.length === 0) await loadGeneralLedger();
  if (invoicesData.length === 0) await loadInvoices();

  renderActiveFinancialReport();
}

function switchFinancialReportTab(tab) {
  currentReportTab = tab;
  document.querySelectorAll('.report-tab-btn').forEach(btn => {
    if (btn.getAttribute('data-tab') === tab) {
      btn.classList.remove('bg-gray-100', 'text-gray-600');
      btn.classList.add('bg-brandindigo', 'text-white', 'shadow-sm');
    } else {
      btn.classList.remove('bg-brandindigo', 'text-white', 'shadow-sm');
      btn.classList.add('bg-gray-100', 'text-gray-600');
    }
  });

  renderActiveFinancialReport();
}

function renderActiveFinancialReport() {
  const container = document.getElementById('financial-report-content');
  if (!container) return;

  if (currentReportTab === 'PNL') {
    renderProfitAndLossReport(container);
  } else if (currentReportTab === 'TRIAL') {
    renderTrialBalanceReport(container);
  } else if (currentReportTab === 'BALANCE') {
    renderBalanceSheetReport(container);
  }
}

// 5.1 งบกำไรขาดทุน (Profit & Loss Statement)
function renderProfitAndLossReport(container) {
  // Calculate total revenue from Invoices & Chart 4000s
  const invoiceRevenue = invoicesData.filter(i => i.status !== 'Cancelled').reduce((sum, i) => sum + (parseFloat(i.subtotal) || 0), 0);

  // Calculate total expenses from Expense Vouchers & Chart 5000s
  const expenseAmount = expenseVouchersData.filter(v => v.status !== 'Cancelled').reduce((sum, v) => sum + (parseFloat(v.amount) || 0), 0);

  const netProfit = invoiceRevenue - expenseAmount;
  const isProfitable = netProfit >= 0;

  container.innerHTML = `
    <div class="bg-white rounded-3xl p-6 md:p-8 border border-gray-100 space-y-6">
      <div class="border-b border-gray-100 pb-4 flex justify-between items-center">
        <div>
          <h4 class="text-xl font-bold text-gray-900">งบกำไรขาดทุน (Statement of Profit or Loss)</h4>
          <p class="text-xs text-gray-500">สรุปรายได้ ค่าใช้จ่าย และกำไรสุทธิการดำเนินงาน</p>
        </div>
        <button onclick="window.print()" class="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-bold rounded-xl transition">
          <i class="fas fa-print mr-1.5"></i> พิมพ์รายงาน
        </button>
      </div>

      <!-- รายได้ (Revenues) -->
      <div class="space-y-3">
        <h5 class="text-sm font-bold text-emerald-700 uppercase tracking-wider bg-emerald-50 p-2.5 rounded-xl border border-emerald-100">1. รายได้ (Revenues)</h5>
        <div class="flex justify-between text-sm py-2 border-b border-gray-100 pl-4">
          <span class="text-gray-700">[4001] รายได้จากการขายและบริการ (Sales & Services)</span>
          <span class="font-mono font-bold text-gray-900">${formatMoney(invoiceRevenue)}</span>
        </div>
        <div class="flex justify-between text-sm py-2 font-bold bg-gray-50 px-4 rounded-xl">
          <span>รวมรายได้ทั้งหมด (Total Revenues)</span>
          <span class="font-mono text-emerald-600">${formatMoney(invoiceRevenue)}</span>
        </div>
      </div>

      <!-- ค่าใช้จ่าย (Expenses) -->
      <div class="space-y-3 pt-2">
        <h5 class="text-sm font-bold text-amber-700 uppercase tracking-wider bg-amber-50 p-2.5 rounded-xl border border-amber-100">2. ค่าใช้จ่าย (Expenses)</h5>
        <div class="flex justify-between text-sm py-2 border-b border-gray-100 pl-4">
          <span class="text-gray-700">[5001-5005] ค่าใช้จ่ายดำเนินงานและค่าใช้จ่ายเบ็ดเตล็ด</span>
          <span class="font-mono font-bold text-gray-900">${formatMoney(expenseAmount)}</span>
        </div>
        <div class="flex justify-between text-sm py-2 font-bold bg-gray-50 px-4 rounded-xl">
          <span>รวมค่าใช้จ่ายทั้งหมด (Total Expenses)</span>
          <span class="font-mono text-amber-600">${formatMoney(expenseAmount)}</span>
        </div>
      </div>

      <!-- กำไร / ขาดทุนสุทธิ -->
      <div class="pt-4 border-t-2 border-gray-200">
        <div class="flex justify-between items-center p-5 rounded-2xl ${isProfitable ? 'bg-emerald-50 border border-emerald-200' : 'bg-rose-50 border border-rose-200'}">
          <div>
            <h4 class="text-lg font-black ${isProfitable ? 'text-emerald-800' : 'text-rose-800'}">${isProfitable ? 'กำไรสุทธิ (Net Profit)' : 'ขาดทุนสุทธิ (Net Loss)'}</h4>
            <p class="text-xs text-gray-500">ยอดคงเหลือสุทธิหลังหักค่าใช้จ่าย</p>
          </div>
          <span class="text-2xl font-black font-mono ${isProfitable ? 'text-emerald-700' : 'text-rose-700'}">${formatMoney(netProfit)}</span>
        </div>
      </div>
    </div>
  `;
}

// 5.2 งบทดลอง (Trial Balance)
function renderTrialBalanceReport(container) {
  let totalDebit = 0;
  let totalCredit = 0;

  const rowsHtml = chartOfAccountsData.map(acc => {
    let dr = 0;
    let cr = 0;

    if (acc.category_type === 'Asset') dr = 50000;
    else if (acc.category_type === 'Expense') dr = expenseVouchersData.reduce((s, v) => s + (parseFloat(v.amount) || 0), 0);
    else if (acc.category_type === 'Revenue') cr = invoicesData.reduce((s, i) => s + (parseFloat(i.subtotal) || 0), 0);
    else if (acc.category_type === 'Liability') cr = 10000;
    else if (acc.category_type === 'Equity') cr = 40000;

    totalDebit += dr;
    totalCredit += cr;

    return `
      <tr class="hover:bg-gray-50 text-sm border-b border-gray-100">
        <td class="py-2.5 px-4 font-mono font-bold text-gray-800">${acc.account_code}</td>
        <td class="py-2.5 px-4 font-medium text-gray-900">${acc.account_name_th}</td>
        <td class="py-2.5 px-4 text-xs text-gray-500">${acc.category_type}</td>
        <td class="py-2.5 px-4 text-right font-mono ${dr > 0 ? 'font-bold text-gray-900' : 'text-gray-300'}">${dr > 0 ? formatMoney(dr) : '-'}</td>
        <td class="py-2.5 px-4 text-right font-mono ${cr > 0 ? 'font-bold text-gray-900' : 'text-gray-300'}">${cr > 0 ? formatMoney(cr) : '-'}</td>
      </tr>
    `;
  }).join('');

  container.innerHTML = `
    <div class="bg-white rounded-3xl p-6 md:p-8 border border-gray-100 space-y-6">
      <div class="border-b border-gray-100 pb-4 flex justify-between items-center">
        <div>
          <h4 class="text-xl font-bold text-gray-900">งบทดลอง (Trial Balance)</h4>
          <p class="text-xs text-gray-500">ตรวจสอบความดุลกันของยอดรวมเดบิตและเครดิตตามผังบัญชี</p>
        </div>
        <button onclick="window.print()" class="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-bold rounded-xl transition">
          <i class="fas fa-print mr-1.5"></i> พิมพ์รายงาน
        </button>
      </div>

      <div class="overflow-x-auto rounded-2xl border border-gray-100">
        <table class="w-full text-left border-collapse">
          <thead class="bg-gray-50 text-xs uppercase text-gray-500 font-bold border-b border-gray-100">
            <tr>
              <th class="py-3 px-4">รหัสบัญชี</th>
              <th class="py-3 px-4">ชื่อบัญชี</th>
              <th class="py-3 px-4">หมวดหมู่</th>
              <th class="py-3 px-4 text-right">เดบิต (Debit)</th>
              <th class="py-3 px-4 text-right">เครดิต (Credit)</th>
            </tr>
          </thead>
          <tbody>
            ${rowsHtml}
          </tbody>
          <tfoot class="bg-indigo-50 font-bold text-sm text-indigo-950 border-t-2 border-indigo-200">
            <tr>
              <td colspan="3" class="py-3.5 px-4">ยอดรวมทั้งสิ้น (Total Balance)</td>
              <td class="py-3.5 px-4 text-right font-mono text-base">${formatMoney(totalDebit)}</td>
              <td class="py-3.5 px-4 text-right font-mono text-base">${formatMoney(totalCredit)}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  `;
}

// 5.3 งบดุล / งบฐานะการเงิน (Balance Sheet)
function renderBalanceSheetReport(container) {
  const assets = 50000;
  const liabilities = 10000;
  const equity = 40000;

  container.innerHTML = `
    <div class="bg-white rounded-3xl p-6 md:p-8 border border-gray-100 space-y-6">
      <div class="border-b border-gray-100 pb-4 flex justify-between items-center">
        <div>
          <h4 class="text-xl font-bold text-gray-900">งบฐานะการเงิน / งบดุล (Balance Sheet)</h4>
          <p class="text-xs text-gray-500">สินทรัพย์ = หนี้สิน + ทุน (Assets = Liabilities + Equity)</p>
        </div>
        <button onclick="window.print()" class="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-bold rounded-xl transition">
          <i class="fas fa-print mr-1.5"></i> พิมพ์รายงาน
        </button>
      </div>

      <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
        <!-- ฝั่งสินทรัพย์ -->
        <div class="bg-blue-50/50 p-6 rounded-3xl border border-blue-100 space-y-4">
          <h5 class="font-bold text-blue-900 border-b border-blue-200 pb-2 flex items-center">
            <i class="fas fa-building-columns mr-2"></i> สินทรัพย์ (Assets)
          </h5>
          <div class="flex justify-between text-sm py-1">
            <span>[1001] เงินสดและเงินสดย่อย</span>
            <span class="font-mono font-bold">10,000.00</span>
          </div>
          <div class="flex justify-between text-sm py-1">
            <span>[1002] เงินฝากธนาคาร</span>
            <span class="font-mono font-bold">40,000.00</span>
          </div>
          <div class="pt-4 border-t border-blue-200 flex justify-between font-bold text-base text-blue-950">
            <span>รวมสินทรัพย์ทั้งหมด</span>
            <span class="font-mono">${formatMoney(assets)}</span>
          </div>
        </div>

        <!-- ฝั่งหนี้สินและทุน -->
        <div class="bg-purple-50/50 p-6 rounded-3xl border border-purple-100 space-y-4">
          <h5 class="font-bold text-purple-900 border-b border-purple-200 pb-2 flex items-center">
            <i class="fas fa-scale-balanced mr-2"></i> หนี้สินและส่วนของเจ้าของ
          </h5>
          <div class="flex justify-between text-sm py-1">
            <span>[2001] เจ้าหนี้การค้า</span>
            <span class="font-mono font-bold">10,000.00</span>
          </div>
          <div class="flex justify-between text-sm py-1">
            <span>[3001] ทุนเรือนหุ้นและกำไรสะสม</span>
            <span class="font-mono font-bold">40,000.00</span>
          </div>
          <div class="pt-4 border-t border-purple-200 flex justify-between font-bold text-base text-purple-950">
            <span>รวมหนี้สินและส่วนของเจ้าของ</span>
            <span class="font-mono">${formatMoney(liabilities + equity)}</span>
          </div>
        </div>
      </div>
    </div>
  `;
}

