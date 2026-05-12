import type { NextRequest } from "next/server";

/**
 * PWA Share Target handler. Recibe lo que el SO mobile pasa desde el menú
 * "Compartir" cuando el usuario tiene Hambuscador instalada y elige nuestra
 * app como destino del share.
 *
 * Manifest declara `method: GET` (no files por ahora) con params title/text/url.
 *
 * Heurística para decidir destino:
 *  1. Si la URL parece un local en Google Maps (maps.google, goo.gl/maps,
 *     google.com/maps) intentamos extraer el nombre del title o del path y
 *     mandamos al wizard `/agregar?nombre=...`. Usuario completa el resto.
 *  2. Si hay text/title pero ninguna URL útil → tratamos como query de búsqueda
 *     `/buscar?q=...`.
 *  3. Default → `/`.
 *
 * No usamos POST/multipart (que admite files) porque eso requiere SW listener
 * + caché temporal de los blobs para pasarlos al cliente — out of scope MVP.
 * Cuando se justifique, agregar `method: "POST"` al manifest y un handler en
 * `public/sw.js` que intercepte y guarde en Cache.
 */
const GOOGLE_MAPS_HOSTS = new Set([
  "maps.google.com",
  "maps.google.cl",
  "www.google.com",
  "www.google.cl",
  "google.com",
  "google.cl",
  "goo.gl",
  "maps.app.goo.gl",
]);

export function GET(req: NextRequest) {
  const url = new URL(req.url);
  const title = (url.searchParams.get("title") ?? "").trim();
  const text = (url.searchParams.get("text") ?? "").trim();
  const sharedUrl = (url.searchParams.get("url") ?? "").trim();

  // Caso 1: viene URL de Google Maps → intentamos extraer nombre.
  const mapsName = extractNameFromGoogleMaps(sharedUrl, title, text);
  if (mapsName) {
    const qs = new URLSearchParams({ nombre: mapsName }).toString();
    return Response.redirect(new URL(`/agregar?${qs}`, url.origin), 303);
  }

  // Caso 2: hay text/title → query de búsqueda.
  const q = (title || text).slice(0, 100);
  if (q) {
    const qs = new URLSearchParams({ q }).toString();
    return Response.redirect(new URL(`/buscar?${qs}`, url.origin), 303);
  }

  // Default: solo URL ajena no actionable → home.
  return Response.redirect(new URL("/", url.origin), 303);
}

/**
 * Si `sharedUrl` parece un local de Google Maps, retorna un nombre candidato
 * (preferimos el `title` que mandó el OS, que suele ser el nombre del local).
 * Si no luce a Maps, retorna null.
 */
function extractNameFromGoogleMaps(
  sharedUrl: string,
  title: string,
  text: string,
): string | null {
  if (!sharedUrl) return null;
  let host: string;
  try {
    host = new URL(sharedUrl).hostname.toLowerCase();
  } catch {
    return null;
  }
  if (!GOOGLE_MAPS_HOSTS.has(host)) return null;

  // El title suele ser el nombre del local, ej. "Streat Burger - Providencia".
  // Cortamos en " - " / " · " para limpiar comuna que Maps appenda.
  const candidate = (title || text).trim();
  if (!candidate) return null;
  const cleaned = candidate.split(/\s+[-·]\s+/)[0]?.trim() ?? candidate;
  return cleaned.slice(0, 100) || null;
}
