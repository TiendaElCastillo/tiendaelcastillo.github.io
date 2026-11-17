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

function getPlayerName(data: any): string | null {
  const candidates = [
    data?.player_name,
    data?.playerName,
    data?.nickname,
    data?.username,
    data?.name,
    data?.player?.name,
    data?.player?.nickname,
    data?.data?.player_name,
    data?.data?.playerName,
    data?.data?.nickname,
    data?.data?.name,
    data?.data?.player?.name,
    data?.result?.player_name,
    data?.result?.name,
  ];
  const value = candidates.find((item) => typeof item === "string" && item.trim().length > 0);
  return typeof value === "string" ? value.trim().slice(0, 100) : null;
}

function providerValidationFlag(data: any): boolean | null {
  const candidates = [
    data?.valid,
    data?.is_valid,
    data?.data?.valid,
    data?.data?.is_valid,
    data?.result?.valid,
    data?.result?.is_valid,
  ];
  for (const value of candidates) {
    if (typeof value === "boolean") return value;
  }
  const status = String(data?.status ?? data?.data?.status ?? data?.result?.status ?? "").toLowerCase();
  if (["valid", "success", "ok", "verified"].includes(status)) return true;
  if (["invalid", "failed", "error", "not_found", "not found"].includes(status)) return false;
  const success = data?.success ?? data?.data?.success ?? data?.result?.success;
  if (success === false) return false;
  if (success === true) return true;
  return null;
}

