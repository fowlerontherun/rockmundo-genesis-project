-- Festival Mode schedule authority.
-- Reserves the active attendee's remaining Festival window in the canonical
-- player_scheduled_activities calendar so existing booking conflict checks
-- automatically block normal overlapping gameplay.

ALTER TABLE public.festival_player_attendance
  ADD COLUMN IF NOT EXISTS schedule_activity_id uuid;

DO $block$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'festival_player_attendance_schedule_activity_id_fkey'
      AND conrelid = 'public.festival_player_attendance'::regclass
  ) THEN
    ALTER TABLE public.festival_player_attendance
      ADD CONSTRAINT festival_player_attendance_schedule_activity_id_fkey
      FOREIGN KEY (schedule_activity_id)
      REFERENCES public.player_scheduled_activities(id)
      ON DELETE RESTRICT;
  END IF;
END;
$block$;

CREATE UNIQUE INDEX IF NOT EXISTS festival_player_attendance_schedule_activity_uidx
  ON public.festival_player_attendance(schedule_activity_id)
  WHERE schedule_activity_id IS NOT NULL;

-- A player may continue managing ordinary schedule rows, but Festival attendance
-- reservations are server-owned and cannot be forged, edited or deleted directly.
DROP POLICY IF EXISTS "Users can create their own scheduled activities"
  ON public.player_scheduled_activities;
CREATE POLICY "Users can create their own scheduled activities"
  ON public.player_scheduled_activities
  FOR INSERT
  TO public
  WITH CHECK (
    auth.uid() = user_id
    AND activity_type <> 'festival_attendance'
  );

DROP POLICY IF EXISTS "Users can update their own scheduled activities"
  ON public.player_scheduled_activities;
CREATE POLICY "Users can update their own scheduled activities"
  ON public.player_scheduled_activities
  FOR UPDATE
  TO public
  USING (
    auth.uid() = user_id
    AND activity_type <> 'festival_attendance'
  )
  WITH CHECK (
    auth.uid() = user_id
    AND activity_type <> 'festival_attendance'
  );

DROP POLICY IF EXISTS "Users can delete their own scheduled activities"
  ON public.player_scheduled_activities;
CREATE POLICY "Users can delete their own scheduled activities"
  ON public.player_scheduled_activities
  FOR DELETE
  TO public
  USING (
    auth.uid() = user_id
    AND activity_type <> 'festival_attendance'
  );

