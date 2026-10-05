/**
 * ============================================================================
 * stockLogic.js - ศูนย์กลางตรรกะการจัดการสต๊อก (Centralized Stock Engine)
 * LOVE STK GROUPE SYSTEM
 * ============================================================================
 * หน้าที่รับผิดชอบ:
 * 1. แกะรายการสินค้าจากบิล (items_json และ Legacy fields) อย่างแม่นยำ
 * 2. แตกสินค้า Bundle (เซ็ตโปรโมชั่น) เป็นสินค้าหลักตาม bundle_qty
 * 3. คำนวณผลต่างสต๊อก (Diff Calculation) เมื่อเปิดบิลใหม่ หรือ แก้ไขบิลเก่า ป้องกันตัดสต๊อกซ้ำซ้อน
 * 4. คืนสต๊อกเมื่อลบหรือยกเลิกบิลอย่างปลอดภัย โดยดึงสต๊อกสดจากฐานข้อมูลเสมอ (No Stale Overwrites)
 * 5. ป้องกันบั๊กสต๊อกหายเป็น 0 เมื่อกดบันทึกแก้ไขสินค้า (Sanitize Product Update)
 * 6. รองรับการรับเข้า (IN) และ เบิกออก (OUT) แบบ Live Sync
 * ============================================================================
 */

