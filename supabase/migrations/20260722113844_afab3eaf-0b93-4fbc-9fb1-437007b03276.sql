
CREATE OR REPLACE FUNCTION public.festival_current_user_is_admin()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT COALESCE(public.has_role(auth.uid(), 'admin'::public.app_role), false); $$;

CREATE OR REPLACE FUNCTION public.admin_festival_edition_lifecycle_options(p_edition_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_status public.festival_edition_status; v_transitions jsonb := '[]'::jsonb;
  v_targets text[]; v_target text; v_available boolean;
  v_blockers text[]; v_warnings text[];
BEGIN
  IF NOT public.festival_current_user_is_admin() THEN RAISE EXCEPTION 'FESTIVAL_CREATE_PERMISSION_DENIED'; END IF;
  SELECT status INTO v_status FROM public.festival_editions WHERE id = p_edition_id;
  IF v_status IS NULL THEN RAISE EXCEPTION 'FESTIVAL_EDITION_NOT_FOUND: edition % not found', p_edition_id; END IF;
  v_targets := CASE v_status
    WHEN 'concept' THEN ARRAY['planning','cancelled','abandoned']
    WHEN 'planning' THEN ARRAY['applications_open','booking','announced','cancelled','abandoned']
    WHEN 'applications_open' THEN ARRAY['booking','announced','postponed','cancelled']
    WHEN 'booking' THEN ARRAY['announced','on_sale','postponed','cancelled']
    WHEN 'announced' THEN ARRAY['on_sale','setup','postponed','cancelled']
    WHEN 'on_sale' THEN ARRAY['setup','postponed','cancelled']
    WHEN 'setup' THEN ARRAY['live','postponed','cancelled']
    WHEN 'live' THEN ARRAY['settling','completed','cancelled']
    WHEN 'settling' THEN ARRAY['completed']
    WHEN 'postponed' THEN ARRAY['planning','announced','cancelled']
    ELSE ARRAY[]::text[] END;
  FOREACH v_target IN ARRAY v_targets LOOP
    v_blockers := ARRAY[]::text[]; v_warnings := ARRAY[]::text[]; v_available := true;
    IF v_target IN ('announced','on_sale') AND NOT EXISTS (SELECT 1 FROM public.festival_stages WHERE edition_id = p_edition_id AND archived_at IS NULL) THEN
      v_blockers := array_append(v_blockers, 'No stages configured for this edition.'); v_available := false;
    END IF;
    IF v_target = 'live' THEN
      IF NOT EXISTS (SELECT 1 FROM public.festival_permits WHERE edition_id = p_edition_id AND status = 'approved') THEN
        v_warnings := array_append(v_warnings, 'No approved permits on file.'); END IF;
      IF NOT EXISTS (SELECT 1 FROM public.festival_insurance_policies WHERE edition_id = p_edition_id AND active = true) THEN
        v_warnings := array_append(v_warnings, 'No active insurance policy on file.'); END IF;
    END IF;
    v_transitions := v_transitions || jsonb_build_object(
      'targetState', v_target, 'available', v_available,
      'blockers', to_jsonb(v_blockers), 'warnings', to_jsonb(v_warnings),
      'adminOverrideAllowed', v_target IN ('cancelled','abandoned','postponed'),
      'reasonRequired', v_target IN ('cancelled','abandoned','postponed'),
      'confirmationRequired', v_target IN ('live','cancelled','abandoned','completed'),
      'severity', CASE WHEN v_target IN ('cancelled','abandoned') THEN 'destructive'
                       WHEN v_target = 'postponed' THEN 'warning' ELSE 'standard' END,
      'explanation', CASE v_target
        WHEN 'planning' THEN 'Move the edition into detailed planning.'
        WHEN 'applications_open' THEN 'Open band applications for this edition.'
        WHEN 'booking' THEN 'Close applications and begin booking confirmed acts.'
        WHEN 'announced' THEN 'Publicly announce the edition.'
        WHEN 'on_sale' THEN 'Start selling tickets.'
        WHEN 'setup' THEN 'Move into on-site build and setup.'
        WHEN 'live' THEN 'Start live operations for this edition.'
        WHEN 'settling' THEN 'Begin post-event settlement.'
        WHEN 'completed' THEN 'Mark this edition as fully completed.'
        WHEN 'postponed' THEN 'Postpone this edition.'
        WHEN 'cancelled' THEN 'Cancel this edition.'
        WHEN 'abandoned' THEN 'Abandon this edition.'
        ELSE '' END);
  END LOOP;
  RETURN jsonb_build_object('editionId', p_edition_id, 'currentState', v_status::text, 'transitions', v_transitions);
END; $$;

CREATE OR REPLACE FUNCTION public.create_festival_edition_stage(
  p_edition_id uuid, p_name text, p_type text DEFAULT 'main', p_capacity integer DEFAULT 0,
  p_genre_focus text DEFAULT NULL, p_stage_size text DEFAULT NULL, p_sound_capability text DEFAULT NULL,
  p_lighting_capability text DEFAULT NULL, p_backstage_capability text DEFAULT NULL,
  p_weather_protection text DEFAULT NULL, p_changeover_duration integer DEFAULT 30,
  p_curfew time DEFAULT NULL, p_technical_metadata jsonb DEFAULT '{}'::jsonb,
  p_public_metadata jsonb DEFAULT '{}'::jsonb, p_idempotency_key text DEFAULT NULL
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_festival_id uuid; v_stage public.festival_stages%ROWTYPE; v_next integer;
BEGIN
  IF NOT public.can_manage_festival_edition(p_edition_id) THEN RAISE EXCEPTION 'FESTIVAL_CREATE_PERMISSION_DENIED'; END IF;
  SELECT festival_id INTO v_festival_id FROM public.festival_editions WHERE id = p_edition_id;
  IF v_festival_id IS NULL THEN RAISE EXCEPTION 'FESTIVAL_EDITION_NOT_FOUND'; END IF;
  IF p_idempotency_key IS NOT NULL THEN
    SELECT * INTO v_stage FROM public.festival_stages WHERE edition_id = p_edition_id AND idempotency_key = p_idempotency_key LIMIT 1;
    IF v_stage.id IS NOT NULL THEN RETURN to_jsonb(v_stage); END IF;
  END IF;
  IF EXISTS (SELECT 1 FROM public.festival_stages WHERE edition_id = p_edition_id AND lower(stage_name)=lower(p_name) AND archived_at IS NULL) THEN
    RAISE EXCEPTION 'FESTIVAL_CREATE_STAGE_DUPLICATE'; END IF;
  SELECT COALESCE(MAX(stage_number),0)+1 INTO v_next FROM public.festival_stages WHERE edition_id = p_edition_id;
  INSERT INTO public.festival_stages(festival_id, edition_id, stage_name, stage_number, stage_type, capacity, genre_focus, stage_size, sound_capability, lighting_capability, backstage_capability, weather_protection, default_changeover_minutes, curfew_time, technical_metadata, public_metadata, idempotency_key, created_by)
  VALUES (v_festival_id, p_edition_id, p_name, v_next, p_type, GREATEST(COALESCE(p_capacity,0),0), p_genre_focus, p_stage_size, p_sound_capability, p_lighting_capability, p_backstage_capability, p_weather_protection, COALESCE(p_changeover_duration,30), p_curfew, COALESCE(p_technical_metadata,'{}'::jsonb), COALESCE(p_public_metadata,'{}'::jsonb), p_idempotency_key, auth.uid())
  RETURNING * INTO v_stage;
  INSERT INTO public.festival_admin_audit_events(actor_profile_id, authority, festival_id, edition_id, operation, target_type, target_id, after_snapshot, idempotency_key)
    VALUES (auth.uid(), CASE WHEN public.festival_current_user_is_admin() THEN 'platform_admin' ELSE 'owner' END, v_festival_id, p_edition_id, 'create_stage','stage', v_stage.id, to_jsonb(v_stage), p_idempotency_key);
  RETURN to_jsonb(v_stage);
END; $$;

CREATE OR REPLACE FUNCTION public.generate_festival_stage_slots(
  p_stage_id uuid, p_date date, p_opening_time time, p_curfew time, p_slot_templates jsonb,
  p_changeover_duration integer DEFAULT 30, p_soundcheck_policy jsonb DEFAULT '{}'::jsonb,
  p_idempotency_key text DEFAULT NULL, p_apply boolean DEFAULT false
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_edition_id uuid; v_festival_id uuid; v_day_number integer; v_first_day date;
  v_cursor timestamptz; v_end_ts timestamptz; v_template jsonb; v_duration integer;
  v_slot_type text; v_created jsonb := '[]'::jsonb; v_preview jsonb := '[]'::jsonb;
  v_slot_number integer := 0; v_start timestamptz; v_end timestamptz;
  v_slot public.festival_stage_slots%ROWTYPE;
BEGIN
  SELECT s.edition_id, s.festival_id INTO v_edition_id, v_festival_id FROM public.festival_stages s WHERE s.id = p_stage_id;
  IF v_edition_id IS NULL THEN RAISE EXCEPTION 'FESTIVAL_EDITION_NOT_FOUND'; END IF;
  IF NOT public.can_manage_festival_edition(v_edition_id) THEN RAISE EXCEPTION 'FESTIVAL_CREATE_PERMISSION_DENIED'; END IF;
  SELECT (start_at AT TIME ZONE COALESCE(timezone,'UTC'))::date INTO v_first_day FROM public.festival_editions WHERE id = v_edition_id;
  v_day_number := GREATEST(1, (p_date - COALESCE(v_first_day, p_date)) + 1);
  v_cursor := (p_date::text || ' ' || p_opening_time::text)::timestamptz;
  v_end_ts := (p_date::text || ' ' || p_curfew::text)::timestamptz;
  IF v_end_ts <= v_cursor THEN v_end_ts := v_end_ts + INTERVAL '1 day'; END IF;
  FOR v_template IN SELECT * FROM jsonb_array_elements(COALESCE(p_slot_templates,'[]'::jsonb)) LOOP
    v_duration := GREATEST(COALESCE((v_template->>'durationMinutes')::int, 45), 5);
    v_slot_type := COALESCE(v_template->>'slotType','act');
    v_start := v_cursor; v_end := v_start + make_interval(mins => v_duration);
    IF v_end > v_end_ts THEN EXIT; END IF;
    v_slot_number := v_slot_number + 1;
    IF p_apply THEN
      INSERT INTO public.festival_stage_slots(stage_id, festival_id, edition_id, day_number, slot_number, slot_type, start_time, end_time, status, public_status, changeover_minutes, headline_eligible)
      VALUES (p_stage_id, v_festival_id, v_edition_id, v_day_number, v_slot_number, v_slot_type, v_start, v_end, 'open','unannounced', COALESCE(p_changeover_duration,30), v_slot_type='headline')
      RETURNING * INTO v_slot;
      v_created := v_created || to_jsonb(v_slot);
    ELSE
      v_preview := v_preview || jsonb_build_object('slotNumber', v_slot_number, 'slotType', v_slot_type, 'startTime', v_start, 'endTime', v_end, 'durationMinutes', v_duration);
    END IF;
    v_cursor := v_end + make_interval(mins => COALESCE(p_changeover_duration,30));
  END LOOP;
  IF p_apply THEN
    INSERT INTO public.festival_admin_audit_events(actor_profile_id, authority, festival_id, edition_id, operation, target_type, target_id, after_snapshot, idempotency_key)
    VALUES (auth.uid(), CASE WHEN public.festival_current_user_is_admin() THEN 'platform_admin' ELSE 'owner' END, v_festival_id, v_edition_id, 'generate_stage_slots','stage', p_stage_id, jsonb_build_object('date',p_date,'count',jsonb_array_length(v_created)), p_idempotency_key);
  END IF;
  RETURN jsonb_build_object('applied', p_apply, 'created', v_created, 'preview', v_preview, 'stageId', p_stage_id, 'date', p_date);
END; $$;

CREATE OR REPLACE FUNCTION public.hire_festival_edition_staff(
  p_edition_id uuid, p_candidate_id uuid, p_role text, p_wage_cents bigint,
  p_assignment_scope jsonb DEFAULT '{}'::jsonb, p_shift_start_at timestamptz DEFAULT NULL,
  p_shift_end_at timestamptz DEFAULT NULL, p_idempotency_key text DEFAULT NULL
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_festival_id uuid; v_staff public.festival_staff%ROWTYPE;
BEGIN
  IF NOT public.can_manage_festival_edition(p_edition_id) THEN RAISE EXCEPTION 'FESTIVAL_CREATE_PERMISSION_DENIED'; END IF;
  SELECT festival_id INTO v_festival_id FROM public.festival_editions WHERE id = p_edition_id;
  INSERT INTO public.festival_staff(festival_id, edition_id, role, name, skill_level, weekly_wage_cents, morale, hired_at, metadata)
  VALUES (v_festival_id, p_edition_id, p_role, 'Candidate ' || substr(p_candidate_id::text,1,8), 50, GREATEST(COALESCE(p_wage_cents,0),0), 60, now(),
    jsonb_build_object('candidateId', p_candidate_id, 'assignmentScope', COALESCE(p_assignment_scope,'{}'::jsonb), 'shiftStartAt', p_shift_start_at, 'shiftEndAt', p_shift_end_at, 'idempotencyKey', p_idempotency_key))
  RETURNING * INTO v_staff;
  INSERT INTO public.festival_admin_audit_events(actor_profile_id, authority, festival_id, edition_id, operation, target_type, target_id, after_snapshot, idempotency_key)
    VALUES (auth.uid(), CASE WHEN public.festival_current_user_is_admin() THEN 'platform_admin' ELSE 'owner' END, v_festival_id, p_edition_id, 'hire_staff','staff', v_staff.id, to_jsonb(v_staff), p_idempotency_key);
  RETURN to_jsonb(v_staff);
END; $$;

CREATE OR REPLACE FUNCTION public.apply_for_festival_edition_permit(
  p_edition_id uuid, p_requirement_code text, p_idempotency_key text DEFAULT NULL
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_festival_id uuid; v_city_id uuid; v_permit public.festival_permits%ROWTYPE;
BEGIN
  IF NOT public.can_manage_festival_edition(p_edition_id) THEN RAISE EXCEPTION 'FESTIVAL_CREATE_PERMISSION_DENIED'; END IF;
  SELECT festival_id, city_id INTO v_festival_id, v_city_id FROM public.festival_editions WHERE id = p_edition_id;
  INSERT INTO public.festival_permits(festival_id, edition_id, city_id, permit_type, status, permit_fee_cents)
    VALUES (v_festival_id, p_edition_id, v_city_id, p_requirement_code, 'pending', 50000)
    RETURNING * INTO v_permit;
  INSERT INTO public.festival_admin_audit_events(actor_profile_id, authority, festival_id, edition_id, operation, target_type, target_id, after_snapshot, idempotency_key)
    VALUES (auth.uid(), CASE WHEN public.festival_current_user_is_admin() THEN 'platform_admin' ELSE 'owner' END, v_festival_id, p_edition_id, 'apply_permit','permit', v_permit.id, to_jsonb(v_permit), p_idempotency_key);
  RETURN to_jsonb(v_permit);
END; $$;

CREATE OR REPLACE FUNCTION public.admin_review_festival_edition_permit(
  p_permit_id uuid, p_action text, p_reason text DEFAULT NULL, p_idempotency_key text DEFAULT NULL
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_permit public.festival_permits%ROWTYPE; v_new text;
BEGIN
  IF NOT public.festival_current_user_is_admin() THEN RAISE EXCEPTION 'FESTIVAL_CREATE_PERMISSION_DENIED'; END IF;
  SELECT * INTO v_permit FROM public.festival_permits WHERE id = p_permit_id;
  IF v_permit.id IS NULL THEN RAISE EXCEPTION 'FESTIVAL_EDITION_NOT_FOUND: permit'; END IF;
  v_new := CASE lower(p_action) WHEN 'approve' THEN 'approved' WHEN 'reject' THEN 'rejected' WHEN 'revoke' THEN 'revoked' ELSE p_action END;
  UPDATE public.festival_permits SET status = v_new,
    approved_at = CASE WHEN v_new='approved' THEN now() ELSE approved_at END, updated_at = now()
    WHERE id = p_permit_id RETURNING * INTO v_permit;
  INSERT INTO public.festival_admin_audit_events(actor_profile_id, authority, festival_id, edition_id, operation, target_type, target_id, after_snapshot, reason, idempotency_key)
    VALUES (auth.uid(),'platform_admin', v_permit.festival_id, v_permit.edition_id,'review_permit','permit', v_permit.id, to_jsonb(v_permit), p_reason, p_idempotency_key);
  RETURN to_jsonb(v_permit);
END; $$;

CREATE OR REPLACE FUNCTION public.quote_festival_edition_insurance(
  p_edition_id uuid, p_provider text DEFAULT 'RockMundo Mutual', p_coverage_type text DEFAULT 'standard'
) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE v_cap integer; v_days integer; v_premium bigint; v_ceiling bigint;
BEGIN
  IF NOT public.can_manage_festival_edition(p_edition_id) THEN RAISE EXCEPTION 'FESTIVAL_CREATE_PERMISSION_DENIED'; END IF;
  SELECT COALESCE(capacity, expected_attendance, 5000), GREATEST(1, EXTRACT(day FROM (end_at - start_at))::int + 1)
    INTO v_cap, v_days FROM public.festival_editions WHERE id = p_edition_id;
  v_premium := (v_cap * v_days * CASE p_coverage_type WHEN 'premium' THEN 300 WHEN 'basic' THEN 80 ELSE 150 END)::bigint;
  v_ceiling := v_premium * CASE p_coverage_type WHEN 'premium' THEN 40 WHEN 'basic' THEN 10 ELSE 20 END;
  RETURN jsonb_build_object('quoteId', gen_random_uuid(), 'editionId', p_edition_id, 'provider', p_provider,
    'coverageType', p_coverage_type, 'premiumCents', v_premium, 'payoutCeilingCents', v_ceiling,
    'expiresAt', now() + INTERVAL '48 hours', 'weatherRider', p_coverage_type IN ('standard','premium'));
END; $$;

CREATE OR REPLACE FUNCTION public.purchase_festival_edition_insurance(
  p_quote_id uuid, p_idempotency_key text DEFAULT NULL, p_edition_id uuid DEFAULT NULL,
  p_coverage_type text DEFAULT 'standard', p_premium_cents bigint DEFAULT NULL, p_payout_ceiling_cents bigint DEFAULT NULL
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_edition public.festival_editions%ROWTYPE; v_policy public.festival_insurance_policies%ROWTYPE; v_quote jsonb;
BEGIN
  IF p_edition_id IS NULL THEN RAISE EXCEPTION 'FESTIVAL_EDITION_NOT_FOUND: edition_id required'; END IF;
  IF NOT public.can_manage_festival_edition(p_edition_id) THEN RAISE EXCEPTION 'FESTIVAL_CREATE_PERMISSION_DENIED'; END IF;
  SELECT * INTO v_edition FROM public.festival_editions WHERE id = p_edition_id;
  IF COALESCE(p_premium_cents,0) = 0 THEN
    v_quote := public.quote_festival_edition_insurance(p_edition_id, 'RockMundo Mutual', p_coverage_type);
    p_premium_cents := (v_quote->>'premiumCents')::bigint;
    p_payout_ceiling_cents := (v_quote->>'payoutCeilingCents')::bigint;
  END IF;
  INSERT INTO public.festival_insurance_policies(festival_id, edition_id, coverage_type, premium_cents, payout_ceiling_cents, weather_rider, active, effective_from, effective_to)
  VALUES (v_edition.festival_id, v_edition.id, p_coverage_type, p_premium_cents, p_payout_ceiling_cents,
    p_coverage_type IN ('standard','premium'), true,
    COALESCE((v_edition.start_at AT TIME ZONE COALESCE(v_edition.timezone,'UTC'))::date, CURRENT_DATE),
    COALESCE((v_edition.end_at AT TIME ZONE COALESCE(v_edition.timezone,'UTC'))::date + 1, CURRENT_DATE + 1))
  RETURNING * INTO v_policy;
  INSERT INTO public.festival_admin_audit_events(actor_profile_id, authority, festival_id, edition_id, operation, target_type, target_id, after_snapshot, idempotency_key)
    VALUES (auth.uid(), CASE WHEN public.festival_current_user_is_admin() THEN 'platform_admin' ELSE 'owner' END, v_edition.festival_id, p_edition_id,'purchase_insurance','insurance', v_policy.id, to_jsonb(v_policy), p_idempotency_key);
  RETURN to_jsonb(v_policy);
END; $$;

CREATE OR REPLACE FUNCTION public.admin_festival_data_health()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE v_result jsonb := '[]'::jsonb;
BEGIN
  IF NOT public.festival_current_user_is_admin() THEN RETURN jsonb_build_object('issues','[]'::jsonb); END IF;
  IF to_regclass('public.festival_migration_issues') IS NOT NULL THEN
    EXECUTE 'SELECT COALESCE(jsonb_agg(to_jsonb(i)),''[]''::jsonb) FROM (SELECT * FROM public.festival_migration_issues ORDER BY created_at DESC NULLS LAST LIMIT 200) i' INTO v_result;
  END IF;
  RETURN jsonb_build_object('issues', v_result);
END; $$;

CREATE OR REPLACE FUNCTION public.admin_festival_legacy_records()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE v_result jsonb := '[]'::jsonb;
BEGIN
  IF NOT public.festival_current_user_is_admin() THEN RETURN jsonb_build_object('records','[]'::jsonb); END IF;
  IF to_regclass('public.festival_legacy_mappings') IS NOT NULL THEN
    EXECUTE 'SELECT COALESCE(jsonb_agg(to_jsonb(m)),''[]''::jsonb) FROM (SELECT * FROM public.festival_legacy_mappings ORDER BY created_at DESC NULLS LAST LIMIT 200) m' INTO v_result;
  END IF;
  RETURN jsonb_build_object('records', v_result);
END; $$;

CREATE OR REPLACE FUNCTION public.admin_festival_audit_events(p_filters jsonb DEFAULT '{}'::jsonb)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE v_festival uuid := NULLIF(p_filters->>'festivalId','')::uuid;
        v_edition uuid := NULLIF(p_filters->>'editionId','')::uuid;
        v_op text := NULLIF(p_filters->>'operation','');
        v_result jsonb;
BEGIN
  IF NOT public.festival_current_user_is_admin() THEN RETURN jsonb_build_object('events','[]'::jsonb); END IF;
  SELECT COALESCE(jsonb_agg(to_jsonb(e) ORDER BY e.created_at DESC),'[]'::jsonb) INTO v_result FROM (
    SELECT * FROM public.festival_admin_audit_events
    WHERE (v_festival IS NULL OR festival_id = v_festival)
      AND (v_edition IS NULL OR edition_id = v_edition)
      AND (v_op IS NULL OR operation = v_op)
    ORDER BY created_at DESC LIMIT 200) e;
  RETURN jsonb_build_object('events', v_result);
END; $$;

CREATE OR REPLACE FUNCTION public.repair_festival_data_health_issue(
  p_issue_id uuid, p_action text, p_reason text DEFAULT NULL
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.festival_current_user_is_admin() THEN RAISE EXCEPTION 'FESTIVAL_CREATE_PERMISSION_DENIED'; END IF;
  INSERT INTO public.festival_admin_audit_events(actor_profile_id, authority, operation, target_type, target_id, after_snapshot, reason)
    VALUES (auth.uid(),'platform_admin','repair_data_health','migration_issue', p_issue_id, jsonb_build_object('action',p_action), p_reason);
  RETURN jsonb_build_object('issueId', p_issue_id, 'action', p_action, 'status','acknowledged');
END; $$;

CREATE OR REPLACE FUNCTION public.preview_festival_legacy_migration(p_mapping_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE v_row jsonb;
BEGIN
  IF NOT public.festival_current_user_is_admin() THEN RAISE EXCEPTION 'FESTIVAL_CREATE_PERMISSION_DENIED'; END IF;
  IF to_regclass('public.festival_legacy_mappings') IS NULL THEN
    RETURN jsonb_build_object('mappingId', p_mapping_id,'preview_hash', NULL,'message','Legacy mappings table not available.');
  END IF;
  EXECUTE 'SELECT to_jsonb(m) FROM public.festival_legacy_mappings m WHERE m.id = $1' INTO v_row USING p_mapping_id;
  IF v_row IS NULL THEN RETURN jsonb_build_object('mappingId', p_mapping_id,'preview_hash', NULL,'message','Mapping not found.'); END IF;
  RETURN jsonb_build_object('mappingId', p_mapping_id,'preview_hash', md5(v_row::text),'source', v_row,
    'plan', jsonb_build_array(
      jsonb_build_object('step','link_edition','description','Link legacy record to canonical edition'),
      jsonb_build_object('step','import_metadata','description','Import legacy metadata into edition legacy_metadata')));
END; $$;

CREATE OR REPLACE FUNCTION public.apply_festival_legacy_migration(p_mapping_id uuid, p_idempotency_key text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_row jsonb; v_edition_id uuid;
BEGIN
  IF NOT public.festival_current_user_is_admin() THEN RAISE EXCEPTION 'FESTIVAL_CREATE_PERMISSION_DENIED'; END IF;
  IF to_regclass('public.festival_legacy_mappings') IS NULL THEN
    RETURN jsonb_build_object('mappingId', p_mapping_id,'applied', false,'message','Legacy mappings table not available.');
  END IF;
  EXECUTE 'SELECT to_jsonb(m), m.edition_id FROM public.festival_legacy_mappings m WHERE m.id = $1' INTO v_row, v_edition_id USING p_mapping_id;
  IF v_row IS NULL THEN RETURN jsonb_build_object('mappingId', p_mapping_id,'applied', false,'message','Mapping not found.'); END IF;
  UPDATE public.festival_editions
    SET legacy_metadata = COALESCE(legacy_metadata,'{}'::jsonb) || jsonb_build_object('appliedMappingId', p_mapping_id, 'appliedAt', now())
    WHERE id = v_edition_id;
  INSERT INTO public.festival_admin_audit_events(actor_profile_id, authority, edition_id, operation, target_type, target_id, after_snapshot, idempotency_key)
    VALUES (auth.uid(),'platform_admin', v_edition_id,'apply_legacy_migration','legacy_mapping', p_mapping_id, v_row, p_idempotency_key);
  RETURN jsonb_build_object('mappingId', p_mapping_id,'applied', true,'editionId', v_edition_id);
END; $$;

CREATE OR REPLACE FUNCTION public.preview_copy_festival_edition(
  p_source_edition_id uuid, p_target_edition_id uuid DEFAULT NULL
) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE v_stage int; v_staff int; v_permit int; v_ins int;
BEGIN
  IF NOT (public.festival_current_user_is_admin() OR public.can_manage_festival_edition(p_source_edition_id)) THEN
    RAISE EXCEPTION 'FESTIVAL_CREATE_PERMISSION_DENIED'; END IF;
  SELECT count(*) INTO v_stage FROM public.festival_stages WHERE edition_id = p_source_edition_id AND archived_at IS NULL;
  SELECT count(*) INTO v_staff FROM public.festival_staff WHERE edition_id = p_source_edition_id AND terminated_at IS NULL;
  SELECT count(*) INTO v_permit FROM public.festival_permits WHERE edition_id = p_source_edition_id;
  SELECT count(*) INTO v_ins FROM public.festival_insurance_policies WHERE edition_id = p_source_edition_id;
  RETURN jsonb_build_object('sourceEditionId', p_source_edition_id,'targetEditionId', p_target_edition_id,
    'copies', jsonb_build_object('stages', v_stage,'staff', v_staff,'permits', v_permit,'insurancePolicies', v_ins),
    'notes', jsonb_build_array('Stages will be duplicated with new IDs.','Staff will be re-hired at their previous wages.','Permits will be re-applied and require re-approval.','Insurance policies must be re-quoted.'));
END; $$;

GRANT EXECUTE ON FUNCTION public.festival_current_user_is_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_festival_edition_lifecycle_options(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_festival_edition_stage(uuid,text,text,integer,text,text,text,text,text,text,integer,time,jsonb,jsonb,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.generate_festival_stage_slots(uuid,date,time,time,jsonb,integer,jsonb,text,boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.hire_festival_edition_staff(uuid,uuid,text,bigint,jsonb,timestamptz,timestamptz,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.apply_for_festival_edition_permit(uuid,text,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_review_festival_edition_permit(uuid,text,text,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.quote_festival_edition_insurance(uuid,text,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.purchase_festival_edition_insurance(uuid,text,uuid,text,bigint,bigint) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_festival_data_health() TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_festival_legacy_records() TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_festival_audit_events(jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.repair_festival_data_health_issue(uuid,text,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.preview_festival_legacy_migration(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.apply_festival_legacy_migration(uuid,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.preview_copy_festival_edition(uuid,uuid) TO authenticated;
