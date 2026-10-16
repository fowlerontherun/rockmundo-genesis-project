-- #4098: Correct cancellation deadline if a transaction waits on a row lock.
-- PostgreSQL now() is frozen at the transaction start; clock_timestamp() reflects
-- the real time AFTER the recording/payment rows are locked. Preserve the
-- #4097 caller authorization and #4099 currency-aware refund helper.
-- Forward-only function replacement; no booking/payment/backfill writes.
BEGIN;

-- Finance-sensitive override: abort if an unexpected live version changed.
DO $preflight$
BEGIN
  IF md5(pg_get_functiondef('public.cancel_recording_session_atomic(uuid,text,text)'::regprocedure))
     <> 'b334e7008fb6f56851ed196d04cddf96' THEN
    RAISE EXCEPTION 'recording cancellation function drifted; review before applying #4098';
  END IF;
END;
$preflight$;

CREATE OR REPLACE FUNCTION public.cancel_recording_session_atomic(
  p_recording_id uuid, p_reason text, p_idempotency_key text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  v_profile_id uuid := public._caller_profile_id();
  v_booking public.recording_sessions;
  v_payment public.booking_payments;
  v_refund jsonb;
BEGIN
  IF v_profile_id IS NULL THEN RAISE EXCEPTION 'active_profile_required'; END IF;
  SELECT * INTO v_booking FROM public.recording_sessions
    WHERE id=p_recording_id FOR UPDATE;
  IF v_booking.id IS NULL THEN RAISE EXCEPTION 'recording_not_found'; END IF;
  SELECT * INTO v_payment FROM public.booking_payments
    WHERE booking_type='recording' AND booking_id=p_recording_id FOR UPDATE;
  IF v_payment.id IS NULL THEN RAISE EXCEPTION 'booking_payment_not_found'; END IF;

  IF v_payment.band_id IS NOT NULL THEN
    IF NOT public._band_active_member(v_payment.band_id,v_profile_id) THEN
      RAISE EXCEPTION 'not_band_member';
    END IF;
    IF v_profile_id IS DISTINCT FROM v_payment.profile_id
       AND v_profile_id IS DISTINCT FROM v_booking.profile_id
       AND NOT EXISTS (
         SELECT 1 FROM public.bands WHERE id=v_payment.band_id AND leader_id=v_profile_id
       ) THEN
      RAISE EXCEPTION 'recording_cancellation_not_authorized' USING ERRCODE='42501';
    END IF;
  ELSIF v_payment.profile_id IS DISTINCT FROM v_profile_id THEN
    RAISE EXCEPTION 'recording_not_owned_by_caller';
  END IF;

  IF v_booking.status NOT IN ('scheduled','cancelled') THEN
    RAISE EXCEPTION 'recording_not_cancellable';
  END IF;
  IF v_booking.status='scheduled' AND v_booking.scheduled_start <= clock_timestamp() THEN
    RAISE EXCEPTION 'recording_already_started';
  END IF;
  v_refund:=public._refund_atomic_booking_payment(v_payment.id,p_reason,p_idempotency_key);
  UPDATE public.recording_sessions SET status='cancelled' WHERE id=p_recording_id;
  UPDATE public.player_scheduled_activities
    SET status='cancelled',updated_at=now()
    WHERE linked_recording_id=p_recording_id AND status NOT IN ('completed','cancelled');
  RETURN jsonb_build_object('idempotent',v_booking.status='cancelled',
    'bookingId',p_recording_id,'refund',v_refund);
END;
$$;

REVOKE ALL ON FUNCTION public.cancel_recording_session_atomic(uuid,text,text)
  FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.cancel_recording_session_atomic(uuid,text,text)
  TO authenticated;

COMMIT;
