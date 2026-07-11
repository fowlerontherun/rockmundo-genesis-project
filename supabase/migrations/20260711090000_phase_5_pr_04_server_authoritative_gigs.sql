-- Phase 5 PR 04: server-authoritative gig timeline hardening

ALTER TABLE public.gigs
  ADD COLUMN IF NOT EXISTS result_ready_at timestamptz,
  ADD COLUMN IF NOT EXISTS progression_error text;

ALTER TABLE public.gig_song_performances
  ADD COLUMN IF NOT EXISTS processing_attempted_at timestamptz DEFAULT now();

CREATE UNIQUE INDEX IF NOT EXISTS gig_outcomes_one_per_gig_uidx
  ON public.gig_outcomes(gig_id);

CREATE UNIQUE INDEX IF NOT EXISTS gig_song_performances_one_per_position_uidx
  ON public.gig_song_performances(gig_outcome_id, position);

CREATE OR REPLACE FUNCTION public.start_gig_authoritative(p_gig_id uuid)
RETURNS TABLE(gig_id uuid, status text, started_at timestamptz, current_song_position integer, already_started boolean)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_gig public.gigs%ROWTYPE;
  v_song_count integer;
  v_attendance integer;
  v_capacity integer;
  v_ticket_price integer;
BEGIN
  SELECT * INTO v_gig FROM public.gigs WHERE id = p_gig_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'gig_not_found'; END IF;

  IF v_gig.status IN ('in_progress','ready_for_completion','processing_outcome','completed') THEN
    RETURN QUERY SELECT v_gig.id, v_gig.status::text, v_gig.started_at, COALESCE(v_gig.current_song_position,0), true;
    RETURN;
  END IF;
  IF v_gig.status IN ('cancelled','failed') THEN RAISE EXCEPTION 'gig_not_startable:%', v_gig.status; END IF;
  IF v_gig.status NOT IN ('scheduled','ready') THEN RAISE EXCEPTION 'invalid_start_state:%', v_gig.status; END IF;
  IF v_gig.scheduled_date > now() THEN RAISE EXCEPTION 'gig_not_due'; END IF;
  IF v_gig.setlist_id IS NULL THEN RAISE EXCEPTION 'missing_setlist'; END IF;

  SELECT count(*) INTO v_song_count FROM public.setlist_songs WHERE setlist_id = v_gig.setlist_id;
  IF COALESCE(v_song_count,0) = 0 THEN RAISE EXCEPTION 'empty_setlist'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.bands WHERE id = v_gig.band_id) THEN RAISE EXCEPTION 'missing_band'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.venues WHERE id = v_gig.venue_id) THEN RAISE EXCEPTION 'missing_venue'; END IF;

  UPDATE public.gigs
  SET status = 'in_progress',
      started_at = COALESCE(started_at, now()),
      current_song_position = COALESCE(current_song_position, 0),
      progression_error = NULL
  WHERE id = p_gig_id
  RETURNING * INTO v_gig;

  SELECT COALESCE(v.capacity, 100), COALESCE(v_gig.ticket_price, 20) INTO v_capacity, v_ticket_price
  FROM public.venues v WHERE v.id = v_gig.venue_id;
  v_attendance := GREATEST(1, floor(v_capacity * (0.4 + random() * 0.4))::integer);

  INSERT INTO public.gig_outcomes(gig_id, actual_attendance, attendance_percentage, ticket_revenue, total_revenue, overall_rating, performance_grade)
  VALUES (v_gig.id, v_attendance, (v_attendance::numeric / NULLIF(v_capacity,0)) * 100, v_attendance * v_ticket_price, v_attendance * v_ticket_price, 0, 'Pending')
  ON CONFLICT (gig_id) DO NOTHING;

  RAISE NOTICE 'gig_start_succeeded gig_id=% status=%', v_gig.id, v_gig.status;
  RETURN QUERY SELECT v_gig.id, v_gig.status::text, v_gig.started_at, COALESCE(v_gig.current_song_position,0), false;
END;
$$;

CREATE OR REPLACE FUNCTION public.advance_gig_song(p_gig_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  RAISE EXCEPTION 'client_song_advancement_disabled';
END;
$$;

CREATE OR REPLACE FUNCTION public.mark_gig_result_ready(p_gig_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  UPDATE public.gigs
  SET status = 'completed',
      completed_at = COALESCE(completed_at, now()),
      result_ready_at = COALESCE(result_ready_at, now())
  WHERE id = p_gig_id AND status <> 'cancelled';
END;
$$;

CREATE OR REPLACE FUNCTION public.auto_start_scheduled_gigs()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE v record;
BEGIN
  FOR v IN SELECT id FROM public.gigs WHERE status IN ('scheduled','ready') AND scheduled_date <= now() LOOP
    BEGIN
      PERFORM * FROM public.start_gig_authoritative(v.id);
    EXCEPTION WHEN OTHERS THEN
      UPDATE public.gigs SET status = 'failed', progression_error = SQLERRM WHERE id = v.id;
      RAISE NOTICE 'gig_start_failed gig_id=% error=%', v.id, SQLERRM;
    END;
  END LOOP;
END;
$$;

REVOKE ALL ON FUNCTION public.start_gig_authoritative(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.start_gig_authoritative(uuid) TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.advance_gig_song(uuid) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.advance_gig_song(uuid) TO service_role;
REVOKE ALL ON FUNCTION public.mark_gig_result_ready(uuid) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.mark_gig_result_ready(uuid) TO service_role;
