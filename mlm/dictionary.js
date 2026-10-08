// ==========================================
// 🌐 STK GROUPE - Global Dictionary
// ==========================================

window.stkDict = {
    // ---- เมนูหลัก (Sidebar) ----
    "menu_dashboard": { th: "แดชบอร์ด", lo: "ແດຊບອດ", en: "Dashboard" },
    "menu_reports": { th: "รายงานสรุปผลงาน", lo: "ລາຍງານສະຫຼຸບຜົນງານ", en: "Reports" },
    "menu_reports_sales": { th: "ยอดขาย", lo: "ຍອດຂາຍ", en: "Sales" },
    "menu_reports_finance": { th: "การเงิน", lo: "ການເງິນ", en: "Finance" },
    "menu_reports_stock": { th: "สต๊อกสินค้า", lo: "ສະຕ໋ອກສິນຄ້າ", en: "Stock" },
    "menu_reports_referral": { th: "ค่าแนะนำ", lo: "ຄ່າແນະນຳ", en: "Referral" },
    "menu_reports_campaign": { th: "แคมเปญ", lo: "ແຄມເປນ", en: "Campaigns" },
    "menu_org_chart": { th: "ผังองค์กรสายงาน", lo: "ຜັງອົງກອນສາຍງານ", en: "Organization Chart" },
    "menu_daily_transactions": { th: "ธุรกรรมประจำวัน", lo: "ທຸລະກຳປະຈຳວັນ", en: "Daily Transactions" },
    "menu_sales": { th: "ป้อนข้อมูลขาย", lo: "ປ້ອນຂໍ້ມູນຂາຍ", en: "Sales Entry" },
    "menu_b2b": { th: "ขายส่ง", lo: "ຂາຍສົ່ງ", en: "Wholesale" },
    "menu_b2b_short": { th: "ขายส่ง", lo: "ຂາຍສົ່ງ", en: "Wholesale" },
    "menu_nutrients": { th: "จ่ายยา", lo: "ຈ່າຍຢາ", en: "Prescriptions" },
    "menu_orders": { th: "จัดการบิล", lo: "ຈັດການບິນ", en: "Order Management" },
    "menu_customers": { th: "ข้อมูลลูกค้า", lo: "ຂໍ້ມູນລູກຄ້າ", en: "Customers" },
    "menu_settings": { th: "ตั้งค่าระบบ", lo: "ຕັ້ງຄ່າລະບົບ", en: "System Settings" },

    // ---- แท็บเมนูหน้าขายส่ง (B2B Tabs) ----
    "tab_b2b_new_order": { th: "เปิดบิลขายส่ง", lo: "ເປີດບິນຂາຍສົ່ງ", en: "New Wholesale Order" },
    "tab_b2b_orders": { th: "ประวัติบิล", lo: "ປະຫວັດບິນ", en: "Order History" },
    "tab_b2b_products_tiers": { th: "ตั้งค่าสินค้า & เรทราคา", lo: "ຕັ້ງຄ່າສິນຄ້າ & ເຣດລາຄາ", en: "Products & Tiers" },
    "b2b_header_title": { th: "ระบบการขายส่ง B2B", lo: "ລະບົບຂາຍສົ່ງ B2B", en: "B2B Wholesale System" },
    "b2b_portal_badge": { th: "Wholesale Portal", lo: "Wholesale Portal", en: "Wholesale Portal" },
    "b2b_buyer_member": { th: "พนักงาน / ตัวแทน", lo: "ພະນັກງານ / ຕົວແທນ", en: "Staff / Agent" },
    "b2b_buyer_customer": { th: "ลูกค้าทั่วไป / ร้านค้า", lo: "ລູກຄ້າທົ່ວໄປ / ຮ້ານຄ້າ", en: "General / Store" },

    // ---- ระบบจัดการคลังสินค้า (Warehouse Module) ----
    "wh_header_title": { th: "ระบบจัดการคลังสินค้า & สต๊อกแยกล็อต", lo: "ລະບົບຈັດການສາງສິນຄ້າ & ສະຕ໋ອກແຍກລັອດ", en: "Warehouse & Lot Inventory Management" },
    "wh_header_subtitle": { th: "จัดการหลายคลังสินค้า, วันหมดอายุตามล็อต, การเบิกย้าย และกระทบยอดประจำวัน", lo: "ລະບົບຫຼາຍສາງສິນຄ້າ, ຕິດຕາມວັນໝົດອາຍຸຕາມລັອດ, ການເບີກຍ້າຍ ແລະ ກວດຍອດປະຈຳວັນ", en: "Multi-Warehouse, FEFO Expiry, Transfer Requisition & Daily Balance" },

    // แท็บเมนูคลังสินค้า (Warehouse Tabs)
    "wh_tab_overview": { th: "1. ภาพรวมสต๊อก & วันหมดอายุ", lo: "1. ພາບລວມສະຕ໋ອກ & ວັນໝົດອາຍຸ", en: "1. Stock Overview & Expiry" },
    "wh_tab_stockin": { th: "2. รับเข้าสินค้าตามล็อต", lo: "2. ຮັບເຂົ້າສິນຄ້າຕາມລັອດ", en: "2. Stock In by Lot" },
    "wh_tab_transfer": { th: "3. เบิกย้ายสินค้า (คลังใหญ่ ➔ หน้าร้าน)", lo: "3. ເບີກຍ້າຍສິນຄ້າ (ສາງໃຫຍ່ ➔ ໜ້າຮ້ານ)", en: "3. Stock Transfer (Main WH ➔ Front Store)" },
    "wh_tab_audit": { th: "4. ตรวจนับและกระทบยอดสต๊อกประจำวัน", lo: "4. ກວດນັບ & ປັບຍອດສະຕ໋ອກປະຈຳວັນ", en: "4. Daily Stock Audit & Balance" },
    "wh_tab_ledger": { th: "5. สมุดบัญชีสต๊อกย้อนหลัง", lo: "5. ປຶ້ມບັນຊີສະຕ໋ອກຍ້ອນຫຼັງ", en: "5. Historical Stock Ledger" },

    // โดเมนสินค้า
    "wh_domain_stk": { th: "สินค้าเสริมอาหาร", lo: "ສິນຄ້າອາຫານເສີມ", en: "Supplements" },
    "wh_domain_pharmacy": { th: "คลังยาหลวง", lo: "ສາງຢາຫຼວງ", en: "Pharmacy Warehouse" },
    "wh_domain_devices": { th: "เครื่องมือแพทย์", lo: "ເຄື່ອງມືແພດ", en: "Medical Devices" },
    "wh_btn_refresh": { th: "รีเฟรชสต๊อก", lo: "ຣີເຟຣຊສະຕ໋ອກ", en: "Refresh Stock" },
    "wh_btn_syncing": { th: "กำลังซิงค์...", lo: "ກຳລັງຊິງຄ໌...", en: "Syncing..." },

    // การ์ดสรุปสต๊อก (KPI Cards)
    "wh_kpi_total_sku": { th: "รายการสินค้า", lo: "ລາຍການສິນຄ້າ", en: "Total Products (SKU)" },
    "wh_kpi_main_wh": { th: "คลังใหญ่", lo: "ສາງໃຫຍ່", en: "Main Warehouse" },
    "wh_kpi_front_wh": { th: "ห้องขายหน้าร้าน", lo: "ຫ້ອງຂາຍໜ້າຮ້ານ", en: "Front Store" },
    "wh_kpi_total_all": { th: "รวมทุกคลัง", lo: "ລວມທຸກສາງ", en: "Total Stock" },
    "wh_kpi_expiring": { th: "ใกล้หมดอายุ (≤90 วัน)", lo: "ໃກ້ໝົດອາຍຸ (≤90 ວັນ)", en: "Expiring Soon (≤90 Days)" },
    "wh_kpi_expired": { th: "หมดอายุแล้ว", lo: "ໝົດອາຍຸແລ້ວ", en: "Expired" },

    // คำอธิบายย่อย KPI
    "wh_kpi_sub_promo_added": { th: "สินค้าหลัก (มัดชุดโปร +", lo: "ສິນຄ້າຫຼັກ (ມັດຊຸດໂປຣ +", en: "Main Products (Bundle sets +" },
    "wh_kpi_sub_in_domain": { th: "ในหมวดหมู่ปัจจุบัน", lo: "ໃນໝວດໝູ່ປັດຈຸບັນ", en: "In current category" },
    "wh_kpi_sub_main": { th: "ชิ้น / พร้อมเบิก (สต๊อกจริง)", lo: "ອັນ / ພ້ອມເບີກ (ສະຕ໋ອກຕົວຈິງ)", en: "Units / Available (Physical)" },
    "wh_kpi_sub_front": { th: "ชิ้น / พร้อมขาย (สต๊อกจริง)", lo: "ອັນ / ພ້ອມຂາຍ (ສະຕ໋ອກຕົວຈິງ)", en: "Units / Ready for Sale" },
    "wh_kpi_sub_total": { th: "ชิ้นสินค้าจริงทั้งหมด", lo: "ຈຳນວນສິນຄ້າຕົວຈິງທັງໝົດ", en: "Total Physical Units" },
    "wh_kpi_sub_expiring": { th: "ควรเร่งระบายออก", lo: "ຄວນຮີບລະບາຍອອກ", en: "Action Recommended" },
    "wh_kpi_sub_expired": { th: "ต้องกักกัน / ตัดทิ้ง", lo: "ຕ້ອງກັກກັນ / ຕັດຖິ້ມ", en: "Quarantine / Discard" },

    // ตัวกรองและค้นหา (Filters & Search)
    "wh_search_placeholder": { th: "ค้นหาชื่อสินค้า, รหัสสินค้า, หรือบาร์โค้ด...", lo: "ຄົ້ນຫາຊື່ສິນຄ້າ, ລະຫັດສິນຄ້າ, ຫຼື ບາໂຄ້ດ...", en: "Search product name, SKU, or barcode..." },
    "wh_filter_all": { th: "ทั้งหมด", lo: "ທັງໝົດ", en: "All" },
    "wh_filter_physical": { th: "📦 สินค้าหลัก", lo: "📦 ສິນຄ້າຫຼັກ", en: "📦 Main Products" },
    "wh_filter_bundle": { th: "🎁 เซ็ตโปรโมชั่น", lo: "🎁 ເຊັດໂປຣໂມຊັ່ນ", en: "🎁 Promo Bundles" },
    "wh_label_status": { th: "สถานะสต๊อก:", lo: "ສະຖານະສະຕ໋ອກ:", en: "Stock Status:" },
    "wh_status_all": { th: "ทั้งหมด", lo: "ທັງໝົດ", en: "All" },
    "wh_status_expiring": { th: "ใกล้หมดอายุ (≤90 วัน)", lo: "ໃກ້ໝົດອາຍຸ (≤90 ວັນ)", en: "Expiring Soon (≤90 Days)" },
    "wh_status_critical": { th: "วิกฤติเร่งระบาย (≤30 วัน)", lo: "ວິກິດຮີບລະບາຍ (≤30 ວັນ)", en: "Critical (≤30 Days)" },
    "wh_status_expired": { th: "หมดอายุแล้ว", lo: "ໝົດອາຍຸແລ້ວ", en: "Expired" },
    "wh_label_sort": { th: "จัดเรียง:", lo: "ຈັດລຽງ:", en: "Sort By:" },
    "wh_sort_id_asc": { th: "รหัสสินค้า (ก-ฮ / A-Z)", lo: "ລະຫັດສິນຄ້າ (A-Z)", en: "Product Code (A-Z)" },
    "wh_sort_id_desc": { th: "รหัสสินค้า (ฮ-ก / Z-A)", lo: "ລະຫັດສິນຄ້າ (Z-A)", en: "Product Code (Z-A)" },
    "wh_sort_name_asc": { th: "ชื่อสินค้า (ก-ฮ)", lo: "ຊື່ສິນຄ້າ (A-Z)", en: "Product Name (A-Z)" },
    "wh_sort_name_desc": { th: "ชื่อสินค้า (ฮ-ก)", lo: "ຊື່ສິນຄ້າ (Z-A)", en: "Product Name (Z-A)" },
    "wh_sort_stock_desc": { th: "สต๊อกรวมมากสุด ➔ น้อยสุด", lo: "ສະຕ໋ອກລວມຫຼາຍສຸດ ➔ ໜ້ອຍສຸດ", en: "Total Stock (High ➔ Low)" },
    "wh_sort_stock_asc": { th: "สต๊อกรวมน้อยสุด ➔ มากสุด", lo: "ສະຕ໋ອກລວມໜ້ອຍສຸດ ➔ ຫຼາຍສຸດ", en: "Total Stock (Low ➔ High)" },
    "wh_sort_expiry_asc": { th: "วันหมดอายุเร็วสุด", lo: "ວັນໝົດອາຍຸໄວສຸດ", en: "Earliest Expiry (FEFO)" },
    "wh_sort_expiry_desc": { th: "วันหมดอายุช้าสุด", lo: "ວັນໝົດອາຍຸຊ້າສຸດ", en: "Latest Expiry" },

    // ตารางสต๊อกตามคลัง (Warehouse Breakdown Table)
    "wh_table_breakdown_title": { th: "รายการสินค้าและการกระจายตัวตามคลัง", lo: "ລາຍການສິນຄ້າ ແລະ ການກະຈາຍຕາມສາງ", en: "Product List & Warehouse Breakdown" },
    "wh_items_unit": { th: "รายการ", lo: "ລາຍການ", en: "Items" },
    "wh_hint_click_sort": { th: "คลิกหัวตารางเพื่อจัดเรียงข้อมูล", lo: "ຄລິກຫົວຕາຕະລາງເພື່ອຈັດລຽງຂໍ້ມູນ", en: "Click table headers to sort" },
    "wh_badge_fefo_rule": { th: "ลำดับการจ่ายยึดตามวันหมดอายุเร็วสุด", lo: "ລຳດັບການຕັດຈ່າຍຕາມວັນໝົດອາຍຸໄວສຸດ", en: "FEFO Priority (First Expired, First Out)" },

    // หัวตาราง
    "wh_col_img_id": { th: "รูป / รหัส", lo: "ຮູບ / ລະຫັດ", en: "Image / Code" },
    "wh_col_product_name": { th: "ชื่อสินค้า", lo: "ຊື່ສິນຄ້າ", en: "Product Name" },
    "wh_col_main_wh": { th: "คลังใหญ่", lo: "ສາງໃຫຍ່", en: "Main Warehouse" },
    "wh_col_front_wh": { th: "ห้องขายหน้าร้าน", lo: "ຫ້ອງຂາຍໜ້າຮ້ານ", en: "Front Store" },
    "wh_col_total_stock": { th: "สต๊อกรวม", lo: "ສະຕ໋ອກລວມ", en: "Total Stock" },
    "wh_col_earliest_expiry": { th: "วันหมดอายุเร็วสุด", lo: "ວັນໝົດອາຍຸໄວສຸດ", en: "Earliest Expiry (FEFO)" },
    "wh_col_lot_status": { th: "สถานะล็อต", lo: "ສະຖານະລັອດ", en: "Lot Status" },
    "wh_col_action": { th: "จัดการ", lo: "ຈັດການ", en: "Action" },
    "wh_no_products_found": { th: "ไม่พบรายการสินค้าในเงื่อนไขที่เลือก", lo: "ບໍ່ພົບລາຍການສິນຄ້າໃນເງື່ອນໄຂທີ່ເລືອກ", en: "No products found matching criteria" },
    "wh_btn_view_lots": { th: "ดูล็อต", lo: "ເບິ່ງລັອດ", en: "View Lots" },

    // แท็บ 2 รับเข้าสินค้า (Tab 2 Stock In)
    "wh_tab2_sub_form": { th: "📥 บันทึกรับเข้าสินค้า (สร้างใบรับสินค้า)", lo: "📥 ບັນທຶກຮັບເຂົ້າສິນຄ້າ (ສ້າງໃບຮັບ)", en: "📥 Stock In (Create GRN)" },
    "wh_tab2_sub_history": { th: "📋 ประวัติใบรับสินค้าเข้าคลัง", lo: "📋 ປະຫວັດໃບຮັບສິນຄ້າເຂົ້າສາງ", en: "📋 Goods Receipt History" },
    "wh_tab2_grn_form_title": { th: "ใบรับสินค้าเข้าคลัง", lo: "ໃບຮັບສິນຄ້າເຂົ້າສາງ", en: "Goods Receipt Note (GRN)" },
    "wh_tab2_grn_form_sub": { th: "รับสินค้าเข้าคลังหลายรายการพร้อมกันใน 1 ใบรับ พร้อมระบุเลขล็อตและวันหมดอายุ", lo: "ຮັບສິນຄ້າເຂົ້າສາງຫຼາຍລາຍການພ້ອມກັນໃນ 1 ໃບຮັບ ພ້ອມລະບຸເລກລັອດ ແລະ ວັນໝົດອາຍຸ", en: "Receive multiple items in one GRN with batch lot and FEFO expiry tracking" },
    "wh_tab2_grn_no": { th: "เลขที่ใบรับสินค้า", lo: "ເລກທີໃບຮັບສິນຄ້າ", en: "GRN Document No." },

    // แท็บ 3 เบิกย้ายสินค้า (Tab 3 Transfer)
    "wh_tab3_sub_form": { th: "📝 บันทึกใบเบิกย้ายสินค้า", lo: "📝 ບັນທຶກໃບເບີກຍ້າຍສິນຄ້າ", en: "📝 Internal Stock Transfer Form" },
    "wh_tab3_sub_history": { th: "📋 ประวัติใบเบิกย้ายสินค้า", lo: "📋 ປະຫວັດໃບເບີກຍ້າຍສິນຄ້າ", en: "📋 Stock Transfer History" },

    // แท็บ 4 ตรวจนับสต๊อก (Tab 4 Audit)
    "wh_tab4_formula": { th: "ยอดยกมา + เบิกเข้า - ยอดขาย = สต๊อกตามระบบ", lo: "ຍອດຍົກມາ + ເບີກເຂົ້າ - ຍອດຂາຍ = ສະຕ໋ອກຕາມລະບົບ", en: "Opening Stock + Transferred In - Sales = System Stock" },
    "wh_tab4_audit_date": { th: "วันที่ตรวจนับ:", lo: "ວັນທີກວດນັບ:", en: "Audit Date:" },

    // แท็บ 5 สมุดบัญชีสต๊อกย้อนหลัง (Tab 5 Ledger)
    "wh_tab5_title": { th: "สมุดบัญชีสต๊อกย้อนหลัง", lo: "ປຶ້ມບັນຊີສະຕ໋ອກຍ້ອນຫຼັງ", en: "Daily Stock Ledger" },
    "wh_tab5_sub": { th: "บันทึกความเคลื่อนไหวสต๊อกรายวัน", lo: "ບັນທຶກການເຄື່ອນໄຫວສະຕ໋ອກລາຍວັນ", en: "Daily Movement & Balance Log" },
    "wh_tab5_print": { th: "พิมพ์รายงาน", lo: "ພິມລາຍງານ", en: "Print Report" },
    "wh_tab5_export_pdf": { th: "ส่งออก PDF", lo: "ສົ່ງອອກ PDF", en: "Export PDF" },
    "wh_tab5_history_title": { th: "ประวัติการบันทึกกระทบยอดย้อนหลัง", lo: "ປະຫວັດການບັນທຶກປັບຍອດຍ້ອນຫຼັງ", en: "Audit History Log" },
    
    // ---- เมนูย่อยตั้งค่า ----
    "menu_company_settings": { th: "ข้อมูลบริษัท / หัวบิล", lo: "ຂໍ້ມູນບໍລິສັດ / ຫົວບິນ", en: "Company / Receipt Header" },
    "menu_system_users": { th: "สิทธิ์เข้าใช้งานระบบ", lo: "ສິດເຂົ້າໃຊ້ງານລະບົບ", en: "System Access Rights" },
    "menu_team": { th: "ข้อมูลพนักงาน", lo: "ຂໍ້ມູນພະນັກງານ", en: "Staff Data" },
    "menu_business_teams": { th: "ข้อมูลทีมสังกัด", lo: "ຂໍ້ມູນທີມສັງກັດ", en: "Business Teams" },
    "menu_warehouse": { th: "คลังสินค้า", lo: "ສາງສິນຄ້າ", en: "Warehouse" },
    "menu_stock": { th: "ตั้งค่าสินค้า", lo: "ຕັ້ງຄ່າສິນຄ້າ", en: "Product Settings" },
    "menu_customer_types": { th: "จัดการประเภทลูกค้า", lo: "ຈັດການປະເພດລູກຄ້າ", en: "Customer Types" },
    "menu_closers": { th: "จัดการผู้ปิดการขาย", lo: "ຈັດການຜູ້ປິດການຂາຍ", en: "Closers Management" },
    "menu_exchange_rate": { th: "ตั้งค่าอัตราแลกเปลี่ยน", lo: "ຕັ້ງຄ່າອັດຕາແລກປ່ຽນ", en: "Exchange Rates" },
    "menu_notification_settings": { th: "ตั้งค่าการแจ้งเตือน", lo: "ຕັ້ງຄ່າການແຈ້ງເຕືອນ", en: "Notification Settings" },
    "menu_campaign_settings": { th: "ตั้งค่าแคมเปญ & โปรโมชั่น", lo: "ຕັ້ງຄ່າແຄມເປນ & ໂປຣໂມຊັ່ນ", en: "Campaign & Promotions" },
    
    // ---- ปุ่มและสถานะพื้นฐาน ----
    "btn_logout": { th: "ออกจากระบบ", lo: "ອອກຈາກລະບົບ", en: "Logout" },
    "msg_login_to_use": { th: "เข้าสู่ระบบเพื่อใช้งาน", lo: "ເຂົ້າສູ່ລະບົບເພື່ອໃຊ້ງານ", en: "Login to use" },
    "btn_login": { th: "ล็อกอินเข้าสู่ระบบ", lo: "ລັອກອິນເຂົ້າສູ່ລະບົບ", en: "Login" },
    "btn_login_submit": { th: "เข้าสู่ระบบ", lo: "ເຂົ້າສູ່ລະບົບ", en: "Log in" },
    "btn_cancel": { th: "ยกเลิก", lo: "ຍົກເລີກ", en: "Cancel" },
    "btn_confirm_delete": { th: "ยืนยันการลบ", lo: "ຢືນຢັນການລຶບ", en: "Confirm Delete" },
    "btn_ok": { th: "ตกลง", lo: "ຕົກລົງ", en: "OK" },
    "msg_success": { th: "สำเร็จ!", lo: "ສຳເລັດ!", en: "Success!" },
    "msg_error": { th: "เกิดข้อผิดพลาด", lo: "ເກີດຂໍ້ຜິດພາດ", en: "Error" },
    "msg_checking": { th: "กำลังตรวจสอบ...", lo: "ກຳລັງກວດສອບ...", en: "Checking..." },
    
    // ---- เมนูลัดบนมือถือ ----
    "menu_home": { th: "หน้าหลัก", lo: "ໜ້າຫຼັກ", en: "Home" },
    "menu_report_short": { th: "รายงาน", lo: "ລາຍງານ", en: "Reports" },
    "msg_select_report": { th: "เลือกหัวข้อรายงาน", lo: "ເລືອກຫົວຂໍ້ລາຍງານ", en: "Select Report Topic" },
    "menu_sell_short": { th: "ขาย", lo: "ຂາຍ", en: "Sell" },
    "menu_bill_short": { th: "บิล", lo: "ບິນ", en: "Bills" },
    "menu_customer_short": { th: "ลูกค้า", lo: "ລູກຄ້າ", en: "Clients" },
    "menu_team_short": { th: "ทีม", lo: "ທີມ", en: "Team" },
    "menu_setting_short": { th: "ตั้งค่า", lo: "ຕັ້ງຄ່າ", en: "Settings" },
    "msg_select_settings": { th: "เลือกหน้าตั้งค่า", lo: "ເລືອກໜ້າຕັ້ງຄ່າ", en: "Select Settings Page" },
    "msg_guest_mode": { th: "โหมดผู้เยี่ยมชม (ดูยอดขายได้เท่านั้น)", lo: "ໂໝດຜູ້ຢ້ຽມຊົມ (ເບິ່ງຍອດຂາຍໄດ້ເທົ່ານັ້ນ)", en: "Guest Mode (View Sales Only)" },
    
    // ---- ระบบล็อกอิน ----
    "title_login": { th: "เข้าสู่ระบบ", lo: "ເຂົ້າສູ່ລະບົບ", en: "Login" },
    "subtitle_login": { th: "STK Sales Management", lo: "STK Sales Management", en: "STK Sales Management" },
    "placeholder_username": { th: "กรอก Username", lo: "ປ້ອນ Username", en: "Enter Username" },
    "placeholder_password": { th: "กรอก Password", lo: "ປ້ອນ Password", en: "Enter Password" },
    "label_remember_pass": { th: "จดจำรหัสผ่าน", lo: "ຈື່ລະຫັດຜ່ານ", en: "Remember me" },
    "msg_err_userpass": { th: "Username หรือ Password ไม่ถูกต้อง", lo: "Username ຫຼື Password ບໍ່ຖືກຕ້ອງ", en: "Invalid Username or Password" },
    "msg_err_db": { th: "ไม่สามารถเชื่อมต่อฐานข้อมูลได้", lo: "ບໍ່ສາມາດເຊື່ອມຕໍ່ຖານຂໍ້ມູນໄດ້", en: "Database connection failed" },
    "msg_err_nodb": { th: "ไม่พบการเชื่อมต่อฐานข้อมูล Supabase", lo: "ບໍ່ພົບການເຊື່ອມຕໍ່ຖານຂໍ້ມູນ Supabase", en: "Supabase connection not found" },

    // ---- Widget แดชบอร์ด ----
    "widget_target_left": { th: "เหลือเป้า", lo: "ເຫຼືອເປົ້າ", en: "Remaining" },
    "widget_sold": { th: "ขายได้: ", lo: "ຂາຍໄດ້: ", en: "Sold: " },
    "widget_box": { th: " กล่อง", lo: " ກ່ອງ", en: " Boxes" },
    "widget_progress": { th: "คืบหน้า", lo: "ຄືບໜ້າ", en: "Progress" },
    "widget_target": { th: "เป้า: ", lo: "ເປົ້າ: ", en: "Target: " },

    // ---- ประเภทลูกค้า (Customer Types T001 - T007) ----
    "cust_type_T001": { th: "ลูกค้าใหม่มาตรวจ", lo: "ລູກຄ້າໃໝ່ມາກວດ", en: "New Customer - Clinic Visit" },
    "cust_type_T002": { th: "ลูกค้าเก่ากลับมาต่อยา", lo: "ລູກຄ້າເກົ່າກັບມາຕໍ່ຢາ", en: "Returning Customer - Medicine Refill" },
    "cust_type_T003": { th: "ลูกค้าใหม่นำผลตรวจมาปรึกษา", lo: "ລູກຄ້າໃໝ່ນຳຜົນກວດມາປຶກສາ", en: "New Customer - Consult Lab Results" },
    "cust_type_T004": { th: "โทรปิดการขายลูกค้าใหม่", lo: "ໂທປິດການຂາຍລູກຄ້າໃໝ່", en: "Telesales - New Customer" },
    "cust_type_T005": { th: "ลูกค้าเก่านำผลตรวจมาปรึกษา", lo: "ລູກຄ້າເກົ່ານຳຜົນກວດມາປຶກສາ", en: "Returning Customer - Consult Lab Results" },
    "cust_type_T006": { th: "โทรปิดการขายลูกค้าเก่า", lo: "ໂທປິດການຂາຍລູກຄ້າເກົ່າ", en: "Telesales - Returning Customer" },
    "cust_type_T007": { th: "ส่วนกลางใหม่", lo: "ສ່ວນກາງໃໝ່", en: "Headquarters / Center - New" },

    // ---- ผู้ปิดการขายและทีม (Closers & Prescribing Roles) ----
    "closer_role_doctor": { th: "หมอปิด (Center)", lo: "ທ່ານໝໍປິດ (Center)", en: "Doctor (Center)" },
    "closer_role_self": { th: "สั่งเอง (Marketing)", lo: "ສັ່ງເອງ (Marketing)", en: "Self-Order (Marketing)" },
    "closer_role_doctor_full": { th: "หมอสั่งจ่าย", lo: "ທ່ານໝໍສັ່ງຈ່າຍ", en: "Doctor Prescribed" },
    "closer_role_self_full": { th: "สั่งจ่ายยาเอง", lo: "ສັ່ງຈ່າຍຢາເອງ", en: "Self-Order" },
    "closer_team_center": { th: "Center (ทีมแพทย์ / ผู้เชี่ยวชาญ)", lo: "Center (ທີມແພດ / ຜູ້ຊ່ຽວຊານ)", en: "Center (Medical Specialists)" },
    "closer_team_marketing": { th: "Marketing (ฝ่ายการตลาด)", lo: "Marketing (ຝ່າຍການຕະຫຼາດ)", en: "Marketing" }
};

