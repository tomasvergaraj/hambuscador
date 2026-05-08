import { IconChevronRight, IconStarFilled } from "@tabler/icons-react";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";

import { BottomNav } from "@/components/nav/bottom-nav";
import { Header } from "@/components/nav/header";
import { ShareButton } from "@/components/place/share-button";
import { getReviewById } from "@/lib/data";

// ============================================================================
// /r/[id] — página pública compartible de una reseña individual.
// 404 si no existe o el autor está baneado. noindex (las reseñas no están
// pensadas como contenido SEO primario; el local sí).
// ============================================================================

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const review = await getReviewById(id);
  if (!review) return { title: "reseña no encontrada", robots: { index: false } };

  const author = review.author.name;
  const place = review.place.name;
  const description = review.text
    ? review.text.slice(0, 160)
    : `${author} le puso ${review.rating} estrellas a ${place}.`;

  return {
    title: `${author} sobre ${place}`,
    description,
    robots: { index: false },
  };
}

export default async function ReviewPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const review = await getReviewById(id);
  if (!review) notFound();

  const placeHref = `/${review.place.comunaSlug}/${review.place.slug}`;
  // unstable_cache serializa Date → string al hidratar; nuevo Date para
  // tolerar ambas formas (cache miss = Date, cache hit = string ISO).
  const date = new Intl.DateTimeFormat("es-CL", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date(review.createdAt));

  return (
    <div className="flex flex-col min-h-screen pb-24">
      <Header title="reseña" backHref={placeHref} />

      <main className="px-4 pt-4 flex-1 flex flex-col gap-4">
        <article className="bg-crema-deep border border-crema-edge rounded-xl p-4">
          <header className="flex items-center justify-between gap-2">
            {review.author.username ? (
              <Link
                href={`/u/${review.author.username}`}
                className="flex items-center gap-2 hover:opacity-80 transition-opacity"
              >
                <div className="w-9 h-9 rounded-full bg-lechuga text-crema-deep flex items-center justify-center text-xs font-medium">
                  {review.author.initials}
                </div>
                <div>
                  <p className="text-sm font-medium text-carbon">
                    {review.author.name}
                  </p>
                  <p className="text-[11px] text-tinta-suave">
                    @{review.author.username} · {date}
                  </p>
                </div>
              </Link>
            ) : (
              <div className="flex items-center gap-2">
                <div className="w-9 h-9 rounded-full bg-lechuga text-crema-deep flex items-center justify-center text-xs font-medium">
                  {review.author.initials}
                </div>
                <div>
                  <p className="text-sm font-medium text-carbon">
                    {review.author.name}
                  </p>
                  <p className="text-[11px] text-tinta-suave">{date}</p>
                </div>
              </div>
            )}
            <ShareButton
              path={`/r/${review.id}`}
              title={`${review.author.name} sobre ${review.place.name}`}
              text={review.text ?? undefined}
            />
          </header>

          <div className="mt-3 flex items-center gap-1 text-mostaza">
            {Array.from({ length: review.rating }).map((_, i) => (
              <IconStarFilled key={i} size={18} aria-hidden="true" />
            ))}
            <span className="ml-2 text-xs text-tinta-suave">
              {review.rating} de 5
            </span>
          </div>

          {review.text && (
            <p className="mt-3 text-sm text-carbon leading-relaxed whitespace-pre-line">
              {review.text}
            </p>
          )}

          {review.photos.length > 0 && (
            <div className="mt-3 grid grid-cols-2 gap-2">
              {review.photos.map((url) => (
                <div
                  key={url}
                  className="relative aspect-square rounded-lg overflow-hidden bg-crema-edge"
                >
                  <Image
                    src={url}
                    alt="foto de la reseña"
                    fill
                    sizes="(max-width: 640px) 50vw, 240px"
                    className="object-cover"
                  />
                </div>
              ))}
            </div>
          )}
        </article>

        <Link
          href={placeHref}
          className="bg-white border border-crema-edge rounded-xl p-3 flex items-center gap-3 transition-[transform,colors,box-shadow] duration-150 active:scale-[0.99] hover:shadow-md hover:border-mostaza/50"
        >
          <div className="flex-1 min-w-0">
            <p className="text-[10px] uppercase tracking-wider text-bronceado font-medium">
              sobre la picá
            </p>
            <p className="font-display font-semibold text-base text-carbon truncate">
              {review.place.name}
            </p>
            <p className="text-[11px] text-tinta-suave truncate">
              {review.place.comunaLabel}, {review.place.region}
            </p>
          </div>
          <IconChevronRight size={18} className="text-bronceado shrink-0" aria-hidden="true" />
        </Link>
      </main>

      <BottomNav />
    </div>
  );
}
