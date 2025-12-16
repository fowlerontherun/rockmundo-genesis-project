-- Create comprehensive game activity logging table
CREATE TABLE IF NOT EXISTS game_activity_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id),
  band_id UUID REFERENCES bands(id),
  activity_type TEXT NOT NULL,
  activity_category TEXT NOT NULL,
  description TEXT NOT NULL,
  metadata JSONB DEFAULT '{}',
  amount NUMERIC,
  before_state JSONB,
  after_state JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_game_activity_logs_user ON game_activity_logs(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_game_activity_logs_band ON game_activity_logs(band_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_game_activity_logs_type ON game_activity_logs(activity_type, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_game_activity_logs_category ON game_activity_logs(activity_category, created_at DESC);

-- Enable RLS
ALTER TABLE game_activity_logs ENABLE ROW LEVEL SECURITY;

-- Users can view their own logs
CREATE POLICY "Users can view own activity logs"
  ON game_activity_logs FOR SELECT
  USING (auth.uid() = user_id);

-- Users can insert their own logs
CREATE POLICY "Users can insert own activity logs"
  ON game_activity_logs FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- VIP/Admin users can view all logs
CREATE POLICY "VIP users can view all activity logs"
  ON game_activity_logs FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE user_id = auth.uid() 
      AND is_vip = true
    )
  );

-- Create admin function to force complete any release
CREATE OR REPLACE FUNCTION public.admin_force_complete_release(p_release_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE releases
  SET 
    release_status = 'released',
    manufacturing_complete_at = COALESCE(manufacturing_complete_at, NOW()),
    updated_at = NOW()
  WHERE id = p_release_id;
  
  IF NOT FOUND THEN
    RETURN FALSE;
  END IF;
  
  -- Log the admin action
  INSERT INTO activity_feed (user_id, activity_type, message, metadata)
  SELECT 
    user_id,
    'admin_release_complete',
    'Release "' || title || '" was manually completed by admin',
    jsonb_build_object('release_id', id, 'title', title, 'admin_action', true)
  FROM releases WHERE id = p_release_id;
  
  RETURN TRUE;
END;
$$;

-- Create function to fix releases with NULL manufacturing_complete_at
CREATE OR REPLACE FUNCTION public.fix_null_manufacturing_dates()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_fixed INTEGER := 0;
BEGIN
  -- Set manufacturing_complete_at to 2 days from now for releases missing it
  UPDATE releases
  SET manufacturing_complete_at = NOW() + INTERVAL '2 days'
  WHERE release_status = 'manufacturing'
    AND manufacturing_complete_at IS NULL;
  
  GET DIAGNOSTICS v_fixed = ROW_COUNT;
  RETURN v_fixed;
END;
$$;