\set ON_ERROR_STOP on

CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE SCHEMA IF NOT EXISTS auth;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    CREATE ROLE anon NOLOGIN;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    CREATE ROLE authenticated NOLOGIN;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
    CREATE ROLE service_role NOLOGIN;
  END IF;
END
$$;

CREATE TYPE public.app_role AS ENUM ('admin', 'user');

CREATE OR REPLACE FUNCTION auth.uid()
RETURNS uuid
LANGUAGE sql
STABLE
AS $$
  SELECT nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
$$;

CREATE TABLE public.profiles (id uuid PRIMARY KEY);
CREATE TABLE public.cities (
  id uuid PRIMARY KEY,
  name text NOT NULL,
  country text NOT NULL,
  timezone text NOT NULL
);
CREATE TABLE public.festival_companies (
  id uuid PRIMARY KEY,
  owner_profile_id uuid NOT NULL REFERENCES public.profiles(id),
  public_name text NOT NULL,
  status text NOT NULL DEFAULT 'active',
  setup_completed boolean NOT NULL DEFAULT true
);
CREATE TABLE public.festival_scale_catalogue (
  key text PRIMARY KEY,
  minimum_site_capacity integer NOT NULL,
  maximum_site_capacity integer NOT NULL,
  minimum_stages smallint NOT NULL,
  maximum_stages smallint NOT NULL,
  maximum_main_stage_capacity integer NOT NULL,
  maximum_total_stage_capacity integer NOT NULL,
  requires_secondary_stage boolean NOT NULL DEFAULT false,
  requires_accessibility_plan boolean NOT NULL DEFAULT false
);
CREATE TABLE public.festival_editions_v2 (
  id uuid PRIMARY KEY,
  festival_company_id uuid NOT NULL REFERENCES public.festival_companies(id),
  edition_year integer NOT NULL,
  name text NOT NULL,
  status text NOT NULL DEFAULT 'draft',
  starts_on date,
  ends_on date,
  city_id uuid REFERENCES public.cities(id),
  site_type text,
  festival_scale text REFERENCES public.festival_scale_catalogue(key),
  expected_capacity integer,
  estimated_operating_cost_minor bigint NOT NULL DEFAULT 0,
  planning_effects jsonb NOT NULL DEFAULT '{}'::jsonb,
  locked_at timestamptz
);
CREATE TABLE public.festival_configurations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  festival_company_id uuid NOT NULL REFERENCES public.festival_companies(id),
  festival_edition_id uuid REFERENCES public.festival_editions_v2(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.festival_site_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  festival_company_id uuid NOT NULL REFERENCES public.festival_companies(id),
  festival_edition_id uuid REFERENCES public.festival_editions_v2(id),
  configuration_id uuid NOT NULL REFERENCES public.festival_configurations(id),
  site_source text NOT NULL CHECK (site_source IN ('existing_venue','temporary_site','open_land','mixed_site')),
  existing_venue_id uuid,
  site_name text NOT NULL,
  site_type text NOT NULL CHECK (site_type IN ('indoor','outdoor','mixed')),
  site_description text,
  city_id uuid NOT NULL REFERENCES public.cities(id),
  timezone text,
  total_capacity integer NOT NULL CHECK (total_capacity > 0),
  usable_capacity integer NOT NULL CHECK (usable_capacity > 0 AND usable_capacity <= total_capacity),
  reserved_capacity integer NOT NULL DEFAULT 0 CHECK (reserved_capacity >= 0 AND reserved_capacity < total_capacity),
  minimum_age smallint,
  curfew_time time,
  gates_open_time time,
  daily_open_time time NOT NULL,
  daily_close_time time NOT NULL,
  accessibility_notes text,
  transport_notes text,
  weather_exposure text,
  ground_condition text,
  facility_recommendations jsonb NOT NULL DEFAULT '{}'::jsonb,
  validation_issues jsonb NOT NULL DEFAULT '[]'::jsonb,
  status text NOT NULL DEFAULT 'in_progress' CHECK (status IN ('not_started','in_progress','site_selected','stages_configured','ready_for_ticketing')),
  planning_version integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  CONSTRAINT festival_site_plans_festival_company_id_key UNIQUE (festival_company_id),
  CONSTRAINT festival_site_plans_festival_edition_id_key UNIQUE (festival_edition_id),
  CHECK ((site_source = 'existing_venue') = (existing_venue_id IS NOT NULL)),
  CHECK (daily_open_time < daily_close_time)
);
CREATE TABLE public.festival_site_plan_stages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  festival_site_plan_id uuid NOT NULL REFERENCES public.festival_site_plans(id) ON DELETE CASCADE,
  festival_company_id uuid NOT NULL REFERENCES public.festival_companies(id),
  name text NOT NULL,
  slug text NOT NULL,
  stage_type text NOT NULL CHECK (stage_type IN ('main','secondary','emerging','acoustic','dance','specialist','community')),
  sort_order smallint NOT NULL,
  capacity integer NOT NULL CHECK (capacity > 0),
  minimum_artist_fame integer,
  performance_area_quality smallint,
  sound_quality smallint,
  lighting_quality smallint,
  production_complexity text NOT NULL DEFAULT 'standard',
  indoor boolean NOT NULL,
  covered boolean NOT NULL,
  accessible_viewing_capacity integer NOT NULL DEFAULT 0,
  opens_at time NOT NULL,
  closes_at time NOT NULL,
  changeover_minutes smallint NOT NULL,
  headline_slot_minutes smallint NOT NULL,
  standard_slot_minutes smallint NOT NULL,
  status text NOT NULL DEFAULT 'planned' CHECK (status IN ('planned','ready')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (festival_site_plan_id, name),
  UNIQUE (festival_site_plan_id, slug),
  UNIQUE (festival_site_plan_id, sort_order)
);
CREATE UNIQUE INDEX festival_site_plan_stages_one_main
  ON public.festival_site_plan_stages(festival_site_plan_id)
  WHERE stage_type = 'main';

