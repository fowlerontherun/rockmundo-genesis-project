-- Fix existing tour travel legs that were created with 'bus' mode but should be plane/train
-- This is a data repair, recalculating based on city coordinates and distance

-- Step 1: Update tour_travel_legs - recalculate mode and duration based on distance
WITH leg_distances AS (
  SELECT 
    ttl.id,
    ttl.departure_date,
    ttl.travel_duration_hours as old_duration,
    6371 * 2 * ASIN(SQRT(
      POWER(SIN(RADIANS(tc.latitude - fc.latitude) / 2), 2) +
      COS(RADIANS(fc.latitude)) * COS(RADIANS(tc.latitude)) *
      POWER(SIN(RADIANS(tc.longitude - fc.longitude) / 2), 2)
    )) as distance_km
  FROM public.tour_travel_legs ttl
  JOIN public.cities fc ON fc.id = ttl.from_city_id
  JOIN public.cities tc ON tc.id = ttl.to_city_id
  WHERE ttl.travel_mode = 'bus' 
    AND ttl.travel_duration_hours > 12
    AND fc.latitude IS NOT NULL AND tc.latitude IS NOT NULL
),
recalculated AS (
  SELECT 
    id,
    departure_date,
    distance_km,
    old_duration,
    CASE 
      WHEN distance_km > 800 THEN 'plane'
      WHEN distance_km > 200 THEN 'train'
      ELSE 'bus'
    END as new_mode,
    CASE 
      WHEN distance_km > 800 THEN CEIL(distance_km / 944.0 + 2.7)
      WHEN distance_km > 200 THEN CEIL(distance_km / 200.0 + 0.45)
      ELSE CEIL(distance_km / 56.0 + 0.27)
    END as new_duration_hours
  FROM leg_distances
)
UPDATE public.tour_travel_legs ttl
SET 
  travel_mode = r.new_mode,
  travel_duration_hours = r.new_duration_hours,
  arrival_date = ttl.departure_date + (r.new_duration_hours || ' hours')::interval
FROM recalculated r
WHERE ttl.id = r.id;

-- Step 2: Fix currently in-progress player_travel_history with inflated duration
WITH travel_fix AS (
  SELECT 
    pth.id,
    pth.departure_time,
    6371 * 2 * ASIN(SQRT(
      POWER(SIN(RADIANS(tc.latitude - fc.latitude) / 2), 2) +
      COS(RADIANS(fc.latitude)) * COS(RADIANS(tc.latitude)) *
      POWER(SIN(RADIANS(tc.longitude - fc.longitude) / 2), 2)
    )) as distance_km
  FROM public.player_travel_history pth
  JOIN public.cities fc ON fc.id = pth.from_city_id
  JOIN public.cities tc ON tc.id = pth.to_city_id
  WHERE pth.status = 'in_progress' 
    AND pth.tour_leg_id IS NOT NULL
    AND pth.travel_duration_hours > 12
    AND fc.latitude IS NOT NULL AND tc.latitude IS NOT NULL
),
travel_recalc AS (
  SELECT 
    id,
    departure_time,
    distance_km,
    CASE 
      WHEN distance_km > 800 THEN 'plane'
      WHEN distance_km > 200 THEN 'train'
      ELSE 'bus'
    END as new_transport,
    CASE 
      WHEN distance_km > 800 THEN CEIL(distance_km / 944.0 + 2.7)
      WHEN distance_km > 200 THEN CEIL(distance_km / 200.0 + 0.45)
      ELSE CEIL(distance_km / 56.0 + 0.27)
    END as new_duration_hours
  FROM travel_fix
)
UPDATE public.player_travel_history pth
SET 
  transport_type = tr.new_transport,
  travel_duration_hours = tr.new_duration_hours,
  arrival_time = pth.departure_time + (tr.new_duration_hours || ' hours')::interval
FROM travel_recalc tr
WHERE pth.id = tr.id;

-- Step 3: Fix profiles.travel_arrives_at for users with corrected in-progress travel
UPDATE public.profiles p
SET travel_arrives_at = pth.arrival_time
FROM public.player_travel_history pth
WHERE pth.user_id = p.user_id
  AND pth.status = 'in_progress'
  AND pth.tour_leg_id IS NOT NULL
  AND p.is_traveling = true;

-- Step 4: Fix player_scheduled_activities for corrected travel
UPDATE public.player_scheduled_activities psa
SET scheduled_end = pth.arrival_time
FROM public.player_travel_history pth
WHERE psa.user_id = pth.user_id
  AND psa.activity_type = 'travel'
  AND psa.status IN ('in_progress', 'scheduled')
  AND pth.status = 'in_progress'
  AND pth.tour_leg_id IS NOT NULL;