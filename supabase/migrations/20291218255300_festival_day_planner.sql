-- Festival attendee day planner + Festival-local clock.
--
-- This slice stores intent only. It does not resolve activities, award XP/AP,
-- change condition stats, debit purchases or produce owner engagement.

CREATE TABLE public.festival_attendee_plan_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  attendance_id uuid NOT NULL REFERENCES public.festival_player_attendance(id) ON DELETE CASCADE,
  festival_edition_id uuid NOT NULL REFERENCES public.festival_editions_v2(id) ON DELETE CASCADE,
  profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  festival_date date NOT NULL,
  starts_at timestamptz NOT NULL,
  ends_at timestamptz NOT NULL,
  duration_minutes smallint NOT NULL CHECK (duration_minutes IN (30, 60, 90)),
  activity_type text NOT NULL CHECK (activity_type IN ('watch_act', 'eat', 'drink', 'explore', 'rest')),
  title text NOT NULL CHECK (char_length(btrim(title)) BETWEEN 1 AND 120),
  status text NOT NULL DEFAULT 'planned' CHECK (status IN ('planned', 'missed', 'cancelled')),
  idempotency_key uuid NOT NULL,
  resolved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (attendance_id, idempotency_key),
  CHECK (starts_at < ends_at)
);

CREATE INDEX festival_attendee_plan_items_attendance_date_idx
  ON public.festival_attendee_plan_items(attendance_id, festival_date, starts_at);
CREATE INDEX festival_attendee_plan_items_profile_status_idx
  ON public.festival_attendee_plan_items(profile_id, status, starts_at);

ALTER TABLE public.festival_attendee_plan_items ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.festival_attendee_plan_items FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE public.festival_attendee_plan_items TO service_role;

CREATE OR REPLACE FUNCTION public._festival_day_plan_context(
  p_attendance_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_profile_id uuid := public.current_profile_id();
  v_attendance public.festival_player_attendance%ROWTYPE;
  v_edition public.festival_editions_v2%ROWTYPE;
  v_timezone text;
  v_city_name text;
  v_local_date date;
BEGIN
  IF v_profile_id IS NULL THEN
    RAISE EXCEPTION 'festival_profile_required' USING ERRCODE = 'P0001';
  END IF;

  SELECT attendance.*
    INTO v_attendance
  FROM public.festival_player_attendance attendance
  WHERE attendance.id = p_attendance_id
    AND attendance.profile_id = v_profile_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'festival_attendance_not_found' USING ERRCODE = 'P0001';
  END IF;

  IF v_attendance.status <> 'attending' THEN
    RAISE EXCEPTION 'festival_not_attending' USING ERRCODE = 'P0001';
  END IF;

  SELECT edition.*
    INTO v_edition
  FROM public.festival_editions_v2 edition
  WHERE edition.id = v_attendance.festival_edition_id;

  IF NOT FOUND OR v_edition.starts_on IS NULL OR v_edition.ends_on IS NULL OR v_edition.city_id IS NULL THEN
    RAISE EXCEPTION 'festival_day_plan_context_unavailable' USING ERRCODE = 'P0001';
  END IF;

  SELECT city.name, coalesce(nullif(city.timezone, ''), 'UTC')
    INTO v_city_name, v_timezone
  FROM public.cities city
  WHERE city.id = v_edition.city_id;

  IF v_timezone IS NULL THEN
    RAISE EXCEPTION 'festival_day_plan_context_unavailable' USING ERRCODE = 'P0001';
  END IF;

  v_local_date := (now() AT TIME ZONE v_timezone)::date;

  RETURN jsonb_build_object(
    'profileId', v_profile_id,
    'attendanceId', v_attendance.id,
    'festivalEditionId', v_attendance.festival_edition_id,
    'festivalName', v_edition.name,
    'startsOn', v_edition.starts_on,
    'endsOn', v_edition.ends_on,
    'timezone', v_timezone,
    'cityName', v_city_name,
    'festivalLocalDate', v_local_date,
    'festivalLocalTime', to_char(now() AT TIME ZONE v_timezone, 'HH24:MI:SS'),
    'festivalLocalDateTime', to_char(now() AT TIME ZONE v_timezone, 'YYYY-MM-DD"T"HH24:MI:SS'),
    'festivalDayNumber', greatest(1, least((v_edition.ends_on - v_edition.starts_on) + 1, (v_local_date - v_edition.starts_on) + 1)),
    'totalFestivalDays', (v_edition.ends_on - v_edition.starts_on) + 1
  );
END;
$function$;

REVOKE ALL ON FUNCTION public._festival_day_plan_context(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public._festival_day_plan_context(uuid) TO service_role;

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
  v_edition_id uuid;
  v_starts_on date;
  v_ends_on date;
  v_items jsonb;
  v_days jsonb;
  v_next jsonb;
BEGIN
  v_context := public._festival_day_plan_context(p_attendance_id);
  v_profile_id := (v_context->>'profileId')::uuid;
  v_edition_id := (v_context->>'festivalEditionId')::uuid;
  v_starts_on := (v_context->>'startsOn')::date;
  v_ends_on := (v_context->>'endsOn')::date;

  -- Until activity execution arrives, a plan block that fully expires without
  -- resolution becomes missed. This is server-derived and never browser supplied.
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
      'date', day_value::date,
      'dayNumber', ((day_value::date - v_starts_on) + 1)
    ) ORDER BY day_value
  ), '[]'::jsonb)
  INTO v_days
  FROM generate_series(v_starts_on::timestamp, v_ends_on::timestamp, interval '1 day') day_value;

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

