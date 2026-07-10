BEGIN;

CREATE OR REPLACE VIEW public.public_safe_profiles AS
SELECT
  p.id AS profile_id,
  p.user_id,
  p.username,
  p.display_name,
  p.avatar_url,
  p.bio,
  COALESCE(p.fame, 0) AS fame,
  COALESCE(p.fans, 0) AS fans,
  COALESCE(p.level, 1) AS level,
  CASE
    WHEN COALESCE(pps.city_visibility, 'friends'::public.profile_visibility_scope) = 'public'::public.profile_visibility_scope
      THEN c.name
    ELSE NULL
  END AS city_name,
  COALESCE(pps.profile_visibility, 'public'::public.profile_visibility_scope) AS profile_visibility,
  COALESCE(pps.city_visibility, 'friends'::public.profile_visibility_scope) AS city_visibility
FROM public.profiles p
LEFT JOIN public.profile_privacy_settings pps ON pps.profile_id = p.id
LEFT JOIN public.cities c ON c.id = p.current_city_id;

COMMENT ON VIEW public.public_safe_profiles IS 'Public-safe profile/search projection for discovery surfaces. Excludes private gameplay state and hides city unless explicitly public.';

GRANT SELECT ON public.public_safe_profiles TO authenticated;

CREATE OR REPLACE FUNCTION public.can_view_public_profile_summary(viewer_profile_id uuid, target_profile_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH target_settings AS (
    SELECT COALESCE(
      (SELECT pps.profile_visibility FROM public.profile_privacy_settings pps WHERE pps.profile_id = target_profile_id),
      'public'::public.profile_visibility_scope
    ) AS profile_visibility
  )
  SELECT
    target_profile_id IS NOT NULL
    AND EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = target_profile_id)
    AND (
      viewer_profile_id IS NULL
      OR viewer_profile_id = target_profile_id
      OR NOT public.are_profiles_blocked(viewer_profile_id, target_profile_id)
    )
    AND (
      (SELECT profile_visibility FROM target_settings) = 'public'::public.profile_visibility_scope
      OR viewer_profile_id = target_profile_id
      OR (
        (SELECT profile_visibility FROM target_settings) = 'friends'::public.profile_visibility_scope
        AND EXISTS (
          SELECT 1
          FROM public.friendships f
          WHERE f.status = 'accepted'::public.friendship_status
            AND (
              (f.requestor_id = viewer_profile_id AND f.addressee_id = target_profile_id)
              OR (f.requestor_id = target_profile_id AND f.addressee_id = viewer_profile_id)
            )
        )
      )
    );
$$;

GRANT EXECUTE ON FUNCTION public.can_view_public_profile_summary(uuid, uuid) TO authenticated;

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
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  normalized_limit integer := LEAST(GREATEST(COALESCE(result_limit, 20), 1), 50);
  normalized_term text := NULLIF(BTRIM(COALESCE(search_term, '')), '');
  actor_profile_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required to search player profiles'
      USING ERRCODE = '42501';
  END IF;

  IF normalized_term IS NULL OR length(normalized_term) < 2 THEN
    RAISE EXCEPTION 'Enter at least 2 characters to search player profiles'
      USING ERRCODE = '22023';
  END IF;

  SELECT p.id INTO actor_profile_id
  FROM public.profiles p
  WHERE p.user_id = auth.uid()
    AND (viewer_profile_id IS NULL OR p.id = viewer_profile_id)
  ORDER BY p.created_at ASC
  LIMIT 1;

  IF actor_profile_id IS NULL THEN
    RAISE EXCEPTION 'Sign in with an active player profile before searching player profiles'
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
    COALESCE(
      (
        SELECT jsonb_agg(jsonb_build_object('name', b.name, 'genre', b.genre) ORDER BY b.name)
        FROM public.band_members bm
        JOIN public.bands b ON b.id = bm.band_id
        WHERE bm.user_id = psp.user_id
      ),
      '[]'::jsonb
    ) AS bands
  FROM public.public_safe_profiles psp
  WHERE
    public.can_view_public_profile_summary(actor_profile_id, psp.profile_id)
    AND (
      psp.username ILIKE '%' || normalized_term || '%'
      OR COALESCE(psp.display_name, '') ILIKE '%' || normalized_term || '%'
    )
  ORDER BY
    psp.display_name NULLS LAST,
    psp.username
  LIMIT normalized_limit;
END;
$$;

GRANT EXECUTE ON FUNCTION public.search_public_profiles(text, uuid, integer) TO authenticated;

COMMIT;
