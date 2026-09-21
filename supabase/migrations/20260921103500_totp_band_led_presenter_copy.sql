-- Keep Top of the Pops presenter voice copy independent of song-title pronunciation.
-- Song titles remain visual in lower thirds, chart graphics and running-order UI.
-- The signature is unchanged for backwards compatibility; p_song_title is deliberately unused.

CREATE OR REPLACE FUNCTION public.totp_presenter_intro(
  p_presenter_key text,
  p_show_variant text,
  p_rank integer,
  p_band_name text,
  p_song_title text
)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
AS $$
BEGIN
  IF p_show_variant = 'christmas' THEN
    RETURN format('It is Christmas on Top of the Pops — at number %s, welcome %s!', p_rank, p_band_name);
  END IF;

  IF p_show_variant = 'anniversary' THEN
    RETURN format('It is our Top of the Pops anniversary show — at number %s, welcome %s!', p_rank, p_band_name);
  END IF;

  IF p_show_variant = 'milestone' THEN
    RETURN format('A milestone night on Top of the Pops — at number %s, make some noise for %s!', p_rank, p_band_name);
  END IF;

  RETURN CASE p_presenter_key
    WHEN 'maya_stone' THEN format('Chart watchers, this is Maya Stone. At number %s, give it up for %s!', p_rank, p_band_name)
    WHEN 'jack_mercer' THEN format('London, make some noise. At number %s this week, here is another chart hit from %s!', p_rank, p_band_name)
    WHEN 'nia_vale' THEN format('Tonight on RockMundo Television, number %s belongs to %s. Here they are!', p_rank, p_band_name)
    ELSE format('At number %s this week, please welcome %s!', p_rank, p_band_name)
  END;
END;
$$;

COMMENT ON FUNCTION public.totp_presenter_intro(text,text,integer,text,text) IS
  'Builds band-led presenter introductions without speaking song titles; song titles remain visual-only in the broadcast package.';


-- Existing future running orders may already have the old song-title wording persisted.
-- Refresh those rows, invalidate episode-specific presenter takes/manifests, and stop
-- any in-flight render that was built against the old dialogue.
WITH affected_episodes AS (
  SELECT e.id
  FROM public.totp_episodes e
  WHERE e.status <> 'cancelled'
    AND e.broadcast_at > now()
),
refreshed AS (
  UPDATE public.totp_performances p
  SET presenter_intro = public.totp_presenter_intro(
    e.presenter_key,
    e.show_variant,
    p.qualifying_rank,
    b.name::text,
    s.title::text
  )
  FROM public.totp_episodes e
  JOIN public.bands b ON true
  JOIN public.songs s ON true
  WHERE p.episode_id = e.id
    AND e.id IN (SELECT id FROM affected_episodes)
    AND b.id = p.band_id
    AND s.id = p.song_id
  RETURNING p.episode_id
)
UPDATE public.totp_episode_plans pl
SET presenter_audio = '{}'::jsonb,
    updated_at = now()
WHERE pl.episode_id IN (SELECT DISTINCT episode_id FROM refreshed);

UPDATE public.totp_render_jobs j
SET state = 'cancelled',
    finished_at = now(),
    error_message = 'Presenter dialogue changed; regenerate the episode manifest and render.'
WHERE j.episode_id IN (
  SELECT e.id
  FROM public.totp_episodes e
  WHERE e.status <> 'cancelled'
    AND e.broadcast_at > now()
)
  AND j.state IN ('queued', 'rendering');

DELETE FROM public.totp_episode_manifests m
WHERE m.episode_id IN (
  SELECT e.id
  FROM public.totp_episodes e
  WHERE e.status <> 'cancelled'
    AND e.broadcast_at > now()
);