// ==========================================
// ⚙️ ระบบแปลภาษา (Core Translation Functions)
// ==========================================

window.getCurrentLang = function() {
    return window.__stkCurrentLang || localStorage.getItem('stk_lang') || 'th';
};
// Initialize global lang var
window.__stkCurrentLang = localStorage.getItem('stk_lang') || 'th';

window.setLanguage = function(langCode) {
    localStorage.setItem('stk_lang', langCode);
    window.__stkCurrentLang = langCode;
    // Dispatch event ให้ component ต่างๆ re-render ทันทีโดยไม่ต้อง reload
    window.dispatchEvent(new CustomEvent('stk_lang_change', { detail: { lang: langCode } }));
};

window.t = function(key, fallbackText) {
    const lang = window.getCurrentLang();
    if (window.stkDict && window.stkDict[key] && window.stkDict[key][lang]) {
        return window.stkDict[key][lang];
    }
    return fallbackText || key;
};

// =========================================================================
// 🏷️ ระบบแมปและแปลประเภทลูกค้าสากล (Universal Customer Type Normalizer)
// =========================================================================

window.STK_CUSTOMER_TYPES_MAP = [
    {
        id: 'T001',
        name: 'ลูกค้าใหม่มาตรวจ',
        th: 'ลูกค้าใหม่มาตรวจ',
        lo: 'ລູກຄ້າໃໝ່ມາກວດ',
        en: 'New Customer - Clinic Visit',
        isOld: false,
        keywords: ['t001', 'ลูกค้าใหม่มาตรวจ', 'ລູກຄ້າໃໝ່ມາກວດ', 'ລູກຄ້າໃຫມ່ມາກວດ', 'มาตรวจ', 'ມາກວດ', 'ตรวจใหม่', 'กวดใหม่']
    },
    {
        id: 'T002',
        name: 'ลูกค้าเก่ากลับมาต่อยา',
        th: 'ลูกค้าเก่ากลับมาต่อยา',
        lo: 'ລູກຄ້າເກົ່າກັບມາຕໍ່ຢາ',
        en: 'Returning Customer - Medicine Refill',
        isOld: true,
        keywords: ['t002', 'ลูกค้าเก่ากลับมาต่อยา', 'ລູກຄ້າເກົ່າກັບມາຕໍ່ຢາ', 'ต่อยา', 'ຕໍ່ຢາ', 'กลับมาต่อยา', 'ກັບມາຕໍ່ຢາ', 'เก่าต่อยา', 'ເກົ່າຕໍ່ຢາ']
    },
    {
        id: 'T003',
        name: 'ลูกค้าใหม่นำผลตรวจมาปรึกษา',
        th: 'ลูกค้าใหม่นำผลตรวจมาปรึกษา',
        lo: 'ລູກຄ້າໃໝ່ນຳຜົນກວດມາປຶກສາ',
        en: 'New Customer - Consult Lab Results',
        isOld: false,
        keywords: ['t003', 'ลูกค้าใหม่นำผลตรวจมาปรึกษา', 'ລູກຄ້າໃໝ່ນຳຜົນກວດມາປຶກສາ', 'ລູກຄ້າໃຫມ່ນຳຜົນກວດມາປຶກສາ', 'ใหม่นำผล', 'ໃໝ່ນຳຜົນ', 'ໃຫມ່ນຳຜົນ', 'ใหม่ปรึกษา', 'ໃໝ່ປຶກສາ']
    },
    {
        id: 'T004',
        name: 'โทรปิดการขายลูกค้าใหม่',
        th: 'โทรปิดการขายลูกค้าใหม่',
        lo: 'ໂທປິດການຂายລູກຄ້າໃໝ່',
        en: 'Telesales - New Customer',
        isOld: false,
        keywords: ['t004', 'โทรปิดการขายลูกค้าใหม่', 'ໂທປິດການຂາຍລູກຄ້າໃໝ່', 'ໂທປິດການຂາຍລູກຄ້າໃຫມ່', 'โทรปิดใหม่', 'ໂທປິດໃໝ່', 'ໂທປິດໃຫມ່', 'telesale new']
    },
    {
        id: 'T005',
        name: 'ลูกค้าเก่านำผลตรวจมาปรึกษา',
        th: 'ลูกค้าเก่านำผลตรวจมาปรึกษา',
        lo: 'ລູກຄ້າເກົ່ານຳຜົນກວດມາປຶກສາ',
        en: 'Returning Customer - Consult Lab Results',
        isOld: true,
        keywords: ['t005', 'ลูกค้าเก่านำผลตรวจมาปรึกษา', 'ລູກຄ້າເກົ່ານຳຜົນກວດມາປຶກສາ', 'เก่านำผล', 'ເກົ່ານຳຜົນ', 'เก่าปรึกษา', 'ເກົ່າປຶກສາ', 'consult returning']
    },
    {
        id: 'T006',
        name: 'โทรปิดการขายลูกค้าเก่า',
        th: 'โทรปิดการขายลูกค้าเก่า',
        lo: 'ໂທປິດການຂายລູກຄ້າເກົ່າ',
        en: 'Telesales - Returning Customer',
        isOld: true,
        keywords: ['t006', 'โทรปิดการขายลูกค้าเก่า', 'ໂທປິດການຂາຍລູກຄ້າເກົ່າ', 'โทรปิดเก่า', 'ໂທປິດເກົ່າ', 'telesale return']
    },
    {
        id: 'T007',
        name: 'ส่วนกลางใหม่',
        th: 'ส่วนกลางใหม่',
        lo: 'ສ່ວນກາງໃໝ່',
        en: 'Headquarters / Center - New',
        isOld: false,
        keywords: ['t007', 'ส่วนกลางใหม่', 'ສ່ວນກາງໃໝ່', 'ສ່ວນກາງໃຫມ່', 'ส่วนกลาง', 'ສ່ວນກາງ', 'center new', 'hq new']
    }
];

