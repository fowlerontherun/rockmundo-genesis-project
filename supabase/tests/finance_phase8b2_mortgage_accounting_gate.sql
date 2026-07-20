-- Finance Phase 8B.2 accounting safety gate tests.
BEGIN;
SELECT plan(10);

SELECT has_function('public','resolve_property_seller_financial_account',ARRAY['property_owner_type','uuid','char'],'seller account resolver exists');
SELECT has_function('public','release_mortgage_deposit',ARRAY['uuid','text','text'],'deposit release gate exists');
SELECT has_column('public','mortgage_contracts','recurring_obligation_id','contracts can link recurring obligations');
SELECT has_column('public','mortgage_payments','journal_event_id','mortgage payments can link compound journal');
SELECT has_column('public','property_purchase_transactions','seller_financial_account_id','purchase transactions link seller financial account');
SELECT has_column('public','property_purchase_transactions','settlement_transaction_ids','purchase transactions link settlement postings');
SELECT ok(EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname='public' AND indexname='mortgage_arrears_unique_active_state'), 'arrears duplicate-state prevention exists');
SELECT throws_ok($$ SELECT public.process_due_mortgage_repayments(CURRENT_DATE, 1) $$, '42501', NULL, 'scheduled processor is service-role gated');
SELECT throws_ok($$ SELECT public.complete_mortgaged_property_purchase(gen_random_uuid(),gen_random_uuid(),gen_random_uuid(),'test') $$, 'P0001', NULL, 'unsafe completion is fail-closed');
SELECT ok(NOT EXISTS (SELECT 1 FROM public.mortgage_reconciliation_exceptions), 'fresh seed data has no mortgage reconciliation exceptions');

SELECT * FROM finish();
ROLLBACK;
