# Hambuscador — guía para Claude Code

> Este archivo es el contexto principal del proyecto. Léelo siempre antes de hacer cambios.

## Qué es Hambuscador

Hambuscador es una webapp mobile-first para **buscar, registrar y calificar hamburgueserías a lo largo de todo Chile**. La marca y la voz son chilenas, cercanas y golosas — el producto se posiciona como "la picá hamburguesera de Chile". El nombre viene de _hamburguesa_ + _buscador_.

Foco actual: MVP enfocado en descubrimiento (buscar + ver detalle) y aporte comunitario (agregar locales + reseñar). Aún no hay backend ni base de datos — los datos están mockeados en `src/lib/data.ts`.

## Stack

**Frontend:**
- **Next.js 15** (App Router, RSC por defecto, Turbopack en dev)
- **React 19**
- **TypeScript 5** en modo `strict` con `noUncheckedIndexedAccess`
- **Tailwind CSS v4** (config CSS-first vía `@theme` en `globals.css`)
- **Tabler Icons** (`@tabler/icons-react`)
- **class-variance-authority** + **tailwind-merge** + **clsx** para variants tipados

**Backend:**
- **PostgreSQL 16 + PostGIS** (búsquedas geográficas con `ST_DWithin`, índice GIST)
- **Drizzle ORM** (type-safe, lightweight, migraciones via `drizzle-kit`)
- **Auth.js v5** (next-auth@beta) con **DrizzleAdapter**, providers Google + Credentials
- **bcryptjs** para hash de passwords, **zod** para validación
- **pg** como driver de Postgres
- **Docker Compose** para Postgres+PostGIS local

**Tooling:**
- pnpm (preferido), tsx para scripts, prettier para formato.

## Comandos

```bash
# Frontend
pnpm install        # instalar deps
pnpm dev            # dev server con turbopack (http://localhost:3000)
pnpm build          # build producción
pnpm start          # correr el build
pnpm lint           # eslint
pnpm typecheck      # tsc --noEmit
pnpm format         # prettier --write

# Database (requiere Docker corriendo)
pnpm db:up          # levanta Postgres + PostGIS en docker compose
pnpm db:down        # baja el contenedor (data persiste en volume)
pnpm db:push        # sincroniza schema.ts → DB (dev)
pnpm db:postgis     # corre drizzle/postgis.sql (extension + columna geo + índices)
pnpm db:generate    # genera migraciones SQL desde schema.ts
pnpm db:migrate     # aplica migraciones pendientes (prod)
pnpm db:studio      # abre Drizzle Studio (UI de admin)
pnpm db:seed        # carga ~12 hamburgueserías de Quillota
pnpm db:reset       # nuke + up + push + postgis + seed (dev only)
```

**Setup desde cero:**

```bash
pnpm install
cp .env.example .env.local        # rellenar AUTH_SECRET (openssl rand -base64 32)
pnpm db:up                        # levanta Postgres+PostGIS en docker
pnpm db:push                      # crea las tablas
pnpm db:postgis                   # agrega la columna `location` y los índices GIST
pnpm db:seed                      # carga Quillota
pnpm dev
```

**Modo demo sin DB**: el proyecto también funciona sin DATABASE_URL — los servicios caen al mock data automáticamente. Útil para `pnpm dev` rápido o demos.

## Estructura del repo

