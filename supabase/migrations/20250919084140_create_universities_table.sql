-- Create universities table to support education planning features
CREATE TABLE IF NOT EXISTS public.universities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  city TEXT NOT NULL,
  prestige INTEGER NOT NULL DEFAULT 50 CHECK (prestige BETWEEN 0 AND 100),
  quality_of_learning INTEGER NOT NULL DEFAULT 50 CHECK (quality_of_learning BETWEEN 0 AND 100),
  course_cost NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (course_cost >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  CONSTRAINT universities_name_city_unique UNIQUE (name, city)
);

-- The first September schema used a fixed `course_cost` amount, while
-- the October education schema and later seeds also require a multiplier and
-- descriptive copy. CREATE TABLE IF NOT EXISTS in that later migration does
-- not add missing columns, so reconcile the compatible additive fields here.
-- Existing university prices and records are preserved.
ALTER TABLE public.universities
  ADD COLUMN IF NOT EXISTS course_cost_modifier NUMERIC NOT NULL DEFAULT 1.0
    CHECK (course_cost_modifier BETWEEN 0.5 AND 2.0),
  ADD COLUMN IF NOT EXISTS description TEXT;

CREATE INDEX IF NOT EXISTS universities_city_idx ON public.universities (city);
CREATE INDEX IF NOT EXISTS universities_prestige_idx ON public.universities (prestige DESC);

ALTER TABLE public.universities ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Universities are viewable by everyone" ON public.universities;
CREATE POLICY "Universities are viewable by everyone"
  ON public.universities
  FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Service roles can manage universities" ON public.universities;
CREATE POLICY "Service roles can manage universities"
  ON public.universities
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- Some historical migration paths already installed update_universities_updated_at.
-- Do not install a second BEFORE UPDATE timestamp trigger under an alternate name.
DO $university_timestamp_trigger$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger t
    WHERE t.tgrelid = 'public.universities'::regclass
      AND t.tgname IN ('set_universities_updated_at', 'update_universities_updated_at')
      AND NOT t.tgisinternal
  ) THEN
    CREATE TRIGGER set_universities_updated_at
      BEFORE UPDATE ON public.universities
      FOR EACH ROW
      EXECUTE FUNCTION public.update_updated_at_column();
  END IF;
END
$university_timestamp_trigger$;

-- Seed initial data used by the Education experience
INSERT INTO public.universities (name, city, prestige, quality_of_learning, course_cost)
SELECT * FROM (VALUES
  ('Rockmundo Conservatory', 'London', 92, 95, 18500.00),
  ('Skyline School of Sound', 'New York', 88, 90, 21000.00),
  ('Harbor Lights Institute', 'Portsmouth', 76, 82, 12500.00)
) AS seed(name, city, prestige, quality_of_learning, course_cost)
ON CONFLICT (name, city) DO UPDATE
SET prestige = EXCLUDED.prestige,
    quality_of_learning = EXCLUDED.quality_of_learning,
    course_cost = EXCLUDED.course_cost;
