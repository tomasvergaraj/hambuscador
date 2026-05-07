import { IconArrowLeft, IconBrandInstagram, IconCash, IconClock, IconFlame, IconMapPin, IconPencil, IconPhone, IconPhoto, IconTrash, IconHeart } from "@tabler/icons-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { Header } from "@/components/nav/header";
import { Button } from "@/components/ui/button";
import { RatingPill } from "@/components/ui/rating-pill";
import { StatusPill } from "@/components/ui/status-pill";
import { getPlaceBySlug, getReviewsByPlaceId } from "@/lib/data";
import { DAY_FULL_LABEL, DAY_KEYS, PRICE_RANGES, type DayKey } from "@/lib/constants";
import { ShareButton } from "@/components/place/share-button";
import { auth } from "@/server/auth";
import { isFavorite } from "@/server/services/favorites";
import { getMyReviewForPlace } from "@/server/services/reviews";

import { deleteMyReview } from "./calificar/actions";
import { toggleFavoriteAction } from "./favorite-action";

const priceDescription = new Map(PRICE_RANGES.map((p) => [p.id, p.description]));

type Params = { comuna: string; slug: string };

// ============================================================================
// Metadata por local — fuente de los <title> y <meta description> que
// Google indexa. La SEO real del producto vive acá.
// ============================================================================

export async function generateMetadata({
  params,
}: {
  params: Promise<Params>;
}): Promise<Metadata> {
  const { comuna, slug } = await params;
  const place = await getPlaceBySlug(comuna, slug);
  if (!place) return { title: "no encontrado" };

  const description = `${place.name} en ${place.comunaLabel}. ${place.cuisines.join(", ")}. ${place.rating.toFixed(1)} ★ con ${place.reviewCount} reseñas.`;

  return {
    title: `${place.name} en ${place.comunaLabel}`,
    description,
    openGraph: {
      title: `${place.name} — Hambuscador`,
      description,
      // og:image se genera automáticamente desde opengraph-image.tsx
      // (Next.js convención). No declarar `images` acá para no pisarla.
    },
    alternates: {
      canonical: `/${place.comuna}/${place.slug}`,
    },
  };
}

// ============================================================================
// Página
// ============================================================================

