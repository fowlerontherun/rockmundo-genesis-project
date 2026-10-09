-- Rollback-only hospitalization and retry integration test.
-- Run on a seeded TEST database with a profile located in a city with a hospital.
-- psql "$TEST_SUPABASE_DB_URL" -v ON_ERROR_STOP=1 -f supabase/tests/random_event_hospitalization_integration.sql
BEGIN;
DO $test$
DECLARE
  v_profile record;
  v_event uuid;
  v_player_event uuid;
  v_first jsonb;
  v_second jsonb;
  v_count integer;
  v_base_count integer;
  v_activity_base integer;
  v_health numeric;
BEGIN
  select p.id, p.user_id, p.health, p.current_city_id, h.id as hospital_id
  into v_profile
  from public.profiles p
  join public.hospitals h on h.city_id = p.current_city_id
  where p.user_id is not null
  order by p.id, h.id
  limit 1;
  if not found then
    raise exception 'Missing test fixture: profile in a city with a hospital';
  end if;

  select count(*) into v_base_count from public.player_hospitalizations
  where user_id = v_profile.user_id;
  select count(*) into v_activity_base from public.activity_feed
  where user_id = v_profile.user_id and activity_type = 'hospitalized';

  -- Force a threshold crossing in the transaction without committing player changes.
  update public.profiles set health = 12 where id = v_profile.id;
  insert into public.random_events (
    title, description, category, is_common,
    option_a_text, option_a_effects, option_a_outcome_text,
    option_b_text, option_b_effects, option_b_outcome_text
  ) values (
    '__hospitalization_integration__', 'Rollback-only injury scenario', 'health', true,
    'Accept', '{"health":-5}'::jsonb, 'You need medical attention.',
    'Refuse', '{}'::jsonb, 'You recover.'
  ) returning id into v_event;

  insert into public.player_events (
    user_id, profile_id, event_id, choice_made, choice_made_at, status
  ) values (
    v_profile.user_id, v_profile.id, v_event, 'a', now() - interval '1 day', 'awaiting_outcome'
  ) returning id into v_player_event;

  v_first := public.apply_random_event_outcome(v_player_event);
  if coalesce((v_first->>'applied')::boolean, false) is distinct from true then
    raise exception 'First outcome did not apply: %', v_first;
  end if;
  select health into v_health from public.profiles where id = v_profile.id;
  if v_health <> 7 then raise exception 'Expected health 7; received %', v_health; end if;

  select count(*) into v_count from public.player_hospitalizations
  where user_id = v_profile.user_id;
  if v_count <> v_base_count + 1 then
    raise exception 'Expected exactly one new hospitalization; got % (previous %)', v_count, v_base_count;
  end if;

  select count(*) into v_count from public.activity_feed
  where user_id = v_profile.user_id and activity_type = 'hospitalized';
  if v_count <> v_activity_base + 1 then
    raise exception 'Expected exactly one hospitalization activity; got % (previous %)', v_count, v_activity_base;
  end if;

  v_second := public.apply_random_event_outcome(v_player_event);
  if coalesce((v_second->>'applied')::boolean, true) then
    raise exception 'Replayed outcome applied: %', v_second;
  end if;
  select count(*) into v_count from public.player_hospitalizations
  where user_id = v_profile.user_id;
  if v_count <> v_base_count + 1 then
    raise exception 'Replay duplicated hospitalization';
  end if;
  select health into v_health from public.profiles where id = v_profile.id;
  if v_health <> 7 then raise exception 'Replay applied health reduction twice'; end if;

  raise notice 'PASS: threshold crossing admitted once and duplicate outcome was ignored';
END
$test$;
ROLLBACK;
