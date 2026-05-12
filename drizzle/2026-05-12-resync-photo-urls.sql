-- Resync de URLs de fotos: del bucket público r2.dev al dominio custom.
--
-- Contexto: las primeras fotos cargadas usaron el endpoint default de R2
-- (pub-fbbb0c1401eb442cb484b22514d3ad85.r2.dev). Después conectamos el
-- dominio custom photos.hambuscador.cl al mismo bucket. Los uploads nuevos
-- ya se guardan con el dominio custom (R2_PUBLIC_URL); este script
-- reescribe los viejos.
--
-- Idempotente: WHERE filtra rows que aún tienen el host viejo, así re-correrlo
-- no es destructivo ni hace UPDATEs innecesarios.
--
-- Fields tocados:
--   - places.photos       text[]
--   - places.logo         text
--   - reviews.photos      text[]
--   - place_claims.proof_url  text
--   - users.image         text (solo si es R2 — no toca avatares de Google)

-- Los hosts viejo/nuevo van inline en cada UPDATE (psql \set no se soporta
-- al ejecutar via node-pg, que es como corremos las migraciones en VPS).
--
-- OLD: pub-fbbb0c1401eb442cb484b22514d3ad85.r2.dev
-- NEW: photos.hambuscador.cl

-- places.photos (array): rewrite cada elemento.
UPDATE places
SET photos = (
  SELECT array_agg(
    replace(p, 'pub-fbbb0c1401eb442cb484b22514d3ad85.r2.dev', 'photos.hambuscador.cl')
  )
  FROM unnest(photos) AS p
)
WHERE EXISTS (
  SELECT 1 FROM unnest(photos) p
  WHERE p LIKE '%pub-fbbb0c1401eb442cb484b22514d3ad85.r2.dev%'
);

-- places.logo (text): single replace.
UPDATE places
SET logo = replace(logo, 'pub-fbbb0c1401eb442cb484b22514d3ad85.r2.dev', 'photos.hambuscador.cl')
WHERE logo LIKE '%pub-fbbb0c1401eb442cb484b22514d3ad85.r2.dev%';

-- reviews.photos (array).
UPDATE reviews
SET photos = (
  SELECT array_agg(
    replace(p, 'pub-fbbb0c1401eb442cb484b22514d3ad85.r2.dev', 'photos.hambuscador.cl')
  )
  FROM unnest(photos) AS p
)
WHERE EXISTS (
  SELECT 1 FROM unnest(photos) p
  WHERE p LIKE '%pub-fbbb0c1401eb442cb484b22514d3ad85.r2.dev%'
);

-- place_claims.proof_url (text).
UPDATE place_claims
SET proof_url = replace(proof_url, 'pub-fbbb0c1401eb442cb484b22514d3ad85.r2.dev', 'photos.hambuscador.cl')
WHERE proof_url LIKE '%pub-fbbb0c1401eb442cb484b22514d3ad85.r2.dev%';

-- users.image (text): solo si vive en R2 (no tocar googleusercontent ni otros).
UPDATE users
SET image = replace(image, 'pub-fbbb0c1401eb442cb484b22514d3ad85.r2.dev', 'photos.hambuscador.cl')
WHERE image LIKE '%pub-fbbb0c1401eb442cb484b22514d3ad85.r2.dev%';
