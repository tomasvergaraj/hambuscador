import type { CuisineId, DayKey, PriceRangeId, PlaceStatus, ReviewAspectId } from "@/lib/constants";

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
    weekdays: string; // resumen legacy "12:00 - 23:30"
    weekends: string;
    /**
     * Map por día (lun..dom): "HH:MM-HH:MM" o `null` (cerrado) si está
     * presente en DB. `null` el día completo cuando no se completó el
     * formulario por día (locales legacy o seed).
     */
    byDay: Partial<Record<DayKey, string | null>> | null;
  };
  coords: { lat: number; lng: number };
  distanceM?: number; // distance del usuario, calculada en runtime
  photos: string[]; // URLs absolutas (TODO Fase 2: integrar storage)
  phone?: string;
  whatsapp?: string;
  instagram?: string;
  website?: string;
  isVerified: boolean;
  /** Local destacado por publicidad — pin diferenciado en mapa. Solo admin lo togglea. */
  isFeatured: boolean;
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
  /** Username público del autor para linkear a `/u/<username>`. null si el
   * autor todavía no eligió uno. */
  authorUsername: string | null;
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
