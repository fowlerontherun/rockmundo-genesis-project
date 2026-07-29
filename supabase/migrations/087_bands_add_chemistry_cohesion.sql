-- Migration 087: Add chemistry and cohesion attributes to bands
--
-- Numeric migrations run before the timestamped base schema. Existing
-- deployments may already have public.bands here, but fresh databases do not.
-- Apply immediately when possible and otherwise let the completion migration
-- add the same columns and checks after the base schema has run.

DO $$
BEGIN
  IF to_regclass('public.bands') IS NOT NULL THEN
    ALTER TABLE public.bands
      ADD COLUMN IF NOT EXISTS chemistry integer NOT NULL DEFAULT 20,
      ADD COLUMN IF NOT EXISTS cohesion integer NOT NULL DEFAULT 20;

    IF NOT EXISTS (
      SELECT 1
      FROM pg_constraint
      WHERE conname = 'bands_chemistry_range'
        AND conrelid = 'public.bands'::regclass
    ) THEN
      ALTER TABLE public.bands
        ADD CONSTRAINT bands_chemistry_range
        CHECK (chemistry BETWEEN 0 AND 100);
    END IF;

    IF NOT EXISTS (
      SELECT 1
      FROM pg_constraint
      WHERE conname = 'bands_cohesion_range'
        AND conrelid = 'public.bands'::regclass
    ) THEN
      ALTER TABLE public.bands
        ADD CONSTRAINT bands_cohesion_range
        CHECK (cohesion BETWEEN 0 AND 100);
    END IF;
  END IF;
END
$$;
