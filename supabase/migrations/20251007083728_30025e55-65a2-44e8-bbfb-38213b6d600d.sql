-- Add health system columns to profiles table
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS health integer NOT NULL DEFAULT 100,
ADD COLUMN IF NOT EXISTS energy integer NOT NULL DEFAULT 100,
ADD COLUMN IF NOT EXISTS last_health_update timestamp with time zone DEFAULT now(),
ADD COLUMN IF NOT EXISTS rest_required_until timestamp with time zone DEFAULT NULL;

-- Add check constraints to ensure health and energy stay within valid ranges
ALTER TABLE profiles
ADD CONSTRAINT health_range CHECK (health >= 0 AND health <= 100),
ADD CONSTRAINT energy_range CHECK (energy >= 0 AND energy <= 100);