-- Create music_videos table
CREATE TABLE IF NOT EXISTS public.music_videos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  song_id UUID NOT NULL REFERENCES public.songs(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  budget DECIMAL NOT NULL DEFAULT 0,
  production_quality INTEGER NOT NULL DEFAULT 0 CHECK (production_quality >= 0 AND production_quality <= 100),
  director_id UUID,
  status TEXT NOT NULL DEFAULT 'planning' CHECK (status IN ('planning', 'production', 'released')),
  release_date TIMESTAMPTZ,
  views_count BIGINT NOT NULL DEFAULT 0,
  earnings DECIMAL NOT NULL DEFAULT 0,
  hype_score INTEGER NOT NULL DEFAULT 0 CHECK (hype_score >= 0 AND hype_score <= 100),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.music_videos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view all music videos"
  ON public.music_videos;
CREATE POLICY "Users can view all music videos"
  ON public.music_videos
  FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Users can create music videos for their own songs"
  ON public.music_videos;
CREATE POLICY "Users can create music videos for their own songs"
  ON public.music_videos
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.songs s
      WHERE s.id = music_videos.song_id
        AND (
          s.artist_id = auth.uid()
          OR EXISTS (
            SELECT 1
            FROM public.band_members bm
            WHERE bm.band_id = s.band_id
              AND bm.user_id = auth.uid()
          )
        )
    )
  );

DROP POLICY IF EXISTS "Users can update their own music videos"
  ON public.music_videos;
CREATE POLICY "Users can update their own music videos"
  ON public.music_videos
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1
      FROM public.songs s
      WHERE s.id = music_videos.song_id
        AND (
          s.artist_id = auth.uid()
          OR EXISTS (
            SELECT 1
            FROM public.band_members bm
            WHERE bm.band_id = s.band_id
              AND bm.user_id = auth.uid()
          )
        )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.songs s
      WHERE s.id = music_videos.song_id
        AND (
          s.artist_id = auth.uid()
          OR EXISTS (
            SELECT 1
            FROM public.band_members bm
            WHERE bm.band_id = s.band_id
              AND bm.user_id = auth.uid()
          )
        )
    )
  );

DROP POLICY IF EXISTS "Users can delete their own music videos"
  ON public.music_videos;
CREATE POLICY "Users can delete their own music videos"
  ON public.music_videos
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1
      FROM public.songs s
      WHERE s.id = music_videos.song_id
        AND (
          s.artist_id = auth.uid()
          OR EXISTS (
            SELECT 1
            FROM public.band_members bm
            WHERE bm.band_id = s.band_id
              AND bm.user_id = auth.uid()
          )
        )
    )
  );

CREATE INDEX IF NOT EXISTS idx_music_videos_song_id
  ON public.music_videos (song_id);
CREATE INDEX IF NOT EXISTS idx_music_videos_status
  ON public.music_videos (status);
CREATE INDEX IF NOT EXISTS idx_music_videos_hype_score
  ON public.music_videos (hype_score DESC);
CREATE INDEX IF NOT EXISTS idx_music_videos_release_date
  ON public.music_videos (release_date DESC);

DROP TRIGGER IF EXISTS update_music_videos_updated_at
  ON public.music_videos;
CREATE TRIGGER update_music_videos_updated_at
  BEFORE UPDATE ON public.music_videos
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

NOTIFY pgrst, 'reload schema';
