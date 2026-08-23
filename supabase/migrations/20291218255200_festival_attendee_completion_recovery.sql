-- Festival attendee completion + reconnect recovery.
--
-- This migration keeps the attendee lifecycle server authoritative after check-in:
--   * expired attending rows become completed without requiring a browser session;
--   * the shared-calendar Festival reservation is completed/released with attendance;
--   * safe stale state (used-ticket marker, wristband, schedule lock) can self-repair;
--   * reconnect/focus can reconcile the current character without replaying check-in;
--   * no rewards, day-plan progress or owner settlement are awarded here.

CREATE OR REPLACE FUNCTION public._festival_ensure_attendance_wristband(
  p_attendance_id uuid
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_attendance public.festival_player_attendance%ROWTYPE;
  v_edition_name text;
  v_edition_year integer;
  v_ticket_type text;
BEGIN
  SELECT attendance.*
    INTO v_attendance
  FROM public.festival_player_attendance attendance
  WHERE attendance.id = p_attendance_id;

  IF NOT FOUND
     OR v_attendance.checked_in_at IS NULL
     OR v_attendance.status NOT IN ('attending', 'left_early', 'completed') THEN
    RETURN false;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.festival_player_memorabilia memorabilia
    WHERE memorabilia.attendance_id = v_attendance.id
      AND memorabilia.item_type = 'wristband'
  ) THEN
    RETURN true;
  END IF;

  SELECT edition.name, edition.edition_year, product.ticket_type
    INTO v_edition_name, v_edition_year, v_ticket_type
  FROM public.festival_editions_v2 edition
  JOIN public.festival_issued_tickets ticket
    ON ticket.id = v_attendance.admission_ticket_id
  JOIN public.festival_ticket_products product
    ON product.id = ticket.festival_ticket_product_id
  WHERE edition.id = v_attendance.festival_edition_id
    AND ticket.holder_profile_id = v_attendance.profile_id
    AND ticket.festival_launch_id = v_attendance.festival_launch_id;

  IF NOT FOUND THEN
    RETURN false;
  END IF;

  INSERT INTO public.festival_player_memorabilia (
    profile_id,
    festival_launch_id,
    festival_edition_id,
    attendance_id,
    item_type,
    item_key,
    display_name,
    description,
    rarity,
    metadata,
    issued_at
  ) VALUES (
    v_attendance.profile_id,
    v_attendance.festival_launch_id,
    v_attendance.festival_edition_id,
    v_attendance.id,
    'wristband',
    'festival_wristband:' || v_attendance.festival_edition_id::text,
    concat_ws(' ', coalesce(v_edition_name, 'Festival'), v_edition_year::text, 'Wristband'),
    'A souvenir wristband proving this character checked in to the festival.',
    'common',
    jsonb_strip_nulls(jsonb_build_object(
      'festivalLaunchId', v_attendance.festival_launch_id,
      'festivalEditionId', v_attendance.festival_edition_id,
      'attendanceId', v_attendance.id,
      'ticketType', v_ticket_type,
      'checkedInAt', v_attendance.checked_in_at,
      'recovered', true
    )),
    v_attendance.checked_in_at
  )
  ON CONFLICT DO NOTHING;

  RETURN EXISTS (
    SELECT 1
    FROM public.festival_player_memorabilia memorabilia
    WHERE memorabilia.attendance_id = v_attendance.id
      AND memorabilia.item_type = 'wristband'
  );
END;
$function$;

REVOKE ALL ON FUNCTION public._festival_ensure_attendance_wristband(uuid)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public._festival_ensure_attendance_wristband(uuid)
  TO service_role;

-- Keep the original status trigger, but route issuance through the same idempotent
-- helper used by reconnect recovery so there is only one wristband creation rule.
CREATE OR REPLACE FUNCTION public._festival_issue_wristband_on_attendance()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
BEGIN
  IF NEW.status = 'attending' AND OLD.status IS DISTINCT FROM 'attending' THEN
    PERFORM public._festival_ensure_attendance_wristband(NEW.id);
  END IF;

  RETURN NEW;
END;
$function$;

REVOKE ALL ON FUNCTION public._festival_issue_wristband_on_attendance()
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public._festival_issue_wristband_on_attendance()
  TO service_role;

