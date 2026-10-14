-- #4082: metadata-only repair for two existing ledger-backed band accounts.
-- This is a controlled production repair, NOT an automatic migration.
-- It MUST NOT create accounts, credit funds, mutate balances or pay wages.
-- Read docs/finance/PAYROLL_TREASURY_RECONCILIATION_20261014.md first.
--
-- Preconditions: backup and restored staging clone; exact target UUIDs, one
-- active primary band account each, and a fully balanced completed journal.
-- No historical payroll catch-up is authorized by this script.
BEGIN;

DO $reconcile$
DECLARE
  v_target record;
  v_band public.bands%ROWTYPE;
  v_account public.financial_accounts%ROWTYPE;
  v_account_count integer;
  v_entry_count bigint;
  v_unsettled_count bigint;
  v_ledger_balance bigint;
  v_prior_role text;
BEGIN
  FOR v_target IN
    SELECT * FROM (VALUES
      ('d40788d3-230c-440a-9ce7-98d337b8fac6'::uuid,
       'd3593fad-df6b-4613-8daf-c51ba35c6dfe'::uuid),
      ('3b6c8c60-7e8e-456d-858a-d6f1dcb9a296'::uuid,
       '9e0e483c-66a7-495f-a027-2fb7aff3abf4'::uuid)
    ) AS target(band_id, account_id)
    ORDER BY band_id
  LOOP
    SELECT * INTO STRICT v_band FROM public.bands
      WHERE id = v_target.band_id FOR UPDATE;
    IF v_band.status::text <> 'active'
      OR COALESCE(v_band.weekly_pay_percent, 0) <= 0 THEN
      RAISE EXCEPTION 'Payroll treasury reconciliation blocked: band status/pay configuration changed';
    END IF;

    SELECT COUNT(*) INTO v_account_count
    FROM public.financial_accounts a
    WHERE a.owner_type = 'band'::public.financial_owner_type
      AND a.owner_id = v_target.band_id;
    IF v_account_count <> 1 THEN
      RAISE EXCEPTION 'Payroll treasury reconciliation blocked: unexpected band account count';
    END IF;

    SELECT * INTO STRICT v_account FROM public.financial_accounts a
    WHERE a.id = v_target.account_id AND a.owner_id = v_target.band_id
      AND a.owner_type = 'band'::public.financial_owner_type
      FOR UPDATE;

    IF v_account.account_status::text <> 'active'
      OR v_account.is_primary IS DISTINCT FROM TRUE
      OR trim(v_account.default_currency_code) <> 'USD'
      OR v_account.account_name <> 'Band operating account'
      OR v_account.current_balance_minor < 0
      OR v_account.reserved_balance_minor <> 0
      OR v_account.available_balance_minor <> v_account.current_balance_minor THEN
      RAISE EXCEPTION 'Payroll treasury reconciliation blocked: account eligibility changed';
    END IF;

    v_prior_role := v_account.metadata->>'account_role';
    IF v_prior_role IS NOT NULL AND v_prior_role <> 'band_treasury' THEN
      RAISE EXCEPTION 'Payroll treasury reconciliation blocked: conflicting account role';
    END IF;

    SELECT COUNT(*),
      COALESCE(SUM(CASE le.entry_direction::text
        WHEN 'credit' THEN le.amount_minor
        WHEN 'debit' THEN -le.amount_minor
        ELSE 0
      END), 0),
      COUNT(*) FILTER(WHERE tx.id IS NULL OR tx.status::text <> 'completed')
    INTO v_entry_count, v_ledger_balance, v_unsettled_count
    FROM public.financial_ledger_entries le
    LEFT JOIN public.financial_transactions tx ON tx.id = le.transaction_id
    WHERE le.account_id = v_account.id;

    IF v_entry_count < 1 OR v_unsettled_count <> 0
      OR v_ledger_balance IS DISTINCT FROM v_account.current_balance_minor THEN
      RAISE EXCEPTION 'Payroll treasury reconciliation blocked: journal does not support balance';
    END IF;

    -- Metadata-only: account identity and existing posted-money amounts stay
    -- unchanged. Safe to replay after verification; it updates zero rows then.
    UPDATE public.financial_accounts a
      SET metadata = COALESCE(a.metadata, '{}'::jsonb) ||
        jsonb_build_object('account_role','band_treasury')
    WHERE a.id = v_account.id
      AND COALESCE(a.metadata->>'account_role','') <> 'band_treasury';
  END LOOP;
END;
$reconcile$;

COMMIT;

-- After execution, independently verify roles and the ledger again.
-- Do NOT automatically run process_weekly_band_payroll() or cron migrations.
