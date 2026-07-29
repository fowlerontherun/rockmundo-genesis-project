-- Make standard company founding server-authoritative and atomic.

CREATE TABLE IF NOT EXISTS public.company_founding_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_user_id uuid NOT NULL,
  actor_profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  idempotency_key text NOT NULL,
  request_hash text NOT NULL,
  company_id uuid REFERENCES public.companies(id) ON DELETE SET NULL,
  result jsonb,
  status text NOT NULL DEFAULT 'processing' CHECK (status IN ('processing', 'succeeded')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (actor_user_id, idempotency_key)
);

ALTER TABLE public.company_founding_requests ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.company_founding_requests FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.found_company(
  p_name text,
  p_company_type text,
  p_description text DEFAULT NULL,
  p_headquarters_city_id uuid DEFAULT NULL,
  p_parent_company_id uuid DEFAULT NULL,
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
  v_request public.company_founding_requests%ROWTYPE;
  v_company_id uuid;
  v_creation_cost numeric;
  v_starting_balance numeric;
  v_weekly_cost numeric;
  v_request_hash text;
  v_personal_cash numeric;
  v_result jsonb;
  v_finance_tx uuid;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'not_authenticated' USING ERRCODE = 'P0001';
  END IF;

  IF v_profile_id IS NULL THEN
    RAISE EXCEPTION 'active_profile_required' USING ERRCODE = 'P0001';
  END IF;

  IF p_idempotency_key IS NULL OR length(btrim(p_idempotency_key)) < 8 THEN
    RAISE EXCEPTION 'idempotency_key_required' USING ERRCODE = 'P0001';
  END IF;

  IF char_length(btrim(coalesce(p_name, ''))) < 2 OR char_length(btrim(p_name)) > 50 THEN
    RAISE EXCEPTION 'invalid_company_name' USING ERRCODE = 'P0001';
  END IF;

  CASE p_company_type
    WHEN 'holding' THEN v_creation_cost := 500000; v_starting_balance := 1000000; v_weekly_cost := 2500;
    WHEN 'label' THEN v_creation_cost := 1000000; v_starting_balance := 1000000; v_weekly_cost := 8000;
    WHEN 'security' THEN v_creation_cost := 250000; v_starting_balance := 500000; v_weekly_cost := 3500;
    WHEN 'factory' THEN v_creation_cost := 500000; v_starting_balance := 750000; v_weekly_cost := 6000;
    WHEN 'logistics' THEN v_creation_cost := 300000; v_starting_balance := 500000; v_weekly_cost := 4500;
    WHEN 'venue' THEN v_creation_cost := 750000; v_starting_balance := 1000000; v_weekly_cost := 7000;
    WHEN 'rehearsal' THEN v_creation_cost := 200000; v_starting_balance := 300000; v_weekly_cost := 2000;
    WHEN 'recording_studio' THEN v_creation_cost := 400000; v_starting_balance := 600000; v_weekly_cost := 5000;
    WHEN 'festival' THEN RAISE EXCEPTION 'festival_company_requires_vip_flow' USING ERRCODE = 'P0001';
    ELSE RAISE EXCEPTION 'invalid_company_type' USING ERRCODE = 'P0001';
  END CASE;

  SELECT * INTO v_profile
  FROM public.profiles
  WHERE id = v_profile_id
    AND user_id = v_user_id
    AND died_at IS NULL
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'profile_not_eligible' USING ERRCODE = 'P0001';
  END IF;

  IF p_parent_company_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.companies
    WHERE id = p_parent_company_id
      AND owner_id = v_user_id
      AND company_type = 'holding'
      AND status = 'active'
      AND COALESCE(is_bankrupt, false) = false
  ) THEN
    RAISE EXCEPTION 'invalid_parent_company' USING ERRCODE = 'P0001';
  END IF;

  v_request_hash := encode(digest(
    btrim(p_name) || '|' || p_company_type || '|' || coalesce(p_description, '') || '|' ||
    coalesce(p_headquarters_city_id::text, '') || '|' || coalesce(p_parent_company_id::text, ''),
    'sha256'
  ), 'hex');

  PERFORM pg_advisory_xact_lock(hashtextextended(v_user_id::text || ':' || p_idempotency_key, 0));

  SELECT * INTO v_request
  FROM public.company_founding_requests
  WHERE actor_user_id = v_user_id
    AND idempotency_key = p_idempotency_key
  FOR UPDATE;

  IF FOUND THEN
    IF v_request.request_hash <> v_request_hash THEN
      RAISE EXCEPTION 'idempotency_conflict' USING ERRCODE = 'P0001';
    END IF;
    IF v_request.status = 'succeeded' THEN
      RETURN v_request.result || jsonb_build_object('idempotent', true);
    END IF;
    RAISE EXCEPTION 'company_request_in_progress' USING ERRCODE = 'P0001';
  END IF;

  INSERT INTO public.company_founding_requests (
    actor_user_id, actor_profile_id, idempotency_key, request_hash
  ) VALUES (
    v_user_id, v_profile_id, p_idempotency_key, v_request_hash
  ) RETURNING * INTO v_request;

  IF COALESCE(v_profile.cash, 0) < v_creation_cost THEN
    RAISE EXCEPTION 'insufficient_personal_funds' USING ERRCODE = 'P0001';
  END IF;

  UPDATE public.profiles
  SET cash = cash - v_creation_cost,
      updated_at = now()
  WHERE id = v_profile_id
  RETURNING cash INTO v_personal_cash;

  INSERT INTO public.companies (
    owner_id,
    name,
    company_type,
    description,
    headquarters_city_id,
    parent_company_id,
    balance,
    weekly_operating_costs
  ) VALUES (
    v_user_id,
    btrim(p_name),
    p_company_type,
    nullif(btrim(coalesce(p_description, '')), ''),
    p_headquarters_city_id,
    p_parent_company_id,
    v_starting_balance,
    v_weekly_cost
  ) RETURNING id INTO v_company_id;

  INSERT INTO public.company_transactions (
    company_id,
    transaction_type,
    amount,
    description,
    category,
    related_entity_id,
    related_entity_type
  ) VALUES (
    v_company_id,
    'investment',
    v_starting_balance,
    'Initial capital investment',
    'owner_transfer',
    v_profile_id,
    'profile'
  );

  INSERT INTO public.company_shareholders (company_id, user_id, shares)
  VALUES (v_company_id, v_user_id, 100);

  SELECT public.finance_debit_owner(
    'player',
    v_profile_id,
    (v_creation_cost * 100)::bigint,
    'company_founding_fee',
    'Company founding fee',
    'company-founding:' || p_idempotency_key,
    v_profile_id,
    jsonb_build_object('companyId', v_company_id, 'wholeUsdAmount', v_creation_cost)
  ) INTO v_finance_tx;

  v_result := jsonb_build_object(
    'companyId', v_company_id,
    'personalCash', v_personal_cash,
    'foundingCost', v_creation_cost,
    'startingBalance', v_starting_balance,
    'weeklyOperatingCosts', v_weekly_cost,
    'financialTransactionId', v_finance_tx,
    'idempotent', false
  );

  UPDATE public.company_founding_requests
  SET status = 'succeeded',
      company_id = v_company_id,
      result = v_result,
      updated_at = now()
  WHERE id = v_request.id;

  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.found_company(text, text, text, uuid, uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.found_company(text, text, text, uuid, uuid, text) TO authenticated;

NOTIFY pgrst, 'reload schema';
