-- Phase 4 PR 06: guarded rehearsal self-response MVP.

ALTER TABLE public.band_rehearsal_participants
  DROP CONSTRAINT IF EXISTS band_rehearsal_participants_participation_status_check;
ALTER TABLE public.band_rehearsal_participants
  ADD CONSTRAINT band_rehearsal_participants_participation_status_check
  CHECK (participation_status IN ('invited', 'confirmed', 'declined', 'attended', 'missed'));

ALTER TYPE public.social_action_audit_kind ADD VALUE IF NOT EXISTS 'rehearsal_response_confirmed';
ALTER TYPE public.social_action_audit_kind ADD VALUE IF NOT EXISTS 'rehearsal_response_declined';
ALTER TYPE public.social_action_audit_kind ADD VALUE IF NOT EXISTS 'rehearsal_response_changed';
ALTER TYPE public.social_action_audit_kind ADD VALUE IF NOT EXISTS 'rehearsal_response_denied';

CREATE INDEX IF NOT EXISTS band_rehearsal_participants_profile_rehearsal_idx
  ON public.band_rehearsal_participants (profile_id, rehearsal_id);
CREATE INDEX IF NOT EXISTS player_schedule_rehearsal_user_status_idx
  ON public.player_scheduled_activities (linked_rehearsal_id, user_id, status)
  WHERE linked_rehearsal_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS notifications_rehearsal_rsvp_dedupe_idx
  ON public.notifications (user_id, type, ((metadata->>'rehearsal_id')), ((metadata->>'participant_id')), ((metadata->>'response')))
  WHERE type = 'rehearsal_rsvp';

CREATE OR REPLACE FUNCTION public.rehearsal_rsvp_lock_interval()
RETURNS interval LANGUAGE sql IMMUTABLE SET search_path = public AS $$
  SELECT interval '1 hour';
$$;

CREATE OR REPLACE FUNCTION public.rehearsal_rsvp_deadline(p_scheduled_start timestamptz)
RETURNS timestamptz LANGUAGE sql IMMUTABLE SET search_path = public AS $$
  SELECT p_scheduled_start - public.rehearsal_rsvp_lock_interval();
$$;

CREATE OR REPLACE FUNCTION public.is_rehearsal_participant_final(p_status text)
RETURNS boolean LANGUAGE sql IMMUTABLE SET search_path = public AS $$
  SELECT COALESCE(p_status, '') IN ('attended', 'missed');
$$;

CREATE OR REPLACE FUNCTION public.is_rehearsal_response_open(p_scheduled_start timestamptz, p_rehearsal_status text, p_participation_status text)
RETURNS boolean LANGUAGE sql STABLE SET search_path = public AS $$
  SELECT p_scheduled_start IS NOT NULL
    AND COALESCE(p_rehearsal_status, '') = 'scheduled'
    AND NOT public.is_rehearsal_participant_final(p_participation_status)
    AND now() < public.rehearsal_rsvp_deadline(p_scheduled_start);
$$;

CREATE OR REPLACE FUNCTION public.respond_to_rehearsal_invitation(
  participant_id uuid,
  response text
)
RETURNS public.band_rehearsal_participants
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  actor_profile_id uuid;
  participant_row public.band_rehearsal_participants;
  rehearsal_row public.band_rehearsals;
  actor_user_id uuid;
  normalized_response text;
  previous_status text;
  action_kind public.social_action_audit_kind;
  manager_record record;
  active_schedule_count integer;
