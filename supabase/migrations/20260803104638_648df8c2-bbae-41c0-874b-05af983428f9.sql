ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS deleted_at timestamptz;

CREATE OR REPLACE FUNCTION public.switch_active_character(p_profile_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_user uuid := auth.uid();
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = p_profile_id AND user_id = v_user AND deleted_at IS NULL
  ) THEN
    RAISE EXCEPTION 'Character not found';
  END IF;

  UPDATE public.profiles
     SET is_active = false
   WHERE user_id = v_user
     AND id <> p_profile_id
     AND is_active = true;

  UPDATE public.profiles
     SET is_active = true,
         last_login_at = now()
   WHERE id = p_profile_id
     AND user_id = v_user;
END;
$$;

REVOKE ALL ON FUNCTION public.switch_active_character(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.switch_active_character(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.delete_character_profile(p_profile_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_active boolean;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT is_active INTO v_active
    FROM public.profiles
   WHERE id = p_profile_id AND user_id = v_user AND deleted_at IS NULL;

  IF v_active IS NULL THEN
    RAISE EXCEPTION 'Character not found';
  END IF;

  IF v_active THEN
    RAISE EXCEPTION 'Cannot delete your active character. Switch to another character first.';
  END IF;

  UPDATE public.profiles
     SET deleted_at = now(),
         is_active = false,
         died_at = COALESCE(died_at, now()),
         death_cause = 'Deleted by player'
   WHERE id = p_profile_id
     AND user_id = v_user;
END;
$$;

REVOKE ALL ON FUNCTION public.delete_character_profile(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.delete_character_profile(uuid) TO authenticated;