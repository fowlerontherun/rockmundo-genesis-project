-- Server-authoritative company expense deductions.

CREATE TABLE IF NOT EXISTS public.company_expense_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_user_id uuid NOT NULL,
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  idempotency_key text NOT NULL,
  request_hash text NOT NULL,
  result jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(actor_user_id, idempotency_key)
);

ALTER TABLE public.company_expense_requests ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.deduct_company_balance(
  p_company_id uuid,
  p_amount numeric,
  p_description text,
  p_category text,
  p_idempotency_key text
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_profile_id uuid := public._caller_profile_id();
  v_company public.companies%ROWTYPE;
  v_existing public.company_expense_requests%ROWTYPE;
  v_hash text;
  v_tx uuid;
  v_result jsonb;
BEGIN
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  IF v_profile_id IS NULL THEN RAISE EXCEPTION 'active_profile_required'; END IF;
  IF p_amount IS NULL OR p_amount <= 0 THEN RAISE EXCEPTION 'amount_must_be_positive'; END IF;
  IF p_idempotency_key IS NULL OR length(btrim(p_idempotency_key)) < 8 THEN RAISE EXCEPTION 'idempotency_key_required'; END IF;

  v_hash := encode(digest(p_company_id::text || '|' || p_amount::text || '|' || coalesce(p_description,'') || '|' || coalesce(p_category,''), 'sha256'), 'hex');
  PERFORM pg_advisory_xact_lock(hashtextextended(v_user_id::text || ':' || p_idempotency_key, 0));

  SELECT * INTO v_existing FROM public.company_expense_requests
  WHERE actor_user_id = v_user_id AND idempotency_key = p_idempotency_key FOR UPDATE;
  IF FOUND THEN
    IF v_existing.request_hash <> v_hash THEN RAISE EXCEPTION 'idempotency_conflict'; END IF;
    RETURN v_existing.result || jsonb_build_object('idempotent', true);
  END IF;

  SELECT * INTO v_company FROM public.companies WHERE id = p_company_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'company_not_found'; END IF;
  IF v_company.owner_id <> v_user_id THEN RAISE EXCEPTION 'company_not_owned'; END IF;
  IF v_company.status IN ('dissolved','suspended') OR coalesce(v_company.is_bankrupt,false) THEN RAISE EXCEPTION 'company_not_active'; END IF;
  IF coalesce(v_company.balance,0) < p_amount THEN RAISE EXCEPTION 'insufficient_company_funds'; END IF;

  SELECT public.finance_debit_owner(
    'company', p_company_id, round(p_amount * 100)::bigint,
    'company_operating_expense', p_description,
    'company-expense-ledger-' || p_idempotency_key,
    v_profile_id,
    jsonb_build_object('legacy_category', p_category)
  ) INTO v_tx;

  UPDATE public.companies
  SET balance = balance - p_amount,
      negative_balance_since = CASE WHEN balance - p_amount < 0 THEN coalesce(negative_balance_since, now()) ELSE NULL END,
      updated_at = now()
  WHERE id = p_company_id;

  INSERT INTO public.company_transactions(company_id, transaction_type, amount, description, category)
  VALUES (p_company_id, 'expense', -p_amount, p_description, p_category);

  v_result := jsonb_build_object(
    'companyId', p_company_id,
    'amount', p_amount,
    'balance', v_company.balance - p_amount,
    'financialTransactionId', v_tx,
    'idempotent', false
  );

  INSERT INTO public.company_expense_requests(actor_user_id, company_id, idempotency_key, request_hash, result)
  VALUES (v_user_id, p_company_id, p_idempotency_key, v_hash, v_result);

  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.deduct_company_balance(uuid,numeric,text,text,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.deduct_company_balance(uuid,numeric,text,text,text) TO authenticated;
NOTIFY pgrst, 'reload schema';