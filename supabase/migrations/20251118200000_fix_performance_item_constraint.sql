-- Allow multiple performance items in the same setlist section
-- Previously, the unique_setlist_song_item constraint treated NULL song_ids as equal,
-- causing performance items (which have NULL song_id) to conflict with each other.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'unique_setlist_song_item'
  ) THEN
    ALTER TABLE setlist_songs DROP CONSTRAINT unique_setlist_song_item;
  END IF;
END $$;

-- Enforce uniqueness using either song_id or performance_item_id depending on item_type
CREATE UNIQUE INDEX IF NOT EXISTS unique_setlist_item_per_section
ON setlist_songs (
  setlist_id,
  COALESCE(song_id, performance_item_id),
  section,
  item_type
);
