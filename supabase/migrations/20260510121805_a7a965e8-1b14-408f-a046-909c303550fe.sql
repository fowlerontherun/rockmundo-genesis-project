CREATE OR REPLACE FUNCTION public._tour_leg_distance_km(_from_city uuid, _to_city uuid)
RETURNS numeric LANGUAGE sql STABLE AS $$
  SELECT CASE
      WHEN fc.latitude IS NULL OR fc.longitude IS NULL OR tc.latitude IS NULL OR tc.longitude IS NULL THEN NULL
      ELSE 2 * 6371 * asin(sqrt(
        power(sin(radians((tc.latitude - fc.latitude) / 2)), 2) +
        cos(radians(fc.latitude)) * cos(radians(tc.latitude)) *
        power(sin(radians((tc.longitude - fc.longitude) / 2)), 2)))
    END
  FROM public.cities fc, public.cities tc
  WHERE fc.id = _from_city AND tc.id = _to_city;
$$;

CREATE OR REPLACE FUNCTION public._tour_leg_hours(_distance_km numeric, _mode text)
RETURNS integer LANGUAGE sql IMMUTABLE AS $$
  SELECT GREATEST(1, ceil(
    CASE COALESCE(_mode, 'bus')
      WHEN 'plane'    THEN COALESCE(_distance_km, 800) / 1250.0 + 0.75
      WHEN 'train'    THEN COALESCE(_distance_km, 400) / 320.0  + 0.15
      WHEN 'ship'     THEN COALESCE(_distance_km, 400) / 65.0   + 0.30
      WHEN 'tour_bus' THEN COALESCE(_distance_km, 400) / 115.0  + 0.10
      ELSE                  COALESCE(_distance_km, 400) / 95.0  + 0.10
    END
  )::int);
$$;

WITH targets AS (
  SELECT id, departure_date,
    public._tour_leg_hours(public._tour_leg_distance_km(from_city_id, to_city_id), travel_mode) AS new_hours
  FROM public.tour_travel_legs
  WHERE COALESCE(travel_duration_hours, 0) <= 0
     OR (arrival_date - departure_date) >= interval '20 hours'
)
UPDATE public.tour_travel_legs t
SET travel_duration_hours = targets.new_hours,
    arrival_date = targets.departure_date + (targets.new_hours || ' hours')::interval
FROM targets WHERE t.id = targets.id;

-- Disable the timeline-event trigger temporarily so the bulk corrective UPDATE
-- doesn't choke on legacy rows missing profile_id (an unrelated data issue).
ALTER TABLE public.player_travel_history DISABLE TRIGGER USER;

UPDATE public.player_travel_history pth
SET travel_duration_hours = l.travel_duration_hours,
    arrival_time = l.arrival_date,
    departure_time = l.departure_date
FROM public.tour_travel_legs l
WHERE pth.tour_leg_id = l.id
  AND pth.profile_id IS NOT NULL
  AND (COALESCE(pth.travel_duration_hours, 0) <= 0
       OR (pth.arrival_time - pth.departure_time) >= interval '20 hours');

ALTER TABLE public.player_travel_history ENABLE TRIGGER USER;

UPDATE public.player_scheduled_activities psa
SET scheduled_start = pth.departure_time,
    scheduled_end = pth.arrival_time,
    description = COALESCE(pth.transport_type, 'tour_bus')
                  || ' journey (' || GREATEST(1, pth.travel_duration_hours)::text
                  || 'h) — Tour transport'
FROM public.player_travel_history pth
WHERE psa.activity_type = 'travel'
  AND psa.metadata ? 'travel_history_id'
  AND psa.metadata->>'travel_history_id' = pth.id::text
  AND (psa.scheduled_end - psa.scheduled_start) >= interval '20 hours';

DROP FUNCTION public._tour_leg_hours(numeric, text);
DROP FUNCTION public._tour_leg_distance_km(uuid, uuid);