// ==========================================
// 🏢 STK GROUPE - Company Settings Helper Module (companySettings.js)
// ==========================================
(function () {
  const DEFAULT_COMPANY_SETTINGS = {
    name: 'LOVE STK GROUPE',
    branch: 'สำนักงานใหญ่ / คลินิกเวชกรรม',
    address: 'เวียงจันทน์, สปป.ลาว (Vientiane, Lao PDR)',
    phone: '+856 20 5555 9999',
    taxId: '',
    logoUrl: '',
    receiptHeaderNote: 'ใบเสร็จรับเงิน / Receipt',
    receiptFooterNote: 'ขอบพระคุณที่อุดหนุน LOVE STK GROUPE',
    showSignatures: true,
    sigLabel1: 'ลายเซ็นลูกค้า',
    sigLabel2: 'ผู้จ่ายสินค้า/ยา',
    sigLabel3: 'พนักงานแคชเชียร์'
  };

  /**
   * ดึงข้อมูลการตั้งค่าบริษัทจาก Cache / LocalStorage / Fallback
   */
  function getCompanySettings() {
    try {
      // 1. ตรวจจาก stk_company_settings ใน localStorage
      const direct = localStorage.getItem('stk_company_settings');
      if (direct) {
        const parsed = JSON.parse(direct);
        return Object.assign({}, DEFAULT_COMPANY_SETTINGS, parsed);
      }

      // 2. ตรวจจาก stk_system_settings
      const sysStr = localStorage.getItem('stk_system_settings');
      if (sysStr) {
        const sys = JSON.parse(sysStr);
        if (sys.company_info) {
          const compInfo = typeof sys.company_info === 'string' ? JSON.parse(sys.company_info) : sys.company_info;
          return Object.assign({}, DEFAULT_COMPANY_SETTINGS, compInfo);
        }
      }
    } catch (e) {
      console.warn('Failed to parse company settings:', e);
    }
    return Object.assign({}, DEFAULT_COMPANY_SETTINGS);
  }

  /**
   * บันทึกข้อมูลบริษัทลงทั้ง LocalStorage และ Supabase (stk_system_settings)
   */
  async function saveCompanySettings(newSettings) {
    const merged = Object.assign({}, DEFAULT_COMPANY_SETTINGS, newSettings);
    const jsonStr = JSON.stringify(merged);

    // 1. บันทึกลง LocalStorage ให้ทุกแท็บ/หน้าใช้งานได้ทันที
    try {
      localStorage.setItem('stk_company_settings', jsonStr);
      // Sync ลง stk_system_settings object ใน LocalStorage ด้วย
      let sysObj = {};
      const sysStr = localStorage.getItem('stk_system_settings');
      if (sysStr) {
        try { sysObj = JSON.parse(sysStr); } catch (e) {}
      }
      sysObj.company_info = jsonStr;
      localStorage.setItem('stk_system_settings', JSON.stringify(sysObj));

      window.dispatchEvent(new Event('storage'));
      window.dispatchEvent(new CustomEvent('company_settings_updated', { detail: merged }));
    } catch (e) {
      console.error('Error saving company settings to localStorage:', e);
    }

    // 2. ซิงค์ขึ้น Supabase
    if (typeof window.saveSystemSettingToSupabase === 'function') {
      try {
        await window.saveSystemSettingToSupabase('company_info', jsonStr);
      } catch (err) {
        console.warn('saveSystemSettingToSupabase error for company_info:', err);
      }
    }

    return merged;
  }

  /**
   * ซิงค์ข้อมูลบริษัทจาก Supabase เมื่อเปิดเว็บ
   */
  async function syncCompanySettingsFromSupabase() {
    if (typeof window.supabaseSelect !== 'function') return;
    try {
      const res = await window.supabaseSelect('stk_system_settings');
      if (Array.isArray(res)) {
        const found = res.find(s => (s.key || s.setting_key) === 'company_info');
        if (found && (found.value || found.setting_value)) {
          const raw = found.value || found.setting_value;
          const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
          const merged = Object.assign({}, DEFAULT_COMPANY_SETTINGS, parsed);
          localStorage.setItem('stk_company_settings', JSON.stringify(merged));
          window.dispatchEvent(new CustomEvent('company_settings_updated', { detail: merged }));
          return merged;
        }
      }
    } catch (err) {
      console.warn('syncCompanySettingsFromSupabase warning:', err);
    }
    return getCompanySettings();
  }

  // Export to global window scope
  window.DEFAULT_COMPANY_SETTINGS = DEFAULT_COMPANY_SETTINGS;
  window.getCompanySettings = getCompanySettings;
  window.saveCompanySettings = saveCompanySettings;
  window.syncCompanySettingsFromSupabase = syncCompanySettingsFromSupabase;

  // Auto run sync on load
  if (typeof window !== 'undefined') {
    window.addEventListener('DOMContentLoaded', () => {
      setTimeout(syncCompanySettingsFromSupabase, 600);
    });
  }
})();
