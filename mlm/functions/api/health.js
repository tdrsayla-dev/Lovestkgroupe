/**
 * Cloudflare Pages Function: /api/health
 */
export async function onRequest(context) {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': '*',
    'Content-Type': 'application/json'
  };

  if (context.request.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const payload = {
    status: 'online',
    platform: 'Cloudflare Pages Functions (Edge Workers)',
    system: 'LOVE STK GROUPE - Centralized Architecture',
    cacheEngine: 'Cloudflare Edge Cache + Cache API',
    timestamp: new Date().toISOString()
  };

  return new Response(JSON.stringify(payload, null, 2), {
    status: 200,
    headers: corsHeaders
  });
}

