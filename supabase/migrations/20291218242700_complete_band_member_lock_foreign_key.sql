-- Complete the relationship deferred by numeric migration 086 after the
-- timestamped base schema has created public.bands.

DO $$
BEGIN
  IF to_regclass('public.band_member_locks') IS NULL THEN
    RAISE EXCEPTION 'band_member_locks_missing_before_foreign_key';
  END IF;

  IF to_regclass('public.bands') IS NULL THEN
    RAISE EXCEPTION 'bands_missing_before_band_member_lock_foreign_key';
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
