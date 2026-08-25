-- Programme C / C5: project the published canonical Festival stage schedule to attendees.

CREATE OR REPLACE FUNCTION public.get_my_festival_stage_schedule(p_attendance_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_context jsonb;
  v_profile_id uuid;
  v_edition_id uuid;
  v_legacy_edition_id uuid;
  v_revision_id uuid;
  v_schedule_state text;
  v_items jsonb := '[]'::jsonb;
  v_days jsonb := '[]'::jsonb;
  v_starts_on date;
  v_ends_on date;
BEGIN
  v_context := public._festival_day_plan_context(p_attendance_id);
  v_profile_id := (v_context->>'profileId')::uuid;
  v_edition_id := (v_context->>'festivalEditionId')::uuid;
  v_starts_on := (v_context->>'startsOn')::date;
  v_ends_on := (v_context->>'endsOn')::date;
  v_legacy_edition_id := public._festival_attendee_legacy_edition(v_edition_id);

  SELECT coalesce(jsonb_agg(
    jsonb_build_object(
      'date', days.day_value::date,
      'dayNumber', ((days.day_value::date - v_starts_on) + 1)
    ) ORDER BY days.day_value
  ), '[]'::jsonb)
  INTO v_days
  FROM generate_series(v_starts_on::timestamp, v_ends_on::timestamp, interval '1 day') AS days(day_value);

  IF v_legacy_edition_id IS NOT NULL THEN
    SELECT revision.id, revision.state::text
      INTO v_revision_id, v_schedule_state
    FROM public.festival_schedule_revisions revision
    WHERE revision.edition_id = v_legacy_edition_id
      AND revision.state IN ('published', 'locked')
    ORDER BY CASE revision.state WHEN 'locked' THEN 0 ELSE 1 END, revision.revision_number DESC
    LIMIT 1;
  END IF;

  IF v_revision_id IS NOT NULL THEN
    SELECT coalesce(jsonb_agg(
      jsonb_build_object(
        'id', item.id,
        'festivalDate', item.festival_date,
        'startsAt', item.starts_at,
        'endsAt', item.ends_at,
        'durationMinutes', item.duration_minutes,
        'stageId', item.stage_id,
        'stageName', coalesce(stage.public_name, stage.stage_name, 'Festival stage'),
        'artistName', coalesce(band.name, slot.npc_dj_name, item.title),
        'title', item.title,
        'locationKey', 'stage:' || item.stage_id::text,
        'isPlanned', EXISTS (
          SELECT 1
          FROM public.festival_attendee_plan_items planned
          WHERE planned.attendance_id = p_attendance_id
            AND planned.profile_id = v_profile_id
            AND planned.schedule_item_id = item.id
            AND planned.status = 'planned'
        ),
        'plannedItemId', (
          SELECT planned.id
          FROM public.festival_attendee_plan_items planned
          WHERE planned.attendance_id = p_attendance_id
            AND planned.profile_id = v_profile_id
            AND planned.schedule_item_id = item.id
            AND planned.status = 'planned'
          ORDER BY planned.created_at DESC
          LIMIT 1
        )
      ) ORDER BY item.festival_date, item.starts_at, stage.stage_number, item.sort_order), '[]'::jsonb)
    INTO v_items
    FROM public.festival_schedule_items item
    JOIN public.festival_stages stage ON stage.id = item.stage_id
    LEFT JOIN public.bands band ON band.id = item.band_id
    LEFT JOIN public.festival_stage_slots slot ON slot.id = item.stage_slot_id
    WHERE item.revision_id = v_revision_id
      AND item.item_type = 'performance_slot'
      AND item.public_visible = true
      AND item.stage_id IS NOT NULL
      AND item.festival_date IS NOT NULL
      AND item.starts_at IS NOT NULL
      AND item.ends_at IS NOT NULL
      AND coalesce(item.status, '') <> 'cancelled';
  END IF;

  RETURN jsonb_build_object(
    'attendanceId', p_attendance_id,
    'festivalEditionId', v_edition_id,
    'revisionId', v_revision_id,
    'scheduleState', v_schedule_state,
    'scheduleAvailable', v_revision_id IS NOT NULL,
    'timezone', v_context->>'timezone',
    'days', v_days,
    'items', v_items,
    'serverNow', now()
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.preview_festival_stage_plan_item(
  p_attendance_id uuid,
  p_schedule_item_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_context jsonb;
  v_profile_id uuid;
  v_edition_id uuid;
  v_legacy_edition_id uuid;
  v_revision_id uuid;
  v_item public.festival_schedule_items%ROWTYPE;
  v_stage public.festival_stages%ROWTYPE;
  v_artist_name text;
  v_preview jsonb;
  v_existing uuid;
  v_blockers jsonb;
BEGIN
  v_context := public._festival_day_plan_context(p_attendance_id);
  v_profile_id := (v_context->>'profileId')::uuid;
  v_edition_id := (v_context->>'festivalEditionId')::uuid;
  v_legacy_edition_id := public._festival_attendee_legacy_edition(v_edition_id);

  SELECT revision.id INTO v_revision_id
  FROM public.festival_schedule_revisions revision
  WHERE revision.edition_id = v_legacy_edition_id
    AND revision.state IN ('published', 'locked')
  ORDER BY CASE revision.state WHEN 'locked' THEN 0 ELSE 1 END, revision.revision_number DESC
  LIMIT 1;

  SELECT item.* INTO v_item
  FROM public.festival_schedule_items item
  WHERE item.id = p_schedule_item_id
    AND item.revision_id = v_revision_id
    AND item.item_type = 'performance_slot'
    AND item.public_visible = true
    AND item.stage_id IS NOT NULL
    AND item.festival_date IS NOT NULL
    AND item.starts_at IS NOT NULL
    AND item.ends_at IS NOT NULL
    AND coalesce(item.status, '') <> 'cancelled';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'festival_stage_schedule_item_unavailable' USING ERRCODE = 'P0001';
  END IF;

  SELECT stage.* INTO v_stage
  FROM public.festival_stages stage
  WHERE stage.id = v_item.stage_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'festival_stage_schedule_item_unavailable' USING ERRCODE = 'P0001';
  END IF;

  SELECT coalesce(band.name, slot.npc_dj_name, v_item.title)
    INTO v_artist_name
  FROM (SELECT 1) seed
  LEFT JOIN public.bands band ON band.id = v_item.band_id
  LEFT JOIN public.festival_stage_slots slot ON slot.id = v_item.stage_slot_id;

  v_preview := public._festival_plan_preview_window(
    p_attendance_id,
    v_item.festival_date,
    v_item.starts_at,
    v_item.ends_at,
    'watch_act',
    'stage:' || v_item.stage_id::text,
    coalesce(v_stage.public_name, v_stage.stage_name, 'Festival stage')
  );

  SELECT planned.id INTO v_existing
  FROM public.festival_attendee_plan_items planned
  WHERE planned.attendance_id = p_attendance_id
    AND planned.profile_id = v_profile_id
    AND planned.schedule_item_id = p_schedule_item_id
    AND planned.status = 'planned'
  ORDER BY planned.created_at DESC
  LIMIT 1;

  IF v_existing IS NOT NULL THEN
    v_blockers := coalesce(v_preview->'blockers', '[]'::jsonb) || jsonb_build_array(jsonb_build_object(
      'code', 'festival_stage_schedule_already_planned',
      'message', 'This performance is already in My Day.',
      'conflictingItemId', v_existing
    ));
    v_preview := jsonb_set(v_preview, '{blockers}', v_blockers, true);
    v_preview := jsonb_set(v_preview, '{feasible}', 'false'::jsonb, true);
  END IF;

  RETURN v_preview || jsonb_build_object(
    'scheduleItemId', v_item.id,
    'stageId', v_item.stage_id,
    'stageName', coalesce(v_stage.public_name, v_stage.stage_name, 'Festival stage'),
    'artistName', coalesce(v_artist_name, v_item.title),
    'title', v_item.title,
    'festivalDate', v_item.festival_date
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.add_festival_stage_performance_to_day_plan(
  p_attendance_id uuid,
  p_schedule_item_id uuid,
  p_idempotency_key uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_context jsonb;
  v_profile_id uuid;
  v_edition_id uuid;
  v_preview jsonb;
  v_existing public.festival_attendee_plan_items%ROWTYPE;
  v_item public.festival_schedule_items%ROWTYPE;
  v_stage public.festival_stages%ROWTYPE;
  v_artist_name text;
  v_plan public.festival_attendee_plan_items%ROWTYPE;
  v_code text;
  v_duration integer;
BEGIN
  IF p_idempotency_key IS NULL THEN
    RAISE EXCEPTION 'festival_plan_idempotency_required' USING ERRCODE = 'P0001';
  END IF;

  v_context := public._festival_day_plan_context(p_attendance_id);
  v_profile_id := (v_context->>'profileId')::uuid;
  v_edition_id := (v_context->>'festivalEditionId')::uuid;

  PERFORM pg_advisory_xact_lock(
    hashtextextended(p_attendance_id::text || ':festival-stage-plan:' || p_idempotency_key::text, 0)
  );

  SELECT planned.* INTO v_existing
  FROM public.festival_attendee_plan_items planned
  WHERE planned.attendance_id = p_attendance_id
    AND planned.idempotency_key = p_idempotency_key;

  IF FOUND THEN
    IF v_existing.schedule_item_id IS DISTINCT FROM p_schedule_item_id THEN
      RAISE EXCEPTION 'festival_plan_idempotency_conflict' USING ERRCODE = 'P0001';
    END IF;
    RETURN jsonb_build_object(
      'id', v_existing.id,
      'status', v_existing.status,
      'startsAt', v_existing.starts_at,
      'endsAt', v_existing.ends_at,
      'duplicate', true
    );
  END IF;

  v_preview := public.preview_festival_stage_plan_item(p_attendance_id, p_schedule_item_id);
  IF NOT coalesce((v_preview->>'feasible')::boolean, false) THEN
    v_code := v_preview->'blockers'->0->>'code';
    RAISE EXCEPTION '%', coalesce(v_code, 'festival_plan_not_feasible') USING ERRCODE = 'P0001';
  END IF;

  SELECT item.* INTO v_item
  FROM public.festival_schedule_items item
  WHERE item.id = p_schedule_item_id;
  SELECT stage.* INTO v_stage
  FROM public.festival_stages stage
  WHERE stage.id = v_item.stage_id;

  SELECT coalesce(band.name, slot.npc_dj_name, v_item.title)
    INTO v_artist_name
  FROM (SELECT 1) seed
  LEFT JOIN public.bands band ON band.id = v_item.band_id
  LEFT JOIN public.festival_stage_slots slot ON slot.id = v_item.stage_slot_id;

  v_duration := ceil(extract(epoch FROM (v_item.ends_at - v_item.starts_at)) / 60.0)::integer;
  IF v_duration < 5 OR v_duration > 360 THEN
    RAISE EXCEPTION 'festival_stage_schedule_duration_invalid' USING ERRCODE = 'P0001';
  END IF;

  PERFORM pg_advisory_xact_lock(
    hashtextextended(p_attendance_id::text || ':festival-date:' || v_item.festival_date::text, 0)
  );

  -- Re-evaluate after serialising the attendee/day so concurrent planner commits cannot
  -- make this performance impossible between preview and insert.
  v_preview := public.preview_festival_stage_plan_item(p_attendance_id, p_schedule_item_id);
  IF NOT coalesce((v_preview->>'feasible')::boolean, false) THEN
    v_code := v_preview->'blockers'->0->>'code';
    RAISE EXCEPTION '%', coalesce(v_code, 'festival_plan_not_feasible') USING ERRCODE = 'P0001';
  END IF;

  INSERT INTO public.festival_attendee_plan_items (
    attendance_id,
    festival_edition_id,
    profile_id,
    festival_date,
    starts_at,
    ends_at,
    duration_minutes,
    activity_type,
    title,
    status,
    idempotency_key,
    source,
    schedule_item_id,
    stage_id,
    location_key,
    location_label
  ) VALUES (
    p_attendance_id,
    v_edition_id,
    v_profile_id,
    v_item.festival_date,
    v_item.starts_at,
    v_item.ends_at,
    v_duration,
    'watch_act',
    coalesce(v_artist_name, v_item.title, 'Festival performance'),
    'planned',
    p_idempotency_key,
    'stage_schedule',
    v_item.id,
    v_item.stage_id,
    'stage:' || v_item.stage_id::text,
    coalesce(v_stage.public_name, v_stage.stage_name, 'Festival stage')
  )
  RETURNING * INTO v_plan;

  RETURN jsonb_build_object(
    'id', v_plan.id,
    'status', v_plan.status,
    'startsAt', v_plan.starts_at,
    'endsAt', v_plan.ends_at,
    'duplicate', false
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.get_my_festival_stage_schedule(uuid),
  public.preview_festival_stage_plan_item(uuid, uuid),
  public.add_festival_stage_performance_to_day_plan(uuid, uuid, uuid)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_my_festival_stage_schedule(uuid),
  public.preview_festival_stage_plan_item(uuid, uuid),
  public.add_festival_stage_performance_to_day_plan(uuid, uuid, uuid)
  TO authenticated, service_role;

COMMENT ON FUNCTION public.get_my_festival_stage_schedule(uuid) IS
  'C5 attendee projection of the published or locked canonical Festival performance timetable.';
COMMENT ON FUNCTION public.preview_festival_stage_plan_item(uuid, uuid) IS
  'C5 server-authoritative conflict and travel preview for a canonical Festival performance.';
COMMENT ON FUNCTION public.add_festival_stage_performance_to_day_plan(uuid, uuid, uuid) IS
  'C5 replay-safe mutation that adds one canonical Festival performance to an attendee My Day plan.';

NOTIFY pgrst, 'reload schema';
