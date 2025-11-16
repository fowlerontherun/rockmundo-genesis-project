-- Add archived column to songs table
ALTER TABLE songs ADD COLUMN IF NOT EXISTS archived BOOLEAN DEFAULT false;

-- Add index for better query performance
CREATE INDEX IF NOT EXISTS idx_songs_archived ON songs(archived) WHERE archived = false;

-- Add a unique constraint to prevent duplicate song entries in the same setlist
-- This will help prevent constraint errors when adding/removing songs
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'unique_setlist_song_position'
    ) THEN
        ALTER TABLE setlist_songs 
        ADD CONSTRAINT unique_setlist_song_position 
        UNIQUE (setlist_id, position, section);
    END IF;
END $$;

-- Add a unique constraint to prevent the same song being added twice to the same setlist section
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'unique_setlist_song_item'
    ) THEN
        -- First check if we have any duplicates and remove them
        DELETE FROM setlist_songs a USING setlist_songs b
        WHERE a.id > b.id 
        AND a.setlist_id = b.setlist_id 
        AND a.song_id = b.song_id 
        AND COALESCE(a.section, 'main') = COALESCE(b.section, 'main')
        AND a.item_type = 'song'
        AND b.item_type = 'song';
        
        -- Now add the constraint
        ALTER TABLE setlist_songs 
        ADD CONSTRAINT unique_setlist_song_item 
        UNIQUE NULLS NOT DISTINCT (setlist_id, song_id, section, item_type);
    END IF;
END $$;

-- Create a comment to explain the archive feature
COMMENT ON COLUMN songs.archived IS 'When true, the song is hidden from setlists, recording options, and music video creation';
