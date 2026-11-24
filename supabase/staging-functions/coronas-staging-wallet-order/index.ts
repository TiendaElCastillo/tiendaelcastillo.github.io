// STAGING-ONLY MOCK. Never move this function into supabase/functions or deploy it to production.
// This claims a Coronas order in the staging database and marks a simulated delivery.
// It NEVER contacts an external top-up provider and NEVER spends a real provider balance.
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
function headers(key: string, token?: string) {
  return { apikey: key, Authorization: "Bearer " + (token || key), "Content-Type": "application/json" };
}
async function getUser(req: Request) {
  const token = (req.headers.get("Authorization") || "").match(/^Bearer\s+(.+)$/i)?.[1];
  if (!token) throw Object.assign(new Error("Debes iniciar sesión."), { status: 401 });
  const response = await fetch(SUPABASE_URL + "/auth/v1/user", {
    headers: headers(SUPABASE_ANON_KEY, token),
    signal: AbortSignal.timeout(10000),
  });
  if (!response.ok) throw Object.assign(new Error("La sesión no es válida."), { status: 401 });
  const user = await response.json();
  if (!user?.id) throw Object.assign(new Error("La sesión no es válida."), { status: 401 });
  return String(user.id);
}
async function rpc(name: string, body: Record<string, unknown>) {
  const response = await fetch(SUPABASE_URL + "/rest/v1/rpc/" + name, {
    method: "POST",
    headers: headers(SUPABASE_SERVICE_ROLE_KEY),
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(15000),
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
  let userId = "";
  let orderId = "";
  try {
    userId = await getUser(req);
    const body = await req.json().catch(() => ({}));
    if (body?.action !== "submit_wallet") {
      return reply(400, { error: "unsupported_staging_action", message: "El simulador solo admite compras con Coronas." });
    }
    orderId = typeof body?.order_id === "string" ? body.order_id : "";
    if (!/^[0-9a-f-]{36}$/i.test(orderId)) return reply(400, { error: "invalid_order_id" });

    const claim: any = await rpc("claim_central_one_wallet_order", {
      p_order_id: orderId,
      p_user_id: userId,
    });
    if (claim?.claim_status === "already_submitted") {
      return reply(200, {
        ok: true,
        already_submitted: true,
        provider_order_id: claim.provider_order_id,
        reference_code: claim.reference_code,
        provider_status: claim.provider_status,
        staging_mock: true,
      });
    }
    if (claim?.claim_status === "in_progress") {
      return reply(409, {
        error: "submission_in_progress",
        message: "La simulación de esta compra todavía se está procesando. No la repitas.",
      });
    }
    if (claim?.claim_status !== "claimed") {
      return reply(409, { error: "staging_order_not_claimed", message: "No se pudo reservar el pedido de prueba." });
    }

    if (claim.provider_product_id !== MOCK_PRODUCT_ID) {
      await rpc("finish_central_one_order", {
        p_order_id: orderId,
        p_provider_status: "retryable",
        p_provider_order_id: null,
        p_reference_code: null,
        p_request_id: null,
        p_response: { preflight: "blocked", no_provider_order_created: true, staging_mock: true },
        p_error_code: "staging_mock_product_not_allowed",
        p_error_message: "El simulador solo permite el paquete técnico de pruebas.",
      });
      const refund = await rpc("refund_wallet_order_before_provider", {
        p_order_id: orderId,
        p_user_id: userId,
      });
      return reply(409, {
        error: "staging_mock_product_not_allowed",
        message: "El paquete no pertenece al simulador. Las Coronas de esta compra se devolvieron.",
        wallet_refund: refund,
      });
    }

    const providerOrderId = crypto.randomUUID();
    const referenceCode = "SIM-" + crypto.randomUUID().replace(/-/g, "").slice(0, 10).toUpperCase();
    const requestId = "STAGING-MOCK-" + crypto.randomUUID();
    const finished = await rpc("finish_central_one_order", {
      p_order_id: orderId,
      p_provider_status: "completed",
      p_provider_order_id: providerOrderId,
      p_reference_code: referenceCode,
      p_request_id: requestId,
      p_response: {
        staging_mock: true,
        simulated_delivery: true,
        external_provider_called: false,
        provider_balance_used: false,
      },
      p_error_code: null,
      p_error_message: null,
    });
    return reply(200, {
      ok: true,
      already_submitted: false,
      provider_order_id: providerOrderId,
      reference_code: referenceCode,
      provider_status: "completed",
      local: finished,
      staging_mock: true,
      message: "Compra de prueba completada en el simulador; no se realizó ninguna recarga externa.",
    });
  } catch (error) {
    return reply(Number((error as any)?.status) || 500, {
      error: "staging_mock_order_failed",
      message: error instanceof Error ? error.message : "No se pudo completar la compra simulada.",
    });
  }
});
