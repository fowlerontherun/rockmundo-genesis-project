-- Behavioural harness for festival audience and performance outcomes.
-- Run with: psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 -f supabase/tests/festival_audience_outcomes_harness.sql
BEGIN;
SELECT plan(13);
SELECT has_table('public', 'festival_audience_generations', 'audience generations exist');
SELECT has_table('public', 'festival_performance_outcomes', 'performance outcomes exist');
SELECT has_table('public', 'festival_performance_resolution_inputs', 'immutable resolution input ledger exists');
SELECT has_function('public', 'generate_festival_edition_audience', ARRAY['uuid','text'], 'audience RPC exists');
SELECT has_function('public', 'resolve_festival_performance', ARRAY['uuid','text'], 'authoritative resolution RPC exists');
SELECT has_index('public', 'festival_performance_outcomes', 'uq_festival_performance_outcomes_one_live_session', 'one live outcome per session is enforced');
SELECT function_privs_are('public', '_calculate_festival_performance_outcome', ARRAY['uuid','text'], 'authenticated', ARRAY[]::text[], 'raw calculator is not browser callable');
SELECT function_privs_are('public', 'resolve_festival_performance', ARRAY['uuid','text'], 'anon', ARRAY[]::text[], 'anonymous callers cannot resolve outcomes');
SELECT function_privs_are('public', 'resolve_festival_performance', ARRAY['uuid','text'], 'authenticated', ARRAY['EXECUTE'], 'authenticated operators use the permission-checked boundary');
SELECT like(pg_get_functiondef('public.resolve_festival_performance(uuid,text)'::regprocedure), '%FOR UPDATE%', 'resolution serialises retries and tabs');
SELECT like(pg_get_functiondef('public.resolve_festival_performance(uuid,text)'::regprocedure), '%authoritative_facts%', 'resolution freezes authoritative facts');
SELECT like(pg_get_functiondef('public.resolve_festival_performance(uuid,text)'::regprocedure), '%presentation_input_applied%', 'presentation input is explicitly cosmetic');
SELECT like(pg_get_functiondef('public.resolve_festival_performance(uuid,text)'::regprocedure), '%performance_resolved%', 'resolution emits canonical audit evidence');
SELECT * FROM finish();

-- Full data-path assertions require seeded canonical festival editions, active contracts and sessions.
-- This rollback harness verifies the schema/RPC contract and is intentionally side-effect-free.
ROLLBACK;
