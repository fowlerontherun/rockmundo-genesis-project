-- Reconcile databases where the historical migration failed while recreating
-- public.player_skills. All operations are additive and replay-safe.

ALTER TABLE public.player_skills
  ADD COLUMN IF NOT EXISTS creativity integer DEFAULT 1,
  ADD COLUMN IF NOT EXISTS technical integer DEFAULT 1,
  ADD COLUMN IF NOT EXISTS business integer DEFAULT 1,
  ADD COLUMN IF NOT EXISTS marketing integer DEFAULT 1,
  ADD COLUMN IF NOT EXISTS composition integer DEFAULT 1;

CREATE TABLE IF NOT EXISTS public.profile_daily_xp_grants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  grant_date date NOT NULL DEFAULT current_date,
  xp_amount integer NOT NULL DEFAULT 0,
  source varchar NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS profile_daily_xp_grants_profile_date_idx
  ON public.profile_daily_xp_grants(profile_id, grant_date DESC);
ALTER TABLE public.profile_daily_xp_grants ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can view their own XP grants" ON public.profile_daily_xp_grants;
CREATE POLICY "Users can view their own XP grants"
  ON public.profile_daily_xp_grants FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.id = profile_daily_xp_grants.profile_id
      AND profiles.user_id = auth.uid()
  ));
DROP POLICY IF EXISTS "Users can insert their own XP grants" ON public.profile_daily_xp_grants;
CREATE POLICY "Users can insert their own XP grants"
  ON public.profile_daily_xp_grants FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.id = profile_daily_xp_grants.profile_id
      AND profiles.user_id = auth.uid()
  ));

CREATE TABLE IF NOT EXISTS public.education_youtube_resources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title varchar NOT NULL,
  description text,
  video_url varchar NOT NULL,
  category varchar,
  difficulty_level integer DEFAULT 1,
  duration_minutes integer,
  tags text[],
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.education_youtube_resources ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "YouTube resources are viewable by everyone"
  ON public.education_youtube_resources;
CREATE POLICY "YouTube resources are viewable by everyone"
  ON public.education_youtube_resources FOR SELECT USING (true);

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS current_city_id uuid;

DROP TRIGGER IF EXISTS update_player_skills_updated_at ON public.player_skills;
CREATE TRIGGER update_player_skills_updated_at
  BEFORE UPDATE ON public.player_skills
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
DROP TRIGGER IF EXISTS update_education_youtube_resources_updated_at
  ON public.education_youtube_resources;
CREATE TRIGGER update_education_youtube_resources_updated_at
  BEFORE UPDATE ON public.education_youtube_resources
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
