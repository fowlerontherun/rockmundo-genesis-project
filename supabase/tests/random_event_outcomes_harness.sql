-- Random-event outcome safety checks. Run against migrated test DB:
-- psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 -f supabase/tests/random_event_outcomes_harness.sql
-- Uses pgTAP; transaction is rolled back, so no game data is changed.
BEGIN;
SELECT plan(18);

SELECT has_table('public', 'random_event_skill_xp_grants', 'dedicated event skill XP grant ledger exists');
SELECT has_column('public', 'random_events', 'awards_random_skill_xp', 'events opt into skill XP');
SELECT has_column('public', 'random_events', 'skill_xp_min', 'per-event skill XP minimum exists');
SELECT has_column('public', 'random_events', 'skill_xp_max', 'per-event skill XP maximum exists');
SELECT has_column('public', 'player_events', 'target_skill_slug', 'assigned target skill is persisted');

SELECT has_function('public', 'grant_random_event_skill_xp', ARRAY['uuid'], 'atomic skill grant RPC exists');
SELECT has_function('public', 'apply_random_event_outcome', ARRAY['uuid'], 'atomic outcome RPC exists');
SELECT function_privs_are('public', 'grant_random_event_skill_xp', ARRAY['uuid'], 'authenticated', ARRAY[]::text[], 'player cannot call grant RPC');
SELECT function_privs_are('public', 'apply_random_event_outcome', ARRAY['uuid'], 'authenticated', ARRAY[]::text[], 'player cannot call outcome RPC');
SELECT function_privs_are('public', 'grant_random_event_skill_xp', ARRAY['uuid'], 'service_role', ARRAY['EXECUTE'], 'worker can grant skill XP');
SELECT function_privs_are('public', 'apply_random_event_outcome', ARRAY['uuid'], 'service_role', ARRAY['EXECUTE'], 'worker can complete outcomes');

SELECT has_trigger('public', 'player_events', 'trg_deliver_random_event_outcome', 'completion delivery hook exists');
SELECT has_trigger('public', 'player_events', 'trg_apply_catalogue_event_release_hype', 'catalogue hype delivery hook preserved');

SELECT is(
  (SELECT count(*)::integer FROM public.random_events
   WHERE awards_random_skill_xp
     AND skill_xp_min >= 100
     AND skill_xp_max <= 500
     AND skill_xp_min <= skill_xp_max
     AND is_active),
  16,
  'all 16 active comical event seeds have valid 100–500 XP ranges'
);
SELECT is(
  (SELECT count(*)::integer FROM public.random_events
   WHERE awards_random_skill_xp
     AND (NOT is_common OR NOT is_active)),
  0,
  'comical events remain enabled and repeatable'
);
SELECT is(
  (SELECT count(*)::integer FROM public.random_event_skill_xp_grants
   WHERE xp_awarded NOT BETWEEN 100 AND 500),
  0,
  'ledger has no out-of-range XP awards'
);

-- A nonexistent UUID must never create profile/band/notification changes.
SELECT is(
  (public.apply_random_event_outcome('00000000-0000-0000-0000-000000000000'::uuid)->>'reason'),
  'not_found',
  'a nonexistent player event is handled without awarding rewards'
);
SELECT is(
  public.grant_random_event_skill_xp('00000000-0000-0000-0000-000000000000'::uuid)::text,
  NULL::text,
  'a nonexistent player event cannot grant skill XP'
);

SELECT * FROM finish();
ROLLBACK;
