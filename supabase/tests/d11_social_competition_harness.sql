-- D11 rivalries, communities and seasonal social competition verification.
-- Safe to run against the connected database: every fixture mutation is rolled back.

BEGIN;

CREATE SCHEMA IF NOT EXISTS test_d11_social;

CREATE OR REPLACE FUNCTION test_d11_social.as_user(user_id uuid) RETURNS void
LANGUAGE plpgsql AS $$
BEGIN
  EXECUTE 'SET LOCAL ROLE authenticated';
  PERFORM set_config('request.jwt.claim.sub', user_id::text, true);
  PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
  PERFORM set_config('request.jwt.claims', jsonb_build_object('sub', user_id, 'role', 'authenticated')::text, true);
END;
$$;

CREATE OR REPLACE FUNCTION test_d11_social.as_anon() RETURNS void
LANGUAGE plpgsql AS $$
BEGIN
  EXECUTE 'SET LOCAL ROLE anon';
  PERFORM set_config('request.jwt.claim.sub', '', true);
  PERFORM set_config('request.jwt.claim.role', 'anon', true);
  PERFORM set_config('request.jwt.claims', jsonb_build_object('role', 'anon')::text, true);
END;
$$;

CREATE OR REPLACE FUNCTION test_d11_social.as_service() RETURNS void
LANGUAGE plpgsql AS $$
BEGIN
  EXECUTE 'SET LOCAL ROLE service_role';
  PERFORM set_config('request.jwt.claim.sub', '', true);
  PERFORM set_config('request.jwt.claim.role', 'service_role', true);
  PERFORM set_config('request.jwt.claims', jsonb_build_object('role', 'service_role')::text, true);
END;
$$;

CREATE OR REPLACE FUNCTION test_d11_social.as_admin() RETURNS void
LANGUAGE plpgsql AS $$
BEGIN
  EXECUTE 'RESET ROLE';
  PERFORM set_config('request.jwt.claim.sub', '', true);
  PERFORM set_config('request.jwt.claim.role', '', true);
  PERFORM set_config('request.jwt.claims', '{}'::text, true);
END;
$$;

CREATE OR REPLACE FUNCTION test_d11_social.assert_true(label text, actual boolean) RETURNS void
LANGUAGE plpgsql AS $$
BEGIN
  IF actual IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'D11 assertion failed: %', label;
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION test_d11_social.assert_eq(label text, actual bigint, expected bigint) RETURNS void
LANGUAGE plpgsql AS $$
BEGIN
  IF actual IS DISTINCT FROM expected THEN
    RAISE EXCEPTION 'D11 assertion failed: %, expected %, got %', label, expected, actual;
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION test_d11_social.assert_denied(label text, statement text) RETURNS void
LANGUAGE plpgsql AS $$
BEGIN
  BEGIN
    EXECUTE statement;
  EXCEPTION WHEN OTHERS THEN
    RETURN;
  END;
  RAISE EXCEPTION 'D11 assertion failed: % should have been denied', label;
END;
$$;

GRANT USAGE ON SCHEMA test_d11_social TO anon, authenticated, service_role;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA test_d11_social TO anon, authenticated, service_role;

DO $$
DECLARE
  user_one uuid := 'd1100001-0000-4000-8000-000000000001';
  user_two uuid := 'd1100002-0000-4000-8000-000000000002';
  user_three uuid := 'd1100003-0000-4000-8000-000000000003';
  user_four uuid := 'd1100004-0000-4000-8000-000000000004';
  user_five uuid := 'd1100005-0000-4000-8000-000000000005';
  profile_one uuid := 'd1100001-0000-4000-8000-000000000001';
  profile_one_alt uuid := 'd1110000-0000-4000-8000-000000000011';
  profile_two uuid := 'd1100002-0000-4000-8000-000000000002';
  profile_three uuid := 'd1100003-0000-4000-8000-000000000003';
  profile_four uuid := 'd1100004-0000-4000-8000-000000000004';
  profile_five uuid := 'd1100005-0000-4000-8000-000000000005';
  band_one uuid := 'd1120000-0000-4000-8000-000000000001';
  band_two uuid := 'd1120000-0000-4000-8000-000000000002';
  band_three uuid := 'd1120000-0000-4000-8000-000000000003';
  fixture_season_id uuid := 'd1130000-0000-4000-8000-000000000001';
  city_id uuid;
  player_rivalry uuid;
  exit_rivalry uuid;
  band_rivalry uuid;
  community_id uuid;
  season_entry uuid;
  city_entry uuid;
  original_baseline integer;
  result jsonb;
