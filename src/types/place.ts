import type { CuisineId, PriceRangeId, PlaceStatus, ReviewAspectId } from "@/lib/constants";

// ============================================================================
// Place (hamburguesería)
// ============================================================================

export type Place = {
  id: string;
  slug: string;
  name: string;
  comuna: string; // slug de la comuna (ej. "providencia")
  comunaLabel: string; // legible (ej. "Providencia")
  region: string; // legible (ej. "Región Metropolitana")
  address: string;
  cuisines: CuisineId[];
  specialty: string | null;
  priceRange: PriceRangeId;
  rating: number; // 0..5
  reviewCount: number;
  status: PlaceStatus;
  hours: {
    weekdays: string; // "12:00 - 23:30"
    weekends: string;
  };
  coords: { lat: number; lng: number };
  distanceM?: number; // distance del usuario, calculada en runtime
  photos: string[]; // URLs absolutas (TODO Fase 2: integrar storage)
  phone?: string;
  instagram?: string;
  isVerified: boolean;
  isClaimed: boolean; // dueño reclamó la ficha
  ratingsByAspect?: Record<ReviewAspectId, number>;
};

// ============================================================================
// Review
// ============================================================================

export type Review = {
  id: string;
  placeId: string;
  authorId: string;
  authorName: string;
  authorInitials: string;
  rating: number; // 1..5
  ratingsByAspect: Record<ReviewAspectId, number>;
  text: string | null;
  photos: string[];
  createdAt: string; // ISO
};

// ============================================================================
// User
// ============================================================================

export type User = {
  id: string;
  username: string;
  displayName: string;
  initials: string;
  avatarUrl?: string;
  reviewCount: number;
  joinedAt: string;
};
