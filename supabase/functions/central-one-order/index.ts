import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") || "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
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
function providerTargetConfig(fields: unknown, schema: unknown): {ok:boolean;playerKey:string|null;zoneKey:string|null} {
  if (!Array.isArray(fields) || !Array.isArray(schema)) return {ok:false,playerKey:null,zoneKey:null};
  if (fields.length === 1 && ["player_id","game_user_id"].includes(String(fields[0])) &&
      (schema.length === 0 || (schema.length === 1 && schema[0]?.key === fields[0] && schema[0]?.type === "text"))) {
    return {ok:true,playerKey:String(fields[0]),zoneKey:null};
  }
  if (fields.length !== 2 || schema.length !== 2) return {ok:false,playerKey:null,zoneKey:null};
  let playerKey: string | null = null;
  let zoneKey: string | null = null;
  for (const rawKey of fields) {
    if (typeof rawKey !== "string" || !/^[A-Za-z][A-Za-z0-9_]{0,39}$/.test(rawKey)) {
      return {ok:false,playerKey:null,zoneKey:null};
    }
    const descriptor = schema.find((item: any) => item && item.key === rawKey);
    if (!descriptor || String(descriptor.type || "text").toLowerCase() !== "text") {
      return {ok:false,playerKey:null,zoneKey:null};
    }
    const semantic = (rawKey + " " + String(descriptor.label || "")).toLowerCase();
    if (/zone|server/.test(semantic)) zoneKey = rawKey;
    else if (/player|user|account|game.?id|uid/.test(semantic)) playerKey = rawKey;
    else return {ok:false,playerKey:null,zoneKey:null};
  }
  return playerKey && zoneKey && playerKey !== zoneKey
    ? {ok:true,playerKey,zoneKey}
    : {ok:false,playerKey:null,zoneKey:null};
}

function safeProviderSnapshot(order: any) {
  const items = Array.isArray(order?.items) ? order.items.map((item: any) => ({
    status: typeof item?.status === "string" ? item.status : null,
    delivered_count: Number.isInteger(item?.delivered_count) ? item.delivered_count : null,
    failure: item?.failure && typeof item.failure === "object" ? {
      code: typeof item.failure.code === "string" ? item.failure.code : null,
      message_es: typeof item.failure.message_es === "string" ? item.failure.message_es.slice(0, 400) : null,
      action: typeof item.failure.action === "string" ? item.failure.action : null,
    } : null,
    refund: item?.refund && typeof item.refund === "object" ? {
      refunded: item.refund.refunded === true,
      refunded_at: typeof item.refund.refunded_at === "string" ? item.refund.refunded_at : null,
    } : null,
  })) : [];
  return {
    status: typeof order?.status === "string" ? order.status : "unknown",
    reference_code: typeof order?.reference_code === "string" ? order.reference_code : null,
    updated_at: typeof order?.updated_at === "string" ? order.updated_at : null,
    refund: order?.refund && typeof order.refund === "object" ? {
      refunded: order.refund.refunded === true,
      refunded_at: typeof order.refund.refunded_at === "string" ? order.refund.refunded_at : null,
    } : null,
    failure: order?.failure && typeof order.failure === "object" ? {
      code: typeof order.failure.code === "string" ? order.failure.code : null,
      message_es: typeof order.failure.message_es === "string" ? order.failure.message_es.slice(0, 400) : null,
      action: typeof order.failure.action === "string" ? order.failure.action : null,
    } : null,
    items,
  };
}
function providerError(data: any) {
  const e = data?.error && typeof data.error === "object" ? data.error : data;
  return {
    code: typeof e?.code === "string" ? e.code.slice(0, 100) : "provider_error",
    message: typeof e?.message_es === "string" ? e.message_es.slice(0, 500)
      : typeof e?.message === "string" ? e.message.slice(0, 500)
      : "Central One no pudo aceptar la solicitud.",
    request_id: typeof e?.request_id === "string" ? e.request_id.slice(0, 150) : null,
  };
}

function parseBalanceAmount(candidate: any): number | null {
  if (candidate === null || candidate === undefined || typeof candidate === "boolean") return null;
  let value = candidate;
  if (value && typeof value === "object" && !Array.isArray(value)) {
    for (const key of ["amount", "value", "available_amount", "availableAmount", "balance_amount"]) {
      if (value[key] !== undefined && value[key] !== null) { value = value[key]; break; }
    }
  }
  if (typeof value === "string") {
    value = value.trim().replace(/,/g, "").replace(/[^0-9.-]/g, "");
    if (!value) return null;
  }
  const amount = typeof value === "number" ? value : Number(value);
  return Number.isFinite(amount) && amount >= 0 ? amount : null;
}

