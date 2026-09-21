/**
 * report.js — Analytics & Reporting Engine for Clinic Management System
 * Handles data fetching from Supabase, date filtering, KPI calculations,
 * Chart.js visualizations, CSV export, and print preparation.
 * Supports Tabs: Overview (ພາບລວມ), Nutrients (ສັ່ງອາຫານເສີມ), Patients (ຜູ້ປ່ວຍ).
 */

// Global State
const state = {
  activeTab: 'nutrients', // 'nutrients' | 'patients'
  datePreset: 'today',
  startDate: '',
  endDate: '',
  isLoading: false,
  bills: [],
  expenses: [],
  visits: [],
  patients: [],
  commissions: [],
  nutrientOrders: [],
  clinicSettings: {},
  charts: {
    trend: null,
    payment: null
  }
};

// Supabase Clients Initialization
const cfg = (typeof CONFIG !== 'undefined') ? CONFIG : {
  SUPABASE_URL: window.SUPABASE_URL || '',
  SUPABASE_ANON_KEY: window.SUPABASE_ANON_KEY || '',
  MLM_SUPABASE_URL: window.MLM_SUPABASE_URL || '',
  MLM_SUPABASE_ANON_KEY: window.MLM_SUPABASE_ANON_KEY || ''
};

const sbClient = (typeof supabase !== 'undefined' && cfg.SUPABASE_URL) 
  ? supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY) 
  : null;

const mlmClient = (typeof supabase !== 'undefined' && cfg.MLM_SUPABASE_URL && cfg.MLM_SUPABASE_ANON_KEY)
  ? supabase.createClient(cfg.MLM_SUPABASE_URL, cfg.MLM_SUPABASE_ANON_KEY)
  : sbClient;

// Helper: Format Money in LAK
function formatMoney(amount) {
  const n = Number(amount) || 0;
  return n.toLocaleString('en-US', { maximumFractionDigits: 0 }) + ' ₭';
}

function formatNumber(amount) {
  const n = Number(amount) || 0;
  return n.toLocaleString('en-US', { maximumFractionDigits: 0 });
}

// Helper: Format Date (YYYY-MM-DD to DD/MM/YYYY)
function formatDateLao(isoStr) {
  if (!isoStr) return '-';
  try {
    const d = new Date(isoStr);
    if (isNaN(d.getTime())) return isoStr;
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    const hours = String(d.getHours()).padStart(2, '0');
    const mins = String(d.getMinutes()).padStart(2, '0');
    return `${day}/${month}/${year} ${hours}:${mins}`;
  } catch (e) {
    return isoStr;
  }
}

function formatDateOnly(d) {
  let year = d.getFullYear();
  if (year > 2400) year -= 543;
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// Convert any timestamp or raw date string to YYYY-MM-DD in local time (UTC+7)
function toLocalDateStr(rawDate) {
  if (!rawDate) return '';
  if (rawDate instanceof Date) {
    const tz = rawDate.getTimezoneOffset() * 60000;
    return (new Date(rawDate.getTime() - tz)).toISOString().split('T')[0];
  }
  const s = String(rawDate).trim();
  if (!s) return '';
  if (s.includes('T') || s.endsWith('Z')) {
    const dt = new Date(s);
    if (!isNaN(dt.getTime())) {
      const tz = dt.getTimezoneOffset() * 60000;
      return (new Date(dt.getTime() - tz)).toISOString().split('T')[0];
    }
    return s.substring(0, 10);
  }
  const mSlash = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/);
  if (mSlash) {
    let y = parseInt(mSlash[3], 10);
    if (y > 2400) y -= 543;
    return `${y}-${mSlash[2].padStart(2, '0')}-${mSlash[1].padStart(2, '0')}`;
  }
  return s.substring(0, 10);
}

// Helper: Loader overlay
function toggleLoader(show) {
  const loader = document.getElementById('loader');
  if (loader) {
    loader.classList.toggle('on', !!show);
  }
}

// Initialize on DOM Loaded
document.addEventListener('DOMContentLoaded', async () => {
  // If inside iframe or standalone, setup back button visibility
  const btnBack = document.getElementById('btnBackDirect');
  if (btnBack) {
    btnBack.style.display = (window.self === window.top) ? 'inline-flex' : 'none';
  }

  // Set default dates to Today (ວັນປັດຈຸບັນ)
  setDatePreset('today');

  // Parallel startup: Load settings and data concurrently
  await Promise.all([
    loadClinicSettings(),
    loadReportData()
  ]);
});

// Switch Active Tab (ສັ່ງອາຫານເສີມ, ຜູ້ປ່ວຍ)
function switchReportTab(tabName) {
  state.activeTab = tabName;

  // Update tab buttons
  document.querySelectorAll('.r-nav-tab').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.tab === tabName);
  });

  // Update tab content displays
  const tabs = {
    nutrients: document.getElementById('tabNutrients'),
    patients: document.getElementById('tabPatients')
  };

  Object.keys(tabs).forEach(k => {
    if (tabs[k]) {
      tabs[k].classList.toggle('active', k === tabName);
    }
  });

  // Update header text based on tab
  const titleEl = document.getElementById('headerPageTitle');
  if (titleEl) {
    if (tabName === 'nutrients') titleEl.textContent = 'ລາຍງານການສັ່ງອາຫານເສີມ & ຈ່າຍຢາ';
    else if (tabName === 'patients') titleEl.textContent = 'ລາຍງານຂໍ້ມູນຄົນເຈັບ & ການກວດ';
  }
}

// Set Date Preset Range
function setDatePreset(preset) {
  state.datePreset = preset;

  // Update active pill button
  document.querySelectorAll('.date-preset-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.preset === preset);
  });

  const now = new Date();
  const utc = now.getTime() + (now.getTimezoneOffset() * 60000);
  const today = new Date(utc + (7 * 3600000));
  let start = new Date(today);
  let end = new Date(today);

  if (preset === 'today') {
    start = new Date(today);
    end = new Date(today);
  } else if (preset === 'week') {
    const day = today.getDay();
    const diff = today.getDate() - day + (day === 0 ? -6 : 1);
    start = new Date(today.getFullYear(), today.getMonth(), diff);
    end = new Date(today);
  } else if (preset === 'month') {
    start = new Date(today.getFullYear(), today.getMonth(), 1);
    end = new Date(today.getFullYear(), today.getMonth() + 1, 0);
  } else if (preset === 'year') {
    start = new Date(today.getFullYear(), 0, 1);
    end = new Date(today.getFullYear(), 11, 31);
  } else if (preset === 'all') {
    start = new Date('2024-01-01');
    end = new Date(today);
  }

  const sStr = formatDateOnly(start);
  const eStr = formatDateOnly(end);

  state.startDate = sStr;
  state.endDate = eStr;

  const inStart = document.getElementById('startDate');
  const inEnd = document.getElementById('endDate');
  if (inStart) inStart.value = sStr;
  if (inEnd) inEnd.value = eStr;
}

// Handler for custom date changes
function onCustomDateChange() {
  const inStart = document.getElementById('startDate');
  const inEnd = document.getElementById('endDate');
  if (inStart && inEnd && inStart.value && inEnd.value) {
    state.startDate = inStart.value;
    state.endDate = inEnd.value;
    state.datePreset = 'custom';
    document.querySelectorAll('.date-preset-btn').forEach(btn => btn.classList.remove('active'));
    loadReportData();
  }
}

// Helper: Timeout wrapper to avoid slow external network hanging page load
function withTimeout(promise, ms = 2500, fallbackVal = null) {
  return Promise.race([
    promise,
    new Promise(resolve => setTimeout(() => resolve(fallbackVal), ms))
  ]);
}

// Load Clinic Branding / Settings (Instant from Cache + Async Sync)
async function loadClinicSettings() {
  try {
    const cached = JSON.parse(localStorage.getItem('clinic_settings_cache') || '{}');
    if (cached && Object.keys(cached).length > 0) {
      state.clinicSettings = { ...cached };
      applyClinicBranding();
    }
  } catch (e) {}

  if (!sbClient) return;
  try {
    const { data, error } = await withTimeout(
      sbClient.from('clinic_settings').select('*'),
      2000,
      { data: null }
    );
    if (!error && data && Array.isArray(data)) {
      data.forEach(item => {
        state.clinicSettings[item.key] = item.value;
      });
      try {
        localStorage.setItem('clinic_settings_cache', JSON.stringify(state.clinicSettings));
      } catch (e) {}
      applyClinicBranding();
    }
  } catch (err) {
    console.warn('Error loading settings:', err);
  }
}

function applyClinicBranding() {
  const s = state.clinicSettings;
  const clinicName = s.clinic_name_la || 'ຄລີນິກປິ່ນປົວ & ວິເຄາະພະຍາດ';
  const clinicAddress = [s.clinic_address, s.clinic_district, s.clinic_province].filter(Boolean).join(', ') || '';
  const clinicPhone = s.clinic_phone ? `ໂທ: ${s.clinic_phone}` : '';
  const clinicLogo = s.clinic_logo_url || '';

  const brandTitleEl = document.getElementById('reportClinicName');
  if (brandTitleEl) brandTitleEl.textContent = clinicName;

  const prName = document.getElementById('printClinicName');
  if (prName) prName.textContent = clinicName;

  const prSub = document.getElementById('printClinicInfo');
  if (prSub) prSub.textContent = [clinicAddress, clinicPhone].filter(Boolean).join(' | ');

  const prLogo = document.getElementById('printClinicLogo');
  if (prLogo) {
    if (clinicLogo) {
      prLogo.src = clinicLogo;
      prLogo.style.display = 'inline-block';
    } else {
      prLogo.style.display = 'none';
    }
  }
}

