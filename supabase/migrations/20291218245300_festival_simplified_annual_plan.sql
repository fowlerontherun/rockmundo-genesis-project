-- Simplified, edition-native annual Festival planning.
-- The owner chooses only dates/month, city, site style, scale, duration, vibe and
-- marketing emphasis. Capacity, operating-cost projections and readiness are
-- derived by the server from those choices, the Festival licence and permanent
-- company upgrades. No staffing, supplier, permit or timetable planner is exposed.

CREATE TABLE public.festival_marketing_emphasis_catalogue (
  key text PRIMARY KEY CHECK (key ~ '^[a-z][a-z0-9_]+$'),
  display_name text NOT NULL,
  description text NOT NULL,
  demand_basis_points integer NOT NULL CHECK (demand_basis_points BETWEEN 5000 AND 20000),
  cost_basis_points integer NOT NULL CHECK (cost_basis_points BETWEEN 5000 AND 20000),
  reputation_basis_points integer NOT NULL CHECK (reputation_basis_points BETWEEN 0 AND 20000),
  local_artist_basis_points integer NOT NULL CHECK (local_artist_basis_points BETWEEN 0 AND 10000),
  sort_order smallint UNIQUE NOT NULL,
  active boolean NOT NULL DEFAULT true
);

INSERT INTO public.festival_marketing_emphasis_catalogue(
  key, display_name, description, demand_basis_points, cost_basis_points,
  reputation_basis_points, local_artist_basis_points, sort_order
) VALUES
  ('balanced', 'Balanced', 'A steady campaign across local, music press and digital channels.', 10000, 10000, 10000, 2500, 1),
  ('community', 'Community First', 'Prioritise local loyalty, partnerships and regional artists.', 9000, 8500, 11500, 6000, 2),
  ('digital_buzz', 'Digital Buzz', 'Build online momentum and reach younger audiences quickly.', 11250, 10500, 10000, 2000, 3),
  ('headline_hype', 'Headline Hype', 'Spend heavily around major acts to maximise demand.', 12500, 12500, 11000, 1000, 4),
  ('premium_experience', 'Premium Experience', 'Sell the quality, comfort and exclusivity of the event.', 10500, 11500, 12000, 1500, 5);

ALTER TABLE public.festival_marketing_emphasis_catalogue ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.festival_marketing_emphasis_catalogue FROM PUBLIC, anon, authenticated;

ALTER TABLE public.festival_editions_v2
  ADD COLUMN IF NOT EXISTS preferred_month smallint CHECK (preferred_month BETWEEN 1 AND 12),
  ADD COLUMN IF NOT EXISTS marketing_emphasis text REFERENCES public.festival_marketing_emphasis_catalogue(key),
  ADD COLUMN IF NOT EXISTS planning_status text NOT NULL DEFAULT 'not_started'
    CHECK (planning_status IN ('not_started', 'in_progress', 'ready')),
  ADD COLUMN IF NOT EXISTS readiness_score smallint NOT NULL DEFAULT 0
    CHECK (readiness_score BETWEEN 0 AND 100),
  ADD COLUMN IF NOT EXISTS estimated_operating_cost_minor bigint NOT NULL DEFAULT 0
    CHECK (estimated_operating_cost_minor >= 0),
  ADD COLUMN IF NOT EXISTS planning_effects jsonb NOT NULL DEFAULT '{}'::jsonb
    CHECK (jsonb_typeof(planning_effects) = 'object'),
  ADD COLUMN IF NOT EXISTS planning_updated_at timestamptz;

