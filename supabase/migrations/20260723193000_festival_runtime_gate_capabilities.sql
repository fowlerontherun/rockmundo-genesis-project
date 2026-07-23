-- Runtime gate for replacement festival-company founding.
-- Forward-only: preserves existing data and administrator capability values.

CREATE OR REPLACE FUNCTION public.festival_company_capabilities()
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT jsonb_build_object(
    'newFestivalSystemEnabled', COALESCE((cfg.config_value->>'new_festival_system_enabled')::boolean, false),
    'festivalCompanyCreationEnabled', COALESCE((cfg.config_value->>'festival_company_creation_enabled')::boolean, false),
    'festivalCompanyManagementEnabled', COALESCE((cfg.config_value->>'festival_company_management_enabled')::boolean, false),
    'festivalConfigurationEnabled', COALESCE((cfg.config_value->>'festival_configuration_enabled')::boolean, false),
    'companyLimit', COALESCE((cfg.config_value->>'company_limit')::integer, 3)
  )
  FROM (SELECT config_value FROM public.game_config WHERE config_key='festival_company_creation') cfg
  RIGHT JOIN (SELECT 1) fallback ON true
$$;

CREATE OR REPLACE FUNCTION public.festival_company_ownership_limit(p_profile_id uuid DEFAULT NULL)
RETURNS integer LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT COALESCE((public.festival_company_capabilities()->>'companyLimit')::integer, 3)
$$;

CREATE OR REPLACE FUNCTION public.can_profile_found_festival_company(p_profile_id uuid)
RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
DECLARE v_user uuid; v_count integer; v_limit integer;
BEGIN
  SELECT user_id INTO v_user FROM public.profiles WHERE id=p_profile_id AND died_at IS NULL;
  IF v_user IS NULL THEN RETURN false; END IF;
  SELECT count(*) INTO v_count FROM public.companies
  WHERE owner_id=v_user AND parent_company_id IS NULL AND status NOT IN ('dissolved','bankrupt') AND COALESCE(is_bankrupt,false)=false;
  v_limit := public.festival_company_ownership_limit(p_profile_id);
  RETURN v_count < v_limit;
END $$;

-- Compatibility wrappers retained for old clients; festival code uses the honest names above.
CREATE OR REPLACE FUNCTION public.company_ownership_limit(p_profile_id uuid, p_company_type text DEFAULT NULL)
RETURNS integer LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT public.festival_company_ownership_limit(p_profile_id)
$$;

CREATE OR REPLACE FUNCTION public.can_profile_found_company(p_profile_id uuid, p_company_type text DEFAULT NULL)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT public.can_profile_found_festival_company(p_profile_id)
$$;

