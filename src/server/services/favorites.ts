import { and, eq } from "drizzle-orm";

import { getDb, isDbConfigured } from "@/server/db/client";
import { favorites } from "@/server/db/schema";

// ============================================================================
// Servicio de favoritos
// ----------------------------------------------------------------------------
// La tabla `favorites` tiene PK compuesta (user_id, place_id) — eso garantiza
// que no podamos guardar un mismo favorito dos veces. `add` usa ON CONFLICT
// DO NOTHING para ser idempotente; `remove` simplemente borra y no falla si
// no existía.
// ============================================================================

/**
 * ¿El usuario tiene este local en favoritos?
 * Modo demo retorna false siempre.
 */
export async function isFavorite(userId: string, placeId: string): Promise<boolean> {
  if (!isDbConfigured()) return false;

  const db = getDb();
  const [row] = await db
    .select({ userId: favorites.userId })
    .from(favorites)
    .where(and(eq(favorites.userId, userId), eq(favorites.placeId, placeId)))
    .limit(1);

  return Boolean(row);
}

/**
 * Marca el local como favorito. Idempotente — si ya existe no falla.
 */
export async function addFavorite(userId: string, placeId: string): Promise<void> {
  if (!isDbConfigured()) {
    throw new Error("addFavorite requiere DATABASE_URL.");
  }

  const db = getDb();
  await db
    .insert(favorites)
    .values({ userId, placeId })
    .onConflictDoNothing({ target: [favorites.userId, favorites.placeId] });
}

/**
 * Quita el favorito. No falla si no existía.
 */
export async function removeFavorite(userId: string, placeId: string): Promise<void> {
  if (!isDbConfigured()) return;

  const db = getDb();
  await db
    .delete(favorites)
    .where(and(eq(favorites.userId, userId), eq(favorites.placeId, placeId)));
}
