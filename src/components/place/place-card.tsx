import Link from "next/link";
import Image from "next/image";
import { IconPhoto, IconRosetteDiscountCheckFilled, IconSparkles } from "@tabler/icons-react";
import type { Place } from "@/types/place";
import { RatingPill } from "@/components/ui/rating-pill";
import { StatusPill } from "@/components/ui/status-pill";
import { cn, formatDistance, formatReviewCount } from "@/lib/utils";

const priceLabels: Record<string, string> = {
  $: "$",
  $$: "$$",
  $$$: "$$$",
  $$$$: "$$$$",
};

export type PlaceCardProps = {
  place: Place;
  variant?: "compact" | "featured";
  className?: string;
};

/**
 * Card de hamburguesería. Dos variantes:
 * - compact: lista horizontal, foto cuadrada a la izquierda
 * - featured: card grande con hero arriba, para destacados/trending
 */
export function PlaceCard({ place, variant = "compact", className }: PlaceCardProps) {
  const href = `/${place.comuna}/${place.slug}` as const;
  const distance = place.distanceM !== undefined ? formatDistance(place.distanceM) : null;
  const cuisineLabel = place.cuisines[0];
  const priceLabel = priceLabels[place.priceRange];
  const heroPhoto = place.photos[0];
  // Thumb chico (78×78 en compact): preferimos logo cuando existe — un
  // crop de foto de comida queda raro a ese tamaño, un logo cuadrado sí.
  // El hero del featured card (128px) sigue con foto: ahí la cover apetitosa
  // funciona mejor que un logo lavado.
  const compactThumb = place.logo ?? heroPhoto;

  if (variant === "featured") {
    return (
      <Link
        href={href}
        className={cn(
          "block bg-white rounded-2xl border border-crema-edge overflow-hidden",
          "hover:border-mostaza transition-[transform,colors,box-shadow] duration-150 active:scale-[0.97] hover:shadow-md",
          className,
        )}
      >
        <div className="relative h-32 flex items-center justify-center bg-mostaza-deep">
          {heroPhoto ? (
            <Image
              src={heroPhoto}
              alt={place.name}
              fill
              className="object-cover"
              sizes="(max-width: 768px) 100vw, 380px"
            />
          ) : (
            <IconPhoto
              size={32}
              stroke={1.5}
              className="text-crema-deep opacity-60"
              aria-hidden="true"
            />
          )}
          <StatusPill status={place.status} className="absolute top-2.5 left-2.5" />
          {place.isFeatured ? (
            <span
              className="absolute top-2.5 right-2.5 inline-flex items-center gap-1 bg-tomate text-crema-deep px-2 py-0.5 rounded-md text-[10px] font-medium uppercase tracking-wider"
              title="local destacado por publicidad"
            >
              <IconSparkles size={11} aria-hidden="true" />
              destacado
            </span>
          ) : distance ? (
            <span className="absolute top-2.5 right-2.5 bg-carbon/70 text-white px-2 py-1 rounded-md text-[11px]">
              {distance}
            </span>
          ) : null}
        </div>
        <div className="p-3.5">
          <h3 className="font-display font-semibold text-carbon inline-flex items-center gap-1">
            {place.name}
            {place.isVerified && (
              <IconRosetteDiscountCheckFilled
                size={16}
                className="text-mostaza shrink-0"
                aria-label="local verificado"
              />
            )}
          </h3>
          <p className="text-xs text-tinta-suave mt-0.5">
            {cuisineLabel} · {place.comunaLabel} · {priceLabel}
          </p>
          <div className="flex items-center gap-2 mt-2 text-xs">
            <RatingPill rating={place.rating} size="sm" />
            <span className="text-bronceado">· {formatReviewCount(place.reviewCount)}</span>
            {place.isFeatured && distance ? (
              <span className="text-bronceado">· {distance}</span>
            ) : null}
          </div>
        </div>
      </Link>
    );
  }

  // Compact horizontal variant
  return (
    <Link
      href={href}
      className={cn(
        "flex bg-white rounded-xl border border-crema-edge overflow-hidden",
        "hover:border-mostaza transition-[transform,colors,box-shadow] duration-150 active:scale-[0.97] hover:shadow-md",
        className,
      )}
    >
      <div className="w-[78px] h-[78px] shrink-0 flex items-center justify-center relative bg-mostaza-deep">
        {compactThumb ? (
          <Image
            src={compactThumb}
            alt={place.name}
            fill
            className="object-cover"
            sizes="78px"
          />
        ) : (
          <IconPhoto
            size={20}
            stroke={1.5}
            className="text-crema-deep opacity-60"
            aria-hidden="true"
          />
        )}
      </div>
      <div className="flex-1 min-w-0 px-3 py-2.5">
        <div className="flex items-center justify-between gap-2">
          <h3 className="font-display font-semibold text-sm text-carbon truncate inline-flex items-center gap-1 min-w-0">
            <span className="truncate">{place.name}</span>
            {place.isVerified && (
              <IconRosetteDiscountCheckFilled
                size={14}
                className="text-mostaza shrink-0"
                aria-label="local verificado"
              />
            )}
            {place.isFeatured && (
              <IconSparkles
                size={14}
                className="text-tomate shrink-0"
                aria-label="local destacado por publicidad"
              />
            )}
          </h3>
          <StatusPill status={place.status} className="shrink-0" />
        </div>
        <p className="text-[11px] text-tinta-suave mt-0.5 truncate">
          {cuisineLabel} · {place.comunaLabel} · {priceLabel}
        </p>
        <div className="flex items-center gap-1.5 mt-1.5 text-[11px]">
          <span className="text-carbon font-medium">★ {place.rating.toFixed(1)}</span>
          <span className="text-bronceado">· {formatReviewCount(place.reviewCount)}</span>
          {distance ? <span className="text-bronceado">· {distance}</span> : null}
        </div>
      </div>
    </Link>
  );
}
