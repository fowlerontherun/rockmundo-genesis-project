-- Add update-music-charts cron job
INSERT INTO cron_job_config (job_name, edge_function_name, display_name, description, schedule, is_active, allow_manual_trigger)
VALUES 
  ('update-music-charts', 'update-music-charts', 'Update Music Charts', 'Update streaming and sales charts daily', '0 3 * * *', true, true)
ON CONFLICT (job_name) DO UPDATE SET
  edge_function_name = EXCLUDED.edge_function_name,
  display_name = EXCLUDED.display_name,
  description = EXCLUDED.description,
  schedule = EXCLUDED.schedule,
  allow_manual_trigger = EXCLUDED.allow_manual_trigger;

-- Add indexes for chart queries
CREATE INDEX IF NOT EXISTS idx_chart_entries_chart_type_rank 
  ON chart_entries(chart_type, rank, chart_date);

CREATE INDEX IF NOT EXISTS idx_chart_entries_date 
  ON chart_entries(chart_date DESC);

CREATE INDEX IF NOT EXISTS idx_release_sales_date 
  ON release_sales(sale_date DESC);

CREATE INDEX IF NOT EXISTS idx_release_sales_format 
  ON release_sales(release_format_id, sale_date DESC);

-- Add function to calculate chart trends
CREATE OR REPLACE FUNCTION calculate_chart_trends()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_today DATE := CURRENT_DATE;
  v_yesterday DATE := CURRENT_DATE - INTERVAL '1 day';
BEGIN
  -- Update trends for today's charts based on yesterday's position
  UPDATE chart_entries ce_today
  SET 
    trend = CASE
      WHEN ce_yesterday.rank IS NULL THEN 'new'
      WHEN ce_today.rank < ce_yesterday.rank THEN 'up'
      WHEN ce_today.rank > ce_yesterday.rank THEN 'down'
      ELSE 'same'
    END,
    trend_change = ABS(COALESCE(ce_yesterday.rank, 0) - ce_today.rank),
    weeks_on_chart = COALESCE(
      (SELECT COUNT(DISTINCT chart_date) 
       FROM chart_entries 
       WHERE song_id = ce_today.song_id 
         AND chart_type = ce_today.chart_type
         AND chart_date <= v_today), 
      1
    )
  FROM chart_entries ce_yesterday
  WHERE ce_today.chart_date = v_today
    AND ce_yesterday.chart_date = v_yesterday
    AND ce_today.song_id = ce_yesterday.song_id
    AND ce_today.chart_type = ce_yesterday.chart_type;

  -- Mark new entries
  UPDATE chart_entries
  SET trend = 'new', weeks_on_chart = 1
  WHERE chart_date = v_today
    AND trend IS NULL;
END;
$$;