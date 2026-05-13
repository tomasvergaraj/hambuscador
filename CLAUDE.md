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

**Estado al 2026-05-12 (sesión 8)**: Fases 0-4 cerradas + Fase 5 social completa. **Hambuscador.cl operativo** con Resend en dominio propio. **Engagement stack** entero live: notificaciones in-app (pull, hook en createReview de places reclamados), sistema de follows user→user con notif new_follower, Web Push con VAPID (toggle en /perfil, hook en createNotification, SW v2 con push handler). **Perfil profundizado**: bio + avatar custom subible al R2, fix de avatar Google que no se veía, JWT refresh sin relogin via `useSession().update()`. **Avatar en chrome** (Header home + tab perfil BottomNav). **PWA share target** GET — Hambuscador aparece en menú "Compartir" del SO, redirige a /agregar o /buscar según heurística. **Perf**: priority en cards LCP + Web Vitals reporter custom (sendBeacon → /api/vitals → stdout). **Search**: SYNONYMS expandidos con hamb/cheeseburger/celiaco/stgo/valpo, CSV export de /admin/search.

### Deploy actual

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

**Importante**: `metadataBase` (en `src/app/layout.tsx`) y todos los SITE_URL del código leen `NEXT_PUBLIC_SITE_URL`. Mientras vivamos en `*.vercel.app`, esa env debe apuntar ahí (sino los OG images apuntan a un dominio inexistente y WhatsApp no muestra preview).

**DB inicializada** vía Docker en VPS corriendo `db:push --force` + `db:postgis` + `db:seed`. 12 hamburgueserías de Quillota cargadas. Usuarios seed (solo dev):
- `seed-camila@hambuscador.cl` / `hambuscador123` — usuario común
- `seed-admin@hambuscador.cl` / `hambuscador123` — admin (creado en seed para entrar a `/admin/*` sin SQL manual)

**Migraciones aplicadas a mano en Neon prod** (drizzle-kit no corre en Vercel build):
- `drizzle/2026-05-07-hours-by-day-banned-cursor.sql` — `places.hours_by_day` jsonb, `users.banned_at` timestamptz, índice cursor `reviews_created_at_idx`. Ya en prod ✅.
- `drizzle/2026-05-07-search-unaccent.sql` — `unaccent` extension, función IMMUTABLE `f_unaccent`, reindex GIN trigram en `f_unaccent(lower(name|comuna_label|specialty))`. Ya en prod ✅.
- `drizzle/2026-05-08-search-logs.sql` — tabla `search_logs` con índices (normalized_query, created_at, partial zero-hit). Alimenta `/admin/search`. Ya en prod ✅.
- `drizzle/2026-05-08-regions.sql` — tabla `regions(slug PK, label UNIQUE, lat, lng, zoom)` seedeada con las 16 regiones oficiales de Chile. Aplicada en Neon prod ✅.
- `drizzle/2026-05-08-comunas.sql` — tabla `comunas(slug PK, label, region_slug FK, region_label, lat, lng)` seedeada con las 346 comunas oficiales (origen 2x3-la/geo-chile + reasignación Ñuble + Alhué + correcciones). Aplicada en Neon prod ✅.
- `drizzle/2026-05-08-resync-aggregates.sql` — UPDATE one-shot que recalcula `places.rating_avg` y `review_count` excluyendo reseñas de baneados. Idempotente. Aplicada en Neon prod ✅.
- `drizzle/2026-05-08-place-contact-featured.sql` — `places.whatsapp` text + `places.is_featured` boolean default false. Cabe el contacto WhatsApp y el flag de publicidad (pin diferenciado en mapa). Idempotente. Aplicada en Neon prod ✅.
- `drizzle/2026-05-08-place-logo.sql` — `places.logo` text. URL del logo de marca; reemplaza thumbnail en PlaceCard compact cuando existe. Solo admin lo setea. Idempotente. Aplicada en Neon prod ✅.
- `drizzle/2026-05-08-place-claims.sql` — tabla `place_claims` para flow de "este es mi local". Aprobar setea `places.claimed_by` + `is_verified=true`. Owners pueden editar via `/mi-local/[id]/editar`. Idempotente. Aplicada en Neon prod ✅.
- `drizzle/2026-05-09-password-reset-tokens.sql` — tabla `password_reset_tokens` (token PK, FK user, TTL ~1h, used_at). Alimenta `/recuperar`. Idempotente. Aplicada en Neon prod ✅.
- `drizzle/2026-05-12-notifications.sql` — tabla `notifications` (in-app feed) + índices por user_id/created_at y parcial unread. Idempotente. Aplicada en Neon prod ✅.
- `drizzle/2026-05-12-follows.sql` — tabla `follows` (PK compuesto, CHECK no-self, índice followee). Sistema seguidores. Idempotente. Aplicada en Neon prod ✅.
- `drizzle/2026-05-12-push-subscriptions.sql` — tabla `push_subscriptions` (endpoint UNIQUE, p256dh, auth, user_agent). Web Push API. Idempotente. Aplicada en Neon prod ✅.
- `drizzle/2026-05-12-resync-photo-urls.sql` — UPDATE one-shot que reescribe URLs viejas (`pub-fbbb...r2.dev`) por el dominio custom (`photos.hambuscador.cl`) en `places.photos[]`, `places.logo`, `reviews.photos[]`, `place_claims.proof_url` y `users.image`. Idempotente (WHERE filtra host viejo). Aplicada en Neon prod ✅.
- `drizzle/2026-05-13-web-vitals.sql` — tabla `web_vitals` (id uuid, metric, value real, rating, path, metric_id, nav_type, created_at) con índices (metric, created_at DESC), (path, metric), (created_at DESC). Persistencia de Core Web Vitals reportadas desde el cliente vía `/api/vitals`. Aplicada en Neon prod ✅.
- `drizzle/2026-05-13-email-digest.sql` — `users.email_digest_frequency text NOT NULL DEFAULT 'off'` con CHECK (off|daily|weekly), `users.last_digest_sent_at timestamptz`, índice parcial `users_email_digest_frequency_idx WHERE != 'off'`. Habilita opt-in al email digest. Aplicada en Neon prod ✅.

Para futuras migraciones: crear archivo en `drizzle/AAAA-MM-DD-descripcion.sql`, correr en Neon SQL editor antes del push (las queries de Drizzle hacen `SELECT *` y rompen si una columna del schema no existe en DB).

### Hecho en esta sesión (2026-05-07 sesión 2)

#### Reseñas / favoritos / perfil
- ✅ Editar y borrar reseña propia (sección "tu reseña" destacada en ficha + form prefilled)
- ✅ Botón corazón funcional (toggle `addFavorite`/`removeFavorite`)
- ✅ Botón compartir con Web Share API + fallback a clipboard
- ✅ `/perfil` con tabs `?tab=resenas|favoritos|aportes` y listas con cards linkeables
- ✅ Back arrow del detail page con `IconArrowLeft` (antes era `IconShare` rotado, raro)