export default async function PlaceDetailPage({ params }: { params: Promise<Params> }) {
  const { comuna, slug } = await params;
  const place = await getPlaceBySlug(comuna, slug);
  if (!place) notFound();

  const [reviews, session] = await Promise.all([getReviewsByPlaceId(place.id), auth()]);
  const userId = session?.user?.id ?? null;
  const isAdmin = session?.user?.role === "admin";
  const [myReview, favorited] = await Promise.all([
    userId ? getMyReviewForPlace(place.id, userId) : Promise.resolve(null),
    userId ? isFavorite(userId, place.id) : Promise.resolve(false),
  ]);
  const mine = myReview ? (reviews.find((r) => r.id === myReview.id) ?? null) : null;
  const others = mine ? reviews.filter((r) => r.id !== mine.id) : reviews;

  // JSON-LD Restaurant — Google usa esto para rich results (rating, dirección,
  // horario, fotos en SERP). Ver https://schema.org/Restaurant
  const jsonLd = buildRestaurantJsonLd(place);

  return (
    <div className="flex flex-col min-h-screen pb-24">
      <script
        type="application/ld+json"
        // Renderizamos el JSON ya stringificado — RSC, sin XSS porque el
        // contenido viene de la DB controlada por nosotros.
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      {/* Hero image (placeholder hasta Fase 2) */}
      <div className="relative h-52 bg-mostaza-deep flex items-center justify-center">
        <IconPhoto size={42} className="text-crema-deep/50" aria-hidden="true" />

        {/* Overlay nav */}
        <div className="absolute top-4 left-4 right-4 flex items-center justify-between">
          <Link
            href="/buscar"
            aria-label="atrás"
            className="flex items-center justify-center w-9 h-9 rounded-full bg-crema-deep/90 backdrop-blur-sm text-carbon hover:bg-crema-deep transition-[transform,colors] duration-150 active:scale-90"
          >
            <IconArrowLeft size={18} aria-hidden="true" />
          </Link>
          <div className="flex gap-2">
            {isAdmin && (
              <Link
                href={`/admin/places/${place.id}/edit`}
                aria-label="editar (admin)"
                title="editar (admin)"
                className="flex items-center justify-center w-9 h-9 rounded-full bg-carbon text-mostaza hover:bg-carbon-soft transition-[transform,colors] duration-150 active:scale-90"
              >
                <IconPencil size={18} aria-hidden="true" />
              </Link>
            )}
            <ShareButton
              path={`/${place.comuna}/${place.slug}`}
              title={place.name}
              text={`${place.name} en ${place.comunaLabel} · Hambuscador`}
            />
            <form action={toggleFavoriteAction}>
              <input type="hidden" name="placeId" value={place.id} />
              <input type="hidden" name="comuna" value={place.comuna} />
              <input type="hidden" name="slug" value={place.slug} />
              <button
                type="submit"
                aria-label={favorited ? "quitar de favoritos" : "agregar a favoritos"}
                aria-pressed={favorited}
                className="flex items-center justify-center w-9 h-9 rounded-full bg-crema-deep/90 backdrop-blur-sm text-tomate hover:bg-crema-deep transition-[transform,colors] duration-150 active:scale-90"
              >
                <IconHeart
                  size={18}
                  aria-hidden="true"
                  fill={favorited ? "currentColor" : "none"}
                />
              </button>
            </form>
          </div>
        </div>

        {/* Photo dots indicator */}
        <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-crema-deep" />
          <span className="w-1.5 h-1.5 rounded-full bg-crema-deep/50" />
          <span className="w-1.5 h-1.5 rounded-full bg-crema-deep/50" />
        </div>
      </div>

      {/* Main content */}
      <main className="px-4 pt-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <h1 className="font-display font-semibold text-2xl text-carbon tracking-tight leading-tight">
              {place.name}
            </h1>
            <p className="text-xs text-tinta-suave mt-1">
              {place.cuisines.join(" · ")} · {place.comunaLabel}
            </p>
          </div>
          <StatusPill status={place.status} />
        </div>

        {/* Rating */}
        <div className="flex items-center gap-2 mt-3">
          <RatingPill rating={place.rating} size="md" />
          <span className="text-xs text-tinta-suave">
            {place.reviewCount.toLocaleString("es-CL")} reseñas
          </span>
        </div>

        {/* Info rows */}
        <ul className="mt-5 flex flex-col gap-2.5">
          <li className="flex items-center gap-3 text-sm text-carbon">
            <IconMapPin size={16} className="text-bronceado shrink-0" aria-hidden="true" />
            <span>{place.address}</span>
          </li>
          <li className="flex items-start gap-3 text-sm text-carbon">
            <IconClock
              size={16}
              className="text-bronceado shrink-0 mt-0.5"
              aria-hidden="true"
            />
            <PlaceHours
              byDay={place.hours.byDay}
              weekdays={place.hours.weekdays}
              weekends={place.hours.weekends}
            />
          </li>
          <li className="flex items-center gap-3 text-sm text-carbon">
            <IconCash size={16} className="text-bronceado shrink-0" aria-hidden="true" />
            <span>
              <span className="font-semibold">{place.priceRange}</span>
              {priceDescription.get(place.priceRange)
                ? ` — ${priceDescription.get(place.priceRange)} por persona`
                : null}
            </span>
          </li>
          {place.specialty && (
            <li className="flex items-start gap-3 text-sm text-carbon">
              <IconFlame
                size={16}
                className="text-bronceado shrink-0 mt-0.5"
                aria-hidden="true"
              />
              <span>famosos por: {place.specialty}</span>
            </li>
          )}
        </ul>

        {/* Action buttons */}
        <div className="flex gap-2 mt-5">
          <Button variant="secondary" size="sm" fullWidth>
            <IconMapPin size={14} aria-hidden="true" /> mapa
          </Button>
          {place.phone && (
            <Button variant="secondary" size="sm" fullWidth>
              <IconPhone size={14} aria-hidden="true" /> llamar
            </Button>
          )}
          {place.instagram && (
            <Button variant="secondary" size="sm" fullWidth>
              <IconBrandInstagram size={14} aria-hidden="true" /> ig
            </Button>
          )}
        </div>

        {/* Mi reseña — destacada con acciones edit/delete */}
        {mine && (
          <section aria-labelledby="my-review-heading" className="mt-6">
            <h2
              id="my-review-heading"
              className="font-display font-semibold text-sm text-carbon mb-3"
            >
              tu reseña
            </h2>
            <article className="bg-crema-deep rounded-lg border border-mostaza/40 p-3">
              <header className="flex items-start justify-between gap-2 mb-2">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-full bg-mostaza text-carbon flex items-center justify-center text-[10px] font-medium">
                    {mine.authorInitials}
                  </div>
                  <div>
                    <p className="text-xs font-medium text-carbon">{mine.authorName}</p>
                    <p className="text-[10px] text-bronceado">
                      {"★".repeat(mine.rating)} · hace {daysSince(mine.createdAt)}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <Link
                    href={`/${place.comuna}/${place.slug}/calificar`}
                    aria-label="editar reseña"
                    className="flex items-center justify-center w-8 h-8 rounded-md text-tinta-suave hover:bg-crema-edge transition-[transform,colors] duration-150 active:scale-90"
                  >
                    <IconPencil size={15} aria-hidden="true" />
                  </Link>
                  <form action={deleteMyReview}>
                    <input type="hidden" name="reviewId" value={mine.id} />
                    <input type="hidden" name="comuna" value={place.comuna} />
                    <input type="hidden" name="slug" value={place.slug} />
                    <button
                      type="submit"
                      aria-label="borrar reseña"
                      className="flex items-center justify-center w-8 h-8 rounded-md text-tomate hover:bg-tomate/10 transition-[transform,colors] duration-150 active:scale-90"
                    >
                      <IconTrash size={15} aria-hidden="true" />
                    </button>
                  </form>
                </div>
              </header>
              {mine.text && (
                <p className="text-xs text-carbon leading-relaxed">{mine.text}</p>
              )}
            </article>
          </section>
        )}

        {/* Reviews preview (excluye la propia, ya mostrada arriba) */}
        {others.length > 0 && (
          <section aria-labelledby="reviews-heading" className="mt-6">
            <div className="flex items-baseline justify-between mb-3">
              <h2 id="reviews-heading" className="font-display font-semibold text-sm text-carbon">
                reseñas recientes
              </h2>
              <span className="text-xs text-tinta-suave">
                ver las {place.reviewCount.toLocaleString("es-CL")}
              </span>
            </div>
            <div className="flex flex-col gap-2">
              {others.slice(0, 2).map((review) => (
                <article
                  key={review.id}
                  className="bg-crema-deep rounded-lg border border-crema-edge p-3"
                >
                  <header className="flex items-center gap-2 mb-2">
                    <div className="w-7 h-7 rounded-full bg-lechuga text-crema-deep flex items-center justify-center text-[10px] font-medium">
                      {review.authorInitials}
                    </div>
                    <div>
                      <p className="text-xs font-medium text-carbon">{review.authorName}</p>
                      <p className="text-[10px] text-bronceado">
                        {"★".repeat(review.rating)} · hace {daysSince(review.createdAt)}
                      </p>
                    </div>
                  </header>
                  {review.text && (
                    <p className="text-xs text-carbon leading-relaxed">{review.text}</p>
                  )}
                </article>
              ))}
            </div>
          </section>
        )}
      </main>

      {/* Sticky CTA — cambia entre crear y editar según el estado del usuario */}
      <div className="fixed bottom-0 left-0 right-0 bg-crema border-t border-crema-edge px-4 py-3 z-30">
        <Link href={`/${place.comuna}/${place.slug}/calificar`} className="block">
          <Button variant="primary" size="lg" fullWidth>
            {myReview ? "editar mi reseña" : "calificar este lugar"}
          </Button>
        </Link>
      </div>
    </div>
  );
}

