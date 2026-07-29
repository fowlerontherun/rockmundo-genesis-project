-- Generate every tour journey inside the same transaction as tour and gig booking.
-- Impossible routes now roll back the entire booking instead of creating a broken tour.

CREATE OR REPLACE FUNCTION public.book_tour(
  p_band_id uuid,
  p_name text,
  p_start_date date,
  p_end_date date,
  p_setlist_id uuid,
  p_ticket_price integer,
  p_stops jsonb,
  p_request_id uuid,
  p_ticket_operator_id text DEFAULT NULL,
  p_rider_id uuid DEFAULT NULL,
  p_travel_mode text DEFAULT 'manual'
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_actor public.profiles%ROWTYPE;
  v_tour public.tours%ROWTYPE;
  v_stop record;
  v_previous record;
  v_result jsonb;
  v_gig_id uuid;
  v_stop_count integer;
  v_gig_ids jsonb := '[]'::jsonb;
  v_leg_ids jsonb := '[]'::jsonb;
  v_distance_km numeric;
  v_duration_hours numeric;
  v_departure_at timestamptz;
  v_arrival_at timestamptz;
  v_next_gig_at timestamptz;
  v_leg_mode text;
  v_leg_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'tour_booking_unauthenticated' USING ERRCODE='42501'; END IF;
  SELECT * INTO v_actor FROM public.profiles WHERE user_id=auth.uid() LIMIT 1;
  IF NOT FOUND THEN RAISE EXCEPTION 'tour_booking_profile_missing' USING ERRCODE='P0001'; END IF;
  IF NOT public.can_manage_band_gigs(p_band_id, auth.uid()) THEN RAISE EXCEPTION 'tour_booking_forbidden' USING ERRCODE='42501'; END IF;
  IF p_request_id IS NULL THEN RAISE EXCEPTION 'tour_booking_request_invalid' USING ERRCODE='22023'; END IF;
  IF NULLIF(btrim(p_name),'') IS NULL OR char_length(btrim(p_name)) > 120 THEN RAISE EXCEPTION 'tour_booking_name_invalid' USING ERRCODE='22023'; END IF;
  IF p_start_date IS NULL OR p_end_date IS NULL OR p_end_date < p_start_date OR p_start_date < current_date THEN RAISE EXCEPTION 'tour_booking_dates_invalid' USING ERRCODE='22023'; END IF;
  IF p_travel_mode NOT IN ('auto','manual','tour_bus') THEN RAISE EXCEPTION 'tour_booking_travel_mode_invalid' USING ERRCODE='22023'; END IF;
  IF jsonb_typeof(p_stops) <> 'array' OR jsonb_array_length(p_stops)=0 THEN RAISE EXCEPTION 'tour_booking_stops_invalid' USING ERRCODE='22023'; END IF;

  SELECT count(*) INTO v_stop_count FROM jsonb_array_elements(p_stops) stop
  WHERE NULLIF(stop->>'venue_id','') IS NOT NULL AND NULLIF(stop->>'date','') IS NOT NULL AND NULLIF(stop->>'slot','') IS NOT NULL;
  IF v_stop_count <> jsonb_array_length(p_stops) THEN RAISE EXCEPTION 'tour_booking_stops_invalid' USING ERRCODE='22023'; END IF;
  IF EXISTS (SELECT 1 FROM jsonb_array_elements(p_stops) stop GROUP BY stop->>'venue_id',stop->>'date',stop->>'slot' HAVING count(*)>1)
    THEN RAISE EXCEPTION 'tour_booking_duplicate_stop' USING ERRCODE='23505'; END IF;

  SELECT * INTO v_tour FROM public.tours WHERE booking_request_id=p_request_id;
  IF FOUND THEN
    IF v_tour.band_id <> p_band_id OR NOT public.can_manage_band_gigs(v_tour.band_id,auth.uid()) THEN
      RAISE EXCEPTION 'tour_booking_request_conflict' USING ERRCODE='23505';
    END IF;
    RETURN jsonb_build_object(
      'tour',to_jsonb(v_tour),
      'already_booked',true,
      'gig_ids',COALESCE((SELECT jsonb_agg(id ORDER BY scheduled_date) FROM public.gigs WHERE tour_id=v_tour.id),'[]'::jsonb),
      'travel_leg_ids',COALESCE((SELECT jsonb_agg(id ORDER BY departure_date) FROM public.tour_travel_legs WHERE tour_id=v_tour.id),'[]'::jsonb)
    );
  END IF;

  CREATE TEMP TABLE IF NOT EXISTS pg_temp.tour_booking_stops (
    sequence_no integer,
    venue_id uuid,
    city_id uuid,
    stop_date date,
    slot text,
    gig_at timestamptz,
    latitude numeric,
    longitude numeric
  ) ON COMMIT DROP;
  TRUNCATE pg_temp.tour_booking_stops;

  INSERT INTO pg_temp.tour_booking_stops(sequence_no,venue_id,city_id,stop_date,slot,gig_at,latitude,longitude)
  SELECT
    row_number() OVER (ORDER BY (stop->>'date')::date,
      CASE stop->>'slot' WHEN 'early' THEN 1 WHEN 'support' THEN 2 WHEN 'headline' THEN 3 WHEN 'late' THEN 4 ELSE 5 END,
      stop->>'venue_id')::integer,
    v.id,
    v.city_id,
    (stop->>'date')::date,
    stop->>'slot',
    ((stop->>'date')::date + CASE stop->>'slot'
      WHEN 'early' THEN time '14:00'
      WHEN 'support' THEN time '17:00'
      WHEN 'headline' THEN time '20:00'
      WHEN 'late' THEN time '23:00'
      ELSE time '20:00' END) AT TIME ZONE 'UTC',
    c.latitude,
    c.longitude
  FROM jsonb_array_elements(p_stops) stop
  JOIN public.venues v ON v.id=(stop->>'venue_id')::uuid
  JOIN public.cities c ON c.id=v.city_id;

  IF (SELECT count(*) FROM pg_temp.tour_booking_stops) <> jsonb_array_length(p_stops) THEN
    RAISE EXCEPTION 'tour_booking_venue_invalid' USING ERRCODE='22023';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_temp.tour_booking_stops WHERE stop_date < p_start_date OR stop_date > p_end_date) THEN
    RAISE EXCEPTION 'tour_booking_stop_outside_dates' USING ERRCODE='22023';
  END IF;

  INSERT INTO public.tours (user_id,band_id,name,start_date,end_date,status,booking_request_id,travel_mode)
  VALUES (v_actor.id,p_band_id,btrim(p_name),p_start_date,p_end_date,'active',p_request_id,p_travel_mode)
  RETURNING * INTO v_tour;

  FOR v_stop IN SELECT * FROM pg_temp.tour_booking_stops ORDER BY sequence_no LOOP
    v_result := public.book_gig(p_band_id,v_stop.venue_id,p_setlist_id,v_stop.stop_date,v_stop.slot,
      p_ticket_price,gen_random_uuid(),p_rider_id,p_ticket_operator_id);
    v_gig_id := (v_result->'gig'->>'id')::uuid;
    IF v_gig_id IS NULL THEN RAISE EXCEPTION 'tour_booking_gig_missing' USING ERRCODE='P0001'; END IF;
    UPDATE public.gigs SET tour_id=v_tour.id WHERE id=v_gig_id;
    v_gig_ids := v_gig_ids || jsonb_build_array(v_gig_id);

    IF v_stop.sequence_no > 1 THEN
      SELECT * INTO v_previous FROM pg_temp.tour_booking_stops WHERE sequence_no=v_stop.sequence_no-1;
      IF v_previous.city_id IS DISTINCT FROM v_stop.city_id THEN
        IF v_previous.latitude IS NOT NULL AND v_previous.longitude IS NOT NULL
           AND v_stop.latitude IS NOT NULL AND v_stop.longitude IS NOT NULL THEN
          v_distance_km := 6371 * acos(least(1, greatest(-1,
            cos(radians(v_previous.latitude)) * cos(radians(v_stop.latitude)) *
            cos(radians(v_stop.longitude)-radians(v_previous.longitude)) +
            sin(radians(v_previous.latitude)) * sin(radians(v_stop.latitude))
          )));
        ELSE
          v_distance_km := 500;
        END IF;

        v_leg_mode := CASE
          WHEN p_travel_mode='tour_bus' THEN 'tour_bus'
          WHEN p_travel_mode='manual' THEN 'bus'
          WHEN v_distance_km >= 900 THEN 'plane'
          WHEN v_distance_km >= 350 THEN 'train'
          ELSE 'bus'
        END;
        v_duration_hours := greatest(1, ceil(v_distance_km / CASE v_leg_mode
          WHEN 'plane' THEN 800 WHEN 'train' THEN 180 WHEN 'tour_bus' THEN 90 ELSE 75 END
          + CASE v_leg_mode WHEN 'plane' THEN 2 WHEN 'train' THEN 1 ELSE 0.5 END));
        v_departure_at := v_previous.gig_at + interval '3 hours';
        v_arrival_at := v_departure_at + make_interval(hours => v_duration_hours::integer);
        v_next_gig_at := v_stop.gig_at;

        IF v_arrival_at > v_next_gig_at - interval '2 hours' THEN
          RAISE EXCEPTION 'tour_booking_route_impossible:% to %', v_previous.city_id, v_stop.city_id USING ERRCODE='22023';
        END IF;

        INSERT INTO public.tour_travel_legs(
          tour_id,from_city_id,to_city_id,travel_mode,travel_cost,
          departure_date,arrival_date,travel_duration_hours,status
        ) VALUES (
          v_tour.id,v_previous.city_id,v_stop.city_id,v_leg_mode,0,
          v_departure_at,v_arrival_at,v_duration_hours::integer,'scheduled'
        ) RETURNING id INTO v_leg_id;
        v_leg_ids := v_leg_ids || jsonb_build_array(v_leg_id);
      END IF;
    END IF;
  END LOOP;

  RETURN jsonb_build_object('tour',to_jsonb(v_tour),'already_booked',false,'gig_ids',v_gig_ids,'travel_leg_ids',v_leg_ids);
END;
$$;

REVOKE ALL ON FUNCTION public.book_tour(uuid,text,date,date,uuid,integer,jsonb,uuid,text,uuid,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.book_tour(uuid,text,date,date,uuid,integer,jsonb,uuid,text,uuid,text) TO authenticated, service_role;