/**
 * แปลงประเภทลูกค้าจากทุกรูปแบบ (รหัส T001-T007, ภาษาลาว, ภาษาไทย, ภาษาอังกฤษ)
 * ให้กลายเป็น Canonical Customer Type Object ที่ถูกต้องสมบูรณ์
 * @param {string} input - ข้อความประเภทลูกค้าที่ส่งมาจากระบบคลินิกหรือหน้าฟอร์ม
 * @param {string} [targetLang] - ภาษาที่ต้องการแสดงผล ('th' | 'lo' | 'en') หากไม่ระบุจะใช้ภาษาปัจจุบัน
 * @param {object} [context] - ข้อมูลเสริม เช่น { disease, symptom, customer_name, hn }
 * @returns {object} { id, name, th, lo, en, isOld, label, display }
 */
window.normalizeCustomerType = function(input, targetLang, context) {
    const list = window.STK_CUSTOMER_TYPES_MAP;
    const curLang = targetLang || window.getCurrentLang() || 'th';
    const defaultObj = list[0]; // T001

    // หากมี context ส่งมา ให้ตรวจสอบว่ามีร่องรอยการต่อยา/ลูกค้าเก่าหรือไม่
    let contextHint = '';
    if (context && typeof context === 'object') {
        contextHint = [
            context.disease || '',
            context.symptom || '',
            context.customer_name || '',
            context.patient_name || '',
            context.chief_complaint || ''
        ].join(' ').toLowerCase();
    }

    if (!input) {
        if (contextHint && (contextHint.includes('ต่อยา') || contextHint.includes('ຕໍ່ຢາ') || contextHint.includes('ເກົ່າ') || contextHint.includes('เก่า'))) {
            const refillItem = list[1]; // T002
            return {
                ...refillItem,
                label: refillItem[curLang] || refillItem.th,
                display: refillItem[curLang] || refillItem.th
            };
        }
        return {
            ...defaultObj,
            label: defaultObj[curLang] || defaultObj.th,
            display: defaultObj[curLang] || defaultObj.th
        };
    }

    const raw = String(input).trim();
    const rawLower = raw.toLowerCase();
    const rawClean = rawLower.replace(/\s+/g, '');

    // 1. ตรวจสอบจาก ID ตรงๆ (T001, T002, ..., T1, T2)
    const idMatch = rawLower.match(/t0*([1-7])/);
    if (idMatch) {
        const found = list.find(item => item.id === `T00${idMatch[1]}`);
        if (found) {
            return {
                ...found,
                label: found[curLang] || found.th,
                display: found[curLang] || found.th
            };
        }
    }

    // 2. ตรวจสอบ Exact Match (name, th, lo, en)
    for (const item of list) {
        if (
            item.name.toLowerCase() === rawLower ||
            item.th.toLowerCase() === rawLower ||
            item.lo.toLowerCase() === rawLower ||
            item.en.toLowerCase() === rawLower ||
            item.th.replace(/\s+/g, '') === rawClean ||
            item.lo.replace(/\s+/g, '') === rawClean
        ) {
            return {
                ...item,
                label: item[curLang] || item.th,
                display: item[curLang] || item.th
            };
        }
    }

    // 3. ตรวจจับคีย์เวิร์ดเฉพาะเจาะจง (Keyword Priority Detection)
    // ตรวจจับ 'ต่อยา' / 'ຕໍ່ຢາ' -> T002
    if (rawLower.includes('ต่อยา') || rawLower.includes('ຕໍ່ຢາ') || rawLower.includes('refill')) {
        const item = list[1]; // T002
        return { ...item, label: item[curLang] || item.th, display: item[curLang] || item.th };
    }

    // ตรวจจับ 'ปรึกษา' / 'ປຶກສາ' / 'consult'
    if (rawLower.includes('ปรึกษา') || rawLower.includes('ປຶກສາ') || rawLower.includes('consult')) {
        const isOld = rawLower.includes('เก่า') || rawLower.includes('ເກົ່າ') || rawLower.includes('return') || rawLower.includes('old');
        const item = isOld ? list[4] : list[2]; // T005 หรือ T003
        return { ...item, label: item[curLang] || item.th, display: item[curLang] || item.th };
    }

    // ตรวจจับ 'โทรปิด' / 'ໂທປິດ' / 'telesale'
    if (rawLower.includes('โทร') || rawLower.includes('ໂທ') || rawLower.includes('telesale')) {
        const isOld = rawLower.includes('เก่า') || rawLower.includes('ເກົ່າ') || rawLower.includes('return') || rawLower.includes('old');
        const item = isOld ? list[5] : list[3]; // T006 หรือ T004
        return { ...item, label: item[curLang] || item.th, display: item[curLang] || item.th };
    }

    // ตรวจจับ 'ส่วนกลาง' / 'ສ່ວນກາງ' -> T007
    if (rawLower.includes('ส่วนกลาง') || rawLower.includes('ສ່ວນກາງ') || rawLower.includes('center') || rawLower.includes('hq')) {
        const item = list[6]; // T007
        return { ...item, label: item[curLang] || item.th, display: item[curLang] || item.th };
    }

    // 4. ตรวจจับคำว่า 'เก่า' / 'ເກົ່າ' (Returning Customer Generic)
    if (rawLower.includes('เก่า') || rawLower.includes('ເກົ່າ') || rawLower.includes('return') || rawLower.includes('old')) {
        const item = list[1]; // T002 ลูกค้าเก่ากลับมาต่อยา
        return { ...item, label: item[curLang] || item.th, display: item[curLang] || item.th };
    }

    // 5. หากข้อความที่ส่งมาเป็นค่า Default (เช่น ลูกค้าใหม่มาตรวจ) แต่ context ชี้ชัดว่าเป็นการต่อยา หรือเป็นคนไข้เก่า
    if (contextHint && (contextHint.includes('ต่อยา') || contextHint.includes('ຕໍ່ຢາ') || contextHint.includes('ເກົ່າຕໍ່ຢາ') || contextHint.includes('เก่าต่อยา') || contextHint.includes('ເກົ່າ') || contextHint.includes('เก่า'))) {
        const item = list[1]; // T002 ลูกค้าเก่ากลับมาต่อยา
        return { ...item, label: item[curLang] || item.th, display: item[curLang] || item.th };
    }

    // 6. ตรวจจับคำว่า 'ใหม่' / 'ໃໝ່' / 'ໃຫມ່' / 'ตรวจ' / 'ກວດ' (New Customer Generic)
    if (rawLower.includes('ใหม่') || rawLower.includes('ໃໝ່') || rawLower.includes('ໃຫມ່') || rawLower.includes('ตรวจ') || rawLower.includes('ກວດ') || rawLower.includes('new')) {
        const item = list[0]; // T001 ลูกค้าใหม่มาตรวจ
        return { ...item, label: item[curLang] || item.th, display: item[curLang] || item.th };
    }

    // Default Fallback
    return {
        ...defaultObj,
        label: defaultObj[curLang] || defaultObj.th,
        display: defaultObj[curLang] || defaultObj.th
    };
};

