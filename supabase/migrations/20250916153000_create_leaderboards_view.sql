-- Create a leaderboard view that aggregates metrics across all players
DROP VIEW IF EXISTS public.leaderboards;

CREATE VIEW public.leaderboards AS
WITH song_stats AS (
  SELECT
    user_id,
    COALESCE(SUM(revenue), 0)::numeric AS total_song_revenue
  FROM public.songs
  GROUP BY user_id
),
gig_stats AS (
  SELECT
    user_id,
    COALESCE(SUM(earnings), 0)::numeric AS total_gig_revenue,
    COUNT(*)::integer AS total_gigs
  FROM public.gig_performances
  GROUP BY user_id
),
achievement_totals AS (
  SELECT
    user_id,
    COALESCE(earned_count, 0)::integer AS total_achievements
  FROM public.player_achievement_summary
)
SELECT
  p.user_id,
  p.username,
  p.display_name,
  p.avatar_url,
  COALESCE(p.fame, 0) AS fame,
  COALESCE(p.experience, 0) AS experience,
  (COALESCE(ss.total_song_revenue, 0) + COALESCE(gs.total_gig_revenue, 0))::numeric AS total_revenue,
  COALESCE(gs.total_gigs, 0) AS total_gigs,
  COALESCE(at.total_achievements, 0) AS total_achievements
FROM public.profiles p
LEFT JOIN song_stats ss ON ss.user_id = p.user_id
LEFT JOIN gig_stats gs ON gs.user_id = p.user_id
LEFT JOIN achievement_totals at ON at.user_id = p.user_id;

GRANT SELECT ON public.leaderboards TO anon, authenticated;
