const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");
const hub = fs.readFileSync(path.join(root, "recargas-juegos-cuba.html"), "utf8");
const about = fs.readFileSync(path.join(root, "sobre-tienda-el-castillo.html"), "utf8");
const paymentGuide = fs.readFileSync(path.join(root, "como-pagar-recargas-juegos-cuba.html"), "utf8");
const llms = fs.readFileSync(path.join(root, "llms.txt"), "utf8");
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
  assert.match(hub, /Tienda El Castillo<\/strong> es una tienda digital de recargas de videojuegos para jugadores en Cuba/i);
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
  assert.match(sitemap, /<loc>https:\/\/tiendaelcastillo\.github\.io\/recargas-juegos-cuba\.html<\/loc><lastmod>2026-11-26<\/lastmod>/);
  assert.match(sitemap, /<loc>https:\/\/tiendaelcastillo\.github\.io\/sobre-tienda-el-castillo\.html<\/loc><lastmod>2026-11-26<\/lastmod>/);
});


const homepage = fs.readFileSync(path.join(root, "index.html"), "utf8");
const guidePages = [
  ["recargar-free-fire-cuba.html", "Free Fire LATAM", "UID"],
  ["recargar-blood-strike-cuba.html", "Blood Strike Global", "ID de jugador"],
  ["recargar-mobile-legends-cuba.html", "Mobile Legends: Bang Bang Global", "User ID y Zone ID"],
  ["recargar-pubg-mobile-cuba.html", "PUBG Mobile Global", "Character ID"],
  ["recargar-arena-breakout-cuba.html", "Arena Breakout Mobile Global", "Player ID"]
].map(([file, name, identifier]) => ({
  file,
  name,
  identifier,
  html: fs.readFileSync(path.join(root, file), "utf8")
}));
const legacyRedirects = [
  ["tienda-el-castillo/index.html", "https://tiendaelcastillo.github.io/"],
  ["tienda-el-castillo/recargas-juegos-cuba.html", "https://tiendaelcastillo.github.io/recargas-juegos-cuba.html"],
  ["tienda-el-castillo/recargar-mobile-legends-cuba.html", "https://tiendaelcastillo.github.io/recargar-mobile-legends-cuba.html"]
];

test("la portada expone un solo H1 principal para los rastreadores", () => {
  const headings = [...homepage.matchAll(/<h1\b/gi)];
  assert.equal(headings.length, 1, "La portada no debe exponer los H1 de vistas internas ocultas");
  assert.match(homepage, /<h1>Recargas de juegos desde Cuba<\/h1>/);
});

test("la identidad de la organización de portada coincide con las páginas institucionales", () => {
  const graph = jsonLd(homepage).flatMap((node) => node["@graph"] || [node]);
  const org = graph.find((node) => node["@type"] === "Organization");
  const site = graph.find((node) => node["@type"] === "WebSite");
  assert.equal(org?.["@id"], organizationId);
  assert.ok(org?.sameAs?.includes("https://whatsapp.com/channel/0029Vb8tq5vGufJ4yLhEcS0X"));
  assert.equal(site?.publisher?.["@id"], organizationId);
});

test("cada guía de juego ofrece una respuesta breve con región e identificador", () => {
  for (const page of guidePages) {
    assert.match(page.html, /<h2[^>]*>Respuesta rápida<\/h2>/i, page.file + " necesita una respuesta rápida");
    assert.ok(page.html.includes(page.name), page.file + " debe identificar el servicio y la región");
    assert.ok(page.html.includes(page.identifier), page.file + " debe identificar el dato de jugador");
    assert.match(page.html, /No necesitas compartir la contraseña/i, page.file + " debe explicar la seguridad");
    assert.match(page.html, /el pago se revisa antes de autorizar la recarga/i, page.file + " debe explicar el proceso");
  }
});

test("cada guía de juego incluye migas de navegación estructuradas y su URL canónica", () => {
  for (const page of guidePages) {
    const graph = jsonLd(page.html).flatMap((node) => node["@graph"] || [node]);
    const breadcrumb = graph.find((node) => node["@type"] === "BreadcrumbList");
    assert.ok(breadcrumb, page.file + " necesita BreadcrumbList");
    assert.equal(breadcrumb.itemListElement.length, 3);
    assert.ok(
      breadcrumb.itemListElement.some((item) => item.item?.["@id"]?.endsWith("/" + page.file)),
      page.file + " debe ser el último destino de las migas"
    );
  }
});

test("las direcciones antiguas con clics registrados redirigen inmediatamente a las URL actuales", () => {
  for (const [file, destination] of legacyRedirects) {
    const fullPath = path.join(root, file);
    assert.ok(fs.existsSync(fullPath), "Falta la redirección histórica: " + file);
    const html = fs.readFileSync(fullPath, "utf8");
    assert.ok(html.includes('<meta http-equiv="refresh" content="0; url=' + destination + '"'));
    assert.ok(html.includes('<link rel="canonical" href="' + destination + '"'));
    assert.ok(html.includes('<a href="' + destination + '"'));
  }
});

