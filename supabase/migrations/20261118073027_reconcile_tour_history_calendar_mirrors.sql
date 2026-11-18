-- #4251: Existing tour travel history must still gain a calendar mirror if
-- an earlier schedule insert failed. The repair is safe to run repeatedly.
-- Deployment order: apply this migration before the process-tour-travel worker.
CREATE OR REPLACE FUNCTION public.reconcile_tour_travel_calendar(p_batch_size integer DEFAULT 100)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $reconcile$
DECLARE
  v_inserted integer;
BEGIN
  IF p_batch_size IS NULL OR p_batch_size < 1 OR p_batch_size > 250 THEN
    RAISE EXCEPTION 'tour_calendar_repair_invalid_batch_size' USING ERRCODE = '22023';
  END IF;

  WITH candidates AS MATERIALIZED (
    SELECT h.id AS history_id, h.user_id, h.profile_id, h.tour_leg_id,
           h.from_city_id, h.to_city_id, h.transport_type, h.status,
           COALESCE(h.scheduled_departure_time, h.departure_time) AS departure,
           h.arrival_time AS arrival,
           l.tour_id,
           COALESCE(origin.name, 'Departure') AS origin_name,
           COALESCE(destination.name, 'Destination') AS destination_name,
           destination.country AS destination_country
    FROM public.player_travel_history h
    JOIN public.tour_travel_legs l ON l.id = h.tour_leg_id
    JOIN public.tours t ON t.id = l.tour_id
    JOIN public.profiles p ON p.id = h.profile_id AND p.user_id = h.user_id
    LEFT JOIN public.cities origin ON origin.id = h.from_city_id
    LEFT JOIN public.cities destination ON destination.id = h.to_city_id
    WHERE h.tour_leg_id IS NOT NULL
      AND h.profile_id IS NOT NULL
      AND h.status IN ('scheduled', 'in_progress', 'completed')
      AND l.status IS DISTINCT FROM 'cancelled'
      AND t.status IS DISTINCT FROM 'cancelled'
      AND NOT COALESCE(t.cancelled, false)
      AND COALESCE(h.scheduled_departure_time, h.departure_time) IS NOT NULL
      AND h.arrival_time > COALESCE(h.scheduled_departure_time, h.departure_time)
      AND NOT EXISTS (
        SELECT 1 FROM public.player_scheduled_activities a
        WHERE a.profile_id = h.profile_id
          AND a.activity_type = 'travel'
          AND (a.metadata->>'travel_history_id' = h.id::text
            OR a.metadata->>'tour_leg_id' = h.tour_leg_id::text)
      )
    ORDER BY h.departure_time, h.id
    LIMIT p_batch_size
    FOR UPDATE OF h SKIP LOCKED
  ), inserted AS (
    INSERT INTO public.player_scheduled_activities (
      user_id, profile_id, activity_type, status, scheduled_start, scheduled_end,
      title, description, location, metadata
    )
    SELECT c.user_id, c.profile_id, 'travel', c.status, c.departure, c.arrival,
           'Tour Travel: ' || c.origin_name || ' → ' || c.destination_name,
           COALESCE(c.transport_type, 'bus') || ' journey — Tour',
           CONCAT_WS(', ', c.destination_name, c.destination_country),
           jsonb_build_object(
             'travel_history_id', c.history_id,
             'tour_leg_id', c.tour_leg_id,
             'tour_id', c.tour_id,
             'from_city_id', c.from_city_id,
             'to_city_id', c.to_city_id,
             'transport_type', c.transport_type,
             'travel_source', 'history_repair'
           )
    FROM candidates c
    -- Both profile+history and profile+leg have existing unique indexes.
    -- ON CONFLICT makes simultaneous sync/rejoin/reconciliation idempotent.
    ON CONFLICT DO NOTHING
    RETURNING id
  )
  SELECT count(*) INTO v_inserted FROM inserted;

  RETURN v_inserted;
END;
$reconcile$;

REVOKE ALL ON FUNCTION public.reconcile_tour_travel_calendar(integer)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reconcile_tour_travel_calendar(integer) TO service_role;
