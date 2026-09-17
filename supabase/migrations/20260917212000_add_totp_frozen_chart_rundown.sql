-- Top of the Pops phase 7: freeze the complete available UK chart rundown per episode.
-- The source charts may contain fewer than 40 real rows while the game catalogue is small;
-- missing ranks are never fabricated. As the charts grow, snapshots naturally capture ranks 1..40.

CREATE TABLE IF NOT EXISTS public.totp_chart_rundown_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  episode_id uuid NOT NULL REFERENCES public.totp_episodes(id) ON DELETE CASCADE,
  chart_snapshot_date date NOT NULL,
  chart_type text NOT NULL CHECK (chart_type IN ('streaming', 'digital_sales')),
  chart_rank integer NOT NULL CHECK (chart_rank BETWEEN 1 AND 40),
  song_id uuid REFERENCES public.songs(id) ON DELETE SET NULL,
  band_id uuid REFERENCES public.bands(id) ON DELETE SET NULL,
  song_title text NOT NULL,
  artist_name text NOT NULL,
  trend text,
  trend_change integer,
  weekly_plays bigint NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (episode_id, chart_type, chart_rank)
);

CREATE INDEX IF NOT EXISTS totp_chart_rundown_episode_chart_rank_idx
  ON public.totp_chart_rundown_snapshots (episode_id, chart_type, chart_rank);

