// ============================================================================
// Service de listas curadas — CRUD sobre la tabla `picas_lists`.
// ----------------------------------------------------------------------------
// Las listas viven en DB y son editables desde /admin/picas. Cuando no hay
// DATABASE_URL, los reads caen al hardcoded `PICAS_LISTS` de `lib/picas.ts`
// (modo demo). Las mutaciones requieren DB obligatoria.
// ============================================================================

import { asc, eq, sql } from "drizzle-orm";

import {
  PICAS_LISTS,
  type PicaIconName,
  type PicasList,
  type PicasListCriteria,
} from "@/lib/picas";
import { getDb, isDbConfigured } from "@/server/db/client";
import {
  picasLists,
  type DbPicasList,
  type NewDbPicasList,
} from "@/server/db/schema";

function dbToList(row: DbPicasList): PicasList {
  return {
    slug: row.slug,
    title: row.title,
    hook: row.hook,
    intro: row.intro,
    icon: row.icon as PicaIconName,
    maxItems: row.maxItems,
    criteria: (row.criteria ?? {}) as PicasListCriteria,
  };
}

/**
 * Lista activas pa el index público. Ordenadas por `sort_order ASC`.
 * Fallback hardcoded en modo demo.
 */
export async function getActivePicasLists(): Promise<PicasList[]> {
  if (!isDbConfigured()) return PICAS_LISTS;
  const db = getDb();
  const rows = await db
    .select()
    .from(picasLists)
    .where(eq(picasLists.isActive, true))
    .orderBy(asc(picasLists.sortOrder), asc(picasLists.slug));
  // Si la tabla está vacía (migration aplicada pero seed no), no romper el
  // sitio público — devolver hardcoded como fallback transparente.
  return rows.length > 0 ? rows.map(dbToList) : PICAS_LISTS;
}

/** Lista TODO (incl. inactivas) — para el admin. */
export async function getAllPicasListsForAdmin(): Promise<
  Array<DbPicasList>
> {
  if (!isDbConfigured()) return [];
  const db = getDb();
  return db
    .select()
    .from(picasLists)
    .orderBy(asc(picasLists.sortOrder), asc(picasLists.slug));
}

export async function getPicasListBySlugFromDb(
  slug: string,
): Promise<PicasList | null> {
  if (!isDbConfigured()) {
    return PICAS_LISTS.find((l) => l.slug === slug) ?? null;
  }
  const db = getDb();
  const [row] = await db
    .select()
    .from(picasLists)
    .where(eq(picasLists.slug, slug))
    .limit(1);
  if (row) return dbToList(row);
  // Fallback: si la tabla aún no tiene seed, intentar hardcoded.
  return PICAS_LISTS.find((l) => l.slug === slug) ?? null;
}

/** Trae el row crudo para el admin (incluye sortOrder, isActive, timestamps). */
export async function getPicasListRowForAdmin(
  slug: string,
): Promise<DbPicasList | null> {
  if (!isDbConfigured()) return null;
  const db = getDb();
  const [row] = await db
    .select()
    .from(picasLists)
    .where(eq(picasLists.slug, slug))
    .limit(1);
  return row ?? null;
}

export async function createPicasList(input: NewDbPicasList): Promise<DbPicasList> {
  if (!isDbConfigured()) {
    throw new Error("createPicasList requiere DATABASE_URL");
  }
  const db = getDb();
  const [row] = await db.insert(picasLists).values(input).returning();
  if (!row) throw new Error("INSERT no retornó fila");
  return row;
}

export async function updatePicasList(
  slug: string,
  patch: Partial<Omit<NewDbPicasList, "slug" | "createdAt">>,
): Promise<void> {
  if (!isDbConfigured()) {
    throw new Error("updatePicasList requiere DATABASE_URL");
  }
  const db = getDb();
  await db
    .update(picasLists)
    .set({ ...patch, updatedAt: new Date() })
    .where(eq(picasLists.slug, slug));
}

export async function deletePicasList(slug: string): Promise<void> {
  if (!isDbConfigured()) {
    throw new Error("deletePicasList requiere DATABASE_URL");
  }
  const db = getDb();
  await db.delete(picasLists).where(eq(picasLists.slug, slug));
}

/** Cuenta total de listas — útil pa badges del admin nav si querés. */
export async function countPicasLists(): Promise<number> {
  if (!isDbConfigured()) return PICAS_LISTS.length;
  const db = getDb();
  const rows = await db.execute(
    sql`SELECT COUNT(*)::int AS count FROM picas_lists`,
  );
  return (rows.rows[0] as { count?: number } | undefined)?.count ?? 0;
}
