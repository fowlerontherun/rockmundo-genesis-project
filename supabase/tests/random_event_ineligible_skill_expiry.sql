-- Contract-level checks for permanently ineligible skill-XP outcomes.
-- Run against a migrated test database with pgTAP installed.
BEGIN;
SELECT plan(7);

SELECT like(
  pg_get_functiondef('public.apply_random_event_outcome(uuid)'::regprocedure),
  '%status = ''expired''%',
  'ineligible skill reward event is expired rather than left awaiting outcome'
);
SELECT like(
  pg_get_functiondef('public.apply_random_event_outcome(uuid)'::regprocedure),
  '%no_eligible_skill%',
  'ineligible outcome is explicitly tagged'
);
SELECT like(
  pg_get_functiondef('public.apply_random_event_outcome(uuid)'::regprocedure),
  '%Daily event: No skill XP awarded%',
  'player receives a transparent no-reward inbox notification'
);
SELECT like(
  pg_get_functiondef('public.apply_random_event_outcome(uuid)'::regprocedure),
  '%v_grant is null%',
  'expiry path is conditional on missing eligible skill grant'
);
SELECT function_privs_are(
  'public', 'apply_random_event_outcome', ARRAY['uuid'], 'authenticated',
  ARRAY[]::text[], 'authenticated players cannot resolve outcomes themselves'
);
SELECT function_privs_are(
  'public', 'apply_random_event_outcome', ARRAY['uuid'], 'service_role',
  ARRAY['EXECUTE'], 'worker may resolve outcomes'
);
SELECT is(
  (public.apply_random_event_outcome('00000000-0000-0000-0000-000000000000'::uuid)->>'reason'),
  'not_found',
  'unknown event remains a harmless no-op'
);

SELECT * FROM finish();
ROLLBACK;
