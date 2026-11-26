const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.join(__dirname, "..");
const offlineGuardSource = fs.readFileSync(path.join(root, "assets/offline-guard.js"), "utf8");
const adminPanelSource = fs.readFileSync(path.join(root, "assets/admin-panel.js"), "utf8");
const indexHtml = fs.readFileSync(path.join(root, "index.html"), "utf8");
const paymentGuideHtml = fs.readFileSync(path.join(root, "como-pagar-recargas-juegos-cuba.html"), "utf8");
const gamesGuideHtml = fs.readFileSync(path.join(root, "recargas-juegos-cuba.html"), "utf8");
const aboutGuideHtml = fs.readFileSync(path.join(root, "sobre-tienda-el-castillo.html"), "utf8");
const storefrontPolishSource = fs.readFileSync(path.join(root, "assets/storefront-polish.css"), "utf8");
const coronasPromoCssSource = fs.readFileSync(path.join(root, "assets/coronas-promotions.css"), "utf8");
const serviceWorker = fs.readFileSync(path.join(root, "sw.js"), "utf8");
const checkoutReliabilitySource = fs.readFileSync(path.join(root, "assets/checkout-reliability.js"), "utf8");
const checkoutGuardMigrationSource = fs.readFileSync(path.join(root, "supabase/migrations/20261123170000_harden_checkout_proof_transition.sql"), "utf8");
const playerValidationEdgeSource = fs.readFileSync(path.join(root, "supabase/functions/central-one-player-validate/index.ts"), "utf8");
const centralOneOrderEdgeSource = fs.readFileSync(path.join(root, "supabase/functions/central-one-order/index.ts"), "utf8");
const providerRejectionStatusMigrationSource = fs.readFileSync(path.join(root, "supabase/migrations/20261126031514_map_provider_rejection_to_terminal_order_status.sql"), "utf8");
const coronasProductionMigrationSource = fs.readFileSync(path.join(root, "supabase/migrations/20261124222142_coronas_production_wallet_and_first_purchase_rewards.sql"), "utf8");
const coronasPolicyCleanupSource = fs.readFileSync(path.join(root, "supabase/migrations/20261124222200_coronas_wallet_policy_index_cleanup.sql"), "utf8");
const referralAutoLinkMigrationSource = fs.readFileSync(path.join(root, "supabase/migrations/20261124235603_referral_auto_link_and_one_first_completion_reward.sql"), "utf8");
const centralOrderAutoSyncMigrationSource = fs.readFileSync(path.join(root, "supabase/migrations/20261125133000_central_one_auto_order_status_sync.sql"), "utf8");
const fasterOrderPollingMigrationSource = fs.readFileSync(path.join(root, "supabase/migrations/20261126032200_faster_central_one_order_updates.sql"), "utf8");
const walletRefundDescriptionMigrationSource = fs.readFileSync(path.join(root, "supabase/migrations/20261126041000_customer_friendly_wallet_refund_history.sql"), "utf8");
const walletPromotionCompletionMigrationSource = fs.readFileSync(path.join(root, "supabase/migrations/20261125130148_wallet_promotion_completion_states.sql"), "utf8");
const referralPurchaseVolumeMigrationSource = fs.readFileSync(path.join(root, "supabase/migrations/20261125184000_wallet_referral_purchase_volume.sql"), "utf8");
const walletAutoSubmitMigrationSource = fs.readFileSync(path.join(root, "supabase/migrations/20261123222640_wallet_auto_submit.sql"), "utf8");
const evoPublicationMigrationSource = fs.readFileSync(path.join(root, "supabase/migrations/20261125150000_publish_free_fire_evo_products.sql"), "utf8");
const freeFireEvoPauseMigrationSource = fs.readFileSync(path.join(root, "supabase/migrations/20261125204814_pause_free_fire_evo_items_until_provider_fix.sql"), "utf8");
const freeFireEvoReenableMigrationSource = fs.readFileSync(path.join(root, "supabase/migrations/20261125215000_reenable_free_fire_evo_for_provider_retest.sql"), "utf8");
const coronasPromotionsJsSource = fs.readFileSync(path.join(root, "assets/coronas-promotions.js"), "utf8");


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
  assert.ok(indexHtml.includes("./assets/admin-panel.js?v=25"));
  assert.ok(serviceWorker.includes("shell-v204"));
  assert.ok(serviceWorker.includes('./assets/coronas-promotions.css?v=6'));
  assert.ok(serviceWorker.includes("./assets/offline-guard.js?v=3"));
  assert.ok(serviceWorker.includes("./assets/admin-panel.js?v=25"));
  assert.match(serviceWorker, /keys\.filter\(key =>[\s\S]*key !== CACHE_NAME[\s\S]*key.startsWith\(CACHE_PREFIX\)/);
  assert.ok(indexHtml.includes("./assets/checkout-reliability.js?v=1"));
  assert.ok(indexHtml.includes("./assets/customer-orders-view.js?v=2"));
  assert.ok(serviceWorker.includes("./assets/customer-orders-view.js?v=2"));
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
  assert.match(centralOneOrderEdgeSource, /\[\s*target\.playerKey\s*\]\s*:\s*playerId/);
  assert.match(centralOneOrderEdgeSource, /liveTarget\.zoneKey !== storedTarget\.zoneKey/);
});

test("la base de datos exige el archivo almacenado y los datos completos al entrar en revisión", () => {
  assert.match(checkoutGuardMigrationSource, /storage\.objects/);
  assert.match(checkoutGuardMigrationSource, /payment_method = 'Transferencia CUP'/);
  assert.match(checkoutGuardMigrationSource, /payment_method = 'Saldo móvil'/);
  assert.match(checkoutGuardMigrationSource, /payment_method = 'USDT'/);
  assert.match(checkoutGuardMigrationSource, /NEW\.status IN \('payment_review','processing','completed'\)/);
});