function extractProviderAvailableBalance(payload: any): {available:number;currency:string} | null {
  const balanceKeys = new Set([
    "available", "available_balance", "availableBalance", "available_balance_usdt",
    "available_usdt", "balance_available", "balanceAvailable", "spendable",
    "spendable_balance", "available_amount", "availableAmount", "available_funds",
    "funds_available"
  ]);
  const root = payload && typeof payload === "object" ? payload : {};
  const seen = new Set<any>();
  function visit(node: any, depth: number, inheritedCurrency: string): {available:number;currency:string} | null {
    if (!node || typeof node !== "object" || depth > 5 || seen.has(node)) return null;
    seen.add(node);
    const localCurrency = String(
      node.currency || node.balance_currency || node.asset || node.unit || inheritedCurrency || "USDT"
    ).trim().toUpperCase();
    for (const [key, value] of Object.entries(node)) {
      if (balanceKeys.has(key)) {
        const amount = parseBalanceAmount(value);
        if (amount !== null) {
          const candidateCurrency = value && typeof value === "object"
            ? String((value as any).currency || (value as any).asset || (value as any).unit || localCurrency).toUpperCase()
            : localCurrency;
          return { available: amount, currency: candidateCurrency || "USDT" };
        }
      }
    }
    for (const value of Object.values(node)) {
      if (value && typeof value === "object") {
        const found = visit(value, depth + 1, localCurrency);
        if (found) return found;
      }
    }
    return null;
  }
  return visit(root, 0, String(root.currency || root.balance_currency || "USDT"));
}

async function checkProviderAvailableBalance(requiredAmount: number) {
  let upstream: Response;
  try {
    upstream = await fetch(CENTRAL_ONE_BASE + "/balance", {
      headers: { Authorization: "Bearer " + CENTRAL_ONE_API_KEY },
      signal: AbortSignal.timeout(15000),
    });
  } catch {
    return {
      ok:false, code:"provider_balance_unavailable",
      message:"No pudimos consultar el saldo disponible de Central One. Por seguridad, el pedido no se enviará hasta poder verificarlo."
    };
  }
  const raw = await upstream.text();
  let data: any = null;
  try { data = raw ? JSON.parse(raw) : null; } catch { data = null; }
  if (!upstream.ok) {
    const err = providerError(data);
    if (upstream.status === 401 || upstream.status === 403) {
      return {
        ok:false, code:"provider_balance_scope_missing",
        message:"Central One no permitió consultar el saldo. Comprueba que la llave API tenga el permiso balance:read. No se ha enviado el pedido."
      };
    }
    return {
      ok:false, code:"provider_balance_unavailable",
      message:"No pudimos comprobar el saldo de Central One: " + err.message + " No se ha enviado el pedido."
    };
  }
  const balance = extractProviderAvailableBalance(data);
  if (!balance) {
    return {
      ok:false, code:"provider_balance_unreadable",
      message:"Central One respondió al consultar el saldo, pero no pudimos identificar el campo de saldo disponible. El pedido quedó bloqueado para evitar un envío sin fondos."
    };
  }
  if (!["USDT","USD"].includes(balance.currency)) {
    return {
      ok:false, code:"provider_balance_currency_unsupported",
      message:"Central One devolvió el saldo en una moneda no reconocida (" + balance.currency + "). No se enviará el pedido hasta verificar la equivalencia."
    };
  }
  const roundedAvailable = Number(balance.available.toFixed(6));
  const roundedRequired = Number(requiredAmount.toFixed(6));
  if (roundedAvailable + 0.000001 < roundedRequired) {
    return {
      ok:false, code:"central_one_insufficient_balance",
      available:roundedAvailable, required:roundedRequired, currency:balance.currency,
      message:"Saldo insuficiente en Central One: disponible " + roundedAvailable.toFixed(4) + " " +
        balance.currency + " y este pedido necesita " + roundedRequired.toFixed(4) + " " +
        balance.currency + ". No se envió la orden ni se descontó saldo por este intento. Recarga el saldo del proveedor y reintenta el mismo pedido."
    };
  }
  return {ok:true,available:roundedAvailable,required:roundedRequired,currency:balance.currency};
}

function providerRefundInfo(order: any) {
  const topRefund = order?.refund && typeof order.refund === "object" ? order.refund : null;
  const items = Array.isArray(order?.items) ? order.items : [];
  const itemRefunds = items.map((item: any) => item?.refund).filter((refund: any) => refund && typeof refund === "object");
  const allItemsRefunded = items.length > 0 && itemRefunds.length === items.length &&
    itemRefunds.every((refund: any) => refund.refunded === true);
  const refunded = topRefund?.refunded === true || allItemsRefunded;
  const refundedAt = typeof topRefund?.refunded_at === "string"
    ? topRefund.refunded_at
    : itemRefunds.find((refund: any) => typeof refund.refunded_at === "string")?.refunded_at || null;
  return {refunded,refunded_at:refundedAt};
}

