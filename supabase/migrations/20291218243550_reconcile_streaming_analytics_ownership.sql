-- Reconcile streaming analytics ownership and write authority for databases
-- where the historical policy referenced the removed songs.user_id column.

ALTER TABLE public.streaming_analytics_daily ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own streaming analytics"
  ON public.streaming_analytics_daily;
CREATE POLICY "Users can view their own streaming analytics"
  ON public.streaming_analytics_daily
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.song_releases sr
      JOIN public.songs s ON s.id = sr.song_id
      WHERE sr.id = streaming_analytics_daily.song_release_id
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

DROP POLICY IF EXISTS "System can insert streaming analytics"
  ON public.streaming_analytics_daily;
CREATE POLICY "System can insert streaming analytics"
  ON public.streaming_analytics_daily
  FOR INSERT
  TO service_role
  WITH CHECK (true);

NOTIFY pgrst, 'reload schema';
