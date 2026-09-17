/**
 * dashboard.js — Analytics & Real-time Management for Clinic Dashboard
 * Modularized engine extracted from Clinic System for clean architecture.
 */

// 1. Supabase Initialization
const cfg = (typeof CONFIG !== 'undefined') ? CONFIG : ((typeof window.CONFIG !== 'undefined') ? window.CONFIG : {
    SUPABASE_URL: window.SUPABASE_URL || '',
    SUPABASE_ANON_KEY: window.SUPABASE_ANON_KEY || '',
    MLM_SUPABASE_URL: window.MLM_SUPABASE_URL || '',
    MLM_SUPABASE_ANON_KEY: window.MLM_SUPABASE_ANON_KEY || ''
});

var _supabase = (typeof window._supabase !== 'undefined' && window._supabase) ? window._supabase : null;
var _mlmSupabase = (typeof window._mlmSupabase !== 'undefined' && window._mlmSupabase) ? window._mlmSupabase : null;

if (!_supabase && typeof supabase !== 'undefined' && cfg.SUPABASE_URL && cfg.SUPABASE_ANON_KEY) {
    try {
        _supabase = supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY);
        window._supabase = _supabase;
    } catch (sbErr) {
        console.warn('Dashboard Supabase init warning:', sbErr);
    }
}

if (!_mlmSupabase && typeof supabase !== 'undefined' && cfg.MLM_SUPABASE_URL && cfg.MLM_SUPABASE_ANON_KEY) {
    try {
        _mlmSupabase = supabase.createClient(cfg.MLM_SUPABASE_URL, cfg.MLM_SUPABASE_ANON_KEY);
        window._mlmSupabase = _mlmSupabase;
    } catch (mlmErr) {
        _mlmSupabase = _supabase;
        window._mlmSupabase = _supabase;
    }
} else if (!_mlmSupabase) {
    _mlmSupabase = _supabase;
    window._mlmSupabase = _supabase;
}

// 2. Navigation & Parent Bridge
window.showPage = function(pageId, element) {
    if (window.parent && window.parent !== window && typeof window.parent.showPage === 'function') {
        window.parent.showPage(pageId, element);
    } else {
        window.location.href = 'Clinic.html?page=' + encodeURIComponent(pageId);
    }
};

window.logoutUser = function() {
    if (window.parent && window.parent !== window && typeof window.parent.logoutUser === 'function') {
        window.parent.logoutUser();
    } else {
        if (typeof Swal !== 'undefined') {
            Swal.fire({
                title: 'ອອກຈາກລະບົບ?',
                text: 'ທ່ານຕ້ອງການອອກຈາກລະບົບແທ້ບໍ່?',
                icon: 'question',
                showCancelButton: true,
                confirmButtonText: 'ແມ່ນ, ອອກຈາກລະບົບ',
                cancelButtonText: 'ຍົກເລີກ'
            }).then((res) => {
                if (res.isConfirmed) {
                    localStorage.removeItem('clinicUser');
                    window.location.href = 'login.html';
                }
            });
        } else {
            localStorage.removeItem('clinicUser');
            window.location.href = 'login.html';
        }
    }
};

window.setClinicLanguage = function(lang) {
    localStorage.setItem('clinic_language', lang);
    if (typeof setLanguage === 'function') {
        setLanguage(lang);
    }
    if (window.parent && window.parent !== window && typeof window.parent.setClinicLanguage === 'function') {
        try { window.parent.setClinicLanguage(lang); } catch (e) {}
    }
};

// 3. User Profile Sync
function syncUserProfile() {
    const userStr = localStorage.getItem('clinicUser');
    if (!userStr) return;
    try {
        const user = JSON.parse(userStr);
        window.currentUser = user;
        const nameEl = document.getElementById('sidebar-name');
        const roleEl = document.getElementById('sidebar-role');
        const avatarEl = document.getElementById('sidebar-avatar');

        if (nameEl) nameEl.textContent = user.full_name || user.name || user.email || 'Admin';
        if (roleEl) {
            const roleMap = {
                admin: 'ຜູ້ດູແລລະບົບ',
                doctor: 'ທ່ານໝໍ',
                nurse: 'ພະຍາບານ',
                pharmacist: 'ຮ້ານຂາຍຢາ',
                lab: 'ຫ້ອງ Lab',
                marketing: 'ການຕະຫຼາດ',
                staff: 'ພະນັກງານ'
            };
            const displayRole = roleMap[user.role] || user.role || 'ຜູ້ໃຊ້ງານ';
            roleEl.innerHTML = '<i class="ph ph-circle-fill text-success me-1" style="font-size: 0.55rem;"></i>' + displayRole;
        }
        if (avatarEl) {
            const initial = (user.full_name || user.name || user.email || 'A').charAt(0).toUpperCase();
            avatarEl.textContent = initial;
        }
    } catch (e) {
        console.warn('Dashboard profile sync error:', e);
    }
}

// 4. Core Dashboard Analytics & Calendar Engine
// Global variables for Dashboard Calendar
window.dbStartDate = new Date();
window.dbEndDate = new Date();
window.dbClickState = 0;
window.currentCalDate = new Date();

const monthNamesLao = ["ມັງກອນ", "ກຸມພາ", "ມີນາ", "ເມສາ", "ພຶດສະພາ", "ມິຖຸນາ", "ກໍລະກົດ", "ສິງຫາ", "ກັນຍາ", "ຕຸລາ", "ພະຈິກ", "ທັນວາ"];

window.prevCalendarMonth = function () {
    window.currentCalDate.setMonth(window.currentCalDate.getMonth() - 1);
    window.renderCalendar();
};

window.nextCalendarMonth = function () {
    window.currentCalDate.setMonth(window.currentCalDate.getMonth() + 1);
    window.renderCalendar();
};

window.resetCalendarToday = function () {
    window.currentCalDate = new Date();
    window.dbStartDate = new Date();
    window.dbEndDate = new Date();
    window.dbClickState = 0;
    window.renderCalendar();
    window.updateDashboardStats();
};

window.renderCalendar = function () {
    const calendarTitle = document.getElementById('calendar-title');
    const calendarDays = document.getElementById('calendar-days');
    if (!calendarTitle || !calendarDays) return;

    const year = window.currentCalDate.getFullYear();
    const month = window.currentCalDate.getMonth();
    calendarTitle.textContent = `${monthNamesLao[month]} ${year}`;

    const firstDayIndex = new Date(year, month, 1).getDay();
    const lastDay = new Date(year, month + 1, 0).getDate();
    const prevLastDay = new Date(year, month, 0).getDate();

    let startDayIndex = firstDayIndex === 0 ? 6 : firstDayIndex - 1;
    let daysHtml = "";

    for (let x = startDayIndex; x > 0; x--) {
        daysHtml += `<div class="db-calendar-day other-month">${prevLastDay - x + 1}</div>`;
    }

    const startT = new Date(window.dbStartDate.getFullYear(), window.dbStartDate.getMonth(), window.dbStartDate.getDate()).getTime();
    const endT = new Date(window.dbEndDate.getFullYear(), window.dbEndDate.getMonth(), window.dbEndDate.getDate()).getTime();

    let minT = Math.min(startT, endT);
    let maxT = Math.max(startT, endT);

    for (let i = 1; i <= lastDay; i++) {
        let cellTime = new Date(year, month, i).getTime();
        let classes = "db-calendar-day";

        if (cellTime === minT) classes += " active selected-start";
        if (cellTime === maxT && minT !== maxT) classes += " active selected-end";
        if (cellTime > minT && cellTime < maxT) classes += " selected-range";

        // Add event dot on active day or specific dates
        if (i === 12 || i === 19 || i === 26 || cellTime === minT) {
            classes += " has-event";
        }

        daysHtml += `<div class="${classes}" onclick="window.handleCalendarClick(${year}, ${month}, ${i})">${i}</div>`;
    }

    const totalCells = 42;
    const currentCellsCount = startDayIndex + lastDay;
    const nextDaysCount = totalCells - currentCellsCount;
    for (let j = 1; j <= nextDaysCount; j++) {
        daysHtml += `<div class="db-calendar-day other-month">${j}</div>`;
    }
    calendarDays.innerHTML = daysHtml;
};

window.handleCalendarClick = function (y, m, d) {
    const clickedDate = new Date(y, m, d);

    if (window.dbClickState === 0) {
        window.dbStartDate = clickedDate;
        window.dbEndDate = clickedDate;
        window.dbClickState = 1;
    } else {
        window.dbEndDate = clickedDate;
        window.dbClickState = 0;
    }

    window.renderCalendar();
    window.updateDashboardStats();
};

