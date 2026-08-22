-- Server-authoritative travel booking boundary.
-- The authenticated Edge Function owns route/mode physics; this database boundary
-- revalidates character/city/time state and independently recomputes mutable City
-- Hall effects (Transport rating and departure-city travel tax) before money moves.

CREATE TABLE IF NOT EXISTS public.authoritative_travel_bookings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  from_city_id uuid NOT NULL REFERENCES public.cities(id) ON DELETE RESTRICT,
  to_city_id uuid NOT NULL REFERENCES public.cities(id) ON DELETE RESTRICT,
  transport_type text NOT NULL,
  raw_fare integer NOT NULL CHECK (raw_fare >= 0),
  adjusted_fare integer NOT NULL CHECK (adjusted_fare >= 0),
  travel_tax integer NOT NULL CHECK (travel_tax >= 0),
  total_cost integer NOT NULL CHECK (total_cost >= 0),
  raw_duration_hours numeric(10,2) NOT NULL CHECK (raw_duration_hours > 0),
  adjusted_duration_hours numeric(10,2) NOT NULL CHECK (adjusted_duration_hours > 0),
  average_transport_rating numeric(6,2) NOT NULL,
  transport_cost_multiplier numeric(8,4) NOT NULL,
  transport_duration_multiplier numeric(8,4) NOT NULL,
  scheduled_departure_time timestamptz NOT NULL,
  arrival_time timestamptz NOT NULL,
  travel_history_id uuid,
  fare_transaction_id uuid,
  tax_transaction_id uuid,
  idempotency_key uuid NOT NULL,
  quote_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  result_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(profile_id, idempotency_key)
);

CREATE INDEX IF NOT EXISTS authoritative_travel_bookings_profile_created_idx
  ON public.authoritative_travel_bookings(profile_id, created_at DESC);
CREATE INDEX IF NOT EXISTS authoritative_travel_bookings_city_created_idx
  ON public.authoritative_travel_bookings(from_city_id, created_at DESC);
ALTER TABLE public.authoritative_travel_bookings ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.authoritative_travel_bookings FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.authoritative_travel_bookings TO service_role;

