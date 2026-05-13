import { IconActivity, IconRoute } from "@tabler/icons-react";

import {
  getTopPathsByCount,
  getVitalsSummary,
  getVitalsTotals,
  getWorstPathsByMetric,
  KNOWN_METRICS,
  type PathCountRow,
  type PathP75Row,
  type VitalsSummaryRow,
  type WebVitalMetric,
} from "@/server/services/web-vitals";

export const metadata = { title: "admin · perf" };
export const dynamic = "force-dynamic";

type SearchParams = { dias?: string };

const ALLOWED_DAYS = new Set([1, 7, 30]);

export default async function AdminPerfPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const sp = await searchParams;
  const requestedDays = Number(sp.dias);
  const days = ALLOWED_DAYS.has(requestedDays) ? requestedDays : 7;

  const [summary, totals, worstLcp, worstInp, topPaths] = await Promise.all([
    getVitalsSummary({ days }),
    getVitalsTotals({ days }),
    getWorstPathsByMetric({ metric: "LCP", days, limit: 8 }),
    getWorstPathsByMetric({ metric: "INP", days, limit: 8 }),
    getTopPathsByCount({ days, limit: 10 }),
  ]);

  return (
    <main className="px-4 py-5 flex-1 max-w-3xl mx-auto w-full">
      <div className="flex items-baseline justify-between mb-4 flex-wrap gap-2">
        <h1 className="font-display font-semibold text-xl text-carbon">perf</h1>
        <RangeTabs days={days} />
      </div>

      {/* Totales */}
      <section className="grid grid-cols-2 gap-2 mb-6">
        <SummaryCard
          icon={<IconActivity size={16} aria-hidden="true" />}
          label="eventos"
          value={totals.totalEvents}
        />
        <SummaryCard
          icon={<IconRoute size={16} aria-hidden="true" />}
          label="paths únicos"
          value={totals.uniquePaths}
        />
      </section>

      {/* Tabla por métrica */}
      <section className="mb-8">
        <div className="flex items-baseline justify-between mb-2 gap-2 flex-wrap">
          <h2 className="font-display font-semibold text-base text-carbon">
            métricas
          </h2>
          <span className="text-[11px] text-bronceado">
            P75 / P95 + distribución
          </span>
        </div>
        <MetricsTable rows={summary} />
      </section>

      {/* Top paths por visitas */}
      <section className="mb-6">
        <div className="flex items-baseline justify-between mb-2 gap-2 flex-wrap">
          <h2 className="font-display font-semibold text-base text-carbon">
            rutas más visitadas
          </h2>
          <span className="text-[11px] text-bronceado">
            proxy: 1 evento LCP ≈ 1 page-view
          </span>
        </div>
        <TopPathsTable rows={topPaths} />
      </section>

      {/* Worst paths por LCP */}
      <section className="mb-6">
        <div className="flex items-baseline justify-between mb-2 gap-2 flex-wrap">
          <h2 className="font-display font-semibold text-base text-carbon">
            peores rutas — LCP
          </h2>
          <span className="text-[11px] text-bronceado">
            min. 5 mediciones por ruta
          </span>
        </div>
        <PathTable rows={worstLcp} metric="LCP" />
      </section>

      {/* Worst paths por INP */}
      <section>
        <div className="flex items-baseline justify-between mb-2 gap-2 flex-wrap">
          <h2 className="font-display font-semibold text-base text-carbon">
            peores rutas — INP
          </h2>
          <span className="text-[11px] text-bronceado">
            interaction-to-next-paint
          </span>
        </div>
        <PathTable rows={worstInp} metric="INP" />
      </section>
    </main>
  );
}

function RangeTabs({ days }: { days: number }) {
  const opts: Array<{ d: number; label: string }> = [
    { d: 1, label: "24h" },
    { d: 7, label: "7d" },
    { d: 30, label: "30d" },
  ];
  return (
    <div className="inline-flex bg-crema-deep border border-crema-edge rounded-full p-0.5">
      {opts.map((o) => {
        const active = o.d === days;
        const href = o.d === 7 ? "/admin/perf" : `/admin/perf?dias=${o.d}`;
        return (
          <a
            key={o.d}
            href={href}
            className={
              "px-3 py-1 rounded-full text-xs transition-colors " +
              (active
                ? "bg-carbon text-crema font-medium"
                : "text-tinta-suave hover:text-carbon")
            }
          >
            {o.label}
          </a>
        );
      })}
    </div>
  );
}

