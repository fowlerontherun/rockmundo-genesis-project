-- #4228: production-safe BEGIN/ROLLBACK security and course-time checks.
-- No real enrolment is awarded, and no profile cash/XP is altered.
BEGIN;
DO $verify$
DECLARE
 v_count integer;
 v_row record;
 v_window jsonb;
 v_unknown jsonb;
 v_fake uuid := gen_random_uuid();
BEGIN
 IF (SELECT count(*) FROM cron.job
   WHERE jobid=1 AND jobname='daily-university-attendance'
     AND active AND schedule='5 * * * *'
     AND command ILIKE '%vault.decrypted_secrets%'
     AND command ILIKE '%x-cron-secret%'
     AND command NOT ILIKE '%Bearer %'
     AND command NOT ILIKE '%eyJ%') <> 1
 THEN RAISE EXCEPTION 'university_cron_secret_or_cadence_drift'; END IF;
 IF (SELECT count(*) FROM vault.decrypted_secrets
     WHERE name='internal_cron_secret' AND length(decrypted_secret)>=32) <>1
 THEN RAISE EXCEPTION 'university_vault_secret_missing'; END IF;
 IF public.verify_internal_cron_secret(NULL) IS DISTINCT FROM false
    OR public.verify_internal_cron_secret('invalid-internal-secret-12345678901234567890') IS DISTINCT FROM false
    OR public.verify_internal_cron_secret(
      (SELECT decrypted_secret FROM vault.decrypted_secrets
       WHERE name='internal_cron_secret' LIMIT 1)) IS DISTINCT FROM true
 THEN RAISE EXCEPTION 'university_cron_verification_fails'; END IF;
 IF has_function_privilege('anon','public.university_auto_attendance_due(uuid)','execute')
   OR has_function_privilege('authenticated','public.university_auto_attendance_due(uuid)','execute')
   OR has_function_privilege('anon','public.record_university_auto_attendance_reward(uuid,integer,boolean,boolean)','execute')
   OR has_function_privilege('authenticated','public.record_university_auto_attendance_reward(uuid,integer,boolean,boolean)','execute')
   OR NOT has_function_privilege('service_role','public.university_auto_attendance_due(uuid)','execute')
   OR NOT has_function_privilege('service_role','public.record_university_auto_attendance_reward(uuid,integer,boolean,boolean)','execute')
   OR has_function_privilege('authenticated','public.record_university_attendance_reward(uuid,date,integer,boolean,boolean)','execute')
 THEN RAISE EXCEPTION 'university_auto_function_acl_drift'; END IF;

 -- Dynamic DST contract: classes end at the local university clock hour.
 IF (timestamp '2026-10-19 14:00' AT TIME ZONE 'Europe/London') IS DISTINCT FROM
     timestamptz '2026-10-19 13:00:00+00'
 OR (timestamp '2026-01-15 14:00' AT TIME ZONE 'Europe/London') IS DISTINCT FROM
     timestamptz '2026-01-15 14:00:00+00'
 OR (timestamp '2026-10-19 14:00' AT TIME ZONE 'Europe/Madrid') IS DISTINCT FROM
     timestamptz '2026-10-19 12:00:00+00'
 THEN RAISE EXCEPTION 'university_local_dst_window_wrong'; END IF;

 -- A non-existing enrollment must never mint XP or trigger calendar effects.
 v_window := public.university_auto_attendance_due(v_fake);
 v_unknown := public.record_university_auto_attendance_reward(v_fake,100,false,false);
 IF v_window->>'due' IS DISTINCT FROM 'false'
  OR v_unknown->>'awarded' IS DISTINCT FROM 'false'
  OR v_unknown->>'reason' IS DISTINCT FROM 'enrollment_missing'
 THEN RAISE EXCEPTION 'unknown_enrollment_reward_accepted'; END IF;

 -- The authoritative due helper may only report due AFTER local class end
 -- and never for a date past the course's local completion date.
 v_count := 0;
 FOR v_row IN
   SELECT e.id,c.class_start_hour,c.class_end_hour,ci.timezone,
          e.scheduled_end_date
   FROM public.player_university_enrollments e
   JOIN public.university_courses c ON c.id=e.course_id
   JOIN public.universities u ON u.id=e.university_id
   JOIN public.cities ci ON ci.id=u.city_id
   WHERE e.status IN ('enrolled','in_progress') AND e.auto_attend=true
 LOOP
   v_window := public.university_auto_attendance_due(v_row.id);
   IF v_window->>'due'='true' AND (
       (v_window->>'class_ends_at')::timestamptz > now()
       OR (v_window->>'attendance_date')::date
          > (v_row.scheduled_end_date AT TIME ZONE v_row.timezone)::date
       OR (v_window->>'attendance_date')::date
          <> (now() AT TIME ZONE v_row.timezone)::date
     )
   THEN RAISE EXCEPTION 'early_or_wrong_day_university_auto_award'; END IF;
   v_count := v_count + 1;
 END LOOP;
 IF v_count=0 THEN
   RAISE EXCEPTION 'university_auto_fixture_requires_active_enrollment'; END IF;
 IF NOT EXISTS (SELECT 1 FROM pg_constraint
   WHERE conrelid='public.player_university_attendance'::regclass
    AND contype='u'
    AND pg_get_constraintdef(oid) LIKE '%enrollment_id, attendance_date%')
 THEN RAISE EXCEPTION 'university_attendance_unique_replay_guard_missing'; END IF;
END
$verify$;
ROLLBACK;
SELECT 'university_auto_scheduler_and_class_window_passed' result;