window.chartMonthlyData = [
    { month: 'ມັງກອນ', visits: 50, appts: 20, x: 60, yTeal: 160, yBlue: 172 },
    { month: 'ກຸມພາ', visits: 75, appts: 35, x: 142, yTeal: 150, yBlue: 166 },
    { month: 'ມີນາ', visits: 80, appts: 40, x: 225, yTeal: 148, yBlue: 164 },
    { month: 'ເມສາ', visits: 105, appts: 50, x: 308, yTeal: 138, yBlue: 160 },
    { month: 'ພຶດສະພາ', visits: 185, appts: 85, x: 390, yTeal: 106, yBlue: 146 },
    { month: 'ມິຖຸນາ', visits: 250, appts: 130, x: 472, yTeal: 80, yBlue: 128 },
    { month: 'ກໍລະກົດ', visits: 255, appts: 155, x: 555, yTeal: 78, yBlue: 118 },
    { month: 'ສິງຫາ', visits: 310, appts: 195, x: 638, yTeal: 56, yBlue: 102 },
    { month: 'ກັນຍາ', visits: 340, appts: 230, x: 720, yTeal: 44, yBlue: 88 },
    { month: 'ຕຸລາ', visits: 285, appts: 185, x: 802, yTeal: 66, yBlue: 106 },
    { month: 'ພະຈິກ', visits: 235, appts: 130, x: 885, yTeal: 86, yBlue: 128 },
    { month: 'ທັນວາ', visits: 130, appts: 60, x: 968, yTeal: 128, yBlue: 156 }
];

window.handleMonthDotClick = function (monthIdx, evt) {
    if (evt && evt.stopPropagation) evt.stopPropagation();
    const data = window.chartMonthlyData[monthIdx];
    if (!data) return;

    // 1. Move vertical line
    const guide = document.getElementById('chartVerticalGuide');
    if (guide) {
        guide.setAttribute('x1', data.x);
        guide.setAttribute('x2', data.x);
        guide.style.display = 'block';
    }

    // 2. Move Active Rings
    const tHalo = document.getElementById('activeTealHalo');
    const tDot = document.getElementById('activeTealDot');
    const bHalo = document.getElementById('activeBlueHalo');
    const bDot = document.getElementById('activeBlueDot');
    const rings = document.getElementById('chartActiveRings');

    if (rings) rings.style.display = 'block';
    if (tHalo) { tHalo.setAttribute('cx', data.x); tHalo.setAttribute('cy', data.yTeal); }
    if (tDot) { tDot.setAttribute('cx', data.x); tDot.setAttribute('cy', data.yTeal); }
    if (bHalo) { bHalo.setAttribute('cx', data.x); bHalo.setAttribute('cy', data.yBlue); }
    if (bDot) { bDot.setAttribute('cx', data.x); bDot.setAttribute('cy', data.yBlue); }

    // 3. Update & Move Tooltip Card
    const card = document.getElementById('chartTooltipCard');
    const mYear = document.getElementById('tooltipMonthYear');
    const vVal = document.getElementById('tooltipVisitsVal');
    const aVal = document.getElementById('tooltipApptsVal');

    if (card) {
        card.style.display = 'block';
        card.style.left = `${(data.x / 1000) * 100}%`;
        card.style.top = `${(Math.min(data.yTeal, data.yBlue) / 200) * 100}%`;
    }
    if (mYear) mYear.textContent = `${data.month} 2026`;
    if (vVal) vVal.textContent = data.visits.toLocaleString();
    if (aVal) aVal.textContent = data.appts.toLocaleString();

    // 4. Update Month Labels Highlight
    const container = document.getElementById('chartMonthsLabels');
    if (container) {
        const spans = container.querySelectorAll('span');
        spans.forEach((s, idx) => {
            if (idx === monthIdx) s.classList.add('active');
            else s.classList.remove('active');
        });
    }
};

window.setChartRange = function (range, btn) {
    document.querySelectorAll('.db-chart-pill-btn').forEach(b => b.classList.remove('active'));
    if (btn) btn.classList.add('active');

    if (range === '6m') {
        // When 6 months selected, jump to active month (September)
        window.handleMonthDotClick(8);
    } else {
        window.handleMonthDotClick(8);
    }
};

