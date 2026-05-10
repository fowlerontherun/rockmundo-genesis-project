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
WHERE sr.id = agg.song_release_id
  AND (sr.total_streams <> COALESCE(agg.streams, 0)
       OR sr.total_revenue <> LEAST(COALESCE(agg.revenue, 0), 2147483647)::int);

UPDATE public.song_releases
SET total_streams = 0, total_revenue = 0
WHERE id NOT IN (SELECT DISTINCT song_release_id FROM public.streaming_analytics_daily WHERE song_release_id IS NOT NULL)
  AND (total_streams <> 0 OR total_revenue <> 0);