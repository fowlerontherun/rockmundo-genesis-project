-- A displayed tip is now a receipt for a completed wallet-to-treasury payment.
ALTER TABLE public.dikcok_fan_tips ADD COLUMN request_id uuid;
ALTER TABLE public.dikcok_fan_tips
  ADD CONSTRAINT dikcok_fan_tips_profile_request_key UNIQUE (tipper_profile_id, request_id);

DROP POLICY IF EXISTS "Users can create tips as themselves" ON public.dikcok_fan_tips;
REVOKE INSERT ON public.dikcok_fan_tips FROM PUBLIC, anon, authenticated;

CREATE FUNCTION public.send_dikcok_tip(
  p_video_id uuid,
  p_amount integer,
  p_request_id uuid,
  p_message text DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_profile_id uuid := public.current_player_profile_id();
  v_band_id uuid;
  v_receipt public.dikcok_fan_tips;
  v_treasury public.band_treasuries;
  v_amount_minor bigint;
  v_key text;
  v_previous_cash_context text := current_setting('app.player_cash_context', true);
  v_message text := nullif(p_message, '');
BEGIN
  IF auth.uid() IS NULL OR v_profile_id IS NULL THEN
    RAISE EXCEPTION 'profile_not_available' USING ERRCODE = '42501';
  END IF;
  IF p_video_id IS NULL OR p_request_id IS NULL OR p_amount IS NULL
     OR p_amount NOT IN (5, 10, 25, 50) THEN
    RAISE EXCEPTION 'invalid_dikcok_tip';
  END IF;

  v_key := 'dikcok_tip:' || v_profile_id::text || ':' || p_request_id::text;
  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_key, 0));

  SELECT * INTO v_receipt FROM public.dikcok_fan_tips
  WHERE tipper_profile_id = v_profile_id AND request_id = p_request_id;
  IF FOUND THEN
    IF v_receipt.video_id <> p_video_id OR v_receipt.amount <> p_amount
       OR v_receipt.message IS DISTINCT FROM v_message THEN
      RAISE EXCEPTION 'dikcok_tip_request_mismatch';
    END IF;
    RETURN v_receipt.id;
  END IF;

  SELECT band_id INTO v_band_id FROM public.dikcok_videos
  WHERE id = p_video_id FOR SHARE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'dikcok_video_unavailable';
  END IF;

  v_amount_minor := p_amount::bigint * 100;
  PERFORM pg_catalog.set_config('app.player_cash_context', jsonb_build_object(
    'classification', 'dikcok_tip',
    'display_category', 'dikcok_tip',
    'description', 'DikCok fan tip',
    'external_cash_flow', false,
    'idempotency_key', v_key || ':wallet'
  )::text, true);
  PERFORM public._debit_atomic_booking_payment(
    v_band_id, v_profile_id, 'personal', v_amount_minor,
    'dikcok_tip', v_key, 'DikCok fan tip'
  );

  PERFORM pg_catalog.set_config('app.player_cash_context', coalesce(v_previous_cash_context, ''), true);

  SELECT * INTO v_treasury FROM public.band_treasuries
  WHERE band_id = v_band_id AND is_primary AND currency_code = 'USD'
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'dikcok_tip_usd_treasury_missing';
  END IF;

  UPDATE public.band_treasuries
  SET balance_minor = balance_minor + v_amount_minor, updated_at = now()
  WHERE id = v_treasury.id
  RETURNING * INTO v_treasury;

  UPDATE public.bands SET band_balance = (v_treasury.balance_minor / 100)::integer
  WHERE id = v_band_id;

  INSERT INTO public.band_treasury_transactions (
    band_id, treasury_id, profile_id, direction, amount_minor, currency_code,
    source_kind, category, note, idempotency_key, balance_after_minor
  ) VALUES (
    v_band_id, v_treasury.id, v_profile_id, 'credit', v_amount_minor, 'USD',
    'dikcok_tip', 'merchandise_revenue', 'DikCok fan tip', v_key, v_treasury.balance_minor
  );

  INSERT INTO public.dikcok_fan_tips (video_id, tipper_profile_id, amount, message, request_id)
  VALUES (p_video_id, v_profile_id, p_amount, v_message, p_request_id)
  RETURNING * INTO v_receipt;
  RETURN v_receipt.id;
END;
$$;

REVOKE ALL ON FUNCTION public.send_dikcok_tip(uuid, integer, uuid, text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.send_dikcok_tip(uuid, integer, uuid, text)
  TO authenticated;
