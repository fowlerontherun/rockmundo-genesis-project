-- Admin-only diagnostics and one-way, evidence-backed recovery for the modern
-- Festival attendee/ticket lifecycle.

CREATE TABLE IF NOT EXISTS public.festival_attendee_repair_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  festival_edition_id uuid NOT NULL REFERENCES public.festival_editions_v2(id) ON DELETE RESTRICT,
  attendance_id uuid NOT NULL REFERENCES public.festival_player_attendance(id) ON DELETE RESTRICT,
  actor_user_id uuid NOT NULL,
  actor_profile_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  repair_code text NOT NULL CHECK (repair_code IN (
    'sync_lifecycle','complete_expired','repair_attending_evidence','close_terminal_schedule'
  )),
  reason text NOT NULL CHECK (length(btrim(reason)) BETWEEN 8 AND 500),
  idempotency_key uuid NOT NULL,
  expected_lifecycle_version bigint NOT NULL,
  before_snapshot jsonb NOT NULL CHECK (jsonb_typeof(before_snapshot)='object'),
  after_snapshot jsonb NOT NULL CHECK (jsonb_typeof(after_snapshot)='object'),
  result jsonb NOT NULL CHECK (jsonb_typeof(result)='object'),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(actor_user_id,idempotency_key)
);
CREATE INDEX IF NOT EXISTS festival_attendee_repair_audit_edition_created_idx
  ON public.festival_attendee_repair_audit(festival_edition_id,created_at DESC);
CREATE INDEX IF NOT EXISTS festival_attendee_repair_audit_attendance_created_idx
  ON public.festival_attendee_repair_audit(attendance_id,created_at DESC);
ALTER TABLE public.festival_attendee_repair_audit ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.festival_attendee_repair_audit FROM PUBLIC,anon,authenticated;
GRANT ALL ON public.festival_attendee_repair_audit TO service_role;