CREATE TABLE public.festival_ticket_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  festival_company_id uuid NOT NULL REFERENCES public.festival_companies(id),
  festival_edition_id uuid REFERENCES public.festival_editions_v2(id),
  festival_site_plan_id uuid UNIQUE NOT NULL REFERENCES public.festival_site_plans(id),
  currency_code text NOT NULL,
  sales_tax_rate_basis_points integer NOT NULL DEFAULT 0,
  booking_fee_mode text NOT NULL DEFAULT 'none' CHECK (booking_fee_mode IN ('fixed','percentage','combined','none')),
  booking_fee_minor bigint NOT NULL DEFAULT 0,
  booking_fee_basis_points integer NOT NULL DEFAULT 0,
  booking_fee_payer text NOT NULL DEFAULT 'customer' CHECK (booking_fee_payer IN ('customer','festival_company','split')),
  refund_policy text,
  transfer_policy text,
  minimum_purchase_quantity integer NOT NULL DEFAULT 1,
  maximum_purchase_quantity integer NOT NULL DEFAULT 8,
  expected_sell_through_basis_points integer NOT NULL DEFAULT 8000,
  expected_refund_basis_points integer NOT NULL DEFAULT 0,
  expected_complimentary_use_basis_points integer NOT NULL DEFAULT 0,
  expected_no_show_basis_points integer NOT NULL DEFAULT 0,
  validation_issues jsonb NOT NULL DEFAULT '[]'::jsonb,
  forecast jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'not_started' CHECK (status IN ('not_started','in_progress','products_configured','capacity_allocated','forecast_reviewed','ready_for_artist_planning')),
  planning_version integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  CONSTRAINT festival_ticket_plans_festival_company_id_key UNIQUE (festival_company_id),
  CONSTRAINT festival_ticket_plans_festival_edition_id_key UNIQUE (festival_edition_id)
);
CREATE TABLE public.festival_ticket_products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  festival_ticket_plan_id uuid NOT NULL REFERENCES public.festival_ticket_plans(id) ON DELETE CASCADE,
  festival_company_id uuid NOT NULL REFERENCES public.festival_companies(id),
  name text NOT NULL,
  slug text NOT NULL,
  ticket_type text NOT NULL,
  product_class text NOT NULL,
  access_scope text NOT NULL,
  valid_from_date date NOT NULL,
  valid_to_date date NOT NULL,
  price_minor bigint NOT NULL,
  face_value_minor bigint NOT NULL,
  capacity_limit integer NOT NULL,
  minimum_age integer,
  includes_camping boolean NOT NULL DEFAULT false,
  includes_parking boolean NOT NULL DEFAULT false,
  includes_vip_area boolean NOT NULL DEFAULT false,
  includes_backstage boolean NOT NULL DEFAULT false,
  transferable boolean NOT NULL DEFAULT false,
  refundable boolean NOT NULL DEFAULT false,
  sale_priority integer NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (festival_ticket_plan_id, slug)
);
CREATE TABLE public.festival_ticket_release_phases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  festival_ticket_plan_id uuid NOT NULL REFERENCES public.festival_ticket_plans(id) ON DELETE CASCADE,
  festival_ticket_product_id uuid NOT NULL REFERENCES public.festival_ticket_products(id) ON DELETE CASCADE,
  name text NOT NULL,
  release_type text NOT NULL,
  sort_order integer NOT NULL,
  starts_at timestamptz,
  ends_at timestamptz,
  allocation_limit integer NOT NULL,
  price_override_minor bigint,
  discount_basis_points integer NOT NULL DEFAULT 0,
  eligibility_rule text,
  status text NOT NULL DEFAULT 'planned',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (festival_ticket_plan_id, festival_ticket_product_id, name)
);
CREATE TABLE public.festival_ticket_capacity_allocations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  festival_ticket_plan_id uuid NOT NULL REFERENCES public.festival_ticket_plans(id) ON DELETE CASCADE,
  festival_ticket_product_id uuid NOT NULL REFERENCES public.festival_ticket_products(id) ON DELETE CASCADE,
  festival_date date NOT NULL,
  capacity_allocated integer NOT NULL,
  capacity_reserved integer NOT NULL DEFAULT 0,
  capacity_complimentary integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (festival_ticket_plan_id, festival_ticket_product_id, festival_date)
);
CREATE TABLE public.festival_ticket_plan_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  festival_company_id uuid NOT NULL REFERENCES public.festival_companies(id),
  caller_profile_id uuid NOT NULL REFERENCES public.profiles(id),
  idempotency_key uuid NOT NULL,
  payload_hash text NOT NULL,
  result jsonb,
  status text NOT NULL DEFAULT 'processing' CHECK (status IN ('processing','succeeded')),
  created_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  UNIQUE (festival_company_id, caller_profile_id, idempotency_key)
);

