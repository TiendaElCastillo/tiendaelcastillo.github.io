const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.join(__dirname, "..");
const offlineGuardSource = fs.readFileSync(path.join(root, "assets/offline-guard.js"), "utf8");
const adminPanelSource = fs.readFileSync(path.join(root, "assets/admin-panel.js"), "utf8");
const indexHtml = fs.readFileSync(path.join(root, "index.html"), "utf8");
const serviceWorker = fs.readFileSync(path.join(root, "sw.js"), "utf8");
const checkoutReliabilitySource = fs.readFileSync(path.join(root, "assets/checkout-reliability.js"), "utf8");
const checkoutGuardMigrationSource = fs.readFileSync(path.join(root, "supabase/migrations/20261123170000_harden_checkout_proof_transition.sql"), "utf8");
const playerValidationEdgeSource = fs.readFileSync(path.join(root, "supabase/functions/central-one-player-validate/index.ts"), "utf8");
const centralOneOrderEdgeSource = fs.readFileSync(path.join(root, "supabase/functions/central-one-order/index.ts"), "utf8");

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
    "product", "player", "playerZone", "payment", "ordermsg", "checkoutPlayerMsg", "continueToPaymentBtn", "placeOrderBtn"];
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
  vm.runInNewContext(offlineGuardSource, { document, window, navigator, localStorage, currentUser: { id: "user-1" } });
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

test("la actualización de los bloqueos se descarga también en teléfonos con caché anterior", () => {
  assert.ok(indexHtml.includes("./assets/offline-guard.js?v=3"));
  assert.ok(indexHtml.includes("./assets/admin-panel.js?v=23"));
  assert.ok(serviceWorker.includes('shell-v181'));
  assert.ok(serviceWorker.includes("./assets/offline-guard.js?v=3"));
  assert.ok(serviceWorker.includes("./assets/admin-panel.js?v=23"));
  assert.ok(indexHtml.includes("./assets/checkout-reliability.js?v=1"));
  assert.ok(indexHtml.includes('id="proofUploadCircuit"'));
  assert.ok(serviceWorker.includes("./assets/checkout-reliability.js?v=1"));
  assert.ok(serviceWorker.includes("./assets/checkout-reliability.css?v=1"));
});


test("Saldo móvil bloquea un teléfono cubano inválido antes de crear el pedido y acepta uno válido", () => {
  function makePaymentFixture(senderPhone) {
    const elements = {
      placeOrderBtn: makeNode("placeOrderBtn"),
      product: { value: "mlbb-mobile" },
      player: { value: "1348372911" },
      playerZone: { value: "5394" },
      payment: { value: "Saldo móvil" },
      paymentProof: { files: [{ type: "image/jpeg", size: 1000 }] },
      reference: { value: "" },
      senderPhone: { value: senderPhone },
      reportedAmount: { value: "250" },
      privacyConsent: { checked: true }
    };
    const products = [{ id: "mlbb-mobile", game: "Mobile Legends: Bang Bang", price_mobile: 250 }];
    const window = {};
    const document = { readyState: "loading", getElementById: id => elements[id] || null, addEventListener() {} };
    const sandbox = {
      window, document, products, currentUser: { id: "user-1" }, walletBalanceUSD: 20,
      cubaMobileNational(value) {
        let digits = String(value || "").replace(/\\D/g, "");
        if (digits.length === 10 && digits.startsWith("53")) digits = digits.slice(2);
        return /^5[0-9]{7}$/.test(digits) ? digits : "";
      },
      priceForMethod(product, method) { return method === "Saldo móvil" ? product.price_mobile : 0; },
      isPaymentMethodReady() { return true; },
      validateProofFile() { return ""; },
      paymentMethods: []
    };
    vm.runInNewContext(adminPanelSource, sandbox);
    window.updateCheckoutSubmitState();
    return { button: elements.placeOrderBtn };
  }
  const invalid = makePaymentFixture("12345678");
  assert.equal(invalid.button.disabled, true);
  assert.match(invalid.button.textContent, /debe empezar por 5/);
  const valid = makePaymentFixture("55886764");
  assert.equal(valid.button.disabled, false);
  assert.equal(valid.button.textContent, "Ya transferí · Enviar a revisión");
});

