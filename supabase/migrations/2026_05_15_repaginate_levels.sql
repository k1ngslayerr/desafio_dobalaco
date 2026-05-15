-- ============================================================
-- Migration: repaginate_levels
--
-- Old formula: xp_required(n) = ROUND(100 × 1.15^(n-1))
--   Level 1→2 gap = 15 XP → one 100 XP challenge jumped 5+ levels instantly.
--
-- New formula: xp_required(n) = 100×(n-1) + 10×(n-1)²
--   Gap grows linearly: 110 XP at level 1→2, 2070 XP at level 99→100.
--
-- Key milestones at ~1,000 XP/week:
--   Level  2 →    110 XP  (~same day)
--   Level  5 →    560 XP  (~4 days)
--   Level 10 →  1,710 XP  (~1.7 weeks)
--   Level 20 →  5,510 XP  (~5.5 weeks / 1.5 months)
--   Level 30 → 11,310 XP  (~11 weeks  / 3 months)
--   Level 50 → 28,910 XP  (~29 weeks  / 7 months)
--   Level100 →107,910 XP  (~108 weeks / 2 years)
--
-- art_tier stays ceil(level / 10) — unchanged.
-- ============================================================

-- Replace all rows (TRUNCATE is safe here: FK from users.level references
-- level_config.level but ON DELETE action is not CASCADE; we're replacing
-- the whole table atomically inside a transaction).
TRUNCATE public.level_config;

INSERT INTO public.level_config (level, xp_required, art_tier)
SELECT
  n                                             AS level,
  (100 * (n - 1) + 10 * (n - 1) * (n - 1))::bigint AS xp_required,
  CEIL(n / 10.0)::integer                        AS art_tier
FROM generate_series(1, 100) AS n;

-- Recalculate every existing user's level with the new thresholds so nobody
-- is stuck at a level that no longer matches their XP.
DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN SELECT id FROM public.users LOOP
    PERFORM public.recalculate_level(r.id);
  END LOOP;
END;
$$;
