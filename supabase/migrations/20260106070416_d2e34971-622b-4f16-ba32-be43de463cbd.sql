-- Enable pg_cron and pg_net extensions if not already enabled
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Grant permission to use pg_net
GRANT USAGE ON SCHEMA net TO postgres;

-- Unschedule existing jobs to avoid duplicates (if they exist)
SELECT cron.unschedule('auto-distribute-streaming') WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'auto-distribute-streaming');
SELECT cron.unschedule('update-daily-streams') WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'update-daily-streams');
SELECT cron.unschedule('update-music-charts') WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'update-music-charts');
SELECT cron.unschedule('generate-daily-sales') WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'generate-daily-sales');

-- Schedule auto-distribute-streaming to run every 15 minutes
SELECT cron.schedule(
  'auto-distribute-streaming',
  '*/15 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://yztogmdixmchsmimtent.supabase.co/functions/v1/auto-distribute-streaming',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl6dG9nbWRpeG1jaHNtaW10ZW50Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc5ODU0ODcsImV4cCI6MjA3MzU2MTQ4N30.vqfz_ZIvCIEXAuoSYmydg-XA6oUiPbcCc6yjfb2zL0g"}'::jsonb,
    body := concat('{"time": "', now(), '", "triggeredBy": "cron"}')::jsonb
  ) AS request_id;
  $$
);

-- Schedule update-daily-streams to run every hour
SELECT cron.schedule(
  'update-daily-streams',
  '0 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://yztogmdixmchsmimtent.supabase.co/functions/v1/update-daily-streams',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl6dG9nbWRpeG1jaHNtaW10ZW50Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc5ODU0ODcsImV4cCI6MjA3MzU2MTQ4N30.vqfz_ZIvCIEXAuoSYmydg-XA6oUiPbcCc6yjfb2zL0g"}'::jsonb,
    body := concat('{"time": "', now(), '", "triggeredBy": "cron"}')::jsonb
  ) AS request_id;
  $$
);

-- Schedule update-music-charts to run daily at 00:30 UTC (after streams update)
SELECT cron.schedule(
  'update-music-charts',
  '30 0 * * *',
  $$
  SELECT net.http_post(
    url := 'https://yztogmdixmchsmimtent.supabase.co/functions/v1/update-music-charts',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl6dG9nbWRpeG1jaHNtaW10ZW50Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc5ODU0ODcsImV4cCI6MjA3MzU2MTQ4N30.vqfz_ZIvCIEXAuoSYmydg-XA6oUiPbcCc6yjfb2zL0g"}'::jsonb,
    body := concat('{"time": "', now(), '", "triggeredBy": "cron"}')::jsonb
  ) AS request_id;
  $$
);

-- Schedule generate-daily-sales to run daily at 01:00 UTC
SELECT cron.schedule(
  'generate-daily-sales',
  '0 1 * * *',
  $$
  SELECT net.http_post(
    url := 'https://yztogmdixmchsmimtent.supabase.co/functions/v1/generate-daily-sales',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl6dG9nbWRpeG1jaHNtaW10ZW50Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc5ODU0ODcsImV4cCI6MjA3MzU2MTQ4N30.vqfz_ZIvCIEXAuoSYmydg-XA6oUiPbcCc6yjfb2zL0g"}'::jsonb,
    body := concat('{"time": "', now(), '", "triggeredBy": "cron"}')::jsonb
  ) AS request_id;
  $$
);