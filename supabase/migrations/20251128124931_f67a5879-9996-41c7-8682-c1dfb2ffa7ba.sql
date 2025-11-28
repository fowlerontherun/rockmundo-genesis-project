-- Add is_vip column to profiles table
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS is_vip BOOLEAN DEFAULT FALSE;

-- Set default for existing rows
UPDATE profiles SET is_vip = FALSE WHERE is_vip IS NULL;

-- Add comment
COMMENT ON COLUMN profiles.is_vip IS 'VIP status grants access to exclusive chat and features';