CREATE OR REPLACE FUNCTION public._festival_attendee_admin_diagnostic_row(p_attendance_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE
  a public.festival_player_attendance%ROWTYPE;
  t public.festival_issued_tickets%ROWTYPE;
  e public.festival_editions_v2%ROWTYPE;
  v_end_at timestamptz;
  v_wristbands integer:=0;
  v_active_locks integer:=0;
  v_event_version bigint;
  v_issues jsonb:='[]'::jsonb;
  v_repair text;
BEGIN
  SELECT * INTO a FROM public.festival_player_attendance WHERE id=p_attendance_id;
  IF NOT FOUND THEN RETURN NULL; END IF;
  SELECT * INTO t FROM public.festival_issued_tickets WHERE id=a.admission_ticket_id;
  SELECT * INTO e FROM public.festival_editions_v2 WHERE id=a.festival_edition_id;
  IF e.ends_on IS NOT NULL THEN
    SELECT ((e.ends_on+1)::timestamp AT TIME ZONE coalesce(nullif(c.timezone,''),'UTC'))
      INTO v_end_at FROM public.cities c WHERE c.id=e.city_id;
    v_end_at:=coalesce(v_end_at,(e.ends_on+1)::timestamp AT TIME ZONE 'UTC');
  END IF;
  SELECT count(*) INTO v_wristbands FROM public.festival_player_memorabilia m
    WHERE m.attendance_id=a.id AND m.item_type='wristband';
  SELECT count(*) INTO v_active_locks FROM public.player_scheduled_activities s
    WHERE s.activity_type='festival_attendance' AND s.status IN('scheduled','in_progress')
      AND (s.id=a.schedule_activity_id OR s.metadata->>'festival_attendance_id'=a.id::text);
  SELECT max(x.lifecycle_version) INTO v_event_version
    FROM public.festival_player_attendance_events x WHERE x.attendance_id=a.id;

  IF t.id IS NULL THEN v_issues:=v_issues||jsonb_build_array(jsonb_build_object('code','attendance_ticket_missing','severity','blocked')); END IF;
  IF t.id IS NOT NULL AND (t.holder_profile_id IS DISTINCT FROM a.profile_id OR t.festival_launch_id IS DISTINCT FROM a.festival_launch_id) THEN
    v_issues:=v_issues||jsonb_build_array(jsonb_build_object('code','ticket_attendance_mismatch','severity','blocked'));
  END IF;
  IF t.status IN('refunded','cancelled','transferred') AND a.status IN('ticketed','ready_to_check_in','attending') THEN
    v_issues:=v_issues||jsonb_build_array(jsonb_build_object('code','inactive_ticket_active_attendance','severity','repairable'));
    v_repair:='sync_lifecycle';
  END IF;
  IF a.status='attending' AND a.checked_in_at IS NOT NULL AND t.status='valid' THEN
    v_issues:=v_issues||jsonb_build_array(jsonb_build_object('code','attending_ticket_not_used','severity','repairable'));
    v_repair:='repair_attending_evidence';
  END IF;
  IF t.status='used' AND (a.checked_in_at IS NULL OR a.status IN('ticketed','ready_to_check_in')) THEN
    v_issues:=v_issues||jsonb_build_array(jsonb_build_object('code','ticket_used_without_check_in','severity','blocked'));
  END IF;
  IF a.status IN('attending','left_early','completed') AND a.checked_in_at IS NOT NULL AND v_wristbands=0 THEN
    v_issues:=v_issues||jsonb_build_array(jsonb_build_object('code','checked_in_without_wristband','severity','repairable'));
    v_repair:=CASE WHEN a.status='attending' THEN 'repair_attending_evidence' ELSE NULL END;
  ELSIF v_wristbands>1 THEN
    v_issues:=v_issues||jsonb_build_array(jsonb_build_object('code','duplicate_wristbands','severity','blocked'));
  END IF;
  IF a.status='attending' AND v_active_locks=0 THEN
    v_issues:=v_issues||jsonb_build_array(jsonb_build_object('code','active_schedule_lock_missing','severity','repairable'));
    v_repair:='repair_attending_evidence';
  ELSIF a.status='attending' AND v_active_locks>1 THEN
    v_issues:=v_issues||jsonb_build_array(jsonb_build_object('code','duplicate_active_schedule_locks','severity','repairable'));
    v_repair:='repair_attending_evidence';
  ELSIF a.status IN('left_early','completed','cancelled','refunded') AND v_active_locks>0 THEN
    v_issues:=v_issues||jsonb_build_array(jsonb_build_object('code','terminal_schedule_lock_open','severity','repairable'));
    v_repair:='close_terminal_schedule';
  END IF;
  IF a.status='attending' AND v_end_at IS NOT NULL AND now()>=v_end_at THEN
    v_issues:=v_issues||jsonb_build_array(jsonb_build_object('code','expired_attendance_still_active','severity','repairable'));
    v_repair:='complete_expired';
  END IF;
  IF (a.status='attending' AND a.checked_in_at IS NULL)
     OR (a.status='completed' AND a.completed_at IS NULL)
     OR (a.status='left_early' AND a.left_at IS NULL) THEN
    v_issues:=v_issues||jsonb_build_array(jsonb_build_object('code','terminal_timestamp_inconsistent','severity','blocked'));
  END IF;
  IF v_event_version IS DISTINCT FROM a.lifecycle_version THEN
    v_issues:=v_issues||jsonb_build_array(jsonb_build_object('code','lifecycle_event_gap','severity','blocked'));
  END IF;

  RETURN jsonb_build_object(
    'attendanceId',a.id,'editionId',a.festival_edition_id,'profileId',a.profile_id,
    'ticketId',a.admission_ticket_id,'ticketReference',t.ticket_reference,
    'attendanceStatus',a.status,'ticketStatus',t.status,'lifecycleVersion',a.lifecycle_version,
    'checkedInAt',a.checked_in_at,'leftAt',a.left_at,'completedAt',a.completed_at,
    'wristbandCount',v_wristbands,'activeScheduleLocks',v_active_locks,
    'lastTransition',jsonb_build_object('source',a.last_transition_source,'reason',a.last_transition_reason,'at',a.last_transition_at),
    'issues',v_issues,'health',CASE WHEN jsonb_array_length(v_issues)=0 THEN 'healthy'
      WHEN EXISTS(SELECT 1 FROM jsonb_array_elements(v_issues) q WHERE q->>'severity'='blocked') THEN 'blocked' ELSE 'repairable' END,
    'recommendedRepair',v_repair
  );
END $$;
REVOKE ALL ON FUNCTION public._festival_attendee_admin_diagnostic_row(uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public._festival_attendee_admin_diagnostic_row(uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.admin_get_festival_attendee_diagnostics(p_edition_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE v_rows jsonb; v_orphans jsonb; v_result jsonb;
BEGIN
  IF auth.uid() IS NULL OR NOT coalesce(public.has_role(auth.uid(),'admin'::public.app_role),false) THEN
    RAISE EXCEPTION 'FESTIVAL_ATTENDEE_DIAGNOSTICS_FORBIDDEN' USING ERRCODE='42501';
  END IF;
  IF NOT EXISTS(SELECT 1 FROM public.festival_editions_v2 WHERE id=p_edition_id) THEN
    RAISE EXCEPTION 'FESTIVAL_EDITION_NOT_FOUND' USING ERRCODE='P0002';
  END IF;
  SELECT coalesce(jsonb_agg(public._festival_attendee_admin_diagnostic_row(a.id) ORDER BY a.created_at,a.id),'[]'::jsonb)
    INTO v_rows FROM public.festival_player_attendance a WHERE a.festival_edition_id=p_edition_id;
  SELECT coalesce(jsonb_agg(jsonb_build_object('ticketId',t.id,'ticketReference',t.ticket_reference,
      'ticketStatus',t.status,'issue','ticket_attendance_missing','health','blocked') ORDER BY t.issued_at,t.id),'[]'::jsonb)
    INTO v_orphans
  FROM public.festival_issued_tickets t
  JOIN public.festival_ticket_products p ON p.id=t.festival_ticket_product_id
  JOIN public.festival_ticket_plans plan ON plan.id=p.festival_ticket_plan_id
  LEFT JOIN public.festival_player_attendance a ON a.admission_ticket_id=t.id
  WHERE plan.festival_edition_id=p_edition_id AND p.product_class='admission' AND a.id IS NULL;
  SELECT jsonb_build_object(
    'editionId',p_edition_id,'generatedAt',now(),'rows',v_rows,'orphanTickets',v_orphans,
    'summary',jsonb_build_object(
      'total',jsonb_array_length(v_rows),'healthy',(SELECT count(*) FROM jsonb_array_elements(v_rows) r WHERE r->>'health'='healthy'),
      'repairable',(SELECT count(*) FROM jsonb_array_elements(v_rows) r WHERE r->>'health'='repairable'),
      'blocked',(SELECT count(*) FROM jsonb_array_elements(v_rows) r WHERE r->>'health'='blocked')+jsonb_array_length(v_orphans)
    )) INTO v_result;
  RETURN v_result;
END $$;
REVOKE ALL ON FUNCTION public.admin_get_festival_attendee_diagnostics(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.admin_get_festival_attendee_diagnostics(uuid) TO authenticated,service_role;

CREATE OR REPLACE FUNCTION public.admin_repair_festival_attendee(
  p_attendance_id uuid,p_expected_lifecycle_version bigint,p_repair_code text,
  p_reason text,p_idempotency_key uuid,p_apply boolean DEFAULT false
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE a public.festival_player_attendance%ROWTYPE; v_before jsonb; v_after jsonb; v_result jsonb; v_existing jsonb;
BEGIN
  IF auth.uid() IS NULL OR NOT coalesce(public.has_role(auth.uid(),'admin'::public.app_role),false) THEN
    RAISE EXCEPTION 'FESTIVAL_ATTENDEE_REPAIR_FORBIDDEN' USING ERRCODE='42501';
  END IF;
  IF p_repair_code NOT IN('sync_lifecycle','complete_expired','repair_attending_evidence','close_terminal_schedule') THEN
    RAISE EXCEPTION 'FESTIVAL_ATTENDEE_REPAIR_NOT_ALLOWED' USING ERRCODE='22023';
  END IF;
  IF p_apply AND length(btrim(coalesce(p_reason,'')))<8 THEN
    RAISE EXCEPTION 'FESTIVAL_ATTENDEE_REPAIR_REASON_REQUIRED' USING ERRCODE='22023';
  END IF;
  IF p_apply THEN
    SELECT result INTO v_existing FROM public.festival_attendee_repair_audit
      WHERE actor_user_id=auth.uid() AND idempotency_key=p_idempotency_key;
    IF FOUND THEN RETURN v_existing||jsonb_build_object('idempotentReplay',true); END IF;
  END IF;
  SELECT * INTO a FROM public.festival_player_attendance WHERE id=p_attendance_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'FESTIVAL_ATTENDANCE_NOT_FOUND' USING ERRCODE='P0002'; END IF;
  IF a.lifecycle_version<>p_expected_lifecycle_version THEN
    RAISE EXCEPTION 'FESTIVAL_ATTENDEE_REPAIR_STALE' USING ERRCODE='40001';
  END IF;
  v_before:=public._festival_attendee_admin_diagnostic_row(a.id);
  IF NOT EXISTS(SELECT 1 FROM jsonb_array_elements(v_before->'issues') i WHERE i->>'severity'='repairable') THEN
    RAISE EXCEPTION 'FESTIVAL_ATTENDEE_REPAIR_NO_SAFE_ACTION' USING ERRCODE='P0001';
  END IF;
  IF v_before->>'recommendedRepair' IS DISTINCT FROM p_repair_code THEN
    RAISE EXCEPTION 'FESTIVAL_ATTENDEE_REPAIR_ACTION_MISMATCH' USING ERRCODE='22023';
  END IF;
  IF NOT p_apply THEN RETURN jsonb_build_object('preview',true,'repairCode',p_repair_code,'before',v_before); END IF;

  IF p_repair_code='sync_lifecycle' THEN
    v_result:=jsonb_build_object('lifecycle',public._festival_sync_attendance_lifecycle(a.id));
  ELSIF p_repair_code='complete_expired' THEN
    v_result:=jsonb_build_object('completion',public._festival_complete_attendance_if_expired(a.id));
  ELSIF p_repair_code='repair_attending_evidence' THEN
    IF a.status<>'attending' OR a.checked_in_at IS NULL THEN RAISE EXCEPTION 'FESTIVAL_ATTENDEE_REPAIR_EVIDENCE_REQUIRED'; END IF;
    v_result:=jsonb_build_object('ticket',public._festival_repair_attendance_ticket_used(a.id),
      'wristband',public._festival_ensure_attendance_wristband(a.id),'schedule',public._festival_repair_attendance_schedule_lock(a.id));
  ELSE
    IF a.status NOT IN('left_early','completed','cancelled','refunded') THEN RAISE EXCEPTION 'FESTIVAL_ATTENDEE_REPAIR_TERMINAL_REQUIRED'; END IF;
    UPDATE public.player_scheduled_activities SET status=CASE WHEN a.status='completed' THEN 'completed' ELSE 'cancelled' END,
      completed_at=CASE WHEN a.status='completed' THEN coalesce(completed_at,a.completed_at,now()) ELSE completed_at END,
      metadata=coalesce(metadata,'{}'::jsonb)||jsonb_build_object('festival_admin_recovery',true,'festival_admin_recovery_at',now()),updated_at=now()
    WHERE activity_type='festival_attendance' AND status IN('scheduled','in_progress')
      AND (id=a.schedule_activity_id OR metadata->>'festival_attendance_id'=a.id::text);
    v_result:=jsonb_build_object('closedScheduleLocks',true);
  END IF;
  v_after:=public._festival_attendee_admin_diagnostic_row(a.id);
  v_result:=v_result||jsonb_build_object('attendanceId',a.id,'repairCode',p_repair_code,'applied',true,'after',v_after);
  INSERT INTO public.festival_attendee_repair_audit(festival_edition_id,attendance_id,actor_user_id,actor_profile_id,
    repair_code,reason,idempotency_key,expected_lifecycle_version,before_snapshot,after_snapshot,result)
  VALUES(a.festival_edition_id,a.id,auth.uid(),public.current_profile_id(),p_repair_code,btrim(p_reason),p_idempotency_key,
    p_expected_lifecycle_version,v_before,v_after,v_result);
  RETURN v_result;
END $$;
REVOKE ALL ON FUNCTION public.admin_repair_festival_attendee(uuid,bigint,text,text,uuid,boolean) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.admin_repair_festival_attendee(uuid,bigint,text,text,uuid,boolean) TO authenticated,service_role;

COMMENT ON TABLE public.festival_attendee_repair_audit IS 'Immutable evidence for admin-initiated Festival attendee repairs.';
COMMENT ON FUNCTION public.admin_get_festival_attendee_diagnostics(uuid) IS 'Admin-only edition health projection for attendee, ticket, wristband and schedule state.';
COMMENT ON FUNCTION public.admin_repair_festival_attendee(uuid,bigint,text,text,uuid,boolean) IS 'Previews or applies an allowlisted, one-way attendee repair with optimistic concurrency and audit evidence.';
NOTIFY pgrst,'reload schema';
