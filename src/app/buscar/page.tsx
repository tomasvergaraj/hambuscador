import { IconArrowLeft, IconList, IconMap } from "@tabler/icons-react";
import { cookies } from "next/headers";
import dynamic from "next/dynamic";
import Link from "next/link";
import { after } from "next/server";

import { BottomNav } from "@/components/nav/bottom-nav";
import { LiveSearchInput } from "@/components/place/live-search-input";
import { MapSearchInput } from "@/components/place/map-search-input";
import { PicaIcon } from "@/components/place/pica-icon";
import { PlaceCard } from "@/components/place/place-card";
import { SearchFilters } from "@/components/place/search-filters";
import { searchPlaces } from "@/lib/data";
import { GEO_COOKIE_NAME, parseGeoCookie } from "@/lib/geo";
import { PICAS_LISTS, type PicasList } from "@/lib/picas";
import { normalizeForSearch } from "@/lib/search";
import { auth } from "@/server/auth";
import { logSearch } from "@/server/services/search-logs";

// PlacesMap pesa lo suyo (MapLibre + pmtiles + CSS de maplibre-gl). En vista
// `lista` (default y mayoritaria) nunca se renderiza — `next/dynamic` lo
// emite como chunk aparte, así su JS solo se descarga cuando el usuario
// pide `?vista=mapa`. `loading` muestra el lienzo en mostaza-deep para que
// la transición a mapa no flashee blanco mientras el chunk descarga.
const PlacesMap = dynamic(
  () =>
    import("@/components/place/places-map").then((m) => ({ default: m.PlacesMap })),
  {
    loading: () => (
      <div className="absolute inset-0 bg-mostaza-deep flex items-center justify-center">
        <span className="w-6 h-6 rounded-full border-2 border-crema-deep border-t-transparent animate-spin" />
      </div>
    ),
  },
);