```
src/
├── app/                          App Router (Next.js 15)
│   ├── layout.tsx                Layout raíz con fonts y metadata
│   ├── page.tsx                  Home / descubrir
│   ├── globals.css               Tokens de marca (Tailwind v4 @theme)
│   ├── api/
│   │   └── auth/[...nextauth]/   Auth.js handler
│   ├── buscar/                   Resultados de búsqueda
│   ├── agregar/                  Wizard para registrar local
│   ├── iniciar-sesion/           Login
│   ├── registro/                 Crear cuenta
│   ├── perfil/                   Perfil propio
│   └── [comuna]/[slug]/          Ficha pública del local (SEO-friendly)
│       ├── page.tsx              Detalle de hamburguesería
│       └── calificar/            Server page + client form
│           ├── page.tsx
│           └── calificar-form.tsx
├── components/
│   ├── ui/                       Primitivas atómicas (button, input, chip, etc.)
│   ├── place/                    Componentes específicos del dominio
│   ├── nav/                      Navegación (header, bottom-nav)
│   └── brand/                    Logo y assets de marca
├── lib/
│   ├── utils.ts                  Helpers (cn, slugify, formato)
│   ├── constants.ts              Constantes globales (cocinas, precios, comunas)
│   └── data.ts                   Orquestador: delega en services, cachea con Next.js
├── server/                       Server-only code (no importable desde client)
│   ├── auth.ts                   Auth.js v5 config (Google + Credentials)
│   ├── db/
│   │   ├── client.ts             Cliente Drizzle con lazy-init
│   │   └── schema.ts             Tablas: places, reviews, favorites + Auth.js
│   └── services/
│       ├── places.ts             Queries de places (con PostGIS)
│       ├── reviews.ts            Queries de reviews + agregados
│       └── mock.ts               Mock data para modo demo (sin DB)
└── types/
    ├── place.ts                  Tipos de UI (Place, Review)
    └── next-auth.d.ts            Augmenta Session.user.id

drizzle/
└── postgis.sql                   Setup geo (extension, columna location, índices GIST)

scripts/
├── seed.ts                       Carga las hamburgueserías de Quillota
└── run-sql.ts                    Helper para correr archivos .sql

docker-compose.yml                Postgres 16 + PostGIS 3.4 en local
drizzle.config.ts                 Config de drizzle-kit
```

## Convenciones de código

### Nombres de archivos

- Componentes: `kebab-case.tsx` (`place-card.tsx`, `search-bar.tsx`)
- Hooks: `use-something.ts`
- Utilidades: `kebab-case.ts`
- Tipos: en `src/types/`, nombre del dominio (`place.ts`, `user.ts`)

### Componentes

- Por defecto Server Components. Marcar `"use client"` solo si necesitás `useState`, `useEffect`, event handlers, browser APIs.
- Props tipadas con `type` (no `interface` salvo extensión).
- Variantes con `cva()` cuando hay 2+ variantes. Si solo hay una variante, `className` directo es ok.
- Usar `cn()` de `@/lib/utils` para combinar clases (`twMerge` + `clsx`).
- Default export para componentes de página, named export para todo lo demás.

### Estilos

- Tailwind v4 con tokens en `@theme` (ver `src/app/globals.css`).
- **Nunca** hardcodear colores hex en JSX. Usar siempre las clases de tokens (`bg-mostaza`, `text-carbon`, etc.).
- Mobile-first siempre. Breakpoints: `sm` (640px), `md` (768px), `lg` (1024px). Diseñar el mobile primero; solo agregar `md:` cuando haga sentido en desktop.
- Prefiero spacing en rem (1rem, 1.5rem, 2rem) salvo gaps internos en components donde 8px/12px/16px lee mejor.

### Rutas e i18n

- Toda la copy en **español de Chile** (no español neutro). Lowercase en titulares y CTAs es deliberado y on-brand.
- URLs en español: `/buscar`, `/agregar`, `/iniciar-sesion`, `/registro`, `/[comuna]/[slug]`.
- No agregar `/en/` ni rutas localizadas hasta nuevo aviso.

### Datos y tipos

- El dominio principal es `Place` (hamburguesería). Ver `src/types/place.ts`.
- Mock data en `src/lib/data.ts`. Cuando se conecte el backend (Fase 2), este archivo se reemplaza por funciones que llaman a la API o consultan Drizzle/Prisma.
- Slugs siempre en formato `kebab-case` ASCII (sin tildes ni ñ): `streat-burger`, `holy-moly`.

## Brand tokens (single source of truth)

Estos tokens están definidos en `src/app/globals.css` bajo `@theme`. Todas las clases Tailwind se generan automáticamente.

### Color

