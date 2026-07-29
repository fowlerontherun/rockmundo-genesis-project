-- Reschedule an entire future tour as one atomic operation.
-- Gigs, tour venues, travel legs and linked player schedules move together.

ALTER TABLE public.tours
  ADD COLUMN IF NOT EXISTS last_reschedule_request_id uuid;

CREATE UNIQUE INDEX IF NOT EXISTS tours_last_reschedule_request_uidx
  ON public.tours(last_reschedule_request_id)
  WHERE last_reschedule_request_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.reschedule_tour(
  p_tour_id uuid,
  p_new_start_date date,
  p_request_id uuid
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_tour public.tours%ROWTYPE;
  v_shift interval;
  v_new_end_date date;
  v_gig_count integer;
  v_leg_count integer;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'tour_reschedule_unauthenticated' USING ERRCODE='42501';
  END IF;
  IF p_request_id IS NULL OR p_new_start_date IS NULL THEN
    RAISE EXCEPTION 'tour_reschedule_request_invalid' USING ERRCODE='22023';
  END IF;

  SELECT * INTO v_tour
  FROM public.tours
  WHERE id = p_tour_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'tour_reschedule_not_found' USING ERRCODE='P0001';
  END IF;
  IF NOT public.can_manage_band_gigs(v_tour.band_id, auth.uid()) THEN
    RAISE EXCEPTION 'tour_reschedule_forbidden' USING ERRCODE='42501';
  END IF;
  IF v_tour.last_reschedule_request_id = p_request_id THEN
    RETURN jsonb_build_object(
      'tour', to_jsonb(v_tour),
      'already_rescheduled', true,
      'shift_days', 0
    );
  END IF;
  IF v_tour.last_reschedule_request_id IS NOT NULL
     AND EXISTS (SELECT 1 FROM public.tours WHERE last_reschedule_request_id = p_request_id AND id <> p_tour_id) THEN
    RAISE EXCEPTION 'tour_reschedule_request_conflict' USING ERRCODE='23505';
  END IF;
  IF COALESCE(v_tour.cancelled, false) OR v_tour.status IN ('cancelled','completed') THEN
    RAISE EXCEPTION 'tour_reschedule_state_invalid' USING ERRCODE='22023';
  END IF;
  IF p_new_start_date < current_date THEN
    RAISE EXCEPTION 'tour_reschedule_past_date' USING ERRCODE='22023';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.gigs
    WHERE tour_id = p_tour_id
      AND status NOT IN ('scheduled','cancelled')
  ) THEN
    RAISE EXCEPTION 'tour_reschedule_started' USING ERRCODE='22023';
  END IF;

  v_shift := (p_new_start_date - v_tour.start_date) * interval '1 day';
  v_new_end_date := v_tour.end_date + (p_new_start_date - v_tour.start_date);

  IF v_shift = interval '0 days' THEN
    UPDATE public.tours
    SET last_reschedule_request_id = p_request_id,
        rescheduled_at = now(),
        reschedule_count = COALESCE(reschedule_count, 0) + 1,
        original_start_date = COALESCE(original_start_date, start_date),
        original_end_date = COALESCE(original_end_date, end_date)
    WHERE id = p_tour_id
    RETURNING * INTO v_tour;

    RETURN jsonb_build_object('tour',to_jsonb(v_tour),'already_rescheduled',false,'shift_days',0);
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended('tour-reschedule:' || p_tour_id::text, 0));
  PERFORM pg_advisory_xact_lock(hashtextextended('gig-band:' || v_tour.band_id::text, 0));

  -- Reject band or venue clashes before changing any row.
  IF EXISTS (
    SELECT 1
    FROM public.gigs moved
    JOIN public.gigs other
      ON other.id <> moved.id
     AND other.tour_id IS DISTINCT FROM p_tour_id
     AND other.status IN ('scheduled','in_progress','ready_for_completion')
     AND other.band_id = moved.band_id
     AND (moved.scheduled_date + v_shift) < COALESCE(other.scheduled_end, other.scheduled_date + interval '3 hours')
     AND (COALESCE(moved.scheduled_end, moved.scheduled_date + interval '3 hours') + v_shift) > other.scheduled_date
    WHERE moved.tour_id = p_tour_id AND moved.status = 'scheduled'
  ) THEN
    RAISE EXCEPTION 'tour_reschedule_band_conflict' USING ERRCODE='23P01';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.gigs moved
    JOIN public.gigs other
      ON other.id <> moved.id
     AND other.tour_id IS DISTINCT FROM p_tour_id
     AND other.status IN ('scheduled','in_progress','ready_for_completion')
     AND other.venue_id = moved.venue_id
     AND (moved.scheduled_date + v_shift) < COALESCE(other.scheduled_end, other.scheduled_date + interval '3 hours')
     AND (COALESCE(moved.scheduled_end, moved.scheduled_date + interval '3 hours') + v_shift) > other.scheduled_date
    WHERE moved.tour_id = p_tour_id AND moved.status = 'scheduled'
  ) THEN
    RAISE EXCEPTION 'tour_reschedule_venue_conflict' USING ERRCODE='23P01';
  END IF;

  UPDATE public.gigs
  SET scheduled_date = scheduled_date + v_shift,
      scheduled_end = CASE WHEN scheduled_end IS NULL THEN NULL ELSE scheduled_end + v_shift END
  WHERE tour_id = p_tour_id AND status = 'scheduled';
  GET DIAGNOSTICS v_gig_count = ROW_COUNT;

  UPDATE public.tour_venues
  SET date = date + (p_new_start_date - v_tour.start_date)
  WHERE tour_id = p_tour_id AND status NOT IN ('completed','cancelled');

  UPDATE public.player_scheduled_activities psa
  SET scheduled_start = psa.scheduled_start + v_shift,
      scheduled_end = psa.scheduled_end + v_shift
  WHERE psa.linked_gig_id IN (
    SELECT id FROM public.gigs WHERE tour_id = p_tour_id
  ) AND psa.status = 'scheduled';

  UPDATE public.tour_travel_legs
  SET departure_date = departure_date + v_shift,
      arrival_date = arrival_date + v_shift
  WHERE tour_id = p_tour_id AND status = 'scheduled';
  GET DIAGNOSTICS v_leg_count = ROW_COUNT;

  UPDATE public.player_travel_history pth
  SET departure_time = departure_time + v_shift,
      scheduled_departure_time = CASE WHEN scheduled_departure_time IS NULL THEN NULL ELSE scheduled_departure_time + v_shift END,
      arrival_time = arrival_time + v_shift
  WHERE pth.tour_leg_id IN (
    SELECT id FROM public.tour_travel_legs WHERE tour_id = p_tour_id
  ) AND pth.status = 'scheduled';

  UPDATE public.player_scheduled_activities psa
  SET scheduled_start = psa.scheduled_start + v_shift,
      scheduled_end = psa.scheduled_end + v_shift
  WHERE psa.status = 'scheduled'
    AND (
      psa.metadata->>'tour_id' = p_tour_id::text
      OR psa.metadata->>'tourId' = p_tour_id::text
      OR psa.metadata->>'tour_leg_id' IN (
        SELECT id::text FROM public.tour_travel_legs WHERE tour_id = p_tour_id
      )
    )
    AND psa.linked_gig_id IS NULL;

  UPDATE public.tours
  SET start_date = p_new_start_date,
      end_date = v_new_end_date,
      original_start_date = COALESCE(original_start_date, v_tour.start_date),
      original_end_date = COALESCE(original_end_date, v_tour.end_date),
      rescheduled_at = now(),
      reschedule_count = COALESCE(reschedule_count, 0) + 1,
      last_reschedule_request_id = p_request_id
  WHERE id = p_tour_id
  RETURNING * INTO v_tour;

  RETURN jsonb_build_object(
    'tour', to_jsonb(v_tour),
    'already_rescheduled', false,
    'shift_days', (p_new_start_date - COALESCE(v_tour.original_start_date, p_new_start_date)),
    'gigs_moved', v_gig_count,
    'travel_legs_moved', v_leg_count
  );
END;
$$;

REVOKE ALL ON FUNCTION public.reschedule_tour(uuid,date,uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.reschedule_tour(uuid,date,uuid) TO authenticated, service_role;
