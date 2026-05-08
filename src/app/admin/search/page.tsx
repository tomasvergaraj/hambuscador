import {
  IconChartBar,
  IconSearch,
  IconSearchOff,
  IconSparkles,
} from "@tabler/icons-react";

import {
  getPopularQueries,
  getZeroHitQueries,
  getSearchSummary,
  type SearchLogStat,
} from "@/server/services/search-logs";

export const metadata = { title: "admin · búsquedas" };
export const dynamic = "force-dynamic";

type SearchParams = { dias?: string };

const ALLOWED_DAYS = new Set([1, 7, 30]);

export default async function AdminSearchPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const sp = await searchParams;
  const requestedDays = Number(sp.dias);
  const days = ALLOWED_DAYS.has(requestedDays) ? requestedDays : 7;

  const [summary, popular, zeroHits] = await Promise.all([
    getSearchSummary({ days }),
    getPopularQueries({ days, limit: 30 }),
    getZeroHitQueries({ days: 30, limit: 30 }),
  ]);

  return (
    <main className="px-4 py-5 flex-1 max-w-3xl mx-auto w-full">
      <div className="flex items-baseline justify-between mb-4 flex-wrap gap-2">
        <h1 className="font-display font-semibold text-xl text-carbon">
          búsquedas
        </h1>
        <RangeTabs days={days} />
      </div>

      {/* Summary cards */}
      <section className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-6">
        <SummaryCard
          icon={<IconChartBar size={16} aria-hidden="true" />}
          label="búsquedas"
          value={summary.totalSearches}
        />
        <SummaryCard
          icon={<IconSparkles size={16} aria-hidden="true" />}
          label="únicas"
          value={summary.uniqueQueries}
        />
        <SummaryCard
          icon={<IconSearchOff size={16} aria-hidden="true" />}
          label="sin resultados"
          value={summary.zeroHitSearches}
          accent={summary.zeroHitSearches > 0 ? "tomate" : undefined}
        />
        <SummaryCard
          icon={<IconSearch size={16} aria-hidden="true" />}
          label="fallback fuzzy"
          value={summary.fuzzyFallbackSearches}
          accent={summary.fuzzyFallbackSearches > 0 ? "mostaza" : undefined}
        />
      </section>

      {/* Top queries */}
      <section className="mb-8">
        <h2 className="font-display font-semibold text-base text-carbon mb-2">
          top queries
        </h2>
        <p className="text-[11px] text-bronceado mb-3">
          ordenadas por cantidad. agregadas por versión normalizada (sin tildes
          ni mayúsculas).
        </p>
        <QueryTable rows={popular} emptyHint="sin búsquedas en este rango." />
      </section>

      {/* Zero hits */}
      <section>
        <h2 className="font-display font-semibold text-base text-carbon mb-2">
          sin resultados <span className="text-bronceado font-normal text-xs">(últimos 30 días)</span>
        </h2>
        <p className="text-[11px] text-bronceado mb-3">
          oro para nuevos sinónimos en{" "}
          <code className="font-mono bg-crema-deep px-1 rounded">
            src/lib/search.ts
          </code>{" "}
          o gaps de catálogo.
        </p>
        <QueryTable
          rows={zeroHits}
          emptyHint="ninguna búsqueda quedó vacía. 🍔"
          showAvgResults={false}
        />
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
        const href = o.d === 7 ? "/admin/search" : `/admin/search?dias=${o.d}`;
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
  accent,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  accent?: "tomate" | "mostaza";
}) {
  const accentClass =
    accent === "tomate"
      ? "text-tomate"
      : accent === "mostaza"
        ? "text-mostaza-deep"
        : "text-carbon";
  return (
    <div className="bg-white border border-crema-edge rounded-xl px-3 py-2.5">
      <div className="flex items-center gap-1.5 text-bronceado">
        {icon}
        <span className="text-[10px] uppercase tracking-wider font-medium">
          {label}
        </span>
      </div>
      <div className={`mt-1 font-display font-semibold text-xl ${accentClass}`}>
        {value.toLocaleString("es-CL")}
      </div>
    </div>
  );
}

function QueryTable({
  rows,
  emptyHint,
  showAvgResults = true,
}: {
  rows: SearchLogStat[];
  emptyHint: string;
  showAvgResults?: boolean;
}) {
  if (rows.length === 0) {
    return (
      <div className="text-xs text-tinta-suave bg-crema-deep/60 border border-crema-edge rounded-xl px-3 py-4 text-center">
        {emptyHint}
      </div>
    );
  }

  return (
    <div className="bg-white border border-crema-edge rounded-xl overflow-hidden">
      <div className="grid grid-cols-[1fr_auto_auto] gap-2 px-3 py-2 bg-crema-deep border-b border-crema-edge text-[10px] uppercase tracking-wider text-bronceado font-medium">
        <span>query</span>
        <span className="text-right">veces</span>
        <span className="text-right">{showAvgResults ? "promedio" : "última vez"}</span>
      </div>
      <ul>
        {rows.map((r) => (
          <li
            key={r.normalizedQuery}
            className="grid grid-cols-[1fr_auto_auto] gap-2 px-3 py-2 border-b border-crema-edge last:border-0 items-center"
          >
            <div className="min-w-0">
              <span className="text-sm text-carbon font-medium truncate block">
                {r.sampleQuery}
              </span>
              {r.normalizedQuery !== r.sampleQuery.toLowerCase() && (
                <span className="text-[10px] text-bronceado truncate block font-mono">
                  {r.normalizedQuery}
                </span>
              )}
            </div>
            <span className="text-sm text-carbon text-right tabular-nums">
              {r.count}
              {r.zeroHits > 0 && showAvgResults && (
                <span className="ml-1 text-[10px] text-tomate">
                  · {r.zeroHits} ✗
                </span>
              )}
            </span>
            <span className="text-[11px] text-tinta-suave text-right">
              {showAvgResults
                ? `${r.avgResultCount.toFixed(1)} hits`
                : formatRelative(r.lastSeenAt)}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function formatRelative(d: Date): string {
  const diffMs = Date.now() - d.getTime();
  const diffMin = Math.floor(diffMs / 60_000);
  if (diffMin < 1) return "ahora";
  if (diffMin < 60) return `${diffMin}m`;
  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24) return `${diffH}h`;
  const diffD = Math.floor(diffH / 24);
  return `${diffD}d`;
}
