-- Bridge the active festival_editions_v2 owner routes to the existing revisioned
-- scheduling authority, whose foreign keys remain on public.festival_editions.
-- Each v2 annual edition receives a dedicated hidden compatibility aggregate so
-- schedule/runtime resolution can never drift onto another festival year.

CREATE TABLE IF NOT EXISTS public.festival_v2_schedule_bridges (
  festival_edition_id uuid PRIMARY KEY REFERENCES public.festival_editions_v2(id) ON DELETE CASCADE,
  festival_company_id uuid NOT NULL REFERENCES public.festival_companies(id) ON DELETE CASCADE,
  schedule_festival_id uuid NOT NULL UNIQUE REFERENCES public.festivals(id) ON DELETE CASCADE,
  schedule_edition_id uuid NOT NULL UNIQUE REFERENCES public.festival_editions(id) ON DELETE CASCADE,
  provenance text NOT NULL DEFAULT 'v2_schedule_shadow',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (festival_company_id, festival_edition_id)
);

ALTER TABLE public.festival_v2_schedule_bridges ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.festival_v2_schedule_bridges FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.ensure_festival_v2_schedule_bridge(
  p_festival_edition_id uuid
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_actor uuid := public.current_profile_id_safe();
  v_edition public.festival_editions_v2%ROWTYPE;
  v_company public.festival_companies%ROWTYPE;
  v_bridge public.festival_v2_schedule_bridges%ROWTYPE;
  v_schedule_festival_id uuid;
  v_schedule_edition_id uuid;
  v_existing_schedule_editions uuid[];
  v_existing_schedule_festivals uuid[];
  v_city_id uuid;
  v_time_zone text;
  v_start_at timestamptz;
  v_end_at timestamptz;
  v_schedule_status public.festival_edition_status;
BEGIN
  IF v_actor IS NULL THEN
    RAISE EXCEPTION 'FESTIVAL_SCHEDULE_ACCESS_DENIED' USING ERRCODE = 'P0001';
  END IF;

  PERFORM pg_advisory_xact_lock(
    hashtextextended('festival-v2-schedule:' || p_festival_edition_id::text, 0)
  );

  SELECT * INTO v_edition
  FROM public.festival_editions_v2
  WHERE id = p_festival_edition_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'FESTIVAL_SCHEDULE_EDITION_NOT_FOUND' USING ERRCODE = 'P0001';
  END IF;

  SELECT * INTO v_company
  FROM public.festival_companies
  WHERE id = v_edition.festival_company_id;

  IF NOT FOUND OR (
    v_company.owner_profile_id <> v_actor
    AND NOT coalesce(public.is_admin(auth.uid()), false)
  ) THEN
    RAISE EXCEPTION 'FESTIVAL_SCHEDULE_ACCESS_DENIED' USING ERRCODE = 'P0001';
  END IF;

  SELECT * INTO v_bridge
  FROM public.festival_v2_schedule_bridges
  WHERE festival_edition_id = v_edition.id;

  IF FOUND THEN
    RETURN jsonb_build_object(
      'festivalCompanyId', v_bridge.festival_company_id,
      'festivalEditionId', v_bridge.festival_edition_id,
      'scheduleFestivalId', v_bridge.schedule_festival_id,
      'scheduleEditionId', v_bridge.schedule_edition_id,
      'timeZone', coalesce(
        (SELECT e.time_zone FROM public.festival_editions e WHERE e.id = v_bridge.schedule_edition_id),
        'UTC'
      ),
      'created', false
    );
  END IF;

  -- Reuse a pre-existing, unambiguous route/runtime bridge where one exists.
  SELECT
    array_agg(DISTINCT mapping.edition_id),
    array_agg(DISTINCT bridge.legacy_festival_id)
  INTO v_existing_schedule_editions, v_existing_schedule_festivals
  FROM public.festival_public_legacy_bridges bridge
  JOIN public.festival_legacy_mappings mapping
    ON mapping.legacy_id = bridge.legacy_festival_id
    OR mapping.legacy_festival_id = bridge.legacy_festival_id
  WHERE bridge.festival_company_id = v_company.id
    AND bridge.festival_edition_id = v_edition.id;

  IF coalesce(cardinality(v_existing_schedule_editions), 0) > 1
     OR coalesce(cardinality(v_existing_schedule_festivals), 0) > 1 THEN
    RAISE EXCEPTION 'FESTIVAL_SCHEDULE_BRIDGE_AMBIGUOUS' USING ERRCODE = 'P0001';
  END IF;

  IF cardinality(v_existing_schedule_editions) = 1
     AND cardinality(v_existing_schedule_festivals) = 1 THEN
    v_schedule_edition_id := v_existing_schedule_editions[1];
    v_schedule_festival_id := v_existing_schedule_festivals[1];

    INSERT INTO public.festival_v2_schedule_bridges(
      festival_edition_id,
      festival_company_id,
      schedule_festival_id,
      schedule_edition_id,
      provenance
    ) VALUES (
      v_edition.id,
      v_company.id,
      v_schedule_festival_id,
      v_schedule_edition_id,
      'existing_legacy_bridge'
    )
    ON CONFLICT (festival_edition_id) DO NOTHING
    RETURNING * INTO v_bridge;

    IF v_bridge.festival_edition_id IS NULL THEN
      SELECT * INTO v_bridge
      FROM public.festival_v2_schedule_bridges
      WHERE festival_edition_id = v_edition.id;
    END IF;

    RETURN jsonb_build_object(
      'festivalCompanyId', v_bridge.festival_company_id,
      'festivalEditionId', v_bridge.festival_edition_id,
      'scheduleFestivalId', v_bridge.schedule_festival_id,
      'scheduleEditionId', v_bridge.schedule_edition_id,
      'timeZone', coalesce(
        (SELECT e.time_zone FROM public.festival_editions e WHERE e.id = v_bridge.schedule_edition_id),
        'UTC'
      ),
      'created', false
    );
  END IF;

  v_city_id := coalesce(v_edition.city_id, v_company.default_city_id);
  IF v_city_id IS NULL OR v_edition.starts_on IS NULL OR v_edition.ends_on IS NULL THEN
    RAISE EXCEPTION 'FESTIVAL_SCHEDULE_SETUP_INCOMPLETE' USING ERRCODE = 'P0001';
  END IF;

  SELECT coalesce(timezone, 'UTC') INTO v_time_zone
  FROM public.cities
  WHERE id = v_city_id;

  IF v_time_zone IS NULL THEN
    RAISE EXCEPTION 'FESTIVAL_SCHEDULE_SETUP_INCOMPLETE' USING ERRCODE = 'P0001';
  END IF;

  v_start_at := (
    v_edition.starts_on::text || ' 00:00:00'
  )::timestamp AT TIME ZONE v_time_zone;
  v_end_at := (
    (v_edition.ends_on + 1)::text || ' 00:00:00'
  )::timestamp AT TIME ZONE v_time_zone - interval '1 second';

  v_schedule_status := CASE v_edition.status
    WHEN 'announced' THEN 'announced'::public.festival_edition_status
    WHEN 'live' THEN 'live'::public.festival_edition_status
    WHEN 'completed' THEN 'completed'::public.festival_edition_status
    WHEN 'cancelled' THEN 'cancelled'::public.festival_edition_status
    WHEN 'locked' THEN 'setup'::public.festival_edition_status
    ELSE 'planning'::public.festival_edition_status
  END;

  INSERT INTO public.festivals(
    name,
    city_id,
    start_date,
    end_date,
    expected_attendance,
    metadata,
    owner_type,
    owner_profile_id,
    owner_company_id
  ) VALUES (
    v_edition.name,
    v_city_id,
    v_edition.starts_on,
    v_edition.ends_on,
    v_edition.expected_capacity,
    jsonb_build_object(
      'hiddenCompatibilityAggregate', true,
      'festivalCompanyId', v_company.id,
      'festivalEditionV2Id', v_edition.id,
      'authority', 'festival_editions_v2'
    ),
    'player',
    v_company.owner_profile_id,
    v_company.company_id
  )
  RETURNING id INTO v_schedule_festival_id;

  INSERT INTO public.festival_editions(
    festival_id,
    edition_number,
    edition_year,
    title,
    city_id,
    start_at,
    end_at,
    timezone,
    time_zone,
    expected_attendance,
    capacity,
    status,
    legacy_metadata,
    created_by
  ) VALUES (
    v_schedule_festival_id,
    1,
    v_edition.edition_year,
    v_edition.name,
    v_city_id,
    v_start_at,
    v_end_at,
    v_time_zone,
    v_time_zone,
    v_edition.expected_capacity,
    v_edition.expected_capacity,
    v_schedule_status,
    jsonb_build_object(
      'source', 'festival_editions_v2_schedule_bridge',
      'festivalCompanyId', v_company.id,
      'festivalEditionV2Id', v_edition.id
    ),
    v_actor
  )
  RETURNING id INTO v_schedule_edition_id;

  INSERT INTO public.festival_legacy_mappings(
    edition_id,
    legacy_source,
    legacy_id,
    legacy_festival_id,
    metadata
  ) VALUES (
    v_schedule_edition_id,
    'dedicated_festival_row',
    v_schedule_festival_id,
    v_schedule_festival_id,
    jsonb_build_object(
      'source', 'festival_editions_v2_schedule_bridge',
      'historical_only', false,
      'festivalEditionV2Id', v_edition.id
    )
  );

  INSERT INTO public.festival_public_legacy_bridges(
    legacy_festival_id,
    festival_company_id,
    festival_edition_id,
    provenance
  ) VALUES (
    v_schedule_festival_id,
    v_company.id,
    v_edition.id,
    'v2_schedule_shadow'
  );

  INSERT INTO public.festival_v2_schedule_bridges(
    festival_edition_id,
    festival_company_id,
    schedule_festival_id,
    schedule_edition_id,
    provenance
  ) VALUES (
    v_edition.id,
    v_company.id,
    v_schedule_festival_id,
    v_schedule_edition_id,
    'v2_schedule_shadow'
  )
  RETURNING * INTO v_bridge;

  RETURN jsonb_build_object(
    'festivalCompanyId', v_bridge.festival_company_id,
    'festivalEditionId', v_bridge.festival_edition_id,
    'scheduleFestivalId', v_bridge.schedule_festival_id,
    'scheduleEditionId', v_bridge.schedule_edition_id,
    'timeZone', v_time_zone,
    'created', true
  );
END;
$$;

REVOKE ALL ON FUNCTION public.ensure_festival_v2_schedule_bridge(uuid)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ensure_festival_v2_schedule_bridge(uuid)
  TO authenticated;

COMMENT ON TABLE public.festival_v2_schedule_bridges IS
  'One-to-one bridge from an active Festival company annual edition to the existing revisioned schedule aggregate.';
COMMENT ON FUNCTION public.ensure_festival_v2_schedule_bridge(uuid) IS
  'Owner/admin-authorised, idempotent provisioning and resolution of the schedule aggregate for a festival_editions_v2 annual edition.';
