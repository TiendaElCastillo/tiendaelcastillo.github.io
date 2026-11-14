import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") || "";
const CENTRAL_ONE_API_KEY = Deno.env.get("CENTRAL_ONE_API_KEY") || "";
const CENTRAL_ONE_BASE = "https://portal.centraloneglobal.com/api/v1";

const headers = { "Content-Type": "application/json; charset=utf-8" };
function reply(status: number, payload: unknown) {
  return new Response(JSON.stringify(payload), { status, headers });
}

async function rpc(name: string, body: Record<string, unknown>) {
  const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${name}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "apikey": SUPABASE_ANON_KEY,
      "Authorization": `Bearer ${SUPABASE_ANON_KEY}`,
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(25000),
  });
  const raw = await response.text();
  let data: any = null;
  try { data = raw ? JSON.parse(raw) : null; } catch { data = raw; }
  if (!response.ok) {
    const reason = typeof data?.message === "string" ? data.message
      : typeof data?.hint === "string" ? data.hint
      : typeof data?.error === "string" ? data.error
      : `HTTP ${response.status}`;
    throw new Error(`Supabase RPC ${name} failed: ${reason}`);
  }
  return data;
}

function getItems(data: any): any[] | null {
  if (Array.isArray(data?.items)) return data.items;
  if (Array.isArray(data?.data?.items)) return data.data.items;
  return null;
}

function makeSignatureRows(items: any[]) {
  const rows = items.map((item: any) => ({
    product_id: item?.product_id ?? null,
    sku: item?.sku ?? null,
    name: item?.name ?? null,
    category: item?.category ?? null,
    product_type: item?.product_type ?? null,
    product_family_id: item?.product_family_id ?? null,
    product_family_name: item?.product_family_name ?? null,
    market: item?.market ?? null,
    region: item?.region ?? null,
    currency: item?.currency ?? null,
    reseller_price: item?.reseller_price ?? null,
    status: item?.status ?? null,
    in_stock: item?.in_stock ?? null,
    available_stock: item?.available_stock ?? null,
    requires_target: item?.requires_target ?? null,
    target_fields: item?.target_fields ?? null,
    target_schema: item?.target_schema ?? null,
    price_updated_at: item?.price_updated_at ?? null,
    updated_at: item?.updated_at ?? null,
  }));
  rows.sort((a, b) =>
    String(a.product_id ?? a.sku ?? a.name).localeCompare(
      String(b.product_id ?? b.sku ?? b.name),
    )
  );
  return rows;
}

