import { eq } from "drizzle-orm";

import { getDb, isDbConfigured } from "@/server/db/client";
import { places, promotions } from "@/server/db/schema";

import { createNotification } from "./notifications";

/**
 * Avisa al creador de una promo cuando admin la modera. Fire-and-forget:
 * el caller hace `.catch` así un fallo en la notif no rompe la moderación.
 *
 * Vive en su propio módulo (no en `promotions.ts`) pa que las pages que
 * solo necesitan queries de promotions (home, ficha, admin layout, mapa)
 * no arrastren al graph: notifications → push → web-push (Node-only).
 * Solo `admin/ofertas/actions.ts` importa este helper.
 *
 * Skip cases:
 * - promo no encontrada (admin race con delete).
 * - createdBy null (auto-creada por admin sin user attribution).
 * - createdBy === actorId (admin moderando promo que él mismo creó).
 */
export async function notifyCreatorOfPromotionDecision(input: {
  promoId: string;
  decision: "approved" | "rejected";
  actorId: string;
  reason?: string | null;
}): Promise<void> {
  if (!isDbConfigured()) return;
  const db = getDb();

  const [row] = await db
    .select({
      promoId: promotions.id,
      promoTitle: promotions.title,
      createdBy: promotions.createdBy,
      placeId: places.id,
      placeName: places.name,
      placeSlug: places.slug,
      comunaSlug: places.comunaSlug,
    })
    .from(promotions)
    .innerJoin(places, eq(places.id, promotions.placeId))
    .where(eq(promotions.id, input.promoId))
    .limit(1);

  if (!row) return;
  if (!row.createdBy) return;
  if (row.createdBy === input.actorId) return;

  if (input.decision === "approved") {
    await createNotification({
      userId: row.createdBy,
      type: "promotion_approved",
      payload: {
        promoId: row.promoId,
        promoTitle: row.promoTitle,
        placeId: row.placeId,
        placeName: row.placeName,
        placeSlug: row.placeSlug,
        comunaSlug: row.comunaSlug,
      },
    });
    return;
  }
  await createNotification({
    userId: row.createdBy,
    type: "promotion_rejected",
    payload: {
      promoId: row.promoId,
      promoTitle: row.promoTitle,
      placeId: row.placeId,
      placeName: row.placeName,
      placeSlug: row.placeSlug,
      comunaSlug: row.comunaSlug,
      reason: input.reason ?? null,
    },
  });
}
