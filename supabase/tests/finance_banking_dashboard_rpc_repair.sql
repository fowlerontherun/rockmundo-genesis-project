-- Smoke coverage for repaired Banking dashboard RPC contract.
BEGIN;
SELECT plan(12);

SELECT has_function('public', 'get_banking_dashboard', ARRAY[]::text[], 'zero-argument banking dashboard RPC exists');
SELECT is((SELECT count(*)::int FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace WHERE n.nspname = 'public' AND p.proname = 'get_banking_dashboard' AND p.pronargs = 0), 1, 'exactly one zero-argument dashboard RPC exists');
SELECT is((SELECT count(*)::int FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace WHERE n.nspname = 'public' AND p.proname = 'get_banking_dashboard' AND p.pronargs <> 0), 0, 'no conflicting dashboard overloads exist');
SELECT is((SELECT pg_get_function_result('public.get_banking_dashboard()'::regprocedure)), 'jsonb', 'dashboard returns jsonb');
SELECT ok((SELECT prosecdef FROM pg_proc WHERE oid = 'public.get_banking_dashboard()'::regprocedure), 'dashboard is security definer');
SELECT ok(EXISTS(SELECT 1 FROM information_schema.routine_privileges WHERE routine_schema = 'public' AND routine_name = 'get_banking_dashboard' AND grantee = 'authenticated' AND privilege_type = 'EXECUTE'), 'authenticated can execute dashboard RPC');
SELECT ok(NOT EXISTS(SELECT 1 FROM information_schema.routine_privileges WHERE routine_schema = 'public' AND routine_name = 'get_banking_dashboard' AND grantee IN ('anon', 'PUBLIC') AND privilege_type = 'EXECUTE'), 'anonymous and public execute grants are revoked');
SELECT lives_ok($$SELECT public.get_banking_dashboard()$$, 'dashboard RPC smoke select succeeds for users without profiles');
SELECT ok(jsonb_typeof(public.get_banking_dashboard()->'accounts') = 'array', 'accounts is an array instead of null');
SELECT ok(jsonb_typeof(public.get_banking_dashboard()->'loans') = 'array', 'loans is an array instead of null');
SELECT ok(public.get_banking_dashboard() ? 'creditProfile', 'dashboard preserves camelCase creditProfile key');
SELECT ok(public.get_banking_dashboard() ? 'recentActivity', 'dashboard preserves camelCase recentActivity key');

SELECT * FROM finish();
ROLLBACK;
