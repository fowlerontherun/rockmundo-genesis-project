-- Phase 4 PR 08: rehearsal attendance correction request MVP.

ALTER TYPE public.social_action_audit_kind ADD VALUE IF NOT EXISTS 'rehearsal_attendance_correction_requested';
ALTER TYPE public.social_action_audit_kind ADD VALUE IF NOT EXISTS 'rehearsal_attendance_correction_approved';
ALTER TYPE public.social_action_audit_kind ADD VALUE IF NOT EXISTS 'rehearsal_attendance_correction_rejected';
ALTER TYPE public.social_action_audit_kind ADD VALUE IF NOT EXISTS 'rehearsal_attendance_corrected';
ALTER TYPE public.social_action_audit_kind ADD VALUE IF NOT EXISTS 'rehearsal_attendance_correction_denied';
ALTER TYPE public.social_action_audit_kind ADD VALUE IF NOT EXISTS 'band_contribution_correction_created';

CREATE TABLE IF NOT EXISTS public.rehearsal_attendance_correction_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rehearsal_id uuid NOT NULL REFERENCES public.band_rehearsals(id) ON DELETE CASCADE,
  participant_id uuid NOT NULL REFERENCES public.band_rehearsal_participants(id) ON DELETE CASCADE,
  band_id uuid NOT NULL REFERENCES public.bands(id) ON DELETE CASCADE,
  requester_profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  current_status text NOT NULL CHECK (current_status IN ('attended', 'missed')),
  requested_status text NOT NULL CHECK (requested_status IN ('attended', 'missed')),
  request_reason text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'cancelled')),
  created_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz,
  resolved_by_profile_id uuid REFERENCES public.profiles(id) ON DELETE RESTRICT,
  resolution_note text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  CONSTRAINT rehearsal_attendance_correction_status_change CHECK (current_status <> requested_status),
  CONSTRAINT rehearsal_attendance_correction_metadata_object CHECK (jsonb_typeof(metadata) = 'object')
);

CREATE UNIQUE INDEX IF NOT EXISTS rehearsal_attendance_correction_one_pending_idx
  ON public.rehearsal_attendance_correction_requests(participant_id)
  WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS rehearsal_attendance_correction_rehearsal_idx
  ON public.rehearsal_attendance_correction_requests(rehearsal_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS rehearsal_attendance_correction_band_idx
  ON public.rehearsal_attendance_correction_requests(band_id, status, created_at DESC);

ALTER TABLE public.rehearsal_attendance_correction_requests ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.rehearsal_attendance_correction_window()
RETURNS interval LANGUAGE sql IMMUTABLE SET search_path = public AS $$ SELECT interval '24 hours'; $$;

CREATE OR REPLACE FUNCTION public.rehearsal_attendance_correction_deadline(p_completed_at timestamptz, p_scheduled_end timestamptz)
RETURNS timestamptz LANGUAGE sql IMMUTABLE SET search_path = public AS $$
  SELECT COALESCE(p_completed_at, p_scheduled_end) + public.rehearsal_attendance_correction_window();
$$;

CREATE OR REPLACE FUNCTION public.is_rehearsal_attendance_correction_open(p_completed_at timestamptz, p_scheduled_end timestamptz)
RETURNS boolean LANGUAGE sql STABLE SET search_path = public AS $$
  SELECT COALESCE(p_completed_at, p_scheduled_end) IS NOT NULL
    AND now() <= public.rehearsal_attendance_correction_deadline(p_completed_at, p_scheduled_end);
$$;

CREATE OR REPLACE FUNCTION public.can_read_rehearsal_attendance_correction(p_band_id uuid, p_requester_profile_id uuid, p_actor_user_id uuid DEFAULT auth.uid())
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT p_actor_user_id IS NOT NULL AND (
    EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = p_requester_profile_id AND p.user_id = p_actor_user_id)
    OR public.is_band_leader_or_manager(p_band_id, p_actor_user_id)
    OR public.has_role(p_actor_user_id, 'admin'::public.app_role)
  );
$$;

CREATE POLICY "Requester and authorised resolvers can view rehearsal corrections"
ON public.rehearsal_attendance_correction_requests FOR SELECT TO authenticated
USING (public.can_read_rehearsal_attendance_correction(band_id, requester_profile_id, auth.uid()));

CREATE OR REPLACE FUNCTION public.safe_correction_text(p_text text, p_max integer)
RETURNS text LANGUAGE plpgsql IMMUTABLE SET search_path = public AS $$
DECLARE v text;
BEGIN
  v := nullif(btrim(COALESCE(p_text, '')), '');
  IF v IS NULL THEN RETURN NULL; END IF;
  IF length(v) > p_max OR v ~ '[<>]' THEN
    RAISE EXCEPTION 'Correction notes must be plain text under % characters.', p_max USING ERRCODE = '22023';
  END IF;
  RETURN v;
