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
  IF NOT FOUND THEN RETURN 'not_found'; END IF;
  IF v_gig.status <> 'completed' OR v_gig.result_ready_at IS NULL THEN
    RETURN 'not_ready';
  END IF;
  SELECT o.overall_rating, o.actual_attendance, o.new_followers,
         o.casual_fans_gained, o.dedicated_fans_gained, o.superfans_gained
  INTO v_outcome FROM public.gig_outcomes o
  WHERE o.gig_id = p_gig_id AND o.completed_at IS NOT NULL
  ORDER BY o.completed_at DESC, o.id DESC LIMIT 1;
  IF NOT FOUND THEN RETURN 'missing_outcome'; END IF;
  IF v_outcome.overall_rating IS NULL THEN RETURN 'missing_outcome'; END IF;

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
  -- A historical partial application may have updated reputation before
  -- failing to write snapshots. Never award a second experience increment.
  IF v_rep.last_gig_id = p_gig_id THEN
    UPDATE public.gig_post_processing SET status = 'retry_required',
      error_snapshot = jsonb_build_object('reason','reputation_already_applied_without_snapshots'),
      updated_at = now() WHERE id = v_processing.id;
    RETURN 'manual_review_required';
  END IF;
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

  -- Structured coverage is generated from the immutable outcome, not a random reroll.
  -- An ineligible gig still has its four core consequence snapshots.
  IF coalesce(v_outcome.actual_attendance,0) >= 80 THEN
    INSERT INTO public.gig_media_reviews
      (gig_id, reviewer_type, review_tier, headline, rating, summary,
       positive_points, negative_points, visibility)
    VALUES
      (p_gig_id, 'system_template',
       CASE WHEN coalesce(v_gig.capacity,0) >= 2500 AND v_target >= 70 THEN 'national_press'
            WHEN coalesce(v_gig.capacity,0) >= 600 AND v_target >= 60 THEN 'local_press'
            ELSE 'local_blog' END,
       CASE WHEN v_target >= 75 THEN 'A memorable live performance'
            WHEN v_target < 40 THEN 'A challenging night on stage'
            ELSE 'The crowd responds to a completed show' END,
       greatest(1,least(5,round(v_target/20))),
       'Automated coverage based on the completed gig rating and attendance.',
       jsonb_build_array('Gig outcome and attendance verified'),
       CASE WHEN v_attendance < 0.45 THEN jsonb_build_array('Attendance limited reach') ELSE '[]'::jsonb END,
       'public')
    ON CONFLICT (gig_id, review_tier) DO NOTHING;
    INSERT INTO public.gig_consequence_snapshots
      (gig_id,processing_id,category,target_type,target_id,consequence_key,
       delta_value,status,explanation,source_factors,metadata)
    VALUES (p_gig_id,v_processing.id,'media','gig',p_gig_id,'media.review',
      greatest(1,least(5,round(v_target/20))),
      CASE WHEN v_target >= 70 THEN 'positive' WHEN v_target < 40 THEN 'negative' ELSE 'neutral' END,
      'Structured automated coverage generated from the immutable gig outcome.',
      ARRAY['overall_rating','actual_attendance','venue_capacity'],
      jsonb_build_object('automated',true))
    ON CONFLICT DO NOTHING;
  END IF;

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

-- Run explicitly from an authorized maintenance job in small batches.
-- Chronological ordering limits historical reputation distortion. Each gig
-- remains independently idempotent; a partial legacy snapshot needs review.
CREATE OR REPLACE FUNCTION public.backfill_gig_post_consequences(p_limit integer DEFAULT 25)
RETURNS TABLE(gig_id uuid, result text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_gig_id uuid;
BEGIN
  IF p_limit < 1 OR p_limit > 100 THEN
    RAISE EXCEPTION 'backfill limit must be between 1 and 100';
  END IF;
  FOR v_gig_id IN
    SELECT p.gig_id FROM public.gig_post_processing p
    JOIN public.gigs g ON g.id=p.gig_id
    WHERE p.status IN ('processing','pending','retry_required','partially_failed')
      AND g.status='completed' AND g.result_ready_at IS NOT NULL
      AND NOT EXISTS (SELECT 1 FROM public.gig_consequence_snapshots s WHERE s.gig_id=p.gig_id)
    ORDER BY g.result_ready_at,p.gig_id
    LIMIT p_limit
  LOOP
    gig_id := v_gig_id;
    result := public.process_gig_post_consequences(v_gig_id);
    RETURN NEXT;
  END LOOP;
END;
$$;
REVOKE ALL ON FUNCTION public.backfill_gig_post_consequences(integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.backfill_gig_post_consequences(integer) TO service_role;