/**
 * 🔍 แปลงรหัส HN ให้อยู่ในรูปแบบ Candidate ต่างๆ เพื่อค้นหาและเทียบความถูกต้อง (Universal HN Normalizer)
 * รองรับทั้ง 'HN-984097', '984097', 'HN984097'
 * @param {string} rawHn
 * @returns {string[]} อาร์เรย์ของ HN ที่เป็นไปได้ทั้งหมด
 */
window.normalizeHnCandidates = function(rawHn) {
    if (!rawHn) return [];
    const s = String(rawHn).trim().toUpperCase();
    if (!s || s === '-' || s === '--' || s === 'NULL' || s === 'UNDEFINED') return [];
    const candSet = new Set();
    candSet.add(s);
    const stripped = s.replace(/^HN[-_\s]*/i, '').trim();
    if (stripped) {
        candSet.add(stripped);
        candSet.add('HN-' + stripped);
        candSet.add('HN' + stripped);
    }
    const digits = s.replace(/\D/g, '');
    if (digits) {
        candSet.add(digits);
        candSet.add('HN-' + digits);
        candSet.add('HN' + digits);
    }
    return Array.from(candSet);
};

/**
 * 🔍 ตรวจสอบว่ารหัส HN สองตัวตรงกันหรือไม่ (เทียบข้ามฟอร์แมต)
 */