function providerTargetConfig(game: string, fields: unknown, schema: unknown): {ok:boolean;playerKey:string|null;zoneKey:string|null} {
  if (!Array.isArray(fields) || !Array.isArray(schema)) return {ok:false,playerKey:null,zoneKey:null};
  if (fields.length === 1 && ["player_id","game_user_id"].includes(String(fields[0]))) {
    return {ok:true,playerKey:String(fields[0]),zoneKey:null};
  }
  if (String(game || "").trim().toLowerCase() !== "mobile legends: bang bang" || fields.length !== 2 || schema.length !== 2) {
    return {ok:false,playerKey:null,zoneKey:null};
  }
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

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return reply(405, { error: "method_not_allowed" });

  const auth = (req.headers.get("Authorization") || "").match(/^Bearer\s+(.+)$/i);
  if (!auth) return reply(401, { error: "authentication_required" });
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !SUPABASE_SERVICE_ROLE_KEY || !CENTRAL_ONE_API_KEY) {
    return reply(503, { error: "validation_not_configured" });
  }

  try {
    const accessToken = auth[1];
    const userResponse = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
      headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${accessToken}` },
      signal: AbortSignal.timeout(10000),
    });
    if (!userResponse.ok) return reply(401, { error: "invalid_session" });
    const user = await userResponse.json();
    if (!user?.id) return reply(401, { error: "invalid_session" });

    const body = await req.json().catch(() => ({}));
    const productId = typeof body?.product_id === "string" ? body.product_id.trim() : "";
    const playerId = typeof body?.player_id === "string" ? body.player_id.trim() : "";
    const zoneId = typeof body?.zone_id === "string" ? body.zone_id.trim() : "";
    if (!/^[0-9a-f-]{36}$/i.test(productId)) return reply(400, { error: "invalid_product" });
    if (playerId.length < 3 || playerId.length > 64) return reply(400, { error: "invalid_player_id" });

    const productUrl = new URL(`${SUPABASE_URL}/rest/v1/products`);
    productUrl.searchParams.set("id", `eq.${productId}`);
    productUrl.searchParams.set("select", "id,game,name,active,storefront_visible,provider_product_id,provider_region,provider_status,provider_in_stock,provider_requires_target,provider_target_fields,provider_target_schema,provider_validation_supported");
    productUrl.searchParams.set("limit", "1");
    const productResponse = await fetch(productUrl, {
      headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${accessToken}` },
      signal: AbortSignal.timeout(10000),
    });
    if (!productResponse.ok) return reply(503, { error: "product_lookup_failed" });
    const products = await productResponse.json();
    const product = Array.isArray(products) ? products[0] : null;
    if (!product || !product.active || product.storefront_visible !== true || !product.provider_product_id) {
      return reply(404, { error: "product_unavailable", message: "Este paquete no está disponible para pedidos." });
    }
    if (!product.provider_validation_supported) {
      return reply(409, {
        error: "region_validation_unavailable",
        region: product.provider_region,
        message: "Central One todavía no habilita la validación de ID para esta región. No se puede crear el pedido.",
      });
    }
    if (String(product.provider_status).toLowerCase() !== "active" || product.provider_in_stock !== true) {
      return reply(409, { error: "product_out_of_stock", message: "Central One no marca este paquete como disponible." });
    }

    const region = String(product.provider_region || "").toUpperCase();
    if (String(product.game || "").trim().toLowerCase() === "mobile legends: bang bang" && region !== "GLOBAL") {
      return reply(409, {
        error: "mobile_legends_global_only",
        region,
        message: "Tienda El Castillo solo ofrece Mobile Legends en la región GLOBAL. Selecciona un paquete GLOBAL.",
      });
    }
    const target = providerTargetConfig(product.game, product.provider_target_fields, product.provider_target_schema);
    if (!target.ok || !target.playerKey || product.provider_requires_target !== true) {
      return reply(409, { error: "player_id_not_supported", message: "El proveedor no ha definido campos compatibles de ID de jugador y servidor para este paquete." });
    }
    if (target.zoneKey && (!zoneId || zoneId.length > 24)) {
      return reply(400, { error: "invalid_zone_id", message: "Escribe el Zone ID del servidor antes de comprobar la cuenta.", region });
    }
    if (!target.zoneKey && zoneId) {
      return reply(400, { error: "unexpected_zone_id", message: "Este paquete no requiere Zone ID. Vuelve a comprobar los datos.", region });
    }
    const canonicalPlayerId = target.zoneKey ? playerId + "::" + zoneId : playerId;
    if (canonicalPlayerId.length > 64) {
      return reply(400, { error: "invalid_player_target", message: "La combinación de ID y Zone ID supera el límite permitido.", region });
    }
    const targetPayload: Record<string, string> = { [target.playerKey]: playerId };
    if (target.zoneKey) targetPayload[target.zoneKey] = zoneId;

    // This is a read/validation request only. It does not create an order or spend prepaid balance.
    const upstream = await fetch(`${CENTRAL_ONE_BASE}/player/validate`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${CENTRAL_ONE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        product_id: product.provider_product_id,
        target_payload: targetPayload,
      }),
      signal: AbortSignal.timeout(20000),
    });

    const raw = await upstream.text();
    let data: any;
    try { data = raw ? JSON.parse(raw) : {}; }
    catch { data = null; }

    if (!upstream.ok || !data || typeof data !== "object" || Array.isArray(data)) {
      const providerMessage = typeof data?.message === "string" ? data.message
        : typeof data?.error === "string" ? data.error
        : "Central One no pudo validar el ID en este momento.";
      return reply(502, {
        valid: false,
        error: "provider_validation_failed",
        provider_status: upstream.status,
        message: providerMessage.slice(0, 220),
        region,
      });
    }

    const valid = providerValidationFlag(data);
    const playerName = getPlayerName(data);
    if (valid !== true) {
      const providerMessage = typeof data?.message === "string" ? data.message
        : typeof data?.data?.message === "string" ? data.data.message
        : valid === false ? "Central One indicó que el ID no es válido para este producto o región."
        : "La respuesta del proveedor no confirmó la validez del ID. No se ha autorizado el pedido.";
      return reply(422, {
        valid: false,
        error: "player_id_not_confirmed",
        message: providerMessage.slice(0, 220),
        region,
      });
    }

    // Store a short-lived, single-use validation receipt. The raw player ID is
    // never stored; the database checks its SHA-256 hash when the order is inserted.
    const now = new Date();
    const validationToken = crypto.randomUUID();
    const playerIdBytes = new TextEncoder().encode(canonicalPlayerId);
    const playerIdDigest = await crypto.subtle.digest("SHA-256", playerIdBytes);
    const playerIdHash = Array.from(new Uint8Array(playerIdDigest))
      .map((byte) => byte.toString(16).padStart(2, "0"))
      .join("");
    const validationRecord = await fetch(`${SUPABASE_URL}/rest/v1/player_id_validations`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: SUPABASE_SERVICE_ROLE_KEY,
        Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
        Prefer: "return=minimal",
      },
      body: JSON.stringify({
        token: validationToken,
        user_id: user.id,
        product_id: product.id,
        provider_product_id: product.provider_product_id,
        region,
        player_id_hash: playerIdHash,
        player_name: playerName,
        validated_at: now.toISOString(),
        expires_at: new Date(now.getTime() + 10 * 60 * 1000).toISOString(),
      }),
      signal: AbortSignal.timeout(10000),
    });
    if (!validationRecord.ok) {
      return reply(503, {
        valid: false,
        error: "validation_receipt_unavailable",
        message: "Central One aceptó el ID, pero no pudimos asegurar el comprobante de validación. Vuelve a intentarlo; no se ha creado ningún pedido.",
      });
    }

    return reply(200, {
      valid: true,
      validation_token: validationToken,
      expires_in_seconds: 600,
      player_name: playerName,
      region,
      product_name: product.name,
      message: playerName
        ? "ID verificado por Central One. Comprueba que el nombre mostrado sea el de tu cuenta."
        : "Central One aceptó el ID. El proveedor no devolvió un nombre de jugador en esta respuesta.",
    });
  } catch {
    return reply(500, {
      error: "player_validation_error",
      message: "No se pudo completar la validación. No se ha creado ningún pedido ni se ha descontado saldo.",
    });
  }
});
