-- Harden festival-company founding and setup security after PR #1278.
-- Canonical active character source: public._caller_profile_id(), which delegates to current_profile_id() when present.

ALTER TYPE public.financial_transaction_category ADD VALUE IF NOT EXISTS 'festival_company_founding_fee';

INSERT INTO public.game_config (config_key, config_value, description)
VALUES (
  'festival_company_creation',
  '{"new_festival_system_enabled": true, "festival_company_creation_enabled": true, "company_limit": 3}'::jsonb,
  'Server-authoritative rollout and ownership settings for replacement festival companies.'
)
ON CONFLICT (config_key) DO UPDATE SET
  config_value = public.game_config.config_value || EXCLUDED.config_value,
  description = EXCLUDED.description,
  updated_at = now();

ALTER TABLE public.festival_company_founding_requests ADD COLUMN IF NOT EXISTS result jsonb;
ALTER TABLE public.festival_company_founding_requests ADD COLUMN IF NOT EXISTS error_code text;
ALTER TABLE public.festival_company_founding_requests ADD COLUMN IF NOT EXISTS completed_at timestamptz;
ALTER TABLE public.festival_company_founding_requests DROP CONSTRAINT IF EXISTS festival_company_founding_requests_status_check;
ALTER TABLE public.festival_company_founding_requests ADD CONSTRAINT festival_company_founding_requests_status_check CHECK (status IN ('processing','succeeded','failed'));

-- Backfill saved results for successful PR #1278 idempotency records without touching existing festival data.
UPDATE public.festival_company_founding_requests r
SET result = jsonb_build_object('companyId', r.company_id, 'festivalCompanyId', r.festival_company_id, 'personalCash', r.resulting_personal_cash, 'foundingCost', 2000000, 'idempotent', false),
    completed_at = COALESCE(r.completed_at, r.updated_at)
WHERE r.status = 'succeeded' AND r.result IS NULL AND r.company_id IS NOT NULL AND r.festival_company_id IS NOT NULL;

-- Reclassify the misleading company P&L founding fee rows using strong identifiers from the new festival tables.
UPDATE public.company_transactions ct
SET transaction_type = 'investment',
    description = 'Founder paid festival setup fee personally (non-P&L informational record)'
FROM public.festival_companies fc
WHERE ct.company_id = fc.company_id
  AND ct.related_entity_id = fc.id
  AND ct.related_entity_type = 'festival_company'
  AND ct.transaction_type = 'expense'
  AND ct.amount = 2000000;

CREATE OR REPLACE FUNCTION public._festival_company_creation_enabled() RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT COALESCE((config_value->>'new_festival_system_enabled')::boolean, false)
     AND COALESCE((config_value->>'festival_company_creation_enabled')::boolean, false)
  FROM public.game_config WHERE config_key = 'festival_company_creation'
$$;

CREATE OR REPLACE FUNCTION public._festival_company_limit() RETURNS integer
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT COALESCE((config_value->>'company_limit')::integer, 3)
  FROM public.game_config WHERE config_key = 'festival_company_creation'
$$;

