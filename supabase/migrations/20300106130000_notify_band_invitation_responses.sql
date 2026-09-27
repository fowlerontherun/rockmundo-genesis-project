-- Inform the original inviter after a player accepts or declines.
-- Keep the recipient's original notice in sync without consuming the new sender notice.
-- The existing invitation locks, authorisation, membership checks and idempotency are preserved.
BEGIN;

CREATE OR REPLACE FUNCTION public.respond_band_invitation(invitation_id uuid, response_status text)
 RETURNS band_invitations
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_invitation_id uuid := invitation_id;
  v_response text := lower(btrim(COALESCE(response_status, '')));
  v_active_profile_id uuid := public.current_profile_id();
  v_invitation public.band_invitations%ROWTYPE;
  v_band public.bands%ROWTYPE;
  v_target public.profiles%ROWTYPE;
  v_member public.band_members%ROWTYPE;
  v_sender_profile_id uuid;
  v_target_name text;
  v_band_name text;
BEGIN
  IF auth.uid() IS NULL OR v_active_profile_id IS NULL THEN
    RAISE EXCEPTION 'Select an active player character before responding.' USING ERRCODE = '42501';
  END IF;
  IF v_response NOT IN ('accepted', 'declined') THEN
    RAISE EXCEPTION 'Choose accept or decline.' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO v_invitation
  FROM public.band_invitations bi
  WHERE bi.id = v_invitation_id
  FOR UPDATE;

  IF v_invitation.id IS NULL THEN
    RAISE EXCEPTION 'That band invitation could not be found.' USING ERRCODE = '22023';
  END IF;
  IF v_invitation.invited_user_id <> auth.uid() THEN
    RAISE EXCEPTION 'This invitation belongs to another account.' USING ERRCODE = '42501';
  END IF;

  IF v_invitation.invited_profile_id IS NULL THEN
    UPDATE public.band_invitations
    SET invited_profile_id = v_active_profile_id
    WHERE id = v_invitation.id
    RETURNING * INTO v_invitation;
  ELSIF v_invitation.invited_profile_id <> v_active_profile_id THEN
    RAISE EXCEPTION 'Switch to the character who was invited before responding.' USING ERRCODE = '42501';
  END IF;

  IF v_invitation.status = v_response THEN
    RETURN v_invitation;
  END IF;
  IF v_invitation.status <> 'pending' THEN
    RAISE EXCEPTION 'This invitation has already been resolved.' USING ERRCODE = '22023';
  END IF;

  IF v_response = 'declined' THEN
    UPDATE public.band_invitations
    SET status = 'declined', responded_at = now()
    WHERE id = v_invitation.id
    RETURNING * INTO v_invitation;
  ELSE
    SELECT * INTO v_band
    FROM public.bands b
    WHERE b.id = v_invitation.band_id
    FOR UPDATE;

    IF v_band.id IS NULL OR v_band.status <> 'active'::public.band_status THEN
      RAISE EXCEPTION 'This band is not currently active.' USING ERRCODE = '22023';
    END IF;
    IF COALESCE(v_band.is_solo_artist, false) THEN
      RAISE EXCEPTION 'Solo artists cannot add regular band members.' USING ERRCODE = '22023';
    END IF;

    SELECT * INTO v_target
    FROM public.profiles p
    WHERE p.id = v_active_profile_id
    FOR UPDATE;

    IF v_target.id IS NULL
       OR v_target.user_id <> auth.uid()
       OR NOT COALESCE(v_target.is_active, false)
       OR v_target.deleted_at IS NOT NULL
       OR v_target.died_at IS NOT NULL THEN
      RAISE EXCEPTION 'The invited character is no longer active.' USING ERRCODE = '22023';
    END IF;

    PERFORM pg_advisory_xact_lock(hashtextextended(v_target.id::text, 0));

    SELECT * INTO v_member
    FROM public.band_members bm
    WHERE bm.band_id = v_band.id
      AND bm.profile_id = v_target.id
    FOR UPDATE;

    IF v_member.id IS NULL OR COALESCE(v_member.member_status, 'active') <> 'active' THEN
      IF EXISTS (
        SELECT 1
        FROM public.band_members bm
        JOIN public.bands other_band ON other_band.id = bm.band_id
        WHERE bm.profile_id = v_target.id
          AND bm.band_id <> v_band.id
          AND other_band.status = 'active'::public.band_status
          AND COALESCE(bm.member_status, 'active') = 'active'
          AND NOT COALESCE(bm.is_touring_member, false)
      ) THEN
        RAISE EXCEPTION 'Leave your current active band before accepting this invitation.' USING ERRCODE = '23505';
      END IF;

      IF (
        SELECT count(*) FROM public.band_members bm
        WHERE bm.band_id = v_band.id
          AND COALESCE(bm.member_status, 'active') = 'active'
          AND NOT COALESCE(bm.is_touring_member, false)
      ) >= COALESCE(v_band.max_members, 4) THEN
        RAISE EXCEPTION 'This band has no open member slots.' USING ERRCODE = '23514';
      END IF;

      IF v_member.id IS NULL THEN
        INSERT INTO public.band_members (
          band_id, user_id, profile_id, role, instrument_role,
          vocal_role, member_status, is_touring_member
        ) VALUES (
          v_band.id, v_target.user_id, v_target.id, 'member',
          v_invitation.instrument_role, v_invitation.vocal_role, 'active', false
        )
        RETURNING * INTO v_member;
      ELSE
        UPDATE public.band_members
        SET user_id = v_target.user_id,
            role = 'member',
            instrument_role = v_invitation.instrument_role,
            vocal_role = v_invitation.vocal_role,
            member_status = 'active',
            is_touring_member = false
        WHERE id = v_member.id
        RETURNING * INTO v_member;
      END IF;
    END IF;

    UPDATE public.band_invitations
    SET status = 'accepted', responded_at = now()
    WHERE id = v_invitation.id
    RETURNING * INTO v_invitation;

    UPDATE public.band_applications
    SET status = 'withdrawn', responded_at = now()
    WHERE applicant_profile_id = v_target.id
      AND status = 'pending';
  END IF;

  -- Resolve only the recipient's original invite notice. The new sender
  -- response notice must remain unread in the inviting character's inbox.
  UPDATE public.notifications n
  SET read_at = COALESCE(n.read_at, now()),
      metadata = COALESCE(n.metadata, '{}'::jsonb)
        || jsonb_build_object('band_invitation_status', v_invitation.status, 'actionable', false)
  WHERE n.metadata->>'band_invitation_id' = v_invitation.id::text
    AND n.user_id = v_invitation.invited_user_id;

  -- Exactly one sender alert per terminal transition. Repeated RPC calls
  -- exit above without producing additional notifications.
  SELECT p.id INTO v_sender_profile_id
  FROM public.notifications n
  JOIN public.profiles p ON p.id::text = n.metadata->>'inviter_profile_id'
  WHERE n.metadata->>'band_invitation_id' = v_invitation.id::text
    AND n.user_id = v_invitation.invited_user_id
    AND p.user_id = v_invitation.inviter_user_id
    AND COALESCE(p.is_active, false)
    AND p.deleted_at IS NULL
    AND p.died_at IS NULL
  ORDER BY n.created_at DESC
  LIMIT 1;

  -- Original character may have been retired or its notice archived.
  IF v_sender_profile_id IS NULL THEN
    SELECT p.id INTO v_sender_profile_id
    FROM public.profiles p
    WHERE p.user_id = v_invitation.inviter_user_id
      AND COALESCE(p.is_active, false)
      AND p.deleted_at IS NULL
      AND p.died_at IS NULL
    ORDER BY p.created_at DESC
    LIMIT 1;
  END IF;

  IF v_sender_profile_id IS NOT NULL THEN
    SELECT COALESCE(NULLIF(btrim(p.display_name), ''), NULLIF(btrim(p.username), ''), 'A musician')
    INTO v_target_name
    FROM public.profiles p
    WHERE p.id = v_active_profile_id;

    SELECT b.name INTO v_band_name
    FROM public.bands b
    WHERE b.id = v_invitation.band_id;

    INSERT INTO public.notifications (
      user_id, profile_id, category, type, title, message, action_path, metadata
    ) VALUES (
      v_invitation.inviter_user_id,
      v_sender_profile_id,
      'band',
      'band_invite_response',
      COALESCE(v_target_name, 'A musician') ||
        CASE WHEN v_invitation.status = 'accepted'
          THEN ' accepted your band invitation'
          ELSE ' declined your band invitation' END,
      CASE WHEN v_invitation.status = 'accepted'
        THEN 'Your invitation to join ' || COALESCE(v_band_name, 'your band') || ' was accepted.'
        ELSE 'Your invitation to join ' || COALESCE(v_band_name, 'your band') || ' was declined.' END,
      '/band/members',
      jsonb_build_object(
        'band_invitation_id', v_invitation.id,
        'band_id', v_invitation.band_id,
        'invited_profile_id', v_active_profile_id,
        'band_invitation_status', v_invitation.status,
        'actionable', false
      )
    );
  END IF;

  RETURN v_invitation;
END;
$function$;

COMMIT;
