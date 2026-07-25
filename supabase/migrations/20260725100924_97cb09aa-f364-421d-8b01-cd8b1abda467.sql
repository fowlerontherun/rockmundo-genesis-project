
-- Coma / revive system: replace one-shot resurrection with unlimited free revive
CREATE OR REPLACE FUNCTION public.resurrect_character(p_profile_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
  v_died_at timestamptz;
BEGIN
  SELECT user_id, died_at
  INTO v_user_id, v_died_at
  FROM public.profiles
  WHERE id = p_profile_id;

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Profile not found';
  END IF;

  IF v_user_id != auth.uid() THEN
    RAISE EXCEPTION 'Not your profile';
  END IF;

  IF v_died_at IS NULL THEN
    RAISE EXCEPTION 'Character is not in a coma';
  END IF;

  -- Deactivate the current active profile (if any)
  UPDATE public.profiles
  SET is_active = false
  WHERE user_id = v_user_id AND id != p_profile_id;

  -- Revive: clear coma state, restore vitals fully, refund a resurrection life
  -- (kept for backwards-compat with any UI that still reads the counter).
  UPDATE public.profiles
  SET died_at = NULL,
      is_active = true,
      health = 100,
      energy = 100,
      rest_required_until = NULL,
      resurrection_lives = GREATEST(COALESCE(resurrection_lives, 0), 3),
      last_login_at = now(),
      updated_at = now()
  WHERE id = p_profile_id;

  -- Remove any memorial entry so the character no longer appears as gone
  DELETE FROM public.hall_of_immortals WHERE profile_id = p_profile_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.resurrect_character(uuid) TO authenticated;

-- Convenience alias with the new naming
CREATE OR REPLACE FUNCTION public.revive_character(p_profile_id uuid)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.resurrect_character(p_profile_id);
$$;

GRANT EXECUTE ON FUNCTION public.revive_character(uuid) TO authenticated;
