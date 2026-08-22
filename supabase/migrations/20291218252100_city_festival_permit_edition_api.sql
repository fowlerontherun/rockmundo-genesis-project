-- Edition-scoped owner API used by the annual Festival UI. The earlier company-level
-- compatibility functions remain available, but new gameplay should always identify
-- the exact annual Festival being permitted.

CREATE OR REPLACE FUNCTION public.get_festival_city_permit_status_for_edition(
  p_festival_edition_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  actor uuid := public._caller_profile_id();
  edition public.festival_editions_v2%ROWTYPE;
  law public.city_laws%ROWTYPE;
  permit public.city_festival_permits%ROWTYPE;
BEGIN
  SELECT * INTO edition
  FROM public.festival_editions_v2
  WHERE id=p_festival_edition_id;
  IF edition.id IS NULL THEN
    RAISE EXCEPTION 'festival_permit_edition_not_found' USING ERRCODE='P0001';
  END IF;
  IF auth.uid() IS NULL OR actor IS NULL
     OR NOT public._festival_company_manager_authorized(edition.festival_company_id,actor) THEN
    RAISE EXCEPTION 'festival_permit_forbidden' USING ERRCODE='P0001';
  END IF;

  law := public._festival_city_law_for_edition(edition.id);
  SELECT * INTO permit
  FROM public.city_festival_permits
  WHERE festival_edition_id=edition.id
  ORDER BY applied_at DESC
  LIMIT 1;

  RETURN jsonb_build_object(
    'festivalCompanyId',edition.festival_company_id,
    'festivalEditionId',edition.id,
    'cityId',edition.city_id,
    'startsOn',edition.starts_on,
    'permitRequired',coalesce(law.festival_permit_required,false),
    'cityLawId',law.id,
    'permitId',permit.id,
    'status',CASE
      WHEN edition.city_id IS NULL OR edition.starts_on IS NULL THEN 'not_ready'
      WHEN NOT coalesce(law.festival_permit_required,false) THEN 'not_required'
      WHEN permit.id IS NULL THEN 'not_applied'
      ELSE permit.status
    END,
    'applicationNote',permit.application_note,
    'decisionReason',permit.decision_reason,
    'appliedAt',permit.applied_at,
    'decidedAt',permit.decided_at
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.apply_for_festival_city_permit_for_edition(
  p_festival_edition_id uuid,
  p_idempotency_key uuid,
  p_application_note text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  actor uuid := public._caller_profile_id();
  edition public.festival_editions_v2%ROWTYPE;
  law public.city_laws%ROWTYPE;
  existing public.city_festival_permits%ROWTYPE;
  permit public.city_festival_permits%ROWTYPE;
BEGIN
  SELECT * INTO edition
  FROM public.festival_editions_v2
  WHERE id=p_festival_edition_id
  FOR UPDATE;
  IF edition.id IS NULL THEN
    RAISE EXCEPTION 'festival_permit_edition_not_found' USING ERRCODE='P0001';
  END IF;
  IF auth.uid() IS NULL OR actor IS NULL OR p_idempotency_key IS NULL
     OR NOT public._festival_company_manager_authorized(edition.festival_company_id,actor) THEN
    RAISE EXCEPTION 'festival_permit_forbidden' USING ERRCODE='P0001';
  END IF;
  IF edition.city_id IS NULL OR edition.starts_on IS NULL THEN
    RAISE EXCEPTION 'festival_permit_edition_not_ready' USING ERRCODE='P0001';
  END IF;
  IF p_application_note IS NOT NULL AND char_length(p_application_note)>2000 THEN
    RAISE EXCEPTION 'festival_permit_application_invalid' USING ERRCODE='P0001';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended(edition.id::text||p_idempotency_key::text,0));
  law := public._festival_city_law_for_edition(edition.id);

  SELECT * INTO existing
  FROM public.city_festival_permits
  WHERE festival_company_id=edition.festival_company_id
    AND applied_by_profile_id=actor
    AND application_idempotency_key=p_idempotency_key
  FOR UPDATE;
  IF existing.id IS NOT NULL THEN
    IF existing.festival_edition_id<>edition.id THEN
      RAISE EXCEPTION 'festival_permit_idempotency_conflict' USING ERRCODE='P0001';
    END IF;
    RETURN jsonb_build_object('permitId',existing.id,'festivalEditionId',existing.festival_edition_id,'cityId',existing.city_id,'status',existing.status,'idempotent',true);
  END IF;

  IF NOT coalesce(law.festival_permit_required,false) THEN
    RAISE EXCEPTION 'festival_permit_not_required' USING ERRCODE='P0001';
  END IF;
  IF EXISTS(SELECT 1 FROM public.city_festival_permits WHERE festival_edition_id=edition.id AND status IN('pending','approved')) THEN
    RAISE EXCEPTION 'festival_permit_already_open' USING ERRCODE='P0001';
  END IF;

  INSERT INTO public.city_festival_permits(
    festival_edition_id,festival_company_id,city_id,city_law_id,status,
    application_note,applied_by_profile_id,application_idempotency_key
  ) VALUES (
    edition.id,edition.festival_company_id,edition.city_id,law.id,'pending',
    nullif(btrim(p_application_note),''),actor,p_idempotency_key
  ) RETURNING * INTO permit;

  RETURN jsonb_build_object('permitId',permit.id,'festivalEditionId',edition.id,'cityId',edition.city_id,'status',permit.status,'idempotent',false);
END;
$$;

REVOKE ALL ON FUNCTION public.get_festival_city_permit_status_for_edition(uuid) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.apply_for_festival_city_permit_for_edition(uuid,uuid,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.get_festival_city_permit_status_for_edition(uuid) TO authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.apply_for_festival_city_permit_for_edition(uuid,uuid,text) TO authenticated,service_role;
