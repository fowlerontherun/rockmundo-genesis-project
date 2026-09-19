-- Final Top of the Pops release hardening.
-- Internal trigger helpers must not remain callable through the public Data API surface.

REVOKE ALL ON FUNCTION public.totp_apply_performance_style_bonus() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.totp_lock_live_tv_snapshot() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.totp_seed_backstage_interview() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.totp_seed_live_tv_extras() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.totp_normalize_notification_contract() FROM PUBLIC, anon, authenticated;

-- One authoritative operational health check for admins/service jobs.
CREATE OR REPLACE FUNCTION public.totp_release_health()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_latest_chart_date date;
  v_streaming_rows integer := 0;
  v_digital_rows integer := 0;
  v_next_episode record;
  v_invitation_count integer := 0;
  v_invalid_notifications integer := 0;
  v_prepare_cron boolean := false;
  v_chart_cron boolean := false;
  v_broadcast_cron boolean := false;
  v_chart_fresh boolean := false;
BEGIN
  IF auth.uid() IS NOT NULL AND NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Admin access required';
  END IF;

  SELECT max(chart_date)
  INTO v_latest_chart_date
  FROM public.chart_entries
  WHERE country = 'United Kingdom'
    AND entry_type = 'song'
    AND chart_type IN ('streaming', 'digital_sales');

  IF v_latest_chart_date IS NOT NULL THEN
    SELECT count(*) FILTER (WHERE chart_type = 'streaming'),
           count(*) FILTER (WHERE chart_type = 'digital_sales')
    INTO v_streaming_rows, v_digital_rows
    FROM public.chart_entries
    WHERE chart_date = v_latest_chart_date
      AND country = 'United Kingdom'
      AND entry_type = 'song'
      AND chart_type IN ('streaming', 'digital_sales');
  END IF;

  v_chart_fresh := v_latest_chart_date IS NOT NULL
    AND v_latest_chart_date >= current_date - 3;

  SELECT e.id, e.episode_number, e.episode_date, e.status, e.check_in_at, e.broadcast_at
  INTO v_next_episode
  FROM public.totp_episodes e
  WHERE e.status NOT IN ('completed', 'cancelled')
  ORDER BY e.episode_date ASC
  LIMIT 1;

  IF v_next_episode.id IS NOT NULL THEN
    SELECT count(*) INTO v_invitation_count
    FROM public.totp_invitations
    WHERE episode_id = v_next_episode.id;
  END IF;

  SELECT count(*) INTO v_invalid_notifications
  FROM public.notifications
  WHERE action_path = '/top-of-the-pops'
    AND (category IS NULL OR title IS NULL OR title <> 'Top of the Pops');

  SELECT coalesce(bool_or(active), false) INTO v_prepare_cron
  FROM cron.job WHERE jobname = 'prepare_top_of_the_pops';

  SELECT coalesce(bool_or(active), false) INTO v_chart_cron
  FROM cron.job WHERE jobname = 'refresh_totp_uk_charts';

  SELECT coalesce(bool_or(active), false) INTO v_broadcast_cron
  FROM cron.job WHERE jobname = 'run_top_of_the_pops_broadcast_cycle';

  RETURN jsonb_build_object(
    'healthy', (
      v_chart_fresh
      AND v_prepare_cron
      AND v_chart_cron
      AND v_broadcast_cron
      AND v_next_episode.id IS NOT NULL
      AND v_invalid_notifications = 0
    ),
    'chart', jsonb_build_object(
      'latest_date', v_latest_chart_date,
      'fresh', v_chart_fresh,
      'streaming_rows', v_streaming_rows,
      'digital_rows', v_digital_rows
    ),
    'next_episode', CASE WHEN v_next_episode.id IS NULL THEN NULL ELSE jsonb_build_object(
      'id', v_next_episode.id,
      'episode_number', v_next_episode.episode_number,
      'episode_date', v_next_episode.episode_date,
      'status', v_next_episode.status,
      'check_in_at', v_next_episode.check_in_at,
      'broadcast_at', v_next_episode.broadcast_at,
      'invitations', v_invitation_count
    ) END,
    'crons', jsonb_build_object(
      'prepare', v_prepare_cron,
      'uk_chart_refresh', v_chart_cron,
      'broadcast_cycle', v_broadcast_cron
    ),
    'invalid_totp_notifications', v_invalid_notifications,
    'checked_at', now()
  );
END;
$$;

REVOKE ALL ON FUNCTION public.totp_release_health() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.totp_release_health() TO authenticated, service_role;

COMMENT ON FUNCTION public.totp_release_health() IS
  'Admin/service operational health check covering chart freshness, next episode, TOTP cron jobs and notification contract validity.';
