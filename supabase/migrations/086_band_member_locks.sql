-- Migration 086: Band member lock windows for activities

CREATE TYPE public.band_member_activity_type AS ENUM ('jam', 'gig', 'tour', 'recording', 'other');

CREATE TABLE public.band_member_locks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  activity_type public.band_member_activity_type NOT NULL,
  band_id uuid NOT NULL REFERENCES public.bands(id) ON DELETE CASCADE,
  lock_start_at timestamptz NOT NULL,
  lock_end_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (lock_end_at > lock_start_at),
  UNIQUE (user_id, activity_type)
);

CREATE INDEX IF NOT EXISTS idx_band_member_locks_user ON public.band_member_locks(user_id);
CREATE INDEX IF NOT EXISTS idx_band_member_locks_band ON public.band_member_locks(band_id);
CREATE INDEX IF NOT EXISTS idx_band_member_locks_window ON public.band_member_locks(lock_start_at, lock_end_at);
