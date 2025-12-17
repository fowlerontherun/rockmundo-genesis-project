-- Update audio URL to new filename for cache busting
UPDATE songs 
SET audio_url = '/music/christmas-mothercluckers-v2.mp3'
WHERE title ILIKE '%Christmas MotherCluckers%' 
   OR title ILIKE '%christmas mother cluckers%';