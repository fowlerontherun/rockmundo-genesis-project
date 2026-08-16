-- ============================================================
-- 1. Feedback columns
-- ============================================================
ALTER TABLE public.radio_submissions
  ADD COLUMN IF NOT EXISTS score numeric,
  ADD COLUMN IF NOT EXISTS evaluation jsonb,
  ADD COLUMN IF NOT EXISTS feedback text,
  ADD COLUMN IF NOT EXISTS projected_weekly_plays integer,
  ADD COLUMN IF NOT EXISTS projected_weekly_reach integer;

ALTER TABLE public.newspaper_submissions
  ADD COLUMN IF NOT EXISTS score numeric,
  ADD COLUMN IF NOT EXISTS evaluation jsonb,
  ADD COLUMN IF NOT EXISTS feedback text;

ALTER TABLE public.magazine_submissions
  ADD COLUMN IF NOT EXISTS score numeric,
  ADD COLUMN IF NOT EXISTS evaluation jsonb,
  ADD COLUMN IF NOT EXISTS feedback text;

ALTER TABLE public.podcast_submissions
  ADD COLUMN IF NOT EXISTS score numeric,
  ADD COLUMN IF NOT EXISTS evaluation jsonb,
  ADD COLUMN IF NOT EXISTS feedback text;

ALTER TABLE public.website_submissions
  ADD COLUMN IF NOT EXISTS score numeric,
  ADD COLUMN IF NOT EXISTS evaluation jsonb,
  ADD COLUMN IF NOT EXISTS feedback text;

-- ============================================================
-- 2. Market benchmarks (scale with world size + song quality)
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_media_market_benchmarks()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_characters integer := 0;
  v_bands integer := 0;
  v_songs integer := 0;
  v_avg numeric := 40;
  v_p50 numeric := 40;
  v_p75 numeric := 55;
  v_p90 numeric := 70;
  v_pressure numeric := 1;
BEGIN
  SELECT count(*) INTO v_characters FROM public.profiles;
  SELECT count(*) INTO v_bands FROM public.bands WHERE coalesce(status::text, 'active') = 'active';

  SELECT
    count(*),
    coalesce(avg(coalesce(quality_score, 0)), 40),
    coalesce(percentile_cont(0.5) WITHIN GROUP (ORDER BY coalesce(quality_score, 0)), 40),
    coalesce(percentile_cont(0.75) WITHIN GROUP (ORDER BY coalesce(quality_score, 0)), 55),
    coalesce(percentile_cont(0.9) WITHIN GROUP (ORDER BY coalesce(quality_score, 0)), 70)
  INTO v_songs, v_avg, v_p50, v_p75, v_p90
  FROM public.songs
  WHERE status IN ('recorded', 'released');

  IF v_songs < 5 THEN
    v_avg := greatest(v_avg, 35);
    v_p50 := greatest(v_p50, 35);
    v_p75 := greatest(v_p75, 50);
    v_p90 := greatest(v_p90, 65);
  END IF;

  -- Competition pressure: 1.00 with a handful of bands, up to ~1.35 in a busy world
  v_pressure := 1 + least(0.35, ln(1 + (greatest(v_bands, 1)::numeric / 25)) * 0.15)
                  + least(0.10, ln(1 + (greatest(v_characters, 1)::numeric / 500)) * 0.08);

  RETURN jsonb_build_object(
    'active_characters', v_characters,
    'active_bands', v_bands,
    'rated_songs', v_songs,
    'avg_song_quality', round(v_avg, 1),
    'median_song_quality', round(v_p50, 1),
    'p75_song_quality', round(v_p75, 1),
    'p90_song_quality', round(v_p90, 1),
    'competition_pressure', round(v_pressure, 3),
    'quality_bars', jsonb_build_object(
      '1', public.media_quality_bar(1),
      '2', public.media_quality_bar(2),
      '3', public.media_quality_bar(3),
      '4', public.media_quality_bar(4),
      '5', public.media_quality_bar(5)
    )
  );
END;
$$;

