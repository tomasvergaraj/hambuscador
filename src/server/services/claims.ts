import { and, desc, eq, sql } from "drizzle-orm";

import { getDb, isDbConfigured } from "@/server/db/client";
import {
  placeClaims,
  places,
  users,
  type DbPlaceClaim,
  type NewDbPlaceClaim,
} from "@/server/db/schema";

// ============================================================================
// Place claims — flujo "este es mi local". User submite, admin aprueba.
// ============================================================================

export type ClaimWithContext = DbPlaceClaim & {
  placeName: string;
  placeComunaSlug: string;
  placeSlug: string;
  placeComunaLabel: string;
  userName: string | null;
  userEmail: string;
};

/**
 * Crea un claim pending. La app debe validar antes que no exista otro
 * pending del mismo (place, user) — esta función NO lo valida (ver
 * `hasPendingClaim`).
 */
export async function createClaim(input: {
  placeId: string;
  userId: string;
  contactEmail: string;
  contactPhone?: string | null;
  message?: string | null;
  proofUrl?: string | null;
}): Promise<DbPlaceClaim> {
  if (!isDbConfigured()) {
    throw new Error("createClaim requiere DATABASE_URL");
  }
  const db = getDb();
  const row: NewDbPlaceClaim = {
    placeId: input.placeId,
    userId: input.userId,
    contactEmail: input.contactEmail,
    contactPhone: input.contactPhone ?? null,
    message: input.message ?? null,
    proofUrl: input.proofUrl ?? null,
    status: "pending",
  };
  const [created] = await db.insert(placeClaims).values(row).returning();
  if (!created) throw new Error("INSERT no retornó fila");
  return created;
}

/**
 * ¿El user tiene un claim pending sobre este local? Para evitar dups.
 */
export async function hasPendingClaim(
  placeId: string,
  userId: string,
): Promise<boolean> {
  if (!isDbConfigured()) return false;
  const db = getDb();
  const [row] = await db
    .select({ id: placeClaims.id })
    .from(placeClaims)
    .where(
      and(
        eq(placeClaims.placeId, placeId),
        eq(placeClaims.userId, userId),
        eq(placeClaims.status, "pending"),
      ),
    )
    .limit(1);
  return Boolean(row);
}

/**
 * Lista de claims pending para el panel admin. Incluye nombre del local
 * y datos del user para evaluar sin tener que hacer N+1 queries en la UI.
 */
export async function getPendingClaims(): Promise<ClaimWithContext[]> {
  if (!isDbConfigured()) return [];
  const db = getDb();
  const rows = await db
    .select({
      claim: placeClaims,
      placeName: places.name,
      placeComunaSlug: places.comunaSlug,
      placeSlug: places.slug,
      placeComunaLabel: places.comunaLabel,
      userName: users.name,
      userEmail: users.email,
    })
    .from(placeClaims)
    .innerJoin(places, eq(places.id, placeClaims.placeId))
    .innerJoin(users, eq(users.id, placeClaims.userId))
    .where(eq(placeClaims.status, "pending"))
    .orderBy(placeClaims.createdAt);

  return rows.map((r) => ({
    ...r.claim,
    placeName: r.placeName,
    placeComunaSlug: r.placeComunaSlug,
    placeSlug: r.placeSlug,
    placeComunaLabel: r.placeComunaLabel,
    userName: r.userName,
    userEmail: r.userEmail,
  }));
}

export async function countPendingClaims(): Promise<number> {
  if (!isDbConfigured()) return 0;
  const db = getDb();
  const rows = await db.execute(
    sql`SELECT COUNT(*)::int AS count FROM place_claims WHERE status = 'pending'`,
  );
  const first = rows.rows[0] as { count?: number } | undefined;
  return first?.count ?? 0;
}

/**
 * Aprueba un claim:
 *  1. Marca el claim como approved + reviewedAt + reviewedBy.
 *  2. Setea places.claimedBy = claim.userId.
 *  3. Setea places.isVerified = true.
 *
 * Se ejecuta en transacción para que un fallo no deje estado inconsistente.
 */
export async function approveClaim(
  claimId: string,
  adminId: string,
): Promise<void> {
  if (!isDbConfigured()) {
    throw new Error("approveClaim requiere DATABASE_URL");
  }
  const db = getDb();
  await db.transaction(async (tx) => {
    const [claim] = await tx
      .select()
      .from(placeClaims)
      .where(eq(placeClaims.id, claimId))
      .limit(1);
    if (!claim) throw new Error("Claim no encontrado");
    if (claim.status !== "pending") throw new Error("El claim ya fue revisado");

    await tx
      .update(placeClaims)
      .set({
        status: "approved",
        reviewedAt: new Date(),
        reviewedBy: adminId,
      })
      .where(eq(placeClaims.id, claimId));

    await tx
      .update(places)
      .set({
        claimedBy: claim.userId,
        isVerified: true,
        updatedAt: new Date(),
      })
      .where(eq(places.id, claim.placeId));
  });
}

export async function rejectClaim(
  claimId: string,
  adminId: string,
  reason?: string | null,
): Promise<void> {
  if (!isDbConfigured()) {
    throw new Error("rejectClaim requiere DATABASE_URL");
  }
  const db = getDb();
  await db
    .update(placeClaims)
    .set({
      status: "rejected",
      reviewedAt: new Date(),
      reviewedBy: adminId,
      rejectionReason: reason ?? null,
    })
    .where(eq(placeClaims.id, claimId));
}

/**
 * ¿El user es owner verificado de este local? Permisos para editar.
 */
export async function isOwnerOf(
  userId: string,
  placeId: string,
): Promise<boolean> {
  if (!isDbConfigured()) return false;
  const db = getDb();
  const [row] = await db
    .select({ id: places.id })
    .from(places)
    .where(and(eq(places.id, placeId), eq(places.claimedBy, userId)))
    .limit(1);
  return Boolean(row);
}

/**
 * Lista de places que el user reclamó y fueron aprobados. Para mostrar
 * en /perfil un atajo "mis locales".
 */
export type MyPlaceItem = {
  id: string;
  name: string;
  slug: string;
  comunaSlug: string;
  comunaLabel: string;
  region: string;
};

export async function getMyOwnedPlaces(userId: string): Promise<MyPlaceItem[]> {
  if (!isDbConfigured()) return [];
  const db = getDb();
  const rows = await db
    .select({
      id: places.id,
      name: places.name,
      slug: places.slug,
      comunaSlug: places.comunaSlug,
      comunaLabel: places.comunaLabel,
      region: places.region,
    })
    .from(places)
    .where(eq(places.claimedBy, userId))
    .orderBy(desc(places.updatedAt));
  return rows;
}

/**
 * Lista de claims del user (cualquier estado), para que vea su historial
 * desde el perfil.
 */
export async function getMyClaims(userId: string): Promise<
  Array<DbPlaceClaim & { placeName: string; placeComunaSlug: string; placeSlug: string }>
> {
  if (!isDbConfigured()) return [];
  const db = getDb();
  const rows = await db
    .select({
      claim: placeClaims,
      placeName: places.name,
      placeComunaSlug: places.comunaSlug,
      placeSlug: places.slug,
    })
    .from(placeClaims)
    .innerJoin(places, eq(places.id, placeClaims.placeId))
    .where(eq(placeClaims.userId, userId))
    .orderBy(desc(placeClaims.createdAt));
  return rows.map((r) => ({
    ...r.claim,
    placeName: r.placeName,
    placeComunaSlug: r.placeComunaSlug,
    placeSlug: r.placeSlug,
  }));
}