| Token | Hex | Uso |
|---|---|---|
| `crema` | `#F5EFE6` | fondo principal, lienzo |
| `crema-deep` | `#FAF6EE` | tarjetas y superficies elevadas |
| `crema-edge` | `#E8DDD0` | bordes sutiles |
| `carbon` | `#1F1B17` | texto principal, modo oscuro |
| `carbon-soft` | `#2A2520` | superficies oscuras secundarias |
| `tinta-suave` | `#6E5F4F` | texto secundario |
| `bronceado` | `#8B7355` | texto terciario, hints |
| `mostaza` | `#E8A02C` | primario, CTAs, marca |
| `mostaza-deep` | `#C8862A` | hover/active del primario |
| `tomate` | `#C84B31` | acento, alertas suaves, "cierra pronto" |
| `lechuga` | `#6B8E4E` | estados positivos, "abierto", "verificado" |

Ejemplo de uso en JSX: `<button className="bg-mostaza text-carbon">`.

### Tipografía

- `font-display` → Bricolage Grotesque (titulares, marca). Pesos 500/600/700.
- `font-body` → Geist Sans (cuerpo, UI). Pesos 400/500/600.

Cargadas con `next/font/google` en `src/app/layout.tsx`. Nunca importarlas vía `<link>` o CSS @import — siempre `next/font` para el optimization de Next.js.

### Radios

- `rounded-md` → 10px (botones, inputs)
- `rounded-lg` → 14px (cards)
- `rounded-xl` → 20px (sheets, modals)
- `rounded-2xl` → 28px (hero containers, phone frames)

## Voz de marca

Cercana, chilena, golosa. Hablamos como un amigo que sabe dónde está la mejor hamburguesa.

- Vocabulario nuestro: _picá, cachetón, filete, completa, reventada, picada_.
- Vocabulario que evitamos: _gourmet exclusivo, premium, gastrobar fancy_.
- Lowercase en titulares de marca y en la mayoría de CTAs (`encuentra la picá perfecta`, `calificar este lugar`).
- Sentence case en textos descriptivos largos.
- Microcopy de inputs en lenguaje hablado: `busca por barrio o nombre`, no `Búsqueda` formal.

## Contexto del dominio (Chile)

- **Comuna**: división administrativa local (equivalente a "neighborhood/district"). Las URLs y la mayoría de filtros se basan en comuna, no en región o provincia. Ej: Providencia, Ñuñoa, Valparaíso, Concón.
- **Región Metropolitana (RM)**: la región de Santiago. La mayoría de los locales del MVP estarán acá, pero la app es nacional.
- **Quillota**: comuna de la Región de Valparaíso. Es el seed inicial del dataset (hamburgueserías scrapeadas/manuales desde Google Maps).
- **Rango de precio**: `$` (hasta $7.000), `$$` ($7-12k), `$$$` ($12-20k), `$$$$` (más de $20k) por persona. Estos cortes están en `src/lib/constants.ts`.
- **Tipos de cocina** soportados (ver `src/lib/constants.ts`): smash, artesanal, clásica, gourmet, vegetariana, vegana, sin gluten, fast food. Multi-select.



## Inventario de componentes implementados

Las APIs documentadas acá son las **canónicas** — si vas a usar uno de estos componentes, respetá la signatura. Si la signatura te queda chica, prefirí extender el componente existente antes que crear uno nuevo en paralelo.

### `src/components/ui/`

```ts
<Button variant="primary" | "secondary" | "ghost" | "danger"
        size="sm" | "md" | "lg"
        fullWidth?: boolean
        ...buttonHTMLAttrs />

<Chip active?: boolean
      onRemove?: () => void   // si se pasa y active === true, muestra X integrada
      ...buttonHTMLAttrs />

<SearchBar size?: "md" | "lg"
           onClear?: () => void
           ...inputHTMLAttrs />

<RatingPill rating={number}            // 0..5
            size?: "sm" | "md" />

<StatusPill status="open" | "closing-soon" | "closed"
            label?: string />

<StarRating value={number}              // 0..5
            onChange?: (n) => void      // si se pasa, modo interactivo
            size?: "sm" | "md" | "lg" />

<SegmentedControl<T extends string>
            options={Array<{ value, label, icon? }>}
            value={T}
            onChange={(value: T) => void}
            size?: "sm" | "md" />

<ProgressDots total={number} current={number} />
```

### `src/components/place/`

```ts
<PlaceCard place={Place}
           variant?: "compact" | "featured" />   // compact = horizontal, featured = vertical con hero
```

