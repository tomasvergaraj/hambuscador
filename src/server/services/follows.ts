import { and, desc, eq, isNull, sql } from "drizzle-orm";

import { getDb, isDbConfigured } from "@/server/db/client";
import { follows, users } from "@/server/db/schema";
import { createNotification } from "./notifications";

// ============================================================================
// API pública
// ============================================================================

export type PublicUserLite = {
  id: string;
  username: string | null;
  name: string;
  image: string | null;
  bio: string | null;
  reviewCount: number;
};

/**
 * El user `followerId` empieza a seguir a `followeeId`. Idempotente — si ya
 * existe el follow, no hace nada (ON CONFLICT DO NOTHING). Tira si los IDs
 * son iguales (el CHECK constraint lo rechaza también).
 *
 * Dispara notif `new_follower` al destinatario, fire-and-forget. Solo si el
 * insert efectivamente creó una nueva fila (evita spamear cuando alguien
 * unfollow + follow repetido).
 */
export async function followUser(
  followerId: string,
  followeeId: string,
): Promise<void> {
  if (!isDbConfigured()) throw new Error("followUser requiere DATABASE_URL");
  if (followerId === followeeId) throw new Error("no puedes seguirte a ti mismo");

  const db = getDb();

  // ON CONFLICT DO NOTHING via Drizzle: insert sin throw si ya existe.
  const inserted = await db
    .insert(follows)
    .values({ followerId, followeeId })
    .onConflictDoNothing()
    .returning();

  if (inserted.length === 0) return; // ya seguía — no re-notificar

  // Notif fire-and-forget. Cargamos data del follower para el payload.
  void (async () => {
    try {
      const [row] = await db
        .select({
          id: users.id,
          name: users.name,
          image: users.image,
          username: users.username,
          bannedAt: users.bannedAt,
        })
        .from(users)
        .where(eq(users.id, followerId))
        .limit(1);
      if (!row || row.bannedAt) return;

      await createNotification({
        userId: followeeId,
        type: "new_follower",
        payload: {
          followerId: row.id,
          followerName: row.name ?? "Anónimo",
          followerImage: row.image,
          followerUsername: row.username,
        },
      });
    } catch (err) {
      console.error("[followUser/notify]", err);
    }
  })();
}

/**
 * Quita el follow. Idempotente — si no había follow, no falla.
 */
export async function unfollowUser(
  followerId: string,
  followeeId: string,
): Promise<void> {
  if (!isDbConfigured()) return;
  const db = getDb();
  await db
    .delete(follows)
    .where(and(eq(follows.followerId, followerId), eq(follows.followeeId, followeeId)));
}

/**
 * True si followerId sigue a followeeId. Para el botón en /u/[username].
 */
export async function isFollowing(
  followerId: string,
  followeeId: string,
): Promise<boolean> {
  if (!isDbConfigured()) return false;
  if (followerId === followeeId) return false;
  const db = getDb();
  const [row] = await db
    .select({ followerId: follows.followerId })
    .from(follows)
    .where(and(eq(follows.followerId, followerId), eq(follows.followeeId, followeeId)))
    .limit(1);
  return !!row;
}

/**
 * Counts de followers + following para un user. Una sola query con dos
 * count() filtrados — más barato que dos round-trips.
 */
export async function getFollowCounts(
  userId: string,
): Promise<{ followers: number; following: number }> {
  if (!isDbConfigured()) return { followers: 0, following: 0 };
  const db = getDb();

  const [row] = await db
    .select({
      followers: sql<number>`COUNT(*) FILTER (WHERE ${follows.followeeId} = ${userId})::int`,
      following: sql<number>`COUNT(*) FILTER (WHERE ${follows.followerId} = ${userId})::int`,
    })
    .from(follows)
    .where(sql`${follows.followerId} = ${userId} OR ${follows.followeeId} = ${userId}`);

  return {
    followers: Number(row?.followers ?? 0),
    following: Number(row?.following ?? 0),
  };
}

/**
 * Lista de followers (los que siguen a `userId`). Excluye baneados.
 */
export async function getFollowers(
  userId: string,
  opts?: { limit?: number },
): Promise<PublicUserLite[]> {
  if (!isDbConfigured()) return [];
  const { limit = 100 } = opts ?? {};
  const db = getDb();

  const rows = await db
    .select({
      id: users.id,
      username: users.username,
      name: users.name,
      image: users.image,
      bio: users.bio,
      reviewCount: users.reviewCount,
      followedAt: follows.createdAt,
    })
    .from(follows)
    .innerJoin(users, eq(users.id, follows.followerId))
    .where(and(eq(follows.followeeId, userId), isNull(users.bannedAt)))
    .orderBy(desc(follows.createdAt))
    .limit(limit);

  return rows.map((r) => ({
    id: r.id,
    username: r.username,
    name: r.name ?? `@${r.username ?? "anon"}`,
    image: r.image,
    bio: r.bio,
    reviewCount: r.reviewCount,
  }));
}

/**
 * Lista de following (a quienes sigue `userId`). Excluye baneados.
 */
export async function getFollowing(
  userId: string,
  opts?: { limit?: number },
): Promise<PublicUserLite[]> {
  if (!isDbConfigured()) return [];
  const { limit = 100 } = opts ?? {};
  const db = getDb();

  const rows = await db
    .select({
      id: users.id,
      username: users.username,
      name: users.name,
      image: users.image,
      bio: users.bio,
      reviewCount: users.reviewCount,
      followedAt: follows.createdAt,
    })
    .from(follows)
    .innerJoin(users, eq(users.id, follows.followeeId))
    .where(and(eq(follows.followerId, userId), isNull(users.bannedAt)))
    .orderBy(desc(follows.createdAt))
    .limit(limit);

  return rows.map((r) => ({
    id: r.id,
    username: r.username,
    name: r.name ?? `@${r.username ?? "anon"}`,
    image: r.image,
    bio: r.bio,
    reviewCount: r.reviewCount,
  }));
}

