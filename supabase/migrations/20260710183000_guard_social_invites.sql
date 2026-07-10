ALTER TYPE public.social_action_audit_kind ADD VALUE IF NOT EXISTS 'social_invite_send_denied';
ALTER TYPE public.social_action_audit_kind ADD VALUE IF NOT EXISTS 'social_invite_response_denied';

ALTER TABLE public.social_invites
  ADD CONSTRAINT social_invites_message_length CHECK (message IS NULL OR char_length(btrim(message)) BETWEEN 1 AND 280);

CREATE INDEX IF NOT EXISTS social_invites_active_pair_kind_idx
  ON public.social_invites (from_profile_id, to_profile_id, kind, status, created_at DESC);

CREATE OR REPLACE FUNCTION public.can_send_social_invite(
  sender_profile_id uuid,
  recipient_profile_id uuid
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT sender_profile_id IS NOT NULL
    AND recipient_profile_id IS NOT NULL
    AND sender_profile_id <> recipient_profile_id
    AND EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = sender_profile_id)
    AND EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = recipient_profile_id)
    AND NOT public.are_profiles_blocked(sender_profile_id, recipient_profile_id);
$$;

CREATE OR REPLACE FUNCTION public.send_social_invite(
  target_profile_id uuid,
  invite_kind public.social_invite_kind,
  scheduled_for timestamptz DEFAULT NULL,
  invite_message text DEFAULT NULL,
  invite_ref_id uuid DEFAULT NULL,
  invite_location_city_id uuid DEFAULT NULL
)
RETURNS public.social_invites
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  sender_profile_id uuid;
  recipient_user_id uuid;
  trimmed_message text;
  existing_invite public.social_invites;
  invite_row public.social_invites;
BEGIN
  SELECT p.id INTO sender_profile_id
  FROM public.profiles p
  WHERE p.user_id = auth.uid()
  ORDER BY p.created_at ASC
  LIMIT 1;

  IF sender_profile_id IS NULL THEN
    RAISE EXCEPTION 'Sign in with an active player profile before sending invites.' USING ERRCODE = '28000';
  END IF;
  IF target_profile_id IS NULL THEN
    RAISE EXCEPTION 'Choose a player to invite.' USING ERRCODE = '22023';
  END IF;
  IF invite_kind IS NULL THEN
    RAISE EXCEPTION 'Choose an invite type.' USING ERRCODE = '22023';
  END IF;
  IF sender_profile_id = target_profile_id THEN
    RAISE EXCEPTION 'You cannot invite yourself.' USING ERRCODE = '22023';
  END IF;
  IF scheduled_for IS NOT NULL AND scheduled_for < timezone('utc', now()) - interval '5 minutes' THEN
    RAISE EXCEPTION 'Choose a future time for this invite.' USING ERRCODE = '22023';
  END IF;

  trimmed_message := NULLIF(btrim(COALESCE(invite_message, '')), '');
  IF trimmed_message IS NOT NULL AND char_length(trimmed_message) > 280 THEN
    RAISE EXCEPTION 'Invite messages must be 280 characters or fewer.' USING ERRCODE = '22023';
  END IF;

  SELECT p.user_id INTO recipient_user_id FROM public.profiles p WHERE p.id = target_profile_id;
  IF recipient_user_id IS NULL THEN
    RAISE EXCEPTION 'That player could not be found.' USING ERRCODE = '22023';
  END IF;

  IF NOT public.can_send_social_invite(sender_profile_id, target_profile_id) THEN
    INSERT INTO public.social_action_audit_log (actor_profile_id, target_profile_id, action, target_type, metadata)
    VALUES (sender_profile_id, target_profile_id, 'social_invite_send_denied'::public.social_action_audit_kind, 'social_invite', jsonb_build_object('reason', 'block_guard', 'kind', invite_kind));
    RAISE EXCEPTION 'This player is not available for invites.' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO existing_invite
  FROM public.social_invites i
  WHERE i.from_profile_id = sender_profile_id
    AND i.to_profile_id = target_profile_id
    AND i.kind = invite_kind
    AND i.status = 'pending'::public.social_invite_status
    AND (i.scheduled_at IS NULL OR i.scheduled_at > timezone('utc', now()) - interval '1 day')
  ORDER BY i.created_at DESC
  LIMIT 1;

  IF existing_invite.id IS NOT NULL THEN
    RETURN existing_invite;
  END IF;

  INSERT INTO public.social_invites (from_profile_id, to_profile_id, kind, ref_id, scheduled_at, location_city_id, message, status)
  VALUES (sender_profile_id, target_profile_id, invite_kind, invite_ref_id, scheduled_for, invite_location_city_id, trimmed_message, 'pending')
  RETURNING * INTO invite_row;

  INSERT INTO public.notifications(user_id, profile_id, category, type, title, message, action_path, metadata)
  SELECT recipient_user_id, target_profile_id, 'relationship', 'social_invite', 'New social invite', 'Another artist sent you an invite.', '/social?tab=invites',
    jsonb_build_object('social_invite_id', invite_row.id, 'from_profile_id', sender_profile_id, 'to_profile_id', target_profile_id, 'kind', invite_kind)
  WHERE NOT EXISTS (
    SELECT 1 FROM public.notifications n
    WHERE n.user_id = recipient_user_id
      AND n.type = 'social_invite'
      AND n.metadata->>'social_invite_id' = invite_row.id::text
  );

  RETURN invite_row;
