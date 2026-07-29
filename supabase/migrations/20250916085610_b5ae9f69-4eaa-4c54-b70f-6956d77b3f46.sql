-- This migration is another duplicate of the achievement, equipment, venue and
-- streaming catalogue rows owned idempotently by
-- 20250916085440_446206dd-4681-4653-9198-bcc512ebdd45.sql.
--
-- Its original ON CONFLICT (name) clauses were invalid because the legacy
-- tables did not have matching unique constraints. Keeping this timestamp as
-- an explicit no-op preserves migration history without duplicating data.
DO $$
BEGIN
  RAISE NOTICE 'Fourth duplicate baseline seed migration intentionally skipped';
END
$$;