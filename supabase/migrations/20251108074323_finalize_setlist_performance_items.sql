-- Finalise setlist performance-item integrity after the catalogue exists.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'setlist_songs_performance_item_id_fkey'
      AND conrelid = 'public.setlist_songs'::regclass
  ) THEN
    ALTER TABLE public.setlist_songs
      ADD CONSTRAINT setlist_songs_performance_item_id_fkey
      FOREIGN KEY (performance_item_id)
      REFERENCES public.performance_items_catalog(id)
      ON DELETE SET NULL;
  END IF;
END
$$;

ALTER TABLE public.setlist_songs
  DROP CONSTRAINT IF EXISTS setlist_songs_unique_song;

ALTER TABLE public.setlist_songs
  ADD CONSTRAINT setlist_songs_unique_song
  CHECK (
    (item_type = 'song' AND song_id IS NOT NULL AND performance_item_id IS NULL)
    OR
    (item_type = 'performance_item' AND song_id IS NULL AND performance_item_id IS NOT NULL)
  );

CREATE INDEX IF NOT EXISTS idx_setlist_songs_performance_item
  ON public.setlist_songs (performance_item_id)
  WHERE item_type = 'performance_item';

CREATE INDEX IF NOT EXISTS idx_setlist_songs_section_position
  ON public.setlist_songs (setlist_id, section, position);

NOTIFY pgrst, 'reload schema';
