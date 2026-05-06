/**
 * Ejecuta un archivo .sql contra DATABASE_URL.
 * Uso: tsx scripts/run-sql.ts path/al/archivo.sql
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { Pool } from "pg";

async function main() {
  const file = process.argv[2];
  if (!file) {
    console.error("Falta el path al archivo SQL.");
    console.error("Uso: tsx scripts/run-sql.ts drizzle/postgis.sql");
    process.exit(1);
  }

  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error("DATABASE_URL no está seteado. ¿Olvidaste levantar `pnpm db:up`?");
    process.exit(1);
  }

  const sqlPath = resolve(process.cwd(), file);
  const sql = readFileSync(sqlPath, "utf8");

  const pool = new Pool({ connectionString: url });
  try {
    console.log(`▸ Ejecutando ${file}...`);
    const result = await pool.query(sql);
    if (Array.isArray(result)) {
      // múltiples statements
      const rowCount = result.reduce((sum, r) => sum + (r.rowCount ?? 0), 0);
      console.log(`✓ Ejecutado. ${rowCount} filas afectadas en total.`);
    } else if (result.rows.length > 0) {
      console.log(`✓ Ejecutado. Resultado:`);
      console.table(result.rows);
    } else {
      console.log(`✓ Ejecutado.`);
    }
  } catch (err) {
    console.error(`✗ Error ejecutando SQL:`, err);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

main();
