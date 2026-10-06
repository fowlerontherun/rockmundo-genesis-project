CREATE OR REPLACE FUNCTION public.admin_get_coma_system_health()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_admin uuid := auth.uid();
  v_inactivity_snapshot_conflicts integer := 0;
  v_missing_activity_snapshots integer := 0;
  v_recent_returners_in_coma integer := 0;
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
    INTO v_inactivity_snapshot_conflicts
    FROM public.profiles p
   WHERE p.deleted_at IS NULL
     AND p.died_at IS NOT NULL
     AND p.death_cause ILIKE '%inactivity%'
     AND p.coma_started_at IS NOT NULL
     AND p.coma_last_account_activity_at IS NOT NULL
     AND p.coma_last_account_activity_at >= p.coma_started_at - interval '30 days';

  SELECT count(*)
    INTO v_missing_activity_snapshots
    FROM public.profiles p
   WHERE p.deleted_at IS NULL
     AND p.died_at IS NOT NULL
     AND p.death_cause ILIKE '%inactivity%'
     AND (
       p.coma_started_at IS NULL
       OR p.coma_last_account_activity_at IS NULL
     );

  -- Count only returned accounts that still have no living character. A player
  -- who revived one slot and leaves another comatose is no longer blocked.
  SELECT count(DISTINCT p.user_id)
    INTO v_recent_returners_in_coma
    FROM public.profiles p
    JOIN auth.users u ON u.id = p.user_id
   WHERE p.deleted_at IS NULL
     AND p.died_at IS NOT NULL
     AND p.death_cause ILIKE '%inactivity%'
     AND u.last_sign_in_at > COALESCE(p.coma_started_at, p.died_at)
     AND NOT EXISTS (
       SELECT 1
       FROM public.profiles living
       WHERE living.user_id = p.user_id
         AND living.deleted_at IS NULL
         AND living.died_at IS NULL
     );

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
      AND v_inactivity_snapshot_conflicts = 0
      AND v_missing_activity_snapshots = 0,
    'current_inactivity_comas', v_current_inactivity_comas,
    'inactivity_snapshot_conflicts', v_inactivity_snapshot_conflicts,
    'missing_activity_snapshots', v_missing_activity_snapshots,
    'recent_returners_in_coma', v_recent_returners_in_coma,
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
