
-- =========================================================
-- Battle of the Bands
-- =========================================================

CREATE TABLE IF NOT EXISTS public.botb_events (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  city_id UUID NOT NULL REFERENCES public.cities(id) ON DELETE CASCADE,
  scheduled_date TIMESTAMP WITH TIME ZONE NOT NULL,
  status TEXT NOT NULL DEFAULT 'upcoming' CHECK (status IN ('upcoming', 'completed', 'cancelled')),
  max_entries INTEGER NOT NULL DEFAULT 20,
  winner_band_id UUID REFERENCES public.bands(id) ON DELETE SET NULL,
  winner_rating NUMERIC(6,2),
  resolved_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  CONSTRAINT botb_events_unique_city_date UNIQUE (city_id, scheduled_date)
);

GRANT SELECT ON public.botb_events TO authenticated;
GRANT ALL ON public.botb_events TO service_role;
ALTER TABLE public.botb_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can view battles" ON public.botb_events;
CREATE POLICY "Anyone can view battles" ON public.botb_events
  FOR SELECT TO authenticated USING (true);

CREATE TABLE IF NOT EXISTS public.botb_entries (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  event_id UUID NOT NULL REFERENCES public.botb_events(id) ON DELETE CASCADE,
  band_id UUID NOT NULL REFERENCES public.bands(id) ON DELETE CASCADE,
  profile_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  user_id UUID,
  song_1_id UUID REFERENCES public.songs(id) ON DELETE SET NULL,
  song_2_id UUID REFERENCES public.songs(id) ON DELETE SET NULL,
  overall_rating NUMERIC(6,2),
  placement INTEGER,
  is_winner BOOLEAN NOT NULL DEFAULT false,
  fame_gained INTEGER NOT NULL DEFAULT 0,
  fans_gained INTEGER NOT NULL DEFAULT 0,
  cash_awarded INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  CONSTRAINT botb_entries_unique_band UNIQUE (event_id, band_id)
);

GRANT SELECT, INSERT, DELETE ON public.botb_entries TO authenticated;
GRANT ALL ON public.botb_entries TO service_role;
ALTER TABLE public.botb_entries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can view battle entries" ON public.botb_entries;
CREATE POLICY "Anyone can view battle entries" ON public.botb_entries
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Band members can withdraw their entry" ON public.botb_entries;
CREATE POLICY "Band members can withdraw their entry" ON public.botb_entries
  FOR DELETE TO authenticated USING (
    EXISTS (
      SELECT 1 FROM public.band_members bm
      WHERE bm.band_id = botb_entries.band_id
        AND bm.user_id = auth.uid()
    )
    AND EXISTS (
      SELECT 1 FROM public.botb_events e
      WHERE e.id = botb_entries.event_id AND e.status = 'upcoming'
    )
  );

CREATE INDEX IF NOT EXISTS idx_botb_events_city ON public.botb_events(city_id);
CREATE INDEX IF NOT EXISTS idx_botb_events_status_date ON public.botb_events(status, scheduled_date);
CREATE INDEX IF NOT EXISTS idx_botb_entries_event ON public.botb_entries(event_id);
CREATE INDEX IF NOT EXISTS idx_botb_entries_band ON public.botb_entries(band_id);

CREATE OR REPLACE FUNCTION public.botb_touch_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_botb_events_updated_at ON public.botb_events;
CREATE TRIGGER trg_botb_events_updated_at BEFORE UPDATE ON public.botb_events
  FOR EACH ROW EXECUTE FUNCTION public.botb_touch_updated_at();

DROP TRIGGER IF EXISTS trg_botb_entries_updated_at ON public.botb_entries;
CREATE TRIGGER trg_botb_entries_updated_at BEFORE UPDATE ON public.botb_entries
  FOR EACH ROW EXECUTE FUNCTION public.botb_touch_updated_at();

