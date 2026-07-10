BEGIN;

CREATE OR REPLACE FUNCTION public.get_public_profile_detail(
  target_profile_id uuid,
  viewer_profile_id uuid DEFAULT NULL
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
  created_at timestamptz,
  bands jsonb
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  actor_profile_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required to view player profiles'
      USING ERRCODE = '42501';
  END IF;

  IF target_profile_id IS NULL THEN
    RAISE EXCEPTION 'A target player profile is required'
      USING ERRCODE = '22023';
  END IF;

  SELECT p.id INTO actor_profile_id
  FROM public.profiles p
  WHERE p.user_id = auth.uid()
    AND (viewer_profile_id IS NULL OR p.id = viewer_profile_id)
  ORDER BY p.created_at ASC
  LIMIT 1;

  IF actor_profile_id IS NULL THEN
    RAISE EXCEPTION 'Sign in with an active player profile before viewing player profiles'
      USING ERRCODE = '42501';
  END IF;

  IF NOT public.can_view_public_profile_summary(actor_profile_id, target_profile_id) THEN
    RAISE EXCEPTION 'Player profile is not available to this account'
      USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  SELECT
    psp.profile_id,
    psp.user_id,
    psp.username::text,
    psp.display_name::text,
    psp.avatar_url::text,
    psp.bio::text,
    psp.fame,
    psp.fans,
    psp.level,
    psp.city_name::text,
    p.created_at,
    COALESCE(
      (
        SELECT jsonb_agg(
          jsonb_build_object(
            'id', b.id,
            'name', b.name,
            'genre', b.genre,
            'fame', COALESCE(b.fame, 0),
            'chemistry_level', COALESCE(b.chemistry_level, 0),
            'role', bm.role,
            'instrument_role', bm.instrument_role,
            'vocal_role', bm.vocal_role,
            'joined_at', bm.joined_at
          )
          ORDER BY b.name
        )
        FROM public.band_members bm
        JOIN public.bands b ON b.id = bm.band_id
        WHERE bm.user_id = psp.user_id
      ),
      '[]'::jsonb
    ) AS bands
  FROM public.public_safe_profiles psp
  JOIN public.profiles p ON p.id = psp.profile_id
  WHERE psp.profile_id = target_profile_id
  LIMIT 1;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_public_profile_detail(uuid, uuid) TO authenticated;

COMMIT;
