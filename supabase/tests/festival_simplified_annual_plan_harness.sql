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

CREATE TABLE public.profiles (
  id uuid PRIMARY KEY
);

CREATE TABLE public.companies (
  id uuid PRIMARY KEY,
  name text NOT NULL
);

CREATE TABLE public.cities (
  id uuid PRIMARY KEY,
  name text NOT NULL,
  country text NOT NULL,
  timezone text NOT NULL
);

CREATE TABLE public.festival_vibe_catalogue (
  key text PRIMARY KEY,
  display_name text NOT NULL,
  description text NOT NULL,
  sort_order smallint UNIQUE NOT NULL,
  active boolean NOT NULL DEFAULT true
);

CREATE TABLE public.festival_site_type_catalogue (
  key text PRIMARY KEY,
  display_name text NOT NULL,
  description text NOT NULL,
  sort_order smallint UNIQUE NOT NULL,
  active boolean NOT NULL DEFAULT true
);

CREATE TABLE public.festival_environmental_policy_catalogue (
  key text PRIMARY KEY,
  display_name text NOT NULL,
  description text NOT NULL,
  sort_order smallint UNIQUE NOT NULL,
  active boolean NOT NULL DEFAULT true
);

CREATE TABLE public.festival_scale_catalogue (
  key text PRIMARY KEY,
  display_name text NOT NULL,
  description text NOT NULL,
  minimum_capacity integer NOT NULL,
  maximum_capacity integer NOT NULL,
  maximum_duration_days smallint NOT NULL,
  complexity text NOT NULL,
  sort_order smallint UNIQUE NOT NULL,
  active boolean NOT NULL DEFAULT true,
  minimum_site_capacity integer NOT NULL,
  maximum_site_capacity integer NOT NULL
);

CREATE TABLE public.festival_companies (
  id uuid PRIMARY KEY,
  company_id uuid NOT NULL REFERENCES public.companies(id),
  owner_profile_id uuid NOT NULL REFERENCES public.profiles(id),
  public_name text NOT NULL,
  status text NOT NULL DEFAULT 'active',
  setup_completed boolean NOT NULL DEFAULT true,
  annual_month smallint,
  country_code text,
  default_city_id uuid REFERENCES public.cities(id),
  default_vibe text REFERENCES public.festival_vibe_catalogue(key),
  default_site_type text REFERENCES public.festival_site_type_catalogue(key),
  default_duration_days smallint,
  environmental_policy text REFERENCES public.festival_environmental_policy_catalogue(key)
);

CREATE TABLE public.festival_editions_v2 (
  id uuid PRIMARY KEY,
  festival_company_id uuid NOT NULL REFERENCES public.festival_companies(id),
  edition_year integer NOT NULL,
  name text NOT NULL,
  status text NOT NULL DEFAULT 'draft',
  starts_on date,
  ends_on date,
  country_code text,
  city_id uuid REFERENCES public.cities(id),
  vibe text REFERENCES public.festival_vibe_catalogue(key),
  site_type text REFERENCES public.festival_site_type_catalogue(key),
  duration_days smallint,
  environmental_policy text REFERENCES public.festival_environmental_policy_catalogue(key),
  festival_scale text REFERENCES public.festival_scale_catalogue(key),
  expected_capacity integer,
  version integer NOT NULL DEFAULT 1,
  locked_at timestamptz,
  creation_source text NOT NULL DEFAULT 'next_annual'
);

CREATE TABLE public.festival_configurations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  festival_company_id uuid NOT NULL REFERENCES public.festival_companies(id),
  festival_edition_id uuid REFERENCES public.festival_editions_v2(id),
  festival_scale text REFERENCES public.festival_scale_catalogue(key)
);

CREATE TABLE public.festival_site_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  festival_company_id uuid NOT NULL REFERENCES public.festival_companies(id),
  festival_edition_id uuid REFERENCES public.festival_editions_v2(id)
);
CREATE TABLE public.festival_ticket_plans (LIKE public.festival_site_plans INCLUDING ALL);
CREATE TABLE public.festival_artist_programmes (LIKE public.festival_site_plans INCLUDING ALL);
CREATE TABLE public.festival_operations_plans (LIKE public.festival_site_plans INCLUDING ALL);
CREATE TABLE public.festival_sponsorship_plans (LIKE public.festival_site_plans INCLUDING ALL);
CREATE TABLE public.festival_timetable_plans (LIKE public.festival_site_plans INCLUDING ALL);

CREATE TABLE public.festival_upgrade_catalogue_versions (
  version integer PRIMARY KEY,
  status text NOT NULL,
  retired_at timestamptz
);

