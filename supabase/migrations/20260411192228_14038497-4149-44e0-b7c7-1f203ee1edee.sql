
-- =============================================
-- 1. player_mentorships table
-- =============================================
CREATE TABLE public.player_mentorships (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  mentor_profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  mentee_profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  focus_skill TEXT NOT NULL DEFAULT 'general',
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','active','completed','cancelled')),
  xp_granted INTEGER NOT NULL DEFAULT 0,
  sessions_completed INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (mentor_profile_id, mentee_profile_id, focus_skill)
);

ALTER TABLE public.player_mentorships ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Mentor or mentee can view mentorships"
ON public.player_mentorships FOR SELECT TO authenticated
USING (
  mentor_profile_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid())
  OR mentee_profile_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid())
);

CREATE POLICY "Authenticated users can create mentorships"
ON public.player_mentorships FOR INSERT TO authenticated
WITH CHECK (
  mentor_profile_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid())
  OR mentee_profile_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid())
);

CREATE POLICY "Mentor can update mentorships"
ON public.player_mentorships FOR UPDATE TO authenticated
USING (
  mentor_profile_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid())
  OR mentee_profile_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid())
);

CREATE POLICY "Either party can delete mentorships"
ON public.player_mentorships FOR DELETE TO authenticated
USING (
  mentor_profile_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid())
  OR mentee_profile_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid())
);

-- =============================================
-- 2. club_presence table
-- =============================================
CREATE TABLE public.club_presence (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  club_id UUID NOT NULL,
  entered_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '1 hour'),
  UNIQUE (profile_id, club_id)
);

ALTER TABLE public.club_presence ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone authenticated can see club presence"
ON public.club_presence FOR SELECT TO authenticated
USING (true);

CREATE POLICY "Users can insert own presence"
ON public.club_presence FOR INSERT TO authenticated
WITH CHECK (
  profile_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid())
);

CREATE POLICY "Users can update own presence"
ON public.club_presence FOR UPDATE TO authenticated
USING (
  profile_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid())
);

CREATE POLICY "Users can delete own presence"
ON public.club_presence FOR DELETE TO authenticated
USING (
  profile_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid())
);

-- Indexes
CREATE INDEX idx_club_presence_club_id ON public.club_presence(club_id);
CREATE INDEX idx_club_presence_expires ON public.club_presence(expires_at);
CREATE INDEX idx_mentorships_mentor ON public.player_mentorships(mentor_profile_id);
CREATE INDEX idx_mentorships_mentee ON public.player_mentorships(mentee_profile_id);
