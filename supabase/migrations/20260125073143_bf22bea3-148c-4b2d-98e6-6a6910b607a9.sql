-- Fix RLS policies for band_song_familiarity to allow proper inserts/updates by band members

-- Drop existing policies and recreate with proper conditions
DROP POLICY IF EXISTS "Band members can update their song familiarity" ON band_song_familiarity;
DROP POLICY IF EXISTS "Band members can insert song familiarity" ON band_song_familiarity;
DROP POLICY IF EXISTS "Band members can view their song familiarity" ON band_song_familiarity;
DROP POLICY IF EXISTS "Users can view their band song familiarity" ON band_song_familiarity;
DROP POLICY IF EXISTS "Users can insert their band song familiarity" ON band_song_familiarity;
DROP POLICY IF EXISTS "Users can update their band song familiarity" ON band_song_familiarity;

-- Create comprehensive policies for band members
CREATE POLICY "Band members can view song familiarity"
ON band_song_familiarity
FOR SELECT
TO authenticated
USING (
  band_id IN (
    SELECT band_id FROM band_members WHERE user_id = auth.uid() AND member_status = 'active'
  )
);

CREATE POLICY "Band members can insert song familiarity"
ON band_song_familiarity
FOR INSERT
TO authenticated
WITH CHECK (
  band_id IN (
    SELECT band_id FROM band_members WHERE user_id = auth.uid() AND member_status = 'active'
  )
);

CREATE POLICY "Band members can update song familiarity"
ON band_song_familiarity
FOR UPDATE
TO authenticated
USING (
  band_id IN (
    SELECT band_id FROM band_members WHERE user_id = auth.uid() AND member_status = 'active'
  )
)
WITH CHECK (
  band_id IN (
    SELECT band_id FROM band_members WHERE user_id = auth.uid() AND member_status = 'active'
  )
);

-- Allow service role full access (for edge functions)
CREATE POLICY "Service role has full access to song familiarity"
ON band_song_familiarity
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);