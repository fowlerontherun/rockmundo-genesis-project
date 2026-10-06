CREATE OR REPLACE FUNCTION public.admin_get_coma_system_health()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_admin uuid := auth.uid();
  v_recent_active_coma_users integer := 0;
  v_current_inactivity_comas integer := 0;
  v_entries_7d integer := 0;
  v_revivals_7d integer := 0;
  v_cron_active boolean := false;
  v_cron_schedule text;
  v_last_cron_status text;
  v_last_cron_started_at timestamptz;
  v_last_cron_completed_at timestamptz;
  v_last_cron_message text;
BEGIN
  IF NOT public.has_role(v_admin, 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'ADMIN_REQUIRED' USING ERRCODE = '42501';
  END IF;

  SELECT count(*)
    INTO v_current_inactivity_comas
    FROM public.profiles p
   WHERE p.deleted_at IS NULL
     AND p.died_at IS NOT NULL
     AND p.death_cause ILIKE '%inactivity%';

  SELECT count(DISTINCT p.user_id)
    INTO v_recent_active_coma_users
    FROM public.profiles p
    JOIN auth.users u ON u.id = p.user_id
   WHERE p.deleted_at IS NULL
     AND p.died_at IS NOT NULL
     AND p.death_cause <> 'Deleted by player'
     AND u.last_sign_in_at >= now() - interval '30 days';

  SELECT
    count(*) FILTER (WHERE event_type = 'entered'),
    count(*) FILTER (WHERE event_type = 'revived')
  INTO v_entries_7d, v_revivals_7d
  FROM public.character_coma_events
  WHERE created_at >= now() - interval '7 days';

  SELECT j.active, j.schedule
    INTO v_cron_active, v_cron_schedule
    FROM cron.job j
   WHERE j.jobname = 'process-inactive-character-comas'
   ORDER BY j.jobid DESC
   LIMIT 1;

  SELECT d.status, d.start_time, d.end_time, d.return_message
    INTO v_last_cron_status, v_last_cron_started_at, v_last_cron_completed_at, v_last_cron_message
    FROM cron.job_run_details d
    JOIN cron.job j ON j.jobid = d.jobid
   WHERE j.jobname = 'process-inactive-character-comas'
   ORDER BY d.start_time DESC
   LIMIT 1;

  RETURN jsonb_build_object(
    'healthy',
      COALESCE(v_cron_active, false)
      AND COALESCE(v_last_cron_status, '') = 'succeeded'
      AND v_recent_active_coma_users = 0,
    'current_inactivity_comas', v_current_inactivity_comas,
    'recent_active_users_in_coma', v_recent_active_coma_users,
    'entries_last_7_days', v_entries_7d,
    'revivals_last_7_days', v_revivals_7d,
    'cron', jsonb_build_object(
      'active', COALESCE(v_cron_active, false),
      'schedule', v_cron_schedule,
      'last_status', v_last_cron_status,
      'last_started_at', v_last_cron_started_at,
      'last_completed_at', v_last_cron_completed_at,
      'last_message', v_last_cron_message
    )
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.admin_get_coma_system_health() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_get_coma_system_health() FROM anon;
GRANT EXECUTE ON FUNCTION public.admin_get_coma_system_health() TO authenticated;
