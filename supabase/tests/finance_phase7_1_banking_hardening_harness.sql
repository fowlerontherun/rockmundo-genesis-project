-- Finance Phase 7.1 behavioural/security harness skeleton.
-- Run with pgTAP after applying Finance Phase 1-7.1 migrations.
BEGIN;
SELECT plan(12);

SELECT has_function('public', 'assert_financial_owner_permission', ARRAY['public.financial_owner_type','uuid','text','uuid'], 'financial-owner authorisation helper exists');
SELECT has_function('public', 'finance_transfer_accounts', ARRAY['uuid','uuid','bigint','character','public.financial_transaction_category','text','text','text','uuid','uuid','jsonb'], 'exact account transfer helper exists');
SELECT has_table('public', 'loan_payment_attempts', 'durable loan payment attempts exist');
SELECT has_table('public', 'banking_provider_financial_accounts', 'provider accounting accounts exist');

SELECT ok(EXISTS (SELECT 1 FROM pg_proc WHERE proname='finance_transfer_accounts' AND prosrc LIKE '%amount must be positive%'), 'exact account transfer rejects zero amounts');

SELECT ok(EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='loan_schedule_lines' AND policyname='loan_schedule_owner_select' AND qual LIKE '%can_access_loan_contract%'), 'loan schedule RLS ties to parent loan authorisation');
SELECT ok(EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='loan_payments' AND qual LIKE '%can_access_loan_contract%'), 'loan payments RLS ties to parent loan authorisation');
SELECT ok(EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='loan_offers' AND qual LIKE '%can_access_loan_application%'), 'loan offers RLS ties to application authorisation');
SELECT ok(EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='deposit_interest_accruals' AND qual LIKE '%can_access_financial_owner%'), 'deposit accrual RLS ties to bank-account owner');
SELECT ok(EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='credit_score_events' AND qual LIKE '%can_access_financial_owner%'), 'credit-event RLS ties to owner authorisation');
SELECT ok(EXISTS (SELECT 1 FROM pg_proc WHERE proname='process_due_loan_repayments' AND prosrc LIKE '%service role required%'), 'repayment processor is service-role gated');
SELECT ok(EXISTS (SELECT 1 FROM pg_proc WHERE proname='progress_loan_delinquency' AND prosrc LIKE '%service role required%'), 'delinquency processor is service-role gated');

SELECT * FROM finish();
ROLLBACK;
