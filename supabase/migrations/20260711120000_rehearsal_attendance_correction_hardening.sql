-- Phase 4 PR 09: attendance correction verification and conflict-of-interest hardening.

ALTER TYPE public.social_action_audit_kind ADD VALUE IF NOT EXISTS 'rehearsal_attendance_finaliser_recorded';
ALTER TYPE public.social_action_audit_kind ADD VALUE IF NOT EXISTS 'rehearsal_attendance_correction_conflict_denied';
ALTER TYPE public.social_action_audit_kind ADD VALUE IF NOT EXISTS 'rehearsal_attendance_correction_sole_resolver_exception';
ALTER TYPE public.social_action_audit_kind ADD VALUE IF NOT EXISTS 'rehearsal_attendance_correction_legacy_finaliser';

ALTER TABLE public.band_rehearsal_participants
  ADD COLUMN IF NOT EXISTS finalised_by_profile_id uuid REFERENCES public.profiles(id) ON DELETE RESTRICT,
  ADD COLUMN IF NOT EXISTS finalised_at timestamptz;

CREATE INDEX IF NOT EXISTS band_rehearsal_participants_finaliser_idx
  ON public.band_rehearsal_participants(finalised_by_profile_id)
  WHERE finalised_by_profile_id IS NOT NULL;

ALTER TABLE public.rehearsal_attendance_correction_requests
  ADD COLUMN IF NOT EXISTS sole_resolver_exception boolean NOT NULL DEFAULT false;

CREATE OR REPLACE FUNCTION public.has_alternative_rehearsal_correction_resolver(
  p_band_id uuid,
  p_original_finaliser_profile_id uuid,
  p_affected_profile_id uuid DEFAULT NULL
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.band_members bm
    WHERE bm.band_id = p_band_id
      AND COALESCE(bm.member_status, 'active') = 'active'
      AND bm.profile_id IS NOT NULL
      AND bm.user_id IS NOT NULL
      AND lower(COALESCE(bm.role, '')) IN ('leader', 'founder', 'co-leader', 'manager')
      AND bm.profile_id <> p_original_finaliser_profile_id
      AND (p_affected_profile_id IS NULL OR bm.profile_id <> p_affected_profile_id)
  );
$$;

