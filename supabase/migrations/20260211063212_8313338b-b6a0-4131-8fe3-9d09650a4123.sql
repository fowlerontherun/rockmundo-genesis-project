-- Update the status check constraint to include all used statuses
ALTER TABLE artist_label_contracts DROP CONSTRAINT artist_label_contracts_status_check;
ALTER TABLE artist_label_contracts ADD CONSTRAINT artist_label_contracts_status_check 
  CHECK (status = ANY (ARRAY['pending', 'offered', 'active', 'fulfilled', 'breached', 'expired', 'terminated', 'rejected', 'completed']));
