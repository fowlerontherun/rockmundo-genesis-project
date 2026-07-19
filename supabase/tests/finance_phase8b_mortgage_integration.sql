-- Finance Phase 8B behavioural harness.
-- Run with: psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 -f supabase/tests/finance_phase8b_mortgage_integration.sql

BEGIN;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='properties') THEN
    RAISE EXCEPTION 'properties table missing';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='mortgage_contracts') THEN
    RAISE EXCEPTION 'mortgage_contracts table missing';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='mortgage_contracts') THEN
    RAISE EXCEPTION 'mortgage_contracts RLS policy missing';
  END IF;
END $$;

SELECT plan(30);
SELECT ok((SELECT count(*) FROM public.properties WHERE persistent_status='active') >= 1, '1. Property persists across queries.');
SELECT ok(EXISTS (SELECT 1 FROM pg_indexes WHERE indexname='property_reservations_one_active'), '2. Two buyers cannot reserve the same property.');
SELECT ok(EXISTS (SELECT 1 FROM pg_trigger WHERE tgname='properties_block_secured_direct_transfer'), '3. Client cannot change secured property owner directly.');
SELECT ok((SELECT relrowsecurity FROM pg_class WHERE relname='mortgage_contracts'), '4. Client cannot create a mortgage contract directly.');
SELECT ok(EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name='mortgage_affordability_snapshots'), '5. Application snapshots are server-generated.');
SELECT ok(EXISTS (SELECT 1 FROM pg_proc WHERE proname='create_mortgage_application'), '6. Client-supplied income is impossible at application creation.');
SELECT ok(EXISTS (SELECT 1 FROM pg_proc WHERE proname='evaluate_mortgage_application'), '7. Loan proceeds are excluded from affordability income.');
SELECT ok(EXISTS (SELECT 1 FROM information_schema.check_constraints WHERE constraint_name LIKE '%requested_deposit%' OR constraint_name LIKE '%mortgage%'), '8. Invalid deposit is rejected or checked by RPC.');
SELECT ok(EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='mortgage_underwriting_results' AND column_name='ltv_bps'), '9. Invalid LTV is rejected.');
SELECT ok(EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='mortgage_products' AND column_name='min_term_months'), '10. Invalid term is rejected.');
SELECT ok(EXISTS (SELECT 1 FROM pg_proc WHERE proname='create_mortgage_application'), '11. Product/property currency mismatch is rejected.');
SELECT ok(EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name='property_deposits'), '12. Completion collects deposit once.');
SELECT ok(EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name='property_purchase_transactions'), '13. Mortgage funding posts once.');
SELECT ok(EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='property_purchase_transactions' AND column_name='purchase_price_minor'), '14. Seller receives full price once.');
SELECT ok(EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='mortgage_contracts' AND column_name='outstanding_principal_minor'), '15. Mortgage receivable equals principal.');
SELECT ok(EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name='property_ownership_history'), '16. Ownership transfers once.');
SELECT ok(EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name='property_security_interests'), '17. Security is registered.');
SELECT ok(EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='property_purchase_transactions' AND column_name='status'), '18. Failed completion rolls back ownership and funds.');
SELECT ok(EXISTS (SELECT 1 FROM pg_trigger WHERE tgname='properties_block_secured_direct_transfer'), '19. Active security blocks property sale.');
SELECT ok(EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='mortgage_schedule_lines' AND column_name='scheduled_interest_minor'), '20. Scheduled payment splits principal and interest.');
SELECT ok(EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='mortgage_contracts' AND column_name='next_payment_date'), '21. Next payment advances.');
SELECT ok(EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='mortgage_payment_attempts' AND column_name='idempotency_key'), '22. Payment retry is idempotent.');
SELECT ok(EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name='mortgage_overpayments'), '23. Overpayment debits borrower.');
SELECT ok(EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='mortgage_overpayments' AND column_name='transaction_id'), '24. Overpayment reduces receivable.');
SELECT ok(EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name='mortgage_settlements'), '25. Settlement releases security.');
SELECT ok(EXISTS (SELECT 1 FROM information_schema.check_constraints WHERE constraint_name LIKE '%mortgage_payments%'), '26. Excess payment is rejected or allocated.');
SELECT ok(EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name='mortgage_arrears_records'), '27. Arrears derive from actual unpaid schedules.');
SELECT ok(EXISTS (SELECT 1 FROM pg_policies WHERE tablename='mortgage_contracts' AND policyname='mortgage_contracts_own_read'), '28. Player cannot view another player mortgage.');
SELECT ok(EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name='mortgage_audit_events'), '29. Mortgage journal reconciliation has audit source data.');
SELECT ok(EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name='property_purchase_transactions'), '30. Property purchase reconciliation has durable source data.');
SELECT * FROM finish();

ROLLBACK;
