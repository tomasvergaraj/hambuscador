import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

import * as schema from "./schema";

// ============================================================================
// Cliente Drizzle con lazy-init
// ----------------------------------------------------------------------------
// La conexión solo se establece la primera vez que se llama `getDb()`. Esto
// nos permite importar este archivo desde cualquier lado sin reventar si
// DATABASE_URL no está seteado (modo "demo" con mock data).
// ============================================================================

let _pool: Pool | null = null;
let _db: NodePgDatabase<typeof schema> | null = null;

export function isDbConfigured(): boolean {
  return !!process.env.DATABASE_URL;
}

export function getDb(): NodePgDatabase<typeof schema> {
  if (_db) return _db;

  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error(
      "DATABASE_URL no está seteado. Defínelo en .env.local o inicia el docker " +
        "compose con `pnpm db:up`.",
    );
  }

  _pool = new Pool({
    connectionString: url,
    // Pool conservador para serverless (Vercel). Si vamos a containers o
    // edge runtime hay que revisar.
    max: 10,
    idleTimeoutMillis: 30_000,
  });

  _db = drizzle(_pool, { schema });
  return _db;
}

/**
 * Cierra el pool. Solo necesario en scripts (seed, migrations) — en runtime
 * de Next.js el proceso se mantiene vivo.
 */
export async function closeDb(): Promise<void> {
  if (_pool) {
    await _pool.end();
    _pool = null;
    _db = null;
  }
}

// Re-exportar el schema para uso conveniente en las queries
export { schema };
