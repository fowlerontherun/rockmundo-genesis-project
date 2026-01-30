-- Update trigger function with new thresholds (6h = Perfected)
CREATE OR REPLACE FUNCTION update_rehearsal_stage()
RETURNS TRIGGER AS $$
BEGIN
  -- Aligned with user expectations: 6 hours (360min) = Perfected
  NEW.rehearsal_stage := CASE
    WHEN NEW.familiarity_minutes >= 360 THEN 'perfected'
    WHEN NEW.familiarity_minutes >= 300 THEN 'well_rehearsed'
    WHEN NEW.familiarity_minutes >= 180 THEN 'familiar'
    WHEN NEW.familiarity_minutes >= 60 THEN 'learning'
    ELSE 'unlearned'
  END;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Update percentage calculation: 100% = 360 minutes (6 hours) to align with Perfected threshold
-- Drop the existing generated column and recreate with new calculation
ALTER TABLE band_song_familiarity 
DROP COLUMN IF EXISTS familiarity_percentage;

ALTER TABLE band_song_familiarity 
ADD COLUMN familiarity_percentage integer 
GENERATED ALWAYS AS (LEAST(100, (familiarity_minutes * 100) / 360)) STORED;

-- Touch all existing records to recalculate rehearsal_stage via trigger
UPDATE band_song_familiarity SET familiarity_minutes = familiarity_minutes WHERE familiarity_minutes > 0;