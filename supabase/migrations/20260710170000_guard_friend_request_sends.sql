ALTER TYPE public.social_action_audit_kind ADD VALUE IF NOT EXISTS 'friend_request_send_denied';

CREATE OR REPLACE FUNCTION public.can_send_friend_request(
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

CREATE OR REPLACE FUNCTION public.send_friend_request(
  target_profile_id uuid
)
RETURNS public.friendships
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  sender_profile_id uuid;
  recipient_user_id uuid;
  existing_friendship public.friendships;
  new_friendship public.friendships;
  resend_after interval := interval '7 days';
BEGIN
  SELECT p.id
    INTO sender_profile_id
  FROM public.profiles p
  WHERE p.user_id = auth.uid()
  ORDER BY p.created_at ASC
  LIMIT 1;

  IF sender_profile_id IS NULL THEN
    RAISE EXCEPTION 'Sign in with an active player profile before sending friend requests.' USING ERRCODE = '28000';
  END IF;

  IF target_profile_id IS NULL THEN
    RAISE EXCEPTION 'Choose a player to add as a friend.' USING ERRCODE = '22023';
  END IF;

  IF sender_profile_id = target_profile_id THEN
    RAISE EXCEPTION 'You cannot send a friend request to yourself.' USING ERRCODE = '22023';
  END IF;

  SELECT p.user_id
    INTO recipient_user_id
  FROM public.profiles p
  WHERE p.id = target_profile_id;

  IF recipient_user_id IS NULL THEN
    RAISE EXCEPTION 'That player could not be found.' USING ERRCODE = '22023';
  END IF;

  IF NOT public.can_send_friend_request(sender_profile_id, target_profile_id) THEN
    INSERT INTO public.social_action_audit_log (actor_profile_id, target_profile_id, action, target_type, metadata)
    VALUES (
      sender_profile_id,
      target_profile_id,
      'friend_request_send_denied'::public.social_action_audit_kind,
      'profile',
      jsonb_build_object('reason', 'block_guard')
    );

    RAISE EXCEPTION 'This player is not available for friend requests.' USING ERRCODE = '42501';
  END IF;

  SELECT *
    INTO existing_friendship
  FROM public.friendships f
  WHERE (f.requestor_id = sender_profile_id AND f.addressee_id = target_profile_id)
     OR (f.requestor_id = target_profile_id AND f.addressee_id = sender_profile_id)
  LIMIT 1;

  IF existing_friendship.id IS NOT NULL THEN
    IF existing_friendship.status = 'pending'::public.friendship_status THEN
      RETURN existing_friendship;
    END IF;

    IF existing_friendship.status = 'accepted'::public.friendship_status THEN
      RAISE EXCEPTION 'You are already friends with this player.' USING ERRCODE = '23505';
    END IF;

    IF existing_friendship.status = 'blocked'::public.friendship_status THEN
      INSERT INTO public.social_action_audit_log (actor_profile_id, target_profile_id, action, target_type, metadata)
      VALUES (
        sender_profile_id,
        target_profile_id,
        'friend_request_send_denied'::public.social_action_audit_kind,
        'profile',
        jsonb_build_object('reason', 'legacy_blocked_friendship', 'friendship_id', existing_friendship.id)
      );
      RAISE EXCEPTION 'This player is not available for friend requests.' USING ERRCODE = '42501';
    END IF;

    IF existing_friendship.status = 'declined'::public.friendship_status
       AND existing_friendship.responded_at IS NOT NULL
       AND existing_friendship.responded_at > timezone('utc', now()) - resend_after THEN
      RAISE EXCEPTION 'That friend request was declined recently. Please wait before trying again.' USING ERRCODE = '42901';
    END IF;

    UPDATE public.friendships
       SET requestor_id = sender_profile_id,
           addressee_id = target_profile_id,
           status = 'pending'::public.friendship_status,
           responded_at = NULL,
           updated_at = timezone('utc', now())
     WHERE id = existing_friendship.id
     RETURNING * INTO new_friendship;
  ELSE
    INSERT INTO public.friendships (requestor_id, addressee_id, status)
    VALUES (sender_profile_id, target_profile_id, 'pending'::public.friendship_status)
    RETURNING * INTO new_friendship;
  END IF;

  INSERT INTO public.notifications(user_id, profile_id, category, type, title, message, action_path, metadata)
  SELECT
    recipient_user_id,
    target_profile_id,
    'relationship',
    'friend_request',
    'New friend request',
    'Another artist wants to connect with you.',
    '/relationships',
    jsonb_build_object(
      'friendship_id', new_friendship.id,
      'requestor_profile_id', sender_profile_id,
      'addressee_profile_id', target_profile_id,
      'priority', 'normal'
    )
  WHERE NOT EXISTS (
    SELECT 1 FROM public.notifications n
    WHERE n.user_id = recipient_user_id
      AND n.type = 'friend_request'
      AND n.metadata->>'friendship_id' = new_friendship.id::text
  );

  RETURN new_friendship;
END;
$$;

GRANT EXECUTE ON FUNCTION public.can_send_friend_request(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.send_friend_request(uuid) TO authenticated;

DROP POLICY IF EXISTS "Requesters can create friendships" ON public.friendships;
CREATE POLICY "Requesters can create guarded pending friendships"
  ON public.friendships
  FOR INSERT
  WITH CHECK (
    status = 'pending'::public.friendship_status
    AND public.profile_belongs_to_current_user(requestor_id)
    AND public.can_send_friend_request(requestor_id, addressee_id)
  );
