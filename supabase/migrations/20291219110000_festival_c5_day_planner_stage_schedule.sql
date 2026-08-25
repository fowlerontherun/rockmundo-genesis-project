-- Programme C / C5: Festival attendee day planner + canonical stage timetable.
--
-- This migration keeps the attendee planner server-authoritative, bridges the modern
-- attendee edition to the existing published/locked canonical festival schedule, and
-- makes movement time part of feasibility checks. It deliberately does not add C6
-- condition simulation, C7 social events, C8 rewards, or finance settlement authority.

ALTER TABLE public.festival_attendee_plan_items
  DROP CONSTRAINT IF EXISTS festival_attendee_plan_items_duration_minutes_check;
ALTER TABLE public.festival_attendee_plan_items
  ADD CONSTRAINT festival_attendee_plan_items_duration_minutes_check
  CHECK (duration_minutes BETWEEN 5 AND 360);

ALTER TABLE public.festival_attendee_plan_items
  DROP CONSTRAINT IF EXISTS festival_attendee_plan_items_activity_type_check;
ALTER TABLE public.festival_attendee_plan_items
  ADD CONSTRAINT festival_attendee_plan_items_activity_type_check
  CHECK (activity_type IN (
    'watch_act', 'eat', 'drink', 'explore', 'rest',
    'camping', 'vip', 'vendor', 'free_time'
  ));

