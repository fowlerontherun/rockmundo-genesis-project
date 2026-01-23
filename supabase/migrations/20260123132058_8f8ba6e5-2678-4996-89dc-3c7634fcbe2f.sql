-- Register missing cron jobs for offer generation systems

-- Generate PR Offers (runs every 6 hours)
INSERT INTO cron_job_config (job_name, edge_function_name, display_name, description, schedule, is_active, allow_manual_trigger)
VALUES (
  'generate-pr-offers',
  'generate-pr-offers',
  'Generate PR Offers',
  'Creates PR/media appearance offers for bands with 50+ fame across TV, radio, podcast, newspaper, magazine, youtube, website, and film',
  '0 */6 * * *',
  true,
  true
)
ON CONFLICT (job_name) DO NOTHING;

-- Generate Sponsorship Offers (runs every 6 hours)
INSERT INTO cron_job_config (job_name, edge_function_name, display_name, description, schedule, is_active, allow_manual_trigger)
VALUES (
  'generate-sponsorship-offers',
  'generate-sponsorship-offers',
  'Generate Sponsorship Offers',
  'Score bands against active brands and issue sponsorship offers with expirations',
  '0 */6 * * *',
  true,
  true
)
ON CONFLICT (job_name) DO NOTHING;

-- Process Daily Updates (runs once daily at 3am)
INSERT INTO cron_job_config (job_name, edge_function_name, display_name, description, schedule, is_active, allow_manual_trigger)
VALUES (
  'process-daily-updates',
  'process-daily-updates',
  'Process Daily Updates',
  'Master daily job that handles fame decay, fan decay, PR offer generation, and other daily game mechanics',
  '0 3 * * *',
  true,
  true
)
ON CONFLICT (job_name) DO NOTHING;

-- Process Scheduled PR (runs hourly to complete accepted PR activities)
INSERT INTO cron_job_config (job_name, edge_function_name, display_name, description, schedule, is_active, allow_manual_trigger)
VALUES (
  'process-scheduled-pr',
  'process-scheduled-pr',
  'Process Scheduled PR',
  'Completes accepted PR offers whose proposed date has passed',
  '0 * * * *',
  true,
  true
)
ON CONFLICT (job_name) DO NOTHING;