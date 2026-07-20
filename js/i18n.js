// js/i18n.js - ระบบการแปลภาษา (Internationalization Engine)

const translations = {
    // English
    'en': {
        // Main Menu
        'menu_main': 'Main Menu',
        'menu_my_dashboard': 'My Dashboard',
        'menu_dashboard': 'Dashboard',
        'menu_time_tracking': 'Time Tracking',
        
        // Records
        'menu_records': 'Records',
        'menu_leave_requests': 'Leave Requests',
        'menu_budget_requests': 'Budget Requests',
        'menu_attendance_logs': 'Attendance Logs',
        'menu_staff_directory': 'Staff Directory',
        'menu_digital_card': 'Digital Card',
        
        menu_main: 'MAIN MENU',
        menu_my_dashboard: 'My Dashboard',
        menu_dashboard: 'Dashboard',
        menu_time_tracking: 'Time Tracking',
        menu_records: 'RECORDS',
        menu_leave_requests: 'Leave Requests',
        btn_logout: 'Logout',
        no_records: 'No records found',
        no_data: 'NO DATA FOUND',
        Action: 'Action',
        ID_LEAVE: 'Leave ID',
        EMPLOYEE_ID: 'Employee ID',
        PREFIX: 'Prefix',
        FIRST_NAME: 'First Name',
        LAST_NAME: 'Last Name',
        DEPARTMENT_ID: 'Department',
        POSITION_ID: 'Position',
        CONTACT: 'Contact',
        'OBJECT ': 'Object',
        'TYPE ': 'Type',
        START_DATE: 'Start Date',
        END_DATE: 'End Date',
        TOTAL_DAYS: 'Total Days',
        'WORK HANDOVER': 'Work Handover',
        SIGNATURE: 'Signature',
        PHOTO: 'Photo',
        
        // Dashboard
        hello: 'Hello,',
        welcome_hr: 'Welcome to Love STK Groupe HR System',
        today_time: 'Today Time In/Out',
        leave_quota: 'Leave Quota Remaining',
        reward_level: 'Reward Level',
        job_rank: 'Job Level',
        recent_leaves: 'Recent Leave Requests',
        req_leave: 'Request Leave >',
        type: 'Type',
        start_date: 'Start Date',
        status: 'Status',
        loading: 'Loading...',
        my_budget: 'My Budget Requests',
        req_budget: 'Request Budget >',
        item: 'Item',
        amount: 'Amount',
        announcements_title: 'Announcements & News',
        no_announcements: 'No new announcements',
        days: 'Days',
        role: 'Role',
        cancel: 'Cancel',
        
        status_approved: 'Approved',
        status_rejected: 'Rejected',
        status_pending: 'Pending',
        status_late: 'Late',
        status_present: 'Present',
        no_present_staff: 'No staff present yet',
        people_unit: 'people',
        status_absent: 'ABSENT',
        no_absent_staff: 'No absent staff',
        no_leave_records: 'No leave records found.',
        no_birthdays: 'No birthdays this month 🎉',
        status_absent_leave: 'Absent/Leave',
        loading_star_data: 'Loading star ratings...',
        no_evaluation_data: 'No evaluation data found',
        load_data_failed: 'Failed to load data',
        no_star_eval_data: 'No star evaluation data available yet',
        
        qr_not_ready: 'QR function is not ready yet',
        learning_doc: 'Learning Document',
        learn_youtube: 'Learn via YouTube',
        watch_fb: 'Watch via Facebook',
        emp_id_label: 'Employee ID:',
        asset_number_label: 'Asset Number:',
        no_comment: 'No comments yet',
        holiday: 'Holiday',
        not_yet_arrived: 'Not yet',
        no_attachment: 'No attachment found for this item',
        scan_stars: 'Scan Stars',
        
        change_password: 'Change Password',
        old_password: 'Old Password',
        new_password: 'New Password',
        confirm_password: 'Confirm New Password',
        update_password: 'Update Password',
        password_mismatch: 'Passwords do not match',
        password_updated: 'Password updated successfully',
        
        my_profile: 'My Profile',
        birthday: 'Birthday',
        tel: 'Phone',
        email: 'Email',
        line_id: 'Line ID',
        save_profile: 'Save Changes',
        profile_updated: 'Profile updated successfully',
        
        // Admin Menu
        menu_administration: 'Administration',
        menu_management: 'Management',
        menu_organization: 'Organization',
        menu_stk_wow: 'STK WOW',
        menu_kpi: 'KPI Records',
        menu_org_struct: 'Org Structure',
        menu_department: 'Department',
        menu_assets: 'Assets',
        menu_announcements: 'Announcements',
        menu_news: 'News',
        menu_documents: 'Documents',
        menu_training: 'Training',
        menu_orientation: 'Orientation',
        menu_policy: 'Policy',
        menu_users: 'Users',
        menu_web_settings: 'Web Info Settings'
    },
    'la': {
        menu_main: 'ເມນູຫຼັກ',
        menu_my_dashboard: 'ໜ້າຫຼັກຂອງຂ້ອຍ',
        menu_dashboard: 'ແດຊບອດ',
        menu_time_tracking: 'ບັນທຶກເວລາເຮັດວຽກ',
        menu_records: 'ລະບົບລາຍງານ',
        menu_leave_requests: 'ຄຳຮ້ອງຂໍລາພັກ',
        btn_logout: 'ອອກຈາກລະບົບ',
        no_records: 'ບໍ່ພົບຂໍ້ມູນ',
        no_data: 'ບໍ່ພົບຂໍ້ມູນ',
        Action: 'ຈັດການ',
        ID_LEAVE: 'ລະຫັດການລາ',
        EMPLOYEE_ID: 'ລະຫັດພະນັກງານ',
        PREFIX: 'ຄຳນຳໜ້າ',
        FIRST_NAME: 'ຊື່',
        LAST_NAME: 'ນາມສະກຸນ',
        DEPARTMENT_ID: 'ພະແນກ',
        POSITION_ID: 'ຕຳແໜ່ງ',
        CONTACT: 'ເບີໂທຕິດຕໍ່',
        'OBJECT ': 'ຈຸດປະສົງ',
        'TYPE ': 'ປະເພດການລາ',
        START_DATE: 'ວັນທີເລີ່ມ',
        END_DATE: 'ວັນທີສິ້ນສຸດ',
        TOTAL_DAYS: 'ຈຳນວນມື້',
        'WORK HANDOVER': 'ຜູ້ຮັບຜິດຊອບແທນ',
        SIGNATURE: 'ລາຍເຊັນ',
        PHOTO: 'ຮູບພາບ',

        // Dashboard
        hello: 'ສະບາຍດີ,',
        welcome_hr: 'ຍິນດີຕ້ອນຮັບເຂົ້າສູ່ລະບົບຈັດການຂໍ້ມູນພະນັກງານ Love STK Groupe',
        today_time: 'ເວລາເຂົ້າ/ອອກມື້ນີ້',
        leave_quota: 'ໂຄຕ້າວັນລາພັກທີ່ເຫຼືອ',
        reward_level: 'ລະດັບຂອງລາງວັນ',
        job_rank: 'ລະດັບຕຳແໜ່ງງານ',
        recent_leaves: 'ລາຍການລາພັກຫຼ້າສຸດ',
        req_leave: 'ຂໍລາພັກ >',
        type: 'ປະເພດ',
        start_date: 'ວັນທີເລີ່ມ',
        status: 'ສະຖານະ',
        loading: 'ກຳລັງໂຫຼດຂໍ້ມູນ...',
        my_budget: 'ການຂໍອະນຸມັດງົບປະມານຂອງຂ້ອຍ',
        req_budget: 'ຂໍງົບປະມານ >',
        item: 'ລາຍການ',
        amount: 'ຈຳນວນເງິນ',
        announcements_title: 'ປະກາດ ແລະ ຂ່າວສານໃນອົງກອນ',
        no_announcements: 'ບໍ່ມີປະກາດໃໝ່',
        days: 'ມື້',
        role: 'ຕຳແໜ່ງ',
        cancel: 'ຍົກເລີກ',
        
        status_approved: 'ອະນຸມັດແລ້ວ',
        status_rejected: 'ປະຕິເສດ',
        status_pending: 'ລໍຖ້າພິຈາລະນາ',
        status_late: 'ມາຊ້າ',
        status_present: 'ມາເຮັດວຽກ',
        no_present_staff: 'ຍັງບໍ່ມີພະນັກງານມາເຮັດວຽກ',
        people_unit: 'ຄົນ',
        status_absent: 'ຂາດການ',
        no_absent_staff: 'ບໍ່ມີຄົນຂາດການ',
        no_leave_records: 'ບໍ່ມີປະຫວັດການລາພັກ',
        no_birthdays: 'ບໍ່ມີວັນເກີດໃນເດືອນນີ້ 🎉',
        status_absent_leave: 'ຂາດການ/ລາພັກ',
        loading_star_data: 'ກຳລັງໂຫຼດຂໍ້ມູນຄະແນນດາວ...',
        no_evaluation_data: 'ບໍ່ພົບຂໍ້ມູນການປະເມີນ',
        load_data_failed: 'ໂຫຼດຂໍ້ມູນບໍ່ສຳເລັດ',
        no_star_eval_data: 'ຍັງບໍ່ມີຂໍ້ມູນການປະເມີນດາວ',
        
        qr_not_ready: 'ຟັງຊັນສະແກນ QR ຍັງບໍ່ພ້ອມໃຊ້ງານ',
        learning_doc: 'ເອກະສານປະກອບການຮຽນ',
        learn_youtube: 'ຮຽນຜ່ານ YouTube',
        watch_fb: 'ເບິ່ງຜ່ານ Facebook',
        emp_id_label: 'ລະຫັດພະນັກງານ:',
        asset_number_label: 'ໝາຍເລກ:',
        no_comment: 'ຍັງບໍ່ມີຄອມເມັ້ນ',
        holiday: 'ວັນພັກ',
        not_yet_arrived: 'ຍັງບໍ່ຮອດ',
        no_attachment: 'ບໍ່ພົບໄຟລ໌ແນບສຳລັບລາຍການນີ້',
        scan_stars: 'ສະແກນດາວ',
        
        change_password: 'ປ່ຽນລະຫັດຜ່ານ',
        old_password: 'ລະຫັດຜ່ານເກົ່າ',
        new_password: 'ລະຫັດຜ່ານໃໝ່',
        confirm_password: 'ຢືນຢັນລະຫັດຜ່ານໃໝ່',
        update_password: 'ອັບເດດລະຫັດຜ່ານ',
        password_mismatch: 'ລະຫັດຜ່ານບໍ່ກົງກັນ',
        password_updated: 'ປ່ຽນລະຫັດຜ່ານສຳເລັດແລ້ວ',
        
        my_profile: 'ຂໍ້ມູນສ່ວນຕົວ',
        birthday: 'ວັນເດືອນປີເກີດ',
        tel: 'ເບີໂທລະສັບ',
        email: 'ອີເມລ',
        line_id: 'ໄອດີ Line',
        save_profile: 'ບັນທຶກຂໍ້ມູນ',
        profile_updated: 'ອັບເດດຂໍ້ມູນສຳເລັດແລ້ວ',

        // Form Labels
        menu_budget_requests: 'ຄຳຮ້ອງຂໍງົບປະມານ',
        menu_attendance_logs: 'ບັນທຶກເວລາເຂົ້າວຽກ',
        menu_staff_directory: 'ລາຍຊື່ພະນັກງານ',
        menu_digital_card: 'ບັດດິຈິຕອນ',
        menu_administration: 'ການບໍລິຫານ',
        menu_management: 'ການຈັດການ',
        menu_organization: 'ອົງກອນ',
        menu_stk_wow: 'STK WOW',
        menu_kpi: 'ບັນທຶກ KPI',
        menu_org_struct: 'ໂຄງສ້າງອົງກອນ',
        menu_department: 'ພະແນກ',
        menu_assets: 'ຊັບສິນ',
        menu_announcements: 'ປະກາດ',
        menu_news: 'ຂ່າວສານ',
        menu_documents: 'ເອກະສານ',
        menu_training: 'ການຝຶກອົບຮົມ',
        menu_orientation: 'ການປະຖົມນິເທດ',
        menu_policy: 'ນະໂຍບາຍ',
        menu_users: 'ຜູ້ໃຊ້',
        menu_web_settings: 'ຕັ້ງຄ່າຂໍ້ມູນເວັບໄຊ້'
    }
};

