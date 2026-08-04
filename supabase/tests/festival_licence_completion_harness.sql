\set ON_ERROR_STOP on

CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE SCHEMA IF NOT EXISTS auth;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN CREATE ROLE anon NOLOGIN; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN CREATE ROLE authenticated NOLOGIN; END IF;
END $$;

CREATE TYPE public.app_role AS ENUM ('admin', 'user');

CREATE TABLE public.profiles (
  id uuid PRIMARY KEY,
  user_id uuid NOT NULL,
  character_name text,
  display_name text,
  username text
);
CREATE TABLE public.companies (
  id uuid PRIMARY KEY,
  name text NOT NULL,
  balance numeric NOT NULL DEFAULT 0,
  founded_at timestamptz NOT NULL DEFAULT now(),
  status text NOT NULL DEFAULT 'active',
  is_bankrupt boolean NOT NULL DEFAULT false,
  reputation_score integer NOT NULL DEFAULT 0
);
CREATE TABLE public.company_managers (
  company_id uuid NOT NULL,
  profile_id uuid NOT NULL,
  PRIMARY KEY (company_id, profile_id)
);
CREATE TABLE public.festival_companies (
  id uuid PRIMARY KEY,
  company_id uuid NOT NULL REFERENCES public.companies(id),
  owner_profile_id uuid NOT NULL REFERENCES public.profiles(id),
  public_name text NOT NULL,
  status text NOT NULL DEFAULT 'active',
  setup_completed boolean NOT NULL DEFAULT true,
  annual_month integer,
  country_code text,
  default_city_id uuid,
  default_vibe text,
  default_site_type text,
  default_duration_days integer,
  environmental_policy text,
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.financial_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_type text NOT NULL,
  owner_id uuid NOT NULL,
  is_primary boolean NOT NULL DEFAULT true,
  available_balance_minor bigint NOT NULL DEFAULT 0
);
CREATE TABLE public.financial_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_type text NOT NULL,
  owner_id uuid NOT NULL,
  amount_minor bigint NOT NULL,
  reference text NOT NULL UNIQUE,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.festival_upgrade_categories (
  key text PRIMARY KEY,
  display_order integer NOT NULL,
  display_name text NOT NULL
);
CREATE TABLE public.festival_company_upgrades (
  festival_company_id uuid NOT NULL,
  category_key text NOT NULL,
  active_level integer NOT NULL DEFAULT 0,
  PRIMARY KEY (festival_company_id, category_key)
);
CREATE TABLE public.festival_licence_tiers (
  key text PRIMARY KEY,
  rank integer UNIQUE NOT NULL,
  display_name text NOT NULL,
  max_attendance integer NOT NULL,
  max_days integer NOT NULL,
  max_stages integer NOT NULL,
  max_acts_per_day integer NOT NULL,
  camping_allowed boolean NOT NULL,
  minimum_reputation integer NOT NULL,
  fee_minor bigint NOT NULL,
  validity interval NOT NULL,
  requirements jsonb NOT NULL,
  active boolean NOT NULL DEFAULT true
);
CREATE TABLE public.festival_company_licences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  festival_company_id uuid NOT NULL REFERENCES public.festival_companies(id),
  tier_key text NOT NULL REFERENCES public.festival_licence_tiers(key),
  status text NOT NULL,
  applied_at timestamptz NOT NULL DEFAULT now(),
  valid_from timestamptz,
  valid_until timestamptz,
  decision_reason text,
  decided_by uuid REFERENCES public.profiles(id),
  UNIQUE (festival_company_id, tier_key, status)
);
CREATE TABLE public.cities (
  id uuid PRIMARY KEY,
  name text NOT NULL,
  country text NOT NULL,
  timezone text
);
CREATE TABLE public.festival_scale_catalogue (
  key text PRIMARY KEY,
  display_name text NOT NULL,
  description text NOT NULL,
  minimum_site_capacity integer NOT NULL,
  maximum_site_capacity integer NOT NULL,
  maximum_duration_days integer NOT NULL,
  complexity text NOT NULL,
  sort_order integer NOT NULL,
  active boolean NOT NULL DEFAULT true
);
CREATE TABLE public.festival_marketing_emphasis_catalogue (
  key text PRIMARY KEY,
  display_name text NOT NULL,
  description text NOT NULL,
  demand_basis_points integer NOT NULL,
  cost_basis_points integer NOT NULL,
  reputation_basis_points integer NOT NULL,
  local_artist_basis_points integer NOT NULL,
  sort_order integer NOT NULL,
  active boolean NOT NULL DEFAULT true
);
CREATE TABLE public.festival_vibe_catalogue (key text PRIMARY KEY, active boolean NOT NULL DEFAULT true);
CREATE TABLE public.festival_site_type_catalogue (key text PRIMARY KEY, active boolean NOT NULL DEFAULT true);
CREATE TABLE public.festival_environmental_policy_catalogue (key text PRIMARY KEY, active boolean NOT NULL DEFAULT true);
CREATE TABLE public.festival_editions_v2 (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  festival_company_id uuid NOT NULL REFERENCES public.festival_companies(id),
  edition_year integer NOT NULL,
  name text NOT NULL,
  status text NOT NULL DEFAULT 'draft',
  starts_on date,
  ends_on date,
  preferred_month integer,
  country_code text,
  city_id uuid,
  vibe text,
  site_type text,
  duration_days integer,
  environmental_policy text,
  festival_scale text,
  marketing_emphasis text,
  expected_capacity integer,
  estimated_operating_cost_minor bigint NOT NULL DEFAULT 0,
  planning_status text NOT NULL DEFAULT 'in_progress',
  readiness_score integer NOT NULL DEFAULT 0,
  planning_effects jsonb NOT NULL DEFAULT '{}'::jsonb,
  planning_updated_at timestamptz,
  version integer NOT NULL DEFAULT 1,
  locked_at timestamptz,
  creation_source text NOT NULL DEFAULT 'next_annual'
);
CREATE TABLE public.festival_configurations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  festival_company_id uuid NOT NULL,
  festival_edition_id uuid
);
CREATE TABLE public.festival_site_plans (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), festival_company_id uuid, festival_edition_id uuid);
CREATE TABLE public.festival_ticket_plans (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), festival_company_id uuid, festival_edition_id uuid);
CREATE TABLE public.festival_artist_programmes (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), festival_company_id uuid, festival_edition_id uuid);
CREATE TABLE public.festival_operations_plans (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), festival_company_id uuid, festival_edition_id uuid);
CREATE TABLE public.festival_sponsorship_plans (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), festival_company_id uuid, festival_edition_id uuid);
CREATE TABLE public.festival_timetable_plans (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), festival_company_id uuid, festival_edition_id uuid);
CREATE TABLE public.festival_edition_creation_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  festival_company_id uuid NOT NULL,
  actor_profile_id uuid NOT NULL,
  action text NOT NULL,
  idempotency_key uuid NOT NULL,
  payload_hash text NOT NULL,
  status text NOT NULL DEFAULT 'processing',
  festival_edition_id uuid,
  result jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  UNIQUE (festival_company_id, actor_profile_id, action, idempotency_key)
);
CREATE TABLE public.festival_edition_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  festival_company_id uuid NOT NULL,
  festival_edition_id uuid NOT NULL,
  actor_profile_id uuid,
  event_type text NOT NULL,
  previous_version integer,
  new_version integer NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.festival_annual_plan_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  festival_company_id uuid NOT NULL,
  festival_edition_id uuid NOT NULL,
  actor_profile_id uuid NOT NULL,
  idempotency_key uuid NOT NULL,
  payload_hash text NOT NULL,
  status text NOT NULL DEFAULT 'processing',
  result jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  UNIQUE (festival_edition_id, actor_profile_id, idempotency_key)
);
CREATE TABLE public.festival_upgrade_audit (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  festival_company_id uuid,
  actor_profile_id uuid,
  event_type text NOT NULL,
  reason text,
  before_value jsonb,
  after_value jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE FUNCTION auth.uid() RETURNS uuid
LANGUAGE sql STABLE AS $$
  SELECT nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
$$;
CREATE FUNCTION public._caller_profile_id() RETURNS uuid
LANGUAGE sql STABLE AS $$
  SELECT nullif(current_setting('app.profile_id', true), '')::uuid
$$;
CREATE FUNCTION public.current_profile_id_safe() RETURNS uuid
LANGUAGE sql STABLE AS $$ SELECT public._caller_profile_id() $$;
CREATE FUNCTION public.has_role(uuid, public.app_role) RETURNS boolean
LANGUAGE sql STABLE AS $$ SELECT false $$;
CREATE FUNCTION public.is_admin(uuid) RETURNS boolean
LANGUAGE sql STABLE AS $$ SELECT false $$;
CREATE FUNCTION public.can_manage_company(p_company_id uuid) RETURNS boolean
LANGUAGE sql STABLE AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.company_managers manager
    WHERE manager.company_id = p_company_id
      AND manager.profile_id = public._caller_profile_id()
  )
