/* PostHog analytics for Tienda El Castillo — production storefront only. */
(() => {
  "use strict";

  const PROJECT_TOKEN = "phc_x2G8iwd8DBffkR8nXpQ2jNAFqhVHRpGZTZYy3EJb3KV7";
  const API_HOST = "https://us.i.posthog.com";
  const LIVE_HOST = "tiendaelcastillo.github.io";

  // Do not send development previews or local tests to the live customer project.
  if (window.location.hostname !== LIVE_HOST || !PROJECT_TOKEN) return;

  // Official lightweight PostHog browser snippet. The SDK loads asynchronously.
  !function (t, e) {
    var o, n, p, r;
    e.__SV || (window.posthog = e, e._i = [], e.init = function (i, s, a) {
      function g(t, e) {
        var o = e.split(".");
        2 == o.length && (t = t[o[0]], e = o[1]);
        t[e] = function () { t.push([e].concat(Array.prototype.slice.call(arguments, 0))); };
      }
      (p = t.createElement("script")).type = "text/javascript";
      p.crossOrigin = "anonymous";
      p.async = !0;
      p.src = s.api_host.replace(".i.posthog.com", "-assets.i.posthog.com") + "/static/array.js";
      (r = t.getElementsByTagName("script")[0]).parentNode.insertBefore(p, r);
      var u = e;
      for (void 0 !== a ? u = e[a] = [] : a = "posthog", u.people = u.people || [],
        Object.defineProperty(u, "toString", { configurable: !0, enumerable: !0, writable: !0, value: function (t) {
          var e = "posthog";
          return "posthog" !== a && (e += "." + a), t || (e += " (stub)"), e;
        } }),
        Object.defineProperty(u.people, "toString", { configurable: !0, enumerable: !0, writable: !0, value: function () {
          return u.toString(1) + ".people (stub)";
        } }),
        o = "init capture register register_once register_for_session unregister unregister_for_session identify reset get_distinct_id get_session_id debug".split(" "),
        n = 0; n < o.length; n++) g(u, o[n]);
      e._i.push([i, s, a]);
    }, e.__SV = 1);
  }(document, window.posthog || []);

  // Limpiar direcciones automáticas antes de enviar cualquier evento.
  // Evita transmitir códigos temporales de confirmación o recuperación en consultas o fragmentos.
  const stripUrlSecrets = (target) => {
    if (!target || typeof target !== "object" || Array.isArray(target)) return;
    Object.keys(target).forEach((key) => {
      if (/(url|referrer|href)/i.test(key) && typeof target[key] === "string") {
        target[key] = target[key].split(/[?#]/, 1)[0];
      }
    });
  };
  const sanitizePostHogEvent = (event) => {
    if (!event) return null;
    stripUrlSecrets(event.properties);
    stripUrlSecrets(event.$set);
    stripUrlSecrets(event.$set_once);
    return event;
  };

  const allowedProperties = new Set(["game", "package", "payment_method", "view", "account_role", "source"]);
  const cleanProperties = (input) => {
    const output = {};
    if (!input || typeof input !== "object") return output;
    Object.keys(input).forEach((key) => {
      if (!allowedProperties.has(key)) return;
      const value = input[key];
      if (typeof value !== "string") return;
      const clean = value.replace(/[\u0000-\u001f<>]/g, "").trim().slice(0, 80);
      if (clean) output[key] = clean;
    });
    return output;
  };

  try {
    window.posthog.init(PROJECT_TOKEN, {
      api_host: API_HOST,
      defaults: "2026-08-30",
      autocapture: false,
      capture_pageview: false,
      capture_pageleave: false,
      disable_session_recording: true,
      person_profiles: "identified_only",
      persistence: "localStorage+cookie",
      before_send: sanitizePostHogEvent
    });

    // Keep the public analytics API narrow so private checkout fields cannot be sent by mistake.
    window.castleAnalytics = Object.freeze({
      capture(eventName, properties) {
        if (typeof eventName !== "string" || !/^[a-z][a-z0-9_]{1,60}$/.test(eventName)) return;
        const safeProperties = cleanProperties(properties);

        // Mantener el registro existente en PostHog.
        try { window.posthog.capture(eventName, safeProperties); } catch (_) {}

        // Reenviar a Google Analytics solo eventos cortos y propiedades permitidas.
        // No se envían identificadores de usuario, correos, teléfonos ni datos del pedido.
        if (eventName.length <= 40 && typeof window.gtag === "function") {
          try { window.gtag("event", eventName, safeProperties); } catch (_) {}
        }
      },
      identify(userId, properties) {
        if (typeof userId !== "string" || !userId || userId.length > 100) return;
        try { window.posthog.identify(userId, cleanProperties(properties)); } catch (_) {}
      },
      reset() {
        try { window.posthog.reset(); } catch (_) {}
      },
      pageview(pageName) {
        // Never include query strings or URL fragments; Supabase recovery links can contain credentials there.
        const safeUrl = window.location.origin + window.location.pathname;
        try {
          window.posthog.capture("$pageview", {
            $current_url: safeUrl,
            $pathname: window.location.pathname,
            page_name: String(pageName || "storefront").slice(0, 60)
          });
        } catch (_) {}
      }
    });

    window.castleAnalytics.pageview("storefront");
  } catch (error) {
    // Analytics is non-essential and must never prevent purchases or authentication.
    console.warn("La analítica no está disponible; la tienda seguirá funcionando.", error);
  }
})();
