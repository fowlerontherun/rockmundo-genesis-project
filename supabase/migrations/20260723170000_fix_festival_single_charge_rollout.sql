-- Fix festival-company financial correctness and rollout defaults after PR #1279.
-- Forward-only: preserve existing data and administrator choices.

INSERT INTO public.game_config (config_key, config_value, description)
VALUES (
  'festival_company_creation',
  '{"new_festival_system_enabled": false, "festival_company_creation_enabled": false, "festival_company_management_enabled": false, "festival_configuration_enabled": false, "company_limit": 3}'::jsonb,
  'Server-authoritative rollout and ownership settings for replacement festival companies.'
)
ON CONFLICT (config_key) DO NOTHING;

UPDATE public.game_config
SET config_value = jsonb_build_object(
      'new_festival_system_enabled', COALESCE(config_value->'new_festival_system_enabled', 'false'::jsonb),
      'festival_company_creation_enabled', COALESCE(config_value->'festival_company_creation_enabled', 'false'::jsonb),
      'festival_company_management_enabled', COALESCE(config_value->'festival_company_management_enabled', 'false'::jsonb),
      'festival_configuration_enabled', COALESCE(config_value->'festival_configuration_enabled', 'false'::jsonb),
      'company_limit', COALESCE(config_value->'company_limit', '3'::jsonb)
    ) || (config_value - 'new_festival_system_enabled' - 'festival_company_creation_enabled' - 'festival_company_management_enabled' - 'festival_configuration_enabled' - 'company_limit'),
    updated_at = now()
WHERE config_key = 'festival_company_creation'
  AND (NOT config_value ? 'festival_company_management_enabled' OR NOT config_value ? 'festival_configuration_enabled');

CREATE OR REPLACE FUNCTION public.festival_company_capabilities()
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT jsonb_build_object(
    'newFestivalSystemEnabled', COALESCE((config_value->>'new_festival_system_enabled')::boolean, false),
    'festivalCompanyCreationEnabled', COALESCE((config_value->>'festival_company_creation_enabled')::boolean, false),
    'festivalCompanyManagementEnabled', COALESCE((config_value->>'festival_company_management_enabled')::boolean, false),
    'festivalConfigurationEnabled', COALESCE((config_value->>'festival_configuration_enabled')::boolean, false),
    'companyLimit', COALESCE((config_value->>'company_limit')::integer, 3)
  ) FROM public.game_config WHERE config_key='festival_company_creation'
$$;

CREATE OR REPLACE FUNCTION public._festival_company_creation_enabled() RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT COALESCE((public.festival_company_capabilities()->>'newFestivalSystemEnabled')::boolean,false)
     AND COALESCE((public.festival_company_capabilities()->>'festivalCompanyCreationEnabled')::boolean,false)
$$;

CREATE OR REPLACE FUNCTION public._festival_company_management_enabled() RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT COALESCE((public.festival_company_capabilities()->>'newFestivalSystemEnabled')::boolean,false)
     AND COALESCE((public.festival_company_capabilities()->>'festivalCompanyManagementEnabled')::boolean,false)
$$;

CREATE OR REPLACE FUNCTION public.company_ownership_limit(p_profile_id uuid, p_company_type text DEFAULT NULL)
RETURNS integer LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
BEGIN
  -- Canonical rule for player-founded top-level companies: limit is scoped to the active profile's user.
  -- Top-level active/suspended companies count; subsidiaries, dissolved, bankrupt and is_bankrupt rows do not.
  -- VIP does not change the limit here; festival companies count as normal top-level companies.
  RETURN COALESCE((public.festival_company_capabilities()->>'companyLimit')::integer, 3);
END $$;

CREATE OR REPLACE FUNCTION public.can_profile_found_company(p_profile_id uuid, p_company_type text DEFAULT NULL)
RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
DECLARE v_user uuid; v_count integer; v_limit integer;
BEGIN
  SELECT user_id INTO v_user FROM public.profiles WHERE id=p_profile_id AND died_at IS NULL;
  IF v_user IS NULL THEN RETURN false; END IF;
  SELECT count(*) INTO v_count FROM public.companies
  WHERE owner_id=v_user AND parent_company_id IS NULL AND status NOT IN ('dissolved','bankrupt') AND COALESCE(is_bankrupt,false)=false;
  v_limit := public.company_ownership_limit(p_profile_id,p_company_type);
  RETURN v_count < v_limit;
END $$;

