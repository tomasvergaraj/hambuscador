import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";

import { getDb, isDbConfigured } from "@/server/db/client";
import { users, type DbUser } from "@/server/db/schema";

// ============================================================================
// API pública del servicio de usuarios
// ----------------------------------------------------------------------------
// Se complementa con `@/server/auth` (Auth.js v5). Acá vive solo lo que toca
// la tabla `users` directamente: registro con password y lookups útiles.
// ============================================================================

const BCRYPT_ROUNDS = 12;

export class UserAlreadyExistsError extends Error {
  constructor(email: string) {
    super(`Ya existe una cuenta para ${email}`);
    this.name = "UserAlreadyExistsError";
  }
}

/**
 * Crea un usuario con email + password. La password se guarda hasheada
 * (bcrypt). Tira `UserAlreadyExistsError` si el email ya está registrado.
 *
 * No inicia sesión — eso lo hace la Server Action que llama después a
 * `signIn("credentials", ...)` con las mismas credenciales.
 */
export async function createUser(input: {
  name: string;
  email: string;
  password: string;
}): Promise<DbUser> {
  if (!isDbConfigured()) {
    throw new Error("createUser requiere DATABASE_URL — no se puede ejecutar en modo demo.");
  }

  const db = getDb();
  const email = input.email.trim().toLowerCase();

  const [existing] = await db.select().from(users).where(eq(users.email, email)).limit(1);
  if (existing) throw new UserAlreadyExistsError(email);

  const hashedPassword = await bcrypt.hash(input.password, BCRYPT_ROUNDS);

  const [row] = await db
    .insert(users)
    .values({
      name: input.name.trim(),
      email,
      hashedPassword,
    })
    .returning();

  if (!row) throw new Error("INSERT user no retornó fila");
  return row;
}

/**
 * Devuelve el usuario por id, o null si no existe. Útil para hidratar la
 * sesión en pages que necesitan más data que la del JWT.
 */
export async function getUserById(id: string): Promise<DbUser | null> {
  if (!isDbConfigured()) return null;
  const db = getDb();
  const [row] = await db.select().from(users).where(eq(users.id, id)).limit(1);
  return row ?? null;
}
