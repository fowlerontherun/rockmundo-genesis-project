
-- Drop and recreate the function to check songs used in any release (single or album)
DROP FUNCTION IF EXISTS get_songs_on_albums(uuid, uuid);

CREATE OR REPLACE FUNCTION get_songs_on_releases(p_band_id uuid, p_user_id uuid)
RETURNS TABLE(
  song_id uuid, 
  release_title text, 
  release_id uuid, 
  release_type text,
  is_greatest_hits boolean
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT DISTINCT 
    rs.song_id, 
    r.title as release_title, 
    r.id as release_id,
    r.release_type::text,
    r.is_greatest_hits
  FROM release_songs rs
  JOIN releases r ON rs.release_id = r.id
  WHERE r.release_status != 'cancelled'
    AND r.is_greatest_hits = false  -- Greatest hits don't count for exclusivity
    AND (r.band_id = p_band_id OR r.user_id = p_user_id);
END;
$$;

-- Keep backwards compatibility with old function name
CREATE OR REPLACE FUNCTION get_songs_on_albums(p_band_id uuid, p_user_id uuid)
RETURNS TABLE(song_id uuid, album_title text, release_id uuid)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT rs.song_id, r.title as album_title, r.id as release_id
  FROM release_songs rs
  JOIN releases r ON rs.release_id = r.id
  WHERE r.release_type = 'album'
    AND r.is_greatest_hits = false
    AND r.release_status != 'cancelled'
    AND (r.band_id = p_band_id OR r.user_id = p_user_id);
END;
$$;
