-- Finance Phase 7.2: provider accounting, authoritative application entry points and banking UI support.

ALTER TABLE public.banking_provider_financial_accounts DROP CONSTRAINT IF EXISTS banking_provider_financial_accounts_account_role_check;
ALTER TABLE public.banking_provider_financial_accounts ADD CONSTRAINT banking_provider_financial_accounts_account_role_check CHECK (account_role IN ('lending_funding','loan_receivable','interest_income','fee_income','loss_write_off','interest_expense','settlement_clearing'));

CREATE OR REPLACE FUNCTION public.finance_transfer_accounts(
  p_source_account_id uuid,
  p_destination_account_id uuid,
  p_amount_minor bigint,
  p_currency_code char(3),
  p_transaction_category public.financial_transaction_category,
  p_description text,
  p_idempotency_key text,
  p_related_entity_type text DEFAULT NULL,
  p_related_entity_id uuid DEFAULT NULL,
  p_actor_profile_id uuid DEFAULT NULL,
  p_metadata jsonb DEFAULT '{}'::jsonb
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE
  src public.financial_accounts;
  dst public.financial_accounts;
  tx uuid;
  first_id uuid;
  second_id uuid;
BEGIN
  IF p_amount_minor <= 0 THEN RAISE EXCEPTION 'amount must be positive'; END IF;
  IF p_source_account_id IS NULL OR p_destination_account_id IS NULL THEN RAISE EXCEPTION 'source and destination accounts are required'; END IF;
  IF p_source_account_id = p_destination_account_id THEN RAISE EXCEPTION 'self transfers are not allowed'; END IF;
  IF p_currency_code !~ '^[A-Z]{3}$' THEN RAISE EXCEPTION 'invalid currency'; END IF;

  SELECT id INTO tx FROM public.financial_transactions WHERE idempotency_key = p_idempotency_key;
  IF tx IS NOT NULL THEN RETURN tx; END IF;

  first_id := LEAST(p_source_account_id, p_destination_account_id);
  second_id := GREATEST(p_source_account_id, p_destination_account_id);
  PERFORM 1 FROM public.financial_accounts WHERE id IN (first_id, second_id) ORDER BY id FOR UPDATE;

  SELECT * INTO src FROM public.financial_accounts WHERE id = p_source_account_id;
  SELECT * INTO dst FROM public.financial_accounts WHERE id = p_destination_account_id;
  IF src.id IS NULL OR dst.id IS NULL THEN RAISE EXCEPTION 'finance account not found'; END IF;
  IF src.account_status <> 'active' OR dst.account_status <> 'active' THEN RAISE EXCEPTION 'account is not active'; END IF;
  IF src.default_currency_code <> p_currency_code OR dst.default_currency_code <> p_currency_code THEN RAISE EXCEPTION 'exact account currency mismatch'; END IF;
  IF src.owner_type <> 'system' AND src.available_balance_minor < p_amount_minor THEN RAISE EXCEPTION 'insufficient funds'; END IF;

  INSERT INTO public.financial_transactions(
    transaction_category,status,currency_code,gross_amount_minor,net_amount_minor,
    source_account_id,destination_account_id,related_entity_type,related_entity_id,description,
    idempotency_key,created_by_user_id,created_by_profile_id,created_by_actor,completed_at,
    source_currency_code,destination_currency_code,source_amount_minor,destination_amount_minor,metadata
  ) VALUES (
    p_transaction_category,'completed',p_currency_code,p_amount_minor,p_amount_minor,
    src.id,dst.id,p_related_entity_type,p_related_entity_id,p_description,
    p_idempotency_key,auth.uid(),p_actor_profile_id,COALESCE(auth.uid()::text,'system'),timezone('utc',now()),
    p_currency_code,p_currency_code,p_amount_minor,p_amount_minor,p_metadata
  ) RETURNING id INTO tx;

  UPDATE public.financial_accounts SET current_balance_minor = current_balance_minor - p_amount_minor, updated_at = timezone('utc',now()) WHERE id = src.id;
  UPDATE public.financial_accounts SET current_balance_minor = current_balance_minor + p_amount_minor, updated_at = timezone('utc',now()) WHERE id = dst.id;
  INSERT INTO public.financial_ledger_entries(transaction_id,account_id,entry_direction,amount_minor,balance_before_minor,balance_after_minor,currency_code) VALUES
    (tx, src.id, 'debit', p_amount_minor, src.current_balance_minor, src.current_balance_minor - p_amount_minor, p_currency_code),
    (tx, dst.id, 'credit', p_amount_minor, dst.current_balance_minor, dst.current_balance_minor + p_amount_minor, p_currency_code);
  RETURN tx;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.finance_transfer_accounts(uuid,uuid,bigint,char(3),public.financial_transaction_category,text,text,text,uuid,uuid,jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.finance_transfer_accounts(uuid,uuid,bigint,char(3),public.financial_transaction_category,text,text,text,uuid,uuid,jsonb) TO service_role;

REVOKE EXECUTE ON FUNCTION public.get_or_create_provider_finance_account(uuid,char(3),text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_or_create_provider_finance_account(uuid,char(3),text) TO service_role;
REVOKE EXECUTE ON FUNCTION public.process_due_loan_repayments(date) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.process_due_loan_repayments(date) TO service_role;
REVOKE EXECUTE ON FUNCTION public.progress_loan_delinquency(date) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.progress_loan_delinquency(date) TO service_role;
REVOKE EXECUTE ON FUNCTION public.record_credit_score_event(public.financial_owner_type,uuid,integer,text,text,text,uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_credit_score_event(public.financial_owner_type,uuid,integer,text,text,text,uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.calculate_equal_principal_schedule(p_principal_minor bigint,p_rate_bps integer,p_term_months integer,p_first_due date DEFAULT (CURRENT_DATE + interval '1 month')::date)
RETURNS TABLE(instalment_number integer,due_date date,opening_principal_minor bigint,scheduled_principal_minor bigint,scheduled_interest_minor bigint,total_due_minor bigint)
LANGUAGE sql STABLE AS $$
  SELECT * FROM public.calculate_equal_instalment_schedule(p_principal_minor,p_rate_bps,p_term_months,p_first_due);
$$;

CREATE OR REPLACE VIEW public.banking_provider_reconciliation AS
WITH contract_totals AS (
  SELECT provider_id, currency_code,
    COALESCE(sum(outstanding_principal_minor),0) AS contract_outstanding_principal_minor,
    COALESCE(sum(principal_minor),0) AS originated_principal_minor,
    COALESCE(sum(interest_paid_minor),0) AS paid_interest_minor,
    COALESCE(sum(fees_paid_minor),0) AS paid_fee_minor
  FROM public.loan_contracts
  GROUP BY provider_id, currency_code
), ledger_totals AS (
  SELECT b.provider_id, b.currency_code,
    COALESCE(sum(CASE WHEN b.account_role='loan_receivable' THEN CASE WHEN e.entry_direction='credit' THEN e.amount_minor ELSE -e.amount_minor END ELSE 0 END),0) AS receivable_ledger_minor,
    COALESCE(sum(CASE WHEN b.account_role='interest_income' THEN CASE WHEN e.entry_direction='credit' THEN e.amount_minor ELSE -e.amount_minor END ELSE 0 END),0) AS interest_income_ledger_minor,
    COALESCE(sum(CASE WHEN b.account_role='fee_income' THEN CASE WHEN e.entry_direction='credit' THEN e.amount_minor ELSE -e.amount_minor END ELSE 0 END),0) AS fee_income_ledger_minor
  FROM public.banking_provider_financial_accounts b
  LEFT JOIN public.financial_ledger_entries e ON e.account_id=b.finance_account_id AND e.currency_code=b.currency_code
  GROUP BY b.provider_id, b.currency_code
)
SELECT COALESCE(c.provider_id,l.provider_id) AS provider_id,
  COALESCE(c.currency_code,l.currency_code) AS currency_code,
  COALESCE(c.contract_outstanding_principal_minor,0) AS contract_outstanding_principal_minor,
  COALESCE(c.originated_principal_minor,0) AS originated_principal_minor,
  COALESCE(c.paid_interest_minor,0) AS paid_interest_minor,
  COALESCE(c.paid_fee_minor,0) AS paid_fee_minor,
  COALESCE(l.receivable_ledger_minor,0) AS receivable_ledger_minor,
  COALESCE(l.interest_income_ledger_minor,0) AS interest_income_ledger_minor,
  COALESCE(l.fee_income_ledger_minor,0) AS fee_income_ledger_minor,
  COALESCE(l.receivable_ledger_minor,0) - COALESCE(c.contract_outstanding_principal_minor,0) AS receivable_difference_minor,
  COALESCE(l.interest_income_ledger_minor,0) - COALESCE(c.paid_interest_minor,0) AS interest_income_difference_minor,
  COALESCE(l.fee_income_ledger_minor,0) - COALESCE(c.paid_fee_minor,0) AS fee_income_difference_minor
FROM contract_totals c
FULL JOIN ledger_totals l ON l.provider_id=c.provider_id AND l.currency_code=c.currency_code;

COMMENT ON VIEW public.banking_provider_reconciliation IS 'Finance Phase 7.2 reconciliation compares loan contract principal/paid components with durable provider ledger account balances.';
