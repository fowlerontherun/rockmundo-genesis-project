-- Tracks XP awards per friend pair to enforce caps and roll up affinity
CREATE TABLE public.relationship_xp_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL,
  other_profile_id uuid NOT NULL,
  pair_key text NOT NULL,
  action_type text NOT NULL,
  xp_awarded integer NOT NULL DEFAULT 0,
  skill_xp_awarded integer NOT NULL DEFAULT 0,
  skill_slug text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_relationship_xp_log_pair ON public.relationship_xp_log (pair_key, created_at DESC);
CREATE INDEX idx_relationship_xp_log_profile ON public.relationship_xp_log (profile_id, created_at DESC);
CREATE INDEX idx_relationship_xp_log_action ON public.relationship_xp_log (profile_id, other_profile_id, action_type, created_at DESC);

ALTER TABLE public.relationship_xp_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Players can read their own relationship XP log"
  ON public.relationship_xp_log FOR SELECT TO authenticated
  USING (profile_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid()));

CREATE POLICY "Players can insert their own relationship XP log"
  ON public.relationship_xp_log FOR INSERT TO authenticated
  WITH CHECK (profile_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid()));

-- Daily streak tracker
CREATE TABLE public.daily_social_streaks (
  profile_id uuid PRIMARY KEY,
  current_streak integer NOT NULL DEFAULT 0,
  last_interaction_date date NOT NULL,
  total_days integer NOT NULL DEFAULT 0,
  longest_streak integer NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.daily_social_streaks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Players can read their own social streak"
  ON public.daily_social_streaks FOR SELECT TO authenticated
  USING (profile_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid()));

CREATE POLICY "Players can write their own social streak"
  ON public.daily_social_streaks FOR ALL TO authenticated
  USING (profile_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid()))
  WITH CHECK (profile_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid()));

-- Helper: friendship tier from lifetime pair XP
CREATE OR REPLACE FUNCTION public.get_friendship_tier(profile_a uuid, profile_b uuid)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE
    WHEN COALESCE(SUM(xp_awarded), 0) >= 1000 THEN 'legendary-duo'
    WHEN COALESCE(SUM(xp_awarded), 0) >= 600  THEN 'inner-circle'
    WHEN COALESCE(SUM(xp_awarded), 0) >= 250  THEN 'bandmate'
    ELSE 'acquaintance'
  END
  FROM public.relationship_xp_log
  WHERE pair_key = LEAST(profile_a::text, profile_b::text) || ':' || GREATEST(profile_a::text, profile_b::text);
$$;

-- Helper: lifetime XP earned from a friend pair
CREATE OR REPLACE FUNCTION public.get_friendship_lifetime_xp(profile_a uuid, profile_b uuid)
RETURNS integer
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(SUM(xp_awarded), 0)::integer
  FROM public.relationship_xp_log
  WHERE pair_key = LEAST(profile_a::text, profile_b::text) || ':' || GREATEST(profile_a::text, profile_b::text);
$$;