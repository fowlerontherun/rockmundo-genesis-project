-- Project the selected annual edition's bound site-plan stages into the retained
-- revisioned schedule aggregate. Existing schedule-specific operating hours are
-- never overwritten; only missing rows are seeded from the planning defaults.

CREATE OR REPLACE FUNCTION public.ensure_festival_v2_schedule_workspace(
  p_festival_edition_id uuid
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_bridge jsonb;
  v_schedule_festival_id uuid;
  v_schedule_edition_id uuid;
  v_company_id uuid;
  v_actor uuid := public.current_profile_id_safe();
  v_plan public.festival_site_plans%ROWTYPE;
  v_source record;
  v_target_stage_id uuid;
  v_stage_type text;
  v_festival_date date;
  v_synced integer := 0;
  v_seeded_hours integer := 0;
BEGIN
  v_bridge := public.ensure_festival_v2_schedule_bridge(p_festival_edition_id);
  v_schedule_festival_id := (v_bridge->>'scheduleFestivalId')::uuid;
  v_schedule_edition_id := (v_bridge->>'scheduleEditionId')::uuid;
  v_company_id := (v_bridge->>'festivalCompanyId')::uuid;

  SELECT * INTO v_plan
  FROM public.festival_site_plans
  WHERE festival_company_id = v_company_id
    AND festival_edition_id = p_festival_edition_id;

  IF NOT FOUND THEN
    RETURN v_bridge || jsonb_build_object(
      'stagesSynced', 0,
      'operatingHoursSeeded', 0,
      'sitePlanBound', false
    );
  END IF;

  FOR v_source IN
    SELECT stage.*
    FROM public.festival_site_plan_stages stage
    WHERE stage.festival_site_plan_id = v_plan.id
    ORDER BY stage.sort_order, stage.id
  LOOP
    v_stage_type := CASE v_source.stage_type
      WHEN 'main' THEN 'main'
      WHEN 'acoustic' THEN 'acoustic'
      WHEN 'dance' THEN 'club'
      WHEN 'specialist' THEN 'experimental'
      WHEN 'community' THEN 'tent'
      ELSE 'second'
    END;

    SELECT id INTO v_target_stage_id
    FROM public.festival_stages
    WHERE edition_id = v_schedule_edition_id
      AND idempotency_key = 'v2-site-stage:' || v_source.id::text
    LIMIT 1;

    IF v_target_stage_id IS NULL THEN
      PERFORM public.create_festival_edition_stage(
        p_edition_id => v_schedule_edition_id,
        p_name => v_source.name,
        p_type => v_stage_type,
        p_capacity => v_source.capacity,
        p_stage_size => v_source.production_complexity,
        p_sound_capability => CASE
          WHEN v_source.sound_quality IS NULL THEN NULL
          ELSE 'quality_' || v_source.sound_quality::text
        END,
        p_lighting_capability => CASE
          WHEN v_source.lighting_quality IS NULL THEN NULL
          ELSE 'quality_' || v_source.lighting_quality::text
        END,
        p_weather_protection => CASE
          WHEN v_source.indoor THEN 'indoor'
          WHEN v_source.covered THEN 'covered'
          ELSE 'open_air'
        END,
        p_changeover_duration => v_source.changeover_minutes,
        p_curfew => v_source.closes_at,
        p_technical_metadata => jsonb_build_object(
          'source', 'festival_site_plan_stages',
          'sourceStageId', v_source.id,
          'minimumArtistFame', v_source.minimum_artist_fame,
          'performanceAreaQuality', v_source.performance_area_quality,
          'accessibleViewingCapacity', v_source.accessible_viewing_capacity,
          'headlineSlotMinutes', v_source.headline_slot_minutes,
          'standardSlotMinutes', v_source.standard_slot_minutes
        ),
        p_public_metadata => jsonb_build_object(
          'sourceStageId', v_source.id,
          'slug', v_source.slug,
          'festivalEditionV2Id', p_festival_edition_id
        ),
        p_idempotency_key => 'v2-site-stage:' || v_source.id::text
      );

      SELECT id INTO v_target_stage_id
      FROM public.festival_stages
      WHERE edition_id = v_schedule_edition_id
        AND idempotency_key = 'v2-site-stage:' || v_source.id::text
      LIMIT 1;
    ELSE
      UPDATE public.festival_stages
      SET stage_name = v_source.name,
          public_name = v_source.name,
          stage_type = v_stage_type,
          capacity = v_source.capacity,
          stage_size = v_source.production_complexity,
          sound_capability = CASE
            WHEN v_source.sound_quality IS NULL THEN NULL
            ELSE 'quality_' || v_source.sound_quality::text
          END,
          lighting_capability = CASE
            WHEN v_source.lighting_quality IS NULL THEN NULL
            ELSE 'quality_' || v_source.lighting_quality::text
          END,
          weather_protection = CASE
            WHEN v_source.indoor THEN 'indoor'
            WHEN v_source.covered THEN 'covered'
            ELSE 'open_air'
          END,
          default_changeover_minutes = v_source.changeover_minutes,
          curfew_time = v_source.closes_at,
          technical_metadata = coalesce(technical_metadata, '{}'::jsonb) || jsonb_build_object(
            'source', 'festival_site_plan_stages',
            'sourceStageId', v_source.id,
            'minimumArtistFame', v_source.minimum_artist_fame,
            'performanceAreaQuality', v_source.performance_area_quality,
            'accessibleViewingCapacity', v_source.accessible_viewing_capacity,
            'headlineSlotMinutes', v_source.headline_slot_minutes,
            'standardSlotMinutes', v_source.standard_slot_minutes
          ),
          public_metadata = coalesce(public_metadata, '{}'::jsonb) || jsonb_build_object(
            'sourceStageId', v_source.id,
            'slug', v_source.slug,
            'festivalEditionV2Id', p_festival_edition_id
          ),
          archived_at = NULL,
          updated_at = now()
      WHERE id = v_target_stage_id;
    END IF;

    IF v_target_stage_id IS NULL THEN
      RAISE EXCEPTION 'FESTIVAL_SCHEDULE_STAGE_SYNC_FAILED' USING ERRCODE = 'P0001';
    END IF;

    UPDATE public.festival_stages
    SET public_name = v_source.name
    WHERE id = v_target_stage_id
      AND public_name IS DISTINCT FROM v_source.name;

    v_synced := v_synced + 1;

    FOR v_festival_date IN
      SELECT day::date
      FROM generate_series(
        (SELECT starts_on FROM public.festival_editions_v2 WHERE id = p_festival_edition_id),
        (SELECT ends_on FROM public.festival_editions_v2 WHERE id = p_festival_edition_id),
        interval '1 day'
      ) AS day
    LOOP
      IF NOT EXISTS (
        SELECT 1
        FROM public.festival_stage_operating_hours hours
        WHERE hours.stage_id = v_target_stage_id
          AND hours.festival_date = v_festival_date
      ) THEN
        PERFORM public.festival_schedule_configure_stage_hours(
          p_edition_id => v_schedule_edition_id,
          p_stage_id => v_target_stage_id,
          p_festival_date => v_festival_date,
          p_opening_time => v_source.opens_at,
          p_curfew => v_source.closes_at,
          p_shutdown_buffer_minutes => 0,
          p_changeover_minutes => v_source.changeover_minutes,
          p_idempotency_key => 'v2-stage-hours:' || v_source.id::text || ':' || v_festival_date::text
        );
        v_seeded_hours := v_seeded_hours + 1;
      END IF;
    END LOOP;
  END LOOP;

  RETURN v_bridge || jsonb_build_object(
    'stagesSynced', v_synced,
    'operatingHoursSeeded', v_seeded_hours,
    'sitePlanBound', true
  );
END;
$$;

REVOKE ALL ON FUNCTION public.ensure_festival_v2_schedule_workspace(uuid)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ensure_festival_v2_schedule_workspace(uuid)
  TO authenticated;

COMMENT ON FUNCTION public.ensure_festival_v2_schedule_workspace(uuid) IS
  'Resolves/provisions the annual edition schedule bridge and idempotently projects only the site-plan stages bound to that festival_editions_v2 row.';
