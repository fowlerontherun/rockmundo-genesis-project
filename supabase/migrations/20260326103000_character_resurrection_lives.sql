-- Add resurrection lives and helper function for reviving dead characters

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS resurrection_lives integer NOT NULL DEFAULT 3;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'profiles_resurrection_lives_range'
  ) THEN
    ALTER TABLE public.profiles
      ADD CONSTRAINT profiles_resurrection_lives_range CHECK (resurrection_lives BETWEEN 0 AND 3);
  END IF;
END;
$$;

ALTER TABLE public.hall_of_immortals
  ADD COLUMN IF NOT EXISTS lives_remaining_at_death integer NOT NULL DEFAULT 0;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'hall_of_immortals_lives_remaining_at_death_range'
  ) THEN
    ALTER TABLE public.hall_of_immortals
      ADD CONSTRAINT hall_of_immortals_lives_remaining_at_death_range CHECK (lives_remaining_at_death BETWEEN 0 AND 3);
  END IF;
END;
$$;

-- Backfill existing immortal entries with the profile's current lives where available.
UPDATE public.hall_of_immortals h
SET lives_remaining_at_death = COALESCE(p.resurrection_lives, 3)
FROM public.profiles p
WHERE p.id = h.profile_id
  AND h.lives_remaining_at_death = 0;

CREATE OR REPLACE FUNCTION public.resurrect_character(p_profile_id uuid)
RETURNS public.profiles
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_user_id uuid := auth.uid();
  target_profile public.profiles%ROWTYPE;
BEGIN
  IF current_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE = '42501';
  END IF;

  SELECT *
  INTO target_profile
  FROM public.profiles
  WHERE id = p_profile_id
    AND user_id = current_user_id
  LIMIT 1;

  IF target_profile.id IS NULL THEN
    RAISE EXCEPTION 'Character not found';
  END IF;

  IF target_profile.died_at IS NULL THEN
    RAISE EXCEPTION 'Character is already alive';
  END IF;

  IF COALESCE(target_profile.resurrection_lives, 0) <= 0 THEN
    RAISE EXCEPTION 'No resurrection lives remaining';
  END IF;

  UPDATE public.profiles
  SET is_active = false
  WHERE user_id = current_user_id
    AND is_active = true
    AND id <> p_profile_id;

  UPDATE public.profiles
  SET
    died_at = NULL,
    death_cause = NULL,
    health = GREATEST(COALESCE(health, 0), 50),
    energy = GREATEST(COALESCE(energy, 0), 50),
    is_active = true,
    resurrection_lives = GREATEST(COALESCE(resurrection_lives, 0) - 1, 0),
    last_login_at = now()
  WHERE id = p_profile_id
    AND user_id = current_user_id
  RETURNING * INTO target_profile;

  RETURN target_profile;
END;
$$;

GRANT EXECUTE ON FUNCTION public.resurrect_character(uuid) TO authenticated;
