-- Drop the generated column and recreate as regular column with trigger
ALTER TABLE band_song_familiarity 
DROP COLUMN IF EXISTS rehearsal_stage CASCADE;

-- Add rehearsal_stage as regular text column
ALTER TABLE band_song_familiarity 
ADD COLUMN rehearsal_stage TEXT DEFAULT 'unlearned';

-- Add constraint for valid values
ALTER TABLE band_song_familiarity 
ADD CONSTRAINT valid_rehearsal_stage 
CHECK (rehearsal_stage IN ('unlearned', 'learning', 'familiar', 'well_rehearsed', 'perfected'));

-- Create function to auto-update rehearsal_stage based on familiarity_minutes
CREATE OR REPLACE FUNCTION update_rehearsal_stage()
RETURNS TRIGGER AS $$
BEGIN
  -- Calculate stage based on total minutes
  -- 0 hours = unlearned
  -- 1-4 hours (60-239 min) = learning
  -- 5-14 hours (300-839 min) = familiar
  -- 15-29 hours (900-1739 min) = well_rehearsed
  -- 30+ hours (1800+ min) = perfected
  NEW.rehearsal_stage := CASE
    WHEN NEW.familiarity_minutes >= 1800 THEN 'perfected'
    WHEN NEW.familiarity_minutes >= 900 THEN 'well_rehearsed'
    WHEN NEW.familiarity_minutes >= 300 THEN 'familiar'
    WHEN NEW.familiarity_minutes >= 60 THEN 'learning'
    ELSE 'unlearned'
  END;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for automatic stage updates
CREATE TRIGGER set_rehearsal_stage
BEFORE INSERT OR UPDATE ON band_song_familiarity
FOR EACH ROW EXECUTE FUNCTION update_rehearsal_stage();

-- Update existing records by touching them (trigger will calculate)
UPDATE band_song_familiarity
SET familiarity_minutes = familiarity_minutes;