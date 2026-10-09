-- pgTAP regression checks for random event mutation boundaries.
-- Run on a migrated TEST database; everything rolls back.
BEGIN;
SELECT plan(7);
SELECT has_function('public','submit_random_event_choice',ARRAY['uuid','text'],'atomic choice RPC exists');
SELECT function_privs_are('public','submit_random_event_choice',ARRAY['uuid','text'],'authenticated',ARRAY['EXECUTE'],'authenticated user can choose');
SELECT function_privs_are('public','submit_random_event_choice',ARRAY['uuid','text'],'anon',ARRAY[]::text[],'anonymous cannot choose');
SELECT table_privs_are('public','player_events','authenticated',ARRAY['SELECT'],'authenticated user cannot directly change protected event fields');
SELECT unlike(pg_get_functiondef('public.submit_random_event_choice(uuid,text)'::regprocedure),'%service_role%','choice RPC does not switch to service-role identity');
SELECT like(pg_get_functiondef('public.submit_random_event_choice(uuid,text)'::regprocedure),'%status=''pending_choice''%','choice transition requires pending state');
SELECT like(pg_get_functiondef('public.apply_random_event_outcome(uuid)'::regprocedure),'%no_eligible_skill%','XP-bearing event is not completed without reward');
SELECT * FROM finish();
ROLLBACK;
