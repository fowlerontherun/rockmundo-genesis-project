-- Fix existing songs with completed recording sessions that are still in draft status
UPDATE songs s
SET 
  status = 'recorded',
  band_id = COALESCE(s.band_id, rs.band_id),
  updated_at = NOW()
FROM recording_sessions rs
WHERE rs.song_id = s.id
  AND rs.status = 'completed'
  AND s.status = 'draft';