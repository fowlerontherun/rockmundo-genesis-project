-- Admin attendee diagnostics and bounded recovery for modern Festival attendance.
--
-- The admin workspace still selects legacy/canonical festival_editions rows while
-- attendee authority lives on festival_editions_v2. Resolve that relationship
-- only through the existing explicit public legacy bridge. Never assume IDs are
-- interchangeable.

CREATE OR REPLACE FUNCTION public.admin_festival_attendee_diagnostics(p_edition_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_festival_id uuid;
  v_modern_edition_id uuid;
  v_launch_id uuid;
  v_rows jsonb := '[]'::jsonb;
BEGIN
  IF NOT coalesce(public.has_role(auth.uid(), 'admin'::public.app_role), false) THEN
    RAISE EXCEPTION 'festival_attendee_admin_forbidden' USING ERRCODE = '42501';
  END IF;

  SELECT edition.festival_id
    INTO v_festival_id
  FROM public.festival_editions edition
  WHERE edition.id = p_edition_id;

  IF v_festival_id IS NULL THEN
    RAISE EXCEPTION 'festival_admin_edition_not_found' USING ERRCODE = 'P0001';
  END IF;

  SELECT bridge.festival_edition_id
    INTO v_modern_edition_id
  FROM public.festival_public_legacy_bridges bridge
  WHERE bridge.legacy_festival_id = v_festival_id
    AND bridge.festival_edition_id IS NOT NULL
  ORDER BY bridge.created_at DESC
  LIMIT 1;

  IF v_modern_edition_id IS NULL THEN
    RETURN jsonb_build_object(
      'legacyEditionId', p_edition_id,
      'legacyFestivalId', v_festival_id,
      'modernEditionId', NULL,
      'mappingStatus', 'unmapped',
      'attendance', '[]'::jsonb,
      'summary', jsonb_build_object(
        'total', 0,
        'attentionRequired', 0,
        'attending', 0,
        'completed', 0
      )
    );
  END IF;

  SELECT launch.id
    INTO v_launch_id
  FROM public.festival_launches launch
  WHERE launch.festival_edition_id = v_modern_edition_id
  ORDER BY launch.created_at DESC
  LIMIT 1;

  SELECT coalesce(jsonb_agg(row_payload ORDER BY row_payload->>'createdAt'), '[]'::jsonb)
    INTO v_rows
  FROM (
    SELECT jsonb_build_object(
      'attendanceId', attendance.id,
      'profileId', attendance.profile_id,
      'status', attendance.status,
      'createdAt', attendance.created_at,
      'checkedInAt', attendance.checked_in_at,
      'leftAt', attendance.left_at,
      'completedAt', attendance.completed_at,
      'ticketId', attendance.admission_ticket_id,
      'ticketStatus', ticket.status,
      'scheduleActivityId', attendance.schedule_activity_id,
      'scheduleStatus', schedule.status,
      'wristbandPresent', EXISTS (
        SELECT 1
        FROM public.festival_player_memorabilia memorabilia
        WHERE memorabilia.attendance_id = attendance.id
          AND memorabilia.item_type = 'wristband'
      ),
      'lifecycleVersion', attendance.lifecycle_version,
      'lastTransitionSource', attendance.last_transition_source,
      'lastTransitionReason', attendance.last_transition_reason,
      'lastTransitionAt', attendance.last_transition_at,
      'eventCount', (
        SELECT count(*)
        FROM public.festival_player_attendance_events event
        WHERE event.attendance_id = attendance.id
      ),
      'issues', jsonb_strip_nulls(jsonb_build_array(
        CASE
          WHEN attendance.status = 'attending' AND ticket.status IS DISTINCT FROM 'used'
          THEN 'attending_ticket_not_used'
        END,
        CASE
          WHEN attendance.status = 'attending' AND NOT EXISTS (
            SELECT 1 FROM public.festival_player_memorabilia memorabilia
            WHERE memorabilia.attendance_id = attendance.id
              AND memorabilia.item_type = 'wristband'
          ) THEN 'attending_missing_wristband'
        END,
        CASE
          WHEN attendance.status = 'attending'
            AND (schedule.id IS NULL OR schedule.status IS DISTINCT FROM 'in_progress')
          THEN 'attending_schedule_not_active'
        END,
        CASE
          WHEN attendance.status IN ('left_early','completed','cancelled','refunded')
            AND schedule.status IN ('scheduled','in_progress')
          THEN 'terminal_attendance_has_active_schedule'
        END
      ))
    ) AS row_payload
    FROM public.festival_player_attendance attendance
    LEFT JOIN public.festival_issued_tickets ticket
      ON ticket.id = attendance.admission_ticket_id
    LEFT JOIN public.player_scheduled_activities schedule
      ON schedule.id = attendance.schedule_activity_id
    WHERE attendance.festival_edition_id = v_modern_edition_id
      AND (v_launch_id IS NULL OR attendance.festival_launch_id = v_launch_id)
  ) rows;

  RETURN jsonb_build_object(
    'legacyEditionId', p_edition_id,
    'legacyFestivalId', v_festival_id,
    'modernEditionId', v_modern_edition_id,
    'launchId', v_launch_id,
    'mappingStatus', 'mapped',
    'attendance', v_rows,
    'summary', jsonb_build_object(
      'total', jsonb_array_length(v_rows),
      'attentionRequired', (
        SELECT count(*)
        FROM jsonb_array_elements(v_rows) item
        WHERE jsonb_array_length(coalesce(item->'issues', '[]'::jsonb)) > 0
      ),
      'attending', (
        SELECT count(*) FROM jsonb_array_elements(v_rows) item WHERE item->>'status' = 'attending'
      ),
      'completed', (
        SELECT count(*) FROM jsonb_array_elements(v_rows) item WHERE item->>'status' = 'completed'
      )
    )
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.admin_festival_attendee_diagnostics(uuid)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_festival_attendee_diagnostics(uuid)
  TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.admin_reconcile_festival_attendance(
  p_edition_id uuid,
  p_attendance_id uuid,
  p_reason text,
  p_idempotency_key text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_actor uuid := public.current_profile_id_safe();
  v_festival_id uuid;
  v_modern_edition_id uuid;
  v_attendance public.festival_player_attendance%ROWTYPE;
  v_before jsonb;
  v_after jsonb;
  v_sync_state text;
  v_completion_state text;
  v_ticket_state text := 'not_applicable';
  v_schedule_state text := 'not_applicable';
  v_wristband_healthy boolean := false;
  v_existing jsonb;
BEGIN
  IF NOT coalesce(public.has_role(auth.uid(), 'admin'::public.app_role), false) THEN
    RAISE EXCEPTION 'festival_attendee_admin_forbidden' USING ERRCODE = '42501';
  END IF;

  IF nullif(btrim(p_reason), '') IS NULL THEN
    RAISE EXCEPTION 'festival_attendee_recovery_reason_required' USING ERRCODE = 'P0001';
  END IF;

  IF p_idempotency_key IS NOT NULL THEN
    SELECT audit.after_snapshot
      INTO v_existing
    FROM public.festival_admin_audit_events audit
    WHERE audit.operation = 'attendee_reconciled'
      AND audit.idempotency_key = p_idempotency_key
    LIMIT 1;
    IF FOUND THEN
      RETURN v_existing;
    END IF;
  END IF;

  SELECT edition.festival_id
    INTO v_festival_id
  FROM public.festival_editions edition
  WHERE edition.id = p_edition_id;

  SELECT bridge.festival_edition_id
    INTO v_modern_edition_id
  FROM public.festival_public_legacy_bridges bridge
  WHERE bridge.legacy_festival_id = v_festival_id
    AND bridge.festival_edition_id IS NOT NULL
  ORDER BY bridge.created_at DESC
  LIMIT 1;

  IF v_modern_edition_id IS NULL THEN
    RAISE EXCEPTION 'festival_attendee_modern_edition_unmapped' USING ERRCODE = 'P0001';
  END IF;

  SELECT attendance.*
    INTO v_attendance
  FROM public.festival_player_attendance attendance
  WHERE attendance.id = p_attendance_id
    AND attendance.festival_edition_id = v_modern_edition_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'festival_attendance_not_found_for_edition' USING ERRCODE = 'P0001';
  END IF;

  v_before := to_jsonb(v_attendance);

  -- First re-run the canonical lifecycle synchronizer. This can safely persist
  -- readiness or cancellation/refund state but never fabricates attendance.
  v_sync_state := public._festival_sync_attendance_lifecycle(v_attendance.id);

  -- Then allow the existing expiry authority to complete a genuinely attending
  -- character when the Festival-local end has elapsed.
  v_completion_state := public._festival_complete_attendance_if_expired(v_attendance.id);

  SELECT attendance.*
    INTO v_attendance
  FROM public.festival_player_attendance attendance
  WHERE attendance.id = p_attendance_id
  FOR UPDATE;

  IF v_attendance.status = 'attending' THEN
    v_ticket_state := public._festival_repair_attendance_ticket_used(v_attendance.id);
    v_wristband_healthy := public._festival_ensure_attendance_wristband(v_attendance.id);
    v_schedule_state := public._festival_repair_attendance_schedule_lock(v_attendance.id);
  ELSIF v_attendance.status IN ('left_early', 'completed') THEN
    v_wristband_healthy := public._festival_ensure_attendance_wristband(v_attendance.id);
    PERFORM public._festival_close_attendance_schedule_lock(
      v_attendance.id,
      'admin_reconcile_terminal_attendance'
    );
  END IF;

  SELECT attendance.*
    INTO v_attendance
  FROM public.festival_player_attendance attendance
  WHERE attendance.id = p_attendance_id;

  v_after := jsonb_build_object(
    'attendance', to_jsonb(v_attendance),
    'syncState', v_sync_state,
    'completionState', v_completion_state,
    'ticketState', v_ticket_state,
    'scheduleState', v_schedule_state,
    'wristbandHealthy', v_wristband_healthy,
    'reconciledAt', now()
  );

  INSERT INTO public.festival_admin_audit_events(
    actor_profile_id,
    authority,
    festival_id,
    edition_id,
    operation,
    target_type,
    target_id,
    before_snapshot,
    after_snapshot,
    reason,
    idempotency_key
  ) VALUES (
    v_actor,
    'platform_admin',
    v_festival_id,
    p_edition_id,
    'attendee_reconciled',
    'festival_player_attendance',
    p_attendance_id,
    v_before,
    v_after,
    p_reason,
    p_idempotency_key
  );

  RETURN v_after;
END;
$function$;

REVOKE ALL ON FUNCTION public.admin_reconcile_festival_attendance(uuid, uuid, text, text)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_reconcile_festival_attendance(uuid, uuid, text, text)
  TO authenticated, service_role;

COMMENT ON FUNCTION public.admin_festival_attendee_diagnostics(uuid) IS
  'Admin-only attendee/ticket/schedule/wristband diagnostics resolved from a legacy admin edition through the explicit modern Festival bridge.';
COMMENT ON FUNCTION public.admin_reconcile_festival_attendance(uuid, uuid, text, text) IS
  'Admin-only, reason-required, audited reconciliation that invokes existing bounded Festival attendee recovery authorities without forcing arbitrary lifecycle state.';

NOTIFY pgrst, 'reload schema';
