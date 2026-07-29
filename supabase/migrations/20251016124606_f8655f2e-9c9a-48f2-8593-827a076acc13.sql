-- Add profile-oriented compatibility fields to songs without changing the
-- authoritative auth-user ownership stored in songs.artist_id.
ALTER TABLE public.songs
  ADD COLUMN IF NOT EXISTS rating_revealed_at timestamptz,
  ADD COLUMN IF NOT EXISTS profile_id uuid REFERENCES public.profiles(id);

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS current_activity text;

CREATE INDEX IF NOT EXISTS idx_songs_profile_id
  ON public.songs (profile_id);

-- artist_id is the established auth.users owner. Resolve the corresponding
-- character profile through profiles.user_id; songs.user_id never existed in
-- the authoritative schema.
UPDATE public.songs s
SET profile_id = p.id
FROM public.profiles p
WHERE s.artist_id = p.user_id
  AND s.profile_id IS NULL;

DROP POLICY IF EXISTS "Band members can view band songs"
  ON public.songs;
CREATE POLICY "Band members can view band songs"
  ON public.songs
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.band_members bm
      WHERE bm.band_id = songs.band_id
        AND bm.user_id = auth.uid()
    )
  );

CREATE OR REPLACE VIEW public.band_gift_notifications AS
SELECT
  asg.id,
  asg.created_at,
  asg.gift_message,
  asg.gifted_to_band_id,
  b.name AS band_name,
  s.id AS song_id,
  s.title AS song_title,
  s.genre,
  s.song_rating,
  s.quality_score,
  FALSE AS viewed
FROM public.admin_song_gifts asg
JOIN public.songs s ON s.id = asg.song_id
JOIN public.bands b ON b.id = asg.gifted_to_band_id
WHERE asg.gifted_to_band_id IS NOT NULL;

NOTIFY pgrst, 'reload schema';
