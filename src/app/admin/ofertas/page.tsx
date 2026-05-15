import {
  IconCheck,
  IconClock,
  IconExternalLink,
  IconPencil,
  IconPercentage,
  IconPlus,
  IconStarFilled,
} from "@tabler/icons-react";
import Image from "next/image";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { listPromotionsForAdmin } from "@/server/services/promotions";

import { approvePromotionAction } from "./actions";
import { RejectPromoForm } from "./reject-promo-form";

export const metadata = { title: "admin · ofertas" };
export const dynamic = "force-dynamic";

function formatDate(d: Date | string): string {
  return new Intl.DateTimeFormat("es-CL", {
    day: "2-digit",
    month: "short",
  }).format(new Date(d));
}

function formatEndsCountdown(d: Date | string): string {
  const date = new Date(d);
  const now = Date.now();
  const days = Math.ceil((date.getTime() - now) / (24 * 60 * 60 * 1000));
  if (days <= 0) return "vence hoy";
  if (days === 1) return "vence mañana";
  if (days <= 14) return `${days} días`;
  return formatDate(date);
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

  // Pending: owner-created esperando moderación. Mostradas arriba de todo
  // pa que no se acumulen sin atender. Filter por ends_at > now (no tiene
  // sentido aprobar algo ya vencido).
  const pending = promos.filter(
    (p) =>
      p.moderationStatus === "pending" && new Date(p.endsAt).getTime() > now,
  );
  const active = promos.filter(
    (p) =>
      p.isActive &&
      p.moderationStatus === "approved" &&
      new Date(p.endsAt).getTime() > now,
  );
  const past = promos.filter(
    (p) => !pending.includes(p) && !active.includes(p),
  );

  return (
    <main className="px-4 py-5 flex-1 max-w-3xl mx-auto w-full">
      <header className="flex items-baseline justify-between mb-4 gap-3">
        <div>
          <h1 className="font-display font-semibold text-xl text-carbon">
            ofertas
          </h1>
          <p className="text-xs text-tinta-suave mt-0.5">
            {pending.length > 0 && (
              <span className="text-mostaza-deep font-medium">
                {pending.length} pendiente{pending.length === 1 ? "" : "s"} ·{" "}
              </span>
            )}
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

      {pending.length > 0 && (
        <section className="mb-6">
          <h2 className="text-[11px] uppercase tracking-widest text-mostaza-deep font-medium mb-2">
            pendientes ({pending.length})
          </h2>
          <ul className="flex flex-col gap-3">
            {pending.map((p) => {
              const Icon = KIND_ICON[p.kind] ?? IconStarFilled;
              const isDiscount =
                p.kind === "percent_discount" && !!p.discountPct;
              return (
                <li
                  key={p.id}
                  className="bg-mostaza/5 border border-mostaza/40 rounded-xl overflow-hidden flex flex-col"
                >
                  {/* Hero preview — replica del look público (PromoCard) pa que
                      el admin vea exactamente lo que el usuario va a ver. */}
                  <div className="relative h-32 bg-tomate/10 flex items-center justify-center">
                    {p.photoUrl ? (
                      <Image
                        src={p.photoUrl}
                        alt={p.title}
                        fill
                        sizes="(max-width: 768px) 100vw, 768px"
                        className="object-cover"
                        quality={70}
                      />
                    ) : (
                      <div className="flex items-center justify-center w-full h-full bg-gradient-to-br from-tomate/15 to-mostaza/10">
                        {isDiscount ? (
                          <span className="font-display font-bold text-5xl text-tomate">
                            -{p.discountPct}%
                          </span>
                        ) : (
                          <IconPercentage size={48} className="text-tomate" />
                        )}
                      </div>
                    )}
                    {isDiscount && p.photoUrl && (
                      <span className="absolute top-2 left-2 bg-tomate text-crema-deep font-display font-bold text-sm px-2 py-1 rounded-md">
                        -{p.discountPct}%
                      </span>
                    )}
                    <span className="absolute top-2 right-2 bg-carbon/80 text-crema text-[10px] uppercase tracking-wider font-medium px-1.5 py-0.5 rounded backdrop-blur-sm">
                      {KIND_LABEL[p.kind]}
                    </span>
                    <span className="absolute bottom-2 right-2 bg-carbon/80 text-crema text-[10px] font-medium px-1.5 py-0.5 rounded backdrop-blur-sm inline-flex items-center gap-0.5">
                      <IconClock size={10} />
                      {formatEndsCountdown(p.endsAt)}
                    </span>
                  </div>

                  <div className="p-3 flex flex-col gap-3">
                    <div className="flex items-start gap-3">
                      <div className="w-9 h-9 shrink-0 rounded-md bg-mostaza/20 text-mostaza-deep flex items-center justify-center">
                        <Icon size={14} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <h3 className="font-display font-semibold text-sm text-carbon">
                          {p.title}
                        </h3>
                        <p className="text-[11px] text-bronceado mt-0.5">
                          {p.placeName} · {p.comunaLabel} · hasta{" "}
                          {formatDate(p.endsAt)}
                        </p>
                        {p.description && (
                          <p className="text-[11px] text-carbon mt-1 leading-relaxed line-clamp-3">
                            {p.description}
                          </p>
                        )}
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
                    </div>
                    <div className="flex gap-2 items-stretch">
                      <div className="flex-1">
                        <RejectPromoForm promoId={p.id} />
                      </div>
                      <form
                        action={approvePromotionAction}
                        className="flex-[2]"
                      >
                        <input type="hidden" name="promoId" value={p.id} />
                        <Button
                          variant="primary"
                          size="sm"
                          fullWidth
                          type="submit"
                        >
                          <IconCheck size={13} aria-hidden="true" /> aprobar
                        </Button>
                      </form>
                      <Link
                        href={`/admin/ofertas/${p.id}`}
                        aria-label="editar"
                        className="w-9 inline-flex items-center justify-center rounded-md text-bronceado hover:bg-mostaza/15 hover:text-carbon transition-colors"
                      >
                        <IconPencil size={14} />
                      </Link>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      )}

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
              const isDiscount =
                p.kind === "percent_discount" && !!p.discountPct;
              return (
                <li key={p.id} className="relative">
                  {/* Stretched-link pattern pa que el thumb + meta sean
                      clickeables al editor, sin anidar <a><a> con el link
                      "ver ficha" de la derecha. */}
                  <div className="bg-white border border-crema-edge rounded-xl p-2 flex items-center gap-3 hover:border-mostaza transition-colors">
                    <div className="w-14 h-14 shrink-0 rounded-md overflow-hidden relative bg-tomate/10">
                      {p.photoUrl ? (
                        <Image
                          src={p.photoUrl}
                          alt=""
                          fill
                          sizes="56px"
                          className="object-cover"
                          quality={60}
                        />
                      ) : isDiscount ? (
                        <span className="absolute inset-0 flex items-center justify-center font-display font-bold text-sm text-tomate">
                          -{p.discountPct}%
                        </span>
                      ) : (
                        <Icon
                          size={18}
                          className="absolute inset-0 m-auto text-tomate"
                        />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <Link
                        href={`/admin/ofertas/${p.id}`}
                        className="font-display font-semibold text-sm text-carbon truncate block before:absolute before:inset-0 before:content-[''] before:rounded-xl"
                      >
                        {p.title}
                      </Link>
                      <p className="text-[11px] text-bronceado truncate">
                        {p.placeName} · {p.comunaLabel} ·{" "}
                        {isDiscount
                          ? `${p.discountPct}%`
                          : KIND_LABEL[p.kind]}{" "}
                        · {formatEndsCountdown(p.endsAt)}
                      </p>
                    </div>
                    <Link
                      href={`/${p.comunaSlug}/${p.placeSlug}`}
                      target="_blank"
                      rel="noopener"
                      aria-label="ver ficha"
                      className="text-bronceado hover:text-carbon shrink-0 relative z-10"
                    >
                      <IconExternalLink size={14} />
                    </Link>
                  </div>
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

