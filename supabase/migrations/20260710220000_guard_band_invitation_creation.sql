ALTER TYPE public.social_action_audit_kind ADD VALUE IF NOT EXISTS 'band_invitation_send_denied';

ALTER TABLE public.band_invitations
  ADD CONSTRAINT band_invitations_message_length CHECK (message IS NULL OR char_length(btrim(message)) BETWEEN 1 AND 500) NOT VALID,
  ADD CONSTRAINT band_invitations_instrument_role_length CHECK (char_length(btrim(instrument_role)) BETWEEN 1 AND 50) NOT VALID,
  ADD CONSTRAINT band_invitations_vocal_role_length CHECK (vocal_role IS NULL OR char_length(btrim(vocal_role)) BETWEEN 1 AND 50) NOT VALID;

CREATE INDEX IF NOT EXISTS band_invitations_pending_target_idx
  ON public.band_invitations (band_id, invited_user_id, status, created_at DESC);

CREATE OR REPLACE FUNCTION public.can_manage_band_invitations(target_band_id uuid, actor_profile_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.bands b
    WHERE b.id = target_band_id
      AND b.leader_id = actor_profile_id
  ) OR EXISTS (
    SELECT 1
    FROM public.band_members bm
    WHERE bm.band_id = target_band_id
      AND bm.profile_id = actor_profile_id
      AND lower(COALESCE(bm.role, '')) IN ('leader', 'founder', 'manager', 'officer')
  );
$$;

CREATE OR REPLACE FUNCTION public.send_band_invitation(
  target_band_id uuid,
  target_profile_id uuid,
  invited_instrument_role text,
  invited_vocal_role text DEFAULT NULL,
  invite_message text DEFAULT NULL
)
RETURNS public.band_invitations
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  actor_profile_id uuid;
  actor_user_id uuid;
  target_user_id uuid;
  band_row public.bands;
  existing_invite public.band_invitations;
  invite_row public.band_invitations;
  trimmed_instrument text;
  trimmed_vocal text;
  trimmed_message text;
  allows_band_invites boolean;
