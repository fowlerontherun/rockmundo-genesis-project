-- Backlog B2: make readiness, arrival and stage-start decisions authoritative.
-- The earlier performance-session migration supplied projections; this migration
-- closes the mutation boundary and ensures a stale snapshot can never start a set.

CREATE TABLE public.festival_performance_requirements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES public.festival_performance_sessions(id) ON DELETE CASCADE,
  requirement_code text NOT NULL,
  category text NOT NULL CHECK (category IN (
    'arrival', 'gear', 'technical_rider', 'soundcheck', 'changeover', 'performer_conflict', 'crew_conflict'
  )),
  severity text NOT NULL CHECK (severity IN ('advisory', 'blocking')),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'passed', 'failed', 'waived')),
  message text NOT NULL,
  evidence jsonb NOT NULL DEFAULT '{}',
  evaluated_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (session_id, requirement_code)
);

CREATE INDEX idx_festival_performance_requirements_open
  ON public.festival_performance_requirements(session_id, severity, status);

ALTER TABLE public.festival_performance_requirements ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.festival_performance_requirements FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.festival_performance_requirements TO authenticated;

CREATE POLICY festival_performance_requirements_read
  ON public.festival_performance_requirements FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.festival_performance_sessions session
    WHERE session.id = session_id
      AND (public.is_active_band_member(session.band_id)
        OR public.can_manage_festival_brand(session.festival_id))
  ));

CREATE OR REPLACE FUNCTION public.festival_performance_countdown(p_session_id uuid)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'server_time', now(),
    'arrival_deadline_at', arrival_deadline_at,
    'soundcheck_start_at', soundcheck_start_at,
    'soundcheck_seconds', CASE WHEN soundcheck_start_at IS NULL THEN NULL
      ELSE floor(extract(epoch FROM (soundcheck_start_at - now())))::bigint END,
    'stage_call_at', stage_call_at,
    'performance_start_at', scheduled_start_at,
    'performance_seconds', floor(extract(epoch FROM (scheduled_start_at - now())))::bigint
  )
  FROM public.festival_performance_sessions
  WHERE id = p_session_id
    AND (public.is_active_band_member(band_id) OR public.can_manage_festival_brand(festival_id));
$$;