CREATE OR REPLACE FUNCTION public.book_authoritative_travel(
  p_user_id uuid,
  p_destination_city_id uuid,
  p_transport_type text,
  p_departure_time timestamptz,
  p_raw_fare integer,
  p_raw_duration_hours numeric,
  p_idempotency_key uuid,
  p_quote_snapshot jsonb DEFAULT '{}'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_profile public.profiles%ROWTYPE;
  v_existing jsonb;
  v_from_city public.cities%ROWTYPE;
  v_to_city public.cities%ROWTYPE;
  v_from_transport numeric := 50;
  v_to_transport numeric := 50;
  v_average_transport numeric := 50;
  v_cost_multiplier numeric := 1;
  v_duration_multiplier numeric := 1;
  v_adjusted_fare integer;
  v_travel_tax integer := 0;
  v_total_cost integer;
  v_adjusted_duration numeric;
  v_departure timestamptz;
  v_arrival timestamptz;
  v_starts_immediately boolean := false;
  v_conflict boolean := false;
  v_activity record;
  v_fare_tx uuid;
  v_tax_tx uuid;
  v_history_id uuid;
  v_account_minor bigint;
  v_booking_id uuid := gen_random_uuid();
  v_xp integer := 5;
  v_result jsonb;
BEGIN
  IF p_user_id IS NULL OR p_destination_city_id IS NULL OR p_idempotency_key IS NULL THEN
    RAISE EXCEPTION 'travel_invalid_request' USING ERRCODE = '22023';
  END IF;
  IF nullif(btrim(p_transport_type), '') IS NULL THEN
    RAISE EXCEPTION 'travel_transport_required' USING ERRCODE = '22023';
  END IF;
  IF p_raw_fare IS NULL OR p_raw_fare < 0 OR p_raw_duration_hours IS NULL OR p_raw_duration_hours <= 0 THEN
    RAISE EXCEPTION 'travel_invalid_quote' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO v_profile
  FROM public.profiles
  WHERE user_id = p_user_id
    AND coalesce(is_active, true) = true
    AND died_at IS NULL
  ORDER BY created_at DESC
  LIMIT 1
  FOR UPDATE;

  IF v_profile.id IS NULL THEN
    RAISE EXCEPTION 'travel_profile_not_found' USING ERRCODE = 'P0001';
  END IF;

  SELECT result_snapshot INTO v_existing
  FROM public.authoritative_travel_bookings
  WHERE profile_id = v_profile.id
    AND idempotency_key = p_idempotency_key;
  IF v_existing IS NOT NULL THEN
    RETURN v_existing || jsonb_build_object('idempotent', true);
  END IF;

  IF v_profile.current_city_id IS NULL THEN
    RAISE EXCEPTION 'travel_current_city_not_set' USING ERRCODE = 'P0001';
  END IF;
  IF v_profile.current_city_id = p_destination_city_id THEN
    RAISE EXCEPTION 'travel_destination_is_current_city' USING ERRCODE = 'P0001';
  END IF;
  IF coalesce(v_profile.is_traveling, false) THEN
    RAISE EXCEPTION 'travel_already_in_progress' USING ERRCODE = 'P0001';
  END IF;

  SELECT * INTO v_from_city FROM public.cities WHERE id = v_profile.current_city_id;
  SELECT * INTO v_to_city FROM public.cities WHERE id = p_destination_city_id;
  IF v_from_city.id IS NULL OR v_to_city.id IS NULL THEN
    RAISE EXCEPTION 'travel_city_not_found' USING ERRCODE = 'P0001';
  END IF;

  v_departure := CASE
    WHEN lower(p_transport_type) = 'private_jet' THEN now()
    ELSE p_departure_time
  END;
  IF v_departure IS NULL THEN
    RAISE EXCEPTION 'travel_departure_required' USING ERRCODE = '22023';
  END IF;
  IF lower(p_transport_type) <> 'private_jet'
     AND v_departure < now() + interval '30 minutes' THEN
    RAISE EXCEPTION 'travel_departure_too_soon' USING ERRCODE = 'P0001';
  END IF;

  SELECT coalesce(transport, 50) INTO v_from_transport
  FROM public.city_development WHERE city_id = v_from_city.id;
  IF NOT FOUND THEN v_from_transport := 50; END IF;
  SELECT coalesce(transport, 50) INTO v_to_transport
  FROM public.city_development WHERE city_id = v_to_city.id;
  IF NOT FOUND THEN v_to_transport := 50; END IF;

  v_average_transport := greatest(0, least(100, (v_from_transport + v_to_transport) / 2.0));
  v_cost_multiplier := 1.10 - v_average_transport * 0.002;
  v_duration_multiplier := 1.08 - v_average_transport * 0.0016;
  v_adjusted_fare := greatest(0, round(p_raw_fare * v_cost_multiplier)::integer);
  v_adjusted_duration := greatest(0.1, round((p_raw_duration_hours * v_duration_multiplier) * 10) / 10.0);

  SELECT round(coalesce(travel_tax, 0))::integer INTO v_travel_tax
  FROM public.city_laws
  WHERE city_id = v_from_city.id
    AND effective_from <= v_departure
    AND (effective_until IS NULL OR effective_until > v_departure)
  ORDER BY effective_from DESC
  LIMIT 1;
  v_travel_tax := greatest(0, coalesce(v_travel_tax, 0));
  v_total_cost := v_adjusted_fare + v_travel_tax;
  v_arrival := v_departure + make_interval(secs => round(v_adjusted_duration * 3600)::integer);
  v_starts_immediately := v_departure <= now() + interval '1 minute';

  SELECT EXISTS (
    SELECT 1
    FROM public.player_scheduled_activities a
    WHERE a.profile_id = v_profile.id
      AND a.status IN ('scheduled','in_progress')
      AND a.scheduled_start < v_arrival
      AND a.scheduled_end > v_departure
  ) INTO v_conflict;
  IF v_conflict THEN
    RAISE EXCEPTION 'travel_schedule_conflict' USING ERRCODE = 'P0001';
  END IF;

  SELECT * INTO v_activity
  FROM public.profile_activity_statuses
  WHERE profile_id = v_profile.id
  FOR UPDATE;
  IF FOUND
     AND coalesce(v_activity.status, 'active') NOT IN ('idle','completed','cancelled')
     AND (v_activity.ends_at IS NULL OR v_activity.ends_at > v_departure) THEN
    RAISE EXCEPTION 'travel_activity_conflict' USING ERRCODE = 'P0001';
  END IF;

  -- Fare leaves the player economy as a transport cost; the mayor levy moves to
  -- the departure city's canonical account and City Hall treasury projection.
  IF v_adjusted_fare > 0 THEN
    v_fare_tx := public.finance_debit_owner(
      'player', v_profile.id, v_adjusted_fare::bigint * 100,
      'travel_cost',
      'Travel fare: ' || v_from_city.name || ' to ' || v_to_city.name || ' by ' || p_transport_type,
      'travel-fare:' || p_idempotency_key::text,
      v_profile.id,
      jsonb_build_object(
        'source', 'authoritative_travel',
        'bookingId', v_booking_id,
        'fromCityId', v_from_city.id,
        'toCityId', v_to_city.id,
        'transportType', p_transport_type,
        'averageTransportRating', v_average_transport
      )
    );
  END IF;

  IF v_travel_tax > 0 THEN
    v_tax_tx := public.finance_transfer(
      'player', v_profile.id,
      'city', v_from_city.id,
      v_travel_tax::bigint * 100,
      'travel_tax',
      'City travel tax: ' || v_from_city.name,
      'travel-tax:' || p_idempotency_key::text,
      'travel_booking', v_booking_id,
      v_profile.id,
      jsonb_build_object(
        'source', 'authoritative_travel',
        'taxingCityId', v_from_city.id,
        'destinationCityId', v_to_city.id,
        'transportType', p_transport_type
      )
    );
    PERFORM public.credit_city_treasury(
      v_from_city.id,
      v_travel_tax,
      'travel_tax',
      'Travel levy for ' || coalesce(v_profile.display_name, v_profile.username, 'traveller') ||
        ': ' || v_from_city.name || ' to ' || v_to_city.name,
      v_booking_id
    );
  END IF;

  SELECT current_balance_minor INTO v_account_minor
  FROM public.financial_accounts
  WHERE owner_type = 'player' AND owner_id = v_profile.id AND is_primary
  LIMIT 1;
  UPDATE public.profiles
  SET cash = coalesce(v_account_minor, 0)::numeric / 100.0,
      is_traveling = CASE WHEN v_starts_immediately THEN true ELSE is_traveling END,
      travel_arrives_at = CASE WHEN v_starts_immediately THEN v_arrival ELSE travel_arrives_at END
  WHERE id = v_profile.id;

  INSERT INTO public.player_travel_history(
    user_id, profile_id, from_city_id, to_city_id, transport_type,
    cost_paid, travel_duration_hours, departure_time, scheduled_departure_time,
    arrival_time, status
  ) VALUES (
    p_user_id, v_profile.id, v_from_city.id, v_to_city.id, p_transport_type,
    v_total_cost, greatest(1, ceil(v_adjusted_duration)::integer), v_departure, v_departure,
    v_arrival, CASE WHEN v_starts_immediately THEN 'in_progress' ELSE 'scheduled' END
  ) RETURNING id INTO v_history_id;

  INSERT INTO public.player_scheduled_activities(
    user_id, profile_id, activity_type, status, scheduled_start, scheduled_end,
    title, description, location, metadata
  ) VALUES (
    p_user_id, v_profile.id, 'travel',
    CASE WHEN v_starts_immediately THEN 'in_progress' ELSE 'scheduled' END,
    v_departure, v_arrival,
    'Travel: ' || v_from_city.name || ' → ' || v_to_city.name,
    p_transport_type || ' journey (' || v_adjusted_duration || 'h)',
    v_to_city.name || ', ' || v_to_city.country,
    jsonb_build_object(
      'travel_history_id', v_history_id,
      'authoritative_travel_booking_id', v_booking_id,
      'from_city_id', v_from_city.id,
      'to_city_id', v_to_city.id,
      'transport_type', p_transport_type,
      'fare', v_adjusted_fare,
      'travel_tax', v_travel_tax,
      'total_cost', v_total_cost,
      'average_transport_rating', v_average_transport
    )
  );

  BEGIN
    PERFORM public.progression_award_action_xp(
      v_profile.id, 5, 'general', 'travel_booking',
      jsonb_build_object(
        'unique_event_id', 'travel:' || v_booking_id::text,
        'source', 'authoritative_travel',
        'travel_booking_id', v_booking_id,
        'from_city_id', v_from_city.id,
        'to_city_id', v_to_city.id,
        'transport_type', p_transport_type
      )
    );
  EXCEPTION WHEN check_violation THEN
    v_xp := 0;
  END;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='activity_feed' AND column_name='profile_id'
  ) THEN
    EXECUTE 'INSERT INTO public.activity_feed(user_id,profile_id,activity_type,message,earnings,metadata) VALUES($1,$2,''travel'',$3,NULL,$4)'
    USING p_user_id, v_profile.id,
      CASE WHEN v_starts_immediately THEN 'Started travel from ' ELSE 'Booked travel from ' END ||
        v_from_city.name || ' to ' || v_to_city.name || ' by ' || p_transport_type,
      jsonb_build_object(
        'authoritative_travel_booking_id', v_booking_id,
        'travel_history_id', v_history_id,
        'from_city_id', v_from_city.id,
        'to_city_id', v_to_city.id,
        'transport_type', p_transport_type,
        'fare', v_adjusted_fare,
        'travel_tax', v_travel_tax,
        'total_cost', v_total_cost,
        'duration_hours', v_adjusted_duration,
        'xp_gained', v_xp,
        'scheduled_departure_time', v_departure,
        'travel_status', CASE WHEN v_starts_immediately THEN 'in_progress' ELSE 'scheduled' END
      );
  END IF;

  v_result := jsonb_build_object(
    'bookingId', v_booking_id,
    'travelHistoryId', v_history_id,
    'profileId', v_profile.id,
    'fromCityId', v_from_city.id,
    'fromCityName', v_from_city.name,
    'toCityId', v_to_city.id,
    'toCityName', v_to_city.name,
    'transportType', p_transport_type,
    'rawFare', p_raw_fare,
    'fare', v_adjusted_fare,
    'travelTax', v_travel_tax,
    'totalCost', v_total_cost,
    'rawDurationHours', p_raw_duration_hours,
    'durationHours', v_adjusted_duration,
    'averageTransportRating', v_average_transport,
    'transportCostMultiplier', v_cost_multiplier,
    'transportDurationMultiplier', v_duration_multiplier,
    'scheduledDepartureTime', v_departure,
    'arrivalTime', v_arrival,
    'status', CASE WHEN v_starts_immediately THEN 'in_progress' ELSE 'scheduled' END,
    'xpGained', v_xp,
    'idempotent', false
  );

  INSERT INTO public.authoritative_travel_bookings(
    id, user_id, profile_id, from_city_id, to_city_id, transport_type,
    raw_fare, adjusted_fare, travel_tax, total_cost,
    raw_duration_hours, adjusted_duration_hours, average_transport_rating,
    transport_cost_multiplier, transport_duration_multiplier,
    scheduled_departure_time, arrival_time, travel_history_id,
    fare_transaction_id, tax_transaction_id, idempotency_key,
    quote_snapshot, result_snapshot
  ) VALUES (
    v_booking_id, p_user_id, v_profile.id, v_from_city.id, v_to_city.id, p_transport_type,
    p_raw_fare, v_adjusted_fare, v_travel_tax, v_total_cost,
    p_raw_duration_hours, v_adjusted_duration, v_average_transport,
    v_cost_multiplier, v_duration_multiplier,
    v_departure, v_arrival, v_history_id,
    v_fare_tx, v_tax_tx, p_idempotency_key,
    coalesce(p_quote_snapshot, '{}'::jsonb), v_result
  );

  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.book_authoritative_travel(uuid,uuid,text,timestamptz,integer,numeric,uuid,jsonb)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.book_authoritative_travel(uuid,uuid,text,timestamptz,integer,numeric,uuid,jsonb)
  TO service_role;

NOTIFY pgrst, 'reload schema';
