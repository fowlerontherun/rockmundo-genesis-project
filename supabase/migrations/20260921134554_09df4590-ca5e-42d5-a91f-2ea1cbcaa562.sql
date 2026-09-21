BEGIN;

CREATE TABLE IF NOT EXISTS public.booking_refunds (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_payment_id uuid NOT NULL REFERENCES public.booking_payments(id) ON DELETE RESTRICT,
  booking_type text NOT NULL CHECK (booking_type IN ('rehearsal', 'recording')),
  booking_id uuid NOT NULL,
  payment_source text NOT NULL CHECK (payment_source IN ('band', 'personal')),
  amount_minor bigint NOT NULL CHECK (amount_minor >= 0),
  currency_code text NOT NULL,
  reason text,
  idempotency_key text NOT NULL UNIQUE,
  refunded_by_profile_id uuid REFERENCES public.profiles(id),
  refunded_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (booking_payment_id)
);

ALTER TABLE public.booking_refunds ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.booking_refunds FROM anon, authenticated;
GRANT ALL ON public.booking_refunds TO service_role;

ALTER TABLE public.booking_payments
  ADD COLUMN IF NOT EXISTS refunded_amount_minor bigint NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS refunded_at timestamptz,
  ADD COLUMN IF NOT EXISTS refund_id uuid REFERENCES public.booking_refunds(id);

CREATE OR REPLACE FUNCTION public._refund_atomic_booking_payment(
  p_booking_payment_id uuid,
  p_reason text,
  p_idempotency_key text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_payment public.booking_payments;
  v_refund public.booking_refunds;
  v_treasury public.band_treasuries;
  v_refund_id uuid;
  v_balance_after bigint;
BEGIN
  IF p_idempotency_key IS NULL OR length(trim(p_idempotency_key)) < 8 THEN
    RAISE EXCEPTION 'invalid_idempotency_key';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended('booking-refund:' || p_idempotency_key, 0));

  SELECT * INTO v_refund FROM public.booking_refunds WHERE idempotency_key = p_idempotency_key;
  IF v_refund.id IS NOT NULL THEN
    RETURN jsonb_build_object('idempotent', true, 'refundId', v_refund.id,
      'amountMinor', v_refund.amount_minor, 'paymentSource', v_refund.payment_source);
  END IF;

  SELECT * INTO v_payment FROM public.booking_payments WHERE id = p_booking_payment_id FOR UPDATE;
  IF v_payment.id IS NULL THEN RAISE EXCEPTION 'booking_payment_not_found'; END IF;

  SELECT * INTO v_refund FROM public.booking_refunds WHERE booking_payment_id = v_payment.id;
  IF v_refund.id IS NOT NULL THEN
    RETURN jsonb_build_object('idempotent', true, 'refundId', v_refund.id,
      'amountMinor', v_refund.amount_minor, 'paymentSource', v_refund.payment_source);
  END IF;

  IF v_payment.payment_source = 'band' THEN
    SELECT * INTO v_treasury FROM public.band_treasuries
    WHERE band_id = v_payment.band_id
    ORDER BY is_primary DESC, created_at ASC
    LIMIT 1 FOR UPDATE;

    IF v_treasury.id IS NULL THEN RAISE EXCEPTION 'band_treasury_missing'; END IF;

    UPDATE public.band_treasuries
    SET balance_minor = balance_minor + v_payment.amount_minor, updated_at = now()
    WHERE id = v_treasury.id
    RETURNING balance_minor INTO v_balance_after;

    IF v_payment.amount_minor > 0 THEN
      INSERT INTO public.band_treasury_transactions (
        band_id, treasury_id, profile_id, direction, amount_minor, currency_code,
        source_kind, category, note, idempotency_key, balance_after_minor
      ) VALUES (
        v_payment.band_id, v_treasury.id, v_payment.profile_id, 'credit',
        v_payment.amount_minor, v_payment.currency_code, 'booking_refund', 'booking_refund',
        COALESCE(p_reason, 'Booking refund'), p_idempotency_key || ':treasury', v_balance_after
      );
    END IF;

    IF v_treasury.is_primary THEN
      UPDATE public.bands SET band_balance = (v_balance_after / 100)::integer WHERE id = v_payment.band_id;
    END IF;
  ELSE
    IF v_payment.amount_minor % 100 <> 0 THEN
      RAISE EXCEPTION 'personal_refund_requires_whole_currency_units';
    END IF;

    UPDATE public.profiles
    SET cash = COALESCE(cash, 0) + (v_payment.amount_minor / 100)
    WHERE id = v_payment.profile_id
    RETURNING cash * 100 INTO v_balance_after;

    IF v_balance_after IS NULL THEN RAISE EXCEPTION 'profile_not_available'; END IF;
  END IF;

  INSERT INTO public.booking_refunds (
    booking_payment_id, booking_type, booking_id, payment_source,
    amount_minor, currency_code, reason, idempotency_key, refunded_by_profile_id
  ) VALUES (
    v_payment.id, v_payment.booking_type, v_payment.booking_id, v_payment.payment_source,
    v_payment.amount_minor, v_payment.currency_code, p_reason, p_idempotency_key,
    public._caller_profile_id()
  )
  RETURNING id INTO v_refund_id;

  UPDATE public.booking_payments
  SET refunded_amount_minor = amount_minor, refunded_at = now(), refund_id = v_refund_id
  WHERE id = v_payment.id;

  RETURN jsonb_build_object('idempotent', false, 'refundId', v_refund_id,
    'amountMinor', v_payment.amount_minor, 'paymentSource', v_payment.payment_source,
    'payerBalanceAfterMinor', v_balance_after);
