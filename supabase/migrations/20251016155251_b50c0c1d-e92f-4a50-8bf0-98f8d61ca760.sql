-- Set up a cron job to run university attendance daily at 10 AM
-- This ensures auto-attendance works for enrolled students

-- First, enable pg_cron extension if not already enabled
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Schedule the university attendance function to run daily at 10:00 AM UTC
-- Note: Adjust the cron schedule based on your timezone needs
SELECT cron.schedule(
  'daily-university-attendance',
  '0 10 * * *',
  $$
  SELECT
    net.http_post(
      url:='https://yztogmdixmchsmimtent.supabase.co/functions/v1/university-attendance',
      headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl6dG9nbWRpeG1jaHNtaW10ZW50Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc5ODU0ODcsImV4cCI6MjA3MzU2MTQ4N30.vqfz_ZIvCIEXAuoSYmydg-XA6oUiPbcCc6yjfb2zL0g"}'::jsonb,
      body:='{}'::jsonb
    ) as request_id;
  $$
);