ALTER TABLE public.festival_attendee_plan_items
  ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'manual',
  ADD COLUMN IF NOT EXISTS schedule_item_id uuid REFERENCES public.festival_schedule_items(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS stage_id uuid REFERENCES public.festival_stages(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS location_key text,
  ADD COLUMN IF NOT EXISTS location_label text;

ALTER TABLE public.festival_attendee_plan_items
  DROP CONSTRAINT IF EXISTS festival_attendee_plan_items_source_check;
ALTER TABLE public.festival_attendee_plan_items
  ADD CONSTRAINT festival_attendee_plan_items_source_check
  CHECK (source IN ('manual', 'stage_schedule'));

UPDATE public.festival_attendee_plan_items
SET location_key = CASE activity_type
      WHEN 'eat' THEN 'area:food'
      WHEN 'drink' THEN 'area:bar'
      WHEN 'rest' THEN 'area:rest'
      WHEN 'camping' THEN 'area:camping'
      WHEN 'vip' THEN 'area:vip'
      WHEN 'vendor' THEN 'area:vendors'
      ELSE 'site:general'
    END,
    location_label = CASE activity_type
      WHEN 'eat' THEN 'Food area'
      WHEN 'drink' THEN 'Bar area'
      WHEN 'rest' THEN 'Rest area'
      WHEN 'camping' THEN 'Campsite'
      WHEN 'vip' THEN 'VIP area'
      WHEN 'vendor' THEN 'Vendor area'
      ELSE 'Festival site'
    END
WHERE location_key IS NULL OR location_label IS NULL;

ALTER TABLE public.festival_attendee_plan_items
  ALTER COLUMN location_key SET NOT NULL,
  ALTER COLUMN location_label SET NOT NULL;

CREATE INDEX IF NOT EXISTS festival_attendee_plan_items_schedule_item_idx
  ON public.festival_attendee_plan_items(attendance_id, schedule_item_id)
  WHERE schedule_item_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS festival_attendee_plan_items_active_schedule_uidx
  ON public.festival_attendee_plan_items(attendance_id, schedule_item_id)
  WHERE schedule_item_id IS NOT NULL AND status = 'planned';

CREATE OR REPLACE FUNCTION public._festival_attendee_legacy_edition(
  p_festival_edition_id uuid
)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO ''
AS $function$
  SELECT mapping.edition_id
  FROM public.festival_public_legacy_bridges bridge
  JOIN public.festival_legacy_mappings mapping
    ON mapping.legacy_id = bridge.legacy_festival_id
    OR mapping.legacy_festival_id = bridge.legacy_festival_id
  WHERE bridge.festival_edition_id = p_festival_edition_id
  ORDER BY
    coalesce((mapping.metadata->>'historical_only')::boolean, false),
    mapping.created_at DESC
  LIMIT 1;
$function$;

REVOKE ALL ON FUNCTION public._festival_attendee_legacy_edition(uuid)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public._festival_attendee_legacy_edition(uuid)
  TO service_role;

CREATE OR REPLACE FUNCTION public._festival_plan_location_key(
  p_activity_type text
)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path TO ''
AS $function$
  SELECT CASE p_activity_type
    WHEN 'eat' THEN 'area:food'
    WHEN 'drink' THEN 'area:bar'
    WHEN 'rest' THEN 'area:rest'
    WHEN 'camping' THEN 'area:camping'
    WHEN 'vip' THEN 'area:vip'
    WHEN 'vendor' THEN 'area:vendors'
    ELSE 'site:general'
  END;
$function$;

CREATE OR REPLACE FUNCTION public._festival_plan_location_label(
  p_activity_type text
)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path TO ''
AS $function$
  SELECT CASE p_activity_type
    WHEN 'eat' THEN 'Food area'
    WHEN 'drink' THEN 'Bar area'
    WHEN 'rest' THEN 'Rest area'
    WHEN 'camping' THEN 'Campsite'
    WHEN 'vip' THEN 'VIP area'
    WHEN 'vendor' THEN 'Vendor area'
    WHEN 'free_time' THEN 'Festival site'
    WHEN 'explore' THEN 'Festival site'
    ELSE 'Festival site'
  END;
$function$;

CREATE OR REPLACE FUNCTION public._festival_plan_travel_minutes(
  p_from_location text,
  p_to_location text
)
RETURNS integer
LANGUAGE sql
IMMUTABLE
SET search_path TO ''
AS $function$
  SELECT CASE
    WHEN p_from_location IS NULL OR p_to_location IS NULL THEN 0
    WHEN p_from_location = p_to_location THEN 0
    WHEN p_from_location = 'area:camping' OR p_to_location = 'area:camping' THEN 20
    WHEN p_from_location LIKE 'stage:%' AND p_to_location LIKE 'stage:%' THEN 15
    WHEN p_from_location LIKE 'stage:%' OR p_to_location LIKE 'stage:%' THEN 10
    ELSE 5
  END;
$function$;

REVOKE ALL ON FUNCTION public._festival_plan_location_key(text),
  public._festival_plan_location_label(text),
  public._festival_plan_travel_minutes(text, text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public._festival_plan_location_key(text),
  public._festival_plan_location_label(text),
  public._festival_plan_travel_minutes(text, text)
  TO service_role;

CREATE OR REPLACE FUNCTION public._festival_plan_preview_window(
  p_attendance_id uuid,
  p_festival_date date,
  p_start_at timestamptz,
  p_end_at timestamptz,
  p_activity_type text,
  p_location_key text,
  p_location_label text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_context jsonb;
  v_profile_id uuid;
  v_timezone text;
  v_starts_on date;
  v_ends_on date;
  v_previous public.festival_attendee_plan_items%ROWTYPE;
  v_next public.festival_attendee_plan_items%ROWTYPE;
  v_overlap public.festival_attendee_plan_items%ROWTYPE;
  v_travel_before integer := 0;
  v_travel_after integer := 0;
  v_blockers jsonb := '[]'::jsonb;
  v_warnings jsonb := '[]'::jsonb;
  v_has_camping boolean := false;
  v_has_vip boolean := false;
BEGIN
  v_context := public._festival_day_plan_context(p_attendance_id);
  v_profile_id := (v_context->>'profileId')::uuid;
  v_timezone := v_context->>'timezone';
  v_starts_on := (v_context->>'startsOn')::date;
  v_ends_on := (v_context->>'endsOn')::date;

  IF p_activity_type NOT IN (
    'watch_act', 'eat', 'drink', 'explore', 'rest',
    'camping', 'vip', 'vendor', 'free_time'
  ) THEN
    v_blockers := v_blockers || jsonb_build_array(jsonb_build_object(
      'code', 'festival_plan_activity_invalid',
      'message', 'That Festival activity type is not available.'
    ));
  END IF;

  IF p_festival_date IS NULL OR p_festival_date < v_starts_on OR p_festival_date > v_ends_on THEN
    v_blockers := v_blockers || jsonb_build_array(jsonb_build_object(
      'code', 'festival_plan_date_outside_event',
      'message', 'Choose a day within this Festival edition.'
    ));
  END IF;

  IF p_start_at IS NULL OR p_end_at IS NULL OR p_end_at <= p_start_at THEN
    v_blockers := v_blockers || jsonb_build_array(jsonb_build_object(
      'code', 'festival_plan_window_invalid',
      'message', 'The planned time window is invalid.'
    ));
  ELSE
    IF p_start_at < now() THEN
      v_blockers := v_blockers || jsonb_build_array(jsonb_build_object(
        'code', 'festival_plan_start_in_past',
        'message', 'Festival plans must start in the future.'
      ));
    END IF;

    IF (p_start_at AT TIME ZONE v_timezone)::date <> p_festival_date
       OR ((p_end_at - interval '1 microsecond') AT TIME ZONE v_timezone)::date <> p_festival_date THEN
      v_blockers := v_blockers || jsonb_build_array(jsonb_build_object(
        'code', 'festival_plan_crosses_day_boundary',
        'message', 'A Festival plan block must stay within one Festival day.'
      ));
    END IF;
  END IF;

  SELECT
    coalesce(product.includes_camping, false),
    coalesce(product.includes_vip_area, false)
  INTO v_has_camping, v_has_vip
  FROM public.festival_player_attendance attendance
  JOIN public.festival_issued_tickets ticket
    ON ticket.id = attendance.admission_ticket_id
  JOIN public.festival_ticket_products product
    ON product.id = ticket.festival_ticket_product_id
  WHERE attendance.id = p_attendance_id
    AND attendance.profile_id = v_profile_id;

  IF p_activity_type = 'camping' AND NOT v_has_camping THEN
    v_blockers := v_blockers || jsonb_build_array(jsonb_build_object(
      'code', 'festival_plan_camping_not_included',
      'message', 'Your wristband does not include campsite access.'
    ));
  END IF;

  IF p_activity_type = 'vip' AND NOT v_has_vip THEN
    v_blockers := v_blockers || jsonb_build_array(jsonb_build_object(
      'code', 'festival_plan_vip_not_included',
      'message', 'Your wristband does not include VIP access.'
    ));
  END IF;

  IF p_start_at IS NOT NULL AND p_end_at IS NOT NULL AND p_end_at > p_start_at THEN
    SELECT item.*
      INTO v_overlap
    FROM public.festival_attendee_plan_items item
    WHERE item.attendance_id = p_attendance_id
      AND item.profile_id = v_profile_id
      AND item.status = 'planned'
      AND tstzrange(item.starts_at, item.ends_at, '[)') && tstzrange(p_start_at, p_end_at, '[)')
    ORDER BY item.starts_at
    LIMIT 1;

    IF FOUND THEN
      v_blockers := v_blockers || jsonb_build_array(jsonb_build_object(
        'code', 'festival_plan_overlap',
        'message', 'This block overlaps ' || v_overlap.title || '.',
        'conflictingItemId', v_overlap.id
      ));
    END IF;

    SELECT item.*
      INTO v_previous
    FROM public.festival_attendee_plan_items item
    WHERE item.attendance_id = p_attendance_id
      AND item.profile_id = v_profile_id
      AND item.status = 'planned'
      AND item.ends_at <= p_start_at
    ORDER BY item.ends_at DESC, item.created_at DESC
    LIMIT 1;

    IF FOUND THEN
      v_travel_before := public._festival_plan_travel_minutes(v_previous.location_key, p_location_key);
      IF v_previous.ends_at + make_interval(mins => v_travel_before) > p_start_at THEN
        v_blockers := v_blockers || jsonb_build_array(jsonb_build_object(
          'code', 'festival_plan_travel_conflict',
          'message', 'There is not enough travel time after ' || v_previous.title || '.',
          'conflictingItemId', v_previous.id,
          'requiredTravelMinutes', v_travel_before
        ));
      ELSIF v_travel_before > 0 THEN
        v_warnings := v_warnings || jsonb_build_array(jsonb_build_object(
          'code', 'festival_plan_travel_before',
          'message', 'Allow ' || v_travel_before || ' minutes to get here from ' || v_previous.location_label || '.',
          'minutes', v_travel_before
        ));
      END IF;
    END IF;

    SELECT item.*
      INTO v_next
    FROM public.festival_attendee_plan_items item
    WHERE item.attendance_id = p_attendance_id
      AND item.profile_id = v_profile_id
      AND item.status = 'planned'
      AND item.starts_at >= p_end_at
    ORDER BY item.starts_at, item.created_at
    LIMIT 1;

    IF FOUND THEN
      v_travel_after := public._festival_plan_travel_minutes(p_location_key, v_next.location_key);
      IF p_end_at + make_interval(mins => v_travel_after) > v_next.starts_at THEN
        v_blockers := v_blockers || jsonb_build_array(jsonb_build_object(
          'code', 'festival_plan_travel_conflict',
          'message', 'There is not enough travel time before ' || v_next.title || '.',
          'conflictingItemId', v_next.id,
          'requiredTravelMinutes', v_travel_after
        ));
      ELSIF v_travel_after > 0 THEN
        v_warnings := v_warnings || jsonb_build_array(jsonb_build_object(
          'code', 'festival_plan_travel_after',
          'message', 'Allow ' || v_travel_after || ' minutes afterwards to reach ' || v_next.location_label || '.',
          'minutes', v_travel_after
        ));
      END IF;
    END IF;
  END IF;

  IF p_activity_type IN ('eat', 'drink', 'rest', 'camping', 'vip', 'vendor', 'free_time') THEN
    v_warnings := v_warnings || jsonb_build_array(jsonb_build_object(
      'code', 'festival_plan_time_tradeoff',
      'message', 'This reserves time in your day and may rule out performances in the same window.'
    ));
  END IF;

  RETURN jsonb_build_object(
    'feasible', jsonb_array_length(v_blockers) = 0,
    'startsAt', p_start_at,
    'endsAt', p_end_at,
    'locationKey', p_location_key,
    'locationLabel', p_location_label,
    'travelBeforeMinutes', v_travel_before,
    'travelAfterMinutes', v_travel_after,
    'blockers', v_blockers,
    'warnings', v_warnings
  );
END;
$function$;

REVOKE ALL ON FUNCTION public._festival_plan_preview_window(uuid, date, timestamptz, timestamptz, text, text, text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public._festival_plan_preview_window(uuid, date, timestamptz, timestamptz, text, text, text)
  TO service_role;

CREATE OR REPLACE FUNCTION public.preview_festival_day_plan_item(
  p_attendance_id uuid,
  p_festival_date date,
  p_local_start time without time zone,
  p_duration_minutes integer,
  p_activity_type text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_context jsonb;
  v_timezone text;
  v_start_at timestamptz;
  v_end_at timestamptz;
BEGIN
  IF p_festival_date IS NULL THEN
    RAISE EXCEPTION 'festival_plan_date_required' USING ERRCODE = 'P0001';
  END IF;
  IF p_local_start IS NULL THEN
    RAISE EXCEPTION 'festival_plan_start_required' USING ERRCODE = 'P0001';
  END IF;
  IF p_duration_minutes NOT IN (30, 60, 90) THEN
    RAISE EXCEPTION 'festival_plan_duration_invalid' USING ERRCODE = 'P0001';
  END IF;
  IF extract(second FROM p_local_start) <> 0
     OR mod(extract(minute FROM p_local_start)::integer, 30) <> 0 THEN
    RAISE EXCEPTION 'festival_plan_start_grid_invalid' USING ERRCODE = 'P0001';
  END IF;

  v_context := public._festival_day_plan_context(p_attendance_id);
  v_timezone := v_context->>'timezone';
  v_start_at := (p_festival_date + p_local_start) AT TIME ZONE v_timezone;
  v_end_at := v_start_at + make_interval(mins => p_duration_minutes);

  RETURN public._festival_plan_preview_window(
    p_attendance_id,
    p_festival_date,
    v_start_at,
    v_end_at,
    p_activity_type,
    public._festival_plan_location_key(p_activity_type),
    public._festival_plan_location_label(p_activity_type)
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.preview_festival_day_plan_item(uuid, date, time without time zone, integer, text)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.preview_festival_day_plan_item(uuid, date, time without time zone, integer, text)
  TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.get_my_festival_stage_schedule(
  p_attendance_id uuid
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
  v_revision public.festival_schedule_revisions%ROWTYPE;
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
    SELECT revision.*
      INTO v_revision
    FROM public.festival_schedule_revisions revision
    WHERE revision.edition_id = v_legacy_edition_id
      AND revision.state IN ('published', 'locked')
    ORDER BY
      CASE revision.state WHEN 'locked' THEN 0 ELSE 1 END,
      revision.revision_number DESC
    LIMIT 1;
  END IF;

  IF v_revision.id IS NOT NULL THEN
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
    JOIN public.festival_stages stage
      ON stage.id = item.stage_id
    LEFT JOIN public.bands band
      ON band.id = item.band_id
    LEFT JOIN public.festival_stage_slots slot
      ON slot.id = item.stage_slot_id
    WHERE item.revision_id = v_revision.id
      AND item.item_type = 'performance_slot'
      AND item.public_visible = true
      AND item.stage_id IS NOT NULL
      AND item.starts_at IS NOT NULL
      AND item.ends_at IS NOT NULL
      AND coalesce(item.status, '') <> 'cancelled';
  END IF;

  RETURN jsonb_build_object(
    'attendanceId', p_attendance_id,
    'festivalEditionId', v_edition_id,
    'revisionId', v_revision.id,
    'scheduleState', CASE WHEN v_revision.id IS NULL THEN NULL ELSE v_revision.state::text END,
    'scheduleAvailable', v_revision.id IS NOT NULL,
    'timezone', v_context->>'timezone',
    'days', v_days,
    'items', v_items,
    'serverNow', now()
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.get_my_festival_stage_schedule(uuid)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_my_festival_stage_schedule(uuid)
  TO authenticated, service_role;

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
  v_band_name text;
  v_npc_name text;
  v_preview jsonb;
  v_existing uuid;
  v_blockers jsonb;
BEGIN
  v_context := public._festival_day_plan_context(p_attendance_id);
  v_profile_id := (v_context->>'profileId')::uuid;
  v_edition_id := (v_context->>'festivalEditionId')::uuid;
  v_legacy_edition_id := public._festival_attendee_legacy_edition(v_edition_id);

  SELECT revision.id
    INTO v_revision_id
  FROM public.festival_schedule_revisions revision
  WHERE revision.edition_id = v_legacy_edition_id
    AND revision.state IN ('published', 'locked')
  ORDER BY CASE revision.state WHEN 'locked' THEN 0 ELSE 1 END, revision.revision_number DESC
  LIMIT 1;

  SELECT item.*, stage.*
    INTO v_item, v_stage
  FROM public.festival_schedule_items item
  JOIN public.festival_stages stage ON stage.id = item.stage_id
  WHERE item.id = p_schedule_item_id
    AND item.revision_id = v_revision_id
    AND item.item_type = 'performance_slot'
    AND item.public_visible = true
    AND item.starts_at IS NOT NULL
    AND item.ends_at IS NOT NULL
    AND coalesce(item.status, '') <> 'cancelled';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'festival_stage_schedule_item_unavailable' USING ERRCODE = 'P0001';
  END IF;

  SELECT band.name INTO v_band_name FROM public.bands band WHERE band.id = v_item.band_id;
  SELECT slot.npc_dj_name INTO v_npc_name FROM public.festival_stage_slots slot WHERE slot.id = v_item.stage_slot_id;

  v_preview := public._festival_plan_preview_window(
    p_attendance_id,
    v_item.festival_date,
    v_item.starts_at,
    v_item.ends_at,
    'watch_act',
    'stage:' || v_item.stage_id::text,
    coalesce(v_stage.public_name, v_stage.stage_name, 'Festival stage')
  );

  SELECT planned.id
    INTO v_existing
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
    'artistName', coalesce(v_band_name, v_npc_name, v_item.title),
    'title', v_item.title,
    'festivalDate', v_item.festival_date
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.preview_festival_stage_plan_item(uuid, uuid)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.preview_festival_stage_plan_item(uuid, uuid)
  TO authenticated, service_role;

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
  v_band_name text;
  v_npc_name text;
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

  SELECT planned.*
    INTO v_existing
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

  SELECT planned.*
    INTO v_existing
  FROM public.festival_attendee_plan_items planned
  WHERE planned.attendance_id = p_attendance_id
    AND planned.profile_id = v_profile_id
    AND planned.schedule_item_id = p_schedule_item_id
    AND planned.status = 'planned'
  ORDER BY planned.created_at DESC
  LIMIT 1;

  IF FOUND THEN
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

  SELECT schedule_item.*, stage.*
    INTO v_item, v_stage
  FROM public.festival_schedule_items schedule_item
  JOIN public.festival_stages stage ON stage.id = schedule_item.stage_id
  WHERE schedule_item.id = p_schedule_item_id;

  SELECT band.name INTO v_band_name FROM public.bands band WHERE band.id = v_item.band_id;
  SELECT slot.npc_dj_name INTO v_npc_name FROM public.festival_stage_slots slot WHERE slot.id = v_item.stage_slot_id;

  v_duration := ceil(extract(epoch FROM (v_item.ends_at - v_item.starts_at)) / 60.0)::integer;
  IF v_duration < 5 OR v_duration > 360 THEN
    RAISE EXCEPTION 'festival_stage_schedule_duration_invalid' USING ERRCODE = 'P0001';
  END IF;

  PERFORM pg_advisory_xact_lock(
    hashtextextended(p_attendance_id::text || ':festival-date:' || v_item.festival_date::text, 0)
  );

  -- Re-run after the day lock so a concurrent planner mutation cannot invalidate the preview.
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
    coalesce(v_band_name, v_npc_name, v_item.title, 'Festival performance'),
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

REVOKE ALL ON FUNCTION public.add_festival_stage_performance_to_day_plan(uuid, uuid, uuid)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.add_festival_stage_performance_to_day_plan(uuid, uuid, uuid)
  TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.create_festival_day_plan_item(
  p_attendance_id uuid,
  p_festival_date date,
  p_local_start time without time zone,
  p_duration_minutes integer,
  p_activity_type text,
  p_title text,
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
  v_timezone text;
  v_start_at timestamptz;
  v_end_at timestamptz;
  v_existing public.festival_attendee_plan_items%ROWTYPE;
  v_item public.festival_attendee_plan_items%ROWTYPE;
  v_preview jsonb;
  v_code text;
  v_location_key text;
  v_location_label text;
BEGIN
  IF p_idempotency_key IS NULL THEN
    RAISE EXCEPTION 'festival_plan_idempotency_required' USING ERRCODE = 'P0001';
  END IF;
  IF p_festival_date IS NULL THEN
    RAISE EXCEPTION 'festival_plan_date_required' USING ERRCODE = 'P0001';
  END IF;
  IF p_local_start IS NULL THEN
    RAISE EXCEPTION 'festival_plan_start_required' USING ERRCODE = 'P0001';
  END IF;
  IF p_duration_minutes NOT IN (30, 60, 90) THEN
    RAISE EXCEPTION 'festival_plan_duration_invalid' USING ERRCODE = 'P0001';
  END IF;
  IF p_activity_type NOT IN (
    'watch_act', 'eat', 'drink', 'explore', 'rest',
    'camping', 'vip', 'vendor', 'free_time'
  ) THEN
    RAISE EXCEPTION 'festival_plan_activity_invalid' USING ERRCODE = 'P0001';
  END IF;
  IF NULLIF(btrim(p_title), '') IS NULL OR char_length(btrim(p_title)) > 120 THEN
    RAISE EXCEPTION 'festival_plan_title_invalid' USING ERRCODE = 'P0001';
  END IF;
  IF extract(second FROM p_local_start) <> 0
     OR mod(extract(minute FROM p_local_start)::integer, 30) <> 0 THEN
    RAISE EXCEPTION 'festival_plan_start_grid_invalid' USING ERRCODE = 'P0001';
  END IF;

  v_context := public._festival_day_plan_context(p_attendance_id);
  v_profile_id := (v_context->>'profileId')::uuid;
  v_edition_id := (v_context->>'festivalEditionId')::uuid;
  v_timezone := v_context->>'timezone';
  v_start_at := (p_festival_date + p_local_start) AT TIME ZONE v_timezone;
  v_end_at := v_start_at + make_interval(mins => p_duration_minutes);
  v_location_key := public._festival_plan_location_key(p_activity_type);
  v_location_label := public._festival_plan_location_label(p_activity_type);

  PERFORM pg_advisory_xact_lock(
    hashtextextended(p_attendance_id::text || ':festival-plan:' || p_idempotency_key::text, 0)
  );

  SELECT item.*
    INTO v_existing
  FROM public.festival_attendee_plan_items item
  WHERE item.attendance_id = p_attendance_id
    AND item.idempotency_key = p_idempotency_key;

  IF FOUND THEN
    IF v_existing.festival_date <> p_festival_date
       OR v_existing.starts_at <> v_start_at
       OR v_existing.ends_at <> v_end_at
       OR v_existing.duration_minutes <> p_duration_minutes
       OR v_existing.activity_type <> p_activity_type
       OR v_existing.title <> btrim(p_title) THEN
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

  PERFORM pg_advisory_xact_lock(
    hashtextextended(p_attendance_id::text || ':festival-date:' || p_festival_date::text, 0)
  );

  v_preview := public.preview_festival_day_plan_item(
    p_attendance_id,
    p_festival_date,
    p_local_start,
    p_duration_minutes,
    p_activity_type
  );

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
    idempotency_key,
    source,
    location_key,
    location_label
  ) VALUES (
    p_attendance_id,
    v_edition_id,
    v_profile_id,
    p_festival_date,
    v_start_at,
    v_end_at,
    p_duration_minutes,
    p_activity_type,
    btrim(p_title),
    p_idempotency_key,
    'manual',
    v_location_key,
    v_location_label
  )
  RETURNING * INTO v_item;

  RETURN jsonb_build_object(
    'id', v_item.id,
    'status', v_item.status,
    'startsAt', v_item.starts_at,
    'endsAt', v_item.ends_at,
    'duplicate', false
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.create_festival_day_plan_item(uuid, date, time without time zone, integer, text, text, uuid)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_festival_day_plan_item(uuid, date, time without time zone, integer, text, text, uuid)
  TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.get_my_festival_day_plan(
  p_attendance_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_context jsonb;
  v_profile_id uuid;
  v_starts_on date;
  v_ends_on date;
  v_items jsonb;
  v_days jsonb;
  v_next jsonb;
BEGIN
  v_context := public._festival_day_plan_context(p_attendance_id);
  v_profile_id := (v_context->>'profileId')::uuid;
  v_starts_on := (v_context->>'startsOn')::date;
  v_ends_on := (v_context->>'endsOn')::date;

  UPDATE public.festival_attendee_plan_items item
  SET status = 'missed',
      resolved_at = coalesce(item.resolved_at, item.ends_at),
      updated_at = now()
  WHERE item.attendance_id = p_attendance_id
    AND item.profile_id = v_profile_id
    AND item.status = 'planned'
    AND item.ends_at <= now();

  SELECT coalesce(jsonb_agg(
    jsonb_build_object(
      'date', days.day_value::date,
      'dayNumber', ((days.day_value::date - v_starts_on) + 1)
    ) ORDER BY days.day_value
  ), '[]'::jsonb)
  INTO v_days
  FROM generate_series(v_starts_on::timestamp, v_ends_on::timestamp, interval '1 day') AS days(day_value);

  SELECT coalesce(jsonb_agg(
    jsonb_build_object(
      'id', item.id,
      'attendanceId', item.attendance_id,
      'festivalEditionId', item.festival_edition_id,
      'festivalDate', item.festival_date,
      'startsAt', item.starts_at,
      'endsAt', item.ends_at,
      'durationMinutes', item.duration_minutes,
      'activityType', item.activity_type,
      'title', item.title,
      'status', item.status,
      'resolvedAt', item.resolved_at,
      'createdAt', item.created_at,
      'source', item.source,
      'scheduleItemId', item.schedule_item_id,
      'stageId', item.stage_id,
      'locationKey', item.location_key,
      'locationLabel', item.location_label,
      'travelBeforeMinutes', CASE WHEN item.status = 'planned' THEN coalesce((
        SELECT public._festival_plan_travel_minutes(previous.location_key, item.location_key)
        FROM public.festival_attendee_plan_items previous
        WHERE previous.attendance_id = item.attendance_id
          AND previous.profile_id = item.profile_id
          AND previous.status = 'planned'
          AND previous.id <> item.id
          AND previous.ends_at <= item.starts_at
        ORDER BY previous.ends_at DESC, previous.created_at DESC
        LIMIT 1
      ), 0) ELSE 0 END,
      'travelAfterMinutes', CASE WHEN item.status = 'planned' THEN coalesce((
        SELECT public._festival_plan_travel_minutes(item.location_key, following.location_key)
        FROM public.festival_attendee_plan_items following
        WHERE following.attendance_id = item.attendance_id
          AND following.profile_id = item.profile_id
          AND following.status = 'planned'
          AND following.id <> item.id
          AND following.starts_at >= item.ends_at
        ORDER BY following.starts_at, following.created_at
        LIMIT 1
      ), 0) ELSE 0 END
    ) ORDER BY item.starts_at, item.created_at
  ), '[]'::jsonb)
  INTO v_items
  FROM public.festival_attendee_plan_items item
  WHERE item.attendance_id = p_attendance_id
    AND item.profile_id = v_profile_id;

  SELECT jsonb_build_object(
      'id', item.id,
      'festivalDate', item.festival_date,
      'startsAt', item.starts_at,
      'endsAt', item.ends_at,
      'durationMinutes', item.duration_minutes,
      'activityType', item.activity_type,
      'title', item.title,
      'status', item.status,
      'source', item.source,
      'scheduleItemId', item.schedule_item_id,
      'stageId', item.stage_id,
      'locationKey', item.location_key,
      'locationLabel', item.location_label,
      'travelBeforeMinutes', coalesce((
        SELECT public._festival_plan_travel_minutes(previous.location_key, item.location_key)
        FROM public.festival_attendee_plan_items previous
        WHERE previous.attendance_id = item.attendance_id
          AND previous.profile_id = item.profile_id
          AND previous.status = 'planned'
          AND previous.id <> item.id
          AND previous.ends_at <= item.starts_at
        ORDER BY previous.ends_at DESC, previous.created_at DESC
        LIMIT 1
      ), 0),
      'travelAfterMinutes', coalesce((
        SELECT public._festival_plan_travel_minutes(item.location_key, following.location_key)
        FROM public.festival_attendee_plan_items following
        WHERE following.attendance_id = item.attendance_id
          AND following.profile_id = item.profile_id
          AND following.status = 'planned'
          AND following.id <> item.id
          AND following.starts_at >= item.ends_at
        ORDER BY following.starts_at, following.created_at
        LIMIT 1
      ), 0)
    )
  INTO v_next
  FROM public.festival_attendee_plan_items item
  WHERE item.attendance_id = p_attendance_id
    AND item.profile_id = v_profile_id
    AND item.status = 'planned'
    AND item.ends_at > now()
  ORDER BY item.starts_at, item.created_at
  LIMIT 1;

  RETURN (v_context - 'profileId') || jsonb_build_object(
    'days', v_days,
    'items', v_items,
    'nextActivity', v_next,
    'serverNow', now()
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.get_my_festival_day_plan(uuid)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_my_festival_day_plan(uuid)
  TO authenticated, service_role;

COMMENT ON FUNCTION public.get_my_festival_stage_schedule(uuid) IS
  'C5 player projection of the published/locked canonical Festival performance timetable for an attending character.';
COMMENT ON FUNCTION public.preview_festival_day_plan_item(uuid, date, time without time zone, integer, text) IS
  'C5 server-authoritative feasibility/travel preview for manual Festival day-plan blocks.';
COMMENT ON FUNCTION public.preview_festival_stage_plan_item(uuid, uuid) IS
  'C5 server-authoritative feasibility/travel preview for a published Festival performance.';
COMMENT ON FUNCTION public.add_festival_stage_performance_to_day_plan(uuid, uuid, uuid) IS
  'C5 replay-safe mutation that adds one canonical published Festival performance to My Day.';

NOTIFY pgrst, 'reload schema';
