-- Repair missing tour travel records through authoritative, idempotent transactions.

CREATE UNIQUE INDEX IF NOT EXISTS player_travel_history_tour_leg_profile_uidx
  ON public.player_travel_history (tour_leg_id, profile_id)
  WHERE tour_leg_id IS NOT NULL AND profile_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.regenerate_tour_travel_legs(
  p_tour_id uuid,
  p_request_id uuid
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_tour public.tours%ROWTYPE;
  v_previous record;
  v_stop record;
  v_distance_km numeric;
  v_duration_hours integer;
  v_departure_at timestamptz;
  v_arrival_at timestamptz;
  v_mode text;
  v_created integer := 0;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'tour_travel_repair_unauthenticated' USING ERRCODE = '42501';
  END IF;
  IF p_request_id IS NULL THEN
    RAISE EXCEPTION 'tour_travel_repair_request_invalid' USING ERRCODE = '22023';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended('tour-travel-repair:' || p_tour_id::text, 0));

  SELECT * INTO v_tour FROM public.tours WHERE id = p_tour_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'tour_travel_repair_not_found' USING ERRCODE = 'P0001';
  END IF;
  IF NOT public.can_manage_band_gigs(v_tour.band_id, auth.uid()) THEN
    RAISE EXCEPTION 'tour_travel_repair_forbidden' USING ERRCODE = '42501';
  END IF;
  IF v_tour.status IN ('cancelled', 'completed') OR COALESCE(v_tour.cancelled, false) THEN
    RAISE EXCEPTION 'tour_travel_repair_status_locked' USING ERRCODE = '55000';
  END IF;

  IF EXISTS (SELECT 1 FROM public.tour_travel_legs WHERE tour_id = p_tour_id) THEN
    RETURN jsonb_build_object(
      'tour_id', p_tour_id,
      'created', 0,
      'existing', (SELECT count(*) FROM public.tour_travel_legs WHERE tour_id = p_tour_id),
      'already_repaired', true,
      'request_id', p_request_id
    );
  END IF;

  CREATE TEMP TABLE IF NOT EXISTS pg_temp.tour_repair_stops (
    sequence_no integer,
    city_id uuid,
    gig_at timestamptz,
    latitude numeric,
    longitude numeric
  ) ON COMMIT DROP;
  TRUNCATE pg_temp.tour_repair_stops;

  INSERT INTO pg_temp.tour_repair_stops(sequence_no, city_id, gig_at, latitude, longitude)
  SELECT
    row_number() OVER (ORDER BY g.scheduled_date, g.id)::integer,
    v.city_id,
    g.scheduled_date,
    c.latitude,
    c.longitude
  FROM public.gigs g
  JOIN public.venues v ON v.id = g.venue_id
  JOIN public.cities c ON c.id = v.city_id
  WHERE g.tour_id = p_tour_id
    AND g.status IN ('scheduled', 'in_progress', 'ready_for_completion')
  ORDER BY g.scheduled_date, g.id;

  IF (SELECT count(*) FROM pg_temp.tour_repair_stops) < 2 THEN
    RETURN jsonb_build_object(
      'tour_id', p_tour_id,
      'created', 0,
      'existing', 0,
      'already_repaired', false,
      'request_id', p_request_id
    );
  END IF;

  FOR v_stop IN SELECT * FROM pg_temp.tour_repair_stops ORDER BY sequence_no LOOP
    IF v_stop.sequence_no > 1 THEN
      SELECT * INTO v_previous
      FROM pg_temp.tour_repair_stops
      WHERE sequence_no = v_stop.sequence_no - 1;

      IF v_previous.city_id IS DISTINCT FROM v_stop.city_id THEN
        IF v_previous.latitude IS NOT NULL AND v_previous.longitude IS NOT NULL
           AND v_stop.latitude IS NOT NULL AND v_stop.longitude IS NOT NULL THEN
          v_distance_km := 6371 * acos(least(1, greatest(-1,
            cos(radians(v_previous.latitude)) * cos(radians(v_stop.latitude)) *
            cos(radians(v_stop.longitude) - radians(v_previous.longitude)) +
            sin(radians(v_previous.latitude)) * sin(radians(v_stop.latitude))
          )));
        ELSE
          v_distance_km := 500;
        END IF;

        v_mode := CASE
          WHEN v_tour.travel_mode = 'tour_bus' THEN 'tour_bus'
          WHEN v_tour.travel_mode = 'manual' THEN 'bus'
          WHEN v_distance_km >= 900 THEN 'plane'
          WHEN v_distance_km >= 350 THEN 'train'
          ELSE 'bus'
        END;
        v_duration_hours := greatest(1, ceil(v_distance_km / CASE v_mode
          WHEN 'plane' THEN 800
          WHEN 'train' THEN 180
          WHEN 'tour_bus' THEN 90
          ELSE 75
        END + CASE v_mode WHEN 'plane' THEN 2 WHEN 'train' THEN 1 ELSE 0.5 END)::integer);
        v_departure_at := v_previous.gig_at + interval '3 hours';
        v_arrival_at := v_departure_at + make_interval(hours => v_duration_hours);

        IF v_arrival_at > v_stop.gig_at - interval '2 hours' THEN
          RAISE EXCEPTION 'tour_travel_repair_route_impossible:% to %', v_previous.city_id, v_stop.city_id
            USING ERRCODE = '22023';
        END IF;

        INSERT INTO public.tour_travel_legs(
          tour_id, from_city_id, to_city_id, travel_mode, travel_cost,
          departure_date, arrival_date, travel_duration_hours, status, sequence_order
        ) VALUES (
          p_tour_id, v_previous.city_id, v_stop.city_id, v_mode, 0,
          v_departure_at, v_arrival_at, v_duration_hours, 'scheduled', v_stop.sequence_no - 2
        );
        v_created := v_created + 1;
      END IF;
    END IF;
  END LOOP;

  RETURN jsonb_build_object(
    'tour_id', p_tour_id,
    'created', v_created,
    'existing', 0,
    'already_repaired', false,
    'request_id', p_request_id
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.sync_tour_member_travel(
  p_tour_id uuid,
  p_request_id uuid
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_tour public.tours%ROWTYPE;
  v_travel public.player_travel_history%ROWTYPE;
  v_member record;
  v_leg record;
  v_created integer := 0;
  v_skipped integer := 0;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'tour_member_travel_unauthenticated' USING ERRCODE = '42501';
  END IF;
  IF p_request_id IS NULL THEN
    RAISE EXCEPTION 'tour_member_travel_request_invalid' USING ERRCODE = '22023';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended('tour-member-travel:' || p_tour_id::text, 0));

  SELECT * INTO v_tour FROM public.tours WHERE id = p_tour_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'tour_member_travel_not_found' USING ERRCODE = 'P0001';
  END IF;
  IF NOT public.can_manage_band_gigs(v_tour.band_id, auth.uid()) THEN
    RAISE EXCEPTION 'tour_member_travel_forbidden' USING ERRCODE = '42501';
  END IF;
  IF v_tour.status IN ('cancelled', 'completed') OR COALESCE(v_tour.cancelled, false) THEN
    RAISE EXCEPTION 'tour_member_travel_status_locked' USING ERRCODE = '55000';
  END IF;

  FOR v_leg IN
    SELECT l.*, fc.name AS from_city_name, fc.country AS from_country,
           tc.name AS to_city_name, tc.country AS to_country
    FROM public.tour_travel_legs l
    JOIN public.cities fc ON fc.id = l.from_city_id
    JOIN public.cities tc ON tc.id = l.to_city_id
    WHERE l.tour_id = p_tour_id
      AND l.departure_date >= now()
      AND COALESCE(l.status, 'scheduled') = 'scheduled'
    ORDER BY l.departure_date, l.id
  LOOP
    FOR v_member IN
      SELECT bm.user_id, COALESCE(bm.profile_id, p.id) AS profile_id
      FROM public.band_members bm
      LEFT JOIN public.profiles p ON p.user_id = bm.user_id
      WHERE bm.band_id = v_tour.band_id
        AND COALESCE(bm.member_status, 'active') = 'active'
        AND COALESCE(bm.travels_with_band, true)
        AND bm.user_id IS NOT NULL
        AND COALESCE(bm.profile_id, p.id) IS NOT NULL
    LOOP
      INSERT INTO public.player_travel_history(
        user_id, profile_id, from_city_id, to_city_id, transport_type, cost_paid,
        departure_time, scheduled_departure_time, arrival_time,
        travel_duration_hours, status, tour_leg_id
      ) VALUES (
        v_member.user_id, v_member.profile_id, v_leg.from_city_id, v_leg.to_city_id,
        COALESCE(v_leg.travel_mode, 'bus'), 0, v_leg.departure_date,
        v_leg.departure_date, v_leg.arrival_date,
        greatest(1, COALESCE(v_leg.travel_duration_hours, 1)), 'scheduled', v_leg.id
      )
      ON CONFLICT (tour_leg_id, profile_id)
      WHERE tour_leg_id IS NOT NULL AND profile_id IS NOT NULL
      DO NOTHING
      RETURNING * INTO v_travel;

      IF FOUND THEN
        INSERT INTO public.player_scheduled_activities(
          user_id, profile_id, activity_type, status, scheduled_start, scheduled_end,
          title, description, location, metadata
        )
        SELECT
          v_member.user_id,
          v_member.profile_id,
          'travel',
          'scheduled',
          v_leg.departure_date,
          v_leg.arrival_date,
          'Tour Travel: ' || v_leg.from_city_name || ' → ' || v_leg.to_city_name,
          COALESCE(v_leg.travel_mode, 'bus') || ' journey (' || greatest(1, COALESCE(v_leg.travel_duration_hours, 1)) || 'h) — Tour',
          v_leg.to_city_name || ', ' || v_leg.to_country,
          jsonb_build_object(
            'travel_history_id', v_travel.id,
            'tour_leg_id', v_leg.id,
            'tour_id', p_tour_id,
            'from_city_id', v_leg.from_city_id,
            'to_city_id', v_leg.to_city_id,
            'transport_type', v_leg.travel_mode,
            'request_id', p_request_id
          )
        WHERE NOT EXISTS (
          SELECT 1 FROM public.player_scheduled_activities a
          WHERE a.profile_id = v_member.profile_id
            AND a.activity_type = 'travel'
            AND COALESCE(a.status, 'scheduled') <> 'cancelled'
            AND a.metadata->>'tour_leg_id' = v_leg.id::text
        );
        v_created := v_created + 1;
      ELSE
        v_skipped := v_skipped + 1;
      END IF;
    END LOOP;
  END LOOP;

  RETURN jsonb_build_object(
    'tour_id', p_tour_id,
    'tour_name', v_tour.name,
    'created', v_created,
    'skipped_existing', v_skipped,
    'request_id', p_request_id
  );
END;
$$;

REVOKE ALL ON FUNCTION public.regenerate_tour_travel_legs(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.regenerate_tour_travel_legs(uuid, uuid) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.sync_tour_member_travel(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.sync_tour_member_travel(uuid, uuid) TO authenticated, service_role;
