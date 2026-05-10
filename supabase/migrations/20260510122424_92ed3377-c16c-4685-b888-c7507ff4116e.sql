UPDATE public.streaming_analytics_daily
SET
  daily_streams = LEAST(daily_streams, 5000000),
  daily_revenue = LEAST(daily_revenue, ROUND(5000000 * 0.004)::int)
WHERE daily_streams > 5000000;

WITH agg AS (
  SELECT
    song_release_id,
    COALESCE(SUM(daily_streams), 0)::bigint AS streams,
    COALESCE(SUM(daily_revenue), 0)::bigint AS revenue
  FROM public.streaming_analytics_daily
  GROUP BY song_release_id
)
UPDATE public.song_releases sr
SET
  total_streams = COALESCE(agg.streams, 0),
  total_revenue = LEAST(COALESCE(agg.revenue, 0), 2147483647)::int
FROM agg
WHERE sr.id = agg.song_release_id;