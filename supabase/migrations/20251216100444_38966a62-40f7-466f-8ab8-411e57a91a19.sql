-- Phase 3: Database & Security Fixes (corrected)
-- Fix Security Definer Views, Enable RLS on unprotected tables, Add policies

-- =====================================================
-- PART 1: Drop dependent functions first
-- =====================================================
DROP FUNCTION IF EXISTS public.admin_get_cron_job_runs(integer);
DROP FUNCTION IF EXISTS public.admin_get_cron_job_summary();

-- =====================================================
-- PART 2: Fix Security Definer Views (convert to SECURITY INVOKER)
-- =====================================================

DROP VIEW IF EXISTS public.admin_cron_job_runs CASCADE;
CREATE VIEW public.admin_cron_job_runs 
WITH (security_invoker = true) AS
SELECT id, job_name, started_at, completed_at, status, duration_ms, 
       error_message, result_summary, processed_count, error_count, triggered_by
FROM cron_job_runs
ORDER BY started_at DESC;

DROP VIEW IF EXISTS public.admin_cron_job_summary CASCADE;
CREATE VIEW public.admin_cron_job_summary
WITH (security_invoker = true) AS
SELECT c.job_name, c.edge_function_name, c.display_name, c.description, c.schedule,
       c.allow_manual_trigger,
       max(r.completed_at) AS last_run_at,
       max(r.started_at) AS last_run_started_at,
       (SELECT cron_job_runs.status FROM cron_job_runs 
        WHERE cron_job_runs.job_name = c.job_name 
        ORDER BY cron_job_runs.started_at DESC LIMIT 1) AS last_run_status,
       (SELECT cron_job_runs.duration_ms FROM cron_job_runs 
        WHERE cron_job_runs.job_name = c.job_name 
        ORDER BY cron_job_runs.started_at DESC LIMIT 1) AS last_run_duration_ms,
       (avg(r.duration_ms))::integer AS avg_duration_ms,
       count(r.id) AS total_runs,
       count(CASE WHEN r.status = 'success' THEN 1 ELSE NULL END) AS success_runs,
       count(CASE WHEN r.status = 'error' THEN 1 ELSE NULL END) AS error_count,
       max(CASE WHEN r.triggered_by = 'admin_manual_trigger' THEN r.started_at ELSE NULL END) AS last_manual_trigger_at
FROM cron_job_config c
LEFT JOIN cron_job_runs r ON c.job_name = r.job_name
WHERE c.is_active = true
GROUP BY c.job_name, c.edge_function_name, c.display_name, c.description, c.schedule, c.allow_manual_trigger;

-- Recreate helper functions
CREATE OR REPLACE FUNCTION public.admin_get_cron_job_summary()
RETURNS SETOF admin_cron_job_summary
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $function$
  SELECT * FROM admin_cron_job_summary ORDER BY display_name;
$function$;

CREATE OR REPLACE FUNCTION public.admin_get_cron_job_runs(_limit integer DEFAULT 50)
RETURNS SETOF admin_cron_job_runs
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $function$
  SELECT * FROM admin_cron_job_runs LIMIT _limit;
$function$;

DROP VIEW IF EXISTS public.admin_game_stats CASCADE;
CREATE VIEW public.admin_game_stats
WITH (security_invoker = true) AS
SELECT 
  (SELECT count(*) FROM profiles) AS total_players,
  (SELECT count(*) FROM profiles WHERE updated_at > now() - interval '24 hours') AS active_today,
  (SELECT count(*) FROM profiles WHERE updated_at > now() - interval '7 days') AS active_week,
  (SELECT count(*) FROM bands) AS total_bands,
  (SELECT count(*) FROM songs) AS total_songs,
  (SELECT count(*) FROM gigs WHERE status::text = 'completed') AS completed_gigs,
  (SELECT count(*) FROM releases WHERE release_status::text = 'released') AS total_releases,
  (SELECT COALESCE(sum(band_balance), 0) FROM bands) AS total_economy,
  (SELECT count(*) FROM game_activity_logs WHERE created_at > now() - interval '24 hours') AS activities_today;

DROP VIEW IF EXISTS public.band_gift_notifications CASCADE;
CREATE VIEW public.band_gift_notifications
WITH (security_invoker = true) AS
SELECT asg.id, asg.created_at, asg.gift_message, asg.gifted_to_band_id,
       b.name AS band_name, s.id AS song_id, s.title AS song_title,
       s.genre, s.song_rating, s.quality_score, false AS viewed
FROM admin_song_gifts asg
JOIN songs s ON s.id = asg.song_id
JOIN bands b ON b.id = asg.gifted_to_band_id
WHERE asg.gifted_to_band_id IS NOT NULL;

DROP VIEW IF EXISTS public.chart_albums CASCADE;
CREATE VIEW public.chart_albums
WITH (security_invoker = true) AS
SELECT r.id AS release_id, r.title, b.name AS band_name, r.country, r.format_type,
       r.digital_sales, r.cd_sales, r.vinyl_sales, r.cassette_sales,
       r.total_units_sold, r.total_revenue, r.release_status, r.created_at
FROM releases r
LEFT JOIN bands b ON r.band_id = b.id
WHERE r.release_status::text = 'released';

DROP VIEW IF EXISTS public.chart_singles CASCADE;
CREATE VIEW public.chart_singles
WITH (security_invoker = true) AS
SELECT s.id AS song_id, s.title, s.genre, b.name AS band_name, sr.country,
       sp.platform_name, sum(COALESCE(sr.total_streams, 0)) AS total_streams,
       sum(COALESCE(sr.total_revenue, 0)) AS streaming_revenue,
       count(DISTINCT sr.id) AS platform_count