type SearchParams = {
  q?: string;
  vista?: "lista" | "mapa";
  cocina?: string;
  precio?: string;
  abierto?: string;
  orden?: string;
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

  const cuisines = csv(sp.cocina);
  const priceRanges = csv(sp.precio);
  const openNow = sp.abierto === "1";
  const explicitSort = parseSort(sp.orden); // null si el user no eligió uno

  const cookieStore = await cookies();
  const userCoords = parseGeoCookie(cookieStore.get(GEO_COOKIE_NAME)?.value);

  // Sort default inteligente: si el usuario tiene coords y NO eligió orden,
  // ordenamos por distancia. Sin coords → rating. Si eligió explícito, respetamos.
  const sort: "rating" | "recent" | "distance" =
    explicitSort ?? (userCoords ? "distance" : "rating");

  // userCoords solo entra al cache key cuando sort=distance (sino fragmenta
  // la cache por usuario sin cambiar el resultado).
  const effectiveSort = sort === "distance" && !userCoords ? "rating" : sort;
  // Limit: lista 30 (default), mapa 5000 — todos los pins. La lista
  // ordenada por distancia muestra los más cercanos primero, lo que el
  // usuario espera. El mapa permite explorar todo Chile sin restringir
  // por proximidad — es lo que el usuario espera al ver la geografía.
  const limit = view === "mapa" ? 5000 : undefined;
  const { items: results, usedFuzzy } = await searchPlaces(query, {
    cuisines: cuisines.length ? cuisines : undefined,
    priceRanges: priceRanges.length ? priceRanges : undefined,
    openNow: openNow || undefined,
    sort: effectiveSort,
    userCoords: effectiveSort === "distance" ? (userCoords ?? undefined) : undefined,
    limit,
  });

  // Logging de la búsqueda — fire-and-forget vía `next/after()` para no bloquear
  // el render. Solo si hay query (no nos interesa contar visitas a /buscar vacío).
  if (query.trim().length > 0) {
    const session = await auth();
    after(() =>
      logSearch({
        query,
        resultCount: results.length,
        usedFuzzy,
        userId: session?.user?.id ?? null,
        source: view === "mapa" ? "map" : "list",
      }),
    );
  }

  // ¿La query matchea una lista curada? Si es así, mostramos un atajo arriba
  // de los resultados — útil para que el usuario salte a la curaduría editorial
  // en lugar de filtrar a mano. Solo desde 3 chars para evitar matches ruidosos.
  const relatedPica = findRelatedPica(query);

  // Agrupación: solo cuando no hay query ni filtros ni sort explícito.
  // Con coords → bandas de distancia; sin coords → por comuna.
  const hasFilters =
    cuisines.length > 0 || priceRanges.length > 0 || openNow || Boolean(query);
  const showGrouped = !hasFilters && !explicitSort;
  const groups = showGrouped
    ? userCoords
      ? groupByDistanceBand(results)
      : groupByComuna(results)
    : null;

  // ============================================================================
  // Vista mapa: layout fullscreen con todos los controles flotando encima.
  // ============================================================================
  if (view === "mapa") {
    // Proyectar a MapPlace antes de pasar al cliente — el mapa solo usa 8
    // campos (id, name, comuna*, slug, rating, isFeatured, coords). Con
    // limit=5000 en mapa, serializar el Place full sumaría ~3MB; el subset
    // pesa ~600KB.
    const mapPlaces = results.map((p) => ({
      id: p.id,
      slug: p.slug,
      comuna: p.comuna,
      comunaLabel: p.comunaLabel,
      name: p.name,
      rating: p.rating,
      isFeatured: p.isFeatured,
      coords: p.coords,
    }));
    return (
      <div className="fixed inset-0 flex flex-col overflow-hidden">
        <PlacesMap
          places={mapPlaces}
          userCoords={userCoords ?? undefined}
          className="map-fullscreen absolute inset-0 z-0"
        />

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
              <MapSearchInput
                initialValue={query}
                size="md"
                placeholder="busca región, comuna o local"
              />
            </div>
          </header>

          <div className="inline-flex w-full bg-white/95 backdrop-blur-sm border border-crema-edge rounded-full p-1 shadow pointer-events-auto">
            <Link
              href={buildToggleHref(sp, "lista")}
              className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-full px-3 py-2 text-sm transition-[transform,colors] duration-150 active:scale-[0.97] text-carbon hover:bg-crema-edge/40"
            >
              <IconList size={14} aria-hidden="true" /> lista
            </Link>
            <Link
              href={buildToggleHref(sp, "mapa")}
              aria-current="page"
              className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-full px-3 py-2 text-sm bg-carbon text-crema font-medium"
            >
              <IconMap size={14} aria-hidden="true" /> mapa
            </Link>
          </div>

          {/* Filtros sobre el mapa: solo strip de chips dentro del card, sin
              meta (el contador va flotando abajo, sort no se usa en mapa). */}
          <div className="pointer-events-auto bg-white/95 backdrop-blur-sm border border-crema-edge rounded-2xl px-3 py-2 shadow">
            <SearchFilters
              hasUserCoords={Boolean(userCoords)}
              resultsCount={results.length}
              bleed={false}
              hideMeta
            />
          </div>
        </div>

        <BottomNav />
      </div>
    );
  }

  // ============================================================================
  // Vista lista
  // ============================================================================
  return (
    <div className="flex flex-col min-h-screen pb-24">
      <header className="flex items-center gap-2 px-4 pt-3 pb-2">
        <Link
          href="/"
          aria-label="atrás"
          className="w-9 h-9 inline-flex items-center justify-center text-carbon hover:bg-crema-deep rounded-full transition-[transform,colors] duration-150 active:scale-90"
        >
          <IconArrowLeft size={18} />
        </Link>
        <div className="flex-1">
          <LiveSearchInput
            initialValue={query}
            size="md"
            placeholder="busca por barrio o nombre"
          />
        </div>
      </header>

      <section className="px-4 pb-3 pt-1">
        <div className="inline-flex w-full bg-crema-deep border border-crema-edge rounded-full p-1">
          <Link
            href={buildToggleHref(sp, "lista")}
            aria-current="page"
            className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-full px-3 py-2 text-sm bg-carbon text-crema font-medium"
          >
            <IconList size={14} aria-hidden="true" /> lista
          </Link>
          <Link
            href={buildToggleHref(sp, "mapa")}
            className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-full px-3 py-2 text-sm transition-[transform,colors] duration-150 active:scale-[0.97] text-carbon hover:bg-crema-edge/40"
          >
            <IconMap size={14} aria-hidden="true" /> mapa
          </Link>
        </div>
      </section>

      <section className="px-4 pb-3">
        <SearchFilters hasUserCoords={Boolean(userCoords)} resultsCount={results.length} />
      </section>

      {relatedPica && (
        <section className="px-4 pb-3">
          <Link
            href={`/picas/${relatedPica.slug}`}
            className="block bg-mostaza/10 border border-mostaza/30 rounded-2xl px-3 py-3 transition-[transform,colors] duration-150 active:scale-[0.99] hover:bg-mostaza/15"
          >
            <div className="flex items-center gap-3">
              <span className="w-9 h-9 rounded-xl bg-mostaza/20 inline-flex items-center justify-center text-mostaza shrink-0">
                <PicaIcon name={relatedPica.icon} size={18} />
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-[10px] uppercase tracking-wider text-bronceado font-medium">
                  lista relacionada
                </p>
                <p className="font-display font-semibold text-sm text-carbon truncate">
                  {relatedPica.title}
                </p>
                <p className="text-[11px] text-tinta-suave truncate">
                  {relatedPica.hook}
                </p>
              </div>
              <span className="text-mostaza font-medium text-sm shrink-0">ver →</span>
            </div>
          </Link>
        </section>
      )}

      {usedFuzzy && query && (
        <section className="px-4 pb-2">
          <div className="rounded-xl bg-mostaza/10 border border-mostaza/30 px-3 py-2 text-xs text-carbon">
            no encontramos <span className="font-semibold">«{query}»</span> exacto.
            estos son los más parecidos.
          </div>
        </section>
      )}

      <section className="px-4 flex flex-col gap-2 pb-6">
        {results.length === 0 ? (
          <EmptyState query={query} hasFilters={hasFilters} />
        ) : groups ? (
          groups.map((g, gi) => (
            <div key={g.key} className="flex flex-col gap-2">
              <h3 className="font-display font-semibold text-sm text-carbon mt-2 first:mt-0">
                {g.label}{" "}
                <span className="text-bronceado font-normal text-xs">({g.places.length})</span>
              </h3>
              {g.places.map((place, pi) => (
                <PlaceCard
                  key={place.id}
                  place={place}
                  variant="compact"
                  priority={gi === 0 && pi === 0}
                />
              ))}
            </div>
          ))
        ) : (
          results.map((place, i) => (
            <PlaceCard
              key={place.id}
              place={place}
              variant="compact"
              priority={i === 0}
            />
          ))
        )}
      </section>

      <div className="flex-1" />
      <BottomNav />
    </div>
  );
}

