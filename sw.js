const APP_ROOT = self.registration.scope;
const scopePath = new URL(APP_ROOT).pathname.replace(/\/+$/, "") || "/";
const scopeName = scopePath === "/" ? "root" : scopePath.replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "");
const CACHE_PREFIX = "el-castillo-" + scopeName + "-";
const CACHE_NAME = CACHE_PREFIX + "shell-v119";
const APP_SHELL = [
  "./",
  "./index.html",
  "./manifest.webmanifest",
  "./castle-icon.svg",
  "./recargar-free-fire-cuba.html",
  "./recargas-juegos-cuba.html",
  "./recargar-mobile-legends-cuba.html",
  "./assets/game-art.svg?v=5",
  "./assets/game-art.svg?v=6",
  "./assets/free-fire-hero.svg",
  "./assets/product-diamonds.svg",
  "./assets/product-pass.svg",
  "./assets/product-card.svg",
  "./assets/product-level.svg",
  "./assets/castle-logo.webp",
  "./assets/games/free-fire.webp?v=2",
  "./assets/games/free-fire-tienda.webp?v=2",
  "./assets/games/mobile-legends-bang-bang.webp?v=2",
  "./assets/games/blood-strike-cover.webp?v=2",
  "./assets/games/mlbb-diamonds.svg",
  "./assets/games/mlbb-weekly.svg",
  "./assets/games/mlbb-monthly.svg",
  "./assets/games/mlbb-twilight.svg",
  "./assets/admin-panel.css?v=31",
  "./assets/offline-guard.js?v=2",
  "./assets/admin-panel.js?v=16",
  "./assets/diamond-pile.svg",
  "./assets/diamond-chest.svg",
  "./assets/ff-diamonds-110.svg",
  "./assets/ff-diamonds-341.svg",
  "./assets/ff-diamonds-572.svg",
  "./assets/ff-diamonds-1166.svg",
  "./assets/ff-diamonds-2398.svg",
  "./assets/ff-diamonds-6160.svg",
  "./assets/ff-diamonds-small-medium.webp",
  "./assets/ff-diamonds-chest-booyah.webp",
  "./assets/ff-weekly-blue-purple.webp",
  "./assets/ff-monthly.webp"
];

const INDEX_URL = new URL("./index.html", APP_ROOT).href;
const ROOT_URL = new URL("./", APP_ROOT).href;

async function cacheUrl(cache, url, cacheKey = url) {
  try {
    const response = await fetch(url, { cache: "reload" });
    if (response && response.ok && response.type !== "opaque") {
      await cache.put(cacheKey, response);
      return true;
    }
  } catch (_) {
    // A missing optional asset must not prevent the store from opening.
  }
  return false;
}

self.addEventListener("install", event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);

    // Prioritize the actual store page. Optional images and admin files are
    // cached independently so one slow or missing asset cannot cancel install.
    const pageSaved = await cacheUrl(cache, INDEX_URL, INDEX_URL);
    if (pageSaved) {
      await cacheUrl(cache, ROOT_URL, ROOT_URL);
    } else {
      // Keep the previous offline page when an update is installed without Internet.
      const previousCaches = (await caches.keys()).filter(key =>
        key !== CACHE_NAME && key.startsWith(CACHE_PREFIX)
      );
      for (const previousName of previousCaches) {
        const previousCache = await caches.open(previousName);
        const previousPage =
          await previousCache.match(INDEX_URL) ||
          await previousCache.match(ROOT_URL);
        if (previousPage) {
          await cache.put(INDEX_URL, previousPage.clone());
          await cache.put(ROOT_URL, previousPage.clone());
          break;
        }
      }
    }

    await Promise.all(APP_SHELL
      .filter(path => path !== "./" && path !== "./index.html")
      .map(path => cacheUrl(cache, new URL(path, APP_ROOT).href)));

    await self.skipWaiting();
  })());
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(key =>
          key !== CACHE_NAME && key.startsWith(CACHE_PREFIX)
        ).map(key => caches.delete(key))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", event => {
  const request = event.request;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  const isLocal = url.origin === self.location.origin;
  const isSupabaseLibrary =
    (url.hostname === "cdn.jsdelivr.net" &&
      url.pathname.includes("/npm/@supabase/supabase-js")) ||
    (url.hostname === "unpkg.com" &&
      url.pathname.startsWith("/@supabase/supabase-js@"));
  const isProductArtwork =
    url.hostname === "seagm-media.seagmcdn.com" ||
    url.hostname === "cdn.prod.website-files.com" ||
    url.hostname === "assets.nuuvem.com" ||
    url.hostname === "cdn1.codashop.com" ||
    url.hostname === "r.res.easebar.com";

  // Auth, database reads, orders, payment proofs and provider calls are network-only.
  // Product artwork may be cached after its first successful load for later visits/offline use.
  if (!isLocal && !isSupabaseLibrary && !isProductArtwork) return;

  event.respondWith((async () => {
    const cache = await caches.open(CACHE_NAME);

    if (request.mode === "navigate" && isLocal) {
      // Network first: do not let an old cached index hide newly published store updates.
      try {
        const response = await fetch(request, { cache: "no-store" });
        if (response && response.ok) {
          await cache.put(INDEX_URL, response.clone()).catch(() => {});
          await cache.put(ROOT_URL, response.clone()).catch(() => {});
        }
        if (response) return response;
      } catch (_) {
        // Use the last valid local page when the connection is unavailable.
      }

      const cachedPage =
        await cache.match(INDEX_URL) ||
        await cache.match(ROOT_URL);
      if (cachedPage) return cachedPage;
      return Response.error();
    }

    const cached = await cache.match(request);
    if (cached) return cached;

    try {
      const response = await fetch(request);
      if (response && ((response.ok && response.type !== "opaque") ||
          (isProductArtwork && response.type === "opaque"))) {
        await cache.put(request, response.clone()).catch(() => {});
      }
      return response;
    } catch (_) {
      return Response.error();
    }
  })());
});