-- Bar for a given outlet tier, derived from live song-quality distribution
CREATE OR REPLACE FUNCTION public.media_quality_bar(p_tier integer)
RETURNS integer
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tier integer := greatest(1, least(5, coalesce(p_tier, 1)));
  v_avg numeric := 40;
  v_p50 numeric := 40;
  v_p75 numeric := 55;
  v_p90 numeric := 70;
  v_songs integer := 0;
  v_bands integer := 0;
  v_characters integer := 0;
  v_pressure numeric := 1;
  v_anchor numeric;
  v_bar numeric;
BEGIN
  SELECT
    count(*),
    coalesce(avg(coalesce(quality_score, 0)), 40),
    coalesce(percentile_cont(0.5) WITHIN GROUP (ORDER BY coalesce(quality_score, 0)), 40),
    coalesce(percentile_cont(0.75) WITHIN GROUP (ORDER BY coalesce(quality_score, 0)), 55),
    coalesce(percentile_cont(0.9) WITHIN GROUP (ORDER BY coalesce(quality_score, 0)), 70)
  INTO v_songs, v_avg, v_p50, v_p75, v_p90
  FROM public.songs
  WHERE status IN ('recorded', 'released');

  IF v_songs < 5 THEN
    v_avg := greatest(v_avg, 35);
    v_p50 := greatest(v_p50, 35);
    v_p75 := greatest(v_p75, 50);
    v_p90 := greatest(v_p90, 65);
  END IF;

  SELECT count(*) INTO v_bands FROM public.bands WHERE coalesce(status::text, 'active') = 'active';
  SELECT count(*) INTO v_characters FROM public.profiles;

  v_pressure := 1 + least(0.35, ln(1 + (greatest(v_bands, 1)::numeric / 25)) * 0.15)
                  + least(0.10, ln(1 + (greatest(v_characters, 1)::numeric / 500)) * 0.08);

  v_anchor := CASE
    WHEN v_tier <= 2 THEN v_p50
    WHEN v_tier <= 4 THEN v_p75
    ELSE v_p90
  END;

  v_bar := ((v_avg * (0.45 + 0.11 * v_tier)) * 0.6 + v_anchor * 0.4) * v_pressure;

  RETURN greatest(10, least(96, round(v_bar)))::integer;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_media_market_benchmarks() TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.media_quality_bar(integer) TO anon, authenticated, service_role;

