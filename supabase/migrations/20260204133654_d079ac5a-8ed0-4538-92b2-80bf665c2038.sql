-- Schedule daily activity XP processing at 05:00 UTC
-- This function aggregates yesterday's activities and credits SXP + AP to player wallets

SELECT cron.schedule(
  'process-daily-activity-xp',
  '0 5 * * *',  -- Run daily at 05:00 UTC
  $$
  SELECT net.http_post(
    url:='https://yztogmdixmchsmimtent.supabase.co/functions/v1/process-daily-activity-xp',
    headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl6dG9nbWRpeG1jaHNtaW10ZW50Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc5ODU0ODcsImV4cCI6MjA3MzU2MTQ4N30.vqfz_ZIvCIEXAuoSYmydg-XA6oUiPbcCc6yjfb2zL0g"}'::jsonb,
    body:='{"triggeredBy": "cron"}'::jsonb
  ) as request_id;
  $$
);