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

DROP TRIGGER IF EXISTS set_universities_updated_at ON public.universities;
CREATE TRIGGER set_universities_updated_at
  BEFORE UPDATE ON public.universities
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

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
