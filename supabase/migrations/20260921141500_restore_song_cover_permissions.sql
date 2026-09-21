-- Restore authenticated cover-song writes and align authorization with active character membership.
GRANT SELECT, INSERT, DELETE ON TABLE public.song_covers TO authenticated;
GRANT ALL ON TABLE public.song_covers TO service_role;

DROP POLICY IF EXISTS "Band members can create covers" ON public.song_covers;
CREATE POLICY "Band members can create covers"
ON public.song_covers
FOR INSERT
TO authenticated
WITH CHECK (
  public._band_active_member(
    song_covers.covering_band_id,
    public._caller_profile_id()
  )
);

DROP POLICY IF EXISTS "Band members can delete their covers" ON public.song_covers;
CREATE POLICY "Band members can delete their covers"
ON public.song_covers
FOR DELETE
TO authenticated
USING (
  public._band_active_member(
    song_covers.covering_band_id,
    public._caller_profile_id()
  )
);
