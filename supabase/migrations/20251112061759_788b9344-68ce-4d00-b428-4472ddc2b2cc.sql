-- Add missing cron job configurations
INSERT INTO cron_job_config (job_name, edge_function_name, schedule, is_active, display_name, description, allow_manual_trigger)
VALUES 
('generate-gig-offers', 'generate-gig-offers', '0 */6 * * *', true, 'Generate Gig Offers', 'Generates new gig offers for bands every 6 hours', true),
('generate-daily-sales', 'generate-daily-sales', '0 2 * * *', true, 'Generate Daily Sales', 'Processes daily physical release sales at 2 AM', true)
ON CONFLICT (job_name) DO UPDATE SET
  edge_function_name = EXCLUDED.edge_function_name,
  schedule = EXCLUDED.schedule,
  is_active = EXCLUDED.is_active,
  display_name = EXCLUDED.display_name,
  description = EXCLUDED.description,
  allow_manual_trigger = EXCLUDED.allow_manual_trigger;

-- Create actual pg_cron jobs for generate-gig-offers
SELECT cron.schedule(
  'generate-gig-offers-cron',
  '0 */6 * * *',
  $$
  SELECT net.http_post(
    url:='https://yztogmdixmchsmimtent.supabase.co/functions/v1/generate-gig-offers',
    headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl6dG9nbWRpeG1jaHNtaW10ZW50Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc5ODU0ODcsImV4cCI6MjA3MzU2MTQ4N30.vqfz_ZIvCIEXAuoSYmydg-XA6oUiPbcCc6yjfb2zL0g", "x-triggered-by": "cron"}'::jsonb,
    body:='{}'::jsonb
  ) as request_id;
  $$
);

-- Create actual pg_cron jobs for generate-daily-sales
SELECT cron.schedule(
  'generate-daily-sales-cron',
  '0 2 * * *',
  $$
  SELECT net.http_post(
    url:='https://yztogmdixmchsmimtent.supabase.co/functions/v1/generate-daily-sales',
    headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl6dG9nbWRpeG1jaHNtaW10ZW50Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc5ODU0ODcsImV4cCI6MjA3MzU2MTQ4N30.vqfz_ZIvCIEXAuoSYmydg-XA6oUiPbcCc6yjfb2zL0g", "x-triggered-by": "cron"}'::jsonb,
    body:='{}'::jsonb
  ) as request_id;
  $$
);