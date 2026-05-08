// ============================================================================
// comunas service — catálogo oficial de Chile + filtro por presencia.
// ----------------------------------------------------------------------------
// `getActiveComunas()` devuelve solo comunas con ≥1 place aprobado, para que
// el dropdown de búsqueda no ofrezca "Tortel" cuando todavía no hay nada allá.
// `getAllComunas()` devuelve las 346 — pensado para el wizard de /agregar
// donde el usuario puede aportar en cualquier comuna.
//
// Match con `places.comunaSlug` por igualdad exacta (slug ASCII normalizado).
// La metadata vive en la tabla `comunas` (346 filas, migration
// `drizzle/2026-05-08-comunas.sql`).
// ============================================================================

import { sql } from "drizzle-orm";

import { COMUNAS_REGISTRY } from "@/lib/constants";
import { getDb, isDbConfigured } from "@/server/db/client";

export type Comuna = {
  slug: string;
  label: string;
  regionSlug: string;
  regionLabel: string;
  lat: number;
  lng: number;
};

type ComunaRow = {
  slug: string;
  label: string;
  region_slug: string;
  region_label: string;
  lat: string;
  lng: string;
};

function rowToComuna(row: ComunaRow): Comuna {
  return {
    slug: row.slug,
    label: row.label,
    regionSlug: row.region_slug,
    regionLabel: row.region_label,
    lat: Number(row.lat),
    lng: Number(row.lng),
  };
}

function fallbackFromRegistry(): Comuna[] {
  return COMUNAS_REGISTRY.map((c) => ({
    slug: c.slug,
    label: c.label,
    regionSlug: slugifyRegion(c.region),
    regionLabel: c.region,
    lat: c.lat,
    lng: c.lng,
  }));
}

function isMissingTableError(err: unknown): boolean {
  return err instanceof Error && /relation .* does not exist/i.test(err.message);
}

/**
 * Comunas con presencia (≥1 place aprobado). En modo demo o si la tabla aún
 * no existe en el ambiente, cae al registry hardcoded de constants.
 */
export async function getActiveComunas(): Promise<Comuna[]> {
  if (!isDbConfigured()) return fallbackFromRegistry();

  const db = getDb();
  try {
    const rows = await db.execute<ComunaRow>(sql`
      SELECT c.slug, c.label, c.region_slug, c.region_label, c.lat, c.lng
      FROM comunas c
      WHERE EXISTS (
        SELECT 1 FROM places p
        WHERE p.comuna_slug = c.slug AND p.moderation_status = 'approved'
      )
      ORDER BY c.label
    `);
    return rows.rows.map(rowToComuna);
  } catch (err) {
    if (isMissingTableError(err)) return fallbackFromRegistry();
    throw err;
  }
}

/**
 * Todas las comunas oficiales (346). Para el wizard `/agregar` y casos donde
 * necesitamos ofrecer cualquier comuna sea o no que ya tenga presencia.
 */
export async function getAllComunas(): Promise<Comuna[]> {
  if (!isDbConfigured()) return fallbackFromRegistry();

  const db = getDb();
  try {
    const rows = await db.execute<ComunaRow>(sql`
      SELECT slug, label, region_slug, region_label, lat, lng
      FROM comunas
      ORDER BY label
    `);
    return rows.rows.map(rowToComuna);
  } catch (err) {
    if (isMissingTableError(err)) return fallbackFromRegistry();
    throw err;
  }
}

// COMUNAS_REGISTRY (mock) tiene `region` como label suelto; mapeo a region_slug
// para mantener la API uniforme. Solo cubre las 2 regiones del seed.
function slugifyRegion(label: string): string {
  if (label === "Región Metropolitana") return "metropolitana";
  if (label === "Región de Valparaíso") return "valparaiso";
  return label
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/ñ/g, "n")
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-");
}
