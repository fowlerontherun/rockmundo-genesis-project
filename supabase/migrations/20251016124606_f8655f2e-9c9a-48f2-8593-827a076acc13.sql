-- Add missing columns to songs table
ALTER TABLE songs 
ADD COLUMN IF NOT EXISTS rating_revealed_at timestamp with time zone,
ADD COLUMN IF NOT EXISTS profile_id uuid REFERENCES profiles(id);

-- Add missing column to profiles table  
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS current_activity text;

-- Create index on songs profile_id for better query performance
CREATE INDEX IF NOT EXISTS idx_songs_profile_id ON songs(profile_id);

-- Update existing songs to link to profiles via user_id
UPDATE songs s
SET profile_id = p.id
FROM profiles p
WHERE s.user_id = p.user_id
AND s.profile_id IS NULL;

-- Drop policy if exists and recreate
DROP POLICY IF EXISTS "Band members can view band songs" ON songs;

CREATE POLICY "Band members can view band songs"
ON songs FOR SELECT
USING (
  band_id IN (
    SELECT band_id FROM band_members WHERE user_id = auth.uid()
  )
);

-- Create a view for bands to see their gifted songs
CREATE OR REPLACE VIEW band_gift_notifications AS
SELECT 
  asg.id,
  asg.created_at,
  asg.gift_message,
  asg.gifted_to_band_id,
  b.name as band_name,
  s.id as song_id,
  s.title as song_title,
  s.genre,
  s.song_rating,
  s.quality_score,
  FALSE as viewed
FROM admin_song_gifts asg
JOIN songs s ON s.id = asg.song_id
JOIN bands b ON b.id = asg.gifted_to_band_id
WHERE asg.gifted_to_band_id IS NOT NULL;