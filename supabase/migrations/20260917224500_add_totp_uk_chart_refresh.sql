-- Top of the Pops: lightweight UK chart refresh.
-- The general update-music-charts Edge Function currently has a much larger remit and can
-- time out without TOTP being able to distinguish stale data from a healthy chart. This
-- server-side refresh builds only the two UK song charts TOTP is allowed to use.

CREATE INDEX IF NOT EXISTS idx_streaming_analytics_region_date
  ON public.streaming_analytics_daily(listener_region, analytics_date DESC);

CREATE INDEX IF NOT EXISTS idx_chart_entries_country_type_date_rank
  ON public.chart_entries(country, chart_type, chart_date DESC, rank)
  WHERE entry_type = 'song';

CREATE OR REPLACE FUNCTION public.totp_refresh_uk_chart_snapshot(p_chart_date date DEFAULT current_date)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_streaming_count integer := 0;
  v_digital_count integer := 0;
BEGIN
  IF p_chart_date IS NULL OR p_chart_date > current_date THEN
    RAISE EXCEPTION 'Chart date must be today or earlier';
  END IF;

  DELETE FROM public.chart_entries
  WHERE chart_date = p_chart_date
    AND country = 'United Kingdom'
    AND entry_type = 'song'
    AND chart_type IN ('streaming', 'digital_sales');

  WITH stream_totals AS (
    SELECT
      sr.song_id,
      sum(coalesce(sad.daily_streams, 0))::bigint AS weekly_streams,
      max(s.genre) AS genre
    FROM public.streaming_analytics_daily sad
    JOIN public.song_releases sr ON sr.id = sad.song_release_id
    JOIN public.songs s ON s.id = sr.song_id
    WHERE sad.listener_region = 'United Kingdom'
      AND sad.analytics_date BETWEEN p_chart_date - 6 AND p_chart_date
      AND s.status = 'recorded'
      AND coalesce(s.archived, false) = false
    GROUP BY sr.song_id
  ), ranked AS (
    SELECT
      song_id,
      weekly_streams,
      genre,
      row_number() OVER (ORDER BY weekly_streams DESC, song_id)::integer AS chart_rank
    FROM stream_totals
    WHERE weekly_streams > 0
  )
  INSERT INTO public.chart_entries(
    song_id, chart_type, rank, plays_count, weekly_plays, combined_score,
    chart_date, sale_type, country, genre, entry_type, trend, trend_change, weeks_on_chart
  )
  SELECT
    song_id,
    'streaming',
    chart_rank,
    weekly_streams,
    weekly_streams,
    0,
    p_chart_date,
    'stream',
    'United Kingdom',
    genre,
    'song',
    'new',
    0,
    1
  FROM ranked
  WHERE chart_rank <= 40;

  GET DIAGNOSTICS v_streaming_count = ROW_COUNT;

  WITH track_counts AS (
    SELECT
      release_id,
      count(*) FILTER (WHERE coalesce(is_b_side, false) = false)::numeric AS track_count
    FROM public.release_songs
    GROUP BY release_id
  ), digital_totals AS (
    SELECT
      rso.song_id,
      round(sum(
        rs.quantity_sold::numeric /
        greatest(coalesce(tc.track_count, 1), 1)
      ))::bigint AS weekly_sales,
      max(s.genre) AS genre
    FROM public.release_sales rs
    JOIN public.release_formats rf ON rf.id = rs.release_format_id
    JOIN public.release_songs rso
      ON rso.release_id = rf.release_id
     AND coalesce(rso.is_b_side, false) = false
    JOIN public.songs s ON s.id = rso.song_id
    LEFT JOIN track_counts tc ON tc.release_id = rf.release_id
    WHERE rf.format_type = 'digital'
      AND rs.country = 'United Kingdom'
      AND rs.sale_date >= (p_chart_date - 6)::timestamp
      AND rs.sale_date < (p_chart_date + 1)::timestamp
      AND s.status = 'recorded'
      AND coalesce(s.archived, false) = false
    GROUP BY rso.song_id
  ), ranked AS (
    SELECT
      song_id,
      weekly_sales,
      genre,
      row_number() OVER (ORDER BY weekly_sales DESC, song_id)::integer AS chart_rank
    FROM digital_totals
    WHERE weekly_sales > 0
  )
  INSERT INTO public.chart_entries(
    song_id, chart_type, rank, plays_count, weekly_plays, combined_score,
    chart_date, sale_type, country, genre, entry_type, trend, trend_change, weeks_on_chart
  )
  SELECT
    song_id,
    'digital_sales',
    chart_rank,
    weekly_sales,
    weekly_sales,
    0,
    p_chart_date,
    'digital',
    'United Kingdom',
    genre,
    'song',
    'new',
    0,
    1
  FROM ranked
  WHERE chart_rank <= 40;

  GET DIAGNOSTICS v_digital_count = ROW_COUNT;

  IF v_streaming_count = 0 AND v_digital_count = 0 THEN
    RAISE EXCEPTION 'Top of the Pops UK chart refresh produced no eligible rows for %', p_chart_date;
  END IF;

  RETURN jsonb_build_object(
    'chart_date', p_chart_date,
    'streaming_rows', v_streaming_count,
    'digital_rows', v_digital_count,
    'total_rows', v_streaming_count + v_digital_count
  );
END;
$$;

REVOKE ALL ON FUNCTION public.totp_refresh_uk_chart_snapshot(date) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.totp_refresh_uk_chart_snapshot(date) TO service_role;

DO $$
DECLARE
  v_job_id bigint;
BEGIN
  SELECT jobid INTO v_job_id
  FROM cron.job
  WHERE jobname = 'refresh_totp_uk_charts';

  IF v_job_id IS NOT NULL THEN
    PERFORM cron.unschedule(v_job_id);
  END IF;

  PERFORM cron.schedule(
    'refresh_totp_uk_charts',
    '15 1 * * *',
    $cron$SELECT public.totp_refresh_uk_chart_snapshot(current_date);$cron$
  );
END;
$$;

COMMENT ON FUNCTION public.totp_refresh_uk_chart_snapshot(date) IS
  'Builds the authoritative UK streaming and digital-sales Top 40 snapshots used by Top of the Pops directly from recent raw game activity.';
