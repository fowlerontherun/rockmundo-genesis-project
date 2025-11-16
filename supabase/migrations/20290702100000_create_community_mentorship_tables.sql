-- Community mentorship profiles and goals
CREATE TABLE IF NOT EXISTS public.community_mentorship_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  headline text,
  bio text,
  experience_level text NOT NULL DEFAULT 'emerging',
  is_open_to_mentor boolean NOT NULL DEFAULT false,
  is_open_to_learn boolean NOT NULL DEFAULT true,
  focus_areas text[] NOT NULL DEFAULT '{}'::text[],
  support_topics text[] NOT NULL DEFAULT '{}'::text[],
  preferred_genres text[] NOT NULL DEFAULT '{}'::text[],
  availability_status text NOT NULL DEFAULT 'open',
  meeting_preferences text[] NOT NULL DEFAULT '{}'::text[],
  mentorship_style text[] NOT NULL DEFAULT '{}'::text[],
  timezone text,
  mentor_capacity integer NOT NULL DEFAULT 3,
  current_mentees integer NOT NULL DEFAULT 0,
  compatibility_tags text[] NOT NULL DEFAULT '{}'::text[],
  last_active_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT community_mentorship_profiles_profile_unique UNIQUE (profile_id),
  CONSTRAINT community_mentorship_profiles_experience_check CHECK (
    experience_level = ANY (ARRAY['emerging','intermediate','advanced','veteran'])
  ),
  CONSTRAINT community_mentorship_profiles_availability_check CHECK (
    availability_status = ANY (ARRAY['open','limited','waitlist','closed'])
  ),
  CONSTRAINT community_mentorship_profiles_capacity_check CHECK (mentor_capacity >= 0),
  CONSTRAINT community_mentorship_profiles_mentees_check CHECK (current_mentees >= 0)
);

CREATE INDEX IF NOT EXISTS community_mentorship_profiles_experience_idx
  ON public.community_mentorship_profiles (experience_level);
CREATE INDEX IF NOT EXISTS community_mentorship_profiles_availability_idx
  ON public.community_mentorship_profiles (availability_status);
CREATE INDEX IF NOT EXISTS community_mentorship_profiles_open_idx
  ON public.community_mentorship_profiles (is_open_to_mentor)
  WHERE is_open_to_mentor = true;

CREATE TRIGGER community_mentorship_profiles_set_updated_at
  BEFORE UPDATE ON public.community_mentorship_profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.community_mentorship_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can view open mentorship profiles"
  ON public.community_mentorship_profiles
  FOR SELECT
  USING (
    is_open_to_mentor
    OR is_open_to_learn
    OR auth.role() = 'service_role'
    OR EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.id = profile_id AND p.user_id = auth.uid()
    )
  );

CREATE POLICY "Players manage their mentorship profile"
  ON public.community_mentorship_profiles
  FOR ALL
  USING (
    auth.role() = 'service_role'
    OR EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.id = profile_id AND p.user_id = auth.uid()
    )
  )
  WITH CHECK (
    auth.role() = 'service_role'
    OR EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.id = profile_id AND p.user_id = auth.uid()
    )
  );

CREATE TABLE IF NOT EXISTS public.community_mentorship_matches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  mentor_profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  mentee_profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  initiated_by_profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending',
  mentorship_cadence text NOT NULL DEFAULT 'biweekly',
  alignment_score integer NOT NULL DEFAULT 50,
  focus_areas text[] NOT NULL DEFAULT '{}'::text[],
  support_topics text[] NOT NULL DEFAULT '{}'::text[],
  notes text,
  started_at timestamptz,
  ended_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT community_mentorship_matches_unique_pair UNIQUE (mentor_profile_id, mentee_profile_id),
  CONSTRAINT community_mentorship_matches_status_check CHECK (
    status = ANY (ARRAY['pending','active','paused','completed','declined'])
  ),
  CONSTRAINT community_mentorship_matches_alignment_check CHECK (alignment_score >= 0 AND alignment_score <= 100)
);

CREATE INDEX IF NOT EXISTS community_mentorship_matches_mentor_idx
  ON public.community_mentorship_matches (mentor_profile_id);
CREATE INDEX IF NOT EXISTS community_mentorship_matches_mentee_idx
  ON public.community_mentorship_matches (mentee_profile_id);
