-- Ensure pg_cron is available for scheduling automatic event updates
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA extensions;

-- Function to activate or deactivate game events based on their schedule
CREATE OR REPLACE FUNCTION public.refresh_game_event_statuses()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  current_utc timestamptz := timezone('utc', now());
BEGIN
  UPDATE public.game_events ge
  SET is_active = true
  WHERE ge.is_active IS DISTINCT FROM true
    AND ge.start_date <= current_utc
    AND ge.end_date > current_utc;

  UPDATE public.game_events ge
  SET is_active = false
  WHERE ge.is_active IS DISTINCT FROM false
    AND (ge.end_date <= current_utc OR ge.start_date > current_utc);
END;
$$;

COMMENT ON FUNCTION public.refresh_game_event_statuses() IS 'Activates or deactivates game events when their scheduled window starts or ends.';

GRANT EXECUTE ON FUNCTION public.refresh_game_event_statuses() TO service_role;

-- Schedule the refresh to keep event state aligned with the calendar
DO $$
DECLARE
  existing_job_id integer;
BEGIN
  SELECT jobid INTO existing_job_id
  FROM cron.job
  WHERE jobname = 'game_events_status_refresh_job';

  IF existing_job_id IS NOT NULL THEN
    PERFORM cron.unschedule(existing_job_id);
  END IF;

  PERFORM cron.schedule(
    'game_events_status_refresh_job',
    '*/5 * * * *',
    $$SELECT public.refresh_game_event_statuses();$$
  );
END;
$$;

-- Run once so any existing events pick up the latest status immediately
SELECT public.refresh_game_event_statuses();