CREATE TABLE public.festival_annual_plan_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  festival_company_id uuid NOT NULL REFERENCES public.festival_companies(id) ON DELETE CASCADE,
  festival_edition_id uuid NOT NULL REFERENCES public.festival_editions_v2(id) ON DELETE CASCADE,
  actor_profile_id uuid NOT NULL REFERENCES public.profiles(id),
  idempotency_key uuid NOT NULL,
  payload_hash text NOT NULL,
  status text NOT NULL DEFAULT 'processing' CHECK (status IN ('processing', 'succeeded')),
  result jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  UNIQUE (festival_edition_id, actor_profile_id, idempotency_key)
);
ALTER TABLE public.festival_annual_plan_requests ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.festival_annual_plan_requests FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public._festival_annual_plan_upgrade_progress(
  p_festival_company_id uuid,
  p_categories text[]
)
RETURNS numeric
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH active_catalogue AS (
    SELECT version
    FROM public.festival_upgrade_catalogue_versions
    WHERE status = 'published' AND retired_at IS NULL
    ORDER BY version DESC
    LIMIT 1
  ), maximum AS (
    SELECT greatest(1, coalesce(max(level), 1))::numeric AS level
    FROM public.festival_upgrade_levels l
    JOIN active_catalogue c ON c.version = l.catalogue_version
    WHERE l.active AND l.retired_at IS NULL
  ), owned AS (
    SELECT avg(
      public._festival_effective_level(
        coalesce(u.owned_level, 0),
        coalesce(u.active_level, 0),
        coalesce(u.missed_upkeep_weeks, 0)
      )::numeric
    ) AS level
    FROM unnest(p_categories) requested(category_key)
    LEFT JOIN public.festival_company_upgrades u
      ON u.festival_company_id = p_festival_company_id
     AND u.category_key = requested.category_key
  )
  SELECT least(1::numeric, greatest(0::numeric, coalesce(owned.level, 0) / maximum.level))
  FROM owned CROSS JOIN maximum
$$;

CREATE OR REPLACE FUNCTION public._festival_annual_plan_capacity(
  p_festival_company_id uuid,
  p_scale text
)
RETURNS integer
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT round(
    scale.minimum_site_capacity
    + (scale.maximum_site_capacity - scale.minimum_site_capacity)
      * public._festival_annual_plan_upgrade_progress(
          p_festival_company_id,
          ARRAY['site_infrastructure', 'stages_production', 'audience_facilities', 'transport_access']
        )
  )::integer
  FROM public.festival_scale_catalogue scale
  WHERE scale.key = p_scale AND scale.active
$$;

CREATE OR REPLACE FUNCTION public._festival_annual_plan_cost(
  p_festival_company_id uuid,
  p_scale text,
  p_site_type text,
  p_environmental_policy text,
  p_marketing_emphasis text,
  p_duration_days integer,
  p_capacity integer
)
RETURNS bigint
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH inputs AS (
    SELECT
      CASE p_scale
        WHEN 'local' THEN 1000
        WHEN 'small' THEN 1200
        WHEN 'medium' THEN 1500
        WHEN 'large' THEN 1900
        ELSE 2400
      END::numeric AS attendee_day_minor,
      CASE p_site_type WHEN 'indoor' THEN 11500 WHEN 'mixed' THEN 10800 ELSE 10000 END::numeric AS site_bp,
      CASE p_environmental_policy WHEN 'regenerative' THEN 11500 WHEN 'responsible' THEN 10500 ELSE 10000 END::numeric AS environmental_bp,
      marketing.cost_basis_points::numeric AS marketing_bp,
      least(
        1500::numeric,
        public._festival_annual_plan_upgrade_progress(
          p_festival_company_id,
          ARRAY['site_infrastructure', 'sanitation_utilities', 'transport_access', 'sustainability_technology']
        ) * 1500
      ) AS efficiency_reduction_bp
    FROM public.festival_marketing_emphasis_catalogue marketing
    WHERE marketing.key = p_marketing_emphasis AND marketing.active
  )
  SELECT round(
    p_capacity::numeric
    * p_duration_days::numeric
    * attendee_day_minor
    * site_bp / 10000
    * environmental_bp / 10000
    * marketing_bp / 10000
    * (10000 - efficiency_reduction_bp) / 10000
  )::bigint
  FROM inputs
$$;

