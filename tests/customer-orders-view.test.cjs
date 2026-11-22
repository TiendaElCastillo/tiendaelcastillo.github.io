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

test("statusClass maps each customer-visible lifecycle state to a stable style", () => {
  assert.equal(view.statusClass("completed"), "completed");
  assert.equal(view.statusClass("payment_review"), "review");
  assert.equal(view.statusClass("processing"), "processing");
  assert.equal(view.statusClass("rejected"), "attention");
  assert.equal(view.statusClass("failed"), "attention");
  assert.equal(view.statusClass("cancelled"), "cancelled");
  assert.equal(view.statusClass("pending"), "pending");
});