CREATE OR REPLACE FUNCTION public.get_rehearsal_attendance_correction_resolution_eligibility(correction_request_id uuid)
RETURNS TABLE (
  correction_request_id uuid,
  can_resolve boolean,
  is_original_finaliser boolean,
  alternative_resolver_exists boolean,
  sole_resolver_exception_available boolean,
  legacy_finaliser boolean,
  denial_reason text
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  actor_user_id uuid;
  actor_profile_id uuid;
  request_row public.rehearsal_attendance_correction_requests;
  participant_row public.band_rehearsal_participants;
  authorised boolean;
  admin_actor boolean;
  original_finaliser uuid;
  alt_exists boolean;
BEGIN
  actor_user_id := auth.uid();
  SELECT p.id INTO actor_profile_id FROM public.profiles p WHERE p.user_id = actor_user_id ORDER BY p.created_at ASC LIMIT 1;
  SELECT * INTO request_row FROM public.rehearsal_attendance_correction_requests r WHERE r.id = correction_request_id;
  IF request_row.id IS NULL THEN
    RETURN QUERY SELECT correction_request_id, false, false, false, false, false, 'missing_request'::text;
    RETURN;
  END IF;
  SELECT * INTO participant_row FROM public.band_rehearsal_participants brp WHERE brp.id = request_row.participant_id;
  authorised := public.is_band_leader_or_manager(request_row.band_id, actor_user_id) OR public.has_role(actor_user_id, 'admin'::public.app_role);
  admin_actor := public.has_role(actor_user_id, 'admin'::public.app_role);
  original_finaliser := participant_row.finalised_by_profile_id;
  alt_exists := CASE WHEN original_finaliser IS NULL THEN false ELSE public.has_alternative_rehearsal_correction_resolver(request_row.band_id, original_finaliser, request_row.requester_profile_id) END;

  RETURN QUERY SELECT
    request_row.id,
    authorised AND request_row.status = 'pending' AND (admin_actor OR original_finaliser IS NULL OR actor_profile_id IS DISTINCT FROM original_finaliser OR NOT alt_exists),
    actor_profile_id IS NOT NULL AND original_finaliser IS NOT NULL AND actor_profile_id = original_finaliser,
    alt_exists,
    authorised AND request_row.status = 'pending' AND original_finaliser IS NOT NULL AND actor_profile_id = original_finaliser AND NOT alt_exists,
    original_finaliser IS NULL,
    CASE
      WHEN NOT authorised THEN 'unauthorised'
      WHEN request_row.status <> 'pending' THEN 'final'
      WHEN NOT admin_actor AND original_finaliser IS NOT NULL AND actor_profile_id = original_finaliser AND alt_exists THEN 'original_finaliser_conflict'
      ELSE NULL
    END;
END;
$$;

CREATE OR REPLACE FUNCTION public.finalise_rehearsal_attendance(rehearsal_id uuid, attendance jsonb)
RETURNS TABLE (participant_id uuid, profile_id uuid, previous_status text, participation_status text, changed boolean)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE actor_user_id uuid; actor_profile_id uuid; rehearsal_row public.band_rehearsals; item_count integer; invalid_count integer; row_record record; notification_user_id uuid;
BEGIN
  actor_user_id := auth.uid();
  SELECT p.id INTO actor_profile_id FROM public.profiles p WHERE p.user_id = actor_user_id ORDER BY p.created_at ASC LIMIT 1;
  IF actor_profile_id IS NULL THEN RAISE EXCEPTION 'Sign in with an active player profile before finalising rehearsal attendance.' USING ERRCODE = '28000'; END IF;
  SELECT * INTO rehearsal_row FROM public.band_rehearsals br WHERE br.id = rehearsal_id FOR UPDATE;
  IF rehearsal_row.id IS NULL THEN RAISE EXCEPTION 'That rehearsal could not be found.' USING ERRCODE = '22023'; END IF;
  IF NOT public.is_band_leader_or_manager(rehearsal_row.band_id, actor_user_id) THEN RAISE EXCEPTION 'Only current authorised band managers can finalise rehearsal attendance.' USING ERRCODE = '42501'; END IF;
  IF COALESCE(rehearsal_row.status, '') = 'cancelled' THEN RAISE EXCEPTION 'Cancelled rehearsals cannot be finalised.' USING ERRCODE = '55000'; END IF;
  IF NOT public.is_rehearsal_attendance_finalisation_open(rehearsal_row.scheduled_start, rehearsal_row.scheduled_end, rehearsal_row.status) THEN RAISE EXCEPTION 'Attendance can be finalised after rehearsal end or once the rehearsal is completed.' USING ERRCODE = '55000'; END IF;
  IF attendance IS NULL OR jsonb_typeof(attendance) <> 'array' OR jsonb_array_length(attendance) = 0 THEN RAISE EXCEPTION 'Provide at least one attendance row to finalise.' USING ERRCODE = '22023'; END IF;
  DROP TABLE IF EXISTS tmp_rehearsal_attendance_finalise;
  CREATE TEMP TABLE tmp_rehearsal_attendance_finalise ON COMMIT DROP AS SELECT DISTINCT (value->>'participant_id')::uuid AS participant_id, lower(btrim(value->>'status')) AS new_status FROM jsonb_array_elements(attendance) value;
  SELECT count(*) INTO invalid_count FROM tmp_rehearsal_attendance_finalise WHERE participant_id IS NULL OR new_status NOT IN ('attended','missed');
  IF invalid_count > 0 THEN RAISE EXCEPTION 'Attendance rows must include existing participant IDs and attended or missed.' USING ERRCODE = '22023'; END IF;
  SELECT count(*) INTO item_count FROM tmp_rehearsal_attendance_finalise;
  PERFORM 1 FROM public.band_rehearsal_participants brp JOIN tmp_rehearsal_attendance_finalise t ON t.participant_id = brp.id WHERE brp.rehearsal_id = rehearsal_row.id FOR UPDATE OF brp;
  SELECT count(*) INTO invalid_count FROM tmp_rehearsal_attendance_finalise t LEFT JOIN public.band_rehearsal_participants brp ON brp.id=t.participant_id AND brp.rehearsal_id=rehearsal_row.id AND brp.band_id=rehearsal_row.band_id WHERE brp.id IS NULL;
  IF invalid_count > 0 THEN RAISE EXCEPTION 'Every attendance row must belong to this rehearsal.' USING ERRCODE = '22023'; END IF;
  SELECT count(*) INTO invalid_count FROM tmp_rehearsal_attendance_finalise t JOIN public.band_rehearsal_participants brp ON brp.id=t.participant_id WHERE brp.participation_status='declined' OR (brp.participation_status IN ('attended','missed') AND brp.participation_status <> t.new_status);
  IF invalid_count > 0 THEN RAISE EXCEPTION 'Declined and conflicting final attendance rows cannot be changed in this PR.' USING ERRCODE = '55000'; END IF;
  DROP TABLE IF EXISTS tmp_rehearsal_attendance_result;
  CREATE TEMP TABLE tmp_rehearsal_attendance_result ON COMMIT DROP AS SELECT brp.id AS participant_id, brp.profile_id, brp.participation_status AS previous_status, t.new_status, (brp.participation_status <> t.new_status) AS changed FROM public.band_rehearsal_participants brp JOIN tmp_rehearsal_attendance_finalise t ON t.participant_id=brp.id;
  UPDATE public.band_rehearsal_participants brp SET participation_status=r.new_status, attended_at=CASE WHEN r.new_status='attended' THEN COALESCE(brp.attended_at, now()) ELSE brp.attended_at END, finalised_by_profile_id=COALESCE(brp.finalised_by_profile_id, actor_profile_id), finalised_at=COALESCE(brp.finalised_at, now()), updated_at=now() FROM tmp_rehearsal_attendance_result r WHERE brp.id=r.participant_id AND r.changed;
  FOR row_record IN SELECT * FROM tmp_rehearsal_attendance_result LOOP
    IF row_record.changed THEN INSERT INTO public.social_action_audit_log(actor_profile_id,target_profile_id,action,target_type,target_id,metadata) VALUES (actor_profile_id,row_record.profile_id,'rehearsal_attendance_finaliser_recorded'::public.social_action_audit_kind,'band_rehearsal_participant',row_record.participant_id,jsonb_build_object('rehearsal_id',rehearsal_row.id,'band_id',rehearsal_row.band_id,'finalised_by_profile_id',actor_profile_id,'created_at',now())); END IF;
    IF row_record.new_status = 'attended' THEN PERFORM public.insert_band_contribution_event(rehearsal_row.band_id,row_record.profile_id,'rehearsal_attendance','band_rehearsal',rehearsal_row.id,COALESCE(rehearsal_row.completed_at,rehearsal_row.scheduled_end,now()),jsonb_build_object('label','Finalised rehearsal attendance','accuracy','verified_participant','verification_method','manager_attendance_finalisation','attendance_status','attended'));
    ELSE SELECT p.user_id INTO notification_user_id FROM public.profiles p WHERE p.id=row_record.profile_id; IF notification_user_id IS NOT NULL THEN INSERT INTO public.notifications(user_id,profile_id,category,type,title,message,action_path,metadata) SELECT notification_user_id,row_record.profile_id,'band','rehearsal_attendance_finalised','Rehearsal attendance finalised','You were marked missed for a rehearsal.','/rehearsals',jsonb_build_object('rehearsal_id',rehearsal_row.id,'participant_id',row_record.participant_id,'final_status','missed','band_id',rehearsal_row.band_id) WHERE NOT EXISTS (SELECT 1 FROM public.notifications n WHERE n.user_id=notification_user_id AND n.type='rehearsal_attendance_finalised' AND n.metadata->>'rehearsal_id'=rehearsal_row.id::text AND n.metadata->>'participant_id'=row_record.participant_id::text AND n.metadata->>'final_status'='missed'); END IF; END IF;
    INSERT INTO public.social_action_audit_log(actor_profile_id,target_profile_id,action,target_type,target_id,metadata) VALUES (actor_profile_id,row_record.profile_id,CASE WHEN row_record.new_status='attended' THEN 'rehearsal_attendance_marked_attended'::public.social_action_audit_kind ELSE 'rehearsal_attendance_marked_missed'::public.social_action_audit_kind END,'band_rehearsal_participant',row_record.participant_id,jsonb_build_object('rehearsal_id',rehearsal_row.id,'band_id',rehearsal_row.band_id,'previous_status',row_record.previous_status,'new_status',row_record.new_status,'changed',row_record.changed,'finalised_by_profile_id',actor_profile_id,'created_at',now()));
  END LOOP;
  INSERT INTO public.social_action_audit_log(actor_profile_id,action,target_type,target_id,metadata) VALUES (actor_profile_id,'rehearsal_attendance_finalised'::public.social_action_audit_kind,'band_rehearsal',rehearsal_row.id,jsonb_build_object('band_id',rehearsal_row.band_id,'row_count',item_count,'changed_count',(SELECT count(*) FROM tmp_rehearsal_attendance_result WHERE changed),'created_at',now()));
  RETURN QUERY SELECT r.participant_id,r.profile_id,r.previous_status,r.new_status,r.changed FROM tmp_rehearsal_attendance_result r ORDER BY r.participant_id;
END; $$;

CREATE OR REPLACE FUNCTION public.resolve_rehearsal_attendance_correction(correction_request_id uuid, decision text, resolution_note text DEFAULT NULL)
RETURNS public.rehearsal_attendance_correction_requests
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE actor_user_id uuid; actor_profile_id uuid; request_row public.rehearsal_attendance_correction_requests; participant_row public.band_rehearsal_participants; rehearsal_row public.band_rehearsals; normalized_decision text; cleaned_note text; requester_user_id uuid; event_id uuid; original_finaliser uuid; alt_exists boolean; admin_actor boolean; sole_exception boolean := false;
BEGIN
  actor_user_id := auth.uid();
  SELECT p.id INTO actor_profile_id FROM public.profiles p WHERE p.user_id = actor_user_id ORDER BY p.created_at ASC LIMIT 1;
  IF actor_profile_id IS NULL THEN RAISE EXCEPTION 'Sign in before resolving an attendance correction.' USING ERRCODE = '28000'; END IF;
  normalized_decision := lower(btrim(COALESCE(decision,''))); cleaned_note := public.safe_correction_text(resolution_note, 280);
  IF normalized_decision NOT IN ('approve','reject') THEN RAISE EXCEPTION 'Choose approve or reject.' USING ERRCODE = '22023'; END IF;
  SELECT * INTO request_row FROM public.rehearsal_attendance_correction_requests r WHERE r.id = correction_request_id FOR UPDATE;
  IF request_row.id IS NULL THEN RAISE EXCEPTION 'Correction request not found.' USING ERRCODE = '22023'; END IF;
  IF request_row.status <> 'pending' THEN RETURN request_row; END IF;
  SELECT * INTO participant_row FROM public.band_rehearsal_participants brp WHERE brp.id = request_row.participant_id FOR UPDATE;
  SELECT * INTO rehearsal_row FROM public.band_rehearsals br WHERE br.id = request_row.rehearsal_id FOR UPDATE;
  admin_actor := public.has_role(actor_user_id, 'admin'::public.app_role);
  IF NOT (public.is_band_leader_or_manager(request_row.band_id, actor_user_id) OR admin_actor) THEN
    INSERT INTO public.social_action_audit_log(actor_profile_id,target_profile_id,action,target_type,target_id,metadata) VALUES (actor_profile_id,request_row.requester_profile_id,'rehearsal_attendance_correction_denied'::public.social_action_audit_kind,'band_rehearsal_participant',request_row.participant_id,jsonb_build_object('reason','unauthorised_resolution','band_id',request_row.band_id,'rehearsal_id',request_row.rehearsal_id,'correction_request_id',request_row.id,'created_at',now()));
    RAISE EXCEPTION 'Only current authorised managers or support can resolve attendance corrections.' USING ERRCODE = '42501';
  END IF;
  original_finaliser := participant_row.finalised_by_profile_id;
  IF original_finaliser IS NULL THEN
    INSERT INTO public.social_action_audit_log(actor_profile_id,target_profile_id,action,target_type,target_id,metadata) VALUES (actor_profile_id,request_row.requester_profile_id,'rehearsal_attendance_correction_legacy_finaliser'::public.social_action_audit_kind,'band_rehearsal_participant',request_row.participant_id,jsonb_build_object('reason','legacy_null_finaliser','band_id',request_row.band_id,'rehearsal_id',request_row.rehearsal_id,'correction_request_id',request_row.id,'created_at',now()));
  ELSE
    alt_exists := public.has_alternative_rehearsal_correction_resolver(request_row.band_id, original_finaliser, request_row.requester_profile_id);
    IF NOT admin_actor AND actor_profile_id = original_finaliser AND alt_exists THEN
      INSERT INTO public.social_action_audit_log(actor_profile_id,target_profile_id,action,target_type,target_id,metadata) VALUES (actor_profile_id,request_row.requester_profile_id,'rehearsal_attendance_correction_conflict_denied'::public.social_action_audit_kind,'band_rehearsal_participant',request_row.participant_id,jsonb_build_object('reason','original_finaliser_conflict','band_id',request_row.band_id,'rehearsal_id',request_row.rehearsal_id,'correction_request_id',request_row.id,'alternative_resolver_exists',true,'created_at',now()));
      RAISE EXCEPTION 'Another authorised manager must resolve this request.' USING ERRCODE = '42501';
    ELSIF actor_profile_id = original_finaliser AND NOT alt_exists THEN
      sole_exception := true;
      INSERT INTO public.social_action_audit_log(actor_profile_id,target_profile_id,action,target_type,target_id,metadata) VALUES (actor_profile_id,request_row.requester_profile_id,'rehearsal_attendance_correction_sole_resolver_exception'::public.social_action_audit_kind,'band_rehearsal_participant',request_row.participant_id,jsonb_build_object('band_id',request_row.band_id,'rehearsal_id',request_row.rehearsal_id,'correction_request_id',request_row.id,'decision',normalized_decision,'created_at',now()));
    END IF;
  END IF;
  IF participant_row.participation_status <> request_row.current_status THEN RAISE EXCEPTION 'Attendance changed since this correction was requested.' USING ERRCODE = '40001'; END IF;
  UPDATE public.rehearsal_attendance_correction_requests SET status=CASE WHEN normalized_decision='approve' THEN 'approved' ELSE 'rejected' END,resolved_at=now(),resolved_by_profile_id=actor_profile_id,resolution_note=cleaned_note,sole_resolver_exception=sole_exception WHERE id=request_row.id AND status='pending' RETURNING * INTO request_row;
  IF normalized_decision='approve' THEN
    UPDATE public.band_rehearsal_participants SET participation_status=request_row.requested_status, attended_at=CASE WHEN request_row.requested_status='attended' THEN COALESCE(attended_at,now()) ELSE attended_at END, updated_at=now() WHERE id=request_row.participant_id;
    IF request_row.requested_status='attended' THEN event_id := public.insert_band_contribution_event(request_row.band_id,request_row.requester_profile_id,'rehearsal_attendance','band_rehearsal',request_row.rehearsal_id,COALESCE(rehearsal_row.completed_at,rehearsal_row.scheduled_end,now()),jsonb_build_object('label','Corrected rehearsal attendance','accuracy','corrected_participant','correction_request_id',request_row.id));
    ELSE UPDATE public.band_contribution_events SET voided_at=COALESCE(voided_at,now()), voided_by_profile_id=actor_profile_id, voided_by_correction_request_id=request_row.id WHERE band_id=request_row.band_id AND profile_id=request_row.requester_profile_id AND contribution_type='rehearsal_attendance' AND source_entity_type='band_rehearsal' AND source_entity_id=request_row.rehearsal_id AND voided_at IS NULL RETURNING id INTO event_id; END IF;
    INSERT INTO public.social_action_audit_log(actor_profile_id,target_profile_id,action,target_type,target_id,metadata) VALUES (actor_profile_id,request_row.requester_profile_id,'rehearsal_attendance_corrected'::public.social_action_audit_kind,'band_rehearsal_participant',request_row.participant_id,jsonb_build_object('band_id',request_row.band_id,'rehearsal_id',request_row.rehearsal_id,'correction_request_id',request_row.id,'previous_status',request_row.current_status,'resulting_status',request_row.requested_status,'contribution_event_id',event_id,'created_at',now()));
  END IF;
  INSERT INTO public.social_action_audit_log(actor_profile_id,target_profile_id,action,target_type,target_id,metadata) VALUES (actor_profile_id,request_row.requester_profile_id,CASE WHEN normalized_decision='approve' THEN 'rehearsal_attendance_correction_approved'::public.social_action_audit_kind ELSE 'rehearsal_attendance_correction_rejected'::public.social_action_audit_kind END,'band_rehearsal_participant',request_row.participant_id,jsonb_build_object('band_id',request_row.band_id,'rehearsal_id',request_row.rehearsal_id,'correction_request_id',request_row.id,'previous_status',request_row.current_status,'requested_status',request_row.requested_status,'decision',normalized_decision,'resulting_status',CASE WHEN normalized_decision='approve' THEN request_row.requested_status ELSE request_row.current_status END,'sole_resolver_exception',sole_exception,'created_at',now()));
  SELECT p.user_id INTO requester_user_id FROM public.profiles p WHERE p.id=request_row.requester_profile_id;
  IF requester_user_id IS NOT NULL THEN INSERT INTO public.notifications(user_id,profile_id,category,type,title,message,action_path,metadata) SELECT requester_user_id,request_row.requester_profile_id,'band','rehearsal_attendance_correction_resolved','Attendance correction resolved',CASE WHEN normalized_decision='approve' THEN 'Your rehearsal attendance correction was approved.' ELSE 'Your rehearsal attendance correction was rejected.' END,'/rehearsals',jsonb_build_object('rehearsal_id',request_row.rehearsal_id,'participant_id',request_row.participant_id,'correction_request_id',request_row.id,'decision',normalized_decision,'band_id',request_row.band_id) WHERE NOT EXISTS (SELECT 1 FROM public.notifications n WHERE n.user_id=requester_user_id AND n.type='rehearsal_attendance_correction_resolved' AND n.metadata->>'correction_request_id'=request_row.id::text); END IF;
  IF normalized_decision='approve' AND event_id IS NOT NULL THEN INSERT INTO public.social_action_audit_log(actor_profile_id,target_profile_id,action,target_type,target_id,metadata) VALUES (actor_profile_id,request_row.requester_profile_id,'band_contribution_correction_created'::public.social_action_audit_kind,'band_rehearsal_participant',request_row.participant_id,jsonb_build_object('band_id',request_row.band_id,'rehearsal_id',request_row.rehearsal_id,'correction_request_id',request_row.id,'contribution_event_id',event_id,'created_at',now())); END IF;
  RETURN request_row;
END; $$;

REVOKE ALL ON FUNCTION public.has_alternative_rehearsal_correction_resolver(uuid, uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_rehearsal_attendance_correction_resolution_eligibility(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.has_alternative_rehearsal_correction_resolver(uuid, uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_rehearsal_attendance_correction_resolution_eligibility(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.get_rehearsal_attendance_correction_resolution_eligibilities(p_rehearsal_id uuid)
RETURNS TABLE (
  correction_request_id uuid,
  can_resolve boolean,
  is_original_finaliser boolean,
  alternative_resolver_exists boolean,
  sole_resolver_exception_available boolean,
  legacy_finaliser boolean,
  denial_reason text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT e.*
  FROM public.rehearsal_attendance_correction_requests r
  CROSS JOIN LATERAL public.get_rehearsal_attendance_correction_resolution_eligibility(r.id) e
  WHERE r.rehearsal_id = p_rehearsal_id
    AND r.status = 'pending'
    AND public.can_read_rehearsal_attendance_correction(r.band_id, r.requester_profile_id, auth.uid());
$$;

REVOKE ALL ON FUNCTION public.get_rehearsal_attendance_correction_resolution_eligibilities(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_rehearsal_attendance_correction_resolution_eligibilities(uuid) TO authenticated;
