-- Make subsidiary closure and liquidation server-authoritative and atomic.

CREATE TABLE IF NOT EXISTS public.company_closure_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_user_id uuid NOT NULL,
  actor_profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  idempotency_key text NOT NULL,
  request_hash text NOT NULL,
  result jsonb,
  status text NOT NULL DEFAULT 'processing' CHECK (status IN ('processing', 'succeeded')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (actor_user_id, idempotency_key)
);

ALTER TABLE public.company_closure_requests ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.close_company(
  p_company_id uuid,
  p_transfer_balance boolean DEFAULT true,
  p_idempotency_key text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_profile_id uuid := public._caller_profile_id();
  v_company public.companies%ROWTYPE;
  v_profile public.profiles%ROWTYPE;
  v_request public.company_closure_requests%ROWTYPE;
  v_request_hash text;
  v_transfer_amount numeric := 0;
  v_personal_cash numeric;
  v_result jsonb;
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

  v_request_hash := encode(
    digest(p_company_id::text || '|' || p_transfer_balance::text, 'sha256'),
    'hex'
  );

  PERFORM pg_advisory_xact_lock(hashtextextended(v_user_id::text || ':' || p_idempotency_key, 0));

  SELECT * INTO v_request
  FROM public.company_closure_requests
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

    RAISE EXCEPTION 'company_closure_in_progress' USING ERRCODE = 'P0001';
  END IF;

  SELECT * INTO v_profile
  FROM public.profiles
  WHERE id = v_profile_id
    AND user_id = v_user_id
    AND died_at IS NULL
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'profile_not_eligible' USING ERRCODE = 'P0001';
  END IF;

  SELECT * INTO v_company
  FROM public.companies
  WHERE id = p_company_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'company_not_found' USING ERRCODE = 'P0001';
  END IF;

  IF v_company.owner_id <> v_user_id THEN
    RAISE EXCEPTION 'company_not_owned' USING ERRCODE = 'P0001';
  END IF;

  IF v_company.company_type IN ('holding', 'festival') THEN
    RAISE EXCEPTION 'company_type_cannot_be_closed_here' USING ERRCODE = 'P0001';
  END IF;

  IF v_company.status = 'dissolved' THEN
    RETURN jsonb_build_object(
      'companyId', v_company.id,
      'companyName', v_company.name,
      'transferredAmount', 0,
      'personalCash', v_profile.cash,
      'status', 'dissolved',
      'idempotent', true
    );
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.artist_label_contracts
    WHERE label_id = v_company.id
      AND status = 'active'
  ) THEN
    RAISE EXCEPTION 'active_artist_contracts_exist' USING ERRCODE = 'P0001';
  END IF;

  INSERT INTO public.company_closure_requests(
    actor_user_id,
    actor_profile_id,
    company_id,
    idempotency_key,
    request_hash
  ) VALUES (
    v_user_id,
    v_profile.id,
    v_company.id,
    p_idempotency_key,
    v_request_hash
  ) RETURNING * INTO v_request;

  IF p_transfer_balance THEN
    v_transfer_amount := GREATEST(COALESCE(v_company.balance, 0), 0);
  END IF;

  IF v_transfer_amount > 0 THEN
    UPDATE public.profiles
    SET cash = cash + v_transfer_amount,
        updated_at = now()
    WHERE id = v_profile.id
    RETURNING cash INTO v_personal_cash;

    INSERT INTO public.company_transactions(
      company_id,
      transaction_type,
      amount,
      description,
      category,
      related_entity_id,
      related_entity_type
    ) VALUES (
      v_company.id,
      'transfer_out',
      -v_transfer_amount,
      'Company liquidation transferred to owner',
      'owner_transfer',
      v_profile.id,
      'profile'
    );
  ELSE
    v_personal_cash := v_profile.cash;
  END IF;

  UPDATE public.companies
  SET balance = 0,
      status = 'dissolved',
      weekly_operating_costs = 0,
      updated_at = now()
  WHERE id = v_company.id;

  v_result := jsonb_build_object(
    'companyId', v_company.id,
    'companyName', v_company.name,
    'transferredAmount', v_transfer_amount,
    'personalCash', v_personal_cash,
    'status', 'dissolved',
    'idempotent', false
  );

  UPDATE public.company_closure_requests
  SET status = 'succeeded',
      result = v_result,
      updated_at = now()
  WHERE id = v_request.id;

  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.close_company(uuid, boolean, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.close_company(uuid, boolean, text) TO authenticated;

NOTIFY pgrst, 'reload schema';
