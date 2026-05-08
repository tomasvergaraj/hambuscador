// ============================================================================
// search-logs — service para loguear queries de /buscar y leer agregados.
// ----------------------------------------------------------------------------
// Filosofía: una fila por VISITA a /buscar?q=… (no por keystroke). Llamado
// desde el server component vía `next/after()` para no bloquear el render.
// Las funciones de lectura agregan por `normalized_query` así "Quillota",
// "quillota" y "quilllota" cuentan juntos (con la lógica de dedup que
// queramos extender luego).
// ============================================================================

import { sql } from "drizzle-orm";

import { normalizeForSearch } from "@/lib/search";
import { getDb, isDbConfigured } from "@/server/db/client";
import { searchLogs } from "@/server/db/schema";

export type SearchLogSource = "list" | "map";

/**
 * Loguea una query. Fire-and-forget seguro: si falla, swallow del error
 * (no queremos que un problema de logging tire la página).
 */
export async function logSearch(input: {
  query: string;
  resultCount: number;
  usedFuzzy: boolean;
  userId?: string | null;
  source: SearchLogSource;
}): Promise<void> {
  if (!isDbConfigured()) return;
  const trimmed = input.query.trim();
  if (!trimmed) return;
  try {
    const db = getDb();
    await db.insert(searchLogs).values({
      query: trimmed,
      normalizedQuery: normalizeForSearch(trimmed),
      resultCount: input.resultCount,
      usedFuzzy: input.usedFuzzy,
      userId: input.userId ?? null,
      source: input.source,
    });
  } catch {
    // swallow — logging no debería romper nada
  }
}

export type SearchLogStat = {
  normalizedQuery: string;
  /** Última versión "como la tipearon" — útil para mostrar tildes/case original. */
  sampleQuery: string;
  count: number;
  zeroHits: number;
  avgResultCount: number;
  lastSeenAt: Date;
};

/**
 * Top queries por cantidad en los últimos N días.
 * `sample_query` se obtiene con `MAX(query)` — no es la última cronológicamente
 * estricta, pero alcanza para identificar la query.
 */
export async function getPopularQueries(opts?: {
  days?: number;
  limit?: number;
}): Promise<SearchLogStat[]> {
  if (!isDbConfigured()) return [];
  const { days = 7, limit = 30 } = opts ?? {};
  const db = getDb();
  const rows = await db.execute(sql`
    SELECT
      normalized_query,
      MAX(query) AS sample_query,
      COUNT(*)::int AS count,
      SUM(CASE WHEN result_count = 0 THEN 1 ELSE 0 END)::int AS zero_hits,
      AVG(result_count)::numeric(10,2) AS avg_result_count,
      MAX(created_at) AS last_seen_at
    FROM search_logs
    WHERE created_at >= NOW() - INTERVAL '1 day' * ${days}
    GROUP BY normalized_query
    ORDER BY count DESC, last_seen_at DESC
    LIMIT ${limit}
  `);
  return rows.rows.map(toStat);
}

/**
 * Queries que NUNCA dieron resultado (strict + fuzzy fallido) en los
 * últimos N días. Source de gold para nuevos sinónimos / catalog gaps.
 */
export async function getZeroHitQueries(opts?: {
  days?: number;
  limit?: number;
}): Promise<SearchLogStat[]> {
  if (!isDbConfigured()) return [];
  const { days = 30, limit = 30 } = opts ?? {};
  const db = getDb();
  const rows = await db.execute(sql`
    SELECT
      normalized_query,
      MAX(query) AS sample_query,
      COUNT(*)::int AS count,
      COUNT(*)::int AS zero_hits,
      0::numeric AS avg_result_count,
      MAX(created_at) AS last_seen_at
    FROM search_logs
    WHERE result_count = 0
      AND created_at >= NOW() - INTERVAL '1 day' * ${days}
    GROUP BY normalized_query
    ORDER BY count DESC, last_seen_at DESC
    LIMIT ${limit}
  `);
  return rows.rows.map(toStat);
}

export type SearchLogSummary = {
  totalSearches: number;
  zeroHitSearches: number;
  fuzzyFallbackSearches: number;
  uniqueQueries: number;
};

export async function getSearchSummary(opts?: {
  days?: number;
}): Promise<SearchLogSummary> {
  if (!isDbConfigured()) {
    return {
      totalSearches: 0,
      zeroHitSearches: 0,
      fuzzyFallbackSearches: 0,
      uniqueQueries: 0,
    };
  }
  const { days = 7 } = opts ?? {};
  const db = getDb();
  const rows = await db.execute(sql`
    SELECT
      COUNT(*)::int AS total,
      SUM(CASE WHEN result_count = 0 THEN 1 ELSE 0 END)::int AS zero,
      SUM(CASE WHEN used_fuzzy THEN 1 ELSE 0 END)::int AS fuzzy,
      COUNT(DISTINCT normalized_query)::int AS unique_q
    FROM search_logs
    WHERE created_at >= NOW() - INTERVAL '1 day' * ${days}
  `);
  const r = rows.rows[0] as
    | {
        total?: number;
        zero?: number;
        fuzzy?: number;
        unique_q?: number;
      }
    | undefined;
  return {
    totalSearches: r?.total ?? 0,
    zeroHitSearches: r?.zero ?? 0,
    fuzzyFallbackSearches: r?.fuzzy ?? 0,
    uniqueQueries: r?.unique_q ?? 0,
  };
}

function toStat(row: Record<string, unknown>): SearchLogStat {
  return {
    normalizedQuery: String(row.normalized_query ?? ""),
    sampleQuery: String(row.sample_query ?? ""),
    count: Number(row.count ?? 0),
    zeroHits: Number(row.zero_hits ?? 0),
    avgResultCount: Number(row.avg_result_count ?? 0),
    lastSeenAt: new Date(String(row.last_seen_at ?? new Date().toISOString())),
  };
}
