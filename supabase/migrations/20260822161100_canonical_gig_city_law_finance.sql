-- Finalise City Hall gig-law enforcement on the canonical finance ledger.
-- The preceding migration establishes the law snapshot and capacity behavior.
-- This forward-only correction replaces its legacy band_treasuries debit with the
-- dedicated financial_accounts band treasury used by current RockMundo finance.

CREATE OR REPLACE FUNCTION public.book_gig(
  p_band_id uuid,
  p_venue_id uuid,
  p_setlist_id uuid,
  p_local_date date,
  p_slot text,
  p_ticket_price integer,
  p_request_id uuid,
  p_rider_id uuid DEFAULT NULL,
  p_ticket_operator_id text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_actor public.profiles%ROWTYPE;
  v_band public.bands%ROWTYPE;
  v_venue public.venues%ROWTYPE;
  v_gig public.gigs%ROWTYPE;
  v_timezone text;
  v_start_time time;
  v_end_time time;
  v_start timestamptz;
  v_end timestamptz;
  v_multiplier numeric;
  v_payment_multiplier numeric;
  v_physical_capacity integer;
  v_capacity integer;
  v_city_capacity_limit integer;
  v_permit_fee integer := 0;
  v_city_law_id uuid;
  v_estimated_attendance integer;
  v_estimated_revenue integer;
  v_booking_fee integer;
  v_total_charge integer;
  v_payment integer;
  v_rider_cost integer := 0;
  v_song_count integer;
  v_currency char(3);
  v_band_treasury public.financial_accounts%ROWTYPE;
  v_city_treasury public.financial_accounts%ROWTYPE;
  v_fee_sink public.financial_accounts%ROWTYPE;
  v_booking_fee_tx uuid;
  v_permit_tx uuid;
  v_band_balance_after bigint;
  v_stage text := 'resolve_actor';
  v_error_state text;
  v_error_message text;
  v_error_detail text;
  v_error_hint text;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'gig_booking_unauthenticated' USING ERRCODE='42501';
  END IF;

  SELECT * INTO v_actor
  FROM public.profiles
  WHERE user_id = auth.uid()
    AND COALESCE(is_active, true) = true
    AND died_at IS NULL
  ORDER BY updated_at DESC NULLS LAST, created_at DESC NULLS LAST
  LIMIT 1;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'gig_booking_profile_missing' USING ERRCODE='P0001';
  END IF;
  IF p_request_id IS NULL THEN
    RAISE EXCEPTION 'gig_booking_request_invalid' USING ERRCODE='22023';
  END IF;

  v_stage := 'idempotency_check';
  SELECT * INTO v_gig FROM public.gigs WHERE booking_request_id = p_request_id;
  IF FOUND THEN
    IF v_gig.band_id <> p_band_id OR NOT public.can_manage_band_gigs(v_gig.band_id, auth.uid()) THEN
      RAISE EXCEPTION 'gig_booking_request_conflict' USING ERRCODE='23505';
    END IF;
    RETURN jsonb_build_object(
      'gig', to_jsonb(v_gig),
      'already_booked', true,
      'booking_fee', COALESCE(v_gig.booking_fee, 0),
      'venue_permit_fee', COALESCE(v_gig.city_venue_permit_fee, 0),
      'total_booking_charge', COALESCE(v_gig.booking_fee, 0) + COALESCE(v_gig.city_venue_permit_fee, 0),
      'effective_capacity', COALESCE(v_gig.effective_capacity, 0),
      'city_capacity_limit', v_gig.city_capacity_limit,
      'scheduled_start', v_gig.scheduled_date
    );
  END IF;

  v_stage := 'load_band';
  IF NOT public.can_manage_band_gigs(p_band_id, auth.uid()) THEN
    RAISE EXCEPTION 'gig_booking_forbidden' USING ERRCODE='42501';
  END IF;
  IF NOT public.user_has_band_finance_permission(
    p_band_id,
    v_actor.id,
    'pay_band_expenses'::public.band_finance_permission
  ) THEN
    RAISE EXCEPTION 'gig_booking_finance_forbidden' USING ERRCODE='42501';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended('gig-band:'||p_band_id::text, 0));
  PERFORM pg_advisory_xact_lock(hashtextextended('gig-venue:'||p_venue_id::text, 0));

  SELECT * INTO v_band FROM public.bands WHERE id = p_band_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'gig_booking_band_invalid' USING ERRCODE='P0001';
  END IF;

  v_stage := 'load_venue';
  SELECT * INTO v_venue FROM public.venues WHERE id = p_venue_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'gig_booking_venue_invalid' USING ERRCODE='P0001';
  END IF;
  SELECT COALESCE(c.timezone, 'UTC') INTO v_timezone
  FROM public.cities c WHERE c.id = v_venue.city_id;
  v_timezone := COALESCE(v_timezone, 'UTC');

  v_stage := 'validate_slot';
  SELECT x.start_time, x.end_time, x.attendance_multiplier, x.payment_multiplier
  INTO v_start_time, v_end_time, v_multiplier, v_payment_multiplier
  FROM (VALUES
    ('kids','15:00'::time,'15:30'::time,0.30,0.50),
    ('opening','19:00','19:30',0.50,0.60),
    ('support','19:45','20:30',0.75,0.80),
    ('headline','20:45','22:00',1.00,1.00)
  ) AS x(slot,start_time,end_time,attendance_multiplier,payment_multiplier)
  WHERE x.slot = p_slot;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'gig_booking_slot_invalid' USING ERRCODE='22023';
  END IF;

  v_start := (p_local_date + v_start_time) AT TIME ZONE v_timezone;
  v_end := (p_local_date + v_end_time
            + CASE WHEN v_end_time <= v_start_time THEN interval '1 day' ELSE interval '0' END)
           AT TIME ZONE v_timezone;
  IF v_start <= now() THEN
    RAISE EXCEPTION 'gig_booking_past_date' USING ERRCODE='22023';
  END IF;
  IF p_ticket_price IS NULL OR p_ticket_price <= 0 OR p_ticket_price > 100000 THEN
    RAISE EXCEPTION 'gig_booking_ticket_price_invalid' USING ERRCODE='22023';
  END IF;

  v_stage := 'resolve_city_law';
  SELECT cl.id,
         GREATEST(0, round(COALESCE(cl.venue_permit_cost, 0))::integer),
         CASE WHEN COALESCE(cl.max_concert_capacity, 0) > 0
              THEN round(cl.max_concert_capacity)::integer ELSE NULL END
  INTO v_city_law_id, v_permit_fee, v_city_capacity_limit
  FROM public.city_laws cl
  WHERE cl.city_id = v_venue.city_id
    AND cl.effective_from <= v_start
    AND (cl.effective_until IS NULL OR cl.effective_until > v_start)
  ORDER BY cl.effective_from DESC
  LIMIT 1;
  IF NOT FOUND THEN
    v_city_law_id := NULL;
    v_permit_fee := 0;
    v_city_capacity_limit := NULL;
  END IF;

  v_physical_capacity := GREATEST(COALESCE(v_venue.capacity, 100), 1);
  v_capacity := CASE
    WHEN v_city_capacity_limit IS NOT NULL
      THEN GREATEST(1, LEAST(v_physical_capacity, v_city_capacity_limit))
    ELSE v_physical_capacity
  END;

  v_stage := 'validate_setlist';
  SELECT count(*) INTO v_song_count
  FROM public.setlist_songs ss
  JOIN public.setlists s ON s.id = ss.setlist_id
  WHERE s.id = p_setlist_id
    AND s.band_id = p_band_id
    AND COALESCE(s.is_active, true)
    AND ss.song_id IS NOT NULL;
  IF COALESCE(v_song_count, 0) < 6 THEN
    RAISE EXCEPTION 'gig_booking_setlist_invalid' USING ERRCODE='23514';
  END IF;

  v_stage := 'validate_rider';
  IF p_rider_id IS NOT NULL THEN
    SELECT COALESCE(total_cost_estimate, 0) INTO v_rider_cost
    FROM public.band_riders
    WHERE id = p_rider_id AND band_id = p_band_id;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'gig_booking_rider_invalid' USING ERRCODE='23503';
    END IF;
  END IF;

  v_stage := 'conflict_check';
  IF EXISTS (
    SELECT 1 FROM public.band_activity_lockouts
    WHERE band_id = p_band_id AND locked_until > now()
  ) THEN
    RAISE EXCEPTION 'gig_booking_band_lockout' USING ERRCODE='P0001';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.gigs g
    WHERE g.band_id = p_band_id
      AND g.status IN ('scheduled','in_progress','ready_for_completion')
      AND g.scheduled_date < v_end
      AND COALESCE(g.scheduled_end, g.scheduled_date + interval '3 hours') > v_start
  ) THEN
    RAISE EXCEPTION 'gig_booking_band_conflict' USING ERRCODE='23P01';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.gigs g
    WHERE g.venue_id = p_venue_id
      AND g.status IN ('scheduled','in_progress','ready_for_completion')
      AND g.scheduled_date < v_end
      AND COALESCE(g.scheduled_end, g.scheduled_date + interval '3 hours') > v_start
  ) THEN
    RAISE EXCEPTION 'gig_booking_venue_conflict' USING ERRCODE='23P01';
  END IF;

  v_stage := 'calculate_finances';
  v_estimated_attendance := LEAST(
    v_capacity,
    GREATEST(
      1,
      round(
        v_capacity * LEAST(
          1.0,
          0.25 + COALESCE(v_band.popularity,0)/200.0 + COALESCE(v_band.global_fame,0)/10000.0
        ) * v_multiplier
      )::integer
    )
  );
  v_estimated_revenue := v_estimated_attendance * p_ticket_price;
  v_booking_fee := GREATEST(50, round(v_estimated_revenue * 0.10)::integer);
  v_total_charge := v_booking_fee + v_permit_fee;
  v_payment := GREATEST(
    0,
    round(COALESCE(v_venue.base_payment,0) * v_payment_multiplier)::integer - v_rider_cost
  );

  -- Resolve the city's canonical treasury first; its currency is the booking
  -- currency for the permit and therefore the required band-treasury currency.
  v_stage := 'resolve_city_treasury';
  SELECT fa.* INTO v_city_treasury
  FROM public.city_treasury_profiles tp
  JOIN public.financial_accounts fa ON fa.id = tp.treasury_account_id
  WHERE tp.city_id = v_venue.city_id
    AND fa.account_status = 'active'
  LIMIT 1;

  IF v_city_treasury.id IS NULL THEN
    SELECT public.get_or_create_primary_financial_account(
      'city'::public.financial_owner_type,
      c.id,
      c.name || ' city treasury',
      COALESCE(c.primary_currency_code, 'USD')
    ) INTO v_city_treasury
    FROM public.cities c
    WHERE c.id = v_venue.city_id;

    INSERT INTO public.city_treasury_profiles(city_id, treasury_account_id)
    VALUES(v_venue.city_id, v_city_treasury.id)
    ON CONFLICT (city_id) DO UPDATE
      SET treasury_account_id = EXCLUDED.treasury_account_id;
  END IF;

  v_currency := COALESCE(v_city_treasury.currency_code, v_city_treasury.default_currency_code, 'USD');

  v_stage := 'resolve_band_treasury';
  SELECT * INTO v_band_treasury
  FROM public.financial_accounts
  WHERE owner_type = 'band'
    AND owner_id = p_band_id
    AND account_status = 'active'
    AND currency_code = v_currency
    AND metadata->>'account_role' = 'band_treasury'
  ORDER BY is_primary DESC, created_at
  LIMIT 1
  FOR UPDATE;

  IF v_band_treasury.id IS NULL THEN
    PERFORM public.get_or_create_band_treasury_account(p_band_id, v_currency);
    SELECT * INTO v_band_treasury
    FROM public.financial_accounts
    WHERE owner_type = 'band'
      AND owner_id = p_band_id
      AND account_status = 'active'
      AND currency_code = v_currency
      AND metadata->>'account_role' = 'band_treasury'
    ORDER BY is_primary DESC, created_at
    LIMIT 1
    FOR UPDATE;
  END IF;

  IF v_band_treasury.id IS NULL THEN
    RAISE EXCEPTION 'gig_booking_band_treasury_missing' USING ERRCODE='P0001';
  END IF;
  IF v_band_treasury.available_balance_minor < v_total_charge::bigint * 100 THEN
    RAISE EXCEPTION 'gig_booking_insufficient_funds'
      USING ERRCODE='P0001', DETAIL = v_total_charge::text;
  END IF;

  -- Booking fees leave the playable economy into a dedicated system sink.
  v_stage := 'resolve_booking_fee_sink';
  PERFORM pg_advisory_xact_lock(hashtextextended('gig-booking-fee-sink:'||v_currency::text, 0));
  SELECT * INTO v_fee_sink
  FROM public.financial_accounts
  WHERE owner_type = 'system'
    AND owner_id IS NULL
    AND account_status = 'active'
    AND currency_code = v_currency
    AND metadata->>'account_role' = 'gig_booking_fee_sink'
  ORDER BY created_at
  LIMIT 1
  FOR UPDATE;
  IF v_fee_sink.id IS NULL THEN
    INSERT INTO public.financial_accounts(
      owner_type, owner_id, account_name, account_status,
      current_balance_minor, default_currency_code, currency_code,
      is_primary, metadata
    ) VALUES (
      'system', NULL, 'Gig booking fees ('||v_currency||')', 'active',
      0, v_currency, v_currency, false,
      jsonb_build_object('account_role','gig_booking_fee_sink')
    ) RETURNING * INTO v_fee_sink;
  END IF;

  v_stage := 'post_booking_fee';
  v_booking_fee_tx := public.post_financial_journal(
    'system_fee'::public.financial_transaction_category,
    p_request_id,
    v_currency,
    'gig-booking-fee:' || p_request_id::text,
    jsonb_build_array(
      jsonb_build_object(
        'account_id', v_band_treasury.id,
        'direction', 'debit',
        'amount_minor', v_booking_fee::bigint * 100
      ),
      jsonb_build_object(
        'account_id', v_fee_sink.id,
        'direction', 'credit',
        'amount_minor', v_booking_fee::bigint * 100
      )
    ),
    'gig_booking',
    p_request_id,
    jsonb_build_object(
      'trusted_finance_workflow', true,
      'source', 'book_gig',
      'band_id', p_band_id,
      'venue_id', p_venue_id,
      'actor_profile_id', v_actor.id,
      'component', 'booking_fee'
    )
  );

  IF v_permit_fee > 0 THEN
    v_stage := 'post_city_permit';
    v_permit_tx := public.post_financial_journal(
      'city_venue_permit_fee'::public.financial_transaction_category,
      p_request_id,
      v_currency,
      'gig-city-permit:' || p_request_id::text,
      jsonb_build_array(
        jsonb_build_object(
          'account_id', v_band_treasury.id,
          'direction', 'debit',
          'amount_minor', v_permit_fee::bigint * 100
        ),
        jsonb_build_object(
          'account_id', v_city_treasury.id,
          'direction', 'credit',
          'amount_minor', v_permit_fee::bigint * 100
        )
      ),
      'gig_booking',
      p_request_id,
      jsonb_build_object(
        'trusted_finance_workflow', true,
        'source', 'book_gig',
        'band_id', p_band_id,
        'venue_id', p_venue_id,
        'city_id', v_venue.city_id,
        'actor_profile_id', v_actor.id,
        'city_law_id', v_city_law_id,
        'component', 'venue_permit'
      )
    );

    -- City Hall still reads this compatibility treasury/ledger projection in
    -- several screens. Keep it synchronized with the canonical city account.
    PERFORM public.credit_city_treasury(
      v_venue.city_id,
      v_permit_fee,
      'venue_permit_fee',
      'Venue permit: ' || v_band.name || ' at ' || v_venue.name,
      p_request_id
    );
  END IF;

  SELECT current_balance_minor INTO v_band_balance_after
  FROM public.financial_accounts
  WHERE id = v_band_treasury.id;

  -- Compatibility projection only. financial_accounts remains authoritative.
  UPDATE public.bands
  SET band_balance = floor(COALESCE(v_band_balance_after, 0)::numeric / 100)::integer
  WHERE id = p_band_id
  RETURNING * INTO v_band;

  v_stage := 'insert_gig';
  INSERT INTO public.gigs (
    band_id, venue_id, setlist_id, rider_id, ticket_operator_id,
    scheduled_date, scheduled_end, status, show_type, payment, booking_fee,
    ticket_price, time_slot, slot_start_time, slot_end_time,
    slot_attendance_multiplier, estimated_attendance, estimated_revenue,
    attendance, fan_gain, predicted_tickets, tickets_sold, last_ticket_update,
    booking_request_id, city_venue_permit_fee, city_capacity_limit,
    effective_capacity, booking_city_law_id
  ) VALUES (
    p_band_id, p_venue_id, p_setlist_id, p_rider_id, p_ticket_operator_id,
    v_start, v_end, 'scheduled', 'concert', v_payment, v_booking_fee,
    p_ticket_price, p_slot, v_start_time, v_end_time,
    v_multiplier, v_estimated_attendance, v_estimated_revenue,
    0, 0, v_estimated_attendance, 0, now(),
    p_request_id, v_permit_fee, v_city_capacity_limit,
    v_capacity, v_city_law_id
  ) RETURNING * INTO v_gig;

  v_stage := 'create_member_activities';
  INSERT INTO public.player_scheduled_activities (
    user_id, profile_id, activity_type, scheduled_start, scheduled_end,
    status, title, location, linked_gig_id, metadata
  )
  SELECT p.user_id, p.id, 'gig', v_start, v_end, 'scheduled',
         'Gig at '||v_venue.name, v_venue.name, v_gig.id,
         jsonb_build_object(
           'band_id', p_band_id,
           'venueId', p_venue_id,
           'slotId', p_slot,
           'venue_timezone', v_timezone,
           'is_band_activity', true,
           'city_venue_permit_fee', v_permit_fee,
           'effective_capacity', v_capacity,
           'city_capacity_limit', v_city_capacity_limit
         )
  FROM public.active_band_performing_members(p_band_id) member
  JOIN public.profiles p ON p.id = member.profile_id
  ON CONFLICT (linked_gig_id, profile_id)
  WHERE linked_gig_id IS NOT NULL AND status <> 'cancelled' DO NOTHING;

  RETURN jsonb_build_object(
    'gig', to_jsonb(v_gig),
    'already_booked', false,
    'booking_fee', v_booking_fee,
    'venue_permit_fee', v_permit_fee,
    'total_booking_charge', v_total_charge,
    'physical_capacity', v_physical_capacity,
    'effective_capacity', v_capacity,
    'city_capacity_limit', v_city_capacity_limit,
    'booking_fee_transaction_id', v_booking_fee_tx,
    'permit_transaction_id', v_permit_tx,
    'currency_code', v_currency,
    'band_balance', v_band.band_balance,
    'scheduled_start', v_start,
    'scheduled_end', v_end,
    'venue_timezone', v_timezone
  );
