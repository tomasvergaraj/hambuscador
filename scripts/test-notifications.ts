/**
 * Test E2E del hook de notificaciones owner.
 *
 * Flow:
 *   1. crea owner + reviewer (users)
 *   2. crea place y lo asigna a owner via claimed_by
 *   3. reviewer crea reseña via createReview()
 *   4. verifica que existe una notification "review_on_owned_place" para owner
 *   5. verifica que reviewer NO recibe notif si reseña su propio local
 *   6. cleanup
 *
 * Run: pnpm tsx --env-file=.env.local scripts/test-notifications.ts
 */
import { eq } from "drizzle-orm";

import { closeDb, getDb } from "../src/server/db/client";
import { notifications, places, users } from "../src/server/db/schema";
import {
  countUnreadNotifications,
  getNotificationsForUser,
} from "../src/server/services/notifications";
import { createReview } from "../src/server/services/reviews";

const TAG = `test-notif-${Date.now()}`;

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) {
    console.error(`✗ FAIL: ${msg}`);
    process.exit(1);
  }
  console.log(`✓ ${msg}`);
}

async function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

async function main() {
  const db = getDb();

  console.log(`▸ Creando fixtures (tag: ${TAG})...`);

  const [owner] = await db
    .insert(users)
    .values({
      email: `${TAG}-owner@test.local`,
      name: "Dueña Test",
    })
    .returning();
  const [reviewer] = await db
    .insert(users)
    .values({
      email: `${TAG}-reviewer@test.local`,
      name: "Cliente Test",
    })
    .returning();
  if (!owner || !reviewer) throw new Error("setup users");

  const [place] = await db
    .insert(places)
    .values({
      slug: TAG,
      name: "Local de prueba",
      comunaSlug: "providencia",
      comunaLabel: "Providencia",
      region: "Región Metropolitana",
      address: "Av Falsa 123",
      lat: "-33.4244",
      lng: "-70.6122",
      cuisines: ["smash"],
      priceRange: "$$",
      moderationStatus: "approved",
      claimedBy: owner.id,
      isVerified: true,
    })
    .returning();
  if (!place) throw new Error("setup place");

  console.log(`✓ fixtures listas (owner=${owner.id.slice(0, 8)}, reviewer=${reviewer.id.slice(0, 8)}, place=${place.id.slice(0, 8)})`);

  try {
    // ========================================================================
    // CASO 1: reviewer != owner → notif al owner
    // ========================================================================
    console.log("\n▸ Caso 1: reviewer ≠ owner");
    await createReview({
      placeId: place.id,
      authorId: reviewer.id,
      rating: 5,
      text: "filete, una de las mejores que probé en mi vida. Volvería sí o sí.",
    });

    // Hook es fire-and-forget; le damos un tick para que termine.
    await sleep(300);

    const ownerFeed = await getNotificationsForUser(owner.id);
    assert(ownerFeed.length === 1, "owner recibió exactamente 1 notificación");
    const notif = ownerFeed[0]!;
    assert(notif.type === "review_on_owned_place", `type es review_on_owned_place (got ${notif.type})`);
    assert(notif.readAt === null, "notif está sin leer");

    const payload = notif.payload as Record<string, unknown>;
    assert(payload.placeId === place.id, "payload.placeId correcto");
    assert(payload.placeName === "Local de prueba", "payload.placeName correcto");
    assert(payload.rating === 5, "payload.rating correcto");
    assert(payload.reviewerName === "Cliente Test", "payload.reviewerName correcto");
    assert(
      typeof payload.snippet === "string" && (payload.snippet as string).startsWith("filete"),
      "payload.snippet capturó texto",
    );
    assert(
      typeof payload.reviewId === "string" && (payload.reviewId as string).length > 0,
      "payload.reviewId presente",
    );

    const unread = await countUnreadNotifications(owner.id);
    assert(unread === 1, `countUnread = 1 (got ${unread})`);

    // ========================================================================
    // CASO 2: owner reseña su propio local → NO genera notif (no auto-spam)
    // ========================================================================
    console.log("\n▸ Caso 2: owner reseña su propio local");
    await createReview({
      placeId: place.id,
      authorId: owner.id,
      rating: 4,
      text: "muy buen ambiente",
    });
    await sleep(300);

    const ownerFeedAfterSelf = await getNotificationsForUser(owner.id);
    assert(
      ownerFeedAfterSelf.length === 1,
      `owner sigue con 1 notif (no se auto-notifica). got ${ownerFeedAfterSelf.length}`,
    );

    // ========================================================================
    // CASO 3: place sin owner → no genera notif a nadie
    // ========================================================================
    console.log("\n▸ Caso 3: place sin owner (claimed_by null)");
    await db.update(places).set({ claimedBy: null }).where(eq(places.id, place.id));

    // Creo un tercer user que reseña el place ahora unclaimed
    const [stranger] = await db
      .insert(users)
      .values({
        email: `${TAG}-stranger@test.local`,
        name: "Random User",
      })
      .returning();
    if (!stranger) throw new Error("setup stranger");

    await createReview({
      placeId: place.id,
      authorId: stranger.id,
      rating: 3,
      text: "ok nomás",
    });
    await sleep(300);

    const ownerFeedAfterUnclaimed = await getNotificationsForUser(owner.id);
    assert(
      ownerFeedAfterUnclaimed.length === 1,
      `owner no recibe nueva notif tras unclaim. got ${ownerFeedAfterUnclaimed.length}`,
    );

    // ========================================================================
    // CASO 4: snippet truncado a 140 chars
    // ========================================================================
    console.log("\n▸ Caso 4: snippet truncado");
    // Re-asigno owner para probar trunc
    await db.update(places).set({ claimedBy: owner.id }).where(eq(places.id, place.id));
    // Borro review previa del stranger para poder re-reseñar
    const [stranger2] = await db
      .insert(users)
      .values({
        email: `${TAG}-stranger2@test.local`,
        name: "Otro User",
      })
      .returning();
    if (!stranger2) throw new Error("setup stranger2");

    const longText = "a".repeat(300);
    await createReview({
      placeId: place.id,
      authorId: stranger2.id,
      rating: 2,
      text: longText,
    });
    await sleep(300);

    const ownerFeedAfterLong = await getNotificationsForUser(owner.id);
    assert(ownerFeedAfterLong.length === 2, `owner ahora tiene 2 notifs (got ${ownerFeedAfterLong.length})`);
    const lastNotif = ownerFeedAfterLong[0]!;
    const lastPayload = lastNotif.payload as Record<string, unknown>;
    assert(
      typeof lastPayload.snippet === "string" && (lastPayload.snippet as string).length === 140,
      `snippet truncado a 140 (got ${(lastPayload.snippet as string).length})`,
    );

    console.log("\n✓ ALL TESTS PASSED");
  } finally {
    // Cleanup — borramos notifs y luego users+places (cascada)
    console.log("\n▸ Cleanup...");
    await db.delete(notifications).where(eq(notifications.userId, owner.id));
    await db.delete(places).where(eq(places.id, place.id));
    await db.delete(users).where(eq(users.id, owner.id));
    await db.delete(users).where(eq(users.id, reviewer.id));
    // Strangers via LIKE para no tener IDs guardados
    const dbRaw = await db.execute(
      `DELETE FROM users WHERE email LIKE '${TAG}-%@test.local' RETURNING email`,
    );
    console.log(`✓ cleanup completo (extras: ${dbRaw.rowCount ?? 0})`);
  }
}

main()
  .catch((err) => {
    console.error("✗ Test falló:", err);
    process.exit(1);
  })
  .finally(async () => {
    await closeDb();
  });
