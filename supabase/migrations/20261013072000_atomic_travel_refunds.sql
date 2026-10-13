-- Cancel a scheduled journey and credit its refund as one DB transaction.
-- Repeated or concurrent requests cannot double-credit cash.
CREATE OR REPLACE FUNCTION public.cancel_travel_with_refund_atomic(p_profile_id uuid,p_travel_id uuid)
RETURNS bigint LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_user uuid := auth.uid();
  v_paid bigint;
  v_profile uuid;
  v_status text;
  v_departure timestamptz;
BEGIN
  IF v_user IS NULL OR p_profile_id IS NULL OR p_travel_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;
  IF NOT EXISTS(SELECT 1 FROM public.profiles WHERE id = p_profile_id AND user_id = v_user) THEN
    RAISE EXCEPTION 'Character does not belong to account';
  END IF;
  SELECT profile_id, cost_paid, status, departure_time
    INTO v_profile, v_paid, v_status, v_departure
    FROM public.player_travel_history
   WHERE id = p_travel_id AND user_id = v_user FOR UPDATE;
  IF NOT FOUND OR v_profile IS DISTINCT FROM p_profile_id THEN
    RAISE EXCEPTION 'Travel booking not found for character';
  END IF;
  IF v_status <> 'scheduled' OR v_departure <= now() THEN
    RAISE EXCEPTION 'Travel can no longer be cancelled';
  END IF;
  IF v_paid IS NULL OR v_paid < 0 THEN
    RAISE EXCEPTION 'Invalid paid travel amount';
  END IF;
  UPDATE public.player_travel_history SET status = 'cancelled' WHERE id = p_travel_id;
  UPDATE public.profiles SET cash = cash + v_paid WHERE id = p_profile_id AND user_id = v_user;
  IF NOT FOUND THEN RAISE EXCEPTION 'Refund recipient unavailable'; END IF;
  RETURN v_paid;
END; $$;
REVOKE ALL ON FUNCTION public.cancel_travel_with_refund_atomic(uuid,uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.cancel_travel_with_refund_atomic(uuid,uuid) TO authenticated;
