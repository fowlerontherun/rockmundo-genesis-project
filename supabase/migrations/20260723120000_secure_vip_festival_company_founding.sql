-- Secure VIP festival-company founding foundation.
-- Money units: profiles.cash, companies.balance and company_transactions.amount use whole USD game dollars.
-- The $2,000,000 festival founding fee is a setup expense deducted from personal cash; it is not deposited into the company.
CREATE EXTENSION IF NOT EXISTS pgcrypto;

DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT conname
    FROM pg_constraint
    WHERE conrelid = 'public.companies'::regclass
      AND contype = 'c'
      AND pg_get_constraintdef(oid) LIKE '%company_type%'
  LOOP
    EXECUTE format('ALTER TABLE public.companies DROP CONSTRAINT %I', r.conname);
  END LOOP;
END $$;

ALTER TABLE public.companies
  ADD CONSTRAINT companies_company_type_check
  CHECK (company_type IN ('holding','label','security','factory','logistics','venue','rehearsal','recording_studio','festival'));

INSERT INTO public.company_type_definitions (type_key, label, category, description, icon, color, creation_cost, starting_balance, weekly_operating_costs, base_tax_rate)
VALUES ('festival', 'Festival Company', 'events', 'Create and operate an annual music festival', 'Tent', 'text-fuchsia-500', 2000000, 0, 0, 0.22)
ON CONFLICT (type_key) DO UPDATE SET
  label = EXCLUDED.label,
  category = EXCLUDED.category,
  description = EXCLUDED.description,
  icon = EXCLUDED.icon,
  color = EXCLUDED.color,
  creation_cost = EXCLUDED.creation_cost,
  starting_balance = EXCLUDED.starting_balance,
  weekly_operating_costs = EXCLUDED.weekly_operating_costs,
  base_tax_rate = EXCLUDED.base_tax_rate,
  updated_at = now();

CREATE TABLE IF NOT EXISTS public.festival_companies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL UNIQUE REFERENCES public.companies(id) ON DELETE CASCADE,
  owner_profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  public_name text NOT NULL,
  slug text NOT NULL UNIQUE,
  tagline text,
  description text,
  status text NOT NULL DEFAULT 'setup' CHECK (status IN ('setup','active','paused','retired')),
  annual_month smallint CHECK (annual_month BETWEEN 1 AND 12),
  country_code text,
  default_city_id uuid REFERENCES public.cities(id) ON DELETE SET NULL,
  default_vibe text,
  default_site_type text,
  default_duration_days smallint CHECK (default_duration_days BETWEEN 1 AND 3),
  environmental_policy text,
  setup_completed boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT festival_companies_public_name_length CHECK (char_length(btrim(public_name)) BETWEEN 3 AND 80),
  CONSTRAINT festival_companies_slug_format CHECK (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$')
);

CREATE TABLE IF NOT EXISTS public.festival_editions_v2 (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  festival_company_id uuid NOT NULL REFERENCES public.festival_companies(id) ON DELETE CASCADE,
  edition_year integer NOT NULL CHECK (edition_year BETWEEN 2000 AND 2200),
  name text NOT NULL,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','configuring','locked','announced','live','completed','cancelled')),
  starts_on date,
  ends_on date,
  country_code text,
  city_id uuid REFERENCES public.cities(id) ON DELETE SET NULL,
  vibe text,
  site_type text,
  duration_days smallint CHECK (duration_days BETWEEN 1 AND 3),
  environmental_policy text,
  configuration_locked_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(festival_company_id, edition_year),
  CONSTRAINT festival_editions_v2_date_order CHECK (starts_on IS NULL OR ends_on IS NULL OR ends_on >= starts_on)
);

CREATE TABLE IF NOT EXISTS public.festival_company_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  festival_company_id uuid REFERENCES public.festival_companies(id) ON DELETE SET NULL,
  company_id uuid REFERENCES public.companies(id) ON DELETE SET NULL,
  actor_profile_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  action text NOT NULL CHECK (action IN ('festival_company_founded','founding_fee_charged')),
  idempotency_key text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.festival_company_founding_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  actor_profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  idempotency_key text NOT NULL,
  request_hash text NOT NULL,
  status text NOT NULL DEFAULT 'processing' CHECK (status IN ('processing','succeeded')),
  company_id uuid UNIQUE,
  festival_company_id uuid UNIQUE,
  resulting_personal_cash numeric,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(actor_user_id, idempotency_key)
);

ALTER TABLE public.festival_companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.festival_editions_v2 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.festival_company_audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.festival_company_founding_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Festival owners can read own festival companies" ON public.festival_companies FOR SELECT USING (
  owner_profile_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid()) OR coalesce(public.has_role(auth.uid(),'admin'::public.app_role), false)
);
CREATE POLICY "Festival owners can read own festival editions" ON public.festival_editions_v2 FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.festival_companies fc JOIN public.profiles p ON p.id=fc.owner_profile_id WHERE fc.id=festival_editions_v2.festival_company_id AND (p.user_id=auth.uid() OR coalesce(public.has_role(auth.uid(),'admin'::public.app_role), false)))
);
CREATE POLICY "Festival owners can read own audit log" ON public.festival_company_audit_log FOR SELECT USING (
  actor_profile_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid()) OR coalesce(public.has_role(auth.uid(),'admin'::public.app_role), false)
);
CREATE POLICY "Festival founders can read own founding requests" ON public.festival_company_founding_requests FOR SELECT USING (actor_user_id = auth.uid() OR coalesce(public.has_role(auth.uid(),'admin'::public.app_role), false));

