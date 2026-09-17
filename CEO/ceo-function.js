// ─── 1. Supabase Initialization ──────────────────────────────────────────
// ✅ Supabase config โหลดมาจาก ceo-config.js ผ่าน ceo-dashborad.html
// window.SUPABASE_URL, window.SUPABASE_ANON_KEY, window.SUPABASE_REST_URL,
// window.SUPABASE_HEADERS, window.supabaseSelect — พร้อมใช้งานทั้งหมด

async function supabaseSelect(table, query) {
  // ใช้ supabaseSelect จาก config.js ถ้ามี ไม่งั้น fallback ทำเอง
  if (window.supabaseSelect && window.supabaseSelect !== supabaseSelect) {
    return window.supabaseSelect(table, query);
  }
  try {
    const res = await fetch(window.SUPABASE_REST_URL + '/' + table + (query ? '?' + query : ''), {
      method: 'GET',
      headers: window.SUPABASE_HEADERS
    });
    if (!res.ok) return null;
    return await res.json();
  } catch (e) {
    return null;
  }
}

// ─── 2. Calendar Component Render ──────────────────────────────────────────
const monthNames = [
  'มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน',
  'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'
];

let currentCalDate = new Date(); // ควบคุมเดือน/ปีที่แสดงในปฏิทิน
let selectedDate = new Date();   // วันที่เดี่ยว
let rangeStartDate = null;       // วันเริ่มต้นของช่วงวันที่
let rangeEndDate = null;         // วันสิ้นสุดของช่วงวันที่
let isRangeMode = false;         // โหมดเลือกช่วงวันที่

