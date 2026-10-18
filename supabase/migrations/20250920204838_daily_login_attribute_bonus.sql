-- Daily login attribute bonus job and helper

-- Ensure pg_cron extension is available for scheduling
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA extensions;

CREATE OR REPLACE FUNCTION public.process_daily_login_attribute_bonus()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_now timestamptz := timezone('utc', now());
  v_threshold timestamptz := v_now - INTERVAL '24 hours';
  v_awarded integer := 0;
BEGIN
  WITH eligible_profiles AS (
    SELECT p.id AS profile_id, u.last_sign_in_at
    FROM public.profiles AS p
    JOIN auth.users AS u ON u.id = p.user_id
    WHERE u.last_sign_in_at IS NOT NULL
      AND u.last_sign_in_at >= v_threshold
      AND COALESCE(p.is_active, true)
      AND NOT EXISTS (
        SELECT 1
        FROM public.profile_attribute_transactions AS t
        WHERE t.profile_id = p.id
          AND t.transaction_type = 'daily_login_bonus'
          AND t.created_at >= date_trunc('day', v_now)
      )
  ),
  inserted_transactions AS (
    INSERT INTO public.profile_attribute_transactions (
      profile_id,
      transaction_type,
      points_delta,
      metadata
    )
    SELECT
      e.profile_id,
      'daily_login_bonus',
      1,
      jsonb_build_object(
        'source', 'daily_login_bonus',
        'awarded_at', v_now,
        'cycle_start', date_trunc('day', v_now),
        'last_sign_in_at', e.last_sign_in_at
      )
    FROM eligible_profiles AS e
    RETURNING profile_id
  )
  SELECT COUNT(*) INTO v_awarded FROM inserted_transactions;

  RETURN v_awarded;
END;
$$;

COMMENT ON FUNCTION public.process_daily_login_attribute_bonus() IS
  'Grants an attribute point to active players who logged in within the last 24 hours.';

GRANT EXECUTE ON FUNCTION public.process_daily_login_attribute_bonus() TO service_role;

DO $$
DECLARE
  v_job_id integer;
BEGIN
  SELECT jobid INTO v_job_id
  FROM cron.job
  WHERE jobname = 'daily_login_attribute_bonus';

  IF v_job_id IS NOT NULL THEN
    PERFORM cron.unschedule(v_job_id);
  END IF;

  PERFORM cron.schedule(
    'daily_login_attribute_bonus',
    '0 4 * * *',
    $$SELECT public.process_daily_login_attribute_bonus();$$
  );
END;
$$;
