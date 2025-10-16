-- Update duration_hours check constraint to allow more flexible durations
ALTER TABLE band_rehearsals 
DROP CONSTRAINT IF EXISTS band_rehearsals_duration_hours_check;

ALTER TABLE band_rehearsals
ADD CONSTRAINT band_rehearsals_duration_hours_check 
CHECK (duration_hours IN (1, 2, 3, 4, 6, 8));