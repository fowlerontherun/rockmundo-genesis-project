BEGIN;
\i supabase/migrations/20260717090000_finance_phase1_ledger.sql
DO $$
DECLARE p1 uuid := gen_random_uuid(); p2 uuid := gen_random_uuid(); tx uuid; account_balance bigint; issue_count int;
BEGIN
  INSERT INTO auth.users(id) VALUES (gen_random_uuid()), (gen_random_uuid()) ON CONFLICT DO NOTHING;
  INSERT INTO public.profiles(id, user_id, username, display_name, cash) VALUES (p1, (SELECT id FROM auth.users LIMIT 1), 'finance_test_1', 'Finance Test 1', 100), (p2, (SELECT id FROM auth.users OFFSET 1 LIMIT 1), 'finance_test_2', 'Finance Test 2', 0);
  PERFORM public.finance_credit_owner('player', p1, 10000, 'starting_funds', 'test starting funds', 'test-start-'||p1, p1);
  tx := public.finance_transfer('player', p1, 'player', p2, 2500, 'player_to_player_transfer', 'test transfer', 'test-transfer-1', NULL, NULL, p1, '{}');
  IF public.finance_transfer('player', p1, 'player', p2, 2500, 'player_to_player_transfer', 'test transfer', 'test-transfer-1', NULL, NULL, p1, '{}') <> tx THEN RAISE EXCEPTION 'idempotency failed'; END IF;
  SELECT current_balance_minor INTO account_balance FROM public.financial_accounts WHERE owner_type='player' AND owner_id=p1;
  IF account_balance <> 7500 THEN RAISE EXCEPTION 'unexpected source balance %', account_balance; END IF;
  PERFORM public.finance_reserve_owner('player', p1, 1000);
  PERFORM public.finance_release_reserve_owner('player', p1, 1000);
  IF (SELECT COALESCE(SUM(CASE WHEN entry_direction='debit' THEN amount_minor ELSE -amount_minor END),0) FROM public.financial_ledger_entries WHERE transaction_id=tx) <> 0 THEN RAISE EXCEPTION 'ledger entries are not balanced'; END IF;
  BEGIN
    PERFORM public.finance_debit_owner('player', p2, 999999, 'equipment_purchase', 'too much', 'test-overdraft', p2);
    RAISE EXCEPTION 'insufficient funds not enforced';
  EXCEPTION WHEN OTHERS THEN NULL;
  SELECT COUNT(*) INTO issue_count FROM public.financial_account_integrity_issues WHERE subject_id = tx::text;
  IF issue_count <> 0 THEN RAISE EXCEPTION 'integrity issue detected for valid tx'; END IF;
END $$;
ROLLBACK;
