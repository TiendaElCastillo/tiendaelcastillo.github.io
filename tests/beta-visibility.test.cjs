const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");
const index = fs.readFileSync(path.join(root, "index.html"), "utf8");
const guides = [
  fs.readFileSync(path.join(root, "recargas-juegos-cuba.html"), "utf8"),
  fs.readFileSync(path.join(root, "recargar-free-fire-cuba.html"), "utf8"),
  fs.readFileSync(path.join(root, "recargar-mobile-legends-cuba.html"), "utf8")
];

function blockBetween(source, start, end) {
  const from = source.indexOf(start);
  assert.notEqual(from, -1, "No se encontró el inicio del bloque: " + start);
  const to = source.indexOf(end, from + start.length);
  assert.notEqual(to, -1, "No se encontró el final del bloque: " + end);
  return source.slice(from, to);
}

test("la portada no muestra mensajes de fase beta ni advertencias que desanimen al cliente", () => {
  assert.doesNotMatch(index, /fase beta|pedidos pequeños|evita compras grandes|no hagas compras/i);
});

test("los enlaces SEO a guías están dentro del directorio de ayuda", () => {
  const directory = blockBetween(index, '<div id="guideList"', '<div id="guideDetail"');
  assert.match(directory, /class="public-seo-guides"/);
  for (const href of [
    "./recargas-juegos-cuba.html",
    "./recargar-free-fire-cuba.html",
    "./recargar-mobile-legends-cuba.html",
    "./recargar-blood-strike-cuba.html",
    "./recargar-pubg-mobile-cuba.html",
    "./recargar-arena-breakout-cuba.html",
    "./sobre-tienda-el-castillo.html",
    "./como-pagar-recargas-juegos-cuba.html"
  ]) assert.ok(directory.includes(href), "Falta enlace a " + href);
  assert.equal((index.match(/class="public-seo-guides"/g) || []).length, 1);
});

test("el mensaje de compartir promociona el servicio sin repetir avisos beta", () => {
  const share = blockBetween(index, "async function shareStore()", "const productSearchSynonyms");
  assert.match(share, /recargas de juegos disponibles en Cuba/i);
  assert.match(share, /sigue tus pedidos desde tu cuenta/i);
  assert.doesNotMatch(share, /fase beta|pedidos pequeños|compras grandes/i);
});

test("los metadatos mantienen una descripción comercial clara", () => {
  assert.match(index, /<meta name="description" content="Recargas de Free Fire, Blood Strike, Mobile Legends, PUBG y Arena Breakout en Cuba\. Compra por ID/i);
  assert.match(index, /<meta property="og:description" content="Recargas de Free Fire, Blood Strike, Mobile Legends, PUBG y Arena Breakout en Cuba\. Compra por ID/i);
  assert.match(index, /<meta name="twitter:description" content="Recargas digitales de juegos en Cuba\. Compra por ID de jugador/i);
  assert.doesNotMatch(index.match(/<meta name="description" content="([^"]*)"/)?.[1] || "", /fase beta/i);
});

test("las guías públicas no repiten avisos beta ni lenguaje que desaliente compras", () => {
  for (const guide of guides) {
    assert.doesNotMatch(guide, /fase beta|pedidos pequeños|evita compras grandes|no hagas compras/i);
  }
});

test("el acceso conserva los botones de compartir y seguir novedades", () => {
  const auth = blockBetween(index, '<section id="auth"', '<section id="store"');
  assert.match(auth, /onclick="shareStore\(\)"/);
  assert.match(auth, /whatsapp.com\/channel/);
});
