-- Make Tour Manager cancellation authoritative and atomic.
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
    RETURN jsonb_build_object('tour_id', v_tour.id, 'already_cancelled', true, 'refund_amount', 0);
  END IF;

  v_same_day := (v_tour.created_at AT TIME ZONE 'UTC')::date = (now() AT TIME ZONE 'UTC')::date;
  v_refund := CASE WHEN v_same_day THEN COALESCE(v_tour.total_upfront_cost, 0) ELSE 0 END;

  UPDATE public.tours
  SET status = 'cancelled'
  WHERE id = v_tour.id;

  UPDATE public.gigs
  SET status = 'cancelled'
  WHERE tour_id = v_tour.id
    AND status NOT IN ('completed', 'cancelled');

  IF v_refund > 0 THEN
    UPDATE public.bands
    SET band_balance = COALESCE(band_balance, 0) + v_refund
    WHERE id = v_tour.band_id;
  END IF;

  RETURN jsonb_build_object(
    'tour_id', v_tour.id,
    'already_cancelled', false,
    'same_day', v_same_day,
    'refund_amount', v_refund
  );
END;
$$;

REVOKE ALL ON FUNCTION public.cancel_tour(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.cancel_tour(uuid) TO authenticated, service_role;