function SummaryCard({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
}) {
  return (
    <div className="bg-white border border-crema-edge rounded-xl px-3 py-2.5">
      <div className="flex items-center gap-1.5 text-bronceado">
        {icon}
        <span className="text-[10px] uppercase tracking-wider font-medium">
          {label}
        </span>
      </div>
      <div className="mt-1 font-display font-semibold text-xl text-carbon">
        {value.toLocaleString("es-CL")}
      </div>
    </div>
  );
}

function MetricsTable({ rows }: { rows: VitalsSummaryRow[] }) {
  // Garantizar fila por cada métrica conocida — aunque no haya datos,
  // mostramos el slot vacío para que el admin sepa qué se está midiendo.
  const byMetric = new Map(rows.map((r) => [r.metric, r]));
  const ordered = KNOWN_METRICS.map(
    (m) =>
      byMetric.get(m) ?? {
        metric: m,
        count: 0,
        p75: 0,
        p95: 0,
        good: 0,
        needsImprovement: 0,
        poor: 0,
      },
  );

  return (
    <div className="bg-white border border-crema-edge rounded-xl overflow-hidden">
      <div className="grid grid-cols-[60px_60px_1fr_1fr_2fr] gap-2 px-3 py-2 bg-crema-deep border-b border-crema-edge text-[10px] uppercase tracking-wider text-bronceado font-medium">
        <span>métrica</span>
        <span className="text-right">n</span>
        <span className="text-right">P75</span>
        <span className="text-right">P95</span>
        <span>distribución</span>
      </div>
      <ul>
        {ordered.map((r) => (
          <li
            key={r.metric}
            className="grid grid-cols-[60px_60px_1fr_1fr_2fr] gap-2 px-3 py-2 border-b border-crema-edge last:border-0 items-center"
          >
            <span
              className={
                "text-xs font-mono font-semibold " +
                ratingTextClass(metricRating(r.metric as WebVitalMetric, r.p75))
              }
            >
              {r.metric}
            </span>
            <span className="text-xs text-tinta-suave text-right tabular-nums">
              {r.count.toLocaleString("es-CL")}
            </span>
            <span className="text-xs text-carbon text-right tabular-nums font-medium">
              {formatMetric(r.metric as WebVitalMetric, r.p75)}
            </span>
            <span className="text-xs text-tinta-suave text-right tabular-nums">
              {formatMetric(r.metric as WebVitalMetric, r.p95)}
            </span>
            <DistributionBar
              good={r.good}
              ni={r.needsImprovement}
              poor={r.poor}
            />
          </li>
        ))}
      </ul>
    </div>
  );
}

function DistributionBar({
  good,
  ni,
  poor,
}: {
  good: number;
  ni: number;
  poor: number;
}) {
  const total = good + ni + poor;
  if (total === 0) {
    return <span className="text-[10px] text-bronceado">sin datos</span>;
  }
  const gPct = (good / total) * 100;
  const nPct = (ni / total) * 100;
  const pPct = (poor / total) * 100;
  return (
    <div className="flex items-center gap-2">
      <div
        className="h-2 rounded-full overflow-hidden bg-crema-deep flex flex-1 min-w-0"
        title={`good ${gPct.toFixed(0)}% · ni ${nPct.toFixed(0)}% · poor ${pPct.toFixed(0)}%`}
      >
        {gPct > 0 && <div className="bg-lechuga h-full" style={{ width: `${gPct}%` }} />}
        {nPct > 0 && <div className="bg-mostaza h-full" style={{ width: `${nPct}%` }} />}
        {pPct > 0 && <div className="bg-tomate h-full" style={{ width: `${pPct}%` }} />}
      </div>
      <span className="text-[10px] text-bronceado tabular-nums shrink-0">
        {gPct.toFixed(0)}/{nPct.toFixed(0)}/{pPct.toFixed(0)}
      </span>
    </div>
  );
}

