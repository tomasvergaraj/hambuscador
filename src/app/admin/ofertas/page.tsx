import {
  IconExternalLink,
  IconPercentage,
  IconPlus,
  IconStarFilled,
} from "@tabler/icons-react";
import Link from "next/link";

import { listPromotionsForAdmin } from "@/server/services/promotions";

export const metadata = { title: "admin · ofertas" };
export const dynamic = "force-dynamic";

function formatDate(d: Date | string): string {
  return new Intl.DateTimeFormat("es-CL", {
    day: "2-digit",
    month: "short",
  }).format(new Date(d));
}

const KIND_ICON = {
  percent_discount: IconPercentage,
  featured_product: IconStarFilled,
  combo: IconStarFilled,
};

const KIND_LABEL: Record<string, string> = {
  percent_discount: "% descuento",
  featured_product: "producto",
  combo: "combo",
};

export default async function AdminOfertasPage() {
  const promos = await listPromotionsForAdmin({ limit: 200 });
  const now = Date.now();
  const active = promos.filter(
    (p) =>
      p.isActive &&
      p.moderationStatus === "approved" &&
      new Date(p.endsAt).getTime() > now,
  );
  const past = promos.filter((p) => !active.includes(p));

  return (
    <main className="px-4 py-5 flex-1 max-w-3xl mx-auto w-full">
      <header className="flex items-baseline justify-between mb-4 gap-3">
        <div>
          <h1 className="font-display font-semibold text-xl text-carbon">
            ofertas
          </h1>
          <p className="text-xs text-tinta-suave mt-0.5">
            {active.length} activa{active.length === 1 ? "" : "s"} · {promos.length} total
          </p>
        </div>
        <Link
          href="/admin/ofertas/nueva"
          className="inline-flex items-center gap-1.5 bg-mostaza text-carbon font-medium text-sm px-3 py-2 rounded-md hover:bg-mostaza-deep transition-colors"
        >
          <IconPlus size={16} aria-hidden="true" />
          nueva
        </Link>
      </header>

      <section className="mb-6">
        <h2 className="text-[11px] uppercase tracking-widest text-bronceado font-medium mb-2">
          activas
        </h2>
        {active.length === 0 ? (
          <div className="bg-crema-deep border border-crema-edge rounded-xl p-6 text-center">
            <p className="text-sm text-tinta-suave">sin ofertas activas.</p>
          </div>
        ) : (
          <ul className="flex flex-col gap-2">
            {active.map((p) => {
              const Icon = KIND_ICON[p.kind] ?? IconStarFilled;
              return (
                <li key={p.id}>
                  <Link
                    href={`/admin/ofertas/${p.id}`}
                    className="bg-white border border-crema-edge rounded-xl p-3 flex items-center gap-3 hover:border-mostaza transition-colors"
                  >
                    <div className="w-10 h-10 shrink-0 rounded-md bg-tomate/15 text-tomate flex items-center justify-center">
                      <Icon size={16} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <h3 className="font-display font-semibold text-sm text-carbon truncate">
                        {p.title}
                      </h3>
                      <p className="text-[11px] text-bronceado truncate">
                        {p.placeName} · {p.comunaLabel} ·{" "}
                        {p.kind === "percent_discount" && p.discountPct
                          ? `${p.discountPct}%`
                          : KIND_LABEL[p.kind]}{" "}
                        · hasta {formatDate(p.endsAt)}
                      </p>
                    </div>
                    <Link
                      href={`/${p.comunaSlug}/${p.placeSlug}`}
                      target="_blank"
                      rel="noopener"
                      aria-label="ver ficha"
                      className="text-bronceado hover:text-carbon shrink-0"
                    >
                      <IconExternalLink size={14} />
                    </Link>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {past.length > 0 && (
        <section>
          <h2 className="text-[11px] uppercase tracking-widest text-bronceado font-medium mb-2">
            histórico ({past.length})
          </h2>
          <ul className="flex flex-col gap-1.5">
            {past.map((p) => {
              const isExpired = new Date(p.endsAt).getTime() <= now;
              return (
                <li
                  key={p.id}
                  className="bg-crema-deep border border-crema-edge rounded-md px-3 py-2 flex items-center gap-2 text-xs"
                >
                  <span className="text-[10px] uppercase tracking-widest font-medium bg-bronceado/15 text-bronceado px-1.5 py-0.5 rounded shrink-0">
                    {!p.isActive
                      ? "inactiva"
                      : p.moderationStatus !== "approved"
                        ? p.moderationStatus
                        : isExpired
                          ? "expirada"
                          : "?"}
                  </span>
                  <Link
                    href={`/admin/ofertas/${p.id}`}
                    className="font-medium text-carbon hover:underline truncate flex-1"
                  >
                    {p.title}
                  </Link>
                  <span className="text-bronceado shrink-0">{p.placeName}</span>
                </li>
              );
            })}
          </ul>
        </section>
      )}
    </main>
  );
}

