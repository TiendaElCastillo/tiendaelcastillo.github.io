const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");
const guide = fs.readFileSync(path.join(root, "consultar-estado-recarga-cuba.html"), "utf8");
const sitemap = fs.readFileSync(path.join(root, "sitemap.xml"), "utf8");
const llms = fs.readFileSync(path.join(root, "llms.txt"), "utf8");
const pages = [
  "index.html",
  "recargas-juegos-cuba.html",
  "recargar-free-fire-cuba.html",
  "recargar-blood-strike-cuba.html",
  "recargar-mobile-legends-cuba.html",
  "recargar-pubg-mobile-cuba.html",
  "recargar-arena-breakout-cuba.html",
  "como-pagar-recargas-juegos-cuba.html",
  "sobre-tienda-el-castillo.html"
].map(file => ({ file, html: fs.readFileSync(path.join(root, file), "utf8") }));

function jsonLd(source) {
  return [...source.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/gi)]
    .map(match => JSON.parse(match[1]));
}

test("la guía es indexable, canónica y mantiene metadatos breves", () => {
  assert.ok(guide.includes('<html lang="es-CU">'));
  assert.ok(guide.includes('<meta name="robots" content="index,follow'));
  assert.ok(guide.includes('https://tiendaelcastillo.github.io/consultar-estado-recarga-cuba.html'));
  const title = guide.match(/<title>([^<]+)<\/title>/i)?.[1] || "";
  const description = guide.match(/<meta name="description" content="([^"]+)">/i)?.[1] || "";
  assert.ok(title.length > 0 && title.length <= 60, "El título debe tener hasta 60 caracteres");
  assert.ok(description.length > 0 && description.length <= 160, "La descripción debe tener hasta 160 caracteres");
  assert.equal([...guide.matchAll(/<h1\b/gi)].length, 1);
  assert.ok(guide.includes('"dateModified":"2026-11-26"'));
});

test("la guía explica los seis estados reales que ve el cliente", () => {
  for (const status of [
    "Pendiente",
    "Verificando pago",
    "Pago confirmado · pendiente de recarga",
    "Recarga en curso",
    "Entregado",
    "Rechazado, fallido o cancelado"
  ]) assert.ok(guide.includes(status), "Falta el estado visible: " + status);
  assert.ok(guide.includes("«Mis pedidos»"));
  assert.ok(guide.includes("«Mensajes y avisos»"));
});

test("la guía diferencia Coronas acreditadas, depósitos y pagos externos", () => {
  assert.match(guide, /la compra de una recarga con ese saldo interno se procesa automáticamente/i);
  assert.match(guide, /Es un depósito diferente a comprar una recarga con saldo ya acreditado/i);
  assert.match(guide, /transferencias CUP, el saldo móvil y USDT requieren revisión antes de autorizar la recarga/i);
  assert.match(guide, /no hagas otro pago ni crees otro pedido/i);
});

test("la guía explica el Centro de soporte sin confundirlo con el canal comunitario", () => {
  assert.ok(guide.includes("«Centro de soporte» desde tu perfil"));
  assert.ok(guide.includes("«Mis solicitudes»"));
  assert.ok(guide.includes("no sustituye el seguimiento de pedidos ni el Centro de soporte"));
  assert.doesNotMatch(guide, /soporte (?:24\/7|instantáneo|por WhatsApp)/i);
  assert.doesNotMatch(guide, /\b\d+(?:[.,]\d{1,2})?\s*(?:CUP|USDT)\b/i);
});

test("las FAQ visibles coinciden con FAQPage y los otros datos estructurados", () => {
  const graph = jsonLd(guide).flatMap(node => node["@graph"] || [node]);
  const faq = graph.find(node => node["@type"] === "FAQPage");
  assert.ok(faq, "Falta FAQPage");
  const faqSection = guide.split('<section class="section" aria-labelledby="faq">')[1]?.split("</section>")[0] || "";
  const visibleQuestions = [...faqSection.matchAll(/<article class="faq-item"><h3>([\s\S]*?)<\/h3>/gi)]
    .map(match => match[1].replace(/<[^>]+>/g, "").trim());
  assert.equal(visibleQuestions.length, faq.mainEntity.length);
  for (const item of faq.mainEntity) {
    assert.ok(visibleQuestions.includes(item.name), "Pregunta estructurada no visible: " + item.name);
  }
  assert.ok(graph.some(node => node["@type"] === "WebPage"));
  assert.ok(graph.some(node => node["@type"] === "BreadcrumbList"));
});

test("las páginas clave enlazan a la guía y el sitemap y llms.txt la enumeran", () => {
  for (const page of pages) {
    assert.ok(page.html.includes("consultar-estado-recarga-cuba.html"), "Falta enlace en " + page.file);
  }
  assert.ok(llms.includes("consultar-estado-recarga-cuba.html"));
  assert.ok(sitemap.includes("<loc>https://tiendaelcastillo.github.io/consultar-estado-recarga-cuba.html</loc><lastmod>2026-11-26</lastmod>"));
});
