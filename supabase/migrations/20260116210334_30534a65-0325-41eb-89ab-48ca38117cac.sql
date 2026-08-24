-- Unschedule existing jobs with wrong keys. A clean database may not contain
-- every historical job name, and pg_cron raises when unscheduling a missing
-- named job, so guard each removal against cron.job.
DO $$
DECLARE
  v_job_name text;
BEGIN
  FOREACH v_job_name IN ARRAY ARRAY[
    'auto-start-gigs',
    'auto-complete-gigs',
    'complete-travel',
    'complete-release-manufacturing',
    'complete-video-production',
    'process-prison-events-cron',
    'release-prisoners-cron',
    'generate-radio-invitations-cron',
    'process-radio-submissions-cron',
    'simulate-radio-plays-cron',
    'simulate-video-views-cron'
  ]
  LOOP
    IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = v_job_name) THEN
      PERFORM cron.unschedule(v_job_name);
    END IF;
  END LOOP;
END
$$;