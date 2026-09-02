-- Ensure every tattoo parlour is actually usable by providing at least one resident artist.
-- Existing artists are preserved. This is safe to rerun because only parlours with no artists are targeted.

INSERT INTO public.tattoo_artists (
  parlour_id,
  name,
  nickname,
  fame_level,
  specialty,
  quality_bonus,
  price_premium,
  accepts_custom,
  bio
)
SELECT
  p.id,
  c.name || ' Resident Artist',
  'Local Ink',
  GREATEST(5, p.quality_tier * 10),
  COALESCE(p.specialties[1], 'traditional'),
  GREATEST(0, (p.quality_tier - 2) * 2),
  1.0,
  p.quality_tier >= 3,
  'Resident tattoo artist serving ' || c.name || '.'
FROM public.tattoo_parlours p
JOIN public.cities c ON c.id = p.city_id
WHERE NOT EXISTS (
  SELECT 1
  FROM public.tattoo_artists a
  WHERE a.parlour_id = p.id
);
