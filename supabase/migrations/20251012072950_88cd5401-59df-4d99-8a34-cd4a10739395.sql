-- Create education_mentors table
CREATE TABLE public.education_mentors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR NOT NULL,
  focus_skill VARCHAR NOT NULL,
  description TEXT NOT NULL,
  specialty TEXT NOT NULL,
  cost INTEGER NOT NULL DEFAULT 0,
  cooldown_hours INTEGER NOT NULL DEFAULT 24,
  base_xp INTEGER NOT NULL DEFAULT 100,
  difficulty VARCHAR NOT NULL DEFAULT 'beginner',
  attribute_keys JSONB NOT NULL DEFAULT '[]',
  required_skill_value INTEGER NOT NULL DEFAULT 0,
  skill_gain_ratio NUMERIC NOT NULL DEFAULT 1.0,
  bonus_description TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create player_mentor_sessions table
CREATE TABLE public.player_mentor_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  profile_id UUID NOT NULL,
  mentor_id UUID NOT NULL REFERENCES public.education_mentors(id) ON DELETE CASCADE,
  xp_earned INTEGER NOT NULL DEFAULT 0,
  skill_value_gained INTEGER NOT NULL DEFAULT 0,
  attribute_gains JSONB NOT NULL DEFAULT '{}',
  session_date TIMESTAMPTZ NOT NULL DEFAULT now(),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.education_mentors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.player_mentor_sessions ENABLE ROW LEVEL SECURITY;

-- RLS Policies for education_mentors
CREATE POLICY "Mentors are viewable by everyone"
  ON public.education_mentors
  FOR SELECT
  USING (is_active = true);

CREATE POLICY "Admins can manage mentors"
  ON public.education_mentors
  FOR ALL
  USING (has_role(auth.uid(), 'admin'));

-- RLS Policies for player_mentor_sessions
CREATE POLICY "Users can view their own sessions"
  ON public.player_mentor_sessions
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own sessions"
  ON public.player_mentor_sessions
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Create updated_at trigger
CREATE TRIGGER update_education_mentors_updated_at
  BEFORE UPDATE ON public.education_mentors
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Create indexes
CREATE INDEX idx_education_mentors_focus_skill ON public.education_mentors(focus_skill);
CREATE INDEX idx_education_mentors_difficulty ON public.education_mentors(difficulty);
CREATE INDEX idx_player_mentor_sessions_user_id ON public.player_mentor_sessions(user_id);
CREATE INDEX idx_player_mentor_sessions_profile_id ON public.player_mentor_sessions(profile_id);
CREATE INDEX idx_player_mentor_sessions_mentor_id ON public.player_mentor_sessions(mentor_id);