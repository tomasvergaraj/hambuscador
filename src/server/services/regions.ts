// ============================================================================
// regions service — catálogo de regiones de Chile con filtro por presencia.
// ----------------------------------------------------------------------------
// `getActiveRegions()` devuelve solo las regiones con ≥1 place aprobado, para
// que el dropdown de búsqueda no ofrezca "Aysén" cuando todavía no hay nada
// allá. La metadata (slug, label, centroide, zoom) vive en la tabla `regions`
// (16 filas seedeadas vía `drizzle/2026-05-08-regions.sql`).
//
// El match con `places.region` es por label exacto — los seeds usan los
// nombres oficiales ("Región Metropolitana", "Región de Valparaíso", etc.)
// que es lo que el wizard de /agregar y los seeds de places guardan.
// ============================================================================

import { sql } from "drizzle-orm";

import { REGIONS_REGISTRY } from "@/lib/constants";
import { getDb, isDbConfigured } from "@/server/db/client";

export type Region = {
  slug: string;
  label: string;
  lat: number;
  lng: number;
  zoom: number;
};

/**
 * Regiones con presencia (≥1 place aprobado). En modo demo cae al registry
 * hardcoded de constants (RM + Valpo, que son las del seed).
 */
export async function getActiveRegions(): Promise<Region[]> {
  if (!isDbConfigured()) {
    return REGIONS_REGISTRY.map((r) => ({
      slug: r.slug,
      label: r.label,
      lat: r.lat,
      lng: r.lng,
      zoom: r.zoom,
    }));
  }

  const db = getDb();
  try {
    const rows = await db.execute<{
      slug: string;
      label: string;
      lat: string;
      lng: string;
      zoom: number;
    }>(sql`
      SELECT r.slug, r.label, r.lat, r.lng, r.zoom
      FROM regions r
      WHERE EXISTS (
        SELECT 1 FROM places p
        WHERE p.region = r.label AND p.moderation_status = 'approved'
      )
      ORDER BY r.label
    `);

    return rows.rows.map((row) => ({
      slug: row.slug,
      label: row.label,
      lat: Number(row.lat),
      lng: Number(row.lng),
      zoom: row.zoom,
    }));
  } catch (err) {
    // Defensive: si la tabla `regions` no existe (migration aún no aplicada
    // en este ambiente), caemos al registry hardcoded en vez de tirar 500.
    // Después de aplicar `drizzle/2026-05-08-regions.sql` el catch deja de
    // dispararse y el endpoint pasa a la fuente dinámica.
    if (err instanceof Error && /relation .* does not exist/i.test(err.message)) {
      return REGIONS_REGISTRY.map((r) => ({
        slug: r.slug,
        label: r.label,
        lat: r.lat,
        lng: r.lng,
        zoom: r.zoom,
      }));
    }
    throw err;
  }
}
