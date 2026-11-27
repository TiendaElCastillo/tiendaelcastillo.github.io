const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const html = fs.readFileSync(path.join(__dirname, "../index.html"), "utf8");
const serviceWorker = fs.readFileSync(path.join(__dirname, "../sw.js"), "utf8");
const posthogAnalytics = fs.readFileSync(path.join(__dirname, "../assets/posthog.js"), "utf8");

function section(start, end) {
  const startAt = html.indexOf(start);
  assert.notEqual(startAt, -1, "No se encontró el bloque: " + start);
  const endAt = html.indexOf(end, startAt + start.length);
  assert.notEqual(endAt, -1, "No se encontró el final del bloque: " + end);
  return html.slice(startAt, endAt);
}

test("Turnstile obtiene el token al cargar, pero solo muestra el reto si hace falta", () => {
  const widget = section("function renderCastleTurnstile(){", "function resetCastleCaptcha(){");
  assert.match(widget, /execution:"render"/);
  assert.match(widget, /appearance:"interaction-only"/);
  assert.doesNotMatch(widget, /appearance:"always"/);
});

test("Turnstile reintenta automáticamente con el intervalo rápido documentado", () => {
  const widget = section("function renderCastleTurnstile(){", "function resetCastleCaptcha(){");
  assert.match(widget, /retry:"auto"/);
  assert.match(widget, /"retry-interval":8000/);
});

test("El envío espera el token y continúa automáticamente sin pedir otro toque", () => {
  const getter = section("async function getCastleAuthCaptchaToken(){", "function showEmailConfirmationHelp");
  const callback = section("window.onCastleCaptchaSuccess=function(token){", "window.onCastleCaptchaExpired=function(){");
  assert.match(getter, /return await new Promise\(\(resolve,reject\)/);
  assert.match(callback, /resolveCastleCaptchaTokenWaiter\(token\)/);
  assert.doesNotMatch(getter, /vuelve a pulsar el botón/);
});

test("Los tokens próximos a caducar se renuevan antes de usarlos", () => {
  assert.match(html, /Date\.now\(\)-Number\(window\.castleCaptchaTokenCreatedAt\)<240000/);
  assert.match(html, /window\.castleCaptchaTokenCreatedAt=Date\.now\(\)/);
});

test("Los errores permanentes de configuración no dejan al cliente esperando", () => {
  const handler = section("window.onCastleCaptchaError=function(errorCode){", "let castleTurnstileWidgetId=null;");
  assert.match(handler, /if\(permanentError\)rejectCastleCaptchaTokenWaiter\(message\)/);
});

test("La descarga y la espera del token tienen un límite y ofrecen recuperación sin recargar", () => {
  const loader = section("function loadCastleTurnstile(){", "function recoverCastleTurnstileOnConnectionRestore(){");
  const getter = section("async function getCastleAuthCaptchaToken(){", "function showEmailConfirmationHelp");
  assert.match(loader, /setTimeout\(\(\)=>finish\(false,"load"\),30000\)/);
  assert.match(getter, /\},30000\)/);
  assert.match(getter, /no necesitas recargar la página/);
});