CREATE TABLE public.festival_artist_programmes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  festival_company_id uuid NOT NULL REFERENCES public.festival_companies(id),
  festival_edition_id uuid REFERENCES public.festival_editions_v2(id),
  festival_ticket_plan_id uuid UNIQUE NOT NULL REFERENCES public.festival_ticket_plans(id),
  currency_code text NOT NULL,
  application_mode text NOT NULL CHECK (application_mode IN ('closed','invite_only','applications_only','hybrid')),
  applications_open_at timestamptz,
  applications_close_at timestamptz,
  minimum_artist_fame integer,
  maximum_artist_fame integer,
  preferred_genres text[] NOT NULL DEFAULT '{}',
  excluded_genres text[] NOT NULL DEFAULT '{}',
  artist_budget_minor bigint NOT NULL DEFAULT 0,
  contingency_budget_minor bigint NOT NULL DEFAULT 0,
  minimum_player_artist_share_basis_points integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'not_started' CHECK (status IN ('not_started','applications_configured','applications_open','offers_in_progress','bookings_in_progress','lineup_draft_complete','ready_for_operations')),
  planning_version integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  CONSTRAINT festival_artist_programmes_festival_company_id_key UNIQUE (festival_company_id),
  CONSTRAINT festival_artist_programmes_festival_edition_id_key UNIQUE (festival_edition_id)
);
CREATE TABLE public.festival_artist_application_windows (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  festival_artist_programme_id uuid NOT NULL REFERENCES public.festival_artist_programmes(id) ON DELETE CASCADE,
  name text NOT NULL,
  opens_at timestamptz NOT NULL,
  closes_at timestamptz NOT NULL CHECK (opens_at < closes_at),
  eligible_artist_type text NOT NULL,
  minimum_fame integer,
  maximum_fame integer,
  preferred_genres text[] NOT NULL DEFAULT '{}',
  minimum_band_members integer,
  maximum_band_members integer,
  target_stage_types text[] NOT NULL DEFAULT '{}',
  maximum_set_minutes integer,
  active boolean NOT NULL DEFAULT true,
  version integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (festival_artist_programme_id, name)
);
CREATE TABLE public.festival_artist_plan_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  festival_company_id uuid NOT NULL REFERENCES public.festival_companies(id),
  caller_profile_id uuid NOT NULL REFERENCES public.profiles(id),
  target_entity_id uuid,
  action text NOT NULL,
  idempotency_key uuid NOT NULL,
  payload_hash text NOT NULL,
  result jsonb,
  status text NOT NULL DEFAULT 'processing' CHECK (status IN ('processing','succeeded')),
  created_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  UNIQUE (caller_profile_id, target_entity_id, action, idempotency_key)
);