#### Wizard /agregar
- ✅ Geocoding real con Nominatim (sin API key) + mini-mapa con pin draggable
- ✅ Horario por día (jsonb `hours_by_day`) con UI de switches + time pickers (`<DaysSchedule>`)
- ✅ Validación de duplicado nombre+comuna ANTES de avanzar al paso 2
- ✅ Referencia visual de precios bajo los chips $-$$$$
- ✅ Bug fix: `<Field>` era `<label>` y se asociaba al primer input (click en cualquier área del campo activaba el primer chip / switch). Ahora es `<div>` con `<span>` title
- ✅ Bug fix: cambiar `type=button → type=submit` en el mismo botón disparaba submit accidental al pasar al paso 3. Fix con `key="next"` vs `key="submit"`

#### Detail page
- ✅ Render del horario por día (lista de 7 días con día actual destacado, fallback a texto resumen para locales legacy)
- ✅ JSON-LD Restaurant (Schema.org) — name, address, geo, openingHoursSpecification (mapea hours_by_day a Monday..Sunday), aggregateRating, sameAs

#### Admin
- ✅ Tab "reseñas" en `/admin/resenas` con cursor pagination (índice `reviews_created_at_idx`) y action borrar como admin
- ✅ Tab "usuarios" en `/admin/usuarios` con cursor pagination + búsqueda por email/nombre + acciones inline: hacer admin / quitar admin · banear / reactivar
- ✅ Auth.js rechaza login (Credentials) y rechaza signIn (Google) si `users.banned_at` está seteado
- ✅ Auto-protección server-side: no podés auto-banearte ni auto-degradarte

#### SEO
- ✅ `src/app/sitemap.ts` dinámico (rutas estáticas + 1 por place aprobado, lastModified=updated_at). Refresh: `revalidate=3600` + `revalidatePath("/sitemap.xml")` al aprobar
- ✅ `src/app/robots.ts` con disallow para áreas privadas
- ✅ `src/app/[comuna]/[slug]/opengraph-image.tsx` — OG image dinámica 1200×630 con Bricolage Grotesque (cargada de Google Fonts en runtime con UA vacío para forzar TTF — Satori en next/og NO soporta woff2 en Node), hero con foto del local o fallback ilustrado (gradient mostaza + watermark del nombre + 🍔 grande)

#### Mapa
- ✅ `/buscar?vista=mapa` ahora es fullscreen (`fixed inset-0`) con header/toggle/contador flotando con backdrop-blur
- ✅ Marker "blue dot" del usuario desde la cookie `hb_geo`
- ✅ `<LocateMeButton>` flotante con `flyTo` animado (essential: true para reduce-motion)
- ✅ Quitamos los controles `+/-` (gestos pinch/wheel suficientes)
- ✅ Popup del pin con CTA estilo button mostaza
- ✅ Fix: `ResizeObserver` al container + wrapper interno con inline `style={{ width: 100%, height: 100% }}` para derrotar la regla `.maplibregl-map { position: relative }` que pisaba nuestras clases Tailwind y dejaba el canvas en 0×0

#### PWA / instalación
- ✅ Manifest mejorado (iconos maskable, categories, shortcuts long-press)
- ✅ `public/sw.js` — service worker vanilla con estrategias por tipo (HTML network-first, /_next/static cache-first, imágenes/fonts SWR, /api/admin/auth network-only)
- ✅ `<PwaInstaller>` registra el SW en producción y muestra toast on-brand cuando dispatchea `beforeinstallprompt` (Chrome). Fix: `sessionStorage` evita que reaparezca en cada navegación cliente
- ✅ Página `/offline` como fallback del SW

#### UI / branding
- ✅ Animaciones de press (`active:scale-X` + transition) en Button, Chip, BottomNav tabs, Header buttons, PlaceCard, cards de listas en perfil, icon buttons del detail page
- ✅ Indicador de tab activo en BottomNav (pill mostaza 2×20px debajo del label)
- ✅ Footer sutil "desarrollado por nexo software" en BottomNav linkeado a `https://nexosoftware.cl`
- ✅ Logo SVG en README

#### Voz / contenido
- ✅ Barrido de argentinismos en error messages (definilo→defínelo, levantá→inicia, configurá→configura, probá→prueba/intenta, tocá→toca, elegí→elige)

### Hecho en esta sesión (2026-05-07 sesión 3)

#### Descubrimiento (home + lista + búsqueda)
- ✅ Home reorganizado: search funcional (`<HomeSearchInput>` redirige a `/buscar?q=…`), 5 quick-chips link a filtros pre-aplicados, sección "recién agregadas" (places aprobados últimos 14d), CTA UGC "¿conoces una picá que falta?", removido el "trending" fake. Heading "cerca de ti" / "los mejor calificados" según coords.
- ✅ `/buscar` con filtros funcionales: chips multi-select (abierto + 4 precios + 8 cocinas), menú de orden (rating/distancia/recientes/popularity) con default dinámico según coords, soft nav vía router.push (sin reload).
- ✅ Búsqueda live debounced (200ms, useTransition para spinner sutil) + sync con back/forward del browser. Reemplaza el form GET.
- ✅ Mapa refactorizado: init-once + pins-update separados. Cambios de filtros NO reconstruyen el mapa, solo `setData` del GeoJSON source. Tiles, viewport y popups se mantienen. fitBounds inicial protegido por `didInitialFitRef`.
- ✅ Agrupación inteligente en lista (cuando no hay query/filtros/orden): con coords → bandas `<1km / 1-5km / >5km`; sin coords → por comuna.
- ✅ Empty state mejorado con CTAs "quitar filtros" + "agregar picá".

#### Search viral-grade
- ✅ Migration `2026-05-07-search-unaccent.sql`: `unaccent` extension + `f_unaccent` IMMUTABLE wrapper + GIN trigram reindex sobre `f_unaccent(lower(...))`.
- ✅ Helper `src/lib/search.ts`: `normalizeForSearch` (NFD + strip combining marks), `tokenizeQuery` con stop-words es-CL y sinónimos como GRUPOS de alternativas (OR dentro, AND entre).
- ✅ `searchPlaces` reescrito: WHERE multi-token AND con cada grupo OR de alternativas, score por grupo (max alternative · max field weight: prefix-name=5, name=3, cuisine=2, specialty=1.5, comuna=1, address=0.5), bonus +5 si phrase completa cabe en name. ORDER BY relevancia → bayesian rating (prior C=5 μ=4.0) → distancia si coords → rating raw. Fuzzy fallback con `pg_trgm.similarity > 0.3` cuando strict da 0.
- ✅ Validado: `champinones` matchea `champiñones`, `anejo` matchea `añejo`, `patty wagyu` (multi-token AND) matchea Holy Patty, `Quillotno` (typo) cae en fuzzy fallback, sinónimos veggie/vegan/hamburguesa funcionan como alternativas OR.

