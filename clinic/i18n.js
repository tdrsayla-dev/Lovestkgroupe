// =====================================
// Clinic Internationalization (i18n) Module
// Supports: Lao (la 🇱🇦), Thai (th 🇹🇭), English (en 🇬🇧)
// =====================================

const CLINIC_I18N_DICTIONARY = {
    // -------------------------------------
    // 🇱🇦 ภาษาລາວ (Lao)
    // -------------------------------------
    la: {
        // App Title & General
        app_title: "ລະບົບການຈັດການຄລີນິກ (Clinic System)",
        app_name: "ລະບົບຄລີນິກ",
        logout: "ອອກຈາກລະບົບ",
        refresh: "ຣີເຟຣຊຂໍ້ມູນ",
        save: "ບັນທຶກ",
        cancel: "ຍົກເລີກ",
        edit: "ແກ້ໄຂ",
        delete: "ລົບ",
        close: "ປິດ",
        actions: "ການຈັດການ",
        search: "ຄົ້ນຫາ",
        status: "ສະຖານະ",
        date: "ວັນທີ",
        all: "ທັງໝົດ",
        today: "ມື້ນີ້",
        this_month: "ເດືອນນີ້",
        details: "ລາຍລະອຽດ",
        print: "ພິມລາຍງານ",
        export_excel: "Export Excel",
        export_pdf: "Export PDF",
        select_all: "ເລືອກທັງໝົດ",
        clear_all: "ລ້າງທັງໝົດ",
        back: "ກັບຄືນ",
        confirm: "ຢືນຢັນ",
        none: "ບໍ່ມີ",

        // Sidebar Menu Navigation
        sidebar_dashboard: "ພາບລວມ",
        sidebar_appointments: "ນັດໝາຍລ່ວງໜ້າ",
        sidebar_registration: "ທະບຽນຜູ້ປ່ວຍ",
        sidebar_triage: "ຈຸດຄັດກອງ",
        sidebar_doctor: "ຫ້ອງກວດແພດ",
        sidebar_payment: "ຊຳລະຄ່າປິ່ນປົວ",
        sidebar_lab: "ຫ້ອງ Lab",
        sidebar_queue: "ຈັດຄິວ",
        sidebar_prescription: "ອ່ານຜົນ/ຈັດຢາ",
        sidebar_pharmacy: "ຫ້ອງຈ່າຍຢາ",
        sidebar_history: "ປະຫວັດຜູ້ປ່ວຍ",
        sidebar_billing: "ລະບົບ ໃບບິນ / ໃບເສັດ",
        sidebar_backend: "ຈັດການລະບົບຫຼັງບ້ານ",
        sidebar_services: "ຕັ້ງຄ່າລາຍການກວດ",
        sidebar_stock_drugs: "ຄັງຢາ",
        sidebar_stock_equip: "ຄັງພັດສະດຸ",
        sidebar_staff: "ຈັດການພະນັກງານ",
        sidebar_referrals: "ລະບົບປັນຜົນ/ຜູ້ແນະນຳ",
        sidebar_reports: "ບົດລາຍງານສະຫຼຸບ",

        // Roles
        role_admin: "ຜູ້ດູແລລະບົບ",
        role_doctor: "ແພດ",
        role_nurse: "ພະຍາບານ",
        role_pharmacist: "ເພສັດກອນ",
        role_staff: "ພະນັກງານ",

        // Dashboard
        db_title: "ພາບລວມລະບົບ",
        db_subtitle: "ສະຖານະ ແລະ ການວິເຄາະຂໍ້ມູນຄລີນິກ",
        db_greeting_title: "ສະບາຍດີ, ຜູ້ບໍລິຫານ",
        db_greeting_subtitle: "ພາບລວມຄລີນິກ",
        db_stat_appointments: "ນັດໝາຍມື້ນີ້",
        db_stat_payments: "ລາຍຮັບລວມ",
        db_stat_rescheduled: "ປະຈຸບັນວັນນີ້",
        db_stat_patients: "ຄົນເຈັບທັງໝົດ",
        db_patient_type: "ປະເພດຄົນເຈັບ",
        db_communicable: "ໂລກຕິດຕໍ່",
        db_non_communicable: "ໂລກບໍ່ຕິດຕໍ່",
        db_appts_today_title: "ລາຍການນັດໝາຍມື້ນີ້",
        db_stats_service_title: "ສະຖິຕິການຮັບບໍລິການ",
        db_legend_visits: "ຄົນເຈັບເຂົ້າກວດ",
        db_legend_appointments: "ນັດໝາຍ",
        db_kpi_visits_month: "ຜູ້ປ່ວຍເຂົ້າກວດ (ເດືອນນີ້)",
        db_kpi_appts_month: "ນັດໝາຍ (ເດືອນນີ້)",
        db_queue_status: "ສະຖານະຄິວ",
        unit_items: "ລາຍການ",
        unit_people: "ຄົນ",
        th_time: "ເວລາ",
        th_patient_name: "ຊື່ຄົນເຈັບ",
        th_service: "ບໍລິການ",
        th_status: "ສະຖານະ",
        view_all: "ເບິ່ງທັງໝົດ",
        today: "ວັນນີ້",
        search: "ຄົ້ນຫາ",

        // Appointments (ລະບົບນັດໝາຍ)
        appts_title: "ລະບົບນັດໝາຍ",
        appts_subtitle: "ຈັດການລາຍການນັດໝາຍ ແລະ ດົງທະບຽນຜູ້ປ່ວຍ",
        appts_date_label: "ວັນທີນັດ",
        appts_search_placeholder: "ຄົ້ນຫາລະຫັດ, ຊື່ຜູ້ຈອງ, ເບີໂທ...",
        appts_add: "ເພີ່ມນັດໝາຍ",
        appts_th_code: "ລະຫັດການຈອງ",
        appts_th_date: "ວັນທີນັດໝາຍ",
        appts_th_time: "ເວລາ",
        appts_th_referrer: "ຜູ້ແນະນຳ (Referrer)",
        appts_th_reason: "ເລື່ອງທີ່ຕ້ອງການກວດ",
        appts_modal_title: "ເພີ່ມການນັດໝາຍ",
        appts_modal_type: "ຮູບແບບການນັດໝາຍ",
        appts_modal_self: "ນັດໝາຍເອງ",
        appts_modal_assisted: "ນັດໝາຍຜ່ານຜູ້ຊ່ວຍ/ພະຍາບານ",
        appts_modal_save: "ບັນທຶກການນັດໝາຍ",

        // Patient Registration
        reg_title: "ທະບຽນຜູ້ປ່ວຍ",
        reg_subtitle: "ຂໍ້ມູນ ແລະ ປະຫວັດການປິ່ນປົວຂອງຜູ້ປ່ວຍທັງໝົດ",
        reg_add_patient: "ລົງທະບຽນໃໝ່",
        reg_hn: "ເລກ HN",
        reg_name: "ຊື່-ນາມສະກຸນ",
        reg_gender: "ເພດ",
        reg_age: "ອາຍຸ",
        reg_phone: "ເບີໂທ",
        reg_idcard: "ເລກບັດປະຈຳຕົວ/Passport",
        reg_search_placeholder: "ຄົ້ນຫາ ຊື່, HN, ເບີໂທ...",
        reg_th_address: "ທີ່ຢູ່",
        reg_th_allergy: "ປະຫວັດແພ້ຢາ",
        reg_th_referrer: "ຜູ້ແນະນຳ (REFERRER)",
        reg_sent: "ສົ່ງແລ້ວ",
        reg_sent_triage: "ສົ່ງຄັດກອງແລ້ວ",
        reg_waiting_triage: "ລໍຖ້າສົ່ງຄັດກອງ",
        reg_status_in_treatment: "ກຳລັງປິ່ນປົວ",
        reg_btn_send_triage: "ສົ່ງເຂົ້າຄັດກອງ",
        reg_no_data: "ບໍ່ພົບຂໍ້ມູນຜູ້ປ່ວຍ",

        // Triage / Vitals
        triage_title: "ຈຸດຄັດກອງ",
        triage_subtitle: "ບັນທຶກສັນຍານຊີບເບື້ອງຕົ້ນ",
        triage_empty: "ຍັງບໍ່ມີຜູ້ປ່ວຍລໍຖ້າຄັດກອງ",
        triage_temp: "ອຸນຫະພູມ (°C)",
        triage_bp: "ຄວາມດັນ (BP)",
        triage_pr: "ຊີບພະຈອນ (PR)",
        triage_rr: "ການຫາຍໃຈ (RR)",
        triage_weight: "ນ້ຳໜັກ (kg)",
        triage_height: "ສ່ວນສູງ (cm)",
        triage_bmi: "ດັດຊະນີມວນກາຍ (BMI)",
        triage_chief_complaint: "ອາການສຳຄັນ",
        triage_th_visit: "ລະຫັດ VISIT",
        triage_th_name: "ຊື່-ນາມສະກຸນ",
        triage_th_action: "ດຳເນີນການ",
        triage_btn_history: "ຊັກປະຫວັດ",

        // Doctor Room
        doctor_title: "ຫ້ອງກວດແພດ",
        doctor_subtitle: "ລາຍການຜູ້ປ່ວຍລໍຖ້າກວດ ແລະ ລະບົບສັ່ງ Lab",
        doctor_empty: "ບໍ່ມີຜູ້ປ່ວຍລໍຖ້າກວດ",
        doctor_diagnosis: "ຜົນການວິນິດໄສ",
        doctor_treatment: "ແຜນການປິ່ນປົວ",
        doctor_th_symptoms: "ຊື່-ນາມສະກຸນ / ອາການເບື້ອງຕົ້ນ",
        doctor_th_vitals: "ສັນຍານຊີບເບື້ອງຕົ້ນ",
        doctor_btn_order_lab: "ສັ່ງ Lab",
        doctor_btn_finish: "ກວດເສັດ",

        // Queue Management (ລະບົບຈັດຄິວ)
        queue_title: "ລະບົບຈັດຄິວອ່ານຜົນກວດ",
        queue_subtitle: "ບໍລິຫານຄິວແພດ ແລະ ອັບເດດສະຖານະການກວດແບບเรียลไທມ໌",
        queue_inner_header: "ລາຍຊື່ຄິວລໍຖ້າສົ່ງໃຫ້ທ່ານໝໍອ່ານຜົນ",
        queue_th_select_doctor: "ເລືອກທ່ານໝໍທີ່ຕ້ອງການສົ່ງກວດ",
        queue_th_referrer: "ຜູ້ແນະນຳ (ຜູ້ຊ່ວຍ)",
        queue_empty: "ບໍ່ມີລາຍການລໍຖ້າຈັດຄິວ",

        // Prescription Review (ອ່ານຜົນ/ຈັດຢາ)
        prescription_title: "ຫ້ອງກວດແພດ (ອ່ານຜົນ/ຈັດຢາ)",
        prescription_subtitle: "ທ່ານໝໍກົດຮຽກພົບຄົນໄຂ້ ບູຜົນແລັບ ແລະ ເລືອກສັ່ງຈ່າຍຢາ",
        prescription_th_doctor: "ຊື່ແພດຜູ້ຮັບຜິດຊອບ",
        prescription_th_qstatus: "ສະຖານະຄິວ",
        prescription_empty: "ບໍ່ມີລາຍການລໍຖ້າອ່ານຜົນ",

        // Patient History (ປະຫວັດຜູ້ປ່ວຍ)
        history_title: "ປະຫວັດການເຂົ້າກວດຜູ້ປ່ວຍ",
        history_subtitle: "ຄົ້ນຫາ ແລະ ເບິ່ງປະຫວັດການເຂົ້າກວດ ອາການ ຜົນແລັບ ແລະ ການຈັດສົ່ງຈ່າຍຢາທີ່ເສັດສົມບູນແລ້ວ",
        history_search_placeholder: "ຄົ້ນຫາ HN, ຊື່ ຫຼື Visit ID...",
        history_th_date: "ວັນທີກວດ",
        history_th_diagnosis: "ອາການສຳຄັນ / ອາການວິນິດໄສ",
        history_btn_delete_all: "ລົບທັງໝົດ",
        history_empty: "ບໍ່ມີປະຫວັດການເຂົ້າກວດ",

        // Payment / Billing
        payment_title: "ຊຳລະຄ່າປິ່ນປົວ",
        payment_subtitle: "ລາຍການລໍຖ້າຊຳລະເງິນກ່ອນສົ່ງກວດ Lab",
        payment_empty: "ບໍ່ມີລາຍການລໍຖ້າຊຳລະເງິນ",
        payment_th_tests: "ລາຍການກວດ",
        payment_btn_pay: "ຮັບຊຳລະເງິນ & ສົ່ງ Lab",
        payment_btn_details: "ເບິ່ງລາຍລະອຽດ",
        payment_status_pending: "ລໍຖ້າຊຳລະເງິນ",
        payment_status_paid: "ຊຳລະເງິນເສັດສົມບູນ",
        payment_status_unpaid: "ຍັງບໍ່ຊຳລະເງິນ",

        // Laboratory
        lab_title: "ຫ້ອງ Lab",
        lab_subtitle: "ອັບໂຫຼດຜົນ Lab (PDF, PNG, JPG)",
        lab_empty: "ບໍ່ມີລາຍການລໍຖ້າກວດ Lab",
        lab_btn_upload: "ອັບໂຫຼດຜົນ",
        lab_status_pending: "ລໍຖ້າຜົນແລັບ",
        lab_btn_items: "ລາຍການສົ່ງແລັບ",

        // Payment / Billing System Main
        bill_title: "ລະບົບ Bill / ໃບເສັດຮັບເງິນ",
        bill_subtitle: "ຈັດການ ແລະ ກວດສອບປະຫວັດການອອກໃບເສັດ ແລະ ຍອດຊຳລະເງິນ",
        bill_total_bills: "ບິນທັງໝົດ",
        bill_total_services: "ຍອດລວມບໍລິການ",
        bill_total_discounts: "ສ່ວນຫຼຸດລວມ",
        bill_total_net: "ຍອດຮັບສຸດທິລວມ",
        bill_id: "Bill ID",
        bill_visit_id: "Visit ID",
        bill_patient: "ຜູ້ປ່ວຍ / HN",
        bill_test_count: "ຈຳນວນລາຍການກວດ",
        bill_subtotal: "ຍອດບໍລິການ",
        bill_discount: "ສ່ວນຫຼຸດ",
        bill_payable: "ຍອດສຸດທິ",
        bill_status_paid: "ຊຳລະແລ້ວ",
        bill_print_report: "ພິມລາຍງານ (Print)",

        // Equipment Inventory (ຄັງພັດສະດຸ)
        equip_title: "ລະບົບຈັດການຄັງພັດສະດຸ",
        equip_subtitle: "ຕິດຕາມສະຕັອກ ບັນທຶກການເບີກຈ່າຍ ແລະ ເບິ່ງປະຫວັດການເບີກພັດສະດຸຢ້ອນຫຼັງ",
        equip_add: "ເພີ່ມພັດສະດຸ",
        equip_withdraw: "ເບີກອອກ",
        equip_stat_total: "ລາຍການພັດສະດຸທັງໝົດ",
        equip_stat_low: "ພັດສະດຸສະຕັອກຕ່ຳ (≤ 5)",
        equip_stat_last_in: "ຮັບເຂົ້າຮ່ວມມື້ນີ້ (ຄັ້ງ)",
        equip_stat_withdrawn_today: "ເບີກມື້ນີ້ (ຄັ້ງ)",
        equip_tab_list: "ລາຍການພັດສະດຸ",
        equip_tab_withdraw_history: "ປະຫວັດການເບີກ",
        equip_tab_intake_history: "ປະຫວັດການຮັບເຂົ້າ",
        equip_search_placeholder: "ຄົ້ນຫາຊື່ພັດສະດຸ ຫຼື ປະເພດ...",
        equip_th_code: "ລະຫັດພັດສະດຸ",
        equip_th_name: "ຊື່ພັດສະດຸ",
        equip_th_category: "ປະເພດ",
        equip_th_import: "ນຳເຂົ້າ",
        equip_th_total_qty: "ຈຳນວນທັງໝົດ",
        equip_th_used_qty: "ຈຳນວນເບີກແລ້ວ",
        equip_th_remaining: "ຄົງເຫຼືອ",
        equip_th_unit: "ໜ່ວຍນັບ",

        // Drug Inventory (ຄັງຢາ)
        drugs_title: "ລະບົບຈັດການຄັງຢາ",
        drugs_subtitle: "ຕິດຕາມສະຕັອກຢາ ບັນທຶກການຮັບເຂົ້າ ແລະ ຄວບຄຸມວັນໝົດອາຍຸ",
        drugs_add: "ເພີ່ມຢາໃໝ່",
        drugs_tab_list: "ລາຍການຢາໃນຄັງ",
        drugs_tab_intake: "ປະຫວັດການຮັບເຂົ້າ",
        drugs_search_placeholder: "ຄົ້ນຫາຊື່ຢາ, ລະຫັດຢາ ຫຼື ໝວດໝູ່...",
        drugs_th_code: "ລະຫັດຢາ",
        drugs_th_name: "ຊື່ຢາ",
        drugs_th_category: "ໝວດໝູ່",
        drugs_th_price: "ລາຄາ (LAK)",
        drugs_th_qty: "ຈຳນວນຄົງເຫຼືອ",

        // Lab Services Settings (ຕັ້ງຄ່າລາຍການກວດ)
        services_title: "ຕັ້ງຄ່າລາຍການກວດ",
        services_subtitle: "ຕັ້ງຄ່າແພັກເກັດລາຍການກວດສຸຂະພາບ, Lab ແລະ ລາຄາບໍລິການ",
        services_add: "ເພີ່ມລາຍການກວດ",
        services_search_placeholder: "ຄົ້ນຫາລາຍການກວດ, ລາຄາ...",
        services_th_code: "ລ/ດ",
        services_th_name: "ຊື່ແພັກເກັດ / ລາຍການກວດ",
        services_th_price: "ລາຄາ (ໜ່ວຍ)",
        services_th_desc: "ຄຳອະທິບາຍເພີ່ມເຕີມ",
        services_total_count: "ລາຍການກວດທັງໝົດ",

        // Staff & Permissions
        staff_title: "ຈັດການພະນັກງານ / ຜູ້ໃຊ້ລະບົບ",
        staff_subtitle: "ເພີ່ມ, ແກ້ໄຂ ແລະ ກຳນົດສິດການເຂົ້າເຖິງລະບົບ",
        staff_add: "ເພີ່ມພະນັກງານ",
        staff_code: "ລະຫັດພະນັກງານ",
        staff_email: "ອີເມວ",
        staff_role: "ສິດ/ໜ້າທີ່",
        staff_perm_matrix: "ສິດການໃຊ້ງານລະບົບ",
        staff_perm_view: "ດິ່ງຂໍ້ມູນ",
        staff_perm_add: "ເພີ່ມ",
        staff_perm_edit: "ແກ້ໄຂ",
        staff_perm_delete: "ລົບ",
        staff_perm_row: "ສິດແຖວ",
        staff_perm_preset_view: "ສະເພາະດິ່ງຂໍ້ມູນ",
        staff_perm_preset_full: "ສິດເຕັມ (ເລືອກໝົດ)",
        staff_perm_preset_clear: "ລ້າງທັງໝົດ",

        // Referrals & Dividends
        ref_title: "ລະບົບປັນຜົນ / ຜູ້ແນະນຳ",
        ref_subtitle: "ຈັດການຂໍ້ມູນຜູ້ແນະນຳ, ຄ່າຄອມມິດຊັ່ນ ແລະ ການປັນຜົນ",
        ref_add_referrer: "ເພີ່ມຜູ້ແນະນຳໃໝ່",
        ref_tab_logs: "ຄ່າຄອມມິດຊັ່ນ / ປັນຜົນ",
        ref_tab_members: "ບົດລາຍງານປັນຜົນ",
        ref_tab_daily: "ລາຍງານສະຫຼຸບຄ່າກວດປະຈຳວັນ",
        ref_tab_settings: "ຕັ້ງຄ່າເງື່ອນໄຂປັນຜົນ",

        // Statuses
        status_completed: "ສຳເລັດແລ້ວ",
        status_pending: "ລໍຖ້າດຳເນີນການ",
        status_cancelled: "ຍົກເລີກ",
        action_done: "ເຮັດລາຍການແລ້ວ",

        // Login Screen
        login_title: "ເຂົ້າສູ່ລະບົບ",
        login_subtitle: "ລະບົບຈັດການຄລີນິກ (Clinic System)",
        login_email_placeholder: "ອີເມວ ຫຼື ລະຫັດພະນັກງານ",
        login_password_placeholder: "ລະຫັດຜ່ານ",
        login_button: "ເຂົ້າສູ່ລະບົບ",
        // Tab: Settings (ตั้งค่าปันผล)
        ref_set_overall_title: "ຕັ້ງຄ່າຮູບແບບການຈ່າຍປັນຜົນ (ແບບພາບລວມ)",
        ref_set_enable: "ເປີດໃຊ້ງານ",
        ref_set_calc_type: "ປະເພດການຄິດຄ່າຄອມມິດຊັ່ນ / ປັນຜົນ",
        ref_set_fixed: "ແບບຄົງທີ່ (Fixed Amount)",
        ref_set_fixed_desc: "ຈ່າຍຈຳນວນເງິນຄົງທີ່ຕໍ່ຜູ້ປ່ວຍ 1 ຄົນ",
        ref_set_percent: "ແບບເປີເຊັນ (% Rate)",
        ref_set_percent_desc: "ຄິດອັດຕາ % ຈາກຍອດລວມຄ່າປິ່ນປົວ",
        ref_set_currency: "ສະກຸນເງິນຫຼັກທີ່ໃຊ້ຄຳນວນປັນຜົນ (Currency)",
        ref_set_currency_desc: "ລະບົບຈະສະແດງຜົນສັນຍາລັກ ແລະ ໜ່ວຍເງິນຕາມສະກຸນເງິນທີ່ເລືອກ",
        ref_set_amount_per_patient: "ຈຳນວນເງິນປັນຜົນຕໍ່ຜູ້ປ່ວຍ 1 ຄົນ (ປົກກະຕິ)",
        ref_set_target_bonus: "ເປີດໃຊ້ງານລະບົບໂບນັດຕາມເປົ້າໝາຍ (Monthly Target Goal)",
        ref_set_target_desc: "ຫາກຜູ້ແນະນຳເຮັດຍອດຜູ້ປ່ວຍຮອດເປົ້າໝາຍປະຈຳເດືອນ ຈະໄດ້ຮັບອັດຕາໂບນັດພິເສດ",
        ref_set_target_count: "ເປົ້າໝາຍຈຳນວນຜູ້ປ່ວຍ (ຄົນ/ເດືອນ)",
        ref_set_target_unit: "ຄົນ / ເດືອນ",
        ref_set_target_bonus_rate: "ອັດຕາໂບນັດພິເສດເມື່ອຮອດເປົ້າໝາຍ",
        ref_set_auto_calc: "ຄຳນວນແລະບັນທຶກຍອດປັນຜົນອັດຕະໂນມັດທັນທີທີ່ຊຳລະເງິນສຳເລັດໃນໜ້າ (Payment)",
        ref_set_save_btn: "ບັນທຶກການຕັ້ງຄ່າ",

        ref_set_item_title: "ຕັ້ງຄ່າຮູບແບບການຈ່າຍປັນຜົນ (ແບບລາຍການ)",
        ref_set_add_item: "ເພີ່ມລາຍການປັນຜົນ",
        ref_set_th_no: "ລຳດັບ",
        ref_set_th_item: "ລາຍການ",
        ref_set_th_price: "ລາຄາ",
        ref_set_th_dividend: "ຈຳນວນປັນຜົນ",
        ref_set_th_action: "ຈັດການ",

        // System Settings
        lang_selector_label: "ພາສາລະບົບ"

    },

    // -------------------------------------
    // 🇹🇭 ภาษาไทย (Thai)
    // -------------------------------------
    th: {
        // App Title & General
        app_title: "ระบบจัดการคลินิก (Clinic System)",
        app_name: "ระบบคลินิก",
        logout: "ออกจากระบบ",
        refresh: "รีเฟรชข้อมูล",
        save: "บันทึก",
        cancel: "ยกเลิก",
        edit: "แก้ไข",
        delete: "ลบ",
        close: "ปิด",
        actions: "การจัดการ",
        search: "ค้นหา",
        status: "สถานะ",
        date: "วันที่",
        all: "ทั้งหมด",
        today: "วันนี้",
        this_month: "เดือนนี้",
        details: "รายละเอียด",
        print: "พิมพ์รายงาน",
        export_excel: "Export Excel",
        export_pdf: "Export PDF",
        select_all: "เลือกทั้งหมด",
        clear_all: "ล้างทั้งหมด",
        back: "ย้อนกลับ",
        confirm: "ยืนยัน",
        none: "ไม่มี",

        // Sidebar Menu Navigation
        sidebar_dashboard: "ภาพรวม",
        sidebar_appointments: "นัดหมายล่วงหน้า",
        sidebar_registration: "ทะเบียนผู้ป่วย",
        sidebar_triage: "จุดคัดกรอง",
        sidebar_doctor: "ห้องตรวจแพทย์",
        sidebar_payment: "จ่ายค่ารักษา",
        sidebar_lab: "ห้อง Lab",
        sidebar_queue: "จัดคิว",
        sidebar_prescription: "อ่านผล/จัดยา",
        sidebar_pharmacy: "ห้องจ่ายยา",
        sidebar_history: "ประวัติผู้ป่วย",
        sidebar_billing: "ระบบ Bill / ใบเสร็จ",
        sidebar_backend: "จัดการระบบหลังบ้าน",
        sidebar_services: "ตั้งค่ารายการตรวจ",
        sidebar_stock_drugs: "คลังยา",
        sidebar_stock_equip: "คลังพัสดุ",
        sidebar_staff: "จัดการพนักงาน",
        sidebar_referrals: "ระบบปันผล/ผู้แนะนำ",
        sidebar_reports: "รายงานสรุป",

        // Roles
        role_admin: "ผู้ดูแลระบบ",
        role_doctor: "แพทย์",
        role_nurse: "พยาบาล",
        role_pharmacist: "เภสัชกร",
        role_staff: "พนักงาน",

        // Dashboard
        db_title: "ภาพรวมระบบ",
        db_subtitle: "สถานะและการวิเคราะห์ข้อมูลคลินิก",
        db_greeting_title: "สวัสดี, ผู้บริหาร",
        db_greeting_subtitle: "ภาพรวมคลินิก",
        db_stat_appointments: "นัดหมายวันนี้",
        db_stat_payments: "รายรับรวม",
        db_stat_rescheduled: "ปัจจุบันวันนี้",
        db_stat_patients: "คนไข้ทั้งหมด",
        db_patient_type: "ประเภทผู้ป่วย",
        db_communicable: "โรคติดต่อ",
        db_non_communicable: "โรคไม่ติดต่อ",
        db_appts_today_title: "รายการนัดหมายวันนี้",
        db_stats_service_title: "สถิติการรับบริการ",
        db_legend_visits: "คนไข้เข้าตรวจ",
        db_legend_appointments: "นัดหมาย",
        db_kpi_visits_month: "ผู้ป่วยเข้าตรวจ (เดือนนี้)",
        db_kpi_appts_month: "นัดหมาย (เดือนนี้)",
        db_queue_status: "สถานะคิว",
        unit_items: "รายการ",
        unit_people: "คน",
        th_time: "เวลา",
        th_patient_name: "ชื่อคนไข้",
        th_service: "บริการ",
        th_status: "สถานะ",
        view_all: "ดูทั้งหมด",
        today: "วันนี้",
        search: "ค้นหา",

        // Appointments (ระบบนัดหมาย)
        appts_title: "ระบบนัดหมาย",
        appts_subtitle: "จัดการรายการนัดหมายและลงทะเบียนผู้ป่วย",
        appts_date_label: "วันที่นัด",
        appts_search_placeholder: "ค้นหารหัส, ชื่อผู้จอง, เบอร์โทร...",
        appts_add: "เพิ่มนัดหมาย",
        appts_th_code: "รหัสการจอง",
        appts_th_date: "วันที่นัดหมาย",
        appts_th_time: "เวลา",
        appts_th_referrer: "ผู้แนะนำ (Referrer)",
        appts_th_reason: "เรื่องที่ต้องการตรวจ",
        appts_modal_title: "เพิ่มการนัดหมาย",
        appts_modal_type: "รูปแบบการนัดหมาย",
        appts_modal_self: "นัดหมายเอง (คนไข้)",
        appts_modal_assisted: "นัดหมายผ่านผู้ช่วย /พยาบาล",
        appts_modal_save: "บันทึกการนัดหมาย",

        // Patient Registration
        reg_title: "ทะเบียนผู้ป่วย",
        reg_subtitle: "ข้อมูลและประวัติการรักษาของผู้ป่วยทั้งหมด",
        reg_add_patient: "ลงทะเบียนใหม่",
        reg_hn: "เลข HN",
        reg_name: "ชื่อ-นามสกุล",
        reg_gender: "เพศ",
        reg_age: "อายุ",
        reg_phone: "เบอร์โทร",
        reg_idcard: "เลขบัตรประชาชน/Passport",
        reg_search_placeholder: "ค้นหา ชื่อ, HN, เบอร์โทร...",
        reg_th_address: "ที่อยู่",
        reg_th_allergy: "ประวัติแพ้ยา",
        reg_th_referrer: "ผู้แนะนำ (REFERRER)",
        reg_sent: "ส่งแล้ว",
        reg_sent_triage: "ส่งคัดกรองแล้ว",
        reg_waiting_triage: "รอส่งคัดกรอง",
        reg_status_in_treatment: "กำลังรักษา",
        reg_btn_send_triage: "ส่งเข้าคัดกรอง",
        reg_no_data: "ไม่พบข้อมูลผู้ป่วย",

        // Triage / Vitals
        triage_title: "จุดคัดกรอง",
        triage_subtitle: "บันทึกสัญญาณชีพเบื้องต้น",
        triage_empty: "ยังไม่มีผู้ป่วยรอคัดกรอง",
        triage_temp: "อุณหภูมิ (°C)",
        triage_bp: "ความดัน (BP)",
        triage_pr: "ชีพจร (PR)",
        triage_rr: "การหายใจ (RR)",
        triage_weight: "น้ำหนัก (kg)",
        triage_height: "ส่วนสูง (cm)",
        triage_bmi: "ดัชนีมวลกาย (BMI)",
        triage_chief_complaint: "อาการสำคัญ",
        triage_th_visit: "รหัส VISIT",
        triage_th_name: "ชื่อ-นามสกุล",
        triage_th_action: "ดำเนินการ",
        triage_btn_history: "ซักประวัติ",

        // Doctor Room
        doctor_title: "ห้องตรวจแพทย์",
        doctor_subtitle: "รายการผู้ป่วยรอตรวจ และระบบสั่ง Lab",
        doctor_empty: "ไม่มีผู้ป่วยรอตรวจ",
        doctor_diagnosis: "ผลการวินิจฉัย",
        doctor_treatment: "แผนการรักษา",
        doctor_th_symptoms: "ชื่อ-นามสกุล / อาการเบื้องต้น",
        doctor_th_vitals: "สัญญาณชีพเบื้องต้น",
        doctor_btn_order_lab: "สั่ง Lab",
        doctor_btn_finish: "ตรวจเสร็จ",

        // Queue Management (ระบบจัดคิว)
        queue_title: "ระบบจัดคิวอ่านผลตรวจ",
        queue_subtitle: "บริหารคิวแพทย์และอัปเดตสถานะการตรวจแบบเรียลไทม์",
        queue_inner_header: "รายชื่อคิวรอส่งให้คุณหมออ่านผล",
        queue_th_select_doctor: "เลือกคุณหมอที่ต้องการส่งตรวจ",
        queue_th_referrer: "ผู้แนะนำ (ผู้ช่วย)",
        queue_empty: "ไม่มีรายการรอจัดคิว",

        // Prescription Review (อ่านผล/จัดยา)
        prescription_title: "ห้องตรวจแพทย์ (อ่านผล/จัดยา)",
        prescription_subtitle: "คุณหมอกดเรียกพบคนไข้ ดูผลแล็บ และเลือกสั่งจ่ายยา",
        prescription_th_doctor: "ชื่อแพทย์ผู้รับผิดชอบ",
        prescription_th_qstatus: "สถานะคิว",
        prescription_empty: "ไม่มีรายการรออ่านผล",

        // Patient History (ประวัติผู้ป่วย)
        history_title: "ประวัติการเข้าตรวจผู้ป่วย",
        history_subtitle: "ค้นหาและดูประวัติการเข้าตรวจ อาการ ผลแล็บ และการจัดส่งจ่ายยาที่เสร็จสิ้นแล้ว",
        history_search_placeholder: "ค้นหา HN, ชื่อ หรือ Visit ID...",
        history_th_date: "วันที่ตรวจ",
        history_th_diagnosis: "อาการสำคัญ / อาการวินิจฉัย",
        history_btn_delete_all: "ลบทั้งหมด",
        history_empty: "ไม่มีประวัติการเข้าตรวจ",

        // Payment / Billing
        payment_title: "จ่ายค่ารักษา",
        payment_subtitle: "รายการรอชำระเงินก่อนส่งตรวจ Lab",
        payment_empty: "ไม่มีรายการรอชำระเงิน",
        payment_th_tests: "รายการตรวจ",
        payment_btn_pay: "รับชำระเงิน & ส่ง Lab",
        payment_btn_details: "ดูรายละเอียด",
        payment_status_pending: "รอชำระเงิน",
        payment_status_paid: "ชำระเงินเสร็จสิ้น",
        payment_status_unpaid: "ยังไม่ชำระเงิน",

        // Laboratory
        lab_title: "ห้อง Lab",
        lab_subtitle: "อัปโหลดผล Lab (PDF, PNG, JPG)",
        lab_empty: "ไม่มีรายการรอตรวจ Lab",
        lab_btn_upload: "อัปโหลดผล",
        lab_status_pending: "รอผลแล็บ",
        lab_btn_items: "รายการส่งแล็บ",

        // Payment / Billing System Main
        bill_title: "ระบบ Bill / ใบเสร็จรับเงิน",
        bill_subtitle: "จัดการและตรวจสอบประวัติการออกใบเสร็จและยอดรับชำระเงินของคลินิก",
        bill_total_bills: "บิลทั้งหมด",
        bill_total_services: "ยอดรวมบริการ",
        bill_total_discounts: "ส่วนลดรวม",
        bill_total_net: "ยอดรับสุทธิรวม",
        bill_id: "Bill ID",
        bill_visit_id: "Visit ID",
        bill_patient: "ผู้ป่วย / HN",
        bill_test_count: "จำนวนรายการตรวจ",
        bill_subtotal: "ยอดบริการ",
        bill_discount: "ส่วนลด",
        bill_payable: "ยอดสุทธิ",
        bill_status_paid: "ชำระแล้ว",
        bill_print_report: "พิมพ์รายงาน (Print)",

        // Equipment Inventory (คลังพัสดุ)
        equip_title: "ระบบจัดการคลังพัสดุ",
        equip_subtitle: "ติดตามสต็อก บันทึกการเบิกจ่าย และดูประวัติการเบิกพัสดุย้อนหลัง",
        equip_add: "เพิ่มพัสดุ",
        equip_withdraw: "เบิกออก",
        equip_stat_total: "รายการพัสดุทั้งหมด",
        equip_stat_low: "พัสดุสต็อกต่ำ (≤ 5)",
        equip_stat_last_in: "รับเข้าวันนี้ (ครั้ง)",
        equip_stat_withdrawn_today: "เบิกวันนี้ (ครั้ง)",
        equip_tab_list: "รายการพัสดุ",
        equip_tab_withdraw_history: "ประวัติการเบิก",
        equip_tab_intake_history: "ประวัติการรับเข้า",
        equip_search_placeholder: "ค้นหาชื่อพัสดุหรือประเภท...",
        equip_th_code: "รหัสพัสดุ",
        equip_th_name: "ชื่อพัสดุ",
        equip_th_category: "ประเภท",
        equip_th_import: "นำเข้า",
        equip_th_total_qty: "จำนวนทั้งหมด",
        equip_th_used_qty: "จำนวนเบิกแล้ว",
        equip_th_remaining: "คงเหลือ",
        equip_th_unit: "หน่วยนับ",

        // Drug Inventory (คลังยา)
        drugs_title: "ระบบจัดการคลังยา",
        drugs_subtitle: "ติดตามสต็อกยา บันทึกการรับเข้า และควบคุมวันหมดอายุ",
        drugs_add: "เพิ่มยาใหม่",
        drugs_tab_list: "รายการยาในคลัง",
        drugs_tab_intake: "ประวัติการรับเข้า",
        drugs_search_placeholder: "ค้นหาชื่อยา, รหัสยา หรือหมวดหมู่...",
        drugs_th_code: "รหัสยา",
        drugs_th_name: "ชื่อยา",
        drugs_th_category: "หมวดหมู่",
        drugs_th_price: "ราคา (LAK)",
        drugs_th_qty: "จำนวนคงเหลือ",

        // Lab Services Settings (ตั้งค่ารายการตรวจ)
        services_title: "ตั้งค่ารายการตรวจ",
        services_subtitle: "ตั้งค่าแพ็กเกจรายการตรวจสุขภาพ, Lab และราคาบริการ",
        services_add: "เพิ่มรายการตรวจ",
        services_search_placeholder: "ค้นหารายการตรวจ, ราคา...",
        services_th_code: "ล/ด",
        services_th_name: "ชื่อแพ็กเกจ / รายการตรวจ",
        services_th_price: "ราคา (หน่วย)",
        services_th_desc: "คำอธิบายเพิ่มเติม",
        services_total_count: "รายการตรวจทั้งหมด",

        // Staff & Permissions
        staff_title: "จัดการพนักงาน / ผู้ใช้ระบบ",
        staff_subtitle: "เพิ่ม แก้ไข และกำหนดสิทธิ์การเข้าถึงระบบของพนักงาน",
        staff_add: "เพิ่มพนักงาน",
        staff_code: "รหัสพนักงาน",
        staff_email: "อีเมล",
        staff_role: "สิทธิ์/หน้าที่",
        staff_perm_matrix: "สิทธิ์การใช้งานระบบ",
        staff_perm_view: "ดูข้อมูล",
        staff_perm_add: "เพิ่ม",
        staff_perm_edit: "แก้ไข",
        staff_perm_delete: "ลบ",
        staff_perm_row: "สิทธิ์แถว",
        staff_perm_preset_view: "เฉพาะดูข้อมูล",
        staff_perm_preset_full: "สิทธิ์เต็ม (เลือกหมด)",
        staff_perm_preset_clear: "ล้างทั้งหมด",

        // Referrals & Dividends
        ref_title: "ระบบปันผล / ผู้แนะนำ",
        ref_subtitle: "จัดการข้อมูลผู้แนะนำ ค่าคอมมิชชั่น และการปันผล",
        ref_add_referrer: "เพิ่มผู้แนะนำใหม่",
        ref_tab_logs: "ค่าคอมมิชชั่น / ปันผล",
        ref_tab_members: "รายงานปันผลผู้แนะนำ",
        ref_tab_daily: "รายงานสรุปค่าตรวจประจำวัน",
        ref_tab_settings: "ตั้งค่าเงื่อนไขปันผล",

        // Statuses
        status_completed: "เสร็จสิ้น",
        status_pending: "รอดำเนินการ",
        status_cancelled: "ยกเลิก",
        action_done: "ทำรายการแล้ว",

        // Login Screen
        login_title: "เข้าสู่ระบบ",
        login_subtitle: "ระบบจัดการคลินิก (Clinic System)",
        login_email_placeholder: "อีเมล หรือ รหัสพนักงาน",
        login_password_placeholder: "รหัสผ่าน",
        login_button: "เข้าสู่ระบบ",
        // Tab: Settings (ตั้งค่าปันผล)
        ref_set_overall_title: "ตั้งค่ารูปแบบการจ่ายปันผล (แบบภาพรวม)",
        ref_set_enable: "เปิดใช้งาน",
        ref_set_calc_type: "ประเภทการคิดค่าคอมมิชชั่น / ปันผล",
        ref_set_fixed: "แบบคงที่ (Fixed Amount)",
        ref_set_fixed_desc: "จ่ายจำนวนเงินคงที่ต่อผู้ป่วย 1 คน",
        ref_set_percent: "แบบเปอร์เซ็นต์ (% Rate)",
        ref_set_percent_desc: "คิดตาม % จากยอดรวมค่ารักษา",
        ref_set_currency: "สกุลเงินหลักที่ใช้คำนวณปันผล (Currency)",
        ref_set_currency_desc: "ระบบจะแสดงผลสัญลักษณ์และหน่วยเงินตามสกุลเงินที่เลือก",
        ref_set_amount_per_patient: "จำนวนเงินปันผลต่อผู้ป่วย 1 คน (ปกติ)",
        ref_set_target_bonus: "เปิดใช้งานระบบโบนัสตามเป้าหมาย (Monthly Target Goal)",
        ref_set_target_desc: "หากผู้แนะนำทำยอดผู้ป่วยถึงเป้าหมายประจำเดือน จะได้รับอัตราโบนัสพิเศษ",
        ref_set_target_count: "เป้าหมายจำนวนผู้ป่วย (คน/เดือน)",
        ref_set_target_unit: "คน / เดือน",
        ref_set_target_bonus_rate: "อัตราโบนัสพิเศษเมื่อถึงเป้าหมาย",
        ref_set_auto_calc: "คำนวณและบันทึกยอดปันผลให้อัตโนมัติทันทีที่ชำระเงินเสร็จสิ้นในหน้า (Payment)",
        ref_set_save_btn: "บันทึกการตั้งค่า",

        ref_set_item_title: "ตั้งค่ารูปแบบการจ่ายปันผล (แบบรายรายการ)",
        ref_set_add_item: "เพิ่มรายการปันผล",
        ref_set_th_no: "ลำดับ",
        ref_set_th_item: "รายการ",
        ref_set_th_price: "ราคา",
        ref_set_th_dividend: "จำนวนปันผล",
        ref_set_th_action: "จัดการ",

        // System Settings
        lang_selector_label: "ภาษาของระบบ"
    },

    // -------------------------------------
    // 🇬🇧 ภาษาอังกฤษ (English)
    // -------------------------------------
    en: {
        // App Title & General
        app_title: "Clinic Management System",
        app_name: "Clinic System",
        logout: "Log Out",
        refresh: "Refresh Data",
        save: "Save",
        cancel: "Cancel",
        edit: "Edit",
        delete: "Delete",
        close: "Close",
        actions: "Actions",
        search: "Search",
        status: "Status",
        date: "Date",
        all: "All",
        today: "Today",
        this_month: "This Month",
        details: "Details",
        print: "Print Report",
        export_excel: "Export Excel",
        export_pdf: "Export PDF",
        select_all: "Select All",
        clear_all: "Clear All",
        back: "Back",
        confirm: "Confirm",
        none: "None",

        // Sidebar Menu Navigation
        sidebar_dashboard: "Dashboard",
        sidebar_appointments: "Appointments",
        sidebar_registration: "Patient Registration",
        sidebar_triage: "Triage / Vitals",
        sidebar_doctor: "Doctor Room",
        sidebar_payment: "Cashier / Payments",
        sidebar_lab: "Laboratory",
        sidebar_queue: "Queue Management",
        sidebar_prescription: "Prescription Review",
        sidebar_pharmacy: "Pharmacy",
        sidebar_history: "Patient History",
        sidebar_billing: "Invoices & Billing",
        sidebar_backend: "Backend Management",
        sidebar_services: "Lab Services Settings",
        sidebar_stock_drugs: "Drug Inventory",
        sidebar_stock_equip: "Equipment Inventory",
        sidebar_staff: "Staff Management",
        sidebar_referrals: "Referrals & Dividends",
        sidebar_reports: "Reports & Summary",

        // Roles
        role_admin: "Administrator",
        role_doctor: "Doctor",
        role_nurse: "Nurse",
        role_pharmacist: "Pharmacist",
        role_staff: "Staff",

        // Dashboard
        db_title: "System Dashboard",
        db_subtitle: "Clinic Status and Operational Analytics",
        db_greeting_title: "Hello, Administrator",
        db_greeting_subtitle: "Clinic Overview",
        db_stat_appointments: "Today's Appointments",
        db_stat_payments: "Total Revenue",
        db_stat_rescheduled: "In Progress Today",
        db_stat_patients: "Total Patients",
        db_patient_type: "Patient Categories",
        db_communicable: "Communicable",
        db_non_communicable: "Non-Communicable",
        db_appts_today_title: "Today's Appointments",
        db_stats_service_title: "Service Statistics",
        db_legend_visits: "Visits",
        db_legend_appointments: "Appointments",
        db_kpi_visits_month: "Patients Checked In (This Month)",
        db_kpi_appts_month: "Appointments (This Month)",
        db_queue_status: "Queue Status",
        unit_items: "items",
        unit_people: "patients",
        th_time: "Time",
        th_patient_name: "Patient Name",
        th_service: "Service",
        th_status: "Status",
        view_all: "View All",
        today: "Today",
        search: "Search",

        // Appointments (ระบบนัดหมาย)
        appts_title: "Appointment Management",
        appts_subtitle: "Manage scheduled appointments and patient pre-registrations",
        appts_date_label: "Appointment Date",
        appts_search_placeholder: "Search code, patient name, phone...",
        appts_add: "Add Appointment",
        appts_th_code: "Booking Code",
        appts_th_date: "Appt Date",
        appts_th_time: "Time",
        appts_th_referrer: "Referrer",
        appts_th_reason: "Chief Reason / Symptoms",
        appts_modal_title: "Add Appointment",
        appts_modal_type: "Appointment Type",
        appts_modal_self: "Direct Booking (Patient)",
        appts_modal_assisted: "Assisted Booking (Patient / Nurse)",
        appts_modal_save: "Save Appointment",

        // Patient Registration
        reg_title: "Patient Registration",
        reg_subtitle: "Manage all patient profiles and medical records",
        reg_add_patient: "New Registration",
        reg_hn: "HN Code",
        reg_name: "Full Name",
        reg_gender: "Gender",
        reg_age: "Age",
        reg_phone: "Phone Number",
        reg_idcard: "ID Card / Passport No.",
        reg_search_placeholder: "Search Name, HN, Phone...",
        reg_th_address: "Address",
        reg_th_allergy: "Drug Allergies",
        reg_th_referrer: "Referrer",
        reg_sent: "Sent",
        reg_sent_triage: "Sent to Triage",
        reg_waiting_triage: "Pending Triage",
        reg_status_in_treatment: "In Treatment",
        reg_btn_send_triage: "Send to Triage",
        reg_no_data: "No patient records found",

        // Triage / Vitals
        triage_title: "Triage Station",
        triage_subtitle: "Record primary vitals and chief complaints",
        triage_empty: "No patients waiting for triage",
        triage_temp: "Temperature (°C)",
        triage_bp: "Blood Pressure (BP)",
        triage_pr: "Pulse Rate (PR)",
        triage_rr: "Resp. Rate (RR)",
        triage_weight: "Weight (kg)",
        triage_height: "Height (cm)",
        triage_bmi: "Body Mass Index (BMI)",
        triage_chief_complaint: "Chief Complaint",
        triage_th_visit: "VISIT Code",
        triage_th_name: "Patient Name",
        triage_th_action: "Action",
        triage_btn_history: "Record Vitals",

        // Doctor Room
        doctor_title: "Doctor Room",
        doctor_subtitle: "Patients awaiting examination and lab orders",
        doctor_empty: "No patients waiting for examination",
        doctor_diagnosis: "Diagnosis Results",
        doctor_treatment: "Treatment Plan",
        doctor_th_symptoms: "Patient Name / Chief Complaint",
        doctor_th_vitals: "Primary Vitals",
        doctor_btn_order_lab: "Order Lab",
        doctor_btn_finish: "Complete Check",

        // Queue Management (ระบบจัดคิว)
        queue_title: "Lab Review Queue Management",
        queue_subtitle: "Manage doctor queues and real-time exam status",
        queue_inner_header: "Queue list waiting for doctor review",
        queue_th_select_doctor: "Select Doctor to Assign",
        queue_th_referrer: "Referrer / Assistant",
        queue_empty: "No patients waiting in queue",

        // Prescription Review (อ่านผล/จัดยา)
        prescription_title: "Doctor Room (Result Review / Prescription)",
        prescription_subtitle: "Doctor reviews lab results and prescribes medications",
        prescription_th_doctor: "Assigned Doctor",
        prescription_th_qstatus: "Queue Status",
        prescription_empty: "No patients waiting for result review",

        // Patient History (ประวัติผู้ป่วย)
        history_title: "Patient Visit History",
        history_subtitle: "Search and view complete examination, diagnosis, lab, and pharmacy history",
        history_search_placeholder: "Search HN, Name, or Visit ID...",
        history_th_date: "Exam Date",
        history_th_diagnosis: "Chief Complaint / Diagnosis",
        history_btn_delete_all: "Delete All",
        history_empty: "No visit history records found",

        // Payment / Billing
        payment_title: "Cashier / Payment",
        payment_subtitle: "Pending payment records prior to lab testing",
        payment_empty: "No pending payments",
        payment_th_tests: "Lab Test Items",
        payment_btn_pay: "Process Payment & Send to Lab",
        payment_btn_details: "View Details",
        payment_status_pending: "Pending Payment",
        payment_status_paid: "Payment Complete",
        payment_status_unpaid: "Unpaid",

        // Laboratory
        lab_title: "Laboratory",
        lab_subtitle: "Upload lab results (PDF, PNG, JPG)",
        lab_empty: "No pending lab tests",
        lab_btn_upload: "Upload Result",
        lab_status_pending: "Awaiting Lab Result",
        lab_btn_items: "Lab Test Orders",

        // Payment / Billing System Main
        bill_title: "Invoices & Billing System",
        bill_subtitle: "Manage, review and verify invoice history and payments",
        bill_total_bills: "Total Bills",
        bill_total_services: "Total Services",
        bill_total_discounts: "Total Discounts",
        bill_total_net: "Total Net Revenue",
        bill_id: "Bill ID",
        bill_visit_id: "Visit ID",
        bill_patient: "Patient / HN",
        bill_test_count: "Lab Tests Count",
        bill_subtotal: "Subtotal",
        bill_discount: "Discount",
        bill_payable: "Net Payable",
        bill_status_paid: "Paid",
        bill_print_report: "Print Report",

        // Equipment Inventory (คลังพัสดุ)
        equip_title: "Equipment Inventory System",
        equip_subtitle: "Track equipment stock, record usage disbursements and view history logs",
        equip_add: "Add Equipment",
        equip_withdraw: "Disburse / Issue",
        equip_stat_total: "Total Equipment Items",
        equip_stat_low: "Low Stock Alert (≤ 5)",
        equip_stat_last_in: "Restocked Today",
        equip_stat_withdrawn_today: "Disbursed Today",
        equip_tab_list: "Equipment List",
        equip_tab_withdraw_history: "Disbursement History",
        equip_tab_intake_history: "Restock History",
        equip_search_placeholder: "Search by equipment name or category...",
        equip_th_code: "Equipment Code",
        equip_th_name: "Equipment Name",
        equip_th_category: "Category",
        equip_th_import: "Imported",
        equip_th_total_qty: "Total Quantity",
        equip_th_used_qty: "Disbursed Quantity",
        equip_th_remaining: "Stock Remaining",
        equip_th_unit: "Unit",

        // Drug Inventory (คลังยา)
        drugs_title: "Drug Inventory System",
        drugs_subtitle: "Track pharmaceutical stock, record intake and monitor expiration dates",
        drugs_add: "Add New Drug",
        drugs_tab_list: "Drug Inventory List",
        drugs_tab_intake: "Stock Intake History",
        drugs_search_placeholder: "Search drug name, code or category...",
        drugs_th_code: "Drug Code",
        drugs_th_name: "Drug Name",
        drugs_th_category: "Category",
        drugs_th_price: "Price (LAK)",
        drugs_th_qty: "Stock Quantity",

        // Lab Services Settings (ตั้งค่ารายการตรวจ)
        services_title: "Lab Services Settings",
        services_subtitle: "Configure health check packages, laboratory tests, and pricing",
        services_add: "Add Test Service",
        services_search_placeholder: "Search test name, price...",
        services_th_code: "No.",
        services_th_name: "Package / Test Service Name",
        services_th_price: "Price (Unit)",
        services_th_desc: "Description / Notes",
        services_total_count: "Total Test Services",

        // Staff & Permissions
        staff_title: "Staff & User Management",
        staff_subtitle: "Create, edit and manage user access permissions",
        staff_add: "Add Staff Member",
        staff_code: "Staff Code",
        staff_email: "Email Address",
        staff_role: "Role / Position",
        staff_perm_matrix: "System Access Permissions",
        staff_perm_view: "View",
        staff_perm_add: "Add",
        staff_perm_edit: "Edit",
        staff_perm_delete: "Delete",
        staff_perm_row: "Row Access",
        staff_perm_preset_view: "Read Only",
        staff_perm_preset_full: "Full Access",
        staff_perm_preset_clear: "Clear All",

        // Referrals & Dividends
        ref_title: "Referrals & Dividend Commissions",
        ref_subtitle: "Manage referrers, commission calculations and payout history",
        ref_add_referrer: "Add New Referrer",
        ref_tab_logs: "Commissions & Payouts",
        ref_tab_members: "Referrers Dividend Report",
        ref_tab_daily: "Daily Exam Commission Summary",
        ref_tab_settings: "Dividend Rules & Rates Settings",

        // Statuses
        status_completed: "Completed",
        status_pending: "Pending",
        status_cancelled: "Cancelled",
        action_done: "Processed",

        // Login Screen
        login_title: "System Sign In",
        login_subtitle: "Clinic Management System",
        login_email_placeholder: "Email address or Staff Code",
        login_password_placeholder: "Password",
        login_button: "Sign In",
        // Tab: Settings (ตั้งค่าปันผล)
        ref_set_overall_title: "Dividend Payout Settings (Overall)",
        ref_set_enable: "Enable",
        ref_set_calc_type: "Commission / Dividend Calculation Type",
        ref_set_fixed: "Fixed Amount",
        ref_set_fixed_desc: "Pay a fixed amount per 1 patient",
        ref_set_percent: "Percentage (% Rate)",
        ref_set_percent_desc: "Calculate % from total treatment cost",
        ref_set_currency: "Main Currency for Calculation",
        ref_set_currency_desc: "The system will display symbols and units based on the selected currency",
        ref_set_amount_per_patient: "Dividend amount per 1 patient (Normal)",
        ref_set_target_bonus: "Enable Monthly Target Goal Bonus",
        ref_set_target_desc: "If the referrer reaches the monthly patient target, they receive a special bonus rate",
        ref_set_target_count: "Patient Target (Persons/Month)",
        ref_set_target_unit: "Persons / Month",
        ref_set_target_bonus_rate: "Special Bonus Rate on Target",
        ref_set_auto_calc: "Automatically calculate and record dividends upon payment completion",
        ref_set_save_btn: "Save Settings",

        ref_set_item_title: "Dividend Payout Settings (Per Item)",
        ref_set_add_item: "Add Dividend Item",
        ref_set_th_no: "No.",
        ref_set_th_item: "Item",
        ref_set_th_price: "Price",
        ref_set_th_dividend: "Dividend Amount",
        ref_set_th_action: "Action",

        // System Settings
        lang_selector_label: "System Language"
    }
};

