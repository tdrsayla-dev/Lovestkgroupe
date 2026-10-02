'use strict';

(function () {
    const params = new URLSearchParams(window.location.search);
    const visitId = params.get('visit_id') || params.get('visitId') || '';
    const hn = params.get('hn') || '';
    const patientName = params.get('name') || params.get('patient_name') || '';
    const mode = params.get('mode') || 'lab';

    const form = document.getElementById('report');
    const inputs = [...form.querySelectorAll('input')];

    // 🌟 ตรวจสอบโหมด: หากเปิดจากหน้าประวัติผู้ป่วย (history / print) ให้ซ่อนปุ่ม บันทึก (Save) และ Clear
    let isReadOnlyMode = (mode === 'print' || mode === 'history' || mode === 'view');
    try {
        if (!isReadOnlyMode && window.parent && window.parent !== window) {
            const pHistModal = window.parent.document.getElementById('patientHistoryModal');
            if (pHistModal && (pHistModal.classList.contains('show') || pHistModal.style.display === 'block')) {
                isReadOnlyMode = true;
            }
            const pRxModal = window.parent.document.getElementById('prescribeModal');
            if (pRxModal && (pRxModal.classList.contains('show') || pRxModal.style.display === 'block')) {
                isReadOnlyMode = true;
            }
        }
    } catch (e) { }

    if (isReadOnlyMode) {
        const saveBtn = document.getElementById('save');
        if (saveBtn) saveBtn.style.display = 'none';

        const clearBtn = document.getElementById('clear');
        if (clearBtn) clearBtn.style.display = 'none';

        inputs.forEach(input => {
            input.readOnly = true;
            input.setAttribute('readonly', 'readonly');
        });
    }

    // 1. แสดงข้อมูลผู้ป่วยในแถบข้อมูล
    const metaVisitEl = document.getElementById('metaVisitId');
    const metaHnEl = document.getElementById('metaHn');
    const metaNameEl = document.getElementById('metaPatientName');
    const metaDateEl = document.getElementById('metaDate');

    function formatLaoDate(dateObj) {
        const d = dateObj ? new Date(dateObj) : new Date();
        if (isNaN(d.getTime())) return '-';
        const laoMonths = ['ມັງກອນ', 'ກຸມພາ', 'ມີນາ', 'ເມສາ', 'ພຶດສະພາ', 'ມິຖຸນາ', 'ກໍລະກົດ', 'ສິງຫາ', 'ກັນຍາ', 'ຕຸລາ', 'ພະຈິກ', 'ທັນວາ'];
        return `${d.getDate()} ${laoMonths[d.getMonth()]} ${d.getFullYear()}`;
    }

    if (metaVisitEl) metaVisitEl.textContent = visitId || '-';
    if (metaHnEl) metaHnEl.textContent = hn || '-';
    if (metaNameEl) metaNameEl.textContent = patientName || '-';
    if (metaDateEl) metaDateEl.textContent = formatLaoDate(new Date());

    // 2. จัดการเชื่อมต่อ Supabase
    let sup = null;
    try {
        if (typeof supabase !== 'undefined') {
            const url = (typeof CONFIG !== 'undefined' && CONFIG.SUPABASE_URL) || window.SUPABASE_URL || (typeof CONFIG !== 'undefined' && CONFIG.supabase && CONFIG.supabase.url);
            const key = (typeof CONFIG !== 'undefined' && CONFIG.SUPABASE_ANON_KEY) || window.SUPABASE_ANON_KEY || (typeof CONFIG !== 'undefined' && CONFIG.supabase && CONFIG.supabase.anonKey);
            if (url && key) {
                sup = supabase.createClient(url, key);
            }
        }
        if (!sup) {
            try {
                if (window.opener && window.opener._supabase) {
                    sup = window.opener._supabase;
                } else if (window.parent && window.parent !== window && window.parent._supabase) {
                    sup = window.parent._supabase;
                }
            } catch (frameErr) { }
        }
    } catch (e) {
        console.warn('Supabase init warning:', e);
    }

    const storageKey = 'stk-urine-report:' + (visitId || 'default');

    // 3. โหลดผลตรวจเดิมที่เคยบันทึกไว้
    async function loadSavedData() {
        let loadedValues = null;

        // ลองโหลดจาก LocalStorage ก่อน
        try {
            const raw = localStorage.getItem(storageKey);
            if (raw) {
                const parsed = JSON.parse(raw);
                if (parsed && parsed.values) loadedValues = parsed.values;
            }
        } catch (e) { }

        // ดึงจาก Supabase visits.lab_note เพื่อให้ตรงกันข้ามเครื่อง
        if (sup && visitId) {
            try {
                const { data: vRow } = await sup.from('visits').select('lab_note, hn, patient_name, created_at').eq('visit_id', visitId).maybeSingle();
                if (vRow) {
                    if (vRow.hn && (!hn || hn === '-') && metaHnEl) metaHnEl.textContent = vRow.hn;
                    if (vRow.patient_name && (!patientName || patientName === '-') && metaNameEl) metaNameEl.textContent = vRow.patient_name;
                    if (vRow.created_at && metaDateEl) metaDateEl.textContent = formatLaoDate(vRow.created_at);

                    if (vRow.lab_note && vRow.lab_note.includes('[ผลตรวจ Urine]')) {
                        const match = vRow.lab_note.match(/\[ผลตรวจ Urine\]\s*([\s\S]*?)\s*\[\/ผลตรวจ Urine\]/);
                        if (match && match[1]) {
                            try {
                                const dbValues = JSON.parse(match[1]);
                                if (dbValues && typeof dbValues === 'object') {
                                    loadedValues = dbValues;
                                }
                            } catch (e) { }
                        }
                    }
                }
            } catch (dbErr) {
                console.warn('Load Urine from DB error:', dbErr);
            }
        }

        if (loadedValues) {
            inputs.forEach(input => {
                if (typeof loadedValues[input.id] === 'string') {
                    input.value = loadedValues[input.id];
                }
            });
        }
    }

    loadSavedData();

    form.addEventListener('submit', event => event.preventDefault());

    // 4. บันทึกผลตรวจ
    const saveBtn = document.getElementById('save');
    if (saveBtn) {
        saveBtn.addEventListener('click', async () => {
            const values = Object.fromEntries(inputs.map(input => [input.id, input.value]));

            // ก. บันทึกลง LocalStorage
            try {
                localStorage.setItem(storageKey, JSON.stringify({
                    values,
                    visitId,
                    hn,
                    patientName,
                    savedAt: new Date().toISOString()
                }));

                // อัปเดตรายการไฟล์ใน clinic_lab_files_meta
                if (visitId) {
                    let metaMap = {};
                    try {
                        metaMap = JSON.parse(localStorage.getItem('clinic_lab_files_meta') || '{}');
                    } catch (e) { }
                    let visitMetaList = Array.isArray(metaMap[visitId]) ? metaMap[visitId] : [];
                    visitMetaList = visitMetaList.filter(f => f && f.category !== 'Urine');
                    visitMetaList.push({
                        id: `FILE-URINE-${visitId}`,
                        visitId: visitId,
                        fileName: `Urine_Report_${visitId}.pdf`,
                        fileType: 'application/pdf',
                        category: 'Urine',
                        updatedAt: new Date().toISOString()
                    });
                    metaMap[visitId] = visitMetaList;
                    localStorage.setItem('clinic_lab_files_meta', JSON.stringify(metaMap));
                }
            } catch (err) {
                console.error('Save to LocalStorage error:', err);
            }

            // ข. บันทึกลง Cloud Supabase (visits.lab_note และ visits.pdf_url)
            if (sup && visitId) {
                try {
                    const { data: exVisit } = await sup.from('visits').select('pdf_url, lab_note').eq('visit_id', visitId).maybeSingle();
                    const urinePayload = `[ผลตรวจ Urine]\n${JSON.stringify(values)}\n[/ผลตรวจ Urine]`;
                    let newLabNote = urinePayload;
                    if (exVisit && exVisit.lab_note) {
                        if (exVisit.lab_note.includes('[ผลตรวจ Urine]')) {
                            newLabNote = exVisit.lab_note.replace(/\[ผลตรวจ Urine\][\s\S]*?\[\/ผลตรวจ Urine\]/, urinePayload);
                            if (!newLabNote.includes('[/ผลตรวจ Urine]')) {
                                newLabNote = exVisit.lab_note.replace(/\[ผลตรวจ Urine\]/, urinePayload);
                            }
                        } else {
                            newLabNote = `${exVisit.lab_note}\n\n${urinePayload}`;
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

                    // ลบ Urine เก่าออก แล้วเพิ่มรายการใหม่
                    currentPdfFiles = currentPdfFiles.filter(f => f && f.category !== 'Urine' && (!f.fileName || !f.fileName.includes('Urine_Report_')));
                    currentPdfFiles.push({
                        id: `FILE-URINE-${visitId}`,
                        visitId: visitId,
                        fileName: `Urine_Report_${visitId}.pdf`,
                        fileType: 'application/pdf',
                        category: 'Urine',
                        url: `urine:${visitId}`,
                        publicUrl: `urine:${visitId}`,
                        updatedAt: new Date().toISOString()
                    });

                    await sup.from('visits').update({
                        lab_note: newLabNote,
                        pdf_url: JSON.stringify(currentPdfFiles)
                    }).eq('visit_id', visitId);
                } catch (dbErr) {
                    console.warn('Sync Urine to Supabase error:', dbErr);
                }
            }

            // ค. แจ้งเตือนหน้าหลักคลินิกให้รีเฟรชตาราง และปิด Pop-up ทันที
            const targetHost = window.opener || (window.parent && window.parent !== window ? window.parent : null);
            if (targetHost) {
                // 1. ส่ง postMessage ข้ามหน้าต่างอย่างปลอดภัย (รองรับทุก Origin และ file:///)
                try {
                    if (typeof targetHost.postMessage === 'function') {
                        targetHost.postMessage({ type: 'URINE_SAVED', visitId: visitId }, '*');
                    }
                } catch (pe) { }

                // 2. หากอยู่ใน Origin เดียวกัน ลองเรียกคำสั่งรีเฟรชและปิด Modal โดยตรง
                try {
                    if (typeof targetHost.renderLabTable === 'function') targetHost.renderLabTable();
                    if (typeof targetHost.filterLabTable === 'function') targetHost.filterLabTable();
                    if (typeof targetHost.loadLabQueue === 'function') targetHost.loadLabQueue();
                    if (typeof targetHost.loadVisits === 'function') targetHost.loadVisits();
                    if (typeof targetHost.closeUrineModal === 'function') {
                        targetHost.closeUrineModal();
                    } else if (targetHost.document && targetHost.bootstrap) {
                        const mEl = targetHost.document.getElementById('urineLabModal');
                        if (mEl) {
                            const inst = targetHost.bootstrap.Modal.getInstance(mEl);
                            if (inst) inst.hide();
                        }
                    }
                } catch (e) {
                    // ละเว้น SecurityError เมื่อทำงานภายใต้ file:/// หรือ cross-origin iframe
                }
            }

            // หากเปิดในหน้าต่างแยกเดี่ยว (Standalone window) ให้ปิดหน้าต่างทันที
            if (window.opener && window.opener !== window) {
                window.close();
            }

            // แสดงแจ้งเตือนผลการบันทึกสำเร็จ (ปลอดภัย ไม่ติด SecurityError)
            let alertHost = null;
            try {
                if (targetHost && targetHost.Swal) alertHost = targetHost.Swal;
            } catch (se) { }
            if (!alertHost && typeof Swal !== 'undefined') alertHost = Swal;

            if (alertHost) {
                alertHost.fire({
                    icon: 'success',
                    title: 'ບັນທຶກສຳເລັດ',
                    text: 'ບັນທຶກຜົນກວດ Urine ເຂົ້າສູ່ລະບົບຮຽບຮ້ອຍແລ້ວ',
                    timer: 1600,
                    showConfirmButton: false
                });
            } else {
                alert('ບັນທຶກຜົນກວດ Urine ສຳເລັດຮຽບຮ້ອຍແລ້ວ');
            }
        });
    }

    // 5. ปุ่ม Clear (ล้างเฉพาะคอลัมน์ Result / ผลตรวจ โดยคงค่า Reference range ไว้)
    const clearBtn = document.getElementById('clear');
    if (clearBtn) {
        clearBtn.addEventListener('click', () => {
            inputs.forEach(input => {
                if (/^result\d+$/.test(input.id)) input.value = '';
            });
            const firstResult = document.getElementById('result0');
            if (firstResult && !firstResult.readOnly) firstResult.focus();
        });
    }

    // 6. ปุ่ม Print
    const printBtn = document.getElementById('print');
    if (printBtn) {
        printBtn.addEventListener('click', () => window.print());
    }

    function loadHtml2Pdf() {
        if (typeof html2pdf !== 'undefined') return Promise.resolve(window.html2pdf);
        return new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js';
            script.onload = () => resolve(window.html2pdf);
            script.onerror = reject;
            document.head.appendChild(script);
        });
    }

    // 7. ปุ่ม Download (PDF)
    const downloadBtn = document.getElementById('download');
    if (downloadBtn) {
        downloadBtn.addEventListener('click', async () => {
            if (typeof Swal !== 'undefined') {
                Swal.fire({
                    title: 'ກຳລັງສ້າງໄຟລ໌ PDF...',
                    text: 'ກະລຸນາລໍຖ້າสักครู่ ລະບົບກຳລັງສ້າງເອກະສານ PDF ຜົນກວດ Urine',
                    allowOutsideClick: false,
                    didOpen: () => { Swal.showLoading(); }
                });
            }

            try {
                await loadHtml2Pdf();

                const paper = document.querySelector('.paper');
                if (!paper) throw new Error('Paper element not found');

                // สร้าง clone ของกระดาษตรวจ
                const clone = paper.cloneNode(true);
                clone.style.width = '100%';
                clone.style.minHeight = 'auto';
                clone.style.maxWidth = '100%';
                clone.style.margin = '0';
                clone.style.padding = '0';
                clone.style.boxShadow = 'none';
                clone.style.border = '1px solid #dce8f7';
                clone.style.borderRadius = '14px';
                clone.style.overflow = 'hidden';
                clone.style.boxSizing = 'border-box';
                clone.style.background = '#ffffff';
                clone.style.fontFamily = "'Noto Sans Lao', system-ui, -apple-system, sans-serif";

                // ปรับแต่ง padding ภายใน clone ให้พอดี สวยงาม และไม่ชิดขอบเกินไป
                const headingEl = clone.querySelector('.heading');
                if (headingEl) {
                    headingEl.style.padding = '24px 28px 20px';
                }

                const metaBarEl = clone.querySelector('#patientMetaBar');
                if (metaBarEl) {
                    metaBarEl.style.padding = '10px 24px';
                    metaBarEl.style.gap = '16px';
                    metaBarEl.style.fontSize = '12px';
                }

                const formEl = clone.querySelector('form');
                if (formEl) {
                    formEl.style.padding = '16px 24px 22px';
                }

                // แทนที่ input ในตารางด้วยค่า text เพื่อความคมชัดใน PDF
                const origInputs = paper.querySelectorAll('input');
                const cloneInputs = clone.querySelectorAll('input');
                cloneInputs.forEach((inp, i) => {
                    const span = document.createElement('span');
                    span.textContent = origInputs[i]?.value || inp.value || '-';
                    span.style.display = 'block';
                    span.style.padding = '3px 4px';
                    span.style.fontSize = '12px';
                    span.style.fontWeight = inp.id.startsWith('result') ? '700' : '400';
                    span.style.color = inp.id.startsWith('result') ? '#174b99' : '#334155';
                    inp.parentNode.replaceChild(span, inp);
                });

                // กล่อง wrapper ขนาดกว้าง 190mm (พอดีกับความกว้างกระดาษ A4: 210mm หักขอบข้างละ 10mm)
                const wrapper = document.createElement('div');
                wrapper.style.position = 'fixed';
                wrapper.style.left = '-9999px';
                wrapper.style.top = '0';
                wrapper.style.width = '190mm';
                wrapper.style.boxSizing = 'border-box';
                wrapper.style.background = '#ffffff';
                wrapper.style.padding = '0';
                wrapper.appendChild(clone);
                document.body.appendChild(wrapper);

                const fileName = `Urine_Report_${visitId || 'Report'}.pdf`;
                const opt = {
                    margin: [10, 10, 10, 10],
                    filename: fileName,
                    image: { type: 'jpeg', quality: 0.98 },
                    html2canvas: { 
                        scale: 2, 
                        useCORS: true, 
                        logging: false,
                        scrollX: 0,
                        scrollY: 0
                    },
                    jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
                    pagebreak: { mode: ['avoid-all'] }
                };

                await html2pdf().set(opt).from(clone).save();

                if (wrapper.parentNode) {
                    wrapper.parentNode.removeChild(wrapper);
                }
                if (typeof Swal !== 'undefined') {
                    Swal.close();
                }
            } catch (err) {
                console.error('PDF export error:', err);
                if (typeof Swal !== 'undefined') {
                    Swal.close();
                }
                // Fallback ให้สั่งพิมพ์ผ่านเบราว์เซอร์เพื่อบันทึกเป็น PDF
                window.print();
            }
        });
    }
})();
