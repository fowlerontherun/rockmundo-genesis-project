-- Complete the attendee stage loop: a planned performance can be watched once
-- while its authoritative set window is live. Completion feeds the existing C8
-- reward settlement; no XP/AP is awarded by this RPC directly.

CREATE OR REPLACE FUNCTION public.resolve_festival_plan_activity(p_plan_item_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_profile_id uuid := public.current_profile_id();
  v_item public.festival_attendee_plan_items%ROWTYPE;
  v_attendance public.festival_player_attendance%ROWTYPE;
  v_before public.festival_attendee_conditions%ROWTYPE;
  v_after public.festival_attendee_conditions%ROWTYPE;
  v_existing public.festival_attendee_activity_resolutions%ROWTYPE;
  v_resolution public.festival_attendee_activity_resolutions%ROWTYPE;
  v_booking public.festival_artist_bookings%ROWTYPE;
  v_scale numeric;
  v_energy_delta integer := 0;
  v_hunger_delta integer := 0;
  v_hydration_delta integer := 0;
  v_mood_delta integer := 0;
  v_intoxication_delta integer := 0;
  v_social_delta integer := 0;
  v_inspiration_delta integer := 0;
  v_before_json jsonb;
  v_effect_json jsonb;
  v_after_json jsonb;
BEGIN
  IF v_profile_id IS NULL THEN
    RAISE EXCEPTION 'festival_profile_required' USING ERRCODE = 'P0001';
  END IF;

  SELECT item.* INTO v_item
  FROM public.festival_attendee_plan_items item
  WHERE item.id = p_plan_item_id
    AND item.profile_id = v_profile_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'festival_plan_item_not_found' USING ERRCODE = 'P0001';
  END IF;

  SELECT attendance.* INTO v_attendance
  FROM public.festival_player_attendance attendance
  WHERE attendance.id = v_item.attendance_id
    AND attendance.profile_id = v_profile_id;

  IF NOT FOUND OR v_attendance.status <> 'attending' THEN
    RAISE EXCEPTION 'festival_not_attending' USING ERRCODE = 'P0001';
  END IF;

  IF v_item.activity_type NOT IN ('eat', 'drink', 'explore', 'rest', 'watch_act') THEN
    RAISE EXCEPTION 'festival_activity_not_supported' USING ERRCODE = 'P0001';
  END IF;

  IF v_item.activity_type = 'watch_act' THEN
    IF v_item.source <> 'stage_schedule' OR v_item.schedule_item_id IS NULL OR v_item.stage_id IS NULL THEN
      RAISE EXCEPTION 'festival_watch_act_schedule_required' USING ERRCODE = 'P0001';
    END IF;

    SELECT booking.* INTO v_booking
    FROM public.festival_artist_bookings booking
    JOIN public.festival_artist_programmes programme
      ON programme.id = booking.festival_artist_programme_id
    WHERE booking.id = v_item.schedule_item_id
      AND programme.festival_edition_id = v_item.festival_edition_id
      AND booking.status NOT IN ('cancelled','withdrawn','artist_withdrawn','festival_cancelled');

    IF NOT FOUND THEN
      RAISE EXCEPTION 'festival_watch_act_booking_unavailable' USING ERRCODE = 'P0001';
    END IF;
  END IF;

  IF v_item.status = 'completed' THEN
    SELECT resolution.* INTO v_existing
    FROM public.festival_attendee_activity_resolutions resolution
    WHERE resolution.plan_item_id = v_item.id;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'festival_activity_resolution_missing' USING ERRCODE = 'P0001';
    END IF;

    RETURN jsonb_build_object(
      'planItemId', v_existing.plan_item_id,
      'attendanceId', v_existing.attendance_id,
      'activityType', v_existing.activity_type,
      'durationMinutes', v_existing.duration_minutes,
      'status', 'completed',
      'before', v_existing.before_state,
      'effect', v_existing.effect,
      'after', v_existing.after_state,
      'resolvedAt', v_existing.resolved_at,
      'duplicate', true
    );
  END IF;

  IF v_item.status = 'cancelled' THEN
    RAISE EXCEPTION 'festival_plan_item_cancelled' USING ERRCODE = 'P0001';
  END IF;

  IF v_item.status = 'missed' THEN
    RETURN jsonb_build_object(
      'planItemId', v_item.id,
      'attendanceId', v_item.attendance_id,
      'activityType', v_item.activity_type,
      'durationMinutes', v_item.duration_minutes,
      'status', 'missed',
      'reason', 'activity_window_missed',
      'resolvedAt', v_item.resolved_at,
      'duplicate', true
    );
  END IF;

  IF now() < v_item.starts_at THEN
    RAISE EXCEPTION 'festival_activity_not_started' USING ERRCODE = 'P0001';
  END IF;

  IF now() >= v_item.ends_at THEN
    UPDATE public.festival_attendee_plan_items
    SET status = 'missed',
        resolved_at = coalesce(resolved_at, ends_at),
        updated_at = now()
    WHERE id = v_item.id
    RETURNING * INTO v_item;

    RETURN jsonb_build_object(
      'planItemId', v_item.id,
      'attendanceId', v_item.attendance_id,
      'activityType', v_item.activity_type,
      'durationMinutes', v_item.duration_minutes,
      'status', 'missed',
      'reason', 'activity_window_missed',
      'resolvedAt', v_item.resolved_at,
      'duplicate', false
    );
  END IF;

  v_before := public._festival_evolve_attendee_conditions(v_item.attendance_id, now());
  v_scale := CASE WHEN v_item.activity_type = 'watch_act'
    THEN greatest(0.5, least(2.0, v_item.duration_minutes::numeric / 45.0))
    ELSE v_item.duration_minutes::numeric / 30.0
  END;

  CASE v_item.activity_type
    WHEN 'eat' THEN
      v_energy_delta := round(4 * v_scale)::integer;
      v_hunger_delta := -round(24 * v_scale)::integer;
      v_hydration_delta := round(3 * v_scale)::integer;
      v_mood_delta := round(2 * v_scale)::integer;
    WHEN 'drink' THEN
      v_hydration_delta := round(22 * v_scale)::integer;
      v_mood_delta := least(3, round(1 * v_scale)::integer);
    WHEN 'explore' THEN
      v_energy_delta := -round(5 * v_scale)::integer;
      v_hunger_delta := round(3 * v_scale)::integer;
      v_hydration_delta := -round(4 * v_scale)::integer;
      v_mood_delta := round(5 * v_scale)::integer;
      v_social_delta := round(3 * v_scale)::integer;
    WHEN 'rest' THEN
      v_energy_delta := round(9 * v_scale)::integer;
      v_hunger_delta := round(2 * v_scale)::integer;
      v_hydration_delta := -round(1 * v_scale)::integer;
      v_mood_delta := round(3 * v_scale)::integer;
    WHEN 'watch_act' THEN
      v_energy_delta := -round(4 * v_scale)::integer;
      v_hunger_delta := round(2 * v_scale)::integer;
      v_hydration_delta := -round(3 * v_scale)::integer;
      v_mood_delta := round(7 * v_scale)::integer;
      v_social_delta := round(4 * v_scale)::integer;
      v_inspiration_delta := round(8 * v_scale)::integer;
  END CASE;

  v_before_json := jsonb_build_object(
    'energy', v_before.energy,
    'hunger', v_before.hunger,
    'hydration', v_before.hydration,
    'mood', v_before.mood,
    'intoxication', v_before.intoxication,
    'social', v_before.social,
    'inspiration', v_before.inspiration
  );

  UPDATE public.festival_attendee_conditions
  SET energy = least(100, greatest(0, energy + v_energy_delta)),
      hunger = least(100, greatest(0, hunger + v_hunger_delta)),
      hydration = least(100, greatest(0, hydration + v_hydration_delta)),
      mood = least(100, greatest(0, mood + v_mood_delta)),
      intoxication = least(100, greatest(0, intoxication + v_intoxication_delta)),
      social = least(100, greatest(0, social + v_social_delta)),
      inspiration = least(100, greatest(0, inspiration + v_inspiration_delta)),
      last_activity_at = now(),
      updated_at = now()
  WHERE attendance_id = v_item.attendance_id
  RETURNING * INTO v_after;

  v_effect_json := jsonb_build_object(
    'energy', v_energy_delta,
    'hunger', v_hunger_delta,
    'hydration', v_hydration_delta,
    'mood', v_mood_delta,
    'intoxication', v_intoxication_delta,
    'social', v_social_delta,
    'inspiration', v_inspiration_delta
  );

  v_after_json := jsonb_build_object(
    'energy', v_after.energy,
    'hunger', v_after.hunger,
    'hydration', v_after.hydration,
    'mood', v_after.mood,
    'intoxication', v_after.intoxication,
    'social', v_after.social,
    'inspiration', v_after.inspiration
  );

  INSERT INTO public.festival_attendee_activity_resolutions (
    plan_item_id, attendance_id, festival_edition_id, profile_id,
    activity_type, duration_minutes, before_state, effect, after_state, resolved_at
  ) VALUES (
    v_item.id,
    v_item.attendance_id,
    v_item.festival_edition_id,
    v_item.profile_id,
    v_item.activity_type,
    v_item.duration_minutes,
    v_before_json,
    v_effect_json,
    v_after_json,
    now()
  )
  RETURNING * INTO v_resolution;

  UPDATE public.festival_attendee_plan_items
  SET status = 'completed',
      resolved_at = v_resolution.resolved_at,
      updated_at = now()
  WHERE id = v_item.id;

  RETURN jsonb_build_object(
    'planItemId', v_resolution.plan_item_id,
    'attendanceId', v_resolution.attendance_id,
    'activityType', v_resolution.activity_type,
    'durationMinutes', v_resolution.duration_minutes,
    'status', 'completed',
    'before', v_resolution.before_state,
    'effect', v_resolution.effect,
    'after', v_resolution.after_state,
    'resolvedAt', v_resolution.resolved_at,
    'duplicate', false
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.resolve_festival_plan_activity(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.resolve_festival_plan_activity(uuid) TO authenticated, service_role;
NOTIFY pgrst,'reload schema';