// -------------------------------------
// i18n Engine & Helper Functions
// -------------------------------------

function getCurrentLanguage() {
    return localStorage.getItem('clinic_lang') || 'la';
}

function setClinicLanguage(lang) {
    if (!CLINIC_I18N_DICTIONARY[lang]) {
        lang = 'la';
    }
    localStorage.setItem('clinic_lang', lang);
    applyClinicLanguage(lang);

    // Sync language select dropdowns in DOM
    const selectors = document.querySelectorAll('.clinic-lang-select');
    selectors.forEach(sel => {
        sel.value = lang;
    });

    // Re-render dynamic components if functions exist
    if (typeof renderAppointmentsTable === 'function') renderAppointmentsTable();
    if (typeof renderBillsTable === 'function') renderBillsTable();
    if (typeof loadPatients === 'function') loadPatients();
    if (typeof loadTriage === 'function') loadTriage();
    if (typeof loadDoctorQueue === 'function') loadDoctorQueue();
    if (typeof loadPaymentQueue === 'function') loadPaymentQueue();
    if (typeof loadLabQueue === 'function') loadLabQueue();
    if (typeof loadQueueList === 'function') loadQueueList();
    if (typeof loadPrescriptionQueue === 'function') loadPrescriptionQueue();
    if (typeof loadPatientHistory === 'function') loadPatientHistory();
    if (typeof renderStaffTable === 'function' && window.allStaffUsers) renderStaffTable(window.allStaffUsers);
    if (typeof renderCommissionLogsTable === 'function') renderCommissionLogsTable();
}

