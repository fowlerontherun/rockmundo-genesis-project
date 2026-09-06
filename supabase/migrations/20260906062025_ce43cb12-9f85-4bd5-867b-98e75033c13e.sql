CREATE OR REPLACE FUNCTION public.can_manage_band_setlists(_band_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.band_members bm
    WHERE bm.band_id = _band_id
      AND COALESCE(bm.member_status, 'active')::text = 'active'
      AND (
        bm.user_id = auth.uid()
        OR (bm.profile_id IS NOT NULL AND bm.profile_id IN (
          SELECT p.id FROM public.profiles p WHERE p.user_id = auth.uid()
        ))
      )
  )
  OR EXISTS (
    SELECT 1
    FROM public.bands b
    JOIN public.profiles p ON p.id = b.leader_id
    WHERE b.id = _band_id AND p.user_id = auth.uid()
  );
$$;

GRANT EXECUTE ON FUNCTION public.can_manage_band_setlists(uuid) TO authenticated;

DROP POLICY IF EXISTS "Band members can view their setlists" ON public.setlists;
DROP POLICY IF EXISTS "Band members can create setlists" ON public.setlists;
DROP POLICY IF EXISTS "Band members can update their setlists" ON public.setlists;
DROP POLICY IF EXISTS "Band members can delete their setlists" ON public.setlists;

CREATE POLICY "Band members can view their setlists" ON public.setlists
FOR SELECT TO authenticated
USING (public.can_manage_band_setlists(band_id));

CREATE POLICY "Band members can create setlists" ON public.setlists
FOR INSERT TO authenticated
WITH CHECK (public.can_manage_band_setlists(band_id));

CREATE POLICY "Band members can update their setlists" ON public.setlists
FOR UPDATE TO authenticated
USING (public.can_manage_band_setlists(band_id))
WITH CHECK (public.can_manage_band_setlists(band_id));

CREATE POLICY "Band members can delete their setlists" ON public.setlists
FOR DELETE TO authenticated
USING (public.can_manage_band_setlists(band_id));

DROP POLICY IF EXISTS "Band members can view their setlist songs" ON public.setlist_songs;
DROP POLICY IF EXISTS "Band members can delete setlist songs" ON public.setlist_songs;
DROP POLICY IF EXISTS "Band members can remove songs from setlists" ON public.setlist_songs;

CREATE POLICY "Band members can view their setlist songs" ON public.setlist_songs
FOR SELECT TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.setlists s
  WHERE s.id = setlist_songs.setlist_id
    AND public.can_manage_band_setlists(s.band_id)
));

CREATE POLICY "Band members can delete setlist songs" ON public.setlist_songs
FOR DELETE TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.setlists s
  WHERE s.id = setlist_songs.setlist_id
    AND public.can_manage_band_setlists(s.band_id)
));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.setlists TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.setlist_songs TO authenticated;
GRANT ALL ON public.setlists TO service_role;
GRANT ALL ON public.setlist_songs TO service_role;