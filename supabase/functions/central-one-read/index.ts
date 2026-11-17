import "jsr:@supabase/functions-js/edge-runtime.d.ts";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const CENTRAL_ONE_API_KEY = Deno.env.get("CENTRAL_ONE_API_KEY") || "";
const CENTRAL_ONE_BASE = "https://portal.centraloneglobal.com/api/v1";
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json; charset=utf-8",
};
function reply(status: number, payload: unknown) {
  return new Response(JSON.stringify(payload), { status, headers: corsHeaders });
}
Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return reply(405, { error: "method_not_allowed" });
  try {
    const match = (req.headers.get("Authorization") || "").match(/^Bearer\s+(.+)$/i);
    if (!match) return reply(401, { error: "authentication_required" });
    const accessToken = match[1];
    const userResponse = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
      headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${accessToken}` },
    });
    if (!userResponse.ok) return reply(401, { error: "invalid_session" });
    const user = await userResponse.json();
    if (!user?.id) return reply(401, { error: "invalid_session" });
    const profileResponse = await fetch(
      `${SUPABASE_URL}/rest/v1/profiles?id=eq.${encodeURIComponent(user.id)}&select=role&limit=1`,
      { headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${accessToken}` } },
    );
    if (!profileResponse.ok) return reply(500, { error: "admin_check_failed" });
    const profiles = await profileResponse.json();
    if (profiles?.[0]?.role !== "admin") return reply(403, { error: "admin_only" });
    if (!CENTRAL_ONE_API_KEY) return reply(503, {
      error: "central_one_not_configured",
      message: "Falta CENTRAL_ONE_API_KEY en los secretos de Supabase. No se ha enviado ninguna operación.",
    });
    const body = await req.json();
    const action = body?.action;
    let method = "GET";
    let path = "";
    let payload: unknown = undefined;
    if (action === "ping") path = "/ping";
    else if (action === "catalog") path = "/catalog";
    else if (action === "balance") path = "/balance";
    else if (action === "coverage") path = "/player/validate/coverage";
    else if (action === "orders") path = "/orders?limit=50";
    else if (action === "order") {
      const id = body?.order_id;
      if (typeof id !== "string" || !/^[0-9a-f-]{36}$/i.test(id)) return reply(400, { error: "invalid_order_id" });
      path = `/orders/${id}`;
    } else if (action === "webhooks") path = "/webhooks";
    else if (action === "validate") {
      const product_id = body?.product_id;
      const target_payload = body?.target_payload;
      if (typeof product_id !== "string" || !product_id.trim() ||
          !target_payload || typeof target_payload !== "object" || Array.isArray(target_payload) ||
          JSON.stringify({ product_id, target_payload }).length > 2048) {
        return reply(400, { error: "invalid_validation_request" });
      }
      method = "POST";
      path = "/player/validate";
      payload = { product_id, target_payload };
    } else {
      return reply(400, { error: "unsupported_action", allowed_actions: ["ping","catalog","balance","coverage","validate","orders","order","webhooks"] });
    }
    const upstream = await fetch(`${CENTRAL_ONE_BASE}${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${CENTRAL_ONE_API_KEY}`,
        ...(payload ? { "Content-Type": "application/json" } : {}),
      },
      ...(payload ? { body: JSON.stringify(payload) } : {}),
      signal: AbortSignal.timeout(20000),
    });
    const raw = await upstream.text();
    let data: unknown;
    try { data = raw ? JSON.parse(raw) : {}; } catch { data = { message: "Respuesta no JSON del proveedor" }; }
    return reply(upstream.status, { provider_status: upstream.status, data });
  } catch (error) {
    return reply(500, { error: "proxy_failed", message: error instanceof Error ? error.message : "unexpected_error" });
  }
});