CREATE OR REPLACE FUNCTION public.totp_admin_test_chart_rundown(p_snapshot_date date)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $
DECLARE
  v_streaming jsonb := '[]'::jsonb;
  v_digital_sales jsonb := '[]'::jsonb;
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Admin access required';
  END IF;

  IF p_snapshot_date IS NULL THEN
    RAISE EXCEPTION 'A chart snapshot date is required';
  END IF;

  SELECT coalesce(jsonb_agg(jsonb_build_object(
    'rank', rows.rank,
    'song_id', rows.song_id,
    'band_id', rows.band_id,
    'song_title', rows.song_title,
    'artist_name', rows.artist_name,
    'trend', rows.trend,
    'trend_change', rows.trend_change,
    'weekly_plays', rows.weekly_plays
  ) ORDER BY rows.rank), '[]'::jsonb)
  INTO v_streaming
  FROM (
    SELECT
      ce.rank,
      ce.song_id,
      s.band_id,
      s.title::text AS song_title,
      coalesce(nullif(b.artist_name::text, ''), nullif(b.name::text, ''), nullif(p.display_name::text, ''), nullif(p.username::text, ''), 'Unknown Artist') AS artist_name,
      ce.trend::text AS trend,
      ce.trend_change,
      coalesce(ce.weekly_plays, ce.plays_count, 0) AS weekly_plays
    FROM public.chart_entries ce
    JOIN public.songs s ON s.id = ce.song_id
    LEFT JOIN public.bands b ON b.id = s.band_id
    LEFT JOIN public.profiles p ON p.user_id = s.user_id
    WHERE ce.chart_date = p_snapshot_date
      AND ce.country = 'United Kingdom'
      AND ce.entry_type = 'song'
      AND ce.chart_type = 'streaming'
      AND ce.rank BETWEEN 1 AND 40
  ) rows;

  SELECT coalesce(jsonb_agg(jsonb_build_object(
    'rank', rows.rank,
    'song_id', rows.song_id,
    'band_id', rows.band_id,
    'song_title', rows.song_title,
    'artist_name', rows.artist_name,
    'trend', rows.trend,
    'trend_change', rows.trend_change,
    'weekly_plays', rows.weekly_plays
  ) ORDER BY rows.rank), '[]'::jsonb)
  INTO v_digital_sales
  FROM (
    SELECT
      ce.rank,
      ce.song_id,
      s.band_id,
      s.title::text AS song_title,
      coalesce(nullif(b.artist_name::text, ''), nullif(b.name::text, ''), nullif(p.display_name::text, ''), nullif(p.username::text, ''), 'Unknown Artist') AS artist_name,
      ce.trend::text AS trend,
      ce.trend_change,
      coalesce(ce.weekly_plays, ce.plays_count, 0) AS weekly_plays
    FROM public.chart_entries ce
    JOIN public.songs s ON s.id = ce.song_id
    LEFT JOIN public.bands b ON b.id = s.band_id
    LEFT JOIN public.profiles p ON p.user_id = s.user_id
    WHERE ce.chart_date = p_snapshot_date
      AND ce.country = 'United Kingdom'
      AND ce.entry_type = 'song'
      AND ce.chart_type = 'digital_sales'
      AND ce.rank BETWEEN 1 AND 40
  ) rows;

  RETURN jsonb_build_object(
    'episode_id', NULL,
    'chart_snapshot_date', p_snapshot_date,
    'streaming', v_streaming,
    'digital_sales', v_digital_sales,
    'streaming_count', jsonb_array_length(v_streaming),
    'digital_sales_count', jsonb_array_length(v_digital_sales)
  );
END;
$;

REVOKE ALL ON FUNCTION public.totp_admin_test_chart_rundown(date) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.totp_admin_test_chart_rundown(date) TO authenticated;


