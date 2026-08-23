-- Finance backlog A1: atomic rehearsal and recording bookings.
--
-- Production has the `band_treasuries` model but not the later
-- `financial_accounts` Phase 8B schema. This migration therefore targets the
-- live treasury/wallet model and removes the split browser-side payment + booking
-- sequence for rehearsals and recording sessions.

BEGIN;

-- ---------------------------------------------------------------------------
-- Payment audit / future refund anchor
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.booking_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_type text NOT NULL CHECK (booking_type IN ('rehearsal', 'recording')),
  booking_id uuid NOT NULL,
  band_id uuid NULL,
  profile_id uuid NOT NULL,
  payment_source text NOT NULL CHECK (payment_source IN ('band', 'personal')),
  amount_minor bigint NOT NULL CHECK (amount_minor >= 0),
  currency_code text NOT NULL DEFAULT 'USD',
  idempotency_key text NOT NULL UNIQUE,
  payer_balance_after_minor bigint NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (booking_type, booking_id)
);

ALTER TABLE public.booking_payments ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.booking_payments FROM anon, authenticated;

ALTER TABLE public.band_rehearsals
  ADD COLUMN IF NOT EXISTS payment_source text,
  ADD COLUMN IF NOT EXISTS payment_profile_id uuid,
  ADD COLUMN IF NOT EXISTS funding_idempotency_key text;

ALTER TABLE public.recording_sessions
  ADD COLUMN IF NOT EXISTS payment_source text,
  ADD COLUMN IF NOT EXISTS payment_profile_id uuid,
  ADD COLUMN IF NOT EXISTS funding_idempotency_key text;

CREATE UNIQUE INDEX IF NOT EXISTS band_rehearsals_funding_idempotency_key_uq
  ON public.band_rehearsals (funding_idempotency_key)
  WHERE funding_idempotency_key IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS recording_sessions_funding_idempotency_key_uq
  ON public.recording_sessions (funding_idempotency_key)
  WHERE funding_idempotency_key IS NOT NULL;

-- Bands created before the treasury rollout may only have the compatibility
-- mirror. Seed only missing treasuries; existing treasury balances are never
-- overwritten.
INSERT INTO public.band_treasuries (
  band_id,
  currency_code,
  balance_minor,
  reserved_balance_minor,
  is_primary
)
SELECT
  b.id,
  'USD',
  GREATEST(COALESCE(b.band_balance, 0), 0)::bigint * 100,
  0,
  true
FROM public.bands b
WHERE NOT EXISTS (
  SELECT 1
  FROM public.band_treasuries t
  WHERE t.band_id = b.id
);

-- ---------------------------------------------------------------------------
-- Internal atomic debit helper
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public._debit_atomic_booking_payment(
  p_band_id uuid,
  p_profile_id uuid,
  p_payment_source text,
  p_amount_minor bigint,
  p_category text,
  p_idempotency_key text,
  p_note text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_treasury public.band_treasuries;
  v_balance_after_minor bigint;
  v_currency text := 'USD';
  v_cash bigint;
BEGIN
  IF p_payment_source IS NULL OR p_payment_source NOT IN ('band', 'personal') THEN
    RAISE EXCEPTION 'invalid_payment_source';
  END IF;

  IF p_amount_minor IS NULL OR p_amount_minor < 0 THEN
    RAISE EXCEPTION 'invalid_payment_amount';
  END IF;

  IF p_amount_minor % 100 <> 0 THEN
    RAISE EXCEPTION 'booking_cost_must_use_whole_currency_units';
  END IF;

  IF p_payment_source = 'band' THEN
    IF p_band_id IS NULL THEN
      RAISE EXCEPTION 'band_payment_requires_band';
    END IF;

    SELECT t.*
      INTO v_treasury
      FROM public.band_treasuries t
     WHERE t.band_id = p_band_id
     ORDER BY t.is_primary DESC, t.created_at ASC
     LIMIT 1
     FOR UPDATE;

    IF v_treasury.id IS NULL THEN
      RAISE EXCEPTION 'band_treasury_missing';
    END IF;

    v_currency := v_treasury.currency_code;

    IF (v_treasury.balance_minor - v_treasury.reserved_balance_minor) < p_amount_minor THEN
      RAISE EXCEPTION 'insufficient_band_funds';
    END IF;

    IF p_amount_minor = 0 THEN
      v_balance_after_minor := v_treasury.balance_minor;
    ELSE
      UPDATE public.band_treasuries
         SET balance_minor = balance_minor - p_amount_minor,
             updated_at = now()
       WHERE id = v_treasury.id
       RETURNING balance_minor INTO v_balance_after_minor;

      INSERT INTO public.band_treasury_transactions (
        band_id,
        treasury_id,
        profile_id,
        direction,
        amount_minor,
        currency_code,
        source_kind,
        category,
        note,
        idempotency_key,
        balance_after_minor
      ) VALUES (
        p_band_id,
        v_treasury.id,
        p_profile_id,
        'debit',
        p_amount_minor,
        v_currency,
        'booking',
        p_category,
        p_note,
        p_idempotency_key || ':treasury',
        v_balance_after_minor
      );
    END IF;

    -- Compatibility mirror only. New booking authority reads the treasury.
    IF v_treasury.is_primary THEN
      UPDATE public.bands
         SET band_balance = (v_balance_after_minor / 100)::integer
       WHERE id = p_band_id;
    END IF;
  ELSE
    SELECT COALESCE(p.cash, 0)
      INTO v_cash
      FROM public.profiles p
     WHERE p.id = p_profile_id
       AND p.user_id = auth.uid()
     FOR UPDATE;

    IF v_cash IS NULL THEN
      RAISE EXCEPTION 'profile_not_available';
    END IF;

    IF (v_cash * 100) < p_amount_minor THEN
      RAISE EXCEPTION 'insufficient_personal_funds';
    END IF;

    IF p_amount_minor = 0 THEN
      v_balance_after_minor := v_cash * 100;
    ELSE
      UPDATE public.profiles
         SET cash = cash - (p_amount_minor / 100)
       WHERE id = p_profile_id
       RETURNING cash * 100 INTO v_balance_after_minor;
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'paymentSource', p_payment_source,
    'amountMinor', p_amount_minor,
    'currencyCode', v_currency,
    'payerBalanceAfterMinor', v_balance_after_minor
  );
