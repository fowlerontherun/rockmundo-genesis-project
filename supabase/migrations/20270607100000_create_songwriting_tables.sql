-- Create songwriting project tracking so players can progress through focus sessions
CREATE TABLE IF NOT EXISTS public.songwriting_projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(user_id) ON DELETE CASCADE,
  song_id UUID REFERENCES public.songs(id) ON DELETE SET NULL,
  title TEXT NOT NULL DEFAULT 'Untitled Song',
  lyrics TEXT,
  sessions_completed INTEGER NOT NULL DEFAULT 0 CHECK (sessions_completed >= 0),
  locked_until TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'writing', 'ready_to_finish', 'completed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS songwriting_projects_user_id_idx ON public.songwriting_projects (user_id);
CREATE INDEX IF NOT EXISTS songwriting_projects_status_idx ON public.songwriting_projects (status);

CREATE TABLE IF NOT EXISTS public.songwriting_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.songwriting_projects(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(user_id) ON DELETE CASCADE,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  locked_until TIMESTAMPTZ NOT NULL,
  completed_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS songwriting_sessions_project_id_idx ON public.songwriting_sessions (project_id);
CREATE INDEX IF NOT EXISTS songwriting_sessions_user_id_idx ON public.songwriting_sessions (user_id);
CREATE INDEX IF NOT EXISTS songwriting_sessions_completion_idx ON public.songwriting_sessions (completed_at);

CREATE OR REPLACE FUNCTION public.set_current_timestamp_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_songwriting_projects_updated_at ON public.songwriting_projects;
CREATE TRIGGER set_songwriting_projects_updated_at
  BEFORE UPDATE ON public.songwriting_projects
  FOR EACH ROW
  EXECUTE FUNCTION public.set_current_timestamp_updated_at();

ALTER TABLE public.songwriting_projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.songwriting_sessions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Songwriting projects are viewable by owners" ON public.songwriting_projects;
CREATE POLICY "Songwriting projects are viewable by owners"
  ON public.songwriting_projects
  FOR SELECT
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Songwriting projects can be inserted by owners" ON public.songwriting_projects;
CREATE POLICY "Songwriting projects can be inserted by owners"
  ON public.songwriting_projects
  FOR INSERT
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Songwriting projects can be updated by owners" ON public.songwriting_projects;
CREATE POLICY "Songwriting projects can be updated by owners"
  ON public.songwriting_projects
  FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Songwriting projects can be deleted by owners" ON public.songwriting_projects;
CREATE POLICY "Songwriting projects can be deleted by owners"
  ON public.songwriting_projects
  FOR DELETE
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Songwriting sessions are viewable by owners" ON public.songwriting_sessions;
CREATE POLICY "Songwriting sessions are viewable by owners"
  ON public.songwriting_sessions
  FOR SELECT
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Songwriting sessions can be inserted by owners" ON public.songwriting_sessions;
CREATE POLICY "Songwriting sessions can be inserted by owners"
  ON public.songwriting_sessions
  FOR INSERT
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Songwriting sessions can be updated by owners" ON public.songwriting_sessions;
CREATE POLICY "Songwriting sessions can be updated by owners"
  ON public.songwriting_sessions
  FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Songwriting sessions can be deleted by owners" ON public.songwriting_sessions;
CREATE POLICY "Songwriting sessions can be deleted by owners"
  ON public.songwriting_sessions
  FOR DELETE
  USING (user_id = auth.uid());
