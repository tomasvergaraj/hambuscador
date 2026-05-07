import { defineConfig } from "drizzle-kit";

if (!process.env.DATABASE_URL) {
  // No tirar error duro: drizzle-kit se llama desde scripts pero también desde
  // el editor (drizzle-orm intelligence). Solo avisar.
  console.warn("[drizzle.config] DATABASE_URL no está seteado. Defínelo en .env.local");
}

export default defineConfig({
  schema: "./src/server/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL ?? "postgresql://hambuscador:hambuscador@localhost:5432/hambuscador",
  },
  extensionsFilters: ["postgis"],
  verbose: true,
  strict: true,
});