CREATE OR REPLACE FUNCTION public.finance_debit_player_personal_cash(
  p_profile_id uuid,
  p_amount_minor bigint,
  p_category public.financial_transaction_category,
  p_description text,
  p_idempotency_key text,
  p_metadata jsonb DEFAULT '{}'::jsonb
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_tx uuid; v_account public.financial_accounts; v_balance_minor bigint;
BEGIN
  SELECT public.finance_debit_owner('player', p_profile_id, p_amount_minor, p_category, p_description, p_idempotency_key, p_profile_id, p_metadata || jsonb_build_object('profilesCashRole','compatibility_projection')) INTO v_tx;
  SELECT * INTO v_account FROM public.financial_accounts WHERE owner_type='player' AND owner_id=p_profile_id AND is_primary FOR UPDATE;
  v_balance_minor := v_account.current_balance_minor;
  UPDATE public.profiles SET cash = (v_balance_minor / 100.0), updated_at = now() WHERE id=p_profile_id;
  RETURN jsonb_build_object('transactionId', v_tx, 'availableBalanceMinor', v_account.available_balance_minor, 'currentBalanceMinor', v_balance_minor, 'projectedCash', (v_balance_minor / 100.0));
END $$;

CREATE OR REPLACE FUNCTION public.get_festival_company_founding_eligibility()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
DECLARE
  v_user uuid := auth.uid(); v_profile_id uuid := public._caller_profile_id(); v_caps jsonb := public.festival_company_capabilities();
  v_limit integer := 3; v_count integer := 0; v_balance_minor bigint := 0; v_cost_minor bigint := 200000000; v_vip boolean := false;
BEGIN
  v_limit := COALESCE((v_caps->>'companyLimit')::integer, 3);
  IF v_user IS NULL OR v_profile_id IS NULL THEN
    RETURN v_caps || jsonb_build_object('ownedCompanyCount',0,'companyLimit',v_limit,'canFoundCompany',false,'companyLimitReason','active_profile_required','vipEligible',false,'authoritativePersonalBalance',0,'authoritativePersonalBalanceMinor',0,'foundingCost',2000000,'foundingCostMinor',v_cost_minor,'canAfford',false);
  END IF;
  SELECT count(*) INTO v_count FROM public.companies WHERE owner_id=v_user AND parent_company_id IS NULL AND status NOT IN ('dissolved','bankrupt') AND COALESCE(is_bankrupt,false)=false;
  SELECT COALESCE(a.available_balance_minor,0) INTO v_balance_minor FROM public.financial_accounts a WHERE a.owner_type='player' AND a.owner_id=v_profile_id AND a.is_primary;
  v_vip := public._has_active_vip_entitlement(v_user);
  RETURN v_caps || jsonb_build_object(
    'ownedCompanyCount',v_count,'companyLimit',v_limit,'canFoundCompany',v_count < v_limit,'companyLimitReason',CASE WHEN v_count >= v_limit THEN 'company_limit_reached' ELSE 'eligible' END,
    'vipEligible',v_vip,'authoritativePersonalBalance',v_balance_minor / 100.0,'authoritativePersonalBalanceMinor',v_balance_minor,'foundingCost',2000000,'foundingCostMinor',v_cost_minor,'canAfford',v_balance_minor >= v_cost_minor
  );
END $$;

CREATE OR REPLACE FUNCTION public.get_owned_festival_companies()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
DECLARE v_profile_id uuid := public._caller_profile_id(); v_caps jsonb := public.festival_company_capabilities(); v_result jsonb;
BEGIN
  IF auth.uid() IS NULL OR v_profile_id IS NULL THEN RETURN '[]'::jsonb; END IF;
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'festivalCompanyId',fc.id,'companyId',c.id,'publicName',fc.public_name,'legalCompanyName',c.name,'setupStatus',fc.status,
    'setupCompleted',fc.setup_completed,'configurationComplete',(fc.annual_month IS NOT NULL AND fc.country_code IS NOT NULL AND fc.default_vibe IS NOT NULL AND fc.default_site_type IS NOT NULL AND fc.default_duration_days IS NOT NULL),
    'firstEditionExists',EXISTS (SELECT 1 FROM public.festival_editions_v2 e WHERE e.festival_company_id=fc.id),'companyBalance',c.balance,'managementEnabled',COALESCE((v_caps->>'newFestivalSystemEnabled')::boolean,false) AND COALESCE((v_caps->>'festivalCompanyManagementEnabled')::boolean,false)
  ) ORDER BY c.created_at DESC),'[]'::jsonb) INTO v_result
  FROM public.festival_companies fc JOIN public.companies c ON c.id=fc.company_id WHERE fc.owner_profile_id=v_profile_id;
  RETURN v_result;
END $$;

