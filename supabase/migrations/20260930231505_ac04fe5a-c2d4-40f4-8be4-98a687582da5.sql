CREATE OR REPLACE FUNCTION public.cancel_tour(p_tour_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_tour public.tours%ROWTYPE;
  v_uid uuid := auth.uid();
  v_allowed boolean;
  v_same_day boolean;
  v_refund numeric := 0;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'tour_cancel_forbidden'; END IF;

  SELECT * INTO v_tour FROM public.tours WHERE id = p_tour_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'tour_cancel_not_found'; END IF;

  IF v_tour.status = 'cancelled' OR COALESCE(v_tour.cancelled, false) THEN
    RETURN jsonb_build_object('tour_id', p_tour_id, 'already_cancelled', true, 'refund_amount', 0);
  END IF;

  v_allowed := v_tour.user_id = v_uid OR EXISTS (
    SELECT 1 FROM public.profiles pr
    WHERE pr.user_id = v_uid AND public._band_active_member(v_tour.band_id, pr.id)
  );
  IF NOT v_allowed THEN RAISE EXCEPTION 'tour_cancel_forbidden'; END IF;

  v_same_day := v_tour.created_at::date = now()::date;
  IF v_same_day THEN
    v_refund := round(COALESCE(v_tour.total_upfront_cost, 0));
    IF v_refund > 0 AND v_tour.band_id IS NOT NULL THEN
      UPDATE public.bands SET band_balance = COALESCE(band_balance, 0) + v_refund WHERE id = v_tour.band_id;
    END IF;
  END IF;

  UPDATE public.gigs
     SET status = 'cancelled', cancelled_at = now(), cancellation_reason = 'tour_cancelled', updated_at = now()
   WHERE tour_id = p_tour_id AND status = 'scheduled' AND started_at IS NULL;

  UPDATE public.tour_travel_legs
     SET status = 'cancelled', cancelled_at = now()
   WHERE tour_id = p_tour_id AND departure_date > now() AND COALESCE(status, '') <> 'cancelled';

  UPDATE public.player_scheduled_activities
     SET status = 'cancelled', updated_at = now()
   WHERE status = 'scheduled'
     AND linked_gig_id IN (SELECT id FROM public.gigs WHERE tour_id = p_tour_id AND status = 'cancelled');

  UPDATE public.tours
     SET status = 'cancelled', cancelled = true, cancellation_date = now(), cancellation_refund_amount = v_refund
   WHERE id = p_tour_id;

  RETURN jsonb_build_object('tour_id', p_tour_id, 'same_day', v_same_day, 'refund_amount', v_refund);
END;
$$;
REVOKE ALL ON FUNCTION public.cancel_tour(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.cancel_tour(uuid) TO authenticated;