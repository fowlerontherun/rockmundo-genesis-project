CREATE OR REPLACE FUNCTION public._simplified_festival_run_readiness_pre_operating_ceiling(
  p_festival_company_id uuid,
  p_festival_edition_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  e public.festival_editions_v2%ROWTYPE;
  ticket public.festival_ticket_plans%ROWTYPE;
  programme public.festival_artist_programmes%ROWTYPE;
  stage_count integer := 0;
  confirmed_acts integer := 0;
  confirmed_player_acts integer := 0;
  active_licence jsonb;
  max_attendance integer;
  max_days integer;
  already_run boolean := false;
  blockers jsonb := '[]'::jsonb;
  duration integer;
BEGIN
  SELECT * INTO e
  FROM public.festival_editions_v2
  WHERE id = p_festival_edition_id
    AND festival_company_id = p_festival_company_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'festival_edition_not_found' USING ERRCODE = 'P0001';
  END IF;

  SELECT * INTO ticket
  FROM public.festival_ticket_plans
  WHERE festival_company_id = p_festival_company_id
    AND festival_edition_id = p_festival_edition_id;

  SELECT * INTO programme
  FROM public.festival_artist_programmes
  WHERE festival_company_id = p_festival_company_id
    AND festival_edition_id = p_festival_edition_id;

  SELECT count(*)::integer INTO stage_count
  FROM public.festival_site_plan_stages st
  JOIN public.festival_site_plans sp ON sp.id = st.festival_site_plan_id
  WHERE sp.festival_edition_id = e.id
    AND st.status = 'ready';

  IF programme.id IS NOT NULL THEN
    SELECT
      count(*)::integer,
      count(*) FILTER (
        WHERE b.artist_type IN ('solo', 'band')
          AND (
            (b.artist_type = 'solo' AND b.artist_profile_id IS NOT NULL)
            OR (b.artist_type = 'band' AND b.band_id IS NOT NULL)
          )
      )::integer
    INTO confirmed_acts, confirmed_player_acts
    FROM public.festival_artist_bookings b
    WHERE b.festival_artist_programme_id = programme.id
      AND b.status IN ('confirmed', 'awaiting_schedule', 'scheduled');
  END IF;

  SELECT
    jsonb_build_object(
      'tierKey', t.key,
      'displayName', t.display_name,
      'maxAttendance', t.max_attendance,
      'maxDays', t.max_days,
      'maxStages', t.max_stages,
      'maxActsPerDay', t.max_acts_per_day
    ),
    t.max_attendance,
    t.max_days
  INTO active_licence, max_attendance, max_days
  FROM public.festival_company_licences l
  JOIN public.festival_licence_tiers t ON t.key = l.tier_key
  WHERE l.festival_company_id = p_festival_company_id
    AND l.status = 'active'
    AND coalesce(l.valid_from, '-infinity'::timestamptz) <= now()
    AND coalesce(l.valid_until, 'infinity'::timestamptz) > now()
  ORDER BY t.rank DESC
  LIMIT 1;

  SELECT EXISTS (
    SELECT 1
    FROM public.festival_edition_runtimes r
    WHERE r.edition_id = e.id
      AND r.state = 'completed'
  ) INTO already_run;

  duration := coalesce(
    e.duration_days,
    CASE
      WHEN e.starts_on IS NOT NULL AND e.ends_on IS NOT NULL
        THEN (e.ends_on - e.starts_on) + 1
      ELSE 0
    END
  );

  IF e.status IN ('cancelled') THEN
    blockers := blockers || jsonb_build_array(jsonb_build_object(
      'code', 'festival_cancelled',
      'message', 'This Festival edition has been cancelled.'
    ));
  END IF;

  IF e.planning_status <> 'ready' OR e.readiness_score < 100 THEN
    blockers := blockers || jsonb_build_array(jsonb_build_object(
      'code', 'festival_plan_not_ready',
      'message', 'Complete the annual Festival plan before running the event.'
    ));
  END IF;

  IF e.starts_on IS NULL OR e.ends_on IS NULL THEN
    blockers := blockers || jsonb_build_array(jsonb_build_object(
      'code', 'festival_dates_required',
      'message', 'Festival dates are required.'
    ));
  ELSIF current_date < e.starts_on THEN
    blockers := blockers || jsonb_build_array(jsonb_build_object(
      'code', 'festival_not_due',
      'message', 'The Festival cannot run before its scheduled start date.'
    ));
  END IF;

  IF stage_count = 0 THEN
    blockers := blockers || jsonb_build_array(jsonb_build_object(
      'code', 'festival_stages_not_ready',
      'message', 'The internal stage plan is not ready.'
    ));
  END IF;

  IF ticket.id IS NULL THEN
    blockers := blockers || jsonb_build_array(jsonb_build_object(
      'code', 'festival_ticket_plan_missing',
      'message', 'Set the Festival ticket price before running the event.'
    ));
  ELSIF ticket.owner_confirmed_at IS NULL THEN
    blockers := blockers || jsonb_build_array(jsonb_build_object(
      'code', 'festival_tickets_not_confirmed',
      'message', 'Confirm the Festival ticket plan before running the event.'
    ));
  END IF;

  IF programme.id IS NULL OR confirmed_player_acts = 0 THEN
    blockers := blockers || jsonb_build_array(jsonb_build_object(
      'code', 'festival_player_act_required',
      'message', 'Confirm at least one player solo artist or band before running the Festival. NPC acts only fill remaining slots.'
    ));
  END IF;

  IF active_licence IS NULL THEN
    blockers := blockers || jsonb_build_array(jsonb_build_object(
      'code', 'festival_licence_required',
      'message', 'An active Festival licence is required.'
    ));
  ELSE
    IF max_attendance IS NOT NULL AND coalesce(e.expected_capacity, 0) > max_attendance THEN
      blockers := blockers || jsonb_build_array(jsonb_build_object(
        'code', 'festival_licence_capacity_exceeded',
        'message', 'The planned attendance exceeds the active Festival licence.'
      ));
    END IF;

    IF max_days IS NOT NULL AND duration > max_days THEN
      blockers := blockers || jsonb_build_array(jsonb_build_object(
        'code', 'festival_licence_duration_exceeded',
        'message', 'The planned Festival duration exceeds the active licence.'
      ));
    END IF;
  END IF;

  IF already_run THEN
    blockers := blockers || jsonb_build_array(jsonb_build_object(
      'code', 'festival_already_run',
      'message', 'This Festival edition has already been completed.'
    ));
  END IF;

  RETURN jsonb_build_object(
    'festivalCompanyId', e.festival_company_id,
    'festivalEditionId', e.id,
    'editionVersion', e.version,
    'editionStatus', e.status,
    'planningStatus', e.planning_status,
    'readinessScore', e.readiness_score,
    'scheduledFor', e.starts_on,
    'stageCount', stage_count,
    'confirmedActs', confirmed_acts,
    'confirmedPlayerActs', confirmed_player_acts,
    'ticketsConfirmed', ticket.id IS NOT NULL AND ticket.owner_confirmed_at IS NOT NULL,
    'npcFillEnabled', true,
    'activeLicence', active_licence,
    'alreadyRun', already_run,
    'canRun', jsonb_array_length(blockers) = 0,
    'blockers', blockers
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public._simplified_festival_run_readiness(
  p_festival_company_id uuid,
  p_festival_edition_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  result jsonb;
  edition public.festival_editions_v2%ROWTYPE;
  site_id uuid;
  stage_count integer := 0;
  confirmed_acts integer := 0;
  confirmed_player_acts integer := 0;
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

  SELECT
    count(*)::integer,
    count(*) FILTER (
      WHERE booking.artist_type IN ('solo', 'band')
        AND (
          (booking.artist_type = 'solo' AND booking.artist_profile_id IS NOT NULL)
          OR (booking.artist_type = 'band' AND booking.band_id IS NOT NULL)
        )
    )::integer
  INTO confirmed_acts, confirmed_player_acts
  FROM public.festival_artist_bookings booking
  JOIN public.festival_artist_programmes programme
    ON programme.id = booking.festival_artist_programme_id
  WHERE programme.festival_company_id = p_festival_company_id
    AND programme.festival_edition_id = p_festival_edition_id
    AND booking.status IN ('confirmed', 'awaiting_schedule', 'scheduled');

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

  IF confirmed_player_acts = 0
     AND NOT EXISTS (
       SELECT 1
       FROM jsonb_array_elements(blockers) blocker
       WHERE blocker->>'code' = 'festival_player_act_required'
     ) THEN
    blockers := blockers || jsonb_build_array(jsonb_build_object(
      'code', 'festival_player_act_required',
      'message', 'Confirm at least one player solo artist or band before running the Festival. NPC acts only fill remaining slots.'
    ));
  END IF;

  IF max_stages IS NOT NULL
     AND stage_count > max_stages
     AND NOT EXISTS (
       SELECT 1
       FROM jsonb_array_elements(blockers) blocker
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
       SELECT 1
       FROM jsonb_array_elements(blockers) blocker
       WHERE blocker->>'code' IN ('festival_licence_act_limit_exceeded', 'festival_licence_acts_limit_exceeded')
     ) THEN
    blockers := blockers || jsonb_build_array(jsonb_build_object(
      'code', 'festival_licence_act_limit_exceeded',
      'message', 'The confirmed line-up exceeds the active licence limit of ' || max_acts_per_day::text || ' acts per day. Reduce confirmed acts or upgrade the licence.'
    ));
  END IF;

  RETURN result || jsonb_build_object(
    'stageCount', stage_count,
    'confirmedActs', confirmed_acts,
    'confirmedPlayerActs', confirmed_player_acts,
    'licensedStageLimit', max_stages,
    'licensedActsPerDay', max_acts_per_day,
    'blockers', blockers,
    'canRun', jsonb_array_length(blockers) = 0
  );
END;
$function$;

REVOKE ALL ON FUNCTION public._simplified_festival_run_readiness_pre_operating_ceiling(uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public._simplified_festival_run_readiness_pre_operating_ceiling(uuid, uuid) TO service_role;

REVOKE ALL ON FUNCTION public._simplified_festival_run_readiness(uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public._simplified_festival_run_readiness(uuid, uuid) TO service_role;

NOTIFY pgrst, 'reload schema';