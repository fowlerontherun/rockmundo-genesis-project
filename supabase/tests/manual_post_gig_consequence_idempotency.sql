-- Manual post-deployment smoke test for #2158. Run in a single SQL session.
-- All writes are rolled back, including reputation and media review changes.
-- Do not run before all four ordered migrations are applied.
BEGIN;
DO $test$
DECLARE
  v_gig uuid;
  v_first text;
  v_second text;
  v_count integer;
  v_exp_before integer;
  v_exp_after integer;
  v_band uuid;
BEGIN
  SELECT g.id,g.band_id INTO v_gig,v_band
  FROM public.gigs g JOIN public.gig_outcomes o ON o.gig_id=g.id
  JOIN public.gig_post_processing p ON p.gig_id=g.id
  WHERE g.status='completed' AND g.result_ready_at IS NOT NULL
    AND o.completed_at IS NOT NULL AND o.overall_rating IS NOT NULL
    AND p.status IN ('processing','pending','retry_required')
    AND NOT EXISTS (SELECT 1 FROM public.gig_consequence_snapshots s WHERE s.gig_id=g.id)
  ORDER BY g.result_ready_at,g.id LIMIT 1;
  IF v_gig IS NULL THEN RAISE EXCEPTION 'No eligible test gig'; END IF;
  SELECT experience_count INTO v_exp_before FROM public.band_live_reputation WHERE band_id=v_band;
  v_first := public.process_gig_post_consequences(v_gig);
  IF v_first <> 'completed' THEN RAISE EXCEPTION 'First processing: %',v_first; END IF;
  v_second := public.process_gig_post_consequences(v_gig);
  IF v_second <> 'already_completed' THEN RAISE EXCEPTION 'Repeated processing: %',v_second; END IF;
  SELECT count(*) INTO v_count FROM public.gig_consequence_snapshots WHERE gig_id=v_gig;
  IF v_count NOT IN (4,5) THEN RAISE EXCEPTION 'Expected 4 or 5 snapshots, got %',v_count; END IF;
  SELECT experience_count INTO v_exp_after FROM public.band_live_reputation WHERE band_id=v_band;
  IF v_exp_after <> coalesce(v_exp_before,0)+1 THEN
    RAISE EXCEPTION 'Experience increment not exactly once: % -> %',v_exp_before,v_exp_after;
  END IF;
  RAISE NOTICE 'PASS: gig %, first %, second %, snapshots %, experience % -> %',
    v_gig,v_first,v_second,v_count,coalesce(v_exp_before,0),v_exp_after;
END;
$test$;
ROLLBACK;
