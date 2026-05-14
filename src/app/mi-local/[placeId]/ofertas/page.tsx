import {
  IconCircleCheck,
  IconClock,
  IconPercentage,
  IconPlus,
} from "@tabler/icons-react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { Header } from "@/components/nav/header";
import { auth } from "@/server/auth";
import { isOwnerOf } from "@/server/services/claims";
import { getPlaceByIdForAdmin } from "@/server/services/places";
import { getPromotionsForPlaceAdmin } from "@/server/services/promotions";
import { hasActiveTier } from "@/server/services/subscriptions";

export const metadata = { title: "mis ofertas" };
export const dynamic = "force-dynamic";

type Params = { placeId: string };

function formatDate(d: Date | string): string {
  return new Intl.DateTimeFormat("es-CL", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(d));
}

const KIND_LABEL: Record<string, string> = {
  percent_discount: "% descuento",
  featured_product: "producto",
  combo: "combo",
};

const STATUS_PILL: Record<string, string> = {
  approved: "bg-lechuga/15 text-lechuga",
  pending: "bg-mostaza/15 text-mostaza-deep",
  rejected: "bg-tomate/15 text-tomate",
};

export default async function MiLocalOfertasPage({
  params,
}: {
  params: Promise<Params>;
}) {
  const { placeId } = await params;
  const session = await auth();
  if (!session?.user?.id) {
    redirect(`/iniciar-sesion?next=/mi-local/${placeId}/ofertas`);
  }
  const isAdmin = session.user.role === "admin";
  const isOwner = await isOwnerOf(session.user.id, placeId);
  if (!isAdmin && !isOwner) redirect("/");

  const place = await getPlaceByIdForAdmin(placeId);
  if (!place) notFound();

  const [hasPromo, hasPremium, promos] = await Promise.all([
    hasActiveTier(placeId, "promo"),
    hasActiveTier(placeId, "premium"),
    getPromotionsForPlaceAdmin(placeId),
  ]);
  const canCreate = hasPromo || hasPremium;

  return (
    <div className="flex flex-col min-h-screen pb-12">
      <Header title="mis ofertas" backHref={`/${place.comuna}/${place.slug}`} />

      <main className="px-4 py-5 flex-1 max-w-2xl mx-auto w-full">
        <header className="mb-4">
          <h1 className="font-display font-semibold text-xl text-carbon truncate">
            {place.name}
          </h1>
          <p className="text-[11px] text-bronceado mt-0.5">
            {place.comunaLabel} · {place.region}
          </p>
        </header>

        {!canCreate ? (
          <div className="bg-mostaza/10 border border-mostaza/40 rounded-xl p-5">
            <h2 className="font-display font-semibold text-base text-carbon">
              activa publicidad de ofertas
            </h2>
            <p className="text-sm text-tinta-suave mt-2 leading-relaxed">
              para publicar promociones (descuentos, productos destacados,
              combos) necesitas tier <code>promo</code> o <code>premium</code>.
              Contacta a{" "}
              <a
                href="mailto:contacto@nexosoftware.cl"
                className="text-mostaza-deep font-medium underline"
              >
                contacto@nexosoftware.cl
              </a>
              .
            </p>
          </div>
        ) : (
          <Link
            href={`/mi-local/${placeId}/ofertas/nueva`}
            className="inline-flex items-center gap-1.5 bg-mostaza text-carbon font-medium text-sm px-3 py-2 rounded-md hover:bg-mostaza-deep transition-colors mb-4"
          >
            <IconPlus size={16} aria-hidden="true" />
            nueva oferta
          </Link>
        )}

        {promos.length === 0 ? (
          <div className="bg-crema-deep border border-crema-edge rounded-xl p-6 text-center mt-4">
            <p className="text-sm text-tinta-suave">
              sin ofertas todavía.
            </p>
          </div>
        ) : (
          <ul className="flex flex-col gap-2">
            {promos.map((p) => {
              const expired = new Date(p.endsAt).getTime() < Date.now();
              return (
                <li
                  key={p.id}
                  className="bg-white border border-crema-edge rounded-xl p-3"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <h3 className="font-display font-semibold text-sm text-carbon">
                        {p.title}
                      </h3>
                      <p className="text-[11px] text-bronceado mt-0.5 flex items-center gap-2 flex-wrap">
                        <span className="inline-flex items-center gap-1">
                          {p.kind === "percent_discount" ? (
                            <IconPercentage size={11} />
                          ) : null}
                          {p.kind === "percent_discount" && p.discountPct
                            ? `${p.discountPct}%`
                            : KIND_LABEL[p.kind]}
                        </span>
                        <span>·</span>
                        <span className="inline-flex items-center gap-1">
                          <IconClock size={11} />
                          hasta {formatDate(p.endsAt)}
                        </span>
                      </p>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <span
                        className={
                          "text-[10px] uppercase tracking-widest font-medium px-1.5 py-0.5 rounded " +
                          (STATUS_PILL[p.moderationStatus] ?? "bg-crema-edge")
                        }
                      >
                        {p.moderationStatus === "approved" ? (
                          <span className="inline-flex items-center gap-0.5">
                            <IconCircleCheck size={10} /> aprobada
                          </span>
                        ) : (
                          p.moderationStatus
                        )}
                      </span>
                      {expired && (
                        <span className="text-[10px] uppercase tracking-widest font-medium bg-bronceado/15 text-bronceado px-1.5 py-0.5 rounded">
                          expirada
                        </span>
                      )}
                      {!p.isActive && (
                        <span className="text-[10px] uppercase tracking-widest font-medium bg-bronceado/15 text-bronceado px-1.5 py-0.5 rounded">
                          inactiva
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-2 mt-2">
                    <Link
                      href={`/mi-local/${placeId}/ofertas/${p.id}/editar`}
                      className="text-xs text-mostaza-deep hover:text-carbon font-medium"
                    >
                      editar →
                    </Link>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </main>
    </div>
  );
}
