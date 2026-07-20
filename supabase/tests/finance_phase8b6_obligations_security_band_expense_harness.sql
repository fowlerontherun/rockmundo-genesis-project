-- Finance Phase 8B.6 executable audit harness.
-- Run with: supabase test db

BEGIN;

SELECT plan(21);

SELECT has_table('public','financial_obligations','financial obligations table exists');
SELECT has_table('public','financial_obligation_schedule','obligation schedule table exists');
SELECT has_table('public','debt_records','debt records table exists');
SELECT has_table('public','player_credit_history','player credit history table exists');
SELECT has_table('public','player_credit_scores','player credit scores table exists');

SELECT ok((SELECT relrowsecurity FROM pg_class WHERE oid='public.financial_obligations'::regclass),'financial_obligations RLS enabled');
SELECT ok((SELECT relrowsecurity FROM pg_class WHERE oid='public.financial_obligation_schedule'::regclass),'financial_obligation_schedule RLS enabled');
SELECT ok((SELECT relrowsecurity FROM pg_class WHERE oid='public.financial_obligation_attempts'::regclass),'financial_obligation_attempts RLS enabled');
SELECT ok((SELECT relrowsecurity FROM pg_class WHERE oid='public.debt_records'::regclass),'debt_records RLS enabled');
SELECT ok((SELECT relrowsecurity FROM pg_class WHERE oid='public.player_credit_history'::regclass),'player_credit_history RLS enabled');
SELECT ok((SELECT relrowsecurity FROM pg_class WHERE oid='public.player_credit_scores'::regclass),'player_credit_scores RLS enabled');

SELECT has_function('public','get_my_financial_obligations_dashboard',ARRAY[]::name[],'player dashboard RPC exists');
SELECT has_function('public','retry_my_financial_obligation_payment',ARRAY['uuid','text']::name[],'player retry RPC exists');
SELECT has_function('public','preview_band_expense_funding',ARRAY['uuid','text','uuid','bigint','character','text','uuid']::name[],'band preview RPC exists');
SELECT has_function('public','confirm_band_expense_funding',ARRAY['uuid','text','uuid','bigint','character','text','uuid','text']::name[],'band confirm RPC no longer accepts browser destination account');
SELECT has_function('public','resolve_and_pay_band_expense_internal',ARRAY['uuid','text','uuid','uuid','bigint','character','text','uuid','uuid','text']::name[],'internal band expense resolver exists');

SELECT isnt(has_function_privilege('authenticated','public.process_financial_obligation_payment(uuid,text)','EXECUTE'),true,'authenticated cannot execute internal payment processor');
SELECT isnt(has_function_privilege('authenticated','public.process_due_financial_obligations(date,integer)','EXECUTE'),true,'authenticated cannot execute due processor');
SELECT ok(has_function_privilege('authenticated','public.get_my_financial_obligations_dashboard()','EXECUTE'),'authenticated can execute dashboard wrapper');
SELECT isnt(has_function_privilege('authenticated','public.resolve_and_pay_band_expense_internal(uuid,text,uuid,uuid,bigint,character,text,uuid,uuid,text)','EXECUTE'),true,'authenticated cannot execute internal band expense resolver');
SELECT isnt(has_function_privilege('anon','public.resolve_and_pay_band_expense_internal(uuid,text,uuid,uuid,bigint,character,text,uuid,uuid,text)','EXECUTE'),true,'anon cannot execute internal band expense resolver');

SELECT * FROM finish();
ROLLBACK;
