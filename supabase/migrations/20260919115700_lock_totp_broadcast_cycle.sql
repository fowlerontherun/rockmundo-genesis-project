-- Phase 0 lifecycle hardening: prevent overlapping pg_cron/manual lifecycle runs.
CREATE OR REPLACE FUNCTION public.totp_run_broadcast_cycle(p_now timestamptz DEFAULT now())
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_episode record;
  v_performance record;
  v_locked_count integer := 0;
  v_started_count integer := 0;
  v_settled_count integer := 0;
  v_completed_count integer := 0;
  v_archived_count integer := 0;
BEGIN
  -- One lifecycle runner at a time. A second cron/manual invocation waits for
  -- this transaction instead of racing rewards, archive creation or state changes.
  PERFORM pg_advisory_xact_lock(hashtextextended('totp_run_broadcast_cycle', 0));

  FOR v_episode IN
    SELECT e.*
    FROM public.totp_episodes e
    WHERE e.status NOT IN ('completed','cancelled')
      AND e.broadcast_at <= p_now + interval '1 day'
      AND e.broadcast_at >= p_now - interval '2 days'
    ORDER BY e.broadcast_at
  LOOP
    IF p_now >= v_episode.check_in_at + interval '45 minutes'
       AND v_episode.status IN ('scheduled','inviting') THEN
      UPDATE public.totp_invitations
      SET status = 'expired', updated_at = p_now
      WHERE episode_id = v_episode.id
        AND status = 'invited';

      UPDATE public.totp_invitations
      SET status = 'missed',
          missed_reason = coalesce(missed_reason, 'missed_studio_check_in'),
          updated_at = p_now
      WHERE episode_id = v_episode.id
        AND status = 'accepted';

      v_locked_count := v_locked_count + public.totp_admin_lock_running_order(v_episode.id);
      v_episode.status := 'locked';
    END IF;

    IF p_now >= v_episode.broadcast_at
       AND v_episode.status = 'locked' THEN
      v_archived_count := v_archived_count + public.totp_build_episode_broadcast_replays(v_episode.id);
      UPDATE public.totp_episodes
      SET status = 'broadcast', updated_at = p_now
      WHERE id = v_episode.id;
      v_started_count := v_started_count + 1;
      v_episode.status := 'broadcast';
    END IF;

    IF p_now >= v_episode.broadcast_at + interval '60 minutes'
       AND v_episode.status = 'broadcast' THEN
      FOR v_performance IN
        SELECT id
        FROM public.totp_performances
        WHERE episode_id = v_episode.id
          AND completed_at IS NULL
        ORDER BY running_order
      LOOP
        PERFORM public.totp_complete_performance(v_performance.id, NULL);
        v_settled_count := v_settled_count + 1;
      END LOOP;

      v_archived_count := v_archived_count + public.totp_build_episode_broadcast_replays(v_episode.id);

      UPDATE public.totp_episodes
      SET status = 'completed', updated_at = p_now
      WHERE id = v_episode.id;
      v_completed_count := v_completed_count + 1;
    END IF;
  END LOOP;

  RETURN jsonb_build_object(
    'locked_acts', v_locked_count,
    'broadcasts_started', v_started_count,
    'performances_settled', v_settled_count,
    'broadcasts_completed', v_completed_count,
    'archive_attempts', v_archived_count,
    'ran_at', p_now
  );
END;
$$;

REVOKE ALL ON FUNCTION public.totp_run_broadcast_cycle(timestamptz) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.totp_run_broadcast_cycle(timestamptz) TO service_role;
