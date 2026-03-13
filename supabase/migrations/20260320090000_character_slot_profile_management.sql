-- Character slot profile management helpers

CREATE OR REPLACE FUNCTION public.switch_active_character(p_profile_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_user_id uuid := auth.uid();
  target_exists boolean := false;
BEGIN
  IF current_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE = '42501';
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE id = p_profile_id
      AND user_id = current_user_id
      AND died_at IS NULL
  ) INTO target_exists;

  IF NOT target_exists THEN
    RAISE EXCEPTION 'Character not found or unavailable';
  END IF;

  UPDATE public.profiles
  SET is_active = false
  WHERE user_id = current_user_id
    AND is_active = true;

  UPDATE public.profiles
  SET is_active = true
  WHERE id = p_profile_id
    AND user_id = current_user_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.switch_active_character(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.create_character_profile()
RETURNS SETOF public.profiles
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_user_id uuid := auth.uid();
  extra_slots integer := 0;
  base_slots integer := 2;
  max_slots integer := 2;
  used_slots integer := 0;
  next_slot integer := 1;
  generated_username text;
  new_profile public.profiles%ROWTYPE;
BEGIN
  IF current_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE = '42501';
  END IF;

  SELECT COALESCE(extra_slots_purchased, 0)
  INTO extra_slots
  FROM public.character_slots
  WHERE user_id = current_user_id;

  max_slots := LEAST(base_slots + COALESCE(extra_slots, 0), 5);

  SELECT COUNT(*)
  INTO used_slots
  FROM public.profiles
  WHERE user_id = current_user_id
    AND died_at IS NULL;

  IF used_slots >= max_slots THEN
    RAISE EXCEPTION 'No character slots available';
  END IF;

  SELECT COALESCE(MAX(slot_number), 0) + 1
  INTO next_slot
  FROM public.profiles
  WHERE user_id = current_user_id;

  generated_username := CONCAT('player-', LEFT(current_user_id::text, 8), '-', next_slot::text);

  UPDATE public.profiles
  SET is_active = false
  WHERE user_id = current_user_id
    AND is_active = true;

  INSERT INTO public.profiles (
    user_id,
    username,
    display_name,
    avatar_url,
    bio,
    cash,
    fame,
    level,
    health,
    energy,
    experience,
    age,
    is_active,
    slot_number,
    generation_number,
    unlock_cost
  )
  VALUES (
    current_user_id,
    generated_username,
    NULL,
    NULL,
    NULL,
    10000,
    0,
    1,
    100,
    100,
    0,
    16,
    true,
    next_slot,
    1,
    0
  )
  RETURNING * INTO new_profile;

  RETURN NEXT new_profile;
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_character_profile() TO authenticated;
