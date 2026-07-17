BEGIN;
SELECT plan(8);

SELECT has_table('public','country_economic_profiles','country economic profiles table exists');
SELECT has_table('public','tax_jurisdictions','tax jurisdictions table exists');
SELECT has_table('public','tax_assessments','tax assessments table exists');
SELECT has_function('public','calculate_progressive_personal_tax',ARRAY['uuid','bigint','date'],'progressive personal tax calculator exists');

SELECT ok((SELECT COUNT(*) FROM public.country_economic_profiles) > 0, 'country profiles are seeded from city countries');
SELECT ok((SELECT COUNT(*) FROM public.tax_jurisdictions WHERE status='active') > 0, 'active default jurisdictions are seeded');
SELECT is(((public.calculate_progressive_personal_tax((SELECT id FROM public.tax_jurisdictions WHERE status='active' LIMIT 1), 6000000, CURRENT_DATE)->>'taxMinor')::bigint), 500000::bigint, 'progressive brackets tax slices instead of all income at top rate');
SELECT is(((public.tax_calculate_sales_tax((SELECT id FROM public.tax_jurisdictions WHERE status='active' LIMIT 1), 'product_sale'::public.financial_transaction_category, 10000, 'exclusive')->>'taxAmountMinor')::bigint), 800::bigint, 'sales tax calculation is deterministic at the standard seeded rate');

SELECT * FROM finish();
ROLLBACK;
