-- Support Band Marketplace - Phase 4 tour matching and travel feasibility

CREATE OR REPLACE FUNCTION public.estimate_support_travel_minutes(
  p_from_city_id uuid,
  p_to_city_id uuid
) RETURNS integer
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  WITH coords AS (
    SELECT
      c1.latitude::double precision AS lat1,
      c1.longitude::double precision AS lon1,
      c2.latitude::double precision AS lat2,
      c2.longitude::double precision AS lon2
    FROM public.cities c1
    CROSS JOIN public.cities c2
    WHERE c1.id = p_from_city_id AND c2.id = p_to_city_id
  ), distance AS (
    SELECT CASE
      WHEN lat1 IS NULL OR lon1 IS NULL OR lat2 IS NULL OR lon2 IS NULL THEN NULL
      ELSE 6371.0 * 2.0 * asin(
        sqrt(
          power(sin(radians(lat2-lat1)/2.0),2) +
          cos(radians(lat1))*cos(radians(lat2))*power(sin(radians(lon2-lon1)/2.0),2)
        )
      )
    END AS km
    FROM coords
  )
  SELECT CASE
    WHEN p_from_city_id = p_to_city_id THEN 0
    WHEN km IS NULL THEN 360
    ELSE GREATEST(60, CEIL((km / 80.0) * 60.0 + 60.0)::integer)
  END
  FROM distance;
$$;

CREATE OR REPLACE FUNCTION public.find_tour_support_candidates(
  p_headliner_band_id uuid,
  p_tour_id uuid
) RETURNS TABLE (
  support_band_id uuid,
  support_band_name text,
  fame integer,
  popularity integer,
  eligible_shows integer,
  total_shows integer,
  full_tour_match boolean
)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  WITH tour_gigs AS (
    SELECT
      g.id AS gig_id,
      g.venue_id,
      g.scheduled_date,
      COALESCE(g.scheduled_end, g.scheduled_date + interval '3 hours') AS scheduled_end,
      v.city_id,
      COALESCE(v.capacity,0)::integer AS capacity,
      row_number() OVER (ORDER BY g.scheduled_date, g.id) AS seq
    FROM public.gigs g
    JOIN public.venues v ON v.id = g.venue_id
    WHERE g.tour_id = p_tour_id
      AND g.band_id = p_headliner_band_id
      AND g.status IN ('scheduled','in_progress','ready_for_completion')
  ), candidate_shows AS (
    SELECT tg.*, c.band_id, c.band_name, c.fame, c.popularity
    FROM tour_gigs tg
    JOIN LATERAL public.find_available_support_bands(
      p_headliner_band_id,
      tg.city_id,
      tg.scheduled_date,
      tg.scheduled_end,
      true,
      tg.capacity
    ) c ON true
  ), travel_ok AS (
    SELECT cs.*,
      prev_cs.city_id AS prev_city_id,
      prev_cs.scheduled_end AS prev_end,
      next_cs.city_id AS next_city_id,
      next_cs.scheduled_date AS next_start,
      pref.max_travel_minutes,
      pref.travel_enabled,
      CASE
        WHEN prev_cs.city_id IS NULL THEN true
        WHEN prev_cs.band_id IS DISTINCT FROM cs.band_id THEN true
        WHEN NOT pref.travel_enabled AND prev_cs.city_id <> cs.city_id THEN false
        ELSE EXTRACT(EPOCH FROM (cs.scheduled_date - prev_cs.scheduled_end))/60 >=
          LEAST(COALESCE(pref.max_travel_minutes, 1000000), public.estimate_support_travel_minutes(prev_cs.city_id, cs.city_id))
      END AS previous_leg_ok,
      CASE
        WHEN next_cs.city_id IS NULL THEN true
        WHEN next_cs.band_id IS DISTINCT FROM cs.band_id THEN true
        WHEN NOT pref.travel_enabled AND next_cs.city_id <> cs.city_id THEN false
        ELSE EXTRACT(EPOCH FROM (next_cs.scheduled_date - cs.scheduled_end))/60 >=
          LEAST(COALESCE(pref.max_travel_minutes, 1000000), public.estimate_support_travel_minutes(cs.city_id, next_cs.city_id))
      END AS next_leg_ok
    FROM candidate_shows cs
    JOIN public.band_support_preferences pref ON pref.band_id = cs.band_id
    LEFT JOIN candidate_shows prev_cs ON prev_cs.band_id = cs.band_id AND prev_cs.seq = cs.seq - 1
    LEFT JOIN candidate_shows next_cs ON next_cs.band_id = cs.band_id AND next_cs.seq = cs.seq + 1
  ), counts AS (
    SELECT
      band_id,
      max(band_name) AS band_name,
      max(fame) AS fame,
      max(popularity) AS popularity,
      count(*) FILTER (WHERE previous_leg_ok AND next_leg_ok)::integer AS eligible_shows
    FROM travel_ok
    GROUP BY band_id
  ), total AS (
    SELECT count(*)::integer AS total_shows FROM tour_gigs
  )
  SELECT
    c.band_id,
    c.band_name,
    c.fame,
    c.popularity,
    c.eligible_shows,
    t.total_shows,
    c.eligible_shows = t.total_shows AS full_tour_match
  FROM counts c CROSS JOIN total t
  WHERE c.eligible_shows > 0
  ORDER BY full_tour_match DESC, eligible_shows DESC, popularity DESC, fame DESC, band_name ASC;
$$;

CREATE OR REPLACE FUNCTION public.find_tour_support_show_candidates(
  p_headliner_band_id uuid,
  p_tour_id uuid
) RETURNS TABLE (
  gig_id uuid,
  scheduled_date timestamptz,
  city_id uuid,
  venue_id uuid,
  support_band_id uuid,
  support_band_name text,
  fame integer,
  popularity integer,
  travel_feasible boolean
)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  WITH tour_gigs AS (
    SELECT
      g.id AS gig_id,
      g.venue_id,
      g.scheduled_date,
      COALESCE(g.scheduled_end, g.scheduled_date + interval '3 hours') AS scheduled_end,
      v.city_id,
      COALESCE(v.capacity,0)::integer AS capacity
    FROM public.gigs g
    JOIN public.venues v ON v.id = g.venue_id
    WHERE g.tour_id = p_tour_id
      AND g.band_id = p_headliner_band_id
      AND g.status IN ('scheduled','in_progress','ready_for_completion')
  )
  SELECT
    tg.gig_id,
    tg.scheduled_date,
    tg.city_id,
    tg.venue_id,
    c.band_id,
    c.band_name,
    c.fame,
    c.popularity,
    true AS travel_feasible
  FROM tour_gigs tg
  JOIN LATERAL public.find_available_support_bands(
    p_headliner_band_id,
    tg.city_id,
    tg.scheduled_date,
    tg.scheduled_end,
    true,
    tg.capacity
  ) c ON true
  ORDER BY tg.scheduled_date, c.popularity DESC, c.fame DESC, c.band_name;
$$;

REVOKE ALL ON FUNCTION public.estimate_support_travel_minutes(uuid,uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.find_tour_support_candidates(uuid,uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.find_tour_support_show_candidates(uuid,uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.estimate_support_travel_minutes(uuid,uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.find_tour_support_candidates(uuid,uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.find_tour_support_show_candidates(uuid,uuid) TO authenticated;

COMMENT ON FUNCTION public.find_tour_support_candidates(uuid,uuid) IS 'Ranks support bands across a headliner tour using authoritative per-show availability and conservative adjacent-city travel feasibility.';
