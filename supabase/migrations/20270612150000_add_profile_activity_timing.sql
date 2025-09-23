-- Track timing metadata for active profile sessions and reflect it in the activity feed
BEGIN;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS current_activity_started_at timestamptz,
  ADD COLUMN IF NOT EXISTS current_activity_duration_minutes integer,
  ADD COLUMN IF NOT EXISTS current_activity_ends_at timestamptz;

ALTER TABLE public.activity_feed
  ADD COLUMN IF NOT EXISTS status text,
  ADD COLUMN IF NOT EXISTS duration_minutes integer;

COMMIT;