CREATE OR REPLACE FUNCTION public.check_in_festival_performer(p_session_id uuid, p_idempotency_key text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE session_row public.festival_performance_sessions%ROWTYPE;
  attendance_row public.festival_performance_attendance%ROWTYPE;
  actor uuid := public.current_profile_id_safe(); late integer;
BEGIN
  SELECT * INTO session_row FROM public.festival_performance_sessions WHERE id = p_session_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Festival performance session not found' USING ERRCODE = 'P0002'; END IF;
  IF session_row.status IN ('cancelled', 'no_show', 'abandoned', 'completed', 'partially_completed') THEN
    RAISE EXCEPTION 'Festival arrival is closed';
  END IF;
  IF now() < session_row.arrival_window_opens_at THEN
    RAISE EXCEPTION 'Festival arrival window is not open' USING ERRCODE = 'P0001';
  END IF;
  PERFORM public.festival_snapshot_expected_performers(session_row.id);
  SELECT * INTO attendance_row FROM public.festival_performance_attendance
    WHERE session_id = session_row.id AND profile_id = actor FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Not an expected performer for this session' USING ERRCODE = '42501'; END IF;
  IF attendance_row.checked_in_at IS NOT NULL THEN
    RETURN jsonb_build_object('status', attendance_row.arrival_status, 'late_minutes', attendance_row.late_minutes,
      'idempotent', true, 'countdown', public.festival_performance_countdown(session_row.id));
  END IF;
  late := greatest(0, floor(extract(epoch FROM (now() - session_row.arrival_deadline_at)) / 60)::integer);
  UPDATE public.festival_performance_attendance SET checked_in_at = now(),
    arrival_status = CASE WHEN late > 0 THEN 'late'::public.festival_arrival_status ELSE 'checked_in'::public.festival_arrival_status END,
    late_minutes = late, checked_in_source = 'self', updated_at = now()
    WHERE id = attendance_row.id RETURNING * INTO attendance_row;
  UPDATE public.festival_performance_sessions SET status = CASE
      WHEN NOT EXISTS (SELECT 1 FROM public.festival_performance_attendance missing
        WHERE missing.session_id = session_row.id AND missing.required_attendance AND missing.checked_in_at IS NULL)
      THEN 'checked_in'::public.festival_performance_session_status ELSE 'arrival_open'::public.festival_performance_session_status END,
    updated_at = now(), session_version = session_version + 1 WHERE id = session_row.id;
  INSERT INTO public.festival_performance_session_events(session_id, actor_profile_id, event_type, idempotency_key, metadata)
    VALUES (session_row.id, actor, 'performer_checked_in', p_idempotency_key, jsonb_build_object('late_minutes', late))
    ON CONFLICT DO NOTHING;
  RETURN jsonb_build_object('status', attendance_row.arrival_status, 'late_minutes', late,
    'warning', CASE WHEN late > 0 THEN 'Performer checked in after the arrival deadline' END,
    'idempotent', false, 'countdown', public.festival_performance_countdown(session_row.id));
END;
$$;

-- Rebuild all derived checks in one transaction. Manually supplied rider checks
-- use the rider:* namespace and are retained; every other check is recalculated.
CREATE OR REPLACE FUNCTION public.evaluate_festival_performance_readiness(p_session_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  session_row public.festival_performance_sessions%ROWTYPE;
  slot_row public.festival_stage_slots%ROWTYPE;
  previous_end timestamptz;
  required_changeover integer := 0;
  actual_changeover integer;
  blockers jsonb;
  warnings jsonb;
BEGIN
  SELECT * INTO session_row FROM public.festival_performance_sessions
    WHERE id = p_session_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Festival performance session not found' USING ERRCODE = 'P0002'; END IF;
  IF NOT (public.is_active_band_member(session_row.band_id)
    OR public.can_manage_festival_brand(session_row.festival_id)
    OR auth.role() = 'service_role') THEN
    RAISE EXCEPTION 'Not authorised to evaluate festival readiness' USING ERRCODE = '42501';
  END IF;

  PERFORM public.festival_snapshot_expected_performers(session_row.id);
  DELETE FROM public.festival_performance_requirements
    WHERE session_id = session_row.id AND requirement_code NOT LIKE 'rider:%';

  INSERT INTO public.festival_performance_requirements
    (session_id, requirement_code, category, severity, status, message, evidence, evaluated_at)
  SELECT session_row.id, 'arrival:' || attendance.id, 'arrival',
    CASE WHEN attendance.required_attendance THEN 'blocking' ELSE 'advisory' END,
    CASE WHEN attendance.checked_in_at IS NULL THEN 'failed' ELSE 'passed' END,
    CASE WHEN attendance.checked_in_at IS NULL THEN 'Required performer has not arrived'
      WHEN attendance.late_minutes > 0 THEN 'Performer arrived late' ELSE 'Performer arrived' END,
    jsonb_build_object('profile_id', attendance.profile_id, 'role', attendance.expected_role,
      'late_minutes', attendance.late_minutes), now()
  FROM public.festival_performance_attendance attendance WHERE attendance.session_id = session_row.id;

  INSERT INTO public.festival_performance_requirements
    (session_id, requirement_code, category, severity, status, message, evidence, evaluated_at)
  SELECT session_row.id, 'equipment:' || equipment.id,
    CASE WHEN equipment.compatibility <> 'unchecked' THEN 'technical_rider' ELSE 'gear' END,
    CASE WHEN equipment.readiness IN ('blocked', 'unfit') OR equipment.availability = 'missing'
      OR equipment.compatibility = 'incompatible' THEN 'blocking' ELSE 'advisory' END,
    CASE WHEN equipment.readiness IN ('blocked', 'unfit') OR equipment.availability = 'missing'
      OR equipment.compatibility = 'incompatible' THEN 'failed' ELSE 'passed' END,
    COALESCE(equipment.issue_reason, 'Equipment requirement checked'),
    jsonb_build_object('item', equipment.required_item, 'availability', equipment.availability,
      'compatibility', equipment.compatibility, 'supplied_by', equipment.supplied_by), now()
  FROM public.festival_session_equipment equipment WHERE equipment.session_id = session_row.id;

  INSERT INTO public.festival_performance_requirements
    (session_id, requirement_code, category, severity, status, message, evidence, evaluated_at)
  SELECT session_row.id, 'crew:' || crew.id, 'crew_conflict',
    CASE WHEN crew.readiness IN ('blocked', 'unfit') THEN 'blocking' ELSE 'advisory' END,
    CASE WHEN crew.readiness IN ('blocked', 'unfit') OR crew.workload_conflict IS NOT NULL THEN 'failed' ELSE 'passed' END,
    COALESCE(crew.issue_reason, crew.workload_conflict, 'Crew requirement checked'),
    jsonb_build_object('role', crew.required_role, 'workload_conflict', crew.workload_conflict), now()
  FROM public.festival_session_crew crew WHERE crew.session_id = session_row.id;

  INSERT INTO public.festival_performance_requirements
    (session_id, requirement_code, category, severity, status, message, evidence, evaluated_at)
  SELECT session_row.id, 'incident:' || incident.id, 'technical_rider',
    CASE WHEN incident.severity IN ('critical', 'blocking') THEN 'blocking' ELSE 'advisory' END,
    'failed', 'An unresolved technical or safety incident remains',
    jsonb_build_object('incident_id', incident.id, 'category', incident.category,
      'severity', incident.severity, 'impact', incident.impact), now()
  FROM public.festival_performance_incidents incident
  WHERE incident.session_id = session_row.id AND incident.resolved_at IS NULL;

  -- A profile cannot be required at overlapping canonical performances.
  INSERT INTO public.festival_performance_requirements
    (session_id, requirement_code, category, severity, status, message, evidence, evaluated_at)
  SELECT DISTINCT session_row.id, 'performer-conflict:' || attendance.profile_id,
    'performer_conflict', 'blocking', 'failed', 'Performer is required at an overlapping performance',
    jsonb_build_object('profile_id', attendance.profile_id, 'conflicting_session_id', other.id), now()
  FROM public.festival_performance_attendance attendance
  JOIN public.festival_performance_attendance other_attendance
    ON other_attendance.profile_id = attendance.profile_id AND other_attendance.required_attendance
  JOIN public.festival_performance_sessions other ON other.id = other_attendance.session_id
  WHERE attendance.session_id = session_row.id AND attendance.required_attendance
    AND other.id <> session_row.id
    AND tstzrange(other.scheduled_start_at, other.scheduled_end_at, '[)')
      && tstzrange(session_row.scheduled_start_at, session_row.scheduled_end_at, '[)')
  ON CONFLICT (session_id, requirement_code) DO UPDATE
    SET status = EXCLUDED.status, evidence = EXCLUDED.evidence, evaluated_at = now(), updated_at = now();

  SELECT * INTO slot_row FROM public.festival_stage_slots WHERE id = session_row.stage_slot_id;
  required_changeover := COALESCE(slot_row.changeover_minutes, 0);
  SELECT max(other.scheduled_end_at) INTO previous_end
  FROM public.festival_performance_sessions other
  WHERE other.stage_id = session_row.stage_id AND other.id <> session_row.id
    AND other.scheduled_end_at <= session_row.scheduled_start_at
    AND other.status NOT IN ('cancelled', 'no_show');
  actual_changeover := CASE WHEN previous_end IS NULL THEN required_changeover
    ELSE floor(extract(epoch FROM (session_row.scheduled_start_at - previous_end)) / 60)::integer END;
  INSERT INTO public.festival_performance_requirements
    (session_id, requirement_code, category, severity, status, message, evidence, evaluated_at)
  VALUES (session_row.id, 'schedule:changeover', 'changeover', 'blocking',
    CASE WHEN actual_changeover >= required_changeover THEN 'passed' ELSE 'failed' END,
    CASE WHEN actual_changeover >= required_changeover THEN 'Stage changeover buffer is available'
      ELSE 'Stage changeover buffer is too short' END,
    jsonb_build_object('required_minutes', required_changeover, 'available_minutes', actual_changeover), now());

  INSERT INTO public.festival_performance_requirements
    (session_id, requirement_code, category, severity, status, message, evidence, evaluated_at)
  VALUES (session_row.id, 'schedule:soundcheck', 'soundcheck', 'blocking',
    CASE WHEN session_row.soundcheck_start_at IS NULL OR session_row.soundcheck_end_at IS NOT NULL THEN 'passed'
      ELSE 'failed' END,
    CASE WHEN session_row.soundcheck_start_at IS NULL THEN 'No soundcheck is required'
      WHEN session_row.soundcheck_end_at IS NOT NULL THEN 'Soundcheck is complete'
      ELSE 'Required soundcheck is incomplete' END,
    jsonb_build_object('starts_at', session_row.soundcheck_start_at, 'completed_at', session_row.soundcheck_end_at), now());

  SELECT COALESCE(jsonb_agg(jsonb_build_object('code', requirement_code, 'category', category,
    'message', message, 'evidence', evidence) ORDER BY requirement_code), '[]') INTO blockers
  FROM public.festival_performance_requirements
  WHERE session_id = session_row.id AND severity = 'blocking' AND status = 'failed';
  SELECT COALESCE(jsonb_agg(jsonb_build_object('code', requirement_code, 'category', category,
    'message', message, 'evidence', evidence) ORDER BY requirement_code), '[]') INTO warnings
  FROM public.festival_performance_requirements
  WHERE session_id = session_row.id AND severity = 'advisory' AND status = 'failed';

  RETURN jsonb_build_object('status', CASE WHEN jsonb_array_length(blockers) = 0 THEN 'ready' ELSE 'blocked' END,
    'blockers', blockers, 'warnings', warnings, 'countdown', public.festival_performance_countdown(session_row.id),
    'evaluated_at', now());
END;
$$;

CREATE OR REPLACE FUNCTION public.lock_festival_session_readiness(p_session_id uuid, p_idempotency_key text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE session_row public.festival_performance_sessions%ROWTYPE; readiness jsonb;
BEGIN
  SELECT * INTO session_row FROM public.festival_performance_sessions WHERE id = p_session_id FOR UPDATE;
  readiness := public.evaluate_festival_performance_readiness(p_session_id);
  UPDATE public.festival_performance_sessions SET readiness_locked_at = now(), readiness_snapshot = readiness,
    status = CASE WHEN readiness->>'status' = 'ready' THEN 'ready'::public.festival_performance_session_status ELSE status END,
    updated_at = now(), session_version = session_version + 1 WHERE id = p_session_id;
  INSERT INTO public.festival_performance_session_events(session_id, actor_profile_id, event_type, idempotency_key, metadata)
    VALUES (p_session_id, public.current_profile_id_safe(), 'readiness_locked', p_idempotency_key, readiness)
    ON CONFLICT DO NOTHING;
  RETURN readiness;
END;
$$;

CREATE OR REPLACE FUNCTION public.start_festival_performance(p_session_id uuid, p_idempotency_key text DEFAULT NULL)
RETURNS public.festival_performance_sessions LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE session_row public.festival_performance_sessions%ROWTYPE; readiness jsonb;
BEGIN
  SELECT * INTO session_row FROM public.festival_performance_sessions WHERE id = p_session_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Festival performance session not found' USING ERRCODE = 'P0002'; END IF;
  IF session_row.status = 'in_progress' THEN RETURN session_row; END IF;
  IF NOT (public.can_manage_festival_brand(session_row.festival_id) OR auth.role() = 'service_role') THEN
    RAISE EXCEPTION 'Only the festival operator can start a performance' USING ERRCODE = '42501';
  END IF;
  IF session_row.status NOT IN ('stage_call', 'ready') THEN RAISE EXCEPTION 'Performance must be at stage call or ready'; END IF;
  readiness := public.evaluate_festival_performance_readiness(p_session_id);
  IF readiness->>'status' <> 'ready' THEN
    RAISE EXCEPTION 'Festival performance has unmet hard requirements' USING ERRCODE = 'P0001', DETAIL = readiness::text;
  END IF;
  IF now() > session_row.scheduled_start_at + interval '15 minutes' THEN
    RAISE EXCEPTION 'Late performance requires the authoritative arrival resolver';
  END IF;
  IF EXISTS (SELECT 1 FROM public.festival_performance_sessions other WHERE other.stage_id = session_row.stage_id
    AND other.id <> session_row.id AND other.status = 'in_progress') THEN RAISE EXCEPTION 'Stage already has an active performance'; END IF;
  UPDATE public.festival_performance_sessions SET status = 'in_progress', actual_start_at = now(),
    started_by_profile_id = public.current_profile_id_safe(), readiness_snapshot = readiness,
    updated_at = now(), session_version = session_version + 1,
    performance_evidence = performance_evidence || jsonb_build_object('settlement_status', 'pending', 'no_rewards_awarded', true)
    WHERE id = p_session_id RETURNING * INTO session_row;
  INSERT INTO public.festival_performance_session_events(session_id, actor_profile_id, event_type, idempotency_key, metadata)
    VALUES (session_row.id, public.current_profile_id_safe(), 'performance_started', p_idempotency_key, readiness)
    ON CONFLICT DO NOTHING;
  RETURN session_row;
END;
$$;

-- Called by an operator/worker after the start tolerance. It is idempotent and
-- records both the decision and settlement-facing penalty evidence.
CREATE OR REPLACE FUNCTION public.resolve_festival_late_arrival(p_session_id uuid, p_idempotency_key text)
RETURNS public.festival_performance_sessions LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE session_row public.festival_performance_sessions%ROWTYPE; missing integer; late_minutes integer; penalty integer;
BEGIN
  IF nullif(btrim(p_idempotency_key), '') IS NULL THEN RAISE EXCEPTION 'Idempotency key required'; END IF;
  SELECT * INTO session_row FROM public.festival_performance_sessions WHERE id = p_session_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Festival performance session not found' USING ERRCODE = 'P0002'; END IF;
  IF NOT (public.can_manage_festival_brand(session_row.festival_id) OR auth.role() = 'service_role') THEN
    RAISE EXCEPTION 'Only the festival operator can resolve late arrival' USING ERRCODE = '42501';
  END IF;
  IF session_row.status IN ('no_show', 'cancelled', 'in_progress', 'completed') THEN RETURN session_row; END IF;
  IF now() <= session_row.scheduled_start_at + interval '15 minutes' THEN RAISE EXCEPTION 'No-show tolerance has not elapsed'; END IF;
  SELECT count(*) INTO missing FROM public.festival_performance_attendance
    WHERE session_id = session_row.id AND required_attendance AND checked_in_at IS NULL;
  late_minutes := greatest(0, floor(extract(epoch FROM (now() - session_row.scheduled_start_at)) / 60)::integer);
  penalty := least(100, 25 + late_minutes + missing * 10);
  UPDATE public.festival_performance_attendance SET arrival_status = 'absent',
    participation_status = 'no_show', updated_at = now()
    WHERE session_id = session_row.id AND required_attendance AND checked_in_at IS NULL;
  UPDATE public.festival_performance_sessions SET status = 'no_show', actual_end_at = now(),
    outcome_status = 'settlement_pending', cancellation_evidence = jsonb_build_object(
      'reason', 'arrival_requirements_unmet', 'missing_required_performers', missing,
      'late_minutes', late_minutes, 'penalty_score', penalty, 'resolved_at', now(),
      'actor_profile_id', public.current_profile_id_safe(), 'settlement_pending', true),
    updated_at = now(), session_version = session_version + 1
    WHERE id = session_row.id RETURNING * INTO session_row;
  INSERT INTO public.festival_performance_session_events(session_id, actor_profile_id, event_type, idempotency_key, metadata)
    VALUES (session_row.id, public.current_profile_id_safe(), 'no_show_resolved', p_idempotency_key,
      session_row.cancellation_evidence) ON CONFLICT DO NOTHING;
  RETURN session_row;
END;
$$;

REVOKE ALL ON FUNCTION public.evaluate_festival_performance_readiness(uuid),
  public.festival_performance_countdown(uuid), public.resolve_festival_late_arrival(uuid, text)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.evaluate_festival_performance_readiness(uuid),
  public.festival_performance_countdown(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.resolve_festival_late_arrival(uuid, text) TO authenticated, service_role;

COMMENT ON FUNCTION public.evaluate_festival_performance_readiness(uuid) IS
  'B2 authoritative checklist: separates advisory warnings from hard start blockers.';
COMMENT ON FUNCTION public.resolve_festival_late_arrival(uuid, text) IS
  'B2 operator/worker-only idempotent no-show decision with audit and penalty evidence.';
