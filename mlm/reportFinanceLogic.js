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

    // Export Engine to Global Scope
    window.ReportFinanceEngine = {
        parseSaleCurrencyAmounts,
        processFinanceSales,
        filterFinanceBills,
        calculateFinanceKpi,
        calculateYearlyFinanceData,
        groupSalesForProductReport
    };

})(window);

