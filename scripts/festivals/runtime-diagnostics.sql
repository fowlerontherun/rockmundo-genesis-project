SET ROLE service_role;
SELECT run_id, mode, pause_after_lock, fail_after_extension, fail_after_debit,
       reached_pause_at IS NOT NULL AS reached_pause,
       second_started_at IS NOT NULL AS second_started,
       release_after_lock,
       expires_at > now() AS unexpired
FROM festival_test.runs
ORDER BY created_at DESC
LIMIT 10;
SELECT count(*) AS companies FROM public.companies WHERE company_type='festival';
SELECT count(*) AS festival_extensions FROM public.festival_companies;
SELECT count(*) AS founding_requests FROM public.festival_company_founding_requests;
SELECT count(*) AS founding_transactions FROM public.financial_transactions WHERE transaction_category='festival_company_founding_fee';
SELECT count(*) AS founding_ledger_entries
FROM public.financial_ledger_entries e
JOIN public.financial_transactions t ON t.id=e.transaction_id
WHERE t.transaction_category='festival_company_founding_fee';
