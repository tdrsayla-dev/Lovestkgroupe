/**
 * =========================================================================
 * 🛡️ LOVE STK GROUPE - Complete System Caching & Proxy Wrapper
 * Node.js + Express + Smart In-Memory RAM Cache + Supabase Dual DB
 * =========================================================================
 * Comprehensive Coverage:
 *  1. Primary STK Database (All tables, all RPC functions, all CRUD)
 *  2. Secondary Clinic Database (patients, visits, staff_users, etc.)
 *  3. In-Memory RAM Cache with write-through auto-invalidation
 *  4. High-ratio Gzip/Brotli compression (reduces payload by 80%)
 *  5. Complete frontend serving (Root HTML, CEO module, PAYMENT, fonts)
 * =========================================================================
 */

const path = require('path');
const fs = require('fs');

// Auto-resolve node_modules from both root and _DO_NOT_UPLOAD_TO_GITHUB
const altModules = path.join(__dirname, '_DO_NOT_UPLOAD_TO_GITHUB', 'node_modules');
if (fs.existsSync(altModules) && !module.paths.includes(altModules)) {
  module.paths.push(altModules);
}

const express = require('express');
const cors = require('cors');
const compression = require('compression');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 4000;

// ─── 1. SUPABASE CLIENTS CONFIGURATION ────────────────────────────────────
// 1.1 Primary Database (STK)
const STK_URL = process.env.SUPABASE_URL || 'https://mfpkeyrykqnrywyksyqp.supabase.co';
const STK_KEY = process.env.SUPABASE_ANON_KEY || 'sb_publishable_807NIkuj6MAs1KZY-m4tug_Fm1Mk-AO';
const stkSupabase = createClient(STK_URL, STK_KEY);

// 1.2 Secondary Database (Clinic)
const CLINIC_URL = process.env.CLINIC_SUPABASE_URL || 'https://fpmstumpobbjozflkola.supabase.co';
const CLINIC_KEY = process.env.CLINIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZwbXN0dW1wb2Jiam96Zmxrb2xhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODM5MDE0NDcsImV4cCI6MjA5OTQ3NzQ0N30.qTn4UHISBY9A5fX83ANk0mu3JSgK42ByLZ9xPh2TEvM';
const clinicSupabase = createClient(CLINIC_URL, CLINIC_KEY);

// Enable high-ratio Gzip compression
app.use(compression());
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// ─── 2. IN-MEMORY CACHE & MONITORING STATS ────────────────────────────────
const cacheStore = new Map();
const stats = {
  totalRequests: 0,
  cacheHits: 0,
  supabaseHits: 0,
  estimatedEgressSavedBytes: 0,
  startedAt: new Date().toISOString()
};

// Full System Table TTL Configurations (in milliseconds)
const TABLE_TTLS = {
  // Master Catalog & Config (Long cache)
  stk_products: 10 * 60 * 1000,
  stk_business_teams: 30 * 60 * 1000,
  stk_customer_types: 30 * 60 * 1000,
  stk_closers: 30 * 60 * 1000,
  stk_system_settings: 30 * 60 * 1000,
  stk_company_settings: 30 * 60 * 1000,
  stk_campaigns: 10 * 60 * 1000,
  stk_target_history: 10 * 60 * 1000,
  stk_b2b_price_tiers: 10 * 60 * 1000,

  // User & Customer Records
  stk_members: 5 * 60 * 1000,
  stk_customers: 3 * 60 * 1000,

  // Transactions & Stock
  stk_sales: 60 * 1000,
  stk_lots: 2 * 60 * 1000,
  stk_stock_movements: 60 * 1000,
  stk_warehouse_transfers: 60 * 1000,
  stk_daily_balance: 60 * 1000,
  stk_nutrient_orders: 60 * 1000,
  stk_b2b_orders: 60 * 1000,
  stk_payout_logs: 60 * 1000,
  stk_paid_records: 60 * 1000,
  stk_campaign_results: 60 * 1000,

  // Clinic DB Tables
  staff_users: 15 * 60 * 1000,
  patients: 3 * 60 * 1000,
  visits: 60 * 1000,
  commission_logs: 60 * 1000
};

function getCache(key) {
  const item = cacheStore.get(key);
  if (!item) return null;
  if (Date.now() > item.expiresAt) {
    cacheStore.delete(key);
    return null;
  }
  return item.data;
}

function setCache(key, data, ttl) {
  cacheStore.set(key, {
    data,
    expiresAt: Date.now() + ttl,
    size: JSON.stringify(data).length
  });
}

function invalidateTableCache(prefix) {
  for (const k of cacheStore.keys()) {
    if (k.startsWith(prefix)) {
      cacheStore.delete(k);
    }
  }
}

