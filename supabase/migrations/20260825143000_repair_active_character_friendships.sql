BEGIN;

-- Friendship and player discovery repair.
-- The social stack previously mixed an oldest-profile current_profile_id() with
-- UI-selected active characters and frontend RPC signatures that did not exist
-- in the live schema. Keep every social action character-scoped and allow users
-- to discover their other characters (while still excluding the active one).

CREATE OR REPLACE FUNCTION public.current_profile_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.id
  FROM public.profiles p
  WHERE p.user_id = auth.uid()
    AND COALESCE(p.is_active, true)
    AND p.deleted_at IS NULL
    AND p.died_at IS NULL
  ORDER BY p.updated_at DESC NULLS LAST, p.created_at DESC, p.id
  LIMIT 1
$$;

CREATE OR REPLACE FUNCTION public.get_connection_state(
  target_profile_id uuid,
  viewer_profile_id uuid
)
RETURNS text
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_friendship public.friendships%ROWTYPE;
  v_allow_mode text;
BEGIN
  IF auth.uid() IS NULL OR viewer_profile_id IS NULL OR target_profile_id IS NULL THEN
    RETURN 'unavailable';
  END IF;

  IF NOT public.profile_belongs_to_current_user(viewer_profile_id) THEN
    RETURN 'unavailable';
  END IF;

  IF viewer_profile_id = target_profile_id THEN
    RETURN 'self';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = target_profile_id AND p.deleted_at IS NULL
  ) THEN
    RETURN 'unavailable';
  END IF;

  IF public.are_profiles_blocked(viewer_profile_id, target_profile_id) THEN
    RETURN 'restricted';
  END IF;

  SELECT f.* INTO v_friendship
  FROM public.friendships f
  WHERE (f.requestor_id = viewer_profile_id AND f.addressee_id = target_profile_id)
     OR (f.requestor_id = target_profile_id AND f.addressee_id = viewer_profile_id)
  ORDER BY f.updated_at DESC NULLS LAST, f.created_at DESC
  LIMIT 1;

  IF v_friendship.status = 'accepted'::public.friendship_status THEN
    RETURN 'friends';
  END IF;
  IF v_friendship.status = 'pending'::public.friendship_status
     AND v_friendship.requestor_id = viewer_profile_id THEN
    RETURN 'outgoing_pending';
  END IF;
  IF v_friendship.status = 'pending'::public.friendship_status
     AND v_friendship.addressee_id = viewer_profile_id THEN
    RETURN 'incoming_pending';
  END IF;
  IF v_friendship.status::text = 'blocked' THEN
    RETURN 'restricted';
  END IF;

  SELECT COALESCE(fs.allow_friend_requests, 'everyone')
  INTO v_allow_mode
  FROM public.friendship_settings fs
  WHERE fs.profile_id = target_profile_id;

  IF COALESCE(v_allow_mode, 'everyone') = 'none' THEN
    RETURN 'restricted';
  END IF;

  RETURN 'not_connected';
END;
$$;