test("la recarga de Coronas usa el flujo guiado de juegos y termina con una confirmación", () => {
  assert.match(indexHtml, /id="walletDepositStep1"/);
  assert.match(indexHtml, /id="walletDepositStep2"/);
  assert.match(indexHtml, /id="walletDepositStep3"/);
  assert.match(indexHtml, /data-step="1"[\s\S]*?data-step="2"[\s\S]*?data-step="3"/);
  assert.match(indexHtml, /id="walletDepositInstructions"/);
  assert.match(indexHtml, /id="walletDepositSenderPhone"/);
  assert.match(indexHtml, /id="walletDepositReference"/);
  assert.match(indexHtml, /id="walletDepositProofPreview"/);
  assert.match(indexHtml, /id="walletDepositProofUploadCircuit"/);
  assert.match(indexHtml, /id="walletDepositSubmit"[^>]*onclick="requestWalletDeposit\(\)"/);
  assert.match(indexHtml, /const target=Math\.max\(1,Math\.min\(3/);
  assert.match(indexHtml, /uploadWalletDepositProofs\(createdDepositId/);
  assert.match(indexHtml, /goWalletDepositStep\(3\)/);
  assert.match(indexHtml, /walletDepositDoneCoronas/);
  assert.match(indexHtml, /setWalletDepositProofUploadProgress\("upload"/);
  assert.match(indexHtml, /files.length!==1/);
  assert.match(indexHtml, /No repitas el pago/);
});
test("el historial de Coronas no vuelve a pedir comprobantes cuando el pago está en revisión", () => {
  assert.match(indexHtml, /const canUpload=deposit\.status==="pending"&&!proofResult\.error&&!proofIds\.has\(deposit\.id\)&&!deposit\.proof_path/);
  assert.doesNotMatch(indexHtml, /const canUpload=\["pending","payment_review"\]/);
  assert.match(indexHtml, /Adjuntar comprobante pendiente \(1 imagen\)/);
});


test("la primera recarga aprobada acredita un 3 % adicional sin tope y solo una vez", () => {
  assert.match(coronasProductionMigrationSource, /if not v_has_previous_deposit then\s+v_welcome_bonus := round\(v_deposit\.credited_amount \* 0\.03,4\);/);
  assert.match(coronasProductionMigrationSource, /if p_approve then[\s\S]*?v_welcome_bonus := round/);
  assert.match(coronasProductionMigrationSource, /'Primera recarga USDT BEP20 aprobada \+ bono del 3 % sin límite'/);
  assert.match(coronasProductionMigrationSource, /welcome_bonus_amount = v_welcome_bonus/);
  assert.match(coronasProductionMigrationSource, /kind = 'deposit'[\s\S]*?currency = 'USD'/);
  assert.match(coronasProductionMigrationSource, /castle-wallet-first-deposit:/);
  assert.match(coronasProductionMigrationSource, /if v_deposit\.status <> 'payment_review' then/);
});

test("la recompensa de invitación es el 5 % de la primera compra completada, no de las siguientes", () => {
  assert.match(coronasProductionMigrationSource, /v_order\.status is distinct from 'completed'/);
  assert.match(coronasProductionMigrationSource, /v_order\.central_one_status is distinct from 'completed'/);
  assert.match(coronasProductionMigrationSource, /v_reward := round\(v_order\.wallet_refund_amount \* 0\.05,4\)/);
  assert.match(coronasProductionMigrationSource, /o\.id <> p_order_id[\s\S]*?o\.status = 'completed'[\s\S]*?o\.central_one_status = 'completed'/);
  assert.match(coronasProductionMigrationSource, /'reward_basis','first_successfully_completed_purchase'/);
});

test("las recompensas de invitación están protegidas contra duplicados y autorreferidos", () => {
  assert.match(coronasProductionMigrationSource, /order_id uuid primary key references public\.orders\(id\)/);
  assert.match(coronasProductionMigrationSource, /wallet_transaction_id uuid not null unique/);
  assert.match(coronasProductionMigrationSource, /v_referrer = v_order\.user_id/);
  assert.match(coronasPolicyCleanupSource, /create unique index if not exists wallet_referral_order_rewards_invitee_active_uidx/);
});

test("las invitaciones quedan guardadas en el enlace y se vinculan sin pegar códigos", () => {
  assert.match(indexHtml, /function captureWalletReferralFromUrl\(\)/);
  assert.match(indexHtml, /walletReferralPendingStorageKey/);
  assert.match(indexHtml, /history\.replaceState/);
  assert.match(indexHtml, /const referralCode=pendingWalletReferralCode\(null\)/);
  assert.match(indexHtml, /signupMetadata\.referral_code=referralCode/);
  assert.match(indexHtml, /return metadata\|\|stored\|\|query/);
  assert.match(indexHtml, /async function tryAutoLinkWalletReferral\(summary\)/);
  assert.match(indexHtml, /db\.rpc\("apply_wallet_referral_code",\{p_code:code\}\)/);
  assert.match(indexHtml, /walletReferralAuthNotice/);
  assert.match(indexHtml, /searchParams\.set\("ref",code\.toUpperCase\(\)\)/);
  assert.doesNotMatch(indexHtml, /walletReferralInput|walletReferralApplyBtn|Vincular código/);
  assert.match(indexHtml, /sin pegar códigos/i);
});

test("la recompensa de invitación solo usa compras creadas después de vincularse y una vez por referido", () => {
  assert.match(referralAutoLinkMigrationSource, /v_order\.created_at < v_linked_at/);
  assert.match(referralAutoLinkMigrationSource, /o\.created_at >= v_linked_at/);
  assert.match(referralAutoLinkMigrationSource, /wallet_referral_order_rewards_invitee_once_uidx/);
  assert.match(referralAutoLinkMigrationSource, /where invitee_user_id = v_order\.user_id/);
  assert.doesNotMatch(referralAutoLinkMigrationSource, /where reversed_at is null/);
  assert.match(referralAutoLinkMigrationSource, /v_reward := round\(v_order\.wallet_refund_amount \* 0\.05,4\)/);
});

test("Supabase devuelve el estado personalizado del bono de primera recarga del 3 %", () => {
  assert.match(walletPromotionCompletionMigrationSource, /welcome_bonus_amount/);
  assert.match(walletPromotionCompletionMigrationSource, /v_first_deposit_status := 'obtained'/);
  assert.match(walletPromotionCompletionMigrationSource, /v_first_deposit_status := 'used'/);
  assert.match(walletPromotionCompletionMigrationSource, /v_first_deposit_status := 'pending'/);
  assert.match(walletPromotionCompletionMigrationSource, /v_first_deposit_status := 'available'/);
  assert.match(walletPromotionCompletionMigrationSource, /'first_deposit_status',v_first_deposit_status/);
  assert.match(walletPromotionCompletionMigrationSource, /'first_deposit_bonus_amount',v_first_deposit_bonus_amount/);
  assert.match(walletPromotionCompletionMigrationSource, /from public\.wallet_transactions/);
  assert.match(walletPromotionCompletionMigrationSource, /kind = 'deposit'/);
  assert.match(walletPromotionCompletionMigrationSource, /currency = 'USD'/);
});

test("el invitador ve cada recompensa del 5 % como pendiente, obtenida o revertida", () => {
  assert.match(walletPromotionCompletionMigrationSource, /'referrals',v_referral_rows/);
  assert.match(walletPromotionCompletionMigrationSource, /when r\.order_id is null then 'pending'/);
  assert.match(walletPromotionCompletionMigrationSource, /when r\.reversed_at is not null then 'reversed'/);
  assert.match(walletPromotionCompletionMigrationSource, /else 'obtained'/);
  assert.match(walletPromotionCompletionMigrationSource, /'referral_rewards_consumed_count',v_reward_consumed/);
  assert.match(walletPromotionCompletionMigrationSource, /'reversed_count',v_reversed/);
});

test("la cuenta invitada ve su tarea completada sin recibir indebidamente el 5 %", () => {
  assert.match(walletPromotionCompletionMigrationSource, /'invited_reward_status',v_invited_reward_status/);
  assert.match(walletPromotionCompletionMigrationSource, /'invited_reward_amount_usd',v_invited_reward_amount/);
  assert.match(indexHtml, /La persona que te invitó ya recibió/);
  assert.match(indexHtml, /TAREA COMPLETADA/);
});

test("la Cartera marca los bonos obtenidos y no oculta la posibilidad de invitar a más amigos", () => {
  assert.match(indexHtml, /id="walletFirstDepositPromoCard"/);
  assert.doesNotMatch(indexHtml, /id="walletReferralPromoCard"/);
  assert.match(indexHtml, /function renderWalletPromotionStates\(data\)/);
  assert.match(indexHtml, /firstStatus==="obtained"/);
  assert.match(indexHtml, /firstStatus==="pending"/);
  assert.match(indexHtml, /referrals\.filter\(row=>row\.status==="obtained"\)/);
  assert.doesNotMatch(indexHtml, /id="walletReferralRewardList"/);
  assert.match(indexHtml, /Puedes seguir invitando/);
  assert.match(indexHtml, /const firstStatus=String\(walletReferralSummary\?\.first_deposit_status/);
  assert.match(indexHtml, /renderWalletPromotionStates\(data\)/);
  assert.match(coronasPromoCssSource, /\.coronas-promo-card\[data-promo-state="obtained"\]/);
  assert.match(coronasPromoCssSource, /\.wallet-referral-reward-row\[data-reward-state="obtained"\]/);
  assert.match(indexHtml, /onclick="shareWalletReferralLink\(\)"/);
});

test("la comisión de invitación se revierte ante fallo, rechazo o cancelación después de una entrega", () => {
  assert.match(coronasProductionMigrationSource, /old\.central_one_status = 'completed' or old\.status = 'completed'/);
  assert.match(coronasProductionMigrationSource, /new\.central_one_status in \('failed','cancelled','rejected'\)/);
  assert.match(coronasProductionMigrationSource, /private\.reverse_wallet_referral_order_reward\(\s+new\.id/);
  assert.match(coronasProductionMigrationSource, /if not found or v_reward\.reversed_at is not null then\s+return 0/);
});

test("Central One consulta automáticamente pedidos enviados que siguen abiertos", () => {
  assert.match(centralOneOrderEdgeSource, /async function authorizeScheduledOrderSync/);
  assert.match(centralOneOrderEdgeSource, /authorize_central_one_sync/);
  assert.match(centralOneOrderEdgeSource, /async function syncOpenOrders/);
  assert.match(centralOneOrderEdgeSource, /action==="sync_open_orders"/);
  assert.match(centralOneOrderEdgeSource, /central_one_order_id.*not\.is\.null/);
  assert.match(centralOneOrderEdgeSource, /central_one_status.*in\.\(created,confirmed,processing,partially_completed,unknown,retryable,rejected\)/);
  assert.match(centralOneOrderEdgeSource, /lookup\.searchParams\.set\("status","eq\.processing"\)/);
  assert.match(centralOneOrderEdgeSource, /else if \(data\.provider_status === "rejected"\) rejected\+\+/);
  assert.match(centralOneOrderEdgeSource, /refreshOrder\(orderId\)/);
  assert.match(centralOneOrderEdgeSource, /Math\.min\(3,orderIds\.length\)/);
  assert.match(centralOneOrderEdgeSource, /x-sync-token/);
  assert.match(centralOneOrderEdgeSource, /allowed_actions:\[\"submit\",\"submit_wallet\",\"refresh\",\"sync_open_orders\"\]/);
});

test("la sincronización de pedidos de Central One se programa cada minuto con el secreto existente", () => {
  assert.match(centralOrderAutoSyncMigrationSource, /cron\.schedule\([\s\S]*'\*\/1 \* \* \* \*'/);
  assert.match(centralOrderAutoSyncMigrationSource, /functions\/v1\/central-one-order/);
  assert.match(centralOrderAutoSyncMigrationSource, /x-sync-token/);
  assert.match(centralOrderAutoSyncMigrationSource, /vault\.decrypted_secrets/);
  assert.match(centralOrderAutoSyncMigrationSource, /sync_open_orders/);
  assert.match(centralOrderAutoSyncMigrationSource, /timeout_milliseconds := 50000/);
});

test("cliente y administración reciben las actualizaciones de pedidos sin recargar la página", () => {
  assert.match(indexHtml, /customerOrderChannel=db\.channel/);
  assert.match(indexHtml, /table:"orders",filter:"user_id=eq\."\+userId/);
  assert.match(indexHtml, /customerOrderPoll=setInterval/);
  assert.match(indexHtml, /loadMyOrders\(\);/);
  assert.match(indexHtml, /adminOrderChannel=db\.channel/);
  assert.match(indexHtml, /adminOrderPoll=setInterval/);
  assert.match(indexHtml, /loadAllOrders\(\{silent:true\}\)/);
  assert.match(indexHtml, /function stopCustomerOrderRealtime/);
  assert.match(indexHtml, /function stopAdminPaymentPolling/);
});

test("las compras de Coronas conservan la clave histórica y son idempotentes", () => {
  assert.match(coronasProductionMigrationSource, /wallet_request_id = p_request_id/);
  assert.match(coronasProductionMigrationSource, /'already_processed',true/);
  assert.match(coronasProductionMigrationSource, /'Saldo de Tienda El Castillo'/);
  assert.match(coronasProductionMigrationSource, /wallet_transactions\(user_id,order_id,kind,amount,currency,description\)/);
});

test("la función de proveedor conserva rechazos y solo devuelve Coronas cuando Central One confirma el reembolso", () => {
  assert.match(centralOneOrderEdgeSource, /\["failed","cancelled","rejected"\]\.includes\(status\)/);
  assert.match(centralOneOrderEdgeSource, /refund\?\.refunded !== true\) return null/);
  assert.match(centralOneOrderEdgeSource, /refund_wallet_order_after_provider_refund/);
});

test("la rama de liberación usa producción y enruta las funciones reales; los simuladores quedan aislados a pruebas", () => {
  assert.match(indexHtml, /const STORE_SUPABASE_URL="https:\/\/kfllglkfncebpknnugnx\.supabase\.co"/);
  assert.ok(indexHtml.includes('function storeFunctionUrl(name){\n return STORE_SUPABASE_URL+"/functions/v1/"+name;\n}'));
  assert.ok(indexHtml.includes('"central-one-order"'));
  assert.ok(!indexHtml.includes("coronas-staging-"));
  assert.match(indexHtml, /Coronas/i);
  assert.match(indexHtml, /coronas-promotions\.js\?v=2/);
});

 
test("la tasa inicial de Coronas coincide con la configuración productiva actual y la FAQ no fija una tasa obsoleta", () => {
  assert.match(indexHtml, /walletSettings=\{cup_per_usd:1230,/);
  assert.match(indexHtml, /walletCupRate[^>]+value="1230"/);
  assert.match(indexHtml, /pricingUsdtRate[^>]+value="1230"/);
  assert.doesNotMatch(indexHtml, /1\.160 CUP por Corona|1160 CUP, equivalente a 1 Corona/);
});


function extractNamedFunction(source, name) {
  const start = source.indexOf("function " + name + "(");
  assert.notEqual(start, -1, "No se encontró la función " + name);
  const open = source.indexOf("{", start);
  let depth = 0;
  let quote = "";
  let escaped = false;
  for (let i = open; i < source.length; i++) {
    const char = source[i];
    if (quote) {
      if (escaped) escaped = false;
      else if (char === "\\") escaped = true;
      else if (char === quote) quote = "";
      continue;
    }
    if (char === "'" || char === '"' || char === "`") {
      quote = char;
      continue;
    }
    if (char === "{") depth++;
    else if (char === "}") {
      depth--;
      if (depth === 0) return source.slice(start, i + 1);
    }
  }
  throw new Error("La función " + name + " no tiene un cierre válido.");
}

test("cambiar entre CUP, saldo móvil y USDT conserva el método elegido y adapta ambos pasos", () => {
  const source = extractNamedFunction(indexHtml, "updateWalletDepositMethod");
  const cases = [
    ["Transferencia CUP", "Cantidad exacta que transferirás (CUP)", "1. ¿Cuánto vas a transferir?"],
    ["Saldo móvil", "Unidades de saldo móvil que enviarás", "1. ¿Cuánto saldo móvil enviarás?"],
    ["USDT", "Cantidad de USDT que enviarás", "1. ¿Cuánto USDT enviarás?"]
  ];

  for (const [method, expectedLabel, expectedTitle] of cases) {
    const label = () => ({ textContent: "", value: "" });
    const elements = {
      walletDepositMethod: { value: method, innerHTML: "", disabled: false },
      walletDepositAmount: { value: "22", type: "number", inputMode: "", min: "1", step: "1", placeholder: "" },
      walletDepositAmountLabel: label(),
      walletDepositAmountHint: label(),
      walletDepositMethodHint: label(),
      walletDepositStep1Title: label(),
      walletDepositStep1Help: label(),
      walletDepositStep2Title: label(),
      walletDepositStep2Help: label(),
      walletDepositFormIntroTitle: label(),
      walletDepositFormIntroHelp: label(),
      walletDepositSenderPhoneWrap: {
        classList: { states: {}, toggle(name, value) { this.states[name] = value; } },
        querySelector() { return phoneLabel; }
      },
      walletDepositReferenceWrap: { classList: { states: {}, toggle(name, value) { this.states[name] = value; } } },
      walletDepositTxidWrap: { classList: { states: {}, toggle(name, value) { this.states[name] = value; } } },
      walletDepositProofHelp: { replaceChildren(node) { this.textContent = node.textContent; } },
      walletDepositReferenceLabel: label(),
      walletDepositSubmit: { disabled: false },
      walletDepositProof: { value: "proof" },
      walletDepositSenderPhone: { value: "55886764" },
      walletDepositReference: { value: "ABC123" },
      walletDepositTxid: { value: "0xabc" }
    };
    const phoneLabel = label();
    const sandbox = {
      $: id => elements[id] || null,
      clean: value => String(value ?? ""),
      money: value => String(value),
      walletDepositMethodPrevious: "Transferencia CUP",
      walletDepositAvailableMethods: () => ["Transferencia CUP", "Saldo móvil", "USDT"],
      walletSettings: { cup_per_usd: 1230 },
      walletMobileUnitsPerCorona: () => 369,
      previewWalletDepositProof() {},
      updateWalletDepositInstructions() {},
      previewWalletDeposit() {},
      document: { createTextNode: textContent => ({ textContent }) }
    };
    vm.runInNewContext(source, sandbox);
    sandbox.updateWalletDepositMethod(true);

    assert.equal(elements.walletDepositMethod.value, method, method + " debe mantenerse seleccionado");
    assert.equal(elements.walletDepositAmountLabel.textContent, expectedLabel);
    assert.equal(elements.walletDepositStep1Title.textContent, expectedTitle);
    assert.match(elements.walletDepositStep2Title.textContent, new RegExp(method === "Saldo móvil" ? "saldo móvil" : method));
    assert.equal(elements.walletDepositFormIntroHelp.textContent.includes("bancaria"), method === "Transferencia CUP");

    // Una actualización posterior no debe restaurar el método anterior.
    sandbox.walletDepositMethodPrevious = "Transferencia CUP";
    sandbox.updateWalletDepositMethod(false);
    assert.equal(elements.walletDepositMethod.value, method, method + " debe conservarse aunque exista un método anterior");
  }
});

test("el panel de Coronas usa un icono propio y no superpone la marca de agua", () => {
  assert.match(indexHtml, /assets\/corona-coin\.svg/);
  assert.doesNotMatch(indexHtml, /class="wallet-watermark"/);
  assert.match(storefrontPolishSource, /\.wallet-hero:after,\.wallet-watermark\{display:none!important/);
  assert.match(storefrontPolishSource, /\.wallet-coin-art img/);
  assert.match(indexHtml, /Valor de referencia: 1 Corona equivale a 1 USD al pagar paquetes en la tienda/);
  assert.doesNotMatch(indexHtml, /1:1: 1 Corona = 1 USD/);
});

test("las tres promociones usan arte propio de la tienda y el carrusel evita fondos morados dominantes", () => {
  assert.match(indexHtml, /promo-first-coronas\.svg/);
  assert.match(indexHtml, /promo-invite-coronas\.svg/);
  assert.match(indexHtml, /promo-shop-coronas\.svg/);
  assert.match(coronasPromoCssSource, /#10284f/);
  assert.match(coronasPromoCssSource, /#2868c7/);
  assert.doesNotMatch(coronasPromoCssSource, /#4c1b83|#762ca5|#a34bce/);
});

test("la portada publica las ofertas Evo LATAM con stock y validación, sin exponer las agotadas", () => {
  const allowedIds = [
    "11251c9b-4966-4210-969e-3d4ffdfb70aa",
    "b1b110f9-45dc-4226-a2b2-f5c8041095af",
    "5552cdf0-92e1-4358-9a5b-9f0e21e056a3",
    "a7d58f19-3ace-49a8-be09-0e5edde9d448",
    "51825a7b-68b0-4d1d-84e8-36367d316844",
    "f6133c86-37cd-48af-8868-dc44cce482a8",
    "64e90b95-ccf8-40da-9c4b-37e5e25e32d5"
  ];
  for (const id of allowedIds) assert.ok(evoPublicationMigrationSource.includes(id), "falta el paquete Evo " + id);
  assert.match(evoPublicationMigrationSource, /provider_region = 'LATAM'/);
  assert.match(evoPublicationMigrationSource, /provider_status = 'active'/);
  assert.match(evoPublicationMigrationSource, /provider_in_stock is true/);
  assert.match(evoPublicationMigrationSource, /provider_validation_supported is true/);
  assert.match(evoPublicationMigrationSource, /provider_requires_target is true/);
  assert.ok(evoPublicationMigrationSource.includes("provider_target_fields = '[\"player_id\"]'::jsonb"));
  assert.match(evoPublicationMigrationSource, /provider_synced_at >= now\(\) - interval '30 minutes'/);
  assert.doesNotMatch(evoPublicationMigrationSource, /a9cfa9a9-2310-4167-bdb9-6740413660dc/);
  assert.match(indexHtml, /function freeFirePackageGroup[\s\S]*?fragmentos\.\*evo\|evo\.\*fragmentos[\s\S]*?return "evo"/);
  assert.match(indexHtml, /freeFirePlanIcon[\s\S]*?ff-evo-crate\.webp/);
  assert.match(indexHtml, /freeFirePlanIcon[\s\S]*?ff-evo-token\.webp/);
  assert.match(playerValidationEdgeSource, /providerValidationFlag/);
  assert.match(playerValidationEdgeSource, /This is a read\/validation request only/);
});

test("la portada conserva promociones, controles del carrusel y presentación adaptable", () => {
  assert.match(indexHtml, /id="homeView"/);
  assert.match(indexHtml, /class="home-intro"/);
  assert.match(indexHtml, /id="coronasPromoCarousel"/);
  assert.match(indexHtml, /class="coronas-promo-heading"/);
  assert.match(indexHtml, /Promociones de Tienda El Castillo/);
  assert.match(indexHtml, /Ofertas y beneficios para nuestra comunidad/);
  assert.match(coronasPromoCssSource, /\.coronas-promo-carousel\s*\{[\s\S]*border:2px solid #c7d9f1/);
  assert.match(coronasPromoCssSource, /\.coronas-promo-heading\s*\{/);
  assert.ok(indexHtml.includes("./assets/coronas-promotions.css?v=6"));
  assert.ok(serviceWorker.includes("./assets/coronas-promotions.css?v=6"));
  assert.match(indexHtml, /data-coronas-slide="0"/);
  assert.match(indexHtml, /data-coronas-prev/);
  assert.match(indexHtml, /data-coronas-next/);
  assert.match(indexHtml, /data-coronas-dot="2"/);
  assert.match(storefrontPolishSource, /#homeView \.home-intro\s*\{/);
  assert.match(indexHtml, /#homeGames\{grid-template-columns:repeat\(2,minmax\(0,1fr\)\)/);
  assert.match(coronasPromoCssSource, /\.coronas-promo-slide\.is-active/);
  assert.match(coronasPromotionsJsSource, /data-coronas-prev/);
  assert.match(coronasPromotionsJsSource, /data-coronas-next/);
  assert.match(coronasPromotionsJsSource, /data-coronas-dot/);
  assert.match(coronasPromotionsJsSource, /document\.addEventListener\("visibilitychange"/);
});

test("la guía de pagos explica Coronas y ya no muestra el nombre anterior del saldo", () => {
  assert.match(paymentGuideHtml, /<h3>Coronas<\/h3>/);
  assert.match(paymentGuideHtml, /Cartera tenga saldo suficiente/);
  assert.doesNotMatch(paymentGuideHtml, /Saldo de Tienda El Castillo|saldo interno de Tienda El Castillo/);
  assert.match(paymentGuideHtml, /\"dateModified\":\"2026-11-24\"/);
});


test("todas las guías públicas usan Coronas y explican la Cartera", () => {
  for (const [name, source] of [["pagos", paymentGuideHtml], ["recargas de juegos", gamesGuideHtml], ["sobre la tienda", aboutGuideHtml]]) {
    assert.doesNotMatch(source, /saldo interno de Tienda El Castillo|Saldo de Tienda El Castillo/, name + " no debe mostrar la etiqueta anterior");
  }
  assert.match(gamesGuideHtml, /Coronas de Tienda El Castillo/);
  assert.match(aboutGuideHtml, /Coronas de Tienda El Castillo/);
  assert.match(paymentGuideHtml, /Cartera tenga saldo suficiente/);
});

test("los mensajes visibles del historial y perfil hablan de Coronas y Cartera, manteniendo la clave interna compatible", () => {
  assert.match(indexHtml, /No se pudo cargar tu Cartera[\s\S]*pagar con Coronas/);
  assert.match(indexHtml, /Pago realizado con Coronas/);
  assert.match(indexHtml, /Cartera actualizada con la devolución/);
  assert.match(indexHtml, /Devolución de Coronas en revisión/);
  assert.match(indexHtml, /<option value="Saldo de Tienda El Castillo">Coronas<\/option>/);
  assert.match(indexHtml, /name:"Saldo de Tienda El Castillo",short:"Coronas"/);
});


test("las compras con Coronas se registran en un apartado administrativo separado", () => {
  assert.match(indexHtml, /id="walletPurchasesAdmin"/);
  assert.match(indexHtml, /id="walletPurchaseAdminCount"/);
  assert.match(indexHtml, /id="walletPurchaseAdminTotal"/);
  assert.match(indexHtml, /async function loadWalletPurchasesAdmin\(\)/);
  assert.match(indexHtml, /\.eq\("kind","purchase"\)\s*\.eq\("currency","USD"\)/);
  assert.match(indexHtml, /db\.from\("orders"\)[\s\S]*?payment_source/);
  assert.match(indexHtml, /db\.from\("profiles"\)[\s\S]*?full_name,email/);
  assert.match(indexHtml, /Revisar registro/);
  assert.match(indexHtml, /Coste descontado:/);
  assert.match(adminPanelSource, /if\(selected==="wallet"\)[\s\S]*?loadWalletDepositsAdmin[\s\S]*?loadWalletPurchasesAdmin/);
});

test("la recarga externa de Coronas continúa pendiente hasta la aprobación manual", () => {
  assert.match(indexHtml, /status:"pending"/);
  assert.match(indexHtml, /admin_review_wallet_deposit/);
  assert.match(indexHtml, /¿Confirmas la aprobación manual\?/);
  assert.match(coronasProductionMigrationSource, /if v_deposit\.status <> 'payment_review' then/);
  assert.match(coronasProductionMigrationSource, /if p_approve then/);
  assert.match(coronasProductionMigrationSource, /insert into public\.wallet_transactions\([\s\S]*?'deposit'/);
  assert.match(coronasProductionMigrationSource, /set status = 'approved'/);
});

test("la compra con Coronas se cobra una vez y dispara el envío automático al juego", () => {
  assert.match(coronasProductionMigrationSource, /wallet_request_id = p_request_id/);
  assert.match(coronasProductionMigrationSource, /insert into public\.wallet_transactions\(user_id,order_id,kind,amount,currency,description\)[\s\S]*?'purchase'/);
  assert.match(walletAutoSubmitMigrationSource, /CREATE OR REPLACE FUNCTION public\.claim_central_one_wallet_order/);
  assert.match(walletAutoSubmitMigrationSource, /v_order\.payment_source IS DISTINCT FROM 'wallet'/);
  assert.match(walletAutoSubmitMigrationSource, /kind = 'purchase'/);
  assert.match(centralOneOrderEdgeSource, /action==="submit_wallet"/);
  assert.match(indexHtml, /requestWalletAutoOrder\(result\.data\.order_id\)/);
  assert.match(indexHtml, /no necesitas esperar aprobación administrativa/i);
});

test("las miniaturas conservan el escudo pequeño y la cartera muestra una sola invitación", () => {
  const gameTileStart = indexHtml.indexOf("function gameTile(");
  const gameTileEnd = indexHtml.indexOf("function giftTile(", gameTileStart);
  assert.ok(gameTileStart >= 0 && gameTileEnd > gameTileStart);
  const gameTileSource = indexHtml.slice(gameTileStart, gameTileEnd);
  assert.ok(gameTileSource.includes('const brandBadge=homePreview?"":'));
  assert.ok(gameTileSource.includes('class="game-art-brand-badge"'));
  assert.ok(gameTileSource.includes("'+image+brandBadge+"));
  assert.match(gameTileSource, /el-castillo-icon\.webp/);
  assert.ok(indexHtml.includes('class="brand-logo"'));
  assert.ok(indexHtml.includes('src="./assets/el-castillo-logo.webp"'));
  const headerStart = indexHtml.indexOf('<header id="siteHeader"');
  const headerEnd = indexHtml.indexOf("</header>", headerStart);
  assert.ok(headerStart >= 0 && headerEnd > headerStart);
  const headerSource = indexHtml.slice(headerStart, headerEnd);
  assert.match(headerSource, /class="brand-logo" src="\.\/assets\/el-castillo-icon\.webp"/);
  assert.doesNotMatch(headerSource, /el-castillo-logo\.webp/);
  assert.doesNotMatch(headerSource, /header-account-brand-icon|header-action-brand-icon|notification-brand-icon|account-header-btn/);
  assert.match(headerSource, /<button class="header-btn notification-header-btn hidden" id="notificationsButton"[^>]*onclick="openNotificationCenter\(\)"/);
  assert.match(headerSource, /<button class="header-btn" type="button" onclick="currentUser\?showView\('profile'\):openAccount\(\)">Mi cuenta<\/button>/);
  assert.match(indexHtml, /RECARGAS DE JUEGOS EN CUBA/);
  assert.doesNotMatch(indexHtml, /Más que una tienda|MÁS QUE UNA TIENDA/);
  assert.match(storefrontPolishSource, /\.game-art-brand-badge/);

  const inviteStart = indexHtml.indexOf('<section class="wallet-panel coronas-referral-panel"');
  const inviteEnd = indexHtml.indexOf("</section>", inviteStart);
  assert.ok(inviteStart >= 0 && inviteEnd > inviteStart);
  const inviteSection = indexHtml.slice(inviteStart, inviteEnd);
  assert.match(inviteSection, /id="coronasReferralTitle">Invita a un amigo/);
  assert.ok(inviteSection.includes('class="coronas-referral-art"'));
  assert.ok(inviteSection.includes("promo-invite-coronas.svg"));
  assert.ok(inviteSection.includes('class="coronas-referral-reward"><strong>5 %</strong><span>de su primera compra</span>'));
  assert.match(inviteSection, /Recibes esta recompensa cuando el proveedor confirme/);
  assert.match(inviteSection, /onclick="shareWalletReferralLink\(\)">Compartir invitación/);
  assert.equal((inviteSection.match(/<button\b/g) || []).length, 1);
  assert.doesNotMatch(inviteSection, /Copiar enlace|walletReferralCode|walletReferralRewardList/);
  assert.match(inviteSection, /id="walletReferralStats"/);
  assert.match(inviteSection, /Amigos vinculados/);
  assert.match(inviteSection, /Compras premiadas/);
  assert.doesNotMatch(inviteSection, /Ventas generadas/);
  assert.match(inviteSection, /Ganancia obtenida \(5 %\)/);
  assert.doesNotMatch(indexHtml, /id="walletReferralPromoCard"|id="walletInviteProgress"/);
  assert.doesNotMatch(indexHtml, />\s*Copiar enlace\s*</);
  assert.match(indexHtml, /Tu solicitud quedará pendiente mientras la tienda verifica que el pago se haya recibido correctamente/);
  assert.match(indexHtml, /Cuando confirmemos la recepción del dinero, acreditaremos las Coronas en tu cartera/);
  assert.doesNotMatch(indexHtml, /cuando tú lo apruebes|hasta que revises y apruebes la recepción real del pago/i);
  assert.ok(serviceWorker.includes("shell-v204"));
  assert.match(storefrontPolishSource, /\.coronas-referral-share/);
  assert.ok(indexHtml.includes("./assets/storefront-polish.css?v=29"));
  assert.ok(serviceWorker.includes("shell-v204"));
  assert.ok(serviceWorker.includes("./assets/storefront-polish.css?v=29"));
  assert.ok(serviceWorker.includes("./assets/el-castillo-icon.webp"));
});


test("la Cartera muestra solo cuentas vinculadas, compras premiadas y ganancias por invitación", () => {
  assert.match(indexHtml, /id="walletReferralStats"/);
  assert.match(indexHtml, /Amigos vinculados/);
  assert.match(indexHtml, /Compras premiadas/);
  assert.match(indexHtml, /Ganancia obtenida \(5 %\)/);
  assert.doesNotMatch(indexHtml, /Ventas generadas/);
  const source = extractNamedFunction(indexHtml, "loadWalletPromotions");
  assert.doesNotMatch(source, /get_wallet_referral_purchase_volume|purchase_volume_usd/);
  assert.match(indexHtml, /Tu ganancia del 5 % se acredita automáticamente en Coronas/);
});

test("Gestión de Coronas se separa en apartados y solo carga la pestaña abierta", () => {
  for (const section of ["deposits", "referrals", "purchases", "settings"]) {
    assert.match(indexHtml, new RegExp('data-wallet-admin-section="' + section + '"'));
    assert.match(indexHtml, new RegExp('data-wallet-admin-tab="' + section + '"'));
  }
  assert.match(adminPanelSource, /setupWalletAdminTabs\(panels\[5\]\)/);
  assert.match(adminPanelSource, /function showWalletAdminSection\(section,loadData=true\)/);
  assert.match(adminPanelSource, /if\(loadData&&activeWalletAdminSection==="deposits"/);
  assert.match(adminPanelSource, /if\(loadData&&activeWalletAdminSection==="referrals"/);
  assert.match(adminPanelSource, /if\(loadData&&activeWalletAdminSection==="purchases"/);
  assert.ok(serviceWorker.includes("shell-v204"));
  assert.ok(indexHtml.includes("./assets/admin-panel.css?v=34"));
  assert.ok(indexHtml.includes("./assets/admin-panel.js?v=25"));
});

test("las recargas de Coronas se muestran resumidas y permiten abrir cada captura en el visor ampliado", () => {
  assert.match(indexHtml, /<details class="wallet-admin-card wallet-admin-collapsible wallet-admin-deposit-card"/);
  assert.match(indexHtml, /data-wallet-proof-preview/);
  assert.match(indexHtml, /async function openWalletDepositProof\(button\)/);
  assert.match(indexHtml, /showOrderProofPreview\(data\.signedUrl/);
  assert.match(indexHtml, /if\(details\.amountLabel\)addInfo\("IMPORTE ENVIADO"/);
  assert.match(indexHtml, /const canReview=d\.status==="payment_review"&&proofsAccessible/);
});

test("invitaciones y compras pagadas con Coronas también usan resúmenes desplegables", () => {
  assert.match(indexHtml, /wallet-admin-referral-card/);
  assert.match(indexHtml, /wallet-admin-referral-summary/);
  assert.match(indexHtml, /wallet-purchase-admin-card" data-wallet-purchase-card/);
  assert.match(indexHtml, /wallet-admin-purchase-summary/);
});


test("Wallet conserva las solicitudes visibles y limita las consultas de administración a las 50 más recientes", () => {
  const deposits = extractNamedFunction(indexHtml, "loadWalletDepositsAdmin");
  const purchases = extractNamedFunction(indexHtml, "loadWalletPurchasesAdmin");
  assert.ok(deposits.includes("walletDepositsAdminLoadPromise"));
  assert.ok(deposits.includes('list.dataset.loaded==="1"'));
  assert.ok(deposits.includes(".limit(50)"));
  assert.ok(deposits.includes("La lista anterior permanece visible"));
  assert.ok(!deposits.includes('list.textContent="Cargando recargas…"'));
  assert.ok(purchases.includes("walletPurchasesAdminLoadPromise"));
  assert.ok(purchases.includes('list.dataset.loaded==="1"'));
  assert.ok(purchases.includes(".limit(50)"));
  assert.ok(purchases.includes("La lista anterior permanece visible"));
  assert.ok(!purchases.includes('list.textContent="Cargando compras pagadas con Coronas…"'));
  assert.ok(indexHtml.includes("function walletAdminSectionIsVisible(section)"));
  assert.ok(indexHtml.includes('table:"wallet_transactions",filter:"kind=eq.purchase"'));
  const polling = extractNamedFunction(indexHtml, "startAdminPaymentPolling");
  assert.ok(polling.includes('walletAdminSectionIsVisible("deposits")'));
  assert.ok(polling.includes('walletAdminSectionIsVisible("purchases")'));
  const openStore = extractNamedFunction(indexHtml, "openStore");
  assert.ok(!openStore.includes("depósitos de administración"));
});


test("el historial de recargas del cliente no expone enlaces ni datos internos del comprobante", () => {
  const history = extractNamedFunction(indexHtml, "loadMyWalletDeposits");
  assert.ok(history.includes('select("id,status,amount,currency,payment_method,credited_amount,welcome_bonus_amount,created_at,proof_path")'));
  assert.ok(history.includes('select("deposit_id")'));
  assert.ok(history.includes('node("details","wallet-customer-deposit-card")'));
  assert.ok(history.includes("wallet-customer-deposit-card"));
  assert.doesNotMatch(history, /createSignedUrl|signedUrl|wallet-proof-links|createSignedWalletProofLinks/);
  assert.doesNotMatch(history, /deposit\.(admin_notes|payment_reference|sender_phone|recipient_address|txid|exchange_rate)/);
  assert.match(history, /No pudimos verificar el estado de los comprobantes/);
  assert.match(history, /data-wallet-deposit-history-id/);
});

test("el paso de confirmación de una recarga es temporal y el asistente vuelve al primer paso", () => {
  const reset = extractNamedFunction(indexHtml, "resetWalletDepositWizard");
  const schedule = extractNamedFunction(indexHtml, "scheduleWalletDepositConfirmationReset");
  const submit = extractNamedFunction(indexHtml, "requestWalletDeposit");
  const scrollHistory = extractNamedFunction(indexHtml, "scrollWalletDepositHistory");
  assert.match(reset, /walletDepositDoneTimer/);
  assert.match(reset, /goWalletDepositStep\(1\)/);
  assert.match(schedule, /setTimeout/);
  assert.match(schedule, /15000/);
  assert.match(schedule, /resetWalletDepositWizard/);
  assert.ok(submit.indexOf("goWalletDepositStep(3)") < submit.indexOf("scheduleWalletDepositConfirmationReset()"));
  assert.match(scrollHistory, /resetWalletDepositWizard/);
});

test("el historial de recargas del cliente usa tarjetas desplegables ligeras", () => {
  assert.match(coronasPromoCssSource, /\.wallet-customer-deposit-list/);
  assert.match(coronasPromoCssSource, /\.wallet-customer-deposit-card\[open\]/);
  assert.ok(indexHtml.includes("./assets/coronas-promotions.css?v=6"));
  assert.ok(serviceWorker.includes("shell-v204"));
  assert.ok(serviceWorker.includes("./assets/coronas-promotions.css?v=6"));
});


test("las cajas y los fragmentos EVO de Free Fire quedan pausados también después de sincronizar el catálogo", () => {
  assert.ok(freeFireEvoPauseMigrationSource.includes("v_name not ilike '%fragmentos% evo%'"));
  assert.ok(freeFireEvoPauseMigrationSource.includes("set active = false, storefront_visible = false"));
  assert.ok(freeFireEvoPauseMigrationSource.includes("where game = 'Free Fire'"));
  assert.ok(freeFireEvoPauseMigrationSource.includes("name ilike '%fragmentos% evo%'"));
  assert.ok(freeFireEvoPauseMigrationSource.includes("private.sync_free_fire_provider_products"));
});

test("los detalles visibles al cliente nunca revelan el nombre ni los datos del proveedor", () => {
  const detail = extractNamedFunction(indexHtml, "renderCustomerOrderDetailHtml");
  assert.doesNotMatch(detail, /Central One|central-one|provider_product_id|provider_order_id|provider_sku/);
  assert.match(detail, /El pago se realizó con tus Coronas/);
  assert.match(detail, /No pudimos completar la recarga/);
  assert.match(detail, /El equipo de Tienda El Castillo está revisando tu pedido/);
});

test("el cliente actualiza el seguimiento de pedidos por tiempo real y al volver a la pestaña", () => {
  const refresh = extractNamedFunction(indexHtml, "refreshCustomerOrderData");
  const resume = extractNamedFunction(indexHtml, "installCustomerOrderResumeListeners");
  const realtime = extractNamedFunction(indexHtml, "startCustomerOrderRealtime");
  assert.ok(refresh.includes("loadMyOrders"));
  assert.ok(refresh.includes("loadWalletData"));
  assert.ok(refresh.includes("Promise.allSettled"));
  assert.ok(resume.includes("visibilitychange"));
  assert.ok(resume.includes("focus"));
  assert.ok(resume.includes("online"));
  assert.ok(realtime.includes("postgres_changes"));
  assert.ok(realtime.includes(".subscribe(status=>"));
  assert.ok(realtime.includes('status==="SUBSCRIBED"'));
  assert.ok(realtime.includes("CHANNEL_ERROR"));
  assert.ok(realtime.includes("TIMED_OUT"));
  assert.ok(realtime.includes("CLOSED"));
  assert.ok(realtime.includes("customerOrderPoll=setInterval"));
  assert.ok(realtime.includes("30000"));
  assert.doesNotMatch(realtime, /Central One|central-one/);
});

test("el panel administrativo también se recupera al reabrir el navegador", () => {
  const refresh = extractNamedFunction(indexHtml, "refreshAdminOrderViews");
  const resume = extractNamedFunction(indexHtml, "installAdminOrderResumeListeners");
  const realtime = extractNamedFunction(indexHtml, "startAdminPaymentPolling");
  assert.ok(refresh.includes("loadAllOrders"));
  assert.ok(refresh.includes("loadWalletPurchasesAdmin"));
  assert.ok(resume.includes("visibilitychange"));
  assert.ok(resume.includes("focus"));
  assert.ok(resume.includes("online"));
  assert.ok(realtime.includes("postgres_changes"));
  assert.ok(realtime.includes(".subscribe(status=>"));
  assert.ok(realtime.includes("adminOrderPoll=setInterval"));
  assert.ok(realtime.includes("30000"));
});

test("la recompensa por invitación acredita el 5 % de la compra automáticamente al confirmar la entrega", () => {
  assert.ok(coronasProductionMigrationSource.includes("round(v_order.wallet_refund_amount * 0.05,4)"));
  assert.ok(coronasProductionMigrationSource.includes("'adjustment'"));
  assert.ok(coronasProductionMigrationSource.includes("'USD'"));
  assert.ok(coronasProductionMigrationSource.includes("private.handle_wallet_referral_order_status"));
  assert.ok(coronasProductionMigrationSource.includes("perform private.credit_wallet_referral_order_reward(new.id)"));
  assert.ok(referralAutoLinkMigrationSource.includes("v_order.created_at < v_linked_at"));
  assert.ok(referralAutoLinkMigrationSource.includes("wallet_referral_order_rewards_invitee_once_uidx"));
});


test("los mensajes de acceso explican qué corregir y se muestran con contraste legible", () => {
  assert.match(indexHtml, /function setReadableFormMessage\(node,message,type="info"\)/);
  assert.match(indexHtml, /function setAuthMessage\(message,type="error"\)/);
  assert.match(indexHtml, /function markAuthFieldErrors\(fieldIds,message\)/);
  assert.match(indexHtml, /El correo o la contraseña no coinciden/);
  assert.match(indexHtml, /Si no la recuerdas, pulsa «¿Olvidaste tu contraseña\?»/);
  assert.match(indexHtml, /Escribe tu contraseña para continuar/);
  assert.match(indexHtml, /Revisa el correo\. Debe tener un formato parecido a nombre@correo\.com/);
  assert.match(indexHtml, /\.msg\.is-error\{[^}]*background:#fff0f2/s);
  assert.match(indexHtml, /\.msg:empty\{display:none\}/);
  assert.match(indexHtml, /input\[aria-invalid="true"\]/);
  assert.match(indexHtml, /aria-live",isError\?"assertive":"polite"/);
  assert.match(indexHtml, /required aria-describedby="authmsg"/);
});

test("el alta de cuenta informa los campos obligatorios con instrucciones concretas", () => {
  assert.match(indexHtml, /Escribe tu nombre para identificar tu cuenta/);
  assert.match(indexHtml, /Escribe el correo electrónico que quieres usar/);
  assert.match(indexHtml, /La contraseña debe tener al menos 8 caracteres/);
  assert.match(indexHtml, /Ese correo ya tiene una cuenta/);
});

test("la reactivación EVO revierte la pausa permanente y solo publica productos confirmados recientemente", () => {
  assert.ok(freeFireEvoReenableMigrationSource.includes("v_active_paused"));
  assert.ok(freeFireEvoReenableMigrationSource.includes("v_active_original"));
  assert.ok(freeFireEvoReenableMigrationSource.includes("v_return_paused"));
  assert.ok(freeFireEvoReenableMigrationSource.includes("v_return_original"));
  assert.ok(freeFireEvoReenableMigrationSource.includes("SET active = true,"));
  assert.ok(freeFireEvoReenableMigrationSource.includes("storefront_visible = true"));
  assert.ok(freeFireEvoReenableMigrationSource.includes("provider_status = 'active'"));
  assert.ok(freeFireEvoReenableMigrationSource.includes("provider_in_stock IS TRUE"));
  assert.ok(freeFireEvoReenableMigrationSource.includes("provider_validation_supported IS TRUE"));
  assert.ok(freeFireEvoReenableMigrationSource.includes("provider_synced_at >= now() - interval '30 minutes'"));
  assert.ok(freeFireEvoReenableMigrationSource.includes("'11251c9b-4966-4210-969e-3d4ffdfb70aa'"));
  assert.ok(freeFireEvoReenableMigrationSource.includes("'64e90b95-ccf8-40da-9c4b-37e5e25e32d5'"));
  assert.ok(freeFireEvoReenableMigrationSource.includes("'a9cfa9a9-2310-4167-bdb9-6740413660dc'"));
});


test("una respuesta rejected de Central One cierra el pedido como rechazado", () => {
  assert.ok(providerRejectionStatusMigrationSource.includes("elsif p_provider_status = 'rejected' then"));
  assert.ok(providerRejectionStatusMigrationSource.includes("v_local_status := 'rejected'"));
  assert.ok(centralOneOrderEdgeSource.includes('central_one_status","in.(created,confirmed,processing,partially_completed,unknown,retryable,rejected)'));
  assert.ok(centralOneOrderEdgeSource.includes('lookup.searchParams.set("status","eq.processing")'));
  assert.ok(centralOneOrderEdgeSource.includes('else if (data.provider_status === "rejected") rejected++;'));
});

test("la portada previa al inicio de sesión muestra solo el canal oficial de WhatsApp", () => {
  const authStart = indexHtml.indexOf('<section id="auth"');
  const gamesStart = indexHtml.indexOf('<div class="auth-showcase-games"', authStart);
  assert.ok(authStart >= 0 && gamesStart > authStart);
  const intro = indexHtml.slice(authStart, gamesStart);
  assert.equal(intro.includes('castle-share-button'), false);
  assert.equal(intro.includes('onclick="shareStore()'), false);
  assert.ok(intro.includes('class="castle-channel-link castle-whatsapp-cta"'));
  assert.ok(intro.includes('href="https://whatsapp.com/channel/0029Vb8tq5vGufJ4yLhEcS0X"'));
  assert.ok(intro.includes('class="whatsapp-brand-glyph"'));
  assert.ok(indexHtml.includes("#auth .castle-channel-link.castle-whatsapp-cta"));
  assert.ok(indexHtml.includes("background:linear-gradient(135deg,#25d366"));
});


test("el seguimiento de Central One consulta pedidos abiertos cada 20 segundos y evita duplicar trabajos", () => {
  assert.ok(fasterOrderPollingMigrationSource.includes("schedule := '20 seconds'"));
  assert.ok(fasterOrderPollingMigrationSource.includes("cron.alter_job"));
  assert.ok(fasterOrderPollingMigrationSource.includes("sync_open_orders"));
  assert.ok(fasterOrderPollingMigrationSource.includes("Se encontró más de un trabajo de seguimiento activo"));
  assert.ok(centralOneOrderEdgeSource.includes("const cutoff = new Date(Date.now() - 12000).toISOString();"));
  assert.ok(centralOneOrderEdgeSource.includes('lookup.searchParams.set("status","eq.processing")'));
  assert.ok(centralOneOrderEdgeSource.includes("Math.min(6,requestedLimit)"));
});

test("los avisos de pedidos se entregan por Realtime y se recuperan al volver a abrir la tienda", () => {
  assert.ok(fasterOrderPollingMigrationSource.includes("ALTER PUBLICATION supabase_realtime ADD TABLE public.user_notifications"));
  assert.ok(indexHtml.includes('table:"user_notifications",filter:"user_id=eq."+userId'));
  assert.ok(indexHtml.includes('event:"INSERT"'));
  assert.ok(indexHtml.includes('Promise.resolve(loadNotifications())'));
  assert.ok(indexHtml.includes("shell-v204") || serviceWorker.includes("shell-v204"));
  assert.ok(serviceWorker.includes("shell-v204"));
});


test("el historial de Coronas muestra las devoluciones con texto propio de la tienda", () => {
  assert.ok(walletRefundDescriptionMigrationSource.includes("CREATE OR REPLACE FUNCTION private.customer_friendly_wallet_refund_description()"));
  assert.ok(walletRefundDescriptionMigrationSource.includes("BEFORE INSERT OR UPDATE OF kind, description"));
  assert.ok(walletRefundDescriptionMigrationSource.includes("'Devolución acreditada en tu Cartera de Tienda El Castillo.'"));
  assert.ok(walletRefundDescriptionMigrationSource.includes("UPDATE public.wallet_transactions"));
  assert.ok(walletRefundDescriptionMigrationSource.includes("WHERE kind = 'refund'"));
  assert.doesNotMatch(walletRefundDescriptionMigrationSource, /Central One|order_code|central_one_order_id/i);
});


test("la nueva pantalla de acceso prioriza el formulario en móviles y conserva las imágenes originales", () => {
  assert.ok(indexHtml.includes('<style id="auth-mobile-conversion-refresh-v1">'));
  assert.match(indexHtml, /#auth\.auth-showcase-layout\{display:flex!important/);
  assert.match(indexHtml, /#auth \.auth-showcase\{display:contents!important/);
  assert.match(indexHtml, /#auth \.auth-login-panel\{order:2/);
  assert.match(indexHtml, /#auth \.auth-showcase-games\{order:3/);
  assert.match(indexHtml, /#auth \.auth-login-panel \.auth-tabs\{display:grid!important/);
  assert.ok(indexHtml.includes("Crear cuenta gratis"));
  assert.ok(indexHtml.includes("Juegos disponibles"));
  const authStart = indexHtml.indexOf('<section id="auth"');
  const gamesStart = indexHtml.indexOf('<div class="auth-showcase-games"', authStart);
  const storeStart = indexHtml.indexOf('<section id="store"', authStart);
  const authImages = indexHtml.slice(gamesStart, storeStart);
  assert.ok(authImages.includes('./assets/games/free-fire-tienda.webp?v=2'));
  assert.ok(authImages.includes('./assets/games/mobile-legends-bang-bang.webp?v=2'));
  assert.ok(authImages.includes('r.res.easebar.com'));
  assert.ok(authImages.includes('./assets/games/pubg-mobile.webp?v=1'));
  assert.ok(authImages.includes('./assets/games/arena-breakout.webp?v=1'));
  assert.equal((authImages.match(/loading="lazy"/g) || []).length, 5);
});

test("Turnstile en español permite reintento manual y bloquea envíos duplicados de acceso y registro", () => {
  assert.ok(indexHtml.includes('id="castleCaptchaRetry"'));
  assert.ok(indexHtml.includes('onclick="retryCastleCaptcha()"'));
  assert.ok(indexHtml.includes('function retryCastleCaptcha()'));
  assert.ok(indexHtml.includes('theme:"light"'));
  assert.ok(indexHtml.includes('language:"es"'));
  assert.ok(indexHtml.includes('"retry-interval":10000'));
  assert.ok(indexHtml.includes('const configurationError=/^110(100|110|200)/.test(code)'));
  assert.ok(indexHtml.includes('setCastleCaptchaRetryVisible(!configurationError)'));
  const registerStart = indexHtml.indexOf("async function register(){");
  const registerEnd = indexHtml.indexOf("\\nasync function getCastleAuthCaptchaToken", registerStart);
  const loginStart = indexHtml.indexOf("async function login(){");
  const loginEnd = indexHtml.indexOf("\\nasync function openStore", loginStart);
  const registerSource = indexHtml.slice(registerStart, registerEnd);
  const loginSource = indexHtml.slice(loginStart, loginEnd);
  assert.ok(registerSource.includes("if(!submit||submit.disabled)return;"));
  assert.ok(registerSource.includes("captchaToken=await getCastleAuthCaptchaToken();"));
  assert.ok(registerSource.includes("submit.disabled=true;"));
  assert.ok(registerSource.includes("resetCastleCaptcha();"));
  assert.ok(loginSource.includes("if(!submit||submit.disabled)return;"));
  assert.ok(loginSource.includes("captchaToken=await getCastleAuthCaptchaToken();"));
  assert.ok(loginSource.includes("submit.disabled=true;"));
  assert.ok(loginSource.includes("Tus datos siguen escritos"));
  assert.ok(loginSource.includes("resetCastleCaptcha();"));
  assert.ok(indexHtml.includes("options:{captchaToken,data:signupMetadata"));
  assert.ok(indexHtml.includes("options:{captchaToken}"));
});

test("el nuevo aspecto de acceso actualiza la caché sin tocar pagos ni pedidos", () => {
  assert.ok(serviceWorker.includes('const CACHE_NAME = CACHE_PREFIX + "shell-v204"'));
  assert.ok(indexHtml.includes("auth-mobile-conversion-refresh-v1"));
  assert.ok(indexHtml.includes("function login()"));
  assert.ok(indexHtml.includes("function register()"));
  assert.ok(indexHtml.includes("store_order_submitted"));
});
