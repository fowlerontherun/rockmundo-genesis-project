-- Add support for non-song setlist items

-- Create table for special setlist items
CREATE TABLE IF NOT EXISTS public.setlist_special_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  item_type TEXT NOT NULL CHECK (item_type IN ('skill', 'genre')),
  skill_slug TEXT,
  genre TEXT,
  required_level INTEGER NOT NULL DEFAULT 1 CHECK (required_level >= 0),
  base_rating INTEGER NOT NULL DEFAULT 50,
  scaling NUMERIC NOT NULL DEFAULT 1.0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(name)
);

ALTER TABLE public.setlist_special_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY IF NOT EXISTS "Anyone can view setlist special items"
ON public.setlist_special_items FOR SELECT
USING (true);

-- Extend setlist_songs to support special items
ALTER TABLE public.setlist_songs
  ADD COLUMN IF NOT EXISTS item_type TEXT NOT NULL DEFAULT 'song' CHECK (item_type IN ('song', 'special')),
  ADD COLUMN IF NOT EXISTS special_item_id UUID REFERENCES public.setlist_special_items(id) ON DELETE CASCADE;

ALTER TABLE public.setlist_songs
  ALTER COLUMN song_id DROP NOT NULL;

-- Ensure existing rows default to song entries
UPDATE public.setlist_songs
SET item_type = 'song'
WHERE item_type IS NULL;

ALTER TABLE public.setlist_songs
  ADD CONSTRAINT IF NOT EXISTS setlist_songs_item_choice_check
  CHECK (
    (item_type = 'song' AND song_id IS NOT NULL AND special_item_id IS NULL) OR
    (item_type = 'special' AND special_item_id IS NOT NULL AND song_id IS NULL)
  );

-- Replace uniqueness constraints for mixed item types
ALTER TABLE public.setlist_songs
  DROP CONSTRAINT IF EXISTS setlist_songs_setlist_id_song_id_key;

CREATE UNIQUE INDEX IF NOT EXISTS idx_setlist_songs_song_unique
  ON public.setlist_songs(setlist_id, song_id)
  WHERE item_type = 'song';

CREATE UNIQUE INDEX IF NOT EXISTS idx_setlist_songs_special_unique
  ON public.setlist_songs(setlist_id, special_item_id)
  WHERE item_type = 'special';

CREATE INDEX IF NOT EXISTS idx_setlist_songs_item_type
  ON public.setlist_songs(item_type);

-- Refresh helper function to ignore special items in duration totals
CREATE OR REPLACE FUNCTION get_setlist_total_duration(p_setlist_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql
AS $$
DECLARE
  total_seconds INTEGER := 0;
BEGIN
  SELECT COALESCE(SUM(COALESCE(s.duration_seconds, 180)), 0)
  INTO total_seconds
  FROM setlist_songs ss
  JOIN songs s ON s.id = ss.song_id
  WHERE ss.setlist_id = p_setlist_id
    AND ss.item_type = 'song';

  RETURN total_seconds;
END;
$$;
