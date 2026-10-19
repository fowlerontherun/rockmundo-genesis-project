-- #4255: read-only and rollback-only cron / access certification.
BEGIN;
DO $audit$
DECLARE x record; a jsonb; b jsonb;
BEGIN
 FOR x IN SELECT * FROM (VALUES
 (12,'generate-gig-offers-cron','0 */6 * * *','generate-gig-offers'),
 (49,'generate-pr-offers-cron','0 */6 * * *','generate-pr-offers'),
 (53,'generate-radio-invitations-cron','0 */6 * * *','generate-radio-invitations'),
 (47,'complete-release-manufacturing','*/2 * * * *','complete-release-manufacturing'),
 (64,'process-tour-travel-hourly','0 * * * *','process-tour-travel'),
 (45,'auto-complete-gigs','*/15 * * * *','auto-complete-gigs')
 ) AS jobs(jobid,cron_name,schedule,slug)
 LOOP
  IF NOT EXISTS(SELECT 1 FROM cron.job j WHERE j.jobid=x.jobid
      AND j.jobname=x.cron_name AND j.schedule=x.schedule
      AND j.active AND j.username='postgres'
      AND j.command ILIKE '%vault.decrypted_secrets%'
      AND j.command ILIKE '%x-cron-secret%'
      AND j.command NOT ILIKE '%eyJ%')
  THEN RAISE EXCEPTION 'cron_metadata_changed_%',x.cron_name; END IF;
  a:=public.claim_privileged_job_window(x.slug);
  b:=public.claim_privileged_job_window(x.slug);
  IF b->>'claimed' IS DISTINCT FROM 'false'
   OR a->>'job_name' IS DISTINCT FROM x.slug
   OR a->>'window_started_at' IS DISTINCT FROM b->>'window_started_at'
  THEN RAISE EXCEPTION 'duplicate_scheduler_window_%',x.slug; END IF;
 END LOOP;
 IF has_function_privilege('anon','public.claim_privileged_job_window(text)','execute')
  OR has_function_privilege('authenticated','public.claim_privileged_job_window(text)','execute')
  OR NOT has_function_privilege('service_role','public.claim_privileged_job_window(text)','execute')
  OR has_table_privilege('anon','public.privileged_job_window_claims','select')
  OR has_table_privilege('authenticated','public.privileged_job_window_claims','insert')
  OR (SELECT relrowsecurity FROM pg_class
      WHERE oid='public.privileged_job_window_claims'::regclass) IS DISTINCT FROM true
 THEN RAISE EXCEPTION 'scheduler_database_acl_drift'; END IF;
END $audit$;
ROLLBACK;
SELECT 'privileged_job_scheduler_harness_passed' result;
