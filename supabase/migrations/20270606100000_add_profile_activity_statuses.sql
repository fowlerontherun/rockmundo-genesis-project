-- Adds activity timing metadata to profiles via dedicated status table and extends activity_feed

-- Create table to track the current timed activity for a profile
CREATE TABLE IF NOT EXISTS public.profile_activity_statuses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  status text NOT NULL,
  started_at timestamptz NOT NULL DEFAULT now(),
  duration_minutes integer,
  ends_at timestamptz GENERATED ALWAYS AS (
    CASE
      WHEN duration_minutes IS NULL THEN NULL
      ELSE started_at + make_interval(mins => duration_minutes)
    END
  ) STORED,
  song_id uuid REFERENCES public.songs(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT profile_activity_statuses_duration_check CHECK (duration_minutes IS NULL OR duration_minutes >= 0)
);

-- Ensure one active status per profile
CREATE UNIQUE INDEX IF NOT EXISTS profile_activity_statuses_profile_id_key
  ON public.profile_activity_statuses (profile_id);

-- Helpful lookup index for song based lookups
CREATE INDEX IF NOT EXISTS profile_activity_statuses_song_id_idx
  ON public.profile_activity_statuses (song_id);

-- Keep updated_at fresh on change
CREATE OR REPLACE FUNCTION public.set_profile_activity_status_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS profile_activity_statuses_set_updated_at
  ON public.profile_activity_statuses;

CREATE TRIGGER profile_activity_statuses_set_updated_at
  BEFORE UPDATE ON public.profile_activity_statuses
  FOR EACH ROW
  EXECUTE FUNCTION public.set_profile_activity_status_updated_at();

-- Enable row level security and policies
ALTER TABLE public.profile_activity_statuses ENABLE ROW LEVEL SECURITY;

CREATE POLICY IF NOT EXISTS "Profile activity statuses are viewable by everyone"
  ON public.profile_activity_statuses
  FOR SELECT
  USING (true);

CREATE POLICY IF NOT EXISTS "Profiles manage their own activity status"
  ON public.profile_activity_statuses
  FOR ALL
  USING (
    EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.id = profile_id AND p.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.id = profile_id AND p.user_id = auth.uid()
    )
  );

-- Extend activity_feed to reference timed statuses
ALTER TABLE public.activity_feed
  ADD COLUMN IF NOT EXISTS status text,
  ADD COLUMN IF NOT EXISTS duration_minutes integer,
  ADD COLUMN IF NOT EXISTS status_id uuid REFERENCES public.profile_activity_statuses(id) ON DELETE SET NULL;

-- Maintain data quality on new duration column
ALTER TABLE public.activity_feed
  ADD CONSTRAINT IF NOT EXISTS activity_feed_duration_check
  CHECK (duration_minutes IS NULL OR duration_minutes >= 0);
