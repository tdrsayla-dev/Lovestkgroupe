// =====================================================
// biochem.js — v1.0
// ฟังก์ชันจัดการฟอร์มบันทึกผลเคมีคลินิก (Biochemistry Analysis Report)
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

    // 🌟 ตรวจสอบโหมด: หากเปิดจากหน้าประวัติผู้ป่วย (history / print / view) หรือหน้าต่างสั่งยา ให้เป็น Read-Only ทันที
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

    function applyReadOnlyMode() {
        if (!isReadOnlyMode) return;
        document.documentElement.classList.add('readonly-mode');
        if (document.body) document.body.classList.add('readonly-mode');

        // ตัดปุ่ม Save, Recover Lab, Clear, Auto Extract, Add Row ออกทั้งหมด (เหลือไว้เฉพาะปุ่มพิมพ์ Print)
        const hideIds = ['btnSave', 'btnConvertFrame', 'btnClear', 'btnAutoExtract', 'btnAddRow'];
        hideIds.forEach(id => {
            const el = document.getElementById(id);
            if (el) {
                el.style.setProperty('display', 'none', 'important');
                el.style.setProperty('visibility', 'hidden', 'important');
                el.style.setProperty('pointer-events', 'none', 'important');
                try { el.remove(); } catch (e) { }
            }
        });

        // ซ่อนคอลัมน์ลบส่วนหัว
        const lastTh = document.querySelector('#biochemTable th:last-child');
        if (lastTh) {
            lastTh.style.setProperty('display', 'none', 'important');
        }

        // ล็อกช่อง Input ทั้งหมด และซ่อนปุ่มถังขยะ
        const inputs = document.querySelectorAll('#biochemTable input');
        inputs.forEach(inp => {
            inp.readOnly = true;
            inp.setAttribute('readonly', 'readonly');
            inp.setAttribute('tabindex', '-1');
            inp.style.setProperty('pointer-events', 'none', 'important');
            inp.style.setProperty('background-color', '#f8fafc', 'important');
            inp.style.setProperty('cursor', 'default', 'important');
        });

        const delBtns = document.querySelectorAll('.btn-del-row');
        delBtns.forEach(btn => {
            btn.style.setProperty('display', 'none', 'important');
            try { btn.remove(); } catch (e) { }
        });

        const delTds = document.querySelectorAll('#bioc    // 1. ລາຍການກວດມາດຕະຖານ (Default Standard Biochemistry Tests - 16 ລາຍການຕາມເຄື່ອງວິເຄາະ)
    const DEFAULT_TESTS = [
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
    ];��ละการเผาผลาญ (Glucose & Metabolism)
        { category: 'Glucose & Metabolic (ນ້ຳຕານ ແລະ ເມຕາໂບລິກ)', test: 'GLUCOSE', sample: 'SER', unit: 'mg/dL', ref: '70 - 110', val: '' },
        { category: 'Glucose & Metabolic (ນ້ຳຕານ ແລະ ເມຕາໂບລິກ)', test: 'HbA1c', sample: 'WB', unit: '%', ref: '4.0 - 6.0', val: '' },
        { category: 'Glucose & Metabolic (ນ້ຳຕານ ແລະ ເມຕາໂບລິກ)', test: 'AMYLASE DIRECT', sample: 'SER', unit: 'U/L', ref: '40 - 120', val: '' },
        { category: 'Glucose & Metabolic (ນ້ຳຕານ ແລະ ເມຕາໂບລິກ)', test: 'CALCIUM (SERUM)', sample: 'SER', unit: 'mg/dL', ref: '8.00 - 11.00', val: '' },

        // เกลือแร่ (Electrolytes)
        { category: 'Electrolytes (ເກືອແຮ່ໃນເລືອດ)', test: 'SODIUM (Na)', sample: 'SER', unit: 'mmol/L', ref: '135 - 145', val: '' },
        { category: 'Electrolytes (ເກືອແຮ່ໃນເລືອດ)', test: 'POTASSIUM (K)', sample: 'SER', unit: 'mmol/L', ref: '3.5 - 5.0', val: '' },
        { category: 'Electrolytes (ເກືອແຮ່ໃນເລືອດ)', test: 'CHLORIDE (Cl)', sample: 'SER', unit: 'mmol/L', ref: '98 - 107', val: '' },
        { category: 'Electrolytes (ເກືອແຮ່ໃນເລືອດ)', test: 'CO2 (BICARBONATE)', sample: 'SER', unit: 'mmol/L', ref: '22 - 29', val: '' }
    ];

    let currentRows = [];
    const storageKey = 'stk-biochem-report:' + (visitId || 'default');

    // คำนวณ Flag อัตโนมัติ (H, L, Positive, Normal)
    function computeFlag(resultStr, refStr) {
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

    // แสดงข้อความ Toast
    function showToast(msg) {
        const toast = document.getElementById('toast');
        if (!toast) return;
        toast.innerText = msg;
        toast.style.display = 'block';
        setTimeout(() => { toast.style.display = 'none'; }, 2500);
    }

    // ฟังก์ชันสร้าง Table DOM
    function renderTable() {
        const tbody = document.getElementById('biochemBody');
        if (!tbody) return;
        tbody.innerHTML = '';

        let lastCat = null;
        currentRows.forEach((row, idx) => {
            if (row.category && row.category !== lastCat) {
                lastCat = row.category;
                const catTr = document.createElement('tr');
                catTr.className = 'category-row';
                catTr.innerHTML = `<td colspan="7"><i class="bi bi-tag-fill me-1"></i>${row.category}</td>`;
                tbody.appendChild(catTr);
            }

            const tr = document.createElement('tr');
            tr.dataset.index = idx;

            const flagInfo = computeFlag(row.val, row.ref);

            if (isReadOnlyMode) {
                tr.innerHTML = `
                    <td>
                        <input type="text" class="test-input" value="${row.test || ''}" readonly tabindex="-1" style="font-weight: 700; pointer-events: none; background-color: #f8fafc; border-color: #e2e8f0;">
                    </td>
                    <td style="text-align: center;">
                        <input type="text" class="type-input text-center" value="${row.sample || 'SER'}" readonly tabindex="-1" style="font-size: 11px; text-transform: uppercase; pointer-events: none; background-color: #f8fafc; border-color: #e2e8f0;">
                    </td>
                    <td>
                        <input type="text" class="result-input" value="${row.val || ''}" readonly tabindex="-1" style="font-weight: 800; pointer-events: none; background-color: #f1f5f9; color: #0f172a; border-color: #cbd5e1;">
                    </td>
                    <td>
                        <input type="text" class="unit-input" value="${row.unit || ''}" readonly tabindex="-1" style="pointer-events: none; background-color: #f8fafc; border-color: #e2e8f0;">
                    </td>
                    <td style="text-align: center;" id="flagCell_${idx}">
                        <span class="flag-badge ${flagInfo.cls}">${flagInfo.flag || '-'}</span>
                    </td>
                    <td>
                        <input type="text" class="ref-input" value="${row.ref || ''}" readonly tabindex="-1" style="pointer-events: none; background-color: #f8fafc; border-color: #e2e8f0;">
                    </td>
                    <td style="display: none !important;"></td>
                `;
            } else {
                tr.innerHTML = `
                    <td>
                        <input type="text" class="test-input" value="${row.test || ''}" placeholder="ຊື່ລາຍການກວດ" style="font-weight: 700;">
                    </td>
                    <td style="text-align: center;">
                        <input type="text" class="type-input text-center" value="${row.sample || 'SER'}" style="font-size: 11px; text-transform: uppercase;">
                    </td>
                    <td>
                        <input type="text" class="result-input" value="${row.val || ''}" placeholder="ໃສ່ຜົນກວດ..." oninput="window.__onBiochemValChange(${idx}, this.value)">
                    </td>
                    <td>
                        <input type="text" class="unit-input" value="${row.unit || ''}" placeholder="ໜ່ວຍ (g/L, mg/dL...)">
                    </td>
                    <td style="text-align: center;" id="flagCell_${idx}">
                        <span class="flag-badge ${flagInfo.cls}">${flagInfo.flag || '-'}</span>
                    </td>
                    <td>
                        <input type="text" class="ref-input" value="${row.ref || ''}" placeholder="ຄ່າອ້າງອີງ (35 - 50)" oninput="window.__onBiochemRefChange(${idx}, this.value)">
                    </td>
                    <td style="text-align: center;" class="no-print">
                        <button type="button" class="btn-del-row" onclick="window.__onBiochemDeleteRow(${idx})" title="ລຶບລາຍການນີ້">
                            <i class="bi bi-trash3-fill"></i>
                        </button>
                    </td>
                `;
            }

            tbody.appendChild(tr);
        });

        if (isReadOnlyMode) {
            applyReadOnlyMode();
        }
    }

    window.__onBiochemValChange = function (idx, val) {
        if (isReadOnlyMode || !currentRows[idx]) return;
        currentRows[idx].val = val;
        const flagInfo = computeFlag(val, currentRows[idx].ref);
        const cell = document.getElementById('flagCell_' + idx);
        if (cell) {
            cell.innerHTML = `<span class="flag-badge ${flagInfo.cls}">${flagInfo.flag || '-'}</span>`;
        }
    };

    window.__onBiochemRefChange = function (idx, ref) {
        if (isReadOnlyMode || !currentRows[idx]) return;
        currentRows[idx].ref = ref;
        const flagInfo = computeFlag(currentRows[idx].val, ref);
        const cell = document.getElementById('flagCell_' + idx);
        if (cell) {
            cell.innerHTML = `<span class="flag-badge ${flagInfo.cls}">${flagInfo.flag || '-'}</span>`;
        }
    };

    window.__onBiochemDeleteRow = function (idx) {
        if (isReadOnlyMode || !currentRows[idx]) return;
        currentRows.splice(idx, 1);
        renderTable();
    };

    // ปุ่มเพิ่มรายการใหม่
    const btnAdd = document.getElementById('btnAddRow');
    if (btnAdd) {
        btnAdd.addEventListener('click', () => {
            currentRows.push({
                category: 'ລາຍການກວດເພີ່ມເຕີມ (Custom Tests)',
                test: '',
                sample: 'SER',
                unit: '',
                ref: '',
                val: ''
            });
            renderTable();
            setTimeout(() => {
                const inputs = document.querySelectorAll('.test-input');
                if (inputs.length > 0) inputs[inputs.length - 1].focus();
            }, 50);
        });
    }

    // 2. ดึงข้อมูลผู้ป่วย
    function formatLaoDate(dateObj) {
        const d = dateObj ? new Date(dateObj) : new Date();
        if (isNaN(d.getTime())) return '-';
        const laoMonths = ['ມັງກອນ', 'ກຸມພາ', 'ມີນາ', 'ເມສາ', 'ພຶດສະພາ', 'ມິຖຸນາ', 'ກໍລະກົດ', 'ສິງຫາ', 'ກັນຍາ', 'ຕຸລາ', 'ພະຈິກ', 'ທັນວາ'];
        return `${d.getDate()} ${laoMonths[d.getMonth()]} ${d.getFullYear()}`;
    }

    document.getElementById('metaVisitId').innerText = visitId || '-';
    document.getElementById('metaHn').innerText = hn || '-';
    document.getElementById('metaPatientName').innerText = patientName || '-';
    document.getElementById('metaDate').innerText = formatLaoDate(new Date());

    // 3. จัดการเชื่อมต่อ Supabase
    let sup = null;
    try {
        if (typeof supabase !== 'undefined') {
            const url = (typeof CONFIG !== 'undefined' && CONFIG.SUPABASE_URL) || window.SUPABASE_URL;
            const key = (typeof CONFIG !== 'undefined' && CONFIG.SUPABASE_ANON_KEY) || window.SUPABASE_ANON_KEY;
            if (url && key) sup = supabase.createClient(url, key);
        }
        if (!sup) {
            if (window.opener && window.opener._supabase) sup = window.opener._supabase;
            else if (window.parent && window.parent !== window && window.parent._supabase) sup = window.parent._supabase;
        }
    } catch (e) { }

    // 4. โหลดข้อมูลผลตรวจเดิม
    async function loadSavedData() {
        let loadedItems = null;

        // ดึงจาก LocalStorage ก่อน
        try {
            const raw = localStorage.getItem(storageKey);
            if (raw) {
                const parsed = JSON.parse(raw);
                if (parsed && Array.isArray(parsed.items) && parsed.items.length > 0) {
                    loadedItems = parsed.items;
                }
            }
        } catch (e) { }

        // ดึงจาก Supabase visits.lab_note
        if (sup && visitId) {
            try {
                const { data: vRow } = await sup.from('visits').select('lab_note, hn, patient_name, patient_age, created_at').eq('visit_id', visitId).maybeSingle();
                if (vRow) {
                    if (vRow.hn && (!hn || hn === '-')) document.getElementById('metaHn').innerText = vRow.hn;
                    if (vRow.patient_name && (!patientName || patientName === '-')) document.getElementById('metaPatientName').innerText = vRow.patient_name;
                    if (vRow.patient_age) document.getElementById('metaAge').innerText = vRow.patient_age + ' ປີ';
                    if (vRow.created_at) document.getElementById('metaDate').innerText = formatLaoDate(vRow.created_at);

                    if (vRow.lab_note && vRow.lab_note.includes('[ผลตรวจ Biochem]')) {
                        const m = vRow.lab_note.match(/\[ผลตรวจ Biochem\]\s*([\s\S]*?)\s*\[\/ผลตรวจ Biochem\]/);
                        if (m && m[1]) {
                            try {
                                const dbItems = JSON.parse(m[1]);
                                if (Array.isArray(dbItems) && dbItems.length > 0) {
                                    loadedItems = dbItems;
                                }
                            } catch (e) { }
                        }
                    }
                }
            } catch (dbErr) {
                console.warn('Load Biochem DB warning:', dbErr);
            }
        }

        if (loadedItems && Array.isArray(loadedItems)) {
            // รวมข้อมูลที่มีกับชุดมาตรฐาน
            currentRows = DEFAULT_TESTS.map(def => {
                const defUpper = def.test.trim().toUpperCase();
                const found = loadedItems.find(it => {
                    if (!it.test) return false;
                    const itUpper = it.test.trim().toUpperCase();
                    if (itUpper === defUpper) return true;
                    if (defUpper.includes('ALP') && itUpper.includes('ALP')) return true;
                    if (defUpper.includes('ALT') && itUpper.includes('ALT')) return true;
                    if (defUpper.includes('AST') && itUpper.includes('AST')) return true;
                    if (defUpper.includes('BILIRUBIN') && (itUpper.includes('TOTAL') || itUpper.includes('T-BIL'))) return true;
                    if (defUpper.includes('CALCIUM') && itUpper.includes('CALCIUM')) return true;
                    if (defUpper.includes('HDL') && itUpper.includes('HDL')) return true;
                    if (defUpper.includes('LDL') && itUpper.includes('LDL')) return true;
                    if (defUpper.includes('UREA') && (itUpper.includes('UREA') || itUpper.includes('BUN'))) return true;
                    return false;
                });
                if (found) {
                    return {
                        ...def,
                        val: found.result !== undefined ? found.result : (found.val || ''),
                        sample: found.sample || def.sample,
                        unit: found.unit || def.unit,
                        ref: found.ref || def.ref
                    };
                }
                return { ...def };
            });

            // เพิ่มรายการ Custom ที่ไม่ได้อยู่ในค่ามาตรฐาน (เฉพาะที่มีค่าผลตรวจจริงเท่านั้น)
            loadedItems.forEach(it => {
                const valStr = String((it.result !== undefined ? it.result : it.val) || '').trim();
                if (!valStr) return;
                const itUpper = (it.test || '').trim().toUpperCase();
                const isDef = DEFAULT_TESTS.some(d => {
                    const dUpper = d.test.trim().toUpperCase();
                    return dUpper === itUpper ||
                           (dUpper.includes('ALP') && itUpper.includes('ALP')) ||
                           (dUpper.includes('ALT') && itUpper.includes('ALT')) ||
                           (dUpper.includes('AST') && itUpper.includes('AST')) ||
                           (dUpper.includes('BILIRUBIN') && itUpper.includes('BILIRUBIN')) ||
                           (dUpper.includes('HDL') && itUpper.includes('HDL')) ||
                           (dUpper.includes('LDL') && itUpper.includes('LDL')) ||
                           (dUpper.includes('UREA') && itUpper.includes('UREA'));
                });
                if (!isDef && it.test) {
                    currentRows.push({
                        test: it.test,
                        sample: it.sample || 'SER',
                        unit: it.unit || '',
                        ref: it.ref || '',
                        val: valStr
                    });
                }
            });
        } else {
            currentRows = JSON.parse(JSON.stringify(DEFAULT_TESTS));
        }

        renderTable();
    }

    loadSavedData();

    // 5. รวบรวมข้อมูลปัจจุบันจากตาราง
    function collectTableData() {
        const rows = [];
        const tbody = document.getElementById('biochemBody');
        if (!tbody) return rows;

        const trs = tbody.querySelectorAll('tr[data-index]');
        trs.forEach((tr, i) => {
            const idx = tr.dataset.index;
            const test = tr.querySelector('.test-input')?.value?.trim() || '';
            const sample = tr.querySelector('.type-input')?.value?.trim() || 'SER';
            const val = tr.querySelector('.result-input')?.value?.trim() || '';
            const unit = tr.querySelector('.unit-input')?.value?.trim() || '';
            const ref = tr.querySelector('.ref-input')?.value?.trim() || '';
            const category = currentRows[idx]?.category || 'Biochemistry';
            const flagInfo = computeFlag(val, ref);

            if (test) {
                rows.push({
                    category,
                    test,
                    sample,
                    result: val,
                    val,
                    unit,
                    flag: flagInfo.flag || '',
                    ref
                });
            }
        });
        return rows;
    }

    // 6. บันทึกข้อมูล
    async function saveData() {
        if (isReadOnlyMode) return;
        const items = collectTableData();
        const payload = {
            visitId,
            hn,
            patientName,
            savedAt: new Date().toISOString(),
            items
        };

        // ก. LocalStorage
        try {
            localStorage.setItem(storageKey, JSON.stringify(payload));

            // บันทึกลง clinic_biochem_results
            let allBio = {};
            try { allBio = JSON.parse(localStorage.getItem('clinic_biochem_results') || '{}'); } catch (e) { }
            allBio[visitId] = payload;
            allBio[String(visitId).replace('VIS-', '')] = payload;
            localStorage.setItem('clinic_biochem_results', JSON.stringify(allBio));

            // เพิ่มเข้า clinic_lab_files_meta
            if (visitId) {
                let metaMap = {};
                try { metaMap = JSON.parse(localStorage.getItem('clinic_lab_files_meta') || '{}'); } catch (e) { }
                let visitMetaList = Array.isArray(metaMap[visitId]) ? metaMap[visitId] : [];
                visitMetaList = visitMetaList.filter(f => f && f.category !== 'Biochemistry');
                visitMetaList.push({
                    id: `FILE-BIOCHEM-${visitId}`,
                    visitId: visitId,
                    fileName: `Biochem_Report_${visitId}.pdf`,
                    fileType: 'application/pdf',
                    category: 'Biochemistry',
                    updatedAt: new Date().toISOString()
                });
                metaMap[visitId] = visitMetaList;
                localStorage.setItem('clinic_lab_files_meta', JSON.stringify(metaMap));
            }
        } catch (e) { console.warn('Save LocalStorage error:', e); }

        // ข. Cloud Supabase
        if (sup && visitId) {
            try {
                const { data: exVisit } = await sup.from('visits').select('pdf_url, lab_note').eq('visit_id', visitId).maybeSingle();
                const biochemPayload = `[ผลตรวจ Biochem]\n${JSON.stringify(items)}\n[/ผลตรวจ Biochem]`;
                let newLabNote = biochemPayload;
                if (exVisit && exVisit.lab_note) {
                    if (exVisit.lab_note.includes('[ผลตรวจ Biochem]')) {
                        newLabNote = exVisit.lab_note.replace(/\[ผลตรวจ Biochem\][\s\S]*?\[\/ผลตรวจ Biochem\]/, biochemPayload);
                        if (!newLabNote.includes('[/ผลตรวจ Biochem]')) {
                            newLabNote = exVisit.lab_note.replace(/\[ผลตรวจ Biochem\]/, biochemPayload);
                        }
                    } else {
                        newLabNote = `${exVisit.lab_note}\n\n${biochemPayload}`;
                    }
                }

                // จัดการ pdf_url
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
                currentPdfFiles = currentPdfFiles.filter(f => f && f.category !== 'Biochemistry' && (!f.fileName || !f.fileName.includes('Biochem_Report_')));
                currentPdfFiles.push({
                    id: `FILE-BIOCHEM-${visitId}`,
                    visitId: visitId,
                    fileName: `Biochem_Report_${visitId}.pdf`,
                    fileType: 'application/pdf',
                    category: 'Biochemistry',
                    url: `biochem:${visitId}`,
                    publicUrl: `biochem:${visitId}`,
                    updatedAt: new Date().toISOString()
                });

                await sup.from('visits').update({
                    lab_note: newLabNote,
                    pdf_url: JSON.stringify(currentPdfFiles)
                }).eq('visit_id', visitId);
            } catch (err) {
                console.warn('Save Biochem Supabase error:', err);
            }
        }

        if (typeof Swal !== 'undefined') {
            Swal.fire({
                icon: 'success',
                title: 'ບັນທຶກຜົນກວດ Biochem ສຳເລັດ!',
                html: `
                    <div style="text-align: left; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 12px 16px; margin: 6px 0 10px 0;">
                        <div>Visit: <strong style="color: #2563eb;">${escapeHtml(visitId || '-')}</strong> | HN: <strong style="color: #0b3c73;">${escapeHtml(hn || '-')}</strong></div>
                        <div style="margin-top: 4px;">ຊື່ຄົນເຈັບ: <strong>${escapeHtml(patientName || '-')}</strong></div>
                        <div style="font-size: 12px; color: #16a34a; font-weight: 700; margin-top: 8px;">
                            <i class="bi bi-cloud-check-fill me-1"></i> ຊິງຄ໌ຜົນກວດ Biochem ລົງ Cloud ຮຽບຮ້ອຍແລ້ວ
                        </div>
                    </div>
                `,
                confirmButtonText: 'ຕົກລົງ (OK)',
                confirmButtonColor: '#2563eb',
                timer: 3000,
                timerProgressBar: true
            });
        } else {
            showToast('ບັນທຶກຜົນກວດ Biochem ຮຽບຮ້ອຍແລ້ວ!');
        }
    }

    const btnSave = document.getElementById('btnSave');
    if (btnSave) btnSave.addEventListener('click', saveData);

    // 7. ปุ่ม "ดึงค่าจากไฟล์ PDF / รูปภาพเดิม (Auto-Fill from File)"
    const btnAutoExtract = document.getElementById('btnAutoExtract');
    if (btnAutoExtract) {
        btnAutoExtract.addEventListener('click', async () => {
            if (!visitId) {
                Swal.fire('ແຈ້ງເຕືອນ', 'ບໍ່ພົບລະຫັດ Visit ສຳລັບດຶງໄຟລ໌', 'info');
                return;
            }

            Swal.fire({
                title: 'ກຳລັງອ່ານຂໍ້ມູນຈາກໄຟລ໌...',
                html: '<div class="spinner-border text-primary my-2"></div><div class="small text-muted">ກະລຸນາລໍຖ້າຈັກໜ່ອຍ...</div>',
                allowOutsideClick: false,
                showConfirmButton: false
            });

            try {
                // ค้นหาไฟล์จาก visitRow หรือ window.parent
                let fileUrls = [];
                if (sup) {
                    const { data: v } = await sup.from('visits').select('pdf_url').eq('visit_id', visitId).maybeSingle();
                    if (v && v.pdf_url) {
                        try {
                            const pList = JSON.parse(v.pdf_url);
                            if (Array.isArray(pList)) {
                                fileUrls = pList.filter(f => f && f.url && !String(f.url).startsWith('FILE-') && !String(f.url).startsWith('biochem:') && !String(f.url).startsWith('urine:'));
                            }
                        } catch (e) {
                            if (typeof v.pdf_url === 'string' && v.pdf_url.startsWith('http')) {
                                fileUrls = [{ url: v.pdf_url }];
                            }
                        }
                    }
                }

                if (fileUrls.length === 0) {
                    Swal.fire('ບໍ່ພົບໄຟລ໌', 'ບໍ່ພົບໄຟລ໌ PDF ຫຼື ຮູບພາບຜົນກວດທີ່ແນບໄວ້ໃນ Visit ນີ້', 'info');
                    return;
                }

                // ใช้อ่านจาก Recover Lab parser ถ้ามี
                let extractedCount = 0;
                for (const f of fileUrls) {
                    try {
                        const targetUrl = f.url || f.publicUrl;
                        if (targetUrl && (targetUrl.includes('.pdf') || targetUrl.startsWith('data:application/pdf'))) {
                            const pdfjs = window.pdfjsLib;
                            if (pdfjs) {
                                const pdfDoc = await pdfjs.getDocument(targetUrl).promise;
                                for (let p = 1; p <= Math.min(pdfDoc.numPages, 4); p++) {
                                    const page = await pdfDoc.getPage(p);
                                    const tc = await page.getTextContent();
                                    const text = tc.items.map(it => it.str).join(' ');

                                    // ค้นหาค่าและ match ใส่ใน currentRows
                                    currentRows.forEach(row => {
                                        if (row.val) return; // ข้ามถ้ามีค่าแล้ว
                                        const cleanName = row.test.replace(/[\(\)\/\-]/g, '\\$&');
                                        const m = text.match(new RegExp(`${cleanName}\\s+(?:SER|WB|PLAS)?\\s*([<≤>≥]?\\s*[\\d\\.]+)`, 'i'));
                                        if (m && m[1]) {
                                            row.val = m[1].trim();
                                            extractedCount++;
                                        }
                                    });
                                }
                            }
                        }
                    } catch (fe) { }
                }

                renderTable();
                Swal.fire({
                    icon: 'success',
                    title: 'ດຶງຂໍ້ມູນສຳເລັດ',
                    text: `ລະບົບໄດ້ດຶງຄ່າຜົນກວດມາໃສ່ໃນຕາຕະລາງແລ້ວ ${extractedCount} ລາຍການ (ກະລຸນາກວດສອບຄວາມຖືກຕ້ອງກ່ອນບັນທຶກ)`,
                    confirmButtonText: 'ຕົກລົງ'
                });
            } catch (err) {
                console.error('Auto extract error:', err);
                Swal.fire('ຂໍ້ຜິດພາດ', 'ເກີດຂໍ້ຜິດພາດໃນການອ່ານໄຟລ໌: ' + err.message, 'error');
            }
        });
    }

    // 8. ปุ่ม "แปลงใส่ Frame (Recover Lab)"
    const btnConvert = document.getElementById('btnConvertFrame');
    if (btnConvert) {
        btnConvert.addEventListener('click', async () => {
            await saveData();
            setTimeout(() => {
                if (window.opener && typeof window.opener.runRecoverLabFromHistory === 'function') {
                    window.opener.runRecoverLabFromHistory(visitId, patientName);
                } else if (window.parent && typeof window.parent.runRecoverLabFromHistory === 'function') {
                    window.parent.runRecoverLabFromHistory(visitId, patientName);
                } else if (typeof window.convertLabResultWithFrame === 'function') {
                    window.convertLabResultWithFrame(visitId, patientName);
                } else {
                    alert('ບັນທຶກແລ້ວ! ທ່ານສາມາດກົດປຸ່ມ "ແປງຜົນໃສ່ Frame" ຈາກໜ້າປະຫວັດໄດ້ເລີຍ');
                }
            }, 300);
        });
    }

    // 9. ปุ่ม Print และ Clear
    const btnPrint = document.getElementById('btnPrint');
    if (btnPrint) {
        btnPrint.addEventListener('click', () => {
            window.print();
        });
    }

    const btnClear = document.getElementById('btnClear');
    if (btnClear) {
        btnClear.addEventListener('click', () => {
            if (confirm('ທ່ານແນ່ໃຈບໍ່ວ່າຕ້ອງການລ້າງຄ່າຜົນກວດ (Result) ທັງໝົດ?')) {
                currentRows.forEach(r => { r.val = ''; });
                renderTable();
            }
        });
    }

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
            if (el.readOnly || el.disabled || el.type === 'button') return;

            const tr = el.closest('tr');
            if (!tr) return;

            const table = tr.closest('table') || tr.closest('tbody');
            if (!table) return;

            const rows = Array.from(table.querySelectorAll('tr')).filter(r => {
                if (r.closest('thead') || r.classList.contains('category-row')) return false;
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
                    // Try to match matching class e.g. .result-input, .unit-input, .ref-input
                    for (const cls of ['result-input', 'unit-input', 'ref-input', 'type-input', 'test-input']) {
                        if (el.classList.contains(cls)) {
                            targetEl = nextTr.querySelector(`.${cls}:not([disabled]):not([readonly])`);
                            break;
                        }
                    }
                    if (!targetEl && nextInputs.length > 0) targetEl = nextInputs[Math.min(colIndex, nextInputs.length - 1)];
                }
            } else if (isUp) {
                if (rowIndex > 0) {
                    const prevTr = rows[rowIndex - 1];
                    const prevInputs = Array.from(prevTr.querySelectorAll('input:not([disabled]):not([readonly])'));
                    for (const cls of ['result-input', 'unit-input', 'ref-input', 'type-input', 'test-input']) {
                        if (el.classList.contains(cls)) {
                            targetEl = prevTr.querySelector(`.${cls}:not([disabled]):not([readonly])`);
                            break;
                        }
                    }
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
    initTableKeyboardNavigation();

})();
