const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");
const hub = fs.readFileSync(path.join(root, "recargas-juegos-cuba.html"), "utf8");
const about = fs.readFileSync(path.join(root, "sobre-tienda-el-castillo.html"), "utf8");
const sitemap = fs.readFileSync(path.join(root, "sitemap.xml"), "utf8");
const organizationId = "https://tiendaelcastillo.github.io/#organization";

function jsonLd(source) {
  return [...source.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/gi)]
    .map((match) => JSON.parse(match[1]));
}
function questions(source) {
  return [...source.matchAll(/<article>[\s\S]*?<h3>([\s\S]*?)<\/h3>/gi)]
    .map((match) => match[1].replace(/<[^>]+>/g, "").trim());
}

test("la guía central ofrece una respuesta directa sobre recargas por ID desde Cuba", () => {
  assert.match(hub, /¿Dónde recargar juegos por ID desde Cuba sin compartir tu contraseña\?/i);
  assert.match(hub, /Tienda El Castillo es una tienda digital de recargas de videojuegos para jugadores en Cuba/i);
  assert.match(hub, /el pago se revisa antes de autorizar la recarga/i);
  assert.match(hub, /consulta el estado actualizado desde los pedidos de tu cuenta/i);
});

test("la respuesta enumera solamente los cinco servicios y regiones confirmados", () => {
  for (const item of [
    "Free Fire LATAM",
    "Blood Strike GLOBAL",
    "Mobile Legends: Bang Bang GLOBAL",
    "PUBG Mobile GLOBAL",
    "Arena Breakout Mobile GLOBAL"
  ]) assert.ok(hub.includes(item), "Falta el servicio confirmado: " + item);
  assert.match(hub, /User ID y Zone ID/);
});

test("la página no publica paquetes ni precios concretos", () => {
  assert.match(hub, /Los paquetes y precios solo se consultan después de iniciar sesión/);
  assert.doesNotMatch(hub, /\b\d+(?:[.,]\d{1,2})?\s*(?:CUP|USDT)\b/i);
  assert.doesNotMatch(hub, /\b\d+\s*(?:diamantes|monedas|créditos)\b/i);
});

test("la FAQ estructurada coincide con las preguntas que ve el visitante", () => {
  const visible = questions(hub);
  const schemas = jsonLd(hub);
  const faq = schemas.find((node) => node["@type"] === "FAQPage");
  assert.ok(faq, "Falta FAQPage");
  for (const q of faq.mainEntity.map((item) => item.name)) {
    assert.ok(visible.includes(q), "FAQ estructurada no visible: " + q);
  }
});

test("la lista estructurada enlaza exactamente las cinco guías existentes", () => {
  const schemas = jsonLd(hub);
  const list = schemas.flatMap((node) => node["@graph"] || [node]).find((node) => node["@type"] === "ItemList");
  assert.ok(list, "Falta ItemList");
  assert.equal(list.numberOfItems, 5);
  const urls = list.itemListElement.map((item) => item.url);
  assert.equal(new Set(urls).size, 5);
  for (const page of [
    "recargar-free-fire-cuba.html",
    "recargar-blood-strike-cuba.html",
    "recargar-mobile-legends-cuba.html",
    "recargar-pubg-mobile-cuba.html",
    "recargar-arena-breakout-cuba.html"
  ]) assert.ok(urls.some((url) => url.endsWith("/" + page)), "Falta guía: " + page);
});

test("la página central y la institucional comparten la misma identidad de organización", () => {
  const hubSchemas = jsonLd(hub);
  const aboutSchemas = jsonLd(about);
  const aboutOrg = aboutSchemas.flatMap((node) => node["@graph"] || [node])
    .find((node) => node["@type"] === "Organization");
  const hubPage = hubSchemas.flatMap((node) => node["@graph"] || [node])
    .find((node) => node["@type"] === "WebPage");
  assert.equal(aboutOrg["@id"], organizationId);
  assert.equal(hubPage.publisher["@id"], organizationId);
});

test("el sitemap refleja las fechas reales de modificación de ambas páginas", () => {
  assert.match(sitemap, /<loc>https:\/\/tiendaelcastillo\.github\.io\/recargas-juegos-cuba\.html<\/loc><lastmod>2026-11-23<\/lastmod>/);
  assert.match(sitemap, /<loc>https:\/\/tiendaelcastillo\.github\.io\/sobre-tienda-el-castillo\.html<\/loc><lastmod>2026-11-23<\/lastmod>/);
});