### `src/components/nav/`

```ts
<Header />                                   // modo home: logo + "iniciar sesión"
<Header avatarInitials="JM" />               // modo home: logo + avatar circular
<Header title="..." />                       // modo página: back arrow + título
<Header title="..." subtitle="..." />        // modo página: back arrow + título + subtítulo
<Header title="..." isModal />               // modo página: X + título (para wizards/sheets)

<BottomNav />                                // 4 tabs: inicio, buscar, mapa, perfil
```

### `src/components/brand/`

```ts
<Logo variant?: "full" | "icon" | "icon-mono"
      size?: number          // altura en px, default 28
      monoColor?: string     // solo para variant="icon-mono"
/>
```

## SEO (importante a futuro)

- Cada `/[comuna]/[slug]` debe generar JSON-LD con `Restaurant` + `LocalBusiness` + `AggregateRating` (Schema.org). Esto es lo que aparece como rich result en Google. Ver TODOs en `src/app/[comuna]/[slug]/page.tsx`.
- Sitemap generado dinámicamente (`src/app/sitemap.ts` — TODO Fase 4).
- OG image dinámico por local (`src/app/api/og/[slug]/route.ts` — TODO Fase 4).
- Metadata por página: `generateMetadata()` en cada page con datos reales.

## Roadmap

### Fase 0 — naming, dominio, branding ✅
Logos, paleta y tokens en este repo.

### Fase 1 — design system + setup ✅
Tokens en Tailwind v4. Componentes base. 9 pantallas implementadas conectadas a mock data.

### Fase 2 — backend (estado actual) ⏳
- ✅ Schema en Drizzle: `users`, `places`, `reviews`, `favorites` + tablas Auth.js
- ✅ PostgreSQL + PostGIS (columna `location` generada, índice GIST, ST_DWithin para queries de cercanía)
- ✅ Cliente Drizzle con lazy-init y modo demo (sin DB) automático
- ✅ Services: `places.ts` (list nearby + search + getBySlug + create), `reviews.ts` (list + create + delete + agregados denormalizados)
- ✅ Auth.js v5 con DrizzleAdapter, Google OAuth + Credentials (email/password con bcrypt)
- ✅ Seed de Quillota (~12 locales ficticios pero plausibles)
- ✅ docker-compose para dev local
- ✅ Auth pages conectadas: `/iniciar-sesion` (credentials + Google) y `/registro` (createUser con bcrypt + autologin) usan Server Actions con `useActionState`. Avatar real en home leyendo `auth()`.
- ✅ `/[comuna]/[slug]/calificar` conectado: page redirige a `/iniciar-sesion` sin sesión, form submit dispara Server Action que valida con zod, crea review con `createReview`, revalidatePath del detalle del local y redirige. Maneja unique constraint (un usuario una reseña) y modo demo.
- ✅ `/agregar` conectado: wizard funcional de 3 pasos (paso 1 nombre + comuna + dirección, paso 2 cocinas + precio + horarios + especialidad, paso 3 contacto). Hidden inputs mirroran state, validación local entre pasos, action `createPlaceAction` valida con zod, usa centroide de comuna como fallback de lat/lng (geocoding real es Fase 3), crea local en estado `pending`, revalida y redirige a `/perfil?nuevo=1`.
- ✅ `/perfil` real: auth guard, tarjeta de identidad (avatar con iniciales + nombre + email), banner "tu picá está en revisión" cuando llega `?nuevo=1`, botón "cerrar sesión" via Server Action `signOutAction`. Stats reales (reseñas / favoritos / aportes) leídos con `getUserStats` (reviewCount denormalizado + count(*) en favorites/places).
- ⏳ Faltan: integrar storage de fotos (Cloudflare R2 / Supabase), edición/borrado de reseña propia, geocoding real en `/agregar`

