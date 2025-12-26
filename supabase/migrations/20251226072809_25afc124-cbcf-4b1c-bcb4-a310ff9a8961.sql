-- Fix familiarity_percentage generated column formula
-- Currently: 100% at 60 minutes (way too easy)
-- New: 100% at 600 minutes (10 hours of rehearsal)

ALTER TABLE band_song_familiarity 
DROP COLUMN familiarity_percentage;

ALTER TABLE band_song_familiarity 
ADD COLUMN familiarity_percentage integer GENERATED ALWAYS AS (LEAST(100, (familiarity_minutes * 100) / 600)) STORED;

-- Update rehearsal_stage for existing records based on new percentage calculation
UPDATE band_song_familiarity
SET rehearsal_stage = CASE 
  WHEN LEAST(100, (familiarity_minutes * 100) / 600) >= 90 THEN 'mastered'
  WHEN LEAST(100, (familiarity_minutes * 100) / 600) >= 60 THEN 'familiar'
  WHEN LEAST(100, (familiarity_minutes * 100) / 600) >= 30 THEN 'practicing'
  ELSE 'learning'
END
WHERE familiarity_minutes IS NOT NULL;