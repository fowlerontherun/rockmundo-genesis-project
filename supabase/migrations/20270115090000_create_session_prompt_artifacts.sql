-- Session prompt artifact storage for AI generation prompts
CREATE TABLE IF NOT EXISTS public.session_prompt_artifacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES public.recording_sessions(id) ON DELETE CASCADE,
  song_id UUID NOT NULL REFERENCES public.songs(id) ON DELETE CASCADE,
  version INTEGER NOT NULL DEFAULT 1,
  prompt JSONB NOT NULL,
  summary TEXT NOT NULL,
  metadata JSONB NOT NULL,
  stem_paths TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  lyrics_excerpt TEXT,
  context_tokens INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS session_prompt_artifacts_session_id_version_idx
  ON public.session_prompt_artifacts (session_id, version);

CREATE INDEX IF NOT EXISTS session_prompt_artifacts_song_id_idx
  ON public.session_prompt_artifacts (song_id);

CREATE OR REPLACE FUNCTION public.set_session_prompt_artifacts_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_session_prompt_artifacts_updated_at ON public.session_prompt_artifacts;
CREATE TRIGGER set_session_prompt_artifacts_updated_at
  BEFORE UPDATE ON public.session_prompt_artifacts
  FOR EACH ROW
  EXECUTE FUNCTION public.set_session_prompt_artifacts_updated_at();

ALTER TABLE public.session_prompt_artifacts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "system manages session prompt artifacts" ON public.session_prompt_artifacts;
CREATE POLICY "system manages session prompt artifacts"
  ON public.session_prompt_artifacts
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

DROP POLICY IF EXISTS "authenticated can read session prompt artifacts" ON public.session_prompt_artifacts;
CREATE POLICY "authenticated can read session prompt artifacts"
  ON public.session_prompt_artifacts
  FOR SELECT
  USING (auth.role() = 'authenticated' OR auth.role() = 'service_role');

INSERT INTO storage.buckets (id, name, public)
VALUES ('session-prompts', 'session-prompts', false)
ON CONFLICT (id) DO NOTHING;
