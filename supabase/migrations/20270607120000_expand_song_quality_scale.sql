-- Expand song quality scale to 0-1000 and align supporting systems
BEGIN;

-- Normalize existing values to the wider 0-1000 range
UPDATE public.songs
SET quality_score = LEAST(1000, GREATEST(0, ROUND(COALESCE(quality_score, 0)::numeric * 10)))
WHERE quality_score IS NOT NULL;

-- Ensure the column default reflects the mid-point of the new scale
ALTER TABLE public.songs
  ALTER COLUMN quality_score SET DEFAULT 500;

-- Enforce an explicit range check for the expanded scale
ALTER TABLE public.songs
  DROP CONSTRAINT IF EXISTS songs_quality_score_range,
  ADD CONSTRAINT songs_quality_score_range CHECK (quality_score BETWEEN 0 AND 1000);

-- Rebalance the automated growth job to expect the expanded range
CREATE OR REPLACE FUNCTION public.simulate_song_growth()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $$
BEGIN
  WITH growth AS (
    SELECT
      s.id,
      s.user_id,
      GREATEST(
        0,
        FLOOR(
          ((s.quality_score::numeric / 10) * 0.6 + COALESCE(ps.marketing, 10) * 1.5)
          * (0.85 + random() * 0.3)
        )
      )::int AS stream_increase
    FROM public.songs s
    LEFT JOIN public.player_skills ps ON ps.user_id = s.user_id
    WHERE s.status = 'released'
  ), updated AS (
    UPDATE public.songs s
    SET
      streams = s.streams + g.stream_increase,
      revenue = ROUND((s.revenue + (g.stream_increase * 0.01))::numeric, 2),
      updated_at = now()
    FROM growth g
    WHERE s.id = g.id AND g.stream_increase > 0
    RETURNING s.id, g.user_id, g.stream_increase,
      ROUND((g.stream_increase * 0.01)::numeric, 2) AS revenue_added
  )
  INSERT INTO public.song_stream_growth_history (song_id, user_id, streams_added, revenue_added)
  SELECT id, user_id, stream_increase, revenue_added
  FROM updated
  WHERE stream_increase > 0;
END;
$$;

COMMIT;
