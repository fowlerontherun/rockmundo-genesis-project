ALTER TYPE public.social_action_audit_kind ADD VALUE IF NOT EXISTS 'band_invitation_response_denied';
ALTER TYPE public.social_action_audit_kind ADD VALUE IF NOT EXISTS 'band_invitation_cancel_denied';

CREATE INDEX IF NOT EXISTS band_members_profile_band_idx
  ON public.band_members (profile_id, band_id)
  WHERE profile_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.respond_band_invitation(
  invitation_id uuid,
  response_status text
)
RETURNS public.band_invitations
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  actor_profile_id uuid;
  invitation_row public.band_invitations;
  normalized_status text;
  member_id uuid;
BEGIN
  SELECT p.id INTO actor_profile_id
  FROM public.profiles p
  WHERE p.user_id = auth.uid()
  ORDER BY p.created_at ASC
  LIMIT 1;

  IF actor_profile_id IS NULL THEN
    RAISE EXCEPTION 'Sign in with an active player profile before responding to band invitations.' USING ERRCODE = '28000';
  END IF;
  IF invitation_id IS NULL THEN
    RAISE EXCEPTION 'Choose a valid band invitation.' USING ERRCODE = '22023';
  END IF;
  normalized_status := lower(btrim(COALESCE(response_status, '')));
  IF normalized_status NOT IN ('accepted', 'declined') THEN
    RAISE EXCEPTION 'Choose accept or decline for this band invitation.' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO invitation_row
  FROM public.band_invitations bi
  WHERE bi.id = invitation_id
  FOR UPDATE;

  IF invitation_row.id IS NULL THEN
    RAISE EXCEPTION 'That band invitation could not be found.' USING ERRCODE = '22023';
  END IF;
  IF invitation_row.invited_user_id <> auth.uid() THEN
    INSERT INTO public.social_action_audit_log (actor_profile_id, target_profile_id, action, target_type, target_id, metadata)
    VALUES (actor_profile_id, NULL, 'band_invitation_response_denied'::public.social_action_audit_kind, 'band_invitation', invitation_id, jsonb_build_object('reason', 'not_invitee'));
    RAISE EXCEPTION 'You are not allowed to respond to this band invitation.' USING ERRCODE = '42501';
  END IF;

  IF invitation_row.status = normalized_status THEN
    RETURN invitation_row;
  END IF;
  IF invitation_row.status <> 'pending' THEN
    RAISE EXCEPTION 'This band invitation is no longer pending.' USING ERRCODE = '22023';
  END IF;

  IF public.are_profiles_blocked((SELECT p.id FROM public.profiles p WHERE p.user_id = invitation_row.inviter_user_id ORDER BY p.created_at ASC LIMIT 1), actor_profile_id) THEN
    INSERT INTO public.social_action_audit_log (actor_profile_id, target_profile_id, action, target_type, target_id, metadata)
    VALUES (actor_profile_id, NULL, 'band_invitation_response_denied'::public.social_action_audit_kind, 'band_invitation', invitation_id, jsonb_build_object('reason', 'block_guard'));
    RAISE EXCEPTION 'This invitation cannot be completed because one of you has blocked the other.' USING ERRCODE = '42501';
  END IF;

  IF normalized_status = 'accepted' THEN
    SELECT bm.id INTO member_id
    FROM public.band_members bm
    WHERE bm.band_id = invitation_row.band_id AND bm.user_id = auth.uid()
    LIMIT 1;

    IF member_id IS NULL THEN
      INSERT INTO public.band_members (band_id, user_id, profile_id, role, instrument_role, vocal_role)
      VALUES (invitation_row.band_id, auth.uid(), actor_profile_id, 'member', invitation_row.instrument_role, invitation_row.vocal_role)
      ON CONFLICT (band_id, user_id) DO NOTHING
      RETURNING id INTO member_id;
    END IF;

    IF member_id IS NULL THEN
      SELECT bm.id INTO member_id FROM public.band_members bm WHERE bm.band_id = invitation_row.band_id AND bm.user_id = auth.uid() LIMIT 1;
    END IF;
    IF member_id IS NULL THEN
      RAISE EXCEPTION 'Band membership could not be created.' USING ERRCODE = '23505';
    END IF;
  END IF;

  UPDATE public.band_invitations
  SET status = normalized_status, responded_at = now()
  WHERE id = invitation_id
  RETURNING * INTO invitation_row;

  UPDATE public.notifications n
  SET read_at = COALESCE(n.read_at, now()),
      metadata = COALESCE(n.metadata, '{}'::jsonb) || jsonb_build_object('band_invitation_status', normalized_status)
  WHERE n.user_id = auth.uid()
    AND n.type = 'band_request'
    AND n.metadata->>'band_invitation_id' = invitation_id::text;

  RETURN invitation_row;
END;
$$;

CREATE OR REPLACE FUNCTION public.cancel_band_invitation(invitation_id uuid)
RETURNS public.band_invitations
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  actor_profile_id uuid;
  invitation_row public.band_invitations;
BEGIN
  SELECT p.id INTO actor_profile_id FROM public.profiles p WHERE p.user_id = auth.uid() ORDER BY p.created_at ASC LIMIT 1;
  IF actor_profile_id IS NULL THEN
    RAISE EXCEPTION 'Sign in with an active player profile before cancelling band invitations.' USING ERRCODE = '28000';
  END IF;
  SELECT * INTO invitation_row FROM public.band_invitations bi WHERE bi.id = invitation_id FOR UPDATE;
  IF invitation_row.id IS NULL THEN
    RAISE EXCEPTION 'That band invitation could not be found.' USING ERRCODE = '22023';
  END IF;
  IF NOT public.can_manage_band_invitations(invitation_row.band_id, auth.uid()) THEN
    INSERT INTO public.social_action_audit_log (actor_profile_id, target_profile_id, action, target_type, target_id, metadata)
    VALUES (actor_profile_id, NULL, 'band_invitation_cancel_denied'::public.social_action_audit_kind, 'band_invitation', invitation_id, jsonb_build_object('reason', 'unauthorised_band_role'));
    RAISE EXCEPTION 'You are not allowed to cancel this band invitation.' USING ERRCODE = '42501';
  END IF;
  IF invitation_row.status = 'cancelled' THEN RETURN invitation_row; END IF;
  IF invitation_row.status <> 'pending' THEN
    RAISE EXCEPTION 'Only pending band invitations can be cancelled.' USING ERRCODE = '22023';
  END IF;
  UPDATE public.band_invitations SET status = 'cancelled', responded_at = now() WHERE id = invitation_id RETURNING * INTO invitation_row;
  UPDATE public.notifications n
  SET read_at = COALESCE(n.read_at, now()), metadata = COALESCE(n.metadata, '{}'::jsonb) || jsonb_build_object('band_invitation_status', 'cancelled')
  WHERE n.type = 'band_request' AND n.metadata->>'band_invitation_id' = invitation_id::text;
  RETURN invitation_row;
END;
$$;

GRANT EXECUTE ON FUNCTION public.respond_band_invitation(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.cancel_band_invitation(uuid) TO authenticated;

DROP POLICY IF EXISTS "Invited users can respond to invitations" ON public.band_invitations;
DROP POLICY IF EXISTS "Band leaders can cancel invitations" ON public.band_invitations;
DROP POLICY IF EXISTS "Band leaders can update invitations" ON public.band_invitations;
DROP POLICY IF EXISTS "Invitees can accept invitations" ON public.band_invitations;

CREATE POLICY "Band invitation responses use guarded RPC"
ON public.band_invitations FOR UPDATE
USING (false)
WITH CHECK (false);
