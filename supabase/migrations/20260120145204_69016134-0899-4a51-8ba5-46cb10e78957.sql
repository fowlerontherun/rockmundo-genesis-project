-- Drop the existing constraint that doesn't include section
ALTER TABLE public.setlist_songs DROP CONSTRAINT IF EXISTS setlist_songs_setlist_id_position_key;

-- Add a new unique constraint that includes section
-- This allows position 1 in 'main' and position 1 in 'encore' for the same setlist
ALTER TABLE public.setlist_songs ADD CONSTRAINT setlist_songs_setlist_section_position_key UNIQUE (setlist_id, section, position);