$$;
CREATE FUNCTION public.festival_company_capabilities() RETURNS jsonb
LANGUAGE sql STABLE AS $$
  SELECT jsonb_build_object(
    'newFestivalSystemEnabled', true,
    'festivalCompanyCreationEnabled', true,
    'festivalCompanyManagementEnabled', true,
    'festivalConfigurationEnabled', true,
    'companyLimit', 3
  )
$$;
CREATE FUNCTION public.finance_debit_owner(
  p_owner_type text,
  p_owner_id uuid,
  p_amount_minor bigint,
  p_category text,
  p_description text,
  p_reference text,
  p_actor uuid,
  p_metadata jsonb
) RETURNS uuid
LANGUAGE plpgsql AS $$
DECLARE transaction_id uuid;
BEGIN
  UPDATE public.financial_accounts
  SET available_balance_minor = available_balance_minor - p_amount_minor
  WHERE owner_type = p_owner_type
    AND owner_id = p_owner_id
    AND is_primary
    AND available_balance_minor >= p_amount_minor;
  IF NOT FOUND THEN RAISE EXCEPTION 'insufficient_funds'; END IF;
  INSERT INTO public.financial_transactions(owner_type, owner_id, amount_minor, reference, metadata)
  VALUES (p_owner_type, p_owner_id, p_amount_minor, p_reference,
          p_metadata || jsonb_build_object('category', p_category, 'description', p_description, 'actor', p_actor))
  RETURNING id INTO transaction_id;
  RETURN transaction_id;
