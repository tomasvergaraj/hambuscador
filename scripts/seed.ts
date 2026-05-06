/**
 * Hambuscador — seed de Quillota
 *
 * Inserta ~12 hamburgueserías de Quillota (ficticias pero plausibles) y
 * 1 usuario de test con un par de reseñas. La idea es tener data viva
 * para desarrollar contra una DB real.
 *
 * TODO Fase 2.5: reemplazar este seed por un script que importe locales
 * reales scrapeados desde Google Maps (Quillota tiene ~30-40 lugares
 * con "burger" en el nombre o categoría).
 *
 * Uso:
 *   pnpm db:seed
 *   o
 *   tsx scripts/seed.ts
 */
import bcrypt from "bcryptjs";

import { closeDb, getDb } from "../src/server/db/client";
import { places, reviews, users } from "../src/server/db/schema";
import { recomputePlaceAggregates } from "../src/server/services/places";

const QUILLOTA = {
  comunaSlug: "quillota",
  comunaLabel: "Quillota",
  region: "Región de Valparaíso",
};

// Coordenadas centrales aprox. de Quillota: -32.8788, -71.2476
// Variamos lat/lng en un radio de ~3km para distribución realista
function randomCoords() {
  const baseLat = -32.8788;
  const baseLng = -71.2476;
  const lat = baseLat + (Math.random() - 0.5) * 0.05;
  const lng = baseLng + (Math.random() - 0.5) * 0.05;
  return {
    lat: lat.toFixed(7),
    lng: lng.toFixed(7),
  };
}

const SEED_PLACES = [
  {
    name: "El Quillotano Burger",
    slug: "el-quillotano-burger",
    address: "O'Higgins 234, Quillota",
    cuisines: ["clasica", "smash"],
    specialty: "doble cheese con champiñones de la zona",
    priceRange: "$$",
    hoursWeekdays: "12:30 - 23:00",
    hoursWeekends: "12:30 - 00:30",
    instagram: "elquillotanoburger",
  },
  {
    name: "Burger del Cerro",
    slug: "burger-del-cerro",
    address: "Av. Manuel Rodríguez 1456, Quillota",
    cuisines: ["smash", "artesanal"],
    specialty: "smash triple con tocino crocante",
    priceRange: "$$",
    hoursWeekdays: "13:00 - 23:30",
    hoursWeekends: "13:00 - 01:00",
  },
  {
    name: "Holy Patty",
    slug: "holy-patty",
    address: "Av. Petorca 789, Quillota",
    cuisines: ["artesanal", "gourmet"],
    specialty: "patty de wagyu con cheddar añejo",
    priceRange: "$$$",
    hoursWeekdays: "13:00 - 22:30",
    hoursWeekends: "13:00 - 00:00",
    instagram: "holypattyquillota",
  },
  {
    name: "La Picá del Tata",
    slug: "la-pica-del-tata",
    address: "Calle Maipú 567, Quillota",
    cuisines: ["clasica"],
    specialty: "italiana XL con palta del valle",
    priceRange: "$",
    hoursWeekdays: "12:00 - 22:00",
    hoursWeekends: "12:00 - 23:00",
  },
  {
    name: "Burgers & Vinos",
    slug: "burgers-y-vinos",
    address: "Av. Concepción 2341, Quillota",
    cuisines: ["gourmet"],
    specialty: "burger trufada con reducción de cabernet",
    priceRange: "$$$",
    hoursWeekdays: "13:00 - 23:00",
    hoursWeekends: "13:00 - 00:00",
  },
  {
    name: "Smash Brothers QLL",
    slug: "smash-brothers-qll",
    address: "Av. Bernardo O'Higgins 3210, Quillota",
    cuisines: ["smash"],
    specialty: "doble smash con cheese sauce casero",
    priceRange: "$$",
    hoursWeekdays: "13:30 - 23:30",
    hoursWeekends: "13:30 - 01:00",
    instagram: "smashbros.qll",
  },
  {
    name: "Veggie Bun",
    slug: "veggie-bun",
    address: "Calle Freire 891, Quillota",
    cuisines: ["vegetariana", "vegana"],
    specialty: "burger de garbanzos con guacamole",
    priceRange: "$$",
    hoursWeekdays: "12:30 - 22:00",
    hoursWeekends: "12:30 - 23:00",
  },
  {
    name: "El Tato Burger",
    slug: "el-tato-burger",
    address: "Av. Valparaíso 2876, Quillota",
    cuisines: ["clasica", "smash"],
    specialty: "doble carne con salsa secreta del Tato",
    priceRange: "$$",
    hoursWeekdays: "13:00 - 23:30",
    hoursWeekends: "13:00 - 02:00",
  },
  {
    name: "Quillota Burger Co.",
    slug: "quillota-burger-co",
    address: "Plaza de Armas 12, Quillota",
    cuisines: ["artesanal", "smash"],
    specialty: "smash de pernil ahumado",
    priceRange: "$$$",
    hoursWeekdays: "12:00 - 23:00",
    hoursWeekends: "12:00 - 00:30",
    instagram: "quillota.burger.co",
  },
  {
    name: "La Chata Hamburguesería",
    slug: "la-chata-hamburgueseria",
    address: "Av. La Chimba 678, Quillota",
    cuisines: ["clasica"],
    specialty: "cubana con huevo y tocino",
    priceRange: "$",
    hoursWeekdays: "12:00 - 22:30",
    hoursWeekends: "12:00 - 23:30",
  },
  {
    name: "Bun & Beef",
    slug: "bun-and-beef",
    address: "Av. Independencia 1567, Quillota",
    cuisines: ["artesanal", "gourmet"],
    specialty: "blue cheese con caramelizada de jerez",
    priceRange: "$$$",
    hoursWeekdays: "13:00 - 23:00",
    hoursWeekends: "13:00 - 00:00",
  },
  {
    name: "Picada Burger Express",
    slug: "picada-burger-express",
    address: "Calle San Martín 432, Quillota",
    cuisines: ["fast-food", "clasica"],
    specialty: "completo italiano + burger combo",
    priceRange: "$",
    hoursWeekdays: "11:30 - 23:00",
    hoursWeekends: "11:30 - 00:00",
  },
];