CREATE INDEX IF NOT EXISTS community_mentorship_matches_status_idx
  ON public.community_mentorship_matches (status);

CREATE TRIGGER community_mentorship_matches_set_updated_at
  BEFORE UPDATE ON public.community_mentorship_matches
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.community_mentorship_matches ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Participants can view mentorship matches"
  ON public.community_mentorship_matches
  FOR SELECT
  USING (
    auth.role() = 'service_role'
    OR EXISTS (
      SELECT 1
      FROM public.profiles mentor
      WHERE mentor.id = mentor_profile_id AND mentor.user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1
      FROM public.profiles mentee
      WHERE mentee.id = mentee_profile_id AND mentee.user_id = auth.uid()
    )
  );

CREATE POLICY "Participants manage mentorship matches"
  ON public.community_mentorship_matches
  FOR ALL
  USING (
    auth.role() = 'service_role'
    OR EXISTS (
      SELECT 1
      FROM public.profiles mentor
      WHERE mentor.id = mentor_profile_id AND mentor.user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1
      FROM public.profiles mentee
      WHERE mentee.id = mentee_profile_id AND mentee.user_id = auth.uid()
    )
  )
  WITH CHECK (
    auth.role() = 'service_role'
    OR EXISTS (
      SELECT 1
      FROM public.profiles mentor
      WHERE mentor.id = mentor_profile_id AND mentor.user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1
      FROM public.profiles mentee
      WHERE mentee.id = mentee_profile_id AND mentee.user_id = auth.uid()
    )
  );

CREATE TABLE IF NOT EXISTS public.community_mentorship_goals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id uuid NOT NULL REFERENCES public.community_mentorship_matches(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  focus_areas text[] NOT NULL DEFAULT '{}'::text[],
  status text NOT NULL DEFAULT 'not_started',
  progress integer NOT NULL DEFAULT 0,
  target_date date,
  metrics jsonb NOT NULL DEFAULT '{}'::jsonb,
  check_ins jsonb NOT NULL DEFAULT '[]'::jsonb,
  support_notes text,
  milestone_order integer NOT NULL DEFAULT 0,
  impact_score integer NOT NULL DEFAULT 0,
  last_check_in timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT community_mentorship_goals_status_check CHECK (
    status = ANY (ARRAY['not_started','in_progress','completed','blocked'])
  ),
  CONSTRAINT community_mentorship_goals_progress_check CHECK (progress >= 0 AND progress <= 100)
);

CREATE INDEX IF NOT EXISTS community_mentorship_goals_match_idx
  ON public.community_mentorship_goals (match_id);
CREATE INDEX IF NOT EXISTS community_mentorship_goals_status_idx
  ON public.community_mentorship_goals (status);

CREATE TRIGGER community_mentorship_goals_set_updated_at
  BEFORE UPDATE ON public.community_mentorship_goals
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.community_mentorship_goals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Participants can view mentorship goals"
  ON public.community_mentorship_goals
  FOR SELECT
  USING (
    auth.role() = 'service_role'
    OR EXISTS (
      SELECT 1
      FROM public.community_mentorship_matches m
      JOIN public.profiles mentor ON mentor.id = m.mentor_profile_id
      JOIN public.profiles mentee ON mentee.id = m.mentee_profile_id
      WHERE m.id = match_id AND (mentor.user_id = auth.uid() OR mentee.user_id = auth.uid())
    )
  );

CREATE POLICY "Participants manage mentorship goals"
  ON public.community_mentorship_goals
  FOR ALL
  USING (
    auth.role() = 'service_role'
    OR EXISTS (
      SELECT 1
      FROM public.community_mentorship_matches m
      JOIN public.profiles mentor ON mentor.id = m.mentor_profile_id
      JOIN public.profiles mentee ON mentee.id = m.mentee_profile_id
      WHERE m.id = match_id AND (mentor.user_id = auth.uid() OR mentee.user_id = auth.uid())
    )
  )
  WITH CHECK (
    auth.role() = 'service_role'
    OR EXISTS (
      SELECT 1
      FROM public.community_mentorship_matches m
      JOIN public.profiles mentor ON mentor.id = m.mentor_profile_id
      JOIN public.profiles mentee ON mentee.id = m.mentee_profile_id
      WHERE m.id = match_id AND (mentor.user_id = auth.uid() OR mentee.user_id = auth.uid())
    )
  );
