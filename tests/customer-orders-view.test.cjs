const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const source = fs.readFileSync(path.join(__dirname, "../assets/customer-orders-view.js"), "utf8");
const sandbox = { window: {} };
vm.runInNewContext(source, sandbox, { filename: "customer-orders-view.js" });
const view = sandbox.window.CustomerOrdersView;

function makeOrder(overrides = {}) {
  return {
    id: "order-123",
    order_code: "EC-50E87CBC4C",
    game: "Free Fire",
    package_name: "110 Diamantes",
    player_name: "tonilamafia6",
    player_id: "6287709731",
    payment_method: "Transferencia CUP",
    proof_path: "private/proof-secret.png",
    price: 960,
    status: "completed",
    created_at: new Date(2026, 10, 22, 15, 16).toISOString(),
    ...overrides
  };
}

test("groupByDay groups orders by local calendar day and preserves their order", () => {
  const first = makeOrder({ id: "first", created_at: new Date(2026, 10, 22, 15).toISOString() });
  const second = makeOrder({ id: "second", created_at: new Date(2026, 10, 22, 11).toISOString() });
  const third = makeOrder({ id: "third", created_at: new Date(2026, 10, 21, 18).toISOString() });

  const groups = view.groupByDay([first, second, third], "es-CU");

  assert.equal(groups.length, 2);
  assert.deepEqual(Array.from(groups[0].orders, order => order.id), ["first", "second"]);
  assert.deepEqual(Array.from(groups[1].orders, order => order.id), ["third"]);
  assert.equal(groups[0].count, 2);
});

test("renderSummary shows only the compact customer-facing order summary", () => {
  const html = view.renderSummary(makeOrder(), {
    statusLabel: "Entregado",
    amountLabel: "960 CUP"
  });

  assert.match(html, /Free Fire/);
  assert.match(html, /110 Diamantes/);
  assert.match(html, /EC-50E87CBC4C/);
  assert.match(html, /tonilamafia6/);
  assert.match(html, /960 CUP/);
  assert.match(html, /Entregado/);
  assert.match(html, /data-open-order-detail/);
  assert.match(html, /data-order-id="order-123"/);
  assert.doesNotMatch(html, /6287709731/);
  assert.doesNotMatch(html, /proof-secret/);
  assert.doesNotMatch(html, /Transferencia CUP/);
});

test("renderSummary escapes untrusted customer and game data", () => {
  const html = view.renderSummary(makeOrder({
    game: "<img src=x onerror=alert(1)>",
    player_name: "<script>alert(1)</script>"
  }), {
    statusLabel: "<b>Entregado</b>",
    amountLabel: "960 CUP"
  });

  assert.doesNotMatch(html, /<img src=x/);
  assert.doesNotMatch(html, /<script>alert/);
  assert.match(html, /&lt;img/);
  assert.match(html, /&lt;script&gt;/);
});

test("shortStatusLabel keeps long lifecycle states compact", () => {
  assert.equal(view.shortStatusLabel("pending"), "Pendiente");
  assert.equal(view.shortStatusLabel("payment_review"), "En revisión");
  assert.equal(view.shortStatusLabel("processing"), "En curso");
  assert.equal(view.shortStatusLabel("completed"), "Entregado");
  assert.equal(view.shortStatusLabel("rejected"), "Rechazado");
  assert.equal(view.shortStatusLabel("failed"), "Incidencia");
  assert.equal(view.shortStatusLabel("cancelled"), "Cancelado");
});

test("statusClass maps each customer-visible lifecycle state to a stable style", () => {
  assert.equal(view.statusClass("completed"), "completed");
  assert.equal(view.statusClass("payment_review"), "review");
  assert.equal(view.statusClass("processing"), "processing");
  assert.equal(view.statusClass("rejected"), "attention");
  assert.equal(view.statusClass("failed"), "attention");
  assert.equal(view.statusClass("cancelled"), "cancelled");
  assert.equal(view.statusClass("pending"), "pending");
});


test("solo una entrega confirmada por el proveedor puede mostrar el anuncio de éxito", () => {
  const valid = makeOrder({
    central_one_status: "completed",
    central_one_order_id: "provider-order-123"
  });
  assert.equal(view.isVerifiedDelivery(valid), true);
  assert.equal(view.isVerifiedDelivery({ ...valid, status: "processing" }), false);
  assert.equal(view.isVerifiedDelivery({ ...valid, status: "failed" }), false);
  assert.equal(view.isVerifiedDelivery({ ...valid, status: "cancelled" }), false);
  assert.equal(view.isVerifiedDelivery({ ...valid, central_one_status: "processing" }), false);
  assert.equal(view.isVerifiedDelivery({ ...valid, central_one_status: "failed" }), false);
  assert.equal(view.isVerifiedDelivery({ ...valid, central_one_order_id: null }), false);
});

test("el anuncio de entrega presenta el artículo, el juego y el folio del pedido", () => {
  const order = makeOrder({
    central_one_status: "completed",
    central_one_order_id: "provider-order-123",
    game: "Free Fire",
    package_name: "110 Diamantes",
    order_code: "EC-110DIAM"
  });
  const artwork = '<img src="./assets/ff-diamonds-110.svg" alt="110 diamantes">';
  const html = view.renderDeliverySuccess(order, { itemLabel: "110 Diamantes", artworkHtml: artwork });

  assert.match(html, /¡Recarga entregada!/);
  assert.match(html, /110 Diamantes/);
  assert.match(html, /Free Fire/);
  assert.match(html, /EC-110DIAM/);
  assert.match(html, /Ya está en tu cuenta/);
  assert.match(html, /data-order-delivery-view/);
  assert.match(html, /ff-diamonds-110\.svg/);
});

test("la confirmación dentro del detalle también exige entrega verificada y escapa el nombre del artículo", () => {
  const valid = makeOrder({
    central_one_status: "completed",
    central_one_order_id: "provider-order-123",
    package_name: "<script>alert(1)</script>"
  });
  const html = view.renderDeliveryConfirmation(valid, { itemLabel: valid.package_name });
  assert.match(html, /ENTREGA CONFIRMADA/);
  assert.match(html, /&lt;script&gt;alert\(1\)&lt;\/script&gt;/);
  assert.doesNotMatch(html, /<script>alert/);

  const failed = view.renderDeliveryConfirmation({ ...valid, status: "failed" });
  assert.equal(failed, "");
  assert.equal(view.renderDeliverySuccess({ ...valid, central_one_status: "processing" }), "");
});
