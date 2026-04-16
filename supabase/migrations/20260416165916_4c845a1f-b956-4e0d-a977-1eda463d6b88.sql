
-- Update RPC to also set has_performed when triggered by a real performance
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

-- Backfill: any country where the band has at least one city gig should be marked performed
UPDATE public.band_country_fans bcf
SET has_performed = true,
    updated_at = now()
FROM (
  SELECT DISTINCT band_id, country
  FROM public.band_city_fans
  WHERE country IS NOT NULL AND gigs_in_city > 0
) gigs
WHERE bcf.band_id = gigs.band_id
  AND bcf.country = gigs.country
  AND COALESCE(bcf.has_performed, false) = false;
