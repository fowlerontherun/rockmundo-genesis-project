-- Add parent_song_id and version columns to songs table
-- This allows acoustic/remix recordings to be stored as separate songs

ALTER TABLE songs 
ADD COLUMN IF NOT EXISTS parent_song_id UUID REFERENCES songs(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS version TEXT DEFAULT 'standard';

-- Add check constraint for version column
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'songs_version_check'
  ) THEN
    ALTER TABLE songs ADD CONSTRAINT songs_version_check 
      CHECK (version IN ('standard', 'remix', 'acoustic'));
  END IF;
END $$;

-- Add index for faster version lookups
CREATE INDEX IF NOT EXISTS idx_songs_parent_song_id ON songs(parent_song_id);
CREATE INDEX IF NOT EXISTS idx_songs_version ON songs(version);

-- Add comments for documentation
COMMENT ON COLUMN songs.parent_song_id IS 'Reference to the original song if this is a remix/acoustic version';
COMMENT ON COLUMN songs.version IS 'Version type: standard (original), remix, or acoustic';