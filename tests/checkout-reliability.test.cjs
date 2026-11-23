const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.join(__dirname, "..");
const offlineGuardSource = fs.readFileSync(path.join(root, "assets/offline-guard.js"), "utf8");
const adminPanelSource = fs.readFileSync(path.join(root, "assets/admin-panel.js"), "utf8");

function makeNode(id = "") {
  return {
    id,
    className: "",
    textContent: "",
    innerHTML: "",
    hidden: false,
    isConnected: false,
    style: {},
    dataset: {},
    children: [],
    files: [],
    value: "",
    checked: false,
    classList: {
      contains(name) { return this._classes?.has(name) || false; },
      add(name) { (this._classes ||= new Set()).add(name); },
      remove(name) { (this._classes ||= new Set()).delete(name); }
    },
    setAttribute() {},
    appendChild(child) { this.children.push(child); child.parentNode = this; },
    append(...children) { children.forEach(child => this.appendChild(child)); }
  };
}

function runOfflineGuard({ online = false } = {}) {
  const ids = ["checkoutView", "checkoutStagePayment", "checkoutStageDone", "checkoutStepper",
    "product", "player", "playerZone", "payment", "ordermsg", "checkoutPlayerMsg"];
  const elements = Object.fromEntries(ids.map(id => [id, makeNode(id)]));
  elements.checkoutStagePayment.classList.contains = name => name === "hidden";
  elements.checkoutView.querySelector = () => panel;
  elements.product.value = "product-1";
  elements.player.value = "123456789";
  elements.playerZone.value = "5394";
  elements.payment.value = "Transferencia CUP";
  elements.checkoutStageDone.classList.contains = () => true;

  const panel = {
    firstChild: null,
    insertBefore(node) { node.isConnected = true; this.notice = node; }
  };
  const local = new Map();
  const localStorage = {
    getItem(key) { return local.has(key) ? local.get(key) : null; },
    setItem(key, value) { local.set(key, String(value)); },
    removeItem(key) { local.delete(key); }
  };
  const listeners = {};
  const document = {
    readyState: "loading",
    getElementById(id) { return elements[id] || null; },
    createElement(tag) { return makeNode(tag); },
    addEventListener(type, callback, capture) {
      (listeners[type] ||= []).push({ callback, capture });
    }
  };
  let placeOrderCalls = 0;
  const window = {
    addEventListener() {},
    placeOrder: async function () { placeOrderCalls++; return { ok: true }; }
  };
  const navigator = { onLine: online };
  vm.runInNewContext(offlineGuardSource, { document, window, navigator, localStorage });
  for (const listener of listeners.DOMContentLoaded || []) listener.callback();

  function click(id) {
    const target = elements[id] || panel.notice?.children?.flatMap(child => child.children || []).find(node => node.id === id);
    assert.ok(target, "No se encontró el botón " + id);
    const eventState = { prevented: false, stopped: false, immediateStopped: false };
    const event = {
      target: { closest: () => target },
      preventDefault() { eventState.prevented = true; },
      stopPropagation() { eventState.stopped = true; },
      stopImmediatePropagation() { eventState.immediateStopped = true; }
    };
    for (const listener of listeners.click || []) listener.callback(event);
    return eventState;
  }

  return {
    click,
    elements,
    local,
    window,
    callPlaceOrder: () => window.placeOrder(),
    get placeOrderCalls() { return placeOrderCalls; },
    get notice() { return panel.notice; }
  };
}

test("sin conexión reportada, Continuar no se intercepta ni se convierte en Guardar borrador", () => {
  const app = runOfflineGuard({ online: false });
  const result = app.click("continueToPaymentBtn");
  assert.deepEqual(result, { prevented: false, stopped: false, immediateStopped: false });
  assert.equal(app.local.has("castle_checkout_draft_v1"), false);
  assert.equal(app.elements.checkoutPlayerMsg.textContent, "");
});

test("sin conexión reportada, Enviar pedido intenta el flujo real en vez de crear un borrador a escondidas", async () => {
  const app = runOfflineGuard({ online: false });
  const result = app.click("placeOrderBtn");
  assert.deepEqual(result, { prevented: false, stopped: false, immediateStopped: false });
  await app.callPlaceOrder();
  assert.equal(app.placeOrderCalls, 1);
  assert.equal(app.local.has("castle_checkout_draft_v1"), false);
});

