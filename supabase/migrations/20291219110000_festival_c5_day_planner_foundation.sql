-- Programme C / C5: attendee day-planner feasibility foundation.
-- Keeps planning server-authoritative and deliberately excludes C6 condition effects,
-- C7 social events, C8 rewards and all finance settlement authority.

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
      ELSE 'site:general'
    END,
    location_label = CASE activity_type
      WHEN 'eat' THEN 'Food area'
      WHEN 'drink' THEN 'Bar area'
      WHEN 'rest' THEN 'Rest area'
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

CREATE OR REPLACE FUNCTION public._festival_attendee_legacy_edition(p_festival_edition_id uuid)
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

CREATE OR REPLACE FUNCTION public._festival_plan_location_key(p_activity_type text)
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

CREATE OR REPLACE FUNCTION public._festival_plan_location_label(p_activity_type text)
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
    SELECT item.* INTO v_overlap
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

    SELECT item.* INTO v_previous
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

    SELECT item.* INTO v_next
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

REVOKE ALL ON FUNCTION public._festival_attendee_legacy_edition(uuid),
  public._festival_plan_location_key(text),
  public._festival_plan_location_label(text),
  public._festival_plan_travel_minutes(text, text),
  public._festival_plan_preview_window(uuid, date, timestamptz, timestamptz, text, text, text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public._festival_attendee_legacy_edition(uuid),
  public._festival_plan_location_key(text),
  public._festival_plan_location_label(text),
  public._festival_plan_travel_minutes(text, text),
  public._festival_plan_preview_window(uuid, date, timestamptz, timestamptz, text, text, text)
  TO service_role;

REVOKE ALL ON FUNCTION public.preview_festival_day_plan_item(uuid, date, time without time zone, integer, text)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.preview_festival_day_plan_item(uuid, date, time without time zone, integer, text)
  TO authenticated, service_role;

COMMENT ON FUNCTION public.preview_festival_day_plan_item(uuid, date, time without time zone, integer, text) IS
  'C5 server-authoritative feasibility and travel preview for a manual Festival My Day block.';

NOTIFY pgrst, 'reload schema';
