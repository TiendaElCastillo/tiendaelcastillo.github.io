(function (root) {
  "use strict";

  function escapeHtml(value) {
    return String(value == null ? "" : value).replace(/[&<>"']/g, function (character) {
      return ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character];
    });
  }

  function parseDate(value) {
    const date = value ? new Date(value) : null;
    return date && Number.isFinite(date.getTime()) ? date : null;
  }

  function dateKey(date) {
    return [date.getFullYear(), String(date.getMonth() + 1).padStart(2, "0"), String(date.getDate()).padStart(2, "0")].join("-");
  }

  function groupByDay(orders, locale) {
    const groups = new Map();
    (Array.isArray(orders) ? orders : []).forEach(function (order) {
      const date = parseDate(order && order.created_at);
      const key = date ? dateKey(date) : "unknown";
      let group = groups.get(key);
      if (!group) {
        const label = date
          ? new Intl.DateTimeFormat(locale || "es-CU", { day: "numeric", month: "long", year: "numeric" }).format(date)
          : "Fecha no disponible";
        group = { key: key, label: label, count: 0, orders: [] };
        groups.set(key, group);
      }
      group.orders.push(order);
      group.count += 1;
    });
    return Array.from(groups.values());
  }

  function statusClass(status) {
    const classes = {
      pending: "pending",
      payment_review: "review",
      processing: "processing",
      completed: "completed",
      rejected: "attention",
      failed: "attention",
      cancelled: "cancelled"
    };
    return classes[String(status || "")] || "pending";
  }

  function shortStatusLabel(status) {
    const labels = {
      pending: "Pendiente",
      payment_review: "En revisión",
      processing: "En curso",
      completed: "Entregado",
      rejected: "Rechazado",
      failed: "Incidencia",
      cancelled: "Cancelado"
    };
    return labels[String(status || "")] || "En actualización";
  }

  function isVerifiedDelivery(order) {
    const data = order || {};
    return data.status === "completed" &&
      data.central_one_status === "completed" &&
      typeof data.central_one_order_id === "string" &&
      data.central_one_order_id.trim().length > 0;
  }

  function renderDeliveryConfirmation(order, options) {
    if (!isVerifiedDelivery(order)) return "";
    const data = order || {};
    const settings = options || {};
    const artwork = settings.artworkHtml || '<span class="order-delivery-art-fallback" aria-hidden="true">🎮</span>';
    const itemLabel = settings.itemLabel || data.package_name || "Tu recarga";
    return '<section class="order-delivery-confirmation" aria-label="Recarga entregada">' +
      '<span class="order-delivery-confirmation-check" aria-hidden="true">✓</span>' +
      '<span class="order-delivery-confirmation-art">' + artwork + '</span>' +
      '<span class="order-delivery-confirmation-copy"><small>ENTREGA CONFIRMADA</small>' +
      '<strong>' + escapeHtml(itemLabel) + '</strong>' +
      '<span>Ya está en tu cuenta. Revisa el juego.</span></span>' +
      '</section>';
  }

  function renderDeliverySuccess(order, options) {
    if (!isVerifiedDelivery(order)) return "";
    const data = order || {};
    const settings = options || {};
    const artwork = settings.artworkHtml || '<span class="order-delivery-art-fallback" aria-hidden="true">🎮</span>';
    const itemLabel = settings.itemLabel || data.package_name || "Tu recarga";
    const game = data.game || "Tu juego";
    const code = data.order_code || "";
    const orderId = data.id || "";
    return '<section class="order-delivery-success-content">' +
      '<span class="order-delivery-success-kicker">TIENDA EL CASTILLO</span>' +
      '<span class="order-delivery-success-check" aria-hidden="true"><svg viewBox="0 0 48 48" focusable="false"><path d="m10 25 9 9L38 14"/></svg></span>' +
      '<span class="order-delivery-success-eyebrow">ENTREGA CONFIRMADA</span>' +
      '<h2 id="orderDeliveryTitle">¡Recarga entregada!</h2>' +
      '<span class="order-delivery-success-art">' + artwork + '</span>' +
      '<strong class="order-delivery-success-item">' + escapeHtml(itemLabel) + '</strong>' +
      '<p id="orderDeliveryDescription">Ya está en tu cuenta. Revisa el juego.</p>' +
      '<span class="order-delivery-success-game">' + escapeHtml(game) + '</span>' +
      (code ? '<small class="order-delivery-success-code">Pedido ' + escapeHtml(code) + '</small>' : "") +
      '<div class="order-delivery-success-actions">' +
      '<button class="primary-btn" type="button" data-order-delivery-view data-order-id="' + escapeHtml(orderId) + '">Ver mi pedido</button>' +
      '<button class="secondary-btn" type="button" data-order-delivery-close>Continuar</button>' +
      '</div>' +
      '<p class="order-delivery-success-note">Gracias por comprar en Tienda El Castillo 💜</p>' +
      '</section>';
  }

  function renderSummary(order, options) {
    const data = order || {};
    const settings = options || {};
    const date = parseDate(data.created_at);
    const dateLabel = date
      ? new Intl.DateTimeFormat("es-CU", { day: "2-digit", month: "short", year: "numeric" }).format(date)
      : "Fecha no disponible";
    const title = [data.game, data.package_name].filter(Boolean).join(" · ") || "Pedido de la tienda";
    const code = data.order_code || "Sin folio";
    const playerName = data.player_name || "Nombre no disponible";
    const status = statusClass(data.status);
    const statusLabel = settings.statusLabel || "Estado no disponible";
    const amountLabel = settings.amountLabel || "Importe no disponible";
    const ariaLabel = "Abrir pedido " + code + ": " + title + ", " + statusLabel;

    return '<article class="order-summary-item">' +
      '<button class="order-summary-button" type="button" data-open-order-detail data-order-id="' + escapeHtml(data.id) + '" aria-label="' + escapeHtml(ariaLabel) + '">' +
        '<span class="order-summary-top"><strong class="order-summary-title">' + escapeHtml(title) + '</strong>' +
        '<span class="order-summary-status is-' + status + '">' + escapeHtml(statusLabel) + '</span></span>' +
        '<span class="order-summary-meta"><span>Pedido ' + escapeHtml(code) + ' · ' + escapeHtml(dateLabel) + '</span>' +
        '<strong class="order-summary-amount">' + escapeHtml(amountLabel) + '</strong></span>' +
        '<span class="order-summary-player">Cuenta: ' + escapeHtml(playerName) + '</span>' +
        '<span class="order-summary-open">Ver detalles y seguimiento <span aria-hidden="true">›</span></span>' +
      '</button>' +
    '</article>';
  }

  root.CustomerOrdersView = {
    groupByDay: groupByDay,
    renderSummary: renderSummary,
    statusClass: statusClass,
    shortStatusLabel: shortStatusLabel,
    isVerifiedDelivery: isVerifiedDelivery,
    renderDeliveryConfirmation: renderDeliveryConfirmation,
    renderDeliverySuccess: renderDeliverySuccess
  };
})(window);