// Fetch all reporting datasets for selected date window (Ultra-optimized)
async function loadReportData() {
  if (!sbClient) {
    alert('Supabase client is not configured. Please check config.js.');
    return;
  }

  // Prevent duplicate simultaneous fetches
  if (state.isLoading) return;
  state.isLoading = true;
  toggleLoader(true);

  // Compute timezone-safe query boundaries (UTC+7 for Laos/Thailand)
  const startUtcISO = state.startDate ? new Date(state.startDate + 'T00:00:00+07:00').toISOString() : '';
  const endUtcISO = state.endDate ? new Date(state.endDate + 'T23:59:59.999+07:00').toISOString() : '';

  // Query boundaries covering both UTC stored timestamps and local string timestamps
  const queryStartISO = startUtcISO || `${state.startDate}T00:00:00`;
  const queryEndISO = `${state.endDate}T23:59:59.999Z`;

  const periodLabel = document.getElementById('reportPeriodText');
  if (periodLabel) {
    periodLabel.textContent = `${state.startDate} ຫາ ${state.endDate}`;
  }
  const printPeriodLabel = document.getElementById('printPeriodText');
  if (printPeriodLabel) {
    printPeriodLabel.textContent = `ຊ່ວງເວລາ: ${state.startDate} ຫາ ${state.endDate}`;
  }

  try {
    // 🚀 Parallel Fetch:
    // 1. Visits for selected date range (only required columns)
    // 2. Bills for selected date range (only for doctor resolution fallback)
    // 3. Raw Nutrient Orders (filtered by date range at DB level)
    // 4. Staff users with doctor role
    const [resVisits, resBills, rawNutrientOrders, resDoctors] = await Promise.all([
      sbClient.from('visits')
        .select('visit_id, hn, patient_name, doctor_name, status, symptom, meds, created_at')
        .gte('created_at', queryStartISO)
        .lte('created_at', queryEndISO)
        .order('created_at', { ascending: false }),

      sbClient.from('bills')
        .select('visit_id, created_by, created_at')
        .gte('created_at', queryStartISO)
        .lte('created_at', queryEndISO),

      fetchRawNutrientOrders(queryStartISO, queryEndISO),

      sbClient.from('staff_users')
        .select('full_name, emp_code, email, role')
        .in('role', ['doctor', 'แพทย์', 'ທ່ານໝໍ'])
    ]);

    // Save clinic doctors list
    let clinicDoctors = (resDoctors && Array.isArray(resDoctors.data)) ? resDoctors.data : [];
    if (clinicDoctors.length === 0 && window.parent && Array.isArray(window.parent._cachedDoctorsList)) {
      clinicDoctors = window.parent._cachedDoctorsList;
    }
    state.clinicDoctors = clinicDoctors;

    // Filter visits by exact local date (UTC+7)
    const rawVisits = resVisits.data || [];
    state.visits = rawVisits.filter(v => {
      const d = toLocalDateStr(v.created_at);
      return !d || (d >= state.startDate && d <= state.endDate);
    });
    state.bills = resBills.data || [];

    // 🚀 Process Nutrient Orders with visits data
    processNutrientOrders(rawNutrientOrders, state.visits);

    // 🚀 Optimize Patients query with In-Memory Cache:
    // Include all patient HNs from both visits and nutrient orders!
    const allHns = new Set();
    state.visits.forEach(v => { if (v.hn && v.hn !== '-') allHns.add(v.hn); });
    (state.nutrientOrders || []).forEach(o => { if (o.hn && o.hn !== '-') allHns.add(o.hn); });

    const visitHns = Array.from(allHns);
    if (visitHns.length > 0) {
      state.patientCache = state.patientCache || {};
      const missingHns = visitHns.filter(hn => !state.patientCache[hn]);
      if (missingHns.length > 0) {
        const { data: patData } = await sbClient
          .from('patients')
          .select('*')
          .in('hn', missingHns);
        (patData || []).forEach(p => {
          if (p.hn) state.patientCache[p.hn] = p;
        });
      }
      state.patients = visitHns.map(hn => state.patientCache[hn]).filter(Boolean);
    } else {
      state.patients = [];
    }

    // Render Tab 1: Nutrients & Prescriptions
    renderNutrientsTab();

    // Render Tab 2: Patients & Visits
    renderPatientsTab();

    // Ensure active tab header and view are synced
    switchReportTab(state.activeTab || 'nutrients');

  } catch (err) {
    console.error('Failed to load report data:', err);
    if (typeof Swal !== 'undefined') {
      Swal.fire({
        icon: 'error',
        title: 'ເກີດຂໍ້ຜິດພາດໃນການໂຫຼດຂໍ້ມູນ',
        text: err.message || 'ກະລຸນາກວດສອບການເຊື່ອມຕໍ່ອິນເຕີເນັດ'
      });
    }
  } finally {
    state.isLoading = false;
    toggleLoader(false);
  }
}

// Product Price Catalog for Nutrients / Medicines
const PRODUCT_PRICE_MAP = {
  'SESAMIN': 1800,
  'SESAMEEN': 1800,
  'SESAMEEN ACTIVE': 1800,
  'APPLE': 1800,
  'KING_GOLD': 1800,
  'PINE_NEEDLE': 1800,
  'PINE_NEEDLE_OIL': 1800,
  'COCO_BOOM': 1800,
  'CORDESTAR_PLUS': 1800,
  'ORYZA': 1800,
  'COLLAGEN': 1800,
  'Coffee_Arabica': 390,
  'STK COFFEE': 590,
  'LOVE DA': 1800,
  'BALANCE': 890,
  'KUT-SO': 890,
  'ZINC': 890,
  'LUTEIN': 890,
  'L-GLUTA': 890,
  'LIPO C': 890,
  'DARK SPOT SERUM': 590,
  'ACNE SERUM': 590,
  'MILK SUNCREAM': 590,
  'TONER': 250
};

function getProductPrice(rawName, existingPrice) {
  const nameStr = (rawName || '');
  if (/(แถมฟรี|แถม|ແຖມຟຣີ|ແຖມ|free|gift)/i.test(nameStr)) {
    return 0;
  }
  if (existingPrice !== undefined && existingPrice !== null && existingPrice !== '') {
    const num = Number(existingPrice);
    if (!isNaN(num) && num >= 0) {
      return num;
    }
  }
  const clean = nameStr.toUpperCase();
  for (const [k, p] of Object.entries(PRODUCT_PRICE_MAP)) {
    if (clean.includes(k)) return p;
  }
  return 0;
}

// Parse Product Name and Pricing Tier (normal, pro, member, free)
function parseProductTierAndName(rawName, explicitTier, unitPrice) {
  let name = (rawName || '').trim();
  const price = Number(unitPrice) || 0;
  let tier = '';

  const freePattern = /(แถมฟรี|แถม|ແຖມຟຣີ|ແຖມ|free|gift)/i;
  const proPattern = /(โปรโมชั่น|โปรโมชัน|โปร|โม่|โปรา|ໂປຣ|ໂປຣໂມຊັ່ນ|pro|promo)/i;
  const memberPattern = /(ส่ง\/สมาชิก|ສົ່ງ\/ສະມາຊິກ|ส่ง\s*\/\s*สมาชิก|ສົ່ງ\s*\/\s*ສະມາຊິກ|ซื้อส่ง|ຊື້ສົ່ງ|ขายส่ง|ຂາຍສົ່ງ|ส่ง|ສົ່ງ|สมาชิก|ສະມາຊິກ|member|wholesale)/i;
  const normalPattern = /(ปกติ|ปรกติ|ປົກກະຕິ|ราคาปกติ|ราคาซื้อ|normal|regular)/i;

  // Rule 1: Price 0 or explicit free keyword -> always Free Gift
  if (price === 0 || freePattern.test(name)) {
    tier = 'free';
  } else if (explicitTier) {
    const exp = String(explicitTier).toLowerCase();
    if (freePattern.test(exp) || exp === 'free') tier = 'free';
    else if (proPattern.test(exp) || exp === 'pro') tier = 'pro';
    else if (memberPattern.test(exp) || exp === 'member') tier = 'member';
    else if (normalPattern.test(exp) || exp === 'normal') tier = 'normal';
  }

  // Rule 2: Infer tier from product name tags
  if (!tier) {
    if (proPattern.test(name)) {
      tier = 'pro';
    } else if (memberPattern.test(name)) {
      tier = 'member';
    } else if (normalPattern.test(name)) {
      tier = 'normal';
    } else {
      tier = 'normal';
    }
  }

  // Strip tier tags in parentheses or brackets (e.g. "(ສົ່ງ/ສະມາຊິກ)", "(ສົ່ງ)", "(โปร)", "[ແຖມຟຣີ]")
  const tierBracketRegex = /\s*[\(\[]\s*[^)\]]*(แถม|ແຖມ|free|gift|โปร|ໂປຣ|pro|promo|ส่ง|ສົ່ງ|สมาชิก|ສະມາຊິກ|ขายส่ง|ຂາຍສົ່ງ|ซื้อส่ง|ຊື້ສົ່ງ|ปกติ|ປົກກະຕິ)[^)\]]*[\)\]]/gi;
  let cleanName = name.replace(tierBracketRegex, '').replace(/\s+/g, ' ').trim();

  if (!cleanName) cleanName = name;

  return {
    cleanName,
    tier
  };
}

function formatPrice(amt) {
  const n = Number(amt) || 0;
  return n.toLocaleString('en-US') + ' ฿';
}

// Fetch Raw Nutrient Orders with Parallel Execution & Timeout Guard
async function fetchRawNutrientOrders(startUtcISO, endUtcISO) {
  const fetchMlm = async () => {
    if (!mlmClient) return [];
    let q = mlmClient
      .from('stk_nutrient_orders')
      .select('*')
      .order('created_at', { ascending: false });
    if (startUtcISO && endUtcISO) {
      q = q.gte('created_at', startUtcISO).lte('created_at', endUtcISO);
    }
    const { data, error } = await q.limit(500);
    return (!error && Array.isArray(data)) ? data : [];
  };

  const fetchClinic = async () => {
    if (!sbClient) return [];
    let q = sbClient
      .from('stk_nutrient_orders')
      .select('*')
      .order('created_at', { ascending: false });
    if (startUtcISO && endUtcISO) {
      q = q.gte('created_at', startUtcISO).lte('created_at', endUtcISO);
    }
    const { data, error } = await q.limit(500);
    return (!error && Array.isArray(data)) ? data : [];
  };

  // Run MLM and Clinic queries in parallel with 2.5s timeout each
  const [resMlm, resClinic] = await Promise.allSettled([
    withTimeout(fetchMlm(), 2500, []),
    withTimeout(fetchClinic(), 2500, [])
  ]);

  const mlmOrders = (resMlm.status === 'fulfilled' && Array.isArray(resMlm.value)) ? resMlm.value : [];
  const clinicOrders = (resClinic.status === 'fulfilled' && Array.isArray(resClinic.value)) ? resClinic.value : [];

  // Merge and deduplicate by order_id or id
  const orderMap = new Map();
  clinicOrders.forEach(o => {
    const k = o.order_id || o.id;
    if (k) orderMap.set(k, o);
  });
  mlmOrders.forEach(o => {
    const k = o.order_id || o.id;
    if (k && !orderMap.has(k)) orderMap.set(k, o);
  });

  let rawOrders = Array.from(orderMap.values());

  // LocalStorage fallback if both remote queries returned nothing
  if (rawOrders.length === 0) {
    try {
      const cached = JSON.parse(localStorage.getItem('stk_nutrient_orders') || '[]');
      if (Array.isArray(cached) && cached.length > 0) {
        rawOrders = cached;
      }
    } catch (e) {}
  }

  return rawOrders;
}

// Format doctor names into clean standardized doctor titles
function formatDoctorName(raw) {
  if (!raw || typeof raw !== 'string') return '';
  const s = raw.trim();
  const lower = s.toLowerCase();

  if (lower.includes('khanittha') || lower.includes('phoutthaamat')) {
    return 'Khanittha PHOUTTHAAMAT';
  }
  if (lower.includes('nuna') || lower.includes('sytathep')) {
    return 'Nuna SYTATHEP';
  }
  if (lower.includes('chiatong')) {
    return 'Dr. Chiatong';
  }
  if (lower.includes('lava')) {
    return 'Dr. Lava';
  }
  if (lower.includes('phengphan') || lower.includes('souvannaphoume')) {
    return 'Phengphan SOUVANNAPHOUME';
  }
  if (lower.includes('souksakhone') || lower.includes('doungviengxay')) {
    return 'Souksakhone DOUNGVIENGXAY';
  }
  if (lower.includes('dr. noy') || lower.includes('dr noy')) {
    return 'Dr. Noy';
  }
  if (lower.includes('dr. bee') || lower.includes('dr bee')) {
    return 'Dr. Bee';
  }

  return s.replace(/^(ທ່ານໝໍ|แพทย์|หมอ|dr\.|dr)\s*/i, '').trim() || s;
}

