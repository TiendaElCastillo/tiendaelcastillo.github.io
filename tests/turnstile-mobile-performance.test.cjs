const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const html = fs.readFileSync(path.join(__dirname, "../index.html"), "utf8");
const serviceWorker = fs.readFileSync(path.join(__dirname, "../sw.js"), "utf8");

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
  assert.match(serviceWorker, /shell-v209/);
  assert.doesNotMatch(serviceWorker, /shell-v208/);
});