function EmptyState({ query, hasFilters }: { query: string; hasFilters: boolean }) {
  // Si hay filtros activos, ofrecemos limpiarlos preservando solo el texto.
  const clearHref = query ? `/buscar?q=${encodeURIComponent(query)}` : "/buscar";
  return (
    <div className="text-center py-12 text-tinta-suave">
      <p className="font-display font-semibold text-base text-carbon">
        {query ? `no encontramos «${query}»` : "no encontramos picás"}
      </p>
      <p className="text-xs mt-1">
        {hasFilters
          ? "tu búsqueda es muy específica. prueba quitar filtros o agrega la picá que falta."
          : "agrega la picá que falta y aparecerá apenas la revisemos"}
      </p>
      <div className="mt-4 flex items-center justify-center gap-2 flex-wrap">
        {hasFilters && (
          <Link
            href={clearHref}
            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full border border-crema-edge bg-white text-xs text-carbon hover:bg-crema-deep transition-colors"
          >
            quitar filtros
          </Link>
        )}
        <Link
          href="/agregar"
          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full bg-mostaza text-carbon text-xs font-medium hover:bg-mostaza-deep transition-colors"
        >
          agregar picá
        </Link>
      </div>
    </div>
  );
}

/**
 * Busca la primera lista curada cuyo title o hook contiene la query (normalizada
 * accent/case). Mínimo 3 chars para evitar que "el" o "la" matcheen cualquier cosa.
 */
function findRelatedPica(query: string): PicasList | undefined {
  const trimmed = query.trim();
  if (trimmed.length < 3) return undefined;
  const norm = normalizeForSearch(trimmed);
  return PICAS_LISTS.find(
    (l) =>
      normalizeForSearch(l.title).includes(norm) ||
      normalizeForSearch(l.hook).includes(norm),
  );
}

function csv(value: string | undefined): string[] {
  if (!value) return [];
  return value.split(",").map((s) => s.trim()).filter(Boolean);
}

function parseSort(value: string | undefined): "rating" | "recent" | "distance" | null {
  if (value === "rating" || value === "recent" || value === "distance") return value;
  return null;
}

// ============================================================================
// Helpers de agrupación
// ============================================================================

type Group = { key: string; label: string; places: import("@/types/place").Place[] };

function groupByDistanceBand(places: import("@/types/place").Place[]): Group[] {
  const buckets: Record<string, Group> = {
    near: { key: "near", label: "a pasos · menos de 1 km", places: [] },
    mid: { key: "mid", label: "vale el viaje · 1 — 5 km", places: [] },
    far: { key: "far", label: "si pasas por ahí · más de 5 km", places: [] },
    unknown: { key: "unknown", label: "más opciones", places: [] },
  };
  for (const p of places) {
    const d = p.distanceM;
    if (d === undefined) buckets.unknown!.places.push(p);
    else if (d < 1000) buckets.near!.places.push(p);
    else if (d < 5000) buckets.mid!.places.push(p);
    else buckets.far!.places.push(p);
  }
  return [buckets.near!, buckets.mid!, buckets.far!, buckets.unknown!].filter(
    (g) => g.places.length > 0,
  );
}

function groupByComuna(places: import("@/types/place").Place[]): Group[] {
  const map = new Map<string, Group>();
  for (const p of places) {
    const key = p.comuna;
    if (!map.has(key)) {
      map.set(key, { key, label: p.comunaLabel, places: [] });
    }
    map.get(key)!.places.push(p);
  }
  // Orden por cantidad descendente; comunas con más locales arriba.
  return [...map.values()].sort((a, b) => b.places.length - a.places.length);
}

function buildToggleHref(sp: SearchParams, vista: "lista" | "mapa") {
  // Mantiene q + filtros, cambia solo `vista`. Para `lista` omitimos `vista`
  // (default), para `mapa` lo seteamos.
  const next: Record<string, string> = {};
  if (sp.q) next.q = sp.q;
  if (sp.cocina) next.cocina = sp.cocina;
  if (sp.precio) next.precio = sp.precio;
  if (sp.abierto) next.abierto = sp.abierto;
  if (sp.orden) next.orden = sp.orden;
  if (vista === "mapa") next.vista = "mapa";
  return { pathname: "/buscar", query: next };
}