// Helper to verify if a name represents a genuine clinic doctor
function isRealDoctor(name) {
  if (!name || typeof name !== 'string') return false;
  const s = name.trim();
  if (!s || s === '-' || s === 'null' || s === 'undefined' || s === 'ບໍ່ລະບຸທ່ານໝໍ' || s === 'ไม่ได้ระบุ') return false;

  // 1. กรองผู้แนะนำ / สมาชิก MLM / รหัสสมาชิก ออกอย่างเด็ดขาด 100%
  // เช่น "L03732 - MS KHEMPHONE KHEMPHONE", "L04289 - LOVE STK"
  if (/^[A-Za-z0-9_\-]{3,10}\s*[-–]\s*/.test(s)) return false;
  if (/^L\d+/i.test(s) || /^REF-/i.test(s) || /^MEM-/i.test(s)) return false;

  const lower = s.toLowerCase();

  // 2. คำนำหน้าคุณหมอ (แพทย์ / ดร. / ດຣ. / Dr.)
  const docPrefixes = ['ดร.', 'ດຣ.', 'dr.', 'dr ', 'นพ.', 'พญ.', 'แพทย์', 'ທ່ານໝໍ', 'หมอ'];
  if (docPrefixes.some(p => lower.startsWith(p) || lower.includes(p))) {
    return true;
  }

  // 3. Keywords แพทย์ผู้อ่านผลตรวจประจำคลินิก (เช่น Khanittha PHOUTTHAAMAT, Nuna SYTATHEP)
  const knownDoctorKeywords = [
    'khanittha', 'phoutthaamat', 'lava', 'chiatong', 'nuna', 'sytathep',
    'phengphan', 'souvannaphoume', 'souksakhone', 'doungviengxay', 'dr noy', 'dr bee', 'ແພດປະຈຳຄລີນິກ'
  ];
  if (knownDoctorKeywords.some(k => lower.includes(k))) {
    return true;
  }

  // 4. ตรวจสอบกับรายชื่อแพทย์ในคลินิกที่ดึงมาจาก staff_users (role: doctor / แพทย์)
  const clinicDocs = state.clinicDoctors || [];
  for (const doc of clinicDocs) {
    const docName = (doc.full_name || doc.name || doc.emp_code || '').trim().toLowerCase();
    if (!docName) continue;
    if (lower === docName || lower.includes(docName) || docName.includes(lower)) {
      return true;
    }
  }

  return false;
}

// Process and Unify Nutrient Orders with Doctor Prescriptions
function processNutrientOrders(rawOrders, visitsList) {
  const currentVisits = visitsList || state.visits || [];

  // Filter raw nutrient orders by active date range & status
  const filteredNutrients = (rawOrders || []).filter(o => {
    const st = (o.status || '').toLowerCase();
    if (st.includes('cancel') || st.includes('ຍົກເລີກ') || st.includes('ยกเลิก')) {
      return false;
    }

    let dStr = toLocalDateStr(o.created_at);
    if (!dStr && o.visit_id && currentVisits) {
      const v = currentVisits.find(x => x.visit_id === o.visit_id);
      if (v && v.created_at) dStr = toLocalDateStr(v.created_at);
    }
    if (!dStr) dStr = toLocalDateStr(o.date);
    if (!dStr) return true;
    return dStr >= state.startDate && dStr <= state.endDate;
  });

  const handledVisitIds = new Set();
  const unified = [];

  filteredNutrients.forEach(o => {
    if (o.visit_id && o.visit_id !== '-') handledVisitIds.add(o.visit_id);

    let items = o.items_json || o.items || [];
    if (typeof items === 'string') {
      try { items = JSON.parse(items); } catch(e) { items = []; }
    }
    const cleanItems = [];
    if (Array.isArray(items)) {
      items.forEach(it => {
        const rawName = it.name || it.item_name || it.title || 'ອາຫານເສີມ';
        const qty = Number(it.quantity || it.qty || 1);
        const unitPrice = getProductPrice(rawName, it.price || it.unit_price || it.sale_price);
        const parsed = parseProductTierAndName(rawName, it.tier || it.price_type, unitPrice);
        cleanItems.push({
          name: rawName,
          clean_name: parsed.cleanName,
          tier: parsed.tier,
          qty: qty,
          unit_price: unitPrice,
          total_price: qty * unitPrice
        });
      });
    }

    const totalQty = cleanItems.reduce((sum, it) => sum + it.qty, 0);
    const totalAmount = cleanItems.reduce((sum, it) => sum + it.total_price, 0);

    // 🌟 ดึงเฉพาะคุณหมอที่อ่านผลตรวจเท่านั้น (Doctor only):
    let doctor = '';

    // 1. ค้นหาจาก visit_id ของเคสคนไข้ในคลินิก
    let vId = o.visit_id;
    if (!vId && o.order_id && o.order_id.includes('VIS-')) {
      vId = 'VIS-' + o.order_id.split('VIS-')[1];
    }
    let matchedVisit = null;
    if (vId && currentVisits) {
      matchedVisit = currentVisits.find(x => x.visit_id === vId);
    }

    // 2. ถ้าไม่มี visit_id ให้จับคู่จาก HN ในวันเดียวกัน (หรือ HN ล่าสุด)
    if (!matchedVisit && o.hn && o.hn !== '-' && currentVisits) {
      const oDate = toLocalDateStr(o.date || o.created_at);
      matchedVisit = currentVisits.find(x => x.hn === o.hn && toLocalDateStr(x.created_at) === oDate);
      if (!matchedVisit) {
        matchedVisit = currentVisits.find(x => x.hn === o.hn && isRealDoctor(x.doctor_name || x.doctor));
      }
    }

    // 3. ถ้ายังไม่เจอ ให้จับคู่จากชื่อคนไข้ (Customer Name) ในวันเดียวกัน
    if (!matchedVisit && o.customer_name && o.customer_name !== '-' && currentVisits) {
      const oDate = toLocalDateStr(o.date || o.created_at);
      matchedVisit = currentVisits.find(x => x.patient_name === o.customer_name && toLocalDateStr(x.created_at) === oDate);
    }

    // ดึงชื่อคุณหมอที่อ่านผลตรวจจาก Visit ที่จับคู่ได้
    if (matchedVisit) {
      const vDoc = (matchedVisit.doctor_name || matchedVisit.doctor || '').trim();
      if (isRealDoctor(vDoc)) {
        doctor = formatDoctorName(vDoc);
      }
    }

    // 4. ถ้ายังไม่ได้ ให้ตรวจจาก closer_dr เฉพาะเมื่อเป็นคุณหมออ่านผลตรวจจริงเท่านั้น
    if (!doctor && o.closer_dr && isRealDoctor(o.closer_dr)) {
      doctor = formatDoctorName(o.closer_dr);
    }

    // 5. ถ้ายังไม่มี ให้ตรวจสอบจาก patient profile cache ว่าคนไข้มีแพทย์ผู้ตรวจประจำตัวไหม
    if (!doctor && o.hn && state.patientCache && state.patientCache[o.hn]) {
      const p = state.patientCache[o.hn];
      const pDoc = (p.doctor_name || p.doctor || '').trim();
      if (isRealDoctor(pDoc)) {
        doctor = formatDoctorName(pDoc);
      }
    }

    // 6. ถ้าไม่มี หรือไม่ใช่แพทย์ ให้กำหนดเป็น 'ບໍ່ລະບຸທ່ານໝໍ' (ไม่เอาผู้แนะนำ / recorded_by มาเป็นแพทย์เด็ดขาด)
    if (!doctor) {
      doctor = 'ບໍ່ລະບຸທ່ານໝໍ';
    }

    unified.push({
      id: o.order_id || '-',
      date: o.date || o.created_at,
      doctor: doctor,
      patient_name: o.customer_name || 'ບໍ່ລະບຸຊື່',
      hn: o.hn || '-',
      phone: o.customer_phone || '-',
      items: cleanItems,
      total_qty: totalQty,
      total_price: totalAmount,
      status: o.status || 'ລໍຖ້າຈັດຢາ',
      recorded_by: o.recorded_by || '-'
    });
  });

  // Also include visits in the date range that have prescribed meds
  currentVisits.forEach(v => {
    if (handledVisitIds.has(v.visit_id)) return;
    if (!v.meds) return;

    let items = [];
    if (typeof v.meds === 'string' && v.meds.trim() !== '') {
      try {
        const parsed = JSON.parse(v.meds);
        if (Array.isArray(parsed)) {
          items = parsed.map(m => {
            const rawName = m.name || m.medicine_name || m.item_name || 'ຢາປິ່ນປົວ';
            const qty = Number(m.qty || m.quantity || 1);
            const unitPrice = getProductPrice(rawName, m.price);
            const parsedInfo = parseProductTierAndName(rawName, m.tier || m.price_type, unitPrice);
            return {
              name: rawName,
              clean_name: parsedInfo.cleanName,
              tier: parsedInfo.tier,
              qty: qty,
              unit_price: unitPrice,
              total_price: qty * unitPrice
            };
          });
        }
      } catch(e) {
        const rawName = v.meds;
        const unitPrice = getProductPrice(rawName, 0);
        const parsedInfo = parseProductTierAndName(rawName, '', unitPrice);
        items = [{
          name: rawName,
          clean_name: parsedInfo.cleanName,
          tier: parsedInfo.tier,
          qty: 1,
          unit_price: unitPrice,
          total_price: unitPrice
        }];
      }
    }

    if (items.length > 0) {
      const totalQty = items.reduce((sum, it) => sum + it.qty, 0);
      const totalAmount = items.reduce((sum, it) => sum + it.total_price, 0);
      let doctor = v.doctor_name || v.doctor || '';
      if (!isRealDoctor(doctor)) doctor = 'ບໍ່ລະບຸທ່ານໝໍ';
      unified.push({
        id: v.visit_id || '-',
        date: v.created_at,
        doctor: doctor,
        patient_name: v.patient_name || 'ຄົນເຈັບ',
        hn: v.hn || '-',
        phone: '-',
        items: items,
        total_qty: totalQty,
        total_price: totalAmount,
        status: v.status || 'ລໍຖ້າຈັດຢາ',
        recorded_by: '-'
      });
    }
  });

  state.unifiedPrescriptions = unified;
  state.nutrientOrders = unified;
}

// Backward compatibility alias for standalone invocations
async function loadNutrientOrders() {
  const startUtcISO = state.startDate ? new Date(state.startDate + 'T00:00:00').toISOString() : '';
  const endUtcISO = state.endDate ? new Date(state.endDate + 'T23:59:59.999').toISOString() : '';
  const raw = await fetchRawNutrientOrders(startUtcISO, endUtcISO);
  processNutrientOrders(raw, state.visits);
}