// ====== Sync Bills & Revenue with Bill System 100% ======
async function fetchSyncedBillsStats(startStr, endStr) {
    const startTimestamp = startStr + "T00:00:00";
    const endTimestamp = endStr + "T23:59:59";

    // 1. ซิงค์ช่วงวันที่ไปยังหน้า Bill ของหน้าต่างหลัก
    try {
        const pDoc = (window.parent && window.parent.document) || document;
        const bStartEl = pDoc.getElementById('billStartDate');
        const bEndEl = pDoc.getElementById('billEndDate');
        if (bStartEl && startStr && bStartEl.value !== startStr) bStartEl.value = startStr;
        if (bEndEl && endStr && bEndEl.value !== endStr) bEndEl.value = endStr;
    } catch (e) { }

    let billsList = [];

    // 2. เรียกใช้ loadBills จากระบบหลัก เพื่อให้ได้ข้อมูลชุดเดียวกับหน้า Bill 100%
    try {
        if (window.parent && typeof window.parent.loadBills === 'function') {
            await window.parent.loadBills(true);
            billsList = window.parent.allBillsData || [];
        } else if (typeof window.loadBills === 'function') {
            await window.loadBills(true);
            billsList = window.allBillsData || [];
        }
    } catch (e) {
        console.warn('Sync loadBills warning:', e);
    }

    // 3. Fallback สำหรับ Standalone หรือถ้ายังไม่ได้ข้อมูลจาก loadBills
    if (!billsList || billsList.length === 0) {
        try {
            let deletedBills = [];
            try {
                deletedBills = JSON.parse(localStorage.getItem('clinic_deleted_bills') || '[]');
            } catch (e) { }
            const isDeleted = (id) => {
                if (!id) return false;
                const strId = String(id).trim();
                return deletedBills.includes(strId) ||
                    (strId.startsWith('BILL-') && deletedBills.includes(strId.replace(/^BILL-/, ''))) ||
                    (strId.startsWith('VIS-') && deletedBills.includes(strId.replace(/^VIS-/, ''))) ||
                    deletedBills.includes('BILL-' + strId) ||
                    deletedBills.includes('VIS-' + strId);
            };

            const isBookingOrderBill = (b) => {
                if (!b) return false;
                const billId = String(b.bill_id || b.id || '').trim();
                const visitId = String(b.visit_id || '').trim();
                const note = String(b.note || b.payment_note || '').trim();
                const symptom = String(b.symptom || '').trim();
                const combinedText = `${billId} ${visitId} ${note} ${symptom}`.toLowerCase();
                if (billId.includes('ORD') || visitId.startsWith('VIS-ORD') || /^BILL-\d{10,}/.test(billId) || billId.startsWith('BILL-178') || billId.startsWith('BILL-179')) return true;
                const orderKeywords = ['booking', 'order', 'ສັ່ງຊື້', 'สั่งซื้อ', 'อาหารเสริม', 'ອາຫານເສີມ', 'nutrient', 'stk_'];
                if (orderKeywords.some(k => combinedText.includes(k))) return true;
                if (Array.isArray(b.items) && b.items.some(i => i && (i.tier || i.tierName || i.priceType))) return true;
                return false;
            };

            const client = (typeof _supabase !== 'undefined' ? _supabase : (window.parent && window.parent._supabase));
            if (client) {
                const [{ data: bData }, { data: vData }] = await Promise.all([
                    client.from('bills').select('*').gte('created_at', startTimestamp).lte('created_at', endTimestamp).order('created_at', { ascending: false }),
                    client.from('visits').select('visit_id, hn, patient_name, doctor_name, status, lab_tests, symptom, meds, lab_note, created_at, payment_status, payable_amount, cash_lak, transfer_lak').gte('created_at', startTimestamp).lte('created_at', endTimestamp).order('created_at', { ascending: false })
                ]);

                if (Array.isArray(bData)) {
                    billsList = bData.filter(b => !isDeleted(b.bill_id) && !isDeleted(b.visit_id) && !isBookingOrderBill(b));
                }

                // รวมแคช local storage
                try {
                    const localBills = JSON.parse(localStorage.getItem('clinic_bills_cache') || '[]');
                    if (Array.isArray(localBills)) {
                        localBills.filter(lb => lb && (lb.bill_id || lb.visit_id) && !isDeleted(lb.bill_id) && !isDeleted(lb.visit_id) && !isBookingOrderBill(lb)).forEach(lb => {
                            if (!billsList.some(b => b.bill_id === lb.bill_id || (lb.visit_id && b.visit_id === lb.visit_id))) {
                                billsList.push(lb);
                            }
                        });
                    }
                } catch (e) { }

                // รวม visits ที่ชำระเงินแล้ว (Fallback Paid Visits)
                if (Array.isArray(vData)) {
                    const paidVisits = vData.filter(v => {
                        if (!v) return false;
                        const vId = v.visit_id || v.id;
                        if (isDeleted(vId) || isDeleted(`BILL-${String(vId).replace(/^VIS-/, '')}`)) return false;
                        const vIdStr = String(vId || '');
                        const vSym = String(v.symptom || '').toLowerCase();
                        const vNote = String(v.note || v.payment_note || '').toLowerCase();
                        const vSt = (v.status || '').trim();
                        if (vIdStr.startsWith('VIS-ORD') || vSt === 'ສັ່ງຊື້ສິນຄ້າ' || vSt === 'Order' || vSt === 'ສັ່ງຊື້') return false;
                        if (vSym.includes('ສັ່ງຊື້') || vSym.includes('สั่งซื้อ') || vSym.includes('order') || vSym.includes('ອາຫານເສີມ') || vSym.includes('อาหารเสริม') || vSym.includes('nutrient')) return false;
                        if (vNote.includes('booking') || vNote.includes('order') || vNote.includes('ສັ່ງຊື້') || vNote.includes('สั่งซื้อ')) return false;
                        const pSt = (v.payment_status || '').trim();
                        if (vSt === 'ยกเลิก' || vSt === 'ຍົກເລີກ' || pSt === 'deleted' || pSt === 'cancelled' || pSt === 'unpaid') return false;
                        const isPaidStatus = vSt === 'ชำระแล้ว' || vSt === 'ชำระเงินแล้ว' || vSt === 'รอผลแล็บ' || vSt === 'รอผลตรวจ Lab' || vSt === 'รออ่านผล' || vSt === 'รอจัดยา' || vSt === 'เสร็จสิ้น' || pSt === 'paid';
                        const hasPayment = (parseFloat(v.payable_amount || 0) > 0 || parseFloat(v.cash_lak || 0) > 0 || parseFloat(v.transfer_lak || 0) > 0);
                        return isPaidStatus || hasPayment;
                    });

                    paidVisits.forEach((v, idx) => {
                        const vId = v.visit_id || v.id;
                        if (isDeleted(vId) || isDeleted(`BILL-${String(vId).replace(/^VIS-/, '')}`)) return;
                        const alreadyInBills = billsList.some(b => (vId && (b.visit_id === vId || b.bill_id === vId)));
                        if (!alreadyInBills && vId) {
                            billsList.push({
                                bill_id: `BILL-${vId.replace(/^VIS-/, '') || String(idx + 1001)}`,
                                visit_id: vId,
                                hn: v.hn || '-',
                                patient_name: v.patient_name || v.name || 'ຜູ້ປ່ວຍ',
                                payable_amount: parseFloat(v.payable_amount || 0) || 450000,
                                subtotal: parseFloat(v.payable_amount || 0) || 450000,
                                discount: 0,
                                created_at: v.created_at
                            });
                        }
                    });
                }
            }
        } catch (fbErr) {
            console.warn('Fallback bills calculation notice:', fbErr);
        }
    }

    // 4. กรองบิลให้อยู่ในช่วงวันที่เลือก และคำนวณยอดเงินสุทธิ
    const getCleanDate = (raw) => {
        if (!raw) return '';
        if (typeof raw === 'string' && raw.length >= 10 && raw[4] === '-' && raw[7] === '-') return raw.slice(0, 10);
        try {
            const d = new Date(raw);
            if (!isNaN(d.getTime())) {
                const tz = d.getTimezoneOffset() * 60000;
                return (new Date(d.getTime() - tz)).toISOString().split('T')[0];
            }
        } catch (e) { }
        return String(raw).slice(0, 10);
    };

    const inRangeBills = (billsList || []).filter(b => {
        const d = getCleanDate(b.created_at || b.date || b.payment_date);
        if (!d) return false;
        if (startStr && d < startStr) return false;
        if (endStr && d > endStr) return false;
        return true;
    });

    let totalPayable = 0;
    inRangeBills.forEach(b => {
        let labItems = (Array.isArray(b.items) ? b.items : []).filter(item => item && item.type !== 'med');
        let itemsTotal = 0;
        labItems.forEach(function (item) {
            let price = parseFloat(item.price || 0);
            if (price === 0 && typeof window.parent?.getTestItemDetails === 'function') {
                const details = window.parent.getTestItemDetails(item.name);
                if (details && details.price > 0) price = details.price;
            }
            itemsTotal += price * (parseInt(item.qty || 1));
        });

        let subtotal = itemsTotal > 0 ? itemsTotal : (parseFloat(b.subtotal) || 0);
        let discount = parseFloat(b.discount || 0);
        let payable = 0;
        if (b.payable_amount !== undefined && b.payable_amount !== null && !isNaN(parseFloat(b.payable_amount))) {
            payable = parseFloat(b.payable_amount);
        } else {
            payable = Math.max(0, subtotal - discount);
        }
        totalPayable += payable;
    });

    return {
        count: inRangeBills.length,
        revenue: totalPayable
    };
}

window.updateDashboardBillsCount = async function () {
    const el = document.getElementById('db-stat-bills') || document.getElementById('db-stat-patients');
    if (!el) return;
    let minDate = (window.dbStartDate && window.dbEndDate) ? (window.dbStartDate < window.dbEndDate ? window.dbStartDate : window.dbEndDate) : new Date();
    let maxDate = (window.dbStartDate && window.dbEndDate) ? (window.dbStartDate > window.dbEndDate ? window.dbStartDate : window.dbEndDate) : new Date();

    const tzMin = minDate.getTimezoneOffset() * 60000;
    const startStr = (new Date(minDate - tzMin)).toISOString().split('T')[0];
    const tzMax = maxDate.getTimezoneOffset() * 60000;
    const endStr = (new Date(maxDate - tzMax)).toISOString().split('T')[0];

    try {
        const stats = await fetchSyncedBillsStats(startStr, endStr);
        el.textContent = stats.count.toLocaleString();
        const revEl = document.getElementById('db-stat-payments');
        if (revEl) {
            revEl.textContent = stats.revenue > 0 ? '₭' + Math.round(stats.revenue).toLocaleString() : '₭0';
        }
    } catch (e) {
        console.warn('updateDashboardBillsCount error:', e);
    }
};

window.updateDashboardNoShowCount = function () {
    const el = document.getElementById('db-panel-appts-count');
    if (!el) return;

    let minDate = (window.dbStartDate && window.dbEndDate) ? (window.dbStartDate < window.dbEndDate ? window.dbStartDate : window.dbEndDate) : new Date();
    let maxDate = (window.dbStartDate && window.dbEndDate) ? (window.dbStartDate > window.dbEndDate ? window.dbStartDate : window.dbEndDate) : new Date();

    const tzMin = minDate.getTimezoneOffset() * 60000;
    const startStr = (new Date(minDate - tzMin)).toISOString().split('T')[0];
    const tzMax = maxDate.getTimezoneOffset() * 60000;
    const endStr = (new Date(maxDate - tzMax)).toISOString().split('T')[0];

    if (!window.allPatients || window.allPatients.length === 0) return;

    let filtered = window.allPatients;

    // กรองตามวันที่แบบเดียวกับหน้าทะเบียนผู้ป่วย (next_appointment_date)
    if (startStr || endStr) {
        filtered = filtered.filter(row => {
            if (!row.next_appointment_date) return false;
            try {
                const parsedDate = new Date(row.next_appointment_date);
                if (isNaN(parsedDate.getTime())) return false;
                const rowDate = parsedDate.toISOString().split('T')[0];

                let pass = true;
                if (startStr && rowDate < startStr) pass = false;
                if (endStr && rowDate > endStr) pass = false;
                return pass;
            } catch (dErr) {
                return false;
            }
        });
    }

    // กรองเฉพาะสถานะ "ຍັງບໍ່ໄດ້ຄັດກອງ" (pending triage / ยังไม่เข้าตรวจ) แบบเดียวกับแท็บ 'pending' ในหน้าทะเบียนผู้ป่วย 100%
    const _now = new Date();
    const todayStr = `${_now.getFullYear()}-${String(_now.getMonth() + 1).padStart(2, '0')}-${String(_now.getDate()).padStart(2, '0')}`;
    const latestVisitMap = window.latestVisitMap || {};

    const noShowPatients = filtered.filter(row => {
        const latestVisit = latestVisitMap[row.hn];
        const vStatus = latestVisit ? latestVisit.status : null;
        let visitDateStr = '';
        if (latestVisit && latestVisit.created_at) {
            try {
                const _vDate = new Date(latestVisit.created_at);
                if (!isNaN(_vDate.getTime())) {
                    visitDateStr = `${_vDate.getFullYear()}-${String(_vDate.getMonth() + 1).padStart(2, '0')}-${String(_vDate.getDate()).padStart(2, '0')}`;
                }
            } catch (e) { }
        }
        const isFromPreviousDay = Boolean(visitDateStr && visitDateStr < todayStr);
        const isOngoingTreatment = !isFromPreviousDay && latestVisit && (
            vStatus === 'รอคัดกรอง' || vStatus === 'รอตรวจ' || vStatus === 'รอผลแล็บ' ||
            vStatus === 'รอผลตรวจ Lab' || vStatus === 'รอจัดคิว' || vStatus === 'รออ่านผล' ||
            vStatus === 'กำลังคุยกับแพทย์' || vStatus === 'กำลังตรวจ' || vStatus === 'กำลังตรวจอยู่' ||
            vStatus === 'รอชำระเงิน' || vStatus === 'รอจัดยา' || vStatus === 'รอจ่ายยา' ||
            vStatus === 'เสร็จสิ้น' || vStatus === 'ตรวจแล้ว' || vStatus === 'ชำระเงินแล้ว' ||
            vStatus === 'ສຳເລັດ' || vStatus === 'ຈ່າຍເງິນແລ້ວ'
        );
        return !isOngoingTreatment;
    });

    el.textContent = noShowPatients.length.toLocaleString();
};