END;
$$;
CREATE FUNCTION public.rockmundo_game_year(timestamptz DEFAULT now()) RETURNS integer
LANGUAGE sql STABLE AS $$ SELECT 2026 $$;
CREATE FUNCTION public.resolve_public_festival_identifier(text, text, text DEFAULT NULL) RETURNS jsonb
LANGUAGE sql STABLE AS $$
  SELECT jsonb_build_object(
    'status', 'resolved',
    'festivalCompanyId', '10000000-0000-0000-0000-000000000001'::uuid,
    'companyId', '20000000-0000-0000-0000-000000000001'::uuid,
    'editionId', '30000000-0000-0000-0000-000000000001'::uuid,
    'editionYear', 2026,
    'publicSlug', 'test-festival'
  )
$$;
CREATE FUNCTION public._festival_annual_plan_blockers(uuid, public.festival_editions_v2) RETURNS jsonb
LANGUAGE sql STABLE AS $$
  SELECT CASE WHEN EXISTS (
    SELECT 1 FROM public.festival_company_licences licence
    WHERE licence.festival_company_id = $1
      AND licence.status = 'active'
      AND coalesce(licence.valid_from, '-infinity') <= now()
      AND coalesce(licence.valid_until, 'infinity') > now()
  ) THEN '[]'::jsonb ELSE '[{"code":"festival_licence_required"}]'::jsonb END
$$;
CREATE FUNCTION public._festival_annual_plan_result(uuid, uuid) RETURNS jsonb
LANGUAGE sql STABLE AS $$
  SELECT jsonb_build_object(
    'festivalCompanyId', edition.festival_company_id,
    'festivalEditionId', edition.id,
    'version', edition.version,
    'planningStatus', edition.planning_status,
    'readinessScore', edition.readiness_score
  )
  FROM public.festival_editions_v2 edition
  WHERE edition.festival_company_id = $1 AND edition.id = $2
