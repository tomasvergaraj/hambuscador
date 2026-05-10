/**
 * Hambuscador — detector y merger de places duplicados
 *
 * Encuentra pares de places APROBADOS que probablemente sean el mismo local:
 *  - dentro de 80m geográficos
 *  - similitud de nombre > 0.5 (pg_trgm sobre f_unaccent(lower(...)))
 *
 * Ambas condiciones tienen que cumplirse — solo cerca o solo nombre similar
 * no alcanza (dos sucursales distintas, o dos locales con nombres parecidos
 * en barrios distintos no son dup).
 *
 * Modos:
 *   tsx scripts/dedupe-places.ts            # dry-run (default), solo imprime
 *   tsx scripts/dedupe-places.ts --apply    # ejecuta el merge
 *
 * Para cada par, se elige WINNER por prioridad descendente:
 *   1. claimed (owner verificado)
 *   2. verified
 *   3. más reseñas
 *   4. más fotos
 *   5. aprobado primero
 *
 * Merge:
 *   - reviews del loser cuyo autor NO reseñó al winner → UPDATE place_id
 *   - reviews que duplicarían el unique (author_id, place_id) → quedan en
 *     el loser y caen por cascade DELETE (la del winner gana, asumiendo
 *     que el usuario eligió reseñar la entrada "canónica")
 *   - favorites: INSERT...ON CONFLICT DO NOTHING (mover al winner sin colisión)
 *   - place_claims: UPDATE place_id (FK simple, sin unique)
 *   - DELETE loser → cascade limpia reviews/favorites residuales
 *   - recomputePlaceAggregates(winner)
 *
 * Procesa los pares iterativamente: si un loser de un par anterior fue
 * borrado, el siguiente par que lo nombre se skippea. Esto cubre clusters
 * de >2 duplicados (A≈B≈C → primero merge B en A, después C en A).
 */
import { sql } from "drizzle-orm";

import { closeDb, getDb } from "../src/server/db/client";
import { recomputePlaceAggregates } from "../src/server/services/places";

const APPLY = process.argv.includes("--apply");
const DIST_M = 80;
// Threshold de similitud (pg_trgm). Override via --min-sim 0.99 (más estricto,
// solo nombres casi idénticos) o --min-sim 0.3 (más laxo, incluye typos).
const SIM_MIN = (() => {
  const idx = process.argv.indexOf("--min-sim");
  if (idx === -1) return 0.5;
  const v = parseFloat(process.argv[idx + 1] ?? "");
  return Number.isFinite(v) ? v : 0.5;
})();

type CandidateRow = {
  a_id: string;
  a_name: string;
  a_comuna: string;
  a_reviews: number;
  a_photos: number;
  a_verified: boolean;
  a_claimed: boolean;
  a_approved_at: string | null;
  b_id: string;
  b_name: string;
  b_comuna: string;
  b_reviews: number;
  b_photos: number;
  b_verified: boolean;
  b_claimed: boolean;
  b_approved_at: string | null;
  dist_m: number;
  sim: number;
};

type PlaceCmp = {
  id: string;
  name: string;
  comuna: string;
  reviews: number;
  photos: number;
  verified: boolean;
  claimed: boolean;
  approvedAt: number; // epoch ms (0 si null)
};

function rowToPair(r: CandidateRow): { a: PlaceCmp; b: PlaceCmp; distM: number; sim: number } {
  return {
    a: {
      id: r.a_id,
      name: r.a_name,
      comuna: r.a_comuna,
      reviews: r.a_reviews ?? 0,
      photos: r.a_photos ?? 0,
      verified: r.a_verified,
      claimed: r.a_claimed,
      approvedAt: r.a_approved_at ? Date.parse(r.a_approved_at) : 0,
    },
    b: {
      id: r.b_id,
      name: r.b_name,
      comuna: r.b_comuna,
      reviews: r.b_reviews ?? 0,
      photos: r.b_photos ?? 0,
      verified: r.b_verified,
      claimed: r.b_claimed,
      approvedAt: r.b_approved_at ? Date.parse(r.b_approved_at) : 0,
    },
    distM: Number(r.dist_m),
    sim: Number(r.sim),
  };
}