// ============================================================================
// Sub-componentes
// ============================================================================

function PlaceHours({
  byDay,
  weekdays,
  weekends,
}: {
  byDay: Record<string, string | null> | null | undefined;
  weekdays: string;
  weekends: string;
}) {
  // Si no tiene horario por día (locales legacy), caemos al texto resumen.
  if (!byDay || Object.keys(byDay).length === 0) {
    return (
      <span>
        {weekdays
          ? `lun-vie ${weekdays}${weekends ? ` · sáb-dom ${weekends}` : ""}`
          : "horario no disponible"}
      </span>
    );
  }

  const todayIdx = (new Date().getDay() + 6) % 7; // lunes=0, domingo=6
  return (
    <ul className="flex flex-col gap-0.5 flex-1">
      {DAY_KEYS.map((d, i) => {
        const range = byDay[d as DayKey];
        const isToday = i === todayIdx;
        return (
          <li
            key={d}
            className={`flex justify-between gap-3 ${isToday ? "font-medium text-carbon" : "text-tinta-suave"}`}
          >
            <span className="capitalize">{DAY_FULL_LABEL[d]}</span>
            <span>{range ? formatRange(range) : "cerrado"}</span>
          </li>
        );
      })}
    </ul>
  );
}

function formatRange(range: string): string {
  // Backend guarda "HH:MM-HH:MM"; mostramos con espacios y guión largo.
  return range.replace("-", " – ");
}

