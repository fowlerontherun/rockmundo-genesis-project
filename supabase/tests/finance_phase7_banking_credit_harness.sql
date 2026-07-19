BEGIN;
SELECT plan(12);

SELECT ok(EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='banking_providers'), 'banking providers table exists');
SELECT ok(EXISTS (SELECT 1 FROM public.banking_providers WHERE provider_code='backbeat_capital'), 'initial music-industry provider seeded');
SELECT ok(EXISTS (SELECT 1 FROM public.loan_products WHERE product_code='starter_personal_loan' AND status='active'), 'starter loan product seeded');
SELECT ok(EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='bank_accounts'), 'bank accounts link to finance accounts');
SELECT is(public.credit_band_for_score(850)::text, 'excellent', 'credit band upper threshold works');
SELECT is(public.credit_band_for_score(600)::text, 'fair', 'neutral new score maps to fair');
SELECT ok(EXISTS (SELECT 1 FROM information_schema.routines WHERE routine_schema='public' AND routine_name='evaluate_loan_application'), 'underwriting service exists');
SELECT ok(EXISTS (SELECT 1 FROM information_schema.routines WHERE routine_schema='public' AND routine_name='accept_loan_offer'), 'loan origination service exists');
SELECT ok(EXISTS (SELECT 1 FROM information_schema.routines WHERE routine_schema='public' AND routine_name='process_due_loan_repayments'), 'scheduled repayment processor exists');
SELECT ok(EXISTS (SELECT 1 FROM information_schema.routines WHERE routine_schema='public' AND routine_name='progress_loan_delinquency'), 'delinquency progression job exists');
SELECT ok(EXISTS (SELECT 1 FROM information_schema.views WHERE table_schema='public' AND table_name='loan_integrity_issues'), 'loan integrity checks exist');
SELECT ok(EXISTS (SELECT 1 FROM public.loan_products WHERE product_code='emergency_payroll_facility' AND purpose_restrictions->>'restricted_to_payroll'='true'), 'emergency payroll facility is restricted-purpose finance');

SELECT * FROM finish();
ROLLBACK;