function TopPathsTable({ rows }: { rows: PathCountRow[] }) {
  if (rows.length === 0) {
    return (
      <div className="text-xs text-tinta-suave bg-crema-deep/60 border border-crema-edge rounded-xl px-3 py-4 text-center">
        sin datos suficientes en este rango.
      </div>
    );
  }
  const total = rows.reduce((acc, r) => acc + r.count, 0);
  const top = rows[0]?.count ?? 0;
  return (
    <div className="bg-white border border-crema-edge rounded-xl overflow-hidden">
      <div className="grid grid-cols-[1fr_auto_auto] gap-2 px-3 py-2 bg-crema-deep border-b border-crema-edge text-[10px] uppercase tracking-wider text-bronceado font-medium">
        <span>ruta</span>
        <span className="text-right">vistas</span>
        <span className="text-right">% del top</span>
      </div>
      <ul>
        {rows.map((r) => {
          const pct = top > 0 ? (r.count / top) * 100 : 0;
          return (
            <li
              key={r.path}
              className="grid grid-cols-[1fr_auto_auto] gap-2 px-3 py-2 border-b border-crema-edge last:border-0 items-center relative"
            >
              {/* Barra de proporción al fondo, sutil */}
              <div
                className="absolute inset-y-0 left-0 bg-mostaza/10"
                style={{ width: `${pct}%` }}
                aria-hidden="true"
              />
              <span className="text-xs text-carbon font-mono truncate relative z-10">
                {r.path}
              </span>
              <span className="text-xs text-carbon font-medium text-right tabular-nums relative z-10">
                {r.count.toLocaleString("es-CL")}
              </span>
              <span className="text-[11px] text-tinta-suave text-right tabular-nums relative z-10">
                {pct.toFixed(0)}%
              </span>
            </li>
          );
        })}
      </ul>
      <div className="px-3 py-2 bg-crema-deep/60 border-t border-crema-edge text-[11px] text-bronceado">
        total mostrado: {total.toLocaleString("es-CL")} vistas
      </div>
    </div>
  );
}

function PathTable({
  rows,
  metric,
}: {
  rows: PathP75Row[];
  metric: WebVitalMetric;
}) {
  if (rows.length === 0) {
    return (
      <div className="text-xs text-tinta-suave bg-crema-deep/60 border border-crema-edge rounded-xl px-3 py-4 text-center">
        sin datos suficientes en este rango.
      </div>
    );
  }
  return (
    <div className="bg-white border border-crema-edge rounded-xl overflow-hidden">
      <div className="grid grid-cols-[1fr_auto_auto] gap-2 px-3 py-2 bg-crema-deep border-b border-crema-edge text-[10px] uppercase tracking-wider text-bronceado font-medium">
        <span>ruta</span>
        <span className="text-right">n</span>
        <span className="text-right">P75</span>
      </div>
      <ul>
        {rows.map((r) => (
          <li
            key={r.path}
            className="grid grid-cols-[1fr_auto_auto] gap-2 px-3 py-2 border-b border-crema-edge last:border-0 items-center"
          >
            <span className="text-xs text-carbon font-mono truncate">{r.path}</span>
            <span className="text-xs text-tinta-suave text-right tabular-nums">
              {r.count}
            </span>
            <span
              className={
                "text-xs text-right tabular-nums font-medium " +
                ratingTextClass(metricRating(metric, r.p75))
              }
            >
              {formatMetric(metric, r.p75)}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

// ============================================================================
// Helpers de formato y thresholds. Los thresholds vienen del estándar Web
// Vitals (web.dev/vitals). Si Google los actualiza, alinear acá.
// ============================================================================

type Rating = "good" | "ni" | "poor" | "none";

function metricRating(metric: WebVitalMetric, value: number): Rating {
  if (!value) return "none";
  switch (metric) {
    case "CLS":
      return value < 0.1 ? "good" : value < 0.25 ? "ni" : "poor";
    case "LCP":
      return value < 2500 ? "good" : value < 4000 ? "ni" : "poor";
    case "INP":
      return value < 200 ? "good" : value < 500 ? "ni" : "poor";
    case "FCP":
      return value < 1800 ? "good" : value < 3000 ? "ni" : "poor";
    case "TTFB":
      return value < 800 ? "good" : value < 1800 ? "ni" : "poor";
    case "FID":
      return value < 100 ? "good" : value < 300 ? "ni" : "poor";
  }
}

function ratingTextClass(rating: Rating): string {
  switch (rating) {
    case "good":
      return "text-lechuga";
    case "ni":
      return "text-mostaza-deep";
    case "poor":
      return "text-tomate";
    case "none":
      return "text-bronceado";
  }
}

function formatMetric(metric: WebVitalMetric, value: number): string {
  if (!value) return "—";
  if (metric === "CLS") return value.toFixed(3);
  return `${Math.round(value).toLocaleString("es-CL")}ms`;
}
