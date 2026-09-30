-- Allow an active tour to be ended early without rewriting completed/in-flight history.
-- Only future scheduled work is cancelled. The operation remains atomic and idempotent.

CREATE OR REPLACE FUNCTION public.cancel_tour(
  p_tour_id uuid
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_tour public.tours%ROWTYPE;
  v_refund numeric := 0;
  v_same_day boolean := false;
  v_gig_count integer := 0;
  v_leg_count integer := 0;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'tour_cancel_unauthenticated' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_tour
  FROM public.tours
  WHERE id = p_tour_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'tour_cancel_not_found' USING ERRCODE = 'P0002';
  END IF;

  IF NOT public.can_manage_band_gigs(v_tour.band_id, auth.uid())
     AND NOT public.is_caller_identity(v_tour.user_id) THEN
    RAISE EXCEPTION 'tour_cancel_forbidden' USING ERRCODE = '42501';
  END IF;

  IF v_tour.status = 'cancelled' THEN
    RETURN jsonb_build_object(
      'tour_id', v_tour.id,
      'already_cancelled', true,
      'refund_amount', 0,
      'gigs_cancelled', 0,
      'travel_legs_cancelled', 0
    );
  END IF;

  v_same_day := (v_tour.created_at AT TIME ZONE 'UTC')::date =
                (now() AT TIME ZONE 'UTC')::date;
  v_refund := CASE WHEN v_same_day THEN COALESCE(v_tour.total_upfront_cost, 0) ELSE 0 END;

  -- Cancel only gigs which have not begun. Completed and in-progress gigs are
  -- historical/live records and must not be forced through an invalid status transition.
  UPDATE public.gigs
  SET status = 'cancelled'
  WHERE tour_id = v_tour.id
    AND status = 'scheduled';
  GET DIAGNOSTICS v_gig_count = ROW_COUNT;

  -- Keep the tour itinerary consistent with the gigs we just cancelled.
  UPDATE public.tour_venues
  SET status = 'cancelled'
  WHERE tour_id = v_tour.id
    AND status NOT IN ('completed', 'cancelled');

  -- Remove future player calendar work for cancelled gigs before ending travel.
  UPDATE public.player_scheduled_activities psa
  SET status = 'cancelled'
  WHERE psa.status = 'scheduled'
    AND (
      psa.linked_gig_id IN (
        SELECT g.id
        FROM public.gigs g
        WHERE g.tour_id = v_tour.id
          AND g.status = 'cancelled'
      )
      OR psa.metadata->>'tour_id' = v_tour.id::text
      OR psa.metadata->>'tourId' = v_tour.id::text
      OR psa.metadata->>'tour_leg_id' IN (
        SELECT ttl.id::text
        FROM public.tour_travel_legs ttl
        WHERE ttl.tour_id = v_tour.id
          AND ttl.status = 'scheduled'
      )
    );

  UPDATE public.player_travel_history pth
  SET status = 'cancelled'
  WHERE pth.status = 'scheduled'
    AND pth.tour_leg_id IN (
      SELECT ttl.id
      FROM public.tour_travel_legs ttl
      WHERE ttl.tour_id = v_tour.id
        AND ttl.status = 'scheduled'
    );

  UPDATE public.tour_travel_legs
  SET status = 'cancelled'
  WHERE tour_id = v_tour.id
    AND status = 'scheduled';
  GET DIAGNOSTICS v_leg_count = ROW_COUNT;

  UPDATE public.tours
  SET status = 'cancelled'
  WHERE id = v_tour.id;

  IF v_refund > 0 THEN
    UPDATE public.bands
    SET band_balance = COALESCE(band_balance, 0) + v_refund
    WHERE id = v_tour.band_id;
  END IF;

  RETURN jsonb_build_object(
    'tour_id', v_tour.id,
    'already_cancelled', false,
    'same_day', v_same_day,
    'refund_amount', v_refund,
    'gigs_cancelled', v_gig_count,
    'travel_legs_cancelled', v_leg_count
  );
END;
$$;

REVOKE ALL ON FUNCTION public.cancel_tour(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.cancel_tour(uuid) TO authenticated, service_role;