// ── Tab 1: Overview Renderers ─────────────────────────────────
function renderKPIs() {
  const totalRevenue = state.bills.reduce((sum, b) => sum + (Number(b.payable_amount) || 0), 0);
  
  let cashRevenue = 0;
  let transferRevenue = 0;
  state.bills.forEach(b => {
    const amt = Number(b.payable_amount) || 0;
    const pm = (b.payment_method || '').toLowerCase();
    if (pm.includes('ສົດ') || pm.includes('สด') || pm.includes('cash')) {
      cashRevenue += amt;
    } else {
      transferRevenue += amt;
    }
  });

  const generalExpense = state.expenses.reduce((sum, e) => sum + (Number(e.amount) || 0), 0);
  const paidCommission = state.commissions
    .filter(c => c.status === 'paid')
    .reduce((sum, c) => sum + (Number(c.amount) || 0), 0);
  const totalExpense = generalExpense + paidCommission;

  const netProfit = totalRevenue - totalExpense;
  const marginPct = totalRevenue > 0 ? ((netProfit / totalRevenue) * 100).toFixed(1) : 0;

  const totalVisits = state.visits.length;
  const newPatients = state.patients.filter(p => {
    const dStr = toLocalDateStr(p.created_at);
    return dStr >= state.startDate && dStr <= state.endDate;
  }).length;

  const elRev = document.getElementById('kpiRevenue');
  const elRevSub = document.getElementById('kpiRevenueSub');
  if (elRev) elRev.textContent = formatMoney(totalRevenue);
  if (elRevSub) elRevSub.textContent = `ເງິນສົດ: ${formatNumber(cashRevenue)} ₭ | ໂອນ: ${formatNumber(transferRevenue)} ₭`;

  const elExp = document.getElementById('kpiExpense');
  const elExpSub = document.getElementById('kpiExpenseSub');
  if (elExp) elExp.textContent = formatMoney(totalExpense);
  if (elExpSub) elExpSub.textContent = `ລາຍຈ່າຍທົ່ວໄປ: ${formatNumber(generalExpense)} ₭ | ປັນຜົນ: ${formatNumber(paidCommission)} ₭`;

  const elProfit = document.getElementById('kpiProfit');
  const elProfitSub = document.getElementById('kpiProfitSub');
  if (elProfit) {
    elProfit.textContent = formatMoney(netProfit);
    elProfit.style.color = netProfit >= 0 ? '#1d4ed8' : '#dc2626';
  }
  if (elProfitSub) {
    elProfitSub.textContent = `ອັດຕາກຳໄລ: ${marginPct}% ຂອງລາຍຮັບ`;
  }

  const elVisits = document.getElementById('kpiVisits');
  const elVisitsSub = document.getElementById('kpiVisitsSub');
  if (elVisits) elVisits.textContent = `${formatNumber(totalVisits)} ເທື່ອ`;
  if (elVisitsSub) elVisitsSub.textContent = `ຄົນເຈັບໃໝ່ຊ່ວງນີ້: ${formatNumber(newPatients)} ຄົນ`;
}

