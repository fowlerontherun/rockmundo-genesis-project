-- Remove legacy bearer JWTs from existing cron jobs. Keep the job's original
-- schedule, body, endpoint and Vault header. No token values are stored here.
DO $migration$
DECLARE
  job_rec record;
  scrubbed text;
BEGIN
  FOR job_rec IN
    SELECT jobid, jobname, command
    FROM cron.job
    WHERE command ~* 'eyJ[A-Za-z0-9_-]{25,}'
      AND command ILIKE '%x-cron-secret%'
  LOOP
    scrubbed := regexp_replace(
      regexp_replace(
        regexp_replace(job_rec.command,
          ',[[:space:]]*"Authorization"[[:space:]]*:[[:space:]]*"Bearer[[:space:]]+eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+"', '', 'g'),
        '"Authorization"[[:space:]]*:[[:space:]]*"Bearer[[:space:]]+eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+"[[:space:]]*,[[:space:]]*', '', 'g'),
      ',[[:space:]]*''Authorization''[[:space:]]*,[[:space:]]*''Bearer[[:space:]]+eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+''', '', 'g');
    IF scrubbed = job_rec.command OR scrubbed ~* 'eyJ[A-Za-z0-9_-]{25,}' THEN
      RAISE EXCEPTION 'Unexpected auth header in cron job: %', job_rec.jobname;
    END IF;
    PERFORM cron.alter_job(job_id := job_rec.jobid, command := scrubbed);
  END LOOP;
END;
$migration$;

-- The following four jobs historically used credentials the deployed workers
-- could not verify, or directly exposed a legacy anon key. Use the Vault cron
-- secret exclusively, and preserve existing schedule/active state.
DO $migration$
DECLARE
  j bigint;
BEGIN
  SELECT jobid INTO j FROM cron.job WHERE jobname='update-daily-streams';
  IF j IS NOT NULL THEN
    PERFORM cron.alter_job(
      job_id := j,
      command := $command$
        SELECT net.http_post(
          url := 'https://yztogmdixmchsmimtent.supabase.co/functions/v1/update-daily-streams',
          headers := jsonb_build_object(
            'Content-Type', 'application/json',
            'x-cron-secret', (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name='internal_cron_secret' LIMIT 1)),
          body := jsonb_build_object('time', now(), 'triggeredBy', 'cron'),
          timeout_milliseconds := 120000
        ) AS request_id;
      $command$
    );
  END IF;
  SELECT jobid INTO j FROM cron.job WHERE jobname='process-demo-reviews';
  IF j IS NOT NULL THEN
    PERFORM cron.alter_job(
      job_id := j,
      command := $command$
        SELECT net.http_post(
          url := 'https://yztogmdixmchsmimtent.supabase.co/functions/v1/process-demo-review',
          headers := jsonb_build_object(
            'Content-Type', 'application/json',
            'x-cron-secret', (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name='internal_cron_secret' LIMIT 1)),
          body := '{}'::jsonb
        ) AS request_id;
      $command$
    );
  END IF;
  SELECT jobid INTO j FROM cron.job WHERE jobname='acting-daily-tick';
  IF j IS NOT NULL THEN
    PERFORM cron.alter_job(
      job_id := j,
      command := $command$
        SELECT net.http_post(
          url := 'https://yztogmdixmchsmimtent.supabase.co/functions/v1/acting-daily-tick',
          headers := jsonb_build_object(
            'Content-Type', 'application/json',
            'x-cron-secret', (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name='internal_cron_secret' LIMIT 1)),
          body := '{}'::jsonb
        ) AS request_id;
      $command$
    );
  END IF;
  SELECT jobid INTO j FROM cron.job WHERE jobname='auto-major-events';
  IF j IS NOT NULL THEN
    PERFORM cron.alter_job(
      job_id := j,
      command := $command$
        SELECT net.http_post(
          url := 'https://yztogmdixmchsmimtent.supabase.co/functions/v1/auto-major-events',
          headers := jsonb_build_object(
            'Content-Type', 'application/json',
            'x-cron-secret', (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name='internal_cron_secret' LIMIT 1)),
          body := '{}'::jsonb
        ) AS request_id;
      $command$
    );
  END IF;
END;
$migration$;
