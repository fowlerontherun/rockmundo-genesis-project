
-- Schedule lottery draw every Monday at 00:05 UTC
SELECT cron.schedule(
  'weekly-lottery-draw',
  '5 0 * * 1',
  $$
  SELECT
    net.http_post(
      url := 'https://yztogmdixmchsmimtent.supabase.co/functions/v1/lottery-draw',
      headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl6dG9nbWRpeG1jaHNtaW10ZW50Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc5ODU0ODcsImV4cCI6MjA3MzU2MTQ4N30.vqfz_ZIvCIEXAuoSYmydg-XA6oUiPbcCc6yjfb2zL0g"}'::jsonb,
      body := concat('{"time": "', now(), '"}')::jsonb
    ) AS request_id;
  $$
);
