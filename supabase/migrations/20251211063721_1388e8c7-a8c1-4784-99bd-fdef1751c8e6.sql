-- Fix historical familiarity data from completed rehearsals
-- Insert/update band_song_familiarity for all completed rehearsals

INSERT INTO band_song_familiarity (band_id, song_id, familiarity_minutes, last_rehearsed_at)
SELECT 
  band_id,
  selected_song_id,
  SUM(familiarity_gained)::integer,
  MAX(completed_at)
FROM band_rehearsals 
WHERE status = 'completed' 
  AND selected_song_id IS NOT NULL 
  AND familiarity_gained > 0
GROUP BY band_id, selected_song_id
ON CONFLICT (band_id, song_id) 
DO UPDATE SET 
  familiarity_minutes = EXCLUDED.familiarity_minutes,
  last_rehearsed_at = EXCLUDED.last_rehearsed_at,
  updated_at = now();