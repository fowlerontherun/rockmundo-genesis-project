-- Aggregate weekly activity across songs, gigs, and fan growth
DROP VIEW IF EXISTS public.weekly_stats;

CREATE VIEW public.weekly_stats AS
WITH song_weeks AS (
  SELECT
    user_id,
    date_trunc('week', created_at)::date AS week_start,
    COUNT(*)::integer AS songs_created
  FROM public.songs
  GROUP BY user_id, week_start
),
gig_weeks AS (
  SELECT
    band_id AS user_id,
    date_trunc('week', COALESCE(updated_at, scheduled_date))::date AS week_start,
    COUNT(*)::integer AS gigs_performed,
    COALESCE(SUM(fan_gain), 0)::integer AS fan_gain
  FROM public.gigs
  WHERE band_id IS NOT NULL
    AND status = 'completed'
  GROUP BY band_id, date_trunc('week', COALESCE(updated_at, scheduled_date))
),
social_weeks AS (
  SELECT
    user_id,
    date_trunc('week', created_at)::date AS week_start,
    COALESCE(SUM(fan_growth), 0)::integer AS fan_growth
  FROM public.social_posts
  GROUP BY user_id, week_start
),
combined AS (
  SELECT user_id, week_start, songs_created, 0::integer AS gigs_performed, 0::integer AS fan_change
  FROM song_weeks
  UNION ALL
  SELECT user_id, week_start, 0::integer, gigs_performed, fan_gain
  FROM gig_weeks
  UNION ALL
  SELECT user_id, week_start, 0::integer, 0::integer, fan_growth
  FROM social_weeks
),
aggregated AS (
  SELECT
    user_id,
    week_start,
    SUM(songs_created)::integer AS songs_created,
    SUM(gigs_performed)::integer AS gigs_performed,
    SUM(fan_change)::integer AS fan_change
  FROM combined
  GROUP BY user_id, week_start
),
ranked AS (
  SELECT
    user_id,
    week_start,
    songs_created,
    gigs_performed,
    fan_change,
    LAG(songs_created) OVER (PARTITION BY user_id ORDER BY week_start) AS prev_songs,
    LAG(gigs_performed) OVER (PARTITION BY user_id ORDER BY week_start) AS prev_gigs,
    LAG(fan_change) OVER (PARTITION BY user_id ORDER BY week_start) AS prev_fans
  FROM aggregated
)
SELECT
  user_id,
  week_start,
  (week_start + INTERVAL '6 days')::date AS week_end,
  songs_created,
  gigs_performed,
  fan_change,
  COALESCE(prev_songs, 0) AS previous_songs,
  COALESCE(prev_gigs, 0) AS previous_gigs,
  COALESCE(prev_fans, 0) AS previous_fans,
  CASE WHEN prev_songs IS NULL THEN 0 ELSE songs_created - prev_songs END AS songs_change,
  CASE WHEN prev_gigs IS NULL THEN 0 ELSE gigs_performed - prev_gigs END AS gigs_change,
  CASE WHEN prev_fans IS NULL THEN 0 ELSE fan_change - prev_fans END AS fans_change
FROM ranked;

GRANT SELECT ON public.weekly_stats TO anon, authenticated;
