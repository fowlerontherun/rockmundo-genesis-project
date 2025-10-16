-- Enable required extensions for cron jobs
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Create player_daily_cats table for daily category tracking
CREATE TABLE IF NOT EXISTS player_daily_cats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  activity_date DATE NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('practice', 'performance', 'quest', 'social', 'other')),
  xp_earned INTEGER DEFAULT 0,
  xp_spent INTEGER DEFAULT 0,
  activity_count INTEGER DEFAULT 0,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(profile_id, activity_date, category)
);

CREATE INDEX IF NOT EXISTS idx_player_daily_cats_profile ON player_daily_cats(profile_id, activity_date DESC);

-- Create trigger to populate daily categories from experience_ledger
CREATE OR REPLACE FUNCTION update_daily_category_stats()
RETURNS TRIGGER AS $$
DECLARE
  cat TEXT;
BEGIN
  -- Map activity_type to category
  cat := CASE 
    WHEN NEW.activity_type IN ('book_reading', 'university_attendance', 'mentor_session') THEN 'practice'
    WHEN NEW.activity_type IN ('gig_performance', 'busking', 'recording') THEN 'performance'
    WHEN NEW.activity_type IN ('songwriting', 'rehearsal') THEN 'practice'
    WHEN NEW.activity_type IN ('work_shift') THEN 'quest'
    WHEN NEW.activity_type IN ('twaat') THEN 'social'
    ELSE 'other'
  END;

  INSERT INTO player_daily_cats (
    profile_id, activity_date, category, xp_earned, activity_count
  ) VALUES (
    NEW.profile_id, CURRENT_DATE, cat, NEW.xp_amount, 1
  )
  ON CONFLICT (profile_id, activity_date, category) 
  DO UPDATE SET
    xp_earned = player_daily_cats.xp_earned + EXCLUDED.xp_earned,
    activity_count = player_daily_cats.activity_count + 1,
    updated_at = NOW();

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_daily_cats ON experience_ledger;
CREATE TRIGGER trigger_update_daily_cats
  AFTER INSERT ON experience_ledger
  FOR EACH ROW
  EXECUTE FUNCTION update_daily_category_stats();

-- Add cron jobs for auto-completion functions
-- Note: Unschedule existing jobs if they exist to avoid duplicates
SELECT cron.unschedule('auto-clock-out-shifts') WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'auto-clock-out-shifts');
SELECT cron.unschedule('cleanup-songwriting-sessions') WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'cleanup-songwriting-sessions');
SELECT cron.unschedule('complete-band-rehearsals') WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'complete-band-rehearsals');
SELECT cron.unschedule('calculate-weekly-activity') WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'calculate-weekly-activity');

-- Auto clock-out work shifts every 15 minutes
SELECT cron.schedule(
  'auto-clock-out-shifts',
  '*/15 * * * *',
  $$
  SELECT net.http_post(
    url:='https://yztogmdixmchsmimtent.supabase.co/functions/v1/shift-clock-out',
    headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl6dG9nbWRpeG1jaHNtaW10ZW50Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc5ODU0ODcsImV4cCI6MjA3MzU2MTQ4N30.vqfz_ZIvCIEXAuoSYmydg-XA6oUiPbcCc6yjfb2zL0g"}'::jsonb,
    body:='{}'::jsonb
  ) as request_id;
  $$
);

-- Cleanup songwriting sessions every 15 minutes
SELECT cron.schedule(
  'cleanup-songwriting-sessions',
  '*/15 * * * *',
  $$
  SELECT net.http_post(
    url:='https://yztogmdixmchsmimtent.supabase.co/functions/v1/cleanup-songwriting',
    headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl6dG9nbWRpeG1jaHNtaW10ZW50Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc5ODU0ODcsImV4cCI6MjA3MzU2MTQ4N30.vqfz_ZIvCIEXAuoSYmydg-XA6oUiPbcCc6yjfb2zL0g"}'::jsonb,
    body:='{}'::jsonb
  ) as request_id;
  $$
);

-- Complete band rehearsals every 30 minutes
SELECT cron.schedule(
  'complete-band-rehearsals',
  '*/30 * * * *',
  $$
  SELECT net.http_post(
    url:='https://yztogmdixmchsmimtent.supabase.co/functions/v1/complete-rehearsals',
    headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl6dG9nbWRpeG1jaHNtaW10ZW50Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc5ODU0ODcsImV4cCI6MjA3MzU2MTQ4N30.vqfz_ZIvCIEXAuoSYmydg-XA6oUiPbcCc6yjfb2zL0g"}'::jsonb,
    body:='{}'::jsonb
  ) as request_id;
  $$
);

-- Calculate weekly activity every day at 1 AM UTC
SELECT cron.schedule(
  'calculate-weekly-activity',
  '0 1 * * *',
  $$
  SELECT net.http_post(
    url:='https://yztogmdixmchsmimtent.supabase.co/functions/v1/calculate-weekly-activity',
    headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl6dG9nbWRpeG1jaHNtaW10ZW50Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc5ODU0ODcsImV4cCI6MjA3MzU2MTQ4N30.vqfz_ZIvCIEXAuoSYmydg-XA6oUiPbcCc6yjfb2zL0g"}'::jsonb,
    body:='{}'::jsonb
  ) as request_id;
  $$
);