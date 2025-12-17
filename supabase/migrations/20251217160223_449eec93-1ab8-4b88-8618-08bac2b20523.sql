-- Fix type mismatch in get_top_played_songs function
-- The bands.name column is varchar(100) but function expects text

DROP FUNCTION IF EXISTS get_top_played_songs(integer);

CREATE OR REPLACE FUNCTION get_top_played_songs(p_limit integer DEFAULT 10)
RETURNS TABLE (
  song_id uuid,
  title text,
  band_id uuid,
  band_name text,
  audio_url text,
  unique_plays bigint,
  quality_score integer,
  genre text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  WITH band_member_plays AS (
    SELECT 
      sp.song_id,
      sp.user_id,
      s.band_id AS song_band_id,
      bm.band_id AS member_band_id
    FROM song_plays sp
    JOIN songs s ON s.id = sp.song_id
    LEFT JOIN band_members bm ON bm.user_id = sp.user_id AND bm.band_id = s.band_id
  ),
  filtered_plays AS (
    SELECT 
      bmp.song_id,
      CASE 
        WHEN bmp.member_band_id IS NOT NULL THEN 'band_' || bmp.member_band_id::TEXT
        ELSE 'user_' || bmp.user_id::TEXT
      END AS play_key
    FROM band_member_plays bmp
  ),
  play_counts AS (
    SELECT 
      fp.song_id,
      COUNT(DISTINCT fp.play_key) AS unique_plays
    FROM filtered_plays fp
    GROUP BY fp.song_id
  )
  SELECT 
    s.id AS song_id,
    s.title::text,
    s.band_id,
    b.name::text AS band_name,
    s.audio_url::text,
    COALESCE(pc.unique_plays, 0)::bigint AS unique_plays,
    s.quality_score::integer,
    s.genre::text
  FROM songs s
  LEFT JOIN bands b ON b.id = s.band_id
  LEFT JOIN play_counts pc ON pc.song_id = s.id
  WHERE s.audio_url IS NOT NULL
  ORDER BY COALESCE(pc.unique_plays, 0) DESC, s.quality_score DESC
  LIMIT p_limit;
END;
$$;