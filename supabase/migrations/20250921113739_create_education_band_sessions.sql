-- Create shared band learning sessions for education flows
CREATE TABLE IF NOT EXISTS public.education_band_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text,
  focus_skills text[] NOT NULL DEFAULT '{}'::text[],
  attribute_keys text[] NOT NULL DEFAULT '{}'::text[],
  base_xp integer NOT NULL CHECK (base_xp >= 0),
  duration_minutes integer NOT NULL CHECK (duration_minutes > 0),
  cooldown_hours integer NOT NULL CHECK (cooldown_hours >= 0),
  difficulty text NOT NULL CHECK (difficulty IN ('beginner', 'intermediate', 'advanced')),
  synergy_notes text,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now())
);

COMMENT ON TABLE public.education_band_sessions IS 'Curated band learning sessions surfaced in the education experience.';

CREATE INDEX IF NOT EXISTS education_band_sessions_difficulty_idx
  ON public.education_band_sessions (difficulty, title);

ALTER TABLE public.education_band_sessions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Band sessions are viewable by everyone" ON public.education_band_sessions;
CREATE POLICY "Band sessions are viewable by everyone"
  ON public.education_band_sessions
  FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Privileged roles manage band sessions" ON public.education_band_sessions;
CREATE POLICY "Privileged roles manage band sessions"
  ON public.education_band_sessions
  USING (
    auth.role() = 'service_role'
    OR public.has_role(auth.uid(), 'admin')
  )
  WITH CHECK (
    auth.role() = 'service_role'
    OR public.has_role(auth.uid(), 'admin')
  );

CREATE TRIGGER set_education_band_sessions_updated_at
  BEFORE UPDATE ON public.education_band_sessions
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
