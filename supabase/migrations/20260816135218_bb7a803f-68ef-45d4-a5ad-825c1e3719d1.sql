CREATE OR REPLACE FUNCTION public.get_festival_company_editions(p_festival_company_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_profile uuid := public._caller_profile_id();
  v_admin boolean := coalesce(public.has_role(auth.uid(),'admin'::public.app_role), false);
  v_fc public.festival_companies%ROWTYPE;
  v_cfg public.festival_configurations%ROWTYPE;
  v_year integer := public.rockmundo_game_year(now());
  v_site boolean := false;
  v_tickets boolean := false;
  v_artists boolean := false;
  v_ops boolean := false;
  v_editions jsonb := '[]'::jsonb;
  v_has_open boolean := false;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'not_authenticated' USING ERRCODE='P0001'; END IF;
  SELECT * INTO v_fc FROM public.festival_companies WHERE id = p_festival_company_id;
  IF v_fc.id IS NULL THEN RAISE EXCEPTION 'festival_company_not_found' USING ERRCODE='P0001'; END IF;
  IF v_fc.owner_profile_id IS DISTINCT FROM v_profile AND NOT v_admin THEN
    RAISE EXCEPTION 'festival_editions_unavailable' USING ERRCODE='P0001';
  END IF;

  SELECT * INTO v_cfg FROM public.festival_configurations
   WHERE festival_company_id = v_fc.id ORDER BY updated_at DESC NULLS LAST LIMIT 1;

  SELECT EXISTS (SELECT 1 FROM public.festival_site_plans WHERE festival_company_id = v_fc.id) INTO v_site;
  SELECT EXISTS (SELECT 1 FROM public.festival_ticket_plans WHERE festival_company_id = v_fc.id) INTO v_tickets;
  SELECT EXISTS (SELECT 1 FROM public.festival_artist_programmes WHERE festival_company_id = v_fc.id) INTO v_artists;
  SELECT EXISTS (SELECT 1 FROM public.festival_operations_plans WHERE festival_company_id = v_fc.id) INTO v_ops;

  SELECT coalesce(jsonb_agg(payload ORDER BY edition_year DESC), '[]'::jsonb)
    INTO v_editions
  FROM (
    SELECT e.edition_year,
      jsonb_build_object(
        'festivalEditionId', e.id,
        'editionYear', greatest(1, coalesce(e.edition_year, v_year)),
        'name', coalesce(nullif(btrim(e.name), ''), v_fc.public_name || ' ' || coalesce(e.edition_year, v_year)::text),
        'status', coalesce(nullif(e.status::text, ''), 'draft'),
        'startsOn', e.starts_on,
        'endsOn', e.ends_on,
        'preferredMonth', coalesce(e.annual_month_placeholder, v_fc.annual_month),
        'countryCode', coalesce(e.country_code, v_fc.country_code),
        'cityId', coalesce(e.city_id, v_fc.default_city_id),
        'vibe', coalesce(e.vibe, v_fc.default_vibe),
        'siteType', coalesce(e.site_type, v_fc.default_site_type),
        'durationDays', coalesce(e.duration_days, v_fc.default_duration_days),
        'environmentalPolicy', coalesce(e.environmental_policy, v_fc.environmental_policy),
        'festivalScale', e.festival_scale,
        'marketingEmphasis', NULL,
        'expectedCapacity', e.expected_capacity,
        'estimatedOperatingCostMinor', 0,
        'planningStatus', CASE
            WHEN e.locked_at IS NOT NULL OR e.status::text IN ('locked','launched','live','completed','settled') THEN 'ready'
            WHEN v_site OR v_tickets OR v_artists OR v_ops THEN 'in_progress'
            ELSE 'not_started' END,
        'readinessScore', least(100, (
            CASE WHEN v_cfg.id IS NOT NULL THEN 20 ELSE 0 END
          + CASE WHEN v_site THEN 20 ELSE 0 END
          + CASE WHEN v_tickets THEN 15 ELSE 0 END
          + CASE WHEN v_artists THEN 20 ELSE 0 END
          + CASE WHEN v_ops THEN 15 ELSE 0 END
          + CASE WHEN EXISTS (SELECT 1 FROM public.festival_stage_slots s WHERE s.edition_id = e.id) THEN 10 ELSE 0 END)),
        'version', coalesce(e.version, 0),
        'lockedAt', e.locked_at,
        'creationSource', coalesce(nullif(e.creation_source::text, ''), 'owner_plan'),
        'editable', (e.locked_at IS NULL AND coalesce(e.status::text,'draft') NOT IN ('locked','launched','live','completed','settled','cancelled')),
        'planBindings', jsonb_build_object(
          'configuration', v_cfg.id IS NOT NULL,
          'site', v_site,
          'tickets', v_tickets,
          'artists', v_artists,
          'operations', v_ops,
          'sponsorship', EXISTS (SELECT 1 FROM public.festival_sponsorships fs WHERE fs.festival_id = e.id),
          'timetable', EXISTS (SELECT 1 FROM public.festival_stage_slots s WHERE s.edition_id = e.id)
        )
      ) AS payload
    FROM (
      SELECT ev.*, NULL::integer AS annual_month_placeholder
      FROM public.festival_editions_v2 ev
      WHERE ev.festival_company_id = v_fc.id
    ) e
  ) rows;

  SELECT EXISTS (
    SELECT 1 FROM public.festival_editions_v2 ev
     WHERE ev.festival_company_id = v_fc.id
       AND ev.locked_at IS NULL
       AND coalesce(ev.status::text,'draft') NOT IN ('locked','launched','live','completed','settled','cancelled')
  ) INTO v_has_open;

  RETURN jsonb_build_object(
    'festivalCompanyId', v_fc.id,
    'publicName', coalesce(nullif(btrim(v_fc.public_name), ''), 'Festival'),
    'companyStatus', coalesce(nullif(v_fc.status::text, ''), 'active'),
    'setupCompleted', coalesce(v_fc.setup_completed, false),
    'canPlanNext', coalesce(v_fc.setup_completed, false) AND NOT v_has_open,
    'currentGameYear', greatest(1, v_year),
    'editions', v_editions
  );
END $function$;

GRANT EXECUTE ON FUNCTION public.get_festival_company_editions(uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.resolve_public_festival_identifier(
  p_identifier text,
  p_expected_identifier_kind text DEFAULT 'public_slug',
  p_edition_identifier text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_fc public.festival_companies%ROWTYPE;
  v_edition public.festival_editions_v2%ROWTYPE;
  v_provenance text := 'canonical_slug';
  v_legacy record;
BEGIN
  IF p_identifier IS NULL OR btrim(p_identifier) = '' THEN
    RETURN jsonb_build_object('status','not_found');
  END IF;

  IF p_identifier ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
    SELECT * INTO v_fc FROM public.festival_companies WHERE id = p_identifier::uuid;
    v_provenance := 'canonical_uuid';
  END IF;

  IF v_fc.id IS NULL THEN
    SELECT * INTO v_fc FROM public.festival_companies WHERE slug = lower(btrim(p_identifier));
    v_provenance := 'canonical_slug';
  END IF;

  IF v_fc.id IS NULL AND p_identifier ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
    SELECT m.edition_id, m.legacy_festival_id INTO v_legacy
      FROM public.festival_legacy_mappings m
     WHERE m.legacy_festival_id = p_identifier::uuid OR m.legacy_id::text = p_identifier
     LIMIT 1;
    IF v_legacy.edition_id IS NOT NULL THEN
      SELECT * INTO v_edition FROM public.festival_editions_v2 WHERE id = v_legacy.edition_id;
      IF v_edition.id IS NOT NULL THEN
        SELECT * INTO v_fc FROM public.festival_companies WHERE id = v_edition.festival_company_id;
        v_provenance := 'legacy_mapping';
      END IF;
    END IF;
    IF v_fc.id IS NULL THEN
      RETURN jsonb_build_object('status','not_found');
    END IF;
  END IF;

  IF v_fc.id IS NULL THEN RETURN jsonb_build_object('status','not_found'); END IF;

  IF p_edition_identifier IS NOT NULL AND btrim(p_edition_identifier) <> '' THEN
    IF p_edition_identifier ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
      SELECT * INTO v_edition FROM public.festival_editions_v2
       WHERE festival_company_id = v_fc.id AND id = p_edition_identifier::uuid;
    ELSE
      SELECT * INTO v_edition FROM public.festival_editions_v2
       WHERE festival_company_id = v_fc.id
         AND p_edition_identifier ~ '^[0-9]+$'
         AND edition_year = p_edition_identifier::int
       ORDER BY created_at DESC LIMIT 1;
    END IF;
    IF v_edition.id IS NULL THEN RETURN jsonb_build_object('status','not_found'); END IF;
  END IF;

  RETURN jsonb_strip_nulls(jsonb_build_object(
    'status','resolved',
    'festivalCompanyId', v_fc.id,
    'companyId', v_fc.company_id,
    'publicSlug', v_fc.slug,
    'provenance', v_provenance,
    'editionId', v_edition.id,
    'editionYear', v_edition.edition_year
  ));
END $function$;

GRANT EXECUTE ON FUNCTION public.resolve_public_festival_identifier(text, text, text) TO anon, authenticated, service_role;