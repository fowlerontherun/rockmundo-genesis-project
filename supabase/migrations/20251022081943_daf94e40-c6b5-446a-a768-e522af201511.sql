-- Add recording_version column to recording_sessions table
ALTER TABLE recording_sessions 
ADD COLUMN IF NOT EXISTS recording_version TEXT CHECK (recording_version IN ('standard', 'remix', 'acoustic'));

-- Add comment to explain the column
COMMENT ON COLUMN recording_sessions.recording_version IS 'Type of recording version: standard (re-recording), remix, or acoustic';