-- =========================================================
-- Schedule generation: one battle per city every 14 days
-- =========================================================
CREATE OR REPLACE FUNCTION public.generate_botb_events(p_horizon_events INTEGER DEFAULT 3)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_anchor TIMESTAMPTZ := timestamptz '2026-01-02 19:00:00+00';
  v_period INTERVAL := interval '14 days';
  v_cycles INTEGER;
  v_created INTEGER := 0;
  v_i INTEGER;
  v_date TIMESTAMPTZ;
BEGIN
  v_cycles := GREATEST(0, FLOOR(EXTRACT(EPOCH FROM (now() - v_anchor)) / 1209600)::INTEGER);

  FOR v_i IN 1..GREATEST(1, COALESCE(p_horizon_events, 3)) LOOP
    v_date := v_anchor + ((v_cycles + v_i) * v_period);
    INSERT INTO public.botb_events (city_id, scheduled_date)
    SELECT c.id, v_date FROM public.cities c
    ON CONFLICT (city_id, scheduled_date) DO NOTHING;
    v_created := v_created + 1;
  END LOOP;

  RETURN v_created;
END;
$$;

REVOKE ALL ON FUNCTION public.generate_botb_events(INTEGER) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.generate_botb_events(INTEGER) TO service_role;

-- =========================================================
-- Eligibility check
-- =========================================================
CREATE OR REPLACE FUNCTION public.botb_check_eligibility(p_event_id UUID, p_band_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_event public.botb_events;
  v_song_count INTEGER;
  v_album_count INTEGER;
  v_entry_count INTEGER;
  v_prev_winner UUID;
BEGIN
  SELECT * INTO v_event FROM public.botb_events WHERE id = p_event_id;
  IF v_event.id IS NULL THEN
    RETURN jsonb_build_object('eligible', false, 'reason', 'Battle not found');
  END IF;
  IF v_event.status <> 'upcoming' THEN
    RETURN jsonb_build_object('eligible', false, 'reason', 'This battle is no longer open');
  END IF;

  SELECT count(*) INTO v_entry_count FROM public.botb_entries WHERE event_id = p_event_id;
  IF v_entry_count >= v_event.max_entries THEN
    RETURN jsonb_build_object('eligible', false, 'reason', 'This battle is full (20 bands)');
  END IF;

  IF EXISTS (SELECT 1 FROM public.botb_entries WHERE event_id = p_event_id AND band_id = p_band_id) THEN
    RETURN jsonb_build_object('eligible', false, 'reason', 'Your band is already entered');
  END IF;

  SELECT count(*) INTO v_song_count
  FROM public.songs s
  WHERE s.band_id = p_band_id AND COALESCE(s.archived, false) = false;
  IF v_song_count < 2 THEN
    RETURN jsonb_build_object('eligible', false, 'reason', 'Your band needs at least 2 written songs');
  END IF;

  SELECT count(*) INTO v_album_count
  FROM public.releases r
  WHERE r.band_id = p_band_id
    AND lower(r.release_type) IN ('album', 'lp')
    AND COALESCE(r.release_status, '') NOT IN ('draft', 'cancelled');
  IF v_album_count > 0 THEN
    RETURN jsonb_build_object('eligible', false, 'reason', 'Bands that have released an album cannot enter');
  END IF;

  SELECT e.winner_band_id INTO v_prev_winner
  FROM public.botb_events e
  WHERE e.city_id = v_event.city_id
    AND e.status = 'completed'
    AND e.winner_band_id IS NOT NULL
    AND e.scheduled_date < v_event.scheduled_date
  ORDER BY e.scheduled_date DESC
  LIMIT 1;

  IF v_prev_winner = p_band_id THEN
    RETURN jsonb_build_object('eligible', false, 'reason', 'Reigning champions must sit out the next battle in this city');
  END IF;

  RETURN jsonb_build_object('eligible', true, 'reason', null);
END;
$$;

REVOKE ALL ON FUNCTION public.botb_check_eligibility(UUID, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.botb_check_eligibility(UUID, UUID) TO authenticated, service_role;

-- =========================================================
-- Entry RPC
-- =========================================================
CREATE OR REPLACE FUNCTION public.enter_battle_of_the_bands(
  p_event_id UUID,
  p_band_id UUID,
  p_profile_id UUID,
  p_song_1_id UUID,
  p_song_2_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_check JSONB;
  v_entry public.botb_entries;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'BOTB_UNAUTHENTICATED';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.band_members bm
    WHERE bm.band_id = p_band_id AND bm.user_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'BOTB_NOT_BAND_MEMBER';
  END IF;

  IF p_song_1_id IS NULL OR p_song_2_id IS NULL OR p_song_1_id = p_song_2_id THEN
    RAISE EXCEPTION 'BOTB_INVALID_SONGS';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.songs WHERE id = p_song_1_id AND band_id = p_band_id)
     OR NOT EXISTS (SELECT 1 FROM public.songs WHERE id = p_song_2_id AND band_id = p_band_id) THEN
    RAISE EXCEPTION 'BOTB_SONG_NOT_OWNED';
  END IF;

  v_check := public.botb_check_eligibility(p_event_id, p_band_id);
  IF NOT (v_check->>'eligible')::boolean THEN
    RAISE EXCEPTION 'BOTB_INELIGIBLE: %', v_check->>'reason';
  END IF;

  INSERT INTO public.botb_entries (event_id, band_id, profile_id, user_id, song_1_id, song_2_id)
  VALUES (p_event_id, p_band_id, p_profile_id, auth.uid(), p_song_1_id, p_song_2_id)
  RETURNING * INTO v_entry;

  RETURN jsonb_build_object('success', true, 'entry_id', v_entry.id);
END;
$$;

REVOKE ALL ON FUNCTION public.enter_battle_of_the_bands(UUID, UUID, UUID, UUID, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.enter_battle_of_the_bands(UUID, UUID, UUID, UUID, UUID) TO authenticated, service_role;

-- =========================================================
-- Resolution + rewards
-- =========================================================
CREATE OR REPLACE FUNCTION public.resolve_botb_event(p_event_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_event public.botb_events;
  v_entry RECORD;
  v_score NUMERIC;
  v_rank INTEGER := 0;
  v_winner_band UUID;
  v_winner_rating NUMERIC;
  v_member RECORD;
  v_city_name TEXT;
  v_city_country TEXT;
  v_fame INTEGER;
  v_fans INTEGER;
  v_ach_win UUID;
  v_ach_all UUID;
  v_cities_total INTEGER;
  v_cities_won INTEGER;
BEGIN
  SELECT * INTO v_event FROM public.botb_events WHERE id = p_event_id FOR UPDATE;
  IF v_event.id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'reason', 'not_found');
  END IF;
  IF v_event.status <> 'upcoming' THEN
    RETURN jsonb_build_object('success', false, 'reason', 'already_resolved');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.botb_entries WHERE event_id = p_event_id) THEN
    UPDATE public.botb_events
      SET status = 'cancelled', resolved_at = now()
      WHERE id = p_event_id;
    RETURN jsonb_build_object('success', true, 'reason', 'no_entries');
  END IF;

  -- score every entry
  FOR v_entry IN SELECT * FROM public.botb_entries WHERE event_id = p_event_id LOOP
    SELECT
      COALESCE(AVG(s.quality_score), 40)
      + COALESCE((SELECT LEAST(20, b.popularity / 10.0) FROM public.bands b WHERE b.id = v_entry.band_id), 0)
      + COALESCE((SELECT LEAST(10, b.cohesion_score / 10.0) FROM public.bands b WHERE b.id = v_entry.band_id), 0)
      + (random() * 15)
    INTO v_score
    FROM public.songs s
    WHERE s.id IN (v_entry.song_1_id, v_entry.song_2_id);

    v_score := GREATEST(1, LEAST(100, ROUND(COALESCE(v_score, 40)::numeric, 2)));

    UPDATE public.botb_entries SET overall_rating = v_score WHERE id = v_entry.id;
  END LOOP;

  -- placements
  FOR v_entry IN
    SELECT id, band_id, overall_rating FROM public.botb_entries
    WHERE event_id = p_event_id
    ORDER BY overall_rating DESC NULLS LAST, created_at ASC
  LOOP
    v_rank := v_rank + 1;
    UPDATE public.botb_entries
      SET placement = v_rank, is_winner = (v_rank = 1)
      WHERE id = v_entry.id;
    IF v_rank = 1 THEN
      v_winner_band := v_entry.band_id;
      v_winner_rating := v_entry.overall_rating;
    END IF;
  END LOOP;

  SELECT name, country INTO v_city_name, v_city_country FROM public.cities WHERE id = v_event.city_id;

  v_fame := 150;
  v_fans := 250;

  -- band rewards
  UPDATE public.bands
    SET band_balance = COALESCE(band_balance, 0) + 5000,
        fame = COALESCE(fame, 0) + v_fame,
        total_fans = COALESCE(total_fans, 0) + v_fans,
        casual_fans = COALESCE(casual_fans, 0) + v_fans,
        popularity = LEAST(100, COALESCE(popularity, 0) + 3)
    WHERE id = v_winner_band;

  INSERT INTO public.band_earnings (band_id, amount, source, description, metadata)
  VALUES (v_winner_band, 5000, 'battle_of_the_bands',
    'Won Battle of the Bands in ' || COALESCE(v_city_name, 'a city'),
    jsonb_build_object('event_id', p_event_id, 'city_id', v_event.city_id));

  UPDATE public.botb_entries
    SET cash_awarded = 5000, fame_gained = v_fame, fans_gained = v_fans
    WHERE event_id = p_event_id AND band_id = v_winner_band;

  -- city fans
  IF EXISTS (SELECT 1 FROM public.band_city_fans WHERE band_id = v_winner_band AND city_id = v_event.city_id) THEN
    UPDATE public.band_city_fans
      SET casual_fans = COALESCE(casual_fans, 0) + v_fans,
          total_fans = COALESCE(total_fans, 0) + v_fans,
          updated_at = now()
      WHERE band_id = v_winner_band AND city_id = v_event.city_id;
  ELSE
    INSERT INTO public.band_city_fans (band_id, city_id, city_name, country, casual_fans, total_fans)
    VALUES (v_winner_band, v_event.city_id, COALESCE(v_city_name, 'Unknown'), COALESCE(v_city_country, 'Unknown'), v_fans, v_fans);
  END IF;

  SELECT id INTO v_ach_win FROM public.achievements WHERE name = 'Battle Victor' LIMIT 1;
  SELECT id INTO v_ach_all FROM public.achievements WHERE name = 'Battle Circuit Champion' LIMIT 1;
  SELECT count(*) INTO v_cities_total FROM public.cities;

  -- member rewards: 6 attribute points + 1000 XP each
  FOR v_member IN
    SELECT DISTINCT bm.user_id, bm.profile_id
    FROM public.band_members bm
    WHERE bm.band_id = v_winner_band
      AND COALESCE(bm.member_status, 'active') = 'active'
  LOOP
    IF v_member.profile_id IS NOT NULL THEN
      INSERT INTO public.player_xp_wallet (profile_id, xp_balance, lifetime_xp, attribute_points_balance, attribute_points_lifetime)
      VALUES (v_member.profile_id, 1000, 1000, 6, 6)
      ON CONFLICT (profile_id) DO UPDATE
        SET xp_balance = COALESCE(public.player_xp_wallet.xp_balance, 0) + 1000,
            lifetime_xp = COALESCE(public.player_xp_wallet.lifetime_xp, 0) + 1000,
            attribute_points_balance = COALESCE(public.player_xp_wallet.attribute_points_balance, 0) + 6,
            attribute_points_lifetime = COALESCE(public.player_xp_wallet.attribute_points_lifetime, 0) + 6;

      UPDATE public.player_attributes
        SET attribute_points = COALESCE(attribute_points, 0) + 6,
            updated_at = now()
        WHERE profile_id = v_member.profile_id;

      UPDATE public.profiles
        SET experience = COALESCE(experience, 0) + 1000
        WHERE id = v_member.profile_id;

      INSERT INTO public.experience_ledger (user_id, profile_id, activity_type, xp_amount, metadata)
      VALUES (v_member.user_id, v_member.profile_id, 'battle_of_the_bands', 1000,
        jsonb_build_object('event_id', p_event_id, 'city_id', v_event.city_id, 'band_id', v_winner_band));
    END IF;

    IF v_member.user_id IS NOT NULL THEN
      INSERT INTO public.activity_feed (user_id, profile_id, activity_type, message, earnings, metadata)
      VALUES (v_member.user_id, v_member.profile_id, 'battle_of_the_bands',
        'Won the Battle of the Bands in ' || COALESCE(v_city_name, 'a city') || '! +6 AP, +1,000 XP',
        5000, jsonb_build_object('event_id', p_event_id, 'city_id', v_event.city_id));

      IF v_ach_win IS NOT NULL THEN
        INSERT INTO public.player_achievements (user_id, profile_id, achievement_id, progress)
        SELECT v_member.user_id, v_member.profile_id, v_ach_win, jsonb_build_object('wins', 1)
        WHERE NOT EXISTS (
          SELECT 1 FROM public.player_achievements pa
          WHERE pa.achievement_id = v_ach_win
            AND (pa.profile_id = v_member.profile_id OR (pa.profile_id IS NULL AND pa.user_id = v_member.user_id))
        );
      END IF;
    END IF;
  END LOOP;

  UPDATE public.botb_events
    SET status = 'completed', winner_band_id = v_winner_band,
        winner_rating = v_winner_rating, resolved_at = now()
    WHERE id = p_event_id;

  -- "won in every city" achievement for the winning band's members
  IF v_ach_all IS NOT NULL AND v_cities_total > 0 THEN
    SELECT count(DISTINCT e.city_id) INTO v_cities_won
    FROM public.botb_events e
    WHERE e.status = 'completed' AND e.winner_band_id = v_winner_band;

    IF v_cities_won >= v_cities_total THEN
      INSERT INTO public.player_achievements (user_id, profile_id, achievement_id, progress)
      SELECT bm.user_id, bm.profile_id, v_ach_all, jsonb_build_object('cities_won', v_cities_won)
      FROM public.band_members bm
      WHERE bm.band_id = v_winner_band
        AND COALESCE(bm.member_status, 'active') = 'active'
        AND bm.user_id IS NOT NULL
        AND NOT EXISTS (
          SELECT 1 FROM public.player_achievements pa
          WHERE pa.achievement_id = v_ach_all
            AND (pa.profile_id = bm.profile_id OR (pa.profile_id IS NULL AND pa.user_id = bm.user_id))
        );
    END IF;
  END IF;

  RETURN jsonb_build_object('success', true, 'winner_band_id', v_winner_band, 'winner_rating', v_winner_rating);
END;
$$;

REVOKE ALL ON FUNCTION public.resolve_botb_event(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.resolve_botb_event(UUID) TO service_role;

-- =========================================================
-- Cycle runner (generate + resolve due battles)
-- =========================================================
CREATE OR REPLACE FUNCTION public.run_botb_cycle()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_event RECORD;
  v_resolved INTEGER := 0;
BEGIN
  PERFORM public.generate_botb_events(3);

  FOR v_event IN
    SELECT id FROM public.botb_events
    WHERE status = 'upcoming' AND scheduled_date <= now()
    ORDER BY scheduled_date ASC
    LIMIT 500
  LOOP
    PERFORM public.resolve_botb_event(v_event.id);
    v_resolved := v_resolved + 1;
  END LOOP;

  RETURN jsonb_build_object('resolved', v_resolved);
END;
$$;

REVOKE ALL ON FUNCTION public.run_botb_cycle() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.run_botb_cycle() TO service_role;

SELECT public.generate_botb_events(3);
