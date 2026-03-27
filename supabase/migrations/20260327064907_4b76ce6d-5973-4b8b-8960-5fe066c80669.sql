-- Add resurrection_lives to profiles (default 3 for new characters)
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS resurrection_lives integer NOT NULL DEFAULT 3;

-- Add lives_remaining_at_death to hall_of_immortals
ALTER TABLE public.hall_of_immortals ADD COLUMN IF NOT EXISTS lives_remaining_at_death integer NOT NULL DEFAULT 0;

-- Create resurrect_character RPC
CREATE OR REPLACE FUNCTION public.resurrect_character(p_profile_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
  v_died_at timestamptz;
  v_lives int;
BEGIN
  SELECT user_id, died_at, resurrection_lives
  INTO v_user_id, v_died_at, v_lives
  FROM profiles
  WHERE id = p_profile_id;

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Profile not found';
  END IF;

  IF v_user_id != auth.uid() THEN
    RAISE EXCEPTION 'Not your profile';
  END IF;

  IF v_died_at IS NULL THEN
    RAISE EXCEPTION 'Character is not dead';
  END IF;

  IF v_lives <= 0 THEN
    RAISE EXCEPTION 'No resurrection lives remaining';
  END IF;

  UPDATE profiles
  SET is_active = false
  WHERE user_id = v_user_id AND id != p_profile_id;

  UPDATE profiles
  SET died_at = NULL,
      is_active = true,
      health = 50,
      energy = 50,
      resurrection_lives = resurrection_lives - 1
  WHERE id = p_profile_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.resurrect_character(uuid) TO authenticated;