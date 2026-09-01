-- Fresh-database compatibility for historical migrations that originally ran in an
-- environment where public.profiles already existed. Idempotent for production.

CREATE TABLE IF NOT EXISTS public.community_posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  author_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  content text NOT NULL,
  media_url text,
  created_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now())
);
CREATE INDEX IF NOT EXISTS community_posts_created_at_idx ON public.community_posts (created_at DESC);

CREATE TABLE IF NOT EXISTS public.community_post_reactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id uuid NOT NULL REFERENCES public.community_posts(id) ON DELETE CASCADE,
  profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  reaction_type text NOT NULL CHECK (reaction_type IN ('like','love','fire','wow','laugh')),
  created_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now()),
  UNIQUE (post_id, profile_id)
);

ALTER TABLE public.community_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.community_post_reactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Community posts are viewable by everyone" ON public.community_posts;
CREATE POLICY "Community posts are viewable by everyone" ON public.community_posts FOR SELECT USING (true);
DROP POLICY IF EXISTS "Authenticated users can create community posts" ON public.community_posts;
CREATE POLICY "Authenticated users can create community posts" ON public.community_posts FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id=author_id AND p.user_id=(SELECT auth.uid())));
DROP POLICY IF EXISTS "Authors can update their community posts" ON public.community_posts;
CREATE POLICY "Authors can update their community posts" ON public.community_posts FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id=author_id AND p.user_id=(SELECT auth.uid())))
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id=author_id AND p.user_id=(SELECT auth.uid())));
DROP POLICY IF EXISTS "Authors can delete their community posts" ON public.community_posts;
CREATE POLICY "Authors can delete their community posts" ON public.community_posts FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id=author_id AND p.user_id=(SELECT auth.uid())));

DROP POLICY IF EXISTS "Community reactions are viewable by everyone" ON public.community_post_reactions;
CREATE POLICY "Community reactions are viewable by everyone" ON public.community_post_reactions FOR SELECT USING (true);
DROP POLICY IF EXISTS "Players can react to community posts" ON public.community_post_reactions;
CREATE POLICY "Players can react to community posts" ON public.community_post_reactions FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id=profile_id AND p.user_id=(SELECT auth.uid())));
DROP POLICY IF EXISTS "Players can update their community reactions" ON public.community_post_reactions;
CREATE POLICY "Players can update their community reactions" ON public.community_post_reactions FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id=profile_id AND p.user_id=(SELECT auth.uid())))
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id=profile_id AND p.user_id=(SELECT auth.uid())));
DROP POLICY IF EXISTS "Players can remove their community reactions" ON public.community_post_reactions;
CREATE POLICY "Players can remove their community reactions" ON public.community_post_reactions FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id=profile_id AND p.user_id=(SELECT auth.uid())));

DROP TRIGGER IF EXISTS community_posts_set_updated_at ON public.community_posts;
CREATE TRIGGER community_posts_set_updated_at BEFORE UPDATE ON public.community_posts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
DROP TRIGGER IF EXISTS community_post_reactions_set_updated_at ON public.community_post_reactions;
CREATE TRIGGER community_post_reactions_set_updated_at BEFORE UPDATE ON public.community_post_reactions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE IF NOT EXISTS public.side_hustle_progress (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  activity_id text NOT NULL,
  minigame_type text NOT NULL,
  level integer NOT NULL DEFAULT 1,
  experience integer NOT NULL DEFAULT 0,
  best_score integer NOT NULL DEFAULT 0,
  total_attempts integer NOT NULL DEFAULT 0,
  last_result text,
  last_played_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT side_hustle_progress_unique_profile_activity UNIQUE (profile_id, activity_id)
);
CREATE TABLE IF NOT EXISTS public.side_hustle_minigame_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  activity_id text NOT NULL,
  minigame_type text NOT NULL,
  score integer NOT NULL,
  accuracy numeric(5,2) NOT NULL,
  xp_earned integer NOT NULL,
  cash_reward integer NOT NULL,
  duration_seconds integer NOT NULL,
  difficulty integer NOT NULL,
  success boolean NOT NULL DEFAULT false,
  metadata jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS side_hustle_progress_profile_idx ON public.side_hustle_progress(profile_id);
CREATE INDEX IF NOT EXISTS side_hustle_minigame_attempts_profile_idx ON public.side_hustle_minigame_attempts(profile_id);

ALTER TABLE public.side_hustle_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.side_hustle_minigame_attempts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Players can view their side hustle progress" ON public.side_hustle_progress;
CREATE POLICY "Players can view their side hustle progress" ON public.side_hustle_progress FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id=profile_id AND p.user_id=(SELECT auth.uid())));
DROP POLICY IF EXISTS "Players can manage their side hustle progress" ON public.side_hustle_progress;
CREATE POLICY "Players can manage their side hustle progress" ON public.side_hustle_progress FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id=profile_id AND p.user_id=(SELECT auth.uid())))
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id=profile_id AND p.user_id=(SELECT auth.uid())));
DROP POLICY IF EXISTS "Players can view their mini-game attempts" ON public.side_hustle_minigame_attempts;
CREATE POLICY "Players can view their mini-game attempts" ON public.side_hustle_minigame_attempts FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id=profile_id AND p.user_id=(SELECT auth.uid())));
DROP POLICY IF EXISTS "Players can insert their mini-game attempts" ON public.side_hustle_minigame_attempts;
CREATE POLICY "Players can insert their mini-game attempts" ON public.side_hustle_minigame_attempts FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id=profile_id AND p.user_id=(SELECT auth.uid())));
DROP POLICY IF EXISTS "Players can delete their mini-game attempts" ON public.side_hustle_minigame_attempts;
CREATE POLICY "Players can delete their mini-game attempts" ON public.side_hustle_minigame_attempts FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id=profile_id AND p.user_id=(SELECT auth.uid())));

DROP TRIGGER IF EXISTS update_side_hustle_progress_updated_at ON public.side_hustle_progress;
CREATE TRIGGER update_side_hustle_progress_updated_at BEFORE UPDATE ON public.side_hustle_progress
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
