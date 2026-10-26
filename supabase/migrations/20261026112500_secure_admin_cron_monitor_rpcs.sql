-- The old production SECURITY DEFINER admin cron RPCs were callable by anon
-- without checking admin status. Restrict execution and enforce authorization.
-- This is a security-only idempotent hotfix for the *existing* view row types.
CREATE OR REPLACE FUNCTION public.admin_get_cron_job_summary()
RETURNS SETOF public.admin_cron_job_summary
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO public,pg_temp AS $fn$
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role'
    AND (auth.uid() IS NULL OR NOT coalesce(public.has_role(auth.uid(),'admin'),false)) THEN
    RAISE EXCEPTION 'Not authorized' USING errcode='42501';
  END IF;
  RETURN QUERY SELECT * FROM public.admin_cron_job_summary ORDER BY display_name;
END $fn$;

CREATE OR REPLACE FUNCTION public.admin_get_cron_job_runs(_limit integer DEFAULT 50)
RETURNS SETOF public.admin_cron_job_runs
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO public,pg_temp AS $fn$
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role'
    AND (auth.uid() IS NULL OR NOT coalesce(public.has_role(auth.uid(),'admin'),false)) THEN
    RAISE EXCEPTION 'Not authorized' USING errcode='42501';
  END IF;
  RETURN QUERY SELECT * FROM public.admin_cron_job_runs
    ORDER BY started_at DESC LIMIT least(greatest(coalesce(_limit,50),1),200);
END $fn$;

REVOKE ALL ON FUNCTION public.admin_get_cron_job_summary() FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.admin_get_cron_job_runs(integer) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.admin_get_cron_job_summary() TO authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.admin_get_cron_job_runs(integer) TO authenticated,service_role;
