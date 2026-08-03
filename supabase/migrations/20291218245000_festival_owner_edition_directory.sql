-- Restore the owner-facing annual-edition directory on the canonical Festival domain.
-- Read-only, owner/admin scoped and intentionally separate from legacy festivals/festival_editions.

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
  v_actor uuid := public._caller_profile_id();
  v_company public.festival_companies%ROWTYPE;
  v_editions jsonb;
BEGIN
  IF auth.uid() IS NULL OR v_actor IS NULL THEN
    RAISE EXCEPTION 'festival_edition_forbidden' USING ERRCODE = 'P0001';
  END IF;

  SELECT *
  INTO v_company
  FROM public.festival_companies
  WHERE id = p_festival_company_id;

  IF NOT FOUND OR (
    v_company.owner_profile_id <> v_actor
    AND NOT coalesce(public.has_role(auth.uid(), 'admin'::public.app_role), false)
  ) THEN
    RAISE EXCEPTION 'festival_edition_forbidden' USING ERRCODE = 'P0001';
  END IF;

  SELECT coalesce(
    jsonb_agg(
      jsonb_build_object(
        'festivalEditionId', edition.id,
        'editionYear', edition.edition_year,
        'name', edition.name,
        'status', edition.status,
        'startsOn', edition.starts_on,
        'endsOn', edition.ends_on,
        'countryCode', edition.country_code,
        'cityId', edition.city_id,
        'vibe', edition.vibe,
        'siteType', edition.site_type,
        'durationDays', edition.duration_days,
        'environmentalPolicy', edition.environmental_policy,
        'festivalScale', edition.festival_scale,
        'expectedCapacity', edition.expected_capacity,
        'version', edition.version,
        'lockedAt', edition.locked_at,
        'creationSource', edition.creation_source,
        'editable', edition.status NOT IN ('completed', 'cancelled') AND edition.locked_at IS NULL
      )
      ORDER BY edition.edition_year DESC, edition.id DESC
    ),
    '[]'::jsonb
  )
  INTO v_editions
  FROM public.festival_editions_v2 edition
  WHERE edition.festival_company_id = v_company.id;

  RETURN jsonb_build_object(
    'festivalCompanyId', v_company.id,
    'publicName', v_company.public_name,
    'companyStatus', v_company.status,
    'setupCompleted', v_company.setup_completed,
    'canPlanNext', v_company.status = 'active' AND v_company.setup_completed,
    'currentGameYear', public.rockmundo_game_year(),
    'editions', v_editions
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_festival_company_editions(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_festival_company_editions(uuid) TO authenticated;

COMMENT ON FUNCTION public.get_festival_company_editions(uuid) IS
  'Owner/admin read model for canonical festival_editions_v2. Returns annual editions without exposing legacy festival rows.';

NOTIFY pgrst, 'reload schema';
