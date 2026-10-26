-- Defense in depth: admin-only monitoring views should not be SELECTable
-- by anonymous Data API callers, even with security_invoker and base-table RLS.
-- Keep authenticated SELECT for admin UI; base RLS permits admin rows only.
REVOKE ALL ON TABLE public.admin_cron_job_summary FROM PUBLIC,anon;
REVOKE ALL ON TABLE public.admin_cron_job_runs FROM PUBLIC,anon;
DO $verify$
BEGIN
 IF has_table_privilege('anon','public.admin_cron_job_summary','SELECT')
 OR has_table_privilege('anon','public.admin_cron_job_runs','SELECT') THEN
  RAISE EXCEPTION 'Anonymous access remains on cron monitoring views';
 END IF;
 IF NOT has_table_privilege('authenticated','public.admin_cron_job_summary','SELECT')
 OR NOT has_table_privilege('authenticated','public.admin_cron_job_runs','SELECT') THEN
  RAISE EXCEPTION 'Admin UI authenticated SELECT unexpectedly revoked';
 END IF;
END $verify$;
