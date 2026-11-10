/**
 * Cloudflare Pages Function: /api/clinic/rest/v1/*
 * Wildcard handler for Clinic External Database with Edge Caching
 */

const DEFAULT_CLINIC_URL = 'https://fpmstumpobbjozflkola.supabase.co';
const DEFAULT_CLINIC_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZwbXN0dW1wb2Jiam96Zmxrb2xhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODM5MDE0NDcsImV4cCI6MjA5OTQ3NzQ0N30.qTn4UHISBY9A5fX83ANk0mu3JSgK42ByLZ9xPh2TEvM';

const CLINIC_TTLS = {
  staff_users: 900,   // 15 mins (doctors list)
  patients: 180,      // 3 mins
  visits: 60,         // 1 min
  commission_logs: 60 // 1 min
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

  const clinicUrl = env.CLINIC_SUPABASE_URL || DEFAULT_CLINIC_URL;
  const clinicKey = env.CLINIC_SUPABASE_ANON_KEY || DEFAULT_CLINIC_KEY;

  const subPath = Array.isArray(params.path) ? params.path.join('/') : (params.path || '');
  const url = new URL(request.url);
  const queryString = url.search;
  const fullTargetUrl = `${clinicUrl}/rest/v1/${subPath}${queryString}`;

  const forwardHeaders = new Headers();
  forwardHeaders.set('apikey', clinicKey);
  forwardHeaders.set('Authorization', `Bearer ${clinicKey}`);

  const headerList = ['content-type', 'prefer', 'range', 'accept'];
  for (const h of headerList) {
    if (request.headers.has(h)) {
      forwardHeaders.set(h, request.headers.get(h));
    }
  }

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

  // GET Requests with Cloudflare Cache
  const isNoCache = queryString.includes('nocache=true') || request.headers.get('cache-control')?.includes('no-cache');
  const tablePart = subPath.split('/')[0];
  const ttl = CLINIC_TTLS[tablePart] || 0;

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

