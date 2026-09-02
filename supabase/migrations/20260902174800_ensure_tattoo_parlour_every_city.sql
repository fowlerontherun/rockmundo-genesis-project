-- Ensure every existing city has at least one tattoo parlour.
-- Existing parlours are preserved; only cities with no parlour are backfilled.

INSERT INTO public.tattoo_parlours (
  city_id,
  name,
  quality_tier,
  price_multiplier,
  infection_risk,
  specialties,
  description
)
SELECT
  c.id,
  c.name || ' Ink',
  3,
  1.0,
  0.08,
  ARRAY['text', 'musical']::text[],
  'A reliable local tattoo parlour serving ' || c.name || '.'
FROM public.cities c
WHERE NOT EXISTS (
  SELECT 1
  FROM public.tattoo_parlours p
  WHERE p.city_id = c.id
);
