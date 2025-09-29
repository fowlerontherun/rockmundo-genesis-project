-- Ensure profile activity statuses table exists for real-time activity tracking
CREATE TABLE IF NOT EXISTS public.profile_activity_statuses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  status text NOT NULL,
  started_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  duration_minutes integer,
  ends_at timestamptz GENERATED ALWAYS AS (
    CASE
      WHEN duration_minutes IS NULL THEN NULL
      ELSE started_at + make_interval(mins => duration_minutes)
    END
  ) STORED,
  song_id uuid REFERENCES public.songs(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  CONSTRAINT profile_activity_statuses_duration_check CHECK (duration_minutes IS NULL OR duration_minutes >= 0)
);

CREATE UNIQUE INDEX IF NOT EXISTS profile_activity_statuses_profile_id_key
  ON public.profile_activity_statuses (profile_id);

CREATE INDEX IF NOT EXISTS profile_activity_statuses_song_id_idx
  ON public.profile_activity_statuses (song_id);

CREATE OR REPLACE FUNCTION public.set_profile_activity_status_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = timezone('utc', now());
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS profile_activity_statuses_set_updated_at
  ON public.profile_activity_statuses;

CREATE TRIGGER profile_activity_statuses_set_updated_at
  BEFORE UPDATE ON public.profile_activity_statuses
  FOR EACH ROW
  EXECUTE FUNCTION public.set_profile_activity_status_updated_at();

ALTER TABLE public.profile_activity_statuses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Profile activity statuses are viewable by everyone"
  ON public.profile_activity_statuses;
CREATE POLICY "Profile activity statuses are viewable by everyone"
  ON public.profile_activity_statuses
  FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Profiles manage their own activity status"
  ON public.profile_activity_statuses;
CREATE POLICY "Profiles manage their own activity status"
  ON public.profile_activity_statuses
  FOR ALL
  USING (
    EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.id = profile_id
        AND p.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.id = profile_id
        AND p.user_id = auth.uid()
    )
  );

-- Align activity feed references so Supabase REST can resolve joins
ALTER TABLE public.activity_feed
  ADD COLUMN IF NOT EXISTS status text,
  ADD COLUMN IF NOT EXISTS duration_minutes integer,
  ADD COLUMN IF NOT EXISTS status_id uuid REFERENCES public.profile_activity_statuses(id) ON DELETE SET NULL,
  ADD CONSTRAINT IF NOT EXISTS activity_feed_duration_check
    CHECK (duration_minutes IS NULL OR duration_minutes >= 0);

-- Expand songwriting projects with the gameplay fields used by the app
ALTER TABLE public.songwriting_projects
  ADD COLUMN IF NOT EXISTS theme_id uuid REFERENCES public.song_themes(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS chord_progression_id uuid REFERENCES public.chord_progressions(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS initial_lyrics text,
  ADD COLUMN IF NOT EXISTS music_progress integer NOT NULL DEFAULT 0 CHECK (music_progress >= 0 AND music_progress <= 2000),
  ADD COLUMN IF NOT EXISTS lyrics_progress integer NOT NULL DEFAULT 0 CHECK (lyrics_progress >= 0 AND lyrics_progress <= 2000),
  ADD COLUMN IF NOT EXISTS total_sessions integer NOT NULL DEFAULT 0 CHECK (total_sessions >= 0),
  ADD COLUMN IF NOT EXISTS estimated_sessions integer NOT NULL DEFAULT 3 CHECK (estimated_sessions >= 0),
  ADD COLUMN IF NOT EXISTS quality_score integer NOT NULL DEFAULT 50 CHECK (quality_score >= 0 AND quality_score <= 100),
  ADD COLUMN IF NOT EXISTS is_locked boolean NOT NULL DEFAULT false;

-- Ensure existing rows adopt sensible defaults for new songwriting columns
UPDATE public.songwriting_projects
SET
  music_progress = COALESCE(music_progress, 0),
  lyrics_progress = COALESCE(lyrics_progress, 0),
  total_sessions = COALESCE(total_sessions, 0),
  estimated_sessions = COALESCE(estimated_sessions, 3),
  quality_score = COALESCE(quality_score, 50),
  is_locked = COALESCE(is_locked, false)
WHERE
  music_progress IS NULL
  OR lyrics_progress IS NULL
  OR total_sessions IS NULL
  OR estimated_sessions IS NULL
  OR quality_score IS NULL
  OR is_locked IS NULL;

-- Extend songwriting sessions with detailed tracking fields
ALTER TABLE public.songwriting_sessions
  ADD COLUMN IF NOT EXISTS session_start timestamptz NOT NULL DEFAULT timezone('utc', now()),
  ADD COLUMN IF NOT EXISTS session_end timestamptz,
  ADD COLUMN IF NOT EXISTS music_progress_gained integer NOT NULL DEFAULT 0 CHECK (music_progress_gained >= 0),
  ADD COLUMN IF NOT EXISTS lyrics_progress_gained integer NOT NULL DEFAULT 0 CHECK (lyrics_progress_gained >= 0),
  ADD COLUMN IF NOT EXISTS xp_earned integer NOT NULL DEFAULT 0 CHECK (xp_earned >= 0);

-- Update existing sessions with defaults so constraints remain valid
UPDATE public.songwriting_sessions
SET
  session_start = COALESCE(session_start, created_at),
  music_progress_gained = COALESCE(music_progress_gained, 0),
  lyrics_progress_gained = COALESCE(lyrics_progress_gained, 0),
  xp_earned = COALESCE(xp_earned, 0)
WHERE
  session_start IS NULL
  OR music_progress_gained IS NULL
  OR lyrics_progress_gained IS NULL
  OR xp_earned IS NULL;

-- Add songwriting metadata to the songs table for finished projects
ALTER TABLE public.songs
  ADD COLUMN IF NOT EXISTS theme_id uuid REFERENCES public.song_themes(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS chord_progression_id uuid REFERENCES public.chord_progressions(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS music_progress integer NOT NULL DEFAULT 0 CHECK (music_progress >= 0 AND music_progress <= 2000),
  ADD COLUMN IF NOT EXISTS lyrics_progress integer NOT NULL DEFAULT 0 CHECK (lyrics_progress >= 0 AND lyrics_progress <= 2000),
  ADD COLUMN IF NOT EXISTS total_sessions integer NOT NULL DEFAULT 0 CHECK (total_sessions >= 0),
  ADD COLUMN IF NOT EXISTS songwriting_project_id uuid REFERENCES public.songwriting_projects(id) ON DELETE SET NULL;

-- Backfill any existing songs to ensure constraints are satisfied
UPDATE public.songs
SET
  music_progress = COALESCE(music_progress, 0),
  lyrics_progress = COALESCE(lyrics_progress, 0),
  total_sessions = COALESCE(total_sessions, 0)
WHERE
  music_progress IS NULL
  OR lyrics_progress IS NULL
  OR total_sessions IS NULL;
