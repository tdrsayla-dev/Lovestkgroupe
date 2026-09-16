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

    // Export Engine to Global Scope
    window.ReportFinanceEngine = {
        parseSaleCurrencyAmounts,
        processFinanceSales,
        filterFinanceBills,
        calculateFinanceKpi,
        calculateYearlyFinanceData
    };

})(window);