$$;
CREATE FUNCTION public._festival_annual_plan_capacity(uuid, text) RETURNS integer
LANGUAGE sql STABLE AS $$ SELECT 5000 $$;
CREATE FUNCTION public._festival_annual_plan_cost(uuid, text, text, text, text, integer, integer) RETURNS bigint
LANGUAGE sql STABLE AS $$ SELECT 250000::bigint $$;
CREATE FUNCTION public._festival_annual_plan_upgrade_progress(uuid, text[]) RETURNS numeric
LANGUAGE sql STABLE AS $$ SELECT 0.5::numeric $$;
CREATE FUNCTION public.get_festival_company_upgrades(p_festival_company_id uuid) RETURNS jsonb
LANGUAGE plpgsql STABLE AS $$
BEGIN
  RETURN jsonb_build_object(
    'festivalCompanyId', p_festival_company_id,
    'catalogueVersion', 2,
    'companyVersion', 0,
    'currencyCode', 'GBP',
    'availableBalanceMinor', coalesce((SELECT available_balance_minor FROM public.financial_accounts WHERE owner_type='company' AND owner_id=(SELECT company_id FROM public.festival_companies WHERE id=p_festival_company_id) AND is_primary), 0),
    'purchaseWindow', jsonb_build_object('limit',2,'used',0,'remaining',2,'windowDays',30,'serverNow',now(),'nextAvailableAt',NULL),
    'categories', '[]'::jsonb,
    'licence', public.get_festival_licence_progress(p_festival_company_id)
  );
END;
$$;

INSERT INTO public.profiles(id,user_id,character_name,username) VALUES
 ('00000000-0000-0000-0000-000000000001','01000000-0000-0000-0000-000000000001','Owner','owner'),
 ('00000000-0000-0000-0000-000000000002','01000000-0000-0000-0000-000000000002','Manager','manager'),
 ('00000000-0000-0000-0000-000000000003','01000000-0000-0000-0000-000000000003','Outsider','outsider');
INSERT INTO public.companies(id,name,balance,reputation_score) VALUES
 ('20000000-0000-0000-0000-000000000001','Festival Holdings',10000,0);
INSERT INTO public.festival_companies(
 id,company_id,owner_profile_id,public_name,status,setup_completed,annual_month,country_code,
 default_city_id,default_vibe,default_site_type,default_duration_days,environmental_policy
) VALUES (
 '10000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000001',
 '00000000-0000-0000-0000-000000000001','Test Festival','active',true,8,'United Kingdom',
 '40000000-0000-0000-0000-000000000001','alternative','outdoor',1,'standard'
);
INSERT INTO public.company_managers VALUES
 ('20000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000002');
INSERT INTO public.financial_accounts(owner_type,owner_id,is_primary,available_balance_minor) VALUES
 ('company','20000000-0000-0000-0000-000000000001',true,1000000);
INSERT INTO public.festival_upgrade_categories(key,display_order,display_name) VALUES
 ('site_infrastructure',1,'Site Infrastructure'),('stages_production',2,'Stages and Production'),
 ('security_crowd_control',3,'Security and Crowd Control'),('medical_welfare',4,'Medical and Welfare');
INSERT INTO public.festival_company_upgrades VALUES
 ('10000000-0000-0000-0000-000000000001','site_infrastructure',10),
 ('10000000-0000-0000-0000-000000000001','stages_production',10),
 ('10000000-0000-0000-0000-000000000001','security_crowd_control',10),
 ('10000000-0000-0000-0000-000000000001','medical_welfare',10);
INSERT INTO public.festival_licence_tiers VALUES
 ('local',1,'Local',5000,1,1,8,false,0,100000,interval '1 year',
  '{"site_infrastructure":10,"stages_production":10,"security_crowd_control":10,"medical_welfare":10}',true),
 ('small',2,'Small',15000,2,2,12,false,100,200000,interval '1 year',
  '{"site_infrastructure":20,"stages_production":20,"security_crowd_control":20,"medical_welfare":20}',true);
INSERT INTO public.cities VALUES ('40000000-0000-0000-0000-000000000001','London','United Kingdom','Europe/London');
INSERT INTO public.festival_scale_catalogue VALUES ('local','Local','Local Festival',1000,5000,1,'low',1,true);
INSERT INTO public.festival_marketing_emphasis_catalogue VALUES ('balanced','Balanced','Balanced campaign',10000,10000,10000,2500,1,true);
INSERT INTO public.festival_vibe_catalogue VALUES ('alternative',true);
INSERT INTO public.festival_site_type_catalogue VALUES ('outdoor',true);
INSERT INTO public.festival_environmental_policy_catalogue VALUES ('standard',true);
INSERT INTO public.festival_editions_v2(
 id,festival_company_id,edition_year,name,status,starts_on,ends_on,preferred_month,country_code,
 city_id,vibe,site_type,duration_days,environmental_policy,festival_scale,marketing_emphasis,
 expected_capacity,planning_status,readiness_score,version
) VALUES (
 '30000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001',2026,
 'Test Festival','draft',current_date+30,current_date+30,extract(month from current_date+30)::int,
 'United Kingdom','40000000-0000-0000-0000-000000000001','alternative','outdoor',1,'standard',
 'local','balanced',5000,'in_progress',75,1
);
INSERT INTO public.festival_configurations(festival_company_id,festival_edition_id) VALUES
 ('10000000-0000-0000-0000-000000000001','30000000-0000-0000-0000-000000000001');

