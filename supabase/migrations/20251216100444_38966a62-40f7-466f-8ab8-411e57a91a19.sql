-- Phase 3: Database and security compatibility repairs.
-- Convert administrative views to security invoker, preserve canonical song
-- ownership and recreate the affected RLS policies safely.

DROP FUNCTION IF EXISTS public.admin_get_cron_job_runs(integer);
DROP FUNCTION IF EXISTS public.admin_get_cron_job_summary();

DROP VIEW IF EXISTS public.admin_cron_job_runs CASCADE;
CREATE VIEW public.admin_cron_job_runs
WITH (security_invoker = true) AS
SELECT
  id,
  job_name,
  started_at,
  completed_at,
  status,
  duration_ms,
  error_message,
  result_summary,
  processed_count,
  error_count,
  triggered_by
FROM public.cron_job_runs
ORDER BY started_at DESC;

DROP VIEW IF EXISTS public.admin_cron_job_summary CASCADE;
CREATE VIEW public.admin_cron_job_summary
WITH (security_invoker = true) AS
SELECT
  c.job_name,
  c.edge_function_name,
  c.display_name,
  c.description,
  c.schedule,
  c.allow_manual_trigger,
  max(r.completed_at) AS last_run_at,
  max(r.started_at) AS last_run_started_at,
  (
    SELECT runs.status
    FROM public.cron_job_runs runs
    WHERE runs.job_name = c.job_name
    ORDER BY runs.started_at DESC
    LIMIT 1
  ) AS last_run_status,
  (
    SELECT runs.duration_ms
    FROM public.cron_job_runs runs
    WHERE runs.job_name = c.job_name
    ORDER BY runs.started_at DESC
    LIMIT 1
  ) AS last_run_duration_ms,
  avg(r.duration_ms)::integer AS avg_duration_ms,
  count(r.id) AS total_runs,
  count(*) FILTER (WHERE r.status = 'success') AS success_runs,
  count(*) FILTER (WHERE r.status = 'error') AS error_count,
  max(r.started_at) FILTER (
    WHERE r.triggered_by = 'admin_manual_trigger'
  ) AS last_manual_trigger_at
FROM public.cron_job_config c
LEFT JOIN public.cron_job_runs r ON c.job_name = r.job_name
WHERE c.is_active = true
GROUP BY
  c.job_name,
  c.edge_function_name,
  c.display_name,
  c.description,
  c.schedule,
  c.allow_manual_trigger;

CREATE OR REPLACE FUNCTION public.admin_get_cron_job_summary()
RETURNS SETOF public.admin_cron_job_summary
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $function$
  SELECT *
  FROM public.admin_cron_job_summary
  ORDER BY display_name;
$function$;

CREATE OR REPLACE FUNCTION public.admin_get_cron_job_runs(_limit integer DEFAULT 50)
RETURNS SETOF public.admin_cron_job_runs
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $function$
  SELECT *
  FROM public.admin_cron_job_runs
  LIMIT _limit;
$function$;

DROP VIEW IF EXISTS public.admin_game_stats CASCADE;
CREATE VIEW public.admin_game_stats
WITH (security_invoker = true) AS
SELECT
  (SELECT count(*) FROM public.profiles) AS total_players,
  (
    SELECT count(*)
    FROM public.profiles
    WHERE updated_at > now() - interval '24 hours'
  ) AS active_today,
  (
    SELECT count(*)
    FROM public.profiles
    WHERE updated_at > now() - interval '7 days'
  ) AS active_week,
  (SELECT count(*) FROM public.bands) AS total_bands,
  (SELECT count(*) FROM public.songs) AS total_songs,
  (
    SELECT count(*)
    FROM public.gigs
    WHERE status::text = 'completed'
  ) AS completed_gigs,
  (
    SELECT count(*)
    FROM public.releases
    WHERE release_status::text = 'released'
  ) AS total_releases,
  (SELECT coalesce(sum(band_balance), 0) FROM public.bands) AS total_economy,
  (
    SELECT count(*)
    FROM public.game_activity_logs
    WHERE created_at > now() - interval '24 hours'
  ) AS activities_today;

DROP VIEW IF EXISTS public.band_gift_notifications CASCADE;
CREATE VIEW public.band_gift_notifications
WITH (security_invoker = true) AS
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
  false AS viewed
FROM public.admin_song_gifts asg
JOIN public.songs s ON s.id = asg.song_id
JOIN public.bands b ON b.id = asg.gifted_to_band_id
WHERE asg.gifted_to_band_id IS NOT NULL;

DROP VIEW IF EXISTS public.chart_albums CASCADE;
CREATE VIEW public.chart_albums
WITH (security_invoker = true) AS
SELECT
  r.id AS release_id,
  r.title,
  b.name AS band_name,
  r.country,
  r.format_type,
  r.digital_sales,
  r.cd_sales,
  r.vinyl_sales,
  r.cassette_sales,
  r.total_units_sold,
  r.total_revenue,
  r.release_status,
  r.created_at
FROM public.releases r
LEFT JOIN public.bands b ON r.band_id = b.id
WHERE r.release_status::text = 'released';

DROP VIEW IF EXISTS public.chart_singles CASCADE;
CREATE VIEW public.chart_singles
WITH (security_invoker = true) AS
SELECT
  s.id AS song_id,
  s.title,
  s.genre,
  b.name AS band_name,
  sr.country,
  sp.platform_name,
  sum(coalesce(sr.total_streams, 0)) AS total_streams,
  sum(coalesce(sr.total_revenue, 0)) AS streaming_revenue,
  count(DISTINCT sr.id) AS platform_count
FROM public.songs s
LEFT JOIN public.bands b ON s.band_id = b.id
LEFT JOIN public.song_releases sr ON s.id = sr.song_id
LEFT JOIN public.streaming_platforms sp ON sr.platform_id = sp.id
WHERE sr.release_type = 'streaming'
  AND sr.is_active = true
GROUP BY s.id, s.title, s.genre, b.name, sr.country, sp.platform_name;

DROP VIEW IF EXISTS public.public_player_cards CASCADE;
CREATE VIEW public.public_player_cards
WITH (security_invoker = true) AS
SELECT id, username, display_name, avatar_url, fame, level
FROM public.profiles;

DROP VIEW IF EXISTS public.released_songs CASCADE;
CREATE VIEW public.released_songs
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
      SELECT 1
      FROM public.band_members bm
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
      SELECT 1
      FROM public.band_members bm
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
      SELECT 1
      FROM public.band_members bm
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
      SELECT 1
      FROM public.bands b
      WHERE b.id = gig_offers.band_id
        AND b.leader_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.bands b
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
      SELECT 1
      FROM public.profiles p
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
      SELECT 1
      FROM public.profiles p
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
      SELECT 1
      FROM public.profiles p
      WHERE p.id = player_daily_cats.profile_id
        AND p.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.profiles p
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
      SELECT 1
      FROM public.band_members bm
      WHERE bm.band_id = venue_relationships.band_id
        AND bm.user_id = auth.uid()
    )
  );

NOTIFY pgrst, 'reload schema';