CREATE OR REPLACE FUNCTION public._caller_profile_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$ SELECT auth.uid() $$;

CREATE OR REPLACE FUNCTION public.has_role(p_user uuid, p_role public.app_role)
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT p_role = 'admin'::public.app_role
     AND p_user = '99999999-9999-4999-8999-999999999999'::uuid
$$;

INSERT INTO public.profiles(id) VALUES
  ('11111111-1111-4111-8111-111111111111'),
  ('22222222-2222-4222-8222-222222222222'),
  ('99999999-9999-4999-8999-999999999999');
INSERT INTO public.cities(id, name, country, timezone) VALUES
  ('33333333-3333-4333-8333-333333333333', 'London', 'United Kingdom', 'Europe/London'),
  ('44444444-4444-4444-8444-444444444444', 'Manchester', 'United Kingdom', 'Europe/London');
INSERT INTO public.festival_companies(id, owner_profile_id, public_name) VALUES
  ('55555555-5555-4555-8555-555555555555', '11111111-1111-4111-8111-111111111111', 'RockMundo Festival');
INSERT INTO public.festival_scale_catalogue VALUES
  ('small', 1000, 5000, 2, 3, 5000, 7500, true, false),
  ('medium', 5000, 20000, 2, 4, 18000, 35000, true, true);
INSERT INTO public.festival_editions_v2(
  id, festival_company_id, edition_year, name, starts_on, ends_on, city_id,
  site_type, festival_scale, expected_capacity,
  estimated_operating_cost_minor, planning_effects
) VALUES
  (
    '66666666-6666-4666-8666-666666666666',
    '55555555-5555-4555-8555-555555555555',
    3, 'RockMundo Festival 3', current_date + 40, current_date + 42,
    '33333333-3333-4333-8333-333333333333', 'outdoor', 'small', 4000,
    18000000, '{"marketingDemandBasisPoints":11250}'::jsonb
  ),
  (
    '77777777-7777-4777-8777-777777777777',
    '55555555-5555-4555-8555-555555555555',
    4, 'RockMundo Festival 4', current_date + 80, current_date + 81,
    '44444444-4444-4444-8444-444444444444', 'mixed', 'medium', 12000,
    50000000, '{"marketingDemandBasisPoints":10000}'::jsonb
  );
INSERT INTO public.festival_configurations(
  id, festival_company_id, festival_edition_id
) VALUES (
  '88888888-8888-4888-8888-888888888888',
  '55555555-5555-4555-8555-555555555555',
  '66666666-6666-4666-8666-666666666666'
);

