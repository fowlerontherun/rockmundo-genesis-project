CREATE OR REPLACE FUNCTION public.search_public_profiles(search_term text, viewer_profile_id uuid DEFAULT NULL::uuid, result_limit integer DEFAULT 20)
RETURNS TABLE(profile_id uuid, user_id uuid, username text, display_name text, avatar_url text, bio text, fame integer, fans integer, level integer, city_name text, bands jsonb)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
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
   WHERE (coalesce(p.is_active, true) OR p.user_id = auth.uid())
     AND p.deleted_at IS NULL
     AND p.died_at IS NULL
     AND (viewer_profile_id IS NULL OR p.id <> viewer_profile_id)
     AND (viewer_profile_id IS NULL OR NOT public._social_blocked(viewer_profile_id, p.id))
     AND (
       p.username ILIKE '%' || search_term || '%'
       OR p.display_name ILIKE '%' || search_term || '%'
       OR p.bio ILIKE '%' || search_term || '%'
     )
   ORDER BY CASE WHEN p.user_id = auth.uid() THEN 0 ELSE 1 END,
            coalesce(p.fame, 0) DESC,
            p.username ASC
   LIMIT greatest(1, least(coalesce(result_limit, 20), 50));
$function$;

CREATE OR REPLACE FUNCTION public.cancel_friend_request(friendship_id uuid, requestor_profile_id uuid DEFAULT NULL::uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_row public.friendships;
  v_me uuid := COALESCE(requestor_profile_id, public.current_profile_id());
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF v_me IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = v_me AND p.user_id = auth.uid() AND p.died_at IS NULL
  ) THEN
    RAISE EXCEPTION 'No active character';
  END IF;

  SELECT * INTO v_row
  FROM public.friendships
  WHERE id = friendship_id
  FOR UPDATE;

  IF v_row.id IS NULL THEN
    RAISE EXCEPTION 'Friend request not found';
  END IF;

  IF v_row.status <> 'pending'::public.friendship_status THEN
    RAISE EXCEPTION 'Friend request is no longer pending';
  END IF;

  IF v_row.requestor_id <> v_me THEN
    RAISE EXCEPTION 'Only the sender can withdraw this request';
  END IF;

  DELETE FROM public.friendships WHERE id = friendship_id;
END;
$function$;

REVOKE ALL ON FUNCTION public.cancel_friend_request(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.cancel_friend_request(uuid, uuid) TO authenticated;
