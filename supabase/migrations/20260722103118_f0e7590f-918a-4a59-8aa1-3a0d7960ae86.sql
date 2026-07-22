-- Schedule auto clock-in every 5 minutes so employed players with auto_clock_in=true
-- are placed on shift within the 30-minute window after their job's start_time.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'auto-clock-in-shifts') THEN
    PERFORM cron.unschedule('auto-clock-in-shifts');
  END IF;
END $$;

SELECT cron.schedule(
  'auto-clock-in-shifts',
  '*/5 * * * *',
  $cron$
  SELECT net.http_post(
    url:='https://yztogmdixmchsmimtent.supabase.co/functions/v1/shift-clock-in',
    headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl6dG9nbWRpeG1jaHNtaW10ZW50Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc5ODU0ODcsImV4cCI6MjA3MzU2MTQ4N30.vqfz_ZIvCIEXAuoSYmydg-XA6oUiPbcCc6yjfb2zL0g"}'::jsonb,
    body:='{"triggeredBy":"cron"}'::jsonb
  ) as request_id;
  $cron$
);