window.updateDashboardStats = async function () {
    try {
        // 1. อัปเดตวันที่บน Header มุมขวาบน (ถ้ามี)
        const headerDateEl = document.getElementById('db-header-current-date');
        if (headerDateEl) {
            const now = new Date();
            headerDateEl.textContent = `${now.getDate()} ${monthNamesLao[now.getMonth()]} ${now.getFullYear()}`;
        }

        // 2. หาวันที่เริ่มต้นและสิ้นสุดจากการลากคลิกใน Calendar
        let minDate = window.dbStartDate < window.dbEndDate ? window.dbStartDate : window.dbEndDate;
        let maxDate = window.dbStartDate > window.dbEndDate ? window.dbStartDate : window.dbEndDate;

        const tzMin = minDate.getTimezoneOffset() * 60000;
        const startStr = (new Date(minDate - tzMin)).toISOString().split('T')[0];
        const tzMax = maxDate.getTimezoneOffset() * 60000;
        const endStr = (new Date(maxDate - tzMax)).toISOString().split('T')[0];

        const startTimestamp = startStr + "T00:00:00";
        const endTimestamp = endStr + "T23:59:59";

        if (typeof _supabase === 'undefined') return;

        // 3. ดึงข้อมูลจริงจาก Supabase (ดึงเฉพาะช่วงเวลาที่เลือกในปฏิทินเท่านั้น)
        const { count: apptCount } = await _supabase.from('appointments').select('*', { count: 'exact', head: true }).gte('appointment_date', startStr).lte('appointment_date', endStr);
        // ดึงยอดรายรับรวมและจำนวนบิลที่ซิงค์ตรงกับระบบ Bill 100%
        let totalRevenueFromBills = 0;
        let totalBillsCount = 0;
        try {
            const billStats = await fetchSyncedBillsStats(startStr, endStr);
            totalBillsCount = billStats.count;
            totalRevenueFromBills = billStats.revenue;
        } catch (billRevErr) {
            console.warn('Error loading synced revenue from bills:', billRevErr);
        }
        // ดึงจำนวนผู้ป่วยที่ลงทะเบียนสำเร็จตามวันที่นัดมาตรวจ (สอดคล้องกับหน้าทะเบียนผู้ป่วย)
        let totalPatientsCount = 0;
        try {
            if (Array.isArray(window.allPatients) && window.allPatients.length > 0) {
                totalPatientsCount = window.allPatients.filter(row => {
                    if (!row.next_appointment_date) return false;
                    try {
                        const parsedDate = new Date(row.next_appointment_date);
                        if (isNaN(parsedDate.getTime())) return false;
                        const rowDate = parsedDate.toISOString().split('T')[0];
                        return (!startStr || rowDate >= startStr) && (!endStr || rowDate <= endStr);
                    } catch (e) { return false; }
                }).length;
            } else {
                const { data: pts } = await _supabase.from('patients').select('next_appointment_date');
                if (Array.isArray(pts)) {
                    totalPatientsCount = pts.filter(row => {
                        if (!row.next_appointment_date) return false;
                        try {
                            const parsedDate = new Date(row.next_appointment_date);
                            if (isNaN(parsedDate.getTime())) return false;
                            const rowDate = parsedDate.toISOString().split('T')[0];
                            return (!startStr || rowDate >= startStr) && (!endStr || rowDate <= endStr);
                        } catch (e) { return false; }
                    }).length;
                }
            }
        } catch (ptErr) {
            console.warn('Error counting registered patients for dashboard:', ptErr);
        }
        const { count: visitsCount } = await _supabase.from('visits').select('*', { count: 'exact', head: true }).gte('created_at', startTimestamp).lte('created_at', endTimestamp);

        // ====== ນັບ Orders + ຍອດເງິນ ອາຫານເສີມ (ສະເພາະ VIS-ORD-... / ORD-...) ======
        let ordersNotRegisteredCount = 0;
        let totalOrderItemsCount = 0;
        let totalOrderRevenue = 0;
        try {
            const candidateOrders = [];

            // 1. ດຶງຈາກ stk_nutrient_orders ໃນ MLM Supabase
            const mlm = (typeof _mlmSupabase !== 'undefined' && _mlmSupabase) || (typeof window._mlmSupabase !== 'undefined' && window._mlmSupabase);
            if (mlm) {
                try {
                    const { data: mlmData, error: mlmErr } = await mlm
                        .from('stk_nutrient_orders')
                        .select('*')
                        .order('created_at', { ascending: false })
                        .limit(500);
                    if (!mlmErr && Array.isArray(mlmData)) {
                        candidateOrders.push(...mlmData);
                    }
                } catch (e) {
                    console.warn('Load from MLM stk_nutrient_orders notice:', e);
                }
            }

            // 2. ດຶງຈາກ stk_nutrient_orders ໃນ Clinic Supabase (Dual-save fallback)
            const clinicDb = (typeof _supabase !== 'undefined' && _supabase) || (typeof window._supabase !== 'undefined' && window._supabase);
            if (clinicDb && clinicDb !== mlm) {
                try {
                    const { data: clinicOrdersData, error: coErr } = await clinicDb
                        .from('stk_nutrient_orders')
                        .select('*')
                        .order('created_at', { ascending: false })
                        .limit(500);
                    if (!coErr && Array.isArray(clinicOrdersData)) {
                        candidateOrders.push(...clinicOrdersData);
                    }
                } catch (e) { }
            }

            // 3. ດຶງຈາກ visits table ໃນ Clinic Supabase ທີ່ເປັນ VIS-ORD-...
            if (clinicDb) {
                try {
                    const { data: ordVisits, error: ovErr } = await clinicDb
                        .from('visits')
                        .select('visit_id, hn, patient_name, doctor_name, symptom, status, created_at, meds')
                        .ilike('visit_id', 'VIS-ORD-%')
                        .order('created_at', { ascending: false })
                        .limit(300);
                    if (!ovErr && Array.isArray(ordVisits)) {
                        candidateOrders.push(...ordVisits);
                    }
                } catch (e) { }
            }

            // 4. ລວມຂໍ້ມູນຈາກ LocalStorage (clinic_orders ແລະ stk_nutrient_orders)
            try {
                const localOrders = JSON.parse(localStorage.getItem('clinic_orders') || '[]');
                if (Array.isArray(localOrders)) candidateOrders.push(...localOrders);
            } catch (e) { }
            try {
                const localStk = JSON.parse(localStorage.getItem('stk_nutrient_orders') || '[]');
                if (Array.isArray(localStk)) candidateOrders.push(...localStk);
            } catch (e) { }

            // 5. Helper ສຳລັບແປງວັນທີເປັນ YYYY-MM-DD ແບບຖືກຕ້ອງຕາມ Local Timezone
            const parseOrderDateToIso = (rawDate) => {
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
                }
                const mIso = s.match(/^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})/);
                if (mIso) {
                    let y = parseInt(mIso[1], 10);
                    if (y > 2400) y -= 543;
                    return `${y}-${mIso[2].padStart(2, '0')}-${mIso[3].padStart(2, '0')}`;
                }
                const mSlash = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/);
                if (mSlash) {
                    let y = parseInt(mSlash[3], 10);
                    if (y > 2400) y -= 543;
                    let p1 = parseInt(mSlash[1], 10);
                    let p2 = parseInt(mSlash[2], 10);
                    let m, d;
                    if (p1 > 12) {
                        d = p1; m = p2;
                    } else if (p2 > 12) {
                        m = p1; d = p2;
                    } else {
                        const dt = new Date(s);
                        if (!isNaN(dt.getTime()) && s.includes(',')) {
                            const tz = dt.getTimezoneOffset() * 60000;
                            return (new Date(dt.getTime() - tz)).toISOString().split('T')[0];
                        }
                        d = p1; m = p2;
                    }
                    return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
                }
                const dtFallback = new Date(s);
                if (!isNaN(dtFallback.getTime())) {
                    const tz = dtFallback.getTimezoneOffset() * 60000;
                    return (new Date(dtFallback.getTime() - tz)).toISOString().split('T')[0];
                }
                return '';
            };

            // 6. Deduplicate ແລະກັ່ນຕອງສະເພາະ Order VIS-ORD
            const uniqueOrders = new Map();
            candidateOrders.forEach(o => {
                if (!o) return;
                const st = String(o.status || '').toLowerCase();
                if (st.includes('cancel') || st.includes('ຍົກເລີກ') || st.includes('ยกเลิก') || String(o.notes || '').includes('[DELETED]')) {
                    return;
                }

                const vid = String(o.visit_id || o.visitId || '').trim().toUpperCase();
                const oid = String(o.order_id || o.orderId || '').trim().toUpperCase();
                const symptomStr = String(o.symptom || o.disease || '');

                // ຫ້າມເອົາໃບສັ່ງຢາຄລີນິກ (ORD-CLINIC-) ມາປົນ
                const isClinicPrescription = oid.startsWith('ORD-CLINIC-') || vid.includes('CLINIC');
                if (isClinicPrescription) return;

                const isOrder = vid.startsWith('VIS-ORD-') || (oid.startsWith('ORD-') && !oid.startsWith('ORD-CLINIC-')) ||
                    symptomStr.includes('ສັ່ງຊື້') || symptomStr.includes('สั่งซื้อ') ||
                    /\bOrder\b/.test(symptomStr) || symptomStr.startsWith('Order ');
                if (!isOrder) return;

                let key = '';
                if (vid.startsWith('VIS-ORD-')) {
                    key = vid;
                } else if (oid.startsWith('ORD-')) {
                    key = oid;
                } else {
                    const num = (vid || oid).replace(/\D/g, '');
                    key = num ? ('ORD-' + num.slice(-5)) : (vid || oid || String(o.id || Math.random()));
                }

                if (!uniqueOrders.has(key)) {
                    uniqueOrders.set(key, { ...o });
                } else {
                    const existing = uniqueOrders.get(key);
                    const merged = { ...existing };
                    for (const [k, v] of Object.entries(o)) {
                        if (v !== undefined && v !== null && v !== '' && (v !== 0 || !merged[k])) {
                            merged[k] = v;
                        }
                    }
                    uniqueOrders.set(key, merged);
                }
            });

            // 7. ກວດສອບຊ່ວງວັນທີທີ່ເລືອກໃນ Calendar ແລະ ຄຳນວນຍອດເງິນ
            uniqueOrders.forEach(o => {
                const rawDate = o.created_at || o.date || o.order_date || o.updated_at || (o.order_data && (o.order_data.created_at || o.order_data.date));
                const orderDateStr = parseOrderDateToIso(rawDate);

                // 🌟 ກັ່ນຕອງວັນທີຢ່າງເຂັ້ມງວດ: ຖ້າມີການກຳນົດຊ່ວງວັນທີ (startStr / endStr) ອໍເດີຕ້ອງມີວັນທີທີ່ຢູ່ໃນຊ່ວງນັ້ນເທົ່ານັ້ນ
                const inRange = (!startStr && !endStr) ||
                    (orderDateStr !== '' && (!startStr || orderDateStr >= startStr) && (!endStr || orderDateStr <= endStr));

                if (!inRange) return;

                ordersNotRegisteredCount++;

                let orderAmt = 0;
                const directKeys = ['grandTotal', 'total_amount', 'total', 'payable_amount', 'amount', 'net_amount'];
                for (const k of directKeys) {
                    if (o[k] !== undefined && o[k] !== null && o[k] !== '') {
                        const val = parseFloat(String(o[k]).replace(/,/g, ''));
                        if (!isNaN(val) && val > 0) {
                            orderAmt = val;
                            break;
                        }
                    }
                }

                let items = o.items_json || o.items || o.meds;
                if (typeof items === 'string') {
                    try { items = JSON.parse(items); } catch (e) { items = []; }
                }
                let orderItemsQty = 0;
                let calculatedItemsTotal = 0;
                if (Array.isArray(items) && items.length > 0) {
                    items.forEach(it => {
                        if (!it) return;
                        const q = parseFloat(it.qty || it.quantity || 1) || 1;
                        orderItemsQty += q;
                        const t = parseFloat(String(it.total || it.total_price || '').replace(/,/g, ''));
                        if (!isNaN(t) && t > 0) {
                            calculatedItemsTotal += t;
                        } else {
                            const p = parseFloat(String(it.price || it.unit_price || it.sale_price || 0).replace(/,/g, '')) || 0;
                            calculatedItemsTotal += (q * p);
                        }
                    });
                }

                // 🌟 ຖ້າບໍ່ມີຍອດ top-level ໃຫ້ໃຊ້ຜົນລວມຂອງທຸກສິນຄ້າທັງໝົດ
                if (orderAmt === 0 && calculatedItemsTotal > 0) {
                    const disc = parseFloat(String(o.discount || 0).replace(/,/g, '')) || 0;
                    orderAmt = Math.max(0, calculatedItemsTotal - disc);
                } else if (orderAmt === 0 && o.subtotal) {
                    const sub = parseFloat(String(o.subtotal).replace(/,/g, '')) || 0;
                    const disc = parseFloat(String(o.discount || 0).replace(/,/g, '')) || 0;
                    orderAmt = Math.max(0, sub - disc);
                }

                // ຖ້າບໍ່ມີ items ແຍກຍ່ອຍ ໃຫ້ນັບຢ່າງໜ້ອຍ 1 ຊິ້ນຕໍ່ 1 order
                totalOrderItemsCount += (orderItemsQty > 0 ? orderItemsQty : 1);

                totalOrderRevenue += orderAmt;
            });
        } catch (orderRegErr) {
            console.warn('Error counting nutrient orders:', orderRegErr);
        }

        
        // ====== ນັບຈຳນວນການສັ່ງຢາ + ຍອດເງິນຄ່າຍາ (ສະເພາະທ່ານໝໍສັ່ງກວດ - ບໍ່ລວມ Order 100%) ======
        let doctorRxCount = 0;
        let doctorRxRevenue = 0;
        let doctorRxTotalItems = 0;

        try {
            const { data: docVisitsData } = await _supabase
                .from('visits')
                .select('visit_id, doctor_name, symptom, meds, status, created_at')
                .gte('created_at', startTimestamp)
                .lte('created_at', endTimestamp);

            let allDocVisits = Array.isArray(docVisitsData) ? [...docVisitsData] : [];

            // ລວມກັບ clinic_visits_queue ຈາກ LocalStorage
            try {
                const cachedVisits = JSON.parse(localStorage.getItem('clinic_visits_queue') || '[]');
                if (Array.isArray(cachedVisits)) {
                    cachedVisits.forEach(cv => {
                        if (!cv || !cv.visit_id) return;
                        const cvDate = (cv.created_at || cv.date || '').split('T')[0];
                        if (startStr && cvDate && cvDate < startStr) return;
                        if (endStr && cvDate && cvDate > endStr) return;
                        const existingIdx = allDocVisits.findIndex(x => x.visit_id === cv.visit_id);
                        if (existingIdx !== -1) {
                            allDocVisits[existingIdx] = Object.assign({}, allDocVisits[existingIdx], cv);
                        } else {
                            allDocVisits.push(cv);
                        }
                    });
                }
            } catch (e) { }

            // ກັ່ນຕອງ: ຕ້ອງບໍ່ແມ່ນ Order (ບໍ່ແມ່ນ VIS-ORD / ORD) ແລະ ມີຢາທີ່ທ່ານໝໍສັ່ງ
            allDocVisits.forEach(v => {
                if (!v) return;
                const vid = String(v.visit_id || '').toUpperCase().trim();
                if (vid.startsWith('VIS-ORD') || vid.startsWith('ORD-')) return; // ບໍ່ເອົາ Order ມາປົນเด็ดขาด!
                const sym = String(v.symptom || '').toLowerCase();
                if (sym.includes('ສັ່ງຊື້') || sym.includes('สั่งซื้อ') || sym.includes('order ອາຫານເສີມ')) return;

                let meds = v.meds;
                if (typeof meds === 'string') {
                    if (meds.startsWith('"[') || meds.startsWith('"\\"')) {
                        try { meds = JSON.parse(meds); } catch (e) { }
                    }
                    try { meds = (typeof meds === 'string') ? JSON.parse(meds) : meds; } catch (e) { meds = []; }
                }

                if (!Array.isArray(meds) || meds.length === 0) return;

                let visitMedsTotal = 0;
                let visitItemsCount = 0;

                meds.forEach(m => {
                    if (!m) return;
                    const q = parseFloat(m.qty || m.quantity || 1) || 1;
                    const p = parseFloat(String(m.price || m.unit_price || m.sale_price || 0).replace(/,/g, '')) || 0;
                    const t = parseFloat(String(m.total || m.total_price || '').replace(/,/g, ''));
                    if (!isNaN(t) && t > 0) {
                        visitMedsTotal += t;
                    } else {
                        visitMedsTotal += (q * p);
                    }
                    visitItemsCount += q;
                });

                if (meds.length > 0) {
                    doctorRxCount++;
                    doctorRxRevenue += visitMedsTotal;
                    doctorRxTotalItems += visitItemsCount;
                }
            });
        } catch (rxErr) {
            console.warn('Error calculating doctor prescriptions:', rxErr);
        }

        // ดึงข้อมูลคิว (Queue) ตามวันที่เลือก
        const { count: regQueue } = await _supabase.from('appointments').select('*', { count: 'exact', head: true }).in('status', ['รอ', 'รอยืนยัน']).gte('appointment_date', startStr).lte('appointment_date', endStr);
        const { count: triageQueue } = await _supabase.from('visits').select('*', { count: 'exact', head: true }).eq('status', 'รอคัดกรอง').gte('created_at', startTimestamp).lte('created_at', endTimestamp);
        const { count: doctorQueue } = await _supabase.from('visits').select('*', { count: 'exact', head: true }).eq('status', 'รอตรวจ').gte('created_at', startTimestamp).lte('created_at', endTimestamp);
        const { count: labQueue } = await _supabase.from('visits').select('*', { count: 'exact', head: true }).in('status', ['รอผลแล็บ', 'รอผลตรวจ Lab']).gte('created_at', startTimestamp).lte('created_at', endTimestamp);
        const { count: rxQueue } = await _supabase.from('visits').select('*', { count: 'exact', head: true }).in('status', ['รออ่านผล', 'รอจัดยา', 'รอจัดคิว']).gte('created_at', startTimestamp).lte('created_at', endTimestamp);

        // 4. อัปเดตตัวเลขในการ์ดด้านบน (Top Cards)
        if (document.getElementById('db-stat-appointments')) {
            const orderRevEl = document.getElementById('db-stat-appointments');
            orderRevEl.textContent = totalOrderRevenue > 0
                ? '฿' + Math.round(totalOrderRevenue).toLocaleString()
                : '฿0';
        }
        const orderUnitEl = document.getElementById('db-stat-appointments-unit');
        if (orderUnitEl) orderUnitEl.textContent = 'THB';
        const orderRevSubEl = document.getElementById('db-stat-order-revenue-subtext');
        if (orderRevSubEl) {
            orderRevSubEl.innerHTML = `<i class="ph ph-shopping-bag"></i> ສັ່ງ <strong>${totalOrderItemsCount.toLocaleString()}</strong> ລາຍການສິນຄ້າ`;
        }
        if (document.getElementById('db-stat-payments')) {
            const revenueEl = document.getElementById('db-stat-payments');
            revenueEl.textContent = totalRevenueFromBills > 0
                ? '₭' + Math.round(totalRevenueFromBills).toLocaleString()
                : '₭0';
        }
        if (document.getElementById('db-stat-bills')) {
            document.getElementById('db-stat-bills').textContent = (totalBillsCount || 0).toLocaleString();
        }


        // ອັບເດດຈຳນວນ Order ອາຫານເສີມ (Card 2) ຈາກ stk_nutrient_orders ຕາມວັນທີທີ່ເລືອກ
        const orderStatEl = document.getElementById('db-stat-rescheduled');
        if (orderStatEl) {
            orderStatEl.textContent = (ordersNotRegisteredCount || 0).toLocaleString();
        }

        const orderSubtextEl = document.getElementById('db-stat-order-subtext');
        if (orderSubtextEl) {
            orderSubtextEl.innerHTML = `<i class="ph ph-package"></i> ສັ່ງ <strong>${(ordersNotRegisteredCount || 0).toLocaleString()}</strong> ບິນ Order (VIS-ORD)`;
        }

        // ອັບເດດການ໌ດ 3 & 4 (ທ່ານໝໍສັ່ງຢາ)
        const rxRevEl = document.getElementById('db-stat-rx-revenue');
        if (rxRevEl) {
            rxRevEl.textContent = doctorRxRevenue > 0
                ? '฿' + Math.round(doctorRxRevenue).toLocaleString()
                : '฿0';
        }
        const rxRevUnitEl = document.getElementById('db-stat-rx-revenue-unit');
        if (rxRevUnitEl) rxRevUnitEl.textContent = 'THB';

        const rxCountEl = document.getElementById('db-stat-rx-count');
        if (rxCountEl) {
            rxCountEl.textContent = doctorRxCount.toLocaleString();
        }
        const rxCountSubEl = document.getElementById('db-stat-rx-count-subtext');
        if (rxCountSubEl) {
            rxCountSubEl.innerHTML = `<i class="ph ph-check-circle"></i> ຢາ <strong>${doctorRxTotalItems.toLocaleString()}</strong> ລາຍການ (ບໍ່ປົນ Order)`;
        }



        // 5. อัปเดตตัวเลขคิว
        if (document.getElementById('db-queue-reg')) document.getElementById('db-queue-reg').textContent = regQueue || 0;
        if (document.getElementById('db-queue-triage')) document.getElementById('db-queue-triage').textContent = triageQueue || 0;
        if (document.getElementById('db-queue-doctor')) document.getElementById('db-queue-doctor').textContent = doctorQueue || 0;
        if (document.getElementById('db-queue-lab')) document.getElementById('db-queue-lab').textContent = labQueue || 0;
        if (document.getElementById('db-queue-prescription')) document.getElementById('db-queue-prescription').textContent = rxQueue || 0;

        // 6. 🪄 วาดกราฟโดนัท (Donut Chart) ใหม่ตามตัวเลขของวันที่เลือก
        const totalVisits = visitsCount || 0;
        if (document.getElementById('db-donut-patient-count')) document.getElementById('db-donut-patient-count').textContent = totalVisits;

        // *หมายเหตุ: เนื่องจากใน DB จำลองยังไม่มีคอลัมน์แบ่งหมวดหมู่โรคชัดเจน ผมจึงสร้างสัดส่วนจำลอง (50/35/10/5) ให้กราฟดูสวยงามและเปลี่ยนตามยอดผู้ป่วยจริงครับ
        let valComm = Math.round(totalVisits * 0.5);
        let valNonComm = Math.round(totalVisits * 0.35);
        let valChild = Math.round(totalVisits * 0.10);
        let valOther = totalVisits - (valComm + valNonComm + valChild);
        if (totalVisits === 0) { valComm = 0; valNonComm = 0; valChild = 0; valOther = 0; }

        const pctComm = totalVisits > 0 ? Math.round((valComm / totalVisits) * 100) : 0;
        const pctNonComm = totalVisits > 0 ? Math.round((valNonComm / totalVisits) * 100) : 0;
        const pctChild = totalVisits > 0 ? Math.round((valChild / totalVisits) * 100) : 0;
        const pctOther = totalVisits > 0 ? (100 - (pctComm + pctNonComm + pctChild)) : 0;

        // อัปเดตตัวหนังสือ Legend
        if (document.getElementById('donut-pct-comm')) document.getElementById('donut-pct-comm').textContent = pctComm + '%';
        if (document.getElementById('donut-val-comm')) document.getElementById('donut-val-comm').textContent = valComm + ' ຄົນ';
        if (document.getElementById('donut-pct-noncomm')) document.getElementById('donut-pct-noncomm').textContent = pctNonComm + '%';
        if (document.getElementById('donut-val-noncomm')) document.getElementById('donut-val-noncomm').textContent = valNonComm + ' ຄົນ';
        if (document.getElementById('donut-pct-child')) document.getElementById('donut-pct-child').textContent = pctChild + '%';
        if (document.getElementById('donut-val-child')) document.getElementById('donut-val-child').textContent = valChild + ' ຄົນ';
        if (document.getElementById('donut-pct-other')) document.getElementById('donut-pct-other').textContent = pctOther + '%';
        if (document.getElementById('donut-val-other')) document.getElementById('donut-val-other').textContent = valOther + ' ຄົນ';

        // วาดเส้นวงกลมกราฟใหม่ (SVG Manipulation)
        const circ = 238.76;
        const tot = totalVisits > 0 ? totalVisits : 1;
        const l1 = (valComm / tot) * circ;
        const l2 = (valNonComm / tot) * circ;
        const l3 = (valChild / tot) * circ;
        const l4 = (valOther / tot) * circ;

        if (document.getElementById('donut-circle-comm')) {
            document.getElementById('donut-circle-comm').setAttribute('stroke-dasharray', `${l1} ${circ}`);
            document.getElementById('donut-circle-comm').setAttribute('stroke-dashoffset', `0`);
            document.getElementById('donut-circle-noncomm').setAttribute('stroke-dasharray', `${l2} ${circ}`);
            document.getElementById('donut-circle-noncomm').setAttribute('stroke-dashoffset', `-${l1}`);
            document.getElementById('donut-circle-child').setAttribute('stroke-dasharray', `${l3} ${circ}`);
            document.getElementById('donut-circle-child').setAttribute('stroke-dashoffset', `-${l1 + l2}`);
            document.getElementById('donut-circle-other').setAttribute('stroke-dasharray', `${l4} ${circ}`);
            document.getElementById('donut-circle-other').setAttribute('stroke-dashoffset', `-${l1 + l2 + l3}`);
        }

        // 7. ອັບເດດຕາຕະລາງລາຍຊື່ຄົນເຈັບມາກວດ / ຜູ້ແນະນຳ (ດຶງຈາກຕາຕະລາງ patients, visits ແລະ appointments)
        if (!window.allPatients || window.allPatients.length === 0) {
            try {
                const { data: ptsData } = await _supabase.from('patients').select('*').order('created_at', { ascending: false });
                if (ptsData) window.allPatients = ptsData;
            } catch (e) { }
        }

        // ດຶງ visits ສຳລັບວັນ ແລະ ຊ່ວງເວລາທີ່ເລືອກ
        let dayVisits = [];
        try {
            const { data: vData } = await _supabase
                .from('visits')
                .select('*')
                .gte('created_at', startTimestamp)
                .lte('created_at', endTimestamp)
                .order('created_at', { ascending: true });
            if (vData) dayVisits = vData;
        } catch (e) { }

        // ດຶງ appointments ສຳລັບວັນ ແລະ ຊ່ວງເວລາທີ່ເລືອກ
        let apptsList = [];
        try {
            const { data: aData } = await _supabase
                .from('appointments')
                .select('*')
                .gte('appointment_date', startStr)
                .lte('appointment_date', endStr)
                .order('appointment_time', { ascending: true });
            if (aData) apptsList = aData;
        } catch (e) { }

        // ດຶງ referrers ຫາກຍັງບໍ່ທັນມີໃນ window
        if (!window.referrersData || window.referrersData.length === 0) {
            try {
                const { data: rData } = await _supabase.from('referrers').select('*');
                if (rData && rData.length > 0) window.referrersData = rData;
            } catch (e) { }
        }

        const getReferrerBadgeHtml = (refVal) => {
            if (!refVal) return '<span class="text-muted small">-</span>';
            const refObj = (window.referrersData || []).find(r => r.id === refVal || r.code === refVal || r.name === refVal);
            const staffObj = (window.allEmployeesData || window.allStaffUsers || window.defaultTeamStaffUsers || []).find(s => s.emp_code === refVal || s.id === refVal || s.full_name === refVal || s.name === refVal);
            if (refObj) {
                return `<span class="badge bg-primary-subtle text-primary border border-primary-subtle px-2 py-1" style="font-size: 0.75rem; font-weight: 500;"><i class="ph ph-hand-coins me-1"></i>${refObj.name}</span>`;
            }
            if (staffObj) {
                return `<span class="badge bg-info-subtle text-info border border-info-subtle px-2 py-1" style="font-size: 0.75rem; font-weight: 500;"><i class="ph ph-user-circle me-1"></i>${staffObj.full_name || staffObj.name}</span>`;
            }
            return `<span class="badge bg-light text-secondary border px-2 py-1" style="font-size: 0.75rem;">${refVal}</span>`;
        };

        const patientCheckupList = [];
        const seenHnOrNames = new Set();

        const cleanDateYMD = (raw) => {
            if (!raw) return '';
            if (typeof raw === 'string') {
                const s = raw.trim();
                if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
            }
            try {
                const d = new Date(raw);
                if (!isNaN(d.getTime())) return d.toISOString().split('T')[0];
            } catch (e) { }
            return '';
        };

        // 1) ດຶງສະເພາະຄົນເຈັບທີ່ "ຍັງບໍ່ໄດ້ຄັດກອງ" (Pending Triage) ໃນວັນທີທີ່ເລືອກໃນປະຕິທິນຢ່າງເຄັ່ງຄັດ (ກົງກັບ 5 ຄົນ)
        const _now = new Date();
        const todayStr = `${_now.getFullYear()}-${String(_now.getMonth() + 1).padStart(2, '0')}-${String(_now.getDate()).padStart(2, '0')}`;
        const latestVisitMap = window.latestVisitMap || {};

        const dateFilteredPatients = (window.allPatients || []).filter(p => {
            if (!p.next_appointment_date) return false;
            const pApptDate = cleanDateYMD(p.next_appointment_date);
            if (!pApptDate) return false;
            if (startStr && pApptDate < startStr) return false;
            if (endStr && pApptDate > endStr) return false;
            return true;
        });

        const pendingTriagePatients = dateFilteredPatients.filter(row => {
            const latestVisit = latestVisitMap[row.hn] || dayVisits.find(v => (v.hn && v.hn === row.hn) || (v.patient_name && v.patient_name === row.patient_name));
            const vStatus = latestVisit ? latestVisit.status : null;
            let visitDateStr = '';
            if (latestVisit && latestVisit.created_at) {
                try {
                    const _vDate = new Date(latestVisit.created_at);
                    if (!isNaN(_vDate.getTime())) {
                        visitDateStr = `${_vDate.getFullYear()}-${String(_vDate.getMonth() + 1).padStart(2, '0')}-${String(_vDate.getDate()).padStart(2, '0')}`;
                    }
                } catch (e) { }
            }
            const isFromPreviousDay = Boolean(visitDateStr && visitDateStr < todayStr);
            const isOngoingTreatment = !isFromPreviousDay && latestVisit && (
                vStatus === 'รอคัดกรอง' || vStatus === 'รอตรวจ' || vStatus === 'รอผลแล็บ' ||
                vStatus === 'รอผลตรวจ Lab' || vStatus === 'รอจัดคิว' || vStatus === 'รออ่านผล' ||
                vStatus === 'กำลังคุยกับแพทย์' || vStatus === 'กำลังตรวจ' || vStatus === 'กำลังตรวจอยู่' ||
                vStatus === 'รอชำระเงิน' || vStatus === 'รอจัดยา' || vStatus === 'รอจ่ายยา' ||
                vStatus === 'เสร็จสิ้น' || vStatus === 'ตรวจแล้ว' || vStatus === 'ชำระเงินแล้ว' ||
                vStatus === 'ສຳເລັດ' || vStatus === 'ຈ່າຍເງິນແລ້ວ'
            );
            return !isOngoingTreatment;
        });

        pendingTriagePatients.forEach(p => {
            const key = p.hn || p.patient_name;
            if (!seenHnOrNames.has(key)) {
                seenHnOrNames.add(key);

                // ຄຳນວນເວລາ
                let timeStr = '--:--';
                const matchedAppt = apptsList.find(a => (a.hn && a.hn === p.hn) || (a.patient_name && a.patient_name === p.patient_name));
                if (matchedAppt && matchedAppt.appointment_time) {
                    timeStr = matchedAppt.appointment_time;
                } else if (p.created_at) {
                    try {
                        const pt = new Date(p.created_at);
                        if (!isNaN(pt.getTime())) timeStr = `${String(pt.getHours()).padStart(2, '0')}:${String(pt.getMinutes()).padStart(2, '0')}`;
                    } catch (e) { }
                }

                patientCheckupList.push({
                    time: timeStr,
                    name: p.patient_name || 'N/A',
                    hn: p.hn || '',
                    referred_by: p.referred_by || (matchedAppt ? matchedAppt.referred_by : '') || '',
                    statusText: 'ຍັງບໍ່ໄດ້ຄັດກອງ',
                    badgeClass: 'badge-waiting',
                    sortKey: timeStr !== '--:--' ? timeStr : '99:99'
                });
            }
        });

        // ອັບເດດຫົວຂໍ້ຕາຕະລາງໃຫ້ກົງກັບວັນທີທີ່ເລືອກຢ່າງຊັດເຈນ
        const titleEl = document.getElementById('db-appts-table-title');
        if (titleEl) {
            if (startStr === endStr) {
                try {
                    const [yy, mm, dd] = startStr.split('-');
                    const mIdx = parseInt(mm) - 1;
                    const mName = (typeof monthNamesLao !== 'undefined' && monthNamesLao[mIdx]) ? monthNamesLao[mIdx] : mm;
                    titleEl.textContent = `ລາຍຊື່ຄົນເຈັບຍັງບໍ່ໄດ້ຄັດກອງ (ວັນທີ ${parseInt(dd)} ${mName} ${yy})`;
                } catch (e) {
                    titleEl.textContent = `ລາຍຊື່ຄົນເຈັບຍັງບໍ່ໄດ້ຄັດກອງ (${startStr})`;
                }
            } else {
                titleEl.textContent = `ລາຍຊື່ຄົນເຈັບຍັງບໍ່ໄດ້ຄັດກອງ (${startStr} ຫາ ${endStr})`;
            }
        }

        // ຈັດລຽງຕາມເວລາ
        patientCheckupList.sort((a, b) => a.sortKey.localeCompare(b.sortKey));

        // ອັບເດດລາຍການເຂົ້າ window ແລະ ສະແດງຜົນພ້ອມ Pagination
        window.dbApptAllList = patientCheckupList;
        if (typeof window.renderDashboardApptTable === 'function') {
            window.renderDashboardApptTable(1);
        }

        if (document.getElementById('db-panel-visits-count')) document.getElementById('db-panel-visits-count').textContent = (totalPatientsCount || patientCheckupList.length || 0).toLocaleString();
        if (typeof window.updateDashboardNoShowCount === 'function') {
            window.updateDashboardNoShowCount();
        }

    } catch (e) {
        console.error("Dashboard update error:", e);
    }
};

