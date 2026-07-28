-- Book an entire tour transactionally through the authoritative gig booking function.
-- Any invalid/conflicting stop rolls back the tour, gigs, schedule blocks and fees.
ALTER TABLE public.tours
  ADD COLUMN IF NOT EXISTS booking_request_id uuid,
  ADD COLUMN IF NOT EXISTS travel_mode text;

CREATE UNIQUE INDEX IF NOT EXISTS tours_booking_request_uidx
  ON public.tours (booking_request_id)
  WHERE booking_request_id IS NOT NULL;

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
  v_stop jsonb;
  v_result jsonb;
  v_gig_id uuid;
  v_stop_date date;
  v_stop_count integer;
  v_gig_ids jsonb := '[]'::jsonb;
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
    RETURN jsonb_build_object('tour',to_jsonb(v_tour),'already_booked',true,
      'gig_ids',COALESCE((SELECT jsonb_agg(id) FROM public.gigs WHERE tour_id=v_tour.id),'[]'::jsonb));
  END IF;

  INSERT INTO public.tours (user_id,band_id,name,start_date,end_date,status,booking_request_id,travel_mode)
  VALUES (v_actor.id,p_band_id,btrim(p_name),p_start_date,p_end_date,'active',p_request_id,p_travel_mode)
  RETURNING * INTO v_tour;

  FOR v_stop IN SELECT value FROM jsonb_array_elements(p_stops) LOOP
    BEGIN v_stop_date := (v_stop->>'date')::date;
    EXCEPTION WHEN others THEN RAISE EXCEPTION 'tour_booking_stop_date_invalid' USING ERRCODE='22023'; END;
    IF v_stop_date < p_start_date OR v_stop_date > p_end_date THEN RAISE EXCEPTION 'tour_booking_stop_outside_dates' USING ERRCODE='22023'; END IF;

    v_result := public.book_gig(p_band_id,(v_stop->>'venue_id')::uuid,p_setlist_id,v_stop_date,v_stop->>'slot',
      p_ticket_price,gen_random_uuid(),p_rider_id,p_ticket_operator_id);
    v_gig_id := (v_result->'gig'->>'id')::uuid;
    IF v_gig_id IS NULL THEN RAISE EXCEPTION 'tour_booking_gig_missing' USING ERRCODE='P0001'; END IF;
    UPDATE public.gigs SET tour_id=v_tour.id WHERE id=v_gig_id;
    v_gig_ids := v_gig_ids || jsonb_build_array(v_gig_id);
  END LOOP;

  RETURN jsonb_build_object('tour',to_jsonb(v_tour),'already_booked',false,'gig_ids',v_gig_ids);
END;
$$;

REVOKE ALL ON FUNCTION public.book_tour(uuid,text,date,date,uuid,integer,jsonb,uuid,text,uuid,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.book_tour(uuid,text,date,date,uuid,integer,jsonb,uuid,text,uuid,text) TO authenticated, service_role;
