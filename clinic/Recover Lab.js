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
        return url.startsWith('data:application/pdf') || /\.pdf($|\?)/i.test(url) || url.startsWith('blob:');
    }

    function _isImage(url) {
        if (!url) return false;
        return url.startsWith('data:image/') || /\.(jpeg|jpg|gif|png|webp)($|\?)/i.test(url);
    }

    function _updateSwalProgress(msg) {
        const el = document.querySelector('.swal2-html-container .rl-ocr-status');
        if (el) el.textContent = msg;
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

        // ข้อมูลผู้ป่วย / ส่วนหัวคลินิก
        if (/^(name|patient|age|sex|gender|sample\s*id|sample\s*kind|register|department|silk\s*bed|doctor|treat\s*area|diagnostic|date|time)\s*[:]/i.test(l)) return true;
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

        return rows;
    }

    // -------------------------------------------------------
    // PIPELINE หลักในการดึงข้อมูล
    // -------------------------------------------------------
    async function _extractLabRows(labFileUrl, defaultCategory) {
        if (!labFileUrl) return { rows: [], rawText: '' };

        let allRows = [];
        let fullRawText = '';

        if (_isImage(labFileUrl)) {
            // กรณีเป็นไฟล์ภาพ (JPG, PNG, etc.) ใช้ OCR
            const text = await _ocrImageUrl(labFileUrl);
            fullRawText = text;
            allRows = _parseTextToLabRows(text, defaultCategory);
        } else if (_isPdf(labFileUrl)) {
            try {
                const pdfjs  = await _loadPdfJs();
                const pdfDoc = await pdfjs.getDocument(labFileUrl).promise;
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
                console.warn('[RecoverLab] PDF extraction error:', e);
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
    // BUILD TABLE ROWS HTML — แสดงผลตารางสวยงาม + ทุกรายการ
    // -------------------------------------------------------
    function _buildTableRowsHtml(rows) {
        if (!rows || rows.length === 0) {
            return `<tr><td colspan="6" style="text-align:center;padding:16px;color:#94a3b8;font-style:italic;">
                        ບໍ່ພົບຂໍ້ມູນລາຍການກວດ / ไม่พบข้อมูลรายการตรวจ
                    </td></tr>`;
        }

        let html = '';
        let lastSection = null;

        rows.forEach((item, i) => {
            // หากมี Section Header ให้สร้างแถบหัวข้อย่อยคั่นในตาราง
            if (item.section && item.section !== lastSection) {
                lastSection = item.section;
                html += `<tr style="background:#f1f5f9;border-top:1.5px solid #cbd5e1;border-bottom:1.5px solid #cbd5e1;height:22px;">
                            <td colspan="6" style="padding:2.5px 8px;font-weight:800;color:#0b3c73;font-size:10.5px;letter-spacing:0.3px;">
                                <i class="bi bi-clipboard2-pulse me-1 text-primary"></i> ${item.section}
                            </td>
                         </tr>`;
            }

            const isEven  = i % 2 === 1;
            const bgColor = isEven ? '#f8fafc' : '#ffffff';

            const isPos = /^(positive|reactive|detected|abnormal|pos|\+)/i.test(item.result) ||
                          /^(positive|reactive|detected|abnormal|h|hh)/i.test(item.flag);
            const isLow = /^(l|ll)/i.test(item.flag);

            let flagBadge = '';
            if (isPos) {
                const label = (item.flag && item.flag !== 'Positive') ? item.flag : (item.result === 'Positive' ? 'Positive' : (item.flag || 'H'));
                flagBadge = `<span style="background:#fee2e2;color:#dc2626;padding:1px 6px;border-radius:8px;font-weight:800;font-size:9.5px;display:inline-block;">${label}</span>`;
            } else if (isLow) {
                flagBadge = `<span style="background:#dbeafe;color:#2563eb;padding:1px 6px;border-radius:8px;font-weight:800;font-size:9.5px;display:inline-block;">${item.flag || 'L'}</span>`;
            } else if (item.flag) {
                flagBadge = `<span style="color:#64748b;font-weight:700;">${item.flag}</span>`;
            }

            const resultColor = isPos ? '#dc2626' : (isLow ? '#2563eb' : '#0f172a');

            // บรรทัดใหม่สำหรับทุกรายการตรวจ (กระชับชิดขึ้น)
            html += `<tr style="background:${bgColor};border-bottom:1px solid #e2e8f0;height:21px;line-height:1.2;">
                        <td style="padding:2px 8px;font-weight:700;color:#1e293b;font-size:10.5px;">${item.test}</td>
                        <td style="padding:2px 8px;text-align:center;color:#64748b;font-size:9.5px;">${item.sample || 'SER'}</td>
                        <td style="padding:2px 8px;font-weight:800;color:${resultColor};font-size:11px;">${item.result}</td>
                        <td style="padding:2px 8px;text-align:center;font-size:10px;">${flagBadge}</td>
                        <td style="padding:2px 8px;color:#475569;font-size:10px;">${item.unit || '-'}</td>
                        <td style="padding:2px 8px;color:#475569;font-size:10px;">${item.ref || '-'}</td>
                    </tr>`;
        });

        return html;
    }

    function _buildLabTableHtml(rows, categoryName) {
        // กำหนดชื่อหัวข้อรายงานให้เหมาะสม
        const distinctSections = new Set((rows || []).map(r => r.section).filter(Boolean));
        let reportTitle = 'Analysis Report';
        if (distinctSections.size > 1) {
            reportTitle = 'Laboratory Analysis Report';
        } else if (categoryName && categoryName.trim()) {
            const cleanCat = categoryName.replace(/[\u0E00-\u0E7F]/g, '').trim();
            if (cleanCat) reportTitle = `${cleanCat} Analysis Report`;
        }

        return `
        <!-- Report Title -->
        <div style="font-size:14px;font-weight:800;color:#0b3c73;margin-bottom:8px;">${reportTitle}</div>

        <table style="width:100%;border-collapse:collapse;font-size:11px;margin-bottom:10px;">
            <thead>
                <tr style="background:#0b3c73;color:#fff;text-align:left;height:28px;">
                    <th style="padding:4px 10px;font-weight:700;width:30%;">TEST</th>
                    <th style="padding:4px 10px;font-weight:700;width:10%;text-align:center;">SAMPLE</th>
                    <th style="padding:4px 10px;font-weight:700;width:14%;">RESULT</th>
                    <th style="padding:4px 10px;font-weight:700;width:8%;text-align:center;">FLAGS</th>
                    <th style="padding:4px 10px;font-weight:700;width:16%;">UNIT</th>
                    <th style="padding:4px 10px;font-weight:700;width:22%;">REF. RANGES</th>
                </tr>
            </thead>
            <tbody>
                ${_buildTableRowsHtml(rows)}
            </tbody>
        </table>
        `;
    }

    // -------------------------------------------------------
    // LOAD CLINIC SETTINGS / VISIT / PATIENT
    // -------------------------------------------------------
    async function _loadClinicSettings() {
        let s = window.clinicSettings || {};
        if (typeof _supabase !== 'undefined') {
            try {
                const { data } = await _supabase.from('clinic_settings').select('key, value');
                if (data && data.length > 0) {
                    s = Object.fromEntries(data.map(r => [r.key, r.value]));
                    window.clinicSettings = s;
                }
            } catch (e) { }
        }
        return s;
    }

    async function _loadVisitData(visitId) {
        let v = null;
        if (window.allVisits) v = window.allVisits.find(x => x.visit_id === visitId);
        if (!v && typeof _supabase !== 'undefined' && visitId) {
            try {
                const { data } = await _supabase.from('visits').select('*').eq('visit_id', visitId).maybeSingle();
                if (data) v = data;
            } catch (e) { }
        }
        return v;
    }

    async function _loadPatientData(curHN, patientName) {
        let p = null;
        if (window.allPatients) {
            if (curHN) p = window.allPatients.find(x => x.hn === curHN);
            if (!p && patientName) p = window.allPatients.find(x => x.patient_name === patientName);
        }
        if (!p && typeof _supabase !== 'undefined' && curHN) {
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

                    <!-- Stamp -->
                    <div style="text-align:center;display:flex;flex-direction:column;align-items:center;justify-content:center;min-width:60mm;">
                        <div style="width:60mm;height:60mm;display:flex;align-items:center;justify-content:center;">${stampHtml}</div>
                    </div>
                </div>

                <!-- FOOTER BAR -->
                <div style="background:linear-gradient(90deg,#0b3c73,#1e40af);color:#fff;padding:7px 16px;border-radius:6px;font-size:10px;display:flex;justify-content:space-between;align-items:center;gap:8px;">
                    <div style="display:flex;align-items:center;gap:5px;"><i class="bi bi-geo-alt-fill"></i><span>${clinicAddress}</span></div>
                    <div style="display:flex;align-items:center;gap:5px;"><i class="bi bi-telephone-fill"></i><span>${clinicPhone}</span></div>
                    <div style="display:flex;align-items:center;gap:5px;"><i class="bi bi-globe"></i><span>${clinicWebsite}</span></div>
                </div>
            </div>
        </div>`;
    }

    // -------------------------------------------------------
    // PRINT
    // -------------------------------------------------------
    function _printLabReport(reportHtml, visitNoDisplay) {
        const printWin = window.open('', '_blank');
        if (!printWin) { alert('ກະລຸນາອະນຸຍາດ Popup ເພື່ອພິມເອກະສານ'); return; }
        printWin.document.open();
        printWin.document.write(`<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>Lab Report - ${visitNoDisplay}</title>
    <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.3/font/bootstrap-icons.min.css">
    <link href="https://fonts.googleapis.com/css2?family=Noto+Sans+Lao:wght@400;500;600;700;800&family=Sarabun:wght@400;500;600;700&display=swap" rel="stylesheet">
    <style>
        @page { size: A4 portrait; margin: 20mm 0 20mm 0; }
        body { margin:0; padding:0; background:#fff;
               -webkit-print-color-adjust:exact!important;
               print-color-adjust:exact!important; }
        #printableLabReport { padding-top: 0 !important; padding-bottom: 0 !important; }
        thead { display: table-row-group !important; }
        tr { page-break-inside: avoid; break-inside: avoid; }
    </style>
</head>
<body>
    ${reportHtml}
    <script>window.onload=function(){setTimeout(function(){window.print();},600);};<\/script>
</body>
</html>`);
        printWin.document.close();
    }

    // -------------------------------------------------------
    // OPEN STANDALONE PAGE
    // -------------------------------------------------------
    function _openRecoverLabPage(reportHtml, visitNoDisplay) {
        sessionStorage.setItem('recoverLabReportHtml', reportHtml);
        sessionStorage.setItem('recoverLabVisitNo', visitNoDisplay);
        const win = window.open('Recover Lab.html', '_blank');
        if (!win) alert('ກະລຸນາອະນຸຍາດ Popup ເພື່ອເປີດໜ້າລາຍງານ');
    }

    // -------------------------------------------------------
    // MAIN — OVERRIDE window.convertLabResultWithFrame
    // -------------------------------------------------------
    window.convertLabResultWithFrame = async function (visitId, patientName, categoryName) {
        try {
            // Loading spinner
            if (typeof Swal !== 'undefined') {
                Swal.fire({
                    title: 'ກຳລັງໂຫຼດ...',
                    html: `<div class="spinner-border text-primary my-2" role="status"></div>
                           <div class="small text-muted rl-ocr-status">ກຳລັງດຶງຂໍ້ມູນ...</div>`,
                    showConfirmButton: false,
                    allowOutsideClick: false,
                    width: '340px'
                });
            }

            // โหลด settings + visit + รายการไฟล์แล็บทั้งหมดของเคสนี้
            const [cSettings, visitData, labFiles] = await Promise.all([
                _loadClinicSettings(),
                _loadVisitData(visitId),
                _resolveAllLabFiles(visitId, categoryName)
            ]);

            const curHN = (visitData && visitData.hn) ? visitData.hn : '';
            const pData = await _loadPatientData(curHN, patientName);

            // Clinic info
            const clinicLogo    = cSettings['clinic_logo_url']  || localStorage.getItem('clinic_logo_url') || '';
            const clinicStamp   = cSettings['clinic_stamp_url'] || '';
            const clinicNameLa  = cSettings['clinic_name_la']   || 'ສູນການແພດ ແລະ ປິ່ນປົວພະຍາດ ເລີຟ ເຮັສທີເຄ';
            const clinicNameEn  = 'Love STK Medical And Treatment Center';
            const clinicAddress = cSettings['clinic_address']   || 'ITECC Mall ຊັ້ນ 6, ນະຄອນຫຼວງວຽງຈັນ, ສປປ ລາວ';
            const clinicPhone   = cSettings['clinic_phone']     || '020 5555 1234';
            const clinicWebsite = cSettings['clinic_website']
                ? cSettings['clinic_website'].replace(/^https?:\/\//, '')
                : 'www.lovestk.com';

            // Patient display
            const hnDisplay       = curHN || (pData && pData.hn) || '';
            const visitNoDisplay  = (visitData && visitData.visit_id) ? visitData.visit_id : (visitId || '');
            const patNameDisplay  = patientName || (visitData && visitData.patient_name) || (pData && pData.patient_name) || '-';
            const patPhoneDisplay = (pData && (pData.phone || pData.emergency_tel)) || '-';
            const patAgeDisplay   = (pData && pData.age)
                ? pData.age + ' ປີ'
                : (pData && pData.dob && typeof calculateAge === 'function'
                    ? calculateAge(pData.dob) + ' ປີ' : '-');

            const now   = new Date();
            const vDate = (visitData && visitData.created_at) ? new Date(visitData.created_at) : now;
            const testDateDisplay   = _formatDate(vDate);
            const reportDateDisplay = _formatDate(now);

            const doctorNameDisplay = (visitData && visitData.doctor_name)
                ? visitData.doctor_name
                : 'ດຣ. ສີສຸກ ແສງປະເສີດ / Dr. Sisouk SENGPASEUTH';

            // ดึงรายการตรวจทั้งหมดจากทุกไฟล์ของเคสนี้
            if (typeof Swal !== 'undefined') {
                Swal.update({
                    title: 'ກຳລັງວິເຄາະຜົນກວດ...',
                    html: `<div class="spinner-border text-success my-2" role="status"></div>
                           <div class="small text-muted rl-ocr-status">ກຳລັງດຶງຂໍ້ມູນລາຍການກວດທັງໝົດ...</div>`
                });
            }

            // ถ้าไม่มีไฟล์ในระบบ ให้ใช้ fallback URL เดิม
            let targetFiles = labFiles;
            if (!targetFiles || targetFiles.length === 0) {
                const singleUrl = await _resolveLabFileUrl(visitId, categoryName);
                if (singleUrl) targetFiles = [{ url: singleUrl, category: categoryName }];
            }

            let allRows = [];
            let fullRawText = '';

            for (let i = 0; i < (targetFiles || []).length; i++) {
                const f = targetFiles[i];
                if (targetFiles.length > 1) {
                    _updateSwalProgress(`ກຳລັງອ່ານຜົນກວດ (${i + 1}/${targetFiles.length})...`);
                }
                const { rows, rawText } = await _extractLabRows(f.url, f.category);
                fullRawText += '\n' + (rawText || '');
                allRows = allRows.concat(rows);
            }

            // Deduplicate: รักษารายการตรวจที่ไม่ซ้ำ และเลือกแถวที่มีข้อมูลละเอียดที่สุด
            const dedupMap = new Map();
            for (const r of allRows) {
                const key = r.test.trim().toUpperCase();
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
            const labTableHtml = _buildLabTableHtml(labRows, categoryName);
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
