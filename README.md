<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="public/logo-dark.svg">
    <img src="public/logo.svg" alt="Hambuscador" height="80" />
  </picture>
</p>

# Hambuscador

> La picá hamburguesera de Chile.

Buscador, registro y rating de hamburgueserías a lo largo de todo Chile. Mobile-first, SEO-friendly.

## Quick start

```bash
# Requisitos: Node 20+, pnpm 9+, Docker (para Postgres local)

pnpm install
cp .env.example .env.local
# generar AUTH_SECRET: openssl rand -base64 32
# (o pegale cualquier string largo en dev)

pnpm db:up                # levanta Postgres + PostGIS
pnpm db:push              # crea las tablas
pnpm db:postgis           # agrega PostGIS extension + índices
pnpm db:seed              # carga ~12 hamburgueserías de Quillota

pnpm dev                  # → http://localhost:3000
```

**Modo demo (sin Docker):** si saltás todo lo de `db:*`, el proyecto igual corre con datos mock — los servicios detectan que no hay `DATABASE_URL` y caen al fallback automáticamente.

## Stack

**Frontend** · Next.js 15 · React 19 · App Router · TypeScript estricto · Tailwind v4 · Tabler Icons

**Backend** · PostgreSQL 16 + PostGIS · Drizzle ORM · Auth.js v5 (Google + Credentials) · zod · bcryptjs

## Comandos

```bash
# Frontend
pnpm dev          pnpm build        pnpm start
pnpm lint         pnpm typecheck    pnpm format

# Database
pnpm db:up        levanta docker compose
pnpm db:down      lo baja (data persiste en volume)
pnpm db:push      schema.ts → DB (dev)
pnpm db:postgis   PostGIS extension + columna location + índices GIST
pnpm db:generate  genera migraciones SQL desde schema.ts
pnpm db:migrate   aplica migraciones (prod)
pnpm db:studio    UI de admin de la DB
pnpm db:seed      carga Quillota
pnpm db:reset     nuke + up + push + postgis + seed (dev only)
```

## Estructura

```
src/
├── app/         rutas y layout (Next.js App Router)
├── components/  UI (ui, place, nav, brand)
├── lib/         utils, constants, data orchestrator
├── server/      DB client, services, auth (server-only)
└── types/       tipos del dominio + augmentaciones

drizzle/         postgis.sql (setup geo)
scripts/         seed.ts, run-sql.ts
```

Más detalle en [`CLAUDE.md`](./CLAUDE.md).

## Trabajando con Claude Code

Este proyecto está optimizado para [Claude Code](https://www.npmjs.com/package/@anthropic-ai/claude-code):

```bash
npm install -g @anthropic-ai/claude-code
claude    # en la raíz del proyecto
```

Claude Code va a leer `CLAUDE.md` automáticamente y va a tener contexto de stack, convenciones, brand tokens, schema, services, roadmap y reglas duras.

## Identidad de marca

Ver [`BRAND.md`](./BRAND.md) para la guía completa: paleta, tipografía, voz, reglas de uso del logo. Assets en `public/`.

## Estado actual

**Fase 2** — backend funcionando: schema en Drizzle, PostgreSQL+PostGIS para queries geo, Auth.js v5 con Drizzle adapter, services con fallback a mock, seed de Quillota. Próximo paso: Server Actions para crear local + publicar reseña, hookear las pages de auth a `signIn()`.

## Licencia

Privado. Todos los derechos reservados.