#### Listas curadas /picas
- ✅ 5 listas hardcoded en `src/lib/picas.ts` con criteria: top smash, veggie y vegana, barata y buena (priceRanges + minRating), para celebrar (priceRanges + minRating 4.5), lo mejor de Quillota.
- ✅ Cada lista tiene `icon: PicaIconName` (`flame|leaf|coin|sparkles|map-pin`) que mapea a Tabler icons en UI (`PicaIcon` helper) y a paths SVG inline en el OG (`og-icons.tsx` con `BrandIconSvg` + `PicaIconSvg`). Los emojis 🔥🌱💸✨🥑 quedaron eliminados.
- ✅ `searchPlaces` ganó `sort: 'popularity'`, `minBayesRating`, `approvedWithinDays` para criterios curatoriales.
- ✅ Service `services/picas.ts` delega a searchPlaces. Data layer `getPlacesForPicasList` y `getPicasListsWithCounts` con cache 5min.
- ✅ `/picas` (index): tarjetas con icono mostaza-tinted + count + preview del primer local.
- ✅ `/picas/[slug]`: ranking 1-2-3 (top 3 mostaza, resto crema), ShareButton, OG image dinámica (~80 KB), `generateStaticParams` para pre-render.
- ✅ Sitemap incluye `/picas` + las 5 listas.
- ✅ Home tiene CTA carbon "listas para no errarle" → `/picas` (con `IconList`).
- ✅ Back button de `/picas` va a inicio (no `router.back`) — tab destino, no transitivo. Patrón generalizable: `<Header backHref="/" />`.
- ✅ Voz: "picá" / "picás" siempre con tilde en UI/OG/comentarios. Memoria persistida.

#### Admin
- ✅ Edición de locales aprobados: nueva sección `/admin/places` (index con búsqueda + filtro por estado) y `/admin/places/[id]/edit` (form flat con todos los campos: nombre, comunaLabel, región, dirección + pin draggable, cuisines multi-select, precio, especialidad, horario por día, teléfono/IG, fotos máx 6, flag isVerified). slug y comunaSlug NO editables (rompería URLs).
- ✅ Service: `getPlaceByIdForAdmin`, `getAllPlacesForAdmin`, `updatePlace`, `countPendingPlaces`. `deserializeSchedule` helper agregado en `days-schedule.tsx`.
- ✅ Action `updatePlaceAction` con admin guard via session.user.role + zod validation.
- ✅ Pencil icon en ficha pública (visible solo si role=admin) → `/admin/places/[id]/edit`.
- ✅ Tab "locales" en `/admin/*` nav.
- ✅ Badge mostaza con count de pendientes en el tab `pendientes` (visible desde cualquier ruta admin). Decisión: NO email-per-submission — escala mal, viral risk. Memoria persistida.
- ✅ Bug fix: `isVerified` se guardaba en DB pero NO se renderizaba en público. Ahora `<IconRosetteDiscountCheckFilled>` mostaza en PlaceCard (compact + featured) y pill "verificado" en ficha detail.

#### OG / branding
- ✅ Place OG: ahora SIEMPRE usa gradient hero (no la foto del local). Bajó el peso de ~650 KB → ~85-95 KB, dentro del límite de WhatsApp. Trade-off aceptado: foto vive en la ficha real, no en el preview social.
- ✅ Place OG: 🍔 emojis reemplazados por `BrandIconSvg` (paths del logo bun) y ⭐ por `StarFilledSvg` (path de Tabler IconStarFilled).
- ✅ Picas OG: emoji XL central → `PicaIconSvg`, tile mostaza con 🍔 → `BrandIconSvg`.
- ✅ pwa-installer: 🍔 del toast → `<Logo variant="icon" />`.
- ✅ Home CTA listas: 📋 → `IconList`.
- ✅ README: `<picture>` con `prefers-color-scheme: dark` sirve `logo-dark.svg` (texto crema legible sobre dark).

#### DX
- ✅ Memoria nueva: `feedback_pica.md` (picá/picás con tilde) y `feedback_notifications.md` (no escalar notificaciones linealmente).
- ✅ Lección aprendida: `pnpm build` y `pnpm dev` comparten `.next/`. Correr build pisa los manifests del dev y rompe HMR. Para verificar producción usar `pnpm typecheck` + `pnpm lint` localmente; si necesitás `pnpm build`, kill el dev primero.
- ✅ Bug histórico: Vercel build con eslint más estricto que tsc local. Errores típicos: `react/no-unescaped-entities` en comillas y `@typescript-eslint/no-unused-vars`. Si sospechás, correr `pnpm lint` antes de pushear.

### Hecho en esta sesión (2026-05-08 sesión 4)

#### Autocomplete de búsqueda
- ✅ Endpoint compartido `src/app/api/search/suggest/route.ts` que devuelve 4 secciones: `places` (top hits del searchPlaces), `picas` (matches por title/hook), `comunas`, `regions`. Coords incluidas en places/comunas/regions para flyTo sin round-trip.
- ✅ Hook `src/lib/use-search-suggestions.ts` con debounce 150ms + AbortController para cancelar requests en vuelo. Compartido por home + mapa.
- ✅ `<HomeSearchInput>` reescrito: dropdown sectionado (locales, listas, comunas), keyboard nav `↑↓ Enter Esc`, ARIA combobox-listbox con `aria-activedescendant`, click fuera cierra. NO es live — submit/click navega al destino.
- ✅ `/buscar` lista: tarjeta inline "lista relacionada" arriba de los resultados cuando la query (≥3 chars) matchea el title/hook de un /picas. Server-rendered, cero JS.

#### Search del mapa con flyTo
- ✅ `<MapSearchInput>` (nuevo, `src/components/place/map-search-input.tsx`) reemplaza `<LiveSearchInput>` en `?vista=mapa`. Sigue filtrando los pines live (push de `?q=` debounced 200ms) **y** abre dropdown con 4 secciones.
- ✅ Click en local → `flyTo(coords, zoom 16)`. Comuna → centroide zoom 13. Región → centroide zoom 9. Picá → navega a `/picas/[slug]` (única que abandona el mapa).
- ✅ Coordinación input ↔ mapa vía window `CustomEvent("hambuscador:flyTo")` — decoupled, no hay ref compartido. `<PlacesMap>` agrega listener al window y llama `map.flyTo({...detail, duration: 900, essential: true})`.
- ✅ `REGIONS_REGISTRY` en `src/lib/constants.ts` (RM, Valparaíso) con centroide + zoom sugerido. Hardcoded mientras el catálogo sea pequeño.
- ✅ `searchPlaces` ahora también matchea `places.region` (peso 0.7, entre comuna 1.0 y address 0.5). Sin esto, escribir "metropolitana" filtraba pines a 0 aunque hubiera locales en RM.

