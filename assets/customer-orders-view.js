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
    shortStatusLabel: shortStatusLabel
  };
})(window);
