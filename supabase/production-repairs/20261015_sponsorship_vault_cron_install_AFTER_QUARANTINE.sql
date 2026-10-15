-- #4082 — MANUAL ONLY, controlled independent sponsorship resume.
-- This script does not quarantine old jobs and will ABORT until both known
-- JWT-bearing cron commands have been unscheduled in the approved outage.
-- No decryption values, keys or full cron.job.command should be selected or
-- exported during operator verification. Never run in an automatic db push.
BEGIN;
DO $install$
DECLARE
  v_job_id bigint;
BEGIN
  PERFORM pg_advisory_xact_lock(
    hashtextextended('rockmundo:quarantine:legacy-payment-cron',0)
  );
  IF to_regprocedure('public.process_sponsorship_installment_atomic(uuid)') IS NULL
     OR NOT has_function_privilege(
       'service_role','public.process_sponsorship_installment_atomic(uuid)','EXECUTE')
     OR has_function_privilege(
       'authenticated','public.process_sponsorship_installment_atomic(uuid)','EXECUTE')
     OR to_regprocedure('public.verify_internal_cron_secret(text)') IS NULL
     OR has_function_privilege(
       'authenticated','public.verify_internal_cron_secret(text)','EXECUTE')
  THEN RAISE EXCEPTION 'SPONSORSHIP_ATOMIC_RPC_OR_AUTH_NOT_READY' USING ERRCODE='55000';
  END IF;

  -- Vault is queried only inside trusted SQL; the value is never returned,
  -- logged, copied into a SQL literal, or persisted in the cron command.
  IF (SELECT count(*) FROM vault.decrypted_secrets
      WHERE name='internal_cron_secret'
        AND decrypted_secret IS NOT NULL AND length(decrypted_secret)>=32)<>1
  THEN RAISE EXCEPTION 'SPONSORSHIP_VAULT_SECRET_MISSING_OR_AMBIGUOUS'
    USING ERRCODE='55000'; END IF;
  IF EXISTS (SELECT 1 FROM cron.job
      WHERE jobname IN ('process-sponsorship-payments-cron','process-weekly-band-pay'))
  THEN RAISE EXCEPTION 'QUARANTINE_BOTH_LEGACY_PAYMENT_JOBS_FIRST'
    USING ERRCODE='55000'; END IF;
  IF to_regprocedure('cron.schedule(text,text,text)') IS NULL
  THEN RAISE EXCEPTION 'PG_CRON_UNAVAILABLE' USING ERRCODE='55000'; END IF;
  IF to_regprocedure('net.http_post(text,jsonb,jsonb,jsonb,integer)') IS NULL
     AND to_regprocedure('net.http_post(text,jsonb,jsonb)') IS NULL
  THEN RAISE EXCEPTION 'PG_NET_UNAVAILABLE' USING ERRCODE='55000'; END IF;

  -- Only install after the release runbook has confirmed the backend is
  -- already deployed and a verified dryRun returned zero player payments.
  -- At 00:00 UTC the next ordinary schedule may settle *new* due payments.
  SELECT cron.schedule(
    'process-sponsorship-payments-cron',
    '0 0 * * *',
    $job$
      SELECT net.http_post(
        url := 'https://yztogmdixmchsmimtent.supabase.co/functions/v1/process-sponsorship-payments',
        headers := jsonb_build_object(
          'Content-Type','application/json',
          'x-cron-secret',(
             SELECT decrypted_secret
             FROM vault.decrypted_secrets
             WHERE name='internal_cron_secret'
             LIMIT 1
          )
        ),
        body := '{"triggeredBy":"pg_cron"}'::jsonb
      );
    $job$
  ) INTO v_job_id;
  IF v_job_id IS NULL THEN
    RAISE EXCEPTION 'SPONSORSHIP_CRON_INSTALL_FAILED' USING ERRCODE='55000';
  END IF;
END;
$install$;
COMMIT;

-- Safe metadata-only post-install check (DO NOT select command):
-- SELECT jobname,active,schedule,
--   command ~ 'eyJ[A-Za-z0-9_-]{20,}[.]eyJ[A-Za-z0-9_-]{20,}' AS embeds_jwt,
--   command LIKE '%vault.decrypted_secrets%' AS reads_vault_runtime
-- FROM cron.job WHERE jobname='process-sponsorship-payments-cron';
--
-- Rollback: during operator response, unschedule ONLY the newly installed
-- sponsorship cron by name (no old JWT command resurrection).
