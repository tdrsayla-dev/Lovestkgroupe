/**
 * Cloudflare Pages Function: /api/rest/v1/*
 * Wildcard handler for all STK Supabase Tables & RPC endpoints with Edge Caching
 */

const DEFAULT_SUPABASE_URL = 'https://mfpkeyrykqnrywyksyqp.supabase.co';
const DEFAULT_SUPABASE_KEY = 'sb_publishable_807NIkuj6MAs1KZY-m4tug_Fm1Mk-AO';

// TTLs in seconds for Cloudflare Edge Cache
const TABLE_TTLS = {
  stk_products: 600,         // 10 mins
  stk_business_teams: 1800,   // 30 mins
  stk_customer_types: 1800,   // 30 mins
  stk_closers: 1800,          // 30 mins
  stk_system_settings: 1800,  // 30 mins
  stk_company_settings: 1800, // 30 mins
  stk_campaigns: 600,         // 10 mins
  stk_target_history: 600,    // 10 mins
  stk_b2b_price_tiers: 600,   // 10 mins
  stk_members: 300,           // 5 mins
  stk_customers: 180,         // 3 mins
  stk_sales: 60,              // 1 min
  stk_lots: 120,              // 2 mins
  stk_stock_movements: 60,
  stk_warehouse_transfers: 60,
  stk_daily_balance: 60,
  stk_nutrient_orders: 60,
  stk_b2b_orders: 60,
  stk_payout_logs: 60,
  stk_paid_records: 60,
  stk_campaign_results: 60
};

export async function onRequest(context) {
  const { request, env, params } = context;
  const method = request.method;

  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PATCH, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': '*',
    'Access-Control-Expose-Headers': 'Content-Range, Preference-Applied, X-Cache-Status'
  };

  if (method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  const supabaseUrl = env.SUPABASE_URL || DEFAULT_SUPABASE_URL;
  const supabaseKey = env.SUPABASE_ANON_KEY || DEFAULT_SUPABASE_KEY;

  const subPath = Array.isArray(params.path) ? params.path.join('/') : (params.path || '');
  const url = new URL(request.url);
  const queryString = url.search;
  const fullTargetUrl = `${supabaseUrl}/rest/v1/${subPath}${queryString}`;

  const forwardHeaders = new Headers();
  forwardHeaders.set('apikey', supabaseKey);
  forwardHeaders.set('Authorization', `Bearer ${supabaseKey}`);

  const headerList = ['content-type', 'prefer', 'range', 'accept'];
  for (const h of headerList) {
    if (request.headers.has(h)) {
      forwardHeaders.set(h, request.headers.get(h));
    }
  }

  // 1. WRITE OPERATIONS (POST, PATCH, PUT, DELETE): Direct proxy to Supabase
  if (method !== 'GET' && method !== 'HEAD') {
    try {
      const body = ['POST', 'PATCH', 'PUT'].includes(method) ? await request.text() : undefined;
      const upstreamRes = await fetch(fullTargetUrl, {
        method,
        headers: forwardHeaders,
        body
      });

      const responseHeaders = new Headers(upstreamRes.headers);
      for (const [k, v] of Object.entries(corsHeaders)) {
        responseHeaders.set(k, v);
      }

      return new Response(upstreamRes.body, {
        status: upstreamRes.status,
        headers: responseHeaders
      });
    } catch (err) {
      return new Response(JSON.stringify({ error: String(err.message || err) }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
  }

  // 2. READ OPERATIONS (GET): Check Cloudflare Edge Cache API
  const isNoCache = queryString.includes('nocache=true') || request.headers.get('cache-control')?.includes('no-cache');
  const tablePart = subPath.split('/')[0];
  const isRpc = subPath.startsWith('rpc/');
  const ttl = isRpc ? 30 : (TABLE_TTLS[tablePart] || 0);

  // Use Cloudflare Edge Cache if cacheable
  const cache = (typeof caches !== 'undefined' && caches.default) ? caches.default : null;
  const cacheKey = new Request(url.toString(), request);

  if (cache && !isNoCache && ttl > 0) {
    try {
      const cachedResponse = await cache.match(cacheKey);
      if (cachedResponse) {
        const responseWithHeaders = new Response(cachedResponse.body, cachedResponse);
        for (const [k, v] of Object.entries(corsHeaders)) {
          responseWithHeaders.headers.set(k, v);
        }
        responseWithHeaders.headers.set('X-Cache-Status', 'HIT');
        return responseWithHeaders;
      }
    } catch (_) {}
  }

  // Fetch from Supabase on cache miss
  try {
    const upstreamRes = await fetch(fullTargetUrl, {
      method: 'GET',
      headers: forwardHeaders
    });

    const responseHeaders = new Headers(upstreamRes.headers);
    for (const [k, v] of Object.entries(corsHeaders)) {
      responseHeaders.set(k, v);
    }
    responseHeaders.set('X-Cache-Status', 'MISS');

    if (upstreamRes.ok && !isNoCache && ttl > 0 && cache) {
      responseHeaders.set('Cache-Control', `public, max-age=${ttl}, s-maxage=${ttl}`);
      const responseToCache = new Response(upstreamRes.clone().body, {
        status: upstreamRes.status,
        headers: responseHeaders
      });
      context.waitUntil(cache.put(cacheKey, responseToCache));
    }

    return new Response(upstreamRes.body, {
      status: upstreamRes.status,
      headers: responseHeaders
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err.message || err) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
}

