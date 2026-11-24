-- Batch wrappers keep existing per-show lifecycle, schedule and settlement authority.
CREATE FUNCTION public.create_tour_support_offers(
 p_headliner_band_id uuid,p_tour_id uuid,p_support_band_id uuid,p_gig_ids uuid[],p_request_id uuid
) RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE
 v_id uuid; v_gig public.gigs%ROWTYPE; v_slot public.gig_support_slots%ROWTYPE; v_request uuid;
BEGIN
 IF auth.uid() IS NULL OR NOT COALESCE(public.can_manage_band_gigs(p_headliner_band_id,auth.uid()),false) THEN
   RAISE EXCEPTION 'tour_support_forbidden' USING ERRCODE='42501';
 END IF;
 IF p_tour_id IS NULL OR p_support_band_id IS NULL OR p_request_id IS NULL OR
    COALESCE(cardinality(p_gig_ids),0) NOT BETWEEN 1 AND 100 OR
    EXISTS(SELECT 1 FROM unnest(p_gig_ids) x WHERE x IS NULL) OR
    (SELECT count(DISTINCT x) FROM unnest(p_gig_ids) x)<>cardinality(p_gig_ids) THEN
   RAISE EXCEPTION 'tour_support_dates_invalid' USING ERRCODE='22023';
 END IF;
 FOR v_id IN SELECT x FROM unnest(p_gig_ids) x ORDER BY x LOOP
   SELECT * INTO v_gig FROM public.gigs WHERE id=v_id FOR UPDATE;
   IF NOT FOUND OR v_gig.tour_id IS DISTINCT FROM p_tour_id OR v_gig.band_id IS DISTINCT FROM p_headliner_band_id THEN
     RAISE EXCEPTION 'tour_support_gig_mismatch' USING ERRCODE='23514';
   END IF;
   v_request := md5(p_request_id::text||':'||v_id::text)::uuid;
   SELECT * INTO v_slot FROM public.gig_support_slots WHERE request_id=v_request;
   IF FOUND THEN
     IF v_slot.gig_id<>v_id OR v_slot.support_band_id<>p_support_band_id THEN
       RAISE EXCEPTION 'tour_support_request_mismatch' USING ERRCODE='23514';
     END IF;
     CONTINUE;
   END IF;
   IF NOT EXISTS(SELECT 1 FROM public.find_tour_support_show_candidates(p_headliner_band_id,p_tour_id) c
     WHERE c.gig_id=v_id AND c.support_band_id=p_support_band_id AND c.travel_feasible) THEN
     RAISE EXCEPTION 'tour_support_band_unavailable' USING ERRCODE='23P01';
   END IF;
   PERFORM public.create_gig_support_offer(v_id,p_support_band_id,v_request);
 END LOOP;
 RETURN cardinality(p_gig_ids);
END;
$$;

CREATE FUNCTION public.respond_to_tour_support_offers(p_offers jsonb,p_action text)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE
 v_offer jsonb; v_slot public.gig_support_slots%ROWTYPE; v_gig public.gigs%ROWTYPE;
 v_tour uuid; v_band uuid; v_headliner uuid;
BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'tour_support_forbidden' USING ERRCODE='42501'; END IF;
 IF p_action IS NULL OR p_action NOT IN ('accept','decline') OR p_offers IS NULL OR jsonb_typeof(p_offers)<>'array' THEN
   RAISE EXCEPTION 'tour_support_response_invalid' USING ERRCODE='22023';
 END IF;
 IF jsonb_array_length(p_offers) NOT BETWEEN 1 AND 100 OR
   (SELECT count(DISTINCT x->>'slot_id') FROM jsonb_array_elements(p_offers) x)<>jsonb_array_length(p_offers) THEN
   RAISE EXCEPTION 'tour_support_response_invalid' USING ERRCODE='22023';
 END IF;
 -- Validate the entire reviewed itinerary before changing any slot.
 FOR v_offer IN SELECT x FROM jsonb_array_elements(p_offers) x ORDER BY x->>'slot_id' LOOP
   SELECT * INTO v_slot FROM public.gig_support_slots WHERE id=(v_offer->>'slot_id')::uuid FOR UPDATE;
   IF NOT FOUND OR NOT COALESCE(public.can_manage_band_gigs(v_slot.support_band_id,auth.uid()),false) THEN
     RAISE EXCEPTION 'tour_support_forbidden' USING ERRCODE='42501';
   END IF;
   SELECT * INTO v_gig FROM public.gigs WHERE id=v_slot.gig_id FOR UPDATE;
   IF NOT FOUND OR v_gig.tour_id IS NULL OR v_slot.gig_id IS DISTINCT FROM (v_offer->>'gig_id')::uuid THEN
     RAISE EXCEPTION 'tour_support_gig_mismatch' USING ERRCODE='23514';
   END IF;
   IF v_tour IS NULL THEN v_tour:=v_gig.tour_id; v_band:=v_slot.support_band_id; v_headliner:=v_gig.band_id; END IF;
   IF v_tour<>v_gig.tour_id OR v_band<>v_slot.support_band_id OR v_headliner<>v_gig.band_id THEN
     RAISE EXCEPTION 'tour_support_mixed_offers' USING ERRCODE='23514';
   END IF;
   IF p_action='accept' AND (
      v_gig.tour_id IS DISTINCT FROM (v_offer->>'tour_id')::uuid OR
      v_gig.venue_id IS DISTINCT FROM (v_offer->>'venue_id')::uuid OR
      v_gig.scheduled_date IS DISTINCT FROM (v_offer->>'scheduled_date')::timestamptz OR
      v_gig.scheduled_end IS DISTINCT FROM (v_offer->>'scheduled_end')::timestamptz OR
      v_slot.revenue_share IS DISTINCT FROM (v_offer->>'revenue_share')::numeric) THEN
     RAISE EXCEPTION 'tour_support_itinerary_changed' USING ERRCODE='23514';
   END IF;
 END LOOP;
 FOR v_offer IN SELECT x FROM jsonb_array_elements(p_offers) x ORDER BY x->>'slot_id' LOOP
   PERFORM public.respond_to_gig_support_offer((v_offer->>'slot_id')::uuid,p_action,NULL);
 END LOOP;
 RETURN jsonb_array_length(p_offers);
END;
$$;
REVOKE ALL ON FUNCTION public.create_tour_support_offers(uuid,uuid,uuid,uuid[],uuid) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.respond_to_tour_support_offers(jsonb,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.create_tour_support_offers(uuid,uuid,uuid,uuid[],uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.respond_to_tour_support_offers(jsonb,text) TO authenticated;
NOTIFY pgrst,'reload schema';
