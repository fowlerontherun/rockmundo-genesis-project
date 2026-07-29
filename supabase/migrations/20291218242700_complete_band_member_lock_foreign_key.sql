-- Complete the band schema work deferred by numeric migrations 086 and 087
-- after the timestamped base schema has created public.bands.

DO $$
BEGIN
  IF to_regclass('public.band_member_locks') IS NULL THEN
    RAISE EXCEPTION 'band_member_locks_missing_before_completion';
  END IF;

  IF to_regclass('public.bands') IS NULL THEN
    RAISE EXCEPTION 'bands_missing_before_numeric_migration_completion';
  END IF;

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

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'band_member_locks_band_id_fkey'
      AND conrelid = 'public.band_member_locks'::regclass
      AND contype = 'f'
  ) THEN
    ALTER TABLE public.band_member_locks
      ADD CONSTRAINT band_member_locks_band_id_fkey
      FOREIGN KEY (band_id)
      REFERENCES public.bands(id)
      ON DELETE CASCADE
      NOT VALID;
  END IF;
END
$$;

ALTER TABLE public.band_member_locks
  VALIDATE CONSTRAINT band_member_locks_band_id_fkey;
