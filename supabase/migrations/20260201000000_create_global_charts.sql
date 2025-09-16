-- Create global_charts table to store daily and weekly aggregates
CREATE TABLE IF NOT EXISTS public.global_charts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  chart_date date NOT NULL,
  chart_type text NOT NULL CHECK (chart_type IN ('daily', 'weekly')),
  song_id uuid NOT NULL REFERENCES public.songs(id) ON DELETE CASCADE,
  total_streams bigint NOT NULL DEFAULT 0,
  rank integer NOT NULL,
  trend text NOT NULL DEFAULT 'same',
  trend_change integer NOT NULL DEFAULT 0,
  weeks_on_chart integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(chart_date, chart_type, song_id)
);

CREATE UNIQUE INDEX IF NOT EXISTS global_charts_unique_rank
  ON public.global_charts(chart_type, chart_date, rank);

CREATE INDEX IF NOT EXISTS global_charts_song_idx
  ON public.global_charts(song_id);

-- Maintain updated_at column automatically
CREATE OR REPLACE FUNCTION public.update_global_charts_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS update_global_charts_updated_at ON public.global_charts;
CREATE TRIGGER update_global_charts_updated_at
BEFORE UPDATE ON public.global_charts
FOR EACH ROW
EXECUTE FUNCTION public.update_global_charts_updated_at();

-- Ensure pg_cron extension is available for scheduling
CREATE EXTENSION IF NOT EXISTS "pg_cron";

-- Function to calculate trend and streak information based on the previous period
CREATE OR REPLACE FUNCTION public.update_global_chart_trends(p_chart_type text, p_chart_date date)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  previous_date date;
BEGIN
  IF p_chart_type = 'daily' THEN
    previous_date := (p_chart_date - INTERVAL '1 day')::date;
  ELSIF p_chart_type = 'weekly' THEN
    previous_date := (p_chart_date - INTERVAL '7 day')::date;
  ELSE
    RAISE EXCEPTION 'Invalid chart type %', p_chart_type;
  END IF;

  WITH previous AS (
    SELECT
      song_id,
      rank AS prev_rank,
      weeks_on_chart
    FROM public.global_charts
    WHERE chart_type = p_chart_type
      AND chart_date = previous_date
  )
  UPDATE public.global_charts gc
  SET
    trend = CASE
      WHEN previous.prev_rank > gc.rank THEN 'up'
      WHEN previous.prev_rank < gc.rank THEN 'down'
      ELSE 'same'
    END,
    trend_change = previous.prev_rank - gc.rank,
    weeks_on_chart = previous.weeks_on_chart + 1,
    updated_at = now()
  FROM previous
  WHERE gc.chart_type = p_chart_type
    AND gc.chart_date = p_chart_date
    AND gc.song_id = previous.song_id;

  -- Handle new entries that did not appear in the previous period
  UPDATE public.global_charts gc
  SET
    trend = 'up',
    trend_change = 0,
    weeks_on_chart = 1,
    updated_at = now()
  WHERE gc.chart_type = p_chart_type
    AND gc.chart_date = p_chart_date
    AND NOT EXISTS (
      SELECT 1
      FROM public.global_charts prev
      WHERE prev.chart_type = p_chart_type
        AND prev.chart_date = previous_date
        AND prev.song_id = gc.song_id
    );
END;
$$;

-- Core snapshot function that computes rankings for a given chart type and period
CREATE OR REPLACE FUNCTION public.snapshot_global_chart(
  p_chart_type text,
  p_chart_date date,
  p_limit integer DEFAULT 100
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_chart_type NOT IN ('daily', 'weekly') THEN
    RAISE EXCEPTION 'Invalid chart type %', p_chart_type;
  END IF;

  WITH ranked AS (
    SELECT
      s.id AS song_id,
      COALESCE(s.streams, 0) AS total_streams,
      ROW_NUMBER() OVER (
        ORDER BY COALESCE(s.streams, 0) DESC, s.created_at ASC
      ) AS position
    FROM public.songs s
  ),
  limited AS (
    SELECT *
    FROM ranked
    WHERE position <= p_limit
  )
  INSERT INTO public.global_charts (
    chart_date,
    chart_type,
    song_id,
    total_streams,
    rank,
    trend,
    trend_change,
    weeks_on_chart
  )
  SELECT
    p_chart_date,
    p_chart_type,
    limited.song_id,
    limited.total_streams,
    limited.position,
    'same',
    0,
    1
  FROM limited
  ON CONFLICT (chart_date, chart_type, song_id)
  DO UPDATE SET
    total_streams = EXCLUDED.total_streams,
    rank = EXCLUDED.rank,
    updated_at = now();

  PERFORM public.update_global_chart_trends(p_chart_type, p_chart_date);
END;
$$;

-- Convenience function to refresh both daily and weekly charts
CREATE OR REPLACE FUNCTION public.refresh_global_charts(p_limit integer DEFAULT 100)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  target_day date := date_trunc('day', now())::date;
  target_week date := date_trunc('week', now())::date;
BEGIN
  PERFORM public.snapshot_global_chart('daily', target_day, p_limit);
  PERFORM public.snapshot_global_chart('weekly', target_week, p_limit);
END;
$$;

-- Ensure the charts are refreshed daily so trend data stays current
DO $$
DECLARE
  existing_job_id int;
BEGIN
  SELECT jobid
  INTO existing_job_id
  FROM cron.job
  WHERE jobname = 'refresh_global_charts';

  IF existing_job_id IS NOT NULL THEN
    PERFORM cron.unschedule(existing_job_id);
  END IF;

  PERFORM cron.schedule(
    'refresh_global_charts',
    '0 1 * * *',
    $$select public.refresh_global_charts();$$
  );
END;
$$;

-- Enable RLS and allow read access for clients
ALTER TABLE public.global_charts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Global charts are viewable by everyone" ON public.global_charts;
CREATE POLICY "Global charts are viewable by everyone" ON public.global_charts
  FOR SELECT
  USING (true);
