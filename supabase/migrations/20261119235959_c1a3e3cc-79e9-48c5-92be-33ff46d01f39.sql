CREATE FUNCTION public.counter_festival_artist_offer(p_offer_id uuid,p_expected_version integer,p_terms jsonb,p_idempotency_key uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $$
DECLARE actor uuid:=public._caller_profile_id(); offer public.festival_artist_offers%ROWTYPE; programme public.festival_artist_programmes%ROWTYPE; req public.festival_artist_plan_requests%ROWTYPE; fee bigint; minutes integer; manager boolean;
BEGIN
 IF auth.uid() IS NULL OR actor IS NULL THEN RAISE EXCEPTION 'festival_artist_action_forbidden'; END IF;
 SELECT * INTO offer FROM public.festival_artist_offers WHERE id=p_offer_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'festival_artist_offer_invalid_transition'; END IF;
 SELECT * INTO programme FROM public.festival_artist_programmes WHERE id=offer.festival_artist_programme_id;
 manager:=public._festival_artist_manager(programme.festival_company_id,actor);
 IF NOT coalesce(manager,false) AND NOT (offer.artist_type='solo' AND offer.artist_profile_id=actor) AND NOT (offer.artist_type='band' AND coalesce(public.caller_can_act_for_band(offer.band_id),false)) THEN RAISE EXCEPTION 'festival_artist_action_forbidden'; END IF;
 req:=public._festival_artist_begin(programme.festival_company_id,'counter_offer','offer',offer.id,p_idempotency_key,jsonb_build_object('version',p_expected_version,'terms',p_terms));
 IF req.status='succeeded' THEN RETURN req.result; END IF;
 IF offer.offer_version<>p_expected_version THEN RAISE EXCEPTION 'festival_artist_offer_stale'; END IF;
 IF offer.status NOT IN ('sent','countered') OR offer.response_deadline IS NULL OR offer.response_deadline<=now() THEN RAISE EXCEPTION 'festival_artist_offer_invalid_transition'; END IF;
 IF jsonb_typeof(p_terms->'feeMinor')<>'number' OR (p_terms->>'feeMinor') !~ '^\d+$' THEN RAISE EXCEPTION 'festival_artist_offer_invalid'; END IF;
 fee:=(p_terms->>'feeMinor')::bigint;
 minutes:=coalesce((p_terms->>'setMinutes')::integer,offer.set_minutes);
 IF fee<0 OR minutes<5 OR minutes>180 OR fee+offer.travel_support_minor+offer.accommodation_support_minor>programme.artist_budget_minor+programme.contingency_budget_minor THEN RAISE EXCEPTION 'festival_artist_offer_budget_exceeded'; END IF;
 UPDATE public.festival_artist_offers SET status='countered',offered_fee_minor=fee,set_minutes=minutes,offer_version=offer_version+1,updated_at=now() WHERE id=offer.id RETURNING * INTO offer;
 INSERT INTO public.festival_artist_offer_revisions(offer_id,offer_version,proposed_by_party,proposed_by_profile_id,fee_minor,set_minutes,preferred_date,preferred_stage_id,billing_position,travel_support_minor,accommodation_support_minor,merch_revenue_share_basis_points,terms_snapshot,message)
 VALUES(offer.id,offer.offer_version,CASE WHEN manager THEN 'festival' ELSE 'artist' END,actor,fee,minutes,offer.preferred_date,offer.preferred_stage_id,offer.billing_position,offer.travel_support_minor,offer.accommodation_support_minor,offer.merch_revenue_share_basis_points,p_terms,left(p_terms->>'message',1000));
 PERFORM public._festival_artist_audit(programme.festival_company_id,actor,'offer',offer.id,'offer_countered',NULL,'countered',offer.offer_version);
 RETURN public._festival_artist_finish(req.id,jsonb_build_object('kind','offer','offer',to_jsonb(offer)));
END;
$$;
REVOKE ALL ON FUNCTION public.counter_festival_artist_offer(uuid,integer,jsonb,uuid) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.counter_festival_artist_offer(uuid,integer,jsonb,uuid) TO authenticated;
NOTIFY pgrst,'reload schema';