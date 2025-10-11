-- Enable pg_cron extension for scheduling
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Enable pg_net extension for HTTP calls
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Add auto_read column to player_book_reading_sessions
ALTER TABLE player_book_reading_sessions
ADD COLUMN IF NOT EXISTS auto_read boolean DEFAULT false;

-- Schedule university attendance to run daily at 11 PM UTC
SELECT cron.schedule(
  'daily-university-attendance',
  '0 23 * * *',
  $$
  SELECT net.http_post(
    url:='https://yztogmdixmchsmimtent.supabase.co/functions/v1/university-attendance',
    headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl6dG9nbWRpeG1jaHNtaW10ZW50Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc5ODU0ODcsImV4cCI6MjA3MzU2MTQ4N30.vqfz_ZIvCIEXAuoSYmydg-XA6oUiPbcCc6yjfb2zL0g"}'::jsonb,
    body:=concat('{"time": "', now(), '"}')::jsonb
  ) as request_id;
  $$
);

-- Schedule book reading attendance to run daily at 11 PM UTC
SELECT cron.schedule(
  'daily-book-reading-attendance',
  '0 23 * * *',
  $$
  SELECT net.http_post(
    url:='https://yztogmdixmchsmimtent.supabase.co/functions/v1/book-reading-attendance',
    headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl6dG9nbWRpeG1jaHNtaW10ZW50Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc5ODU0ODcsImV4cCI6MjA3MzU2MTQ4N30.vqfz_ZIvCIEXAuoSYmydg-XA6oUiPbcCc6yjfb2zL0g"}'::jsonb,
    body:=concat('{"time": "', now(), '"}')::jsonb
  ) as request_id;
  $$
);