BEGIN
  SELECT p.id, p.user_id INTO actor_profile_id, actor_user_id
  FROM public.profiles p
  WHERE p.user_id = auth.uid()
    AND COALESCE(p.is_active, true) = true
    AND p.died_at IS NULL
  ORDER BY p.created_at ASC
  LIMIT 1;

  IF actor_profile_id IS NULL THEN
    RAISE EXCEPTION 'Sign in with an active player profile before sending band invitations.' USING ERRCODE = '28000';
  END IF;

  IF target_band_id IS NULL THEN
    RAISE EXCEPTION 'Choose a band before sending an invitation.' USING ERRCODE = '22023';
  END IF;

  IF target_profile_id IS NULL OR target_profile_id = actor_profile_id THEN
    RAISE EXCEPTION 'Choose another player to invite.' USING ERRCODE = '22023';
  END IF;

  trimmed_instrument := NULLIF(btrim(COALESCE(invited_instrument_role, '')), '');
  trimmed_vocal := NULLIF(btrim(COALESCE(invited_vocal_role, '')), '');
  trimmed_message := NULLIF(btrim(COALESCE(invite_message, '')), '');

  IF trimmed_instrument IS NULL OR char_length(trimmed_instrument) > 50 THEN
    RAISE EXCEPTION 'Choose an instrument role that is 50 characters or fewer.' USING ERRCODE = '22023';
  END IF;

  IF trimmed_vocal IS NOT NULL AND char_length(trimmed_vocal) > 50 THEN
    RAISE EXCEPTION 'Choose a vocal role that is 50 characters or fewer.' USING ERRCODE = '22023';
  END IF;

  IF trimmed_message IS NOT NULL AND char_length(trimmed_message) > 500 THEN
    RAISE EXCEPTION 'Band invitation messages must be 500 characters or fewer.' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO band_row FROM public.bands WHERE id = target_band_id;
  IF band_row.id IS NULL THEN
    RAISE EXCEPTION 'That band could not be found.' USING ERRCODE = '22023';
  END IF;

  IF NOT public.can_manage_band_invitations(target_band_id, actor_profile_id) THEN
    INSERT INTO public.social_action_audit_log (actor_profile_id, target_profile_id, action, target_type, target_id, metadata)
    VALUES (actor_profile_id, target_profile_id, 'band_invitation_send_denied'::public.social_action_audit_kind, 'band', target_band_id, jsonb_build_object('reason', 'permission_denied'));
    RAISE EXCEPTION 'You do not have permission to invite members to this band.' USING ERRCODE = '42501';
  END IF;

  SELECT p.user_id INTO target_user_id
  FROM public.profiles p
  WHERE p.id = target_profile_id
    AND COALESCE(p.is_active, true) = true
    AND p.died_at IS NULL;

  IF target_user_id IS NULL THEN
    RAISE EXCEPTION 'That player could not be found.' USING ERRCODE = '22023';
  END IF;

  SELECT COALESCE(pps.allow_band_invites, true) INTO allows_band_invites
  FROM public.profile_privacy_settings pps
  WHERE pps.profile_id = target_profile_id;
  allows_band_invites := COALESCE(allows_band_invites, true);

  IF NOT allows_band_invites OR public.are_profiles_blocked(actor_profile_id, target_profile_id) THEN
    INSERT INTO public.social_action_audit_log (actor_profile_id, target_profile_id, action, target_type, target_id, metadata)
    VALUES (actor_profile_id, target_profile_id, 'band_invitation_send_denied'::public.social_action_audit_kind, 'band', target_band_id, jsonb_build_object('reason', CASE WHEN NOT allows_band_invites THEN 'privacy_opt_out' ELSE 'block_guard' END));
    RAISE EXCEPTION 'This player is not available for band invitations.' USING ERRCODE = '42501';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.band_members bm
    WHERE bm.band_id = target_band_id
      AND (bm.profile_id = target_profile_id OR bm.user_id = target_user_id)
  ) THEN
    RAISE EXCEPTION 'That player is already a member of this band.' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO existing_invite
  FROM public.band_invitations bi
  WHERE bi.band_id = target_band_id
    AND bi.invited_user_id = target_user_id
    AND bi.status = 'pending'
  ORDER BY bi.created_at DESC
  LIMIT 1;

  IF existing_invite.id IS NOT NULL THEN
    RETURN existing_invite;
  END IF;

  INSERT INTO public.band_invitations (band_id, inviter_user_id, invited_user_id, instrument_role, vocal_role, message, status)
  VALUES (target_band_id, actor_user_id, target_user_id, trimmed_instrument, trimmed_vocal, trimmed_message, 'pending')
  RETURNING * INTO invite_row;

  INSERT INTO public.notifications (user_id, profile_id, category, type, title, message, action_path, metadata)
  SELECT target_user_id, target_profile_id, 'relationship', 'band_invitation', 'New band invitation',
    'You have been invited to join ' || COALESCE(band_row.name, 'a band') || '.', '/band',
    jsonb_build_object('band_invitation_id', invite_row.id, 'band_id', target_band_id, 'inviter_profile_id', actor_profile_id)
  WHERE NOT EXISTS (
    SELECT 1 FROM public.notifications n
    WHERE n.user_id = target_user_id
      AND n.type = 'band_invitation'
      AND n.metadata->>'band_invitation_id' = invite_row.id::text
  );

  RETURN invite_row;
END;
$$;

GRANT EXECUTE ON FUNCTION public.can_manage_band_invitations(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.send_band_invitation(uuid, uuid, text, text, text) TO authenticated;

DROP POLICY IF EXISTS "Band leaders can create invitations" ON public.band_invitations;
CREATE POLICY "Band invitation creation uses guarded RPC"
ON public.band_invitations FOR INSERT
WITH CHECK (false);