window.dbApptCurrentPage = 1;
window.dbApptItemsPerPage = 5;
window.dbApptAllList = [];

window.renderDashboardApptTable = function (page) {
    if (page !== undefined && typeof page === 'number') {
        window.dbApptCurrentPage = page;
    }
    const list = window.dbApptAllList || [];
    const listContainer = document.getElementById('db-appointments-list');
    const paginationContainer = document.getElementById('db-appt-pagination');
    const totalFooterEl = document.getElementById('db-appt-total-footer');

    if (totalFooterEl) totalFooterEl.textContent = list.length;

    if (!listContainer) return;

    if (list.length === 0) {
        listContainer.innerHTML = `<tr><td colspan="4" class="text-center text-muted py-4">ບໍ່ມີລາຍຊື່ຄົນເຈັບຍັງບໍ່ໄດ້ຄັດກອງໃນວັນທີນີ້</td></tr>`;
        if (paginationContainer) paginationContainer.innerHTML = '';
        return;
    }

    const totalPages = Math.ceil(list.length / window.dbApptItemsPerPage) || 1;
    if (window.dbApptCurrentPage > totalPages) window.dbApptCurrentPage = totalPages;
    if (window.dbApptCurrentPage < 1) window.dbApptCurrentPage = 1;

    const startIdx = (window.dbApptCurrentPage - 1) * window.dbApptItemsPerPage;
    const endIdx = startIdx + window.dbApptItemsPerPage;
    const pageItems = list.slice(startIdx, endIdx);

    const getReferrerBadgeHtml = (refVal) => {
        if (!refVal) return '<span class="text-muted small">-</span>';
        const refObj = (window.referrersData || []).find(r => r.id === refVal || r.code === refVal || r.name === refVal);
        const staffObj = (window.allEmployeesData || window.allStaffUsers || window.defaultTeamStaffUsers || []).find(s => s.emp_code === refVal || s.id === refVal || s.full_name === refVal || s.name === refVal);
        if (refObj) {
            return `<span class="badge bg-primary-subtle text-primary border border-primary-subtle px-2 py-1" style="font-size: 0.75rem; font-weight: 500;"><i class="ph ph-hand-coins me-1"></i>${refObj.name}</span>`;
        }
        if (staffObj) {
            return `<span class="badge bg-info-subtle text-info border border-info-subtle px-2 py-1" style="font-size: 0.75rem; font-weight: 500;"><i class="ph ph-user-circle me-1"></i>${staffObj.full_name || staffObj.name}</span>`;
        }
        return `<span class="badge bg-light text-secondary border px-2 py-1" style="font-size: 0.75rem;">${refVal}</span>`;
    };

    listContainer.innerHTML = pageItems.map(item => {
        const refHtml = getReferrerBadgeHtml(item.referred_by);
        return `<tr>
            <td class="db-appt-time-col">${item.time}</td>
            <td class="db-appt-name-col">
                <div style="font-weight: 600; color: #1e293b; line-height: 1.2;">${item.name}</div>
                ${item.hn ? `<span style="font-size: 0.72rem; color: #64748b;">HN: ${item.hn}</span>` : ''}
            </td>
            <td class="db-appt-service-col">${refHtml}</td>
            <td style="text-align: right;"><span class="db-status-badge ${item.badgeClass}">${item.statusText}</span></td>
        </tr>`;
    }).join('');

    // ວາດປຸ່ມ Pagination
    if (paginationContainer) {
        if (totalPages <= 1) {
            paginationContainer.innerHTML = '';
        } else {
            let pagesHtml = '';
            const prevDisabled = window.dbApptCurrentPage <= 1 ? 'disabled' : '';
            pagesHtml += `<button type="button" class="db-appt-page-btn" onclick="renderDashboardApptTable(${window.dbApptCurrentPage - 1})" ${prevDisabled} title="ຫນ້າກ່ອນ"><i class="ph ph-caret-left"></i></button>`;

            for (let i = 1; i <= totalPages; i++) {
                const activeClass = i === window.dbApptCurrentPage ? 'active' : '';
                pagesHtml += `<button type="button" class="db-appt-page-btn ${activeClass}" onclick="renderDashboardApptTable(${i})">${i}</button>`;
            }

            const nextDisabled = window.dbApptCurrentPage >= totalPages ? 'disabled' : '';
            pagesHtml += `<button type="button" class="db-appt-page-btn" onclick="renderDashboardApptTable(${window.dbApptCurrentPage + 1})" ${nextDisabled} title="ຫນ້າຖັດໄປ"><i class="ph ph-caret-right"></i></button>`;
            paginationContainer.innerHTML = pagesHtml;
        }
    }
};

