-- Make owner/company and company/company transfers server-authoritative and atomic.

CREATE TABLE IF NOT EXISTS public.company_fund_transfer_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_user_id uuid NOT NULL,
  actor_profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  transfer_kind text NOT NULL CHECK (transfer_kind IN ('deposit', 'withdrawal', 'intercompany')),
  source_company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE,
  destination_company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE,
  amount numeric NOT NULL CHECK (amount > 0),
  idempotency_key text NOT NULL,
  request_hash text NOT NULL,
  result jsonb,
  status text NOT NULL DEFAULT 'processing' CHECK (status IN ('processing', 'succeeded')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (actor_user_id, idempotency_key)
);

ALTER TABLE public.company_fund_transfer_requests ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.transfer_company_funds(
  p_transfer_kind text,
  p_company_id uuid,
  p_amount numeric,
  p_destination_company_id uuid DEFAULT NULL,
  p_idempotency_key text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_profile_id uuid := public._caller_profile_id();
  v_profile public.profiles%ROWTYPE;
  v_source public.companies%ROWTYPE;
  v_destination public.companies%ROWTYPE;
  v_request public.company_fund_transfer_requests%ROWTYPE;
  v_request_hash text;
  v_minimum_balance numeric := 10000;
  v_amount_minor bigint;
  v_financial_transaction_id uuid;
  v_result jsonb;
BEGIN
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'not_authenticated' USING ERRCODE='P0001'; END IF;
  IF v_profile_id IS NULL THEN RAISE EXCEPTION 'active_profile_required' USING ERRCODE='P0001'; END IF;
  IF p_transfer_kind NOT IN ('deposit','withdrawal','intercompany') THEN RAISE EXCEPTION 'invalid_transfer_kind' USING ERRCODE='P0001'; END IF;
  IF p_amount IS NULL OR p_amount <= 0 THEN RAISE EXCEPTION 'invalid_transfer_amount' USING ERRCODE='P0001'; END IF;
  IF p_idempotency_key IS NULL OR length(btrim(p_idempotency_key)) < 8 THEN RAISE EXCEPTION 'idempotency_key_required' USING ERRCODE='P0001'; END IF;
  IF p_transfer_kind = 'intercompany' AND (p_destination_company_id IS NULL OR p_destination_company_id = p_company_id) THEN RAISE EXCEPTION 'invalid_destination_company' USING ERRCODE='P0001'; END IF;

  v_request_hash := encode(digest(concat_ws('|', p_transfer_kind, p_company_id, p_destination_company_id, p_amount), 'sha256'), 'hex');
  PERFORM pg_advisory_xact_lock(hashtextextended(v_user_id::text || ':' || p_idempotency_key, 0));

  SELECT * INTO v_request FROM public.company_fund_transfer_requests
  WHERE actor_user_id=v_user_id AND idempotency_key=p_idempotency_key FOR UPDATE;
  IF FOUND THEN
    IF v_request.request_hash <> v_request_hash THEN RAISE EXCEPTION 'idempotency_conflict' USING ERRCODE='P0001'; END IF;
    IF v_request.status='succeeded' THEN RETURN v_request.result || jsonb_build_object('idempotent', true); END IF;
    RAISE EXCEPTION 'company_transfer_in_progress' USING ERRCODE='P0001';
  END IF;

  SELECT * INTO v_profile FROM public.profiles
  WHERE id=v_profile_id AND user_id=v_user_id AND died_at IS NULL FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'profile_not_eligible' USING ERRCODE='P0001'; END IF;

  SELECT * INTO v_source FROM public.companies WHERE id=p_company_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'company_not_found' USING ERRCODE='P0001'; END IF;
  IF v_source.owner_id <> v_user_id THEN RAISE EXCEPTION 'company_not_owned' USING ERRCODE='P0001'; END IF;
  IF v_source.status <> 'active' OR COALESCE(v_source.is_bankrupt,false) THEN RAISE EXCEPTION 'company_not_active' USING ERRCODE='P0001'; END IF;

  IF p_transfer_kind='intercompany' THEN
    SELECT * INTO v_destination FROM public.companies WHERE id=p_destination_company_id FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'destination_company_not_found' USING ERRCODE='P0001'; END IF;
    IF v_destination.owner_id <> v_user_id THEN RAISE EXCEPTION 'destination_company_not_owned' USING ERRCODE='P0001'; END IF;
    IF v_destination.status <> 'active' OR COALESCE(v_destination.is_bankrupt,false) THEN RAISE EXCEPTION 'destination_company_not_active' USING ERRCODE='P0001'; END IF;
  END IF;

  IF p_transfer_kind='deposit' AND COALESCE(v_profile.cash,0) < p_amount THEN RAISE EXCEPTION 'insufficient_personal_funds' USING ERRCODE='P0001'; END IF;
  IF p_transfer_kind IN ('withdrawal','intercompany') AND COALESCE(v_source.balance,0) - p_amount < v_minimum_balance THEN RAISE EXCEPTION 'minimum_company_balance_required' USING ERRCODE='P0001'; END IF;

  INSERT INTO public.company_fund_transfer_requests(actor_user_id,actor_profile_id,transfer_kind,source_company_id,destination_company_id,amount,idempotency_key,request_hash)
  VALUES(v_user_id,v_profile.id,p_transfer_kind,p_company_id,p_destination_company_id,p_amount,p_idempotency_key,v_request_hash)
  RETURNING * INTO v_request;

  v_amount_minor := round(p_amount * 100)::bigint;

  IF p_transfer_kind='deposit' THEN
    SELECT public.finance_transfer('player',v_profile.id,'company',v_source.id,v_amount_minor,'company_revenue','Owner deposit','company-transfer:'||p_idempotency_key,'company',v_source.id,v_profile.id,jsonb_build_object('transferKind',p_transfer_kind)) INTO v_financial_transaction_id;
    UPDATE public.profiles SET cash=cash-p_amount, updated_at=now() WHERE id=v_profile.id;
    UPDATE public.companies SET balance=balance+p_amount, negative_balance_since=NULL, updated_at=now() WHERE id=v_source.id;
    INSERT INTO public.company_transactions(company_id,transaction_type,amount,description,category,related_entity_id,related_entity_type)
    VALUES(v_source.id,'investment',p_amount,'Owner deposit','owner_transfer',v_profile.id,'profile');
  ELSIF p_transfer_kind='withdrawal' THEN
    SELECT public.finance_transfer('company',v_source.id,'player',v_profile.id,v_amount_minor,'company_revenue','Owner withdrawal','company-transfer:'||p_idempotency_key,'company',v_source.id,v_profile.id,jsonb_build_object('transferKind',p_transfer_kind)) INTO v_financial_transaction_id;
    UPDATE public.companies SET balance=balance-p_amount, updated_at=now() WHERE id=v_source.id;
    UPDATE public.profiles SET cash=cash+p_amount, updated_at=now() WHERE id=v_profile.id;
    INSERT INTO public.company_transactions(company_id,transaction_type,amount,description,category,related_entity_id,related_entity_type)
    VALUES(v_source.id,'dividend',-p_amount,'Owner withdrawal','owner_transfer',v_profile.id,'profile');
  ELSE
    SELECT public.finance_transfer('company',v_source.id,'company',v_destination.id,v_amount_minor,'company_revenue','Intercompany transfer','company-transfer:'||p_idempotency_key,'company',v_source.id,v_profile.id,jsonb_build_object('transferKind',p_transfer_kind,'destinationCompanyId',v_destination.id)) INTO v_financial_transaction_id;
    UPDATE public.companies SET balance=balance-p_amount, updated_at=now() WHERE id=v_source.id;
    UPDATE public.companies SET balance=balance+p_amount, negative_balance_since=NULL, updated_at=now() WHERE id=v_destination.id;
    INSERT INTO public.company_transactions(company_id,transaction_type,amount,description,category,related_entity_id,related_entity_type) VALUES
      (v_source.id,'transfer_out',-p_amount,'Transfer to '||v_destination.name,'owner_transfer',v_destination.id,'company'),
      (v_destination.id,'transfer_in',p_amount,'Transfer from '||v_source.name,'owner_transfer',v_source.id,'company');
  END IF;

  SELECT jsonb_build_object(
    'transferKind',p_transfer_kind,
    'sourceCompanyId',v_source.id,
    'destinationCompanyId',CASE WHEN p_transfer_kind='intercompany' THEN v_destination.id ELSE NULL END,
    'amount',p_amount,
    'personalCash',(SELECT cash FROM public.profiles WHERE id=v_profile.id),
    'sourceBalance',(SELECT balance FROM public.companies WHERE id=v_source.id),
    'destinationBalance',CASE WHEN p_transfer_kind='intercompany' THEN (SELECT balance FROM public.companies WHERE id=v_destination.id) ELSE NULL END,
    'financialTransactionId',v_financial_transaction_id,
    'idempotent',false
  ) INTO v_result;

  UPDATE public.company_fund_transfer_requests SET status='succeeded',result=v_result,updated_at=now() WHERE id=v_request.id;
  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.transfer_company_funds(text,uuid,numeric,uuid,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.transfer_company_funds(text,uuid,numeric,uuid,text) TO authenticated;

NOTIFY pgrst, 'reload schema';