-- This migration repeats the same achievement, equipment, venue and streaming
-- catalogue rows owned idempotently by
-- 20250916085440_446206dd-4681-4653-9198-bcc512ebdd45.sql.
--
-- Its original ON CONFLICT (name) clauses were invalid because these legacy
-- tables did not have matching unique constraints. Keeping the timestamp as an
-- explicit no-op preserves migration history without duplicating catalogue data.
DO $$
BEGIN
  RAISE NOTICE 'Third duplicate baseline seed migration intentionally skipped';
END
$$;