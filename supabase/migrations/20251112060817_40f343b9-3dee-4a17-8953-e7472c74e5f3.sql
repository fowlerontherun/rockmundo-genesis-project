-- Create table to track cron job executions
CREATE TABLE IF NOT EXISTS public.cron_job_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_name TEXT NOT NULL,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'running',
  duration_ms INTEGER,
  error_message TEXT,
  result_summary JSONB,
  processed_count INTEGER,
  error_count INTEGER,
  triggered_by TEXT DEFAULT 'cron',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create table to define cron jobs
CREATE TABLE IF NOT EXISTS public.cron_job_config (
  job_name TEXT PRIMARY KEY,
  edge_function_name TEXT NOT NULL,
  display_name TEXT NOT NULL,
  description TEXT,
  schedule TEXT NOT NULL,
  allow_manual_trigger BOOLEAN DEFAULT true,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_cron_job_runs_job_name ON public.cron_job_runs(job_name);
CREATE INDEX IF NOT EXISTS idx_cron_job_runs_started_at ON public.cron_job_runs(started_at DESC);
CREATE INDEX IF NOT EXISTS idx_cron_job_runs_status ON public.cron_job_runs(status);

-- November 8 created a *different* admin cron monitoring model: summary
-- is already a view with more columns and admin_cron_job_runs is a TABLE.
-- Preserve the earlier table and its data under a legacy name, then install
-- the canonical November 12 model without DROP ... CASCADE.
DROP FUNCTION IF EXISTS public.admin_get_cron_job_summary();
DROP FUNCTION IF EXISTS public.admin_get_cron_job_runs(integer);
DROP VIEW IF EXISTS public.admin_cron_job_summary;

DO $reconcile_cron_models$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE n.nspname='public' AND c.relname='admin_cron_job_runs'
      AND c.relkind IN ('r','p')
  ) THEN
    IF to_regclass('public.admin_cron_job_runs_legacy') IS NOT NULL THEN
      RAISE EXCEPTION 'Legacy cron table name occupied: manual reconciliation required';
    END IF;
    ALTER TABLE public.admin_cron_job_runs RENAME TO admin_cron_job_runs_legacy;
  END IF;
END $reconcile_cron_models$;

-- Create view for job summary with caller-side RLS enforcement.
CREATE OR REPLACE VIEW public.admin_cron_job_summary WITH (security_invoker=true) AS
SELECT 
  c.job_name,
  c.edge_function_name,
  c.display_name,
  c.description,
  c.schedule,
  c.allow_manual_trigger,
  MAX(r.completed_at) as last_run_at,
  MAX(r.started_at) as last_run_started_at,
  (SELECT status FROM cron_job_runs WHERE job_name = c.job_name ORDER BY started_at DESC LIMIT 1) as last_run_status,
  (SELECT duration_ms FROM cron_job_runs WHERE job_name = c.job_name ORDER BY started_at DESC LIMIT 1) as last_run_duration_ms,
  AVG(r.duration_ms)::INTEGER as avg_duration_ms,
  COUNT(r.id) as total_runs,
  COUNT(CASE WHEN r.status = 'success' THEN 1 END) as success_runs,
  COUNT(CASE WHEN r.status = 'error' THEN 1 END) as error_count,
  MAX(CASE WHEN r.triggered_by = 'admin_manual_trigger' THEN r.started_at END) as last_manual_trigger_at
FROM public.cron_job_config c
LEFT JOIN public.cron_job_runs r ON c.job_name = r.job_name
WHERE c.is_active = true
GROUP BY c.job_name, c.edge_function_name, c.display_name, c.description, c.schedule, c.allow_manual_trigger;

-- Create view for recent runs
CREATE OR REPLACE VIEW public.admin_cron_job_runs WITH (security_invoker=true) AS
SELECT 
  id,
  job_name,
  started_at,
  completed_at,
  status,
  duration_ms,
  error_message,
  result_summary,
  processed_count,
  error_count,
  triggered_by
FROM public.cron_job_runs
ORDER BY started_at DESC;

