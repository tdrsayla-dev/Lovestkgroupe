const CONFIG = {
    SUPABASE_URL: "https://qqyotianqcgpdzrfgjif.supabase.co",
    SUPABASE_ANON_KEY: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFxeW90aWFucWNncGR6cmZnamlmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODMwNDQ1MzcsImV4cCI6MjA5ODYyMDUzN30.6VlHbimuMkg0UtxCw2cbU5mN_c9zPmizNuzrL5tCtME"
};

window.SUPABASE_URL = CONFIG.SUPABASE_URL;
window.SUPABASE_ANON_KEY = CONFIG.SUPABASE_ANON_KEY;
window.SUPABASE_REST_URL = `${CONFIG.SUPABASE_URL.replace(/\/$/, '')}/rest/v1`;
