// ============================================================================
// Service de listas curadas (/picas/[slug]).
// Resuelve la criteria de PICAS_LISTS contra la DB usando searchPlaces como
// motor (sort=popularity por bayes rating).
// ============================================================================

import {
  getPicasListBySlug,
  type PicasList,
  type PicasListCriteria,
} from "@/lib/picas";
import type { Place } from "@/types/place";
import { searchPlaces } from "./places";

export async function getPlacesForPicasList(list: PicasList): Promise<Place[]> {
  const { items } = await searchPlaces({
    cuisines: list.criteria.cuisines,
    priceRanges: list.criteria.priceRanges,
    comunaSlug: list.criteria.comunaSlug,
    minBayesRating: list.criteria.minRating,
    approvedWithinDays: list.criteria.approvedWithinDays,
    sort: "popularity",
    limit: list.maxItems,
  });
  return items;
}

/**
 * Carga, en una sola pasada, los conteos de places que matchean cada lista.
 * Útil para el index `/picas` (badge "X picás" en la tarjeta).
 */
export async function getPicasListsWithCounts(): Promise<
  Array<{ list: PicasList; count: number; preview: Place | null }>
> {
  const { PICAS_LISTS } = await import("@/lib/picas");
  return Promise.all(
    PICAS_LISTS.map(async (list) => {
      const places = await getPlacesForPicasList(list);
      return {
        list,
        count: places.length,
        preview: places[0] ?? null,
      };
    }),
  );
}

export function picasListBySlug(slug: string): PicasList | undefined {
  return getPicasListBySlug(slug);
}

export type { PicasList, PicasListCriteria };
