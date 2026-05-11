// ============================================================================
// Geolocalización del usuario — manejada via cookie corta y opt-in.
// ----------------------------------------------------------------------------
// El usuario aprieta "usar mi ubicación", el navegador pide permiso, y si lo
// concede se setea esta cookie. El servidor la lee en RSC para pasar lat/lng
// a `getPlacesNearby`. Cookie chica (≈18 bytes), HttpOnly imposible (necesita
// setter desde JS), SameSite=Lax y 1 día de TTL.
// ============================================================================

export const GEO_COOKIE_NAME = "hb_geo";
export const GEO_COOKIE_MAX_AGE_S = 60 * 60 * 24; // 1 día

export type GeoCoords = { lat: number; lng: number };

/**
 * Lee una cookie con formato `lat,lng`. Devuelve null si está ausente,
 * malformada o fuera de rango.
 */
export function parseGeoCookie(value: string | undefined): GeoCoords | null {
  if (!value) return null;
  const [latStr, lngStr] = value.split(",");
  const lat = Number(latStr);
  const lng = Number(lngStr);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  if (lat < -90 || lat > 90) return null;
  if (lng < -180 || lng > 180) return null;
  return { lat, lng };
}

/** Formato: "lat,lng" con 5 decimales (~1m de precisión, suficiente). */
export function serializeGeoCookie(coords: GeoCoords): string {
  return `${coords.lat.toFixed(5)},${coords.lng.toFixed(5)}`;
}

/** Distancia haversine en km entre dos puntos. */
export function haversineKm(a: GeoCoords, b: GeoCoords): number {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const lat1 = (a.lat * Math.PI) / 180;
  const lat2 = (b.lat * Math.PI) / 180;
  const h =
    Math.sin(dLat / 2) ** 2 + Math.sin(dLng / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2);
  return 2 * R * Math.asin(Math.sqrt(h));
}

/**
 * Dada una coord del usuario y un array de regiones con centroide, devuelve la
 * más cercana. Aproximación: las regiones de Chile son alargadas pero el
 * centroide funciona razonablemente para "en qué región estás" (UI sorting,
 * no para validación estricta).
 */
export function findClosestRegion<T extends { lat: number; lng: number }>(
  coords: GeoCoords,
  regions: T[],
): T | null {
  if (regions.length === 0) return null;
  let best: T | null = null;
  let bestDist = Infinity;
  for (const r of regions) {
    const d = haversineKm(coords, { lat: r.lat, lng: r.lng });
    if (d < bestDist) {
      bestDist = d;
      best = r;
    }
  }
  return best;
}
