-- Idempotency store for edition planning
CREATE TABLE IF NOT EXISTS public.festival_edition_plan_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  festival_company_id uuid NOT NULL REFERENCES public.festival_companies(id) ON DELETE CASCADE,
  caller_profile_id uuid NOT NULL,
  idempotency_key text NOT NULL,
  payload_hash text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  result jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (festival_company_id, caller_profile_id, idempotency_key)
);

GRANT SELECT ON public.festival_edition_plan_requests TO authenticated;
GRANT ALL ON public.festival_edition_plan_requests TO service_role;
ALTER TABLE public.festival_edition_plan_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Owners read own festival edition plan requests" ON public.festival_edition_plan_requests;
CREATE POLICY "Owners read own festival edition plan requests"
ON public.festival_edition_plan_requests FOR SELECT TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.festival_companies fc
  WHERE fc.id = festival_edition_plan_requests.festival_company_id
    AND fc.owner_profile_id = public._caller_profile_id()
));

CREATE OR REPLACE FUNCTION public.festival_company_capabilities()
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT jsonb_build_object(
    'newFestivalSystemEnabled', true,
    'festivalCompanyCreationEnabled', true,
    'festivalCompanyManagementEnabled', true,
    'festivalConfigurationEnabled', true,
    'companyLimit', 3
  );
$$;

CREATE OR REPLACE FUNCTION public.get_festival_company_founding_eligibility()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_user uuid := auth.uid();
  v_profile public.profiles%ROWTYPE;
  v_caps jsonb := public.festival_company_capabilities();
  v_limit int := (v_caps->>'companyLimit')::int;
  v_owned int := 0;
  v_cost numeric := 2000000;
  v_cash numeric := 0;
  v_vip boolean := false;
  v_reason text := 'eligible';
BEGIN
  IF v_user IS NULL THEN
    RETURN v_caps || jsonb_build_object('ownedCompanyCount',0,'canFoundCompany',false,'companyLimitReason','not_authenticated','vipEligible',false,
      'authoritativePersonalBalance',0,'authoritativePersonalBalanceMinor',0,'foundingCost',v_cost,'foundingCostMinor',(v_cost*100)::bigint,'canAfford',false);
  END IF;

  SELECT * INTO v_profile FROM public.profiles
   WHERE user_id = v_user AND coalesce(is_active,true) = true
   ORDER BY coalesce(is_active,false) DESC, created_at DESC LIMIT 1;

  IF NOT FOUND THEN
    RETURN v_caps || jsonb_build_object('ownedCompanyCount',0,'canFoundCompany',false,'companyLimitReason','active_profile_required','vipEligible',false,
      'authoritativePersonalBalance',0,'authoritativePersonalBalanceMinor',0,'foundingCost',v_cost,'foundingCostMinor',(v_cost*100)::bigint,'canAfford',false);
  END IF;

  v_cash := greatest(coalesce(v_profile.cash,0),0);
  v_vip := coalesce(public._has_active_vip_entitlement(v_user), false);
  SELECT count(*) INTO v_owned FROM public.festival_companies WHERE owner_profile_id = v_profile.id;

  IF v_owned >= v_limit THEN v_reason := 'company_limit_reached';
  ELSIF NOT v_vip THEN v_reason := 'festival_vip_required';
  ELSIF v_cash < v_cost THEN v_reason := 'insufficient_personal_funds';
  END IF;

  RETURN v_caps || jsonb_build_object(
    'ownedCompanyCount', v_owned,
    'canFoundCompany', v_reason = 'eligible',
    'companyLimitReason', v_reason,
    'vipEligible', v_vip,
    'authoritativePersonalBalance', v_cash,
    'authoritativePersonalBalanceMinor', (v_cash*100)::bigint,
    'foundingCost', v_cost,
    'foundingCostMinor', (v_cost*100)::bigint,
    'canAfford', v_cash >= v_cost
  );
END $$;

