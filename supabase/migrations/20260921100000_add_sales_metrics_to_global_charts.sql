-- Add record sales metrics to the global_charts table
ALTER TABLE public.global_charts
  ADD COLUMN IF NOT EXISTS physical_sales bigint NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS digital_sales bigint NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_sales bigint NOT NULL DEFAULT 0;

-- Ensure totals are aligned for existing records
UPDATE public.global_charts
SET total_sales = COALESCE(physical_sales, 0) + COALESCE(digital_sales, 0);

-- Recreate the snapshot function to populate sales metrics
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
      GREATEST(0, FLOOR(COALESCE(s.revenue, 0) / 15))::bigint AS physical_sales,
      GREATEST(0, (COALESCE(s.streams, 0) / 1000))::bigint AS digital_sales,
      ROW_NUMBER() OVER (
        ORDER BY COALESCE(s.streams, 0) DESC, s.created_at ASC
      ) AS position
    FROM public.songs s
  ),
  limited AS (
    SELECT
      song_id,
      total_streams,
      physical_sales,
      digital_sales,
      (physical_sales + digital_sales) AS total_sales,
      position
    FROM ranked
    WHERE position <= p_limit
  )
  INSERT INTO public.global_charts (
    chart_date,
    chart_type,
    song_id,
    total_streams,
    physical_sales,
    digital_sales,
    total_sales,
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
    limited.physical_sales,
    limited.digital_sales,
    limited.total_sales,
    limited.position,
    'same',
    0,
    1
  FROM limited
  ON CONFLICT (chart_date, chart_type, song_id)
  DO UPDATE SET
    total_streams = EXCLUDED.total_streams,
    physical_sales = EXCLUDED.physical_sales,
    digital_sales = EXCLUDED.digital_sales,
    total_sales = EXCLUDED.total_sales,
    rank = EXCLUDED.rank,
    updated_at = now();

  PERFORM public.update_global_chart_trends(p_chart_type, p_chart_date);
END;
$$;
