-- Character-scoped recording travel safety net.
-- Mirrors the gig auto-travel model for scheduled band recording sessions.

CREATE OR REPLACE FUNCTION public.auto_prepare_recording_travel()
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
      rs.id AS recording_session_id,
      rs.scheduled_start,
      rs.scheduled_end,
      coalesce(rs.city_id, cs.city_id) AS studio_city_id,
      p.id AS profile_id,
      p.user_id,
      p.current_city_id,
      coalesce(p.auto_travel_for_gigs, false) AS auto_travel_enabled,
      coalesce(bm.travels_with_band, false) AS travels_with_band,
      fc.name AS from_name,
      fc.country AS from_country,
      fc.latitude AS from_lat,
      fc.longitude AS from_lon,
      tc.name AS to_name,
      tc.country AS to_country,
      tc.latitude AS to_lat,
      tc.longitude AS to_lon
    FROM public.recording_sessions rs
    LEFT JOIN public.city_studios cs ON cs.id = rs.studio_id
    JOIN public.band_members bm ON bm.band_id = rs.band_id
    JOIN public.profiles p ON p.id = bm.profile_id
    JOIN public.cities fc ON fc.id = p.current_city_id
    JOIN public.cities tc ON tc.id = coalesce(rs.city_id, cs.city_id)
    WHERE rs.status IN ('scheduled','in_progress')
      AND rs.band_id IS NOT NULL
      AND rs.scheduled_start >= now() - interval '6 hours'
      AND rs.scheduled_start <= now() + interval '72 hours'
      AND rs.scheduled_end > now()
      AND coalesce(bm.member_status, 'active') = 'active'
      AND coalesce(bm.is_touring_member, false) = false
      AND bm.profile_id IS NOT NULL
      AND p.died_at IS NULL
      AND p.deleted_at IS NULL
      AND coalesce(p.is_traveling, false) = false
      AND p.current_city_id IS DISTINCT FROM coalesce(rs.city_id, cs.city_id)
      AND (coalesce(bm.travels_with_band, false) OR coalesce(p.auto_travel_for_gigs, false))
      AND NOT EXISTS (
        SELECT 1
        FROM public.player_travel_history th
        WHERE th.profile_id = p.id
          AND th.status IN ('scheduled','in_progress')
      )
    ORDER BY rs.scheduled_start
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

      v_raw_duration := greatest(0.5, round((v_raw_duration - 0.5) * 10) / 10.0);

      SELECT coalesce(transport, 50) INTO v_from_transport
      FROM public.city_development WHERE city_id = r.current_city_id;
      IF NOT FOUND THEN v_from_transport := 50; END IF;

      SELECT coalesce(transport, 50) INTO v_to_transport
      FROM public.city_development WHERE city_id = r.studio_city_id;
      IF NOT FOUND THEN v_to_transport := 50; END IF;

      v_avg_transport := greatest(0, least(100, (v_from_transport + v_to_transport) / 2.0));
      v_duration_multiplier := 1.08 - v_avg_transport * 0.0016;
      v_est_duration := greatest(0.5, round((v_raw_duration * v_duration_multiplier) * 10) / 10.0);
      v_desired_departure := r.scheduled_start - make_interval(secs => round((v_est_duration + 1.5) * 3600)::integer);

      IF v_desired_departure > now() + interval '60 minutes' THEN
        v_skipped := v_skipped + 1;
        CONTINUE;
      END IF;

      v_departure := greatest(now() + interval '10 minutes', v_desired_departure);
      IF v_departure + make_interval(secs => round(v_est_duration * 3600)::integer) >= r.scheduled_end - interval '15 minutes' THEN
        v_skipped := v_skipped + 1;
        CONTINUE;
      END IF;

      v_key := (
        substr(md5('recording-auto:' || r.recording_session_id::text || ':' || r.profile_id::text), 1, 8) || '-' ||
        substr(md5('recording-auto:' || r.recording_session_id::text || ':' || r.profile_id::text), 9, 4) || '-4' ||
        substr(md5('recording-auto:' || r.recording_session_id::text || ':' || r.profile_id::text), 14, 3) || '-8' ||
        substr(md5('recording-auto:' || r.recording_session_id::text || ':' || r.profile_id::text), 18, 3) || '-' ||
        substr(md5('recording-auto:' || r.recording_session_id::text || ':' || r.profile_id::text), 21, 12)
      )::uuid;

      v_result := public.book_authoritative_travel_for_profile(
        r.user_id,
        r.profile_id,
        r.studio_city_id,
        v_mode,
        v_departure,
        v_raw_fare,
        v_raw_duration,
        v_key,
        jsonb_build_object(
          'formulaVersion', 'auto-recording-travel-v1',
          'autoRecordingTravel', true,
          'bandFollowTravel', coalesce(r.travels_with_band, false),
          'profileId', r.profile_id,
          'recordingSessionId', r.recording_session_id,
          'distanceKm', round(v_distance),
          'arrivalBufferHours', 1.5
        )
      );

      v_booked := v_booked + 1;
    EXCEPTION WHEN OTHERS THEN
      v_failed := v_failed + 1;
      RAISE LOG '[auto-recording-travel] failed session=% profile=% code=% message=%',
        r.recording_session_id, r.profile_id, SQLSTATE, SQLERRM;
    END;
  END LOOP;

  RETURN jsonb_build_object('booked', v_booked, 'skipped', v_skipped, 'failed', v_failed);
END;
$$;

REVOKE ALL ON FUNCTION public.auto_prepare_recording_travel() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.auto_prepare_recording_travel() TO service_role;

SELECT cron.unschedule('auto-prepare-recording-travel')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname='auto-prepare-recording-travel');

SELECT cron.schedule(
  'auto-prepare-recording-travel',
  '*/5 * * * *',
  $$SELECT public.auto_prepare_recording_travel();$$
);

NOTIFY pgrst, 'reload schema';
