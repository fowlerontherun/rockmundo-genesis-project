-- Phase 4 PR 07: guarded manager rehearsal attendance finalisation MVP.

ALTER TYPE public.social_action_audit_kind ADD VALUE IF NOT EXISTS 'rehearsal_attendance_finalised';
ALTER TYPE public.social_action_audit_kind ADD VALUE IF NOT EXISTS 'rehearsal_attendance_marked_attended';
ALTER TYPE public.social_action_audit_kind ADD VALUE IF NOT EXISTS 'rehearsal_attendance_marked_missed';
ALTER TYPE public.social_action_audit_kind ADD VALUE IF NOT EXISTS 'rehearsal_attendance_finalise_denied';
ALTER TYPE public.social_report_target_type ADD VALUE IF NOT EXISTS 'band_rehearsal';
ALTER TYPE public.social_report_target_type ADD VALUE IF NOT EXISTS 'band_rehearsal_participant';

CREATE INDEX IF NOT EXISTS notifications_rehearsal_attendance_dedupe_idx
  ON public.notifications (user_id, type, ((metadata->>'rehearsal_id')), ((metadata->>'participant_id')), ((metadata->>'final_status')))
  WHERE type = 'rehearsal_attendance_finalised';

CREATE OR REPLACE FUNCTION public.is_rehearsal_attendance_finalisation_open(
  p_scheduled_start timestamptz,
  p_scheduled_end timestamptz,
  p_rehearsal_status text
)
RETURNS boolean LANGUAGE sql STABLE SET search_path = public AS $$
  SELECT COALESCE(p_rehearsal_status, '') <> 'cancelled'
    AND p_scheduled_start IS NOT NULL
    AND (
      COALESCE(p_rehearsal_status, '') = 'completed'
      OR (p_scheduled_end IS NOT NULL AND now() >= p_scheduled_end)
      OR (p_scheduled_end IS NULL AND now() >= p_scheduled_start)
    );
$$;

CREATE OR REPLACE FUNCTION public.capture_contributions_for_rehearsal(p_rehearsal_id uuid)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_rehearsal record; v_participant record; v_event_id uuid; v_inserted integer := 0;
BEGIN
  SELECT id, band_id, status, completed_at, scheduled_end INTO v_rehearsal FROM public.band_rehearsals WHERE id = p_rehearsal_id;
  IF NOT FOUND OR v_rehearsal.status <> 'completed' THEN RETURN 0; END IF;
  PERFORM public.seed_rehearsal_participants(v_rehearsal.id);
  FOR v_participant IN SELECT profile_id FROM public.band_rehearsal_participants WHERE rehearsal_id = v_rehearsal.id AND participation_status = 'attended' LOOP
    v_event_id := public.insert_band_contribution_event(v_rehearsal.band_id, v_participant.profile_id, 'rehearsal_attendance', 'band_rehearsal', v_rehearsal.id, COALESCE(v_rehearsal.completed_at, v_rehearsal.scheduled_end, now()), jsonb_build_object('label','Finalised rehearsal attendance','accuracy','verified_participant','verification_method','manager_attendance_finalisation'));
    IF v_event_id IS NOT NULL THEN v_inserted := v_inserted + 1; END IF;
  END LOOP;
  RETURN v_inserted;
END;
$$;