test("Guardar borrador sigue disponible como acción voluntaria y no guarda datos de pago", () => {
  const app = runOfflineGuard({ online: false });
  const result = app.click("saveOfflineDraftButton");
  assert.equal(result.prevented, true);
  const draft = JSON.parse(app.local.get("castle_checkout_draft_v1"));
  assert.equal(draft.productId, "product-1");
  assert.equal(draft.playerId, "123456789");
  assert.equal(draft.zoneId, "5394");
  assert.equal(draft.paymentMethod, "Transferencia CUP");
  assert.equal(Object.hasOwn(draft, "reference"), false);
  assert.equal(Object.hasOwn(draft, "proof"), false);
  assert.equal(Object.hasOwn(draft, "reportedAmount"), false);
});

test("el control final de compra verifica el ID compuesto de Mobile Legends", () => {
  const elements = {
    placeOrderBtn: makeNode("placeOrderBtn"),
    product: { value: "mlbb" },
    player: { value: "1348372911" },
    playerZone: { value: "5394" },
    payment: { value: "Transferencia CUP" },
    paymentProof: { files: [{}] },
    reference: { value: "ABC123456" },
    senderPhone: { value: "+5351234567" },
    reportedAmount: { value: "" },
    privacyConsent: { checked: true }
  };
  const products = [{
    id: "mlbb",
    game: "Mobile Legends: Bang Bang",
    provider_product_id: "provider-mlbb",
    requiresZoneId: true
  }];
  let validatedTarget = "";
  const window = {};
  const document = {
    readyState: "loading",
    getElementById(id) { return elements[id] || null; },
    addEventListener() {}
  };
  const sandbox = {
    window, document, products, walletBalanceUSD: 20, currentUser: { id: "user-1" },
    currentPlayerTarget(product) {
      const player = elements.player.value.trim();
      return product.requiresZoneId ? player + "::" + elements.playerZone.value.trim() : player;
    },
    isPlayerValidationCurrent(productId, target) {
      validatedTarget = target;
      return productId === "mlbb" && target === "1348372911::5394";
    },
    priceForMethod() { return 100; },
    isPaymentMethodReady() { return true; },
    validateProofFile() { return null; },
    paymentMethods: []
  };
  vm.runInNewContext(adminPanelSource, sandbox);
  window.updateCheckoutSubmitState();
  assert.equal(validatedTarget, "1348372911::5394");
  assert.equal(elements.placeOrderBtn.disabled, false);
});

test("los juegos que usan un solo ID conservan la validación sin Zone ID", () => {
  const games = [
    ["Free Fire", "ff"],
    ["Blood Strike", "blood"],
    ["PUBG Mobile", "pubg"],
    ["Arena Breakout Mobile", "arena"]
  ];
  for (const [game, id] of games) {
    const elements = {
      placeOrderBtn: makeNode("placeOrderBtn"),
      product: { value: id },
      player: { value: "123456789" },
      playerZone: { value: "" },
      payment: { value: "Transferencia CUP" },
      paymentProof: { files: [{}] },
      reference: { value: "ABC123456" },
      senderPhone: { value: "+5351234567" },
      reportedAmount: { value: "" },
      privacyConsent: { checked: true }
    };
    const products = [{ id, game, provider_product_id: "provider-" + id }];
    let validatedTarget = "";
    const window = {};
    const document = { readyState: "loading", getElementById: key => elements[key] || null, addEventListener() {} };
    const sandbox = {
      window, document, products, walletBalanceUSD: 20, currentUser: { id: "user-1" },
      currentPlayerTarget(product) { return elements.player.value.trim(); },
      isPlayerValidationCurrent(productId, target) { validatedTarget = target; return productId === id && target === "123456789"; },
      priceForMethod() { return 100; }, isPaymentMethodReady() { return true; },
      validateProofFile() { return null; }, paymentMethods: []
    };
    vm.runInNewContext(adminPanelSource, sandbox);
    window.updateCheckoutSubmitState();
    assert.equal(validatedTarget, "123456789", game + " debe validar solo su ID");
    assert.equal(elements.placeOrderBtn.disabled, false, game + " no debe quedar bloqueado");
  }
});
