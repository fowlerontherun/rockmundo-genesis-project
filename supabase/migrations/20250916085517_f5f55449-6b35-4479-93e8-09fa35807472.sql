-- This migration was an accidental byte-for-byte duplicate of
-- 20250916085440_446206dd-4681-4653-9198-bcc512ebdd45.sql.
--
-- Trigger reconciliation and missing baseline seeds are owned by the earlier
-- migration. Keeping this timestamp as an explicit no-op preserves migration
-- history without creating duplicate triggers or duplicate catalogue rows.
DO $$
BEGIN
  RAISE NOTICE 'Duplicate auth trigger and seed migration intentionally skipped';
END
$$;