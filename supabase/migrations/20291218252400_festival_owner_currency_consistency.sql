-- Keep owner-facing Festival financial displays aligned with the Festival city's
-- authoritative currency instead of assuming GBP.

CREATE OR REPLACE FUNCTION public._festival_annual_plan_result(
  p_festival_company_id uuid,
  p_festival_edition_id uuid
)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
SELECT jsonb_build_object(
  'festivalCompanyId', company.id,
  'festivalEditionId', edition.id,
  'editionYear', edition.edition_year,
  'name', edition.name,
  'status', edition.status,
  'editable', edition.status NOT IN ('completed','cancelled') AND edition.locked_at IS NULL,
  'version', edition.version,
  'startsOn', edition.starts_on,
  'endsOn', edition.ends_on,
  'preferredMonth', coalesce(edition.preferred_month, company.annual_month),
  'city', CASE WHEN city.id IS NULL THEN NULL ELSE jsonb_build_object(
    'id', city.id,
    'name', city.name,
    'country', city.country,
    'timezone', city.timezone
  ) END,
  'currencyCode', coalesce(
    public._festival_projection_currency(coalesce(edition.city_id, company.default_city_id)),
    'GBP'
  ),
  'siteType', coalesce(edition.site_type, company.default_site_type),
  'festivalScale', edition.festival_scale,
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
  'canWrite', edition.status NOT IN ('completed','cancelled') AND edition.locked_at IS NULL,
  'updatedAt', edition.planning_updated_at,
  'cities', (
    SELECT coalesce(jsonb_agg(jsonb_build_object(
      'id', c.id,
      'name', c.name,
      'country', c.country,
      'timezone', c.timezone
    ) ORDER BY c.country, c.name), '[]'::jsonb)
    FROM public.cities c
  ),
  'scales', (
    SELECT coalesce(jsonb_agg(jsonb_build_object(
      'key', s.key,
      'displayName', s.display_name,
      'description', s.description,
      'minimumCapacity', s.minimum_site_capacity,
      'maximumCapacity', s.maximum_site_capacity,
      'maximumDurationDays', s.maximum_duration_days,
      'complexity', s.complexity
    ) ORDER BY s.sort_order), '[]'::jsonb)
    FROM public.festival_scale_catalogue s
    WHERE s.active OR s.key = edition.festival_scale
  ),
  'vibes', (
    SELECT coalesce(jsonb_agg(jsonb_build_object(
      'key', x.key,
      'displayName', x.display_name,
      'description', x.description
    ) ORDER BY x.sort_order), '[]'::jsonb)
    FROM public.festival_vibe_catalogue x
    WHERE x.active OR x.key = edition.vibe
  ),
  'siteTypes', (
    SELECT coalesce(jsonb_agg(jsonb_build_object(
      'key', x.key,
      'displayName', x.display_name,
      'description', x.description
    ) ORDER BY x.sort_order), '[]'::jsonb)
    FROM public.festival_site_type_catalogue x
    WHERE x.active OR x.key = edition.site_type
  ),
  'environmentalPolicies', (
    SELECT coalesce(jsonb_agg(jsonb_build_object(
      'key', x.key,
      'displayName', x.display_name,
      'description', x.description
    ) ORDER BY x.sort_order), '[]'::jsonb)
    FROM public.festival_environmental_policy_catalogue x
    WHERE x.active OR x.key = edition.environmental_policy
  ),
  'marketingEmphases', (
    SELECT coalesce(jsonb_agg(jsonb_build_object(
      'key', x.key,
      'displayName', x.display_name,
      'description', x.description,
      'demandBasisPoints', x.demand_basis_points,
      'costBasisPoints', x.cost_basis_points,
      'reputationBasisPoints', x.reputation_basis_points,
      'localArtistBasisPoints', x.local_artist_basis_points
    ) ORDER BY x.sort_order), '[]'::jsonb)
    FROM public.festival_marketing_emphasis_catalogue x
    WHERE x.active OR x.key = edition.marketing_emphasis
  )
)
FROM public.festival_companies company
JOIN public.festival_editions_v2 edition
  ON edition.festival_company_id = company.id
 AND edition.id = p_festival_edition_id
LEFT JOIN public.cities city
  ON city.id = coalesce(edition.city_id, company.default_city_id)
WHERE company.id = p_festival_company_id
$function$;

REVOKE ALL ON FUNCTION public._festival_annual_plan_result(uuid, uuid)
FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public._festival_annual_plan_result(uuid, uuid)
TO service_role;

