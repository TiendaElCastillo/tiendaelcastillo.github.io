// STAGING-ONLY MOCK. Never move this function into supabase/functions or deploy it to production.
// It validates a single synthetic product and never contacts an external top-up provider.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") || "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const MOCK_PRODUCT_ID = "STAGING_MOCK_FREE_FIRE_001";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json; charset=utf-8",
};
function reply(status: number, body: unknown) {
  return new Response(JSON.stringify(body), { status, headers: cors });
}
function authHeaders(key: string, token?: string) {
  return {
    apikey: key,
    Authorization: "Bearer " + (token || key),
    "Content-Type": "application/json",
  };
}
async function getUser(req: Request) {
  const token = (req.headers.get("Authorization") || "").match(/^Bearer\s+(.+)$/i)?.[1];
  if (!token) throw Object.assign(new Error("Debes iniciar sesión."), { status: 401 });
  const response = await fetch(SUPABASE_URL + "/auth/v1/user", {
    headers: authHeaders(SUPABASE_ANON_KEY, token),
    signal: AbortSignal.timeout(10000),
  });
  if (!response.ok) throw Object.assign(new Error("La sesión no es válida."), { status: 401 });
  const user = await response.json();
  if (!user?.id) throw Object.assign(new Error("La sesión no es válida."), { status: 401 });
  return { id: String(user.id), token };
}
async function serviceRpc(name: string, body: Record<string, unknown>) {
  const response = await fetch(SUPABASE_URL + "/rest/v1/rpc/" + name, {
    method: "POST",
    headers: authHeaders(SUPABASE_SERVICE_ROLE_KEY),
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(10000),
  });
  const data = await response.json().catch(() => null);
  if (!response.ok) throw new Error(data?.message || data?.details || ("Error interno HTTP " + response.status));
  return data;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return reply(405, { error: "method_not_allowed" });
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !SUPABASE_SERVICE_ROLE_KEY) {
    return reply(503, { error: "staging_mock_not_configured" });
  }
  try {
    const user = await getUser(req);
    const body = await req.json().catch(() => ({}));
    const productId = typeof body?.product_id === "string" ? body.product_id : "";
    const playerId = typeof body?.player_id === "string" ? body.player_id.trim() : "";
    const zoneId = typeof body?.zone_id === "string" ? body.zone_id.trim() : "";
    if (!/^[0-9a-f-]{36}$/i.test(productId)) return reply(400, { error: "invalid_product" });
    if (playerId.length < 3 || playerId.length > 64 || zoneId) {
      return reply(400, { error: "invalid_player_id", message: "Escribe el ID de prueba sin servidor adicional." });
    }

    const query = new URL(SUPABASE_URL + "/rest/v1/products");
    query.searchParams.set("id", "eq." + productId);
    query.searchParams.set("select", "id,name,game,active,storefront_visible,provider_product_id,provider_region,provider_validation_supported,provider_requires_target,provider_target_fields,provider_target_schema,provider_status,provider_in_stock");
    query.searchParams.set("limit", "1");
    const productResponse = await fetch(query, {
      headers: authHeaders(SUPABASE_SERVICE_ROLE_KEY),
      signal: AbortSignal.timeout(10000),
    });
    if (!productResponse.ok) return reply(503, { error: "staging_product_lookup_failed" });
    const rows = await productResponse.json();
    const product = Array.isArray(rows) ? rows[0] : null;
    if (!product || product.provider_product_id !== MOCK_PRODUCT_ID ||
        product.active !== true || product.storefront_visible !== true ||
        product.provider_validation_supported !== true ||
        product.provider_requires_target !== true ||
        String(product.provider_status).toLowerCase() !== "active" ||
        product.provider_in_stock !== true ||
        !Array.isArray(product.provider_target_fields) ||
        product.provider_target_fields.length !== 1 ||
        product.provider_target_fields[0] !== "player_id") {
      return reply(404, { error: "staging_product_unavailable", message: "El paquete de simulación no está disponible." });
    }

    const allowed = await serviceRpc("consume_player_validation_rate_limit", { p_user_id: user.id });
    if (allowed !== true) {
      return new Response(JSON.stringify({
        valid: false,
        error: "validation_rate_limited",
        message: "Has realizado demasiadas verificaciones. Espera un minuto.",
      }), { status: 429, headers: { ...cors, "Retry-After": "60" } });
    }

    const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(playerId));
    const playerIdHash = Array.from(new Uint8Array(digest))
      .map((byte) => byte.toString(16).padStart(2, "0")).join("");
    const token = crypto.randomUUID();
    const now = new Date();
    const insert = await fetch(SUPABASE_URL + "/rest/v1/player_id_validations", {
      method: "POST",
      headers: { ...authHeaders(SUPABASE_SERVICE_ROLE_KEY), Prefer: "return=minimal" },
      body: JSON.stringify({
        token,
        user_id: user.id,
        product_id: product.id,
        provider_product_id: product.provider_product_id,
        region: product.provider_region,
        player_id_hash: playerIdHash,
        player_name: "Cuenta simulada",
        validated_at: now.toISOString(),
        expires_at: new Date(now.getTime() + 10 * 60 * 1000).toISOString(),
      }),
      signal: AbortSignal.timeout(10000),
    });
    if (!insert.ok) return reply(503, { valid: false, error: "staging_validation_receipt_failed" });

    return reply(200, {
      valid: true,
      validation_token: token,
      expires_in_seconds: 600,
      player_name: "Cuenta simulada",
      region: product.provider_region,
      product_name: product.name,
      message: "ID validado en modo de simulación. No se consultó a ningún proveedor externo.",
      staging_mock: true,
    });
  } catch (error) {
    return reply(Number((error as any)?.status) || 500, {
      valid: false,
      error: "staging_mock_validation_failed",
      message: error instanceof Error ? error.message : "No se pudo completar la validación simulada.",
    });
  }
});