-- Admin RPCs must never expose privileged cron logs via default PUBLIC
-- EXECUTE on SECURITY DEFINER functions.
CREATE OR REPLACE FUNCTION public.admin_get_cron_job_summary()
RETURNS SETOF public.admin_cron_job_summary
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO public, pg_temp AS $fn$
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role'
    AND (auth.uid() IS NULL OR NOT coalesce(public.has_role(auth.uid(),'admin'),false)) THEN
    RAISE EXCEPTION 'Not authorized' USING errcode='42501';
  END IF;
  RETURN QUERY SELECT * FROM public.admin_cron_job_summary ORDER BY display_name;
END $fn$;

CREATE OR REPLACE FUNCTION public.admin_get_cron_job_runs(_limit INTEGER DEFAULT 50)
RETURNS SETOF public.admin_cron_job_runs
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO public, pg_temp AS $fn$
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

-- Enable RLS
ALTER TABLE public.cron_job_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cron_job_config ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Admins can view cron job runs"
  ON public.cron_job_runs FOR SELECT
  TO authenticated
  USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Service role can manage cron job runs"
  ON public.cron_job_runs FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Admins can view cron job config"
  ON public.cron_job_config FOR SELECT
  TO authenticated
  USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can manage cron job config"
  ON public.cron_job_config FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'admin'))
  WITH CHECK (has_role(auth.uid(), 'admin'));

-- Insert initial cron job configurations
INSERT INTO public.cron_job_config (job_name, edge_function_name, display_name, description, schedule, allow_manual_trigger) VALUES
  ('process_scheduled_activities', 'process-scheduled-activities', 'Process Scheduled Activities', 'Starts and completes scheduled activities based on game time', '*/5 * * * *', true),
  ('auto_start_gigs', 'auto-start-gigs', 'Auto Start Gigs', 'Automatically starts gigs at their scheduled time', '*/5 * * * *', true),
  ('auto_complete_gigs', 'auto-complete-gigs', 'Auto Complete Gigs', 'Completes gigs that have finished', '*/5 * * * *', true),
  ('complete_rehearsals', 'complete-rehearsals', 'Complete Rehearsals', 'Completes band rehearsals that have finished', '*/10 * * * *', true),
  ('complete_recording_sessions', 'complete-recording-sessions', 'Complete Recording Sessions', 'Completes recording sessions that have finished', '*/10 * * * *', true),
  ('university_attendance', 'university-attendance', 'University Attendance', 'Processes university class attendance', '0 * * * *', true),
  ('book_reading_attendance', 'book-reading-attendance', 'Book Reading Attendance', 'Processes book reading sessions', '0 * * * *', true),
  ('shift_clock_out', 'shift-clock-out', 'Auto Clock Out Work Shifts', 'Automatically clocks out completed work shifts', '*/15 * * * *', true),
  ('generate_daily_sales', 'generate-daily-sales', 'Generate Daily Sales', 'Generates daily sales for releases', '0 0 * * *', true),
  ('update_daily_streams', 'update-daily-streams', 'Update Daily Streams', 'Updates streaming platform statistics', '0 1 * * *', true),
  ('generate_gig_offers', 'generate-gig-offers', 'Generate Gig Offers', 'Generates new gig offers for bands', '0 2 * * *', true),
  ('cleanup_songwriting', 'cleanup-songwriting', 'Cleanup Songwriting', 'Cleans up abandoned songwriting sessions', '0 3 * * *', true),
  ('calculate_weekly_activity', 'calculate-weekly-activity', 'Calculate Weekly Activity', 'Calculates weekly player activity metrics', '0 4 * * 0', true),
  ('complete_release_manufacturing', 'complete-release-manufacturing', 'Complete Release Manufacturing', 'Completes physical release manufacturing', '0 */6 * * *', true)
ON CONFLICT (job_name) DO UPDATE SET
  edge_function_name = EXCLUDED.edge_function_name,
  display_name = EXCLUDED.display_name,
  description = EXCLUDED.description,
  schedule = EXCLUDED.schedule,
  allow_manual_trigger = EXCLUDED.allow_manual_trigger,
  updated_at = NOW();