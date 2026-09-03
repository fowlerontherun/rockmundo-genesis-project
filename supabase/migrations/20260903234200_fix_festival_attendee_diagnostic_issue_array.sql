-- Keep diagnostic issue arrays strictly string-only for frontend contract parsing.

CREATE OR REPLACE FUNCTION public.admin_festival_attendee_diagnostics(p_edition_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_edition public.festival_editions_v2%ROWTYPE;
  v_launch_id uuid;
  v_rows jsonb := '[]'::jsonb;
BEGIN
  IF NOT coalesce(public.has_role(auth.uid(), 'admin'::public.app_role), false) THEN
    RAISE EXCEPTION 'festival_attendee_admin_forbidden' USING ERRCODE = '42501';
  END IF;

  SELECT edition.* INTO v_edition
  FROM public.festival_editions_v2 edition
  WHERE edition.id = p_edition_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'festival_modern_edition_not_found' USING ERRCODE = 'P0001';
  END IF;

  SELECT launch.id INTO v_launch_id
  FROM public.festival_launches launch
  WHERE launch.festival_edition_id = p_edition_id
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
        SELECT 1 FROM public.festival_player_memorabilia memorabilia
        WHERE memorabilia.attendance_id = attendance.id
          AND memorabilia.item_type = 'wristband'
      ),
      'lifecycleVersion', attendance.lifecycle_version,
      'lastTransitionSource', attendance.last_transition_source,
      'lastTransitionReason', attendance.last_transition_reason,
      'lastTransitionAt', attendance.last_transition_at,
      'eventCount', (
        SELECT count(*) FROM public.festival_player_attendance_events event
        WHERE event.attendance_id = attendance.id
      ),
      'issues', to_jsonb(array_remove(ARRAY[
        CASE WHEN attendance.status='attending' AND ticket.status IS DISTINCT FROM 'used'
          THEN 'attending_ticket_not_used' END,
        CASE WHEN attendance.status='attending' AND NOT EXISTS (
          SELECT 1 FROM public.festival_player_memorabilia memorabilia
          WHERE memorabilia.attendance_id=attendance.id AND memorabilia.item_type='wristband'
        ) THEN 'attending_missing_wristband' END,
        CASE WHEN attendance.status='attending' AND (schedule.id IS NULL OR schedule.status IS DISTINCT FROM 'in_progress')
          THEN 'attending_schedule_not_active' END,
        CASE WHEN attendance.status IN ('left_early','completed','cancelled','refunded') AND schedule.status IN ('scheduled','in_progress')
          THEN 'terminal_attendance_has_active_schedule' END
      ]::text[], NULL))
    ) row_payload
    FROM public.festival_player_attendance attendance
    LEFT JOIN public.festival_issued_tickets ticket ON ticket.id=attendance.admission_ticket_id
    LEFT JOIN public.player_scheduled_activities schedule ON schedule.id=attendance.schedule_activity_id
    WHERE attendance.festival_edition_id=p_edition_id
      AND (v_launch_id IS NULL OR attendance.festival_launch_id=v_launch_id)
  ) rows;

  RETURN jsonb_build_object(
    'festivalEditionId', p_edition_id,
    'festivalCompanyId', v_edition.festival_company_id,
    'editionName', v_edition.name,
    'editionStatus', v_edition.status,
    'launchId', v_launch_id,
    'attendance', v_rows,
    'summary', jsonb_build_object(
      'total', jsonb_array_length(v_rows),
      'attentionRequired', (SELECT count(*) FROM jsonb_array_elements(v_rows) item WHERE jsonb_array_length(coalesce(item->'issues','[]'::jsonb))>0),
      'attending', (SELECT count(*) FROM jsonb_array_elements(v_rows) item WHERE item->>'status'='attending'),
      'completed', (SELECT count(*) FROM jsonb_array_elements(v_rows) item WHERE item->>'status'='completed')
    )
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.admin_festival_attendee_diagnostics(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_festival_attendee_diagnostics(uuid) TO authenticated, service_role;

NOTIFY pgrst, 'reload schema';
