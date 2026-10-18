-- Create table to manage education mentor roster
CREATE TABLE IF NOT EXISTS public.education_mentors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  focus_skill text NOT NULL,
  description text NOT NULL,
  specialty text NOT NULL,
  cost integer NOT NULL CHECK (cost >= 0),
  cooldown_hours integer NOT NULL CHECK (cooldown_hours >= 0),
  base_xp integer NOT NULL CHECK (base_xp >= 0),
  difficulty text NOT NULL CHECK (difficulty IN ('beginner', 'intermediate', 'advanced')),
  attribute_keys text[] NOT NULL DEFAULT ARRAY[]::text[],
  required_skill_value integer NOT NULL CHECK (required_skill_value >= 0),
  skill_gain_ratio numeric(6,3) NOT NULL CHECK (skill_gain_ratio > 0),
  bonus_description text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now())
);

CREATE INDEX IF NOT EXISTS idx_education_mentors_focus_skill
  ON public.education_mentors (focus_skill);

CREATE INDEX IF NOT EXISTS idx_education_mentors_difficulty
  ON public.education_mentors (difficulty);

CREATE TRIGGER update_education_mentors_updated_at
  BEFORE UPDATE ON public.education_mentors
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
