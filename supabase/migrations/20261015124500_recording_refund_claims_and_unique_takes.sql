-- Recording safety batch (#4097 #4099 #4104 #4107 #4114)
-- No data backfill or existing refund replay. Deploy before updated worker.
BEGIN;

-- #4099: match the ORIGINAL payment currency, not just any primary treasury.
-- An unmatched currency must fail the transaction, not mint a credit elsewhere.
CREATE OR REPLACE FUNCTION public._refund_atomic_booking_payment(
  p_booking_payment_id uuid, p_reason text, p_idempotency_key text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
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
    IF v_refund.booking_payment_id <> p_booking_payment_id THEN
      RAISE EXCEPTION 'refund_idempotency_key_reused';
    END IF;
    RETURN jsonb_build_object('idempotent',true,'refundId',v_refund.id,
      'amountMinor',v_refund.amount_minor,'paymentSource',v_refund.payment_source);
  END IF;
  SELECT * INTO v_payment FROM public.booking_payments WHERE id=p_booking_payment_id FOR UPDATE;
  IF v_payment.id IS NULL THEN RAISE EXCEPTION 'booking_payment_not_found'; END IF;
  SELECT * INTO v_refund FROM public.booking_refunds WHERE booking_payment_id=v_payment.id;
  IF v_refund.id IS NOT NULL THEN
    RETURN jsonb_build_object('idempotent',true,'refundId',v_refund.id,
      'amountMinor',v_refund.amount_minor,'paymentSource',v_refund.payment_source);
  END IF;

  IF v_payment.payment_source='band' THEN
    SELECT * INTO v_treasury FROM public.band_treasuries
      WHERE band_id=v_payment.band_id AND currency_code=v_payment.currency_code
      ORDER BY is_primary DESC,created_at ASC LIMIT 1 FOR UPDATE;
    IF v_treasury.id IS NULL THEN RAISE EXCEPTION 'booking_refund_matching_currency_treasury_missing'; END IF;
    UPDATE public.band_treasuries
      SET balance_minor=balance_minor+v_payment.amount_minor, updated_at=now()
      WHERE id=v_treasury.id RETURNING balance_minor INTO v_balance_after;
    IF v_payment.amount_minor > 0 THEN
      INSERT INTO public.band_treasury_transactions (
        band_id,treasury_id,profile_id,direction,amount_minor,currency_code,
        source_kind,category,note,idempotency_key,balance_after_minor
      ) VALUES (
        v_payment.band_id,v_treasury.id,v_payment.profile_id,'credit',
        v_payment.amount_minor,v_payment.currency_code,
        'booking_refund','booking_refund',coalesce(p_reason,'Booking refund'),
        p_idempotency_key || ':treasury',v_balance_after
      );
    END IF;
    IF v_treasury.is_primary THEN
      UPDATE public.bands SET band_balance=(v_balance_after/100)::integer
        WHERE id=v_payment.band_id;
    END IF;
  ELSE
    IF v_payment.amount_minor % 100 <> 0 THEN
      RAISE EXCEPTION 'personal_refund_requires_whole_currency_units';
    END IF;
    UPDATE public.profiles SET cash=coalesce(cash,0)+(v_payment.amount_minor/100)
      WHERE id=v_payment.profile_id RETURNING cash*100 INTO v_balance_after;
    IF v_balance_after IS NULL THEN RAISE EXCEPTION 'profile_not_available'; END IF;
  END IF;
  INSERT INTO public.booking_refunds (
    booking_payment_id,booking_type,booking_id,payment_source,
    amount_minor,currency_code,reason,idempotency_key,refunded_by_profile_id
  ) VALUES (
    v_payment.id,v_payment.booking_type,v_payment.booking_id,v_payment.payment_source,
    v_payment.amount_minor,v_payment.currency_code,p_reason,p_idempotency_key,
    public._caller_profile_id()
  ) RETURNING id INTO v_refund_id;
  UPDATE public.booking_payments SET refunded_amount_minor=amount_minor,
    refunded_at=now(),refund_id=v_refund_id WHERE id=v_payment.id;
  RETURN jsonb_build_object('idempotent',false,'refundId',v_refund_id,
    'amountMinor',v_payment.amount_minor,'paymentSource',v_payment.payment_source,
    'payerBalanceAfterMinor',v_balance_after);
END;
$$;
REVOKE ALL ON FUNCTION public._refund_atomic_booking_payment(uuid,text,text)
  FROM PUBLIC,anon,authenticated;

-- #4097: booking creator/payer or the current band leader may cancel, not
-- arbitrary former/ordinary members. Retain the existing start-time guard.
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
  IF v_booking.status='scheduled' AND v_booking.scheduled_start <= now() THEN
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

-- #4107: only one worker may hold a current completion lease per paid session.
ALTER TABLE public.recording_sessions
  ADD COLUMN IF NOT EXISTS completion_claim_id uuid,
  ADD COLUMN IF NOT EXISTS completion_claim_expires_at timestamptz;
CREATE INDEX IF NOT EXISTS idx_recording_completion_claim_expiry
  ON public.recording_sessions(completion_claim_expires_at)
  WHERE status IN ('scheduled','in_progress');

CREATE OR REPLACE FUNCTION public.claim_recording_completion(p_session_id uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE v_booking public.recording_sessions; v_claim uuid;
BEGIN
  IF current_setting('request.jwt.claim.role',true) IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'service_role_required' USING ERRCODE='42501';
  END IF;
  SELECT * INTO v_booking FROM public.recording_sessions
    WHERE id=p_session_id FOR UPDATE;
  IF NOT FOUND OR v_booking.status NOT IN ('scheduled','in_progress')
     OR v_booking.scheduled_end > now() THEN RETURN NULL; END IF;
  IF v_booking.completion_claim_id IS NOT NULL
     AND v_booking.completion_claim_expires_at > now() THEN RETURN NULL; END IF;
  v_claim:=gen_random_uuid();
  UPDATE public.recording_sessions SET completion_claim_id=v_claim,
    completion_claim_expires_at=now()+interval '30 minutes', status='in_progress'
    WHERE id=p_session_id;
  RETURN v_claim;
END;
$$;
REVOKE ALL ON FUNCTION public.claim_recording_completion(uuid)
  FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.claim_recording_completion(uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.release_recording_completion(
  p_session_id uuid,p_claim_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  IF current_setting('request.jwt.claim.role',true) IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'service_role_required' USING ERRCODE='42501';
  END IF;
  UPDATE public.recording_sessions
    SET completion_claim_id=NULL,completion_claim_expires_at=NULL
    WHERE id=p_session_id AND completion_claim_id=p_claim_id
      AND status='in_progress';
END;
$$;
REVOKE ALL ON FUNCTION public.release_recording_completion(uuid,uuid)
  FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.release_recording_completion(uuid,uuid) TO service_role;

-- #4114: each alternate recording creates its own immutable child song;
-- retries find only their own child instead of mutating another recording.
ALTER TABLE public.songs
  ADD COLUMN IF NOT EXISTS source_recording_session_id uuid
  REFERENCES public.recording_sessions(id) ON DELETE SET NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_songs_unique_source_recording
  ON public.songs(source_recording_session_id)
  WHERE source_recording_session_id IS NOT NULL;

-- Completion + morale are committed once while holding the lease. The
-- existing award_recording_xp_atomic RPC still deduplicates XP separately.
CREATE OR REPLACE FUNCTION public.finalize_recording_completion(
  p_session_id uuid,p_claim_id uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE v_booking public.recording_sessions;v_boost integer;v_morale integer;
BEGIN
  IF current_setting('request.jwt.claim.role',true) IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'service_role_required' USING ERRCODE='42501';
  END IF;
  SELECT * INTO v_booking FROM public.recording_sessions
    WHERE id=p_session_id FOR UPDATE;
  IF NOT FOUND OR v_booking.status <> 'in_progress'
     OR v_booking.completion_claim_id IS DISTINCT FROM p_claim_id
     OR v_booking.completion_claim_expires_at <= now() THEN
    RETURN false;
  END IF;
  IF v_booking.band_id IS NOT NULL AND coalesce(v_booking.quality_improvement,0)>0 THEN
    v_boost:=CASE WHEN v_booking.quality_improvement>=25 THEN 5
                  WHEN v_booking.quality_improvement>=15 THEN 3 ELSE 1 END;
    UPDATE public.bands SET morale=least(100,coalesce(morale,50)+v_boost)
      WHERE id=v_booking.band_id RETURNING morale INTO v_morale;
    IF FOUND THEN
      INSERT INTO public.band_health_events(
        band_id,event_type,delta,new_value,source,description)
      VALUES(v_booking.band_id,'morale',v_boost,v_morale,'recording_session',
        'Recording session: quality +'||v_booking.quality_improvement);
    END IF;
  END IF;
  UPDATE public.recording_sessions SET status='completed',
    completed_at=now(),completion_claim_id=NULL,completion_claim_expires_at=NULL
    WHERE id=p_session_id;
  RETURN true;
END;
$$;
REVOKE ALL ON FUNCTION public.finalize_recording_completion(uuid,uuid)
  FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.finalize_recording_completion(uuid,uuid) TO service_role;
COMMIT;
