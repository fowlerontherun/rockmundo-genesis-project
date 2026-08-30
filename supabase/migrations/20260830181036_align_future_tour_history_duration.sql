-- The preceding release repairs premature in-progress tour histories after it
-- shortens future legs. Align those newly scheduled character rows with the
-- already-shortened canonical leg once the status repair has completed.

UPDATE public.player_travel_history h
SET arrival_time = l.arrival_date,
    travel_duration_hours = l.travel_duration_hours
FROM public.tour_travel_legs l
WHERE h.tour_leg_id = l.id
  AND h.status = 'scheduled'
  AND coalesce(h.scheduled_departure_time, h.departure_time) > now()
  AND (
    h.arrival_time IS DISTINCT FROM l.arrival_date
    OR h.travel_duration_hours IS DISTINCT FROM l.travel_duration_hours
  );

UPDATE public.player_scheduled_activities a
SET scheduled_start = coalesce(h.scheduled_departure_time, h.departure_time),
    scheduled_end = h.arrival_time,
    status = 'scheduled'
FROM public.player_travel_history h
WHERE h.profile_id = a.profile_id
  AND h.status = 'scheduled'
  AND coalesce(h.scheduled_departure_time, h.departure_time) > now()
  AND a.activity_type = 'travel'
  AND a.metadata->>'travel_history_id' = h.id::text;