async function applyConfirmedWalletRefund(orderId: string, providerOrderId: string, status: string, refund: any) {
  if (!["failed","cancelled"].includes(status) || refund?.refunded !== true) return null;
  return await serviceRpc("refund_wallet_order_after_provider_refund", {
    p_order_id: orderId,
    p_provider_order_id: providerOrderId
  });
}

async function adminContext(req: Request) {
  const match = (req.headers.get("Authorization") || "").match(/^Bearer\s+(.+)$/i);
  if (!match) throw Object.assign(new Error("Debes iniciar sesión como administrador."), { status: 401 });
  const accessToken = match[1];
  const userResponse = await fetch(SUPABASE_URL + "/auth/v1/user", {
    headers: { apikey: SUPABASE_ANON_KEY, Authorization: "Bearer " + accessToken },
    signal: AbortSignal.timeout(10000),
  });
  if (!userResponse.ok) throw Object.assign(new Error("La sesión no es válida. Vuelve a entrar."), { status: 401 });
  const user = await userResponse.json();
  if (!user?.id) throw Object.assign(new Error("La sesión no es válida."), { status: 401 });
  const profileResponse = await fetch(
    SUPABASE_URL + "/rest/v1/profiles?id=eq." + encodeURIComponent(user.id) + "&select=role&limit=1",
    { headers: { apikey: SUPABASE_ANON_KEY, Authorization: "Bearer " + accessToken },
      signal: AbortSignal.timeout(10000) },
  );
  if (!profileResponse.ok) throw Object.assign(new Error("No se pudo comprobar el rol de administrador."), { status: 503 });
  const profiles = await profileResponse.json();
  if (profiles?.[0]?.role !== "admin") throw Object.assign(new Error("Solo el administrador puede autorizar recargas."), { status: 403 });
  return { userId: user.id };
}
async function serviceRpc(name: string, body: Record<string, unknown>) {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) throw new Error("La conexión interna de Supabase no está configurada.");
  const response = await fetch(SUPABASE_URL + "/rest/v1/rpc/" + name, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: SUPABASE_SERVICE_ROLE_KEY,
      Authorization: "Bearer " + SUPABASE_SERVICE_ROLE_KEY,
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(15000),
  });
  const raw = await response.text();
  let data: any = null;
  try { data = raw ? JSON.parse(raw) : null; } catch { data = null; }
  if (!response.ok) {
    const message = typeof data?.message === "string" ? data.message
      : typeof data?.details === "string" ? data.details : "Error interno HTTP " + response.status;
    throw new Error(message);
  }
  return data;
}
async function finishOrder(args: {
  orderId: string; status: string; providerOrderId?: string | null;
  referenceCode?: string | null; requestId?: string | null;
  response?: unknown; errorCode?: string | null; errorMessage?: string | null;
}) {
  return await serviceRpc("finish_central_one_order", {
    p_order_id: args.orderId,
    p_provider_status: args.status,
    p_provider_order_id: args.providerOrderId ?? null,
    p_reference_code: args.referenceCode ?? null,
    p_request_id: args.requestId ?? null,
    p_response: args.response ?? null,
    p_error_code: args.errorCode ?? null,
    p_error_message: args.errorMessage ?? null,
  });
}
async function preflightPriceAndStock(claim: any) {
  // The claim RPC locks the order and returns its exact price/payment method.
  // Reuse those values instead of making a second PostgREST request.
  if (claim.order_price === null || claim.order_price === undefined || !claim.payment_method) {
    return { ok:false, code:"order_price_data_missing", message:"La autorización no recibió el precio y método de pago del pedido. No se enviará la recarga." };
  }

  const settingsUrl = new URL(SUPABASE_URL + "/rest/v1/pricing_settings");
  settingsUrl.searchParams.set("id", "eq.1");
  settingsUrl.searchParams.set("select", "usdt_cup_rate,mobile_credit_units,mobile_cost_cup,markup_percent");
  settingsUrl.searchParams.set("limit", "1");
  const settingsResponse = await fetch(settingsUrl, {
    headers: { apikey: SUPABASE_SERVICE_ROLE_KEY, Authorization: "Bearer " + SUPABASE_SERVICE_ROLE_KEY },
    signal: AbortSignal.timeout(10000),
  });
  if (!settingsResponse.ok) return { ok:false, code:"pricing_settings_unavailable", message:"No pudimos leer las reglas de precios guardadas." };
  const settingsRows = await settingsResponse.json();
  const settings = Array.isArray(settingsRows) ? settingsRows[0] : null;
  if (!settings) return { ok:false, code:"pricing_settings_missing", message:"No existen reglas de precios para comprobar el margen." };

  const catalogResponse = await fetch(CENTRAL_ONE_BASE + "/catalog", {
    headers: { Authorization: "Bearer " + CENTRAL_ONE_API_KEY },
    signal: AbortSignal.timeout(20000),
  });
  const catalogRaw = await catalogResponse.text();
  let catalogData: any = null;
  try { catalogData = catalogRaw ? JSON.parse(catalogRaw) : null; } catch { catalogData = null; }
  if (!catalogResponse.ok) {
    const err = providerError(catalogData);
    return { ok:false, code:err.code, message:"No pudimos actualizar el catálogo de Central One: " + err.message };
  }
  // Accept both documented response envelopes used by Central One integrations.
  // The catalog sync already normalizes these two shapes; the order preflight must
  // use the same normalization or it could falsely reject a product that is present.
  const catalogItems = Array.isArray(catalogData?.items)
    ? catalogData.items
    : Array.isArray(catalogData?.data?.items)
      ? catalogData.data.items
      : [];
  const item = catalogItems.find((x: any) => x?.product_id === claim.provider_product_id);
  if (!item || item.status !== "active" || item.in_stock !== true) {
    return { ok:false, code:"provider_product_unavailable", message:"Central One no tiene este paquete disponible ahora. No se ha enviado ni cobrado la recarga." };
  }
  if (String(item.region || "").toUpperCase() !== String(claim.provider_region || "").toUpperCase()) {
    return { ok:false, code:"provider_region_changed", message:"La región del paquete cambió en Central One. La recarga quedó bloqueada." };
  }
  const liveFields = item.target_fields;
  const liveSchema = item.target_schema;
  const liveTarget = providerTargetConfig(liveFields, liveSchema);
  const storedTarget = providerTargetConfig(claim.provider_target_fields, claim.provider_target_schema);
  // Validate the live provider schema against the saved product schema.
  // Mobile Legends requires both player ID and Zone ID; Free Fire keeps player_id only.
  if (item.requires_target !== true || !liveTarget.ok || !storedTarget.ok ||
      liveTarget.playerKey !== storedTarget.playerKey ||
      liveTarget.zoneKey !== storedTarget.zoneKey) {
    return { ok:false, code:"provider_target_schema_changed", message:"Los datos obligatorios del paquete cambiaron en Central One. La compra quedó bloqueada para evitar una recarga equivocada." };
  }

  const wholesale = Number(item.reseller_price);
  const rate = Number(settings.usdt_cup_rate);
  const mobileUnits = Number(settings.mobile_credit_units);
  const mobileCost = Number(settings.mobile_cost_cup);
  const markup = Number(settings.markup_percent);
  const salePrice = Number(claim.order_price);
  if (!Number.isFinite(wholesale) || wholesale <= 0 || !Number.isFinite(rate) || rate <= 0 ||
      !Number.isFinite(mobileUnits) || mobileUnits <= 0 || !Number.isFinite(mobileCost) || mobileCost <= 0 ||
      !Number.isFinite(markup) || markup < 0 || !Number.isFinite(salePrice) || salePrice <= 0) {
    return { ok:false, code:"invalid_price_data", message:"Faltan datos válidos para comprobar el margen. No se enviará la recarga." };
  }
  if (String(item.currency || "").toUpperCase() !== "USD") {
    return { ok:false, code:"unsupported_provider_currency", message:"La moneda del coste mayorista cambió. Se bloqueó la recarga para evitar un cálculo incorrecto." };
  }

  let retailCup: number;
  const method = String(claim.payment_method || "");
  if (method === "Transferencia CUP" || method === "Billetera CUP") retailCup = salePrice;
  else if (method === "Saldo móvil") retailCup = salePrice * mobileCost / mobileUnits;
  else if (method === "USDT" || method === "Saldo de Tienda El Castillo") retailCup = salePrice * rate;
  else return { ok:false, code:"unsupported_payment_method", message:"No reconocemos la moneda de cobro del pedido. No se enviará la recarga." };

  const wholesaleCup = wholesale * rate;
  const grossProfitCup = retailCup - wholesaleCup;
  const roundedProfitCup = Number(grossProfitCup.toFixed(2));
  const actualMarkup = (grossProfitCup / wholesaleCup) * 100;
  const requiredRetailCup = wholesaleCup * (1 + markup / 100);
  const priceCheck = {
    payment_method: method,
    customer_retail_cup: Number(retailCup.toFixed(2)),
    provider_wholesale_usd: Number(wholesale.toFixed(4)),
    usdt_cup_rate: Number(rate.toFixed(2)),
    provider_cost_cup: Number(wholesaleCup.toFixed(2)),
    gross_profit_cup: roundedProfitCup,
    margin_percent: Number(actualMarkup.toFixed(2)),
    target_markup_percent: Number(markup.toFixed(2)),
    target_retail_cup: Number(requiredRetailCup.toFixed(2)),
    is_profitable: roundedProfitCup > 0,
    below_target_margin: actualMarkup < markup,
  };

  // Hard stop at zero or negative profit after rounding to the smallest CUP precision.
  if (roundedProfitCup <= 0) {
    const resultMessage = roundedProfitCup < 0
      ? "Resultado: pérdida de " + Math.abs(roundedProfitCup).toFixed(2) + " CUP."
      : "Resultado: el cliente pagó exactamente lo que cuesta la recarga; no hay beneficio (0.00 CUP).";
    return {
      ok:false,
      code:"provider_cost_not_covered",
      message:"ALERTA: operación no rentable. El cliente pagó " + retailCup.toFixed(2) +
        " CUP y Central One cobra " + wholesaleCup.toFixed(2) +
        " CUP al cambio de " + rate.toFixed(2) + " CUP/USDT. " +
        resultMessage + " La recarga NO se enviará a Central One.",
      wholesale_price: String(item.reseller_price),
      required_retail_cup: Number(requiredRetailCup.toFixed(2)),
      actual_retail_cup: Number(retailCup.toFixed(2)),
      price_check: priceCheck,
    };
  }

  // The configured markup is used to calculate storefront prices, not as a
  // retroactive cancellation threshold after a customer has paid.
  // A live provider price increase may reduce the expected markup; continue
  // whenever the order still produces positive gross profit. The zero/negative
  // profit hard stop above remains in force.


  const balanceCheck = await checkProviderAvailableBalance(wholesale);
  const auditedPriceCheck = {
    ...priceCheck,
    provider_balance_available: balanceCheck.available ?? null,
    provider_balance_required: balanceCheck.required ?? Number(wholesale.toFixed(4)),
    provider_balance_currency: balanceCheck.currency ?? "USDT",
    provider_balance_sufficient: balanceCheck.ok === true,
  };
  if (!balanceCheck.ok) {
    return {
      ok:false,
      code:balanceCheck.code,
      message:balanceCheck.message,
      wholesale_price:String(item.reseller_price),
      required_retail_cup:Number(requiredRetailCup.toFixed(2)),
      actual_retail_cup:Number(retailCup.toFixed(2)),
      price_check:auditedPriceCheck,
      balance_check:balanceCheck,
    };
  }
  return {
    ok:true,
    wholesale_price: String(item.reseller_price),
    currency: String(item.currency),
    retail_cup: Number(retailCup.toFixed(2)),
    margin_percent: Number(actualMarkup.toFixed(2)),
    price_check: auditedPriceCheck,
    balance_check: balanceCheck,
    warning: priceCheck.below_target_margin
      ? "El pedido deja beneficio, pero el margen está por debajo del objetivo configurado de " + markup.toFixed(2) + " %."
      : null,
  };
}

