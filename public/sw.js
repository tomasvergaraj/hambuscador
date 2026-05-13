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

const VERSION = "v3";
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
  const url = new URL(req.url);

  // PWA Share Target POST: el OS comparte fotos al PWA → browser hace POST
  // multipart/form-data a /api/share. Lo interceptamos, guardamos los Files
  // en IndexedDB, y redirigimos a /agregar?share=1 que los lee en cliente.
  if (
    req.method === "POST" &&
    url.origin === self.location.origin &&
    url.pathname === "/api/share"
  ) {
    event.respondWith(handleShareTargetPost(req));
    return;
  }

  // Solo manejar GET — POST de server actions debe pasar al network
  if (req.method !== "GET") return;

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

// -----------------------------------------------------------------------------
// PWA Share Target — POST handler
// -----------------------------------------------------------------------------
// Extrae Files del multipart FormData, los persiste en IDB (key "current") y
// redirige al wizard /agregar?share=1, que al montar consume IDB y los pasa
// al PhotoUploader. No tocamos el server — toda la lógica vive client-side.
//
// Si algo falla, redirigimos igual sin files (defensa: el wizard arranca
// vacío como siempre y el user repite el flow manual).

const SHARE_DB_NAME = "hambuscador-share";
const SHARE_DB_VERSION = 1;
const SHARE_STORE = "files";
const SHARE_KEY = "current";

function openShareDb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(SHARE_DB_NAME, SHARE_DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(SHARE_STORE)) {
        db.createObjectStore(SHARE_STORE);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function putSharedFilesInIdb(files) {
  if (!files.length) return;
  const db = await openShareDb();
  try {
    await new Promise((resolve, reject) => {
      const tx = db.transaction(SHARE_STORE, "readwrite");
      tx.objectStore(SHARE_STORE).put({ files, createdAt: Date.now() }, SHARE_KEY);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } finally {
    db.close();
  }
}

async function handleShareTargetPost(req) {
  try {
    const formData = await req.formData();
    const files = [];
    // El manifest declara params.files[].name = "photos"; algunos OS también
    // mandan en otros campos — barremos todo y filtramos por tipo image/*.
    for (const value of formData.values()) {
      if (value instanceof File && value.type.startsWith("image/")) {
        files.push(value);
      }
    }
    if (files.length > 0) {
      await putSharedFilesInIdb(files.slice(0, 4));
    }
  } catch (err) {
    // Silent — el redirect siempre se dispara, el wizard arranca limpio si
    // falló el handoff.
  }
  return Response.redirect("/agregar?share=1", 303);
}

// -----------------------------------------------------------------------------
// Push notifications (Web Push API)
// -----------------------------------------------------------------------------

self.addEventListener("push", (event) => {
  if (!event.data) return;
  let payload;
  try {
    payload = event.data.json();
  } catch {
    payload = { title: "hambuscador", body: event.data.text() };
  }
  const { title = "hambuscador", body = "", url = "/", tag, icon, badge } = payload;
  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      icon: icon || "/icon-192.png",
      badge: badge || "/icon-192.png",
      tag,
      data: { url },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const targetUrl = event.notification?.data?.url || "/perfil/notificaciones";
  event.waitUntil(
    (async () => {
      const all = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      // Si ya hay tab del sitio abierto, lo enfocamos y navegamos.
      for (const client of all) {
        if (new URL(client.url).origin === self.location.origin) {
          await client.focus();
          if ("navigate" in client) {
            try {
              await client.navigate(targetUrl);
            } catch {
              /* algunas plataformas no permiten navigate cross-origin; ignorar */
            }
          }
          return;
        }
      }
      // Sino, abrimos una ventana nueva.
      await self.clients.openWindow(targetUrl);
    })(),
  );
});

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
