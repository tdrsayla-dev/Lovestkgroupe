/**
 * ================================================================
 * 📦 reportStockLogic.js - สมองกลประมวลผลและการคำนวณรายงานสต๊อกและสินค้าตัดศูนย์
 * LOVE STK GROUPE - Stock & Zero Price Report Calculation Engine
 * ================================================================
 */

(function (window) {
    'use strict';

    const safeUpper = (str) => String(str || '').trim().toUpperCase();

    /**
     * 1. แปลงชื่อทีมให้เป็นมาตรฐานกลาง
     */
    function resolveTeamName(rawTeam, businessTeams) {
        if (!rawTeam) return 'N/A';
        const tUpper = safeUpper(rawTeam);
        if (Array.isArray(businessTeams) && businessTeams.length > 0) {
            const found = businessTeams.find(bt => {
                if (!bt) return false;
                const bId = safeUpper(bt.id || bt.team_id || bt.Team_ID || bt.code || '');
                const bName = safeUpper(bt.name || bt.team_name || bt.Team_Name || bt.TeamName || '');
                return bId === tUpper || bName === tUpper;
            });
            if (found) {
                const resName = String(found.name || found.team_name || found.Team_Name || found.TeamName || '').trim();
                if (resName) return resName;
            }
        }
        if (tUpper === 'TEAM A' || tUpper === 'TB1') return 'Marketing';
        if (tUpper === 'TEAM B' || tUpper === 'TB2') return 'Center';
        return rawTeam;
    }

    /**
     * 2. จัดโครงสร้างข้อมูลบิลขายสำหรับสต๊อก (Parsing items_json & Customer mapping)
     */
    function processStockSales(saleRes, custRes) {
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
                    const pName = String(it.prod || it.productName || it.name || 'Unknown').trim();
                    s[`${pName}_${typeStr}`] = qtyNum;
                    
                    if (typeStr === 'ราคาเต็ม') sumF += qtyNum;
                    else if (typeStr === 'ราคาสมาชิก') sumM += qtyNum;
                    else if (typeStr === 'ราคาโปร' || typeStr === 'โปรโมชั่น') sumP += qtyNum;
                    else if (typeStr === 'ราคาศูนย์') sumZ += qtyNum;
                    else sumM += qtyNum;
                });
            } else {
                Object.keys(s).forEach(k => {
                    if (k !== 'รวมชิ้นราคาเต็ม' && k !== 'รวมชิ้นราคาสมาชิก' && k !== 'รวมชิ้นราคาโปร' && k !== 'รวมชิ้นราคาศูนย์' && k !== 'ยอดรวมชิ้นทั้งหมด') {
                        if (k.endsWith('_ราคาเต็ม')) sumF += (parseInt(s[k]) || 0);
                        else if (k.endsWith('_ราคาสมาชิก')) sumM += (parseInt(s[k]) || 0);
                        else if (k.endsWith('_ราคาโปร') || k.endsWith('_โปรโมชั่น')) sumP += (parseInt(s[k]) || 0);
                        else if (k.endsWith('_ราคาศูนย์')) sumZ += (parseInt(s[k]) || 0);
                    }
                });
            }
            
            const copy = { ...s };
            copy['id'] = s.id || s.order_id || s.sale_id || s.receipt_id || '';
            copy['memberId'] = s.memberId || s.member_id || s.sellerId || s.seller_id || s.seller || s.user_id || s.created_by || s.marketing || '';
            copy['sellerId'] = copy['memberId'];
            copy['sellerName'] = s.sellerName || s.seller_name || s.member_name || s.marketing_name || copy['memberId'];
            copy['customerType'] = s.customer_type || s.customerType || s.custType || '';
            
            const rawCustId = String(s.customerId || s.customer_id || s.client_id || s.cust_id || s.hn || '').trim().toUpperCase();
            let resolvedCustName = s.customerName || s.customer_name || s.custName || s.client_name || '';
            
            if (rawCustId && Array.isArray(custRes) && custRes.length > 0) {
                const foundCust = custRes.find(c => c && (
                    String(c.id || '').trim().toUpperCase() === rawCustId || 
                    String(c.customer_id || '').trim().toUpperCase() === rawCustId ||
                    String(c.hn || '').trim().toUpperCase() === rawCustId
                ));
                if (foundCust && (foundCust.name || foundCust.customer_name || foundCust.Name)) {
                    resolvedCustName = foundCust.name || foundCust.customer_name || foundCust.Name;
                }
            }
            
            copy['customerId'] = rawCustId;
            copy['customerName'] = resolvedCustName || (rawCustId ? `ลูกค้า (${rawCustId})` : 'ไม่ระบุชื่อ');
            copy['saleType'] = s.sale_type || s.saleType || '';
            copy['payMode'] = s.sale_type || s.saleType || s.payMode || s.pay_mode || 'เงินโอน';
            
            copy['รวมชิ้นราคาเต็ม'] = sumF; 
            copy['รวมชิ้นราคาสมาชิก'] = sumM;
            copy['รวมชิ้นราคาโปร'] = sumP; 
            copy['รวมชิ้นราคาศูนย์'] = sumZ;
            copy['ยอดรวมชิ้นทั้งหมด'] = sumF + sumM + sumP + sumZ;
            copy['_items'] = itemsList;
            copy['ยอดขายรวม'] = Number(s['ยอดขายรวม'] || s.total_amount || s.grand_total || s.totalAmount || s.grandTotal || s.amount || 0);
            
            const rawDate = String(s.date || s.sale_date || s.created_at || '');
            copy['date'] = rawDate.split('T')[0].split(' ')[0];
            
            return copy;
        });
    }

    /**
     * 3. กระจายรายการสินค้าจากบิลขาย สำหรับตรวจสอบสินค้าของแถม/ตัดศูนย์
     */
    function unfoldStockSales(sales, startDate, endDate, permittedMemberSet, members, customers, businessTeams) {
        let items = [];
        const dateFilteredSales = (sales || []).filter(s => {
            const sDate = s.date || s.sale_date || '';
            if (!s || sDate < startDate || sDate > endDate) return false;
            const sMemId = safeUpper(s.memberId || s.member_id || s.sellerId || s.seller_id || s.seller || s.marketing);
            if (permittedMemberSet !== null) return permittedMemberSet.has(sMemId);
            return true;
        });

        dateFilteredSales.forEach(record => {
            const recMemberId = safeUpper(record.memberId || record.member_id || record.sellerId || record.seller_id || record.seller || record.marketing);
            const member = (members || []).find(m => m && safeUpper(m.id) === recMemberId);
            const cust = (customers || []).find(c => c && c.id === record.customerId);
            const cleanTeam = resolveTeamName(member?.team, businessTeams);
            const resolvedCustType = record.customerType || record.custType || record.customer_type || (cust ? cust.type : '') || 'ไม่ระบุประเภท';

            let rawItems = [];
            if (record.items_json) {
                try { rawItems = typeof record.items_json === 'string' ? JSON.parse(record.items_json) : record.items_json; } catch(e){}
            }

            if (!Array.isArray(rawItems) || rawItems.length === 0) {
                Object.entries(record || {}).forEach(([key, value]) => {
                    if (key.endsWith('_ราคาเต็ม') || key.endsWith('_ราคาสมาชิก') || key.endsWith('_ราคาโปร') || key.endsWith('_ราคาศูนย์')) {
                        const qty = parseInt(value, 10);
                        if (!isNaN(qty) && qty > 0) {
                            const lastUnderscore = key.lastIndexOf('_');
                            rawItems.push({
                                prod: key.substring(0, lastUnderscore).replace(/\(.*?\)/g, '').trim(),
                                type: key.substring(lastUnderscore + 1),
                                qty: qty
                            });
                        }
                    }
                });
            }

            if (Array.isArray(rawItems) && rawItems.length > 0) {
                rawItems.forEach(it => {
                    const q = Number(it.qty || it.quantity || 1);
                    if (q > 0) {
                        items.push({
                            billId: record.id,
                            date: record.date || record.sale_date || '',
                            memberId: recMemberId,
                            memberName: member?.name || record.sellerName || recMemberId || 'UNKNOWN',
                            team: cleanTeam,
                            custType: resolvedCustType,
                            product: String(it.prod || it.productName || it.name || 'สินค้าอื่นๆ').trim(),
                            priceType: String(it.type || 'ราคาเต็ม').trim(),
                            qty: q
                        });
                    }
                });
            }
        });

        return items;
    }

    /**
     * 4. คำนวณความเคลื่อนไหวและสต๊อกคงเหลือ (Forward Calculation: ยอดยกมา + รับเข้า - ออก = คงเหลือ)
     */
    function calculateStockSalesReport(products, stockMovements, sales, startDate, endDate, isZeroPromoView, searchQuery, permittedMemberSet) {
        let map = {};
        
        // ก. ตั้งต้นสินค้าทั้งหมด
        (products || []).forEach(p => {
            if (!p) return;
            const pName = String(p.name || p.id || '').trim();
            const pId = String(p.id || pName).trim();
            
            map[pName] = {
                id: pId, name: pName, category: p.category || '-',
                openingBalance: 0,   // ยอดยกมา
                receivedInPeriod: 0, // รับเข้าช่วงเวลา
                periodOut: 0,        // ขาย/เบิกออกช่วงเวลา
                fullQty: 0, memberQty: 0, promoQty: 0, zeroQty: 0
            };
        });

        const validStockMovements = (stockMovements || []).filter(m => m && (m.created_at || m.date));

        // ข. คำนวณประวัติรับเข้า / ปรับลดสต๊อก
        validStockMovements.forEach(m => {
            const targetName = String(m.product_name || m.product || m.name || '').trim();
            if (!targetName) return;
            let foundKey = Object.keys(map).find(k => k.toUpperCase() === targetName.toUpperCase() || map[k].id.toUpperCase() === targetName.toUpperCase());
            
            if (!foundKey) {
                map[targetName] = { id: targetName, name: targetName, category: '-', openingBalance: 0, receivedInPeriod: 0, periodOut: 0, fullQty: 0, memberQty: 0, promoQty: 0, zeroQty: 0 };
                foundKey = targetName;
            }

            const recDate = (m.created_at || m.date || '').substring(0, 10);
            const qty = Number(m.quantity || m.qty || 0);
            const isOutbound = (m.type === 'out' || m.type === 'reduce' || m.type === 'deduct');

            if (recDate < startDate) {
                if (isOutbound) map[foundKey].openingBalance -= qty;
                else map[foundKey].openingBalance += qty;
            } else if (recDate >= startDate && recDate <= endDate) {
                if (isOutbound) map[foundKey].periodOut += qty;
                else map[foundKey].receivedInPeriod += qty;
            }
        });

        // ค. คำนวณยอดขายออก (จากบิลขาย)
        (sales || []).forEach(record => {
            if (!record) return;
            if (permittedMemberSet !== null && !permittedMemberSet.has(safeUpper(record.memberId))) return;
            
            const saleDate = (record.date || record.created_at || '').substring(0, 10);

            Object.entries(record || {}).forEach(([key, value]) => {
                if (key.endsWith('_ราคาเต็ม') || key.endsWith('_ราคาสมาชิก') || key.endsWith('_ราคาโปร') || key.endsWith('_ราคาศูนย์')) {
                    const qty = parseInt(value, 10);
                    if (!isNaN(qty) && qty > 0) {
                        const rawPName = key.substring(0, key.lastIndexOf('_')).trim();
                        const pNameClean = rawPName.replace(/\(.*?\)/g, '').trim();
                        const priceType = key.substring(key.lastIndexOf('_') + 1);

                        let foundKey = Object.keys(map).find(k => k.toUpperCase() === rawPName.toUpperCase() || (map[k].id && map[k].id.toUpperCase() === rawPName.toUpperCase()))
                            || Object.keys(map).find(k => k.toUpperCase() === pNameClean.toUpperCase() || (map[k].id && map[k].id.toUpperCase() === pNameClean.toUpperCase()));
                        
                        const targetKey = foundKey || rawPName;
                        if (!foundKey) {
                            map[targetKey] = { id: targetKey, name: targetKey, category: '-', openingBalance: 0, receivedInPeriod: 0, periodOut: 0, fullQty: 0, memberQty: 0, promoQty: 0, zeroQty: 0 };
                            foundKey = targetKey;
                        }

                        if (saleDate < startDate) {
                            map[foundKey].openingBalance -= qty;
                        } else if (saleDate >= startDate && saleDate <= endDate) {
                            map[foundKey].periodOut += qty;
                            
                            if (priceType === 'ราคาเต็ม') map[foundKey].fullQty += qty;
                            else if (priceType === 'ราคาสมาชิก') map[foundKey].memberQty += qty;
                            else if (priceType === 'ราคาโปร' || priceType === 'โปรโมชั่น') map[foundKey].promoQty += qty;
                            else if (priceType === 'ราคาศูนย์') map[foundKey].zeroQty += qty;
                        }
                    }
                }
            });
        });

        const query = String(searchQuery || '').trim().toUpperCase();
        
        // ง. สรุปผล
        return Object.values(map)
            .map(item => {
                const closingBalance = item.openingBalance + item.receivedInPeriod - item.periodOut;
                return {
                    ...item,
                    currentIn: item.receivedInPeriod,
                    totalOut: item.periodOut,
                    currentStock: closingBalance
                };
            })
            .filter(item => {
                if (isZeroPromoView && item.promoQty === 0 && item.zeroQty === 0) return false;
                if (query !== '' && !item.id.toUpperCase().includes(query) && !item.name.toUpperCase().includes(query)) return false;
                return true;
            })
            .sort((a, b) => b.totalOut - a.totalOut || a.name.localeCompare(b.name));
    }

    /**
     * 5. กรองและจัดเรียงรายการบิลสินค้าแถมและสินค้าตัดศูนย์ (Zero & Promo Items Log)
     */
    function filterZeroPromoBills(unfoldedSales, isZeroPromoView, searchQuery) {
        if (!isZeroPromoView) return [];
        let list = [];
        (unfoldedSales || []).forEach(s => {
            if (s.priceType === 'ราคาโปร' || s.priceType === 'โปรโมชั่น' || s.priceType === 'ราคาศูนย์') {
                list.push(s);
            }
        });
        const query = String(searchQuery || '').trim().toUpperCase();
        return list.filter(item => {
            if (query === '') return true;
            const bId = (item.billId || '').toUpperCase();
            const mName = (item.memberName || '').toUpperCase();
            const mId = (item.memberId || '').toUpperCase();
            const cType = (item.custType || '').toUpperCase();
            const pName = (item.product || '').toUpperCase();
            return bId.includes(query) || mName.includes(query) || mId.includes(query) || cType.includes(query) || pName.includes(query);
        }).sort((a, b) => b.date.localeCompare(a.date) || b.billId.localeCompare(a.billId));
    }

    // Export Engine to Global Scope
    window.ReportStockEngine = {
        resolveTeamName,
        processStockSales,
        unfoldStockSales,
        calculateStockSalesReport,
        filterZeroPromoBills
    };

})(window);
