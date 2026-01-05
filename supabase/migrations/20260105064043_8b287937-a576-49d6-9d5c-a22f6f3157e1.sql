-- Schedule ticket sales simulation to run every 6 hours
SELECT
  cron.schedule(
    'simulate-ticket-sales',
    '0 */6 * * *',
    $$
    SELECT
      net.http_post(
        url:='https://yztogmdixmchsmimtent.supabase.co/functions/v1/simulate-ticket-sales',
        headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl6dG9nbWRpeG1jaHNtaW10ZW50Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc5ODU0ODcsImV4cCI6MjA3MzU2MTQ4N30.vqfz_ZIvCIEXAuoSYmydg-XA6oUiPbcCc6yjfb2zL0g"}'::jsonb,
        body:=concat('{"time": "', now(), '"}')::jsonb
      ) as request_id;
    $$
  );