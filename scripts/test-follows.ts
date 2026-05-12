/**
 * Test E2E del sistema de follows + notif new_follower.
 *
 * Casos:
 *   1. alice sigue a bob → bob recibe notif new_follower con payload
 *   2. counts: bob tiene 1 follower, alice sigue a 1
 *   3. follow idempotente: re-follow no crea fila duplicada ni segunda notif
 *   4. unfollow + re-follow: la segunda vez sí re-notifica (nueva inserción)
 *   5. auto-follow rechazado por CHECK constraint
 *   6. lista getFollowers/getFollowing retorna data correcta
 *
 * Run: pnpm tsx --env-file=.env.local scripts/test-follows.ts
 */
import { inArray, or } from "drizzle-orm";

import { closeDb, getDb } from "../src/server/db/client";
import { follows, notifications, users } from "../src/server/db/schema";
import {
  followUser,
  getFollowCounts,
  getFollowers,
  getFollowing,
  isFollowing,
  unfollowUser,
} from "../src/server/services/follows";
import { getNotificationsForUser } from "../src/server/services/notifications";

const TAG = `test-follow-${Date.now()}`;

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

  const [alice] = await db
    .insert(users)
    .values({
      email: `${TAG}-alice@test.local`,
      name: "Alice Test",
      username: `${TAG.replace(/[^a-z0-9_-]/g, "")}-alice`.slice(0, 30),
    })
    .returning();
  const [bob] = await db
    .insert(users)
    .values({
      email: `${TAG}-bob@test.local`,
      name: "Bob Test",
      username: `${TAG.replace(/[^a-z0-9_-]/g, "")}-bob`.slice(0, 30),
    })
    .returning();
  if (!alice || !bob) throw new Error("setup users");

  console.log(`✓ alice=${alice.id.slice(0, 8)} bob=${bob.id.slice(0, 8)}`);

  try {
    // ========================================================================
    // CASO 1 + 2: alice → bob, notif + counts
    // ========================================================================
    console.log("\n▸ alice sigue a bob");
    await followUser(alice.id, bob.id);
    await sleep(300); // notif fire-and-forget

    const isAliceFollowingBob = await isFollowing(alice.id, bob.id);
    assert(isAliceFollowingBob, "alice sigue a bob");

    const bobCounts = await getFollowCounts(bob.id);
    assert(bobCounts.followers === 1, `bob.followers = 1 (got ${bobCounts.followers})`);
    assert(bobCounts.following === 0, `bob.following = 0 (got ${bobCounts.following})`);

    const aliceCounts = await getFollowCounts(alice.id);
    assert(aliceCounts.following === 1, `alice.following = 1 (got ${aliceCounts.following})`);
    assert(aliceCounts.followers === 0, `alice.followers = 0 (got ${aliceCounts.followers})`);

    const bobFeed = await getNotificationsForUser(bob.id);
    assert(bobFeed.length === 1, `bob recibió 1 notif (got ${bobFeed.length})`);
    const notif = bobFeed[0]!;
    assert(notif.type === "new_follower", `type new_follower (got ${notif.type})`);
    const payload = notif.payload as Record<string, unknown>;
    assert(payload.followerId === alice.id, "payload.followerId correcto");
    assert(payload.followerName === "Alice Test", "payload.followerName correcto");

    // ========================================================================
    // CASO 3: re-follow no spam-notifica
    // ========================================================================
    console.log("\n▸ alice re-sigue a bob (idempotente)");
    await followUser(alice.id, bob.id);
    await sleep(300);
    const bobFeedAfterRefollow = await getNotificationsForUser(bob.id);
    assert(
      bobFeedAfterRefollow.length === 1,
      `bob sigue con 1 notif (no spam). got ${bobFeedAfterRefollow.length}`,
    );

    // ========================================================================
    // CASO 4: unfollow + re-follow sí re-notifica
    // ========================================================================
    console.log("\n▸ alice unfollow + re-follow");
    await unfollowUser(alice.id, bob.id);
    const stillFollowing = await isFollowing(alice.id, bob.id);
    assert(!stillFollowing, "tras unfollow, alice ya no sigue a bob");

    const bobCountsAfterUnfollow = await getFollowCounts(bob.id);
    assert(
      bobCountsAfterUnfollow.followers === 0,
      `bob.followers = 0 tras unfollow (got ${bobCountsAfterUnfollow.followers})`,
    );

    await followUser(alice.id, bob.id);
    await sleep(300);
    const bobFeedAfterReFollow = await getNotificationsForUser(bob.id);
    assert(
      bobFeedAfterReFollow.length === 2,
      `bob ahora tiene 2 notifs (re-follow re-notifica). got ${bobFeedAfterReFollow.length}`,
    );

    // ========================================================================
    // CASO 5: auto-follow rechazado
    // ========================================================================
    console.log("\n▸ alice intenta seguirse a sí misma");
    let threw = false;
    try {
      await followUser(alice.id, alice.id);
    } catch {
      threw = true;
    }
    assert(threw, "auto-follow rechazado");

    // ========================================================================
    // CASO 6: getFollowers / getFollowing
    // ========================================================================
    console.log("\n▸ listas getFollowers/getFollowing");
    const followers = await getFollowers(bob.id);
    assert(followers.length === 1, `bob.followers list len=1 (got ${followers.length})`);
    assert(followers[0]!.id === alice.id, "follower es alice");

    const following = await getFollowing(alice.id);
    assert(following.length === 1, `alice.following list len=1 (got ${following.length})`);
    assert(following[0]!.id === bob.id, "following es bob");

    console.log("\n✓ ALL TESTS PASSED");
  } finally {
    console.log("\n▸ Cleanup...");
    const ids = [alice.id, bob.id];
    await db.delete(notifications).where(inArray(notifications.userId, ids));
    await db.delete(follows).where(
      or(inArray(follows.followerId, ids), inArray(follows.followeeId, ids)),
    );
    await db.delete(users).where(inArray(users.id, ids));
    console.log("✓ cleanup completo");
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