async function main() {
  console.log("▸ Conectando a la DB...");
  const db = getDb();

  console.log("▸ Limpiando tablas (reviews, places, users de seed)...");
  await db.delete(reviews);
  await db.delete(places);
  // Borramos solo el user de seed para no pisar usuarios reales
  // (en prod cambiar este flujo)
  await db.execute(`DELETE FROM users WHERE email LIKE 'seed-%@hambuscador.cl'`);

  console.log("▸ Creando usuario seed...");
  const passwordHash = await bcrypt.hash("hambuscador123", 10);
  const [seedUser] = await db
    .insert(users)
    .values({
      email: "seed-camila@hambuscador.cl",
      name: "Camila R.",
      username: "camila",
      hashedPassword: passwordHash,
      emailVerified: new Date(),
    })
    .returning();

  if (!seedUser) throw new Error("No se pudo crear el usuario seed");

  console.log(`✓ Usuario creado: ${seedUser.email} (password: hambuscador123)`);

  console.log(`▸ Insertando ${SEED_PLACES.length} hamburgueserías de Quillota...`);
  const insertedPlaces = [];
  for (const placeData of SEED_PLACES) {
    const coords = randomCoords();
    const [row] = await db
      .insert(places)
      .values({
        ...placeData,
        ...QUILLOTA,
        ...coords,
        moderationStatus: "approved",
        approvedAt: new Date(),
        submittedBy: seedUser.id,
        isVerified: Math.random() > 0.5,
      })
      .returning();
    if (row) insertedPlaces.push(row);
  }
  console.log(`✓ ${insertedPlaces.length} locales insertados`);

  console.log("▸ Creando algunas reseñas de ejemplo...");
  const reviewSamples = [
    {
      placeIdx: 0,
      rating: 5,
      text: "el doble cheese del Quillotano es brutal, los champiñones de la zona se notan. la atención top.",
    },
    {
      placeIdx: 1,
      rating: 5,
      text: "smash triple con tocino, no me lo terminé. picada confirmada del cerro.",
    },
    {
      placeIdx: 2,
      rating: 4,
      text: "wagyu rico, pero el precio se siente. para una ocasión especial vale la pena.",
    },
    {
      placeIdx: 3,
      rating: 4,
      text: "italiana XL como las de antes. la palta del valle hace la diferencia.",
    },
    {
      placeIdx: 5,
      rating: 5,
      text: "smash brothers QLL no decepciona. cheese sauce casero, fries crispy.",
    },
  ];

  for (const sample of reviewSamples) {
    const place = insertedPlaces[sample.placeIdx];
    if (!place) continue;
    await db.insert(reviews).values({
      placeId: place.id,
      authorId: seedUser.id,
      rating: sample.rating,
      aspectComida: sample.rating,
      aspectAtencion: Math.max(1, sample.rating - 1),
      aspectAmbiente: sample.rating,
      text: sample.text,
    });
  }

  console.log("▸ Recalculando agregados...");
  for (const place of insertedPlaces) {
    await recomputePlaceAggregates(place.id);
  }

  console.log("");
  console.log("✓ Seed completado.");
  console.log(`   Visitá http://localhost:3000/quillota/${SEED_PLACES[0]?.slug ?? "..."}`);
  console.log("   Login con: seed-camila@hambuscador.cl / hambuscador123");
  console.log("");

  await closeDb();
}

main().catch((err) => {
  console.error("✗ Seed falló:", err);
  process.exit(1);
});