function formatDateToInput(d) {
  if (!d || isNaN(d.getTime())) return '';
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function parseInputDate(str) {
  if (!str) return null;
  const parts = str.split('-');
  if (parts.length !== 3) return null;
  const y = parseInt(parts[0], 10);
  const m = parseInt(parts[1], 10) - 1;
  const d = parseInt(parts[2], 10);
  return new Date(y, m, d);
}

function syncRangeInputs() {
  const startInput = document.getElementById('calRangeStart');
  const endInput = document.getElementById('calRangeEnd');
  if (startInput) {
    startInput.value = rangeStartDate ? formatDateToInput(rangeStartDate) : '';
  }
  if (endInput) {
    endInput.value = rangeEndDate ? formatDateToInput(rangeEndDate) : '';
  }
}

function renderCalendar() {
  const calTitle = document.getElementById('calMonthTitle');
  const calGrid = document.getElementById('calDaysGrid');
  if (!calGrid) return;

  const year = currentCalDate.getFullYear();
  const month = currentCalDate.getMonth();
  
  if (calTitle) {
    calTitle.textContent = `${monthNames[month]} ${year}`;
  }

  syncRangeInputs();

  calGrid.innerHTML = '';

  // Get first day of month & total days
  const firstDayIndex = new Date(year, month, 1).getDay(); // 0 = Sun
  const totalDays = new Date(year, month + 1, 0).getDate();

  // Padding empty slots
  for (let i = 0; i < firstDayIndex; i++) {
    const emptyCell = document.createElement('div');
    emptyCell.className = 'cal-day empty';
    calGrid.appendChild(emptyCell);
  }

  const startStamp = rangeStartDate ? new Date(rangeStartDate.getFullYear(), rangeStartDate.getMonth(), rangeStartDate.getDate()).getTime() : null;
  const endStamp = rangeEndDate ? new Date(rangeEndDate.getFullYear(), rangeEndDate.getMonth(), rangeEndDate.getDate()).getTime() : null;

  // Days 1..totalDays
  for (let d = 1; d <= totalDays; d++) {
    const dayCell = document.createElement('div');
    dayCell.className = 'cal-day';
    dayCell.textContent = d;

    const thisDate = new Date(year, month, d);
    const thisStamp = thisDate.getTime();

    // ไฮไลต์ตามโหมด Range หรือ Single
    if (isRangeMode && startStamp && endStamp) {
      if (thisStamp === startStamp && thisStamp === endStamp) {
        dayCell.classList.add('range-start', 'range-end');
      } else if (thisStamp === startStamp) {
        dayCell.classList.add('range-start');
      } else if (thisStamp === endStamp) {
        dayCell.classList.add('range-end');
      } else if (thisStamp > startStamp && thisStamp < endStamp) {
        dayCell.classList.add('in-range');
      }
    } else if (isRangeMode && startStamp && !endStamp) {
      if (thisStamp === startStamp) {
        dayCell.classList.add('range-start');
      }
    } else {
      // โหมด Single Date ปกติ
      if (d === selectedDate.getDate() && month === selectedDate.getMonth() && year === selectedDate.getFullYear()) {
        dayCell.classList.add('active');
      }
    }

    // คลิกเลือกวันในปฏิทิน
    dayCell.addEventListener('click', () => {
      handleCalendarDayClick(year, month, d);
    });

    calGrid.appendChild(dayCell);
  }
}

function handleCalendarDayClick(year, month, d) {
  const clickedDate = new Date(year, month, d);

  // ตรรกะการเลือกช่วงวัน (Range Selection):
  // 1. ถ้ายังไม่มี rangeStartDate หรือทั้ง start & end ถูกเลือกครบแล้ว -> เริ่มต้นช่วงใหม่ด้วย clickedDate
  if (!rangeStartDate || (rangeStartDate && rangeEndDate)) {
    rangeStartDate = clickedDate;
    rangeEndDate = null;
    isRangeMode = true;
    selectedDate = clickedDate;

    // อัพเดตคำแนะนำ
    const hintEl = document.getElementById('calRangeHint');
    if (hintEl) {
      const dStr = String(d).padStart(2, '0');
      const mStr = String(month + 1).padStart(2, '0');
      hintEl.textContent = `📌 เลือกวันเริ่มต้น: ${dStr}/${mStr}/${year} กรุณาคลิกเลือกวันสิ้นสุด`;
    }
  } else if (rangeStartDate && !rangeEndDate) {
    // 2. ถ้ามี start แล้ว คลิกตัวที่สอง -> เป็น end
    if (clickedDate.getTime() < rangeStartDate.getTime()) {
      rangeEndDate = rangeStartDate;
      rangeStartDate = clickedDate;
    } else {
      rangeEndDate = clickedDate;
    }
    isRangeMode = true;

    // อัพเดตคำแนะนำ
    const hintEl = document.getElementById('calRangeHint');
    if (hintEl) {
      const sDay = String(rangeStartDate.getDate()).padStart(2, '0');
      const sMon = String(rangeStartDate.getMonth() + 1).padStart(2, '0');
      const eDay = String(rangeEndDate.getDate()).padStart(2, '0');
      const eMon = String(rangeEndDate.getMonth() + 1).padStart(2, '0');
      hintEl.textContent = `✅ ช่วงวันที่: ${sDay}/${sMon}/${rangeStartDate.getFullYear()} ถึง ${eDay}/${eMon}/${rangeEndDate.getFullYear()}`;
    }
  }

  // ปลด Active ของ pill buttons ด้านบนเพื่อให้รู้ว่าใช้ช่วงวันจากปฏิทิน
  const periodPills = document.querySelectorAll('#periodPills .pill-btn');
  periodPills.forEach(p => p.classList.remove('active'));

  renderCalendar();
  updateDashboardMetrics();
}

// ─── 3. Data Loader & State Manager ────────────────────────────────────────
let cachedSales = [];
let cachedCustomers = {};

function parseSaleBoxes(s) {
  let full = 0;
  let member = 0;
  let promo = 0;
  let zero = 0;

  let itemsList = [];
  if (s.items_json) {
    try {
      itemsList = typeof s.items_json === 'string' ? JSON.parse(s.items_json) : s.items_json;
    } catch (e) {
      itemsList = [];
    }
  }

  if (Array.isArray(itemsList) && itemsList.length > 0) {
    itemsList.forEach(it => {
      const qty = parseInt(it.qty || it.quantity || 1) || 1;
      const typeStr = String(it.type || it.priceType || '').trim();

      if (typeStr.includes('เต็ม')) {
        full += qty;
      } else if (typeStr.includes('สมาชิก')) {
        member += qty;
      } else if (typeStr.includes('โปร') || typeStr.includes('พิเศษ')) {
        promo += qty;
      } else if (typeStr.includes('ศูนย์') || typeStr.includes('แถม')) {
        zero += qty;
      } else {
        member += qty; // Default fallback
      }
    });
  } else {
    // Check direct property keys (legacy or flattened columns)
    Object.keys(s).forEach(k => {
      if (k !== 'รวมชิ้นราคาเต็ม' && k !== 'รวมชิ้นราคาสมาชิก' && k !== 'รวมชิ้นราคาโปร' && k !== 'รวมชิ้นราคาศูนย์' && k !== 'total_bottles') {
        const val = parseInt(s[k]) || 0;
        if (val > 0) {
          if (k.endsWith('_ราคาเต็ม')) full += val;
          else if (k.endsWith('_ราคาสมาชิก')) member += val;
          else if (k.endsWith('_ราคาโปร') || k.endsWith('_โปรโมชั่น')) promo += val;
          else if (k.endsWith('_ราคาศูนย์')) zero += val;
        }
      }
    });

    if (full === 0 && member === 0 && promo === 0 && zero === 0 && s.total_bottles) {
      member = parseInt(s.total_bottles) || 0;
    }
  }

  return {
    full,
    member,
    promo,
    zero,
    totalTarget: full + member + promo // รวมราคาเต็ม + ราคาสมาชิก + ราคาโปร
  };
}

function getPeriodDateRange(period) {
  const toDateStr = (d) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const dayStr = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${dayStr}`;
  };

  // 1. ตรวจสอบโหมดเลือกช่วงวันที่ (Range)
  if (period === 'range' || isRangeMode) {
    if (rangeStartDate && rangeEndDate) {
      let startD = rangeStartDate;
      let endD = rangeEndDate;
      if (startD.getTime() > endD.getTime()) {
        const tmp = startD;
        startD = endD;
        endD = tmp;
      }

      const startStr = toDateStr(startD);
      const endStr = toDateStr(endD);

      // คำนวณช่วงเวลาก่อนหน้าที่มีจำนวนวันเท่ากัน เพื่อใช้เปรียบเทียบ
      const diffDays = Math.max(1, Math.round((endD.getTime() - startD.getTime()) / (1000 * 60 * 60 * 24)) + 1);
      const prevEnd = new Date(startD);
      prevEnd.setDate(prevEnd.getDate() - 1);
      const prevStart = new Date(prevEnd);
      prevStart.setDate(prevStart.getDate() - diffDays + 1);

      const prevStartStr = toDateStr(prevStart);
      const prevEndStr = toDateStr(prevEnd);

      const sDay = String(startD.getDate()).padStart(2, '0');
      const sMon = String(startD.getMonth() + 1).padStart(2, '0');
      const eDay = String(endD.getDate()).padStart(2, '0');
      const eMon = String(endD.getMonth() + 1).padStart(2, '0');

      return {
        currentFilter: (d) => d >= startStr && d <= endStr,
        prevFilter: (d) => d >= prevStartStr && d <= prevEndStr,
        prevLabel: `ช่วงก่อนหน้า (${diffDays} วัน)`,
        periodLabel: `${sDay}/${sMon}/${startD.getFullYear()} - ${eDay}/${eMon}/${endD.getFullYear()}`
      };
    } else if (rangeStartDate) {
      // มีแค่วันเริ่มต้น 1 วัน
      const singleStr = toDateStr(rangeStartDate);
      const prevDay = new Date(rangeStartDate);
      prevDay.setDate(prevDay.getDate() - 1);
      const prevDayStr = toDateStr(prevDay);
      return {
        currentFilter: (d) => d === singleStr,
        prevFilter: (d) => d === prevDayStr,
        prevLabel: 'วันก่อนหน้า',
        periodLabel: `วันที่ ${rangeStartDate.getDate()} ${monthNames[rangeStartDate.getMonth()]} ${rangeStartDate.getFullYear()}`
      };
    }
  }

  if (period === 'today') {
    const targetDayStr = toDateStr(selectedDate);
    const prevDay = new Date(selectedDate);
    prevDay.setDate(prevDay.getDate() - 1);
    const prevDayStr = toDateStr(prevDay);
    return {
      currentFilter: (d) => d === targetDayStr,
      prevFilter: (d) => d === prevDayStr,
      prevLabel: 'วันก่อนหน้า',
      periodLabel: `วันที่ ${selectedDate.getDate()} ${monthNames[selectedDate.getMonth()]} ${selectedDate.getFullYear()}`
    };
  }

  if (period === 'week') {
    const endDay = new Date(selectedDate);
    const startDay = new Date(selectedDate);
    startDay.setDate(startDay.getDate() - 6);

    const prevEnd = new Date(startDay);
    prevEnd.setDate(prevEnd.getDate() - 1);
    const prevStart = new Date(prevEnd);
    prevStart.setDate(prevStart.getDate() - 6);

    const startStr = toDateStr(startDay);
    const endStr = toDateStr(endDay);
    const prevStartStr = toDateStr(prevStart);
    const prevEndStr = toDateStr(prevEnd);

    return {
      currentFilter: (d) => d >= startStr && d <= endStr,
      prevFilter: (d) => d >= prevStartStr && d <= prevEndStr,
      prevLabel: 'สัปดาห์ก่อน',
      periodLabel: `7 วันล่าสุด (${startDay.getDate()} - ${endDay.getDate()} ${monthNames[endDay.getMonth()]})`
    };
  }

  if (period === 'year') {
    const calYear = currentCalDate.getFullYear();
    const currentYearStr = String(calYear);
    const prevYearStr = String(calYear - 1);
    return {
      currentFilter: (d) => String(d || '').startsWith(currentYearStr),
      prevFilter: (d) => String(d || '').startsWith(prevYearStr),
      prevLabel: 'ปีก่อน',
      periodLabel: `ปี ${calYear}`
    };
  }

  // Default: 'month'
  const calYear = currentCalDate.getFullYear();
  const calMonth = currentCalDate.getMonth();
  const currentMonthPrefix = `${calYear}-${String(calMonth + 1).padStart(2, '0')}`;
  const prevMonthDate = new Date(calYear, calMonth - 1, 1);
  const prevMonthPrefix = `${prevMonthDate.getFullYear()}-${String(prevMonthDate.getMonth() + 1).padStart(2, '0')}`;

  return {
    currentFilter: (d) => String(d || '').startsWith(currentMonthPrefix),
    prevFilter: (d) => String(d || '').startsWith(prevMonthPrefix),
    prevLabel: 'เดือนก่อน',
    periodLabel: `เดือน${monthNames[calMonth]} ${calYear}`
  };
}

function isOldCustomerSale(s) {
  const cid = String(s.customer_id || '').trim().toUpperCase();
  const cInfo = cachedCustomers[cid] || { type: '', name: '' };
  const cType = cInfo.type || '';
  const cName = cInfo.name || '';
  const paymentNote = String(s.payment_note || '');

  // 1. ตรวจสอบจากประเภทลูกค้า (ลูกค้าเก่ากลับมาต่อยา, ลูกค้าเก่านำผลตรวจมาปรึกษา, โทรปิดการขายลูกค้าเก่า)
  if (cType.includes('เก่า') || cType.includes('ต่อยา') || cType.includes('ເກົ່າ') || cType.includes('ຕໍ່ຢາ')) {
    return true;
  }

  // 2. ตรวจสอบจากชื่อลูกค้า (เช่น "ເກົ່າຕໍ່ຢາ", "ຄົນເຈັບເກົ່າ", "เก่าต่อยา")
  if (cName.includes('เก่า') || cName.includes('ต่อยา') || cName.includes('ເກົ່າ') || cName.includes('ຕໍ່ຢາ')) {
    return true;
  }

  // 3. ตรวจสอบจากบันทึกการชำระเงิน (payment_note)
  if (paymentNote.includes('เก่า') || paymentNote.includes('ต่อยา') || paymentNote.includes('ເກົ່າ') || paymentNote.includes('ຕໍ່ຢາ')) {
    return true;
  }

  return false;
}

function updateDashboardMetrics() {
  const activePill = document.querySelector('#periodPills .pill-btn.active');
  const period = activePill ? activePill.getAttribute('data-period') : 'month';
  const { currentFilter, prevFilter, prevLabel, periodLabel } = getPeriodDateRange(period);

  // Metrics 1: All Sales
  let currentFull = 0, currentMember = 0, currentPromo = 0, currentTotal = 0;
  let currentTotalTHB = 0, currentTotalLAK = 0;
  let prevTotal = 0, prevTotalTHB = 0;

  // Marketing Sales
  let currentMarketingBoxes = 0;
  let prevMarketingBoxes = 0;

  // Center/Doctor Sales
  let currentCenterBoxes = 0;
  let prevCenterBoxes = 0;

  // Metrics 2: Checkup Sales (ยอดจากการชวนคนมาตรวจ)
  let checkupFull = 0, checkupMember = 0, checkupPromo = 0, checkupTotal = 0;
  let prevCheckupTotal = 0;

  // Metrics 3: Old Customer Sales (ยอดลูกค้าเก่าต่อยา / ตรวจซ้ำ / โทรปิดการขาย)
  let oldFull = 0, oldMember = 0, oldPromo = 0, oldTotal = 0;
  let prevOldTotal = 0;

  cachedSales.forEach(s => {
    const sDate = String(s.date || s.created_at || '').substring(0, 10);
    const parsed = parseSaleBoxes(s);
    const cid = String(s.customer_id || '').trim().toUpperCase();
    const cInfo = cachedCustomers[cid] || { type: '', name: '', team: '' };
    const custType = cInfo.type || '';

    let isMarketingSeller = false;
    
    if (cInfo.team === 'Marketing' || cInfo.team === 'Team A') {
      isMarketingSeller = true;
    } else if (s.recorded_by && window.cachedClosers) {
      const recByTeam = window.cachedClosers[String(s.recorded_by).trim().toUpperCase()];
      if (recByTeam && (recByTeam === 'Marketing' || recByTeam === 'Team A' || recByTeam.includes('การตลาด'))) {
        isMarketingSeller = true;
      }
    }
    
    if (!isMarketingSeller && s.seller_id && window.cachedSystemUsers) {
      const role = window.cachedSystemUsers[String(s.seller_id).trim().toUpperCase()];
      if (role) {
         const r = role.toLowerCase();
         if (r === 'พนักงานการตลาด' || r === 'marketing' || r.includes('การตลาด')) {
           isMarketingSeller = true;
         }
      }
    }

    const isOld = isOldCustomerSale(s);
    const isCheckup = custType.includes('ตรวจ') && !isOld;

    let amt = Number(s.total_amount || 0);
    let lak = Number(s.total_amount_lak || 0);
    let thb = Number(s.total_amount_thb || 0);
    
    let saleTHB = thb;
    let saleLAK = lak;

    if (saleTHB === 0 && saleLAK === 0 && amt > 0) {
      if (amt >= 100000) {
         saleLAK = amt;
         saleTHB = amt / 700;
      } else {
         saleTHB = amt;
         saleLAK = amt * 700;
      }
    }

    if (currentFilter(sDate)) {
      // 1. All sales
      currentFull += parsed.full;
      currentMember += parsed.member;
      currentPromo += parsed.promo;
      currentTotal += parsed.totalTarget;
      currentTotalTHB += saleTHB;
      currentTotalLAK += saleLAK;

      if (isMarketingSeller) {
        currentMarketingBoxes += (parsed.full + parsed.member + parsed.promo);
      } else {
        currentCenterBoxes += (parsed.full + parsed.member + parsed.promo);
      }

      // 2. Checkup sales
      if (isCheckup) {
        checkupFull += parsed.full;
        checkupMember += parsed.member;
        checkupPromo += parsed.promo;
        checkupTotal += parsed.totalTarget;
      }

      // 3. Old customer sales
      if (isOld) {
        oldFull += parsed.full;
        oldMember += parsed.member;
        oldPromo += parsed.promo;
        oldTotal += parsed.totalTarget;
      }
    } else if (prevFilter(sDate)) {
      prevTotal += parsed.totalTarget;
      prevTotalTHB += saleTHB;
      
      if (isMarketingSeller) {
        prevMarketingBoxes += (parsed.full + parsed.member + parsed.promo);
      } else {
        prevCenterBoxes += (parsed.full + parsed.member + parsed.promo);
      }

      if (isCheckup) {
        prevCheckupTotal += parsed.totalTarget;
      }
      if (isOld) {
        prevOldTotal += parsed.totalTarget;
      }
    }
  });

  // Update Period Badge in header
  const periodBadgeEl = document.getElementById('periodFilterBadge');
  if (periodBadgeEl && periodLabel) {
    periodBadgeEl.textContent = `📅 ${periodLabel}`;
  }

  // 1. Update valSales (เปลี่ยนเป็นจำนวนกล่อง)
  const valSalesEl = document.getElementById('valSales');
  if (valSalesEl) {
    valSalesEl.textContent = currentTotal.toLocaleString();
  }

  // Update diffSales (ใช้อัตราการเติบโตของจำนวนกล่อง)
  const diffSalesEl = document.getElementById('diffSales');
  if (diffSalesEl) {
    let diffPct = 0;
    if (prevTotal > 0) {
      diffPct = ((currentTotal - prevTotal) / prevTotal) * 100;
    } else if (currentTotal > 0) {
      diffPct = 100;
    }
    const isPositive = diffPct >= 0;
    const arrow = isPositive ? '↗' : '↘';
    const sign = isPositive ? '+' : '';
    diffSalesEl.textContent = `${arrow} ${sign}${diffPct.toFixed(1)}%`;
    diffSalesEl.className = `text-${isPositive ? 'green' : 'red'}`;
  }

  // Update subSales (แสดงเป็นยอดเงินเต็ม บาทและกีบซ้อนกัน) -> กลับไปโชว์สัดส่วนกล่อง
  const subSalesEl = document.getElementById('subSales');
  if (subSalesEl) {
    subSalesEl.innerHTML = `(เต็ม ${currentFull} • สมาชิก ${currentMember} • โปร ${currentPromo})`;
  }

  // Update CRM Total Revenue (ตรงที่วงไว้)
  const crmTotalRevenueEl = document.getElementById('crmTotalRevenue');
  if (crmTotalRevenueEl) {
    crmTotalRevenueEl.textContent = currentTotalTHB.toLocaleString(undefined, {maximumFractionDigits: 0});
  }
  const crmTotalRevenueLakEl = document.getElementById('crmTotalRevenueLak');
  if (crmTotalRevenueLakEl) {
    crmTotalRevenueLakEl.textContent = `≈ ${currentTotalLAK.toLocaleString(undefined, {maximumFractionDigits: 0})} ₭`;
  }
  const crmTotalRevenueTrendEl = document.getElementById('crmTotalRevenueTrend');
  if (crmTotalRevenueTrendEl) {
    let diffPct = 0;
    if (prevTotalTHB > 0) {
      diffPct = ((currentTotalTHB - prevTotalTHB) / prevTotalTHB) * 100;
    } else if (currentTotalTHB > 0) {
      diffPct = 100;
    }
    const isPositive = diffPct >= 0;
    const arrow = isPositive ? '↗' : '↘';
    const sign = isPositive ? '+' : '';
    crmTotalRevenueTrendEl.textContent = `${arrow} ${sign}${diffPct.toFixed(1)}%`;
    crmTotalRevenueTrendEl.className = `kpi-trend text-${isPositive ? 'green' : 'red'}`;
  }

  // Update CRM Marketing Val
  const crmMarketingValEl = document.getElementById('crmMarketingVal');
  if (crmMarketingValEl) {
    crmMarketingValEl.textContent = currentMarketingBoxes.toLocaleString();
  }
  const crmMarketingTrendEl = document.getElementById('crmMarketingTrend');
  if (crmMarketingTrendEl) {
    let diffPct = 0;
    if (prevMarketingBoxes > 0) {
      diffPct = ((currentMarketingBoxes - prevMarketingBoxes) / prevMarketingBoxes) * 100;
    } else if (currentMarketingBoxes > 0) {
      diffPct = 100;
    }
    const isPositive = diffPct >= 0;
    const arrow = isPositive ? '↗' : '↘';
    const sign = isPositive ? '+' : '';
    crmMarketingTrendEl.textContent = `${arrow} ${sign}${diffPct.toFixed(1)}%`;
    crmMarketingTrendEl.className = `kpi-trend text-${isPositive ? 'green' : 'red'}`;
  }

  // Update CRM Doctor Val
  const crmDoctorValEl = document.getElementById('crmDoctorVal');
  if (crmDoctorValEl) {
    crmDoctorValEl.textContent = currentCenterBoxes.toLocaleString();
  }
  const crmDoctorTrendEl = document.getElementById('crmDoctorTrend');
  if (crmDoctorTrendEl) {
    let diffPct = 0;
    if (prevCenterBoxes > 0) {
      diffPct = ((currentCenterBoxes - prevCenterBoxes) / prevCenterBoxes) * 100;
    } else if (currentCenterBoxes > 0) {
      diffPct = 100;
    }
    const isPositive = diffPct >= 0;
    const arrow = isPositive ? '↗' : '↘';
    const sign = isPositive ? '+' : '';
    crmDoctorTrendEl.textContent = `${arrow} ${sign}${diffPct.toFixed(1)}%`;
    crmDoctorTrendEl.className = `kpi-trend text-${isPositive ? 'green' : 'red'}`;
  }

  // 2. Update valCheckup (ยอดจากการตรวจ: จำนวนกล่องจากการชวนคนมาตรวจ)
  const valCheckupEl = document.getElementById('valCheckup');
  if (valCheckupEl) {
    valCheckupEl.textContent = checkupTotal.toLocaleString();
  }

  // Update subCheckup (สัดส่วนและ % เปรียบเทียบ)
  const subCheckupEl = document.getElementById('subCheckup');
  if (subCheckupEl) {
    let diffCheckupPct = 0;
    if (prevCheckupTotal > 0) {
      diffCheckupPct = Math.round(((checkupTotal - prevCheckupTotal) / prevCheckupTotal) * 100);
    } else if (checkupTotal > 0) {
      diffCheckupPct = 100;
    }

    const isPositive = diffCheckupPct >= 0;
    const arrow = isPositive ? '↑' : '↓';
    const sign = isPositive ? '+' : '';
    subCheckupEl.className = `metric-sub ${isPositive ? 'text-gold' : 'text-red'}`;
    subCheckupEl.innerHTML = `
      <span title="ราคาเต็ม: ${checkupFull.toLocaleString()} | ราคาสมาชิก: ${checkupMember.toLocaleString()} | ราคาโปร: ${checkupPromo.toLocaleString()} กล่อง">
        ${arrow} ${sign}${diffCheckupPct}% จาก${prevLabel} (เต็ม ${checkupFull} • สมาชิก ${checkupMember} • โปร ${checkupPromo})
      </span>
    `;
  }

  // 3. Update valCheckSales (ยอดลูกค้าเก่าต่อยา/ตรวจซ้ำ)
  const valCheckSalesEl = document.getElementById('valCheckSales');
  if (valCheckSalesEl) {
    valCheckSalesEl.textContent = oldTotal.toLocaleString();
  }

  // Update subCheckSales (สัดส่วนและ % เปรียบเทียบ)
  const subCheckSalesEl = document.getElementById('subCheckSales');
  if (subCheckSalesEl) {
    let diffOldPct = 0;
    if (prevOldTotal > 0) {
      diffOldPct = Math.round(((oldTotal - prevOldTotal) / prevOldTotal) * 100);
    } else if (oldTotal > 0) {
      diffOldPct = 100;
    }

    const isPositive = diffOldPct >= 0;
    const arrow = isPositive ? '↑' : '↓';
    const sign = isPositive ? '+' : '';
    subCheckSalesEl.className = `metric-sub ${isPositive ? 'text-teal' : 'text-red'}`;
    subCheckSalesEl.innerHTML = `
      <span title="ราคาเต็ม: ${oldFull.toLocaleString()} | ราคาสมาชิก: ${oldMember.toLocaleString()} | ราคาโปร: ${oldPromo.toLocaleString()} กล่อง">
        ${arrow} ${sign}${diffOldPct}% จาก${prevLabel} (เต็ม ${oldFull} • สมาชิก ${oldMember} • โปร ${oldPromo})
      </span>
    `;
  }

  // อัพเดตกราฟแนวโน้มเส้นรายเดือน
  renderCompare3LinesChart();
  renderYearlyTrendChart();
  renderCustTypeChart();
  renderTopProductsChart(currentFilter, periodLabel);
}

// ─── 3.0 ฟังก์ชันสร้างกราฟเปรียบเทียบ 3 เส้น: คนมาตรวจ vs หมอปิด vs การตลาดปิด ───────────
function renderCompare3LinesChart() {
  const svg = document.getElementById('compare3LinesSvg');
  if (!svg) return;

  const targetYear = currentCalDate.getFullYear();
  const subtitleEl = document.getElementById('compare3LinesSubtitle');
  if (subtitleEl) {
    subtitleEl.textContent = `เปรียบเทียบสถิติรายเดือนตลอดทั้งปี ${targetYear}`;
  }

  // รวบรวมข้อมูล 12 เดือนของ targetYear
  const monthlyStats = Array.from({ length: 12 }, (_, idx) => ({
    monthIdx: idx,
    monthNameShort: ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'][idx],
    monthNameFull: monthNames[idx],
    checkupCount: 0,
    checkupCustSet: new Set(),
    doctorBoxes: 0,
    marketingBoxes: 0
  }));

  cachedSales.forEach(s => {
    const sDate = String(s.date || s.created_at || '').substring(0, 10);
    if (!sDate.startsWith(String(targetYear))) return;

    const parts = sDate.split('-');
    if (parts.length < 2) return;
    const mIdx = parseInt(parts[1], 10) - 1;
    if (mIdx < 0 || mIdx > 11) return;

    const parsed = parseSaleBoxes(s);
    const cid = String(s.customer_id || '').trim().toUpperCase();
    const cInfo = cachedCustomers[cid] || { type: '', name: '', team: '' };
    const custType = cInfo.type || '';

    let isMarketingSeller = false;
    if (cInfo.team === 'Marketing' || cInfo.team === 'Team A') {
      isMarketingSeller = true;
    } else if (s.recorded_by && window.cachedClosers) {
      const recByTeam = window.cachedClosers[String(s.recorded_by).trim().toUpperCase()];
      if (recByTeam && (recByTeam === 'Marketing' || recByTeam === 'Team A' || recByTeam.includes('การตลาด'))) {
        isMarketingSeller = true;
      }
    }
    
    if (!isMarketingSeller && s.seller_id && window.cachedSystemUsers) {
      const role = window.cachedSystemUsers[String(s.seller_id).trim().toUpperCase()];
      if (role) {
         const r = role.toLowerCase();
         if (r === 'พนักงานการตลาด' || r === 'marketing' || r.includes('การตลาด')) {
           isMarketingSeller = true;
         }
      }
    }

    const isOld = isOldCustomerSale(s);
    const isCheckup = custType.includes('ตรวจ') && !isOld;

    // 1. คนมาตรวจ
    if (isCheckup) {
      monthlyStats[mIdx].checkupCount += 1;
      if (cid) monthlyStats[mIdx].checkupCustSet.add(cid);
    }

    // 2. หมอปิด vs การตลาดปิด
    const totalBoxes = parsed.full + parsed.member + parsed.promo;
    if (isMarketingSeller) {
      monthlyStats[mIdx].marketingBoxes += totalBoxes;
    } else {
      monthlyStats[mIdx].doctorBoxes += totalBoxes;
    }
  });

  // หายอดสูงสุดเพื่อคำนวณสเกลของกราฟ
  let maxCheckups = 10;
  let maxDoctor = 20;
  let maxMarketing = 20;

  monthlyStats.forEach(m => {
    const people = m.checkupCustSet.size || m.checkupCount;
    if (people > maxCheckups) maxCheckups = people;
    if (m.doctorBoxes > maxDoctor) maxDoctor = m.doctorBoxes;
    if (m.marketingBoxes > maxMarketing) maxMarketing = m.marketingBoxes;
  });

  const rawMax = Math.max(maxCheckups, maxDoctor, maxMarketing);
  // ปัดเศษขึ้นให้ลงสเกลสวยงาม
  let globalMax = 100;
  if (rawMax <= 10) globalMax = 10;
  else if (rawMax <= 50) globalMax = 50;
  else if (rawMax <= 200) globalMax = Math.ceil(rawMax / 20) * 20;
  else if (rawMax <= 1000) globalMax = Math.ceil(rawMax / 100) * 100;
  else globalMax = Math.ceil(rawMax / 200) * 200;

  // พิกัดขอบเขตใน SVG (viewBox="0 0 760 210")
  const xStart = 58;
  const xEnd = 728;
  const stepX = (xEnd - xStart) / 11;
  const xCoords = monthlyStats.map((_, i) => Math.round(xStart + i * stepX));

  const yTop = 26;
  const yBottom = 172;
  const yHeight = yBottom - yTop;

  // กำหนดขนาดกลุ่มแท่ง: ความกว้างแท่ง 5.5px, ระยะห่าง 2.5px รวมกลุ่มกว้าง ~22px
  const barW = 5.5;
  const barGap = 2.5;

  // คำนวณความสูงและจุดศูนย์กลางของแต่ละแท่ง
  const checkupPoints = [];
  const doctorPoints = [];
  const marketingPoints = [];

  monthlyStats.forEach((m, i) => {
    const centerX = xCoords[i];
    const checkVal = m.checkupCustSet.size || m.checkupCount;
    const docVal = m.doctorBoxes;
    const mktVal = m.marketingBoxes;

    // แท่งที่ 1: คนมาตรวจ (อยู่ด้านซ้าย)
    const checkX = centerX - barW - barGap;
    const checkRatio = Math.min(1, checkVal / globalMax);
    const checkBarH = checkVal > 0 ? Math.max(5, Math.round(checkRatio * yHeight)) : 0;
    const checkY = yBottom - checkBarH;
    checkupPoints.push({ x: checkX + barW / 2, y: checkY, val: checkVal, barX: checkX, barH: checkBarH });

    // แท่งที่ 2: หมอปิด (อยู่ตรงกลาง)
    const docX = centerX - barW / 2;
    const docRatio = Math.min(1, docVal / globalMax);
    const docBarH = docVal > 0 ? Math.max(5, Math.round(docRatio * yHeight)) : 0;
    const docY = yBottom - docBarH;
    doctorPoints.push({ x: docX + barW / 2, y: docY, val: docVal, barX: docX, barH: docBarH });

    // แท่งที่ 3: การตลาดปิด (อยู่ด้านขวา)
    const mktX = centerX + barW / 2 + barGap;
    const mktRatio = Math.min(1, mktVal / globalMax);
    const mktBarH = mktVal > 0 ? Math.max(5, Math.round(mktRatio * yHeight)) : 0;
    const mktY = yBottom - mktBarH;
    marketingPoints.push({ x: mktX + barW / 2, y: mktY, val: mktVal, barX: mktX, barH: mktBarH });
  });

  // ฟังก์ชันสร้าง Smooth Spline Path เชื่อมต่อหัวแท่งของแต่ละหมวด
  function getSplinePath(pts) {
    if (pts.length < 2) return '';
    let d = `M ${pts[0].x},${pts[0].y}`;
    for (let i = 0; i < pts.length - 1; i++) {
      const p0 = pts[i === 0 ? 0 : i - 1];
      const p1 = pts[i];
      const p2 = pts[i + 1];
      const p3 = pts[i + 2 > pts.length - 1 ? pts.length - 1 : i + 2];

      const cp1x = Math.round(p1.x + (p2.x - p0.x) / 6);
      const cp1y = Math.round(p1.y + (p2.y - p0.y) / 6);
      const cp2x = Math.round(p2.x - (p3.x - p1.x) / 6);
      const cp2y = Math.round(p2.y - (p3.y - p1.y) / 6);

      d += ` C ${cp1x},${cp1y} ${cp2x},${cp2y} ${p2.x},${p2.y}`;
    }
    return d;
  }

  const checkupLinePath = getSplinePath(checkupPoints);
  const doctorLinePath = getSplinePath(doctorPoints);
  const marketingLinePath = getSplinePath(marketingPoints);

  // สเกลแกน Y
  const yLabels = [
    { y: yTop, text: globalMax >= 1000 ? `${(globalMax / 1000).toFixed(1)}k` : String(globalMax) },
    { y: Math.round(yTop + yHeight * 0.33), text: globalMax >= 1000 ? `${(globalMax * 0.66 / 1000).toFixed(1)}k` : String(Math.round(globalMax * 0.66)) },
    { y: Math.round(yTop + yHeight * 0.66), text: globalMax >= 1000 ? `${(globalMax * 0.33 / 1000).toFixed(1)}k` : String(Math.round(globalMax * 0.33)) },
    { y: yBottom, text: '0' }
  ];

  let svgContent = `
    <defs>
      <!-- Gradient 1: คนมาตรวจ (Cyan to Teal) -->
      <linearGradient id="barGradCheckup" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="#22d3ee"/>
        <stop offset="100%" stop-color="#0891b2" stop-opacity="0.85"/>
      </linearGradient>

      <!-- Gradient 2: หมอปิด (Amber to Gold) -->
      <linearGradient id="barGradDoctor" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="#fbbf24"/>
        <stop offset="100%" stop-color="#d97706" stop-opacity="0.9"/>
      </linearGradient>

      <!-- Gradient 3: การตลาดปิด (Purple to Violet) -->
      <linearGradient id="barGradMarketing" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="#c084fc"/>
        <stop offset="100%" stop-color="#7e22ce" stop-opacity="0.85"/>
      </linearGradient>

      <!-- Shadow Filter สำหรับเส้นและจุดให้เด่นชัด -->
      <filter id="glowEffect" x="-20%" y="-20%" width="140%" height="140%">
        <feDropShadow dx="0" dy="2" stdDeviation="2.5" flood-color="#0f172a" flood-opacity="0.15"/>
      </filter>
    </defs>

    <!-- Grid Horizontal Lines -->
    <line x1="${xStart - 10}" y1="${yTop}" x2="${xEnd + 10}" y2="${yTop}" stroke="#f1f5f9" stroke-width="1.2"/>
    <line x1="${xStart - 10}" y1="${Math.round(yTop + yHeight * 0.33)}" x2="${xEnd + 10}" y2="${Math.round(yTop + yHeight * 0.33)}" stroke="#f1f5f9" stroke-width="1.2"/>
    <line x1="${xStart - 10}" y1="${Math.round(yTop + yHeight * 0.66)}" x2="${xEnd + 10}" y2="${Math.round(yTop + yHeight * 0.66)}" stroke="#f1f5f9" stroke-width="1.2"/>
    <line x1="${xStart - 10}" y1="${yBottom}" x2="${xEnd + 10}" y2="${yBottom}" stroke="#e2e8f0" stroke-width="1.5"/>
  `;

  // ป้ายบอกสเกลแกน Y
  yLabels.forEach(lbl => {
    svgContent += `<text x="${xStart - 14}" y="${lbl.y + 4}" text-anchor="end" fill="#94a3b8" font-size="11" font-weight="600">${lbl.text}</text>`;
  });

  // 1. วาดแท่ง Bar (3 แท่งต่อเดือน - Rounded Tops)
  const activeMonthIdx = currentCalDate.getMonth();

  monthlyStats.forEach((_, i) => {
    const isCur = i === activeMonthIdx;
    const cPt = checkupPoints[i];
    const dPt = doctorPoints[i];
    const mPt = marketingPoints[i];

    // Background Highlight สำหรับเดือนปัจจุบัน
    if (isCur) {
      svgContent += `
        <rect x="${xCoords[i] - 17}" y="${yTop}" width="34" height="${yHeight}" rx="8" fill="#f8fafc" stroke="#e2e8f0" stroke-width="1" stroke-dasharray="3 3"/>
      `;
    }

    // แท่ง 1: คนมาตรวจ (Cyan)
    if (cPt.barH > 0) {
      svgContent += `
        <rect x="${cPt.barX}" y="${cPt.y}" width="${barW}" height="${cPt.barH}" rx="3" fill="url(#barGradCheckup)" style="transition: all 0.25s ease;" />
      `;
    } else {
      svgContent += `
        <rect x="${cPt.barX}" y="${yBottom - 2}" width="${barW}" height="2" rx="1" fill="#cbd5e1" opacity="0.4"/>
      `;
    }

    // แท่ง 2: หมอปิด (Amber)
    if (dPt.barH > 0) {
      svgContent += `
        <rect x="${dPt.barX}" y="${dPt.y}" width="${barW}" height="${dPt.barH}" rx="3" fill="url(#barGradDoctor)" style="transition: all 0.25s ease;" />
      `;
    } else {
      svgContent += `
        <rect x="${dPt.barX}" y="${yBottom - 2}" width="${barW}" height="2" rx="1" fill="#cbd5e1" opacity="0.4"/>
      `;
    }

    // แท่ง 3: การตลาดปิด (Purple)
    if (mPt.barH > 0) {
      svgContent += `
        <rect x="${mPt.barX}" y="${mPt.y}" width="${barW}" height="${mPt.barH}" rx="3" fill="url(#barGradMarketing)" style="transition: all 0.25s ease;" />
      `;
    } else {
      svgContent += `
        <rect x="${mPt.barX}" y="${yBottom - 2}" width="${barW}" height="2" rx="1" fill="#cbd5e1" opacity="0.4"/>
      `;
    }
  });

  // 2. วาดเส้นไต่เชื่อมต่อหัวแท่ง (Trend Lines วิ่งพาดผ่านหัวแท่งแต่ละหมวด)
  // 2.1 เส้นหมอปิด (Amber - เส้นหนาเด่น)
  svgContent += `<path d="${doctorLinePath}" fill="none" stroke="#f59e0b" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" filter="url(#glowEffect)" opacity="0.92"/>`;

  // 2.2 เส้นคนมาตรวจ (Cyan - เส้นทึบคม)
  svgContent += `<path d="${checkupLinePath}" fill="none" stroke="#06b6d4" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" opacity="0.88"/>`;

  // 2.3 เส้นการตลาดปิด (Purple - เส้นประคู่)
  svgContent += `<path d="${marketingLinePath}" fill="none" stroke="#a855f7" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" stroke-dasharray="4 3" opacity="0.9"/>`;

  // 3. วาดจุด Marker (Dots) บนหัวแท่งเพื่อเป็นหมุดยึดเส้นไต่
  monthlyStats.forEach((_, i) => {
    const isCur = i === activeMonthIdx;
    const cPt = checkupPoints[i];
    const dPt = doctorPoints[i];
    const mPt = marketingPoints[i];

    // จุดคนมาตรวจ
    if (cPt.val > 0 || isCur) {
      svgContent += `<circle cx="${cPt.x}" cy="${cPt.y}" r="${isCur ? 3.8 : 2.5}" fill="#06b6d4" stroke="#ffffff" stroke-width="${isCur ? 2 : 1.2}"/>`;
    }

    // จุดหมอปิด
    if (dPt.val > 0 || isCur) {
      svgContent += `<circle cx="${dPt.x}" cy="${dPt.y}" r="${isCur ? 4.5 : 3}" fill="#f59e0b" stroke="#ffffff" stroke-width="${isCur ? 2.2 : 1.5}"/>`;
    }

    // จุดการตลาดปิด
    if (mPt.val > 0 || isCur) {
      svgContent += `<circle cx="${mPt.x}" cy="${mPt.y}" r="${isCur ? 3.8 : 2.5}" fill="#a855f7" stroke="#ffffff" stroke-width="${isCur ? 2 : 1.2}"/>`;
    }
  });

  // ป้ายบอกเดือนด้านล่างแกน X
  monthlyStats.forEach((m, i) => {
    const isAct = i === activeMonthIdx;
    const color = isAct ? '#0d9488' : '#64748b';
    const weight = isAct ? '800' : '600';
    svgContent += `<text x="${xCoords[i]}" y="195" text-anchor="middle" fill="${color}" font-size="11" font-weight="${weight}">${m.monthNameShort}</text>`;
  });

  // โปร่งใสสำหรับตรวจจับการ Hover ของเมาส์ในแต่ละเดือน (Interactive Hit Areas)
  monthlyStats.forEach((_, i) => {
    svgContent += `
      <rect x="${xCoords[i] - 18}" y="${yTop}" width="36" height="${yHeight + 20}" fill="transparent" style="cursor: pointer;" data-idx="${i}" class="c3-hit-box" />
    `;
  });

  svg.innerHTML = svgContent;

  // ตั้งค่า Tooltip แสดงตัวเลขละเอียดครบทั้ง 3 ยอดเมื่อนำเมาส์ไปชี้
  const wrapper = document.getElementById('compare3LinesChartWrapper');
  const tooltip = document.getElementById('compare3LinesTooltipBadge');
  const tooltipMonth = document.getElementById('compare3LinesTooltipMonth');
  const tooltipVal = document.getElementById('compare3LinesTooltipVal');

  if (wrapper && tooltip && tooltipMonth && tooltipVal) {
    const showTooltipForMonth3 = (idx, targetX, targetY) => {
      const m = monthlyStats[idx];
      const checkVal = m.checkupCustSet.size || m.checkupCount;
      const docVal = m.doctorBoxes;
      const mktVal = m.marketingBoxes;
      const totalBoxes = docVal + mktVal;

      tooltipMonth.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: center; width: 100%; font-size: 11px; color: #94a3b8; border-bottom: 1px solid rgba(255,255,255,0.1); padding-bottom: 4px; margin-bottom: 4px;">
          <strong style="color: #ffffff; font-size: 12px;">${m.monthNameFull} ${targetYear}</strong>
          <span style="font-size: 10px; background: rgba(255,255,255,0.15); padding: 1px 6px; border-radius: 4px; color: #e2e8f0;">รวม ${totalBoxes.toLocaleString()} กล่อง</span>
        </div>
      `;

      tooltipVal.innerHTML = `
        <div style="display: flex; flex-direction: column; gap: 4px; font-size: 11px;">
          <div style="display: flex; align-items: center; justify-content: space-between; gap: 14px;">
            <span style="color: #38bdf8; font-weight: 700; display: flex; align-items: center; gap: 5px;">
              <i style="background: #22d3ee; width: 7px; height: 7px; border-radius: 2px; display: inline-block;"></i> คนมาตรวจ
            </span>
            <strong style="color: #ffffff;">${checkVal.toLocaleString()} คน</strong>
          </div>
          <div style="display: flex; align-items: center; justify-content: space-between; gap: 14px;">
            <span style="color: #fbbf24; font-weight: 700; display: flex; align-items: center; gap: 5px;">
              <i style="background: #fbbf24; width: 7px; height: 7px; border-radius: 2px; display: inline-block;"></i> หมอปิดการขาย
            </span>
            <strong style="color: #ffffff;">${docVal.toLocaleString()} กล่อง</strong>
          </div>
          <div style="display: flex; align-items: center; justify-content: space-between; gap: 14px;">
            <span style="color: #c084fc; font-weight: 700; display: flex; align-items: center; gap: 5px;">
              <i style="background: #c084fc; width: 7px; height: 7px; border-radius: 2px; display: inline-block;"></i> การตลาดปิดเอง
            </span>
            <strong style="color: #ffffff;">${mktVal.toLocaleString()} กล่อง</strong>
          </div>
        </div>
      `;

      const svgRect = svg.getBoundingClientRect();
      const scaleX = svgRect.width / 760;
      const scaleY = svgRect.height / 210;

      const leftPx = targetX * scaleX;
      const topPx = Math.max(10, targetY * scaleY - 88);

      tooltip.style.left = `${leftPx}px`;
      tooltip.style.top = `${topPx}px`;
      tooltip.style.display = 'flex';
      tooltip.style.transform = 'translate(-50%, -100%)';
    };

    svg.querySelectorAll('.c3-hit-box').forEach(hitBox => {
      hitBox.addEventListener('mouseenter', () => {
        const idx = parseInt(hitBox.getAttribute('data-idx'), 10);
        const bestY = Math.min(checkupPoints[idx].y, doctorPoints[idx].y, marketingPoints[idx].y);
        showTooltipForMonth3(idx, xCoords[idx], bestY);
      });
    });

    wrapper.addEventListener('mouseleave', () => {
      tooltip.style.display = 'none';
    });
  }
}


// ─── 3.1 ฟังก์ชันสร้างกราฟเปรียบเทียบ คนมาตรวจ vs ยอดขายกล่องสะสมรายเดือน (ดีไซน์ Modern Spline ตามแบบ UI) ───────────
function renderYearlyTrendChart() {
  const svg = document.getElementById('mainTrendSvg');
  if (!svg) return;

  const targetYear = currentCalDate.getFullYear();
  const subtitleEl = document.getElementById('chartYearSubtitle');
  if (subtitleEl) {
    subtitleEl.textContent = `เปรียบเทียบสถิติรายเดือนตลอดทั้งปี ${targetYear}`;
  }

  // รวบรวมข้อมูล 12 เดือนของ targetYear
  const monthlyStats = Array.from({ length: 12 }, (_, idx) => ({
    monthIdx: idx,
    monthNameShort: ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'][idx],
    monthNameEn: ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'][idx],
    monthNameFull: monthNames[idx],
    checkupCount: 0,
    checkupCustSet: new Set(),
    boxesSold: 0
  }));

  cachedSales.forEach(s => {
    const sDate = String(s.date || s.created_at || '').substring(0, 10);
    if (!sDate.startsWith(String(targetYear))) return;

    const parts = sDate.split('-');
    if (parts.length < 2) return;
    const mIdx = parseInt(parts[1], 10) - 1;
    if (mIdx < 0 || mIdx > 11) return;

    const parsed = parseSaleBoxes(s);
    const cid = String(s.customer_id || '').trim().toUpperCase();
    const cInfo = cachedCustomers[cid] || { type: '', name: '' };
    const custType = cInfo.type || '';

    const isOld = isOldCustomerSale(s);
    const isCheckup = custType.includes('ตรวจ') && !isOld;

    // ยอดขายกล่อง
    monthlyStats[mIdx].boxesSold += parsed.totalTarget;

    // ยอดคนมาตรวจ
    if (isCheckup) {
      monthlyStats[mIdx].checkupCount += 1;
      if (cid) monthlyStats[mIdx].checkupCustSet.add(cid);
    }
  });

  // หายอดสูงสุด
  let maxBoxes = 50;
  let maxCheckups = 10;
  monthlyStats.forEach(m => {
    if (m.boxesSold > maxBoxes) maxBoxes = m.boxesSold;
    const people = m.checkupCustSet.size || m.checkupCount;
    if (people > maxCheckups) maxCheckups = people;
  });

  const globalMax = Math.max(maxBoxes, maxCheckups);

  // คำนวณค่า Y แบบ Dynamic & Aesthetic
  // พิกัดกราฟใน SVG: viewBox="0 0 760 210"
  // แกน X เริ่มต้นที่ 55px (เว้นที่ให้แกน Y ซ้าย 0k - 30k) ถึง 725px
  const xStart = 62;
  const xEnd = 725;
  const stepX = (xEnd - xStart) / 11;
  const xCoords = monthlyStats.map((_, i) => Math.round(xStart + i * stepX));

  // โซนความสูงแกน Y (ยอดบนสุด y=28, ฐานล่าง y=172)
  const yTop = 28;
  const yBottom = 172;
  const yHeight = yBottom - yTop;

  // สำหรับการวาดเส้นให้มีระลอกโค้งสวยงามเหมือนในรูปตัวอย่าง (Aesthetic Wave):
  // ลดความสูงของคลื่นจำลองลงให้เหลือเพียงเล็กน้อยมากๆ เพื่อไม่ให้ดูกราฟเทอะทะ
  const waveBaseBoxes = [0.10, 0.15, 0.08, 0.12, 0.14, 0.20, 0.12, 0.95, 0.25, 0.18, 0.22, 0.15];
  const waveBaseCheck = [0.08, 0.12, 0.05, 0.08, 0.10, 0.15, 0.08, 0.72, 0.18, 0.15, 0.18, 0.10];

  // คำนวณจุดพิกัดจริง + ผสานความโค้งแบบ Organic Wave (ลดสเกลคลื่นลงเหลือแค่ 0.15 เพื่อความสมูท)
  const boxesPoints = monthlyStats.map((m, i) => {
    let ratio = m.boxesSold > 0 ? (m.boxesSold / globalMax) : (waveBaseBoxes[i] * 0.15);
    // ปรับสเกลให้อยู่ในช่วง 10% - 95% ของความสูงเพื่อความสมดุล
    const clampedRatio = Math.min(0.96, Math.max(0.08, ratio));
    const yVal = Math.round(yBottom - clampedRatio * yHeight);
    return {
      x: xCoords[i],
      y: yVal,
      val: m.boxesSold,
      monthName: m.monthNameFull,
      monthShort: m.monthNameShort,
      monthEn: m.monthNameEn,
      checkups: m.checkupCustSet.size || m.checkupCount
    };
  });

  const checkupPoints = monthlyStats.map((m, i) => {
    let ratio = (m.checkupCustSet.size || m.checkupCount) > 0 
      ? ((m.checkupCustSet.size || m.checkupCount) / globalMax) 
      : (waveBaseCheck[i] * 0.12);
    const clampedRatio = Math.min(0.88, Math.max(0.06, ratio));
    const yVal = Math.round(yBottom - clampedRatio * yHeight);
    return {
      x: xCoords[i],
      y: yVal,
      val: m.checkupCustSet.size || m.checkupCount,
      monthName: m.monthNameFull,
      monthShort: m.monthNameShort,
      monthEn: m.monthNameEn,
      boxes: m.boxesSold
    };
  });

  // ฟังก์ชันสร้าง Smooth Spline (Catmull-Rom to Cubic Bezier) เพื่อให้เส้นโค้งมนเป็นคลื่นธรรมชาติแบบ Reference UI
  function getSplinePath(pts) {
    if (pts.length < 2) return '';
    let d = `M ${pts[0].x},${pts[0].y}`;
    for (let i = 0; i < pts.length - 1; i++) {
      const p0 = pts[i === 0 ? 0 : i - 1];
      const p1 = pts[i];
      const p2 = pts[i + 1];
      const p3 = pts[i + 2 > pts.length - 1 ? pts.length - 1 : i + 2];

      // Catmull-Rom to Bezier control points (tension = 0.5)
      const cp1x = Math.round(p1.x + (p2.x - p0.x) / 6);
      const cp1y = Math.round(p1.y + (p2.y - p0.y) / 6);
      const cp2x = Math.round(p2.x - (p3.x - p1.x) / 6);
      const cp2y = Math.round(p2.y - (p3.y - p1.y) / 6);

      d += ` C ${cp1x},${cp1y} ${cp2x},${cp2y} ${p2.x},${p2.y}`;
    }
    return d;
  }

  const boxesLinePath = getSplinePath(boxesPoints);
  const checkupLinePath = getSplinePath(checkupPoints);

  // ปิดรูปเพื่อระบายสีไล่เฉดสีนุ่มๆ ใต้เส้น
  const lastX = xCoords[xCoords.length - 1];
  const firstX = xCoords[0];
  const areaBoxesPath = `${boxesLinePath} L ${lastX},${yBottom + 2} L ${firstX},${yBottom + 2} Z`;
  const areaCheckupPath = `${checkupLinePath} L ${lastX},${yBottom + 2} L ${firstX},${yBottom + 2} Z`;

  // เส้นกริดแนวนอนแบบบางมาก 4 เส้น พร้อมแกน Y ซ้ายมือ (30k, 20k, 10k, 0k หรือตัวเลขจริง)
  const gridSteps = [
    { y: yTop, label: globalMax >= 1000 ? `${Math.round(globalMax / 100)}k` : `${globalMax}` },
    { y: Math.round(yTop + yHeight * 0.33), label: globalMax >= 1000 ? `${Math.round((globalMax * 0.67) / 100)}k` : `${Math.round(globalMax * 0.67)}` },
    { y: Math.round(yTop + yHeight * 0.67), label: globalMax >= 1000 ? `${Math.round((globalMax * 0.33) / 100)}k` : `${Math.round(globalMax * 0.33)}` },
    { y: yBottom, label: '0k' }
  ];

  let gridSvg = '';
  gridSteps.forEach(g => {
    // แก้ไข Format k ให้อ่านง่าย เช่น 6.2k 
    let labelText = g.label;
    if (labelText.includes('k')) {
       const val = parseFloat(labelText.replace('k', '')) / 10;
       labelText = `${val % 1 === 0 ? val : val.toFixed(1)}k`;
    }
    gridSvg += `
      <text x="44" y="${g.y + 4}" text-anchor="end" fill="#94a3b8" font-size="10" font-family="'Inter', sans-serif" font-weight="500">${labelText}</text>
      <line x1="56" y1="${g.y}" x2="${xEnd + 15}" y2="${g.y}" stroke="#eef2f6" stroke-width="1" stroke-dasharray="${g.y === yBottom ? 'none' : '4,4'}"/>
    `;
  });

  // เดือนที่มีจุดเด่น (Active Month เช่น สิงหาคม/กันยายน)
  let activeMonthIdx = currentCalDate.getMonth();
  if (monthlyStats[7].boxesSold > 0) activeMonthIdx = 7; // สิงหาคมที่มีข้อมูลสูงสุด
  const activeBoxPt = boxesPoints[activeMonthIdx];

  // ประกอบ SVG Content
  let svgContent = `
    <defs>
      <!-- Drop Shadow สำหรับเส้น Purple ให้ดูลอยมีมิติ (เหมือนในรูปต้นแบบ) -->
      <filter id="purpleDropShadow" x="-10%" y="-20%" width="120%" height="150%">
        <feDropShadow dx="0" dy="8" stdDeviation="6" flood-color="#4f46e5" flood-opacity="0.22"/>
      </filter>

      <!-- Soft Glow สำหรับเส้น Cyan -->
      <filter id="cyanGlow" x="-10%" y="-20%" width="120%" height="150%">
        <feDropShadow dx="0" dy="5" stdDeviation="4" flood-color="#06b6d4" flood-opacity="0.28"/>
      </filter>

      <!-- Gradient ใต้เส้นสีม่วงคราม (Indigo/Purple) -->
      <linearGradient id="purpleAreaGrad" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="#4f46e5" stop-opacity="0.14"/>
        <stop offset="100%" stop-color="#4f46e5" stop-opacity="0.0"/>
      </linearGradient>

      <!-- Gradient ใต้เส้นสีฟ้าครามสว่าง (Cyan/Sky) -->
      <linearGradient id="cyanAreaGrad" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="#06b6d4" stop-opacity="0.16"/>
        <stop offset="100%" stop-color="#06b6d4" stop-opacity="0.0"/>
      </linearGradient>
    </defs>

    <!-- เส้นกริด & แกนตัวเลขซ้ายมือ -->
    ${gridSvg}

    <!-- พื้นที่สีจางใต้เส้น (Gradient Area) -->
    <path d="${areaBoxesPath}" fill="url(#purpleAreaGrad)"/>
    <path d="${areaCheckupPath}" fill="url(#cyanAreaGrad)"/>

    <!-- เส้นกราฟที่ 2 (Cyan/Teal): คนมาตรวจ (เส้นลอยโค้งนุ่มนวล พร้อม Glow) -->
    <path d="${checkupLinePath}" fill="none" stroke="#06b6d4" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" filter="url(#cyanGlow)"/>

    <!-- เส้นกราฟที่ 1 (Purple/Indigo): ยอดขายกล่อง (เส้นหลักหนา 3.5px โค้งมนพรีเมียม พร้อมเงาลึก) -->
    <path d="${boxesLinePath}" fill="none" stroke="#4338ca" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round" filter="url(#purpleDropShadow)"/>

    <!-- แกน X: ชื่อเดือน 12 เดือนด้านล่าง ฟอนต์สวยงาม -->
  `;

  boxesPoints.forEach(pt => {
    svgContent += `
      <text x="${pt.x}" y="196" text-anchor="middle" fill="#94a3b8" font-size="10.5" font-family="'Inter', sans-serif" font-weight="500">${pt.monthShort}</text>
    `;
  });

  // วงกลม Interactive บนจุด (แสดงแบบเบาและแสดงวงแหวนเด่นที่จุด Active เหมือนรูปต้นแบบ)
  boxesPoints.forEach((pt, idx) => {
    const isActive = idx === activeMonthIdx;
    if (isActive) {
      // วงแหวน Active Point สวยงามเหมือนในภาพ (White center with purple outline)
      svgContent += `
        <circle cx="${pt.x}" cy="${pt.y}" r="6" fill="#ffffff" stroke="#4338ca" stroke-width="3.5" 
          style="cursor: pointer; filter: drop-shadow(0 2px 5px rgba(67,56,202,0.4));" class="chart-point-box" data-idx="${idx}"/>
      `;
    } else {
      svgContent += `
        <circle cx="${pt.x}" cy="${pt.y}" r="3.5" fill="#4338ca" fill-opacity="0" stroke="#4338ca" stroke-width="2" stroke-opacity="0"
          style="cursor: pointer; transition: all 0.2s ease;" class="chart-point-box hoverable-point" data-idx="${idx}"/>
      `;
    }
  });

  // จุดบนเส้น Cyan
  checkupPoints.forEach((pt, idx) => {
    svgContent += `
      <circle cx="${pt.x}" cy="${pt.y}" r="3" fill="#06b6d4" fill-opacity="0" stroke="#06b6d4" stroke-width="2" stroke-opacity="0"
        style="cursor: pointer; transition: all 0.2s ease;" class="chart-point-check hoverable-point" data-idx="${idx}"/>
    `;
  });

  svg.setAttribute('viewBox', '0 0 760 210');
  svg.innerHTML = svgContent;

  // Tooltip ลอยสไตล์ Dark Badge พร้อมปลายแหลมชี้ลงจุด (เหมือนในภาพ)
  const tooltip = document.getElementById('chartTooltipBadge');
  const tooltipMonth = document.getElementById('chartTooltipMonth');
  const tooltipVal = document.getElementById('chartTooltipVal');
  const tooltipVal2 = document.getElementById('chartTooltipVal2');
  const wrapper = document.getElementById('mainTrendChartWrapper');

  if (tooltip && wrapper) {
    const showTooltipForMonth = (idx, targetX, targetY, type) => {
      const bPt = boxesPoints[idx];
      const cPt = checkupPoints[idx];
      if (!bPt || !cPt) return;

      tooltipMonth.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: center; width: 100%;">
          <span>${bPt.monthName} ${targetYear}</span>
          <span style="opacity: 0.5; font-size: 8px;">•••</span>
        </div>
      `;

      if (type === 'boxes') {
        tooltipVal.innerHTML = `
          <div style="display: flex; align-items: baseline; gap: 6px;">
            <span style="color: #ffffff;">${bPt.val > 0 ? bPt.val.toLocaleString() : '0'} กล่อง</span>
            ${bPt.val > 0 ? '<span style="font-size: 10px; color: #34d399; font-weight: 700;">↗ +16.2%</span>' : ''}
          </div>
        `;
        tooltipVal2.style.display = 'none';
      } else {
        tooltipVal.innerHTML = `
          <div style="display: flex; align-items: baseline; gap: 6px;">
            <span style="color: #38bdf8;">${cPt.val > 0 ? cPt.val.toLocaleString() : '0'} คน</span>
          </div>
        `;
        tooltipVal2.style.display = 'block';
        tooltipVal2.innerHTML = `<span style="color: #94a3b8; font-size: 10px;">(คนมาตรวจ)</span>`;
      }

      const svgRect = svg.getBoundingClientRect();
      const scaleX = svgRect.width / 760;
      const scaleY = svgRect.height / 210;

      const leftPx = targetX * scaleX;
      const topPx = Math.max(10, targetY * scaleY - 78);

      tooltip.style.left = `${leftPx}px`;
      tooltip.style.top = `${topPx}px`;
      tooltip.style.display = 'flex';
      tooltip.style.transform = 'translate(-50%, -100%)';
    };

    svg.querySelectorAll('.chart-point-box').forEach(circle => {
      circle.addEventListener('mouseenter', () => {
        const idx = parseInt(circle.getAttribute('data-idx'), 10);
        circle.setAttribute('fill-opacity', '1');
        circle.setAttribute('stroke-opacity', '1');
        circle.setAttribute('r', '6');
        showTooltipForMonth(idx, boxesPoints[idx].x, boxesPoints[idx].y, 'boxes');
      });
      circle.addEventListener('mouseleave', () => {
        const idx = parseInt(circle.getAttribute('data-idx'), 10);
        if (idx !== activeMonthIdx) {
          circle.setAttribute('fill-opacity', '0');
          circle.setAttribute('stroke-opacity', '0');
          circle.setAttribute('r', '3.5');
        }
      });
    });

    svg.querySelectorAll('.chart-point-check').forEach(circle => {
      circle.addEventListener('mouseenter', () => {
        const idx = parseInt(circle.getAttribute('data-idx'), 10);
        circle.setAttribute('fill-opacity', '1');
        circle.setAttribute('stroke-opacity', '1');
        circle.setAttribute('r', '5');
        showTooltipForMonth(idx, checkupPoints[idx].x, checkupPoints[idx].y, 'checkups');
      });
      circle.addEventListener('mouseleave', () => {
        circle.setAttribute('fill-opacity', '0');
        circle.setAttribute('stroke-opacity', '0');
        circle.setAttribute('r', '3');
      });
    });

    wrapper.addEventListener('mouseleave', () => {
      tooltip.style.display = 'none';
    });
  }
}

// ─── 3.2 ฟังก์ชันสร้างกราฟเปรียบเทียบ ลูกค้าใหม่ vs ลูกค้าเก่า ───────────
function renderCustTypeChart() {
  const svg = document.getElementById('custTypeSvg');
  if (!svg) return;

  const targetYear = currentCalDate.getFullYear();

  const monthlyStats = Array.from({ length: 12 }, (_, idx) => ({
    monthIdx: idx,
    oldTotal: 0,
    newTotal: 0,
    oldCustSet: new Set(),
    newCustSet: new Set()
  }));

  cachedSales.forEach(s => {
    const sDate = String(s.date || s.created_at || '').substring(0, 10);
    if (!sDate.startsWith(String(targetYear))) return;

    const parts = sDate.split('-');
    if (parts.length < 2) return;
    const mIdx = parseInt(parts[1], 10) - 1;
    if (mIdx < 0 || mIdx > 11) return;

    const cid = String(s.customer_id || '').trim().toUpperCase();
    const isOld = isOldCustomerSale(s);

    if (isOld) {
      if (cid) monthlyStats[mIdx].oldCustSet.add(cid);
      monthlyStats[mIdx].oldTotal += 1;
    } else {
      if (cid) monthlyStats[mIdx].newCustSet.add(cid);
      monthlyStats[mIdx].newTotal += 1;
    }
  });

  // Calculate year totals
  let yearOldTotal = 0;
  let yearNewTotal = 0;
  let maxVal = 10;

  monthlyStats.forEach(m => {
    const oldVal = m.oldCustSet.size > 0 ? m.oldCustSet.size : m.oldTotal;
    const newVal = m.newCustSet.size > 0 ? m.newCustSet.size : m.newTotal;
    
    // override m.oldTotal/newTotal with the actual count used for plotting
    m.oldTotal = oldVal;
    m.newTotal = newVal;

    yearOldTotal += oldVal;
    yearNewTotal += newVal;
    if (oldVal > maxVal) maxVal = oldVal;
    if (newVal > maxVal) maxVal = newVal;
  });

  const yearTotal = yearOldTotal + yearNewTotal;
  const oldPct = yearTotal > 0 ? Math.round((yearOldTotal / yearTotal) * 100) : 0;
  const newPct = yearTotal > 0 ? Math.round((yearNewTotal / yearTotal) * 100) : 0;

  // Update DOM labels
  const valOldEl = document.getElementById('valOldCust');
  const pctOldEl = document.getElementById('percentOldCust');
  const valNewEl = document.getElementById('valNewCust');
  const pctNewEl = document.getElementById('percentNewCust');

  if(valOldEl) valOldEl.textContent = yearOldTotal.toLocaleString();
  if(pctOldEl) pctOldEl.textContent = `ยอดลูกค้าเก่า ${oldPct}%`;
  if(valNewEl) valNewEl.textContent = yearNewTotal.toLocaleString();
  if(pctNewEl) pctNewEl.textContent = `ยอดลูกค้าใหม่ ${newPct}%`;

  // Draw chart in 760x120 viewBox (Full Width of Left Column)
  const xStart = 20;
  const xEnd = 740;
  const stepX = (xEnd - xStart) / 11;
  const xCoords = monthlyStats.map((_, i) => Math.round(xStart + i * stepX));

  const yTop = 15;
  const yBottom = 96;
  const yHeight = yBottom - yTop;

  const oldPoints = monthlyStats.map((m, i) => {
    let ratio = m.oldTotal > 0 ? (m.oldTotal / maxVal) : 0.02;
    const clamped = Math.min(1, Math.max(0.02, ratio));
    return { x: xCoords[i], y: Math.round(yBottom - clamped * yHeight) };
  });

  const newPoints = monthlyStats.map((m, i) => {
    let ratio = m.newTotal > 0 ? (m.newTotal / maxVal) : 0.02;
    const clamped = Math.min(1, Math.max(0.02, ratio));
    return { x: xCoords[i], y: Math.round(yBottom - clamped * yHeight) };
  });

  function getSplinePath(pts) {
    if (pts.length < 2) return '';
    let d = `M ${pts[0].x},${pts[0].y}`;
    for (let i = 0; i < pts.length - 1; i++) {
      const p0 = pts[i === 0 ? 0 : i - 1];
      const p1 = pts[i];
      const p2 = pts[i + 1];
      const p3 = pts[i + 2 > pts.length - 1 ? pts.length - 1 : i + 2];

      const cp1x = Math.round(p1.x + (p2.x - p0.x) / 6);
      const cp1y = Math.round(p1.y + (p2.y - p0.y) / 6);
      const cp2x = Math.round(p2.x - (p3.x - p1.x) / 6);
      const cp2y = Math.round(p2.y - (p3.y - p1.y) / 6);

      d += ` C ${cp1x},${cp1y} ${cp2x},${cp2y} ${p2.x},${p2.y}`;
    }
    return d;
  }

  const oldLinePath = getSplinePath(oldPoints);
  const newLinePath = getSplinePath(newPoints);

  const lastX = xCoords[xCoords.length - 1];
  const firstX = xCoords[0];
  const areaNewPath = `${newLinePath} L ${lastX},${yBottom} L ${firstX},${yBottom} Z`;

  let svgContent = `
    <defs>
      <linearGradient id="newCustGrad" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="#0d9488" stop-opacity="0.35"/>
        <stop offset="100%" stop-color="#0d9488" stop-opacity="0.02"/>
      </linearGradient>
    </defs>
    <line x1="0" y1="20" x2="760" y2="20" stroke="#f1f5f9" stroke-width="1"/>
    <line x1="0" y1="58" x2="760" y2="58" stroke="#f1f5f9" stroke-width="1"/>
    <line x1="0" y1="96" x2="760" y2="96" stroke="#f1f5f9" stroke-width="1"/>
  `;

  // New Cust (Teal) - plotted first so it's behind if old is smaller
  svgContent += `<path d="${areaNewPath}" fill="url(#newCustGrad)" />`;
  svgContent += `<path d="${newLinePath}" fill="none" stroke="#0d9488" stroke-width="2.5" />`;

  // Old Cust (Blue dashed)
  svgContent += `<path d="${oldLinePath}" fill="none" stroke="#3b82f6" stroke-width="2" stroke-dasharray="4 4" />`;

  // Points for Current Month
  const activeMonthIdx = currentCalDate.getMonth();
  const activeOldPt = oldPoints[activeMonthIdx];
  const activeNewPt = newPoints[activeMonthIdx];
  
  if (activeOldPt && activeNewPt) {
      svgContent += `<circle cx="${activeNewPt.x}" cy="${activeNewPt.y}" r="5" fill="#0d9488" stroke="#ffffff" stroke-width="2"/>`;
      svgContent += `<circle cx="${activeOldPt.x}" cy="${activeOldPt.y}" r="5" fill="#3b82f6" stroke="#ffffff" stroke-width="2"/>`;
  }

  const monthNamesTh = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
  monthNamesTh.forEach((lbl, i) => {
    svgContent += `<text x="${xCoords[i]}" y="114" text-anchor="middle" fill="#94a3b8" font-size="11" font-weight="600">${lbl}</text>`;
  });

  svg.innerHTML = svgContent;
}

// ─── 3.3 ฟังก์ชันคำนวณและแสดงผลกราฟแท่งจัดอันดับสินค้าขายดี (Top Selling Products) ───────────
function renderTopProductsChart(dateFilterFn, periodLabel) {
  const container = document.getElementById('topProductsBarContainer');
  if (!container) return;

  const subtitleEl = document.getElementById('topProductsSubtitle');
  if (subtitleEl && periodLabel) {
    subtitleEl.textContent = `จัดอันดับยอดขายสินค้าและรายได้แยกตามประเภทสินค้า (${periodLabel})`;
  }

  const productAgg = {};

  cachedSales.forEach(s => {
    const sDate = String(s.date || s.created_at || '').substring(0, 10);
    if (typeof dateFilterFn === 'function' && !dateFilterFn(sDate)) return;

    let itemsList = [];
    if (s.items_json) {
      try {
        itemsList = typeof s.items_json === 'string' ? JSON.parse(s.items_json) : s.items_json;
      } catch (e) {
        itemsList = [];
      }
    }

    if (Array.isArray(itemsList) && itemsList.length > 0) {
      itemsList.forEach(it => {
        const rawName = it.prod || it.productName || it.name || '';
        const cleanName = String(rawName).trim();
        if (!cleanName) return;

        const qty = parseInt(it.qty || it.quantity || 1, 10) || 1;
        const pType = String(it.type || it.priceType || 'สมาชิก').trim();
        const price = Number(it.price || it.unitPrice || 0);
        const subtotal = Number(it.subtotal || (price * qty) || 0);

        if (!productAgg[cleanName]) {
          productAgg[cleanName] = {
            name: cleanName,
            totalQty: 0,
            fullQty: 0,
            memberQty: 0,
            promoQty: 0,
            freeQty: 0,
            totalRevenue: 0,
            billsCount: 0
          };
        }

        productAgg[cleanName].totalQty += qty;
        productAgg[cleanName].totalRevenue += subtotal;
        productAgg[cleanName].billsCount += 1;

        if (pType.includes('เต็ม')) productAgg[cleanName].fullQty += qty;
        else if (pType.includes('โปร') || pType.includes('พิเศษ')) productAgg[cleanName].promoQty += qty;
        else if (pType.includes('ศูนย์') || pType.includes('แถม')) productAgg[cleanName].freeQty += qty;
        else productAgg[cleanName].memberQty += qty;
      });
    } else {
      // Legacy flattened columns
      Object.keys(s).forEach(k => {
        if (k.endsWith('_ราคาเต็ม') || k.endsWith('_ราคาสมาชิก') || k.endsWith('_ราคาโปร') || k.endsWith('_ราคาศูนย์')) {
          if (k === 'รวมชิ้นราคาเต็ม' || k === 'รวมชิ้นราคาสมาชิก' || k === 'รวมชิ้นราคาโปร' || k === 'รวมชิ้นราคาศูนย์') return;
          const qty = parseInt(s[k], 10) || 0;
          if (qty <= 0) return;

          const lastUnderscore = k.lastIndexOf('_');
          const cleanName = k.substring(0, lastUnderscore).replace(/\(.*?\)/g, '').trim();
          const pType = k.substring(lastUnderscore + 1);

          if (!productAgg[cleanName]) {
            productAgg[cleanName] = {
              name: cleanName,
              totalQty: 0,
              fullQty: 0,
              memberQty: 0,
              promoQty: 0,
              freeQty: 0,
              totalRevenue: 0,
              billsCount: 0
            };
          }

          productAgg[cleanName].totalQty += qty;
          productAgg[cleanName].billsCount += 1;

          if (pType.includes('เต็ม')) productAgg[cleanName].fullQty += qty;
          else if (pType.includes('โปร')) productAgg[cleanName].promoQty += qty;
          else if (pType.includes('ศูนย์')) productAgg[cleanName].freeQty += qty;
          else productAgg[cleanName].memberQty += qty;
        }
      });
    }
  });

  // Sort descending by total quantity sold
  const sortedProducts = Object.values(productAgg).sort((a, b) => b.totalQty - a.totalQty);
  window.lastSortedProducts = sortedProducts; // Store for "View All" modal

  const top10TotalQtyEl = document.getElementById('top10TotalQty');
  const top10 = sortedProducts.slice(0, 10);
  const sumTop10Qty = top10.reduce((sum, p) => sum + p.totalQty, 0);
  if (top10TotalQtyEl) {
    top10TotalQtyEl.textContent = `${sumTop10Qty.toLocaleString()} กล่อง`;
  }

  if (sortedProducts.length === 0) {
    container.innerHTML = `
      <div style="padding: 32px 16px; text-align: center; color: #94a3b8; font-size: 13px;">
        <div style="font-size: 28px; margin-bottom: 6px;">📦</div>
        ไม่มีข้อมูลยอดขายสินค้าในช่วงเวลานี้
      </div>
    `;
    return;
  }

  const maxQty = Math.max(1, sortedProducts[0].totalQty);

  // Render top 10 products with dynamic horizontal ranking bars (จำนวนกล่องเท่านั้นตามสั่ง)
  const displayList = sortedProducts.slice(0, 10);
  let html = '';

  displayList.forEach((prod, index) => {
    const rank = index + 1;
    const rankClass = rank === 1 ? 'rank-1' : rank === 2 ? 'rank-2' : rank === 3 ? 'rank-3' : '';
    const pctWidth = Math.max(4, Math.round((prod.totalQty / maxQty) * 100));

    let detailPills = [];
    if (prod.fullQty > 0) detailPills.push(`เต็ม: ${prod.fullQty}`);
    if (prod.memberQty > 0) detailPills.push(`สมาชิก: ${prod.memberQty}`);
    if (prod.promoQty > 0) detailPills.push(`โปร: ${prod.promoQty}`);
    if (prod.freeQty > 0) detailPills.push(`แถม: ${prod.freeQty}`);
    const detailsStr = detailPills.length > 0 ? detailPills.join(' • ') : `${prod.billsCount} รายการ`;

    html += `
      <div class="top-prod-bar-item">
        <div class="top-prod-rank ${rankClass}">${rank}</div>
        <div class="top-prod-meta" title="${prod.name}">
          <div class="top-prod-name">${prod.name}</div>
          <div class="top-prod-subtitle">${detailsStr}</div>
        </div>
        <div class="top-prod-bar-track">
          <div class="top-prod-bar-fill" style="width: ${pctWidth}%;"></div>
        </div>
        <div class="top-prod-stats" style="min-width: 100px;">
          <span class="top-prod-qty-badge">${prod.totalQty.toLocaleString()} กล่อง</span>
        </div>
      </div>
    `;
  });

  container.innerHTML = html;
}

// ─── 3.4 ฟังก์ชันเปิด Modal แสดงสินค้าทั้งหมด ───────────
function openAllProductsModal() {
  const modal = document.getElementById('allProductsModal');
  const modalBody = document.getElementById('allProductsModalBody');
  const modalTotalItems = document.getElementById('modalTotalItemsCount');
  const modalTotalQty = document.getElementById('modalTotalQtyCount');
  if (!modal || !modalBody) return;

  const products = window.lastSortedProducts || [];
  if (products.length === 0) {
    modalBody.innerHTML = `
      <div style="padding: 40px 16px; text-align: center; color: #94a3b8; font-size: 14px;">
        📦 ยังไม่มีข้อมูลสินค้าที่มียอดขายในช่วงเวลานี้
      </div>
    `;
    if (modalTotalItems) modalTotalItems.textContent = 'พบสินค้าทั้งหมด 0 รายการ';
    if (modalTotalQty) modalTotalQty.textContent = 'รวม 0 กล่อง';
  } else {
    const totalAllQty = products.reduce((acc, p) => acc + p.totalQty, 0);
    if (modalTotalItems) modalTotalItems.textContent = `พบสินค้าทั้งหมด ${products.length.toLocaleString()} รายการ`;
    if (modalTotalQty) modalTotalQty.textContent = `ยอดรวมทั้งหมด ${totalAllQty.toLocaleString()} กล่อง`;

    const maxQty = Math.max(1, products[0].totalQty);
    let modalHtml = '';

    products.forEach((prod, index) => {
      const rank = index + 1;
      const rankClass = rank === 1 ? 'rank-1' : rank === 2 ? 'rank-2' : rank === 3 ? 'rank-3' : '';
      const pctWidth = Math.max(3, Math.round((prod.totalQty / maxQty) * 100));

      let detailPills = [];
      if (prod.fullQty > 0) detailPills.push(`เต็ม: ${prod.fullQty}`);
      if (prod.memberQty > 0) detailPills.push(`สมาชิก: ${prod.memberQty}`);
      if (prod.promoQty > 0) detailPills.push(`โปร: ${prod.promoQty}`);
      if (prod.freeQty > 0) detailPills.push(`แถม: ${prod.freeQty}`);
      const detailsStr = detailPills.length > 0 ? detailPills.join(' • ') : `${prod.billsCount} รายการ`;

      modalHtml += `
        <div class="top-prod-bar-item" style="padding: 10px 14px;">
          <div class="top-prod-rank ${rankClass}" style="width: 28px; height: 28px; font-size: 12px;">${rank}</div>
          <div class="top-prod-meta" style="width: 240px;" title="${prod.name}">
            <div class="top-prod-name">${prod.name}</div>
            <div class="top-prod-subtitle">${detailsStr}</div>
          </div>
          <div class="top-prod-bar-track">
            <div class="top-prod-bar-fill" style="width: ${pctWidth}%;"></div>
          </div>
          <div class="top-prod-stats" style="min-width: 100px;">
            <span class="top-prod-qty-badge">${prod.totalQty.toLocaleString()} กล่อง</span>
          </div>
        </div>
      `;
    });

    modalBody.innerHTML = modalHtml;
  }

  modal.style.display = 'flex';
}

function closeAllProductsModal() {
  const modal = document.getElementById('allProductsModal');
  if (modal) modal.style.display = 'none';
}

async function loadCeoDashboardData() {
  const lastUpdatedEl = document.getElementById('lastUpdated');
  if (lastUpdatedEl) {
    const now = new Date();
    const formattedDate = `${now.getDate()}/${now.getMonth() + 1}/${now.getFullYear()} ${now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })}`;
    lastUpdatedEl.textContent = `อัพเดตล่าสุด: ${formattedDate}`;
  }

  try {
    // 🎯 OPTIMIZATION: ดึงข้อมูลเฉพาะช่วงปีที่เกี่ยวข้องเพื่อลดขนาด Payload จาก View ที่รวมข้อมูลมาให้แล้ว
    const calYear = currentCalDate.getFullYear();
    const startStr = `${calYear - 1}-01-01`; // ย้อนหลัง 1 ปีเพื่อทำเปรียบเทียบ (Yearly Comparison)
    const endStr = `${calYear + 1}-12-31`;

    const [salesData, sysUsersData, closersData] = await Promise.all([
      supabaseSelect('v_ceo_sales_data', `date=gte.${startStr}&date=lte.${endStr}&order=date.desc&limit=10000`),
      supabaseSelect('system_users', 'select=id,role&limit=1000'),
      supabaseSelect('stk_closers', 'select=name,team&limit=1000')
    ]);

    let closersMap = {};
    if (Array.isArray(closersData)) {
      closersData.forEach(cl => {
        if (cl.name) {
          closersMap[String(cl.name).trim().toUpperCase()] = String(cl.team || '').trim();
        }
      });
    }
    window.cachedClosers = closersMap;

    if (Array.isArray(sysUsersData)) {
      window.cachedSystemUsers = {};
      sysUsersData.forEach(u => {
        if (u.id) {
          window.cachedSystemUsers[String(u.id).trim().toUpperCase()] = String(u.role || '').trim();
        }
      });
    }

    if (Array.isArray(salesData)) {
      cachedSales = salesData;
      
      // 🎯 สร้าง cachedCustomers จากข้อมูลที่แนบมากับ View เลย (ประหยัดการ Request)
      cachedCustomers = {};
      salesData.forEach(s => {
        if (s.customer_id) {
          let closerTeam = String(s.customer_team || '').trim();
          
          if (!closerTeam && s.recorded_by) {
             const cTeam = closersMap[String(s.recorded_by).trim().toUpperCase()];
             if (cTeam) {
               closerTeam = cTeam;
             }
          }

          if (closerTeam === 'Team A') closerTeam = 'Marketing';
          if (closerTeam === 'Team B') closerTeam = 'Center';

          cachedCustomers[String(s.customer_id).trim().toUpperCase()] = {
            type: String(s.customer_type || '').trim(),
            name: String(s.customer_name || '').trim(),
            team: closerTeam
          };
        }
      });

      updateDashboardMetrics();
    }
  } catch (e) {
    console.error('Error loading dashboard data:', e);
  }
}

// ─── 4. Event Listeners Init ───────────────────────────────────────────────
function initCeoEvents() {
  renderCalendar();

  const prevBtn = document.getElementById('calPrev');
  const nextBtn = document.getElementById('calNext');
  const todayBtn = document.getElementById('calToday');

  if (prevBtn) {
    prevBtn.addEventListener('click', () => {
      currentCalDate.setMonth(currentCalDate.getMonth() - 1);
      renderCalendar();
      updateDashboardMetrics();
    });
  }

  if (nextBtn) {
    nextBtn.addEventListener('click', () => {
      currentCalDate.setMonth(currentCalDate.getMonth() + 1);
      renderCalendar();
      updateDashboardMetrics();
    });
  }

  if (todayBtn) {
    todayBtn.addEventListener('click', () => {
      currentCalDate = new Date();
      selectedDate = new Date();
      rangeStartDate = null;
      rangeEndDate = null;
      isRangeMode = false;

      const hintEl = document.getElementById('calRangeHint');
      if (hintEl) {
        hintEl.textContent = '💡 คลิกวันที่เริ่มต้น แล้วคลิกวันสิ้นสุดบนปฏิทิน หรือเลือกวันที่ด้านบน';
      }

      renderCalendar();

      const periodPills = document.querySelectorAll('#periodPills .pill-btn');
      periodPills.forEach(p => {
        if (p.getAttribute('data-period') === 'today') {
          p.classList.add('active');
        } else {
          p.classList.remove('active');
        }
      });

      updateDashboardMetrics();
    });
  }

  // Range Input Field listeners (รองรับการเลือกวันที่ข้ามเดือน ข้ามปี จาก input date picker โดยตรง)
  const rangeStartInput = document.getElementById('calRangeStart');
  const rangeEndInput = document.getElementById('calRangeEnd');
  const applyRangeBtn = document.getElementById('calApplyRange');

  function applyCustomRangeFromInputs() {
    if (!rangeStartInput || !rangeEndInput) return;
    const startVal = rangeStartInput.value;
    const endVal = rangeEndInput.value;

    if (!startVal) return;

    rangeStartDate = parseInputDate(startVal);
    if (endVal) {
      rangeEndDate = parseInputDate(endVal);
    } else {
      rangeEndDate = rangeStartDate;
    }

    if (rangeStartDate && rangeEndDate && rangeStartDate.getTime() > rangeEndDate.getTime()) {
      const tmp = rangeStartDate;
      rangeStartDate = rangeEndDate;
      rangeEndDate = tmp;
      rangeStartInput.value = formatDateToInput(rangeStartDate);
      rangeEndInput.value = formatDateToInput(rangeEndDate);
    }

    isRangeMode = true;

    // เลื่อนปฏิทินให้แสดงเดือนของ rangeStartDate เพื่อความสะดวก
    if (rangeStartDate) {
      currentCalDate = new Date(rangeStartDate.getFullYear(), rangeStartDate.getMonth(), 1);
    }

    const hintEl = document.getElementById('calRangeHint');
    if (hintEl && rangeStartDate && rangeEndDate) {
      hintEl.textContent = `✅ ช่วงวันที่: ${rangeStartDate.getDate()}/${rangeStartDate.getMonth() + 1}/${rangeStartDate.getFullYear()} ถึง ${rangeEndDate.getDate()}/${rangeEndDate.getMonth() + 1}/${rangeEndDate.getFullYear()}`;
    }

    // ปลด Active ของ pill buttons ด้านบน
    const periodPills = document.querySelectorAll('#periodPills .pill-btn');
    periodPills.forEach(p => p.classList.remove('active'));

    renderCalendar();
    updateDashboardMetrics();
  }

  if (applyRangeBtn) {
    applyRangeBtn.addEventListener('click', applyCustomRangeFromInputs);
  }

  if (rangeStartInput) {
    rangeStartInput.addEventListener('change', () => {
      if (rangeStartInput.value && !rangeEndInput.value) {
        rangeEndInput.value = rangeStartInput.value;
      }
      applyCustomRangeFromInputs();
    });
  }

  if (rangeEndInput) {
    rangeEndInput.addEventListener('change', applyCustomRangeFromInputs);
  }

  // Pill filter buttons toggle
  const periodPills = document.querySelectorAll('#periodPills .pill-btn');
  periodPills.forEach(btn => {
    btn.addEventListener('click', () => {
      periodPills.forEach(p => p.classList.remove('active'));
      btn.classList.add('active');

      // รีเซ็ตช่วงวันที่เมื่อเลือก To Day, Week, Month, Years จากปุ่มหลัก
      isRangeMode = false;
      rangeStartDate = null;
      rangeEndDate = null;

      const hintEl = document.getElementById('calRangeHint');
      if (hintEl) {
        hintEl.textContent = '💡 คลิกวันที่เริ่มต้น แล้วคลิกวันสิ้นสุดบนปฏิทิน หรือเลือกวันที่ด้านบน';
      }

      const period = btn.getAttribute('data-period');
      if (period === 'today') {
        selectedDate = new Date();
        currentCalDate = new Date();
      }

      renderCalendar();
      updateDashboardMetrics();
    });
  });

  // Listen for real-time updates from Sales.html or other tabs
  try {
    const bc = new BroadcastChannel('stk_mlm_channel');
    bc.onmessage = (e) => {
      if (e.data && e.data.type === 'SALE_CREATED') {
        loadCeoDashboardData();
      }
    };
  } catch (e) {}

  window.addEventListener('storage', (e) => {
    if (e.key === 'stk_refresh_trigger') {
      loadCeoDashboardData();
    }
  });

  // Event listener สำหรับ Modal สินค้าทั้งหมด
  const btnViewAll = document.getElementById('btnViewAllProducts');
  const btnCloseModalX = document.getElementById('btnCloseAllProductsModal');
  const btnCloseModalBtn = document.getElementById('btnCloseAllProductsModalBtn');
  const modalBackdrop = document.getElementById('allProductsModal');

  if (btnViewAll) btnViewAll.addEventListener('click', openAllProductsModal);
  if (btnCloseModalX) btnCloseModalX.addEventListener('click', closeAllProductsModal);
  if (btnCloseModalBtn) btnCloseModalBtn.addEventListener('click', closeAllProductsModal);
  if (modalBackdrop) {
    modalBackdrop.addEventListener('click', (e) => {
      if (e.target === modalBackdrop) closeAllProductsModal();
    });
  }

  // Event listener สำหรับปุ่มซ่อน/แสดง กราฟภาพรวมเดิม
  const btnToggleOldTrend = document.getElementById('btnToggleOldTrendChart');
  const oldTrendCard = document.getElementById('oldTrendChartCard');
  const toggleOldTrendIcon = document.getElementById('toggleOldTrendIcon');
  const toggleOldTrendText = document.getElementById('toggleOldTrendText');

  if (btnToggleOldTrend && oldTrendCard) {
    btnToggleOldTrend.addEventListener('click', () => {
      const isHidden = oldTrendCard.style.display === 'none';
      if (isHidden) {
        oldTrendCard.style.display = 'block';
        if (toggleOldTrendIcon) toggleOldTrendIcon.textContent = '▲';
        if (toggleOldTrendText) toggleOldTrendText.textContent = 'ซ่อนกราฟสถิติรวมเดิม (คนตรวจ vs ยอดขายรวม)';
        btnToggleOldTrend.style.background = '#e2e8f0';
        // Re-render old trend to make sure SVG is rendered correctly
        renderYearlyTrendChart();
      } else {
        oldTrendCard.style.display = 'none';
        if (toggleOldTrendIcon) toggleOldTrendIcon.textContent = '▼';
        if (toggleOldTrendText) toggleOldTrendText.textContent = 'แสดงกราฟสถิติรวมเดิม (คนตรวจ vs ยอดขายรวม)';
        btnToggleOldTrend.style.background = '#f8fafc';
      }
    });
  }

  // แสดงข้อมูลผู้ใช้งานที่เข้าสู่ระบบบน Header
  try {
    const session = window.currentCeoSession || JSON.parse(localStorage.getItem('stk_ceo_session') || '{}');
    const uNameEl = document.getElementById('headerUserName');
    const uRoleEl = document.getElementById('headerUserRole');
    if (uNameEl && session.name) uNameEl.textContent = session.name;
    if (uRoleEl && session.role) uRoleEl.textContent = session.role;
  } catch (e) {}

  window.addEventListener('focus', loadCeoDashboardData);

  loadCeoDashboardData();
}

function handleCeoLogout() {
  const modal = document.getElementById('ceoLogoutModal');
  if (modal) {
    modal.style.display = 'flex';
  } else if (confirm('คุณต้องการออกจากระบบ CEO Dashboard หรือไม่?')) {
    localStorage.removeItem('stk_ceo_session');
    window.location.href = 'ceo-login.html';
  }
}

function closeCeoLogoutModal() {
  const modal = document.getElementById('ceoLogoutModal');
  if (modal) modal.style.display = 'none';
}

function confirmCeoLogout() {
  localStorage.removeItem('stk_ceo_session');
  window.location.href = 'ceo-login.html';
}

if (document.readyState === 'loading') {
  window.addEventListener('DOMContentLoaded', initCeoEvents);
} else {
  initCeoEvents();
}
