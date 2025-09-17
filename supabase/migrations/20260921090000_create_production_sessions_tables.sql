-- Create tables for tracking recording, mixing, and mastering sessions along with uploaded tracks
CREATE TABLE IF NOT EXISTS public.recording_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  song_id UUID NOT NULL REFERENCES public.songs(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(user_id) ON DELETE CASCADE,
  stage TEXT NOT NULL CHECK (stage IN ('recording', 'mixing', 'mastering')),
  status TEXT NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'in_progress', 'completed')),
  engineer_id UUID REFERENCES public.profiles(user_id) ON DELETE SET NULL,
  engineer_name TEXT,
  scheduled_start TIMESTAMPTZ,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  total_cost INTEGER NOT NULL DEFAULT 0 CHECK (total_cost >= 0),
  total_takes INTEGER NOT NULL DEFAULT 0 CHECK (total_takes >= 0),
  quality_gain INTEGER NOT NULL DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS recording_sessions_song_id_idx ON public.recording_sessions (song_id);
CREATE INDEX IF NOT EXISTS recording_sessions_user_id_idx ON public.recording_sessions (user_id);
CREATE INDEX IF NOT EXISTS recording_sessions_stage_idx ON public.recording_sessions (stage);

CREATE TABLE IF NOT EXISTS public.production_tracks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES public.recording_sessions(id) ON DELETE CASCADE,
  song_id UUID NOT NULL REFERENCES public.songs(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(user_id) ON DELETE CASCADE,
  stage TEXT NOT NULL CHECK (stage IN ('recording', 'mixing', 'mastering')),
  name TEXT NOT NULL,
  take_number INTEGER NOT NULL DEFAULT 1 CHECK (take_number > 0),
  storage_path TEXT NOT NULL,
  public_url TEXT NOT NULL,
  duration_seconds NUMERIC NOT NULL DEFAULT 0 CHECK (duration_seconds >= 0),
  quality_rating INTEGER,
  cost INTEGER NOT NULL DEFAULT 0 CHECK (cost >= 0),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS production_tracks_session_id_idx ON public.production_tracks (session_id);
CREATE INDEX IF NOT EXISTS production_tracks_song_id_idx ON public.production_tracks (song_id);
CREATE INDEX IF NOT EXISTS production_tracks_user_id_idx ON public.production_tracks (user_id);

CREATE OR REPLACE FUNCTION public.set_current_timestamp_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_recording_sessions_updated_at ON public.recording_sessions;
CREATE TRIGGER set_recording_sessions_updated_at
  BEFORE UPDATE ON public.recording_sessions
  FOR EACH ROW
  EXECUTE FUNCTION public.set_current_timestamp_updated_at();

DROP TRIGGER IF EXISTS set_production_tracks_updated_at ON public.production_tracks;
CREATE TRIGGER set_production_tracks_updated_at
  BEFORE UPDATE ON public.production_tracks
  FOR EACH ROW
  EXECUTE FUNCTION public.set_current_timestamp_updated_at();

ALTER TABLE public.recording_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.production_tracks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Recording sessions are viewable by owners" ON public.recording_sessions;
CREATE POLICY "Recording sessions are viewable by owners"
  ON public.recording_sessions
  FOR SELECT
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Recording sessions can be inserted by owners" ON public.recording_sessions;
CREATE POLICY "Recording sessions can be inserted by owners"
  ON public.recording_sessions
  FOR INSERT
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Recording sessions can be updated by owners" ON public.recording_sessions;
CREATE POLICY "Recording sessions can be updated by owners"
  ON public.recording_sessions
  FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Recording sessions can be deleted by owners" ON public.recording_sessions;
CREATE POLICY "Recording sessions can be deleted by owners"
  ON public.recording_sessions
  FOR DELETE
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Production tracks are viewable by owners" ON public.production_tracks;
CREATE POLICY "Production tracks are viewable by owners"
  ON public.production_tracks
  FOR SELECT
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Production tracks can be inserted by owners" ON public.production_tracks;
CREATE POLICY "Production tracks can be inserted by owners"
  ON public.production_tracks
  FOR INSERT
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Production tracks can be updated by owners" ON public.production_tracks;
CREATE POLICY "Production tracks can be updated by owners"
  ON public.production_tracks
  FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Production tracks can be deleted by owners" ON public.production_tracks;
CREATE POLICY "Production tracks can be deleted by owners"
  ON public.production_tracks
  FOR DELETE
  USING (user_id = auth.uid());
