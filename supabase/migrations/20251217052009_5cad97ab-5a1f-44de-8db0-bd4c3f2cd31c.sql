-- Add Ready Player Me avatar URL support to player_avatar_config
ALTER TABLE player_avatar_config 
ADD COLUMN IF NOT EXISTS rpm_avatar_url TEXT,
ADD COLUMN IF NOT EXISTS rpm_avatar_id TEXT,
ADD COLUMN IF NOT EXISTS use_rpm_avatar BOOLEAN DEFAULT false;