END;
$$;

REVOKE ALL ON FUNCTION public._refund_atomic_booking_payment(uuid, text, text)
  FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.cancel_rehearsal_booking_atomic(
  p_rehearsal_id uuid,
  p_reason text,
  p_idempotency_key text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_profile_id uuid := public._caller_profile_id();
  v_booking public.band_rehearsals;
  v_payment public.booking_payments;
  v_refund jsonb;
BEGIN
  IF v_profile_id IS NULL THEN RAISE EXCEPTION 'active_profile_required'; END IF;

  SELECT * INTO v_booking FROM public.band_rehearsals WHERE id = p_rehearsal_id FOR UPDATE;
  IF v_booking.id IS NULL THEN RAISE EXCEPTION 'rehearsal_not_found'; END IF;
  IF NOT public._band_active_member(v_booking.band_id, v_profile_id) THEN RAISE EXCEPTION 'not_band_member'; END IF;

  SELECT * INTO v_payment FROM public.booking_payments
  WHERE booking_type = 'rehearsal' AND booking_id = p_rehearsal_id FOR UPDATE;
  IF v_payment.id IS NULL THEN RAISE EXCEPTION 'booking_payment_not_found'; END IF;

  IF v_booking.status NOT IN ('scheduled', 'cancelled') THEN RAISE EXCEPTION 'rehearsal_not_cancellable'; END IF;

  v_refund := public._refund_atomic_booking_payment(v_payment.id, p_reason, p_idempotency_key);

  UPDATE public.band_rehearsals SET status = 'cancelled' WHERE id = p_rehearsal_id;
  UPDATE public.player_scheduled_activities
  SET status = 'cancelled', updated_at = now()
  WHERE linked_rehearsal_id = p_rehearsal_id AND status NOT IN ('completed', 'cancelled');

  RETURN jsonb_build_object('idempotent', v_booking.status = 'cancelled',
    'bookingId', p_rehearsal_id, 'refund', v_refund);
END;
$$;

REVOKE ALL ON FUNCTION public.cancel_rehearsal_booking_atomic(uuid, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.cancel_rehearsal_booking_atomic(uuid, text, text) TO authenticated;

COMMIT;