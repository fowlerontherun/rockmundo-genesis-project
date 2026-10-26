-- One release per invocation requires up to 204 invocations per UTC day.
-- Minute-based scheduling can clear the current catalogue within ~3.5 hours.
-- Preserve the existing Vault-backed command and timeout; change cadence only.
DO $$
DECLARE j bigint;
BEGIN
  SELECT jobid INTO j FROM cron.job
  WHERE jobname='update-daily-streams' AND active=true
    AND command ILIKE '%x-cron-secret%';
  IF j IS NULL THEN
    RAISE EXCEPTION 'Vault-backed update-daily-streams cron job not found';
  END IF;
  PERFORM cron.alter_job(job_id:=j,schedule:='* * * * *');
END;
$$;
