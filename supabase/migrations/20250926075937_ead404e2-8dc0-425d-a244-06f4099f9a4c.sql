-- Additive compatibility for skills, daily XP history, education resources,
-- and profile location. The base schema already owns public.player_skills.

ALTER TABLE public.player_skills
  ADD COLUMN IF NOT EXISTS creativity integer DEFAULT 1,
  ADD COLUMN IF NOT EXISTS technical integer DEFAULT 1,
  ADD COLUMN IF NOT EXISTS business integer DEFAULT 1,
  ADD COLUMN IF NOT EXISTS marketing integer DEFAULT 1,
  ADD COLUMN IF NOT EXISTS composition integer DEFAULT 1;

ALTER TABLE public.player_skills ENABLE ROW LEVEL SECURITY;

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

DROP POLICY IF EXISTS "Users can view their own XP grants"
  ON public.profile_daily_xp_grants;
CREATE POLICY "Users can view their own XP grants"
  ON public.profile_daily_xp_grants
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.profiles
      WHERE profiles.id = profile_daily_xp_grants.profile_id
        AND profiles.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can insert their own XP grants"
  ON public.profile_daily_xp_grants;
CREATE POLICY "Users can insert their own XP grants"
  ON public.profile_daily_xp_grants
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.profiles
      WHERE profiles.id = profile_daily_xp_grants.profile_id
        AND profiles.user_id = auth.uid()
    )
  );

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

-- The September 21 curated-resource migration may have created this table
-- with playlist-specific columns already. CREATE TABLE IF NOT EXISTS above
-- does not reconcile that shape. Preserve curated rows and add the legacy
-- video seed fields required by the December 18 migration on clean replay.
ALTER TABLE public.education_youtube_resources
  ADD COLUMN IF NOT EXISTS title varchar,
  ADD COLUMN IF NOT EXISTS description text,
  ADD COLUMN IF NOT EXISTS video_url varchar,
  ADD COLUMN IF NOT EXISTS category varchar,
  ADD COLUMN IF NOT EXISTS difficulty_level integer DEFAULT 1,
  ADD COLUMN IF NOT EXISTS duration_minutes integer,
  ADD COLUMN IF NOT EXISTS tags text[];

-- Historical video seeds (including the later December replacement catalogue)
-- supply legacy fields only. Fill the curated table's mandatory metadata before
-- checking its NOT NULL constraints; do not weaken curated playlist contracts.
CREATE OR REPLACE FUNCTION public.fill_education_youtube_legacy_metadata()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $youtube_compat$
BEGIN
  NEW.collection_key := COALESCE(NEW.collection_key, 'legacy-education-videos');
  NEW.collection_title := COALESCE(NEW.collection_title, 'Education videos');
  NEW.resource_name := COALESCE(NEW.resource_name, NEW.title);
  NEW.resource_format := COALESCE(NEW.resource_format, 'video');
  NEW.resource_focus := COALESCE(NEW.resource_focus, NEW.category, 'general');
  NEW.resource_summary := COALESCE(NEW.resource_summary, NEW.description, '');
  NEW.resource_url := COALESCE(NEW.resource_url, NEW.video_url);
  RETURN NEW;
END;
$youtube_compat$;

DROP TRIGGER IF EXISTS fill_education_youtube_legacy_metadata ON public.education_youtube_resources;
CREATE TRIGGER fill_education_youtube_legacy_metadata
  BEFORE INSERT ON public.education_youtube_resources
  FOR EACH ROW
  EXECUTE FUNCTION public.fill_education_youtube_legacy_metadata();

ALTER TABLE public.education_youtube_resources ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "YouTube resources are viewable by everyone"
  ON public.education_youtube_resources;
CREATE POLICY "YouTube resources are viewable by everyone"
  ON public.education_youtube_resources
  FOR SELECT
  USING (true);

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS current_city_id uuid;

DROP TRIGGER IF EXISTS update_player_skills_updated_at
  ON public.player_skills;
CREATE TRIGGER update_player_skills_updated_at
  BEFORE UPDATE ON public.player_skills
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_education_youtube_resources_updated_at
  ON public.education_youtube_resources;
CREATE TRIGGER update_education_youtube_resources_updated_at
  BEFORE UPDATE ON public.education_youtube_resources
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
