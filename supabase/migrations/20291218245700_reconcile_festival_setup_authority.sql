-- Keep the Festival setup wizard on the same authority boundary as the
-- Festival company home, licence and annual-edition workflows. The older
-- setup RPCs compared only festival_companies.owner_profile_id with the
-- currently selected character. A company owner who changed active character
-- could therefore load the company home but could not load or finish setup.

-- Keep this migration self-contained. Some deployed databases do not have a
-- can_manage_company(uuid) helper, so setup must not depend on it at runtime.
CREATE OR REPLACE FUNCTION public._festival_company_manager_authorized(
  p_festival_company_id uuid,
  p_actor_profile_id uuid
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT auth.uid() IS NOT NULL
    AND p_actor_profile_id IS NOT NULL
    AND EXISTS (
      SELECT 1
      FROM public.festival_companies festival
      JOIN public.companies company
        ON company.id = festival.company_id
      WHERE festival.id = p_festival_company_id
        AND (
          festival.owner_profile_id = p_actor_profile_id
          OR company.owner_id = auth.uid()
          OR EXISTS (
            SELECT 1
            FROM public.company_employees employee
            WHERE employee.company_id = company.id
              AND employee.profile_id = p_actor_profile_id
              AND employee.status = 'active'
              AND lower(coalesce(employee.role, '')) IN (
                'ceo',
                'manager',
                'marketing_manager'
              )
          )
        )
    )
$$;

-- Reconcile the canonical setup response too. Some deployed databases still
-- have the older four-step result helper, which omits the catalogue arrays
-- required by the six-step browser parser and is therefore rejected as
-- malformed even when authority succeeds.
CREATE OR REPLACE FUNCTION public._festival_configuration_result(
  p_company_id uuid
)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT jsonb_build_object(
    'festivalCompanyId', festival.id,
    'legalCompanyName', company.name,
    'publicName', configuration.public_name,
    'shortName', coalesce(configuration.short_name, ''),
    'tagline', coalesce(configuration.tagline, ''),
    'description', coalesce(configuration.description, ''),
    'homeCity', CASE
      WHEN city.id IS NULL THEN NULL
      ELSE jsonb_build_object(
        'id', city.id,
        'name', city.name,
        'country', city.country,
        'timezone', city.timezone
      )
    END,
    'festivalScale', configuration.festival_scale,
    'annualMonth', configuration.annual_month,
    'countryCode', coalesce(configuration.country_code, city.country),
    'vibe', configuration.vibe,
    'siteType', configuration.site_type,
    'environmentalPolicy', configuration.environmental_policy,
    'festivalEditionId', configuration.festival_edition_id,
    'editionYear', edition.edition_year,
    'plannedStartDate', configuration.planned_start_date,
    'plannedEndDate', configuration.planned_end_date,
    'durationDays', configuration.duration_days,
    'setupStatus', configuration.setup_status,
    'currentStep', configuration.current_step,
    'configurationVersion', configuration.configuration_version,
    'updatedAt', configuration.updated_at,
    'canWrite', true,
    'scales', (
      SELECT coalesce(
        jsonb_agg(
          jsonb_build_object(
            'key', scale.key,
            'displayName', scale.display_name,
            'description', scale.description,
            'minimumCapacity', scale.minimum_capacity,
            'maximumCapacity', scale.maximum_capacity,
            'maximumDurationDays', scale.maximum_duration_days,
            'complexity', scale.complexity
          ) ORDER BY scale.sort_order
        ),
        '[]'::jsonb
      )
      FROM public.festival_scale_catalogue scale
      WHERE scale.active OR scale.key = configuration.festival_scale
    ),
    'cities', (
      SELECT coalesce(
        jsonb_agg(
          jsonb_build_object(
            'id', available_city.id,
            'name', available_city.name,
            'country', available_city.country,
            'timezone', available_city.timezone
          ) ORDER BY available_city.country, available_city.name
        ),
        '[]'::jsonb
      )
      FROM public.cities available_city
    ),
    'vibes', (
      SELECT coalesce(
        jsonb_agg(
          jsonb_build_object(
            'key', option.key,
            'displayName', option.display_name,
            'description', option.description
          ) ORDER BY option.sort_order
        ),
        '[]'::jsonb
      )
      FROM public.festival_vibe_catalogue option
      WHERE option.active OR option.key = configuration.vibe
    ),
    'siteTypes', (
      SELECT coalesce(
        jsonb_agg(
          jsonb_build_object(
            'key', option.key,
            'displayName', option.display_name,
            'description', option.description
          ) ORDER BY option.sort_order
        ),
        '[]'::jsonb
      )
      FROM public.festival_site_type_catalogue option
      WHERE option.active OR option.key = configuration.site_type
    ),
    'environmentalPolicies', (
      SELECT coalesce(
        jsonb_agg(
          jsonb_build_object(
            'key', option.key,
            'displayName', option.display_name,
            'description', option.description
          ) ORDER BY option.sort_order
        ),
        '[]'::jsonb
      )
      FROM public.festival_environmental_policy_catalogue option
      WHERE option.active OR option.key = configuration.environmental_policy
    )
  )
  FROM public.festival_companies festival
  JOIN public.companies company
    ON company.id = festival.company_id
  JOIN public.festival_configurations configuration
    ON configuration.festival_company_id = festival.id
  LEFT JOIN public.cities city
    ON city.id = configuration.home_city_id
  LEFT JOIN public.festival_editions_v2 edition
    ON edition.id = configuration.festival_edition_id
  WHERE festival.id = p_company_id
$$;

CREATE OR REPLACE FUNCTION public.get_festival_configuration(
  p_festival_company_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  actor uuid := public._caller_profile_id();
  company public.festival_companies%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL
     OR actor IS NULL
     OR NOT public._festival_company_manager_authorized(
       p_festival_company_id,
       actor
     ) THEN
    RAISE EXCEPTION 'festival_configuration_forbidden' USING ERRCODE = 'P0001';
  END IF;

  SELECT * INTO company
  FROM public.festival_companies
  WHERE id = p_festival_company_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'festival_company_not_found' USING ERRCODE = 'P0001';
  END IF;

  INSERT INTO public.festival_configurations (
    festival_company_id,
    public_name,
    description
  )
  VALUES (
    company.id,
    btrim(company.public_name),
    company.description
  )
  ON CONFLICT (festival_company_id) DO NOTHING;

  RETURN public._festival_configuration_result(company.id);
END;
$$;

CREATE OR REPLACE FUNCTION public.save_festival_configuration(
  p_festival_company_id uuid,
  p_expected_version integer,
  p_configuration jsonb,
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
  configuration public.festival_configurations%ROWTYPE;
  request public.festival_configuration_requests%ROWTYPE;
  v_payload_hash text;
  v_result jsonb;
  v_city_id uuid;
  v_scale_key text;
  v_vibe_key text;
  v_site_type_key text;
  v_environmental_policy_key text;
  v_annual_month integer;
  v_starts_on date;
  v_ends_on date;
  v_duration_days integer;
  v_requested_step integer;
  v_public_name text := btrim(coalesce(p_configuration->>'publicName', ''));
BEGIN
  IF auth.uid() IS NULL OR actor IS NULL THEN
    RAISE EXCEPTION 'festival_configuration_forbidden' USING ERRCODE = 'P0001';
  END IF;

  SELECT * INTO company
  FROM public.festival_companies
  WHERE id = p_festival_company_id;

  IF NOT FOUND
     OR NOT public._festival_company_manager_authorized(company.id, actor) THEN
    RAISE EXCEPTION 'festival_configuration_forbidden' USING ERRCODE = 'P0001';
  END IF;

  PERFORM pg_advisory_xact_lock(
    hashtextextended(p_festival_company_id::text || p_idempotency_key::text, 0)
  );
  v_payload_hash := encode(
    digest(p_configuration::text || '|' || p_expected_version, 'sha256'),
    'hex'
  );

  SELECT * INTO request
  FROM public.festival_configuration_requests
  WHERE festival_company_id = company.id
    AND caller_profile_id = actor
    AND idempotency_key = p_idempotency_key
  FOR UPDATE;

  IF FOUND THEN
    IF request.payload_hash <> v_payload_hash THEN
      RAISE EXCEPTION 'festival_configuration_idempotency_conflict' USING ERRCODE = 'P0001';
    END IF;
    IF request.status = 'succeeded' THEN
      RETURN request.result;
    END IF;
  END IF;

  IF coalesce((p_configuration->>'complete')::boolean, false) THEN
    RAISE EXCEPTION 'festival_configuration_completion_requires_edition' USING ERRCODE = 'P0001';
  END IF;
  IF char_length(v_public_name) NOT BETWEEN 3 AND 80
     OR char_length(btrim(coalesce(p_configuration->>'shortName', ''))) > 24
     OR char_length(btrim(coalesce(p_configuration->>'tagline', ''))) > 120
     OR char_length(btrim(coalesce(p_configuration->>'description', ''))) > 1000 THEN
    RAISE EXCEPTION 'festival_configuration_invalid' USING ERRCODE = 'P0001';
  END IF;

  v_city_id := nullif(p_configuration->>'homeCityId', '')::uuid;
  v_scale_key := nullif(p_configuration->>'festivalScale', '');
  v_vibe_key := nullif(p_configuration->>'vibe', '');
  v_site_type_key := nullif(p_configuration->>'siteType', '');
  v_environmental_policy_key := nullif(
    p_configuration->>'environmentalPolicy',
    ''
  );
  v_annual_month := nullif(p_configuration->>'annualMonth', '')::integer;

  IF v_city_id IS NOT NULL
     AND NOT EXISTS (SELECT 1 FROM public.cities WHERE id = v_city_id) THEN
    RAISE EXCEPTION 'festival_city_invalid' USING ERRCODE = 'P0001';
  END IF;
  IF v_scale_key IS NOT NULL
     AND NOT EXISTS (
       SELECT 1 FROM public.festival_scale_catalogue
       WHERE key = v_scale_key AND active
     ) THEN
    RAISE EXCEPTION 'festival_scale_invalid' USING ERRCODE = 'P0001';
  END IF;
  IF v_vibe_key IS NOT NULL
     AND NOT EXISTS (
       SELECT 1 FROM public.festival_vibe_catalogue
       WHERE key = v_vibe_key AND active
     ) THEN
    RAISE EXCEPTION 'festival_vibe_invalid' USING ERRCODE = 'P0001';
  END IF;
  IF v_site_type_key IS NOT NULL
     AND NOT EXISTS (
       SELECT 1 FROM public.festival_site_type_catalogue
       WHERE key = v_site_type_key AND active
     ) THEN
    RAISE EXCEPTION 'festival_site_type_invalid' USING ERRCODE = 'P0001';
  END IF;
  IF v_environmental_policy_key IS NOT NULL
     AND NOT EXISTS (
       SELECT 1 FROM public.festival_environmental_policy_catalogue
       WHERE key = v_environmental_policy_key AND active
     ) THEN
    RAISE EXCEPTION 'festival_environmental_policy_invalid' USING ERRCODE = 'P0001';
  END IF;
  IF v_annual_month IS NOT NULL AND v_annual_month NOT BETWEEN 1 AND 12 THEN
    RAISE EXCEPTION 'festival_annual_month_invalid' USING ERRCODE = 'P0001';
  END IF;

  v_starts_on := nullif(p_configuration->>'plannedStartDate', '')::date;
  v_ends_on := nullif(p_configuration->>'plannedEndDate', '')::date;
  IF (v_starts_on IS NULL) <> (v_ends_on IS NULL) THEN
    RAISE EXCEPTION 'festival_dates_invalid' USING ERRCODE = 'P0001';
  END IF;
  IF v_starts_on IS NOT NULL THEN
    v_duration_days := v_ends_on - v_starts_on + 1;
    IF v_starts_on < CURRENT_DATE
       OR v_duration_days < 1
       OR NOT EXISTS (
         SELECT 1 FROM public.festival_scale_catalogue
         WHERE key = v_scale_key
           AND active
           AND maximum_duration_days >= v_duration_days
       ) THEN
      RAISE EXCEPTION 'festival_dates_invalid' USING ERRCODE = 'P0001';
    END IF;
  END IF;

  v_requested_step := greatest(
    1,
    least(6, coalesce((p_configuration->>'currentStep')::integer, 1))
  );

  INSERT INTO public.festival_configurations (
    festival_company_id,
    public_name,
    description
  )
  VALUES (company.id, btrim(company.public_name), company.description)
  ON CONFLICT (festival_company_id) DO NOTHING;

  SELECT * INTO configuration
  FROM public.festival_configurations
  WHERE festival_company_id = company.id
  FOR UPDATE;

  IF configuration.configuration_version <> p_expected_version
     OR configuration.completed_at IS NOT NULL THEN
    RAISE EXCEPTION 'festival_configuration_stale' USING ERRCODE = 'P0001';
  END IF;

  INSERT INTO public.festival_configuration_requests (
    festival_company_id,
    caller_profile_id,
    idempotency_key,
    payload_hash
  )
  VALUES (company.id, actor, p_idempotency_key, v_payload_hash);

  UPDATE public.festival_configurations
  SET public_name = v_public_name,
      short_name = nullif(btrim(p_configuration->>'shortName'), ''),
      tagline = nullif(btrim(p_configuration->>'tagline'), ''),
      description = nullif(btrim(p_configuration->>'description'), ''),
      home_city_id = v_city_id,
      festival_scale = v_scale_key,
      annual_month = v_annual_month,
      country_code = (SELECT country FROM public.cities WHERE id = v_city_id),
      vibe = v_vibe_key,
      site_type = v_site_type_key,
      environmental_policy = v_environmental_policy_key,
      planned_start_date = v_starts_on,
      planned_end_date = v_ends_on,
      duration_days = v_duration_days,
      current_step = v_requested_step,
      setup_status = CASE
        WHEN v_starts_on IS NOT NULL THEN 'schedule_complete'
        WHEN v_city_id IS NOT NULL THEN 'identity_complete'
        ELSE 'in_progress'
      END,
      configuration_version = configuration_version + 1,
      updated_at = now()
  WHERE id = configuration.id
    AND configuration_version = p_expected_version;

  INSERT INTO public.festival_configuration_audit (
    festival_company_id,
    configuration_id,
    actor_profile_id,
    event_type,
    previous_version,
    new_version,
    changed_fields
  )
  VALUES (
    company.id,
    configuration.id,
    actor,
    'configuration_updated',
    configuration.configuration_version,
    configuration.configuration_version + 1,
    ARRAY[
      'identity',
      'annual_pattern',
      'location',
      'vibe',
      'site',
      'scale',
      'environmental_policy',
      'schedule'
    ]
  );

  v_result := public._festival_configuration_result(company.id);
  UPDATE public.festival_configuration_requests
  SET status = 'succeeded',
      result = v_result,
      completed_at = now()
  WHERE festival_company_id = company.id
    AND caller_profile_id = actor
    AND idempotency_key = p_idempotency_key;

  RETURN v_result;
EXCEPTION
  WHEN unique_violation THEN
    RAISE EXCEPTION 'festival_name_conflict' USING ERRCODE = 'P0001';
END;
$$;

CREATE OR REPLACE FUNCTION public.complete_festival_setup_with_edition(
  p_festival_company_id uuid,
  p_expected_version integer,
  p_configuration jsonb,
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
  configuration public.festival_configurations%ROWTYPE;
  request public.festival_edition_creation_requests%ROWTYPE;
  edition public.festival_editions_v2%ROWTYPE;
  v_payload_hash text;
  v_starts_on date;
  v_ends_on date;
  v_duration_days integer;
  v_game_year integer;
  v_city_id uuid;
  v_scale_key text;
  v_vibe_key text;
  v_site_type_key text;
  v_environmental_policy_key text;
  v_annual_month integer;
BEGIN
  IF auth.uid() IS NULL OR actor IS NULL THEN
    RAISE EXCEPTION 'festival_configuration_forbidden' USING ERRCODE = 'P0001';
  END IF;

  PERFORM pg_advisory_xact_lock(
    hashtextextended(p_festival_company_id::text || p_idempotency_key::text, 0)
  );

  SELECT * INTO company
  FROM public.festival_companies
  WHERE id = p_festival_company_id
  FOR UPDATE;

  IF NOT FOUND
     OR NOT public._festival_company_manager_authorized(company.id, actor) THEN
    RAISE EXCEPTION 'festival_configuration_forbidden' USING ERRCODE = 'P0001';
  END IF;

  v_payload_hash := encode(digest(p_configuration::text, 'sha256'), 'hex');
  SELECT * INTO request
  FROM public.festival_edition_creation_requests
  WHERE festival_company_id = company.id
    AND actor_profile_id = actor
    AND action = 'complete_setup'
    AND idempotency_key = p_idempotency_key
  FOR UPDATE;

  IF FOUND THEN
    IF request.payload_hash <> v_payload_hash THEN
      RAISE EXCEPTION 'festival_configuration_idempotency_conflict' USING ERRCODE = 'P0001';
    END IF;
    IF request.status = 'succeeded' THEN
      RETURN request.result || jsonb_build_object('idempotent', true);
    END IF;
  ELSE
    INSERT INTO public.festival_edition_creation_requests (
      festival_company_id,
      actor_profile_id,
      action,
      idempotency_key,
      payload_hash
    )
    VALUES (
      company.id,
      actor,
      'complete_setup',
      p_idempotency_key,
      v_payload_hash
    )
    RETURNING * INTO request;
  END IF;

  SELECT * INTO configuration
  FROM public.festival_configurations
  WHERE festival_company_id = company.id
  FOR UPDATE;

  IF NOT FOUND OR configuration.configuration_version <> p_expected_version THEN
    RAISE EXCEPTION 'festival_configuration_stale' USING ERRCODE = 'P0001';
  END IF;

  v_starts_on := (p_configuration->>'plannedStartDate')::date;
  v_ends_on := (p_configuration->>'plannedEndDate')::date;
  v_duration_days := v_ends_on - v_starts_on + 1;
  v_city_id := (p_configuration->>'homeCityId')::uuid;
  v_scale_key := p_configuration->>'festivalScale';
  v_vibe_key := p_configuration->>'vibe';
  v_site_type_key := p_configuration->>'siteType';
  v_environmental_policy_key := p_configuration->>'environmentalPolicy';
  v_annual_month := (p_configuration->>'annualMonth')::integer;
  v_game_year := public.rockmundo_game_year(v_starts_on::timestamptz);

  IF v_starts_on IS NULL
     OR v_ends_on < v_starts_on
     OR v_duration_days NOT BETWEEN 1 AND 7
     OR v_annual_month NOT BETWEEN 1 AND 12
     OR v_city_id IS NULL
     OR NOT EXISTS (SELECT 1 FROM public.cities WHERE id = v_city_id)
     OR NOT EXISTS (
       SELECT 1 FROM public.festival_scale_catalogue
       WHERE key = v_scale_key AND active
     )
     OR NOT EXISTS (
       SELECT 1 FROM public.festival_vibe_catalogue
       WHERE key = v_vibe_key AND active
     )
     OR NOT EXISTS (
       SELECT 1 FROM public.festival_site_type_catalogue
       WHERE key = v_site_type_key AND active
     )
     OR NOT EXISTS (
       SELECT 1 FROM public.festival_environmental_policy_catalogue
       WHERE key = v_environmental_policy_key AND active
     ) THEN
    RAISE EXCEPTION 'festival_configuration_invalid' USING ERRCODE = 'P0001';
  END IF;

  INSERT INTO public.festival_editions_v2 (
    festival_company_id,
    edition_year,
    name,
    status,
    starts_on,
    ends_on,
    country_code,
    city_id,
    vibe,
    site_type,
    duration_days,
    environmental_policy,
    festival_scale,
    creation_source
  )
  VALUES (
    company.id,
    v_game_year,
    btrim(p_configuration->>'publicName'),
    'draft',
    v_starts_on,
    v_ends_on,
    (SELECT country FROM public.cities WHERE id = v_city_id),
    v_city_id,
    v_vibe_key,
    v_site_type_key,
    v_duration_days,
    v_environmental_policy_key,
    v_scale_key,
    'setup'
  )
  RETURNING * INTO edition;

  UPDATE public.festival_companies
  SET public_name = btrim(p_configuration->>'publicName'),
      tagline = nullif(btrim(p_configuration->>'tagline'), ''),
      description = nullif(btrim(p_configuration->>'description'), ''),
      annual_month = v_annual_month,
      country_code = edition.country_code,
      default_city_id = v_city_id,
      default_vibe = v_vibe_key,
      default_site_type = v_site_type_key,
      default_duration_days = v_duration_days,
      environmental_policy = v_environmental_policy_key,
      setup_completed = true,
      status = 'active',
      updated_at = now()
  WHERE id = company.id;

  UPDATE public.festival_configurations
  SET short_name = nullif(btrim(p_configuration->>'shortName'), ''),
      annual_month = v_annual_month,
      country_code = edition.country_code,
      vibe = v_vibe_key,
      site_type = v_site_type_key,
      environmental_policy = v_environmental_policy_key,
      festival_edition_id = edition.id,
      setup_status = 'ready_for_planning',
      current_step = 6,
      configuration_version = configuration_version + 1,
      completed_at = now(),
      updated_at = now()
  WHERE id = configuration.id;

  INSERT INTO public.festival_edition_audit (
    festival_company_id,
    festival_edition_id,
    actor_profile_id,
    event_type,
    new_version,
    metadata
  )
  VALUES (
    company.id,
    edition.id,
    actor,
    'first_annual_edition_created',
    edition.version,
    jsonb_build_object('editionYear', v_game_year, 'source', 'setup')
  );

  request.result := jsonb_build_object(
    'festivalCompanyId', company.id,
    'festivalEditionId', edition.id,
    'editionYear', v_game_year,
    'status', edition.status,
    'idempotent', false
  );
  UPDATE public.festival_edition_creation_requests
  SET status = 'succeeded',
      festival_edition_id = edition.id,
      result = request.result,
      completed_at = now()
  WHERE id = request.id;

  RETURN request.result;
EXCEPTION
  WHEN unique_violation THEN
    RAISE EXCEPTION 'festival_edition_year_exists' USING ERRCODE = 'P0001';
END;
$$;

REVOKE ALL ON FUNCTION public.get_festival_configuration(uuid)
  FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public._festival_company_manager_authorized(uuid, uuid)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public._festival_configuration_result(uuid)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.save_festival_configuration(uuid, integer, jsonb, uuid)
  FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.complete_festival_setup_with_edition(uuid, integer, jsonb, uuid)
  FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.get_festival_configuration(uuid)
  TO authenticated;
GRANT EXECUTE ON FUNCTION public.save_festival_configuration(uuid, integer, jsonb, uuid)
  TO authenticated;
GRANT EXECUTE ON FUNCTION public.complete_festival_setup_with_edition(uuid, integer, jsonb, uuid)
  TO authenticated;

COMMENT ON FUNCTION public.get_festival_configuration(uuid) IS
  'Loads or initialises Festival setup for a normal company-authorised owner, manager or administrator.';
COMMENT ON FUNCTION public._festival_company_manager_authorized(uuid, uuid) IS
  'Internal Festival authority boundary for the account owner, founding profile, or an active company manager.';
COMMENT ON FUNCTION public.save_festival_configuration(uuid, integer, jsonb, uuid) IS
  'Saves resumable Festival setup using the shared company-manager authority boundary.';
COMMENT ON FUNCTION public.complete_festival_setup_with_edition(uuid, integer, jsonb, uuid) IS
  'Atomically completes Festival setup and creates its first edition using shared company-manager authority.';

NOTIFY pgrst, 'reload schema';
