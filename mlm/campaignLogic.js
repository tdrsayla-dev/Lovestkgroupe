// ============================================================
// 🏆 campaignLogic.js — STK Campaign Engine v1.0
// Logic แยกต่างหาก แก้ได้ง่ายโดยไม่ต้องแตะหน้าหลัก
// ============================================================
(function () {

  // ─── Helpers ──────────────────────────────────────────────
  function safeUp(v) { return String(v || '').trim().toUpperCase(); }

  function parseSaleDate(s) {
    return String(s && (s.date || s.sale_date || s.created_at) || '').trim().substring(0, 10);
  }

  function parseSaleMemberId(s) {
    return (s && (s.memberId || s.member_id || s.sellerId || s.seller_id)) || '';
  }

  function parseSaleBoxes(s) {
    if (!s) return 0;
    var f = Number(s['รวมชิ้นราคาเต็ม'] || s.fullQty || s.full_qty || 0);
    var m = Number(s['รวมชิ้นราคาสมาชิก'] || s.memberQty || s.member_qty || 0);
    return f + m;
  }

  var DEFAULT_TEAM_NAMES = {
    'T01': 'Marketing',
    'T02': 'Center',
    'T03': 'TEAM LEE',
    'T04': 'TEAM THAILAND',
    'T05': 'TEAM NOUDAM',
    'T06': 'TEAM YIA',
    'T07': 'TEAM BOUAPHOUT',
    'T08': 'TEAM KEE'
  };

  function buildTeamsMap(allBusinessTeams) {
    var teamsMap = Object.assign({}, DEFAULT_TEAM_NAMES);
    (allBusinessTeams || []).forEach(function (t) {
      if (!t) return;
      var tId = safeUp(t.team_id || t.id || '');
      var tName = String(t.team_name || t.name || '').trim();
      if (tId && tName) teamsMap[tId] = tName;
      if (tName) teamsMap[safeUp(tName)] = tName;
    });
    return teamsMap;
  }

  function isMarketingMember(m, teamsMap) {
    if (!m) return false;
    var role = String(m.role || m.permission_role || '').trim();
    var rawTeam = String(m.team || m.business_team || m.businessTeam || '').trim().toUpperCase();
    var resolvedTeamName = (teamsMap && teamsMap[rawTeam]) ? String(teamsMap[rawTeam]).trim().toUpperCase() : rawTeam;

    // 1. กรองฝ่ายเซ็นเตอร์ออกเด็ดขาด (พนักงานฝ่ายเซ็นเตอร์ ไม่มีสิทธิ์เข้าร่วมการแข่งขันตัวนี้)
    var isCenter = rawTeam === 'T02' || rawTeam === 'CENTER' || rawTeam.indexOf('เซ็นเตอร์') !== -1 || rawTeam.indexOf('CENTER') !== -1
                || resolvedTeamName === 'CENTER' || resolvedTeamName.indexOf('เซ็นเตอร์') !== -1 || resolvedTeamName.indexOf('CENTER') !== -1;
    if (isCenter) return false;

    // 2. ต้องมีสิทธิ์เป็น "พนักงานการตลาด" เท่านั้น
    var isMarketing = role === 'พนักงานการตลาด' || role.indexOf('การตลาด') !== -1 || role.toUpperCase().indexOf('MARKETING') !== -1;
    return isMarketing;
  }

  function isNewCheckupSale(s, customersMap, startDate, endDate) {
    if (!s) return false;

    // 🛡️ 1. ตรวจสอบหมายเหตุ / รหัส visit ตามคำสั่งผู้ใช้:
    // ดักจับรหัส visit: ถ้ามี VISIT-ORD- หรือ VIS-ORD- จะไม่นับเป็นลูกค้าใหม่มาตรวจ (เป็นออเดอร์ที่คีย์ขายเองเท่านั้น)
    // ตัวไหนที่เป็นรหัส VISIT แล้วก็ขีดตัวเลขเลย (เช่น VISIT: VIS-882756 หรือ VIS-882756) ตัวนั้นถึงจะเป็นลูกค้าใหม่มาตรวจ
    var noteStr = String(
      s.payment_note || 
      s.paymentNote || 
      s.visit_id || 
      s.visitId || 
      s.rxVisitId || 
      s.notes || 
      s.note || 
      s.remark || 
      s.remarks || 
      ''
    ).trim();

    var upperNote = noteStr.toUpperCase();

    // 1.1 ถ้าพบคำว่า VIS-ORD, VISIT-ORD หรือ ORD- ถือเป็นรหัสออเดอร์เด็ดขาด -> ไม่ใช่คนมาตรวจ
    if (upperNote.indexOf('VIS-ORD') !== -1 || upperNote.indexOf('VISIT-ORD') !== -1 || upperNote.indexOf('ORD-') !== -1) {
      return false;
    }

    // 1.2 ต้องเป็นรหัสคนมาตรวจของคลินิกเท่านั้น คือ VIS แล้วตามด้วยตัวเลข (เช่น "VISIT: VIS-882756" หรือ "VIS-882756")
    var hasClinicVisit = /VIS(?:IT)?[:\s\-]+(?:VIS[-:\s]*)?\d+/i.test(noteStr) || /VIS-\d+/i.test(noteStr);
    if (!hasClinicVisit) {
      return false;
    }

    // 2. ตรวจสอบประเภทลูกค้า
    var cType = String((s && (s.customerType || s.customer_type)) || '').trim();
    var cust = null;
    if (customersMap) {
      var cId = safeUp((s && (s.customerId || s.customer_id || s.hn)) || '');
      cust = cId ? customersMap[cId] : null;
      if (!cust && s && (s.customerName || s.customer_name)) {
        cust = customersMap[safeUp(s.customerName || s.customer_name)];
      }
      if (!cType && cust) {
        cType = String(cust.customer_type || cust.customerType || cust.type || '').trim();
      }
    }

    // หากระบุประเภทลูกค้า ต้องไม่ใช่ลูกค้าเก่า, ต่อยา, ไม่มาตรวจ, โทรปิดการขาย
    if (cType) {
      var notOld = cType.indexOf('เก่า') === -1 && cType.indexOf('ต่อยา') === -1 && cType.indexOf('ไม่มาตรวจ') === -1 && cType.indexOf('โทร') === -1;
      if (!notOld) return false;
    }

    // 🛡️ ปฏิบัติตามฟิลเตอร์วันที่อย่างเคร่งครัด: วันที่ของบิลขายต้องอยู่ในช่วงวันที่แคมเปญ (startDate ถึง endDate)
    if (s && startDate && endDate) {
      var sDate = parseSaleDate(s);
      if (sDate && (sDate < startDate || sDate > endDate)) return false;
    }

    return true;
  }

  // ============================================================
  // 🏆 CAMPAIGN CUSTOM HANDLERS REGISTRY
  // สถาปัตยกรรมแยก Logic ของแต่ละแคมเปญอย่างอิสระ
  // แคมเปญเดิมจะไม่ถูกกระทบ แคมเปญใหม่สามารถสร้าง Logic เฉพาะตัวได้
  // ============================================================
  var campaignCustomHandlers = {};

  // 1. แคมเปญเดิม: Default Legacy Handler (สำหรับ CAMP-001 หรือแคมเปญเก่า)
  campaignCustomHandlers['default_legacy'] = function (campaign, allSales, allMembers, allCustomers, allBusinessTeams) {
    if (!campaign) return [];
    var startDate = String(campaign.start_date || '').trim().substring(0, 10);
    var endDate = String(campaign.end_date || '').trim().substring(0, 10);
    var teamsMap = buildTeamsMap(allBusinessTeams);

    var customersMap = {};
    (allCustomers || []).forEach(function (c) {
      if (!c) return;
      var cId = safeUp(c.customer_id || c.id || c.hn || '');
      if (cId) customersMap[cId] = c;
      var cPhone = safeUp(c.phone || '');
      if (cPhone) customersMap[cPhone] = c;
      var cName = safeUp(c.name || c.customer_name || '');
      if (cName) customersMap[cName] = c;
    });

    var marketingMembers = (allMembers || []).filter(function (m) {
      return isMarketingMember(m, teamsMap);
    });

    var salesInRange = (allSales || []).filter(function (s) {
      if (!s) return false;
      var d = parseSaleDate(s);
      if (startDate && d < startDate) return false;
      if (endDate && d > endDate) return false;
      return true;
    });

    function getSaleFullTime(s) {
      if (!s) return '';
      var dt = String(s.created_at || '').trim();
      if (dt) return dt;
      var d = String(s.date || s.sale_date || '').trim();
      var t = String(s.time || s.sale_time || '00:00:00').trim();
      return d ? (d + ' ' + t) : '';
    }

    salesInRange.sort(function (a, b) {
      var tA = getSaleFullTime(a);
      var tB = getSaleFullTime(b);
      if (tA !== tB) return tA.localeCompare(tB);
      return String(a.id || a.bill_id || '').localeCompare(String(b.id || b.bill_id || ''));
    });

    var memberMap = {};
    marketingMembers.forEach(function (m) {
      var key = safeUp(m.user_id || m.id || '');
      if (!key) return;
      var rawTeam = String(m.team || m.business_team || m.businessTeam || '').trim();
      var teamName = (teamsMap && teamsMap[safeUp(rawTeam)]) || rawTeam || 'พนักงานการตลาด';
      memberMap[key] = {
        memberId: m.user_id || m.id,
        name: m.name || key,
        profileUrl: m.profileUrl || m.id_card_url || null,
        team: teamName,
        teamName: teamName,
        actual_cond2: 0,
        newCustSet: {},
        qualifiedOrder: null,
        qualifiedAt: null
      };
    });

    var cond1Target = Number(campaign.cond1_target || 0);
    var cond2Target = Number(campaign.cond2_target || 0);
    var qualificationSeq = 0;

    Object.keys(memberMap).forEach(function (k) {
      var mem = memberMap[k];
      var c1Ready = !campaign.cond1_enabled || cond1Target <= 0;
      var c2Ready = !campaign.cond2_enabled || cond2Target <= 0;
      if (c1Ready && c2Ready && (cond1Target <= 0 || cond2Target <= 0)) {
        qualificationSeq++;
        mem.qualifiedOrder = qualificationSeq;
        mem.qualifiedAt = startDate;
      }
    });

    salesInRange.forEach(function (s) {
      var memberId = parseSaleMemberId(s);
      if (!memberId) return;
      var key = safeUp(memberId);
      if (!memberMap[key]) return;

      var custId = safeUp((s.customerId || s.customer_id || s.hn || s.customerName || s.customer_name) || '');
      var isCheckup = isNewCheckupSale(s, customersMap, startDate, endDate);
      var minPrice = Number(campaign.cond2_min_price || 0);
      var qualifyingBoxes = 0;

      var itemsList = null;
      if (s.items_json) {
        try { itemsList = typeof s.items_json === 'string' ? JSON.parse(s.items_json) : s.items_json; } catch(e) {}
      }

      if (Array.isArray(itemsList) && itemsList.length > 0) {
        for (var i = 0; i < itemsList.length; i++) {
          var it = itemsList[i];
          var q = parseInt(it.qty || it.quantity || 1) || 0;
          var p = parseFloat(it.unitPrice !== undefined ? it.unitPrice : (it.price !== undefined ? it.price : 0)) || 0;
          if (q > 0 && (minPrice === 0 || p >= minPrice)) {
            qualifyingBoxes += q;
          }
        }
      }
      
      if (qualifyingBoxes === 0) {
        var boxes = parseSaleBoxes(s);
        var unitPrice = Number((s.unit_price || s.unitPrice || s.price_full || s.priceFull) || 0);
        if (unitPrice === 0 && boxes > 0) {
          var totalAmt = Number(s.total_amount_thb || s.totalAmountThb || s.total_amount || s.amount || 0);
          if (totalAmt > 0) unitPrice = totalAmt / boxes;
        }
        if (boxes > 0 && (minPrice === 0 || unitPrice >= minPrice)) {
          qualifyingBoxes += boxes;
        }
      }

      // ตรรกะเดิมของแคมเปญเก่า: 1 คนมาตรวจ = 1 บิลสินค้า >= 1,500
      if (isCheckup && qualifyingBoxes > 0) {
        var uniqueSaleKey = s.id || s.sale_id || s.bill_id || (custId ? (custId + '_' + (s.date || '') + '_' + (s.time || '')) : ('sale_' + Math.random()));
        if (campaign.cond1_enabled) {
          memberMap[key].newCustSet[uniqueSaleKey] = true;
        }
        if (campaign.cond2_enabled) {
          memberMap[key].actual_cond2 += 1;
        }
      }

      var curActual1 = Object.keys(memberMap[key].newCustSet).length;
      var curActual2 = memberMap[key].actual_cond2;
      var passesNow = true;
      if (campaign.cond1_enabled && curActual1 < cond1Target) passesNow = false;
      if (campaign.cond2_enabled && curActual2 < cond2Target) passesNow = false;

      if (passesNow && memberMap[key].qualifiedOrder === null) {
        qualificationSeq++;
        memberMap[key].qualifiedOrder = qualificationSeq;
        memberMap[key].qualifiedAt = getSaleFullTime(s) || parseSaleDate(s);
      }
    });

    var results = Object.values(memberMap).map(function (m) {
      var actual1 = Object.keys(m.newCustSet).length;
      var actual2 = m.actual_cond2;
      var passed = true;
      if (campaign.cond1_enabled && actual1 < cond1Target) passed = false;
      if (campaign.cond2_enabled && actual2 < cond2Target) passed = false;

      if (passed && m.qualifiedOrder === null) {
        qualificationSeq++;
        m.qualifiedOrder = qualificationSeq;
        m.qualifiedAt = m.qualifiedAt || endDate;
      }

      var pct1 = (campaign.cond1_enabled && cond1Target > 0) ? Math.min(Math.round((actual1 / cond1Target) * 100), 100) : null;
      var pct2 = (campaign.cond2_enabled && cond2Target > 0) ? Math.min(Math.round((actual2 / cond2Target) * 100), 100) : null;
      return {
        memberId: m.memberId,
        name: m.name,
        profileUrl: m.profileUrl,
        team: m.team,
        teamName: m.teamName || m.team,
        actual_cond1: actual1,
        actual_cond2: actual2,
        pct1: pct1,
        pct2: pct2,
        passed: passed,
        qualifiedOrder: m.qualifiedOrder,
        qualifiedAt: m.qualifiedAt
      };
    });

    results.sort(function (a, b) {
      if (a.passed !== b.passed) return a.passed ? -1 : 1;
      if (a.passed && b.passed) {
        var oA = a.qualifiedOrder || 999999;
        var oB = b.qualifiedOrder || 999999;
        if (oA !== oB) return oA - oB;
        if (a.qualifiedAt && b.qualifiedAt && a.qualifiedAt !== b.qualifiedAt) {
          return a.qualifiedAt.localeCompare(b.qualifiedAt);
        }
        var sA = (a.pct2 !== null ? a.pct2 : (a.pct1 || 0));
        var sB = (b.pct2 !== null ? b.pct2 : (b.pct1 || 0));
        return sB - sA;
      }
      if (a.actual_cond1 !== b.actual_cond1) return b.actual_cond1 - a.actual_cond1;
      var scoreA = (a.pct2 !== null ? a.pct2 : (a.pct1 || 0));
      var scoreB = (b.pct2 !== null ? b.pct2 : (b.pct1 || 0));
      return scoreB - scoreA;
    });

    return results;
  };

  // 2. แคมเปญใหม่: CAMP-162070 (ล่องเรือสำราญ) — Logic คลินิก 19/ABI + นับยอดกล่องรวมใน ID >= 1,500
  campaignCustomHandlers['CAMP-162070'] = function (campaign, allSales, allMembers, allCustomers, allBusinessTeams, clinicLogs) {
    if (!campaign) return [];
    var startDate = String(campaign.start_date || '').trim().substring(0, 10);
    var endDate = String(campaign.end_date || '').trim().substring(0, 10);
    var teamsMap = buildTeamsMap(allBusinessTeams);

    var marketingMembers = (allMembers || []).filter(function (m) {
      return isMarketingMember(m, teamsMap);
    });

    // 2.1 วิเคราะห์คะแนนตรวจคลินิก (ABI = 1 แต้ม, 19 รายการ = 1 แต้ม, ตรวจคู่ = 2 แต้ม)
    var clinicPointsByMember = {};
    var clinicVisitsByMember = {};
    var logs = clinicLogs || [];
    if (!logs.length && window.__stkClinicLogsCache) {
      logs = window.__stkClinicLogsCache[startDate + '_' + endDate] || [];
    }

    if (Array.isArray(logs) && logs.length > 0) {
      logs.forEach(function (log) {
        if (!log) return;
        var mCode = window.CampaignEngine.extractMemberIdFromReferrer(log.referrer_id || log.referrer_name);
        if (!mCode) return;
        var check = window.CampaignEngine.parseClinicItemCheckup(log.item_details);
        // แต่ละคนไข้ที่มาตรวจนับเป็นคนไข้ตรวจคลินิกขั้นต่ำ 1 แต้ม ถ้าตรวจคู่ ABI+19 ได้ 2 แต้ม
        var pVal = check.points > 0 ? check.points : 1;
        clinicPointsByMember[mCode] = (clinicPointsByMember[mCode] || 0) + pVal;
        if (!clinicVisitsByMember[mCode]) clinicVisitsByMember[mCode] = {};
        var vK = safeUp(log.visit_id || log.patient_name || log.id);
        if (vK) clinicVisitsByMember[mCode][vK] = true;
      });
    }

    // 2.2 กรองบิลขาย MLM เฉพาะช่วงวันที่ของแคมเปญ
    var salesInRange = (allSales || []).filter(function (s) {
      if (!s) return false;
      var d = parseSaleDate(s);
      if (startDate && d < startDate) return false;
      if (endDate && d > endDate) return false;
      return true;
    });

    function getSaleFullTime(s) {
      if (!s) return '';
      var dt = String(s.created_at || '').trim();
      if (dt) return dt;
      var d = String(s.date || s.sale_date || '').trim();
      var t = String(s.time || s.sale_time || '00:00:00').trim();
      return d ? (d + ' ' + t) : '';
    }

    salesInRange.sort(function (a, b) {
      var tA = getSaleFullTime(a);
      var tB = getSaleFullTime(b);
      if (tA !== tB) return tA.localeCompare(tB);
      return String(a.id || a.bill_id || '').localeCompare(String(b.id || b.bill_id || ''));
    });

    var memberMap = {};
    marketingMembers.forEach(function (m) {
      var key = safeUp(m.user_id || m.id || '');
      if (!key) return;
      var rawTeam = String(m.team || m.business_team || m.businessTeam || '').trim();
      var teamName = (teamsMap && teamsMap[safeUp(rawTeam)]) || rawTeam || 'พนักงานการตลาด';
      var cPoints = clinicPointsByMember[key] || 0;

      memberMap[key] = {
        memberId: m.user_id || m.id,
        name: m.name || key,
        profileUrl: m.profileUrl || m.id_card_url || null,
        team: teamName,
        teamName: teamName,
        actual_cond1: cPoints,
        actual_cond2: 0, // ยอดกล่องสะสม
        fallbackCheckups: {},
        qualifiedOrder: null,
        qualifiedAt: null
      };
    });

    var cond1Target = Number(campaign.cond1_target || 5);
    var cond2Target = Number(campaign.cond2_target || 5);
    var minPrice = Number(campaign.cond2_min_price || 1500);
    var qualificationSeq = 0;

    // ประมวลผลยอดขาย MLM:
    // ⭐ ตามคำสั่งผู้ใช้: "ขอแค่จำนวนกล่อง 1,500 ใน ID มีถึง 5 กล่อง ตัวนี้ไม่ได้จะนับแยกเป็นจำนวนบิลแล้ว"
    salesInRange.forEach(function (s) {
      var memberId = parseSaleMemberId(s);
      if (!memberId) return;
      var key = safeUp(memberId);
      if (!memberMap[key]) return;

      var qualifyingBoxes = 0;
      var itemsList = null;
      if (s.items_json) {
        try { itemsList = typeof s.items_json === 'string' ? JSON.parse(s.items_json) : s.items_json; } catch(e) {}
      }

      if (Array.isArray(itemsList) && itemsList.length > 0) {
        for (var i = 0; i < itemsList.length; i++) {
          var it = itemsList[i];
          var q = parseInt(it.qty || it.quantity || 1) || 0;
          var p = parseFloat(it.unitPrice !== undefined ? it.unitPrice : (it.price !== undefined ? it.price : 0)) || 0;
          if (q > 0 && (minPrice === 0 || p >= minPrice)) {
            qualifyingBoxes += q;
          }
        }
      }

      if (qualifyingBoxes === 0) {
        var boxes = parseSaleBoxes(s);
        var unitPrice = Number((s.unit_price || s.unitPrice || s.price_full || s.priceFull) || 0);
        if (unitPrice === 0 && boxes > 0) {
          var totalAmt = Number(s.total_amount_thb || s.totalAmountThb || s.total_amount || s.amount || 0);
          if (totalAmt > 0) unitPrice = totalAmt / boxes;
        }
        if (boxes > 0 && (minPrice === 0 || unitPrice >= minPrice)) {
          qualifyingBoxes += boxes;
        }
      }

      // นับยอดกล่องทั้งหมดที่เข้าเกณฑ์ใน ID นี้
      if (qualifyingBoxes > 0) {
        memberMap[key].actual_cond2 += qualifyingBoxes;
      }

      // 🏥 ตรวจสอบบิลตรวจจากฝั่ง MLM เพิ่มเติม (นับรวมคนมาตรวจทั้งจากคลินิกและ MLM โดยไม่นับซ้ำ)
      var isCheckup = isNewCheckupSale(s, null, startDate, endDate);
      if (isCheckup) {
        var vNote = String(s.payment_note || s.paymentNote || '').trim();
        var match = vNote.match(/VIS(?:IT)?[:\s\-]+([A-Za-z0-9_\-]+)/i);
        var vKey = match ? match[1].trim().toUpperCase() : safeUp(s.customerId || s.customer_id || s.id);

        var alreadyInClinic = clinicVisitsByMember[key] && clinicVisitsByMember[key][vKey];
        if (!alreadyInClinic && !memberMap[key].fallbackCheckups[vKey]) {
          memberMap[key].fallbackCheckups[vKey] = true;
          memberMap[key].actual_cond1++;
        }
      }

      // ตรวจสอบความพร้อมการผ่านเกณฑ์ ณ บิลนี้
      var cur1 = memberMap[key].actual_cond1;
      var cur2 = memberMap[key].actual_cond2;
      var passesNow = (!campaign.cond1_enabled || cur1 >= cond1Target) && (!campaign.cond2_enabled || cur2 >= cond2Target);
      if (passesNow && memberMap[key].qualifiedOrder === null) {
        qualificationSeq++;
        memberMap[key].qualifiedOrder = qualificationSeq;
        memberMap[key].qualifiedAt = getSaleFullTime(s) || parseSaleDate(s);
      }
    });

    var results = Object.values(memberMap).map(function (m) {
      var passed = (!campaign.cond1_enabled || m.actual_cond1 >= cond1Target) && (!campaign.cond2_enabled || m.actual_cond2 >= cond2Target);
      if (passed && m.qualifiedOrder === null) {
        qualificationSeq++;
        m.qualifiedOrder = qualificationSeq;
        m.qualifiedAt = m.qualifiedAt || endDate;
      }

      var pct1 = (campaign.cond1_enabled && cond1Target > 0) ? Math.min(Math.round((m.actual_cond1 / cond1Target) * 100), 100) : null;
      var pct2 = (campaign.cond2_enabled && cond2Target > 0) ? Math.min(Math.round((m.actual_cond2 / cond2Target) * 100), 100) : null;

      return {
        memberId: m.memberId,
        name: m.name,
        profileUrl: m.profileUrl,
        team: m.team,
        teamName: m.teamName || m.team,
        actual_cond1: m.actual_cond1,
        actual_cond2: m.actual_cond2,
        pct1: pct1,
        pct2: pct2,
        passed: passed,
        qualifiedOrder: m.qualifiedOrder,
        qualifiedAt: m.qualifiedAt
      };
    });

    results.sort(function (a, b) {
      if (a.passed !== b.passed) return a.passed ? -1 : 1;
      if (a.passed && b.passed) {
        var oA = a.qualifiedOrder || 999999;
        var oB = b.qualifiedOrder || 999999;
        if (oA !== oB) return oA - oB;
        return (b.actual_cond2 + b.actual_cond1) - (a.actual_cond2 + a.actual_cond1);
      }
      if (b.actual_cond1 !== a.actual_cond1) return b.actual_cond1 - a.actual_cond1;
      return b.actual_cond2 - a.actual_cond2;
    });

    return results;
  };

  campaignCustomHandlers['CROSS_DB'] = campaignCustomHandlers['CAMP-162070'];
  window.__stkCampaignHandlers = campaignCustomHandlers;

  // ─── Campaign Engine ───────────────────────────────────────
  window.CampaignEngine = {

    // ดึงเฉพาะแคมเปญที่ active
    fetchActiveCampaigns: async function () {
      try {
        if (typeof window.supabaseSelect !== 'function') return [];
        var data = await window.supabaseSelect('stk_campaigns', 'status=eq.active&order=display_order.asc,created_at.asc');
        return Array.isArray(data) ? data : [];
      } catch (e) { console.warn('[CampaignEngine] fetchActive:', e); return []; }
    },

    // ดึงทุกแคมเปญ (Admin Settings)
    fetchAllCampaigns: async function () {
      try {
        if (typeof window.supabaseSelect !== 'function') return [];
        var data = await window.supabaseSelect('stk_campaigns', 'nocache=true&order=display_order.asc,created_at.asc');
        return Array.isArray(data) ? data : [];
      } catch (e) { console.warn('[CampaignEngine] fetchAll:', e); return []; }
    },

    // ─────────────────────────────────────────────────────────────
    // 🏆 Campaign Logic Registry (สถาปัตยกรรมแยก Logic อิสระรายแคมเปญ)
    // ─────────────────────────────────────────────────────────────
    registerCampaignLogic: function (campaignId, handlerFn) {
      if (!window.__stkCampaignHandlers) window.__stkCampaignHandlers = {};
      if (campaignId && typeof handlerFn === 'function') {
        window.__stkCampaignHandlers[safeUp(campaignId)] = handlerFn;
      }
    },

    // คำนวณผล Marketing พนักงานทุกคน สำหรับ 1 แคมเปญ (Route ตาม Logic ของแคมเปญนั้นๆ)
    calcCampaignResults: function (campaign, allSales, allMembers, allCustomers, allBusinessTeams, clinicLogs) {
      if (!campaign) return [];
      var cId = safeUp(campaign.campaign_id || campaign.id || '');
      var handlers = window.__stkCampaignHandlers || {};

      // 1. ตรวจสอบว่าแคมเปญนี้มี Handler เฉพาะตัวหรือไม่ (เช่น CAMP-162070)
      if (cId && typeof handlers[cId] === 'function') {
        return handlers[cId](campaign, allSales, allMembers, allCustomers, allBusinessTeams, clinicLogs);
      }

      // 2. ตรวจสอบตามประเภท logic_type (ถ้ามี)
      var lType = safeUp(campaign.logic_type || '');
      if (lType && typeof handlers[lType] === 'function') {
        return handlers[lType](campaign, allSales, allMembers, allCustomers, allBusinessTeams, clinicLogs);
      }

      // 3. แคมเปญเดิม: เรียกใช้ Default Legacy Logic (คงเดิมไว้ 100% ไม่กระทบแคมเปญเก่า)
      if (typeof handlers['default_legacy'] === 'function') {
        return handlers['default_legacy'](campaign, allSales, allMembers, allCustomers, allBusinessTeams, clinicLogs);
      }

      return [];
    },

    // ─────────────────────────────────────────────────────────────
    // 🏥 Cross-Database Clinic Evaluation Engine
    // ─────────────────────────────────────────────────────────────

    // 1. ดึงข้อมูล commission_logs จากฐานข้อมูลคลินิกตามช่วงวันที่ (ดึงเฉพาะฟิลด์ที่จำเป็น ลด Egress สูงสุด)
    fetchClinicLogs: async function (startDate, endDate) {
      if (typeof window.clinicSupabaseSelect !== 'function') return [];
      var cacheKey = (startDate || '') + '_' + (endDate || '');
      if (window.__stkClinicLogsCache && window.__stkClinicLogsCache[cacheKey]) {
        return window.__stkClinicLogsCache[cacheKey];
      }
      try {
        var sess = sessionStorage.getItem('stk_clinic_logs_' + cacheKey);
        if (sess) {
          var parsed = JSON.parse(sess);
          if (parsed && Array.isArray(parsed.data) && (Date.now() - (parsed.ts || 0) < 300000)) { // 5 นาที แคช
            if (!window.__stkClinicLogsCache) window.__stkClinicLogsCache = {};
            window.__stkClinicLogsCache[cacheKey] = parsed.data;
            return parsed.data;
          }
        }
      } catch (e) {}

      try {
        var query = 'order=created_at.asc';
        if (startDate) {
          query += '&created_at=gte.' + encodeURIComponent(startDate + 'T00:00:00');
        }
        if (endDate) {
          query += '&created_at=lte.' + encodeURIComponent(endDate + 'T23:59:59');
        }
        // ตัด amount และ total_invoice ออกเด็ดขาด เพื่อประหยัด Data Egress
        query += '&select=id,referrer_id,referrer_name,patient_name,visit_id,item_details,created_at';
        var logs = await window.clinicSupabaseSelect('commission_logs', query);
        var res = Array.isArray(logs) ? logs : [];
        if (!window.__stkClinicLogsCache) window.__stkClinicLogsCache = {};
        window.__stkClinicLogsCache[cacheKey] = res;
        try {
          sessionStorage.setItem('stk_clinic_logs_' + cacheKey, JSON.stringify({ ts: Date.now(), data: res }));
        } catch (e) {}
        return res;
      } catch (e) {
        console.warn('⚠️ [CampaignEngine] fetchClinicLogs error:', e);
        return [];
      }
    },

    // 2. วิเคราะห์ชื่อรายการตรวจ: ABI = 1 แต้ม, 19 รายการ/ครบวงจร = 1 แต้ม, ตรวจทั้งคู่ = 2 แต้ม
    parseClinicItemCheckup: function (itemDetailsStr, itemsArr) {
      var text = String(itemDetailsStr || '').trim();
      if (Array.isArray(itemsArr) && itemsArr.length > 0) {
        text += ' ' + itemsArr.map(function (it) { return it.name || it.service_name || ''; }).join(' ');
      }
      var upper = text.toUpperCase();

      var hasAbi = upper.indexOf('ABI') !== -1;
      var hasComp = upper.indexOf('19') !== -1 || text.indexOf('ຄົບວົງຈອນ') !== -1 || text.indexOf('ครบวงจร') !== -1;

      var points = 0;
      var checkType = 'OTHER';

      if (hasAbi && hasComp) {
        points = 2;
        checkType = 'BOTH';
      } else if (hasAbi) {
        points = 1;
        checkType = 'ABI';
      } else if (hasComp) {
        points = 1;
        checkType = 'COMPREHENSIVE';
      }

      return {
        hasAbi: hasAbi,
        hasComp: hasComp,
        points: points,
        checkType: checkType,
        rawText: text
      };
    },

    // 3. สกัดรหัสพนักงานการตลาดจาก referrer_id ของคลินิก (เช่น "L13266 - MS..." -> "L13266")
    extractMemberIdFromReferrer: function (referrerIdStr) {
      if (!referrerIdStr) return '';
      var clean = String(referrerIdStr).trim();
      var match = clean.match(/^([A-Za-z0-9_-]+)/);
      return match ? match[1].trim().toUpperCase() : clean.toUpperCase();
    },

    // 3.1 ฟังก์ชันตัดค่าใช้จ่าย/ราคาตรวจออก แสดงเฉพาะชื่อรายการตรวจ (ประหยัด Egress & คลีน UI)
    cleanClinicItemDetails: function (itemDetailsStr) {
      if (!itemDetailsStr) return '-';
      return String(itemDetailsStr)
        .replace(/:\s*[₭฿LAKTHB]?\s*\d+(?:,\d+)*(?:\.\d+)?/gi, '')
        .replace(/\s*[₭฿]\s*\d+(?:,\d+)*(?:\.\d+)?/gi, '')
        .replace(/\s*,\s*/g, ', ')
        .replace(/^[\s,:]+|[\s,:]+$/g, '')
        .trim() || '-';
    },

    // 4. ประมวลผลแคมเปญแบบ Cross-Database (รวมฝั่งคลินิก 2 แต้ม/1 แต้ม + ฝั่ง MLM โควต้ากล่อง + หักคอมฯ เฉพาะกล่องโควต้า)
    evaluateCampaignCrossDB: async function (campaign, options) {
      if (!campaign) return [];
      var opt = options || {};
      var allSales = opt.allSales || [];
      var allMembers = opt.allMembers || [];
      var allBusinessTeams = opt.allBusinessTeams || [];
      var products = opt.products || [];

      var startDate = String(campaign.start_date || '').trim().substring(0, 10);
      var endDate = String(campaign.end_date || '').trim().substring(0, 10);

      // ดึง commission_logs คลินิกถ้าไม่ได้ส่งเข้ามา
      var clinicLogs = opt.clinicLogs;
      if (!clinicLogs || !Array.isArray(clinicLogs)) {
        clinicLogs = await this.fetchClinicLogs(startDate, endDate);
      }

      var teamsMap = buildTeamsMap(allBusinessTeams);
      var marketingMembers = allMembers.filter(function (m) {
        return isMarketingMember(m, teamsMap);
      });

      // ดึงและทำ Mapping อัตราค่าคอมขายเอง (self_fee) และค่าแนะนำ (level_1_fee) จากตารางสินค้าจริง
      var productsMap = {};
      var rawProducts = products;
      if ((!rawProducts || rawProducts.length === 0) && typeof localStorage !== 'undefined') {
        try {
          var cData = localStorage.getItem('stk_app_cache_data');
          if (cData) {
            var pData = JSON.parse(cData);
            if (Array.isArray(pData.products) && pData.products.length > 0) rawProducts = pData.products;
          }
        } catch(e) {}
      }
      (rawProducts || []).forEach(function (p) {
        if (!p) return;
        var pId = safeUp(p.product_id || p.id);
        var pName = safeUp(p.name);
        var selfF = p.self_fee !== undefined ? Number(p.self_fee) : (p.selfFee !== undefined ? Number(p.selfFee) : 250000);
        var refF = p.level_1_fee !== undefined ? Number(p.level_1_fee) : (p.level1Fee !== undefined ? Number(p.level1Fee) : 200000);
        var pObj = { selfFee: selfF, refFee: refF };
        if (pId) productsMap[pId] = pObj;
        if (pName) productsMap[pName] = pObj;
      });

      var targetClinicPoints = Number(campaign.cond1_target || 5);
      var targetBoxes = Number(campaign.cond2_target || 5);
      var minBoxPrice = Number(campaign.cond2_min_price || 1500);

      // เรทหักคอมมิชชั่นเมื่อผ่านเกณฑ์ (เช่น 500,000 กีบ ต่อโควต้า หรือคำนวณตามกล่อง)
      var deductType = campaign.cond_deduct_type || 'quota_total'; // 'quota_total' | 'per_box'
      var deductAmountSetting = Number(campaign.cond_commission_deduct !== undefined ? campaign.cond_commission_deduct : 500000);

      var self = this;

      // จัดกลุ่มคลินิก Logs ตามรหัสการตลาด
      var clinicLogsByMember = {};
      (clinicLogs || []).forEach(function (log) {
        if (!log) return;
        var mCode = self.extractMemberIdFromReferrer(log.referrer_id || log.referrer_name);
        if (!mCode) return;
        if (!clinicLogsByMember[mCode]) clinicLogsByMember[mCode] = [];
        clinicLogsByMember[mCode].push(log);
      });

      // กรองบิลขาย MLM ให้อยู่ในช่วงวันที่ของแคมเปญ
      var salesInRange = (allSales || []).filter(function (s) {
        if (!s) return false;
        var d = parseSaleDate(s);
        if (startDate && d < startDate) return false;
        if (endDate && d > endDate) return false;
        return true;
      });

      // เรียงบิลขายตามเวลาเก่าไปใหม่ (FIFO) เพื่อจัดสรรกล่องโควต้า vs กล่องส่วนเกิน
      salesInRange.sort(function (a, b) {
        var tA = String(a.created_at || a.date || '');
        var tB = String(b.created_at || b.date || '');
        return tA.localeCompare(tB);
      });

      // จัดกลุ่มบิลขายตาม memberId
      var salesByMember = {};
      salesInRange.forEach(function (s) {
        var mId = safeUp(parseSaleMemberId(s));
        if (!mId) return;
        if (!salesByMember[mId]) salesByMember[mId] = [];
        salesByMember[mId].push(s);
      });

      // ประมวลผลรายคน
      var results = marketingMembers.map(function (m) {
        var memberId = String(m.user_id || m.id || '').trim();
        var key = safeUp(memberId);
        var rawTeam = String(m.team || m.business_team || m.businessTeam || '').trim();
        var teamName = (teamsMap && teamsMap[safeUp(rawTeam)]) || rawTeam || 'พนักงานการตลาด';

        // 1. วิเคราะห์ฝั่งคลินิก (Clinic Examination Points)
        var memLogs = clinicLogsByMember[key] || [];
        var totalClinicPoints = 0;
        var abiPoints = 0;
        var compPoints = 0;
        var patientVisits = [];

        memLogs.forEach(function (log) {
          var check = self.parseClinicItemCheckup(log.item_details);
          // แต้มตรวจ: ถ้ามีแต้มจาก ABI / 19 รายการ ใช้ค่านั้น ถ้าเป็นบริการตรวจอื่นๆ ของคนไข้นับเป็น 1 แต้มขั้นต่ำ
          var pVal = check.points > 0 ? check.points : 1;
          totalClinicPoints += pVal;
          if (check.hasAbi && check.hasComp) {
            abiPoints += 1;
            compPoints += 1;
          } else if (check.hasAbi) {
            abiPoints += 1;
          } else if (check.hasComp) {
            compPoints += 1;
          }
          patientVisits.push({
            visitId: log.visit_id || log.id,
            patientName: log.patient_name || 'คนไข้',
            itemDetails: self.cleanClinicItemDetails(log.item_details),
            date: log.created_at ? log.created_at.substring(0, 10) : '',
            points: pVal,
            checkType: check.checkType
          });
        });

        // ⭐ ถ้าแต้มถึง หรือ จำนวนคนไข้ที่พามาตรวจถึงเป้าหมาย (เช่น 5 คน) ถือว่าผ่านเกณฑ์คลินิก
        var clinicPassed = (totalClinicPoints >= targetClinicPoints) || (patientVisits.length >= targetClinicPoints);
        if (clinicPassed && totalClinicPoints < targetClinicPoints) {
          totalClinicPoints = targetClinicPoints;
        }

        // 2. วิเคราะห์ฝั่งสินค้า (MLM Qualifying Boxes & Surplus)
        var memSales = salesByMember[key] || [];
        var totalQualifyingBoxes = 0;
        var qualifyingSalesDetails = [];

        memSales.forEach(function (s) {
          var sDate = parseSaleDate(s);
          var sId = s.id || s.bill_id || s.order_id || '';
          
          var itemsList = null;
          if (s.items_json) {
            try { itemsList = typeof s.items_json === 'string' ? JSON.parse(s.items_json) : s.items_json; } catch(e){}
          }

          var boxesInThisSale = 0;
          var saleSelfRate = 250000;
          var saleRefRate = 200000;

          if (Array.isArray(itemsList) && itemsList.length > 0) {
            itemsList.forEach(function (it) {
              var q = parseInt(it.qty || it.quantity || 1) || 0;
              var p = parseFloat(it.unitPrice !== undefined ? it.unitPrice : (it.price !== undefined ? it.price : 0)) || 0;
              if (q > 0 && (minBoxPrice === 0 || p >= minBoxPrice)) {
                boxesInThisSale += q;
                var itKey = safeUp(it.product_id || it.productId || it.id || it.name || it.product_name);
                if (productsMap[itKey]) {
                  saleSelfRate = productsMap[itKey].selfFee;
                  saleRefRate = productsMap[itKey].refFee;
                }
              }
            });
          }

          if (boxesInThisSale === 0) {
            var boxes = parseSaleBoxes(s);
            var unitPrice = Number((s.unit_price || s.unitPrice || s.price_full || s.priceFull) || 0);
            if (unitPrice === 0 && boxes > 0) {
              var totalAmt = Number(s.total_amount_thb || s.totalAmountThb || s.total_amount || s.amount || 0);
              if (totalAmt > 0) unitPrice = totalAmt / boxes;
            }
            if (boxes > 0 && (minBoxPrice === 0 || unitPrice >= minBoxPrice)) {
              boxesInThisSale = boxes;
              var pKey = safeUp(s.product_name || s.productName || s.product_id || s.productId);
              if (productsMap[pKey]) {
                saleSelfRate = productsMap[pKey].selfFee;
                saleRefRate = productsMap[pKey].refFee;
              }
            }
          }

          if (boxesInThisSale > 0) {
            totalQualifyingBoxes += boxesInThisSale;
            qualifyingSalesDetails.push({
              saleId: sId,
              date: sDate,
              boxes: boxesInThisSale,
              customerName: s.customerName || s.customer_name || '',
              selfRate: saleSelfRate,
              refRate: saleRefRate
            });
          }
        });

        // 3. ตรวจสอบนโยบายแคมเปญ (Deduction Policy)
        var isNoDeduct = (campaign.deduct_policy === 'no_deduct' || campaign.cond2_type === 'boxes_no_deduct');

        // 4. ตัดสินผลแคมเปญ (ผ่านครบ 2 ข้อ: คลินิก + ยอดขาย)
        var boxesPassed = totalQualifyingBoxes >= targetBoxes;
        var isQualified = clinicPassed && boxesPassed;

        // 5. คำนวณการจัดสรรกล่อง และยอดเงินงดจ่าย (Deduction Breakdown)
        var quotaBoxes = 0;
        var surplusBoxes = totalQualifyingBoxes;
        var referralDeducted = 0;
        var commissionDeducted = 0;
        var totalDeducted = 0;
        var policyLabel = isNoDeduct ? 'ไม่ตัดกล่อง (เก็บสถิติ/จ่ายเงินเต็ม 100%)' : 'ตัดกล่องโปรโมชั่น';

        if (!isNoDeduct && isQualified) {
          quotaBoxes = Math.min(totalQualifyingBoxes, targetBoxes); // ล็อคไม่เกินโควต้าเป้าหมาย (เช่น 5 กล่อง)
          surplusBoxes = Math.max(0, totalQualifyingBoxes - targetBoxes);

          // สำหรับกล่องโควต้า: คำนวณค่าคอมขายเองของผู้ขาย (250,000) และค่าแนะนำของ Upline (200,000)
          var remainingQuota = quotaBoxes;
          for (var qIdx = 0; qIdx < qualifyingSalesDetails.length && remainingQuota > 0; qIdx++) {
            var sItem = qualifyingSalesDetails[qIdx];
            var qInSale = Math.min(sItem.boxes, remainingQuota);
            var selfRate = sItem.selfRate !== undefined ? sItem.selfRate : 250000; // ค่าคอมขายเองของผู้ขาย
            var refRate = sItem.refRate !== undefined ? sItem.refRate : 200000;   // ค่าแนะนำ Upline

            commissionDeducted += (selfRate * qInSale);
            referralDeducted += (refRate * qInSale);
            remainingQuota -= qInSale;
          }

          if (deductType === 'per_box' && deductAmountSetting > 0) {
            commissionDeducted = deductAmountSetting * quotaBoxes;
          } else if (deductType === 'quota_total' && deductAmountSetting > 0 && commissionDeducted === 0) {
            commissionDeducted = deductAmountSetting;
          }

          // 🛡️ ยอดเงินที่ผู้ขายเองถูกตัดจริง (เฉพาะค่าคอมขายเอง = 5 x 250,000 = 1,250,000)
          // ค่าแนะนำ (referralDeducted = 1,000,000) ส่งไปแสดงแยกในแท็บ Upline/Drilldown
          totalDeducted = commissionDeducted;
        }

        return {
          memberId: memberId,
          memberName: m.name || memberId,
          profileUrl: m.profileUrl || m.id_card_url || null,
          team: teamName,
          teamName: teamName,
          
          // Clinic Checkups
          clinicPatientCount: patientVisits.length,
          clinicAbiPoints: abiPoints,
          clinicCompPoints: compPoints,
          clinicTotalPoints: totalClinicPoints,
          clinicTargetPoints: targetClinicPoints,
          clinicPassed: clinicPassed,
          patientVisits: patientVisits,

          // MLM Sales Boxes
          boxesTotalCount: totalQualifyingBoxes,
          boxesQualifyingQuota: quotaBoxes,
          boxesSurplusCount: surplusBoxes,
          boxesTarget: targetBoxes,
          boxesMinPrice: minBoxPrice,
          boxesPassed: boxesPassed,
          qualifyingSalesDetails: qualifyingSalesDetails,

          // Deduction Breakdown & Policy
          isNoDeduct: isNoDeduct,
          policyLabel: policyLabel,
          referralDeducted: referralDeducted,
          commissionDeducted: commissionDeducted,
          totalDeducted: totalDeducted,
          deductionBreakdown: {
            isNoDeduct: isNoDeduct,
            quotaBoxes: quotaBoxes,
            surplusBoxes: surplusBoxes,
            referralDeducted: referralDeducted,
            commissionDeducted: commissionDeducted,
            totalDeducted: totalDeducted
          },

          // Final Qualification & Commission
          isQualified: isQualified,
          currency: 'LAK',
          status: isQualified ? 'QUALIFIED' : 'IN_PROGRESS'
        };
      });

      // จัดเรียงผลลัพธ์: คนที่ผ่านเกณฑ์ขึ้นก่อน เรียงตามยอดแต้มตรวจและยอดกล่อง
      results.sort(function (a, b) {
        if (a.isQualified !== b.isQualified) return a.isQualified ? -1 : 1;
        if (a.isQualified && b.isQualified) {
          if (b.clinicTotalPoints !== a.clinicTotalPoints) return b.clinicTotalPoints - a.clinicTotalPoints;
          return b.boxesTotalCount - a.boxesTotalCount;
        }
        var pDiff = b.clinicTotalPoints - a.clinicTotalPoints;
        if (pDiff !== 0) return pDiff;
        return b.boxesTotalCount - a.boxesTotalCount;
      });

      return results;
    },

    // 5. ล็อกและบันทึกผลแคมเปญ Snapshot ลงฐานข้อมูล stk_campaign_results
    lockCampaignResults: async function (campaign, results, lockedBy) {
      if (!campaign || !Array.isArray(results) || results.length === 0) {
        return { success: false, error: 'No results to lock' };
      }
      if (typeof window.supabaseInsert !== 'function') {
        return { success: false, error: 'Supabase unavailable' };
      }

      var cId = campaign.id || campaign.campaign_id;
      var cTitle = campaign.title || campaign.name || 'แคมเปญ';
      var pStart = campaign.start_date;
      var pEnd = campaign.end_date;
      var userName = lockedBy || 'ADMIN';
      var nowIso = new Date().toISOString();

      try {
        for (var i = 0; i < results.length; i++) {
          var r = results[i];
          var recId = 'CRES-' + cId + '-' + r.memberId;
          var payload = {
            id: recId,
            campaign_id: cId,
            campaign_title: cTitle,
            member_id: r.memberId,
            member_name: r.memberName,
            team_name: r.teamName,
            period_start: pStart,
            period_end: pEnd,
            clinic_patients_count: r.clinicPatientCount,
            clinic_abi_points: r.clinicAbiPoints,
            clinic_comprehensive_points: r.clinicCompPoints,
            clinic_total_points: r.clinicTotalPoints,
            clinic_target_points: r.clinicTargetPoints,
            clinic_passed: r.clinicPassed,
            boxes_total_count: r.boxesTotalCount,
            boxes_qualifying_quota: r.boxesQualifyingQuota,
            boxes_surplus_count: r.boxesSurplusCount,
            boxes_target: r.boxesTarget,
            boxes_min_price: r.boxesMinPrice,
            boxes_passed: r.boxesPassed,
            is_qualified: r.isQualified,
            deduct_policy: r.isNoDeduct ? 'no_deduct' : 'deduct_quota',
            referral_deducted: r.referralDeducted || 0,
            commission_deducted: r.commissionDeducted || 0,
            total_deducted: r.totalDeducted || 0,
            currency: r.currency || 'LAK',
            details_json: {
              patientVisits: r.patientVisits,
              qualifyingSalesDetails: r.qualifyingSalesDetails
            },
            status: 'LOCKED',
            locked_at: nowIso,
            locked_by: userName,
            updated_at: nowIso
          };

          // บันทึกแบบ Upsert พร้อม Fallback หากฐานข้อมูลยังไม่ได้เพิ่มคอลัมน์ใหม่
          try {
            if (typeof window.supabaseUpsert === 'function') {
              await window.supabaseUpsert('stk_campaign_results', payload);
            } else {
              await window.supabaseInsert('stk_campaign_results', payload);
            }
          } catch (colErr) {
            var errMsg = String(colErr && colErr.message ? colErr.message : '');
            if (errMsg.includes('referral_deducted') || errMsg.includes('total_deducted') || errMsg.includes('deduct_policy')) {
              var safePayload = Object.assign({}, payload);
              delete safePayload.referral_deducted;
              delete safePayload.total_deducted;
              delete safePayload.deduct_policy;
              if (typeof window.supabaseUpsert === 'function') {
                await window.supabaseUpsert('stk_campaign_results', safePayload).catch(function(){});
              } else {
                await window.supabaseInsert('stk_campaign_results', safePayload).catch(function(){});
              }
            }
          }
        }

        if (window.invalidateTableCache) window.invalidateTableCache('stk_campaign_results');
        return { success: true, count: results.length };
      } catch (err) {
        console.error('Lock campaign error:', err);
        return { success: false, error: err.message || err };
      }
    },

    // 5.2 ซิงค์และบันทึกผลแคมเปญลงฐานข้อมูล stk_campaign_results อัตโนมัติ (Batch Upsert เร็วทันใจ 100ms)
    syncAndSaveCampaignResults: async function (campaign, results, status) {
      if (!campaign || !Array.isArray(results) || results.length === 0) return;
      if (typeof window.supabaseUpsert !== 'function' && typeof window.supabaseInsert !== 'function') return;

      var cId = campaign.id || campaign.campaign_id;
      var cTitle = campaign.title || campaign.name || 'แคมเปญ';
      var pStart = campaign.start_date;
      var pEnd = campaign.end_date;
      var nowIso = new Date().toISOString();

      try {
        var payloads = results.map(function (r) {
          var recId = 'CRES-' + cId + '-' + r.memberId;
          return {
            id: recId,
            campaign_id: cId,
            campaign_title: cTitle,
            member_id: r.memberId,
            member_name: r.memberName,
            team_name: r.teamName,
            period_start: pStart,
            period_end: pEnd,
            clinic_patients_count: r.clinicPatientCount || 0,
            clinic_abi_points: r.clinicAbiPoints || 0,
            clinic_comprehensive_points: r.clinicCompPoints || 0,
            clinic_total_points: r.clinicTotalPoints || 0,
            clinic_target_points: r.clinicTargetPoints || 0,
            clinic_passed: !!r.clinicPassed,
            boxes_total_count: r.boxesTotalCount || 0,
            boxes_qualifying_quota: r.boxesQualifyingQuota || 0,
            boxes_surplus_count: r.boxesSurplusCount || 0,
            boxes_target: r.boxesTarget || 0,
            boxes_min_price: r.boxesMinPrice || 1500,
            boxes_passed: !!r.boxesPassed,
            is_qualified: !!r.isQualified,
            deduct_policy: r.isNoDeduct ? 'no_deduct' : 'deduct_quota',
            referral_deducted: r.referralDeducted || 0,
            commission_deducted: r.commissionDeducted || 0,
            total_deducted: r.totalDeducted || 0,
            currency: r.currency || 'LAK',
            details_json: {
              patientVisits: r.patientVisits || [],
              qualifyingSalesDetails: r.qualifyingSalesDetails || [],
              deduction_breakdown: r.deductionBreakdown || {
                isNoDeduct: !!r.isNoDeduct,
                quotaBoxes: r.boxesQualifyingQuota || 0,
                surplusBoxes: r.boxesSurplusCount || 0,
                referralDeducted: r.referralDeducted || 0,
                commissionDeducted: r.commissionDeducted || 0,
                totalDeducted: r.totalDeducted || 0
              }
            },
            status: status || (r.isQualified ? 'QUALIFIED' : 'IN_PROGRESS'),
            updated_at: nowIso
          };
        });

        // Batch Upsert ในครั้งเดียว (ประหยัด Request Egress และทำงานทันที)
        if (typeof window.supabaseUpsert === 'function') {
          await window.supabaseUpsert('stk_campaign_results', payloads);
        } else if (typeof window.supabaseInsert === 'function') {
          await window.supabaseInsert('stk_campaign_results', payloads);
        }

        if (window.invalidateTableCache) window.invalidateTableCache('stk_campaign_results');
        return { success: true, count: payloads.length };
      } catch (e) {
        console.warn('Batch sync campaign results error, falling back:', e);
        // Fallback: Safe columns batch
        try {
          var safePayloads = payloads.map(function(p) {
            var clone = Object.assign({}, p);
            delete clone.referral_deducted;
            delete clone.total_deducted;
            delete clone.deduct_policy;
            return clone;
          });
          if (typeof window.supabaseUpsert === 'function') {
            await window.supabaseUpsert('stk_campaign_results', safePayloads);
          }
        } catch(e2) {
          console.warn('Fallback sync error:', e2);
        }
      }
    },

    // 6. ดึงผลแคมเปญที่บันทึกไว้ (สำหรับโหลดเร็วทันใจแบบ Tier 1)
    fetchSavedCampaignResults: async function (campaignId) {
      if (typeof window.supabaseSelect !== 'function' || !campaignId) return [];
      try {
        var query = 'campaign_id=eq.' + encodeURIComponent(campaignId) + '&order=is_qualified.desc,clinic_total_points.desc,boxes_total_count.desc';
        var data = await window.supabaseSelect('stk_campaign_results', query);
        return Array.isArray(data) ? data : [];
      } catch (e) {
        return [];
      }
    },

    fetchLockedCampaignResults: async function (campaignId) {
      if (typeof window.supabaseSelect !== 'function' || !campaignId) return [];
      try {
        var query = 'campaign_id=eq.' + encodeURIComponent(campaignId) + '&order=is_qualified.desc,clinic_total_points.desc';
        var data = await window.supabaseSelect('stk_campaign_results', query);
        return Array.isArray(data) ? data : [];
      } catch (e) {
        return [];
      }
    },

    // รวบรวม Sections ทุกแคมเปญ active → สำหรับ Mlm.html
    buildCampaignSections: async function (allSales, allMembers, allCustomers, allBusinessTeams) {
      var campaigns = await this.fetchActiveCampaigns();
      if (!campaigns || campaigns.length === 0) return [];
      var engine = this;
      return campaigns.map(function (camp) {
        var results = engine.calcCampaignResults(camp, allSales, allMembers, allCustomers, allBusinessTeams);
        return {
          campaign: camp,
          results: results,
          passed: results.filter(function (r) { return r.passed; }),
          notPassed: results.filter(function (r) { return !r.passed; })
        };
      });
    }
  };

  console.log('%c🏆 CampaignEngine loaded with Cross-DB & Clinic Scoring Engine', 'color:#f59e0b;font-weight:bold');
})();

