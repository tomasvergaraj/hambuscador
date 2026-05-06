import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * Combina clases de Tailwind con merge inteligente (resuelve conflictos).
 *
 * @example
 * cn("px-2 py-1", isActive && "bg-mostaza", className)
 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

/**
 * Slugify estilo Hambuscador: ASCII, lowercase, kebab-case, sin tildes ni ñ.
 *
 * @example
 * toSlug("Streat Burger Ñuñoa") // "streat-burger-nunoa"
 */
export function toSlug(input: string): string {
  return input
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // tildes
    .replace(/ñ/g, "n")
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
}

/**
 * Formatea distancia para mobile: 850 m, 1.2 km
 */
export function formatDistance(meters: number): string {
  if (meters < 1000) return `${Math.round(meters)} m`;
  return `${(meters / 1000).toFixed(1)} km`;
}

/**
 * Formatea cantidad de reseñas: 234 reseñas, 1 reseña
 */
export function formatReviewCount(count: number): string {
  if (count === 0) return "sin reseñas";
  if (count === 1) return "1 reseña";
  return `${count.toLocaleString("es-CL")} reseñas`;
}

/**
 * Iniciales de un nombre completo para el avatar (1 o 2 letras, mayúsculas).
 *
 * @example
 * initialsFromName("Camila Pérez") // "CP"
 * initialsFromName("juan")          // "J"
 */
export function initialsFromName(name: string): string {
  return (
    name
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((word) => word[0]?.toUpperCase() ?? "")
      .join("") || "?"
  );
}
