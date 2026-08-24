-- Finance backlog A2: replay-safe refunds, obligation retry repair, and mortgage schedule synchronisation.

BEGIN;

-- ---------------------------------------------------------------------------
-- Source-aware booking refunds
-- ---------------------------------------------------------------------------

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
REVOKE ALL ON TABLE public.booking_refunds FROM anon, authenticated;
GRANT ALL ON TABLE public.booking_refunds TO service_role;

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
  v_existing public.booking_refunds;
  v_treasury public.band_treasuries;
  v_refund_id uuid;
  v_balance_after bigint;
BEGIN
  IF p_idempotency_key IS NULL OR length(trim(p_idempotency_key)) < 8 THEN
    RAISE EXCEPTION 'invalid_idempotency_key';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended('booking-refund:' || p_idempotency_key, 0));

  SELECT * INTO v_existing
  FROM public.booking_refunds
  WHERE idempotency_key = p_idempotency_key;

  IF v_existing.id IS NOT NULL THEN
    RETURN jsonb_build_object(
      'idempotent', true,
      'refundId', v_existing.id,
      'amountMinor', v_existing.amount_minor,
      'paymentSource', v_existing.payment_source
    );
  END IF;

  SELECT * INTO v_payment
  FROM public.booking_payments
  WHERE id = p_booking_payment_id
  FOR UPDATE;

  IF v_payment.id IS NULL THEN
    RAISE EXCEPTION 'booking_payment_not_found';
  END IF;

  IF v_payment.refund_id IS NOT NULL OR v_payment.refunded_at IS NOT NULL THEN
    SELECT * INTO v_existing
    FROM public.booking_refunds
    WHERE booking_payment_id = v_payment.id;
    RETURN jsonb_build_object(
      'idempotent', true,
      'refundId', v_existing.id,
      'amountMinor', COALESCE(v_existing.amount_minor, v_payment.refunded_amount_minor),
      'paymentSource', v_payment.payment_source
    );
  END IF;

  IF v_payment.payment_source = 'band' THEN
    SELECT * INTO v_treasury
    FROM public.band_treasuries
    WHERE band_id = v_payment.band_id
    ORDER BY is_primary DESC, created_at ASC
    LIMIT 1
    FOR UPDATE;

    IF v_treasury.id IS NULL THEN
      RAISE EXCEPTION 'band_treasury_missing';
    END IF;

    UPDATE public.band_treasuries
    SET balance_minor = balance_minor + v_payment.amount_minor,
        updated_at = now()
    WHERE id = v_treasury.id
    RETURNING balance_minor INTO v_balance_after;

    IF v_payment.amount_minor > 0 THEN
      INSERT INTO public.band_treasury_transactions (
        band_id, treasury_id, profile_id, direction, amount_minor, currency_code,
        source_kind, category, note, idempotency_key, balance_after_minor
      ) VALUES (
        v_payment.band_id,
        v_treasury.id,
        v_payment.profile_id,
        'credit',
        v_payment.amount_minor,
        v_payment.currency_code,
        'booking_refund',
        'booking_refund',
        COALESCE(p_reason, 'Booking refund'),
        p_idempotency_key || ':treasury',
        v_balance_after
      );
    END IF;

    IF v_treasury.is_primary THEN
      UPDATE public.bands
      SET band_balance = (v_balance_after / 100)::integer
      WHERE id = v_payment.band_id;
    END IF;
  ELSE
    IF v_payment.amount_minor % 100 <> 0 THEN
      RAISE EXCEPTION 'personal_refund_requires_whole_currency_units';
    END IF;

    UPDATE public.profiles
    SET cash = COALESCE(cash, 0) + (v_payment.amount_minor / 100)
    WHERE id = v_payment.profile_id
    RETURNING cash * 100 INTO v_balance_after;

    IF v_balance_after IS NULL THEN
      RAISE EXCEPTION 'profile_not_available';
    END IF;
  END IF;

  INSERT INTO public.booking_refunds (
    booking_payment_id,
    booking_type,
    booking_id,
    payment_source,
    amount_minor,
    currency_code,
    reason,
    idempotency_key,
    refunded_by_profile_id
  ) VALUES (
    v_payment.id,
    v_payment.booking_type,
    v_payment.booking_id,
    v_payment.payment_source,
    v_payment.amount_minor,
    v_payment.currency_code,
    p_reason,
    p_idempotency_key,
    public._caller_profile_id()
  )
  RETURNING id INTO v_refund_id;

  UPDATE public.booking_payments
  SET refunded_amount_minor = amount_minor,
      refunded_at = now(),
      refund_id = v_refund_id
  WHERE id = v_payment.id;

  RETURN jsonb_build_object(
    'idempotent', false,
    'refundId', v_refund_id,
    'amountMinor', v_payment.amount_minor,
    'paymentSource', v_payment.payment_source,
    'payerBalanceAfterMinor', v_balance_after
  );
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
  v_rehearsal public.band_rehearsals;
  v_payment public.booking_payments;
  v_refund jsonb;
