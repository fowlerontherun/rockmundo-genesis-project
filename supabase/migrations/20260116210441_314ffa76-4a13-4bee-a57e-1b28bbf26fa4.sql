-- Recreate all cron jobs with correct anon key

-- 1. Auto-start gigs (every 10 minutes)
SELECT cron.schedule('auto-start-gigs', '*/10 * * * *', $$
  SELECT net.http_post(
    url:='https://yztogmdixmchsmimtent.supabase.co/functions/v1/auto-start-gigs',
    headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl6dG9nbWRpeG1jaHNtaW10ZW50Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc5ODU0ODcsImV4cCI6MjA3MzU2MTQ4N30.vqfz_ZIvCIEXAuoSYmydg-XA6oUiPbcCc6yjfb2zL0g"}'::jsonb,
    body:='{}'::jsonb
  ) as request_id;
$$);

-- 2. Auto-complete gigs (every 15 minutes)
SELECT cron.schedule('auto-complete-gigs', '*/15 * * * *', $$
  SELECT net.http_post(
    url:='https://yztogmdixmchsmimtent.supabase.co/functions/v1/auto-complete-gigs',
    headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl6dG9nbWRpeG1jaHNtaW10ZW50Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc5ODU0ODcsImV4cCI6MjA3MzU2MTQ4N30.vqfz_ZIvCIEXAuoSYmydg-XA6oUiPbcCc6yjfb2zL0g"}'::jsonb,
    body:='{}'::jsonb
  ) as request_id;
$$);

-- 3. Complete travel (every 5 minutes)
SELECT cron.schedule('complete-travel', '*/5 * * * *', $$
  SELECT net.http_post(
    url:='https://yztogmdixmchsmimtent.supabase.co/functions/v1/complete-travel',
    headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl6dG9nbWRpeG1jaHNtaW10ZW50Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc5ODU0ODcsImV4cCI6MjA3MzU2MTQ4N30.vqfz_ZIvCIEXAuoSYmydg-XA6oUiPbcCc6yjfb2zL0g"}'::jsonb,
    body:='{}'::jsonb
  ) as request_id;
$$);

-- 4. Complete release manufacturing (every 30 minutes)
SELECT cron.schedule('complete-release-manufacturing', '*/30 * * * *', $$
  SELECT net.http_post(
    url:='https://yztogmdixmchsmimtent.supabase.co/functions/v1/complete-release-manufacturing',
    headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl6dG9nbWRpeG1jaHNtaW10ZW50Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc5ODU0ODcsImV4cCI6MjA3MzU2MTQ4N30.vqfz_ZIvCIEXAuoSYmydg-XA6oUiPbcCc6yjfb2zL0g"}'::jsonb,
    body:='{}'::jsonb
  ) as request_id;
$$);

-- 5. Complete video production (every 30 minutes)
SELECT cron.schedule('complete-video-production', '*/30 * * * *', $$
  SELECT net.http_post(
    url:='https://yztogmdixmchsmimtent.supabase.co/functions/v1/complete-video-production',
    headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl6dG9nbWRpeG1jaHNtaW10ZW50Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc5ODU0ODcsImV4cCI6MjA3MzU2MTQ4N30.vqfz_ZIvCIEXAuoSYmydg-XA6oUiPbcCc6yjfb2zL0g"}'::jsonb,
    body:='{}'::jsonb
  ) as request_id;
$$);

-- 6. Generate PR offers (every 6 hours)
SELECT cron.schedule('generate-pr-offers-cron', '0 */6 * * *', $$
  SELECT net.http_post(
    url:='https://yztogmdixmchsmimtent.supabase.co/functions/v1/generate-pr-offers',
    headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl6dG9nbWRpeG1jaHNtaW10ZW50Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc5ODU0ODcsImV4cCI6MjA3MzU2MTQ4N30.vqfz_ZIvCIEXAuoSYmydg-XA6oUiPbcCc6yjfb2zL0g"}'::jsonb,
    body:='{}'::jsonb
  ) as request_id;
$$);

-- 7. Process scheduled PR (every 15 minutes)
SELECT cron.schedule('process-scheduled-pr', '*/15 * * * *', $$
  SELECT net.http_post(
    url:='https://yztogmdixmchsmimtent.supabase.co/functions/v1/process-scheduled-pr',
    headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl6dG9nbWRpeG1jaHNtaW10ZW50Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc5ODU0ODcsImV4cCI6MjA3MzU2MTQ4N30.vqfz_ZIvCIEXAuoSYmydg-XA6oUiPbcCc6yjfb2zL0g"}'::jsonb,
    body:='{}'::jsonb
  ) as request_id;
$$);

