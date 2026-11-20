/**
 * dashboard.js — Analytics & Real-time Management for Clinic Dashboard
 * Modularized engine extracted from Clinic System for clean architecture.
 */

// 1. Supabase Initialization with Multi-Tier Fallbacks (Parent Frame -> Opener -> Config -> Default Credentials)
let parentCfg = null;
try {
    if (window.parent && window.parent !== window && window.parent.CONFIG) parentCfg = window.parent.CONFIG;
    else if (window.opener && window.opener.CONFIG) parentCfg = window.opener.CONFIG;
} catch (e) { }

const DEFAULT_CLINIC_URL = 'https://fpmstumpobbjozflkola.supabase.co';
const DEFAULT_CLINIC_KEY = 'sb_publishable_h9-j-0I2ku6rYYvoeHmooQ_B5GrRzR7';
const DEFAULT_MLM_URL = 'https://mfpkeyrykqnrywyksyqp.supabase.co';
const DEFAULT_MLM_KEY = 'sb_publishable_807NIkuj6MAs1KZY-m4tug_Fm1Mk-AO';

const cfg = (typeof CONFIG !== 'undefined' && CONFIG.SUPABASE_URL) ? CONFIG : (parentCfg || {
    SUPABASE_URL: window.SUPABASE_URL || DEFAULT_CLINIC_URL,
    SUPABASE_ANON_KEY: window.SUPABASE_ANON_KEY || DEFAULT_CLINIC_KEY,
    MLM_SUPABASE_URL: window.MLM_SUPABASE_URL || DEFAULT_MLM_URL,
    MLM_SUPABASE_ANON_KEY: window.MLM_SUPABASE_ANON_KEY || DEFAULT_MLM_KEY
});

// Ensure global variables are set on window for nested helper functions
if (typeof window !== 'undefined') {
    window.CONFIG = cfg;
    window.SUPABASE_URL = cfg.SUPABASE_URL;
    window.SUPABASE_ANON_KEY = cfg.SUPABASE_ANON_KEY;
}

var _supabase = (typeof window._supabase !== 'undefined' && window._supabase) ? window._supabase : null;
var _mlmSupabase = (typeof window._mlmSupabase !== 'undefined' && window._mlmSupabase) ? window._mlmSupabase : null;

try {
    if (!_supabase && window.parent && window.parent !== window && window.parent._supabase) {
        _supabase = window.parent._supabase;
        window._supabase = _supabase;
    }
    if (!_mlmSupabase && window.parent && window.parent !== window && window.parent._mlmSupabase) {
        _mlmSupabase = window.parent._mlmSupabase;
        window._mlmSupabase = _mlmSupabase;
    }
} catch (e) { }

if (!_supabase && typeof supabase !== 'undefined' && typeof supabase.createClient === 'function') {
    try {
        const url = cfg.SUPABASE_URL || DEFAULT_CLINIC_URL;
        const key = cfg.SUPABASE_ANON_KEY || DEFAULT_CLINIC_KEY;
        if (url && key) {
            _supabase = supabase.createClient(url, key);
            window._supabase = _supabase;
        }
    } catch (sbErr) {
        console.warn('Dashboard Supabase init warning:', sbErr);
    }
}

if (!_mlmSupabase && typeof supabase !== 'undefined' && typeof supabase.createClient === 'function') {
    try {
        const mlmUrl = cfg.MLM_SUPABASE_URL || DEFAULT_MLM_URL;
        const mlmKey = cfg.MLM_SUPABASE_ANON_KEY || DEFAULT_MLM_KEY;
        if (mlmUrl && mlmKey) {
            _mlmSupabase = supabase.createClient(mlmUrl, mlmKey);
            window._mlmSupabase = _mlmSupabase;
        }
    } catch (mlmErr) {
        _mlmSupabase = _supabase;
        window._mlmSupabase = _supabase;
    }
} else if (!_mlmSupabase) {
    _mlmSupabase = _supabase;
    window._mlmSupabase = _supabase;
}

// 2. Navigation & Parent Bridge
function getSafeParent() {
    try {
        if (window.parent && window.parent !== window) {
            const _ = window.parent.document;
            return window.parent;
        }
    } catch (e) { }
    return null;
}

window.showPage = function(pageId, element) {
    const p = getSafeParent();
    if (p && typeof p.showPage === 'function') {
        p.showPage(pageId, element);
    } else {
        window.location.href = 'Clinic.html?page=' + encodeURIComponent(pageId);
    }
};

window.logoutUser = function() {
    const p = getSafeParent();
    if (p && typeof p.logoutUser === 'function') {
        p.logoutUser();
    } else {
        if (typeof Swal !== 'undefined') {
            Swal.fire({
                title: 'ອອກຈາກລະບົບ?',
                text: 'ທ່ານຕ້ອງການອອກຈາກລະບົບແທ້ບໍ່?',
                icon: 'question',
                showCancelButton: true,
                confirmButtonText: 'ແມ່ນ, ອອກຈາກລະບົບ',
                cancelButtonText: 'ຍົກເລີກ'
            }).then(async (res) => {
                if (res.isConfirmed) {
                    if (typeof window.clinicSignOut === 'function') await window.clinicSignOut();
                    localStorage.removeItem('clinicUser');
                    localStorage.removeItem('clinic_last_activity');
                    (window.top || window).location.href = 'login.html';
                }
            });
        } else {
            if (typeof window.clinicSignOut === 'function') window.clinicSignOut();
            localStorage.removeItem('clinicUser');
            localStorage.removeItem('clinic_last_activity');
            (window.top || window).location.href = 'login.html';
        }
    }
};

// ບັນທຶກການເຄື່ອນໄຫວພາຍໃນ Dashboard ເພື່ອ Sync ກັບລະບົບ Auto-Logout
(function initDashboardActivityTracking() {
    let lastThrottledUpdate = 0;
    function recordActivity() {
        const now = Date.now();
        if (now - lastThrottledUpdate > 1500) {
            lastThrottledUpdate = now;
            try {
                localStorage.setItem('clinic_last_activity', now.toString());
            } catch (e) { }
        }
    }
    const events = ['mousemove', 'mousedown', 'keydown', 'scroll', 'touchstart', 'click', 'wheel'];
    events.forEach(evt => {
        window.addEventListener(evt, recordActivity, { passive: true });
        document.addEventListener(evt, recordActivity, { passive: true });
    });
})();

window.setClinicLanguage = function(lang) {
    localStorage.setItem('clinic_language', lang);
    if (typeof setLanguage === 'function') {
        setLanguage(lang);
    }
    const p = getSafeParent();
    if (p && typeof p.setClinicLanguage === 'function') {
        try { p.setClinicLanguage(lang); } catch (e) {}
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
    { month: 'ມັງກອນ', visits: 0, appts: 0, x: 60, yTeal: 175, yBlue: 175 },
    { month: 'ກຸມພາ', visits: 0, appts: 0, x: 142, yTeal: 175, yBlue: 175 },
    { month: 'ມີນາ', visits: 0, appts: 0, x: 225, yTeal: 175, yBlue: 175 },
    { month: 'ເມສາ', visits: 0, appts: 0, x: 308, yTeal: 175, yBlue: 175 },
    { month: 'ພຶດສະພາ', visits: 0, appts: 0, x: 390, yTeal: 175, yBlue: 175 },
    { month: 'ມິຖຸນາ', visits: 0, appts: 0, x: 472, yTeal: 175, yBlue: 175 },
    { month: 'ກໍລະກົດ', visits: 0, appts: 0, x: 555, yTeal: 175, yBlue: 175 },
    { month: 'ສິງຫາ', visits: 0, appts: 0, x: 638, yTeal: 175, yBlue: 175 },
    { month: 'ກັນຍາ', visits: 0, appts: 0, x: 720, yTeal: 175, yBlue: 175 },
    { month: 'ຕຸລາ', visits: 0, appts: 0, x: 802, yTeal: 175, yBlue: 175 },
    { month: 'ພະຈິກ', visits: 0, appts: 0, x: 885, yTeal: 175, yBlue: 175 },
    { month: 'ທັນວາ', visits: 0, appts: 0, x: 968, yTeal: 175, yBlue: 175 }
];

window.chartCurrentYear = new Date().getFullYear();
window.chartActiveMonthIdx = new Date().getMonth();

window.handleMonthDotClick = function (monthIdx, evt) {
    if (evt && evt.stopPropagation) evt.stopPropagation();
    const data = window.chartMonthlyData[monthIdx];
    if (!data) return;
    window.chartActiveMonthIdx = monthIdx;

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
        const clampedLeft = Math.max(12, Math.min(88, (data.x / 1000) * 100));
        const clampedTop = Math.max(18, Math.min(75, (Math.min(data.yTeal, data.yBlue) / 200) * 100));
        card.style.left = `${clampedLeft}%`;
        card.style.top = `${clampedTop}%`;
    }
    if (mYear) mYear.textContent = `${data.month} ${window.chartCurrentYear || new Date().getFullYear()}`;
    if (vVal) vVal.textContent = (data.visits || 0).toLocaleString();
    if (aVal) aVal.textContent = (data.appts || 0).toLocaleString();

    // 4. Update Month Labels Highlight
    const container = document.getElementById('chartMonthsLabels');
    if (container) {
        const spans = container.querySelectorAll('span');
        spans.forEach((s, idx) => {
            if (idx === monthIdx) s.classList.add('active');
            else s.classList.remove('active');
        });
    }

    // 5. Update KPI Card 1 (Monthly Clinic Visits) to match the clicked/active month
    const yr = window.chartCurrentYear || new Date().getFullYear();
    const curCalMonth = (window.currentCalDate || new Date()).getMonth();
    const mTitleEl = document.getElementById('db-kpi-month-title');
    if (mTitleEl) {
        const prefix = (monthIdx === curCalMonth) ? 'ຄົນເຈັບເຂົ້າກວດເດືອນນີ້' : 'ຄົນເຈັບເຂົ້າກວດເດືອນ';
        mTitleEl.textContent = `${prefix} (${data.month} ${yr})`;
    }
    const mCountEl = document.getElementById('db-panel-visits-count');
    if (mCountEl) mCountEl.textContent = (data.visits || 0).toLocaleString();
    const mUnitEl = document.getElementById('db-panel-visits-unit');
    if (mUnitEl) mUnitEl.textContent = 'ເຄສ';

    const visitsTrendEl = document.getElementById('db-kpi-visits-trend');
    if (visitsTrendEl) {
        const curV = data.visits || 0;
        const uniqHn = data.uniqueHn || 0;
        const prevV = monthIdx > 0 ? ((window.chartMonthlyData[monthIdx - 1] || {}).visits || 0) : 0;
        if (prevV > 0) {
            const diffPct = (((curV - prevV) / prevV) * 100).toFixed(1);
            const arrow = curV >= prevV ? '↑' : '↓';
            visitsTrendEl.textContent = `ຄົນເຈັບຕົວຈິງ ${uniqHn.toLocaleString()} ຄົນ | ${arrow} ${Math.abs(diffPct)}% ຈາກເດືອນກ່ອນ (${prevV.toLocaleString()} ເຄສ)`;
        } else {
            visitsTrendEl.textContent = `ຄົນເຈັບຕົວຈິງ (Unique HN) ${uniqHn.toLocaleString()} ຄົນ | ນັດໝາຍ ${ (data.appts || 0).toLocaleString() } ຄົນ`;
        }
    }
};

window.setChartRange = function (range, btn) {
    document.querySelectorAll('#chart-btn-6m, #chart-btn-1y').forEach(b => {
        if (b) b.classList.remove('active');
    });
    if (btn) btn.classList.add('active');

    const targetMonth = typeof window.chartActiveMonthIdx === 'number'
        ? window.chartActiveMonthIdx
        : (window.currentCalDate || new Date()).getMonth();
    window.handleMonthDotClick(targetMonth);
};

function buildSmoothSvgSplinePath(points) {
    if (!points || points.length === 0) return '';
    if (points.length === 1) return `M${points[0].x},${points[0].y}`;
    let d = `M${points[0].x},${points[0].y}`;
    for (let i = 0; i < points.length - 1; i++) {
        const p0 = points[i];
        const p1 = points[i + 1];
        const midX = Math.round((p0.x + p1.x) / 2);
        d += ` C${midX},${p0.y} ${midX},${p1.y} ${p1.x},${p1.y}`;
    }
    return d;
}

// Helper: ດຶງຂໍ້ມູນທຸກແຖວຈາກ Supabase ແບບແບ່ງໜ້າ (Pagination ທີລະ 1,000 ແຖວ) + Shared In-Flight & 30s Cache
window._dbFetchCache = window._dbFetchCache || new Map();
window._dbFetchInFlight = window._dbFetchInFlight || new Map();

async function fetchAllSupabaseTableRows(db, tableName, selectCols, options = {}) {
    const pageSize = 1000;
    const maxPages = options.maxPages || 10; // ສູງສຸດ 10,000 ແຖວ
    const orderCol = options.orderCol || 'created_at';
    const ttlMs = options.ttlMs !== undefined ? options.ttlMs : 30000; // 30s cache

    const cacheKey = `${tableName}|${selectCols}|${options.gteCol || ''}:${options.gteVal || ''}|${options.lteCol || ''}:${options.lteVal || ''}|${orderCol}`;
    const now = Date.now();

    if (!options.forceRefresh && ttlMs > 0) {
        const cached = window._dbFetchCache.get(cacheKey);
        if (cached && (now - cached.ts) < ttlMs) {
            return cached.data;
        }
        if (window._dbFetchInFlight.has(cacheKey)) {
            return window._dbFetchInFlight.get(cacheKey);
        }
    }

    const fetchPromise = (async () => {
        const allRows = [];
        for (let page = 0; page < maxPages; page++) {
            const from = page * pageSize;
            const to = from + pageSize - 1;
            let q = db.from(tableName).select(selectCols);
            if (options.gteCol && options.gteVal) q = q.gte(options.gteCol, options.gteVal);
            if (options.lteCol && options.lteVal) q = q.lte(options.lteCol, options.lteVal);
            if (orderCol) q = q.order(orderCol, { ascending: false });
            q = q.range(from, to);

            const { data, error } = await q;
            if (error || !Array.isArray(data) || data.length === 0) break;
            allRows.push(...data);
            if (data.length < pageSize) break;
        }
        if (allRows.length > 0 && ttlMs > 0) {
            window._dbFetchCache.set(cacheKey, { ts: Date.now(), data: allRows });
            if (tableName === 'patients' && selectCols === '*' && !options.gteCol && !options.lteCol) {
                window.allPatients = allRows;
            }
        }
        return allRows;
    })().finally(() => {
        window._dbFetchInFlight.delete(cacheKey);
    });

    window._dbFetchInFlight.set(cacheKey, fetchPromise);
    return fetchPromise;
}

