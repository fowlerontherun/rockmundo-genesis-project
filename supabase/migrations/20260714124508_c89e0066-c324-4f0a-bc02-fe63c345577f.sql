
CREATE OR REPLACE FUNCTION public.admin_get_beta_health_overview()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result jsonb;
  v_active_24h int;
  v_new_profiles int;
  v_stuck int;
  v_active_statuses int;
  v_failed_cron int;
  v_recent_errors int;
  v_admin_actions int;
  v_total_cash numeric;
  v_latest_errors jsonb;
  v_latest_cron jsonb;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'not authorized';
  END IF;

  SELECT COUNT(DISTINCT user_id) INTO v_active_24h
    FROM public.game_activity_logs
   WHERE created_at > now() - interval '24 hours';

  SELECT COUNT(*) INTO v_new_profiles
    FROM public.profiles
   WHERE created_at > now() - interval '24 hours';

  SELECT COUNT(*) INTO v_stuck
    FROM public.profile_activity_statuses
   WHERE status IN ('busy','in_progress','processing')
     AND (ends_at IS NULL OR ends_at < now() - interval '1 hour');

  SELECT COUNT(*) INTO v_active_statuses
    FROM public.profile_activity_statuses
   WHERE status IN ('busy','in_progress','processing');

  SELECT COUNT(*) INTO v_failed_cron
    FROM public.cron_job_runs
   WHERE status IN ('failed','error')
     AND started_at > now() - interval '24 hours';

  SELECT COUNT(*) INTO v_recent_errors
    FROM public.game_activity_logs
   WHERE created_at > now() - interval '24 hours'
     AND (activity_type ILIKE '%error%' OR activity_type ILIKE '%fail%');

  SELECT COUNT(*) INTO v_admin_actions
    FROM public.admin_audit_log
   WHERE created_at > now() - interval '24 hours';

  SELECT COALESCE(SUM(cash), 0) INTO v_total_cash FROM public.profiles;

  SELECT COALESCE(jsonb_agg(row_to_json(t)), '[]'::jsonb) INTO v_latest_errors
    FROM (
      SELECT id, activity_type, message, created_at
        FROM public.game_activity_logs
       WHERE activity_type ILIKE '%error%' OR activity_type ILIKE '%fail%'
       ORDER BY created_at DESC
       LIMIT 5
    ) t;

  SELECT COALESCE(jsonb_agg(row_to_json(t)), '[]'::jsonb) INTO v_latest_cron
    FROM (
      SELECT id, job_name, status, started_at, completed_at
        FROM public.cron_job_runs
       ORDER BY started_at DESC
       LIMIT 5
    ) t;

  v_result := jsonb_build_object(
    'active_players_24h', v_active_24h,
    'new_profiles_24h', v_new_profiles,
    'stuck_activity_statuses', v_stuck,
    'active_activity_statuses', v_active_statuses,
    'failed_recent_cron_jobs', v_failed_cron,
    'recent_activity_errors', v_recent_errors,
    'recent_admin_actions', v_admin_actions,
    'total_cash', v_total_cash,
    'latest_errors', v_latest_errors,
    'latest_cron_jobs', v_latest_cron
  );

  RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_get_beta_health_overview() TO authenticated;
