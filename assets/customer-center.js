(function () {
  "use strict";

  // El enlace se completa cuando el propietario comparta la invitación oficial.
  var CASTLE_WHATSAPP_CHANNEL_URL = "https://whatsapp.com/channel/0029Vb8tq5vGufJ4yLhEcS0X";
  var CASTLE_SUPPORT_PHONE = "5351884050";

  var GUIDE_BOOK = {
    "Free Fire": {
      image: "./assets/games/free-fire-tienda.webp?v=2",
      region: "LATAM",
      account: "Introduce el ID de tu jugador. La tienda comprueba la cuenta y muestra el nombre detectado.",
      category: "Empieza por Diamantes. Después encontrarás fragmentos y cajas Evo, fragmentos de armas Evo, pases Booyah y tarjetas semanales o mensuales.",
      notes: "Free Fire se ofrece en región LATAM. Comprueba que la cuenta y la región correspondan antes de pagar.",
      findId: "Entra al juego, toca tu nombre o perfil en la pantalla principal y abre la pestaña Galería. El ID aparece debajo de tu nombre. Copia el número; no uses tu apodo.",
      source: '<a href="https://ffsoporte.garena.com/hc/es-419/articles/360031572451--C%C3%B3mo-encuentro-mi-n%C3%BAmero-de-ID" target="_blank" rel="noopener noreferrer">Ayuda oficial de Garena: dónde encontrar el ID</a>',
      id: "Un campo: ID del jugador."
    },
    "Blood Strike": {
      image: "./assets/games/blood-strike-cover.webp?v=1",
      region: "GLOBAL",
      account: "Escribe el identificador que solicita el formulario. Los paquetes publicados admiten validación por ID.",
      category: "Empieza por BC. Después revisa los Deals, Strike Pass, Level Up Pass y las ofertas de vouchers, cofres y colaboraciones disponibles.",
      notes: "Los paquetes publicados de Blood Strike son GLOBAL. Comprueba el nombre de la cuenta que aparece tras validar.",
      findId: "Entra al juego, toca tu avatar para abrir el perfil y busca el ID de jugador (UID) en la información de tu cuenta. Copia el identificador, no el apodo. La posición puede variar con las actualizaciones.",
      id: "Un campo de ID del jugador."
    },
    "Mobile Legends: Bang Bang": {
      image: "./assets/games/mobile-legends-bang-bang.webp?v=2",
      region: "GLOBAL",
      account: "Necesitas introducir el ID del jugador y el Zone ID del servidor. Ambos datos deben corresponder a la misma cuenta.",
      category: "Empieza por Diamantes. Después encontrarás el Paquete Élite Semanal y Mensual, el Pase Semanal y el Twilight Pass.",
      notes: "La tienda solo publica Mobile Legends GLOBAL. No omitas el Zone ID: es necesario para identificar correctamente el servidor.",
      findId: "Toca tu avatar en la esquina superior izquierda y abre tu perfil. Verás un número con este formato de ejemplo: 12345678 (1234). El número antes de los paréntesis es el ID del jugador; el número dentro de los paréntesis es el Zone ID. Nuestra compra pide ambos por separado.",
      source: '<a href="https://us.support.codashop.com/hc/en-us/articles/4405767170575-Where-Can-I-find-My-Mobile-Legends-User-ID" target="_blank" rel="noopener noreferrer">Guía de Codashop: localizar User ID y Zone ID</a>',
      id: "Dos campos: ID del jugador y Zone ID."
    },
    "Arena Breakout": {
      image: "./assets/games/arena-breakout.webp?v=1",
      region: "GLOBAL",
      account: "Introduce el ID de jugador que solicita el formulario y espera a que se compruebe la cuenta.",
      category: "Empieza por Bonds. Después encontrarás Beginner Select, Cases, pases de batalla y paquetes especiales como MAXACE y TAGTICAL.",
      notes: "Los paquetes publicados de Arena Breakout son GLOBAL. No compartas credenciales ni acceso a tu cuenta.",
      findId: "Abre tu perfil de jugador desde la pantalla principal y busca el ID de tu operador junto a la información de la cuenta. Copia el ID completo. No uses el nombre de operador como sustituto.",
      id: "Un campo: ID del jugador."
    },
    "PUBG Mobile": {
      image: "./assets/games/pubg-mobile.webp?v=1",
      region: "GLOBAL",
      account: "Introduce el ID de jugador que solicita el formulario y verifica el nombre que devuelve la comprobación.",
      category: "Empieza por UC. Después encontrarás WOW Coins, Elite Pass y Elite Pass Plus, Prime y Prime Plus, packs y ofertas semanales.",
      notes: "Los paquetes publicados de PUBG Mobile son GLOBAL. Confirma el ID antes de realizar el pago.",
      findId: "Abre tu perfil tocando el avatar de la esquina superior izquierda. Entra en Info → Basic Info y localiza tu Character ID (UID). Usa el botón de copiar si aparece; no confundas el ID con tu apodo.",
      source: '<a href="https://pubgmobile.helpshift.com/hc/en/3-pubg-mobile/faq/614-where-can-i-find-my-character-id-uid/?p=all" target="_blank" rel="noopener noreferrer">Ayuda oficial de PUBG Mobile: localizar Character ID</a>',
      id: "Un campo: ID del jugador."
    }
  };

  var COMMON_STEPS = [
    "Inicia sesión o crea tu cuenta en Tienda El Castillo. Así podrás consultar tus pedidos y recibir avisos.",
    "Abre «Juegos» y selecciona el juego que quieres recargar.",
    "Empieza por la moneda principal. Después encontrarás pases, membresías y ofertas especiales.",
    "Selecciona el método de pago para consultar sus precios y elige el paquete.",
    "Abre el perfil del juego y copia el ID exacto. En Mobile Legends copia también el Zone ID.",
    "En el checkout introduce los datos de la cuenta. Espera la validación y comprueba que el nombre mostrado corresponda a tu jugador.",
    "Sigue las instrucciones del método elegido y envía exactamente el importe que aparece en el resumen.",
    "Envía la solicitud y consulta su avance en «Órdenes» y «Mensajes y avisos». No envíes un segundo pago para el mismo pedido."
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
      title: "Hay una diferencia en una recarga o movimiento de Coronas."
      message: "Las recargas pendientes no forman parte de las Coronas disponibles hasta que se aprueban. Contacta solo si el depósito aparece aprobado y las Coronas no se reflejan, o si hay un movimiento ya registrado con un importe incorrecto. Adjunta la referencia o el folio correspondiente."
    },
    wallet_pending: {
      title: "La recarga de Coronas todavía está pendiente de revisión."
      message: "Una recarga pendiente no forma parte de las Coronas disponibles y no puede utilizarse para comprar. Consulta el estado en el historial de recargas. No hace falta contactar por una solicitud que todavía no aparece aprobada."
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
        '<article><strong>Corona</strong><p>Solo puedes usar las Coronas que ya estén disponibles en tu Wallet. 1 Corona equivale a 1 USD. La compra descuenta el precio mostrado en Coronas.</p></article>' +
      '</div>';

    detail.innerHTML =
      '<button class="text-link" type="button" onclick="showGuideList()">← Volver a todas las guías</button>' +
      '<div class="guide-detail-hero">' +
        '<img src="' + escapeHtml(guide.image) + '" alt="' + escapeHtml(gameName) + '" loading="lazy" decoding="async">' +
        '<div><span class="guide-region-tag">REGIÓN ' + escapeHtml(guide.region) + '</span><h2>' + escapeHtml(gameName) + '</h2><p>' + escapeHtml(guide.id) + '</p></div>' +
      '</div>' +
      '<div class="guide-game-notice"><strong>Datos de la cuenta que necesitas</strong><p>' + escapeHtml(guide.account) + '</p><p>' + escapeHtml(guide.notes) + '</p><strong>¿Dónde encuentro mi ID?</strong><p>' + escapeHtml(guide.findId) + '</p>' + (guide.source ? '<p class="guide-source-link">' + guide.source + '</p>' : '') + '</div>' +
      '<div class="guide-category-note"><strong>Qué encontrarás en el catálogo</strong><p>' + escapeHtml(guide.category) + '</p></div>' +
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

  function supportElement(tag, className, text) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined && text !== null) node.textContent = String(text);
    return node;
  }

  var SUPPORT_STATUS_LABELS = {
    open: "Recibida",
    in_progress: "En revisión",
    waiting_customer: "Respuesta enviada",
    resolved: "Resuelta",
    closed: "Cerrada"
  };
  var SUPPORT_CATEGORY_LABELS = {
    pending: "Pedido pendiente o en proceso",
    payment: "Pago no reflejado",
    duplicate: "Pago duplicado",
    rejected: "Pedido rechazado con pago realizado",
    delivered: "Contenido no recibido",
    wallet_pending: "Recarga de Coronas pendiente",
    wallet: "Incidencia con Coronas"
  };
  var activeCustomerSupportTicketId = null;
  var activeAdminSupportTicketId = null;

  function supportDate(value) {
    var date = new Date(value);
    return isNaN(date.getTime()) ? "Fecha no disponible" :
      date.toLocaleString("es-ES", { dateStyle: "short", timeStyle: "short" });
  }

  function supportCurrentDb() {
    return typeof db !== "undefined" && db && typeof currentUser !== "undefined" && currentUser ? db : null;
  }

  function updateSupportGuidance() {
    var issueSelect = document.getElementById("supportIssue");
    var subjectWrap = document.getElementById("supportSubjectWrap");
    var subjectInput = document.getElementById("supportSubject");
    var referenceWrap = document.getElementById("supportReferenceWrap");
    var detailsWrap = document.getElementById("supportDetailsWrap");
    var referenceInput = document.getElementById("supportReference");
    var detailsInput = document.getElementById("supportDetails");
    var guidance = document.getElementById("supportGuidance");
    var submit = document.getElementById("supportSubmitButton");
    var statusAction = document.getElementById("supportStatusAction");
    var statusButton = document.getElementById("supportStatusActionButton");
    var normalStatus = document.getElementById("supportNormalStatus");
    var normalTitle = document.getElementById("supportNormalTitle");
    var normalMessage = document.getElementById("supportNormalMessage");
    var normalButton = document.getElementById("supportNormalButton");
    if (!issueSelect || !guidance) return;

    var key = issueSelect.value;
    var issue = SUPPORT_CASES[key];
    if (normalStatus) normalStatus.hidden = Boolean(issue);
    if (subjectWrap) subjectWrap.hidden = !issue;
    if (referenceWrap) referenceWrap.hidden = !issue;
    if (detailsWrap) detailsWrap.hidden = !issue;
    if (submit) submit.hidden = !issue;
    if (issue && subjectInput && (!subjectInput.value.trim() || subjectInput.dataset.category !== key)) {
      var defaults = {
        pending: "Pedido pendiente o en proceso",
        payment: "Pago realizado no reflejado",
        duplicate: "Pago duplicado",
        rejected: "Pedido rechazado con pago",
        delivered: "Contenido no recibido",
        wallet_pending: "Recarga de Coronas pendiente",
        wallet: "Incidencia con Wallet"
      };
      subjectInput.value = defaults[key] || "Consulta de soporte";
      subjectInput.dataset.category = key;
    }
    if (statusAction) statusAction.hidden = !(key === "pending" || key === "wallet_pending");
    if (statusButton) {
      if (key === "wallet_pending") {
        statusButton.textContent = "Revisar historial de depósitos";
        statusButton.onclick = function () { if (typeof window.showView === "function") window.showView("wallet"); };
      } else if (key === "pending") {
        statusButton.textContent = "Consultar mis órdenes";
        statusButton.onclick = function () { if (typeof window.showView === "function") window.showView("orders"); };
      } else {
        statusButton.onclick = null;
      }
    }
    if (!issue) {
      if (normalTitle) normalTitle.textContent = "Atención desde tu cuenta";
      if (normalMessage) normalMessage.textContent = "Selecciona el motivo y envía tu consulta aquí mismo. Recibirás un folio y podrás leer la respuesta del equipo desde esta pantalla.";
      if (normalButton) {
        normalButton.textContent = "Consultar mis órdenes";
        normalButton.onclick = function () { if (typeof window.showView === "function") window.showView("orders"); };
      }
      guidance.innerHTML = "<strong>Selecciona el motivo de tu consulta.</strong><p>Te mostraremos qué información conviene incluir.</p>";
      return;
    }
    var message = issue.message;
    if (key === "pending") message += " Si la espera ya supera el tiempo indicado o el estado no se actualiza, puedes enviar una incidencia aquí.";
    if (key === "wallet_pending") message += " Si ya pasó el plazo de revisión o el estado no coincide con tu historial, puedes consultarnos desde aquí.";
    guidance.innerHTML = "<strong>" + escapeHtml(issue.title) + "</strong><p>" + escapeHtml(message) + "</p>";
    if (referenceInput) referenceInput.placeholder = key.indexOf("wallet") === 0
      ? "Folio del depósito o referencia, si la tienes"
      : "Folio EC-XXXXXXXX o referencia del pago (opcional)";
    if (detailsInput) detailsInput.required = true;
  }

  async function submitSupportTicket() {
    var client = supportCurrentDb();
    var issue = document.getElementById("supportIssue");
    var subject = document.getElementById("supportSubject");
    var reference = document.getElementById("supportReference");
    var details = document.getElementById("supportDetails");
    var button = document.getElementById("supportSubmitButton");
    var status = document.getElementById("supportSubmitMessage");
    if (!client) { if (status) status.textContent = "Tu sesión no está activa. Inicia sesión de nuevo para enviar la consulta."; return; }
    var key = issue ? issue.value : "";
    var subjectText = subject ? subject.value.trim() : "";
    var referenceText = reference ? reference.value.trim() : "";
    var body = details ? details.value.trim() : "";
    if (!SUPPORT_CASES[key]) { if (status) status.textContent = "Selecciona el motivo de la incidencia."; return; }
    if (subjectText.length < 4 || subjectText.length > 120) { if (status) status.textContent = "Escribe un asunto de entre 4 y 120 caracteres."; subject?.focus(); return; }
    if (referenceText.length > 100) { if (status) status.textContent = "La referencia no puede superar 100 caracteres."; return; }
    if (body.length < 8 || body.length > 1500) { if (status) status.textContent = "Describe lo ocurrido con al menos 8 caracteres."; details?.focus(); return; }
    if (button) { button.disabled = true; button.textContent = "Enviando incidencia…"; }
    if (status) status.textContent = "Guardando tu solicitud de forma segura…";
    try {
      var result = await client.rpc("create_support_ticket", {
        p_category: key,
        p_subject: subjectText,
        p_reference: referenceText || null,
        p_message: body
      });
      if (result.error) throw result.error;
      var row = result.data || {};
      var code = row.ticket_code || (Array.isArray(row) && row[0] && row[0].ticket_code) || "folio generado";
      if (status) status.textContent = "Incidencia enviada correctamente. Tu folio es " + code + ". Puedes seguir la conversación en «Mis solicitudes».";
      if (details) details.value = "";
      if (reference) reference.value = "";
      if (subject) subject.value = "";
      if (issue) issue.value = "";
      updateSupportGuidance();
      await loadCustomerSupportTickets();
    } catch (error) {
      console.error("No se pudo enviar la incidencia:", error);
      if (status) status.textContent = error && error.message ? error.message : "No se pudo enviar la incidencia. Comprueba tu conexión e inténtalo de nuevo.";
    } finally {
      if (button) { button.disabled = false; button.textContent = "Enviar incidencia"; }
    }
  }

  async function loadCustomerSupportTickets() {
    var client = supportCurrentDb();
    var list = document.getElementById("supportTicketsList");
    if (!list) return;
    if (!client) { list.textContent = "Inicia sesión para consultar tus solicitudes."; return; }
    list.textContent = "Cargando tus solicitudes…";
    var result = await client.from("support_tickets")
      .select("id,ticket_code,category,subject,reference,status,created_at,updated_at")
      .order("updated_at", { ascending: false }).limit(30);
    if (result.error) {
      list.textContent = "No pudimos cargar tus solicitudes. Comprueba tu conexión e inténtalo de nuevo.";
      console.error("Error cargando solicitudes del cliente:", result.error);
      return;
    }
    list.replaceChildren();
    if (!result.data || !result.data.length) {
      list.append(supportElement("p", "empty-note", "Todavía no has enviado ninguna incidencia."));
      return;
    }
    result.data.forEach(function (ticket) {
      var card = supportElement("button", "support-ticket-card");
      card.type = "button";
      var top = supportElement("span", "support-ticket-card-top");
      top.append(
        supportElement("strong", "", ticket.ticket_code),
        supportElement("span", "support-ticket-status status-" + ticket.status, SUPPORT_STATUS_LABELS[ticket.status] || ticket.status)
      );
      card.append(top);
      card.append(supportElement("strong", "support-ticket-subject", ticket.subject));
      card.append(supportElement("small", "", (SUPPORT_CATEGORY_LABELS[ticket.category] || "Consulta") + " · Actualizada " + supportDate(ticket.updated_at)));
      card.addEventListener("click", function () { openCustomerSupportTicket(ticket.id); });
      list.append(card);
    });
  }

  function appendSupportMessages(container, messages, ticket, adminView) {
    container.replaceChildren();
    if (!messages || !messages.length) {
      container.append(supportElement("p", "empty-note", "Todavía no hay mensajes en esta solicitud."));
      return;
    }
    messages.forEach(function (message) {
      var mine = adminView ? message.sender_id !== ticket.user_id : message.sender_id === currentUser.id;
      var bubble = supportElement("article", "support-chat-message" + (mine ? " mine" : ""));
      bubble.append(supportElement("strong", "support-chat-author",
        adminView ? (mine ? "Tienda El Castillo" : "Cliente") : (mine ? "Tú" : "Tienda El Castillo")));
      bubble.append(supportElement("p", "", message.body));
      bubble.append(supportElement("small", "", supportDate(message.created_at)));
      container.append(bubble);
    });
  }

  async function openCustomerSupportTicket(ticketId) {
    var client = supportCurrentDb();
    var thread = document.getElementById("supportTicketThread");
    var list = document.getElementById("supportTicketsList");
    var compose = document.querySelector("#supportView .support-gate-panel");
    var header = document.getElementById("supportTicketThreadHeader");
    var messagesBox = document.getElementById("supportTicketMessages");
    if (!client || !thread || !header || !messagesBox) return;
    activeCustomerSupportTicketId = ticketId;
    header.textContent = "Cargando solicitud…";
    messagesBox.replaceChildren();
    thread.hidden = false;
    if (list) list.hidden = true;
    if (compose) compose.hidden = true;
    var ticketResult = await client.from("support_tickets")
      .select("id,user_id,ticket_code,category,subject,reference,status,created_at,updated_at")
      .eq("id", ticketId).single();
    if (ticketResult.error) { header.textContent = "No pudimos abrir esta solicitud."; return; }
    var ticket = ticketResult.data;
    var messageResult = await client.from("support_messages")
      .select("id,sender_id,body,created_at")
      .eq("ticket_id", ticketId).order("created_at", { ascending: true });
    if (messageResult.error) { header.textContent = "No pudimos cargar los mensajes de esta solicitud."; return; }
    header.replaceChildren(
      supportElement("strong", "", ticket.ticket_code + " · " + ticket.subject),
      supportElement("span", "support-ticket-status status-" + ticket.status, SUPPORT_STATUS_LABELS[ticket.status] || ticket.status),
      supportElement("small", "", SUPPORT_CATEGORY_LABELS[ticket.category] || "Consulta")
    );
    appendSupportMessages(messagesBox, messageResult.data, ticket, false);
    var replyBox = document.getElementById("supportCustomerReplyBox");
    if (replyBox) replyBox.hidden = ticket.status === "closed";
  }

  function closeCustomerSupportTicket() {
    activeCustomerSupportTicketId = null;
    var thread = document.getElementById("supportTicketThread");
    var list = document.getElementById("supportTicketsList");
    var compose = document.querySelector("#supportView .support-gate-panel");
    if (thread) thread.hidden = true;
    if (list) list.hidden = false;
    if (compose) compose.hidden = false;
    loadCustomerSupportTickets();
  }

  async function sendCustomerSupportReply() {
    var client = supportCurrentDb();
    var input = document.getElementById("supportReplyMessage");
    var status = document.getElementById("supportReplyMessageStatus");
    var body = input ? input.value.trim() : "";
    if (!client || !activeCustomerSupportTicketId) return;
    if (body.length < 8 || body.length > 1500) { if (status) status.textContent = "Escribe una respuesta de entre 8 y 1500 caracteres."; return; }
    if (status) status.textContent = "Enviando respuesta…";
    var result = await client.rpc("reply_support_ticket", { p_ticket_id: activeCustomerSupportTicketId, p_message: body });
    if (result.error) { if (status) status.textContent = result.error.message || "No se pudo enviar la respuesta."; return; }
    if (input) input.value = "";
    if (status) status.textContent = "Respuesta enviada.";
    var id = activeCustomerSupportTicketId;
    await openCustomerSupportTicket(id);
    await loadCustomerSupportTickets();
  }

  async function loadAdminSupportTickets() {
    var client = supportCurrentDb();
    var list = document.getElementById("adminSupportTickets");
    var status = document.getElementById("adminSupportMessage");
    if (!list) return;
    if (!client || typeof currentProfile === "undefined" || currentProfile?.role !== "admin") {
      list.textContent = "Esta bandeja solo está disponible para administración.";
      return;
    }
    if (status) status.textContent = "Actualizando solicitudes…";
    list.textContent = "Cargando incidencias…";
    var result = await client.from("support_tickets")
      .select("id,user_id,ticket_code,category,subject,reference,status,created_at,updated_at")
      .order("updated_at", { ascending: false }).limit(100);
    if (result.error) {
      list.textContent = "No se pudieron cargar las incidencias. Comprueba la conexión y los permisos.";
      if (status) status.textContent = result.error.message || "Error al cargar soporte.";
      console.error("Error de bandeja de soporte:", result.error);
      return;
    }
    var userIds = Array.from(new Set((result.data || []).map(function (ticket) { return ticket.user_id; })));
    var profilesById = {};
    if (userIds.length) {
      var profiles = await client.from("profiles").select("id,full_name,email").in("id", userIds);
      if (!profiles.error) (profiles.data || []).forEach(function (profile) { profilesById[profile.id] = profile; });
    }
    list.replaceChildren();
    if (!result.data || !result.data.length) {
      list.append(supportElement("p", "empty-note", "Todavía no hay incidencias de clientes."));
      if (status) status.textContent = "Bandeja actualizada. No hay solicitudes pendientes.";
      return;
    }
    result.data.forEach(function (ticket) {
      var profile = profilesById[ticket.user_id] || {};
      var customer = profile.full_name || profile.email || "Cliente";
      var card = supportElement("button", "support-ticket-card admin-support-ticket-card");
      card.type = "button";
      var top = supportElement("span", "support-ticket-card-top");
      top.append(
        supportElement("strong", "", ticket.ticket_code),
        supportElement("span", "support-ticket-status status-" + ticket.status, SUPPORT_STATUS_LABELS[ticket.status] || ticket.status)
      );
      card.append(top);
      card.append(supportElement("strong", "support-ticket-subject", ticket.subject));
      card.append(supportElement("small", "", customer + " · " + (SUPPORT_CATEGORY_LABELS[ticket.category] || "Consulta") + " · " + supportDate(ticket.updated_at)));
      if (ticket.reference) card.append(supportElement("small", "support-ticket-reference", "Referencia: " + ticket.reference));
      card.addEventListener("click", function () { openAdminSupportTicket(ticket.id); });
      list.append(card);
    });
    if (status) status.textContent = result.data.length + " solicitud(es) cargada(s).";
  }

  async function openAdminSupportTicket(ticketId) {
    var client = supportCurrentDb();
    var thread = document.getElementById("adminSupportThread");
    var list = document.getElementById("adminSupportTickets");
    var header = document.getElementById("adminSupportThreadHeader");
    var messagesBox = document.getElementById("adminSupportThreadMessages");
    if (!client || !thread || !header || !messagesBox) return;
    activeAdminSupportTicketId = ticketId;
    thread.hidden = false;
    if (list) list.hidden = true;
    header.textContent = "Cargando solicitud…";
    var ticketResult = await client.from("support_tickets")
      .select("id,user_id,ticket_code,category,subject,reference,status,created_at,updated_at")
      .eq("id", ticketId).single();
    if (ticketResult.error) { header.textContent = "No pudimos abrir esta solicitud."; return; }
    var ticket = ticketResult.data;
    if (ticket.status === "open") {
      await client.from("support_tickets").update({ status: "in_progress", updated_at: new Date().toISOString() }).eq("id", ticket.id);
      ticket.status = "in_progress";
    }
    var profiles = await client.from("profiles").select("full_name,email").eq("id", ticket.user_id).maybeSingle();
    var customer = profiles.data?.full_name || profiles.data?.email || "Cliente";
    var messageResult = await client.from("support_messages")
      .select("id,sender_id,body,created_at")
      .eq("ticket_id", ticketId).order("created_at", { ascending: true });
    if (messageResult.error) { header.textContent = "No pudimos cargar los mensajes."; return; }
    header.replaceChildren(
      supportElement("strong", "", ticket.ticket_code + " · " + ticket.subject),
      supportElement("span", "support-ticket-status status-" + ticket.status, SUPPORT_STATUS_LABELS[ticket.status] || ticket.status),
      supportElement("small", "", customer + " · " + (SUPPORT_CATEGORY_LABELS[ticket.category] || "Consulta")),
      supportElement("small", "", ticket.reference ? "Referencia: " + ticket.reference : "Sin referencia aportada")
    );
    appendSupportMessages(messagesBox, messageResult.data, ticket, true);
    var replyBox = document.querySelector("#adminSupportThread .support-thread-actions");
    if (replyBox) replyBox.hidden = ticket.status === "closed";
  }

  function closeAdminSupportTicket() {
    activeAdminSupportTicketId = null;
    var thread = document.getElementById("adminSupportThread");
    var list = document.getElementById("adminSupportTickets");
    if (thread) thread.hidden = true;
    if (list) list.hidden = false;
    loadAdminSupportTickets();
  }

  async function sendAdminSupportReply() {
    var client = supportCurrentDb();
    var input = document.getElementById("adminSupportReply");
    var status = document.getElementById("adminSupportReplyStatus");
    var body = input ? input.value.trim() : "";
    if (!client || !activeAdminSupportTicketId) return;
    if (body.length < 8 || body.length > 1500) { if (status) status.textContent = "Escribe una respuesta de entre 8 y 1500 caracteres."; return; }
    if (status) status.textContent = "Enviando respuesta al cliente…";
    var result = await client.rpc("reply_support_ticket", { p_ticket_id: activeAdminSupportTicketId, p_message: body });
    if (result.error) { if (status) status.textContent = result.error.message || "No se pudo enviar la respuesta."; return; }
    if (input) input.value = "";
    if (status) status.textContent = "Respuesta enviada. El cliente podrá verla en «Mis solicitudes».";
    var id = activeAdminSupportTicketId;
    await openAdminSupportTicket(id);
    await loadAdminSupportTickets();
  }

  async function resolveAdminSupportTicket() {
    var client = supportCurrentDb();
    var status = document.getElementById("adminSupportReplyStatus");
    if (!client || !activeAdminSupportTicketId) return;
    var result = await client.from("support_tickets")
      .update({ status: "resolved", updated_at: new Date().toISOString() })
      .eq("id", activeAdminSupportTicketId);
    if (result.error) { if (status) status.textContent = result.error.message || "No se pudo actualizar el estado."; return; }
    if (status) status.textContent = "Solicitud marcada como resuelta.";
    var id = activeAdminSupportTicketId;
    await openAdminSupportTicket(id);
    await loadAdminSupportTickets();
  }

  window.submitSupportTicket = submitSupportTicket;
  window.loadCustomerSupportTickets = loadCustomerSupportTickets;
  window.openCustomerSupportTicket = openCustomerSupportTicket;
  window.closeCustomerSupportTicket = closeCustomerSupportTicket;
  window.sendCustomerSupportReply = sendCustomerSupportReply;
  window.loadAdminSupportTickets = loadAdminSupportTickets;
  window.openAdminSupportTicket = openAdminSupportTicket;
  window.closeAdminSupportTicket = closeAdminSupportTicket;
  window.sendAdminSupportReply = sendAdminSupportReply;
  window.resolveAdminSupportTicket = resolveAdminSupportTicket;

  window.showGuideList = showGuideList;
  window.showGameGuide = showGameGuide;
  window.updateSupportGuidance = updateSupportGuidance;

  function initCustomerCenter() {
    activateCommunityButtons();
    updateSupportGuidance();
    if (typeof window.showView === "function" && !window.showView.__castleSupportHooked) {
      var originalShowView = window.showView;
      var hookedShowView = function (name) {
        var result = originalShowView.apply(this, arguments);
        if (name === "support") loadCustomerSupportTickets();
        return result;
      };
      hookedShowView.__castleSupportHooked = true;
      window.showView = hookedShowView;
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initCustomerCenter, { once: true });
  } else {
    initCustomerCenter();
  }
})();