-- Existing annual edition 4 plans are intentionally manual and must be retained.
INSERT INTO public.festival_site_plans(
  id, festival_company_id, festival_edition_id, configuration_id,
  site_source, site_name, site_type, city_id, timezone,
  total_capacity, usable_capacity, reserved_capacity,
  daily_open_time, daily_close_time, status
) VALUES (
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  '55555555-5555-4555-8555-555555555555',
  '77777777-7777-4777-8777-777777777777',
  '88888888-8888-4888-8888-888888888888',
  'mixed_site', 'Manual Manchester Site', 'mixed',
  '44444444-4444-4444-8444-444444444444', 'Europe/London',
  13000, 12000, 1000, time '10:00', time '23:00', 'ready_for_ticketing'
);
INSERT INTO public.festival_ticket_plans(
  id, festival_company_id, festival_edition_id, festival_site_plan_id,
  currency_code, status, planning_version, forecast
) VALUES (
  'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
  '55555555-5555-4555-8555-555555555555',
  '77777777-7777-4777-8777-777777777777',
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  'GBP', 'ready_for_artist_planning', 7,
  '{"manual":true}'::jsonb
);

\ir ../migrations/20291218245500_festival_edition_internal_projections.sql

DO $$
DECLARE
  generated_site uuid;
  generated_ticket uuid;
  generated_product uuid;
  result jsonb;
  replay jsonb;
  version_before integer;
