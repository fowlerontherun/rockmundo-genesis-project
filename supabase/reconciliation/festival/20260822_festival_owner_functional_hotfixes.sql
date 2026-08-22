-- Production parity for Festival owner-flow defects discovered during the
-- 2026-08-22 end-to-end functional certification.
--
-- This file runs only after the inherited 2029 Festival sequence has bootstrapped
-- a disposable/clean database. Production received equivalent forward migrations
-- with real 2026 versions recorded in the reconciliation ledger.

CREATE OR REPLACE FUNCTION public.save_festival_edition_annual_plan(
  p_festival_company_id uuid,
  p_festival_edition_id uuid,
  p_expected_version integer,
  p_plan jsonb,
  p_idempotency_key uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO pg_catalog, public, extensions
AS $$
DECLARE
  actor uuid := public._caller_profile_id();
  edition public.festival_editions_v2%ROWTYPE;
  request public.festival_annual_plan_requests%ROWTYPE;
  payload_hash text;
  start_date date;
  end_date date;
  duration integer;
  selected_month integer;
  v_city_id uuid;
  scale_key text;
  vibe_key text;
  site_key text;
  environmental_key text;
  marketing_key text;
  capacity integer;
  estimated_cost bigint;
  blockers jsonb;
  readiness integer;
  effects jsonb;
  response jsonb;
BEGIN
  IF auth.uid() IS NULL OR actor IS NULL
     OR NOT public._festival_company_manager_authorized(p_festival_company_id, actor) THEN
    RAISE EXCEPTION 'festival_annual_plan_forbidden' USING ERRCODE='P0001';
  END IF;

  PERFORM pg_advisory_xact_lock(
    hashtextextended(p_festival_edition_id::text || p_idempotency_key::text, 0)
  );

  SELECT * INTO edition
  FROM public.festival_editions_v2
  WHERE id = p_festival_edition_id
    AND festival_company_id = p_festival_company_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'festival_annual_plan_not_found' USING ERRCODE='P0001';
  END IF;
  IF edition.status IN ('completed','cancelled') OR edition.locked_at IS NOT NULL THEN
    RAISE EXCEPTION 'festival_annual_plan_locked' USING ERRCODE='P0001';
  END IF;

  payload_hash := encode(
    digest(
      jsonb_build_object(
        'editionId', p_festival_edition_id,
        'expectedVersion', p_expected_version,
        'plan', p_plan
      )::text,
      'sha256'
    ),
    'hex'
  );

  SELECT * INTO request
  FROM public.festival_annual_plan_requests
  WHERE festival_edition_id = p_festival_edition_id
    AND actor_profile_id = actor
    AND idempotency_key = p_idempotency_key
  FOR UPDATE;

  IF FOUND THEN
    IF request.payload_hash <> payload_hash THEN
      RAISE EXCEPTION 'festival_annual_plan_idempotency_conflict' USING ERRCODE='P0001';
    END IF;
    IF request.status = 'succeeded' THEN
      RETURN request.result;
    END IF;
  ELSE
    INSERT INTO public.festival_annual_plan_requests(
      festival_company_id,
      festival_edition_id,
      actor_profile_id,
      idempotency_key,
      payload_hash
    ) VALUES (
      p_festival_company_id,
      p_festival_edition_id,
      actor,
      p_idempotency_key,
      payload_hash
    )
    RETURNING * INTO request;
  END IF;

  IF edition.version <> p_expected_version THEN
    RAISE EXCEPTION 'festival_annual_plan_stale' USING ERRCODE='P0001';
  END IF;

  start_date := nullif(p_plan->>'startsOn','')::date;
  duration := nullif(p_plan->>'durationDays','')::integer;
  selected_month := nullif(p_plan->>'preferredMonth','')::integer;
  v_city_id := nullif(p_plan->>'cityId','')::uuid;
  scale_key := nullif(p_plan->>'festivalScale','');
  vibe_key := nullif(p_plan->>'vibe','');
  site_key := nullif(p_plan->>'siteType','');
  environmental_key := coalesce(nullif(p_plan->>'environmentalPolicy',''),'standard');
  marketing_key := coalesce(nullif(p_plan->>'marketingEmphasis',''),'balanced');

  IF start_date IS NULL OR duration IS NULL OR selected_month IS NULL
     OR v_city_id IS NULL OR scale_key IS NULL OR vibe_key IS NULL OR site_key IS NULL THEN
    RAISE EXCEPTION 'festival_annual_plan_invalid' USING ERRCODE='P0001';
  END IF;
  IF start_date < current_date
     OR selected_month NOT BETWEEN 1 AND 12
     OR extract(month FROM start_date)::integer <> selected_month THEN
    RAISE EXCEPTION 'festival_annual_plan_dates_invalid' USING ERRCODE='P0001';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.cities c WHERE c.id = v_city_id)
     OR NOT EXISTS (
       SELECT 1
       FROM public.festival_scale_catalogue s
       WHERE s.key = scale_key
         AND s.active
         AND duration BETWEEN 1 AND s.maximum_duration_days
     )
     OR NOT EXISTS (SELECT 1 FROM public.festival_vibe_catalogue v WHERE v.key = vibe_key AND v.active)
     OR NOT EXISTS (SELECT 1 FROM public.festival_site_type_catalogue s WHERE s.key = site_key AND s.active)
     OR NOT EXISTS (SELECT 1 FROM public.festival_environmental_policy_catalogue e WHERE e.key = environmental_key AND e.active)
     OR NOT EXISTS (SELECT 1 FROM public.festival_marketing_emphasis_catalogue m WHERE m.key = marketing_key AND m.active) THEN
    RAISE EXCEPTION 'festival_annual_plan_invalid' USING ERRCODE='P0001';
  END IF;

  end_date := start_date + (duration - 1);
  capacity := public._festival_annual_plan_capacity(p_festival_company_id, scale_key);
  estimated_cost := public._festival_annual_plan_cost(
    p_festival_company_id,
    scale_key,
    site_key,
    environmental_key,
    marketing_key,
    duration,
    capacity
  );
  effects := jsonb_build_object(
    'capacity', capacity,
    'estimatedOperatingCostMinor', estimated_cost,
    'marketingDemandBasisPoints', (
      SELECT m.demand_basis_points
      FROM public.festival_marketing_emphasis_catalogue m
      WHERE m.key = marketing_key
    ),
    'marketingCostBasisPoints', (
      SELECT m.cost_basis_points
      FROM public.festival_marketing_emphasis_catalogue m
      WHERE m.key = marketing_key
    ),
    'marketingReputationBasisPoints', (
      SELECT m.reputation_basis_points
      FROM public.festival_marketing_emphasis_catalogue m
      WHERE m.key = marketing_key
    ),
    'localArtistBasisPoints', (
      SELECT m.local_artist_basis_points
      FROM public.festival_marketing_emphasis_catalogue m
      WHERE m.key = marketing_key
    )
  );

  UPDATE public.festival_editions_v2 e
  SET starts_on = start_date,
      ends_on = end_date,
      preferred_month = selected_month,
      city_id = v_city_id,
      country_code = (SELECT c.country FROM public.cities c WHERE c.id = v_city_id),
      site_type = site_key,
      festival_scale = scale_key,
      duration_days = duration,
      vibe = vibe_key,
      environmental_policy = environmental_key,
      marketing_emphasis = marketing_key,
      expected_capacity = capacity,
      estimated_operating_cost_minor = estimated_cost,
      planning_effects = effects,
      planning_status = 'in_progress',
      readiness_score = 0,
      planning_updated_at = now(),
      version = e.version + 1
  WHERE e.id = p_festival_edition_id
    AND e.version = p_expected_version
  RETURNING e.* INTO edition;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'festival_annual_plan_stale' USING ERRCODE='P0001';
  END IF;

  blockers := public._festival_annual_plan_blockers(p_festival_company_id, edition);
  readiness := greatest(0, 100 - jsonb_array_length(blockers) * 25);

  UPDATE public.festival_editions_v2 e
  SET readiness_score = readiness,
      planning_status = CASE
        WHEN jsonb_array_length(blockers) = 0 THEN 'ready'
        ELSE 'in_progress'
      END
  WHERE e.id = edition.id
  RETURNING e.* INTO edition;

  INSERT INTO public.festival_edition_audit(
    festival_company_id,
    festival_edition_id,
    actor_profile_id,
    event_type,
    previous_version,
    new_version,
    metadata
  ) VALUES (
    p_festival_company_id,
    p_festival_edition_id,
    actor,
    'simplified_annual_plan_updated',
    p_expected_version,
    edition.version,
    jsonb_build_object(
      'startsOn', start_date,
      'endsOn', end_date,
      'festivalScale', scale_key,
      'expectedCapacity', capacity,
      'estimatedOperatingCostMinor', estimated_cost,
      'readinessScore', readiness,
      'blockers', blockers
    )
  );

  response := public._festival_annual_plan_result(
    p_festival_company_id,
    p_festival_edition_id
  );
  UPDATE public.festival_annual_plan_requests
  SET status = 'succeeded',
      result = response,
      completed_at = now()
  WHERE id = request.id;

  RETURN response;