CREATE OR REPLACE FUNCTION public._festival_annual_plan_blockers(
  p_festival_company_id uuid,
  p_edition public.festival_editions_v2
)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH licence AS (
    SELECT
      max(tier.max_attendance) AS max_attendance,
      max(tier.max_days) AS max_days
    FROM public.festival_company_licences licence
    JOIN public.festival_licence_tiers tier ON tier.key = licence.tier_key
    WHERE licence.festival_company_id = p_festival_company_id
      AND licence.status = 'active'
      AND coalesce(licence.valid_from, '-infinity'::timestamptz) <= now()
      AND coalesce(licence.valid_until, 'infinity'::timestamptz) > now()
  ), blockers AS (
    SELECT x
    FROM licence, LATERAL (
      VALUES
        (CASE WHEN p_edition.starts_on IS NULL THEN jsonb_build_object('code', 'festival_dates_required', 'message', 'Choose the Festival start date and duration.') END),
        (CASE WHEN p_edition.city_id IS NULL THEN jsonb_build_object('code', 'festival_city_required', 'message', 'Choose the Festival city.') END),
        (CASE WHEN p_edition.site_type IS NULL THEN jsonb_build_object('code', 'festival_site_style_required', 'message', 'Choose the broad site style.') END),
        (CASE WHEN p_edition.festival_scale IS NULL THEN jsonb_build_object('code', 'festival_scale_required', 'message', 'Choose the Festival size.') END),
        (CASE WHEN p_edition.vibe IS NULL THEN jsonb_build_object('code', 'festival_vibe_required', 'message', 'Choose the Festival vibe.') END),
        (CASE WHEN p_edition.marketing_emphasis IS NULL THEN jsonb_build_object('code', 'festival_marketing_required', 'message', 'Choose the marketing emphasis.') END),
        (CASE WHEN licence.max_attendance IS NULL THEN jsonb_build_object('code', 'festival_licence_required', 'message', 'The Festival company needs an active licence before launch.') END),
        (CASE WHEN licence.max_attendance IS NOT NULL AND coalesce(p_edition.expected_capacity, 0) > licence.max_attendance THEN jsonb_build_object('code', 'festival_licence_capacity_exceeded', 'message', 'The selected scale exceeds the active Festival licence capacity.') END),
        (CASE WHEN licence.max_days IS NOT NULL AND coalesce(p_edition.duration_days, 0) > licence.max_days THEN jsonb_build_object('code', 'festival_licence_duration_exceeded', 'message', 'The selected duration exceeds the active Festival licence.') END)
    ) AS candidate(x)
    WHERE x IS NOT NULL
  )
  SELECT coalesce(jsonb_agg(x), '[]'::jsonb) FROM blockers
$$;

CREATE OR REPLACE FUNCTION public._festival_annual_plan_result(
  p_festival_company_id uuid,
  p_festival_edition_id uuid
)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'festivalCompanyId', company.id,
    'festivalEditionId', edition.id,
    'editionYear', edition.edition_year,
    'name', edition.name,
    'status', edition.status,
    'editable', edition.status NOT IN ('completed', 'cancelled') AND edition.locked_at IS NULL,
    'version', edition.version,
    'startsOn', edition.starts_on,
    'endsOn', edition.ends_on,
    'preferredMonth', coalesce(edition.preferred_month, company.annual_month),
    'city', CASE WHEN city.id IS NULL THEN NULL ELSE jsonb_build_object(
      'id', city.id, 'name', city.name, 'country', city.country, 'timezone', city.timezone
    ) END,
    'siteType', coalesce(edition.site_type, company.default_site_type),
    'festivalScale', coalesce(edition.festival_scale, configuration.festival_scale),
    'durationDays', coalesce(edition.duration_days, company.default_duration_days),
    'vibe', coalesce(edition.vibe, company.default_vibe),
    'environmentalPolicy', coalesce(edition.environmental_policy, company.environmental_policy, 'standard'),
    'marketingEmphasis', coalesce(edition.marketing_emphasis, 'balanced'),
    'expectedCapacity', nullif(edition.expected_capacity, 0),
    'estimatedOperatingCostMinor', edition.estimated_operating_cost_minor,
    'planningStatus', edition.planning_status,
    'readinessScore', edition.readiness_score,
    'planningEffects', edition.planning_effects,
    'blockers', public._festival_annual_plan_blockers(company.id, edition),
    'canWrite', edition.status NOT IN ('completed', 'cancelled') AND edition.locked_at IS NULL,
    'updatedAt', edition.planning_updated_at,
    'cities', (
      SELECT coalesce(jsonb_agg(jsonb_build_object(
        'id', option.id, 'name', option.name, 'country', option.country, 'timezone', option.timezone
      ) ORDER BY option.country, option.name), '[]'::jsonb)
      FROM public.cities option
    ),
    'scales', (
      SELECT coalesce(jsonb_agg(jsonb_build_object(
        'key', option.key,
        'displayName', option.display_name,
        'description', option.description,
        'minimumCapacity', option.minimum_site_capacity,
        'maximumCapacity', option.maximum_site_capacity,
        'maximumDurationDays', option.maximum_duration_days,
        'complexity', option.complexity
      ) ORDER BY option.sort_order), '[]'::jsonb)
      FROM public.festival_scale_catalogue option
      WHERE option.active OR option.key = edition.festival_scale
    ),
    'vibes', (
      SELECT coalesce(jsonb_agg(jsonb_build_object(
        'key', option.key, 'displayName', option.display_name, 'description', option.description
      ) ORDER BY option.sort_order), '[]'::jsonb)
      FROM public.festival_vibe_catalogue option
      WHERE option.active OR option.key = edition.vibe
    ),
    'siteTypes', (
      SELECT coalesce(jsonb_agg(jsonb_build_object(
        'key', option.key, 'displayName', option.display_name, 'description', option.description
      ) ORDER BY option.sort_order), '[]'::jsonb)
      FROM public.festival_site_type_catalogue option
      WHERE option.active OR option.key = edition.site_type
    ),
    'environmentalPolicies', (
      SELECT coalesce(jsonb_agg(jsonb_build_object(
        'key', option.key, 'displayName', option.display_name, 'description', option.description
      ) ORDER BY option.sort_order), '[]'::jsonb)
      FROM public.festival_environmental_policy_catalogue option
      WHERE option.active OR option.key = edition.environmental_policy
    ),
    'marketingEmphases', (
      SELECT coalesce(jsonb_agg(jsonb_build_object(
        'key', option.key,
        'displayName', option.display_name,
        'description', option.description,
        'demandBasisPoints', option.demand_basis_points,
        'costBasisPoints', option.cost_basis_points,
        'reputationBasisPoints', option.reputation_basis_points,
        'localArtistBasisPoints', option.local_artist_basis_points
      ) ORDER BY option.sort_order), '[]'::jsonb)
      FROM public.festival_marketing_emphasis_catalogue option
      WHERE option.active OR option.key = edition.marketing_emphasis
    )
  )
  FROM public.festival_companies company
  JOIN public.festival_editions_v2 edition
    ON edition.festival_company_id = company.id
   AND edition.id = p_festival_edition_id
  LEFT JOIN public.festival_configurations configuration
    ON configuration.festival_company_id = company.id
  LEFT JOIN public.cities city
    ON city.id = coalesce(edition.city_id, company.default_city_id)
  WHERE company.id = p_festival_company_id
