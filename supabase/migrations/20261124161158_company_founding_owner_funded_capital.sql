-- Founder capital now comes from the player: registration fee plus starting capital.
-- The original helper grant is offset by a second finance_debit_owner in the same transaction.
-- Function is copied from the verified live deployment on 2026-11-24.

CREATE OR REPLACE FUNCTION public.found_company(p_name text, p_company_type text, p_description text DEFAULT NULL::text, p_headquarters_city_id uuid DEFAULT NULL::uuid, p_parent_company_id uuid DEFAULT NULL::uuid, p_idempotency_key text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  v_user uuid := auth.uid();
  v_profile_id uuid := public._caller_profile_id();
  v_cost numeric;
  v_starting numeric;
  v_personal_cash numeric;
  v_result jsonb;
  v_funding_tx uuid;
BEGIN
  IF v_user IS NULL OR v_profile_id IS NULL THEN
    RAISE EXCEPTION 'active_profile_required' USING ERRCODE='P0001';
  END IF;
  IF p_idempotency_key IS NULL OR length(btrim(p_idempotency_key)) < 8 THEN
    RAISE EXCEPTION 'idempotency_key_required' USING ERRCODE='P0001';
  END IF;

  CASE p_company_type
    WHEN 'holding' THEN v_cost:=500000; v_starting:=1000000;
    WHEN 'label' THEN v_cost:=1000000; v_starting:=1000000;
    WHEN 'security' THEN v_cost:=250000; v_starting:=500000;
    WHEN 'factory' THEN v_cost:=500000; v_starting:=750000;
    WHEN 'logistics' THEN v_cost:=300000; v_starting:=500000;
    WHEN 'venue' THEN v_cost:=750000; v_starting:=1000000;
    WHEN 'rehearsal' THEN v_cost:=200000; v_starting:=300000;
    WHEN 'recording_studio' THEN v_cost:=400000; v_starting:=600000;
    WHEN 'festival' THEN RAISE EXCEPTION 'festival_company_requires_vip_flow' USING ERRCODE='P0001';
    ELSE RAISE EXCEPTION 'invalid_company_type' USING ERRCODE='P0001';
  END CASE;

  -- A replay of a completed request never funds capital again, even if cash
  -- has subsequently been spent. The helper verifies the payload hash.
  IF NOT EXISTS (
    SELECT 1 FROM public.company_founding_requests
    WHERE actor_user_id=v_user AND idempotency_key=p_idempotency_key
      AND status='succeeded'
  ) THEN
    SELECT cash INTO v_personal_cash FROM public.profiles
     WHERE id=v_profile_id AND user_id=v_user AND died_at IS NULL;
    IF NOT FOUND OR coalesce(v_personal_cash,0) < v_cost+v_starting THEN
      RAISE EXCEPTION 'insufficient_personal_funds' USING ERRCODE='P0001';
    END IF;
  END IF;

  -- The helper's system-funded starting-funds credit is offset by this
  -- additional owner debit in the same PostgreSQL transaction. The system
  -- account therefore receives exactly what it supplied to the company.
  v_result:=public._found_company_with_grant(
    p_name,p_company_type,p_description,p_headquarters_city_id,
    p_parent_company_id,p_idempotency_key
  );
  IF coalesce((v_result->>'idempotent')::boolean,false) THEN RETURN v_result; END IF;

  v_funding_tx:=public.finance_debit_owner(
    'player',v_profile_id,(v_starting*100)::bigint,'starting_funds',
    'Company starting capital funded by owner',
    'company-owner-capital:'||p_idempotency_key,v_profile_id,
    jsonb_build_object('companyId',v_result->>'companyId','classification','owner_capital')
  );
  SELECT cash INTO v_personal_cash FROM public.profiles WHERE id=v_profile_id;
  v_result:=v_result || jsonb_build_object(
    'personalCash',v_personal_cash,'ownerCapitalFunded',v_starting,
    'ownerCapitalFundingTransactionId',v_funding_tx
  );
  UPDATE public.company_founding_requests
    SET result=v_result,updated_at=now()
    WHERE actor_user_id=v_user AND idempotency_key=p_idempotency_key;
  RETURN v_result;
END;
$function$;

REVOKE ALL ON FUNCTION public.found_company(text,text,text,uuid,uuid,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.found_company(text,text,text,uuid,uuid,text) TO authenticated;
NOTIFY pgrst, 'reload schema';
