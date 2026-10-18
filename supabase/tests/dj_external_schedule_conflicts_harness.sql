-- Run with owner connection; rollback-only tests with real live fixture rows.
-- No travel or education records are permanently changed.
\set ON_ERROR_STOP on
BEGIN;
DO $external$
DECLARE
  v_travel_id uuid;
  v_profile uuid;
  v_start timestamptz := now()+interval '7 days';
  v_reason text;
  v_course record;
  v_day date;
  v_class_start timestamptz;
BEGIN
  IF has_function_privilege('authenticated',
      'public.dj_external_schedule_conflict(uuid,timestamptz,timestamptz)','EXECUTE')
  THEN RAISE EXCEPTION 'SECURITY FAILURE: player can invoke restricted conflict helper'; END IF;

  SELECT id,profile_id INTO v_travel_id,v_profile FROM public.player_travel_history
  WHERE profile_id IS NOT NULL AND status='completed' ORDER BY id LIMIT 1;
  IF v_travel_id IS NULL THEN RAISE EXCEPTION 'No completed travel fixture'; END IF;

  -- Re-purpose a historical trip *inside a transaction only* to model a
  -- future scheduled journey. Everything is reverted at final ROLLBACK.
  UPDATE public.player_travel_history SET
    status='scheduled',
    departure_time=v_start,
    scheduled_departure_time=v_start,
    arrival_time=v_start+interval '4 hours'
  WHERE id=v_travel_id;

  v_reason:=public.dj_external_schedule_conflict(
    v_profile,v_start+interval '1 hour',v_start+interval '2 hours');
  IF v_reason IS DISTINCT FROM 'DJ set overlaps booked or active travel'
  THEN RAISE EXCEPTION 'Failed to block a future scheduled trip: %',v_reason; END IF;

  SELECT e.profile_id,e.enrolled_at,e.scheduled_end_date,
    uc.class_start_hour,uc.class_end_hour,city.timezone
  INTO v_course
  FROM public.player_university_enrollments e
  JOIN public.university_courses uc ON uc.id=e.course_id
  JOIN public.universities u ON u.id=e.university_id
  JOIN public.cities city ON city.id=u.city_id
  WHERE e.status::text IN ('enrolled','in_progress')
    AND uc.class_start_hour BETWEEN 0 AND 23
    AND uc.class_end_hour BETWEEN 1 AND 24
    AND city.timezone IS NOT NULL
  ORDER BY e.id LIMIT 1;
  IF v_course.profile_id IS NULL THEN RAISE EXCEPTION 'No active class fixture'; END IF;
  v_day := (v_course.enrolled_at AT TIME ZONE 'UTC')::date;
  IF v_course.scheduled_end_date IS NOT NULL AND v_day >
      (v_course.scheduled_end_date AT TIME ZONE 'UTC')::date
  THEN RAISE EXCEPTION 'Active class fixture date invalid'; END IF;
  v_class_start := (v_day::timestamp+
    make_interval(hours=>v_course.class_start_hour)) AT TIME ZONE v_course.timezone;
  v_reason:=public.dj_external_schedule_conflict(
    v_course.profile_id,v_class_start+interval '5 minutes',
    v_class_start+interval '35 minutes');
  IF v_reason IS DISTINCT FROM 'DJ set overlaps a scheduled university class'
  THEN RAISE EXCEPTION 'Failed to block recurring campus class: %',v_reason; END IF;
END $external$;
ROLLBACK;
