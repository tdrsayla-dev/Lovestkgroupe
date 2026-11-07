/**
 * ================================================================
 * 💰 reportFinanceLogic.js - สมองกลประมวลผลและการคำนวณรายงานการเงิน
 * LOVE STK GROUPE - Finance & Revenue Calculation Engine
 * ================================================================
 */

(function (window) {
    'use strict';

    const safeUpper = (str) => String(str || '').trim().toUpperCase();

    /**
     * 1. แปลงและแยกยอดเงิน กีบ (LAK) / บาท (THB) ตามช่องทางการชำระเงินและอัตราแลกเปลี่ยน
     */
    function parseSaleCurrencyAmounts(s, exRate) {
        if (!s) return { lakAmt: 0, thbAmt: 0, isLakBill: false, isThbBill: false, realPayMode: '' };

        let rawAmt = Number(s['ยอดขายรวม'] || s.total_amount || s.totalAmount || s.amount || s.grand_total || s.grandTotal || 0);
        
        if (rawAmt === 0 && (s._items || s.items_json)) {
            let itList = s._items;
            if (!itList && s.items_json) {
                try { itList = typeof s.items_json === 'string' ? JSON.parse(s.items_json) : s.items_json; } catch(e){}
            }
            if (Array.isArray(itList) && itList.length > 0) {
                rawAmt = itList.reduce((acc, it) => acc + ((Number(it.qty) || 0) * (Number(it.price) || 0)), 0);
            }
        }

        const pModeStr = String(s.payMode || s.pay_mode || s.saleType || s.sale_type || s.payment_method || s.payment_type || '').trim();
        let lakAmt = 0;
        let thbAmt = 0;

        if (pModeStr.includes(':')) {
            const parts = pModeStr.split('|');
            let hasParsedLAK = false;
            let hasParsedTHB = false;

            parts.forEach(part => {
                const trimmed = part.trim();
                if (!trimmed.includes(':')) return;
                const colonIdx = trimmed.indexOf(':');
                const key = trimmed.substring(0, colonIdx).trim().toLowerCase();
                const val = parseFloat(trimmed.substring(colonIdx + 1).replace(/[^\d.]/g, '')) || 0;

                if (key === 'เรท' || key === 'rate' || key === 'อัตรา') return;

                const isKeyLak = key.includes('กีบ') || key.includes('lak') || key.includes('kip') || key === 'สดกีบ' || 
                                 (key.includes('ลาว') && !key.includes('บาท')) ||
                                 (val >= 70000 && !key.includes('ไทย') && !key.includes('thb') && !key.includes('สดบาท'));

                if (isKeyLak) {
                    lakAmt += val;
                    hasParsedLAK = true;
                } else if (key.includes('บาท') || key.includes('thb') || key === 'สด' || key.includes('สดบาท') || key.includes('ไทย') || key.includes('โอน')) {
                    if (val >= 70000 && (key.includes('ลาว') || key.includes('bcel') || key.includes('jdb') || key.includes('ldb'))) {
                        lakAmt += val;
                        hasParsedLAK = true;
                    } else {
                        thbAmt += val;
                        hasParsedTHB = true;
                    }
                } else if (val >= 70000) {
                    lakAmt += val;
                    hasParsedLAK = true;
                } else {
                    thbAmt += val;
                    hasParsedTHB = true;
                }
            });

            if (hasParsedLAK || hasParsedTHB) {
                return { lakAmt, thbAmt, isLakBill: lakAmt > 0, isThbBill: thbAmt > 0, realPayMode: pModeStr };
            }
        }

        const expLak = Number(s.total_amount_lak || s.totalAmountLak || 0);
        const expThb = Number(s.total_amount_thb || s.totalAmountThb || 0);
        if (expLak > 0 || expThb > 0) {
            return { lakAmt: expLak, thbAmt: expThb, isLakBill: expLak > 0, isThbBill: expThb > 0, realPayMode: pModeStr };
        }

        const lowerPMode = pModeStr.toLowerCase();
        const isLakBill = lowerPMode.includes('กีบ') || lowerPMode.includes('lak') || lowerPMode.includes('kip') || 
                          (lowerPMode.includes('ลาว') && !lowerPMode.includes('บาท')) || rawAmt >= 70000;

        if (isLakBill) {
            return { lakAmt: rawAmt, thbAmt: 0, isLakBill: true, isThbBill: false, realPayMode: pModeStr };
        }

        return { lakAmt: 0, thbAmt: rawAmt, isLakBill: false, isThbBill: true, realPayMode: pModeStr };
    }

    /**
     * 2. จัดโครงสร้างข้อมูลบิลขาย (Mapping & Items JSON Parsing)
     */
    function processFinanceSales(saleRes) {
        if (!Array.isArray(saleRes)) return [];
        return saleRes.map(s => {
            let sumF = 0, sumM = 0, sumP = 0, sumZ = 0;
            let itemsList = [];
            if (s.items_json) {
                try { itemsList = typeof s.items_json === 'string' ? JSON.parse(s.items_json) : s.items_json; } catch(e){}
            }
            if (Array.isArray(itemsList) && itemsList.length > 0) {
                itemsList.forEach(it => {
                    const typeStr = String(it.type || it.priceType || '').trim();
                    const qtyNum = Number(it.qty || it.quantity || 1);
                    if (typeStr === 'ราคาเต็ม') sumF += qtyNum;
                    else if (typeStr === 'ราคาสมาชิก') sumM += qtyNum;
                    else if (typeStr === 'ราคาโปร' || typeStr === 'โปรโมชั่น') sumP += qtyNum;
                    else if (typeStr === 'ราคาศูนย์') sumZ += qtyNum;
                    else sumM += qtyNum;
                });
            }
            const copy = { ...s };
            copy['id'] = s.id || s.order_id || '';
            copy['memberId'] = s.seller_id || s.memberId || '';
            copy['sellerName'] = s.seller_name || s.sellerName || copy['memberId'];
            copy['customerName'] = s.customer_name || s.customerName || (s.customer_id ? `ลูกค้า (${s.customer_id})` : 'ไม่ระบุชื่อ');
            copy['saleType'] = s.sale_type || s.saleType || '';
            copy['payMode'] = s.sale_type || s.saleType || 'เงินโอน';
            copy['ยอดขายรวม'] = Number(s.total_amount || s.totalAmount || 0);
            copy['date'] = String(s.date || s.created_at || '').split('T')[0].split(' ')[0];
            copy['_items'] = itemsList;
            copy['รวมชิ้นราคาเต็ม'] = sumF;
            copy['รวมชิ้นราคาสมาชิก'] = sumM;
            copy['รวมชิ้นราคาโปร'] = sumP;
            copy['รวมชิ้นราคาศูนย์'] = sumZ;
            copy['ยอดรวมชิ้นทั้งหมด'] = sumF + sumM + sumP + sumZ;
            return copy;
        });
    }

    /**
     * 3. คัดกรองบิลตามช่วงวันที่ สิทธิ์สายงาน และคำค้นหา
     */
    function filterFinanceBills(sales, startDate, endDate, permittedMemberSet, searchQuery) {
        if (!Array.isArray(sales)) return [];
        const query = String(searchQuery || '').trim().toUpperCase();
        return sales.filter(s => {
            if (!s || (s.date || '') < startDate || (s.date || '') > endDate) return false;
            if (permittedMemberSet !== null && !permittedMemberSet.has(safeUpper(s.memberId))) return false;
            if (query !== '') {
                const mName = (s.sellerName || '').toUpperCase();
                const mId = (s.memberId || '').toUpperCase();
                const cName = (s.customerName || '').toUpperCase();
                const bId = (s.id || '').toUpperCase();
                if (!mName.includes(query) && !mId.includes(query) && !cName.includes(query) && !bId.includes(query)) return false;
            }
            return true;
        });
    }

    /**
     * 4. คำนวณภาพรวมตัวเลข KPI การเงิน
     */
    function calculateFinanceKpi(financeBills, exchangeRate) {
        let sumLak = 0;
        let sumThb = 0;
        let lakBillsCount = 0;
        let thbBillsCount = 0;
        const exRate = Number(exchangeRate) || 700;

        (financeBills || []).forEach(s => {
            const { lakAmt, thbAmt, isLakBill, isThbBill } = parseSaleCurrencyAmounts(s, exRate);
            sumLak += lakAmt;
            sumThb += thbAmt;
            if (isLakBill) lakBillsCount++;
            if (isThbBill) thbBillsCount++;
        });

        const grandCombinedTHB = sumThb + (sumLak / exRate);
        return { sumLak, sumThb, grandCombinedTHB, lakBillsCount, thbBillsCount };
    }

    /**
     * 5. คำนวณสรุปรายรับ 12 เดือนของปี (สำหรับตารางรายปีและกราฟแท่ง)
     */
    function calculateYearlyFinanceData(sales, activeYear, exchangeRate, permittedMemberSet, searchQuery) {
        const exRate = Number(exchangeRate) || 700;
        const query = String(searchQuery || '').trim().toUpperCase();
        let grouped = {};

        for (let m = 1; m <= 12; m++) {
            const mmStr = String(m).padStart(2, '0');
            const monthKey = `${activeYear}-${mmStr}`;
            grouped[monthKey] = {
                period: monthKey,
                monthNum: m,
                billsCount: 0,
                sumLak: 0,
                sumThb: 0
            };
        }

        (sales || []).forEach(s => {
            if (!s || !s.date) return;
            const sDateStr = String(s.date);
            const monthKey = sDateStr.substring(0, 7);
            if (!grouped[monthKey]) return;
            if (permittedMemberSet !== null && !permittedMemberSet.has(safeUpper(s.memberId))) return;

            if (query !== '') {
                const mName = (s.sellerName || '').toUpperCase();
                const mId = (s.memberId || '').toUpperCase();
                const cName = (s.customerName || '').toUpperCase();
                const bId = (s.id || '').toUpperCase();
                if (!mName.includes(query) && !mId.includes(query) && !cName.includes(query) && !bId.includes(query)) return;
            }

            grouped[monthKey].billsCount += 1;
            const { lakAmt: rowLak, thbAmt: rowThb } = parseSaleCurrencyAmounts(s, exRate);
            grouped[monthKey].sumLak += rowLak;
            grouped[monthKey].sumThb += rowThb;
        });

        return Object.values(grouped).sort((a, b) => a.monthNum - b.monthNum);
    }

    /**
     * 6. จัดกลุ่มข้อมูลรายงานยอดขายและสินค้า (Sale Report Template ตามแบบฟอร์มบริษัท)
     */
    /**
     * ตัวช่วยระบุประเภทราคา 4 แบบ: ราคาเต็ม, ราคาสมาชิก, ราคาโปร, ราคาศูนย์ (แถมฟรี)
     * ยึดตามช่องประเภทราคาที่ผู้ใช้คลิกเลือกในบิลเป็นหลัก (หรือตามราคาที่กำหนดในของเซ็ต/สินค้านั้น)
     * ไม่ยัดเยียดเข้าช่องโปรเด็ดขาด เพื่อให้ยอดเงินและสต๊อกคำนวณถูกต้องตามหมวดหมู่จริง
     */
    function classifyOrderItem(it, price, amt, prodMapObj = {}) {
        const rawPrice = (price !== undefined && price !== null && !isNaN(Number(price))) 
            ? Number(price) 
            : ((amt && it.qty && Number(it.qty) > 0) ? Math.round(Number(amt) / Number(it.qty)) : null);

        const pName = String(it.prod || it.productName || it.name || '').trim();
        const cleanPName = pName.replace(/\(.*?\)/g, '').trim();
        const pNameUpper = pName.toUpperCase();
        const cleanPNameUpper = cleanPName.toUpperCase();
        const pNameLower = pName.toLowerCase();
        const typeStr = String(it.type || it.priceType || it.price_type || it.rateType || '').trim().toLowerCase();

        // ค้นหาสินค้า/เซ็ตจากตารางสินค้า stk_products (เหมือน Orders.html)
        const pObj = (it.id && prodMapObj[it.id]) || 
                     (it.product_id && prodMapObj[it.product_id]) || 
                     prodMapObj[pName] || 
                     prodMapObj[cleanPName] || 
                     prodMapObj[pNameUpper] || 
                     prodMapObj[cleanPNameUpper] || {};

        const pFull = Number(pObj.price_full ?? pObj.priceFull ?? 0);
        const pMember = Number(pObj.price_member ?? pObj.priceMember ?? 0);
        const pPromo = Number(pObj.price_promo ?? pObj.pricePromo ?? 0);

        // 1. ตรวจสอบราคาศูนย์ (แถมฟรี / ราคา 0)
        if (rawPrice === 0 || (rawPrice !== null && rawPrice <= 0.01 && rawPrice >= 0)) {
            return 'ราคาศูนย์';
        }
        if (typeStr && (typeStr.includes('ศูนย์') || typeStr.includes('ฟรี') || typeStr.includes('แถม') || typeStr.includes('ຟຣີ') || typeStr.includes('ແຖມ') || typeStr === 'zero' || typeStr === 'free')) {
            return 'ราคาศูนย์';
        }
        if (pNameLower.includes('(แถม)') || pNameLower.includes('(ฟรี)') || pNameLower.includes('(ศูนย์)') || pNameLower.includes('(ຟຣີ)') || pNameLower.includes('(ແຖມ)')) {
            return 'ราคาศูนย์';
        }

        // 2. ตรวจสอบจากราคาจริง (Actual Unit Price) เทียบกับฐานข้อมูลสินค้าเป็นอันดับหนึ่ง!
        // ป้องกันกรณีที่บิลบันทึก typeStr ผิดพลาดเป็น "ราคาโปร" อัตโนมัติ ทั้งที่ซื้อด้วยราคาสมาชิก 1,500
        if (rawPrice !== null && rawPrice > 0) {
            // ถ้าตรงกับราคาสมาชิกในฐานข้อมูลสินค้า (เช่น 1,500) หรือเรทราคาสมาชิกมาตรฐาน
            if ((pMember > 0 && Math.abs(rawPrice - pMember) < 0.01) || (rawPrice === 1500 && (pMember === 1500 || pMember === 0))) {
                return 'ราคาสมาชิก';
            }
            // ถ้าตรงกับราคาโปรโมชั่นในฐานข้อมูลสินค้า (เช่น 800, 1,000)
            if (pPromo > 0 && Math.abs(rawPrice - pPromo) < 0.01) {
                return 'ราคาโปร';
            }
            // ถ้าตรงกับราคาเต็มในฐานข้อมูลสินค้า (เช่น 1,800, 2,500)
            if (pFull > 0 && Math.abs(rawPrice - pFull) < 0.01) {
                return 'ราคาเต็ม';
            }

            // Benchmark ราคามาตรฐานของระบบ STK
            if (rawPrice === 1500) return 'ราคาสมาชิก';
            if (rawPrice === 800 || rawPrice === 1000 || rawPrice === 400 || rawPrice === 200 || rawPrice === 280) return 'ราคาโปร';
            if (rawPrice === 1800 || rawPrice === 1950 || rawPrice === 2500 || rawPrice === 890 || rawPrice === 590 || rawPrice === 390) return 'ราคาเต็ม';
            if (rawPrice === 300) {
                return (pMember === 300) ? 'ราคาสมาชิก' : 'ราคาโปร';
            }
        }

        // 3. ถ้าไม่มีราคาจริงหรือราคาไม่ตรงฐานข้อมูล ให้ดูจากประเภทราคาที่เลือกในบิล
        if (typeStr) {
            if (typeStr.includes('สมาชิก') || typeStr.includes('member') || typeStr.includes('ส่ง') || typeStr.includes('vip') || typeStr.includes('ສະມາຊິກ') || typeStr.includes('ສົ່ງ') || typeStr.includes('ວີໄອພີ')) {
                return 'ราคาสมาชิก';
            }
            if (typeStr.includes('โปร') || typeStr.includes('promo') || typeStr.includes('พิเศษ') || typeStr.includes('ໂປຣ') || typeStr.includes('ພິເສດ')) {
                return 'ราคาโปร';
            }
            if (typeStr.includes('เต็ม') || typeStr.includes('ปกติ') || typeStr.includes('full') || typeStr.includes('normal') || typeStr.includes('ປົກກະຕິ') || typeStr.includes('ເຕັມ')) {
                return 'ราคาเต็ม';
            }
        }

        // 4. ดูจากชื่อสินค้า
        if (pNameLower.includes('(สมาชิก)') || pNameLower.includes('(ส่ง)') || pNameLower.includes('(ສະມາຊິກ)') || pNameLower.includes('(ສົ່ງ)') || pNameLower.includes('ວີໄອພີ')) return 'ราคาสมาชิก';
        if (pNameLower.includes('(โปร)') || pNameLower.includes('(โบร)') || pNameLower.includes('(ໂປຣ)') || pNameLower.includes('ພິເສດ')) return 'ราคาโปร';
        if (pNameLower.includes('(เต็ม)') || pNameLower.includes('(ปกติ)') || pNameLower.includes('(ປົກກະຕິ)') || pNameLower.includes('(ເຕັມ)')) return 'ราคาเต็ม';

        // 5. Fallback เทียบกับราคาสมาชิก
        if (rawPrice !== null && pMember > 0) {
            if (rawPrice <= pMember) return 'ราคาสมาชิก';
            return 'ราคาเต็ม';
        }

        return 'ราคาสมาชิก';
    }

    /**
     * 6. จัดกลุ่มข้อมูลรายงานยอดขายและสินค้า (Sale Report Template ตามแบบฟอร์มบริษัท)
     * รองรับการจำแนก 4 ประเภทราคา: ราคาเต็ม, ราคาสมาชิก, ราคาโปร, ราคาศูนย์ (แถมฟรี)
     */
    function groupSalesForProductReport(sales, groupBy = 'seller', products = [], members = [], viewMode = 'summary') {
        if (!Array.isArray(sales)) {
            return {
                groups: [],
                totalBillsCount: 0,
                grandTotalQty: 0,
                grandTotalWg: 0,
                grandTotalAmount: 0,
                grandQtyFull: 0, grandAmountFull: 0,
                grandQtyMember: 0, grandAmountMember: 0,
                grandQtyPromo: 0, grandAmountPromo: 0,
                grandQtyFree: 0, grandAmountFree: 0
            };
        }

        // สร้าง Object Map สำหรับค้นหาสินค้าอย่างรวดเร็ว (แบบเดียวกับ Orders.html)
        const prodMapObj = {};
        (products || []).forEach(p => {
            if (!p) return;
            const pId = String(p.id || p.product_id || '').trim();
            const pName = String(p.name || p.product_name || '').trim();
            const cleanPName = pName.replace(/\(.*?\)/g, '').trim();
            if (pId) prodMapObj[pId] = p;
            if (pName) {
                prodMapObj[pName] = p;
                prodMapObj[pName.toUpperCase()] = p;
            }
            if (cleanPName) {
                prodMapObj[cleanPName] = p;
                prodMapObj[cleanPName.toUpperCase()] = p;
            }
        });

        // สร้าง Member Map สำหรับดึงชื่อจริงของผู้ขาย (Seller/Member Name) ขึ้นมาแสดงก่อน
        const memberMap = new Map();
        (members || []).forEach(m => {
            if (!m) return;
            const mId = String(m.id || m.user_id || '').trim().toUpperCase();
            const mName = String(m.name || '').trim();
            if (mId && mName) memberMap.set(mId, mName);
        });

        const groupMap = new Map();
        const allBillsSet = new Set();

        sales.forEach(s => {
            if (!s) return;
            const isCust = (groupBy === 'customer');
            const groupId = isCust 
                ? String(s.customerId || s.customer_id || '').trim() 
                : String(s.memberId || s.member_id || s.seller_id || s.sellerId || s.marketing || '').trim();

            let groupName = '';
            if (isCust) {
                const cName = String(s.customerName || s.customer_name || '').trim();
                groupName = (cName && cName.toUpperCase() !== groupId.toUpperCase()) 
                    ? cName 
                    : (groupId ? `ลูกค้า (${groupId})` : 'ลูกค้าทั่วไป');
            } else {
                const mLookup = memberMap.get(groupId.toUpperCase()) || '';
                const sName = String(s.sellerName || s.seller_name || s.memberName || s.member_name || '').trim();
                if (mLookup) {
                    groupName = mLookup;
                } else if (sName && sName.toUpperCase() !== groupId.toUpperCase()) {
                    groupName = sName;
                } else {
                    groupName = groupId ? `พนักงาน (${groupId})` : 'ไม่ระบุผู้ขาย';
                }
            }
            
            const groupKey = `${groupId}___${groupName}`;

            if (!groupMap.has(groupKey)) {
                groupMap.set(groupKey, {
                    groupId: groupId || '-',
                    groupName: groupName,
                    items: [],
                    billsSet: new Set(),
                    billsCount: 0,
                    subtotalQty: 0,
                    subtotalWg: 0,
                    subtotalAmount: 0,
                    qtyFull: 0, amountFull: 0,
                    qtyMember: 0, amountMember: 0,
                    qtyPromo: 0, amountPromo: 0,
                    qtyFree: 0, amountFree: 0
                });
            }

            const currentGroup = groupMap.get(groupKey);
            const billId = String(s.id || s.order_id || '').trim();
            if (billId) {
                currentGroup.billsSet.add(billId);
                allBillsSet.add(billId);
            }

            // ดึงรายการสินค้าจาก _items หรือ items_json
            let itemsList = s._items;
            if (!itemsList && s.items_json) {
                try { itemsList = typeof s.items_json === 'string' ? JSON.parse(s.items_json) : s.items_json; } catch(e){}
            }

            if (Array.isArray(itemsList) && itemsList.length > 0) {
                itemsList.forEach(it => {
                    const pName = String(it.productName || it.name || it.product || it.prod || 'สินค้า').trim();
                    const cleanPName = pName.replace(/\(.*?\)/g, '').trim();
                    const pObj = (it.id && prodMapObj[it.id]) || 
                                 (it.product_id && prodMapObj[it.product_id]) || 
                                 prodMapObj[pName] || 
                                 prodMapObj[cleanPName] || 
                                 prodMapObj[pName.toUpperCase()] || 
                                 prodMapObj[cleanPName.toUpperCase()] || {};

                    // ⭐ ดักจับเซ็ตโปรโมชั่นและตัวคูณการตัดสต๊อกจริง (Bundle Multiplier)
                    const isBundle = Boolean(pObj.is_bundle || pObj.isBundle || (pObj.bundle_qty && Number(pObj.bundle_qty) > 1));
                    let bundleMultiplier = isBundle ? (Number(pObj.bundle_qty || pObj.bundleQty) || 1) : 1;

                    // เผื่อกรณีชื่อระบุตัวเลข เช่น "โปร 2 แถม 1" หรือ "3 กล่อง" หากใน DB ยังไม่ได้ระบุ bundle_qty
                    if (bundleMultiplier === 1) {
                        const buyFreeMatch = pName.match(/(\d+)\s*(?:แถม|\+)\s*(\d+)/);
                        if (buyFreeMatch) {
                            bundleMultiplier = (parseInt(buyFreeMatch[1]) || 0) + (parseInt(buyFreeMatch[2]) || 0);
                        } else {
                            const boxMatch = pName.match(/(\d+)\s*(?:กล่อง|ชิ้น|ขวด|กระปุก|ชุด|เซ็ต)/i);
                            if (boxMatch && parseInt(boxMatch[1]) > 1) {
                                bundleMultiplier = parseInt(boxMatch[1]);
                            }
                        }
                    }

                    const orderedQty = Number(it.qty || it.quantity || 1);
                    // จำนวนชิ้น/กล่องที่ตัดสต๊อกจริง (Deducted Stock Quantity)
                    const stockQty = orderedQty * bundleMultiplier;
                    const stockWg = Number(it.wg || it.weight || stockQty);

                    let price = Number(it.price || it.unitPrice || it.unit_price || 0);
                    let amt = Number(it.total || it.amount || 0);

                    const priceType = classifyOrderItem(it, price, amt, prodMapObj);

                    // 🌟 ถ้าเป็นราคาศูนย์ (ของแถม / ตัดศูนย์) บังคับยอดเงินและราคาต่อหน่วยเป็น 0 เสมอ 100% ห้ามมีจำนวนเงินเด็ดขาด!
                    if (priceType === 'ราคาศูนย์') {
                        price = 0;
                        amt = 0;
                    } else {
                        if (amt === 0 && price > 0 && orderedQty > 0) amt = orderedQty * price;
                        if (price === 0 && orderedQty > 0 && amt > 0) price = Math.round(amt / orderedQty);
                    }

                    // คำนวณราคาต่อหน่วยตัดสต๊อก (AR = Amount / Stock Qty)
                    const unitAr = (amt > 0 && stockQty > 0) ? (amt / stockQty) : 0;

                    currentGroup.items.push({
                        billId: billId,
                        date: s.date || '',
                        productName: pName,
                        priceType: priceType,
                        qty: stockQty, // แสดงจำนวนที่ตัดสต๊อกจริงเป๊ะๆ ตามระบบ
                        orderedQty: orderedQty,
                        bundleMultiplier: bundleMultiplier,
                        baseProduct: pObj.base_product || pObj.baseProduct || '',
                        wg: stockWg,
                        amount: amt,
                        ar: unitAr
                    });

                    currentGroup.subtotalQty += stockQty;
                    currentGroup.subtotalWg += stockWg;
                    currentGroup.subtotalAmount += amt;

                    if (priceType === 'ราคาเต็ม') {
                        currentGroup.qtyFull += stockQty;
                        currentGroup.amountFull += amt;
                    } else if (priceType === 'ราคาสมาชิก') {
                        currentGroup.qtyMember += stockQty;
                        currentGroup.amountMember += amt;
                    } else if (priceType === 'ราคาโปร') {
                        currentGroup.qtyPromo += stockQty;
                        currentGroup.amountPromo += amt;
                    } else {
                        currentGroup.qtyFree += stockQty;
                        currentGroup.amountFree += 0;
                    }
                });
            } else {
                // Fallback กรณีไม่มี items_json ตรวจจับจากคอลัมน์ [Product]_ราคา...
                let hasLegacy = false;
                Object.keys(s).forEach(k => {
                    if (k.endsWith('_ราคาเต็ม') || k.endsWith('_ราคาสมาชิก') || k.endsWith('_ราคาโปร') || k.endsWith('_ราคาศูนย์')) {
                        const qty = Number(s[k]);
                        if (qty > 0) {
                            const pName = k.replace(/_ราคา(เต็ม|สมาชิก|โปร|ศูนย์)$/, '').trim();
                            const cleanProdName = pName.replace(/\(.*?\)/g, '').trim();
                            const pObj = prodMapObj[pName] || prodMapObj[cleanProdName] || {};
                            const isBundle = Boolean(pObj.is_bundle || pObj.isBundle || (pObj.bundle_qty && Number(pObj.bundle_qty) > 1));
                            const bundleMultiplier = isBundle ? (Number(pObj.bundle_qty || pObj.bundleQty) || 1) : 1;
                            const stockQty = qty * bundleMultiplier;
                            const wg = stockQty;
                            const amt = 0;
                            let legacyType = 'ราคาเต็ม';
                            if (k.endsWith('_ราคาสมาชิก')) legacyType = 'ราคาสมาชิก';
                            else if (k.endsWith('_ราคาโปร')) legacyType = 'ราคาโปร';
                            else if (k.endsWith('_ราคาศูนย์')) legacyType = 'ราคาศูนย์';

                            const correctType = classifyOrderItem({ prod: pName, type: legacyType, qty }, null, null, prodMapObj);

                            currentGroup.items.push({
                                billId: billId,
                                date: s.date || '',
                                productName: pName,
                                priceType: correctType,
                                qty: stockQty,
                                orderedQty: qty,
                                bundleMultiplier: bundleMultiplier,
                                baseProduct: pObj.base_product || pObj.baseProduct || '',
                                wg: wg,
                                amount: 0,
                                ar: 0
                            });

                            currentGroup.subtotalQty += stockQty;
                            currentGroup.subtotalWg += wg;
                            if (correctType === 'ราคาเต็ม') currentGroup.qtyFull += stockQty;
                            else if (correctType === 'ราคาสมาชิก') currentGroup.qtyMember += stockQty;
                            else if (correctType === 'ราคาโปร') currentGroup.qtyPromo += stockQty;
                            else currentGroup.qtyFree += stockQty;

                            hasLegacy = true;
                        }
                    }
                });

                if (!hasLegacy) {
                    const totalAmt = Number(s['ยอดขายรวม'] || s.total_amount || 0);
                    currentGroup.items.push({
                        billId: billId,
                        date: s.date || '',
                        productName: 'ยอดขายบิล',
                        priceType: 'ราคาเต็ม',
                        qty: 1,
                        wg: 1,
                        amount: totalAmt,
                        ar: totalAmt
                    });
                    currentGroup.subtotalQty += 1;
                    currentGroup.subtotalWg += 1;
                    currentGroup.subtotalAmount += totalAmt;
                    currentGroup.qtyFull += 1;
                    currentGroup.amountFull += totalAmt;
                }
            }
        });

        const groups = Array.from(groupMap.values()).filter(g => g.items.length > 0);
        let grandTotalQty = 0;
        let grandTotalWg = 0;
        let grandTotalAmount = 0;
        let grandQtyFull = 0, grandAmountFull = 0;
        let grandQtyMember = 0, grandAmountMember = 0;
        let grandQtyPromo = 0, grandAmountPromo = 0;
        let grandQtyFree = 0, grandAmountFree = 0;

        groups.forEach(g => {
            g.billsCount = g.billsSet.size;
            grandTotalQty += g.subtotalQty;
            grandTotalWg += g.subtotalWg;
            grandTotalAmount += g.subtotalAmount;

            grandQtyFull += g.qtyFull;
            grandAmountFull += g.amountFull;
            grandQtyMember += g.qtyMember;
            grandAmountMember += g.amountMember;
            grandQtyPromo += g.qtyPromo;
            grandAmountPromo += g.amountPromo;
            grandQtyFree += g.qtyFree;
            grandAmountFree += g.amountFree;

            // 🌟 สรุปรวมรายสินค้า (Product Summary) แยกตามชนิดสินค้า และแยกประเภทราคา
            // สำคัญมาก: สินค้าที่เป็น "ราคาศูนย์" (ของแถม / ตัดศูนย์) ต้องแยกแถวต่างหากอย่างชัดเจนเสมอ และยอดเงินต้องเป็น 0 
            // ห้ามนำของแถมไปรวมกับยอดเงินของสินค้าที่ขายได้เงินเด็ดขาด!
            const prodSummaryMap = new Map();
            g.items.forEach(it => {
                const pKey = it.productName + '___' + it.priceType;
                if (!prodSummaryMap.has(pKey)) {
                    prodSummaryMap.set(pKey, {
                        productName: it.productName,
                        baseProduct: it.baseProduct,
                        bundleMultiplier: it.bundleMultiplier,
                        qty: 0,
                        orderedQty: 0,
                        wg: 0,
                        amount: 0,
                        priceType: it.priceType,
                        billIds: new Set()
                    });
                }
                const agg = prodSummaryMap.get(pKey);
                agg.qty += it.qty;
                agg.orderedQty += it.orderedQty;
                agg.wg += it.wg;
                agg.amount += (it.priceType === 'ราคาศูนย์' ? 0 : it.amount);
                if (it.billId) agg.billIds.add(it.billId);
            });

            const productSummary = Array.from(prodSummaryMap.values()).map(p => {
                const isZeroPrice = (p.priceType === 'ราคาศูนย์');
                const finalAmt = isZeroPrice ? 0 : p.amount;
                const ar = (!isZeroPrice && finalAmt > 0 && p.qty > 0) ? (finalAmt / p.qty) : 0;
                const billsList = Array.from(p.billIds);
                const billDisplay = billsList.length === 1 
                    ? billsList[0] 
                    : `${billsList.length} บิล (${billsList.slice(0, 3).map(b => b.replace(/^\d{8}-/, '')).join(', ')}${billsList.length > 3 ? '...' : ''})`;

                return {
                    productName: p.productName,
                    baseProduct: p.baseProduct,
                    bundleMultiplier: p.bundleMultiplier,
                    orderedQty: p.orderedQty,
                    qty: p.qty,
                    wg: p.wg,
                    amount: finalAmt,
                    ar: ar,
                    priceType: p.priceType,
                    billId: billDisplay,
                    billIds: billsList,
                    billsCount: billsList.length
                };
            });

            // คำนวณยอดเงินรวมและจำนวนรวมระดับตัวสินค้า (productName) เพื่อจัดกลุ่มให้อยู่ติดกัน
            const prodTotals = {};
            productSummary.forEach(p => {
                if (!prodTotals[p.productName]) prodTotals[p.productName] = { amount: 0, qty: 0 };
                prodTotals[p.productName].amount += p.amount;
                prodTotals[p.productName].qty += p.qty;
            });

            productSummary.sort((a, b) => {
                // 1. เรียงตามยอดเงินรวมของสินค้าชนิดนั้นจากมากไปน้อย
                const diffAmt = (prodTotals[b.productName]?.amount || 0) - (prodTotals[a.productName]?.amount || 0);
                if (Math.abs(diffAmt) > 0.01) return diffAmt;

                // 2. ถ้ายอดเงินรวมเท่ากัน เรียงตามจำนวนรวมของสินค้าชนิดนั้นจากมากไปน้อย
                const diffQty = (prodTotals[b.productName]?.qty || 0) - (prodTotals[a.productName]?.qty || 0);
                if (diffQty !== 0) return diffQty;

                // 3. ถ้าเป็นสินค้าชนิดเดียวกัน ให้แถวที่ได้เงิน (โปร/สมาชิก/เต็ม) ขึ้นก่อนแถวแถมฟรี
                if (a.productName === b.productName) {
                    return b.amount - a.amount;
                }

                return a.productName.localeCompare(b.productName);
            });

            g.rawItems = g.items; // รายการละเอียดรายบิล
            g.productSummary = productSummary; // รายการสรุปรวมตามสินค้า
            g.items = (viewMode === 'bill' ? g.rawItems : g.productSummary);
        });

        // 🌟 จัดเรียงกลุ่ม (ผู้ขาย/ลูกค้า) ตามยอดบิลรวมสูงสุด (Amount) เรียงลงมาจนถึงต่ำสุด
        groups.sort((a, b) => (b.subtotalAmount - a.subtotalAmount) || (b.billsCount - a.billsCount) || (b.subtotalQty - a.subtotalQty));

        return {
            groups,
            totalBillsCount: allBillsSet.size,
            grandTotalQty,
            grandTotalWg,
            grandTotalAmount,
            grandQtyFull,
            grandAmountFull,
            grandQtyMember,
            grandAmountMember,
            grandQtyPromo,
            grandAmountPromo,
            grandQtyFree,
            grandAmountFree
        };
    }

    /**
     * 7. 🌟 คำนวณใบสรุปยอดเงินและปิดกะรายวัน (Daily Cash Closing & Reconciliation Engine)
     * สอดคล้องตามแบบฟอร์มบัญชีปิดยอดประจำวันของ LOVE STK GROUPE
     */
    function calculateDailyCashClosing(sales, targetDate, exchangeRate = 700, options = {}) {
        const exRate = Number(exchangeRate) || 700;
        const permittedMemberSet = options.permittedMemberSet || null;
        const query = String(options.searchQuery || '').trim().toUpperCase();

        const dailyBills = (sales || []).filter(s => {
            if (!s || !s.date) return false;
            const sDate = String(s.date).split('T')[0].split(' ')[0];
            if (sDate !== targetDate) return false;
            if (permittedMemberSet !== null && !permittedMemberSet.has(safeUpper(s.memberId || s.seller_id))) return false;
            if (query !== '') {
                const mName = (s.sellerName || s.seller_name || '').toUpperCase();
                const mId = (s.memberId || s.seller_id || '').toUpperCase();
                const cName = (s.customerName || s.customer_name || '').toUpperCase();
                const bId = (s.id || s.order_id || '').toUpperCase();
                if (!mName.includes(query) && !mId.includes(query) && !cName.includes(query) && !bId.includes(query)) return false;
            }
            return true;
        });

        // เรียงบิลตามเลขที่บิลหรือเวลา order_id จากน้อยไปมาก
        dailyBills.sort((a, b) => String(a.id || a.order_id || '').localeCompare(String(b.id || b.order_id || '')));

        let grandTotalTHB = 0;
        let transferLaosTHB = 0;
        let transferThaiTHB = 0;
        let transferLaosLAK = 0;
        let cashTHB = 0;
        let cashLAK = 0;
        let promoExpenseTHB = 0;
        let codTHB = 0;

        // รายละเอียดแยกตามธนาคาร
        const bankBreakdown = {
            laosTHB: {}, // { 'BCEL': amount, 'JDB': amount }
            laosLAK: {}, // { 'BCEL': amount, 'JDB': amount }
            thaiTHB: {}  // { 'กสิกรไทย': amount }
        };

        dailyBills.forEach(s => {
            const rawAmt = Number(s['ยอดขายรวม'] || s.total_amount || s.totalAmount || 0);
            grandTotalTHB += rawAmt;

            const pModeStr = String(s.payMode || s.pay_mode || s.saleType || s.sale_type || s.payment_method || '').trim();
            const custType = String(s.customerType || s.customer_type || s.custMode || '').trim().toUpperCase();

            // ตรวจสอบว่าเป็น COD หรือลูกค้า VIP ค้างชำระหรือไม่
            const isCodOrVip = custType.includes('COD') || pModeStr.includes('COD') || 
                               (custType.includes('VIP') && (pModeStr.includes('ค้าง') || pModeStr.includes('รอ')));
            if (isCodOrVip) {
                codTHB += rawAmt;
            }

            // คำนวณส่วนลดโปรโมชั่น (ถ้ามีบันทึก)
            const discountAmt = Number(s.discount || s.discount_amount || 0);
            if (discountAmt > 0) {
                promoExpenseTHB += discountAmt;
            }

            // สแกนแยกตามช่องทางชำระเงิน
            if (pModeStr.includes(':') || pModeStr.includes('|')) {
                const parts = pModeStr.split('|');
                parts.forEach(part => {
                    const trimmed = part.trim();
                    if (!trimmed.includes(':')) return;
                    const colonIdx = trimmed.indexOf(':');
                    const key = trimmed.substring(0, colonIdx).trim().toLowerCase();
                    const val = parseFloat(trimmed.substring(colonIdx + 1).replace(/[^\d.]/g, '')) || 0;

                    if (key === 'เรท' || key === 'rate') return;

                    // 1. เงินโอนไทย
                    if (key.includes('โอนไทย') || key.includes('ไทย') || key.includes('kbank') || key.includes('scb') || key.includes('bbl')) {
                        transferThaiTHB += val;
                        // สกัดชื่อธนาคารจากในวงเล็บ
                        const bankMatch = key.match(/\((.*?)\)/);
                        const bName = bankMatch ? bankMatch[1].trim() : 'ไทย';
                        bankBreakdown.thaiTHB[bName] = (bankBreakdown.thaiTHB[bName] || 0) + val;
                    }
                    // 2. เงินโอนลาวบาท
                    else if (key.includes('โอนลาวบาท') || (key.includes('โอนลาว') && key.includes('บาท')) || (key.includes('ลาว') && key.includes('บาท') && key.includes('โอน'))) {
                        transferLaosTHB += val;
                        const bankMatch = key.match(/\((.*?)\)/);
                        const bName = bankMatch ? bankMatch[1].trim() : 'BCEL';
                        bankBreakdown.laosTHB[bName] = (bankBreakdown.laosTHB[bName] || 0) + val;
                    }
                    // 3. เงินโอนลาวกีบ
                    else if (key.includes('โอนลาวกีบ') || (key.includes('โอน') && (key.includes('กีบ') || key.includes('lak') || key.includes('kip'))) || (key.includes('ลาว') && key.includes('กีบ'))) {
                        transferLaosLAK += val;
                        const bankMatch = key.match(/\((.*?)\)/);
                        const bName = bankMatch ? bankMatch[1].trim() : 'BCEL';
                        bankBreakdown.laosLAK[bName] = (bankBreakdown.laosLAK[bName] || 0) + val;
                    }
                    // 4. เงินสดบาท
                    else if (key.includes('สดบาท') || key === 'สด' || (key.includes('สด') && key.includes('บาท'))) {
                        cashTHB += val;
                    }
                    // 5. เงินสดกีบ
                    else if (key.includes('สดกีบ') || (key.includes('สด') && (key.includes('กีบ') || key.includes('lak') || key.includes('kip')))) {
                        cashLAK += val;
                    }
                    // ตรวจจับกรณีระบุยอดมากกว่า 70,000 เข้าสกุลกีบ
                    else if (val >= 70000) {
                        transferLaosLAK += val;
                        bankBreakdown.laosLAK['BCEL'] = (bankBreakdown.laosLAK['BCEL'] || 0) + val;
                    } else {
                        transferLaosTHB += val;
                        bankBreakdown.laosTHB['BCEL'] = (bankBreakdown.laosTHB['BCEL'] || 0) + val;
                    }
                });
            } else {
                // บิลที่ระบุแบบเดี่ยว เช่น "เงินโอน", "สด"
                const lower = pModeStr.toLowerCase();
                if (lower.includes('สด')) {
                    if (lower.includes('กีบ') || rawAmt >= 70000) {
                        cashLAK += rawAmt;
                    } else {
                        cashTHB += rawAmt;
                    }
                } else if (lower.includes('ไทย')) {
                    transferThaiTHB += rawAmt;
                    bankBreakdown.thaiTHB['กสิกรไทย'] = (bankBreakdown.thaiTHB['กสิกรไทย'] || 0) + rawAmt;
                } else if (lower.includes('กีบ') || rawAmt >= 70000) {
                    transferLaosLAK += rawAmt;
                    bankBreakdown.laosLAK['BCEL'] = (bankBreakdown.laosLAK['BCEL'] || 0) + rawAmt;
                } else {
                    transferLaosTHB += rawAmt;
                    bankBreakdown.laosTHB['BCEL'] = (bankBreakdown.laosTHB['BCEL'] || 0) + rawAmt;
                }
            }
        });

        const grandTotalLAK = Math.round(grandTotalTHB * exRate);
        const transferLaosTHB_asLAK = Math.round(transferLaosTHB * exRate);
        const transferThaiTHB_asLAK = Math.round(transferThaiTHB * exRate);
        const cashTHB_asLAK = Math.round(cashTHB * exRate);
        const promoExpenseTHB_asLAK = Math.round(promoExpenseTHB * exRate);
        const codLAK = Math.round(codTHB * exRate);

        // คำนวณยอดเงินที่เหลือ (Remaining Balance)
        // คือยอดรวม THB ลบยอดที่ชำระเป็นบาท (โอนลาวบาท + โอนไทย + สดบาท + ค่าใช้จ่ายโปรโมชั่น)
        // ส่วนต่างที่เหลือคือส่วนที่จ่ายเป็นเงินกีบ (ซึ่งแปลงกลับเป็นบาท)
        const remainingTHB = Math.max(0, Math.round((grandTotalTHB - (transferLaosTHB + transferThaiTHB + cashTHB + promoExpenseTHB)) * 100) / 100);
        const remainingLAK = Math.round(remainingTHB * exRate);

        // ตารางที่ 3: สรุปยอดเงินคงเหลือสกุลกีบ (LAK Balance)
        const totalTransferLAKSum = transferLaosLAK;
        const totalLAKAccounted = cashLAK + totalTransferLAKSum;
        const endingBalanceLAK = Math.round(remainingLAK - totalLAKAccounted);

        // ตารางที่ 4: เงินสดที่ต้องส่งมอบเข้าธนาคารจริง
        const actualCashToBankTHB = cashTHB;
        const actualCashToBankLAK = cashLAK;

        // สรุปยอดโอนบนหัวเอกสาร (Top summary chips)
        const topTransferKip = totalTransferLAKSum;
        const topTransferTHB = transferLaosTHB + transferThaiTHB;

        return {
            date: targetDate,
            exchangeRate: exRate,
            billsCount: dailyBills.length,
            dailyBills,
            // Top Cards
            topTransferKip,
            topTransferTHB,
            // Table 1: ยอดขายทั้งหมด
            grandTotalTHB,
            grandTotalLAK,
            transferLaosTHB,
            transferLaosTHB_asLAK,
            transferThaiTHB,
            transferThaiTHB_asLAK,
            cashTHB,
            cashTHB_asLAK,
            promoExpenseTHB,
            promoExpenseTHB_asLAK,
            remainingTHB,
            remainingLAK,
            // Table 2: COD VIP
            codTHB,
            codLAK,
            // Table 3: ยอดเงินที่เหลือ (LAK Breakdown)
            cashLAK,
            totalTransferLAKSum,
            endingBalanceLAK,
            // Table 4: มอบเงินสดเข้าธนาคาร
            actualCashToBankTHB,
            actualCashToBankLAK,
            // Table 5: สรุปรวม
            finalGrandTotalTHB: grandTotalTHB,
            finalGrandTotalLAK: grandTotalLAK,
            // Breakdown แยกบัญชี
            bankBreakdown
        };
    }

    /**
     * 7. คำนวณรายงานยอดขายตามสินค้า (Product Sales Matrix Report - 15 Columns)
     * สรุป 4 ระดับราคา (ราคา 0, สมาชิก, โปร, ปกติ) พร้อมถอดเซ็ตโปรโมชั่น (Bundle Unpacking)
     */
    function calculateProductSalesMatrix(sales, products = [], startDate = '', endDate = '', options = {}) {
        const { permittedMemberSet = null, searchQuery = '', showAllProducts = false } = options;

        if (!Array.isArray(sales)) {
            return {
                items: [],
                totalBillsCount: 0,
                summary: {
                    totalProductCount: 0,
                    qty0: 0,
                    qtyMember: 0,
                    qtyB2B: 0,
                    qtyPromo: 0,
                    qtyNormal: 0,
                    totalSoldQty: 0,
                    salesNormal: 0,
                    salesMember: 0,
                    salesB2B: 0,
                    salesPromo: 0,
                    grandTotal: 0
                }
            };
        }

        // 1. สร้าง Map สำหรับค้นหาสินค้า
        const prodMapObj = {};
        const baseProductsList = [];
        const bundleMap = {};

        (products || []).forEach(p => {
            if (!p) return;
            const pId = String(p.product_id || p.id || '').trim();
            const pName = String(p.name || p.product_name || '').trim();
            const cleanPName = pName.replace(/\(.*?\)/g, '').trim();

            if (pId) prodMapObj[pId] = p;
            if (pName) {
                prodMapObj[pName] = p;
                prodMapObj[pName.toUpperCase()] = p;
            }
            if (cleanPName) {
                prodMapObj[cleanPName] = p;
                prodMapObj[cleanPName.toUpperCase()] = p;
            }

            const isBundle = Boolean(p.is_bundle || p.isBundle || (p.bundle_qty && Number(p.bundle_qty) > 1));
            if (isBundle) {
                const baseId = String(p.base_product || p.baseProduct || '').trim();
                const bQty = Number(p.bundle_qty || p.bundleQty) || 1;
                if (pId) bundleMap[pId] = { baseId, multiplier: bQty };
                if (pName) bundleMap[pName.toUpperCase()] = { baseId, multiplier: bQty };
                if (cleanPName) bundleMap[cleanPName.toUpperCase()] = { baseId, multiplier: bQty };
            } else {
                baseProductsList.push(p);
            }
        });

        // 2. สร้างโครงสร้างแถวของสินค้าหลัก (Base Product Rows)
        const rowMap = new Map();

        baseProductsList.forEach(p => {
            const pId = String(p.product_id || p.id || '').trim();
            const pName = String(p.name || p.product_name || '').trim();
            if (!pId && !pName) return;

            const rowKey = pId || pName.toUpperCase();
            rowMap.set(rowKey, {
                productId: pId,
                productName: pName,
                category: p.category || '',
                qty0: 0,
                qtyMember: 0,
                qtyB2B: 0,
                qtyPromo: 0,
                qtyNormal: 0,
                unitPriceNormal: Number(p.price_full ?? p.priceFull ?? 0),
                unitPriceMember: Number(p.price_member ?? p.priceMember ?? 0),
                unitPriceB2B: Number(p.price_b2b ?? p.priceB2B ?? 0),
                unitPricePromo: Number(p.price_promo ?? p.pricePromo ?? 0),
                b2bTiers: {},
                b2bTierList: [],
                totalSoldQty: 0,
                salesNormal: 0,
                salesMember: 0,
                salesB2B: 0,
                salesPromo: 0,
                grandTotal: 0
            });
        });

        // Helper ในการหาแถวสินค้า
        const getTargetRow = (pId, pName) => {
            if (pId && rowMap.has(pId)) return rowMap.get(pId);
            if (pName) {
                const upName = pName.toUpperCase();
                if (rowMap.has(upName)) return rowMap.get(upName);
                for (let [, r] of rowMap.entries()) {
                    if (r.productName.toUpperCase() === upName) return r;
                    if (r.productName.replace(/\(.*?\)/g, '').trim().toUpperCase() === pName.replace(/\(.*?\)/g, '').trim().toUpperCase()) return r;
                }
            }
            return null;
        };

        // 3. วนลูปบิลขายเพื่อกระจายยอดลงแต่ละแถว
        const billCountSet = new Set();

        sales.forEach(s => {
            if (!s) return;
            const bDate = String(s.date || s.created_at || '').split('T')[0].split(' ')[0];
            if (startDate && bDate < startDate) return;
            if (endDate && bDate > endDate) return;

            // ข้ามบิลที่ถูกยกเลิก
            const st = String(s.status || '').trim().toLowerCase();
            if (st === 'ยกเลิก' || st === 'cancelled' || st === 'void') return;

            const sellerId = String(s.seller_id || s.memberId || '').trim();
            if (permittedMemberSet !== null && !permittedMemberSet.has(safeUpper(sellerId))) return;

            const billId = String(s.id || s.order_id || '').trim();
            if (billId) billCountSet.add(billId);

            let itemsList = s._items;
            if (!itemsList && s.items_json) {
                try { itemsList = typeof s.items_json === 'string' ? JSON.parse(s.items_json) : s.items_json; } catch(e){}
            }

            if (Array.isArray(itemsList) && itemsList.length > 0) {
                itemsList.forEach(it => {
                    const rawId = String(it.id || it.product_id || '').trim();
                    const rawName = String(it.productName || it.name || it.product || it.prod || 'สินค้า').trim();
                    const cleanName = rawName.replace(/\(.*?\)/g, '').trim();

                    // ค้นหาว่าเป็น Bundle หรือไม่
                    let targetBaseId = '';
                    let multiplier = 1;

                    if (rawId && bundleMap[rawId]) {
                        targetBaseId = bundleMap[rawId].baseId;
                        multiplier = bundleMap[rawId].multiplier;
                    } else if (rawName && bundleMap[rawName.toUpperCase()]) {
                        targetBaseId = bundleMap[rawName.toUpperCase()].baseId;
                        multiplier = bundleMap[rawName.toUpperCase()].multiplier;
                    } else if (cleanName && bundleMap[cleanName.toUpperCase()]) {
                        targetBaseId = bundleMap[cleanName.toUpperCase()].baseId;
                        multiplier = bundleMap[cleanName.toUpperCase()].multiplier;
                    } else {
                        const pObj = prodMapObj[rawId] || prodMapObj[rawName] || prodMapObj[cleanName] || {};
                        if (pObj.is_bundle || pObj.isBundle || (pObj.bundle_qty && Number(pObj.bundle_qty) > 1)) {
                            targetBaseId = String(pObj.base_product || pObj.baseProduct || '').trim();
                            multiplier = Number(pObj.bundle_qty || pObj.bundleQty) || 1;
                        }
                    }

                    // Fallback ตัวคูณจากข้อความในชื่อ เช่น "โปร 2 แถม 1" หรือ "3 กล่อง"
                    if (multiplier === 1) {
                        const buyFreeMatch = rawName.match(/(\d+)\s*(?:แถม|\+)\s*(\d+)/);
                        if (buyFreeMatch) {
                            multiplier = (parseInt(buyFreeMatch[1]) || 0) + (parseInt(buyFreeMatch[2]) || 0);
                        } else {
                            const boxMatch = rawName.match(/(\d+)\s*(?:กล่อง|ชิ้น|ขวด|กระปุก|ชุด|เซ็ต)/i);
                            if (boxMatch && parseInt(boxMatch[1]) > 1) {
                                multiplier = parseInt(boxMatch[1]);
                            }
                        }
                    }

                    // ค้นหาแถวของสินค้าเป้าหมาย
                    let targetRow = null;
                    if (targetBaseId) {
                        targetRow = getTargetRow(targetBaseId, '');
                        if (!targetRow) {
                            const bpObj = prodMapObj[targetBaseId];
                            if (bpObj) targetRow = getTargetRow(bpObj.product_id, bpObj.name);
                        }
                    }
                    if (!targetRow) {
                        targetRow = getTargetRow(rawId, rawName);
                    }

                    // ถ้าไม่พบใน Master Data ให้สร้างแถว Dynamic ขึ้นมา
                    if (!targetRow) {
                        const newKey = rawId || rawName.toUpperCase();
                        targetRow = {
                            productId: rawId || '-',
                            productName: rawName,
                            category: '',
                            qty0: 0,
                            qtyMember: 0,
                            qtyB2B: 0,
                            qtyPromo: 0,
                            qtyNormal: 0,
                            unitPriceNormal: 0,
                            unitPriceMember: 0,
                            unitPriceB2B: 0,
                            unitPricePromo: 0,
                            b2bTiers: {},
                            b2bTierList: [],
                            totalSoldQty: 0,
                            salesNormal: 0,
                            salesMember: 0,
                            salesB2B: 0,
                            salesPromo: 0,
                            grandTotal: 0
                        };
                        rowMap.set(newKey, targetRow);
                    }

                    const orderedQty = Number(it.qty || it.quantity || 1);
                    const actualQty = orderedQty * multiplier;

                    let linePrice = Number(it.price || it.unitPrice || it.unit_price || 0);
                    let lineTotal = Number(it.total || it.amount || 0);

                    if (lineTotal === 0 && linePrice > 0 && orderedQty > 0) lineTotal = orderedQty * linePrice;
                    if (linePrice === 0 && orderedQty > 0 && lineTotal > 0) linePrice = Math.round(lineTotal / orderedQty);

                    const unitAr = (actualQty > 0 && lineTotal > 0) ? (lineTotal / actualQty) : linePrice;

                    // 🌟 ตรวจสอบว่าเป็นการขายส่ง B2B หรือไม่ (แยกห้องออกมาต่างหาก ไม่ปนกับ Member ทั่วไป)
                    const isB2B = (String(s.sale_type || '').toUpperCase() === 'B2B') ||
                                  String(s.order_id || '').toUpperCase().startsWith('B2B-') ||
                                  Boolean(it.appliedTier) ||
                                  String(it.priceType || it.type || '').toLowerCase().includes('b2b');

                    if (isB2B) {
                        targetRow.qtyB2B += actualQty;
                        targetRow.salesB2B += lineTotal;

                        if (!targetRow.b2bTiers) targetRow.b2bTiers = {};
                        const rateKey = Math.round(unitAr);
                        if (rateKey > 0) {
                            if (!targetRow.b2bTiers[rateKey]) {
                                targetRow.b2bTiers[rateKey] = { unitPrice: rateKey, qty: 0, sales: 0 };
                            }
                            targetRow.b2bTiers[rateKey].qty += actualQty;
                            targetRow.b2bTiers[rateKey].sales += lineTotal;
                        }

                        if (targetRow.unitPriceB2B === 0 && unitAr > 0) {
                            targetRow.unitPriceB2B = unitAr;
                        }
                    } else {
                        // จำแนกประเภทราคาปกติ / สมาชิก / โปร / ศูนย์
                        const priceType = classifyOrderItem(it, unitAr, lineTotal, prodMapObj);

                        if (priceType === 'ราคาศูนย์') {
                            targetRow.qty0 += actualQty;
                        } else if (priceType === 'ราคาเต็ม') {
                            targetRow.qtyNormal += actualQty;
                            targetRow.salesNormal += lineTotal;
                            if (targetRow.unitPriceNormal === 0 && unitAr > 0) targetRow.unitPriceNormal = unitAr;
                        } else if (priceType === 'ราคาโปร') {
                            targetRow.qtyPromo += actualQty;
                            targetRow.salesPromo += lineTotal;
                            if (targetRow.unitPricePromo === 0 && unitAr > 0) targetRow.unitPricePromo = unitAr;
                        } else {
                            // ราคาสมาชิก (default ทั่วไป)
                            targetRow.qtyMember += actualQty;
                            targetRow.salesMember += lineTotal;
                            if (targetRow.unitPriceMember === 0 && unitAr > 0) targetRow.unitPriceMember = unitAr;
                        }
                    }
                });
            }
        });

        // 4. สรุปรวมรายแถวและผลรวมท้ายตาราง
        const resultRows = [];
        let summary = {
            totalProductCount: 0,
            qty0: 0,
            qtyMember: 0,
            qtyB2B: 0,
            qtyPromo: 0,
            qtyNormal: 0,
            totalSoldQty: 0,
            salesNormal: 0,
            salesMember: 0,
            salesB2B: 0,
            salesPromo: 0,
            grandTotal: 0
        };

        const query = String(searchQuery || '').trim().toUpperCase();

        rowMap.forEach((r) => {
            const b2bTierValues = Object.values(r.b2bTiers || {});
            if (b2bTierValues.length > 0) {
                b2bTierValues.sort((a, b) => b.qty - a.qty || b.unitPrice - a.unitPrice);
                r.b2bTierList = b2bTierValues;
                if (b2bTierValues.length === 1) {
                    r.unitPriceB2B = b2bTierValues[0].unitPrice;
                }
            } else {
                r.b2bTierList = [];
            }

            r.totalSoldQty = r.qty0 + r.qtyMember + r.qtyB2B + r.qtyPromo + r.qtyNormal;

            // ตรวจสอบยอดขายถ้ามียอดจำนวนแต่ยอดเงินคำนวณจากราคาต่อหน่วย
            if (r.salesNormal === 0 && r.qtyNormal > 0 && r.unitPriceNormal > 0) {
                r.salesNormal = r.qtyNormal * r.unitPriceNormal;
            }
            if (r.salesMember === 0 && r.qtyMember > 0 && r.unitPriceMember > 0) {
                r.salesMember = r.qtyMember * r.unitPriceMember;
            }
            if (r.salesB2B === 0 && r.qtyB2B > 0) {
                if (r.b2bTierList.length > 0) {
                    r.salesB2B = r.b2bTierList.reduce((sum, t) => sum + (t.sales || (t.qty * t.unitPrice)), 0);
                } else if (r.unitPriceB2B > 0) {
                    r.salesB2B = r.qtyB2B * r.unitPriceB2B;
                }
            }
            if (r.salesPromo === 0 && r.qtyPromo > 0 && r.unitPricePromo > 0) {
                r.salesPromo = r.qtyPromo * r.unitPricePromo;
            }

            r.grandTotal = r.salesNormal + r.salesMember + r.salesB2B + r.salesPromo;

            // กรองตามการตั้งค่าและคำค้นหา
            if (!showAllProducts && r.totalSoldQty === 0) return;

            if (query) {
                const matchName = r.productName.toUpperCase().includes(query);
                const matchCode = String(r.productId).toUpperCase().includes(query);
                if (!matchName && !matchCode) return;
            }

            resultRows.push(r);

            summary.qty0 += r.qty0;
            summary.qtyMember += r.qtyMember;
            summary.qtyB2B += r.qtyB2B;
            summary.qtyPromo += r.qtyPromo;
            summary.qtyNormal += r.qtyNormal;
            summary.totalSoldQty += r.totalSoldQty;
            summary.salesNormal += r.salesNormal;
            summary.salesMember += r.salesMember;
            summary.salesB2B += r.salesB2B;
            summary.salesPromo += r.salesPromo;
            summary.grandTotal += r.grandTotal;
        });

        // เรียงลำดับตามรหัสสินค้า
        resultRows.sort((a, b) => {
            const idA = String(a.productId || '');
            const idB = String(b.productId || '');
            return idA.localeCompare(idB, undefined, { numeric: true, sensitivity: 'base' });
        });

        summary.totalProductCount = resultRows.length;

        return {
            items: resultRows,
            totalBillsCount: billCountSet.size,
            summary
        };
    }

    // Export Engine to Global Scope
    window.ReportFinanceEngine = {
        parseSaleCurrencyAmounts,
        processFinanceSales,
        filterFinanceBills,
        calculateFinanceKpi,
        calculateYearlyFinanceData,
        groupSalesForProductReport,
        calculateDailyCashClosing,
        calculateProductSalesMatrix
    };
    window.calculateProductSalesMatrix = calculateProductSalesMatrix;

})(window);