END;
$$;

ALTER TABLE public.band_contribution_events
  ADD COLUMN IF NOT EXISTS voided_at timestamptz,
  ADD COLUMN IF NOT EXISTS voided_by_profile_id uuid REFERENCES public.profiles(id) ON DELETE RESTRICT,
  ADD COLUMN IF NOT EXISTS voided_by_correction_request_id uuid REFERENCES public.rehearsal_attendance_correction_requests(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS band_contribution_events_effective_idx
  ON public.band_contribution_events(band_id, profile_id, contribution_type, source_entity_type, source_entity_id)
  WHERE voided_at IS NULL;

CREATE OR REPLACE FUNCTION public.request_rehearsal_attendance_correction(participant_id uuid, requested_status text, reason text DEFAULT NULL)
RETURNS public.rehearsal_attendance_correction_requests
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE actor_user_id uuid; actor_profile_id uuid; participant_row public.band_rehearsal_participants; rehearsal_row public.band_rehearsals; normalized_status text; cleaned_reason text; request_row public.rehearsal_attendance_correction_requests; manager_record record;
BEGIN
  actor_user_id := auth.uid();
  SELECT p.id INTO actor_profile_id FROM public.profiles p WHERE p.user_id = actor_user_id ORDER BY p.created_at ASC LIMIT 1;
  IF actor_profile_id IS NULL THEN RAISE EXCEPTION 'Sign in before requesting an attendance correction.' USING ERRCODE = '28000'; END IF;
  normalized_status := lower(btrim(COALESCE(requested_status, '')));
  cleaned_reason := public.safe_correction_text(reason, 280);

  SELECT * INTO participant_row FROM public.band_rehearsal_participants brp WHERE brp.id = participant_id FOR UPDATE;
  IF participant_row.id IS NULL THEN RAISE EXCEPTION 'That attendance row could not be found.' USING ERRCODE = '22023'; END IF;
  SELECT * INTO rehearsal_row FROM public.band_rehearsals br WHERE br.id = participant_row.rehearsal_id FOR UPDATE;

  IF participant_row.profile_id <> actor_profile_id THEN
    INSERT INTO public.social_action_audit_log(actor_profile_id,target_profile_id,action,target_type,target_id,metadata) VALUES (actor_profile_id, participant_row.profile_id, 'rehearsal_attendance_correction_denied'::public.social_action_audit_kind, 'band_rehearsal_participant', participant_row.id, jsonb_build_object('reason','not_own_participant','rehearsal_id',participant_row.rehearsal_id,'created_at',now()));
    RAISE EXCEPTION 'You can only request correction for your own attendance.' USING ERRCODE = '42501';
  END IF;
  IF participant_row.participation_status NOT IN ('attended','missed') OR normalized_status NOT IN ('attended','missed') OR participant_row.participation_status = normalized_status THEN
    RAISE EXCEPTION 'Corrections only switch final attended and missed statuses.' USING ERRCODE = '22023';
  END IF;
  IF NOT public.is_rehearsal_attendance_correction_open(rehearsal_row.completed_at, rehearsal_row.scheduled_end) THEN
    INSERT INTO public.social_action_audit_log(actor_profile_id,action,target_type,target_id,metadata) VALUES (actor_profile_id,'rehearsal_attendance_correction_denied'::public.social_action_audit_kind,'band_rehearsal_participant',participant_row.id,jsonb_build_object('reason','late_request','band_id',participant_row.band_id,'rehearsal_id',participant_row.rehearsal_id,'deadline',public.rehearsal_attendance_correction_deadline(rehearsal_row.completed_at,rehearsal_row.scheduled_end),'created_at',now()));
    RAISE EXCEPTION 'The attendance correction window has closed.' USING ERRCODE = '55000';
  END IF;

  INSERT INTO public.rehearsal_attendance_correction_requests(rehearsal_id, participant_id, band_id, requester_profile_id, current_status, requested_status, request_reason, metadata)
  VALUES (participant_row.rehearsal_id, participant_row.id, participant_row.band_id, actor_profile_id, participant_row.participation_status, normalized_status, cleaned_reason, jsonb_build_object('deadline', public.rehearsal_attendance_correction_deadline(rehearsal_row.completed_at,rehearsal_row.scheduled_end)))
  ON CONFLICT (participant_id) WHERE status = 'pending' DO UPDATE SET metadata = public.rehearsal_attendance_correction_requests.metadata || jsonb_build_object('duplicate_request_at', now())
  RETURNING * INTO request_row;

  INSERT INTO public.social_action_audit_log(actor_profile_id,target_profile_id,action,target_type,target_id,metadata)
  VALUES (actor_profile_id, actor_profile_id, 'rehearsal_attendance_correction_requested'::public.social_action_audit_kind, 'band_rehearsal_participant', participant_row.id, jsonb_build_object('band_id',participant_row.band_id,'rehearsal_id',participant_row.rehearsal_id,'correction_request_id',request_row.id,'previous_status',participant_row.participation_status,'requested_status',normalized_status,'created_at',now()));

  FOR manager_record IN SELECT DISTINCT bm.user_id, bm.profile_id FROM public.band_members bm WHERE bm.band_id = participant_row.band_id AND COALESCE(bm.member_status,'active')='active' AND bm.user_id IS NOT NULL AND bm.profile_id IS NOT NULL AND lower(COALESCE(bm.role,'')) IN ('leader','founder','co-leader','manager') LOOP
    INSERT INTO public.notifications(user_id, profile_id, category, type, title, message, action_path, metadata)
    SELECT manager_record.user_id, manager_record.profile_id, 'band', 'rehearsal_attendance_correction_requested', 'Attendance correction requested', 'A rehearsal attendance correction needs review.', '/rehearsals', jsonb_build_object('rehearsal_id',participant_row.rehearsal_id,'participant_id',participant_row.id,'correction_request_id',request_row.id,'band_id',participant_row.band_id)
    WHERE NOT EXISTS (SELECT 1 FROM public.notifications n WHERE n.user_id = manager_record.user_id AND n.type = 'rehearsal_attendance_correction_requested' AND n.metadata->>'correction_request_id' = request_row.id::text);
  END LOOP;
  RETURN request_row;
END; $$;

CREATE OR REPLACE FUNCTION public.resolve_rehearsal_attendance_correction(correction_request_id uuid, decision text, resolution_note text DEFAULT NULL)
RETURNS public.rehearsal_attendance_correction_requests
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE actor_user_id uuid; actor_profile_id uuid; request_row public.rehearsal_attendance_correction_requests; participant_row public.band_rehearsal_participants; rehearsal_row public.band_rehearsals; normalized_decision text; cleaned_note text; requester_user_id uuid; event_id uuid;
BEGIN
  actor_user_id := auth.uid();
  SELECT p.id INTO actor_profile_id FROM public.profiles p WHERE p.user_id = actor_user_id ORDER BY p.created_at ASC LIMIT 1;
  IF actor_profile_id IS NULL THEN RAISE EXCEPTION 'Sign in before resolving an attendance correction.' USING ERRCODE = '28000'; END IF;
  normalized_decision := lower(btrim(COALESCE(decision,'')));
  cleaned_note := public.safe_correction_text(resolution_note, 280);
  IF normalized_decision NOT IN ('approve','reject') THEN RAISE EXCEPTION 'Choose approve or reject.' USING ERRCODE = '22023'; END IF;

  SELECT * INTO request_row FROM public.rehearsal_attendance_correction_requests r WHERE r.id = correction_request_id FOR UPDATE;
  IF request_row.id IS NULL THEN RAISE EXCEPTION 'Correction request not found.' USING ERRCODE = '22023'; END IF;
  IF request_row.status <> 'pending' THEN RETURN request_row; END IF;
  SELECT * INTO participant_row FROM public.band_rehearsal_participants brp WHERE brp.id = request_row.participant_id FOR UPDATE;
  SELECT * INTO rehearsal_row FROM public.band_rehearsals br WHERE br.id = request_row.rehearsal_id FOR UPDATE;
  IF NOT (public.is_band_leader_or_manager(request_row.band_id, actor_user_id) OR public.has_role(actor_user_id, 'admin'::public.app_role)) THEN
    INSERT INTO public.social_action_audit_log(actor_profile_id,target_profile_id,action,target_type,target_id,metadata) VALUES (actor_profile_id, request_row.requester_profile_id, 'rehearsal_attendance_correction_denied'::public.social_action_audit_kind, 'band_rehearsal_participant', request_row.participant_id, jsonb_build_object('reason','unauthorised_resolution','band_id',request_row.band_id,'rehearsal_id',request_row.rehearsal_id,'correction_request_id',request_row.id,'created_at',now()));
    RAISE EXCEPTION 'Only current authorised managers or support can resolve attendance corrections.' USING ERRCODE = '42501';
  END IF;
  IF participant_row.participation_status <> request_row.current_status THEN RAISE EXCEPTION 'Attendance changed since this correction was requested.' USING ERRCODE = '40001'; END IF;

  UPDATE public.rehearsal_attendance_correction_requests SET status = CASE WHEN normalized_decision='approve' THEN 'approved' ELSE 'rejected' END, resolved_at = now(), resolved_by_profile_id = actor_profile_id, resolution_note = cleaned_note WHERE id = request_row.id AND status = 'pending' RETURNING * INTO request_row;

  IF normalized_decision = 'approve' THEN
    UPDATE public.band_rehearsal_participants SET participation_status = request_row.requested_status, attended_at = CASE WHEN request_row.requested_status = 'attended' THEN COALESCE(attended_at, now()) ELSE attended_at END, updated_at = now() WHERE id = request_row.participant_id;
    IF request_row.requested_status = 'attended' THEN
      event_id := public.insert_band_contribution_event(request_row.band_id, request_row.requester_profile_id, 'rehearsal_attendance', 'band_rehearsal', request_row.rehearsal_id, COALESCE(rehearsal_row.completed_at, rehearsal_row.scheduled_end, now()), jsonb_build_object('label','Corrected rehearsal attendance','accuracy','corrected_participant','correction_request_id',request_row.id));
    ELSE
      UPDATE public.band_contribution_events SET voided_at = COALESCE(voided_at, now()), voided_by_profile_id = actor_profile_id, voided_by_correction_request_id = request_row.id WHERE band_id = request_row.band_id AND profile_id = request_row.requester_profile_id AND contribution_type = 'rehearsal_attendance' AND source_entity_type = 'band_rehearsal' AND source_entity_id = request_row.rehearsal_id AND voided_at IS NULL RETURNING id INTO event_id;
    END IF;
    INSERT INTO public.social_action_audit_log(actor_profile_id,target_profile_id,action,target_type,target_id,metadata) VALUES (actor_profile_id, request_row.requester_profile_id, 'rehearsal_attendance_corrected'::public.social_action_audit_kind, 'band_rehearsal_participant', request_row.participant_id, jsonb_build_object('band_id',request_row.band_id,'rehearsal_id',request_row.rehearsal_id,'correction_request_id',request_row.id,'previous_status',request_row.current_status,'resulting_status',request_row.requested_status,'contribution_event_id',event_id,'created_at',now()));
  END IF;

  INSERT INTO public.social_action_audit_log(actor_profile_id,target_profile_id,action,target_type,target_id,metadata) VALUES (actor_profile_id, request_row.requester_profile_id, CASE WHEN normalized_decision='approve' THEN 'rehearsal_attendance_correction_approved'::public.social_action_audit_kind ELSE 'rehearsal_attendance_correction_rejected'::public.social_action_audit_kind END, 'band_rehearsal_participant', request_row.participant_id, jsonb_build_object('band_id',request_row.band_id,'rehearsal_id',request_row.rehearsal_id,'correction_request_id',request_row.id,'previous_status',request_row.current_status,'requested_status',request_row.requested_status,'decision',normalized_decision,'resulting_status',CASE WHEN normalized_decision='approve' THEN request_row.requested_status ELSE request_row.current_status END,'created_at',now()));

  SELECT p.user_id INTO requester_user_id FROM public.profiles p WHERE p.id = request_row.requester_profile_id;
  IF requester_user_id IS NOT NULL THEN
    INSERT INTO public.notifications(user_id, profile_id, category, type, title, message, action_path, metadata)
    SELECT requester_user_id, request_row.requester_profile_id, 'band', 'rehearsal_attendance_correction_resolved', 'Attendance correction resolved', CASE WHEN normalized_decision='approve' THEN 'Your rehearsal attendance correction was approved.' ELSE 'Your rehearsal attendance correction was rejected.' END, '/rehearsals', jsonb_build_object('rehearsal_id',request_row.rehearsal_id,'participant_id',request_row.participant_id,'correction_request_id',request_row.id,'decision',normalized_decision,'band_id',request_row.band_id)
    WHERE NOT EXISTS (SELECT 1 FROM public.notifications n WHERE n.user_id = requester_user_id AND n.type = 'rehearsal_attendance_correction_resolved' AND n.metadata->>'correction_request_id' = request_row.id::text);
  END IF;
  IF normalized_decision='approve' AND event_id IS NOT NULL THEN
    INSERT INTO public.social_action_audit_log(actor_profile_id,target_profile_id,action,target_type,target_id,metadata) VALUES (actor_profile_id, request_row.requester_profile_id, 'band_contribution_correction_created'::public.social_action_audit_kind, 'band_rehearsal_participant', request_row.participant_id, jsonb_build_object('band_id',request_row.band_id,'rehearsal_id',request_row.rehearsal_id,'correction_request_id',request_row.id,'contribution_event_id',event_id,'created_at',now()));
  END IF;
  RETURN request_row;
END; $$;

REVOKE ALL ON FUNCTION public.request_rehearsal_attendance_correction(uuid, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.resolve_rehearsal_attendance_correction(uuid, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.request_rehearsal_attendance_correction(uuid, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.resolve_rehearsal_attendance_correction(uuid, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.rehearsal_attendance_correction_deadline(timestamptz, timestamptz) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_rehearsal_attendance_correction_open(timestamptz, timestamptz) TO authenticated;