async function sha256Hex(value: unknown): Promise<string> {
  const bytes = new TextEncoder().encode(JSON.stringify(value));
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { status: 200 });
  if (req.method !== "POST") return reply(405, { error: "method_not_allowed" });

  const token = req.headers.get("x-sync-token") || "";
  if (!token) return reply(401, { error: "sync_auth_required" });
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !CENTRAL_ONE_API_KEY) {
    return reply(503, { error: "sync_not_configured" });
  }

  try {
    const allowed = await rpc("authorize_central_one_sync", { p_token: token });
    if (allowed !== true) return reply(401, { error: "invalid_sync_auth" });

    const requestBody = await req.json().catch(() => ({}));
    const action = requestBody?.action || "catalog";
    if (action === "coverage") {
      const coverageResponse = await fetch(`${CENTRAL_ONE_BASE}/player/validate/coverage`, {
        method: "GET",
        headers: { "Authorization": `Bearer ${CENTRAL_ONE_API_KEY}` },
        signal: AbortSignal.timeout(20000),
      });
      const coverageRaw = await coverageResponse.text();
      let coverageData: unknown;
      try { coverageData = coverageRaw ? JSON.parse(coverageRaw) : {}; }
      catch { coverageData = { message: "Respuesta no JSON del proveedor" }; }
      return reply(coverageResponse.ok ? 200 : 502, {
        ok: coverageResponse.ok,
        provider_status: coverageResponse.status,
        data: coverageData,
      });
    }
    if (action !== "catalog") {
      return reply(400, { error: "unsupported_action", allowed_actions: ["catalog", "coverage"] });
    }

    const upstream = await fetch(`${CENTRAL_ONE_BASE}/catalog`, {
      method: "GET",
      headers: { "Authorization": `Bearer ${CENTRAL_ONE_API_KEY}` },
      signal: AbortSignal.timeout(60000),
    });

    const raw = await upstream.text();
    let data: any;
    try { data = raw ? JSON.parse(raw) : {}; }
    catch { data = null; }

    const items = getItems(data);
    if (!upstream.ok || !data || typeof data !== "object" || Array.isArray(data) || !items) {
      const detail = typeof data?.message === "string" ? data.message
        : typeof data?.error === "string" ? data.error
        : raw.slice(0, 300) || upstream.statusText || "Respuesta inválida del proveedor";
      try {
        await rpc("record_central_one_sync_failure", {
          p_token: token,
          p_provider_status: upstream.status,
          p_error: detail,
        });
      } catch { /* Keep response free of secrets. */ }
      return reply(502, {
        ok: false,
        provider_status: upstream.status,
        error: "central_one_catalog_failed",
        message: detail,
      });
    }

    // Retrieve the provider's real-time validation coverage before publishing
    // any product. A catalog entry alone is not proof that its player ID can be checked.
    const coverageResponse = await fetch(`${CENTRAL_ONE_BASE}/player/validate/coverage`, {
      method: "GET",
      headers: { "Authorization": `Bearer ${CENTRAL_ONE_API_KEY}` },
      signal: AbortSignal.timeout(20000),
    });
    const coverageRaw = await coverageResponse.text();
    let coverageEnvelope: any;
    try { coverageEnvelope = coverageRaw ? JSON.parse(coverageRaw) : {}; }
    catch { coverageEnvelope = null; }
    const coverageProducts = Array.isArray(coverageEnvelope?.products)
      ? coverageEnvelope.products
      : Array.isArray(coverageEnvelope?.data?.products)
        ? coverageEnvelope.data.products
        : null;
    if (!coverageResponse.ok || !coverageProducts) {
      try {
        await rpc("record_central_one_sync_failure", {
          p_token: token,
          p_provider_status: coverageResponse.status,
          p_error: "Central One no devolvió cobertura válida de verificación de jugador. Se mantiene el catálogo público anterior.",
        });
      } catch { /* Keep response free of secrets. */ }
      return reply(502, {
        ok: false,
        error: "validation_coverage_unavailable",
        message: "No se pudo confirmar la cobertura de validación de IDs. Se conserva la publicación anterior.",
      });
    }

    const freeFireItems = items.filter((item: any) => {
      const family = String(item?.product_family_id || item?.product_family_name || "").toLowerCase();
      const name = String(item?.name || "").toLowerCase();
      const region = String(item?.region || "").toUpperCase();
      return (family === "free-fire" || family === "free fire" || name.includes("free fire"))
        && String(item?.product_type || "").toLowerCase() === "game_topup"
        && ["LATAM", "ID"].includes(region);
    });

    const mobileLegendsItems = items.filter((item: any) => {
      const searchable = [
        item?.product_family_id, item?.product_family_name, item?.game,
        item?.category, item?.name, item?.sku,
      ].filter(Boolean).join(" ").toLowerCase();
      return /mobile[\s_-]*legends?|mlbb/.test(searchable)
        && String(item?.product_type || "").toLowerCase() === "game_topup"
        && String(item?.region || "").toUpperCase() === "GLOBAL";
    });

    const bloodStrikeItems = items.filter((item: any) => {
      const searchable = [
        item?.product_family_id, item?.product_family_name, item?.game,
        item?.category, item?.name, item?.sku,
      ].filter(Boolean).join(" ").toLowerCase();
      return /blood[\s_-]*strike/.test(searchable)
        && String(item?.product_type || "").toLowerCase() === "game_topup"
        && String(item?.region || "").toUpperCase() === "GLOBAL";
    });

    // Import only non-login game top-ups from GLOBAL/LATAM products that
    // Central One currently includes in its player-validation coverage.
    // Existing Free Fire, Blood Strike and Mobile Legends catalogs are excluded.
    const coverageIds = new Set(
      coverageProducts.map((entry: any) => String(entry?.product_id || "")).filter(Boolean)
    );
    const additionalGameItems = items.filter((item: any) => {
      const family = String(
        item?.product_family_name || item?.product_family_id || item?.game || item?.category || ""
      ).trim().toLowerCase();
      const region = String(item?.region || "").toUpperCase();
      const fields = Array.isArray(item?.target_fields) ? item.target_fields : [];
      const schema = Array.isArray(item?.target_schema) ? item.target_schema : [];
      const field = fields.length === 1 ? String(fields[0]) : "";
      const schemaOk = schema.length === 0 || (
        schema.length === 1 &&
        schema[0]?.key === field &&
        String(schema[0]?.type || "text").toLowerCase() === "text"
      );
      return Boolean(item?.product_id) &&
        coverageIds.has(String(item.product_id)) &&
        String(item?.product_type || "").toLowerCase() === "game_topup" &&
        ["GLOBAL", "LATAM"].includes(region) &&
        !/(free[\s_-]*fire|blood[\s_-]*strike|mobile[\s_-]*legends?|\bmlbb\b)/i.test(family) &&
        item?.requires_target === true &&
        ["player_id", "game_user_id"].includes(field) &&
        schemaOk;
    });

    const additionalGameSync = await rpc("sync_additional_provider_game_products", {
      p_token: token,
      p_items: additionalGameItems,
      p_coverage_products: coverageProducts,
    });

    const freeFireSync = await rpc("sync_free_fire_provider_products", {
      p_token: token,
      p_items: freeFireItems,
      p_coverage_products: coverageProducts,
    });

    // Publish MLBB only when the account catalog actually returns products.
    // The database independently checks validation coverage and the required ID/server fields.
    const mobileLegendsSync = mobileLegendsItems.length
      ? await rpc("sync_mobile_legends_provider_products", {
          p_token: token,
          p_items: mobileLegendsItems,
          p_coverage_products: coverageProducts,
        })
      : {
          ok: false,
          synced: 0,
          published_active: 0,
          message: "Central One todavía no devolvió productos de Mobile Legends GLOBAL para esta cuenta; no se publica ningún paquete.",
        };

    const bloodStrikeSync = bloodStrikeItems.length
      ? await rpc("sync_blood_strike_provider_products", {
          p_token: token,
          p_items: bloodStrikeItems,
          p_coverage_products: coverageProducts,
        })
      : {
          ok: false,
          synced: 0,
          published_active: 0,
          message: "Central One todavía no devolvió productos de Blood Strike GLOBAL para esta cuenta; no se publica ningún paquete.",
        };

    // Store compact game-specific catalogs; keep the whole provider response out of the database.
    const signatureRows = makeSignatureRows([
      ...freeFireItems, ...mobileLegendsItems, ...bloodStrikeItems, ...additionalGameItems
    ]);
    const priceSignature = {
      sha256: await sha256Hex(signatureRows),
      count: signatureRows.length,
    };
    const shouldSave = await rpc("check_central_one_catalog_refresh", {
      p_token: token,
      p_price_signature: priceSignature,
    });

    if (shouldSave !== true) {
      return reply(200, {
        ok: true,
        changed: false,
        checked_at: new Date().toISOString(),
        product_count: items.length,
        free_fire_product_count: freeFireItems.length,
        mobile_legends_product_count: mobileLegendsItems.length,
        blood_strike_product_count: bloodStrikeItems.length,
        additional_game_product_count: additionalGameItems.length,
        published_products: { free_fire: freeFireSync, mobile_legends: mobileLegendsSync, blood_strike: bloodStrikeSync, additional_games: additionalGameSync },
        message: "Catálogo revisado; las tarifas públicas se recalcularon con las reglas vigentes. No cambió el catálogo mayorista.",
      });
    }

    const compactPayload = {
      items: freeFireItems,
      mobile_legends_items: mobileLegendsItems,
      blood_strike_items: bloodStrikeItems,
      additional_game_items: additionalGameItems,
      coverage: coverageProducts,
      catalog_total_count: items.length,
      synced_at: new Date().toISOString(),
    };
    const saveResult = await rpc("save_central_one_catalog_snapshot", {
      p_token: token,
      p_provider_status: upstream.status,
      p_payload: compactPayload,
      p_price_signature: priceSignature,
    });

    return reply(200, {
      ok: true,
      changed: true,
      checked_at: new Date().toISOString(),
      product_count: items.length,
      free_fire_product_count: freeFireItems.length,
      mobile_legends_product_count: mobileLegendsItems.length,
      blood_strike_product_count: bloodStrikeItems.length,
      additional_game_product_count: additionalGameItems.length,
      published_products: { free_fire: freeFireSync, mobile_legends: mobileLegendsSync, blood_strike: bloodStrikeSync, additional_games: additionalGameSync },
      sync: saveResult,
    });
  } catch (error) {
    return reply(500, {
      ok: false,
      error: "catalog_sync_failed",
      message: error instanceof Error ? error.message : "unexpected_error",
    });
  }
});
