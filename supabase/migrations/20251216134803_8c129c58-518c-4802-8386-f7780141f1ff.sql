-- Seed radio shows for all active stations to unblock process_radio_submission
INSERT INTO radio_shows (station_id, show_name, host_name, time_slot, is_active, show_genres, day_of_week)
SELECT 
  rs.id as station_id,
  CASE 
    WHEN rs.station_type = 'national' THEN rs.name || ' Top 40'
    ELSE rs.name || ' Local Hits'
  END as show_name,
  'DJ ' || SUBSTRING(rs.name FROM 1 FOR 8) as host_name,
  'morning_drive' as time_slot,
  true as is_active,
  rs.accepted_genres as show_genres,
  0 as day_of_week
FROM radio_stations rs
WHERE rs.is_active = true
AND NOT EXISTS (
  SELECT 1 FROM radio_shows rsh WHERE rsh.station_id = rs.id AND rsh.is_active = true
);

-- Add cron job configurations
INSERT INTO cron_job_config (job_name, display_name, schedule, edge_function_name, description, is_active, allow_manual_trigger)
VALUES 
  ('process-radio-submissions', 'Process Radio Submissions', '0 */2 * * *', 'process-radio-submissions', 'Auto-process pending radio submissions every 2 hours', true, true),
  ('simulate-radio-plays', 'Simulate Radio Plays', '0 */4 * * *', 'simulate-radio-plays', 'Simulate radio plays for songs in rotation every 4 hours', true, true),
  ('complete-video-production', 'Complete Video Production', '0 * * * *', 'complete-video-production', 'Check and complete video productions every hour', true, true),
  ('simulate-video-views', 'Simulate Video Views', '0 6 * * *', 'simulate-video-views', 'Simulate daily video views at 6 AM', true, true),
  ('update-music-charts', 'Update Music Charts', '0 0 * * *', 'update-music-charts', 'Update all music charts daily at midnight', true, true)
ON CONFLICT (job_name) DO UPDATE SET
  schedule = EXCLUDED.schedule,
  edge_function_name = EXCLUDED.edge_function_name,
  description = EXCLUDED.description,
  is_active = EXCLUDED.is_active;