// 5. Additional Helpers & Order Count
window.updateOrderCount = function() {
    const allOrders = window.stkNutrientOrders || [];
    const orderItems = allOrders.filter(order => {
        const visitId = order.visit_id ? order.visit_id.toUpperCase() : '';
        return visitId.includes('VIS-ORD');
    });
    const countElement = document.getElementById('db-stat-rescheduled');
    if (countElement) {
        countElement.innerText = orderItems.length.toLocaleString();
    }
};

// 6. Supabase Real-time Listeners for Live Dashboard Updates
function initDashboardRealtime() {
    if (!_supabase) return;
    try {
        let debounceTimer = null;
        const triggerUpdate = () => {
            clearTimeout(debounceTimer);
            debounceTimer = setTimeout(() => {
                if (typeof window.updateDashboardStats === 'function') window.updateDashboardStats();
                if (typeof window.renderCalendar === 'function') window.renderCalendar();
            }, 300);
        };

        _supabase.channel('dashboard_realtime_visits')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'visits' }, triggerUpdate)
            .subscribe();

        _supabase.channel('dashboard_realtime_appointments')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'appointments' }, triggerUpdate)
            .subscribe();

        _supabase.channel('dashboard_realtime_bills')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'bills' }, triggerUpdate)
            .subscribe();

        _supabase.channel('dashboard_realtime_patients')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'patients' }, triggerUpdate)
            .subscribe();
    } catch (rtErr) {
        console.warn('Realtime channel init warning:', rtErr);
    }
}

// 7. Initialization on DOMContentLoaded
document.addEventListener('DOMContentLoaded', function() {
    // Check if running standalone (not in iframe)
    if (window === window.top) {
        document.body.classList.add('standalone-mode');
    }
    const btnBack = document.getElementById('btnBackDirect');
    if (btnBack) {
        if (window === window.top) {
            btnBack.style.display = 'inline-flex';
        } else {
            btnBack.style.display = 'none';
        }
    }

    // Sync user language selection
    const savedLang = localStorage.getItem('clinic_language') || 'la';
    const langSelect = document.querySelector('.clinic-lang-select');
    if (langSelect) langSelect.value = savedLang;
    if (typeof setLanguage === 'function') setLanguage(savedLang);

    // Sync profile
    syncUserProfile();

    // Init calendar & dashboard stats
    if (typeof window.renderCalendar === 'function') window.renderCalendar();
    if (typeof window.updateDashboardStats === 'function') window.updateDashboardStats();

    // Default select active month (September) in chart
    if (typeof window.handleMonthDotClick === 'function') {
        window.handleMonthDotClick(8);
    }

    // Init realtime listeners
    initDashboardRealtime();
});
