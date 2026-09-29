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

    // 1.1 ถ้าพบคำว่า VIS-ORD, VISIT-ORD หรือ ORD- ถือเป็นออเดอร์ที่คีย์ขายเองเด็ดขาด -> ไม่นับเป็นลูกค้าใหม่มาตรวจ
    if (upperNote.indexOf('VIS-ORD') !== -1 || upperNote.indexOf('VISIT-ORD') !== -1 || upperNote.indexOf('ORD-') !== -1) {
      return false;
    }

    // 1.2 ต้องมีรหัส VISIT แล้วตามด้วยตัวเลข (เช่น "VISIT: VIS-882756", "VIS-882756", "VISIT: 882756", "VISIT-882756")
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

    // 🛡️ ปฏิบัติตามฟิลเตอร์วันที่อย่างเคร่งครัด:
    // 3.1 วันที่ของบิลขายต้องอยู่ในช่วงวันที่แคมเปญ (startDate ถึง endDate)
    if (s && startDate && endDate) {
      var sDate = parseSaleDate(s);
      if (sDate && (sDate < startDate || sDate > endDate)) return false;
    }

    // 3.2 ลูกค้าต้องเป็นลูกค้าใหม่ที่มาตรวจในช่วงแคมเปญนี้เท่านั้น
    // หากข้อมูลลูกค้าบันทึกว่าสร้าง/สมัครไว้ก่อน startDate จะถือเป็นลูกค้าเดิมที่เคยมาตรวจก่อนหน้า ไม่นับเป็นคนใหม่ของแคมเปญนี้
    if (cust && startDate) {
      var custDate = String(cust.created_date || cust.created_at || '').trim().substring(0, 10);
      if (custDate && custDate < startDate) {
        return false;
      }
    }

    return true;
  }

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

    // คำนวณผล Marketing พนักงานทุกคน สำหรับ 1 แคมเปญ
    calcCampaignResults: function (campaign, allSales, allMembers, allCustomers, allBusinessTeams) {
      if (!campaign) return [];
      var startDate = String(campaign.start_date || '').trim().substring(0, 10);
      var endDate = String(campaign.end_date || '').trim().substring(0, 10);

      var teamsMap = buildTeamsMap(allBusinessTeams);

      // lookup map ลูกค้า (HN, ID, เบอร์โทร, ชื่อ)
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

      // เฉพาะ Marketing members (คัดกรองเฉพาะพนักงานการตลาด และตัดฝ่ายเซ็นเตอร์ออก)
      var marketingMembers = (allMembers || []).filter(function (m) {
        return isMarketingMember(m, teamsMap);
      });

      // กรองขายในช่วงวันที่แคมเปญเท่านั้น (startDate ถึง endDate) อย่างเคร่งครัด
      var salesInRange = (allSales || []).filter(function (s) {
        if (!s) return false;
        var d = parseSaleDate(s);
        if (startDate && d < startDate) return false;
        if (endDate && d > endDate) return false;
        return true;
      });

      // Helper ดึงเวลาเต็มสำหรับเรียงลำดับบิลตามเวลาจริง
      function getSaleFullTime(s) {
        if (!s) return '';
        var dt = String(s.created_at || '').trim();
        if (dt) return dt;
        var d = String(s.date || s.sale_date || '').trim();
        var t = String(s.time || s.sale_time || '00:00:00').trim();
        return d ? (d + ' ' + t) : '';
      }

      // เรียงบิลขายตามเวลา จากเช้าไปเย็น / วันแรกไปวันหลัง เพื่อหาว่าใครผ่านเกณฑ์ก่อน-หลัง
      salesInRange.sort(function (a, b) {
        var tA = getSaleFullTime(a);
        var tB = getSaleFullTime(b);
        if (tA !== tB) return tA.localeCompare(tB);
        return String(a.id || a.bill_id || '').localeCompare(String(b.id || b.bill_id || ''));
      });

      // สร้าง map สำหรับคำนวณ
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
          newCustSet: {},   // บันทึกรหัสลูกค้าที่พามาตรวจในช่วงแคมเปญ
          qualifiedOrder: null, // ลำดับที่ผ่านเกณฑ์ (1, 2, 3...)
          qualifiedAt: null     // เวลาที่ผ่านเกณฑ์
        };
      });

      var cond1Target = Number(campaign.cond1_target || 0);
      var cond2Target = Number(campaign.cond2_target || 0);
      var qualificationSeq = 0;

      // ตรวจสอบผู้ที่ผ่านทันที (กรณีเป้าหมายเป็น 0 หรือไม่ได้เปิดเงื่อนไขใดเลย)
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

      // ── ประมวลผลบิลตามลำดับเวลาจริง (Chronological Evaluation) ──
      salesInRange.forEach(function (s) {
        var memberId = parseSaleMemberId(s);
        if (!memberId) return;
        var key = safeUp(memberId);
        if (!memberMap[key]) return;

        var custId = safeUp((s.customerId || s.customer_id || s.hn || s.customerName || s.customer_name) || '');
        var isCheckup = isNewCheckupSale(s, customersMap, startDate, endDate);

        // คำนวณจำนวนกล่องที่ราคาต่อชิ้น >= minPrice
        var minPrice = Number(campaign.cond2_min_price || 0);
        var qualifyingBoxes = 0;

        var itemsList = null;
        if (s.items_json) {
          try {
            itemsList = typeof s.items_json === 'string' ? JSON.parse(s.items_json) : s.items_json;
          } catch(e) {}
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

        // 🛡️ นับเฉพาะคนมาตรวจคลินิกจริง (VISIT: VIS-<ตัวเลข> ที่ไม่ใช่ VIS-ORD-) และในบิลนั้นต้องมีสินค้าราคา >= 1,500 บาท
        // หากตรงเงื่อนไขจะนับเป็น 1 แต้ม (1 คนมาตรวจ = 1 บิลสินค้า >= 1,500 บาท) ค่าทั้งสองจะเท่ากันพอดี ไม่นับบิลออเดอร์คีย์ขายเอง
        if (isCheckup && qualifyingBoxes > 0) {
          var uniqueSaleKey = s.id || s.sale_id || s.bill_id || (custId ? (custId + '_' + (s.date || '') + '_' + (s.time || '')) : ('sale_' + Math.random()));
          if (campaign.cond1_enabled) {
            memberMap[key].newCustSet[uniqueSaleKey] = true;
          }
          if (campaign.cond2_enabled) {
            memberMap[key].actual_cond2 += 1;
          }
        }

        // ตรวจสอบทันทีว่าคนนี้ผ่านครบทุกเกณฑ์ ณ บิลนี้หรือไม่
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

      // สรุปผล
      var results = Object.values(memberMap).map(function (m) {
        var actual1 = Object.keys(m.newCustSet).length;
        var actual2 = m.actual_cond2;
        var passed = true;
        if (campaign.cond1_enabled && actual1 < cond1Target) passed = false;
        if (campaign.cond2_enabled && actual2 < cond2Target) passed = false;

        // หากผ่านเกณฑ์แต่ยังไม่มีลำดับ (กรณีพิเศษ)
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

      // เรียงลำดับ:
      // 1. ผู้ผ่านเกณฑ์: เรียงตามคนที่ผ่านก่อนเป็นอันดับ 1, 2, 3 ตามลำดับเวลาจริง
      // 2. ผู้ที่ยังไม่ผ่าน: เรียงตามเปอร์เซ็นต์ความคืบหน้าจากมากไปน้อย
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
        // จัดเรียงคนที่ยังไม่ผ่าน: ให้ความสำคัญกับคนที่ได้คนมาตรวจ (actual_cond1) สูงสุดขึ้นมาก่อน
        // หากคนมาตรวจเท่ากัน ให้เรียงตามความคืบหน้ารวม/จำนวนบิล (actual_cond2)
        if (a.actual_cond1 !== b.actual_cond1) {
          return b.actual_cond1 - a.actual_cond1;
        }
        var scoreA = (a.pct2 !== null ? a.pct2 : (a.pct1 || 0));
        var scoreB = (b.pct2 !== null ? b.pct2 : (b.pct1 || 0));
        return scoreB - scoreA;
      });

      return results;
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

  console.log('%c🏆 CampaignEngine loaded', 'color:#f59e0b;font-weight:bold');
})();