CREATE OR REPLACE FUNCTION public.get_festival_company_editions(
  p_festival_company_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  actor uuid := public._caller_profile_id();
  company public.festival_companies%ROWTYPE;
  editions jsonb;
  has_open_edition boolean := false;
BEGIN
  IF auth.uid() IS NULL
     OR actor IS NULL
     OR NOT public._festival_company_manager_authorized(p_festival_company_id, actor) THEN
    RAISE EXCEPTION 'festival_edition_forbidden' USING ERRCODE='P0001';
  END IF;

  SELECT * INTO company
  FROM public.festival_companies
  WHERE id = p_festival_company_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'festival_edition_forbidden' USING ERRCODE='P0001';
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM public.festival_editions_v2 e
    WHERE e.festival_company_id = company.id
      AND e.locked_at IS NULL
      AND e.status NOT IN ('completed', 'cancelled')
  ) INTO has_open_edition;

  SELECT coalesce(
    jsonb_agg(
      jsonb_build_object(
        'festivalEditionId', e.id,
        'editionYear', e.edition_year,
        'name', e.name,
        'status', e.status,
        'startsOn', e.starts_on,
        'endsOn', e.ends_on,
        'preferredMonth', e.preferred_month,
        'countryCode', e.country_code,
        'cityId', e.city_id,
        'currencyCode', coalesce(
          public._festival_projection_currency(coalesce(e.city_id, company.default_city_id)),
          'GBP'
        ),
        'vibe', e.vibe,
        'siteType', e.site_type,
        'durationDays', e.duration_days,
        'environmentalPolicy', e.environmental_policy,
        'festivalScale', e.festival_scale,
        'marketingEmphasis', e.marketing_emphasis,
        'expectedCapacity', e.expected_capacity,
        'estimatedOperatingCostMinor', e.estimated_operating_cost_minor,
        'planningStatus', e.planning_status,
        'readinessScore', e.readiness_score,
        'version', e.version,
        'lockedAt', e.locked_at,
        'creationSource', e.creation_source,
        'editable', e.status NOT IN ('completed', 'cancelled') AND e.locked_at IS NULL,
        'planBindings', jsonb_build_object(
          'configuration', EXISTS (
            SELECT 1 FROM public.festival_configurations p
            WHERE p.festival_company_id = company.id
              AND p.festival_edition_id = e.id
          ),
          'site', EXISTS (
            SELECT 1 FROM public.festival_site_plans p
            WHERE p.festival_company_id = company.id
              AND p.festival_edition_id = e.id
          ),
          'tickets', EXISTS (
            SELECT 1 FROM public.festival_ticket_plans p
            WHERE p.festival_company_id = company.id
              AND p.festival_edition_id = e.id
          ),
          'artists', EXISTS (
            SELECT 1 FROM public.festival_artist_programmes p
            WHERE p.festival_company_id = company.id
              AND p.festival_edition_id = e.id
          ),
          'operations', EXISTS (
            SELECT 1
            FROM public.festival_operations_plans op
            JOIN public.festival_artist_programmes ap ON ap.id = op.artist_programme_id
            WHERE op.festival_company_id = company.id
              AND ap.festival_edition_id = e.id
          ),
          'sponsorship', EXISTS (
            SELECT 1 FROM public.festival_sponsorships s
            WHERE s.festival_id = e.id
          ),
          'timetable', EXISTS (
            SELECT 1 FROM public.festival_stage_slots s
            WHERE s.edition_id = e.id
          )
        )
      )
      ORDER BY e.edition_year DESC, e.id DESC
    ),
    '[]'::jsonb
  ) INTO editions
  FROM public.festival_editions_v2 e
  WHERE e.festival_company_id = company.id;

  RETURN jsonb_build_object(
    'festivalCompanyId', company.id,
    'publicName', company.public_name,
    'companyStatus', company.status,
    'setupCompleted', company.setup_completed,
    'canPlanNext', company.status = 'active'
      AND company.setup_completed
      AND NOT has_open_edition,
    'currentGameYear', public.rockmundo_game_year(),
    'editions', editions
  );
END
$function$;

CREATE OR REPLACE FUNCTION public.get_owned_festival_companies()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT coalesce(jsonb_agg(jsonb_build_object(
    'festivalCompanyId', fc.id,
    'companyId', fc.company_id,
    'publicName', fc.public_name,
    'legalCompanyName', co.name,
    'setupStatus', coalesce(cfg.setup_status, CASE WHEN fc.setup_completed THEN 'active' ELSE 'setup' END),
    'setupCompleted', coalesce(fc.setup_completed, false),
    'configurationComplete', coalesce(cfg.setup_status, '') IN ('complete', 'completed', 'active'),
    'firstEditionExists', EXISTS (
      SELECT 1 FROM public.festival_editions_v2 e
      WHERE e.festival_company_id = fc.id
    ),
    'companyBalance', greatest(coalesce(co.balance, 0), 0),
    'currencyCode', coalesce(public._festival_projection_currency(fc.default_city_id), 'GBP'),
    'managementEnabled', true
  ) ORDER BY fc.created_at), '[]'::jsonb)
  FROM public.festival_companies fc
  JOIN public.companies co ON co.id = fc.company_id
  LEFT JOIN public.festival_configurations cfg ON cfg.festival_company_id = fc.id
  WHERE fc.owner_profile_id = public._caller_profile_id();
$function$;

NOTIFY pgrst, 'reload schema';
