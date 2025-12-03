-- Drop and recreate the status check constraint to include 'scheduled'
ALTER TABLE band_rehearsals DROP CONSTRAINT band_rehearsals_status_check;

ALTER TABLE band_rehearsals ADD CONSTRAINT band_rehearsals_status_check 
CHECK (status IN ('scheduled', 'in_progress', 'completed', 'cancelled'));