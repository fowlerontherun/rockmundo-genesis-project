DROP FUNCTION IF EXISTS public.add_band_country_fame(uuid, text, integer, integer);

CREATE OR REPLACE FUNCTION public.add_band_country_fame(
  p_band_id uuid,
  p_country text,
  p_fame_amount integer DEFAULT 0,
  p_fans_amount integer DEFAULT 0,
  p_mark_performed boolean DEFAULT true
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO band_country_fans (band_id, country, fame, total_fans, casual_fans, has_performed, last_activity_date, updated_at)
  VALUES (p_band_id, p_country, p_fame_amount, p_fans_amount, p_fans_amount, p_mark_performed, now(), now())
  ON CONFLICT (band_id, country)
  DO UPDATE SET
    fame = band_country_fans.fame + EXCLUDED.fame,
    total_fans = band_country_fans.total_fans + EXCLUDED.total_fans,
    casual_fans = band_country_fans.casual_fans + EXCLUDED.total_fans,
    has_performed = band_country_fans.has_performed OR EXCLUDED.has_performed,
    last_activity_date = now(),
    updated_at = now();
END;
$function$;

INSERT INTO public.band_country_fans (band_id, country, fame, total_fans, casual_fans, has_performed, last_activity_date, updated_at)
SELECT
  bcf.band_id,
  bcf.country,
  LEAST(GREATEST(SUM(COALESCE(bcf.city_fame, 0))::int, 0), 1000000) AS fame,
  LEAST(GREATEST(SUM(COALESCE(bcf.total_fans, 0))::int, 0), 2000000000) AS total_fans,
  LEAST(GREATEST(SUM(COALESCE(bcf.casual_fans, 0))::int, 0), 2000000000) AS casual_fans,
  bool_or(COALESCE(bcf.gigs_in_city, 0) > 0) AS has_performed,
  now(),
  now()
FROM public.band_city_fans bcf
WHERE bcf.country IS NOT NULL
GROUP BY bcf.band_id, bcf.country
ON CONFLICT (band_id, country)
DO UPDATE SET
  fame = GREATEST(band_country_fans.fame, EXCLUDED.fame),
  total_fans = GREATEST(band_country_fans.total_fans, EXCLUDED.total_fans),
  has_performed = band_country_fans.has_performed OR EXCLUDED.has_performed,
  updated_at = now();