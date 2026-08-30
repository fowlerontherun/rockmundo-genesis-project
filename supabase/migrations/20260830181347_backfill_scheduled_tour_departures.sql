-- Future rejoin rows created by the legacy endpoint stored departure_time but
-- left scheduled_departure_time null. The travel reconciler keys off the latter,
-- so backfill it to ensure these scheduled journeys start at the correct time.

UPDATE public.player_travel_history
SET scheduled_departure_time = departure_time
WHERE status = 'scheduled'
  AND tour_leg_id IS NOT NULL
  AND scheduled_departure_time IS NULL
  AND departure_time > now();
