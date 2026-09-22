-- Restore lyrics from the songwriting project field that existed at this point in the schema
-- and song either has no lyrics or has AI-generated ones

-- Panic in the attic (project has real lyrics, song is NULL)
UPDATE songs SET lyrics = sp.initial_lyrics
FROM songwriting_projects sp
WHERE sp.id = songs.songwriting_project_id
AND songs.id = '643fd4ed-c976-4032-af33-189d09392aa8'
AND sp.initial_lyrics IS NOT NULL AND sp.initial_lyrics != ''
AND sp.initial_lyrics NOT LIKE '[AI Generated]%';

-- Testing it out (project has lyrics, song is EMPTY)
UPDATE songs SET lyrics = sp.initial_lyrics
FROM songwriting_projects sp
WHERE sp.id = songs.songwriting_project_id
AND songs.id = 'cb9f5ac0-e99b-45ba-869a-fe381bd07202'
AND sp.initial_lyrics IS NOT NULL AND sp.initial_lyrics != ''
AND sp.initial_lyrics NOT LIKE '[AI Generated]%';

-- Bulk fix: For ALL songs where project has non-AI lyrics but song has AI-generated lyrics,
-- restore the project lyrics to the song
UPDATE songs SET lyrics = sp.initial_lyrics
FROM songwriting_projects sp
WHERE sp.id = songs.songwriting_project_id
AND sp.initial_lyrics IS NOT NULL AND sp.initial_lyrics != ''
AND sp.initial_lyrics NOT LIKE '[AI Generated]%'
AND (songs.lyrics IS NULL OR songs.lyrics = '' OR songs.lyrics LIKE '[AI Generated]%' OR songs.lyrics LIKE '%[AI Generated]%');