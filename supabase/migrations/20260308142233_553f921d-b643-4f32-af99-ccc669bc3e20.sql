
-- Create player_teaching_sessions table
CREATE TABLE public.player_teaching_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  student_profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  skill_slug text NOT NULL,
  status text NOT NULL DEFAULT 'scheduled',
  started_at timestamptz,
  completed_at timestamptz,
  teacher_xp_earned integer NOT NULL DEFAULT 0,
  student_xp_earned integer NOT NULL DEFAULT 0,
  session_duration_days integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.player_teaching_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own teaching sessions"
  ON public.player_teaching_sessions FOR SELECT TO authenticated
  USING (
    teacher_profile_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid())
    OR student_profile_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid())
  );

CREATE POLICY "Users can create teaching sessions as teacher"
  ON public.player_teaching_sessions FOR INSERT TO authenticated
  WITH CHECK (
    teacher_profile_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid())
  );

CREATE POLICY "Users can update own teaching sessions"
  ON public.player_teaching_sessions FOR UPDATE TO authenticated
  USING (
    teacher_profile_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid())
    OR student_profile_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid())
  );

CREATE INDEX idx_teaching_sessions_teacher ON public.player_teaching_sessions(teacher_profile_id);
CREATE INDEX idx_teaching_sessions_student ON public.player_teaching_sessions(student_profile_id);
CREATE INDEX idx_teaching_sessions_status ON public.player_teaching_sessions(status);

-- Seed teaching skill definitions
INSERT INTO public.skill_definitions (slug, display_name, description)
VALUES
  ('teaching_basic_teaching', 'Basic Teaching', 'Teach skills you have at level 5+ to friends. Students earn 50-80 XP/day.'),
  ('teaching_professional_teaching', 'Professional Teaching', 'Teach skills at level 3+. Students earn 70-100 XP/day with improved methods.'),
  ('teaching_mastery_teaching', 'Mastery Teaching', 'Teach any skill at level 1+. Students earn 90-120 XP/day. Unlocks group teaching.')
ON CONFLICT (slug) DO UPDATE SET
  display_name = EXCLUDED.display_name,
  description = EXCLUDED.description;
