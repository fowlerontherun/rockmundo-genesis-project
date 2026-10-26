-- Bounded one-video settlements; capable of completing 144 videos per UTC day.
-- Authentication remains Vault-backed; do not modify the HTTP command.
DO $$
DECLARE j bigint;
BEGIN
 SELECT jobid INTO j FROM cron.job
 WHERE jobname='simulate-video-views-cron' AND active=true
   AND command ILIKE '%x-cron-secret%';
 IF j IS NULL THEN RAISE EXCEPTION 'Vault-backed music video scheduler not found'; END IF;
 PERFORM cron.alter_job(job_id:=j,schedule:='*/10 * * * *');
END;
$$;
