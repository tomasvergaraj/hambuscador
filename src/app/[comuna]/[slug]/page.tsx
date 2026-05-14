import {
  IconArrowLeft,
  IconBrandFacebook,
  IconBrandInstagram,
  IconBrandTiktok,
  IconBrandWhatsapp,
  IconCamera,
  IconCash,
  IconClock,
  IconFlame,
  IconPercentage,
  IconMapPin,
  IconMenu2,
  IconPencil,
  IconPhone,
  IconRosetteDiscountCheckFilled,
  IconSparkles,
  IconTrash,
  IconHeart,
  IconWorld,
} from "@tabler/icons-react";
import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { ComponentType, SVGProps } from "react";

import type { DbPromotion } from "@/server/db/schema";

import { OwnerReplyForm } from "@/components/place/owner-reply";
import { PhotoCarousel } from "@/components/place/photo-carousel";
import { PlaceTracker } from "@/components/place/place-tracker";
import { ReplyCard } from "@/components/place/reply-card";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { RatingPill } from "@/components/ui/rating-pill";
import { StatusPill } from "@/components/ui/status-pill";
import {
  getPlaceBySlug,
  getRepliesForReviewIds,
  getReviewsByPlaceId,
} from "@/lib/data";
import { DAY_FULL_LABEL, DAY_KEYS, PRICE_RANGES, type DayKey } from "@/lib/constants";
import { ShareButton } from "@/components/place/share-button";
import { auth } from "@/server/auth";
import { hasPendingClaim, isOwnerOf } from "@/server/services/claims";
import { isFavorite } from "@/server/services/favorites";
import { getActivePromotionsForPlace } from "@/server/services/promotions";
import { getMyReviewWithAuthor } from "@/server/services/reviews";
import { hasActivePremium } from "@/server/services/subscriptions";

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

  const session = await auth();
  const userId = session?.user?.id ?? null;
  const isAdmin = session?.user?.role === "admin";

  // Mine va aparte (con JOIN a users) y `others` excluye su id, así no
  // overfetcheamos. Antes pedíamos 20 reseñas para mostrar 2 + buscar la
  // propia en el array — ahora son ~7 queries en paralelo, todas baratas.
  const [mine, others, favorited, isOwner, claimPending, isPremium, promos] = await Promise.all([
    userId ? getMyReviewWithAuthor(place.id, userId) : Promise.resolve(null),
    getReviewsByPlaceId(
      place.id,
      userId ? { limit: 6, excludeAuthorId: userId } : { limit: 6 },
    ),
    userId ? isFavorite(userId, place.id) : Promise.resolve(false),
    userId ? isOwnerOf(userId, place.id) : Promise.resolve(false),
    userId ? hasPendingClaim(place.id, userId) : Promise.resolve(false),
    hasActivePremium(place.id),
    getActivePromotionsForPlace(place.id),
  ]);
  const canEdit = isAdmin || isOwner;
  const canReplyAsOwner = isOwner && isPremium;

  // Replies del owner (siempre visibles a todos; el form solo si owner+premium).
  const visibleReviewIds = [
    ...(mine ? [mine.id] : []),
    ...others.slice(0, 2).map((r) => r.id),
  ];
  const repliesMap = visibleReviewIds.length > 0
    ? await getRepliesForReviewIds(visibleReviewIds)
    : new Map();

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

      {/* Hero — carousel de fotos del local con scroll-snap. Si no hay fotos
          cae a placeholder de la marca. Overlay nav (back/admin/share/heart)
          va sobre el carousel con z-index implícito (el carousel es absolute
          inset-0 dentro del contenedor relativo). */}
      <div className="relative h-52 bg-mostaza-deep">
        <PhotoCarousel photos={place.photos} placeName={place.name} />

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
            {canEdit && (
              <Link
                href={
                  isAdmin
                    ? `/admin/places/${place.id}/edit`
                    : `/mi-local/${place.id}/editar`
                }
                aria-label={isAdmin ? "editar (admin)" : "editar mi local"}
                title={isAdmin ? "editar (admin)" : "editar mi local"}
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
      </div>

      {/* Main content */}
      <main className="px-4 pt-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <h1 className="font-display font-semibold text-2xl text-carbon tracking-tight leading-tight inline-flex items-center gap-1.5 flex-wrap">
              <span>{place.name}</span>
              {place.isVerified && (
                <span
                  className="inline-flex items-center gap-1 text-[10px] font-medium uppercase tracking-wider bg-mostaza/20 text-mostaza-deep px-2 py-0.5 rounded-full"
                  title="local verificado por hambuscador"
                >
                  <IconRosetteDiscountCheckFilled size={12} aria-hidden="true" />
                  verificado
                </span>
              )}
              {place.isFeatured && (
                <span
                  className="inline-flex items-center gap-1 text-[10px] font-medium uppercase tracking-wider bg-tomate/15 text-tomate px-2 py-0.5 rounded-full"
                  title="local destacado por publicidad"
                >
                  <IconSparkles size={12} aria-hidden="true" />
                  destacado
                </span>
              )}
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

        {promos.length > 0 && (
          <section
            aria-labelledby="promos-heading"
            className="mt-5 flex flex-col gap-2"
          >
            <h2
              id="promos-heading"
              className="text-[11px] uppercase tracking-widest text-bronceado font-medium"
            >
              ofertas activas
            </h2>
            {promos.map((promo) => (
              <PlacePromoCard key={promo.id} promo={promo} />
            ))}
          </section>
        )}

        {/* Action buttons — links accionables. Orden por importancia:
            1. Acciones directas (whatsapp/llamar) → más alto CTR conversación
            2. Menú → clave decisión de compra
            3. Mapa → cómo llegar
            4. Redes sociales (IG/FB/TikTok) → engagement
            5. Sitio web → fallback
            data-track-channel: capturado por <PlaceTracker> pa analytics. */}
        <div className="flex flex-wrap gap-2 mt-5">
          {place.whatsapp && (
            <ActionLink
              href={
                place.whatsapp.startsWith("http")
                  ? place.whatsapp
                  : `https://wa.me/${digitsOnly(place.whatsapp)}`
              }
              target="_blank"
              icon={IconBrandWhatsapp}
              label="whatsapp"
              trackChannel="whatsapp"
            />
          )}
          {place.phone && (
            <ActionLink
              href={`tel:${digitsOnly(place.phone)}`}
              icon={IconPhone}
              label="llamar"
              trackChannel="phone"
            />
          )}
          {place.menuUrl && (
            <ActionLink
              href={ensureUrlScheme(place.menuUrl)}
              target="_blank"
              icon={IconMenu2}
              label="menú"
              trackChannel="website"
            />
          )}
          <ActionLink
            href={`https://www.google.com/maps/search/?api=1&query=${place.coords.lat},${place.coords.lng}`}
            target="_blank"
            icon={IconMapPin}
            label="mapa"
            trackChannel="maps"
          />
          {place.instagram && (
            <ActionLink
              href={`https://instagram.com/${cleanIgHandle(place.instagram)}`}
              target="_blank"
              icon={IconBrandInstagram}
              label="instagram"
              trackChannel="instagram"
            />
          )}
          {place.facebook && (
            <ActionLink
              href={facebookUrl(place.facebook)}
              target="_blank"
              icon={IconBrandFacebook}
              label="facebook"
              trackChannel="website"
            />
          )}
          {place.tiktok && (
            <ActionLink
              href={tiktokUrl(place.tiktok)}
              target="_blank"
              icon={IconBrandTiktok}
              label="tiktok"
              trackChannel="website"
            />
          )}
          {place.website && (
            <ActionLink
              href={ensureUrlScheme(place.website)}
              target="_blank"
              icon={IconWorld}
              label="sitio web"
              trackChannel="website"
            />
          )}
        </div>

        <PlaceTracker placeId={place.id} />

        {/* CTA reclamar — visible si el local no está claimed y el viewer
            no es ni admin ni el owner. Si tiene claim pending, mostramos
            estado en vez de botón. */}
        {!place.isClaimed && !isAdmin && !isOwner && (
          claimPending ? (
            <div className="mt-4 rounded-md bg-mostaza/10 border border-mostaza/30 px-3 py-2 text-xs text-tinta-suave">
              <span className="font-medium text-mostaza-deep">tu reclamo está en revisión.</span>{" "}
              te avisamos por email cuando se apruebe.
            </div>
          ) : (
            <Link
              href={`/${place.comuna}/${place.slug}/reclamar`}
              className="mt-4 inline-flex items-center justify-between gap-2 px-3 py-2.5 rounded-md bg-crema-deep border border-crema-edge hover:border-mostaza transition-[transform,colors] duration-150 active:scale-[0.98]"
            >
              <span className="text-xs text-carbon">
                <span className="font-medium">¿es tu local?</span>{" "}
                <span className="text-tinta-suave">reclámalo y edita la ficha</span>
              </span>
              <span className="text-mostaza-deep text-xs font-medium shrink-0">→</span>
            </Link>
          )
        )}

        {/* Mi reseña — destacada con acciones edit/delete */}
        {mine && (
          <section aria-labelledby="my-review-heading" className="mt-6">
            <h2
              id="my-review-heading"
              className="font-display font-semibold text-sm text-carbon mb-3"
            >
              tu reseña
            </h2>
            <article className="bg-crema-deep rounded-lg border border-mostaza/40 p-3 relative transition-[transform,box-shadow] duration-150 active:scale-[0.99] hover:shadow-md">
              {/* Stretched link — captura clicks en cualquier parte de la card
                  que no sea un botón/link explícito (perfil, editar, borrar).
                  z-10 transparent encima del contenido visible (z-auto); los
                  controles que SÍ deben recibir click llevan z-20. */}
              <Link
                href={`/r/${mine.id}`}
                aria-label="ver reseña completa"
                className="absolute inset-0 z-10 rounded-lg"
              />
              <header className="flex items-start justify-between gap-2 mb-2">
                {mine.authorUsername ? (
                  <Link
                    href={`/u/${mine.authorUsername}`}
                    className="relative z-20 flex items-center gap-2 hover:opacity-80 transition-opacity"
                  >
                    <Avatar
                      image={mine.authorImage}
                      initials={mine.authorInitials}
                      size={28}
                      className="bg-mostaza text-carbon text-[10px]"
                      alt={`avatar de ${mine.authorName}`}
                    />
                    <div>
                      <p className="text-xs font-medium text-carbon">
                        {mine.authorName}
                      </p>
                      <p className="text-[10px] text-bronceado">
                        {"★".repeat(mine.rating)} · hace {daysSince(mine.createdAt)}
                      </p>
                    </div>
                  </Link>
                ) : (
                  <div className="flex items-center gap-2">
                    <Avatar
                      image={mine.authorImage}
                      initials={mine.authorInitials}
                      size={28}
                      className="bg-mostaza text-carbon text-[10px]"
                      alt={`avatar de ${mine.authorName}`}
                    />
                    <div>
                      <p className="text-xs font-medium text-carbon">{mine.authorName}</p>
                      <p className="text-[10px] text-bronceado">
                        {"★".repeat(mine.rating)} · hace {daysSince(mine.createdAt)}
                      </p>
                    </div>
                  </div>
                )}
                <div className="relative z-20 flex items-center gap-1">
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
              {mine.photos.length > 0 && (
                <div className="mt-2">
                  <span className="inline-flex items-center gap-1 text-[10px] font-medium bg-mostaza/15 text-mostaza-deep px-2 py-0.5 rounded-full">
                    <IconCamera size={11} aria-hidden="true" />
                    {mine.photos.length} {mine.photos.length === 1 ? "foto" : "fotos"}
                  </span>
                </div>
              )}
              {repliesMap.get(mine.id) && (
                <ReplyCard text={repliesMap.get(mine.id)!.text} />
              )}
              {canReplyAsOwner && (
                <OwnerReplyForm
                  reviewId={mine.id}
                  placeId={place.id}
                  initialText={repliesMap.get(mine.id)?.text ?? null}
                />
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
                  className="bg-crema-deep rounded-lg border border-crema-edge p-3 relative transition-[transform,box-shadow] duration-150 active:scale-[0.99] hover:shadow-md"
                >
                  {/* Stretched link → /r/[id]. El link de perfil del autor
                      lleva z-20 para ganar el click sobre el avatar/nombre. */}
                  <Link
                    href={`/r/${review.id}`}
                    aria-label="ver reseña completa"
                    className="absolute inset-0 z-10 rounded-lg"
                  />
                  <header className="mb-2 flex items-start justify-between gap-2">
                    {review.authorUsername ? (
                      <Link
                        href={`/u/${review.authorUsername}`}
                        className="relative z-20 flex items-center gap-2 hover:opacity-80 transition-opacity"
                      >
                        <Avatar
                          image={review.authorImage}
                          initials={review.authorInitials}
                          size={28}
                          className="bg-lechuga text-crema-deep text-[10px]"
                          alt={`avatar de ${review.authorName}`}
                        />
                        <div>
                          <p className="text-xs font-medium text-carbon">
                            {review.authorName}
                          </p>
                          <p className="text-[10px] text-bronceado">
                            {"★".repeat(review.rating)} · hace {daysSince(review.createdAt)}
                          </p>
                        </div>
                      </Link>
                    ) : (
                      <div className="flex items-center gap-2">
                        <Avatar
                          image={review.authorImage}
                          initials={review.authorInitials}
                          size={28}
                          className="bg-lechuga text-crema-deep text-[10px]"
                          alt={`avatar de ${review.authorName}`}
                        />
                        <div>
                          <p className="text-xs font-medium text-carbon">
                            {review.authorName}
                          </p>
                          <p className="text-[10px] text-bronceado">
                            {"★".repeat(review.rating)} · hace {daysSince(review.createdAt)}
                          </p>
                        </div>
                      </div>
                    )}
                  </header>
                  {review.text && (
                    <p className="text-xs text-carbon leading-relaxed">{review.text}</p>
                  )}
                  {review.photos.length > 0 && (
                    <div className="mt-2">
                      <span className="inline-flex items-center gap-1 text-[10px] font-medium bg-lechuga/15 text-lechuga-deep px-2 py-0.5 rounded-full">
                        <IconCamera size={11} aria-hidden="true" />
                        {review.photos.length} {review.photos.length === 1 ? "foto" : "fotos"}
                      </span>
                    </div>
                  )}
                  {repliesMap.get(review.id) && (
                    <ReplyCard text={repliesMap.get(review.id)!.text} />
                  )}
                  {canReplyAsOwner && (
                    <OwnerReplyForm
                      reviewId={review.id}
                      placeId={place.id}
                      initialText={repliesMap.get(review.id)?.text ?? null}
                    />
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
            {mine ? "editar mi reseña" : "calificar este lugar"}
          </Button>
        </Link>
      </div>
    </div>
  );
}

// ============================================================================
// Sub-componentes
// ============================================================================

type ActionLinkProps = {
  href: string;
  icon: ComponentType<SVGProps<SVGSVGElement> & { size?: number; stroke?: number }>;
  label: string;
  target?: "_blank";
  trackChannel?: "whatsapp" | "instagram" | "website" | "maps" | "phone";
};

const PROMO_KIND_LABEL: Record<string, string> = {
  percent_discount: "% descuento",
  featured_product: "producto destacado",
  combo: "combo",
};

function formatPromoEnds(d: Date | string): string {
  const date = new Date(d);
  const days = Math.ceil((date.getTime() - Date.now()) / (24 * 60 * 60 * 1000));
  if (days <= 0) return "vence hoy";
  if (days === 1) return "vence mañana";
  if (days <= 14) return `quedan ${days} días`;
  return `hasta ${new Intl.DateTimeFormat("es-CL", {
    day: "2-digit",
    month: "short",
  }).format(date)}`;
}

function PlacePromoCard({ promo }: { promo: DbPromotion }) {
  const isDiscount = promo.kind === "percent_discount" && !!promo.discountPct;
  return (
    <article className="bg-white border border-tomate/30 rounded-xl overflow-hidden">
      {promo.photoUrl ? (
        <div className="relative h-32 bg-tomate/10">
          <Image
            src={promo.photoUrl}
            alt={promo.title}
            fill
            sizes="(max-width: 768px) 100vw, 640px"
            className="object-cover"
            quality={75}
          />
          {isDiscount && (
            <span className="absolute top-2 left-2 bg-tomate text-crema-deep font-display font-bold text-base px-2.5 py-1 rounded-md">
              -{promo.discountPct}%
            </span>
          )}
        </div>
      ) : null}
      <div className="p-3 flex items-start gap-3">
        {!promo.photoUrl && (
          <div className="w-14 h-14 shrink-0 rounded-lg bg-tomate/10 text-tomate flex items-center justify-center font-display font-bold">
            {isDiscount ? (
              <span className="text-base">-{promo.discountPct}%</span>
            ) : (
              <IconPercentage size={26} />
            )}
          </div>
        )}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[10px] uppercase tracking-widest font-medium bg-tomate/15 text-tomate px-1.5 py-0.5 rounded">
              {PROMO_KIND_LABEL[promo.kind] ?? "oferta"}
            </span>
            <span className="text-[10px] text-tomate font-medium inline-flex items-center gap-0.5">
              <IconClock size={10} aria-hidden="true" />
              {formatPromoEnds(promo.endsAt)}
            </span>
          </div>
          <h3 className="font-display font-semibold text-sm text-carbon mt-1">
            {promo.title}
          </h3>
          {promo.description && (
            <p className="text-xs text-tinta-suave mt-1 leading-relaxed">
              {promo.description}
            </p>
          )}
        </div>
      </div>
    </article>
  );
}

function ActionLink({ href, icon: Icon, label, target, trackChannel }: ActionLinkProps) {
  return (
    <a
      href={href}
      target={target}
      rel={target === "_blank" ? "noopener noreferrer" : undefined}
      data-track-channel={trackChannel}
      className="flex-1 min-w-[40%] inline-flex items-center justify-center gap-1.5 h-9 px-3 rounded-md bg-crema-deep border border-crema-edge text-carbon font-medium text-xs hover:bg-crema-edge transition-[transform,colors] duration-150 active:scale-[0.97]"
    >
      <Icon size={14} aria-hidden="true" />
      {label}
    </a>
  );
}

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
  whatsapp?: string;
  instagram?: string;
  facebook?: string;
  tiktok?: string;
  website?: string;
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
  const sameAs: string[] = [];
  if (place.instagram) sameAs.push(`https://instagram.com/${cleanIgHandle(place.instagram)}`);
  if (place.facebook) sameAs.push(facebookUrl(place.facebook));
  if (place.tiktok) sameAs.push(tiktokUrl(place.tiktok));
  if (place.website) sameAs.push(ensureUrlScheme(place.website));
  if (sameAs.length > 0) ld.sameAs = sameAs;

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

/** "+56 9 1234 5678" → "56912345678" — formato wa.me / tel: sin separadores. */
function digitsOnly(s: string): string {
  return s.replace(/\D/g, "");
}

/** Limpia un handle de Instagram: saca @ inicial y URLs si pegaron. */
function cleanIgHandle(s: string): string {
  return s
    .trim()
    .replace(/^@/, "")
    .replace(/^https?:\/\/(www\.)?instagram\.com\//i, "")
    .replace(/\/+$/, "");
}

/** Asegura que la URL tenga `https://` para no romper como link relativo. */
function ensureUrlScheme(s: string): string {
  const trimmed = s.trim();
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
}

/** Acepta page URL completa o slug/handle. Devuelve URL canonical. */
function facebookUrl(s: string): string {
  const trimmed = s.trim().replace(/^@/, "");
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://facebook.com/${trimmed.replace(/^\/+/, "")}`;
}

/** Acepta URL completa o handle (con o sin @). */
function tiktokUrl(s: string): string {
  const trimmed = s.trim();
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  const handle = trimmed.replace(/^@/, "");
  return `https://tiktok.com/@${handle}`;
}

function daysSince(iso: string): string {
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / (1000 * 60 * 60 * 24));
  if (days === 0) return "hoy";
  if (days === 1) return "1 día";
  if (days < 7) return `${days} días`;
  if (days < 30) return `${Math.floor(days / 7)} semanas`;
  if (days < 365) return `${Math.floor(days / 30)} meses`;
  return `${Math.floor(days / 365)} años`;
}
