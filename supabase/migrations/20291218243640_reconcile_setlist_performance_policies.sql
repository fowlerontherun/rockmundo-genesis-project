-- Reconcile setlist and performance-catalogue policies for databases where the
-- historical migration targeted a nonexistent public.performance_items table.

ALTER TABLE public.setlist_songs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Band members can view setlist songs"
  ON public.setlist_songs;
DROP POLICY IF EXISTS "Band leaders can manage setlist songs"
  ON public.setlist_songs;
DROP POLICY IF EXISTS "Band members can add songs to setlists"
  ON public.setlist_songs;
DROP POLICY IF EXISTS "Band members can view their setlist songs"
  ON public.setlist_songs;
DROP POLICY IF EXISTS "Band members can insert setlist songs"
  ON public.setlist_songs;
DROP POLICY IF EXISTS "Band members can update setlist songs"
  ON public.setlist_songs;
DROP POLICY IF EXISTS "Band members can delete setlist songs"
  ON public.setlist_songs;

CREATE POLICY "Band members can view their setlist songs"
  ON public.setlist_songs
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.setlists s
      JOIN public.band_members bm ON bm.band_id = s.band_id
      WHERE s.id = setlist_songs.setlist_id
        AND bm.user_id = auth.uid()
    )
  );

CREATE POLICY "Band members can insert setlist songs"
  ON public.setlist_songs
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.setlists s
      JOIN public.band_members bm ON bm.band_id = s.band_id
      WHERE s.id = setlist_songs.setlist_id
        AND bm.user_id = auth.uid()
    )
  );

CREATE POLICY "Band members can update setlist songs"
  ON public.setlist_songs
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1
      FROM public.setlists s
      JOIN public.band_members bm ON bm.band_id = s.band_id
      WHERE s.id = setlist_songs.setlist_id
        AND bm.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.setlists s
      JOIN public.band_members bm ON bm.band_id = s.band_id
      WHERE s.id = setlist_songs.setlist_id
        AND bm.user_id = auth.uid()
    )
  );

CREATE POLICY "Band members can delete setlist songs"
  ON public.setlist_songs
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1
      FROM public.setlists s
      JOIN public.band_members bm ON bm.band_id = s.band_id
      WHERE s.id = setlist_songs.setlist_id
        AND bm.user_id = auth.uid()
    )
  );

ALTER TABLE public.performance_items_catalog ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Performance items are viewable by everyone"
  ON public.performance_items_catalog;
DROP POLICY IF EXISTS "Everyone can view performance items catalog"
  ON public.performance_items_catalog;
CREATE POLICY "Everyone can view performance items catalog"
  ON public.performance_items_catalog
  FOR SELECT
  USING (true);

NOTIFY pgrst, 'reload schema';