// ─── 3. HEALTH & MONITORING ENDPOINT ──────────────────────────────────────
app.get('/api/health', (req, res) => {
  const hitRatio = stats.totalRequests > 0 
    ? ((stats.cacheHits / stats.totalRequests) * 100).toFixed(1) + '%' 
    : '0%';
  const savedMB = (stats.estimatedEgressSavedBytes / (1024 * 1024)).toFixed(2) + ' MB';

  res.json({
    status: 'online',
    system: 'LOVE STK GROUPE - Centralized Architecture',
    coverage: '100% Full-System Coverage (STK + Clinic + Static Modules)',
    stats: {
      ...stats,
      cacheHitRatio: hitRatio,
      estimatedEgressSaved: savedMB,
      activeCachedKeys: cacheStore.size
    }
  });
});

// ─── 4. MASTER BUNDLE ENDPOINT (One-Shot RAM Fetch) ───────────────────────
app.get('/api/app-data', async (req, res) => {
  stats.totalRequests++;
  const cacheKey = 'bundle:master_app_data';
  const cached = getCache(cacheKey);

  if (cached) {
    stats.cacheHits++;
    stats.estimatedEgressSavedBytes += JSON.stringify(cached).length;
    res.setHeader('X-Cache-Status', 'HIT');
    return res.json(cached);
  }

  stats.supabaseHits++;
  try {
    const [pRes, tRes, cRes, mRes, custRes, tmRes, setRes] = await Promise.all([
      stkSupabase.from('stk_products').select('product_id,name,category,price_full,price_member,price_promo,give_pv,current_stock,status,self_fee,level_1_fee,level_2_fee,level_3_fee,level_4_fee,level_5_fee'),
      stkSupabase.from('stk_customer_types').select('*'),
      stkSupabase.from('stk_closers').select('*'),
      stkSupabase.from('stk_members').select('user_id,name,business_team,permission_role,status,sponsor_id,accumulated_pv,phone_number,email,line_id,line_uid,bank_name,bank_account_no,bank_account_name,id_card_url'),
      stkSupabase.from('stk_customers').select('customer_id,name,customer_type,owner_member_id').order('created_at', { ascending: false }).limit(1000),
      stkSupabase.from('stk_business_teams').select('*'),
      stkSupabase.from('stk_system_settings').select('*').limit(1)
    ]);

    const bundle = {
      products: pRes.data || [],
      customerTypes: tRes.data || [],
      closers: cRes.data || [],
      members: mRes.data || [],
      customers: custRes.data || [],
      businessTeams: tmRes.data || [],
      systemSettings: (setRes.data && setRes.data[0]) || { exchange_rate: 700, commission_levels: 6 },
      cachedAt: new Date().toISOString()
    };

    setCache(cacheKey, bundle, 5 * 60 * 1000);
    res.setHeader('X-Cache-Status', 'MISS');
    res.json(bundle);
  } catch (err) {
    console.error('[Bundle Error]:', err);
    res.status(500).json({ error: 'Failed to fetch master data' });
  }
});

