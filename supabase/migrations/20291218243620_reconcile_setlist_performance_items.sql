-- Reconcile setlist performance-item compatibility for databases where the
-- historical catalogue migration ran against a smaller song-only setlist table.

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
      CHECK (item_type IN ('song', 'performance_item'))
      NOT VALID;
  END IF;

  IF to_regclass('public.performance_items_catalog') IS NOT NULL
     AND NOT EXISTS (
       SELECT 1
       FROM pg_constraint
       WHERE conname = 'setlist_songs_performance_item_id_fkey'
         AND conrelid = 'public.setlist_songs'::regclass
     ) THEN
    ALTER TABLE public.setlist_songs
      ADD CONSTRAINT setlist_songs_performance_item_id_fkey
      FOREIGN KEY (performance_item_id)
      REFERENCES public.performance_items_catalog(id)
      ON DELETE SET NULL
      NOT VALID;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'setlist_songs_unique_song'
      AND conrelid = 'public.setlist_songs'::regclass
  ) THEN
    ALTER TABLE public.setlist_songs
      ADD CONSTRAINT setlist_songs_unique_song
      CHECK (
        (item_type = 'song' AND song_id IS NOT NULL AND performance_item_id IS NULL)
        OR
        (item_type = 'performance_item' AND song_id IS NULL AND performance_item_id IS NOT NULL)
      )
      NOT VALID;
  END IF;
END
$$;

CREATE INDEX IF NOT EXISTS idx_setlist_songs_performance_item
  ON public.setlist_songs (performance_item_id)
  WHERE item_type = 'performance_item';

CREATE INDEX IF NOT EXISTS idx_setlist_songs_section_position
  ON public.setlist_songs (setlist_id, section, position);

NOTIFY pgrst, 'reload schema';
