-- Update festival_participants status constraint to include 'pending', 'withdrawn', and 'performed'
ALTER TABLE festival_participants DROP CONSTRAINT IF EXISTS festival_participants_status_check;
ALTER TABLE festival_participants ADD CONSTRAINT festival_participants_status_check 
  CHECK (status = ANY (ARRAY['invited', 'confirmed', 'declined', 'cancelled', 'pending', 'withdrawn', 'performed']));

-- Ensure activity_feed user_id is not null for new records
ALTER TABLE activity_feed ALTER COLUMN user_id SET NOT NULL;