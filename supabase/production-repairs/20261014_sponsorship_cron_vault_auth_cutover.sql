-- #4082: existing sponsorship pg_cron job -> secret fetched at EXECUTION time.
-- Controlled production repair, NOT an ordinary migration: apply only after
-- the atomic sponsorship payment RPC and a recoverable snapshot are verified.
-- Never print cron.job.command before replacement: it contains a bearer token.
-- Deployment sequence: 1. verify prerequisites; 2. execute this repair;
-- 3. deploy authenticated Edge handler; 4. verify without processing payouts.
BEGIN;

DO $repair$
DECLARE
  v_job_id bigint;
BEGIN
  IF to_regprocedure('public.process_sponsorship_installment_atomic(uuid)') IS NULL THEN
    RAISE EXCEPTION 'Missing atomic sponsorship RPC; aborting cron cutover';
  END IF;
  IF to_regprocedure('public.verify_internal_cron_secret(text)') IS NULL THEN
    RAISE EXCEPTION 'Missing protected cron authentication verifier';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM vault.decrypted_secrets
    WHERE name = 'internal_cron_secret'
      AND decrypted_secret IS NOT NULL
      AND length(decrypted_secret) >= 32
  ) THEN
    RAISE EXCEPTION 'Missing or short internal_cron_secret in Vault';
  END IF;
  SELECT jobid INTO STRICT v_job_id FROM cron.job
  WHERE jobname = 'process-sponsorship-payments-cron';
  PERFORM cron.alter_job(
    job_id := v_job_id,
    command := $job$
      SELECT net.http_post(
        url := 'https://yztogmdixmchsmimtent.supabase.co/functions/v1/process-sponsorship-payments',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'x-cron-secret', (
            SELECT decrypted_secret FROM vault.decrypted_secrets
            WHERE name = 'internal_cron_secret' LIMIT 1
          )
        ),
        body := '{"triggeredBy":"pg_cron"}'::jsonb
      );
    $job$
  );
END;
$repair$;

COMMIT;

-- Verification query (execute separately without selecting the command itself):
-- SELECT jobname, active, schedule,
--        command ~* 'Bearer[[:space:]]+eyJ' AS embeds_bearer,
--        command LIKE '%vault.decrypted_secrets%' AS reads_vault
-- FROM cron.job WHERE jobname='process-sponsorship-payments-cron';
