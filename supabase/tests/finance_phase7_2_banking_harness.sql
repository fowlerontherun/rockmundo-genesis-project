-- Behavioural assertions for Finance Phase 7.2. Run after a clean reset or an upgrade from Phase 7.1.
\set ON_ERROR_STOP on

BEGIN;

DO $$
DECLARE
  src uuid := gen_random_uuid();
  dst uuid := gen_random_uuid();
  tx uuid;
  ledger_rows integer;
  phase6_rows integer;
BEGIN
  INSERT INTO public.financial_accounts(id, owner_type, account_name, current_balance_minor, default_currency_code, is_primary)
  VALUES (src, 'system', 'Phase 7.2 source', 100000, 'USD', false),
         (dst, 'system', 'Phase 7.2 destination', 0, 'USD', false);

  tx := public.finance_transfer_accounts(src, dst, 1250, 'USD', 'administrative_adjustment', 'Phase 7.2 currency test', 'phase-7-2-transfer-currency-test');

  SELECT count(*) INTO ledger_rows
  FROM public.financial_ledger_entries
  WHERE transaction_id = tx AND currency_code = 'USD';

  IF ledger_rows <> 2 THEN
    RAISE EXCEPTION 'expected two USD ledger rows, found %', ledger_rows;
  END IF;

  SELECT count(*) INTO phase6_rows
  FROM public.financial_transactions
  WHERE id = tx
    AND source_currency_code = 'USD'
    AND destination_currency_code = 'USD'
    AND source_amount_minor = 1250
    AND destination_amount_minor = 1250;

  IF phase6_rows <> 1 THEN
    RAISE EXCEPTION 'Phase 6 transaction currency/amount columns were not populated';
  END IF;
END $$;

ROLLBACK;
