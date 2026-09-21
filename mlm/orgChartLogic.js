/**
 * ================================================================
 * 🔀 orgChartLogic.js — STK Sales Team Hierarchy & Commission Logic Engine
 * LOVE STK GROUPE - Sales Hierarchy & Referral Dividend Calculation Engine
 * ================================================================
 */

(function (window) {
  'use strict';

  const safeUpper = (str) => String(str || '').trim().toUpperCase();

  // ─── 1. Hierarchy & Downline Helpers ───────────────────────────

  let _lastMembersRef = null;
  let _cachedChildrenMap = new Map();

  function getChildren(membersList, parentId) {
    if (membersList !== _lastMembersRef) {
      _lastMembersRef = membersList;
      _cachedChildrenMap = new Map();
      (membersList || []).forEach(m => {
        const ref = safeUpper(m.referrer || m.sponsor_id || m.sponsorId);
        const mid = safeUpper(m.id || m.user_id);
        if (ref && ref !== mid) {
          if (!_cachedChildrenMap.has(ref)) _cachedChildrenMap.set(ref, []);
          _cachedChildrenMap.get(ref).push(m);
        }
      });
    }
    return _cachedChildrenMap.get(safeUpper(parentId)) || [];
  }

  function getAllDownlineIds(membersList, rootId) {
    const result = new Set();
    const rootUp = safeUpper(rootId);
    if (!rootUp) return result;
    const queue = [rootUp];
    while (queue.length > 0) {
      const current = queue.shift();
      if (result.has(current)) continue;
      result.add(current);
      const children = getChildren(membersList, current);
      children.forEach(c => queue.push(safeUpper(c.id || c.user_id)));
    }
    return result;
  }

  function getDownlinesWithLevels(membersList, parentId, depth = 1, visited = new Set()) {
    const pIdUp = safeUpper(parentId);
    if (visited.has(pIdUp)) return [];
    visited.add(pIdUp);
    let res = [];
    const children = getChildren(membersList, pIdUp);
    (children || []).forEach(c => {
      res.push({ member: c, level: depth });
      res = res.concat(getDownlinesWithLevels(membersList, c.id || c.user_id, depth + 1, visited));
    });
    return res;
  }

  function calculateGroupSales(members, salesMap) {
    const calculateGroup = (parentId) => {
      const pUp = safeUpper(parentId);
      let total = salesMap[pUp]?.personal || 0;
      const children = getChildren(members, pUp);
      children.forEach(c => {
        total += calculateGroup(c.id || c.user_id);
      });
      if (salesMap[pUp]) {
        salesMap[pUp].group = total;
      }
      return total;
    };

    const rootNodes = (members || []).filter(m => {
      const ref = safeUpper(m.referrer || m.sponsor_id || m.sponsorId);
      const mid = safeUpper(m.id || m.user_id);
      return !ref || ref === mid || !(members || []).some(p => safeUpper(p.id || p.user_id) === ref);
    });

    rootNodes.forEach(r => calculateGroup(r.id || r.user_id));
    return salesMap;
  }

  // ─── 2. General Helpers & Product Resolution ───────────────────

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

  function getDefaultMonthRange() {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const lastDay = new Date(y, now.getMonth() + 1, 0).getDate();
    return { start: `${y}-${m}-01`, end: `${y}-${m}-${String(lastDay).padStart(2, '0')}` };
  }

  function cleanProdName(name) {
    return String(name || '').replace(/\(.*?\)/g, '').trim().toUpperCase();
  }
   // ─── 2.1 Auto-Correct Classification Helper ────────────────────
  function classifyOrderItem(it, prodMapObj = {}) {
      const rawPrice = (it.price !== undefined && it.price !== null && String(it.price).trim() !== '' && !isNaN(Number(it.price)))
          ? Number(it.price)
          : ((it.unitPrice !== undefined && it.unitPrice !== null && String(it.unitPrice).trim() !== '' && !isNaN(Number(it.unitPrice))) ? Number(it.unitPrice) : null);
      
      const typeStr = String(it.type || it.priceType || '').trim().toLowerCase();
      const pName = String(it.prod || it.productName || it.name || '').trim();
      const cleanPName = cleanProdName(pName);
      const pNameLower = pName.toLowerCase();

      const pObj = (it.id && prodMapObj.get(safeUpper(it.id))) || (it.product_id && prodMapObj.get(safeUpper(it.product_id))) || prodMapObj.get(safeUpper(pName)) || prodMapObj.get(safeUpper(cleanPName)) || {};
      const pFull = Number(pObj.price_full ?? pObj.priceFull ?? 0);
      const pMember = Number(pObj.price_member ?? pObj.priceMember ?? 0);
      const pPromo = Number(pObj.price_promo ?? pObj.pricePromo ?? 0);

      if (rawPrice !== null) {
          if (rawPrice === 0) return 'ราคาศูนย์';
          if (pPromo > 0 && Math.abs(rawPrice - pPromo) < 0.01) return 'ราคาโปร';
          if (pMember > 0 && Math.abs(rawPrice - pMember) < 0.01) return 'ราคาสมาชิก';
          if (pFull > 0 && Math.abs(rawPrice - pFull) < 0.01) return 'ราคาเต็ม';
      }

      if (pNameLower.includes('(แถม)') || pNameLower.includes('(ฟรี)') || pNameLower.includes('(ศูนย์)') || pNameLower.includes('(ຟຣີ)') || pNameLower.includes('(ແຖມ)')) return 'ราคาศูนย์';
      if (pNameLower.includes('(โปร)') || pNameLower.includes('(โบร)') || pNameLower.includes('(ໂປຣ)') || pNameLower.includes('ພິເສດ')) return 'ราคาโปร';
      if (pNameLower.includes('(สมาชิก)') || pNameLower.includes('(ส่ง)') || pNameLower.includes('(ສະມາຊິກ)') || pNameLower.includes('(ສົ່ງ)') || pNameLower.includes('ວີໄອພີ')) return 'ราคาสมาชิก';
      if (pNameLower.includes('(เต็ม)') || pNameLower.includes('(ปกติ)') || pNameLower.includes('(ປົກກະຕິ)') || pNameLower.includes('(ເຕັມ)')) return 'ราคาเต็ม';

      let pType = 'ราคาเต็ม';
      if (typeStr.includes('ศูนย์') || typeStr.includes('ฟรี') || typeStr.includes('แถม') || typeStr.includes('ຟຣີ') || typeStr.includes('ແຖມ') || typeStr === 'zero' || typeStr === 'free') pType = 'ราคาศูนย์';
      else if (typeStr.includes('โปร') || typeStr.includes('promo') || typeStr.includes('พิเศษ') || typeStr.includes('ໂປຣ') || typeStr.includes('ພິເສດ')) pType = 'ราคาโปร';
      else if (typeStr.includes('สมาชิก') || typeStr.includes('member') || typeStr.includes('ส่ง') || typeStr.includes('vip') || typeStr.includes('ສະມາຊິກ') || typeStr.includes('ສົ່ງ') || typeStr.includes('ວີໄອພີ')) pType = 'ราคาสมาชิก';
      else if (typeStr.includes('เต็ม') || typeStr.includes('ปกติ') || typeStr.includes('full') || typeStr.includes('normal') || typeStr.includes('ປົກກະຕິ') || typeStr.includes('ເຕັມ')) pType = 'ราคาเต็ม';

      if (pType === 'ราคาโปร' && pPromo === 0) {
          if (pMember > 0) return 'ราคาสมาชิก';
          return 'ราคาเต็ม';
      }
      if (pType === 'ราคาสมาชิก' && pMember === 0) {
          if (pFull > 0) return 'ราคาเต็ม';
      }

      return pType;
  }

  function isProductEligibleForReferral(prodConfig) {
    if (!prodConfig) return false;
    const status = String(prodConfig.status || "").trim();
    if (status === "à¸¢à¸à¹€à¸¥à¸´à¸" || status === "inactive") return false;

    const givePv = Number(prodConfig.givePv ?? prodConfig.give_pv ?? prodConfig.b2n_give_pv ?? 0);
    const selfFee = Number(prodConfig.selfFee ?? prodConfig.self_fee ?? prodConfig.directFee ?? prodConfig.level0Fee ?? 0);
    const l1Fee = Number(prodConfig.level1Fee ?? prodConfig.level_1_fee ?? prodConfig.uplineFee ?? prodConfig.l1Rate ?? 0);
    const selfPctFull = Number(prodConfig.selfPercentFull ?? prodConfig.self_percent_full ?? prodConfig.selfPercent ?? 0);
    const selfPctMem = Number(prodConfig.selfPercentMember ?? prodConfig.self_percent_member ?? 0);

    if (givePv > 0 || selfFee > 0 || l1Fee > 0 || selfPctFull > 0 || selfPctMem > 0) return true;
    for (let l = 2; l <= 10; l++) {
      if (Number(prodConfig[`level${l}Fee`] ?? prodConfig[`level_${l}_fee`] ?? 0) > 0) return true;
      if (Number(prodConfig[`level${l}PercentFull`] ?? prodConfig[`level_${l}_percent_full`] ?? 0) > 0) return true;
      if (Number(prodConfig[`level${l}PercentMember`] ?? prodConfig[`level_${l}_percent_member`] ?? 0) > 0) return true;
    }
    const cat = safeUpper(prodConfig.category);
    if (cat.includes("SUPPLEMENT") || cat.includes("COSMETIC") || cat.includes("COFFEE")) return true;
    return false;
  }

  function extractCommissionConfig(systemSettings) {
    let commConfig = {
      is_enabled: false,
      min_boxes: 0,
      target_scope: 'all',
      selected_teams: [],
      selected_members: [],
      exclude_teams: [],
      exclude_members: []
    };
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

  function checkCommissionCondition(systemSettings, personalTotalBoxes, memberId, memberTeam) {
    const commConfig = extractCommissionConfig(systemSettings);
    if (!commConfig.is_enabled) return true;

    const safeId = safeUpper(memberId);
    const safeTeam = safeUpper(memberTeam);

    if (Array.isArray(commConfig.exclude_teams) && commConfig.exclude_teams.length > 0) {
      if (commConfig.exclude_teams.some(t => safeUpper(t) === safeTeam)) return true;
    }
    if (Array.isArray(commConfig.exclude_members) && commConfig.exclude_members.length > 0) {
      if (commConfig.exclude_members.some(id => safeUpper(id) === safeId)) return true;
    }

    const scope = commConfig.target_scope || 'all';
    if (scope === 'specific_teams') {
      const teams = (commConfig.selected_teams || []).map(t => safeUpper(t));
      if (!teams.includes(safeTeam)) return true;
    } else if (scope === 'specific_members') {
      const ids = (commConfig.selected_members || []).map(id => safeUpper(id));
      if (!ids.includes(safeId)) return true;
    }

    const minBoxes = commConfig.min_boxes || 0;
    return personalTotalBoxes >= minBoxes;
  }

  // ─── 3. Comprehensive Performance & Dividend Engine ────────────

  function calculateMemberPerformanceDetails({
    member,
    sales = [],
    members = [],
    products = [],
    systemSettings = {},
    businessTeams = [],
    startDate = '',
    endDate = ''
  }) {
    if (!member) return null;

    const mId = safeUpper(member.id || member.user_id);
    const mTeam = resolveTeamName(member.team || member.business_team, businessTeams);

    // Filter sales within the target period
    const filteredSales = (sales || []).filter(s => {
      const sellerId = safeUpper(s.sellerId || s.seller_id || s.seller || s.memberId || s.marketing);
      if (!sellerId) return false;
      const sDate = s.date || s.sale_date || '';
      if (startDate && sDate < startDate) return false;
      if (endDate && sDate > endDate) return false;
      return true;
    });

    // 1. Personal Sales
    const personalSalesList = filteredSales.filter(s => {
      const sellerId = safeUpper(s.sellerId || s.seller_id || s.seller || s.memberId || s.marketing);
      return sellerId === mId;
    });

    // 2. Downlines & Levels
    const downlinesWithLevels = getDownlinesWithLevels(members, mId);
    const downlineIdsSet = new Set(downlinesWithLevels.map(d => safeUpper(d.member.id || d.member.user_id)));
    const downlineLevelMap = {};
    const downlinesByLevelCount = {};
    downlinesWithLevels.forEach(d => {
      const idUp = safeUpper(d.member.id || d.member.user_id);
      if (idUp) {
        downlineLevelMap[idUp] = d.level;
        downlinesByLevelCount[d.level] = (downlinesByLevelCount[d.level] || 0) + 1;
      }
    });

    const maxCommLevels = Math.max(2, Number(systemSettings?.commission_levels ?? 6));
    const maxDownlines = Math.max(1, maxCommLevels - 1);

    const downlineSalesList = filteredSales.filter(s => {
      const sellerId = safeUpper(s.sellerId || s.seller_id || s.seller || s.memberId || s.marketing);
      return downlineIdsSet.has(sellerId);
    });

    // 3. Product Lookup Index
    const productLookup = new Map();
    (products || []).forEach(p => {
      if (!p) return;
      if (p.id) productLookup.set(safeUpper(p.id), p);
      if (p.product_id) productLookup.set(safeUpper(p.product_id), p);
      if (p.name) productLookup.set(safeUpper(p.name), p);
      if (p.product_name) productLookup.set(safeUpper(p.product_name), p);
      const cleanName = cleanProdName(p.name || p.product_name || p.id);
      if (cleanName && !productLookup.has(cleanName)) productLookup.set(cleanName, p);
    });

    // 4. Box Counter (Counting 4 Price Types)
    let totalFullBoxesPersonal = 0;
    let totalMemberBoxesPersonal = 0;
    let totalPromoBoxesPersonal = 0;
    let totalZeroBoxesPersonal = 0;

    let totalFullBoxesTeam = 0;
    let totalMemberBoxesTeam = 0;
    let totalPromoBoxesTeam = 0;
    let totalZeroBoxesTeam = 0;

    // Helper to unpack items from a sale row (with Auto-Correct)
    const unpackItems = (s) => {
      let itemsList = [];
      if (s.items_json) {
        try { itemsList = typeof s.items_json === 'string' ? JSON.parse(s.items_json) : s.items_json; } catch (e) {}
      }
      
      // ถ้าเป็นบิลเก่า (ไม่มี items_json)
      if (!Array.isArray(itemsList) || itemsList.length === 0) {
        Object.entries(s || {}).forEach(([key, value]) => {
          if (key.endsWith('_ราคาเต็ม') || key.endsWith('_ราคาสมาชิก') || key.endsWith('_ราคาโปร') || key.endsWith('_ราคาศูนย์')) {
            const q = parseInt(value, 10);
            if (!isNaN(q) && q > 0) {
              const lastUnderscore = key.lastIndexOf('_');
              const pName = key.substring(0, lastUnderscore).replace(/\(.*?\)/g, '').trim();
              const legacyType = key.substring(lastUnderscore + 1);
              
              // ⭐ เรียกใช้ Auto-Correct กับบิลเก่า
              const correctType = classifyOrderItem({ prod: pName, type: legacyType }, productLookup);
              
              itemsList.push({ prod: pName, qty: q, type: correctType });
            }
          }
        });
      } else {
        // ถ้าเป็นบิลใหม่ (มี items_json) ให้รัน Auto-Correct ทับอีกทีเพื่อความชัวร์
        itemsList = itemsList.map(it => {
            const correctType = classifyOrderItem(it, productLookup);
            return { ...it, type: correctType };
        });
      }
      
      return itemsList;
    };

    // Calculate personal eligible boxes
    personalSalesList.forEach(s => {
      const items = unpackItems(s);
      if (items.length > 0) {
        items.forEach(it => {
          const q = Number(it.qty || it.quantity || 1);
          const t = String(it.type || it.priceType || '').trim();
          if (t === 'ราคาเต็ม') totalFullBoxesPersonal += q;
          else if (t === 'ราคาสมาชิก') totalMemberBoxesPersonal += q;
          else if (t === 'ราคาโปร' || t === 'โปรโมชั่น') totalPromoBoxesPersonal += q;
          else if (t === 'ราคาศูนย์' || t === 'ราคาฟรี') totalZeroBoxesPersonal += q;
          else totalPromoBoxesPersonal += q;
        });
      } else {
        totalFullBoxesPersonal += Number(s['รวมชิ้นราคาเต็ม'] || 0);
        totalMemberBoxesPersonal += Number(s['รวมชิ้นราคาสมาชิก'] || 0);
        totalPromoBoxesPersonal += Number(s['รวมชิ้นราคาโปร'] || 0);
        totalZeroBoxesPersonal += Number(s['รวมชิ้นราคาศูนย์'] || 0);
      }
    });

    // Calculate downline boxes
    downlineSalesList.forEach(s => {
      const items = unpackItems(s);
      if (items.length > 0) {
        items.forEach(it => {
          const q = Number(it.qty || it.quantity || 1);
          const t = String(it.type || it.priceType || '').trim();
          if (t === 'ราคาเต็ม') totalFullBoxesTeam += q;
          else if (t === 'ราคาสมาชิก') totalMemberBoxesTeam += q;
          else if (t === 'ราคาโปร' || t === 'โปรโมชั่น') totalPromoBoxesTeam += q;
          else if (t === 'ราคาศูนย์' || t === 'ราคาฟรี') totalZeroBoxesTeam += q;
          else totalPromoBoxesTeam += q;
        });
      } else {
        totalFullBoxesTeam += Number(s['รวมชิ้นราคาเต็ม'] || 0);
        totalMemberBoxesTeam += Number(s['รวมชิ้นราคาสมาชิก'] || 0);
        totalPromoBoxesTeam += Number(s['รวมชิ้นราคาโปร'] || 0);
        totalZeroBoxesTeam += Number(s['รวมชิ้นราคาศูนย์'] || 0);
      }
    });

    // 5. Check Commission Condition (matches ReportReferral exactly)
    const personalTotalBoxes = totalFullBoxesPersonal + totalMemberBoxesPersonal;
    const meetCommCondition = checkCommissionCondition(systemSettings, personalTotalBoxes, mId, mTeam);

    // 6. Category Payout & Retail Profit Margin
    const defaultRates = {
      'Supplement': { rate: 250000, l1Rate: 200000 },
      'Supplement02': { rate: 150000, l1Rate: 50000 },
      'Cosmetic': { rate: 70000, l1Rate: 30000 },
      'Coffee': { rate: 20000, l1Rate: 10000 }
    };

    const personalCategorized = {
      'Supplement': { key: 'Supplement', name: 'หมวด Supplement', rate: 250000, l1Rate: 200000, fullQty: 0, memberQty: 0, promoQty: 0, zeroQty: 0, totalQty: 0, totalLAK: 0, marginLAK: 0 },
      'Supplement02': { key: 'Supplement02', name: 'หมวด Supplement 02', rate: 150000, l1Rate: 50000, fullQty: 0, memberQty: 0, promoQty: 0, zeroQty: 0, totalQty: 0, totalLAK: 0, marginLAK: 0 },
      'Cosmetic': { key: 'Cosmetic', name: 'หมวด Cosmetic', rate: 70000, l1Rate: 30000, fullQty: 0, memberQty: 0, promoQty: 0, zeroQty: 0, totalQty: 0, totalLAK: 0, marginLAK: 0 },
      'Coffee': { key: 'Coffee', name: 'หมวด Coffee', rate: 20000, l1Rate: 10000, fullQty: 0, memberQty: 0, promoQty: 0, zeroQty: 0, totalQty: 0, totalLAK: 0, marginLAK: 0 }
    };

    const downlineCategorized = {
      'Supplement': { key: 'Supplement', name: 'หมวด Supplement', rate: 250000, l1Rate: 200000, fullQty: 0, memberQty: 0, promoQty: 0, zeroQty: 0, totalQty: 0, totalLAK: 0, marginLAK: 0 },
      'Supplement02': { key: 'Supplement02', name: 'หมวด Supplement 02', rate: 150000, l1Rate: 50000, fullQty: 0, memberQty: 0, promoQty: 0, zeroQty: 0, totalQty: 0, totalLAK: 0, marginLAK: 0 },
      'Cosmetic': { key: 'Cosmetic', name: 'หมวด Cosmetic', rate: 70000, l1Rate: 30000, fullQty: 0, memberQty: 0, promoQty: 0, zeroQty: 0, totalQty: 0, totalLAK: 0, marginLAK: 0 },
      'Coffee': { key: 'Coffee', name: 'หมวด Coffee', rate: 20000, l1Rate: 10000, fullQty: 0, memberQty: 0, promoQty: 0, zeroQty: 0, totalQty: 0, totalLAK: 0, marginLAK: 0 }
    };

    const getCatKey = (prodConfig, pName) => {
      const c = String(prodConfig?.category || '').toUpperCase().trim();
      if (c.includes('COFFEE')) return 'Coffee';
      if (c.includes('COSMETIC')) return 'Cosmetic';
      if (c.includes('02') || c.includes('SUPPLEMENT 02') || c.includes('SUPPLEMENT02')) return 'Supplement02';
      if (c.includes('SUPPLEMENT')) return 'Supplement';

      // à¸à¸£à¸“à¸µ category à¹„à¸¡à¹ˆà¸£à¸°à¸šà¸¸ à¸•à¸£à¸§à¸ˆà¸ªà¸­à¸šà¸•à¸²à¸¡à¸„à¸³à¸ªà¸³à¸„à¸±à¸à¸‚à¸­à¸‡à¸Šà¸·à¹ˆà¸­à¸ªà¸´à¸™à¸„à¹‰à¸²
      const n = safeUpper(pName);
      if (n.includes('COFFEE') || n.includes('ARABICA')) return 'Coffee';
      if (n.includes('02') || n.includes('GLUTA') || n.includes('COLLAGEN') || n.includes('BALANCE') || n.includes('KUT-SO') || n.includes('LIPO') || n.includes('LUTEIN') || n.includes('ORYZA')) return 'Supplement02';
      if (n.includes('SERUM') || n.includes('SUNCREAM') || n.includes('TONER') || n.includes('CREAM') || n.includes('APPLE') || n.includes('ZINC')) return 'Cosmetic';
      return 'Supplement';
    };

    // Product by Gen detailed breakdown
    const productSummary = {};

    // Process Personal Sales for Earnings & Margin
    let personalTotalMarginTHB = 0;
    personalSalesList.forEach(s => {
      const items = unpackItems(s);
      items.forEach(it => {
        const pName = String(it.prod || it.productName || it.name || 'Unknown').trim();
        const cleanName = cleanProdName(pName);
        const q = Number(it.qty || it.quantity || 1);
        const typeStr = String(it.type || it.priceType || '').trim();
        const typeLower = typeStr.toLowerCase();
        const isPromoOrZero = typeStr.includes('โปร') || typeStr.includes('ศูนย์') || typeLower.includes('promo') || typeLower.includes('zero') || typeLower.includes('free');

        const rawId = safeUpper(it.productId || it.product_id || "");
        const prodConfig = (rawId && productLookup.get(rawId)) || productLookup.get(cleanName) || productLookup.get(safeUpper(pName)) || {};
        const catKey = getCatKey(prodConfig, pName);

        if (typeStr === 'ราคาเต็ม') {
          personalCategorized[catKey].fullQty += q;
          const margin = Number(prodConfig.full_margin_amount ?? prodConfig.fullMarginAmount ?? 0);
          personalCategorized[catKey].marginLAK += q * margin;
          personalTotalMarginTHB += q * margin;
        } else if (typeStr === 'ราคาสมาชิก') {
          personalCategorized[catKey].memberQty += q;
        } else if (typeStr === 'ราคาโปร' || typeStr === 'โปรโมชั่น') {
          personalCategorized[catKey].promoQty += q;
        } else if (typeStr === 'ราคาศูนย์' || typeStr === 'ราคาฟรี') {
          personalCategorized[catKey].zeroQty += q;
        }

        if (!isPromoOrZero && isProductEligibleForReferral(prodConfig)) {
          personalCategorized[catKey].totalQty += q;
          const configuredSelfFee = Number(prodConfig.selfFee ?? prodConfig.self_fee ?? prodConfig.directFee ?? prodConfig.level0Fee ?? 0);
          const selfFee = configuredSelfFee > 0 ? configuredSelfFee : (defaultRates[catKey]?.rate || 250000);
          personalCategorized[catKey].totalLAK += q * selfFee;
          personalCategorized[catKey].rate = selfFee;

          if (!productSummary[cleanName]) {
            productSummary[cleanName] = { name: pName, category: personalCategorized[catKey].name, totalQty: 0, totalLAK: 0, byGen: {} };
          }
          productSummary[cleanName].totalQty += q;
          productSummary[cleanName].totalLAK += q * selfFee;
          if (!productSummary[cleanName].byGen[0]) {
            productSummary[cleanName].byGen[0] = { gen: 0, qty: 0, lak: 0 };
          }
          productSummary[cleanName].byGen[0].qty += q;
          productSummary[cleanName].byGen[0].lak += q * selfFee;
        }
      });
    });

    // Process Downline Sales for Team Dividend (by Level 1..N)
    // แสดงเฉพาะชั้น Gen ที่มีลูกทีมจริง (มีถึง Gen ไหน โชว์ถึงแค่ Gen นั้น)
    const maxDownlineLevelWithMembers = downlinesWithLevels.length > 0
      ? Math.max(...downlinesWithLevels.map(d => Number(d.level) || 1))
      : 1;
    const effectiveDisplayLevels = Math.min(maxDownlines, maxDownlineLevelWithMembers);

    const salesByLevelStats = {};
    for (let l = 1; l <= effectiveDisplayLevels; l++) {
      if ((downlinesByLevelCount[l] || 0) > 0 || l === 1) {
        salesByLevelStats[l] = { qty: 0, lak: 0, members: downlinesByLevelCount[l] || 0 };
      }
    }

    downlineSalesList.forEach(s => {
      const sellerId = safeUpper(s.sellerId || s.seller_id || s.seller || s.memberId || s.marketing);
      const sellerLevel = downlineLevelMap[sellerId] || 1;
      if (sellerLevel > maxDownlines) return;

      const items = unpackItems(s);
      items.forEach(it => {
        const pName = String(it.prod || it.productName || it.name || 'Unknown').trim();
        const cleanName = cleanProdName(pName);
        const q = Number(it.qty || it.quantity || 1);
        const typeStr = String(it.type || it.priceType || '').trim();
        const typeLower = typeStr.toLowerCase();
        const isPromoOrZero = typeStr.includes('โปร') || typeStr.includes('ศูนย์') || typeLower.includes('promo') || typeLower.includes('zero') || typeLower.includes('free');

        const rawId = safeUpper(it.productId || it.product_id || '');
        const prodConfig = (rawId && productLookup.get(rawId)) || productLookup.get(cleanName) || productLookup.get(safeUpper(pName)) || {};
        const catKey = getCatKey(prodConfig, pName);

        if (typeStr === 'ราคาเต็ม') {
          downlineCategorized[catKey].fullQty += q;
        } else if (typeStr === 'ราคาสมาชิก') {
          downlineCategorized[catKey].memberQty += q;
        } else if (typeStr === 'ราคาโปร' || typeStr === 'โปรโมชั่น') {
          downlineCategorized[catKey].promoQty += q;
        } else if (typeStr === 'ราคาศูนย์' || typeStr === 'ราคาฟรี') {
          downlineCategorized[catKey].zeroQty += q;
        }

        if (isPromoOrZero) return;
        if (!isProductEligibleForReferral(prodConfig)) return;

        let feePerBox = 0;
        if (sellerLevel === 1) {
          const configuredL1Fee = Number(prodConfig.level1Fee ?? prodConfig.level_1_fee ?? prodConfig.uplineFee ?? 0);
          feePerBox = configuredL1Fee > 0 ? configuredL1Fee : (defaultRates[catKey]?.l1Rate || 200000);
          if (feePerBox > 0) {
            downlineCategorized[catKey].l1Rate = feePerBox;
          }
        } else {
          feePerBox = Number(prodConfig[`level${sellerLevel}Fee`] ?? prodConfig[`level_${sellerLevel}_fee`] ?? 0);
        }

        const earnLAK = meetCommCondition ? (q * feePerBox) : 0;

        downlineCategorized[catKey].totalQty += q;
        downlineCategorized[catKey].totalLAK += earnLAK;

        if (salesByLevelStats[sellerLevel]) {
          salesByLevelStats[sellerLevel].qty += q;
          salesByLevelStats[sellerLevel].lak += earnLAK;
        }

        if (!productSummary[cleanName]) {
          productSummary[cleanName] = { name: pName, category: downlineCategorized[catKey].name, totalQty: 0, totalLAK: 0, byGen: {} };
        }
        productSummary[cleanName].totalQty += q;
        productSummary[cleanName].totalLAK += earnLAK;
        if (!productSummary[cleanName].byGen[sellerLevel]) {
          productSummary[cleanName].byGen[sellerLevel] = { gen: sellerLevel, qty: 0, lak: 0 };
        }
        productSummary[cleanName].byGen[sellerLevel].qty += q;
        productSummary[cleanName].byGen[sellerLevel].lak += earnLAK;
      });
    });

    // คำนวณเรทเฉลี่ยหรือเรทตามหมวดให้ถูกต้อง ไม่เป็น 0 LAK
    Object.keys(personalCategorized).forEach(k => {
      if (personalCategorized[k].totalQty > 0) {
        personalCategorized[k].rate = Math.round(personalCategorized[k].totalLAK / personalCategorized[k].totalQty);
      } else {
        personalCategorized[k].rate = defaultRates[k]?.rate || 0;
      }
    });

    Object.keys(downlineCategorized).forEach(k => {
      if (!downlineCategorized[k].l1Rate || downlineCategorized[k].l1Rate === 0) {
        downlineCategorized[k].l1Rate = defaultRates[k]?.l1Rate || 0;
      }
    });

    const totalTeamCategorized = {};
    ['Supplement', 'Supplement02', 'Cosmetic', 'Coffee'].forEach(k => {
      const p = personalCategorized[k];
      const d = downlineCategorized[k];
      totalTeamCategorized[k] = {
        key: k,
        name: p.name,
        rate: p.rate,
        l1Rate: p.l1Rate,
        personalQty: p.totalQty,
        personalLAK: p.totalLAK,
        downlineQty: d.totalQty,
        downlineLAK: d.totalLAK,
        fullQty: p.fullQty + d.fullQty,
        memberQty: p.memberQty + d.memberQty,
        promoQty: p.promoQty + d.promoQty,
        zeroQty: p.zeroQty + d.zeroQty,
        totalQty: p.totalQty + d.totalQty,
        totalLAK: p.totalLAK + d.totalLAK
      };
    });

    const personalTotalLAK = Object.values(personalCategorized).reduce((acc, c) => acc + c.totalLAK, 0);
    const downlineTotalLAK = Object.values(downlineCategorized).reduce((acc, c) => acc + c.totalLAK, 0);
    const overallTeamTotalLAK = personalTotalLAK + downlineTotalLAK;
    const downlineTotalBoxes = Object.values(downlineCategorized).reduce((acc, c) => acc + c.totalQty, 0);
    const groupTotalBoxes = personalTotalBoxes + downlineTotalBoxes;

    // Margin qualifications with config
    const marginConfig = (() => {
      try {
        const confStr = systemSettings?.retail_margin_config;
        return confStr ? (typeof confStr === 'string' ? JSON.parse(confStr) : confStr) : null;
      } catch (e) { return null; }
    })();

    const marginMinBoxes = Number(marginConfig?.min_boxes ?? systemSettings?.margin_min_boxes ?? 10);

    const isEligibleForMargin = (() => {
      if (totalFullBoxesPersonal < marginMinBoxes) return false;
      if (!marginConfig) return true;

      const scope = marginConfig.target_scope || 'all';
      const memberIdUpper = safeUpper(mId);
      const memberTeamUpper = safeUpper(mTeam);

      let isScopeEligible = true;
      if (scope === 'specific_members') {
        isScopeEligible = (marginConfig.selected_members || []).map(safeUpper).includes(memberIdUpper);
      } else if (scope === 'specific_teams') {
        isScopeEligible = (marginConfig.selected_teams || []).map(safeUpper).includes(memberTeamUpper);
      }

      if (isScopeEligible) {
        if ((marginConfig.exclude_members || []).map(safeUpper).includes(memberIdUpper)) {
          isScopeEligible = false;
        }
        if ((marginConfig.exclude_teams || []).map(safeUpper).includes(memberTeamUpper)) {
          isScopeEligible = false;
        }
      }
      return isScopeEligible;
    })();

    const levelSummaryParts = Object.entries(downlinesByLevelCount).map(([lvl, cnt]) => `ชั้น ${lvl}: ${cnt} คน`);
    const levelSummaryText = levelSummaryParts.length > 0 ? levelSummaryParts.join(', ') : 'ไม่มีลูกทีม';

    return {
      memberId: mId,
      memberName: member.name,
      team: mTeam,
      isLeaderWithTeam: downlinesWithLevels.length > 0,
      downlinesWithLevels,
      downlineLevelMap,
      downlinesByLevelCount,
      levelSummaryText,
      personalSalesCount: personalSalesList.length,
      downlineSalesCount: downlineSalesList.length,

      // Box totals
      personalTotalBoxes,
      downlineTotalBoxes,
      totalFullBoxesPersonal,
      totalMemberBoxesPersonal,
      totalPromoBoxesPersonal,
      totalZeroBoxesPersonal,

      totalFullBoxes: totalFullBoxesPersonal + totalFullBoxesTeam,
      totalMemberBoxes: totalMemberBoxesPersonal + totalMemberBoxesTeam,
      totalPromoBoxes: totalPromoBoxesPersonal + totalPromoBoxesTeam,
      totalZeroBoxes: totalZeroBoxesPersonal + totalZeroBoxesTeam,
      groupTotalBoxes,

      // Dividend earnings (LAK)
      meetCommCondition,
      personalTotalLAK,
      downlineTotalLAK,
      overallTeamTotalLAK,

      // Margin earnings (THB)
      personalTotalMarginTHB,
      marginMinBoxes,
      isEligibleForMargin,

      // PV
      memberAccumulatedPV: personalTotalBoxes,

      // System levels
      maxCommLevels,
      maxDownlines,

      // Breakdown tables
      catMap: personalCategorized,
      personalCategorized,
      downlineCategorized,
      totalTeamCategorized,
      salesByLevelStats,
      productSummaryMap: Object.values(productSummary).sort((a, b) => b.totalQty - a.totalQty),
    };
  }

  // ─── 4. Sales Unfolding & Processing ───────────────────────────

  function processOrgChartSales(rawSales) {
    if (!Array.isArray(rawSales)) return [];
    return rawSales.map(s => {
      let sumF = 0, sumP = 0, sumZ = 0, sumM = 0;
      let itemsList = [];
      if (s.items_json) {
        try { itemsList = typeof s.items_json === 'string' ? JSON.parse(s.items_json) : s.items_json; } catch (e) {}
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
          else if (typeStr === 'ราคาศูนย์' || typeStr === 'ราคาฟรี') sumZ += qtyNum;
          else sumM += qtyNum;
        });
      } else {
        Object.keys(s).forEach(k => {
          if (k !== 'รวมชิ้นราคาเต็ม' && k !== 'รวมชิ้นราคาโปร' && k !== 'รวมชิ้นราคาศูนย์' && k !== 'ยอดรวมชิ้นทั้งหมด') {
            if (k.endsWith('_ราคาเต็ม')) sumF += (parseInt(s[k]) || 0);
            else if (k.endsWith('_ราคาโปร')) sumP += (parseInt(s[k]) || 0);
            else if (k.endsWith('_ราคาศูนย์')) sumZ += (parseInt(s[k]) || 0);
            else if (k.endsWith('_ราคาสมาชิก')) sumM += (parseInt(s[k]) || 0);
          }
        });
      }
      s['รวมชิ้นราคาเต็ม'] = sumF;
      s['รวมชิ้นราคาโปร'] = sumP;
      s['รวมชิ้นราคาศูนย์'] = sumZ;
      s['รวมชิ้นราคาสมาชิก'] = sumM;
      s['ยอดรวมชิ้นทั้งหมด'] = sumF + sumM + sumP + sumZ;

      const cleanSeller = safeUpper(s.seller_id || s.sellerId || s.seller || s.memberId || s.marketing_name || s.marketing);
      s['memberId'] = cleanSeller;
      s['sellerId'] = cleanSeller;

      return {
        ...s,
        id: s.id || s.sale_id,
        date: s.date || s.sale_date,
        marketing: cleanSeller,
        seller: cleanSeller,
        customerName: s.customer_name || s.customerName
      };
    });
  }

  function formatOrgChartMembers(rawMembers) {
    if (!Array.isArray(rawMembers)) return [];
    return rawMembers.map(m => ({
      id: String(m.id || m.user_id || m.User_ID || '').trim(),
      name: String(m.name || m.Name || '').trim(),
      referrer: String(m.referrer || m.sponsor_id || m.Sponsor_ID || '').trim(),
      team: String(m.team || m.business_team || m.Business_Team || 'Marketing').trim(),
      role: String(m.role || m.permission_role || m.Permission_Role || 'พนักงานทั่วไป').trim(),
      status: String(m.status || m.Status || 'ทำงานอยู่').trim(),
      profileUrl: m.profile_url || m.id_card_url || m.ID_Card_URL || '',
      phone: m.phone || m.phone_number || m.Phone_Number || '',
      email: m.email || m.Email || '',
      lineId: m.line_id || m.LINE_ID || '',
      accumulatedPV: Number(m.accumulated_pv || m.Accumulated_PV || 0)
    })).filter(m => m.id !== '');
  }

  function formatOrgChartProducts(rawProducts) {
    if (!Array.isArray(rawProducts)) return [];
    return rawProducts.map(p => {
      let margin = { amount: 0, currency: 'LAK' };
      if (p.full_margin) {
        try {
          margin = typeof p.full_margin === 'string' ? JSON.parse(p.full_margin) : p.full_margin;
        } catch (e) {}
      }
      return {
        ...p,
        id: String(p.id || p.product_id || '').trim(),
        name: String(p.name || p.product_name || '').trim(),
        category: String(p.category || '').trim(),
        self_fee: Number(p.self_fee || p.selfFee || p.Self_Fee || p.SelfFee || 0),
        level_1_fee: Number(p.level_1_fee || p.level1Fee || p.Level_1_Fee || p.Level1Fee || 0),
        level_2_fee: Number(p.level_2_fee || p.level2Fee || p.Level_2_Fee || 0),
        level_3_fee: Number(p.level_3_fee || p.level3Fee || p.Level_3_Fee || 0),
        level_4_fee: Number(p.level_4_fee || p.level4Fee || p.Level_4_Fee || 0),
        level_5_fee: Number(p.level_5_fee || p.level5Fee || p.Level_5_Fee || 0),
        price_full: Number(p.price_full ?? p.priceFull ?? 0),
        price_member: Number(p.price_member ?? p.priceMember ?? 0),
        full_margin_amount: Number(margin.amount ?? 0),
        full_margin_currency: margin.currency || 'LAK'
      };
    });
  }

  function buildTeamMap(businessTeams) {
    const map = {};
    (businessTeams || []).forEach(t => {
      const idKey = safeUpper(t.id || t.team_id || t.code);
      const nameStr = t.name || t.team_name || t.Team_Name || idKey;
      if (idKey) map[idKey] = nameStr;
    });
    return map;
  }

  // ─── 5. Export Engine to Global Scope ──────────────────────────

  window.OrgChartLogic = {
    safeUpper,
    getChildren,
    getAllDownlineIds,
    getDownlinesWithLevels,
    calculateGroupSales,
    resolveTeamName,
    getDefaultMonthRange,
    cleanProdName,
    isProductEligibleForReferral,
    extractCommissionConfig,
    checkCommissionCondition,
    calculateMemberPerformanceDetails,
    processOrgChartSales,
    formatOrgChartMembers,
    formatOrgChartProducts,
    buildTeamMap
  };

  console.log('%c🔀 OrgChartLogic Engine loaded successfully', 'color:#3b82f6;font-weight:bold');

})(window);
