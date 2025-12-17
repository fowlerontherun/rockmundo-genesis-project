-- Create song_plays table for tracking unique plays per user
CREATE TABLE public.song_plays (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  song_id UUID REFERENCES songs(id) ON DELETE CASCADE NOT NULL,
  user_id UUID NOT NULL,
  played_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  source TEXT DEFAULT 'app',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create unique constraint - each user can only count as one play per song
CREATE UNIQUE INDEX idx_song_plays_unique_user ON song_plays(song_id, user_id);

-- Enable RLS
ALTER TABLE public.song_plays ENABLE ROW LEVEL SECURITY;

-- Anyone can view play counts (needed for charts)
CREATE POLICY "Anyone can view song plays"
ON public.song_plays FOR SELECT
USING (true);

-- Authenticated users can insert their own plays
CREATE POLICY "Users can record their own plays"
ON public.song_plays FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Create function to get top played songs with anti-gaming
-- For band songs, only count ONE play from all band members combined
CREATE OR REPLACE FUNCTION public.get_top_played_songs(p_limit INTEGER DEFAULT 10)
RETURNS TABLE (
  song_id UUID,
  title TEXT,
  band_id UUID,
  band_name TEXT,
  audio_url TEXT,
  unique_plays BIGINT,
  quality_score INTEGER,
  genre TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  WITH band_member_plays AS (
    -- For each play, check if user is a member of the song's band
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
    -- Count plays, but for band members only count ONE per band
    SELECT 
      bmp.song_id,
      CASE 
        -- If user is a band member, use band_id as the grouping key (so all members count as 1)
        WHEN bmp.member_band_id IS NOT NULL THEN 'band_' || bmp.member_band_id::TEXT
        -- If not a band member, use user_id
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
    s.title,
    s.band_id,
    b.name AS band_name,
    s.audio_url,
    COALESCE(pc.unique_plays, 0) AS unique_plays,
    s.quality_score,
    s.genre
  FROM songs s
  LEFT JOIN bands b ON b.id = s.band_id
  LEFT JOIN play_counts pc ON pc.song_id = s.id
  WHERE s.audio_url IS NOT NULL
  ORDER BY COALESCE(pc.unique_plays, 0) DESC, s.quality_score DESC
  LIMIT p_limit;
END;
$$;

-- Create index for performance
CREATE INDEX idx_song_plays_song_id ON song_plays(song_id);
CREATE INDEX idx_song_plays_user_id ON song_plays(user_id);
CREATE INDEX idx_song_plays_played_at ON song_plays(played_at DESC);