CREATE TABLE public.festival_upgrade_levels (
  catalogue_version integer NOT NULL,
  category_key text NOT NULL,
  level integer NOT NULL,
  active boolean NOT NULL DEFAULT true,
  retired_at timestamptz
);

CREATE TABLE public.festival_company_upgrades (
  festival_company_id uuid NOT NULL REFERENCES public.festival_companies(id),
  category_key text NOT NULL,
  owned_level integer NOT NULL,
  active_level integer NOT NULL,
  missed_upkeep_weeks integer NOT NULL DEFAULT 0
);

CREATE TABLE public.festival_licence_tiers (
  key text PRIMARY KEY,
  max_attendance integer NOT NULL,
  max_days smallint NOT NULL
);

CREATE TABLE public.festival_company_licences (
  festival_company_id uuid NOT NULL REFERENCES public.festival_companies(id),
  tier_key text NOT NULL REFERENCES public.festival_licence_tiers(key),
  status text NOT NULL,
  valid_from timestamptz,
  valid_until timestamptz
);

CREATE TABLE public.festival_edition_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  festival_company_id uuid NOT NULL REFERENCES public.festival_companies(id),
  festival_edition_id uuid NOT NULL REFERENCES public.festival_editions_v2(id),
  actor_profile_id uuid REFERENCES public.profiles(id),
  event_type text NOT NULL,
  previous_version integer,
  new_version integer NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE OR REPLACE FUNCTION public._caller_profile_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT auth.uid()
$$;

CREATE OR REPLACE FUNCTION public.has_role(p_user uuid, p_role public.app_role)
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT p_role = 'admin'::public.app_role
     AND p_user = '99999999-9999-4999-8999-999999999999'::uuid
$$;

CREATE OR REPLACE FUNCTION public._festival_effective_level(
  owned integer,
  active integer,
  missed integer
)
RETURNS integer
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE WHEN missed >= 4 THEN greatest(0, least(active, owned - 10)) ELSE active END
$$;

CREATE OR REPLACE FUNCTION public.rockmundo_game_year(p_at timestamptz DEFAULT now())
RETURNS integer
LANGUAGE sql
STABLE
AS $$
  SELECT 3
$$;

INSERT INTO public.profiles(id) VALUES
  ('11111111-1111-4111-8111-111111111111'),
  ('22222222-2222-4222-8222-222222222222'),
  ('99999999-9999-4999-8999-999999999999');
INSERT INTO public.companies(id, name) VALUES
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'Festival Holdings');
INSERT INTO public.cities(id, name, country, timezone) VALUES
  ('33333333-3333-4333-8333-333333333333', 'London', 'United Kingdom', 'Europe/London'),
  ('44444444-4444-4444-8444-444444444444', 'Manchester', 'United Kingdom', 'Europe/London');
INSERT INTO public.festival_vibe_catalogue VALUES
  ('community', 'Community', 'Welcoming and locally rooted.', 1, true),
  ('alternative', 'Alternative', 'Independent and discovery-led.', 2, true);
INSERT INTO public.festival_site_type_catalogue VALUES
  ('indoor', 'Indoor', 'Weather protected.', 1, true),
  ('outdoor', 'Outdoor', 'Open-air Festival.', 2, true),
  ('mixed', 'Mixed', 'Indoor and outdoor.', 3, true);
INSERT INTO public.festival_environmental_policy_catalogue VALUES
  ('standard', 'Standard', 'Baseline policy.', 1, true),
  ('responsible', 'Responsible', 'Reduced impact.', 2, true),
  ('regenerative', 'Regenerative', 'Positive impact.', 3, true);
INSERT INTO public.festival_scale_catalogue VALUES
  ('local', 'Local', 'Community scale.', 500, 2500, 2, 'Low', 1, true, 500, 1000),
  ('small', 'Small', 'Regional scale.', 2000, 7500, 3, 'Moderate', 2, true, 1000, 5000),
  ('medium', 'Medium', 'Destination scale.', 6000, 20000, 4, 'High', 3, true, 5000, 20000);
