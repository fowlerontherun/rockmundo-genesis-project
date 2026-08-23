-- Production reconciliation extension for Festival licence operating ceilings.
-- Infrastructure may be owned ahead of the licence, while active stages and confirmed acts
-- remain constrained by the current licence at projection/run time.

CREATE OR REPLACE FUNCTION public._festival_active_licence_max_stages(
  p_festival_company_id uuid,
  p_at timestamptz DEFAULT now()
)
RETURNS integer
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT tier.max_stages
  FROM public.festival_company_licences licence
  JOIN public.festival_licence_tiers tier ON tier.key = licence.tier_key
  WHERE licence.festival_company_id = p_festival_company_id
    AND licence.status = 'active'
    AND coalesce(licence.valid_from, '-infinity'::timestamptz) <= p_at
    AND coalesce(licence.valid_until, 'infinity'::timestamptz) > p_at
  ORDER BY tier.rank DESC
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public._festival_active_licence_max_acts_per_day(
  p_festival_company_id uuid,
  p_at timestamptz DEFAULT now()
)
RETURNS integer
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT tier.max_acts_per_day
  FROM public.festival_company_licences licence
  JOIN public.festival_licence_tiers tier ON tier.key = licence.tier_key
  WHERE licence.festival_company_id = p_festival_company_id
    AND licence.status = 'active'
    AND coalesce(licence.valid_from, '-infinity'::timestamptz) <= p_at
    AND coalesce(licence.valid_until, 'infinity'::timestamptz) > p_at
  ORDER BY tier.rank DESC
  LIMIT 1;
$$;

DO $$
DECLARE
  definition text;
  canonical_old text := 'stage_count := least(scale.maximum_stages, greatest(1, scale.minimum_stages));';
  canonical_new text := 'stage_count := least(scale.maximum_stages, greatest(1, scale.minimum_stages), coalesce(public._festival_active_licence_max_stages(edition.festival_company_id, now()), scale.maximum_stages));';
  production_old text := 'stage_count:=least(scale.maximum_stages,greatest(1,scale.minimum_stages));';
  production_new text := 'stage_count:=least(scale.maximum_stages,greatest(1,scale.minimum_stages),coalesce(public._festival_active_licence_max_stages(e.festival_company_id,now()),scale.maximum_stages));';
BEGIN
  SELECT pg_get_functiondef('public.materialize_festival_edition_foundations(uuid,uuid)'::regprocedure)
  INTO definition;

  IF position('_festival_active_licence_max_stages(' IN definition) > 0 THEN
    NULL;
  ELSIF position(canonical_old IN definition) > 0 THEN
    definition := replace(definition, canonical_old, canonical_new);
    EXECUTE definition;
  ELSIF position(production_old IN definition) > 0 THEN
    definition := replace(definition, production_old, production_new);
    EXECUTE definition;
  ELSE
    RAISE EXCEPTION 'festival_materializer_stage_expression_not_found';
  END IF;
END
$$;

DO $$
BEGIN
  IF to_regprocedure('public._simplified_festival_run_readiness_pre_operating_ceiling(uuid,uuid)') IS NULL THEN
    ALTER FUNCTION public._simplified_festival_run_readiness(uuid, uuid)
      RENAME TO _simplified_festival_run_readiness_pre_operating_ceiling;
  END IF;
END
$$;

