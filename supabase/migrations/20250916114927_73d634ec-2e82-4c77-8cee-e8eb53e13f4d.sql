-- This migration attempted to DROP public.songs CASCADE and recreate it with an
-- incompatible user_id ownership model. The preceding compatibility migration
-- now adds the intended fields safely to the established artist_id schema.
--
-- Keeping this timestamp as an explicit no-op preserves migration history while
-- protecting written songs, chart entries and all dependent relationships.
DO $$
BEGIN
  RAISE NOTICE 'Destructive duplicate song rebuild intentionally skipped';
END
$$;