BEGIN
  IF (SELECT count(*) FROM public.festival_site_plans) <> 2 THEN
    RAISE EXCEPTION 'expected one site plan per annual edition';
  END IF;
  IF (SELECT count(*) FROM public.festival_ticket_plans) <> 2 THEN
    RAISE EXCEPTION 'expected one ticket plan per annual edition';
  END IF;

  SELECT id INTO generated_site
  FROM public.festival_site_plans
  WHERE festival_edition_id = '66666666-6666-4666-8666-666666666666';
  SELECT id INTO generated_ticket
  FROM public.festival_ticket_plans
  WHERE festival_edition_id = '66666666-6666-4666-8666-666666666666';

  IF generated_site IS NULL OR generated_ticket IS NULL THEN
    RAISE EXCEPTION 'complete annual edition was not materialised';
  END IF;
  IF (SELECT projection_source FROM public.festival_site_plans WHERE id = generated_site) <> 'annual_plan'
     OR (SELECT projection_source FROM public.festival_ticket_plans WHERE id = generated_ticket) <> 'annual_plan' THEN
    RAISE EXCEPTION 'generated foundations are not identified';
  END IF;
  IF (SELECT count(*) FROM public.festival_site_plan_stages WHERE festival_site_plan_id = generated_site) <> 2 THEN
    RAISE EXCEPTION 'generated stage count does not follow scale';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.festival_site_plan_stages
    WHERE festival_site_plan_id = generated_site AND stage_type = 'main'
  ) THEN
    RAISE EXCEPTION 'generated site is missing a Main Stage';
  END IF;

  SELECT id INTO generated_product
  FROM public.festival_ticket_products
  WHERE festival_ticket_plan_id = generated_ticket
    AND slug = 'standard-festival-ticket';
  IF generated_product IS NULL THEN
    RAISE EXCEPTION 'generated standard ticket is missing';
  END IF;
  IF (SELECT count(*) FROM public.festival_ticket_capacity_allocations WHERE festival_ticket_product_id = generated_product) <> 3 THEN
    RAISE EXCEPTION 'generated daily allocations are incomplete';
  END IF;

  IF (SELECT site_name FROM public.festival_site_plans WHERE id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa') <> 'Manual Manchester Site'
     OR (SELECT projection_source FROM public.festival_site_plans WHERE id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa') <> 'manual'
     OR (SELECT planning_version FROM public.festival_ticket_plans WHERE id = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb') <> 7
     OR (SELECT projection_source FROM public.festival_ticket_plans WHERE id = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb') <> 'manual' THEN
    RAISE EXCEPTION 'manual annual plans were overwritten';
  END IF;

  PERFORM set_config('request.jwt.claim.sub', '11111111-1111-4111-8111-111111111111', false);
  result := public.get_festival_edition_ticket_plan(
    '55555555-5555-4555-8555-555555555555',
    '66666666-6666-4666-8666-666666666666'
  );
  IF (result->>'usableSiteCapacity')::integer <> 4000
     OR jsonb_array_length(result->'festivalDates') <> 3 THEN
    RAISE EXCEPTION 'exact-edition ticket read returned the wrong foundation';
  END IF;
  version_before := (result->>'planningVersion')::integer;

  result := public.save_festival_edition_ticket_plan(
    '55555555-5555-4555-8555-555555555555',
    '66666666-6666-4666-8666-666666666666',
    version_before,
    jsonb_build_object('expectedSellThroughBasisPoints', 8500),
    jsonb_build_array(jsonb_build_object(
      'productClass', 'admission', 'active', true, 'salePriority', 0,
      'priceMinor', 6500, 'capacityLimit', 3500
    )),
    '[]'::jsonb,
    '[]'::jsonb,
    'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
    true
  );
  IF (result->>'planningVersion')::integer <> version_before + 1 THEN
    RAISE EXCEPTION 'ticket plan version did not increment';
  END IF;
  IF (SELECT price_minor FROM public.festival_ticket_products WHERE id = generated_product) <> 6500
     OR (SELECT capacity_limit FROM public.festival_ticket_products WHERE id = generated_product) <> 3500 THEN
    RAISE EXCEPTION 'simple ticket choices were not persisted';
  END IF;
  IF (SELECT planning_version FROM public.festival_ticket_plans WHERE id = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb') <> 7 THEN
    RAISE EXCEPTION 'ticket save changed a different annual edition';
  END IF;

  replay := public.save_festival_edition_ticket_plan(
    '55555555-5555-4555-8555-555555555555',
    '66666666-6666-4666-8666-666666666666',
    version_before,
    jsonb_build_object('expectedSellThroughBasisPoints', 8500),
    jsonb_build_array(jsonb_build_object(
      'productClass', 'admission', 'active', true, 'salePriority', 0,
      'priceMinor', 6500, 'capacityLimit', 3500
    )),
    '[]'::jsonb,
    '[]'::jsonb,
    'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
    true
  );
  IF replay <> result THEN
    RAISE EXCEPTION 'ticket idempotent replay changed the result';
  END IF;
END
$$;

DO $$
BEGIN
  BEGIN
    PERFORM public.save_festival_edition_ticket_plan(
      '55555555-5555-4555-8555-555555555555',
      '66666666-6666-4666-8666-666666666666',
      1,
      jsonb_build_object('expectedSellThroughBasisPoints', 8000),
      jsonb_build_array(jsonb_build_object(
        'productClass', 'admission', 'active', true, 'salePriority', 0,
        'priceMinor', 6000, 'capacityLimit', 3000
      )),
      '[]'::jsonb, '[]'::jsonb,
      'dddddddd-dddd-4ddd-8ddd-dddddddddddd', false
    );
    RAISE EXCEPTION 'stale ticket version was accepted';
  EXCEPTION WHEN SQLSTATE 'P0001' THEN
    IF SQLERRM NOT LIKE '%festival_ticket_plan_stale%' THEN RAISE; END IF;
  END;
END
$$;

DO $$
DECLARE
  result jsonb;
  replay jsonb;
  opens_at timestamptz := now() + interval '1 day';
  closes_at timestamptz := now() + interval '10 days';
BEGIN
  result := public.save_festival_edition_artist_programme(
    '55555555-5555-4555-8555-555555555555',
    '66666666-6666-4666-8666-666666666666',
    0,
    jsonb_build_object(
      'applicationMode', 'hybrid',
      'applicationsOpenAt', opens_at,
      'applicationsCloseAt', closes_at,
      'minimumArtistFame', 50,
      'maximumArtistFame', null,
      'preferredGenres', jsonb_build_array('rock', 'indie'),
      'excludedGenres', '[]'::jsonb,
      'artistBudgetMinor', 3000000,
      'contingencyBudgetMinor', 300000,
      'minimumPlayerArtistShareBasisPoints', 2500
    ),
    jsonb_build_array(jsonb_build_object(
      'name', 'General Festival applications',
      'opensAt', opens_at,
      'closesAt', closes_at,
      'eligibleArtistType', 'player_only',
      'minimumFame', 50,
      'maximumFame', null,
      'preferredGenres', jsonb_build_array('rock', 'indie'),
      'minimumBandMembers', null,
      'maximumBandMembers', null,
      'targetStageTypes', '[]'::jsonb,
      'maximumSetMinutes', 60
    )),
    'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
    false
  );
  IF (result->'programme'->>'artistBudgetMinor')::bigint <> 3000000
     OR (result->>'planningVersion')::integer <> 1 THEN
    RAISE EXCEPTION 'exact-edition line-up choices were not persisted';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.festival_artist_programmes
    WHERE festival_edition_id = '77777777-7777-4777-8777-777777777777'
  ) THEN
    RAISE EXCEPTION 'line-up save changed a different annual edition';
  END IF;

  replay := public.save_festival_edition_artist_programme(
    '55555555-5555-4555-8555-555555555555',
    '66666666-6666-4666-8666-666666666666',
    0,
    jsonb_build_object(
      'applicationMode', 'hybrid',
      'applicationsOpenAt', opens_at,
      'applicationsCloseAt', closes_at,
      'minimumArtistFame', 50,
      'maximumArtistFame', null,
      'preferredGenres', jsonb_build_array('rock', 'indie'),
      'excludedGenres', '[]'::jsonb,
      'artistBudgetMinor', 3000000,
      'contingencyBudgetMinor', 300000,
      'minimumPlayerArtistShareBasisPoints', 2500
    ),
    jsonb_build_array(jsonb_build_object(
      'name', 'General Festival applications',
      'opensAt', opens_at,
      'closesAt', closes_at,
      'eligibleArtistType', 'player_only',
      'minimumFame', 50,
      'maximumFame', null,
      'preferredGenres', jsonb_build_array('rock', 'indie'),
      'minimumBandMembers', null,
      'maximumBandMembers', null,
      'targetStageTypes', '[]'::jsonb,
      'maximumSetMinutes', 60
    )),
    'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
    false
  );
  IF replay <> result THEN
    RAISE EXCEPTION 'artist idempotent replay changed the result';
  END IF;
END
$$;

DO $$
BEGIN
  PERFORM set_config('request.jwt.claim.sub', '22222222-2222-4222-8222-222222222222', false);
  BEGIN
    PERFORM public.get_festival_edition_ticket_plan(
      '55555555-5555-4555-8555-555555555555',
      '66666666-6666-4666-8666-666666666666'
    );
    RAISE EXCEPTION 'non-owner ticket read was accepted';
  EXCEPTION WHEN SQLSTATE 'P0001' THEN
    IF SQLERRM NOT LIKE '%festival_ticket_plan_forbidden%' THEN RAISE; END IF;
  END;
END
$$;

DO $$
BEGIN
  IF has_function_privilege('anon', 'public.get_festival_edition_ticket_plan(uuid,uuid)', 'EXECUTE') THEN
    RAISE EXCEPTION 'anon unexpectedly has projection RPC access';
  END IF;
  IF NOT has_function_privilege('authenticated', 'public.get_festival_edition_ticket_plan(uuid,uuid)', 'EXECUTE')
     OR NOT has_function_privilege('authenticated', 'public.save_festival_edition_artist_programme(uuid,uuid,integer,jsonb,jsonb,uuid,boolean)', 'EXECUTE') THEN
    RAISE EXCEPTION 'authenticated projection RPC grant is missing';
  END IF;
END
$$;
