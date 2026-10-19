-- #4228: service-only, timezone-aware university auto-attendance.
-- Manual, authenticated in-session attendance uses the existing RPC unchanged.
-- Do not award today's XP until the actual university-local class has ended.

CREATE OR REPLACE FUNCTION public.university_auto_attendance_due(p_enrollment_id uuid)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $due$
DECLARE
  v_record record;
  v_tz text;
  v_local_day date;
  v_start_hour integer;
  v_end_hour integer;
  v_start timestamptz;
  v_end timestamptz;
BEGIN
  SELECT e.id,e.auto_attend,e.status,e.enrolled_at,e.scheduled_end_date,
         c.class_start_hour,c.class_end_hour,city.timezone
    INTO v_record
    FROM public.player_university_enrollments e
    JOIN public.university_courses c ON c.id=e.course_id
    JOIN public.universities u ON u.id=e.university_id
    JOIN public.cities city ON city.id=u.city_id
    WHERE e.id=p_enrollment_id;
  IF NOT FOUND OR COALESCE(v_record.auto_attend,false)=false
     OR v_record.status::text NOT IN ('enrolled','in_progress') THEN
    RETURN jsonb_build_object('due',false,'reason','inactive_enrollment');
  END IF;
  v_tz:=v_record.timezone;
  IF v_tz IS NULL OR NOT EXISTS
     (SELECT 1 FROM pg_catalog.pg_timezone_names WHERE name=v_tz) THEN
    RETURN jsonb_build_object('due',false,'reason','invalid_university_timezone');
  END IF;
  v_start_hour:=COALESCE(v_record.class_start_hour,10);
  v_end_hour:=COALESCE(v_record.class_end_hour,14);
  IF v_start_hour<0 OR v_start_hour>23
     OR v_end_hour<1 OR v_end_hour>24
     OR v_end_hour<=v_start_hour THEN
    RETURN jsonb_build_object('due',false,'reason','invalid_class_hours');
  END IF;

  v_local_day:=(now() AT TIME ZONE v_tz)::date;
  v_start:=(v_local_day::timestamp + make_interval(hours=>v_start_hour)) AT TIME ZONE v_tz;
  v_end:=(v_local_day::timestamp + make_interval(hours=>v_end_hour)) AT TIME ZONE v_tz;
  IF v_record.enrolled_at IS NULL OR v_record.enrolled_at>v_end THEN
    RETURN jsonb_build_object('due',false,'reason','not_enrolled_for_session');
  END IF;
  IF (v_record.scheduled_end_date AT TIME ZONE v_tz)::date < v_local_day THEN
    RETURN jsonb_build_object('due',false,'reason','past_course_end');
  END IF;
  IF now()<v_end THEN
    RETURN jsonb_build_object('due',false,'reason','class_not_ended',
      'local_day',v_local_day,'class_ends_at',v_end);
  END IF;
  RETURN jsonb_build_object(
    'due',true,'attendance_date',v_local_day,
    'timezone',v_tz,'class_starts_at',v_start,'class_ends_at',v_end);
END
$due$;

-- Serialise auto settlement with enrollment toggles, then validate due
-- time and local date INSIDE the same SQL transaction as the XP award.
CREATE OR REPLACE FUNCTION public.record_university_auto_attendance_reward(
  p_enrollment_id uuid,p_xp integer,p_remote boolean,p_connection_failed boolean
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $award$
DECLARE
  v_window jsonb;
  v_result jsonb;
BEGIN
  PERFORM 1 FROM public.player_university_enrollments
    WHERE id=p_enrollment_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('awarded',false,'reason','enrollment_missing');
  END IF;
  v_window:=public.university_auto_attendance_due(p_enrollment_id);
  IF v_window->>'due'<>'true' OR v_window->>'due' IS NULL THEN
    RETURN jsonb_build_object('awarded',false,'reason',COALESCE(v_window->>'reason','not_due'));
  END IF;
  v_result:=public.record_university_attendance_reward(
    p_enrollment_id,(v_window->>'attendance_date')::date,
    p_xp,p_remote,p_connection_failed);
  RETURN v_result || jsonb_build_object(
    'attendance_date',v_window->>'attendance_date',
    'class_starts_at',v_window->>'class_starts_at',
    'class_ends_at',v_window->>'class_ends_at',
    'timezone',v_window->>'timezone');
END
$award$;

REVOKE ALL ON FUNCTION public.university_auto_attendance_due(uuid) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.record_university_auto_attendance_reward(uuid,integer,boolean,boolean) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.university_auto_attendance_due(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.record_university_auto_attendance_reward(uuid,integer,boolean,boolean) TO service_role;

-- Hourly schedule covers university cities worldwide; the authoritative
-- local-time gate and UNIQUE(enrollment_id,attendance_date) handle replay.
-- Keep existing job id #1, run as postgres and remove the old stored JWT.
DO $cron$
DECLARE v_old bigint;v_new bigint;
BEGIN
  SELECT jobid INTO STRICT v_old FROM cron.job
   WHERE jobname='daily-university-attendance' AND active=true;
  IF (SELECT count(*) FROM vault.decrypted_secrets
    WHERE name='internal_cron_secret' AND length(decrypted_secret)>=32)<>1
  THEN RAISE EXCEPTION 'university_internal_cron_secret_missing_or_ambiguous'; END IF;

  v_new:=cron.schedule('daily-university-attendance','5 * * * *',
    $job$SELECT net.http_post(
      url:='https://yztogmdixmchsmimtent.supabase.co/functions/v1/university-attendance',
      headers:=jsonb_build_object(
        'Content-Type','application/json',
        'x-cron-secret',(SELECT decrypted_secret FROM vault.decrypted_secrets
                         WHERE name='internal_cron_secret' LIMIT 1)),
      body:=jsonb_build_object('triggeredBy','pg_cron'),
      timeout_milliseconds:=120000
    );$job$);
  IF v_new IS DISTINCT FROM v_old THEN
    RAISE EXCEPTION 'university_cron_job_id_changed_%_%',v_old,v_new;
  END IF;
END
$cron$;
