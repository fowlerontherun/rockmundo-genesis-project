-- Enforce the mayor's venue permit and maximum concert-capacity policies in the
-- existing authoritative gig-booking transaction. The law snapshot is stored on
-- the gig so a later administration cannot silently change tickets already sold.

ALTER TABLE public.gigs
  ADD COLUMN IF NOT EXISTS city_venue_permit_fee integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS city_capacity_limit integer,
  ADD COLUMN IF NOT EXISTS effective_capacity integer,
  ADD COLUMN IF NOT EXISTS booking_city_law_id uuid REFERENCES public.city_laws(id);

-- Existing bookings pre-date this enforcement pass. Preserve their original
-- physical-capacity contract instead of retroactively cancelling sold tickets.
UPDATE public.gigs g
SET effective_capacity = GREATEST(COALESCE(v.capacity, 100), 1)
FROM public.venues v
WHERE v.id = g.venue_id
  AND g.effective_capacity IS NULL;

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
  v_treasury public.band_treasuries%ROWTYPE;
  v_treasury_balance_after bigint;
  v_stage text := 'resolve_actor';
  v_error_state text;
  v_error_message text;
  v_error_detail text;
  v_error_hint text;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'gig_booking_unauthenticated' USING ERRCODE='42501'; END IF;
  SELECT * INTO v_actor FROM public.profiles
  WHERE user_id = auth.uid() AND COALESCE(is_active, true) = true AND died_at IS NULL
  ORDER BY updated_at DESC NULLS LAST, created_at DESC NULLS LAST LIMIT 1;
  IF NOT FOUND THEN RAISE EXCEPTION 'gig_booking_profile_missing' USING ERRCODE='P0001'; END IF;
  IF p_request_id IS NULL THEN RAISE EXCEPTION 'gig_booking_request_invalid' USING ERRCODE='22023'; END IF;

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

  PERFORM pg_advisory_xact_lock(hashtextextended('gig-band:'||p_band_id::text, 0));
  PERFORM pg_advisory_xact_lock(hashtextextended('gig-venue:'||p_venue_id::text, 0));

  SELECT * INTO v_band FROM public.bands WHERE id = p_band_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'gig_booking_band_invalid' USING ERRCODE='P0001'; END IF;

  v_stage := 'load_venue';
  SELECT * INTO v_venue FROM public.venues WHERE id = p_venue_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'gig_booking_venue_invalid' USING ERRCODE='P0001'; END IF;
  SELECT COALESCE(c.timezone, 'UTC') INTO v_timezone FROM public.cities c WHERE c.id = v_venue.city_id;
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
  IF NOT FOUND THEN RAISE EXCEPTION 'gig_booking_slot_invalid' USING ERRCODE='22023'; END IF;

  v_start := (p_local_date + v_start_time) AT TIME ZONE v_timezone;
  v_end := (p_local_date + v_end_time
            + CASE WHEN v_end_time <= v_start_time THEN interval '1 day' ELSE interval '0' END)
           AT TIME ZONE v_timezone;
  IF v_start <= now() THEN RAISE EXCEPTION 'gig_booking_past_date' USING ERRCODE='22023'; END IF;
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
    FROM public.band_riders WHERE id = p_rider_id AND band_id = p_band_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'gig_booking_rider_invalid' USING ERRCODE='23503'; END IF;
  END IF;

  v_stage := 'conflict_check';
  IF EXISTS (SELECT 1 FROM public.band_activity_lockouts
             WHERE band_id = p_band_id AND locked_until > now()) THEN
    RAISE EXCEPTION 'gig_booking_band_lockout' USING ERRCODE='P0001';
  END IF;

  IF EXISTS (SELECT 1 FROM public.gigs g WHERE g.band_id = p_band_id
    AND g.status IN ('scheduled','in_progress','ready_for_completion')
    AND g.scheduled_date < v_end
    AND COALESCE(g.scheduled_end, g.scheduled_date + interval '3 hours') > v_start) THEN
    RAISE EXCEPTION 'gig_booking_band_conflict' USING ERRCODE='23P01';
  END IF;

  IF EXISTS (SELECT 1 FROM public.gigs g WHERE g.venue_id = p_venue_id
    AND g.status IN ('scheduled','in_progress','ready_for_completion')
    AND g.scheduled_date < v_end
    AND COALESCE(g.scheduled_end, g.scheduled_date + interval '3 hours') > v_start) THEN
    RAISE EXCEPTION 'gig_booking_venue_conflict' USING ERRCODE='23P01';
  END IF;

  v_stage := 'calculate_finances';
  v_estimated_attendance := LEAST(v_capacity, GREATEST(1, round(v_capacity * LEAST(1.0,
    (0.25 + COALESCE(v_band.popularity,0)/200.0 + COALESCE(v_band.global_fame,0)/10000.0)) * v_multiplier))::integer);
  v_estimated_revenue := v_estimated_attendance * p_ticket_price;
  v_booking_fee := GREATEST(50, round(v_estimated_revenue * 0.10)::integer);
  v_total_charge := v_booking_fee + v_permit_fee;
  v_payment := GREATEST(0, round(COALESCE(v_venue.base_payment,0) * v_payment_multiplier)::integer - v_rider_cost);

  -- The current band-funding UI deposits into band_treasuries and mirrors the
  -- primary treasury into bands.band_balance. Reconcile downward only so stale
  -- legacy data can never manufacture extra booking funds.
  SELECT * INTO v_treasury
  FROM public.band_treasuries
  WHERE band_id = p_band_id
  ORDER BY is_primary DESC, created_at
  LIMIT 1
  FOR UPDATE;
  IF NOT FOUND THEN
    v_treasury := public._get_or_create_band_treasury(p_band_id, 'USD');
  END IF;

  UPDATE public.band_treasuries
  SET balance_minor = GREATEST(
        reserved_balance_minor,
        LEAST(balance_minor, GREATEST(COALESCE(v_band.band_balance,0),0)::bigint * 100)
      ),
      updated_at = now()
  WHERE id = v_treasury.id
  RETURNING * INTO v_treasury;

  IF (v_treasury.balance_minor - v_treasury.reserved_balance_minor) < v_total_charge::bigint * 100 THEN
    RAISE EXCEPTION 'gig_booking_insufficient_funds' USING ERRCODE='P0001', DETAIL = v_total_charge::text;
  END IF;

  v_stage := 'debit_booking_fee';
  UPDATE public.band_treasuries
  SET balance_minor = balance_minor - v_booking_fee::bigint * 100,
      updated_at = now()
  WHERE id = v_treasury.id
  RETURNING balance_minor INTO v_treasury_balance_after;

  INSERT INTO public.band_treasury_transactions(
    band_id, treasury_id, profile_id, direction, amount_minor, currency_code,
    source_kind, category, note, idempotency_key, balance_after_minor
  ) VALUES (
    p_band_id, v_treasury.id, v_actor.id, 'debit', v_booking_fee::bigint * 100,
    v_treasury.currency_code, 'band_treasury', 'gig_booking_fee',
    'Gig booking fee at ' || v_venue.name,
    'gig-booking-fee:' || p_request_id::text,
    v_treasury_balance_after
  );

  IF v_permit_fee > 0 THEN
    v_stage := 'debit_city_permit';
    UPDATE public.band_treasuries
    SET balance_minor = balance_minor - v_permit_fee::bigint * 100,
        updated_at = now()
    WHERE id = v_treasury.id
    RETURNING balance_minor INTO v_treasury_balance_after;

    INSERT INTO public.band_treasury_transactions(
      band_id, treasury_id, profile_id, direction, amount_minor, currency_code,
      source_kind, category, note, idempotency_key, balance_after_minor
    ) VALUES (
      p_band_id, v_treasury.id, v_actor.id, 'debit', v_permit_fee::bigint * 100,
      v_treasury.currency_code, 'band_treasury', 'city_venue_permit',
      'City venue permit for ' || v_venue.name,
      'gig-city-permit:' || p_request_id::text,
      v_treasury_balance_after
    );

    PERFORM public.credit_city_treasury(
      v_venue.city_id,
      v_permit_fee,
      'venue_permit_fee',
      'Venue permit: ' || v_band.name || ' at ' || v_venue.name,
      p_request_id
    );
  END IF;

  UPDATE public.bands
  SET band_balance = (v_treasury_balance_after / 100)::integer
  WHERE id = p_band_id
  RETURNING * INTO v_band;

  v_stage := 'insert_gig';
  INSERT INTO public.gigs (
    band_id,venue_id,setlist_id,rider_id,ticket_operator_id,scheduled_date,scheduled_end,
    status,show_type,payment,booking_fee,ticket_price,time_slot,slot_start_time,slot_end_time,
    slot_attendance_multiplier,estimated_attendance,estimated_revenue,attendance,fan_gain,predicted_tickets,
    tickets_sold,last_ticket_update,booking_request_id,
    city_venue_permit_fee,city_capacity_limit,effective_capacity,booking_city_law_id
  ) VALUES (
    p_band_id,p_venue_id,p_setlist_id,p_rider_id,p_ticket_operator_id,v_start,v_end,'scheduled',
    'concert',v_payment,v_booking_fee,p_ticket_price,p_slot,v_start_time,v_end_time,
    v_multiplier,v_estimated_attendance,v_estimated_revenue,0,0,v_estimated_attendance,
    0,now(),p_request_id,
    v_permit_fee,v_city_capacity_limit,v_capacity,v_city_law_id
  ) RETURNING * INTO v_gig;

  v_stage := 'create_member_activities';
  INSERT INTO public.player_scheduled_activities (
    user_id,profile_id,activity_type,scheduled_start,scheduled_end,
    status,title,location,linked_gig_id,metadata
  )
  SELECT p.user_id, p.id, 'gig', v_start, v_end, 'scheduled',
         'Gig at '||v_venue.name, v_venue.name, v_gig.id,
         jsonb_build_object(
           'band_id',p_band_id,'venueId',p_venue_id,'slotId',p_slot,
           'venue_timezone',v_timezone,'is_band_activity',true,
           'city_venue_permit_fee',v_permit_fee,
           'effective_capacity',v_capacity,
           'city_capacity_limit',v_city_capacity_limit
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
  IF v_error_message LIKE 'gig_booking_%' THEN RAISE; END IF;
  RAISE EXCEPTION USING
    ERRCODE = v_error_state,
    MESSAGE = 'gig_booking_database_failure',
    DETAIL = format('stage=%s; message=%s; detail=%s', v_stage, v_error_message, COALESCE(v_error_detail, '')),
    HINT = COALESCE(NULLIF(v_error_hint, ''), 'Inspect the named book_gig stage.');
END;
$$;

REVOKE ALL ON FUNCTION public.book_gig(uuid,uuid,uuid,date,text,integer,uuid,uuid,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.book_gig(uuid,uuid,uuid,date,text,integer,uuid,uuid,text) TO authenticated, service_role;

COMMENT ON FUNCTION public.book_gig(uuid,uuid,uuid,date,text,integer,uuid,uuid,text) IS
  'Atomically books a gig, applies the booking-date City Hall permit/capacity policy, debits the band treasury, credits city permit revenue, and blocks member schedules.';

-- All future ticket-sale calculations use the capacity snapshot stored on the gig.
CREATE OR REPLACE FUNCTION public.set_predicted_tickets()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_physical_capacity integer;
  v_capacity integer;
BEGIN
  SELECT capacity INTO v_physical_capacity FROM public.venues WHERE id = NEW.venue_id;
  v_capacity := GREATEST(COALESCE(NULLIF(NEW.effective_capacity,0), v_physical_capacity, 100), 1);

  IF COALESCE(NEW.predicted_tickets, 0) <= 0 THEN
    NEW.predicted_tickets := public.calculate_predicted_tickets(
      NEW.band_id,
      v_capacity,
      NEW.scheduled_date
    );
  END IF;

  NEW.predicted_tickets := LEAST(
    v_capacity,
    GREATEST(COALESCE(NEW.predicted_tickets, 0), COALESCE(NEW.tickets_sold, 0), 0)
  );
  IF NEW.tickets_sold IS NULL THEN NEW.tickets_sold := 0; END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.set_predicted_tickets() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_predicted_tickets() TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.advance_gig_ticket_sales(p_now timestamptz DEFAULT now())
RETURNS integer
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
DECLARE
  v_updated integer := 0;
BEGIN
  WITH eligible AS (
    SELECT
      g.id,
      g.scheduled_date,
      COALESCE(g.created_at, g.last_ticket_update, p_now) AS booked_at,
      COALESCE(g.last_ticket_update, g.created_at, '-infinity'::timestamptz) AS last_update,
      COALESCE(g.tickets_sold, 0) AS sold,
      LEAST(
        GREATEST(COALESCE(NULLIF(g.effective_capacity,0), v.capacity, 1), 1),
        GREATEST(COALESCE(g.predicted_tickets, g.estimated_attendance, 0), COALESCE(g.tickets_sold, 0), 0)
      ) AS target
    FROM public.gigs g
    JOIN public.venues v ON v.id = g.venue_id
    WHERE g.status IN ('scheduled', 'confirmed')
      AND g.scheduled_date > p_now
      AND g.scheduled_date < p_now + interval '30 days'
      AND COALESCE(g.predicted_tickets, g.estimated_attendance, 0) > 0
  ), progress AS (
    SELECT e.*,
      CASE
        WHEN e.scheduled_date <= e.booked_at THEN 1::numeric
        ELSE GREATEST(0::numeric, LEAST(1::numeric,
          EXTRACT(epoch FROM (p_now - e.booked_at)) /
          NULLIF(EXTRACT(epoch FROM (e.scheduled_date - e.booked_at)), 0)))
      END AS elapsed_fraction
    FROM eligible e
    WHERE e.last_update::date < p_now::date
  ), targets AS (
    SELECT p.id,
      CASE
        WHEN p.target <= p.sold THEN p.sold
        WHEN p.scheduled_date - p_now <= interval '24 hours' THEN p.target
        ELSE LEAST(p.target, GREATEST(p.sold,
          floor(p.target * power(p.elapsed_fraction, 0.85))::integer))
      END AS next_sold
    FROM progress p
  ), updated AS (
    UPDATE public.gigs g
    SET tickets_sold = t.next_sold,
        last_ticket_update = p_now
    FROM targets t
    WHERE g.id = t.id
    RETURNING g.id
  )
  SELECT count(*)::integer INTO v_updated FROM updated;
  RETURN v_updated;
END;
$$;

REVOKE ALL ON FUNCTION public.advance_gig_ticket_sales(timestamptz) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.advance_gig_ticket_sales(timestamptz) TO service_role;

CREATE OR REPLACE FUNCTION public.simulate_ticket_sales()
RETURNS void
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  PERFORM public.advance_gig_ticket_sales(now());
END;
$$;
REVOKE ALL ON FUNCTION public.simulate_ticket_sales() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.simulate_ticket_sales() TO service_role;

CREATE OR REPLACE FUNCTION public.sync_gig_outcome_attendance_percentage()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_capacity integer;
BEGIN
  -- A booked gig's law snapshot is stronger evidence than a caller-supplied or
  -- physical venue capacity. Old/non-gig outcomes retain their legacy fallback.
  IF NEW.gig_id IS NOT NULL THEN
    SELECT NULLIF(COALESCE(NULLIF(g.effective_capacity,0), v.capacity), 0)
    INTO v_capacity
    FROM public.gigs g
    JOIN public.venues v ON v.id = g.venue_id
    WHERE g.id = NEW.gig_id;
  END IF;

  IF v_capacity IS NULL THEN v_capacity := NULLIF(NEW.venue_capacity, 0); END IF;
  IF v_capacity IS NULL AND NEW.venue_id IS NOT NULL THEN
    SELECT NULLIF(v.capacity, 0) INTO v_capacity
    FROM public.venues v WHERE v.id = NEW.venue_id;
  END IF;

  IF v_capacity IS NOT NULL THEN
    NEW.venue_capacity := v_capacity;
    IF NEW.actual_attendance IS NOT NULL THEN
      NEW.attendance_percentage := LEAST(
        999.99::numeric,
        round((NEW.actual_attendance::numeric * 100.0) / v_capacity::numeric, 2)
      );
    ELSE
      NEW.attendance_percentage := NULL;
    END IF;
  ELSE
    NEW.attendance_percentage := NULL;
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.sync_gig_outcome_attendance_percentage() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.sync_gig_outcome_attendance_percentage() TO service_role;

DROP TRIGGER IF EXISTS sync_gig_outcome_attendance_percentage_trigger ON public.gig_outcomes;
CREATE TRIGGER sync_gig_outcome_attendance_percentage_trigger
BEFORE INSERT OR UPDATE OF actual_attendance, venue_capacity, venue_id, gig_id
ON public.gig_outcomes
FOR EACH ROW
EXECUTE FUNCTION public.sync_gig_outcome_attendance_percentage();

NOTIFY pgrst, 'reload schema';
