-- Prepare the established setlist_songs table for the performance-item catalogue
-- created by the immediately following migration.

ALTER TABLE public.setlist_songs
  ADD COLUMN IF NOT EXISTS item_type text NOT NULL DEFAULT 'song',
  ADD COLUMN IF NOT EXISTS performance_item_id uuid,
  ADD COLUMN IF NOT EXISTS section text NOT NULL DEFAULT 'main',
  ADD COLUMN IF NOT EXISTS is_encore boolean NOT NULL DEFAULT false;

ALTER TABLE public.setlist_songs
  ALTER COLUMN song_id DROP NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'setlist_songs_item_type_check'
      AND conrelid = 'public.setlist_songs'::regclass
  ) THEN
    ALTER TABLE public.setlist_songs
      ADD CONSTRAINT setlist_songs_item_type_check
      CHECK (item_type IN ('song', 'performance_item'));
  END IF;
END
$$;

-- The original song-only uniqueness constraint prevents multiple rows where
-- song_id is NULL. The following catalogue migration replaces it with the
-- appropriate song/performance-item rules.
ALTER TABLE public.setlist_songs
  DROP CONSTRAINT IF EXISTS setlist_songs_setlist_id_song_id_key;

CREATE INDEX IF NOT EXISTS idx_setlist_songs_section_position
  ON public.setlist_songs (setlist_id, section, position);

NOTIFY pgrst, 'reload schema';
