-- ============================================================================
-- Resync de agregados denormalizados de places — one-shot.
-- ----------------------------------------------------------------------------
-- Aplicar UNA VEZ en Neon prod después del deploy del ban retroactivo
-- (commit `feat(moderacion): ban retroactivo en lecturas...`).
--
-- Por qué: la migración de comportamiento NO recalcula los agregados de places
-- que ya tenían reseñas de usuarios baneados antes del deploy. Hasta que algo
-- dispare `recomputePlaceAggregates` (nueva reseña, edición, ban/unban), el
-- `rating_avg` mostrado público sigue incluyendo a los baneados.
--
-- Esta query recalcula todos los places de una vez, excluyendo reseñas de
-- baneados. Idempotente: se puede correr N veces sin efectos colaterales.
-- ============================================================================

UPDATE places p
SET
  rating_avg = COALESCE((
    SELECT AVG(r.rating)::numeric(3,2)
    FROM reviews r
    JOIN users u ON u.id = r.author_id
    WHERE r.place_id = p.id AND u.banned_at IS NULL
  ), NULL),
  review_count = (
    SELECT COUNT(*)::int
    FROM reviews r
    JOIN users u ON u.id = r.author_id
    WHERE r.place_id = p.id AND u.banned_at IS NULL
  ),
  updated_at = NOW()
WHERE p.review_count > 0;
