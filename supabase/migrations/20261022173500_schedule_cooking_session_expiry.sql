-- Release blocker: expire abandoned 120-second cooking sessions automatically.
-- Existing invoker RPC uses FOR UPDATE SKIP LOCKED and returns the number closed.
-- The cron worker runs as its trusted database role, not as a game client.
DO $schedule$
DECLARE v_existing record;
BEGIN
  IF NOT has_function_privilege('service_role',
       'public.expire_cooking_sessions(integer)','EXECUTE')
    OR has_function_privilege('authenticated',
       'public.expire_cooking_sessions(integer)','EXECUTE')
    OR has_function_privilege('anon',
       'public.expire_cooking_sessions(integer)','EXECUTE') THEN
    RAISE EXCEPTION 'COOKING_TIMEOUT_FUNCTION_PRIVILEGE_DRIFT';
  END IF;
  SELECT jobid,schedule,command,active INTO v_existing FROM cron.job
    WHERE jobname='rockmundo_cooking_session_timeout' LIMIT 1;
  IF FOUND THEN
    IF v_existing.schedule IS DISTINCT FROM '* * * * *'
       OR v_existing.command IS DISTINCT FROM
          'select public.expire_cooking_sessions(500);'
       OR v_existing.active IS DISTINCT FROM true THEN
      RAISE EXCEPTION 'COOKING_TIMEOUT_CRON_CONFIGURATION_DRIFT';
    END IF;
    RETURN;
  END IF;
  PERFORM cron.schedule(
    'rockmundo_cooking_session_timeout',
    '* * * * *',
    'select public.expire_cooking_sessions(500);'
  );
END $schedule$;