ALTER TABLE public.totp_chart_rundown_snapshots ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.totp_chart_rundown_snapshots FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.totp_capture_chart_rundown_for_episode(p_episode_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_snapshot_date date;
  v_inserted integer := 0;
BEGIN
  SELECT chart_snapshot_date
  INTO v_snapshot_date
  FROM public.totp_episodes
  WHERE id = p_episode_id;

  IF v_snapshot_date IS NULL THEN
    RAISE EXCEPTION 'Top of the Pops episode not found';
  END IF;

  INSERT INTO public.totp_chart_rundown_snapshots (
    episode_id,
    chart_snapshot_date,
    chart_type,
    chart_rank,
    song_id,
    band_id,
    song_title,
    artist_name,
    trend,
    trend_change,
    weekly_plays
  )
  SELECT
    p_episode_id,
    v_snapshot_date,
    ce.chart_type::text,
    ce.rank,
    ce.song_id,
    s.band_id,
    s.title::text,
    coalesce(
      nullif(b.artist_name::text, ''),
      nullif(b.name::text, ''),
      nullif(p.display_name::text, ''),
      nullif(p.username::text, ''),
      'Unknown Artist'
    ),
    ce.trend::text,
    ce.trend_change,
    coalesce(ce.weekly_plays, ce.plays_count, 0)
  FROM public.chart_entries ce
  JOIN public.songs s ON s.id = ce.song_id
  LEFT JOIN public.bands b ON b.id = s.band_id
  LEFT JOIN public.profiles p ON p.user_id = s.user_id
  WHERE ce.chart_date = v_snapshot_date
    AND ce.country = 'United Kingdom'
    AND ce.entry_type = 'song'
    AND ce.chart_type IN ('streaming', 'digital_sales')
    AND ce.rank BETWEEN 1 AND 40
  ORDER BY ce.chart_type, ce.rank, ce.song_id
  ON CONFLICT (episode_id, chart_type, chart_rank) DO NOTHING;

  GET DIAGNOSTICS v_inserted = ROW_COUNT;
  RETURN v_inserted;
END;
$$;

REVOKE ALL ON FUNCTION public.totp_capture_chart_rundown_for_episode(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.totp_capture_chart_rundown_for_episode(uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.totp_capture_chart_rundown_on_episode_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.totp_capture_chart_rundown_for_episode(NEW.id);
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.totp_capture_chart_rundown_on_episode_insert() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS totp_capture_chart_rundown_after_episode_insert ON public.totp_episodes;
CREATE TRIGGER totp_capture_chart_rundown_after_episode_insert
AFTER INSERT ON public.totp_episodes
FOR EACH ROW
EXECUTE FUNCTION public.totp_capture_chart_rundown_on_episode_insert();

-- Backfill any already-prepared episodes. Existing snapshot rows are immutable and are not replaced.
DO $$
DECLARE
  v_episode record;
BEGIN
  FOR v_episode IN SELECT id FROM public.totp_episodes ORDER BY episode_date LOOP
    PERFORM public.totp_capture_chart_rundown_for_episode(v_episode.id);
  END LOOP;
END;
$$;

CREATE OR REPLACE FUNCTION public.totp_public_chart_rundown(p_episode_id uuid DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_episode_id uuid;
  v_snapshot_date date;
  v_is_admin boolean := false;
  v_streaming jsonb := '[]'::jsonb;
  v_digital_sales jsonb := '[]'::jsonb;
BEGIN
  IF auth.uid() IS NOT NULL THEN
    v_is_admin := public.has_role(auth.uid(), 'admin');
  END IF;

  IF p_episode_id IS NULL THEN
    SELECT id, chart_snapshot_date
    INTO v_episode_id, v_snapshot_date
    FROM public.totp_episodes
    WHERE status <> 'cancelled'
      AND broadcast_at <= now()
    ORDER BY broadcast_at DESC
    LIMIT 1;
  ELSE
    SELECT id, chart_snapshot_date
    INTO v_episode_id, v_snapshot_date
    FROM public.totp_episodes
    WHERE id = p_episode_id
      AND status <> 'cancelled'
      AND (broadcast_at <= now() OR v_is_admin);
  END IF;

  IF v_episode_id IS NULL THEN
    RETURN jsonb_build_object(
      'episode_id', NULL,
      'chart_snapshot_date', NULL,
      'streaming', '[]'::jsonb,
      'digital_sales', '[]'::jsonb,
      'streaming_count', 0,
      'digital_sales_count', 0
    );
  END IF;

  SELECT coalesce(jsonb_agg(jsonb_build_object(
      'rank', chart_rank,
      'song_id', song_id,
      'band_id', band_id,
      'song_title', song_title,
      'artist_name', artist_name,
      'trend', trend,
      'trend_change', trend_change,
      'weekly_plays', weekly_plays
    ) ORDER BY chart_rank), '[]'::jsonb)
  INTO v_streaming
  FROM public.totp_chart_rundown_snapshots
  WHERE episode_id = v_episode_id
    AND chart_type = 'streaming';

  SELECT coalesce(jsonb_agg(jsonb_build_object(
      'rank', chart_rank,
      'song_id', song_id,
      'band_id', band_id,
      'song_title', song_title,
      'artist_name', artist_name,
      'trend', trend,
      'trend_change', trend_change,
      'weekly_plays', weekly_plays
    ) ORDER BY chart_rank), '[]'::jsonb)
  INTO v_digital_sales
  FROM public.totp_chart_rundown_snapshots
  WHERE episode_id = v_episode_id
    AND chart_type = 'digital_sales';

  RETURN jsonb_build_object(
    'episode_id', v_episode_id,
    'chart_snapshot_date', v_snapshot_date,
    'streaming', v_streaming,
    'digital_sales', v_digital_sales,
    'streaming_count', jsonb_array_length(v_streaming),
    'digital_sales_count', jsonb_array_length(v_digital_sales)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.totp_public_chart_rundown(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.totp_public_chart_rundown(uuid) TO anon, authenticated;

COMMENT ON TABLE public.totp_chart_rundown_snapshots IS
  'Immutable per-episode copies of the available UK streaming and digital-sales chart positions 1-40 used by Top of the Pops.';
COMMENT ON FUNCTION public.totp_public_chart_rundown(uuid) IS
  'Read-only frozen UK chart rundown for broadcast/archive presentation. Missing chart positions are never fabricated.';