\ir ../migrations/20291218245600_festival_licence_and_manager_authority.sql

CREATE FUNCTION public.test_assert(p_condition boolean, p_message text) RETURNS void
LANGUAGE plpgsql AS $$ BEGIN
  IF NOT coalesce(p_condition,false) THEN RAISE EXCEPTION 'assertion_failed: %', p_message; END IF;
END $$;

SELECT set_config('request.jwt.claim.sub','01000000-0000-0000-0000-000000000002',false);
SELECT set_config('app.profile_id','00000000-0000-0000-0000-000000000002',false);

SELECT public.test_assert(
  public._festival_company_manager_authorized('10000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000002'),
  'hired manager should be authorised'
);
SELECT public.test_assert(
  (public.get_festival_company_setup('10000000-0000-0000-0000-000000000001')->>'publicName')='Test Festival',
  'manager should open Festival company home'
);
SELECT public.test_assert(
  jsonb_array_length(public.get_festival_company_editions('10000000-0000-0000-0000-000000000001')->'editions')=1,
  'manager should view annual editions'
);
SELECT public.test_assert(
  (public.get_festival_edition_annual_plan('10000000-0000-0000-0000-000000000001','30000000-0000-0000-0000-000000000001')->>'version')::int=1,
  'manager should read exact annual plan'
);

SELECT public.save_festival_edition_annual_plan(
 '10000000-0000-0000-0000-000000000001','30000000-0000-0000-0000-000000000001',1,
 jsonb_build_object(
   'startsOn',(current_date+40)::text,
   'durationDays',1,
   'preferredMonth',extract(month from current_date+40)::int,
   'cityId','40000000-0000-0000-0000-000000000001',
   'festivalScale','local','vibe','alternative','siteType','outdoor',
   'environmentalPolicy','standard','marketingEmphasis','balanced'
 ),'50000000-0000-0000-0000-000000000001'
);
SELECT public.test_assert(
  (SELECT version=2 FROM public.festival_editions_v2 WHERE id='30000000-0000-0000-0000-000000000001'),
  'manager should save annual plan'
);

SELECT public.test_assert(
  (public.get_festival_licence_progress('10000000-0000-0000-0000-000000000001')->>'action')='apply',
  'eligible unlicensed company should be offered apply'
);
SELECT public.test_assert(
  (public.get_festival_licence_progress('10000000-0000-0000-0000-000000000001')->>'canApply')::boolean,
  'local licence should be actionable'
);

SELECT public.apply_festival_company_licence(
 '10000000-0000-0000-0000-000000000001','local',0,
 '60000000-0000-0000-0000-000000000001'
);
SELECT public.test_assert(
  (SELECT available_balance_minor=900000 FROM public.financial_accounts WHERE owner_id='20000000-0000-0000-0000-000000000001'),
  'licence fee should debit company funds once'
);
SELECT public.test_assert(
  (SELECT count(*)=1 FROM public.financial_transactions WHERE reference LIKE 'festival-licence:%'),
  'licence should create one finance transaction'
);
SELECT public.test_assert(
  (SELECT count(*)=1 FROM public.festival_company_licences WHERE festival_company_id='10000000-0000-0000-0000-000000000001' AND status='active' AND tier_key='local'),
  'local licence should be active'
);
SELECT public.test_assert(
  (SELECT licence_version=1 FROM public.festival_companies WHERE id='10000000-0000-0000-0000-000000000001'),
  'licence version should advance'
);
SELECT public.test_assert(
  (SELECT readiness_score=100 AND planning_status='ready' FROM public.festival_editions_v2 WHERE id='30000000-0000-0000-0000-000000000001'),
  'licence should refresh edition readiness'
);

SELECT public.apply_festival_company_licence(
 '10000000-0000-0000-0000-000000000001','local',0,
 '60000000-0000-0000-0000-000000000001'
);
SELECT public.test_assert(
  (SELECT available_balance_minor=900000 FROM public.financial_accounts WHERE owner_id='20000000-0000-0000-0000-000000000001'),
  'idempotent replay must not charge twice'
);

