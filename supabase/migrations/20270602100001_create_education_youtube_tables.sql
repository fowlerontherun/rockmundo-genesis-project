-- Create curated YouTube education tables for lessons and resource playlists
DO $$
BEGIN
  CREATE TYPE public.education_youtube_lesson_difficulty AS ENUM ('beginner', 'intermediate', 'advanced');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS public.education_youtube_lessons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  skill text NOT NULL CHECK (skill IN ('guitar', 'bass', 'drums', 'vocals', 'performance', 'songwriting')),
  title text NOT NULL,
  channel text NOT NULL,
  focus text NOT NULL,
  summary text NOT NULL,
  url text NOT NULL,
  difficulty public.education_youtube_lesson_difficulty NOT NULL,
  duration_minutes integer NOT NULL CHECK (duration_minutes > 0),
  attribute_keys text[] NOT NULL DEFAULT ARRAY[]::text[],
  required_skill_value integer CHECK (required_skill_value IS NULL OR required_skill_value >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS education_youtube_lessons_skill_idx ON public.education_youtube_lessons (skill);
CREATE INDEX IF NOT EXISTS education_youtube_lessons_difficulty_idx ON public.education_youtube_lessons (difficulty);

CREATE TABLE IF NOT EXISTS public.education_youtube_resources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  collection_key text NOT NULL,
  collection_title text NOT NULL,
  collection_description text,
  collection_sort_order integer NOT NULL DEFAULT 0 CHECK (collection_sort_order >= 0),
  resource_name text NOT NULL,
  resource_format text NOT NULL,
  resource_focus text NOT NULL,
  resource_summary text NOT NULL,
  resource_url text NOT NULL,
  resource_sort_order integer NOT NULL DEFAULT 0 CHECK (resource_sort_order >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS education_youtube_resources_collection_idx
  ON public.education_youtube_resources (collection_key, collection_sort_order);
CREATE INDEX IF NOT EXISTS education_youtube_resources_resource_order_idx
  ON public.education_youtube_resources (resource_sort_order, resource_name);

CREATE TRIGGER set_education_youtube_lessons_updated_at
  BEFORE UPDATE ON public.education_youtube_lessons
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER set_education_youtube_resources_updated_at
  BEFORE UPDATE ON public.education_youtube_resources
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.education_youtube_lessons ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.education_youtube_resources ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Education lessons are viewable by everyone" ON public.education_youtube_lessons;
CREATE POLICY "Education lessons are viewable by everyone"
  ON public.education_youtube_lessons
  FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Privileged roles manage education lessons" ON public.education_youtube_lessons;
CREATE POLICY "Privileged roles manage education lessons"
  ON public.education_youtube_lessons
  FOR ALL
  USING (
    auth.role() = 'service_role'
    OR public.has_role(auth.uid(), 'admin')
  )
  WITH CHECK (
    auth.role() = 'service_role'
    OR public.has_role(auth.uid(), 'admin')
  );

DROP POLICY IF EXISTS "Education resources are viewable by everyone" ON public.education_youtube_resources;
CREATE POLICY "Education resources are viewable by everyone"
  ON public.education_youtube_resources
  FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Privileged roles manage education resources" ON public.education_youtube_resources;
CREATE POLICY "Privileged roles manage education resources"
  ON public.education_youtube_resources
  FOR ALL
  USING (
    auth.role() = 'service_role'
    OR public.has_role(auth.uid(), 'admin')
  )
  WITH CHECK (
    auth.role() = 'service_role'
    OR public.has_role(auth.uid(), 'admin')
  );
