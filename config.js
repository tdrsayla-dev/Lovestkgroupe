const CONFIG = {
    SUPABASE_URL: "https://qqyotianqcgpdzrfgjif.supabase.co",
    SUPABASE_ANON_KEY: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFxeW90aWFucWNncGR6cmZnamlmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODMwNDQ1MzcsImV4cCI6MjA5ODYyMDUzN30.6VlHbimuMkg0UtxCw2cbU5mN_c9zPmizNuzrL5tCtME",
    MLM_SUPABASE_URL: "https://mfpkeyrykqnrywyksyqp.supabase.co",
    MLM_SUPABASE_ANON_KEY: "sb_publishable_807NIkuj6MAs1KZY-m4tug_Fm1Mk-AO"
};

window.SUPABASE_URL = CONFIG.SUPABASE_URL;
window.SUPABASE_ANON_KEY = CONFIG.SUPABASE_ANON_KEY;
window.SUPABASE_REST_URL = `${CONFIG.SUPABASE_URL.replace(/\/$/, '')}/rest/v1`;
window.MLM_SUPABASE_URL = CONFIG.MLM_SUPABASE_URL;
window.MLM_SUPABASE_ANON_KEY = CONFIG.MLM_SUPABASE_ANON_KEY;
