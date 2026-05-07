import { IconArrowLeft } from "@tabler/icons-react";
import Link from "next/link";
import { notFound } from "next/navigation";

import { BottomNav } from "@/components/nav/bottom-nav";
import { PicaIcon } from "@/components/place/pica-icon";
import { PlaceCard } from "@/components/place/place-card";
import { ShareButton } from "@/components/place/share-button";
import { getPlacesForPicasList } from "@/lib/data";
import { PICAS_LISTS } from "@/lib/picas";

type Params = { slug: string };

// Pre-render todas las listas estáticas (catálogo cerrado).
export function generateStaticParams() {
  return PICAS_LISTS.map((l) => ({ slug: l.slug }));
}

export async function generateMetadata({ params }: { params: Promise<Params> }) {
  const { slug } = await params;
  const result = await getPlacesForPicasList(slug);
  if (!result) return { title: "lista no encontrada" };
  const { list } = result;
  return {
    title: `${list.title} — picas | hambuscador`,
    description: list.intro,
    openGraph: {
      title: `${list.title} — hambuscador`,
      description: list.hook,
      type: "website",
    },
  };
}

export default async function PicaDetailPage({
  params,
}: {
  params: Promise<Params>;
}) {
  const { slug } = await params;
  const result = await getPlacesForPicasList(slug);
  if (!result) notFound();

  const { list, places } = result;

  return (
    <main className="min-h-screen pb-24">
      {/* Header con back + share */}
      <header className="flex items-center gap-2 px-4 pt-3 pb-2">
        <Link
          href="/picas"
          aria-label="volver a picas"
          className="w-9 h-9 inline-flex items-center justify-center text-carbon hover:bg-crema-deep rounded-full transition-[transform,colors] duration-150 active:scale-90"
        >
          <IconArrowLeft size={18} />
        </Link>
        <span className="flex-1 text-xs text-bronceado font-medium uppercase tracking-wider">
          picas
        </span>
        <ShareButton
          path={`/picas/${list.slug}`}
          title={`${list.title} — hambuscador`}
          text={list.hook}
        />
      </header>

      {/* Hero de la lista: icono grande + título + intro */}
      <section className="px-4 pt-2">
        <div className="bg-gradient-to-br from-mostaza/20 via-mostaza/10 to-transparent rounded-2xl px-5 py-6">
          <div className="w-14 h-14 rounded-2xl bg-mostaza flex items-center justify-center text-carbon mb-3">
            <PicaIcon name={list.icon} size={32} />
          </div>
          <h1 className="font-display font-semibold text-[28px] leading-[1.05] text-carbon">
            {list.title}
          </h1>
          <p className="text-sm text-tinta-suave mt-1.5">{list.hook}</p>
        </div>
      </section>

      <section className="px-4 mt-4">
        <p className="text-sm text-carbon leading-relaxed">{list.intro}</p>
      </section>

      <section className="px-4 mt-5 flex items-baseline justify-between">
        <h2 className="font-display font-semibold text-sm text-carbon">
          {places.length} {places.length === 1 ? "picá" : "picás"}
        </h2>
        <span className="text-xs text-tinta-suave">ordenadas por popularidad</span>
      </section>

      <section className="px-4 mt-2 flex flex-col gap-2 pb-6">
        {places.length === 0 ? (
          <EmptyList />
        ) : (
          places.map((place, idx) => (
            <RankedCard key={place.id} place={place} rank={idx + 1} />
          ))
        )}
      </section>

      <BottomNav />
    </main>
  );
}

function RankedCard({
  place,
  rank,
}: {
  place: import("@/types/place").Place;
  rank: number;
}) {
  return (
    <div className="relative">
      {/* Badge de ranking — top 3 mostaza, resto crema */}
      <span
        className={`absolute -top-1 -left-1 z-10 inline-flex items-center justify-center w-7 h-7 rounded-full font-display font-bold text-xs shadow ${
          rank <= 3
            ? "bg-mostaza text-carbon"
            : "bg-white text-carbon border border-crema-edge"
        }`}
        aria-label={`puesto ${rank}`}
      >
        {rank}
      </span>
      <PlaceCard place={place} variant="compact" />
    </div>
  );
}

function EmptyList() {
  return (
    <div className="text-center py-10 text-tinta-suave">
      <p className="font-display font-semibold text-base text-carbon">
        nada por ahora
      </p>
      <p className="text-xs mt-1">
        cuando se sumen locales que matcheen, aparecerán acá
      </p>
    </div>
  );
}
