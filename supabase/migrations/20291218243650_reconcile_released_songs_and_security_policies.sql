-- Reconcile the released-song view and the December security-policy bundle for
-- databases where the historical migration used the removed songs.user_id
-- column or installed non-replay-safe policies.

CREATE OR REPLACE VIEW public.released_songs
WITH (security_invoker = true) AS
SELECT
  s.id,
  s.title,
  s.genre,
  s.band_id,
  s.artist_id AS user_id,
  s.quality_score,
  s.song_rating,
  s.status,
  s.created_at,
  s.updated_at
FROM public.songs s
WHERE s.status = 'released';

ALTER TABLE public.audience_memory ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.band_conflicts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gig_analytics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gig_offers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.multiplayer_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.player_daily_cats ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.promoters ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stage_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tour_gigs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tour_logistics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.venue_relationships ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Band members can view audience memory"
  ON public.audience_memory;
CREATE POLICY "Band members can view audience memory"
  ON public.audience_memory
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.band_members bm
      WHERE bm.band_id = audience_memory.band_id
        AND bm.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Band members can view band conflicts"
  ON public.band_conflicts;
CREATE POLICY "Band members can view band conflicts"
  ON public.band_conflicts
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.band_members bm
      WHERE bm.band_id = band_conflicts.band_id
        AND bm.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Band members can view gig analytics"
  ON public.gig_analytics;
CREATE POLICY "Band members can view gig analytics"
  ON public.gig_analytics
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.gigs g
      JOIN public.band_members bm ON bm.band_id = g.band_id
      WHERE g.id = gig_analytics.gig_id
        AND bm.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Band members can view gig offers"
  ON public.gig_offers;
CREATE POLICY "Band members can view gig offers"
  ON public.gig_offers
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.band_members bm
      WHERE bm.band_id = gig_offers.band_id
        AND bm.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Band leaders can update gig offers"
  ON public.gig_offers;
CREATE POLICY "Band leaders can update gig offers"
  ON public.gig_offers
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.bands b
      WHERE b.id = gig_offers.band_id
        AND b.leader_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.bands b
      WHERE b.id = gig_offers.band_id
        AND b.leader_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Everyone can view multiplayer events"
  ON public.multiplayer_events;
CREATE POLICY "Everyone can view multiplayer events"
  ON public.multiplayer_events
  FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Users can view own daily cats"
  ON public.player_daily_cats;
CREATE POLICY "Users can view own daily cats"
  ON public.player_daily_cats
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = player_daily_cats.profile_id
        AND p.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can insert own daily cats"
  ON public.player_daily_cats;
CREATE POLICY "Users can insert own daily cats"
  ON public.player_daily_cats
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = player_daily_cats.profile_id
        AND p.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can update own daily cats"
  ON public.player_daily_cats;
CREATE POLICY "Users can update own daily cats"
  ON public.player_daily_cats
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = player_daily_cats.profile_id
        AND p.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = player_daily_cats.profile_id
        AND p.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Everyone can view promoters"
  ON public.promoters;
CREATE POLICY "Everyone can view promoters"
  ON public.promoters
  FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Band members can view stage events"
  ON public.stage_events;
CREATE POLICY "Band members can view stage events"
  ON public.stage_events
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.gigs g
      JOIN public.band_members bm ON bm.band_id = g.band_id
      WHERE g.id = stage_events.gig_id
        AND bm.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Band members can view tour gigs"
  ON public.tour_gigs;
CREATE POLICY "Band members can view tour gigs"
  ON public.tour_gigs
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.tours t
      JOIN public.band_members bm ON bm.band_id = t.band_id
      WHERE t.id = tour_gigs.tour_id
        AND bm.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Band leaders can manage tour gigs"
  ON public.tour_gigs;
CREATE POLICY "Band leaders can manage tour gigs"
  ON public.tour_gigs
  FOR ALL
  USING (
    EXISTS (
      SELECT 1
      FROM public.tours t
      JOIN public.bands b ON b.id = t.band_id
      WHERE t.id = tour_gigs.tour_id
        AND b.leader_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.tours t
      JOIN public.bands b ON b.id = t.band_id
      WHERE t.id = tour_gigs.tour_id
        AND b.leader_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Band members can view tour logistics"
  ON public.tour_logistics;
CREATE POLICY "Band members can view tour logistics"
  ON public.tour_logistics
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.tours t
      JOIN public.band_members bm ON bm.band_id = t.band_id
      WHERE t.id = tour_logistics.tour_id
        AND bm.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Band leaders can manage tour logistics"
  ON public.tour_logistics;
CREATE POLICY "Band leaders can manage tour logistics"
  ON public.tour_logistics
  FOR ALL
  USING (
    EXISTS (
      SELECT 1
      FROM public.tours t
      JOIN public.bands b ON b.id = t.band_id
      WHERE t.id = tour_logistics.tour_id
        AND b.leader_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.tours t
      JOIN public.bands b ON b.id = t.band_id
      WHERE t.id = tour_logistics.tour_id
        AND b.leader_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Band members can view venue relationships"
  ON public.venue_relationships;
CREATE POLICY "Band members can view venue relationships"
  ON public.venue_relationships
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.band_members bm
      WHERE bm.band_id = venue_relationships.band_id
        AND bm.user_id = auth.uid()
    )
  );

NOTIFY pgrst, 'reload schema';
