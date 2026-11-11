-- Keep legacy duration normalization aligned with schedule_tour_rejoin_atomic.
CREATE FUNCTION public.tour_pickup_arrival(p_leg public.tour_travel_legs)
RETURNS timestamptz LANGUAGE sql STABLE SET search_path = ''
AS $$
  SELECT CASE WHEN p_leg.arrival_date > p_leg.departure_date
    AND p_leg.arrival_date <= p_leg.departure_date + interval '20 hours' THEN p_leg.arrival_date
    ELSE p_leg.departure_date +
      least(20::numeric, greatest(0.5::numeric, coalesce(nullif(p_leg.travel_duration_hours, 0), 3.5)))
      * interval '1 hour'
  END
$$;

-- Use the same transactional departure-city and journey checks as manual rejoin.
CREATE FUNCTION public.process_tour_pickups() RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  v_profile record;
  v_missed record;
  v_pickup uuid;
  v_result jsonb;
  v_now timestamptz := now();
  v_message text;
  v_event_id uuid;
  v_catchup_booked boolean;
  v_booked integer := 0;
  v_misses integer := 0;
  v_failures integer := 0;
BEGIN
  FOR v_profile IN
    SELECT p.id, p.user_id, p.current_city_id,
      coalesce(pref.auto_rejoin_enabled, true) AS auto_rejoin,
      coalesce(pref.in_app_enabled AND pref.notify_rejoin_available, true) AS notify
    FROM public.profiles p
    LEFT JOIN public.travel_notification_preferences pref ON pref.profile_id = p.id
    WHERE p.is_active AND p.died_at IS NULL AND p.deleted_at IS NULL
      AND NOT coalesce(p.is_traveling, false)
      AND EXISTS (
        SELECT 1 FROM public.band_members bm
        JOIN public.tours t ON t.band_id = bm.band_id
        JOIN public.tour_travel_legs l ON l.tour_id = t.id
        WHERE bm.profile_id = p.id AND bm.user_id = p.user_id
          AND bm.member_status = 'active'
          AND (bm.travels_with_band OR EXISTS (
            SELECT 1 FROM public.player_travel_history h WHERE h.profile_id = p.id
              AND h.tour_leg_id = l.id AND h.status = 'scheduled'))
          AND NOT coalesce(bm.is_touring_member, false)
          AND t.status IN ('active', 'scheduled', 'booked') AND NOT coalesce(t.cancelled, false)
          AND l.departure_date <= v_now AND l.status IS DISTINCT FROM 'cancelled'
      )
    ORDER BY p.id
    FOR UPDATE OF p SKIP LOCKED
  LOOP
    BEGIN
      IF EXISTS (SELECT 1 FROM public.player_travel_history h
        WHERE h.profile_id = v_profile.id AND h.status = 'in_progress') THEN
        CONTINUE;
      END IF;

      -- A reserved pickup still departs with auto-rejoin switched off.
      SELECT l.id INTO v_pickup
      FROM public.tour_travel_legs l
      JOIN public.tours t ON t.id = l.tour_id
      JOIN public.band_members bm ON bm.band_id = t.band_id
      LEFT JOIN public.player_travel_history h ON h.tour_leg_id = l.id AND h.profile_id = v_profile.id
      WHERE bm.profile_id = v_profile.id AND bm.user_id = v_profile.user_id
        AND bm.member_status = 'active'
        AND NOT coalesce(bm.is_touring_member, false)
        AND t.status IN ('active', 'scheduled', 'booked') AND NOT coalesce(t.cancelled, false)
        AND l.status IS DISTINCT FROM 'cancelled' AND l.to_city_id IS NOT NULL
        AND l.departure_date >= coalesce(bm.joined_at, '-infinity'::timestamptz)
        AND l.from_city_id = v_profile.current_city_id
        AND l.departure_date <= v_now
        AND public.tour_pickup_arrival(l) > v_now
        AND (h.status = 'scheduled' OR (h.id IS NULL AND bm.travels_with_band AND v_profile.auto_rejoin))
        AND NOT EXISTS (SELECT 1 FROM public.player_scheduled_activities a
          WHERE a.profile_id = v_profile.id AND a.activity_type = 'travel'
            AND a.metadata->>'tour_leg_id' = l.id::text AND a.status IN ('cancelled', 'completed'))
      ORDER BY (h.id IS NOT NULL) DESC, l.departure_date DESC, l.id
      LIMIT 1;

      IF v_pickup IS NOT NULL THEN
        v_result := public.schedule_tour_rejoin_atomic(v_profile.user_id, v_profile.id, v_pickup);
        IF v_result->>'success' = 'true' THEN
          v_booked := v_booked + 1;
          CONTINUE;
        END IF;
      END IF;

      -- Choose the earliest reachable future pickup across affected tours.
      -- Within each tour, only its latest elapsed leg can trigger catch-up.
      v_catchup_booked := false;
      FOR v_missed IN
        WITH latest AS (
          SELECT DISTINCT ON (t.id) l.id, l.tour_id, t.band_id, t.name,
            l.from_city_id, l.to_city_id, l.departure_date, h.status AS travel_status,
            public.tour_pickup_arrival(l) <= v_now AS expired
          FROM public.tour_travel_legs l
          JOIN public.tours t ON t.id = l.tour_id
          JOIN public.band_members bm ON bm.band_id = t.band_id
          LEFT JOIN public.player_travel_history h ON h.tour_leg_id = l.id AND h.profile_id = v_profile.id
          WHERE bm.profile_id = v_profile.id AND bm.user_id = v_profile.user_id
            AND bm.member_status = 'active' AND bm.travels_with_band
            AND NOT coalesce(bm.is_touring_member, false)
            AND t.status IN ('active', 'scheduled', 'booked') AND NOT coalesce(t.cancelled, false)
            AND l.status IS DISTINCT FROM 'cancelled' AND l.from_city_id IS NOT NULL AND l.to_city_id IS NOT NULL
            AND l.departure_date >= coalesce(bm.joined_at, '-infinity'::timestamptz)
            AND l.departure_date <= v_now
            AND (public.tour_pickup_arrival(l) <= v_now
              OR l.from_city_id IS DISTINCT FROM v_profile.current_city_id)
          ORDER BY t.id, l.departure_date DESC, l.id
        )
        SELECT m.*, next.id AS pickup_id
        FROM latest m
        LEFT JOIN LATERAL (
          SELECT l.id, l.departure_date
          FROM public.tour_travel_legs l
          WHERE l.tour_id = m.tour_id AND l.status IS DISTINCT FROM 'cancelled'
            AND l.from_city_id = v_profile.current_city_id AND l.to_city_id IS NOT NULL
            AND l.departure_date > v_now
            AND NOT EXISTS (SELECT 1 FROM public.player_travel_history h
              WHERE h.profile_id = v_profile.id AND h.tour_leg_id = l.id
                AND h.status IN ('cancelled', 'completed'))
            AND NOT EXISTS (SELECT 1 FROM public.player_travel_history h
              WHERE h.profile_id = v_profile.id AND h.status = 'scheduled'
                AND h.tour_leg_id IS DISTINCT FROM l.id
                AND coalesce(h.scheduled_departure_time, h.departure_time) < public.tour_pickup_arrival(l)
                AND h.arrival_time > l.departure_date)
            AND NOT EXISTS (SELECT 1 FROM public.player_scheduled_activities a
              WHERE a.profile_id = v_profile.id AND a.activity_type = 'travel'
                AND a.metadata->>'tour_leg_id' = l.id::text AND a.status IN ('cancelled', 'completed'))
          ORDER BY l.departure_date, l.id LIMIT 1
        ) next ON v_profile.auto_rejoin
        WHERE (m.travel_status IS NULL OR m.travel_status = 'scheduled'
          OR (m.travel_status = 'cancelled' AND EXISTS (
            SELECT 1 FROM public.travel_timeline_events e
            WHERE e.profile_id = v_profile.id AND e.tour_leg_id = m.id AND e.event_type = 'missed_pickup')))
          AND NOT EXISTS (SELECT 1 FROM public.travel_timeline_events e
            WHERE e.profile_id = v_profile.id AND e.tour_leg_id = m.id AND e.event_type = 'missed_pickup'
              AND e.metadata->>'catchup_booked' = 'true')
        ORDER BY next.departure_date NULLS LAST, m.departure_date DESC, m.id
      LOOP
        v_result := NULL;
        IF NOT v_catchup_booked AND v_missed.pickup_id IS NOT NULL THEN
          v_result := public.schedule_tour_rejoin_atomic(v_profile.user_id, v_profile.id, v_missed.pickup_id);
        END IF;

        v_message := 'You missed the pickup for ' || coalesce(v_missed.name, 'your tour') || '. ' ||
          CASE WHEN v_result->>'success' = 'true' THEN
            'Tour transport from ' || coalesce(v_result->>'from_city', 'your current city') || ' is scheduled. Check your travel schedule.'
          WHEN NOT v_profile.auto_rejoin THEN
            'Automatic catch-up is disabled. Check the tour itinerary for your next pickup.'
          ELSE
            'Check the tour itinerary and use normal travel to reach a future pickup.'
          END;
        INSERT INTO public.travel_timeline_events (
          profile_id, user_id, band_id, tour_id, tour_leg_id, from_city_id, to_city_id, event_type, message, metadata
        )
        SELECT v_profile.id, v_profile.user_id, v_missed.band_id, v_missed.tour_id, v_missed.id,
          v_missed.from_city_id, v_missed.to_city_id, 'missed_pickup', v_message,
          jsonb_build_object('catchup_booked', coalesce(v_result->>'success' = 'true', false),
            'catchup_leg_id', CASE WHEN v_result->>'success' = 'true' THEN v_missed.pickup_id END)
        WHERE NOT EXISTS (SELECT 1 FROM public.travel_timeline_events e
          WHERE e.profile_id = v_profile.id AND e.tour_leg_id = v_missed.id AND e.event_type = 'missed_pickup')
        RETURNING id INTO v_event_id;

        -- Expired reservations never become completed journeys. Keep the
        -- missed receipt so catch-up can still be retried from another city.
        IF v_missed.expired AND v_missed.travel_status = 'scheduled' THEN
          UPDATE public.player_travel_history SET status = 'cancelled'
          WHERE profile_id = v_profile.id AND tour_leg_id = v_missed.id AND status = 'scheduled';
          UPDATE public.player_scheduled_activities SET status = 'cancelled'
          WHERE profile_id = v_profile.id AND activity_type = 'travel' AND status = 'scheduled'
            AND metadata->>'tour_leg_id' = v_missed.id::text;
        END IF;

        IF v_event_id IS NOT NULL THEN
          v_misses := v_misses + 1;
          IF v_profile.notify THEN
            INSERT INTO public.player_inbox (
              user_id, category, priority, title, message, metadata, action_type, action_data,
              related_entity_type, related_entity_id
            ) VALUES (
              v_profile.user_id, 'system', 'normal', 'Tour pickup missed', v_message,
              jsonb_build_object('profile_id', v_profile.id, 'tour_id', v_missed.tour_id),
              'navigate', jsonb_build_object('route', '/travel', 'tab', 'history'),
              'travel_timeline_event', v_event_id
            );
          END IF;
        END IF;

        IF v_result->>'success' = 'true' THEN
          UPDATE public.travel_timeline_events
          SET message = v_message,
            metadata = jsonb_build_object('catchup_booked', true, 'catchup_leg_id', v_missed.pickup_id)
          WHERE profile_id = v_profile.id AND tour_leg_id = v_missed.id AND event_type = 'missed_pickup';
          v_booked := v_booked + 1;
          v_catchup_booked := true;
        END IF;
      END LOOP;
    EXCEPTION WHEN OTHERS THEN
      v_failures := v_failures + 1;
      RAISE WARNING 'Tour pickup processing failed for profile % [%]: %', v_profile.id, SQLSTATE, SQLERRM;
    END;
  END LOOP;

  RETURN jsonb_build_object('booked', v_booked, 'missed', v_misses, 'failures', v_failures);
END;
$$;

REVOKE ALL ON FUNCTION public.tour_pickup_arrival(public.tour_travel_legs) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.process_tour_pickups() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.process_tour_pickups() TO service_role;

-- The existing tour worker runs hourly, which can miss a half-hour leg entirely.
-- Run pickup processing independently from the longer arrival job.
SELECT cron.schedule(
  'process-tour-pickups', '*/5 * * * *',
  'SELECT public.process_tour_pickups()'
);