$$;

CREATE OR REPLACE FUNCTION public.get_festival_edition_annual_plan(
  p_festival_company_id uuid,
  p_festival_edition_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  actor uuid := public._caller_profile_id();
  result jsonb;
BEGIN
  IF auth.uid() IS NULL OR actor IS NULL OR NOT EXISTS (
    SELECT 1
    FROM public.festival_companies company
    JOIN public.festival_editions_v2 edition
      ON edition.festival_company_id = company.id
     AND edition.id = p_festival_edition_id
    WHERE company.id = p_festival_company_id
      AND (
        company.owner_profile_id = actor
        OR coalesce(public.has_role(auth.uid(), 'admin'::public.app_role), false)
      )
  ) THEN
    RAISE EXCEPTION 'festival_annual_plan_forbidden' USING ERRCODE = 'P0001';
  END IF;

  result := public._festival_annual_plan_result(
    p_festival_company_id,
    p_festival_edition_id
  );
  IF result IS NULL THEN
    RAISE EXCEPTION 'festival_annual_plan_not_found' USING ERRCODE = 'P0001';
  END IF;
  RETURN result;
END;
$$;

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
SET search_path = public
AS $$
DECLARE
  actor uuid := public._caller_profile_id();
  company public.festival_companies%ROWTYPE;
  edition public.festival_editions_v2%ROWTYPE;
  request public.festival_annual_plan_requests%ROWTYPE;
  city public.cities%ROWTYPE;
  scale public.festival_scale_catalogue%ROWTYPE;
  marketing public.festival_marketing_emphasis_catalogue%ROWTYPE;
  payload_hash text;
  start_date date;
  end_date date;
  duration integer;
  selected_month integer;
  city_id uuid;
  scale_key text;
  vibe_key text;
  site_key text;
  environmental_key text;
  marketing_key text;
  capacity integer;
  estimated_cost bigint;
  blockers jsonb;
  blocker_count integer;
  readiness integer;
  next_status text;
  effects jsonb;
  result jsonb;
BEGIN
  IF auth.uid() IS NULL OR actor IS NULL THEN
    RAISE EXCEPTION 'festival_annual_plan_forbidden' USING ERRCODE = 'P0001';
  END IF;

  PERFORM pg_advisory_xact_lock(
    hashtextextended(p_festival_edition_id::text || p_idempotency_key::text, 0)
  );

  SELECT * INTO company
  FROM public.festival_companies
  WHERE id = p_festival_company_id
  FOR UPDATE;

  SELECT * INTO edition
  FROM public.festival_editions_v2
  WHERE id = p_festival_edition_id
    AND festival_company_id = p_festival_company_id
  FOR UPDATE;

  IF company.id IS NULL OR edition.id IS NULL OR (
    company.owner_profile_id <> actor
    AND NOT coalesce(public.has_role(auth.uid(), 'admin'::public.app_role), false)
  ) THEN
    RAISE EXCEPTION 'festival_annual_plan_forbidden' USING ERRCODE = 'P0001';
  END IF;

  IF edition.status IN ('completed', 'cancelled') OR edition.locked_at IS NOT NULL THEN
    RAISE EXCEPTION 'festival_annual_plan_locked' USING ERRCODE = 'P0001';
  END IF;

  payload_hash := encode(
    digest(jsonb_build_object(
      'editionId', p_festival_edition_id,
      'expectedVersion', p_expected_version,
      'plan', p_plan
    )::text, 'sha256'),
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
      RAISE EXCEPTION 'festival_annual_plan_idempotency_conflict' USING ERRCODE = 'P0001';
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
      company.id,
      edition.id,
      actor,
      p_idempotency_key,
      payload_hash
    ) RETURNING * INTO request;
  END IF;

  IF edition.version <> p_expected_version THEN
    RAISE EXCEPTION 'festival_annual_plan_stale' USING ERRCODE = 'P0001';
  END IF;

  start_date := nullif(p_plan->>'startsOn', '')::date;
  duration := nullif(p_plan->>'durationDays', '')::integer;
  selected_month := nullif(p_plan->>'preferredMonth', '')::integer;
  city_id := nullif(p_plan->>'cityId', '')::uuid;
  scale_key := nullif(p_plan->>'festivalScale', '');
  vibe_key := nullif(p_plan->>'vibe', '');
  site_key := nullif(p_plan->>'siteType', '');
  environmental_key := coalesce(nullif(p_plan->>'environmentalPolicy', ''), 'standard');
  marketing_key := nullif(p_plan->>'marketingEmphasis', '');

  IF start_date IS NULL OR duration IS NULL OR selected_month IS NULL
     OR city_id IS NULL OR scale_key IS NULL OR vibe_key IS NULL
     OR site_key IS NULL OR marketing_key IS NULL THEN
    RAISE EXCEPTION 'festival_annual_plan_invalid' USING ERRCODE = 'P0001';
  END IF;

  IF start_date < current_date
     OR selected_month NOT BETWEEN 1 AND 12
     OR extract(month FROM start_date)::integer <> selected_month THEN
    RAISE EXCEPTION 'festival_annual_plan_dates_invalid' USING ERRCODE = 'P0001';
  END IF;

  SELECT * INTO city FROM public.cities WHERE id = city_id;
  SELECT * INTO scale FROM public.festival_scale_catalogue
    WHERE key = scale_key AND active;
  SELECT * INTO marketing FROM public.festival_marketing_emphasis_catalogue
    WHERE key = marketing_key AND active;

  IF city.id IS NULL OR scale.key IS NULL OR marketing.key IS NULL
     OR duration NOT BETWEEN 1 AND scale.maximum_duration_days
     OR NOT EXISTS (SELECT 1 FROM public.festival_vibe_catalogue WHERE key = vibe_key AND active)
     OR NOT EXISTS (SELECT 1 FROM public.festival_site_type_catalogue WHERE key = site_key AND active)
     OR NOT EXISTS (SELECT 1 FROM public.festival_environmental_policy_catalogue WHERE key = environmental_key AND active) THEN
    RAISE EXCEPTION 'festival_annual_plan_invalid' USING ERRCODE = 'P0001';
  END IF;

  end_date := start_date + (duration - 1);
  capacity := public._festival_annual_plan_capacity(company.id, scale.key);
  estimated_cost := public._festival_annual_plan_cost(
    company.id,
    scale.key,
    site_key,
    environmental_key,
    marketing.key,
    duration,
    capacity
  );

  effects := jsonb_build_object(
    'capacity', capacity,
    'estimatedOperatingCostMinor', estimated_cost,
    'marketingDemandBasisPoints', marketing.demand_basis_points,
    'marketingCostBasisPoints', marketing.cost_basis_points,
    'marketingReputationBasisPoints', marketing.reputation_basis_points,
    'localArtistBasisPoints', marketing.local_artist_basis_points,
    'capacityUpgradeProgress', public._festival_annual_plan_upgrade_progress(
      company.id,
      ARRAY['site_infrastructure', 'stages_production', 'audience_facilities', 'transport_access']
    ),
    'efficiencyUpgradeProgress', public._festival_annual_plan_upgrade_progress(
      company.id,
      ARRAY['site_infrastructure', 'sanitation_utilities', 'transport_access', 'sustainability_technology']
    )
  );

  UPDATE public.festival_editions_v2
  SET starts_on = start_date,
      ends_on = end_date,
      preferred_month = selected_month,
      city_id = city.id,
      country_code = city.country,
      site_type = site_key,
      festival_scale = scale.key,
      duration_days = duration,
      vibe = vibe_key,
      environmental_policy = environmental_key,
      marketing_emphasis = marketing.key,
      expected_capacity = capacity,
      estimated_operating_cost_minor = estimated_cost,
      planning_effects = effects,
      planning_status = 'in_progress',
      readiness_score = 0,
      planning_updated_at = now(),
      version = version + 1
  WHERE id = edition.id AND version = p_expected_version
  RETURNING * INTO edition;

  IF edition.id IS NULL THEN
    RAISE EXCEPTION 'festival_annual_plan_stale' USING ERRCODE = 'P0001';
  END IF;

  blockers := public._festival_annual_plan_blockers(company.id, edition);
  blocker_count := jsonb_array_length(blockers);
  readiness := greatest(0, 100 - blocker_count * 25);
  next_status := CASE WHEN blocker_count = 0 THEN 'ready' ELSE 'in_progress' END;

  UPDATE public.festival_editions_v2
  SET readiness_score = readiness,
      planning_status = next_status
  WHERE id = edition.id
  RETURNING * INTO edition;

  INSERT INTO public.festival_edition_audit(
    festival_company_id,
    festival_edition_id,
    actor_profile_id,
    event_type,
    previous_version,
    new_version,
    metadata
  ) VALUES (
    company.id,
    edition.id,
    actor,
    'simplified_annual_plan_updated',
    p_expected_version,
    edition.version,
    jsonb_build_object(
      'startsOn', start_date,
      'endsOn', end_date,
      'cityId', city.id,
      'festivalScale', scale.key,
      'siteType', site_key,
      'vibe', vibe_key,
      'marketingEmphasis', marketing.key,
      'expectedCapacity', capacity,
      'estimatedOperatingCostMinor', estimated_cost,
      'readinessScore', readiness,
      'blockerCount', blocker_count
    )
  );

  result := public._festival_annual_plan_result(company.id, edition.id);
  UPDATE public.festival_annual_plan_requests
  SET status = 'succeeded', result = result, completed_at = now()
  WHERE id = request.id;

  RETURN result;
END;
$$;

-- Backfill safe annual defaults without guessing event-specific dates.
UPDATE public.festival_editions_v2 edition
SET preferred_month = coalesce(
      edition.preferred_month,
      extract(month FROM edition.starts_on)::integer,
      company.annual_month
    ),
    marketing_emphasis = coalesce(edition.marketing_emphasis, 'balanced'),
    planning_status = CASE
      WHEN edition.starts_on IS NOT NULL
       AND edition.city_id IS NOT NULL
       AND edition.site_type IS NOT NULL
       AND edition.festival_scale IS NOT NULL
       AND edition.vibe IS NOT NULL THEN 'in_progress'
      ELSE 'not_started'
    END
FROM public.festival_companies company
WHERE company.id = edition.festival_company_id;

CREATE OR REPLACE FUNCTION public.get_festival_company_editions(
  p_festival_company_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  actor uuid := public._caller_profile_id();
  company public.festival_companies%ROWTYPE;
  editions jsonb;
BEGIN
  IF auth.uid() IS NULL OR actor IS NULL THEN
    RAISE EXCEPTION 'festival_edition_forbidden' USING ERRCODE = 'P0001';
  END IF;

  SELECT * INTO company
  FROM public.festival_companies
  WHERE id = p_festival_company_id;

  IF NOT FOUND OR (
    company.owner_profile_id <> actor
    AND NOT coalesce(public.has_role(auth.uid(), 'admin'::public.app_role), false)
  ) THEN
    RAISE EXCEPTION 'festival_edition_forbidden' USING ERRCODE = 'P0001';
  END IF;

  SELECT coalesce(jsonb_agg(jsonb_build_object(
    'festivalEditionId', edition.id,
    'editionYear', edition.edition_year,
    'name', edition.name,
    'status', edition.status,
    'startsOn', edition.starts_on,
    'endsOn', edition.ends_on,
    'preferredMonth', edition.preferred_month,
    'countryCode', edition.country_code,
    'cityId', edition.city_id,
    'vibe', edition.vibe,
    'siteType', edition.site_type,
    'durationDays', edition.duration_days,
    'environmentalPolicy', edition.environmental_policy,
    'festivalScale', edition.festival_scale,
    'marketingEmphasis', edition.marketing_emphasis,
    'expectedCapacity', edition.expected_capacity,
    'estimatedOperatingCostMinor', edition.estimated_operating_cost_minor,
    'planningStatus', edition.planning_status,
    'readinessScore', edition.readiness_score,
    'version', edition.version,
    'lockedAt', edition.locked_at,
    'creationSource', edition.creation_source,
    'editable', edition.status NOT IN ('completed', 'cancelled') AND edition.locked_at IS NULL,
    'planBindings', jsonb_build_object(
      'configuration', EXISTS (SELECT 1 FROM public.festival_configurations p WHERE p.festival_company_id = company.id AND p.festival_edition_id = edition.id),
      'site', EXISTS (SELECT 1 FROM public.festival_site_plans p WHERE p.festival_company_id = company.id AND p.festival_edition_id = edition.id),
      'tickets', EXISTS (SELECT 1 FROM public.festival_ticket_plans p WHERE p.festival_company_id = company.id AND p.festival_edition_id = edition.id),
      'artists', EXISTS (SELECT 1 FROM public.festival_artist_programmes p WHERE p.festival_company_id = company.id AND p.festival_edition_id = edition.id),
      'operations', EXISTS (SELECT 1 FROM public.festival_operations_plans p WHERE p.festival_company_id = company.id AND p.festival_edition_id = edition.id),
      'sponsorship', EXISTS (SELECT 1 FROM public.festival_sponsorship_plans p WHERE p.festival_company_id = company.id AND p.festival_edition_id = edition.id),
      'timetable', EXISTS (SELECT 1 FROM public.festival_timetable_plans p WHERE p.festival_company_id = company.id AND p.festival_edition_id = edition.id)
    )
  ) ORDER BY edition.edition_year DESC, edition.id DESC), '[]'::jsonb)
  INTO editions
  FROM public.festival_editions_v2 edition
  WHERE edition.festival_company_id = company.id;

  RETURN jsonb_build_object(
    'festivalCompanyId', company.id,
    'publicName', company.public_name,
    'companyStatus', company.status,
    'setupCompleted', company.setup_completed,
    'canPlanNext', company.status = 'active' AND company.setup_completed,
    'currentGameYear', public.rockmundo_game_year(),
    'editions', editions
  );
END;
$$;

REVOKE ALL ON FUNCTION public._festival_annual_plan_upgrade_progress(uuid, text[]) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public._festival_annual_plan_capacity(uuid, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public._festival_annual_plan_cost(uuid, text, text, text, text, integer, integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public._festival_annual_plan_blockers(uuid, public.festival_editions_v2) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public._festival_annual_plan_result(uuid, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.get_festival_edition_annual_plan(uuid, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.save_festival_edition_annual_plan(uuid, uuid, integer, jsonb, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_festival_edition_annual_plan(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.save_festival_edition_annual_plan(uuid, uuid, integer, jsonb, uuid) TO authenticated;

COMMENT ON FUNCTION public.get_festival_edition_annual_plan(uuid, uuid) IS
  'Owner/admin read model for one simplified annual Festival plan and its server catalogues.';
COMMENT ON FUNCTION public.save_festival_edition_annual_plan(uuid, uuid, integer, jsonb, uuid) IS
  'Exact-edition, optimistic and idempotent save for high-level annual Festival choices. Detailed operations remain automatic.';

NOTIFY pgrst, 'reload schema';
