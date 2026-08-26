-- Automatic gig travel is opt-in per active character.
-- Live production was updated directly first; this migration records the same behaviour for source parity.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS auto_travel_for_gigs boolean NOT NULL DEFAULT false;

CREATE OR REPLACE FUNCTION public.start_gig_authoritative(p_gig_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  g public.gigs%ROWTYPE;
  v_venue_city uuid;
  v_missing_count integer := 0;
BEGIN
  SELECT * INTO g FROM public.gigs WHERE id = p_gig_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'gig_not_found' USING ERRCODE='P0002';
  END IF;

  IF auth.role() <> 'service_role' AND NOT public.caller_in_band(g.band_id) THEN
    RAISE EXCEPTION 'not_authorised' USING ERRCODE='42501';
  END IF;

  IF g.started_at IS NOT NULL OR g.status IN ('in_progress','ready_for_completion','processing_outcome') THEN
    RETURN jsonb_build_object('alreadyStarted', true, 'startedAt', g.started_at, 'status', g.status);
  END IF;

  IF g.status = 'completed' THEN
    RETURN jsonb_build_object('alreadyStarted', true, 'completed', true, 'status', g.status);
  END IF;

  IF g.status <> 'scheduled' THEN
    RAISE EXCEPTION 'gig_cannot_start_from_status:%', g.status;
  END IF;

  IF g.scheduled_date > now() THEN
    RAISE EXCEPTION 'gig_not_due_yet';
  END IF;

  SELECT city_id INTO v_venue_city
  FROM public.venues
  WHERE id = g.venue_id;

  IF v_venue_city IS NULL THEN
    RAISE EXCEPTION 'gig_venue_city_missing';
  END IF;

  SELECT count(*) INTO v_missing_count
  FROM public.band_members bm
  JOIN public.profiles p ON p.id = bm.profile_id
  WHERE bm.band_id = g.band_id
    AND coalesce(bm.member_status, 'active') = 'active'
    AND coalesce(p.is_active, true) = true
    AND p.died_at IS NULL
    AND (
      p.current_city_id IS DISTINCT FROM v_venue_city
      OR coalesce(p.is_traveling, false)
    );

  IF v_missing_count > 0 THEN
    RAISE EXCEPTION 'gig_performer_not_in_venue_city' USING ERRCODE='P0001';
  END IF;

  UPDATE public.gigs
  SET status = 'in_progress',
      started_at = coalesce(started_at, now()),
      current_song_position = coalesce(current_song_position, 0),
      updated_at = now()
  WHERE id = p_gig_id
  RETURNING * INTO g;

  RETURN jsonb_build_object(
    'alreadyStarted', false,
    'startedAt', g.started_at,
    'status', g.status
  );
END;
$$;

REVOKE ALL ON FUNCTION public.start_gig_authoritative(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.start_gig_authoritative(uuid) TO authenticated, service_role;

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
BEGIN
  FOR r IN
    SELECT
      g.id AS gig_id,
      g.scheduled_date,
      v.city_id AS venue_city_id,
      p.id AS profile_id,
      p.user_id,
      p.current_city_id,
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
      AND g.scheduled_date > now()
      AND g.scheduled_date <= now() + interval '72 hours'
      AND coalesce(bm.member_status, 'active') = 'active'
      AND p.auto_travel_for_gigs = true
      AND coalesce(p.is_active, true) = true
      AND p.died_at IS NULL
      AND coalesce(p.is_traveling, false) = false
      AND p.current_city_id IS DISTINCT FROM v.city_id
      AND NOT EXISTS (
        SELECT 1
        FROM public.player_travel_history th
        WHERE th.profile_id = p.id
          AND th.status IN ('scheduled','in_progress')
      )
    ORDER BY g.scheduled_date
  LOOP
    BEGIN
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

      -- Leave far-future travel alone so the player's origin cannot become stale.
      IF v_desired_departure > now() + interval '60 minutes' THEN
        v_skipped := v_skipped + 1;
        CONTINUE;
      END IF;

      -- Normal travel requires at least 30 minutes notice; keep a small buffer.
      v_departure := greatest(now() + interval '35 minutes', v_desired_departure);

      -- Stable UUID per profile/gig makes repeated worker runs idempotent.
      v_key := (
        substr(md5('gig-auto:' || r.gig_id::text || ':' || r.profile_id::text), 1, 8) || '-' ||
        substr(md5('gig-auto:' || r.gig_id::text || ':' || r.profile_id::text), 9, 4) || '-4' ||
        substr(md5('gig-auto:' || r.gig_id::text || ':' || r.profile_id::text), 14, 3) || '-8' ||
        substr(md5('gig-auto:' || r.gig_id::text || ':' || r.profile_id::text), 18, 3) || '-' ||
        substr(md5('gig-auto:' || r.gig_id::text || ':' || r.profile_id::text), 21, 12)
      )::uuid;

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
    'skipped', v_skipped,
    'failed', v_failed
  );
END;
$$;

REVOKE ALL ON FUNCTION public.auto_prepare_gig_travel() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.auto_prepare_gig_travel() TO service_role;

CREATE OR REPLACE FUNCTION public.auto_start_scheduled_gigs()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_gig record;
BEGIN
  PERFORM public.auto_prepare_gig_travel();

  FOR v_gig IN
    SELECT id
    FROM public.gigs
    WHERE status = 'scheduled'
      AND scheduled_date <= now()
      AND started_at IS NULL
    ORDER BY scheduled_date
  LOOP
    BEGIN
      PERFORM public.start_gig_authoritative(v_gig.id);
    EXCEPTION WHEN OTHERS THEN
      -- A wrong-city player defers the show instead of allowing remote performance.
      RAISE LOG '[gig-auto-start] deferred gig=% code=% message=%',
        v_gig.id, SQLSTATE, SQLERRM;
    END;
  END LOOP;
END;
$$;

REVOKE ALL ON FUNCTION public.auto_start_scheduled_gigs() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.auto_start_scheduled_gigs() TO service_role;

NOTIFY pgrst, 'reload schema';