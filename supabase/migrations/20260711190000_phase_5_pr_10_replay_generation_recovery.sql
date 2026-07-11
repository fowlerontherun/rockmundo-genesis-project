-- Phase 5 PR 10: allow service-role replay generation to recover failed or stale generating rows.
CREATE OR REPLACE FUNCTION public.claim_gig_viewer_replay_generation(p_gig_id uuid, p_gig_outcome_id uuid, p_viewer_version integer)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_existing public.gig_viewer_replays%ROWTYPE;
  v_replay_id uuid;
BEGIN
  PERFORM 1 FROM public.gigs g
  WHERE g.id = p_gig_id AND g.status = 'completed' AND g.result_ready_at IS NOT NULL
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Gig is not completed or result_ready_at is missing' USING ERRCODE = 'P0001';
  END IF;

  SELECT * INTO v_existing
  FROM public.gig_viewer_replays
  WHERE gig_id = p_gig_id AND viewer_version = p_viewer_version AND generation_status = 'ready'
  ORDER BY generated_at DESC
  LIMIT 1;
  IF FOUND THEN
    RETURN jsonb_build_object('claimed', false, 'alreadyReady', true, 'alreadyGenerating', false, 'replayId', v_existing.id);
  END IF;

  SELECT * INTO v_existing
  FROM public.gig_viewer_replays
  WHERE gig_id = p_gig_id AND viewer_version = p_viewer_version AND generation_status = 'generating'
  ORDER BY generated_at DESC
  LIMIT 1;
  IF FOUND THEN
    IF v_existing.updated_at >= now() - interval '15 minutes' THEN
      RETURN jsonb_build_object('claimed', false, 'alreadyReady', false, 'alreadyGenerating', true, 'replayId', v_existing.id);
    END IF;
    UPDATE public.gig_viewer_replays
    SET generation_status = 'failed', generation_error_code = 'generation_timeout'
    WHERE id = v_existing.id;
  END IF;

  SELECT * INTO v_existing
  FROM public.gig_viewer_replays
  WHERE gig_id = p_gig_id AND viewer_version = p_viewer_version AND generation_status = 'failed'
  ORDER BY updated_at DESC
  LIMIT 1;
  IF FOUND THEN
    UPDATE public.gig_viewer_replays
    SET gig_outcome_id = p_gig_outcome_id, generation_status = 'generating', generation_error_code = NULL,
        event_payload = jsonb_build_object('events', jsonb_build_array()), event_count = 0,
        duration_ms = 1, simulation_seed = 'pending', checksum = NULL, generated_at = now()
    WHERE id = v_existing.id
    RETURNING id INTO v_replay_id;
  ELSE
    INSERT INTO public.gig_viewer_replays (gig_id, gig_outcome_id, viewer_version, event_schema_version, simulation_seed, duration_ms, event_payload, event_count, generation_status)
    VALUES (p_gig_id, p_gig_outcome_id, p_viewer_version, 1, 'pending', 1, jsonb_build_object('events', jsonb_build_array()), 0, 'generating')
    RETURNING id INTO v_replay_id;
  END IF;

  RAISE LOG '[gig-viewer-replay] generation claimed gig_id=% outcome_id=% viewer_version=% replay_id=%', p_gig_id, p_gig_outcome_id, p_viewer_version, v_replay_id;
  RETURN jsonb_build_object('claimed', true, 'replayId', v_replay_id);
END;
$$;

REVOKE ALL ON FUNCTION public.claim_gig_viewer_replay_generation(uuid, uuid, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_gig_viewer_replay_generation(uuid, uuid, integer) TO service_role;
