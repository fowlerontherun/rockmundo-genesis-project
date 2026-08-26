-- VIP Gig Concierge: active VIPs get an always-on-by-default travel safety net for gigs.
-- The concierge uses complimentary chauffeur-driven limo service for suitable domestic
-- trips and a private jet with pilot for longer/urgent trips. It can recover an overdue
-- wrong-city show by travelling immediately while the authoritative gig guard keeps the
-- show waiting until the performer actually arrives.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS vip_gig_concierge_enabled boolean NOT NULL DEFAULT true;

CREATE OR REPLACE FUNCTION public.book_vip_gig_concierge_travel(
  p_profile_id uuid,
  p_gig_id uuid,
  p_idempotency_key uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_profile public.profiles%ROWTYPE;
  v_gig record;
  v_from public.cities%ROWTYPE;
  v_to public.cities%ROWTYPE;
  v_existing jsonb;
  v_distance numeric;
  v_mode text;
  v_service_label text;
  v_duration numeric;
  v_departure timestamptz;
  v_arrival timestamptz;
  v_status text;
  v_history_id uuid;
  v_booking_id uuid := gen_random_uuid();
  v_result jsonb;
BEGIN
  IF p_profile_id IS NULL OR p_gig_id IS NULL OR p_idempotency_key IS NULL THEN
    RAISE EXCEPTION 'vip_concierge_invalid_request' USING ERRCODE='22023';
  END IF;

  SELECT * INTO v_profile
  FROM public.profiles
  WHERE id = p_profile_id
    AND coalesce(is_active, true) = true
    AND died_at IS NULL
  FOR UPDATE;

  IF v_profile.id IS NULL THEN
    RAISE EXCEPTION 'vip_concierge_profile_not_found' USING ERRCODE='P0001';
  END IF;

  IF NOT coalesce(v_profile.vip_gig_concierge_enabled, true) THEN
    RETURN jsonb_build_object('status','disabled','booked',false);
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.vip_subscriptions vs
    WHERE vs.user_id = v_profile.user_id
      AND vs.status = 'active'
      AND vs.expires_at >= now()
  ) THEN
    RAISE EXCEPTION 'vip_concierge_requires_active_vip' USING ERRCODE='42501';
  END IF;

  SELECT result_snapshot INTO v_existing
  FROM public.authoritative_travel_bookings
  WHERE profile_id = v_profile.id
    AND idempotency_key = p_idempotency_key;
  IF v_existing IS NOT NULL THEN
    RETURN v_existing || jsonb_build_object('idempotent', true);
  END IF;

  SELECT g.id, g.band_id, g.scheduled_date, g.status, v.city_id AS venue_city_id
  INTO v_gig
  FROM public.gigs g
  JOIN public.venues v ON v.id = g.venue_id
  WHERE g.id = p_gig_id;

  IF v_gig.id IS NULL OR v_gig.status <> 'scheduled' THEN
    RETURN jsonb_build_object('status','gig_not_eligible','booked',false);
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.band_members bm
    WHERE bm.band_id = v_gig.band_id
      AND bm.profile_id = v_profile.id
      AND coalesce(bm.member_status, 'active') = 'active'
  ) THEN
    RAISE EXCEPTION 'vip_concierge_not_gig_performer' USING ERRCODE='42501';
  END IF;

  IF v_profile.current_city_id IS NULL OR v_gig.venue_city_id IS NULL THEN
    RAISE EXCEPTION 'vip_concierge_city_missing' USING ERRCODE='P0001';
  END IF;

  IF v_profile.current_city_id = v_gig.venue_city_id THEN
    RETURN jsonb_build_object('status','already_in_city','booked',false);
  END IF;

  IF coalesce(v_profile.is_traveling, false) OR EXISTS (
    SELECT 1 FROM public.player_travel_history th
    WHERE th.profile_id = v_profile.id
      AND th.status IN ('scheduled','in_progress')
  ) THEN
    RETURN jsonb_build_object('status','travel_already_planned','booked',false);
  END IF;

  SELECT * INTO v_from FROM public.cities WHERE id = v_profile.current_city_id;
  SELECT * INTO v_to FROM public.cities WHERE id = v_gig.venue_city_id;

  IF v_from.id IS NULL OR v_to.id IS NULL OR
     v_from.latitude IS NULL OR v_from.longitude IS NULL OR
     v_to.latitude IS NULL OR v_to.longitude IS NULL THEN
    RAISE EXCEPTION 'vip_concierge_city_coordinates_missing' USING ERRCODE='P0001';
  END IF;

  v_distance := 6371 * 2 * asin(sqrt(
    power(sin(radians((v_to.latitude - v_from.latitude) / 2)), 2) +
    cos(radians(v_from.latitude)) * cos(radians(v_to.latitude)) *
    power(sin(radians((v_to.longitude - v_from.longitude) / 2)), 2)
  ));

  IF v_from.country = v_to.country AND v_distance <= 500 THEN
    v_mode := 'vip_limo';
    v_service_label := 'chauffeur-driven limo';
    v_duration := greatest(0.4, round((v_distance / 120.0 + 0.20) * 10) / 10.0);
  ELSE
    v_mode := 'vip_private_jet';
    v_service_label := 'private jet with pilot';
    v_duration := greatest(0.6, round((v_distance / 950.0 + 0.60) * 10) / 10.0);
  END IF;

  v_departure := v_gig.scheduled_date - make_interval(secs => round((v_duration + 1.5) * 3600)::integer);

  IF v_departure > now() + interval '70 minutes' THEN
    RETURN jsonb_build_object(
      'status','not_due',
      'booked',false,
      'transportType',v_mode,
      'plannedDeparture',v_departure,
      'estimatedDurationHours',v_duration
    );
  END IF;

  v_departure := greatest(now(), v_departure);
  v_arrival := v_departure + make_interval(secs => round(v_duration * 3600)::integer);
  v_status := CASE WHEN v_departure <= now() + interval '1 minute' THEN 'in_progress' ELSE 'scheduled' END;

  INSERT INTO public.player_travel_history(
    user_id, profile_id, from_city_id, to_city_id, transport_type,
    cost_paid, travel_duration_hours, departure_time, scheduled_departure_time,
    arrival_time, status
  ) VALUES (
    v_profile.user_id, v_profile.id, v_from.id, v_to.id, v_mode,
    0, greatest(1, ceil(v_duration)::integer), v_departure, v_departure,
    v_arrival, v_status
  ) RETURNING id INTO v_history_id;

  INSERT INTO public.player_scheduled_activities(
    user_id, profile_id, activity_type, status, scheduled_start, scheduled_end,
    title, description, location, metadata
  ) VALUES (
    v_profile.user_id, v_profile.id, 'travel', v_status, v_departure, v_arrival,
    'VIP Gig Concierge: ' || v_from.name || ' → ' || v_to.name,
    initcap(replace(v_mode, '_', ' ')) || ' arranged automatically for your gig',
    v_to.name || ', ' || v_to.country,
    jsonb_build_object(
      'travel_history_id', v_history_id,
      'authoritative_travel_booking_id', v_booking_id,
      'gig_id', v_gig.id,
      'from_city_id', v_from.id,
      'to_city_id', v_to.id,
      'transport_type', v_mode,
      'vip_concierge', true,
      'service', v_service_label,
      'included_with_vip', true,
      'fare', 0,
      'travel_tax', 0,
      'total_cost', 0
    )
  );

  IF v_status = 'in_progress' THEN
    UPDATE public.profiles
    SET is_traveling = true,
        travel_arrives_at = v_arrival
    WHERE id = v_profile.id;
  END IF;

  v_result := jsonb_build_object(
    'bookingId', v_booking_id,
    'travelHistoryId', v_history_id,
    'profileId', v_profile.id,
    'gigId', v_gig.id,
    'fromCityId', v_from.id,
    'fromCityName', v_from.name,
    'toCityId', v_to.id,
    'toCityName', v_to.name,
    'transportType', v_mode,
    'service', v_service_label,
    'fare', 0,
    'travelTax', 0,
    'totalCost', 0,
    'durationHours', v_duration,
    'scheduledDepartureTime', v_departure,
    'arrivalTime', v_arrival,
    'status', v_status,
    'includedWithVip', true,
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
    v_booking_id, v_profile.user_id, v_profile.id, v_from.id, v_to.id, v_mode,
    0, 0, 0, 0,
    v_duration, v_duration, 100,
    1, 1,
    v_departure, v_arrival, v_history_id,
    NULL, NULL, p_idempotency_key,
    jsonb_build_object(
      'formulaVersion','vip-gig-concierge-v1',
      'vipConcierge',true,
      'gigId',v_gig.id,
      'distanceKm',round(v_distance),
      'service',v_service_label,
      'includedWithVip',true
    ),
    v_result
  );

  BEGIN
    INSERT INTO public.activity_feed(user_id, profile_id, activity_type, message, metadata)
    VALUES (
      v_profile.user_id,
      v_profile.id,
      'travel',
      'VIP Gig Concierge arranged a ' || v_service_label || ' from ' || v_from.name || ' to ' || v_to.name,
      jsonb_build_object('gig_id',v_gig.id,'vip_concierge',true,'travel_history_id',v_history_id,'transport_type',v_mode)
    );
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;

  BEGIN
    INSERT INTO public.player_inbox(user_id, category, title, message, metadata)
    VALUES (
      v_profile.user_id,
      'travel',
      'VIP Gig Concierge arranged',
      'Your ' || v_service_label || ' to ' || v_to.name || ' has been arranged automatically for your upcoming show.',
      jsonb_build_object('gig_id',v_gig.id,'vip_concierge',true,'travel_history_id',v_history_id,'transport_type',v_mode,'arrival_time',v_arrival)
    );
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;

  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.book_vip_gig_concierge_travel(uuid,uuid,uuid)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.book_vip_gig_concierge_travel(uuid,uuid,uuid)
  TO service_role;

