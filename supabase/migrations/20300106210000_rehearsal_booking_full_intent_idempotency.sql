-- #4031: recovery of an existing rehearsal booking must require the exact
-- payer, active character, room, duration, slot, song and setlist.
-- Failed mismatched retries must never return another character's payment.
BEGIN;
CREATE OR REPLACE FUNCTION public.confirm_rehearsal_booking_atomic(
  p_band_id uuid,
  p_room_id uuid,
  p_duration_hours integer,
  p_song_id uuid,
  p_setlist_id uuid,
  p_scheduled_start timestamptz,
  p_payment_source text,
  p_idempotency_key text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_profile_id uuid;
  v_room public.rehearsal_rooms;
  v_scheduled_end timestamptz;
  v_total_cost integer;
  v_chemistry_gain integer;
  v_xp_earned integer;
  v_familiarity_gain integer;
  v_rehearsal_id uuid;
  v_existing public.band_rehearsals;
  v_payment jsonb;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  IF p_idempotency_key IS NULL OR length(trim(p_idempotency_key)) < 8 THEN
    RAISE EXCEPTION 'invalid_idempotency_key';
  END IF;

  v_profile_id := public._caller_profile_id();
  IF v_profile_id IS NULL THEN
    RAISE EXCEPTION 'active_profile_required';
  END IF;

  IF NOT public._band_active_member(p_band_id, v_profile_id) THEN
    RAISE EXCEPTION 'not_band_member';
  END IF;

  SELECT *
    INTO v_existing
    FROM public.band_rehearsals r
   WHERE r.funding_idempotency_key = p_idempotency_key;

  IF v_existing.id IS NOT NULL THEN
    -- Idempotency recovery is allowed only for the same full booking intent.
    -- Never replay another character's paid booking or substitute a payer/song.
    IF v_existing.band_id IS DISTINCT FROM p_band_id
      OR v_existing.rehearsal_room_id IS DISTINCT FROM p_room_id
      OR v_existing.duration_hours IS DISTINCT FROM p_duration_hours
      OR v_existing.selected_song_id IS DISTINCT FROM p_song_id
      OR v_existing.setlist_id IS DISTINCT FROM p_setlist_id
      OR v_existing.scheduled_start IS DISTINCT FROM p_scheduled_start
      OR v_existing.payment_source IS DISTINCT FROM p_payment_source
      OR v_existing.payment_profile_id IS DISTINCT FROM v_profile_id THEN
      RAISE EXCEPTION 'idempotency_key_conflict' USING ERRCODE='23505';
    END IF;
    RETURN jsonb_build_object(
      'idempotent', true,
      'bookingId', v_existing.id,
      'totalCost', v_existing.total_cost,
      'paymentSource', v_existing.payment_source,
      'chemistryGain', v_existing.chemistry_gain,
      'xpEarned', v_existing.xp_earned,
      'familiarityGained', v_existing.familiarity_gained
    );
  END IF;

  IF p_duration_hours NOT IN (2, 4, 6, 8) THEN
    RAISE EXCEPTION 'invalid_rehearsal_duration';
  END IF;

  IF p_scheduled_start IS NULL OR p_scheduled_start <= now() THEN
    RAISE EXCEPTION 'rehearsal_must_be_in_future';
  END IF;

  -- Serialize bookings for the band and the room so concurrent browser calls
  -- cannot both pass the overlap checks.
  PERFORM b.id FROM public.bands b WHERE b.id = p_band_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'band_not_found';
  END IF;

  SELECT rr.*
    INTO v_room
    FROM public.rehearsal_rooms rr
   WHERE rr.id = p_room_id
   FOR UPDATE;

  IF v_room.id IS NULL THEN
    RAISE EXCEPTION 'rehearsal_room_not_found';
  END IF;

  v_scheduled_end := p_scheduled_start + make_interval(hours => p_duration_hours);

  IF EXISTS (
    SELECT 1
      FROM public.band_rehearsals r
     WHERE r.rehearsal_room_id = p_room_id
       AND r.status IN ('scheduled', 'in_progress')
       AND r.scheduled_start < v_scheduled_end
       AND r.scheduled_end > p_scheduled_start
  ) THEN
    RAISE EXCEPTION 'rehearsal_room_unavailable';
  END IF;

  IF EXISTS (
    SELECT 1
      FROM public.band_rehearsals r
     WHERE r.band_id = p_band_id
       AND r.status IN ('scheduled', 'in_progress')
       AND r.scheduled_start < v_scheduled_end
       AND r.scheduled_end > p_scheduled_start
  ) OR EXISTS (
    SELECT 1
      FROM public.recording_sessions s
     WHERE s.band_id = p_band_id
       AND s.status IN ('scheduled', 'in_progress')
       AND s.scheduled_start < v_scheduled_end
       AND s.scheduled_end > p_scheduled_start
  ) THEN
    RAISE EXCEPTION 'band_unavailable';
  END IF;

  v_total_cost := GREATEST(0, COALESCE(v_room.hourly_rate, 0) * p_duration_hours);
  v_chemistry_gain := floor(
    (COALESCE(v_room.quality_rating, 0)::numeric / 10) * p_duration_hours
  )::integer;
  v_xp_earned := floor(
    75 * p_duration_hours * (COALESCE(v_room.equipment_quality, 0)::numeric / 100)
  )::integer;
  v_familiarity_gain := p_duration_hours * 60;

  v_payment := public._debit_atomic_booking_payment(
    p_band_id,
    v_profile_id,
    p_payment_source,
    v_total_cost::bigint * 100,
    'rehearsal_payment',
    p_idempotency_key,
    'Rehearsal booking: ' || v_room.name
  );

  INSERT INTO public.band_rehearsals (
    band_id,
    rehearsal_room_id,
    duration_hours,
    scheduled_start,
    scheduled_end,
    status,
    total_cost,
    chemistry_gain,
    xp_earned,
    selected_song_id,
    familiarity_gained,
    setlist_id,
    payment_source,
    payment_profile_id,
    funding_idempotency_key
  ) VALUES (
    p_band_id,
    p_room_id,
    p_duration_hours,
    p_scheduled_start,
    v_scheduled_end,
    'scheduled',
    v_total_cost,
    v_chemistry_gain,
    v_xp_earned,
    p_song_id,
    v_familiarity_gain,
    p_setlist_id,
    p_payment_source,
    v_profile_id,
    p_idempotency_key
  )
  RETURNING id INTO v_rehearsal_id;

  INSERT INTO public.booking_payments (
    booking_type,
    booking_id,
    band_id,
    profile_id,
    payment_source,
    amount_minor,
    currency_code,
    idempotency_key,
    payer_balance_after_minor
  ) VALUES (
    'rehearsal',
    v_rehearsal_id,
    p_band_id,
    v_profile_id,
    p_payment_source,
    v_total_cost::bigint * 100,
    COALESCE(v_payment->>'currencyCode', 'USD'),
    p_idempotency_key,
    COALESCE((v_payment->>'payerBalanceAfterMinor')::bigint, 0)
  );

  INSERT INTO public.rehearsal_room_transactions (
    room_id,
    transaction_type,
    amount,
    description,
    reference_id
  ) VALUES (
    p_room_id,
    'booking_revenue',
    v_total_cost,
    'Rehearsal booking',
    v_rehearsal_id
  );

  RETURN jsonb_build_object(
    'idempotent', false,
    'bookingId', v_rehearsal_id,
    'totalCost', v_total_cost,
    'paymentSource', p_payment_source,
    'payerBalanceAfterMinor', v_payment->'payerBalanceAfterMinor',
    'chemistryGain', v_chemistry_gain,
    'xpEarned', v_xp_earned,
    'familiarityGained', v_familiarity_gain
  );
END;
$$;
REVOKE ALL ON FUNCTION public.confirm_rehearsal_booking_atomic(
  uuid, uuid, integer, uuid, uuid, timestamptz, text, text
) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.confirm_rehearsal_booking_atomic(
  uuid, uuid, integer, uuid, uuid, timestamptz, text, text
) TO authenticated;
COMMIT;