FROM songs s
LEFT JOIN bands b ON s.band_id = b.id
LEFT JOIN song_releases sr ON s.id = sr.song_id
LEFT JOIN streaming_platforms sp ON sr.platform_id = sp.id
WHERE sr.release_type = 'streaming' AND sr.is_active = true
GROUP BY s.id, s.title, s.genre, b.name, sr.country, sp.platform_name;

DROP VIEW IF EXISTS public.public_player_cards CASCADE;
CREATE VIEW public.public_player_cards
WITH (security_invoker = true) AS
SELECT id, username, display_name, avatar_url, fame, level
FROM profiles;

DROP VIEW IF EXISTS public.released_songs CASCADE;
CREATE VIEW public.released_songs
WITH (security_invoker = true) AS
SELECT s.id, s.title, s.genre, s.band_id, s.user_id, s.quality_score,
       s.song_rating, s.status, s.created_at, s.updated_at
FROM songs s
WHERE s.status = 'released';

-- =====================================================
-- PART 3: Enable RLS on 11 unprotected tables
-- =====================================================

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

-- =====================================================
-- PART 4: Add RLS Policies (corrected for actual schemas)
-- =====================================================

-- audience_memory: Band members can view their band's audience memory
CREATE POLICY "Band members can view audience memory"
ON public.audience_memory FOR SELECT
USING (band_id IN (SELECT band_id FROM band_members WHERE user_id = auth.uid()));

-- band_conflicts: Band members can view their band's conflicts
CREATE POLICY "Band members can view band conflicts"
ON public.band_conflicts FOR SELECT
USING (band_id IN (SELECT band_id FROM band_members WHERE user_id = auth.uid()));

-- gig_analytics: Band members can view analytics for their gigs
CREATE POLICY "Band members can view gig analytics"
ON public.gig_analytics FOR SELECT
USING (
  gig_id IN (
    SELECT g.id FROM gigs g
    JOIN band_members bm ON g.band_id = bm.band_id
    WHERE bm.user_id = auth.uid()
  )
);

-- gig_offers: Band members can view/manage offers for their band
CREATE POLICY "Band members can view gig offers"
ON public.gig_offers FOR SELECT
USING (band_id IN (SELECT band_id FROM band_members WHERE user_id = auth.uid()));

CREATE POLICY "Band leaders can update gig offers"
ON public.gig_offers FOR UPDATE
USING (band_id IN (SELECT id FROM bands WHERE leader_id = auth.uid()));

-- multiplayer_events: Everyone can view events (public game events)
CREATE POLICY "Everyone can view multiplayer events"
ON public.multiplayer_events FOR SELECT
USING (true);

-- player_daily_cats: Users can view/manage their own daily categories
CREATE POLICY "Users can view own daily cats"
ON public.player_daily_cats FOR SELECT
USING (profile_id IN (SELECT id FROM profiles WHERE user_id = auth.uid()));

CREATE POLICY "Users can insert own daily cats"
ON public.player_daily_cats FOR INSERT
WITH CHECK (profile_id IN (SELECT id FROM profiles WHERE user_id = auth.uid()));

CREATE POLICY "Users can update own daily cats"
ON public.player_daily_cats FOR UPDATE
USING (profile_id IN (SELECT id FROM profiles WHERE user_id = auth.uid()));

-- promoters: Everyone can view promoters (they're public NPCs)
CREATE POLICY "Everyone can view promoters"
ON public.promoters FOR SELECT
USING (true);

-- stage_events: Band members can view their gig's stage events
CREATE POLICY "Band members can view stage events"
ON public.stage_events FOR SELECT
USING (
  gig_id IN (
    SELECT g.id FROM gigs g
    JOIN band_members bm ON g.band_id = bm.band_id
    WHERE bm.user_id = auth.uid()
  )
);

-- tour_gigs: Band members can view/manage their tour gigs
CREATE POLICY "Band members can view tour gigs"
ON public.tour_gigs FOR SELECT
USING (
  tour_id IN (
    SELECT t.id FROM tours t
    JOIN band_members bm ON t.band_id = bm.band_id
    WHERE bm.user_id = auth.uid()
  )
);

CREATE POLICY "Band leaders can manage tour gigs"
ON public.tour_gigs FOR ALL
USING (
  tour_id IN (
    SELECT t.id FROM tours t
    JOIN bands b ON t.band_id = b.id
    WHERE b.leader_id = auth.uid()
  )
);

-- tour_logistics: Band members can view/manage their tour logistics
CREATE POLICY "Band members can view tour logistics"
ON public.tour_logistics FOR SELECT
USING (
  tour_id IN (
    SELECT t.id FROM tours t
    JOIN band_members bm ON t.band_id = bm.band_id
    WHERE bm.user_id = auth.uid()
  )
);

CREATE POLICY "Band leaders can manage tour logistics"
ON public.tour_logistics FOR ALL
USING (
  tour_id IN (
    SELECT t.id FROM tours t
    JOIN bands b ON t.band_id = b.id
    WHERE b.leader_id = auth.uid()
  )
);

-- venue_relationships: Band members can view their venue relationships
CREATE POLICY "Band members can view venue relationships"
ON public.venue_relationships FOR SELECT
USING (band_id IN (SELECT band_id FROM band_members WHERE user_id = auth.uid()));