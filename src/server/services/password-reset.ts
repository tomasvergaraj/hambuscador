import bcrypt from "bcryptjs";
import { randomBytes } from "node:crypto";
import { and, eq, gt, isNull, sql } from "drizzle-orm";

import { getDb, isDbConfigured } from "@/server/db/client";
import { passwordResetTokens, users, type DbUser } from "@/server/db/schema";

// ============================================================================
// Servicio de recuperación de password
// ----------------------------------------------------------------------------
// Token = 32 bytes random hex (64 chars). TTL 1h. Single-use (used_at).
// La caller (server action) decide si manda email o no — este módulo solo
// administra el lifecycle del token y la mutación de la password.
// ============================================================================

const TOKEN_TTL_MS = 60 * 60 * 1000; // 1 hora
const BCRYPT_ROUNDS = 12;

/**
 * Crea un token de recuperación para el email dado. Si el email NO existe,
 * retorna null SILENCIOSAMENTE — la caller debe responder con el mismo
 * mensaje genérico para no permitir email enumeration.
 *
 * Si el email existe pero el usuario está baneado, también retorna null
 * (no le mandamos link ni indicamos por qué).
 */
export async function createPasswordResetToken(
  email: string,
): Promise<{ token: string; user: DbUser } | null> {
  if (!isDbConfigured()) return null;

  const normalized = email.trim().toLowerCase();
  const db = getDb();

  const [user] = await db.select().from(users).where(eq(users.email, normalized)).limit(1);
  if (!user) return null;
  if (user.bannedAt) return null;
  // Solo cuentas con password (las puramente OAuth no tienen contraseña que
  // resetear — el usuario debería loguearse con Google).
  if (!user.hashedPassword) return null;

  const token = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + TOKEN_TTL_MS);

  await db.insert(passwordResetTokens).values({
    token,
    userId: user.id,
    expiresAt,
  });

  return { token, user };
}

/**
 * Verifica que un token sea válido (existe, no expirado, no usado). Devuelve
 * el user asociado o null. Útil para la page del reset, que muestra el form
 * solo si el token está vivo.
 */
export async function verifyResetToken(token: string): Promise<DbUser | null> {
  if (!isDbConfigured()) return null;
  if (!token || token.length < 16) return null;

  const db = getDb();
  const [row] = await db
    .select({
      userId: passwordResetTokens.userId,
      usedAt: passwordResetTokens.usedAt,
      expiresAt: passwordResetTokens.expiresAt,
    })
    .from(passwordResetTokens)
    .where(eq(passwordResetTokens.token, token))
    .limit(1);

  if (!row) return null;
  if (row.usedAt) return null;
  if (row.expiresAt.getTime() < Date.now()) return null;

  const [user] = await db.select().from(users).where(eq(users.id, row.userId)).limit(1);
  if (!user || user.bannedAt) return null;
  return user;
}

export class InvalidResetTokenError extends Error {
  constructor() {
    super("El link de recuperación expiró o ya fue usado.");
    this.name = "InvalidResetTokenError";
  }
}

/**
 * Marca el token como usado y actualiza la password del usuario en una
 * transacción. Tira `InvalidResetTokenError` si el token no es válido.
 *
 * También invalida los demás tokens vivos del mismo user (no tiene sentido
 * dejar otros links válidos circulando después de un reset exitoso).
 */
export async function consumeResetTokenAndSetPassword(
  token: string,
  newPassword: string,
): Promise<void> {
  if (!isDbConfigured()) throw new Error("requiere DATABASE_URL");

  const db = getDb();
  const hashedPassword = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);

  await db.transaction(async (tx) => {
    // Atomic claim: solo seteamos used_at si todavía está vivo. RETURNING
    // para saber si efectivamente lo consumimos.
    const result = await tx
      .update(passwordResetTokens)
      .set({ usedAt: new Date() })
      .where(
        and(
          eq(passwordResetTokens.token, token),
          isNull(passwordResetTokens.usedAt),
          gt(passwordResetTokens.expiresAt, new Date()),
        ),
      )
      .returning({ userId: passwordResetTokens.userId });

    const claimed = result[0];
    if (!claimed) throw new InvalidResetTokenError();

    await tx
      .update(users)
      .set({ hashedPassword, updatedAt: new Date() })
      .where(eq(users.id, claimed.userId));

    // Invalida los demás tokens vivos del mismo user
    await tx.execute(sql`
      UPDATE password_reset_tokens
      SET used_at = NOW()
      WHERE user_id = ${claimed.userId}::uuid
        AND used_at IS NULL
        AND token <> ${token}
    `);
  });
}
