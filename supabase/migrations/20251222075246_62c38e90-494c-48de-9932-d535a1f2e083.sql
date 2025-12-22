-- Clean up orphaned band_member records for disbanded bands
-- This allows users to create new bands after their old band was disbanded

DELETE FROM band_members bm
WHERE bm.is_touring_member = false
AND EXISTS (
  SELECT 1 FROM bands b 
  WHERE b.id = bm.band_id 
  AND b.status = 'disbanded'
);

-- Also clean up any band_members where the band no longer exists
DELETE FROM band_members bm
WHERE NOT EXISTS (
  SELECT 1 FROM bands b WHERE b.id = bm.band_id
);