CREATE OR REPLACE FUNCTION public.get_owned_festival_companies()
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT coalesce(jsonb_agg(jsonb_build_object(
    'festivalCompanyId', fc.id,
    'companyId', fc.company_id,
    'publicName', fc.public_name,
    'legalCompanyName', co.name,
    'setupStatus', coalesce(cfg.setup_status, CASE WHEN fc.setup_completed THEN 'active' ELSE 'setup' END),
    'setupCompleted', coalesce(fc.setup_completed,false),
    'configurationComplete', coalesce(cfg.setup_status,'') IN ('complete','completed','active'),
    'firstEditionExists', EXISTS (SELECT 1 FROM public.festival_editions_v2 e WHERE e.festival_company_id = fc.id),
    'companyBalance', greatest(coalesce(co.balance,0),0),
    'managementEnabled', true
  ) ORDER BY fc.created_at), '[]'::jsonb)
  FROM public.festival_companies fc
  JOIN public.companies co ON co.id = fc.company_id
  LEFT JOIN public.festival_configurations cfg ON cfg.festival_company_id = fc.id
  WHERE fc.owner_profile_id = public._caller_profile_id();
$$;

CREATE OR REPLACE FUNCTION public.get_festival_company_setup(p_festival_company_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_profile uuid := public._caller_profile_id();
  v_fc public.festival_companies%ROWTYPE;
  v_co public.companies%ROWTYPE;
  v_cfg public.festival_configurations%ROWTYPE;
  v_owner_name text;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'active_profile_required' USING ERRCODE='P0001'; END IF;
  SELECT * INTO v_fc FROM public.festival_companies WHERE id = p_festival_company_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'festival_company_not_found' USING ERRCODE='P0001'; END IF;
  IF v_fc.owner_profile_id IS DISTINCT FROM v_profile
     AND NOT coalesce(public.has_role(auth.uid(),'admin'::public.app_role),false) THEN
    RAISE EXCEPTION 'festival_company_access_denied' USING ERRCODE='P0001';
  END IF;

  SELECT * INTO v_co FROM public.companies WHERE id = v_fc.company_id;
  SELECT * INTO v_cfg FROM public.festival_configurations WHERE festival_company_id = v_fc.id;
  SELECT coalesce(nullif(btrim(coalesce(p.display_name,'')),''), p.username, 'Unknown')
    INTO v_owner_name FROM public.profiles p WHERE p.id = v_fc.owner_profile_id;

  RETURN jsonb_build_object(
    'festivalCompanyId', v_fc.id,
    'companyId', v_fc.company_id,
    'publicName', v_fc.public_name,
    'legalCompanyName', coalesce(v_co.name, v_fc.public_name),
    'companyBalance', greatest(coalesce(v_co.balance,0),0),
    'setupStatus', coalesce(v_cfg.setup_status, CASE WHEN coalesce(v_fc.setup_completed,false) THEN 'active' ELSE 'setup' END),
    'setupCompleted', coalesce(v_fc.setup_completed,false),
    'ownerProfileId', v_fc.owner_profile_id,
    'ownerDisplayName', coalesce(v_owner_name,'Unknown'),
    'foundedAt', v_fc.created_at,
    'companyStatus', coalesce(v_fc.status,'active'),
    'isBankrupt', coalesce(v_fc.status,'active') = 'bankrupt',
    'configurationComplete', coalesce(v_cfg.setup_status,'') IN ('complete','completed','active'),
    'firstEditionExists', EXISTS (SELECT 1 FROM public.festival_editions_v2 e WHERE e.festival_company_id = v_fc.id),
    'capabilities', public.festival_company_capabilities()
  );
END $$;

CREATE OR REPLACE FUNCTION public.resolve_owner_festival_identifier(p_identifier text, p_edition_identifier text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_profile uuid := public._caller_profile_id();
  v_admin boolean := coalesce(public.has_role(auth.uid(),'admin'::public.app_role),false);
  v_fc public.festival_companies%ROWTYPE;
  v_provenance text := 'canonical_slug';
  v_edition public.festival_editions_v2%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL THEN RETURN jsonb_build_object('status','unavailable','errorCode','not_authenticated'); END IF;
  IF p_identifier IS NULL OR btrim(p_identifier) = '' THEN RETURN jsonb_build_object('status','not_found'); END IF;

  IF p_identifier ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
    SELECT * INTO v_fc FROM public.festival_companies WHERE id = p_identifier::uuid;
    v_provenance := 'canonical_uuid';
  END IF;
  IF v_fc.id IS NULL THEN
    SELECT * INTO v_fc FROM public.festival_companies WHERE slug = lower(btrim(p_identifier));
    v_provenance := 'canonical_slug';
  END IF;
  IF v_fc.id IS NULL THEN RETURN jsonb_build_object('status','not_found'); END IF;
  IF v_fc.owner_profile_id IS DISTINCT FROM v_profile AND NOT v_admin THEN
    RETURN jsonb_build_object('status','unavailable','errorCode','FESTIVAL_EDITION_ACCESS_DENIED');
  END IF;

  IF p_edition_identifier IS NOT NULL AND btrim(p_edition_identifier) <> '' THEN
    IF p_edition_identifier ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
      SELECT * INTO v_edition FROM public.festival_editions_v2
       WHERE festival_company_id = v_fc.id AND id = p_edition_identifier::uuid;
    ELSIF p_edition_identifier ~ '^[0-9]{4}$' THEN
      SELECT * INTO v_edition FROM public.festival_editions_v2
       WHERE festival_company_id = v_fc.id AND edition_year = p_edition_identifier::int
       ORDER BY created_at DESC LIMIT 1;
    END IF;
    IF v_edition.id IS NULL THEN RETURN jsonb_build_object('status','not_found'); END IF;
  END IF;

  RETURN jsonb_strip_nulls(jsonb_build_object(
    'status','resolved',
    'festivalCompanyId', v_fc.id,
    'companyId', v_fc.company_id,
    'publicSlug', v_fc.slug,
    'provenance', v_provenance,
    'editionId', v_edition.id,
    'editionYear', v_edition.edition_year
  ));
END $$;

CREATE OR REPLACE FUNCTION public._festival_plan_edition(p_festival_company_id uuid, p_idempotency_key text, p_payload_hash text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_profile uuid := public._caller_profile_id();
  v_fc public.festival_companies%ROWTYPE;
  v_cfg public.festival_configurations%ROWTYPE;
  v_req public.festival_edition_plan_requests%ROWTYPE;
  v_year int;
  v_start date;
  v_end date;
  v_id uuid;
  v_result jsonb;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'festival_configuration_forbidden' USING ERRCODE='P0001'; END IF;
  IF p_idempotency_key IS NULL OR length(btrim(p_idempotency_key)) < 8 THEN RAISE EXCEPTION 'idempotency_key_required' USING ERRCODE='P0001'; END IF;

  SELECT * INTO v_fc FROM public.festival_companies WHERE id = p_festival_company_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'festival_company_not_found' USING ERRCODE='P0001'; END IF;
  IF v_fc.owner_profile_id IS DISTINCT FROM v_profile
     AND NOT coalesce(public.has_role(auth.uid(),'admin'::public.app_role),false) THEN
    RAISE EXCEPTION 'festival_configuration_forbidden' USING ERRCODE='P0001';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended(p_festival_company_id::text || p_idempotency_key, 0));

  SELECT * INTO v_req FROM public.festival_edition_plan_requests
   WHERE festival_company_id = p_festival_company_id AND caller_profile_id = v_profile
     AND idempotency_key = p_idempotency_key FOR UPDATE;
  IF FOUND THEN
    IF v_req.payload_hash <> p_payload_hash THEN RAISE EXCEPTION 'festival_configuration_idempotency_conflict' USING ERRCODE='P0001'; END IF;
    IF v_req.status = 'succeeded' THEN RETURN v_req.result || jsonb_build_object('idempotent', true); END IF;
  ELSE
    INSERT INTO public.festival_edition_plan_requests(festival_company_id, caller_profile_id, idempotency_key, payload_hash)
    VALUES (p_festival_company_id, v_profile, p_idempotency_key, p_payload_hash) RETURNING * INTO v_req;
  END IF;

  SELECT * INTO v_cfg FROM public.festival_configurations WHERE festival_company_id = p_festival_company_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'festival_configuration_incomplete' USING ERRCODE='P0001'; END IF;

  v_start := v_cfg.planned_start_date;
  v_end := v_cfg.planned_end_date;
  SELECT coalesce(max(edition_year) + 1, extract(year from coalesce(v_start, CURRENT_DATE))::int)
    INTO v_year FROM public.festival_editions_v2 WHERE festival_company_id = p_festival_company_id;

  INSERT INTO public.festival_editions_v2(
    festival_company_id, edition_year, name, status, starts_on, ends_on,
    country_code, city_id, vibe, site_type, duration_days, environmental_policy)
  VALUES (
    p_festival_company_id, v_year,
    coalesce(nullif(btrim(coalesce(v_cfg.public_name,'')),''), v_fc.public_name) || ' ' || v_year,
    'draft', v_start, v_end,
    v_fc.country_code, v_cfg.home_city_id, v_fc.default_vibe, v_fc.default_site_type,
    coalesce(v_cfg.duration_days, v_fc.default_duration_days), v_fc.environmental_policy)
  RETURNING id INTO v_id;

  v_result := jsonb_build_object(
    'festivalCompanyId', p_festival_company_id,
    'festivalEditionId', v_id,
    'editionYear', v_year,
    'status', 'draft',
    'idempotent', false);

  UPDATE public.festival_edition_plan_requests
     SET status = 'succeeded', result = v_result, updated_at = now()
   WHERE id = v_req.id;

  INSERT INTO public.festival_company_audit_log(festival_company_id, company_id, actor_profile_id, action, idempotency_key, metadata)
  VALUES (p_festival_company_id, v_fc.company_id, v_profile, 'festival_edition_planned', p_idempotency_key,
          jsonb_build_object('festival_edition_id', v_id, 'edition_year', v_year));

  RETURN v_result;
END $$;

CREATE OR REPLACE FUNCTION public.plan_next_festival_edition(p_festival_company_id uuid, p_idempotency_key text)
RETURNS jsonb LANGUAGE sql SECURITY DEFINER SET search_path = public, extensions AS $$
  SELECT public._festival_plan_edition(p_festival_company_id, p_idempotency_key,
    encode(digest('plan_next|' || p_festival_company_id::text, 'sha256'), 'hex'));
$$;

CREATE OR REPLACE FUNCTION public.complete_festival_setup_with_edition(
  p_festival_company_id uuid,
  p_expected_version integer,
  p_configuration jsonb,
  p_idempotency_key uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions AS $$
DECLARE
  v_saved jsonb;
  v_result jsonb;
BEGIN
  v_saved := public.save_festival_configuration(
    p_festival_company_id,
    p_expected_version,
    p_configuration || jsonb_build_object('complete', true),
    p_idempotency_key);

  v_result := public._festival_plan_edition(
    p_festival_company_id,
    'setup-' || p_idempotency_key::text,
    encode(digest('setup|' || p_festival_company_id::text || '|' || p_idempotency_key::text, 'sha256'), 'hex'));

  UPDATE public.festival_companies
     SET setup_completed = true, updated_at = now()
   WHERE id = p_festival_company_id;

  RETURN v_result;
END $$;

CREATE OR REPLACE FUNCTION public.found_festival_company(p_public_name text, p_company_name text, p_description text DEFAULT NULL, p_idempotency_key text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions AS $$
DECLARE
  v_user uuid := auth.uid(); v_profile public.profiles%ROWTYPE; v_cost numeric := 2000000; v_public text; v_company text; v_slug text; v_hash text; v_req public.festival_company_founding_requests%ROWTYPE; v_company_id uuid; v_fc_id uuid; v_balance numeric; v_txn uuid;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'not_authenticated' USING ERRCODE='P0001'; END IF;
  IF p_idempotency_key IS NULL OR length(btrim(p_idempotency_key)) < 8 THEN RAISE EXCEPTION 'idempotency_key_required' USING ERRCODE='P0001'; END IF;
  v_public := btrim(coalesce(p_public_name,'')); v_company := btrim(coalesce(p_company_name,''));
  IF char_length(v_public) < 3 OR char_length(v_public) > 80 OR char_length(v_company) < 3 OR char_length(v_company) > 120 THEN RAISE EXCEPTION 'invalid_festival_name' USING ERRCODE='P0001'; END IF;
  v_slug := public._festival_slug(v_public);
  IF v_slug = '' THEN RAISE EXCEPTION 'invalid_festival_name' USING ERRCODE='P0001'; END IF;
  v_hash := encode(digest(v_public || '|' || v_company || '|' || coalesce(p_description,'') || '|2000000', 'sha256'), 'hex');

  SELECT * INTO v_profile FROM public.profiles WHERE user_id = v_user AND coalesce(is_active,true) = true ORDER BY created_at DESC LIMIT 1 FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'profile_not_eligible' USING ERRCODE='P0001'; END IF;

  SELECT * INTO v_req FROM public.festival_company_founding_requests WHERE actor_user_id=v_user AND idempotency_key=p_idempotency_key FOR UPDATE;
  IF FOUND THEN
    IF v_req.request_hash <> v_hash THEN RAISE EXCEPTION 'idempotency_conflict' USING ERRCODE='P0001'; END IF;
    IF v_req.status = 'succeeded' THEN
      SELECT id INTO v_txn FROM public.company_transactions WHERE company_id = v_req.company_id AND related_entity_id = v_req.festival_company_id ORDER BY created_at LIMIT 1;
      RETURN jsonb_build_object('companyId', v_req.company_id, 'festivalCompanyId', v_req.festival_company_id, 'personalCash', v_req.resulting_personal_cash, 'foundingCost', v_cost, 'idempotent', true, 'personalFinancialTransactionId', v_txn);
    END IF;
  ELSE
    INSERT INTO public.festival_company_founding_requests(actor_user_id, actor_profile_id, idempotency_key, request_hash)
    VALUES (v_user, v_profile.id, p_idempotency_key, v_hash) RETURNING * INTO v_req;
  END IF;

  IF NOT public._has_active_vip_entitlement(v_user) THEN RAISE EXCEPTION 'festival_vip_required' USING ERRCODE='P0001'; END IF;
  IF coalesce(v_profile.cash,0) < v_cost THEN RAISE EXCEPTION 'insufficient_personal_funds' USING ERRCODE='P0001'; END IF;
  IF EXISTS (SELECT 1 FROM public.festival_companies WHERE slug = v_slug OR lower(public_name) = lower(v_public)) THEN RAISE EXCEPTION 'festival_name_taken' USING ERRCODE='P0001'; END IF;

  UPDATE public.profiles SET cash = cash - v_cost::bigint, updated_at = now() WHERE id = v_profile.id RETURNING cash INTO v_balance;
  INSERT INTO public.companies(owner_id,name,company_type,description,balance,weekly_operating_costs) VALUES (v_user,v_company,'festival',p_description,0,0) RETURNING id INTO v_company_id;
  INSERT INTO public.festival_companies(company_id, owner_profile_id, public_name, slug, description) VALUES (v_company_id, v_profile.id, v_public, v_slug, p_description) RETURNING id INTO v_fc_id;
  INSERT INTO public.company_shares(company_id, holder_profile_id, shares) VALUES (v_company_id, v_profile.id, 100);
  INSERT INTO public.company_transactions(company_id,transaction_type,amount,description,related_entity_id,related_entity_type) VALUES (v_company_id,'expense',v_cost,'Festival company founding/setup fee charged to founder personal cash',v_fc_id,'festival_company') RETURNING id INTO v_txn;
  INSERT INTO public.festival_company_audit_log(festival_company_id,company_id,actor_profile_id,action,idempotency_key,metadata) VALUES
    (v_fc_id,v_company_id,v_profile.id,'festival_company_founded',p_idempotency_key,jsonb_build_object('founding_cost',v_cost,'money_units','whole_usd_game_dollars')),
    (v_fc_id,v_company_id,v_profile.id,'founding_fee_charged',p_idempotency_key,jsonb_build_object('personal_cash_after',v_balance,'transaction_id',v_txn));
  UPDATE public.festival_company_founding_requests SET status='succeeded', company_id=v_company_id, festival_company_id=v_fc_id, resulting_personal_cash=v_balance, updated_at=now() WHERE id=v_req.id;
  RETURN jsonb_build_object('companyId', v_company_id, 'festivalCompanyId', v_fc_id, 'personalCash', v_balance, 'foundingCost', v_cost, 'idempotent', false, 'personalFinancialTransactionId', v_txn);
EXCEPTION WHEN unique_violation THEN
  RAISE EXCEPTION 'festival_name_taken' USING ERRCODE='P0001';
END $$;

REVOKE ALL ON FUNCTION public._festival_plan_edition(uuid, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.festival_company_capabilities() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_festival_company_founding_eligibility() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_owned_festival_companies() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_festival_company_setup(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.resolve_owner_festival_identifier(text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.plan_next_festival_edition(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.complete_festival_setup_with_edition(uuid, integer, jsonb, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.found_festival_company(text, text, text, text) TO authenticated;