test("la normalización del teléfono vuelve a actualizar el estado del botón de pago", () => {
  assert.ok(indexHtml.includes("cubaMobileInputValue(senderField.value);window.updateCheckoutSubmitState?.();"));
});


test("los cuatro métodos de pago permiten enviar cuando todos sus datos son válidos", () => {
  const cases = [
    { method: "Transferencia CUP", price: 100, reference: "ABC123", senderPhone: "55886764", amount: "", proof: true, wallet: 0 },
    { method: "Saldo móvil", price: 250, reference: "", senderPhone: "55886764", amount: "250", proof: true, wallet: 0 },
    { method: "USDT", price: 10, reference: "a".repeat(64), senderPhone: "", amount: "10", proof: true, wallet: 0 },
    { method: "Saldo de Tienda El Castillo", price: 10, reference: "", senderPhone: "", amount: "", proof: false, wallet: 20 }
  ];
  for (const item of cases) {
    const elements = {
      placeOrderBtn: makeNode("placeOrderBtn"),
      product: { value: "product-" + item.method },
      player: { value: "123456789" },
      playerZone: { value: "" },
      payment: { value: item.method },
      paymentProof: { files: item.proof ? [{ type: "image/jpeg", size: 1000 }] : [] },
      reference: { value: item.reference },
      senderPhone: { value: item.senderPhone },
      reportedAmount: { value: item.amount },
      privacyConsent: { checked: true }
    };
    const product = { id: "product-" + item.method, game: "Free Fire", price_transfer: 100, price_mobile: 250, price_usdt: 10 };
    const window = {};
    const document = { readyState: "loading", getElementById: id => elements[id] || null, addEventListener() {} };
    const sandbox = {
      window, document, products: [product], currentUser: { id: "user-1" }, walletBalanceUSD: item.wallet,
      cubaMobileNational(value) {
        let digits = String(value || "").replace(/\\D/g, "");
        if (digits.length === 10 && digits.startsWith("53")) digits = digits.slice(2);
        return /^5[0-9]{7}$/.test(digits) ? digits : "";
      },
      priceForMethod(p, method) {
        return method === "Transferencia CUP" ? p.price_transfer :
          method === "Saldo móvil" ? p.price_mobile : p.price_usdt;
      },
      isPaymentMethodReady() { return true; },
      validateProofFile(file) { return file ? "" : "missing"; },
      paymentMethods: []
    };
    vm.runInNewContext(adminPanelSource, sandbox);
    window.updateCheckoutSubmitState();
    assert.equal(elements.placeOrderBtn.disabled, false, item.method + " debe habilitarse con los datos correctos");
  }
});


test("el botón se recalcula al cargar el validador aunque el cliente ya haya completado el pago", () => {
  const ids = ["placeOrderBtn", "product", "player", "playerZone", "payment",
    "paymentProof", "reference", "senderPhone", "reportedAmount", "privacyConsent"];
  const elements = Object.fromEntries(ids.map(id => [id, makeNode(id)]));
  Object.values(elements).forEach(node => { node.addEventListener = () => {}; });
  elements.placeOrderBtn.disabled = true;
  elements.product.value = "mlbb-mobile";
  elements.player.value = "1348372911";
  elements.playerZone.value = "5394";
  elements.payment.value = "Saldo móvil";
  elements.paymentProof.files = [{ type: "image/jpeg", size: 1000 }];
  elements.senderPhone.value = "55886764";
  elements.reportedAmount.value = "250";
  elements.privacyConsent.checked = true;
  const product = {
    id: "mlbb-mobile",
    game: "Mobile Legends: Bang Bang",
    provider_product_id: "provider-mlbb",
    price_mobile: 250
  };
  const window = {};
  const document = {
    readyState: "complete",
    getElementById: id => elements[id] || null,
    querySelectorAll: () => [],
    addEventListener() {}
  };
  const sandbox = {
    window, document, products: [product], currentUser: { id: "user-1" },
    currentPlayerTarget() { return elements.player.value + "::" + elements.playerZone.value; },
    isPlayerValidationCurrent(productId, target) {
      return productId === "mlbb-mobile" && target === "1348372911::5394";
    },
    cubaMobileNational(value) {
      let digits = String(value || "").replace(/\\D/g, "");
      if (digits.length === 10 && digits.startsWith("53")) digits = digits.slice(2);
      return /^5[0-9]{7}$/.test(digits) ? digits : "";
    },
    priceForMethod(p, method) { return method === "Saldo móvil" ? p.price_mobile : 0; },
    isPaymentMethodReady() { return true; },
    validateProofFile(file) { return file ? "" : "missing"; },
    paymentMethods: [],
    walletBalanceUSD: 0
  };
  vm.runInNewContext(adminPanelSource, sandbox);
  assert.equal(elements.placeOrderBtn.disabled, false);
  assert.equal(elements.placeOrderBtn.textContent, "Ya transferí · Enviar a revisión");
});

