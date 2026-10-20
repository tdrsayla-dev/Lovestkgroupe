/**
 * LOVE STK GROUPE — Company Database Configuration
 * กำหนดค่าการเชื่อมต่อ Supabase สำหรับระบบเว็บไซต์ Company
 */
const COMPANY_CONFIG = {
    // 1. Supabase Project URL
    SUPABASE_URL: "https://vxituqhreggryepvjhzr.supabase.co",

    // 2. Supabase Public Anon Key
    SUPABASE_ANON_KEY: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ4aXR1cWhyZWdncnllcHZqaHpyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTE1MTUxNzEsImV4cCI6MjEwNzA5MTE3MX0.Su07DGQQ_83aGtsHn4__stotFyztPqJ6679HM9Vac3o",

    // 3. ชื่อ Storage Bucket สำหรับอัปโหลดรูปภาพ
    STORAGE_BUCKET: "website-media",

    // 4. ภาษาที่รองรับ
    LANGUAGES: ["th", "lo", "en"],
    DEFAULT_LANG: "th",

    // 5. ค่าเริ่มต้นสำหรับการเปิด-ปิดฟังก์ชัน (Feature Flags)
    FEATURES: {
        businesses: true,
        leadership: true,
        products: true,
        news: true,
        ceo_dashboard: true,
        clinic_booking: true,
        human_resource: true,
        crm_system: true,
        stk_smart: true,
        language_switcher: true,
        theme_switcher: true
    }
};

// ส่งออกให้เรียกใช้งานได้ทั้ง global window และ script ทั่วไป
if (typeof window !== "undefined") {
    window.COMPANY_CONFIG = COMPANY_CONFIG;
}