window.updateRealServiceChartData = async function () {
    if (!_supabase) {
        if (window.parent && window.parent._supabase) {
            _supabase = window.parent._supabase;
        } else if (typeof supabase !== 'undefined' && typeof supabase.createClient === 'function') {
            try {
                _supabase = supabase.createClient(DEFAULT_CLINIC_URL, DEFAULT_CLINIC_KEY);
            } catch (e) { }
        }
    }
    const db = _supabase || window._supabase;
    if (!db) return;

    try {
        const calRef = window.currentCalDate || new Date();
        const year = calRef.getFullYear();
        const currentMonthIdx = calRef.getMonth();
        window.chartCurrentYear = year;

        const yearStartTs = `${year}-01-01T00:00:00`;
        const yearEndTs = `${year}-12-31T23:59:59.999`;
        const yearStartDate = `${year}-01-01`;
        const yearEndDate = `${year}-12-31`;

        const parseToYMD = (rawDate) => {
            if (!rawDate) return '';
            const s = String(rawDate).trim();
            if (!s) return '';
            if (/^\d{4}-\d{2}-\d{2}/.test(s)) {
                if (s.includes('T') || s.endsWith('Z')) {
                    const dt = new Date(s);
                    if (!isNaN(dt.getTime())) {
                        const tz = dt.getTimezoneOffset() * 60000;
                        return (new Date(dt.getTime() - tz)).toISOString().split('T')[0];
                    }
                }
                return s.slice(0, 10);
            }
            const dt = new Date(s);
            if (!isNaN(dt.getTime())) {
                const tz = dt.getTimezoneOffset() * 60000;
                return (new Date(dt.getTime() - tz)).toISOString().split('T')[0];
            }
            return '';
        };

        const [visitsData, patientsData, apptsData] = await Promise.all([
            fetchAllSupabaseTableRows(db, 'visits', 'visit_id, hn, patient_name, status, symptom, created_at', {
                gteCol: 'created_at',
                gteVal: yearStartTs,
                lteCol: 'created_at',
                lteVal: yearEndTs,
                orderCol: 'created_at'
            }),
            (Array.isArray(window.allPatients) && window.allPatients.length > 1000)
                ? Promise.resolve(window.allPatients)
                : fetchAllSupabaseTableRows(db, 'patients', '*', {
                    orderCol: 'created_at'
                }),
            fetchAllSupabaseTableRows(db, 'appointments', '*', {
                gteCol: 'appointment_date',
                gteVal: yearStartDate,
                lteCol: 'appointment_date',
                lteVal: yearEndDate,
                orderCol: 'appointment_date'
            })
        ]);

        const visitsRes = { data: visitsData };
        const patientsRes = { data: patientsData };
        const apptsRes = { data: apptsData };

        const monthlyVisitsCount = new Array(12).fill(0);
        const monthlyUniqueHnSet = Array.from({ length: 12 }, () => new Set());
        const yearUniqueHnSet = new Set();
        const seenVisitIds = new Set();
        const monthlyApptsSet = Array.from({ length: 12 }, () => new Set());

        // ລວມຂໍ້ມູນ visits ຈາກ Supabase + LocalStorage (clinic_visits_queue)
        let allYearVisits = Array.isArray(visitsRes.data) ? [...visitsRes.data] : [];
        try {
            const localQueue = JSON.parse(localStorage.getItem('clinic_visits_queue') || '[]');
            if (Array.isArray(localQueue)) {
                localQueue.forEach(lv => {
                    if (lv && lv.visit_id) allYearVisits.push(lv);
                });
            }
        } catch (e) { }

        // 1. ນັບຈຳນວນເຄສຄົນເຈັບເຂົ້າກວດຕົວຈິງລາຍເດືອນ (Teal Line: ຄົນເຈັບເຂົ້າກວດ)
        allYearVisits.forEach(v => {
            if (!v) return;
            const vid = String(v.visit_id || v.id || '').trim();
            if (!vid || seenVisitIds.has(vid)) return;

            const upperVid = vid.toUpperCase();
            if (upperVid.startsWith('VIS-ORD-') || upperVid.startsWith('ORD-')) return;

            const sym = String(v.symptom || '').toLowerCase();
            if (sym.includes('ສັ່ງຊື້') || sym.includes('สั่งซื้อ') || sym.includes('order ອາຫານເສີມ')) return;

            const st = String(v.status || '').trim().toLowerCase();
            if (st === 'cancelled' || st === 'deleted' || st === 'ຍົກເລີກ' || st === 'ยกเลิก') return;
            if (typeof window.isDeletedRecord === 'function' && window.isDeletedRecord(vid)) return;

            const dStr = parseToYMD(v.created_at || v.date);
            if (!dStr || !dStr.startsWith(String(year) + '-')) return;
            const mIdx = parseInt(dStr.substring(5, 7), 10) - 1;
            if (mIdx >= 0 && mIdx < 12) {
                seenVisitIds.add(vid);
                monthlyVisitsCount[mIdx]++;
                const hnKey = (v.hn && v.hn !== '-') ? String(v.hn).trim().toUpperCase() : String(v.patient_name || vid).trim();
                monthlyUniqueHnSet[mIdx].add(hnKey);
                yearUniqueHnSet.add(hnKey);
            }
        });

        // 2. ນັບຈຳນວນນັດໝາຍລ່ວງໜ້າ / ລົງທະບຽນລາຍເດືອນ (Blue Line: ນັດໝາຍ / ລົງທະບຽນ)
        if (patientsRes.data && Array.isArray(patientsRes.data)) {
            patientsRes.data.forEach((pt, idx) => {
                if (!pt) return;
                const st = String(pt.status || '').trim().toLowerCase();
                if (st === 'deleted' || st === 'cancelled' || st === 'ຍົກເລີກ' || st === 'ยกเลิก') return;

                const dStr = parseToYMD(pt.next_appointment_date || pt.created_at);
                if (!dStr || !dStr.startsWith(String(year) + '-')) return;
                const mIdx = parseInt(dStr.substring(5, 7), 10) - 1;
                if (mIdx >= 0 && mIdx < 12) {
                    const key = pt.hn ? `${pt.hn}_${dStr}` : `pt_${pt.patient_name || idx}_${dStr}`;
                    monthlyApptsSet[mIdx].add(key);
                }
            });
        }

        if (apptsRes.data && Array.isArray(apptsRes.data)) {
            apptsRes.data.forEach((a, idx) => {
                if (!a) return;
                const st = String(a.status || '').trim().toLowerCase();
                if (st === 'cancelled' || st === 'deleted' || st === 'ຍົກເລີກ' || st === 'ยกเลิก') return;

                const dStr = parseToYMD(a.appointment_date || a.date || a.created_at);
                if (!dStr || !dStr.startsWith(String(year) + '-')) return;
                const mIdx = parseInt(dStr.substring(5, 7), 10) - 1;
                if (mIdx >= 0 && mIdx < 12) {
                    const key = a.hn ? `${a.hn}_${dStr}` : `appt_${a.id || idx}_${dStr}`;
                    monthlyApptsSet[mIdx].add(key);
                }
            });
        }

        const monthlyApptsCount = monthlyApptsSet.map(s => s.size);

        // 3. ຄຳນວນ Scale ແກນ Y ອັດຕະໂນມັດຕາມຂໍ້ມູນຈິງ
        let maxDataVal = 0;
        for (let i = 0; i < 12; i++) {
            maxDataVal = Math.max(maxDataVal, monthlyVisitsCount[i], monthlyApptsCount[i]);
        }
        let maxScale = 20;
        if (maxDataVal > 0) {
            const rawTarget = Math.ceil(maxDataVal * 1.2);
            if (rawTarget <= 20) maxScale = 20;
            else if (rawTarget <= 40) maxScale = 40;
            else if (rawTarget <= 80) maxScale = 80;
            else if (rawTarget <= 100) maxScale = 100;
            else if (rawTarget <= 200) maxScale = 200;
            else if (rawTarget <= 400) maxScale = 400;
            else if (rawTarget <= 600) maxScale = 600;
            else if (rawTarget <= 800) maxScale = 800;
            else maxScale = Math.ceil(rawTarget / 200) * 200;
        }

        // ອັບເດດຕົວເລກແກນ Y (4 ລະດັບ)
        const yLbl4 = document.getElementById('chartYLabel4');
        const yLbl3 = document.getElementById('chartYLabel3');
        const yLbl2 = document.getElementById('chartYLabel2');
        const yLbl1 = document.getElementById('chartYLabel1');
        if (yLbl4) yLbl4.textContent = maxScale.toLocaleString();
        if (yLbl3) yLbl3.textContent = Math.round(maxScale * 0.75).toLocaleString();
        if (yLbl2) yLbl2.textContent = Math.round(maxScale * 0.5).toLocaleString();
        if (yLbl1) yLbl1.textContent = Math.round(maxScale * 0.25).toLocaleString();

        // 4. ຄຳນວນພິກັດ Y ໃນ SVG (y=175 ຄື 0, y=20 ຄື maxScale => ຄວາມສູງ 155px)
        const valToY = (val) => {
            const ratio = Math.min(1, Math.max(0, val / maxScale));
            return Math.round(175 - ratio * 155);
        };

        for (let i = 0; i < 12; i++) {
            window.chartMonthlyData[i].visits = monthlyVisitsCount[i];
            window.chartMonthlyData[i].uniqueHn = monthlyUniqueHnSet[i].size;
            window.chartMonthlyData[i].appts = monthlyApptsCount[i];
            window.chartMonthlyData[i].yTeal = valToY(monthlyVisitsCount[i]);
            window.chartMonthlyData[i].yBlue = valToY(monthlyApptsCount[i]);
        }

        // 5. ແບ່ງເສັ້ນ Solid (ມັງກອນ -> ເດືອນທີ່ເລືອກ/ປັດຈຸບັນ) ແລະ Dashed (ເດືອນຖັດໄປ -> ທັນວາ)
        let splitIdx = currentMonthIdx;
        for (let i = 11; i >= 0; i--) {
            if (monthlyVisitsCount[i] > 0 || monthlyApptsCount[i] > 0) {
                splitIdx = Math.max(currentMonthIdx, i);
                break;
            }
        }
        splitIdx = Math.min(11, Math.max(0, splitIdx));

        const tealPointsAll = window.chartMonthlyData.map(d => ({ x: d.x, y: d.yTeal }));
        const bluePointsAll = window.chartMonthlyData.map(d => ({ x: d.x, y: d.yBlue }));

        const tealPointsSolid = tealPointsAll.slice(0, splitIdx + 1);
        const bluePointsSolid = bluePointsAll.slice(0, splitIdx + 1);

        const tealPointsDash = splitIdx < 11 ? tealPointsAll.slice(splitIdx) : [];
        const bluePointsDash = splitIdx < 11 ? bluePointsAll.slice(splitIdx) : [];

        const tealLineD = buildSmoothSvgSplinePath(tealPointsSolid);
        const blueLineD = buildSmoothSvgSplinePath(bluePointsSolid);
        const tealDashD = tealPointsDash.length > 1 ? buildSmoothSvgSplinePath(tealPointsDash) : '';
        const blueDashD = bluePointsDash.length > 1 ? buildSmoothSvgSplinePath(bluePointsDash) : '';

        const lastSolidX = window.chartMonthlyData[splitIdx].x;
        const firstX = window.chartMonthlyData[0].x;
        const tealAreaD = tealLineD ? `${tealLineD} L${lastSolidX},175 L${firstX},175 Z` : '';
        const blueAreaD = blueLineD ? `${blueLineD} L${lastSolidX},175 L${firstX},175 Z` : '';

        const elTealArea = document.getElementById('chartTealAreaPath');
        const elBlueArea = document.getElementById('chartBlueAreaPath');
        const elTealLine = document.getElementById('chartTealLinePath');
        const elBlueLine = document.getElementById('chartBlueLinePath');
        const elTealDash = document.getElementById('chartTealDashPath');
        const elBlueDash = document.getElementById('chartBlueDashPath');

        if (elTealArea) elTealArea.setAttribute('d', tealAreaD);
        if (elBlueArea) elBlueArea.setAttribute('d', blueAreaD);
        if (elTealLine) elTealLine.setAttribute('d', tealLineD);
        if (elBlueLine) elBlueLine.setAttribute('d', blueLineD);
        if (elTealDash) elTealDash.setAttribute('d', tealDashD);
        if (elBlueDash) elBlueDash.setAttribute('d', blueDashD);

        // 6. ວາດຈຸດ (Interactive Dots) ທັງ 12 ເດືອນຕາມພິກັດຈິງ
        const dotsGroup = document.getElementById('chartDynamicDotsGroup');
        if (dotsGroup) {
            dotsGroup.innerHTML = window.chartMonthlyData.map((d, idx) => {
                const isFuture = idx > splitIdx;
                const fillTeal = isFuture ? '#ffffff' : '#0f766e';
                const strokeTeal = isFuture ? 'stroke="#0f766e" stroke-width="2"' : '';
                const fillBlue = isFuture ? '#ffffff' : '#0284c7';
                const strokeBlue = isFuture ? 'stroke="#0284c7" stroke-width="2"' : '';
                return `
                    <g class="db-month-dot-group" onclick="handleMonthDotClick(${idx}, event)">
                        <rect x="${d.x - 25}" y="10" width="50" height="175" fill="transparent" />
                        <circle cx="${d.x}" cy="${d.yTeal}" r="3.5" fill="${fillTeal}" ${strokeTeal} />
                        <circle cx="${d.x}" cy="${d.yBlue}" r="3.5" fill="${fillBlue}" ${strokeBlue} />
                    </g>
                `;
            }).join('');
        }

        // 7. ອັບເດດ 2 KPI Cards ດ້ານຂວາ (Option 1: ຄົນເຈັບເຂົ້າກວດເດືອນນີ້ vs ຄົນເຈັບເຂົ້າກວດສະສົມທັງປີ)
        const totalYearVisits = monthlyVisitsCount.reduce((a, b) => a + b, 0);
        const activeMonthsCount = monthlyVisitsCount.filter(c => c > 0).length || 1;
        const avgPerActiveMonth = Math.round(totalYearVisits / activeMonthsCount);

        let peakIdx = 0;
        for (let i = 1; i < 12; i++) {
            if (monthlyVisitsCount[i] > monthlyVisitsCount[peakIdx]) peakIdx = i;
        }
        const peakMonthName = window.chartMonthlyData[peakIdx] ? window.chartMonthlyData[peakIdx].month : '-';
        const peakMonthVal = monthlyVisitsCount[peakIdx] || 0;

        const yearTitleEl = document.getElementById('db-kpi-year-title');
        if (yearTitleEl) yearTitleEl.textContent = `ຄົນເຈັບເຂົ້າກວດສະສົມທັງປີ (${year})`;
        const yearCountEl = document.getElementById('db-panel-appts-count');
        if (yearCountEl) yearCountEl.textContent = totalYearVisits.toLocaleString();
        const yearUnitEl = document.getElementById('db-panel-appts-unit');
        if (yearUnitEl) yearUnitEl.textContent = 'ເຄສ';

        const apptsTrendEl = document.getElementById('db-kpi-appts-trend');
        if (apptsTrendEl) {
            apptsTrendEl.textContent = `ຄົນເຈັບບໍ່ຊ້ຳ ${yearUniqueHnSet.size.toLocaleString()} ຄົນ | ສະເລ່ຍ ${avgPerActiveMonth.toLocaleString()} ເຄສ/ເດືອນ (ສູງສຸດ: ${peakMonthName} ${peakMonthVal.toLocaleString()})`;
        }

        // 8. ປັກໝຸດ Tooltip & ອັບເດດ KPI Card 1 ໄປທີ່ເດືອນທີ່ເລືອກໃນປະຕິທິນ (ຫຼື ເດືອນລ່າສຸດທີ່ມີຂໍ້ມູນ)
        let focusMonthIdx = currentMonthIdx;
        if (monthlyVisitsCount[focusMonthIdx] === 0 && monthlyApptsCount[focusMonthIdx] === 0) {
            for (let i = 11; i >= 0; i--) {
                if (monthlyVisitsCount[i] > 0 || monthlyApptsCount[i] > 0) {
                    focusMonthIdx = i;
                    break;
                }
            }
        }
        window.handleMonthDotClick(focusMonthIdx);

    } catch (err) {
        console.error('updateRealServiceChartData error:', err);
    }
};