CREATE OR REPLACE FUNCTION public.finalise_rehearsal_attendance(
  rehearsal_id uuid,
  attendance jsonb
)
RETURNS TABLE (
  participant_id uuid,
  profile_id uuid,
  previous_status text,
  participation_status text,
  changed boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  actor_user_id uuid;
  actor_profile_id uuid;
  rehearsal_row public.band_rehearsals;
  item_count integer;
  invalid_count integer;
  row_record record;
  notification_user_id uuid;
BEGIN
  actor_user_id := auth.uid();
  SELECT p.id INTO actor_profile_id FROM public.profiles p WHERE p.user_id = actor_user_id ORDER BY p.created_at ASC LIMIT 1;
  IF actor_profile_id IS NULL THEN
    RAISE EXCEPTION 'Sign in with an active player profile before finalising rehearsal attendance.' USING ERRCODE = '28000';
  END IF;

  SELECT * INTO rehearsal_row FROM public.band_rehearsals br WHERE br.id = rehearsal_id FOR UPDATE;
  IF rehearsal_row.id IS NULL THEN
    INSERT INTO public.social_action_audit_log (actor_profile_id, action, target_type, target_id, metadata)
    VALUES (actor_profile_id, 'rehearsal_attendance_finalise_denied'::public.social_action_audit_kind, 'band_rehearsal', rehearsal_id, jsonb_build_object('reason','missing_rehearsal','created_at',now()));
    RAISE EXCEPTION 'That rehearsal could not be found.' USING ERRCODE = '22023';
  END IF;

  IF NOT public.is_band_leader_or_manager(rehearsal_row.band_id, actor_user_id) THEN
    INSERT INTO public.social_action_audit_log (actor_profile_id, action, target_type, target_id, metadata)
    VALUES (actor_profile_id, 'rehearsal_attendance_finalise_denied'::public.social_action_audit_kind, 'band_rehearsal', rehearsal_row.id, jsonb_build_object('reason','unauthorised_manager','band_id',rehearsal_row.band_id,'created_at',now()));
    RAISE EXCEPTION 'Only current authorised band managers can finalise rehearsal attendance.' USING ERRCODE = '42501';
  END IF;

  IF COALESCE(rehearsal_row.status, '') = 'cancelled' THEN
    INSERT INTO public.social_action_audit_log (actor_profile_id, action, target_type, target_id, metadata)
    VALUES (actor_profile_id, 'rehearsal_attendance_finalise_denied'::public.social_action_audit_kind, 'band_rehearsal', rehearsal_row.id, jsonb_build_object('reason','cancelled_rehearsal','band_id',rehearsal_row.band_id,'created_at',now()));
    RAISE EXCEPTION 'Cancelled rehearsals cannot be finalised.' USING ERRCODE = '55000';
  END IF;

  IF NOT public.is_rehearsal_attendance_finalisation_open(rehearsal_row.scheduled_start, rehearsal_row.scheduled_end, rehearsal_row.status) THEN
    INSERT INTO public.social_action_audit_log (actor_profile_id, action, target_type, target_id, metadata)
    VALUES (actor_profile_id, 'rehearsal_attendance_finalise_denied'::public.social_action_audit_kind, 'band_rehearsal', rehearsal_row.id, jsonb_build_object('reason','early_finalisation','band_id',rehearsal_row.band_id,'scheduled_start',rehearsal_row.scheduled_start,'scheduled_end',rehearsal_row.scheduled_end,'status',rehearsal_row.status,'created_at',now()));
    RAISE EXCEPTION 'Attendance can be finalised after rehearsal end or once the rehearsal is completed.' USING ERRCODE = '55000';
  END IF;

  IF attendance IS NULL OR jsonb_typeof(attendance) <> 'array' OR jsonb_array_length(attendance) = 0 THEN
    INSERT INTO public.social_action_audit_log (actor_profile_id, action, target_type, target_id, metadata)
    VALUES (actor_profile_id, 'rehearsal_attendance_finalise_denied'::public.social_action_audit_kind, 'band_rehearsal', rehearsal_row.id, jsonb_build_object('reason','empty_or_invalid_payload','band_id',rehearsal_row.band_id,'created_at',now()));
    RAISE EXCEPTION 'Provide at least one attendance row to finalise.' USING ERRCODE = '22023';
  END IF;

  DROP TABLE IF EXISTS tmp_rehearsal_attendance_finalise;
  CREATE TEMP TABLE tmp_rehearsal_attendance_finalise ON COMMIT DROP AS
  SELECT DISTINCT (value->>'participant_id')::uuid AS participant_id, lower(btrim(value->>'status')) AS new_status
  FROM jsonb_array_elements(attendance) value;

  SELECT count(*) INTO invalid_count FROM tmp_rehearsal_attendance_finalise WHERE participant_id IS NULL OR new_status NOT IN ('attended','missed');
  IF invalid_count > 0 THEN
    INSERT INTO public.social_action_audit_log (actor_profile_id, action, target_type, target_id, metadata)
    VALUES (actor_profile_id, 'rehearsal_attendance_finalise_denied'::public.social_action_audit_kind, 'band_rehearsal', rehearsal_row.id, jsonb_build_object('reason','invalid_participant_or_status','band_id',rehearsal_row.band_id,'created_at',now()));
    RAISE EXCEPTION 'Attendance rows must include existing participant IDs and attended or missed.' USING ERRCODE = '22023';
  END IF;

  SELECT count(*) INTO item_count FROM tmp_rehearsal_attendance_finalise;

  PERFORM 1 FROM public.band_rehearsal_participants brp
  JOIN tmp_rehearsal_attendance_finalise t ON t.participant_id = brp.id
  WHERE brp.rehearsal_id = rehearsal_row.id
  FOR UPDATE OF brp;

  SELECT count(*) INTO invalid_count
  FROM tmp_rehearsal_attendance_finalise t
  LEFT JOIN public.band_rehearsal_participants brp ON brp.id = t.participant_id AND brp.rehearsal_id = rehearsal_row.id AND brp.band_id = rehearsal_row.band_id
  WHERE brp.id IS NULL;
  IF invalid_count > 0 THEN
    INSERT INTO public.social_action_audit_log (actor_profile_id, action, target_type, target_id, metadata)
    VALUES (actor_profile_id, 'rehearsal_attendance_finalise_denied'::public.social_action_audit_kind, 'band_rehearsal', rehearsal_row.id, jsonb_build_object('reason','wrong_rehearsal_participant','band_id',rehearsal_row.band_id,'created_at',now()));
    RAISE EXCEPTION 'Every attendance row must belong to this rehearsal.' USING ERRCODE = '22023';
  END IF;

  SELECT count(*) INTO invalid_count
  FROM tmp_rehearsal_attendance_finalise t JOIN public.band_rehearsal_participants brp ON brp.id = t.participant_id
  WHERE brp.participation_status = 'declined' OR (brp.participation_status IN ('attended','missed') AND brp.participation_status <> t.new_status);
  IF invalid_count > 0 THEN
    INSERT INTO public.social_action_audit_log (actor_profile_id, action, target_type, target_id, metadata)
    VALUES (actor_profile_id, 'rehearsal_attendance_finalise_denied'::public.social_action_audit_kind, 'band_rehearsal', rehearsal_row.id, jsonb_build_object('reason','final_or_declined_status_conflict','band_id',rehearsal_row.band_id,'created_at',now()));
    RAISE EXCEPTION 'Declined and conflicting final attendance rows cannot be changed in this PR.' USING ERRCODE = '55000';
  END IF;

  DROP TABLE IF EXISTS tmp_rehearsal_attendance_result;
  CREATE TEMP TABLE tmp_rehearsal_attendance_result ON COMMIT DROP AS
  SELECT brp.id AS participant_id, brp.profile_id, brp.participation_status AS previous_status, t.new_status, (brp.participation_status <> t.new_status) AS changed
  FROM public.band_rehearsal_participants brp JOIN tmp_rehearsal_attendance_finalise t ON t.participant_id = brp.id;

  UPDATE public.band_rehearsal_participants brp
  SET participation_status = r.new_status,
      attended_at = CASE WHEN r.new_status = 'attended' THEN COALESCE(brp.attended_at, now()) ELSE brp.attended_at END,
      updated_at = now()
  FROM tmp_rehearsal_attendance_result r
  WHERE brp.id = r.participant_id AND r.changed;

  FOR row_record IN SELECT * FROM tmp_rehearsal_attendance_result LOOP
    IF row_record.new_status = 'attended' THEN
      PERFORM public.insert_band_contribution_event(rehearsal_row.band_id, row_record.profile_id, 'rehearsal_attendance', 'band_rehearsal', rehearsal_row.id, COALESCE(rehearsal_row.completed_at, rehearsal_row.scheduled_end, now()), jsonb_build_object('label','Finalised rehearsal attendance','accuracy','verified_participant','verification_method','manager_attendance_finalisation','attendance_status','attended'));
    ELSE
      SELECT p.user_id INTO notification_user_id FROM public.profiles p WHERE p.id = row_record.profile_id;
      IF notification_user_id IS NOT NULL THEN
        INSERT INTO public.notifications(user_id, profile_id, category, type, title, message, action_path, metadata)
        SELECT notification_user_id, row_record.profile_id, 'band', 'rehearsal_attendance_finalised', 'Rehearsal attendance finalised', 'You were marked missed for a rehearsal.', '/rehearsals', jsonb_build_object('rehearsal_id',rehearsal_row.id,'participant_id',row_record.participant_id,'final_status','missed','band_id',rehearsal_row.band_id)
        WHERE NOT EXISTS (SELECT 1 FROM public.notifications n WHERE n.user_id = notification_user_id AND n.type = 'rehearsal_attendance_finalised' AND n.metadata->>'rehearsal_id' = rehearsal_row.id::text AND n.metadata->>'participant_id' = row_record.participant_id::text AND n.metadata->>'final_status' = 'missed');
      END IF;
    END IF;

    INSERT INTO public.social_action_audit_log (actor_profile_id, target_profile_id, action, target_type, target_id, metadata)
    VALUES (actor_profile_id, row_record.profile_id, CASE WHEN row_record.new_status = 'attended' THEN 'rehearsal_attendance_marked_attended'::public.social_action_audit_kind ELSE 'rehearsal_attendance_marked_missed'::public.social_action_audit_kind END, 'band_rehearsal_participant', row_record.participant_id, jsonb_build_object('rehearsal_id',rehearsal_row.id,'band_id',rehearsal_row.band_id,'previous_status',row_record.previous_status,'new_status',row_record.new_status,'changed',row_record.changed,'created_at',now()));
  END LOOP;

  INSERT INTO public.social_action_audit_log (actor_profile_id, action, target_type, target_id, metadata)
  VALUES (actor_profile_id, 'rehearsal_attendance_finalised'::public.social_action_audit_kind, 'band_rehearsal', rehearsal_row.id, jsonb_build_object('band_id',rehearsal_row.band_id,'row_count',item_count,'changed_count',(SELECT count(*) FROM tmp_rehearsal_attendance_result WHERE changed),'created_at',now()));

  RETURN QUERY SELECT r.participant_id, r.profile_id, r.previous_status, r.new_status, r.changed FROM tmp_rehearsal_attendance_result r ORDER BY r.participant_id;
END;
$$;

REVOKE ALL ON FUNCTION public.finalise_rehearsal_attendance(uuid, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.finalise_rehearsal_attendance(uuid, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_rehearsal_attendance_finalisation_open(timestamptz, timestamptz, text) TO authenticated;
