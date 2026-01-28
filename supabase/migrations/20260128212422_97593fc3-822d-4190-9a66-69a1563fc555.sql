-- Drop duplicate constraint (keep one)
ALTER TABLE setlist_songs DROP CONSTRAINT IF EXISTS unique_setlist_song_position;

-- Make the position constraint deferrable so RPC can work atomically
ALTER TABLE setlist_songs DROP CONSTRAINT IF EXISTS setlist_songs_setlist_section_position_key;
ALTER TABLE setlist_songs ADD CONSTRAINT setlist_songs_setlist_section_position_key 
  UNIQUE (setlist_id, section, position) DEFERRABLE INITIALLY DEFERRED;

-- Update the reorder function to use deferred constraints properly
CREATE OR REPLACE FUNCTION reorder_setlist_items(p_setlist_id UUID, p_updates JSONB)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_update RECORD;
BEGIN
  -- With deferred constraint, we can directly set new positions
  -- The constraint is only checked at transaction commit
  FOR v_update IN SELECT * FROM jsonb_to_recordset(p_updates) AS x(id UUID, position INT, section TEXT)
  LOOP
    UPDATE setlist_songs
    SET 
      position = v_update.position,
      section = COALESCE(v_update.section, section)
    WHERE id = v_update.id
    AND setlist_id = p_setlist_id;
  END LOOP;
END;
$$;