async function submitOrder(orderId: string, adminId: string) {
  const claim = await serviceRpc("claim_central_one_order", { p_order_id: orderId, p_admin_id: adminId });
  if (claim?.claim_status === "already_submitted") {
    return reply(200, {
      ok: true, already_submitted: true,
      provider_order_id: claim.provider_order_id,
      reference_code: claim.reference_code,
      provider_status: claim.provider_status,
      message: "Este pedido ya fue enviado a Central One. No se creó una segunda recarga.",
    });
  }
  if (claim?.claim_status === "in_progress") {
    return reply(409, { error: "submission_in_progress", message: "La solicitud anterior todavía se está procesando. No vuelvas a autorizarla ahora." });
  }
  if (claim?.claim_status !== "claimed") {
    return reply(409, { error: "order_not_claimed", message: "No se pudo reservar la autorización de este pedido." });
  }
  if (!CENTRAL_ONE_API_KEY) {
    await finishOrder({
      orderId,status:"rejected",
      errorCode:"api_key_missing",
      errorMessage:"Falta CENTRAL_ONE_API_KEY en los secretos de Supabase.",
      response:{preflight:"blocked",no_provider_order_created:true,blocked_reason:"api_key_missing"},
    });
    return reply(503, {error:"central_one_not_configured",message:"No se encontró la clave de Central One. No se envió la compra."});
  }
  const fields = claim.provider_target_fields;
  const schema = claim.provider_target_schema;
  const target = providerTargetConfig(fields, schema);
  if (!target.ok || !target.playerKey) {
    await finishOrder({
      orderId,status:"rejected",
      errorCode:"unsupported_target_schema",
      errorMessage:"El proveedor cambió los datos obligatorios del producto. La compra fue bloqueada.",
      response:{preflight:"blocked",no_provider_order_created:true,blocked_reason:"unsupported_target_schema"},
    });
    return reply(409, {error:"unsupported_target_schema",message:"Los datos requeridos del paquete cambiaron. La recarga fue bloqueada para evitar un envío incorrecto."});
  }
  const targetId = String(claim.player_id || "").trim();
  const targetParts = target.zoneKey ? targetId.split("::") : [targetId];
  const playerId = String(targetParts[0] || "").trim();
  const zoneId = target.zoneKey ? String(targetParts[1] || "").trim() : "";
  if (targetParts.length !== (target.zoneKey ? 2 : 1) ||
      playerId.length < 3 || playerId.length > 64 ||
      (target.zoneKey && (!zoneId || zoneId.length > 24))) {
    await finishOrder({
      orderId,status:"rejected",
      errorCode:"invalid_player_target",
      errorMessage:"El ID y el Zone ID no cumplen el formato esperado.",
      response:{preflight:"blocked",no_provider_order_created:true,blocked_reason:"invalid_player_target"},
    });
    return reply(400, {error:"invalid_player_target",message:"El ID del jugador o el Zone ID no son válidos."});
  }
  const targetPayload: Record<string,string> = { [target.playerKey]: playerId };
  if (target.zoneKey) targetPayload[target.zoneKey] = zoneId;
  let preflight: any;
  try {
    preflight = await preflightPriceAndStock(claim);
  } catch {
    preflight = {ok:false,code:"preflight_unavailable",message:"No pudimos comprobar el catálogo, el margen o el saldo de Central One. No se ha enviado la recarga; puedes intentarlo de nuevo."};
  }
  if (!preflight.ok) {
    await finishOrder({
      orderId, status:"retryable",
      errorCode:preflight.code,
      errorMessage:preflight.message,
      response:{
        preflight:"blocked",
        no_provider_order_created:true,
        required_retail_cup:preflight.required_retail_cup??null,
        actual_retail_cup:preflight.actual_retail_cup??null,
        price_check:preflight.price_check??null,
        balance_check:preflight.balance_check??null,
        warning:preflight.warning??null,
      },
    });
    return reply(409, {
      error:preflight.code, message:preflight.message,
      retryable:true, no_provider_order_created:true,
      price_check:preflight.price_check??null,
      balance_check:preflight.balance_check??null,
      warning:preflight.warning??null,
    });
  }
  const requestBody = {
    items: [{
      catalog_item_id: claim.provider_product_id,
      quantity: 1,
      target_payload: targetPayload,
    }],
    note: "Tienda El Castillo " + String(claim.order_code || orderId),
  };
  try {
    const upstream = await fetch(CENTRAL_ONE_BASE + "/orders", {
      method: "POST",
      headers: {
        Authorization: "Bearer " + CENTRAL_ONE_API_KEY,
        "Content-Type": "application/json",
        "Idempotency-Key": claim.idempotency_key,
      },
      body: JSON.stringify(requestBody),
      signal: AbortSignal.timeout(25000),
    });
    const raw = await upstream.text();
    let data: any = null;
    try { data = raw ? JSON.parse(raw) : null; } catch { data = null; }
    const requestId = upstream.headers.get("X-Request-Id") ||
      data?.request_id || data?.order?.request_id || data?.error?.request_id || null;
    if (!upstream.ok) {
      const err = providerError(data);
      const errorText = (String(err.code || "") + " " + String(err.message || "")).toLowerCase();
      const insufficientBalance =
        /insufficient.{0,40}(balance|funds)|(?:balance|funds).{0,40}insufficient|not enough.{0,30}(balance|funds)|saldo.{0,40}(insuficiente|no alcanza|suficiente)|fondos.{0,40}insuficientes|sin saldo suficiente/.test(errorText);
      const retryState = insufficientBalance || upstream.status === 409 || upstream.status === 429 ||
        upstream.status === 500 || upstream.status === 502 || upstream.status === 503 ||
        upstream.status === 504;
      const errorCode = insufficientBalance ? "central_one_insufficient_balance" :
        (upstream.status === 401 || upstream.status === 403 ? "provider_api_permission_denied" : err.code);
      const errorMessage = insufficientBalance
        ? "Central One rechazó el pedido por saldo insuficiente. " + err.message +
          " Recarga el saldo del proveedor y reintenta este mismo pedido; no crees otro ni vuelvas a cobrar al cliente."
        : (upstream.status === 401 || upstream.status === 403
          ? "Central One denegó la operación. Comprueba los permisos orders:write y balance:read de la llave API. " + err.message
          : err.message);
      await finishOrder({
        orderId, status: retryState ? "retryable" : "rejected",
        requestId, errorCode, errorMessage,
        response: {
          http_status: upstream.status,
          error: {code:errorCode,message:errorMessage},
          no_provider_order_created:true,
          price_check: preflight.price_check,
          balance_check: preflight.balance_check,
        },
      });
      return reply(upstream.status >= 500 ? 502 : upstream.status, {
        error: errorCode, message: errorMessage, request_id: requestId,
        retryable: retryState, no_provider_order_created:true,
      });
    }
    const providerOrder = data?.order;
    const providerOrderId = typeof providerOrder?.id === "string" &&
      /^[0-9a-f-]{36}$/i.test(providerOrder.id) ? providerOrder.id : null;
    const providerStatus = typeof providerOrder?.status === "string" &&
      ["created","confirmed","processing","partially_completed","completed","failed","cancelled"].includes(providerOrder.status)
        ? providerOrder.status : "unknown";
    if (!providerOrderId) {
      await finishOrder({
        orderId, status:"unknown", requestId,
        errorCode:"missing_provider_order_id",
        errorMessage:"Central One respondió sin un ID de orden reconocible. Reintentar es seguro porque se conserva la misma clave de idempotencia.",
        response:{http_status:upstream.status, provider_status:providerStatus, price_check:preflight.price_check},
      });
      return reply(502, {error:"provider_response_incomplete",message:"Central One respondió, pero no pudimos leer el ID de su pedido. No crees otro pedido; reintenta el mismo más tarde.",request_id:requestId});
    }
    const refund = providerRefundInfo(providerOrder);
    const saved = await finishOrder({
      orderId, status:providerStatus, providerOrderId,
      referenceCode:typeof providerOrder.reference_code==="string"?providerOrder.reference_code:null,
      requestId, response:{
        status:providerStatus,
        reference_code:typeof providerOrder.reference_code==="string"?providerOrder.reference_code:null,
        currency:typeof providerOrder.currency==="string"?providerOrder.currency:null,
        price_check:preflight.price_check,
        balance_check:preflight.balance_check,
        warning:preflight.warning,
        refund,
        failure:providerOrder?.failure && typeof providerOrder.failure==="object" ? {
          code:typeof providerOrder.failure.code==="string"?providerOrder.failure.code:null,
          message_es:typeof providerOrder.failure.message_es==="string"?providerOrder.failure.message_es.slice(0,400):null,
          action:typeof providerOrder.failure.action==="string"?providerOrder.failure.action:null,
        } : null,
      },
      errorCode:providerOrder?.failure?.code||null,
      errorMessage:providerOrder?.failure?.message_es||null,
    });
    let walletRefund = null;
    let walletRefundError = null;
    try {
      walletRefund = await applyConfirmedWalletRefund(orderId,providerOrderId,providerStatus,refund);
    } catch (refundError) {
      walletRefundError = refundError instanceof Error ? refundError.message : "No se pudo acreditar la devolución interna.";
    }
    return reply(200, {
      ok:true,provider_order_id:providerOrderId,
      reference_code:providerOrder.reference_code||null,
      provider_status:providerStatus,
      provider_total_sale_amount:typeof providerOrder.total_sale_amount==="string"?providerOrder.total_sale_amount:null,
      provider_currency:typeof providerOrder.currency==="string"?providerOrder.currency:null,
      preflight_margin_percent:preflight.margin_percent,
      price_check:preflight.price_check,
      balance_check:preflight.balance_check,
      refund,
      wallet_refund:walletRefund,
      wallet_refund_error:walletRefundError,
      warning:preflight.warning,local:saved
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Fallo de comunicación con Central One.";
    try {
      await finishOrder({orderId,status:"unknown",errorCode:"network_or_timeout",errorMessage:message.slice(0,500),response:{outcome_unknown:true,price_check:preflight.price_check}});
    } catch { /* the stable idempotency key remains stored by the claim operation */ }
    return reply(504, {
      error:"provider_result_unknown",
      message:"No pudimos confirmar la respuesta de Central One. No crees un segundo pedido; la misma clave de idempotencia protege el reintento.",
    });
  }
}
async function refreshOrder(orderId: string) {
  if (!CENTRAL_ONE_API_KEY) return reply(503,{error:"central_one_not_configured",message:"Falta la clave de Central One."});
  const lookup = new URL(SUPABASE_URL + "/rest/v1/orders");
  lookup.searchParams.set("id","eq." + orderId);
  lookup.searchParams.set("select","id,central_one_order_id,central_one_reference_code,central_one_status,status,central_one_response,payment_source");
  lookup.searchParams.set("limit","1");
  const localResponse = await fetch(lookup, {
    headers:{apikey:SUPABASE_SERVICE_ROLE_KEY,Authorization:"Bearer " + SUPABASE_SERVICE_ROLE_KEY},
    signal:AbortSignal.timeout(10000),
  });
  if (!localResponse.ok) return reply(503,{error:"local_order_lookup_failed",message:"No se pudo consultar el pedido en la base de datos."});
  const localRows = await localResponse.json();
  const local = Array.isArray(localRows)?localRows[0]:null;
  if (!local?.central_one_order_id) return reply(409,{error:"provider_order_missing",message:"Este pedido todavía no tiene una orden de Central One."});
  const upstream = await fetch(CENTRAL_ONE_BASE + "/orders/" + local.central_one_order_id,{
    headers:{Authorization:"Bearer " + CENTRAL_ONE_API_KEY},
    signal:AbortSignal.timeout(20000),
  });
  const raw = await upstream.text();
  let data: any = null;
  try{data=raw?JSON.parse(raw):null;}catch{data=null;}
  const requestId=upstream.headers.get("X-Request-Id")||data?.request_id||data?.order?.request_id||null;
  if(!upstream.ok){
    const err=providerError(data);
    await finishOrder({orderId,status:local.central_one_status||"unknown",requestId,errorCode:err.code,errorMessage:err.message});
    return reply(upstream.status>=500?502:upstream.status,{error:err.code,message:err.message,request_id:requestId});
  }
  const order=data?.order;
  if(!order || order.id!==local.central_one_order_id || typeof order.status!=="string"){
    return reply(502,{error:"invalid_provider_order_response",message:"Central One devolvió un pedido que no pudimos verificar."});
  }
  const providerStatus=["created","confirmed","processing","partially_completed","completed","failed","cancelled"].includes(order.status)?order.status:"unknown";
  const refund = providerRefundInfo(order);
  const safe = {
    status:providerStatus,
    reference_code:typeof order.reference_code==="string"?order.reference_code:null,
    updated_at:typeof order.updated_at==="string"?order.updated_at:null,
    refund,
    price_check:local.central_one_response?.price_check??null,
    balance_check:local.central_one_response?.balance_check??null,
    warning:local.central_one_response?.warning??null,
    failure:order?.failure&&typeof order.failure==="object"?{
      code:typeof order.failure.code==="string"?order.failure.code:null,
      message_es:typeof order.failure.message_es==="string"?order.failure.message_es.slice(0,400):null,
      action:typeof order.failure.action==="string"?order.failure.action:null,
    }:null,
    items:Array.isArray(order.items)?order.items.map((item:any)=>({
      status:typeof item?.status==="string"?item.status:null,
      delivered_count:Number.isInteger(item?.delivered_count)?item.delivered_count:null,
      failure:item?.failure&&typeof item.failure==="object"?{
        code:typeof item.failure.code==="string"?item.failure.code:null,
        message_es:typeof item.failure.message_es==="string"?item.failure.message_es.slice(0,400):null,
        action:typeof item.failure.action==="string"?item.failure.action:null,
      }:null,
      refund:item?.refund&&typeof item.refund==="object"?{
        refunded:item.refund.refunded===true,
        refunded_at:typeof item.refund.refunded_at==="string"?item.refund.refunded_at:null,
      }:null,
    })):[],
  };
  const saved=await finishOrder({
    orderId,status:providerStatus,providerOrderId:local.central_one_order_id,
    referenceCode:typeof order.reference_code==="string"?order.reference_code:null,
    requestId,response:safe,
    errorCode:order?.failure?.code||null,
    errorMessage:order?.failure?.message_es||null,
  });
  let walletRefund = null;
  let walletRefundError = null;
  try {
    walletRefund = await applyConfirmedWalletRefund(orderId,local.central_one_order_id,providerStatus,refund);
  } catch (refundError) {
    walletRefundError = refundError instanceof Error ? refundError.message : "No se pudo acreditar la devolución interna.";
  }
  return reply(200,{
    ok:true,provider_status:providerStatus,reference_code:order.reference_code||null,
    wallet_refund:walletRefund,wallet_refund_error:walletRefundError,
    local:saved,details:safe
  });
}
Deno.serve(async (req: Request) => {
  if(req.method==="OPTIONS") return new Response("ok",{headers:corsHeaders});
  if(req.method!=="POST") return reply(405,{error:"method_not_allowed"});
  if(!SUPABASE_URL||!SUPABASE_ANON_KEY||!SUPABASE_SERVICE_ROLE_KEY) return reply(503,{error:"backend_not_configured"});
  try{
    const context=await adminContext(req);
    const body=await req.json().catch(()=>({}));
    const action=body?.action;
    const orderId=typeof body?.order_id==="string"?body.order_id:"";
    if(!/^[0-9a-f-]{36}$/i.test(orderId)) return reply(400,{error:"invalid_order_id",message:"El identificador del pedido no es válido."});
    if(action==="submit") return await submitOrder(orderId,context.userId);
    if(action==="refresh") return await refreshOrder(orderId);
    return reply(400,{error:"unsupported_action",allowed_actions:["submit","refresh"]});
  }catch(error){
    const status=Number((error as any)?.status)||400;
    return reply(status,{error:"central_one_order_failed",message:error instanceof Error?error.message:"No se pudo procesar la solicitud."});
  }
});
