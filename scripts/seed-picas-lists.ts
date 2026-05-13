/**
 * Hambuscador — seed de listas curadas (`picas_lists`)
 *
 * Lee `PICAS_LISTS` hardcoded en `src/lib/picas.ts` y hace UPSERT en la tabla
 * `picas_lists`. Pensado para correr UNA vez después de aplicar
 * `drizzle/2026-05-13-picas-lists.sql`. Idempotente: `ON CONFLICT (slug)
 * DO NOTHING` preserva ediciones del admin si se re-corre.
 *
 * Uso:
 *   pnpm db:seed-picas
 *   o
 *   tsx scripts/seed-picas-lists.ts
 *
 * Después de correr esto, `getPicasListsFromDb()` (en services/picas-lists.ts)
 * leerá del DB. Si querés re-seedear con la versión hardcoded más reciente,
 * borrá las rows que querés refrescar y volvé a correr.
 */
import { sql } from "drizzle-orm";

import { PICAS_LISTS } from "../src/lib/picas";
import { closeDb, getDb } from "../src/server/db/client";
import { picasLists } from "../src/server/db/schema";

async function main() {
  const db = getDb();
  console.log(`[seed-picas] insertando ${PICAS_LISTS.length} listas…`);

  let inserted = 0;
  for (let i = 0; i < PICAS_LISTS.length; i++) {
    const list = PICAS_LISTS[i]!;
    const result = await db
      .insert(picasLists)
      .values({
        slug: list.slug,
        title: list.title,
        hook: list.hook,
        intro: list.intro,
        icon: list.icon,
        maxItems: list.maxItems,
        criteria: list.criteria,
        sortOrder: (i + 1) * 10,
        isActive: true,
      })
      .onConflictDoNothing({ target: picasLists.slug })
      .returning({ slug: picasLists.slug });

    if (result.length > 0) {
      inserted++;
      console.log(`  + ${list.slug}`);
    } else {
      console.log(`  · ${list.slug} (ya existe, skip)`);
    }
  }

  console.log(`[seed-picas] listo. nuevas: ${inserted} / ${PICAS_LISTS.length}.`);

  const totalRows = await db.execute(
    sql`SELECT COUNT(*)::int AS count FROM picas_lists`,
  );
  const total = (totalRows.rows[0] as { count?: number } | undefined)?.count ?? 0;
  console.log(`[seed-picas] total en DB: ${total}`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => closeDb());
