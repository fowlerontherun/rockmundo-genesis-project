-- #4082: safe paused-state sponsorship credential staging (manual operator only).
-- Never run as a normal migration or automatically from CI.
-- Does not activate cron, settle installments, deploy an RPC, or expose a secret.
-- Idempotent with the 16 October 2026 isolated staging configuration.
BEGIN;
DO $stage$
DECLARE
  v_job bigint;
BEGIN
  PERFORM pg_advisory_xact_lock(
    hashtextextended('rockmundo:4082:paused-sponsorship-stage', 0)
  );

  IF NOT EXISTS (
    SELECT 1 FROM vault.secrets WHERE name = 'internal_cron_secret'
  ) OR to_regprocedure('public.verify_internal_cron_secret(text)') IS NULL
    OR to_regprocedure('net.http_post(text,jsonb,jsonb,jsonb,integer)') IS NULL
  THEN RAISE EXCEPTION 'SPONSORSHIP_VAULT_OR_AUTH_PREREQUISITE_MISSING'
    USING ERRCODE='55000'; END IF;

  -- A known disabled existing schedule is the ONLY supported target.
  -- Never create another active scheduler or resurrect an embedded JWT.
  SELECT jobid INTO STRICT v_job FROM cron.job
    WHERE jobname = 'process-sponsorship-payments-cron'
      AND schedule = '0 0 * * *'
      AND active = false;
  IF v_job <> 52 THEN
    RAISE EXCEPTION 'SPONSORSHIP_JOB_ID_DRIFT' USING ERRCODE='55000';
  END IF;

  IF EXISTS (
    SELECT 1 FROM cron.job
    WHERE jobname IN (
      'process-sponsorship-payments-cron',
      'process-weekly-band-pay',
      'generate-sponsorship-offers-cron'
    )
    AND (active OR command ~* 'eyJ[A-Za-z0-9_-]{20,}|Bearer[[:space:]]+[A-Za-z0-9._-]+')
  ) THEN RAISE EXCEPTION 'PAYMENT_JOBS_NOT_QUARANTINED'
    USING ERRCODE='55000'; END IF;

  PERFORM cron.alter_job(
    job_id => v_job,
    command => $job$
      SELECT net.http_post(
        url := 'https://yztogmdixmchsmimtent.supabase.co/functions/v1/process-sponsorship-payments',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'x-cron-secret', (
            SELECT decrypted_secret FROM vault.decrypted_secrets
            WHERE name = 'internal_cron_secret' LIMIT 1
          )
        ),
        body := '{"dryRun":true}'::jsonb
      );
    $job$,
    active => false
  );

  IF NOT EXISTS (
    SELECT 1 FROM cron.job
    WHERE jobid = v_job AND active = false
      AND schedule = '0 0 * * *'
      AND command LIKE '%vault.decrypted_secrets%'
      AND command LIKE '%"dryRun":true%'
      AND command NOT ILIKE '%SUPABASE_SERVICE_ROLE_KEY%'
      AND command !~* 'eyJ[A-Za-z0-9_-]{20,}|Bearer[[:space:]]+[A-Za-z0-9._-]+'
  ) THEN RAISE EXCEPTION 'STAGED_SPONSORSHIP_COMMAND_VERIFICATION_FAILED'
    USING ERRCODE='55000'; END IF;
END;
$stage$;
COMMIT;

-- Safe read-back only (NEVER select cron.job.command):
-- select jobname,active,schedule,
--        command like '%vault.decrypted_secrets%' as runtime_vault,
--        command like '%"dryRun":true%' as dry_run_only
-- from cron.job where jobid=52;
