-- Reconstruction of the server-side recovery already applied to RockMundo on 2026-11-24.
-- Idempotent on production; also supplies the missing table and RPC code for new environments.
-- Historical balances are deliberately left unchanged pending ledger reconciliation.

CREATE TABLE IF NOT EXISTS public.company_shareholders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE RESTRICT,
  user_id uuid NOT NULL,
  shares integer NOT NULL CHECK (shares > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (company_id, user_id)
);
ALTER TABLE public.company_shareholders ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS company_shareholders_read_participants ON public.company_shareholders;
CREATE POLICY company_shareholders_read_participants ON public.company_shareholders
  FOR SELECT TO authenticated
  USING (
    user_id = (SELECT auth.uid()) OR EXISTS (
      SELECT 1 FROM public.companies c
      WHERE c.id = company_id AND c.owner_id = (SELECT auth.uid())
    )
  );
REVOKE ALL ON public.company_shareholders FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.company_shareholders TO authenticated;

-- Existing non-festival founders own 100% of their equity in the legacy owner model.
-- Preserve festival character-share records in public.company_shares until unified.
INSERT INTO public.company_shareholders(company_id, user_id, shares)
SELECT c.id, c.owner_id, 100 FROM public.companies c
WHERE c.company_type <> 'festival'
  AND NOT EXISTS (SELECT 1 FROM public.company_shareholders s
                  WHERE s.company_id = c.id AND s.user_id = c.owner_id)
ON CONFLICT (company_id, user_id) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.company_founding_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_user_id uuid NOT NULL,
  actor_profile_id uuid NOT NULL REFERENCES public.profiles(id),
  idempotency_key text NOT NULL,
  request_hash text NOT NULL,
  company_id uuid REFERENCES public.companies(id) ON DELETE SET NULL,
  result jsonb,
  status text NOT NULL DEFAULT 'processing' CHECK (status IN ('processing', 'succeeded')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (actor_user_id, idempotency_key)
);
CREATE TABLE IF NOT EXISTS public.company_closure_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_user_id uuid NOT NULL,
  actor_profile_id uuid NOT NULL REFERENCES public.profiles(id),
  company_id uuid NOT NULL REFERENCES public.companies(id),
  idempotency_key text NOT NULL,
  request_hash text NOT NULL,
  result jsonb,
  status text NOT NULL DEFAULT 'processing' CHECK (status IN ('processing', 'succeeded')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (actor_user_id, idempotency_key)
);
ALTER TABLE public.company_founding_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.company_closure_requests ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.company_founding_requests, public.company_closure_requests
  FROM PUBLIC, anon, authenticated;

