-- P0 #4215: schedule shift completion with an internal Vault-backed
-- x-cron-secret. Live Supabase receipt 20261019102338.
-- The prior cron command contained a static JWT; this replacement never
-- stores raw Vault secret values in cron.job.command.
-- Existing job ID, postgres ownership and 15-minute cadence are retained.
DO $cutover$
DECLARE
  v_jobid bigint;
  v_original_jobid bigint;
BEGIN
  SELECT jobid INTO STRICT v_original_jobid
  FROM cron.job WHERE jobname='auto-clock-out-shifts' AND active=true;
  IF (SELECT count(*) FROM vault.decrypted_secrets
      WHERE name='internal_cron_secret' AND length(decrypted_secret)>=32)<>1
  THEN RAISE EXCEPTION 'shift_cron_internal_secret_missing_or_ambiguous'; END IF;

  v_jobid := cron.schedule(
    'auto-clock-out-shifts',
    '*/15 * * * *',
    $job$SELECT net.http_post(
      url := 'https://yztogmdixmchsmimtent.supabase.co/functions/v1/shift-clock-out',
      headers := jsonb_build_object(
        'Content-Type','application/json',
        'x-cron-secret',(SELECT decrypted_secret FROM vault.decrypted_secrets
                         WHERE name='internal_cron_secret' LIMIT 1)
      ),
      body := jsonb_build_object('triggeredBy','pg_cron'),
      timeout_milliseconds := 120000
    );$job$
  );

  IF v_jobid IS DISTINCT FROM v_original_jobid THEN
    RAISE EXCEPTION 'shift_cron_job_id_changed: % -> %',
      v_original_jobid,v_jobid;
  END IF;
END
$cutover$;
