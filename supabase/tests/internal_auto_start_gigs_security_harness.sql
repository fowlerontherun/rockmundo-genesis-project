-- #4221: live regression without triggering gig starts or altering players.
BEGIN;
DO $verify$
DECLARE
  v_job record;
  v_def text;
BEGIN
  SELECT jobid,jobname,schedule,active,username,command INTO STRICT v_job
  FROM cron.job WHERE jobname='auto-start-gigs';
  IF v_job.jobid<>44 OR v_job.schedule<>'* * * * *'
     OR NOT v_job.active OR v_job.username<>'postgres'
     OR v_job.command<>'SELECT public.run_auto_start_gigs_scheduled();'
  THEN RAISE EXCEPTION 'gig_start_internal_cron_contract_drift'; END IF;
  IF v_job.command ILIKE '%http_post%' OR v_job.command ILIKE '%Bearer%'
     OR v_job.command ILIKE '%eyJ%' OR v_job.command ILIKE '%service_role%'
  THEN RAISE EXCEPTION 'gig_start_cron_stored_credentials'; END IF;

  IF has_function_privilege('anon','public.auto_start_scheduled_gigs()','EXECUTE')
    OR has_function_privilege('authenticated','public.auto_start_scheduled_gigs()','EXECUTE')
    OR has_function_privilege('anon','public.run_auto_start_gigs_scheduled()','EXECUTE')
    OR has_function_privilege('authenticated','public.run_auto_start_gigs_scheduled()','EXECUTE')
    OR NOT has_function_privilege('service_role','public.run_auto_start_gigs_scheduled()','EXECUTE')
  THEN RAISE EXCEPTION 'gig_start_privileged_rpc_access_drift'; END IF;

  SELECT pg_get_functiondef('public.run_auto_start_gigs_scheduled()'::regprocedure)
  INTO v_def;
  IF v_def NOT ILIKE '%pg_try_advisory_xact_lock(4221,44)%'
     OR v_def NOT ILIKE '%public.auto_start_scheduled_gigs()%'
     OR v_def NOT ILIKE '%public.cron_job_runs%'
     OR v_def NOT ILIKE '%previous_gig_start_still_running%'
  THEN RAISE EXCEPTION 'gig_start_concurrency_or_job_log_guard_missing'; END IF;
  IF (SELECT count(*) FROM public.cron_job_config WHERE job_name='auto-start-gigs'
      AND allow_manual_trigger IS TRUE)<>0
  THEN RAISE EXCEPTION 'gig_start_manual_edge_trigger_still_enabled'; END IF;
END
$verify$;
ROLLBACK;
SELECT 'internal_auto_start_gigs_security_passed' result;