window.isHnMatch = function(hn1, hn2) {
    if (!hn1 || !hn2) return false;
    const c1 = window.normalizeHnCandidates(hn1);
    const c2 = window.normalizeHnCandidates(hn2);
    if (!c1.length || !c2.length) return false;
    const s2 = new Set(c2);
    return c1.some(c => s2.has(c));
};

/**
 * 🏷️ ฟังก์ชันจัดประเภทลูกค้าตามรูปแบบรหัส Visit (VIS-ORD- vs VIS-ตัวเลข) และสถานะประวัติในระบบ
 * @param {string} visitId - รหัส Visit เช่น 'VIS-ORD-62512' หรือ 'VIS-163960'
 * @param {boolean} isExistingCustomer - ลูกค้ารายนี้มีประวัติในระบบแล้วหรือไม่
 * @param {string} [explicitType] - ประเภทเดิมที่ระบุมา
 * @param {string} [targetLang] - ภาษา ('th' | 'lo' | 'en')
 * @param {object} [context] - ข้อมูลเสริม
 * @returns {object} { id, name, th, lo, en, isOld, label, display }
 */
window.resolveVisitCustomerType = function(visitId, isExistingCustomer, explicitType, targetLang, context) {
    const curLang = targetLang || window.getCurrentLang() || 'th';
    const list = window.STK_CUSTOMER_TYPES_MAP || [];
    const vStr = String(visitId || '').trim().toUpperCase();

    // ตรวจสอบสถานะลูกค้าเก่าจาก explicitType ร่วมด้วย
    const hasExistingExplicit = (explicitType && (
        String(explicitType).includes('เก่า') ||
        String(explicitType).includes('ເກົ່າ') ||
        String(explicitType) === 'T006' ||
        String(explicitType) === 'T002' ||
        String(explicitType) === 'T005'
    ));
    const effectiveIsExisting = Boolean(isExistingCustomer || hasExistingExplicit);

    // 1. ตรวจสอบรหัส VIS-ORD- (ออเดอร์จากโทรติดตาม / ฝ่ายขายออนไลน์ ห้ามเป็น "ลูกค้าใหม่มาตรวจ" เด็ดขาด)
    if (vStr.startsWith('VIS-ORD-') || vStr.includes('-ORD-')) {
        const targetId = effectiveIsExisting ? 'T006' : 'T004';
        const item = list.find(t => t.id === targetId) || {
            id: targetId,
            name: effectiveIsExisting ? 'โทรปิดการขายลูกค้าเก่า' : 'โทรปิดการขายลูกค้าใหม่',
            th: effectiveIsExisting ? 'โทรปิดการขายลูกค้าเก่า' : 'โทรปิดการขายลูกค้าใหม่',
            lo: effectiveIsExisting ? 'ໂທປິດການຂາຍລູກຄ້າເກົ່າ' : 'ໂທປິດການຂາຍລູກຄ້າໃໝ່',
            en: effectiveIsExisting ? 'Telesales - Returning Customer' : 'Telesales - New Customer',
            isOld: Boolean(effectiveIsExisting)
        };
        return {
            ...item,
            label: item[curLang] || item.th,
            display: item[curLang] || item.th
        };
    }

    // 2. ตรวจสอบรหัส VIS- ตามด้วยตัวเลข (คนไข้มาตรวจที่คลินิกจริง)
    if (/^VIS-\d+/i.test(vStr)) {
        const targetId = isExistingCustomer ? 'T002' : 'T001';
        const item = list.find(t => t.id === targetId) || {
            id: targetId,
            name: isExistingCustomer ? 'ลูกค้าเก่ากลับมาต่อยา' : 'ลูกค้าใหม่มาตรวจ',
            th: isExistingCustomer ? 'ลูกค้าเก่ากลับมาต่อยา' : 'ลูกค้าใหม่มาตรวจ',
            lo: isExistingCustomer ? 'ລູກຄ້າເກົ່າກັບມາຕໍ່ຢາ' : 'ລູກຄ້າໃໝ່ມາກວດ',
            en: isExistingCustomer ? 'Returning Customer - Medicine Refill' : 'New Customer - Clinic Visit',
            isOld: Boolean(isExistingCustomer)
        };
        return {
            ...item,
            label: item[curLang] || item.th,
            display: item[curLang] || item.th
        };
    }

    // 3. Fallback: หากไม่ใช่ทั้งสองรูปแบบ ให้ใช้ normalizeCustomerType เดิม
    if (typeof window.normalizeCustomerType === 'function') {
        return window.normalizeCustomerType(explicitType, curLang, context);
    }

    const defaultObj = list[0] || {
        id: 'T001',
        name: explicitType || 'ลูกค้าใหม่มาตรวจ',
        th: explicitType || 'ลูกค้าใหม่มาตรวจ',
        lo: 'ລູກຄ້າໃໝ່ມາກວດ',
        en: 'New Customer - Clinic Visit',
        isOld: false
    };
    return {
        ...defaultObj,
        label: defaultObj[curLang] || defaultObj.th,
        display: defaultObj[curLang] || defaultObj.th
    };
};