REVOKE ALL ON FUNCTION public.get_my_festival_day_plan(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_my_festival_day_plan(uuid) TO authenticated, service_role;

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

  SELECT item.*
    INTO v_existing
  FROM public.festival_attendee_plan_items item
  WHERE item.attendance_id = p_attendance_id
    AND item.idempotency_key = p_idempotency_key;

  IF FOUND THEN
    IF v_existing.festival_date <> p_festival_date
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

  IF p_festival_date < v_starts_on OR p_festival_date > v_ends_on THEN
    RAISE EXCEPTION 'festival_plan_date_outside_event' USING ERRCODE = 'P0001';
  END IF;

  v_start_at := (p_festival_date + p_local_start) AT TIME ZONE v_timezone;
  v_end_at := v_start_at + make_interval(mins => p_duration_minutes);
  v_day_end := ((p_festival_date + 1)::timestamp AT TIME ZONE v_timezone);

  IF v_start_at < now() THEN
    RAISE EXCEPTION 'festival_plan_start_in_past' USING ERRCODE = 'P0001';
  END IF;

  IF v_end_at > v_day_end THEN
    RAISE EXCEPTION 'festival_plan_crosses_day_boundary' USING ERRCODE = 'P0001';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended(p_attendance_id::text || ':' || p_festival_date::text, 0));

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

REVOKE ALL ON FUNCTION public.create_festival_day_plan_item(uuid, date, time without time zone, integer, text, text, uuid)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_festival_day_plan_item(uuid, date, time without time zone, integer, text, text, uuid)
  TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.cancel_festival_day_plan_item(
  p_item_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_profile_id uuid := public.current_profile_id();
  v_item public.festival_attendee_plan_items%ROWTYPE;
  v_attendance public.festival_player_attendance%ROWTYPE;
BEGIN
  IF v_profile_id IS NULL THEN
    RAISE EXCEPTION 'festival_profile_required' USING ERRCODE = 'P0001';
  END IF;

  SELECT item.*
    INTO v_item
  FROM public.festival_attendee_plan_items item
  WHERE item.id = p_item_id
    AND item.profile_id = v_profile_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'festival_plan_item_not_found' USING ERRCODE = 'P0001';
  END IF;

  SELECT attendance.*
    INTO v_attendance
  FROM public.festival_player_attendance attendance
  WHERE attendance.id = v_item.attendance_id
    AND attendance.profile_id = v_profile_id;

  IF NOT FOUND OR v_attendance.status <> 'attending' THEN
    RAISE EXCEPTION 'festival_not_attending' USING ERRCODE = 'P0001';
  END IF;

  IF v_item.status = 'cancelled' THEN
    RETURN jsonb_build_object('id', v_item.id, 'status', 'cancelled', 'alreadyCancelled', true);
  END IF;

  IF v_item.status <> 'planned' OR v_item.starts_at <= now() THEN
    RAISE EXCEPTION 'festival_plan_item_locked' USING ERRCODE = 'P0001';
  END IF;

  UPDATE public.festival_attendee_plan_items
  SET status = 'cancelled',
      resolved_at = now(),
      updated_at = now()
  WHERE id = v_item.id
  RETURNING * INTO v_item;

  RETURN jsonb_build_object('id', v_item.id, 'status', v_item.status, 'alreadyCancelled', false);
END;
$function$;

REVOKE ALL ON FUNCTION public.cancel_festival_day_plan_item(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.cancel_festival_day_plan_item(uuid) TO authenticated, service_role;

COMMENT ON TABLE public.festival_attendee_plan_items IS
  'Server-authoritative Festival attendee planning blocks. These rows record planned intent only; later activity engines resolve outcomes separately.';
COMMENT ON FUNCTION public.get_my_festival_day_plan(uuid) IS
  'Returns the signed-in active character Festival-local clock, event days, plan timeline and next planned activity; expired unresolved blocks become missed.';
COMMENT ON FUNCTION public.create_festival_day_plan_item(uuid, date, time without time zone, integer, text, text, uuid) IS
  'Creates an idempotent future 30/60/90-minute Festival plan block on the event-local half-hour grid with overlap protection.';
COMMENT ON FUNCTION public.cancel_festival_day_plan_item(uuid) IS
  'Cancels only the signed-in attending character future planned block; preserves cancelled history.';

NOTIFY pgrst, 'reload schema';