CREATE OR REPLACE FUNCTION public.found_festival_company(p_public_name text, p_company_name text, p_description text DEFAULT NULL, p_idempotency_key text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE
  v_user uuid := auth.uid(); v_profile public.profiles%ROWTYPE; v_profile_id uuid; v_cost numeric := 2000000; v_cost_minor bigint := 200000000; v_public text; v_company text; v_slug text; v_hash text; v_req public.festival_company_founding_requests%ROWTYPE; v_company_id uuid; v_fc_id uuid; v_finance jsonb; v_result jsonb; v_tx uuid; v_balance numeric; v_available_minor bigint;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'not_authenticated' USING ERRCODE='P0001'; END IF;
  IF NOT public._festival_company_creation_enabled() THEN RAISE EXCEPTION 'festival_creation_disabled' USING ERRCODE='P0001'; END IF;
  IF p_idempotency_key IS NULL OR length(btrim(p_idempotency_key)) < 8 THEN RAISE EXCEPTION 'idempotency_key_required' USING ERRCODE='P0001'; END IF;
  v_public := btrim(coalesce(p_public_name,'')); v_company := btrim(coalesce(p_company_name,''));
  IF char_length(v_public) < 3 OR char_length(v_public) > 80 OR char_length(v_company) < 3 OR char_length(v_company) > 120 THEN RAISE EXCEPTION 'invalid_festival_name' USING ERRCODE='P0001'; END IF;
  v_slug := public._festival_slug(v_public); IF v_slug = '' THEN RAISE EXCEPTION 'invalid_festival_name' USING ERRCODE='P0001'; END IF;
  v_hash := encode(digest(v_public || '|' || v_company || '|' || coalesce(p_description,'') || '|2000000', 'sha256'), 'hex');
  v_profile_id := public._caller_profile_id(); IF v_profile_id IS NULL THEN RAISE EXCEPTION 'profile_not_eligible' USING ERRCODE='P0001'; END IF;
  SELECT * INTO v_profile FROM public.profiles WHERE id=v_profile_id AND user_id=v_user AND died_at IS NULL FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'profile_not_eligible' USING ERRCODE='P0001'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(v_user::text || ':' || p_idempotency_key, 0));
  SELECT * INTO v_req FROM public.festival_company_founding_requests WHERE actor_user_id=v_user AND idempotency_key=p_idempotency_key FOR UPDATE;
  IF FOUND THEN
    IF v_req.request_hash <> v_hash THEN RAISE EXCEPTION 'idempotency_conflict' USING ERRCODE='P0001'; END IF;
    IF v_req.status = 'succeeded' THEN RETURN v_req.result || jsonb_build_object('idempotent', true); END IF;
    RAISE EXCEPTION 'festival_request_retryable' USING ERRCODE='P0001';
  END IF;
  INSERT INTO public.festival_company_founding_requests(actor_user_id, actor_profile_id, idempotency_key, request_hash) VALUES (v_user, v_profile.id, p_idempotency_key, v_hash) RETURNING * INTO v_req;
  IF NOT public._has_active_vip_entitlement(v_user) THEN RAISE EXCEPTION 'festival_vip_required' USING ERRCODE='P0001'; END IF;
  IF NOT public.can_profile_found_festival_company(v_profile.id) THEN RAISE EXCEPTION 'company_limit_reached' USING ERRCODE='P0001'; END IF;
  SELECT COALESCE(available_balance_minor,0) INTO v_available_minor FROM public.financial_accounts WHERE owner_type='player' AND owner_id=v_profile.id AND is_primary FOR UPDATE;
  IF COALESCE(v_available_minor,0) < v_cost_minor THEN RAISE EXCEPTION 'insufficient_personal_funds' USING ERRCODE='P0001'; END IF;
  IF EXISTS (SELECT 1 FROM public.festival_companies WHERE slug = v_slug OR lower(public_name) = lower(v_public)) THEN RAISE EXCEPTION 'festival_name_taken' USING ERRCODE='P0001'; END IF;
  INSERT INTO public.companies(owner_id,name,company_type,description,balance,weekly_operating_costs) VALUES (v_user,v_company,'festival',p_description,0,0) RETURNING id INTO v_company_id;
  INSERT INTO public.festival_companies(company_id, owner_profile_id, public_name, slug, description) VALUES (v_company_id, v_profile.id, v_public, v_slug, p_description) RETURNING id INTO v_fc_id;
  IF current_setting('app.festival_foundation_fail_after_extension', true) = 'on' THEN RAISE EXCEPTION 'festival_test_late_failure' USING ERRCODE='P0001'; END IF;
  INSERT INTO public.company_shareholders(company_id,user_id,shares) VALUES (v_company_id,v_user,100);
  v_finance := public.finance_debit_player_personal_cash(v_profile.id, v_cost_minor, 'festival_company_founding_fee', 'Festival company founding fee', 'festival-company-founding:'||p_idempotency_key, jsonb_build_object('festivalCompanyId',v_fc_id,'companyId',v_company_id,'wholeUsdAmount',v_cost,'currencyUnit','minor'));
  v_tx := (v_finance->>'transactionId')::uuid; v_balance := (v_finance->>'projectedCash')::numeric;
  INSERT INTO public.festival_company_audit_log(festival_company_id,company_id,actor_profile_id,action,idempotency_key,metadata) VALUES
    (v_fc_id,v_company_id,v_profile.id,'festival_company_founded',p_idempotency_key,jsonb_build_object('founding_cost',v_cost,'founding_cost_minor',v_cost_minor,'personal_financial_transaction_id',v_tx,'accounting','financial_accounts is authoritative; profiles.cash is an atomic compatibility projection')),
    (v_fc_id,v_company_id,v_profile.id,'founding_fee_charged',p_idempotency_key,jsonb_build_object('authoritative_personal_balance',v_balance));
  v_result := jsonb_build_object('companyId', v_company_id, 'festivalCompanyId', v_fc_id, 'personalCash', v_balance, 'authoritativePersonalBalance', v_balance, 'foundingCost', v_cost, 'foundingCostMinor', v_cost_minor, 'personalFinancialTransactionId', v_tx, 'idempotent', false);
  UPDATE public.festival_company_founding_requests SET status='succeeded', company_id=v_company_id, festival_company_id=v_fc_id, resulting_personal_cash=v_balance, result=v_result, completed_at=now(), updated_at=now() WHERE id=v_req.id;
  RETURN v_result;
EXCEPTION WHEN unique_violation THEN
  IF EXISTS (SELECT 1 FROM public.festival_companies WHERE slug = v_slug OR lower(public_name) = lower(v_public)) THEN RAISE EXCEPTION 'festival_name_taken' USING ERRCODE='P0001'; END IF;
  RAISE;
END $$;

REVOKE ALL ON FUNCTION public.festival_company_capabilities() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_festival_company_founding_eligibility() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_owned_festival_companies() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.found_festival_company(text,text,text,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.festival_company_capabilities() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_festival_company_founding_eligibility() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_owned_festival_companies() TO authenticated;
GRANT EXECUTE ON FUNCTION public.found_festival_company(text,text,text,text) TO authenticated;
NOTIFY pgrst, 'reload schema';