#### Search analytics
- ✅ Migration `2026-05-08-search-logs.sql` aplicada en prod. Tabla `search_logs` con índices: `normalized_query`, `created_at DESC`, partial `WHERE result_count = 0` (cheap reports de zero-hit).
- ✅ Service `src/server/services/search-logs.ts`: `logSearch` (try/catch + fire-and-forget), `getPopularQueries`, `getZeroHitQueries`, `getSearchSummary`. Agregación por `normalized_query` así "Quillota"/"quillota"/"QUILLOTA" cuentan juntos.
- ✅ `/buscar` server page dispara `logSearch` vía `next/after()` después de tener results — no bloquea el render. Source `"list"` o `"map"` según `vista`. Solo loguea si `query.trim().length > 0` (no contar visitas a /buscar vacío).
- ✅ `/admin/search` dashboard con summary cards (total · únicas · sin resultados · fuzzy fallback), tabs 24h/7d/30d, top queries por cantidad, sin-resultados últimos 30d. Tab "búsquedas" agregado al admin nav.

#### DX
- ✅ Lección: `/api/search/suggest` debounced 150ms con `AbortController` evita ~3-5 fetches por keystroke. La API solo loguearía ruido — el logging va en /buscar (página completa) y no en suggest.
- ✅ Lección: `next/after()` (Next 15) corre callbacks después de mandar la respuesta. Ideal para fire-and-forget de logging/analytics sin bloquear TTFB.
- ✅ Lección: cuando se agrega un campo nuevo a la búsqueda en `searchPlaces` (`region`), también hay que sumarlo al `scoreFor` (no solo al `matchClauseFor`) — sino los matches existen pero quedan en el fondo del orden.

### Hecho en esta sesión (2026-05-08 sesión 5)

#### Catálogo geo dinámico (regions + comunas)
- ✅ Tabla `regions` con las 16 regiones oficiales (centroide + zoom). `getActiveRegions` filtra por presencia (≥1 place aprobado), defensive fallback a `REGIONS_REGISTRY` si la tabla aún no existe en el ambiente.
- ✅ Tabla `comunas` con las 346 oficiales (slug PK, region_slug FK, region_label denormalizado, centroide). `getActiveComunas` (filter por presencia) + `getAllComunas` (las 346 para wizard).
- ✅ Endpoint `/api/search/suggest` usa la fuente dinámica — cuando aporten un local en una comuna o región sin presencia previa, aparece automático en el dropdown.
- ✅ Wizard `/agregar` reescrito: `<select>` de 12 → `<ComunaAutocomplete>` híbrido. Sin query → agrupa por región plegable (browse jerárquico). Con query → matches planos. Cero clicks extra para quien sabe el nombre.
- ✅ Validación zod del action: `comunaSlug` ya no es enum, ahora `z.string()` validada en runtime contra `getAllComunas()`. `region` viene de `comuna.regionLabel` (alineado con tabla).

#### Autocomplete dropdown en `/buscar?vista=lista`
- ✅ `<LiveSearchInput>` suma dropdown sectionado (locales, regiones, comunas) manteniendo el filter live. Click en place navega a la ficha; comuna/región reemplazan `q` preservando filtros activos. Picás se omiten — la card "lista relacionada" inline ya cubre ese caso.

#### Ban retroactivo en lecturas
- ✅ `recomputePlaceAggregates` ahora INNER JOIN `users` con `banned_at IS NULL` — los rating excluyen reseñas de baneados.
- ✅ `recomputePlacesForUser(userId)`: nueva fn, recalcula todos los places donde el user dejó reseñas. Disparada desde `banUser`/`unbanUser` (dynamic import para evitar circular dep).
- ✅ `getReviewsByPlaceId`: `INNER JOIN users` con filter banned (oculto del listado público).
- ✅ `/admin/moderacion`: pending de submitter baneado lleva tag tomate "creador baneado, revisa con cuidado".
- ✅ Migration one-shot `2026-05-08-resync-aggregates.sql` para alinear el estado existente al cambio de comportamiento.

#### Perfiles públicos /u/[username] (Fase 5)
- ✅ Page `/u/[username]/page.tsx` con tabs (reseñas/favoritos/aportes aprobados), header con back, stats. 404 si username no existe o user está baneado (coherente con ban retroactivo).
- ✅ `<UsernameSetter>` en `/perfil`: form para elegir/cambiar username (validación 3-30 chars `[a-z0-9_-]`, unicidad). Sin username el user es privado. Layout column en modo edit (evita flex-row bug).
- ✅ `searchPublicUsers(query)`: filtra `username NOT NULL AND banned_at IS NULL`, match por @username o name, orden por reviewCount.
- ✅ Search global suma sección "usuarios" en home/buscar/mapa dropdowns. Tipear "camila" o "@camila" encuentra el perfil.
- ✅ `Review.authorUsername` nuevo campo (poblado desde `users.username`). Avatar + nombre en review cards de la ficha del local linkean a `/u/<username>` cuando hay username.
- ✅ Atajo `/@username` → rewrite interno a `/u/<username>` (URL conserva `@`, estilo Twitter).

#### Compartir reseñas /r/[id] con OG propio
- ✅ Page `/r/[id]/page.tsx` permalink compartible: card grande de la reseña (rating, foto, texto, autor con link), CTA al local. noindex (las reseñas no son SEO-primario; el local sí).
- ✅ `getReviewById(reviewId)`: lookup público con JOIN a place + user, filter banned author. Cache 60s tag `reviews`.
- ✅ OG dinámica `/r/[id]/opengraph-image.tsx` — gradient mostaza, rating XL stars, snippet truncado del texto, autor pill con initials, nombre del local con comuna+región, brand. Pesa ~80-100 KB (sin foto, mantenemos < límite WhatsApp).
- ✅ Botón share en cada review card de la ficha del local (mine y others) → lleva al `/r/[id]`.

#### Deploy / dominio custom
- 🟡 Dominio `hambuscador.cl` comprado en NIC.cl. DNS en Cloudflare (free tier) con nameservers actualizados en NIC. Records: `A @ 76.76.21.21` + `CNAME www cname.vercel-dns.com`, ambos **DNS only (gris, NO proxied)** — Vercel maneja SSL/CDN.
- 🟡 Vercel Project → Domains → `hambuscador.cl` (canonical apex) + `www.hambuscador.cl` (redirect → apex).
- 🟡 Custom domain R2: `photos.hambuscador.cl` conectado al bucket `hambuscador-photos`.

#### DX
- ✅ Commit por feature siempre, push al final del bloque (memoria persistida).
- ✅ Lección: no usar `<details>` dentro de un padre `flex items-center` — el contenido expandido descentra el cross-axis. Toggle de state local + cambio a layout column es la solución limpia.
- ✅ Lección: los 3 dropdowns (HomeSearchInput, LiveSearchInput, MapSearchInput) tienen lógica casi idéntica para keyboard nav + sections. Quedan como código duplicado por ahora — refactor a `<SuggestionsDropdown>` compartido cuando se agregue una 4ta sección o vuelvan a divergir las acciones.
- ✅ Lección: pasar 28KB de comunas como prop al cliente (en `/agregar`) es totalmente válido. Filter client-side > server action por keystroke. Cuando el catálogo justifique server-search, cambiar entonces.

### Hecho en esta sesión (2026-05-09 sesión 6)

