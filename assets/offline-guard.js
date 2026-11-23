(function () {
  "use strict";

  const DRAFT_KEY = "castle_checkout_draft_v1";
  const DRAFT_TTL_MS = 12 * 60 * 60 * 1000;
  let notice = null;
  let lastOnlineState = null;

  const byId = (id) => document.getElementById(id);

  function currentUserId() {
    try {
      return typeof currentUser !== "undefined" && currentUser && currentUser.id
        ? String(currentUser.id)
        : "";
    } catch (_) {
      return "";
    }
  }

  function readDraft() {
    try {
      const raw = localStorage.getItem(DRAFT_KEY);
      if (!raw) return null;
      const draft = JSON.parse(raw);
      const valid = draft && draft.version === 1 &&
        typeof draft.userId === "string" &&
        typeof draft.productId === "string" &&
        typeof draft.playerId === "string" &&
        typeof draft.paymentMethod === "string" &&
        Number.isFinite(draft.savedAt) && Number.isFinite(draft.expiresAt) &&
        draft.savedAt > 0 && draft.savedAt <= Date.now() + 60000 &&
        draft.expiresAt > draft.savedAt &&
        draft.expiresAt - draft.savedAt <= DRAFT_TTL_MS &&
        Date.now() - draft.savedAt <= DRAFT_TTL_MS;
      if (!valid || draft.expiresAt <= Date.now()) {
        localStorage.removeItem(DRAFT_KEY);
        return null;
      }
      return draft;
    } catch (_) {
      try { localStorage.removeItem(DRAFT_KEY); } catch (_) {}
      return null;
    }
  }

  function clearDraft() {
    try { localStorage.removeItem(DRAFT_KEY); } catch (_) {}
    renderNotice();
  }

  function saveDraft() {
    const userId = currentUserId();
    const productId = String(byId("product")?.value || "");
    const playerId = String(byId("player")?.value || "").trim();
    const paymentMethod = String(byId("payment")?.value || "Transferencia CUP");
    const zoneId = String(byId("playerZone")?.value || "").trim();

    if (!userId) {
      setMessage("Inicia sesión cuando vuelva la conexión. No se guardó ningún pedido.", true);
      return false;
    }
    if (!productId || playerId.length < 3 || playerId.length > 64 ||
        zoneId.length > 24) {
      setMessage("Completa primero el paquete y el ID del jugador. No se ha creado ningún pedido.", true);
      return false;
    }

    const now = Date.now();
    const draft = {
      version: 1,
      userId,
      productId,
      playerId,
      zoneId,
      paymentMethod,
      savedAt: now,
      expiresAt: now + DRAFT_TTL_MS
    };

    try {
      localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
      setMessage("Borrador guardado en este teléfono durante 12 horas. No es un pedido, no se envió al proveedor y no se guardó ningún comprobante ni dato de pago.", false);
      renderNotice();
      return true;
    } catch (_) {
      setMessage("El teléfono no permitió guardar el borrador. No se creó ningún pedido ni se realizó ningún pago.", true);
      return false;
    }
  }

  function setMessage(message, error) {
    const orderMessage = byId("ordermsg");
    const playerMessage = byId("checkoutPlayerMsg");
    const target = byId("checkoutStagePayment")?.classList.contains("hidden")
      ? playerMessage
      : orderMessage;
    if (target) target.textContent = message;
    if (error && target) target.setAttribute("data-offline-error", "true");
  }

  function ensureNotice() {
    if (notice && notice.isConnected) return notice;
    const panel = byId("checkoutView")?.querySelector(".panel");
    if (!panel) return null;
    notice = document.createElement("div");
    notice.id = "offlineCheckoutNotice";
    notice.className = "notice";
    notice.setAttribute("role", "status");
    notice.setAttribute("aria-live", "polite");
    notice.style.margin = "12px 0 16px";
    const message = document.createElement("p");
    message.id = "offlineCheckoutNoticeText";
    message.style.margin = "0 0 10px";
    notice.appendChild(message);
    const actions = document.createElement("div");
    actions.style.display = "flex";
    actions.style.flexWrap = "wrap";
    actions.style.gap = "8px";
    const saveButton = document.createElement("button");
    saveButton.type = "button";
    saveButton.id = "saveOfflineDraftButton";
    saveButton.className = "secondary-btn";
    saveButton.textContent = "Guardar borrador";
    const restoreButton = document.createElement("button");
    restoreButton.type = "button";
    restoreButton.id = "restoreOfflineDraftButton";
    restoreButton.className = "primary-btn";
    restoreButton.textContent = "Restaurar borrador";
    const deleteButton = document.createElement("button");
    deleteButton.type = "button";
    deleteButton.id = "deleteOfflineDraftButton";
    deleteButton.className = "secondary-btn";
    deleteButton.textContent = "Eliminar borrador";
    actions.append(saveButton, restoreButton, deleteButton);
    notice.appendChild(actions);
    const stepper = byId("checkoutStepper");
    panel.insertBefore(notice, stepper || panel.firstChild);
    return notice;
  }

  function renderNotice() {
    const node = ensureNotice();
    if (!node) return;
    const message = byId("offlineCheckoutNoticeText");
    const saveButton = byId("saveOfflineDraftButton");
    const restoreButton = byId("restoreOfflineDraftButton");
    const deleteButton = byId("deleteOfflineDraftButton");
    const offline = navigator.onLine === false;
    const draft = readDraft();
    const userId = currentUserId();
    const ownDraft = draft && draft.userId === userId;

    if (offline) {
      node.className = "notice offline-checkout-notice";
      if (message) message.textContent =
        "El teléfono indica que podría no haber conexión. Los pasos que necesitan el servidor intentarán comprobarla; si no es posible, te mostraremos el error sin crear un pedido. También puedes guardar un borrador manualmente.";
      if (saveButton) saveButton.hidden = false;
      if (restoreButton) restoreButton.hidden = true;
      if (deleteButton) deleteButton.hidden = !ownDraft;
      node.hidden = false;
      return;
    }

    if (ownDraft) {
      node.className = "notice offline-checkout-notice";
      if (message) message.textContent =
        "Hay un borrador guardado en este teléfono. Todavía no es un pedido ni se ha hecho ningún pago. Al restaurarlo tendrás que verificar el ID otra vez y adjuntar de nuevo el comprobante.";
      if (saveButton) saveButton.hidden = true;
      if (restoreButton) { restoreButton.hidden = false; restoreButton.textContent = draft.restoredAt ? "Volver a abrir borrador" : "Restaurar borrador"; }
      if (deleteButton) deleteButton.hidden = false;
      node.hidden = false;
      return;
    }

    node.hidden = true;
  }

  function restoreDraft() {
    if (navigator.onLine === false) {
      setMessage("Espera a recuperar la conexión antes de restaurar y verificar el ID.", true);
      return;
    }
    const draft = readDraft();
    if (!draft || draft.userId !== currentUserId()) {
      setMessage("No hay un borrador disponible para esta cuenta.", true);
      renderNotice();
      return;
    }
    if (typeof openCheckout !== "function" || !openCheckout(draft.productId, draft.paymentMethod)) {
      setMessage("El paquete guardado ya no está disponible. Actualiza el catálogo antes de continuar.", true);
      return;
    }
    const player = byId("player");
    const zone = byId("playerZone");
    if (player) player.value = draft.playerId;
    if (zone) zone.value = draft.zoneId || "";
    try { draft.restoredAt = Date.now(); localStorage.setItem(DRAFT_KEY, JSON.stringify(draft)); } catch (_) {}
    if (typeof resetPlayerValidation === "function") resetPlayerValidation();
    if (typeof updateCheckoutStage === "function") updateCheckoutStage("player");
    const help = byId("checkoutPlayerMsg");
    if (help) help.textContent =
      "Borrador restaurado. Comprueba el ID mostrado y pulsa «Continuar» para verificarlo de nuevo. Tendrás que adjuntar otra vez el comprobante y los datos de pago.";
    renderNotice();
  }

  function bindActions() {
    document.addEventListener("click", function (event) {
      const target = event.target && event.target.closest
        ? event.target.closest("#saveOfflineDraftButton, #restoreOfflineDraftButton, #deleteOfflineDraftButton")
        : null;
      if (!target) return;

      if (target.id === "saveOfflineDraftButton") {
        event.preventDefault();
        saveDraft();
        return;
      }
      if (target.id === "restoreOfflineDraftButton") {
        event.preventDefault();
        restoreDraft();
        return;
      }
      if (target.id === "deleteOfflineDraftButton") {
        event.preventDefault();
        clearDraft();
        setMessage("Borrador eliminado. No se había creado ningún pedido.", false);
        return;
      }
    }, true);
  }

  function wrapPlaceOrder() {
    if (typeof window.placeOrder !== "function" || window.placeOrder.__offlineGuardWrapped) return;
    const original = window.placeOrder;
    const wrapped = async function () {
      // navigator.onLine is only a device hint; some mobile browsers report
      // offline even when Supabase is reachable. Let the real request decide.
      const result = await original.apply(this, arguments);
      const done = byId("checkoutStageDone");
      const doneVisible = done && !done.classList.contains("hidden");
      const message = String(byId("ordermsg")?.textContent || "");
      if (doneVisible || /Compra creada correctamente|Este pedido ya se había creado|quedó creado, pero no se pudo asociar/i.test(message)) {
        try { localStorage.removeItem(DRAFT_KEY); } catch (_) {}
      }
      renderNotice();
      return result;
    };
    wrapped.__offlineGuardWrapped = true;
    window.placeOrder = wrapped;
  }

  function bindNetworkEvents() {
    window.addEventListener("offline", function () {
      lastOnlineState = false;
      renderNotice();
    });
    window.addEventListener("online", function () {
      lastOnlineState = true;
      renderNotice();
    });
  }

  function initialize() {
    ensureNotice();
    bindActions();
    bindNetworkEvents();
    wrapPlaceOrder();
    renderNotice();
    if (lastOnlineState === null) lastOnlineState = navigator.onLine !== false;
  }

  window.castleSaveOfflineCheckoutDraft = saveDraft;
  window.castleRestoreOfflineCheckoutDraft = restoreDraft;
  window.castleClearOfflineCheckoutDraft = clearDraft;

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initialize, { once: true });
  } else {
    initialize();
  }
})();