test("las cinco guías identifican a Tienda El Castillo como tienda cubana y explican la recarga por ID", () => {
  for (const page of guidePages) {
    assert.match(page.html, /<title>Recargar .+ desde Cuba por ID \| Tienda El Castillo<\/title>/i, page.file + " necesita un título orientado a recargas por ID desde Cuba");
    assert.match(page.html, /<meta name="description" content="[^"]+">/i, page.file + " necesita una meta descripción útil y completa");
    const titleStart = page.html.indexOf("<title>") + "<title>".length;
    const titleEnd = page.html.indexOf("</title>", titleStart);
    const title = page.html.slice(titleStart, titleEnd);
    const description = page.html.match(/<meta name="description" content="([^"]+)">/i)?.[1];
    const webPage = jsonLd(page.html).flatMap((node) => node["@graph"] || [node]).find((node) => node["@type"] === "WebPage");
    assert.equal(webPage?.name, title, page.file + " debe alinear el nombre de WebPage con el título");
    assert.equal(webPage?.description, description, page.file + " debe alinear WebPage con la meta descripción");
    assert.equal(webPage?.dateModified, "2026-11-26", page.file + " debe registrar su fecha real de modificación");
    assert.ok(page.html.includes("Tienda El Castillo</strong> es una tienda cubana de recargas de videojuegos para jugadores en Cuba"), page.file + " debe identificar claramente el país de la tienda");
    assert.match(page.html, /recarga por ID desde Cuba/i, page.file + " debe explicar que el pedido se realiza por ID");
  }
});

test("las guías separan la compra automática con Coronas de la recarga manual de la cartera", () => {
  for (const page of guidePages) {
    assert.match(page.html, /Las recargas compradas con Coronas de tu Cartera se procesan automáticamente/i, page.file + " debe explicar la compra automática con Coronas");
    assert.match(page.html, /La recarga de Coronas a la Cartera es diferente: el saldo queda pendiente hasta que la tienda revise y apruebe el pago/i, page.file + " debe explicar la aprobación manual de los depósitos");
    assert.match(page.html, /Los pagos por transferencia CUP, saldo móvil o USDT se revisan antes de autorizar la recarga/i, page.file + " debe distinguir los otros métodos de pago");
    const faq = jsonLd(page.html).flatMap((node) => node["@graph"] || [node]).find((node) => node["@type"] === "FAQPage");
    assert.ok(faq, page.file + " debe conservar FAQPage");
    const question = "¿Las recargas pagadas con Coronas son automáticas?";
    assert.ok(questions(page.html).includes(question), page.file + " debe mostrar la pregunta de Coronas");
    assert.ok(faq.mainEntity.some((item) => item.name === question), page.file + " debe incluir la pregunta de Coronas en los datos estructurados");
  }
});

test("la guía central explica que la tienda es cubana y separa compras automáticas de depósitos", () => {
  assert.match(hub, /Tienda El Castillo es una tienda cubana de recargas de videojuegos/i);
  const hubWebPage = jsonLd(hub).flatMap((node) => node["@graph"] || [node]).find((node) => node["@type"] === "WebPage");
  assert.equal(hubWebPage?.description, hub.match(/<meta name="description" content="([^"]*)">/i)?.[1]);
  assert.equal(hubWebPage?.dateModified, "2026-11-26");
  assert.match(hub, /recargas por ID desde Cuba/i);
  assert.match(hub, /las recargas compradas con Coronas ya acreditadas en tu Cartera se procesan automáticamente/i);
  assert.match(hub, /Añadir Coronas a la Cartera es un depósito distinto/i);
  assert.match(hub, /pagos por transferencia CUP, saldo móvil o USDT se revisan antes de autorizar la recarga/i);
});

test("la guía de pagos diferencia el depósito de Coronas de las compras con saldo acreditado", () => {
  assert.match(paymentGuide, /la compra se procesa automáticamente/i);
  assert.match(paymentGuide, /ese depósito queda pendiente hasta que la tienda revise el pago y lo apruebe/i);
  assert.match(paymentGuide, /el pago debe revisarse antes de autorizar la recarga/i);
});

test("la página institucional y llms.txt describen correctamente el negocio y su proceso de pago", () => {
  assert.match(about, /Tienda El Castillo es una tienda cubana de recargas de videojuegos/i);
  assert.match(about, /Las compras pagadas con Coronas ya acreditadas en la Cartera se procesan automáticamente/i);
  assert.match(about, /Añadir Coronas a la Cartera es un depósito distinto/i);
  assert.match(llms, /Tienda cubana de recargas de videojuegos por ID/i);
  assert.match(llms, /la compra de la recarga con ese saldo interno se procesa automáticamente/i);
  assert.match(llms, /Añadir Coronas a la Cartera es un depósito separado/i);
});

test("los metadatos de portada identifican la tienda cubana y las recargas por ID", () => {
  assert.match(homepage, /Tienda cubana de recargas de juegos por ID/i);
  assert.match(homepage, /recargar Free Fire desde Cuba/i);
  const graph = jsonLd(homepage).flatMap((node) => node["@graph"] || [node]);
  const org = graph.find((node) => node["@type"] === "Organization");
  assert.match(org.description, /Tienda cubana de recargas de videojuegos por ID/i);
  assert.ok(org.knowsAbout.includes("Compras automáticas con Coronas de saldo interno"));
});

