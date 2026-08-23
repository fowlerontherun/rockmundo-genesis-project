-- Production reconciliation extension for the canonical Festival edition directory.
--
-- The live annual-edition directory had drifted back to the older four-binding
-- payload (configuration/site/tickets/artists). The owner UI intentionally
-- validates the complete seven-binding contract, so that drift caused the
-- entire Editions page to reject the response as malformed.
--
-- Keep this outside the chronological migration chain: production received the
-- inherited Festival foundations through reconciliation and this source file is
-- replayed after the canonical bootstrap on disposable/test databases.

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
            JOIN public.festival_artist_programmes ap
              ON ap.id = op.artist_programme_id
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
    'canPlanNext', company.status = 'active' AND company.setup_completed AND NOT has_open_edition,
    'currentGameYear', public.rockmundo_game_year(),
    'editions', editions
  );
END
$function$;

REVOKE ALL ON FUNCTION public.get_festival_company_editions(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_festival_company_editions(uuid) TO authenticated, service_role;

COMMENT ON FUNCTION public.get_festival_company_editions(uuid) IS
  'Owner/admin read model for canonical Festival editions. Returns the complete seven-key planBindings contract and prevents planning another edition while an editable edition is open.';

NOTIFY pgrst, 'reload schema';