-- Owner operations must use ledger-aware RPCs, never raw browser table mutations.
REVOKE INSERT, UPDATE, DELETE ON public.companies FROM PUBLIC, anon, authenticated;
GRANT UPDATE(name, description, logo_url) ON public.companies TO authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.company_transactions FROM PUBLIC, anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.company_shares FROM PUBLIC, anon, authenticated;
-- Legacy dividend function mutates profile cash without a financial ledger receipt.
REVOKE ALL ON FUNCTION public.pay_company_dividends(uuid, numeric)
  FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public._found_company_with_grant(p_name text, p_company_type text, p_description text DEFAULT NULL::text, p_headquarters_city_id uuid DEFAULT NULL::uuid, p_parent_company_id uuid DEFAULT NULL::uuid, p_idempotency_key text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  v_user uuid := auth.uid();
  v_profile_id uuid := public._caller_profile_id();
  v_profile public.profiles%ROWTYPE;
  v_request public.company_founding_requests%ROWTYPE;
  v_company_id uuid;
  v_cost numeric;
  v_starting numeric;
  v_upkeep numeric;
  v_hash text;
  v_fee_tx uuid;
  v_capital_tx uuid;
  v_cash numeric;
  v_result jsonb;
BEGIN
  IF v_user IS NULL OR v_profile_id IS NULL THEN
    RAISE EXCEPTION 'active_profile_required' USING ERRCODE = 'P0001';
  END IF;
  IF p_idempotency_key IS NULL OR length(btrim(p_idempotency_key)) < 8 THEN
    RAISE EXCEPTION 'idempotency_key_required' USING ERRCODE = 'P0001';
  END IF;
  IF length(btrim(coalesce(p_name,''))) NOT BETWEEN 2 AND 50 THEN
    RAISE EXCEPTION 'invalid_company_name' USING ERRCODE = 'P0001';
  END IF;
  CASE p_company_type
    WHEN 'holding' THEN v_cost:=500000; v_starting:=1000000; v_upkeep:=2500;
    WHEN 'label' THEN v_cost:=1000000; v_starting:=1000000; v_upkeep:=8000;
    WHEN 'security' THEN v_cost:=250000; v_starting:=500000; v_upkeep:=3500;
    WHEN 'factory' THEN v_cost:=500000; v_starting:=750000; v_upkeep:=6000;
    WHEN 'logistics' THEN v_cost:=300000; v_starting:=500000; v_upkeep:=4500;
    WHEN 'venue' THEN v_cost:=750000; v_starting:=1000000; v_upkeep:=7000;
    WHEN 'rehearsal' THEN v_cost:=200000; v_starting:=300000; v_upkeep:=2000;
    WHEN 'recording_studio' THEN v_cost:=400000; v_starting:=600000; v_upkeep:=5000;
    WHEN 'festival' THEN RAISE EXCEPTION 'festival_company_requires_vip_flow' USING ERRCODE='P0001';
    ELSE RAISE EXCEPTION 'invalid_company_type' USING ERRCODE='P0001';
  END CASE;
  v_hash := encode(extensions.digest(
    concat_ws('|',btrim(p_name),p_company_type,coalesce(p_description,''),
      coalesce(p_headquarters_city_id::text,''),coalesce(p_parent_company_id::text,'')),
    'sha256'
  ),'hex');
  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(v_user::text||':'||p_idempotency_key,0)
  );
  SELECT * INTO v_request FROM public.company_founding_requests
   WHERE actor_user_id=v_user AND idempotency_key=p_idempotency_key FOR UPDATE;
  IF FOUND THEN
    IF v_request.request_hash <> v_hash THEN
      RAISE EXCEPTION 'idempotency_conflict' USING ERRCODE='P0001';
    END IF;
    IF v_request.status='succeeded' THEN
      RETURN v_request.result || jsonb_build_object('idempotent',true);
    END IF;
    RAISE EXCEPTION 'company_request_in_progress' USING ERRCODE='P0001';
  END IF;

  SELECT * INTO v_profile FROM public.profiles
   WHERE id=v_profile_id AND user_id=v_user AND died_at IS NULL FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'profile_not_eligible' USING ERRCODE='P0001'; END IF;
  IF v_profile.cash < v_cost THEN
    RAISE EXCEPTION 'insufficient_personal_funds' USING ERRCODE='P0001';
  END IF;
  IF p_parent_company_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.companies
     WHERE id=p_parent_company_id AND owner_id=v_user
       AND company_type='holding' AND status='active'
       AND NOT COALESCE(is_bankrupt,false)
  ) THEN RAISE EXCEPTION 'invalid_parent_company' USING ERRCODE='P0001'; END IF;

  INSERT INTO public.company_founding_requests
    (actor_user_id,actor_profile_id,idempotency_key,request_hash)
  VALUES (v_user,v_profile_id,p_idempotency_key,v_hash)
  RETURNING * INTO v_request;

  INSERT INTO public.companies
    (owner_id,name,company_type,description,headquarters_city_id,
      parent_company_id,balance,weekly_operating_costs)
  VALUES
    (v_user,btrim(p_name),p_company_type,nullif(btrim(coalesce(p_description,'')),''),
      p_headquarters_city_id,p_parent_company_id,v_starting,v_upkeep)
  RETURNING id INTO v_company_id;

  -- One finance debit only: its account-sync trigger updates profiles.cash.
  v_fee_tx := public.finance_debit_owner(
    'player',v_profile_id,(v_cost*100)::bigint,'system_fee',
    'Company registration', 'company-founding-fee:'||p_idempotency_key,
    v_profile_id,jsonb_build_object('companyId',v_company_id)
  );
  -- Starting capital is a game grant, separate from fee and operating revenue.
  v_capital_tx := public.finance_credit_owner(
    'company',v_company_id,(v_starting*100)::bigint,'starting_funds',
    'Starting company capital','company-founding-capital:'||p_idempotency_key,
    v_profile_id,jsonb_build_object('companyId',v_company_id)
  );
  INSERT INTO public.company_transactions
    (company_id,transaction_type,amount,description,category,
      related_entity_id,related_entity_type)
  VALUES (v_company_id,'investment',v_starting,'Starting capital grant','general',
          v_profile_id,'profile');

  INSERT INTO public.company_shareholders(company_id,user_id,shares)
  SELECT v_company_id,v_user,GREATEST(c.shares_outstanding,1)
    FROM public.companies c WHERE c.id=v_company_id;
  INSERT INTO public.company_shares(company_id,holder_profile_id,shares)
  SELECT v_company_id,v_profile_id,GREATEST(c.shares_outstanding,1)
    FROM public.companies c WHERE c.id=v_company_id;

  SELECT cash INTO v_cash FROM public.profiles WHERE id=v_profile_id;
  v_result := jsonb_build_object(
    'companyId',v_company_id,'personalCash',v_cash,'foundingCost',v_cost,
    'startingBalance',v_starting,'weeklyOperatingCosts',v_upkeep,
    'financialTransactionId',v_fee_tx,'capitalTransactionId',v_capital_tx,
    'idempotent',false
  );
  UPDATE public.company_founding_requests
  SET company_id=v_company_id,status='succeeded',result=v_result,updated_at=now()
  WHERE id=v_request.id;
  RETURN v_result;