function renderCharts() {
  if (typeof Chart === 'undefined') return;

  const dateMap = {};
  const curr = new Date(state.startDate);
  const end = new Date(state.endDate);
  const diffDays = Math.ceil((end - curr) / (1000 * 60 * 60 * 24)) + 1;
  const isDaily = diffDays <= 35;

  if (isDaily) {
    let dIter = new Date(curr);
    while (dIter <= end) {
      const key = formatDateOnly(dIter);
      dateMap[key] = { rev: 0, exp: 0 };
      dIter.setDate(dIter.getDate() + 1);
    }
  }

  state.bills.forEach(b => {
    const dStr = toLocalDateStr(b.created_at);
    const key = isDaily ? dStr : dStr.substring(0, 7);
    if (!dateMap[key]) dateMap[key] = { rev: 0, exp: 0 };
    dateMap[key].rev += Number(b.payable_amount) || 0;
  });

  state.expenses.forEach(e => {
    const dStr = toLocalDateStr(e.date || e.created_at);
    const key = isDaily ? dStr : dStr.substring(0, 7);
    if (!dateMap[key]) dateMap[key] = { rev: 0, exp: 0 };
    dateMap[key].exp += Number(e.amount) || 0;
  });

  const labels = Object.keys(dateMap).sort();
  const revData = labels.map(k => dateMap[k].rev);
  const expData = labels.map(k => dateMap[k].exp);

  const displayLabels = labels.map(k => {
    if (k.length === 10) {
      const p = k.split('-');
      return `${p[2]}/${p[1]}`;
    }
    return k;
  });

  const ctxTrend = document.getElementById('chartTrend');
  if (ctxTrend) {
    if (state.charts.trend) state.charts.trend.destroy();

    state.charts.trend = new Chart(ctxTrend, {
      type: 'bar',
      data: {
        labels: displayLabels,
        datasets: [
          {
            label: 'ລາຍຮັບ (Revenue)',
            data: revData,
            backgroundColor: 'rgba(16, 185, 129, 0.8)',
            borderColor: '#10b981',
            borderRadius: 6,
            borderWidth: 1
          },
          {
            label: 'ລາຍຈ່າຍ (Expenses)',
            data: expData,
            backgroundColor: 'rgba(239, 68, 68, 0.8)',
            borderColor: '#ef4444',
            borderRadius: 6,
            borderWidth: 1
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { position: 'top', labels: { font: { family: 'Outfit, Kanit, sans-serif' } } },
          tooltip: {
            callbacks: {
              label: (ctx) => ` ${ctx.dataset.label}: ${formatNumber(ctx.raw)} ₭`
            }
          }
        },
        scales: {
          x: { grid: { display: false } },
          y: {
            ticks: {
              callback: (v) => formatNumber(v) + ' ₭'
            },
            grid: { color: '#f1f5f9' }
          }
        }
      }
    });
  }

  let cashAmt = 0;
  let transferAmt = 0;
  let otherAmt = 0;

  state.bills.forEach(b => {
    const amt = Number(b.payable_amount) || 0;
    const pm = (b.payment_method || '').toLowerCase();
    if (pm.includes('ສົດ') || pm.includes('สด') || pm.includes('cash')) {
      cashAmt += amt;
    } else if (pm.includes('ໂອນ') || pm.includes('โอน') || pm.includes('transfer') || pm.includes('bcel')) {
      transferAmt += amt;
    } else {
      otherAmt += amt;
    }
  });

  const ctxPayment = document.getElementById('chartPayment');
  if (ctxPayment) {
    if (state.charts.payment) state.charts.payment.destroy();

    state.charts.payment = new Chart(ctxPayment, {
      type: 'doughnut',
      data: {
        labels: ['ເງິນສົດ (Cash)', 'ເງິນໂອນ (Transfer)', 'ອື່ນໆ (Other)'],
        datasets: [{
          data: [cashAmt, transferAmt, otherAmt],
          backgroundColor: [
            '#10b981',
            '#3b82f6',
            '#f59e0b'
          ],
          borderWidth: 2,
          borderColor: '#ffffff'
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { position: 'bottom', labels: { font: { family: 'Outfit, Kanit, sans-serif' } } },
          tooltip: {
            callbacks: {
              label: (ctx) => ` ${ctx.label}: ${formatNumber(ctx.raw)} ₭`
            }
          }
        },
        cutout: '68%'
      }
    });
  }
}

function renderBillsTable() {
  const tbody = document.getElementById('billsTableBody');
  if (!tbody) return;

  if (state.bills.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7" class="text-center py-4 text-muted">ບໍ່ພົບລາຍການໃບບິນໃນຊ່ວງເວລານີ້</td></tr>`;
    return;
  }

  tbody.innerHTML = state.bills.map((b, idx) => {
    const pm = b.payment_method || 'ເງິນສົດ';
    const isCash = pm.toLowerCase().includes('ສົດ') || pm.toLowerCase().includes('สด') || pm.toLowerCase().includes('cash');
    const badgeClass = isCash ? 'badge-cash' : 'badge-transfer';

    return `
      <tr>
        <td class="text-muted small">${idx + 1}</td>
        <td class="fw-bold">${b.bill_id || '-'}</td>
        <td class="small text-muted">${formatDateLao(b.created_at)}</td>
        <td>
          <div class="fw-semibold">${b.patient_name || 'ລູກຄ້າທົ່ວໄປ'}</div>
          <small class="text-muted">HN: ${b.hn || '-'}</small>
        </td>
        <td><span class="${badgeClass}">${pm}</span></td>
        <td class="fw-bold text-end" style="color: #047857;">${formatMoney(b.payable_amount)}</td>
        <td class="text-center">
          <span class="badge bg-light text-success border border-success-subtle px-2 py-1">${b.status || 'ຊຳລະແລ້ວ'}</span>
        </td>
      </tr>
    `;
  }).join('');
}

function renderTopServicesTable() {
  const tbody = document.getElementById('servicesTableBody');
  if (!tbody) return;

  const serviceStats = {};

  state.bills.forEach(bill => {
    let items = bill.items;
    if (typeof items === 'string') {
      try { items = JSON.parse(items); } catch(e) { items = []; }
    }
    if (Array.isArray(items)) {
      items.forEach(it => {
        const name = it.name || it.item_name || 'ບໍລິການທົ່ວໄປ';
        const qty = Number(it.quantity || it.qty || 1);
        const price = Number(it.price || it.unit_price || 0);
        const total = price * qty;

        if (!serviceStats[name]) {
          serviceStats[name] = { count: 0, revenue: 0 };
        }
        serviceStats[name].count += qty;
        serviceStats[name].revenue += total;
      });
    }
  });

  const sorted = Object.entries(serviceStats)
    .map(([name, data]) => ({ name, ...data }))
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 10);

  if (sorted.length === 0) {
    tbody.innerHTML = `<tr><td colspan="4" class="text-center py-4 text-muted">ບໍ່ພົບຂໍ້ມູນລາຍການບໍລິການ/ກວດວິເຄາະ</td></tr>`;
    return;
  }

  tbody.innerHTML = sorted.map((item, idx) => `
    <tr>
      <td class="text-muted small">${idx + 1}</td>
      <td class="fw-semibold">${item.name}</td>
      <td class="text-center"><span class="badge bg-primary-subtle text-primary fw-bold px-2 py-1">${item.count} ເທື່ອ</span></td>
      <td class="fw-bold text-end text-dark">${formatMoney(item.revenue)}</td>
    </tr>
  `).join('');
}

function renderExpensesTable() {
  const tbody = document.getElementById('expensesTableBody');
  if (!tbody) return;

  if (state.expenses.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" class="text-center py-4 text-muted">ບໍ່ພົບຂໍ້ມູນລາຍຈ່າຍໃນຊ່ວງເວລານີ້</td></tr>`;
    return;
  }

  tbody.innerHTML = state.expenses.map((e, idx) => `
    <tr>
      <td class="text-muted small">${idx + 1}</td>
      <td class="small text-muted">${e.date || formatDateLao(e.created_at)}</td>
      <td><span class="badge bg-secondary-subtle text-secondary px-2 py-1">${e.category || 'ທົ່ວໄປ'}</span></td>
      <td class="fw-semibold">${e.title}</td>
      <td><span class="badge-cash">${e.pay_mode || 'ເງິນສົດ'}</span></td>
      <td class="fw-bold text-end text-danger">${formatMoney(e.amount)}</td>
    </tr>
  `).join('');
}

// ── Tab 2: Nutrient & Prescription Orders Renderers ───────────
function renderNutrientsTab() {
  const orders = state.nutrientOrders || [];
  
  let totalItemsCount = 0;
  let pendingCount = 0;
  const doctorSet = new Set();
  const doctorStats = {};
  const medStats = {};

  orders.forEach(o => {
    let dr = (o.doctor && isRealDoctor(o.doctor)) ? o.doctor.trim() : 'ບໍ່ລະບຸທ່ານໝໍ';
    o.doctor = dr;
    doctorSet.add(dr);

    if (!doctorStats[dr]) {
      doctorStats[dr] = {
        doctor: dr,
        orderCount: 0,
        totalUnits: 0,
        totalAmount: 0,
        patients: new Set(),
        medMap: {}
      };
    }
    doctorStats[dr].orderCount++;
    if (o.hn) doctorStats[dr].patients.add(o.hn);

    (o.items || []).forEach(it => {
      const q = Number(it.qty) || 1;
      const unitP = Number(it.unit_price) || 0;
      const totP = Number(it.total_price) || (q * unitP);

      totalItemsCount += q;
      doctorStats[dr].totalUnits += q;
      doctorStats[dr].totalAmount += totP;

      const parsed = it.clean_name && it.tier ? { cleanName: it.clean_name, tier: it.tier } : parseProductTierAndName(it.name, it.tier, unitP);
      const cleanName = parsed.cleanName;
      const tier = parsed.tier;

      // Doctor's med breakdown
      if (!doctorStats[dr].medMap[cleanName]) {
        doctorStats[dr].medMap[cleanName] = {
          name: cleanName,
          rawNames: new Set(),
          normal: { qty: 0, unitPrice: 0, totalPrice: 0 },
          pro: { qty: 0, unitPrice: 0, totalPrice: 0 },
          member: { qty: 0, unitPrice: 0, totalPrice: 0 },
          free: { qty: 0, unitPrice: 0, totalPrice: 0 },
          totalQty: 0,
          totalPrice: 0,
          qty: 0 // backwards compatibility
        };
      }
      const prod = doctorStats[dr].medMap[cleanName];
      prod.rawNames.add(it.name);
      if (!prod[tier]) {
        prod[tier] = { qty: 0, unitPrice: 0, totalPrice: 0 };
      }
      prod[tier].qty += q;
      prod[tier].totalPrice += totP;
      if (unitP > 0) {
        prod[tier].unitPrice = unitP;
      }
      prod.totalQty += q;
      prod.qty = prod.totalQty;
      prod.totalPrice += totP;

      // Overall med stats
      if (!medStats[cleanName]) {
        medStats[cleanName] = {
          name: cleanName,
          totalQty: 0,
          unitPrice: unitP,
          totalAmount: 0,
          doctors: {},
          patientSet: new Set()
        };
      }
      medStats[cleanName].totalQty += q;
      medStats[cleanName].totalAmount += totP;
      medStats[cleanName].doctors[dr] = (medStats[cleanName].doctors[dr] || 0) + q;
      if (o.hn) medStats[cleanName].patientSet.add(o.hn);
    });

    const st = (o.status || '').toLowerCase();
    if (st.includes('รอ') || st.includes('ລໍ') || st.includes('pending')) {
      pendingCount++;
    }
  });

  // 1. Save state for reactive filtering
  state.doctorStatsMap = doctorStats;
  state.doctorSet = doctorSet;
  state.allOrders = orders;

  // 2. Populate Doctor Filter Select (ຫມາຍເລກ 1)
  populateDoctorFilter(Array.from(doctorSet));

  // 3. Trigger Reactive Doctor Selection Change (renders ຫມາຍເລກ 2 and updates KPIs)
  onDoctorSelectChange();
}

let currentSortedDoctors = [];

function updateDoctorNavCounter() {
  const select = document.getElementById('filterDoctorSelect');
  const counter = document.getElementById('doctorNavCounter');
  if (!select || !counter) return;

  if (select.value === 'all') {
    counter.textContent = `ທັງໝົດ (${currentSortedDoctors.length})`;
  } else {
    const idx = currentSortedDoctors.indexOf(select.value);
    if (idx >= 0) {
      counter.textContent = `${idx + 1} / ${currentSortedDoctors.length}`;
    } else {
      counter.textContent = `- / ${currentSortedDoctors.length}`;
    }
  }
}

window.navigateDoctor = function (direction) {
  if (!currentSortedDoctors || currentSortedDoctors.length === 0) return;
  const select = document.getElementById('filterDoctorSelect');
  if (!select) return;

  let currentIdx = currentSortedDoctors.indexOf(select.value);
  if (currentIdx < 0) currentIdx = 0;

  let newIdx = currentIdx + direction;
  if (newIdx < 0) newIdx = currentSortedDoctors.length - 1;
  if (newIdx >= currentSortedDoctors.length) newIdx = 0;

  select.value = currentSortedDoctors[newIdx];
  updateDoctorNavCounter();
  onDoctorSelectChange();
};

function populateDoctorFilter(doctors) {
  const select = document.getElementById('filterDoctorSelect');
  if (!select) return;

  // 🌟 Filter out non-doctors strictly (e.g. referrers, member IDs)
  let validDoctors = doctors.filter(dr => isRealDoctor(dr) && dr !== 'ບໍ່ລະບຸທ່ານໝໍ');

  // เพิ่มแพทย์อ่านผลตรวจหลักของคลินิก หากมีใน doctorStatsMap
  const coreReadingDoctors = ['Khanittha PHOUTTHAAMAT', 'Nuna SYTATHEP'];
  coreReadingDoctors.forEach(docName => {
    if (!validDoctors.includes(docName) && state.doctorStatsMap && state.doctorStatsMap[docName]) {
      validDoctors.push(docName);
    }
  });

  // 🌟 Sort doctors by total order count descending, real doctors first
  currentSortedDoctors = validDoctors.slice().sort((a, b) => {
    const aCount = state.doctorStatsMap[a]?.orderCount || 0;
    const bCount = state.doctorStatsMap[b]?.orderCount || 0;
    return bCount - aCount;
  });

  // ใส่ 'ບໍ່ລະບຸທ່ານໝໍ' ไว้หลังสุด หากมีออเดอร์ที่ไม่ระบุแพทย์
  if (doctors.includes('ບໍ່ລະບຸທ່ານໝໍ') && state.doctorStatsMap['ບໍ່ລະບຸທ່ານໝໍ']?.orderCount > 0) {
    currentSortedDoctors.push('ບໍ່ລະບຸທ່ານໝໍ');
  }

  // 🌟 Default to the FIRST real doctor so it displays doctor breakdown by default
  let targetVal = select.value;
  if (!targetVal || targetVal === 'all' || !currentSortedDoctors.includes(targetVal)) {
    targetVal = currentSortedDoctors.length > 0 ? currentSortedDoctors[0] : 'all';
  }

  select.innerHTML = '';
  currentSortedDoctors.forEach((dr) => {
    const count = state.doctorStatsMap[dr]?.orderCount || 0;
    const opt = document.createElement('option');
    opt.value = dr;
    const prefix = dr === 'ບໍ່ລະບຸທ່ານໝໍ' ? '⚠️ ' : '👨‍⚕️ ';
    opt.textContent = `${prefix}${dr} (${count} ໃບສັ່ງ)`;
    select.appendChild(opt);
  });

  // Also add 'ທັງໝົດ' option at the very bottom
  const optAll = document.createElement('option');
  optAll.value = 'all';
  optAll.textContent = `--- ສະແດງທ່ານໝໍທັງໝົດ (${currentSortedDoctors.length} ທ່ານ) ---`;
  select.appendChild(optAll);

  select.value = targetVal;
  updateDoctorNavCounter();
}

// Handler for Doctor Select and Search Input changes
function onDoctorSelectChange() {
  const select = document.getElementById('filterDoctorSelect');
  const searchInput = document.getElementById('searchNutrientInput');
  const selectedDoctor = select ? select.value : 'all';
  const query = searchInput ? searchInput.value.trim().toLowerCase() : '';

  updateDoctorNavCounter();

  const allDoctorStats = Object.values(state.doctorStatsMap || {});
  const allOrders = state.allOrders || [];

  // Filter 1: By Doctor
  let filtered = allDoctorStats;
  if (selectedDoctor !== 'all') {
    filtered = allDoctorStats.filter(d => d.doctor === selectedDoctor);
  }

  // Filter 2: Medicine / Keyword Search
  if (query) {
    filtered = filtered.map(d => {
      const drMatch = (d.doctor || '').toLowerCase().includes(query);
      const matchingMeds = {};
      let filteredUnits = 0;
      let filteredAmount = 0;

      Object.entries(d.medMap || {}).forEach(([k, m]) => {
        let nameMatch = (m.name || '').toLowerCase().includes(query);
        if (!nameMatch && m.rawNames) {
          for (const rn of m.rawNames) {
            if ((rn || '').toLowerCase().includes(query)) {
              nameMatch = true;
              break;
            }
          }
        }
        if (drMatch || nameMatch) {
          matchingMeds[k] = m;
          filteredUnits += (m.totalQty || m.qty || 0);
          filteredAmount += (m.totalPrice || 0);
        }
      });

      if (Object.keys(matchingMeds).length > 0) {
        return {
          ...d,
          totalUnits: filteredUnits,
          totalAmount: filteredAmount,
          medMap: matchingMeds
        };
      }
      return null;
    }).filter(Boolean);
  }

  // Update Doctor Filter Status Badge
  const statusBadge = document.getElementById('doctorFilterStatusBadge');
  if (statusBadge) {
    if (selectedDoctor !== 'all') {
      statusBadge.textContent = `ສະແດງສະເພາະ: 👨‍⚕️ ${selectedDoctor}`;
      statusBadge.className = 'badge bg-primary text-white border px-3 py-1';
    } else {
      statusBadge.textContent = `ສະແດງທຸກທ່ານໝໍ (${filtered.length} ທ່ານ)`;
      statusBadge.className = 'badge bg-light text-primary border px-3 py-1';
    }
  }

  // Update 4 KPI Cards for the selected Doctor or All
  const elOrders = document.getElementById('kpiNutrientOrders');
  const elItems = document.getElementById('kpiNutrientItemsCount');
  const elDoctors = document.getElementById('kpiNutrientDoctorsCount');
  const elPending = document.getElementById('kpiNutrientPending');

  let relevantOrders = allOrders;
  if (selectedDoctor !== 'all') {
    relevantOrders = allOrders.filter(o => o.doctor === selectedDoctor);
  }

  let totalItemsCount = 0;
  filtered.forEach(d => {
    totalItemsCount += d.totalUnits;
  });

  let pendingCount = 0;
  relevantOrders.forEach(o => {
    const st = (o.status || '').toLowerCase();
    if (st.includes('รอ') || st.includes('ລໍ') || st.includes('pending')) {
      pendingCount++;
    }
  });

  if (elOrders) elOrders.textContent = formatNumber(relevantOrders.length);
  if (elItems) elItems.textContent = `${formatNumber(totalItemsCount)} ກ່ອງ/ກະປຸກ`;
  if (elDoctors) {
    if (selectedDoctor !== 'all') {
      elDoctors.textContent = `1 ທ່ານ (ເລືອກຢູ່)`;
    } else {
      elDoctors.textContent = `${(state.doctorSet?.size) || filtered.length} ທ່ານ`;
    }
  }
  if (elPending) elPending.textContent = formatNumber(pendingCount);

  // Render Doctor Breakdown Cards in ຫມາຍເລກ 2
  renderDoctorStatsCards(filtered);
}

// Render Doctor Breakdown Cards into #doctorStatsRow (ຫມາຍເລກ 2)
function renderDoctorStatsCards(doctorList) {
  const container = document.getElementById('doctorStatsRow');
  if (!container) return;

  if (!doctorList || doctorList.length === 0) {
    container.innerHTML = `
      <div class="col-12 text-center py-5 text-muted">
        <i class="ph-fill ph-stethoscope fs-1 text-muted mb-2 d-block"></i>
        <div class="fw-semibold fs-6">ບໍ່ພົບຂໍ້ມູນການສັ່ງຢາຂອງທ່ານໝໍທີ່ເລືອກໃນຊ່ວງເວລານີ້</div>
        <small class="text-muted">ກະລຸນາເລືອກທ່ານໝໍທ່ານອື່ນ ຫຼື ປ່ຽນຊ່ວງວັນທີ</small>
      </div>
    `;
    return;
  }

  // Sort doctors by total units prescribed
  doctorList.sort((a, b) => b.totalUnits - a.totalUnits);

  container.innerHTML = doctorList.map((ds, idx) => {
    const medEntries = Object.values(ds.medMap || {}).sort((a, b) => (b.totalQty || b.qty || 0) - (a.totalQty || a.qty || 0));

    let sumNormalQty = 0;
    let sumProQty = 0;
    let sumMemberQty = 0;
    let sumFreeQty = 0;

    const medRows = medEntries.map((m, mIdx) => {
      const nQty = m.normal?.qty || 0;
      const nPrice = m.normal?.unitPrice || 0;
      const pQty = m.pro?.qty || 0;
      const pPrice = m.pro?.unitPrice || 0;
      const memQty = m.member?.qty || 0;
      const memPrice = m.member?.unitPrice || 0;
      const fQty = m.free?.qty || 0;

      sumNormalQty += nQty;
      sumProQty += pQty;
      sumMemberQty += memQty;
      sumFreeQty += fQty;

      const renderTierCell = (qty, unitPrice, badgeClass, isFree = false) => {
        if (!qty || qty <= 0) {
          return `<span class="text-muted opacity-50">-</span>`;
        }
        if (isFree) {
          return `<span class="badge ${badgeClass} px-2 py-1">${formatNumber(qty)} ກ່ອງ <span class="small">(0 ฿)</span></span>`;
        }
        return `<span class="badge ${badgeClass} px-2 py-1">${formatNumber(qty)} ກ່ອງ <span class="small opacity-75">(${formatNumber(unitPrice)} ฿)</span></span>`;
      };

      return `
        <tr>
          <td class="text-muted small text-center">${mIdx + 1}</td>
          <td class="fw-semibold text-dark">
            <i class="ph-fill ph-pill text-primary me-1"></i> ${m.name}
          </td>
          <td class="text-center">
            ${renderTierCell(nQty, nPrice, 'bg-light text-secondary border')}
          </td>
          <td class="text-center">
            ${renderTierCell(pQty, pPrice, 'bg-warning-subtle text-warning-emphasis border border-warning-subtle')}
          </td>
          <td class="text-center">
            ${renderTierCell(memQty, memPrice, 'bg-primary-subtle text-primary border border-primary-subtle')}
          </td>
          <td class="text-center">
            ${renderTierCell(fQty, 0, 'bg-success-subtle text-success border border-success-subtle', true)}
          </td>
          <td class="text-center">
            <span class="badge bg-info-subtle text-info-emphasis fw-bold px-2 py-1">${formatNumber(m.totalQty || m.qty || 0)} ກ່ອງ</span>
          </td>
          <td class="text-end fw-bold text-success">${formatPrice(m.totalPrice)}</td>
        </tr>
      `;
    }).join('');

    return `
      <div class="col-12 mb-3">
        <div class="doctor-breakdown-card shadow-sm">
          <div class="doctor-breakdown-hdr">
            <div class="d-flex align-items-center gap-2 flex-wrap">
              <span class="badge-doctor py-1 px-3 fs-6">
                <i class="ph-fill ph-stethoscope fs-5"></i> ທ່ານໝໍ / ຜູ້ສັ່ງ: <b>${ds.doctor}</b>
              </span>
              <span class="badge bg-light text-dark border">
                ສັ່ງຢາໃຫ້ຄົນເຈັບ: <b>${ds.patients?.size || 0}</b> ຄົນ (${ds.orderCount} ໃບສັ່ງ)
              </span>
            </div>
            <div class="d-flex align-items-center gap-3 flex-wrap">
              <div class="d-flex align-items-center gap-1">
                <span class="text-muted small">ຈັດຢາໄປທັງໝົດ:</span>
                <span class="badge bg-primary text-white fs-6 px-3 py-1 ms-1">${formatNumber(ds.totalUnits)} ກ່ອງ</span>
              </div>
              <div class="d-flex align-items-center gap-1">
                <span class="text-muted small">ມູນຄ່າຢາລວມ:</span>
                <span class="badge bg-success text-white fs-6 px-3 py-1 ms-1">${formatPrice(ds.totalAmount)}</span>
              </div>
            </div>
          </div>
          <div class="table-responsive">
            <table class="doctor-breakdown-table">
              <thead>
                <tr>
                  <th style="width: 45px;" class="text-center">#</th>
                  <th>ລາຍການຢາ / ອາຫານເສີມ</th>
                  <th class="text-center" style="width: 145px;">ລາຄາປົກກະຕິ</th>
                  <th class="text-center" style="width: 145px;">ລາຄາໂປຣ</th>
                  <th class="text-center" style="width: 155px;">ລາຄາສະມາຊິກ</th>
                  <th class="text-center" style="width: 125px;">ແຖມຟຣີ</th>
                  <th class="text-center" style="width: 130px;">ລວມ (ກ່ອງ)</th>
                  <th class="text-end" style="width: 140px;">ມູນຄ່າລວມ</th>
                </tr>
              </thead>
              <tbody>
                ${medRows}
              </tbody>
              <tfoot>
                <tr>
                  <td colspan="2" class="text-end text-dark">
                    ລວມທັງໝົດຂອງທ່ານໝໍ <b>${ds.doctor}</b>:
                  </td>
                  <td class="text-center text-secondary fw-bold">
                    ${sumNormalQty > 0 ? `${formatNumber(sumNormalQty)} ກ່ອງ` : '<span class="text-muted">-</span>'}
                  </td>
                  <td class="text-center text-warning-emphasis fw-bold">
                    ${sumProQty > 0 ? `${formatNumber(sumProQty)} ກ່ອງ` : '<span class="text-muted">-</span>'}
                  </td>
                  <td class="text-center text-primary fw-bold">
                    ${sumMemberQty > 0 ? `${formatNumber(sumMemberQty)} ກ່ອງ` : '<span class="text-muted">-</span>'}
                  </td>
                  <td class="text-center text-success fw-bold">
                    ${sumFreeQty > 0 ? `${formatNumber(sumFreeQty)} ກ່ອງ` : '<span class="text-muted">-</span>'}
                  </td>
                  <td class="text-center text-primary fs-6 fw-bold">
                    ${formatNumber(ds.totalUnits)} ກ່ອງ
                  </td>
                  <td class="text-end text-success fs-6 fw-bold">
                    ${formatPrice(ds.totalAmount)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      </div>
    `;
  }).join('');
}


// ── Tab 3: Patients & Visits Renderers (by Doctor) ────────────

// Resolve Doctor for clinical visits (checks v.doctor, v.doctor_name, v.closer_dr, linked nutrient orders, bills, and fallback)
function resolveVisitDoctor(v, visitNutrientMap) {
  let doc = v.doctor || v.doctor_name;
  if (isRealDoctor(doc)) return doc.trim();

  // Check from bills by visit_id
  if (v.visit_id && state.bills) {
    const b = state.bills.find(x => x.visit_id === v.visit_id);
    if (b && (b.doctor || b.doctor_name) && isRealDoctor(b.doctor || b.doctor_name)) {
      return (b.doctor || b.doctor_name).trim();
    }
  }

  // Check from nutrient orders linked to this visit_id
  if (v.visit_id && visitNutrientMap && visitNutrientMap[v.visit_id]) {
    const nDoc = visitNutrientMap[v.visit_id].doctor;
    if (isRealDoctor(nDoc)) return nDoc;
  }

  return 'ບໍ່ລະບຸທ່ານໝໍ';
}

// Check if patient is New (ຜູ້ປ່ວຍໃໝ່) or Old/Returning (ຜູ້ປ່ວຍເກົ່າ)
function isNewPatient(v, patMap) {
  if (v.patient_type) {
    const pt = v.patient_type.toLowerCase();
    if (pt.includes('ໃໝ່') || pt.includes('ใหม่') || pt.includes('new')) return true;
    if (pt.includes('ເກົ່າ') || pt.includes('เก่า') || pt.includes('old') || pt.includes('follow')) return false;
  }
  const p = patMap[v.hn];
  if (!p || !p.created_at) return true;
  const regDate = toLocalDateStr(p.created_at);
  return regDate >= state.startDate && regDate <= state.endDate;
}

function renderPatientsTab() {
  const allPatients = state.patients || [];
  const visits = [...(state.visits || [])];

  const patMap = {};
  allPatients.forEach(p => { if (p.hn) patMap[p.hn] = p; });

  const visitNutrientMap = {};
  (state.nutrientOrders || []).forEach(o => {
    if (o.id && o.id !== '-') visitNutrientMap[o.id] = o;
  });

  // Also incorporate patient prescriptions from nutrientOrders if not already in visits
  const handledVisitIds = new Set(visits.map(v => v.visit_id).filter(Boolean));
  (state.nutrientOrders || []).forEach(o => {
    const vId = o.id || '';
    if (vId && handledVisitIds.has(vId)) return;
    if (vId) handledVisitIds.add(vId);

    visits.push({
      visit_id: vId || `ORD-${Math.random()}`,
      hn: (o.hn && o.hn !== '-') ? o.hn : '',
      patient_name: o.patient_name || 'ຄົນເຈັບ',
      doctor: o.doctor,
      doctor_name: o.doctor,
      symptoms: 'ສັ່ງຊື້ຢາ/ອາຫານເສີມ (Order)',
      status: o.status,
      created_at: o.date || o.created_at,
      meds: JSON.stringify(o.items || [])
    });
  });

  const patientDoctorStats = {};
  const doctorSet = new Set();

  visits.forEach(v => {
    const dr = resolveVisitDoctor(v, visitNutrientMap);
    v._resolvedDoctor = dr;
    doctorSet.add(dr);

    const isNew = isNewPatient(v, patMap);
    v._isNew = isNew;

    if (!patientDoctorStats[dr]) {
      patientDoctorStats[dr] = {
        doctor: dr,
        totalVisits: 0,
        patientSet: new Set(),
        newPatientSet: new Set(),
        oldPatientSet: new Set(),
        diseaseMap: {},
        visitsList: []
      };
    }

    const ds = patientDoctorStats[dr];
    ds.totalVisits++;
    const patKey = v.hn || v.patient_name || `VIS-${v.visit_id}`;
    ds.patientSet.add(patKey);

    if (isNew) {
      ds.newPatientSet.add(patKey);
    } else {
      ds.oldPatientSet.add(patKey);
    }

    // Extract disease / symptoms
    const sym = (v.symptoms || v.symptom || v.initial_symptom || v.diagnosis || v.disease || 'ກວດສຸຂະພາບທົ່ວໄປ').trim();
    if (sym && sym !== '-') {
      const parts = sym.split(/[,;\n+]/).map(s => s.trim()).filter(s => s.length > 1);
      if (parts.length > 0) {
        parts.forEach(p => {
          ds.diseaseMap[p] = (ds.diseaseMap[p] || 0) + 1;
        });
      } else {
        ds.diseaseMap[sym] = (ds.diseaseMap[sym] || 0) + 1;
      }
    }

    ds.visitsList.push(v);
  });

  state.patientDoctorStats = patientDoctorStats;
  state.allPatientDoctors = Array.from(doctorSet);

  // Populate Doctor Selector for Patients tab
  populatePatientDoctorFilter(Array.from(doctorSet));

  // Trigger reactive doctor selection change
  onPatientDoctorSelectChange();
}

let currentSortedPatientDoctors = [];

function updatePatientDoctorNavCounter() {
  const select = document.getElementById('filterPatientDoctorSelect');
  const counter = document.getElementById('patientDoctorNavCounter');
  if (!select || !counter) return;

  if (select.value === 'all') {
    counter.textContent = `ທັງໝົດ (${currentSortedPatientDoctors.length})`;
  } else {
    const idx = currentSortedPatientDoctors.indexOf(select.value);
    if (idx >= 0) {
      counter.textContent = `${idx + 1} / ${currentSortedPatientDoctors.length}`;
    } else {
      counter.textContent = `- / ${currentSortedPatientDoctors.length}`;
    }
  }
}

window.navigatePatientDoctor = function (direction) {
  if (!currentSortedPatientDoctors || currentSortedPatientDoctors.length === 0) return;
  const select = document.getElementById('filterPatientDoctorSelect');
  if (!select) return;

  let currentIdx = currentSortedPatientDoctors.indexOf(select.value);
  if (currentIdx < 0) currentIdx = 0;

  let newIdx = currentIdx + direction;
  if (newIdx < 0) newIdx = currentSortedPatientDoctors.length - 1;
  if (newIdx >= currentSortedPatientDoctors.length) newIdx = 0;

  select.value = currentSortedPatientDoctors[newIdx];
  updatePatientDoctorNavCounter();
  onPatientDoctorSelectChange();
};

function populatePatientDoctorFilter(doctors) {
  const select = document.getElementById('filterPatientDoctorSelect');
  if (!select) return;

  // 🌟 Filter out non-doctors strictly (e.g. referrers, member IDs)
  let validDoctors = doctors.filter(dr => isRealDoctor(dr) && dr !== 'ບໍ່ລະບຸທ່ານໝໍ');

  // เพิ่มแพทย์อ่านผลตรวจหลักของคลินิก หากมีใน patientDoctorStats
  const coreReadingDoctors = ['Khanittha PHOUTTHAAMAT', 'Nuna SYTATHEP'];
  coreReadingDoctors.forEach(docName => {
    if (!validDoctors.includes(docName) && state.patientDoctorStats && state.patientDoctorStats[docName]) {
      validDoctors.push(docName);
    }
  });

  // 🌟 Sort doctors by total visits/patients descending, real doctors first
  currentSortedPatientDoctors = validDoctors.slice().sort((a, b) => {
    const aVisits = state.patientDoctorStats[a]?.totalVisits || 0;
    const bVisits = state.patientDoctorStats[b]?.totalVisits || 0;
    return bVisits - aVisits;
  });

  // ใส่ 'ບໍ່ລະບຸທ່ານໝໍ' ไว้หลังสุด หากมีเคสที่ไม่ระบุแพทย์
  if (doctors.includes('ບໍ່ລະບຸທ່ານໝໍ') && state.patientDoctorStats['ບໍ່ລະບຸທ່ານໝໍ']?.totalVisits > 0) {
    currentSortedPatientDoctors.push('ບໍ່ລະບຸທ່ານໝໍ');
  }

  // 🌟 Default to the FIRST real doctor so it displays only ONE doctor at a time
  let targetVal = select.value;
  if (!targetVal || targetVal === 'all' || !currentSortedPatientDoctors.includes(targetVal)) {
    targetVal = currentSortedPatientDoctors.length > 0 ? currentSortedPatientDoctors[0] : 'all';
  }

  select.innerHTML = '';
  currentSortedPatientDoctors.forEach((dr) => {
    const visits = state.patientDoctorStats[dr]?.totalVisits || 0;
    const opt = document.createElement('option');
    opt.value = dr;
    const prefix = dr === 'ບໍ່ລະບຸທ່ານໝໍ' ? '⚠️ ' : '👨‍⚕️ ';
    opt.textContent = `${prefix}${dr} (${visits} ເທື່ອກວດ)`;
    if (dr === targetVal) opt.selected = true;
    select.appendChild(opt);
  });

  // Option to view all doctors together
  const allOpt = document.createElement('option');
  allOpt.value = 'all';
  allOpt.textContent = `-- ສະແດງທຸກທ່ານໝໍ (${currentSortedPatientDoctors.length} ທ່ານ) --`;
  if (targetVal === 'all') allOpt.selected = true;
  select.appendChild(allOpt);

  select.value = targetVal;
  updatePatientDoctorNavCounter();
}

function onPatientDoctorSelectChange() {
  updatePatientDoctorNavCounter();
  const select = document.getElementById('filterPatientDoctorSelect');
  const selectedDoctor = select ? select.value : 'all';
  const searchInput = document.getElementById('searchPatientDoctorInput');
  const query = (searchInput?.value || '').toLowerCase().trim();

  const allStats = Object.values(state.patientDoctorStats || {});
  const patMap = {};
  (state.patients || []).forEach(p => { if (p.hn) patMap[p.hn] = p; });

  // Filter by Doctor
  let filtered = allStats;
  if (selectedDoctor !== 'all') {
    filtered = allStats.filter(d => d.doctor === selectedDoctor);
  }

  // Filter by Search query if present
  if (query) {
    filtered = filtered.map(d => {
      const drMatch = d.doctor.toLowerCase().includes(query);
      const matchingVisits = d.visitsList.filter(v => {
        const p = patMap[v.hn] || {};
        const text = [
          v.hn,
          p.name,
          v.patient_name,
          p.phone,
          v.symptoms,
          v.symptom,
          v.diagnosis,
          d.doctor
        ].join(' ').toLowerCase();
        return drMatch || text.includes(query);
      });

      if (matchingVisits.length > 0) {
        const patSet = new Set();
        const newSet = new Set();
        const oldSet = new Set();
        const dMap = {};

        matchingVisits.forEach(v => {
          const patKey = v.hn || v.patient_name || `VIS-${v.visit_id}`;
          patSet.add(patKey);
          if (v._isNew) newSet.add(patKey);
          else oldSet.add(patKey);

          const sym = (v.symptoms || v.symptom || v.initial_symptom || v.diagnosis || 'ກວດສຸຂະພາບທົ່ວໄປ').trim();
          if (sym && sym !== '-') {
            const parts = sym.split(/[,;\n+]/).map(s => s.trim()).filter(s => s.length > 1);
            if (parts.length > 0) {
              parts.forEach(p => { dMap[p] = (dMap[p] || 0) + 1; });
            } else {
              dMap[sym] = (dMap[sym] || 0) + 1;
            }
          }
        });

        return {
          doctor: d.doctor,
          totalVisits: matchingVisits.length,
          patientSet: patSet,
          newPatientSet: newSet,
          oldPatientSet: oldSet,
          diseaseMap: dMap,
          visitsList: matchingVisits
        };
      }
      return null;
    }).filter(Boolean);
  }

  // Update Status Badge
  const statusBadge = document.getElementById('doctorPatientFilterStatusBadge');
  if (statusBadge) {
    if (selectedDoctor !== 'all') {
      statusBadge.textContent = `ສະແດງສະເພາະ: 👨‍⚕️ ${selectedDoctor}`;
      statusBadge.className = 'badge bg-primary text-white border px-3 py-1';
    } else {
      statusBadge.textContent = `ສະແດງທຸກທ່ານໝໍ (${filtered.length} ທ່ານ)`;
      statusBadge.className = 'badge bg-light text-primary border px-3 py-1';
    }
  }

  // Update 4 KPI Cards
  let totalUniquePatients = 0;
  let totalVisitsCount = 0;
  let totalNewPatients = 0;
  let totalOldPatients = 0;

  const countedPatKeys = new Set();
  filtered.forEach(d => {
    totalVisitsCount += d.totalVisits;
    d.newPatientSet.forEach(k => {
      if (!countedPatKeys.has(k)) {
        totalNewPatients++;
        countedPatKeys.add(k);
      }
    });
    d.oldPatientSet.forEach(k => {
      if (!countedPatKeys.has(k)) {
        totalOldPatients++;
        countedPatKeys.add(k);
      }
    });
  });
  totalUniquePatients = countedPatKeys.size;

  const newPct = totalUniquePatients > 0 ? ((totalNewPatients / totalUniquePatients) * 100).toFixed(0) : 0;
  const oldPct = totalUniquePatients > 0 ? ((totalOldPatients / totalUniquePatients) * 100).toFixed(0) : 0;

  const elTotPat = document.getElementById('kpiTotalPatients');
  const elVisSub = document.getElementById('kpiPeriodVisitsSub');
  const elNew = document.getElementById('kpiNewPatients');
  const elNewPct = document.getElementById('kpiNewPatientsPct');
  const elOld = document.getElementById('kpiOldPatients');
  const elOldPct = document.getElementById('kpiOldPatientsPct');
  const elDoc = document.getElementById('kpiTreatingDoctors');

  if (elTotPat) elTotPat.textContent = `${formatNumber(totalUniquePatients)} ຄົນ`;
  if (elVisSub) elVisSub.textContent = `${formatNumber(totalVisitsCount)} ເທື່ອກວດ (Visits)`;
  if (elNew) elNew.textContent = `${formatNumber(totalNewPatients)} ຄົນ`;
  if (elNewPct) elNewPct.textContent = `${newPct}% ຂອງຄົນເຈັບ`;
  if (elOld) elOld.textContent = `${formatNumber(totalOldPatients)} ຄົນ`;
  if (elOldPct) elOldPct.textContent = `${oldPct}% ຂອງຄົນເຈັບ`;
  if (elDoc) {
    if (selectedDoctor !== 'all') {
      elDoc.textContent = `1 ທ່ານ (ເລືອກຢູ່)`;
    } else {
      elDoc.textContent = `${(state.allPatientDoctors?.length) || filtered.length} ທ່ານ`;
    }
  }

  // Render Doctor Breakdown Cards
  renderDoctorPatientCards(filtered, patMap);
}

function renderDoctorPatientCards(doctorList, patMap) {
  const container = document.getElementById('doctorPatientsRow');
  if (!container) return;

  if (!doctorList || doctorList.length === 0) {
    container.innerHTML = `
      <div class="col-12 text-center py-5 text-muted">
        <i class="ph-fill ph-users-three fs-1 text-muted mb-2 d-block"></i>
        <div class="fw-semibold fs-6">ບໍ່ພົບຂໍ້ມູນການກວດຄົນເຈັບຂອງທ່ານໝໍທີ່ເລືອກໃນຊ່ວງເວລານີ້</div>
        <small class="text-muted">ກະລຸນາເລືອກທ່ານໝໍທ່ານອື່ນ ຫຼື ປ່ຽນຊ່ວງວັນທີ</small>
      </div>
    `;
    return;
  }

  // Sort doctors by total patient count
  doctorList.sort((a, b) => b.patientSet.size - a.patientSet.size);

  container.innerHTML = doctorList.map((ds) => {
    // Sort diseases by frequency
    const topDiseases = Object.entries(ds.diseaseMap || {})
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8);

    const diseaseTagsHtml = topDiseases.length > 0
      ? topDiseases.map(([dName, count]) => `
          <span class="disease-tag">
            <i class="ph-fill ph-stethoscope text-primary"></i> ${dName}
            <span class="disease-tag-count">${count}</span>
          </span>
        `).join('')
      : '<span class="text-muted small">ກວດສຸຂະພາບທົ່ວໄປ</span>';

    const patientRows = ds.visitsList.map((v, idx) => {
      const p = patMap[v.hn] || {};
      const name = p.name || v.patient_name || 'ບໍ່ລະບຸຊື່';
      const genderAge = [p.gender, p.age ? `${p.age} ປີ` : ''].filter(Boolean).join(' / ') || '-';
      const phone = p.phone || '-';
      const symptoms = v.symptoms || v.symptom || v.initial_symptom || v.diagnosis || '-';
      const isNew = v._isNew;
      const typeBadge = isNew
        ? `<span class="badge-patient-new"><i class="ph-fill ph-user-plus"></i> ໃໝ່</span>`
        : `<span class="badge-patient-old"><i class="ph-fill ph-arrows-counter-clockwise"></i> ເກົ່າ</span>`;

      return `
        <tr>
          <td class="text-muted small text-center">${idx + 1}</td>
          <td class="fw-bold text-primary font-monospace">${v.hn || '-'}</td>
          <td class="fw-semibold text-dark">${name}</td>
          <td class="text-center">${typeBadge}</td>
          <td><span class="badge bg-light text-dark border">${genderAge}</span></td>
          <td class="small font-monospace">${phone}</td>
          <td class="small" style="max-width: 260px;">
            <div class="fw-medium text-dark">${symptoms}</div>
          </td>
          <td class="small text-muted font-monospace">${formatDateLao(v.created_at)}</td>
        </tr>
      `;
    }).join('');

    return `
      <div class="col-12 mb-4">
        <div class="doctor-breakdown-card shadow-sm">
          <div class="doctor-breakdown-hdr">
            <div class="d-flex align-items-center gap-2 flex-wrap">
              <span class="badge-doctor py-1 px-3 fs-6">
                <i class="ph-fill ph-stethoscope fs-5"></i> ທ່ານໝໍ / ຜູ້ກວດ: <b>${ds.doctor}</b>
              </span>
              <span class="badge bg-light text-dark border">
                ກວດຄົນເຈັບທັງໝົດ: <b>${ds.patientSet.size}</b> ຄົນ (${ds.totalVisits} ເທື່ອ)
              </span>
            </div>
            <div class="d-flex align-items-center gap-2 flex-wrap">
              <span class="badge-patient-new py-1 px-3 fs-6">
                <i class="ph-fill ph-user-plus"></i> ຜູ້ປ່ວຍໃໝ່: <b>${ds.newPatientSet.size}</b> ຄົນ
              </span>
              <span class="badge-patient-old py-1 px-3 fs-6">
                <i class="ph-fill ph-arrows-counter-clockwise"></i> ຜູ້ປ່ວຍເກົ່າ: <b>${ds.oldPatientSet.size}</b> ຄົນ
              </span>
            </div>
          </div>

          <!-- Top Diseases / Symptoms Diagnosed by Doctor -->
          <div class="px-3 py-2 bg-light border-bottom d-flex align-items-center gap-2 flex-wrap">
            <span class="small fw-bold text-muted text-nowrap">
              <i class="ph-fill ph-heartbeat text-danger me-1"></i>ພະຍາດ & ອາການທີ່ພົບ:
            </span>
            <div class="d-flex align-items-center gap-1 flex-wrap">
              ${diseaseTagsHtml}
            </div>
          </div>

          <div class="table-responsive">
            <table class="doctor-breakdown-table table-hover">
              <thead>
                <tr>
                  <th style="width: 50px;" class="text-center">#</th>
                  <th style="width: 120px;">HN</th>
                  <th>ຊື່ ແລະ ນາມສະກຸນ</th>
                  <th class="text-center" style="width: 100px;">ປະເພດ</th>
                  <th style="width: 130px;">ເພດ / ອາຍຸ</th>
                  <th style="width: 130px;">ເບີໂທລະສັບ</th>
                  <th>ອາການເບື້ອງຕົ້ນ / ພະຍາດທີ່ເປັນ</th>
                  <th style="width: 140px;">ວັນທີມາກວດ</th>
                </tr>
              </thead>
              <tbody>
                ${patientRows}
              </tbody>
              <tfoot>
                <tr>
                  <td colspan="3" class="text-end text-dark">
                    ລວມຄົນເຈັບຂອງທ່ານໝໍ <b>${ds.doctor}</b>:
                  </td>
                  <td colspan="5" class="text-dark">
                    <span class="text-success fw-bold me-3">ຜູ້ປ່ວຍໃໝ່: ${ds.newPatientSet.size} ຄົນ</span>
                    <span class="text-primary fw-bold me-3">ຜູ້ປ່ວຍເກົ່າ: ${ds.oldPatientSet.size} ຄົນ</span>
                    <span class="text-dark fw-bold">| ລວມທັງໝົດ: ${ds.patientSet.size} ຄົນ (${ds.totalVisits} ເທື່ອກວດ)</span>
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      </div>
    `;
  }).join('');
}