// ฟังก์ชันดึงภาษาปัจจุบันจาก localStorage (ค่าเริ่มต้นคือ 'la')
function getCurrentLanguage() {
    return localStorage.getItem('hr_language') || 'la';
}

// ฟังก์ชันดึงคำแปลไปใช้ใน JavaScript
function t(key) {
    let currentLang = getCurrentLanguage();
    // ถ้าเจอตรงๆ
    if (translations[currentLang] && translations[currentLang][key]) {
        return translations[currentLang][key];
    }
    // หาแบบ Case Insensitive ให้สำหรับ Table Headers
    if (translations[currentLang]) {
        for (let k in translations[currentLang]) {
            if (k.trim().toUpperCase() === String(key).trim().toUpperCase()) {
                return translations[currentLang][k];
            }
        }
    }
    return key; // Fallback
}

// ฟังก์ชันสลับภาษาและแปลหน้าจออัตโนมัติ
function changeLanguage(lang) {
    if (!['la', 'en'].includes(lang)) lang = 'la';
    localStorage.setItem('hr_language', lang);
    
    // จัดการ Font: ถ้าเป็น la ให้ใช้ Noto Sans Lao
    if (lang === 'la') {
        document.body.style.fontFamily = "'Noto Sans Lao', sans-serif";
    } else {
        document.body.style.fontFamily = "'Kanit', sans-serif";
    }

    updateDOMTranslations(lang);
}

// ฟังก์ชันค้นหาและแทนที่ข้อความบนหน้าเว็บ (DOM)
function updateDOMTranslations() {
    const elements = document.querySelectorAll('[data-i18n]');
    elements.forEach(el => {
        const key = el.getAttribute('data-i18n');
        el.textContent = t(key);
    });
    
    // อัปเดต Title
    if (document.querySelector('title[data-i18n]')) {
         document.title = t(document.querySelector('title[data-i18n]').getAttribute('data-i18n'));
    }
}

// โหลดคำแปลเมื่อเริ่มหน้าเว็บ
window.addEventListener('DOMContentLoaded', () => {
    updateDOMTranslations();
});
