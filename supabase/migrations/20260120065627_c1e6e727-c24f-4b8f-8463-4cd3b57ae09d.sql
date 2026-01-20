-- Set up cron job for complete-self-promotions (every 10 minutes)
SELECT cron.schedule(
  'complete-self-promotions-every-10-min',
  '*/10 * * * *',
  $$
  SELECT net.http_post(
    url:='https://yztogmdixmchsmimtent.supabase.co/functions/v1/complete-self-promotions',
    headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl6dG9nbWRpeG1jaHNtaW10ZW50Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc5ODU0ODcsImV4cCI6MjA3MzU2MTQ4N30.vqfz_ZIvCIEXAuoSYmydg-XA6oUiPbcCc6yjfb2zL0g"}'::jsonb,
    body:='{"triggered_by": "cron"}'::jsonb
  ) AS request_id;
  $$
);

-- Set up cron job for simulate-merch-sales (daily at 6 AM UTC)
SELECT cron.schedule(
  'simulate-merch-sales-daily',
  '0 6 * * *',
  $$
  SELECT net.http_post(
    url:='https://yztogmdixmchsmimtent.supabase.co/functions/v1/simulate-merch-sales',
    headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl6dG9nbWRpeG1jaHNtaW10ZW50Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc5ODU0ODcsImV4cCI6MjA3MzU2MTQ4N30.vqfz_ZIvCIEXAuoSYmydg-XA6oUiPbcCc6yjfb2zL0g"}'::jsonb,
    body:='{"triggered_by": "cron"}'::jsonb
  ) AS request_id;
  $$
);

-- Set up cron job for trigger-random-events (every 2 hours)
SELECT cron.schedule(
  'trigger-random-events-every-2-hours',
  '0 */2 * * *',
  $$
  SELECT net.http_post(
    url:='https://yztogmdixmchsmimtent.supabase.co/functions/v1/trigger-random-events',
    headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl6dG9nbWRpeG1jaHNtaW10ZW50Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc5ODU0ODcsImV4cCI6MjA3MzU2MTQ4N30.vqfz_ZIvCIEXAuoSYmydg-XA6oUiPbcCc6yjfb2zL0g"}'::jsonb,
    body:='{"triggered_by": "cron"}'::jsonb
  ) AS request_id;
  $$
);