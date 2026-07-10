ALTER TYPE public.social_action_audit_kind ADD VALUE IF NOT EXISTS 'band_invitation_send_denied';

ALTER TABLE public.band_invitations
  ADD CONSTRAINT band_invitations_message_length CHECK (message IS NULL OR char_length(btrim(message)) BETWEEN 1 AND 280);

CREATE UNIQUE INDEX IF NOT EXISTS band_invitations_one_pending_per_user_band_idx
  ON public.band_invitations (band_id, invited_user_id)
  WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS band_invitations_inviter_created_idx
  ON public.band_invitations (inviter_user_id, created_at DESC);

CREATE OR REPLACE FUNCTION public.can_manage_band_invitations(target_band_id uuid, actor_user_id uuid DEFAULT auth.uid())
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT target_band_id IS NOT NULL
    AND actor_user_id IS NOT NULL
    AND (
      EXISTS (SELECT 1 FROM public.bands b WHERE b.id = target_band_id AND b.leader_id = actor_user_id)
      OR EXISTS (
        SELECT 1 FROM public.band_members bm
        WHERE bm.band_id = target_band_id
          AND bm.user_id = actor_user_id
          AND lower(bm.role) IN ('leader', 'founder')
      )
    );
$$;

CREATE OR REPLACE FUNCTION public.can_receive_band_invitation(inviter_profile_id uuid, target_profile_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT inviter_profile_id IS NOT NULL
    AND target_profile_id IS NOT NULL
    AND inviter_profile_id <> target_profile_id
    AND EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = inviter_profile_id)
    AND EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = target_profile_id)
    AND NOT public.are_profiles_blocked(inviter_profile_id, target_profile_id)
    AND COALESCE((
      SELECT pps.allow_band_invites
      FROM public.profile_privacy_settings pps
      WHERE pps.profile_id = target_profile_id
    ), true);
$$;

CREATE OR REPLACE FUNCTION public.send_band_invitation(
  target_profile_id uuid,
  target_band_id uuid,
  requested_instrument_role text DEFAULT 'Guitar',
  requested_vocal_role text DEFAULT NULL,
  invite_message text DEFAULT NULL
)
RETURNS public.band_invitations
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  inviter_profile_id uuid;
  invited_user_id uuid;
  trimmed_message text;
  normalized_instrument text;
  normalized_vocal text;
  existing_invite public.band_invitations;
  invite_row public.band_invitations;
BEGIN
  SELECT p.id INTO inviter_profile_id
  FROM public.profiles p
  WHERE p.user_id = auth.uid()
  ORDER BY p.created_at ASC
  LIMIT 1;

  IF inviter_profile_id IS NULL THEN
    RAISE EXCEPTION 'Sign in with an active player profile before sending band invitations.' USING ERRCODE = '28000';
  END IF;
  IF target_profile_id IS NULL OR target_band_id IS NULL THEN
    RAISE EXCEPTION 'Choose a valid band and player to invite.' USING ERRCODE = '22023';
  END IF;
  IF inviter_profile_id = target_profile_id THEN
    RAISE EXCEPTION 'You cannot invite yourself to a band.' USING ERRCODE = '22023';
  END IF;
  IF NOT public.can_manage_band_invitations(target_band_id, auth.uid()) THEN
    INSERT INTO public.social_action_audit_log (actor_profile_id, target_profile_id, action, target_type, target_id, metadata)
    VALUES (inviter_profile_id, target_profile_id, 'band_invitation_send_denied'::public.social_action_audit_kind, 'band', target_band_id, jsonb_build_object('reason', 'unauthorised_band_role'));
    RAISE EXCEPTION 'You are not allowed to invite players to this band.' USING ERRCODE = '42501';
  END IF;

  SELECT p.user_id INTO invited_user_id FROM public.profiles p WHERE p.id = target_profile_id;
  IF invited_user_id IS NULL THEN
    RAISE EXCEPTION 'That player could not be found.' USING ERRCODE = '22023';
  END IF;

  normalized_instrument := COALESCE(NULLIF(btrim(requested_instrument_role), ''), 'Guitar');
  IF normalized_instrument NOT IN ('Guitar', 'Bass', 'Drums', 'Keyboard', 'Other') THEN
    RAISE EXCEPTION 'Choose a valid instrument role.' USING ERRCODE = '22023';
  END IF;
  normalized_vocal := NULLIF(btrim(COALESCE(requested_vocal_role, '')), '');
  IF normalized_vocal = 'None' THEN normalized_vocal := NULL; END IF;
  IF normalized_vocal IS NOT NULL AND normalized_vocal NOT IN ('Lead Vocals', 'Backing Vocals') THEN
    RAISE EXCEPTION 'Choose a valid vocal role.' USING ERRCODE = '22023';
  END IF;
  trimmed_message := NULLIF(btrim(COALESCE(invite_message, '')), '');
  IF trimmed_message IS NOT NULL AND char_length(trimmed_message) > 280 THEN
    RAISE EXCEPTION 'Band invitation messages must be 280 characters or fewer.' USING ERRCODE = '22023';
  END IF;

  IF NOT public.can_receive_band_invitation(inviter_profile_id, target_profile_id) THEN
    INSERT INTO public.social_action_audit_log (actor_profile_id, target_profile_id, action, target_type, target_id, metadata)
    VALUES (inviter_profile_id, target_profile_id, 'band_invitation_send_denied'::public.social_action_audit_kind, 'band', target_band_id, jsonb_build_object('reason', 'privacy_or_block_guard'));
    RAISE EXCEPTION 'This player is not available for band invitations.' USING ERRCODE = '42501';
  END IF;

  IF EXISTS (SELECT 1 FROM public.band_members bm WHERE bm.band_id = target_band_id AND bm.user_id = invited_user_id) THEN
    RAISE EXCEPTION 'That player already belongs to this band.' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO existing_invite
  FROM public.band_invitations bi
  WHERE bi.band_id = target_band_id AND bi.invited_user_id = invited_user_id AND bi.status = 'pending'
  ORDER BY bi.created_at DESC LIMIT 1;
  IF existing_invite.id IS NOT NULL THEN RETURN existing_invite; END IF;

  INSERT INTO public.band_invitations (band_id, inviter_user_id, invited_user_id, instrument_role, vocal_role, message, status)
  VALUES (target_band_id, auth.uid(), invited_user_id, normalized_instrument, normalized_vocal, trimmed_message, 'pending')
  RETURNING * INTO invite_row;

  INSERT INTO public.notifications(user_id, profile_id, category, type, title, message, action_path, metadata)
  SELECT invited_user_id, target_profile_id, 'band', 'band_request', 'New band invitation', 'A band invited you to join.', '/band-manager',
    jsonb_build_object('band_invitation_id', invite_row.id, 'band_id', target_band_id, 'inviter_profile_id', inviter_profile_id)
  WHERE NOT EXISTS (
    SELECT 1 FROM public.notifications n
    WHERE n.user_id = invited_user_id
      AND n.type = 'band_request'
      AND n.metadata->>'band_invitation_id' = invite_row.id::text
  );

  RETURN invite_row;
END;
$$;

GRANT EXECUTE ON FUNCTION public.send_band_invitation(uuid, uuid, text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_manage_band_invitations(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_receive_band_invitation(uuid, uuid) TO authenticated;