(function (window) {
    'use strict';

    /**
     * ตัวช่วยทำความสะอาดข้อความ เพื่อเปรียบเทียบชื่อสินค้า/รหัสสินค้า
     */
    function cleanText(str) {
        return String(str || '')
            .trim()
            .toLowerCase()
            .replace(/\s+/g, ' ');
    }

    /**
     * ดึงข้อความโดยตัดวงเล็บออก เพื่อรองรับชื่อที่มีภาษาลาว/ไทยในวงเล็บ
     */
    function stripBrackets(str) {
        return String(str || '')
            .replace(/\(.*?\)/g, '')
            .replace(/\[.*?\]/g, '')
            .replace(/\{.*?\}/g, '')
            .trim()
            .toLowerCase()
            .replace(/\s+/g, ' ');
    }

    /**
     * ค้นหาสินค้าจาก products list อย่างฉลาด (รองรับทั้ง ID, ชื่อตรง, ชื่อไม่ตรงวรรค, ชื่อตัดวงเล็บ)
     */
    function findProduct(identifierOrName, productsList) {
        if (!identifierOrName || !Array.isArray(productsList) || productsList.length === 0) return null;

        const target = cleanText(identifierOrName);
        const targetStripped = stripBrackets(identifierOrName);

        // 1. ค้นหาจาก ID ตรงๆ (ทั้งตัวพิมพ์เล็ก-ใหญ่)
        let found = productsList.find(p => {
            const pId = cleanText(p.product_id || p.id);
            return pId && pId === target;
        });
        if (found) return found;

        // 2. ค้นหาจากชื่อตรงๆ
        found = productsList.find(p => {
            const pName = cleanText(p.name || p.product_name);
            return pName && pName === target;
        });
        if (found) return found;

        // 3. ค้นหาจากชื่อตัดวงเล็บ
        if (targetStripped) {
            found = productsList.find(p => {
                const pNameStripped = stripBrackets(p.name || p.product_name);
                return pNameStripped && pNameStripped === targetStripped;
            });
            if (found) return found;
        }

        // 4. Fallback ค้นหาแบบบางส่วน (Contains) หากไม่มีการทับซ้อน
        found = productsList.find(p => {
            const pName = cleanText(p.name || p.product_name);
            const pId = cleanText(p.product_id || p.id);
            return (pName && target && (pName.includes(target) || target.includes(pName))) ||
                   (pId && target && pId === target);
        });

        return found || null;
    }

    /**
     * แตกสินค้า (ถ้าเป็น Bundle จะแตกเป็นสินค้าหลัก x bundle_qty)
     * คืนค่าเป็น Array: [{ productId: 'P001', qty: 3 }]
     */
    function resolveProductStockDeduction(product, quantity, productsList) {
        const qty = parseInt(quantity, 10) || 0;
        if (!product || qty <= 0) return [];

        const isBundle = Boolean(
            product.is_bundle || 
            product.isBundle || 
            product.category === 'Promotion' || 
            String(product.category || '').toLowerCase().includes('promotion') ||
            String(product.category || '').includes('โปร') ||
            String(product.product_id || product.id || '').toUpperCase().startsWith('PRO')
        );
        if (!isBundle) {
            const pid = product.product_id || product.id;
            return pid ? [{ productId: pid, qty }] : [];
        }

        // กรณีเป็น Bundle: หา base_product และ bundle_qty
        let targetBase = product.base_product || product.baseProduct;
        let multiplier = parseInt(product.bundle_qty || product.bundleQty, 10) || 0;

        // หากยังไม่ได้ระบุ targetBase หรือ multiplier ให้ดึงจากชื่อสินค้า เช่น "LipoC : 3 กล่อง" หรือ "Lutine : 3 กล่อง"
        if (!targetBase || multiplier <= 0) {
            const colonMatch = String(product.name || '').match(/^(.*?)\s*[:：]\s*(\d+)\s*(?:กล่อง|ชิ้น|ขวด|กระปุก|ชุด|เซ็ต)?/i);
            if (colonMatch) {
                if (!targetBase) targetBase = colonMatch[1].trim();
                if (multiplier <= 0) multiplier = parseInt(colonMatch[2], 10) || 1;
            }
        }
        if (multiplier <= 0) {
            const boxMatch = String(product.name || '').match(/(\d+)\s*(?:กล่อง|ชิ้น|ขวด|กระปุก|ชุด|เซ็ต)/i);
            multiplier = boxMatch ? (parseInt(boxMatch[1], 10) || 1) : 1;
        }

        const totalBaseQty = qty * multiplier;

        const baseProduct = findProduct(targetBase, productsList);
        if (baseProduct) {
            const baseId = baseProduct.product_id || baseProduct.id;
            if (baseId) {
                return [{ productId: baseId, qty: totalBaseQty }];
            }
        }

        // หากหา Base Product ไม่เจอ ให้ fallback เป็นตัว bundle เอง เพื่อไม่ให้สต๊อกหลุดหาย
        const selfId = product.product_id || product.id;
        return selfId ? [{ productId: selfId, qty: totalBaseQty }] : [];
    }

    /**
     * ดึงรายการสินค้าทั้งหมดจากบิล (รองรับทั้ง items_json และ Legacy columns)
     * คืนค่าเป็น Map: { [baseProductId]: totalQuantity }
     */
    function resolveBillItemsToStock(billOrItems, productsList) {
        const stockMap = {};
        if (!billOrItems) return stockMap;

        let rawItems = [];

        if (Array.isArray(billOrItems)) {
            rawItems = billOrItems;
        } else if (typeof billOrItems === 'string') {
            try {
                rawItems = JSON.parse(billOrItems);
            } catch (e) {
                rawItems = [];
            }
        } else if (typeof billOrItems === 'object') {
            // ดึงจาก items_json ในบิล
            if (billOrItems.items_json) {
                try {
                    rawItems = typeof billOrItems.items_json === 'string'
                        ? JSON.parse(billOrItems.items_json)
                        : billOrItems.items_json;
                } catch (e) {
                    rawItems = [];
                }
            }

            // ถ้าไม่มี items_json หรือเป็น Array ว่าง ให้ fallback ไปหาจาก Legacy keys
            if (!Array.isArray(rawItems) || rawItems.length === 0) {
                Object.keys(billOrItems).forEach(key => {
                    if ((key.endsWith('_ราคาเต็ม') || key.endsWith('_ราคาสมาชิก') || key.endsWith('_ราคาโปร') || key.endsWith('_ราคาศูนย์')) &&
                        !key.startsWith('รวมชิ้น') && key !== 'ยอดรวมชิ้นทั้งหมด') {
                        const qty = parseInt(billOrItems[key], 10) || 0;
                        if (qty > 0) {
                            const pName = key.replace(/_ราคาเต็ม$|_ราคาสมาชิก$|_ราคาโปร$|_ราคาศูนย์$/, '');
                            rawItems.push({
                                prod: pName,
                                qty: qty
                            });
                        }
                    }
                });
            }
        }

        if (!Array.isArray(rawItems)) return stockMap;

        // ประมวลผลแต่ละรายการในบิล
        rawItems.forEach(item => {
            if (!item) return;
            const itemQty = parseInt(item.qty || item.quantity || item.amount || 0, 10);
            if (itemQty <= 0) return;

            const identifier = item.productId || item.product_id || item.id || item.prod || item.productName || item.name;
            const product = findProduct(identifier, productsList);

            if (product) {
                const deductions = resolveProductStockDeduction(product, itemQty, productsList);
                deductions.forEach(d => {
                    if (d.productId) {
                        stockMap[d.productId] = (stockMap[d.productId] || 0) + d.qty;
                    }
                });
            } else {
                console.warn('⚠️ StockLogic: ไม่พบข้อมูลสินค้าสำหรับตัดสต๊อก:', identifier);
            }
        });

        return stockMap;
    }

    /**
     * คำนวณผลต่างของสต๊อกระหว่างบิลเก่ากับบิลใหม่
     * diff = newQty - oldQty
     * - diff > 0 : ต้องตัดสต๊อกเพิ่ม
     * - diff < 0 : ต้องคืนสต๊อกกลับ
     * - diff === 0 : ไม่ต้องทำอะไร (แก้ปัญหาตัดสต๊อกซ้ำเมื่อแก้ไขข้อมูลทั่วไปของบิล)
     */
    function calculateStockDiff(oldBill, newBill, productsList) {
        const oldStockMap = oldBill ? resolveBillItemsToStock(oldBill, productsList) : {};
        const newStockMap = newBill ? resolveBillItemsToStock(newBill, productsList) : {};

        const allPids = new Set([...Object.keys(oldStockMap), ...Object.keys(newStockMap)]);
        const diffMap = {};

        allPids.forEach(pid => {
            const oldQty = oldStockMap[pid] || 0;
            const newQty = newStockMap[pid] || 0;
            const diff = newQty - oldQty;
            if (diff !== 0) {
                diffMap[pid] = diff;
            }
        });

        return {
            diffMap,
            oldStockMap,
            newStockMap
        };
    }

    /**
     * ดึงสต๊อกสดล่าสุดจากฐานข้อมูล Supabase สำหรับสินค้ารายการใดรายการหนึ่ง
     */
    async function fetchLiveProductStock(productId) {
        if (!productId || typeof window.supabaseSelect !== 'function') return 0;
        try {
            const res = await window.supabaseSelect('stk_products', `product_id=eq.${encodeURIComponent(productId)}&select=product_id,name,current_stock`);
            if (Array.isArray(res) && res.length > 0) {
                return parseInt(res[0].current_stock, 10) || 0;
            }
        } catch (err) {
            console.warn('⚠️ StockLogic.fetchLiveProductStock failed for ' + productId, err);
        }
        return 0;
    }

    /**
     * ตัดสต๊อกตามล็อตตามหลัก FEFO (First Expire, First Out)
     * ลำดับการตัด:
     * 1. ตัดจากคลังขายหน้าร้าน (preferredWarehouse = 'FRONT_STORE' หรือ 'PHARMA_FRONT') ก่อน โดยเรียงตามวันหมดอายุใกล้สุด (expiry_date asc)
     * 2. หากหน้าร้านไม่พอ ตัดต่อจากคลังใหญ่ (MAIN_WH หรืออื่นๆ)
     * 3. Graceful Fallback: หากสินค้านั้นยังไม่มีข้อมูลใน stk_lots (สต๊อกเดิมที่ยังไม่ผูกล็อต)
     *    ฟังก์ชันจะคืนค่าปกติ ไม่โยน error ทำให้การขายหน้าร้านไม่สะดุด 100%
     */
    async function deductLotsFEFO(productId, qtyToDeduct, preferredWarehouse = 'FRONT_STORE') {
        const result = {
            success: true,
            deductedQty: 0,
            lotAllocations: [],
            hasLots: false
        };

        if (!productId || qtyToDeduct <= 0 || typeof window.supabaseSelect !== 'function') {
            return result;
        }

        try {
            // ดึงล็อตสินค้าที่มีของเหลืออยู่ (remaining_qty > 0) เรียงตามวันหมดอายุใกล้สุด (FEFO)
            const lotsRes = await window.supabaseSelect(
                'stk_lots',
                `product_id=eq.${encodeURIComponent(productId)}&remaining_qty=gt.0&status=neq.DEPLETED&order=expiry_date.asc`
            );

            if (!Array.isArray(lotsRes) || lotsRes.length === 0) {
                // ไม่มีล็อตใน stk_lots สำหรับสินค้านี้ -> ผ่านอย่างปลอดภัยโดยไม่บล็อกการขาย
                return result;
            }

            result.hasLots = true;

            // จัดกลุ่มล็อต: ให้ความสำคัญกับคลัง preferredWarehouse (เช่น FRONT_STORE) ก่อน
            const frontLots = [];
            const otherLots = [];
            lotsRes.forEach(lot => {
                const wh = lot.warehouse_id || 'FRONT_STORE';
                if (wh === preferredWarehouse || wh.includes('FRONT')) {
                    frontLots.push(lot);
                } else {
                    otherLots.push(lot);
                }
            });

            // ลำดับการตัด: ล็อตหน้าร้านตาม FEFO -> ตามด้วยล็อตคลังใหญ่ตาม FEFO
            const sortedLots = [...frontLots, ...otherLots];
            let remainingNeed = qtyToDeduct;

            for (const lot of sortedLots) {
                if (remainingNeed <= 0) break;

                const curRemaining = Number(lot.remaining_qty || 0);
                if (curRemaining <= 0) continue;

                const take = Math.min(curRemaining, remainingNeed);
                const newRemaining = curRemaining - take;
                const newStatus = newRemaining === 0 ? 'DEPLETED' : 'ACTIVE';

                if (typeof window.supabaseUpdate === 'function') {
                    await window.supabaseUpdate('stk_lots', lot.lot_id, {
                        remaining_qty: newRemaining,
                        status: newStatus
                    }, 'lot_id').catch(err => {
                        console.warn(`⚠️ deductLotsFEFO update lot ${lot.lot_id} error:`, err);
                    });
                }

                result.lotAllocations.push({
                    lotId: lot.lot_id,
                    warehouseId: lot.warehouse_id,
                    expiryDate: lot.expiry_date,
                    deducted: take,
                    prevRemaining: curRemaining,
                    newRemaining
                });

                remainingNeed -= take;
                result.deductedQty += take;
            }

            return result;
        } catch (err) {
            console.warn(`⚠️ deductLotsFEFO error for product ${productId}:`, err);
            return result; // ไม่โยน Exception ให้การขายต้องสะดุด
        }
    }

    /**
     * คืนสต๊อกกลับเข้าล็อตสินค้า (เมื่อยกเลิกบิลหรือลดจำนวนในบิล)
     */
    async function returnLotsStock(productId, qtyToReturn, targetWarehouse = 'FRONT_STORE', specificLotId = null) {
        if (!productId || qtyToReturn <= 0 || typeof window.supabaseSelect !== 'function') {
            return { success: true, returnedToLots: false };
        }

        try {
            // 1. ถ้ามีระบุ lot_id เจาะจง ให้บวกคืนล็อตนั้น
            if (specificLotId) {
                const lots = await window.supabaseSelect('stk_lots', `lot_id=eq.${encodeURIComponent(specificLotId)}`);
                if (Array.isArray(lots) && lots.length > 0) {
                    const target = lots[0];
                    const newRem = Number(target.remaining_qty || 0) + qtyToReturn;
                    await window.supabaseUpdate('stk_lots', target.lot_id, {
                        remaining_qty: newRem,
                        status: 'ACTIVE'
                    }, 'lot_id').catch(e => {});
                    return { success: true, returnedToLots: true, lotId: target.lot_id };
                }
            }

            // 2. ถ้าไม่ได้ระบุ lot_id ให้เลือกล็อตที่ยังเปิดใช้งานอยู่ของสินค้านั้นในคลังปลายทาง
            const lotsRes = await window.supabaseSelect(
                'stk_lots',
                `product_id=eq.${encodeURIComponent(productId)}&order=expiry_date.desc&limit=1`
            );

            if (Array.isArray(lotsRes) && lotsRes.length > 0) {
                const targetLot = lotsRes[0];
                const newRem = Number(targetLot.remaining_qty || 0) + qtyToReturn;
                await window.supabaseUpdate('stk_lots', targetLot.lot_id, {
                    remaining_qty: newRem,
                    status: 'ACTIVE'
                }, 'lot_id').catch(e => {});
                return { success: true, returnedToLots: true, lotId: targetLot.lot_id };
            }

            // หากไม่มีข้อมูลใน stk_lots เลย ก็ผ่านได้ราบรื่น
            return { success: true, returnedToLots: false };
        } catch (err) {
            console.warn(`⚠️ returnLotsStock error for product ${productId}:`, err);
            return { success: true, returnedToLots: false };
        }
    }

    /**
     * ปรับปรุงสต๊อกจากการเปิดบิลขาย หรือ แก้ไขบิล
     * params:
     * - oldBill: บิลเดิมก่อนแก้ไข (ถ้าเป็นบิลใหม่ให้ส่ง null/undefined)
     * - newBill: บิลใหม่หรือบิลที่แก้ไขแล้ว (หรือ cart list)
     * - productsList: รายชื่อสินค้าทั้งหมดในระบบ
     * - actor: ผู้ทำรายการ (string)
     * - billId: รหัสบิล (string)
     * - billDate: วันที่ของบิล (string YYYY-MM-DD)
     */
    async function applyBillStockChange({ oldBill, newBill, productsList, actor, billId, billDate, preferredWarehouse, saleType, reasonNote }) {
        if (typeof window.supabaseUpdate !== 'function') {
            console.warn('⚠️ StockLogic: Supabase client unavailable');
            return { success: false, error: 'Supabase unavailable' };
        }

        const { diffMap } = calculateStockDiff(oldBill, newBill, productsList);
        const changedPids = Object.keys(diffMap);

        if (changedPids.length === 0) {
            // ไม่มีการเปลี่ยนแปลงจำนวนสินค้าในบิล ไม่ต้องตัดหรือคืนสต๊อกเลย
            return { success: true, changes: 0, details: [] };
        }

        const dateStr = billDate || (typeof window.getLocalISODate === 'function' ? window.getLocalISODate() : new Date().toISOString().split('T')[0]);
        const userName = actor || 'SYSTEM';
        const isB2B = (saleType === 'B2B') || (billId && billId.startsWith('B2B'));
        const targetWH = preferredWarehouse || (isB2B ? 'MAIN_WH' : 'FRONT_STORE');
        const results = [];

        for (const pid of changedPids) {
            const diff = diffMap[pid]; // diff > 0: ตัดเพิ่ม, diff < 0: คืนสต๊อก
            if (diff === 0) continue;

            // ดึงสต๊อกสดจาก Supabase ก่อนคำนวณเสมอ
            const liveStock = await fetchLiveProductStock(pid);
            const newStock = Math.max(0, liveStock - diff);

            // 1. อัปเดตตาราง stk_products (Live Aggregated Cache)
            try {
                await window.supabaseUpdate('stk_products', pid, { current_stock: newStock }, 'product_id');
            } catch (err) {
                console.error(`❌ StockLogic: อัปเดตสต๊อกสินค้า ${pid} ล้มเหลว:`, err);
            }

            // 1.1 ปรับปรุงตาราง stk_lots ตามหลัก FEFO
            let lotDeductInfo = null;
            if (diff > 0) {
                lotDeductInfo = await deductLotsFEFO(pid, diff, targetWH);
            } else if (diff < 0) {
                await returnLotsStock(pid, Math.abs(diff), targetWH);
            }

            // 2. บันทึกประวัติลง stk_stock_movements
            if (typeof window.supabaseInsert === 'function') {
                const isDeduct = diff > 0;
                const movId = `MOV-${isDeduct ? 'OUT' : 'IN'}-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
                const subType = oldBill
                    ? (isDeduct ? 'แก้ไขบิล (ตัดสต๊อกเพิ่ม)' : 'แก้ไขบิล (คืนสต๊อก)')
                    : (isB2B ? 'ตัดสต๊อกขายส่ง (B2B)' : 'ตัดสต๊อกขาย');

                const allocatedLotIds = (lotDeductInfo && lotDeductInfo.lotAllocations && lotDeductInfo.lotAllocations.length > 0)
                    ? lotDeductInfo.lotAllocations.map(a => a.lotId).join(', ')
                    : (billId || '');

                const whLabel = targetWH === 'MAIN_WH' ? 'คลังใหญ่' : 'หน้าร้าน';
                const movNotes = reasonNote 
                    ? `${reasonNote}${lotDeductInfo && lotDeductInfo.lotAllocations && lotDeductInfo.lotAllocations.length > 0 ? ` [FEFO Lots: ${allocatedLotIds}]` : ''}`
                    : ((oldBill ? 'อัปเดตจากการแก้ไขบิล ' : (isB2B ? `ตัดสต๊อกขายส่ง (B2B) ออกจาก${whLabel} บิล ` : 'ตัดสต๊อกบิล ')) + (billId || '') +
                        (lotDeductInfo && lotDeductInfo.lotAllocations && lotDeductInfo.lotAllocations.length > 0 ? ` [FEFO Lots: ${allocatedLotIds}]` : ''));

                await window.supabaseInsert('stk_stock_movements', {
                    movement_id: movId,
                    date: dateStr,
                    product_id: pid,
                    type: isDeduct ? 'OUT' : 'IN',
                    sub_type: subType,
                    quantity: Math.abs(diff),
                    lot_id: allocatedLotIds,
                    notes: movNotes,
                    created_by: userName,
                    items_json: (lotDeductInfo && lotDeductInfo.lotAllocations && lotDeductInfo.lotAllocations.length > 0)
                        ? JSON.stringify({ bill_id: billId, allocations: lotDeductInfo.lotAllocations })
                        : null
                }).catch(e => console.warn('⚠️ Stock movement log error:', e));
            }

            results.push({
                productId: pid,
                diff,
                prevStock: liveStock,
                newStock,
                lotAllocations: lotDeductInfo ? lotDeductInfo.lotAllocations : []
            });
        }

        return { success: true, changes: results.length, details: results };
    }

    /**
     * คืนสต๊อกเมื่อมีการยกเลิกบิล หรือ ลบบิล (ทั้งใน Sales.html และ Orders.html)
     * params:
     * - bill: บิลที่ต้องการยกเลิก
     * - productsList: รายชื่อสินค้าทั้งหมดในระบบ
     * - actor: ผู้ทำรายการ (string)
     * - billId: รหัสบิล
     * - reason: เหตุผล (เช่น 'ลบบิล', 'ยกเลิกบิล')
     */
    async function returnBillStock({ bill, productsList, actor, billId, reason, preferredWarehouse }) {
        if (!bill) return { success: false, error: 'No bill provided' };
        if (typeof window.supabaseUpdate !== 'function') {
            return { success: false, error: 'Supabase unavailable' };
        }

        const stockMap = resolveBillItemsToStock(bill, productsList);
        const pids = Object.keys(stockMap);

        if (pids.length === 0) {
            return { success: true, returned: 0, details: [] };
        }

        const orderId = billId || bill.order_id || bill.id || '';
        const userName = actor || 'SYSTEM';
        const dateStr = typeof window.getLocalISODate === 'function' ? window.getLocalISODate() : new Date().toISOString().split('T')[0];
        const isB2B = (orderId && orderId.startsWith('B2B')) || (bill && (bill.buyer_type || bill.warehouse_id));
        const targetWH = preferredWarehouse || (bill && bill.warehouse_id) || (isB2B ? 'MAIN_WH' : 'FRONT_STORE');
        const results = [];

        for (const pid of pids) {
            const qtyToReturn = stockMap[pid];
            if (qtyToReturn <= 0) continue;

            // ดึงสต๊อกสดจาก Supabase ก่อนบวกคืนเสมอ (ป้องกัน Stale Overwrite)
            const liveStock = await fetchLiveProductStock(pid);
            const newStock = liveStock + qtyToReturn;

            // 1. อัปเดตตาราง stk_products
            try {
                await window.supabaseUpdate('stk_products', pid, { current_stock: newStock }, 'product_id');
            } catch (err) {
                console.error(`❌ StockLogic: คืนสต๊อกสินค้า ${pid} ล้มเหลว:`, err);
            }

            // 1.1 คืนสต๊อกกลับสู่ stk_lots
            const lotReturnInfo = await returnLotsStock(pid, qtyToReturn, targetWH);

            // 2. บันทึกประวัติลง stk_stock_movements
            if (typeof window.supabaseInsert === 'function') {
                const movId = `MOV-IN-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
                const whLabel = targetWH === 'MAIN_WH' ? 'คลังใหญ่' : 'หน้าร้าน';
                const subType = isB2B ? 'คืนสต๊อกขายส่ง (B2B)' : (reason || 'คืนสต๊อกจากการลบบิล');

                await window.supabaseInsert('stk_stock_movements', {
                    movement_id: movId,
                    date: dateStr,
                    product_id: pid,
                    type: 'IN',
                    sub_type: subType,
                    quantity: qtyToReturn,
                    lot_id: (lotReturnInfo && lotReturnInfo.lotId) ? lotReturnInfo.lotId : orderId,
                    notes: `คืนสต๊อกบิล ${orderId} (${reason || 'ยกเลิกบิล'}) เข้า${whLabel}` + (lotReturnInfo && lotReturnInfo.lotId ? ` [Lot: ${lotReturnInfo.lotId}]` : ''),
                    created_by: userName
                }).catch(e => console.warn('⚠️ Stock return log error:', e));
            }

            results.push({
                productId: pid,
                returnedQty: qtyToReturn,
                prevStock: liveStock,
                newStock
            });
        }

        return { success: true, returned: results.length, details: results };
    }

    /**
     * 🛡️ SANITIZE ข้อมูลสำหรับบันทึกสินค้าใน Stock.html
     * จุดสำคัญที่สุดที่แก้ปัญหา "สต๊อก 6,000-7,000 กลายเป็น 0":
     * - เมื่อแก้ไขสินค้า (isEditing === true) -> ลบฟิลด์ current_stock ออกจากการ Update เสมอ!
     * - เมื่อสร้างสินค้าใหม่ (isEditing === false) -> ถ้าไม่ได้ระบุ ให้เป็น 0
     */
    function sanitizeProductSaveData(supaData, isEditing) {
        const sanitized = { ...supaData };

        if (isEditing) {
            // อนุญาตให้อัปเดต current_stock เมื่อมีการส่งค่ามา (ปรับปรุงสต๊อกในระบบหลังบ้าน)
            if (sanitized.current_stock !== undefined && sanitized.current_stock !== null && sanitized.current_stock !== '') {
                sanitized.current_stock = Math.max(0, parseInt(sanitized.current_stock, 10) || 0);
            } else if (sanitized.stock !== undefined && sanitized.stock !== null && sanitized.stock !== '') {
                sanitized.current_stock = Math.max(0, parseInt(sanitized.stock, 10) || 0);
            }
            delete sanitized.stock;
        } else {
            // กรณีเพิ่มสินค้าใหม่ครั้งแรก
            if (sanitized.current_stock === undefined || sanitized.current_stock === null || isNaN(sanitized.current_stock)) {
                sanitized.current_stock = 0;
            } else {
                sanitized.current_stock = Math.max(0, parseInt(sanitized.current_stock, 10) || 0);
            }
            delete sanitized.stock;
        }

        return sanitized;
    }

    /**
     * ทำรายการรับเข้า (IN) หรือ เบิกออก (OUT) ประจำวันจาก Stock.html
     * มีการดึงสต๊อกสดจาก Supabase ก่อนบวก/ลบเสมอ
     */
    async function applyManualStockMovement({ productId, type, quantity, lotId, notes, actor, date }) {
        if (!productId || !quantity || typeof window.supabaseUpdate !== 'function') {
            return { success: false, error: 'Invalid parameters or Supabase not ready' };
        }

        const qtyNum = parseInt(quantity, 10);
        if (isNaN(qtyNum) || qtyNum <= 0) {
            return { success: false, error: 'Invalid quantity' };
        }

        const isOut = (String(type || '').toUpperCase() === 'OUT');
        const liveStock = await fetchLiveProductStock(productId);
        const newStock = isOut ? Math.max(0, liveStock - qtyNum) : (liveStock + qtyNum);

        // 1. อัปเดตตาราง stk_products
        await window.supabaseUpdate('stk_products', productId, { current_stock: newStock }, 'product_id');

        // 2. บันทึกลง stk_stock_movements
        const dateStr = date || (typeof window.getLocalISODate === 'function' ? window.getLocalISODate() : new Date().toISOString().split('T')[0]);
        const movId = `MOV-${isOut ? 'OUT' : 'IN'}-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

        if (typeof window.supabaseInsert === 'function') {
            await window.supabaseInsert('stk_stock_movements', {
                movement_id: movId,
                date: dateStr,
                product_id: productId,
                type: isOut ? 'OUT' : 'IN',
                sub_type: isOut ? 'เบิกออกสินค้า' : 'รับสินค้า',
                quantity: qtyNum,
                lot_id: lotId || '',
                notes: notes || (isOut ? 'เบิกออกคลัง' : 'นำเข้าคลัง'),
                created_by: actor || 'SYSTEM'
            });
        }

        return {
            success: true,
            productId,
            type: isOut ? 'OUT' : 'IN',
            quantity: qtyNum,
            prevStock: liveStock,
            newStock
        };
    }

    /**
     * ========================================================================
     * MULTI-LOCATION WAREHOUSES & LOT/EXPIRY MANAGEMENT MODULE
     * ========================================================================
     */

    const DOMAINS = {
        SUPPLEMENT: { id: 'SUPPLEMENT', name: 'สินค้าเสริมอาหาร (STK)', defaultWh: 'MAIN_WH', frontWh: 'FRONT_STORE' },
        PHARMACY: { id: 'PHARMACY', name: 'คลังยาหลวง (Pharmacy & Drugs)', defaultWh: 'PHARMA_MAIN', frontWh: 'PHARMA_FRONT' },
        MEDICAL_DEVICE: { id: 'MEDICAL_DEVICE', name: 'คลังอุปกรณ์การแพทย์ (Medical Devices)', defaultWh: 'MED_DEVICE_MAIN', frontWh: 'MED_DEVICE_MAIN' }
    };

    const DEFAULT_WAREHOUSES = [
        { id: 'MAIN_WH', name: 'คลังใหญ่ (Main Warehouse)', domain: 'SUPPLEMENT', role: 'MAIN', location: 'อาคารหลัก ชั้น 2' },
        { id: 'FRONT_STORE', name: 'ห้องขายหน้าร้าน (Front Store)', domain: 'SUPPLEMENT', role: 'FRONT', location: 'อาคารหลัก ชั้น 1 แผนกขาย' },
        { id: 'PHARMA_MAIN', name: 'คลังยาใหญ่ (Pharmacy Storage)', domain: 'PHARMACY', role: 'MAIN', location: 'ห้องควบคุมอุณหภูมิ' },
        { id: 'PHARMA_FRONT', name: 'ห้องจ่ายยาหน้าร้าน (Dispensary)', domain: 'PHARMACY', role: 'FRONT', location: 'เคาน์เตอร์เภสัช' },
        { id: 'MED_DEVICE_MAIN', name: 'คลังอุปกรณ์การแพทย์ (Medical Store)', domain: 'MEDICAL_DEVICE', role: 'MAIN', location: 'สโตร์เครื่องมือแพทย์' }
    ];

    /**
     * บันทึกรับเข้าสินค้าพร้อมเลขล็อตและวันหมดอายุ (Stock In with Lot & Expiry)
     */
    async function saveLotStockIn({ lotId, productId, domainType, warehouseId, mfgDate, expiryDate, qty, costPrice, notes, actor }) {
        const qtyNum = parseInt(qty, 10);
        if (!productId || isNaN(qtyNum) || qtyNum <= 0) {
            return { success: false, error: 'ข้อมูลสินค้าหรือจำนวนไม่ถูกต้อง' };
        }

        const dateStr = typeof window.getLocalISODate === 'function' ? window.getLocalISODate() : new Date().toISOString().split('T')[0];
        const generatedLotId = lotId || `LOT-${productId}-${dateStr.replace(/-/g, '')}-${Math.floor(Math.random() * 1000)}`;
        const whId = warehouseId || 'MAIN_WH';
        const dType = domainType || 'SUPPLEMENT';

        // 1. บันทึกลงตาราง stk_lots (ถ้ามี)
        const lotPayload = {
            lot_id: generatedLotId,
            product_id: productId,
            domain_type: dType,
            warehouse_id: whId,
            mfg_date: mfgDate || null,
            expiry_date: expiryDate || dateStr,
            initial_qty: qtyNum,
            remaining_qty: qtyNum,
            cost_price: Number(costPrice || 0),
            notes: notes || '',
            status: 'ACTIVE'
        };

        if (typeof window.supabaseInsert === 'function') {
            await window.supabaseInsert('stk_lots', lotPayload).catch(e => {
                console.warn('stk_lots insert fallback:', e);
            });
        }

        // 2. บันทึก Movement ลง stk_stock_movements
        const movId = `MOV-IN-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
        const movPayload = {
            movement_id: movId,
            date: dateStr,
            product_id: productId,
            type: 'IN',
            sub_type: 'รับเข้าคลังใหญ่',
            quantity: qtyNum,
            lot_id: generatedLotId,
            notes: notes ? `ล็อต ${generatedLotId} (หมดอายุ ${expiryDate || '-'}) - ${notes}` : `ล็อต ${generatedLotId} (หมดอายุ ${expiryDate || '-'})`,
            created_by: actor || 'SYSTEM',
            items_json: JSON.stringify({
                expiry_date: expiryDate,
                mfg_date: mfgDate,
                warehouse_id: whId,
                domain_type: dType,
                cost_price: Number(costPrice || 0)
            })
        };

        if (typeof window.supabaseInsert === 'function') {
            await window.supabaseInsert('stk_stock_movements', movPayload).catch(e => console.warn('mov insert:', e));
        }

        // 3. ปรับปรุง current_stock รวมในตาราง stk_products
        if (dType === 'SUPPLEMENT') {
            const liveStock = await fetchLiveProductStock(productId);
            const newStock = liveStock + qtyNum;
            if (typeof window.supabaseUpdate === 'function') {
                await window.supabaseUpdate('stk_products', productId, { current_stock: newStock }, 'product_id').catch(e => {});
            }
        }

        return { success: true, lotId: generatedLotId, quantity: qtyNum };
    }

    /**
     * บันทึกรับสินค้าเข้าคลังแบบหลายรายการในใบรับเดียว (Batch Goods Received Note - GRN)
     */
    async function saveMultiLotStockIn({ grnId, date, warehouseId, domainType, supplier, notes, actor, items }) {
        if (!Array.isArray(items) || items.length === 0) {
            return { success: false, error: 'ไม่มีรายการสินค้าที่ต้องการรับเข้า' };
        }

        const dateStr = date || (typeof window.getLocalISODate === 'function' ? window.getLocalISODate() : new Date().toISOString().split('T')[0]);
        const finalGrnId = grnId || `GRN-${dateStr.replace(/-/g, '')}-${Math.floor(Math.random() * 1000).toString().padStart(3, '0')}`;
        const whId = warehouseId || 'MAIN_WH';
        const dType = domainType || 'SUPPLEMENT';
        const userName = actor || 'SYSTEM';

        const savedItems = [];
        let totalQty = 0;
        let totalValue = 0;

        for (const it of items) {
            const pid = it.productId || it.product_id;
            const q = parseInt(it.qty || it.quantity, 10);
            if (!pid || isNaN(q) || q <= 0) continue;

            const itemLotId = it.lotId || `LOT-${pid}-${dateStr.replace(/-/g, '')}-${Math.floor(Math.random() * 1000)}`;
            const cost = Number(it.costPrice || it.cost_price || 0);
            const expDate = it.expiryDate || it.expiry_date || dateStr;
            const mfgDate = it.mfgDate || it.mfg_date || null;

            // 1. บันทึกลง stk_lots
            const lotPayload = {
                lot_id: itemLotId,
                product_id: pid,
                domain_type: dType,
                warehouse_id: whId,
                mfg_date: mfgDate,
                expiry_date: expDate,
                initial_qty: q,
                remaining_qty: q,
                cost_price: cost,
                notes: notes ? `${notes} (ใบรับ ${finalGrnId})` : `ใบรับ ${finalGrnId}`,
                status: 'ACTIVE'
            };

            if (typeof window.supabaseInsert === 'function') {
                await window.supabaseInsert('stk_lots', lotPayload).catch(e => console.warn('stk_lots insert fallback:', e));
            }

            // 2. บันทึก Movement ลง stk_stock_movements
            const movId = `MOV-IN-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
            const movPayload = {
                movement_id: movId,
                date: dateStr,
                product_id: pid,
                type: 'IN',
                sub_type: 'รับเข้าคลังสินค้า',
                quantity: q,
                lot_id: itemLotId,
                notes: `ใบรับสินค้า ${finalGrnId}${supplier ? ' จาก ' + supplier : ''} (ล็อต ${itemLotId})`,
                created_by: userName,
                items_json: JSON.stringify({
                    grn_id: finalGrnId,
                    supplier: supplier || '',
                    expiry_date: expDate,
                    mfg_date: mfgDate,
                    warehouse_id: whId,
                    domain_type: dType,
                    cost_price: cost
                })
            };

            if (typeof window.supabaseInsert === 'function') {
                await window.supabaseInsert('stk_stock_movements', movPayload).catch(e => console.warn('mov insert:', e));
            }

            // 3. ปรับปรุง current_stock รวมในตาราง stk_products
            if (dType === 'SUPPLEMENT') {
                const liveStock = await fetchLiveProductStock(pid);
                const newStock = liveStock + q;
                if (typeof window.supabaseUpdate === 'function') {
                    await window.supabaseUpdate('stk_products', pid, { current_stock: newStock }, 'product_id').catch(e => {});
                }
            }

            savedItems.push({
                ...it,
                productId: pid,
                productName: it.productName || it.name || pid,
                lotId: itemLotId,
                mfgDate,
                expiryDate: expDate,
                qty: q,
                costPrice: cost,
                subtotal: q * cost
            });
            totalQty += q;
            totalValue += (q * cost);
        }

        if (savedItems.length === 0) {
            return { success: false, error: 'ไม่มีรายการสินค้าที่ถูกต้องให้บันทึก' };
        }

        // 4. บันทึก Master Document ลง stk_warehouse_transfers (from_warehouse = supplier || 'SUPPLIER')
        const grnRecord = {
            transfer_id: finalGrnId,
            transfer_date: dateStr,
            from_warehouse: supplier || 'SUPPLIER',
            to_warehouse: whId,
            domain_type: dType,
            items_json: savedItems,
            total_items: totalQty,
            status: 'COMPLETED',
            requested_by: supplier || 'SUPPLIER',
            received_by: userName,
            notes: notes || `ใบรับสินค้าเข้าคลัง (GRN) รวม ${savedItems.length} รายการ`
        };

        if (typeof window.supabaseInsert === 'function') {
            await window.supabaseInsert('stk_warehouse_transfers', grnRecord).catch(e => {
                console.warn('GRN master insert fallback:', e);
            });
        }

        // 5. บันทึกลง localStorage เพื่อให้ประวัติโหลดได้เร็วทันใจแบบ Offline/Online Cache
        try {
            const cachedGRNs = JSON.parse(localStorage.getItem('stk_grn_history') || '[]');
            const updatedGRNs = [grnRecord, ...cachedGRNs.filter(g => g.transfer_id !== finalGrnId)].slice(0, 200);
            localStorage.setItem('stk_grn_history', JSON.stringify(updatedGRNs));
        } catch(e) {}

        return {
            success: true,
            grnId: finalGrnId,
            grnRecord,
            totalItems: savedItems.length,
            totalQty,
            totalValue
        };
    }

    /**
     * ดึงประวัติใบรับสินค้าเข้าคลัง (Goods Received Notes History)
     */
    async function fetchGrnHistory(domainType) {
        let list = [];
        // 1. ดึงจาก Supabase
        if (typeof window.supabaseSelect === 'function') {
            try {
                let query = `transfer_id=ilike.GRN*%26order=created_at.desc&limit=100`;
                if (domainType) query = `domain_type=eq.${encodeURIComponent(domainType)}&` + query;
                const res = await window.supabaseSelect('stk_warehouse_transfers', query);
                if (Array.isArray(res)) list = res;
            } catch(e) {
                console.warn('fetchGrnHistory Supabase fallback:', e);
            }
        }

        // 2. ผสานกับ localStorage
        try {
            const local = JSON.parse(localStorage.getItem('stk_grn_history') || '[]');
            if (Array.isArray(local) && local.length > 0) {
                const map = {};
                list.forEach(item => { if (item.transfer_id) map[item.transfer_id] = item; });
                local.forEach(item => {
                    if (item.transfer_id && !map[item.transfer_id]) {
                        if (!domainType || item.domain_type === domainType) {
                            list.push(item);
                        }
                    }
                });
            }
        } catch(e) {}

        return list.sort((a, b) => (b.transfer_date || '').localeCompare(a.transfer_date || ''));
    }

    /**
     * ดึงประวัติล็อตสินค้าและคำนวณสถานะวันหมดอายุ (FEFO: First Expire First Out)
     */
    async function fetchLotsWithExpiry(productId, domainType) {
        let lots = [];
        if (typeof window.supabaseSelect === 'function') {
            let query = `order=expiry_date.asc&limit=500`;
            if (productId) query = `product_id=eq.${encodeURIComponent(productId)}&` + query;
            if (domainType) query = `domain_type=eq.${encodeURIComponent(domainType)}&` + query;

            try {
                const res = await window.supabaseSelect('stk_lots', query);
                if (Array.isArray(res) && res.length > 0) {
                    lots = res;
                }
            } catch (e) {
                console.warn('fetch stk_lots error, falling back to movements:', e);
            }
        }

        // Fallback: หากยังไม่ได้สร้างตาราง stk_lots ให้ดึงจาก stk_stock_movements
        if (lots.length === 0 && typeof window.supabaseSelect === 'function') {
            try {
                let mQuery = `type=eq.IN&order=created_at.desc&limit=300`;
                if (productId) mQuery = `product_id=eq.${encodeURIComponent(productId)}&` + mQuery;
                const mRes = await window.supabaseSelect('stk_stock_movements', mQuery);
                if (Array.isArray(mRes)) {
                    // กรองไม่เอา movement ของสินค้าเซ็ตโปรโมชั่น (เช่น PRO...) มาสร้างเป็นล็อตคลังกายภาพ
                    const validMovements = mRes.filter(m => {
                        const pid = String(m.product_id || '').toUpperCase();
                        return !pid.startsWith('PRO');
                    });
                    lots = validMovements.map(m => {
                        let parsed = {};
                        if (m.items_json) {
                            try { parsed = typeof m.items_json === 'string' ? JSON.parse(m.items_json) : m.items_json; } catch(err) {}
                        }
                        const whId = parsed.warehouse_id || parsed.to || (m.sub_type && m.sub_type.includes('รับโอน') ? 'FRONT_STORE' : 'MAIN_WH');
                        return {
                            lot_id: m.lot_id || m.movement_id,
                            product_id: m.product_id,
                            domain_type: parsed.domain_type || 'SUPPLEMENT',
                            warehouse_id: whId,
                            mfg_date: parsed.mfg_date || null,
                            expiry_date: parsed.expiry_date || m.date,
                            initial_qty: Number(m.quantity || 0),
                            remaining_qty: Number(m.quantity || 0),
                            status: 'ACTIVE'
                        };
                    });
                }
            } catch(e){}
        }

        const now = new Date();
        const todayStr = now.toISOString().split('T')[0];

        // คำนวณวันคงเหลือก่อนหมดอายุ และระดับความเร่งด่วน
        return lots.map(lot => {
            const rawExp = lot.expiry_date || todayStr;
            const cleanExp = rawExp ? String(rawExp).split('T')[0] : todayStr;
            const expDate = new Date(cleanExp);
            const diffTime = expDate - now;
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

            let expiryStatus = 'NORMAL'; // ปกติ
            let badgeColor = 'emerald';
            let statusText = 'ปกติ';

            if (diffDays <= 0) {
                expiryStatus = 'EXPIRED';
                badgeColor = 'rose';
                statusText = 'หมดอายุแล้ว';
            } else if (diffDays <= 30) {
                expiryStatus = 'CRITICAL';
                badgeColor = 'amber';
                statusText = `ใกล้หมดอายุ (${diffDays} วัน)`;
            } else if (diffDays <= 90) {
                expiryStatus = 'WARNING';
                badgeColor = 'blue';
                statusText = `เหลืออีก ${diffDays} วัน`;
            } else {
                statusText = `เหลืออีก ${diffDays} วัน`;
            }

            return {
                ...lot,
                expiry_date: cleanExp,
                remainingDays: diffDays,
                daysRemaining: diffDays,
                expiryStatus,
                badgeColor,
                statusText,
                statusTag: expiryStatus
            };
        }).sort((a, b) => (a.expiry_date || '').localeCompare(b.expiry_date || ''));
    }

    /**
     * ดำเนินการเบิกย้ายสินค้า (Internal Transfer: คลังใหญ่ ➔ ห้องขายหน้าร้าน)
     */
    async function transferStockBetweenWarehouses({ transferId, fromWarehouse, toWarehouse, domainType, items, productId, lotId, qty, requestedBy, actor, notes, date }) {
        let transferItems = Array.isArray(items) ? [...items] : [];
        if (transferItems.length === 0 && productId && Number(qty) > 0) {
            transferItems = [{ productId, lotId: lotId || '', qty: Number(qty) }];
        }
        if (transferItems.length === 0) {
            return { success: false, error: 'ไม่มีรายการสินค้าที่ต้องการเบิกย้าย' };
        }

        const dateStr = date || (typeof window.getLocalISODate === 'function' ? window.getLocalISODate() : new Date().toISOString().split('T')[0]);
        const finalTransferId = transferId || `TRF-${dateStr.replace(/-/g, '').slice(2)}-${Math.floor(100 + Math.random() * 900)}`;
        const userName = actor || requestedBy || 'SYSTEM';

        // 1. บันทึก Transfer Master
        const transferRecord = {
            transfer_id: finalTransferId,
            transfer_date: dateStr,
            from_warehouse: fromWarehouse || 'MAIN_WH',
            to_warehouse: toWarehouse || 'FRONT_STORE',
            domain_type: domainType || 'SUPPLEMENT',
            items_json: transferItems,
            total_items: transferItems.reduce((sum, it) => sum + (Number(it.qty || it.quantity) || 0), 0),
            requested_by: userName,
            received_by: userName,
            notes: notes || 'เบิกสินค้าจากคลังใหญ่ไปห้องขายหน้าร้าน',
            status: 'COMPLETED'
        };

        if (typeof window.supabaseInsert === 'function') {
            await window.supabaseInsert('stk_warehouse_transfers', transferRecord).catch(e => {
                console.warn('stk_warehouse_transfers insert fallback:', e);
            });
        }

        // Cache in localStorage for offline availability & instant history
        try {
            const cached = JSON.parse(localStorage.getItem('stk_transfer_history') || '[]');
            const filtered = cached.filter(c => c.transfer_id !== finalTransferId);
            filtered.unshift(transferRecord);
            localStorage.setItem('stk_transfer_history', JSON.stringify(filtered.slice(0, 150)));
        } catch(e) {}

        // 2. บันทึก Movement ให้ครบทั้งสองฝั่ง (OUT จากคลังใหญ่ และ IN สู่ห้องขาย)
        for (const item of transferItems) {
            const pId = item.productId || item.product_id || item.id;
            const qtyNum = Number(item.qty || item.quantity || 0);
            if (!pId || qtyNum <= 0) continue;

            const outMovId = `MOV-TRF-OUT-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
            const inMovId = `MOV-TRF-IN-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

            if (typeof window.supabaseInsert === 'function') {
                // ฝั่งคลังใหญ่: เบิกออก (Transfer Out)
                await window.supabaseInsert('stk_stock_movements', {
                    movement_id: outMovId,
                    date: dateStr,
                    product_id: pId,
                    type: 'OUT',
                    sub_type: 'เบิกย้ายไปห้องขาย',
                    quantity: qtyNum,
                    lot_id: item.lotId || finalTransferId,
                    notes: `เบิกย้ายไป ${toWarehouse || 'FRONT_STORE'} (ใบเบิก ${finalTransferId})`,
                    created_by: userName,
                    items_json: JSON.stringify({ transfer_id: finalTransferId, from: fromWarehouse, to: toWarehouse, warehouse_id: fromWarehouse || 'MAIN_WH' })
                }).catch(e => console.warn('TRF OUT log:', e));

                // ฝั่งห้องขาย: รับเข้า (Transfer In)
                await window.supabaseInsert('stk_stock_movements', {
                    movement_id: inMovId,
                    date: dateStr,
                    product_id: pId,
                    type: 'IN',
                    sub_type: 'รับโอนจากคลังใหญ่',
                    quantity: qtyNum,
                    lot_id: item.lotId || finalTransferId,
                    notes: `รับโอนจาก ${fromWarehouse || 'MAIN_WH'} (ใบเบิก ${finalTransferId})`,
                    created_by: userName,
                    items_json: JSON.stringify({ transfer_id: finalTransferId, from: fromWarehouse, to: toWarehouse, warehouse_id: toWarehouse || 'FRONT_STORE' })
                }).catch(e => console.warn('TRF IN log:', e));
            }

            // 3. ปรับปรุงฐานข้อมูล stk_lots ให้ตรงกับคลังปลายทาง
            if (typeof window.supabaseSelect === 'function' && typeof window.supabaseUpdate === 'function') {
                try {
                    if (item.lotId && item.lotId !== 'FEFO Auto-Assign') {
                        const targetLots = await window.supabaseSelect('stk_lots', `lot_id=eq.${encodeURIComponent(item.lotId)}`);
                        if (Array.isArray(targetLots) && targetLots.length > 0) {
                            const curLot = targetLots[0];
                            const curRem = Number(curLot.remaining_qty || 0);
                            if (curRem <= qtyNum) {
                                await window.supabaseUpdate('stk_lots', item.lotId, { warehouse_id: toWarehouse || 'FRONT_STORE' }, 'lot_id');
                            } else {
                                await window.supabaseUpdate('stk_lots', item.lotId, { remaining_qty: curRem - qtyNum }, 'lot_id');
                                if (typeof window.supabaseInsert === 'function') {
                                    await window.supabaseInsert('stk_lots', {
                                        lot_id: `${item.lotId}-${toWarehouse || 'FRONT'}`,
                                        product_id: pId,
                                        domain_type: domainType || 'SUPPLEMENT',
                                        warehouse_id: toWarehouse || 'FRONT_STORE',
                                        mfg_date: curLot.mfg_date,
                                        expiry_date: curLot.expiry_date,
                                        initial_qty: qtyNum,
                                        remaining_qty: qtyNum,
                                        cost_price: curLot.cost_price,
                                        notes: `รับโอนจาก ${fromWarehouse || 'MAIN_WH'}`,
                                        status: 'ACTIVE'
                                    });
                                }
                            }
                        }
                    } else {
                        // กรณีไม่ได้เลือกล็อตเจาะจง หรือเลือก FEFO Auto-Assign -> ค้นหาล็อตต้นทางตาม FEFO
                        const sourceLots = await window.supabaseSelect(
                            'stk_lots',
                            `product_id=eq.${encodeURIComponent(pId)}&warehouse_id=eq.${encodeURIComponent(fromWarehouse || 'MAIN_WH')}&remaining_qty=gt.0&order=expiry_date.asc`
                        );
                        if (Array.isArray(sourceLots) && sourceLots.length > 0) {
                            let trfNeed = qtyNum;
                            for (const sLot of sourceLots) {
                                if (trfNeed <= 0) break;
                                const sRem = Number(sLot.remaining_qty || 0);
                                if (sRem <= 0) continue;
                                const take = Math.min(sRem, trfNeed);
                                const newRem = sRem - take;
                                await window.supabaseUpdate('stk_lots', sLot.lot_id, {
                                    remaining_qty: newRem,
                                    status: newRem === 0 ? 'DEPLETED' : 'ACTIVE'
                                }, 'lot_id');

                                if (typeof window.supabaseInsert === 'function') {
                                    await window.supabaseInsert('stk_lots', {
                                        lot_id: `${sLot.lot_id}-${toWarehouse || 'FRONT'}-${Date.now()}`,
                                        product_id: pId,
                                        domain_type: domainType || 'SUPPLEMENT',
                                        warehouse_id: toWarehouse || 'FRONT_STORE',
                                        mfg_date: sLot.mfg_date,
                                        expiry_date: sLot.expiry_date,
                                        initial_qty: take,
                                        remaining_qty: take,
                                        cost_price: sLot.cost_price,
                                        notes: `รับโอนจาก ${fromWarehouse || 'MAIN_WH'} (ล็อตเดิม ${sLot.lot_id})`,
                                        status: 'ACTIVE'
                                    }).catch(e => {});
                                }
                                trfNeed -= take;
                            }
                        }
                    }
                } catch(e) {
                    console.warn('Sync transfer to stk_lots error:', e);
                }
            }
        }

        return { success: true, transferId: finalTransferId, transferRecord };
    }

    /**
     * ดึงประวัติการเบิกย้ายสินค้าระหว่างคลัง (Fetch Transfer History)
     */
    async function fetchTransferHistory(domainType) {
        let history = [];
        if (typeof window.supabaseSelect === 'function') {
            try {
                const res = await window.supabaseSelect('stk_warehouse_transfers', 'order=created_at.desc&limit=150');
                if (Array.isArray(res)) {
                    history = res.filter(r => {
                        const tid = String(r.transfer_id || '');
                        const fromWh = String(r.from_warehouse || '');
                        return !tid.startsWith('GRN') && fromWh !== 'SUPPLIER';
                    });
                }
            } catch(e) {
                console.warn('fetchTransferHistory supabase fallback:', e);
            }
        }

        // รวมกับ Cache ใน localStorage
        try {
            const cached = JSON.parse(localStorage.getItem('stk_transfer_history') || '[]');
            if (Array.isArray(cached) && cached.length > 0) {
                const map = {};
                history.forEach(h => { if (h.transfer_id) map[h.transfer_id] = h; });
                cached.forEach(c => {
                    const tid = String(c.transfer_id || '');
                    const fromWh = String(c.from_warehouse || '');
                    if (!tid.startsWith('GRN') && fromWh !== 'SUPPLIER' && !map[c.transfer_id]) {
                        history.push(c);
                        map[c.transfer_id] = c;
                    }
                });
            }
        } catch(e) {}

        history.sort((a, b) => {
            const dA = a.transfer_date || a.created_at || '';
            const dB = b.transfer_date || b.created_at || '';
            return dB.localeCompare(dA);
        });

        return history;
    }

    /**
     * คำนวณสมุดบัญชีสต๊อกย้อนหลัง และ กระทบยอดประจำวัน (Daily Stock Balance & Historical Ledger)
     */
    function calculateDailyBalanceLedger({ targetDate, warehouseId, products, movements, sales, transfers }) {
        const dateStr = targetDate || (typeof window.getLocalISODate === 'function' ? window.getLocalISODate() : new Date().toISOString().split('T')[0]);
        const whId = warehouseId || 'FRONT_STORE';
        const isFrontStore = (whId === 'FRONT_STORE' || whId === 'PHARMA_FRONT');

        const ledgerMap = {};

        // 1. ตั้งต้นสินค้าทั้งหมด
        (products || []).forEach(p => {
            const pId = p.product_id || p.id;
            const pName = p.name || p.product_name || pId;
            if (!pId) return;

            ledgerMap[pId] = {
                productId: pId,
                name: pName,
                category: p.category || '-',
                openingQty: 0,      // ยอดยกมาต้นวัน
                receivedQty: 0,     // รับเข้าในวัน (จากโรงงาน หรือ รับโอนจากคลังใหญ่)
                transferOutQty: 0,  // เบิกย้ายออกในวัน
                salesQty: 0,        // ขายออกตามบิลในวัน
                closingQty: 0,      // ยอดคงเหลือสิ้นวันตามระบบ
                physicalCount: null,// ยอดตรวจนับจริง
                diffQty: 0,         // ส่วนต่าง (ขาด/เกิน)
                auditStatus: 'PENDING'
            };
        });

        // 2. ประมวลผล Movements เพื่อหายอดยกมา (ก่อนวัน targetDate) และยอดในวัน (ณ วัน targetDate)
        (movements || []).forEach(m => {
            const pId = m.product_id || m.productId;
            if (!pId || !ledgerMap[pId]) return;

            const mDate = (m.date || m.created_at || '').substring(0, 10);
            const mQty = Number(m.quantity || 0);
            const subType = String(m.sub_type || '');
            const mType = String(m.type || '').toUpperCase();

            // แยกตามประเภทคลัง
            if (isFrontStore) {
                // คลังหน้าร้าน: รับเข้า = รับโอนจากคลังใหญ่, ออก = ตัดขาย / ส่งคืนคลังใหญ่
                const isFrontIn = (subType.includes('รับโอน') || subType.includes('คืนสต๊อก') || (mType === 'IN' && !subType.includes('รับเข้าคลังใหญ่')));
                const isFrontOut = (subType.includes('ขาย') || (mType === 'OUT' && subType.includes('ห้องขาย')));

                if (mDate < dateStr) {
                    if (isFrontIn) ledgerMap[pId].openingQty += mQty;
                    if (isFrontOut) ledgerMap[pId].openingQty -= mQty;
                } else if (mDate === dateStr) {
                    if (isFrontIn) ledgerMap[pId].receivedQty += mQty;
                    if (isFrontOut && !subType.includes('ขาย')) ledgerMap[pId].transferOutQty += mQty;
                }
            } else {
                // คลังใหญ่: รับเข้า = รับจากโรงงาน, ออก = เบิกไปหน้าร้าน
                const isMainIn = (subType.includes('รับเข้าคลัง') || subType.includes('รับสินค้า') || mType === 'IN');
                const isMainOut = (subType.includes('เบิกย้าย') || subType.includes('เบิกออก') || mType === 'OUT');

                if (mDate < dateStr) {
                    if (isMainIn) ledgerMap[pId].openingQty += mQty;
                    if (isMainOut) ledgerMap[pId].openingQty -= mQty;
                } else if (mDate === dateStr) {
                    if (isMainIn) ledgerMap[pId].receivedQty += mQty;
                    if (isMainOut) ledgerMap[pId].transferOutQty += mQty;
                }
            }
        });

        // 3. รวมยอดขายออกในวัน (เฉพาะคลังหน้าร้าน)
        if (isFrontStore && Array.isArray(sales)) {
            sales.forEach(sale => {
                const sDate = (sale.date || sale.created_at || '').substring(0, 10);
                if (sDate === dateStr) {
                    const billItemsMap = resolveBillItemsToStock(sale, products);
                    Object.keys(billItemsMap).forEach(pid => {
                        if (ledgerMap[pid]) {
                            ledgerMap[pid].salesQty += billItemsMap[pid];
                        }
                    });
                }
            });
        }

        // 4. สรุปยอดคงเหลือสิ้นวันตามระบบ (Closing Qty)
        Object.keys(ledgerMap).forEach(pid => {
            const item = ledgerMap[pid];
            item.closingQty = Math.max(0, item.openingQty + item.receivedQty - item.transferOutQty - item.salesQty);
        });

        return {
            targetDate: dateStr,
            warehouseId: whId,
            ledger: Object.values(ledgerMap)
        };
    }

    /**
     * บันทึกการตรวจนับกระทบยอดสต๊อกประจำวัน (Save Daily Physical Count & Audit)
     */
    async function saveDailyAuditRecords({ balanceDate, warehouseId, domainType, auditRecords, auditor, notes }) {
        if (!Array.isArray(auditRecords) || auditRecords.length === 0) {
            return { success: false, error: 'ไม่มีข้อมูลตรวจนับ' };
        }

        const dateStr = balanceDate || (typeof window.getLocalISODate === 'function' ? window.getLocalISODate() : new Date().toISOString().split('T')[0]);
        const whId = warehouseId || 'FRONT_STORE';
        const dType = domainType || 'SUPPLEMENT';
        const auditorName = auditor || 'SYSTEM';

        const insertPayloads = auditRecords.map(rec => ({
            id: `BAL-${whId}-${dateStr}-${rec.productId}`,
            balance_date: dateStr,
            warehouse_id: whId,
            product_id: rec.productId,
            domain_type: dType,
            opening_qty: rec.openingQty || 0,
            transfer_in_qty: rec.receivedQty || 0,
            transfer_out_qty: rec.transferOutQty || 0,
            sales_qty: rec.salesQty || 0,
            system_closing_qty: rec.closingQty || 0,
            physical_count_qty: rec.physicalCount !== null ? Number(rec.physicalCount) : null,
            diff_qty: rec.physicalCount !== null ? (Number(rec.physicalCount) - Number(rec.closingQty)) : 0,
            audited_by: auditorName,
            audit_status: rec.physicalCount !== null ? (Number(rec.physicalCount) === Number(rec.closingQty) ? 'BALANCED' : 'DISCREPANCY') : 'PENDING',
            audit_notes: notes || ''
        }));

        if (typeof window.supabaseUpsert === 'function') {
            try {
                await window.supabaseUpsert('stk_daily_balance', insertPayloads);
            } catch (err) {
                console.error('stk_daily_balance upsert error:', err);
                return { success: false, error: 'บันทึกฐานข้อมูลไม่สำเร็จ: ' + (err.message || String(err)) };
            }
        } else {
            return { success: false, error: 'ไม่พบฟังก์ชัน supabaseUpsert สำหรับบันทึกข้อมูล' };
        }

        if (typeof window.invalidateTableCache === 'function') {
            window.invalidateTableCache('stk_daily_balance');
        }

        return { success: true, count: insertPayloads.length };
    }

    // Export สู่ window
    window.StockLogic = {
        DOMAINS,
        DEFAULT_WAREHOUSES,
        cleanText,
        stripBrackets,
        findProduct,
        resolveProductStockDeduction,
        resolveBillItemsToStock,
        calculateStockDiff,
        fetchLiveProductStock,
        applyBillStockChange,
        returnBillStock,
        sanitizeProductSaveData,
        applyManualStockMovement,
        // New Multi-Warehouse & Lot / Audit Extensions
        deductLotsFEFO,
        returnLotsStock,
        saveLotStockIn,
        saveMultiLotStockIn,
        fetchGrnHistory,
        fetchLotsWithExpiry,
        transferStockBetweenWarehouses,
        fetchTransferHistory,
        calculateDailyBalanceLedger,
        saveDailyAuditRecords
    };

})(typeof window !== 'undefined' ? window : this);
