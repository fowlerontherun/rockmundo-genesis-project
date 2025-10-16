-- Add cron job for recording session auto-completion
SELECT cron.unschedule('complete-recording-sessions') WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'complete-recording-sessions');

SELECT cron.schedule(
  'complete-recording-sessions',
  '*/30 * * * *',
  $$
  SELECT net.http_post(
    url:='https://yztogmdixmchsmimtent.supabase.co/functions/v1/complete-recording-sessions',
    headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl6dG9nbWRpeG1jaHNtaW10ZW50Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc5ODU0ODcsImV4cCI6MjA3MzU2MTQ4N30.vqfz_ZIvCIEXAuoSYmydg-XA6oUiPbcCc6yjfb2zL0g"}'::jsonb,
    body:='{}'::jsonb
  ) as request_id;
  $$
);