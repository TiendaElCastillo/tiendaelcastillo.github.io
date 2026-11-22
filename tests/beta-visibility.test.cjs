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

test("la web muestra un único aviso discreto de fase beta", () => {
  const notices = index.match(/class="castle-beta-banner"/g) || [];
  assert.equal(notices.length, 1, "Debe existir un solo aviso beta compartido");
  assert.match(index, /<strong>FASE BETA<\\/strong>\\s*·\\s*Estamos mejorando la tienda contigo/i);
  assert.doesNotMatch(index, /pedidos pequeños|evita compras grandes/i);
});

test("el mismo aviso queda visible antes y después de iniciar sesión", () => {
  const notice = index.indexOf('class="castle-beta-banner"');
  const auth = index.indexOf('<section id="auth"');
  const store = index.indexOf('<section id="store"');
  assert.ok(notice >= 0 && auth > notice && store > notice, "El aviso debe estar antes de las vistas pública y autenticada");
  assert.doesNotMatch(blockBetween(index, '<section id="auth"', '<section id="store"'), /FASE BETA/i);
  assert.doesNotMatch(blockBetween(index, '<section id="store"', '</main>'), /FASE BETA/i);
});

test("el mensaje de compartir promociona el servicio sin repetir el aviso beta", () => {
  const share = blockBetween(index, "async function shareStore()", "const productSearchSynonyms");
  assert.match(share, /recargas de juegos disponibles en Cuba/i);
  assert.match(share, /sigue tus pedidos desde tu cuenta/i);
  assert.doesNotMatch(share, /fase beta|pedidos pequeños|compras grandes/i);
});

test("los metadatos mantienen una descripción comercial clara", () => {
  assert.match(index, /<meta name="description" content="Recargas digitales para Free Fire/i);
  assert.match(index, /<meta property="og:description" content="Recargas digitales para Free Fire/i);
  assert.match(index, /<meta name="twitter:description" content="Recargas digitales de juegos en Cuba/i);
  assert.doesNotMatch(index.match(/<meta name="description" content="([^"]*)"/)?.[1] || "", /fase beta/i);
});

test("las guías públicas no repiten el aviso beta", () => {
  for (const guide of guides) {
    assert.doesNotMatch(guide, /fase beta|pedidos pequeños|evita compras grandes/i);
  }
});

test("el acceso conserva las acciones para compartir y seguir novedades", () => {
  const auth = blockBetween(index, '<section id="auth"', '<section id="store"');
  assert.match(auth, /onclick="shareStore()"/);
  assert.match(auth, /whatsapp.com\/channel/);
});