function extractFunctionDeclaration(source, name) {
  const start = source.indexOf("function " + name + "(");
  assert.notEqual(start, -1, "No se encontró la función " + name);
  const open = source.indexOf("{", start);
  let depth = 0;
  let quote = "";
  let escaped = false;
  for (let i = open; i < source.length; i++) {
    const ch = source[i];
    if (quote) {
      if (escaped) escaped = false;
      else if (ch === "\\\\") escaped = true;
      else if (ch === quote) quote = "";
      continue;
    }
    if (ch === "\"" || ch === "'" || ch === "`") { quote = ch; continue; }
    if (ch === "{") depth++;
    if (ch === "}" && --depth === 0) return source.slice(start, i + 1);
  }
  throw new Error("No se pudo extraer la función " + name);
}

test("el teléfono cubano acepta ocho dígitos que comiencen por 5 o por 6", () => {
  const declaration = extractFunctionDeclaration(indexHtml, "cubaMobileNational");
  const cubaMobileNational = new Function(declaration + "; return cubaMobileNational;")();
  assert.equal(cubaMobileNational("51884040"), "51884040");
  assert.equal(cubaMobileNational("62974802"), "62974802");
  assert.equal(cubaMobileNational("+5351884040"), "51884040");
  assert.equal(cubaMobileNational("+5362974802"), "62974802");
  assert.equal(cubaMobileNational("31884040"), "");
  assert.equal(cubaMobileNational("6297480"), "");
  assert.equal(cubaMobileNational("662974802"), "");
});

test("la entrada de ID activa la validación automática sin tener que salir del campo", () => {
  assert.ok(indexHtml.includes('oninput="handlePlayerInput()"'));
  assert.doesNotMatch(indexHtml.match(/id="player"[^>]+/)?.[0] || "", /onblur=/);
  assert.ok(indexHtml.includes('oninput="handlePlayerInput()"') && indexHtml.match(/id="playerZone"[^>]+/)?.[0]?.includes('oninput="handlePlayerInput()"'));
  const declaration = extractFunctionDeclaration(indexHtml, "handlePlayerInput");
  assert.match(declaration, /setTimeout/);
  assert.match(declaration, /validatePlayerId/);
});

