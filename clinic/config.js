const CONFIG = {
    SUPABASE_URL: "https://fpmstumpobbjozflkola.supabase.co",
    SUPABASE_ANON_KEY: "sb_publishable_h9-j-0I2ku6rYYvoeHmooQ_B5GrRzR7",
    MLM_SUPABASE_URL: "https://mfpkeyrykqnrywyksyqp.supabase.co",
    MLM_SUPABASE_ANON_KEY: "sb_publishable_807NIkuj6MAs1KZY-m4tug_Fm1Mk-AO"
};

window.CONFIG = CONFIG;
window.SUPABASE_URL = CONFIG.SUPABASE_URL;
window.SUPABASE_ANON_KEY = CONFIG.SUPABASE_ANON_KEY;
window.SUPABASE_REST_URL = `${CONFIG.SUPABASE_URL.replace(/\/$/, '')}/rest/v1`;
window.MLM_SUPABASE_URL = CONFIG.MLM_SUPABASE_URL;
window.MLM_SUPABASE_ANON_KEY = CONFIG.MLM_SUPABASE_ANON_KEY;

// Safe Credential Getter Helper
window.getSupabaseConfig = function() {
    return {
        url: window.SUPABASE_URL || CONFIG.SUPABASE_URL,
        anonKey: window.SUPABASE_ANON_KEY || CONFIG.SUPABASE_ANON_KEY
    };
};

