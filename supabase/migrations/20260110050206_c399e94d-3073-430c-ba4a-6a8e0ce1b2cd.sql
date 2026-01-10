-- Add columns to support album-level chart entries and deduplication
ALTER TABLE chart_entries 
ADD COLUMN IF NOT EXISTS release_id uuid REFERENCES releases(id),
ADD COLUMN IF NOT EXISTS entry_type text DEFAULT 'song' CHECK (entry_type IN ('song', 'album'));

-- Add index for faster lookups
CREATE INDEX IF NOT EXISTS idx_chart_entries_entry_type ON chart_entries(entry_type);
CREATE INDEX IF NOT EXISTS idx_chart_entries_release_id ON chart_entries(release_id);
CREATE INDEX IF NOT EXISTS idx_chart_entries_chart_date ON chart_entries(chart_date DESC);

-- Create a unique constraint to prevent duplicate entries (same song, chart_type, date)
-- This prevents the duplicate song issue at the database level
CREATE UNIQUE INDEX IF NOT EXISTS idx_chart_entries_unique_song_date 
ON chart_entries(song_id, chart_type, chart_date) 
WHERE song_id IS NOT NULL;

-- For album entries, prevent duplicates by release_id
CREATE UNIQUE INDEX IF NOT EXISTS idx_chart_entries_unique_album_date 
ON chart_entries(release_id, chart_type, chart_date) 
WHERE release_id IS NOT NULL AND entry_type = 'album';