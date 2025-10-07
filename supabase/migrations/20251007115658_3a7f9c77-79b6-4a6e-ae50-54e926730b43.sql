-- Add missing song_rating column to songs table
ALTER TABLE songs ADD COLUMN IF NOT EXISTS song_rating integer;