#### Branding del mapa
- ✅ Pin default: SVG burger en teardrop mostaza con stroke carbon (`burger-pin`).
- ✅ Pin destacado: fondo **tomate** (no solo borde) + halo glow tomate. SVG `burger-pin-featured`. **Source aparte `places-featured` SIN clustering** — siempre visible en cualquier zoom, nunca absorbidos por los círculos negros del cluster.
- ✅ Cluster: SVG hamburguesa completa (top bun + sésamo + lechuga + patty oscura + bottom bun). Patty es el "fondo" del count. icon-size step por point_count → más locales = icono más grande.
- ✅ Count visible en ambos modos (PMTILES + OSM raster) — agregamos `glyphs: PROTOMAPS_FONTS_URL` al style OSM. Halo carbon + crema sobre la patty.
- ✅ Mapa pide **5000 places** (vs 30 default de la lista) con `?vista=mapa` — el usuario espera ver todo Chile en el mapa, no solo los más cercanos.

#### Featured / publicidad
- ✅ `places.is_featured` boolean default false + migration. Admin lo togglea en `/admin/places/[id]/edit` (sección flags).
- ✅ Badge "destacado" en PlaceCard (compact = sparkles tomate al lado del nombre; featured grande = pill tomate sólido top-right) y pill en ficha.
- ✅ Featured prioriza listados: `is_featured DESC` primero en sort default rating + popularity. Distance/recent quedan honestos al eje elegido. Con query: `score DESC, is_featured DESC, bayes DESC` — featured tiebreaker entre matches, no rompe relevance.

#### Logo de marca admin-only
- ✅ `places.logo` text + migration. Solo admin lo setea desde `/admin/places/[id]/edit` con `<PhotoUploader max={1}>`.
- ✅ PlaceCard compact (78×78) y `/admin/places` (40×40), `/admin/moderacion` (64×64) usan `place.logo ?? photos[0]`. **`object-cover`** llena el thumb completo (antes `object-contain` dejaba bordes mostaza).
- ✅ OG dinámica `/[comuna]/[slug]/opengraph-image.tsx`: cuando hay logo, lo incrusta en card crema 260×260 con drop-shadow (en vez de BrandIconSvg placeholder). Foto del local NO se incrusta (peso ~600KB, fuera del límite WhatsApp).

#### Contacto en ficha
- ✅ `places.whatsapp` text + classifier que rutea Google `websiteUri`: wa.me/<digits> → whatsapp; instagram.com/<handle> → instagram; otro → website. Edge cases: `wa.me/message/<id>` (click-to-chat) preserva URL completa; IG handles reservados (/p/, /explore/) preservan como website.
- ✅ Botones de contacto en ficha del local convertidos a `<ActionLink>` accionables: mapa → google.com/maps con coords, llamar → tel:, whatsapp → wa.me/<digits> (o URL si tiene letras), instagram → instagram.com/<handle>, sitio web → URL con scheme. Wizard `/agregar` y admin edit ahora capturan whatsapp + sitio web.

#### Carousel + reseña UX
- ✅ `<PhotoCarousel>` client component en hero del detail: scroll-snap horizontal nativo + IntersectionObserver para tracking del slide activo. Dots dinámicos con elongación del activo (transición width 200ms). Utility `.scrollbar-hide` en globals.css.
- ✅ Cards de reseña en ficha del local clickables a `/r/[id]` via stretched link pattern (z-10 transparent encima del contenido; profile link + edit/delete con z-20 ganan el click). Photos badge "N fotos" con IconCamera (mostaza para mine, lechuga para others).
- ✅ Toast en `/admin/places/[id]/edit` reemplaza el mensaje "cambios guardados" de arriba — fixed bottom (sobre la sticky CTA) con animación `slideUp`. Verde 2.5s ok, tomate 5s error, cerrable manual con ×.

#### Carga inicial real de Chile (Google Places API)
- ✅ Script `scripts/seed-google.ts` con flag `--all` (lee 346 comunas de la tabla) y `--dry-run`. Field mask Enterprise (USD 35/1000) trae phone + hours + website. NO photos/reviews (ToS prohíbe cachear).
- ✅ Filtros aplicados (en orden de severidad):
  1. `includedType: hamburger_restaurant` + `strictTypeFiltering` server-side.
  2. Comuna debe aparecer en formattedAddress (case+accent insensitive).
  3. Bbox Chile: mainland + Rapa Nui + Juan Fernández.
  4. Distancia haversine ≤80km del centroide oficial de la comuna.