-- Make the existing admin schedule page a safe rescheduler as well as a creator.
CREATE OR REPLACE FUNCTION public.totp_admin_upsert_episode(
  p_episode_id uuid,
  p_episode_date date,
  p_broadcast_at timestamptz,
  p_check_in_at timestamptz,
  p_chart_snapshot_date date,
  p_city_id uuid,
  p_presenter_key text,
  p_show_variant text,
  p_max_performances integer
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id uuid;
  v_number bigint;
  v_today date := (now() AT TIME ZONE 'Europe/London')::date;
  v_existing public.totp_episodes%ROWTYPE;
  v_timing_changed boolean := false;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Only admins can plan Top of the Pops episodes';
  END IF;

  IF p_episode_date IS NULL THEN
    RAISE EXCEPTION 'An air date is required';
  END IF;

  IF p_episode_date < v_today THEN
    RAISE EXCEPTION 'Top of the Pops episodes cannot be scheduled or moved into the past';
  END IF;

  IF NOT public.totp_is_episode_date(p_episode_date) THEN
    RAISE EXCEPTION 'Top of the Pops broadcasts must use the fortnightly Thursday schedule';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.totp_episodes e
    WHERE e.episode_date = p_episode_date
      AND (p_episode_id IS NULL OR e.id <> p_episode_id)
  ) THEN
    RAISE EXCEPTION 'An episode is already scheduled for %', p_episode_date;
  END IF;

  IF p_episode_id IS NOT NULL THEN
    SELECT * INTO v_existing
    FROM public.totp_episodes
    WHERE id = p_episode_id
    FOR UPDATE;

    IF v_existing.id IS NULL THEN
      RAISE EXCEPTION 'Episode not found';
    END IF;

    IF v_existing.status IN ('broadcast', 'completed') THEN
      RAISE EXCEPTION 'Episodes that have already aired cannot be changed';
    END IF;

    v_timing_changed :=
      v_existing.episode_date IS DISTINCT FROM p_episode_date
      OR (p_broadcast_at IS NOT NULL AND v_existing.broadcast_at IS DISTINCT FROM p_broadcast_at)
      OR (p_check_in_at IS NOT NULL AND v_existing.check_in_at IS DISTINCT FROM p_check_in_at);

    IF v_timing_changed AND EXISTS (
      SELECT 1 FROM public.totp_invitations i WHERE i.episode_id = p_episode_id
    ) THEN
      RAISE EXCEPTION 'This episode has already sent invitations. Cancel it and create a new broadcast slot before changing the date or times.';
    END IF;

    UPDATE public.totp_episodes
    SET episode_date = p_episode_date,
        broadcast_at = COALESCE(p_broadcast_at, broadcast_at),
        check_in_at = COALESCE(p_check_in_at, check_in_at),
        chart_snapshot_date = COALESCE(p_chart_snapshot_date, chart_snapshot_date),
        city_id = COALESCE(p_city_id, city_id),
        presenter_key = COALESCE(NULLIF(p_presenter_key, ''), presenter_key),
        show_variant = COALESCE(NULLIF(p_show_variant, ''), show_variant),
        max_performances = COALESCE(p_max_performances, max_performances),
        status = CASE WHEN status = 'cancelled' THEN 'scheduled' ELSE status END,
        updated_at = now()
    WHERE id = p_episode_id
    RETURNING id INTO v_id;

    RETURN v_id;
  END IF;

  IF p_city_id IS NULL THEN
    RAISE EXCEPTION 'A host city is required';
  END IF;

  SELECT COALESCE(max(episode_number), 0) + 1
  INTO v_number
  FROM public.totp_episodes;

  INSERT INTO public.totp_episodes (
    episode_date, episode_number, status, chart_snapshot_date, city_id,
    check_in_at, broadcast_at, max_performances, presenter_key, show_variant
  ) VALUES (
    p_episode_date,
    v_number,
    'scheduled',
    COALESCE(p_chart_snapshot_date, p_episode_date - 1),
    p_city_id,
    COALESCE(p_check_in_at, (p_episode_date::timestamp + interval '18 hours') AT TIME ZONE 'Europe/London'),
    COALESCE(p_broadcast_at, (p_episode_date::timestamp + interval '19 hours 30 minutes') AT TIME ZONE 'Europe/London'),
    COALESCE(p_max_performances, 10),
    COALESCE(NULLIF(p_presenter_key, ''), 'alex_rayne'),
    COALESCE(NULLIF(p_show_variant, ''), 'regular')
  )
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

REVOKE ALL ON FUNCTION public.totp_admin_upsert_episode(uuid, date, timestamptz, timestamptz, date, uuid, text, text, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.totp_admin_upsert_episode(uuid, date, timestamptz, timestamptz, date, uuid, text, text, integer) TO authenticated;