test("Mobile Legends no inicia la validación hasta que se complete el Zone ID", () => {
  const declaration = extractFunctionDeclaration(indexHtml, "handlePlayerInput");
  const fields = { player: { value: "1348372911" }, playerZone: { value: "" }, product: { value: "mlbb" } };
  let scheduled = null;
  let validationCalls = 0;
  let displayed = "";
  const sandbox = {
    playerValidationDebounceTimer: null,
    products: [{ id: "mlbb", game: "Mobile Legends: Bang Bang", provider_product_id: "provider-mlbb", provider_validation_supported: true }],
    $: id => fields[id],
    requiresPlayerValidation: () => true,
    providerPlayerTargetConfig: () => ({ ok: true, zoneKey: "zone_id" }),
    resetPlayerValidation() {},
    setPlayerValidationDisplay(_className, _icon, message, label) { displayed = message + "|" + label; },
    setTimeout(callback, delay) { scheduled = { callback, delay }; return 99; },
    clearTimeout() {},
    validatePlayerId() { validationCalls++; }
  };
  const handle = new Function("sandbox", "with(sandbox) { return (" + declaration + "); }")(sandbox);
  handle();
  assert.equal(scheduled, null);
  assert.match(displayed, /Zone ID/);
  fields.playerZone.value = "5394";
  handle();
  assert.ok(scheduled);
  assert.ok(scheduled.delay >= 400 && scheduled.delay <= 900);
  assert.equal(validationCalls, 0);
  scheduled.callback();
  assert.equal(validationCalls, 1);
});

test("los juegos con un solo ID programan la validación automática al completar el ID", () => {
  const declaration = extractFunctionDeclaration(indexHtml, "handlePlayerInput");
  const fields = { player: { value: "123456789" }, playerZone: { value: "" }, product: { value: "ff" } };
  let scheduled = null;
  let validationCalls = 0;
  const sandbox = {
    playerValidationDebounceTimer: null,
    products: [{ id: "ff", game: "Free Fire", provider_product_id: "provider-ff", provider_validation_supported: true }],
    $: id => fields[id],
    requiresPlayerValidation: () => true,
    providerPlayerTargetConfig: () => ({ ok: true, zoneKey: null }),
    resetPlayerValidation() {},
    setPlayerValidationDisplay() {},
    setTimeout(callback, delay) { scheduled = { callback, delay }; return 99; },
    clearTimeout() {},
    validatePlayerId() { validationCalls++; }
  };
  const handle = new Function("sandbox", "with(sandbox) { return (" + declaration + "); }")(sandbox);
  handle();
  assert.ok(scheduled);
  scheduled.callback();
  assert.equal(validationCalls, 1);
});


test("los pedidos directos sin captura no se mezclan con los pagos por revisar", () => {
  assert.match(adminPanelSource, /status==="pending"&&paymentSource==="direct"&&!proofPresent/);
  assert.match(adminPanelSource, /incomplete:"Pedidos incompletos"/);
  assert.match(indexHtml, /data-payment-source=/);
  assert.match(indexHtml, /data-proof-present=/);
});

