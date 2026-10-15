-- Controlled one-time production repair for issue #4119, 2026-10-15.
-- DO NOT auto-run with db push; review complete ledger authority and test
-- against a SANITIZED COPY of production and a proven restorable backup.
-- This fixes destructive sum-reprojection but is NOT payroll cutover.
BEGIN;
DO $preflight$
BEGIN
  IF to_regprocedure('public.update_band_balance_from_earnings()') IS NULL
    OR to_regprocedure('public.resolve_botb_event(uuid)') IS NULL
    OR NOT EXISTS (
      SELECT 1 FROM pg_proc p
      WHERE p.oid = 'public.update_band_balance_from_earnings()'::regprocedure
        AND pg_get_functiondef(p.oid) ILIKE '%SUM(amount)%'
    ) THEN
    RAISE EXCEPTION 'Unexpected production earnings trigger: manual review required';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.bands b
    LEFT JOIN public.band_treasuries t
      ON t.band_id=b.id AND t.is_primary IS TRUE
    WHERE t.id IS NULL OR t.balance_minor / 100 <>
      COALESCE(b.band_balance,0)::bigint
  ) THEN
    RAISE EXCEPTION 'Existing gameplay treasury drift: abort earnings trigger repair';
  END IF;
END;
$preflight$;

CREATE OR REPLACE FUNCTION public.update_band_balance_from_earnings()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $earnings$
DECLARE
  v_old_band_id uuid;
  v_new_band_id uuid;
  v_old_delta bigint;
  v_new_delta bigint;
  v_change record;
  v_band_balance bigint;
  v_treasury_balance_minor bigint;
  v_reserved_minor bigint;
  v_next bigint;
BEGIN
  -- Use deltas, NEVER SUM(all earnings). That old full-sum projection
  -- erased legitimate band_treasury_transactions (rehearsals/recordings).
  IF TG_OP = 'INSERT' THEN
    v_new_band_id := NEW.band_id;
    v_new_delta := NEW.amount::bigint;
  ELSIF TG_OP = 'DELETE' THEN
    v_old_band_id := OLD.band_id;
    v_old_delta := -OLD.amount::bigint;
  ELSIF TG_OP = 'UPDATE' THEN
    IF NEW.band_id = OLD.band_id AND NEW.amount = OLD.amount THEN
      RETURN NEW; -- metadata/description changes must not move any money
    END IF;
    v_old_band_id := OLD.band_id;
    v_old_delta := -OLD.amount::bigint;
    v_new_band_id := NEW.band_id;
    v_new_delta := NEW.amount::bigint;
  ELSE
    RAISE EXCEPTION 'Unsupported band earnings trigger operation';
  END IF;

  -- Aggregating the two changes handles same-band UPDATE correctly.
  -- Order locks by UUID for a cross-band move to reduce deadlock risk.
  FOR v_change IN
    SELECT c.band_id, SUM(c.delta)::bigint AS delta
    FROM (VALUES (v_old_band_id,v_old_delta),
                 (v_new_band_id,v_new_delta)) AS c(band_id,delta)
    WHERE c.band_id IS NOT NULL
    GROUP BY c.band_id
    HAVING SUM(c.delta) <> 0
    ORDER BY c.band_id
  LOOP
    SELECT COALESCE(b.band_balance,0)::bigint INTO v_band_balance
    FROM public.bands b WHERE b.id = v_change.band_id FOR UPDATE;
    IF NOT FOUND THEN
      -- Parent-band deletion can cascade earnings deletes. Do not block
      -- legitimate parent cleanup or recreate a deleted band.
      IF TG_OP = 'DELETE' THEN CONTINUE; END IF;
      RAISE EXCEPTION 'Band earnings target band is missing';
    END IF;

    SELECT t.balance_minor, t.reserved_balance_minor
      INTO v_treasury_balance_minor,v_reserved_minor
    FROM public.band_treasuries t
    WHERE t.band_id = v_change.band_id AND t.is_primary IS TRUE
    FOR UPDATE;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Primary band treasury missing for earnings delta';
    END IF;
    IF v_treasury_balance_minor / 100 <> v_band_balance THEN
      -- sync_band_treasury_from_band_balance() otherwise self-heals drift
      -- by overwriting the real treasury. Fail transaction atomically.
      RAISE EXCEPTION 'Band earnings refused: gameplay treasury balance drift';
    END IF;

    v_next := v_band_balance + v_change.delta;
    IF v_next < 0 OR v_next > 2147483647
      OR v_next * 100 < v_reserved_minor THEN
      RAISE EXCEPTION 'Band earnings delta exceeds available band funds or balance limits';
    END IF;

    -- Atomic relative UPDATE with a locked band; the existing bands
    -- balance-to-treasury AFTER UPDATE trigger applies EXACTLY the delta,
    -- preserving booked expenses and any sub-dollar treasury remainder.
    UPDATE public.bands
    SET band_balance = v_next::integer
    WHERE id = v_change.band_id;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Band earnings balance update did not complete';
    END IF;

    -- Verify the compatibility trigger did not unexpectedly replace cash.
    IF NOT EXISTS (
      SELECT 1 FROM public.band_treasuries t
      WHERE t.band_id = v_change.band_id AND t.is_primary IS TRUE
        AND t.balance_minor = v_treasury_balance_minor + v_change.delta * 100
        AND t.reserved_balance_minor = v_reserved_minor
    ) THEN
      RAISE EXCEPTION 'Band earnings post-write treasury verification failed';
    END IF;
  END LOOP;

  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END;
$earnings$;

-- Trigger functions are internal privileged routines, NOT public RPCs.
REVOKE ALL ON FUNCTION public.update_band_balance_from_earnings()
  FROM PUBLIC, anon, authenticated, service_role;

-- The current BOTB winner handler explicitly credits bands.balance +5000
-- AND inserts an earnings row for the same prize. With incremental earnings
-- those two credits would double pay. Keep fame/fans and the earnings prize,
-- but remove the duplicate direct cash credit in this coordinated cutover.
CREATE OR REPLACE FUNCTION public.resolve_botb_event(p_event_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
    SET fame = COALESCE(fame, 0) + v_fame,
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
$function$

COMMIT;
