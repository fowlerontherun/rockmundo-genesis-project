-- Fix RLS policies for player_attributes to support both user_id and profile_id
DROP POLICY IF EXISTS "Users can view their own attributes" ON player_attributes;
DROP POLICY IF EXISTS "Users can insert their own attributes" ON player_attributes;
DROP POLICY IF EXISTS "Users can update their own attributes" ON player_attributes;

-- New policies that check both user_id and profile_id
CREATE POLICY "Users can view their own attributes"
ON player_attributes
FOR SELECT
USING (
  auth.uid() = user_id 
  OR 
  profile_id IN (
    SELECT id FROM profiles WHERE user_id = auth.uid()
  )
);

CREATE POLICY "Users can insert their own attributes"
ON player_attributes
FOR INSERT
WITH CHECK (
  auth.uid() = user_id 
  OR 
  profile_id IN (
    SELECT id FROM profiles WHERE user_id = auth.uid()
  )
);

CREATE POLICY "Users can update their own attributes"
ON player_attributes
FOR UPDATE
USING (
  auth.uid() = user_id 
  OR 
  profile_id IN (
    SELECT id FROM profiles WHERE user_id = auth.uid()
  )
);