CREATE OR REPLACE FUNCTION public._festival_repair_attendance_ticket_used(
  p_attendance_id uuid
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_attendance public.festival_player_attendance%ROWTYPE;
  v_ticket public.festival_issued_tickets%ROWTYPE;
BEGIN
  SELECT attendance.*
    INTO v_attendance
  FROM public.festival_player_attendance attendance
  WHERE attendance.id = p_attendance_id
  FOR UPDATE;

  IF NOT FOUND
     OR v_attendance.status <> 'attending'
     OR v_attendance.checked_in_at IS NULL THEN
    RETURN 'not_applicable';
  END IF;

  SELECT ticket.*
    INTO v_ticket
  FROM public.festival_issued_tickets ticket
  WHERE ticket.id = v_attendance.admission_ticket_id
  FOR UPDATE;

  IF NOT FOUND
     OR v_ticket.holder_profile_id <> v_attendance.profile_id
     OR v_ticket.festival_launch_id <> v_attendance.festival_launch_id THEN
    RETURN 'attention_required';
  END IF;

  IF v_ticket.status = 'used' THEN
    RETURN 'healthy';
  END IF;

  -- Recovery only moves admission in the safe one-way direction: valid -> used.
  -- It never recreates a valid ticket or reverses cancellation/refund state.
  IF v_ticket.status = 'valid' THEN
    UPDATE public.festival_issued_tickets
    SET status = 'used',
        updated_at = now()
    WHERE id = v_ticket.id;

    RETURN 'repaired';
  END IF;

  RETURN 'attention_required';
END;
$function$;

REVOKE ALL ON FUNCTION public._festival_repair_attendance_ticket_used(uuid)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public._festival_repair_attendance_ticket_used(uuid)
  TO service_role;

CREATE OR REPLACE FUNCTION public._festival_repair_attendance_schedule_lock(
  p_attendance_id uuid
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_attendance public.festival_player_attendance%ROWTYPE;
  v_edition public.festival_editions_v2%ROWTYPE;
  v_user_id uuid;
  v_city_name text;
  v_timezone text;
  v_lock_end timestamptz;
  v_schedule_id uuid;
  v_linked_activity public.player_scheduled_activities%ROWTYPE;
BEGIN
  SELECT attendance.*
    INTO v_attendance
  FROM public.festival_player_attendance attendance
  WHERE attendance.id = p_attendance_id
  FOR UPDATE;

  IF NOT FOUND OR v_attendance.status <> 'attending' THEN
    RETURN 'not_attending';
  END IF;

  SELECT edition.*
    INTO v_edition
  FROM public.festival_editions_v2 edition
  WHERE edition.id = v_attendance.festival_edition_id;

  IF NOT FOUND OR v_edition.ends_on IS NULL OR v_edition.city_id IS NULL THEN
    RETURN 'source_missing';
  END IF;

  SELECT profile.user_id
    INTO v_user_id
  FROM public.profiles profile
  WHERE profile.id = v_attendance.profile_id;

  SELECT city.name, coalesce(nullif(city.timezone, ''), 'UTC')
    INTO v_city_name, v_timezone
  FROM public.cities city
  WHERE city.id = v_edition.city_id;

  IF v_user_id IS NULL OR v_timezone IS NULL THEN
    RETURN 'source_missing';
  END IF;

  v_lock_end := ((v_edition.ends_on + 1)::timestamp AT TIME ZONE v_timezone);

  IF now() >= v_lock_end THEN
    RETURN 'expired';
  END IF;

  IF public._festival_attendee_has_schedule_conflict(
    v_attendance.profile_id,
    v_attendance.festival_edition_id,
    now(),
    v_lock_end
  ) THEN
    RETURN 'schedule_conflict';
  END IF;

  IF v_attendance.schedule_activity_id IS NOT NULL THEN
    SELECT activity.*
      INTO v_linked_activity
    FROM public.player_scheduled_activities activity
    WHERE activity.id = v_attendance.schedule_activity_id
    FOR UPDATE;

    IF FOUND THEN
      IF v_linked_activity.activity_type <> 'festival_attendance'
         OR v_linked_activity.profile_id <> v_attendance.profile_id THEN
        RETURN 'invalid_schedule_link';
      END IF;

      v_schedule_id := v_linked_activity.id;
    END IF;
  END IF;

  -- A historic bug may have left the attendance link empty while the server-owned
  -- row itself survived. Prefer reattaching it rather than creating a duplicate.
  IF v_schedule_id IS NULL THEN
    SELECT activity.id
      INTO v_schedule_id
    FROM public.player_scheduled_activities activity
    WHERE activity.profile_id = v_attendance.profile_id
      AND activity.activity_type = 'festival_attendance'
      AND activity.metadata->>'festival_attendance_id' = v_attendance.id::text
    ORDER BY activity.created_at DESC NULLS LAST, activity.id DESC
    LIMIT 1
    FOR UPDATE;
  END IF;

  IF v_schedule_id IS NULL THEN
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
      v_attendance.profile_id,
      'festival_attendance',
      coalesce(v_attendance.checked_in_at, now()),
      v_lock_end,
      'in_progress',
      coalesce(v_attendance.checked_in_at, now()),
      'Festival: ' || coalesce(v_edition.name, 'Festival'),
      'Authoritative Festival attendance reservation',
      v_city_name,
      jsonb_build_object(
        'server_owned', true,
        'festival_attendance_id', v_attendance.id,
        'festival_launch_id', v_attendance.festival_launch_id,
        'festival_edition_id', v_attendance.festival_edition_id,
        'recovered', true
      )
    )
    RETURNING id INTO v_schedule_id;
  ELSE
    UPDATE public.player_scheduled_activities
    SET user_id = v_user_id,
        profile_id = v_attendance.profile_id,
        activity_type = 'festival_attendance',
        scheduled_start = coalesce(v_attendance.checked_in_at, scheduled_start, now()),
        scheduled_end = v_lock_end,
        status = 'in_progress',
        started_at = coalesce(started_at, v_attendance.checked_in_at, now()),
        completed_at = NULL,
        title = 'Festival: ' || coalesce(v_edition.name, 'Festival'),
        description = 'Authoritative Festival attendance reservation',
        location = v_city_name,
        metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object(
          'server_owned', true,
          'festival_attendance_id', v_attendance.id,
          'festival_launch_id', v_attendance.festival_launch_id,
          'festival_edition_id', v_attendance.festival_edition_id,
          'recovered', true
        ),
        updated_at = now()
    WHERE id = v_schedule_id;
  END IF;

  -- Only one active reservation may represent this attendee. Older duplicate rows
  -- are retired but retained for audit/history.
  UPDATE public.player_scheduled_activities
  SET status = 'cancelled',
      metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object(
        'festival_recovery_superseded', true,
        'festival_recovery_superseded_at', now()
      ),
      updated_at = now()
  WHERE profile_id = v_attendance.profile_id
    AND activity_type = 'festival_attendance'
    AND id <> v_schedule_id
    AND metadata->>'festival_attendance_id' = v_attendance.id::text
    AND status IN ('scheduled', 'in_progress');

  UPDATE public.festival_player_attendance
  SET schedule_activity_id = v_schedule_id,
      updated_at = now()
  WHERE id = v_attendance.id
    AND schedule_activity_id IS DISTINCT FROM v_schedule_id;

  IF v_attendance.schedule_activity_id IS NULL
     OR v_attendance.schedule_activity_id IS DISTINCT FROM v_schedule_id
     OR v_linked_activity.status IS DISTINCT FROM 'in_progress' THEN
    RETURN 'repaired';
  END IF;

  RETURN 'healthy';
END;
$function$;

REVOKE ALL ON FUNCTION public._festival_repair_attendance_schedule_lock(uuid)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public._festival_repair_attendance_schedule_lock(uuid)
  TO service_role;

CREATE OR REPLACE FUNCTION public._festival_complete_attendance_if_expired(
  p_attendance_id uuid
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_attendance public.festival_player_attendance%ROWTYPE;
  v_edition public.festival_editions_v2%ROWTYPE;
  v_timezone text := 'UTC';
  v_festival_end_at timestamptz;
BEGIN
  SELECT attendance.*
    INTO v_attendance
  FROM public.festival_player_attendance attendance
  WHERE attendance.id = p_attendance_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN 'not_found';
  END IF;

  IF v_attendance.status = 'completed' THEN
    PERFORM public._festival_ensure_attendance_wristband(v_attendance.id);

    UPDATE public.player_scheduled_activities
    SET status = 'completed',
        completed_at = coalesce(completed_at, v_attendance.completed_at, now()),
        metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object('festival_completed', true),
        updated_at = now()
    WHERE activity_type = 'festival_attendance'
      AND (
        id = v_attendance.schedule_activity_id
        OR metadata->>'festival_attendance_id' = v_attendance.id::text
      )
      AND status IN ('scheduled', 'in_progress');

    RETURN 'already_completed';
  END IF;

  IF v_attendance.status <> 'attending' THEN
    RETURN 'not_applicable';
  END IF;

  SELECT edition.*
    INTO v_edition
  FROM public.festival_editions_v2 edition
  WHERE edition.id = v_attendance.festival_edition_id;

  IF NOT FOUND OR v_edition.ends_on IS NULL THEN
    RETURN 'source_missing';
  END IF;

  IF v_edition.city_id IS NOT NULL THEN
    SELECT coalesce(nullif(city.timezone, ''), 'UTC')
      INTO v_timezone
    FROM public.cities city
    WHERE city.id = v_edition.city_id;

    v_timezone := coalesce(v_timezone, 'UTC');
  END IF;

  v_festival_end_at := ((v_edition.ends_on + 1)::timestamp AT TIME ZONE v_timezone);

  IF now() < v_festival_end_at THEN
    RETURN 'not_due';
  END IF;

  -- An attending row proves check-in authority existed. If the ticket marker
  -- drifted back to valid, repair it only in the consumed direction.
  PERFORM public._festival_repair_attendance_ticket_used(v_attendance.id);
  PERFORM public._festival_ensure_attendance_wristband(v_attendance.id);

  UPDATE public.player_scheduled_activities
  SET status = 'completed',
      completed_at = coalesce(completed_at, v_festival_end_at),
      metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object(
        'festival_completed', true,
        'festival_completed_at', v_festival_end_at
      ),
      updated_at = now()
  WHERE activity_type = 'festival_attendance'
    AND (
      id = v_attendance.schedule_activity_id
      OR metadata->>'festival_attendance_id' = v_attendance.id::text
    )
    AND status IN ('scheduled', 'in_progress');

  UPDATE public.festival_player_attendance
  SET status = 'completed',
      completed_at = coalesce(completed_at, v_festival_end_at),
      updated_at = now()
  WHERE id = v_attendance.id;

  RETURN 'completed';
END;
$function$;

REVOKE ALL ON FUNCTION public._festival_complete_attendance_if_expired(uuid)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public._festival_complete_attendance_if_expired(uuid)
  TO service_role;

CREATE OR REPLACE FUNCTION public.reconcile_my_festival_attendance()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_profile_id uuid := public.current_profile_id();
  v_attendance_id uuid;
  v_status text;
  v_completion_state text;
  v_ticket_state text;
  v_schedule_state text;
  v_wristband_healthy boolean;
  v_completed_count integer := 0;
  v_repaired_count integer := 0;
  v_attention_count integer := 0;
  v_results jsonb := '[]'::jsonb;
BEGIN
  IF v_profile_id IS NULL THEN
    RAISE EXCEPTION 'festival_profile_required' USING ERRCODE = 'P0001';
  END IF;

  FOR v_attendance_id IN
    SELECT attendance.id
    FROM public.festival_player_attendance attendance
    WHERE attendance.profile_id = v_profile_id
      AND attendance.status IN ('attending', 'left_early', 'completed')
    ORDER BY attendance.created_at, attendance.id
  LOOP
    v_completion_state := public._festival_complete_attendance_if_expired(v_attendance_id);

    IF v_completion_state = 'completed' THEN
      v_completed_count := v_completed_count + 1;
    END IF;

    SELECT attendance.status
      INTO v_status
    FROM public.festival_player_attendance attendance
    WHERE attendance.id = v_attendance_id;

    v_ticket_state := 'not_applicable';
    v_schedule_state := 'not_applicable';
    v_wristband_healthy := false;

    IF v_status = 'attending' THEN
      v_ticket_state := public._festival_repair_attendance_ticket_used(v_attendance_id);
      v_wristband_healthy := public._festival_ensure_attendance_wristband(v_attendance_id);
      v_schedule_state := public._festival_repair_attendance_schedule_lock(v_attendance_id);

      IF v_ticket_state = 'repaired' OR v_schedule_state = 'repaired' THEN
        v_repaired_count := v_repaired_count + 1;
      END IF;

      IF v_ticket_state = 'attention_required'
         OR v_schedule_state IN ('schedule_conflict', 'invalid_schedule_link', 'source_missing')
         OR NOT v_wristband_healthy THEN
        v_attention_count := v_attention_count + 1;
      END IF;
    ELSIF v_status IN ('left_early', 'completed') THEN
      v_wristband_healthy := public._festival_ensure_attendance_wristband(v_attendance_id);

      IF v_status = 'left_early' THEN
        UPDATE public.player_scheduled_activities
        SET status = 'cancelled',
            metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object('festival_left_early', true),
            updated_at = now()
        WHERE activity_type = 'festival_attendance'
          AND (
            id = (SELECT schedule_activity_id FROM public.festival_player_attendance WHERE id = v_attendance_id)
            OR metadata->>'festival_attendance_id' = v_attendance_id::text
          )
          AND status IN ('scheduled', 'in_progress');
      END IF;

      IF NOT v_wristband_healthy THEN
        v_attention_count := v_attention_count + 1;
      END IF;
    END IF;

    v_results := v_results || jsonb_build_array(jsonb_build_object(
      'attendanceId', v_attendance_id,
      'status', v_status,
      'completionState', v_completion_state,
      'ticketState', v_ticket_state,
      'scheduleState', v_schedule_state,
      'wristbandHealthy', v_wristband_healthy
    ));
  END LOOP;

  RETURN jsonb_build_object(
    'attendance', public.get_my_festival_attendance(),
    'completedCount', v_completed_count,
    'repairedCount', v_repaired_count,
    'attentionCount', v_attention_count,
    'reconciled', v_results
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.reconcile_my_festival_attendance()
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.reconcile_my_festival_attendance()
  TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.complete_expired_festival_attendance()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_attendance_id uuid;
  v_result text;
  v_examined integer := 0;
  v_completed integer := 0;
BEGIN
  FOR v_attendance_id IN
    SELECT attendance.id
    FROM public.festival_player_attendance attendance
    JOIN public.festival_editions_v2 edition
      ON edition.id = attendance.festival_edition_id
    LEFT JOIN public.cities city
      ON city.id = edition.city_id
    WHERE attendance.status = 'attending'
      AND edition.ends_on IS NOT NULL
      AND now() >= (
        (edition.ends_on + 1)::timestamp
        AT TIME ZONE coalesce(nullif(city.timezone, ''), 'UTC')
      )
    ORDER BY edition.ends_on, attendance.id
  LOOP
    v_examined := v_examined + 1;
    v_result := public._festival_complete_attendance_if_expired(v_attendance_id);
    IF v_result = 'completed' THEN
      v_completed := v_completed + 1;
    END IF;
  END LOOP;

  RETURN jsonb_build_object(
    'examined', v_examined,
    'completed', v_completed,
    'ranAt', now()
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.complete_expired_festival_attendance()
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.complete_expired_festival_attendance()
  TO service_role;

-- Complete expired attendees independently of browser activity. Five-minute cadence
-- keeps Festival Mode exit timely without requiring a Vercel/Edge runtime.
DO $block$
DECLARE
  v_job_id bigint;
BEGIN
  SELECT jobid
    INTO v_job_id
  FROM cron.job
  WHERE jobname = 'festival-attendee-completion';

  IF v_job_id IS NOT NULL THEN
    PERFORM cron.unschedule(v_job_id);
  END IF;

  PERFORM cron.schedule(
    'festival-attendee-completion',
    '*/5 * * * *',
    $cron$SELECT public.complete_expired_festival_attendance();$cron$
  );
END;
$block$;

COMMENT ON FUNCTION public._festival_ensure_attendance_wristband(uuid) IS
  'Idempotently restores the one canonical wristband for a character who genuinely checked in.';
COMMENT ON FUNCTION public._festival_repair_attendance_ticket_used(uuid) IS
  'Repairs only valid-to-used ticket drift for an authoritative attending row; never restores reusable admission.';
COMMENT ON FUNCTION public._festival_repair_attendance_schedule_lock(uuid) IS
  'Repairs the server-owned shared-calendar Festival reservation when safe; reports conflicts rather than cancelling normal commitments.';
COMMENT ON FUNCTION public._festival_complete_attendance_if_expired(uuid) IS
  'Idempotently completes one attending character after the Festival-local event window ends and closes Festival schedule reservations.';
COMMENT ON FUNCTION public.reconcile_my_festival_attendance() IS
  'Reconciles the signed-in active character attendee lifecycle and returns fresh authoritative attendance for reconnect/focus recovery.';
COMMENT ON FUNCTION public.complete_expired_festival_attendance() IS
  'Cron-safe batch completion for Festival attendees whose edition-local event window has ended.';

NOTIFY pgrst, 'reload schema';
