-- 1. band_fame_events: allow band members to INSERT
CREATE POLICY "Band members can insert fame events"
ON public.band_fame_events
FOR INSERT
WITH CHECK (
  band_id IN (
    SELECT bm.band_id FROM band_members bm WHERE bm.user_id = auth.uid()
  )
);

-- 2. bands: allow band members to UPDATE (for fame/fan/balance updates after performances)
DROP POLICY IF EXISTS "Band leaders can update their bands" ON public.bands;
CREATE POLICY "Band members can update their bands"
ON public.bands
FOR UPDATE
USING (
  id IN (
    SELECT bm.band_id FROM band_members bm WHERE bm.user_id = auth.uid()
  )
);

-- 3. songs: allow band members to UPDATE band songs (for post-performance stat bumps)
CREATE POLICY "Band members can update band songs"
ON public.songs
FOR UPDATE
USING (
  band_id IN (
    SELECT bm.band_id FROM band_members bm WHERE bm.user_id = auth.uid()
  )
);

-- 4. song_releases: allow band members to SELECT and UPDATE their band's releases
CREATE POLICY "Band members can view band releases"
ON public.song_releases
FOR SELECT
USING (
  song_id IN (
    SELECT s.id FROM songs s
    JOIN band_members bm ON bm.band_id = s.band_id
    WHERE bm.user_id = auth.uid()
  )
);

CREATE POLICY "Band members can update band releases"
ON public.song_releases
FOR UPDATE
USING (
  song_id IN (
    SELECT s.id FROM songs s
    JOIN band_members bm ON bm.band_id = s.band_id
    WHERE bm.user_id = auth.uid()
  )
);

-- 5. festival_participants: allow performing members to update their own participation
CREATE POLICY "Band members can update own participations"
ON public.festival_participants
FOR UPDATE
USING (
  band_id IN (
    SELECT bm.band_id FROM band_members bm WHERE bm.user_id = auth.uid()
  )
);

-- 6. player_scheduled_activities: also allow SELECT by profile_id for conflict checks
-- The conflict hook queries by profile_id but RLS checks user_id
CREATE POLICY "Users can view activities by profile"
ON public.player_scheduled_activities
FOR SELECT
USING (
  profile_id IN (
    SELECT id FROM profiles WHERE user_id = auth.uid()
  )
);