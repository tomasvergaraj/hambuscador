import { IconExternalLink, IconPlus, IconX } from "@tabler/icons-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { listSubscriptionsForAdmin } from "@/server/services/subscriptions";

import { cancelSubscriptionAction } from "./actions";

export const metadata = { title: "admin · promociones" };
export const dynamic = "force-dynamic";

function formatClp(n: number): string {
  return `$${n.toLocaleString("es-CL")}`;
}

function formatDate(d: Date | string | null): string {
  if (!d) return "—";
  return new Intl.DateTimeFormat("es-CL", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(d));
}

function daysUntil(end: Date | string): number {
  const ms = new Date(end).getTime() - Date.now();
  return Math.ceil(ms / (24 * 60 * 60 * 1000));
}

export default async function AdminPromocionesPage() {
  const subs = await listSubscriptionsForAdmin({ limit: 200 });
  const active = subs.filter((s) => s.status === "active");
  const past = subs.filter((s) => s.status !== "active");

  const totalActiveClp = active.reduce((acc, s) => acc + s.amountClp, 0);

  return (
    <main className="px-4 py-5 flex-1 max-w-3xl mx-auto w-full">
      <header className="flex items-baseline justify-between mb-4 gap-3">
        <div>
          <h1 className="font-display font-semibold text-xl text-carbon">
            promociones
          </h1>
          <p className="text-xs text-tinta-suave mt-0.5">
            {active.length} activa{active.length === 1 ? "" : "s"} · MRR{" "}
            {formatClp(totalActiveClp)}
          </p>
        </div>
        <Link
          href="/admin/promociones/nueva"
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
            <p className="text-sm text-tinta-suave">
              sin promociones activas. crea una para destacar un local.
            </p>
          </div>
        ) : (
          <ul className="flex flex-col gap-2">
            {active.map((sub) => {
              const daysLeft = daysUntil(sub.currentPeriodEnd);
              const isExpiringSoon = daysLeft <= 7;
              return (
                <li
                  key={sub.id}
                  className="bg-white border border-crema-edge rounded-xl p-3 flex items-center gap-3"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      {sub.targetType === "place" && sub.placeSlug && sub.comunaSlug ? (
                        <Link
                          href={`/${sub.comunaSlug}/${sub.placeSlug}`}
                          target="_blank"
                          rel="noopener"
                          className="font-display font-semibold text-sm text-carbon hover:text-mostaza-deep truncate inline-flex items-center gap-1"
                        >
                          {sub.targetLabel}
                          <IconExternalLink
                            size={12}
                            className="text-bronceado shrink-0"
                            aria-hidden="true"
                          />
                        </Link>
                      ) : (
                        <Link
                          href={`/admin/brands/${sub.brandId}`}
                          className="font-display font-semibold text-sm text-carbon hover:text-mostaza-deep truncate inline-flex items-center gap-1"
                        >
                          <span className="text-[10px] uppercase tracking-widest font-medium bg-mostaza/15 text-mostaza-deep px-1 py-0.5 rounded mr-1">
                            cadena
                          </span>
                          {sub.targetLabel}
                        </Link>
                      )}
                    </div>
                    <p className="text-[11px] text-bronceado">
                      {sub.targetType === "place" ? sub.comunaLabel : "todos los locales"} ·{" "}
                      {sub.tier} · {formatClp(sub.amountClp)}
                    </p>
                    <p
                      className={
                        "text-[11px] mt-0.5 " +
                        (isExpiringSoon
                          ? "text-tomate font-medium"
                          : "text-tinta-suave")
                      }
                    >
                      hasta {formatDate(sub.currentPeriodEnd)}
                      {daysLeft > 0
                        ? ` · ${daysLeft} día${daysLeft === 1 ? "" : "s"}`
                        : " · vence hoy"}
                    </p>
                    {sub.notes && (
                      <p className="text-[11px] text-tinta-suave mt-1 italic truncate">
                        {sub.notes}
                      </p>
                    )}
                  </div>
                  <form action={cancelSubscriptionAction}>
                    <input type="hidden" name="subscriptionId" value={sub.id} />
                    <Button variant="ghost" size="sm" type="submit">
                      <IconX size={14} aria-hidden="true" /> cancelar
                    </Button>
                  </form>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {past.length > 0 && (
        <section>
          <h2 className="text-[11px] uppercase tracking-widest text-bronceado font-medium mb-2">
            histórico
          </h2>
          <ul className="flex flex-col gap-1.5">
            {past.map((sub) => (
              <li
                key={sub.id}
                className="bg-crema-deep border border-crema-edge rounded-md px-3 py-2 flex items-center gap-3 text-xs"
              >
                <span
                  className={
                    "text-[10px] uppercase tracking-widest font-medium px-1.5 py-0.5 rounded shrink-0 " +
                    (sub.status === "expired"
                      ? "bg-bronceado/15 text-bronceado"
                      : "bg-tomate/15 text-tomate")
                  }
                >
                  {sub.status}
                </span>
                {sub.targetType === "place" && sub.placeSlug && sub.comunaSlug ? (
                  <Link
                    href={`/${sub.comunaSlug}/${sub.placeSlug}`}
                    target="_blank"
                    rel="noopener"
                    className="font-medium text-carbon hover:underline truncate flex-1"
                  >
                    {sub.targetLabel}
                  </Link>
                ) : (
                  <Link
                    href={`/admin/brands/${sub.brandId}`}
                    className="font-medium text-carbon hover:underline truncate flex-1"
                  >
                    <span className="text-[10px] uppercase tracking-widest font-medium bg-mostaza/15 text-mostaza-deep px-1 py-0.5 rounded mr-1">
                      cadena
                    </span>
                    {sub.targetLabel}
                  </Link>
                )}
                <span className="text-bronceado shrink-0">
                  {formatClp(sub.amountClp)} · {formatDate(sub.currentPeriodEnd)}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </main>
  );
}
