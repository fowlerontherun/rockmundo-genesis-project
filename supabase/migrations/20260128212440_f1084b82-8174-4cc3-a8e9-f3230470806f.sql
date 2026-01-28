-- Create atomic function to add song/item to setlist with safe position calculation
CREATE OR REPLACE FUNCTION add_setlist_item(
  p_setlist_id UUID,
  p_song_id UUID DEFAULT NULL,
  p_performance_item_id UUID DEFAULT NULL,
  p_item_type TEXT DEFAULT 'song',
  p_section TEXT DEFAULT 'main',
  p_notes TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_next_position INT;
  v_new_id UUID;
BEGIN
  -- Lock the setlist_songs table for this setlist to prevent race conditions
  PERFORM 1 FROM setlist_songs WHERE setlist_id = p_setlist_id FOR UPDATE;
  
  -- Check for duplicate song (if adding a song)
  IF p_item_type = 'song' AND p_song_id IS NOT NULL THEN
    IF EXISTS (
      SELECT 1 FROM setlist_songs 
      WHERE setlist_id = p_setlist_id 
      AND song_id = p_song_id
      AND item_type = 'song'
    ) THEN
      RAISE EXCEPTION 'This song is already in the setlist';
    END IF;
  END IF;
  
  -- Get next position for this section
  SELECT COALESCE(MAX(position), 0) + 1 INTO v_next_position
  FROM setlist_songs
  WHERE setlist_id = p_setlist_id AND section = p_section;
  
  -- Insert the new item
  INSERT INTO setlist_songs (
    setlist_id, song_id, performance_item_id, item_type, section, position, notes
  ) VALUES (
    p_setlist_id, p_song_id, p_performance_item_id, p_item_type, p_section, v_next_position, p_notes
  ) RETURNING id INTO v_new_id;
  
  RETURN v_new_id;
END;
$$;