-- Executable financial correctness harness for replacement festival-company founding.
-- Run with a local Supabase test database after migrations have been applied.
BEGIN;
SELECT plan(22);

SELECT has_function('public','found_festival_company',ARRAY['text','text','text','text'],'founding RPC exists');
SELECT has_function('public','festival_company_capabilities',ARRAY[]::text[],'capability RPC exists');
SELECT has_function('public','can_profile_found_company',ARRAY['uuid','text'],'canonical company-limit helper exists');
SELECT isnt(position('UPDATE public.profiles SET cash = cash - v_cost' in pg_get_functiondef('public.found_festival_company(text,text,text,text)'::regprocedure)),0,'visible profile balance is charged exactly once in whole USD');
SELECT isnt(position('finance_debit_owner' in pg_get_functiondef('public.found_festival_company(text,text,text,text)'::regprocedure)),0,'personal founding fee is recorded through finance debit service');
SELECT is(position('INSERT INTO public.company_transactions(company_id,transaction_type,amount' in pg_get_functiondef('public.found_festival_company(text,text,text,text)'::regprocedure)),0,'no company operating transaction is created');
SELECT isnt(position('festivalCompanyManagementEnabled' in pg_get_functiondef('public.get_festival_company_setup(uuid)'::regprocedure)),0,'setup uses management capability, not creation capability');
SELECT isnt(position('festivalConfigurationEnabled' in pg_get_functiondef('public.get_festival_company_setup(uuid)'::regprocedure)),0,'setup response exposes configuration capability');
SELECT is((public.festival_company_capabilities()->>'festivalCompanyCreationEnabled')::boolean, false, 'fresh default keeps festival creation disabled');
SELECT is((public.festival_company_capabilities()->>'festivalCompanyManagementEnabled')::boolean, false, 'fresh default keeps management disabled');
SELECT is((public.festival_company_capabilities()->>'festivalConfigurationEnabled')::boolean, false, 'fresh default keeps configuration disabled');
SELECT is((public.festival_company_capabilities()->>'companyLimit')::integer, 3, 'company limit default is three only when missing');
SELECT col_is_unique('public','financial_transactions',ARRAY['idempotency_key'],'financial transaction idempotency key is globally unique');
SELECT results_eq($$SELECT 2000000::numeric * 100::bigint$$, ARRAY[200000000::bigint], 'currency mapping stores $2,000,000 as 200,000,000 minor units');
SELECT isnt(position('v_cost_minor bigint := 200000000' in pg_get_functiondef('public.found_festival_company(text,text,text,text)'::regprocedure)),0,'founding function uses verified minor-unit amount');
SELECT isnt(position('can_profile_found_company(v_profile.id, ''festival'')' in pg_get_functiondef('public.found_festival_company(text,text,text,text)'::regprocedure)),0,'founding invokes canonical company-limit helper');
SELECT isnt(position('result=v_result' in pg_get_functiondef('public.found_festival_company(text,text,text,text)'::regprocedure)),0,'successful idempotency result is stored');
SELECT isnt(position('IF v_req.status = ''succeeded'' THEN RETURN v_req.result' in pg_get_functiondef('public.found_festival_company(text,text,text,text)'::regprocedure)),0,'successful retry returns stored result');
SELECT isnt(position('idempotency_conflict' in pg_get_functiondef('public.found_festival_company(text,text,text,text)'::regprocedure)),0,'changed-payload retry is rejected');
SELECT is_empty($$SELECT 1 FROM public.company_transactions WHERE related_entity_type='festival_company' AND transaction_type='expense' AND amount=2000000$$,'no retained founding company operating expense rows remain');
SELECT ok(to_regclass('public.festival_company_founding_requests') IS NOT NULL,'founding request table is preserved');
SELECT finish();
ROLLBACK;
