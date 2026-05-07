import type { Place, Review } from "@/types/place";

// ============================================================================
// Mock data — usado cuando no hay DATABASE_URL configurado.
// El proyecto arranca sin dependencias externas (`pnpm dev` y listo).
// Cuando se configura DB y se corre el seed, los servicios usan datos reales.
// ============================================================================

export const MOCK_PLACES: Place[] = [
  {
    id: "1",
    slug: "streat-burger",
    name: "Streat Burger",
    comuna: "providencia",
    comunaLabel: "Providencia",
    region: "Región Metropolitana",
    address: "Av. Italia 1234, Providencia",
    cuisines: ["smash", "artesanal"],
    specialty: "smash doble con tocino",
    priceRange: "$$",
    rating: 4.7,
    reviewCount: 234,
    status: "open",
    hours: { weekdays: "12:00 - 23:30", weekends: "12:00 - 00:00", byDay: null },
    coords: { lat: -33.4372, lng: -70.6178 },
    distanceM: 450,
    photos: [],
    phone: "+56 2 2345 6789",
    instagram: "streatburger",
    isVerified: true,
    isClaimed: true,
  },
  {
    id: "2",
    slug: "holy-moly-burger",
    name: "Holy Moly Burger",
    comuna: "nunoa",
    comunaLabel: "Ñuñoa",
    region: "Región Metropolitana",
    address: "Av. Irarrázaval 4567, Ñuñoa",
    cuisines: ["artesanal", "gourmet"],
    specialty: "burger trufada con queso azul",
    priceRange: "$$",
    rating: 4.5,
    reviewCount: 89,
    status: "closing-soon",
    hours: { weekdays: "13:00 - 22:00", weekends: "13:00 - 23:00", byDay: null },
    coords: { lat: -33.4567, lng: -70.5891 },
    distanceM: 1200,
    photos: [],
    instagram: "holymolyburger",
    isVerified: false,
    isClaimed: false,
  },
  {
    id: "3",
    slug: "la-burguesia",
    name: "La Burguesía",
    comuna: "providencia",
    comunaLabel: "Providencia",
    region: "Región Metropolitana",
    address: "Italia 890, Providencia",
    cuisines: ["smash", "artesanal"],
    specialty: "doble smash con cheddar añejo",
    priceRange: "$$",
    rating: 4.6,
    reviewCount: 156,
    status: "open",
    hours: { weekdays: "12:30 - 23:00", weekends: "12:30 - 23:30", byDay: null },
    coords: { lat: -33.4421, lng: -70.6201 },
    distanceM: 820,
    photos: [],
    isVerified: true,
    isClaimed: false,
  },
  {
    id: "4",
    slug: "bar-liguria-burger",
    name: "Bar Liguria Burger",
    comuna: "providencia",
    comunaLabel: "Providencia",
    region: "Región Metropolitana",
    address: "Pedro de Valdivia 047, Providencia",
    cuisines: ["clasica", "gourmet"],
    specialty: "la burger del Liguria con cebolla caramelizada",
    priceRange: "$$$",
    rating: 4.5,
    reviewCount: 412,
    status: "closing-soon",
    hours: { weekdays: "12:00 - 23:00", weekends: "12:00 - 02:00", byDay: null },
    coords: { lat: -33.4189, lng: -70.6109 },
    distanceM: 1450,
    photos: [],
    phone: "+56 2 2345 6790",
    isVerified: true,
    isClaimed: true,
  },
];

export const MOCK_REVIEWS: Review[] = [
  {
    id: "r1",
    placeId: "1",
    authorId: "u1",
    authorName: "Camila R.",
    authorInitials: "CR",
    rating: 5,
    ratingsByAspect: { comida: 5, atencion: 5, ambiente: 5 },
    text: "el cachetón clásico es brutal, papas crispy y atención top. picada confirmada.",
    photos: [],
    createdAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: "r2",
    placeId: "1",
    authorId: "u2",
    authorName: "Felipe G.",
    authorInitials: "FG",
    rating: 4,
    ratingsByAspect: { comida: 5, atencion: 4, ambiente: 4 },
    text: "la smash es de las mejores de Providencia. pero llegó un toque fría. de todas formas, vuelvo.",
    photos: [],
    createdAt: new Date(Date.now() - 12 * 24 * 60 * 60 * 1000).toISOString(),
  },
];

// ============================================================================
// Funciones de query mock (usan los arrays de arriba)
// ============================================================================

export function getPlacesNearbyMock(): Place[] {
  return [...MOCK_PLACES].sort((a, b) => (a.distanceM ?? 0) - (b.distanceM ?? 0));
}

export function getPlaceBySlugMock(comuna: string, slug: string): Place | null {
  return MOCK_PLACES.find((p) => p.comuna === comuna && p.slug === slug) ?? null;
}

export function getReviewsByPlaceIdMock(placeId: string): Review[] {
  return MOCK_REVIEWS.filter((r) => r.placeId === placeId);
}

export function searchPlacesMock(
  query: string,
  filters?: {
    cuisines?: string[];
    priceRanges?: string[];
    comunaSlug?: string;
    openNow?: boolean;
    sort?: "rating" | "recent" | "distance";
    userCoords?: { lat: number; lng: number };
  },
): { items: Place[]; usedFuzzy: boolean } {
  const q = query.toLowerCase().trim();

  // 1. Filtros duros.
  let result = MOCK_PLACES.filter((p) => {
    const matchesCuisine =
      !filters?.cuisines?.length ||
      p.cuisines.some((c) => filters.cuisines!.includes(c));
    const matchesPrice =
      !filters?.priceRanges?.length || filters.priceRanges.includes(p.priceRange);
    const matchesComuna = !filters?.comunaSlug || p.comuna === filters.comunaSlug;
    const matchesOpen =
      !filters?.openNow || p.status === "open" || p.status === "closing-soon";
    return matchesCuisine && matchesPrice && matchesComuna && matchesOpen;
  });

  // 2. Si hay query, scoring multi-campo igual que el SQL de prod.
  if (q) {
    const scored = result
      .map((p) => ({ p, score: scorePlaceMock(p, q) }))
      .filter((s) => s.score > 0)
      .sort((a, b) => b.score - a.score || b.p.rating - a.p.rating);
    return { items: scored.map((s) => s.p), usedFuzzy: false };
  }

  // 3. Sort default cuando no hay query.
  if (filters?.sort === "distance" && filters.userCoords) {
    const { lat, lng } = filters.userCoords;
    result = [...result].sort((a, b) => {
      const da = haversineM(lat, lng, a.coords.lat, a.coords.lng);
      const db = haversineM(lat, lng, b.coords.lat, b.coords.lng);
      return da - db;
    });
  } else if (filters?.sort === "recent") {
    result = [...result];
  } else {
    result = [...result].sort((a, b) => b.rating - a.rating);
  }

  return { items: result, usedFuzzy: false };
}

function scorePlaceMock(p: Place, q: string): number {
  const name = p.name.toLowerCase();
  const comuna = p.comunaLabel.toLowerCase();
  const specialty = (p.specialty ?? "").toLowerCase();
  const address = p.address.toLowerCase();
  let score = 0;
  if (name.startsWith(q)) score += 5;
  if (name.includes(q)) score += 3;
  if (p.cuisines.some((c) => c.toLowerCase().includes(q))) score += 2;
  if (specialty.includes(q)) score += 1.5;
  if (comuna.includes(q)) score += 1;
  if (address.includes(q)) score += 0.5;
  return score;
}

function haversineM(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}