BEGIN
  PERFORM test_d11_social.as_admin();

  SELECT id INTO city_id FROM public.cities ORDER BY id LIMIT 1;
  PERFORM test_d11_social.assert_true('a city fixture is available', city_id IS NOT NULL);

  INSERT INTO auth.users (id, email, role) VALUES
    (user_one, 'd11-one@example.test', 'authenticated'),
    (user_two, 'd11-two@example.test', 'authenticated'),
    (user_three, 'd11-three@example.test', 'authenticated'),
    (user_four, 'd11-four@example.test', 'authenticated'),
    (user_five, 'd11-five@example.test', 'authenticated');

  SELECT id INTO profile_one FROM public.profiles WHERE user_id = user_one;
  SELECT id INTO profile_two FROM public.profiles WHERE user_id = user_two;
  SELECT id INTO profile_three FROM public.profiles WHERE user_id = user_three;
  SELECT id INTO profile_four FROM public.profiles WHERE user_id = user_four;
  SELECT id INTO profile_five FROM public.profiles WHERE user_id = user_five;

  UPDATE public.profiles
  SET username = CASE id
        WHEN profile_one THEN 'd11_player_one'
        WHEN profile_two THEN 'd11_player_two'
        WHEN profile_three THEN 'd11_player_three'
        WHEN profile_four THEN 'd11_player_four'
        WHEN profile_five THEN 'd11_player_five'
      END,
      display_name = CASE id
        WHEN profile_one THEN 'D11 Player One'
        WHEN profile_two THEN 'D11 Player Two'
        WHEN profile_three THEN 'D11 Player Three'
        WHEN profile_four THEN 'D11 Player Four'
        WHEN profile_five THEN 'D11 Player Five'
      END,
      fame = 100,
      fans = 100,
      experience = 100,
      current_city_id = city_id
  WHERE id IN (profile_one, profile_two, profile_three, profile_four, profile_five);

  INSERT INTO public.profiles (id, user_id, username, display_name, fame, fans, experience, current_city_id, is_active)
  VALUES (profile_one_alt, user_one, 'd11_player_one_alt', 'D11 Player One Alt', 10, 10, 10, city_id, false);

  INSERT INTO public.bands (id, name, genre, leader_id, status, fame, total_fans) VALUES
    (band_one, 'D11 Harness Alpha', 'Rock', profile_one, 'active', 100, 100),
    (band_two, 'D11 Harness Beta', 'Pop', profile_two, 'active', 100, 100),
    (band_three, 'D11 Harness Blocked', 'Metal', profile_five, 'active', 100, 100);

  INSERT INTO public.band_members (band_id, user_id, profile_id, role, instrument_role, member_status) VALUES
    (band_one, user_one, profile_one, 'leader', 'Vocals', 'active'),
    (band_one, user_three, profile_three, 'member', 'Bass', 'active'),
    (band_two, user_two, profile_two, 'leader', 'Vocals', 'active'),
    (band_two, user_four, profile_four, 'member', 'Drums', 'active'),
    (band_three, user_five, profile_five, 'leader', 'Guitar', 'active');

  -- Browser roles have no direct D11 table authority and anon has no RPC access.
  PERFORM test_d11_social.as_anon();
  PERFORM test_d11_social.assert_denied('anon D11 RPC', format('SELECT * FROM public.get_social_seasons(%L::uuid)', profile_one));
  PERFORM test_d11_social.assert_denied('anon internal helper', format('SELECT public._d11_profile_owned(%L::uuid)', profile_one));
  PERFORM test_d11_social.assert_denied('anon direct rivalry read', 'SELECT count(*) FROM public.social_rivalries');

  PERFORM test_d11_social.as_user(user_one);
  PERFORM test_d11_social.assert_denied('authenticated direct rivalry insert', format(
    'INSERT INTO public.social_rivalries(challenger_profile_id,rival_profile_id,metric) VALUES (%L::uuid,%L::uuid,%L)',
    profile_one, profile_two, 'fame_growth'
  ));
  PERFORM test_d11_social.assert_denied('authenticated direct season table read', 'SELECT count(*) FROM public.social_competition_entries');
  PERFORM test_d11_social.assert_denied('authenticated generic leaderboard write', 'INSERT INTO public.leaderboard_seasons(name,start_date,end_date) VALUES (''forbidden'',now(),now())');

  -- Player rivalries require exact discovery and the target player's consent.
  PERFORM test_d11_social.assert_eq('eligible player is discoverable', (
    SELECT count(*) FROM public.find_social_rival_candidate(profile_one, 'd11_player_two')
  ), 1);
  SELECT public.request_social_rivalry(profile_one, profile_two, 'fame_growth', 50) INTO player_rivalry;

  PERFORM test_d11_social.as_user(user_three);
  PERFORM test_d11_social.assert_denied('unrelated player cannot respond', format(
    'SELECT public.respond_social_rivalry(%L::uuid,%L::uuid,true)', profile_three, player_rivalry
  ));

  PERFORM test_d11_social.as_user(user_two);
  SELECT public.respond_social_rivalry(profile_two, player_rivalry, true) INTO result;
  PERFORM test_d11_social.assert_true('target accepts rivalry', result ->> 'status' = 'active');

  PERFORM test_d11_social.as_service();
  UPDATE public.profiles SET fame = fame + 70 WHERE id = profile_one;

  PERFORM test_d11_social.as_user(user_one);
  SELECT public.refresh_social_rivalry(profile_one, player_rivalry) INTO result;
  PERFORM test_d11_social.assert_true('canonical growth completes rivalry', result ->> 'status' = 'completed');

  PERFORM test_d11_social.as_service();
  PERFORM test_d11_social.assert_true('canonical winner persisted', EXISTS (
    SELECT 1 FROM public.social_rivalries
    WHERE id = player_rivalry AND challenger_score = 70 AND rival_score = 0 AND winner_profile_id = profile_one
  ));
  PERFORM test_d11_social.assert_eq('rivalry badge awarded once', (
    SELECT count(*) FROM public.leaderboard_badge_awards
    WHERE profile_id = profile_one AND metadata ->> 'rivalry_id' = player_rivalry::text
  ), 1);

  PERFORM test_d11_social.as_user(user_one);
  PERFORM public.refresh_social_rivalry(profile_one, player_rivalry);
  PERFORM test_d11_social.as_service();
  PERFORM test_d11_social.assert_eq('completed refresh remains badge-idempotent', (
    SELECT count(*) FROM public.leaderboard_badge_awards
    WHERE profile_id = profile_one AND metadata ->> 'rivalry_id' = player_rivalry::text
  ), 1);

  -- Either participant can exit without a loss; pair cooldown prevents request spam.
  PERFORM test_d11_social.as_user(user_one);
  SELECT public.request_social_rivalry(profile_one, profile_three, 'fan_growth', 20) INTO exit_rivalry;
  PERFORM public.leave_social_rivalry(profile_one, exit_rivalry);
  PERFORM test_d11_social.assert_denied('recently ended pair observes cooldown', format(
    'SELECT public.request_social_rivalry(%L::uuid,%L::uuid,%L,20)', profile_one, profile_three, 'fan_growth'
  ));
  PERFORM test_d11_social.as_service();
  PERFORM test_d11_social.assert_true('exit event records no penalty', EXISTS (
    SELECT 1 FROM public.social_rivalry_events WHERE rivalry_id = exit_rivalry AND event_type = 'ended' AND evidence ->> 'penalty' = 'false'
  ));

  -- Band managers consent; ordinary members may view and refresh but cannot decide or end.
  PERFORM test_d11_social.as_user(user_one);
  SELECT public.request_social_band_rivalry(profile_one, band_one, band_two, 'fame_growth', 40) INTO band_rivalry;

  PERFORM test_d11_social.as_user(user_four);
  PERFORM test_d11_social.assert_denied('ordinary target member cannot accept', format(
    'SELECT public.respond_social_band_rivalry(%L::uuid,%L::uuid,true)', profile_four, band_rivalry
  ));

  PERFORM test_d11_social.as_user(user_two);
  SELECT public.respond_social_band_rivalry(profile_two, band_rivalry, true) INTO result;
  PERFORM test_d11_social.assert_true('target manager accepts band rivalry', result ->> 'status' = 'active');

  PERFORM test_d11_social.as_user(user_three);
  PERFORM test_d11_social.assert_eq('ordinary member can view band rivalry', (
    SELECT count(*) FROM public.get_my_social_band_rivalries(profile_three) WHERE id = band_rivalry
  ), 1);
  PERFORM test_d11_social.assert_denied('ordinary member cannot end band rivalry', format(
    'SELECT public.leave_social_band_rivalry(%L::uuid,%L::uuid)', profile_three, band_rivalry
  ));

  PERFORM test_d11_social.as_service();
  UPDATE public.bands SET fame = fame + 45 WHERE id = band_one;
  PERFORM test_d11_social.as_user(user_four);
  SELECT public.refresh_social_band_rivalry(profile_four, band_rivalry) INTO result;
  PERFORM test_d11_social.assert_true('ordinary member can settle canonical band progress', result ->> 'status' = 'completed');

  -- Blocks hide discovery and prevent both player and band invitations.
  PERFORM test_d11_social.as_service();
  INSERT INTO public.player_blocks(blocker_id, blocked_id, reason_category, private_note) VALUES
    (profile_four, profile_one, 'harassment', 'D11 player boundary'),
    (profile_five, profile_one, 'harassment', 'D11 band boundary');

  PERFORM test_d11_social.as_user(user_one);
  PERFORM test_d11_social.assert_eq('blocked player hidden from rivalry discovery', (
    SELECT count(*) FROM public.find_social_rival_candidate(profile_one, 'd11_player_four')
  ), 0);
  PERFORM test_d11_social.assert_denied('blocked player request denied', format(
    'SELECT public.request_social_rivalry(%L::uuid,%L::uuid,%L,20)', profile_one, profile_four, 'fan_growth'
  ));
  PERFORM test_d11_social.assert_eq('band with blocking manager hidden', (
    SELECT count(*) FROM public.find_social_band_rival_candidate(profile_one, band_one, 'D11 Harness Blocked')
  ), 0);
  PERFORM test_d11_social.assert_denied('band request blocked by target manager boundary', format(
    'SELECT public.request_social_band_rivalry(%L::uuid,%L::uuid,%L::uuid,%L,20)',
    profile_one, band_one, band_three, 'fan_growth'
  ));

  -- Communities enforce capacity, owner moderation and a removal cooldown.
  SELECT public.create_social_community(profile_one, 'D11 Harness Community', 'Rollback-only community', 'fan_club', true, 2) INTO community_id;
  PERFORM test_d11_social.as_user(user_two);
  PERFORM public.join_social_community(profile_two, community_id);
  PERFORM test_d11_social.as_user(user_three);
  PERFORM test_d11_social.assert_denied('community capacity is locked', format(
    'SELECT public.join_social_community(%L::uuid,%L::uuid)', profile_three, community_id
  ));
  PERFORM test_d11_social.as_user(user_one);
  PERFORM test_d11_social.assert_eq('owner can list active members', (
    SELECT count(*) FROM public.get_social_community_members(profile_one, community_id)
  ), 2);
  PERFORM public.remove_social_community_member(profile_one, community_id, profile_two);
  PERFORM test_d11_social.as_user(user_two);
  PERFORM test_d11_social.assert_denied('removed member observes seven-day cooldown', format(
    'SELECT public.join_social_community(%L::uuid,%L::uuid)', profile_two, community_id
  ));

  -- Replace the live season only inside this transaction with a deterministic test season.
  PERFORM test_d11_social.as_service();
  UPDATE public.leaderboard_seasons
  SET is_active = false
  WHERE is_active AND metadata ->> 'source' = 'd11_social';
  INSERT INTO public.leaderboard_seasons(id, name, description, start_date, end_date, is_active, season_number, metadata)
  VALUES (fixture_season_id, 'D11 Harness Season', 'Rollback-only season', now() - interval '1 day', now() + interval '1 day', true, 9911, jsonb_build_object('source', 'd11_social'));

  PERFORM test_d11_social.as_user(user_one);
  SELECT public.join_social_season(profile_one, fixture_season_id, 'global', 'fame_growth') INTO season_entry;
  SELECT baseline_value INTO original_baseline
  FROM public.get_my_social_competition_entries(profile_one)
  WHERE id = season_entry;

  PERFORM test_d11_social.as_user(user_one);
  PERFORM test_d11_social.assert_denied('same account cannot enter with another character', format(
    'SELECT public.join_social_season(%L::uuid,%L::uuid,%L,%L)', profile_one_alt, fixture_season_id, 'global', 'fame_growth'
  ));

  PERFORM test_d11_social.as_service();
  UPDATE public.profiles SET fame = fame + 25 WHERE id = profile_one;
  PERFORM test_d11_social.as_user(user_one);
  PERFORM test_d11_social.assert_true('season score uses canonical growth', EXISTS (
    SELECT 1 FROM public.get_my_social_competition_entries(profile_one) WHERE id = season_entry AND score = 25
  ));
  PERFORM public.leave_social_season(profile_one, season_entry);

  PERFORM test_d11_social.as_service();
  UPDATE public.profiles SET fame = fame + 50 WHERE id = profile_one;
  PERFORM test_d11_social.as_user(user_one);
  PERFORM test_d11_social.assert_true('rejoin returns the same account entry',
    public.join_social_season(profile_one, fixture_season_id, 'global', 'fame_growth') = season_entry
  );
  PERFORM test_d11_social.assert_true('rejoin preserves baseline and includes all growth', EXISTS (
    SELECT 1 FROM public.get_my_social_competition_entries(profile_one)
    WHERE id = season_entry AND baseline_value = original_baseline AND score = 75
  ));
  SELECT public.join_social_season(profile_one, fixture_season_id, 'city', 'fan_growth') INTO city_entry;

  PERFORM test_d11_social.as_service();
  PERFORM test_d11_social.assert_true('city context is captured at entry', EXISTS (
    SELECT 1 FROM public.social_competition_entries WHERE id = city_entry AND context_city_id = city_id
  ));
  UPDATE public.leaderboard_seasons SET end_date = now() - interval '1 minute' WHERE id = fixture_season_id;

  PERFORM test_d11_social.as_user(user_one);
  PERFORM test_d11_social.assert_denied('browser cannot finalise a season', format(
    'SELECT public.finalise_social_season(%L::uuid)', fixture_season_id
  ));

  PERFORM test_d11_social.as_service();
  SELECT public.finalise_social_season(fixture_season_id) INTO result;
  PERFORM test_d11_social.assert_true('season finalises canonical result', EXISTS (
    SELECT 1 FROM public.social_competition_entries
    WHERE id = season_entry AND last_score = 75 AND final_rank = 1 AND finalised_at IS NOT NULL
  ));
  PERFORM test_d11_social.assert_eq('only positive growth earns the season badge', (
    SELECT count(*) FROM public.leaderboard_badge_awards WHERE season_id = fixture_season_id AND profile_id = profile_one
  ), 1);
  PERFORM public.finalise_social_season(fixture_season_id);
  PERFORM test_d11_social.assert_eq('season finalisation is badge-idempotent', (
    SELECT count(*) FROM public.leaderboard_badge_awards WHERE season_id = fixture_season_id AND profile_id = profile_one
  ), 1);
END;
$$;

ROLLBACK;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.profiles WHERE id::text LIKE 'd1110000-%')
     OR EXISTS (SELECT 1 FROM public.bands WHERE id::text LIKE 'd1120000-%')
     OR EXISTS (SELECT 1 FROM public.leaderboard_seasons WHERE id = 'd1130000-0000-4000-8000-000000000001'::uuid)
  THEN
    RAISE EXCEPTION 'D11 rollback verification failed';
  END IF;
END;
$$;

SELECT 'D11 social competition harness passed; fixture rows rolled back' AS result;
