-- Authoritative Festival attendee entry/exit mutations.
-- These functions are intentionally narrow: the browser may request a transition,
-- but the database revalidates identity, ticket ownership, festival dates, location
-- and travel state before changing attendance.

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
  v_is_traveling boolean;
  v_city_timezone text;
  v_local_date date;
  v_product_class text;
  v_product_edition_id uuid;
  v_wristband_issued boolean;
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
    IF v_ticket.status <> 'used' THEN
      RAISE EXCEPTION 'festival_checked_in_ticket_inconsistent' USING ERRCODE = 'P0001';
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

  SELECT coalesce(nullif(city.timezone, ''), 'UTC')
    INTO v_city_timezone
  FROM public.cities city
  WHERE city.id = v_edition.city_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'festival_city_unavailable' USING ERRCODE = 'P0001';
  END IF;

  v_local_date := (now() AT TIME ZONE v_city_timezone)::date;

  IF v_local_date < v_edition.starts_on THEN
    RAISE EXCEPTION 'festival_not_started' USING ERRCODE = 'P0001';
  END IF;

  IF v_local_date > v_edition.ends_on THEN
    RAISE EXCEPTION 'festival_finished' USING ERRCODE = 'P0001';
  END IF;

  SELECT profile.current_city_id, coalesce(profile.is_traveling, false)
    INTO v_current_city_id, v_is_traveling
  FROM public.profiles profile
  WHERE profile.id = v_profile_id;

  IF v_is_traveling THEN
    RAISE EXCEPTION 'festival_character_traveling' USING ERRCODE = 'P0001';
  END IF;

  IF v_current_city_id IS DISTINCT FROM v_edition.city_id THEN
    RAISE EXCEPTION 'festival_wrong_city' USING ERRCODE = 'P0001';
  END IF;

  UPDATE public.festival_issued_tickets
  SET status = 'used',
      updated_at = now()
  WHERE id = v_ticket.id;

  UPDATE public.festival_player_attendance
  SET status = 'attending',
      checked_in_at = coalesce(checked_in_at, now()),
      left_at = NULL,
      updated_at = now()
  WHERE id = v_attendance.id
  RETURNING * INTO v_attendance;

  -- The existing AFTER UPDATE trigger issues exactly one wristband when the
  -- lifecycle reaches attending.
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

COMMENT ON FUNCTION public.check_in_to_festival(uuid) IS
  'Server-authoritative attendee check-in. Revalidates active character, admission ticket, Festival dates, travel state and city before atomically consuming the admission ticket and entering attending state.';

COMMENT ON FUNCTION public.leave_festival_early(uuid) IS
  'Server-authoritative early Festival exit for the active character. Only attending rows may transition to left_early; retries are idempotent.';

NOTIFY pgrst, 'reload schema';
