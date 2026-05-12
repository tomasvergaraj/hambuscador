import { and, count, desc, eq, isNull, sql } from "drizzle-orm";

import { getDb, isDbConfigured } from "@/server/db/client";
import {
  notifications,
  type DbNotification,
  type NotificationType,
} from "@/server/db/schema";

// ============================================================================
// Payload shapes — un type por NotificationType. JSONB en DB es Record<string,
// unknown>; estos types tipan el handoff entre el creator y el reader.
// ============================================================================

export type ReviewOnOwnedPlacePayload = {
  placeId: string;
  placeName: string;
  placeSlug: string;
  comunaSlug: string;
  reviewId: string;
  rating: number;
  reviewerName: string;
  reviewerImage: string | null;
  reviewerUsername: string | null;
  snippet: string | null;
};

export type NewFollowerPayload = {
  followerId: string;
  followerName: string;
  followerImage: string | null;
  followerUsername: string | null;
};

export type NotificationPayloadMap = {
  review_on_owned_place: ReviewOnOwnedPlacePayload;
  new_follower: NewFollowerPayload;
};

export type NotificationItem<T extends NotificationType = NotificationType> = {
  id: string;
  type: T;
  payload: NotificationPayloadMap[T];
  readAt: Date | null;
  createdAt: Date;
};

// ============================================================================
// API pública
// ============================================================================

/**
 * Crea una notificación. Fire-and-forget desde el caller — el .catch en el
 * llamador absorbe errores para que un fallo de logging no rompa la mutación
 * principal (ej. si createReview fall escribiendo la notif, la reseña ya
 * está creada y eso es lo que importa).
 */
export async function createNotification<T extends NotificationType>(input: {
  userId: string;
  type: T;
  payload: NotificationPayloadMap[T];
}): Promise<DbNotification | null> {
  if (!isDbConfigured()) return null;
  const db = getDb();
  const [row] = await db
    .insert(notifications)
    .values({
      userId: input.userId,
      type: input.type,
      payload: input.payload as Record<string, unknown>,
    })
    .returning();
  return row ?? null;
}

/**
 * Feed de notificaciones del user, más recientes primero. Sin cursor por
 * ahora — el límite de 50 es razonable para un MVP. Cuando un owner reciba
 * cientos, agregamos cursor pagination.
 */
export async function getNotificationsForUser(
  userId: string,
  opts?: { limit?: number },
): Promise<NotificationItem[]> {
  if (!isDbConfigured()) return [];
  const { limit = 50 } = opts ?? {};
  const db = getDb();
  const rows = await db
    .select()
    .from(notifications)
    .where(eq(notifications.userId, userId))
    .orderBy(desc(notifications.createdAt))
    .limit(limit);

  return rows.map((row) => ({
    id: row.id,
    type: row.type as NotificationType,
    payload: row.payload as NotificationPayloadMap[NotificationType],
    readAt: row.readAt,
    createdAt: row.createdAt,
  }));
}

/**
 * Count de no leídas. Cubierto por el índice parcial — se mantiene cheap
 * incluso cuando el feed total crece.
 */
export async function countUnreadNotifications(userId: string): Promise<number> {
  if (!isDbConfigured()) return 0;
  const db = getDb();
  const [row] = await db
    .select({ n: count() })
    .from(notifications)
    .where(and(eq(notifications.userId, userId), isNull(notifications.readAt)));
  return Number(row?.n ?? 0);
}

/**
 * Marca una notificación como leída. Solo el destinatario puede marcarla.
 * Idempotente (un segundo call no falla aunque ya esté leída).
 */
export async function markNotificationRead(
  notificationId: string,
  userId: string,
): Promise<void> {
  if (!isDbConfigured()) return;
  const db = getDb();
  await db
    .update(notifications)
    .set({ readAt: sql`COALESCE(${notifications.readAt}, now())` })
    .where(and(eq(notifications.id, notificationId), eq(notifications.userId, userId)));
}

/**
 * Marca todo el feed del user como leído. Disparada al abrir
 * `/perfil/notificaciones` para que el badge se vacíe.
 */
export async function markAllNotificationsRead(userId: string): Promise<void> {
  if (!isDbConfigured()) return;
  const db = getDb();
  await db
    .update(notifications)
    .set({ readAt: sql`now()` })
    .where(and(eq(notifications.userId, userId), isNull(notifications.readAt)));
}
