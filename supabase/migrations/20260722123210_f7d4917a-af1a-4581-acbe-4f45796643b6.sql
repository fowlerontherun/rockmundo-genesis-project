ALTER TABLE public.festival_stages ADD COLUMN IF NOT EXISTS public_name text;

CREATE OR REPLACE FUNCTION public.festival_edition_schedule_workspace(p_edition_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  e public.festival_editions%ROWTYPE;
  tz text := 'UTC';
  first_day date;
  last_day date;
  dates jsonb;
  can_edit boolean;
BEGIN
  SELECT * INTO e FROM public.festival_editions WHERE id = p_edition_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'FESTIVAL_SCHEDULE_EDITION_NOT_FOUND'; END IF;
  can_edit := COALESCE(public.can_manage_festival_edition(p_edition_id), false);
  IF NOT can_edit THEN RAISE EXCEPTION 'FESTIVAL_SCHEDULE_PERMISSION_DENIED'; END IF;
  tz := COALESCE(NULLIF(e.timezone, ''), 'UTC');
  first_day := COALESCE((e.start_at AT TIME ZONE tz)::date, CURRENT_DATE);
  last_day := COALESCE((e.end_at AT TIME ZONE tz)::date, first_day);
  IF last_day < first_day THEN last_day := first_day; END IF;
  SELECT COALESCE(jsonb_agg(to_char(d, 'YYYY-MM-DD') ORDER BY d), '[]'::jsonb) INTO dates FROM generate_series(first_day, last_day, '1 day'::interval) d;

  RETURN jsonb_build_object(
    'festival', (SELECT to_jsonb(f) FROM public.festivals f WHERE f.id = e.festival_id),
    'edition', to_jsonb(e),
    'timeZone', tz,
    'festivalDates', dates,
    'scheduleState', 'draft',
    'draftRevision', jsonb_build_object('id', p_edition_id, 'revision_number', 1, 'state', 'draft'),
    'publishedRevision', NULL,
    'revisionHistory', jsonb_build_array(jsonb_build_object('id', p_edition_id, 'revision_number', 1, 'state', 'draft')),
    'stages', COALESCE((SELECT jsonb_agg(to_jsonb(s) ORDER BY s.stage_number NULLS LAST, s.stage_name) FROM public.festival_stages s WHERE s.edition_id = p_edition_id AND s.archived_at IS NULL), '[]'::jsonb),
    'operatingHours', '[]'::jsonb,
    'scheduleItems', COALESCE((SELECT jsonb_agg(jsonb_build_object('id', sl.id, 'revision_id', p_edition_id, 'festival_id', sl.festival_id, 'edition_id', sl.edition_id, 'stage_id', sl.stage_id, 'festival_date', (sl.start_time AT TIME ZONE tz)::date, 'item_type', 'performance_slot', 'starts_at', sl.start_time, 'ends_at', sl.end_time, 'duration_minutes', GREATEST(1, EXTRACT(epoch FROM (sl.end_time - sl.start_time))::integer / 60), 'title', initcap(replace(COALESCE(sl.slot_type, 'performance_slot'), '_', ' ')), 'status', COALESCE(sl.status, 'open'), 'locked', COALESCE(sl.canonical_contract_id IS NOT NULL, false), 'public_visible', COALESCE(sl.public_status = 'published', false), 'changeover_minutes', COALESCE(sl.changeover_minutes, 0), 'version', 1, 'band_id', sl.band_id, 'contract_id', sl.canonical_contract_id, 'stage_slot_id', sl.id) ORDER BY sl.day_number, sl.start_time, sl.slot_number) FROM public.festival_stage_slots sl WHERE sl.edition_id = p_edition_id), '[]'::jsonb),
    'unscheduledItems', '[]'::jsonb,
    'conflictSummary', jsonb_build_object('items', '[]'::jsonb, 'blockingCount', 0, 'warningCount', 0),
    'readinessSummary', jsonb_build_object('structural', jsonb_build_array(jsonb_build_object('key','stages_configured','complete', EXISTS(SELECT 1 FROM public.festival_stages WHERE edition_id = p_edition_id)), jsonb_build_object('key','slots_created','complete', EXISTS(SELECT 1 FROM public.festival_stage_slots WHERE edition_id = p_edition_id))), 'booking', '[]'::jsonb),
    'permissions', jsonb_build_object('viewSchedule', true, 'editDraftSchedule', can_edit, 'configureStages', can_edit, 'applyTemplates', can_edit, 'publishSchedule', can_edit, 'lockSchedule', can_edit, 'overrideLock', false, 'viewRevisionHistory', true),
    'availableActions', jsonb_build_array('create_item','preview_template','apply_template','publish_schedule')
  );
END $$;

CREATE OR REPLACE FUNCTION public.festival_schedule_preview_template(p_edition_id uuid, p_stage_id uuid, p_festival_date date, p_template text, p_opening_time time DEFAULT '12:00', p_curfew time DEFAULT '23:00') RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE specs jsonb; item jsonb; out jsonb := '[]'::jsonb; t integer; end_min integer; dur integer; ch integer;
BEGIN
  IF NOT COALESCE(public.can_manage_festival_edition(p_edition_id), false) THEN RAISE EXCEPTION 'FESTIVAL_SCHEDULE_PERMISSION_DENIED'; END IF;
  specs := CASE p_template WHEN 'small_stage' THEN '[{"title":"Opening act","duration":35,"changeover":20},{"title":"Support","duration":45,"changeover":25},{"title":"Headliner","duration":75,"changeover":0}]'::jsonb WHEN 'festival_main_stage' THEN '[{"title":"Early act","duration":35,"changeover":25},{"title":"Daytime act 1","duration":40,"changeover":25},{"title":"Daytime act 2","duration":40,"changeover":25},{"title":"Daytime act 3","duration":45,"changeover":30},{"title":"Main support","duration":55,"changeover":35},{"title":"Special guest","duration":50,"changeover":30},{"title":"Headliner","duration":90,"changeover":0}]'::jsonb ELSE '[{"title":"Early opener","duration":35,"changeover":20},{"title":"Opener","duration":40,"changeover":25},{"title":"Mid-card","duration":45,"changeover":25},{"title":"Support","duration":55,"changeover":30},{"title":"Headliner","duration":80,"changeover":0}]'::jsonb END;
  t := EXTRACT(hour FROM p_opening_time)::int * 60 + EXTRACT(minute FROM p_opening_time)::int; end_min := EXTRACT(hour FROM p_curfew)::int * 60 + EXTRACT(minute FROM p_curfew)::int; IF end_min <= t THEN end_min := end_min + 1440; END IF;
  FOR item IN SELECT * FROM jsonb_array_elements(specs) LOOP
    dur := (item->>'duration')::int; ch := (item->>'changeover')::int;
    out := out || jsonb_build_array(jsonb_build_object('title', item->>'title', 'itemType', 'performance_slot', 'festivalDate', p_festival_date, 'stageId', p_stage_id, 'startsAt', to_char((p_festival_date::timestamp + make_interval(mins => t)), 'YYYY-MM-DD"T"HH24:MI:SS'), 'endsAt', to_char((p_festival_date::timestamp + make_interval(mins => t + dur)), 'YYYY-MM-DD"T"HH24:MI:SS'), 'durationMinutes', dur, 'changeoverMinutes', ch, 'slotType', CASE WHEN item->>'title' ILIKE '%headliner%' THEN 'headline' WHEN item->>'title' ILIKE '%opening%' OR item->>'title' ILIKE '%opener%' THEN 'opener' ELSE 'support' END, 'conflicts', CASE WHEN t + dur > end_min THEN jsonb_build_array('curfew') ELSE '[]'::jsonb END));
    t := t + dur + ch;
  END LOOP;
  RETURN jsonb_build_object('template', p_template, 'items', out, 'unusedMinutes', GREATEST(0, end_min - t), 'conflicts', '[]'::jsonb);
END $$;

CREATE OR REPLACE FUNCTION public.generate_festival_stage_slots(p_stage_id uuid, p_date date, p_opening_time time, p_curfew time, p_slot_templates jsonb, p_changeover_duration integer DEFAULT 30, p_soundcheck_policy jsonb DEFAULT '{}'::jsonb, p_idempotency_key text DEFAULT NULL, p_apply boolean DEFAULT false) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_edition_id uuid; v_festival_id uuid; v_day_number integer; v_first_day date; v_cursor timestamptz; v_end_ts timestamptz; v_template jsonb; v_duration integer; v_slot_type text; v_created jsonb := '[]'::jsonb; v_preview jsonb := '[]'::jsonb; v_slot_number integer := 0; v_start timestamptz; v_end timestamptz; v_slot public.festival_stage_slots%ROWTYPE; v_tz text := 'UTC';
BEGIN
  SELECT s.edition_id, s.festival_id INTO v_edition_id, v_festival_id FROM public.festival_stages s WHERE s.id = p_stage_id;
  IF v_edition_id IS NULL THEN RAISE EXCEPTION 'FESTIVAL_EDITION_NOT_FOUND'; END IF;
  IF NOT public.can_manage_festival_edition(v_edition_id) THEN RAISE EXCEPTION 'FESTIVAL_CREATE_PERMISSION_DENIED'; END IF;
  SELECT (start_at AT TIME ZONE COALESCE(NULLIF(timezone,''), 'UTC'))::date, COALESCE(NULLIF(timezone,''), 'UTC') INTO v_first_day, v_tz FROM public.festival_editions WHERE id = v_edition_id;
  v_day_number := GREATEST(1, (p_date - COALESCE(v_first_day, p_date)) + 1); v_cursor := (p_date::text || ' ' || p_opening_time::text)::timestamp AT TIME ZONE v_tz; v_end_ts := (p_date::text || ' ' || p_curfew::text)::timestamp AT TIME ZONE v_tz; IF v_end_ts <= v_cursor THEN v_end_ts := v_end_ts + interval '1 day'; END IF;
  FOR v_template IN SELECT * FROM jsonb_array_elements(COALESCE(p_slot_templates,'[]'::jsonb)) LOOP
    v_duration := GREATEST(COALESCE(NULLIF(COALESCE(v_template->>'durationMinutes', v_template->>'duration_minutes'), '')::integer, 45), 5); v_slot_type := COALESCE(NULLIF(COALESCE(v_template->>'slotType', v_template->>'slot_type', v_template->>'type'), ''), 'act'); v_start := v_cursor; v_end := v_start + make_interval(mins => v_duration); IF v_end > v_end_ts THEN EXIT; END IF; v_slot_number := v_slot_number + 1;
    IF p_apply THEN INSERT INTO public.festival_stage_slots(stage_id, festival_id, edition_id, day_number, slot_number, slot_type, start_time, end_time, status, public_status, changeover_minutes, headline_eligible) VALUES (p_stage_id, v_festival_id, v_edition_id, v_day_number, v_slot_number, v_slot_type, v_start, v_end, 'open', 'unannounced', COALESCE(p_changeover_duration, 30), v_slot_type = 'headline') RETURNING * INTO v_slot; v_created := v_created || to_jsonb(v_slot); ELSE v_preview := v_preview || jsonb_build_object('slotNumber', v_slot_number, 'slotType', v_slot_type, 'startTime', v_start, 'endTime', v_end, 'durationMinutes', v_duration); END IF;
    v_cursor := v_end + make_interval(mins => COALESCE(p_changeover_duration, 30));
  END LOOP;
  IF p_apply THEN INSERT INTO public.festival_admin_audit_events(actor_profile_id, authority, festival_id, edition_id, operation, target_type, target_id, after_snapshot, idempotency_key) VALUES (public.current_profile_id_safe(), CASE WHEN public.festival_current_user_is_admin() THEN 'platform_admin' ELSE 'owner' END, v_festival_id, v_edition_id, 'generate_stage_slots', 'stage', p_stage_id, jsonb_build_object('date', p_date, 'count', jsonb_array_length(v_created)), p_idempotency_key); END IF;
  RETURN jsonb_build_object('applied', p_apply, 'created', v_created, 'preview', v_preview, 'stageId', p_stage_id, 'date', p_date);
END $$;

CREATE OR REPLACE FUNCTION public.festival_schedule_apply_template(p_edition_id uuid, p_revision_id uuid, p_stage_id uuid, p_festival_date date, p_template text, p_opening_time time DEFAULT '12:00', p_curfew time DEFAULT '23:00', p_confirm_overwrite boolean DEFAULT false, p_idempotency_key text DEFAULT NULL) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE preview jsonb; item jsonb; templates jsonb := '[]'::jsonb; result jsonb; default_changeover integer := 30;
BEGIN
  IF NOT COALESCE(public.can_manage_festival_edition(p_edition_id), false) THEN RAISE EXCEPTION 'FESTIVAL_SCHEDULE_PERMISSION_DENIED'; END IF;
  preview := public.festival_schedule_preview_template(p_edition_id, p_stage_id, p_festival_date, p_template, p_opening_time, p_curfew);
  FOR item IN SELECT * FROM jsonb_array_elements(preview->'items') LOOP default_changeover := COALESCE((item->>'changeoverMinutes')::integer, default_changeover); templates := templates || jsonb_build_object('slotType', COALESCE(item->>'slotType', 'act'), 'durationMinutes', COALESCE((item->>'durationMinutes')::integer, 45)); END LOOP;
  result := public.generate_festival_stage_slots(p_stage_id, p_festival_date, p_opening_time, p_curfew, templates, default_changeover, '{}'::jsonb, p_idempotency_key, true);
  RETURN jsonb_build_object('applied', true, 'items', result->'created');
END $$;

CREATE OR REPLACE FUNCTION public.festival_schedule_publish(p_edition_id uuid, p_revision_id uuid, p_acknowledge_warnings boolean DEFAULT false, p_idempotency_key text DEFAULT NULL) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN IF NOT COALESCE(public.can_manage_festival_edition(p_edition_id), false) THEN RAISE EXCEPTION 'FESTIVAL_SCHEDULE_PERMISSION_DENIED'; END IF; UPDATE public.festival_stage_slots SET public_status = 'published' WHERE edition_id = p_edition_id AND public_status <> 'published'; RETURN jsonb_build_object('published', true, 'edition_id', p_edition_id); END $$;

CREATE OR REPLACE FUNCTION public.apply_for_festival_edition_permit(p_edition_id uuid, p_requirement_code text, p_idempotency_key text DEFAULT NULL) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_festival_id uuid; v_city_id uuid; v_permit public.festival_permits%ROWTYPE; v_fee bigint;
BEGIN
  IF NOT public.can_manage_festival_edition(p_edition_id) THEN RAISE EXCEPTION 'FESTIVAL_CREATE_PERMISSION_DENIED'; END IF; SELECT festival_id, city_id INTO v_festival_id, v_city_id FROM public.festival_editions WHERE id = p_edition_id; IF v_festival_id IS NULL THEN RAISE EXCEPTION 'FESTIVAL_EDITION_NOT_FOUND'; END IF;
  v_fee := CASE lower(p_requirement_code) WHEN 'public_event_licence' THEN 250000 WHEN 'alcohol_licence' THEN 180000 WHEN 'noise_permit' THEN 90000 WHEN 'fire_safety_certificate' THEN 120000 WHEN 'medical_cover_permit' THEN 150000 WHEN 'security_plan_approval' THEN 100000 WHEN 'road_closure_order' THEN 200000 ELSE 50000 END;
  SELECT * INTO v_permit FROM public.festival_permits WHERE edition_id = p_edition_id AND permit_type = p_requirement_code LIMIT 1;
  IF FOUND THEN UPDATE public.festival_permits SET status = 'pending', permit_fee_cents = v_fee, updated_at = now() WHERE id = v_permit.id RETURNING * INTO v_permit; ELSE INSERT INTO public.festival_permits(festival_id, edition_id, city_id, permit_type, status, permit_fee_cents) VALUES (v_festival_id, p_edition_id, v_city_id, p_requirement_code, 'pending', v_fee) RETURNING * INTO v_permit; END IF;
  INSERT INTO public.festival_admin_audit_events(actor_profile_id, authority, festival_id, edition_id, operation, target_type, target_id, after_snapshot, idempotency_key) VALUES (public.current_profile_id_safe(), CASE WHEN public.festival_current_user_is_admin() THEN 'platform_admin' ELSE 'owner' END, v_festival_id, p_edition_id, 'apply_permit', 'permit', v_permit.id, to_jsonb(v_permit), p_idempotency_key);
  RETURN to_jsonb(v_permit);
END $$;

CREATE OR REPLACE FUNCTION public.admin_festival_edition_lifecycle_options(p_edition_id uuid) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE v_status public.festival_edition_status; v_transitions jsonb := '[]'::jsonb; v_targets text[]; v_target text; v_available boolean; v_blockers text[]; v_warnings text[]; v_is_admin boolean;
BEGIN
  IF NOT public.can_manage_festival_edition(p_edition_id) THEN RAISE EXCEPTION 'FESTIVAL_CREATE_PERMISSION_DENIED'; END IF; v_is_admin := COALESCE(public.has_role(auth.uid(),'admin'::public.app_role), false); SELECT status INTO v_status FROM public.festival_editions WHERE id = p_edition_id; IF v_status IS NULL THEN RAISE EXCEPTION 'FESTIVAL_EDITION_NOT_FOUND: edition % not found', p_edition_id; END IF;
  v_targets := CASE v_status WHEN 'concept' THEN ARRAY['planning','cancelled','abandoned'] WHEN 'planning' THEN ARRAY['applications_open','booking','announced','cancelled','abandoned'] WHEN 'applications_open' THEN ARRAY['booking','announced','postponed','cancelled'] WHEN 'booking' THEN ARRAY['announced','on_sale','postponed','cancelled'] WHEN 'announced' THEN ARRAY['on_sale','setup','postponed','cancelled'] WHEN 'on_sale' THEN ARRAY['setup','postponed','cancelled'] WHEN 'setup' THEN ARRAY['live','postponed','cancelled'] WHEN 'live' THEN ARRAY['settling','completed','cancelled'] WHEN 'settling' THEN ARRAY['completed'] WHEN 'postponed' THEN ARRAY['planning','announced','cancelled'] ELSE ARRAY[]::text[] END;
  FOREACH v_target IN ARRAY v_targets LOOP v_blockers := ARRAY[]::text[]; v_warnings := ARRAY[]::text[]; v_available := true; IF v_target IN ('announced','on_sale') AND NOT EXISTS (SELECT 1 FROM public.festival_stages WHERE edition_id = p_edition_id AND archived_at IS NULL) THEN v_blockers := array_append(v_blockers, 'No stages configured for this edition.'); v_available := false; END IF; v_transitions := v_transitions || jsonb_build_object('targetState', v_target, 'available', v_available, 'blockers', to_jsonb(v_blockers), 'warnings', to_jsonb(v_warnings), 'adminOverrideAllowed', v_is_admin AND v_target IN ('cancelled','abandoned','postponed','live'), 'reasonRequired', v_target IN ('cancelled','abandoned','postponed'), 'confirmationRequired', v_target IN ('live','cancelled','abandoned','completed'), 'severity', CASE WHEN v_target IN ('cancelled','abandoned') THEN 'destructive' WHEN v_target = 'postponed' THEN 'warning' ELSE 'standard' END, 'explanation', CASE v_target WHEN 'planning' THEN 'Move the edition into detailed planning.' WHEN 'applications_open' THEN 'Open band applications for this edition.' WHEN 'booking' THEN 'Close applications and begin booking confirmed acts.' WHEN 'announced' THEN 'Publicly announce the edition.' WHEN 'on_sale' THEN 'Start selling tickets.' WHEN 'setup' THEN 'Move into on-site build and setup.' WHEN 'live' THEN 'Start live operations for this edition.' WHEN 'settling' THEN 'Begin post-event settlement.' WHEN 'completed' THEN 'Mark this edition as fully completed.' WHEN 'postponed' THEN 'Postpone this edition.' WHEN 'cancelled' THEN 'Cancel this edition.' WHEN 'abandoned' THEN 'Abandon this edition.' ELSE '' END); END LOOP;
  RETURN jsonb_build_object('editionId', p_edition_id, 'currentState', v_status::text, 'transitions', v_transitions);
END $$;

CREATE OR REPLACE FUNCTION public.admin_transition_festival_edition(p_edition_id uuid, p_target_status public.festival_edition_status, p_reason text, p_override boolean DEFAULT false, p_metadata jsonb DEFAULT '{}'::jsonb, p_idempotency_key text DEFAULT NULL) RETURNS public.festival_editions LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_old public.festival_editions%ROWTYPE; v_new public.festival_editions%ROWTYPE; v_is_admin boolean;
BEGIN
  v_is_admin := COALESCE(public.has_role(auth.uid(),'admin'::public.app_role), false); IF NOT public.can_manage_festival_edition(p_edition_id) THEN RAISE EXCEPTION 'Admin or festival owner authority required'; END IF; IF p_override AND NOT v_is_admin THEN RAISE EXCEPTION 'Admin authority required for lifecycle override'; END IF; SELECT * INTO v_old FROM public.festival_editions WHERE id = p_edition_id FOR UPDATE; IF NOT FOUND THEN RAISE EXCEPTION 'Festival edition not found'; END IF;
  IF p_override THEN UPDATE public.festival_editions SET status = p_target_status, lifecycle_metadata = lifecycle_metadata || jsonb_build_object('last_admin_override_reason', p_reason), updated_at = now() WHERE id = p_edition_id RETURNING * INTO v_new; INSERT INTO public.festival_edition_lifecycle_events(edition_id, from_status, to_status, actor_profile_id, reason, metadata, idempotency_key) VALUES (p_edition_id, v_old.status, p_target_status, public.current_profile_id_safe(), p_reason, COALESCE(p_metadata,'{}') || jsonb_build_object('admin_override', true), p_idempotency_key); ELSE v_new := public.transition_festival_edition(p_edition_id, p_target_status, NULLIF(p_reason,''), p_metadata, p_idempotency_key); END IF;
  INSERT INTO public.festival_admin_audit_events(actor_profile_id, authority, festival_id, edition_id, operation, target_type, target_id, before_snapshot, after_snapshot, reason, idempotency_key) VALUES (public.current_profile_id_safe(), CASE WHEN v_is_admin THEN 'platform_admin' ELSE 'owner' END, v_old.festival_id, p_edition_id, CASE WHEN p_override THEN 'lifecycle_override' ELSE 'lifecycle_transition' END, 'festival_edition', p_edition_id, to_jsonb(v_old), to_jsonb(v_new), p_reason, p_idempotency_key);
  RETURN v_new;
END $$;

GRANT EXECUTE ON FUNCTION public.festival_edition_schedule_workspace(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.festival_schedule_preview_template(uuid,uuid,date,text,time,time) TO authenticated;
GRANT EXECUTE ON FUNCTION public.generate_festival_stage_slots(uuid,date,time,time,jsonb,integer,jsonb,text,boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.festival_schedule_apply_template(uuid,uuid,uuid,date,text,time,time,boolean,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.festival_schedule_publish(uuid,uuid,boolean,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.apply_for_festival_edition_permit(uuid,text,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_festival_edition_lifecycle_options(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_transition_festival_edition(uuid,public.festival_edition_status,text,boolean,jsonb,text) TO authenticated;