BEGIN
  IF v_profile_id IS NULL THEN RAISE EXCEPTION 'active_profile_required'; END IF;

  SELECT * INTO v_rehearsal
  FROM public.band_rehearsals
  WHERE id = p_rehearsal_id
  FOR UPDATE;

  IF v_rehearsal.id IS NULL THEN RAISE EXCEPTION 'rehearsal_not_found'; END IF;
  IF NOT public._band_active_member(v_rehearsal.band_id, v_profile_id) THEN
    RAISE EXCEPTION 'not_band_member';
  END IF;

  SELECT * INTO v_payment
  FROM public.booking_payments
  WHERE booking_type = 'rehearsal' AND booking_id = p_rehearsal_id
  FOR UPDATE;

  IF v_payment.id IS NULL THEN RAISE EXCEPTION 'booking_payment_not_found'; END IF;

  IF v_rehearsal.status = 'cancelled' THEN
    v_refund := public._refund_atomic_booking_payment(v_payment.id, p_reason, p_idempotency_key);
    RETURN jsonb_build_object('idempotent', true, 'bookingId', p_rehearsal_id, 'refund', v_refund);
  END IF;

  IF v_rehearsal.status <> 'scheduled' THEN
    RAISE EXCEPTION 'rehearsal_not_cancellable';
  END IF;

  v_refund := public._refund_atomic_booking_payment(v_payment.id, p_reason, p_idempotency_key);

  UPDATE public.band_rehearsals
  SET status = 'cancelled'
  WHERE id = p_rehearsal_id;

  UPDATE public.player_scheduled_activities
  SET status = 'cancelled', updated_at = now()
  WHERE linked_rehearsal_id = p_rehearsal_id
    AND status NOT IN ('completed', 'cancelled');

  RETURN jsonb_build_object('idempotent', false, 'bookingId', p_rehearsal_id, 'refund', v_refund);
END;
$$;

