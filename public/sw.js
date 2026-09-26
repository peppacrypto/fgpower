// FGPOWER service worker. Deliberately NOT an offline-first app cache: workout
// state lives server-side (Postgres) and in-flight sets in localStorage, so a
// stale cached page would be actively wrong mid-workout. What it does:
//  - pages (navigations): network-first, never cached; when the network fails
//    it serves a branded static /offline.html instead of the browser's error
//    page (the installed app has no back button to escape that);
//  - hashed build assets (/_next/static/*) and exercise photos: cache-first,
//    so a reload with bad signal still has its JS/CSS and pictures;
//  - everything else (RSC payloads, server actions, /api, HTML) goes straight
//    to the network and is never cached.
// Bump CACHE_NAME whenever a SHELL_ASSETS file changes (offline.html included):
// the browser only reinstalls the worker, and re-precaches, when sw.js changes.
const CACHE_NAME = "fgpower-shell-v2";
const STATIC_CACHE = "fgpower-static-v2";
const OFFLINE_URL = "/offline.html";
const SHELL_ASSETS = [
  OFFLINE_URL,
  "/manifest.webmanifest",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
  "/brand/fgpower-tile.png",
];
// Exercise photos are many and large (the library is ~870 exercises): keep
// only the most recently cached ones.
const STATIC_MAX_ENTRIES = 400;

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      // `reload` bypasses the HTTP cache so the precache never pins a stale copy.
      .then((cache) => cache.addAll(SHELL_ASSETS.map((url) => new Request(url, { cache: "reload" })))),
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keep = [CACHE_NAME, STATIC_CACHE];
      const keys = await caches.keys();
      await Promise.all(keys.filter((k) => !keep.includes(k)).map((k) => caches.delete(k)));
      // Lets the page request start while the worker boots (network-first stays fast).
      if (self.registration.navigationPreload) await self.registration.navigationPreload.enable();
      await self.clients.claim();
    })(),
  );
});

function isStaticAsset(url) {
  if (url.origin !== self.location.origin) return false;
  if (url.pathname.startsWith("/_next/static/")) return true;
  if (url.pathname.startsWith("/exercises/") && url.pathname.endsWith(".webp")) return true;
  // next/image serves the same photos resized: /_next/image?url=/exercises/…webp&w=…
  if (url.pathname === "/_next/image") {
    const src = url.searchParams.get("url") ?? "";
    return src.startsWith("/exercises/") && src.endsWith(".webp");
  }
  return false;
}

async function trim(cache) {
  const keys = await cache.keys();
  const excess = keys.length - STATIC_MAX_ENTRIES;
  // Cache.keys() returns insertion order: drop the oldest first.
  for (let i = 0; i < excess; i++) await cache.delete(keys[i]);
}

async function cacheFirst(event) {
  const cache = await caches.open(STATIC_CACHE);
  const cached = await cache.match(event.request);
  if (cached) return cached;
  const response = await fetch(event.request);
  if (response.ok && response.type === "basic") {
    event.waitUntil(cache.put(event.request, response.clone()).then(() => trim(cache)));
  }
  return response;
}

async function networkFirstPage(event) {
  try {
    const preloaded = await event.preloadResponse;
    if (preloaded) return preloaded;
    return await fetch(event.request);
  } catch {
    // Offline (or the server is unreachable): the branded fallback, served at
    // the requested URL so "Tentar de novo" (location.reload) retries it.
    const offline = await caches.match(OFFLINE_URL, { cacheName: CACHE_NAME });
    return offline ?? Response.error();
  }
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return; // server actions, autosave, API writes
  const url = new URL(request.url);

  if (request.mode === "navigate") {
    event.respondWith(networkFirstPage(event));
    return;
  }
  if (isStaticAsset(url)) {
    event.respondWith(cacheFirst(event));
    return;
  }
  if (url.origin === self.location.origin && SHELL_ASSETS.includes(url.pathname)) {
    event.respondWith(caches.match(request, { cacheName: CACHE_NAME }).then((cached) => cached ?? fetch(request)));
  }
  // Everything else: untouched, network-only.
});
