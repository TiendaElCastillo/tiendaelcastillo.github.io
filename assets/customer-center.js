(function () {
  "use strict";

  // El enlace se completa cuando el propietario comparta la invitación oficial.
  var CASTLE_WHATSAPP_CHANNEL_URL = "";
  var CASTLE_SUPPORT_PHONE = "5351884050";

  var GUIDE_BOOK = {
    "Free Fire": {
      image: "./assets/games/free-fire-tienda.webp?v=2",
      region: "LATAM",
      account: "Introduce el ID de tu jugador. La tienda comprueba la cuenta y muestra el nombre detectado.",
      category: "Empieza por Diamantes, la moneda principal. Después encontrarás membresías, pases y ofertas especiales disponibles.",
      notes: "Free Fire se ofrece en región LATAM. Comprueba que la cuenta y la región correspondan antes de pagar.",
      id: "Un campo: ID del jugador."
    },
    "Blood Strike": {
      image: "./assets/games/blood-strike-cover.webp?v=1",
      region: "GLOBAL",
      account: "Escribe el identificador que solicita el formulario. Los paquetes publicados admiten validación por ID.",
      category: "Empieza por BC, la moneda principal. Después revisa las ofertas, pases y paquetes especiales.",
      notes: "Los paquetes publicados de Blood Strike son GLOBAL. Comprueba el nombre de la cuenta que aparece tras validar.",
      id: "Un campo de ID del jugador."
    },
    "Mobile Legends: Bang Bang": {
      image: "./assets/games/mobile-legends-bang-bang.webp?v=2",
      region: "GLOBAL",
      account: "Necesitas introducir el ID del jugador y el Zone ID del servidor. Ambos datos deben corresponder a la misma cuenta.",
      category: "Empieza por Diamantes. Después revisa las tarjetas semanales, mensuales, Twilight y demás ofertas disponibles.",
      notes: "La tienda solo publica Mobile Legends GLOBAL. No omitas el Zone ID: es necesario para identificar correctamente el servidor.",
      id: "Dos campos: ID del jugador y Zone ID."
    },
    "Arena Breakout": {
      image: "./assets/games/arena-breakout.webp?v=1",
      region: "GLOBAL",
      account: "Introduce el ID de jugador que solicita el formulario y espera a que se compruebe la cuenta.",
      category: "Empieza por Bonds, la moneda principal. Después consulta los pases, cases y paquetes especiales disponibles.",
      notes: "Los paquetes publicados de Arena Breakout son GLOBAL. No compartas credenciales ni acceso a tu cuenta.",
      id: "Un campo: ID del jugador."
    },
    "PUBG Mobile": {
      image: "./assets/games/pubg-mobile.webp?v=1",
      region: "GLOBAL",
      account: "Introduce el ID de jugador que solicita el formulario y verifica el nombre que devuelve la comprobación.",
      category: "Empieza por UC, la moneda principal. Después revisa Prime, Elite Pass, WOW Coins y las demás ofertas publicadas.",
      notes: "Los paquetes publicados de PUBG Mobile son GLOBAL. Confirma el ID antes de realizar el pago.",
      id: "Un campo: ID del jugador."
    }
  };

  var COMMON_STEPS = [
    "Inicia sesión o crea tu cuenta en Tienda El Castillo. Así podrás consultar tus pedidos y recibir avisos.",
    "Abre «Juegos» y selecciona el juego que quieres recargar.",
    "Empieza por la moneda principal del juego. Los pases, membresías y ofertas especiales aparecen después.",
    "Selecciona el método de pago para consultar los precios correspondientes y elige el paquete que necesitas.",
    "Escribe los datos de la cuenta que solicita el formulario y pulsa para comprobarlos. Revisa que el nombre mostrado coincida con tu jugador.",
    "Continúa al pago. Sigue las instrucciones del método elegido y envía exactamente el importe que aparece en el resumen.",
    "Envía la solicitud y consulta su avance en «Órdenes» y en «Mensajes y avisos». No envíes un segundo pago para el mismo pedido."
  ];

  var SUPPORT_CASES = {
    pending: {
      title: "Tu pedido todavía está siguiendo el proceso normal.",
      message: "Cuando un pedido aparece pendiente, en revisión del pago o en proceso, consulta su estado en «Órdenes» y los avisos de tu cuenta. No hace falta abrir una conversación para pedir una actualización normal. El soporte se reserva para incidencias concretas o datos que no coinciden."
    },
    payment: {
      title: "Pago realizado, pero no encuentras el pedido.",
      message: "Comprueba primero «Órdenes». Si el pedido no aparece, prepara la referencia de la transferencia o del pago, el importe exacto y una captura legible del comprobante. No vuelvas a pagar ni crees otro pedido para justificar la misma operación."
    },
    duplicate: {
      title: "Se realizaron dos pagos para una misma compra.",
      message: "No generes otro pedido. Ten a mano las dos referencias y las capturas de ambas operaciones, además del folio del pedido si aparece en tu cuenta. La tienda debe comprobar las dos transacciones antes de resolver el caso."
    },
    rejected: {
      title: "El pedido figura rechazado o cancelado, pero el pago sí se realizó.",
      message: "Prepara el folio del pedido, el estado que aparece en pantalla y la evidencia del pago. No repitas la transferencia ni compres de nuevo el mismo paquete hasta que se revise la incidencia."
    },
    delivered: {
      title: "El pedido figura entregado, pero no ves el contenido en el juego.",
      message: "Comprueba que estás entrando en la cuenta correcta y vuelve a revisar el juego. Si sigue sin aparecer, prepara el folio, el ID utilizado y una captura de la pantalla del juego donde se vea el problema. No compartas contraseñas."
    },
    wallet: {
      title: "Hay una diferencia en un depósito o movimiento de la Wallet.",
      message: "Los depósitos pendientes no forman parte del saldo disponible hasta que se aprueban. Contacta solo si el depósito aparece aprobado y el saldo no se refleja, o si hay un movimiento ya registrado con un importe incorrecto. Adjunta la referencia o el folio correspondiente."
    },
    wallet_pending: {
      title: "El depósito de Wallet todavía está pendiente de revisión.",
      message: "Un depósito pendiente no forma parte del saldo disponible y no puede utilizarse para comprar. Consulta el estado en el historial de depósitos. No hace falta contactar por una solicitud que todavía no aparece aprobada."
    }
  };

  function escapeHtml(value) {
    return String(value == null ? "" : value).replace(/[&<>"']/g, function (char) {
      return ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char];
    });
  }

  function activateCommunityButtons() {
    var validUrl = "";
    try {
      var parsed = new URL(CASTLE_WHATSAPP_CHANNEL_URL);
      if (parsed.protocol === "https:" &&
          (parsed.hostname === "whatsapp.com" ||
           parsed.hostname === "www.whatsapp.com" ||
           parsed.hostname === "chat.whatsapp.com") &&
          parsed.pathname.length > 1) {
        validUrl = parsed.href;
      }
    } catch (_) {
      validUrl = "";
    }

    document.querySelectorAll("[data-castle-channel]").forEach(function (link) {
      if (validUrl) {
        link.href = validUrl;
        link.target = "_blank";
        link.rel = "noopener noreferrer";
        link.removeAttribute("aria-disabled");
        link.classList.remove("is-disabled");
        link.title = "Abrir el canal oficial de Tienda El Castillo en WhatsApp";
      } else {
        link.removeAttribute("href");
        link.setAttribute("aria-disabled", "true");
        link.classList.add("is-disabled");
        link.title = "El enlace oficial del canal se añadirá cuando esté confirmado";
      }
    });

    document.querySelectorAll("[data-channel-status]").forEach(function (node) {
      node.textContent = validUrl
        ? "Canal oficial disponible. Allí publicaremos novedades y anuncios de la comunidad."
        : "El botón quedará activado al añadir el enlace oficial de invitación.";
    });
  }

  function showGuideList() {
    var list = document.getElementById("guideList");
    var detail = document.getElementById("guideDetail");
    if (list) list.classList.remove("hidden");
    if (detail) detail.classList.add("hidden");
    if (typeof window.showView === "function") window.showView("guides");
  }

  function showGameGuide(gameName) {
    var guide = GUIDE_BOOK[gameName];
    var list = document.getElementById("guideList");
    var detail = document.getElementById("guideDetail");
    if (!guide || !detail) return;

    var steps = COMMON_STEPS.map(function (step, index) {
      return '<li><span class="guide-step-number">' + (index + 1) + '</span><div>' + escapeHtml(step) + '</div></li>';
    }).join("");

    var paymentHelp =
      '<div class="guide-payment-grid">' +
        '<article><strong>Transferencia CUP</strong><p>Envía el importe exacto. Escribe el número de transacción, el teléfono desde el que pagaste y adjunta el comprobante solicitado.</p></article>' +
        '<article><strong>Saldo móvil</strong><p>Envía la cantidad exacta de saldo. Indica el teléfono de origen y adjunta la captura del SMS. Este método no utiliza número de transacción bancaria.</p></article>' +
        '<article><strong>USDT</strong><p>Comprueba la red y la dirección que muestra el checkout. Escribe el importe exacto, el TxID de la operación y adjunta el comprobante.</p></article>' +
        '<article><strong>Saldo de Tienda El Castillo</strong><p>Solo puedes usar el saldo que ya esté disponible en tu Wallet. Revisa el importe: la compra descuenta el precio mostrado en USD.</p></article>' +
      '</div>';

    detail.innerHTML =
      '<button class="text-link" type="button" onclick="showGuideList()">← Volver a todas las guías</button>' +
      '<div class="guide-detail-hero">' +
        '<img src="' + escapeHtml(guide.image) + '" alt="' + escapeHtml(gameName) + '" loading="lazy" decoding="async">' +
        '<div><span class="guide-region-tag">REGIÓN ' + escapeHtml(guide.region) + '</span><h2>' + escapeHtml(gameName) + '</h2><p>' + escapeHtml(guide.id) + '</p></div>' +
      '</div>' +
      '<div class="guide-game-notice"><strong>Datos de la cuenta</strong><p>' + escapeHtml(guide.account) + '</p><p>' + escapeHtml(guide.notes) + '</p></div>' +
      '<div class="guide-category-note"><strong>Orden del catálogo</strong><p>' + escapeHtml(guide.category) + '</p></div>' +
      '<h3 class="guide-section-title">Cómo hacer tu recarga</h3>' +
      '<ol class="guide-step-list">' + steps + '</ol>' +
      '<h3 class="guide-section-title">Qué debes enviar según el método de pago</h3>' +
      paymentHelp +
      '<div class="guide-safety-note"><strong>Importante</strong><p>No compartas contraseñas, códigos de acceso, correos de inicio de sesión ni control de tu cuenta de juego. Si el nombre que aparece al validar el ID no es el tuyo, no continúes ni pagues.</p></div>' +
      '<button class="primary-btn block-btn" type="button" onclick="showView(\'games\')">Ir al catálogo de juegos</button>';

    if (list) list.classList.add("hidden");
    detail.classList.remove("hidden");
    if (typeof window.showView === "function") window.showView("guides");
  }

  function updateSupportGuidance() {
    var issueSelect = document.getElementById("supportIssue");
    var referenceInput = document.getElementById("supportReference");
    var detailsInput = document.getElementById("supportDetails");
    var guidance = document.getElementById("supportGuidance");
    var contact = document.getElementById("supportContactLink");
    if (!issueSelect || !referenceInput || !guidance || !contact) return;

    var issueKey = issueSelect.value;
    var issue = SUPPORT_CASES[issueKey];
    var reference = referenceInput.value.trim();
    var extra = detailsInput ? detailsInput.value.trim() : "";

    if (!issue) {
      guidance.innerHTML = '<strong>Primero identifica el problema.</strong><p>Te mostraremos los pasos adecuados y cuándo hace falta contactar con una persona.</p>';
      contact.hidden = true;
      contact.removeAttribute("href");
      return;
    }

    guidance.innerHTML = '<strong>' + escapeHtml(issue.title) + '</strong><p>' + escapeHtml(issue.message) + '</p>';

    if (issueKey === "pending" || issueKey === "wallet_pending") {
      contact.hidden = true;
      contact.removeAttribute("href");
      return;
    }

    if (reference.length < 3) {
      guidance.innerHTML += '<p class="support-reference-reminder">Añade el folio del pedido o la referencia del pago para preparar el mensaje.</p>';
      contact.hidden = true;
      contact.removeAttribute("href");
      return;
    }

    var message = "Hola, necesito ayuda con una incidencia de Tienda El Castillo." +
      "\nMotivo: " + issue.title +
      "\nFolio o referencia: " + reference +
      (extra ? "\nDetalles: " + extra : "") +
      "\nAdjuntaré la evidencia necesaria. Gracias.";
    contact.href = "https://wa.me/" + CASTLE_SUPPORT_PHONE + "?text=" + encodeURIComponent(message);
    contact.hidden = false;
  }

  window.showGuideList = showGuideList;
  window.showGameGuide = showGameGuide;
  window.updateSupportGuidance = updateSupportGuidance;

  function initCustomerCenter() {
    activateCommunityButtons();
    updateSupportGuidance();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initCustomerCenter, { once: true });
  } else {
    initCustomerCenter();
  }
})();