BEGIN;
SELECT plan(20);

SELECT has_function('public','post_financial_journal',ARRAY['financial_transaction_category','uuid','character','text','jsonb','text','uuid','jsonb'],'journal primitive signature exists');
SELECT has_function('public','reserve_mortgage_deposit',ARRAY['uuid','text'],'deposit reservation is enabled');
SELECT has_function('public','release_mortgage_deposit',ARRAY['uuid','text','text'],'deposit release is enabled');
SELECT has_function('public','complete_mortgaged_property_purchase',ARRAY['uuid','uuid','uuid','text'],'completion RPC is enabled');
SELECT has_function('public','post_mortgage_schedule_payment',ARRAY['uuid','text'],'mortgage payment RPC is enabled');
SELECT has_function('public','retry_mortgage_payment',ARRAY['uuid','text'],'retry RPC is enabled');
SELECT has_function('public','process_due_mortgage_repayments',ARRAY['date','integer'],'scheduled processor is enabled');
SELECT has_function('public','get_mortgage_offer_by_id',ARRAY['uuid'],'offer by id RPC exists');
SELECT has_function('public','list_eligible_mortgage_completion_accounts',ARRAY['uuid'],'eligible account RPC exists');

SELECT ok(EXISTS(SELECT 1 FROM pg_enum e JOIN pg_type t ON t.oid=e.enumtypid WHERE t.typname='financial_transaction_category' AND e.enumlabel='mortgage_deposit_reservation'),'deposit reservation category exists');
SELECT ok(EXISTS(SELECT 1 FROM pg_enum e JOIN pg_type t ON t.oid=e.enumtypid WHERE t.typname='financial_transaction_category' AND e.enumlabel='mortgage_origination'),'origination category exists');
SELECT ok(EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='financial_accounts' AND column_name='currency_code'),'financial_accounts.currency_code exists');
SELECT ok(EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='property_deposits' AND column_name='clearing_account_id'),'property deposit clearing account is stored');
SELECT ok(EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='property_purchase_transactions' AND column_name='seller_principal_settlement_transaction_id'),'principal settlement transaction is linked');

SELECT lives_ok($$ SELECT public.ensure_development_mortgage_provider('GBP') $$,'development mortgage provider can be ensured');
SELECT ok(EXISTS(SELECT 1 FROM public.banking_providers WHERE provider_code='aurora_international' AND status='active' AND 'GBP'=ANY(supported_currencies)),'Aurora development provider is active and supports GBP');
SELECT ok(EXISTS(SELECT 1 FROM public.mortgage_products mp JOIN public.banking_providers bp ON bp.id=mp.provider_id WHERE mp.product_code='aurora_residential_fixed_gbp' AND mp.status='active'),'development mortgage product is linked');
SELECT ok(EXISTS(SELECT 1 FROM public.banking_provider_financial_accounts WHERE account_role='mortgage_funding_cash'),'mortgage funding account exists');
SELECT ok(EXISTS(SELECT 1 FROM public.financial_transactions WHERE idempotency_key LIKE 'phase8b3-dev-mortgage-capital-%'),'provider capitalisation journal exists');
SELECT ok(NOT EXISTS(SELECT 1 FROM public.mortgage_reconciliation_exceptions),'mortgage reconciliation has no exceptions after seed state');

SELECT * FROM finish();
ROLLBACK;
