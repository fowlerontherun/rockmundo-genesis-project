-- Align profile_daily_xp_grants with stipend flow expectations
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'profile_daily_xp_grants'
      AND column_name = 'xp_amount'
  ) AND NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'profile_daily_xp_grants'
      AND column_name = 'xp_awarded'
  ) THEN
    UPDATE public.profile_daily_xp_grants
    SET xp_amount = 150
    WHERE xp_amount IS NULL OR xp_amount <= 0;

    ALTER TABLE public.profile_daily_xp_grants
      RENAME COLUMN xp_amount TO xp_awarded;
  END IF;
END
$$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'profile_daily_xp_grants'
      AND column_name = 'xp_awarded'
  ) THEN
    UPDATE public.profile_daily_xp_grants
    SET xp_awarded = 150
    WHERE xp_awarded IS NULL OR xp_awarded <= 0;

    ALTER TABLE public.profile_daily_xp_grants
      ALTER COLUMN xp_awarded SET NOT NULL;
  END IF;
END
$$;

ALTER TABLE public.profile_daily_xp_grants
  DROP COLUMN IF EXISTS source,
  DROP COLUMN IF EXISTS created_at;

ALTER TABLE public.profile_daily_xp_grants
  ADD COLUMN IF NOT EXISTS metadata jsonb;

UPDATE public.profile_daily_xp_grants
SET metadata = '{}'::jsonb
WHERE metadata IS NULL;

ALTER TABLE public.profile_daily_xp_grants
  ALTER COLUMN metadata SET NOT NULL,
  ALTER COLUMN metadata SET DEFAULT '{}'::jsonb;

ALTER TABLE public.profile_daily_xp_grants
  ADD COLUMN IF NOT EXISTS claimed_at timestamptz;

UPDATE public.profile_daily_xp_grants
SET claimed_at = COALESCE(claimed_at, timezone('utc', now()));

ALTER TABLE public.profile_daily_xp_grants
  ALTER COLUMN claimed_at SET NOT NULL,
  ALTER COLUMN claimed_at SET DEFAULT timezone('utc', now());

ALTER TABLE public.profile_daily_xp_grants
  DROP CONSTRAINT IF EXISTS profile_daily_xp_grants_metadata_object;

ALTER TABLE public.profile_daily_xp_grants
  ADD CONSTRAINT profile_daily_xp_grants_metadata_object CHECK (
    jsonb_typeof(metadata) = 'object'
  );

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'profile_daily_xp_grants_positive_award'
      AND conrelid = 'public.profile_daily_xp_grants'::regclass
  ) THEN
    ALTER TABLE public.profile_daily_xp_grants
      ADD CONSTRAINT profile_daily_xp_grants_positive_award CHECK (xp_awarded > 0);
  END IF;
END
$$;

DELETE FROM public.profile_daily_xp_grants a
USING public.profile_daily_xp_grants b
WHERE a.ctid < b.ctid
  AND a.profile_id = b.profile_id
  AND a.grant_date = b.grant_date;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'profile_daily_xp_grants_unique_day'
      AND conrelid = 'public.profile_daily_xp_grants'::regclass
  ) THEN
    ALTER TABLE public.profile_daily_xp_grants
      ADD CONSTRAINT profile_daily_xp_grants_unique_day UNIQUE (profile_id, grant_date);
  END IF;
END
$$;

CREATE INDEX IF NOT EXISTS idx_profile_daily_xp_grants_profile
  ON public.profile_daily_xp_grants (profile_id, grant_date DESC);
