// STAGING-ONLY MOCK. Never deploy this function to production.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") || "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json; charset=utf-8",
};
function reply(status: number, body: unknown) {
  return new Response(JSON.stringify(body), { status, headers: cors });
}
Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return reply(405, { error: "method_not_allowed" });
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !SUPABASE_SERVICE_ROLE_KEY) return reply(503, { error: "staging_mock_not_configured" });
  try {
    const token = (req.headers.get("Authorization") || "").match(/^Bearer\s+(.+)$/i)?.[1];
    if (!token) return reply(401, { error: "authentication_required" });
    const userResponse = await fetch(SUPABASE_URL + "/auth/v1/user", {
      headers: { apikey: SUPABASE_ANON_KEY, Authorization: "Bearer " + token },
      signal: AbortSignal.timeout(10000),
    });
    if (!userResponse.ok) return reply(401, { error: "invalid_session" });
    const user = await userResponse.json();
    if (!user?.id) return reply(401, { error: "invalid_session" });
    const profileResponse = await fetch(
      SUPABASE_URL + "/rest/v1/profiles?id=eq." + encodeURIComponent(user.id) + "&select=role&limit=1",
      { headers: { apikey: SUPABASE_SERVICE_ROLE_KEY, Authorization: "Bearer " + SUPABASE_SERVICE_ROLE_KEY } },
    );
    if (!profileResponse.ok) return reply(503, { error: "admin_check_failed" });
    const profiles = await profileResponse.json();
    if (profiles?.[0]?.role !== "admin") return reply(403, { error: "admin_only" });

    const body = await req.json().catch(() => ({}));
    const action = String(body?.action || "");
    let data: unknown = {};
    if (action === "ping") {
      data = { mode: "simulación", external_provider_connected: false, message: "El entorno de pruebas no se conecta a ningún proveedor externo." };
    } else if (action === "catalog" || action === "coverage" || action === "orders" || action === "webhooks") {
      data = { items: [], mode: "simulación" };
    } else if (action === "balance") {
      data = { available: 0, currency: "TEST_ONLY", mode: "simulación", provider_balance_used: false };
    } else if (action === "order") {
      data = { status: "not_found", mode: "simulación" };
    } else {
      return reply(400, { error: "unsupported_action" });
    }
    return reply(200, { provider_status: 200, data, staging_mock: true });
  } catch {
    return reply(500, { error: "staging_mock_read_failed" });
  }
});
