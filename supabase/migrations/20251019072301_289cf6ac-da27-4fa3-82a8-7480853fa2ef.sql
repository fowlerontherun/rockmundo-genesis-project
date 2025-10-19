-- Create songs for completed songwriting projects that don't have songs yet
-- Use 'draft' status since 'complete' is not allowed in the songs table
INSERT INTO songs (user_id, title, genre, lyrics, quality_score, song_rating, status, completed_at, songwriting_project_id, catalog_status, streams, revenue)
SELECT 
  sp.user_id,
  sp.title,
  COALESCE(sp.genres[1], 'Rock') as genre,
  COALESCE(sp.initial_lyrics, '') as lyrics,
  COALESCE(sp.quality_score, 50) as quality_score,
  COALESCE(sp.song_rating, 1) as song_rating,
  'draft' as status,
  NOW() as completed_at,
  sp.id as songwriting_project_id,
  'private' as catalog_status,
  0 as streams,
  0 as revenue
FROM songwriting_projects sp
WHERE sp.status IN ('completed', 'complete')
  AND NOT EXISTS (
    SELECT 1 FROM songs s WHERE s.songwriting_project_id = sp.id
  );