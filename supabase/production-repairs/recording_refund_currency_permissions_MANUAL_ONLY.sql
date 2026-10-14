-- MANUAL-ONLY SECURITY HOTFIX REVIEW, issue #4097, #4099 (and #4098).
-- Generated from read-only LIVE function definitions 14 October 2026.
-- NOT a migration. No production DB change has been performed by this PR.
-- Before applying: verify backup/PITR, grants, staging outcomes, evidence from
-- the latest schema reconciliation, and obtain explicit finance deployment approval.
-- Execute ONLY within a transaction with a transaction-local approval marker:
-- BEGIN; SET LOCAL app.recording_refund_repair_approved = 'true';
-- \i supabase/production-repairs/recording_refund_currency_permissions_MANUAL_ONLY.sql
-- COMMIT;
-- The guard prevents execution on a changed or unexpected function definition.
DO $preflight$
BEGIN
  IF current_setting('app.recording_refund_repair_approved', true) IS DISTINCT FROM 'true' THEN
    RAISE EXCEPTION 'Recording refund repair requires explicit transaction-local approval';
  END IF;
  IF md5(pg_get_functiondef('public.cancel_recording_session_atomic(uuid,text,text)'::regprocedure))
     <> '69e281f0e130f290599f36ebcf72d571'
     OR md5(pg_get_functiondef('public._refund_atomic_booking_payment(uuid,text,text)'::regprocedure))
     <> '8c9cdbde5dc926263204b6dec663537c' THEN
    RAISE EXCEPTION 'Live recording refund function definition has drifted; re-review before applying';
  END IF;
END;
$preflight$;

-- The cancellation RPC already contains a scheduled_start <= now() check
-- in production. Preserve it while narrowing the band authorization scope.
CREATE OR REPLACE FUNCTION public.cancel_recording_session_atomic(p_recording_id uuid, p_reason text, p_idempotency_key text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  v_profile_id uuid := public._caller_profile_id();
  v_booking public.recording_sessions;
  v_payment public.booking_payments;
  v_refund jsonb;
BEGIN
  IF v_profile_id IS NULL THEN RAISE EXCEPTION 'active_profile_required'; END IF;

  SELECT * INTO v_booking FROM public.recording_sessions
  WHERE id = p_recording_id FOR UPDATE;
  IF v_booking.id IS NULL THEN RAISE EXCEPTION 'recording_not_found'; END IF;

  SELECT * INTO v_payment FROM public.booking_payments
  WHERE booking_type = 'recording' AND booking_id = p_recording_id FOR UPDATE;
  IF v_payment.id IS NULL THEN RAISE EXCEPTION 'booking_payment_not_found'; END IF;

  IF v_payment.band_id IS NOT NULL THEN
    IF NOT public._band_active_member(v_payment.band_id, v_profile_id) THEN RAISE EXCEPTION 'not_band_member'; END IF;
    -- Booking creator or band leader may manage a paid recording.
    -- An unrelated active member cannot cancel someone else's reservation.
    IF v_booking.profile_id IS DISTINCT FROM v_profile_id
       AND NOT EXISTS (
         SELECT 1 FROM public.bands b
         WHERE b.id = v_payment.band_id AND b.leader_id = v_profile_id
       ) THEN
      RAISE EXCEPTION 'recording_not_owned_by_caller';
    END IF;
  ELSIF v_payment.profile_id <> v_profile_id THEN
    RAISE EXCEPTION 'recording_not_owned_by_caller';
  END IF;

  IF v_booking.status NOT IN ('scheduled', 'cancelled') THEN
    RAISE EXCEPTION 'recording_not_cancellable';
  END IF;

  IF v_booking.status = 'scheduled' AND v_booking.scheduled_start <= now() THEN
    RAISE EXCEPTION 'recording_already_started';
  END IF;

  v_refund := public._refund_atomic_booking_payment(v_payment.id, p_reason, p_idempotency_key);

  UPDATE public.recording_sessions SET status = 'cancelled' WHERE id = p_recording_id;
  UPDATE public.player_scheduled_activities
  SET status = 'cancelled', updated_at = now()
  WHERE linked_recording_id = p_recording_id AND status NOT IN ('completed', 'cancelled');

  RETURN jsonb_build_object(
    'idempotent', v_booking.status = 'cancelled',
    'bookingId', p_recording_id,
    'refund', v_refund
  );
END;
$function$

-- Match the refund treasury to the currency of the original payment.
-- If no matching band treasury exists, fail the whole transaction and
-- leave the original booking/refund untouched.
CREATE OR REPLACE FUNCTION public._refund_atomic_booking_payment(p_booking_payment_id uuid, p_reason text, p_idempotency_key text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
      AND currency_code = v_payment.currency_code
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
$function$

REVOKE ALL ON FUNCTION public._refund_atomic_booking_payment(uuid,text,text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public._refund_atomic_booking_payment(uuid,text,text)
  TO service_role;
REVOKE ALL ON FUNCTION public.cancel_recording_session_atomic(uuid,text,text)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.cancel_recording_session_atomic(uuid,text,text)
  TO authenticated;
