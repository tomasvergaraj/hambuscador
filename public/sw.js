// =============================================================================
// Hambuscador — service worker
// -----------------------------------------------------------------------------
// Estrategia simple, suficiente para "instalar como app" + offline básico:
//   - Pages HTML: network-first → cache → fallback /offline
//   - Assets de Next (/_next/static/*): cache-first (immutable, hashed)
//   - Imágenes y fuentes: stale-while-revalidate
//   - Resto: network-only (DB, auth, server actions, etc)
//
// Versión bumpea cuando cambia este archivo → caches viejos se borran al
// activar el SW nuevo.
// =============================================================================

const VERSION = "v1";
const CACHE_HTML = `hb-html-${VERSION}`;
const CACHE_STATIC = `hb-static-${VERSION}`;
const CACHE_ASSETS = `hb-assets-${VERSION}`;
const OFFLINE_URL = "/offline";

// URLs que pre-cacheamos al instalar el SW para asegurar offline mínimo
const PRECACHE = [OFFLINE_URL, "/manifest.webmanifest"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE_HTML);
      // addAll falla atómico — preferimos que no rompa la instalación si
      // alguno no responde.
      await Promise.all(
        PRECACHE.map((url) =>
          cache.add(url).catch(() => {
            /* ignore */
          }),
        ),
      );
      // Skip waiting → SW nuevo activa sin esperar a cerrar tabs viejos
      await self.skipWaiting();
    })(),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      // Borrar caches de versiones anteriores
      const keys = await caches.keys();
      await Promise.all(
        keys
          .filter((k) => !k.endsWith(`-${VERSION}`) && k.startsWith("hb-"))
          .map((k) => caches.delete(k)),
      );
      await self.clients.claim();
    })(),
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;

  // Solo manejar GET — POST de server actions debe pasar al network
  if (req.method !== "GET") return;

  const url = new URL(req.url);

  // Mismo origen únicamente — externos (Nominatim, OSM tiles, etc) no se cachean
  if (url.origin !== self.location.origin) return;

  // Server actions y rutas dinámicas de auth → network-only
  if (
    url.pathname.startsWith("/api/") ||
    url.pathname.startsWith("/admin/") ||
    url.pathname === "/perfil" ||
    url.pathname.startsWith("/iniciar-sesion") ||
    url.pathname.startsWith("/registro")
  ) {
    return;
  }

  // Assets estáticos de Next (immutable, hashed) → cache-first
  if (url.pathname.startsWith("/_next/static/")) {
    event.respondWith(cacheFirst(req, CACHE_STATIC));
    return;
  }

  // Imágenes y fuentes → stale-while-revalidate
  if (
    url.pathname.startsWith("/_next/image") ||
    url.pathname.match(/\.(png|jpg|jpeg|webp|svg|woff2?|ttf)$/i)
  ) {
    event.respondWith(staleWhileRevalidate(req, CACHE_ASSETS));
    return;
  }

  // Documentos HTML → network-first con fallback a cache → offline
  if (req.mode === "navigate" || req.headers.get("accept")?.includes("text/html")) {
    event.respondWith(networkFirst(req, CACHE_HTML));
    return;
  }
});

// -----------------------------------------------------------------------------
// Estrategias
// -----------------------------------------------------------------------------

async function cacheFirst(req, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(req);
  if (cached) return cached;
  try {
    const res = await fetch(req);
    if (res.ok) cache.put(req, res.clone());
    return res;
  } catch (err) {
    return Response.error();
  }
}

async function staleWhileRevalidate(req, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(req);
  const fetchPromise = fetch(req)
    .then((res) => {
      if (res.ok) cache.put(req, res.clone());
      return res;
    })
    .catch(() => cached || Response.error());
  return cached || fetchPromise;
}

async function networkFirst(req, cacheName) {
  const cache = await caches.open(cacheName);
  try {
    const res = await fetch(req);
    if (res.ok) cache.put(req, res.clone());
    return res;
  } catch (err) {
    const cached = await cache.match(req);
    if (cached) return cached;
    // Último recurso: la offline page pre-cacheada
    const offline = await cache.match(OFFLINE_URL);
    if (offline) return offline;
    return Response.error();
  }
}
