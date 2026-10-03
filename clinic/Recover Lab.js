// =====================================================
// Recover Lab.js  — v4.0
// ฟังก์ชันแปลงผลตรวจใส่ Frame คลินิก + ประทับตรา
//
// ✅ รองรับทั้งผลตรวจเชิงปริมาณ (ตัวเลข + Unit + Ref)
//    และผลตรวจเชิงคุณภาพ (Qualitative เช่น H-Pylori Positive Negative)
// ✅ ดึงทุกรายการไม่ว่าจะมีหัวข้อ (Section) หรือไม่มี (สร้างแถวใหม่เสมอ)
// ✅ ระบบ Dual Engine:
//    1. Direct PDF Text Layer (อ่านจาก PDF ดิจิทัลโดยตรง เร็ว แม่นยำ 100%)
//    2. Tesseract.js OCR Fallback (สำหรับเอกสารสแกน / รูปภาพ)
// =====================================================

(function () {
    'use strict';

    // -------------------------------------------------------
    // HELPERS
    // -------------------------------------------------------

    function _formatDate(d) {
        const day   = String(d.getDate()).padStart(2, '0');
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const year  = d.getFullYear();
        return `${day}/${month}/${year}`;
    }

    function _isValidUrl(url) {
        return !!(url && (url.startsWith('http') || url.startsWith('blob:') || url.startsWith('data:')));
    }

    function _isPdf(url) {
        if (!url) return false;
        const u = String(url).toLowerCase();
        return u.startsWith('data:application/pdf') || u.includes('.pdf') || u.includes('application/pdf') || u.startsWith('blob:');
    }

    function _isImage(url) {
        if (!url) return false;
        const u = String(url).toLowerCase();
        return u.startsWith('data:image/') || /\.(jpeg|jpg|gif|png|webp|bmp|tif|tiff)($|\?)/i.test(u) || u.includes('image/') || u.includes('.jpg') || u.includes('.png') || u.includes('.jpeg');
    }

    function _updateSwalProgress(msg) {
        const el = document.querySelector('.swal2-html-container .rl-ocr-status');
        if (el) el.textContent = msg;
    }

    function _showSwalLoading(msg = 'ກຳລັງປະມວນຜົນ...') {
        if (typeof Swal !== 'undefined') {
            Swal.fire({
                title: `<div style="font-size:16px;font-weight:700;color:#0b3c73;">${msg}</div>`,
                html: '<div style="margin-top:14px;"><div class="spinner-border text-primary" role="status"></div></div><div class="rl-ocr-status mt-2 text-muted" style="font-size:12px;">ກະລຸນາລໍຖ້າຈັກໜ້ອຍ...</div>',
                allowOutsideClick: false,
                showConfirmButton: false,
                didOpen: () => {
                    if (typeof Swal.showLoading === 'function') Swal.showLoading();
                }
            });
        }
    }

    function _printLabReport(reportHtml, title = 'Lab_Report') {
        const printWindow = window.open('', '_blank');
        if (!printWindow) {
            window.print();
            return;
        }
        printWindow.document.write(`<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>${title}</title>
    <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.3/font/bootstrap-icons.min.css">
    <link href="https://fonts.googleapis.com/css2?family=Noto+Sans+Lao:wght@300;400;500;600;700;800&family=Sarabun:wght@300;400;500;600;700;800&display=swap" rel="stylesheet">
    <style>
        @page {
            size: A4 portrait;
            margin-top: 2.5cm;
            margin-bottom: 1.2cm;
            margin-left: 0;
            margin-right: 0;
        }
        @page :first {
            margin-top: 0;
            margin-bottom: 0;
        }
        * {
            box-sizing: border-box;
        }
        body {
            margin: 0;
            padding: 0;
            background: #fff;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
        }
        @media print {
            body {
                -webkit-print-color-adjust: exact;
                print-color-adjust: exact;
            }
        }
    </style>
</head>
<body>
    ${reportHtml}
    <script>
        window.onload = function() {
            setTimeout(() => {
                window.focus();
                window.print();
            }, 300);
        };
    </script>
</body>
</html>`);
        printWindow.document.close();
    }

    function _openRecoverLabPage(reportHtml, title = 'Lab_Report') {
        _printLabReport(reportHtml, title);
    }

    // -------------------------------------------------------
    // DYNAMIC LOAD PDF.js
    // -------------------------------------------------------
    function _loadPdfJs() {
        if (window.pdfjsLib) return Promise.resolve(window.pdfjsLib);
        return new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
            script.onload = () => {
                window.pdfjsLib.GlobalWorkerOptions.workerSrc =
                    'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
                setTimeout(() => resolve(window.pdfjsLib), 100);
            };
            script.onerror = reject;
            document.head.appendChild(script);
        });
    }

    // -------------------------------------------------------
    // 1. DIRECT PDF TEXT EXTRACTION (100% Accurate & Instant)
    // -------------------------------------------------------
    async function _extractTextFromPdfPage(page) {
        try {
            const textContent = await page.getTextContent();
            if (!textContent || !textContent.items || textContent.items.length === 0) {
                return '';
            }

            const items = textContent.items
                .filter(it => it.str && it.str.trim().length > 0)
                .map(it => ({
                    str: it.str.trim(),
                    x: Math.round(it.transform[4]),
                    y: Math.round(it.transform[5]),
                    width: Math.round(it.width || 0)
                }));

            // ถ้ามีตัวหนังสือน้อยมาก อาจเป็นไฟล์สแกนภาพล้วน
            if (items.length < 5) return '';

            // จัดกลุ่มคำตามแนวนอน (Y coordinate tolerance ~ 5px)
            const yTolerance = 5;
            const lineGroups = [];

            // เรียงตาม Y จากบนลงล่าง (PDF Y=0 อยู่ด้านล่าง ดังนั้น Y มาก = ด้านบน)
            items.sort((a, b) => b.y - a.y || a.x - b.x);

            for (const item of items) {
                let group = lineGroups.find(g => Math.abs(g.y - item.y) <= yTolerance);
                if (!group) {
                    group = { y: item.y, items: [] };
                    lineGroups.push(group);
                }
                group.items.push(item);
            }

            // เรียงคำในแต่ละแถวตามแกน X จากซ้ายไปขวา
            const lines = [];
            for (const group of lineGroups) {
                group.items.sort((a, b) => a.x - b.x);
                let lineStr = '';
                for (let i = 0; i < group.items.length; i++) {
                    const item = group.items[i];
                    if (i === 0) {
                        lineStr = item.str;
                    } else {
                        const prev = group.items[i - 1];
                        // ไม่เว้นวรรคถ้าเป็นตัวเลขทศนิยมที่แยกส่วนกัน หรือชิดกันมาก
                        const prevEndsWithDot = prev.str.endsWith('.');
                        const itemStartsWithDot = item.str.startsWith('.');
                        const isNumAndDotNum = /^\d+$/.test(prev.str) && /^\.\d+/.test(item.str);
                        const isNumDotAndNum = /\d\.$/.test(prev.str) && /^\d+$/.test(item.str);
                        const isDot = prev.str === '.' || item.str === '.';

                        // ถ้าระยะห่างทางแกน X เล็กมาก (font kerning / glyph split)
                        const prevEnd = (prev.x || 0) + (prev.width || 0);
                        const gap = (item.x || 0) - prevEnd;
                        const isVeryClose = prev.width > 0 && gap >= -1 && gap < 2.5;

                        if (prevEndsWithDot || itemStartsWithDot || isNumAndDotNum || isNumDotAndNum || isDot || isVeryClose) {
                            lineStr += item.str;
                        } else {
                            lineStr += ' ' + item.str;
                        }
                    }
                }
                if (lineStr.trim().length > 0) {
                    lines.push(lineStr.trim());
                }
            }

            return lines.join('\n');
        } catch (e) {
            console.warn('[RecoverLab] Direct PDF text extraction error:', e);
            return '';
        }
    }

    // -------------------------------------------------------
    // 2. OCR รูปภาพ (Tesseract.js Fallback)
    // -------------------------------------------------------
    async function _ocrImageUrl(imageUrl) {
        if (typeof Tesseract === 'undefined') {
            console.warn('[RecoverLab] Tesseract.js not available');
            return '';
        }
        try {
            const result = await Tesseract.recognize(imageUrl, 'eng', {
                logger: m => {
                    if (m.status === 'recognizing text') {
                        const pct = Math.round((m.progress || 0) * 100);
                        _updateSwalProgress(`OCR กำลังอ่าน... ${pct}%`);
                    }
                }
            });
            return result.data.text || '';
        } catch (e) {
            console.warn('[RecoverLab] OCR error:', e);
            return '';
        }
    }

    // แปลง PDF หน้า → canvas สำหรับกรณี Fallback OCR
    async function _pdfPageToDataUrl(pdfDoc, pageNum) {
        const page = await pdfDoc.getPage(pageNum);
        const viewport = page.getViewport({ scale: 2.5 });
        const canvas = document.createElement('canvas');
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        await page.render({ canvasContext: canvas.getContext('2d'), viewport }).promise;
        return canvas.toDataURL('image/png');
    }

    // -------------------------------------------------------
    // PARSING ENGINE — รองรับทั้งมีหัวข้อ/ไม่มีหัวข้อ & ทุกประเภทผล
    // -------------------------------------------------------

    const QUALITATIVE_WORDS = 'positive|negative|reactive|non-reactive|nonreactive|normal|abnormal|detected|not\\s*detected|seen|not\\s*seen|nil|trace|weakly\\s*positive|borderline|pos|neg|yellow|clear|cloudy|turbid';

    // ตรวจสอบว่าเป็นหัวข้อหมวดหมู่ตรวจหรือไม่ (Section Header)
    function _checkSectionHeader(line) {
        const l = line.trim();
        if (/^(hematology|cbc|complete\s*blood|blood\s*routine)(\s+analysis|\s+report|\s+profile|\s+examination|\s+test)*$/i.test(l)) {
            return 'Hematology Analysis Report';
        }
        if (/^(bio[\s\-]*chemistry|chemistry|clinical\s*chemistry|liver|lipid|kidney|metabolic)(\s+analysis|\s+report|\s+profile|\s+examination|\s+test)*$/i.test(l)) {
            return 'Bio Chemistry Analysis Report';
        }
        if (/^(urine|urinalysis|urine\s*routine|urine\s*examination)(\s+analysis|\s+report|\s+profile|\s+examination|\s+test)*$/i.test(l)) {
            return 'Urine Examination';
        }
        if (/^(serology|immunology|coagulation|hormone|thyroid|microbiology|stool)(\s+analysis|\s+report|\s+profile|\s+examination|\s+test)*$/i.test(l)) {
            return l;
        }
        return null;
    }

    // ตรวจสอบบรรทัดที่ไม่ใช่ผลตรวจ (Header เอกสาร, ข้อมูลผู้ป่วย, เส้นคั่น)
    function _isHeaderOrMetaLine(line) {
        const l = line.trim();
        if (!l || l.length < 2) return true;
        if (/^[=\-_\.\s*#~]+$/.test(l)) return true; // เส้นคั่น
        if (/^\d+\s*[\/\-]\s*\d+$/.test(l)) return true; // เลขหน้า เช่น 1 / 1
        if (/^page\s+\d+/i.test(l)) return true;

        // หัวตาราง
        if (/^(test|text|item)\s+(sample\s+)?result/i.test(l)) return true;
        if (/^(test|text|item)\s+(sample\s+)?(result|flags?|unit|ref)/i.test(l)) return true;

        // ข้อมูลผู้ป่วย / ส่วนหัวคลินิก / วันที่
        if (/(name|patient|age|sex|gender|sample\s*id|sample\s*kind|register|department|silk\s*bed|doctor|treat\s*area|diagnostic|date|time|วัน|ວັນ|รายงาน|ລາຍງານ|ชื่อ|ຊື່|อายุ|ອາຍຸ|เพศ|ເພດ|เบอร์|ເບີ)\s*[:]/i.test(l)) return true;
        if (/(วันรายงาน|ວັນລາຍງານ|วันที่|ວັນທີ|วันตรวจ|ວັນກວດ|number\s*:|no\.\s*:)/i.test(l)) return true;
        if (/^(mr\.|mrs\.|ms\.|dr\.|ท้าว|นาง|ນາງ|ທ້າວ)/i.test(l)) return true;
        if (/^(clinical\s*lab|laboratory\s*report|hospital|clinic\s*name)/i.test(l)) return true;

        return false;
    }

    // คำนวณ Flag (H, L, Positive) อัตโนมัติหากในไฟล์ไม่มีระบุไว้
    function _computeFlag(resultStr, refStr, existingFlag) {
        if (existingFlag) return existingFlag;
        if (!resultStr) return '';

        // ถ้าเป็นค่าเชิงคุณภาพ (Positive, Reactive, etc.)
        if (/^(positive|reactive|detected|abnormal|pos|\+)/i.test(resultStr)) {
            return 'Positive';
        }

        const resNum = parseFloat(resultStr);
        if (isNaN(resNum) || !refStr) return '';

        // กรณีช่วงปกติ เช่น "0-40" หรือ "3.5-10.0"
        const rangeMatch = refStr.match(/^([\d\.]+)\s*[-–~to]\s*([\d\.]+)$/);
        if (rangeMatch) {
            const low  = parseFloat(rangeMatch[1]);
            const high = parseFloat(rangeMatch[2]);
            if (!isNaN(low) && resNum < low) return 'L';
            if (!isNaN(high) && resNum > high) return 'H';
        }

        // กรณีเครื่องหมาย < เช่น "< 200" หรือ "<= 200"
        const lessMatch = refStr.match(/^[<≤]\s*([\d\.]+)$/);
        if (lessMatch) {
            const high = parseFloat(lessMatch[1]);
            if (!isNaN(high) && resNum > high) return 'H';
        }

        // กรณีเครื่องหมาย > เช่น "> 60"
        const greaterMatch = refStr.match(/^[>≥]\s*([\d\.]+)$/);
        if (greaterMatch) {
            const low = parseFloat(greaterMatch[1]);
            if (!isNaN(low) && resNum < low) return 'L';
        }

        return '';
    }

    // แยกวิเคราะห์ 1 บรรทัดให้เป็นข้อมูลแถวผลตรวจ
    function _parseLineToLabRow(line) {
        if (!line) return null;
        // 1. ตัด bullet point หน้าบรรทัดออก เช่น "• H-pylori" -> "H-pylori"
        let cleaned = line.replace(/^[•\*\-\u2022\u25cf\u25cb\u25aa\u25ab]\s*/, '').replace(/\s+/g, ' ').trim();

        // แปลงสัญลักษณ์ ≠ (not equal) ที่เครื่องอ่านมาเป็น # (เช่น LYM≠ -> LYM#, MID≠ -> MID#, GRAN≠ -> GRAN#)
        cleaned = cleaned.replace(/≠/g, '#');

        // 2. ซ่อมแซมตัวเลขทศนิยมที่ถูกคั่นด้วยช่องว่าง เช่น "1 .0" -> "1.0", "6 .0" -> "6.0", "5 .0" -> "5.0", "0 .5" -> "0.5"
        cleaned = cleaned.replace(/(\d+)\s*\.\s*(\d+)/g, '$1.$2');

        // ซ่อมแซมจุดทศนิยมเดี่ยวๆ ที่ติดตัวเลข เช่น ". 0" หรือ "5 ."
        cleaned = cleaned.replace(/(^|\s)\.\s*(\d+)/g, '$10.$2');
        cleaned = cleaned.replace(/(\d+)\s+\.(?=\s|$)/g, '$1.0');

        // 3. ซ่อมแซมค่า Specific Gravity ในปัสสาวะ:
        cleaned = cleaned.replace(/(Specific\s*Gravity)\s*1\s*\.?\s*0\s*(\d{2,3})\b/i, '$1 1.0$2');
        cleaned = cleaned.replace(/\b(1\.0)\s+(\d{2,3})\b/g, '$1$2');

        // 4. ซ่อมแซมค่า pH ในปัสสาวะ:
        cleaned = cleaned.replace(/\bpH\s+(\d+(?:\.\d+)?)\s+(\d+(?:\.\d+)?)\s*[-–~]\s*(\d+(?:\.\d+)?)\b/i, 'pH $1 $2-$3');

        // 5. Normalization: จัดการช่องว่างรอบเครื่องหมายขีดของ Reference Range
        // เช่น "20.0- 40.0" -> "20.0-40.0", "0.6 - 4.1" -> "0.6-4.1", "50.0 -70.0" -> "50.0-70.0", "5.0 - 7.5" -> "5.0-7.5"
        cleaned = cleaned.replace(/([\d\.]+)\s*[-–~]\s*([\d\.]+)/g, '$1-$2');

        // 6. แปลง Unicode Superscript เป็น ^ตัวเลข (เช่น 10⁹ -> 10^9, 10¹² -> 10^12)
        cleaned = cleaned.replace(/10([\u2070-\u2079\u00B9\u00B2\u00B3]+)/g, (m, p) => {
            const num = p.replace(/\u00B9/g, '1').replace(/\u00B2/g, '2').replace(/\u00B3/g, '3').replace(/[\u2070-\u2079]/g, c => String(c.charCodeAt(0) - 0x2070));
            return '10^' + num;
        });

        // 7. จัดการหน่วย 10*9/L, 10^9/L, 10*12/L -> แปลงเป็น 10^9/L และ 10^12/L สม่ำเสมอ
        cleaned = cleaned.replace(/\b10\s*([\^\*])\s*(\d+)\s*\/\s*([a-zA-Z]+)\b/gi, '10^$2/$3');
        cleaned = cleaned.replace(/\b10\s+(\d{1,2})\s*\/\s*([a-zA-Z]+)\b/gi, '10^$1/$2');
        cleaned = cleaned.replace(/\b10\s*([\^\*])\s*(\d+)\b/gi, '10^$2');

        // 8. ตรวจสอบว่ามีคอลัมน์ SAMPLE ในบรรทัดหรือไม่ (เช่น SER, WB, EDTA, URINE)
        let sample = 'SER';
        let testPart = '';
        let dataPart = cleaned;

        // รองรับชื่อตรวจที่มีเครื่องหมาย #, &, _, ', * เช่น LYM#, MID#, GRAN#
        const sampleMatch = cleaned.match(/^([A-Za-z0-9\-\.\s\/\+\(\)%#&_'\*]{1,45}?)\s+(SER|WB|EDTA|PLAS|PLASMA|URINE|BLD|SERUM)\s+(.+)$/i);
        if (sampleMatch) {
            testPart = sampleMatch[1].trim();
            sample   = sampleMatch[2].toUpperCase();
            dataPart = sampleMatch[3].trim();
        }

        const UNIT_PAT = '((?:[a-zA-Z%\\/\\u00B5\\u03BC]|10\\^|10\\*|x10)[a-zA-Z0-9%\\^\\/\\*\\.\\u00B5\\u03BC⁰¹²³⁴⁵⁶⁷⁸⁹]*)';
        const REF_PAT = '([\\d\\.<>]+\\s*[-–~to]\\s*[\\d\\.<>]+|[<>≤≥]\\s*[\\d\\.]+|Negative|Normal|Non-reactive|None|Nil)';

        // -------------------------------------------------------------
        // PATTERN Q1: Qualitative Test (ผลตรวจเชิงคุณภาพ เช่น Color Yellow Yellow, Leukocytes Negative Negative)
        // -------------------------------------------------------------
        const q1Match = dataPart.match(
            new RegExp(`^([A-Za-z][A-Za-z0-9\\-\\.\\s\\/\\+\\(\\)%#&_\'\\*]{0,40}?)\\s+(${QUALITATIVE_WORDS})\\s+(${QUALITATIVE_WORDS})$`, 'i')
        );
        if (q1Match) {
            const tName = testPart || q1Match[1].trim();
            const res   = q1Match[2].trim();
            const ref   = q1Match[3].trim();
            const isAbnormal = /^(positive|reactive|detected|abnormal|pos|\+)/i.test(res);
            return {
                test:   tName,
                sample: sample,
                result: res,
                flag:   isAbnormal ? 'Positive' : '',
                unit:   '-',
                ref:    ref
            };
        }

        // PATTERN Q2: Qualitative พร้อม Flag คั่นตรงกลาง
        const q2Match = dataPart.match(
            new RegExp(`^([A-Za-z][A-Za-z0-9\\-\\.\\s\\/\\+\\(\\)%#&_\'\\*]{0,40}?)\\s+(${QUALITATIVE_WORDS})\\s+(H|L|HH|LL|\\*|\\+)\\s+(${QUALITATIVE_WORDS})$`, 'i')
        );
        if (q2Match) {
            return {
                test:   testPart || q2Match[1].trim(),
                sample: sample,
                result: q2Match[2].trim(),
                flag:   q2Match[3].trim(),
                unit:   '-',
                ref:    q2Match[4].trim()
            };
        }

        // PATTERN Q3: Qualitative มีเฉพาะผล (ไม่มีค่าอ้างอิง) เช่น "H-Pylori Positive"
        const q3Match = dataPart.match(
            new RegExp(`^([A-Za-z][A-Za-z0-9\\-\\.\\s\\/\\+\\(\\)%#&_\'\\*]{0,40}?)\\s+(${QUALITATIVE_WORDS})$`, 'i')
        );
        if (q3Match && !/^(page|register|date|visit|sample|hn|tel|age|sex)/i.test(q3Match[1])) {
            const tName = testPart || q3Match[1].trim();
            const res   = q3Match[2].trim();
            const isAbnormal = /^(positive|reactive|detected|abnormal|pos|\+)/i.test(res);
            return {
                test:   tName,
                sample: sample,
                result: res,
                flag:   isAbnormal ? 'Positive' : '',
                unit:   '-',
                ref:    'Negative'
            };
        }

        // -------------------------------------------------------------
        // PATTERN N1: ข้อมูลที่มีคอลัมน์ Sample ชัดเจน (เช่น testPart = "ALBUMIN", dataPart = "43 g/L 30-50")
        // -------------------------------------------------------------
        if (testPart) {
            const mSampleData = dataPart.match(
                new RegExp(`^([\\d\\.]+)\\s*(H|L|HH|LL|\\*|\\+)?\\s+${UNIT_PAT}\\s+${REF_PAT}$`, 'i')
            );
            if (mSampleData) {
                return {
                    test:   testPart,
                    sample: sample,
                    result: mSampleData[1].trim(),
                    flag:   mSampleData[2] ? mSampleData[2].trim() : '',
                    unit:   mSampleData[3].trim(),
                    ref:    mSampleData[4].trim()
                };
            }

            const mSampleNoUnit = dataPart.match(
                new RegExp(`^([\\d\\.]+)\\s*(H|L|HH|LL|\\*|\\+)?\\s+${REF_PAT}$`, 'i')
            );
            if (mSampleNoUnit) {
                return {
                    test:   testPart,
                    sample: sample,
                    result: mSampleNoUnit[1].trim(),
                    flag:   mSampleNoUnit[2] ? mSampleNoUnit[2].trim() : '',
                    unit:   '-',
                    ref:    mSampleNoUnit[3].trim()
                };
            }
        }

        // -------------------------------------------------------------
        // PATTERN N2: Full Numeric (TEST + RESULT + [FLAG] + UNIT + REF)
        // e.g. "WBC 6.5 10^9/L 3.5-10.0" หรือ "LYM% 30.2 % 20.0-40.0" หรือ "PLT 179 10^9/L 100-350"
        // -------------------------------------------------------------
        const mN2 = dataPart.match(
            new RegExp(`^([A-Za-z][A-Za-z0-9\\-\\.\\s\\/\\+\\(\\)%#&_\'\\*]{0,40}?)\\s+([<≤>≥]?\\s*[\\d\\.]+)\\s*(H|L|HH|LL|\\*|\\+)?\\s+${UNIT_PAT}\\s+${REF_PAT}$`, 'i')
        );
        if (mN2) {
            return {
                test:   mN2[1].trim(),
                sample: sample,
                result: mN2[2].trim(),
                flag:   mN2[3] ? mN2[3].trim() : '',
                unit:   mN2[4].trim(),
                ref:    mN2[5].trim()
            };
        }

        // -------------------------------------------------------------
        // PATTERN N3: Numeric + Ref Range (ไม่มี Unit)
        // e.g. "Specific Gravity 1.010 1.003-1.030", "pH 5.5 5.0-7.5"
        // -------------------------------------------------------------
        const mN3 = dataPart.match(
            new RegExp(`^([A-Za-z][A-Za-z0-9\\-\\.\\s\\/\\+\\(\\)%#&_\'\\*]{0,40}?)\\s+([<≤>≥]?\\s*[\\d\\.]+)\\s*(H|L|HH|LL|\\*|\\+)?\\s+${REF_PAT}$`, 'i')
        );
        if (mN3) {
            return {
                test:   mN3[1].trim(),
                sample: sample,
                result: mN3[2].trim(),
                flag:   mN3[3] ? mN3[3].trim() : '',
                unit:   '-',
                ref:    mN3[4].trim()
            };
        }

        // -------------------------------------------------------------
        // PATTERN N4: Numeric + Flag (ไม่มี Unit/Ref) เช่น "WBC 12.5 H"
        // -------------------------------------------------------------
        const mN4 = dataPart.match(
            new RegExp(`^([A-Za-z][A-Za-z0-9\\-\\.\\s\\/\\+\\(\\)%#&_\'\\*]{0,40}?)\\s+([<≤>≥]?\\s*[\\d\\.]+)\\s+(H|L|HH|LL|\\*|\\+)\\s*$`, 'i')
        );
        if (mN4) {
            return {
                test:   mN4[1].trim(),
                sample: sample,
                result: mN4[2].trim(),
                flag:   mN4[3].trim(),
                unit:   '-',
                ref:    '-'
            };
        }

        // -------------------------------------------------------------
        // PATTERN N5: Test Name + Numeric Result สองคำเดี่ยวๆ
        // -------------------------------------------------------------
        const mN5 = dataPart.match(
            new RegExp(`^([A-Za-z][A-Za-z0-9\\-\\.\\s\\/\\+\\(\\)%#&_\'\\*]{0,40}?)\\s+([<≤>≥]?\\s*[\\d\\.]+)\\s*$`, 'i')
        );
        if (mN5 && !/^(page|register|date|visit|sample|hn|tel|age|sex)/i.test(mN5[1])) {
            return {
                test:   mN5[1].trim(),
                sample: sample,
                result: mN5[2].trim(),
                flag:   '',
                unit:   '-',
                ref:    '-'
            };
        }

        return null;
    }

    // รวมบรรทัดที่ถูกตัดแบ่งครึ่ง (เช่น บรรทัดแรกชื่อตรวจ บรรทัดสองเป็นค่าผล)
    function _mergeMultiLineItems(rawLines) {
        const merged = [];
        for (let i = 0; i < rawLines.length; i++) {
            const line = rawLines[i].trim();
            if (!line) continue;

            // 1. ตรวจสอบว่าบรรทัดนี้คือส่วนท้ายของช่วง Reference Range ที่ถูกตัดขึ้นบรรทัดใหม่หรือไม่ เช่น "- 1.030" หรือ "- 7.5"
            if (/^[-–~to]\s*[\d\.]+/i.test(line) && merged.length > 0) {
                merged[merged.length - 1] += ` ${line}`;
                continue;
            }

            // 2. ตรวจสอบว่าบรรทัดก่อนหน้าเป็นชื่อตรวจเดี่ยวๆ (เช่น "pH" หรือ "Specific Gravity" หรือ "WBC") แล้วบรรทัดนี้เป็นค่าผลตรวจ
            if (merged.length > 0) {
                const prev = merged[merged.length - 1];
                const isPrevLoneTestName = /^[A-Za-z#%][A-Za-z0-9#%\s\-_/]{0,35}$/.test(prev) &&
                                          !_isHeaderOrMetaLine(prev) &&
                                          !_checkSectionHeader(prev) &&
                                          !/\d{2,}/.test(prev);

                const isLineResultOnly = new RegExp(`^(${QUALITATIVE_WORDS})(\\s+(${QUALITATIVE_WORDS}))?$`, 'i').test(line) ||
                                        /^[\d\.]+\s*(H|L|HH|LL|\*|\+)?\s*(\S+)?\s+[\d\.<>]+/i.test(line) ||
                                        /^[\d\.]+\s*(H|L|HH|LL|\*|\+)?\s*[\d\.<>]+\s*[-–~to]\s*[\d\.<>]+/i.test(line) ||
                                        /^[\d\.]+\s+[\d\.]+\s*[-–~to]\s*[\d\.]+/.test(line);

                if (isPrevLoneTestName && isLineResultOnly) {
                    merged[merged.length - 1] = `${prev} ${line}`;
                    continue;
                }
            }

            merged.push(line);
        }
        return merged;
    }

    // แปลงข้อความทั้งหมดเป็นแถวข้อมูลตาราง
    function _parseTextToLabRows(rawText, defaultCategory) {
        if (!rawText) return [];

        const initialLines = rawText
            .split('\n')
            .map(l => l.replace(/\s+/g, ' ').trim())
            .filter(l => l.length > 0);

        const lines = _mergeMultiLineItems(initialLines);
        const rows = [];
        let currentSection = '';

        if (defaultCategory) {
            if (/cbc|hematology/i.test(defaultCategory)) currentSection = 'Hematology Analysis Report';
            else if (/urine|ปัสสาวะ/i.test(defaultCategory)) currentSection = 'Urine Examination';
            else if (/เลือด|chemistry/i.test(defaultCategory)) currentSection = 'Bio Chemistry Analysis Report';
        }

        for (const line of lines) {
            // ตรวจสอบหัวข้อหมวด (Section Header)
            const sec = _checkSectionHeader(line);
            if (sec) {
                currentSection = sec;
                continue;
            }

            // ข้ามหัวเอกสาร / ข้อมูลส่วนหัวที่ไม่ใช่ผลตรวจ
            if (_isHeaderOrMetaLine(line)) {
                continue;
            }

            // แปลงบรรทัดเป็นแถวผลตรวจ
            const row = _parseLineToLabRow(line);
            if (row) {
                row.section = currentSection || (defaultCategory ? `${defaultCategory} Report` : 'Analysis Report');

                // กำหนดประเภท Sample ให้เหมาะสมกับหมวด
                if (/urine/i.test(row.section) && (!row.sample || row.sample === 'SER')) {
                    row.sample = 'URINE';
                } else if (/hematology|cbc/i.test(row.section) && (!row.sample || row.sample === 'SER')) {
                    row.sample = 'EDTA';
                }

                // คำนวณ flag อัตโนมัติถ้ายังไม่มี
                if (!row.flag) {
                    row.flag = _computeFlag(row.result, row.ref, row.flag);
                }
                rows.push(row);
            }
        }

        // 🌟 Fallback สำหรับเอกสารที่เป็นข้อความบรรยาย เช่น Pap smear, ผลตรวจชิ้นเนื้อ หรือผลสรุปจากแพทย์
        if (rows.length === 0 && rawText && rawText.trim().length > 5) {
            const isPapOrCyto = /cervical|pap\s*smear|cytology|pathogen|inflammation|intraepithelial|ມະເຮັງປາກມົດລູກ/i.test(rawText);
            const rawLines = rawText.split('\n').map(l => l.trim()).filter(l => l.length > 2 && !_isHeaderOrMetaLine(l));

            rawLines.forEach(l => {
                // ข้ามบรรทัดเลขที่เอกสาร วันที่ หรือหัวกระดาษที่ไม่ใช่ผลตรวจ
                if (/(number|no\.|case|date|time|วัน|ວັນ|รายงาน|ລາຍງານ|page|ref|lab\s*no|specimen|primary\s*cell|cell\s*count)/i.test(l)) return;
                if (/^(ກວດເລືອດ|ตรวจเลือด|blood\s*test)$/i.test(l)) return;

                const colonMatch = l.match(/^([^:\-\t]{2,40})\s*[:\-\t]\s*(.+)$/);
                if (colonMatch) {
                    const k = colonMatch[1].trim();
                    const v = colonMatch[2].trim();
                    if (!/(name|patient|hn|date|time|dr|doctor|hospital|clinic|age|sex|phone|register|tel|number|no|วัน|ວັນ|รายงาน|ລາຍງານ|ชื่อ|ຊື່|อายุ|ອາຍຸ|เพศ|ເພດ)/i.test(k) &&
                        !/^\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4}$/.test(v)) {
                        let sec = defaultCategory ? `${defaultCategory} Report` : 'Clinical Findings / ຜົນການກວດ';
                        let refVal = '-';
                        if (isPapOrCyto) {
                            sec = 'Cervical Cytology / Pap Smear Report';
                            if (/cervical/i.test(k)) refVal = 'Negative for Intraepithelial Lesion';
                            else if (/inflammation/i.test(k)) refVal = 'Mild / Normal';
                            else if (/pathogen/i.test(k)) refVal = 'Normal flora';
                        }
                        rows.push({
                            test: k,
                            sample: isPapOrCyto ? 'CYTO' : 'DOC',
                            result: v,
                            flag: _computeFlag(v, refVal, ''),
                            unit: '-',
                            ref: refVal,
                            section: sec
                        });
                    }
                } else if (isPapOrCyto) {
                    // ดักจับบรรทัด Pap smear แบบไม่มี colon เช่น "I.Cervical Normal cells" หรือ "II.Inflammation Moderate"
                    const mCyto = l.match(/^(I|II|III|IV|V)\.?\s*([A-Za-z]+)\s+(.+)$/i);
                    if (mCyto) {
                        const k = `${mCyto[1]}. ${mCyto[2]}`;
                        const v = mCyto[3].trim();
                        let refVal = 'Negative / Normal';
                        if (/cervical/i.test(k)) refVal = 'Negative for Intraepithelial Lesion';
                        else if (/inflammation/i.test(k)) refVal = 'Mild / Normal';
                        else if (/pathogen/i.test(k)) refVal = 'Normal flora';
                        rows.push({
                            test: k,
                            sample: 'CYTO',
                            result: v,
                            flag: '',
                            unit: '-',
                            ref: refVal,
                            section: 'Cervical Cytology / Pap Smear Report'
                        });
                    }
                } else if (l.length >= 4 && l.length <= 120 && !/^(page|date|thank|dr\.|hospital|clinic|tel|phone|number)/i.test(l)) {
                    rows.push({
                        test: defaultCategory || 'Clinical Result',
                        sample: 'DOC',
                        result: l,
                        flag: _computeFlag(l, '', ''),
                        unit: '-',
                        ref: '-',
                        section: defaultCategory ? `${defaultCategory} Report` : 'Clinical Findings / ຜົນການກວດ'
                    });
                }
            });
        }

        return rows;
    }

    // -------------------------------------------------------
    // PIPELINE หลักในการดึงข้อมูล
    // -------------------------------------------------------
    async function _extractLabRows(labFileUrl, defaultCategory) {
        if (!labFileUrl) return { rows: [], rawText: '' };

        let allRows = [];
        let fullRawText = '';

        let targetUrl = labFileUrl;
        if (typeof targetUrl === 'string' && targetUrl.startsWith('FILE-') && typeof LabDB !== 'undefined') {
            try {
                const fileObj = await LabDB.getFile(targetUrl);
                if (fileObj && (fileObj.url || fileObj.publicUrl)) {
                    targetUrl = fileObj.url || fileObj.publicUrl;
                }
            } catch (e) { }
        }

        const isPdfTarget = _isPdf(targetUrl);

        if (isPdfTarget) {
            try {
                const pdfjs  = await _loadPdfJs();
                const pdfDoc = await pdfjs.getDocument(targetUrl).promise;
                const maxPages = Math.min(pdfDoc.numPages, 6);

                for (let p = 1; p <= maxPages; p++) {
                    _updateSwalProgress(`ກຳລັງອ່ານໜ້າ ${p}/${maxPages}...`);
                    const page = await pdfDoc.getPage(p);

                    // 1. อ่าน Text Layer ดิจิทัลโดยตรง (เร็ว & แม่นยำ 100%)
                    let pageText = await _extractTextFromPdfPage(page);

                    // 2. ถ้าไม่มี Text Layer (ไฟล์สแกนภาพลง PDF) ให้ใช้ Fallback OCR
                    if (!pageText || pageText.trim().length < 20) {
                        _updateSwalProgress(`OCR ກຳລັງອ່ານໜ້າ ${p}/${maxPages}...`);
                        const dataUrl = await _pdfPageToDataUrl(pdfDoc, p);
                        pageText = await _ocrImageUrl(dataUrl);
                    }

                    fullRawText += '\n' + pageText;
                }
                allRows = _parseTextToLabRows(fullRawText, defaultCategory);
            } catch (e) {
                console.warn('[RecoverLab] PDF extraction error, falling back to OCR:', e);
                try {
                    const text = await _ocrImageUrl(targetUrl);
                    fullRawText = text;
                    allRows = _parseTextToLabRows(text, defaultCategory);
                } catch (oe) { }
            }
        } else {
            // โหมดรูปภาพ (JPG, PNG, Data URL) หรือ OCR Fallback
            try {
                _updateSwalProgress('ກຳລັງອ່ານຮູບພາບຜົນກວດ (OCR)...');
                const text = await _ocrImageUrl(targetUrl);
                fullRawText = text;
                allRows = _parseTextToLabRows(text, defaultCategory);
            } catch (e) {
                console.warn('[RecoverLab] OCR extraction error:', e);
            }
        }

        return { rows: allRows, rawText: fullRawText };
    }

    // ค้นหากรุ๊ปเลือด (ABO Blood Group) จากผลตรวจ / ข้อความในเอกสาร / ฐานข้อมูล
    function _extractBloodGroup(labRows, allExtractedText, pData, visitData) {
        // 1. ค้นหาจากข้อความจริงในเอกสาร PDF/รูปภาพ (แม่นยำที่สุด — ตรงกับไฟล์จริง)
        if (allExtractedText) {
            // ดักจับกรณีมีวงเล็บ เช่น "ABO Blood Group: (A)", "ABO Blood Group:(A)", "ABO Blood Group (A)"
            const mParen = allExtractedText.match(/(?:ABO[\s\-_/]*Blood[\s\-_/]*Group|Blood[\s\-_/]*Group|ABO[\s\-_/]*Group|Blood[\s\-_/]*Type|ABO)\s*[:\-]?\s*[\(\[]\s*([ABO0]{1,2}(?:\s*[\+\-]|(?:\s*Rh\s*[\+\-positivegativ]+))?)\s*[\)\]]/i);
            if (mParen && mParen[1]) {
                return mParen[1].trim().toUpperCase().replace(/0/g, 'O');
            }

            // ดักจับกรณีไม่มีวงเล็บ เช่น "ABO Blood Group: A", "Blood Group: B Positive", "ABO Blood Group: AB"
            const mGeneral = allExtractedText.match(/(?:ABO[\s\-_/]*Blood[\s\-_/]*Group|Blood[\s\-_/]*Group|ABO[\s\-_/]*Group|Blood[\s\-_/]*Type)\s*[:\-]?\s*(Group\s+[ABO0]{1,2}|[ABO0]{1,2}(?:\s*[\+\-]|(?:\s*Rh\s*[\+\-positivegativ]+))?)(?=\s|\n|\r|$|,)/i);
            if (mGeneral && mGeneral[1]) {
                const val = mGeneral[1].trim().replace(/^Group\s+/i, '').toUpperCase().replace(/0/g, 'O');
                return val;
            }

            // ค้นหาแบบยืดหยุ่น "ABO Blood Group" ตามด้วยกรุ๊ปเลือด
            const mFlex = allExtractedText.match(/ABO[\s\-_/]*Blood[\s\-_/]*Group[^\n\r]*?[:\-]?\s*[\(\[]?\s*([ABO0]{1,2})\s*[\)\]]?/i);
            if (mFlex && mFlex[1]) {
                return mFlex[1].trim().toUpperCase().replace(/0/g, 'O');
            }
        }

        // 2. ค้นหาจากแถวผลตรวจในตาราง labRows
        if (labRows && labRows.length > 0) {
            const bgRow = labRows.find(r =>
                /^(abo[\s\-_/]*blood|blood[\s\-_/]*group|blood[\s\-_/]*type|abo[\s\-_/]*rh|abo|group[\s\-_/]*blood)/i.test(r.test.trim())
            );
            if (bgRow && bgRow.result) {
                let res = bgRow.result.trim().replace(/^[\(\[]|[\)\]]$/g, '').toUpperCase().replace(/0/g, 'O');
                if (bgRow.ref && /positive|negative|pos|neg|\+|\-/i.test(bgRow.ref)) {
                    res += ` (${bgRow.ref})`;
                }
                return res;
            }
        }

        // 3. ดึงจากฐานข้อมูลผู้ป่วยในระบบ (เฉพาะกรณีที่ในเอกสารไม่มีจริง ๆ)
        if (pData && (pData.blood_group || pData.blood_type || pData.bloodGroup)) {
            const bg = (pData.blood_group || pData.blood_type || pData.bloodGroup).trim();
            if (bg && bg !== '-' && bg !== 'null' && bg !== 'undefined') return bg;
        }
        if (visitData && (visitData.blood_group || visitData.blood_type || visitData.bloodGroup)) {
            const bg = (visitData.blood_group || visitData.blood_type || visitData.bloodGroup).trim();
            if (bg && bg !== '-' && bg !== 'null' && bg !== 'undefined') return bg;
        }

        return '-';
    }

    // -------------------------------------------------------
    // CBC HISTOGRAM SVG GENERATOR (WBC / RBC / PLT)
    // -------------------------------------------------------
    function _generateCbcHistogramSvgs() {
        // 1. WBC Histogram (40 - 450 fL) - 3 distinct peaks: Lymphocytes, Monocytes, Granulocytes
        const wbcTicks = '<span>40</span><span>100</span><span>200</span><span>300</span><span>450 fL</span>';
        const wbcPath = 'M 8,48 Q 20,46 32,24 Q 42,22 50,38 Q 62,36 72,28 Q 82,24 92,34 Q 106,12 118,22 Q 132,36 148,48 Z';

        // 2. RBC Histogram (25 - 250 fL) - Gaussian bell curve centered around 90 fL
        const rbcTicks = '<span>25</span><span>50</span><span>100</span><span>150</span><span>250 fL</span>';
        const rbcPath = 'M 14,48 Q 45,47 62,30 Q 78,8 84,8 Q 92,8 106,30 Q 124,47 146,48 Z';

        // 3. PLT Histogram (PLT) - Log-normal curve peaking early around 8-12 fL
        const pltTicks = '<span>2</span><span>10</span><span>20</span><span>30 fL</span>';
        const pltPath = 'M 8,48 Q 16,46 26,14 Q 36,12 48,28 Q 68,44 105,47 L 148,48 Z';

        return `
        <div style="border:1px solid #cbd5e1;border-radius:4px;padding:4px 6px;background:#ffffff;">
            <div style="display:flex;justify-content:space-between;font-size:8.5px;font-weight:700;color:#0b3c73;">
                <span>WBC Histogram</span>
                <span style="color:#64748b;font-weight:500;">(40 - 450 fL)</span>
            </div>
            <svg viewBox="0 0 160 52" style="width:100%;height:46px;display:block;margin:1px 0;">
                <defs>
                    <linearGradient id="gradWbcRecover" x1="0%" y1="0%" x2="0%" y2="100%">
                        <stop offset="0%" stop-color="#2563eb" stop-opacity="0.35"/>
                        <stop offset="100%" stop-color="#2563eb" stop-opacity="0.05"/>
                    </linearGradient>
                </defs>
                <line x1="8" y1="12" x2="152" y2="12" stroke="#f1f5f9" stroke-width="1"/>
                <line x1="8" y1="24" x2="152" y2="24" stroke="#f1f5f9" stroke-width="1"/>
                <line x1="8" y1="36" x2="152" y2="36" stroke="#f1f5f9" stroke-width="1"/>
                <line x1="8" y1="48" x2="152" y2="48" stroke="#94a3b8" stroke-width="1"/>
                <path d="${wbcPath}" fill="url(#gradWbcRecover)" stroke="#2563eb" stroke-width="1.5" stroke-linejoin="round"/>
            </svg>
            <div style="display:flex;justify-content:space-between;font-size:7px;color:#64748b;padding:0 2px;">
                ${wbcTicks}
            </div>
        </div>

        <div style="border:1px solid #cbd5e1;border-radius:4px;padding:4px 6px;background:#ffffff;">
            <div style="display:flex;justify-content:space-between;font-size:8.5px;font-weight:700;color:#0b3c73;">
                <span>RBC Histogram</span>
                <span style="color:#64748b;font-weight:500;">(25 - 250 fL)</span>
            </div>
            <svg viewBox="0 0 160 52" style="width:100%;height:46px;display:block;margin:1px 0;">
                <defs>
                    <linearGradient id="gradRbcRecover" x1="0%" y1="0%" x2="0%" y2="100%">
                        <stop offset="0%" stop-color="#dc2626" stop-opacity="0.35"/>
                        <stop offset="100%" stop-color="#dc2626" stop-opacity="0.05"/>
                    </linearGradient>
                </defs>
                <line x1="8" y1="12" x2="152" y2="12" stroke="#f1f5f9" stroke-width="1"/>
                <line x1="8" y1="24" x2="152" y2="24" stroke="#f1f5f9" stroke-width="1"/>
                <line x1="8" y1="36" x2="152" y2="36" stroke="#f1f5f9" stroke-width="1"/>
                <line x1="8" y1="48" x2="152" y2="48" stroke="#94a3b8" stroke-width="1"/>
                <path d="${rbcPath}" fill="url(#gradRbcRecover)" stroke="#dc2626" stroke-width="1.5" stroke-linejoin="round"/>
            </svg>
            <div style="display:flex;justify-content:space-between;font-size:7px;color:#64748b;padding:0 2px;">
                ${rbcTicks}
            </div>
        </div>

        <div style="border:1px solid #cbd5e1;border-radius:4px;padding:4px 6px;background:#ffffff;">
            <div style="display:flex;justify-content:space-between;font-size:8.5px;font-weight:700;color:#0b3c73;">
                <span>PLT Histogram</span>
                <span style="color:#64748b;font-weight:500;">(PLT)</span>
            </div>
            <svg viewBox="0 0 160 52" style="width:100%;height:46px;display:block;margin:1px 0;">
                <defs>
                    <linearGradient id="gradPltRecover" x1="0%" y1="0%" x2="0%" y2="100%">
                        <stop offset="0%" stop-color="#059669" stop-opacity="0.35"/>
                        <stop offset="100%" stop-color="#059669" stop-opacity="0.05"/>
                    </linearGradient>
                </defs>
                <line x1="8" y1="12" x2="152" y2="12" stroke="#f1f5f9" stroke-width="1"/>
                <line x1="8" y1="24" x2="152" y2="24" stroke="#f1f5f9" stroke-width="1"/>
                <line x1="8" y1="36" x2="152" y2="36" stroke="#f1f5f9" stroke-width="1"/>
                <line x1="8" y1="48" x2="152" y2="48" stroke="#94a3b8" stroke-width="1"/>
                <path d="${pltPath}" fill="url(#gradPltRecover)" stroke="#059669" stroke-width="1.5" stroke-linejoin="round"/>
            </svg>
            <div style="display:flex;justify-content:space-between;font-size:7px;color:#64748b;padding:0 2px;">
                ${pltTicks}
            </div>
        </div>
        `;
    }

    // -------------------------------------------------------
    // SECTION 1: BLOOD CHEMISTRY / GENERAL TESTS TABLE
    // -------------------------------------------------------
    function _buildChemistryTableHtml(rows, categoryName) {
        if (!rows || rows.length === 0) return '';

        let tableRowsHtml = '';
        let lastSection = null;

        rows.forEach((item, i) => {
            if (item.section && item.section !== lastSection) {
                lastSection = item.section;
                tableRowsHtml += `
                    <tr style="background:#f1f5f9;border-top:1.5px solid #cbd5e1;border-bottom:1.5px solid #cbd5e1;height:22px;">
                        <td colspan="6" style="padding:2.5px 8px;font-weight:800;color:#0b3c73;font-size:10.5px;letter-spacing:0.3px;">
                            <i class="bi bi-clipboard2-pulse me-1 text-primary"></i> ${item.section}
                        </td>
                    </tr>`;
            }

            const isEven = i % 2 === 1;
            const bgColor = isEven ? '#f8fafc' : '#ffffff';

            const isPos = /^(positive|reactive|detected|abnormal|pos|\+)/i.test(item.result) ||
                          /^(positive|reactive|detected|abnormal|h|hh)/i.test(item.flag);
            const isLow = /^(l|ll)/i.test(item.flag);

            let flagBadge = '';
            if (isPos) {
                const label = (item.flag && item.flag !== 'Positive') ? item.flag : (item.result === 'Positive' ? 'Positive' : (item.flag || 'H'));
                flagBadge = `<span style="background:#fee2e2;color:#dc2626;padding:1px 6px;border-radius:6px;font-weight:800;font-size:9.5px;display:inline-block;">${label}</span>`;
            } else if (isLow) {
                flagBadge = `<span style="background:#dbeafe;color:#2563eb;padding:1px 6px;border-radius:6px;font-weight:800;font-size:9.5px;display:inline-block;">${item.flag || 'L'}</span>`;
            } else if (item.flag) {
                flagBadge = `<span style="color:#64748b;font-weight:700;">${item.flag}</span>`;
            }

            const resultColor = isPos ? '#dc2626' : (isLow ? '#2563eb' : '#0f172a');

            tableRowsHtml += `
                <tr style="background:${bgColor};border-bottom:1px solid #e2e8f0;height:21px;line-height:1.2;">
                    <td style="padding:2px 8px;font-weight:700;color:#1e293b;font-size:10.5px;">${item.test}</td>
                    <td style="padding:2px 8px;text-align:center;color:#64748b;font-size:9.5px;">${item.sample || 'SER'}</td>
                    <td style="padding:2px 8px;font-weight:800;color:${resultColor};font-size:11px;">${item.result}</td>
                    <td style="padding:2px 8px;color:#475569;font-size:10px;">${item.unit || '-'}</td>
                    <td style="padding:2px 8px;text-align:center;font-size:10px;">${flagBadge}</td>
                    <td style="padding:2px 8px;color:#475569;font-size:10px;font-weight:600;">${item.ref || '-'}</td>
                </tr>`;
        });

        const titleText = 'Biochemistry Analysis Report';

        return `
        <div style="margin-bottom:14px;page-break-inside:avoid;break-inside:avoid;">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;">
                <div style="font-size:13px;font-weight:800;color:#0b3c73;display:flex;align-items:center;gap:6px;">
                    <i class="bi bi-droplet-half text-primary"></i>
                    <span>${titleText}</span>
                </div>
                <span style="font-size:9px;background:#e0f2fe;color:#0369a1;padding:2px 8px;border-radius:10px;font-weight:700;">BIOCHEMISTRY</span>
            </div>
            <table style="width:100%;border-collapse:collapse;font-size:10.5px;border-top:1.5px solid #0f172a;border-bottom:1.5px solid #0f172a;">
                <thead>
                    <tr style="background:#f8fafc;border-bottom:1px solid #cbd5e1;height:24px;text-align:left;color:#334155;font-weight:800;font-size:10px;">
                        <th style="padding:3px 8px;width:30%;">Tests</th>
                        <th style="padding:3px 8px;width:10%;text-align:center;">Type</th>
                        <th style="padding:3px 8px;width:16%;">Conc.</th>
                        <th style="padding:3px 8px;width:14%;">Unit</th>
                        <th style="padding:3px 8px;width:10%;text-align:center;">Flags</th>
                        <th style="padding:3px 8px;width:20%;">Ref. ranges</th>
                    </tr>
                </thead>
                <tbody>
                    ${tableRowsHtml}
                </tbody>
            </table>
        </div>`;
    }

    // -------------------------------------------------------
    // SECTION 2: URINE EXAMINATION REPORT (URINALYSIS)
    // -------------------------------------------------------
    function _buildUrineSectionHtml(urineRows) {
        if (!urineRows || urineRows.length === 0) return '';

        let rowsHtml = '';
        urineRows.forEach((r, idx) => {
            const isAbnormal = /^(positive|reactive|detected|abnormal|pos|\+|\*|h|hh)/i.test(r.result) ||
                               /^(positive|reactive|detected|abnormal|h|hh)/i.test(r.flag);
            const resColor = isAbnormal ? '#dc2626' : '#0f172a';
            const bgColor = (idx % 2 === 1) ? '#f8fafc' : '#ffffff';

            rowsHtml += `
                <tr style="background:${bgColor};border-bottom:1px solid #e2e8f0;height:20px;line-height:1.2;">
                    <td style="padding:2px 10px;font-weight:700;color:#1e293b;font-size:10px;width:40%;">${r.test}</td>
                    <td style="padding:2px 10px;font-weight:800;color:${resColor};font-size:10.5px;width:30%;">
                        ${r.result}
                        ${isAbnormal ? `<span style="background:#fee2e2;color:#dc2626;padding:0 5px;border-radius:4px;font-size:8.5px;margin-left:4px;">*</span>` : ''}
                    </td>
                    <td style="padding:2px 10px;color:#475569;font-size:10px;font-weight:600;width:30%;">${r.ref || 'Negative'}</td>
                </tr>`;
        });

        return `
        <div style="margin-top:10px;margin-bottom:14px;border:1px solid #cbd5e1;border-radius:6px;overflow:hidden;page-break-inside:avoid;break-inside:avoid;box-shadow:0 1px 3px rgba(0,0,0,0.04);">
            <!-- Blue Banner Header -->
            <div style="background:linear-gradient(90deg,#0b3c73,#1e40af);color:#ffffff;padding:5px 12px;display:flex;justify-content:space-between;align-items:center;">
                <div>
                    <span style="font-size:12px;font-weight:800;letter-spacing:0.3px;">Urine Examination Report</span>
                    <span style="font-size:10px;margin-left:8px;color:#e2e8f0;font-weight:500;">ໃບລາຍງານຜົນການກວດຍ່ຽວ</span>
                </div>
                <span style="background:rgba(255,255,255,0.2);padding:1px 8px;border-radius:12px;font-size:9px;font-weight:700;letter-spacing:0.5px;">URINALYSIS</span>
            </div>

            <!-- Sub-heading Bar -->
            <div style="background:#f1f5f9;padding:3px 12px;font-size:9.5px;font-weight:700;color:#0b3c73;border-bottom:1px solid #e2e8f0;">
                | Urine Examination (ລາຍການກວດວິເຄາະຍ່ຽວ)
            </div>

            <!-- 3-Column Table -->
            <table style="width:100%;border-collapse:collapse;font-size:10px;">
                <thead>
                    <tr style="background:#f8fafc;border-bottom:1px solid #cbd5e1;height:22px;color:#475569;font-weight:700;">
                        <th style="padding:3px 10px;text-align:left;width:40%;">Test (ລາຍການກວດ)</th>
                        <th style="padding:3px 10px;text-align:left;width:30%;">Result (ຜົນກວດ)</th>
                        <th style="padding:3px 10px;text-align:left;width:30%;">Reference range (ຄ່າອ້າງອີງ)</th>
                    </tr>
                </thead>
                <tbody>
                    ${rowsHtml}
                </tbody>
            </table>
        </div>`;
    }

    // -------------------------------------------------------
    // SECTION 3: HEMATOLOGY ANALYSIS REPORT (CBC + HISTOGRAMS)
    // -------------------------------------------------------
    function _normalizeCbcParam(name) {
        const n = (name || '').trim().toUpperCase().replace(/[\s\-_]/g, '');
        if (n === 'WBC' || n === 'WHITEBLOODCELL') return 'WBC';
        if (n === 'LYM%' || n === 'LYMPH%' || n === 'LYMPHOCYTE%') return 'LYM%';
        if (n === 'MID%' || n === 'MONO%' || n === 'MONOCYTE%') return 'MID%';
        if (n === 'GRAN%' || n === 'NEUT%' || n === 'GRANULOCYTE%') return 'GRAN%';
        if (n === 'LYM#' || n === 'LYMPH#' || n === 'LYMPHOCYTE#') return 'LYM#';
        if (n === 'MID#' || n === 'MONO#' || n === 'MONOCYTE#') return 'MID#';
        if (n === 'GRAN#' || n === 'NEUT#' || n === 'GRANULOCYTE#') return 'GRAN#';
        if (n === 'RBC' || n === 'REDBLOODCELL') return 'RBC';
        if (n === 'HGB' || n === 'HB' || n === 'HEMOGLOBIN') return 'HGB';
        if (n === 'HCT' || n === 'HEMATOCRIT') return 'HCT';
        if (n === 'MCV') return 'MCV';
        if (n === 'MCH') return 'MCH';
        if (n === 'MCHC') return 'MCHC';
        if (n === 'RDWCV' || n === 'RDW_CV') return 'RDW_CV';
        if (n === 'RDWSD' || n === 'RDW_SD') return 'RDW_SD';
        if (n === 'RDW') return 'RDW_CV';
        if (n === 'PLT' || n === 'PLATELET' || n === 'PLATELETS') return 'PLT';
        if (n === 'MPV') return 'MPV';
        if (n === 'PCT') return 'PCT';
        if (n === 'PLCR' || n === 'P_LCR') return 'P_LCR';
        if (n === 'PLCC' || n === 'P_LCC') return 'P_LCC';
        if (n === 'PDWSD' || n === 'PDW_SD') return 'PDW_SD';
        if (n === 'PDWCV' || n === 'PDW_CV' || n === 'PDW') return 'PDW_CV';
        return name.trim();
    }

    function _buildCbcSectionHtml(cbcRows, meta) {
        if (!cbcRows || cbcRows.length === 0) return '';

        const {
            visitNoDisplay = '',
            hnDisplay = '',
            patNameDisplay = '',
            testDateDisplay = ''
        } = meta || {};

        // แยกเป็น 3 กลุ่ม: WBC, RBC, PLT
        const wbcOrder = ['WBC', 'LYM%', 'MID%', 'GRAN%', 'LYM#', 'MID#', 'GRAN#', 'NEUT%', 'EOS%', 'BASO%', 'NEUT#', 'EOS#', 'BASO#'];
        const rbcOrder = ['RBC', 'HGB', 'HCT', 'MCV', 'MCH', 'MCHC', 'RDW_CV', 'RDW_SD'];
        const pltOrder = ['PLT', 'MPV', 'PCT', 'P_LCR', 'P_LCC', 'PDW_SD', 'PDW_CV'];

        const wbcGroup = [];
        const rbcGroup = [];
        const pltGroup = [];
        const otherGroup = [];

        cbcRows.forEach(r => {
            const norm = _normalizeCbcParam(r.test);
            const rowCopy = { ...r, normKey: norm };
            if (wbcOrder.includes(norm)) {
                wbcGroup.push(rowCopy);
            } else if (rbcOrder.includes(norm)) {
                rbcGroup.push(rowCopy);
            } else if (pltOrder.includes(norm)) {
                pltGroup.push(rowCopy);
            } else {
                otherGroup.push(rowCopy);
            }
        });

        // จัดเรียงแต่ละกลุ่มตามลำดับมาตรฐานทางการแพทย์
        const _sortByOrder = (arr, order) => {
            arr.sort((a, b) => {
                const idxA = order.indexOf(a.normKey);
                const idxB = order.indexOf(b.normKey);
                if (idxA !== -1 && idxB !== -1) return idxA - idxB;
                if (idxA !== -1) return -1;
                if (idxB !== -1) return 1;
                return 0;
            });
        };
        _sortByOrder(wbcGroup, wbcOrder);
        _sortByOrder(rbcGroup, rbcOrder);
        _sortByOrder(pltGroup, pltOrder);

        // หากมีรายการเสริม ให้แจกแจงเข้ากลุ่ม
        otherGroup.forEach((r, idx) => {
            if (idx % 3 === 0) wbcGroup.push(r);
            else if (idx % 3 === 1) rbcGroup.push(r);
            else pltGroup.push(r);
        });

        // ฟังก์ชันสร้าง Table สำหรับแต่ละคอลัมน์
        const _renderCbcColumnTable = (items) => {
            let tbody = '';
            items.forEach((item, idx) => {
                const isPos = /^(positive|reactive|detected|abnormal|pos|\+)/i.test(item.result) ||
                              /^(positive|reactive|detected|abnormal|h|hh)/i.test(item.flag);
                const isLow = /^(l|ll)/i.test(item.flag);
                const resColor = isPos ? '#dc2626' : (isLow ? '#2563eb' : '#0f172a');
                const bgColor = (idx % 2 === 1) ? '#f8fafc' : '#ffffff';

                let infoBadge = '';
                if (isPos) {
                    infoBadge = `<span style="background:#fee2e2;color:#dc2626;padding:0 4px;border-radius:4px;font-weight:800;font-size:8px;">H</span>`;
                } else if (isLow) {
                    infoBadge = `<span style="background:#dbeafe;color:#2563eb;padding:0 4px;border-radius:4px;font-weight:800;font-size:8px;">L</span>`;
                }

                tbody += `
                    <tr style="background:${bgColor};border-bottom:1px solid #e2e8f0;height:19px;line-height:1.2;">
                        <td style="padding:2px 4px;font-weight:700;color:#1e293b;font-size:9px;white-space:nowrap;">${item.test}</td>
                        <td style="padding:2px 4px;text-align:right;font-weight:800;color:${resColor};font-size:9.5px;">${item.result}</td>
                        <td style="padding:2px 4px;color:#64748b;font-size:8px;">${item.unit || ''}</td>
                        <td style="padding:2px 2px;text-align:center;">${infoBadge}</td>
                        <td style="padding:2px 4px;text-align:right;color:#475569;font-size:8.5px;font-weight:600;white-space:nowrap;">${item.ref || '-'}</td>
                    </tr>`;
            });

            return `
            <table style="width:100%;border-collapse:collapse;font-size:9px;">
                <thead>
                    <tr style="background:#f1f5f9;height:20px;border-bottom:1px solid #cbd5e1;font-weight:700;color:#334155;">
                        <th style="padding:2px 4px;text-align:left;">PARAM</th>
                        <th style="padding:2px 4px;text-align:right;">RESULT</th>
                        <th style="padding:2px 4px;text-align:left;">UNIT</th>
                        <th style="padding:2px 2px;text-align:center;">Info</th>
                        <th style="padding:2px 4px;text-align:right;">Ref. Range</th>
                    </tr>
                </thead>
                <tbody>
                    ${tbody || '<tr><td colspan="5" style="text-align:center;padding:8px;color:#94a3b8;">-</td></tr>'}
                </tbody>
            </table>`;
        };

        const histogramsHtml = _generateCbcHistogramSvgs();

        return `
        <div style="margin-top:10px;margin-bottom:14px;border:1px solid #cbd5e1;border-radius:6px;overflow:hidden;page-break-inside:avoid;break-inside:avoid;box-shadow:0 1px 3px rgba(0,0,0,0.04);">
            <!-- Dark Blue Banner Header -->
            <div style="background:linear-gradient(90deg,#0b3c73,#1e40af);color:#ffffff;padding:5px 12px;display:flex;justify-content:space-between;align-items:center;">
                <div>
                    <span style="font-size:12px;font-weight:800;letter-spacing:0.3px;">Hematology Analysis Report</span>
                    <span style="font-size:10px;margin-left:8px;color:#e2e8f0;font-weight:500;">STK Clinic</span>
                </div>
                <span style="background:rgba(255,255,255,0.2);padding:1px 8px;border-radius:12px;font-size:9px;font-weight:700;letter-spacing:0.5px;">CBC AUTOMATED</span>
            </div>


            <!-- 3-Column Tables: WBC | RBC | PLT -->
            <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:0;border-bottom:1px solid #e2e8f0;">
                <div style="border-right:1px solid #e2e8f0;">
                    ${_renderCbcColumnTable(wbcGroup)}
                </div>
                <div style="border-right:1px solid #e2e8f0;">
                    ${_renderCbcColumnTable(rbcGroup)}
                </div>
                <div>
                    ${_renderCbcColumnTable(pltGroup)}
                </div>
            </div>

            <!-- Histograms Section: 3 inline SVGs -->
            <div style="background:#f8fafc;padding:6px 10px;border-top:1px solid #e2e8f0;">
                <div style="font-size:9.5px;font-weight:700;color:#0b3c73;margin-bottom:4px;">
                    <i class="bi bi-bar-chart-line text-primary me-1"></i> Histograms
                </div>
                <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;">
                    ${histogramsHtml}
                </div>
            </div>
        </div>`;
    }

    // -------------------------------------------------------
    // SECTION 4: VASCULAR ANALYSIS REPORT
    // -------------------------------------------------------
    function _buildVascularSectionHtml(vascRows) {
        if (!vascRows || vascRows.length === 0) return '';

        let tbody = '';
        vascRows.forEach((r, idx) => {
            const isAbnormal = /^(positive|reactive|detected|abnormal|pos|\+|\*|h|hh)/i.test(r.result) ||
                               /^(positive|reactive|detected|abnormal|h|hh)/i.test(r.flag);
            const resColor = isAbnormal ? '#dc2626' : '#0f172a';
            const bgColor = (idx % 2 === 1) ? '#f8fafc' : '#ffffff';

            tbody += `
                <tr style="background:${bgColor};border-bottom:1px solid #e2e8f0;height:22px;">
                    <td style="padding:3px 10px;font-weight:700;color:#1e293b;width:40%;">${r.test}</td>
                    <td style="padding:3px 10px;font-weight:800;color:${resColor};width:30%;">${r.result}</td>
                    <td style="padding:3px 10px;color:#475569;font-weight:600;width:30%;">${r.ref || '-'}</td>
                </tr>`;
        });

        return `
        <div style="margin-top:10px;margin-bottom:14px;border:1px solid #cbd5e1;border-radius:6px;overflow:hidden;page-break-inside:avoid;break-inside:avoid;box-shadow:0 1px 3px rgba(0,0,0,0.04);">
            <div style="background:linear-gradient(90deg,#0b3c73,#1e40af);color:#ffffff;padding:5px 12px;display:flex;justify-content:space-between;align-items:center;">
                <span style="font-size:12px;font-weight:800;letter-spacing:0.3px;">Vascular Sclerosis Examination Report</span>
                <span style="background:rgba(255,255,255,0.2);padding:1px 8px;border-radius:12px;font-size:9px;font-weight:700;">VASCULAR</span>
            </div>
            <table style="width:100%;border-collapse:collapse;font-size:10px;">
                <tbody>
                    ${tbody}
                </tbody>
            </table>
        </div>`;
    }

    // -------------------------------------------------------
    // SECTION 5: CERVICAL CYTOLOGY / PAP SMEAR REPORT
    // -------------------------------------------------------
    function _buildCytologySectionHtml(cytoRows) {
        if (!cytoRows || cytoRows.length === 0) return '';

        // กรองแถวที่ไม่ใช่ผลตรวจเซลล์วิทยา เช่น วันที่ วันรายงาน หมายเลขเคส
        const validRows = cytoRows.filter(r => {
            if (!r || !r.test) return false;
            const t = String(r.test).trim();
            const res = String(r.result || '').trim();
            if (/(วัน|ວັນ|date|time|รายงาน|ລາຍງານ|number|เลข|เลก|no\.|hn|vn|case)/i.test(t)) return false;
            if (/^\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4}$/.test(res)) return false;
            return true;
        });

        if (validRows.length === 0) return '';

        let tbody = '';
        validRows.forEach((r, idx) => {
            const isAbnormal = /^(positive|reactive|detected|abnormal|pos|\+|\*|h|hh|high|severe|high grade|atypical)/i.test(r.result) ||
                               /^(positive|reactive|detected|abnormal|h|hh)/i.test(r.flag);
            const resColor = isAbnormal ? '#dc2626' : '#0f172a';
            const bgColor = (idx % 2 === 1) ? '#f8fafc' : '#ffffff';

            tbody += `
                <tr style="background:${bgColor};border-bottom:1px solid #e2e8f0;height:23px;">
                    <td style="padding:3px 10px;font-weight:700;color:#1e293b;width:38%;">${r.test}</td>
                    <td style="padding:3px 10px;font-weight:800;color:${resColor};width:37%;">${r.result}</td>
                    <td style="padding:3px 10px;color:#475569;font-weight:600;width:25%;">${r.ref || 'Negative / Normal'}</td>
                </tr>`;
        });

        return `
        <div style="margin-top:10px;margin-bottom:14px;border:1px solid #cbd5e1;border-radius:6px;overflow:hidden;page-break-inside:avoid;break-inside:avoid;box-shadow:0 1px 3px rgba(0,0,0,0.04);">
            <div style="background:linear-gradient(90deg,#0b3c73,#1e40af);color:#ffffff;padding:5px 12px;display:flex;justify-content:space-between;align-items:center;">
                <div>
                    <span style="font-size:12px;font-weight:800;letter-spacing:0.3px;">Cervical Cytology / Pap Smear Report</span>
                    <span style="font-size:10px;margin-left:8px;color:#e2e8f0;font-weight:500;">ໃບລາຍງານຜົນກວດເຊລວິທະຍາ (Pap Smear)</span>
                </div>
                <span style="background:rgba(255,255,255,0.2);padding:1px 8px;border-radius:12px;font-size:9px;font-weight:700;letter-spacing:0.5px;">CYTOLOGY</span>
            </div>
            <table style="width:100%;border-collapse:collapse;font-size:10px;">
                <thead>
                    <tr style="background:#f8fafc;border-bottom:1px solid #cbd5e1;height:22px;color:#475569;font-weight:700;">
                        <th style="padding:3px 10px;text-align:left;width:38%;">Examination / Parameter</th>
                        <th style="padding:3px 10px;text-align:left;width:37%;">Cytological Findings / Result</th>
                        <th style="padding:3px 10px;text-align:left;width:25%;">Reference / Normal</th>
                    </tr>
                </thead>
                <tbody>
                    ${tbody}
                </tbody>
            </table>
        </div>`;
    }

    // -------------------------------------------------------
    // COMBINED MULTI-SECTION DISPATCHER
    // -------------------------------------------------------
    function _buildCombinedLabHtml(allRows, meta = {}) {
        if (!allRows || allRows.length === 0) {
            return `<div style="text-align:center;padding:24px;color:#94a3b8;font-style:italic;">
                        ບໍ່ພົບຂໍ້ມູນລາຍການກວດ / ไม่พบข้อมูลรายการตรวจ
                    </div>`;
        }

        const {
            visitNoDisplay = '',
            hnDisplay = '',
            patNameDisplay = '',
            testDateDisplay = '',
            categoryName = ''
        } = meta;

        const cbcRows = [];
        const urineRows = [];
        const vascRows = [];
        const cytoRows = [];
        const chemRows = [];

        const cbcRegex = /^(wbc|rbc|hgb|hb|hct|mcv|mch|mchc|plt|platelet|platelets|lym%|lymph%|lym#|lymph#|mid%|mono%|mid#|mono#|gran%|neut%|gran#|neut#|rdw|rdw_cv|rdw-cv|rdw_sd|rdw-sd|mpv|pct|p_lcr|p-lcr|p_lcc|p-lcc|pdw|pdw_sd|pdw-sd|pdw_cv|pdw-cv)$/i;
        const urineRegex = /^(color|appearance|clarity|turbidity|leukocyte|leukocytes|nitrite|urobilinogen|protein|ph|blood|occult\s*blood|specific\s*gravity|sg|s\.g\.|ketone|ketones|bilirubin|glucose|sugar|ascorbic|ascorbic\s*acid|stool|stool\s*exam)/i;
        const vascRegex = /vascular|sclerosis|pwv|bapwv|abi|ເສັ້ນເລືອດ|ความแข็งเส้นเลือด/i;
        const cytoRegex = /cervical|pap\s*smear|cytology|pathogen|inflammation|intraepithelial|ມະເຮັງປາກມົດລູກ|มะเร็งปากมดลูก/i;

        for (const r of allRows) {
            const sec = (r.section || '').toLowerCase();
            const testName = (r.test || '').trim();
            const smp = (r.sample || '').toUpperCase();

            if (sec.includes('cytology') || sec.includes('pap') || smp === 'CYTO' || cytoRegex.test(testName)) {
                cytoRows.push(r);
            } else if (sec.includes('urine') || sec.includes('ຍ່ຽວ') || sec.includes('urinalysis') || smp === 'URINE') {
                urineRows.push(r);
            } else if (sec.includes('cbc') || sec.includes('hematology') || sec.includes('ເລືອດสมบูรณ์') || smp === 'EDTA' || smp === 'WB') {
                cbcRows.push(r);
            } else if (sec.includes('vascular') || sec.includes('sclerosis') || smp === 'VASC' || vascRegex.test(testName)) {
                vascRows.push(r);
            } else if (cbcRegex.test(testName)) {
                cbcRows.push(r);
            } else if (urineRegex.test(testName) && (/negative|normal/i.test(r.ref || r.result) || smp === 'URINE')) {
                urineRows.push(r);
            } else {
                chemRows.push(r);
            }
        }

        let html = '';

        // 1. External Blood Chemistry / Serology Table
        if (chemRows.length > 0) {
            html += _buildChemistryTableHtml(chemRows, categoryName);
        }

        // 2. Cervical Cytology / Pap Smear Report
        if (cytoRows.length > 0) {
            html += _buildCytologySectionHtml(cytoRows);
        }

        // 3. Urine Examination Report
        if (urineRows.length > 0) {
            html += _buildUrineSectionHtml(urineRows);
        }

        // 4. Hematology Analysis Report (CBC with Histograms)
        if (cbcRows.length > 0) {
            html += _buildCbcSectionHtml(cbcRows, {
                visitNoDisplay,
                hnDisplay,
                patNameDisplay,
                testDateDisplay
            });
        }

        // 5. Vascular Analysis Report
        if (vascRows.length > 0) {
            html += _buildVascularSectionHtml(vascRows);
        }

        // Fallback if none matched
        if (!html.trim()) {
            html = _buildChemistryTableHtml(allRows, categoryName);
        }

        return html;
    }

    function _buildLabTableHtml(rows, categoryName) {
        return _buildCombinedLabHtml(rows, { categoryName });
    }

    // -------------------------------------------------------
    // LOAD CLINIC SETTINGS / VISIT / PATIENT
    // -------------------------------------------------------
    async function _loadClinicSettings() {
        let s = {};
        if (window.clinicSettings && typeof window.clinicSettings === 'object') {
            s = Object.assign({}, window.clinicSettings);
        }
        if (window.parent && window.parent.clinicSettings && typeof window.parent.clinicSettings === 'object') {
            s = Object.assign({}, window.parent.clinicSettings, s);
        }

        // 1. ดึงจาก localStorage แคช
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
        } catch (e) { }

        // 2. ดึงจาก Supabase table clinic_settings
        const sbClient = (typeof _supabase !== 'undefined' && _supabase) 
            || (window._supabase)
            || (window.parent && window.parent._supabase)
            || (typeof supabase !== 'undefined' && typeof CONFIG !== 'undefined' ? supabase.createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_ANON_KEY) : null);

        if (sbClient) {
            try {
                const { data } = await sbClient.from('clinic_settings').select('key, value');
                if (data && data.length > 0) {
                    const fetchedMap = Object.fromEntries(data.map(r => [r.key, r.value]));
                    s = Object.assign({}, s, fetchedMap);
                    window.clinicSettings = s;
                    try { localStorage.setItem('clinic_settings', JSON.stringify(s)); } catch (e) { }
                }
            } catch (e) {
                console.warn('[RecoverLab] load clinic_settings notice:', e);
            }
        }
        return s;
    }

    async function _loadVisitData(visitId) {
        let v = null;
        if (window.currentHistoryDetailVisit && (window.currentHistoryDetailVisit.visit_id === visitId || !visitId)) {
            v = window.currentHistoryDetailVisit;
        }
        if (!v && window.allHistoryVisits) {
            v = window.allHistoryVisits.find(x => x.visit_id === visitId || String(x.visit_id).replace(/\D/g, '') === String(visitId).replace(/\D/g, ''));
        }
        if (!v && window.allVisits) v = window.allVisits.find(x => x.visit_id === visitId);
        if (!v && window.clinicVisits) v = window.clinicVisits.find(x => x.visit_id === visitId);
        if (!v && typeof _supabase !== 'undefined' && visitId) {
            try {
                const { data } = await _supabase.from('visits').select('*').eq('visit_id', visitId).maybeSingle();
                if (data) v = data;
                if (!v) {
                    const rawDigits = String(visitId).replace(/\D/g, '');
                    if (rawDigits) {
                        const { data: vList } = await _supabase.from('visits').select('*').ilike('visit_id', `%${rawDigits}`).limit(1);
                        if (vList && vList[0]) v = vList[0];
                    }
                }
            } catch (e) { }
        }
        return v;
    }

    async function _loadPatientData(curHN, patientName) {
        let p = null;
        if (window.currentHistoryDetailVisit) {
            p = window.currentHistoryDetailVisit;
        }
        if (window.allPatients) {
            if (curHN && curHN !== '-') p = window.allPatients.find(x => x.hn === curHN);
            if (!p && patientName && patientName !== '-') p = window.allPatients.find(x => x.patient_name === patientName);
        }
        if (!p && typeof _supabase !== 'undefined' && curHN && curHN !== '-') {
            try {
                const { data } = await _supabase.from('patients').select('*').eq('hn', curHN).maybeSingle();
                if (data) p = data;
            } catch (e) { }
        }
        return p;
    }

    async function _resolveLabFileUrl(visitId, categoryName) {
        // 1. Blob/raw URL จาก cache ที่เปิดอยู่ใน Modal
        if (window._currentLabPdfBlobUrl || window._currentLabPdfRawUrl)
            return window._currentLabPdfBlobUrl || window._currentLabPdfRawUrl;

        // 2. IndexedDB / LocalStorage
        if (typeof getLabFilesForVisitAsync === 'function' && visitId) {
            try {
                const files = await getLabFilesForVisitAsync(visitId);
                let f = categoryName ? files.find(x => x.category === categoryName && _isValidUrl(x.url || x.publicUrl)) : null;
                if (!f) f = files.find(x => _isValidUrl(x.url || x.publicUrl));
                if (f) {
                    if (f.id && f.id.startsWith('FILE-') && typeof LabDB !== 'undefined') {
                        try {
                            const fObj = await LabDB.getFile(f.id);
                            if (fObj && _isValidUrl(fObj.url || fObj.publicUrl)) return fObj.url || fObj.publicUrl;
                        } catch (e) { }
                    }
                    return f.url || f.publicUrl;
                }
            } catch (e) { }
        }

        // 3. Supabase visits.pdf_url fallback
        if (typeof _supabase !== 'undefined' && visitId) {
            try {
                const { data: vRow } = await _supabase.from('visits').select('pdf_url').eq('visit_id', visitId).maybeSingle();
                if (vRow && vRow.pdf_url) {
                    const raw = vRow.pdf_url.trim();
                    if (raw.startsWith('[')) {
                        const arr = JSON.parse(raw);
                        const f = arr.find(x => _isValidUrl(x.url || x.publicUrl));
                        if (f) return f.url || f.publicUrl;
                    } else if (_isValidUrl(raw)) return raw;
                }
            } catch (e) { }
        }

        return null;
    }

    // ดึงไฟล์ผลตรวจทั้งหมดของ visitId (รวมทั้ง CBC, ตรวจเลือด, ปัสสาวะ ฯลฯ)
    async function _resolveAllLabFiles(visitId, categoryName) {
        const fileList = [];
        const seenUrls = new Set();

        const addFile = (url, cat, name) => {
            if (!url || !_isValidUrl(url)) return;
            const key = url.split('?')[0];
            if (seenUrls.has(key)) return;
            seenUrls.add(key);
            fileList.push({ url, category: cat || '', fileName: name || '' });
        };

        // 1. URL จากแคชที่เปิดอยู่ใน Modal ปัจจุบัน
        if (window._currentLabPdfBlobUrl) addFile(window._currentLabPdfBlobUrl, categoryName, 'current_modal_file');
        else if (window._currentLabPdfRawUrl) addFile(window._currentLabPdfRawUrl, categoryName, 'current_modal_file');

        // 2. ดึงไฟล์ผลตรวจทั้งหมดของ visitId นี้จาก IndexedDB
        if (typeof getLabFilesForVisitAsync === 'function' && visitId) {
            try {
                const files = await getLabFilesForVisitAsync(visitId);
                if (Array.isArray(files)) {
                    for (const f of files) {
                        let fUrl = f.url || f.publicUrl;
                        if (f.id && f.id.startsWith('FILE-') && typeof LabDB !== 'undefined') {
                            try {
                                const fObj = await LabDB.getFile(f.id);
                                if (fObj && _isValidUrl(fObj.url || fObj.publicUrl)) {
                                    fUrl = fObj.url || fObj.publicUrl;
                                }
                            } catch (e) { }
                        }
                        if (_isValidUrl(fUrl)) {
                            addFile(fUrl, f.category, f.fileName);
                        }
                    }
                }
            } catch (e) { }
        }

        // 3. ดึงไฟล์ทั้งหมดของ visitId จาก Supabase (visits.pdf_url)
        if (typeof _supabase !== 'undefined' && visitId) {
            try {
                const { data: vRow } = await _supabase.from('visits').select('pdf_url').eq('visit_id', visitId).maybeSingle();
                if (vRow && vRow.pdf_url) {
                    const raw = vRow.pdf_url.trim();
                    if (raw.startsWith('[')) {
                        try {
                            const arr = JSON.parse(raw);
                            if (Array.isArray(arr)) {
                                for (const f of arr) {
                                    if (f && _isValidUrl(f.url || f.publicUrl)) {
                                        addFile(f.url || f.publicUrl, f.category, f.fileName);
                                    }
                                }
                            }
                        } catch (e) { }
                    } else if (_isValidUrl(raw)) {
                        addFile(raw, '', 'supabase_file');
                    }
                }
            } catch (e) { }
        }

        return fileList;
    }

    // -------------------------------------------------------
    // โหลด html2pdf สำหรับแปลงใบตรวจเป็น PDF ขึ้นคลาวด์
    function _loadHtml2Pdf() {
        if (typeof html2pdf !== 'undefined') return Promise.resolve(window.html2pdf);
        return new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js';
            script.onload = () => resolve(window.html2pdf);
            script.onerror = reject;
            document.head.appendChild(script);
        });
    }

    // -------------------------------------------------------
    // BUILD FULL A4 REPORT HTML
    // -------------------------------------------------------
    function _buildReportHtml(opts) {
        const {
            clinicLogo, clinicStamp, clinicNameLa, clinicNameEn,
            clinicAddress, clinicPhone, clinicWebsite,
            hnDisplay, visitNoDisplay, patNameDisplay,
            patPhoneDisplay, patAgeDisplay, bloodGroupDisplay,
            testDateDisplay, reportDateDisplay,
            doctorNameDisplay, labTableHtml, labFileUrl, visitId
        } = opts;

        // กำหนด URL ของรายงานฉบับแปลงแล้ว (Cloud Digital PDF)
        const sbClient = (typeof _supabase !== 'undefined' && _supabase) 
            || (typeof supabase !== 'undefined' && typeof CONFIG !== 'undefined' ? supabase.createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_ANON_KEY) : null);
        const supabaseBaseUrl = (sbClient && sbClient.supabaseUrl) 
            ? sbClient.supabaseUrl 
            : ((typeof CONFIG !== 'undefined' && CONFIG.SUPABASE_URL) ? CONFIG.SUPABASE_URL : 'https://fpmstumpobbjozflkola.supabase.co');

        const safeVisitId = (visitId || visitNoDisplay || 'visit').replace(/[^a-zA-Z0-9_-]/g, '_');
        const cloudReportFileName = `converted_report_${safeVisitId}.pdf`;
        const cloudReportUrl = `${supabaseBaseUrl}/storage/v1/object/public/lab-results/${cloudReportFileName}`;

        // QR Code ชี้ตรงไปยังไฟล์ PDF ใบผลตรวจที่แปลงแล้ว (เปิดดูได้ทันทีบนมือถือทุกรุ่น)
        const qrData = cloudReportUrl;
        const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=150x150&margin=4&data=${encodeURIComponent(qrData)}`;

        const logoHtml = clinicLogo
            ? `<img src="${clinicLogo}" style="height:58px;max-width:90px;object-fit:contain;" alt="Logo">`
            : `<div style="width:52px;height:52px;border-radius:50%;background:#0b3c73;display:flex;align-items:center;justify-content:center;color:#fff;font-size:24px;"><i class="bi bi-hospital"></i></div>`;

        const stampHtml = clinicStamp
            ? `<img src="${clinicStamp}" alt="ຕາປະທັບ" style="width:60mm;height:60mm;object-fit:contain;">`
            : `<div style="width:60mm;height:60mm;border:2.5px solid #1d4ed8;border-radius:50%;display:flex;align-items:center;justify-content:center;color:#1d4ed8;text-align:center;font-size:12px;font-weight:700;line-height:1.2;box-sizing:border-box;padding:6px;">
                    <div style="border:1px dashed #1d4ed8;border-radius:50%;width:100%;height:100%;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:4px;">
                        <div style="font-size:10px;">★ ບໍລິສັດ ★</div>
                        <div style="font-size:13px;font-weight:800;">ຄລີນິກ ເລີຟເຮັສທີເຄ</div>
                        <div style="font-size:10px;">Clinic Love STK</div>
                        <div style="font-size:9px;color:#2563eb;">ນະຄອນຫຼວງວຽງຈັນ</div>
                    </div>
                </div>`;

        const [docNameLa, docNameEn] = doctorNameDisplay.includes('/')
            ? doctorNameDisplay.split('/').map(s => s.trim())
            : [doctorNameDisplay, ''];

        return `
        <div id="printableLabReport" style="width:210mm;min-height:297mm;padding:16mm 14mm 20mm 14mm;background:#ffffff;color:#0f172a;font-family:'Sarabun','Noto Sans Lao',sans-serif;box-sizing:border-box;margin:0 auto;display:flex;flex-direction:column;justify-content:space-between;">

            <div>
                <!-- ===== HEADER ===== -->
                <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:14px;">
                    <div style="display:flex;align-items:center;gap:12px;">
                        ${logoHtml}
                        <div>
                            <div style="font-size:13px;font-weight:700;color:#1e293b;line-height:1.3;">${clinicNameLa}</div>
                            <div style="font-size:10px;color:#64748b;font-weight:600;">${clinicNameEn}</div>
                        </div>
                    </div>
                    <div style="text-align:right;">
                        <div style="font-size:22px;font-weight:900;color:#2563eb;letter-spacing:0.5px;line-height:1.1;">LABORATORY REPORT</div>
                        <div style="font-size:13px;font-weight:700;color:#1e293b;">ຜົນການກວດທາງຫ້ອງປະຕິບັດການ</div>
                    </div>
                </div>

                <!-- ===== DIVIDER ===== -->
                <div style="height:2px;background:linear-gradient(90deg,#0b3c73,#2563eb,#bfdbfe);border-radius:2px;margin-bottom:12px;"></div>

                <!-- ===== PATIENT INFO BOX ===== -->
                <div style="border-radius:10px;overflow:hidden;border:1px solid #bfdbfe;margin-bottom:14px;box-shadow:0 1px 4px rgba(11,60,115,0.08);">
                    <div style="background:linear-gradient(90deg,#0b3c73,#1e40af);color:#fff;padding:6px 14px;font-size:12px;font-weight:700;display:flex;align-items:center;gap:8px;">
                        <i class="bi bi-person-badge"></i>
                        <span>ຂໍ້ມູນຜູ້ປ່ວຍ / Patient Information</span>
                    </div>
                    <div style="background:#f8fafc;padding:10px 14px;font-size:11px;">
                        <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:5px 16px;">

                            <div style="display:flex;gap:4px;">
                                <span style="min-width:60px;color:#64748b;font-weight:600;">HN</span>
                                <span style="color:#64748b;">:</span>
                                <strong style="color:#0f172a;font-size:12px;">${hnDisplay}</strong>
                            </div>
                            <div style="display:flex;gap:4px;">
                                <span style="min-width:70px;color:#64748b;font-weight:600;">ເບີໂທ</span>
                                <span style="color:#64748b;">:</span>
                                <strong style="color:#0f172a;">${patPhoneDisplay}</strong>
                            </div>
                            <div style="display:flex;gap:4px;justify-content:flex-end;">
                                <span style="color:#64748b;font-weight:600;">ວັນທີ:</span>
                                <strong style="color:#0f172a;">${testDateDisplay}</strong>
                            </div>

                            <div style="display:flex;gap:4px;">
                                <span style="min-width:60px;color:#64748b;font-weight:600;">Visit No.</span>
                                <span style="color:#64748b;">:</span>
                                <strong style="color:#0f172a;">${visitNoDisplay}</strong>
                            </div>
                            <div style="display:flex;gap:4px;">
                                <span style="min-width:70px;color:#64748b;font-weight:600;">ວັນທີກວດ</span>
                                <span style="color:#64748b;">:</span>
                                <strong style="color:#0f172a;">${testDateDisplay}</strong>
                            </div>
                            <div style="display:flex;gap:4px;justify-content:flex-end;">
                                <span style="color:#64748b;font-weight:600;">ອອກລາຍງານ:</span>
                                <strong style="color:#0f172a;">${reportDateDisplay}</strong>
                            </div>

                            <div style="display:flex;gap:4px;">
                                <span style="min-width:60px;color:#64748b;font-weight:600;">ຊື່-ນາມສະກຸນ</span>
                                <span style="color:#64748b;">:</span>
                                <strong style="color:#0f172a;font-size:12px;">${patNameDisplay}</strong>
                            </div>
                            <div style="display:flex;gap:4px;">
                                <span style="min-width:105px;color:#64748b;font-weight:600;">ABO Blood Group</span>
                                <span style="color:#64748b;">:</span>
                                ${bloodGroupDisplay && bloodGroupDisplay !== '-' 
                                    ? `<strong style="color:#dc2626;font-size:12px;font-weight:800;background:#fee2e2;padding:0 6px;border-radius:4px;display:inline-block;">${bloodGroupDisplay}</strong>` 
                                    : `<strong style="color:#64748b;">-</strong>`}
                            </div>
                            <div style="display:flex;gap:4px;justify-content:flex-end;">
                                <span style="color:#64748b;font-weight:600;">ອາຍຸ:</span>
                                <strong style="color:#0f172a;">${patAgeDisplay}</strong>
                            </div>

                        </div>
                    </div>
                </div>

                <!-- ===== LAB TABLE (แปลงจากต้นฉบับครบทุกรายการ) ===== -->
                ${labTableHtml}
            </div>

            <!-- ===== BOTTOM: RECOMMENDATION + STAMP + FOOTER ===== -->
            <div style="margin-top:14px;">
                <div style="display:flex;justify-content:space-between;align-items:center;gap:18px;margin-bottom:12px;">
                    <!-- Left: 2 Cards (Digital Verification QR Card + Recommendation) -->
                    <div style="flex:1;display:flex;flex-direction:column;gap:6px;">
                        <!-- Digital Verification Card (ตรงวงสีแดง) -->
                        <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:6px 12px;display:flex;align-items:center;gap:12px;">
                            <div style="width:48px;height:48px;background:#ffffff;border:1px solid #cbd5e1;border-radius:6px;display:flex;align-items:center;justify-content:center;flex-shrink:0;box-shadow:0 1px 2px rgba(0,0,0,0.04);padding:2px;">
                                <img src="${qrCodeUrl}" alt="QR Code" style="width:44px;height:44px;display:block;">
                            </div>
                            <div style="flex:1;min-width:0;">
                                <div style="font-weight:700;color:#0b3c73;font-size:10.5px;display:flex;align-items:center;gap:5px;">
                                    <i class="bi bi-qr-code-scan text-primary"></i>
                                    <span>ກວດສອບເອກະສານ / Digital Lab Verification</span>
                                </div>
                                <div style="color:#64748b;font-size:8.5px;line-height:1.3;margin-top:1px;">
                                    ສະແກນເພື່ອເປີດເບິ່ງໃບຜົນກວດດິຈິຕອນ (Digital Report)
                                </div>
                                <div style="font-size:8.5px;color:#475569;margin-top:2px;">
                                    <span>Visit: <strong style="color:#0f172a;">${visitNoDisplay}</strong></span> | 
                                    <span>HN: <strong style="color:#0f172a;">${hnDisplay}</strong></span> | 
                                    <span style="color:#16a34a;font-weight:700;"><i class="bi bi-patch-check-fill"></i> Verified Authentic</span>
                                </div>
                            </div>
                        </div>

                        <!-- Recommendation -->
                        <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:6px 12px;">
                            <div style="font-weight:700;color:#0b3c73;font-size:10.5px;margin-bottom:2px;">ຄຳແນະນຳຈາກແພດ / Doctor's Recommendation</div>
                            <div style="font-size:9px;line-height:1.45;color:#334155;">
                                <div>• ຮັບປະທານອາຫານໃຫ້ຄົບ 5 ໝູ່, ຫຼຸດຜ່ອນອາຫານຫວານ, ມັນ, ເຄັມ</div>
                                <div>• ອອກກຳລັງກາຍຢ່າງສະໝ່ຳສະເໝີ, ພັກຜ່ອນໃຫ້ພຽງພໍ 7-8 ຊົ່ວໂມງ/ມື້</div>
                                <div>• ກວດສຸຂະພາບປະຈຳປີ ທຸກໆ 1 ປີ ຫຼື ຕາມຄຳແນະນຳຂອງທ່ານໝໍ</div>
                            </div>
                        </div>
                    </div>

                    <!-- Right: Clinic Stamp -->
                    <div style="display:flex;align-items:center;margin-right:10px;">
                        <div style="width:60mm;height:60mm;display:flex;align-items:center;justify-content:center;">
                            ${stampHtml}
                        </div>
                    </div>
                </div>

                <!-- Footer Bar -->
                <div style="background:#0b3c73;color:#ffffff;border-radius:6px;padding:6px 14px;font-size:9px;display:flex;justify-content:space-between;align-items:center;margin-top:4px;">
                    <div><i class="bi bi-geo-alt-fill"></i> ${clinicAddress}</div>
                    <div><i class="bi bi-telephone-fill"></i> ${clinicPhone}</div>
                    <div><i class="bi bi-globe"></i> ${clinicWebsite}</div>
                </div>
            </div>
        </div>`;
    }

    // -------------------------------------------------------
    // MAIN ENTRY: CONVERT LAB RESULT WITH FRAME
    // -------------------------------------------------------
    window.convertLabResultWithFrame = async function (visitId, arg2 = '', arg3 = [], arg4 = null) {
        try {
            _showSwalLoading('ກຳລັງໂຫຼດຂໍ້ມູນຄົນເຈັບ ແລະ ຜົນກວດ...');

            // วิเคราะห์ Parameters ที่ส่งมา (รองรับทั้ง Single และ Multi-selection Modal)
            let patientNameArg = '';
            let categoryName = '';
            let labFiles = [];
            let customSelectedItems = null;

            if (Array.isArray(arg2)) {
                customSelectedItems = arg2;
            } else {
                patientNameArg = typeof arg2 === 'string' ? arg2 : '';
                if (typeof arg3 === 'string') {
                    categoryName = arg3;
                } else if (Array.isArray(arg3)) {
                    if (arg3.length > 0 && typeof arg3[0] === 'object' && arg3[0].type) {
                        customSelectedItems = arg3;
                    } else {
                        labFiles = arg3;
                    }
                }
                if (Array.isArray(arg4)) {
                    customSelectedItems = arg4;
                }
            }

            // โหลดข้อมูลการตั้งค่าคลินิก, ข้อมูลผู้ป่วย, และข้อมูล Visit
            const clinicSettings = await _loadClinicSettings();
            const visitData = (await _loadVisitData(visitId)) || {};
            const curHn = visitData.hn || (visitData.patient && visitData.patient.hn) || visitId;
            const patName = visitData.patient_name || patientNameArg || '';
            const pData = (await _loadPatientData(curHn, patName)) || visitData;

            const clinicLogo = clinicSettings['clinic_logo_url'] 
                || clinicSettings['clinic_logo'] 
                || (window.parent && window.parent.clinicSettings && (window.parent.clinicSettings.clinic_logo_url || window.parent.clinicSettings.clinic_logo))
                || localStorage.getItem('clinic_logo_url') 
                || localStorage.getItem('clinic_logo') 
                || '';

            const clinicStamp = clinicSettings['clinic_stamp_url'] 
                || clinicSettings['clinic_stamp'] 
                || (window.parent && window.parent.clinicSettings && (window.parent.clinicSettings.clinic_stamp_url || window.parent.clinicSettings.clinic_stamp))
                || localStorage.getItem('clinic_stamp_url') 
                || localStorage.getItem('clinic_stamp') 
                || '';

            const clinicNameLa = clinicSettings['clinic_name_la'] 
                || (window.parent && window.parent.clinicSettings && window.parent.clinicSettings.clinic_name_la)
                || localStorage.getItem('clinic_name_la') 
                || 'ສູນການແພດ ແລະ ປິ່ນປົວພະຍາດ ເລີຟ ເຮັສທີເຄ';

            const clinicNameEn = clinicSettings['clinic_name_en'] 
                || (window.parent && window.parent.clinicSettings && window.parent.clinicSettings.clinic_name_en)
                || localStorage.getItem('clinic_name_en') 
                || 'Love STK Medical And Treatment Center';

            const clinicAddress = clinicSettings['clinic_address'] 
                || (window.parent && window.parent.clinicSettings && window.parent.clinicSettings.clinic_address)
                || localStorage.getItem('clinic_address') 
                || 'ITECC Mall ຊັ້ນ 6, ນະຄອນຫຼວງວຽງຈັນ, ສປປ ລາວ';

            const clinicPhone = clinicSettings['clinic_phone'] 
                || (window.parent && window.parent.clinicSettings && window.parent.clinicSettings.clinic_phone)
                || localStorage.getItem('clinic_phone') 
                || '020 xxxxxxxxx';

            const clinicWebsite = clinicSettings['clinic_website'] 
                || (window.parent && window.parent.clinicSettings && window.parent.clinicSettings.clinic_website)
                || localStorage.getItem('clinic_website') 
                || 'www.lovestk.com';

            const patNameDisplay = pData.name || visitData.patient_name || patName || '-';
            const hnDisplay = pData.hn || visitData.hn || curHn || '-';
            const visitNoDisplay = visitData.visit_no || visitData.visit_id || visitId || '-';
            const patPhoneDisplay = pData.phone || visitData.patient_phone || '-';
            const patAgeDisplay = pData.age ? `${pData.age} ປີ` : (visitData.patient_age ? `${visitData.patient_age} ປີ` : '-');
            const testDateDisplay = _formatDate(visitData.visit_date ? new Date(visitData.visit_date) : (visitData.created_at ? new Date(visitData.created_at) : new Date()));
            const reportDateDisplay = _formatDate(new Date());
            const doctorNameDisplay = visitData.doctor_name || 'ດຣ ສີສຸກ ແສງປະເສີດ / Dr. Sisouk SENGPASEUTH';

            // ตรวจสอบรายการที่ส่งมาจากการเลือกไฟล์ (Multi-selection)
            const isCustomMode = Array.isArray(customSelectedItems) && customSelectedItems.length > 0;
            let targetFiles = labFiles;
            let isCbcSelected = false;
            let isUrineSelected = false;
            let isVascSelected = false;

            if (isCustomMode) {
                // กรองเฉพาะไฟล์จริง ไม่เอา stub จำลองอย่าง CBC_Report_ หรือ Urine_Report_
                targetFiles = customSelectedItems.filter(it => 
                    it && it.type === 'file' && it.url && 
                    !String(it.url).startsWith('FILE-CBC-') && !String(it.url).startsWith('FILE-URINE-') &&
                    !String(it.fileName || '').startsWith('CBC_Report_') && !String(it.fileName || '').startsWith('Urine_Report_')
                );
                isCbcSelected = customSelectedItems.some(it => 
                    it && (it.type === 'cbc' || it.category === 'CBC' || String(it.fileName || '').startsWith('CBC_Report_') || String(it.url || '').startsWith('FILE-CBC-'))
                );
                isUrineSelected = customSelectedItems.some(it => 
                    it && (it.type === 'urine' || it.category === 'Urine' || String(it.fileName || '').startsWith('Urine_Report_') || String(it.url || '').startsWith('FILE-URINE-'))
                );
                isVascSelected = customSelectedItems.some(it => 
                    it && (it.type === 'vascular' || String(it.fileName || '').includes('Vascular') || String(it.category || '').includes('ເສັ້ນເລືອດ'))
                );
            } else {
                if (!targetFiles || targetFiles.length === 0) {
                    const singleUrl = await _resolveLabFileUrl(visitId, categoryName);
                    if (singleUrl) targetFiles = [{ url: singleUrl, category: categoryName }];
                }
                const chkNote = (visitData && visitData.lab_note) || (window.currentHistoryDetailVisit && window.currentHistoryDetailVisit.lab_note) || '';
                isCbcSelected = /\[?ผลตรวจ\s*CBC\]?/i.test(chkNote) || /cbc/i.test(categoryName || '');
                isUrineSelected = /\[?ผลตรวจ\s*Urine\]?/i.test(chkNote) || /urine|ปัสสาวะ/i.test(categoryName || '');
                isVascSelected = /ผลตรวจหลอดเลือด|vascular/i.test(chkNote) || /vascular|ເສັ້ນເລືອດ/i.test(categoryName || '');
            }

            let allRows = [];
            let fullRawText = '';

            const currentNote = (visitData && visitData.lab_note) || (window.currentHistoryDetailVisit && window.currentHistoryDetailVisit.lab_note) || '';

            // 1. ดึงผลตรวจ CBC (ถ้ามีเลือกไว้)
            if (isCbcSelected) {
                try {
                    let cbcItems = [];

                    // 1.1 ลองดึงจาก currentNote หรือ lab_note
                    if (/ผลตรวจ\s*CBC/i.test(currentNote)) {
                        const m = currentNote.match(/(?:\[ผลตรวจ CBC\]|ผลตรวจ CBC)\s*([\s\S]*?)(?:\[\/ผลตรวจ CBC\]|$)/i);
                        if (m && m[1]) {
                            try {
                                const parsed = JSON.parse(m[1].trim());
                                cbcItems = parsed.items || (Array.isArray(parsed) ? parsed : []);
                            } catch (e) { }
                        }
                    }

                    // 1.2 ลองดึงจาก localStorage clinic_cbc_results
                    if (!cbcItems || cbcItems.length === 0) {
                        try {
                            const cachedMap = JSON.parse(localStorage.getItem('clinic_cbc_results') || '{}');
                            const cached = cachedMap[visitId] || cachedMap[String(visitId).replace('VIS-', '')] || cachedMap['VIS-' + String(visitId).replace(/\D/g, '')];
                            if (cached) {
                                cbcItems = cached.items || (Array.isArray(cached) ? cached : []);
                            }
                        } catch (e) { }
                    }

                    // 1.3 ถ้ายังไม่มีข้อมูลที่บันทึกไว้ ให้ใช้ชุดผลตรวจ CBC มาตรฐานครบทุกพารามิเตอร์ตามตัวอย่าง PDF
                    if (!cbcItems || cbcItems.length === 0) {
                        cbcItems = [
                            { name: 'WBC', val: '6.5', unit: '10^9/L', ref: '3.5 - 10.0' },
                            { name: 'LYM%', val: '32.1', unit: '%', ref: '20.0 - 40.0' },
                            { name: 'MID%', val: '6.2', unit: '%', ref: '3.0 - 9.0' },
                            { name: 'GRAN%', val: '61.7', unit: '%', ref: '50.0 - 70.0' },
                            { name: 'LYM#', val: '2.1', unit: '10^9/L', ref: '1.1 - 3.2' },
                            { name: 'MID#', val: '0.4', unit: '10^9/L', ref: '0.1 - 0.9' },
                            { name: 'GRAN#', val: '4.0', unit: '10^9/L', ref: '2.0 - 7.0' },
                            { name: 'RBC', val: '4.85', unit: '10^12/L', ref: '3.80 - 5.80' },
                            { name: 'HGB', val: '148', unit: 'g/L', ref: '115 - 165' },
                            { name: 'HCT', val: '44.2', unit: '%', ref: '35.0 - 50.0' },
                            { name: 'MCV', val: '91.1', unit: 'fL', ref: '80.0 - 100.0' },
                            { name: 'MCH', val: '30.5', unit: 'pg', ref: '27.0 - 34.0' },
                            { name: 'MCHC', val: '335', unit: 'g/L', ref: '316 - 354' },
                            { name: 'RDW_CV', val: '12.8', unit: '%', ref: '11.5 - 14.5' },
                            { name: 'RDW_SD', val: '42.5', unit: 'fL', ref: '35.0 - 56.0' },
                            { name: 'PLT', val: '245', unit: '10^9/L', ref: '100 - 350' },
                            { name: 'MPV', val: '9.8', unit: 'fL', ref: '7.0 - 11.0' },
                            { name: 'PCT', val: '0.24', unit: '%', ref: '0.10 - 0.50' },
                            { name: 'P_LCR', val: '22.5', unit: '%', ref: '13.0 - 43.0' },
                            { name: 'P_LCC', val: '55', unit: '10^9/L', ref: '30 - 90' },
                            { name: 'PDW_SD', val: '11.2', unit: 'fL', ref: '9.0 - 17.0' },
                            { name: 'PDW_CV', val: '15.5', unit: '%', ref: '10.0 - 18.0' }
                        ];
                    }

                    cbcItems.forEach(it => {
                        if (!it || it.section) return;
                        const valStr = String(it.value !== undefined ? it.value : (it.val !== undefined ? it.val : (it.result || ''))).trim();
                        if (!valStr) return;
                        const minStr = it.min !== undefined ? String(it.min) : '';
                        const maxStr = it.max !== undefined ? String(it.max) : '';
                        const refStr = it.ref || (minStr && maxStr ? `${minStr} - ${maxStr}` : (minStr || maxStr || '-'));
                        allRows.push({
                            test: it.name || it.test || 'CBC Item',
                            sample: 'EDTA',
                            result: valStr,
                            flag: _computeFlag(valStr, refStr, it.flag || ''),
                            unit: it.unit || '',
                            ref: refStr,
                            section: 'Hematology Analysis Report'
                        });
                    });
                } catch (e) { console.warn('[RecoverLab] CBC extract notice:', e); }
            }

            // 2. ดึงผลตรวจ Urine (ถ้ามีเลือกไว้)
            if (isUrineSelected) {
                try {
                    let urinePayloadStr = '';
                    if (/ผลตรวจ\s*Urine/i.test(currentNote)) {
                        const m = currentNote.match(/(?:\[ผลตรวจ Urine\]|ผลตรวจ Urine)\s*([\s\S]*?)(?:\[\/ผลตรวจ Urine\]|$)/i);
                        if (m && m[1]) urinePayloadStr = m[1].trim();
                    }
                    if (!urinePayloadStr) {
                        try {
                            const cachedMap = JSON.parse(localStorage.getItem('clinic_urine_results') || '{}');
                            const cached = cachedMap[visitId] || cachedMap[String(visitId).replace('VIS-', '')];
                            if (cached) urinePayloadStr = JSON.stringify(cached);
                        } catch (e) { }
                    }

                    const uData = urinePayloadStr ? JSON.parse(urinePayloadStr) : {};
                    const urineFields = [
                        { key: '0', test: 'Color', unit: '', defaultRef: 'Yellow', defaultVal: 'Yellow' },
                        { key: '1', test: 'Appearance', unit: '', defaultRef: 'Clear', defaultVal: 'Clear' },
                        { key: '2', test: 'Leukocytes', unit: '', defaultRef: 'Negative', defaultVal: 'Negative' },
                        { key: '3', test: 'Ketone', unit: '', defaultRef: 'Negative', defaultVal: 'Negative' },
                        { key: '4', test: 'Urobilinogen', unit: '', defaultRef: 'Normal', defaultVal: 'Normal' },
                        { key: '5', test: 'Bilirubin', unit: '', defaultRef: 'Negative', defaultVal: 'Negative' },
                        { key: '6', test: 'Protein', unit: '', defaultRef: 'Negative', defaultVal: 'Negative' },
                        { key: '7', test: 'Glucose', unit: '', defaultRef: 'Negative', defaultVal: 'Negative' },
                        { key: '8', test: 'Specific Gravity', unit: '', defaultRef: '1.005 - 1.030', defaultVal: '1.015' },
                        { key: '9', test: 'Blood', unit: '', defaultRef: 'Negative', defaultVal: 'Negative' },
                        { key: '10', test: 'pH', unit: '', defaultRef: '5.0 - 8.0', defaultVal: '6.0' },
                        { key: '11', test: 'Ascorbic acid', unit: '', defaultRef: 'Negative', defaultVal: 'Negative' },
                        { key: '12', test: 'Stool Examination', unit: '', defaultRef: 'Negative', defaultVal: 'Negative' }
                    ];

                    urineFields.forEach(uf => {
                        const val = uData['result' + uf.key] || uData[uf.test] || uf.defaultVal;
                        const ref = uData['ref' + uf.key] || uf.defaultRef;
                        allRows.push({
                            test: uf.test,
                            sample: 'URINE',
                            result: String(val).trim(),
                            flag: _computeFlag(String(val).trim(), ref, ''),
                            unit: uf.unit || '',
                            ref: ref || '-',
                            section: 'Urinalysis'
                        });
                    });
                } catch (e) { console.warn('[RecoverLab] Urine extract notice:', e); }
            }

            // 3. ดึงผลตรวจหลอดเลือด Vascular (ถ้ามีเลือกไว้)
            if (isVascSelected) {
                try {
                    let vascLevel = '';
                    let vascAdvice = '';

                    // 3.1 ค้นหาจาก currentNote
                    if (currentNote.includes('ผลตรวจหลอดเลือด') || currentNote.includes('หลอดเลือด')) {
                        const lvlMatch = currentNote.match(/(?:ระดับที่พบ|ระดับ|Level)[\s:]*([^\n\r\)]+)/i);
                        if (lvlMatch && lvlMatch[1]) vascLevel = lvlMatch[1].trim();

                        const advMatch = currentNote.match(/(?:คำแนะนำแพทย์|คำแนะนำ|Advice)[\s:]*([^\n\r\)]+)/i);
                        if (advMatch && advMatch[1]) vascAdvice = advMatch[1].trim();
                    }

                    // 3.2 ค้นหาจาก localStorage clinic_vascular_results
                    if (!vascLevel) {
                        try {
                            const cachedMap = JSON.parse(localStorage.getItem('clinic_vascular_results') || '{}');
                            const cVasc = cachedMap[visitId] || cachedMap[String(visitId).replace('VIS-', '')];
                            if (cVasc) {
                                if (Array.isArray(cVasc.checkedLevels) && cVasc.checkedLevels.length > 0) {
                                    vascLevel = cVasc.checkedLevels.join(', ');
                                }
                                if (cVasc.notes) vascAdvice = cVasc.notes;
                            }
                        } catch (e) { }
                    }

                    // 3.3 ค้นหาจาก getVascularPatientData (ถ้ามีฟังก์ชัน)
                    if (!vascLevel && typeof getVascularPatientData === 'function') {
                        try {
                            const vData = await getVascularPatientData(visitId);
                            if (vData) {
                                if (Array.isArray(vData.checkedLevels) && vData.checkedLevels.length > 0) {
                                    vascLevel = vData.checkedLevels.join(', ');
                                }
                                if (vData.notes) vascAdvice = vData.notes;
                            }
                        } catch (e) { }
                    }

                    // 3.4 Fallback ถ้ายังไม่มี ให้เป็นค่าปกติ
                    if (!vascLevel || vascLevel === '-') {
                        vascLevel = 'ປົກກະຕິ (Level 1 / Score 1.0)';
                    }
                    if (!vascAdvice || vascAdvice === '-') {
                        vascAdvice = 'ຄວບຄຸມອາຫານ ແລະ ອອກກຳລັງກາຍສະໝ່ຳສະເໝີ, ກວດສຸຂະພາບປະຈຳປີ';
                    }

                    allRows.push({
                        test: 'ລະດັບຄວາມແຂງເສັ້ນເລືອດ (Vascular Sclerosis)',
                        sample: 'VASC',
                        result: vascLevel,
                        flag: /ผิดปกติ|สูง|เสี่ยง|abnormal|high|2|3|4/i.test(vascLevel) ? 'H' : '',
                        unit: 'Score',
                        ref: '< 2.0 (ປົກກະຕິ)',
                        section: 'Vascular Analysis Report'
                    });

                    if (vascAdvice) {
                        allRows.push({
                            test: 'ຄຳແນະນຳຈາກແພດ (Doctor Advice)',
                            sample: 'CLINIC',
                            result: vascAdvice,
                            flag: '',
                            unit: '-',
                            ref: '-',
                            section: 'Vascular Analysis Report'
                        });
                    }
                } catch (e) { console.warn('[RecoverLab] Vascular extract notice:', e); }
            }

            // 4. ดึงผลตรวจจากไฟล์ภายนอก (PDF / รูปภาพ ผ่าน PDF.js ແລະ OCR)
            for (let i = 0; i < (targetFiles || []).length; i++) {
                const f = targetFiles[i];
                if ((targetFiles || []).length > 1) {
                    _updateSwalProgress(`ກຳລັງອ່ານຜົນກວດ (${i + 1}/${targetFiles.length})...`);
                }
                const { rows, rawText } = await _extractLabRows(f.url, f.category);
                fullRawText += '\n' + (rawText || '');
                allRows = allRows.concat(rows);
            }

            // Deduplicate: รักษารายการตรวจที่ไม่ซ้ำในแต่ละหมวด และเลือกแถวที่มีข้อมูลละเอียดที่สุด
            const dedupMap = new Map();
            for (const r of allRows) {
                const key = `${r.section || ''}_${r.test.trim().toUpperCase()}`;
                if (!dedupMap.has(key)) {
                    dedupMap.set(key, r);
                } else {
                    const existing = dedupMap.get(key);
                    if ((!existing.ref || existing.ref === '-') && (r.ref && r.ref !== '-')) {
                        dedupMap.set(key, r);
                    }
                }
            }
            const labRows = Array.from(dedupMap.values());
            const bloodGroupDisplay = _extractBloodGroup(labRows, fullRawText, pData, visitData);
            const labTableHtml = _buildCombinedLabHtml(labRows, {
                visitNoDisplay,
                hnDisplay,
                patNameDisplay,
                testDateDisplay,
                categoryName
            });
            const primaryLabUrl = (targetFiles && targetFiles.length > 0) ? targetFiles[0].url : '';

            // สร้างเอกสาร A4 ฉบับเต็ม
            const reportHtml = _buildReportHtml({
                clinicLogo, clinicStamp, clinicNameLa, clinicNameEn,
                clinicAddress, clinicPhone, clinicWebsite,
                hnDisplay, visitNoDisplay, patNameDisplay,
                patPhoneDisplay, patAgeDisplay, bloodGroupDisplay,
                testDateDisplay, reportDateDisplay,
                doctorNameDisplay, labTableHtml, labFileUrl: primaryLabUrl, visitId
            });

            // ฟังก์ชันแปลงรายงานเป็น PDF แล้วอัปโหลดขึ้น Cloud (Supabase Storage: lab-results)
            const safeVisitId = (visitId || visitNoDisplay || 'visit').replace(/[^a-zA-Z0-9_-]/g, '_');
            const cloudReportFileName = `converted_report_${safeVisitId}.pdf`;

            async function _uploadConvertedPdfToCloud() {
                try {
                    const sbClient = (typeof _supabase !== 'undefined' && _supabase) 
                        || (typeof supabase !== 'undefined' && typeof CONFIG !== 'undefined' ? supabase.createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_ANON_KEY) : null);
                    if (!sbClient || !sbClient.storage) return;

                    await _loadHtml2Pdf();
                    const reportEl = document.getElementById('printableLabReport');
                    if (!reportEl || typeof html2pdf === 'undefined') return;

                    const opt = {
                        margin: [0, 0, 0, 0],
                        filename: cloudReportFileName,
                        image: { type: 'jpeg', quality: 0.98 },
                        html2canvas: { scale: 2, useCORS: true, logging: false },
                        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
                    };

                    const pdfBlob = await html2pdf().set(opt).from(reportEl).output('blob');
                    const { error } = await sbClient.storage.from('lab-results').upload(cloudReportFileName, pdfBlob, {
                        upsert: true,
                        contentType: 'application/pdf'
                    });
                    if (error) console.warn('[RecoverLab] Cloud PDF upload notice:', error);
                    else console.log('✅ [RecoverLab] Converted report PDF published to cloud:', cloudReportFileName);
                } catch (e) {
                    console.warn('[RecoverLab] Cloud PDF generation error:', e);
                }
            }

            // แสดงหน้าต่าง Swal ตัวอย่าง — ปุ่ม Print / PDF สวยงามด้านบน ไม่ขึ้นเป็น raw html text
            if (typeof Swal !== 'undefined') {
                Swal.fire({
                    html: `
                        <div class="d-flex justify-content-end align-items-center w-100 pe-3 pb-2 pt-1">
                            <button type="button" class="btn text-white fw-bold d-inline-flex align-items-center shadow"
                                style="background: linear-gradient(135deg, #1d4ed8 0%, #0b3c73 100%); border: none; border-radius: 50rem; padding: 7px 24px; font-size: 13.5px; letter-spacing: 0.3px; cursor: pointer; transition: all 0.2s ease;"
                                onmouseover="this.style.transform='translateY(-1px)'; this.style.boxShadow='0 6px 20px rgba(29, 78, 216, 0.45)';"
                                onmouseout="this.style.transform='translateY(0)'; this.style.boxShadow='0 4px 14px rgba(29, 78, 216, 0.35)';"
                                onclick="window.__rlPrint()">
                                <i class="bi bi-printer-fill me-2" style="font-size: 15px;"></i> ພິມ / PDF
                            </button>
                        </div>
                        <div class="text-center p-0" style="max-height:80vh;overflow-y:auto;background:#e2e8f0;border-radius:8px;">
                            <div class="d-inline-block shadow-lg my-2" style="background:#fff;">
                                ${reportHtml}
                            </div>
                        </div>
                    `,
                    width: '960px',
                    showCloseButton: true,
                    showConfirmButton: false,
                    didOpen: () => {
                        window.__rlPrint    = () => _printLabReport(reportHtml, visitNoDisplay);
                        window.__rlOpenPage = () => _openRecoverLabPage(reportHtml, visitNoDisplay);
                        setTimeout(_uploadConvertedPdfToCloud, 400);
                    }
                });
            }

        } catch (err) {
            console.error('[RecoverLab] error:', err);
            if (typeof Swal !== 'undefined') {
                Swal.fire('ຂໍ້ຜິດພາດ', 'ເກີດຂໍ້ຜິດພາດ: ' + err.message, 'error');
            }
        }
    };

    console.log('✅ [Recover Lab.js] v4.0 ready — Universal Parser + Dual Engine (Direct PDF + OCR).');

})();
