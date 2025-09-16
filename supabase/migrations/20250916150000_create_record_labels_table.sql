-- Create record_labels table to manage label data centrally
CREATE TABLE IF NOT EXISTS public.record_labels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  prestige INTEGER NOT NULL CHECK (prestige BETWEEN 1 AND 5),
  advance_payment INTEGER NOT NULL DEFAULT 0 CHECK (advance_payment >= 0),
  royalty_rate NUMERIC(6,4) NOT NULL DEFAULT 0 CHECK (royalty_rate >= 0 AND royalty_rate <= 1),
  description TEXT NOT NULL,
  requirements JSONB NOT NULL DEFAULT '{}'::jsonb,
  benefits TEXT[] NOT NULL DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.record_labels ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Record labels are viewable by everyone" ON public.record_labels;
CREATE POLICY "Record labels are viewable by everyone"
  ON public.record_labels
  FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Admins can manage record labels" ON public.record_labels;
CREATE POLICY "Admins can manage record labels"
  ON public.record_labels
  FOR ALL
  USING (public.has_role(auth.uid(), 'admin'));

CREATE OR REPLACE FUNCTION public.update_record_labels_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_record_labels_updated_at ON public.record_labels;
CREATE TRIGGER update_record_labels_updated_at
  BEFORE UPDATE ON public.record_labels
  FOR EACH ROW
  EXECUTE FUNCTION public.update_record_labels_updated_at();

-- Seed default labels
INSERT INTO public.record_labels (name, prestige, advance_payment, royalty_rate, description, requirements, benefits)
VALUES
  (
    'Indie Underground Records',
    1,
    5000,
    0.15,
    'A small independent label focusing on emerging artists.',
    '{"fame": 500, "songs": 3}'::jsonb,
    ARRAY['Studio access', 'Basic promotion', 'Digital distribution']
  ),
  (
    'City Sounds Music',
    2,
    15000,
    0.12,
    'Regional label with good distribution network.',
    '{"fame": 2000, "songs": 5, "performance": 60}'::jsonb,
    ARRAY['Professional recording', 'Radio promotion', 'Regional touring support']
  ),
  (
    'Thunder Records',
    3,
    50000,
    0.10,
    'Major label with national reach and big budgets.',
    '{"fame": 10000, "songs": 8, "performance": 80, "chart_position": 50}'::jsonb,
    ARRAY['Top-tier studios', 'National radio', 'Music videos', 'Tour support']
  ),
  (
    'Global Megacorp Music',
    4,
    200000,
    0.08,
    'International mega-label for superstar artists only.',
    '{"fame": 50000, "songs": 12, "performance": 95, "chart_position": 10}'::jsonb,
    ARRAY['World-class production', 'Global promotion', 'International tours', 'Award campaigns']
  )
ON CONFLICT (name) DO NOTHING;