INSERT INTO public.festival_companies(
  id, company_id, owner_profile_id, public_name, annual_month, country_code,
  default_city_id, default_vibe, default_site_type, default_duration_days,
  environmental_policy
) VALUES (
  '55555555-5555-4555-8555-555555555555',
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  '11111111-1111-4111-8111-111111111111',
  'RockMundo Festival', 8, 'United Kingdom',
  '33333333-3333-4333-8333-333333333333',
  'alternative', 'outdoor', 2, 'responsible'
);
INSERT INTO public.festival_editions_v2(
  id, festival_company_id, edition_year, name, status, city_id, vibe,
  site_type, duration_days, environmental_policy, festival_scale
) VALUES
  ('66666666-6666-4666-8666-666666666666', '55555555-5555-4555-8555-555555555555', 3, 'RockMundo Festival', 'draft', '33333333-3333-4333-8333-333333333333', 'alternative', 'outdoor', 2, 'responsible', 'small'),
  ('77777777-7777-4777-8777-777777777777', '55555555-5555-4555-8555-555555555555', 4, 'RockMundo Festival', 'draft', '44444444-4444-4444-8444-444444444444', 'community', 'mixed', 1, 'standard', 'local'),
  ('88888888-8888-4888-8888-888888888888', '55555555-5555-4555-8555-555555555555', 5, 'RockMundo Festival', 'draft', '33333333-3333-4333-8333-333333333333', 'alternative', 'outdoor', 2, 'responsible', 'small');
UPDATE public.festival_editions_v2
SET locked_at = now()
WHERE id = '88888888-8888-4888-8888-888888888888';
INSERT INTO public.festival_configurations(festival_company_id, festival_edition_id, festival_scale)
VALUES ('55555555-5555-4555-8555-555555555555', '66666666-6666-4666-8666-666666666666', 'small');
INSERT INTO public.festival_upgrade_catalogue_versions VALUES (2, 'published', NULL);
INSERT INTO public.festival_upgrade_levels(catalogue_version, category_key, level)
SELECT 2, category_key, level
FROM unnest(ARRAY[
  'site_infrastructure', 'stages_production', 'audience_facilities',
  'transport_access', 'sanitation_utilities', 'sustainability_technology'
]) category_key
CROSS JOIN generate_series(1, 50) level;
INSERT INTO public.festival_company_upgrades
SELECT '55555555-5555-4555-8555-555555555555', category_key, 25, 25, 0
FROM unnest(ARRAY[
  'site_infrastructure', 'stages_production', 'audience_facilities',
  'transport_access', 'sanitation_utilities', 'sustainability_technology'
]) category_key;
INSERT INTO public.festival_licence_tiers VALUES ('major', 120000, 7);
INSERT INTO public.festival_company_licences
VALUES ('55555555-5555-4555-8555-555555555555', 'major', 'active', now() - interval '1 day', now() + interval '1 year');

\ir ../migrations/20291218245300_festival_simplified_annual_plan.sql

DO $$
DECLARE
  result jsonb;
  replay jsonb;
  future_start date := current_date + 30;
  future_month integer;
  first_version integer;
BEGIN
  future_month := extract(month FROM future_start)::integer;
  PERFORM set_config('request.jwt.claim.sub', '11111111-1111-4111-8111-111111111111', false);

  result := public.get_festival_edition_annual_plan(
    '55555555-5555-4555-8555-555555555555',
    '66666666-6666-4666-8666-666666666666'
  );
  IF result->>'festivalEditionId' <> '66666666-6666-4666-8666-666666666666' THEN
    RAISE EXCEPTION 'read returned wrong annual edition';
  END IF;
  first_version := (result->>'version')::integer;

  result := public.save_festival_edition_annual_plan(
    '55555555-5555-4555-8555-555555555555',
    '66666666-6666-4666-8666-666666666666',
    first_version,
    jsonb_build_object(
      'startsOn', future_start,
      'preferredMonth', future_month,
      'cityId', '33333333-3333-4333-8333-333333333333',
      'siteType', 'outdoor',
      'festivalScale', 'small',
      'durationDays', 3,
      'vibe', 'alternative',
      'environmentalPolicy', 'responsible',
      'marketingEmphasis', 'digital_buzz'
    ),
    'aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa'
  );

  IF (result->>'version')::integer <> first_version + 1 THEN
    RAISE EXCEPTION 'version was not incremented';
  END IF;
  IF (result->>'startsOn')::date <> future_start
     OR (result->>'endsOn')::date <> future_start + 2 THEN
    RAISE EXCEPTION 'dates were not derived correctly';
  END IF;
  IF (result->>'expectedCapacity')::integer NOT BETWEEN 1000 AND 5000 THEN
    RAISE EXCEPTION 'capacity was not derived inside scale bounds';
  END IF;
  IF (result->>'estimatedOperatingCostMinor')::bigint <= 0 THEN
    RAISE EXCEPTION 'operating cost was not derived';
  END IF;
  IF result->>'planningStatus' <> 'ready' OR (result->>'readinessScore')::integer <> 100 THEN
    RAISE EXCEPTION 'licensed annual plan should be ready';
  END IF;
  IF jsonb_array_length(result->'blockers') <> 0 THEN
    RAISE EXCEPTION 'licensed annual plan unexpectedly has blockers';
  END IF;

  replay := public.save_festival_edition_annual_plan(
    '55555555-5555-4555-8555-555555555555',
    '66666666-6666-4666-8666-666666666666',
    first_version,
    jsonb_build_object(
      'startsOn', future_start,
      'preferredMonth', future_month,
      'cityId', '33333333-3333-4333-8333-333333333333',
      'siteType', 'outdoor',
      'festivalScale', 'small',
      'durationDays', 3,
      'vibe', 'alternative',
      'environmentalPolicy', 'responsible',
      'marketingEmphasis', 'digital_buzz'
    ),
    'aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa'
  );
  IF replay <> result THEN
    RAISE EXCEPTION 'idempotent replay changed the result';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.festival_editions_v2
    WHERE id = '77777777-7777-4777-8777-777777777777'
      AND (starts_on IS NOT NULL OR planning_updated_at IS NOT NULL)
  ) THEN
    RAISE EXCEPTION 'saving one edition changed another edition';
  END IF;

  IF EXISTS (SELECT 1 FROM public.festival_operations_plans)
     OR EXISTS (SELECT 1 FROM public.festival_timetable_plans)
     OR EXISTS (SELECT 1 FROM public.festival_sponsorship_plans) THEN
    RAISE EXCEPTION 'annual plan created operational administration records';
  END IF;