function t(key, fallbackText = '') {
    const currentLang = getCurrentLanguage();
    const dict = CLINIC_I18N_DICTIONARY[currentLang] || CLINIC_I18N_DICTIONARY['la'];
    if (dict && dict[key] !== undefined) {
        return dict[key];
    }
    // Fallback to Thai or fallback text
    const thDict = CLINIC_I18N_DICTIONARY['th'];
    if (thDict && thDict[key] !== undefined) {
        return thDict[key];
    }
    return fallbackText || key;
}

function applyClinicLanguage(lang = null) {
    const targetLang = lang || getCurrentLanguage();
    const dict = CLINIC_I18N_DICTIONARY[targetLang] || CLINIC_I18N_DICTIONARY['la'];
    if (!dict) return;

    // 1. Elements with data-i18n
    document.querySelectorAll('[data-i18n]').forEach(el => {
        const key = el.getAttribute('data-i18n');
        if (dict[key] !== undefined) {
            // Keep icons if element contains inner HTML icons
            const iconEl = el.querySelector('i');
            if (iconEl) {
                const iconHtml = iconEl.outerHTML;
                el.innerHTML = iconHtml + ' ' + dict[key];
            } else {
                el.textContent = dict[key];
            }
        }
    });

    // 2. Elements with data-i18n-placeholder
    document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
        const key = el.getAttribute('data-i18n-placeholder');
        if (dict[key] !== undefined) {
            el.setAttribute('placeholder', dict[key]);
        }
    });

    // 3. Update HTML lang tag
    document.documentElement.setAttribute('lang', targetLang);
}

// Auto apply language on DOM load
document.addEventListener('DOMContentLoaded', function () {
    const currentLang = getCurrentLanguage();
    applyClinicLanguage(currentLang);
    const selectors = document.querySelectorAll('.clinic-lang-select');
    selectors.forEach(sel => {
        sel.value = currentLang;
    });
});

window.CLINIC_I18N_DICTIONARY = CLINIC_I18N_DICTIONARY;
window.getCurrentLanguage = getCurrentLanguage;
window.setClinicLanguage = setClinicLanguage;
window.t = t;
window.applyClinicLanguage = applyClinicLanguage;