DO $$ BEGIN
  PERFORM public.apply_festival_company_licence(
   '10000000-0000-0000-0000-000000000001','local',0,
   '60000000-0000-0000-0000-000000000002');
  RAISE EXCEPTION 'expected stale licence version';
EXCEPTION WHEN OTHERS THEN
  IF SQLERRM NOT LIKE '%FESTIVAL_LICENCE_VERSION_CONFLICT%' THEN RAISE; END IF;
END $$;

UPDATE public.festival_company_licences
SET valid_until=now()+interval '10 days'
WHERE festival_company_id='10000000-0000-0000-0000-000000000001' AND status='active';
SELECT public.test_assert(
  (public.get_festival_licence_progress('10000000-0000-0000-0000-000000000001')->>'action')='renew',
  'renewal should open in final 30 days'
);
SELECT public.apply_festival_company_licence(
 '10000000-0000-0000-0000-000000000001','local',1,
 '60000000-0000-0000-0000-000000000003'
);
SELECT public.test_assert(
  (SELECT available_balance_minor=800000 FROM public.financial_accounts WHERE owner_id='20000000-0000-0000-0000-000000000001'),
  'renewal should charge the fee'
);
SELECT public.test_assert(
  (SELECT count(*)=1 FROM public.festival_company_licences WHERE festival_company_id='10000000-0000-0000-0000-000000000001' AND status='active'),
  'renewal should preserve one active licence'
);

UPDATE public.companies SET reputation_score=100 WHERE id='20000000-0000-0000-0000-000000000001';
UPDATE public.festival_company_upgrades SET active_level=20
WHERE festival_company_id='10000000-0000-0000-0000-000000000001';
SELECT public.test_assert(
  (public.get_festival_licence_progress('10000000-0000-0000-0000-000000000001')->>'action')='upgrade',
  'higher eligible tier should be offered as upgrade'
);
SELECT public.apply_festival_company_licence(
 '10000000-0000-0000-0000-000000000001','small',2,
 '60000000-0000-0000-0000-000000000004'
);
SELECT public.test_assert(
  (SELECT count(*)=1 FROM public.festival_company_licences WHERE festival_company_id='10000000-0000-0000-0000-000000000001' AND status='active' AND tier_key='small'),
  'upgrade should replace active licence'
);
SELECT public.test_assert(
  (SELECT count(*)=1 FROM public.festival_company_licences WHERE festival_company_id='10000000-0000-0000-0000-000000000001' AND status='revoked' AND tier_key='local'),
  'superseded licence should be retained as history'
);

SELECT public.plan_next_festival_edition(
 '10000000-0000-0000-0000-000000000001',
 '70000000-0000-0000-0000-000000000001'
);
SELECT public.test_assert(
  (SELECT count(*)=2 FROM public.festival_editions_v2 WHERE festival_company_id='10000000-0000-0000-0000-000000000001'),
  'manager should plan the next annual edition'
);
SELECT public.test_assert(
  public._festival_projection_authorized(
   '10000000-0000-0000-0000-000000000001','30000000-0000-0000-0000-000000000001',
   '00000000-0000-0000-0000-000000000002'),
  'manager should access exact-edition projections'
);

SELECT set_config('request.jwt.claim.sub','01000000-0000-0000-0000-000000000003',false);
SELECT set_config('app.profile_id','00000000-0000-0000-0000-000000000003',false);
DO $$ BEGIN
  PERFORM public.get_festival_licence_progress('10000000-0000-0000-0000-000000000001');
  RAISE EXCEPTION 'expected outsider denial';
EXCEPTION WHEN OTHERS THEN
  IF SQLERRM NOT LIKE '%FESTIVAL_LICENCE_ACCESS_DENIED%' THEN RAISE; END IF;
END $$;

SELECT public.test_assert(
  has_function_privilege('authenticated','public.apply_festival_company_licence(uuid,text,integer,uuid)','EXECUTE'),
  'authenticated role should execute licence action'
);
SELECT public.test_assert(
  NOT has_function_privilege('anon','public.apply_festival_company_licence(uuid,text,integer,uuid)','EXECUTE'),
  'anonymous role must not execute licence action'
);

SELECT 'festival licence completion harness passed' AS result;
