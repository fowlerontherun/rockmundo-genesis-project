-- Finance Phase 8B.1 behavioural mortgage integration tests.
-- Run with psql against a reset Supabase database after migrations.

BEGIN;

SELECT plan(12);

SELECT ok(EXISTS (
  SELECT 1 FROM public.mortgage_products mp
  JOIN public.banking_providers bp ON bp.id = mp.provider_id
  WHERE mp.status='active' AND bp.status='active' AND mp.currency_code = ANY(bp.supported_currencies)
), 'active mortgage products have real active providers');

SELECT ok(NOT EXISTS (
  SELECT 1 FROM public.mortgage_products WHERE status='active' AND provider_id IS NULL
), 'no active provider-less mortgage products remain');

SELECT ok(EXISTS (
  SELECT 1 FROM public.banking_provider_financial_accounts WHERE account_role='mortgage_funding_cash'
), 'provider mortgage funding accounts are provisioned');

SELECT ok(EXISTS (
  SELECT 1 FROM public.banking_provider_financial_accounts WHERE account_role='mortgage_receivable'
), 'provider mortgage receivable accounts are provisioned');

SELECT has_function('public','reserve_property_for_mortgage_offer',ARRAY['uuid','text'],'reservation RPC exists');
SELECT has_function('public','set_mortgage_completion_accounts',ARRAY['uuid','uuid','uuid'],'account selection RPC exists');
SELECT has_function('public','complete_mortgaged_property_purchase',ARRAY['uuid','uuid','uuid','text'],'completion RPC exists');
SELECT has_function('public','process_due_mortgage_repayments',ARRAY['date','integer'],'scheduled repayment processor exists');
SELECT has_function('public','retry_mortgage_payment',ARRAY['uuid','text'],'manual retry RPC exists');
SELECT has_function('public','get_mortgage_dashboard',ARRAY['uuid'],'dashboard RPC exists');

SELECT ok(EXISTS (
  SELECT 1 FROM pg_indexes WHERE schemaname='public' AND indexname='mortgage_offers_one_active'
), 'active mortgage offers are uniqueness constrained');

SELECT ok(NOT EXISTS (SELECT 1 FROM public.mortgage_reconciliation_exceptions), 'fresh seed data has no mortgage reconciliation exceptions');

SELECT * FROM finish();
ROLLBACK;