CREATE OR REPLACE FUNCTION public.get_friend_request_counts(profile_id uuid)
RETURNS TABLE(friends bigint, incoming bigint, outgoing bigint)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL OR profile_id IS NULL OR NOT public.profile_belongs_to_current_user(profile_id) THEN
    RAISE EXCEPTION 'Active player profile is not available.' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  SELECT
    COUNT(*) FILTER (WHERE f.status = 'accepted'::public.friendship_status),
    COUNT(*) FILTER (WHERE f.status = 'pending'::public.friendship_status AND f.addressee_id = profile_id),
    COUNT(*) FILTER (WHERE f.status = 'pending'::public.friendship_status AND f.requestor_id = profile_id)
  FROM public.friendships f
  WHERE profile_id IN (f.requestor_id, f.addressee_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.send_friend_request(
  target_profile_id uuid,
  requestor_profile_id uuid
)
RETURNS public.friendships
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row public.friendships%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL
     OR requestor_profile_id IS NULL
     OR NOT public.profile_belongs_to_current_user(requestor_profile_id) THEN
    RAISE EXCEPTION 'Sign in with an active player profile before sending friend requests.' USING ERRCODE = '42501';
  END IF;

  IF target_profile_id IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.profiles p WHERE p.id = target_profile_id AND p.deleted_at IS NULL
  ) THEN
    RAISE EXCEPTION 'That player could not be found.' USING ERRCODE = '22023';
  END IF;

  IF requestor_profile_id = target_profile_id THEN
    RAISE EXCEPTION 'You cannot send a friend request to yourself.' USING ERRCODE = '22023';
  END IF;

  IF public.are_profiles_blocked(requestor_profile_id, target_profile_id) THEN
    RAISE EXCEPTION 'This player is not available for friend requests.' USING ERRCODE = '42501';
  END IF;

  SELECT f.* INTO v_row
  FROM public.friendships f
  WHERE (f.requestor_id = requestor_profile_id AND f.addressee_id = target_profile_id)
     OR (f.requestor_id = target_profile_id AND f.addressee_id = requestor_profile_id)
  ORDER BY f.updated_at DESC NULLS LAST, f.created_at DESC
  LIMIT 1
  FOR UPDATE;

  IF v_row.id IS NOT NULL THEN
    IF v_row.status = 'accepted'::public.friendship_status THEN
      RAISE EXCEPTION 'You are already friends with this player.' USING ERRCODE = '22023';
    END IF;

    IF v_row.status = 'pending'::public.friendship_status THEN
      IF v_row.requestor_id = target_profile_id AND v_row.addressee_id = requestor_profile_id THEN
        UPDATE public.friendships
        SET status = 'accepted'::public.friendship_status,
            responded_at = now(),
            accepted_at = COALESCE(accepted_at, now()),
            updated_at = now()
        WHERE id = v_row.id
        RETURNING * INTO v_row;
      END IF;
      RETURN v_row;
    END IF;

    UPDATE public.friendships
    SET requestor_id = requestor_profile_id,
        addressee_id = target_profile_id,
        status = 'pending'::public.friendship_status,
        responded_at = NULL,
        accepted_at = NULL,
        declined_at = NULL,
        cancelled_at = NULL,
        removed_at = NULL,
        updated_at = now()
    WHERE id = v_row.id
    RETURNING * INTO v_row;

    RETURN v_row;
  END IF;

  INSERT INTO public.friendships (requestor_id, addressee_id, status)
  VALUES (requestor_profile_id, target_profile_id, 'pending'::public.friendship_status)
  RETURNING * INTO v_row;

  RETURN v_row;
END;
$$;

CREATE OR REPLACE FUNCTION public.respond_to_friend_request(
  friendship_id uuid,
  next_status text
)
RETURNS public.friendships
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_me uuid := public.current_profile_id();
  v_row public.friendships%ROWTYPE;
  v_next text := lower(trim(next_status));
