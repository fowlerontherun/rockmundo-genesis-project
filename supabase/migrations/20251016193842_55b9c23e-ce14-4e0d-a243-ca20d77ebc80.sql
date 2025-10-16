-- First, delete duplicate band memberships and bands for user 'eddd663a-ab81-4c39-bc03-4ac3a347095e'
-- Keep only "Big Fowler and the Growlers" (id: 110e9f19-d3f4-431a-88bc-b02d4636a984)

-- Delete band members for duplicate bands
DELETE FROM band_members 
WHERE band_id IN (
  SELECT id FROM bands 
  WHERE leader_id = 'eddd663a-ab81-4c39-bc03-4ac3a347095e' 
    AND id != '110e9f19-d3f4-431a-88bc-b02d4636a984'
);

-- Delete duplicate bands
DELETE FROM bands 
WHERE leader_id = 'eddd663a-ab81-4c39-bc03-4ac3a347095e' 
  AND id != '110e9f19-d3f4-431a-88bc-b02d4636a984';

-- Add a unique constraint to prevent users from being in multiple bands
-- (Note: This allows users to be in ONE band, but they can't create/join multiple)
CREATE UNIQUE INDEX IF NOT EXISTS idx_one_band_per_user 
ON band_members(user_id) 
WHERE is_touring_member = false;

-- Add comment explaining the constraint
COMMENT ON INDEX idx_one_band_per_user IS 
  'Ensures each user can only be a permanent member of one band at a time. Touring members are excluded.';