CREATE OR REPLACE FUNCTION public._festival_slug(p_name text) RETURNS text LANGUAGE sql IMMUTABLE AS $$
  SELECT trim(both '-' from regexp_replace(lower(coalesce(p_name,'')), '[^a-z0-9]+', '-', 'g'))
$$;

CREATE OR REPLACE FUNCTION public._has_active_vip_entitlement(p_user_id uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.vip_subscriptions v
    WHERE v.user_id = p_user_id AND v.status IN ('active','cancelled') AND v.starts_at <= now() AND v.expires_at > now()
  ) OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.user_id = p_user_id AND coalesce(p.is_vip,false) = true)
$$;

CREATE OR REPLACE FUNCTION public.found_festival_company(
  p_public_name text,
  p_company_name text,
  p_description text DEFAULT NULL,
  p_idempotency_key text DEFAULT NULL
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE
  v_user uuid := auth.uid(); v_profile public.profiles%ROWTYPE; v_cost numeric := 2000000; v_public text; v_company text; v_slug text; v_hash text; v_req public.festival_company_founding_requests%ROWTYPE; v_company_id uuid; v_fc_id uuid; v_balance numeric;
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
      RETURN jsonb_build_object('companyId', v_req.company_id, 'festivalCompanyId', v_req.festival_company_id, 'personalCash', v_req.resulting_personal_cash, 'foundingCost', v_cost, 'idempotent', true);
    END IF;
  ELSE
    INSERT INTO public.festival_company_founding_requests(actor_user_id, actor_profile_id, idempotency_key, request_hash)
    VALUES (v_user, v_profile.id, p_idempotency_key, v_hash) RETURNING * INTO v_req;
  END IF;

  IF NOT public._has_active_vip_entitlement(v_user) THEN RAISE EXCEPTION 'festival_vip_required' USING ERRCODE='P0001'; END IF;
  IF coalesce(v_profile.cash,0) < v_cost THEN RAISE EXCEPTION 'insufficient_personal_funds' USING ERRCODE='P0001'; END IF;
  IF EXISTS (SELECT 1 FROM public.festival_companies WHERE slug = v_slug OR lower(public_name) = lower(v_public)) THEN RAISE EXCEPTION 'festival_name_taken' USING ERRCODE='P0001'; END IF;

  UPDATE public.profiles SET cash = cash - v_cost, updated_at = now() WHERE id = v_profile.id RETURNING cash INTO v_balance;
  INSERT INTO public.companies(owner_id,name,company_type,description,balance,weekly_operating_costs) VALUES (v_user,v_company,'festival',p_description,0,0) RETURNING id INTO v_company_id;
  INSERT INTO public.festival_companies(company_id, owner_profile_id, public_name, slug, description) VALUES (v_company_id, v_profile.id, v_public, v_slug, p_description) RETURNING id INTO v_fc_id;
  INSERT INTO public.company_shareholders(company_id,user_id,shares) VALUES (v_company_id,v_user,100);
  INSERT INTO public.company_transactions(company_id,transaction_type,amount,description,related_entity_id,related_entity_type) VALUES (v_company_id,'expense',v_cost,'Festival company founding/setup fee charged to founder personal cash',v_fc_id,'festival_company');
  INSERT INTO public.festival_company_audit_log(festival_company_id,company_id,actor_profile_id,action,idempotency_key,metadata) VALUES
    (v_fc_id,v_company_id,v_profile.id,'festival_company_founded',p_idempotency_key,jsonb_build_object('founding_cost',v_cost,'money_units','whole_usd_game_dollars')),
    (v_fc_id,v_company_id,v_profile.id,'founding_fee_charged',p_idempotency_key,jsonb_build_object('personal_cash_after',v_balance));
  UPDATE public.festival_company_founding_requests SET status='succeeded', company_id=v_company_id, festival_company_id=v_fc_id, resulting_personal_cash=v_balance, updated_at=now() WHERE id=v_req.id;
  RETURN jsonb_build_object('companyId', v_company_id, 'festivalCompanyId', v_fc_id, 'personalCash', v_balance, 'foundingCost', v_cost, 'idempotent', false);
EXCEPTION WHEN unique_violation THEN
  RAISE EXCEPTION 'festival_name_taken' USING ERRCODE='P0001';
END $$;

REVOKE ALL ON FUNCTION public.found_festival_company(text,text,text,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.found_festival_company(text,text,text,text) TO authenticated;
NOTIFY pgrst, 'reload schema';