-- 8. Generate sponsorship offers (every 8 hours)
SELECT cron.schedule('generate-sponsorship-offers-cron', '0 */8 * * *', $$
  SELECT net.http_post(
    url:='https://yztogmdixmchsmimtent.supabase.co/functions/v1/generate-sponsorship-offers',
    headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl6dG9nbWRpeG1jaHNtaW10ZW50Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc5ODU0ODcsImV4cCI6MjA3MzU2MTQ4N30.vqfz_ZIvCIEXAuoSYmydg-XA6oUiPbcCc6yjfb2zL0g"}'::jsonb,
    body:='{}'::jsonb
  ) as request_id;
$$);

-- 9. Process sponsorship payments (daily at midnight)
SELECT cron.schedule('process-sponsorship-payments-cron', '0 0 * * *', $$
  SELECT net.http_post(
    url:='https://yztogmdixmchsmimtent.supabase.co/functions/v1/process-sponsorship-payments',
    headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl6dG9nbWRpeG1jaHNtaW10ZW50Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc5ODU0ODcsImV4cCI6MjA3MzU2MTQ4N30.vqfz_ZIvCIEXAuoSYmydg-XA6oUiPbcCc6yjfb2zL0g"}'::jsonb,
    body:='{}'::jsonb
  ) as request_id;
$$);

-- 10. Generate radio invitations (every 6 hours)
SELECT cron.schedule('generate-radio-invitations-cron', '0 */6 * * *', $$
  SELECT net.http_post(
    url:='https://yztogmdixmchsmimtent.supabase.co/functions/v1/generate-radio-invitations',
    headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl6dG9nbWRpeG1jaHNtaW10ZW50Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc5ODU0ODcsImV4cCI6MjA3MzU2MTQ4N30.vqfz_ZIvCIEXAuoSYmydg-XA6oUiPbcCc6yjfb2zL0g"}'::jsonb,
    body:='{}'::jsonb
  ) as request_id;
$$);

-- 11. Process radio submissions (every 30 minutes)
SELECT cron.schedule('process-radio-submissions-cron', '*/30 * * * *', $$
  SELECT net.http_post(
    url:='https://yztogmdixmchsmimtent.supabase.co/functions/v1/process-radio-submissions',
    headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl6dG9nbWRpeG1jaHNtaW10ZW50Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc5ODU0ODcsImV4cCI6MjA3MzU2MTQ4N30.vqfz_ZIvCIEXAuoSYmydg-XA6oUiPbcCc6yjfb2zL0g"}'::jsonb,
    body:='{}'::jsonb
  ) as request_id;
$$);

-- 12. Simulate radio plays (hourly)
SELECT cron.schedule('simulate-radio-plays-cron', '0 * * * *', $$
  SELECT net.http_post(
    url:='https://yztogmdixmchsmimtent.supabase.co/functions/v1/simulate-radio-plays',
    headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl6dG9nbWRpeG1jaHNtaW10ZW50Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc5ODU0ODcsImV4cCI6MjA3MzU2MTQ4N30.vqfz_ZIvCIEXAuoSYmydg-XA6oUiPbcCc6yjfb2zL0g"}'::jsonb,
    body:='{}'::jsonb
  ) as request_id;
$$);

-- 13. Simulate video views (hourly)
SELECT cron.schedule('simulate-video-views-cron', '0 * * * *', $$
  SELECT net.http_post(
    url:='https://yztogmdixmchsmimtent.supabase.co/functions/v1/simulate-video-views',
    headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl6dG9nbWRpeG1jaHNtaW10ZW50Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc5ODU0ODcsImV4cCI6MjA3MzU2MTQ4N30.vqfz_ZIvCIEXAuoSYmydg-XA6oUiPbcCc6yjfb2zL0g"}'::jsonb,
    body:='{}'::jsonb
  ) as request_id;
$$);

-- 14. Process prison events (every 30 minutes)
SELECT cron.schedule('process-prison-events-cron', '*/30 * * * *', $$
  SELECT net.http_post(
    url:='https://yztogmdixmchsmimtent.supabase.co/functions/v1/process-prison-events',
    headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl6dG9nbWRpeG1jaHNtaW10ZW50Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc5ODU0ODcsImV4cCI6MjA3MzU2MTQ4N30.vqfz_ZIvCIEXAuoSYmydg-XA6oUiPbcCc6yjfb2zL0g"}'::jsonb,
    body:='{}'::jsonb
  ) as request_id;
$$);

-- 15. Release prisoners (hourly)
SELECT cron.schedule('release-prisoners-cron', '0 * * * *', $$
  SELECT net.http_post(
    url:='https://yztogmdixmchsmimtent.supabase.co/functions/v1/release-prisoners',
    headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl6dG9nbWRpeG1jaHNtaW10ZW50Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc5ODU0ODcsImV4cCI6MjA3MzU2MTQ4N30.vqfz_ZIvCIEXAuoSYmydg-XA6oUiPbcCc6yjfb2zL0g"}'::jsonb,
    body:='{}'::jsonb
  ) as request_id;
$$);