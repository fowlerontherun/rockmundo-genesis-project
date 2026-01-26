-- Add columns to track remote learning in university attendance
ALTER TABLE player_university_attendance 
  ADD COLUMN IF NOT EXISTS was_remote BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS connection_failed BOOLEAN DEFAULT FALSE;

-- Add comment explaining the columns
COMMENT ON COLUMN player_university_attendance.was_remote IS 'True if the player attended via Zoom (different city than university)';
COMMENT ON COLUMN player_university_attendance.connection_failed IS 'True if internet connection failed mid-class (only half XP awarded)';