- ✅ Dedup por (comuna_slug, slug) contra DB existente.
- ✅ websiteUri se clasifica antes de insertar (wa.me/IG → campo correcto).
- ✅ **Run completo en Neon prod**: 369 requests = USD 12.92 (free credit USD 200/mes lo cubre). Resultado: **1.481 places approved** en las 16 regiones (RM 506, V 197, Maule 121, Biobío 105, O'Higgins 97, etc).
- ✅ Cleanup post-seed: 37 places fuera de Chile + 24 mis-asignaciones (San Rafael Mendoza AR, San Pedro de Atacama mal asignado, etc.) eliminados. Rapa Nui + Juan Fernández preservados.

#### Claim flow MVP (locales reclaman su ficha)
- ✅ Tabla `place_claims` (place_id, user_id, status, proof_url, message, contact_email/phone, reviewed_at/by, rejection_reason). Migration aplicada en Neon.
- ✅ Service `services/claims.ts`: createClaim, hasPendingClaim, getPendingClaims, countPendingClaims, approveClaim (transaccional: status approved + places.claimed_by + isVerified=true), rejectClaim, isOwnerOf, getMyOwnedPlaces.
- ✅ `/[comuna]/[slug]/reclamar` page + form: email contacto + phone + message + proof image (PhotoUploader max=1). Bloquea pending dup. Detail page suma CTA "¿es tu local? reclámalo" (oculto si admin/owner; muestra "en revisión" si pending).
- ✅ `/admin/claims` queue: lista pending con local + user + email + phone + mensaje + proof image inline + botones aprobar/rechazar. Tab "claims" en admin nav con badge tomate (count pending).
- ✅ `/mi-local/[id]/editar` para owners (form restringido: logo, fotos, cuisines, precio, especialidad, horario, contacto). NO toca name/slug/comuna/lat/lng/flags. Auth check: admin OR isOwnerOf.
- ✅ Detail page pencil routea según rol: admin → `/admin/places/[id]/edit` (full); owner → `/mi-local/[id]/editar` (restringido).
- ✅ `/perfil` suma sección "mis locales (N)" cuando el user es owner verificado de algunos. Cada item linkea al editor restringido.
- ✅ Acceso rápido al panel admin desde `/perfil` (carbon card con tile mostaza + badge count) — solo si `role=admin`. countPendingPlaces se carga en Promise.all solo cuando isAdmin.
- ✅ `/admin/places/[id]/edit` suma sección "owner" (visible solo si is_claimed) con botón "revocar owner" via `useTransition` + window.confirm. Setea claimed_by=NULL, NO toca isVerified, place_claims preserva historial.

#### DX
- ✅ Commits por feature, push al final del bloque (5 commits del flow claims pusheados juntos).
- ✅ Lección: `unstable_cache` serializa Date → string ISO en cache hits. `Intl.DateTimeFormat.format(string)` → `RangeError: Invalid time value`. Fix: `format(new Date(value))` tolera ambas formas.
- ✅ Lección: nested `<form>` no es HTML válido. Para acciones secundarias dentro de un form (ej. revoke owner dentro del edit form), usar `<button onClick>` + `useTransition` + invocar la server action como function call.
- ✅ Lección: scroll-snap CSS-only carousel con `<IntersectionObserver>` + threshold 0.6 es más estable que scroll handler para tracking del slide activo (que dispara N veces durante un swipe).
- ✅ Lección: PostgreSQL `substring(text from 'pattern')` con POSIX regex captura grupos `()` directamente; `~*` es case-insensitive match. Útil para data fixes one-shot.
- ✅ Lección: Google Places New API requiere fields explícitos en `X-Goog-FieldMask`. Pricing tier (Pro/Enterprise) depende de qué fields se piden. `includedType` + `strictTypeFiltering` filtran server-side mucho mejor que post-fetch.

### Hecho en esta sesión (2026-05-11 sesión 7)

#### Deploy / infra cerrado
- ✅ Dominio `hambuscador.cl` operativo en Vercel. `AUTH_URL`, `NEXT_PUBLIC_SITE_URL` y `R2_PUBLIC_URL` (photos.hambuscador.cl) actualizados. Google OAuth + R2 CORS sumados. Admin bootstrapped en prod.
- ✅ Migrations pendientes aplicadas en Neon (regions, comunas, resync-aggregates).

#### Listas /picas expandidas a 16 regiones + sección "cerca tuyo"
- ✅ De 5 listas (4 temáticas + Quillota) a 21 (5 temáticas nacionales + 16 regionales, una por región oficial). Nueva flagship `top-de-chile` con minRating 4.5. Quillota implícita en Valparaíso.
- ✅ `searchPlaces` + `searchPlacesMock`: filtro `regionLabel` (match exacto a `places.region`). Sumar campo nuevo significa también actualizarlo en el score function si entra al match — acá NO entra al score, es filtro WHERE puro.
- ✅ `PicasListCriteria`: `regionLabel?` + `comunaSlug` relajado de `ComunaSlug` enum a `string` (registry seed estaba stale con la tabla DB de 346 comunas).
- ✅ `/picas` reorganizada en 3 secciones: "cerca tuyo" (1 card de la región detectada via cookie hb_geo + haversine al centroide más cercano), "para todos" (5 temáticas), "explorar Chile" (15 otras regiones, ocultas si count=0). Helpers nuevos en `lib/geo.ts`: `haversineKm` + `findClosestRegion`.
- ✅ Sitemap + `generateStaticParams` iteran `PICAS_LISTS` → los 16 slugs nuevos entran automático sin tocar esos archivos.
- ✅ Motivación monetización: más superficies regionales = más inventario de "destacado" para ads hiperlocales en el futuro. Cada región es su propio mercado.

#### Recuperar password — bug fix
- ✅ Fix: `src/app/recuperar/actions.ts` exportaba `RECOVERY_OK_MESSAGE` (string). Next 15 / React 19 rechaza en build de producción con `A "use server" file can only export async functions, found string`. Dev compilaba sin warning — solo prod estricto. Mensaje movido a `recuperar-form.tsx` (client side). Regla universal: **archivos `"use server"` solo pueden exportar async functions. Ni constantes, ni objetos, ni tipos `export type` (los tipos sí pasan porque son compile-time).**
- ✅ Resend config en prod: dominio verificado es `nexofitness.cl` (sumar `hambuscador.cl` cuesta USD 20/mes adicional, se difiere). `RESEND_FROM_EMAIL = "Hambuscador <no-reply@nexofitness.cl>"` — display name "Hambuscador" en bandeja, envío legítimo desde dominio verificado.

#### DX / lecciones
- ✅ Lección: las server actions en Next 15 hacen POST a la URL de la página. El client error "An error occurred in the Server Components render" + digest cripta el mensaje real — siempre buscar el log de la function en Vercel (filtrar por digest) para ver el throw real, no quedarse con el mensaje del cliente.
- ✅ Lección: cuando agregás envs en Vercel a producción, **hay que redeployar** para que la function las vea. Setear y refrescar no alcanza — el bundle ya está deployado sin ellas.
- ✅ Lección: Resend (y cualquier transactional email) **falla silenciosa** cuando el FROM no está en un dominio verificado. La API tira 403 pero la action lo .catch() sin notificar al usuario para evitar email enumeration. Sin chequear Vercel logs o el Resend dashboard, parece que funciona — pero el email nunca sale. Patrón intencional; solo verificar logs ante quejas.

### Hecho en esta sesión (2026-05-12 sesión 8)

#### Engagement Fase 5 cerrado
- ✅ **Notificaciones in-app** (pull-based, sin email-per-evento): tabla `notifications` con índices por user_id/created_at y parcial unread. Service en `src/server/services/notifications.ts` (createNotification, getNotificationsForUser, countUnread, markRead, markAllRead). Hook fire-and-forget post-tx en `createReview` para place reclamado (`notifyOwnerOfReview` — INNER JOIN places+users, skip si claimedBy null o == authorId). Página `/perfil/notificaciones` con `after()` deferred markAllRead. Badge tomate en `/perfil`. Tipos soportados: `review_on_owned_place`, `new_follower`.
- ✅ **Sistema follows (user→user)**: tabla `follows` con PK compuesto + CHECK no-self + índice followee. Service `follows.ts`. Action `toggleFollowAction` lee `currentlyFollowing` del form pa ahorrar query. Botón seguir/siguiendo server-rendered en `/u/[username]` (cero JS), counts arriba del stats grid, pages `/u/[username]/seguidores` y `/siguiendo` con `<UserList>` compartido. Idempotente: `ON CONFLICT DO NOTHING` + check `inserted.length === 0` evita re-notificación cuando user hace re-follow.
- ✅ **Web Push notifications**: dep `web-push` (~50KB), tabla `push_subscriptions` con upsert por endpoint, auto-cleanup en 404/410. SW v2 con handler `push` (showNotification con icon + tag) y `notificationclick` (focus tab existente y navigate, o openWindow). `<PushToggle />` client component en `/perfil` con estados loading/unsupported/denied/off/on/configuring. urlBase64ToUint8Array pa la VAPID key. Hook en `createNotification` dispara `sendPushToUser` fire-and-forget (skip si user sin subs o si VAPID env no seteado). VAPID: `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT=https://hambuscador.cl`.

#### Perfil público profundizado
- ✅ **Bio + avatar custom**: schema ya tenía `users.bio` + `users.image`. Nueva `/perfil/editar` con bio textarea (max 280, counter live) + PhotoUploader max=1. Action con `imageMode` enum (`keep|new|remove`): editar bio NO borra foto. Boundary check: image debe ser del R2_PUBLIC_URL host. Botón "quitar foto actual" + deshacer.
- ✅ **`<Avatar />` reusable** (`src/components/ui/avatar.tsx`): image con fallback a iniciales. Size dinámico via inline style (no clases Tailwind purgables). Reemplazó render manual en /perfil, /u/[username], reviews del detail, /r/[id], feed notif (con badge estrella overlay).
- ✅ **Avatar de Google se ve**: `lh3.googleusercontent.com` agregado a `images.remotePatterns` en next.config.ts. Sin esto, next/image bloqueaba y se veía el alt "foto 1" del PhotoUploader que era pre-poblado con currentImage (bug visible al user). PhotoUploader ya NO se pre-puebla con currentImage — empieza vacío siempre, preview separado.
- ✅ **JWT refresh sin relogin**: `SessionProvider` wrapping en root layout (server-rendered initial session, client-side `update()`). jwt callback en `src/server/auth.ts` maneja `trigger === "update"` y copia name/image al token. `EditProfileForm` cambió de redirect server-side a `state.ok → useSession().update() → router.push("/perfil")`.

#### Avatar en el chrome de la app
- ✅ **Header del home**: `avatarImage?: string | null` opcional. Avatar real (Google o R2 custom) en vez de iniciales.
- ✅ **BottomNav split server/client** (`bottom-nav.tsx` server wrapper + `bottom-nav-client.tsx`). Server llama `auth()` y pasa `avatarImage`/`avatarInitials`. Tab "perfil" muestra avatar real con ring mostaza cuando activo — más reconocible que IconUser genérico.

#### PWA / share target
- ✅ Manifest declara `share_target` GET con title/text/url. Handler `/api/share/route.ts` heurística:
  - URL Google Maps (maps.google, maps.app.goo.gl, goo.gl, google.com/maps, google.cl) → `/agregar?nombre=...` con title limpio de sufijo "- Comuna".
  - Texto sin URL útil → `/buscar?q=...`.
  - Empty → `/`.
- ✅ Wizard `/agregar` acepta `?nombre=` (hasta 100 chars) para pre-fill. `AgregarWizard` toma `initialName?` opcional para el useState inicial del campo nombre.
- ⏳ POST/multipart con files NO soportado — requiere SW listener + caché temporal de blobs. Diferido.

#### Performance / observabilidad
- ✅ **LCP fixes**: `PlaceCard` prop `priority` opcional → `priority + fetchPriority: high` en la Image, resto lazy default. Marcamos primera card de home, /buscar (lista + grupos) y /picas/[slug] rank=1.
- ✅ **Web Vitals reporter**: `<WebVitals />` client component usa `useReportWebVitals` nativo de Next 15. Manda CLS/LCP/INP/FCP/TTFB con `sendBeacon` (fallback fetch keepalive) a `/api/vitals`. Endpoint logea estructurado a stdout (`[vitals] LCP 1850 good /`), retorna 204, cap defensivo 1KB. Solo activo en `NODE_ENV=production`. Filtrar Vercel function logs por `[vitals]` pa ver mediciones por path.

#### Search
- ✅ **SYNONYMS expandidos** (`src/lib/search.ts`): smashed/smashburger→smash, tradicional→clasica, fast→fastfood, celiaco→gluten, hamb/hamburguer/cheeseburger→burger, stgo/santi→santiago, valpo→valparaiso, conce→concepcion. STOP_WORDS sumadas: comida, lugar, local.
- ✅ **CSV export en /admin/search**: route handler `/api/admin/search/export?type=popular|zerohits&days=N`. Auth-guarded admin role, hasta 1000 rows, filename con fecha. Botones "csv" en cada sección.

#### Resend / dominio
- ✅ **`hambuscador.cl` verificado en Resend** (DKIM/SPF en Cloudflare DNS only). `RESEND_FROM_EMAIL = "Hambuscador <no-reply@hambuscador.cl>"`. Migración desde `nexofitness.cl`. ⚠️ Rotar VAPID key + Resend API key si pasaron por chat/logs.

#### DX / lecciones
- ✅ Lección: next/image bloquea hosts no listados en `remotePatterns`. Cuando falla, muestra el alt como texto — confundible con un bug del feature. Lista vigente: R2_PUBLIC_URL host, `lh3.googleusercontent.com`, `images.unsplash.com`.
- ✅ Lección: Web Share Target con files requiere POST multipart + SW listener — complejidad alta. GET con title/text/url cubre 90% de los casos UX (compartir desde Google Maps, notas, etc).
- ✅ Lección: JWT cacheado en cliente NO refresca cambiar `users.image`/`users.name` en DB. Pattern Auth.js v5: `useSession().update({ user: { ... } })` dispara `trigger: "update"` en jwt callback. Requiere `<SessionProvider>` (next-auth/react) wrapping en root layout.
- ✅ Lección: BottomNav split server/client cuando el cliente necesita data del session — server wrapper llama `auth()`, client recibe props y mantiene su lógica reactiva (usePathname).
- ✅ Lección: Push web en iOS Safari requiere PWA instalada vía Add to Home Screen. Tab regular del browser NO recibe push.
- ✅ Lección: re-follow no debe re-notificar. Pattern: `INSERT ... ON CONFLICT DO NOTHING RETURNING`, si la longitud retornada es 0 → ya seguía → no crear notification.

### Hecho en esta sesión (2026-05-13 sesión 10 — CWV pass)

Track: **CWV / Lighthouse audit** — 7 commits enfocados en perf, sin features nuevos. (Sesión 9 cubrió listas /picas + Web Vitals DB + email digest + OG con foto + share files + welcome — ver memoria `project_state` / `Próximos pasos` para detalle.)

#### Bundle inicial / hydration
- ✅ **Header → server component** (c8aefa5). Split: `header.tsx` (server, renderiza el Link cuando hay `backHref`) + `back-button.tsx` (tiny client island con `router.back()`). Páginas con `backHref` set (picas, perfil, /u/, /r/, reclamar, etc) ya no embarcan el bundle de `useRouter`. Ganancia ~3-4KB JS por page con back-link.
- ✅ **PwaInstaller + WebVitals lazy** (8bb8455). Nuevo `deferred-chrome.tsx` ("use client") con `dynamic(() => …, { ssr: false })` para ambos. No producen markup → SSR no aporta nada. Quedan en chunks separados, hidratan post-paint. Saca ~5KB del bundle inicial del layout.
- ✅ **PlacesMap chunk dinámico** (28f15da). `?vista=lista` (default y mayoritaria) ya no descarga MapLibre + pmtiles + CSS de maplibre-gl. `next/dynamic` con `loading` que muestra spinner en lienzo mostaza-deep mientras carga. Ganancia ~150KB en lista.

#### Network / payload
- ✅ **Preconnect a R2 photos** (fe1e5e4). `<link rel="preconnect" href={R2_PUBLIC_URL origin} crossOrigin="anonymous">` + `dns-prefetch` fallback en root layout. Lee `R2_PUBLIC_URL` server-side; si no está, no emite nada (modo demo). Ganancia ~100-200ms en LCP de cualquier card con foto.
- ✅ **MapPlace projection** (a0e2832). El mapa solo usa 8 campos del Place — antes con `limit=5000` mandábamos el Place full (photos, hours, address, phone, whatsapp, etc) ≈3MB de RSC payload. Tipo `MapPlace = Pick<Place, …>` + la page proyecta antes de pasar al cliente. Payload baja ~80% (a ~600KB).
- ✅ **PlaceCard compact quality=70** (b0651d3). Thumbs de 78px no justifican calidad 75 default — bajar a 70 ahorra ~15-20% bytes sin pérdida visible. Hero featured (128px) y avatares se mantienen en default.

#### DB / SQL
- ✅ **Detail page overfetch fix** (1392497). Antes traíamos 20 reseñas para mostrar 2 + buscar la propia con `reviews.find()`. Ahora:
  - `getReviewsByPlaceId` acepta `excludeAuthorId` → la lista trae 6 (excluyendo la del user logueado).
  - Nueva `getMyReviewWithAuthor` con JOIN a `users` → la reseña propia se trae aparte directamente como `Review` shape.
  - `getMyReviewForPlace` se mantiene retornando `DbReview` raw para el flow de `/calificar` (preserva semántica NULL de aspect ratings).
  - Bonus: bug latente fixed — antes, si el user tenía reseña antigua en un local con muchas reviews, `mine` quedaba null aunque tuviera reseña (no estaba en las primeras 20).

#### DX / lecciones
- ✅ Lección: **`next/dynamic` con `ssr: false` solo funciona en client components**. Para defererir un componente cliente desde el root layout (que es server), envolver en un wrapper "use client" que haga el `dynamic()` adentro. Patrón aplicado en `deferred-chrome.tsx`.
- ✅ Lección: **proyectar antes de pasar a client components**. RSC serializa todos los props que cruzan la frontera server→client. Si un client component solo usa 8 de 25 campos, `.map(p => ({ ...subset }))` en la page reduce el payload sin tocar el shape de DB. Para listas grandes (5000+) es ganancia masiva.
- ✅ Lección: **`getMyXForPlace` patrones suelen necesitar 2 variantes**: una raw (DbReview) para forms/upserts que necesitan semántica NULL, otra joined (Review con author) para render UI. No "mejorar" la primera rompe el form.
- ✅ Lección: **Header split server/client tiene precondición**. Cuando casi todas las pages pasan `backHref` (back es Link puro), no `router.back()`, conviene hacer Header server y mover `useRouter()` a un mini client island. Si la mayoría usa router.back, no vale la pena.
- ✅ Lección: **`<a><button>…</button></a>` es HTML inválido**. Lo vi en home.tsx (Link wrapping Chip). Browser lo acepta pero a11y/lint puede flaggear. Cuando Chip se usa pasivo (dentro de Link), debería ser un `<span>` visual; cuando es interactivo (filtro toggle), `<button>`. Anotado pa refactor futuro, no lo toqué.

### Próximos pasos pendientes

#### Deploy / infra

VAPID keys configuradas en Vercel ✅ (2026-05-13).
PMTiles propio en R2 ✅ (2026-05-13). Bucket separado `hambuscador-tiles`, custom domain `tiles.hambuscador.cl`, CORS pa hambuscador.cl + *.vercel.app + localhost:3000. Archivo `chile.pmtiles` (595 MB, z0-z14, bbox -110,-56,-66,-17, build 20260512 de Protomaps). Setear en Vercel: `NEXT_PUBLIC_PMTILES_URL=https://tiles.hambuscador.cl/chile.pmtiles` → redeploy. El código (`places-map.tsx`, `pin-picker-map.tsx`) cae a OSM raster cuando la env var está vacía.

**Refresh:** correr `pmtiles extract https://build.protomaps.com/YYYYMMDD.pmtiles chile.pmtiles --bbox=-110,-56,-66,-17 --maxzoom=14` con un build reciente, subir al mismo bucket con `rclone copy chile.pmtiles r2:hambuscador-tiles/`. Daily builds quedan ~3 meses retenidos; ideal refresh trimestral.

#### Código
1. **Service worker + JWT**: sesiones JWT siguen vivas hasta expiry (30d) aunque banees al user. Para invalidar inmediato habría que migrar a database sessions. No urgente.
2. **OG con foto del local** ✅ (2026-05-13). `sharp` 0.34.5 incluido. Place OG (`[comuna]/[slug]/opengraph-image.tsx`) ahora usa `place.photos[0]` como hero background con overlay carbon para legibilidad; logo flota top-left si existe. ImageResponse PNG → sharp jpeg q70 mozjpeg → Response image/jpeg. Mantiene <200KB para preview WhatsApp/IG. Sin foto cae al gradient mostaza+watermark anterior. Picas y review OGs siguen con gradient (más livianos y sin foto que sumar).
3. **PWA share target POST/files** ✅ (2026-05-13). Manifest declara `method: POST` + `enctype: multipart/form-data` + `files` param. SW (v3) intercepta el POST a `/api/share`, extrae los Files con FormData, los guarda en IndexedDB (`hambuscador-share/files/current`) y redirige a `/agregar?share=1`. AgregarWizard, al montar con shareIntent, consume IDB y pasa los Files como `initialFiles` al PhotoUploader, que los sube auto al R2. Single-use (IDB clear post-read), TTL 5min defensivo. Fallback: POST sin SW redirige a `/agregar?share=1` limpio.
4. **Más listas curadas /picas**: por comuna específica (Providencia, Las Condes), por horario nocturno, por temática. Mover a tabla `picas_lists` con CRUD admin cuando se justifique.
5. **Email digest opt-in** para notificaciones (batch diario/semanal, no per-evento). Hoy todo pull + push web.
6. **Persistir Web Vitals**: hoy van a stdout, leíbles desde Vercel logs. Cuando se quiera trending, persistir en tabla `web_vitals` o forwardear a servicio (Plausible custom events, Datadog RUM).

#### Optimización
- **Core Web Vitals target 90+** (PageSpeed Insights baseline pendiente). Quick wins de sesión 10 aplicados — pendiente medir delta con tráfico real en `/admin/perf?dias=7` (24-48h post-deploy).
- **Lighthouse PWA score** verificar que pasa toda la check (offline, installable, manifest, share_target).
- **Refactor pendiente**: Chip server/client split (usado pasivo en home dentro de Link genera `<a><button>` inválido). No urgente.
- **Refactor pendiente**: `getPicasListsWithCounts` corre 32 queries paralelas pa el index de /picas. Cache 5min mitiga, pero un service light (count + 1 preview por lista en una sola query) bajaría TTFB en cold cache.

## Recursos

- Brand guide completa: ver `BRAND.md` en la raíz (copia del que se entregó en la sesión de identidad visual).
- Logos y assets: `public/`.
- Mockups de referencia: en el chat anterior con Claude (8 pantallas mobile diseñadas).
