-- Education mentors already exist from September 21, 2025.
-- Evolve that table in place on clean replay; never recreate it or lose seed data.
-- On production these operations are already reflected in the live schema.
CREATE TABLE IF NOT EXISTS public.education_mentors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR NOT NULL,
  focus_skill VARCHAR NOT NULL,
  description TEXT NOT NULL,
  specialty TEXT NOT NULL,
  cost INTEGER NOT NULL DEFAULT 0,
  cooldown_hours INTEGER NOT NULL DEFAULT 24,
  base_xp INTEGER NOT NULL DEFAULT 100,
  difficulty VARCHAR NOT NULL DEFAULT 'beginner',
  attribute_keys JSONB NOT NULL DEFAULT '[]'::jsonb,
  required_skill_value INTEGER NOT NULL DEFAULT 0,
  skill_gain_ratio NUMERIC NOT NULL DEFAULT 1.0,
  bonus_description TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- September's original attribute_keys column is text[], with an array default.
-- Reconcile to the October jsonb representation without wiping existing keys.
-- Conditional so the historical migration can also run against later DB snapshots.
DO $migrate_mentors$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='education_mentors'
      AND column_name='attribute_keys' AND data_type='ARRAY'
  ) THEN
    ALTER TABLE public.education_mentors ALTER COLUMN attribute_keys DROP DEFAULT;
    ALTER TABLE public.education_mentors ALTER COLUMN attribute_keys
      TYPE jsonb USING to_jsonb(attribute_keys);
  END IF;
END $migrate_mentors$;

ALTER TABLE public.education_mentors
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE public.education_mentors
  ALTER COLUMN attribute_keys SET DEFAULT '[]'::jsonb;

CREATE TABLE IF NOT EXISTS public.player_mentor_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  profile_id UUID NOT NULL,
  mentor_id UUID NOT NULL REFERENCES public.education_mentors(id) ON DELETE CASCADE,
  xp_earned INTEGER NOT NULL DEFAULT 0,
  skill_value_gained INTEGER NOT NULL DEFAULT 0,
  attribute_gains JSONB NOT NULL DEFAULT '{}'::jsonb,
  session_date TIMESTAMPTZ NOT NULL DEFAULT now(),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.education_mentors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.player_mentor_sessions ENABLE ROW LEVEL SECURITY;

-- A clean replay and an already-populated snapshot must both be safe.
DO $mentor_policies$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public'
    AND tablename='education_mentors' AND policyname='Mentors are viewable by everyone') THEN
    EXECUTE 'CREATE POLICY "Mentors are viewable by everyone" ON public.education_mentors FOR SELECT USING (is_active = true)';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public'
    AND tablename='education_mentors' AND policyname='Admins can manage mentors') THEN
    EXECUTE 'CREATE POLICY "Admins can manage mentors" ON public.education_mentors FOR ALL USING (has_role(auth.uid(), ''admin''))';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public'
    AND tablename='player_mentor_sessions' AND policyname='Users can view their own sessions') THEN
    EXECUTE 'CREATE POLICY "Users can view their own sessions" ON public.player_mentor_sessions FOR SELECT USING (auth.uid() = user_id)';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public'
    AND tablename='player_mentor_sessions' AND policyname='Users can create their own sessions') THEN
    EXECUTE 'CREATE POLICY "Users can create their own sessions" ON public.player_mentor_sessions FOR INSERT WITH CHECK (auth.uid() = user_id)';
  END IF;
END $mentor_policies$;

-- The trigger and mentor indexes were already created in September 2025.
DO $mentor_trigger$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger
    WHERE tgrelid='public.education_mentors'::regclass
      AND tgname='update_education_mentors_updated_at' AND NOT tgisinternal) THEN
    CREATE TRIGGER update_education_mentors_updated_at
      BEFORE UPDATE ON public.education_mentors FOR EACH ROW
      EXECUTE FUNCTION public.update_updated_at_column();
  END IF;
END $mentor_trigger$;

CREATE INDEX IF NOT EXISTS idx_education_mentors_focus_skill ON public.education_mentors(focus_skill);
CREATE INDEX IF NOT EXISTS idx_education_mentors_difficulty ON public.education_mentors(difficulty);
CREATE INDEX IF NOT EXISTS idx_player_mentor_sessions_user_id ON public.player_mentor_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_player_mentor_sessions_profile_id ON public.player_mentor_sessions(profile_id);
CREATE INDEX IF NOT EXISTS idx_player_mentor_sessions_mentor_id ON public.player_mentor_sessions(mentor_id);
