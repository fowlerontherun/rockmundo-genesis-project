-- Reconcile music-video ownership policies for databases where the historical
-- migration referenced the removed songs.user_id column.

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
            SELECT 1 FROM public.band_members bm
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
            SELECT 1 FROM public.band_members bm
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
            SELECT 1 FROM public.band_members bm
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
            SELECT 1 FROM public.band_members bm
            WHERE bm.band_id = s.band_id
              AND bm.user_id = auth.uid()
          )
        )
    )
  );

DROP TRIGGER IF EXISTS update_music_videos_updated_at
  ON public.music_videos;
CREATE TRIGGER update_music_videos_updated_at
  BEFORE UPDATE ON public.music_videos
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

NOTIFY pgrst, 'reload schema';
