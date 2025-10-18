-- Add completion workflow columns to songs and recording_sessions tables

-- Add completed_at column to songs table to track when a song is marked complete
ALTER TABLE songs ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ;

-- Add completed_at column to recording_sessions table if missing
ALTER TABLE recording_sessions ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ;

-- Create index for faster queries on completed songs
CREATE INDEX IF NOT EXISTS idx_songs_completed_at ON songs(completed_at DESC) WHERE completed_at IS NOT NULL;