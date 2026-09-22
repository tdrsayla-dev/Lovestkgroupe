/**
 * ================================================================
 * 📊 mlmLogic.js — STK MLM & Dashboard Business Logic Engine
 * LOVE STK GROUPE - Dashboard Calculation & Data Processing Engine
 * ================================================================
 */

(function (window) {
  'use strict';

  // ─── 1. Utilities & Normalization Helpers ──────────────────────

  const safeUpper = (str) => String(str || '').trim().toUpperCase();

  const cleanAvatarUrl = (url, name) => {
    let cleanUrl = String(url || '').trim();
    if (!cleanUrl || cleanUrl === 'undefined' || cleanUrl === 'null' || cleanUrl === '-') {
      return `https://ui-avatars.com/api/?name=${encodeURIComponent(name || 'User')}&background=1e293b&color=cbd5e1&rounded=true&bold=true`;
    }
    if (cleanUrl.includes('drive.google.com')) {
      const match = cleanUrl.match(/[-\w]{25,}/);
      const fileId = match ? match[0] : '';
      if (fileId) cleanUrl = 'https://drive.google.com/thumbnail?id=' + fileId + '&sz=w300';
    }
    return cleanUrl;
  };

  const getDefaultMonthRange = () => {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const lastDay = new Date(y, now.getMonth() + 1, 0).getDate();
    return { start: `${y}-${m}-01`, end: `${y}-${m}-${String(lastDay).padStart(2, '0')}` };
  };

  const parseSaleDate = (s) => String(s?.date || s?.created_at || s?.sale_date || '').trim().substring(0, 10);
  const parseSaleMemberId = (s) => s?.memberId || s?.member_id || s?.sellerId || s?.seller_id;
  const parseSaleBoxes = (s) => {
    // แก้บั๊กไม่ให้ระบบดึงยอดเก่าที่ผิดพลาดในฐานข้อมูลมาแสดงเมื่อคำนวณได้ 0
    const fQty = s?.['รวมชิ้นราคาเต็ม'] !== undefined ? Number(s['รวมชิ้นราคาเต็ม']) : Number(s?.fullQty || s?.full_qty || s?.full_boxes || 0);
    const mQty = s?.['รวมชิ้นราคาสมาชิก'] !== undefined ? Number(s['รวมชิ้นราคาสมาชิก']) : Number(s?.memberQty || s?.member_qty || s?.member_boxes || 0);
    return fQty + mQty;
  };

  const findSaleCustomer = (s, customersList) => {
    const sCustId = safeUpper(s?.customerId || s?.customer_id || s?.hn || s?.customerHn || '');
    const sCustName = safeUpper(s?.customerName || s?.customer_name || '');
    return (customersList || []).find(c => {
      if (!c) return false;
      const cId = safeUpper(c.id || c.customer_id || c.hn || '');
      const cName = safeUpper(c.name || c.customer_name || '');
      if (sCustId && cId && sCustId === cId) return true;
      if (sCustName && cName && sCustName === cName) return true;
      return false;
    });
  };

  const mapPageToHtml = (urlStr) => {
    try {
      const url = new URL(urlStr, window.location.origin);
      const page = url.searchParams.get('page') || 'dashboard';
      const search = url.search;
      const pageMap = {
        'dashboard': 'Mlm.html',
        'org_chart': 'OrgChart.html',
        'sales': 'Sales.html',
        'nutrients': 'Nutrients.html',
        'orders': 'Orders.html',
        'customers': 'Customers.html',
        'system_users': 'SystemUsers.html',
        'team': 'Team.html',
        'stock': 'Stock.html',
        'customer_types': 'CustomerTypes.html',
        'closers': 'Closers.html',
        'exchange_rate': 'ExchangeRate.html',
        'reports': 'Reports.html'
      };
      return (pageMap[page] || 'Mlm.html') + search;
    } catch (e) {
      return 'Mlm.html';
    }
  };

  // ─── 2. Data Formatting for State Storage ───────────────────────

  const formatCustomerTypes = (types, fallbackTypes = []) => {
    if (!Array.isArray(types)) return fallbackTypes;
    const formatted = types.map(ct => ({
      id: String(ct.id || ct.type_id || ct.Type_ID || '').trim(),
      name: String(ct.name || ct.type_name || ct.Name || '').trim(),
      status: String(ct.status || ct.Status || 'ใช้งาน').trim()
    })).filter(ct => ct.name !== '');
    return formatted.length > 0 ? formatted : fallbackTypes;
  };

  const formatMembers = (members) => {
    if (!Array.isArray(members)) return [];
    return members.map(m => ({
      id: String(m.id || m.user_id || m.User_ID || '').trim(),
      name: String(m.name || m.Name || '').trim(),
      referrer: String(m.referrer || m.sponsor_id || m.Sponsor_ID || '').trim(),
      team: String(m.team || m.business_team || m.Business_Team || 'Marketing').trim(),
      role: String(m.role || m.permission_role || m.Permission_Role || 'Staff').trim(),
      status: String(m.status || m.Status || 'ทำงานอยู่').trim(),
      profileUrl: m.profile_url || m.id_card_url || m.ID_Card_URL || '',
      phone: m.phone || m.phone_number || m.Phone_Number || '',
      email: m.email || m.Email || '',
      lineId: m.line_id || m.LINE_ID || '',
      bankName: m.bank_name || m.Bank_Name || '',
      bankAccountNo: m.bank_account_no || m.Bank_Account_No || '',
      bankAccountName: m.bank_account_name || m.Bank_Account_Name || '',
      accumulatedPV: Number(m.accumulated_pv || m.Accumulated_PV || 0)
    })).filter(m => m.id !== '');
  };

  const formatCustomers = (customers) => {
    if (!Array.isArray(customers)) return [];
    return customers.map(c => ({
      ...c,
      id: String(c.id || c.customer_id || c.hn || '').trim(),
      name: String(c.name || c.customer_name || '').trim(),
      type: String(c.type || c.customer_type || c.customerType || '').trim(),
      memberId: String(c.memberId || c.member_id || c.owner_member_id || '').trim()
    }));
  };

  const formatBusinessTeams = (teams) => {
    if (!Array.isArray(teams)) return [];
    return teams.map(t => ({
      ...t,
      id: String(t.id || t.team_id || t.Team_ID || '').trim(),
      name: String(t.name || t.team_name || t.Team_Name || t.TeamName || '').trim(),
      status: String(t.status || t.Status || 'ใช้งาน').trim()
    }));
  };

   // ─── 2.5 Auto-Correct Classification Helper ──────────────────────
  function classifyOrderItem(it, prodMapObj = {}) {
      const rawPrice = (it.price !== undefined && it.price !== null && String(it.price).trim() !== '' && !isNaN(Number(it.price)))
          ? Number(it.price)
          : ((it.unitPrice !== undefined && it.unitPrice !== null && String(it.unitPrice).trim() !== '' && !isNaN(Number(it.unitPrice))) ? Number(it.unitPrice) : null);
      
      const typeStr = String(it.type || it.priceType || '').trim().toLowerCase();
      const pName = String(it.prod || it.productName || it.name || '').trim();
      const cleanPName = pName.replace(/\(.*?\)/g, '').trim();
      const pNameLower = pName.toLowerCase();

      // รองรับการทำงานทั้งแบบ Map และ Object ปกติ
      let pObj = {};
      if (typeof prodMapObj.get === 'function') {
          pObj = (it.id && prodMapObj.get(safeUpper(it.id))) || (it.product_id && prodMapObj.get(safeUpper(it.product_id))) || prodMapObj.get(safeUpper(pName)) || prodMapObj.get(safeUpper(cleanPName)) || {};
      } else {
          pObj = (it.id && prodMapObj[safeUpper(it.id)]) || (it.product_id && prodMapObj[safeUpper(it.product_id)]) || prodMapObj[safeUpper(pName)] || prodMapObj[safeUpper(cleanPName)] || {};
      }

      const pFull = Number(pObj.price_full ?? pObj.priceFull ?? 0);
      const pMember = Number(pObj.price_member ?? pObj.priceMember ?? 0);
      const pPromo = Number(pObj.price_promo ?? pObj.pricePromo ?? 0);

      // 1. ให้ความสำคัญกับคำในชื่อสินค้ามากที่สุด
      if (pNameLower.includes('(แถม)') || pNameLower.includes('(ฟรี)') || pNameLower.includes('(ศูนย์)') || pNameLower.includes('(ຟຣີ)') || pNameLower.includes('(ແຖມ)')) return 'ราคาศูนย์';
      if (pNameLower.includes('(โปร)') || pNameLower.includes('(โบร)') || pNameLower.includes('(ໂປຣ)') || pNameLower.includes('ພິເສດ')) return 'ราคาโปร';
      if (pNameLower.includes('(สมาชิก)') || pNameLower.includes('(ส่ง)') || pNameLower.includes('(ສະມາຊິກ)') || pNameLower.includes('(ສົ່ງ)') || pNameLower.includes('ວີໄອພີ')) return 'ราคาสมาชิก';
      if (pNameLower.includes('(เต็ม)') || pNameLower.includes('(ปกติ)') || pNameLower.includes('(ປົກກະຕິ)') || pNameLower.includes('(ເຕັມ)')) return 'ราคาเต็ม';

      // 2. ตรวจสอบราคาขายจริง (ให้ความสำคัญกับ ราคาสมาชิก และ ราคาเต็ม ก่อนราคาโปร ป้องกันยอดตก)
      if (rawPrice !== null) {
          if (rawPrice === 0) return 'ราคาศูนย์';
          if (pMember > 0 && Math.abs(rawPrice - pMember) < 0.01) return 'ราคาสมาชิก';
          if (pFull > 0 && Math.abs(rawPrice - pFull) < 0.01) return 'ราคาเต็ม';
          if (pPromo > 0 && Math.abs(rawPrice - pPromo) < 0.01) return 'ราคาโปร';
      }

      // 3. ตรวจสอบจากช่องประเภท (Type)
      let pType = 'ราคาเต็ม';
      if (typeStr.includes('ศูนย์') || typeStr.includes('ฟรี') || typeStr.includes('แถม') || typeStr.includes('ຟຣີ') || typeStr.includes('ແຖມ') || typeStr === 'zero' || typeStr === 'free') pType = 'ราคาศูนย์';
      else if (typeStr.includes('โปร') || typeStr.includes('promo') || typeStr.includes('พิเศษ') || typeStr.includes('ໂປຣ') || typeStr.includes('ພິເສດ')) pType = 'ราคาโปร';
      else if (typeStr.includes('สมาชิก') || typeStr.includes('member') || typeStr.includes('ส่ง') || typeStr.includes('vip') || typeStr.includes('ສະມາຊິກ') || typeStr.includes('ສົ່ງ') || typeStr.includes('ວີໄອພີ')) pType = 'ราคาสมาชิก';
      else if (typeStr.includes('เต็ม') || typeStr.includes('ปกติ') || typeStr.includes('full') || typeStr.includes('normal') || typeStr.includes('ປົກກະຕິ') || typeStr.includes('ເຕັມ')) pType = 'ราคาเต็ม';

      // 4. AUTO-CORRECT
      const hasProductData = !!(pObj.id || pObj.product_id);
      if (hasProductData) {
          if (pType === 'ราคาโปร' && pPromo === 0) {
              return pMember > 0 ? 'ราคาสมาชิก' : 'ราคาเต็ม';
          }
          if (pType === 'ราคาสมาชิก' && pMember === 0) {
              return pFull > 0 ? 'ราคาเต็ม' : 'ราคาเต็ม';
          }
      }

      return pType;
  }
  // ─── 3. Sales Rows Processing ──────────────────────────────────
  const processSalesRows = (rawSales, productsList = []) => {
    if (!Array.isArray(rawSales)) return [];

    // สร้าง Map สินค้าเพื่อป้อนให้ Auto-Correct
    const prodMap = {};
    (productsList || []).forEach(p => {
        if (p.id) prodMap[safeUpper(p.id)] = p;
        if (p.product_id) prodMap[safeUpper(p.product_id)] = p;
        if (p.name) prodMap[safeUpper(p.name)] = p;
        if (p.name) prodMap[safeUpper(p.name.replace(/\(.*?\)/g, '').trim())] = p;
    });

    return rawSales.map(s => {
      let sumF = 0, sumP = 0, sumZ = 0, sumM = 0;
      let itemsList = [];
      if (s.items_json) {
        try { itemsList = typeof s.items_json === 'string' ? JSON.parse(s.items_json) : s.items_json; } catch(e){}
      }
      
      if (Array.isArray(itemsList) && itemsList.length > 0) {
        itemsList.forEach(it => {
          const typeStr = classifyOrderItem(it, prodMap);
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
          if (k !== 'รวมชิ้นราคาเต็ม' && k !== 'รวมชิ้นราคาโปร' && k !== 'รวมชิ้นราคาศูนย์' && k !== 'ยอดรวมชิ้นทั้งหมด') {
            const qty = parseInt(s[k]) || 0;
            if (qty > 0) {
                const cleanProdName = (raw) => raw.replace(/\(.*?\)/g, '').trim();
                let pName = ''; let legacyType = '';
                
                if (k.endsWith('_ราคาเต็ม')) { pName = cleanProdName(k.replace('_ราคาเต็ม', '')); legacyType = 'ราคาเต็ม'; }
                else if (k.endsWith('_ราคาสมาชิก')) { pName = cleanProdName(k.replace('_ราคาสมาชิก', '')); legacyType = 'ราคาสมาชิก'; }
                else if (k.endsWith('_ราคาโปร')) { pName = cleanProdName(k.replace('_ราคาโปร', '')); legacyType = 'ราคาโปร'; }
                else if (k.endsWith('_ราคาศูนย์')) { pName = cleanProdName(k.replace('_ราคาศูนย์', '')); legacyType = 'ราคาศูนย์'; }
                
                if (pName) {
                    const correctType = classifyOrderItem({ prod: pName, type: legacyType }, prodMap);
                    if (correctType === 'ราคาเต็ม') sumF += qty;
                    else if (correctType === 'ราคาสมาชิก') sumM += qty;
                    else if (correctType === 'ราคาโปร') sumP += qty;
                    else if (correctType === 'ราคาศูนย์') sumZ += qty;
                }
            }
          }
        });
      }
      s['รวมชิ้นราคาเต็ม'] = sumF; s['รวมชิ้นราคาโปร'] = sumP; s['รวมชิ้นราคาศูนย์'] = sumZ; s['รวมชิ้นราคาสมาชิก'] = sumM;
      s['ยอดรวมชิ้นทั้งหมด'] = sumF + sumM + sumP + sumZ;
      s['memberId'] = s.memberId || s.sellerId || s.seller_id || s.seller || s.marketing_name || s.marketing;
      s['sellerId'] = s.sellerId || s.seller_id || s.seller || s.memberId || s.marketing_name || s.marketing;
      return {
        ...s,
        id: s.id || s.sale_id || s.order_id,
        orderId: s.order_id || s.id,
        date: s.date || s.sale_date,
        marketing: s.marketing_name || s.marketing || s.seller_id,
        seller: s.seller_id || s.marketing_name || s.marketing || s.seller || s.memberId,
        sellerId: s.seller_id || s.memberId,
        memberId: s.memberId || s.seller_id || s.seller,
        customerId: s.customer_id || s.customerId || s.hn || '',
        customerName: s.customer_name || s.customerName || '',
        customerType: s.customer_type || s.customerType || ''
      };
    });
  };
  // ─── 4. Active Teams & Members Filters ──────────────────────────

  const filterActiveBusinessTeams = (businessTeams) => {
    if (Array.isArray(businessTeams) && businessTeams.length > 0) {
      return businessTeams.filter(t => t && t.status !== 'ปิดเข้าใช้งาน' && t.status !== 'ปิดใช้งาน' && t.status !== 'Disabled');
    }
    return [
      { id: 'T001', name: 'Marketing', status: 'ใช้งาน' },
      { id: 'T002', name: 'Center', status: 'ใช้งาน' }
    ];
  };

  const filterActiveTeamMembers = (members, businessTeams) => {
    const disabledTeamKeys = new Set(
      (businessTeams || [])
        .filter(t => t && (t.status === 'ปิดเข้าใช้งาน' || t.status === 'ปิดใช้งาน' || t.status === 'Disabled'))
        .map(t => [t.id, t.name, String(t.id || '').toUpperCase(), String(t.name || '').toUpperCase()])
        .flat()
    );

    return (members || []).filter(m => {
      if (!m) return false;
      const memTeam = String(m.team || '').trim().toUpperCase();
      if (memTeam && disabledTeamKeys.has(memTeam)) return false;
      return true;
    });
  };

  // ─── 5. Analytics & Dashboard Calculations ─────────────────────

  const calcTeamStats = ({ sales, members, activeBusinessTeams, activeTeamMembers, dashStartDate, dashEndDate, customMemberTargets, globalIndividualTarget }) => {
    const teamSalesMap = {};
    (activeBusinessTeams || []).forEach(t => {
      teamSalesMap[t.id] = 0;
      teamSalesMap[t.name] = 0;
    });

    let mTargetData = {};
    (activeTeamMembers || []).forEach(m => {
      if (m && m.id) {
        const targetVal = customMemberTargets && customMemberTargets[m.id] !== undefined 
          ? customMemberTargets[m.id] 
          : (Number(globalIndividualTarget) || 200);
        mTargetData[m.id] = { id: m.id, name: m.name, team: m.team || '', actual: 0, target: targetVal };
      }
    });

    const filteredSales = (sales || []).filter(s => s && (s.date || '') >= dashStartDate && (s.date || '') <= dashEndDate);
    filteredSales.forEach(s => {
      const fullQty = Number(s['รวมชิ้นราคาเต็ม'] || 0);
      const memQty = Number(s['รวมชิ้นราคาสมาชิก'] || 0);
      const countedBoxes = fullQty + memQty;
      if (countedBoxes === 0) return;

      const mem = (members || []).find(m => m && safeUpper(m.id || m.user_id) === safeUpper(s.memberId || s.sellerId));
      if (mem) {
        const memTeam = String(mem.team || mem.business_team || mem.businessTeam || '').trim().toUpperCase();
        (activeBusinessTeams || []).forEach(bt => {
          if (!bt) return;
          const btId = String(bt.id || '').toUpperCase();
          const btName = String(bt.name || '').toUpperCase();
          if (
            (btId && memTeam === btId) || 
            (btName && memTeam === btName) ||
            (btId === 'T01' && (memTeam === 'MARKETING' || memTeam === 'TEAM A')) ||
            (btId === 'T02' && (memTeam === 'CENTER' || memTeam === 'TEAM B')) ||
            (btName.includes('MARKETING') && (memTeam === 'T01' || memTeam === 'TEAM A')) ||
            (btName.includes('CENTER') && (memTeam === 'T02' || memTeam === 'TEAM B'))
          ) {
            teamSalesMap[bt.id] = (teamSalesMap[bt.id] || 0) + countedBoxes;
          }
        });
        if (mTargetData[mem.id]) mTargetData[mem.id].actual += countedBoxes;
      }
    });

    const palette = [
      { text: "text-blue-400", stroke: "#3b82f6", glow: "rgba(59,130,246,0.6)", bg: "bg-blue-600/20", border: "border-blue-500/40", hoverBg: "group-hover:bg-blue-600" },
      { text: "text-rose-500", stroke: "#f43f5e", glow: "rgba(244,63,94,0.6)", bg: "bg-rose-600/20", border: "border-rose-500/40", hoverBg: "group-hover:bg-rose-600" },
      { text: "text-amber-400", stroke: "#f59e0b", glow: "rgba(245,158,11,0.6)", bg: "bg-amber-600/20", border: "border-amber-500/40", hoverBg: "group-hover:bg-amber-600" },
      { text: "text-emerald-400", stroke: "#10b981", glow: "rgba(16,185,129,0.6)", bg: "bg-emerald-600/20", border: "border-emerald-500/40", hoverBg: "group-hover:bg-emerald-600" },
      { text: "text-purple-400", stroke: "#8b5cf6", glow: "rgba(139,92,246,0.6)", bg: "bg-purple-600/20", border: "border-purple-500/40", hoverBg: "group-hover:bg-purple-600" },
      { text: "text-cyan-400", stroke: "#06b6d4", glow: "rgba(6,182,212,0.6)", bg: "bg-cyan-600/20", border: "border-cyan-500/40", hoverBg: "group-hover:bg-cyan-600" }
    ];

    const teamsList = (activeBusinessTeams || []).map((bt, index) => ({
      id: bt.id,
      name: bt.name,
      totalSales: teamSalesMap[bt.id] || teamSalesMap[bt.name] || 0,
      style: palette[index % palette.length]
    }));

    return { teamsList, memberTargetData: Object.values(mTargetData).sort((a, b) => b.actual - a.actual) };
  };

  const calcTeamTopStats = ({ sales, members, activeBusinessTeams, customers, dashStartDate, dashEndDate }) => {
    const map = {};
    (activeBusinessTeams || []).forEach(t => {
      map[t.id] = { 
        id: t.id, 
        name: t.name, 
        full: 0, mem: 0, promo: 0, zero: 0, totalBoxes: 0, 
        newCustSet: new Set(), totalCheckups: 0
      };
    });

    const filteredSales = (sales || []).filter(s => s && (s.date || '') >= dashStartDate && (s.date || '') <= dashEndDate);
    filteredSales.forEach(s => {
      const mem = (members || []).find(m => m && safeUpper(m.id || m.user_id) === safeUpper(s.memberId || s.sellerId));
      if (!mem) return;
      
      const memTeam = String(mem.team || mem.business_team || mem.businessTeam || '').trim().toUpperCase();
      let targetTeamId = null;
      
      (activeBusinessTeams || []).forEach(bt => {
        const btId = String(bt.id || '').toUpperCase();
        const btName = String(bt.name || '').toUpperCase();
        if (
          (btId && memTeam === btId) || 
          (btName && memTeam === btName) ||
          (btId === 'T01' && (memTeam === 'MARKETING' || memTeam === 'TEAM A')) ||
          (btId === 'T02' && (memTeam === 'CENTER' || memTeam === 'TEAM B')) ||
          (btName.includes('MARKETING') && (memTeam === 'T01' || memTeam === 'TEAM A')) ||
          (btName.includes('CENTER') && (memTeam === 'T02' || memTeam === 'TEAM B'))
        ) {
          targetTeamId = bt.id;
        }
      });

      if (targetTeamId && map[targetTeamId]) {
        const fQty = Number(s['รวมชิ้นราคาเต็ม'] || 0);
        const mQty = Number(s['รวมชิ้นราคาสมาชิก'] || 0);
        const pQty = Number(s['รวมชิ้นราคาโปร'] || 0);
        const sumBoxes = fQty + mQty + pQty;

        if (sumBoxes > 0) {
          map[targetTeamId].full += fQty;
          map[targetTeamId].mem += mQty;
          map[targetTeamId].promo += pQty;
          map[targetTeamId].totalBoxes += sumBoxes;
        }

        const custId = safeUpper(s.customerId || s.customer_id || s.hn || s.customerName || s.customer_name || '');
        let cType = String(s.customerType || s.customer_type || '').trim();
        if (!cType && customers) {
          const cust = findSaleCustomer(s, customers);
          if (cust) {
            cType = String(cust.type || cust.customer_type || cust.customerType || '').trim();
          }
        }
        const isNew = (cType.includes('ตรวจ') || cType.includes('ปรึกษา') || (cType.includes('ใหม่') && !cType.includes('ไม่มาตรวจ'))) && !cType.includes('เก่า');
        
        if (isNew && custId) {
          map[targetTeamId].newCustSet.add(custId);
        }
      }
    });

    const palette = [
      { text: "text-blue-400", checkupText: "text-blue-300", strokeLeft: "#3b82f6", strokeRight: "#93c5fd", bg: "bg-blue-600/20", border: "border-blue-500/40", hoverBg: "group-hover:bg-blue-600" },
      { text: "text-rose-500", checkupText: "text-rose-300", strokeLeft: "#f43f5e", strokeRight: "#fda4af", bg: "bg-rose-600/20", border: "border-rose-500/40", hoverBg: "group-hover:bg-rose-600" },
      { text: "text-amber-400", checkupText: "text-amber-300", strokeLeft: "#f59e0b", strokeRight: "#fcd34d", bg: "bg-amber-600/20", border: "border-amber-500/40", hoverBg: "group-hover:bg-amber-600" },
      { text: "text-emerald-400", checkupText: "text-emerald-300", strokeLeft: "#10b981", strokeRight: "#6ee7b7", bg: "bg-emerald-600/20", border: "border-emerald-500/40", hoverBg: "group-hover:bg-emerald-600" },
      { text: "text-purple-400", checkupText: "text-purple-300", strokeLeft: "#8b5cf6", strokeRight: "#c4b5fd", bg: "bg-purple-600/20", border: "border-purple-500/40", hoverBg: "group-hover:bg-purple-600" },
      { text: "text-cyan-400", checkupText: "text-cyan-300", strokeLeft: "#06b6d4", strokeRight: "#67e8f9", bg: "bg-cyan-600/20", border: "border-cyan-500/40", hoverBg: "group-hover:bg-cyan-600" }
    ];
    
    return Object.values(map).map((t, idx) => ({
      ...t, 
      totalCheckups: t.newCustSet.size,
      style: palette[idx % palette.length]
    }));
  };

  const calcTopPerformanceData = ({ sales, customers, members, dashStartDate, dashEndDate }) => {
    let mStats = {};
    (members || []).forEach(m => {
      if (m && (m.id || m.user_id)) {
        const key = safeUpper(m.id || m.user_id);
        mStats[key] = { id: m.id || m.user_id, name: m.name || m.id, profileUrl: m.profileUrl, newCustSet: new Set(), totalFullBoxes: 0, oldFullBoxes: 0 };
      }
    });

    const filteredSales = (sales || []).filter(s => {
      if (!s) return false;
      const dStr = parseSaleDate(s);
      return dStr >= dashStartDate && dStr <= dashEndDate;
    });

    filteredSales.forEach(s => {
      const memberId = parseSaleMemberId(s);
      if (!memberId) return;
      const key = safeUpper(memberId);
      if (!mStats[key]) {
        const mem = (members || []).find(m => m && safeUpper(m.id || m.user_id) === key);
        mStats[key] = { id: memberId, name: mem ? mem.name : (s.memberName || s.member_name || memberId), profileUrl: mem?.profileUrl, newCustSet: new Set(), totalFullBoxes: 0, oldFullBoxes: 0 };
      }
      const fullBoxes = parseSaleBoxes(s);
      if (fullBoxes <= 0) return;

      const cust = findSaleCustomer(s, customers);
      let cType = cust ? String(cust.type || cust.customer_type || cust.customerType || '').trim() : '';
      if (!cType && (s.customerType || s.customer_type)) {
        cType = String(s.customerType || s.customer_type).trim();
      }

      const sCustId = s.customerId || s.customer_id || s.hn || s.customerName || s.customer_name;
      const isNew = (cType.includes('ใหม่') || cType.includes('ตรวจ') || cType.includes('ปรึกษา') || cType.includes('New')) && !cType.includes('ไม่มาตรวจ') && !cType.includes('เก่า');
      const isOld = cType.includes('เก่า') || cType.includes('ต่อยา') || cType.includes('โทร') || cType.includes('Old') || cType.includes('ไม่มาตรวจ');

      if (isNew) {
        if (sCustId) mStats[key].newCustSet.add(sCustId);
      }
      mStats[key].totalFullBoxes += fullBoxes;
      if (isOld) {
        mStats[key].oldFullBoxes += fullBoxes;
      } else if (isNew) {
        // new customer sales boxes are not old
      } else {
        mStats[key].oldFullBoxes += fullBoxes;
      }
    });

    return Object.values(mStats)
      .map(m => ({ ...m, newCustCount: m.newCustSet.size }))
      .filter(m => m.totalFullBoxes > 0)
      .sort((a, b) => b.totalFullBoxes - a.totalFullBoxes)
      .slice(0, 10);
  };

  const calcPodiumData = (topPerformanceData) => {
    const podium = [];
    if (!Array.isArray(topPerformanceData)) return podium;
    if (topPerformanceData.length > 0) podium.push({ ...topPerformanceData[0], rank: 1 });
    if (topPerformanceData.length > 1) podium.push({ ...topPerformanceData[1], rank: 2 });
    if (topPerformanceData.length > 2) podium.push({ ...topPerformanceData[2], rank: 3 });
    return podium;
  };

  const calcTopCheckupPerformanceData = ({ sales, customers, members, dashStartDate, dashEndDate }) => {
    let mStats = {};
    (members || []).forEach(m => {
      if (m && (m.id || m.user_id)) {
        const role = String(m.role || '').trim();
        // นับเฉพาะพนักงานการตลาดเท่านั้น ไม่นับพนักงานทั่วไปหรือรหัสบริษัท
        if (role && role !== 'พนักงานการตลาด') return;
        const key = safeUpper(m.id || m.user_id);
        mStats[key] = { id: m.id || m.user_id, name: m.name || m.id, profileUrl: m.profileUrl, newCustSet: new Set() };
      }
    });

    const filteredSales = (sales || []).filter(s => {
      if (!s) return false;
      const dStr = parseSaleDate(s);
      return dStr >= dashStartDate && dStr <= dashEndDate;
    });

    filteredSales.forEach(s => {
      const memberId = parseSaleMemberId(s);
      if (!memberId) return;
      const key = safeUpper(memberId);
      if (!mStats[key]) return; // ข้ามที่ไม่ใช่นักการตลาด
      
      const cust = findSaleCustomer(s, customers);
      let cType = cust ? String(cust.type || cust.customer_type || cust.customerType || '').trim() : '';
      if (!cType && (s.customerType || s.customer_type)) {
        cType = String(s.customerType || s.customer_type).trim();
      }
      const sCustId = s.customerId || s.customer_id || s.hn || s.customerName || s.customer_name;
      const isNew = (cType.includes('ตรวจ') || cType.includes('ปรึกษา') || (cType.includes('ใหม่') && !cType.includes('ไม่มาตรวจ'))) && !cType.includes('เก่า');
      
      if (isNew && sCustId) {
        mStats[key].newCustSet.add(sCustId);
      }
    });

    return Object.values(mStats)
      .map(m => ({ ...m, newCustCount: m.newCustSet.size }))
      .filter(m => m.newCustCount > 0)
      .sort((a, b) => b.newCustCount - a.newCustCount)
      .slice(0, 3);
  };

  const calcCheckupPodiumData = (topCheckupPerformanceData) => {
    const podium = [];
    if (!Array.isArray(topCheckupPerformanceData)) return podium;
    if (topCheckupPerformanceData.length > 0) podium.push({ ...topCheckupPerformanceData[0], rank: 1 });
    if (topCheckupPerformanceData.length > 1) podium.push({ ...topCheckupPerformanceData[1], rank: 2 });
    if (topCheckupPerformanceData.length > 2) podium.push({ ...topCheckupPerformanceData[2], rank: 3 });
    return podium;
  };

  const calcMaxPerfStats = (topPerformanceData) => {
    let maxFull = 1, maxOld = 1, maxNew = 1;
    (topPerformanceData || []).forEach(d => {
      if (d.totalFullBoxes > maxFull) maxFull = d.totalFullBoxes;
      if (d.oldFullBoxes > maxOld) maxOld = d.oldFullBoxes;
      if (d.newCustCount > maxNew) maxNew = d.newCustCount;
    });
    return { maxFull, maxOld, maxNew };
  };

  const calcDailyTopSales = ({ sales, members, dailyTopSalesStartDate, dailyTopSalesEndDate }) => {
    const periodSales = (sales || []).filter(s => {
      if (!s) return false;
      const dStr = parseSaleDate(s);
      return dStr >= dailyTopSalesStartDate && dStr <= dailyTopSalesEndDate;
    });
    const aggregated = {};
    periodSales.forEach(s => {
      const mId = parseSaleMemberId(s);
      if (!mId) return;
      const key = safeUpper(mId);
      if (!aggregated[key]) {
        const mem = (members || []).find(m => m && safeUpper(m.id || m.user_id) === key);
        aggregated[key] = { memberId: mId, memberName: mem ? mem.name : (s.memberName || s.member_name || mId), totalFullBoxes: 0 };
      }
      aggregated[key].totalFullBoxes += parseSaleBoxes(s);
    });
    return Object.values(aggregated).filter(m => m.totalFullBoxes > 0).sort((a, b) => b.totalFullBoxes - a.totalFullBoxes).slice(0, 10);
  };

  const calcZeroSalesData = ({ members, sales, activeBusinessTeams, activeTeamMembers, zeroSalesStartDate, zeroSalesEndDate }) => {
    let mStats = {};
    (activeTeamMembers || []).forEach(m => {
      if (m && (m.id || m.user_id) && (m.status === 'ทำงานอยู่' || m.status === 'ใช้งาน' || m.status === 'Active')) {
        const key = safeUpper(m.id || m.user_id);
        mStats[key] = { id: m.id || m.user_id, name: m.name, team: String(m.team || '').trim(), totalFullBoxes: 0, profileUrl: m.profileUrl };
      }
    });

    const filteredSales = (sales || []).filter(s => {
      if (!s) return false;
      const dStr = parseSaleDate(s);
      return dStr >= zeroSalesStartDate && dStr <= zeroSalesEndDate;
    });
    filteredSales.forEach(s => {
      const memberId = parseSaleMemberId(s);
      if (!memberId) return;
      const key = safeUpper(memberId);
      if (mStats[key]) {
        mStats[key].totalFullBoxes += parseSaleBoxes(s);
      }
    });

    const paletteColors = [
      { dotColor: 'bg-blue-500', shadow: 'shadow-[0_0_8px_rgba(59,130,246,0.8)]' },
      { dotColor: 'bg-rose-500', shadow: 'shadow-[0_0_8px_rgba(244,63,94,0.8)]' },
      { dotColor: 'bg-amber-500', shadow: 'shadow-[0_0_8px_rgba(245,158,11,0.8)]' },
      { dotColor: 'bg-emerald-500', shadow: 'shadow-[0_0_8px_rgba(16,185,129,0.8)]' },
      { dotColor: 'bg-purple-500', shadow: 'shadow-[0_0_8px_rgba(139,92,246,0.8)]' },
      { dotColor: 'bg-cyan-500', shadow: 'shadow-[0_0_8px_rgba(6,182,212,0.8)]' }
    ];

    const teamMap = {};
    (activeBusinessTeams || []).forEach((bt, idx) => {
      const color = paletteColors[idx % paletteColors.length];
      teamMap[bt.id] = { teamId: bt.id, teamName: bt.name, data: [], dotColor: color.dotColor, shadow: color.shadow };
    });

    Object.values(mStats).forEach(m => {
      if (m.totalFullBoxes === 0) {
        const memTeam = m.team;
        let matchedTeam = (activeBusinessTeams || []).find(bt => {
          if (!bt) return false;
          const btName = String(bt.name || '').toLowerCase();
          const btId = String(bt.id || '');
          const memTeamLower = String(memTeam || '').toLowerCase();
          return (
            (btId && memTeam === btId) || 
            (btName && memTeamLower === btName) ||
            (btName && btName.includes('marketing') && (memTeam === 'Team A' || memTeam === 'Marketing' || memTeam === 'T01')) ||
            (btName && btName.includes('center') && (memTeam === 'Team B' || memTeam === 'Center' || memTeam === 'T02'))
          );
        });
        if (matchedTeam && teamMap[matchedTeam.id]) {
          teamMap[matchedTeam.id].data.push(m);
        }
      }
    });

    return Object.values(teamMap);
  };

  const calcSalesByCustomerTypeData = ({ sales, members, customers, activeCustomerTypes, custTypeStartDate, custTypeEndDate }) => {
    let mStats = {};
    const filteredSales = (sales || []).filter(s => {
      if (!s) return false;
      const dStr = parseSaleDate(s);
      return dStr >= custTypeStartDate && dStr <= custTypeEndDate;
    });
    const foundTypes = new Set();

    (activeCustomerTypes || []).forEach(t => {
      if (t && t.name && String(t.name).trim() !== '') {
        foundTypes.add(String(t.name).trim());
      }
    });

    filteredSales.forEach(s => {
      const countedBoxes = parseSaleBoxes(s);
      if (countedBoxes === 0) return;

      const memberId = parseSaleMemberId(s);
      if (!memberId) return;

      const key = safeUpper(memberId);
      if (!mStats[key]) {
        const mem = (members || []).find(m => m && safeUpper(m.id || m.user_id) === key);
        mStats[key] = { id: memberId, name: mem ? mem.name : (s.memberName || s.member_name || memberId), profileUrl: mem?.profileUrl, totalBoxes: 0, typeBreakdown: {} };
      }

      const cust = findSaleCustomer(s, customers);
      let cType = cust && (cust.type || cust.customer_type || cust.customerType) ? String(cust.type || cust.customer_type || cust.customerType).trim() : '';
      if (!cType || cType === '') {
        if (s.customerType || s.customer_type) cType = String(s.customerType || s.customer_type).trim();
        else cType = 'ไม่ระบุ';
      }
      // normalize ชื่อเก่า → ชื่อใหม่
      if (cType === 'ลูกค้าใหม่') cType = 'ลูกค้าใหม่มาตรวจ';

      foundTypes.add(cType);

      mStats[key].totalBoxes += countedBoxes;
      mStats[key].typeBreakdown[cType] = (mStats[key].typeBreakdown[cType] || 0) + countedBoxes;
    });

    const sortedMembers = Object.values(mStats).sort((a, b) => b.totalBoxes - a.totalBoxes);
    
    const colorPalette = [
      { bg: 'bg-cyan-500', text: 'text-cyan-400', shadow: 'shadow-[0_0_8px_rgba(6,182,212,0.6)]' },
      { bg: 'bg-fuchsia-500', text: 'text-fuchsia-400', shadow: 'shadow-[0_0_8px_rgba(217,70,239,0.6)]' },
      { bg: 'bg-lime-500', text: 'text-lime-400', shadow: 'shadow-[0_0_8px_rgba(132,204,22,0.6)]' },
      { bg: 'bg-rose-500', text: 'text-rose-400', shadow: 'shadow-[0_0_8px_rgba(244,63,94,0.6)]' },
      { bg: 'bg-amber-500', text: 'text-amber-400', shadow: 'shadow-[0_0_8px_rgba(245,158,11,0.6)]' },
      { bg: 'bg-indigo-500', text: 'text-indigo-400', shadow: 'shadow-[0_0_8px_rgba(99,102,241,0.6)]' },
      { bg: 'bg-emerald-500', text: 'text-emerald-400', shadow: 'shadow-[0_0_8px_rgba(16,185,129,0.6)]' },
      { bg: 'bg-orange-500', text: 'text-orange-400', shadow: 'shadow-[0_0_8px_rgba(249,115,22,0.6)]' },
      { bg: 'bg-blue-500', text: 'text-blue-400', shadow: 'shadow-[0_0_8px_rgba(59,130,246,0.6)]' },
      { bg: 'bg-violet-500', text: 'text-violet-400', shadow: 'shadow-[0_0_8px_rgba(139,92,246,0.6)]' },
      { bg: 'bg-pink-500', text: 'text-pink-400', shadow: 'shadow-[0_0_8px_rgba(236,72,153,0.6)]' },
      { bg: 'bg-teal-500', text: 'text-teal-400', shadow: 'shadow-[0_0_8px_rgba(20,184,166,0.6)]' }
    ];

    const typeColors = {};
    Array.from(foundTypes).sort().forEach((t, idx) => {
      typeColors[t] = colorPalette[idx % colorPalette.length];
    });

    let maxBoxesInSingleType = 1;
    sortedMembers.forEach(m => {
      Object.values(m.typeBreakdown).forEach(val => {
        if (val > maxBoxesInSingleType) maxBoxesInSingleType = val;
      });
    });

    return { membersData: sortedMembers, typeColors, maxScale: maxBoxesInSingleType };
  };

  const filterTargetHistory = ({ targetHistory, filterStart, filterEnd, search }) => {
    const sorted = [...(targetHistory || [])].sort((a, b) => (b.date || '').localeCompare(a.date || ''));
    return sorted.filter(item => {
      const dateStr = (item.date || '').substring(0, 10);
      const afterStart = !filterStart || dateStr >= filterStart;
      const beforeEnd = !filterEnd || dateStr <= filterEnd;
      const matchSearch = !search ||
        (item.date || '').toLowerCase().includes(search.toLowerCase()) ||
        (item.setBy || '').toLowerCase().includes(search.toLowerCase()) ||
        (item.targetType || '').toLowerCase().includes(search.toLowerCase()) ||
        String(item.targetValue).includes(search);
      return afterStart && beforeEnd && matchSearch;
    });
  };

  // ─── 6. Global Export ──────────────────────────────────────────

  window.MlmLogic = {
    // Utility Helpers
    safeUpper,
    cleanAvatarUrl,
    getDefaultMonthRange,
    parseSaleDate,
    parseSaleMemberId,
    parseSaleBoxes,
    findSaleCustomer,
    mapPageToHtml,

    // Data Formatters
    formatCustomerTypes,
    formatMembers,
    formatCustomers,
    formatBusinessTeams,
    processSalesRows,

    // Filtering
    filterActiveBusinessTeams,
    filterActiveTeamMembers,

    // Dashboard Calculations
    calcTeamStats,
    calcTeamTopStats,
    calcTopPerformanceData,
    calcPodiumData,
    calcTopCheckupPerformanceData,
    calcCheckupPodiumData,
    calcMaxPerfStats,
    calcDailyTopSales,
    calcZeroSalesData,
    calcSalesByCustomerTypeData,
    filterTargetHistory
  };

  console.log('%c📊 MlmLogic Engine loaded successfully', 'color:#10b981;font-weight:bold');

})(window);