CREATE OR REPLACE FUNCTION public.get_festival_company_setup(p_festival_company_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
DECLARE
  v_profile_id uuid := public._caller_profile_id();
  v_is_admin boolean := COALESCE(public.has_role(auth.uid(),'admin'::public.app_role), false);
  v_result jsonb;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'active_profile_required' USING ERRCODE='P0001'; END IF;
  IF v_profile_id IS NULL AND NOT v_is_admin THEN RAISE EXCEPTION 'active_profile_required' USING ERRCODE='P0001'; END IF;

  SELECT jsonb_build_object(
    'festivalCompanyId', fc.id,
    'companyId', c.id,
    'publicName', fc.public_name,
    'legalCompanyName', c.name,
    'companyBalance', c.balance,
    'setupStatus', fc.status,
    'setupCompleted', fc.setup_completed,
    'ownerProfileId', fc.owner_profile_id,
    'ownerDisplayName', COALESCE(p.character_name, p.username, 'Owner'),
    'foundedAt', c.founded_at,
    'companyStatus', c.status,
    'isBankrupt', c.is_bankrupt,
    'configurationComplete', (fc.annual_month IS NOT NULL AND fc.country_code IS NOT NULL AND fc.default_vibe IS NOT NULL AND fc.default_site_type IS NOT NULL AND fc.default_duration_days IS NOT NULL),
    'firstEditionExists', EXISTS (SELECT 1 FROM public.festival_editions_v2 e WHERE e.festival_company_id = fc.id)
  ) INTO v_result
  FROM public.festival_companies fc
  JOIN public.companies c ON c.id = fc.company_id
  JOIN public.profiles p ON p.id = fc.owner_profile_id
  WHERE fc.id = p_festival_company_id
    AND (fc.owner_profile_id = v_profile_id OR v_is_admin);

  IF v_result IS NULL THEN RAISE EXCEPTION 'festival_company_not_found' USING ERRCODE='P0001'; END IF;
  RETURN v_result;
END $$;

CREATE OR REPLACE FUNCTION public.found_festival_company(
  p_public_name text,
  p_company_name text,
  p_description text DEFAULT NULL,
  p_idempotency_key text DEFAULT NULL
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE
  v_user uuid := auth.uid(); v_profile public.profiles%ROWTYPE; v_profile_id uuid; v_cost numeric := 2000000; v_cost_minor bigint := 200000000; v_public text; v_company text; v_slug text; v_hash text; v_req public.festival_company_founding_requests%ROWTYPE; v_company_id uuid; v_fc_id uuid; v_balance numeric; v_result jsonb; v_owned_count integer; v_limit integer; v_tx uuid;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'not_authenticated' USING ERRCODE='P0001'; END IF;
  IF NOT public._festival_company_creation_enabled() THEN RAISE EXCEPTION 'festival_creation_disabled' USING ERRCODE='P0001'; END IF;
  IF p_idempotency_key IS NULL OR length(btrim(p_idempotency_key)) < 8 THEN RAISE EXCEPTION 'idempotency_key_required' USING ERRCODE='P0001'; END IF;
  v_public := btrim(coalesce(p_public_name,'')); v_company := btrim(coalesce(p_company_name,''));
  IF char_length(v_public) < 3 OR char_length(v_public) > 80 OR char_length(v_company) < 3 OR char_length(v_company) > 120 THEN RAISE EXCEPTION 'invalid_festival_name' USING ERRCODE='P0001'; END IF;
  v_slug := public._festival_slug(v_public);
  IF v_slug = '' THEN RAISE EXCEPTION 'invalid_festival_name' USING ERRCODE='P0001'; END IF;
  v_hash := encode(digest(v_public || '|' || v_company || '|' || coalesce(p_description,'') || '|2000000', 'sha256'), 'hex');

  v_profile_id := public._caller_profile_id();
  IF v_profile_id IS NULL THEN RAISE EXCEPTION 'profile_not_eligible' USING ERRCODE='P0001'; END IF;
  SELECT * INTO v_profile FROM public.profiles WHERE id=v_profile_id AND user_id=v_user AND died_at IS NULL FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'profile_not_eligible' USING ERRCODE='P0001'; END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended(v_user::text || ':' || p_idempotency_key, 0));
  SELECT * INTO v_req FROM public.festival_company_founding_requests WHERE actor_user_id=v_user AND idempotency_key=p_idempotency_key FOR UPDATE;
  IF FOUND THEN
    IF v_req.request_hash <> v_hash THEN RAISE EXCEPTION 'idempotency_conflict' USING ERRCODE='P0001'; END IF;
    IF v_req.status = 'succeeded' THEN RETURN v_req.result || jsonb_build_object('idempotent', true); END IF;
    RAISE EXCEPTION 'festival_request_in_progress' USING ERRCODE='P0001';
  END IF;
  INSERT INTO public.festival_company_founding_requests(actor_user_id, actor_profile_id, idempotency_key, request_hash)
  VALUES (v_user, v_profile.id, p_idempotency_key, v_hash) RETURNING * INTO v_req;

  IF NOT public._has_active_vip_entitlement(v_user) THEN RAISE EXCEPTION 'festival_vip_required' USING ERRCODE='P0001'; END IF;
  IF coalesce(v_profile.cash,0) < v_cost THEN RAISE EXCEPTION 'insufficient_personal_funds' USING ERRCODE='P0001'; END IF;
  SELECT count(*) INTO v_owned_count FROM public.companies WHERE owner_id=v_user AND parent_company_id IS NULL AND status NOT IN ('dissolved','bankrupt') AND COALESCE(is_bankrupt,false)=false;
  v_limit := public._festival_company_limit();
  IF v_owned_count >= v_limit THEN RAISE EXCEPTION 'company_limit_reached' USING ERRCODE='P0001'; END IF;
  IF EXISTS (SELECT 1 FROM public.festival_companies WHERE slug = v_slug OR lower(public_name) = lower(v_public)) THEN RAISE EXCEPTION 'festival_name_taken' USING ERRCODE='P0001'; END IF;

  UPDATE public.profiles SET cash = cash - v_cost, updated_at = now() WHERE id = v_profile.id RETURNING cash INTO v_balance;
  INSERT INTO public.companies(owner_id,name,company_type,description,balance,weekly_operating_costs) VALUES (v_user,v_company,'festival',p_description,0,0) RETURNING id INTO v_company_id;
  INSERT INTO public.festival_companies(company_id, owner_profile_id, public_name, slug, description) VALUES (v_company_id, v_profile.id, v_public, v_slug, p_description) RETURNING id INTO v_fc_id;
  INSERT INTO public.company_shareholders(company_id,user_id,shares) VALUES (v_company_id,v_user,100);

  SELECT public.finance_debit_owner('player', v_profile.id, v_cost_minor, 'festival_company_founding_fee', 'Festival company founding fee', 'festival-company-founding:'||p_idempotency_key, v_profile.id, jsonb_build_object('festivalCompanyId',v_fc_id,'companyId',v_company_id,'wholeUsdAmount',v_cost)) INTO v_tx;

  INSERT INTO public.festival_company_audit_log(festival_company_id,company_id,actor_profile_id,action,idempotency_key,metadata) VALUES
    (v_fc_id,v_company_id,v_profile.id,'festival_company_founded',p_idempotency_key,jsonb_build_object('founding_cost',v_cost,'personal_financial_transaction_id',v_tx,'accounting','personal expense; no company P&L impact')),
    (v_fc_id,v_company_id,v_profile.id,'founding_fee_charged',p_idempotency_key,jsonb_build_object('personal_cash_after',v_balance));
  v_result := jsonb_build_object('companyId', v_company_id, 'festivalCompanyId', v_fc_id, 'personalCash', v_balance, 'foundingCost', v_cost, 'idempotent', false);
  UPDATE public.festival_company_founding_requests SET status='succeeded', company_id=v_company_id, festival_company_id=v_fc_id, resulting_personal_cash=v_balance, result=v_result, completed_at=now(), updated_at=now() WHERE id=v_req.id;
  RETURN v_result;
EXCEPTION WHEN unique_violation THEN
  IF EXISTS (SELECT 1 FROM public.festival_companies WHERE slug = v_slug OR lower(public_name) = lower(v_public)) THEN RAISE EXCEPTION 'festival_name_taken' USING ERRCODE='P0001'; END IF;
  RAISE;
END $$;

REVOKE ALL ON FUNCTION public.get_festival_company_setup(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_festival_company_setup(uuid) TO authenticated;
REVOKE ALL ON FUNCTION public.found_festival_company(text,text,text,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.found_festival_company(text,text,text,text) TO authenticated;
NOTIFY pgrst, 'reload schema';
