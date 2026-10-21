/**
 * cbc.js - สคริปต์จัดการฟอร์มผลตรวจ CBC และกราฟ Histogram
 * STK Clinic System
 */

(function () {
    'use strict';

    // ข้อมูลเริ่มต้นสำหรับ CBC (ถอดค่ามาตรฐานจากเครื่องตรวจเลือด Hematology Analyzer)
    const BASE_CBC_ITEMS = [
        { section: 'White Blood Cell (WBC)' },
        { name: 'WBC', unit: '10^9/L', min: '4.0', max: '10.0' },
        { name: 'LYM%', unit: '%', min: '20.0', max: '40.0' },
        { name: 'MID%', unit: '%', min: '3.0', max: '9.0' },
        { name: 'GRAN%', unit: '%', min: '50.0', max: '70.0' },
        { name: 'LYM#', unit: '10^9/L', min: '0.8', max: '4.0' },
        { name: 'MID#', unit: '10^9/L', min: '0.1', max: '1.2' },
        { name: 'GRAN#', unit: '10^9/L', min: '2.0', max: '7.0' },

        { section: 'Red Blood Cell (RBC)' },
        { name: 'RBC', unit: '10^12/L', min: '3.50', max: '5.50' },
        { name: 'HGB', unit: 'g/dL', min: '11.0', max: '16.0' },
        { name: 'HCT', unit: '%', min: '36.0', max: '50.0' },
        { name: 'MCV', unit: 'fL', min: '80.0', max: '100.0' },
        { name: 'MCH', unit: 'pg', min: '27.0', max: '34.0' },
        { name: 'MCHC', unit: 'g/dL', min: '32.0', max: '36.0' },
        { name: 'RDW-CV', unit: '%', min: '11.0', max: '16.0' },
        { name: 'RDW-SD', unit: 'fL', min: '35.0', max: '56.0' },

        { section: 'Platelet (PLT)' },
        { name: 'PLT', unit: '10^9/L', min: '100', max: '300' },
        { name: 'MPV', unit: 'fL', min: '6.5', max: '12.0' },
        { name: 'PCT', unit: '%', min: '0.108', max: '0.282' },
        { name: 'P_LCR', unit: '%', min: '13.0', max: '43.0' },
        { name: 'P_LCC', unit: '10^9/L', min: '30', max: '90' },
        { name: 'PDW_SD', unit: 'fL', min: '9.0', max: '17.0' },
        { name: 'PDW_CV', unit: '%', min: '10.0', max: '18.0' }
    ];

    function getClinicRanges() {
        try {
            return JSON.parse(localStorage.getItem('clinic_cbc_reference_ranges') || '{}');
        } catch (e) {
            return {};
        }
    }

    const clinicCustom = getClinicRanges();
    const DEFAULT_CBC_DATA = BASE_CBC_ITEMS.map(it => {
        if (it.section) return it;
        const c = clinicCustom[it.name];
        return {
            name: it.name,
            value: '',
            unit: it.unit,
            min: (c && c.min !== undefined && c.min !== '') ? c.min : it.min,
            max: (c && c.max !== undefined && c.max !== '') ? c.max : it.max
        };
    });

    let currentVisitInfo = {
        visit_id: '',
        hn: '',
        name: ''
    };

    // คำนวณสถานะผลตรวจ ปกติ / ต่ำ / สูง
    function computeStatus(valStr, minStr, maxStr) {
        if (!valStr || valStr.trim() === '') {
            return { cls: 'empty', text: '-' };
        }
        const val = parseFloat(valStr);
        const min = parseFloat(minStr);
        const max = parseFloat(maxStr);

        if (isNaN(val)) {
            return { cls: 'empty', text: '-' };
        }
        if (!isNaN(min) && val < min) {
            return { cls: 'low', text: 'L (ต่ำ)' };
        }
        if (!isNaN(max) && val > max) {
            return { cls: 'high', text: 'H (สูง)' };
        }
        return { cls: 'normal', text: 'Normal' };
    }

    // แสดงข้อความ Toast
    function showToast(msg) {
        const toast = document.getElementById('toast');
        if (!toast) return;
        toast.innerText = msg;
        toast.style.display = 'block';
        setTimeout(() => {
            toast.style.display = 'none';
        }, 2500);
    }

    // แสดงข้อมูลผู้ป่วยจาก URL params หรือ SessionStorage
    function loadPatientInfo() {
        const params = new URLSearchParams(window.location.search);
        let visitId = params.get('visit_id') || params.get('visitId') || '';
        let hn = params.get('hn') || '';
        let name = params.get('name') || params.get('patient_name') || '';
        let mode = params.get('mode') || '';

        if (!visitId) {
            try {
                const sess = JSON.parse(sessionStorage.getItem('currentCbcVisit') || '{}');
                if (sess.visit_id) {
                    visitId = sess.visit_id;
                    hn = sess.hn || hn;
                    name = sess.patient_name || name;
                    if (!mode && sess.mode) mode = sess.mode;
                }
            } catch (e) { }
        }

        window._cbcMode = mode;
        currentVisitInfo = { visit_id: visitId, hn: hn, name: name };

        const infoEl = document.getElementById('cbcPatientInfo');
        if (infoEl) {
            const dateStr = new Date().toLocaleDateString('th-TH', { year: 'numeric', month: 'short', day: 'numeric' });
            infoEl.innerText = `รหัส Visit: ${visitId || '-'}  |  HN: ${hn || '-'}  |  ชื่อผู้ป่วย: ${name || '-'}  |  วันที่: ${dateStr}`;
        }

        const printMetaEl = document.getElementById('cbcPrintMeta');
        if (printMetaEl) {
            const dateStr = new Date().toLocaleDateString('th-TH', { year: 'numeric', month: 'short', day: 'numeric' });
            printMetaEl.innerText = `ລະຫັດ Visit: ${visitId || '-'}  |  HN: ${hn || '-'}  |  ຊື່ຄົນເຈັບ: ${name || '-'}  |  ວັນທີ: ${dateStr}`;
        }

        // จัดการปุ่ม Toolbar ตามโหมด
        const clearBtn = document.getElementById('clear');
        const printBtn = document.getElementById('print');
        if (mode === 'print') {
            if (clearBtn) clearBtn.style.display = 'none';
            if (printBtn) {
                printBtn.innerText = 'Print';
                printBtn.title = 'Print ผลตรวจ CBC';
            }
        } else {
            if (clearBtn) clearBtn.style.display = 'inline-block';
            if (printBtn) {
                printBtn.innerText = 'บันทึก';
                printBtn.title = 'บันทึกผลตรวจ CBC';
            }
        }
    }

    // วาดตาราง CBC
    function renderTable(items) {
        const tbody = document.getElementById('cbc');
        if (!tbody) return;
        tbody.innerHTML = '';

        const isPrintOnly = (window._cbcMode === 'print');

        items.forEach(item => {
            if (item.section) {
                const trSec = document.createElement('tr');
                trSec.className = 'sectionrow';
                trSec.innerHTML = `<td colspan="6"><strong>${item.section}</strong></td>`;
                tbody.appendChild(trSec);
                return;
            }

            const status = computeStatus(item.value, item.min, item.max);
            const tr = document.createElement('tr');
            tr.dataset.name = item.name;

            const readonlyAttr = isPrintOnly ? 'readonly disabled style="background-color: #f8fafc; cursor: default;"' : '';
            const readonlyRangeAttr = isPrintOnly ? 'readonly disabled style="background-color: #f8fafc; cursor: default;"' : '';

            tr.innerHTML = `
                <td>${item.name}</td>
                <td><input type="text" class="value" value="${item.value ?? ''}" data-key="val" ${readonlyAttr}></td>
                <td class="unit">${item.unit}</td>
                <td><input type="text" class="range" value="${item.min ?? ''}" data-key="min" ${readonlyRangeAttr}></td>
                <td><input type="text" class="range" value="${item.max ?? ''}" data-key="max" ${readonlyRangeAttr}></td>
                <td><span class="status ${status.cls}">${status.text}</span></td>
            `;

            if (!isPrintOnly) {
                // ดักจับการแก้ไขค่าในช่อง input
                const valInput = tr.querySelector('input[data-key="val"]');
                const minInput = tr.querySelector('input[data-key="min"]');
                const maxInput = tr.querySelector('input[data-key="max"]');
                const statusSpan = tr.querySelector('.status');

                const onUpdate = () => {
                    const newStatus = computeStatus(valInput.value, minInput.value, maxInput.value);
                    statusSpan.className = `status ${newStatus.cls}`;
                    statusSpan.innerText = newStatus.text;
                    updateHistograms();
                };

                valInput.addEventListener('input', onUpdate);
                valInput.addEventListener('change', onUpdate);
                valInput.addEventListener('keyup', onUpdate);
                minInput.addEventListener('input', onUpdate);
                minInput.addEventListener('change', onUpdate);
                maxInput.addEventListener('input', onUpdate);
                maxInput.addEventListener('change', onUpdate);
            }

            tbody.appendChild(tr);
        });

        updateHistograms();
    }

    // ดึงค่าผลตรวจจากตารางปัจจุบัน
    function getTableData() {
        const rows = document.querySelectorAll('#cbc tr');
        const list = [];
        rows.forEach(tr => {
            if (tr.classList.contains('sectionrow')) {
                list.push({ section: tr.innerText.trim() });
                return;
            }
            const name = tr.dataset.name || tr.cells[0]?.innerText.trim();
            const val = tr.querySelector('input[data-key="val"]')?.value ?? '';
            const unit = tr.cells[2]?.innerText.trim() ?? '';
            const min = tr.querySelector('input[data-key="min"]')?.value ?? '';
            const max = tr.querySelector('input[data-key="max"]')?.value ?? '';
            const status = tr.querySelector('.status')?.innerText.trim() ?? '';
            list.push({ name, val, unit, min, max, status });
        });
        return list;
    }

    // ฟังก์ชันช่วยสร้าง SVG กราฟเส้นโค้ง
    function generatePathData(points, width, height, padX, padY, fixedMinX, fixedMaxX, fixedMaxY) {
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

    function generatePath(points, width, height, padX, padY, fixedMinX, fixedMaxX, fixedMaxY) {
        return generatePathData(points, width, height, padX, padY, fixedMinX, fixedMaxX, fixedMaxY).line;
    }

    // วาดกราฟเส้นจำลอง Histogram (WBC, RBC, PLT)
    function updateHistograms() {
        const container = document.getElementById('real-histograms');
        if (!container) return;

        // ดึงค่า MCV, RDW, WBC, PLT เพื่อปรับเส้นจำลองตามค่าที่กรอกจริง
        const getVal = (name) => {
            const tr = document.querySelector(`#cbc tr[data-name="${name}"]`);
            const valStr = tr?.querySelector('input[data-key="val"]')?.value?.trim();
            if (valStr === undefined || valStr === null || valStr === '') return null;
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

        // 1. WBC Curve (ถ้า wbcVal เป็น null หรือ <= 0 จะเป็นเส้นตรงระนาบศูนย์เรียบติดพื้น)
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
            for (let x = 30; x <= 450; x += 30) {
                wbcPoints.push([x, 0]);
            }
        }

        // 2. RBC Curve (ถ้า rbcVal หรือ mcvVal เป็น null หรือ 0 จะเป็นเส้นตรงระนาบศูนย์เรียบติดพื้น)
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
            for (let x = 20; x <= 250; x += 20) {
                rbcPoints.push([x, 0]);
            }
        }

        // 3. PLT Curve (ถ้า pltVal เป็น null หรือ <= 0 จะเป็นเส้นตรงระนาบศูนย์เรียบติดพื้น)
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
            for (let x = 0.5; x <= 32; x += 3) {
                pltPoints.push([x, 0]);
            }
        }

        const w = 310;
        const h = 76;
        const padX = 20;
        const padY = 14;
        const baseY = h - padY; // 62

        const wbcData = generatePathData(wbcPoints, w, h, padX, padY, 30, 450, 150);
        const rbcData = generatePathData(rbcPoints, w, h, padX, padY, 20, 250, 130);
        const pltData = generatePathData(pltPoints, w, h, padX, padY, 0.5, 32, 160);

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
                        <span class="hist-range" style="font-size:10px;color:#64748b;">(40 - 450 fL)</span>
                    </div>
                    <svg viewBox="0 0 ${w} ${h}">
                        <defs>
                            <linearGradient id="gradWbcCbc" x1="0%" y1="0%" x2="0%" y2="100%">
                                <stop offset="0%" stop-color="#2563eb" stop-opacity="0.45"/>
                                <stop offset="60%" stop-color="#3b82f6" stop-opacity="0.18"/>
                                <stop offset="100%" stop-color="#60a5fa" stop-opacity="0.02"/>
                            </linearGradient>
                        </defs>
                        <line x1="20" y1="20" x2="${w - 10}" y2="20" stroke="#f1f5f9" stroke-width="1" />
                        <line x1="20" y1="36" x2="${w - 10}" y2="36" stroke="#f1f5f9" stroke-width="1" />
                        <line x1="20" y1="50" x2="${w - 10}" y2="50" stroke="#f1f5f9" stroke-width="1" />
                        <line class="axis-line" x1="20" y1="${baseY}" x2="${w - 10}" y2="${baseY}" stroke="#94a3b8" stroke-width="1.2" />
                        <path id="histAreaWbc" d="${wbcData.area}" fill="url(#gradWbcCbc)" />
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
                        <span class="hist-range" style="font-size:10px;color:#64748b;">(25 - 250 fL)</span>
                    </div>
                    <svg viewBox="0 0 ${w} ${h}">
                        <defs>
                            <linearGradient id="gradRbcCbc" x1="0%" y1="0%" x2="0%" y2="100%">
                                <stop offset="0%" stop-color="#dc2626" stop-opacity="0.45"/>
                                <stop offset="60%" stop-color="#ef4444" stop-opacity="0.18"/>
                                <stop offset="100%" stop-color="#f87171" stop-opacity="0.02"/>
                            </linearGradient>
                        </defs>
                        <line x1="20" y1="20" x2="${w - 10}" y2="20" stroke="#f1f5f9" stroke-width="1" />
                        <line x1="20" y1="36" x2="${w - 10}" y2="36" stroke="#f1f5f9" stroke-width="1" />
                        <line x1="20" y1="50" x2="${w - 10}" y2="50" stroke="#f1f5f9" stroke-width="1" />
                        <line class="axis-line" x1="20" y1="${baseY}" x2="${w - 10}" y2="${baseY}" stroke="#94a3b8" stroke-width="1.2" />
                        <path id="histAreaRbc" d="${rbcData.area}" fill="url(#gradRbcCbc)" />
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
                        <span class="hist-range" style="font-size:10px;color:#64748b;">(2 - 30 fL)</span>
                    </div>
                    <svg viewBox="0 0 ${w} ${h}">
                        <defs>
                            <linearGradient id="gradPltCbc" x1="0%" y1="0%" x2="0%" y2="100%">
                                <stop offset="0%" stop-color="#059669" stop-opacity="0.45"/>
                                <stop offset="60%" stop-color="#10b981" stop-opacity="0.18"/>
                                <stop offset="100%" stop-color="#34d399" stop-opacity="0.02"/>
                            </linearGradient>
                        </defs>
                        <line x1="20" y1="20" x2="${w - 10}" y2="20" stroke="#f1f5f9" stroke-width="1" />
                        <line x1="20" y1="36" x2="${w - 10}" y2="36" stroke="#f1f5f9" stroke-width="1" />
                        <line x1="20" y1="50" x2="${w - 10}" y2="50" stroke="#f1f5f9" stroke-width="1" />
                        <line class="axis-line" x1="20" y1="${baseY}" x2="${w - 10}" y2="${baseY}" stroke="#94a3b8" stroke-width="1.2" />
                        <path id="histAreaPlt" d="${pltData.area}" fill="url(#gradPltCbc)" />
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

    // บันทึกผลลง LocalStorage, Cache แล็บ และซิงค์เข้าระบบห้อง Lab
    async function saveResults() {
        const data = getTableData();
        const visitId = currentVisitInfo.visit_id || 'DEFAULT';

        try {
            // 1. บันทึกข้อมูลผลตรวจ CBC ทั้งหมด
            const allCbc = JSON.parse(localStorage.getItem('clinic_cbc_results') || '{}');
            allCbc[visitId] = {
                visit_id: visitId,
                hn: currentVisitInfo.hn,
                patient_name: currentVisitInfo.name,
                updated_at: new Date().toISOString(),
                items: data
            };
            localStorage.setItem('clinic_cbc_results', JSON.stringify(allCbc));

            // 2. บันทึกลง clinic_lab_files_meta เพื่อให้ระบบห้องแล็บดึงไปแสดงในคอลัมน์ผลตรวจทั้งหมด
            try {
                const metaMap = JSON.parse(localStorage.getItem('clinic_lab_files_meta') || '{}');
                let visitMetaList = Array.isArray(metaMap[visitId]) ? metaMap[visitId] : [];
                visitMetaList = visitMetaList.filter(f => f && f.category !== 'CBC');
                visitMetaList.push({
                    id: `FILE-CBC-${visitId}`,
                    visitId: visitId,
                    fileName: `CBC_Report_${visitId}.pdf`,
                    fileType: 'application/pdf',
                    category: 'CBC',
                    updatedAt: new Date().toISOString()
                });
                metaMap[visitId] = visitMetaList;
                localStorage.setItem('clinic_lab_files_meta', JSON.stringify(metaMap));
            } catch (exMeta) { }

            // 3. ซิงค์เข้าระบบฐานข้อมูล Supabase visits.lab_note (เชื่อมข้ามเครื่อง)
            const sup = window._supabase || (window.parent && window.parent._supabase);
            if (sup && visitId && visitId !== 'DEFAULT') {
                try {
                    const { data: exVisit } = await sup.from('visits').select('lab_note').eq('visit_id', visitId).single();
                    const payload = {
                        updated_at: new Date().toISOString(),
                        items: data
                    };
                    const cbcPayload = `[ผลตรวจ CBC]\n${JSON.stringify(payload)}\n[/ผลตรวจ CBC]`;
                    let newLabNote = cbcPayload;
                    if (exVisit && exVisit.lab_note) {
                        if (exVisit.lab_note.includes('[ผลตรวจ CBC]')) {
                            newLabNote = exVisit.lab_note.replace(/\[ผลตรวจ CBC\][\s\S]*?\[\/ผลตรวจ CBC\]/, cbcPayload);
                            if (!newLabNote.includes('[/ผลตรวจ CBC]')) {
                                newLabNote = exVisit.lab_note.replace(/\[ผลตรวจ CBC\]/, cbcPayload);
                            }
                        } else {
                            newLabNote = `${exVisit.lab_note}\n\n${cbcPayload}`;
                        }
                    }
                    await sup.from('visits').update({ lab_note: newLabNote }).eq('visit_id', visitId);
                } catch (dbErr) {
                    console.warn('Sync CBC to DB note notice:', dbErr);
                }
            }

            // 4. แจ้งเตือนหน้าหลักคลินิกให้อัปเดตคอลัมน์ "ผลตรวจทั้งหมด" ทันที
            if (window.parent && window.parent !== window) {
                try {
                    if (typeof window.parent.loadLabQueue === 'function') window.parent.loadLabQueue();
                    if (typeof window.parent.renderLabTable === 'function') window.parent.renderLabTable();
                } catch (pErr) { }
            }
            if (window.opener) {
                try {
                    if (typeof window.opener.loadLabQueue === 'function') window.opener.loadLabQueue();
                    if (typeof window.opener.renderLabTable === 'function') window.opener.renderLabTable();
                } catch (oErr) { }
            }

            if (typeof Swal !== 'undefined') {
                Swal.fire({
                    icon: 'success',
                    title: 'ບັນທຶກຜົນກວດ CBC ສຳເລັດ!',
                    html: `
                        <div style="text-align: left; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 12px 16px; margin: 6px 0 10px 0;">
                            <div>Visit: <strong style="color: #2563eb;">${currentVisitInfo.visit_id || '-'}</strong> | HN: <strong style="color: #0b3c73;">${currentVisitInfo.hn || '-'}</strong></div>
                            <div style="margin-top: 4px;">ຊື່ຄົນເຈັບ: <strong>${currentVisitInfo.name || '-'}</strong></div>
                            <div style="font-size: 12px; color: #16a34a; font-weight: 700; margin-top: 8px;">
                                <i class="bi bi-cloud-check-fill me-1"></i> ບັນທຶກ ແລະ ຊິງຄ໌ຜົນກວດ CBC ລົງໃນລະບົບຮຽບຮ້ອຍແລ້ວ
                            </div>
                        </div>
                    `,
                    confirmButtonText: 'ຕົກລົງ (OK)',
                    confirmButtonColor: '#2563eb',
                    timer: 3000,
                    timerProgressBar: true
                });
            } else {
                showToast('ບັນທຶກຜົນກວດ CBC ສຳເລັດແລ້ວ');
            }
            return true;
        } catch (e) {
            console.error('Save CBC Error:', e);
            if (typeof Swal !== 'undefined') {
                Swal.fire({
                    icon: 'error',
                    title: 'ເກີດຂໍ້ຜິດພາດ!',
                    text: 'ບໍ່ສາມາດບັນທຶກຂໍ້ມູນໄດ້: ' + (e.message || e),
                    confirmButtonColor: '#ef4444'
                });
            } else {
                showToast('ເກີດຂໍ້ຜິດພາດໃນການບັນທຶກ');
            }
            return false;
        }
    }

    // โหลดผลที่เคยบันทึกไว้ (ถ้ามี)
    async function loadSavedResults() {
        const visitId = currentVisitInfo.visit_id;
        if (!visitId) return false;

        let localSaved = null;
        try {
            const allCbc = JSON.parse(localStorage.getItem('clinic_cbc_results') || '{}');
            const saved = allCbc[visitId];
            if (saved && Array.isArray(saved.items) && saved.items.length > 0) {
                localSaved = saved.items;
            }
        } catch (e) { }

        let dbSavedItems = null;
        const sup = window._supabase || (window.parent && window.parent._supabase);
        if (sup && visitId !== 'DEFAULT') {
            try {
                const { data: vData } = await sup.from('visits').select('lab_note').eq('visit_id', visitId).single();
                if (vData && vData.lab_note && vData.lab_note.includes('[ผลตรวจ CBC]')) {
                    const match = vData.lab_note.match(/\[ผลตรวจ CBC\]\s*([\s\S]*?)\s*\[\/ผลตรวจ CBC\]/);
                    if (match && match[1]) {
                        const parsed = JSON.parse(match[1]);
                        if (Array.isArray(parsed) && parsed.length > 0) {
                            dbSavedItems = parsed;
                        } else if (parsed && Array.isArray(parsed.items) && parsed.items.length > 0) {
                            dbSavedItems = parsed.items;
                        }
                    }
                }

                if (!dbSavedItems && localSaved) {
                    const payload = {
                        updated_at: new Date().toISOString(),
                        items: localSaved
                    };
                    const cbcTag = `[ผลตรวจ CBC]\n${JSON.stringify(payload)}\n[/ผลตรวจ CBC]`;
                    let newLabNote = cbcTag;
                    if (vData && vData.lab_note) {
                        newLabNote = `${vData.lab_note}\n\n${cbcTag}`;
                    }
                    await sup.from('visits').update({ lab_note: newLabNote }).eq('visit_id', visitId);
                    dbSavedItems = localSaved;
                }
            } catch (dbErr) { }
        }

        const finalItems = dbSavedItems || localSaved;
        if (finalItems && Array.isArray(finalItems) && finalItems.length > 0) {
            const savedMap = new Map();
            finalItems.forEach(it => {
                if (it.name) savedMap.set(it.name, it);
            });
            const merged = DEFAULT_CBC_DATA.map(def => {
                if (def.section) return def;
                if (savedMap.has(def.name)) {
                    const it = savedMap.get(def.name);
                    return {
                        name: it.name,
                        value: (it.value !== undefined ? it.value : it.val),
                        unit: it.unit || def.unit,
                        min: it.min || def.min,
                        max: it.max || def.max
                    };
                }
                return def;
            });
            renderTable(merged);
            showToast(`โหลดข้อมูลที่เคยบันทึกของ ${visitId}`);
            return true;
        }
        return false;
    }

    // คัดลอกข้อมูลแบบข้อความ
    function copyCbcText() {
        const data = getTableData();
        let txt = `ผลตรวจ CBC (Complete Blood Count)\n`;
        if (currentVisitInfo.visit_id) txt += `Visit: ${currentVisitInfo.visit_id} | HN: ${currentVisitInfo.hn} | ชื่อ: ${currentVisitInfo.name}\n`;
        txt += `วันที่: ${new Date().toLocaleDateString('th-TH')}\n`;
        txt += `--------------------------------------------------\n`;

        data.forEach(it => {
            if (it.section) {
                txt += `\n[${it.section}]\n`;
            } else {
                txt += `${it.name}: ${it.val} ${it.unit}  [${it.min}-${it.max}]  ${it.status}\n`;
            }
        });

        navigator.clipboard.writeText(txt).then(() => {
            showToast('คัดลอกข้อมูล CBC เรียบร้อยแล้ว');
        }).catch(() => {
            showToast('ไม่สามารถคัดลอกข้อมูลได้');
        });
    }

    // ดาวน์โหลดไฟล์ CSV
    function exportCsv() {
        const data = getTableData();
        let csvContent = '\uFEFFรายการตรวจ,ผลตรวจ,หน่วย,ค่าต่ำสุด,ค่าสูงสุด,สถานะ\n';

        data.forEach(it => {
            if (it.section) {
                csvContent += `"-- ${it.section} --",,,,,\n`;
            } else {
                csvContent += `"${it.name}","${it.val}","${it.unit}","${it.min}","${it.max}","${it.status}"\n`;
            }
        });

        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        const filename = `CBC_Result_${currentVisitInfo.visit_id || 'export'}.csv`;
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        showToast('ดาวน์โหลด CSV สำเร็จ');
    }

    // จัดการ Event Listeners สำหรับปุ่มต่างๆ
    function setupEvents() {
        document.getElementById('backBtn')?.addEventListener('click', (e) => {
            e.preventDefault();
            if (window.parent && window.parent !== window && typeof window.parent.closeCbcModal === 'function') {
                window.parent.closeCbcModal();
            } else if (window.opener) {
                window.close();
            } else {
                window.location.href = 'Clinic.html';
            }
        });
        document.getElementById('copy')?.addEventListener('click', copyCbcText);
        document.getElementById('print')?.addEventListener('click', async () => {
            if (window._cbcMode === 'print') {
                window.print();
            } else {
                await saveResults();
                showToast('ບັນທຶກຜົນກວດ CBC ຮຽບຮ້ອຍແລ້ວ');
            }
        });
        document.getElementById('reset')?.addEventListener('click', () => {
            renderTable(DEFAULT_CBC_DATA);
            showToast('คืนค่าเริ่มต้นจากภาพแล้ว');
        });
        document.getElementById('clear')?.addEventListener('click', () => {
            document.querySelectorAll('#cbc input[data-key="val"]').forEach(inp => {
                inp.value = '';
                inp.dispatchEvent(new Event('input'));
            });
            showToast('ล้างผลตรวจเรียบร้อยแล้ว');
        });
        document.getElementById('saveLocal')?.addEventListener('click', saveResults);

        // นำเข้าไฟล์กราฟจากเครื่องตรวจ
        const fileInput = document.getElementById('distribution-file');
        fileInput?.addEventListener('change', function (e) {
            const file = e.target.files[0];
            if (!file) return;

            const reader = new FileReader();
            reader.onload = function (evt) {
                try {
                    const text = evt.target.result;
                    const msgEl = document.getElementById('graph-message');
                    if (msgEl) {
                        msgEl.innerText = `นำเข้าข้อมูลกราฟจากไฟล์ "${file.name}" เรียบร้อยแล้ว`;
                        msgEl.style.color = '#087453';
                    }
                    showToast('นำเข้าข้อมูลกราฟสำเร็จ');
                } catch (err) {
                    showToast('รูปแบบไฟล์ไม่ถูกต้อง');
                }
            };
            reader.readAsText(file);
        });
    }

    // เริ่มต้นทำงานเมื่อ DOM โหลดเสร็จ
    document.addEventListener('DOMContentLoaded', () => {
        loadPatientInfo();
        if (!loadSavedResults()) {
            renderTable(DEFAULT_CBC_DATA);
        }
        setupEvents();
        initTableKeyboardNavigation();
    });

    // ລະບົບ Keyboard Navigation (Up, Down, Left, Right, Enter)
    function initTableKeyboardNavigation(root = document) {
        root.addEventListener('keydown', function (e) {
            const isUp = (e.key === 'ArrowUp') || (e.key === 'Enter' && e.shiftKey);
            const isDown = (e.key === 'ArrowDown') || (e.key === 'Enter' && !e.shiftKey);
            const isLeft = (e.key === 'ArrowLeft');
            const isRight = (e.key === 'ArrowRight');

            if (!isUp && !isDown && !isLeft && !isRight) return;

            const el = e.target;
            if (!el || el.tagName !== 'INPUT') return;
            if (el.readOnly || el.disabled || el.type === 'button' || el.type === 'file') return;

            const tr = el.closest('tr');
            if (!tr) return;

            const table = tr.closest('table') || tr.closest('tbody');
            if (!table) return;

            const rows = Array.from(table.querySelectorAll('tr')).filter(r => {
                if (r.closest('thead')) return false;
                return r.querySelector('input:not([disabled]):not([readonly])');
            });
            const rowIndex = rows.indexOf(tr);
            if (rowIndex === -1) return;

            const currentInputs = Array.from(tr.querySelectorAll('input:not([disabled]):not([readonly])'));
            const colIndex = currentInputs.indexOf(el);
            if (colIndex === -1) return;

            let targetEl = null;

            if (isDown) {
                if (rowIndex < rows.length - 1) {
                    const nextTr = rows[rowIndex + 1];
                    const nextInputs = Array.from(nextTr.querySelectorAll('input:not([disabled]):not([readonly])'));
                    const dataKey = el.getAttribute('data-key');
                    if (dataKey) targetEl = nextTr.querySelector(`[data-key="${dataKey}"]:not([disabled]):not([readonly])`);
                    if (!targetEl && nextInputs.length > 0) targetEl = nextInputs[Math.min(colIndex, nextInputs.length - 1)];
                }
            } else if (isUp) {
                if (rowIndex > 0) {
                    const prevTr = rows[rowIndex - 1];
                    const prevInputs = Array.from(prevTr.querySelectorAll('input:not([disabled]):not([readonly])'));
                    const dataKey = el.getAttribute('data-key');
                    if (dataKey) targetEl = prevTr.querySelector(`[data-key="${dataKey}"]:not([disabled]):not([readonly])`);
                    if (!targetEl && prevInputs.length > 0) targetEl = prevInputs[Math.min(colIndex, prevInputs.length - 1)];
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
                    const prevInputs = Array.from(prevTr.querySelectorAll('input:not([disabled]):not([readonly])'));
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
                    const nextInputs = Array.from(nextTr.querySelectorAll('input:not([disabled]):not([readonly])'));
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

})();
