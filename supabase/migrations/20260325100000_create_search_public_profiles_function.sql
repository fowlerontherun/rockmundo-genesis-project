-- Create a helper function for searching public profiles with email access
CREATE OR REPLACE FUNCTION public.search_public_profiles(
  search_term text,
  result_limit integer DEFAULT 20
)
RETURNS TABLE (
  profile_id uuid,
  user_id uuid,
  email text,
  username text,
  display_name text,
  avatar_url text,
  bio text,
  gender public.profile_gender,
  city_of_birth uuid,
  age integer
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  normalized_limit integer := LEAST(GREATEST(COALESCE(result_limit, 20), 1), 50);
  normalized_term text := NULLIF(COALESCE(search_term, ''), '');
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required to search player profiles'
      USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  SELECT
    p.id AS profile_id,
    p.user_id,
    u.email,
    p.username,
    p.display_name,
    p.avatar_url,
    p.bio,
    p.gender,
    p.city_of_birth,
    p.age
  FROM public.public_profiles AS p
  JOIN auth.users AS u ON u.id = p.user_id
  WHERE
    normalized_term IS NULL
    OR u.email ILIKE '%' || normalized_term || '%'
    OR p.username ILIKE '%' || normalized_term || '%'
    OR COALESCE(p.display_name, '') ILIKE '%' || normalized_term || '%'
  ORDER BY
    p.display_name NULLS LAST,
    p.username
  LIMIT normalized_limit;
END;
$$;

GRANT EXECUTE ON FUNCTION public.search_public_profiles(text, integer) TO authenticated;
