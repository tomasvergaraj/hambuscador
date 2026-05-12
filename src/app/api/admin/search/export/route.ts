import type { NextRequest } from "next/server";

import { auth } from "@/server/auth";
import {
  getPopularQueries,
  getZeroHitQueries,
} from "@/server/services/search-logs";

const VALID_DAYS = new Set([1, 7, 30, 90]);
const VALID_TYPES = new Set(["popular", "zerohits"]);

/**
 * Export CSV de los reportes de /admin/search. Pensado pa que admin baje el
 * data y trabaje sinónimos offline en un spreadsheet. Auth-guarded — mismo
 * criterio que el layout /admin/*.
 *
 * GET /api/admin/search/export?type=popular|zerohits&days=1|7|30|90
 */
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return new Response("unauthorized", { status: 401 });
  }
  if (session.user.role !== "admin") {
    return new Response("forbidden", { status: 403 });
  }

  const url = new URL(req.url);
  const type = url.searchParams.get("type") ?? "popular";
  const requestedDays = Number(url.searchParams.get("days") ?? 30);
  const days = VALID_DAYS.has(requestedDays) ? requestedDays : 30;

  if (!VALID_TYPES.has(type)) {
    return new Response("bad type", { status: 400 });
  }

  const rows =
    type === "zerohits"
      ? await getZeroHitQueries({ days, limit: 1000 })
      : await getPopularQueries({ days, limit: 1000 });

  const header = [
    "query_normalizada",
    "muestra_original",
    "veces",
    "promedio_resultados",
    "veces_sin_resultado",
    "ultima_vez",
  ];

  const lines = [
    header.join(","),
    ...rows.map((r) =>
      [
        csvCell(r.normalizedQuery),
        csvCell(r.sampleQuery),
        r.count,
        r.avgResultCount.toFixed(2),
        r.zeroHits,
        r.lastSeenAt.toISOString(),
      ].join(","),
    ),
  ];

  const body = lines.join("\n") + "\n";
  const filename = `hambuscador-search-${type}-${days}d-${new Date()
    .toISOString()
    .slice(0, 10)}.csv`;

  return new Response(body, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}

function csvCell(value: string | number): string {
  const s = String(value);
  if (s.includes(",") || s.includes('"') || s.includes("\n") || s.includes("\r")) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}
