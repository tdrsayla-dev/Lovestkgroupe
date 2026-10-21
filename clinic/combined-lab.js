// =====================================================
// combined-lab.js — v2.2
// ລະບົບຈັດການໃບລາຍງານຜົນກວດວິເຄາະລວມ (Comprehensive Lab Report)
//  - CBC: 2 ຄໍລຳ, Histograms, Blood Group
//  - Biochem: Tests | Type | Conc. | Unit | Flags | Ref
//  - Urinalysis: Test | Result | Reference range
//  - Other Lab: ຮອງຮັບ Dynamic Columns (ເພີ່ມ, ລຶບ, ປ່ຽນຊື່ຖັນໄດ້ຕາມໃຈ)
// STK Clinic Management System
// =====================================================

'use strict';

(function () {
    const params = new URLSearchParams(window.location.search);
    const visitId = params.get('visit_id') || params.get('visitId') || '';
    const hn = params.get('hn') || '';
    const patientName = params.get('name') || params.get('patient_name') || '';
    const mode = (params.get('mode') || 'lab').toLowerCase();
    const isExplicitReadOnly = (params.get('readonly') === '1' || params.get('readonly') === 'true');

    // 🌟 ກວດສອບໂໝດ Read-Only
    let isReadOnlyMode = (mode === 'print' || mode === 'history' || mode === 'view' || isExplicitReadOnly || document.documentElement.classList.contains('readonly-mode'));
    try {
        if (!isReadOnlyMode && window.parent && window.parent !== window) {
            const pDoc = window.parent.document;
            const hSec = pDoc.getElementById('history');
            if (hSec && (hSec.classList.contains('active') || pDoc.querySelector('.page-section.active#history'))) {
                isReadOnlyMode = true;
            }
            const pHistModal = pDoc.getElementById('patientHistoryModal');
            if (pHistModal && (pHistModal.classList.contains('show') || pHistModal.style.display === 'block')) {
                isReadOnlyMode = true;
            }
            const pRxModal = pDoc.getElementById('prescribeModal');
            if (pRxModal && (pRxModal.classList.contains('show') || pRxModal.style.display === 'block')) {
                isReadOnlyMode = true;
            }
        }
    } catch (e) { }

    // 🌟 Supabase Client
    let sup = null;
    try {
        if (typeof supabase !== 'undefined' && typeof CONFIG !== 'undefined' && CONFIG.SUPABASE_URL && (CONFIG.SUPABASE_KEY || CONFIG.SUPABASE_ANON_KEY)) {
            sup = supabase.createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_KEY || CONFIG.SUPABASE_ANON_KEY);
        } else if (window.opener && window.opener._supabase) {
            sup = window.opener._supabase;
        } else if (window.parent && window.parent._supabase) {
            sup = window.parent._supabase;
        }
    } catch (e) {
        console.warn('Init Supabase warning:', e);
    }

    // Helper: Format Date
    function formatLaoDate(dateStr) {
        if (!dateStr) return '-';
        const d = new Date(dateStr);
        if (isNaN(d.getTime())) return dateStr;
        const pad = n => String(n).padStart(2, '0');
        return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
    }

    // Helper: Toast Message
    function showToast(msg) {
        const toast = document.getElementById('toast');
        if (!toast) return;
        toast.innerText = msg;
        toast.style.display = 'block';
        setTimeout(() => {
            toast.style.display = 'none';
        }, 2400);
    }

    function escapeHtml(str) {
        if (!str) return '';
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    // =====================================================
    // 1. DATA DEFINITIONS
    // =====================================================

    // ก. CBC BASE ITEMS (ถอดจาก cbc.js)
    const BASE_CBC_ITEMS = [
        { section: 'White Blood Cell (WBC)' },
        { name: 'WBC', unit: '10^9/L', min: '4.0', max: '10.0', val: '' },
        { name: 'LYM%', unit: '%', min: '20.0', max: '40.0', val: '' },
        { name: 'MID%', unit: '%', min: '3.0', max: '9.0', val: '' },
        { name: 'GRAN%', unit: '%', min: '50.0', max: '70.0', val: '' },
        { name: 'LYM#', unit: '10^9/L', min: '0.8', max: '4.0', val: '' },
        { name: 'MID#', unit: '10^9/L', min: '0.1', max: '1.2', val: '' },
        { name: 'GRAN#', unit: '10^9/L', min: '2.0', max: '7.0', val: '' },

        { section: 'Red Blood Cell (RBC)' },
        { name: 'RBC', unit: '10^12/L', min: '3.50', max: '5.50', val: '' },
        { name: 'HGB', unit: 'g/dL', min: '11.0', max: '16.0', val: '' },
        { name: 'HCT', unit: '%', min: '36.0', max: '50.0', val: '' },
        { name: 'MCV', unit: 'fL', min: '80.0', max: '100.0', val: '' },
        { name: 'MCH', unit: 'pg', min: '27.0', max: '34.0', val: '' },
        { name: 'MCHC', unit: 'g/dL', min: '32.0', max: '36.0', val: '' },
        { name: 'RDW-CV', unit: '%', min: '11.0', max: '16.0', val: '' },
        { name: 'RDW-SD', unit: 'fL', min: '35.0', max: '56.0', val: '' },

        { section: 'Platelet (PLT)' },
        { name: 'PLT', unit: '10^9/L', min: '100', max: '300', val: '' },
        { name: 'MPV', unit: 'fL', min: '6.5', max: '12.0', val: '' },
        { name: 'PCT', unit: '%', min: '0.108', max: '0.282', val: '' },
        { name: 'P_LCR', unit: '%', min: '13.0', max: '43.0', val: '' },
        { name: 'P_LCC', unit: '10^9/L', min: '30', max: '90', val: '' },
        { name: 'PDW_SD', unit: 'fL', min: '9.0', max: '17.0', val: '' },
        { name: 'PDW_CV', unit: '%', min: '10.0', max: '18.0', val: '' }
    ];

    // ข. BIOCHEMISTRY BASE ITEMS (16 ລາຍການຕາມລຳດັບໃນໃບກວດຕົວຈິງ ໂດຍບໍ່ມີການແບ່ງໝວດ)
    const BASE_BIOCHEM_ITEMS = [
        { test: 'ALBUMIN', sample: 'SER', unit: 'g/L', ref: '30 - 50', val: '' },
        { test: 'ALP-AMP', sample: 'SER', unit: 'U/L', ref: '20 - 250', val: '' },
        { test: 'ALT-GPT', sample: 'SER', unit: 'U/L', ref: '0 - 40', val: '' },
        { test: 'AMYLASE DIRECT', sample: 'SER', unit: 'U/L', ref: '5 - 122', val: '' },
        { test: 'AST-GOT', sample: 'SER', unit: 'U/L', ref: '0 - 40', val: '' },
        { test: 'BILIRUBIN TOTAL', sample: 'SER', unit: 'mg/dL', ref: '0.0 - 1.5', val: '' },
        { test: 'CALCIUM ARSENAZO', sample: 'SER', unit: 'mg/dL', ref: '8.00 - 11.00', val: '' },
        { test: 'CHOL HDL DIRECT', sample: 'SER', unit: 'mg/dL', ref: '40.0 - 110.0', val: '' },
        { test: 'CHOL LDL DIRECT', sample: 'SER', unit: 'mg/dL', ref: '50 - 190', val: '' },
        { test: 'CHOLESTEROL', sample: 'SER', unit: 'mg/dL', ref: '120 - 220', val: '' },
        { test: 'CREATININE', sample: 'SER', unit: 'mg/dL', ref: '0.50 - 1.42', val: '' },
        { test: 'GAMMA-GT', sample: 'SER', unit: 'U/L', ref: '0 - 40', val: '' },
        { test: 'GLUCOSE', sample: 'SER', unit: 'mg/dL', ref: '70 - 110', val: '' },
        { test: 'TRIGLYCERIDES', sample: 'SER', unit: 'mg/dL', ref: '35 - 160', val: '' },
        { test: 'UREA-BUN-UV', sample: 'SER', unit: 'mg/dL', ref: '5 - 38', val: '' },
        { test: 'URIC ACID', sample: 'SER', unit: 'mg/dL', ref: '2.50 - 7.50', val: '' }
    ];

    // ค. URINALYSIS BASE ITEMS (ถอดจาก urine.html 13 รายการ)
    const BASE_URINE_ITEMS = [
        { id: 'result0', refId: 'ref0', test: 'Color', ref: 'Yellow', val: '' },
        { id: 'result1', refId: 'ref1', test: 'Appearance', ref: 'Clear', val: '' },
        { id: 'result2', refId: 'ref2', test: 'Leukocytes', ref: 'Negative', val: '' },
        { id: 'result3', refId: 'ref3', test: 'Ketone', ref: 'Negative', val: '' },
        { id: 'result4', refId: 'ref4', test: 'Urobilinogen', ref: 'Normal', val: '' },
        { id: 'result5', refId: 'ref5', test: 'Bilirubin', ref: 'Negative', val: '' },
        { id: 'result6', refId: 'ref6', test: 'Protein', ref: 'Negative', val: '' },
        { id: 'result7', refId: 'ref7', test: 'Glucose', ref: 'Negative', val: '' },
        { id: 'result8', refId: 'ref8', test: 'Specific Gravity', ref: '1.003 - 1.030', val: '' },
        { id: 'result9', refId: 'ref9', test: 'Blood', ref: 'Negative', val: '' },
        { id: 'result10', refId: 'ref10', test: 'pH', ref: '5.0 - 7.5', val: '' },
        { id: 'result11', refId: 'ref11', test: 'Ascorbic acid', ref: 'Negative', val: '' },
        { id: 'result12', refId: '', test: 'Stool Examination', ref: '', val: '', isStool: true }
    ];

    // ง. OTHER LAB DYNAMIC COLUMNS & ROWS (ถอดจาก other-lab.js)
    const DEFAULT_OTHER_COLUMNS = [
        { key: 'test', label: 'Tests (ລາຍການກວດ)', type: 'test' },
        { key: 'result', label: 'Result (ຜົນກວດ)', type: 'result' },
        { key: 'unit', label: 'Unit (ໜ່ວຍ)', type: 'unit' },
        { key: 'flag', label: 'Flags', type: 'flag' },
        { key: 'ref', label: 'Ref. / Notes (ຄ່າອ້າງອີງ/ໝາຍເຫດ)', type: 'ref' }
    ];

    let currentOtherColumns = JSON.parse(JSON.stringify(DEFAULT_OTHER_COLUMNS));
    let currentOtherRows = [
        { test: 'Dengue NS1 Ag', result: '', unit: '', flag: '', ref: 'Negative' },
        { test: 'Malaria Pf / Pv', result: '', unit: '', flag: '', ref: 'Negative' },
        { test: 'H. pylori Ab', result: '', unit: '', flag: '', ref: 'Negative' },
        { test: 'Urine Pregnancy (UPT)', result: '', unit: '', flag: '', ref: 'Negative' }
    ];

    // Status / Flag Compute Helpers
    function computeCbcStatus(valStr, minStr, maxStr) {
        if (!valStr || String(valStr).trim() === '') return { cls: 'empty', text: '-' };
        const val = parseFloat(valStr);
        const min = parseFloat(minStr);
        const max = parseFloat(maxStr);
        if (isNaN(val)) return { cls: 'empty', text: '-' };
        if (!isNaN(min) && val < min) return { cls: 'low', text: 'L (ต่ำ)' };
        if (!isNaN(max) && val > max) return { cls: 'high', text: 'H (สูง)' };
        return { cls: 'normal', text: 'Normal' };
    }

    function computeBiochemFlag(resultStr, refStr) {
        if (!resultStr || String(resultStr).trim() === '') return { flag: '', cls: 'flag-normal', text: '-' };
        const res = String(resultStr).trim();
        if (/^(positive|reactive|detected|abnormal|pos|\+)/i.test(res)) {
            return { flag: 'Positive', cls: 'flag-high', text: 'Positive' };
        }
        if (/^(negative|non-reactive|normal|nil)/i.test(res)) {
            return { flag: '', cls: 'flag-normal', text: 'Normal' };
        }
        const resNum = parseFloat(res);
        if (isNaN(resNum) || !refStr) return { flag: '', cls: 'flag-normal', text: '-' };

        const rangeMatch = String(refStr).match(/^([\d\.]+)\s*[-–~to]\s*([\d\.]+)$/);
        if (rangeMatch) {
            const low = parseFloat(rangeMatch[1]);
            const high = parseFloat(rangeMatch[2]);
            if (!isNaN(low) && resNum < low) return { flag: 'L', cls: 'flag-low', text: 'L (ຕ່ຳ)' };
            if (!isNaN(high) && resNum > high) return { flag: 'H', cls: 'flag-high', text: 'H (ສູງ)' };
            return { flag: '', cls: 'flag-normal', text: 'Normal' };
        }
        const lessMatch = String(refStr).match(/^[<≤]\s*([\d\.]+)$/);
        if (lessMatch) {
            const high = parseFloat(lessMatch[1]);
            if (!isNaN(high) && resNum > high) return { flag: 'H', cls: 'flag-high', text: 'H (ສູງ)' };
            return { flag: '', cls: 'flag-normal', text: 'Normal' };
        }
        const greaterMatch = String(refStr).match(/^[>≥]\s*([\d\.]+)$/);
        if (greaterMatch) {
            const low = parseFloat(greaterMatch[1]);
            if (!isNaN(low) && resNum < low) return { flag: 'L', cls: 'flag-low', text: 'L (ຕ່ຳ)' };
            return { flag: '', cls: 'flag-normal', text: 'Normal' };
        }
        return { flag: '', cls: 'flag-normal', text: '-' };
    }

    // =====================================================
    // 2. RENDERING FUNCTIONS FOR EACH SECTION
    // =====================================================

    // 2.1 วาดตาราง CBC
    function renderCbcTable(items) {
        const tbody = document.getElementById('tbodyCbc');
        if (!tbody) return;
        tbody.innerHTML = '';

        items.forEach(item => {
            if (item.section) {
                const trSec = document.createElement('tr');
                trSec.className = 'sectionrow';
                trSec.innerHTML = `<td colspan="6"><strong>${item.section}</strong></td>`;
                tbody.appendChild(trSec);
                return;
            }

            const status = computeCbcStatus(item.val, item.min, item.max);
            const tr = document.createElement('tr');
            tr.dataset.name = item.name;

            const readonlyAttr = isReadOnlyMode ? 'readonly disabled style="background:transparent;border:none;"' : '';

            tr.innerHTML = `
                <td><strong>${item.name}</strong></td>
                <td><input type="text" class="value-input cbc-val" value="${escapeHtml(item.val ?? '')}" data-key="val" ${readonlyAttr}></td>
                <td class="text-muted">${item.unit}</td>
                <td><input type="text" class="cbc-min" value="${escapeHtml(item.min ?? '')}" data-key="min" ${readonlyAttr}></td>
                <td><input type="text" class="cbc-max" value="${escapeHtml(item.max ?? '')}" data-key="max" ${readonlyAttr}></td>
                <td style="text-align:center;"><span class="status ${status.cls}">${status.text}</span></td>
            `;

            if (!isReadOnlyMode) {
                const valIn = tr.querySelector('input[data-key="val"]');
                const minIn = tr.querySelector('input[data-key="min"]');
                const maxIn = tr.querySelector('input[data-key="max"]');
                const statusSpan = tr.querySelector('.status');

                const onUpdate = () => {
                    const newSt = computeCbcStatus(valIn.value, minIn.value, maxIn.value);
                    statusSpan.className = `status ${newSt.cls}`;
                    statusSpan.innerText = newSt.text;
                    updateCbcHistograms();
                };

                valIn.addEventListener('input', onUpdate);
                minIn.addEventListener('input', onUpdate);
                maxIn.addEventListener('input', onUpdate);
            }

            tbody.appendChild(tr);
        });

        updateCbcHistograms();
    }

    // ฟังก์ชันสร้าง SVG path สำหรับ Histogram
    function generateSvgPathData(points, width, height, padX, padY, fixedMinX, fixedMaxX, fixedMaxY) {
        if (!points || points.length === 0) return { line: '', area: '' };
        const innerW = width - padX * 2;
        const innerH = height - padY * 2;
        const minX = (fixedMinX !== undefined) ? fixedMinX : Math.min(...points.map(p => p[0]));
        const maxX = (fixedMaxX !== undefined) ? fixedMaxX : Math.max(...points.map(p => p[0]));
        const maxY = fixedMaxY || 100;

        const scaleX = x => padX + ((Math.max(minX, Math.min(maxX, x)) - minX) / (maxX - minX || 1)) * innerW;
        const scaleY = y => {
            const clampedY = Math.max(0, Math.min(y, maxY * 1.05));
            return (height - padY) - (clampedY / maxY) * innerH;
        };

        const baseY = height - padY;
        const firstX = scaleX(points[0][0]);
        const lastX = scaleX(points[points.length - 1][0]);

        let line = `M ${firstX.toFixed(1)} ${scaleY(points[0][1]).toFixed(1)}`;
        for (let i = 1; i < points.length; i++) {
            line += ` L ${scaleX(points[i][0]).toFixed(1)} ${scaleY(points[i][1]).toFixed(1)}`;
        }
        const area = `${line} L ${lastX.toFixed(1)} ${baseY.toFixed(1)} L ${firstX.toFixed(1)} ${baseY.toFixed(1)} Z`;
        return { line, area };
    }

    function generateSvgPath(points, width, height, padX, padY, fixedMinX, fixedMaxX, fixedMaxY) {
        return generateSvgPathData(points, width, height, padX, padY, fixedMinX, fixedMaxX, fixedMaxY).line;
    }

    // วาดกราฟเส้นจำลอง Histogram (WBC, RBC, PLT) ตรงตาม cbc.js
    function updateCbcHistograms() {
        const container = document.getElementById('real-histograms');
        if (!container) return;

        const getVal = (name) => {
            const tr = document.querySelector(`#tbodyCbc tr[data-name="${name}"]`);
            const valStr = tr?.querySelector('input[data-key="val"]')?.value?.trim();
            if (!valStr) return null;
            const v = parseFloat(valStr);
            return isNaN(v) ? null : v;
        };

        const wbcVal = getVal('WBC');
        const lymPct = getVal('LYM%');
        const midPct = getVal('MID%');
        const granPct = getVal('GRAN%');
        const rbcVal = getVal('RBC');
        const mcvVal = getVal('MCV');
        const rdwVal = getVal('RDW-SD');
        const pltVal = getVal('PLT');
        const mpvVal = getVal('MPV');

        // 1. WBC Curve
        const wbcPoints = [];
        if (wbcVal !== null && wbcVal > 0) {
            const lp = (lymPct !== null && lymPct > 0) ? lymPct : 30;
            const mp = (midPct !== null && midPct > 0) ? midPct : 6;
            const gp = (granPct !== null && granPct > 0) ? granPct : 60;
            const wbcScale = Math.max(0.05, wbcVal / 7.0);
            for (let x = 30; x <= 450; x += 5) {
                const p1 = (lp / 30) * 55 * Math.exp(-Math.pow((x - 85) / 22, 2));
                const p2 = (mp / 6) * 18 * Math.exp(-Math.pow((x - 135) / 20, 2));
                const p3 = (gp / 50) * 75 * Math.exp(-Math.pow((x - 240) / 48, 2));
                const y = (p1 + p2 + p3) * wbcScale;
                wbcPoints.push([x, Math.max(0, y)]);
            }
        } else {
            for (let x = 30; x <= 450; x += 30) wbcPoints.push([x, 0]);
        }

        // 2. RBC Curve
        const rbcPoints = [];
        if ((rbcVal !== null && rbcVal > 0) || (mcvVal !== null && mcvVal > 0)) {
            const rv = (rbcVal !== null && rbcVal > 0) ? rbcVal : 4.85;
            const mv = (mcvVal !== null && mcvVal > 0) ? mcvVal : 88.0;
            const rw = (rdwVal !== null && rdwVal > 0) ? rdwVal : 41.5;
            const rbcScale = Math.max(0.05, rv / 4.85);
            const sigma = Math.max(6, rw * 0.35);
            for (let x = 20; x <= 250; x += 2) {
                const y = rbcScale * 85 * Math.exp(-Math.pow((x - mv) / sigma, 2));
                rbcPoints.push([x, Math.max(0, y)]);
            }
        } else {
            for (let x = 20; x <= 250; x += 20) rbcPoints.push([x, 0]);
        }

        // 3. PLT Curve
        const pltPoints = [];
        if (pltVal !== null && pltVal > 0) {
            const mpv = (mpvVal !== null && mpvVal > 0) ? mpvVal : 9.4;
            const pltScale = Math.max(0.05, pltVal / 240);
            const mpvPos = Math.max(3, Math.min(18, mpv));
            for (let x = 0.5; x <= 32; x += 0.5) {
                const y = pltScale * 85 * Math.exp(-Math.pow((Math.log(x) - Math.log(mpvPos)) / 0.55, 2));
                pltPoints.push([x, Math.max(0, y)]);
            }
        } else {
            for (let x = 0.5; x <= 32; x += 3) pltPoints.push([x, 0]);
        }

        const w = 310;
        const h = 76;
        const padX = 20;
        const padY = 14;
        const baseY = h - padY; // 62

        const wbcData = generateSvgPathData(wbcPoints, w, h, padX, padY, 30, 450, 150);
        const rbcData = generateSvgPathData(rbcPoints, w, h, padX, padY, 20, 250, 130);
        const pltData = generateSvgPathData(pltPoints, w, h, padX, padY, 0.5, 32, 160);

        const pathWbc = document.getElementById('histPathWbc');
        const pathRbc = document.getElementById('histPathRbc');
        const pathPlt = document.getElementById('histPathPlt');
        const areaWbc = document.getElementById('histAreaWbc');
        const areaRbc = document.getElementById('histAreaRbc');
        const areaPlt = document.getElementById('histAreaPlt');

        if (pathWbc && pathRbc && pathPlt && areaWbc && areaRbc && areaPlt) {
            pathWbc.setAttribute('d', wbcData.line);
            areaWbc.setAttribute('d', wbcData.area);

            pathRbc.setAttribute('d', rbcData.line);
            areaRbc.setAttribute('d', rbcData.area);

            pathPlt.setAttribute('d', pltData.line);
            areaPlt.setAttribute('d', pltData.area);
        } else {
            container.innerHTML = `
                <!-- 1. WBC Histogram (Blue) -->
                <div class="hist-plot">
                    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:2px;">
                        <span class="hist-title" style="color:#0b3c73;">WBC Histogram</span>
                        <span class="hist-range">(40 - 450 fL)</span>
                    </div>
                    <svg viewBox="0 0 ${w} ${h}">
                        <defs>
                            <linearGradient id="gradWbcCombined" x1="0%" y1="0%" x2="0%" y2="100%">
                                <stop offset="0%" stop-color="#2563eb" stop-opacity="0.45"/>
                                <stop offset="60%" stop-color="#3b82f6" stop-opacity="0.18"/>
                                <stop offset="100%" stop-color="#60a5fa" stop-opacity="0.02"/>
                            </linearGradient>
                        </defs>
                        <line x1="20" y1="20" x2="${w - 10}" y2="20" stroke="#f1f5f9" stroke-width="1" />
                        <line x1="20" y1="36" x2="${w - 10}" y2="36" stroke="#f1f5f9" stroke-width="1" />
                        <line x1="20" y1="50" x2="${w - 10}" y2="50" stroke="#f1f5f9" stroke-width="1" />
                        <line class="axis-line" x1="20" y1="${baseY}" x2="${w - 10}" y2="${baseY}" stroke="#94a3b8" stroke-width="1.2" />
                        <path id="histAreaWbc" d="${wbcData.area}" fill="url(#gradWbcCombined)" />
                        <path class="trace trace-wbc" id="histPathWbc" d="${wbcData.line}" fill="none" stroke="#2563eb" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" />
                        <text x="24" y="${h - 2}">40</text>
                        <text x="75" y="${h - 2}" text-anchor="middle">100</text>
                        <text x="145" y="${h - 2}" text-anchor="middle">200</text>
                        <text x="215" y="${h - 2}" text-anchor="middle">300</text>
                        <text x="${w - 12}" y="${h - 2}" text-anchor="end">450 fL</text>
                    </svg>
                </div>

                <!-- 2. RBC Histogram (Red) -->
                <div class="hist-plot">
                    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:2px;">
                        <span class="hist-title" style="color:#991b1b;">RBC Histogram</span>
                        <span class="hist-range">(25 - 250 fL)</span>
                    </div>
                    <svg viewBox="0 0 ${w} ${h}">
                        <defs>
                            <linearGradient id="gradRbcCombined" x1="0%" y1="0%" x2="0%" y2="100%">
                                <stop offset="0%" stop-color="#dc2626" stop-opacity="0.45"/>
                                <stop offset="60%" stop-color="#ef4444" stop-opacity="0.18"/>
                                <stop offset="100%" stop-color="#f87171" stop-opacity="0.02"/>
                            </linearGradient>
                        </defs>
                        <line x1="20" y1="20" x2="${w - 10}" y2="20" stroke="#f1f5f9" stroke-width="1" />
                        <line x1="20" y1="36" x2="${w - 10}" y2="36" stroke="#f1f5f9" stroke-width="1" />
                        <line x1="20" y1="50" x2="${w - 10}" y2="50" stroke="#f1f5f9" stroke-width="1" />
                        <line class="axis-line" x1="20" y1="${baseY}" x2="${w - 10}" y2="${baseY}" stroke="#94a3b8" stroke-width="1.2" />
                        <path id="histAreaRbc" d="${rbcData.area}" fill="url(#gradRbcCombined)" />
                        <path class="trace trace-rbc" id="histPathRbc" d="${rbcData.line}" fill="none" stroke="#dc2626" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" />
                        <text x="24" y="${h - 2}">25</text>
                        <text x="65" y="${h - 2}" text-anchor="middle">50</text>
                        <text x="125" y="${h - 2}" text-anchor="middle">100</text>
                        <text x="185" y="${h - 2}" text-anchor="middle">150</text>
                        <text x="${w - 12}" y="${h - 2}" text-anchor="end">250 fL</text>
                    </svg>
                </div>

                <!-- 3. PLT Histogram (Green) -->
                <div class="hist-plot">
                    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:2px;">
                        <span class="hist-title" style="color:#065f46;">PLT Histogram</span>
                        <span class="hist-range">(2 - 30 fL)</span>
                    </div>
                    <svg viewBox="0 0 ${w} ${h}">
                        <defs>
                            <linearGradient id="gradPltCombined" x1="0%" y1="0%" x2="0%" y2="100%">
                                <stop offset="0%" stop-color="#059669" stop-opacity="0.45"/>
                                <stop offset="60%" stop-color="#10b981" stop-opacity="0.18"/>
                                <stop offset="100%" stop-color="#34d399" stop-opacity="0.02"/>
                            </linearGradient>
                        </defs>
                        <line x1="20" y1="20" x2="${w - 10}" y2="20" stroke="#f1f5f9" stroke-width="1" />
                        <line x1="20" y1="36" x2="${w - 10}" y2="36" stroke="#f1f5f9" stroke-width="1" />
                        <line x1="20" y1="50" x2="${w - 10}" y2="50" stroke="#f1f5f9" stroke-width="1" />
                        <line class="axis-line" x1="20" y1="${baseY}" x2="${w - 10}" y2="${baseY}" stroke="#94a3b8" stroke-width="1.2" />
                        <path id="histAreaPlt" d="${pltData.area}" fill="url(#gradPltCombined)" />
                        <path class="trace trace-plt" id="histPathPlt" d="${pltData.line}" fill="none" stroke="#059669" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" />
                        <text x="24" y="${h - 2}">2</text>
                        <text x="100" y="${h - 2}" text-anchor="middle">10</text>
                        <text x="190" y="${h - 2}" text-anchor="middle">20</text>
                        <text x="${w - 12}" y="${h - 2}" text-anchor="end">30 fL</text>
                    </svg>
                </div>
            `;
        }
    }

    // 2.2 วาดตาราง BIOCHEMISTRY
    function renderBiochemTable(items) {
        const tbody = document.getElementById('tbodyBiochem');
        if (!tbody) return;
        tbody.innerHTML = '';

        let currentCat = '';
        items.forEach((item, index) => {
            if (item.category && item.category !== currentCat) {
                currentCat = item.category;
                const trCat = document.createElement('tr');
                trCat.className = 'sectionrow';
                trCat.innerHTML = `<td colspan="7"><strong>${currentCat}</strong></td>`;
                tbody.appendChild(trCat);
            }

            const flagInfo = computeBiochemFlag(item.val, item.ref);
            const tr = document.createElement('tr');
            tr.dataset.category = item.category || '';
            const readonlyAttr = isReadOnlyMode ? 'readonly disabled style="background:transparent;border:none;"' : '';

            tr.innerHTML = `
                <td><strong>${escapeHtml(item.test)}</strong></td>
                <td style="text-align:center;"><span class="badge bg-light text-secondary border" style="font-size:10px;">${escapeHtml(item.sample || 'SER')}</span></td>
                <td><input type="text" class="result-input biochem-val" value="${escapeHtml(item.val ?? '')}" data-key="val" ${readonlyAttr}></td>
                <td class="text-muted"><input type="text" class="biochem-unit" value="${escapeHtml(item.unit ?? '')}" data-key="unit" style="width:70px;" ${readonlyAttr}></td>
                <td style="text-align:center;"><span class="status ${flagInfo.cls}">${flagInfo.text}</span></td>
                <td><input type="text" class="biochem-ref" value="${escapeHtml(item.ref ?? '')}" data-key="ref" ${readonlyAttr}></td>
                <td style="text-align:center;" class="no-print">
                    ${!isReadOnlyMode ? `<button type="button" class="btn-remove-row" title="ລຶບແຖວນີ້" onclick="this.closest('tr').remove()"><i class="bi bi-trash"></i></button>` : ''}
                </td>
            `;

            if (!isReadOnlyMode) {
                const valIn = tr.querySelector('input[data-key="val"]');
                const refIn = tr.querySelector('input[data-key="ref"]');
                const flagSpan = tr.querySelector('.status');
                const onUpdate = () => {
                    const newFl = computeBiochemFlag(valIn.value, refIn.value);
                    flagSpan.className = `status ${newFl.cls}`;
                    flagSpan.innerText = newFl.text;
                };
                valIn.addEventListener('input', onUpdate);
                refIn.addEventListener('input', onUpdate);
            }

            tbody.appendChild(tr);
        });
    }

    // 2.3 วาดตาราง URINALYSIS (13 รายการ ตรงกับ urine.html)
    function renderUrineTable(items) {
        const tbody = document.getElementById('tbodyUrine');
        if (!tbody) return;
        tbody.innerHTML = '';

        items.forEach(item => {
            const tr = document.createElement('tr');
            tr.dataset.id = item.id;
            const readonlyAttr = isReadOnlyMode ? 'readonly disabled style="background:transparent;border:none;"' : '';

            if (item.isStool) {
                tr.innerHTML = `
                    <td><strong>${escapeHtml(item.test)}</strong></td>
                    <td colspan="2"><input type="text" class="result-input urine-val" id="${item.id}" value="${escapeHtml(item.val ?? '')}" placeholder="ຜົນກວດອາຈົມ..." ${readonlyAttr}></td>
                `;
            } else {
                tr.innerHTML = `
                    <td><strong>${escapeHtml(item.test)}</strong></td>
                    <td><input type="text" class="result-input urine-val" id="${item.id}" value="${escapeHtml(item.val ?? '')}" ${readonlyAttr}></td>
                    <td><input type="text" class="urine-ref" id="${item.refId}" value="${escapeHtml(item.ref ?? '')}" ${readonlyAttr}></td>
                `;
            }
            tbody.appendChild(tr);
        });
    }

    // =====================================================
    // 2.4 OTHER LAB: DYNAMIC COLUMNS & ROWS
    // =====================================================

    // ວາດຫົວຖັນ OTHER LAB (Dynamic Headers)
    function renderOtherHeaders() {
        const headerRow = document.getElementById('otherLabHeaderRow');
        if (!headerRow) return;
        headerRow.innerHTML = '';

        currentOtherColumns.forEach((col, cIdx) => {
            const th = document.createElement('th');
            th.dataset.colKey = col.key;
            th.dataset.colIndex = cIdx;

            let alignStyle = (col.type === 'flag') ? 'text-align: center;' : 'text-align: left;';
            th.style.cssText = alignStyle;

            th.innerHTML = `
                <div class="col-header-wrap">
                    <span class="col-title" contenteditable="${isReadOnlyMode ? 'false' : 'true'}" title="ຄລິກເພື່ອແກ້ໄຂຊື່ຖັນ (Click to Rename)">${escapeHtml(col.label)}</span>
                    ${(!isReadOnlyMode && currentOtherColumns.length > 1) ? `
                        <span class="col-actions no-print">
                            <button type="button" class="btn-del-col" title="ລຶບ Column ນີ້" data-col-key="${col.key}">
                                <i class="bi bi-x"></i>
                            </button>
                        </span>
                    ` : ''}
                </div>
            `;
            headerRow.appendChild(th);
        });

        // ຖັນຈັດການແຖວ (Actions)
        const actTh = document.createElement('th');
        actTh.className = 'no-print';
        actTh.style.cssText = 'width: 45px; text-align: center;';
        actTh.innerHTML = `<span style="font-size: 11px; color: #94a3b8;">ລຶບ</span>`;
        headerRow.appendChild(actTh);

        attachOtherHeaderEvents();
    }

    function attachOtherHeaderEvents() {
        const headerRow = document.getElementById('otherLabHeaderRow');
        if (!headerRow) return;

        // ແກ້ໄຂຊື່ຫົວ Column
        headerRow.querySelectorAll('.col-title').forEach(titleSpan => {
            const th = titleSpan.closest('th');
            const colKey = th?.dataset?.colKey;

            titleSpan.addEventListener('blur', () => {
                const newLabel = titleSpan.innerText.trim();
                const targetCol = currentOtherColumns.find(c => c.key === colKey);
                if (targetCol && newLabel) {
                    targetCol.label = newLabel;
                }
            });
            titleSpan.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    titleSpan.blur();
                }
            });
        });

        // ລຶບ Column
        headerRow.querySelectorAll('.btn-del-col').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                e.stopPropagation();
                const colKey = btn.dataset.colKey;
                if (currentOtherColumns.length <= 1) {
                    showToast('ຕ້ອງມີຢ່າງໜ້ອຍ 1 Column!');
                    return;
                }
                const colToDelete = currentOtherColumns.find(c => c.key === colKey);
                const colLabel = colToDelete ? colToDelete.label : colKey;

                let confirmed = false;
                if (typeof Swal !== 'undefined') {
                    const res = await Swal.fire({
                        title: 'ຢືນຢັນການລຶບ Column?',
                        html: `ທ່ານແນ່ໃຈບໍ່ວ່າຕ້ອງການລຶບ Column <b style="color: #dc2626;">"${escapeHtml(colLabel)}"</b>?`,
                        icon: 'warning',
                        showCancelButton: true,
                        confirmButtonColor: '#dc2626',
                        cancelButtonColor: '#64748b',
                        confirmButtonText: '<i class="bi bi-trash3-fill me-1"></i> ລຶບ Column',
                        cancelButtonText: 'ຍົກເລີກ',
                        reverseButtons: true
                    });
                    confirmed = res.isConfirmed;
                } else {
                    confirmed = confirm(`ທ່ານແນ່ໃຈບໍ່ວ່າຕ້ອງການລຶບ Column "${colLabel}"?`);
                }

                if (confirmed) {
                    currentOtherColumns = currentOtherColumns.filter(c => c.key !== colKey);
                    renderOtherHeaders();
                    renderOtherTable();
                    showToast(`ລຶບ Column "${colLabel}" ແລ້ວ`);
                }
            });
        });
    }

    // 2.5 ວາດຕາຕະລາງ OTHER LAB (Dynamic Rows & Columns)
    function renderOtherTable() {
        const tbody = document.getElementById('tbodyOther');
        if (!tbody) return;
        tbody.innerHTML = '';

        if (currentOtherRows.length === 0) {
            for (let i = 0; i < 4; i++) {
                const emptyRow = {};
                currentOtherColumns.forEach(c => { emptyRow[c.key] = ''; });
                currentOtherRows.push(emptyRow);
            }
        }

        currentOtherRows.forEach((row, rIdx) => {
            const tr = document.createElement('tr');
            tr.dataset.index = rIdx;

            const resCol = currentOtherColumns.find(c => c.type === 'result');
            const refCol = currentOtherColumns.find(c => c.type === 'ref');
            const valStr = resCol ? (row[resCol.key] || row.val || row.result || '') : (row.val || row.result || '');
            const refStr = refCol ? (row[refCol.key] || row.ref || '') : (row.ref || '');
            const flagInfo = computeBiochemFlag(valStr, refStr);

            currentOtherColumns.forEach(col => {
                const td = document.createElement('td');
                const cellVal = row[col.key] !== undefined ? row[col.key] : (row[col.type] || '');

                if (col.type === 'flag') {
                    td.style.textAlign = 'center';
                    td.innerHTML = `<span class="status ${flagInfo.cls}">${flagInfo.text}</span>`;
                } else {
                    const readonlyAttr = isReadOnlyMode ? 'readonly disabled style="background:transparent;border:none;"' : '';
                    td.innerHTML = `
                        <input type="text" 
                               class="other-cell-input ${col.type === 'result' ? 'result-input' : ''}" 
                               data-col-key="${col.key}" 
                               data-row-idx="${rIdx}" 
                               value="${escapeHtml(cellVal)}" 
                               placeholder="${col.label}..." 
                               ${readonlyAttr}>
                    `;

                    if (!isReadOnlyMode) {
                        const inEl = td.querySelector('input');
                        inEl.addEventListener('input', () => {
                            row[col.key] = inEl.value;
                            if (col.type === 'result' || col.type === 'ref') {
                                const newV = resCol ? (row[resCol.key] || '') : inEl.value;
                                const newR = refCol ? (row[refCol.key] || '') : '';
                                const newFl = computeBiochemFlag(newV, newR);
                                const flTd = tr.querySelector('.status');
                                if (flTd) {
                                    flTd.className = `status ${newFl.cls}`;
                                    flTd.innerText = newFl.text;
                                }
                            }
                        });
                    }
                }
                tr.appendChild(td);
            });

            // ປຸ່ມລຶບແຖວ
            const actTd = document.createElement('td');
            actTd.className = 'no-print';
            actTd.style.textAlign = 'center';
            actTd.innerHTML = !isReadOnlyMode ? `
                <button type="button" class="btn-remove-row" title="ລຶບແຖວນີ້" onclick="deleteOtherLabRow(${rIdx})">
                    <i class="bi bi-trash"></i>
                </button>
            ` : '';
            tr.appendChild(actTd);

            tbody.appendChild(tr);
        });
    }

    window.deleteOtherLabRow = function (rIdx) {
        if (currentOtherRows.length > 0 && rIdx >= 0 && rIdx < currentOtherRows.length) {
            currentOtherRows.splice(rIdx, 1);
            renderOtherTable();
        }
    };

    // =====================================================
    // 2.5 LOAD CLINIC SETTINGS (Logo, Stamp, Names, Contacts)
    // =====================================================
    async function loadClinicSettings() {
        let s = {};
        if (window.clinicSettings && typeof window.clinicSettings === 'object') {
            s = Object.assign({}, window.clinicSettings);
        }
        try {
            if (window.parent && window.parent !== window && window.parent.clinicSettings && typeof window.parent.clinicSettings === 'object') {
                s = Object.assign({}, window.parent.clinicSettings, s);
            }
        } catch (e) { }

        // 1. แคชจาก localStorage
        try {
            const cachedKeys = [
                'clinic_logo_url', 'clinic_stamp_url', 'clinic_logo', 'clinic_stamp',
                'clinic_name_la', 'clinic_name_en', 'clinic_address', 'clinic_phone', 'clinic_website'
            ];
            cachedKeys.forEach(k => {
                const val = localStorage.getItem(k);
                if (val && !s[k]) s[k] = val;
            });
            const cachedSettings = localStorage.getItem('clinic_settings');
            if (cachedSettings) {
                const parsed = JSON.parse(cachedSettings);
                s = Object.assign({}, parsed, s);
            }
            const cachedRefRanges = localStorage.getItem('clinic_lab_reference_ranges');
            if (cachedRefRanges && !window.clinicStandardRefRanges) {
                try { window.clinicStandardRefRanges = JSON.parse(cachedRefRanges); } catch (e) { }
            }
        } catch (e) { }

        // 2. ดึงจาก Supabase table clinic_settings
        if (sup) {
            try {
                const { data } = await sup.from('clinic_settings').select('key, value');
                if (data && data.length > 0) {
                    const fetchedMap = Object.fromEntries(data.map(r => [r.key, r.value]));
                    s = Object.assign({}, s, fetchedMap);
                    window.clinicSettings = s;
                    try { localStorage.setItem('clinic_settings', JSON.stringify(s)); } catch (e) { }

                    // 🌟 ໂຫຼດຄ່າອ້າງອີງມາດຕະຖານຂອງຄລີນິກ (Lab Reference Ranges)
                    if (fetchedMap['lab_reference_ranges']) {
                        try {
                            const parsedRanges = JSON.parse(fetchedMap['lab_reference_ranges']);
                            window.clinicStandardRefRanges = parsedRanges;
                            try { localStorage.setItem('clinic_lab_reference_ranges', JSON.stringify(parsedRanges)); } catch (e) { }
                        } catch (e) { }
                    }
                }
            } catch (e) {
                console.warn('[CombinedLab] load clinic_settings notice:', e);
            }
        }

        // โลโก้คลินิก
        const logoUrl = s['clinic_logo_url'] || s['clinic_logo'] || '';
        const logoImg = document.getElementById('clinicLogoImg');
        const logoFallback = document.getElementById('clinicLogoFallback');
        if (logoImg) {
            if (logoUrl) {
                logoImg.src = logoUrl;
                logoImg.style.display = 'inline-block';
                if (logoFallback) logoFallback.style.display = 'none';
            } else {
                logoImg.style.display = 'none';
                if (logoFallback) logoFallback.style.display = 'flex';
            }
        }

        // ตราประทับคลินิก (Official Stamp)
        const stampUrl = s['clinic_stamp_url'] || s['clinic_stamp'] || '';
        const stampImg = document.getElementById('clinicStampImg');
        const stampFallback = document.getElementById('clinicStampFallback');
        if (stampImg) {
            if (stampUrl) {
                stampImg.src = stampUrl;
                stampImg.style.display = 'inline-block';
                if (stampFallback) stampFallback.style.display = 'none';
            } else {
                stampImg.style.display = 'none';
                if (stampFallback) stampFallback.style.display = 'flex';
            }
        }

        // ชื่อคลินิก
        const nameLa = s['clinic_name_la'];
        const nameEn = s['clinic_name_en'];

        // 🌟 ດຶງຂໍ້ມູນສະຖານທີ່/ທີ່ຕັ້ງຈິງ (ຮວມບ້ານ, ເມືອງ, ແຂວງ, ປະເທດ)
        const rawAddr = s['clinic_address'] || '';
        const district = s['clinic_district'] || '';
        const province = s['clinic_province'] || '';
        const country = s['clinic_country'] || '';

        let addrParts = [];
        if (rawAddr) addrParts.push(rawAddr.trim());
        if (district && !addrParts.some(p => p.includes(district))) {
            addrParts.push(`ເມືອງ ${district.replace(/^(ເມືອງ|District)\s*/i, '').trim()}`);
        }
        if (province && !addrParts.some(p => p.includes(province))) {
            addrParts.push(province.trim());
        }
        if (country && !addrParts.some(p => p.includes(country))) {
            addrParts.push(country.trim());
        }
        const fullAddr = addrParts.join(', ') || rawAddr;

        // 🌟 ດຶງຂໍ້ມູນເບີໂທຈິງ (ຫຼັກ + ສຳຮອງ)
        const phone1 = (s['clinic_phone'] || '').trim();
        const phone2 = (s['clinic_phone2'] || '').trim();
        const fullPhone = [phone1, phone2].filter(Boolean).join(' / ');

        // 🌟 ດຶງຂໍ້ມູນເວັບໄຊ/ຊ່ອງທາງຕິດຕໍ່ຈິງ
        const rawWeb = (s['clinic_website'] || '').trim();
        const cleanWeb = rawWeb ? rawWeb.replace(/^https?:\/\//i, '').replace(/\/$/, '') : '';
        const email = (s['clinic_email'] || '').trim();
        const fb = (s['clinic_facebook'] || '').trim();
        const finalContactWeb = cleanWeb || email || fb;

        if (nameLa && document.getElementById('clinicNameLa')) document.getElementById('clinicNameLa').innerText = nameLa;
        if (nameEn && document.getElementById('clinicNameEn')) document.getElementById('clinicNameEn').innerText = nameEn;
        if (fullAddr) {
            if (document.getElementById('clinicAddressText')) document.getElementById('clinicAddressText').innerHTML = `<i class="bi bi-geo-alt-fill me-1"></i>${fullAddr}`;
            if (document.getElementById('footerAddress')) document.getElementById('footerAddress').innerHTML = `<i class="bi bi-geo-alt-fill me-1"></i>${fullAddr}`;
        }
        if (fullPhone) {
            if (document.getElementById('clinicPhoneText')) document.getElementById('clinicPhoneText').innerHTML = `<i class="bi bi-telephone-fill me-1"></i>${fullPhone}`;
            if (document.getElementById('footerPhone')) document.getElementById('footerPhone').innerHTML = `<i class="bi bi-telephone-fill me-1"></i>Tel: ${fullPhone}`;
        }
        if (finalContactWeb && document.getElementById('footerWebsite')) {
            const iconClass = cleanWeb ? 'bi-globe' : (email ? 'bi-envelope-fill' : 'bi-facebook');
            document.getElementById('footerWebsite').innerHTML = `<i class="bi ${iconClass} me-1"></i>${finalContactWeb}`;
        }
    }

    // =====================================================
    // 2.6 CLINIC STANDARD REFERENCE RANGES (MIN/MAX & REF)
    // =====================================================
    function getClinicStandardRefRanges() {
        if (window.clinicStandardRefRanges && typeof window.clinicStandardRefRanges === 'object') {
            return window.clinicStandardRefRanges;
        }
        try {
            const cached = localStorage.getItem('clinic_lab_reference_ranges');
            if (cached) {
                const parsed = JSON.parse(cached);
                window.clinicStandardRefRanges = parsed;
                return parsed;
            }
        } catch (e) { }
        return null;
    }

    function applyStandardRefRanges(cbcList, biochemList, urineList, std) {
        if (!std) return;

        // 1. CBC (Min, Max, Unit)
        if (std.cbc && Array.isArray(cbcList)) {
            cbcList.forEach(item => {
                if (item.name && std.cbc[item.name]) {
                    const cRef = std.cbc[item.name];
                    if (cRef.min !== undefined && cRef.min !== '') item.min = cRef.min;
                    if (cRef.max !== undefined && cRef.max !== '') item.max = cRef.max;
                    if (cRef.unit !== undefined && cRef.unit !== '') item.unit = cRef.unit;
                }
            });
        }

        // 2. Biochemistry (Ref, Unit)
        if (std.biochem && Array.isArray(biochemList)) {
            biochemList.forEach(item => {
                if (item.test && std.biochem[item.test]) {
                    const bRef = std.biochem[item.test];
                    if (bRef.ref !== undefined && bRef.ref !== '') item.ref = bRef.ref;
                    if (bRef.unit !== undefined && bRef.unit !== '') item.unit = bRef.unit;
                }
            });
        }

        // 3. Urinalysis (Ref)
        if (std.urine && Array.isArray(urineList)) {
            urineList.forEach(item => {
                const uKey = item.refId || item.id || item.test;
                if (uKey && std.urine[uKey]) {
                    if (std.urine[uKey].ref !== undefined && std.urine[uKey].ref !== '') {
                        item.ref = std.urine[uKey].ref;
                    }
                }
            });
        }
    }

    async function saveCurrentRangesAsStandard() {
        if (typeof Swal === 'undefined') {
            alert('ກະລຸນາລໍຖ້າລະບົບໂຫຼດສຳເລັດ');
            return;
        }

        const confirmResult = await Swal.fire({
            title: 'ບັນທຶກຄ່າອ້າງອີງມາດຕະຖານ?',
            html: `
                <div style="font-size: 13.5px; text-align: left; line-height: 1.6; color: #334155;">
                    <p class="mb-2">ຕ້ອງການບັນທຶກຄ່າ <strong>Min / Max</strong> ແລະ <strong>Ref. Ranges</strong> ທີ່ປ້ອນໄວ້ໃນຕາຕະລາງຕອນນີ້ ໃຫ້ເປັນ <strong>"ຄ່າເລີ່ມຕົ້ນມາດຕະຖານຂອງຄລີນິກ"</strong> ແທ້ຫຼືບໍ່?</p>
                    <div style="background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px; padding: 10px; font-size: 12px; color: #166534;">
                        <i class="bi bi-info-circle-fill me-1"></i> ເມື່ອບັນທຶກແລ້ວ ທຸກຄັ້ງທີ່ເປີດໃບກວດຂອງຄົນເຈັບໃໝ່ ລະບົບຈະດຶງຄ່າຊຸດນີ້ມາໃຊ້ເປັນຄ່າເລີ່ມຕົ້ນອັດຕະໂນມັດທັນທີ (ໃຊ້ຮ່ວມກັນທຸກເຄື່ອງໃນຄລີນິກ).
                    </div>
                </div>
            `,
            icon: 'question',
            showCancelButton: true,
            confirmButtonColor: '#0b3c73',
            cancelButtonColor: '#64748b',
            confirmButtonText: '<i class="bi bi-check-circle-fill me-1"></i>ບັນທຶກ',
            cancelButtonText: 'ຍົກເລີກ',
            showDenyButton: true,
            denyButtonColor: '#ef4444',
            denyButtonText: '<i class="bi bi-arrow-counterclockwise me-1"></i>ຄືນຄ່າເດີມ'
        });

        if (confirmResult.isDenied) {
            await resetStandardRefRangesToFactory();
            return;
        }

        if (!confirmResult.isConfirmed) return;

        Swal.fire({
            title: 'ກຳລັງບັນທຶກຄ່າອ້າງອີງ...',
            allowOutsideClick: false,
            didOpen: () => Swal.showLoading()
        });

        try {
            // 1. Scrape CBC ranges
            const cbcRanges = {};
            document.querySelectorAll('#tbodyCbc tr[data-name]').forEach(tr => {
                const name = tr.dataset.name;
                const min = tr.querySelector('.cbc-min')?.value?.trim() ?? '';
                const max = tr.querySelector('.cbc-max')?.value?.trim() ?? '';
                const unit = tr.querySelector('.text-muted')?.innerText?.trim() ?? '';
                if (name) cbcRanges[name] = { min, max, unit };
            });

            // 2. Scrape Biochem ranges
            const biochemRanges = {};
            document.querySelectorAll('#tbodyBiochem tr').forEach(tr => {
                const testName = tr.querySelector('td strong')?.innerText?.trim();
                const ref = tr.querySelector('.biochem-ref')?.value?.trim() ?? '';
                const unit = tr.querySelector('.biochem-unit')?.value?.trim() ?? '';
                if (testName) biochemRanges[testName] = { ref, unit };
            });

            // 3. Scrape Urine ranges
            const urineRanges = {};
            document.querySelectorAll('#tbodyUrine tr[data-id]').forEach(tr => {
                const id = tr.dataset.id;
                const refInput = tr.querySelector('.urine-ref');
                if (id && refInput) {
                    const refId = refInput.id || id;
                    urineRanges[refId] = { ref: refInput.value?.trim() ?? '' };
                }
            });

            const stdPayload = {
                cbc: cbcRanges,
                biochem: biochemRanges,
                urine: urineRanges,
                updated_at: new Date().toISOString()
            };

            const payloadStr = JSON.stringify(stdPayload);

            // A. ບັນທຶກລົງ Supabase table clinic_settings
            if (sup) {
                const { error: sbErr } = await sup.from('clinic_settings').upsert({
                    key: 'lab_reference_ranges',
                    value: payloadStr
                }, { onConflict: 'key' });
                if (sbErr) console.warn('Save lab_reference_ranges to DB notice:', sbErr);
            }

            // B. ບັນທຶກລົງ LocalStorage
            try {
                localStorage.setItem('clinic_lab_reference_ranges', payloadStr);
            } catch (e) { }

            window.clinicStandardRefRanges = stdPayload;

            Swal.fire({
                icon: 'success',
                title: 'ບັນທຶກສຳເລັດ!',
                text: 'ຄ່າ Min/Max ແລະ ຄ່າອ້າງອີງໄດ້ຖືກຕັ້ງເປັນ "ຄ່າເລີ່ມຕົ້ນມາດຕະຖານຂອງຄລີນິກ" ຮຽບຮ້ອຍແລ້ວ',
                timer: 2500,
                showConfirmButton: false
            });

        } catch (err) {
            console.error('saveCurrentRangesAsStandard error:', err);
            Swal.fire('ຂໍ້ຜິດພາດ', 'ບໍ່ສາມາດບັນທຶກຄ່າອ້າງອີງໄດ້: ' + (err.message || err), 'error');
        }
    }

    async function resetStandardRefRangesToFactory() {
        const cf = await Swal.fire({
            title: 'ຢືນຢັນຄືນຄ່າເດີມ?',
            text: 'ລະບົບຈະລຶບຄ່າອ້າງອີງມາດຕະຖານທີ່ເຄີຍບັນທຶກໄວ້ ແລະ ກັບໄປໃຊ້ຄ່າຕັ້ງຕົ້ນດັ້ງເດີມ',
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#ef4444',
            cancelButtonColor: '#64748b',
            confirmButtonText: 'ຄືນຄ່າເດີມ',
            cancelButtonText: 'ຍົກເລີກ'
        });
        if (!cf.isConfirmed) return;

        try {
            if (sup) {
                await sup.from('clinic_settings').delete().eq('key', 'lab_reference_ranges');
            }
            try { localStorage.removeItem('clinic_lab_reference_ranges'); } catch (e) { }
            window.clinicStandardRefRanges = null;

            Swal.fire({
                icon: 'success',
                title: 'ຄືນຄ່າສຳເລັດ',
                text: 'ລະບົບໄດ້ກັບໄປໃຊ້ຄ່າມາດຕະຖານເດີມແລ້ວ ກຳລັງໂຫຼດໜ້າໃໝ່...',
                timer: 1500,
                showConfirmButton: false
            });
            setTimeout(() => {
                window.location.reload();
            }, 1200);
        } catch (err) {
            Swal.fire('ຂໍ້ຜິດພາດ', err.message || err, 'error');
        }
    }
    window.saveCurrentRangesAsStandard = saveCurrentRangesAsStandard;
    window.resetStandardRefRangesToFactory = resetStandardRefRangesToFactory;

    // =====================================================
    // 3. LOAD EXISTING SAVED LAB DATA
    // =====================================================
    async function loadAllLabData() {
        document.getElementById('metaVisitId').innerText = visitId || '-';
        document.getElementById('metaHn').innerText = hn || '-';
        document.getElementById('metaPatientName').innerText = patientName || '-';
        const todayStr = formatLaoDate(new Date());
        document.getElementById('metaDate').innerText = todayStr;
        if (document.getElementById('metaTestDate')) document.getElementById('metaTestDate').innerText = todayStr;
        if (document.getElementById('metaReportDate')) document.getElementById('metaReportDate').innerText = todayStr;

        if (document.getElementById('verifyVisitId')) document.getElementById('verifyVisitId').innerText = visitId || '-';
        if (document.getElementById('verifyHn')) document.getElementById('verifyHn').innerText = hn || '-';

        // QR Code สำหรับກວດສອບເອກະສານ Digital Lab
        const qrImg = document.getElementById('qrCodeImg');
        if (qrImg) {
            const qrTargetUrl = `${window.location.origin}${window.location.pathname}?visit_id=${encodeURIComponent(visitId)}&hn=${encodeURIComponent(hn)}&mode=print`;
            qrImg.src = `https://api.qrserver.com/v1/create-qr-code/?size=150x150&margin=4&data=${encodeURIComponent(qrTargetUrl)}`;
        }

        let cbcList = JSON.parse(JSON.stringify(BASE_CBC_ITEMS));
        let biochemList = JSON.parse(JSON.stringify(BASE_BIOCHEM_ITEMS));
        let urineList = JSON.parse(JSON.stringify(BASE_URINE_ITEMS));

        // 🌟 ນຳໃຊ້ຄ່າອ້າງອີງມາດຕະຖານຂອງຄລີນິກ (Clinic Standard Reference Ranges)
        const stdRanges = getClinicStandardRefRanges();
        if (stdRanges) {
            applyStandardRefRanges(cbcList, biochemList, urineList, stdRanges);
        }

        let bloodGroupVal = '';
        let commentVal = '';

        // 1. โหลดจาก Combined Lab results เก่า
        let combSaved = null;
        try {
            const allComb = JSON.parse(localStorage.getItem('clinic_combined_lab_results') || '{}');
            combSaved = allComb[visitId] || allComb[String(visitId).replace('VIS-', '')];
        } catch (e) { }

        // 2. ดึงจาก Supabase visits row
        let vDbRow = null;
        if (sup && visitId) {
            try {
                const { data: vRow } = await sup.from('visits').select('*').eq('visit_id', visitId).maybeSingle();
                if (vRow) {
                    vDbRow = vRow;
                    if (vRow.hn && (!hn || hn === '-')) {
                        document.getElementById('metaHn').innerText = vRow.hn;
                        if (document.getElementById('verifyHn')) document.getElementById('verifyHn').innerText = vRow.hn;
                    }
                    if (vRow.patient_name && (!patientName || patientName === '-')) document.getElementById('metaPatientName').innerText = vRow.patient_name;
                    if (vRow.created_at) {
                        const visitDateStr = formatLaoDate(vRow.created_at);
                        document.getElementById('metaDate').innerText = visitDateStr;
                        if (document.getElementById('metaTestDate')) document.getElementById('metaTestDate').innerText = visitDateStr;
                    }

                    // ຊື່ທ່ານໝໍ (Doctor Name) ແຍກພາສາລາວ ແລະ ອັງກິດ
                    const docName = vRow.doctor_name || 'ດຣ ສີສຸກ ແສງປະເສີດ / Dr. Sisouk SENGPASEUTH';
                    if (docName.includes('/')) {
                        const [dLa, dEn] = docName.split('/').map(s => s.trim());
                        if (document.getElementById('doctorNameLa')) document.getElementById('doctorNameLa').innerText = dLa;
                        if (document.getElementById('doctorNameEn')) document.getElementById('doctorNameEn').innerText = dEn;
                    } else {
                        if (document.getElementById('doctorNameLa')) document.getElementById('doctorNameLa').innerText = docName;
                    }

                    if (vRow.lab_note && vRow.lab_note.includes('[ผลตรวจ Combined Lab]')) {
                        const m = vRow.lab_note.match(/\[ผลตรวจ Combined Lab\]\s*([\s\S]*?)\s*\[\/ผลตรวจ Combined Lab\]/);
                        if (m && m[1]) {
                            try { combSaved = JSON.parse(m[1]); } catch (e) { }
                        }
                    }
                }
            } catch (dbErr) {
                console.warn('Fetch visit error:', dbErr);
            }
        }

        // =========================================================
        // 2.1 ດຶງຂໍ້ມູນຜູ້ປ່ວຍລະອຽດ (Phone, Age, Address, Gender) ຈາກຖານຂໍ້ມູນ patients
        // =========================================================
        const curHn = (vDbRow && vDbRow.hn) || hn;
        const curPatName = (vDbRow && vDbRow.patient_name) || patientName;
        let pDbRow = null;

        // A. ລອງດຶງຈາກ Cache ໃນ Window Parent (allPatients)
        try {
            const ptsCache = (window.parent && window.parent.allPatients) || window.allPatients;
            if (Array.isArray(ptsCache) && ptsCache.length > 0) {
                if (curHn && curHn !== '-') pDbRow = ptsCache.find(x => x.hn === curHn);
                if (!pDbRow && curPatName && curPatName !== '-') pDbRow = ptsCache.find(x => x.patient_name === curPatName);
            }
        } catch (e) { }

        // B. Query ຈາກ Supabase table 'patients'
        if (!pDbRow && sup) {
            try {
                if (curHn && curHn !== '-') {
                    const { data: pData } = await sup.from('patients').select('*').eq('hn', curHn).maybeSingle();
                    if (pData) pDbRow = pData;
                }
                if (!pDbRow && curPatName && curPatName !== '-') {
                    const { data: pData } = await sup.from('patients').select('*').eq('patient_name', curPatName.trim()).maybeSingle();
                    if (pData) pDbRow = pData;
                }
            } catch (pErr) {
                console.warn('Fetch patient row error:', pErr);
            }
        }

        // C. ສະແດງຜົນ HN & ຊື່
        if (pDbRow && pDbRow.hn && (!hn || hn === '-')) {
            document.getElementById('metaHn').innerText = pDbRow.hn;
            if (document.getElementById('verifyHn')) document.getElementById('verifyHn').innerText = pDbRow.hn;
        }
        if (pDbRow && pDbRow.patient_name && (!patientName || patientName === '-')) {
            document.getElementById('metaPatientName').innerText = pDbRow.patient_name;
        }

        // D. ຄິດໄລ່ ແລະ ສະແດງ ອາຍຸ (Age) & ເພດ (Gender)
        function calcAge(ageVal, dobVal) {
            if (ageVal !== undefined && ageVal !== null && ageVal !== '' && ageVal !== '-' && ageVal !== 'null' && ageVal !== 0 && ageVal !== '0') {
                const num = String(ageVal).replace(/[^0-9]/g, '');
                if (num) return `${num} ປີ`;
            }
            if (dobVal && dobVal !== '-' && dobVal !== 'null') {
                const d = new Date(dobVal);
                if (!isNaN(d.getTime())) {
                    const now = new Date();
                    let a = now.getFullYear() - d.getFullYear();
                    const m = now.getMonth() - d.getMonth();
                    if (m < 0 || (m === 0 && now.getDate() < d.getDate())) a--;
                    if (a >= 0) return `${a} ປີ`;
                }
            }
            return '-';
        }

        const resolvedAge = calcAge(pDbRow ? pDbRow.age : null, pDbRow ? pDbRow.dob : null);
        const fallbackAge = calcAge(vDbRow ? vDbRow.patient_age || vDbRow.age : null, vDbRow ? vDbRow.dob : null);
        const finalAge = resolvedAge !== '-' ? resolvedAge : fallbackAge;

        const finalGender = (pDbRow && (pDbRow.gender || pDbRow.sex)) || (vDbRow && (vDbRow.gender || vDbRow.sex)) || '-';

        if (document.getElementById('metaAge')) document.getElementById('metaAge').innerText = finalAge;
        if (document.getElementById('metaGender')) document.getElementById('metaGender').innerText = finalGender;
        if (document.getElementById('metaAgeGender')) {
            if (finalAge !== '-' && finalGender !== '-') {
                document.getElementById('metaAgeGender').innerText = `${finalAge} / ${finalGender}`;
            } else if (finalAge !== '-') {
                document.getElementById('metaAgeGender').innerText = finalAge;
            } else if (finalGender !== '-') {
                document.getElementById('metaAgeGender').innerText = finalGender;
            } else {
                document.getElementById('metaAgeGender').innerText = '-';
            }
        }

        // E. ສະແດງ ເບີໂທ (Phone Number)
        const finalPhone = (pDbRow && (pDbRow.phone || pDbRow.tel || pDbRow.emergency_tel)) ||
                           (vDbRow && (vDbRow.patient_phone || vDbRow.phone || vDbRow.tel)) || '-';
        if (document.getElementById('metaPhone')) {
            document.getElementById('metaPhone').innerText = (finalPhone && finalPhone !== '00000000000') ? String(finalPhone).trim() : '-';
        }

        // F. ສະແດງ ທີ່ຢູ່ (Address: ບ້ານ, ເມືອງ, ແຂວງ)
        function formatFullAddress(vill, dist, prov, rawAddr) {
            const parts = [];
            if (vill && vill !== '-' && vill !== 'null') {
                const v = String(vill).trim();
                parts.push(v.startsWith('ບ້ານ') || v.startsWith('ບ.') ? v : `ບ້ານ ${v}`);
            }
            if (dist && dist !== '-' && dist !== 'null') {
                const d = String(dist).trim();
                parts.push(d.startsWith('ເມືອງ') || d.startsWith('ມ.') ? d : `ເມືອງ ${d}`);
            }
            if (prov && prov !== '-' && prov !== 'null') {
                const p = String(prov).trim();
                parts.push(p.startsWith('ແຂວງ') || p.startsWith('ຂ.') || p.includes('ນະຄອນຫຼວງ') ? p : `ແຂວງ ${p}`);
            }
            if (parts.length === 0 && rawAddr && rawAddr !== '-' && rawAddr !== 'null') {
                parts.push(String(rawAddr).trim());
            }
            return parts.length > 0 ? parts.join(', ') : '-';
        }

        const finalAddress = formatFullAddress(
            pDbRow ? pDbRow.village : (vDbRow ? vDbRow.village : null),
            pDbRow ? pDbRow.district : (vDbRow ? vDbRow.district : null),
            pDbRow ? pDbRow.province : (vDbRow ? vDbRow.province : null),
            pDbRow ? pDbRow.address : (vDbRow ? vDbRow.address || vDbRow.patient_address : null)
        );
        if (document.getElementById('metaAddress')) {
            document.getElementById('metaAddress').innerText = finalAddress;
        }

        // =========================================================
        // 3. ดึงข้อมูลจริงจากแต่ละฟอร์มแยก (CBC, Urine, Biochem, Other)
        // =========================================================

        // 3.1 CBC: จาก clinic_cbc_results หรือ [ผลตรวจ CBC]
        let cbcSavedItems = null;
        try {
            const allCbc = JSON.parse(localStorage.getItem('clinic_cbc_results') || '{}');
            const cSaved = allCbc[visitId] || allCbc[String(visitId).replace('VIS-', '')];
            if (cSaved && Array.isArray(cSaved.items)) cbcSavedItems = cSaved.items;
        } catch (e) { }
        if (!cbcSavedItems && vDbRow && vDbRow.lab_note && vDbRow.lab_note.includes('[ผลตรวจ CBC]')) {
            const m = vDbRow.lab_note.match(/\[ผลตรวจ CBC\]\s*([\s\S]*?)\s*\[\/ผลตรวจ CBC\]/);
            if (m && m[1]) {
                try {
                    const parsed = JSON.parse(m[1]);
                    if (Array.isArray(parsed)) cbcSavedItems = parsed;
                    else if (parsed && Array.isArray(parsed.items)) cbcSavedItems = parsed.items;
                } catch (e) { }
            }
        }
        if (cbcSavedItems && Array.isArray(cbcSavedItems)) {
            const cMap = new Map();
            cbcSavedItems.forEach(it => {
                if (it.name) cMap.set(it.name, it);
            });
            cbcList.forEach(def => {
                if (def.section) return;
                if (cMap.has(def.name)) {
                    const saved = cMap.get(def.name);
                    def.val = (saved.value !== undefined ? saved.value : saved.val) || '';
                    if (saved.min !== undefined && saved.min !== '') def.min = saved.min;
                    if (saved.max !== undefined && saved.max !== '') def.max = saved.max;
                    if (saved.unit) def.unit = saved.unit;
                }
            });
        }

        // 3.2 BIOCHEMISTRY: จาก stk-biochem-report หรือ clinic_biochem_results หรือ [ผลตรวจ Biochem]
        let bioSavedItems = null;
        try {
            const rawBio = localStorage.getItem('stk-biochem-report:' + visitId);
            if (rawBio) {
                const p = JSON.parse(rawBio);
                if (p && Array.isArray(p.items)) bioSavedItems = p.items;
            }
            if (!bioSavedItems) {
                const allB = JSON.parse(localStorage.getItem('clinic_biochem_results') || '{}');
                const bSaved = allB[visitId] || allB[String(visitId).replace('VIS-', '')];
                if (bSaved && Array.isArray(bSaved.items)) bioSavedItems = bSaved.items;
            }
        } catch (e) { }
        if (!bioSavedItems && vDbRow && vDbRow.lab_note && vDbRow.lab_note.includes('[ผลตรวจ Biochem]')) {
            const m = vDbRow.lab_note.match(/\[ผลตรวจ Biochem\]\s*([\s\S]*?)\s*\[\/ผลตรวจ Biochem\]/);
            if (m && m[1]) {
                try {
                    const parsed = JSON.parse(m[1]);
                    if (Array.isArray(parsed)) bioSavedItems = parsed;
                    else if (parsed && Array.isArray(parsed.items)) bioSavedItems = parsed.items;
                } catch (e) { }
            }
        }
        if (bioSavedItems && Array.isArray(bioSavedItems) && bioSavedItems.length > 0) {
            const bMap = new Map();
            bioSavedItems.forEach(it => {
                const k = (it.test || it.name || '').toUpperCase().trim();
                if (k) {
                    bMap.set(k, it);
                    if (k.includes('ALP')) {
                        bMap.set('ALP', it);
                        bMap.set('ALP (AKP)', it);
                        bMap.set('ALP (AMP)', it);
                        bMap.set('ALP-AMP', it);
                    }
                    if (k.includes('ALT') || k.includes('GPT')) {
                        bMap.set('ALT', it);
                        bMap.set('ALT (GPT)', it);
                        bMap.set('ALT-GPT', it);
                    }
                    if (k.includes('AST') || k.includes('GOT')) {
                        bMap.set('AST', it);
                        bMap.set('AST (GOT)', it);
                        bMap.set('AST-GOT', it);
                    }
                    if (k.includes('BILIRUBIN') && (k.includes('TOTAL') || k.includes('T-BIL'))) {
                        bMap.set('BILIRUBIN TOTAL', it);
                        bMap.set('TOTAL BILIRUBIN', it);
                        bMap.set('T-BIL', it);
                    }
                    if (k.includes('CALCIUM') || k.includes('ARSENAZO')) {
                        bMap.set('CALCIUM ARSENAZO', it);
                        bMap.set('CALCIUM (SERUM)', it);
                        bMap.set('CALCIUM', it);
                    }
                    if (k.includes('HDL')) {
                        bMap.set('CHOL HDL DIRECT', it);
                        bMap.set('CHOL:HDL DIRECT', it);
                        bMap.set('CHOL-HDL DIRECT', it);
                        bMap.set('HDL', it);
                    }
                    if (k.includes('LDL')) {
                        bMap.set('CHOL LDL DIRECT', it);
                        bMap.set('CHOL:LDL DIRECT', it);
                        bMap.set('CHOL-LDL DIRECT', it);
                        bMap.set('LDL', it);
                    }
                    if (k.includes('UREA') || k.includes('BUN')) {
                        bMap.set('UREA-BUN-UV', it);
                        bMap.set('UREA (BUN)', it);
                        bMap.set('UREA', it);
                        bMap.set('BUN', it);
                    }
                }
            });
            biochemList.forEach(def => {
                const k = def.test.toUpperCase().trim();
                if (bMap.has(k)) {
                    const s = bMap.get(k);
                    def.val = (s.val !== undefined ? s.val : s.value) || '';
                    if (s.unit) def.unit = s.unit;
                    if (s.ref) def.ref = s.ref;
                }
            });
            bioSavedItems.forEach(it => {
                const valStr = String((it.val !== undefined ? it.val : it.value) || '').trim();
                if (!valStr) return; // Only push extra items if there is an actual measured value
                const k = (it.test || it.name || '').toUpperCase().trim();
                const exists = biochemList.some(b => {
                    const bKey = b.test.toUpperCase().trim();
                    return bKey === k ||
                           (bKey.includes('ALP') && k.includes('ALP')) ||
                           (bKey.includes('ALT') && k.includes('ALT')) ||
                           (bKey.includes('AST') && k.includes('AST')) ||
                           (bKey.includes('BILIRUBIN') && k.includes('BILIRUBIN')) ||
                           (bKey.includes('HDL') && k.includes('HDL')) ||
                           (bKey.includes('LDL') && k.includes('LDL')) ||
                           (bKey.includes('UREA') && k.includes('UREA'));
                });
                if (!exists && it.test) {
                    biochemList.push({
                        test: it.test,
                        sample: it.sample || 'SER',
                        unit: it.unit || '',
                        ref: it.ref || '',
                        val: valStr
                    });
                }
            });
        }

        // 3.3 URINALYSIS: จาก stk-urine-report หรือ [ผลตรวจ Urine]
        let urineSavedVals = null;
        try {
            const rawU = localStorage.getItem('stk-urine-report:' + visitId);
            if (rawU) {
                const p = JSON.parse(rawU);
                if (p && p.values) urineSavedVals = p.values;
            }
        } catch (e) { }
        if (!urineSavedVals && vDbRow && vDbRow.lab_note && vDbRow.lab_note.includes('[ผลตรวจ Urine]')) {
            const m = vDbRow.lab_note.match(/\[ผลตรวจ Urine\]\s*([\s\S]*?)\s*\[\/ผลตรวจ Urine\]/);
            if (m && m[1]) {
                try { urineSavedVals = JSON.parse(m[1]); } catch (e) { }
            }
        }
        if (urineSavedVals && typeof urineSavedVals === 'object') {
            urineList.forEach(u => {
                if (urineSavedVals[u.id] !== undefined) u.val = urineSavedVals[u.id];
                if (u.refId && urineSavedVals[u.refId] !== undefined) u.ref = urineSavedVals[u.refId];
            });
        }

        // 3.4 OTHER LAB: จาก clinic_other_lab_ ຫຼື [ผลตรวจ Other Lab] (ກວດຖັນ Dynamic Columns)
        let otherSavedObj = null;
        try {
            const rawO = localStorage.getItem(`clinic_other_lab_${visitId}`);
            if (rawO) otherSavedObj = JSON.parse(rawO);
        } catch (e) { }
        if (!otherSavedObj && vDbRow && vDbRow.lab_note && vDbRow.lab_note.includes('[ผลตรวจ Other Lab]')) {
            const m = vDbRow.lab_note.match(/\[ผลตรวจ Other Lab\]\s*([\s\S]*?)\s*\[\/ผลตรวจ Other Lab\]/);
            if (m && m[1]) {
                try { otherSavedObj = JSON.parse(m[1]); } catch (e) { }
            }
        }
        if (otherSavedObj && typeof otherSavedObj === 'object') {
            if (Array.isArray(otherSavedObj.columns) && otherSavedObj.columns.length > 0) {
                currentOtherColumns = otherSavedObj.columns;
            }
            if (Array.isArray(otherSavedObj.items) && otherSavedObj.items.length > 0) {
                currentOtherRows = otherSavedObj.items;
            } else if (Array.isArray(otherSavedObj) && otherSavedObj.length > 0) {
                currentOtherRows = otherSavedObj;
            }
        }

        // 3.5 ຖ້າມີ Combined Lab ທີ່ເຄີຍບັນທຶກໄວ້
        if (combSaved) {
            if (Array.isArray(combSaved.cbc)) cbcList = combSaved.cbc;
            if (Array.isArray(combSaved.biochem) && combSaved.biochem.length > 0) {
                const hasAnyVal = combSaved.biochem.some(x => x && (x.val !== undefined && String(x.val).trim() !== '' || x.value !== undefined && String(x.value).trim() !== ''));
                if (hasAnyVal) {
                    const bSavedMap = new Map();
                    combSaved.biochem.forEach(it => {
                        if (it && it.test) {
                            const k = it.test.toUpperCase().trim();
                            bSavedMap.set(k, it);
                            if (k.includes('ALP')) bSavedMap.set('ALP-AMP', it);
                            if (k.includes('ALT') || k.includes('GPT')) bSavedMap.set('ALT-GPT', it);
                            if (k.includes('AST') || k.includes('GOT')) bSavedMap.set('AST-GOT', it);
                            if (k.includes('BILIRUBIN') && (k.includes('TOTAL') || k.includes('T-BIL'))) bSavedMap.set('BILIRUBIN TOTAL', it);
                            if (k.includes('CALCIUM')) bSavedMap.set('CALCIUM ARSENAZO', it);
                            if (k.includes('HDL')) bSavedMap.set('CHOL HDL DIRECT', it);
                            if (k.includes('LDL')) bSavedMap.set('CHOL LDL DIRECT', it);
                            if (k.includes('UREA') || k.includes('BUN')) bSavedMap.set('UREA-BUN-UV', it);
                        }
                    });
                    biochemList.forEach(def => {
                        const k = def.test.toUpperCase().trim();
                        if (bSavedMap.has(k)) {
                            const s = bSavedMap.get(k);
                            def.val = (s.val !== undefined ? s.val : s.value) || '';
                            if (s.unit) def.unit = s.unit;
                            if (s.ref) def.ref = s.ref;
                        }
                    });
                    combSaved.biochem.forEach(it => {
                        const valStr = String((it.val !== undefined ? it.val : it.value) || '').trim();
                        if (!valStr) return;
                        const k = (it.test || '').toUpperCase().trim();
                        const exists = biochemList.some(b => {
                            const bKey = b.test.toUpperCase().trim();
                            return bKey === k ||
                                   (bKey.includes('ALP') && k.includes('ALP')) ||
                                   (bKey.includes('ALT') && k.includes('ALT')) ||
                                   (bKey.includes('AST') && k.includes('AST')) ||
                                   (bKey.includes('BILIRUBIN') && k.includes('BILIRUBIN')) ||
                                   (bKey.includes('HDL') && k.includes('HDL')) ||
                                   (bKey.includes('LDL') && k.includes('LDL')) ||
                                   (bKey.includes('UREA') && k.includes('UREA'));
                        });
                        if (!exists && it.test) {
                            biochemList.push({
                                test: it.test,
                                sample: it.sample || 'SER',
                                unit: it.unit || '',
                                ref: it.ref || '',
                                val: valStr
                            });
                        }
                    });
                }
            }
            if (Array.isArray(combSaved.urine)) urineList = combSaved.urine;
            if (combSaved.other) {
                if (Array.isArray(combSaved.other.columns) && combSaved.other.columns.length > 0) {
                    currentOtherColumns = combSaved.other.columns;
                }
                if (Array.isArray(combSaved.other.items)) {
                    currentOtherRows = combSaved.other.items;
                } else if (Array.isArray(combSaved.other)) {
                    currentOtherRows = combSaved.other;
                }
            }
            if (combSaved.bloodGroup) bloodGroupVal = combSaved.bloodGroup;
            if (combSaved.comment) commentVal = combSaved.comment;

            if (combSaved.visibleSections) {
                ['cbc', 'biochem', 'urine', 'other'].forEach(sec => {
                    const isVis = combSaved.visibleSections[sec] !== false;
                    toggleSection(sec, isVis);
                });
            }
        }

        // 🌟 ຖ້າບໍ່ມີ combSaved ເກົ່າ ໃຫ້ນຳໃຊ້ຄ່າອ້າງອີງມາດຕະຖານ (stdRanges) ທັບຄ່າເລີ່ມຕົ້ນດັ້ງເດີມ
        if (!combSaved && stdRanges) {
            applyStandardRefRanges(cbcList, biochemList, urineList, stdRanges);
        }

        // ວາດຕາຕະລາງທຸກໝວດ
        renderCbcTable(cbcList);
        renderBiochemTable(biochemList);
        renderUrineTable(urineList);
        renderOtherHeaders();
        renderOtherTable();

        if (bloodGroupVal) {
            const bgIn = document.getElementById('bloodGroupInput');
            if (bgIn) bgIn.value = bloodGroupVal;
            const bgBadge = document.getElementById('metaBloodGroupBadge');
            if (bgBadge) {
                bgBadge.innerHTML = `<strong style="color:#dc2626;font-size:11.5px;font-weight:800;background:#fee2e2;padding:1px 6px;border-radius:4px;display:inline-block;">${bloodGroupVal}</strong>`;
            }
        }
        if (commentVal) {
            const cIn = document.getElementById('doctorComment');
            if (cIn) cIn.value = commentVal;
            const adviceEl = document.getElementById('doctorAdviceDisplay');
            if (adviceEl) {
                const lines = commentVal.split('\n').filter(Boolean);
                if (lines.length > 0) {
                    adviceEl.innerHTML = lines.map(l => `<div>• ${escapeHtml(l.replace(/^[•\-\*]\s*/, ''))}</div>`).join('');
                } else {
                    adviceEl.innerText = commentVal;
                }
            }
        }

        showToast('ໂຫຼດຂໍ້ມູນຜົນກວດສຳເລັດແລ້ວ');
    }

    // =====================================================
    // 4. COLLECT TABLE DATA FOR SAVING
    // =====================================================
    function collectCbcData() {
        const rows = document.querySelectorAll('#tbodyCbc tr');
        const list = [];
        rows.forEach(tr => {
            if (tr.classList.contains('sectionrow')) {
                list.push({ section: tr.innerText.trim() });
                return;
            }
            const name = tr.dataset.name || tr.cells[0]?.innerText.trim();
            const val = tr.querySelector('.cbc-val')?.value?.trim() ?? '';
            const unit = tr.cells[2]?.innerText.trim() ?? '';
            const min = tr.querySelector('.cbc-min')?.value?.trim() ?? '';
            const max = tr.querySelector('.cbc-max')?.value?.trim() ?? '';
            const status = tr.querySelector('.status')?.innerText.trim() ?? '';
            list.push({ name, val, unit, min, max, status });
        });
        return list;
    }

    function collectBiochemData() {
        const rows = document.querySelectorAll('#tbodyBiochem tr');
        const list = [];
        rows.forEach(tr => {
            if (tr.classList.contains('sectionrow')) return;
            const category = tr.dataset.category || '';
            const test = tr.cells[0]?.innerText.trim();
            const sample = tr.cells[1]?.innerText.trim() || 'SER';
            const val = tr.querySelector('.biochem-val')?.value?.trim() ?? '';
            const unit = tr.querySelector('.biochem-unit')?.value?.trim() ?? '';
            const flag = tr.querySelector('.status')?.innerText.trim() ?? '';
            const ref = tr.querySelector('.biochem-ref')?.value?.trim() ?? '';
            if (test) list.push({ category, test, sample, val, unit, flag, ref });
        });
        return list;
    }

    function collectUrineData() {
        const rows = document.querySelectorAll('#tbodyUrine tr');
        const list = [];
        const valuesMap = {};
        rows.forEach(tr => {
            const id = tr.dataset.id;
            const test = tr.cells[0]?.innerText.trim();
            const valIn = tr.querySelector('.urine-val');
            const refIn = tr.querySelector('.urine-ref');
            const val = valIn?.value?.trim() ?? '';
            const ref = refIn?.value?.trim() ?? '';
            if (id) {
                valuesMap[id] = val;
                if (refIn && refIn.id) valuesMap[refIn.id] = ref;
            }
            list.push({ id, test, val, ref, isStool: !refIn });
        });
        return { list, valuesMap };
    }

    function collectOtherData() {
        const rows = document.querySelectorAll('#tbodyOther tr');
        const list = [];
        rows.forEach((tr, rIdx) => {
            const rowObj = {};
            currentOtherColumns.forEach(col => {
                if (col.type === 'flag') {
                    rowObj[col.key] = tr.querySelector('.status')?.innerText?.trim() || '';
                } else {
                    const inEl = tr.querySelector(`input[data-col-key="${col.key}"]`);
                    rowObj[col.key] = inEl ? inEl.value.trim() : (currentOtherRows[rIdx]?.[col.key] || '');
                }
            });

            const testCol = currentOtherColumns.find(c => c.type === 'test');
            const resCol = currentOtherColumns.find(c => c.type === 'result');
            const unitCol = currentOtherColumns.find(c => c.type === 'unit');
            const refCol = currentOtherColumns.find(c => c.type === 'ref');
            rowObj.test = testCol ? (rowObj[testCol.key] || '') : (rowObj[currentOtherColumns[0]?.key] || '');
            rowObj.val = resCol ? (rowObj[resCol.key] || '') : (rowObj[currentOtherColumns[1]?.key] || '');
            rowObj.result = rowObj.val;
            rowObj.unit = unitCol ? (rowObj[unitCol.key] || '') : '';
            rowObj.ref = refCol ? (rowObj[refCol.key] || '') : '';

            const hasData = Object.values(rowObj).some(v => v !== '');
            if (hasData) list.push(rowObj);
        });

        return {
            columns: currentOtherColumns,
            items: list
        };
    }

    // =====================================================
    // 5. SAVE ALL & SYNC BACK TO INDIVIDUAL FORMS
    // =====================================================
    async function saveAllData() {
        if (isReadOnlyMode) return;

        const btnSaveAll = document.getElementById('btnSaveAll');
        const origBtnHtml = btnSaveAll ? btnSaveAll.innerHTML : '';
        if (btnSaveAll) {
            btnSaveAll.disabled = true;
            btnSaveAll.innerHTML = '<span class="spinner-border spinner-border-sm me-1" style="width:14px;height:14px;border-width:2px;display:inline-block;border:2px solid #fff;border-right-color:transparent;border-radius:50%;animation:spin 0.7s linear infinite;" role="status"></span> ກຳລັງບັນທຶກ...';
        }

        const cbcData = collectCbcData();
        const biochemData = collectBiochemData();
        const { list: urineList, valuesMap: urineValues } = collectUrineData();
        const otherData = collectOtherData();
        const bloodGroup = document.getElementById('bloodGroupInput')?.value?.trim() || '';
        let comment = '';
        const adviceEl = document.getElementById('doctorAdviceDisplay');
        if (adviceEl && adviceEl.innerText.trim()) {
            comment = adviceEl.innerText.trim();
        } else {
            comment = document.getElementById('doctorComment')?.value?.trim() || '';
        }

        const visibleSections = {
            cbc: !document.getElementById('secCbc')?.classList.contains('hidden'),
            biochem: !document.getElementById('secBiochem')?.classList.contains('hidden'),
            urine: !document.getElementById('secUrine')?.classList.contains('hidden'),
            other: !document.getElementById('secOther')?.classList.contains('hidden')
        };

        const combinedPayload = {
            visitId,
            hn,
            patientName,
            updatedAt: new Date().toISOString(),
            visibleSections,
            bloodGroup,
            comment,
            cbc: cbcData,
            biochem: biochemData,
            urine: urineList,
            other: otherData
        };

        try {
            // 1. ບັນທຶກ Combined Lab ລົງ LocalStorage
            let allComb = {};
            try { allComb = JSON.parse(localStorage.getItem('clinic_combined_lab_results') || '{}'); } catch (e) { }
            allComb[visitId] = combinedPayload;
            allComb[String(visitId).replace('VIS-', '')] = combinedPayload;
            localStorage.setItem('clinic_combined_lab_results', JSON.stringify(allComb));

            // =========================================================
            // 2. SYNC BACK TO INDIVIDUAL DATA STORES (ເຊື່ອມທຸກຟອມໃຫ້ກົງກັນ)
            // =========================================================

            // 2.1 Sync CBC
            if (visibleSections.cbc) {
                try {
                    let allCbc = JSON.parse(localStorage.getItem('clinic_cbc_results') || '{}');
                    allCbc[visitId] = {
                        visit_id: visitId,
                        hn,
                        patient_name: patientName,
                        updated_at: new Date().toISOString(),
                        items: cbcData
                    };
                    localStorage.setItem('clinic_cbc_results', JSON.stringify(allCbc));
                } catch (e) { }
            }

            // 2.2 Sync Biochem
            if (visibleSections.biochem) {
                try {
                    const bioPayload = { visitId, hn, patientName, savedAt: new Date().toISOString(), items: biochemData };
                    localStorage.setItem('stk-biochem-report:' + visitId, JSON.stringify(bioPayload));
                    let allBio = JSON.parse(localStorage.getItem('clinic_biochem_results') || '{}');
                    allBio[visitId] = bioPayload;
                    allBio[String(visitId).replace('VIS-', '')] = bioPayload;
                    localStorage.setItem('clinic_biochem_results', JSON.stringify(allBio));
                } catch (e) { }
            }

            // 2.3 Sync Urine
            if (visibleSections.urine) {
                try {
                    localStorage.setItem('stk-urine-report:' + visitId, JSON.stringify({
                        values: urineValues,
                        visitId,
                        hn,
                        patientName,
                        savedAt: new Date().toISOString()
                    }));
                } catch (e) { }
            }

            // 2.4 Sync Other Lab (ບັນທຶກທັງ columns ແລະ items)
            if (visibleSections.other) {
                try {
                    localStorage.setItem(`clinic_other_lab_${visitId}`, JSON.stringify({
                        visitId,
                        hn,
                        patientName,
                        savedAt: new Date().toISOString(),
                        columns: otherData.columns,
                        items: otherData.items
                    }));
                } catch (e) { }
            }

            // 2.5 ເພີ່ມໄຟລ໌ Combined Lab ໃນ clinic_lab_files_meta
            if (visitId) {
                let metaMap = {};
                try { metaMap = JSON.parse(localStorage.getItem('clinic_lab_files_meta') || '{}'); } catch (e) { }
                let visitMetaList = Array.isArray(metaMap[visitId]) ? metaMap[visitId] : [];
                visitMetaList = visitMetaList.filter(f => f && f.category !== 'Combined Lab' && f.category !== 'ຜົນກວດລວມ');
                visitMetaList.push({
                    id: `FILE-COMBINED-${visitId}`,
                    visitId: visitId,
                    fileName: `Combined_Lab_Report_${visitId}.pdf`,
                    fileType: 'application/pdf',
                    category: 'Combined Lab',
                    updatedAt: new Date().toISOString()
                });
                metaMap[visitId] = visitMetaList;
                localStorage.setItem('clinic_lab_files_meta', JSON.stringify(metaMap));
            }

            // =========================================================
            // 3. SYNC TO CLOUD SUPABASE visits table
            // =========================================================
            if (sup && visitId) {
                try {
                    const { data: exVisit } = await sup.from('visits').select('pdf_url, lab_note').eq('visit_id', visitId).maybeSingle();

                    let newLabNote = exVisit ? (exVisit.lab_note || '') : '';

                    const combTag = `[ผลตรวจ Combined Lab]\n${JSON.stringify(combinedPayload)}\n[/ผลตรวจ Combined Lab]`;
                    if (newLabNote.includes('[ผลตรวจ Combined Lab]')) {
                        newLabNote = newLabNote.replace(/\[ผลตรวจ Combined Lab\][\s\S]*?\[\/ผลตรวจ Combined Lab\]/, combTag);
                    } else {
                        newLabNote = newLabNote ? `${newLabNote}\n\n${combTag}` : combTag;
                    }

                    if (visibleSections.cbc) {
                        const cbcTag = `[ผลตรวจ CBC]\n${JSON.stringify({ updated_at: new Date().toISOString(), items: cbcData })}\n[/ผลตรวจ CBC]`;
                        if (newLabNote.includes('[ผลตรวจ CBC]')) newLabNote = newLabNote.replace(/\[ผลตรวจ CBC\][\s\S]*?\[\/ผลตรวจ CBC\]/, cbcTag);
                        else newLabNote = `${newLabNote}\n\n${cbcTag}`;
                    }
                    if (visibleSections.biochem) {
                        const bioTag = `[ผลตรวจ Biochem]\n${JSON.stringify(biochemData)}\n[/ผลตรวจ Biochem]`;
                        if (newLabNote.includes('[ผลตรวจ Biochem]')) newLabNote = newLabNote.replace(/\[ผลตรวจ Biochem\][\s\S]*?\[\/ผลตรวจ Biochem\]/, bioTag);
                        else newLabNote = `${newLabNote}\n\n${bioTag}`;
                    }
                    if (visibleSections.urine) {
                        const urineTag = `[ผลตรวจ Urine]\n${JSON.stringify(urineValues)}\n[/ผลตรวจ Urine]`;
                        if (newLabNote.includes('[ผลตรวจ Urine]')) newLabNote = newLabNote.replace(/\[ผลตรวจ Urine\][\s\S]*?\[\/ผลตรวจ Urine\]/, urineTag);
                        else newLabNote = `${newLabNote}\n\n${urineTag}`;
                    }
                    if (visibleSections.other) {
                        const otherTag = `[ผลตรวจ Other Lab]\n${JSON.stringify({ columns: otherData.columns, items: otherData.items })}\n[/ผลตรวจ Other Lab]`;
                        if (newLabNote.includes('[ผลตรวจ Other Lab]')) newLabNote = newLabNote.replace(/\[ผลตรวจ Other Lab\][\s\S]*?\[\/ผลตรวจ Other Lab\]/, otherTag);
                        else newLabNote = `${newLabNote}\n\n${otherTag}`;
                    }

                    let currentPdfFiles = [];
                    if (exVisit && exVisit.pdf_url) {
                        const rawPdf = String(exVisit.pdf_url).trim();
                        if (rawPdf.startsWith('[')) {
                            try {
                                const parsed = JSON.parse(rawPdf);
                                if (Array.isArray(parsed)) currentPdfFiles = parsed;
                            } catch (e) { }
                        }
                    }
                    currentPdfFiles = currentPdfFiles.filter(f => f && f.category !== 'Combined Lab' && f.category !== 'ຜົນກວດລວມ');
                    currentPdfFiles.push({
                        id: `FILE-COMBINED-${visitId}`,
                        visitId: visitId,
                        fileName: `Combined_Lab_Report_${visitId}.pdf`,
                        fileType: 'application/pdf',
                        category: 'Combined Lab',
                        url: `combinedlab:${visitId}`,
                        publicUrl: `combinedlab:${visitId}`,
                        updatedAt: new Date().toISOString()
                    });

                    await sup.from('visits').update({
                        lab_note: newLabNote,
                        pdf_url: JSON.stringify(currentPdfFiles)
                    }).eq('visit_id', visitId);

                } catch (dbErr) {
                    console.warn('Sync to Supabase warning:', dbErr);
                }
            }

            if (window.opener) {
                try {
                    if (typeof window.opener.loadLabQueue === 'function') window.opener.loadLabQueue();
                    if (typeof window.opener.renderLabTable === 'function') window.opener.renderLabTable();
                    if (typeof window.opener.renderExistingLabFilesList === 'function') window.opener.renderExistingLabFilesList(visitId);
                } catch (e) { }
            }
            if (window.parent && window.parent !== window) {
                try {
                    if (typeof window.parent.loadLabQueue === 'function') window.parent.loadLabQueue();
                    if (typeof window.parent.renderLabTable === 'function') window.parent.renderLabTable();
                    if (typeof window.parent.renderExistingLabFilesList === 'function') window.parent.renderExistingLabFilesList(visitId);
                } catch (e) { }
            }

            // 4. ສ້າງ Badge ສະແດງໝວດທີ່ຖືກບັນທຶກ
            const savedSecBadges = [];
            if (visibleSections.cbc) savedSecBadges.push('<span style="background:#fee2e2;color:#b91c1c;padding:5px 12px;border-radius:8px;font-weight:700;font-size:12px;border:1px solid #fca5a5;display:inline-flex;align-items:center;gap:5px;"><i class="bi bi-droplet-fill"></i> Complete Blood Count (CBC)</span>');
            if (visibleSections.biochem) savedSecBadges.push('<span style="background:#e0f2fe;color:#0369a1;padding:5px 12px;border-radius:8px;font-weight:700;font-size:12px;border:1px solid #7dd3fc;display:inline-flex;align-items:center;gap:5px;"><i class="bi bi-activity"></i> Biochemistry</span>');
            if (visibleSections.urine) savedSecBadges.push('<span style="background:#fef3c7;color:#b45309;padding:5px 12px;border-radius:8px;font-weight:700;font-size:12px;border:1px solid #fcd34d;display:inline-flex;align-items:center;gap:5px;"><i class="bi bi-eyedropper"></i> Urinalysis</span>');
            if (visibleSections.other) savedSecBadges.push('<span style="background:#dcfce7;color:#15803d;padding:5px 12px;border-radius:8px;font-weight:700;font-size:12px;border:1px solid #86efac;display:inline-flex;align-items:center;gap:5px;"><i class="bi bi-journal-medical"></i> Other Lab</span>');

            const nowTimeStr = new Date().toLocaleTimeString('lo-LA', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

            if (typeof Swal !== 'undefined') {
                const swalRes = await Swal.fire({
                    icon: 'success',
                    title: 'ບັນທຶກຜົນກວດສຳເລັດ!',
                    html: `
                        <div style="text-align: left; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 14px; padding: 14px 18px; margin: 6px 0 14px 0;">
                            <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 10px; border-bottom: 1px dashed #cbd5e1; padding-bottom: 8px;">
                                <div>
                                    <span style="font-size: 11px; color: #64748b; font-weight: 600; text-transform: uppercase;">ລະຫັດ Visit</span>
                                    <div style="font-size: 14px; font-weight: 800; color: #2563eb;">${escapeHtml(visitId || '-')}</div>
                                </div>
                                <div style="text-align: right;">
                                    <span style="font-size: 11px; color: #64748b; font-weight: 600; text-transform: uppercase;">HN</span>
                                    <div style="font-size: 14px; font-weight: 800; color: #0b3c73;">${escapeHtml(hn || '-')}</div>
                                </div>
                            </div>
                            <div style="margin-bottom: 8px;">
                                <span style="font-size: 11.5px; color: #64748b; font-weight: 600;">ຊື່ຄົນເຈັບ:</span>
                                <strong style="font-size: 13.5px; color: #0f172a; margin-left: 4px;">${escapeHtml(patientName || '-')}</strong>
                                ${bloodGroup ? `<span style="margin-left: 8px; background: #fee2e2; color: #dc2626; font-size: 11px; font-weight: 800; padding: 2px 8px; border-radius: 6px;">🩸 ${escapeHtml(bloodGroup)}</span>` : ''}
                            </div>
                            <div style="font-size: 11.5px; color: #16a34a; font-weight: 700; display: flex; align-items: center; gap: 6px;">
                                <i class="bi bi-cloud-check-fill" style="font-size: 15px;"></i>
                                ຊິງຄ໌ຂໍ້ມູນລົງ Cloud & ຖານຂໍ້ມູນຄລີນິກຄົບຖ້ວນ (${nowTimeStr})
                            </div>
                        </div>
                        <div style="text-align: left; margin-bottom: 8px;">
                            <span style="font-size: 12px; font-weight: 700; color: #475569;"><i class="bi bi-check2-all text-primary me-1"></i> ໝວດຜົນກວດທີ່ຖືກບັນທຶກ:</span>
                        </div>
                        <div style="display: flex; flex-wrap: wrap; gap: 8px; justify-content: flex-start;">
                            ${savedSecBadges.join('')}
                        </div>
                    `,
                    customClass: {
                        popup: 'premium-swal'
                    },
                    showConfirmButton: true,
                    confirmButtonText: '<i class="bi bi-check-lg me-1"></i> ຕົກລົງ (OK)',
                    showDenyButton: true,
                    denyButtonText: '<i class="bi bi-printer-fill me-1"></i> ພິມໃບລາຍງານ (Print)',
                    denyButtonColor: '#f8fafc',
                    timer: 4500,
                    timerProgressBar: true
                });

                if (swalRes.isDenied) {
                    window.print();
                }
            } else {
                showToast('✅ ບັນທຶກຜົນກວດລວມ ແລະ ຊິງຄ໌ຂໍ້ມູນທຸກໝວດສຳເລັດແລ້ວ');
            }
            return true;

        } catch (err) {
            console.error('Save error:', err);
            if (typeof Swal !== 'undefined') {
                Swal.fire({
                    icon: 'error',
                    title: 'ເກີດຂໍ້ຜິດພາດໃນການບັນທຶກ!',
                    text: 'ກະລຸນາກວດສອບການເຊື່ອມຕໍ່ ຫຼື ລອງໃໝ່ອີກຄັ້ງ: ' + (err.message || err),
                    confirmButtonText: 'ຕົກລົງ',
                    confirmButtonColor: '#ef4444',
                    customClass: { popup: 'premium-swal' }
                });
            } else {
                showToast('❌ ເກີດຂໍ້ຜິດພາດໃນການບັນທຶກ');
            }
            return false;
        } finally {
            if (btnSaveAll) {
                btnSaveAll.disabled = false;
                btnSaveAll.innerHTML = origBtnHtml;
            }
        }
    }

    // =====================================================
    // 6. TOGGLE SECTION VISIBILITY
    // =====================================================
    function toggleSection(secName, forceState) {
        const secMap = {
            cbc: { secEl: document.getElementById('secCbc'), btnEl: document.getElementById('toggleCbc') },
            biochem: { secEl: document.getElementById('secBiochem'), btnEl: document.getElementById('toggleBiochem') },
            urine: { secEl: document.getElementById('secUrine'), btnEl: document.getElementById('toggleUrine') },
            other: { secEl: document.getElementById('secOther'), btnEl: document.getElementById('toggleOther') }
        };

        const target = secMap[secName];
        if (!target || !target.secEl) return;

        let newState = (forceState !== undefined) ? forceState : target.secEl.classList.contains('hidden');

        if (newState) {
            target.secEl.classList.remove('hidden');
            if (target.btnEl) target.btnEl.classList.add('active');
        } else {
            target.secEl.classList.add('hidden');
            if (target.btnEl) target.btnEl.classList.remove('active');
        }
    }

    // =====================================================
    // 7. EVENT LISTENERS & INITIALIZATION
    // =====================================================
    document.addEventListener('DOMContentLoaded', async () => {

        // ก. ปุ่ม Toggle Sections
        ['cbc', 'biochem', 'urine', 'other'].forEach(sec => {
            const btn = document.getElementById(`toggle${sec.charAt(0).toUpperCase() + sec.slice(1)}`);
            if (btn) {
                btn.addEventListener('click', () => toggleSection(sec));
            }
        });

        // ข. ปุ่มลบ Section จากหัวข้อหมวด
        document.querySelectorAll('.btn-remove-sec').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const targetSec = e.currentTarget.dataset.target;
                if (targetSec) toggleSection(targetSec, false);
            });
        });

        // ค. ปุ่มเพิ่มแถวใน Biochem
        document.querySelectorAll('.btn-add-row').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const target = e.currentTarget.dataset.target;
                if (target === 'biochem') {
                    const tbody = document.getElementById('tbodyBiochem');
                    if (tbody) {
                        const tr = document.createElement('tr');
                        tr.innerHTML = `
                            <td><input type="text" class="biochem-test-custom" placeholder="ຊື່ລາຍການກວດ..." style="font-weight:700;"></td>
                            <td style="text-align:center;"><span class="badge bg-light text-secondary border" style="font-size:10px;">SER</span></td>
                            <td><input type="text" class="result-input biochem-val" placeholder="ຜົນກວດ..." data-key="val"></td>
                            <td><input type="text" class="biochem-unit" placeholder="ໜ່ວຍ..." style="width:70px;"></td>
                            <td style="text-align:center;"><span class="status flag-normal">-</span></td>
                            <td><input type="text" class="biochem-ref" placeholder="ຄ່າອ້າງອີງ..." data-key="ref"></td>
                            <td style="text-align:center;" class="no-print">
                                <button type="button" class="btn-remove-row" title="ລຶບແຖວນີ້" onclick="this.closest('tr').remove()"><i class="bi bi-trash"></i></button>
                            </td>
                        `;
                        const valIn = tr.querySelector('input[data-key="val"]');
                        const refIn = tr.querySelector('input[data-key="ref"]');
                        const flagSpan = tr.querySelector('.status');
                        valIn.addEventListener('input', () => {
                            const newFl = computeBiochemFlag(valIn.value, refIn.value);
                            flagSpan.className = `status ${newFl.cls}`;
                            flagSpan.innerText = newFl.text;
                        });
                        tbody.appendChild(tr);
                    }
                }
            });
        });

        // ง. ปุ่มจัดการ Dynamic Columns ใน Other Lab
        const btnAddColOther = document.getElementById('btnAddColOther');
        if (btnAddColOther) {
            btnAddColOther.addEventListener('click', async () => {
                let colName = '';
                if (typeof Swal !== 'undefined') {
                    const { value: text } = await Swal.fire({
                        title: 'ເພີ່ມ Column ໃໝ່',
                        input: 'text',
                        inputLabel: 'ກະລຸນາປ້ອນຊື່ Column:',
                        inputPlaceholder: 'ຕົວຢ່າງ: Method, Date, Batch No, Note...',
                        showCancelButton: true,
                        confirmButtonText: '<i class="bi bi-plus-lg me-1"></i> ເພີ່ມ',
                        cancelButtonText: 'ຍົກເລີກ',
                        confirmButtonColor: '#0b3c73',
                        inputValidator: (val) => {
                            if (!val || !val.trim()) return 'ກະລຸນາປ້ອນຊື່ Column!';
                        }
                    });
                    colName = text ? text.trim() : '';
                } else {
                    colName = prompt('ປ້ອນຊື່ Column ໃໝ່:');
                }

                if (colName) {
                    const newKey = 'col_' + Date.now();
                    currentOtherColumns.push({
                        key: newKey,
                        label: colName,
                        type: 'text'
                    });
                    currentOtherRows.forEach(r => {
                        if (r[newKey] === undefined) r[newKey] = '';
                    });
                    renderOtherHeaders();
                    renderOtherTable();
                    showToast(`ເພີ່ມ Column "${colName}" ແລ້ວ`);
                }
            });
        }

        const btnResetColsOther = document.getElementById('btnResetColsOther');
        if (btnResetColsOther) {
            btnResetColsOther.addEventListener('click', async () => {
                let confirmed = false;
                if (typeof Swal !== 'undefined') {
                    const res = await Swal.fire({
                        title: 'ຄືນຄ່າຖັນມາດຕະຖານ?',
                        text: 'ທ່ານແນ່ໃຈບໍ່ວ່າຕ້ອງການຄືນຄ່າ Column ມາດຕະຖານ (5 ຖັນເດີມ)?',
                        icon: 'question',
                        showCancelButton: true,
                        confirmButtonColor: '#0b3c73',
                        cancelButtonColor: '#64748b',
                        confirmButtonText: 'ຄືນຄ່າມາດຕະຖານ',
                        cancelButtonText: 'ຍົກເລີກ',
                        reverseButtons: true
                    });
                    confirmed = res.isConfirmed;
                } else {
                    confirmed = confirm('ທ່ານແນ່ໃຈບໍ່ວ່າຕ້ອງການຄືນຄ່າ Column ມາດຕະຖານ?');
                }

                if (confirmed) {
                    currentOtherColumns = JSON.parse(JSON.stringify(DEFAULT_OTHER_COLUMNS));
                    renderOtherHeaders();
                    renderOtherTable();
                    showToast('ຄືນຄ່າ Column ມາດຕະຖານແລ້ວ');
                }
            });
        }

        const btnAddRowOther = document.getElementById('btnAddRowOther');
        if (btnAddRowOther) {
            btnAddRowOther.addEventListener('click', () => {
                const newRow = {};
                currentOtherColumns.forEach(c => { newRow[c.key] = ''; });
                currentOtherRows.push(newRow);
                renderOtherTable();
            });
        }

        // จ. ปุ่ม Toolbar หลัก
        const btnSaveAll = document.getElementById('btnSaveAll');
        if (btnSaveAll) {
            btnSaveAll.addEventListener('click', saveAllData);
        }

        async function downloadReportAsPdf() {
            const paper = document.querySelector('.paper');
            if (!paper) return;

            if (typeof html2pdf === 'undefined') {
                window.print();
                return;
            }

            if (typeof Swal !== 'undefined') {
                Swal.fire({
                    title: 'ກຳລັງສ້າງໄຟລ໌ PDF...',
                    text: 'ກະລຸນາລໍຖ້າຈັກໜ່ອຍ, ລະບົບກຳລັງປະມວນຜົນໃບລາຍງານຜົນກວດ...',
                    allowOutsideClick: false,
                    didOpen: () => { Swal.showLoading(); }
                });
            }

            const safeVisit = (visitId || 'VIS').replace(/[^a-zA-Z0-9_-]/g, '_');
            const safeHn = (hn || 'HN').replace(/[^a-zA-Z0-9_-]/g, '_');
            const opt = {
                margin: [6, 6, 6, 6],
                filename: `Lab_Report_${safeHn}_${safeVisit}.pdf`,
                image: { type: 'jpeg', quality: 0.98 },
                html2canvas: { scale: 2, useCORS: true, logging: false },
                jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
            };

            try {
                await html2pdf().set(opt).from(paper).save();
                if (typeof Swal !== 'undefined') {
                    Swal.fire({
                        icon: 'success',
                        title: 'ດາວໂຫຼດ PDF ສຳເລັດ!',
                        text: `ບັນທຶກໄຟລ໌ Lab_Report_${safeHn}_${safeVisit}.pdf ຮຽບຮ້ອຍແລ້ວ`,
                        timer: 2000,
                        showConfirmButton: false
                    });
                }
            } catch (err) {
                console.error('PDF export error:', err);
                window.print();
            }
        }
        window.downloadReportAsPdf = downloadReportAsPdf;

        const btnDownloadPdf = document.getElementById('btnDownloadPdf');
        if (btnDownloadPdf) {
            btnDownloadPdf.addEventListener('click', downloadReportAsPdf);
        }

        const btnDownloadTop = document.getElementById('btnDownloadTop');
        if (btnDownloadTop) {
            btnDownloadTop.addEventListener('click', downloadReportAsPdf);
        }

        const btnPrintTop = document.getElementById('btnPrintTop');
        if (btnPrintTop) {
            btnPrintTop.addEventListener('click', () => {
                window.print();
            });
        }

        const btnPrintAll = document.getElementById('btnPrintAll');
        if (btnPrintAll) {
            btnPrintAll.addEventListener('click', () => {
                window.print();
            });
        }

        const btnClearAll = document.getElementById('btnClearAll');
        if (btnClearAll) {
            btnClearAll.addEventListener('click', async () => {
                let confirmed = false;
                if (typeof Swal !== 'undefined') {
                    const res = await Swal.fire({
                        title: 'ລ້າງຄ່າຜົນກວດທັງໝົດ?',
                        html: '<div style="font-size: 13.5px; color: #475569; margin-top: 6px;">ທ່ານຕ້ອງການລ້າງຄ່າຜົນກວດທຸກລາຍການໃນແບບຟອມນີ້ແທ້ບໍ?<br><span style="color: #ef4444; font-size: 12px; font-weight: 600;">(ຂໍ້ມູນທີ່ພິມໄວ້ທັງໝົດຈະຖືກລຶບອອກ)</span></div>',
                        icon: 'warning',
                        iconColor: '#f59e0b',
                        showCancelButton: true,
                        confirmButtonColor: '#ef4444',
                        cancelButtonColor: '#64748b',
                        confirmButtonText: '<i class="bi bi-eraser-fill me-1"></i> ລ້າງຄ່າຜົນກວດ',
                        cancelButtonText: 'ຍົກເລີກ',
                        reverseButtons: true,
                        focusCancel: true
                    });
                    confirmed = res.isConfirmed;
                } else {
                    confirmed = confirm('ທ່ານຕ້ອງການລ້າງຄ່າຜົນກວດທັງໝົດແທ້ບໍ?');
                }

                if (confirmed) {
                    document.querySelectorAll('.cbc-val, .biochem-val, .urine-val, .other-cell-input').forEach(input => {
                        input.value = '';
                    });
                    document.querySelectorAll('.status').forEach(s => {
                        s.className = 'status empty';
                        s.innerText = '-';
                    });
                    updateCbcHistograms();
                    if (typeof Swal !== 'undefined') {
                        Swal.fire({
                            icon: 'success',
                            iconColor: '#10b981',
                            title: 'ລ້າງຂໍ້ມູນສຳເລັດ!',
                            text: 'ຂໍ້ມູນຜົນກວດທຸກລາຍການຖືກລ້າງຮຽບຮ້ອຍແລ້ວ',
                            timer: 1500,
                            showConfirmButton: false
                        });
                    } else {
                        showToast('ລ້າງຄ່າຜົນກວດຮຽບຮ້ອຍແລ້ວ');
                    }
                }
            });
        }

        const btnClose = document.getElementById('btnClosePage');
        if (btnClose) {
            btnClose.addEventListener('click', () => {
                try {
                    if (window.parent && window.parent !== window) {
                        const modal = window.parent.document.querySelector('.modal.show');
                        if (modal) {
                            try {
                                const bModal = window.parent.bootstrap.Modal.getInstance(modal);
                                if (bModal) bModal.hide();
                            } catch (e) { modal.style.display = 'none'; }
                        }
                    }
                } catch (pe) { }
                window.close();
            });
        }

        // ---------------------------------------------------------
        // ລະບົບ ເປີດ/ປິດ ຕາປະທັບ (Toggle Official Clinic Stamp)
        // ---------------------------------------------------------
        const btnToggleStamp = document.getElementById('btnToggleStamp');
        const stampBoxInteractive = document.getElementById('stampBoxInteractive');
        const stampToggleIcon = document.getElementById('stampToggleIcon');
        const stampToggleText = document.getElementById('stampToggleText');

        // ອ່ານຄ່າຈາກ localStorage (ຄ່າເລີ່ມຕົ້ນ: true = ປະທັບຕາ)
        let isStampEnabled = localStorage.getItem('clinic_show_lab_stamp') !== '0';

        function updateStampUI(showToastMsg = false) {
            if (isStampEnabled) {
                document.body.classList.remove('hide-stamp');
                if (btnToggleStamp) {
                    btnToggleStamp.classList.remove('is-disabled');
                    btnToggleStamp.title = 'ຄລິກເພື່ອປິດ ຕາປະທັບ';
                }
                if (stampToggleIcon) stampToggleIcon.className = 'bi bi-patch-check-fill me-1';
                if (stampToggleText) stampToggleText.innerText = 'ປະທັບຕາ (Stamp: ON)';
                if (showToastMsg) showToast('ເປີດສະແດງຕາປະທັບ (Stamp: ON)');
            } else {
                document.body.classList.add('hide-stamp');
                if (btnToggleStamp) {
                    btnToggleStamp.classList.add('is-disabled');
                    btnToggleStamp.title = 'ຄລິກເພື່ອເປີດ ຕາປະທັບ';
                }
                if (stampToggleIcon) stampToggleIcon.className = 'bi bi-dash-circle me-1';
                if (stampToggleText) stampToggleText.innerText = 'ບໍ່ປະທັບຕາ (Stamp: OFF)';
                if (showToastMsg) showToast('ປິດການສະແດງຕາປະທັບ (Stamp: OFF)');
            }
            try {
                localStorage.setItem('clinic_show_lab_stamp', isStampEnabled ? '1' : '0');
            } catch (e) {}
        }

        updateStampUI(false);

        if (btnToggleStamp) {
            btnToggleStamp.addEventListener('click', () => {
                isStampEnabled = !isStampEnabled;
                updateStampUI(true);
            });
        }

        if (stampBoxInteractive) {
            stampBoxInteractive.addEventListener('click', () => {
                isStampEnabled = !isStampEnabled;
                updateStampUI(true);
            });
        }

        // ປຸ່ມບັນທຶກຄ່າອ້າງອີງມາດຕະຖານ (Save Reference Ranges as Clinic Default - Icon Only)
        const btnSaveRefRanges = document.getElementById('btnSaveRefRanges');
        if (btnSaveRefRanges) {
            btnSaveRefRanges.addEventListener('click', saveCurrentRangesAsStandard);
        }

        // ໂຫຼດການຕັ້ງຄ່າຄລີນິກ (Logo, Stamp, ຊື່, ທີ່ຢູ່, ເບີໂທ, ຄ່າອ້າງອີງມາດຕະຖານ)
        try {
            await loadClinicSettings();
        } catch (e) {
            console.warn('loadClinicSettings error:', e);
        }

        // ໂຫຼດຂໍ້ມູນທັງໝົດ
        await loadAllLabData();

        // ເປີດໃຊ້ງານລະບົບປຸ່ມລູກສອນ Up / Down / Left / Right / Enter ເລື່ອນຊ່ອງຕາຕະລາງ
        initTableKeyboardNavigation();
    });

    // ---------------------------------------------------------
    // ລະບົບ Keyboard Navigation (Up, Down, Left, Right, Enter)
    // ຮອງຮັບການເລື່ອນຊ່ອງພິມໃນຕາຕະລາງ CBC, Biochem, Urinalysis, Other Lab
    // ---------------------------------------------------------
    function findMatchingInputInRow(targetTr, currentInput, colIndex) {
        if (!targetTr) return null;
        const targetInputs = Array.from(targetTr.querySelectorAll('input:not([disabled]):not([readonly]), select:not([disabled]):not([readonly])'));
        if (targetInputs.length === 0) return null;

        // 1. ກວດຕາມ data-key (ເຊັ່ນ: val, min, max, unit, ref)
        const dataKey = currentInput.getAttribute('data-key');
        if (dataKey) {
            const m = targetTr.querySelector(`[data-key="${dataKey}"]:not([disabled]):not([readonly])`);
            if (m) return m;
        }

        // 2. ກວດຕາມ data-col (ສຳລັບຕາຕະລາງ Other Lab ທີ່ມີ dynamic columns)
        const dataCol = currentInput.getAttribute('data-col');
        if (dataCol) {
            const m = targetTr.querySelector(`[data-col="${dataCol}"]:not([disabled]):not([readonly])`);
            if (m) return m;
        }

        // 3. ກວດຕາມ class ຫຼັກ (ເຊັ່ນ: cbc-val, biochem-val, urine-val, other-cell-input)
        if (currentInput.classList) {
            for (const cls of ['cbc-val', 'cbc-min', 'cbc-max', 'biochem-val', 'biochem-unit', 'biochem-ref', 'urine-val', 'urine-ref', 'other-cell-input', 'result-input', 'value-input']) {
                if (currentInput.classList.contains(cls)) {
                    const m = targetTr.querySelector(`.${cls}:not([disabled]):not([readonly])`);
                    if (m) return m;
                }
            }
        }

        // 4. ຖ້າບໍ່ຕົງກັນ ໃຫ້ເລືອກຕາມ index ຂອງ column
        if (colIndex >= 0 && colIndex < targetInputs.length) {
            return targetInputs[colIndex];
        }
        return targetInputs[Math.min(colIndex, targetInputs.length - 1)];
    }

    function initTableKeyboardNavigation(root = document) {
        root.addEventListener('keydown', function (e) {
            const isUp = (e.key === 'ArrowUp') || (e.key === 'Enter' && e.shiftKey);
            const isDown = (e.key === 'ArrowDown') || (e.key === 'Enter' && !e.shiftKey);
            const isLeft = (e.key === 'ArrowLeft');
            const isRight = (e.key === 'ArrowRight');

            if (!isUp && !isDown && !isLeft && !isRight) return;

            const el = e.target;
            if (!el || (el.tagName !== 'INPUT' && el.tagName !== 'SELECT')) return;
            if (el.readOnly || el.disabled || el.type === 'button' || el.type === 'submit' || el.type === 'checkbox' || el.type === 'radio') return;

            const tr = el.closest('tr');
            if (!tr) return;

            const table = tr.closest('table') || tr.closest('tbody');
            if (!table) return;

            // ກັ່ນຕອງເອົາສະເພາະແຖວທີ່ມີ input ທີ່ສາມາດພິມໄດ້ (ຂ້າມແຖວຫົວຂໍ້ sectionrow ຫຼື thead)
            const rows = Array.from(table.querySelectorAll('tr')).filter(r => {
                if (r.closest('thead')) return false;
                return r.querySelector('input:not([disabled]):not([readonly]), select:not([disabled]):not([readonly])');
            });
            const rowIndex = rows.indexOf(tr);
            if (rowIndex === -1) return;

            const currentInputs = Array.from(tr.querySelectorAll('input:not([disabled]):not([readonly]), select:not([disabled]):not([readonly])'));
            const colIndex = currentInputs.indexOf(el);
            if (colIndex === -1) return;

            let targetEl = null;

            if (isDown) {
                if (rowIndex < rows.length - 1) {
                    const nextTr = rows[rowIndex + 1];
                    targetEl = findMatchingInputInRow(nextTr, el, colIndex);
                }
            } else if (isUp) {
                if (rowIndex > 0) {
                    const prevTr = rows[rowIndex - 1];
                    targetEl = findMatchingInputInRow(prevTr, el, colIndex);
                }
            } else if (isLeft) {
                const val = el.value || '';
                const isAtStart = (el.selectionStart === 0 && el.selectionEnd === 0);
                const isAllSelected = (el.selectionStart === 0 && el.selectionEnd === val.length);
                if (!isAtStart && !isAllSelected) return;

                if (colIndex > 0) {
                    targetEl = currentInputs[colIndex - 1];
                } else if (rowIndex > 0) {
                    const prevTr = rows[rowIndex - 1];
                    const prevInputs = Array.from(prevTr.querySelectorAll('input:not([disabled]):not([readonly]), select:not([disabled]):not([readonly])'));
                    if (prevInputs.length > 0) targetEl = prevInputs[prevInputs.length - 1];
                }
            } else if (isRight) {
                const val = el.value || '';
                const isAtEnd = (el.selectionStart === val.length && el.selectionEnd === val.length);
                const isAllSelected = (el.selectionStart === 0 && el.selectionEnd === val.length);
                if (!isAtEnd && !isAllSelected) return;

                if (colIndex < currentInputs.length - 1) {
                    targetEl = currentInputs[colIndex + 1];
                } else if (rowIndex < rows.length - 1) {
                    const nextTr = rows[rowIndex + 1];
                    const nextInputs = Array.from(nextTr.querySelectorAll('input:not([disabled]):not([readonly]), select:not([disabled]):not([readonly])'));
                    if (nextInputs.length > 0) targetEl = nextInputs[0];
                }
            }

            if (targetEl) {
                e.preventDefault();
                targetEl.focus();
                if (typeof targetEl.select === 'function') {
                    try { targetEl.select(); } catch (err) { }
                }
                if (typeof targetEl.scrollIntoView === 'function') {
                    try { targetEl.scrollIntoView({ block: 'nearest', inline: 'nearest' }); } catch (err) { }
                }
            }
        });
    }
    window.initTableKeyboardNavigation = initTableKeyboardNavigation;

})();