// ============================================================================
// JSON-LD (Schema.org Restaurant)
// ============================================================================

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://hambuscador.cl";

const SCHEMA_DAY_NAME: Record<DayKey, string> = {
  lun: "Monday",
  mar: "Tuesday",
  mie: "Wednesday",
  jue: "Thursday",
  vie: "Friday",
  sab: "Saturday",
  dom: "Sunday",
};

type RestaurantJsonLd = {
  "@context": "https://schema.org";
  "@type": "Restaurant";
  "@id": string;
  name: string;
  url: string;
  image?: string[];
  address: {
    "@type": "PostalAddress";
    streetAddress: string;
    addressLocality: string;
    addressRegion: string;
    addressCountry: "CL";
  };
  geo: {
    "@type": "GeoCoordinates";
    latitude: number;
    longitude: number;
  };
  priceRange: string;
  servesCuisine: string[];
  telephone?: string;
  sameAs?: string[];
  aggregateRating?: {
    "@type": "AggregateRating";
    ratingValue: string;
    reviewCount: number;
    bestRating: "5";
    worstRating: "1";
  };
  openingHoursSpecification?: Array<{
    "@type": "OpeningHoursSpecification";
    dayOfWeek: string;
    opens: string;
    closes: string;
  }>;
};

function buildRestaurantJsonLd(place: {
  id: string;
  slug: string;
  name: string;
  comuna: string;
  comunaLabel: string;
  region: string;
  address: string;
  cuisines: string[];
  priceRange: string;
  rating: number;
  reviewCount: number;
  hours: { byDay: Record<string, string | null> | null | undefined };
  coords: { lat: number; lng: number };
  photos: string[];
  phone?: string;
  instagram?: string;
}): RestaurantJsonLd {
  const url = `${SITE_URL}/${place.comuna}/${place.slug}`;

  const ld: RestaurantJsonLd = {
    "@context": "https://schema.org",
    "@type": "Restaurant",
    "@id": url,
    name: place.name,
    url,
    address: {
      "@type": "PostalAddress",
      streetAddress: place.address,
      addressLocality: place.comunaLabel,
      addressRegion: place.region,
      addressCountry: "CL",
    },
    geo: {
      "@type": "GeoCoordinates",
      latitude: place.coords.lat,
      longitude: place.coords.lng,
    },
    priceRange: place.priceRange,
    servesCuisine: place.cuisines,
  };

  if (place.photos.length > 0) ld.image = place.photos;
  if (place.phone) ld.telephone = place.phone;
  if (place.instagram) ld.sameAs = [`https://instagram.com/${place.instagram}`];

  if (place.reviewCount > 0 && place.rating > 0) {
    ld.aggregateRating = {
      "@type": "AggregateRating",
      ratingValue: place.rating.toFixed(1),
      reviewCount: place.reviewCount,
      bestRating: "5",
      worstRating: "1",
    };
  }

  if (place.hours.byDay) {
    const spec: RestaurantJsonLd["openingHoursSpecification"] = [];
    for (const d of DAY_KEYS) {
      const range = place.hours.byDay[d];
      if (!range) continue;
      const [opens, closes] = range.split("-");
      if (!opens || !closes) continue;
      spec.push({
        "@type": "OpeningHoursSpecification",
        dayOfWeek: SCHEMA_DAY_NAME[d as DayKey],
        opens,
        closes,
      });
    }
    if (spec.length > 0) ld.openingHoursSpecification = spec;
  }

  return ld;
}

// ============================================================================
// Helpers
// ============================================================================

function daysSince(iso: string): string {
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / (1000 * 60 * 60 * 24));
  if (days === 0) return "hoy";
  if (days === 1) return "1 día";
  if (days < 7) return `${days} días`;
  if (days < 30) return `${Math.floor(days / 7)} semanas`;
  if (days < 365) return `${Math.floor(days / 30)} meses`;
  return `${Math.floor(days / 365)} años`;
}
