import { IconBrandInstagram, IconCash, IconClock, IconFlame, IconMapPin, IconPhone, IconPhoto, IconShare, IconHeart } from "@tabler/icons-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { Header } from "@/components/nav/header";
import { Button } from "@/components/ui/button";
import { RatingPill } from "@/components/ui/rating-pill";
import { StatusPill } from "@/components/ui/status-pill";
import { getPlaceBySlug, getReviewsByPlaceId } from "@/lib/data";
import { PRICE_RANGES } from "@/lib/constants";

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
      // TODO Fase 4: og:image dinámico generado en /api/og/[slug]
      images: [`/api/og/${place.slug}`],
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

  const reviews = await getReviewsByPlaceId(place.id);

  // TODO Fase 4: generar JSON-LD `Restaurant` + `LocalBusiness` + `AggregateRating`
  // Ver: https://schema.org/Restaurant
  // const jsonLd = { ... };

  return (
    <div className="flex flex-col min-h-screen pb-24">
      {/* Hero image (placeholder hasta Fase 2) */}
      <div className="relative h-52 bg-mostaza-deep flex items-center justify-center">
        <IconPhoto size={42} className="text-crema-deep/50" aria-hidden="true" />

        {/* Overlay nav */}
        <div className="absolute top-4 left-4 right-4 flex items-center justify-between">
          <Link
            href="/buscar"
            aria-label="atrás"
            className="flex items-center justify-center w-9 h-9 rounded-full bg-crema-deep/90 backdrop-blur-sm text-carbon hover:bg-crema-deep transition-colors"
          >
            <IconShare size={18} className="rotate-180" aria-hidden="true" />
          </Link>
          <div className="flex gap-2">
            <button
              type="button"
              aria-label="compartir"
              className="flex items-center justify-center w-9 h-9 rounded-full bg-crema-deep/90 backdrop-blur-sm text-carbon hover:bg-crema-deep transition-colors"
            >
              <IconShare size={18} aria-hidden="true" />
            </button>
            <button
              type="button"
              aria-label="agregar a favoritos"
              className="flex items-center justify-center w-9 h-9 rounded-full bg-crema-deep/90 backdrop-blur-sm text-tomate hover:bg-crema-deep transition-colors"
            >
              <IconHeart size={18} aria-hidden="true" />
            </button>
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
          <li className="flex items-center gap-3 text-sm text-carbon">
            <IconClock size={16} className="text-bronceado shrink-0" aria-hidden="true" />
            <span>
              {place.hours.weekdays} · lun-vie · sáb-dom {place.hours.weekends}
            </span>
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

        {/* Reviews preview */}
        {reviews.length > 0 && (
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
              {reviews.slice(0, 2).map((review) => (
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

      {/* Sticky CTA */}
      <div className="fixed bottom-0 left-0 right-0 bg-crema border-t border-crema-edge px-4 py-3 z-30">
        <Link href={`/${place.comuna}/${place.slug}/calificar`} className="block">
          <Button variant="primary" size="lg" fullWidth>
            calificar este lugar
          </Button>
        </Link>
      </div>
    </div>
  );
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
