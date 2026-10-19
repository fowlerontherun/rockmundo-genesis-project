-- #4221: Move gig auto-start to PostgreSQL internal pg_cron.
-- Never store HTTP JWT/API keys in cron, or expose a service-role Edge path.
-- The existing auto_start_scheduled_gigs RPC already denies browser callers.
-- One transaction-scoped advisory lock serializes overlapping minute ticks.
CREATE OR REPLACE FUNCTION public.run_auto_start_gigs_scheduled()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $run$
DECLARE
  v_job_id uuid;
  v_started_at timestamptz:=clock_timestamp();
  v_receipt jsonb;
BEGIN
  IF NOT pg_catalog.pg_try_advisory_xact_lock(4221,44) THEN
    RETURN jsonb_build_object('skipped',true,'reason','previous_gig_start_still_running');
  END IF;

  INSERT INTO public.cron_job_runs(job_name,status,triggered_by)
  VALUES ('auto-start-gigs','running','pg_cron')
  RETURNING id INTO v_job_id;

  -- The existing authoritative gig implementation checks scheduled time,
  -- travel, band attendance, and performs the actual start transition.
  v_receipt:=public.auto_start_scheduled_gigs();
  UPDATE public.cron_job_runs
  SET status='success',completed_at=now(),
      duration_ms=greatest(0,extract(epoch from (clock_timestamp()-v_started_at))*1000)::integer,
      processed_count=greatest(0,coalesce((v_receipt->>'totalChecked')::integer,0)),
      error_count=greatest(0,coalesce((v_receipt->>'deferred')::integer,0)),
      result_summary=v_receipt
  WHERE id=v_job_id;

  RETURN coalesce(v_receipt,'{}'::jsonb) || jsonb_build_object('skipped',false);
END
$run$;

REVOKE ALL ON FUNCTION public.run_auto_start_gigs_scheduled() FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.auto_start_scheduled_gigs() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.run_auto_start_gigs_scheduled() TO service_role;
GRANT EXECUTE ON FUNCTION public.auto_start_scheduled_gigs() TO service_role;

DO $schedule$
DECLARE v_old bigint; v_new bigint;
BEGIN
  SELECT jobid INTO STRICT v_old FROM cron.job
    WHERE jobname='auto-start-gigs' AND active;
  v_new:=cron.schedule('auto-start-gigs','* * * * *',
    $cmd$SELECT public.run_auto_start_gigs_scheduled();$cmd$);
  IF v_new IS DISTINCT FROM v_old THEN
    RAISE EXCEPTION 'gig_start_cron_identity_changed_%_%',v_old,v_new;
  END IF;
END
$schedule$;

-- Obsolete HTTP manual runner may not perform any privileged operations.
UPDATE public.cron_job_config SET allow_manual_trigger=false,
  edge_function_name='internal-sql:auto-start-gigs',
  updated_at=now()
WHERE job_name='auto-start-gigs';