END
$$;

ALTER FUNCTION public._festival_artist_begin(uuid, text, text, uuid, uuid, jsonb)
  SET search_path TO pg_catalog, public, extensions;

-- Some retained artist response RPCs still use the historical `completed`
-- terminal value, while the edition-native flow uses `succeeded`. Both are
-- active parts of the simplified owner/artist loop.
ALTER TABLE public.festival_artist_plan_requests
  DROP CONSTRAINT IF EXISTS festival_artist_plan_requests_status_check;
ALTER TABLE public.festival_artist_plan_requests
  ADD CONSTRAINT festival_artist_plan_requests_status_check
  CHECK (status IN ('processing', 'succeeded', 'completed'));

-- The inherited chain has carried more than one plan-next signature. Whichever
-- overload survives bootstrap must be able to resolve pgcrypto safely.
DO $$
DECLARE
  fn regprocedure;
BEGIN
  FOR fn IN
    SELECT p.oid::regprocedure
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname = 'plan_next_festival_edition'
  LOOP
    EXECUTE format(
      'ALTER FUNCTION %s SET search_path TO pg_catalog, public, extensions',
      fn
    );
  END LOOP;
END
$$;

CREATE OR REPLACE FUNCTION public._festival_upgrade_state(p_festival_company_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_fc public.festival_companies%ROWTYPE;
  v_currency text;
BEGIN
  SELECT * INTO v_fc
  FROM public.festival_companies
  WHERE id = p_festival_company_id;

  v_currency := coalesce(
    public._festival_projection_currency(v_fc.default_city_id),
    'GBP'
  );

  RETURN jsonb_build_object(
    'festivalCompanyId', v_fc.id,
    'catalogueVersion', 2,
    'companyVersion', coalesce(v_fc.upgrade_version,0),
    'currencyCode', v_currency,
    'availableBalanceMinor', public._festival_company_balance_minor(p_festival_company_id),
    'purchaseWindow', public._festival_upgrade_window(p_festival_company_id),
    'categories', (
      SELECT jsonb_agg(
        public._festival_upgrade_category_json(p_festival_company_id, c.key)
        ORDER BY c.display_order
      )
      FROM public.festival_upgrade_categories c
      WHERE c.active
    ),
    'licence', public.get_festival_licence_progress(p_festival_company_id)
  );
END
$$;

NOTIFY pgrst, 'reload schema';
