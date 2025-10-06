-- Add missing columns to profile_activity_statuses
ALTER TABLE profile_activity_statuses 
ADD COLUMN IF NOT EXISTS duration_minutes integer,
ADD COLUMN IF NOT EXISTS ends_at timestamp with time zone;

-- Add missing column to jam_sessions
ALTER TABLE jam_sessions 
ADD COLUMN IF NOT EXISTS participant_ids uuid[] DEFAULT '{}';