-- Rollback-only integration checks against a migrated, seeded TEST database.
-- Requires one profile with a level 1+ non-maxed skill. Do not run against production.
-- psql "$TEST_SUPABASE_DB_URL" -v ON_ERROR_STOP=1 -f supabase/tests/random_event_lifecycle_integration.sql
BEGIN;
DO $test$
DECLARE
  v_profile record;
  v_event_id uuid;
  v_player_event_id uuid;
  v_first jsonb;
  v_second jsonb;
  v_grant record;
  v_before_level integer;
  v_before_xp integer;
  v_after_level integer;
  v_after_xp integer;
  v_count integer;
  v_health numeric;
BEGIN
  SELECT p.id, p.user_id, sp.skill_slug, sp.current_level, sp.current_xp
  INTO v_profile
  FROM public.profiles p
  JOIN public.skill_progress sp ON sp.profile_id = p.id
  JOIN public.skill_definitions sd ON sd.slug::text = sp.skill_slug
  WHERE p.user_id IS NOT NULL AND sp.current_level >= 1
    AND sp.current_level < public.progression_skill_max_level(sp.skill_slug)
  ORDER BY p.id, sp.skill_slug LIMIT 1;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Integration fixture missing: create a test profile with a learned, non-maxed skill';
  END IF;

  v_before_level := v_profile.current_level;
  v_before_xp := v_profile.current_xp;

  INSERT INTO public.random_events (
    title, description, category, is_common,
    option_a_text, option_a_effects, option_a_outcome_text,
    option_b_text, option_b_effects, option_b_outcome_text,
    awards_random_skill_xp, skill_xp_min, skill_xp_max
  ) VALUES (
    '__integration_skill_xp_event__', 'Rollback-only test event', 'random', true,
    'Try it', '{"cash":7,"fame":3}'::jsonb, 'Learned from an unlikely encounter',
    'Decline', '{}'::jsonb, 'No reward',
    true, 100, 100
  ) RETURNING id INTO v_event_id;

  INSERT INTO public.player_events (
    user_id, profile_id, event_id, choice_made, choice_made_at,
    target_skill_slug, status
  ) VALUES (
    v_profile.user_id, v_profile.id, v_event_id, 'a', now() - interval '1 day',
    v_profile.skill_slug, 'awaiting_outcome'
  ) RETURNING id INTO v_player_event_id;

  SELECT health INTO v_health FROM public.profiles WHERE id = v_profile.id;

  v_first := public.apply_random_event_outcome(v_player_event_id);
  IF coalesce((v_first->>'applied')::boolean, false) IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'First outcome failed: %', v_first;
  END IF;

  SELECT * INTO v_grant FROM public.random_event_skill_xp_grants
  WHERE player_event_id = v_player_event_id;
  IF NOT FOUND OR v_grant.skill_slug <> v_profile.skill_slug OR v_grant.xp_awarded <> 100 THEN
    RAISE EXCEPTION 'Wrong skill or reward: %', row_to_json(v_grant);
  END IF;

  SELECT current_level, current_xp INTO v_after_level, v_after_xp
  FROM public.skill_progress WHERE profile_id = v_profile.id AND skill_slug = v_profile.skill_slug;
  IF v_after_level < v_before_level OR
     (v_after_level = v_before_level AND v_after_xp <= v_before_xp) THEN
    RAISE EXCEPTION 'Skill progression did not increase after the grant';
  END IF;

  v_second := public.apply_random_event_outcome(v_player_event_id);
  IF coalesce((v_second->>'applied')::boolean, false) <> false THEN
    RAISE EXCEPTION 'Duplicate event was applied twice: %', v_second;
  END IF;

  SELECT count(*) INTO v_count FROM public.random_event_skill_xp_grants
  WHERE player_event_id = v_player_event_id;
  IF v_count <> 1 THEN RAISE EXCEPTION 'Expected one skill grant, got %', v_count; END IF;

  SELECT count(*) INTO v_count FROM public.player_inbox
  WHERE metadata->>'player_event_id' = v_player_event_id::text
    AND category = 'random_event';
  IF v_count <> 1 THEN RAISE EXCEPTION 'Expected one inbox item, got %', v_count; END IF;

  SELECT count(*) INTO v_count FROM public.activity_feed
  WHERE metadata->>'player_event_id' = v_player_event_id::text
    AND activity_type = 'random_event_outcome';
  IF v_count <> 1 THEN RAISE EXCEPTION 'Expected one activity record, got %', v_count; END IF;

  SELECT current_level, current_xp INTO v_before_level, v_before_xp
  FROM public.skill_progress WHERE profile_id = v_profile.id AND skill_slug = v_profile.skill_slug;
  PERFORM public.grant_random_event_skill_xp(v_player_event_id);
  SELECT current_level, current_xp INTO v_after_level, v_after_xp
  FROM public.skill_progress WHERE profile_id = v_profile.id AND skill_slug = v_profile.skill_slug;
  IF v_before_level <> v_after_level OR v_before_xp <> v_after_xp THEN
    RAISE EXCEPTION 'Replayed skill grant changed progression';
  END IF;

  IF (SELECT status FROM public.player_events WHERE id = v_player_event_id) <> 'completed' THEN
    RAISE EXCEPTION 'Event not completed';
  END IF;

  RAISE NOTICE 'PASS: skill event rewards once, records one message and is replay-safe';
END
$test$;
ROLLBACK;
