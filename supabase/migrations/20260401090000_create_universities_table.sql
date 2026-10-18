-- Create universities table to support the education planning experience
CREATE TABLE IF NOT EXISTS public.universities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  city TEXT NOT NULL,
  prestige INTEGER NOT NULL DEFAULT 50 CHECK (prestige BETWEEN 0 AND 100),
  quality_of_learning INTEGER NOT NULL DEFAULT 50 CHECK (quality_of_learning BETWEEN 0 AND 100),
  course_cost NUMERIC(12, 2) NOT NULL DEFAULT 0 CHECK (course_cost >= 0),
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
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

CREATE TRIGGER set_universities_updated_at
  BEFORE UPDATE ON public.universities
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Seed initial universities using whichever schema was created first.
-- October 2025's legacy universities table has course_cost_modifier; this
-- standalone migration's create-if-missing path has course_cost instead.
-- Re-running the seed must not overwrite already balanced university prices.
DO $education_university_seed$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'universities'
      AND column_name = 'course_cost_modifier'
  ) THEN
    INSERT INTO public.universities
      (name, city, prestige, quality_of_learning, course_cost_modifier)
    VALUES
      ('Rockmundo Conservatory', 'London', 92, 95, 1.5),
      ('Skyline School of Sound', 'New York', 88, 90, 1.3),
      ('Harbor Lights Institute', 'Portsmouth', 76, 82, 0.8),
      ('Sunset Boulevard Music Academy', 'Los Angeles', 84, 87, 1.2),
      ('Pulsewave Technology College', 'Toronto', 79, 85, 0.9)
    ON CONFLICT (name, city) DO NOTHING;
  ELSIF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'universities'
      AND column_name = 'course_cost'
  ) THEN
    INSERT INTO public.universities
      (name, city, prestige, quality_of_learning, course_cost)
    VALUES
      ('Rockmundo Conservatory', 'London', 92, 95, 18500.00),
      ('Skyline School of Sound', 'New York', 88, 90, 21000.00),
      ('Harbor Lights Institute', 'Portsmouth', 76, 82, 12500.00),
      ('Sunset Boulevard Music Academy', 'Los Angeles', 84, 87, 19850.00),
      ('Pulsewave Technology College', 'Toronto', 79, 85, 16200.00)
    ON CONFLICT (name, city) DO NOTHING;
  ELSE
    RAISE EXCEPTION 'Universities seed: neither course_cost_modifier nor course_cost exists';
  END IF;
END
$education_university_seed$;
