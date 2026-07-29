-- Standardise profile activity end-time calculation across fresh and deployed schemas.
-- PostgreSQL does not allow the previous timestamptz + interval expression in a
-- stored generated column because that operator is not immutable.

DO $$
BEGIN
  IF to_regclass('public.profile_activity_statuses') IS NULL THEN
    RAISE EXCEPTION 'profile_activity_statuses_missing_before_end_time_standardisation';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'profile_activity_statuses'
      AND column_name = 'ends_at'
      AND is_generated = 'ALWAYS'
  ) THEN
    EXECUTE 'ALTER TABLE public.profile_activity_statuses ALTER COLUMN ends_at DROP EXPRESSION';
  END IF;
END
$$;

ALTER TABLE public.profile_activity_statuses
  ADD COLUMN IF NOT EXISTS ends_at timestamptz;

CREATE OR REPLACE FUNCTION public.sync_profile_activity_status_ends_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  NEW.ends_at = CASE
    WHEN NEW.duration_minutes IS NULL THEN NULL
    ELSE NEW.started_at + make_interval(mins => NEW.duration_minutes)
  END;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS profile_activity_statuses_sync_ends_at
  ON public.profile_activity_statuses;

CREATE TRIGGER profile_activity_statuses_sync_ends_at
  BEFORE INSERT OR UPDATE ON public.profile_activity_statuses
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_profile_activity_status_ends_at();

UPDATE public.profile_activity_statuses
SET ends_at = CASE
  WHEN duration_minutes IS NULL THEN NULL
  ELSE started_at + make_interval(mins => duration_minutes)
END
WHERE ends_at IS DISTINCT FROM CASE
  WHEN duration_minutes IS NULL THEN NULL
  ELSE started_at + make_interval(mins => duration_minutes)
END;

NOTIFY pgrst, 'reload schema';