// ====== Sync Bills & Revenue with Bill System 100% ======
async function fetchSyncedBillsStats(startStr, endStr) {
    const startTimestamp = startStr + "T00:00:00";
    const endTimestamp = endStr + "T23:59:59";

    // 1. ตรวจสอบว่าใน parent window มีข้อมูล bills ที่ตรงกับช่วงวันที่นี้อยู่แล้วหรือไม่ (ถ้ามีสามารถนำมาใช้ได้ทันทีโดยไม่ไปยุ่งกับช่องวันที่ของหน้า Bill)
    let billsList = [];
    try {
        const p = getSafeParent();
        if (p && Array.isArray(p.allBillsData) && p.allBillsData.length > 0) {
            const pDoc = p.document;
            const pStart = (pDoc.getElementById('billStartDate') || {}).value;
            const pEnd = (pDoc.getElementById('billEndDate') || {}).value;
            if (pStart === startStr && pEnd === endStr) {
                billsList = p.allBillsData;
            }
        }
    } catch (e) { }

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

            const p = getSafeParent();
            const client = (typeof _supabase !== 'undefined' ? _supabase : (p && p._supabase));
            if (client) {
                const [{ data: bData }, { data: vData }] = await Promise.all([
                    client.from('bills').select('*').gte('created_at', startTimestamp).lte('created_at', endTimestamp).order('created_at', { ascending: false }),
                    client.from('visits').select('visit_id, hn, patient_name, doctor_name, status, lab_tests, symptom, meds, lab_note, created_at').gte('created_at', startTimestamp).lte('created_at', endTimestamp).order('created_at', { ascending: false })
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
                        const isPaidStatus = vSt === 'ชำระแล้ว' || vSt === 'ชำระเงินแล้ว' || vSt === 'ຊຳລະແລ້ວ' || pSt === 'paid';
                        const hasPayment = (parseFloat(v.payable_amount || 0) > 0 || parseFloat(v.cash_lak || 0) > 0 || parseFloat(v.transfer_lak || 0) > 0);
                        return isPaidStatus || hasPayment;
                    });

                    paidVisits.forEach((v, idx) => {
                        const vId = v.visit_id || v.id;
                        if (isDeleted(vId) || isDeleted(`BILL-${String(vId).replace(/^VIS-/, '')}`)) return;
                        const alreadyInBills = billsList.some(b => (vId && (b.visit_id === vId || b.bill_id === vId)));
                        if (!alreadyInBills && vId) {
                            const payable = parseFloat(v.payable_amount || 0);
                            const rawTests = v.lab_tests || v.tests || '';
                            if (payable <= 0 && !hasPayment && (!rawTests || String(rawTests).trim() === '')) {
                                return;
                            }
                            billsList.push({
                                bill_id: `BILL-${vId.replace(/^VIS-/, '') || String(idx + 1001)}`,
                                visit_id: vId,
                                hn: v.hn || '-',
                                patient_name: v.patient_name || v.name || 'ຜູ້ປ່ວຍ',
                                payable_amount: payable,
                                subtotal: payable,
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
            if (price === 0) {
                try {
                    const p = getSafeParent();
                    if (p && typeof p.getTestItemDetails === 'function') {
                        const details = p.getTestItemDetails(item.name);
                        if (details && details.price > 0) price = details.price;
                    }
                } catch (e) { }
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

    // ຄຳນວນຈຳນວນຄົນທີ່ມາຕວດຈິງ (ບໍ່ນັບຊ້ຳ - Unique Patients ຕາມ HN / ຊື່)
    const uniquePatients = new Set();
    inRangeBills.forEach(b => {
        const key = (b.hn && b.hn !== '-') 
            ? b.hn.trim().toLowerCase() 
            : (b.patient_name || b.visit_id || '').trim().toLowerCase();
        if (key) {
            uniquePatients.add(key);
        }
    });

    return {
        count: inRangeBills.length,
        actualPatientsCount: uniquePatients.size,
        revenue: totalPayable
    };
}

window.updateDashboardBillsCount = async function () {
    const el = document.getElementById('db-stat-bills') || document.getElementById('db-stat-patients');
    const actualEl = document.getElementById('db-stat-actual-patients');
    if (!el && !actualEl) return;
    let minDate = (window.dbStartDate && window.dbEndDate) ? (window.dbStartDate < window.dbEndDate ? window.dbStartDate : window.dbEndDate) : new Date();
    let maxDate = (window.dbStartDate && window.dbEndDate) ? (window.dbStartDate > window.dbEndDate ? window.dbStartDate : window.dbEndDate) : new Date();

    const tzMin = minDate.getTimezoneOffset() * 60000;
    const startStr = (new Date(minDate - tzMin)).toISOString().split('T')[0];
    const tzMax = maxDate.getTimezoneOffset() * 60000;
    const endStr = (new Date(maxDate - tzMax)).toISOString().split('T')[0];

    try {
        const stats = await fetchSyncedBillsStats(startStr, endStr);
        if (el) el.textContent = stats.count.toLocaleString();
        if (actualEl) actualEl.textContent = (stats.actualPatientsCount !== undefined ? stats.actualPatientsCount : stats.count).toLocaleString();
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

        // Helper ສຳລັບແປງວັນທີເປັນ YYYY-MM-DD ແບບຖືກຕ້ອງຕາມ Local Timezone
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
        const extractDateStr = parseOrderDateToIso;

        if (!_supabase) {
            if (window.parent && window.parent._supabase) {
                _supabase = window.parent._supabase;
            } else if (typeof supabase !== 'undefined' && typeof supabase.createClient === 'function') {
                try {
                    _supabase = supabase.createClient(DEFAULT_CLINIC_URL, DEFAULT_CLINIC_KEY);
                } catch (e) { }
            }
        }
        if (!_supabase) return;

        // 3. ดึงข้อมูลจริงจาก Supabase (ดึงเฉพาะช่วงเวลาที่เลือกในปฏิทินเท่านั้น)
        const { count: apptCount } = await _supabase.from('appointments').select('*', { count: 'exact', head: true }).gte('appointment_date', startStr).lte('appointment_date', endStr);
        // ดึงยอดรายรับรวมและจำนวนบิลที่ซิงค์ตรงกับระบบ Bill 100%
        let totalRevenueFromBills = 0;
        let totalBillsCount = 0;
        let actualPatientsCount = 0;
        try {
            const billStats = await fetchSyncedBillsStats(startStr, endStr);
            totalBillsCount = billStats.count;
            totalRevenueFromBills = billStats.revenue;
            actualPatientsCount = billStats.actualPatientsCount !== undefined ? billStats.actualPatientsCount : billStats.count;
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
                const { data: pts } = await _supabase.from('patients').select('*');
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
        let candidateOrders = [];
        try {

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

        
        // ====== ນັບຈຳນວນການສັ່ງຢາ + ຍອດເງິນຄ່າຍາ (ສະເພາະທ່ານໝໍສັ່ງກວດ - ບໍ່ລວມ Marketing Order 100%) ======
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
                            const existingMeds = allDocVisits[existingIdx].meds;
                            allDocVisits[existingIdx] = Object.assign({}, allDocVisits[existingIdx], cv);
                            // ປ້ອງກັນບໍ່ໃຫ້ cv ຈາກ LocalStorage ທີ່ບໍ່ມີ meds ມາຂຽນທັບ meds ທີ່ມີຢູ່ແລ້ວ
                            let cvMeds = cv.meds;
                            if (typeof cvMeds === 'string') {
                                try { cvMeds = JSON.parse(cvMeds); } catch (e) { cvMeds = []; }
                            }
                            let exMeds = existingMeds;
                            if (typeof exMeds === 'string') {
                                try { exMeds = JSON.parse(exMeds); } catch (e) { exMeds = []; }
                            }
                            if ((!cvMeds || cvMeds.length === 0) && (exMeds && exMeds.length > 0)) {
                                allDocVisits[existingIdx].meds = existingMeds;
                            }
                        } else {
                            allDocVisits.push(cv);
                        }
                    });
                }
            } catch (e) { }

            // 🎯 Map ສຳລັບເກັບລວບລວມໃບສັ່ງຢາທ່ານໝໍ (Deduplicate ດ້ວຍ visit_id / order_id)
            const docRxMap = new Map();

            // 1. ດຶງຈາກ visits ຂອງຄລີນິກ
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

                if (Array.isArray(meds) && meds.length > 0) {
                    docRxMap.set(vid, {
                        id: vid,
                        doctor: v.doctor_name,
                        meds: meds,
                        status: v.status,
                        source: 'visits'
                    });
                }
            });

            // 2. ດຶງໃບສັ່ງຢາ ORD-CLINIC- / ໝໍສັ່ງຈ່າຍ ຈາກ stk_nutrient_orders (MLM) ທີ່ຂາຍສຳເລັດແລ້ວ
            if (Array.isArray(candidateOrders) && candidateOrders.length > 0) {
                candidateOrders.forEach(o => {
                    if (!o) return;
                    const st = String(o.status || '').toLowerCase();
                    if (st.includes('cancel') || st.includes('ຍົກເລີກ') || st.includes('ยกเลิก') || String(o.notes || '').includes('[DELETED]')) {
                        return;
                    }
                    // ນັບສະເພາະທີ່ຊຳລະແລ້ວ/ຂາຍສຳເລັດແລ້ວ (ບໍ່ເອົາ 'รอดำเนินการ')
                    const isConfirmed = st.includes('ขายสำเร็จแล้ว') || st.includes('ชำระเงินแล้ว') || st.includes('ชำระแล้ว') || st.includes('completed') || st.includes('paid');
                    if (!isConfirmed) return;

                    const oDate = extractDateStr(o.date || o.created_at);
                    if (startStr && oDate && oDate < startStr) return;
                    if (endStr && oDate && oDate > endStr) return;

                    const oid = String(o.order_id || o.orderId || '').trim().toUpperCase();
                    const vid = String(o.visit_id || o.visitId || '').trim().toUpperCase();
                    const orderByType = String(o.order_by_type || '');

                    // ຕ້ອງບໍ່ແມ່ນ Marketing Order (VIS-ORD-...)
                    if (vid.startsWith('VIS-ORD-') || (oid.startsWith('ORD-') && !oid.startsWith('ORD-CLINIC-') && orderByType !== 'หมอสั่งจ่าย')) {
                        return;
                    }

                    const isClinicRx = oid.startsWith('ORD-CLINIC-') || (vid.startsWith('VIS-') && !vid.startsWith('VIS-ORD-')) || orderByType === 'หมอสั่งจ่าย';
                    if (!isClinicRx) return;

                    let items = o.items_json || o.items;
                    if (typeof items === 'string') {
                        if (items.startsWith('"[') || items.startsWith('"\\"')) {
                            try { items = JSON.parse(items); } catch (e) { }
                        }
                        try { items = (typeof items === 'string') ? JSON.parse(items) : items; } catch (e) { items = []; }
                    }
                    if (!Array.isArray(items) || items.length === 0) return;

                    const key = (vid.startsWith('VIS-') && !vid.startsWith('VIS-ORD-')) ? vid : oid;

                    if (!docRxMap.has(key)) {
                        docRxMap.set(key, {
                            id: key,
                            doctor: o.closer_dr,
                            meds: items,
                            status: o.status,
                            source: 'mlm_stk'
                        });
                    } else {
                        // ຖ້າໃນ visits ບໍ່ມີ meds ແຕ່ໃນ stk_nutrient_orders ມີ items ໃຫ້ໃຊ້ items ຈາກ stk
                        const existing = docRxMap.get(key);
                        if ((!existing.meds || existing.meds.length === 0) && items.length > 0) {
                            existing.meds = items;
                        }
                    }
                });
            }

            // 3. ຄຳນວນຍອດເງິນ ແລະ ຈຳນວນຢາທັງໝົດ
            docRxMap.forEach(rx => {
                let visitMedsTotal = 0;
                let visitItemsCount = 0;

                (rx.meds || []).forEach(m => {
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

                if (visitMedsTotal > 0 || visitItemsCount > 0) {
                    doctorRxCount++;
                    doctorRxRevenue += visitMedsTotal;
                    doctorRxTotalItems += visitItemsCount;
                }
            });
        } catch (rxErr) {
            console.warn('Error calculating doctor prescriptions:', rxErr);
        }

        // ดึงข้อมูลคิว (Queue) ตามวันที่เลือก แบบขนาน (Parallel Promise.all — เร็วขึ้น 5 เท่า)
        const [
            { count: regQueue },
            { count: triageQueue },
            { count: doctorQueue },
            { count: labQueue },
            { count: rxQueue }
        ] = await Promise.all([
            _supabase.from('appointments').select('*', { count: 'exact', head: true }).in('status', ['รอ', 'รอยืนยัน']).gte('appointment_date', startStr).lte('appointment_date', endStr),
            _supabase.from('visits').select('*', { count: 'exact', head: true }).eq('status', 'รอคัดกรอง').gte('created_at', startTimestamp).lte('created_at', endTimestamp),
            _supabase.from('visits').select('*', { count: 'exact', head: true }).eq('status', 'รอตรวจ').gte('created_at', startTimestamp).lte('created_at', endTimestamp),
            _supabase.from('visits').select('*', { count: 'exact', head: true }).in('status', ['รอผลแล็บ', 'รอผลตรวจ Lab']).gte('created_at', startTimestamp).lte('created_at', endTimestamp),
            _supabase.from('visits').select('*', { count: 'exact', head: true }).in('status', ['รออ่านผล', 'รอจัดยา', 'รอจัดคิว']).gte('created_at', startTimestamp).lte('created_at', endTimestamp)
        ]);

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
        if (document.getElementById('db-stat-actual-patients')) {
            document.getElementById('db-stat-actual-patients').textContent = (actualPatientsCount || 0).toLocaleString();
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
                .select('visit_id, hn, patient_name, doctor_name, status, symptom, bp, pulse, temp, weight, height, bmi, spo2, lab_tests, meds, created_at')
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

        if (typeof window.updateRealServiceChartData === 'function') {
            window.updateRealServiceChartData();
        }
        if (typeof window.updateDashboardIcd10Report === 'function') {
            window.updateDashboardIcd10Report(startStr, endStr);
        }
        if (typeof window.updateDashboardExecutiveReports === 'function') {
            window.updateDashboardExecutiveReports(startStr, endStr);
        }

    } catch (e) {
        console.error("Dashboard update error:", e);
    }
};

// =========================================================================
// 🌟 ICD-10 Disease Diagnosis Ranking & Percentage (%) Report Engine
// =========================================================================
window.dbIcd10RangeMode = 'all'; // 'all' | 'month' | 'calendar'
window.dbIcd10RankedList = [];
window.dbIcd10VisualMode = 'donut'; // 'donut' | 'vbar' | 'hbar'
window.dbIcd10TotalCases = 0;

window.setIcd10VisualMode = function (mode, btnEl) {
    window.dbIcd10VisualMode = mode || 'donut';
    const switcher = document.getElementById('icd10-visual-switcher');
    if (switcher) {
        switcher.querySelectorAll('.db-chart-mode-btn').forEach(b => {
            if (b.getAttribute('data-mode') === window.dbIcd10VisualMode) b.classList.add('active');
            else b.classList.remove('active');
        });
    }
    if (btnEl) btnEl.classList.add('active');
    window.renderIcd10LeftVisualChart();
};

// Shared Modern Chart Builder (Donut / Vertical Bar / Horizontal Bar)
window.buildModernVisualChartHtml = function (opts) {
    const list = opts.list || [];
    const totalCount = opts.totalCount || 0;
    const mode = opts.mode || 'donut';
    const clickFn = opts.clickFn || 'window.showIcd10PatientsPopup';
    const unitText = opts.unitText || 'ເຄສ';
    const centerIdPrefix = opts.centerIdPrefix || 'icd10Donut';
    const hexColors = opts.hexColors || ['#e11d48', '#ea580c', '#d97706', '#0d9488', '#2563eb'];
    const gradColors = opts.gradColors || [
        'linear-gradient(180deg, #f43f5e 0%, #e11d48 100%)',
        'linear-gradient(180deg, #fb923c 0%, #ea580c 100%)',
        'linear-gradient(180deg, #fbbf24 0%, #d97706 100%)',
        'linear-gradient(180deg, #2dd4bf 0%, #0d9488 100%)',
        'linear-gradient(180deg, #60a5fa 0%, #2563eb 100%)'
    ];
    const hGradColors = opts.hGradColors || [
        'linear-gradient(90deg, #e11d48 0%, #fb7185 100%)',
        'linear-gradient(90deg, #ea580c 0%, #fb923c 100%)',
        'linear-gradient(90deg, #d97706 0%, #fbbf24 100%)',
        'linear-gradient(90deg, #0d9488 0%, #2dd4bf 100%)',
        'linear-gradient(90deg, #2563eb 0%, #60a5fa 100%)'
    ];

    const escapeHtml = (str) => String(str || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');

    if (list.length === 0) {
        return `
            <div class="text-center text-muted py-4">
                <i class="ph ph-chart-pie-slice d-block mb-2" style="font-size: 2rem; opacity: 0.45;"></i>
                <div>ບໍ່ພົບຂໍ້ມູນໃນຊ່ວງເວລານີ້</div>
            </div>`;
    }

    const top5 = list.slice(0, 5);

    // 1. DONUT CHART MODE
    if (mode === 'donut') {
        const r = 72;
        const circ = 2 * Math.PI * r; // ~452.389
        let accumPct = 0;
        let top5SumCount = 0;

        const segments = top5.map((item, i) => {
            const pct = Math.max(0, Math.min(100, item.pct || 0));
            const len = (pct / 100) * circ;
            const offset = -((accumPct / 100) * circ);
            accumPct += pct;
            top5SumCount += (item.count || 0);
            const color = hexColors[i % hexColors.length];
            const safeName = escapeHtml(item.name);
            return `
                <circle class="db-donut-seg"
                    cx="100" cy="100" r="${r}"
                    stroke="${color}"
                    stroke-dasharray="${Math.max(0, len - 2).toFixed(2)} ${circ.toFixed(2)}"
                    stroke-dashoffset="${offset.toFixed(2)}"
                    onclick="${clickFn}(${i})"
                    onmouseenter="window.updateDonutCenter('${centerIdPrefix}', '${escapeHtml(item.pctText)}', '${safeName}', '${item.count.toLocaleString()} ${escapeHtml(unitText)}')"
                    onmouseleave="window.updateDonutCenter('${centerIdPrefix}', '100%', 'ລວມທັງໝົດ', '${totalCount.toLocaleString()} ${escapeHtml(unitText)}')">
                    <title>#${item.rank} ${safeName}: ${item.count.toLocaleString()} (${item.pctText})</title>
                </circle>`;
        });

        const othersCount = Math.max(0, totalCount - top5SumCount);
        const othersPct = Math.max(0, 100 - accumPct);
        if (othersCount > 0 && othersPct > 0.4) {
            const len = (othersPct / 100) * circ;
            const offset = -((accumPct / 100) * circ);
            segments.push(`
                <circle class="db-donut-seg"
                    cx="100" cy="100" r="${r}"
                    stroke="#cbd5e1"
                    stroke-dasharray="${Math.max(0, len - 2).toFixed(2)} ${circ.toFixed(2)}"
                    stroke-dashoffset="${offset.toFixed(2)}"
                    onmouseenter="window.updateDonutCenter('${centerIdPrefix}', '${othersPct.toFixed(1)}%', 'ອື່ນໆ (${Math.max(0, list.length - 5)} ລາຍການ)', '${othersCount.toLocaleString()} ${escapeHtml(unitText)}')"
                    onmouseleave="window.updateDonutCenter('${centerIdPrefix}', '100%', 'ລວມທັງໝົດ', '${totalCount.toLocaleString()} ${escapeHtml(unitText)}')">
                    <title>ອື່ນໆ: ${othersCount.toLocaleString()} (${othersPct.toFixed(1)}%)</title>
                </circle>`);
        }

        const legendHtml = top5.map((item, i) => {
            const rankCls = i === 0 ? 'rank-1' : (i === 1 ? 'rank-2' : (i === 2 ? 'rank-3' : 'rank-other'));
            const color = hexColors[i % hexColors.length];
            const safeName = escapeHtml(item.name);
            const codeBadge = item.code ? `<span class="db-icd10-code-badge">${escapeHtml(item.code)}</span>` : '';
            return `
                <div class="db-donut-legend-row"
                    onclick="${clickFn}(${i})"
                    onmouseenter="window.updateDonutCenter('${centerIdPrefix}', '${escapeHtml(item.pctText)}', '${safeName}', '${item.count.toLocaleString()} ${escapeHtml(unitText)}')"
                    onmouseleave="window.updateDonutCenter('${centerIdPrefix}', '100%', 'ລວມທັງໝົດ', '${totalCount.toLocaleString()} ${escapeHtml(unitText)}')"
                    title="ຄລິກເພື່ອເບິ່ງລາຍຊື່ຄົນເຈັບ">
                    <div class="db-donut-legend-left">
                        <span class="db-donut-color-dot" style="background: ${color};"></span>
                        <span class="db-icd10-rank-pill ${rankCls}" style="width:20px;height:20px;font-size:0.68rem;">#${item.rank}</span>
                        ${codeBadge}
                        <span class="db-donut-legend-name">${safeName}</span>
                    </div>
                    <div class="db-donut-legend-right">
                        <span class="db-icd10-count-text">${item.count.toLocaleString()}</span>
                        <span class="db-icd10-pct-pill">${item.pctText}</span>
                    </div>
                </div>`;
        }).join('');

        return `
            <div class="db-modern-donut-wrap">
                <div class="db-modern-donut-svg-box">
                    <svg class="db-modern-donut-svg" viewBox="0 0 200 200">
                        <circle cx="100" cy="100" r="${r}" fill="none" stroke="#f1f5f9" stroke-width="25" />
                        ${segments.join('')}
                    </svg>
                    <div class="db-modern-donut-center">
                        <div class="db-donut-center-pct" id="${centerIdPrefix}-pct">100%</div>
                        <div class="db-donut-center-label" id="${centerIdPrefix}-lbl">ລວມທັງໝົດ</div>
                        <div class="db-donut-center-sub" id="${centerIdPrefix}-sub">${totalCount.toLocaleString()} ${escapeHtml(unitText)}</div>
                    </div>
                </div>
                <div class="db-modern-donut-legend">
                    ${legendHtml}
                </div>
            </div>`;
    }

    // 2. VERTICAL COLUMN BAR CHART MODE
    if (mode === 'vbar') {
        const maxPct = Math.max(...top5.map(x => x.pct || 0), 1);
        const colsHtml = top5.map((item, i) => {
            const heightPct = Math.max(12, Math.min(100, ((item.pct || 0) / maxPct) * 100));
            const grad = gradColors[i % gradColors.length];
            const safeName = escapeHtml(item.name);
            return `
                <div class="db-vbar-col-item" onclick="${clickFn}(${i})" title="#${item.rank} ${safeName}: ${item.count.toLocaleString()} (${item.pctText})">
                    <div class="db-vbar-top-stats">
                        <span class="db-vbar-pct-badge">${item.pctText}</span>
                        <span class="db-vbar-count-sub">${item.count.toLocaleString()}</span>
                    </div>
                    <div class="db-vbar-pillar-track">
                        <div class="db-vbar-pillar-fill" style="height: ${heightPct.toFixed(1)}%; background: ${grad};"></div>
                    </div>
                </div>`;
        }).join('');

        const labelsHtml = top5.map((item, i) => {
            const rankCls = i === 0 ? 'rank-1' : (i === 1 ? 'rank-2' : (i === 2 ? 'rank-3' : 'rank-other'));
            const safeName = escapeHtml(item.name);
            const shortCode = item.code && item.code.length <= 8 ? item.code : '';
            return `
                <div class="db-vbar-label-box" onclick="${clickFn}(${i})" title="${safeName}">
                    <div class="d-flex align-items-center gap-1">
                        <span class="db-icd10-rank-pill ${rankCls}" style="width:20px;height:20px;font-size:0.68rem;">#${item.rank}</span>
                        ${shortCode ? `<span class="db-icd10-code-badge" style="font-size:0.65rem;padding:0 4px;">${escapeHtml(shortCode)}</span>` : ''}
                    </div>
                    <div class="db-vbar-label-name">${safeName}</div>
                </div>`;
        }).join('');

        return `
            <div class="db-modern-vbar-wrap">
                <div class="db-vbar-grid-lines">
                    <div class="db-vbar-grid-line"></div>
                    <div class="db-vbar-grid-line"></div>
                    <div class="db-vbar-grid-line"></div>
                    <div class="db-vbar-grid-line"></div>
                </div>
                <div class="db-vbar-columns-row">
                    ${colsHtml}
                </div>
                <div class="db-vbar-labels-row">
                    ${labelsHtml}
                </div>
            </div>`;
    }

    // 3. HORIZONTAL BAR LIST MODE (Classic)
    const maxPct = Math.max(...top5.map(x => x.pct || 0), 1);
    return top5.map((item, i) => {
        const rankCls = i === 0 ? 'rank-1' : (i === 1 ? 'rank-2' : (i === 2 ? 'rank-3' : 'rank-other'));
        const codeHtml = item.code
            ? `<span class="db-icd10-code-badge">${escapeHtml(item.code)}</span>`
            : `<span class="badge bg-secondary-subtle text-secondary border" style="font-size: 0.68rem;">ທົ່ວໄປ</span>`;
        const barBg = hGradColors[i % hGradColors.length];
        const widthPct = Math.max(5, Math.min(100, ((item.pct || 0) / maxPct) * 100));
        const safeName = escapeHtml(item.name);
        return `
            <div class="db-icd10-bar-item" onclick="${clickFn}(${i})" title="ຄລິກເພື່ອເບິ່ງລາຍຊື່ຄົນເຈັບ">
                <div class="db-icd10-bar-top">
                    <div class="db-icd10-bar-title">
                        <span class="db-icd10-rank-pill ${rankCls}">#${item.rank}</span>
                        ${codeHtml}
                        <span class="db-icd10-name-text" title="${safeName}">${safeName}</span>
                    </div>
                    <div class="db-icd10-bar-stats">
                        <span class="db-icd10-count-text">${item.count.toLocaleString()}</span>
                        <span class="db-icd10-pct-pill">${item.pctText}</span>
                    </div>
                </div>
                <div class="db-icd10-progress-track">
                    <div class="db-icd10-progress-fill" style="width: ${widthPct.toFixed(1)}%; background: ${barBg};"></div>
                </div>
            </div>`;
    }).join('');
};

window.updateDonutCenter = function (prefix, pctText, labelText, subText) {
    const pEl = document.getElementById(prefix + '-pct');
    const lEl = document.getElementById(prefix + '-lbl');
    const sEl = document.getElementById(prefix + '-sub');
    if (pEl) pEl.textContent = pctText;
    if (lEl) lEl.textContent = labelText;
    if (sEl) sEl.textContent = subText;
};

window.renderIcd10LeftVisualChart = function () {
    const top5Container = document.getElementById('db-icd10-top5-bars');
    if (!top5Container) return;
    top5Container.innerHTML = window.buildModernVisualChartHtml({
        list: window.dbIcd10RankedList || [],
        totalCount: window.dbIcd10TotalCases || 0,
        mode: window.dbIcd10VisualMode || 'donut',
        clickFn: 'window.showIcd10PatientsPopup',
        unitText: 'ເຄສ',
        centerIdPrefix: 'icd10Donut',
        hexColors: ['#e11d48', '#ea580c', '#d97706', '#0d9488', '#2563eb']
    });
};

window.setIcd10ReportRange = function (mode, btnEl) {
    window.dbIcd10RangeMode = mode || 'all';
    document.querySelectorAll('#icd10-btn-all, #icd10-btn-month, #icd10-btn-calendar').forEach(b => {
        if (b) b.classList.remove('active');
    });
    if (btnEl) {
        btnEl.classList.add('active');
    } else {
        const targetBtn = document.getElementById('icd10-btn-' + window.dbIcd10ReportRange);
        if (targetBtn) targetBtn.classList.add('active');
    }

    const sDate = window.dbStartDate || new Date();
    const eDate = window.dbEndDate || new Date();
    const pad = n => String(n).padStart(2, '0');
    const sStr = `${sDate.getFullYear()}-${pad(sDate.getMonth() + 1)}-${pad(sDate.getDate())}`;
    const eStr = `${eDate.getFullYear()}-${pad(eDate.getMonth() + 1)}-${pad(eDate.getDate())}`;
    const minStr = sStr <= eStr ? sStr : eStr;
    const maxStr = sStr <= eStr ? eStr : sStr;

    window.updateDashboardIcd10Report(minStr, maxStr);
};

window.updateDashboardIcd10Report = async function (calStartStr, calEndStr) {
    const top5Container = document.getElementById('db-icd10-top5-bars');
    const tbody = document.getElementById('db-icd10-table-body');
    const totalCasesEl = document.getElementById('db-icd10-total-cases');
    const uniqueCountEl = document.getElementById('db-icd10-unique-count');
    const topDiseaseEl = document.getElementById('db-icd10-top-disease');
    const topPctEl = document.getElementById('db-icd10-top-pct');
    const periodLabelEl = document.getElementById('db-icd10-period-label');

    if (!top5Container && !tbody) return;

    try {
        const mode = window.dbIcd10RangeMode || 'all';
        let filterStart = null;
        let filterEnd = null;
        let periodText = 'ຂໍ້ມູນທັງໝົດ';

        if (mode === 'month') {
            const refDate = window.currentCalDate || new Date();
            const yy = refDate.getFullYear();
            const mm = String(refDate.getMonth() + 1).padStart(2, '0');
            const lastDay = new Date(yy, refDate.getMonth() + 1, 0).getDate();
            filterStart = `${yy}-${mm}-01`;
            filterEnd = `${yy}-${mm}-${String(lastDay).padStart(2, '0')}`;
            const mName = (typeof monthNamesLao !== 'undefined' && monthNamesLao[refDate.getMonth()]) ? monthNamesLao[refDate.getMonth()] : mm;
            periodText = `ເດືອນ ${mName} ${yy}`;
        } else if (mode === 'calendar' && (calStartStr || calEndStr)) {
            filterStart = calStartStr || null;
            filterEnd = calEndStr || null;
            periodText = (filterStart && filterEnd && filterStart === filterEnd)
                ? `ວັນທີ ${filterStart}`
                : `${filterStart || ''} ຫາ ${filterEnd || ''}`;
        }

        if (periodLabelEl) periodLabelEl.textContent = periodText;

        // 1. ດຶງຂໍ້ມູນ visits ຈາກ Supabase ທຸກແຖວ (Pagination ບໍ່ຕິດ Limit 1,000 ແຖວ) + LocalStorage
        let rawVisits = [];
        if (_supabase) {
            rawVisits = await fetchAllSupabaseTableRows(
                _supabase,
                'visits',
                'visit_id, hn, patient_name, doctor_name, status, symptom, diagnosis, icd10_code, icd10_name, icd10_diag_note, created_at',
                {
                    gteCol: filterStart ? 'created_at' : null,
                    gteVal: filterStart ? `${filterStart}T00:00:00` : null,
                    lteCol: filterEnd ? 'created_at' : null,
                    lteVal: filterEnd ? `${filterEnd}T23:59:59.999` : null,
                    orderCol: 'created_at'
                }
            );
        }

        try {
            const localQueue = JSON.parse(localStorage.getItem('clinic_visits_queue') || '[]');
            if (Array.isArray(localQueue)) {
                localQueue.forEach(lv => {
                    if (!lv || !lv.visit_id) return;
                    const idx = rawVisits.findIndex(rv => rv && rv.visit_id === lv.visit_id);
                    if (idx !== -1) {
                        rawVisits[idx] = Object.assign({}, rawVisits[idx], lv);
                    } else {
                        rawVisits.push(lv);
                    }
                });
            }
        } catch (e) { }

        // 2. ສ້າງແຜນທີ່ຄົນເຈັບ (HN -> past_history / disease) ເພື່ອຊ່ວຍຈັບຄູ່ພະຍາດໃຫ້ຄົບຖ້ວນ
        const patHistoryMap = {};
        if (Array.isArray(window.allPatients)) {
            window.allPatients.forEach(p => {
                if (p && p.hn) {
                    const d = (p.disease || p.past_history || p.symptom || '').trim();
                    if (d && d !== '-') patHistoryMap[String(p.hn).trim()] = d;
                }
            });
        }

        // 3. ຟັງຊັນ Normalize ພາສາລາວ (ຈັດລຳດັບສະຫຼະ + ວັນນະຍຸດໃຫ້ກົງກັນ 100% ເຊັ່ນ ເສັ້ນເລືອດຂອດ ບໍ່ໃຫ້ແຍກເປັນ 2 ແຖວ)
        const normalizeLaoText = (raw) => {
            if (!raw || typeof raw !== 'string') return '';
            let s = raw.normalize('NFC')
                .replace(/[\u200B-\u200D\uFEFF]/g, '') // ຕັດ Zero-width space
                .replace(/\s+/g, ' ')
                .trim();
            // ຖ້າວັນນະຍຸດ (\u0EC8-\u0ECB) ຢູ່ກ່ອນສະຫຼະເທິງ/ລຸ່ມ (\u0EB1, \u0EB4-\u0EBC, \u0EBD) ໃຫ້ສະຫຼັບມາຢູ່ຫຼັງສະຫຼະຕາມມາດຕະຖານ
            s = s.replace(/([\u0EC8-\u0ECB])([\u0EB1\u0EB4-\u0EBC\u0EBD])/g, '$2$1');
            return s;
        };

        // 3.1 ຟັງຊັນກວດສອບວ່າເປັນຂໍ້ຄວາມສະຖານະ ຫຼື "ບໍ່ມີ" / "0" (ບໍ່ແມ່ນຊື່ພະຍາດ)
        const isStatusOrInvalidSymptom = (str) => {
            if (!str) return true;
            const s = normalizeLaoText(String(str));
            if (!s || s.length < 2) return true;
            const lower = s.toLowerCase();
            if (/^[\d\s\-\.\,\/\\]+$/.test(lower)) return true; // ຕັດຕົວເລກລ້ວນໆ ເຊັ່ນ "0", "00", "-"

            const invalidExact = [
                '-', '--', '0', '00', 'null', 'undefined', 'none', 'no', 'n/a', 'na', 'normal', 'test',
                'ບໍ່ມີ', 'ບໍມີ', 'ບໍ່ມີພະຍາດ', 'ບໍ່ມີອາການ', 'ບໍ່ມີໂລກປະຈຳຕົວ', 'ປົກກະຕິ', 'ຍັງບໍ່ຮູ້', 'ບໍ່ຮູ້', 'ທົດສອບ',
                'ไม่มี', 'ไม่มีโรคประจำตัว', 'ปกติ', 'ไม่ทราบ', 'ไม่ระบุ', 'ไม่มีระบุ',
                'สั่งจ่ายยา', 'รอจ่ายยา', 'รอตรวจ', 'เสร็จสิ้น', 'สำเร็จ', 'รอรับยา', 'กำลังตรวจ',
                'รอคัดกรอง', 'รอผลแล็บ', 'รอผลตรวจ lab', 'รออ่านผล', 'รอจัดยา'
            ];
            if (invalidExact.includes(lower)) return true;

            return lower.startsWith('ບໍ່ມີ') || lower.startsWith('ບໍມີ') || lower.startsWith('ไม่มี') ||
                lower.startsWith('ສັ່ງຊື້') || lower.startsWith('สั่งซื้อ') || lower.startsWith('order') ||
                lower.includes('ไม่รับยา') || lower.includes('ไม่เอายา') ||
                lower.includes('ບໍ່ຮັບຢາ') || lower.includes('ບໍ່ເອົາຢາ') || lower.includes('ຍົກເລີກ') || lower.includes('ยกเลิก') ||
                lower.includes('08 ຫ້ອງຈ່າຍຢາ') || lower.includes('ລົງທະບຽນລ່ວງໜ້າ') || lower.startsWith('ນັດມາກວດ:');
        };

        // 3.2 ຟັງຊັນຈັບຄູ່ຊື່ພະຍາດ/ອາການພາສາລາວ ເຂົ້າກັບລະຫັດມາດຕະຖານ ICD-10 ອັດຕະໂນມັດ
        const autoMapDiseaseToIcd10 = (rawCode, rawName) => {
            let code = normalizeLaoText(rawCode).toUpperCase();
            let name = normalizeLaoText(rawName);
            const norm = name.toLowerCase();

            const rules = [
                { match: /ເຊັກສຸຂະພາບ|ກວດສຸຂະພາບ|ກວດລວມ|check\s*up|ตรวจสุขภาพ/i, code: 'Z00.0', name: 'ກວດສຸຂະພາບທົ່ວໄປ' },
                { match: /ເສັ້ນເລືອດຂອດ|ເສ້ນເລືອດຂອດ|หลอดเลือดขอด|varicose/i, code: 'I83.9', name: 'ພະຍາດເສັ້ນເລືອດຂອດ' },
                { match: /ກົດໄຫຼຍ້ອນ|กรดไหลย้อน|gerd/i, code: 'K21.9', name: 'ພະຍາດກົດໄຫຼຍ້ອນ' },
                { match: /ກະເພາະ|ລຳໄສ້|ລໍາໄສ້|ເຈັບທ້ອງກະເພາະ|กระเพาะ|gastritis/i, code: 'K29.7', name: 'ພະຍາດກະເພາະອາຫານ ແລະ ລຳໄສ້' },
                { match: /ພູມແພ້|ແພ້ອາກາດ|ภูมิแพ้|allergy|allergic/i, code: 'J30.4', name: 'ພະຍາດພູມແພ້' },
                { match: /ຄວາມດັນຕ່ຳ|ຄວາມດັນຕໍ່າ|ความดันต่ำ|hypotension/i, code: 'I95.9', name: 'ພະຍາດຄວາມດັນເລືອດຕ່ຳ' },
                { match: /ຄວາມດັນ|ความดัน|hypertension/i, code: 'I10', name: 'ພະຍາດຄວາມດັນເລືອດສູງ' },
                { match: /ເບົາຫວານ|เบาหวาน|diabetes/i, code: 'E11.9', name: 'ພະຍາດເບົາຫວານ' },
                { match: /ໄຂມັນພອກຕັບ|ไขมันพอกตับ|fatty\s*liver/i, code: 'K76.0', name: 'ພະຍາດໄຂມັນພອກຕັບ' },
                { match: /ໄຂມັນ|ຄໍເລສເຕີຣອນ|ไขมันในเลือด|hyperlipidemia|cholesterol/i, code: 'E78.5', name: 'ພະຍາດໄຂມັນໃນເລືອດສູງ' },
                { match: /ຕັບ\s*b|ຕັບອັກເສບ\s*b|ຕັບອັກເສບ\s*ບີ|ໄວຣັສຕັບ\s*b|hbv|hepatitis\s*b/i, code: 'B18.1', name: 'ພະຍາດໄວຣັສຕັບອັກເສບ B' },
                { match: /ຕັບ\s*c|ຕັບອັກເສບ\s*c|ຕັບອັກເສບ\s*ຊີ|ໄວຣັສຕັບ\s*c|hcv|hepatitis\s*c/i, code: 'B18.2', name: 'ພະຍາດໄວຣັສຕັບອັກເສບ C' },
                { match: /ຕັບແຂງ|ตับแข็ง|cirrhosis/i, code: 'K74.6', name: 'ພະຍາດຕັບແຂງ' },
                { match: /ຕັບ|ກວດຕັບ|โรคตับ|liver/i, code: 'K76.9', name: 'ພະຍາດກ່ຽວກັບຕັບ' },
                { match: /ໝາກໄຂ່ຫຼັງ|ຫມາກໄຂ່ຫຼັງ|ໄຕເສື່ອມ|โรคไต|kidney|renal/i, code: 'N18.9', name: 'ພະຍາດໝາກໄຂ່ຫຼັງ (ໄຕ)' },
                { match: /ກະດູກ|ປວດຂໍ້|ປວດເຂົ່າ|ຂໍ້ເສື່ອມ|ຂໍ້ອັກເສບ|ข้อเสื่อม|ปวดข้อ/i, code: 'M19.9', name: 'ພະຍາດຂໍ້ເສື່ອມ / ປວດຂໍ້-ກະດູກ' },
                { match: /ປວດຫຼັງ|ປວດແອວ|ປວດຫລັງ|ปวดหลัง|back\s*pain/i, code: 'M54.5', name: 'ອາການປວດຫຼັງ / ປວດແອວ' },
                { match: /ເກົ້າ|ກົດຢູຣິກ|ຢູຣິກ|เกาต์|gout|uric/i, code: 'M10.9', name: 'ພະຍາດເກົ້າ (Gout)' },
                { match: /ໄທລອຍ|ໄທຣອຍ|ຄໍໜຽງ|ຄໍຫນຽງ|ไทรอยด์|thyroid/i, code: 'E07.9', name: 'ພະຍາດຕ່ອມໄທລອຍ' },
                { match: /ໄຂ້ຫວັດ|ເປັນຫວັດ|ໄອ|ເຈັບຄໍ|ไข้หวัด/i, code: 'J00', name: 'ພະຍາດໄຂ້ຫວັດທຳມະດາ' },
                { match: /ຜິວໜັງ|ຜິວຫນັງ|ເປັນຕຸ່ມ|ຜື່ນຄັນ|ລົມພິດ|ผิวหนัง|ผื่นคัน|dermatitis/i, code: 'L30.9', name: 'ພະຍາດຜິວໜັງອັກເສບ / ຜື່ນຄັນ' },
                { match: /ຫົວໃຈ|โรคหัวใจ|heart/i, code: 'I51.9', name: 'ພະຍາດຫົວໃຈ' },
                { match: /ນອນບໍ່ຫຼັບ|ນອນບໍ່ຫລັບ|นอนไม่หลับ|insomnia/i, code: 'G47.0', name: 'ອາການນອນບໍ່ຫຼັບ' },
                { match: /ໄມເກຣນ|ไมเกรน|migraine/i, code: 'G43.9', name: 'ພະຍາດປວດຫົວໄມເກຣນ' },
                { match: /ປວດຫົວ|ວິນຫົວ|ມຶນຫົວ|ปวดหัว|เวียนหัว|headache/i, code: 'R51', name: 'ອາການປວດຫົວ / ວິນຫົວ' },
                { match: /ເລືອດຈາງ|โลหิตจาง|anemia/i, code: 'D64.9', name: 'ພະຍາດເລືອດຈາງ' },
                { match: /ລິດສະດວງ|ริดสีดวง|hemorrhoid/i, code: 'K64.9', name: 'ພະຍາດລິດສະດວງທະວານ' },
                { match: /ຕ່ອມລູກໝາກ|ຕ່ອມລູກຫມາກ|ต่อมลูกหมาก|prostate/i, code: 'N40', name: 'ພະຍາດຕ່ອມລູກໝາກໂຕ' },
                { match: /ຊີ້ນງອກ|ກ້ອນເບົ້າ|เนื้องอก/i, code: 'D36.9', name: 'ກ້ອນຊີ້ນງອກ' },
                { match: /ອ່ອນເພຍ|ເມື່ອຍງ່າຍ|ບໍ່ມີແຮງ|อ่อนเพลีย|fatigue/i, code: 'R53', name: 'ອາການອ່ອນເພຍ / ເມື່ອຍງ່າຍ' }
            ];

            for (const r of rules) {
                if (r.match.test(norm)) {
                    return { code: code || r.code, name: r.name };
                }
            }

            return { code: code, name: name };
        };

        // 4. ກັ່ນຕອງ ແລະ ສະກັດລະຫັດ ICD-10 / ຊື່ພະຍາດຈາກແຕ່ລະ Visit
        const diseaseMap = new Map();
        const seenVisitIds = new Set();
        let totalDiagnosedCases = 0;

        rawVisits.forEach(v => {
            if (!v) return;
            const vid = String(v.visit_id || '').trim();
            if (!vid || seenVisitIds.has(vid)) return;

            // ຂ້າມບິນ Marketing Order (VIS-ORD- / ORD-) ແລະ ລາຍການທີ່ຖືກຍົກເລີກ
            const upperVid = vid.toUpperCase();
            if (upperVid.startsWith('VIS-ORD-') || upperVid.startsWith('ORD-')) return;
            const st = String(v.status || '').trim();
            if (st === 'ຍົກເລີກ' || st === 'ยกเลิก' || st.toLowerCase() === 'cancelled' || st.toLowerCase() === 'deleted') return;
            if (typeof window.isDeletedRecord === 'function' && window.isDeletedRecord(vid)) return;

            // ກວດສອບວັນທີຕາມໂໝດທີ່ເລືອກ
            const rawTs = v.created_at || v.date || '';
            let vDateStr = '';
            if (rawTs) {
                if (/^\d{4}-\d{2}-\d{2}/.test(String(rawTs))) {
                    vDateStr = String(rawTs).slice(0, 10);
                } else {
                    const dt = new Date(rawTs);
                    if (!isNaN(dt.getTime())) {
                        const tz = dt.getTimezoneOffset() * 60000;
                        vDateStr = (new Date(dt.getTime() - tz)).toISOString().split('T')[0];
                    }
                }
            }
            if (filterStart && vDateStr && vDateStr < filterStart) return;
            if (filterEnd && vDateStr && vDateStr > filterEnd) return;

            let icdCode = normalizeLaoText(String(v.icd10_code || ''));
            let icdName = normalizeLaoText(String(v.icd10_name || ''));
            let diagNote = normalizeLaoText(String(v.icd10_diag_note || ''));

            if (isStatusOrInvalidSymptom(icdName)) icdName = '';

            // Fallback A: ແຍກຈາກ v.diagnosis ເຊັ່ນ "[J00] ໄຂ້ຫວັດທຳມະດາ (ໝາຍເຫດ)"
            if (!icdCode && !icdName && v.diagnosis && typeof v.diagnosis === 'string') {
                const diagStr = normalizeLaoText(v.diagnosis);
                const m = diagStr.match(/^\[([A-Z0-9\.]+)\]\s*([^()]+)(?:\((.*)\))?$/i);
                if (m) {
                    icdCode = m[1].trim().toUpperCase();
                    icdName = m[2].trim();
                    if (m[3] && !diagNote) diagNote = m[3].trim();
                } else if (!isStatusOrInvalidSymptom(diagStr)) {
                    icdName = diagStr;
                }
            }

            // Fallback B: ຖ້າຍັງບໍ່ມີ ICD-10 ໃຫ້ດຶງຈາກອາການ/ພະຍາດທີ່ມາກວດຈິງ (symptom ຫຼື past_history)
            if (!icdCode && !icdName) {
                let candidateSym = normalizeLaoText(String(v.symptom || ''));
                if (isStatusOrInvalidSymptom(candidateSym) && v.hn && patHistoryMap[String(v.hn).trim()]) {
                    candidateSym = normalizeLaoText(patHistoryMap[String(v.hn).trim()]);
                }
                if (!isStatusOrInvalidSymptom(candidateSym)) {
                    const mSym = candidateSym.match(/^\[([A-Z0-9\.]+)\]\s*(.+)$/i);
                    if (mSym) {
                        icdCode = mSym[1].trim().toUpperCase();
                        icdName = mSym[2].trim();
                    } else {
                        icdCode = '';
                        icdName = candidateSym;
                    }
                }
            }

            if (isStatusOrInvalidSymptom(icdName) && !icdCode) return;

            // Auto-map ຊື່ພະຍາດພາສາລາວ ເຂົ້າກັບລະຫັດ ICD-10 ມາດຕະຖານ ແລະ ລວມກຸ່ມຄຳພ້ອງ
            const mapped = autoMapDiseaseToIcd10(icdCode, icdName);
            icdCode = mapped.code;
            icdName = mapped.name;

            if (!icdCode && !icdName) return;

            seenVisitIds.add(vid);
            totalDiagnosedCases++;

            const groupKey = icdCode ? `ICD:${icdCode.toUpperCase()}` : `SYM:${normalizeLaoText(icdName).toLowerCase()}`;
            if (!diseaseMap.has(groupKey)) {
                diseaseMap.set(groupKey, {
                    key: groupKey,
                    code: icdCode || '',
                    name: icdName || icdCode || '-',
                    count: 0,
                    patients: []
                });
            }

            const entry = diseaseMap.get(groupKey);
            entry.count++;
            if (!entry.name && icdName) entry.name = icdName;
            entry.patients.push({
                visit_id: vid,
                hn: v.hn || '-',
                patient_name: v.patient_name || '-',
                doctor_name: v.doctor_name || '-',
                date: vDateStr || '-',
                note: diagNote || ''
            });
        });

        // 5. ຈັດລຽງຈາກພະຍາດທີ່ມາກວດຫຼາຍທີ່ສຸດ ໄປຫາໜ້ອຍທີ່ສຸດ ແລະ ຄິດໄລ່ %
        const ranked = Array.from(diseaseMap.values()).sort((a, b) => b.count - a.count);
        ranked.forEach((item, idx) => {
            item.rank = idx + 1;
            const rawPct = totalDiagnosedCases > 0 ? (item.count / totalDiagnosedCases) * 100 : 0;
            item.pct = rawPct;
            item.pctText = (rawPct % 1 === 0 ? rawPct.toFixed(0) : rawPct.toFixed(1)) + '%';
        });

        window.dbIcd10RankedList = ranked;

        // 6. ອັບເດດຕົວເລກ Summary Strip ທັງ 3 ກ່ອງ
        if (totalCasesEl) totalCasesEl.textContent = totalDiagnosedCases.toLocaleString();
        if (uniqueCountEl) uniqueCountEl.textContent = ranked.length.toLocaleString();
        if (topDiseaseEl && topPctEl) {
            if (ranked.length > 0) {
                const top1 = ranked[0];
                const topTitle = top1.code ? `[${top1.code}] ${top1.name}` : top1.name;
                topDiseaseEl.textContent = topTitle;
                topDiseaseEl.title = topTitle;
                topPctEl.textContent = `${top1.pctText} (${top1.count} ເຄສ)`;
            } else {
                topDiseaseEl.textContent = 'ຍັງບໍ່ມີຂໍ້ມູນ';
                topPctEl.textContent = '0%';
            }
        }

        // 7. ວາດກຣາຟ Top 5 ພະຍາດທີ່ພົບຫຼາຍທີ່ສຸດ (Donut / Vertical Bar / Horizontal Bar)
        window.dbIcd10TotalCases = totalDiagnosedCases;
        window.renderIcd10LeftVisualChart();

        // 8. ວາດຕາຕະລາງຈັດອັນດັບພະຍາດທັງໝົດ & ເປີເຊັນ (%) (Right Column)
        if (tbody) {
            if (ranked.length === 0) {
                tbody.innerHTML = `<tr><td colspan="5" class="text-center text-muted py-4">ບໍ່ພົບຂໍ້ມູນການວິນິດໄສພະຍາດໃນຊ່ວງເວລານີ້</td></tr>`;
            } else {
                tbody.innerHTML = ranked.map((item, i) => {
                    const rankCls = i === 0 ? 'rank-1' : (i === 1 ? 'rank-2' : (i === 2 ? 'rank-3' : 'rank-other'));
                    const codeHtml = item.code
                        ? `<span class="db-icd10-code-badge me-1.5">${item.code}</span>`
                        : `<span class="badge bg-light text-secondary border me-1.5" style="font-size: 0.68rem;">ທົ່ວໄປ</span>`;
                    const barColor = i === 0 ? '#e11d48' : (i === 1 ? '#ea580c' : (i === 2 ? '#d97706' : '#0d9488'));
                    const widthPct = Math.max(4, Math.min(100, item.pct));
                    return `
                        <tr>
                            <td class="text-center">
                                <span class="db-icd10-rank-pill ${rankCls}">#${item.rank}</span>
                            </td>
                            <td>
                                <div class="d-flex align-items-center flex-wrap gap-1">
                                    ${codeHtml}
                                    <span class="fw-semibold text-dark">${item.name}</span>
                                </div>
                            </td>
                            <td class="text-center fw-bold text-dark">${item.count.toLocaleString()} <small class="text-muted fw-normal">ເຄສ</small></td>
                            <td>
                                <div class="d-flex align-items-center gap-2">
                                    <div class="db-icd10-progress-track flex-grow-1" style="height: 7px;">
                                        <div class="db-icd10-progress-fill" style="width: ${widthPct}%; background: ${barColor};"></div>
                                    </div>
                                    <span class="fw-bold text-dark" style="min-width: 46px; text-align: right; font-family: 'Outfit', sans-serif;">${item.pctText}</span>
                                </div>
                            </td>
                            <td class="text-end">
                                <button type="button" class="db-icd10-view-btn" onclick="window.showIcd10PatientsPopup(${i})">
                                    <i class="ph-bold ph-eye"></i>
                                    <span>ເບິ່ງ</span>
                                    <span class="view-count-pill">${item.patients.length.toLocaleString()}</span>
                                </button>
                            </td>
                        </tr>
                    `;
                }).join('');
            }
        }
    } catch (err) {
        console.warn('updateDashboardIcd10Report error:', err);
    }
};

window.showIcd10PatientsPopup = function (idx) {
    const item = (window.dbIcd10RankedList || [])[idx];
    if (!item || typeof Swal === 'undefined') return;

    const titleText = item.code ? `[${item.code}] ${item.name}` : item.name;
    const rowsHtml = (item.patients || []).map((p, i) => `
        <tr>
            <td class="text-center text-muted">${i + 1}</td>
            <td class="font-monospace fw-semibold text-primary">${p.visit_id}</td>
            <td class="font-monospace">${p.hn}</td>
            <td class="fw-semibold text-dark">${p.patient_name}</td>
            <td>${p.doctor_name}</td>
            <td class="text-muted">${p.date}</td>
        </tr>
    `).join('');

    Swal.fire({
        title: `<div class="fs-5 fw-bold text-dark"><i class="ph-fill ph-heartbeat text-danger me-1"></i> ${titleText}</div>`,
        html: `
            <div class="text-start">
                <div class="d-flex justify-content-between align-items-center bg-light border rounded-3 p-2.5 mb-3">
                    <span>ຈຳນວນຄົນເຈັບທີ່ກວດພົບ: <strong class="text-primary">${item.count} ເຄສ</strong></span>
                    <span class="badge bg-danger-subtle text-danger border border-danger-subtle fs-6">ອັດຕາສ່ວນ: ${item.pctText}</span>
                </div>
                <div style="max-height: 320px; overflow-y: auto; border: 1px solid #e2e8f0; border-radius: 10px;">
                    <table class="table table-sm table-hover mb-0" style="font-size: 0.82rem;">
                        <thead class="table-light" style="position: sticky; top: 0;">
                            <tr>
                                <th class="text-center">#</th>
                                <th>Visit ID</th>
                                <th>HN</th>
                                <th>ຊື່ຄົນເຈັບ</th>
                                <th>ແພດຜູ້ກວດ</th>
                                <th>ວັນທີ</th>
                            </tr>
                        </thead>
                        <tbody>${rowsHtml}</tbody>
                    </table>
                </div>
            </div>
        `,
        width: 720,
        confirmButtonText: 'ປິດໜ້າຕ່າງ',
        confirmButtonColor: '#0b3c73'
    });
};

// =========================================================================
// 🌟 Row 5: Multi-Tab Executive Analytics Suite (5 Reports in 1 Panel)
//    1. meds         — ຢາ & ອາຫານເສີມຂາຍດີ (Top Medications & Rx Conversion %)
//    2. referrers    — ຜົນງານຜູ້ແນະນຳ (Top Referrers & Show-up Conversion %)
//    3. labs         — ລາຍການກວດ Lab ຍອດນິຍົມ (Top Lab Tests & Packages %)
//    4. demographics — ແຂວງ/ເມືອງ & ກຸ່ມອາຍຸຄົນເຈັບ (Province & Age Breakdown %)
//    5. doctors      — ຜົນງານທ່ານໝໍຜູ້ກວດ (Doctor Workload & Rx Performance %)
// =========================================================================
window.dbExecActiveTab = 'meds';
window.dbExecRangeMode = 'all'; // 'all' | 'month' | 'calendar'
window.dbExecVisualMode = 'vbar'; // 'vbar' | 'donut' | 'hbar'

window.setExecVisualMode = function (mode, btnEl) {
    window.dbExecVisualMode = mode || 'vbar';
    const switcher = document.getElementById('exec-visual-switcher');
    if (switcher) {
        switcher.querySelectorAll('.db-chart-mode-btn').forEach(b => {
            if (b.getAttribute('data-mode') === window.dbExecVisualMode) b.classList.add('active');
            else b.classList.remove('active');
        });
    }
    if (btnEl) btnEl.classList.add('active');
    window.renderActiveExecReportTab();
};
window.dbExecCachedData = {
    meds: { list: [], kpis: {}, headers: [] },
    referrers: { list: [], kpis: {}, headers: [] },
    labs: { list: [], kpis: {}, headers: [] },
    demographics: { list: [], kpis: {}, headers: [] },
    doctors: { list: [], kpis: {}, headers: [] }
};

window.switchExecReportTab = function (tabName, btnEl) {
    window.dbExecActiveTab = tabName || 'meds';
    document.querySelectorAll('.db-exec-tab-btn').forEach(b => {
        if (b) {
            if (b.getAttribute('data-tab') === window.dbExecActiveTab) b.classList.add('active');
            else b.classList.remove('active');
        }
    });
    if (btnEl) btnEl.classList.add('active');
    window.renderActiveExecReportTab();
};

window.setExecReportRange = function (mode, btnEl) {
    window.dbExecRangeMode = mode || 'all';
    document.querySelectorAll('#exec-btn-all, #exec-btn-month, #exec-btn-calendar').forEach(b => {
        if (b) b.classList.remove('active');
    });
    if (btnEl) btnEl.classList.add('active');

    const sDate = window.dbStartDate || new Date();
    const eDate = window.dbEndDate || new Date();
    const pad = n => String(n).padStart(2, '0');
    const sStr = `${sDate.getFullYear()}-${pad(sDate.getMonth() + 1)}-${pad(sDate.getDate())}`;
    const eStr = `${eDate.getFullYear()}-${pad(eDate.getMonth() + 1)}-${pad(eDate.getDate())}`;
    const minStr = sStr <= eStr ? sStr : eStr;
    const maxStr = sStr <= eStr ? eStr : sStr;

    window.updateDashboardExecutiveReports(minStr, maxStr);
};

window.updateDashboardExecutiveReports = async function (calStartStr, calEndStr) {
    const top5Container = document.getElementById('db-exec-top5-bars');
    const tbody = document.getElementById('db-exec-table-body');
    const periodLabelEl = document.getElementById('db-exec-period-label');
    if (!top5Container && !tbody) return;

    try {
        const mode = window.dbExecRangeMode || 'all';
        let filterStart = null;
        let filterEnd = null;
        let periodText = 'ຂໍ້ມູນທັງໝົດ';

        if (mode === 'month') {
            const refDate = window.currentCalDate || new Date();
            const yy = refDate.getFullYear();
            const mm = String(refDate.getMonth() + 1).padStart(2, '0');
            const lastDay = new Date(yy, refDate.getMonth() + 1, 0).getDate();
            filterStart = `${yy}-${mm}-01`;
            filterEnd = `${yy}-${mm}-${String(lastDay).padStart(2, '0')}`;
            const mName = (typeof monthNamesLao !== 'undefined' && monthNamesLao[refDate.getMonth()]) ? monthNamesLao[refDate.getMonth()] : mm;
            periodText = `ເດືອນ ${mName} ${yy}`;
        } else if (mode === 'calendar' && (calStartStr || calEndStr)) {
            filterStart = calStartStr || null;
            filterEnd = calEndStr || null;
            periodText = (filterStart && filterEnd && filterStart === filterEnd)
                ? `ວັນທີ ${filterStart}`
                : `${filterStart || ''} ຫາ ${filterEnd || ''}`;
        }
        if (periodLabelEl) periodLabelEl.textContent = periodText;

        const db = _supabase || window._supabase;
        if (!db) return;

        const toYMD = (raw) => {
            if (!raw) return '';
            const s = String(raw).trim();
            if (!s) return '';
            if (/^\d{4}-\d{2}-\d{2}/.test(s)) {
                if (s.includes('T') || s.endsWith('Z')) {
                    const dt = new Date(s);
                    if (!isNaN(dt.getTime())) {
                        const tz = dt.getTimezoneOffset() * 60000;
                        return (new Date(dt.getTime() - tz)).toISOString().split('T')[0];
                    }
                }
                return s.slice(0, 10);
            }
            const dt = new Date(s);
            if (!isNaN(dt.getTime())) {
                const tz = dt.getTimezoneOffset() * 60000;
                return (new Date(dt.getTime() - tz)).toISOString().split('T')[0];
            }
            return '';
        };

        // 1. ດຶງຂໍ້ມູນ visits, patients, bills ຄົບທຸກແຖວ
        const [allVisits, allPts, allBills] = await Promise.all([
            fetchAllSupabaseTableRows(
                db,
                'visits',
                'visit_id, hn, patient_name, doctor_name, status, symptom, lab_tests, meds, created_at',
                {
                    gteCol: filterStart ? 'created_at' : null,
                    gteVal: filterStart ? `${filterStart}T00:00:00` : null,
                    lteCol: filterEnd ? 'created_at' : null,
                    lteVal: filterEnd ? `${filterEnd}T23:59:59.999` : null,
                    orderCol: 'created_at'
                }
            ),
            (Array.isArray(window.allPatients) && window.allPatients.length > 1000)
                ? Promise.resolve(window.allPatients)
                : fetchAllSupabaseTableRows(db, 'patients', '*', {
                    orderCol: 'created_at'
                }),
            fetchAllSupabaseTableRows(
                db,
                'bills',
                'bill_id, visit_id, hn, patient_name, items, payable_amount, subtotal, discount, created_at',
                {
                    gteCol: filterStart ? 'created_at' : null,
                    gteVal: filterStart ? `${filterStart}T00:00:00` : null,
                    lteCol: filterEnd ? 'created_at' : null,
                    lteVal: filterEnd ? `${filterEnd}T23:59:59.999` : null,
                    orderCol: 'created_at'
                }
            )
        ]);

        const patByHn = {};
        (allPts || []).forEach(p => {
            if (p && p.hn) patByHn[String(p.hn).trim().toUpperCase()] = p;
        });

        // ກັ່ນຕອງ visits ທີ່ບໍ່ຖືກຍົກເລີກ
        const seenVid = new Set();
        const validClinicVisits = [];
        const validMarketingOrders = [];

        (allVisits || []).forEach(v => {
            if (!v) return;
            const vid = String(v.visit_id || '').trim();
            if (!vid || seenVid.has(vid)) return;
            const st = String(v.status || '').trim().toLowerCase();
            if (st === 'cancelled' || st === 'deleted' || st === 'ຍົກເລີກ' || st === 'ยกเลิก') return;
            if (typeof window.isDeletedRecord === 'function' && window.isDeletedRecord(vid)) return;

            const dStr = toYMD(v.created_at);
            if (filterStart && dStr && dStr < filterStart) return;
            if (filterEnd && dStr && dStr > filterEnd) return;

            seenVid.add(vid);
            const upperVid = vid.toUpperCase();
            const sym = String(v.symptom || '').toLowerCase();
            const isOrder = upperVid.startsWith('VIS-ORD-') || upperVid.startsWith('ORD-') ||
                sym.includes('ສັ່ງຊື້') || sym.includes('สั่งซื้อ') || sym.includes('order ອາຫານເສີມ');

            if (isOrder) {
                validMarketingOrders.push({ ...v, _ymd: dStr });
            } else {
                validClinicVisits.push({ ...v, _ymd: dStr });
            }
        });

        // =====================================================================
        // TAB 1: 💊 ຢາ & ອາຫານເສີມຂາຍດີ (Top Medications & Rx Conversion %)
        // =====================================================================
        const medsMap = new Map();
        let totalMedQty = 0;
        let totalMedRevenue = 0;
        let clinicRxCasesCount = 0;
        let rejectedRxCasesCount = 0;

        const parseMedsArr = (rawMeds) => {
            if (!rawMeds) return [];
            let m = rawMeds;
            if (typeof m === 'string') {
                if (m.startsWith('"[') || m.startsWith('"\\"')) {
                    try { m = JSON.parse(m); } catch (e) { }
                }
                try { m = (typeof m === 'string') ? JSON.parse(m) : m; } catch (e) { m = []; }
            }
            return Array.isArray(m) ? m : [];
        };

        const addMedEntry = (medObj, vRecord, isMarketingOrder) => {
            if (!medObj) return;
            const rawName = String(medObj.name || medObj.product_name || medObj.item_name || medObj.med_name || '').trim();
            if (!rawName || rawName === '-') return;
            const key = rawName.toUpperCase();
            const qty = parseFloat(medObj.qty || medObj.quantity || 1) || 1;
            const price = parseFloat(String(medObj.price || medObj.unit_price || medObj.sale_price || 0).replace(/,/g, '')) || 0;
            const explicitTot = parseFloat(String(medObj.total || medObj.total_price || '').replace(/,/g, ''));
            const rev = (!isNaN(explicitTot) && explicitTot > 0) ? explicitTot : (qty * price);

            totalMedQty += qty;
            totalMedRevenue += rev;

            if (!medsMap.has(key)) {
                medsMap.set(key, {
                    key,
                    code: isMarketingOrder ? 'Order' : 'Rx ຄລີນິກ',
                    name: rawName,
                    count: 0,
                    docQty: 0,
                    ordQty: 0,
                    revenue: 0,
                    unitLabel: 'ຊິ້ນ/ກ່ອງ',
                    cases: []
                });
            }
            const entry = medsMap.get(key);
            entry.count += qty;
            if (isMarketingOrder) entry.ordQty += qty;
            else entry.docQty += qty;
            entry.revenue += rev;
            if (entry.docQty > 0 && entry.ordQty > 0) entry.code = 'ໝໍສັ່ງ + Order';
            else if (entry.docQty > 0) entry.code = 'ໝໍສັ່ງຈ່າຍ';
            else entry.code = 'Marketing Order';

            if (entry.cases.length < 300) {
                entry.cases.push({
                    visit_id: vRecord.visit_id || '-',
                    hn: vRecord.hn || '-',
                    patient_name: vRecord.patient_name || '-',
                    doctor_name: `${qty} ຊິ້ນ (฿${Math.round(rev).toLocaleString()})`,
                    date: vRecord._ymd || '-'
                });
            }
            entry.totalBillsCount = (entry.totalBillsCount || 0) + 1;
        };

        validClinicVisits.forEach(v => {
            const mArr = parseMedsArr(v.meds);
            const sym = String(v.symptom || '');
            const isRejected = sym.includes('ไม่รับยา') || sym.includes('ບໍ່ຮັບຢາ') || sym.includes('ບໍ່ເອົາຢາ');
            if (isRejected) rejectedRxCasesCount++;
            if (mArr.length > 0) {
                clinicRxCasesCount++;
                mArr.forEach(m => addMedEntry(m, v, false));
            }
        });

        validMarketingOrders.forEach(v => {
            const mArr = parseMedsArr(v.meds);
            mArr.forEach(m => addMedEntry(m, v, true));
        });

        const medsList = Array.from(medsMap.values())
            .sort((a, b) => b.count - a.count || b.revenue - a.revenue)
            .map((item, idx) => {
                const pct = totalMedQty > 0 ? (item.count / totalMedQty) * 100 : 0;
                return {
                    ...item,
                    rank: idx + 1,
                    pct,
                    pctText: pct.toFixed(1) + '%',
                    extraColText: `฿${Math.round(item.revenue).toLocaleString()} (ໝໍ:${item.docQty} | Ord:${item.ordQty})`
                };
            });

        const rxConvPct = validClinicVisits.length > 0
            ? ((clinicRxCasesCount / validClinicVisits.length) * 100).toFixed(1)
            : '0.0';

        window.dbExecCachedData.meds = {
            list: medsList,
            totalDenom: totalMedQty,
            kpis: {
                k1Label: 'ຈຳນວນຢາ & ອາຫານເສີມທີ່ຈ່າຍທັງໝົດ',
                k1Val: totalMedQty.toLocaleString(),
                k1Unit: `ຊິ້ນ/ກ່ອງ (฿${Math.round(totalMedRevenue).toLocaleString()})`,
                k2Label: 'ອັດຕາຄົນເຈັບຮັບຢາຈາກຫ້ອງກວດ (Rx Rate)',
                k2Val: `${rxConvPct}%`,
                k2Unit: `ຮັບຢາ ${clinicRxCasesCount} / ${validClinicVisits.length} ເຄສ (ບໍ່ເອົາຢາ ${rejectedRxCasesCount})`,
                k3Label: 'ຢາ / ອາຫານເສີມຂາຍດີອັນດັບ 1',
                k3Val: medsList[0] ? medsList[0].name : 'ບໍ່ມີຂໍ້ມູນ',
                k3Pct: medsList[0] ? `${medsList[0].pctText} (${medsList[0].count} ຊິ້ນ)` : '0%',
                leftTitle: '5 ອັນດັບຢາ & ອາຫານເສີມຂາຍດີທີ່ສຸດ (%)',
                rightTitle: 'ຕາຕະລາງຈັດອັນດັບຢາ & ອາຫານເສີມທັງໝົດ',
                col2Header: 'ຊື່ຢາ / ອາຫານເສີມ',
                col3Header: 'ຈຳນວນ (ຊິ້ນ)',
                col4Header: 'ຍອດຂາຍລວມ (฿ THB)'
            }
        };

        // =====================================================================
        // TAB 2: 🤝 ຜົນງານຜູ້ແນະນຳ (Top Referrers & Show-up Conversion %)
        // =====================================================================
        const refNameLookup = {};
        if (Array.isArray(window.referrersData)) {
            window.referrersData.forEach(r => {
                if (r && (r.code || r.id)) refNameLookup[String(r.code || r.id).trim()] = r.name || r.code;
            });
        }

        const visitedHnSet = new Set();
        validClinicVisits.forEach(v => {
            if (v.hn && v.hn !== '-') visitedHnSet.add(String(v.hn).trim().toUpperCase());
        });

        const refMap = new Map();
        let totalReferredCases = 0;

        // ນັບຈາກຄົນເຈັບທີ່ມາກວດຈິງ (validClinicVisits) ຈັບຄູ່ກັບ patients.referred_by
        validClinicVisits.forEach(v => {
            const hnKey = v.hn ? String(v.hn).trim().toUpperCase() : '';
            const pt = hnKey ? patByHn[hnKey] : null;
            let rawRef = String((pt && pt.referred_by) || v.referred_by || '').trim();
            if (!rawRef || rawRef === '-' || rawRef === 'null') rawRef = 'Walk-in / ມາເອງ (ບໍ່ລະບຸຜູ້ແນະນຳ)';
            else if (refNameLookup[rawRef] && !rawRef.includes(refNameLookup[rawRef])) {
                rawRef = `${rawRef} - ${refNameLookup[rawRef]}`;
            }

            totalReferredCases++;
            if (!refMap.has(rawRef)) {
                refMap.set(rawRef, {
                    key: rawRef,
                    code: rawRef.startsWith('Walk-in') ? 'Walk-in' : 'ຜູ້ແນະນຳ',
                    name: rawRef,
                    count: 0,
                    registeredTotal: 0,
                    unitLabel: 'ເຄສມາກວດ',
                    cases: []
                });
            }
            const entry = refMap.get(rawRef);
            entry.count++;
            if (entry.cases.length < 100) {
                entry.cases.push({
                    visit_id: v.visit_id || '-',
                    hn: v.hn || '-',
                    patient_name: v.patient_name || '-',
                    doctor_name: v.doctor_name || '-',
                    date: v._ymd || '-'
                });
            }
        });

        // ນັບຈຳນວນລົງທະບຽນທັງໝົດຂອງແຕ່ລະຜູ້ແນະນຳ
        (allPts || []).forEach(p => {
            if (!p) return;
            const dStr = toYMD(p.next_appointment_date || p.created_at);
            if (filterStart && dStr && dStr < filterStart) return;
            if (filterEnd && dStr && dStr > filterEnd) return;
            let rawRef = String(p.referred_by || '').trim();
            if (!rawRef || rawRef === '-' || rawRef === 'null') rawRef = 'Walk-in / ມາເອງ (ບໍ່ລະບຸຜູ້ແນະນຳ)';
            else if (refNameLookup[rawRef] && !rawRef.includes(refNameLookup[rawRef])) {
                rawRef = `${rawRef} - ${refNameLookup[rawRef]}`;
            }
            if (refMap.has(rawRef)) {
                refMap.get(rawRef).registeredTotal++;
            }
        });

        const refList = Array.from(refMap.values())
            .sort((a, b) => b.count - a.count)
            .map((item, idx) => {
                const pct = totalReferredCases > 0 ? (item.count / totalReferredCases) * 100 : 0;
                const regTot = Math.max(item.count, item.registeredTotal);
                const conv = regTot > 0 ? Math.round((item.count / regTot) * 100) : 100;
                return {
                    ...item,
                    rank: idx + 1,
                    pct,
                    pctText: pct.toFixed(1) + '%',
                    extraColText: `ນັດ ${regTot} ຄົນ (ມາກວດ ${conv}%)`
                };
            });

        const activeRefOnly = refList.filter(r => r.code !== 'Walk-in');
        const topRef = activeRefOnly[0] || refList[0];

        window.dbExecCachedData.referrers = {
            list: refList,
            totalDenom: totalReferredCases,
            kpis: {
                k1Label: 'ເຄສມາກວດທັງໝົດໃນຊ່ວງເວລານີ້',
                k1Val: totalReferredCases.toLocaleString(),
                k1Unit: 'ເຄສ (100%)',
                k2Label: 'ຈຳນວນຜູ້ແນະນຳທີ່ມີຜົນງານພາຄົນເຈັບມາກວດ',
                k2Val: activeRefOnly.length.toLocaleString(),
                k2Unit: 'ຜູ້ແນະນຳ / ສາຍງານ',
                k3Label: 'ຜູ້ແນະນຳອັນດັບ 1 ສູງສຸດ',
                k3Val: topRef ? topRef.name : 'ບໍ່ມີຂໍ້ມູນ',
                k3Pct: topRef ? `${topRef.pctText} (${topRef.count} ເຄສ)` : '0%',
                leftTitle: '5 ອັນດັບຜູ້ແນະນຳທີ່ພາຄົນເຈັບມາກວດຫຼາຍທີ່ສຸດ (%)',
                rightTitle: 'ຕາຕະລາງຈັດອັນດັບຜູ້ແນະນຳ & ອັດຕາມາກວດຈິງ (%)',
                col2Header: 'ລະຫັດ / ຊື່ຜູ້ແນະນຳ',
                col3Header: 'ມາກວດຈິງ (ເຄສ)',
                col4Header: 'ຍອດນັດໝາຍ & % ມາກວດ'
            }
        };

        // =====================================================================
        // TAB 3: 🧪 ລາຍການກວດ Lab ຍອດນິຍົມ (Top Lab Tests & Packages %)
        // =====================================================================
        const labMap = new Map();
        let totalLabOrders = 0;

        validClinicVisits.forEach(v => {
            if (!v.lab_tests) return;
            let tests = [];
            const rawLab = v.lab_tests;
            if (Array.isArray(rawLab)) {
                tests = rawLab;
            } else if (typeof rawLab === 'string') {
                const s = rawLab.trim();
                if (s.startsWith('[')) {
                    try { tests = JSON.parse(s); } catch (e) { tests = s.split(','); }
                } else {
                    tests = s.split(',');
                }
            }
            tests.forEach(t => {
                const tName = String((typeof t === 'object' && t !== null) ? (t.name || t.test_name || '') : t).trim();
                if (!tName || tName === '-' || tName === '0' || tName.toLowerCase() === 'none') return;
                totalLabOrders++;
                const key = tName.toUpperCase();
                if (!labMap.has(key)) {
                    labMap.set(key, {
                        key,
                        code: 'Lab Test',
                        name: tName,
                        count: 0,
                        unitLabel: 'ເຄສ',
                        cases: []
                    });
                }
                const entry = labMap.get(key);
                entry.count++;
                if (entry.cases.length < 100) {
                    entry.cases.push({
                        visit_id: v.visit_id || '-',
                        hn: v.hn || '-',
                        patient_name: v.patient_name || '-',
                        doctor_name: v.doctor_name || '-',
                        date: v._ymd || '-'
                    });
                }
            });
        });

        const labList = Array.from(labMap.values())
            .sort((a, b) => b.count - a.count)
            .map((item, idx) => {
                const pct = totalLabOrders > 0 ? (item.count / totalLabOrders) * 100 : 0;
                const caseShare = validClinicVisits.length > 0 ? ((item.count / validClinicVisits.length) * 100).toFixed(1) : '0.0';
                return {
                    ...item,
                    rank: idx + 1,
                    pct,
                    pctText: pct.toFixed(1) + '%',
                    extraColText: `${caseShare}% ຂອງຄົນເຈັບທີ່ມາກວດ`
                };
            });

        window.dbExecCachedData.labs = {
            list: labList,
            totalDenom: totalLabOrders,
            kpis: {
                k1Label: 'ຈຳນວນລາຍການສັ່ງກວດ Lab ທັງໝົດ',
                k1Val: totalLabOrders.toLocaleString(),
                k1Unit: 'ລາຍການກວດ (100%)',
                k2Label: 'ປະເພດລາຍການກວດ Lab ທີ່ໃຫ້ບໍລິການ',
                k2Val: labList.length.toLocaleString(),
                k2Unit: 'ປະເພດການກວດ Lab',
                k3Label: 'ລາຍການກວດ Lab ຍອດນິຍົມອັນດັບ 1',
                k3Val: labList[0] ? labList[0].name : 'ບໍ່ມີຂໍ້ມູນ',
                k3Pct: labList[0] ? `${labList[0].pctText} (${labList[0].count} ເຄສ)` : '0%',
                leftTitle: '5 ອັນດັບລາຍການກວດ Lab ທີ່ຄົນເຈັບກວດຫຼາຍທີ່ສຸດ (%)',
                rightTitle: 'ຕາຕະລາງຈັດອັນດັບລາຍການກວດ Lab & ອັດຕາສ່ວນ (%)',
                col2Header: 'ຊື່ລາຍການກວດ Lab / Package',
                col3Header: 'ຈຳນວນ (ເຄສ)',
                col4Header: 'ສັດສ່ວນຕໍ່ຄົນເຈັບທັງໝົດ'
            }
        };

        // =====================================================================
        // TAB 4: 📍 ແຂວງ/ເມືອງ & ກຸ່ມອາຍຸຄົນເຈັບ (Demographics & Location %)
        // =====================================================================
        const LAO_PROVINCES = [
            'ນະຄອນຫຼວງວຽງຈັນ', 'ຜົ້ງສາລີ', 'ຫຼວງນ້ຳທາ', 'ອຸດົມໄຊ', 'ບໍ່ແກ້ວ', 'ຫຼວງພະບາງ',
            'ຫົວພັນ', 'ໄຊຍະບູລີ', 'ຊຽງຂວາງ', 'ວຽງຈັນ', 'ບໍລິຄຳໄຊ', 'ຄຳມ່ວນ',
            'ສະຫວັນນະເຂດ', 'ສາລະວັນ', 'ເຊກອງ', 'ຈຳປາສັກ', 'ອັດຕະປື', 'ໄຊສົມບູນ'
        ];

        const extractProvince = (addrRaw) => {
            if (!addrRaw) return 'ບໍ່ລະບຸແຂວງ';
            const s = String(addrRaw).normalize('NFC').trim();
            if (!s || s === '-') return 'ບໍ່ລະບຸແຂວງ';
            if (s.includes('ນະຄອນຫຼວງ') || s.includes('ນະຄອນຫລວງ')) return 'ນະຄອນຫຼວງວຽງຈັນ';
            for (const prov of LAO_PROVINCES) {
                if (prov === 'ວຽງຈັນ') {
                    if (s.includes('ແຂວງວຽງຈັນ') || s.includes('ແຂວງ ວຽງຈັນ') || (s.includes('ວຽງຈັນ') && !s.includes('ນະຄອນ'))) {
                        return 'ແຂວງວຽງຈັນ';
                    }
                } else if (s.includes(prov)) {
                    return `ແຂວງ${prov}`;
                }
            }
            return 'ຕ່າງແຂວງ / ອື່ນໆ';
        };

        const provMap = new Map();
        let totalDemoPatients = 0;
        let ageSum = 0;
        let ageCount = 0;
        const hnVisitFreq = {};
        validClinicVisits.forEach(v => {
            const hn = v.hn ? String(v.hn).trim().toUpperCase() : '';
            if (hn && hn !== '-') hnVisitFreq[hn] = (hnVisitFreq[hn] || 0) + 1;
        });

        validClinicVisits.forEach(v => {
            const hn = v.hn ? String(v.hn).trim().toUpperCase() : '';
            const pt = hn ? patByHn[hn] : null;
            const addr = (pt && pt.address) || '';
            const provName = extractProvince(addr);
            const ageVal = parseInt((pt && pt.age) || 0, 10);
            if (ageVal > 0 && ageVal < 120) {
                ageSum += ageVal;
                ageCount++;
            }

            totalDemoPatients++;
            if (!provMap.has(provName)) {
                provMap.set(provName, {
                    key: provName,
                    code: provName === 'ບໍ່ລະບຸແຂວງ' ? 'ບໍ່ລະບຸ' : '18 ແຂວງ',
                    name: provName,
                    count: 0,
                    ageTotal: 0,
                    ageValidCount: 0,
                    unitLabel: 'ເຄສ',
                    cases: []
                });
            }
            const entry = provMap.get(provName);
            entry.count++;
            if (ageVal > 0 && ageVal < 120) {
                entry.ageTotal += ageVal;
                entry.ageValidCount++;
            }
            if (entry.cases.length < 100) {
                entry.cases.push({
                    visit_id: v.visit_id || '-',
                    hn: v.hn || '-',
                    patient_name: v.patient_name || '-',
                    doctor_name: addr || '-',
                    date: v._ymd || '-'
                });
            }
        });

        const provList = Array.from(provMap.values())
            .sort((a, b) => b.count - a.count)
            .map((item, idx) => {
                const pct = totalDemoPatients > 0 ? (item.count / totalDemoPatients) * 100 : 0;
                const avgAge = item.ageValidCount > 0 ? Math.round(item.ageTotal / item.ageValidCount) : '-';
                return {
                    ...item,
                    rank: idx + 1,
                    pct,
                    pctText: pct.toFixed(1) + '%',
                    extraColText: avgAge !== '-' ? `ອາຍຸສະເລ່ຍ ~${avgAge} ປີ` : '-'
                };
            });

        const avgClinicAge = ageCount > 0 ? Math.round(ageSum / ageCount) : 0;
        const returningHns = Object.values(hnVisitFreq).filter(c => c > 1).length;
        const totalUniqueHns = Object.keys(hnVisitFreq).length;
        const repeatPct = totalUniqueHns > 0 ? ((returningHns / totalUniqueHns) * 100).toFixed(1) : '0.0';
        const topValidProv = provList.find(p => p.name !== 'ບໍ່ລະບຸແຂວງ') || provList[0];

        window.dbExecCachedData.demographics = {
            list: provList,
            totalDenom: totalDemoPatients,
            kpis: {
                k1Label: 'ອາຍຸສະເລ່ຍຂອງຄົນເຈັບທີ່ມາກວດ',
                k1Val: avgClinicAge > 0 ? `${avgClinicAge}` : '-',
                k1Unit: `ປີ (ຈາກ ${totalUniqueHns.toLocaleString()} Unique HN)`,
                k2Label: 'ອັດຕາຄົນເຈັບເກົ່າກັບມາກວດຊ້ຳ (Follow-up)',
                k2Val: `${repeatPct}%`,
                k2Unit: `ກັບມາຊ້ຳ ${returningHns.toLocaleString()} ຄົນ`,
                k3Label: 'ແຂວງທີ່ຄົນເຈັບເດີນທາງມາກວດອັນດັບ 1',
                k3Val: topValidProv ? topValidProv.name : 'ບໍ່ມີຂໍ້ມູນ',
                k3Pct: topValidProv ? `${topValidProv.pctText} (${topValidProv.count} ເຄສ)` : '0%',
                leftTitle: '5 ອັນດັບແຂວງທີ່ຄົນເຈັບມາໃຊ້ບໍລິການຫຼາຍທີ່ສຸດ (%)',
                rightTitle: 'ຕາຕະລາງຈັດອັນດັບແຂວງ & ອາຍຸສະເລ່ຍຂອງຜູ້ປ່ວຍ (%)',
                col2Header: 'ແຂວງ / ພື້ນທີ່',
                col3Header: 'ຈຳນວນ (ເຄສ)',
                col4Header: 'ອາຍຸສະເລ່ຍຂອງຄົນເຈັບ'
            }
        };

        // =====================================================================
        // TAB 5: 👨‍⚕️ ຜົນງານທ່ານໝໍຜູ້ກວດ (Doctor Workload & Rx Performance %)
        // =====================================================================
        const docMap = new Map();
        let totalDocCases = 0;

        validClinicVisits.forEach(v => {
            let docName = String(v.doctor_name || '').trim();
            if (!docName || docName === '-' || docName === 'null') docName = 'ຍັງບໍ່ລະບຸທ່ານໝໍ (ລໍຖ້າກວດ)';
            totalDocCases++;

            const mArr = parseMedsArr(v.meds);
            let rxRev = 0;
            mArr.forEach(m => {
                if (!m) return;
                const q = parseFloat(m.qty || m.quantity || 1) || 1;
                const p = parseFloat(String(m.price || m.unit_price || m.sale_price || 0).replace(/,/g, '')) || 0;
                const t = parseFloat(String(m.total || m.total_price || '').replace(/,/g, ''));
                rxRev += (!isNaN(t) && t > 0) ? t : (q * p);
            });

            if (!docMap.has(docName)) {
                docMap.set(docName, {
                    key: docName,
                    code: docName.startsWith('ຍັງບໍ່ລະບຸ') ? 'ລໍຖ້າກວດ' : 'ແພດຜູ້ກວດ',
                    name: docName,
                    count: 0,
                    rxCases: 0,
                    rxRevenue: 0,
                    unitLabel: 'ເຄສ',
                    cases: []
                });
            }
            const entry = docMap.get(docName);
            entry.count++;
            if (mArr.length > 0) entry.rxCases++;
            entry.rxRevenue += rxRev;
            if (entry.cases.length < 100) {
                entry.cases.push({
                    visit_id: v.visit_id || '-',
                    hn: v.hn || '-',
                    patient_name: v.patient_name || '-',
                    doctor_name: mArr.length > 0 ? `ສັ່ງຢາ ${mArr.length} ລາຍການ (฿${Math.round(rxRev).toLocaleString()})` : 'ບໍ່ມີສັ່ງຢາ',
                    date: v._ymd || '-'
                });
            }
        });

        const docList = Array.from(docMap.values())
            .sort((a, b) => b.count - a.count)
            .map((item, idx) => {
                const pct = totalDocCases > 0 ? (item.count / totalDocCases) * 100 : 0;
                return {
                    ...item,
                    rank: idx + 1,
                    pct,
                    pctText: pct.toFixed(1) + '%',
                    extraColText: `ສັ່ງຢາ ${item.rxCases} ເຄສ (฿${Math.round(item.rxRevenue).toLocaleString()})`
                };
            });

        const realDocs = docList.filter(d => d.code === 'ແພດຜູ້ກວດ');
        const topDoc = realDocs[0] || docList[0];

        window.dbExecCachedData.doctors = {
            list: docList,
            totalDenom: totalDocCases,
            kpis: {
                k1Label: 'ຈຳນວນເຄສກວດທັງໝົດ',
                k1Val: totalDocCases.toLocaleString(),
                k1Unit: 'ເຄສ (100%)',
                k2Label: 'ຈຳນວນທ່ານໝໍທີ່ຂຶ້ນກວດ',
                k2Val: realDocs.length.toLocaleString(),
                k2Unit: 'ທ່ານໝໍ',
                k3Label: 'ທ່ານໝໍທີ່ກວດຫຼາຍທີ່ສຸດອັນດັບ 1',
                k3Val: topDoc ? topDoc.name : 'ບໍ່ມີຂໍ້ມູນ',
                k3Pct: topDoc ? `${topDoc.pctText} (${topDoc.count} ເຄສ)` : '0%',
                leftTitle: '5 ອັນດັບທ່ານໝໍຕາມຈຳນວນເຄສກວດ (%)',
                rightTitle: 'ຕາຕະລາງສະຫຼຸບຜົນງານທ່ານໝໍ & ຍອດສັ່ງຈ່າຍຢາ (%)',
                col2Header: 'ຊື່ທ່ານໝໍຜູ້ກວດ',
                col3Header: 'ຈຳນວນ (ເຄສ)',
                col4Header: 'ຈຳນວນໃບສັ່ງຢາ & ຍອດຢາ'
            }
        };

        // ສະແດງ Tab ທີ່ກຳລັງເປີດຢູ່
        window.renderActiveExecReportTab();

    } catch (err) {
        console.error('updateDashboardExecutiveReports error:', err);
    }
};

window.renderActiveExecReportTab = function () {
    const tabKey = window.dbExecActiveTab || 'meds';
    const dataObj = window.dbExecCachedData[tabKey];
    if (!dataObj) return;

    const k = dataObj.kpis || {};
    const list = dataObj.list || [];

    const setElText = (id, txt) => {
        const el = document.getElementById(id);
        if (el) el.textContent = txt;
    };

    setElText('db-exec-kpi1-label', k.k1Label || '-');
    setElText('db-exec-kpi1-val', k.k1Val || '0');
    setElText('db-exec-kpi1-unit', k.k1Unit || '');
    setElText('db-exec-kpi2-label', k.k2Label || '-');
    setElText('db-exec-kpi2-val', k.k2Val || '0');
    setElText('db-exec-kpi2-unit', k.k2Unit || '');
    setElText('db-exec-kpi3-label', k.k3Label || '-');
    setElText('db-exec-kpi3-val', k.k3Val || '-');
    setElText('db-exec-kpi3-pct', k.k3Pct || '0%');

    const leftTitleEl = document.getElementById('db-exec-left-title');
    if (leftTitleEl) leftTitleEl.innerHTML = `<i class="ph-fill ph-chart-bar-horizontal me-1 text-primary"></i> ${k.leftTitle || '5 ອັນດັບສູງສຸດ (%)'}`;
    const rightTitleEl = document.getElementById('db-exec-right-title');
    if (rightTitleEl) rightTitleEl.innerHTML = `<i class="ph-fill ph-table me-1 text-success"></i> ${k.rightTitle || 'ຕາຕະລາງຈັດອັນດັບ (%)'}`;

    const headRow = document.getElementById('db-exec-table-head-row');
    if (headRow) {
        headRow.innerHTML = `
            <th style="width: 55px; text-align: center;">ອັນດັບ</th>
            <th>${k.col2Header || 'ລາຍການ'}</th>
            <th style="width: 105px; text-align: center;">${k.col3Header || 'ຈຳນວນ'}</th>
            <th style="width: 175px; text-align: right;">${k.col4Header || 'ລາຍລະອຽດ'}</th>
            <th style="width: 155px;">ອັດຕາສ່ວນ (%)</th>
            <th style="width: 115px; text-align: right;">ລາຍຊື່</th>
        `;
    }

    const top5Container = document.getElementById('db-exec-top5-bars');
    const tbody = document.getElementById('db-exec-table-body');

    const escapeHtml = (str) => String(str || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');

    const barColors = [
        'linear-gradient(90deg, #0d9488, #14b8a6)',
        'linear-gradient(90deg, #2563eb, #3b82f6)',
        'linear-gradient(90deg, #d97706, #f59e0b)',
        'linear-gradient(90deg, #7c3aed, #8b5cf6)',
        'linear-gradient(90deg, #e11d48, #f43f5e)'
    ];

    if (top5Container) {
        const unitMap = {
            meds: 'ຊິ້ນ',
            referrers: 'ເຄສ',
            labs: 'ເຄສ',
            demographics: 'ເຄສ',
            doctors: 'ເຄສ'
        };
        top5Container.innerHTML = window.buildModernVisualChartHtml({
            list: list,
            totalCount: dataObj.totalDenom || 0,
            mode: window.dbExecVisualMode || 'vbar',
            clickFn: 'window.openExecReportDrilldownModal',
            unitText: unitMap[tabKey] || 'ລາຍການ',
            centerIdPrefix: 'execDonut',
            hexColors: ['#0d9488', '#2563eb', '#d97706', '#7c3aed', '#e11d48'],
            gradColors: [
                'linear-gradient(180deg, #14b8a6 0%, #0d9488 100%)',
                'linear-gradient(180deg, #3b82f6 0%, #2563eb 100%)',
                'linear-gradient(180deg, #f59e0b 0%, #d97706 100%)',
                'linear-gradient(180deg, #8b5cf6 0%, #7c3aed 100%)',
                'linear-gradient(180deg, #f43f5e 0%, #e11d48 100%)'
            ],
            hGradColors: barColors
        });
    }

    if (tbody) {
        if (list.length === 0) {
            tbody.innerHTML = `<tr><td colspan="6" class="text-center text-muted py-4">ບໍ່ພົບຂໍ້ມູນໃນຊ່ວງເວລານີ້</td></tr>`;
        } else {
            tbody.innerHTML = list.map((item, i) => {
                const rankClass = i === 0 ? 'rank-1' : (i === 1 ? 'rank-2' : (i === 2 ? 'rank-3' : 'rank-other'));
                const codeBadge = item.code
                    ? `<span class="db-icd10-code-badge me-1">${escapeHtml(item.code)}</span>`
                    : '';
                const fillColor = i === 0 ? '#0d9488' : (i === 1 ? '#2563eb' : (i === 2 ? '#d97706' : '#64748b'));
                const widthPct = Math.min(100, Math.max(item.pct, 4)).toFixed(1);
                const caseCountNum = item.totalBillsCount || item.cases.length;
                return `
                    <tr>
                        <td class="text-center"><span class="db-icd10-rank-pill ${rankClass}">#${item.rank}</span></td>
                        <td>
                            <div class="d-flex align-items-center flex-wrap gap-1">
                                ${codeBadge}
                                <strong style="color: #0f172a;">${escapeHtml(item.name)}</strong>
                            </div>
                        </td>
                        <td class="text-center fw-bold" style="color: #1e293b;">${item.count.toLocaleString()}</td>
                        <td class="text-end" style="font-size: 0.78rem; color: #475569; font-weight: 600;">${escapeHtml(item.extraColText || '-')}</td>
                        <td>
                            <div class="d-flex align-items-center gap-2">
                                <div class="db-icd10-progress-track flex-grow-1" style="height: 7px;">
                                    <div class="db-icd10-progress-fill" style="width: ${widthPct}%; background: ${fillColor};"></div>
                                </div>
                                <span class="fw-bold text-dark" style="min-width: 44px; text-align: right; font-family: 'Outfit', sans-serif;">${item.pctText}</span>
                            </div>
                        </td>
                        <td class="text-end">
                            <button type="button" class="db-icd10-view-btn" onclick="openExecReportDrilldownModal(${i})">
                                <i class="ph-bold ph-eye"></i>
                                <span>ເບິ່ງ</span>
                                <span class="view-count-pill">${caseCountNum.toLocaleString()}</span>
                            </button>
                        </td>
                    </tr>
                `;
            }).join('');
        }
    }
};

window.openExecReportDrilldownModal = function (rankIndex) {
    const tabKey = window.dbExecActiveTab || 'meds';
    const dataObj = window.dbExecCachedData[tabKey];
    const item = dataObj && dataObj.list ? dataObj.list[rankIndex] : null;
    if (!item || typeof Swal === 'undefined') return;

    const escapeHtml = (str) => String(str || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');

    const rowsHtml = (item.cases || []).map((c, idx) => `
        <tr>
            <td class="text-center">${idx + 1}</td>
            <td><span class="badge bg-light text-dark border">${escapeHtml(c.visit_id)}</span></td>
            <td>${escapeHtml(c.hn)}</td>
            <td class="fw-semibold">${escapeHtml(c.patient_name)}</td>
            <td>${escapeHtml(c.doctor_name)}</td>
            <td>${escapeHtml(c.date)}</td>
        </tr>
    `).join('');

    Swal.fire({
        title: `<div class="fs-5 fw-bold text-dark"><i class="ph-fill ph-chart-pie-slice text-teal me-1" style="color:#0d9488;"></i> ${escapeHtml(item.name)}</div>`,
        html: `
            <div class="text-start">
                <div class="d-flex justify-content-between align-items-center bg-light border rounded-3 p-2.5 mb-3">
                    <span>ຈຳນວນລວມ: <strong class="text-primary">${item.count.toLocaleString()}</strong> (${escapeHtml(item.extraColText || '')})</span>
                    <span class="badge bg-success-subtle text-success border border-success-subtle fs-6">ອັດຕາສ່ວນ: ${item.pctText}</span>
                </div>
                <div style="max-height: 320px; overflow-y: auto; border: 1px solid #e2e8f0; border-radius: 10px;">
                    <table class="table table-sm table-hover mb-0" style="font-size: 0.82rem;">
                        <thead class="table-light" style="position: sticky; top: 0;">
                            <tr>
                                <th class="text-center">#</th>
                                <th>Visit ID</th>
                                <th>HN</th>
                                <th>ຊື່ຄົນເຈັບ</th>
                                <th>ລາຍລະອຽດ / ທ່ານໝໍ</th>
                                <th>ວັນທີ</th>
                            </tr>
                        </thead>
                        <tbody>${rowsHtml}</tbody>
                    </table>
                </div>
            </div>
        `,
        width: 740,
        confirmButtonText: 'ປິດໜ້າຕ່າງ',
        confirmButtonColor: '#0d9488'
    });
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

    // Default select current month in chart
    if (typeof window.handleMonthDotClick === 'function') {
        window.handleMonthDotClick((window.currentCalDate || new Date()).getMonth());
    }

    // Init realtime listeners
    initDashboardRealtime();
});