-- ============================================================
-- 3. Radio submission evaluation
-- ============================================================
CREATE OR REPLACE FUNCTION public.evaluate_radio_submission(
  p_song_id uuid,
  p_station_id uuid,
  p_band_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_song record;
  v_station record;
  v_bar integer;
  v_factors jsonb := '[]'::jsonb;
  v_score numeric := 0;
  v_chance numeric;
  v_genre_match boolean := true;
  v_country_fame numeric := 0;
  v_min_fame numeric := 0;
  v_rep numeric := 0;
  v_fans integer := 0;
  v_competition integer := 0;
  v_delta numeric;
  v_plays integer;
  v_reach integer;
  v_verdict text;
BEGIN
  SELECT id, title, genre, coalesce(quality_score, 0) AS quality, coalesce(hype, 0) AS hype
    INTO v_song FROM public.songs WHERE id = p_song_id;
  SELECT id, name, coalesce(quality_level, 1) AS tier, coalesce(listener_base, 1000) AS listeners,
         coalesce(accepted_genres, '{}') AS genres, country, coalesce(min_fame_required, 0) AS min_fame,
         coalesce(min_fans_required, 0) AS min_fans
    INTO v_station FROM public.radio_stations WHERE id = p_station_id;

  IF v_song IS NULL OR v_station IS NULL THEN
    RETURN jsonb_build_object('error', 'NOT_FOUND');
  END IF;

  v_bar := public.media_quality_bar(v_station.tier);

  -- Quality vs live market bar (worth up to ~45 points)
  v_delta := v_song.quality - v_bar;
  v_score := v_score + greatest(-35, least(45, v_delta * 1.6));
  v_factors := v_factors || jsonb_build_object(
    'label', 'Song quality',
    'detail', format('Quality %s vs current market bar %s for a tier %s station', v_song.quality, v_bar, v_station.tier),
    'delta', round(greatest(-35, least(45, v_delta * 1.6))),
    'status', CASE WHEN v_delta >= 0 THEN 'good' WHEN v_delta >= -10 THEN 'warn' ELSE 'bad' END
  );

  -- Genre fit
  IF array_length(v_station.genres, 1) IS NOT NULL AND array_length(v_station.genres, 1) > 0 THEN
    v_genre_match := EXISTS (
      SELECT 1 FROM unnest(v_station.genres) g WHERE lower(g) = lower(coalesce(v_song.genre, ''))
    );
  END IF;
  v_score := v_score + CASE WHEN v_genre_match THEN 18 ELSE -25 END;
  v_factors := v_factors || jsonb_build_object(
    'label', 'Genre fit',
    'detail', CASE WHEN v_genre_match
      THEN format('%s is on this station''s playlist', coalesce(v_song.genre, 'Your genre'))
      ELSE format('%s is outside this station''s format (%s)', coalesce(v_song.genre, 'Your genre'), array_to_string(v_station.genres, ', ')) END,
    'delta', CASE WHEN v_genre_match THEN 18 ELSE -25 END,
    'status', CASE WHEN v_genre_match THEN 'good' ELSE 'bad' END
  );

  -- Regional fame requirement, scaled by market pressure
  IF p_band_id IS NOT NULL THEN
    SELECT coalesce(fame, 0), coalesce(total_fans, 0), coalesce(reputation_score, 0)
      INTO v_country_fame, v_fans, v_rep
    FROM public.bands WHERE id = p_band_id;

    BEGIN
      SELECT coalesce(fame, 0) INTO v_country_fame
      FROM public.band_country_fans
      WHERE band_id = p_band_id AND lower(country) = lower(coalesce(v_station.country, ''))
      LIMIT 1;
    EXCEPTION WHEN OTHERS THEN
      NULL;
    END;
    v_country_fame := coalesce(v_country_fame, 0);
  END IF;

  v_min_fame := round(v_station.min_fame * least(1.4, (public.get_media_market_benchmarks() ->> 'competition_pressure')::numeric));

  IF v_min_fame > 0 THEN
    IF v_country_fame >= v_min_fame THEN
      v_score := v_score + 12;
      v_factors := v_factors || jsonb_build_object(
        'label', 'Local standing',
        'detail', format('%s fame in %s clears the %s required', round(v_country_fame), coalesce(v_station.country, 'this market'), v_min_fame),
        'delta', 12, 'status', 'good');
    ELSE
      v_score := v_score - 30;
      v_factors := v_factors || jsonb_build_object(
        'label', 'Local standing',
        'detail', format('%s fame in %s, this station wants %s', round(v_country_fame), coalesce(v_station.country, 'this market'), v_min_fame),
        'delta', -30, 'status', 'bad');
    END IF;
  END IF;

  -- Hype
  IF coalesce(v_song.hype, 0) >= 100 THEN
    v_score := v_score + 12;
    v_factors := v_factors || jsonb_build_object('label', 'Buzz', 'detail', format('Song hype %s is generating demand', v_song.hype), 'delta', 12, 'status', 'good');
  ELSIF coalesce(v_song.hype, 0) >= 40 THEN
    v_score := v_score + 5;
    v_factors := v_factors || jsonb_build_object('label', 'Buzz', 'detail', format('Song hype %s is modest', v_song.hype), 'delta', 5, 'status', 'warn');
  ELSE
    v_factors := v_factors || jsonb_build_object('label', 'Buzz', 'detail', 'Little promotional buzz behind this song', 'delta', 0, 'status', 'warn');
  END IF;

  -- Reputation
  IF v_rep >= 40 THEN v_delta := 10;
  ELSIF v_rep >= 20 THEN v_delta := 5;
  ELSIF v_rep <= -40 THEN v_delta := -18;
  ELSIF v_rep <= -20 THEN v_delta := -9;
  ELSE v_delta := 0; END IF;
  v_score := v_score + v_delta;
  IF v_delta <> 0 THEN
    v_factors := v_factors || jsonb_build_object('label', 'Reputation',
      'detail', format('Band reputation %s', round(v_rep)), 'delta', v_delta,
      'status', CASE WHEN v_delta > 0 THEN 'good' ELSE 'bad' END);
  END IF;

  -- Playlist competition this week
  SELECT count(*) INTO v_competition
  FROM public.radio_submissions
  WHERE station_id = p_station_id
    AND submitted_at >= now() - interval '7 days';

  IF v_competition > 5 THEN
    v_delta := -least(15, (v_competition - 5) * 1.5);
    v_score := v_score + v_delta;
    v_factors := v_factors || jsonb_build_object('label', 'Playlist competition',
      'detail', format('%s other submissions this week', v_competition), 'delta', round(v_delta), 'status', 'warn');
  END IF;

  -- Convert score to a probability
  v_chance := greatest(3, least(96, 50 + v_score * 0.85));

  v_plays := greatest(0, round((v_station.tier * 3 + 2) * (v_chance / 100.0) * (1 + v_song.quality / 100.0)))::integer;
  v_reach := greatest(0, round(v_station.listeners * (v_chance / 100.0) * 0.35))::integer;

  v_verdict := CASE
    WHEN v_chance >= 75 THEN 'Very likely to be added to rotation'
    WHEN v_chance >= 50 THEN 'Solid chance, the programmer will weigh it up'
    WHEN v_chance >= 25 THEN 'A long shot at this station'
    ELSE 'Almost certain rejection at this level'
  END;

  RETURN jsonb_build_object(
    'song_id', p_song_id,
    'station_id', p_station_id,
    'station_name', v_station.name,
    'station_tier', v_station.tier,
    'quality_bar', v_bar,
    'song_quality', v_song.quality,
    'score', round(v_score),
    'chance', round(v_chance),
    'verdict', v_verdict,
    'genre_match', v_genre_match,
    'factors', v_factors,
    'projected_weekly_plays', v_plays,
    'projected_weekly_reach', v_reach,
    'benchmarks', public.get_media_market_benchmarks()
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.evaluate_radio_submission(uuid, uuid, uuid) TO authenticated, service_role;

-- ============================================================
-- 4. Radio review processor (decision + detailed feedback)
-- ============================================================
CREATE OR REPLACE FUNCTION public.review_radio_submission(p_submission_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_sub record;
  v_eval jsonb;
  v_chance numeric;
  v_accepted boolean;
  v_feedback text;
  v_show_id uuid;
  v_week date;
  v_advice text := '';
BEGIN
  SELECT * INTO v_sub FROM public.radio_submissions WHERE id = p_submission_id FOR UPDATE;
  IF v_sub IS NULL OR v_sub.status <> 'pending' THEN
    RETURN jsonb_build_object('skipped', true);
  END IF;

  v_eval := public.evaluate_radio_submission(v_sub.song_id, v_sub.station_id, v_sub.band_id);

  IF v_eval ? 'error' THEN
    UPDATE public.radio_submissions
      SET status = 'rejected', reviewed_at = now(),
          rejection_reason = 'Song or station data is no longer available',
          feedback = 'This submission could not be reviewed because the song or station record was removed.',
          evaluation = v_eval
    WHERE id = p_submission_id;
    RETURN jsonb_build_object('status', 'rejected');
  END IF;

  v_chance := (v_eval ->> 'chance')::numeric;
  v_accepted := random() * 100 < v_chance;

  IF v_accepted THEN
    v_feedback := format(
      'Added to rotation at %s. Scored %s against a market bar of %s (tier %s station). Expect around %s plays a week reaching roughly %s listeners.',
      v_eval ->> 'station_name', v_eval ->> 'song_quality', v_eval ->> 'quality_bar',
      v_eval ->> 'station_tier', v_eval ->> 'projected_weekly_plays', v_eval ->> 'projected_weekly_reach');

    UPDATE public.radio_submissions
      SET status = 'accepted', reviewed_at = now(), evaluation = v_eval,
          score = (v_eval ->> 'score')::numeric, feedback = v_feedback,
          projected_weekly_plays = (v_eval ->> 'projected_weekly_plays')::integer,
          projected_weekly_reach = (v_eval ->> 'projected_weekly_reach')::integer
    WHERE id = p_submission_id;

    SELECT id INTO v_show_id FROM public.radio_shows
      WHERE station_id = v_sub.station_id AND is_active = true LIMIT 1;

    IF v_show_id IS NOT NULL THEN
      v_week := (date_trunc('week', now()))::date;
      INSERT INTO public.radio_playlists (show_id, song_id, week_start_date, is_active)
      SELECT v_show_id, v_sub.song_id, v_week, true
      WHERE NOT EXISTS (
        SELECT 1 FROM public.radio_playlists
        WHERE show_id = v_show_id AND song_id = v_sub.song_id AND week_start_date = v_week
      );
    END IF;

    IF v_sub.band_id IS NOT NULL THEN
      UPDATE public.bands
        SET morale = least(100, coalesce(morale, 50) + 3),
            reputation_score = least(100, coalesce(reputation_score, 0) + 2)
      WHERE id = v_sub.band_id;
    END IF;
  ELSE
    IF (v_eval ->> 'song_quality')::numeric < (v_eval ->> 'quality_bar')::numeric THEN
      v_advice := format(' Raise the song to at least %s quality, or target a lower tier station.', v_eval ->> 'quality_bar');
    ELSIF NOT (v_eval ->> 'genre_match')::boolean THEN
      v_advice := ' Submit this to a station that plays your genre.';
    ELSE
      v_advice := ' Build more local fame and hype, then resubmit next week.';
    END IF;

    v_feedback := format(
      'Passed over by %s. Scored %s against a market bar of %s (tier %s station).%s',
      v_eval ->> 'station_name', v_eval ->> 'song_quality', v_eval ->> 'quality_bar',
      v_eval ->> 'station_tier', v_advice);

    UPDATE public.radio_submissions
      SET status = 'rejected', reviewed_at = now(), evaluation = v_eval,
          score = (v_eval ->> 'score')::numeric, feedback = v_feedback,
          rejection_reason = v_feedback
    WHERE id = p_submission_id;

    IF v_sub.band_id IS NOT NULL THEN
      UPDATE public.bands SET morale = greatest(0, coalesce(morale, 50) - 1) WHERE id = v_sub.band_id;
    END IF;
  END IF;

  RETURN jsonb_build_object('status', CASE WHEN v_accepted THEN 'accepted' ELSE 'rejected' END, 'evaluation', v_eval);
END;
$$;

CREATE OR REPLACE FUNCTION public.process_pending_radio_submissions(p_limit integer DEFAULT 50)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r record;
  v_accepted integer := 0;
  v_rejected integer := 0;
  v_res jsonb;
BEGIN
  FOR r IN
    SELECT id FROM public.radio_submissions
    WHERE status = 'pending' AND submitted_at < now() - interval '15 minutes'
    ORDER BY submitted_at LIMIT greatest(1, coalesce(p_limit, 50))
  LOOP
    v_res := public.review_radio_submission(r.id);
    IF v_res ->> 'status' = 'accepted' THEN v_accepted := v_accepted + 1;
    ELSIF v_res ->> 'status' = 'rejected' THEN v_rejected := v_rejected + 1; END IF;
  END LOOP;

  RETURN jsonb_build_object('accepted', v_accepted, 'rejected', v_rejected, 'processed', v_accepted + v_rejected);
END;
$$;

GRANT EXECUTE ON FUNCTION public.review_radio_submission(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.process_pending_radio_submissions(integer) TO service_role;

-- ============================================================
-- 5. Press / podcast / website evaluation + review
-- ============================================================
CREATE OR REPLACE FUNCTION public.evaluate_media_submission(
  p_media_type text,
  p_media_id uuid,
  p_band_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_name text;
  v_tier integer := 2;
  v_min_fame numeric := 0;
  v_genres text[] := '{}';
  v_reach integer := 0;
  v_band record;
  v_avg_quality numeric := 0;
  v_bar integer;
  v_score numeric := 0;
  v_factors jsonb := '[]'::jsonb;
  v_genre_match boolean := true;
  v_pressure numeric;
  v_scaled_fame numeric;
  v_chance numeric;
  v_delta numeric;
BEGIN
  IF p_media_type = 'newspaper' THEN
    SELECT name, coalesce(quality_level,2), coalesce(min_fame_required,0), coalesce(genres,'{}'), coalesce(circulation,0)
      INTO v_name, v_tier, v_min_fame, v_genres, v_reach FROM public.newspapers WHERE id = p_media_id;
  ELSIF p_media_type = 'magazine' THEN
    SELECT name, coalesce(quality_level,2), coalesce(min_fame_required,0), coalesce(genres,'{}'), coalesce(readership,0)
      INTO v_name, v_tier, v_min_fame, v_genres, v_reach FROM public.magazines WHERE id = p_media_id;
  ELSIF p_media_type = 'podcast' THEN
    SELECT podcast_name, coalesce(quality_level,2), coalesce(min_fame_required,0), coalesce(genres,'{}'), coalesce(listener_base,0)
      INTO v_name, v_tier, v_min_fame, v_genres, v_reach FROM public.podcasts WHERE id = p_media_id;
  ELSIF p_media_type = 'website' THEN
    SELECT name, 2, coalesce(min_fame_required,0), coalesce(genres,'{}'), 0
      INTO v_name, v_tier, v_min_fame, v_genres, v_reach FROM public.websites WHERE id = p_media_id;
  ELSE
    RETURN jsonb_build_object('error', 'UNKNOWN_MEDIA_TYPE');
  END IF;

  IF v_name IS NULL THEN
    RETURN jsonb_build_object('error', 'NOT_FOUND');
  END IF;

  SELECT coalesce(fame,0) AS fame, coalesce(total_fans,0) AS fans,
         coalesce(reputation_score,0) AS rep, genre
    INTO v_band FROM public.bands WHERE id = p_band_id;

  IF v_band IS NULL THEN
    RETURN jsonb_build_object('error', 'BAND_NOT_FOUND');
  END IF;

  SELECT coalesce(avg(coalesce(quality_score,0)), 0) INTO v_avg_quality
  FROM public.songs WHERE band_id = p_band_id AND status IN ('recorded','released');

  v_bar := public.media_quality_bar(v_tier);
  v_pressure := (public.get_media_market_benchmarks() ->> 'competition_pressure')::numeric;
  v_scaled_fame := round(v_min_fame * least(1.4, v_pressure));

  -- Fame vs scaled requirement
  IF v_band.fame >= v_scaled_fame THEN
    v_delta := least(30, 10 + (CASE WHEN v_scaled_fame > 0 THEN least(20, (v_band.fame - v_scaled_fame) / greatest(1, v_scaled_fame) * 20) ELSE 8 END));
    v_score := v_score + v_delta;
    v_factors := v_factors || jsonb_build_object('label','Profile',
      'detail', format('Fame %s clears the %s this outlet expects right now', round(v_band.fame), v_scaled_fame),
      'delta', round(v_delta), 'status','good');
  ELSE
    v_score := v_score - 30;
    v_factors := v_factors || jsonb_build_object('label','Profile',
      'detail', format('Fame %s is short of the %s this outlet expects right now', round(v_band.fame), v_scaled_fame),
      'delta', -30, 'status','bad');
  END IF;

  -- Catalogue quality vs live bar
  v_delta := greatest(-30, least(35, (v_avg_quality - v_bar) * 1.3));
  v_score := v_score + v_delta;
  v_factors := v_factors || jsonb_build_object('label','Catalogue quality',
    'detail', format('Average recorded quality %s vs editorial bar %s (tier %s)', round(v_avg_quality,1), v_bar, v_tier),
    'delta', round(v_delta),
    'status', CASE WHEN v_avg_quality >= v_bar THEN 'good' WHEN v_avg_quality >= v_bar - 10 THEN 'warn' ELSE 'bad' END);

  -- Genre fit
  IF array_length(v_genres,1) IS NOT NULL AND array_length(v_genres,1) > 0 THEN
    v_genre_match := EXISTS (SELECT 1 FROM unnest(v_genres) g WHERE lower(g) = lower(coalesce(v_band.genre,'')));
  END IF;
  v_score := v_score + CASE WHEN v_genre_match THEN 14 ELSE -18 END;
  v_factors := v_factors || jsonb_build_object('label','Editorial fit',
    'detail', CASE WHEN v_genre_match THEN format('%s suits this outlet', coalesce(v_band.genre,'Your genre'))
                   ELSE format('%s is off-brief for this outlet', coalesce(v_band.genre,'Your genre')) END,
    'delta', CASE WHEN v_genre_match THEN 14 ELSE -18 END,
    'status', CASE WHEN v_genre_match THEN 'good' ELSE 'bad' END);

  -- Reputation
  IF v_band.rep >= 30 THEN v_delta := 10;
  ELSIF v_band.rep <= -30 THEN v_delta := -15;
  ELSE v_delta := 0; END IF;
  v_score := v_score + v_delta;
  IF v_delta <> 0 THEN
    v_factors := v_factors || jsonb_build_object('label','Reputation',
      'detail', format('Band reputation %s', round(v_band.rep)), 'delta', v_delta,
      'status', CASE WHEN v_delta > 0 THEN 'good' ELSE 'bad' END);
  END IF;

  v_chance := greatest(3, least(96, 50 + v_score * 0.85));

  RETURN jsonb_build_object(
    'media_type', p_media_type,
    'media_id', p_media_id,
    'outlet_name', v_name,
    'outlet_tier', v_tier,
    'reach', v_reach,
    'quality_bar', v_bar,
    'band_avg_quality', round(v_avg_quality,1),
    'required_fame', v_scaled_fame,
    'score', round(v_score),
    'chance', round(v_chance),
    'genre_match', v_genre_match,
    'factors', v_factors,
    'verdict', CASE
      WHEN v_chance >= 75 THEN 'The desk is very likely to run this'
      WHEN v_chance >= 50 THEN 'A realistic pitch for this outlet'
      WHEN v_chance >= 25 THEN 'An ambitious pitch at this level'
      ELSE 'This outlet is well out of reach for now' END,
    'benchmarks', public.get_media_market_benchmarks()
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.evaluate_media_submission(text, uuid, uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.process_media_submission_reviews(p_limit integer DEFAULT 100)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_types text[] := ARRAY['newspaper','magazine','podcast','website'];
  v_type text;
  v_table text;
  v_id_col text;
  r record;
  v_eval jsonb;
  v_accepted boolean;
  v_feedback text;
  v_fame integer;
  v_fans integer;
  v_pay integer;
  v_total_accepted integer := 0;
  v_total_rejected integer := 0;
BEGIN
  FOREACH v_type IN ARRAY v_types LOOP
    v_table := v_type || '_submissions';
    v_id_col := v_type || '_id';

    FOR r IN EXECUTE format(
      'SELECT id, band_id, %I AS media_id FROM public.%I WHERE status = %L AND submitted_at < now() - interval ''15 minutes'' ORDER BY submitted_at LIMIT %s',
      v_id_col, v_table, 'pending', greatest(1, coalesce(p_limit, 100)))
    LOOP
      IF r.band_id IS NULL THEN
        EXECUTE format('UPDATE public.%I SET status = %L, reviewed_at = now(), rejection_reason = %L, feedback = %L WHERE id = %L',
          v_table, 'rejected', 'No band attached to this pitch', 'This pitch had no band attached, so the desk could not review it.', r.id);
        v_total_rejected := v_total_rejected + 1;
        CONTINUE;
      END IF;

      v_eval := public.evaluate_media_submission(v_type, r.media_id, r.band_id);

      IF v_eval ? 'error' THEN
        EXECUTE format('UPDATE public.%I SET status = %L, reviewed_at = now(), rejection_reason = %L, feedback = %L WHERE id = %L',
          v_table, 'rejected', 'Outlet no longer available', 'This outlet is no longer accepting pitches.', r.id);
        v_total_rejected := v_total_rejected + 1;
        CONTINUE;
      END IF;

      v_accepted := random() * 100 < (v_eval ->> 'chance')::numeric;

      IF v_accepted THEN
        SELECT
          coalesce(fame_boost_min, 5) + floor(random() * greatest(1, coalesce(fame_boost_max, 15) - coalesce(fame_boost_min, 5) + 1)),
          coalesce(fan_boost_min, 10) + floor(random() * greatest(1, coalesce(fan_boost_max, 100) - coalesce(fan_boost_min, 10) + 1)),
          coalesce(compensation_min, 0) + floor(random() * greatest(1, coalesce(compensation_max, 0) - coalesce(compensation_min, 0) + 1))
        INTO v_fame, v_fans, v_pay
        FROM (
          SELECT fame_boost_min, fame_boost_max, fan_boost_min, fan_boost_max, compensation_min, compensation_max
          FROM public.newspapers WHERE v_type = 'newspaper' AND id = r.media_id
          UNION ALL
          SELECT fame_boost_min, fame_boost_max, fan_boost_min, fan_boost_max, compensation_min, compensation_max
          FROM public.magazines WHERE v_type = 'magazine' AND id = r.media_id
          UNION ALL
          SELECT fame_boost_min, fame_boost_max, fan_boost_min, fan_boost_max, compensation_min, compensation_max
          FROM public.podcasts WHERE v_type = 'podcast' AND id = r.media_id
          UNION ALL
          SELECT fame_boost_min, fame_boost_max, fan_boost_min, fan_boost_max, compensation_min, compensation_max
          FROM public.websites WHERE v_type = 'website' AND id = r.media_id
        ) src
        LIMIT 1;

        v_fame := coalesce(v_fame, 5);
        v_fans := coalesce(v_fans, 20);
        v_pay := coalesce(v_pay, 0);

        v_feedback := format(
          'Confirmed by %s. Scored %s with a catalogue average of %s against an editorial bar of %s. Booked for +%s fame, +%s fans and a %s fee.',
          v_eval ->> 'outlet_name', v_eval ->> 'score', v_eval ->> 'band_avg_quality',
          v_eval ->> 'quality_bar', v_fame, v_fans, v_pay);

        EXECUTE format(
          'UPDATE public.%I SET status = %L, reviewed_at = now(), fame_boost = %s, fan_boost = %s, compensation = %s, evaluation = %L, score = %s, feedback = %L WHERE id = %L',
          v_table, 'accepted', v_fame, v_fans, v_pay, v_eval::text, (v_eval ->> 'score')::numeric, v_feedback, r.id);

        UPDATE public.bands
          SET fame = coalesce(fame, 0) + v_fame,
              total_fans = coalesce(total_fans, 0) + v_fans
        WHERE id = r.band_id;

        v_total_accepted := v_total_accepted + 1;
      ELSE
        v_feedback := format(
          'Turned down by %s. Scored %s (chance %s%%). %s',
          v_eval ->> 'outlet_name', v_eval ->> 'score', v_eval ->> 'chance',
          CASE
            WHEN (v_eval ->> 'band_avg_quality')::numeric < (v_eval ->> 'quality_bar')::numeric
              THEN format('Your catalogue averages %s against an editorial bar of %s, so record stronger material or pitch a smaller outlet.',
                          v_eval ->> 'band_avg_quality', v_eval ->> 'quality_bar')
            WHEN NOT (v_eval ->> 'genre_match')::boolean
              THEN 'Your genre is off-brief here, pitch outlets that cover your style.'
            ELSE format('Build fame towards %s and try again.', v_eval ->> 'required_fame')
          END);

        EXECUTE format(
          'UPDATE public.%I SET status = %L, reviewed_at = now(), evaluation = %L, score = %s, feedback = %L, rejection_reason = %L WHERE id = %L',
          v_table, 'rejected', v_eval::text, (v_eval ->> 'score')::numeric, v_feedback, v_feedback, r.id);

        v_total_rejected := v_total_rejected + 1;
      END IF;
    END LOOP;
  END LOOP;

  RETURN jsonb_build_object('accepted', v_total_accepted, 'rejected', v_total_rejected);
END;
$$;

GRANT EXECUTE ON FUNCTION public.process_media_submission_reviews(integer) TO service_role;

-- ============================================================
-- 6. Schedule the press/podcast reviewer
-- ============================================================
SELECT cron.unschedule('process-media-submissions')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'process-media-submissions');

SELECT cron.schedule(
  'process-media-submissions',
  '*/20 * * * *',
  $cron$ SELECT public.process_media_submission_reviews(100); $cron$
);