// ============================================================================
// Data layer (public API que consumen las pages)
// ----------------------------------------------------------------------------
// Este archivo es la fachada que usan las pages. Internamente delega en los
// services del server (`src/server/services/*`), que a su vez consultan la
// DB cuando DATABASE_URL está seteado o caen al mock cuando no.
//
// Las pages importan de aquí (no de `@/server/services/*`) porque acá podemos
// poner caching de Next.js, revalidation tags, etc. en una sola capa.
//
// Convención: TODAS las funciones son async — incluso las que internamente
// no necesitan await en modo mock — para mantener una API uniforme.
// ============================================================================

import { unstable_cache as cache } from "next/cache";

import {
  getPlaceBySlug as getPlaceBySlugSvc,
  getPlacesNearby as getPlacesNearbySvc,
  getRecentlyApprovedPlaces as getRecentlyApprovedPlacesSvc,
  searchPlaces as searchPlacesSvc,
} from "@/server/services/places";
import {
  getPlacesForPicasList as getPlacesForPicasListSvc,
  getPicasListsWithCounts as getPicasListsWithCountsSvc,
} from "@/server/services/picas";
import { getReviewsByPlaceId as getReviewsByPlaceIdSvc } from "@/server/services/reviews";
import {
  MOCK_PLACES,
  MOCK_REVIEWS,
  getPlaceBySlugMock,
  getPlacesNearbyMock,
  getReviewsByPlaceIdMock,
  searchPlacesMock,
} from "@/server/services/mock";

// ============================================================================
// Wrappers públicos (lo que las pages importan)
// ============================================================================

/**
 * Locales cerca del usuario, ordenados por distancia.
 * Cuando no hay coords del usuario aún, ordena por rating.
 */
export const getPlacesNearby = cache(
  async (opts?: { lat?: number; lng?: number; radiusM?: number; limit?: number }) => {
    return getPlacesNearbySvc(opts);
  },
  ["places-nearby"],
  { revalidate: 60, tags: ["places"] },
);

/**
 * Ficha pública por (comuna, slug). El "endpoint" de SEO.
 */
export const getPlaceBySlug = cache(
  async (comuna: string, slug: string) => {
    return getPlaceBySlugSvc(comuna, slug);
  },
  ["place-by-slug"],
  { revalidate: 300, tags: ["places"] },
);

/**
 * Búsqueda con texto libre + filtros. Retorna `{ items, usedFuzzy }`.
 * Caching más corto porque el query space es grande.
 */
export const searchPlaces = cache(
  async (
    query: string,
    filters?: {
      cuisines?: string[];
      priceRanges?: string[];
      comunaSlug?: string;
      openNow?: boolean;
      sort?: "rating" | "recent" | "distance";
      userCoords?: { lat: number; lng: number };
    },
  ) => {
    return searchPlacesSvc({
      query,
      cuisines: filters?.cuisines,
      priceRanges: filters?.priceRanges,
      comunaSlug: filters?.comunaSlug,
      openNow: filters?.openNow,
      sort: filters?.sort,
      userCoords: filters?.userCoords,
    });
  },
  ["places-search"],
  { revalidate: 30, tags: ["places"] },
);

/**
 * Locales recién aprobados (default últimos 14d). Para sección "recién agregadas"
 * en el home. Cache corta porque el set rota seguido.
 */
export const getRecentlyApprovedPlaces = cache(
  async (limit?: number) => {
    return getRecentlyApprovedPlacesSvc({ limit });
  },
  ["places-recent"],
  { revalidate: 120, tags: ["places"] },
);

/**
 * Picas (listas curadas) — resolución de criteria → places ordenados por popularidad.
 * Cache larga porque las listas son hardcoded y los places cambian poco.
 */
export const getPlacesForPicasList = cache(
  async (slug: string) => {
    const { getPicasListBySlug } = await import("@/lib/picas");
    const list = getPicasListBySlug(slug);
    if (!list) return null;
    const places = await getPlacesForPicasListSvc(list);
    return { list, places };
  },
  ["picas-list-by-slug"],
  { revalidate: 300, tags: ["places"] },
);

export const getPicasListsWithCounts = cache(
  async () => getPicasListsWithCountsSvc(),
  ["picas-lists-counts"],
  { revalidate: 300, tags: ["places"] },
);

/**
 * Reseñas de un local, más recientes primero.
 */
export const getReviewsByPlaceId = cache(
  async (placeId: string) => {
    return getReviewsByPlaceIdSvc(placeId);
  },
  ["reviews-by-place"],
  { revalidate: 30, tags: ["reviews"] },
);

// ============================================================================
// Re-exportar mocks para tests / seed / debugging
// ============================================================================

export {
  MOCK_PLACES,
  MOCK_REVIEWS,
  getPlacesNearbyMock,
  getPlaceBySlugMock,
  getReviewsByPlaceIdMock,
  searchPlacesMock,
};
