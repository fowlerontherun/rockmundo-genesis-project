-- Restore compatibility columns that may have been skipped when the historical
-- migration collided with the authoritative jam-session trigger. Later
-- migrations own the final activity policies and timer triggers.

ALTER TABLE public.profile_activity_statuses
  ADD COLUMN IF NOT EXISTS activity_type varchar,
  ADD COLUMN IF NOT EXISTS completed_at timestamptz,
  ADD COLUMN IF NOT EXISTS metadata jsonb DEFAULT '{}'::jsonb;

ALTER TABLE public.jam_sessions
  ADD COLUMN IF NOT EXISTS status varchar NOT NULL DEFAULT 'active';
