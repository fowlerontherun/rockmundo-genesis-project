-- #2158: transactional, idempotent core advanced post-gig consequence settlement.
-- Core gig fan/fame/XP payouts remain owned by complete-gig; this processor never
-- rerolls or reapplies those rewards. Media and contextual extensions follow.
CREATE OR REPLACE FUNCTION public.process_gig_post_consequences(p_gig_id uuid)
RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_gig record;
  v_outcome record;
  v_processing public.gig_post_processing%ROWTYPE;
  v_rep public.band_live_reputation%ROWTYPE;
  v_rating numeric;
  v_attendance numeric;
  v_target numeric;
  v_weight numeric;
  v_delta numeric;
  v_new numeric;
  v_demand numeric;
  v_fans numeric;
  v_followers numeric;
  v_existing integer;
BEGIN
  -- Serialize all processing for this gig and protect against duplicate workers.
  PERFORM pg_advisory_xact_lock(hashtextextended(p_gig_id::text, 2158));
  SELECT g.id, g.band_id, g.status, g.result_ready_at, v.capacity
  INTO v_gig FROM public.gigs g
  LEFT JOIN public.venues v ON v.id = g.venue_id
  WHERE g.id = p_gig_id;
  IF NOT FOUND OR v_gig.status <> 'completed' OR v_gig.result_ready_at IS NULL THEN
    RETURN 'not_ready';
  END IF;
  SELECT o.overall_rating, o.actual_attendance, o.new_followers,
         o.casual_fans_gained, o.dedicated_fans_gained, o.superfans_gained
  INTO v_outcome FROM public.gig_outcomes o
  WHERE o.gig_id = p_gig_id AND o.completed_at IS NOT NULL
  ORDER BY o.completed_at DESC, o.id DESC LIMIT 1;
  IF NOT FOUND OR v_outcome.overall_rating IS NULL THEN RETURN 'missing_outcome'; END IF;

  INSERT INTO public.gig_post_processing (gig_id, status, started_at)
  VALUES (p_gig_id, 'processing', now())
  ON CONFLICT (gig_id) DO NOTHING;
  SELECT * INTO v_processing FROM public.gig_post_processing
  WHERE gig_id = p_gig_id FOR UPDATE;
  SELECT count(*) INTO v_existing FROM public.gig_consequence_snapshots
  WHERE gig_id = p_gig_id;
  IF v_processing.status = 'completed' AND v_existing >= 4 THEN RETURN 'already_completed'; END IF;
  -- Existing snapshots may represent a partial earlier attempt. Do not add
  -- reputation again or overwrite potentially applied rewards.
  IF v_existing > 0 OR (v_processing.status = 'completed' AND v_existing < 4) THEN
    UPDATE public.gig_post_processing SET status = 'retry_required',
      error_snapshot = jsonb_build_object('reason', 'existing_partial_or_inconsistent_snapshots', 'snapshot_count', v_existing),
      updated_at = now() WHERE id = v_processing.id;
    RETURN 'manual_review_required';
  END IF;

  INSERT INTO public.band_live_reputation (band_id)
  VALUES (v_gig.band_id) ON CONFLICT (band_id) DO NOTHING;
  SELECT * INTO v_rep FROM public.band_live_reputation
  WHERE band_id = v_gig.band_id FOR UPDATE;
  v_rating := greatest(0, least(100, v_outcome.overall_rating * 4));
  v_attendance := CASE WHEN coalesce(v_gig.capacity,0) > 0
    THEN greatest(0,least(1,v_outcome.actual_attendance::numeric/v_gig.capacity)) ELSE 0 END;
  v_target := greatest(0, least(100, v_rating * 0.8 + v_attendance * 20));
  v_weight := greatest(0.035, 0.24 / (1 + v_rep.experience_count::numeric / 8));
  v_delta := round(greatest(-8,least(8,(v_target - v_rep.overall_score) * v_weight)),2);
  v_new := greatest(0,least(100,v_rep.overall_score + v_delta));
  v_fans := coalesce(v_outcome.casual_fans_gained,0)
          + coalesce(v_outcome.dedicated_fans_gained,0)
          + coalesce(v_outcome.superfans_gained,0);
  v_followers := coalesce(v_outcome.new_followers,0);
  v_demand := round(greatest(-12,least(12,v_delta * 0.7 + (v_attendance - 0.65) * 8)),2);

  UPDATE public.band_live_reputation SET
    overall_score = v_new,
    performance_score = greatest(0,least(100,performance_score + round(greatest(-8,least(8,(v_rating-performance_score)*v_weight)),2))),
    crowd_connection_score = greatest(0,least(100,crowd_connection_score + round(greatest(-8,least(8,(v_attendance*100-crowd_connection_score)*v_weight)),2))),
    booking_demand_score = greatest(0,least(100,booking_demand_score + v_demand)),
    experience_count = experience_count + 1,
    last_gig_id = p_gig_id,
    breakdown = jsonb_build_object('last_processing_version','post-gig-consequences-v1-db','last_gig_id',p_gig_id,'expectation_score',v_target),
    updated_at = now()
  WHERE id = v_rep.id;

  INSERT INTO public.gig_consequence_snapshots
    (gig_id, processing_id, category, target_type, target_id, consequence_key,
     previous_value, delta_value, new_value, status, explanation, source_factors, metadata)
  VALUES
    (p_gig_id,v_processing.id,'live_reputation','band',v_gig.band_id,'live_reputation.overall',
     v_rep.overall_score,v_delta,v_new,CASE WHEN v_delta>0 THEN 'positive' WHEN v_delta<0 THEN 'negative' ELSE 'neutral' END,
     'Live reputation updated once from the settled gig rating and venue attendance.',ARRAY['overall_rating','actual_attendance','venue_capacity','previous_live_reputation'],
     jsonb_build_object('processor','post-gig-consequences-v1-db','expectation_score',v_target)),
    (p_gig_id,v_processing.id,'fans','band',v_gig.band_id,'fans.local_delta',
     NULL,v_fans,NULL,CASE WHEN v_fans>0 THEN 'positive' WHEN v_fans<0 THEN 'negative' ELSE 'neutral' END,
     'Records fans awarded by the existing core gig settlement; no additional fans awarded.',ARRAY['gig_outcomes'],jsonb_build_object('already_settled',true)),
    (p_gig_id,v_processing.id,'fans','band',v_gig.band_id,'followers.delta',
     NULL,v_followers,NULL,CASE WHEN v_followers>0 THEN 'positive' WHEN v_followers<0 THEN 'negative' ELSE 'neutral' END,
     'Records followers from the settled gig outcome; no additional followers awarded.',ARRAY['gig_outcomes'],jsonb_build_object('already_settled',true)),
    (p_gig_id,v_processing.id,'booking','band',v_gig.band_id,'booking_demand.recent',
     v_rep.booking_demand_score,v_demand,greatest(0,least(100,v_rep.booking_demand_score+v_demand)),
     CASE WHEN v_demand>0 THEN 'positive' WHEN v_demand<0 THEN 'negative' ELSE 'neutral' END,
     'Booking demand updated from the settled gig and reputation movement.',ARRAY['overall_rating','actual_attendance','venue_capacity'], '{}'::jsonb);

  UPDATE public.gig_post_processing SET status = 'completed',
    processing_version = 'post-gig-consequences-v1-db', completed_at = now(),
    error_snapshot = NULL,
    audit_history = coalesce(audit_history,'[]'::jsonb) || jsonb_build_array(
      jsonb_build_object('event','core_consequences_settled','at',now(),'snapshots',4)),
    updated_at = now() WHERE id = v_processing.id;
  RETURN 'completed';
END;
$$;
REVOKE ALL ON FUNCTION public.process_gig_post_consequences(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.process_gig_post_consequences(uuid) TO service_role;
