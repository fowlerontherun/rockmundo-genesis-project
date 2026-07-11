-- Phase 5 PR 04: Server-authoritative gig timeline and completion hardening

ALTER TABLE public.gigs
  ADD COLUMN IF NOT EXISTS result_ready_at timestamptz,
  ADD COLUMN IF NOT EXISTS progression_error_code text,
  ADD COLUMN IF NOT EXISTS progression_error_message text;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'gig_song_performances_outcome_position_unique'
  ) THEN
    ALTER TABLE public.gig_song_performances
      ADD CONSTRAINT gig_song_performances_outcome_position_unique UNIQUE (gig_outcome_id, position);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS gigs_server_timeline_idx
  ON public.gigs(status, scheduled_date, started_at)
  WHERE status IN ('scheduled', 'in_progress', 'ready_for_completion', 'processing_outcome');

CREATE OR REPLACE FUNCTION public.start_gig_authoritative(p_gig_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_gig public.gigs%ROWTYPE;
  v_setlist_count integer;
  v_outcome_id uuid;
BEGIN
  SELECT * INTO v_gig FROM public.gigs WHERE id = p_gig_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Gig not found' USING ERRCODE = 'P0002'; END IF;

  RAISE LOG '[gig-start] requested gig_id=% status=%', p_gig_id, v_gig.status;

  IF v_gig.status IN ('in_progress','ready_for_completion','processing_outcome','completed') THEN
    SELECT id INTO v_outcome_id FROM public.gig_outcomes WHERE gig_id = p_gig_id LIMIT 1;
    RAISE LOG '[gig-start] duplicate prevented gig_id=% status=%', p_gig_id, v_gig.status;
    RETURN jsonb_build_object('success', true, 'alreadyStarted', true, 'status', v_gig.status, 'started_at', v_gig.started_at, 'outcome_id', v_outcome_id);
  END IF;

  IF v_gig.status <> 'scheduled' THEN RAISE EXCEPTION 'Gig cannot start from status %', v_gig.status; END IF;
  IF v_gig.scheduled_date > now() THEN RAISE EXCEPTION 'Gig is not due yet'; END IF;
  IF v_gig.setlist_id IS NULL THEN RAISE EXCEPTION 'Gig has no setlist assigned'; END IF;

  SELECT count(*) INTO v_setlist_count FROM public.setlist_songs WHERE setlist_id = v_gig.setlist_id;
  IF COALESCE(v_setlist_count, 0) = 0 THEN RAISE EXCEPTION 'Gig setlist is empty'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.bands WHERE id = v_gig.band_id) THEN RAISE EXCEPTION 'Gig band is missing'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.venues WHERE id = v_gig.venue_id) THEN RAISE EXCEPTION 'Gig venue is missing'; END IF;

  UPDATE public.gigs
  SET status = 'in_progress',
      started_at = COALESCE(started_at, now()),
      current_song_position = COALESCE(current_song_position, 0),
      progression_error_code = NULL,
      progression_error_message = NULL,
      updated_at = now()
  WHERE id = p_gig_id
  RETURNING * INTO v_gig;

  SELECT id INTO v_outcome_id FROM public.gig_outcomes WHERE gig_id = p_gig_id LIMIT 1;
  RAISE LOG '[gig-start] succeeded gig_id=% outcome_id=%', p_gig_id, v_outcome_id;
  RETURN jsonb_build_object('success', true, 'alreadyStarted', false, 'status', v_gig.status, 'started_at', v_gig.started_at, 'outcome_id', v_outcome_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.advance_gig_song(p_gig_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  RAISE EXCEPTION 'advance_gig_song is retired; server timeline workers own gig advancement';
END;
$$;

CREATE OR REPLACE FUNCTION public.mark_gig_position_processed(p_gig_id uuid, p_position integer)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_gig public.gigs%ROWTYPE;
  v_total integer;
  v_next integer;
BEGIN
  SELECT * INTO v_gig FROM public.gigs WHERE id = p_gig_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Gig not found'; END IF;
  IF v_gig.status IN ('cancelled','completed','failed') THEN RAISE EXCEPTION 'Cannot process gig in status %', v_gig.status; END IF;
  SELECT count(*) INTO v_total FROM public.setlist_songs WHERE setlist_id = v_gig.setlist_id;
  v_next := GREATEST(COALESCE(v_gig.current_song_position, 0), p_position + 1);
  UPDATE public.gigs
  SET current_song_position = LEAST(v_next, COALESCE(v_total, v_next)),
      status = CASE WHEN v_next >= COALESCE(v_total, 0) THEN 'ready_for_completion' ELSE status END,
      updated_at = now()
  WHERE id = p_gig_id
  RETURNING * INTO v_gig;
  RETURN jsonb_build_object('status', v_gig.status, 'current_song_position', v_gig.current_song_position, 'total_positions', v_total);
END;
$$;

REVOKE ALL ON FUNCTION public.start_gig_authoritative(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.advance_gig_song(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.mark_gig_position_processed(uuid, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.start_gig_authoritative(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.mark_gig_position_processed(uuid, integer) TO service_role;

CREATE OR REPLACE FUNCTION public.claim_gig_completion(p_gig_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_gig public.gigs%ROWTYPE;
BEGIN
  SELECT * INTO v_gig FROM public.gigs WHERE id = p_gig_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Gig not found'; END IF;
  IF v_gig.status = 'completed' OR v_gig.result_ready_at IS NOT NULL THEN
    RETURN jsonb_build_object('claimed', false, 'alreadyCompleted', true, 'status', v_gig.status, 'result_ready_at', v_gig.result_ready_at);
  END IF;
  IF v_gig.status = 'processing_outcome' THEN
    RETURN jsonb_build_object('claimed', false, 'alreadyProcessing', true, 'status', v_gig.status);
  END IF;
  IF v_gig.status NOT IN ('in_progress', 'ready_for_completion') THEN
    RAISE EXCEPTION 'Cannot complete gig in status %', v_gig.status;
  END IF;
  UPDATE public.gigs SET status = 'processing_outcome', updated_at = now() WHERE id = p_gig_id RETURNING * INTO v_gig;
  RAISE LOG '[gig-complete] claimed gig_id=%', p_gig_id;
  RETURN jsonb_build_object('claimed', true, 'status', v_gig.status);
END;
$$;

REVOKE ALL ON FUNCTION public.claim_gig_completion(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_gig_completion(uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.auto_start_scheduled_gigs()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_gig record;
BEGIN
  FOR v_gig IN
    SELECT id FROM public.gigs
    WHERE status = 'scheduled'
      AND started_at IS NULL
      AND scheduled_date <= now()
      AND setlist_id IS NOT NULL
    ORDER BY scheduled_date ASC
  LOOP
    BEGIN
      PERFORM public.start_gig_authoritative(v_gig.id);
    EXCEPTION WHEN OTHERS THEN
      UPDATE public.gigs
      SET status = CASE WHEN status = 'scheduled' THEN 'failed' ELSE status END,
          progression_error_code = SQLSTATE,
          progression_error_message = SQLERRM,
          updated_at = now()
      WHERE id = v_gig.id;
      RAISE LOG '[gig-start] failed gig_id=% code=% message=%', v_gig.id, SQLSTATE, SQLERRM;
    END;
  END LOOP;
END;
$$;

REVOKE ALL ON FUNCTION public.auto_start_scheduled_gigs() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.auto_start_scheduled_gigs() TO service_role;
