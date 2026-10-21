/**
 * LOVE STK GROUPE — Data Service & Supabase Bridge
 * ระบบจัดการเชื่อมต่อฐานข้อมูล Supabase 12 ตาราง สำหรับระบบ Company
 */
(function(window) {
    'use strict';

    const originalFetch = (typeof window !== 'undefined' && window.fetch) ? window.fetch.bind(window) : globalThis.fetch.bind(globalThis);

    function getCfg() {
        return window.COMPANY_CONFIG || {
            SUPABASE_URL: "https://vxituqhreggryepvjhzr.supabase.co",
            SUPABASE_ANON_KEY: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ4aXR1cWhyZWdncnllcHZqaHpyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTE1MTUxNzEsImV4cCI6MjEwNzA5MTE3MX0.Su07DGQQ_83aGtsHn4__stotFyztPqJ6679HM9Vac3o",
            STORAGE_BUCKET: "website-media"
        };
    }

    const restUrl = () => `${getCfg().SUPABASE_URL.replace(/\/$/, '')}/rest/v1`;
    const authUrl = () => `${getCfg().SUPABASE_URL.replace(/\/$/, '')}/auth/v1`;
    const storageUrl = () => `${getCfg().SUPABASE_URL.replace(/\/$/, '')}/storage/v1`;

    const SESSION_KEY = 'stk_supabase_session';
    function getStoredSession() {
        try {
            const raw = localStorage.getItem(SESSION_KEY);
            return raw ? JSON.parse(raw) : null;
        } catch { return null; }
    }
    function saveSession(sess) {
        try {
            if (sess) localStorage.setItem(SESSION_KEY, JSON.stringify(sess));
            else localStorage.removeItem(SESSION_KEY);
        } catch {}
    }

    async function refreshToken() {
        const session = getStoredSession();
        if (!session?.refresh_token) return null;
        const cfg = getCfg();
        try {
            const res = await originalFetch(`${authUrl()}/token?grant_type=refresh_token`, {
                method: 'POST',
                headers: {
                    'apikey': cfg.SUPABASE_ANON_KEY,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ refresh_token: session.refresh_token })
            });
            if (!res.ok) {
                saveSession(null);
                return null;
            }
            const data = await res.json();
            saveSession(data);
            return data;
        } catch (e) {
            console.warn('[CompanyDataService] Token refresh error:', e);
            return null;
        }
    }

    async function getValidToken() {
        const cfg = getCfg();
        let session = getStoredSession();
        if (!session) return cfg.SUPABASE_ANON_KEY;

        const now = Math.floor(Date.now() / 1000);
        // Check if token expires in less than 60 seconds (or is already expired)
        if (session.expires_at && (session.expires_at <= now + 60)) {
            const refreshed = await refreshToken();
            if (refreshed?.access_token) return refreshed.access_token;
            return cfg.SUPABASE_ANON_KEY;
        }
        return session.access_token || cfg.SUPABASE_ANON_KEY;
    }

    async function apiRequest(path, options = {}) {
        const cfg = getCfg();
        let token = await getValidToken();

        const getHeaders = (tok) => ({
            'apikey': cfg.SUPABASE_ANON_KEY,
            'Authorization': `Bearer ${tok}`,
            'Content-Type': 'application/json',
            ...(options.headers || {})
        });

        let res = await originalFetch(`${restUrl()}/${path}`, {
            method: options.method || 'GET',
            headers: getHeaders(token),
            body: options.body ? (typeof options.body === 'string' ? options.body : JSON.stringify(options.body)) : undefined,
            cache: 'no-store'
        });

        // If 401 Unauthorized, attempt refresh once
        if (res.status === 401) {
            const refreshed = await refreshToken();
            if (refreshed?.access_token) {
                token = refreshed.access_token;
                res = await originalFetch(`${restUrl()}/${path}`, {
                    method: options.method || 'GET',
                    headers: getHeaders(token),
                    body: options.body ? (typeof options.body === 'string' ? options.body : JSON.stringify(options.body)) : undefined,
                    cache: 'no-store'
                });
            }
        }

        if (!res.ok) {
            const err = await res.json().catch(() => ({ message: res.statusText }));
            const e = new Error(err.message || err.error || `HTTP ${res.status}`);
            e.status = res.status;
            e.details = err;
            if (res.status === 401) {
                e.signIn = true;
            }
            throw e;
        }

        const ct = res.headers.get('content-type') || '';
        return ct.includes('application/json') ? await res.json() : await res.text();
    }

    const CompanyDataService = {
        config: getCfg,
        getSession: getStoredSession,

        // --- Supabase Auth ---
        async signIn(email, password) {
            const cfg = getCfg();
            const res = await originalFetch(`${authUrl()}/token?grant_type=password`, {
                method: 'POST',
                headers: {
                    'apikey': cfg.SUPABASE_ANON_KEY,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ email, password })
            });

            const data = await res.json();
            if (!res.ok) throw new Error(data.error_description || data.msg || 'อีเมลหรือรหัสผ่านไม่ถูกต้อง');
            saveSession(data);
            return data;
        },

        async signOut() {
            saveSession(null);
        },

        async getCurrentUser() {
            const session = getStoredSession();
            if (!session?.access_token) return null;
            try {
                const res = await originalFetch(`${authUrl()}/user`, {
                    headers: {
                        'apikey': getCfg().SUPABASE_ANON_KEY,
                        'Authorization': `Bearer ${session.access_token}`
                    }
                });
                if (!res.ok) {
                    saveSession(null);
                    return null;
                }
                return await res.json();
            } catch {
                return null;
            }
        },

        // --- Supabase Database Synchronization & Bridge ---
        async syncSettingsToSupabase(settings) {
            if (!settings) return;
            try {
                await apiRequest('website_settings?settings_key=eq.main', {
                    method: 'PATCH',
                    body: {
                        phone: settings.phone || '',
                        email: settings.email || '',
                        address: settings.address || {},
                        social_links: {
                            website: settings.website || '',
                            stkSmartUrl: settings.stkSmartUrl || '',
                            line: settings.line || '',
                            whatsapp: settings.whatsapp || '',
                            facebook: settings.facebook || '',
                            youtube: settings.youtube || '',
                            tiktok: settings.tiktok || '',
                            logo: settings.logo || ''
                        },
                        theme: {
                            brandColor: settings.brandColor || '#175bd2',
                            logoUrl: settings.logo || '',
                            heroBanner: settings.heroBanner || '',
                            heroStartColor: settings.heroStartColor || '#0b1f48',
                            heroEndColor: settings.heroEndColor || '#060d1f',
                            highlightColor: settings.highlightColor || '#E0B840',
                            approachColor: settings.approachColor || '#0e1a38',
                            backgroundMotion: !!settings.backgroundMotion,
                            features: settings.features || {}
                        },
                        slide_seconds: Number(settings.slideSeconds) || 3.5
                    }
                });
            } catch (err) {
                console.warn('[CompanyDataService] Sync settings warning:', err.message);
            }
        },

        async fetchPublicContentFromSupabase() {
            const cfg = getCfg();
            const headers = { 'apikey': cfg.SUPABASE_ANON_KEY };

            let settings = null;
            let fullSnapshot = null;
            let products = null;
            let news = null;
            let businesses = null;

            try {
                const res = await originalFetch(`${restUrl()}/website_settings?settings_key=eq.main&select=*`, { headers });
                if (res.ok) {
                    const list = await res.json();
                    if (Array.isArray(list) && list.length > 0) settings = list[0];
                }
            } catch (e) {
                console.warn('[CompanyDataService] Fetch settings warning:', e.message);
            }

            try {
                const res = await originalFetch(`${restUrl()}/page_sections?page_key=eq.cms&section_key=eq.full_content&status=eq.published&is_visible=eq.true&select=*`, { headers });
                if (res.ok) {
                    const list = await res.json();
                    if (Array.isArray(list) && list.length > 0 && list[0].metadata) {
                        fullSnapshot = list[0].metadata;
                    }
                }
            } catch (e) {
                console.warn('[CompanyDataService] Fetch snapshot warning:', e.message);
            }

            try {
                const res = await originalFetch(`${restUrl()}/products?status=eq.published&is_visible=eq.true&order=sort_order.asc&select=*`, { headers });
                if (res.ok) {
                    const list = await res.json();
                    if (Array.isArray(list) && list.length > 0) {
                        products = list.map(item => {
                            const attrs = item.attributes || {};
                            return {
                                id: item.slug,
                                category: item.category || 'health',
                                price: item.price !== null ? Number(item.price) : null,
                                currency: item.currency || 'LAK',
                                visible: item.is_visible,
                                isMock: item.is_mock,
                                image: attrs.image || '',
                                gallery: attrs.gallery || [],
                                content: attrs.content || {
                                    th: { name: item.slug, summary: '', description: '' },
                                    lo: { name: item.slug, summary: '', description: '' },
                                    en: { name: item.slug, summary: '', description: '' }
                                }
                            };
                        });
                    }
                }
            } catch (e) {}

            try {
                const res = await originalFetch(`${restUrl()}/news?status=eq.published&is_visible=eq.true&order=news_date.desc&select=*`, { headers });
                if (res.ok) {
                    const list = await res.json();
                    if (Array.isArray(list) && list.length > 0) {
                        news = list.map(item => {
                            const attrs = item.metadata || item.attributes || {};
                            return {
                                id: item.slug,
                                category: item.category || 'company',
                                date: item.news_date,
                                visible: item.is_visible,
                                isMock: item.is_mock,
                                image: attrs.image || '',
                                content: attrs.content || {
                                    th: { title: item.slug, summary: '', body: [] },
                                    lo: { title: item.slug, summary: '', body: [] },
                                    en: { title: item.slug, summary: '', body: [] }
                                }
                            };
                        });
                    }
                }
            } catch (e) {}

            try {
                const res = await originalFetch(`${restUrl()}/businesses?status=eq.published&is_visible=eq.true&order=sort_order.asc&select=*`, { headers });
                if (res.ok) {
                    const list = await res.json();
                    if (Array.isArray(list) && list.length > 0) {
                        businesses = {};
                        list.forEach(b => {
                            const m = b.metadata || {};
                            businesses[b.slug] = {
                                url: b.website_url || '',
                                image: m.image || '',
                                logo: m.logo || ''
                            };
                        });
                    }
                }
            } catch (e) {}

            return { settings, fullSnapshot, products, news, businesses };
        },

        async fetchAdminContentFromSupabase() {
            const token = await getValidToken();
            const cfg = getCfg();
            const headers = {
                'apikey': cfg.SUPABASE_ANON_KEY,
                'Authorization': `Bearer ${token}`
            };

            let settings = null;
            let fullSnapshot = null;
            let products = null;
            let news = null;
            let businesses = null;

            try {
                const res = await originalFetch(`${restUrl()}/website_settings?settings_key=eq.main&select=*`, { headers });
                if (res.ok) {
                    const list = await res.json();
                    if (Array.isArray(list) && list.length > 0) settings = list[0];
                }
            } catch (e) {}

            try {
                const res = await originalFetch(`${restUrl()}/page_sections?page_key=eq.cms&section_key=eq.full_content&select=*&order=updated_at.desc&limit=1`, { headers });
                if (res.ok) {
                    const list = await res.json();
                    if (Array.isArray(list) && list.length > 0 && list[0].metadata) {
                        fullSnapshot = list[0].metadata;
                    }
                }
            } catch (e) {}

            try {
                const res = await originalFetch(`${restUrl()}/products?order=sort_order.asc&select=*`, { headers });
                if (res.ok) {
                    const list = await res.json();
                    if (Array.isArray(list) && list.length > 0) {
                        products = list.map(item => {
                            const attrs = item.attributes || {};
                            return {
                                id: item.slug,
                                category: item.category || 'health',
                                price: item.price !== null ? Number(item.price) : null,
                                currency: item.currency || 'LAK',
                                visible: item.is_visible,
                                isMock: item.is_mock,
                                image: attrs.image || '',
                                gallery: attrs.gallery || [],
                                content: attrs.content || {
                                    th: { name: item.slug, summary: '', description: '' },
                                    lo: { name: item.slug, summary: '', description: '' },
                                    en: { name: item.slug, summary: '', description: '' }
                                }
                            };
                        });
                    }
                }
            } catch (e) {}

            try {
                const res = await originalFetch(`${restUrl()}/news?order=news_date.desc&select=*`, { headers });
                if (res.ok) {
                    const list = await res.json();
                    if (Array.isArray(list) && list.length > 0) {
                        news = list.map(item => {
                            const attrs = item.metadata || item.attributes || {};
                            return {
                                id: item.slug,
                                category: item.category || 'company',
                                date: item.news_date,
                                visible: item.is_visible,
                                isMock: item.is_mock,
                                image: attrs.image || '',
                                content: attrs.content || {
                                    th: { title: item.slug, summary: '', body: [] },
                                    lo: { title: item.slug, summary: '', body: [] },
                                    en: { title: item.slug, summary: '', body: [] }
                                }
                            };
                        });
                    }
                }
            } catch (e) {}

            return { settings, fullSnapshot, products, news, businesses };
        },

        composeContent(base, supaData) {
            const content = JSON.parse(JSON.stringify(base || {}));

            if (supaData?.fullSnapshot && typeof supaData.fullSnapshot === 'object') {
                Object.assign(content, supaData.fullSnapshot);
            }

            if (supaData?.settings) {
                const ws = supaData.settings;
                content.settings = content.settings || {};
                if (ws.phone) content.settings.phone = ws.phone;
                if (ws.email) content.settings.email = ws.email;
                if (ws.address && typeof ws.address === 'object' && Object.keys(ws.address).length > 0) {
                    content.settings.address = Object.assign(content.settings.address || {}, ws.address);
                }
                if (ws.social_links && typeof ws.social_links === 'object') {
                    Object.assign(content.settings, ws.social_links);
                }
                if (ws.theme && typeof ws.theme === 'object') {
                    Object.assign(content.settings, ws.theme);
                    if (ws.theme.features) {
                        content.settings.features = Object.assign(content.settings.features || {}, ws.theme.features);
                    }
                }
                if (ws.slide_seconds) content.settings.slideSeconds = ws.slide_seconds;
            }

            if (Array.isArray(supaData?.products) && supaData.products.length > 0) {
                content.products = supaData.products;
            }

            if (Array.isArray(supaData?.news) && supaData.news.length > 0) {
                content.news = supaData.news;
            }

            if (supaData?.businesses && typeof supaData.businesses === 'object' && Object.keys(supaData.businesses).length > 0) {
                content.businessMedia = Object.assign(content.businessMedia || {}, supaData.businesses);
            }

            return content;
        },

        async saveContentToSupabase(content, status = 'draft') {
            if (!content) return;
            const isPub = (status === 'published');

            // 1. Update website_settings
            if (content.settings) {
                await CompanyDataService.syncSettingsToSupabase(content.settings);
            }

            // 2. Upsert full content snapshot to page_sections
            try {
                const existing = await apiRequest('page_sections?page_key=eq.cms&section_key=eq.full_content&select=id');
                const payload = {
                    page_key: 'cms',
                    section_key: 'full_content',
                    component_type: 'json_cms',
                    status: isPub ? 'published' : 'draft',
                    is_visible: true,
                    metadata: content,
                    updated_at: new Date().toISOString()
                };

                if (Array.isArray(existing) && existing.length > 0) {
                    await apiRequest(`page_sections?id=eq.${existing[0].id}`, {
                        method: 'PATCH',
                        body: payload
                    });
                } else {
                    await apiRequest('page_sections', {
                        method: 'POST',
                        body: payload
                    });
                }
            } catch (err) {
                console.warn('[CompanyDataService] Sync page_sections warning:', err.message);
            }

            // 3. Upsert products into relational products table
            if (Array.isArray(content.products) && content.products.length > 0) {
                try {
                    for (let i = 0; i < content.products.length; i++) {
                        const p = content.products[i];
                        const slug = (p.id || `product-${i+1}`).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || `product-${i+1}`;
                        const existing = await apiRequest(`products?slug=eq.${slug}&select=id`);
                        const pData = {
                            slug,
                            category: p.category || 'health',
                            price: p.price !== null && !isNaN(p.price) ? Number(p.price) : null,
                            currency: p.currency || 'LAK',
                            sort_order: i + 1,
                            is_mock: !!p.isMock,
                            is_visible: p.visible !== false,
                            status: isPub ? 'published' : 'draft',
                            attributes: {
                                image: p.image || '',
                                gallery: p.gallery || [],
                                content: p.content || {}
                            },
                            updated_at: new Date().toISOString()
                        };

                        if (Array.isArray(existing) && existing.length > 0) {
                            await apiRequest(`products?id=eq.${existing[0].id}`, {
                                method: 'PATCH',
                                body: pData
                            });
                        } else {
                            await apiRequest('products', {
                                method: 'POST',
                                body: pData
                            });
                        }
                    }
                } catch (err) {
                    console.warn('[CompanyDataService] Sync products warning:', err.message);
                }
            }

            // 4. Upsert news into relational news table
            if (Array.isArray(content.news) && content.news.length > 0) {
                try {
                    for (let i = 0; i < content.news.length; i++) {
                        const n = content.news[i];
                        const slug = (n.id || `news-${i+1}`).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || `news-${i+1}`;
                        const existing = await apiRequest(`news?slug=eq.${slug}&select=id`);
                        const nData = {
                            slug,
                            category: n.category || 'company',
                            news_date: n.date || new Date().toISOString().split('T')[0],
                            is_visible: n.visible !== false,
                            is_mock: !!n.isMock,
                            status: isPub ? 'published' : 'draft',
                            metadata: {
                                image: n.image || '',
                                content: n.content || {}
                            },
                            updated_at: new Date().toISOString()
                        };

                        if (Array.isArray(existing) && existing.length > 0) {
                            await apiRequest(`news?id=eq.${existing[0].id}`, {
                                method: 'PATCH',
                                body: nData
                            });
                        } else {
                            await apiRequest('news', {
                                method: 'POST',
                                body: nData
                            });
                        }
                    }
                } catch (err) {
                    console.warn('[CompanyDataService] Sync news warning:', err.message);
                }
            }

            // 5. Upsert businesses into relational businesses table
            if (content.businessMedia && typeof content.businessMedia === 'object') {
                try {
                    let order = 1;
                    for (const [key, bm] of Object.entries(content.businessMedia)) {
                        const slug = key.toLowerCase().replace(/[^a-z0-9]+/g, '-');
                        const existing = await apiRequest(`businesses?slug=eq.${slug}&select=id`);
                        const bData = {
                            slug,
                            website_url: bm.url || null,
                            sort_order: order++,
                            is_visible: true,
                            status: isPub ? 'published' : 'draft',
                            metadata: {
                                image: bm.image || '',
                                logo: bm.logo || ''
                            },
                            updated_at: new Date().toISOString()
                        };

                        if (Array.isArray(existing) && existing.length > 0) {
                            await apiRequest(`businesses?id=eq.${existing[0].id}`, {
                                method: 'PATCH',
                                body: bData
                            });
                        } else {
                            await apiRequest('businesses', {
                                method: 'POST',
                                body: bData
                            });
                        }
                    }
                } catch (err) {
                    console.warn('[CompanyDataService] Sync businesses warning:', err.message);
                }
            }
        },

        refreshToken,
        getValidToken,

        // --- Upload to Supabase Storage ---
        async uploadMedia(file) {
            const cfg = getCfg();
            let token = await getValidToken();
            const ext = (file.name || 'image.webp').split('.').pop() || 'webp';
            const fileName = `${Date.now()}-${Math.random().toString(36).substring(2, 8)}.${ext}`;

            const doUpload = (tok) => originalFetch(`${storageUrl()}/object/${cfg.STORAGE_BUCKET}/${fileName}`, {
                method: 'POST',
                headers: {
                    'apikey': cfg.SUPABASE_ANON_KEY,
                    'Authorization': `Bearer ${tok}`,
                    'Content-Type': file.type || 'image/webp'
                },
                body: file
            });

            let res = await doUpload(token);

            // If 400 (Invalid JWT) or 401 (Unauthorized), try refreshing token once
            if (!res.ok && (res.status === 401 || res.status === 400)) {
                const peek = await res.clone().json().catch(() => ({}));
                const msg = (peek.message || peek.error || '').toLowerCase();
                if (msg.includes('jwt') || msg.includes('expired') || res.status === 401) {
                    const refreshed = await refreshToken();
                    if (refreshed?.access_token) {
                        token = refreshed.access_token;
                        res = await doUpload(token);
                    }
                }
            }

            if (!res.ok) {
                const err = await res.json().catch(() => ({ message: res.statusText }));
                const errMsg = err.message || err.error || err.msg || `HTTP ${res.status}`;
                console.error('[Supabase Storage Error]', res.status, err);
                const e = new Error();
                if (errMsg.toLowerCase().includes('jwt') || errMsg.toLowerCase().includes('expired') || res.status === 401) {
                    saveSession(null);
                    e.message = 'เซสชันผู้ดูแลหมดอายุ กรุณาเข้าสู่ระบบใหม่อีกครั้ง';
                    e.signIn = true;
                    e.status = 401;
                } else if (errMsg.toLowerCase().includes('bucket not found')) {
                    e.message = `ไม่พบบักเก็ต '${cfg.STORAGE_BUCKET}' ใน Supabase Storage (กรุณาสร้าง Bucket ในแดชบอร์ด)`;
                } else if (errMsg.toLowerCase().includes('row-level security') || res.status === 403) {
                    e.message = 'ไม่มีสิทธิ์อัปโหลดไฟล์ (กรุณาตั้งค่า Storage Policy บน Supabase)';
                } else if (errMsg.toLowerCase().includes('size') || errMsg.toLowerCase().includes('payload too large') || errMsg.toLowerCase().includes('limit')) {
                    e.message = `ขนาดไฟล์เกินกำหนดของ Supabase Storage (${errMsg}) กรุณาเพิ่ม File Size Limit ในหน้า Edit Bucket`;
                } else if (errMsg.toLowerCase().includes('mime') || errMsg.toLowerCase().includes('type')) {
                    e.message = `Supabase Storage ปิดกั้นไฟล์วิดีโอ (${errMsg}) กรุณาปลดล็อก Allowed MIME Types ในหน้า Edit Bucket`;
                } else {
                    e.message = `อัปโหลดไม่สำเร็จจาก Supabase Storage (${res.status}): ${errMsg}`;
                }
                throw e;
            }

            const publicUrl = `${storageUrl()}/object/public/${cfg.STORAGE_BUCKET}/${fileName}`;
            return {
                fileName,
                publicUrl,
                url: publicUrl
            };
        }
    };

    // =========================================================================
    // Fetch Interceptor for seamless Supabase Database live endpoints
    // =========================================================================
    window.fetch = async function(input, init = {}) {
        const url = typeof input === 'string' ? input : (input?.url || '');

        // 1. Intercept /api/content for Public Website Pages (Direct Live Supabase Database)
        if (url.startsWith('/api/content') || url.includes('/api/content')) {
            const isPreview = url.includes('preview=draft');
            const storageKey = isPreview ? 'stk_cms_draft' : 'stk_cms_published';

            // Load base static content
            let baseContent = null;
            try {
                const defResp = await originalFetch('default-content.json');
                if (defResp.ok) baseContent = await defResp.json();
            } catch (e) {}

            // Fetch live data directly from Supabase Database
            try {
                const supaData = await CompanyDataService.fetchPublicContentFromSupabase();
                const mergedContent = CompanyDataService.composeContent(baseContent, supaData);

                // Cache in localStorage for high performance & offline capability
                try {
                    localStorage.setItem(storageKey, JSON.stringify({ content: mergedContent, syncedAt: new Date().toISOString() }));
                } catch (e) {}

                if (mergedContent.settings) {
                    setTimeout(() => {
                        hydrateContactMenu(mergedContent.settings);
                        if (mergedContent.settings.features) {
                            enforceFeatureFlags(mergedContent.settings.features);
                        }
                    }, 0);
                }

                return new Response(JSON.stringify({ content: mergedContent }), {
                    status: 200,
                    headers: { 'Content-Type': 'application/json' }
                });
            } catch (err) {
                console.warn('[CompanyDataService] Error fetching from Supabase, falling back to local cache:', err);
            }

            // Fallback 1: LocalStorage cache
            try {
                const cached = localStorage.getItem(storageKey);
                if (cached) {
                    const parsed = JSON.parse(cached);
                    const finalContent = parsed.content || parsed;
                    if (finalContent.settings) {
                        setTimeout(() => {
                            hydrateContactMenu(finalContent.settings);
                            if (finalContent.settings.features) {
                                enforceFeatureFlags(finalContent.settings.features);
                            }
                        }, 0);
                    }
                    return new Response(JSON.stringify({ content: finalContent }), {
                        status: 200,
                        headers: { 'Content-Type': 'application/json' }
                    });
                }
            } catch (e) {}

            // Fallback 2: default-content.json
            if (baseContent) {
                if (baseContent.settings) {
                    setTimeout(() => {
                        hydrateContactMenu(baseContent.settings);
                        if (baseContent.settings.features) {
                            enforceFeatureFlags(baseContent.settings.features);
                        }
                    }, 0);
                }
                return new Response(JSON.stringify({ content: baseContent }), {
                    status: 200,
                    headers: { 'Content-Type': 'application/json' }
                });
            }

            return new Response(JSON.stringify({ error: 'No content available' }), {
                status: 404,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        // 2. Intercept /api/admin/content (GET/PUT)
        if (url.startsWith('/api/admin/content') || url.includes('/api/admin/content')) {
            // PUT: Save Draft directly into Supabase Database
            if (init.method === 'PUT') {
                try {
                    const body = JSON.parse(init.body || '{}');
                    const content = body.content;
                    const revision = (body.revision || 0) + 1;
                    const now = new Date().toISOString();

                    // Save draft locally
                    localStorage.setItem('stk_cms_draft', JSON.stringify({ content, revision, updatedAt: now }));

                    // Save draft to Supabase Database (settings, snapshot, relational records)
                    await CompanyDataService.saveContentToSupabase(content, 'draft');

                    return new Response(JSON.stringify({ ok: true, revision, updatedAt: now }), {
                        status: 200,
                        headers: { 'Content-Type': 'application/json' }
                    });
                } catch (err) {
                    return new Response(JSON.stringify({ error: err.message }), {
                        status: 400,
                        headers: { 'Content-Type': 'application/json' }
                    });
                }
            }

            // GET: Load CMS Content from Supabase Database
            try {
                let baseContent = null;
                try {
                    const defResp = await originalFetch('default-content.json');
                    if (defResp.ok) baseContent = await defResp.json();
                } catch (e) {}

                const supaData = await CompanyDataService.fetchAdminContentFromSupabase();
                const mergedContent = CompanyDataService.composeContent(baseContent, supaData);

                // Check local draft timestamp vs Supabase
                const localDraftRaw = localStorage.getItem('stk_cms_draft');
                let revision = 1;
                let updatedAt = new Date().toISOString();

                if (localDraftRaw) {
                    try {
                        const parsed = JSON.parse(localDraftRaw);
                        revision = parsed.revision || 1;
                        if (parsed.updatedAt) updatedAt = parsed.updatedAt;
                    } catch (e) {}
                }

                return new Response(JSON.stringify({
                    content: mergedContent,
                    revision,
                    updatedAt
                }), {
                    status: 200,
                    headers: { 'Content-Type': 'application/json' }
                });
            } catch (err) {
                console.error('[DataService] Error loading admin content from Supabase:', err);
            }

            // Fallback: localStorage
            try {
                const raw = localStorage.getItem('stk_cms_draft') || localStorage.getItem('stk_cms_published');
                if (raw) {
                    const parsed = JSON.parse(raw);
                    const content = parsed.content || parsed;
                    return new Response(JSON.stringify({
                        content: content,
                        revision: parsed.revision || 1,
                        updatedAt: parsed.updatedAt || new Date().toISOString()
                    }), {
                        status: 200,
                        headers: { 'Content-Type': 'application/json' }
                    });
                }
            } catch (err) {}

            return new Response(JSON.stringify({ error: 'ไม่สามารถโหลดข้อมูลเนื้อหาได้' }), {
                status: 500,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        // 3. Intercept /api/admin/publish (POST)
        if (url.startsWith('/api/admin/publish') || url.includes('/api/admin/publish')) {
            try {
                const now = new Date().toISOString();
                const raw = localStorage.getItem('stk_cms_draft');
                if (raw) {
                    localStorage.setItem('stk_cms_published', raw);
                    const parsed = JSON.parse(raw);
                    const content = parsed.content || parsed;
                    // Publish to Supabase Database (sets status='published')
                    await CompanyDataService.saveContentToSupabase(content, 'published');
                }
                return new Response(JSON.stringify({ ok: true, publishedAt: now }), {
                    status: 200,
                    headers: { 'Content-Type': 'application/json' }
                });
            } catch (err) {
                return new Response(JSON.stringify({ error: err.message }), {
                    status: 500,
                    headers: { 'Content-Type': 'application/json' }
                });
            }
        }

        // 4. Intercept /api/admin/upload
        if (url.startsWith('/api/admin/upload') || url.includes('/api/admin/upload')) {
            try {
                const formData = init.body;
                const file = formData.get('file');
                const result = await CompanyDataService.uploadMedia(file);
                return new Response(JSON.stringify({ url: result.publicUrl }), {
                    status: 200,
                    headers: { 'Content-Type': 'application/json' }
                });
            } catch (err) {
                return new Response(JSON.stringify({ error: err.message, signIn: !!err.signIn }), {
                    status: 400,
                    headers: { 'Content-Type': 'application/json' }
                });
            }
        }

        return originalFetch.apply(this, arguments);
    };

    // =========================================================================
    // Feature Flags Enforcer (เปิด-ปิดการให้บริการฟังก์ชัน)
    // =========================================================================
    function getActiveFeatures() {
        try {
            const isPreview = window.location.search.includes('preview=draft');
            const raw = localStorage.getItem(isPreview ? 'stk_cms_draft' : 'stk_cms_published') || localStorage.getItem('stk_cms_published') || localStorage.getItem('stk_cms_draft');
            if (raw) {
                const parsed = JSON.parse(raw);
                const feats = parsed.content?.settings?.features || parsed.settings?.features;
                if (feats && typeof feats === 'object') return feats;
            }
        } catch (e) {}

        if (window.COMPANY_CONFIG && window.COMPANY_CONFIG.FEATURES) {
            return window.COMPANY_CONFIG.FEATURES;
        }

        return {
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
        };
    }

    function showComingSoonScreen(featureKey) {
        if (document.getElementById('stk-coming-soon-overlay')) return;
        const featureNames = {
            products: { th: 'ผลิตภัณฑ์ (Products)', lo: 'ຜະລິດຕະພັນ (Products)', en: 'Products' },
            news: { th: 'ข่าวสารและกิจกรรม (News)', lo: 'ຂ່າວສານ ແລະ ກິດຈະກຳ (News)', en: 'News & Updates' },
            leadership: { th: 'ผู้บริหาร / CEO (Leadership)', lo: 'ຜູ້ບໍລິຫານ / CEO (Leadership)', en: 'Leadership' },
            businesses: { th: 'ธุรกิจในเครือ (Businesses)', lo: 'ທຸລະກິດໃນເຄືອ (Businesses)', en: 'Our Businesses' }
        };

        const lang = document.documentElement.lang || 'th';
        const name = (featureNames[featureKey] && featureNames[featureKey][lang]) || featureNames[featureKey]?.th || 'ฟังก์ชันนี้';

        const titles = {
            th: 'ฟังก์ชันนี้กำลังอยู่ในช่วงการพัฒนา',
            lo: 'ຟັງຊັນນີ້ກຳລັງຢູ່ໃນຊ່ວງການພັດທະນາ',
            en: 'This feature is currently under development'
        };

        const descs = {
            th: `ระบบ ${name} กำลังเตรียมความพร้อมเพื่อเปิดให้บริการแก่ทุกท่านในเร็วๆ นี้ ขออภัยในความไม่สะดวก`,
            lo: `ລະບົບ ${name} ກຳລັງກຽມຄວາມພ້ອມເພື່ອເປີດໃຫ້ບໍລິການໃນໄວໆນີ້ ຂໍອະໄພໃນຄວາມບໍ່ສະດວກ`,
            en: `The ${name} section is currently being prepared and will be launched soon. Thank you for your patience.`
        };

        const backTexts = {
            th: 'กลับสู่หน้าแรก',
            lo: 'ກັບສູ່ໜ້າທຳອິດ',
            en: 'Back to Home'
        };

        const overlay = document.createElement('div');
        overlay.id = 'stk-coming-soon-overlay';
        overlay.style.cssText = 'position:fixed;inset:0;z-index:999999;background:radial-gradient(circle at 50% 35%, #0d2857 0%, #060d1d 100%);display:flex;flex-direction:column;align-items:center;justify-content:center;padding:24px;text-align:center;font-family:"Noto Sans Thai","Noto Sans Lao","Manrope",sans-serif;color:#f1f5f9;';
        overlay.innerHTML = `
            <div style="max-width:500px;width:100%;background:rgba(15,23,42,0.85);border:1px solid rgba(224,184,64,0.3);border-radius:20px;padding:42px 28px;box-shadow:0 25px 60px rgba(0,0,0,0.7);backdrop-filter:blur(16px);">
                <div style="width:68px;height:68px;margin:0 auto 20px;background:rgba(224,184,64,0.12);border-radius:50%;display:flex;align-items:center;justify-content:center;border:1px solid rgba(224,184,64,0.35);">
                    <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="#E0B840" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <circle cx="12" cy="12" r="10"></circle>
                        <polyline points="12 6 12 12 16 14"></polyline>
                    </svg>
                </div>
                <div style="display:inline-block;padding:4px 14px;background:rgba(224,184,64,0.15);color:#E0B840;border-radius:999px;font-size:12px;font-weight:600;letter-spacing:0.05em;margin-bottom:16px;">
                    COMING SOON · เร็วๆ นี้
                </div>
                <h1 style="font-size:22px;font-weight:700;color:#ffffff;margin:0 0 14px;line-height:1.4;">
                    ${titles[lang] || titles.th}
                </h1>
                <p style="font-size:14px;color:#94a3b8;line-height:1.6;margin:0 0 28px;">
                    ${descs[lang] || descs.th}
                </p>
                <a href="index.html" style="display:inline-flex;align-items:center;justify-content:center;gap:8px;background:linear-gradient(135deg,#175bd2,#0e3b8c);color:#ffffff;text-decoration:none;padding:12px 28px;border-radius:10px;font-weight:600;font-size:15px;box-shadow:0 4px 14px rgba(23,91,210,0.4);">
                    ← ${backTexts[lang] || backTexts.th}
                </a>
            </div>
        `;
        document.body.appendChild(overlay);
        document.body.style.overflow = 'hidden';
    }

        const features = customFeatures || getActiveFeatures();
        if (!features) return;

        // Check if current page is disabled
        const pageAttr = document.documentElement.dataset.page || '';
        let currentFeature = null;

        if (pageAttr === 'products' || pageAttr === 'product-detail' || path.includes('product')) {
            currentFeature = 'products';
        } else if (pageAttr === 'news' || pageAttr === 'news-article' || path.includes('news')) {
            currentFeature = 'news';
        } else if (pageAttr === 'leadership' || path.includes('leadership')) {
            currentFeature = 'leadership';
        } else if (pageAttr === 'businesses' || path.includes('business')) {
            currentFeature = 'businesses';
        }

        if (currentFeature && features[currentFeature] === false) {
            showComingSoonScreen(currentFeature);
        } else {
            const overlay = document.getElementById('stk-coming-soon-overlay');
            if (overlay) {
                overlay.remove();
                document.body.style.overflow = '';
            }
        }

        // Apply navigation filters (handles both show and hide dynamically)
        const toggleEl = (selector, isEnabled) => {
            document.querySelectorAll(selector).forEach(el => {
                if (isEnabled === false) {
                    el.style.display = 'none';
                    el.setAttribute('data-feature-hidden', 'true');
                } else if (el.getAttribute('data-feature-hidden') === 'true') {
                    el.style.display = '';
                    el.removeAttribute('data-feature-hidden');
                }
            });
        };

        toggleEl('a[href*="businesses.html"]', features.businesses);
        toggleEl('a[href*="leadership.html"]', features.leadership);
        toggleEl('.nav-products, a[href*="products.html"]', features.products);
        toggleEl('a[href*="news.html"]', features.news);
        toggleEl('a[href*="ceo-login"], a[href*="CEO"]', features.ceo_dashboard);
        toggleEl('a[href*="clinic/login"], a[href*="clinic"]', features.clinic_booking);
        toggleEl('a[href*="Hr.html"], a[href*="hr."]', features.human_resource);
        toggleEl('a[href*="mlm/Mlm"], a[href*="Mlm.html"]', features.crm_system);
        toggleEl('[data-system="stk_smart"], a[href*="smart"], .nav-smart', features.stk_smart);
        toggleEl('.languages', features.language_switcher);
        toggleEl('.theme-control', features.theme_switcher);

        hydrateContactMenu();
    }

    function injectContactMenuStyles() {
        if (document.getElementById('stk-contact-menu-styles')) return;
        const style = document.createElement('style');
        style.id = 'stk-contact-menu-styles';
        style.textContent = `
/* Contact Submenu Mega Dropdown Styles */
#navigation .contact-submenu {
    min-width: 290px !important;
    padding: 16px 18px !important;
    background: rgba(10, 24, 52, 0.97) !important;
    border: 1px solid rgba(224, 184, 64, 0.35) !important;
    border-radius: 14px !important;
    box-shadow: 0 20px 50px rgba(0, 0, 0, 0.65) !important;
    backdrop-filter: blur(14px) !important;
    left: auto !important;
    right: 0 !important;
}
.contact-menu-layout {
    display: grid !important;
    grid-template-columns: 1.18fr 1fr !important;
    gap: 18px !important;
    align-items: start !important;
}
.contact-menu-col {
    display: flex !important;
    flex-direction: column !important;
    min-width: 0 !important;
}
.contact-menu-heading {
    display: flex !important;
    align-items: center !important;
    gap: 6px !important;
    margin-bottom: 10px !important;
    padding-bottom: 6px !important;
    border-bottom: 1px solid rgba(224, 184, 64, 0.25) !important;
}
.contact-heading-badge {
    font-size: 11px !important;
    font-weight: 700 !important;
    letter-spacing: 0.08em !important;
    color: #E0B840 !important;
    text-transform: uppercase !important;
}
.contact-quick-link {
    display: flex !important;
    align-items: center !important;
    gap: 10px !important;
    padding: 8px 10px !important;
    margin-bottom: 7px !important;
    background: rgba(255, 255, 255, 0.05) !important;
    border: 1px solid rgba(255, 255, 255, 0.08) !important;
    border-radius: 8px !important;
    color: #ffffff !important;
    text-decoration: none !important;
    transition: all 0.2s ease !important;
    min-height: unset !important;
}
.contact-quick-link:hover {
    background: rgba(23, 91, 210, 0.3) !important;
    border-color: rgba(224, 184, 64, 0.5) !important;
    color: #ffffff !important;
    transform: translateX(2px) !important;
}
.contact-quick-icon {
    width: 28px !important;
    height: 28px !important;
    border-radius: 50% !important;
    background: rgba(224, 184, 64, 0.16) !important;
    color: #E0B840 !important;
    display: inline-flex !important;
    align-items: center !important;
    justify-content: center !important;
    flex-shrink: 0 !important;
}
.contact-quick-body {
    display: flex !important;
    flex-direction: column !important;
    min-width: 0 !important;
    overflow: hidden !important;
}
.contact-quick-label {
    font-size: 10px !important;
    color: #94a3b8 !important;
    line-height: 1.2 !important;
    text-transform: uppercase !important;
    letter-spacing: 0.04em !important;
}
.contact-quick-val {
    font-size: 12px !important;
    font-weight: 600 !important;
    color: #ffffff !important;
    white-space: nowrap !important;
    overflow: hidden !important;
    text-overflow: ellipsis !important;
}
.contact-social-row {
    display: flex !important;
    gap: 6px !important;
    margin: 4px 0 8px 0 !important;
}
.contact-social-btn {
    flex: 1 !important;
    text-align: center !important;
    padding: 5px 8px !important;
    border-radius: 6px !important;
    font-size: 11px !important;
    font-weight: 600 !important;
    text-decoration: none !important;
    color: #ffffff !important;
    min-height: unset !important;
    display: inline-flex !important;
    align-items: center !important;
    justify-content: center !important;
    transition: transform 0.15s, opacity 0.15s !important;
}
.contact-social-btn:hover {
    transform: translateY(-1px) !important;
    opacity: 0.9 !important;
}
.contact-social-btn.line { background: #06c755 !important; }
.contact-social-btn.whatsapp { background: #25d366 !important; }
.contact-social-btn.facebook { background: #1877f2 !important; }

.contact-quick-address {
    display: flex !important;
    gap: 8px !important;
    align-items: flex-start !important;
    padding: 6px 8px !important;
    background: rgba(255, 255, 255, 0.02) !important;
    border-radius: 6px !important;
    font-size: 11px !important;
    color: #94a3b8 !important;
    line-height: 1.4 !important;
    margin-bottom: 6px !important;
}
.contact-address-text {
    flex: 1 !important;
    overflow: hidden !important;
    text-overflow: ellipsis !important;
    display: -webkit-box !important;
    -webkit-line-clamp: 2 !important;
    -webkit-box-orient: vertical !important;
}
.contact-view-footer-link {
    font-size: 11px !important;
    color: #E0B840 !important;
    text-decoration: underline !important;
    padding: 3px 0 !important;
    min-height: unset !important;
    display: inline-block !important;
    transition: opacity 0.2s !important;
}
.contact-view-footer-link:hover {
    opacity: 0.8 !important;
}

/* Nav Smart Menu (Styled like other nav items) */
#navigation > .nav-smart {
    position: relative;
    display: flex;
    align-items: center;
    gap: 0;
}
#navigation > .nav-smart > a,
.nav-smart-link {
    position: relative;
    display: flex !important;
    align-items: center !important;
    justify-content: center !important;
    min-height: 42px !important;
    padding: 9px 10px !important;
    border-radius: 0 !important;
    font-size: 13px !important;
    font-weight: 600 !important;
    line-height: 1.6 !important;
    white-space: nowrap !important;
    color: inherit !important;
    background: transparent !important;
    border: none !important;
    box-shadow: none !important;
    transform: none !important;
    text-decoration: none !important;
    transition: background .2s, color .2s, transform .2s !important;
}
html[data-theme=dark] #navigation > .nav-smart > a,
html[data-theme=dark] .nav-smart-link {
    color: #ecf2fa !important;
}
#navigation > .nav-smart > a:after,
.nav-smart-link:after {
    content: '';
    position: absolute;
    bottom: 4px;
    left: 12px;
    right: 12px;
    height: 2px;
    border-radius: 2px;
    background: var(--blue, #1256c7);
    transform: scaleX(0);
    transform-origin: center;
    transition: transform .22s ease;
}
#navigation > .nav-smart:hover > a,
#navigation > .nav-smart > a:hover,
.nav-smart-link:hover {
    color: var(--blue, #1256c7) !important;
    background: transparent !important;
    border: none !important;
    box-shadow: none !important;
    transform: none !important;
}
#navigation > .nav-smart:hover > a:after,
#navigation > .nav-smart > a:hover:after,
.nav-smart-link:hover:after {
    transform: scaleX(1);
}
#navigation > .nav-smart > a:active,
.nav-smart-link:active {
    transform: scale(.97) !important;
}
#navigation .smart-submenu {
    min-width: 220px !important;
    padding: 12px 14px !important;
    background: rgba(10, 24, 52, 0.97) !important;
    border: 1px solid rgba(224, 184, 64, 0.35) !important;
    border-radius: 12px !important;
    box-shadow: 0 20px 50px rgba(0, 0, 0, 0.65) !important;
    backdrop-filter: blur(14px) !important;
    left: auto !important;
    right: 0 !important;
}
.smart-submenu a {
    display: flex !important;
    align-items: center !important;
    justify-content: space-between !important;
    padding: 8px 10px !important;
    margin-bottom: 3px !important;
    border-radius: 6px !important;
    font-size: 13px !important;
    color: #e2e8f0 !important;
    text-decoration: none !important;
    transition: all 0.18s !important;
    min-height: unset !important;
}
.smart-submenu a:hover {
    background: rgba(23, 91, 210, 0.25) !important;
    color: #ffffff !important;
    transform: translateX(2px) !important;
}
.smart-menu-sep {
    height: 1px !important;
    background: rgba(255, 255, 255, 0.1) !important;
    margin: 6px 0 !important;
}

@media(max-width: 1100px) {
    #navigation > .nav-smart {
        display: flex;
        width: 100%;
        flex-wrap: wrap;
        gap: 0;
        margin-top: 0;
    }
    #navigation > .nav-smart > a,
    .nav-smart-link {
        justify-content: flex-start !important;
        min-height: 46px !important;
        padding: 11px 14px !important;
        font-size: 14px !important;
        flex: 1;
    }
    #navigation > .nav-smart > a:after,
    .nav-smart-link:after {
        left: 5px;
        right: auto;
        top: 12px;
        bottom: 12px;
        width: 3px;
        height: auto;
        transform: scaleY(0);
    }
    #navigation > .nav-smart:hover > a:after,
    #navigation > .nav-smart > a:hover:after,
    .nav-smart-link:hover:after {
        transform: scaleY(1);
    }
    #navigation .smart-submenu,
    #navigation .contact-submenu {
        flex: 0 0 calc(100% - 10px);
        width: calc(100% - 10px) !important;
        min-width: 0 !important;
        padding: 12px !important;
    }
}
        `;
        document.head.appendChild(style);
    }

    function hydrateContactMenu(settings) {
        if (!settings) {
            try {
                const isPreview = window.location.search.includes('preview=draft');
                const raw = localStorage.getItem(isPreview ? 'stk_cms_draft' : 'stk_cms_published') || localStorage.getItem('stk_cms_published');
                if (raw) {
                    const parsed = JSON.parse(raw);
                    settings = parsed.content?.settings || parsed.settings;
                }
            } catch (e) {}
        }
        if (!settings) return;
        const lang = document.documentElement.lang || 'th';

        // 1. Phone
        const phone = settings.phone || '+856 20 5555 8888';
        document.querySelectorAll('[data-contact-phone]').forEach(el => el.textContent = phone);
        document.querySelectorAll('[data-nav-contact="phone"]').forEach(el => {
            if (el.tagName === 'A') el.href = 'tel:' + phone.replace(/[\s()]/g, '');
        });

        // 2. Email
        const email = settings.email || 'info@lovestkgroupe.com';
        document.querySelectorAll('[data-contact-email]').forEach(el => el.textContent = email);
        document.querySelectorAll('[data-nav-contact="email"]').forEach(el => {
            if (el.tagName === 'A') el.href = 'mailto:' + email;
        });

        // 3. Socials
        if (settings.line) {
            document.querySelectorAll('[data-nav-contact="line"]').forEach(el => {
                el.href = settings.line;
                el.style.display = '';
            });
        }
        if (settings.whatsapp) {
            document.querySelectorAll('[data-nav-contact="whatsapp"]').forEach(el => {
                el.href = settings.whatsapp;
                el.style.display = '';
            });
        }
        if (settings.facebook) {
            document.querySelectorAll('[data-nav-contact="facebook"]').forEach(el => {
                el.href = settings.facebook;
                el.style.display = '';
            });
        }

        // 4. Address
        const address = settings.address?.[lang] || settings.address?.th || 'อาคาร LOVE STK GROUPE สปป.ลาว';
        document.querySelectorAll('[data-contact-address]').forEach(el => el.textContent = address);

        // 5. STK Smart URL
        const smartUrl = settings.stkSmartUrl || 'https://stkgroupe.com/smart/';
        document.querySelectorAll('[data-system="stk_smart"]').forEach(el => {
            if (el.tagName === 'A') el.href = smartUrl;
        });

        // 6. Multilingual labels for Contact Submenu
        const dict = {
            contactDirectTitle: { th: 'ข้อมูลติดต่อ', lo: 'ຂໍ້ມູນຕິດຕໍ່', en: 'Contact Details' },
            phoneLabel: { th: 'โทรศัพท์', lo: 'ໂທລະສັບ', en: 'Phone' },
            emailLabel: { th: 'อีเมล', lo: 'ອີເມວ', en: 'Email' },
            viewFooterContact: { th: 'ดูข้อมูลติดต่อทั้งหมด ↓', lo: 'ເບິ່ງຂໍ້ມູນຕິດຕໍ່ທັງໝົດ ↓', en: 'View full contact details ↓' },
            companySystemsTitle: { th: 'ระบบงานบริษัท', lo: 'ລະບົບວຽກບໍລິສັດ', en: 'Company Systems' }
        };
        for (const [key, t] of Object.entries(dict)) {
            document.querySelectorAll(`[data-i="${key}"]`).forEach(el => {
                el.textContent = t[lang] || t.th;
            });
        }
    }

    function initSmartMenu() {
        const root = document.querySelector('.nav-smart');
        if (!root) return;
        const toggle = root.querySelector('.smart-menu-toggle');
        const submenu = root.querySelector('.smart-submenu');
        if (!toggle || !submenu) return;
        const links = [...root.querySelectorAll('a')];
        const desktop = window.matchMedia('(min-width:1101px) and (hover:hover)');

        function open(value) {
            toggle.setAttribute('aria-expanded', String(value));
            submenu.hidden = !value;
        }

        toggle.addEventListener('click', (e) => {
            e.stopPropagation();
            open(submenu.hidden);
        });

        root.addEventListener('mouseenter', () => {
            if (desktop.matches) open(true);
        });
        root.addEventListener('mouseleave', () => {
            if (desktop.matches && !root.contains(document.activeElement)) open(false);
        });
        root.addEventListener('focusout', (e) => {
            if (!root.contains(e.relatedTarget)) open(false);
        });
        document.addEventListener('click', (e) => {
            if (!root.contains(e.target)) open(false);
        });
        root.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                e.preventDefault();
                open(false);
                toggle.focus();
            }
            if (e.target === toggle && e.key === 'ArrowDown') {
                e.preventDefault();
                open(true);
                submenu.querySelector('a')?.focus();
            }
        });
        links.forEach(a => a.addEventListener('click', () => open(false)));

        function renderLang() {
            const lang = document.documentElement.lang || 'th';
            toggle.setAttribute('aria-label', ({th:'เปิดเมนู STK Smart',lo:'ເປີດເມນູ STK Smart',en:'Open STK Smart menu'})[lang] || 'Open STK Smart menu');
            const adminLink = root.querySelector('[data-smart-admin]');
            if (adminLink) {
                adminLink.textContent = ({th:'จัดการเว็บไซต์',lo:'ຈັດການເວັບໄຊ',en:'Manage website'})[lang] || 'Manage website';
            }
        }
        document.addEventListener('stk-language-change', renderLang);
        renderLang();
    }

    async function initClientFeatures() {
        injectContactMenuStyles();
        initSmartMenu();
        enforceFeatureFlags();

        // Quick micro-fetch to Supabase for immediate cross-device sync of Feature Flags
        try {
            const cfg = getCfg();
            const res = await originalFetch(`${restUrl()}/website_settings?settings_key=eq.main&select=theme`, {
                headers: { 'apikey': cfg.SUPABASE_ANON_KEY },
                cache: 'no-store'
            });
            if (res.ok) {
                const list = await res.json();
                if (list?.[0]?.theme?.features) {
                    enforceFeatureFlags(list[0].theme.features);
                }
            }
        } catch (e) {}
    }

    document.addEventListener('stk-language-change', () => {
        hydrateContactMenu();
    });

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initClientFeatures);
    } else {
        initClientFeatures();
    }

    CompanyDataService.getActiveFeatures = getActiveFeatures;
    CompanyDataService.enforceFeatureFlags = enforceFeatureFlags;
    CompanyDataService.hydrateContactMenu = hydrateContactMenu;
    window.CompanyDataService = CompanyDataService;
})(window);