CREATE OR REPLACE FUNCTION public._festival_attendee_has_schedule_conflict(
  p_profile_id uuid,
  p_festival_edition_id uuid,
  p_window_start timestamptz,
  p_window_end timestamptz
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO ''
AS $function$
  SELECT EXISTS (
    SELECT 1
    FROM public.player_scheduled_activities activity
    WHERE activity.profile_id = p_profile_id
      AND activity.status IN ('scheduled', 'in_progress')
      AND activity.scheduled_start < p_window_end
      AND activity.scheduled_end > p_window_start
      AND activity.activity_type <> 'festival_attendance'
      AND NOT (
        activity.activity_type IN ('festival_performance', 'gig')
        AND (
          activity.metadata->>'festival_edition_id' = p_festival_edition_id::text
          OR activity.metadata->>'canonical_edition_id' = p_festival_edition_id::text
        )
      )
  );
$function$;

REVOKE ALL ON FUNCTION public._festival_attendee_has_schedule_conflict(uuid, uuid, timestamptz, timestamptz)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public._festival_attendee_has_schedule_conflict(uuid, uuid, timestamptz, timestamptz)
  TO service_role;

CREATE OR REPLACE FUNCTION public.get_my_festival_check_in_eligibility()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO ''
AS $function$
  WITH eligibility AS (
    SELECT
      attendance.id AS attendance_id,
      attendance.festival_launch_id,
      attendance.festival_edition_id,
      attendance.status AS attendance_status,
      edition.starts_on,
      edition.ends_on,
      edition.city_id,
      city.name AS city_name,
      coalesce(nullif(city.timezone, ''), 'UTC') AS timezone,
      (now() AT TIME ZONE coalesce(nullif(city.timezone, ''), 'UTC'))::date AS festival_local_date,
      ((edition.ends_on + 1)::timestamp AT TIME ZONE coalesce(nullif(city.timezone, ''), 'UTC')) AS festival_end_at,
      profile.current_city_id,
      coalesce(profile.is_traveling, false) AS character_is_traveling,
      ticket.status AS ticket_status,
      launch.launch_status,
      edition.status AS edition_status,
      EXISTS (
        SELECT 1
        FROM public.festival_player_memorabilia memorabilia
        WHERE memorabilia.attendance_id = attendance.id
          AND memorabilia.item_type = 'wristband'
      ) AS wristband_issued,
      CASE
        WHEN attendance.status = 'attending' THEN 'already_attending'
        WHEN attendance.status IN ('left_early', 'completed', 'cancelled', 'refunded') THEN 'attendance_closed'
        WHEN attendance.status NOT IN ('ticketed', 'ready_to_check_in') THEN 'attendance_not_ready'
        WHEN ticket.status <> 'valid' THEN 'ticket_invalid'
        WHEN launch.launch_status = 'cancelled_before_event' OR edition.status = 'cancelled' THEN 'festival_cancelled'
        WHEN edition.starts_on IS NULL OR edition.ends_on IS NULL THEN 'festival_dates_unavailable'
        WHEN edition.city_id IS NULL THEN 'festival_city_unavailable'
        WHEN (now() AT TIME ZONE coalesce(nullif(city.timezone, ''), 'UTC'))::date < edition.starts_on THEN 'festival_not_started'
        WHEN (now() AT TIME ZONE coalesce(nullif(city.timezone, ''), 'UTC'))::date > edition.ends_on THEN 'festival_finished'
        WHEN coalesce(profile.is_traveling, false) THEN 'character_traveling'
        WHEN profile.current_city_id IS DISTINCT FROM edition.city_id THEN 'wrong_city'
        WHEN public._festival_attendee_has_schedule_conflict(
          attendance.profile_id,
          attendance.festival_edition_id,
          now(),
          ((edition.ends_on + 1)::timestamp AT TIME ZONE coalesce(nullif(city.timezone, ''), 'UTC'))
        ) THEN 'schedule_conflict'
        ELSE NULL
      END AS block_reason
    FROM public.festival_player_attendance attendance
    JOIN public.festival_editions_v2 edition
      ON edition.id = attendance.festival_edition_id
    JOIN public.festival_launches launch
      ON launch.id = attendance.festival_launch_id
    JOIN public.festival_issued_tickets ticket
      ON ticket.id = attendance.admission_ticket_id
    JOIN public.profiles profile
      ON profile.id = attendance.profile_id
    LEFT JOIN public.cities city
      ON city.id = edition.city_id
    WHERE attendance.profile_id = public.current_profile_id()
  )
  SELECT coalesce(
    jsonb_agg(
      jsonb_build_object(
        'attendanceId', eligibility.attendance_id,
        'festivalLaunchId', eligibility.festival_launch_id,
        'festivalEditionId', eligibility.festival_edition_id,
        'attendanceStatus', eligibility.attendance_status,
        'canCheckIn', eligibility.block_reason IS NULL,
        'blockReason', eligibility.block_reason,
        'startsOn', eligibility.starts_on,
        'endsOn', eligibility.ends_on,
        'cityId', eligibility.city_id,
        'cityName', eligibility.city_name,
        'timezone', eligibility.timezone,
        'festivalLocalDate', eligibility.festival_local_date,
        'currentCityId', eligibility.current_city_id,
        'characterIsTraveling', eligibility.character_is_traveling,
        'ticketStatus', eligibility.ticket_status,
        'launchStatus', eligibility.launch_status,
        'editionStatus', eligibility.edition_status,
        'wristbandIssued', eligibility.wristband_issued
      )
      ORDER BY eligibility.starts_on NULLS LAST, eligibility.attendance_id
    ),
    '[]'::jsonb
  )
  FROM eligibility;
$function$;

CREATE OR REPLACE FUNCTION public.check_in_to_festival(p_attendance_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_profile_id uuid := public.current_profile_id();
  v_attendance public.festival_player_attendance%ROWTYPE;
  v_ticket public.festival_issued_tickets%ROWTYPE;
  v_edition public.festival_editions_v2%ROWTYPE;
  v_launch public.festival_launches%ROWTYPE;
  v_current_city_id uuid;
  v_user_id uuid;
  v_is_traveling boolean;
  v_city_timezone text;
  v_city_name text;
  v_local_date date;
  v_lock_end timestamptz;
  v_product_class text;
  v_product_edition_id uuid;
  v_wristband_issued boolean;
  v_schedule_activity_id uuid;
BEGIN
  IF v_profile_id IS NULL THEN
    RAISE EXCEPTION 'festival_profile_required' USING ERRCODE = 'P0001';
  END IF;

  SELECT attendance.*
    INTO v_attendance
  FROM public.festival_player_attendance attendance
  WHERE attendance.id = p_attendance_id
  FOR UPDATE;

  IF NOT FOUND OR v_attendance.profile_id <> v_profile_id THEN
    RAISE EXCEPTION 'festival_attendance_not_found' USING ERRCODE = 'P0001';
  END IF;

  SELECT ticket.*
    INTO v_ticket
  FROM public.festival_issued_tickets ticket
  WHERE ticket.id = v_attendance.admission_ticket_id
  FOR UPDATE;

  IF NOT FOUND
     OR v_ticket.holder_profile_id <> v_profile_id
     OR v_ticket.festival_launch_id <> v_attendance.festival_launch_id THEN
    RAISE EXCEPTION 'festival_admission_ticket_mismatch' USING ERRCODE = 'P0001';
  END IF;

  IF v_attendance.status = 'attending' THEN
    IF v_ticket.status <> 'used' OR v_attendance.schedule_activity_id IS NULL THEN
      RAISE EXCEPTION 'festival_checked_in_state_inconsistent' USING ERRCODE = 'P0001';
    END IF;

    IF NOT EXISTS (
      SELECT 1
      FROM public.player_scheduled_activities activity
      WHERE activity.id = v_attendance.schedule_activity_id
        AND activity.activity_type = 'festival_attendance'
        AND activity.status = 'in_progress'
    ) THEN
      RAISE EXCEPTION 'festival_schedule_lock_inconsistent' USING ERRCODE = 'P0001';
    END IF;

    SELECT EXISTS (
      SELECT 1
      FROM public.festival_player_memorabilia memorabilia
      WHERE memorabilia.attendance_id = v_attendance.id
        AND memorabilia.item_type = 'wristband'
    ) INTO v_wristband_issued;

    RETURN jsonb_build_object(
      'attendanceId', v_attendance.id,
      'festivalLaunchId', v_attendance.festival_launch_id,
      'festivalEditionId', v_attendance.festival_edition_id,
      'status', v_attendance.status,
      'checkedInAt', v_attendance.checked_in_at,
      'ticketStatus', v_ticket.status,
      'wristbandIssued', v_wristband_issued,
      'alreadyCheckedIn', true
    );
  END IF;

  IF v_attendance.status NOT IN ('ticketed', 'ready_to_check_in') THEN
    RAISE EXCEPTION 'festival_attendance_not_check_in_ready' USING ERRCODE = 'P0001';
  END IF;

  IF v_ticket.status <> 'valid' THEN
    RAISE EXCEPTION 'festival_ticket_invalid' USING ERRCODE = 'P0001';
  END IF;

  SELECT product.product_class, plan.festival_edition_id
    INTO v_product_class, v_product_edition_id
  FROM public.festival_ticket_products product
  JOIN public.festival_ticket_plans plan
    ON plan.id = product.festival_ticket_plan_id
  WHERE product.id = v_ticket.festival_ticket_product_id;

  IF NOT FOUND
     OR v_product_class <> 'admission'
     OR v_product_edition_id IS DISTINCT FROM v_attendance.festival_edition_id THEN
    RAISE EXCEPTION 'festival_admission_ticket_mismatch' USING ERRCODE = 'P0001';
  END IF;

  SELECT edition.*
    INTO v_edition
  FROM public.festival_editions_v2 edition
  WHERE edition.id = v_attendance.festival_edition_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'festival_edition_not_found' USING ERRCODE = 'P0001';
  END IF;

  SELECT launch.*
    INTO v_launch
  FROM public.festival_launches launch
  WHERE launch.id = v_attendance.festival_launch_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'festival_launch_not_found' USING ERRCODE = 'P0001';
  END IF;

  IF v_launch.launch_status = 'cancelled_before_event' OR v_edition.status = 'cancelled' THEN
    RAISE EXCEPTION 'festival_cancelled' USING ERRCODE = 'P0001';
  END IF;

  IF v_edition.starts_on IS NULL OR v_edition.ends_on IS NULL THEN
    RAISE EXCEPTION 'festival_dates_unavailable' USING ERRCODE = 'P0001';
  END IF;

  IF v_edition.city_id IS NULL THEN
    RAISE EXCEPTION 'festival_city_unavailable' USING ERRCODE = 'P0001';
  END IF;

  SELECT coalesce(nullif(city.timezone, ''), 'UTC'), city.name
    INTO v_city_timezone, v_city_name
  FROM public.cities city
  WHERE city.id = v_edition.city_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'festival_city_unavailable' USING ERRCODE = 'P0001';
  END IF;

  v_local_date := (now() AT TIME ZONE v_city_timezone)::date;
  v_lock_end := ((v_edition.ends_on + 1)::timestamp AT TIME ZONE v_city_timezone);

  IF v_local_date < v_edition.starts_on THEN
    RAISE EXCEPTION 'festival_not_started' USING ERRCODE = 'P0001';
  END IF;

  IF v_local_date > v_edition.ends_on THEN
    RAISE EXCEPTION 'festival_finished' USING ERRCODE = 'P0001';
  END IF;

  SELECT profile.current_city_id, profile.user_id, coalesce(profile.is_traveling, false)
    INTO v_current_city_id, v_user_id, v_is_traveling
  FROM public.profiles profile
  WHERE profile.id = v_profile_id;

  IF v_is_traveling THEN
    RAISE EXCEPTION 'festival_character_traveling' USING ERRCODE = 'P0001';
  END IF;

  IF v_current_city_id IS DISTINCT FROM v_edition.city_id THEN
    RAISE EXCEPTION 'festival_wrong_city' USING ERRCODE = 'P0001';
  END IF;

  IF public._festival_attendee_has_schedule_conflict(
    v_profile_id,
    v_attendance.festival_edition_id,
    now(),
    v_lock_end
  ) THEN
    RAISE EXCEPTION 'festival_schedule_conflict' USING ERRCODE = 'P0001';
  END IF;

  INSERT INTO public.player_scheduled_activities (
    user_id,
    profile_id,
    activity_type,
    scheduled_start,
    scheduled_end,
    status,
    started_at,
    title,
    description,
    location,
    metadata
  ) VALUES (
    v_user_id,
    v_profile_id,
    'festival_attendance',
    now(),
    v_lock_end,
    'in_progress',
    now(),
    'Festival: ' || coalesce(v_edition.name, 'Festival'),
    'Authoritative Festival attendance reservation',
    v_city_name,
    jsonb_build_object(
      'server_owned', true,
      'festival_attendance_id', v_attendance.id,
      'festival_launch_id', v_attendance.festival_launch_id,
      'festival_edition_id', v_attendance.festival_edition_id
    )
  )
  RETURNING id INTO v_schedule_activity_id;

  UPDATE public.festival_issued_tickets
  SET status = 'used',
      updated_at = now()
  WHERE id = v_ticket.id;

  UPDATE public.festival_player_attendance
  SET status = 'attending',
      checked_in_at = coalesce(checked_in_at, now()),
      left_at = NULL,
      schedule_activity_id = v_schedule_activity_id,
      updated_at = now()
  WHERE id = v_attendance.id
  RETURNING * INTO v_attendance;

  SELECT EXISTS (
    SELECT 1
    FROM public.festival_player_memorabilia memorabilia
    WHERE memorabilia.attendance_id = v_attendance.id
      AND memorabilia.item_type = 'wristband'
  ) INTO v_wristband_issued;

  RETURN jsonb_build_object(
    'attendanceId', v_attendance.id,
    'festivalLaunchId', v_attendance.festival_launch_id,
    'festivalEditionId', v_attendance.festival_edition_id,
    'status', v_attendance.status,
    'checkedInAt', v_attendance.checked_in_at,
    'ticketStatus', 'used',
    'wristbandIssued', v_wristband_issued,
    'alreadyCheckedIn', false
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.leave_festival_early(p_attendance_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_profile_id uuid := public.current_profile_id();
  v_attendance public.festival_player_attendance%ROWTYPE;
BEGIN
  IF v_profile_id IS NULL THEN
    RAISE EXCEPTION 'festival_profile_required' USING ERRCODE = 'P0001';
  END IF;

  SELECT attendance.*
    INTO v_attendance
  FROM public.festival_player_attendance attendance
  WHERE attendance.id = p_attendance_id
  FOR UPDATE;

  IF NOT FOUND OR v_attendance.profile_id <> v_profile_id THEN
    RAISE EXCEPTION 'festival_attendance_not_found' USING ERRCODE = 'P0001';
  END IF;

  IF v_attendance.status = 'left_early' THEN
    IF v_attendance.schedule_activity_id IS NOT NULL THEN
      UPDATE public.player_scheduled_activities
      SET status = 'cancelled',
          metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object('festival_left_early', true),
          updated_at = now()
      WHERE id = v_attendance.schedule_activity_id
        AND activity_type = 'festival_attendance'
        AND status IN ('scheduled', 'in_progress');
    END IF;

    RETURN jsonb_build_object(
      'attendanceId', v_attendance.id,
      'festivalLaunchId', v_attendance.festival_launch_id,
      'festivalEditionId', v_attendance.festival_edition_id,
      'status', v_attendance.status,
      'checkedInAt', v_attendance.checked_in_at,
      'leftAt', v_attendance.left_at,
      'alreadyLeft', true
    );
  END IF;

  IF v_attendance.status <> 'attending' THEN
    RAISE EXCEPTION 'festival_attendance_not_attending' USING ERRCODE = 'P0001';
  END IF;

  IF v_attendance.schedule_activity_id IS NOT NULL THEN
    UPDATE public.player_scheduled_activities
    SET status = 'cancelled',
        metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object(
          'festival_left_early', true,
          'festival_left_at', now()
        ),
        updated_at = now()
    WHERE id = v_attendance.schedule_activity_id
      AND activity_type = 'festival_attendance'
      AND status IN ('scheduled', 'in_progress');
  END IF;

  UPDATE public.festival_player_attendance
  SET status = 'left_early',
      left_at = coalesce(left_at, now()),
      updated_at = now()
  WHERE id = v_attendance.id
  RETURNING * INTO v_attendance;

  RETURN jsonb_build_object(
    'attendanceId', v_attendance.id,
    'festivalLaunchId', v_attendance.festival_launch_id,
    'festivalEditionId', v_attendance.festival_edition_id,
    'status', v_attendance.status,
    'checkedInAt', v_attendance.checked_in_at,
    'leftAt', v_attendance.left_at,
    'alreadyLeft', false
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.check_in_to_festival(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.check_in_to_festival(uuid) TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.leave_festival_early(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.leave_festival_early(uuid) TO authenticated, service_role;

COMMENT ON COLUMN public.festival_player_attendance.schedule_activity_id IS
  'Server-owned canonical schedule reservation created when the character checks in to Festival Mode.';
COMMENT ON FUNCTION public._festival_attendee_has_schedule_conflict(uuid, uuid, timestamptz, timestamptz) IS
  'Detects normal scheduled activity conflicts while allowing a matching Festival performance to coexist with attendee mode.';

NOTIFY pgrst, 'reload schema';
