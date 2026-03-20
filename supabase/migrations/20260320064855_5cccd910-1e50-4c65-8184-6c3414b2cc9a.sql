-- Clean up stuck "running" job records that are older than 5 minutes (they timed out)
UPDATE cron_job_runs 
SET status = 'error', 
    error_message = 'Edge function timed out (wall clock limit exceeded)',
    completed_at = created_at + interval '150 seconds'
WHERE status = 'running' 
AND created_at < now() - interval '5 minutes';

-- Create a function to auto-cleanup stuck running jobs (can be called periodically)
CREATE OR REPLACE FUNCTION public.cleanup_stuck_cron_runs()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  cleaned integer;
BEGIN
  UPDATE cron_job_runs 
  SET status = 'error', 
      error_message = 'Edge function timed out (auto-cleanup)',
      completed_at = COALESCE(completed_at, now())
  WHERE status = 'running' 
  AND created_at < now() - interval '5 minutes';
  
  GET DIAGNOSTICS cleaned = ROW_COUNT;
  RETURN cleaned;
END;
$$;