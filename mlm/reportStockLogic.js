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
     * ระบบจำแนกประเภทราคาตามมาตรฐานกลาง (Classification Engine)
     * รองรับ 4 ประเภทราคา: 'ราคาเต็ม', 'ราคาสมาชิก', 'ราคาโปร', 'ราคาศูนย์'
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

        // 2. ตรวจสอบจากราคาจริง (Actual Unit Price) เทียบกับฐานข้อมูลสินค้าเป็นอันดับหนึ่ง
        if (rawPrice !== null && rawPrice > 0) {
            if ((pMember > 0 && Math.abs(rawPrice - pMember) < 0.01) || (rawPrice === 1500 && (pMember === 1500 || pMember === 0))) {
                return 'ราคาสมาชิก';
            }
            if (pPromo > 0 && Math.abs(rawPrice - pPromo) < 0.01) {
                return 'ราคาโปร';
            }
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

        // 3. ถ้าไม่มีราคาจริงหรือราคาไม่ตรงฐานข้อมูล ให้ดูจากประเภทราคาที่ระบุในบิล
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
    function processStockSales(saleRes, custRes, products = []) {
        if (!Array.isArray(saleRes)) return [];
        
        const prodMapObj = {};
        (products || []).forEach(p => {
            if (!p) return;
            const pId = String(p.product_id || p.id || '').trim();
            const pName = String(p.name || p.product_name || pId).trim();
            const cleanPName = pName.replace(/\(.*?\)/g, '').trim();
            if (pId) prodMapObj[pId] = p;
            if (pName) { prodMapObj[pName] = p; prodMapObj[pName.toUpperCase()] = p; }
            if (cleanPName) { prodMapObj[cleanPName] = p; prodMapObj[cleanPName.toUpperCase()] = p; }
        });

        return saleRes.map(s => {
            let sumF = 0, sumM = 0, sumB = 0, sumP = 0, sumZ = 0;
            let itemsList = [];
            if (s.items_json) {
                try { itemsList = typeof s.items_json === 'string' ? JSON.parse(s.items_json) : s.items_json; } catch(e){}
            }
            
            if (Array.isArray(itemsList) && itemsList.length > 0) {
                itemsList.forEach(it => {
                    const qtyNum = Number(it.qty || it.quantity || 1);
                    const pName = String(it.prod || it.productName || it.name || 'Unknown').trim();
                    const price = it.price !== undefined ? it.price : (it.unit_price ?? it.rate);
                    const amt = it.amount !== undefined ? it.amount : (it.total_amount ?? it.totalPrice);
                    const isB2B = (String(s.sale_type || '').toUpperCase() === 'B2B') ||
                                  String(s.order_id || s.id || '').toUpperCase().startsWith('B2B-') ||
                                  Boolean(it.appliedTier) ||
                                  String(it.priceType || it.type || '').toLowerCase().includes('b2b');
                    const typeStr = isB2B ? 'ราคา B2B' : classifyOrderItem(it, price, amt, prodMapObj);
                    s[`${pName}_${typeStr}`] = qtyNum;
                    
                    if (isB2B) sumB += qtyNum;
                    else if (typeStr === 'ราคาเต็ม') sumF += qtyNum;
                    else if (typeStr === 'ราคาโปร' || typeStr === 'โปรโมชั่น') sumP += qtyNum;
                    else if (typeStr === 'ราคาศูนย์') sumZ += qtyNum;
                    else sumM += qtyNum;
                });
            } else {
                Object.keys(s).forEach(k => {
                    if (k !== 'รวมชิ้นราคาเต็ม' && k !== 'รวมชิ้นราคาสมาชิก' && k !== 'รวมชิ้นราคาB2B' && k !== 'รวมชิ้นราคาโปร' && k !== 'รวมชิ้นราคาศูนย์' && k !== 'ยอดรวมชิ้นทั้งหมด') {
                        const lastUnderscore = k.lastIndexOf('_');
                        if (lastUnderscore > 0) {
                            const rawPName = k.substring(0, lastUnderscore).trim();
                            const legacyType = k.substring(lastUnderscore + 1).trim();
                            const valQty = parseInt(s[k]) || 0;
                            if (valQty > 0) {
                                const isB2B = (String(s.sale_type || '').toUpperCase() === 'B2B') ||
                                              String(s.order_id || s.id || '').toUpperCase().startsWith('B2B-') ||
                                              legacyType.toLowerCase().includes('b2b');
                                const correctType = isB2B ? 'ราคา B2B' : classifyOrderItem({ prod: rawPName, type: legacyType, qty: valQty }, null, null, prodMapObj);
                                if (isB2B) sumB += valQty;
                                else if (correctType === 'ราคาเต็ม') sumF += valQty;
                                else if (correctType === 'ราคาโปร' || correctType === 'โปรโมชั่น') sumP += valQty;
                                else if (correctType === 'ราคาศูนย์') sumZ += valQty;
                                else sumM += valQty;
                            }
                        }
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
            copy['รวมชิ้นราคาB2B'] = sumB;
            copy['รวมชิ้นราคาโปร'] = sumP; 
            copy['รวมชิ้นราคาศูนย์'] = sumZ;
            copy['ยอดรวมชิ้นทั้งหมด'] = sumF + sumM + sumB + sumP + sumZ;
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
    function unfoldStockSales(sales, startDate, endDate, permittedMemberSet, members, customers, businessTeams, products = []) {
        let items = [];
        const prodMapObj = {};
        (products || []).forEach(p => {
            if (!p) return;
            const pId = String(p.product_id || p.id || '').trim();
            const pName = String(p.name || p.product_name || pId).trim();
            const cleanPName = pName.replace(/\(.*?\)/g, '').trim();
            if (pId) prodMapObj[pId] = p;
            if (pName) { prodMapObj[pName] = p; prodMapObj[pName.toUpperCase()] = p; }
            if (cleanPName) { prodMapObj[cleanPName] = p; prodMapObj[cleanPName.toUpperCase()] = p; }
        });

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
                        const unitPrice = it.price !== undefined ? it.price : (it.unit_price ?? it.rate);
                        const amt = it.amount !== undefined ? it.amount : (it.total_amount ?? it.totalPrice);
                        const isB2B = (String(record.sale_type || '').toUpperCase() === 'B2B') ||
                                      String(record.order_id || record.id || '').toUpperCase().startsWith('B2B-') ||
                                      Boolean(it.appliedTier) ||
                                      String(it.priceType || it.type || '').toLowerCase().includes('b2b');
                        const resolvedType = isB2B ? 'ราคา B2B' : classifyOrderItem(it, unitPrice, amt, prodMapObj);
                        items.push({
                            billId: record.id,
                            date: record.date || record.sale_date || '',
                            memberId: recMemberId,
                            memberName: member?.name || record.sellerName || recMemberId || 'UNKNOWN',
                            team: cleanTeam,
                            custType: resolvedCustType,
                            product: String(it.prod || it.productName || it.name || 'สินค้าอื่นๆ').trim(),
                            priceType: resolvedType,
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
     * รองรับ Bundle Expansion กระจายสินค้าเซ็ตลงสต๊อกสินค้าหลัก และแยก 4 ประเภทราคาตามจริง
     */
    function calculateStockSalesReport(products, stockMovements, sales, startDate, endDate, isZeroPromoView, searchQuery, permittedMemberSet, isBalanceView) {
        let map = {};
        const prodMapObj = {};
        const bundleMap = {};
        
        // ก. ตั้งต้นสินค้าทั้งหมด โดยรองรับทั้ง product_id และ id จากฐานข้อมูล
        (products || []).forEach(p => {
            if (!p) return;
            const pId = String(p.product_id || p.id || '').trim();
            const pName = String(p.name || p.product_name || pId).trim();
            const cleanPName = pName.replace(/\(.*?\)/g, '').trim();
            if (!pId && !pName) return;
            const key = pId || pName;
            
            map[key] = {
                id: pId || key,
                name: pName,
                category: p.category || '-',
                current_stock: Number(p.current_stock !== undefined ? p.current_stock : (p.stock || 0)),
                openingBalance: 0,   // ยอดยกมา
                receivedInPeriod: 0, // รับเข้าช่วงเวลา
                periodOut: 0,        // ขาย/เบิกออกช่วงเวลา
                fullQty: 0, memberQty: 0, b2bQty: 0, promoQty: 0, zeroQty: 0
            };

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
            }
        });

        // ฟังก์ชันช่วยค้นหาคีย์สินค้าอย่างแม่นยำ (จับคู่ได้ทั้งรหัส P024, ชื่อ SESAMEEN ACTIVE หรือชื่อตัดวงเล็บ)
        const findKey = (target) => {
            if (!target) return null;
            const tStr = String(target).trim().toUpperCase();
            const tClean = tStr.replace(/\(.*?\)/g, '').trim();
            
            // 1. ตรงกับ Key หรือ ID ในตาราง
            if (map[tStr]) return tStr;
            for (const k of Object.keys(map)) {
                if (k.toUpperCase() === tStr || (map[k].id && map[k].id.toUpperCase() === tStr)) return k;
            }
            // 2. ตรงกับชื่อสินค้า
            for (const k of Object.keys(map)) {
                const kName = (map[k].name || '').toUpperCase();
                if (kName === tStr) return k;
            }
            // 3. ตรงกับชื่อตัดวงเล็บ
            if (tClean) {
                for (const k of Object.keys(map)) {
                    const kNameClean = (map[k].name || '').toUpperCase().replace(/\(.*?\)/g, '').trim();
                    if (kNameClean === tClean) return k;
                }
            }
            // 4. มีชื่อเป็นส่วนหนึ่ง
            for (const k of Object.keys(map)) {
                const kName = (map[k].name || '').toUpperCase();
                if (kName && (kName.includes(tStr) || tStr.includes(kName))) return k;
            }
            return null;
        };

        const validStockMovements = (stockMovements || []).filter(m => m && (m.created_at || m.date));

        // ข. คำนวณประวัติรับเข้า / ปรับลดสต๊อกคลัง (เฉพาะการรับเข้า GRN หรือปรับสต๊อกคลัง ไม่นับซ้ำกับบิลขาย)
        validStockMovements.forEach(m => {
            const targetName = String(m.product_id || m.productId || m.product_name || m.product || m.name || '').trim();
            if (!targetName) return;
            let foundKey = findKey(targetName);
            
            if (!foundKey) {
                map[targetName] = { id: targetName, name: targetName, category: '-', openingBalance: 0, receivedInPeriod: 0, periodOut: 0, fullQty: 0, memberQty: 0, b2bQty: 0, promoQty: 0, zeroQty: 0 };
                foundKey = targetName;
            }

            const recDate = (m.created_at || m.date || '').substring(0, 10);
            const qty = Number(m.quantity || m.qty || 0);
            if (qty <= 0) return;

            const subType = String(m.sub_type || '');
            const notes = String(m.notes || '');
            const isSaleMovement = subType.includes('ขาย') || notes.includes('บิล') || subType.includes('ตัดสต๊อก');
            const isSaleReturn = subType.includes('คืนสต๊อก') || subType.includes('ยกเลิก') || notes.includes('คืน') || notes.includes('Cancel');
            const isOutbound = (m.type && String(m.type).toLowerCase() === 'out') || (m.type === 'reduce' || m.type === 'deduct');

            if (recDate < startDate) {
                if (isOutbound) map[foundKey].openingBalance -= qty;
                else map[foundKey].openingBalance += qty;
            } else if (recDate >= startDate && recDate <= endDate) {
                // ⚠️ ยอดขายสำเร็จจริงจะถูกคำนวณจากบิลขาย (sales) ในขั้นตอน ค. เพื่อแยกประเภทราคา (เต็ม/สมาชิก/โปร/ศูนย์) อย่างแม่นยำ
                // ดังนั้น movement ที่เป็นตัดสต๊อกขาย ไม่นำมาบวกทบซ้ำ เพื่อป้องกันยอดเบิ้ล 2 เท่า
                if (!isSaleMovement && !isSaleReturn) {
                    if (isOutbound) map[foundKey].periodOut += qty;
                    else map[foundKey].receivedInPeriod += qty;
                }
            }
        });

        // ค. คำนวณยอดขายออกสำเร็จจริง (จากบิลขายที่ไม่ได้ยกเลิก - Single Source of Truth)
        (sales || []).forEach(record => {
            if (!record) return;
            const statusUpper = safeUpper(record.status);
            // กรองข้ามบิลที่ถูกยกเลิกหรือไม่สำเร็จ
            if (statusUpper === 'CANCELLED' || statusUpper === 'ยกเลิก' || statusUpper === 'DELETED') return;
            if (permittedMemberSet !== null && !permittedMemberSet.has(safeUpper(record.memberId))) return;
            
            const saleDate = (record.date || record.created_at || '').substring(0, 10);

            // 1. ตรวจสอบรายการสินค้าจากบิลก่อน (_items หรือ items_json)
            let billItems = record._items;
            if (!billItems && record.items_json) {
                try { billItems = typeof record.items_json === 'string' ? JSON.parse(record.items_json) : record.items_json; } catch(e){}
            }

            if (Array.isArray(billItems) && billItems.length > 0) {
                billItems.forEach(it => {
                    const rawQty = Number(it.qty || it.quantity || 0);
                    if (rawQty <= 0) return;
                    const rawId = String(it.id || it.product_id || it.productId || '').trim();
                    const rawName = String(it.prod || it.productName || it.name || '').trim();
                    const targetStr = rawId || rawName;
                    const targetUpper = targetStr.toUpperCase();
                    const cleanUpper = targetUpper.replace(/\(.*?\)/g, '').trim();

                    let multiplier = 1;
                    let targetBaseId = targetStr;

                    const bInfo = bundleMap[targetStr] || bundleMap[targetUpper] || bundleMap[cleanUpper];
                    if (bInfo) {
                        targetBaseId = bInfo.baseId || targetStr;
                        multiplier = bInfo.multiplier || 1;
                    } else {
                        const pObj = (targetStr && prodMapObj[targetStr]) || prodMapObj[targetUpper] || prodMapObj[cleanUpper];
                        if (pObj && (pObj.is_bundle || pObj.isBundle || (pObj.bundle_qty && Number(pObj.bundle_qty) > 1))) {
                            targetBaseId = String(pObj.base_product || pObj.baseProduct || '').trim();
                            multiplier = Number(pObj.bundle_qty || pObj.bundleQty) || 1;
                        }
                    }

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

                    const actualQty = rawQty * multiplier;
                    const targetKey = targetBaseId || rawId || rawName;
                    let foundKey = findKey(targetKey);

                    if (!foundKey) {
                        const fallbackKey = String(targetKey || 'Unknown');
                        map[fallbackKey] = { id: fallbackKey, name: rawName || fallbackKey, category: '-', openingBalance: 0, receivedInPeriod: 0, periodOut: 0, fullQty: 0, memberQty: 0, b2bQty: 0, promoQty: 0, zeroQty: 0 };
                        foundKey = fallbackKey;
                    }

                    let linePrice = Number(it.price || it.unitPrice || it.unit_price || 0);
                    let lineTotal = Number(it.total || it.amount || it.total_amount || 0);
                    if (lineTotal === 0 && linePrice > 0 && rawQty > 0) lineTotal = rawQty * linePrice;
                    if (linePrice === 0 && rawQty > 0 && lineTotal > 0) linePrice = Math.round(lineTotal / rawQty);

                    const unitAr = (actualQty > 0 && lineTotal > 0) ? (lineTotal / actualQty) : linePrice;
                    const isB2B = (String(record.sale_type || '').toUpperCase() === 'B2B') ||
                                  String(record.order_id || record.id || '').toUpperCase().startsWith('B2B-') ||
                                  Boolean(it.appliedTier) ||
                                  String(it.priceType || it.type || '').toLowerCase().includes('b2b');
                    const priceType = isB2B ? 'ราคา B2B' : classifyOrderItem(it, unitAr, lineTotal, prodMapObj);

                    if (saleDate < startDate) {
                        map[foundKey].openingBalance -= actualQty;
                    } else if (saleDate >= startDate && saleDate <= endDate) {
                        map[foundKey].periodOut += actualQty;
                        if (isB2B) map[foundKey].b2bQty += actualQty;
                        else if (priceType === 'ราคาเต็ม') map[foundKey].fullQty += actualQty;
                        else if (priceType === 'ราคาโปร' || priceType === 'โปรโมชั่น') map[foundKey].promoQty += actualQty;
                        else if (priceType === 'ราคาศูนย์') map[foundKey].zeroQty += actualQty;
                        else map[foundKey].memberQty += actualQty;
                    }
                });
            } else {
                // 2. Fallback อ่านจาก flattened key (เช่น SESAMEEN ACTIVE_ราคาสมาชิก)
                Object.entries(record || {}).forEach(([key, value]) => {
                    if (key.endsWith('_ราคาเต็ม') || key.endsWith('_ราคาสมาชิก') || key.endsWith('_ราคาโปร') || key.endsWith('_ราคาศูนย์') || key.endsWith('_โปรโมชั่น')) {
                        const lineQty = parseInt(value, 10);
                        if (!isNaN(lineQty) && lineQty > 0) {
                            const lastUnderscore = key.lastIndexOf('_');
                            const rawPName = key.substring(0, lastUnderscore).trim();
                            const legacyType = key.substring(lastUnderscore + 1).trim();

                            const bundleInfo = bundleMap[rawPName] || bundleMap[rawPName.toUpperCase()] || bundleMap[rawPName.replace(/\(.*?\)/g, '').trim().toUpperCase()];
                            const multiplier = bundleInfo ? (bundleInfo.multiplier || 1) : 1;
                            const targetBaseId = bundleInfo ? (bundleInfo.baseId || rawPName) : rawPName;
                            const actualQty = lineQty * multiplier;

                            let foundKey = findKey(targetBaseId);
                            if (!foundKey) {
                                map[targetBaseId] = { id: targetBaseId, name: rawPName || targetBaseId, category: '-', openingBalance: 0, receivedInPeriod: 0, periodOut: 0, fullQty: 0, memberQty: 0, b2bQty: 0, promoQty: 0, zeroQty: 0 };
                                foundKey = targetBaseId;
                            }

                            const isB2B = (String(record.sale_type || '').toUpperCase() === 'B2B') ||
                                          String(record.order_id || record.id || '').toUpperCase().startsWith('B2B-') ||
                                          legacyType.toLowerCase().includes('b2b');
                            const correctType = isB2B ? 'ราคา B2B' : classifyOrderItem({ prod: rawPName, type: legacyType, qty: lineQty }, null, null, prodMapObj);

                            if (saleDate < startDate) {
                                map[foundKey].openingBalance -= actualQty;
                            } else if (saleDate >= startDate && saleDate <= endDate) {
                                map[foundKey].periodOut += actualQty;
                                if (isB2B) map[foundKey].b2bQty += actualQty;
                                else if (correctType === 'ราคาเต็ม') map[foundKey].fullQty += actualQty;
                                else if (correctType === 'ราคาสมาชิก') map[foundKey].memberQty += actualQty;
                                else if (correctType === 'ราคาโปร' || correctType === 'โปรโมชั่น') map[foundKey].promoQty += actualQty;
                                else if (correctType === 'ราคาศูนย์') map[foundKey].zeroQty += actualQty;
                                else map[foundKey].memberQty += actualQty;
                            }
                        }
                    }
                });
            }
        });

        const query = String(searchQuery || '').trim().toUpperCase();
        
        // ง. สรุปผล
        return Object.values(map)
            .map(item => {
                const salesTierSum = item.fullQty + item.memberQty + (item.b2bQty || 0) + item.promoQty + item.zeroQty;
                // ในมุมมองสรุปยอดขายแยกตามสินค้า (Tab 1): รวมเบิกขายทั้งหมด = fullQty + memberQty + promoQty + zeroQty
                const displayTotalOut = (salesTierSum > 0 || !isBalanceView) ? salesTierSum : item.periodOut;
                const closingBalance = item.openingBalance + item.receivedInPeriod - item.periodOut;
                return {
                    ...item,
                    currentIn: item.receivedInPeriod,
                    totalOut: displayTotalOut,
                    currentStock: closingBalance
                };
            })
            .filter(item => {
                if (isZeroPromoView && item.promoQty === 0 && item.zeroQty === 0) return false;
                if (query !== '' && !item.id.toUpperCase().includes(query) && !item.name.toUpperCase().includes(query)) return false;
                // ในแท็บสรุปยอดขายแยกตามสินค้า ซ่อนแถวที่ไม่มีทั้งยอดขายและไม่มีความเคลื่อนไหว
                if (!isBalanceView && !isZeroPromoView && item.totalOut === 0 && item.receivedInPeriod === 0) return false;
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
        classifyOrderItem,
        processStockSales,
        unfoldStockSales,
        calculateStockSalesReport,
        filterZeroPromoBills
    };

})(window);
