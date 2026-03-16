-- Ensure band leaders and profile-based members can access setlists and related rows.

-- setlists policies
DROP POLICY IF EXISTS "Band members can view their setlists" ON public.setlists;
DROP POLICY IF EXISTS "Band members can create setlists" ON public.setlists;
DROP POLICY IF EXISTS "Band members can update their setlists" ON public.setlists;
DROP POLICY IF EXISTS "Band members can delete their setlists" ON public.setlists;

CREATE POLICY "Band members can view their setlists"
ON public.setlists FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM public.bands b
    LEFT JOIN public.band_members bm ON bm.band_id = b.id
    WHERE b.id = setlists.band_id
      AND (
        b.leader_id = auth.uid()
        OR bm.user_id = auth.uid()
        OR bm.profile_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid())
      )
  )
);

CREATE POLICY "Band members can create setlists"
ON public.setlists FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.bands b
    LEFT JOIN public.band_members bm ON bm.band_id = b.id
    WHERE b.id = setlists.band_id
      AND (
        b.leader_id = auth.uid()
        OR bm.user_id = auth.uid()
        OR bm.profile_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid())
      )
  )
);

CREATE POLICY "Band members can update their setlists"
ON public.setlists FOR UPDATE
USING (
  EXISTS (
    SELECT 1
    FROM public.bands b
    LEFT JOIN public.band_members bm ON bm.band_id = b.id
    WHERE b.id = setlists.band_id
      AND (
        b.leader_id = auth.uid()
        OR bm.user_id = auth.uid()
        OR bm.profile_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid())
      )
  )
);

CREATE POLICY "Band members can delete their setlists"
ON public.setlists FOR DELETE
USING (
  EXISTS (
    SELECT 1
    FROM public.bands b
    LEFT JOIN public.band_members bm ON bm.band_id = b.id
    WHERE b.id = setlists.band_id
      AND (
        b.leader_id = auth.uid()
        OR bm.user_id = auth.uid()
        OR bm.profile_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid())
      )
  )
);

-- setlist_songs policies
DROP POLICY IF EXISTS "Band members can view setlist songs" ON public.setlist_songs;
DROP POLICY IF EXISTS "Band members can add songs to setlists" ON public.setlist_songs;
DROP POLICY IF EXISTS "Band members can update setlist songs" ON public.setlist_songs;
DROP POLICY IF EXISTS "Band members can remove songs from setlists" ON public.setlist_songs;

CREATE POLICY "Band members can view setlist songs"
ON public.setlist_songs FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM public.setlists s
    JOIN public.bands b ON b.id = s.band_id
    LEFT JOIN public.band_members bm ON bm.band_id = b.id
    WHERE s.id = setlist_songs.setlist_id
      AND (
        b.leader_id = auth.uid()
        OR bm.user_id = auth.uid()
        OR bm.profile_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid())
      )
  )
);

CREATE POLICY "Band members can add songs to setlists"
ON public.setlist_songs FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.setlists s
    JOIN public.bands b ON b.id = s.band_id
    LEFT JOIN public.band_members bm ON bm.band_id = b.id
    WHERE s.id = setlist_songs.setlist_id
      AND (
        b.leader_id = auth.uid()
        OR bm.user_id = auth.uid()
        OR bm.profile_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid())
      )
  )
);

CREATE POLICY "Band members can update setlist songs"
ON public.setlist_songs FOR UPDATE
USING (
  EXISTS (
    SELECT 1
    FROM public.setlists s
    JOIN public.bands b ON b.id = s.band_id
    LEFT JOIN public.band_members bm ON bm.band_id = b.id
    WHERE s.id = setlist_songs.setlist_id
      AND (
        b.leader_id = auth.uid()
        OR bm.user_id = auth.uid()
        OR bm.profile_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid())
      )
  )
);

CREATE POLICY "Band members can remove songs from setlists"
ON public.setlist_songs FOR DELETE
USING (
  EXISTS (
    SELECT 1
    FROM public.setlists s
    JOIN public.bands b ON b.id = s.band_id
    LEFT JOIN public.band_members bm ON bm.band_id = b.id
    WHERE s.id = setlist_songs.setlist_id
      AND (
        b.leader_id = auth.uid()
        OR bm.user_id = auth.uid()
        OR bm.profile_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid())
      )
  )
);

-- setlist_performance_items policies
DROP POLICY IF EXISTS "Users can view performance items in their setlists" ON public.setlist_performance_items;
DROP POLICY IF EXISTS "Users can manage performance items in their setlists" ON public.setlist_performance_items;

CREATE POLICY "Users can view performance items in their setlists"
  ON public.setlist_performance_items FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.setlists s
      JOIN public.bands b ON b.id = s.band_id
      LEFT JOIN public.band_members bm ON bm.band_id = b.id
      WHERE s.id = setlist_performance_items.setlist_id
        AND (
          b.leader_id = auth.uid()
          OR bm.user_id = auth.uid()
          OR bm.profile_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid())
        )
    )
  );

CREATE POLICY "Users can manage performance items in their setlists"
  ON public.setlist_performance_items FOR ALL
  USING (
    EXISTS (
      SELECT 1
      FROM public.setlists s
      JOIN public.bands b ON b.id = s.band_id
      LEFT JOIN public.band_members bm ON bm.band_id = b.id
      WHERE s.id = setlist_performance_items.setlist_id
        AND (
          b.leader_id = auth.uid()
          OR bm.user_id = auth.uid()
          OR bm.profile_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid())
        )
    )
  );
