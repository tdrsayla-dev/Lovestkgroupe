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

  function isMarketingMember(m) {
    if (!m) return false;
    var role = String(m.role || m.permission_role || '').trim();
    var team = String(m.team || m.business_team || '').trim().toUpperCase();
    return role === 'พนักงานการตลาด' || role.indexOf('การตลาด') !== -1 || role.toUpperCase().indexOf('MARKETING') !== -1 || team.indexOf('MARKETING') !== -1 || team.indexOf('การตลาด') !== -1;
  }

  function isNewCheckupSale(s, customersMap) {
    var cType = String((s && (s.customerType || s.customer_type)) || '').trim();
    if (!cType && customersMap) {
      var cId = safeUp((s && (s.customerId || s.customer_id || s.hn)) || '');
      var cust = cId ? customersMap[cId] : null;
      if (!cust && s && (s.customerName || s.customer_name)) {
        cust = customersMap[safeUp(s.customerName || s.customer_name)];
      }
      if (cust) cType = String(cust.customer_type || cust.customerType || cust.type || '').trim();
    }
    if (!cType) return false;

    // กฎสำคัญ: ต้องเป็น "ลูกค้าใหม่มาตรวจ" เท่านั้น (ลูกค้าใหม่เฉยๆ ไม่เกี่ยว, เก่า/ต่อยา/ไม่มาตรวจ ไม่นับ)
    var hasCheckup = cType.indexOf('มาตรวจ') !== -1 || (cType.indexOf('ตรวจ') !== -1 && cType.indexOf('ไม่มาตรวจ') === -1);
    var notOld = cType.indexOf('เก่า') === -1 && cType.indexOf('ต่อยา') === -1 && cType.indexOf('ไม่มาตรวจ') === -1;
    return hasCheckup && notOld;
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
    calcCampaignResults: function (campaign, allSales, allMembers, allCustomers) {
      if (!campaign) return [];
      var startDate = campaign.start_date || '';
      var endDate = campaign.end_date || '';

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

      // เฉพาะ Marketing members
      var marketingMembers = (allMembers || []).filter(isMarketingMember);

      // กรองขายในช่วงวันที่แคมเปญเท่านั้น (startDate ถึง endDate)
      var salesInRange = (allSales || []).filter(function (s) {
        if (!s) return false;
        var d = parseSaleDate(s);
        return d >= startDate && d <= endDate;
      });

      // สร้าง map สำหรับคำนวณ
      var memberMap = {};
      marketingMembers.forEach(function (m) {
        var key = safeUp(m.user_id || m.id || '');
        if (!key) return;
        memberMap[key] = {
          memberId: m.user_id || m.id,
          name: m.name || key,
          profileUrl: m.profileUrl || m.id_card_url || null,
          team: m.team || m.business_team || '',
          actual_cond2: 0,
          newCustSet: {}   // บันทึกรหัสลูกค้าที่พามาตรวจในช่วงแคมเปญ
        };
      });

      // ── รอบที่ 1: บันทึกคนมาตรวจ (unique customer) ในช่วงแคมเปญ ──
      if (campaign.cond1_enabled) {
        salesInRange.forEach(function (s) {
          var memberId = parseSaleMemberId(s);
          if (!memberId) return;
          var key = safeUp(memberId);
          if (!memberMap[key]) return;

          var custId = safeUp((s.customerId || s.customer_id || s.hn || s.customerName || s.customer_name) || '');
          if (isNewCheckupSale(s, customersMap) && custId) {
            memberMap[key].newCustSet[custId] = true;
          }
        });
      }

      // ── รอบที่ 2: นับจำนวนบิลที่มีการสั่งซื้อยา >= min_price อย่างน้อย 1 กล่อง (1 บิล = 1 แต้ม) ──
      // กฎตามที่ผู้ใช้กำหนด:
      // นับเฉพาะบิลของ "ลูกค้าใหม่มาตรวจ" ในช่วงวันที่แคมเปญกำหนด
      // ภายในบิลนั้นมีสินค้าราคา >= min_price (เช่น 1,500฿) ตั้งแต่ 1 กล่องขึ้นไป
      // ให้นับเป็น 1 แต้มต่อบิล (1 บิล ต่อ 1 คะแนน สะสมให้ครบเป้าหมาย เช่น 15 บิล)
      salesInRange.forEach(function (s) {
        var memberId = parseSaleMemberId(s);
        if (!memberId) return;
        var key = safeUp(memberId);
        if (!memberMap[key]) return;

        if (campaign.cond2_enabled) {
          var custId = safeUp((s.customerId || s.customer_id || s.hn || s.customerName || s.customer_name) || '');
          var isCheckup = isNewCheckupSale(s, customersMap);

          // ถ้าเปิดเงื่อนไข 1 (คนมาตรวจ) บิลต้องมาจากการพาคนมาตรวจ หรือลูกค้าที่พามาตรวจในแคมเปญนี้
          var shouldCount = true;
          if (campaign.cond1_enabled) {
            shouldCount = isCheckup || (custId && !!memberMap[key].newCustSet[custId]);
          }

          if (shouldCount) {
            var minPrice = Number(campaign.cond2_min_price || 0);
            var hasQualifyingBox = false;
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
                  hasQualifyingBox = true;
                  break;
                }
              }
            } else {
              var boxes = parseSaleBoxes(s);
              var unitPrice = Number((s.unit_price || s.unitPrice || s.price_full || s.priceFull) || 0);
              if (unitPrice === 0 && boxes > 0) {
                var totalAmt = Number(s.total_amount_thb || s.totalAmountThb || s.total_amount || s.amount || 0);
                if (totalAmt > 0) unitPrice = totalAmt / boxes;
              }
              if (boxes > 0 && (minPrice === 0 || unitPrice >= minPrice)) {
                hasQualifyingBox = true;
              }
            }

            if (campaign.cond1_enabled) {
              // 🎯 เงื่อนไขผูกกับการพาคนมาตรวจ: 1 บิลที่มีการซื้อยา >= minPrice (1 กล่องขึ้นไป) = 1 แต้ม
              if (hasQualifyingBox) {
                memberMap[key].actual_cond2 += 1;
              }
            } else {
              // กรณีแคมเปญแข่งยอดกล่องรวมทั่วไป: นับจำนวนกล่องทั้งหมด
              if (Array.isArray(itemsList) && itemsList.length > 0) {
                var qualifiedBoxes = 0;
                itemsList.forEach(function (it) {
                  var q = parseInt(it.qty || it.quantity || 1) || 0;
                  var p = parseFloat(it.unitPrice !== undefined ? it.unitPrice : (it.price !== undefined ? it.price : 0)) || 0;
                  if (q > 0 && (minPrice === 0 || p >= minPrice)) {
                    qualifiedBoxes += q;
                  }
                });
                memberMap[key].actual_cond2 += qualifiedBoxes;
              } else {
                var bCount = parseSaleBoxes(s);
                var uPrice = Number((s.unit_price || s.unitPrice || s.price_full || s.priceFull) || 0);
                if (uPrice === 0 && bCount > 0) {
                  var tAmt = Number(s.total_amount_thb || s.totalAmountThb || s.total_amount || s.amount || 0);
                  if (tAmt > 0) uPrice = tAmt / bCount;
                }
                if (bCount > 0 && (minPrice === 0 || uPrice >= minPrice)) {
                  memberMap[key].actual_cond2 += bCount;
                }
              }
            }
          }
        }
      });

      // สรุปผล
      var cond1Target = Number(campaign.cond1_target || 0);
      var cond2Target = Number(campaign.cond2_target || 0);

      var results = Object.values(memberMap).map(function (m) {
        var actual1 = Object.keys(m.newCustSet).length;
        var actual2 = m.actual_cond2;
        var passed = true;
        if (campaign.cond1_enabled && actual1 < cond1Target) passed = false;
        if (campaign.cond2_enabled && actual2 < cond2Target) passed = false;
        var pct1 = (campaign.cond1_enabled && cond1Target > 0) ? Math.min(Math.round((actual1 / cond1Target) * 100), 100) : null;
        var pct2 = (campaign.cond2_enabled && cond2Target > 0) ? Math.min(Math.round((actual2 / cond2Target) * 100), 100) : null;
        return { memberId: m.memberId, name: m.name, profileUrl: m.profileUrl, team: m.team, actual_cond1: actual1, actual_cond2: actual2, pct1: pct1, pct2: pct2, passed: passed };
      });

      // เรียง: ผ่านก่อน → คะแนนสูงกว่า
      results.sort(function (a, b) {
        if (a.passed !== b.passed) return a.passed ? -1 : 1;
        var sA = (a.pct2 !== null ? a.pct2 : (a.pct1 || 0));
        var sB = (b.pct2 !== null ? b.pct2 : (b.pct1 || 0));
        return sB - sA;
      });

      return results;
    },

    // รวบรวม Sections ทุกแคมเปญ active → สำหรับ Mlm.html
    buildCampaignSections: async function (allSales, allMembers, allCustomers) {
      var campaigns = await this.fetchActiveCampaigns();
      if (!campaigns || campaigns.length === 0) return [];
      var engine = this;
      return campaigns.map(function (camp) {
        var results = engine.calcCampaignResults(camp, allSales, allMembers, allCustomers);
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

