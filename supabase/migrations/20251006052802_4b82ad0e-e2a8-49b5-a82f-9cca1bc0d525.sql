-- Create profile activity statuses after the base schema has created profiles,
-- songs and activity_feed. The earlier 202410 migration is intentionally a no-op
-- because it sorts before those required tables.

CREATE TABLE IF NOT EXISTS public.profile_activity_statuses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  status text NOT NULL,
  started_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  duration_minutes integer,
  ends_at timestamptz,
  song_id uuid REFERENCES public.songs(id) ON DELETE SET NULL,
  metadata jsonb,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  CONSTRAINT profile_activity_statuses_duration_check
    CHECK (duration_minutes IS NULL OR duration_minutes >= 0)
);

ALTER TABLE public.profile_activity_statuses
  ADD COLUMN IF NOT EXISTS duration_minutes integer,
  ADD COLUMN IF NOT EXISTS ends_at timestamptz,
  ADD COLUMN IF NOT EXISTS metadata jsonb;

CREATE UNIQUE INDEX IF NOT EXISTS profile_activity_statuses_profile_id_key
  ON public.profile_activity_statuses (profile_id);

CREATE INDEX IF NOT EXISTS profile_activity_statuses_song_id_idx
  ON public.profile_activity_statuses (song_id);

CREATE OR REPLACE FUNCTION public.set_profile_activity_status_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = timezone('utc', now());
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS profile_activity_statuses_set_updated_at
  ON public.profile_activity_statuses;

CREATE TRIGGER profile_activity_statuses_set_updated_at
  BEFORE UPDATE ON public.profile_activity_statuses
  FOR EACH ROW
  EXECUTE FUNCTION public.set_profile_activity_status_updated_at();

CREATE OR REPLACE FUNCTION public.sync_profile_activity_status_ends_at()
RETURNS trigger
LANGUAGE plpgsql
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

ALTER TABLE public.activity_feed
  ADD COLUMN IF NOT EXISTS status text,
  ADD COLUMN IF NOT EXISTS duration_minutes integer,
  ADD COLUMN IF NOT EXISTS status_id uuid REFERENCES public.profile_activity_statuses(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS metadata jsonb;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'activity_feed_duration_check'
      AND conrelid = 'public.activity_feed'::regclass
  ) THEN
    ALTER TABLE public.activity_feed
      ADD CONSTRAINT activity_feed_duration_check
      CHECK (duration_minutes IS NULL OR duration_minutes >= 0);
  END IF;
END
$$;

-- Keep the existing jam-session compatibility column idempotent. The table is
-- created by 20250916153000_create_jam_sessions_table.sql.
ALTER TABLE public.jam_sessions
  ADD COLUMN IF NOT EXISTS participant_ids uuid[] DEFAULT '{}';

NOTIFY pgrst, 'reload schema';