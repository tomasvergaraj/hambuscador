// ============================================================================
// web-vitals — persistencia y lectura de métricas Core Web Vitals.
// ----------------------------------------------------------------------------
// Escritura: fire-and-forget desde /api/vitals (no bloquear el beacon del
// cliente). Lectura: agregados P75 por métrica/path para /admin/perf.
//
// Defensivo: si la DB no está configurada (modo demo), todas las funciones
// son no-op / retornan vacíos. Nunca tirar excepciones que rompan el endpoint.
// ============================================================================

import { sql } from "drizzle-orm";

import { getDb, isDbConfigured } from "@/server/db/client";
import { webVitals } from "@/server/db/schema";

export const KNOWN_METRICS = ["CLS", "LCP", "INP", "FCP", "TTFB", "FID"] as const;
export type WebVitalMetric = (typeof KNOWN_METRICS)[number];

export type LogVitalInput = {
  metric: string;
  value: number;
  rating?: string | null;
  path?: string | null;
  metricId?: string | null;
  navType?: string | null;
};

/**
 * Inserta una métrica. Swallow de errores — si falla, el evento se pierde
 * pero el cliente no se entera (beacon ya respondió 204).
 */
export async function logVital(input: LogVitalInput): Promise<void> {
  if (!isDbConfigured()) return;
  // Sanity: solo persistir métricas conocidas para no llenar la tabla con basura.
  const metric = String(input.metric || "").toUpperCase();
  if (!KNOWN_METRICS.includes(metric as WebVitalMetric)) return;
  if (typeof input.value !== "number" || !Number.isFinite(input.value)) return;
  try {
    const db = getDb();
    await db.insert(webVitals).values({
      metric,
      value: input.value,
      rating: input.rating ?? null,
      path: input.path ?? null,
      metricId: input.metricId ?? null,
      navType: input.navType ?? null,
    });
  } catch {
    // swallow — métricas no son críticas
  }
}

export type VitalsSummaryRow = {
  metric: string;
  count: number;
  p75: number;
  p95: number;
  good: number;
  needsImprovement: number;
  poor: number;
};

/**
 * Summary global por métrica en los últimos N días: count, P75, P95 y
 * distribución de ratings. Una fila por métrica conocida (con datos).
 */
export async function getVitalsSummary(opts?: {
  days?: number;
}): Promise<VitalsSummaryRow[]> {
  if (!isDbConfigured()) return [];
  const { days = 7 } = opts ?? {};
  const db = getDb();
  const rows = await db.execute(sql`
    SELECT
      metric,
      COUNT(*)::int AS count,
      percentile_cont(0.75) WITHIN GROUP (ORDER BY value)::real AS p75,
      percentile_cont(0.95) WITHIN GROUP (ORDER BY value)::real AS p95,
      SUM(CASE WHEN rating = 'good' THEN 1 ELSE 0 END)::int AS good,
      SUM(CASE WHEN rating = 'needs-improvement' THEN 1 ELSE 0 END)::int AS ni,
      SUM(CASE WHEN rating = 'poor' THEN 1 ELSE 0 END)::int AS poor
    FROM web_vitals
    WHERE created_at >= NOW() - INTERVAL '1 day' * ${days}
    GROUP BY metric
    ORDER BY metric
  `);
  return rows.rows.map((r) => {
    const row = r as {
      metric?: string;
      count?: number;
      p75?: number;
      p95?: number;
      good?: number;
      ni?: number;
      poor?: number;
    };
    return {
      metric: String(row.metric ?? ""),
      count: Number(row.count ?? 0),
      p75: Number(row.p75 ?? 0),
      p95: Number(row.p95 ?? 0),
      good: Number(row.good ?? 0),
      needsImprovement: Number(row.ni ?? 0),
      poor: Number(row.poor ?? 0),
    };
  });
}

export type PathP75Row = {
  path: string;
  count: number;
  p75: number;
};

/**
 * Top paths con peor P75 para una métrica dada. Filtro defensivo: solo paths
 * con al menos `minSamples` mediciones (sino una sola visita lenta empuja
 * cualquier ruta al top).
 */
export async function getWorstPathsByMetric(opts: {
  metric: WebVitalMetric;
  days?: number;
  limit?: number;
  minSamples?: number;
}): Promise<PathP75Row[]> {
  if (!isDbConfigured()) return [];
  const { metric, days = 7, limit = 10, minSamples = 5 } = opts;
  const db = getDb();
  const rows = await db.execute(sql`
    SELECT
      path,
      COUNT(*)::int AS count,
      percentile_cont(0.75) WITHIN GROUP (ORDER BY value)::real AS p75
    FROM web_vitals
    WHERE metric = ${metric}
      AND path IS NOT NULL
      AND created_at >= NOW() - INTERVAL '1 day' * ${days}
    GROUP BY path
    HAVING COUNT(*) >= ${minSamples}
    ORDER BY p75 DESC
    LIMIT ${limit}
  `);
  return rows.rows.map((r) => {
    const row = r as { path?: string; count?: number; p75?: number };
    return {
      path: String(row.path ?? ""),
      count: Number(row.count ?? 0),
      p75: Number(row.p75 ?? 0),
    };
  });
}

export type VitalsTotals = {
  totalEvents: number;
  uniquePaths: number;
};

export async function getVitalsTotals(opts?: { days?: number }): Promise<VitalsTotals> {
  if (!isDbConfigured()) return { totalEvents: 0, uniquePaths: 0 };
  const { days = 7 } = opts ?? {};
  const db = getDb();
  const rows = await db.execute(sql`
    SELECT
      COUNT(*)::int AS total,
      COUNT(DISTINCT path)::int AS paths
    FROM web_vitals
    WHERE created_at >= NOW() - INTERVAL '1 day' * ${days}
  `);
  const r = rows.rows[0] as { total?: number; paths?: number } | undefined;
  return {
    totalEvents: r?.total ?? 0,
    uniquePaths: r?.paths ?? 0,
  };
}
