import { and, eq, sql } from "drizzle-orm";
import webpush from "web-push";

import { getDb, isDbConfigured } from "@/server/db/client";
import { pushSubscriptions } from "@/server/db/schema";

// ============================================================================
// VAPID setup — config lazy. Si las envs no están, sendPushToUser no envía
// (pero subscribe/unsubscribe siguen funcionando para no perder data del
// browser). Esto permite que el flujo de opt-in viva sin push real en dev.
// ============================================================================

let _configured = false;

function configureVapid(): boolean {
  if (_configured) return true;
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT;
  if (!publicKey || !privateKey || !subject) return false;
  webpush.setVapidDetails(subject, publicKey, privateKey);
  _configured = true;
  return true;
}

export function isPushConfigured(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY &&
      process.env.VAPID_PRIVATE_KEY &&
      process.env.VAPID_SUBJECT,
  );
}

// ============================================================================
// Subscribe / Unsubscribe
// ============================================================================

export type PushSubscriptionInput = {
  endpoint: string;
  keys: { p256dh: string; auth: string };
};

/**
 * Guarda una suscripción del browser. Upsert por endpoint — si el browser
 * re-suscribe (ej. cambió las keys), actualizamos en vez de fallar por
 * UNIQUE constraint.
 */
export async function savePushSubscription(input: {
  userId: string;
  sub: PushSubscriptionInput;
  userAgent: string | null;
}): Promise<void> {
  if (!isDbConfigured()) throw new Error("savePushSubscription requiere DATABASE_URL");

  const db = getDb();
  await db
    .insert(pushSubscriptions)
    .values({
      userId: input.userId,
      endpoint: input.sub.endpoint,
      p256dh: input.sub.keys.p256dh,
      auth: input.sub.keys.auth,
      userAgent: input.userAgent,
    })
    .onConflictDoUpdate({
      target: pushSubscriptions.endpoint,
      set: {
        userId: input.userId,
        p256dh: input.sub.keys.p256dh,
        auth: input.sub.keys.auth,
        userAgent: input.userAgent,
      },
    });
}

/**
 * Borra una sub por endpoint. Idempotente.
 */
export async function removePushSubscription(endpoint: string): Promise<void> {
  if (!isDbConfigured()) return;
  const db = getDb();
  await db.delete(pushSubscriptions).where(eq(pushSubscriptions.endpoint, endpoint));
}

/**
 * Borra todas las subs del usuario — para "desactivar push" desde /perfil.
 */
export async function removeAllPushSubscriptionsForUser(userId: string): Promise<void> {
  if (!isDbConfigured()) return;
  const db = getDb();
  await db.delete(pushSubscriptions).where(eq(pushSubscriptions.userId, userId));
}

/**
 * True si el user tiene al menos una sub activa.
 */
export async function userHasPushSubscriptions(userId: string): Promise<boolean> {
  if (!isDbConfigured()) return false;
  const db = getDb();
  const [row] = await db
    .select({ id: pushSubscriptions.id })
    .from(pushSubscriptions)
    .where(eq(pushSubscriptions.userId, userId))
    .limit(1);
  return !!row;
}

// ============================================================================
// Send
// ============================================================================

export type PushPayload = {
  title: string;
  body?: string;
  url?: string;
  icon?: string;
  badge?: string;
  tag?: string;
};

/**
 * Manda un push a todas las subs del user. Fire-and-forget en el caller —
 * fallos individuales (sub expirada, 410 Gone) hacen cleanup automático
 * pero no rompen el flow.
 */
export async function sendPushToUser(
  userId: string,
  payload: PushPayload,
): Promise<void> {
  if (!isDbConfigured()) return;
  if (!configureVapid()) {
    // Sin VAPID configurada no hay manera de firmar — log y salir.
    return;
  }

  const db = getDb();
  const subs = await db
    .select()
    .from(pushSubscriptions)
    .where(eq(pushSubscriptions.userId, userId));

  if (subs.length === 0) return;

  const body = JSON.stringify(payload);

  // Mandamos en paralelo. Las que fallen con 410/404 se eliminan; otras
  // errores se logean pero no rompen el resto.
  await Promise.all(
    subs.map(async (s) => {
      try {
        await webpush.sendNotification(
          {
            endpoint: s.endpoint,
            keys: { p256dh: s.p256dh, auth: s.auth },
          },
          body,
          { TTL: 60 * 60 * 24 }, // 1 día — coherente con el digest pull
        );
        // Touch last_used_at — métrica útil para detectar subs zombies.
        await db
          .update(pushSubscriptions)
          .set({ lastUsedAt: sql`now()` })
          .where(and(eq(pushSubscriptions.id, s.id)));
      } catch (err: unknown) {
        const statusCode =
          err && typeof err === "object" && "statusCode" in err
            ? (err as { statusCode: number }).statusCode
            : undefined;
        if (statusCode === 404 || statusCode === 410) {
          // Sub muerta — limpiar.
          await db
            .delete(pushSubscriptions)
            .where(eq(pushSubscriptions.id, s.id))
            .catch(() => {});
        } else {
          console.error("[sendPushToUser]", { endpoint: s.endpoint, err });
        }
      }
    }),
  );
}
