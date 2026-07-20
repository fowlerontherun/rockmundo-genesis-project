-- Finance Phase 8B.4 executable assertions (pgTAP-compatible smoke coverage).
BEGIN;
SELECT plan(10);
SELECT has_function('public','contribute_personal_funds_to_band',ARRAY['uuid','uuid','bigint','text','text'],'band contribution RPC exists');
SELECT has_function('public','get_or_create_band_treasury_account',ARRAY['uuid','character'],'band treasury resolver exists');
SELECT has_table('public','band_financial_contributions','contribution records table exists');
SELECT has_table('public','band_expense_payments','band expense payment parent records exist');
SELECT has_table('public','band_expense_payment_components','band expense payment components exist');
SELECT col_type_is('public','financial_accounts','allow_negative_balance','boolean','negative-balance policy is explicit');
SELECT col_has_default('public','financial_accounts','allow_negative_balance','negative-balance policy defaults safely');
SELECT isnt_empty($$SELECT 1 FROM pg_constraint WHERE conname='banking_provider_financial_accounts_account_role_check' AND pg_get_constraintdef(oid) LIKE '%mortgage_repayment_cash%'$$,'dedicated mortgage repayment cash role is allowed');
SELECT isnt_empty($$SELECT 1 FROM pg_proc WHERE proname='post_mortgage_schedule_payment' AND pg_get_functiondef(oid) NOT LIKE '%GREATEST(line.fees_due_minor,1)%'$$,'mortgage repayments do not manufacture minimum fees');
SELECT isnt_empty($$SELECT 1 FROM pg_proc WHERE proname='complete_mortgaged_property_purchase' AND pg_get_functiondef(oid) LIKE '%funding_debited_once%'$$,'completion documents provider funding debited once');
SELECT * FROM finish();
ROLLBACK;
