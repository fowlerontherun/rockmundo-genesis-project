-- Create atomic reorder function for setlist items
-- This prevents unique constraint violations by using a transaction with temp positions
CREATE OR REPLACE FUNCTION public.reorder_setlist_items(
  p_setlist_id UUID,
  p_updates JSONB
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_update RECORD;
  v_offset INT := 100000;
BEGIN
  -- First, shift all target rows to temporary positions to avoid collisions
  FOR v_update IN SELECT * FROM jsonb_to_recordset(p_updates) AS x(id UUID, position INT, section TEXT)
  LOOP
    UPDATE setlist_songs
    SET position = position + v_offset
    WHERE id = v_update.id
    AND setlist_id = p_setlist_id;
  END LOOP;
  
  -- Then set the final positions
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

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.reorder_setlist_items(UUID, JSONB) TO authenticated;