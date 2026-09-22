-- Repair Brand Administration by securing the canonical sponsorship brand catalog
-- and seed 200 additional fictional brands used by sponsorship/modeling/festival systems.

ALTER TABLE public.sponsorship_brands
  ADD COLUMN IF NOT EXISTS last_offer_at timestamptz;

CREATE UNIQUE INDEX IF NOT EXISTS sponsorship_brands_name_ci_unique
  ON public.sponsorship_brands (lower(name));

ALTER TABLE public.sponsorship_brands ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can insert sponsorship brands" ON public.sponsorship_brands;
CREATE POLICY "Admins can insert sponsorship brands"
  ON public.sponsorship_brands FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

DROP POLICY IF EXISTS "Admins can update sponsorship brands" ON public.sponsorship_brands;
CREATE POLICY "Admins can update sponsorship brands"
  ON public.sponsorship_brands FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

DROP POLICY IF EXISTS "Admins can delete sponsorship brands" ON public.sponsorship_brands;
CREATE POLICY "Admins can delete sponsorship brands"
  ON public.sponsorship_brands FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE OR REPLACE FUNCTION public.touch_sponsorship_brand_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS sponsorship_brands_set_updated_at ON public.sponsorship_brands;
CREATE TRIGGER sponsorship_brands_set_updated_at
  BEFORE UPDATE ON public.sponsorship_brands
  FOR EACH ROW EXECUTE FUNCTION public.touch_sponsorship_brand_updated_at();

WITH prefixes AS (
  SELECT * FROM unnest(ARRAY[
    'Apex','Arcadia','Beacon','Bluebird','Cinder','Copper','Drift','Ember','Evergreen','Foxglove',
    'Glasshouse','Harbour','Ironwood','Juniper','Kinetic','Lunar','Mariner','Northstar','Orchid','Rivet'
  ]) WITH ORDINALITY AS t(prefix, p)
),
suffixes AS (
  SELECT * FROM unnest(ARRAY[
    'Audio','Beverages','Collective','Digital','Equipment','Fashion','Mobility','Outdoors','Studios','Works'
  ]) WITH ORDINALITY AS t(suffix, s)
),
seed AS (
  SELECT prefix || ' ' || suffix AS name, ((p - 1) * 10 + s) AS ord
  FROM prefixes CROSS JOIN suffixes
)
INSERT INTO public.sponsorship_brands (
  name, category, region, size, wealth_tier, min_fame_required, is_active,
  available_budget, wealth_score, targeting_flags, min_fame_threshold, exclusivity_pref
)
SELECT
  name,
  (ARRAY['music_gear','soft_drinks','fashion','technology','gaming','automotive','finance','fitness','travel','entertainment'])[1 + ((ord - 1) % 10)],
  (ARRAY['United Kingdom','United States','Europe','North America','Asia Pacific','Latin America','Canada','Australia','Japan','Global'])[1 + ((ord - 1) % 10)],
  (ARRAY['emerging','growth','major','enterprise'])[1 + ((ord - 1) % 4)],
  1 + ((ord - 1) % 5),
  (ARRAY[0,250,1000,5000,20000,75000])[1 + ((ord - 1) % 6)],
  true,
  50000 + ((ord * 7919) % 4950000),
  10 + ((ord * 17) % 91),
  ARRAY[]::text[],
  (ARRAY[0,250,1000,5000,20000,75000])[1 + ((ord - 1) % 6)],
  (ord % 8 = 0)
FROM seed
ON CONFLICT ((lower(name))) DO NOTHING;
