-- #4082: controlled ONE-TIME remediation of cron.job embedded bearer tokens.
-- MANUAL REVIEW ONLY. NOT a migration and NEVER deployed by db push.
-- First confirm a restorable backup, staging results and approved outage:
-- sponsorship collection pauses until the Vault-backed scheduler and the
-- atomic installment RPC are independently verified; payroll is already 410.
-- DO NOT print or export cron.job.command: it contains live credentials.
-- This script NEVER invokes payout functions, sends HTTP, or reinstalls cron.
BEGIN;
DO $quarantine$
DECLARE
  v_job record;
  v_removed boolean;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended('rockmundo:quarantine:legacy-payment-cron',0));

  FOR v_job IN
    SELECT jobid,jobname,active,
      (command LIKE '%Bearer %' AND
       command ~ 'eyJ[A-Za-z0-9_-]{16,}') AS is_legacy_bearer
    FROM cron.job
    WHERE jobname IN ('process-weekly-band-pay','process-sponsorship-payments-cron')
    ORDER BY jobid FOR UPDATE
  LOOP
    -- If a job has already moved to a credentialless/Vault design, it must
    -- NOT be silently removed. Require individual DBA review in that case.
    IF NOT v_job.is_legacy_bearer THEN
      RAISE EXCEPTION 'Cron % is no longer the expected legacy JWT job; abort',
        v_job.jobname USING ERRCODE='55000';
    END IF;

    -- Unscheduling deletes the stored command (and its embedded credential).
    -- Disabling active=false alone leaves the secret in cron.job.command.
    SELECT cron.unschedule(v_job.jobid) INTO v_removed;
    IF NOT COALESCE(v_removed,false) THEN
      RAISE EXCEPTION 'Could not quarantine payment cron %', v_job.jobname
        USING ERRCODE='55000';
    END IF;
  END LOOP;

  IF EXISTS (
    SELECT 1 FROM cron.job
    WHERE jobname IN ('process-weekly-band-pay','process-sponsorship-payments-cron')
  ) THEN
    RAISE EXCEPTION 'Legacy payroll/sponsorship cron cleanup incomplete'
      USING ERRCODE='55000';
  END IF;
END;
$quarantine$;
COMMIT;

-- Separate verification (metadata only, NEVER command):
-- SELECT jobname,active FROM cron.job WHERE jobname IN
--   ('process-weekly-band-pay','process-sponsorship-payments-cron');
-- MUST be zero rows. Rotation/revocation of already exposed credentials
-- remains a separate required operator action with a verified blast radius.
