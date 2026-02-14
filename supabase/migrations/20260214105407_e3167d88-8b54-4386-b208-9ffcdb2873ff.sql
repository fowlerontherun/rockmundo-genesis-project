-- Restore lyrics from songwriting_projects to songs where project has real lyrics
-- and song either has no lyrics or has AI-generated ones

-- Panic in the attic (project has real lyrics, song is NULL)
UPDATE songs SET lyrics = sp.lyrics
FROM songwriting_projects sp
WHERE sp.id = songs.songwriting_project_id
AND songs.id = '643fd4ed-c976-4032-af33-189d09392aa8'
AND sp.lyrics IS NOT NULL AND sp.lyrics != ''
AND sp.lyrics NOT LIKE '[AI Generated]%';

-- Testing it out (project has lyrics, song is EMPTY)
UPDATE songs SET lyrics = sp.lyrics
FROM songwriting_projects sp
WHERE sp.id = songs.songwriting_project_id
AND songs.id = 'cb9f5ac0-e99b-45ba-869a-fe381bd07202'
AND sp.lyrics IS NOT NULL AND sp.lyrics != ''
AND sp.lyrics NOT LIKE '[AI Generated]%';

-- Bulk fix: For ALL songs where project has non-AI lyrics but song has AI-generated lyrics,
-- restore the project lyrics to the song
UPDATE songs SET lyrics = sp.lyrics
FROM songwriting_projects sp
WHERE sp.id = songs.songwriting_project_id
AND sp.lyrics IS NOT NULL AND sp.lyrics != ''
AND sp.lyrics NOT LIKE '[AI Generated]%'
AND (songs.lyrics IS NULL OR songs.lyrics = '' OR songs.lyrics LIKE '[AI Generated]%' OR songs.lyrics LIKE '%[AI Generated]%');