### Fase 3 — MVP funcional
- ✅ Geolocalización del usuario en el home: cookie `hb_geo` (1 día, SameSite=Lax, ≈18 bytes), botón opt-in `<UseLocationButton />` que pide `navigator.geolocation` y refresca via router. Server lee cookie con `cookies()`, pasa coords a `getPlacesNearby({ lat, lng, radiusM: 15000 })`. PlaceCard ya muestra distancia cuando viene seteada.
- ✅ Sistema de moderación: schema con `users.role` (`user` | `admin`, default `user`), JWT y session propagan el rol. Layout `/admin/*` con guard de rol. `/admin/moderacion` lista los places `pending` ordenados por más viejo, con botones aprobar/rechazar (server actions invalidan caches). Bootstrap del primer admin: `UPDATE users SET role = 'admin' WHERE email = '...'` + relogin.
- ✅ Mapa con MapLibre + clusters: `/buscar?vista=mapa` renderiza `<PlacesMap />` (client). Default usa OSM raster (CORS abierto, sin API key, ok para dev). Si se setea `NEXT_PUBLIC_PMTILES_URL` en `.env.local`, cambia a PMTiles vectoriales + protomaps theme "light" (importes lazy condicionales). El demo bucket público de Protomaps NO tiene CORS abierto a localhost — para usar PMTiles hay que self-hostear el `.pmtiles` regional en R2/CDN. Pins mostaza, clusters carbón con texto crema (count solo en modo PMTiles), click pin abre popup con link al detalle, click cluster hace zoom. fitBounds automático cuando hay >1 pin.
- ✅ Storage de fotos en Cloudflare R2: dep `aws4fetch` (5KB, recomendado por Cloudflare en vez de aws-sdk). Server action `requestUploadUrl` valida sesión + zod (jpg/png/webp, máx 8MB) y retorna presigned PUT URL de 5min. Cliente sube directo a R2 (sin proxy por el server). `<PhotoUploader />` (client component) con preview, eliminar, máx N fotos. Wired en /calificar (4 fotos máx) y /agregar paso 3 (4 fotos máx). createReview y createPlace ya guardan el array `photos` con las URLs públicas. `next.config.ts` lee `R2_PUBLIC_URL` y agrega el hostname a `images.remotePatterns` automáticamente.

### Fase 4 — SEO & PWA
- Schema.org JSON-LD en `/[comuna]/[slug]` (Restaurant + LocalBusiness + AggregateRating)
- Sitemap dinámico desde DB
- OG images dinámicas (`/api/og/[slug]`)
- Manifest + service worker (offline básico)
- Core Web Vitals 90+

### Fase 5 — engagement
- Listas curadas (`/picas/top-10-...`)
- Sistema de favoritos (tabla ya existe)
- Notificaciones push
- Compartir reseñas

### Fase 6 — lanzamiento
- Soft launch con foodies en Santiago
- Analytics privacy-friendly (Plausible)
- Blog SEO
- Dashboard para dueños (locales reclamados via `claimedBy`)

## Trabajando con la DB

### Patrón de capas

```
Page (server component, async)
  └─→ lib/data.ts (cache de Next.js, fachada pública)
        └─→ src/server/services/* (lógica de queries)
              └─→ src/server/db/client.ts (Drizzle)
                    └─→ Postgres
```

**Regla:** las pages NO importan directamente de `@/server/services/*`. Siempre van a `@/lib/data` para que el caching se centralice y el "modo demo sin DB" siga funcionando.

### Modo demo (sin DATABASE_URL)

Cada función en `services/places.ts` y `services/reviews.ts` empieza con un check `isDbConfigured()`. Si no hay DB, retorna mock data desde `services/mock.ts`. Esto significa:

- `pnpm dev` funciona sin Docker, sin Postgres, sin nada — la home muestra los mocks.
- Apenas seteás DATABASE_URL + `pnpm db:reset`, las mismas pages traen data real.

**No romper este pattern** — si agregás una función nueva, hacé el branch `if (!isDbConfigured()) return mock` siempre.

### Queries geográficas

PostGIS no se modela en Drizzle (no hay un type nativo para `geography`). El patrón es:

1. La columna `location geography(Point, 4326)` está en la DB pero NO en `schema.ts` — se agrega vía `drizzle/postgis.sql`.
2. Es generada (`GENERATED ALWAYS AS ...`) desde `lat` y `lng` (que sí están en el schema).
3. Para queries de cercanía, usar SQL raw via `sql\`...\``:

