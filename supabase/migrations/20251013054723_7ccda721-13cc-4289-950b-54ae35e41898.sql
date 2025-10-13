-- Update friendships table to match type definitions
-- Rename columns to match expected schema
ALTER TABLE friendships 
  RENAME COLUMN user_id TO requestor_id;

ALTER TABLE friendships 
  RENAME COLUMN friend_user_id TO addressee_id;

-- Add responded_at column if it doesn't exist
ALTER TABLE friendships 
  ADD COLUMN IF NOT EXISTS responded_at TIMESTAMP WITH TIME ZONE;

-- Drop user_profile_id and friend_profile_id as we'll fetch profiles separately
ALTER TABLE friendships 
  DROP COLUMN IF EXISTS user_profile_id;

ALTER TABLE friendships 
  DROP COLUMN IF EXISTS friend_profile_id;

-- Update RLS policies to use new column names
DROP POLICY IF EXISTS "Users can create friendships" ON friendships;
DROP POLICY IF EXISTS "Users can update their friendships" ON friendships;
DROP POLICY IF EXISTS "Users can view their own friendships" ON friendships;

CREATE POLICY "Users can create friendships"
  ON friendships
  FOR INSERT
  WITH CHECK (auth.uid() = requestor_id);

CREATE POLICY "Users can update their friendships"
  ON friendships
  FOR UPDATE
  USING ((auth.uid() = requestor_id) OR (auth.uid() = addressee_id));

CREATE POLICY "Users can view their own friendships"
  ON friendships
  FOR SELECT
  USING ((auth.uid() = requestor_id) OR (auth.uid() = addressee_id));