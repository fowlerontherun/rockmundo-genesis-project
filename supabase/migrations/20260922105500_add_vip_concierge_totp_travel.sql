-- Extend VIP Travel Concierge to accepted Top of the Pops appearances.
-- TOTP travel is server-authoritative, profile-scoped and included with active VIP.

CREATE OR REPLACE FUNCTION public.book_vip_totp_concierge_travel(
  p_profile_id uuid,
  p_invitation_id uuid,
  p_idempotency_key uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_profile public.profiles%ROWTYPE;
  v_inv record;
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
  IF p_profile_id IS NULL OR p_invitation_id IS NULL OR p_idempotency_key IS NULL THEN
    RAISE EXCEPTION 'vip_totp_concierge_invalid_request' USING ERRCODE='22023';
  END IF;

  SELECT * INTO v_profile
  FROM public.profiles
  WHERE id = p_profile_id
    AND died_at IS NULL
    AND deleted_at IS NULL
  FOR UPDATE;

  IF v_profile.id IS NULL THEN
    RAISE EXCEPTION 'vip_totp_concierge_profile_not_found' USING ERRCODE='P0001';
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
    RAISE EXCEPTION 'vip_totp_concierge_requires_active_vip' USING ERRCODE='42501';
  END IF;

  SELECT result_snapshot INTO v_existing
  FROM public.authoritative_travel_bookings
  WHERE profile_id = v_profile.id
    AND idempotency_key = p_idempotency_key;

  IF v_existing IS NOT NULL THEN
    RETURN v_existing || jsonb_build_object('idempotent', true);
  END IF;

  SELECT
    i.id AS invitation_id,
    i.band_id,
    i.status AS invitation_status,
    e.id AS episode_id,
    e.episode_number,
    e.status AS episode_status,
    e.city_id,
    e.check_in_at,
    e.broadcast_at
  INTO v_inv
  FROM public.totp_invitations i
  JOIN public.totp_episodes e ON e.id = i.episode_id
  WHERE i.id = p_invitation_id;

  IF v_inv.invitation_id IS NULL
     OR v_inv.invitation_status <> 'accepted'
     OR v_inv.episode_status IN ('completed','cancelled') THEN
    RETURN jsonb_build_object('status','totp_not_eligible','booked',false);
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.band_members bm
    WHERE bm.band_id = v_inv.band_id
      AND bm.profile_id = v_profile.id
      AND coalesce(bm.member_status, 'active') = 'active'
      AND coalesce(bm.is_touring_member, false) = false
  ) THEN
    RAISE EXCEPTION 'vip_totp_concierge_not_performer' USING ERRCODE='42501';
  END IF;

  IF v_profile.current_city_id IS NULL OR v_inv.city_id IS NULL THEN
    RAISE EXCEPTION 'vip_totp_concierge_city_missing' USING ERRCODE='P0001';
  END IF;

  IF v_profile.current_city_id = v_inv.city_id THEN
    RETURN jsonb_build_object('status','already_in_city','booked',false);
  END IF;

  IF coalesce(v_profile.is_traveling, false) OR EXISTS (
    SELECT 1
    FROM public.player_travel_history th
    WHERE th.profile_id = v_profile.id
      AND th.status IN ('scheduled','in_progress')
  ) THEN
    RETURN jsonb_build_object('status','travel_already_planned','booked',false);
  END IF;

  SELECT * INTO v_from FROM public.cities WHERE id = v_profile.current_city_id;
  SELECT * INTO v_to FROM public.cities WHERE id = v_inv.city_id;

  IF v_from.id IS NULL OR v_to.id IS NULL OR
     v_from.latitude IS NULL OR v_from.longitude IS NULL OR
     v_to.latitude IS NULL OR v_to.longitude IS NULL THEN
    RAISE EXCEPTION 'vip_totp_concierge_city_coordinates_missing' USING ERRCODE='P0001';
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

  -- Keep the global 30-minute travel reduction used by the existing VIP concierge.
  v_duration := greatest(0.5, round((v_duration - 0.5) * 10) / 10.0);

  -- Aim to arrive 30 minutes before the studio call/check-in time.
  v_departure := v_inv.check_in_at
    - make_interval(secs => round((v_duration + 0.5) * 3600)::integer);

  -- As with gig concierge, wait until close to departure so the player's current
  -- location remains authoritative and last-minute movement can still be respected.
  IF v_departure > now() + interval '70 minutes' THEN
    RETURN jsonb_build_object(
      'status','not_due',
      'booked',false,
      'transportType',v_mode,
      'plannedDeparture',v_departure,
      'estimatedDurationHours',v_duration,
      'checkInAt',v_inv.check_in_at
    );
  END IF;

  v_departure := greatest(now(), v_departure);
  v_arrival := v_departure + make_interval(secs => round(v_duration * 3600)::integer);
  v_status := CASE
    WHEN v_departure <= now() + interval '1 minute' THEN 'in_progress'
    ELSE 'scheduled'
  END;

  INSERT INTO public.player_travel_history(
    user_id, profile_id, from_city_id, to_city_id, transport_type,
    cost_paid, travel_duration_hours, departure_time, scheduled_departure_time,
    arrival_time, status
  ) VALUES (
    v_profile.user_id, v_profile.id, v_from.id, v_to.id, v_mode,
    0, v_duration, v_departure, v_departure,
    v_arrival, v_status
  )
  RETURNING id INTO v_history_id;

  INSERT INTO public.player_scheduled_activities(
    user_id, profile_id, activity_type, status, scheduled_start, scheduled_end,
    title, description, location, metadata
  ) VALUES (
    v_profile.user_id,
    v_profile.id,
    'travel',
    v_status,
    v_departure,
    v_arrival,
    'VIP Travel Concierge: ' || v_from.name || ' → ' || v_to.name,
    initcap(replace(v_mode, '_', ' ')) || ' arranged automatically for Top of the Pops',
    v_to.name || ', ' || v_to.country,
    jsonb_build_object(
      'travel_history_id', v_history_id,
      'authoritative_travel_booking_id', v_booking_id,
      'event_type', 'top_of_the_pops',
      'totp_invitation_id', v_inv.invitation_id,
      'totp_episode_id', v_inv.episode_id,
      'totp_episode_number', v_inv.episode_number,
      'from_city_id', v_from.id,
      'to_city_id', v_to.id,
      'transport_type', v_mode,
      'vip_concierge', true,
      'service', v_service_label,
      'included_with_vip', true,
      'check_in_at', v_inv.check_in_at,
      'broadcast_at', v_inv.broadcast_at,
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
    'eventType', 'top_of_the_pops',
    'totpInvitationId', v_inv.invitation_id,
    'totpEpisodeId', v_inv.episode_id,
    'totpEpisodeNumber', v_inv.episode_number,
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
    'checkInAt', v_inv.check_in_at,
    'broadcastAt', v_inv.broadcast_at,
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
      'formulaVersion','vip-totp-concierge-v1',
      'vipConcierge',true,
      'eventType','top_of_the_pops',
      'totpInvitationId',v_inv.invitation_id,
      'totpEpisodeId',v_inv.episode_id,
      'distanceKm',round(v_distance),
      'service',v_service_label,
      'checkInAt',v_inv.check_in_at,
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
      'VIP Travel Concierge arranged a ' || v_service_label || ' from ' ||
        v_from.name || ' to ' || v_to.name || ' for Top of the Pops',
      jsonb_build_object(
        'event_type','top_of_the_pops',
        'totp_invitation_id',v_inv.invitation_id,
        'totp_episode_id',v_inv.episode_id,
        'vip_concierge',true,
        'travel_history_id',v_history_id,
        'transport_type',v_mode
      )
    );
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;

  BEGIN
    INSERT INTO public.player_inbox(user_id, category, title, message, metadata)
    VALUES (
      v_profile.user_id,
      'travel',
      'VIP Travel Concierge arranged for Top of the Pops',
      'Your ' || v_service_label || ' to ' || v_to.name ||
        ' has been arranged automatically for your Top of the Pops studio call.',
      jsonb_build_object(
        'profile_id',v_profile.id,
        'event_type','top_of_the_pops',
        'totp_invitation_id',v_inv.invitation_id,
        'totp_episode_id',v_inv.episode_id,
        'vip_concierge',true,
        'travel_history_id',v_history_id,
        'transport_type',v_mode,
        'arrival_time',v_arrival,
        'check_in_at',v_inv.check_in_at
      )
    );
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;

  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.book_vip_totp_concierge_travel(uuid,uuid,uuid)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.book_vip_totp_concierge_travel(uuid,uuid,uuid)
  TO service_role;

CREATE OR REPLACE FUNCTION public.auto_prepare_totp_travel()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  r record;
  v_hash text;
  v_key uuid;
  v_result jsonb;
  v_booked integer := 0;
  v_skipped integer := 0;
  v_failed integer := 0;
BEGIN
  FOR r IN
    SELECT
      i.id AS invitation_id,
      e.check_in_at,
      p.id AS profile_id
    FROM public.totp_invitations i
    JOIN public.totp_episodes e ON e.id = i.episode_id
    JOIN public.band_members bm ON bm.band_id = i.band_id
    JOIN public.profiles p ON p.id = bm.profile_id
    WHERE i.status = 'accepted'
      AND e.status NOT IN ('completed','cancelled')
      AND e.check_in_at >= now() - interval '24 hours'
      AND e.check_in_at <= now() + interval '72 hours'
      AND coalesce(bm.member_status, 'active') = 'active'
      AND coalesce(bm.is_touring_member, false) = false
      AND p.died_at IS NULL
      AND p.deleted_at IS NULL
      AND coalesce(p.vip_gig_concierge_enabled, true) = true
      AND EXISTS (
        SELECT 1
        FROM public.vip_subscriptions vs
        WHERE vs.user_id = p.user_id
          AND vs.status = 'active'
          AND vs.expires_at >= now()
      )
      AND p.current_city_id IS DISTINCT FROM e.city_id
      AND coalesce(p.is_traveling, false) = false
      AND NOT EXISTS (
        SELECT 1
        FROM public.player_travel_history th
        WHERE th.profile_id = p.id
          AND th.status IN ('scheduled','in_progress')
      )
    ORDER BY e.check_in_at, i.id, p.id
  LOOP
    BEGIN
      v_hash := md5('vip-totp-concierge:' || r.invitation_id::text || ':' || r.profile_id::text);
      v_key := (
        substr(v_hash, 1, 8) || '-' ||
        substr(v_hash, 9, 4) || '-4' ||
        substr(v_hash, 14, 3) || '-8' ||
        substr(v_hash, 18, 3) || '-' ||
        substr(v_hash, 21, 12)
      )::uuid;

      v_result := public.book_vip_totp_concierge_travel(
        r.profile_id,
        r.invitation_id,
        v_key
      );

      IF coalesce((v_result->>'booked')::boolean, (v_result->>'bookingId') IS NOT NULL) THEN
        v_booked := v_booked + 1;
      ELSE
        v_skipped := v_skipped + 1;
      END IF;
    EXCEPTION WHEN OTHERS THEN
      v_failed := v_failed + 1;
    END;
  END LOOP;

  RETURN jsonb_build_object(
    'booked', v_booked,
    'skipped', v_skipped,
    'failed', v_failed
  );
END;
$$;

REVOKE ALL ON FUNCTION public.auto_prepare_totp_travel()
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.auto_prepare_totp_travel()
  TO service_role;

DO $$
DECLARE
  v_job_id bigint;
BEGIN
  SELECT jobid INTO v_job_id
  FROM cron.job
  WHERE jobname = 'auto_prepare_totp_travel';

  IF v_job_id IS NOT NULL THEN
    PERFORM cron.unschedule(v_job_id);
  END IF;

  PERFORM cron.schedule(
    'auto_prepare_totp_travel',
    '*/5 * * * *',
    $cron$SELECT public.auto_prepare_totp_travel();$cron$
  );
END;
$$;

COMMENT ON FUNCTION public.book_vip_totp_concierge_travel(uuid,uuid,uuid) IS
  'Books free VIP concierge travel for an accepted Top of the Pops performer, targeting arrival before studio check-in.';
COMMENT ON FUNCTION public.auto_prepare_totp_travel() IS
  'Five-minute server-side sweep that dispatches VIP Travel Concierge for accepted Top of the Pops appearances when travel becomes due.';
