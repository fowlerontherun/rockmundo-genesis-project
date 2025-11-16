-- Fix setlist_songs and performance_items RLS policies to allow all band members

-- Drop existing restrictive policies on setlist_songs if they exist
DROP POLICY IF EXISTS "Band members can view setlist songs" ON setlist_songs;
DROP POLICY IF EXISTS "Band leaders can manage setlist songs" ON setlist_songs;
DROP POLICY IF EXISTS "Band members can add songs to setlists" ON setlist_songs;
DROP POLICY IF EXISTS "Band members can update setlist songs" ON setlist_songs;
DROP POLICY IF EXISTS "Band members can delete setlist songs" ON setlist_songs;

-- Create permissive policies for all band members
CREATE POLICY "Band members can view their setlist songs"
  ON setlist_songs FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM setlists s
      JOIN band_members bm ON bm.band_id = s.band_id
      WHERE s.id = setlist_songs.setlist_id
      AND bm.user_id = auth.uid()
    )
  );

CREATE POLICY "Band members can insert setlist songs"
  ON setlist_songs FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM setlists s
      JOIN band_members bm ON bm.band_id = s.band_id
      WHERE s.id = setlist_songs.setlist_id
      AND bm.user_id = auth.uid()
    )
  );

CREATE POLICY "Band members can update setlist songs"
  ON setlist_songs FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM setlists s
      JOIN band_members bm ON bm.band_id = s.band_id
      WHERE s.id = setlist_songs.setlist_id
      AND bm.user_id = auth.uid()
    )
  );

CREATE POLICY "Band members can delete setlist songs"
  ON setlist_songs FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM setlists s
      JOIN band_members bm ON bm.band_id = s.band_id
      WHERE s.id = setlist_songs.setlist_id
      AND bm.user_id = auth.uid()
    )
  );

-- Also ensure performance_items table allows viewing by all users
DROP POLICY IF EXISTS "Performance items are viewable by everyone" ON performance_items;

CREATE POLICY "Performance items are viewable by everyone"
  ON performance_items FOR SELECT
  USING (true);