END;
$function$;

CREATE OR REPLACE FUNCTION public.close_company(p_company_id uuid, p_transfer_balance boolean DEFAULT true, p_idempotency_key text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  v_user uuid := auth.uid();
  v_profile_id uuid := public._caller_profile_id();
  v_company public.companies%ROWTYPE;
  v_request public.company_closure_requests%ROWTYPE;
  v_account public.financial_accounts%ROWTYPE;
  v_hash text;
  v_amount numeric;
  v_tx uuid;
  v_cash numeric;
  v_result jsonb;
BEGIN
  IF v_user IS NULL OR v_profile_id IS NULL THEN
    RAISE EXCEPTION 'active_profile_required' USING ERRCODE='P0001';
  END IF;
  IF p_idempotency_key IS NULL OR length(btrim(p_idempotency_key)) < 8 THEN
    RAISE EXCEPTION 'idempotency_key_required' USING ERRCODE='P0001';
  END IF;
  v_hash := encode(extensions.digest(
    p_company_id::text||'|'||p_transfer_balance::text,'sha256'),'hex');
  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(v_user::text||':'||p_idempotency_key,0)
  );
  SELECT * INTO v_request FROM public.company_closure_requests
   WHERE actor_user_id=v_user AND idempotency_key=p_idempotency_key FOR UPDATE;
  IF FOUND THEN
    IF v_request.request_hash <> v_hash THEN
      RAISE EXCEPTION 'idempotency_conflict' USING ERRCODE='P0001';
    END IF;
    IF v_request.status='succeeded' THEN
      RETURN v_request.result || jsonb_build_object('idempotent',true);
    END IF;
    RAISE EXCEPTION 'company_closure_in_progress' USING ERRCODE='P0001';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id=v_profile_id AND user_id=v_user AND died_at IS NULL
  ) THEN RAISE EXCEPTION 'profile_not_eligible' USING ERRCODE='P0001'; END IF;

  SELECT * INTO v_company FROM public.companies
   WHERE id=p_company_id FOR UPDATE;
  IF NOT FOUND OR v_company.owner_id <> v_user THEN
    RAISE EXCEPTION 'company_not_owned' USING ERRCODE='P0001';
  END IF;
  IF v_company.company_type IN ('holding','festival') THEN
    RAISE EXCEPTION 'company_type_cannot_be_closed_here' USING ERRCODE='P0001';
  END IF;
  IF v_company.status='dissolved' THEN
    RETURN jsonb_build_object('companyId',v_company.id,
      'companyName',v_company.name,'transferredAmount',0,
      'personalCash',(SELECT cash FROM public.profiles WHERE id=v_profile_id),
      'status','dissolved','idempotent',true);
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.companies
    WHERE parent_company_id=v_company.id AND status <> 'dissolved'
  ) OR EXISTS (
    SELECT 1 FROM public.artist_label_contracts
    WHERE label_id=v_company.id AND status='active'
  ) OR EXISTS (
    SELECT 1 FROM public.company_employees
    WHERE company_id=v_company.id AND status='active'
  ) OR EXISTS (
    SELECT 1 FROM public.company_employment_contracts
    WHERE company_id=v_company.id AND status NOT IN ('terminated','cancelled','expired')
  ) OR EXISTS (
    SELECT 1 FROM public.company_tax_records
    WHERE company_id=v_company.id AND status IN ('pending','overdue')
  ) OR EXISTS (
    SELECT 1 FROM public.company_shifts s
    JOIN public.company_shift_claims cl ON cl.shift_id=s.id
    WHERE s.company_id=v_company.id AND cl.status='claimed'
  ) THEN
    RAISE EXCEPTION 'company_has_outstanding_obligations' USING ERRCODE='P0001';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.company_shareholders
    WHERE company_id=v_company.id AND user_id <> v_user
  ) OR EXISTS (
    SELECT 1 FROM public.company_shares sh
    JOIN public.profiles p ON p.id=sh.holder_profile_id
    WHERE sh.company_id=v_company.id AND p.user_id <> v_user
  ) THEN RAISE EXCEPTION 'other_shareholders_must_be_settled' USING ERRCODE='P0001'; END IF;

  SELECT * INTO v_account FROM public.financial_accounts
    WHERE owner_type='company' AND owner_id=v_company.id AND is_primary FOR UPDATE;
  IF NOT FOUND OR v_account.current_balance_minor <> round(v_company.balance*100)::bigint
    OR v_account.reserved_balance_minor <> 0 THEN
    RAISE EXCEPTION 'company_finance_reconciliation_required' USING ERRCODE='P0001';
  END IF;
  IF v_company.balance < 0 THEN
    RAISE EXCEPTION 'company_has_outstanding_debt' USING ERRCODE='P0001';
  END IF;
  v_amount:=GREATEST(v_company.balance,0);
  IF v_amount>0 AND NOT p_transfer_balance THEN
    RAISE EXCEPTION 'company_balance_must_be_settled' USING ERRCODE='P0001';
  END IF;

  INSERT INTO public.company_closure_requests
    (actor_user_id,actor_profile_id,company_id,idempotency_key,request_hash)
  VALUES (v_user,v_profile_id,v_company.id,p_idempotency_key,v_hash)
  RETURNING * INTO v_request;

  IF v_amount>0 THEN
    v_tx:=public.finance_transfer(
      'company',v_company.id,'player',v_profile_id,
      (v_amount*100)::bigint,'administrative_adjustment',
      'Company closure distribution','company-closure:'||p_idempotency_key,
      'company',v_company.id,v_profile_id,
      jsonb_build_object('classification','owner_transfer')
    );
    INSERT INTO public.company_transactions
      (company_id,transaction_type,amount,description,category,
        related_entity_id,related_entity_type)
    VALUES (v_company.id,'transfer_out',-v_amount,
      'Closure transfer to owner','owner_transfer',v_profile_id,'profile');
  END IF;
  UPDATE public.companies
     SET balance=0,status='dissolved',weekly_operating_costs=0,updated_at=now()
   WHERE id=v_company.id;
  SELECT cash INTO v_cash FROM public.profiles WHERE id=v_profile_id;
  v_result:=jsonb_build_object(
    'companyId',v_company.id,'companyName',v_company.name,
    'transferredAmount',v_amount,'personalCash',v_cash,
    'financialTransactionId',v_tx,'status','dissolved','idempotent',false
  );
  UPDATE public.company_closure_requests
    SET status='succeeded',result=v_result,updated_at=now()
    WHERE id=v_request.id;
  RETURN v_result;
END;
$function$;


REVOKE ALL ON FUNCTION public._found_company_with_grant(text,text,text,uuid,uuid,text)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.close_company(uuid,boolean,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.close_company(uuid,boolean,text) TO authenticated;

NOTIFY pgrst, 'reload schema';
