CREATE OR REPLACE FUNCTION public.resurrect_character(p_profile_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_profile public.profiles%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT *
    INTO v_profile
    FROM public.profiles
   WHERE id = p_profile_id
   FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Profile not found';
  END IF;

  IF v_profile.user_id <> auth.uid() THEN
    RAISE EXCEPTION 'Not your profile';
  END IF;

  IF v_profile.died_at IS NULL THEN
    RAISE EXCEPTION 'Character is not in a coma';
  END IF;

  UPDATE public.profiles
     SET is_active = false,
         updated_at = now()
   WHERE user_id = v_profile.user_id
     AND id <> p_profile_id
     AND is_active = true;

  UPDATE public.profiles
     SET died_at = NULL,
         death_cause = NULL,
         is_active = true,
         health = 100,
         energy = 100,
         rest_required_until = NULL,
         resurrection_lives = GREATEST(COALESCE(resurrection_lives, 0), 3),
         last_login_at = now(),
         updated_at = now()
   WHERE id = p_profile_id;

  DELETE FROM public.hall_of_immortals
   WHERE profile_id = p_profile_id;
END;
$$;

REVOKE ALL ON FUNCTION public.resurrect_character(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.resurrect_character(uuid) TO authenticated, service_role;