test("El acceso, el registro y la recuperación siguen enviando el token a Supabase", () => {
  assert.match(html, /db\.auth\.signInWithPassword\(\{email,password,options:\{captchaToken\}\}\)/);
  assert.match(html, /db\.auth\.signUp\(\{email,password,options:\{captchaToken,/);
  assert.match(html, /db\.auth\.resetPasswordForEmail\(email,\{[\s\S]*?captchaToken/);
});

test("El service worker renueva su caché para distribuir el flujo de acceso actualizado", () => {
  assert.match(serviceWorker, /shell-v210/);
  assert.doesNotMatch(serviceWorker, /shell-v209/);
});

test("Supabase JS usa una versión estable fijada y mantiene el CDN alternativo", () => {
  const loader = section("const CASTLE_SUPABASE_JS_VERSION=", "async function bootstrapCastleStore(){");
  assert.ok(loader.includes('CASTLE_SUPABASE_JS_VERSION="2.119.2"'));
  assert.ok(loader.includes('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@"+CASTLE_SUPABASE_JS_VERSION'));
  assert.ok(loader.includes('https://unpkg.com/@supabase/supabase-js@"+CASTLE_SUPABASE_JS_VERSION'));
  assert.ok(loader.includes('script.crossOrigin="anonymous"'));
  assert.doesNotMatch(loader, /supabase-js@2(?:["/])/);
});

test("La descarga de Supabase adapta el tiempo límite a conexiones lentas", () => {
  const timeout = section("function castleSupabaseSdkAttemptTimeout(){", "function loadCastleSupabaseSdk(){");
  assert.ok(timeout.includes('networkType==="slow-2g"||networkType==="2g")return 18000'));
  assert.ok(timeout.includes('networkType==="3g")return 15000'));
  assert.ok(timeout.includes('return 12000'));
});

test("La conexión anticipa los dos CDN y mide el resultado de Supabase", () => {
  assert.ok(html.includes('<link rel="preconnect" href="https://cdn.jsdelivr.net" crossorigin>'));
  assert.ok(html.includes('<link rel="preconnect" href="https://unpkg.com" crossorigin>'));
  const loader = section("function loadCastleSupabaseSdk(){", "async function bootstrapCastleStore(){");
  assert.ok(loader.includes('store_supabase_sdk_loaded'));
  assert.ok(loader.includes('store_supabase_sdk_attempt_failed'));
  assert.ok(loader.includes('store_supabase_sdk_load_failed'));
  assert.ok(loader.includes('fallback_used:attempt>1'));
  assert.ok(loader.includes('service_worker_controlled'));
});

test("El service worker puede guardar en caché los dos CDN de Supabase", () => {
  assert.ok(serviceWorker.includes('url.hostname === "cdn.jsdelivr.net"'));
  assert.ok(serviceWorker.includes('url.hostname === "unpkg.com"'));
  assert.ok(serviceWorker.includes('isSupabaseLibrary'));
});

test("PostHog permite medir rendimiento y errores sin abrir propiedades privadas", () => {
  const allowed = [
    "provider", "version", "hostname", "network_type", "reason",
    "error_code", "error_category"
  ];
  const numeric = ["elapsed_ms", "attempt_elapsed_ms", "attempt", "attempts"];
  const boolean = ["fallback_used", "service_worker_controlled", "interaction_required"];
  for (const key of allowed) assert.ok(posthogAnalytics.includes('"'+key+'"'), "Falta la propiedad segura: "+key);
  for (const key of numeric) assert.ok(posthogAnalytics.includes('"'+key+'"'), "Falta la propiedad numérica: "+key);
  for (const key of boolean) assert.ok(posthogAnalytics.includes('"'+key+'"'), "Falta la propiedad booleana: "+key);
  assert.ok(posthogAnalytics.includes("Number.isFinite(value)"));
  assert.ok(posthogAnalytics.includes('typeof value === "boolean"'));
  assert.ok(posthogAnalytics.includes("Math.min(value, 86400000)"));
  assert.ok(posthogAnalytics.includes("const cleanProperties = (input) =>"));
  assert.ok(posthogAnalytics.includes("if (!allowedProperties.has(key) && !numericProperties.has(key) && !booleanProperties.has(key)) return;"));
});

test("La analítica conserva una lista cerrada y no admite datos personales ni campos de pedido", () => {
  const allowedStart = posthogAnalytics.indexOf("const allowedProperties = new Set([");
  const allowedEnd = posthogAnalytics.indexOf("]);", allowedStart);
  const whitelist = posthogAnalytics.slice(allowedStart, allowedEnd);
  assert.ok(allowedStart !== -1 && allowedEnd !== -1);
  assert.doesNotMatch(whitelist, /email|phone|player_id|order_id|proof|password|token/i);
});
