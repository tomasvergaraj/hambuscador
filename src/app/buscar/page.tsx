import { IconArrowLeft, IconList, IconMap } from "@tabler/icons-react";
import { cookies } from "next/headers";
import Link from "next/link";

import { BottomNav } from "@/components/nav/bottom-nav";
import { PlaceCard } from "@/components/place/place-card";
import { PlacesMap } from "@/components/place/places-map";
import { Chip } from "@/components/ui/chip";
import { SearchBar } from "@/components/ui/search-bar";
import { searchPlaces } from "@/lib/data";
import { GEO_COOKIE_NAME, parseGeoCookie } from "@/lib/geo";

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

  const [results, cookieStore] = await Promise.all([
    searchPlaces(query, { cuisine: sp.cuisine }),
    cookies(),
  ]);
  const userCoords = parseGeoCookie(cookieStore.get(GEO_COOKIE_NAME)?.value);

  // ============================================================================
  // Vista mapa: layout fullscreen con todos los controles flotando encima.
  // El mapa es la capa de fondo; header, toggle y filtros viven en posición
  // absoluta con backdrop-blur para legibilidad sobre el mapa.
  // ============================================================================
  if (view === "mapa") {
    return (
      <div className="fixed inset-0 flex flex-col overflow-hidden">
        {/* Capa mapa — ocupa todo el viewport debajo de la nav inferior */}
        <PlacesMap
          places={results}
          userCoords={userCoords ?? undefined}
          className="map-fullscreen absolute inset-0 z-0"
        />

        {/* Top overlay: search + toggle */}
        <div className="absolute top-0 left-0 right-0 z-10 pt-3 px-3 flex flex-col gap-2 pointer-events-none">
          <header className="flex items-center gap-2 pointer-events-auto">
            <Link
              href="/"
              aria-label="atrás"
              className="w-9 h-9 inline-flex items-center justify-center text-carbon bg-white/95 backdrop-blur-sm shadow rounded-full transition-[transform,colors] duration-150 active:scale-90"
            >
              <IconArrowLeft size={18} />
            </Link>
            <div className="flex-1">
              <SearchBar
                size="md"
                defaultValue={query}
                placeholder="busca por barrio o nombre"
              />
            </div>
          </header>

          <div className="inline-flex w-full bg-white/95 backdrop-blur-sm border border-crema-edge rounded-full p-1 shadow pointer-events-auto">
            <Link
              href={{ pathname: "/buscar", query: { ...sp, vista: undefined } }}
              className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-full px-3 py-2 text-sm transition-[transform,colors] duration-150 active:scale-[0.97] text-carbon hover:bg-crema-edge/40"
            >
              <IconList size={14} aria-hidden="true" /> lista
            </Link>
            <Link
              href={{ pathname: "/buscar", query: { ...sp, vista: "mapa" } }}
              aria-current="page"
              className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-full px-3 py-2 text-sm bg-carbon text-crema font-medium"
            >
              <IconMap size={14} aria-hidden="true" /> mapa
            </Link>
          </div>
        </div>

        {/* Bottom: contador flotante encima de la nav */}
        <div className="absolute bottom-20 left-1/2 -translate-x-1/2 z-10 bg-carbon/90 backdrop-blur-sm text-crema text-xs font-medium px-3 py-1.5 rounded-full shadow">
          {results.length} {results.length === 1 ? "resultado" : "resultados"}
        </div>

        <BottomNav />
      </div>
    );
  }

  // ============================================================================
  // Vista lista: layout original
  // ============================================================================
  return (
    <div className="flex flex-col min-h-screen pb-24">
      {/* Top row: back + search */}
      <header className="flex items-center gap-2 px-4 pt-3 pb-2">
        <Link
          href="/"
          aria-label="atrás"
          className="w-9 h-9 inline-flex items-center justify-center text-carbon hover:bg-crema-deep rounded-full transition-[transform,colors] duration-150 active:scale-90"
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
            aria-current="page"
            className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-full px-3 py-2 text-sm bg-carbon text-crema font-medium"
          >
            <IconList size={14} aria-hidden="true" /> lista
          </Link>
          <Link
            href={{ pathname: "/buscar", query: { ...sp, vista: "mapa" } }}
            className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-full px-3 py-2 text-sm transition-[transform,colors] duration-150 active:scale-[0.97] text-carbon hover:bg-crema-edge/40"
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
      <section className="px-4 flex flex-col gap-2 pb-6">
        {results.length === 0 ? (
          <EmptyState />
        ) : (
          results.map((place) => (
            <PlaceCard key={place.id} place={place} variant="compact" />
          ))
        )}
      </section>

      <div className="flex-1" />
      <BottomNav />
    </div>
  );
}

function EmptyState() {
  return (
    <div className="text-center py-12 text-tinta-suave">
      <p className="font-display font-semibold text-base text-carbon">no encontramos picás</p>
      <p className="text-xs mt-1">prueba con otros filtros o agrega la que falta</p>
    </div>
  );
}
