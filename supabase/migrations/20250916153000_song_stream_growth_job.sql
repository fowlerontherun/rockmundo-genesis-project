-- Create table to track incremental streaming growth for released songs
CREATE TABLE IF NOT EXISTS public.song_stream_growth_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  song_id UUID NOT NULL REFERENCES public.songs(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  streams_added INTEGER NOT NULL DEFAULT 0,
  revenue_added NUMERIC(10,2) NOT NULL DEFAULT 0,
  recorded_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Ensure users can only see their own growth history
ALTER TABLE public.song_stream_growth_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own song growth"
ON public.song_stream_growth_history
FOR SELECT
USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS song_stream_growth_history_user_recorded_at_idx
ON public.song_stream_growth_history (user_id, recorded_at DESC);

CREATE INDEX IF NOT EXISTS song_stream_growth_history_song_recorded_at_idx
ON public.song_stream_growth_history (song_id, recorded_at DESC);

-- Function to simulate organic growth for released songs based on quality and marketing
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
          (s.quality_score::numeric * 0.6 + COALESCE(ps.marketing, 10) * 1.5)
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

COMMENT ON FUNCTION public.simulate_song_growth IS 'Applies automated stream and revenue growth to released songs based on quality and marketing skills.';

-- Ensure the pg_cron extension is available for scheduling
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA extensions;

-- Schedule the growth function to run regularly (every 15 minutes)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'song_stream_growth_quarter_hour') THEN
    PERFORM cron.schedule(
      'song_stream_growth_quarter_hour',
      '*/15 * * * *',
      $$SELECT public.simulate_song_growth();$$
    );
  END IF;
END;
$$;