END;
$$;

CREATE OR REPLACE FUNCTION public.respond_social_invite(
  invite_id uuid,
  next_status public.social_invite_status
)
RETURNS public.social_invites
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  actor_profile_id uuid;
  invite_row public.social_invites;
BEGIN
  SELECT p.id INTO actor_profile_id
  FROM public.profiles p
  WHERE p.user_id = auth.uid()
  ORDER BY p.created_at ASC
  LIMIT 1;

  IF actor_profile_id IS NULL THEN
    RAISE EXCEPTION 'Sign in with an active player profile before responding to invites.' USING ERRCODE = '28000';
  END IF;
  IF invite_id IS NULL THEN
    RAISE EXCEPTION 'Choose an invite to update.' USING ERRCODE = '22023';
  END IF;
  IF next_status NOT IN ('accepted'::public.social_invite_status, 'declined'::public.social_invite_status, 'cancelled'::public.social_invite_status) THEN
    RAISE EXCEPTION 'Choose accept, decline, or cancel for this invite.' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO invite_row FROM public.social_invites WHERE id = invite_id;
  IF invite_row.id IS NULL THEN
    RAISE EXCEPTION 'That invite could not be found.' USING ERRCODE = '22023';
  END IF;
  IF invite_row.status <> 'pending'::public.social_invite_status THEN
    RETURN invite_row;
  END IF;
  IF invite_row.scheduled_at IS NOT NULL AND invite_row.scheduled_at < timezone('utc', now()) THEN
    UPDATE public.social_invites SET status = 'expired'::public.social_invite_status, responded_at = timezone('utc', now()) WHERE id = invite_row.id RETURNING * INTO invite_row;
    RETURN invite_row;
  END IF;
  IF public.are_profiles_blocked(invite_row.from_profile_id, invite_row.to_profile_id) THEN
    INSERT INTO public.social_action_audit_log (actor_profile_id, target_profile_id, action, target_type, target_id, metadata)
    VALUES (actor_profile_id, CASE WHEN actor_profile_id = invite_row.from_profile_id THEN invite_row.to_profile_id ELSE invite_row.from_profile_id END, 'social_invite_response_denied'::public.social_action_audit_kind, 'social_invite', invite_row.id, jsonb_build_object('reason', 'block_guard'));
    RAISE EXCEPTION 'This invite can no longer be updated.' USING ERRCODE = '42501';
  END IF;
  IF next_status = 'cancelled'::public.social_invite_status AND actor_profile_id <> invite_row.from_profile_id THEN
    RAISE EXCEPTION 'Only the sender can cancel this invite.' USING ERRCODE = '42501';
  END IF;
  IF next_status IN ('accepted'::public.social_invite_status, 'declined'::public.social_invite_status) AND actor_profile_id <> invite_row.to_profile_id THEN
    RAISE EXCEPTION 'Only the recipient can accept or decline this invite.' USING ERRCODE = '42501';
  END IF;

  UPDATE public.social_invites SET status = next_status, responded_at = timezone('utc', now()) WHERE id = invite_row.id RETURNING * INTO invite_row;
  RETURN invite_row;
END;
$$;

GRANT EXECUTE ON FUNCTION public.can_send_social_invite(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.send_social_invite(uuid, public.social_invite_kind, timestamptz, text, uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.respond_social_invite(uuid, public.social_invite_status) TO authenticated;

DROP POLICY IF EXISTS "Invite created by sender" ON public.social_invites;
CREATE POLICY "Invite created by guarded sender"
ON public.social_invites FOR INSERT
WITH CHECK (
  status = 'pending'::public.social_invite_status
  AND public.profile_belongs_to_current_user(from_profile_id)
  AND public.can_send_social_invite(from_profile_id, to_profile_id)
);

DROP POLICY IF EXISTS "Invite updated by either party" ON public.social_invites;
-- Direct client updates are intentionally not re-granted. Status changes go through respond_social_invite().
