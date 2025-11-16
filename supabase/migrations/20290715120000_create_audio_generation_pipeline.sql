-- Audio generation pipeline tables and storage bucket
CREATE TABLE IF NOT EXISTS public.audio_generation_prompts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES public.recording_sessions(id) ON DELETE CASCADE,
  requested_by uuid REFERENCES public.profiles(user_id) ON DELETE SET NULL,
  prompt_text text NOT NULL,
  target_model text NOT NULL DEFAULT 'audio-studio-latest',
  duration_seconds integer NOT NULL DEFAULT 30 CHECK (duration_seconds > 0),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  metadata jsonb DEFAULT '{}'::jsonb,
  last_error text,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS audio_generation_prompts_status_idx ON public.audio_generation_prompts (status);
CREATE INDEX IF NOT EXISTS audio_generation_prompts_session_idx ON public.audio_generation_prompts (session_id);

CREATE TABLE IF NOT EXISTS public.audio_generation_results (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  prompt_id uuid NOT NULL REFERENCES public.audio_generation_prompts(id) ON DELETE CASCADE,
  session_id uuid NOT NULL REFERENCES public.recording_sessions(id) ON DELETE CASCADE,
  audio_storage_path text NOT NULL,
  audio_public_url text NOT NULL,
  duration_seconds integer NOT NULL DEFAULT 30 CHECK (duration_seconds > 0),
  model_version text NOT NULL,
  seed text,
  latency_ms integer,
  cost_cents integer,
  is_preferred boolean NOT NULL DEFAULT false,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS audio_generation_results_prompt_idx ON public.audio_generation_results (prompt_id);
CREATE INDEX IF NOT EXISTS audio_generation_results_session_idx ON public.audio_generation_results (session_id);
CREATE INDEX IF NOT EXISTS audio_generation_results_created_at_idx ON public.audio_generation_results (created_at DESC);

INSERT INTO storage.buckets (id, name, public)
VALUES ('generated-audio-clips', 'generated-audio-clips', true)
ON CONFLICT (id) DO UPDATE
SET public = EXCLUDED.public;

ALTER TABLE public.audio_generation_prompts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audio_generation_results ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Audio prompts readable" ON public.audio_generation_prompts;
CREATE POLICY "Audio prompts readable"
  ON public.audio_generation_prompts
  FOR SELECT
  USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Audio prompts insertable by requesters" ON public.audio_generation_prompts;
CREATE POLICY "Audio prompts insertable by requesters"
  ON public.audio_generation_prompts
  FOR INSERT
  WITH CHECK (requested_by = auth.uid());

DROP POLICY IF EXISTS "Audio prompts updatable by requesters" ON public.audio_generation_prompts;
CREATE POLICY "Audio prompts updatable by requesters"
  ON public.audio_generation_prompts
  FOR UPDATE
  USING (requested_by = auth.uid())
  WITH CHECK (requested_by = auth.uid());

DROP POLICY IF EXISTS "Audio results readable" ON public.audio_generation_results;
CREATE POLICY "Audio results readable"
  ON public.audio_generation_results
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.audio_generation_prompts p
      WHERE p.id = prompt_id
        AND (p.requested_by = auth.uid() OR EXISTS (
          SELECT 1 FROM public.recording_sessions rs WHERE rs.id = session_id AND rs.user_id = auth.uid()
        ))
    )
  );

DROP POLICY IF EXISTS "Audio results updatable by requesters" ON public.audio_generation_results;
CREATE POLICY "Audio results updatable by requesters"
  ON public.audio_generation_results
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1
      FROM public.audio_generation_prompts p
      WHERE p.id = prompt_id
        AND (p.requested_by = auth.uid() OR EXISTS (
          SELECT 1 FROM public.recording_sessions rs WHERE rs.id = session_id AND rs.user_id = auth.uid()
        ))
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.audio_generation_prompts p
      WHERE p.id = prompt_id
        AND (p.requested_by = auth.uid() OR EXISTS (
          SELECT 1 FROM public.recording_sessions rs WHERE rs.id = session_id AND rs.user_id = auth.uid()
        ))
    )
  );
