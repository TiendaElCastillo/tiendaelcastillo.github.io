const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");
const index = fs.readFileSync(path.join(root, "index.html"), "utf8");
const generalGuide = fs.readFileSync(path.join(root, "recargas-juegos-cuba.html"), "utf8");
const freeFireGuide = fs.readFileSync(path.join(root, "recargar-free-fire-cuba.html"), "utf8");
const mobileLegendsGuide = fs.readFileSync(path.join(root, "recargar-mobile-legends-cuba.html"), "utf8");

function blockBetween(source, start, end) {
  const from = source.indexOf(start);
  assert.notEqual(from, -1, "No se encontró el inicio del bloque: " + start);
  const to = source.indexOf(end, from + start.length);
  assert.notEqual(to, -1, "No se encontró el final del bloque: " + end);
  return source.slice(from, to);
}

test("el acceso antes de iniciar sesión explica la fase beta y desaconseja compras grandes", () => {
  const auth = blockBetween(index, '<section id="auth"', '<section id="store"');
  assert.match(auth, /FASE BETA/i);
  assert.match(auth, /evita compras grandes/i);
  assert.match(auth, /pedidos pequeños/i);
});

test("la entrada de la tienda conserva el aviso beta en las vistas autenticadas", () => {
  const store = blockBetween(index, '<section id="store"', '<\/main>');
  const notice = store.indexOf('class="castle-beta-store-note"');
  const home = store.indexOf('<section id="homeView"');
  assert.notEqual(notice, -1, "Falta el aviso beta dentro de la tienda");
  assert.notEqual(home, -1, "No se encontró la vista de inicio");
  assert.ok(notice < home, "El aviso debe permanecer fuera de las vistas internas");
  assert.match(store.slice(notice, notice + 700), /evita compras grandes/i);
});

test("el mensaje de compartir informa correctamente que la tienda está en beta", () => {
  const share = blockBetween(index, "async function shareStore()", "const productSearchSynonyms");
  assert.match(share, /fase beta/i);
  assert.match(share, /pedidos pequeños/i);
  assert.match(share, /evitar compras grandes/i);
});

test("los metadatos de buscadores y redes explican la fase beta", () => {
  assert.match(index, /<meta name="description" content="[^"]*fase beta/i);
  assert.match(index, /<meta property="og:description" content="[^"]*fase beta/i);
  assert.match(index, /<meta name="twitter:description" content="[^"]*fase beta/i);
});

test("las tres guías públicas recomiendan pedidos pequeños y no compras grandes", () => {
  for (const [name, guide] of [
    ["guía general", generalGuide],
    ["guía Free Fire", freeFireGuide],
    ["guía Mobile Legends", mobileLegendsGuide]
  ]) {
    assert.match(guide, /fase beta/i, name + " debe conservar el aviso beta");
    assert.match(guide, /pedidos pequeños/i, name + " debe recomendar pedidos pequeños");
    assert.match(guide, /evita compras grandes/i, name + " debe desaconsejar compras grandes");
  }
});

test("la pantalla de acceso ofrece compartir la tienda y seguir el canal oficial", () => {
  const auth = blockBetween(index, '<section id="auth"', '<section id="store"');
  assert.match(auth, /onclick="shareStore()"/);
  assert.match(auth, /shareStoreMsg/);
  assert.match(auth, /whatsapp.com\/channel/);
});
