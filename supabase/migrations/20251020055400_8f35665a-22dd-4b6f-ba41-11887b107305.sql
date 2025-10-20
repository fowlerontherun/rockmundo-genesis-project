-- Add duration_seconds to existing songs that don't have it
UPDATE songs
SET duration_seconds = FLOOR(RANDOM() * (420 - 140 + 1) + 140)::int
WHERE duration_seconds IS NULL;