function makeReliableCheckoutFixture({ game, method, amount, reference, senderPhone, zoneId = "", playerId = "123456789", proofFile = true }) {
  const elements = Object.fromEntries([
    "placeOrderBtn","product","player","playerZone","payment","paymentProof","reference",
    "senderPhone","reportedAmount","privacyConsent","ordermsg"
  ].map(id => [id, makeNode(id)]));
  elements.product.value = "test-product";
  elements.player.value = playerId;
  elements.playerZone.value = zoneId;
  elements.payment.value = method;
  elements.paymentProof.files = proofFile ? [{ type: "image/jpeg", size: 2048 }] : [];
  elements.reference.value = reference || "";
  elements.senderPhone.value = senderPhone || "";
  elements.reportedAmount.value = amount === undefined ? "" : String(amount);
  elements.privacyConsent.checked = true;
  const product = {
    id: "test-product", game, provider_product_id: "provider-test",
    provider_validation_supported: true, provider_region: game === "Free Fire" ? "LATAM" : game === "Mobile Legends: Bang Bang" ? "GLOBAL" : "LATAM",
    price_transfer: 100, price_mobile: 120, price_usdt: 1.25
  };
  let placeOrderCalls = 0;
  let resolveOrder;
  const window = {
    __castleCheckoutSubmitting: false,
    updateCheckoutSubmitState() {},
    castleSetProofUploadProgress() {},
    placeOrder() {
      placeOrderCalls++;
      return new Promise(resolve => { resolveOrder = resolve; });
    }
  };
  const document = {
    getElementById(id) { return elements[id] || null; },
    querySelectorAll() { return []; }
  };
  const sandbox = {
    window, document, XMLHttpRequest: function () {},
    currentUser: { id: "user-1" }, products: [product],
    checkoutLockedPaymentMethod: method,
    paymentMethods: [{ name: method, active: true, instructions: "Instrucciones" }],
    walletBalanceUSD: 10,
    currentPlayerTarget(p) { return p.game === "Mobile Legends: Bang Bang" ? elements.player.value + "::" + elements.playerZone.value : elements.player.value; },
    providerPlayerTargetConfig(p) { return p.game === "Mobile Legends: Bang Bang" ? { ok: true, zoneKey: "zone_id" } : { ok: true, zoneKey: null }; },
    requiresPlayerValidation() { return true; },
    isGlobalMobileLegendsProduct(p) { return p.game !== "Mobile Legends: Bang Bang" || p.provider_region === "GLOBAL"; },
    isPaymentMethodReady() { return true; },
    priceForMethod(p, m) { return m === "Transferencia CUP" ? p.price_transfer : m === "Saldo móvil" ? p.price_mobile : p.price_usdt; },
    validateProofFile(file) { return file && file.size > 0 && ["image/jpeg","image/png","image/webp"].includes(file.type) ? "" : "missing"; },
    cubaMobileNational(value) {
      let digits = String(value || "").replace(/\\D/g, "");
      if (digits.length === 10 && digits.startsWith("53")) digits = digits.slice(2);
      return /^[56][0-9]{7}$/.test(digits) ? digits : "";
    }
  };
  vm.runInNewContext(checkoutReliabilitySource, sandbox);
  return { elements, window, get placeOrderCalls() { return placeOrderCalls; }, finish() { resolveOrder?.("ok"); } };
}

test("Free Fire bloquea un comprobante incompleto y acepta Transferencia CUP completa", async () => {
  const incomplete = makeReliableCheckoutFixture({ game: "Free Fire", method: "Transferencia CUP", reference: "", senderPhone: "55886764" });
  await incomplete.window.placeOrder();
  assert.equal(incomplete.placeOrderCalls, 0);
  assert.match(incomplete.elements.ordermsg.textContent, /transacción bancaria/i);

  const valid = makeReliableCheckoutFixture({ game: "Free Fire", method: "Transferencia CUP", reference: "ABC123", senderPhone: "55886764" });
  const promise = valid.window.placeOrder();
  assert.equal(valid.placeOrderCalls, 1);
  valid.finish();
  assert.equal(await promise, "ok");
});

test("Blood Strike exige TxID y cantidad exacta al pagar con USDT", async () => {
  const incomplete = makeReliableCheckoutFixture({ game: "Blood Strike", method: "USDT", reference: "ABC", amount: 1.25 });
  await incomplete.window.placeOrder();
  assert.equal(incomplete.placeOrderCalls, 0);
  assert.match(incomplete.elements.ordermsg.textContent, /64 caracteres/i);

  const valid = makeReliableCheckoutFixture({ game: "Blood Strike", method: "USDT", reference: "a".repeat(64), amount: 1.25 });
  const promise = valid.window.placeOrder();
  assert.equal(valid.placeOrderCalls, 1);
  valid.finish();
  assert.equal(await promise, "ok");
});

test("Mobile Legends exige ID, Zone ID, móvil, importe y captura antes de enviar", async () => {
  const incomplete = makeReliableCheckoutFixture({ game: "Mobile Legends: Bang Bang", method: "Saldo móvil", amount: "", senderPhone: "55886764", zoneId: "" });
  await incomplete.window.placeOrder();
  assert.equal(incomplete.placeOrderCalls, 0);
  assert.match(incomplete.elements.ordermsg.textContent, /Zone ID/i);

  const missingAmount = makeReliableCheckoutFixture({ game: "Mobile Legends: Bang Bang", method: "Saldo móvil", amount: "", senderPhone: "55886764", zoneId: "5394" });
  await missingAmount.window.placeOrder();
  assert.equal(missingAmount.placeOrderCalls, 0);
  assert.match(missingAmount.elements.ordermsg.textContent, /importe declarado/i);

  const valid = makeReliableCheckoutFixture({ game: "Mobile Legends: Bang Bang", method: "Saldo móvil", amount: 120, senderPhone: "55886764", zoneId: "5394" });
  const promise = valid.window.placeOrder();
  assert.equal(valid.placeOrderCalls, 1);
  valid.finish();
  assert.equal(await promise, "ok");
});