CREATE OR REPLACE FUNCTION public.get_festival_company_setup(p_festival_company_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
DECLARE
  v_profile_id uuid := public._caller_profile_id();
  v_is_admin boolean := COALESCE(public.has_role(auth.uid(),'admin'::public.app_role), false);
  v_caps jsonb := public.festival_company_capabilities();
  v_result jsonb;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'active_profile_required' USING ERRCODE='P0001'; END IF;
  IF NOT COALESCE((v_caps->>'newFestivalSystemEnabled')::boolean,false) THEN RAISE EXCEPTION 'festival_system_disabled' USING ERRCODE='P0001'; END IF;
  IF NOT COALESCE((v_caps->>'festivalCompanyManagementEnabled')::boolean,false) THEN RAISE EXCEPTION 'festival_management_disabled' USING ERRCODE='P0001'; END IF;
  IF v_profile_id IS NULL AND NOT v_is_admin THEN RAISE EXCEPTION 'active_profile_required' USING ERRCODE='P0001'; END IF;

  SELECT jsonb_build_object(
    'festivalCompanyId', fc.id, 'companyId', c.id, 'publicName', fc.public_name,
    'legalCompanyName', c.name, 'companyBalance', c.balance, 'setupStatus', fc.status,
    'setupCompleted', fc.setup_completed, 'ownerProfileId', fc.owner_profile_id,
    'ownerDisplayName', COALESCE(p.character_name, p.username, 'Owner'), 'foundedAt', c.founded_at,
    'companyStatus', c.status, 'isBankrupt', c.is_bankrupt,
    'configurationComplete', (fc.annual_month IS NOT NULL AND fc.country_code IS NOT NULL AND fc.default_vibe IS NOT NULL AND fc.default_site_type IS NOT NULL AND fc.default_duration_days IS NOT NULL),
    'firstEditionExists', EXISTS (SELECT 1 FROM public.festival_editions_v2 e WHERE e.festival_company_id = fc.id),
    'capabilities', v_caps
  ) INTO v_result
  FROM public.festival_companies fc JOIN public.companies c ON c.id = fc.company_id JOIN public.profiles p ON p.id = fc.owner_profile_id
  WHERE fc.id = p_festival_company_id AND (fc.owner_profile_id = v_profile_id OR v_is_admin);
  IF v_result IS NULL THEN RAISE EXCEPTION 'festival_company_not_found' USING ERRCODE='P0001'; END IF;
  RETURN v_result;
END $$;

CREATE OR REPLACE FUNCTION public.found_festival_company(p_public_name text, p_company_name text, p_description text DEFAULT NULL, p_idempotency_key text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE
  v_user uuid := auth.uid(); v_profile public.profiles%ROWTYPE; v_profile_id uuid; v_cost numeric := 2000000; v_cost_minor bigint := 200000000; v_public text; v_company text; v_slug text; v_hash text; v_req public.festival_company_founding_requests%ROWTYPE; v_company_id uuid; v_fc_id uuid; v_balance numeric; v_result jsonb; v_tx uuid;
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
    RAISE EXCEPTION 'festival_request_in_progress' USING ERRCODE='P0001';
  END IF;
  INSERT INTO public.festival_company_founding_requests(actor_user_id, actor_profile_id, idempotency_key, request_hash) VALUES (v_user, v_profile.id, p_idempotency_key, v_hash) RETURNING * INTO v_req;
  IF NOT public._has_active_vip_entitlement(v_user) THEN RAISE EXCEPTION 'festival_vip_required' USING ERRCODE='P0001'; END IF;
  IF coalesce(v_profile.cash,0) < v_cost THEN RAISE EXCEPTION 'insufficient_personal_funds' USING ERRCODE='P0001'; END IF;
  IF NOT public.can_profile_found_company(v_profile.id, 'festival') THEN RAISE EXCEPTION 'company_limit_reached' USING ERRCODE='P0001'; END IF;
  IF EXISTS (SELECT 1 FROM public.festival_companies WHERE slug = v_slug OR lower(public_name) = lower(v_public)) THEN RAISE EXCEPTION 'festival_name_taken' USING ERRCODE='P0001'; END IF;
  UPDATE public.profiles SET cash = cash - v_cost, updated_at = now() WHERE id = v_profile.id RETURNING cash INTO v_balance;
  INSERT INTO public.companies(owner_id,name,company_type,description,balance,weekly_operating_costs) VALUES (v_user,v_company,'festival',p_description,0,0) RETURNING id INTO v_company_id;
  INSERT INTO public.festival_companies(company_id, owner_profile_id, public_name, slug, description) VALUES (v_company_id, v_profile.id, v_public, v_slug, p_description) RETURNING id INTO v_fc_id;
  INSERT INTO public.company_shareholders(company_id,user_id,shares) VALUES (v_company_id,v_user,100);
  SELECT public.finance_debit_owner('player', v_profile.id, v_cost_minor, 'festival_company_founding_fee', 'Festival company founding fee', 'festival-company-founding:'||p_idempotency_key, v_profile.id, jsonb_build_object('festivalCompanyId',v_fc_id,'companyId',v_company_id,'wholeUsdAmount',v_cost,'currencyUnit','minor')) INTO v_tx;
  INSERT INTO public.festival_company_audit_log(festival_company_id,company_id,actor_profile_id,action,idempotency_key,metadata) VALUES
    (v_fc_id,v_company_id,v_profile.id,'festival_company_founded',p_idempotency_key,jsonb_build_object('founding_cost',v_cost,'founding_cost_minor',v_cost_minor,'personal_financial_transaction_id',v_tx,'accounting','profiles.cash is the visible whole-USD balance; financial_transactions records the same debit in minor units; no company P&L impact')),
    (v_fc_id,v_company_id,v_profile.id,'founding_fee_charged',p_idempotency_key,jsonb_build_object('personal_cash_after',v_balance));
  v_result := jsonb_build_object('companyId', v_company_id, 'festivalCompanyId', v_fc_id, 'personalCash', v_balance, 'foundingCost', v_cost, 'foundingCostMinor', v_cost_minor, 'personalFinancialTransactionId', v_tx, 'idempotent', false);
  UPDATE public.festival_company_founding_requests SET status='succeeded', company_id=v_company_id, festival_company_id=v_fc_id, resulting_personal_cash=v_balance, result=v_result, completed_at=now(), updated_at=now() WHERE id=v_req.id;
  RETURN v_result;
EXCEPTION WHEN unique_violation THEN
  IF EXISTS (SELECT 1 FROM public.festival_companies WHERE slug = v_slug OR lower(public_name) = lower(v_public)) THEN RAISE EXCEPTION 'festival_name_taken' USING ERRCODE='P0001'; END IF;
  RAISE;
END $$;

GRANT EXECUTE ON FUNCTION public.festival_company_capabilities() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_festival_company_setup(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.found_festival_company(text,text,text,text) TO authenticated;
NOTIFY pgrst, 'reload schema';
