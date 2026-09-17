-- Safe admin-only Top of the Pops dry-run preview.
-- Uses live chart eligibility and production-style selection/stage rules without
-- creating episodes, invitations, notifications, rewards, history or chart changes.

CREATE OR REPLACE FUNCTION public.totp_admin_test_episode_preview(
  p_seed text DEFAULT 'admin-test',
  p_max_performances integer DEFAULT 10
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_snapshot_date date;
  v_previous_episode_id uuid;
  v_result jsonb;
  v_seed text := coalesce(nullif(trim(p_seed), ''), 'admin-test');
  v_max integer := greatest(1, least(coalesce(p_max_performances, 10), 20));
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Admin access required';
  END IF;

  SELECT max(chart_date)
  INTO v_snapshot_date
  FROM (
    SELECT ce.chart_date
    FROM public.chart_entries ce
    WHERE ce.country = 'United Kingdom'
      AND ce.chart_type IN ('streaming', 'digital_sales')
      AND ce.entry_type = 'song'
      AND ce.rank BETWEEN 1 AND 40
    GROUP BY ce.chart_date
    HAVING count(DISTINCT ce.chart_type) = 2
  ) snapshots;

  IF v_snapshot_date IS NULL THEN
    RAISE EXCEPTION 'No complete UK streaming + digital sales chart snapshot is available';
  END IF;

  SELECT e.id
  INTO v_previous_episode_id
  FROM public.totp_episodes e
  WHERE e.status <> 'cancelled'
  ORDER BY e.episode_date DESC, e.created_at DESC
  LIMIT 1;

  WITH source_rows AS (
    SELECT
      ce.song_id,
      ce.chart_type,
      ce.rank,
      s.band_id,
      s.title::text AS song_title,
      coalesce(s.genre::text, '') AS genre,
      b.name::text AS band_name
    FROM public.chart_entries ce
    JOIN public.songs s ON s.id = ce.song_id
    JOIN public.bands b ON b.id = s.band_id
    WHERE ce.chart_date = v_snapshot_date
      AND ce.country = 'United Kingdom'
      AND ce.entry_type = 'song'
      AND ce.chart_type IN ('streaming', 'digital_sales')
      AND ce.rank BETWEEN 1 AND 40
      AND s.band_id IS NOT NULL
      AND coalesce(s.archived, false) = false
  ),
  combined AS (
    SELECT
      sr.song_id,
      sr.band_id,
      max(sr.song_title) AS song_title,
      max(sr.genre) AS genre,
      max(sr.band_name) AS band_name,
      min(sr.rank) AS best_rank,
      CASE
        WHEN count(DISTINCT sr.chart_type) = 2 THEN 'both'
        WHEN bool_or(sr.chart_type = 'streaming') THEN 'streaming'
        ELSE 'digital_sales'
      END AS qualifying_chart
    FROM source_rows sr
    GROUP BY sr.song_id, sr.band_id
  ),
  ranked_band_songs AS (
    SELECT c.*,
      row_number() OVER (PARTITION BY c.band_id ORDER BY c.best_rank ASC, c.song_id) AS band_song_rank
    FROM combined c
  ),
  eligible AS (
    SELECT
      r.*,
      CASE
        WHEN r.best_rank <= 10 THEN 'top10'
        WHEN r.best_rank <= 20 THEN '11_20'
        ELSE '21_40'
      END AS selection_bucket
    FROM ranked_band_songs r
    WHERE r.band_song_rank = 1
      AND NOT EXISTS (
        SELECT 1
        FROM public.totp_performances tp
        WHERE tp.episode_id = v_previous_episode_id
          AND tp.band_id = r.band_id
          AND tp.completed_at IS NOT NULL
      )
  ),
  bucket_ranked AS (
    SELECT e.*,
      row_number() OVER (
        PARTITION BY e.selection_bucket
        ORDER BY
          CASE WHEN e.best_rank = 1 THEN 0 ELSE 1 END,
          md5(v_seed || ':' || v_snapshot_date::text || ':' || e.band_id::text || ':' || e.song_id::text)
      ) AS bucket_order
    FROM eligible e
  ),
  editorial_pool AS (
    SELECT b.*
    FROM bucket_ranked b
    WHERE (b.selection_bucket = 'top10' AND b.bucket_order <= 4)
       OR (b.selection_bucket = '11_20' AND b.bucket_order <= 3)
       OR (b.selection_bucket = '21_40' AND b.bucket_order <= 3)
  ),
  capped AS (
    SELECT ep.*
    FROM editorial_pool ep
    ORDER BY
      CASE WHEN ep.best_rank = 1 THEN 0 ELSE 1 END,
      md5(v_seed || ':cap:' || ep.band_id::text || ':' || ep.song_id::text)
    LIMIT v_max
  ),
  ordered AS (
    SELECT c.*,
      row_number() OVER (
        ORDER BY
          CASE WHEN c.best_rank = 1 THEN 1 ELSE 0 END,
          md5(v_seed || ':order:' || c.band_id::text || ':' || c.song_id::text)
      )::integer AS running_order
    FROM capped c
  ),
  shaped AS (
    SELECT
      o.running_order,
      o.band_id,
      o.band_name,
      o.song_id,
      o.song_title,
      o.genre,
      o.best_rank AS qualifying_rank,
      o.qualifying_chart,
      o.selection_bucket,
      CASE
        WHEN lower(o.genre) ~ '(rock|metal|punk|grunge|hardcore)' THEN 'rock_stage'
        WHEN o.best_rank <= 5 THEN 'main_stage'
        WHEN mod(o.running_order, 3) = 0 THEN 'studio_floor'
        ELSE 'stage_b'
      END AS stage_key,
      format('At number %s this week, please welcome %s performing %s!', o.best_rank, o.band_name, o.song_title) AS presenter_intro
    FROM ordered o
  )
  SELECT jsonb_build_object(
    'mode', 'dry_run',
    'safe', true,
    'chart_snapshot_date', v_snapshot_date,
    'generated_at', now(),
    'seed', v_seed,
    'max_performances', v_max,
    'eligible_count', (SELECT count(*) FROM eligible),
    'selected_count', (SELECT count(*) FROM shaped),
    'previous_episode_id', v_previous_episode_id,
    'side_effects', jsonb_build_object(
      'invitations', false,
      'notifications', false,
      'rewards', false,
      'history', false,
      'chart_changes', false
    ),
    'performances', coalesce((
      SELECT jsonb_agg(to_jsonb(s) ORDER BY s.running_order)
      FROM shaped s
    ), '[]'::jsonb)
  )
  INTO v_result;

  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.totp_admin_test_episode_preview(text, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.totp_admin_test_episode_preview(text, integer) TO authenticated;

COMMENT ON FUNCTION public.totp_admin_test_episode_preview(text, integer) IS
  'Admin-only, read-only Top of the Pops dry run using live chart eligibility and production selection/stage rules. Creates no gameplay side effects.';
