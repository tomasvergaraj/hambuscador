import { IconClock, IconPercentage } from "@tabler/icons-react";
import Image from "next/image";
import Link from "next/link";

import type { PromotionWithPlace } from "@/server/services/promotions";

const KIND_LABEL: Record<string, string> = {
  percent_discount: "% descuento",
  featured_product: "producto destacado",
  combo: "combo",
};

function formatEndsAt(d: Date | string): string {
  const date = new Date(d);
  const today = new Date();
  const days = Math.ceil(
    (date.getTime() - today.getTime()) / (24 * 60 * 60 * 1000),
  );
  if (days <= 0) return "vence hoy";
  if (days === 1) return "vence mañana";
  if (days <= 14) return `${days} días`;
  return new Intl.DateTimeFormat("es-CL", {
    day: "2-digit",
    month: "short",
  }).format(date);
}

/**
 * Card de promo para el carousel del home + lista de la ficha. Diseño
 * compact tomate con badge del % o tipo. Link a la ficha del local.
 */
export function PromoCard({ promo }: { promo: PromotionWithPlace }) {
  const isDiscount = promo.kind === "percent_discount" && !!promo.discountPct;
  return (
    <Link
      href={`/${promo.comunaSlug}/${promo.placeSlug}`}
      className="block shrink-0 w-[260px] bg-white border border-tomate/30 rounded-xl overflow-hidden transition-[transform,box-shadow] duration-150 active:scale-[0.98] hover:shadow-md"
    >
      <div className="relative h-28 bg-tomate/10 flex items-center justify-center">
        {promo.photoUrl ? (
          <Image
            src={promo.photoUrl}
            alt={promo.title}
            fill
            sizes="260px"
            className="object-cover"
            quality={70}
          />
        ) : (
          <div className="flex items-center justify-center w-full h-full bg-gradient-to-br from-tomate/15 to-mostaza/10">
            {isDiscount ? (
              <span className="font-display font-bold text-4xl text-tomate">
                -{promo.discountPct}%
              </span>
            ) : (
              <IconPercentage size={40} className="text-tomate" />
            )}
          </div>
        )}
        {isDiscount && promo.photoUrl && (
          <span className="absolute top-2 left-2 bg-tomate text-crema-deep font-display font-bold text-sm px-2 py-1 rounded-md">
            -{promo.discountPct}%
          </span>
        )}
        <span className="absolute top-2 right-2 bg-carbon/80 text-crema text-[10px] uppercase tracking-wider font-medium px-1.5 py-0.5 rounded backdrop-blur-sm">
          {KIND_LABEL[promo.kind]}
        </span>
      </div>
      <div className="p-3">
        <h3 className="font-display font-semibold text-sm text-carbon line-clamp-2">
          {promo.title}
        </h3>
        <p className="text-[11px] text-bronceado mt-1 truncate">
          {promo.placeName} · {promo.comunaLabel}
        </p>
        <p className="text-[10px] text-tomate font-medium mt-1 inline-flex items-center gap-0.5">
          <IconClock size={10} />
          {formatEndsAt(promo.endsAt)}
        </p>
      </div>
    </Link>
  );
}
