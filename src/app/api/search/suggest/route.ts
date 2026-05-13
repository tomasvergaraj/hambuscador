// ============================================================================
// /api/search/suggest — sugerencias para el dropdown del input de búsqueda.
// ----------------------------------------------------------------------------
// Devuelve 4 secciones para que el dropdown agrupe entry-points distintos:
//   - places   → top hits (delega en searchPlaces; relevancia + bayes)
//   - picas    → listas curadas cuyo title/hook contiene la query
//   - comunas  → comunas registradas que matchean por label
//   - regions  → regiones registradas (centroide + zoom para flyTo en mapa)
//
// Diseñado para ser barato: limit chico, normalización en JS para picas/
// comunas/regions (sets hardcoded), y la única consulta a DB es la de places —
// que ya cachea en el data layer.
//
// Las coords (lat/lng + zoom) se incluyen en places/comunas/regions para que
// el caller de mapa pueda hacer `map.flyTo` sin un round-trip extra.
// ============================================================================

import { NextResponse, type NextRequest } from "next/server";

import {
  getActiveComunas,
  getActivePicasLists,
  getActiveRegions,
  searchPlaces,
  searchPublicUsers,
} from "@/lib/data";
import { normalizeForSearch } from "@/lib/search";

export const runtime = "nodejs";

const EMPTY = { places: [], picas: [], comunas: [], regions: [], users: [] };

export async function GET(req: NextRequest) {
  const q = (req.nextUrl.searchParams.get("q") ?? "").trim();
  if (q.length < 2) {
    return NextResponse.json(EMPTY, {
      headers: { "Cache-Control": "no-store" },
    });
  }

  const normalized = normalizeForSearch(q);

  const { items: placeItems } = await searchPlaces(q);

  const places = placeItems.slice(0, 5).map((p) => ({
    id: p.id,
    name: p.name,
    comuna: p.comuna,
    comunaLabel: p.comunaLabel,
    slug: p.slug,
    rating: p.rating,
    reviewCount: p.reviewCount,
    isVerified: p.isVerified,
    lat: p.coords.lat,
    lng: p.coords.lng,
  }));

  const activePicas = await getActivePicasLists();
  const picas = activePicas
    .filter((l) => {
      const title = normalizeForSearch(l.title);
      const hook = normalizeForSearch(l.hook);
      return title.includes(normalized) || hook.includes(normalized);
    })
    .slice(0, 3)
    .map((l) => ({ slug: l.slug, title: l.title, icon: l.icon }));

  const activeComunas = await getActiveComunas();
  const comunas = activeComunas
    .filter((c) => normalizeForSearch(c.label).includes(normalized))
    .slice(0, 4)
    .map((c) => ({
      slug: c.slug,
      label: c.label,
      lat: c.lat,
      lng: c.lng,
    }));

  const activeRegions = await getActiveRegions();
  const regions = activeRegions
    .filter((r) => normalizeForSearch(r.label).includes(normalized))
    .slice(0, 3)
    .map((r) => ({
      slug: r.slug,
      label: r.label,
      lat: r.lat,
      lng: r.lng,
      zoom: r.zoom,
    }));

  const users = await searchPublicUsers(q);

  return NextResponse.json(
    { places, picas, comunas, regions, users },
    { headers: { "Cache-Control": "no-store" } },
  );
}