CREATE OR REPLACE FUNCTION public.auto_prepare_gig_travel()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  r record;
  v_distance numeric;
  v_mode text;
  v_raw_fare integer;
  v_raw_duration numeric;
  v_from_transport numeric := 50;
  v_to_transport numeric := 50;
  v_avg_transport numeric := 50;
  v_duration_multiplier numeric := 1;
  v_est_duration numeric;
  v_desired_departure timestamptz;
  v_departure timestamptz;
  v_key uuid;
  v_result jsonb;
  v_booked integer := 0;
  v_skipped integer := 0;
  v_failed integer := 0;
  v_vip_booked integer := 0;
BEGIN
  FOR r IN
    SELECT
      g.id AS gig_id,
      g.scheduled_date,
      v.city_id AS venue_city_id,
      p.id AS profile_id,
      p.user_id,
      p.current_city_id,
      p.auto_travel_for_gigs,
      coalesce(p.vip_gig_concierge_enabled, true) AS vip_gig_concierge_enabled,
      EXISTS (
        SELECT 1 FROM public.vip_subscriptions vs
        WHERE vs.user_id = p.user_id
          AND vs.status = 'active'
          AND vs.expires_at >= now()
      ) AS is_vip,
      fc.name AS from_name,
      fc.country AS from_country,
      fc.region AS from_region,
      fc.latitude AS from_lat,
      fc.longitude AS from_lon,
      tc.name AS to_name,
      tc.country AS to_country,
      tc.region AS to_region,
      tc.latitude AS to_lat,
      tc.longitude AS to_lon
    FROM public.gigs g
    JOIN public.venues v ON v.id = g.venue_id
    JOIN public.band_members bm ON bm.band_id = g.band_id
    JOIN public.profiles p ON p.id = bm.profile_id
    JOIN public.cities fc ON fc.id = p.current_city_id
    JOIN public.cities tc ON tc.id = v.city_id
    WHERE g.status = 'scheduled'
      AND g.scheduled_date >= now() - interval '24 hours'
      AND g.scheduled_date <= now() + interval '72 hours'
      AND coalesce(bm.member_status, 'active') = 'active'
      AND coalesce(p.is_active, true) = true
      AND p.died_at IS NULL
      AND coalesce(p.is_traveling, false) = false
      AND p.current_city_id IS DISTINCT FROM v.city_id
      AND (
        coalesce(p.auto_travel_for_gigs, false) = true
        OR (
          coalesce(p.vip_gig_concierge_enabled, true) = true
          AND EXISTS (
            SELECT 1 FROM public.vip_subscriptions vs2
            WHERE vs2.user_id = p.user_id
              AND vs2.status = 'active'
              AND vs2.expires_at >= now()
          )
        )
      )
      AND NOT EXISTS (
        SELECT 1
        FROM public.player_travel_history th
        WHERE th.profile_id = p.id
          AND th.status IN ('scheduled','in_progress')
      )
    ORDER BY g.scheduled_date
  LOOP
    BEGIN
      v_key := (
        substr(md5(CASE WHEN r.is_vip THEN 'vip-gig-concierge:' ELSE 'gig-auto:' END || r.gig_id::text || ':' || r.profile_id::text), 1, 8) || '-' ||
        substr(md5(CASE WHEN r.is_vip THEN 'vip-gig-concierge:' ELSE 'gig-auto:' END || r.gig_id::text || ':' || r.profile_id::text), 9, 4) || '-4' ||
        substr(md5(CASE WHEN r.is_vip THEN 'vip-gig-concierge:' ELSE 'gig-auto:' END || r.gig_id::text || ':' || r.profile_id::text), 14, 3) || '-8' ||
        substr(md5(CASE WHEN r.is_vip THEN 'vip-gig-concierge:' ELSE 'gig-auto:' END || r.gig_id::text || ':' || r.profile_id::text), 18, 3) || '-' ||
        substr(md5(CASE WHEN r.is_vip THEN 'vip-gig-concierge:' ELSE 'gig-auto:' END || r.gig_id::text || ':' || r.profile_id::text), 21, 12)
      )::uuid;

      IF r.is_vip AND r.vip_gig_concierge_enabled THEN
        v_result := public.book_vip_gig_concierge_travel(r.profile_id, r.gig_id, v_key);
        IF coalesce((v_result->>'booked')::boolean, (v_result->>'bookingId') IS NOT NULL) THEN
          v_booked := v_booked + 1;
          v_vip_booked := v_vip_booked + 1;
        ELSE
          v_skipped := v_skipped + 1;
        END IF;
        CONTINUE;
      END IF;

      IF r.scheduled_date < now() OR NOT coalesce(r.auto_travel_for_gigs, false) THEN
        v_skipped := v_skipped + 1;
        CONTINUE;
      END IF;

      IF r.from_lat IS NULL OR r.from_lon IS NULL OR r.to_lat IS NULL OR r.to_lon IS NULL THEN
        v_failed := v_failed + 1;
        CONTINUE;
      END IF;

      v_distance := 6371 * 2 * asin(sqrt(
        power(sin(radians((r.to_lat - r.from_lat) / 2)), 2) +
        cos(radians(r.from_lat)) * cos(radians(r.to_lat)) *
        power(sin(radians((r.to_lon - r.from_lon) / 2)), 2)
      ));

      IF r.from_country = r.to_country AND v_distance < 30 THEN
        v_mode := 'bus';
        v_raw_fare := round(10 + v_distance * 0.05)::integer;
        v_raw_duration := round((v_distance / 56 + 0.22) * 10) / 10.0;
      ELSIF r.from_country = r.to_country AND v_distance <= 1500 THEN
        v_mode := 'train';
        v_raw_fare := round(25 + v_distance * 0.12)::integer;
        v_raw_duration := round((v_distance / 200 + 0.45) * 10) / 10.0;
      ELSIF v_distance >= 100 AND v_distance <= 20000 THEN
        v_mode := 'plane';
        v_raw_fare := round(
          150 + least(v_distance, 5000) * 0.12 +
          greatest(least(v_distance, 10000) - 5000, 0) * 0.18 +
          greatest(v_distance - 10000, 0) * 0.24
        )::integer;
        v_raw_duration := round((v_distance / 944 + 2.7) * 10) / 10.0;
      ELSE
        v_skipped := v_skipped + 1;
        CONTINUE;
      END IF;

      SELECT coalesce(transport, 50)
      INTO v_from_transport
      FROM public.city_development
      WHERE city_id = r.current_city_id;
      IF NOT FOUND THEN v_from_transport := 50; END IF;

      SELECT coalesce(transport, 50)
      INTO v_to_transport
      FROM public.city_development
      WHERE city_id = r.venue_city_id;
      IF NOT FOUND THEN v_to_transport := 50; END IF;

      v_avg_transport := greatest(0, least(100, (v_from_transport + v_to_transport) / 2.0));
      v_duration_multiplier := 1.08 - v_avg_transport * 0.0016;
      v_est_duration := greatest(0.1, round((v_raw_duration * v_duration_multiplier) * 10) / 10.0);

      v_desired_departure := r.scheduled_date - make_interval(
        secs => round((v_est_duration + 2.0) * 3600)::integer
      );

      IF v_desired_departure > now() + interval '60 minutes' THEN
        v_skipped := v_skipped + 1;
        CONTINUE;
      END IF;

      v_departure := greatest(now() + interval '35 minutes', v_desired_departure);

      v_result := public.book_authoritative_travel(
        r.user_id,
        r.venue_city_id,
        v_mode,
        v_departure,
        v_raw_fare,
        v_raw_duration,
        v_key,
        jsonb_build_object(
          'formulaVersion', 'auto-gig-travel-v1',
          'autoGigTravel', true,
          'gigId', r.gig_id,
          'distanceKm', round(v_distance),
          'arrivalBufferHours', 2
        )
      );

      v_booked := v_booked + 1;
    EXCEPTION WHEN OTHERS THEN
      v_failed := v_failed + 1;
      RAISE LOG '[auto-gig-travel] failed gig=% profile=% code=% message=%',
        r.gig_id, r.profile_id, SQLSTATE, SQLERRM;
    END;
  END LOOP;

  RETURN jsonb_build_object(
    'booked', v_booked,
    'vipBooked', v_vip_booked,
    'skipped', v_skipped,
    'failed', v_failed
  );
END;
$$;

REVOKE ALL ON FUNCTION public.auto_prepare_gig_travel() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.auto_prepare_gig_travel() TO service_role;

NOTIFY pgrst, 'reload schema';