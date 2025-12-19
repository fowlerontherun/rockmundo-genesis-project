
-- Add lawyer columns to profiles
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS has_active_lawyer boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS lawyer_hired_at timestamp with time zone,
ADD COLUMN IF NOT EXISTS lawyer_expires_at timestamp with time zone;

-- Add comment
COMMENT ON COLUMN profiles.has_active_lawyer IS 'VIP feature - lawyer provides better royalty rates and advance on label contracts';