CREATE OR REPLACE FUNCTION public._simplified_festival_run_readiness(
  p_festival_company_id uuid,
  p_festival_edition_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  result jsonb;
  edition public.festival_editions_v2%ROWTYPE;
  site_id uuid;
  stage_count integer := 0;
  confirmed_acts integer := 0;
  max_stages integer;
  max_acts_per_day integer;
  duration_days integer := 1;
  blockers jsonb;
BEGIN
  result := public._simplified_festival_run_readiness_pre_operating_ceiling(
    p_festival_company_id,
    p_festival_edition_id
  );

  IF coalesce((result->>'alreadyRun')::boolean, false) THEN
    RETURN result;
  END IF;

  SELECT * INTO edition
  FROM public.festival_editions_v2
  WHERE id = p_festival_edition_id
    AND festival_company_id = p_festival_company_id;

  IF NOT FOUND THEN
    RETURN result;
  END IF;

  SELECT site.id INTO site_id
  FROM public.festival_site_plans site
  WHERE site.festival_edition_id = p_festival_edition_id
  ORDER BY site.updated_at DESC
  LIMIT 1;

  IF site_id IS NOT NULL THEN
    SELECT count(*)::integer INTO stage_count
    FROM public.festival_site_plan_stages stage
    WHERE stage.festival_site_plan_id = site_id
      AND stage.status = 'ready';
  END IF;

  SELECT count(*)::integer INTO confirmed_acts
  FROM public.festival_artist_bookings booking
  JOIN public.festival_artist_programmes programme
    ON programme.id = booking.festival_artist_programme_id
  WHERE programme.festival_company_id = p_festival_company_id
    AND programme.festival_edition_id = p_festival_edition_id
    AND booking.status NOT IN ('cancelled', 'artist_withdrawn', 'festival_cancelled');

  max_stages := public._festival_active_licence_max_stages(p_festival_company_id, now());
  max_acts_per_day := public._festival_active_licence_max_acts_per_day(p_festival_company_id, now());
  duration_days := greatest(
    1,
    coalesce(
      edition.duration_days,
      CASE
        WHEN edition.starts_on IS NOT NULL AND edition.ends_on IS NOT NULL
          THEN (edition.ends_on - edition.starts_on) + 1
        ELSE 1
      END
    )
  );

  blockers := coalesce(result->'blockers', '[]'::jsonb);

  IF max_stages IS NOT NULL
     AND stage_count > max_stages
     AND NOT EXISTS (
       SELECT 1 FROM jsonb_array_elements(blockers) blocker
       WHERE blocker->>'code' = 'festival_licence_stage_limit_exceeded'
     ) THEN
    blockers := blockers || jsonb_build_array(jsonb_build_object(
      'code', 'festival_licence_stage_limit_exceeded',
      'message', 'The active Festival licence allows ' || max_stages::text || ' stage' || CASE WHEN max_stages = 1 THEN '' ELSE 's' END || '. Extra built stage capability stays owned but cannot be used until the licence is upgraded.'
    ));
  END IF;

  IF max_acts_per_day IS NOT NULL
     AND confirmed_acts > max_acts_per_day * duration_days
     AND NOT EXISTS (
       SELECT 1 FROM jsonb_array_elements(blockers) blocker
       WHERE blocker->>'code' IN ('festival_licence_act_limit_exceeded', 'festival_licence_acts_limit_exceeded')
     ) THEN
    blockers := blockers || jsonb_build_array(jsonb_build_object(
      'code', 'festival_licence_act_limit_exceeded',
      'message', 'The confirmed line-up exceeds the active licence limit of ' || max_acts_per_day::text || ' acts per day. Reduce confirmed acts or upgrade the licence.'
    ));
  END IF;

  RETURN result
    || jsonb_build_object(
      'stageCount', stage_count,
      'confirmedActs', confirmed_acts,
      'licensedStageLimit', max_stages,
      'licensedActsPerDay', max_acts_per_day,
      'blockers', blockers,
      'canRun', jsonb_array_length(blockers) = 0
    );
END;
$$;

REVOKE ALL ON FUNCTION public._festival_active_licence_max_stages(uuid, timestamptz)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public._festival_active_licence_max_acts_per_day(uuid, timestamptz)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public._simplified_festival_run_readiness_pre_operating_ceiling(uuid, uuid)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public._simplified_festival_run_readiness(uuid, uuid)
  FROM PUBLIC, anon, authenticated;

DO $$
DECLARE
  row record;
BEGIN
  FOR row IN
    SELECT edition.festival_company_id, edition.id
    FROM public.festival_editions_v2 edition
    WHERE edition.status NOT IN ('completed', 'cancelled')
      AND edition.locked_at IS NULL
      AND edition.starts_on IS NOT NULL
      AND edition.ends_on IS NOT NULL
      AND edition.city_id IS NOT NULL
      AND edition.site_type IS NOT NULL
      AND edition.festival_scale IS NOT NULL
      AND coalesce(edition.expected_capacity, 0) > 0
  LOOP
    BEGIN
      PERFORM public.materialize_festival_edition_foundations(
        row.festival_company_id,
        row.id
      );
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'Festival foundation rematerialisation skipped for edition %: %', row.id, SQLERRM;
    END;
  END LOOP;
END
$$;

NOTIFY pgrst, 'reload schema';