EXCEPTION WHEN OTHERS THEN
  GET STACKED DIAGNOSTICS
    v_error_state = RETURNED_SQLSTATE,
    v_error_message = MESSAGE_TEXT,
    v_error_detail = PG_EXCEPTION_DETAIL,
    v_error_hint = PG_EXCEPTION_HINT;
  IF v_error_message LIKE 'gig_booking_%' THEN
    RAISE;
  END IF;
  RAISE EXCEPTION USING
    ERRCODE = v_error_state,
    MESSAGE = 'gig_booking_database_failure',
    DETAIL = format(
      'stage=%s; message=%s; detail=%s',
      v_stage,
      v_error_message,
      COALESCE(v_error_detail, '')
    ),
    HINT = COALESCE(NULLIF(v_error_hint, ''), 'Inspect the named book_gig stage.');
END;
$$;

REVOKE ALL ON FUNCTION public.book_gig(uuid,uuid,uuid,date,text,integer,uuid,uuid,text)
FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.book_gig(uuid,uuid,uuid,date,text,integer,uuid,uuid,text)
TO authenticated, service_role;

COMMENT ON FUNCTION public.book_gig(uuid,uuid,uuid,date,text,integer,uuid,uuid,text) IS
  'Atomically books a gig, snapshots City Hall permit/capacity law, posts booking and permit costs through canonical financial_accounts journals, credits city revenue, and blocks member schedules.';

NOTIFY pgrst, 'reload schema';