REVOKE ALL ON FUNCTION public.cancel_rehearsal_booking_atomic(uuid, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.cancel_rehearsal_booking_atomic(uuid, text, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.cancel_recording_session_atomic(
  p_recording_id uuid,
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
  v_recording public.recording_sessions;
  v_payment public.booking_payments;
  v_refund jsonb;
BEGIN
  IF v_profile_id IS NULL THEN RAISE EXCEPTION 'active_profile_required'; END IF;

  SELECT * INTO v_recording
  FROM public.recording_sessions
  WHERE id = p_recording_id
  FOR UPDATE;

  IF v_recording.id IS NULL THEN RAISE EXCEPTION 'recording_not_found'; END IF;

  SELECT * INTO v_payment
  FROM public.booking_payments
  WHERE booking_type = 'recording' AND booking_id = p_recording_id
  FOR UPDATE;

  IF v_payment.id IS NULL THEN RAISE EXCEPTION 'booking_payment_not_found'; END IF;

  IF v_payment.band_id IS NOT NULL THEN
    IF NOT public._band_active_member(v_payment.band_id, v_profile_id) THEN
      RAISE EXCEPTION 'not_band_member';
    END IF;
  ELSIF v_payment.profile_id <> v_profile_id THEN
    RAISE EXCEPTION 'recording_not_owned_by_caller';
  END IF;

  IF v_recording.status = 'cancelled' THEN
    v_refund := public._refund_atomic_booking_payment(v_payment.id, p_reason, p_idempotency_key);
    RETURN jsonb_build_object('idempotent', true, 'bookingId', p_recording_id, 'refund', v_refund);
  END IF;

  IF v_recording.status <> 'scheduled' THEN
    RAISE EXCEPTION 'recording_not_cancellable';
  END IF;

  v_refund := public._refund_atomic_booking_payment(v_payment.id, p_reason, p_idempotency_key);

  UPDATE public.recording_sessions
  SET status = 'cancelled'
  WHERE id = p_recording_id;

  UPDATE public.player_scheduled_activities
  SET status = 'cancelled', updated_at = now()
  WHERE linked_recording_id = p_recording_id
    AND status NOT IN ('completed', 'cancelled');

  RETURN jsonb_build_object('idempotent', false, 'bookingId', p_recording_id, 'refund', v_refund);
END;
$$;

REVOKE ALL ON FUNCTION public.cancel_recording_session_atomic(uuid, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.cancel_recording_session_atomic(uuid, text, text) TO authenticated;

-- ---------------------------------------------------------------------------
-- Obligation replay and retry policy hardening
-- ---------------------------------------------------------------------------

CREATE UNIQUE INDEX IF NOT EXISTS financial_obligation_attempt_schedule_number_uq
  ON public.financial_obligation_attempts(schedule_id, attempt_number);

CREATE OR REPLACE FUNCTION public.process_financial_obligation_payment_guarded(
  p_schedule_id uuid,
  p_idempotency_key text,
  p_as_of_date date DEFAULT CURRENT_DATE,
  p_as_of_timestamp timestamptz DEFAULT timezone('utc', now())
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_existing public.financial_obligation_attempts;
  v_result jsonb;
  v_attempts integer;
  v_max_attempts integer;
BEGIN
  IF p_idempotency_key IS NULL OR length(trim(p_idempotency_key)) = 0 THEN
    RAISE EXCEPTION 'idempotency key required';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended('financial-obligation:' || p_idempotency_key, 0));

  SELECT * INTO v_existing
  FROM public.financial_obligation_attempts
  WHERE idempotency_key = p_idempotency_key;

  IF v_existing.id IS NOT NULL THEN
    RETURN jsonb_build_object(
      'status', CASE WHEN v_existing.status = 'succeeded' THEN 'already_paid' ELSE 'already_attempted' END,
      'attemptId', v_existing.id,
      'attemptStatus', v_existing.status,
      'transactionId', v_existing.transaction_id,
      'failureReason', v_existing.failure_reason,
      'idempotent', true
    );
  END IF;

  v_result := public.process_financial_obligation_payment_internal(
    p_schedule_id,
    p_idempotency_key,
    p_as_of_date,
    p_as_of_timestamp
  );

  IF v_result->>'status' = 'failed' THEN
    SELECT count(*), o.max_attempts
      INTO v_attempts, v_max_attempts
    FROM public.financial_obligation_attempts a
    JOIN public.financial_obligation_schedule s ON s.id = a.schedule_id
    JOIN public.financial_obligations o ON o.id = s.obligation_id
    WHERE a.schedule_id = p_schedule_id
    GROUP BY o.max_attempts;

    IF COALESCE(v_attempts, 0) >= COALESCE(v_max_attempts, 1) THEN
      UPDATE public.financial_obligation_schedule
      SET next_retry_at = NULL
      WHERE id = p_schedule_id;
    END IF;
  END IF;

  RETURN v_result || jsonb_build_object('idempotent', false);
END;
$$;

REVOKE ALL ON FUNCTION public.process_financial_obligation_payment_guarded(uuid, text, date, timestamptz)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.process_financial_obligation_payment_guarded(uuid, text, date, timestamptz)
  TO service_role;

CREATE OR REPLACE FUNCTION public.process_financial_obligation_payment(
  p_schedule_id uuid,
  p_idempotency_key text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  IF auth.role() <> 'service_role' THEN
    RAISE EXCEPTION 'service role required' USING ERRCODE = '42501';
  END IF;
  RETURN public.process_financial_obligation_payment_guarded(
    p_schedule_id, p_idempotency_key, CURRENT_DATE, timezone('utc', now())
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.retry_my_financial_obligation_payment(
  p_schedule_id uuid,
  p_idempotency_key text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_profile_id uuid := public.current_player_profile_id();
BEGIN
  IF v_profile_id IS NULL THEN RAISE EXCEPTION 'profile required'; END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.financial_obligation_schedule s
    JOIN public.financial_obligations o ON o.id = s.obligation_id
    WHERE s.id = p_schedule_id
      AND o.owner_type = 'player'
      AND o.owner_id = v_profile_id
  ) THEN
    RAISE EXCEPTION 'schedule not found or not owned by current player' USING ERRCODE = '42501';
  END IF;

  RETURN public.process_financial_obligation_payment_guarded(
    p_schedule_id, p_idempotency_key, CURRENT_DATE, timezone('utc', now())
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.process_due_financial_obligations(
  p_as_of_date date DEFAULT CURRENT_DATE,
  p_limit integer DEFAULT 100
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  r record;
  v_result jsonb;
  v_as_of_timestamp timestamptz;
  v_attempted integer := 0;
  v_posted integer := 0;
  v_failed integer := 0;
  v_skipped integer := 0;
  v_errored integer := 0;
  v_details jsonb := '[]'::jsonb;
BEGIN
  IF auth.role() <> 'service_role' THEN
    RAISE EXCEPTION 'service role required' USING ERRCODE = '42501';
  END IF;

  v_as_of_timestamp := CASE
    WHEN p_as_of_date = CURRENT_DATE THEN timezone('utc', now())
    ELSE p_as_of_date::timestamptz + interval '23 hours 59 minutes 59 seconds'
  END;

  FOR r IN
    SELECT s.id, count(a.id) AS attempt_count, o.max_attempts
    FROM public.financial_obligation_schedule s
    JOIN public.financial_obligations o ON o.id = s.obligation_id
    LEFT JOIN public.financial_obligation_attempts a ON a.schedule_id = s.id
    WHERE o.status IN ('active', 'grace_period', 'retrying', 'failed')
      AND s.status IN ('scheduled', 'due', 'missed', 'failed')
      AND s.due_date <= p_as_of_date
      AND (s.next_retry_at IS NULL OR s.next_retry_at <= v_as_of_timestamp)
      AND NOT EXISTS (
        SELECT 1 FROM public.debt_records d
        WHERE d.schedule_id = s.id
          AND d.status = 'open'
          AND d.collection_stage IN ('collections', 'legal_action', 'asset_recovery')
      )
    GROUP BY s.id, o.max_attempts, s.due_date
    HAVING count(a.id) < o.max_attempts
    ORDER BY s.due_date
    LIMIT p_limit
    FOR UPDATE OF s SKIP LOCKED
  LOOP
    v_attempted := v_attempted + 1;
    BEGIN
      v_result := public.process_financial_obligation_payment_guarded(
        r.id,
        'obligation-auto-' || r.id || '-' || to_char(v_as_of_timestamp, 'YYYYMMDDHH24MI'),
        p_as_of_date,
        v_as_of_timestamp
      );

      IF v_result->>'status' IN ('posted', 'already_paid') THEN
        v_posted := v_posted + 1;
      ELSIF v_result->>'status' IN ('retry_not_due', 'already_attempted') THEN
        v_skipped := v_skipped + 1;
      ELSE
        v_failed := v_failed + 1;
      END IF;

      v_details := v_details || jsonb_build_array(jsonb_build_object('scheduleId', r.id, 'result', v_result));
    EXCEPTION WHEN OTHERS THEN
      v_errored := v_errored + 1;
      INSERT INTO public.financial_obligation_events(event_type, event_payload)
      VALUES ('admin_adjusted', jsonb_build_object('schedule_id', r.id, 'error', SQLERRM, 'as_of_date', p_as_of_date));
    END;
  END LOOP;

  RETURN jsonb_build_object(
    'attempted', v_attempted,
    'posted', v_posted,
    'failed', v_failed,
    'skipped', v_skipped,
    'errored', v_errored,
    'details', v_details
  );
END;
$$;

REVOKE ALL ON FUNCTION public.process_due_financial_obligations(date, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.process_due_financial_obligations(date, integer) TO service_role;

-- Reconcile outstanding obligation balances from schedule/debt state rather than
-- incrementing counters during retries.
CREATE OR REPLACE FUNCTION public.reconcile_financial_obligation_state(
  p_obligation_id uuid,
  p_as_of_date date DEFAULT CURRENT_DATE
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_outstanding bigint;
  v_missed integer;
  v_next_due date;
  v_new_status public.financial_obligation_status;
BEGIN
  SELECT
    COALESCE(sum(
      CASE
        WHEN s.status IN ('missed', 'failed') OR (s.status IN ('scheduled', 'due') AND s.due_date <= p_as_of_date)
          THEN GREATEST(s.amount_minor, COALESCE(d.outstanding_balance_minor, 0))
        ELSE 0
      END
    ), 0),
    count(*) FILTER (WHERE s.first_missed_at IS NOT NULL AND s.resolved_at IS NULL),
    min(s.due_date) FILTER (WHERE s.status IN ('scheduled', 'due', 'missed', 'failed'))
  INTO v_outstanding, v_missed, v_next_due
  FROM public.financial_obligation_schedule s
  LEFT JOIN public.debt_records d
    ON d.schedule_id = s.id AND d.status = 'open'
  WHERE s.obligation_id = p_obligation_id;

  IF EXISTS (
    SELECT 1 FROM public.debt_records
    WHERE obligation_id = p_obligation_id
      AND status = 'open'
      AND collection_stage IN ('collections', 'legal_action', 'asset_recovery')
  ) THEN
    v_new_status := 'collections';
  ELSIF v_next_due IS NULL THEN
    v_new_status := 'completed';
  ELSIF EXISTS (
    SELECT 1 FROM public.financial_obligation_schedule
    WHERE obligation_id = p_obligation_id
      AND next_retry_at IS NOT NULL
      AND next_retry_at > timezone('utc', now())
      AND resolved_at IS NULL
  ) THEN
    v_new_status := 'retrying';
  ELSIF v_outstanding > 0 THEN
    v_new_status := 'failed';
  ELSE
    v_new_status := 'active';
  END IF;

  UPDATE public.financial_obligations
  SET outstanding_balance_minor = v_outstanding,
      missed_payment_count = v_missed,
      next_due_date = COALESCE(v_next_due, next_due_date),
      status = CASE WHEN status IN ('paused', 'cancelled', 'written_off') THEN status ELSE v_new_status END,
      updated_at = timezone('utc', now()),
      completed_at = CASE WHEN v_new_status = 'completed' THEN COALESCE(completed_at, timezone('utc', now())) ELSE completed_at END
  WHERE id = p_obligation_id;

  RETURN jsonb_build_object(
    'outstandingBalanceMinor', v_outstanding,
    'missedPaymentCount', v_missed,
    'nextDueDate', v_next_due,
    'status', v_new_status
  );
END;
$$;

-- ---------------------------------------------------------------------------
-- Mortgage schedule-version synchronisation
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.sync_mortgage_financial_obligation_schedule(
  p_mortgage_contract_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_obligation_id uuid;
  v_current_version integer;
  v_grace_days integer := 0;
  v_synced integer := 0;
  v_cancelled integer := 0;
  r record;
BEGIN
  SELECT COALESCE(c.financial_obligation_id, o.id)
    INTO v_obligation_id
  FROM public.mortgage_contracts c
  LEFT JOIN public.financial_obligations o
    ON o.linked_asset_type = 'mortgage_contract'
   AND o.linked_asset_id = c.id
  WHERE c.id = p_mortgage_contract_id;

  IF v_obligation_id IS NULL THEN
    RETURN jsonb_build_object('status', 'obligation_not_created');
  END IF;

  SELECT COALESCE(max(schedule_version), 1)
    INTO v_current_version
  FROM public.mortgage_schedule_lines
  WHERE mortgage_contract_id = p_mortgage_contract_id;

  SELECT grace_period_days INTO v_grace_days
  FROM public.financial_obligations
  WHERE id = v_obligation_id;

  FOR r IN
    SELECT *
    FROM public.mortgage_schedule_lines
    WHERE mortgage_contract_id = p_mortgage_contract_id
      AND schedule_version = v_current_version
    ORDER BY instalment_number
  LOOP
    INSERT INTO public.financial_obligation_schedule (
      obligation_id, instalment_number, due_date, grace_expires_at,
      amount_minor, principal_minor, interest_minor, fees_minor,
      status, source_schedule_type, source_schedule_id, source_schedule_version,
      business_key, idempotency_key, transaction_id, paid_at, resolved_at, next_retry_at
    ) VALUES (
      v_obligation_id,
      r.instalment_number,
      r.due_date,
      r.due_date + COALESCE(v_grace_days, 0),
      r.total_due_minor,
      r.principal_due_minor,
      r.interest_due_minor,
      r.fees_due_minor,
      CASE WHEN r.status = 'paid' THEN 'paid' WHEN r.status = 'cancelled' THEN 'cancelled' ELSE 'scheduled' END,
      'mortgage_schedule_line',
      r.id,
      v_current_version,
      concat_ws(':', v_obligation_id::text, 'mortgage_schedule_line', r.id::text, v_current_version::text),
      concat_ws(':', 'mortgage', p_mortgage_contract_id::text, v_current_version::text, r.instalment_number::text),
      r.payment_transaction_id,
      CASE WHEN r.status = 'paid' THEN timezone('utc', now()) ELSE NULL END,
      CASE WHEN r.status IN ('paid', 'cancelled') THEN timezone('utc', now()) ELSE NULL END,
      NULL
    )
    ON CONFLICT (obligation_id, instalment_number) DO UPDATE SET
      due_date = EXCLUDED.due_date,
      grace_expires_at = EXCLUDED.grace_expires_at,
      amount_minor = EXCLUDED.amount_minor,
      principal_minor = EXCLUDED.principal_minor,
      interest_minor = EXCLUDED.interest_minor,
      fees_minor = EXCLUDED.fees_minor,
      status = EXCLUDED.status,
      source_schedule_type = EXCLUDED.source_schedule_type,
      source_schedule_id = EXCLUDED.source_schedule_id,
      source_schedule_version = EXCLUDED.source_schedule_version,
      business_key = EXCLUDED.business_key,
      idempotency_key = EXCLUDED.idempotency_key,
      transaction_id = EXCLUDED.transaction_id,
      paid_at = EXCLUDED.paid_at,
      resolved_at = EXCLUDED.resolved_at,
      next_retry_at = NULL;
    v_synced := v_synced + 1;
  END LOOP;

  UPDATE public.financial_obligation_schedule s
  SET status = 'cancelled',
      resolved_at = COALESCE(resolved_at, timezone('utc', now())),
      next_retry_at = NULL
  WHERE s.obligation_id = v_obligation_id
    AND s.source_schedule_type = 'mortgage_schedule_line'
    AND NOT EXISTS (
      SELECT 1
      FROM public.mortgage_schedule_lines m
      WHERE m.mortgage_contract_id = p_mortgage_contract_id
        AND m.schedule_version = v_current_version
        AND m.instalment_number = s.instalment_number
    )
    AND s.status <> 'paid';
  GET DIAGNOSTICS v_cancelled = ROW_COUNT;

  UPDATE public.mortgage_contracts
  SET financial_obligation_id = v_obligation_id
  WHERE id = p_mortgage_contract_id
    AND financial_obligation_id IS DISTINCT FROM v_obligation_id;

  PERFORM public.reconcile_financial_obligation_state(v_obligation_id, CURRENT_DATE);

  RETURN jsonb_build_object(
    'status', 'synced',
    'obligationId', v_obligation_id,
    'scheduleVersion', v_current_version,
    'syncedRows', v_synced,
    'cancelledRows', v_cancelled
  );
END;
$$;

REVOKE ALL ON FUNCTION public.sync_mortgage_financial_obligation_schedule(uuid)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.sync_mortgage_financial_obligation_schedule(uuid) TO service_role;

CREATE OR REPLACE FUNCTION public._sync_mortgage_obligation_schedule_trigger()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_contract_id uuid;
BEGIN
  v_contract_id := COALESCE(NEW.mortgage_contract_id, OLD.mortgage_contract_id);
  PERFORM public.sync_mortgage_financial_obligation_schedule(v_contract_id);
  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS mortgage_schedule_sync_financial_obligation ON public.mortgage_schedule_lines;
CREATE TRIGGER mortgage_schedule_sync_financial_obligation
AFTER INSERT OR UPDATE OR DELETE ON public.mortgage_schedule_lines
FOR EACH ROW EXECUTE FUNCTION public._sync_mortgage_obligation_schedule_trigger();

-- Backfill/synchronise existing active mortgage obligations after the trigger repair.
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT DISTINCT linked_asset_id AS mortgage_contract_id
    FROM public.financial_obligations
    WHERE obligation_type = 'mortgage'
      AND linked_asset_type = 'mortgage_contract'
      AND linked_asset_id IS NOT NULL
  LOOP
    PERFORM public.sync_mortgage_financial_obligation_schedule(r.mortgage_contract_id);
  END LOOP;
END;
$$;

COMMIT;
