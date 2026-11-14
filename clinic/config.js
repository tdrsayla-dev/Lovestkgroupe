var CONFIG = (typeof window !== 'undefined' && window.CONFIG) ? window.CONFIG : {
    SUPABASE_URL: "https://fpmstumpobbjozflkola.supabase.co",
    SUPABASE_ANON_KEY: "sb_publishable_h9-j-0I2ku6rYYvoeHmooQ_B5GrRzR7",
    MLM_SUPABASE_URL: "https://mfpkeyrykqnrywyksyqp.supabase.co",
    MLM_SUPABASE_ANON_KEY: "sb_publishable_807NIkuj6MAs1KZY-m4tug_Fm1Mk-AO",
    USE_NODE_BRIDGE: true,
    NODE_BRIDGE_PORT: 8085,
    CLOUDFLARE_WORKER_URL: "https://clinic-api-bridge.t-drsayla.workers.dev"
};

if (typeof window !== 'undefined') {
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

    // =========================================================================
    // 🚀 Smart Node.js Database Bridge with 100% Safe Auto-Fallback
    // - ทำงานอัตโนมัติเมื่อเปิดผ่านเซิร์ฟเวอร์ Node.js (พอร์ต 8085/8086) โดยไม่ยิงข้ามพอร์ตให้รก Console
    // - ถ้าเปิดผ่านพอร์ตอื่น (เช่น VS Code Live Server 3000) จะต่อตรงกับ Supabase ทันทีโดยไม่มี Error ใน Console
    // =========================================================================
    if (!window.__NODE_BRIDGE_INITIALIZED__ && CONFIG.USE_NODE_BRIDGE !== false && typeof window.fetch === 'function') {
        window.__NODE_BRIDGE_INITIALIZED__ = true;
        window.__NODE_BRIDGE_ONLINE__ = false;
        window.__NODE_BRIDGE_URL__ = null;

        const nativeFetch = window.fetch.bind(window);
        const currentPort = String(window.location.port || '');
        const targetPort = String(CONFIG.NODE_BRIDGE_PORT || 8085);
        const isNodeServerOrigin = (currentPort === targetPort || currentPort === '8086');

        // ตรวจสอบทั้ง Cloudflare Worker บนเว็บจริง หรือ Node.js บน Local Server
        async function checkBridgeHealth() {
            try {
                if (window.parent && window.parent !== window && window.parent.__NODE_BRIDGE_INITIALIZED__) {
                    window.__NODE_BRIDGE_ONLINE__ = !!window.parent.__NODE_BRIDGE_ONLINE__;
                    window.__NODE_BRIDGE_URL__ = window.parent.__NODE_BRIDGE_URL__ || null;
                    return window.__NODE_BRIDGE_ONLINE__;
                }
            } catch (_) {}

            // 1. ตรวจสอบ Cloudflare Worker ก่อน (สำหรับเว็บจริงที่ Deploy แล้ว)
            if (CONFIG.CLOUDFLARE_WORKER_URL) {
                try {
                    const ctrl = new AbortController();
                    const timer = setTimeout(() => ctrl.abort(), 1200);
                    const res = await nativeFetch(`${CONFIG.CLOUDFLARE_WORKER_URL}/api/health`, {
                        method: 'GET',
                        signal: ctrl.signal
                    });
                    clearTimeout(timer);
                    if (res.ok) {
                        const info = await res.json();
                        if (info && info.status === 'ok') {
                            const wasOffline = !window.__NODE_BRIDGE_ONLINE__;
                            window.__NODE_BRIDGE_ONLINE__ = true;
                            window.__NODE_BRIDGE_URL__ = CONFIG.CLOUDFLARE_WORKER_URL;
                            if (wasOffline) {
                                console.log(`🟢 [Cloudflare Edge Bridge] เชื่อมต่อ Backend สำเร็จ (${CONFIG.CLOUDFLARE_WORKER_URL})`);
                            }
                            return true;
                        }
                    }
                } catch (_) {}
            }

            // 2. ถ้าไม่ได้ใช้ Worker หรือหลุด ให้เช็ค Node.js บนเครื่อง Local
            if (isNodeServerOrigin) {
                try {
                    const baseUrl = window.location.origin;
                    const ctrl = new AbortController();
                    const timer = setTimeout(() => ctrl.abort(), 800);
                    const res = await nativeFetch(`${baseUrl}/api/health`, {
                        method: 'GET',
                        signal: ctrl.signal
                    });
                    clearTimeout(timer);
                    if (res.ok) {
                        const info = await res.json();
                        if (info && info.ok) {
                            window.__NODE_BRIDGE_ONLINE__ = true;
                            window.__NODE_BRIDGE_URL__ = `${baseUrl}/api/db-proxy`;
                            return true;
                        }
                    }
                } catch (_) {}
            }

            window.__NODE_BRIDGE_ONLINE__ = false;
            return false;
        }

        checkBridgeHealth();
        setInterval(checkBridgeHealth, 30000);

        // Transparent Fetch Wrapper
        window.fetch = async function(input, init) {
            try {
                // ซิงค์สถานะจาก parent ถ้าอยู่ใน iframe
                if (window.parent && window.parent !== window && window.parent.__NODE_BRIDGE_ONLINE__) {
                    window.__NODE_BRIDGE_ONLINE__ = true;
                    window.__NODE_BRIDGE_URL__ = window.parent.__NODE_BRIDGE_URL__;
                }

                if (
                    window.__NODE_BRIDGE_ONLINE__ &&
                    window.__NODE_BRIDGE_URL__ &&
                    (typeof input === 'string' || input instanceof URL) &&
                    (!init || !init.body || typeof init.body === 'string')
                ) {
                    const urlStr = String(input);
                    if (urlStr.includes('.supabase.co/rest/v1/')) {
                        const proxyHeaders = new Headers(init && init.headers ? init.headers : {});
                        proxyHeaders.set('x-supabase-target-url', urlStr);

                        const proxyInit = Object.assign({}, init || {}, {
                            headers: proxyHeaders
                        });

                        try {
                            const proxyRes = await nativeFetch(window.__NODE_BRIDGE_URL__, proxyInit);
                            if (proxyRes.status !== 502 && proxyRes.status !== 503 && proxyRes.status !== 504) {
                                return proxyRes;
                            }
                        } catch (_) {
                            window.__NODE_BRIDGE_ONLINE__ = false;
                        }
                    }
                }
            } catch (_) {}
            return nativeFetch(input, init);
        };
    }
}