BEGIN
  actor_user_id := auth.uid();
  SELECT p.id INTO actor_profile_id FROM public.profiles p WHERE p.user_id = actor_user_id ORDER BY p.created_at ASC LIMIT 1;
  IF actor_profile_id IS NULL THEN
    INSERT INTO public.social_action_audit_log (action, target_type, target_id, metadata)
    VALUES ('rehearsal_response_denied'::public.social_action_audit_kind, 'band_rehearsal_participant', participant_id, jsonb_build_object('reason','unauthenticated_or_missing_profile','attempted_response',response,'created_at',now()));
    RAISE EXCEPTION 'Sign in with an active player profile before responding to rehearsal invitations.' USING ERRCODE = '28000';
  END IF;

  normalized_response := lower(btrim(COALESCE(response, '')));
  IF normalized_response NOT IN ('confirmed', 'declined') THEN
    INSERT INTO public.social_action_audit_log (actor_profile_id, action, target_type, target_id, metadata)
    VALUES (actor_profile_id, 'rehearsal_response_denied'::public.social_action_audit_kind, 'band_rehearsal_participant', participant_id, jsonb_build_object('reason','invalid_response','attempted_response',response,'created_at',now()));
    RAISE EXCEPTION 'Choose confirmed or declined for this rehearsal invitation.' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO participant_row FROM public.band_rehearsal_participants brp WHERE brp.id = participant_id FOR UPDATE;
  IF participant_row.id IS NULL THEN
    INSERT INTO public.social_action_audit_log (actor_profile_id, action, target_type, target_id, metadata)
    VALUES (actor_profile_id, 'rehearsal_response_denied'::public.social_action_audit_kind, 'band_rehearsal_participant', participant_id, jsonb_build_object('reason','missing_participant','attempted_response',normalized_response,'created_at',now()));
    RAISE EXCEPTION 'That rehearsal invitation could not be found.' USING ERRCODE = '22023';
  END IF;

  IF participant_row.profile_id <> actor_profile_id THEN
    INSERT INTO public.social_action_audit_log (actor_profile_id, target_profile_id, action, target_type, target_id, metadata)
    VALUES (actor_profile_id, participant_row.profile_id, 'rehearsal_response_denied'::public.social_action_audit_kind, 'band_rehearsal_participant', participant_row.id, jsonb_build_object('reason','not_own_participant','rehearsal_id',participant_row.rehearsal_id,'attempted_response',normalized_response,'created_at',now()));
    RAISE EXCEPTION 'You can only respond to your own rehearsal invitation.' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO rehearsal_row FROM public.band_rehearsals br WHERE br.id = participant_row.rehearsal_id FOR UPDATE;
  IF rehearsal_row.id IS NULL OR rehearsal_row.band_id <> participant_row.band_id THEN
    RAISE EXCEPTION 'That rehearsal could not be found.' USING ERRCODE = '22023';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.band_members bm WHERE bm.band_id = participant_row.band_id AND bm.profile_id = actor_profile_id AND bm.user_id = actor_user_id AND COALESCE(bm.member_status,'active') = 'active' AND COALESCE(bm.is_touring_member,false) = false) THEN
    INSERT INTO public.social_action_audit_log (actor_profile_id, action, target_type, target_id, metadata)
    VALUES (actor_profile_id, 'rehearsal_response_denied'::public.social_action_audit_kind, 'band_rehearsal_participant', participant_row.id, jsonb_build_object('reason','inactive_or_ineligible_member','rehearsal_id',participant_row.rehearsal_id,'attempted_response',normalized_response,'created_at',now()));
    RAISE EXCEPTION 'Only active eligible band members can respond to rehearsal invitations.' USING ERRCODE = '42501';
  END IF;

  IF COALESCE(rehearsal_row.status,'') <> 'scheduled' THEN
    INSERT INTO public.social_action_audit_log (actor_profile_id, action, target_type, target_id, metadata)
    VALUES (actor_profile_id, 'rehearsal_response_denied'::public.social_action_audit_kind, 'band_rehearsal_participant', participant_row.id, jsonb_build_object('reason','rehearsal_locked_status','rehearsal_status',rehearsal_row.status,'rehearsal_id',rehearsal_row.id,'attempted_response',normalized_response,'created_at',now()));
    RAISE EXCEPTION 'Responses are closed for this rehearsal.' USING ERRCODE = '55000';
  END IF;

  IF public.is_rehearsal_participant_final(participant_row.participation_status) THEN
    RAISE EXCEPTION 'This rehearsal attendance status is final and cannot be changed by RSVP.' USING ERRCODE = '55000';
  END IF;

  IF now() >= public.rehearsal_rsvp_deadline(rehearsal_row.scheduled_start) THEN
    INSERT INTO public.social_action_audit_log (actor_profile_id, action, target_type, target_id, metadata)
    VALUES (actor_profile_id, 'rehearsal_response_denied'::public.social_action_audit_kind, 'band_rehearsal_participant', participant_row.id, jsonb_build_object('reason','late_response','rehearsal_id',rehearsal_row.id,'previous_status',participant_row.participation_status,'attempted_response',normalized_response,'deadline',public.rehearsal_rsvp_deadline(rehearsal_row.scheduled_start),'created_at',now()));
    RAISE EXCEPTION 'Responses are locked one hour before rehearsal.' USING ERRCODE = '55000';
  END IF;

  previous_status := participant_row.participation_status;

  IF normalized_response = 'confirmed' THEN
    SELECT count(*) INTO active_schedule_count FROM public.player_scheduled_activities psa WHERE psa.user_id = actor_user_id AND psa.linked_rehearsal_id = rehearsal_row.id AND psa.status IN ('scheduled','in_progress');
    IF active_schedule_count = 0 THEN
      IF public.check_scheduling_conflict(actor_user_id, rehearsal_row.scheduled_start, rehearsal_row.scheduled_end, NULL) THEN
        RAISE EXCEPTION 'You now have a schedule conflict during this rehearsal.' USING ERRCODE = '23P01';
      END IF;
      INSERT INTO public.player_scheduled_activities (user_id, profile_id, activity_type, scheduled_start, scheduled_end, title, description, linked_rehearsal_id, status, metadata)
      VALUES (actor_user_id, actor_profile_id, 'rehearsal', rehearsal_row.scheduled_start, rehearsal_row.scheduled_end, 'Band Rehearsal', 'Band rehearsal RSVP confirmation', rehearsal_row.id, 'scheduled', jsonb_build_object('band_id', rehearsal_row.band_id, 'is_band_activity', true, 'restored_by_rehearsal_rsvp', true));
    END IF;
  ELSE
    UPDATE public.player_scheduled_activities psa SET status = 'cancelled', updated_at = now(), metadata = COALESCE(psa.metadata,'{}'::jsonb) || jsonb_build_object('cancelled_by_rehearsal_rsvp', true)
    WHERE psa.user_id = actor_user_id AND psa.linked_rehearsal_id = rehearsal_row.id AND psa.status IN ('scheduled','in_progress');
  END IF;

  IF previous_status <> normalized_response THEN
    UPDATE public.band_rehearsal_participants SET participation_status = normalized_response, responded_at = now(), updated_at = now() WHERE id = participant_row.id RETURNING * INTO participant_row;
  END IF;

  action_kind := CASE WHEN previous_status <> normalized_response AND previous_status IN ('confirmed','declined') THEN 'rehearsal_response_changed'::public.social_action_audit_kind WHEN normalized_response = 'confirmed' THEN 'rehearsal_response_confirmed'::public.social_action_audit_kind ELSE 'rehearsal_response_declined'::public.social_action_audit_kind END;
  INSERT INTO public.social_action_audit_log (actor_profile_id, target_profile_id, action, target_type, target_id, metadata)
  VALUES (actor_profile_id, actor_profile_id, action_kind, 'band_rehearsal_participant', participant_row.id, jsonb_build_object('rehearsal_id',rehearsal_row.id,'band_id',rehearsal_row.band_id,'previous_status',previous_status,'new_status',participant_row.participation_status,'created_at',now()));

  IF previous_status <> normalized_response AND normalized_response = 'declined' THEN
    FOR manager_record IN SELECT bm.profile_id, bm.user_id FROM public.band_members bm WHERE bm.band_id = rehearsal_row.band_id AND COALESCE(bm.member_status,'active') = 'active' AND lower(COALESCE(bm.role,'')) IN ('leader','founder','co-leader','manager') AND bm.user_id IS NOT NULL AND bm.profile_id <> actor_profile_id LOOP
      INSERT INTO public.notifications(user_id, profile_id, category, type, title, message, action_path, metadata)
      SELECT manager_record.user_id, manager_record.profile_id, 'band', 'rehearsal_rsvp', 'Rehearsal response updated', 'A band member declined a rehearsal invitation.', '/rehearsals', jsonb_build_object('rehearsal_id',rehearsal_row.id,'participant_id',participant_row.id,'response',normalized_response,'band_id',rehearsal_row.band_id)
      WHERE NOT EXISTS (SELECT 1 FROM public.notifications n WHERE n.user_id = manager_record.user_id AND n.type = 'rehearsal_rsvp' AND n.metadata->>'rehearsal_id' = rehearsal_row.id::text AND n.metadata->>'participant_id' = participant_row.id::text AND n.metadata->>'response' = normalized_response);
    END LOOP;
  END IF;

  RETURN participant_row;
END;
$$;

REVOKE ALL ON FUNCTION public.respond_to_rehearsal_invitation(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.respond_to_rehearsal_invitation(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.rehearsal_rsvp_deadline(timestamptz) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_rehearsal_response_open(timestamptz, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_rehearsal_participant_final(text) TO authenticated;


CREATE OR REPLACE FUNCTION public.respond_to_rehearsal_participation(
  participant_id uuid,
  response text
)
RETURNS public.band_rehearsal_participants
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.respond_to_rehearsal_invitation(participant_id, response);
$$;

REVOKE ALL ON FUNCTION public.respond_to_rehearsal_participation(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.respond_to_rehearsal_participation(uuid, text) TO authenticated;
