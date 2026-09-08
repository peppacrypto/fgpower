// Minimal service worker for PWA installability. Deliberately NOT an
// offline-first cache: workout state lives server-side (Postgres), so a
// stale cached page would be actively wrong mid-workout. This only caches
// the static app shell (icons, manifest) so the browser considers the app
// installable, and passes everything else straight to the network.
const CACHE_NAME = "fgpower-shell-v1";
const SHELL_ASSETS = ["/manifest.webmanifest", "/icons/icon-192.png", "/icons/icon-512.png"];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(SHELL_ASSETS)));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))),
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  const url = new URL(event.request.url);
  if (!SHELL_ASSETS.includes(url.pathname)) return; // network-only for everything else

  event.respondWith(
    caches.match(event.request).then((cached) => cached || fetch(event.request)),
  );
});
