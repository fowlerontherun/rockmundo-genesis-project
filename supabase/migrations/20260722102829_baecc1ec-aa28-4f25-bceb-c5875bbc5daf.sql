-- Fix setlist unique constraint so multiple performance items can coexist.
-- The prior constraint treated NULL song_id as equal (NULLS NOT DISTINCT),
-- causing collisions on the 2nd performance item in a section.

ALTER TABLE public.setlist_songs
  DROP CONSTRAINT IF EXISTS unique_setlist_song_item;

-- Prevent duplicate songs in same section
CREATE UNIQUE INDEX IF NOT EXISTS unique_setlist_song_in_section
  ON public.setlist_songs (setlist_id, section, song_id)
  WHERE item_type = 'song' AND song_id IS NOT NULL;

-- Prevent duplicate performance items in same section
CREATE UNIQUE INDEX IF NOT EXISTS unique_setlist_performance_item_in_section
  ON public.setlist_songs (setlist_id, section, performance_item_id)
  WHERE item_type = 'performance_item' AND performance_item_id IS NOT NULL;
