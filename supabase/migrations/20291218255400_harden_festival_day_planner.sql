-- Harden Festival day planner before rollout.
-- Fixes generated day aliases and serialises idempotent creates before lookup.

CREATE OR REPLACE FUNCTION public.get_my_festival_day_plan(
  p_attendance_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_context jsonb;
  v_profile_id uuid;
  v_starts_on date;
  v_ends_on date;
  v_items jsonb;
  v_days jsonb;
  v_next jsonb;
BEGIN
  v_context := public._festival_day_plan_context(p_attendance_id);
  v_profile_id := (v_context->>'profileId')::uuid;
  v_starts_on := (v_context->>'startsOn')::date;
  v_ends_on := (v_context->>'endsOn')::date;

  UPDATE public.festival_attendee_plan_items item
  SET status = 'missed',
      resolved_at = coalesce(item.resolved_at, item.ends_at),
      updated_at = now()
  WHERE item.attendance_id = p_attendance_id
    AND item.profile_id = v_profile_id
    AND item.status = 'planned'
    AND item.ends_at <= now();

  SELECT coalesce(jsonb_agg(
    jsonb_build_object(
      'date', days.day_value::date,
      'dayNumber', ((days.day_value::date - v_starts_on) + 1)
    ) ORDER BY days.day_value
  ), '[]'::jsonb)
  INTO v_days
  FROM generate_series(
    v_starts_on::timestamp,
    v_ends_on::timestamp,
    interval '1 day'
  ) AS days(day_value);

  SELECT coalesce(jsonb_agg(
    jsonb_build_object(
      'id', item.id,
      'attendanceId', item.attendance_id,
      'festivalEditionId', item.festival_edition_id,
      'festivalDate', item.festival_date,
      'startsAt', item.starts_at,
      'endsAt', item.ends_at,
      'durationMinutes', item.duration_minutes,
      'activityType', item.activity_type,
      'title', item.title,
      'status', item.status,
      'resolvedAt', item.resolved_at,
      'createdAt', item.created_at
    ) ORDER BY item.starts_at, item.created_at
  ), '[]'::jsonb)
  INTO v_items
  FROM public.festival_attendee_plan_items item
  WHERE item.attendance_id = p_attendance_id
    AND item.profile_id = v_profile_id;

  SELECT jsonb_build_object(
      'id', item.id,
      'festivalDate', item.festival_date,
      'startsAt', item.starts_at,
      'endsAt', item.ends_at,
      'durationMinutes', item.duration_minutes,
      'activityType', item.activity_type,
      'title', item.title,
      'status', item.status
    )
  INTO v_next
  FROM public.festival_attendee_plan_items item
  WHERE item.attendance_id = p_attendance_id
    AND item.profile_id = v_profile_id
    AND item.status = 'planned'
    AND item.ends_at > now()
  ORDER BY item.starts_at, item.created_at
  LIMIT 1;

  RETURN (v_context - 'profileId') || jsonb_build_object(
    'days', v_days,
    'items', v_items,
    'nextActivity', v_next,
    'serverNow', now()
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.create_festival_day_plan_item(
  p_attendance_id uuid,
  p_festival_date date,
  p_local_start time without time zone,
  p_duration_minutes integer,
  p_activity_type text,
  p_title text,
  p_idempotency_key uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_context jsonb;
  v_profile_id uuid;
  v_edition_id uuid;
  v_timezone text;
  v_starts_on date;
  v_ends_on date;
  v_start_at timestamptz;
  v_end_at timestamptz;
  v_day_end timestamptz;
  v_existing public.festival_attendee_plan_items%ROWTYPE;
  v_item public.festival_attendee_plan_items%ROWTYPE;
BEGIN
  IF p_idempotency_key IS NULL THEN
    RAISE EXCEPTION 'festival_plan_idempotency_required' USING ERRCODE = 'P0001';
  END IF;

  IF p_festival_date IS NULL THEN
    RAISE EXCEPTION 'festival_plan_date_required' USING ERRCODE = 'P0001';
  END IF;

  IF p_local_start IS NULL THEN
    RAISE EXCEPTION 'festival_plan_start_required' USING ERRCODE = 'P0001';
  END IF;

  IF p_duration_minutes NOT IN (30, 60, 90) THEN
    RAISE EXCEPTION 'festival_plan_duration_invalid' USING ERRCODE = 'P0001';
  END IF;

  IF p_activity_type NOT IN ('watch_act', 'eat', 'drink', 'explore', 'rest') THEN
    RAISE EXCEPTION 'festival_plan_activity_invalid' USING ERRCODE = 'P0001';
  END IF;

  IF NULLIF(btrim(p_title), '') IS NULL OR char_length(btrim(p_title)) > 120 THEN
    RAISE EXCEPTION 'festival_plan_title_invalid' USING ERRCODE = 'P0001';
  END IF;

  IF extract(second FROM p_local_start) <> 0
     OR mod(extract(minute FROM p_local_start)::integer, 30) <> 0 THEN
    RAISE EXCEPTION 'festival_plan_start_grid_invalid' USING ERRCODE = 'P0001';
  END IF;

  v_context := public._festival_day_plan_context(p_attendance_id);
  v_profile_id := (v_context->>'profileId')::uuid;
  v_edition_id := (v_context->>'festivalEditionId')::uuid;
  v_timezone := v_context->>'timezone';
  v_starts_on := (v_context->>'startsOn')::date;
  v_ends_on := (v_context->>'endsOn')::date;

  IF p_festival_date < v_starts_on OR p_festival_date > v_ends_on THEN
    RAISE EXCEPTION 'festival_plan_date_outside_event' USING ERRCODE = 'P0001';
  END IF;

  v_start_at := (p_festival_date + p_local_start) AT TIME ZONE v_timezone;
  v_end_at := v_start_at + make_interval(mins => p_duration_minutes);
  v_day_end := ((p_festival_date + 1)::timestamp AT TIME ZONE v_timezone);

  -- Serialize retries for this exact client request before checking the row.
  PERFORM pg_advisory_xact_lock(
    hashtextextended(p_attendance_id::text || ':festival-plan:' || p_idempotency_key::text, 0)
  );

  SELECT item.*
    INTO v_existing
  FROM public.festival_attendee_plan_items item
  WHERE item.attendance_id = p_attendance_id
    AND item.idempotency_key = p_idempotency_key;

  IF FOUND THEN
    IF v_existing.festival_date <> p_festival_date
       OR v_existing.starts_at <> v_start_at
       OR v_existing.ends_at <> v_end_at
       OR v_existing.duration_minutes <> p_duration_minutes
       OR v_existing.activity_type <> p_activity_type
       OR v_existing.title <> btrim(p_title) THEN
      RAISE EXCEPTION 'festival_plan_idempotency_conflict' USING ERRCODE = 'P0001';
    END IF;

    RETURN jsonb_build_object(
      'id', v_existing.id,
      'status', v_existing.status,
      'startsAt', v_existing.starts_at,
      'endsAt', v_existing.ends_at,
      'duplicate', true
    );
  END IF;

  IF v_start_at < now() THEN
    RAISE EXCEPTION 'festival_plan_start_in_past' USING ERRCODE = 'P0001';
  END IF;

  IF v_end_at > v_day_end THEN
    RAISE EXCEPTION 'festival_plan_crosses_day_boundary' USING ERRCODE = 'P0001';
  END IF;

  -- A second attendance/day lock closes the overlap race between distinct requests.
  PERFORM pg_advisory_xact_lock(
    hashtextextended(p_attendance_id::text || ':festival-date:' || p_festival_date::text, 0)
  );

  IF EXISTS (
    SELECT 1
    FROM public.festival_attendee_plan_items item
    WHERE item.attendance_id = p_attendance_id
      AND item.profile_id = v_profile_id
      AND item.status = 'planned'
      AND tstzrange(item.starts_at, item.ends_at, '[)') && tstzrange(v_start_at, v_end_at, '[)')
  ) THEN
    RAISE EXCEPTION 'festival_plan_overlap' USING ERRCODE = 'P0001';
  END IF;

  INSERT INTO public.festival_attendee_plan_items (
    attendance_id,
    festival_edition_id,
    profile_id,
    festival_date,
    starts_at,
    ends_at,
    duration_minutes,
    activity_type,
    title,
    idempotency_key
  ) VALUES (
    p_attendance_id,
    v_edition_id,
    v_profile_id,
    p_festival_date,
    v_start_at,
    v_end_at,
    p_duration_minutes,
    p_activity_type,
    btrim(p_title),
    p_idempotency_key
  )
  RETURNING * INTO v_item;

  RETURN jsonb_build_object(
    'id', v_item.id,
    'status', v_item.status,
    'startsAt', v_item.starts_at,
    'endsAt', v_item.ends_at,
    'duplicate', false
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.get_my_festival_day_plan(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_my_festival_day_plan(uuid) TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.create_festival_day_plan_item(uuid, date, time without time zone, integer, text, text, uuid)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_festival_day_plan_item(uuid, date, time without time zone, integer, text, text, uuid)
  TO authenticated, service_role;

NOTIFY pgrst, 'reload schema';
