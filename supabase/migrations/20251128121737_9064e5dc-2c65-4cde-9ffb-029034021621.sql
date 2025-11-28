-- Add gender and total_hours_played columns to profiles table
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS gender TEXT DEFAULT 'unspecified' CHECK (gender IN ('male', 'female', 'non-binary', 'unspecified', 'other')),
ADD COLUMN IF NOT EXISTS total_hours_played INTEGER DEFAULT 0 CHECK (total_hours_played >= 0);

-- Update existing profiles to have 'unspecified' gender if NULL
UPDATE profiles SET gender = 'unspecified' WHERE gender IS NULL;

-- Add comment for documentation
COMMENT ON COLUMN profiles.gender IS 'Player character gender identity';
COMMENT ON COLUMN profiles.total_hours_played IS 'Total hours the player has spent in game';