/**
 * 🩺 ฟังก์ชันกลางวิเคราะห์และตัดสินผู้สั่งจ่าย / ผู้ปิดการขาย (Prescriber & Closer Resolver)
 * รองรับทั้งภาษาไทยและภาษาลาว ป้องกันข้อผิดพลาดที่ชอบหลุดไปขึ้นเป็น "หมอเป็นเซ็นเตอร์หมด"
 * @param {object} ord - ออบเจกต์ออเดอร์จาก stk_nutrient_orders หรือ stk_pending_sale
 * @returns {object} { orderByType, closerTeam, closerName, isSelf, badgeText, badgeClass }
 */
window.resolveOrderCloser = function(ord) {
    const curLang = window.getCurrentLang() || 'th';
    if (!ord) {
        return {
            orderByType: 'หมอสั่งจ่าย',
            closerTeam: 'Center',
            closerName: 'หมอผู้เชี่ยวชาญ (Center)',
            isSelf: false,
            badgeText: curLang === 'lo' ? '🩺 ທ່ານໝໍປິດ (Center)' : (curLang === 'en' ? '🩺 Doctor (Center)' : '🩺 หมอปิด (Center)'),
            badgeClass: 'bg-indigo-50 text-indigo-700 border border-indigo-200'
        };
    }

    const recordedByStr = String(ord.recorded_by || ord.seller_id || '').trim();
    const closerDrStr = String(ord.closer_dr || ord.closer || '').trim();
    const typeStr = String(ord.order_by_type || ord.prescribe_type || ord.closer_type || '').trim().toLowerCase();
    const teamStr = String(ord.closer_team || ord.closerTeam || '').trim().toLowerCase();
    const closerLower = closerDrStr.toLowerCase();

    // 1. ตรวจสอบความชัดเจนของทีมและรูปแบบการสั่งจ่าย (ยึดตามออเดอร์ต้นทางเป๊ะๆ ห้ามเขียนทับเด็ดขาด)
    const isExplicitCenter = teamStr === 'center' || teamStr.includes('ส่วนกลาง') || typeStr.includes('หมอ') || typeStr.includes('ແພດ') || typeStr.includes('dr') || typeStr.includes('center');
    const isExplicitMarketing = (teamStr === 'marketing' || teamStr.includes('การตลาด') || teamStr.includes('ຕະຫຼາດ') || typeStr.includes('เอง') || typeStr.includes('ເອງ') || typeStr.includes('ตลาด') || typeStr.includes('ຕະຫຼາດ') || typeStr.includes('self')) && !isExplicitCenter;

    // 2. ตรวจสอบข้อความใน closer_dr กรณีไม่มีทีมระบุชัดเจน
    const isCloserKeywordSelf = closerLower.includes('ປິດເອງ') || closerLower.includes('ປີດເອງ') || closerLower.includes('ສັ່ງເອງ') || closerLower.includes('ສັ່ງຈ່າຍເອງ') || closerLower.includes('ເອງ')
        || closerLower.includes('ปิดเอง') || closerLower.includes('ตัวเองปิด') || closerLower.includes('สั่งเอง') || closerLower.includes('สั่งจ่ายเอง')
        || closerLower.includes('self') || closerLower.includes('marketing');

    let isSelf = false;
    if (isExplicitCenter) {
        isSelf = false;
    } else if (isExplicitMarketing) {
        isSelf = true;
    } else if (isCloserKeywordSelf) {
        isSelf = true;
    } else {
        isSelf = false;
    }

    if (isSelf) {
        // --- กรณีสั่งจ่ายยาเอง (Marketing) ---
        const orderByType = 'สั่งจ่ายยาเอง';
        const closerTeam = 'Marketing';
        let closerName = '';

        if (closerDrStr && !isCloserKeywordSelf && closerDrStr !== '-' && closerDrStr !== 'หมอผู้เชี่ยวชาญ (Center)') {
            closerName = closerDrStr;
        } else if (recordedByStr && recordedByStr !== '-') {
            closerName = recordedByStr;
        } else {
            closerName = 'พนักงานการตลาด';
        }

        const badgeText = curLang === 'lo' ? '👤 ສັ່ງເອງ (Marketing)' : (curLang === 'en' ? '👤 Self-Order (Marketing)' : '👤 สั่งเอง (Marketing)');

        return {
            orderByType,
            closerTeam,
            closerName,
            isSelf: true,
            badgeText,
            badgeClass: 'bg-emerald-50 text-emerald-700 border border-emerald-200'
        };
    } else {
        // --- กรณีหมอสั่งจ่าย (Center) ---
        const orderByType = 'หมอสั่งจ่าย';
        const closerTeam = 'Center';
        let closerName = (closerDrStr && closerDrStr !== '-' && closerDrStr !== 'หมอผู้เชี่ยวชาญ (Center)')
            ? closerDrStr
            : 'หมอผู้เชี่ยวชาญ (Center)';

        const badgeText = curLang === 'lo' ? '🩺 ທ່ານໝໍປິດ (Center)' : (curLang === 'en' ? '🩺 Doctor (Center)' : '🩺 หมอปิด (Center)');

        return {
            orderByType,
            closerTeam,
            closerName,
            isSelf: false,
            badgeText,
            badgeClass: 'bg-indigo-50 text-indigo-700 border border-indigo-200'
        };
    }
};