test("dos toques rápidos no pueden crear dos pedidos desde el mismo checkout", async () => {
  const fixture = makeReliableCheckoutFixture({ game: "Free Fire", method: "Transferencia CUP", reference: "ABC123", senderPhone: "55886764" });
  const first = fixture.window.placeOrder();
  const second = fixture.window.placeOrder();
  await second;
  assert.equal(fixture.placeOrderCalls, 1);
  fixture.finish();
  assert.equal(await first, "ok");
});

test("el helper de checkout y el HTML tienen indicador de progreso y subida con avance real", () => {
  assert.match(checkoutReliabilitySource, /xhr\.upload\.addEventListener\("progress"/);
  assert.match(checkoutReliabilitySource, /storage\/v1\/object\/payment-proofs/);
  assert.match(indexHtml, /id="proofUploadPercent"/);
  assert.match(indexHtml, /castleSetProofUploadProgress/);
});


test("todos los juegos publicados admiten los tres métodos con sus campos correctos", async () => {
  const games = [
    "Free Fire",
    "Blood Strike",
    "Mobile Legends: Bang Bang",
    "Arena Breakout",
    "PUBG Mobile"
  ];
  for (const game of games) {
    for (const method of ["Transferencia CUP", "Saldo móvil", "USDT"]) {
      const details = game === "Mobile Legends: Bang Bang" ? { zoneId: "5394" } : {};
      if (method === "Transferencia CUP") {
        details.reference = "ABC123";
        details.senderPhone = "55886764";
      } else if (method === "Saldo móvil") {
        details.amount = 120;
        details.senderPhone = "55886764";
      } else {
        details.reference = "a".repeat(64);
        details.amount = 1.25;
      }
      const fixture = makeReliableCheckoutFixture({ game, method, ...details });
      const pending = fixture.window.placeOrder();
      assert.equal(fixture.placeOrderCalls, 1, game + " / " + method + " debe pasar al envío con datos completos");
      fixture.finish();
      assert.equal(await pending, "ok");
    }
  }
});

test("la captura es obligatoria en los métodos de pago externos", async () => {
  const fixture = makeReliableCheckoutFixture({
    game: "Free Fire", method: "Transferencia CUP",
    reference: "ABC123", senderPhone: "55886764", proofFile: false
  });
  await fixture.window.placeOrder();
  assert.equal(fixture.placeOrderCalls, 0);
  assert.match(fixture.elements.ordermsg.textContent, /captura/i);
});

test("la validación y la autorización mantienen los campos de ID de todos los proveedores", () => {
  assert.match(playerValidationEdgeSource, /\["player_id","game_user_id"\]/);
  assert.match(centralOneOrderEdgeSource, /\["player_id","game_user_id"\]/);
  assert.match(centralOneOrderEdgeSource, /targetPayload\[target\.playerKey\]/);
  assert.match(centralOneOrderEdgeSource, /liveTarget\.zoneKey !== storedTarget\.zoneKey/);
});

test("la base de datos exige el archivo almacenado y los datos completos al entrar en revisión", () => {
  assert.match(checkoutGuardMigrationSource, /storage\.objects/);
  assert.match(checkoutGuardMigrationSource, /payment_method = 'Transferencia CUP'/);
  assert.match(checkoutGuardMigrationSource, /payment_method = 'Saldo móvil'/);
  assert.match(checkoutGuardMigrationSource, /payment_method = 'USDT'/);
  assert.match(checkoutGuardMigrationSource, /NEW\.status = 'payment_review'/);
});
