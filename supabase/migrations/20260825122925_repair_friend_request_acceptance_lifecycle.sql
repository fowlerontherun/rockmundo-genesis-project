CREATE OR REPLACE FUNCTION public.send_friend_request(target_profile_id uuid)
RETURNS public.friendships
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_me uuid := public.current_profile_id();
  v_row public.friendships;
BEGIN
  IF v_me IS NULL THEN
    RAISE EXCEPTION 'No active character';
  END IF;
  IF target_profile_id IS NULL THEN
    RAISE EXCEPTION 'Choose a player to add as a friend.';
  END IF;
  IF v_me = target_profile_id THEN
    RAISE EXCEPTION 'You cannot add yourself';
  END IF;
  IF public.are_profiles_blocked(v_me, target_profile_id) THEN
    RAISE EXCEPTION 'This player is unavailable';
  END IF;

  SELECT * INTO v_row
  FROM public.friendships
  WHERE (requestor_id = v_me AND addressee_id = target_profile_id)
     OR (requestor_id = target_profile_id AND addressee_id = v_me)
  FOR UPDATE
  LIMIT 1;

  IF v_row.id IS NOT NULL THEN
    IF v_row.status = 'accepted'::public.friendship_status THEN
      RETURN v_row;
    END IF;

    IF v_row.status = 'pending'::public.friendship_status THEN
      -- Clicking Add Friend in response to an incoming request is equivalent to accepting it.
      IF v_row.addressee_id = v_me THEN
        UPDATE public.friendships
        SET status = 'accepted'::public.friendship_status,
            responded_at = now(),
            updated_at = now()
        WHERE id = v_row.id
        RETURNING * INTO v_row;
      END IF;
      RETURN v_row;
    END IF;

    UPDATE public.friendships
    SET status = 'pending'::public.friendship_status,
        requestor_id = v_me,
        addressee_id = target_profile_id,
        responded_at = NULL,
        updated_at = now()
    WHERE id = v_row.id
    RETURNING * INTO v_row;
    RETURN v_row;
  END IF;

  INSERT INTO public.friendships (requestor_id, addressee_id, status)
  VALUES (v_me, target_profile_id, 'pending'::public.friendship_status)
  RETURNING * INTO v_row;
  RETURN v_row;
END;
$$;

CREATE OR REPLACE FUNCTION public.respond_to_friend_request(friendship_id uuid, next_status text)
RETURNS public.friendships
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_me uuid := public.current_profile_id();
  v_row public.friendships;
  v_status public.friendship_status;
BEGIN
  IF v_me IS NULL THEN
    RAISE EXCEPTION 'No active character';
  END IF;

  SELECT * INTO v_row
  FROM public.friendships
  WHERE id = friendship_id
  FOR UPDATE;

  IF v_row.id IS NULL THEN
    RAISE EXCEPTION 'Request not found';
  END IF;
  IF v_row.status <> 'pending'::public.friendship_status THEN
    RAISE EXCEPTION 'Friend request is no longer pending';
  END IF;
  IF v_row.addressee_id <> v_me THEN
    RAISE EXCEPTION 'Only the recipient can respond to this request';
  END IF;

  IF lower(next_status) = 'accepted' THEN
    v_status := 'accepted'::public.friendship_status;
  ELSIF lower(next_status) = 'declined' THEN
    v_status := 'declined'::public.friendship_status;
  ELSE
    RAISE EXCEPTION 'Unsupported friend request response';
  END IF;

  UPDATE public.friendships
  SET status = v_status,
      responded_at = now(),
      updated_at = now()
  WHERE id = friendship_id
  RETURNING * INTO v_row;

  RETURN v_row;
END;
$$;

REVOKE ALL ON FUNCTION public.send_friend_request(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.respond_to_friend_request(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.send_friend_request(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.respond_to_friend_request(uuid, text) TO authenticated;