function pickWinner(a: PlaceCmp, b: PlaceCmp): { winner: PlaceCmp; loser: PlaceCmp } {
  // Comparator: positivo si A gana, negativo si B gana.
  const cmp =
    (Number(a.claimed) - Number(b.claimed)) * 1_000_000 +
    (Number(a.verified) - Number(b.verified)) * 10_000 +
    (a.reviews - b.reviews) * 100 +
    (a.photos - b.photos) * 10 +
    // Aprobado antes gana (epoch menor → más viejo). Solo desempate fino.
    (a.approvedAt && b.approvedAt ? (b.approvedAt - a.approvedAt) / 1e12 : 0);
  if (cmp >= 0) return { winner: a, loser: b };
  return { winner: b, loser: a };
}

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error("DATABASE_URL no está seteado.");
    process.exit(1);
  }

  const db = getDb();

  console.log(`▸ Buscando pares (dist ≤ ${DIST_M}m, similitud nombre > ${SIM_MIN})...`);
  const result = await db.execute<CandidateRow>(sql`
    SELECT
      p1.id            AS a_id,
      p1.name          AS a_name,
      p1.comuna_label  AS a_comuna,
      p1.review_count  AS a_reviews,
      COALESCE(array_length(p1.photos, 1), 0) AS a_photos,
      p1.is_verified   AS a_verified,
      (p1.claimed_by IS NOT NULL) AS a_claimed,
      p1.approved_at   AS a_approved_at,
      p2.id            AS b_id,
      p2.name          AS b_name,
      p2.comuna_label  AS b_comuna,
      p2.review_count  AS b_reviews,
      COALESCE(array_length(p2.photos, 1), 0) AS b_photos,
      p2.is_verified   AS b_verified,
      (p2.claimed_by IS NOT NULL) AS b_claimed,
      p2.approved_at   AS b_approved_at,
      ST_Distance(p1.location, p2.location) AS dist_m,
      similarity(f_unaccent(lower(p1.name)), f_unaccent(lower(p2.name))) AS sim
    FROM places p1
    JOIN places p2 ON p1.id < p2.id
    WHERE p1.moderation_status = 'approved'
      AND p2.moderation_status = 'approved'
      AND ST_DWithin(p1.location, p2.location, ${DIST_M})
      AND similarity(f_unaccent(lower(p1.name)), f_unaccent(lower(p2.name))) > ${SIM_MIN}
    ORDER BY dist_m ASC, sim DESC
  `);

  const rows = result.rows as unknown as CandidateRow[];
  console.log(`▸ ${rows.length} par${rows.length === 1 ? "" : "es"} candidato${rows.length === 1 ? "" : "s"}.\n`);

  if (rows.length === 0) {
    await closeDb();
    return;
  }

  const dropped = new Set<string>();
  let merged = 0;

  for (const row of rows) {
    const { a, b, distM, sim } = rowToPair(row);

    if (dropped.has(a.id) || dropped.has(b.id)) {
      // Uno de los dos ya cayó en un merge anterior — skip
      continue;
    }

    const { winner, loser } = pickWinner(a, b);

    console.log(
      `• ${distM.toFixed(0).padStart(3)}m sim=${sim.toFixed(2)}  ` +
        `[${loser.comuna}] "${loser.name}" → "${winner.name}"`,
    );
    console.log(
      `    keep ${winner.id}  (rev=${winner.reviews} fotos=${winner.photos}` +
        `${winner.verified ? " verif" : ""}${winner.claimed ? " claimed" : ""})`,
    );
    console.log(
      `    drop ${loser.id}   (rev=${loser.reviews} fotos=${loser.photos}` +
        `${loser.verified ? " verif" : ""}${loser.claimed ? " claimed" : ""})`,
    );

    if (!APPLY) continue;

    // Merge en una transacción por par (si una falla, no deja huerfanos)
    await db.transaction(async (tx) => {
      // 1. Mover reviews del loser cuyo autor no reseñó al winner
      await tx.execute(sql`
        UPDATE reviews r
        SET place_id = ${winner.id}::uuid, updated_at = NOW()
        WHERE r.place_id = ${loser.id}::uuid
          AND NOT EXISTS (
            SELECT 1 FROM reviews r2
            WHERE r2.place_id = ${winner.id}::uuid AND r2.author_id = r.author_id
          )
      `);

      // 2. Mover favorites con dedup
      await tx.execute(sql`
        INSERT INTO favorites (user_id, place_id, created_at)
        SELECT user_id, ${winner.id}::uuid, created_at FROM favorites
        WHERE place_id = ${loser.id}::uuid
        ON CONFLICT DO NOTHING
      `);

      // 3. Reasignar claims (FK simple)
      await tx.execute(sql`
        UPDATE place_claims SET place_id = ${winner.id}::uuid
        WHERE place_id = ${loser.id}::uuid
      `);

      // 4. DELETE loser (cascade limpia reviews/favorites residuales)
      await tx.execute(sql`DELETE FROM places WHERE id = ${loser.id}::uuid`);
    });

    // 5. Recompute agregados del winner (fuera de la transacción está bien:
    //    es idempotente, y la query usa el estado committeado)
    await recomputePlaceAggregates(winner.id);

    dropped.add(loser.id);
    merged++;
  }

  console.log("");
  if (APPLY) {
    console.log(`✓ Merge completado: ${merged} duplicado${merged === 1 ? "" : "s"} eliminado${merged === 1 ? "" : "s"}.`);
  } else {
    console.log(`ℹ Dry-run. Para ejecutar: tsx scripts/dedupe-places.ts --apply`);
  }

  await closeDb();
}

main().catch((err) => {
  console.error("✗ Error:", err);
  process.exit(1);
});
