-- Create player_scheduled_activities table for schedule integration
CREATE TABLE IF NOT EXISTS player_scheduled_activities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  activity_type TEXT NOT NULL CHECK (activity_type IN (
    'songwriting', 'gig', 'rehearsal', 'busking', 'recording',
    'travel', 'work', 'university', 'reading', 'mentorship',
    'youtube_video', 'health', 'other'
  )),
  scheduled_start TIMESTAMPTZ NOT NULL,
  scheduled_end TIMESTAMPTZ NOT NULL,
  duration_minutes INTEGER GENERATED ALWAYS AS (EXTRACT(EPOCH FROM (scheduled_end - scheduled_start))/60) STORED,
  status TEXT NOT NULL DEFAULT 'scheduled' CHECK (status IN (
    'scheduled', 'in_progress', 'completed', 'cancelled', 'missed'
  )),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  title TEXT NOT NULL,
  description TEXT,
  location TEXT,
  linked_gig_id UUID REFERENCES gigs(id) ON DELETE SET NULL,
  linked_rehearsal_id UUID REFERENCES band_rehearsals(id) ON DELETE SET NULL,
  linked_recording_id UUID REFERENCES recording_sessions(id) ON DELETE SET NULL,
  linked_job_shift_id UUID REFERENCES shift_history(id) ON DELETE SET NULL,
  metadata JSONB DEFAULT '{}'::jsonb,
  reminder_minutes_before INTEGER DEFAULT 15,
  reminder_sent BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create index for efficient queries
CREATE INDEX IF NOT EXISTS idx_scheduled_activities_user_date 
  ON player_scheduled_activities(user_id, scheduled_start DESC);

CREATE INDEX IF NOT EXISTS idx_scheduled_activities_status 
  ON player_scheduled_activities(status) WHERE status IN ('scheduled', 'in_progress');

-- Enable RLS
ALTER TABLE player_scheduled_activities ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view their own scheduled activities"
  ON player_scheduled_activities FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own scheduled activities"
  ON player_scheduled_activities FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own scheduled activities"
  ON player_scheduled_activities FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own scheduled activities"
  ON player_scheduled_activities FOR DELETE
  USING (auth.uid() = user_id);

-- Function to check scheduling conflicts
CREATE OR REPLACE FUNCTION check_scheduling_conflict(
  p_user_id UUID,
  p_start TIMESTAMPTZ,
  p_end TIMESTAMPTZ,
  p_exclude_id UUID DEFAULT NULL
) RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM player_scheduled_activities
    WHERE user_id = p_user_id
      AND status IN ('scheduled', 'in_progress')
      AND (id != p_exclude_id OR p_exclude_id IS NULL)
      AND (
        (scheduled_start <= p_start AND scheduled_end > p_start)
        OR (scheduled_start < p_end AND scheduled_end >= p_end)
        OR (scheduled_start >= p_start AND scheduled_end <= p_end)
      )
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Add cron jobs for gig offers and daily sales
INSERT INTO cron_job_config (job_name, edge_function_name, display_name, description, schedule, is_active, allow_manual_trigger)
VALUES 
  ('generate-gig-offers', 'generate-gig-offers', 'Generate Gig Offers', 'Automatically generate gig offers for bands based on fame', '0 */6 * * *', true, true),
  ('generate-daily-sales', 'generate-daily-sales', 'Generate Daily Sales', 'Generate daily sales data for releases', '0 2 * * *', true, true)
ON CONFLICT (job_name) DO UPDATE SET
  edge_function_name = EXCLUDED.edge_function_name,
  display_name = EXCLUDED.display_name,
  description = EXCLUDED.description,
  schedule = EXCLUDED.schedule,
  allow_manual_trigger = EXCLUDED.allow_manual_trigger;