BEGIN
  IF v_me IS NULL THEN
    RAISE EXCEPTION 'No active character.' USING ERRCODE = '42501';
  END IF;

  SELECT f.* INTO v_row FROM public.friendships f WHERE f.id = friendship_id FOR UPDATE;
  IF v_row.id IS NULL THEN
    RAISE EXCEPTION 'Friend request is no longer available.' USING ERRCODE = '22023';
  END IF;

  IF v_next = 'accepted' THEN
    IF v_row.status <> 'pending'::public.friendship_status OR v_row.addressee_id <> v_me THEN
      RAISE EXCEPTION 'You cannot accept this request.' USING ERRCODE = '42501';
    END IF;
    UPDATE public.friendships
    SET status = 'accepted'::public.friendship_status,
        responded_at = now(), accepted_at = now(), updated_at = now()
    WHERE id = friendship_id RETURNING * INTO v_row;
  ELSIF v_next = 'declined' THEN
    IF v_row.status <> 'pending'::public.friendship_status OR v_row.addressee_id <> v_me THEN
      RAISE EXCEPTION 'You cannot decline this request.' USING ERRCODE = '42501';
    END IF;
    UPDATE public.friendships
    SET status = 'declined'::public.friendship_status,
        responded_at = now(), declined_at = now(), updated_at = now()
    WHERE id = friendship_id RETURNING * INTO v_row;
  ELSIF v_next = 'cancelled' THEN
    IF v_row.status <> 'pending'::public.friendship_status OR v_row.requestor_id <> v_me THEN
      RAISE EXCEPTION 'You cannot cancel this request.' USING ERRCODE = '42501';
    END IF;
    UPDATE public.friendships
    SET status = 'cancelled'::public.friendship_status,
        responded_at = now(), cancelled_at = now(), updated_at = now()
    WHERE id = friendship_id RETURNING * INTO v_row;
  ELSIF v_next = 'removed' THEN
    IF v_row.status <> 'accepted'::public.friendship_status OR v_me NOT IN (v_row.requestor_id, v_row.addressee_id) THEN
      RAISE EXCEPTION 'You cannot remove this friendship.' USING ERRCODE = '42501';
    END IF;
    UPDATE public.friendships
    SET status = 'removed'::public.friendship_status,
        responded_at = now(), removed_at = now(), updated_at = now()
    WHERE id = friendship_id RETURNING * INTO v_row;
  ELSE
    RAISE EXCEPTION 'Unsupported friendship action.' USING ERRCODE = '22023';
  END IF;

  RETURN v_row;
END;
$$;

-- Do not hide a user's other characters merely because they are not the
-- currently selected character. Only the viewer's active profile is excluded.
CREATE OR REPLACE FUNCTION public.search_public_profiles(
  search_term text,
  viewer_profile_id uuid DEFAULT NULL,
  result_limit integer DEFAULT 20
)
RETURNS TABLE (
  profile_id uuid,
  user_id uuid,
  username text,
  display_name text,
  avatar_url text,
  bio text,
  fame integer,
  fans integer,
  level integer,
  city_name text,
  bands jsonb
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_limit integer := greatest(1, least(coalesce(result_limit, 20), 50));
  v_term text := btrim(coalesce(search_term, ''));
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required to search player profiles.' USING ERRCODE = '42501';
  END IF;

  IF viewer_profile_id IS NOT NULL AND NOT public.profile_belongs_to_current_user(viewer_profile_id) THEN
    RAISE EXCEPTION 'Active player profile is not available.' USING ERRCODE = '42501';
  END IF;

  IF length(v_term) < 2 THEN
    RAISE EXCEPTION 'Enter at least 2 characters to search player profiles.' USING ERRCODE = '22023';
  END IF;

  RETURN QUERY
  SELECT p.id,
         p.user_id,
         p.username::text,
         p.display_name::text,
         p.avatar_url,
         p.bio,
         coalesce(p.fame, 0),
         coalesce(p.fans, 0),
         coalesce(p.level, 1),
         c.name::text,
         coalesce((
           SELECT jsonb_agg(jsonb_build_object('name', b.name, 'genre', coalesce(b.primary_genre, b.genre)))
           FROM public.band_members bm
           JOIN public.bands b ON b.id = bm.band_id
           WHERE bm.profile_id = p.id
             AND coalesce(bm.member_status, 'active') = 'active'
         ), '[]'::jsonb)
  FROM public.profiles p
  LEFT JOIN public.cities c ON c.id = p.current_city_id
  WHERE p.deleted_at IS NULL
    AND p.died_at IS NULL
    AND (viewer_profile_id IS NULL OR p.id <> viewer_profile_id)
    AND (viewer_profile_id IS NULL OR NOT public._social_blocked(viewer_profile_id, p.id))
    AND (
      p.username ILIKE '%' || v_term || '%'
      OR coalesce(p.display_name, '') ILIKE '%' || v_term || '%'
      OR coalesce(p.bio, '') ILIKE '%' || v_term || '%'
    )
  ORDER BY coalesce(p.fame, 0) DESC, p.username ASC
  LIMIT v_limit;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_connection_state(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_friend_request_counts(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.send_friend_request(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.respond_to_friend_request(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.search_public_profiles(text, uuid, integer) TO authenticated;

COMMIT;