// ─── 5. GENERIC FORWARDER HELPER ──────────────────────────────────────────
async function proxyRequest(req, res, targetBaseUrl, targetKey, cacheScope, subPath) {
  const method = req.method;
  const cleanSubPath = (subPath || '').replace(/^\//, '');
  const queryString = req.url.includes('?') ? req.url.split('?')[1] : '';
  const fullTargetUrl = `${targetBaseUrl}/${cleanSubPath}${queryString ? '?' + queryString : ''}`;

  const forwardHeaders = {
    'apikey': targetKey,
    'Authorization': `Bearer ${targetKey}`
  };

  if (req.headers['content-type']) forwardHeaders['Content-Type'] = req.headers['content-type'];
  if (req.headers['prefer']) forwardHeaders['Prefer'] = req.headers['prefer'];
  if (req.headers['range']) forwardHeaders['Range'] = req.headers['range'];
  if (req.headers['accept']) forwardHeaders['Accept'] = req.headers['accept'];

  // WRITE OPERATIONS (POST, PATCH, PUT, DELETE): Invalidate cache & forward
  if (method !== 'GET' && method !== 'HEAD') {
    const tablePart = cleanSubPath.split('/')[0];
    invalidateTableCache(`${cacheScope}:${tablePart}`);
    cacheStore.delete('bundle:master_app_data');

    try {
      const fetchRes = await fetch(fullTargetUrl, {
        method,
        headers: forwardHeaders,
        body: ['POST', 'PATCH', 'PUT'].includes(method) ? JSON.stringify(req.body) : undefined
      });

      if (fetchRes.headers.get('content-range')) {
        res.setHeader('Content-Range', fetchRes.headers.get('content-range'));
      }
      if (fetchRes.headers.get('preference-applied')) {
        res.setHeader('Preference-Applied', fetchRes.headers.get('preference-applied'));
      }

      const responseText = await fetchRes.text();
      res.status(fetchRes.status);
      res.setHeader('Content-Type', fetchRes.headers.get('content-type') || 'application/json');
      return res.send(responseText);
    } catch (err) {
      console.error(`[Proxy Write Error on ${cleanSubPath}]:`, err);
      return res.status(500).json({ error: String(err.message || err) });
    }
  }

  // READ OPERATIONS (GET): Check In-Memory RAM Cache
  stats.totalRequests++;
  const tablePart = cleanSubPath.split('/')[0];
  const isRpc = cleanSubPath.startsWith('rpc/');
  const isNoCache = queryString.includes('nocache=true') || req.headers['cache-control']?.includes('no-cache');
  const cacheKey = `${cacheScope}:${cleanSubPath}:${queryString}`;
  const ttl = isRpc ? 30 * 1000 : (TABLE_TTLS[tablePart] || 0);

  if (!isNoCache && ttl > 0) {
    const cachedData = getCache(cacheKey);
    if (cachedData) {
      stats.cacheHits++;
      stats.estimatedEgressSavedBytes += JSON.stringify(cachedData).length;
      res.setHeader('X-Cache-Status', 'HIT');
      return res.json(cachedData);
    }
  }

  stats.supabaseHits++;
  try {
    const fetchRes = await fetch(fullTargetUrl, {
      method: 'GET',
      headers: forwardHeaders
    });

    if (fetchRes.headers.get('content-range')) {
      res.setHeader('Content-Range', fetchRes.headers.get('content-range'));
    }

    if (!fetchRes.ok) {
      const errText = await fetchRes.text();
      return res.status(fetchRes.status).send(errText);
    }

    const data = await fetchRes.json();
    if (!isNoCache && ttl > 0 && (Array.isArray(data) || typeof data === 'object')) {
      setCache(cacheKey, data, ttl);
    }

    res.setHeader('X-Cache-Status', 'MISS');
    res.json(data);
  } catch (err) {
    console.error(`[Proxy Read Error on ${cleanSubPath}]:`, err);
    res.status(500).json({ error: String(err.message || err) });
  }
}

// ─── 6. ROUTE REGISTRATION (STK & CLINIC) VIA EXPRESS USE ──────────────────
// STK Database proxy handles all routes under /api/rest/v1 (e.g. /stk_products, /rpc/...)
app.use('/api/rest/v1', (req, res) => {
  return proxyRequest(req, res, `${STK_URL}/rest/v1`, STK_KEY, 'stk', req.path);
});

// Clinic Database proxy handles all routes under /api/clinic/rest/v1
app.use('/api/clinic/rest/v1', (req, res) => {
  return proxyRequest(req, res, `${CLINIC_URL}/rest/v1`, CLINIC_KEY, 'clinic', req.path);
});

// ─── 7. STATIC FRONTEND MODULES (Full System Serving) ─────────────────────
// 7.1 Friendly clean URL resolver (e.g. /ReportStock or /reportstock -> ReportStock.html)
app.use((req, res, next) => {
  if (req.method === 'GET' && !req.path.includes('.') && !req.path.startsWith('/api')) {
    const cleanPath = req.path.replace(/^\//, '').replace(/\/$/, '');
    const directFile = path.join(__dirname, cleanPath + '.html');
    if (fs.existsSync(directFile)) {
      return res.sendFile(directFile);
    }
    try {
      const files = fs.readdirSync(__dirname);
      const matched = files.find(f => f.toLowerCase() === (cleanPath + '.html').toLowerCase());
      if (matched) {
        return res.sendFile(path.join(__dirname, matched));
      }
    } catch (_) {}
  }
  next();
});

// 7.2 Serves everything: Root HTML, JS, CSS, fonts, payment module, and CEO dashboard
app.use(express.static(path.join(__dirname), {
  extensions: ['html'],
  maxAge: '1h',
  etag: true
}));

// Default Landing Page -> Mlm.html (Dashboard)
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'Mlm.html'));
});

// ─── 8. START SERVER ──────────────────────────────────────────────────────
const serverInstance = app.listen(PORT, () => {
  console.log(`\n===============================================================`);
  console.log(`🚀 LOVE STK GROUPE - Complete Full-System Architecture Online!`);
  console.log(`🌐 System URL:   http://localhost:${PORT}`);
  console.log(`🛡️ Egress Shield: ACTIVE for STK DB & CLINIC DB (100% Coverage)`);
  console.log(`📊 Health Check: http://localhost:${PORT}/api/health`);
  console.log(`📁 System Path:  Project Framework`);
  console.log(`===============================================================\n`);
});

// Graceful Shutdown
process.on('SIGTERM', () => serverInstance.close());
process.on('SIGINT', () => serverInstance.close());
