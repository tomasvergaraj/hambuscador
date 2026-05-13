// ============================================================================
// Service de listas curadas (/picas/[slug]).
// Resuelve la criteria de PICAS_LISTS contra la DB usando searchPlaces como
// motor (sort=popularity por bayes rating).
// ============================================================================

import type { CuisineId, PriceRangeId } from "@/lib/constants";
import type { PicasList, PicasListCriteria } from "@/lib/picas";
import type { Place } from "@/types/place";
import { getActivePicasLists } from "./picas-lists";
import {
  getApprovedPlacesForPicasIndex,
  searchPlaces,
  type PlaceForPicasIndex,
} from "./places";

export async function getPlacesForPicasList(list: PicasList): Promise<Place[]> {
  const { items } = await searchPlaces({
    cuisines: list.criteria.cuisines,
    priceRanges: list.criteria.priceRanges,
    comunaSlug: list.criteria.comunaSlug,
    regionLabel: list.criteria.regionLabel,
    minBayesRating: list.criteria.minRating,
    approvedWithinDays: list.criteria.approvedWithinDays,
    openAfterHour: list.criteria.openAfterHour,
    sort: "popularity",
    limit: list.maxItems,
  });
  return items;
}

/**
 * Resuelve count + preview de cada lista para el index `/picas`.
 *
 * Antes corría ~32 queries paralelas (una `searchPlaces` por lista) con
 * cache 5min. Cold cache (deploy/revalidate) pegaba duro en TTFB. Ahora:
 *
 *   1) UNA sola query trae todos los aprobados pre-sorted por bayes DESC.
 *   2) JS filtra el array contra cada `PicasListCriteria` (~1500 places ×
 *      32 listas ≈ 48k iteraciones, instantáneo).
 *   3) Como el array viene pre-sorted, `filter()[0]` es ya el top del bayes.
 *
 * Trade-off: si el catálogo escala a 100k+ aprobados, este full-scan en JS
 * se vuelve caro y conviene volver a SQL con CTEs por lista. Por ahora vale.
 */
export async function getPicasListsWithCounts(): Promise<
  Array<{ list: PicasList; count: number; preview: Place | null }>
> {
  const [lists, all] = await Promise.all([
    getActivePicasLists(),
    getApprovedPlacesForPicasIndex(),
  ]);
  return lists.map((list) => {
    const matching = all.filter((p) => matchesCriteria(p, list.criteria));
    const top = matching[0];
    return {
      list,
      count: matching.length,
      preview: top ? stripIndexFields(top) : null,
    };
  });
}

function stripIndexFields(p: PlaceForPicasIndex): Place {
  // Quita campos internos antes de cruzar a la UI — mantiene `Place` estable.
  const { approvedAt: _approvedAt, bayesRating: _bayesRating, ...rest } = p;
  return rest;
}

function matchesCriteria(
  place: PlaceForPicasIndex,
  c: PicasListCriteria,
): boolean {
  if (c.cuisines && c.cuisines.length > 0) {
    const wanted = new Set<string>(c.cuisines as CuisineId[]);
    if (!place.cuisines.some((cu) => wanted.has(cu))) return false;
  }
  if (c.priceRanges && c.priceRanges.length > 0) {
    if (!(c.priceRanges as PriceRangeId[]).includes(place.priceRange))
      return false;
  }
  if (c.comunaSlug && place.comuna !== c.comunaSlug) return false;
  if (c.regionLabel && place.region !== c.regionLabel) return false;
  if (typeof c.minRating === "number" && place.bayesRating < c.minRating) {
    return false;
  }
  if (typeof c.approvedWithinDays === "number" && c.approvedWithinDays > 0) {
    if (!place.approvedAt) return false;
    const cutoff = Date.now() - c.approvedWithinDays * 86_400_000;
    if (place.approvedAt.getTime() < cutoff) return false;
  }
  if (c.openAfterHour && /^\d{2}:\d{2}$/.test(c.openAfterHour)) {
    const byDay = place.hours.byDay;
    if (!byDay) return false;
    const threshold = c.openAfterHour;
    const found = Object.values(byDay).some((v) => {
      if (!v) return false;
      const m = /^(\d{2}:\d{2})-(\d{2}:\d{2})$/.exec(v);
      if (!m) return false;
      const close = m[2]!;
      // Cierre después del threshold o wrap past midnight (close <= 05:59).
      return close >= threshold || close <= "05:59";
    });
    if (!found) return false;
  }
  return true;
}

export type { PicasList, PicasListCriteria };
