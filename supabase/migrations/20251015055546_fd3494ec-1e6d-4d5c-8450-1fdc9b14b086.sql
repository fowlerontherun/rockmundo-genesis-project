-- Create cron job to run university attendance daily at 10 AM
-- This automatically processes auto-attend for all active enrollments

SELECT cron.schedule(
  'daily-university-attendance',
  '0 10 * * *', -- Every day at 10:00 AM
  $$
  SELECT
    net.http_post(
      url := 'https://yztogmdixmchsmimtent.supabase.co/functions/v1/university-attendance',
      headers := '{"Content-Type": "application/json", "Authorization": "Bearer ' || current_setting('app.settings.service_role_key') || '"}'::jsonb,
      body := '{}'::jsonb
    ) as request_id;
  $$
);