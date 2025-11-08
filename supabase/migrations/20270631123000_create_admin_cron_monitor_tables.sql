-- Create tables to monitor admin cron jobs and their recent executions
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS public.admin_cron_jobs (
  job_name text PRIMARY KEY,
  display_name text NOT NULL,
  description text,
  schedule text,
  cron_expression text,
  edge_function_name text,
  category text,
  expected_frequency_minutes integer,
  allow_manual_trigger boolean DEFAULT true,
  is_active boolean DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.admin_cron_job_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_name text NOT NULL REFERENCES public.admin_cron_jobs(job_name) ON DELETE CASCADE,
  function_name text,
  triggered_by text DEFAULT 'cron',
  request_id text,
  status text NOT NULL DEFAULT 'running' CHECK (status IN ('running', 'success', 'error')),
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  duration_ms integer,
  processed_count integer,
  error_count integer,
  items_affected integer,
  error_message text,
  request_payload jsonb,
  result_summary jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS admin_cron_job_runs_job_name_started_at_idx
  ON public.admin_cron_job_runs (job_name, started_at DESC);
CREATE INDEX IF NOT EXISTS admin_cron_job_runs_status_idx
  ON public.admin_cron_job_runs (status);

ALTER TABLE public.admin_cron_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_cron_job_runs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role manages admin cron jobs" ON public.admin_cron_jobs;
CREATE POLICY "Service role manages admin cron jobs" ON public.admin_cron_jobs
  FOR ALL
  USING (auth.role() IN ('service_role', 'supabase_admin'))
  WITH CHECK (auth.role() IN ('service_role', 'supabase_admin'));

DROP POLICY IF EXISTS "Admins can view cron jobs" ON public.admin_cron_jobs;
CREATE POLICY "Admins can view cron jobs" ON public.admin_cron_jobs
  FOR SELECT
  USING (
    auth.role() IN ('service_role', 'supabase_admin')
    OR public.has_role(auth.uid(), 'admin')
  );

DROP POLICY IF EXISTS "Service role manages cron job runs" ON public.admin_cron_job_runs;
CREATE POLICY "Service role manages cron job runs" ON public.admin_cron_job_runs
  FOR ALL
  USING (auth.role() IN ('service_role', 'supabase_admin'))
  WITH CHECK (auth.role() IN ('service_role', 'supabase_admin'));

DROP POLICY IF EXISTS "Admins can view cron job runs" ON public.admin_cron_job_runs;
CREATE POLICY "Admins can view cron job runs" ON public.admin_cron_job_runs
  FOR SELECT
  USING (
    auth.role() IN ('service_role', 'supabase_admin')
    OR public.has_role(auth.uid(), 'admin')
  );

CREATE OR REPLACE VIEW public.admin_cron_job_summary AS
SELECT
  jobs.job_name,
  jobs.display_name,
  jobs.description,
  jobs.schedule,
  jobs.cron_expression,
  jobs.edge_function_name,
  jobs.category,
  jobs.expected_frequency_minutes,
  jobs.allow_manual_trigger,
  jobs.is_active,
  jobs.created_at,
  jobs.updated_at,
  stats.total_runs,
  stats.success_runs,
  stats.failure_runs,
  stats.last_run_started_at,
  stats.last_run_finished_at,
  stats.last_run_status,
  stats.last_run_processed_count,
  stats.last_run_error_count,
  stats.last_run_error_message,
  stats.last_run_result_summary,
  stats.last_success_started_at,
  stats.last_success_finished_at,
  stats.last_error_started_at,
  stats.last_manual_trigger_at,
  stats.avg_duration_ms
FROM public.admin_cron_jobs AS jobs
LEFT JOIN LATERAL (
  SELECT
    COUNT(*) AS total_runs,
    COUNT(*) FILTER (WHERE status = 'success') AS success_runs,
    COUNT(*) FILTER (WHERE status = 'error') AS failure_runs,
    MAX(started_at) AS last_run_started_at,
    MAX(finished_at) FILTER (WHERE finished_at IS NOT NULL) AS last_run_finished_at,
    (SELECT status
       FROM public.admin_cron_job_runs r2
      WHERE r2.job_name = jobs.job_name
      ORDER BY r2.started_at DESC
      LIMIT 1) AS last_run_status,
    (SELECT processed_count
       FROM public.admin_cron_job_runs r2
      WHERE r2.job_name = jobs.job_name
      ORDER BY r2.started_at DESC
      LIMIT 1) AS last_run_processed_count,
    (SELECT error_count
       FROM public.admin_cron_job_runs r2
      WHERE r2.job_name = jobs.job_name
      ORDER BY r2.started_at DESC
      LIMIT 1) AS last_run_error_count,
    (SELECT error_message
       FROM public.admin_cron_job_runs r2
      WHERE r2.job_name = jobs.job_name
      ORDER BY r2.started_at DESC
      LIMIT 1) AS last_run_error_message,
    (SELECT result_summary
       FROM public.admin_cron_job_runs r2
      WHERE r2.job_name = jobs.job_name
      ORDER BY r2.started_at DESC
      LIMIT 1) AS last_run_result_summary,
    (SELECT started_at
       FROM public.admin_cron_job_runs r2
      WHERE r2.job_name = jobs.job_name
        AND r2.status = 'success'
      ORDER BY r2.started_at DESC
      LIMIT 1) AS last_success_started_at,
    (SELECT finished_at
       FROM public.admin_cron_job_runs r2
      WHERE r2.job_name = jobs.job_name
        AND r2.status = 'success'
      ORDER BY r2.started_at DESC
      LIMIT 1) AS last_success_finished_at,
    (SELECT started_at
       FROM public.admin_cron_job_runs r2
      WHERE r2.job_name = jobs.job_name
        AND r2.status = 'error'
      ORDER BY r2.started_at DESC
      LIMIT 1) AS last_error_started_at,
    MAX(started_at) FILTER (WHERE triggered_by IS NOT NULL AND triggered_by <> 'cron') AS last_manual_trigger_at,
    AVG(duration_ms) AS avg_duration_ms
  FROM public.admin_cron_job_runs r
  WHERE r.job_name = jobs.job_name
) AS stats ON TRUE;

INSERT INTO public.admin_cron_jobs (
  job_name,
  display_name,
  description,
  schedule,
  cron_expression,
  edge_function_name,
  category,
  expected_frequency_minutes,
  allow_manual_trigger,
  is_active
) VALUES
  ('auto-start-gigs', 'Auto-Start Gigs', 'Automatically starts gigs that are scheduled to begin.', 'Every minute', '*/1 * * * *', 'auto-start-gigs', 'gigs', 1, true, true),
  ('university-attendance', 'University Attendance', 'Processes daily university class attendance and awards XP.', 'Daily at 10:00 UTC', '0 10 * * *', 'university-attendance', 'education', 1440, true, true),
  ('book-reading-attendance', 'Book Reading Attendance', 'Updates reading progress and awards skill XP for books.', 'Daily at 23:00 UTC', '0 23 * * *', 'book-reading-attendance', 'education', 1440, true, true),
  ('shift-clock-out', 'Shift Clock Out', 'Automatically clocks out finished work shifts and awards rewards.', 'Every 15 minutes', '*/15 * * * *', 'shift-clock-out', 'employment', 15, true, true),
  ('cleanup-songwriting', 'Songwriting Cleanup', 'Auto-completes expired songwriting sessions and awards XP.', 'Every 15 minutes', '*/15 * * * *', 'cleanup-songwriting', 'songwriting', 15, true, true),
  ('complete-rehearsals', 'Complete Rehearsals', 'Finalizes rehearsals that have reached their end time.', 'Every 30 minutes', '*/30 * * * *', 'complete-rehearsals', 'band', 30, true, true),
  ('complete-recording-sessions', 'Complete Recording Sessions', 'Wraps up recording sessions that have finished.', 'Every 30 minutes', '*/30 * * * *', 'complete-recording-sessions', 'recording', 30, true, true),
  ('calculate-weekly-activity', 'Weekly Activity', 'Aggregates weekly XP earned for each profile.', 'Daily at 01:00 UTC', '0 1 * * *', 'calculate-weekly-activity', 'progression', 1440, true, true),
  ('generate-daily-sales', 'Generate Daily Sales', 'Simulates daily merchandise and release sales.', 'Daily at midnight', '0 0 * * *', 'generate-daily-sales', 'commerce', 1440, true, true),
  ('update-daily-streams', 'Update Daily Streams', 'Refreshes streaming metrics and related sales data.', 'Daily at midnight', '0 0 * * *', 'update-daily-streams', 'commerce', 1440, true, true)
ON CONFLICT (job_name) DO UPDATE SET
  display_name = EXCLUDED.display_name,
  description = EXCLUDED.description,
  schedule = EXCLUDED.schedule,
  cron_expression = EXCLUDED.cron_expression,
  edge_function_name = EXCLUDED.edge_function_name,
  category = EXCLUDED.category,
  expected_frequency_minutes = EXCLUDED.expected_frequency_minutes,
  allow_manual_trigger = EXCLUDED.allow_manual_trigger,
  is_active = EXCLUDED.is_active,
  updated_at = now();