// Print Report Function
function printReport() {
  window.print();
}

// Export Report Data to CSV based on Active Tab
function exportCSV() {
  let csvContent = '\uFEFF'; // UTF-8 BOM
  let fileName = '';

  if (state.activeTab === 'nutrients') {
    if (state.nutrientOrders.length === 0) {
      showEmptyExportAlert();
      return;
    }
    csvContent += 'ລ/ດ,ວັນທີ,ເລກທີອໍເດີ,ທ່ານໝໍຜູ້ສັ່ງ,ຊື່ຄົນເຈັບ,HN,ເບີໂທ,ລາຍການຢາ (ຈຳນວນ x ລາຄາ),ຈຳນວນກ່ອງລວມ,ມູນຄ່າລວມ,ສະຖານະ,ຜູ້ບັນທຶກ\n';
    state.nutrientOrders.forEach((o, idx) => {
      const itemsText = (o.items || []).map(i => `${i.name} (x${i.qty} @ ${i.unit_price})`).join('; ');
      const row = [
        idx + 1,
        `"${formatDateLao(o.date)}"`,
        `"${(o.id || '').replace(/"/g, '""')}"`,
        `"${(o.doctor || '').replace(/"/g, '""')}"`,
        `"${(o.patient_name || '').replace(/"/g, '""')}"`,
        `"${o.hn || ''}"`,
        `"${o.phone || ''}"`,
        `"${itemsText.replace(/"/g, '""')}"`,
        o.total_qty || 0,
        o.total_price || 0,
        `"${(o.status || '').replace(/"/g, '""')}"`,
        `"${(o.recorded_by || '').replace(/"/g, '""')}"`
      ];
      csvContent += row.join(',') + '\n';
    });
    fileName = `Doctor_Prescriptions_${state.startDate}_to_${state.endDate}.csv`;

  } else if (state.activeTab === 'patients') {
    if (state.visits.length === 0) {
      showEmptyExportAlert();
      return;
    }
    const patMap = {};
    (state.patients || []).forEach(p => { if (p.hn) patMap[p.hn] = p; });

    csvContent += 'ລ/ດ,ທ່ານໝໍຜູ້ກວດ,HN,ຊື່ ແລະ ນາມສະກຸນ,ປະເພດຄົນເຈັບ,ເພດ,ອາຍຸ,ເບີໂທ,ອາການ ແລະ ພະຍາດ,ວັນທີກວດ\n';
    state.visits.forEach((v, idx) => {
      const p = patMap[v.hn] || {};
      const isNew = v._isNew !== undefined ? v._isNew : isNewPatient(v, patMap);
      const patType = isNew ? 'ຜູ້ປ່ວຍໃໝ່' : 'ຜູ້ປ່ວຍເກົ່າ';
      const dr = v._resolvedDoctor || v.doctor || '-';
      const row = [
        idx + 1,
        `"${dr.replace(/"/g, '""')}"`,
        `"${v.hn || ''}"`,
        `"${(p.name || v.patient_name || '').replace(/"/g, '""')}"`,
        `"${patType}"`,
        `"${p.gender || ''}"`,
        `"${p.age || ''}"`,
        `"${p.phone || ''}"`,
        `"${(v.symptoms || v.symptom || '').replace(/"/g, '""')}"`,
        `"${formatDateLao(v.created_at)}"`
      ];
      csvContent += row.join(',') + '\n';
    });
    fileName = `Doctor_Patients_Report_${state.startDate}_to_${state.endDate}.csv`;

  } else {
    // Default: Overview / Bills
    if (state.bills.length === 0) {
      showEmptyExportAlert();
      return;
    }
    csvContent += 'ລ/ດ,ເລກທີໃບບິນ,ວັນທີ,ຊື່ຄົນເຈັບ,HN,ຊ່ອງທາງຈ່າຍ,ຍອດລວມ (LAK),ສະຖານະ\n';
    state.bills.forEach((b, idx) => {
      const row = [
        idx + 1,
        `"${(b.bill_id || '').replace(/"/g, '""')}"`,
        `"${formatDateLao(b.created_at)}"`,
        `"${(b.patient_name || '').replace(/"/g, '""')}"`,
        `"${b.hn || ''}"`,
        `"${(b.payment_method || '').replace(/"/g, '""')}"`,
        b.payable_amount || 0,
        `"${(b.status || '').replace(/"/g, '""')}"`
      ];
      csvContent += row.join(',') + '\n';
    });
    fileName = `Clinic_Bills_${state.startDate}_to_${state.endDate}.csv`;
  }

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', fileName);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

function showEmptyExportAlert() {
  if (typeof Swal !== 'undefined') {
    Swal.fire({
      icon: 'info',
      title: 'ບໍ່ມີຂໍ້ມູນສຳລັບ Export',
      text: 'ກະລຸນາເລືອກຊ່ວງວັນທີທີ່ມີຂໍ້ມູນ'
    });
  } else {
    alert('ບໍ່ມີຂໍ້ມູນສຳລັບ Export');
  }
}