```ts
const rows = await db.execute(sql`
  SELECT *,
    ST_Distance(location, ST_SetSRID(ST_MakePoint(${lng}, ${lat}), 4326)::geography) AS distance_m
  FROM places
  WHERE ST_DWithin(location, ST_SetSRID(ST_MakePoint(${lng}, ${lat}), 4326)::geography, ${radiusM})
  ORDER BY distance_m ASC
`);
```

### Mutaciones

Nunca llamar `createPlace` / `createReview` desde el cliente directamente. El patrón correcto es:

1. Form en cliente (`"use client"`) maneja el estado.
2. Submit dispara una **Server Action** (`async function action() { "use server"; ... }`).
3. La Server Action valida con `zod`, autoriza con `auth()`, llama al service.
4. Después de mutar, llamar `revalidateTag("places")` o `revalidatePath(...)` para invalidar el cache.

Hoy `createPlace` y `createReview` están escritos pero las Server Actions todavía no están conectadas — TODO inmediato.

### Agregar una nueva tabla

1. Definirla en `src/server/db/schema.ts` con tipos Drizzle.
2. Si necesita índices GIST/GIN/raw SQL → agregarlo a `drizzle/postgis.sql`.
3. `pnpm db:push` (dev) o `pnpm db:generate && pnpm db:migrate` (prod).
4. Crear un service en `src/server/services/<tabla>.ts` con el patrón mock-fallback.
5. Si las pages la necesitan, exponer en `src/lib/data.ts` con `unstable_cache`.



## Reglas duras al modificar el proyecto

1. **No agregues dependencias sin avisar**. Si necesitás algo nuevo, propónlo primero.
2. **No cambies los brand tokens** (colores, fuentes) sin discutir.
3. **No conviertas Server Components a Client Components** sin razón clara. Server first.
4. **No mezcles inglés con español** en la UI. Todo en es-CL.
5. **No introduzcas `any` en TypeScript**. Si algo es genuinamente desconocido, usar `unknown` y narrow.
6. **No uses `next/image` con dominios remotos** sin agregarlos en `next.config.ts > images.remotePatterns`.
7. **No pongas keys/secrets en el código**. Todo va a `.env.local` y se referencia con `process.env.X`.
8. **Mobile-first**. Si te encontrás escribiendo solo `md:` o `lg:` clases, parar y reconsiderar.
9. **No rompas el modo demo**: cada función nueva en `services/*` empieza con `if (!isDbConfigured()) return mock(...)`.
10. **No importes `@/server/*` desde components o pages cliente** — solo desde server components, API routes, server actions y otros files de server. Eslint lo va a flaggear pero conviene tener el reflejo.
11. **No llames `getDb()` a nivel de módulo** (top-level). Siempre dentro de funciones, así el lazy-init funciona.
12. **No uses raw SQL fuera de los services**. Si necesitás algo geo/avanzado, expone una función en el service correspondiente.

## Cosas pendientes para la próxima sesión

**Estado al 2026-05-07**: Fases 0, 1, 2, 3 cerradas. **MVP en producción** en `https://hambuscador.vercel.app`.

### Deploy actual (2026-05-07)

Decisión final: **Vercel + Neon + Cloudflare R2** (NO se usó la VPS para la DB porque la latencia Vercel→VPS y la falta de PostGIS en la imagen postgres existente lo desaconsejaban).

| Componente | Servicio | Estado |
|---|---|---|
| Hosting | Vercel Hobby (`hambuscador.vercel.app`) | ✅ live |
| DB | Neon Free, region `aws-us-east-2`, Postgres 16 + PostGIS 3 | ✅ live |
| Storage | Cloudflare R2, bucket `hambuscador-photos`, public URL `pub-fbbb0c1401eb442cb484b22514d3ad85.r2.dev` | ✅ live |
| Auth | Google OAuth (project `hambuscador-495612`) + Credentials | ✅ live |
| Dominio custom | Pendiente — `hambuscador.cl` (NIC.cl) | ⏳ no comprado todavía |

**Repo clonado en VPS**: `/var/www/hambuscador/` (SSH remote `git@github.com:tomasvergaraj/hambuscador.git`). Ahí seguimos trabajando — branch `main` se autodeploya en Vercel al hacer push.

