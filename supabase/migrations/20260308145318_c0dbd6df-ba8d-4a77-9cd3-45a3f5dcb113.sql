
-- Story States table for narrative events
CREATE TABLE public.story_states (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  story_id TEXT NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  profile_id UUID NULL,
  current_node_id TEXT NOT NULL,
  visited_node_ids TEXT[] NOT NULL DEFAULT '{}',
  flags JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(story_id, user_id)
);

ALTER TABLE public.story_states ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own story states" ON public.story_states
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own story states" ON public.story_states
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own story states" ON public.story_states
  FOR UPDATE TO authenticated USING (auth.uid() = user_id);

-- Story Choices table for narrative decision history
CREATE TABLE public.story_choices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  story_state_id UUID REFERENCES public.story_states(id) ON DELETE CASCADE NOT NULL,
  story_id TEXT NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  node_id TEXT NOT NULL,
  choice_id TEXT NOT NULL,
  choice_label TEXT,
  result_summary TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.story_choices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own story choices" ON public.story_choices
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own story choices" ON public.story_choices
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

-- Casting Calls table for talent discovery
CREATE TABLE public.casting_calls (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  project_type TEXT,
  union_status TEXT,
  status TEXT NOT NULL DEFAULT 'open',
  location TEXT,
  is_remote_friendly BOOLEAN DEFAULT false,
  application_deadline TIMESTAMPTZ,
  compensation_notes TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.casting_calls ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read casting calls" ON public.casting_calls
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Creators can manage casting calls" ON public.casting_calls
  FOR ALL TO authenticated USING (auth.uid() = created_by);

-- Casting Call Roles
CREATE TABLE public.casting_call_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  casting_call_id UUID REFERENCES public.casting_calls(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  role_type TEXT,
  description TEXT,
  age_range TEXT,
  gender TEXT,
  ethnicity TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.casting_call_roles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read casting call roles" ON public.casting_call_roles
  FOR SELECT TO authenticated USING (true);

-- Casting Submissions
CREATE TABLE public.casting_submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  casting_call_id UUID REFERENCES public.casting_calls(id) ON DELETE CASCADE NOT NULL,
  casting_call_role_id UUID REFERENCES public.casting_call_roles(id) ON DELETE SET NULL,
  talent_profile_id UUID NOT NULL,
  cover_letter TEXT,
  experience_summary TEXT,
  portfolio_url TEXT,
  resume_url TEXT,
  audition_video_url TEXT,
  status TEXT NOT NULL DEFAULT 'submitted',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.casting_submissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own submissions" ON public.casting_submissions
  FOR SELECT TO authenticated USING (
    talent_profile_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid())
  );

CREATE POLICY "Users can insert own submissions" ON public.casting_submissions
  FOR INSERT TO authenticated WITH CHECK (
    talent_profile_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid())
  );

CREATE POLICY "Users can delete own submissions" ON public.casting_submissions
  FOR DELETE TO authenticated USING (
    talent_profile_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid())
  );

CREATE POLICY "Reviewers can read all submissions" ON public.casting_submissions
  FOR SELECT TO authenticated USING (true);

-- Casting Reviews
CREATE TABLE public.casting_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  submission_id UUID REFERENCES public.casting_submissions(id) ON DELETE CASCADE NOT NULL,
  reviewer_profile_id UUID,
  decision TEXT NOT NULL DEFAULT 'pending',
  feedback TEXT,
  score INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.casting_reviews ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Reviewers can read reviews" ON public.casting_reviews
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Reviewers can insert reviews" ON public.casting_reviews
  FOR INSERT TO authenticated WITH CHECK (true);