END
$$;

DO $$
BEGIN
  PERFORM set_config('request.jwt.claim.sub', '11111111-1111-4111-8111-111111111111', false);
  BEGIN
    PERFORM public.save_festival_edition_annual_plan(
      '55555555-5555-4555-8555-555555555555',
      '66666666-6666-4666-8666-666666666666',
      1,
      jsonb_build_object(
        'startsOn', current_date + 40,
        'preferredMonth', extract(month FROM current_date + 40)::integer,
        'cityId', '33333333-3333-4333-8333-333333333333',
        'siteType', 'outdoor', 'festivalScale', 'small', 'durationDays', 2,
        'vibe', 'alternative', 'environmentalPolicy', 'responsible',
        'marketingEmphasis', 'balanced'
      ),
      'bbbbbbbb-1111-4111-8111-bbbbbbbbbbbb'
    );
    RAISE EXCEPTION 'stale version unexpectedly succeeded';
  EXCEPTION WHEN SQLSTATE 'P0001' THEN
    IF SQLERRM <> 'festival_annual_plan_stale' THEN RAISE; END IF;
  END;
END
$$;

DO $$
BEGIN
  PERFORM set_config('request.jwt.claim.sub', '22222222-2222-4222-8222-222222222222', false);
  BEGIN
    PERFORM public.get_festival_edition_annual_plan(
      '55555555-5555-4555-8555-555555555555',
      '66666666-6666-4666-8666-666666666666'
    );
    RAISE EXCEPTION 'non-owner read unexpectedly succeeded';
  EXCEPTION WHEN SQLSTATE 'P0001' THEN
    IF SQLERRM <> 'festival_annual_plan_forbidden' THEN RAISE; END IF;
  END;
END
$$;

DO $$
BEGIN
  PERFORM set_config('request.jwt.claim.sub', '11111111-1111-4111-8111-111111111111', false);
  BEGIN
    PERFORM public.save_festival_edition_annual_plan(
      '55555555-5555-4555-8555-555555555555',
      '88888888-8888-4888-8888-888888888888',
      1,
      jsonb_build_object(
        'startsOn', current_date + 50,
        'preferredMonth', extract(month FROM current_date + 50)::integer,
        'cityId', '33333333-3333-4333-8333-333333333333',
        'siteType', 'outdoor', 'festivalScale', 'small', 'durationDays', 2,
        'vibe', 'alternative', 'environmentalPolicy', 'responsible',
        'marketingEmphasis', 'balanced'
      ),
      'cccccccc-1111-4111-8111-cccccccccccc'
    );
    RAISE EXCEPTION 'locked edition unexpectedly succeeded';
  EXCEPTION WHEN SQLSTATE 'P0001' THEN
    IF SQLERRM <> 'festival_annual_plan_locked' THEN RAISE; END IF;
  END;
END
$$;

DO $$
BEGIN
  IF has_function_privilege('anon', 'public.get_festival_edition_annual_plan(uuid,uuid)', 'EXECUTE') THEN
    RAISE EXCEPTION 'anon unexpectedly has annual plan execute privilege';
  END IF;
  IF NOT has_function_privilege('authenticated', 'public.get_festival_edition_annual_plan(uuid,uuid)', 'EXECUTE') THEN
    RAISE EXCEPTION 'authenticated role is missing annual plan execute privilege';
  END IF;
END
$$;

SELECT 'festival simplified annual plan harness passed' AS result;
