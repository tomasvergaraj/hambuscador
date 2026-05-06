import { IconArrowLeft, IconList, IconMap } from "@tabler/icons-react";
import Link from "next/link";

import { BottomNav } from "@/components/nav/bottom-nav";
import { PlaceCard } from "@/components/place/place-card";
import { Chip } from "@/components/ui/chip";
import { SearchBar } from "@/components/ui/search-bar";
import { searchPlaces } from "@/lib/data";

type SearchParams = {
  q?: string;
  vista?: "lista" | "mapa";
  cuisine?: string;
};

export const metadata = {
  title: "buscar",
  description: "Encuentra hamburgueserías por nombre, barrio o tipo de cocina.",
};

export default async function BuscarPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const sp = await searchParams;
  const query = sp.q ?? "";
  const view = sp.vista ?? "lista";
  const results = await searchPlaces(query, { cuisine: sp.cuisine });

  return (
    <div className="flex flex-col min-h-screen pb-16">
      {/* Top row: back + search */}
      <header className="flex items-center gap-2 px-4 pt-3 pb-2">
        <Link
          href="/"
          aria-label="atrás"
          className="w-9 h-9 inline-flex items-center justify-center text-carbon hover:bg-crema-deep rounded-full transition-colors"
        >
          <IconArrowLeft size={18} />
        </Link>
        <div className="flex-1">
          <SearchBar size="md" defaultValue={query} placeholder="busca por barrio o nombre" />
        </div>
      </header>

      {/* View toggle (lista | mapa) */}
      <section className="px-4 pb-3 pt-1">
        <div className="inline-flex w-full bg-crema-deep border border-crema-edge rounded-full p-1">
          <Link
            href={{ pathname: "/buscar", query: { ...sp, vista: undefined } }}
            className={`flex-1 inline-flex items-center justify-center gap-1.5 rounded-full px-3 py-2 text-sm transition-colors ${
              view === "lista"
                ? "bg-carbon text-crema font-medium"
                : "text-carbon hover:bg-crema-edge/40"
            }`}
          >
            <IconList size={14} aria-hidden="true" /> lista
          </Link>
          <Link
            href={{ pathname: "/buscar", query: { ...sp, vista: "mapa" } }}
            className={`flex-1 inline-flex items-center justify-center gap-1.5 rounded-full px-3 py-2 text-sm transition-colors ${
              view === "mapa"
                ? "bg-carbon text-crema font-medium"
                : "text-carbon hover:bg-crema-edge/40"
            }`}
          >
            <IconMap size={14} aria-hidden="true" /> mapa
          </Link>
        </div>
      </section>

      {/* Active filters */}
      <section className="px-4 pb-3 flex items-center gap-2 overflow-x-auto scrollbar-hide">
        {query && <Chip active>{query}</Chip>}
        <Chip>abierto</Chip>
        <Chip>$$ o menos</Chip>
        <Chip>smash</Chip>
      </section>

      {/* Results count + sort */}
      <section className="px-4 pb-3 flex items-center justify-between">
        <span className="text-xs text-carbon font-medium">
          {results.length} {results.length === 1 ? "resultado" : "resultados"}
        </span>
        <button type="button" className="text-xs text-tinta-suave">
          mejor calificadas ▾
        </button>
      </section>

      {/* Results */}
      {view === "lista" ? (
        <section className="px-4 flex flex-col gap-2 pb-6">
          {results.length === 0 ? (
            <EmptyState />
          ) : (
            results.map((place) => (
              <PlaceCard key={place.id} place={place} variant="compact" />
            ))
          )}
        </section>
      ) : (
        <section className="px-4 pb-6">
          <MapPlaceholder />
        </section>
      )}

      <div className="flex-1" />
      <BottomNav />
    </div>
  );
}

function EmptyState() {
  return (
    <div className="text-center py-12 text-tinta-suave">
      <p className="font-display font-semibold text-base text-carbon">no encontramos picás</p>
      <p className="text-xs mt-1">probá con otros filtros o agregá la que falta</p>
    </div>
  );
}

function MapPlaceholder() {
  // TODO Fase 3: integrar MapLibre con tiles de Stadia/Protomaps y pins reales
  return (
    <div className="bg-crema-deep border border-crema-edge rounded-xl h-96 flex items-center justify-center text-center px-6">
      <div>
        <p className="font-display font-semibold text-sm text-carbon">vista de mapa</p>
        <p className="text-xs text-tinta-suave mt-2">
          se conectará en Fase 3 con MapLibre + clusters
        </p>
      </div>
    </div>
  );
}
