// =====================================================
// other-lab.js — v2.0 (Dynamic Columns, Rows & Editable Titles)
// ລະບົບຈັດການຟອມບັນທຶກຜົນກວດວິເຄາະອື່ນໆ (Other Lab Report)
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

    // 🌟 ກວດສອບໂໝດ: ຖ້າເປີດຈາກປະຫວັດຄົນເຈັບ (history / print / view) ຫຼື ປ່ອງຢາ ໃຫ້ເປັນ Read-Only
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

    // ໂຄງສ້າງຖັນມາດຕະຖານ (Default Columns)
    const DEFAULT_COLUMNS = [
        { key: 'test', label: 'Tests (ລາຍການກວດ)', type: 'test' },
        { key: 'result', label: 'Result (ຜົນກວດ)', type: 'result' },
        { key: 'unit', label: 'Unit (ໜ່ວຍ)', type: 'unit' },
        { key: 'flag', label: 'Flags', type: 'flag' },
        { key: 'ref', label: 'Ref. / Notes (ຄ່າອ້າງອີງ/ໝາຍເຫດ)', type: 'ref' }
    ];

    let currentColumns = JSON.parse(JSON.stringify(DEFAULT_COLUMNS));
    let currentRows = [];

    // Helper: Supabase Client
    let sup = null;
    try {
        if (typeof supabase !== 'undefined' && typeof CONFIG !== 'undefined' && CONFIG.SUPABASE_URL && CONFIG.SUPABASE_KEY) {
            sup = supabase.createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_KEY);
        } else if (window.opener && window.opener._supabase) {
            sup = window.opener._supabase;
        } else if (window.parent && window.parent._supabase) {
            sup = window.parent._supabase;
        }
    } catch (e) {
        console.warn('Init Supabase error:', e);
    }

    // Helper: Format ວັນທີ
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
        toast.classList.add('show');
        setTimeout(() => {
            toast.classList.remove('show');
        }, 2200);
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

    // ຄຳນວນ Flag (Normal, High, Low, Positive, Negative)
    function computeFlag(val, ref) {
        if (!val || typeof val !== 'string') return { flag: '', css: '' };
        const vTrim = val.trim();
        const vLower = vTrim.toLowerCase();

        // 1. ເຊັກຂໍ້ຄວາມຄຸນນະພາບ (Qualitative)
        if (vLower === 'positive' || vLower === 'reactive' || vLower === 'pos' || vLower === '+') {
            return { flag: 'Positive', css: 'positive' };
        }
        if (vLower === 'negative' || vLower === 'non-reactive' || vLower === 'neg' || vLower === '-') {
            return { flag: 'Negative', css: 'normal' };
        }

        // 2. ເຊັກຄ່າຕົວເລກ (Quantitative)
        const num = parseFloat(vTrim.replace(/,/g, ''));
        if (isNaN(num) || !ref) return { flag: '', css: '' };

        const refTrim = ref.trim();

        // ແບບ "min - max"
        const rangeMatch = refTrim.match(/^([0-9.]+)\s*-\s*([0-9.]+)$/);
        if (rangeMatch) {
            const min = parseFloat(rangeMatch[1]);
            const max = parseFloat(rangeMatch[2]);
            if (num < min) return { flag: 'L', css: 'low' };
            if (num > max) return { flag: 'H', css: 'high' };
            return { flag: 'Normal', css: 'normal' };
        }

        // ແບບ "< max"
        const lessMatch = refTrim.match(/^<\s*([0-9.]+)$/);
        if (lessMatch) {
            const max = parseFloat(lessMatch[1]);
            if (num > max) return { flag: 'H', css: 'high' };
            return { flag: 'Normal', css: 'normal' };
        }

        // ແບບ "> min"
        const greaterMatch = refTrim.match(/^>\s*([0-9.]+)$/);
        if (greaterMatch) {
            const min = parseFloat(greaterMatch[1]);
            if (num < min) return { flag: 'L', css: 'low' };
            return { flag: 'Normal', css: 'normal' };
        }

        return { flag: '', css: '' };
    }

    // =====================================
    // 1. RENDER TABLE HEADERS (DYNAMIC COLUMNS)
    // =====================================
    function renderHeaders() {
        const headerRow = document.getElementById('otherLabHeaderRow');
        if (!headerRow) return;
        headerRow.innerHTML = '';

        currentColumns.forEach((col, cIdx) => {
            const th = document.createElement('th');
            th.dataset.colKey = col.key;
            th.dataset.colIndex = cIdx;

            let alignStyle = (col.type === 'flag') ? 'text-align: center;' : 'text-align: left;';
            th.style.cssText = alignStyle;

            th.innerHTML = `
                <div class="col-header-wrap">
                    <span class="col-title" contenteditable="${isReadOnlyMode ? 'false' : 'true'}" title="ຄລິກເພື່ອແກ້ໄຂຊື່ຖັນ (Click to Rename)">${escapeHtml(col.label)}</span>
                    ${(!isReadOnlyMode && currentColumns.length > 1) ? `
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
        actTh.style.cssText = 'width: 70px; text-align: center;';
        actTh.innerHTML = `<span style="font-size: 11px; color: #94a3b8;">ຈັດການ</span>`;
        headerRow.appendChild(actTh);

        attachHeaderEvents();
    }

    function attachHeaderEvents() {
        const headerRow = document.getElementById('otherLabHeaderRow');
        if (!headerRow) return;

        // ແກ້ໄຂຊື່ຫົວ Column
        headerRow.querySelectorAll('.col-title').forEach(titleSpan => {
            const th = titleSpan.closest('th');
            const colKey = th?.dataset?.colKey;

            titleSpan.addEventListener('blur', () => {
                const newLabel = titleSpan.innerText.trim();
                const targetCol = currentColumns.find(c => c.key === colKey);
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
                if (currentColumns.length <= 1) {
                    if (typeof Swal !== 'undefined') {
                        Swal.fire({
                            title: 'ແຈ້ງເຕືອນ',
                            text: 'ຕ້ອງມີຢ່າງໜ້ອຍ 1 Column!',
                            icon: 'info',
                            confirmButtonColor: '#0b3c73',
                            confirmButtonText: 'ຕົກລົງ'
                        });
                    } else {
                        showToast('ຕ້ອງມີຢ່າງໜ້ອຍ 1 Column!');
                    }
                    return;
                }
                const colToDelete = currentColumns.find(c => c.key === colKey);
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
                    currentColumns = currentColumns.filter(c => c.key !== colKey);
                    renderHeaders();
                    renderTable();
                    showToast(`ລຶບ Column "${colLabel}" ແລ້ວ`);
                }
            });
        });
    }

    // =====================================
    // 2. RENDER TABLE ROWS (DYNAMIC ROWS)
    // =====================================
    function renderTable() {
        const tbody = document.getElementById('otherLabBody');
        if (!tbody) return;
        tbody.innerHTML = '';

        if (currentRows.length === 0) {
            // ຄ່າເລີ່ມຕົ້ນ 4 ແຖວຫວ່າງ
            for (let i = 0; i < 4; i++) {
                const emptyRow = {};
                currentColumns.forEach(c => { emptyRow[c.key] = ''; });
                currentRows.push(emptyRow);
            }
        }

        currentRows.forEach((row, rIdx) => {
            const tr = document.createElement('tr');
            tr.dataset.index = rIdx;
            tr.className = (rIdx % 2 === 0) ? 'odd-row' : 'even-row';

            // ຄຳນວນ Flag (ຖ້າມີຄ່າຜົນກວດ ແລະ ຄ່າອ້າງອີງ)
            const flagInfo = computeFlag(row.result || row.val || '', row.ref || '');

            currentColumns.forEach(col => {
                const td = document.createElement('td');
                const val = row[col.key] !== undefined ? row[col.key] : '';

                if (col.type === 'flag') {
                    td.className = 'flag-cell';
                    td.style.textAlign = 'center';
                    let flagHtml = '-';
                    if (flagInfo.flag) {
                        flagHtml = `<span class="flag-badge ${flagInfo.css}">${flagInfo.flag}</span>`;
                    }
                    td.innerHTML = flagHtml;
                } else {
                    let inpClass = 'cell-input';
                    let listAttr = '';
                    let placeholderText = '...';

                    if (col.type === 'test') {
                        inpClass += ' test-input';
                        listAttr = 'list="suggestedTests"';
                        placeholderText = 'ພິມ ຫຼື ເລືອກລາຍການກວດ...';
                    } else if (col.type === 'result') {
                        inpClass += ' result-input';
                        placeholderText = 'ຜົນກວດ...';
                        if (flagInfo.css === 'high' || flagInfo.css === 'low' || flagInfo.css === 'positive') {
                            inpClass += ' is-abnormal';
                        } else if (flagInfo.css === 'normal' && (String(val).toLowerCase().includes('neg') || val === '-')) {
                            inpClass += ' is-negative';
                        }
                    } else if (col.type === 'unit') {
                        inpClass += ' unit-input';
                        placeholderText = 'ໜ່ວຍ...';
                    } else if (col.type === 'ref') {
                        inpClass += ' ref-input';
                        placeholderText = 'ຄ່າອ້າງອີງ/ໝາຍເຫດ...';
                    }

                    td.innerHTML = `
                        <input type="text" 
                               class="${inpClass}" 
                               data-col-key="${col.key}" 
                               ${listAttr} 
                               value="${escapeHtml(val)}" 
                               placeholder="${placeholderText}" 
                               ${isReadOnlyMode ? 'readonly tabindex="-1"' : ''}>
                    `;
                }
                tr.appendChild(td);
            });

            // ຖັນປຸ່ມຈັດການແຖວ (Actions)
            const actTd = document.createElement('td');
            actTd.className = 'no-print row-actions-cell';
            actTd.style.textAlign = 'center';
            actTd.innerHTML = `
                <div class="d-flex align-items-center justify-content-center gap-1">
                    <button type="button" class="btn-action-row btn-move-up" title="ຍ້າຍຂຶ້ນ (Move Up)" data-index="${rIdx}" ${rIdx === 0 ? 'disabled style="opacity:0.3;cursor:default;"' : ''}>
                        <i class="bi bi-chevron-up"></i>
                    </button>
                    <button type="button" class="btn-action-row btn-move-down" title="ຍ້າຍລົງ (Move Down)" data-index="${rIdx}" ${rIdx === currentRows.length - 1 ? 'disabled style="opacity:0.3;cursor:default;"' : ''}>
                        <i class="bi bi-chevron-down"></i>
                    </button>
                    <button type="button" class="btn-action-row btn-del-row" title="ລຶບແຖວນີ້ (Delete Row)" data-index="${rIdx}">
                        <i class="bi bi-trash3-fill"></i>
                    </button>
                </div>
            `;
            tr.appendChild(actTd);

            tbody.appendChild(tr);
        });

        attachRowEvents();
        if (isReadOnlyMode) applyReadOnlyMode();
    }

    // ຜູກ Events ໃຫ້ກັບຊ່ອງ Input ແລະ ປຸ່ມຈັດການແຖວ
    function attachRowEvents() {
        const tbody = document.getElementById('otherLabBody');
        if (!tbody) return;

        tbody.querySelectorAll('tr[data-index]').forEach(tr => {
            const rIdx = parseInt(tr.dataset.index, 10);

            // Input Event ທຸກໆຊ່ອງ
            tr.querySelectorAll('input.cell-input').forEach(inp => {
                const colKey = inp.dataset.colKey;
                inp.addEventListener('input', () => {
                    if (!currentRows[rIdx]) currentRows[rIdx] = {};
                    currentRows[rIdx][colKey] = inp.value;

                    // ຖ້າເປັນຊ່ອງ result ຫຼື ref ໃຫ້ອັບເດດ Flag ທັນທີ
                    const targetCol = currentColumns.find(c => c.key === colKey);
                    if (targetCol && (targetCol.type === 'result' || targetCol.type === 'ref')) {
                        const resultCol = currentColumns.find(c => c.type === 'result');
                        const refCol = currentColumns.find(c => c.type === 'ref');
                        const resVal = resultCol ? (currentRows[rIdx][resultCol.key] || '') : '';
                        const refVal = refCol ? (currentRows[rIdx][refCol.key] || '') : '';

                        const flagInfo = computeFlag(resVal, refVal);
                        const flagCell = tr.querySelector('.flag-cell');
                        if (flagCell) {
                            flagCell.innerHTML = flagInfo.flag ? `<span class="flag-badge ${flagInfo.css}">${flagInfo.flag}</span>` : '-';
                        }

                        const resInp = tr.querySelector('.result-input');
                        if (resInp) {
                            resInp.classList.remove('is-abnormal', 'is-negative');
                            if (flagInfo.css === 'high' || flagInfo.css === 'low' || flagInfo.css === 'positive') {
                                resInp.classList.add('is-abnormal');
                            } else if (flagInfo.css === 'normal' && (resVal.toLowerCase().includes('neg') || resVal === '-')) {
                                resInp.classList.add('is-negative');
                            }
                        }
                    }
                });
            });

            // ປຸ່ມຍ້າຍຂຶ້ນ
            const moveUpBtn = tr.querySelector('.btn-move-up');
            if (moveUpBtn) {
                moveUpBtn.addEventListener('click', () => {
                    if (rIdx > 0) {
                        const temp = currentRows[rIdx];
                        currentRows[rIdx] = currentRows[rIdx - 1];
                        currentRows[rIdx - 1] = temp;
                        renderTable();
                    }
                });
            }

            // ປຸ່ມຍ້າຍລົງ
            const moveDownBtn = tr.querySelector('.btn-move-down');
            if (moveDownBtn) {
                moveDownBtn.addEventListener('click', () => {
                    if (rIdx < currentRows.length - 1) {
                        const temp = currentRows[rIdx];
                        currentRows[rIdx] = currentRows[rIdx + 1];
                        currentRows[rIdx + 1] = temp;
                        renderTable();
                    }
                });
            }

            // ປຸ່ມລຶບແຖວ
            const delBtn = tr.querySelector('.btn-del-row');
            if (delBtn) {
                delBtn.addEventListener('click', () => {
                    if (currentRows.length <= 1) {
                        const emptyRow = {};
                        currentColumns.forEach(c => { emptyRow[c.key] = ''; });
                        currentRows[0] = emptyRow;
                    } else {
                        currentRows.splice(rIdx, 1);
                    }
                    renderTable();
                });
            }
        });
    }

    // =====================================
    // 3. EDITABLE TITLES & TOPICS
    // =====================================
    function getTitleValues() {
        return {
            title: document.getElementById('reportTitleText')?.innerText?.trim() || 'Laboratory Analysis Report',
            subtitle: document.getElementById('reportSubtitleText')?.innerText?.trim() || 'ໃບລາຍງານຜົນກວດວິເຄາະອື່ນໆ (Other & Specialized Laboratory Tests)',
            tag: document.getElementById('reportTagText')?.innerText?.trim() || 'OTHER LAB',
            sectionTitle: document.getElementById('sectionTitleText')?.innerText?.trim() || 'ລາຍການກວດວິເຄາະ (Test Items & Results)'
        };
    }

    function setTitleValues(titles) {
        if (!titles) return;
        if (titles.title && document.getElementById('reportTitleText')) {
            document.getElementById('reportTitleText').innerText = titles.title;
        }
        if (titles.subtitle && document.getElementById('reportSubtitleText')) {
            document.getElementById('reportSubtitleText').innerText = titles.subtitle;
        }
        if (titles.tag && document.getElementById('reportTagText')) {
            document.getElementById('reportTagText').innerText = titles.tag;
        }
        if (titles.sectionTitle && document.getElementById('sectionTitleText')) {
            document.getElementById('sectionTitleText').innerText = titles.sectionTitle;
        }
    }

    // =====================================
    // 4. LOAD SAVED DATA
    // =====================================
    async function loadSavedData() {
        document.getElementById('metaVisitId').innerText = visitId || '-';
        document.getElementById('metaHn').innerText = hn || '-';
        document.getElementById('metaPatientName').innerText = patientName || '-';
        document.getElementById('metaDate').innerText = formatLaoDate(new Date());

        let loadedPayload = null;

        // 1. ອ່ານຈາກ LocalStorage
        try {
            const raw = localStorage.getItem(`clinic_other_lab_${visitId}`);
            if (raw) {
                const parsed = JSON.parse(raw);
                if (parsed) loadedPayload = parsed;
            }
        } catch (e) { }

        // 2. ດຶງຈາກ Supabase visits table
        if (sup && visitId) {
            try {
                const { data: vRow } = await sup.from('visits').select('lab_note, hn, patient_name, patient_age, created_at').eq('visit_id', visitId).maybeSingle();
                if (vRow) {
                    if (vRow.hn && (!hn || hn === '-')) document.getElementById('metaHn').innerText = vRow.hn;
                    if (vRow.patient_name && (!patientName || patientName === '-')) document.getElementById('metaPatientName').innerText = vRow.patient_name;
                    if (vRow.patient_age) document.getElementById('metaAge').innerText = vRow.patient_age + ' ປີ';
                    if (vRow.created_at) document.getElementById('metaDate').innerText = formatLaoDate(vRow.created_at);

                    if (vRow.lab_note && vRow.lab_note.includes('[ผลตรวจ Other Lab]')) {
                        const m = vRow.lab_note.match(/\[ผลตรวจ Other Lab\]\s*([\s\S]*?)\s*\[\/ผลตรวจ Other Lab\]/);
                        if (m && m[1]) {
                            try {
                                const dbParsed = JSON.parse(m[1]);
                                if (dbParsed) {
                                    if (Array.isArray(dbParsed)) {
                                        loadedPayload = { items: dbParsed };
                                    } else if (typeof dbParsed === 'object') {
                                        loadedPayload = dbParsed;
                                    }
                                }
                            } catch (e) { }
                        }
                    }
                }
            } catch (dbErr) {
                console.warn('Load Other Lab DB warning:', dbErr);
            }
        }

        // ນຳຂໍ້ມູນທີ່ໂຫຼດໄດ້ມາກຳນົດຄ່າ
        if (loadedPayload) {
            // Restore Custom Titles
            if (loadedPayload.title || loadedPayload.subtitle || loadedPayload.tag || loadedPayload.sectionTitle) {
                setTitleValues(loadedPayload);
            }

            // Restore Custom Columns
            if (Array.isArray(loadedPayload.columns) && loadedPayload.columns.length > 0) {
                currentColumns = loadedPayload.columns;
            }

            // Restore Rows
            const items = loadedPayload.items || loadedPayload.rows;
            if (Array.isArray(items) && items.length > 0) {
                currentRows = items.map(it => {
                    const rowObj = {};
                    currentColumns.forEach(col => {
                        if (it[col.key] !== undefined) {
                            rowObj[col.key] = it[col.key];
                        } else if (col.type === 'result' && it.val !== undefined) {
                            rowObj[col.key] = it.val;
                        } else if (col.type === 'test' && it.name !== undefined) {
                            rowObj[col.key] = it.name;
                        } else if (col.type === 'ref' && it.reference !== undefined) {
                            rowObj[col.key] = it.reference;
                        } else {
                            rowObj[col.key] = '';
                        }
                    });
                    return rowObj;
                });
            }
        }

        renderHeaders();
        renderTable();
    }

    // =====================================
    // 5. SAVE DATA
    // =====================================
    async function saveData() {
        if (isReadOnlyMode) return;

        // ເກັບຂໍ້ມູນແຖວ
        const items = [];
        const tbody = document.getElementById('otherLabBody');
        if (tbody) {
            const trs = tbody.querySelectorAll('tr[data-index]');
            trs.forEach(tr => {
                const rIdx = parseInt(tr.dataset.index, 10);
                const rowData = currentRows[rIdx] || {};
                
                // ກວດສອບວ່າມີຂໍ້ມູນໃນແຖວບໍ່
                const hasContent = Object.values(rowData).some(v => v && String(v).trim() !== '');
                if (hasContent) {
                    // ເພີ່ມ Flag ທີ່ຄຳນວນໄດ້
                    const resultCol = currentColumns.find(c => c.type === 'result');
                    const refCol = currentColumns.find(c => c.type === 'ref');
                    const flagInfo = computeFlag(resultCol ? rowData[resultCol.key] : '', refCol ? rowData[refCol.key] : '');
                    
                    const itemObj = Object.assign({}, rowData, {
                        flag: flagInfo.flag || '',
                        // ຮັກສາ key ມາດຕະຖານໄວ້ເພື່ອ backward compatibility
                        test: rowData.test || rowData[currentColumns[0]?.key] || '',
                        result: rowData.result || rowData[currentColumns[1]?.key] || '',
                        unit: rowData.unit || '',
                        ref: rowData.ref || ''
                    });
                    items.push(itemObj);
                }
            });
        }

        const titleData = getTitleValues();

        const payload = Object.assign({
            visitId,
            hn,
            patientName,
            savedAt: new Date().toISOString(),
            columns: currentColumns,
            items: items
        }, titleData);

        const storageKey = `clinic_other_lab_${visitId}`;

        // ກ. LocalStorage
        try {
            localStorage.setItem(storageKey, JSON.stringify(payload));

            let allOther = {};
            try { allOther = JSON.parse(localStorage.getItem('clinic_other_lab_results') || '{}'); } catch (e) { }
            allOther[visitId] = payload;
            allOther[String(visitId).replace('VIS-', '')] = payload;
            localStorage.setItem('clinic_other_lab_results', JSON.stringify(allOther));

            // ອັບເດດ clinic_lab_files_meta
            if (visitId) {
                let metaMap = {};
                try { metaMap = JSON.parse(localStorage.getItem('clinic_lab_files_meta') || '{}'); } catch (e) { }
                let visitMetaList = Array.isArray(metaMap[visitId]) ? metaMap[visitId] : [];
                visitMetaList = visitMetaList.filter(f => f && f.category !== 'Other Lab' && f.category !== 'ຜົນກວດອື່ນໆ');
                visitMetaList.push({
                    id: `FILE-OTHERLAB-${visitId}`,
                    visitId: visitId,
                    fileName: `Other_Lab_Report_${visitId}.pdf`,
                    fileType: 'application/pdf',
                    category: 'Other Lab',
                    updatedAt: new Date().toISOString()
                });
                metaMap[visitId] = visitMetaList;
                localStorage.setItem('clinic_lab_files_meta', JSON.stringify(metaMap));
            }
        } catch (e) { console.warn('Save LocalStorage error:', e); }

        // ຂ. Cloud Supabase
        if (sup && visitId) {
            try {
                const { data: exVisit } = await sup.from('visits').select('pdf_url, lab_note').eq('visit_id', visitId).maybeSingle();
                const otherLabPayload = `[ผลตรวจ Other Lab]\n${JSON.stringify(payload)}\n[/ผลตรวจ Other Lab]`;
                let newLabNote = otherLabPayload;
                if (exVisit && exVisit.lab_note) {
                    if (exVisit.lab_note.includes('[ผลตรวจ Other Lab]')) {
                        newLabNote = exVisit.lab_note.replace(/\[ผลตรวจ Other Lab\][\s\S]*?\[\/ผลตรวจ Other Lab\]/, otherLabPayload);
                        if (!newLabNote.includes('[/ผลตรวจ Other Lab]')) {
                            newLabNote = exVisit.lab_note.replace(/\[ผลตรวจ Other Lab\]/, otherLabPayload);
                        }
                    } else {
                        newLabNote = `${exVisit.lab_note}\n\n${otherLabPayload}`;
                    }
                }

                // ຈັດການ pdf_url
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
                currentPdfFiles = currentPdfFiles.filter(f => f && f.category !== 'Other Lab' && f.category !== 'ຜົນກວດອື່ນໆ' && (!f.fileName || !f.fileName.includes('Other_Lab_Report_')));
                currentPdfFiles.push({
                    id: `FILE-OTHERLAB-${visitId}`,
                    visitId: visitId,
                    fileName: `Other_Lab_Report_${visitId}.pdf`,
                    fileType: 'application/pdf',
                    category: 'Other Lab',
                    url: `otherlab:${visitId}`,
                    publicUrl: `otherlab:${visitId}`,
                    updatedAt: new Date().toISOString()
                });

                await sup.from('visits').update({
                    lab_note: newLabNote,
                    pdf_url: JSON.stringify(currentPdfFiles)
                }).eq('visit_id', visitId);
            } catch (err) {
                console.warn('Save Other Lab Supabase error:', err);
            }
        }

        showToast('ບັນທຶກຜົນກວດຮຽບຮ້ອຍແລ້ວ!');
        if (typeof Swal !== 'undefined') {
            await Swal.fire({
                icon: 'success',
                title: 'ບັນທຶກສຳເລັດ',
                text: 'ບັນທຶກຜົນກວດ ແລະ ໂຄງສ້າງຕາຕະລາງຮຽບຮ້ອຍແລ້ວ',
                timer: 1200,
                showConfirmButton: false
            });
        }

        // 🌟 ປິດ Modal/ຟອມ ແລະ ກັບສູ່ໜ້າຫຼັກຄລີນິກທັນທີ
        setTimeout(() => {
            if (window.parent && window.parent !== window) {
                // 1. ສັ່ງປິດ Modal ໃນໜ້າ Parent
                if (typeof window.parent.closeOtherLabModal === 'function') {
                    window.parent.closeOtherLabModal();
                } else {
                    const pOtherModal = window.parent.document?.getElementById('otherLabModal');
                    if (pOtherModal && typeof window.parent.bootstrap !== 'undefined') {
                        const mInst = window.parent.bootstrap.Modal.getInstance(pOtherModal) || window.parent.bootstrap.Modal.getOrCreateInstance(pOtherModal);
                        if (mInst) mInst.hide();
                    }
                }
                // 2. Refresh ຕາຕະລາງຄິວ ແລະ ຕາຕະລາງແລັບໃນໜ້າ Parent
                if (typeof window.parent.loadLabQueue === 'function') window.parent.loadLabQueue();
                if (typeof window.parent.renderLabTable === 'function') window.parent.renderLabTable();
                if (typeof window.parent.renderPatientHistoryModal === 'function') window.parent.renderPatientHistoryModal();
            } else if (window.opener) {
                // ຖ້າເປີດໃນແທັບໃໝ່
                try {
                    if (typeof window.opener.loadLabQueue === 'function') window.opener.loadLabQueue();
                    if (typeof window.opener.renderLabTable === 'function') window.opener.renderLabTable();
                    if (typeof window.opener.renderPatientHistoryModal === 'function') window.opener.renderPatientHistoryModal();
                } catch (e) { }
                window.close();
            }
        }, 300);
    }

    // =====================================
    // 6. EVENT LISTENERS
    // =====================================
    const btnSave = document.getElementById('btnSave');
    if (btnSave) btnSave.addEventListener('click', saveData);

    // ປຸ່ມເພີ່ມ Column ໃໝ່
    const btnAddCol = document.getElementById('btnAddCol');
    if (btnAddCol) {
        btnAddCol.addEventListener('click', async () => {
            let colName = '';
            if (typeof Swal !== 'undefined') {
                const { value: text } = await Swal.fire({
                    title: 'ເພີ່ມ Column ໃໝ່ (Add Column)',
                    input: 'text',
                    inputLabel: 'ຊື່ຫົວຂໍ້ Column:',
                    inputPlaceholder: 'ຕົວຢ່າງ: Method, Specimen, ໝາຍເຫດ...',
                    showCancelButton: true,
                    confirmButtonText: 'ເພີ່ມ (Add)',
                    cancelButtonText: 'ຍົກເລີກ',
                    inputValidator: (value) => {
                        if (!value || !value.trim()) {
                            return 'ກະລຸນາປ້ອນຊື່ Column!';
                        }
                    }
                });
                colName = text ? text.trim() : '';
            } else {
                colName = prompt('ປ້ອນຊື່ Column ໃໝ່:');
            }

            if (colName) {
                const newColKey = 'col_' + Date.now();
                currentColumns.push({
                    key: newColKey,
                    label: colName,
                    type: 'text'
                });
                // ເພີ່ມ field ໃຫ້ທຸກໆແຖວທີ່ມີຢູ່
                currentRows.forEach(r => {
                    r[newColKey] = '';
                });
                renderHeaders();
                renderTable();
                showToast(`ເພີ່ມ Column "${colName}" ຮຽບຮ້ອຍແລ້ວ`);
            }
        });
    }

    // ປຸ່ມ Reset Column ຄືນຄ່າມາດຕະຖານ
    const btnResetCols = document.getElementById('btnResetCols');
    if (btnResetCols) {
        btnResetCols.addEventListener('click', async () => {
            let confirmed = false;
            if (typeof Swal !== 'undefined') {
                const res = await Swal.fire({
                    title: 'ຄືນຄ່າຖັນມາດຕະຖານ?',
                    text: 'ທ່ານແນ່ໃຈບໍ່ວ່າຕ້ອງການຄືນຄ່າ Column ມາດຕະຖານ (5 ຖັນເດີມ)?',
                    icon: 'question',
                    showCancelButton: true,
                    confirmButtonColor: '#0b3c73',
                    cancelButtonColor: '#64748b',
                    confirmButtonText: '<i class="bi bi-arrow-counterclockwise me-1"></i> ຄືນຄ່າມາດຕະຖານ',
                    cancelButtonText: 'ຍົກເລີກ',
                    reverseButtons: true
                });
                confirmed = res.isConfirmed;
            } else {
                confirmed = confirm('ທ່ານແນ່ໃຈບໍ່ວ່າຕ້ອງການຄືນຄ່າ Column ມາດຕະຖານ (5 ຖັນເດີມ)?');
            }

            if (confirmed) {
                currentColumns = JSON.parse(JSON.stringify(DEFAULT_COLUMNS));
                renderHeaders();
                renderTable();
                showToast('ຄືນຄ່າ Column ມາດຕະຖານແລ້ວ');
            }
        });
    }

    // ປຸ່ມເພີ່ມແຖວໃໝ່
    const btnAddRow = document.getElementById('btnAddRow');
    if (btnAddRow) {
        btnAddRow.addEventListener('click', () => {
            const newRow = {};
            currentColumns.forEach(c => { newRow[c.key] = ''; });
            currentRows.push(newRow);
            renderTable();

            // Focus ໃສ່ຊ່ອງທຳອິດຂອງແຖວໃໝ່
            const lastTr = document.querySelector('#otherLabBody tr:last-child');
            if (lastTr) {
                const firstInp = lastTr.querySelector('input.cell-input');
                if (firstInp) firstInp.focus();
            }
        });
    }

    // ປຸ່ມ Print
    const btnPrint = document.getElementById('btnPrint');
    if (btnPrint) {
        btnPrint.addEventListener('click', () => {
            window.print();
        });
    }

    // ປຸ່ມ Clear
    const btnClear = document.getElementById('btnClear');
    if (btnClear) {
        btnClear.addEventListener('click', async () => {
            let confirmed = false;
            if (typeof Swal !== 'undefined') {
                const res = await Swal.fire({
                    title: 'ຢືນຢັນການລ້າງຄ່າ?',
                    text: 'ທ່ານແນ່ໃຈບໍ່ວ່າຕ້ອງການລ້າງຄ່າຜົນກວດທັງໝົດ?',
                    icon: 'warning',
                    showCancelButton: true,
                    confirmButtonColor: '#dc2626',
                    cancelButtonColor: '#64748b',
                    confirmButtonText: '<i class="bi bi-trash3-fill me-1"></i> ລ້າງຄ່າທັງໝົດ',
                    cancelButtonText: 'ຍົກເລີກ',
                    reverseButtons: true
                });
                confirmed = res.isConfirmed;
            } else {
                confirmed = confirm('ທ່ານແນ່ໃຈບໍ່ວ່າຕ້ອງການລ້າງຄ່າຜົນກວດທັງໝົດ?');
            }

            if (confirmed) {
                currentRows = [];
                for (let i = 0; i < 4; i++) {
                    const emptyRow = {};
                    currentColumns.forEach(c => { emptyRow[c.key] = ''; });
                    currentRows.push(emptyRow);
                }
                renderTable();
                showToast('ລ້າງຄ່າຜົນກວດທັງໝົດແລ້ວ');
            }
        });
    }

    // ປຸ່ມດຶງຈາກໄຟລ໌ເດີມ
    const btnAutoExtract = document.getElementById('btnAutoExtract');
    if (btnAutoExtract) {
        btnAutoExtract.addEventListener('click', async () => {
            if (!visitId) {
                Swal.fire('ແຈ້ງເຕືອນ', 'ບໍ່ພົບລະຫັດ Visit ສຳລັບດຶງໄຟລ໌', 'info');
                return;
            }
            Swal.fire('ແຈ້ງເຕືອນ', 'ກະລຸນາປ້ອນຂໍ້ມູນລາຍການກວດ ຫຼື ເລືອກຈາກລາຍການແນະນຳ', 'info');
        });
    }

    // =====================================
    // 7. READONLY MODE APPLICATION
    // =====================================
    function applyReadOnlyMode() {
        if (!isReadOnlyMode) return;
        document.documentElement.classList.add('readonly-mode');
        if (document.body) document.body.classList.add('readonly-mode');

        const hideIds = ['btnSave', 'btnClear', 'btnAutoExtract', 'btnAddCol', 'btnResetCols', 'btnAddRow'];
        hideIds.forEach(id => {
            const el = document.getElementById(id);
            if (el) {
                el.style.setProperty('display', 'none', 'important');
                el.style.setProperty('visibility', 'hidden', 'important');
                el.style.setProperty('pointer-events', 'none', 'important');
                try { el.remove(); } catch (e) { }
            }
        });

        // ປິດ contenteditable ຫົວຂໍ້ທຸກອັນ
        document.querySelectorAll('.editable-title, .col-title').forEach(el => {
            el.setAttribute('contenteditable', 'false');
            el.style.setProperty('cursor', 'default', 'important');
            el.style.setProperty('pointer-events', 'none', 'important');
        });

        // ລັອກຊ່ອງ Input ທັງໝົດ
        document.querySelectorAll('#otherLabTable input').forEach(inp => {
            inp.readOnly = true;
            inp.setAttribute('readonly', 'readonly');
            inp.setAttribute('tabindex', '-1');
            inp.style.setProperty('pointer-events', 'none', 'important');
            inp.style.setProperty('background-color', '#f8fafc', 'important');
            inp.style.setProperty('cursor', 'default', 'important');
        });

        // ເຊື່ອງປຸ່ມຈັດການແຖວ
        document.querySelectorAll('.btn-action-row, .btn-del-col').forEach(btn => {
            btn.style.setProperty('display', 'none', 'important');
            try { btn.remove(); } catch (e) { }
        });

        const lastTh = document.querySelector('#otherLabHeaderRow th:last-child');
        if (lastTh) lastTh.style.setProperty('display', 'none', 'important');

        document.querySelectorAll('#otherLabBody tr td:last-child').forEach(td => {
            td.style.setProperty('display', 'none', 'important');
        });
    }

    if (isReadOnlyMode) {
        applyReadOnlyMode();
        document.addEventListener('DOMContentLoaded', applyReadOnlyMode);
        window.addEventListener('load', applyReadOnlyMode);
    }

    // ເລີ່ມໂຫຼດຂໍ້ມູນ
    loadSavedData();

})();
