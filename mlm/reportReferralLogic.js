/**
 * ================================================================
 * 🎁 reportReferralLogic.js - สมองกลประมวลผลและการคำนวณค่าแนะนำ & ปันผล
 * LOVE STK GROUPE - Referral & Dividends Calculation Engine
 * ================================================================
 */

(function (window) {
    'use strict';

    const safeUpper = (str) => String(str || '').trim().toUpperCase();

    /**
     * 1. แปลงชื่อทีมให้เป็นมาตรฐาน
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
     * คลี่รายการขาย (Sales Unfolding) ตามช่วงวันที่และสิทธิ์
     */
    function unfoldSales({
        sales = [],
        members = [],
        customers = [],
        startDate = '',
        endDate = '',
        permittedMemberSet = null,
        businessTeams = []
    }) {
        let items = [];
        const dateFilteredSales = (sales || []).filter(s => {
            const sDate = s.date || s.sale_date || '';
            if (!s || sDate < startDate || sDate > endDate) return false;
            const sMemId = safeUpper(s.memberId || s.member_id || s.sellerId || s.seller_id || s.seller || s.marketing);
            if (permittedMemberSet !== null) return permittedMemberSet.has(sMemId);
            return true;
        });

        // ⚡ O(1) Pre-indexing maps for high-performance unfolding
        const memberMap = new Map();
        (members || []).forEach(m => {
            if (m && m.id) memberMap.set(safeUpper(m.id), m);
        });

        const customerMap = new Map();
        (customers || []).forEach(c => {
            if (c) {
                if (c.id) customerMap.set(String(c.id).trim(), c);
                if (c.customer_id) customerMap.set(String(c.customer_id).trim(), c);
                if (c.hn) customerMap.set(String(c.hn).trim().toUpperCase(), c);
            }
        });

        const teamCache = new Map();
        const getTeamName = (rawTeam) => {
            if (!rawTeam) return 'N/A';
            const k = safeUpper(rawTeam);
            if (teamCache.has(k)) return teamCache.get(k);
            const resolved = resolveTeamName(rawTeam, businessTeams);
            teamCache.set(k, resolved);
            return resolved;
        };

        dateFilteredSales.forEach(record => {
            const recMemberId = safeUpper(record.memberId || record.member_id || record.sellerId || record.seller_id || record.seller || record.marketing);
            const member = memberMap.get(recMemberId);
            const rawCustId = String(record.customerId || record.customer_id || '').trim();
            const cust = customerMap.get(rawCustId) || customerMap.get(rawCustId.toUpperCase());
            const cleanTeam = getTeamName(member?.team);
            const resolvedCustType = record.customerType || record.custType || record.customer_type || (cust ? cust.type : '') || 'ไม่ระบุประเภท';

            let rawItems = [];
            if (record.items_json) {
                try { rawItems = typeof record.items_json === 'string' ? JSON.parse(record.items_json) : record.items_json; } catch (e) {}
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
                            memberName: member?.name || recMemberId || 'UNKNOWN',
                            team: cleanTeam,
                            custType: resolvedCustType,
                            product: String(it.prod || it.productName || it.name || 'สินค้าอื่นๆ').trim(),
                            priceType: String(it.type || 'ราคาเต็ม').trim(),
                            qty: q
                        });
                    }
                });
            } else {
                const f = Number(record['รวมชิ้นราคาเต็ม'] || 0);
                const m = Number(record['รวมชิ้นราคาสมาชิก'] || 0);
                const p = Number(record['รวมชิ้นราคาโปร'] || 0);
                const z = Number(record['รวมชิ้นราคาศูนย์'] || 0);
                if (f > 0) items.push({ billId: record.id, date: record.date || record.sale_date || '', memberId: recMemberId, memberName: member?.name || recMemberId, team: cleanTeam, custType: resolvedCustType, product: 'สินค้าทั่วไป', priceType: 'ราคาเต็ม', qty: f });
                if (m > 0) items.push({ billId: record.id, date: record.date || record.sale_date || '', memberId: recMemberId, memberName: member?.name || recMemberId, team: cleanTeam, custType: resolvedCustType, product: 'สินค้าทั่วไป', priceType: 'ราคาสมาชิก', qty: m });
                if (p > 0) items.push({ billId: record.id, date: record.date || record.sale_date || '', memberId: recMemberId, memberName: member?.name || recMemberId, team: cleanTeam, custType: resolvedCustType, product: 'สินค้าทั่วไป', priceType: 'ราคาโปร', qty: p });
                if (z > 0) items.push({ billId: record.id, date: record.date || record.sale_date || '', memberId: recMemberId, memberName: member?.name || record.memberId, team: cleanTeam, custType: resolvedCustType, product: 'สินค้าทั่วไป', priceType: 'ราคาศูนย์', qty: z });
            }
        });
        return items;
    }

    /**
     * 2. สกัดการตั้งค่าเงื่อนไขการรับค่าคอมมิชชั่น (Commission Condition Config)
     */
    function extractCommissionConfig(systemSettings) {
        let commConfig = { is_enabled: false, min_boxes: 0 };
        try {
            let rawCfg = null;
            if (typeof localStorage !== 'undefined') {
                const localSaved = localStorage.getItem('stk_system_settings');
                if (localSaved) {
                    const parsedSaved = JSON.parse(localSaved);
                    if (parsedSaved && parsedSaved.commission_condition_config !== undefined) {
                        rawCfg = parsedSaved.commission_condition_config;
                    }
                }
            }
            if (rawCfg === null || rawCfg === undefined) {
                if (systemSettings && systemSettings.commission_condition_config) {
                    rawCfg = systemSettings.commission_condition_config;
                }
            }
            if (rawCfg !== null && rawCfg !== undefined) {
                let parsed = rawCfg;
                while (typeof parsed === 'string' && parsed.trim() !== '') parsed = JSON.parse(parsed);
                if (parsed && typeof parsed === 'object') {
                    commConfig = {
                        is_enabled: parsed.is_enabled === true || parsed.is_enabled === 'true',
                        min_boxes: (!isNaN(Number(parsed.min_boxes)) && parsed.min_boxes !== null) ? Number(parsed.min_boxes) : 0,
                        target_scope: parsed.target_scope || 'all',
                        selected_teams: Array.isArray(parsed.selected_teams) ? parsed.selected_teams : [],
                        selected_members: Array.isArray(parsed.selected_members) ? parsed.selected_members : [],
                        exclude_teams: Array.isArray(parsed.exclude_teams) ? parsed.exclude_teams : [],
                        exclude_members: Array.isArray(parsed.exclude_members) ? parsed.exclude_members : []
                    };
                }
            }
        } catch (e) {}
        return commConfig;
    }

    /**
     * รวบรวมและปรับรูปแบบประวัติการจ่ายปันผลทั้งหมดให้เป็นมาตรฐานเดียวกัน
     */
    function extractNormalizedPayouts(payoutLogs = [], paidRecords = {}) {
        const list = [];
        (payoutLogs || []).forEach(log => {
            if (log.status === 'PAID' || log.status === 'สำเร็จ' || log.status === 'จ่ายปันผลแล้ว') {
                const id = log.payout_id || `${safeUpper(log.member_id)}_${log.payout_date}`;
                list.push({
                    id: id,
                    memberId: safeUpper(log.member_id),
                    amount: Number(log.amount) || 0,
                    date: String(log.payout_date || '').trim(),
                    startDate: String(log.start_date || '').trim(),
                    endDate: String(log.end_date || '').trim(),
                    paidAt: log.paid_at || log.created_at,
                    paidBy: log.paid_by || log.member_name || 'แอดมิน'
                });
            }
        });

        if (paidRecords && typeof paidRecords === 'object') {
            Object.entries(paidRecords).forEach(([k, rec]) => {
                if (!rec || (rec.status !== 'PAID' && rec.status !== 'สำเร็จ' && rec.status !== 'จ่ายปันผลแล้ว')) return;
                const mId = safeUpper(rec.memberId || k.split('_')[0]);
                list.push({
                    id: rec.key || rec.payout_id || k,
                    memberId: mId,
                    amount: Number(rec.amount) || 0,
                    date: String(rec.date || rec.payout_date || '').trim(),
                    startDate: String(rec.startDate || rec.start_date || '').trim(),
                    endDate: String(rec.endDate || rec.end_date || '').trim(),
                    paidAt: rec.paidAt || rec.paid_at,
                    paidBy: rec.paidBy || rec.paid_by || 'แอดมิน'
                });
            });
        }

        const deduped = {};
        list.forEach(p => {
            if (!deduped[p.id]) {
                deduped[p.id] = p;
            } else {
                deduped[p.id].amount = Math.max(deduped[p.id].amount, p.amount);
                if (p.paidAt && !deduped[p.id].paidAt) deduped[p.id].paidAt = p.paidAt;
                if (p.paidBy && !deduped[p.id].paidBy) deduped[p.id].paidBy = p.paidBy;
            }
        });
        return Object.values(deduped);
    }

    /**
     * ตรวจสอบว่ารายการจ่ายปันผล p อยู่ในหรือคาบเกี่ยวกับช่วงวันที่ start ถึง end หรือไม่
     */
    function doesPayoutMatchPeriod(p, start, end) {
        if (!start && !end) return true;
        let pStart = p.startDate;
        let pEnd = p.endDate;

        if (!pStart && p.date) {
            if (p.date.includes(' ถึง ')) {
                const parts = p.date.split(' ถึง ').map(s => s.trim());
                pStart = parts[0];
                pEnd = parts[1] || parts[0];
            } else if (/^\d{4}-\d{2}-\d{2}$/.test(p.date)) {
                pStart = p.date;
                pEnd = p.date;
            }
        }

        if (!pStart && p.id) {
            const parts = p.id.split('_');
            if (parts.length === 3 && /^\d{4}-\d{2}-\d{2}$/.test(parts[1]) && /^\d{4}-\d{2}-\d{2}$/.test(parts[2])) {
                pStart = parts[1];
                pEnd = parts[2];
            } else if (parts.length >= 2 && /^\d{4}-\d{2}-\d{2}$/.test(parts[1])) {
                pStart = parts[1];
                pEnd = parts[1];
            }
        }

        if (pStart && pEnd) {
            if (start && end) return pStart <= end && pEnd >= start;
            if (start) return pEnd >= start;
            if (end) return pStart <= end;
        }

        if (p.paidAt) {
            const paidDay = String(p.paidAt).substring(0, 10);
            if (/^\d{4}-\d{2}-\d{2}$/.test(paidDay)) {
                if (start && end) return paidDay >= start && paidDay <= end;
                if (start) return paidDay >= start;
                if (end) return paidDay <= end;
            }
        }

        return true;
    }

    /**
     * 3. คำนวณสรุปค่าแนะนำรวม (Referral Fee Summary)
     */
    function calculateReferralReportData({
        unfoldedSales = [],
        members = [],
        products = [],
        businessTeams = [],
        permittedMemberSet = null,
        selectedTeamFilter = '',
        selectedSponsorFilter = '',
        debouncedSearchQuery = '',
        referralCalcMode = 'box',
        systemSettings = {},
        payoutLogs = [],
        paidRecords = {},
        startDate = '',
        endDate = ''
    }) {
        let memberMap = {};
        const commConfig = extractCommissionConfig(systemSettings);

        // ⚡ O(1) Pre-indexing maps for high performance
        const memberLookup = new Map();
        (members || []).forEach(m => {
            if (m && m.id) memberLookup.set(safeUpper(m.id), m);
        });

        const cleanProdName = (name) => String(name || '').replace(/\(.*?\)/g, '').trim().toUpperCase();
        const productLookup = new Map();
        (products || []).forEach(p => {
            if (!p) return;
            if (p.id) productLookup.set(safeUpper(p.id), p);
            if (p.product_id) productLookup.set(safeUpper(p.product_id), p);
            if (p.name) productLookup.set(safeUpper(p.name), p);
            if (p.product_name) productLookup.set(safeUpper(p.product_name), p);
            if (p.name && !productLookup.has(cleanProdName(p.name))) productLookup.set(cleanProdName(p.name), p);
            if (p.id && !productLookup.has(cleanProdName(p.id))) productLookup.set(cleanProdName(p.id), p);
        });

        const teamCache = new Map();
        const getTeamName = (rawTeam) => {
            if (!rawTeam) return 'N/A';
            const k = safeUpper(rawTeam);
            if (teamCache.has(k)) return teamCache.get(k);
            const resolved = resolveTeamName(rawTeam, businessTeams);
            teamCache.set(k, resolved);
            return resolved;
        };

        let periodSelfBoxesMap = {};
        (unfoldedSales || []).forEach(s => {
            const pType = String(s.priceType || '').trim().toLowerCase();
            const isPromoOrZero = pType.includes('โปร') || pType.includes('ศูนย์') || pType.includes('zero') || pType.includes('promo') || pType.includes('free');
            if (!isPromoOrZero) {
                const mId = safeUpper(s.memberId || s.member_id || s.sellerId || s.seller_id);
                if (mId) periodSelfBoxesMap[mId] = (periodSelfBoxesMap[mId] || 0) + s.qty;
            }
        });

        const meetCommCondition = (mId) => {
            if (!commConfig.is_enabled) return true;
            const safeKey = safeUpper(mId);
            const mObj = memberLookup.get(safeKey);
            const safeTeam = mObj ? safeUpper(getTeamName(mObj.team)) : '';

            if (Array.isArray(commConfig.exclude_teams) && commConfig.exclude_teams.length > 0) {
                if (commConfig.exclude_teams.some(t => safeUpper(t) === safeTeam)) return true;
            }
            if (Array.isArray(commConfig.exclude_members) && commConfig.exclude_members.length > 0) {
                if (commConfig.exclude_members.some(id => safeUpper(id) === safeKey)) return true;
            }

            const scope = commConfig.target_scope || 'all';
            if (scope === 'specific_teams') {
                const teams = (commConfig.selected_teams || []).map(t => safeUpper(t));
                if (!teams.includes(safeTeam)) return true;
            } else if (scope === 'specific_members') {
                const ids = (commConfig.selected_members || []).map(id => safeUpper(id));
                if (!ids.includes(safeKey)) return true;
            }

            const boxesFromMap = periodSelfBoxesMap[safeKey] || 0;
            const boxesFromMember = memberMap[safeKey] ? memberMap[safeKey].selfBoxes || 0 : 0;
            const totalBoxes = Math.max(boxesFromMap, boxesFromMember);
            const minBoxesNeeded = (!isNaN(Number(commConfig.min_boxes)) && commConfig.min_boxes !== null) ? Number(commConfig.min_boxes) : 0;
            return totalBoxes >= minBoxesNeeded;
        };

        (members || []).forEach(m => {
            if (permittedMemberSet !== null && !permittedMemberSet.has(safeUpper(m.id))) return;
            const cTeam = getTeamName(m.team);
            if (selectedTeamFilter && safeUpper(cTeam) !== safeUpper(selectedTeamFilter)) return;
            if (selectedSponsorFilter) {
                const motherId = safeUpper(selectedSponsorFilter);
                const isMotherOrChild = safeUpper(m.id) === motherId || safeUpper(m.referrer) === motherId || safeUpper(m.sponsorId) === motherId;
                if (!isMotherOrChild) return;
            }

            let levelEarns = {};
            for (let l = 1; l <= 10; l++) levelEarns[`level${l}Earn`] = 0;

            memberMap[safeUpper(m.id)] = {
                id: m.id, name: m.name, team: cTeam, profileUrl: m.profileUrl || '', details: {},
                selfBoxes: 0, selfEarn: 0, selfPv: 0, teamBoxes: 0, teamPv: 0, totalPaid: 0, ...levelEarns
            };
        });

        (unfoldedSales || []).forEach(s => {
            const pTypeStr = String(s.priceType || '').trim();
            const pTypeLower = pTypeStr.toLowerCase();
            const isPromoOrZero = pTypeStr.includes('โปร') || pTypeStr.includes('ศูนย์') || pTypeLower.includes('promo') || pTypeLower.includes('zero') || pTypeLower.includes('free');
            if (isPromoOrZero) return;

            const rawTarget = safeUpper(s.productId || s.product_id || s.product);
            const target = cleanProdName(s.product);
            const prodConfig = productLookup.get(rawTarget) || productLookup.get(target) || {};

            let fallbackSelfFee = 250000;
            let fallbackL1Fee = 200000;

            const isMemberPrice = pTypeStr.includes('สมาชิก') || pTypeStr.toLowerCase().includes('member');

            const computePayout = (levelIdx) => {
                let feePerBox = 0; let feePercent = 0;
                if (levelIdx === 0) {
                    feePerBox = Number(prodConfig.selfFee || prodConfig.directFee || prodConfig.self_fee || prodConfig.level0Fee || 0);
                    if (feePerBox <= 0 || isNaN(feePerBox)) feePerBox = fallbackSelfFee;
                    feePercent = isMemberPrice ? Number(prodConfig.selfPercentMember || prodConfig.self_percent_member || 0) : Number(prodConfig.selfPercentFull || prodConfig.self_percent_full || prodConfig.selfPercent || 0);
                } else if (levelIdx === 1) {
                    feePerBox = Number(prodConfig.level1Fee || prodConfig.uplineFee || prodConfig.level_1_fee || prodConfig.l1Rate || 0);
                    if (feePerBox <= 0 || isNaN(feePerBox)) feePerBox = fallbackL1Fee;
                    feePercent = isMemberPrice ? Number(prodConfig.level1PercentMember || prodConfig.level_1_percent_member || 0) : Number(prodConfig.level1PercentFull || prodConfig.level_1_percent_full || prodConfig.level1Percent || 0);
                } else {
                    feePerBox = Number(prodConfig[`level${levelIdx}Fee`] || prodConfig[`level_${levelIdx}_fee`] || 0);
                    feePercent = isMemberPrice ? Number(prodConfig[`level${levelIdx}PercentMember`] || prodConfig[`level_${levelIdx}_percent_member`] || 0) : Number(prodConfig[`level${levelIdx}PercentFull`] || prodConfig[`level_${levelIdx}_percent_full`] || prodConfig[`level${levelIdx}Percent`] || 0);
                }
                const itemPrice = isMemberPrice ? Number(prodConfig.priceMember || prodConfig.priceFull || 0) : Number(prodConfig.priceFull || prodConfig.priceMember || 0);
                const boxEarn = feePerBox * s.qty;
                const percentEarn = (itemPrice * s.qty) * (feePercent / 100);
                if (referralCalcMode === 'percent') return percentEarn;
                if (referralCalcMode === 'combo') return boxEarn + percentEarn;
                return boxEarn;
            };

            const sellerKey = safeUpper(s.memberId || s.member_id || s.sellerId || s.seller_id || s.seller || s.marketing);
            if (memberMap[sellerKey]) {
                const payAmt = computePayout(0);
                memberMap[sellerKey].selfBoxes += s.qty;
                memberMap[sellerKey].selfEarn += payAmt;
                memberMap[sellerKey].details[s.product] = (memberMap[sellerKey].details[s.product] || 0) + s.qty;
                if (payAmt > 0) {
                    const sDate = s.date ? (typeof s.date === 'string' ? s.date.substring(0, 10) : s.date) : '';
                    if (!memberMap[sellerKey].dailyEarn) memberMap[sellerKey].dailyEarn = {};
                    memberMap[sellerKey].dailyEarn[sDate] = (memberMap[sellerKey].dailyEarn[sDate] || 0) + payAmt;
                }
            }

            let currentMemInfo = memberLookup.get(sellerKey);
            let currentMemberId = currentMemInfo ? (currentMemInfo.referrer || currentMemInfo.sponsor_id || currentMemInfo.sponsorId || currentMemInfo.Sponsor_ID || currentMemInfo.upline || currentMemInfo.uplineId) : null;
            let currentLevel = 1;
            const maxCommLevels = Math.max(2, Number(systemSettings?.commission_levels ?? 6));
            const maxDownlines = Math.max(1, maxCommLevels - 1);

            while (currentMemberId && currentLevel <= maxDownlines) {
                let targetKey = safeUpper(currentMemberId);
                const targetMemObj = memberLookup.get(targetKey);
                if (!targetMemObj) break;

                let payAmt = computePayout(currentLevel);
                if (!memberMap[targetKey]) {
                    const targetTeamName = getTeamName(targetMemObj.team);
                    let levelEarns = {};
                    for (let l = 1; l <= 10; l++) levelEarns[`level${l}Earn`] = 0;
                    memberMap[targetKey] = {
                        id: targetMemObj.id,
                        name: targetMemObj.name,
                        team: targetTeamName || 'N/A',
                        profileUrl: targetMemObj.profileUrl || '',
                        details: {},
                        selfBoxes: 0, selfEarn: 0, selfPv: 0, teamBoxes: 0, teamPv: 0, totalPaid: 0, ...levelEarns
                    };
                }
                if (memberMap[targetKey]) {
                    if (payAmt > 0 && meetCommCondition(targetKey)) {
                        memberMap[targetKey][`level${currentLevel}Earn`] += payAmt;
                        const sDate = s.date ? (typeof s.date === 'string' ? s.date.substring(0, 10) : s.date) : '';
                        if (!memberMap[targetKey].dailyEarn) memberMap[targetKey].dailyEarn = {};
                        memberMap[targetKey].dailyEarn[sDate] = (memberMap[targetKey].dailyEarn[sDate] || 0) + payAmt;
                    }
                    memberMap[targetKey].teamBoxes += s.qty;
                }
                const memInfo = targetMemObj;
                currentMemberId = memInfo ? (memInfo.referrer || memInfo.sponsor_id || memInfo.sponsorId || memInfo.Sponsor_ID || memInfo.upline || memInfo.uplineId) : null;
                currentLevel++;
            }
        });

        const payouts = extractNormalizedPayouts(payoutLogs, paidRecords);

        Object.values(memberMap).forEach(m => {
            m.totalPaid = 0;
            const mId = safeUpper(m.id);
            payouts.forEach(p => {
                if (p.memberId === mId) {
                    if (doesPayoutMatchPeriod(p, startDate, endDate)) {
                        m.totalPaid += p.amount;
                    }
                }
            });
        });

        const query = String(debouncedSearchQuery || '').trim().toUpperCase();

        return Object.values(memberMap)
            .filter(m => {
                if (m.selfBoxes > 0 || m.teamBoxes > 0 || m.selfEarn > 0 || m.totalPaid > 0) return true;
                for (let l = 1; l <= 10; l++) if (m[`level${l}Earn`] > 0) return true;
                return false;
            })
            .map(m => {
                let sumAll = m.selfEarn;
                for (let l = 1; l <= 10; l++) sumAll += (m[`level${l}Earn`] || 0);
                m.grandTotal = sumAll;
                m.totalPaid = m.totalPaid || 0;
                m.remainingToPay = Math.max(0, m.grandTotal - m.totalPaid);
                m.payoutStatus = m.grandTotal === 0 ? '-' : (m.remainingToPay <= 0 ? 'จ่ายปันผลแล้ว' : (m.totalPaid > 0 ? 'บางส่วน' : 'รอปันผล'));
                return m;
            })
            .filter(m => query === '' || m.id.toUpperCase().includes(query) || m.name.toUpperCase().includes(query))
            .sort((a, b) => b.grandTotal - a.grandTotal);
    }

    /**
     * 4. คำนวณรายการปันผลรายวัน (Daily Payout Log)
     */
    function calculateReferralDailyPayoutData({
        unfoldedSales = [],
        members = [],
        products = [],
        businessTeams = [],
        permittedMemberSet = null,
        selectedTeamFilter = '',
        selectedSponsorFilter = '',
        debouncedSearchQuery = '',
        referralCalcMode = 'box',
        systemSettings = {},
        payoutLogs = [],
        paidRecords = {},
        payoutStatusFilter = 'ALL',
        startDate = '',
        endDate = ''
    }) {
        const commConfig = extractCommissionConfig(systemSettings);

        let periodSelfBoxesMap = {};
        (unfoldedSales || []).forEach(s => {
            const pType = String(s.priceType || '').trim().toLowerCase();
            const isPromoOrZero = pType.includes('โปร') || pType.includes('ศูนย์') || pType.includes('zero') || pType.includes('promo') || pType.includes('free');
            if (!isPromoOrZero) {
                const mId = safeUpper(s.memberId || s.member_id || s.sellerId || s.seller_id);
                if (mId) periodSelfBoxesMap[mId] = (periodSelfBoxesMap[mId] || 0) + s.qty;
            }
        });

        const meetCommCondition = (mId) => {
            if (!commConfig.is_enabled) return true;
            const safeKey = safeUpper(mId);
            const mObj = (members || []).find(m => safeUpper(m.id) === safeKey);
            const safeTeam = mObj ? safeUpper(resolveTeamName(mObj.team, businessTeams)) : '';

            if (Array.isArray(commConfig.exclude_teams) && commConfig.exclude_teams.length > 0) {
                if (commConfig.exclude_teams.some(t => safeUpper(t) === safeTeam)) return true;
            }
            if (Array.isArray(commConfig.exclude_members) && commConfig.exclude_members.length > 0) {
                if (commConfig.exclude_members.some(id => safeUpper(id) === safeKey)) return true;
            }

            const scope = commConfig.target_scope || 'all';
            if (scope === 'specific_teams') {
                const teams = (commConfig.selected_teams || []).map(t => safeUpper(t));
                if (!teams.includes(safeTeam)) return true;
            } else if (scope === 'specific_members') {
                const ids = (commConfig.selected_members || []).map(id => safeUpper(id));
                if (!ids.includes(safeKey)) return true;
            }

            const totalBoxes = periodSelfBoxesMap[safeKey] || 0;
            const minBoxesNeeded = (commConfig.min_boxes !== undefined && commConfig.min_boxes !== null && !isNaN(Number(commConfig.min_boxes))) ? Number(commConfig.min_boxes) : 0;
            return totalBoxes >= minBoxesNeeded;
        };

        let dailyMap = {};

        // ⚡ O(1) Pre-indexing maps for high performance
        const cleanProdName = (name) => String(name || '').replace(/\(.*?\)/g, '').trim().toUpperCase();
        const productLookup = new Map();
        (products || []).forEach(p => {
            if (!p) return;
            if (p.id) productLookup.set(safeUpper(p.id), p);
            if (p.product_id) productLookup.set(safeUpper(p.product_id), p);
            if (p.name) productLookup.set(safeUpper(p.name), p);
            if (p.product_name) productLookup.set(safeUpper(p.product_name), p);
            if (p.name && !productLookup.has(cleanProdName(p.name))) productLookup.set(cleanProdName(p.name), p);
            if (p.id && !productLookup.has(cleanProdName(p.id))) productLookup.set(cleanProdName(p.id), p);
        });

        const memberLookup = new Map();
        (members || []).forEach(m => {
            if (m && m.id) memberLookup.set(safeUpper(m.id), m);
        });

        const teamCache = new Map();
        const getTeamName = (rawTeam) => {
            if (!rawTeam) return 'N/A';
            const k = safeUpper(rawTeam);
            if (teamCache.has(k)) return teamCache.get(k);
            const resolved = resolveTeamName(rawTeam, businessTeams);
            teamCache.set(k, resolved);
            return resolved;
        };

        const isRange = startDate && endDate && startDate !== endDate;
        const cycleDateLabel = isRange ? `${startDate} ถึง ${endDate}` : (startDate || endDate || '');
        const cycleKey = isRange ? `${startDate}_${endDate}` : (startDate || endDate || '');

        (unfoldedSales || []).forEach(s => {
            const pTypeStr = String(s.priceType || '').trim();
            const pTypeLower = pTypeStr.toLowerCase();
            const isPromoOrZero = pTypeStr.includes('โปร') || pTypeStr.includes('ศูนย์') || pTypeLower.includes('promo') || pTypeLower.includes('zero') || pTypeLower.includes('free');
            if (isPromoOrZero) return;

            const rawTarget = safeUpper(s.productId || s.product_id || s.product);
            const target = cleanProdName(s.product);
            const prodConfig = productLookup.get(rawTarget) || productLookup.get(target) || {};

            let fallbackSelfFee = 250000;
            let fallbackL1Fee = 200000;

            const isMemberPrice = pTypeStr.includes('สมาชิก') || pTypeStr.toLowerCase().includes('member');

            const computePayout = (levelIdx) => {
                let feePerBox = 0; let feePercent = 0;
                if (levelIdx === 0) {
                    feePerBox = Number(prodConfig.selfFee || prodConfig.directFee || prodConfig.self_fee || prodConfig.level0Fee || 0);
                    if (feePerBox <= 0 || isNaN(feePerBox)) feePerBox = fallbackSelfFee;
                    feePercent = isMemberPrice ? Number(prodConfig.selfPercentMember || prodConfig.self_percent_member || 0) : Number(prodConfig.selfPercentFull || prodConfig.self_percent_full || prodConfig.selfPercent || 0);
                } else if (levelIdx === 1) {
                    feePerBox = Number(prodConfig.level1Fee || prodConfig.uplineFee || prodConfig.level_1_fee || prodConfig.l1Rate || 0);
                    if (feePerBox <= 0 || isNaN(feePerBox)) feePerBox = fallbackL1Fee;
                    feePercent = isMemberPrice ? Number(prodConfig.level1PercentMember || prodConfig.level_1_percent_member || 0) : Number(prodConfig.level1PercentFull || prodConfig.level_1_percent_full || prodConfig.level1Percent || 0);
                } else {
                    feePerBox = Number(prodConfig[`level${levelIdx}Fee`] || prodConfig[`level_${levelIdx}_fee`] || 0);
                    feePercent = isMemberPrice ? Number(prodConfig[`level${levelIdx}PercentMember`] || prodConfig[`level_${levelIdx}_percent_member`] || 0) : Number(prodConfig[`level${levelIdx}PercentFull`] || prodConfig[`level_${levelIdx}_percent_full`] || prodConfig[`level${levelIdx}Percent`] || 0);
                }
                const itemPrice = isMemberPrice ? Number(prodConfig.priceMember || prodConfig.priceFull || 0) : Number(prodConfig.priceFull || prodConfig.priceMember || 0);
                const boxEarn = feePerBox * s.qty;
                const percentEarn = (itemPrice * s.qty) * (feePercent / 100);
                if (referralCalcMode === 'percent') return percentEarn;
                if (referralCalcMode === 'combo') return boxEarn + percentEarn;
                return boxEarn;
            };

            const sDate = s.date ? (typeof s.date === 'string' ? s.date.substring(0, 10) : s.date) : '';
            const sellerKey = safeUpper(s.memberId || s.member_id || s.sellerId || s.seller_id || s.seller || s.marketing);
            const sellerMem = memberLookup.get(sellerKey);
            const sellerTeam = getTeamName(sellerMem?.team);

            const getOrCreateDaily = (mId, mName, mTeam, pDate) => {
                const dateVal = cycleDateLabel || pDate;
                const dateKeyPart = cycleKey || pDate;
                const key = `${safeUpper(mId)}_${dateKeyPart}`;
                if (!dailyMap[key]) {
                    dailyMap[key] = { key, date: dateVal, memberId: mId, memberName: mName, team: mTeam, selfEarn: 0, teamEarn: 0, totalEarn: 0, boxes: 0 };
                }
                return dailyMap[key];
            };

            const selfPay = computePayout(0);
            if (selfPay > 0 && sellerMem) {
                const item = getOrCreateDaily(sellerMem.id, sellerMem.name, sellerTeam, sDate);
                item.selfEarn += selfPay;
                item.totalEarn += selfPay;
                item.boxes += s.qty;
            }
            // รอบจ่ายเงินปันผลรายวัน: จ่ายเฉพาะคอมขายเอง (selfEarn) เท่านั้น ไม่มีการจ่ายปันผลสายงาน (ปันผลสายงานจ่ายในรอบสรุปภาพรวม)
        });

        const payouts = extractNormalizedPayouts(payoutLogs, paidRecords);

        const query = String(debouncedSearchQuery || '').trim().toUpperCase();

        return Object.values(dailyMap)
            .map(item => {
                const mId = safeUpper(item.memberId);
                let matchedPaidAmount = 0;
                let lastPaidAt = null;
                let lastPaidBy = null;

                payouts.forEach(p => {
                    if (p.memberId === mId) {
                        let matches = false;
                        if (p.id === item.key) {
                            matches = true;
                        } else if (startDate && endDate) {
                            if (doesPayoutMatchPeriod(p, startDate, endDate)) {
                                matches = true;
                            }
                        }
                        if (matches) {
                            matchedPaidAmount += p.amount;
                            if (p.paidAt && (!lastPaidAt || p.paidAt > lastPaidAt)) {
                                lastPaidAt = p.paidAt;
                                lastPaidBy = p.paidBy;
                            }
                        }
                    }
                });

                const isPaid = (matchedPaidAmount >= item.totalEarn && item.totalEarn > 0) || matchedPaidAmount > 0;
                return {
                    ...item,
                    status: isPaid ? 'PAID' : 'PENDING',
                    paidAt: lastPaidAt || null,
                    paidBy: lastPaidBy || null,
                    paidAmount: matchedPaidAmount
                };
            })
            .filter(item => {
                if (permittedMemberSet !== null && !permittedMemberSet.has(safeUpper(item.memberId))) return false;
                if (selectedTeamFilter && safeUpper(item.team) !== safeUpper(selectedTeamFilter)) return false;
                if (payoutStatusFilter !== 'ALL' && item.status !== payoutStatusFilter) return false;
                if (query !== '' && !item.memberId.toUpperCase().includes(query) && !item.memberName.toUpperCase().includes(query)) return false;
                return item.totalEarn > 0;
            })
            .sort((a, b) => b.date.localeCompare(a.date) || b.totalEarn - a.totalEarn);
    }

    /**
     * 5. คำนวณแจกแจงรายบิลของสมาชิก (Earner Details Modal)
     */
    function calculateEarnerDetailItems({
        unfoldedSales = [],
        detailModalEarner = null,
        members = [],
        products = [],
        referralCalcMode = 'box',
        systemSettings = {}
    }) {
        if (!detailModalEarner) return [];
        let details = [];

        // ⚡ O(1) Pre-indexing maps for high performance
        const cleanProdName = (name) => String(name || '').replace(/\(.*?\)/g, '').trim().toUpperCase();
        const productLookup = new Map();
        (products || []).forEach(p => {
            if (!p) return;
            if (p.id) productLookup.set(safeUpper(p.id), p);
            if (p.product_id) productLookup.set(safeUpper(p.product_id), p);
            if (p.name) productLookup.set(safeUpper(p.name), p);
            if (p.product_name) productLookup.set(safeUpper(p.product_name), p);
            if (p.name && !productLookup.has(cleanProdName(p.name))) productLookup.set(cleanProdName(p.name), p);
            if (p.id && !productLookup.has(cleanProdName(p.id))) productLookup.set(cleanProdName(p.id), p);
        });

        const memberLookup = new Map();
        (members || []).forEach(m => {
            if (m && m.id) memberLookup.set(safeUpper(m.id), m);
        });

        unfoldedSales.forEach(s => {
            const pTypeStr = String(s.priceType || '').trim();
            const pTypeLower = pTypeStr.toLowerCase();
            const isPromoOrZero = pTypeStr.includes('โปร') || pTypeStr.includes('ศูนย์') || pTypeLower.includes('promo') || pTypeLower.includes('zero') || pTypeLower.includes('free');
            if (isPromoOrZero) return;

            const rawTarget = safeUpper(s.productId || s.product_id || s.product);
            const target = cleanProdName(s.product);
            const prodConfig = productLookup.get(rawTarget) || productLookup.get(target) || {};

            let fallbackSelfFee = 250000;
            let fallbackL1Fee = 200000;

            const isMemberPrice = pTypeStr.includes('สมาชิก') || pTypeStr.toLowerCase().includes('member');

            const computePayout = (levelIdx) => {
                let feePerBox = 0;
                let feePercent = 0;

                if (levelIdx === 0) {
                    feePerBox = Number(prodConfig.selfFee || prodConfig.directFee || prodConfig.self_fee || prodConfig.level0Fee || 0);
                    if (feePerBox <= 0 || isNaN(feePerBox)) feePerBox = fallbackSelfFee;
                    feePercent = isMemberPrice 
                        ? Number(prodConfig.selfPercentMember || prodConfig.self_percent_member || 0)
                        : Number(prodConfig.selfPercentFull || prodConfig.self_percent_full || prodConfig.selfPercent || 0);
                } else if (levelIdx === 1) {
                    feePerBox = Number(prodConfig.level1Fee || prodConfig.uplineFee || prodConfig.level_1_fee || prodConfig.l1Rate || 0);
                    if (feePerBox <= 0 || isNaN(feePerBox)) feePerBox = fallbackL1Fee;
                    feePercent = isMemberPrice
                        ? Number(prodConfig.level1PercentMember || prodConfig.level_1_percent_member || 0)
                        : Number(prodConfig.level1PercentFull || prodConfig.level_1_percent_full || prodConfig.level1Percent || 0);
                } else {
                    feePerBox = Number(prodConfig[`level${levelIdx}Fee`] || prodConfig[`level_${levelIdx}_fee`] || 0);
                    feePercent = isMemberPrice
                        ? Number(prodConfig[`level${levelIdx}PercentMember`] || prodConfig[`level_${levelIdx}_percent_member`] || 0)
                        : Number(prodConfig[`level${levelIdx}PercentFull`] || prodConfig[`level_${levelIdx}_percent_full`] || prodConfig[`level${levelIdx}Percent`] || 0);
                }

                const itemPrice = isMemberPrice 
                    ? Number(prodConfig.priceMember || prodConfig.priceFull || 0) 
                    : Number(prodConfig.priceFull || prodConfig.priceMember || 0);
                const boxEarn = feePerBox * s.qty;
                const percentEarn = (itemPrice * s.qty) * (feePercent / 100);

                if (referralCalcMode === 'percent') return { earn: percentEarn, rateStr: `${feePercent}%` };
                if (referralCalcMode === 'combo') return { earn: boxEarn + percentEarn, rateStr: `@${feePerBox.toLocaleString()} + ${feePercent}%` };
                return { earn: boxEarn, rateStr: `@${feePerBox.toLocaleString()}` };
            };

            const earnerId = safeUpper(detailModalEarner.id);
            const sellerKey = safeUpper(s.memberId || s.member_id || s.sellerId || s.seller_id || s.seller || s.marketing);

            if (sellerKey === earnerId) {
                const res = computePayout(0);
                if (res.earn > 0) {
                    details.push({
                        date: s.date, billId: s.billId || s.orderId || s.order_id, sellerId: sellerKey, sellerName: s.memberName || s.name || sellerKey, product: s.product, qty: s.qty, level: 'ขายเอง (ข้างกล่อง)', feeRateStr: res.rateStr, totalEarned: res.earn
                    });
                }
            }

            let currentMemInfo = memberLookup.get(sellerKey);
            let currentMemberId = currentMemInfo ? (currentMemInfo.referrer || currentMemInfo.sponsor_id || currentMemInfo.sponsorId || currentMemInfo.Sponsor_ID || currentMemInfo.upline || currentMemInfo.uplineId) : null;
            let currentLevel = 1;

            const maxCommLevels = Math.max(2, Number(systemSettings?.commission_levels ?? 6));
            const maxDownlines = Math.max(1, maxCommLevels - 1);
            while (currentMemberId && currentLevel <= maxDownlines) {
                let targetKey = safeUpper(currentMemberId);
                const res = computePayout(currentLevel);

                if (res.earn > 0 && targetKey === earnerId) {
                    details.push({
                        date: s.date, billId: s.billId || s.orderId || s.order_id, sellerId: sellerKey, sellerName: s.memberName || s.name || sellerKey, product: s.product, qty: s.qty, level: `ชั้นที่ ${currentLevel}`, feeRateStr: res.rateStr, totalEarned: res.earn
                    });
                }
                const memInfo = memberLookup.get(targetKey);
                currentMemberId = memInfo ? (memInfo.referrer || memInfo.sponsor_id || memInfo.sponsorId || memInfo.Sponsor_ID || memInfo.upline || memInfo.uplineId) : null;
                currentLevel++;
            }
        });

        return details.sort((a, b) => b.date.localeCompare(a.date) || b.billId.localeCompare(a.billId));
    }

    /**
     * 6. คำนวณสรุปยอดรวมท้ายตาราง
     */
    function calculateReferralTotals(referralReportData) {
        let Self = 0, grandTotal = 0, totalPaid = 0, totalRemaining = 0;
        let levelTotals = {};
        for (let l = 1; l <= 10; l++) levelTotals[`L${l}`] = 0;

        (referralReportData || []).forEach(r => {
            Self += (r.selfEarn || 0);
            grandTotal += (r.grandTotal || 0);
            totalPaid += (r.totalPaid || 0);
            totalRemaining += (r.remainingToPay || 0);
            for (let l = 1; l <= 10; l++) levelTotals[`L${l}`] += (r[`level${l}Earn`] || 0);
        });

        return { Self, levelTotals, grandTotal, totalPaid, totalRemaining };
    }

    /**
     * 7. คำนวณคอลัมน์และผลรวมแต่ละชั้น
     */
    function calculateActiveLevelTotals(referralReportData, systemSettings) {
        const maxCommLevels = Math.max(2, Number(systemSettings?.commission_levels ?? 6));
        const maxDownlines = Math.max(1, maxCommLevels - 1);
        let activeLevels = [];
        for (let l = 1; l <= maxDownlines; l++) {
            const sum = (referralReportData || []).reduce((acc, r) => acc + (r[`level${l}Earn`] || 0), 0);
            activeLevels.push({ level: l, total: sum });
        }
        return activeLevels;
    }

    // Export to Global Scope
    window.ReportReferralEngine = {
        resolveTeamName,
        unfoldSales,
        extractCommissionConfig,
        calculateReferralReportData,
        calculateReferralDailyPayoutData,
        calculateEarnerDetailItems,
        calculateReferralTotals,
        calculateActiveLevelTotals
    };

})(window);
