-- Fix songs that have null band_id but have recording sessions with band_id
UPDATE songs s
SET 
  band_id = rs.band_id,
  updated_at = NOW()
FROM (
  SELECT DISTINCT ON (song_id) song_id, band_id
  FROM recording_sessions
  WHERE band_id IS NOT NULL AND status = 'completed'
  ORDER BY song_id, completed_at DESC
) rs
WHERE s.id = rs.song_id AND s.band_id IS NULL;