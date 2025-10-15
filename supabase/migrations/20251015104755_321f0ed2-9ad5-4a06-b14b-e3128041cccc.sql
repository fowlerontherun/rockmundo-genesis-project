-- Fix friendships RLS policies to properly check user_id via profiles table

-- Drop existing incorrect policies
DROP POLICY IF EXISTS "Users can create friendships" ON friendships;
DROP POLICY IF EXISTS "Users can update their friendships" ON friendships;
DROP POLICY IF EXISTS "Users can view their own friendships" ON friendships;

-- Create correct policies that join with profiles table
CREATE POLICY "Users can create friendships"
ON friendships FOR INSERT
WITH CHECK (
  requestor_id IN (
    SELECT id FROM profiles WHERE user_id = auth.uid()
  )
);

CREATE POLICY "Users can update their friendships"
ON friendships FOR UPDATE
USING (
  requestor_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
  OR addressee_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
);

CREATE POLICY "Users can view their own friendships"
ON friendships FOR SELECT
USING (
  requestor_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
  OR addressee_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
);