END;
$$;

REVOKE ALL ON FUNCTION public._debit_atomic_booking_payment(uuid, uuid, text, bigint, text, text, text)
  FROM PUBLIC, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Rehearsal booking authority
-- ---------------------------------------------------------------------------

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
) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.confirm_rehearsal_booking_atomic(
  uuid, uuid, integer, uuid, uuid, timestamptz, text, text
) TO authenticated;

-- ---------------------------------------------------------------------------
-- Recording booking authority
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.confirm_recording_session_atomic(
  p_band_id uuid,
  p_studio_id uuid,
  p_producer_id text,
  p_song_id uuid,
  p_duration_hours integer,
  p_orchestra_size text,
  p_recording_version text,
  p_recording_type text,
  p_rehearsal_bonus integer,
  p_scheduled_start timestamptz,
  p_scheduled_end timestamptz,
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
  v_studio public.city_studios;
  v_producer_id uuid;
  v_producer_cost_per_hour integer := 0;
  v_producer_quality_bonus integer := -10;
  v_song_quality integer := 0;
  v_studio_cost integer := 0;
  v_producer_cost integer := 0;
  v_orchestra_cost integer := 0;
  v_orchestra_bonus integer := 0;
  v_orchestra_musicians integer := 0;
  v_total_cost integer := 0;
  v_label_owned boolean := false;
  v_raw_quality numeric;
  v_final_quality integer;
  v_quality_improvement integer;
  v_duration_multiplier numeric := 1;
  v_recording_id uuid;
  v_existing public.recording_sessions;
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

  IF p_band_id IS NOT NULL AND NOT public._band_active_member(p_band_id, v_profile_id) THEN
    RAISE EXCEPTION 'not_band_member';
  END IF;

  IF p_band_id IS NULL AND p_payment_source = 'band' THEN
    RAISE EXCEPTION 'band_payment_requires_band';
  END IF;

  SELECT *
    INTO v_existing
    FROM public.recording_sessions s
   WHERE s.funding_idempotency_key = p_idempotency_key;

  IF v_existing.id IS NOT NULL THEN
    RETURN jsonb_build_object(
      'idempotent', true,
      'bookingId', v_existing.id,
      'totalCost', v_existing.total_cost,
      'paymentSource', v_existing.payment_source,
      'qualityImprovement', v_existing.quality_improvement
    );
  END IF;

  IF p_duration_hours NOT IN (4, 8) THEN
    RAISE EXCEPTION 'invalid_recording_duration';
  END IF;

  IF p_recording_type IS NULL OR p_recording_type NOT IN ('demo', 'professional') THEN
    RAISE EXCEPTION 'invalid_recording_type';
  END IF;

  IF p_recording_version IS NOT NULL
     AND p_recording_version <> ''
     AND p_recording_version NOT IN ('standard', 'remix', 'acoustic') THEN
    RAISE EXCEPTION 'invalid_recording_version';
  END IF;

  IF p_scheduled_start IS NULL OR p_scheduled_start <= now() THEN
    RAISE EXCEPTION 'recording_must_be_in_future';
  END IF;

  IF p_scheduled_end IS NULL OR p_scheduled_end <= p_scheduled_start THEN
    RAISE EXCEPTION 'invalid_recording_window';
  END IF;

  IF abs(
    extract(epoch FROM (p_scheduled_end - p_scheduled_start))
    - (p_duration_hours * 3600)
  ) > 120 THEN
    RAISE EXCEPTION 'recording_window_duration_mismatch';
  END IF;

  IF p_band_id IS NOT NULL THEN
    PERFORM b.id FROM public.bands b WHERE b.id = p_band_id FOR UPDATE;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'band_not_found';
    END IF;
  END IF;

  SELECT s.*
    INTO v_studio
    FROM public.city_studios s
   WHERE s.id = p_studio_id
   FOR UPDATE;

  IF v_studio.id IS NULL THEN
    RAISE EXCEPTION 'recording_studio_not_found';
  END IF;

  IF EXISTS (
    SELECT 1
      FROM public.recording_sessions s
     WHERE s.studio_id = p_studio_id
       AND s.status IN ('scheduled', 'in_progress')
       AND s.scheduled_start < p_scheduled_end
       AND s.scheduled_end > p_scheduled_start
  ) THEN
    RAISE EXCEPTION 'recording_studio_unavailable';
  END IF;

  IF p_band_id IS NOT NULL AND (
    EXISTS (
      SELECT 1
        FROM public.recording_sessions s
       WHERE s.band_id = p_band_id
         AND s.status IN ('scheduled', 'in_progress')
         AND s.scheduled_start < p_scheduled_end
         AND s.scheduled_end > p_scheduled_start
    )
    OR EXISTS (
      SELECT 1
        FROM public.band_rehearsals r
       WHERE r.band_id = p_band_id
         AND r.status IN ('scheduled', 'in_progress')
         AND r.scheduled_start < p_scheduled_end
         AND r.scheduled_end > p_scheduled_start
    )
  ) THEN
    RAISE EXCEPTION 'band_unavailable';
  END IF;

  SELECT COALESCE(s.quality_score, 0)
    INTO v_song_quality
    FROM public.songs s
   WHERE s.id = p_song_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'song_not_found';
  END IF;

  IF p_producer_id IS NOT NULL
     AND p_producer_id <> ''
     AND p_producer_id <> 'self-produce' THEN
    BEGIN
      v_producer_id := p_producer_id::uuid;
    EXCEPTION WHEN invalid_text_representation THEN
      RAISE EXCEPTION 'invalid_producer';
    END;

    SELECT rp.cost_per_hour, rp.quality_bonus
      INTO v_producer_cost_per_hour, v_producer_quality_bonus
      FROM public.recording_producers rp
     WHERE rp.id = v_producer_id
       AND rp.is_available = true;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'producer_not_available';
    END IF;
  END IF;

  IF p_orchestra_size IS NULL OR p_orchestra_size = '' THEN
    NULL;
  ELSIF p_orchestra_size = 'chamber' THEN
    v_orchestra_cost := 1500;
    v_orchestra_bonus := 10;
    v_orchestra_musicians := 15;
  ELSIF p_orchestra_size = 'small' THEN
    v_orchestra_cost := 4000;
    v_orchestra_bonus := 17;
    v_orchestra_musicians := 30;
  ELSIF p_orchestra_size = 'full' THEN
    v_orchestra_cost := 12000;
    v_orchestra_bonus := 25;
    v_orchestra_musicians := 80;
  ELSE
    RAISE EXCEPTION 'invalid_orchestra_size';
  END IF;

  -- A studio owned by the artist's active label is free, matching the visible
  -- booking UI. Producer/orchestra costs remain chargeable.
  IF v_studio.company_id IS NOT NULL THEN
    v_label_owned := EXISTS (
      SELECT 1
        FROM public.artist_label_contracts alc
        JOIN public.labels l ON l.id = alc.label_id
       WHERE alc.status = 'active'
         AND l.company_id = v_studio.company_id
         AND (
           (p_band_id IS NOT NULL AND alc.band_id = p_band_id)
           OR (p_band_id IS NULL AND alc.artist_profile_id = v_profile_id)
         )
    );
  END IF;

  IF NOT v_label_owned THEN
    v_studio_cost := round(
      COALESCE(v_studio.hourly_rate, 0)::numeric
      * p_duration_hours
      * CASE WHEN p_recording_type = 'professional' THEN 2.5 ELSE 1 END
    )::integer;
  END IF;

  v_producer_cost := COALESCE(v_producer_cost_per_hour, 0) * p_duration_hours;
  v_total_cost := GREATEST(0, v_studio_cost + v_producer_cost + v_orchestra_cost);

  -- Preserve the existing booking-time quality calculation, but calculate it on
  -- the server rather than trusting a browser-created session row.
  IF p_duration_hours = 4 THEN
    v_duration_multiplier := 1.05;
  END IF;

  v_raw_quality :=
      v_song_quality
      * (1 + (COALESCE(v_studio.quality_rating, 0)::numeric / 100) * 0.2)
      * (1 + (v_producer_quality_bonus::numeric / 100))
      * v_duration_multiplier
      * CASE
          WHEN v_orchestra_bonus > 0 THEN 1 + v_orchestra_bonus::numeric / 100
          ELSE 1
        END
      * CASE
          WHEN COALESCE(p_rehearsal_bonus, 0) <> 0
            THEN 1 + GREATEST(-20, LEAST(10, p_rehearsal_bonus))::numeric / 100
          ELSE 1
        END;

  IF v_raw_quality <= 600 THEN
    v_final_quality := round(v_raw_quality)::integer;
  ELSE
    v_final_quality := round(
      600 + ((v_raw_quality - 600) * 600) / v_raw_quality
    )::integer;
  END IF;

  v_final_quality := GREATEST(0, LEAST(1000, v_final_quality));
  v_quality_improvement := v_final_quality - v_song_quality;

  v_payment := public._debit_atomic_booking_payment(
    p_band_id,
    v_profile_id,
    p_payment_source,
    v_total_cost::bigint * 100,
    'recording_studio_payment',
    p_idempotency_key,
    'Recording session booking'
  );

  INSERT INTO public.recording_sessions (
    user_id,
    profile_id,
    band_id,
    studio_id,
    producer_id,
    song_id,
    duration_hours,
    total_cost,
    quality_improvement,
    status,
    scheduled_start,
    scheduled_end,
    recording_version,
    recording_type,
    city_id,
    session_data,
    payment_source,
    payment_profile_id,
    funding_idempotency_key
  ) VALUES (
    auth.uid(),
    v_profile_id,
    p_band_id,
    p_studio_id,
    v_producer_id,
    p_song_id,
    p_duration_hours,
    v_total_cost,
    v_quality_improvement,
    'scheduled',
    p_scheduled_start,
    p_scheduled_end,
    NULLIF(p_recording_version, ''),
    p_recording_type,
    v_studio.city_id,
    jsonb_build_object(
      'payment_source', p_payment_source,
      'label_studio_free', v_label_owned,
      'pricing', jsonb_build_object(
        'studio_cost', v_studio_cost,
        'producer_cost', v_producer_cost,
        'orchestra_cost', v_orchestra_cost
      )
    ),
    p_payment_source,
    v_profile_id,
    p_idempotency_key
  )
  RETURNING id INTO v_recording_id;

  IF v_orchestra_musicians > 0 THEN
    INSERT INTO public.orchestra_bookings (
      session_id,
      orchestra_type,
      musician_count,
      cost,
      quality_bonus
    ) VALUES (
      v_recording_id,
      p_orchestra_size,
      v_orchestra_musicians,
      v_orchestra_cost,
      v_orchestra_bonus
    );
  END IF;

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
    'recording',
    v_recording_id,
    p_band_id,
    v_profile_id,
    p_payment_source,
    v_total_cost::bigint * 100,
    COALESCE(v_payment->>'currencyCode', 'USD'),
    p_idempotency_key,
    COALESCE((v_payment->>'payerBalanceAfterMinor')::bigint, 0)
  );

  INSERT INTO public.recording_studio_transactions (
    studio_id,
    transaction_type,
    amount,
    description,
    reference_id
  ) VALUES (
    p_studio_id,
    'session_revenue',
    v_studio_cost,
    'Recording session booking',
    v_recording_id
  );

  RETURN jsonb_build_object(
    'idempotent', false,
    'bookingId', v_recording_id,
    'totalCost', v_total_cost,
    'studioCost', v_studio_cost,
    'producerCost', v_producer_cost,
    'orchestraCost', v_orchestra_cost,
    'paymentSource', p_payment_source,
    'payerBalanceAfterMinor', v_payment->'payerBalanceAfterMinor',
    'qualityImprovement', v_quality_improvement,
    'labelStudioFree', v_label_owned
  );
END;
$$;

REVOKE ALL ON FUNCTION public.confirm_recording_session_atomic(
  uuid, uuid, text, uuid, integer, text, text, text, integer,
  timestamptz, timestamptz, text, text
) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.confirm_recording_session_atomic(
  uuid, uuid, text, uuid, integer, text, text, text, integer,
  timestamptz, timestamptz, text, text
) TO authenticated;

COMMIT;