**Env vars en Vercel** (las reales viven en Vercel → Project Settings → Environment Variables, NO en este repo):
`DATABASE_URL`, `AUTH_SECRET`, `AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET`, `AUTH_URL`, `NEXT_PUBLIC_SITE_URL`, `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET`, `R2_PUBLIC_URL`.

**DB inicializada** vía Docker en VPS (Node 20 alpine + pnpm) corriendo `db:push --force` + `db:postgis` + `db:seed`. 12 hamburgueserías de Quillota cargadas. Usuario seed: `seed-camila@hambuscador.cl` / `hambuscador123`.

### Fixes hechos en esta sesión

- **2026-05-07** `feat(place): mostrar rango de precio con descripción legible` — el `$$` aparecía solo en una línea de metadatos chiquita sin contexto. Ahora hay info row con `IconCash` y descripción "$7.000 — $12.000 por persona" en `[comuna]/[slug]/page.tsx`.

### Próximos pasos pendientes

#### Deploy / infra
1. **Comprar dominio `hambuscador.cl`** en NIC.cl. Después: agregar en Vercel → Domains, configurar DNS (`A @ 76.76.21.21`, `CNAME www cname.vercel-dns.com`), actualizar env vars `AUTH_URL` y `NEXT_PUBLIC_SITE_URL`, agregar redirect URI en Google OAuth, agregar origin en CORS de R2.
2. **Custom domain en R2** → conectar `photos.hambuscador.cl` al bucket, actualizar `R2_PUBLIC_URL`.
3. **Bootstrap admin**: el owner se loguea con Google → en Neon SQL editor: `UPDATE users SET role = 'admin' WHERE email = '...'` → cerrar sesión y reloguearse (rol viaja en JWT).
4. **Bug `/picas` 404**: hay un link en [src/app/page.tsx:91](src/app/page.tsx#L91) (`href="/picas"`) que apunta a una ruta que no existe. Decidir: crear la página de listas o quitar el link.
5. **CORS R2 verificado**: si los uploads desde el navegador siguen rebotando con CORS preflight, revisar que el bucket tenga la policy con `AllowedOrigins: ["http://localhost:3000", "https://hambuscador.vercel.app"]`, `AllowedMethods: ["PUT", "GET"]`, `AllowedHeaders: ["*"]`, `ExposeHeaders: ["ETag"]`.

#### Código (post-deploy)

1. **Edición/borrado de reseña propia** — hoy `submitReview` rebota si el usuario ya reseñó el local. Falta UI para editar/borrar la propia (`deleteReview` ya existe en el service).
2. **Listas de actividad en `/perfil`** — hoy muestra counts. Próximo: tabs/secciones con las reseñas, favoritos y aportes del usuario (links navegables a cada local).
3. **Geocoding real en `/agregar`** — hoy lat/lng = centroide de la comuna. Próximo: autocomplete con nominatim (sin API key) o Google Places, usuario confirma el pin en un mini-mapa.
4. **PMTiles propio** — bajar `chile.pmtiles` desde maps.protomaps.com/builds, subir a R2, setear `NEXT_PUBLIC_PMTILES_URL`. Reemplaza el OSM raster por basemap vectorial estilizado.
5. **Página `/picas`** (listas curadas, ej: "Las mejores smash de Stgo") — referenciada en home pero no existe.
6. **Admin extendido**: hoy solo modera locales. Sumar moderación de reseñas, ban/promote de usuarios, edición de locales aprobados.

### Fase 4 — SEO & PWA (post-deploy)

- **Schema.org JSON-LD** en `/[comuna]/[slug]` (Restaurant + LocalBusiness + AggregateRating).
- **Sitemap dinámico** desde DB (`src/app/sitemap.ts`).
- **OG images dinámicas** (`/api/og/[slug]/route.ts`).
- **Service worker** + offline básico.
- **Core Web Vitals** target 90+.

## Recursos

- Brand guide completa: ver `BRAND.md` en la raíz (copia del que se entregó en la sesión de identidad visual).
- Logos y assets: `public/`.
- Mockups de referencia: en el chat anterior con Claude (8 pantallas mobile diseñadas).
