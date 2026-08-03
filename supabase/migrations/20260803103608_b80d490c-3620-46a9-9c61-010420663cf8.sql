CREATE OR REPLACE FUNCTION public.sync_band_member_character_identity()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_profile_user_id uuid;
  v_active_profile_id uuid;
BEGIN
  IF COALESCE(NEW.is_touring_member, false) THEN
    RETURN NEW;
  END IF;

  IF NEW.profile_id IS NOT NULL THEN
    SELECT p.user_id INTO v_profile_user_id
    FROM public.profiles p
    WHERE p.id = NEW.profile_id;

    IF v_profile_user_id IS NULL THEN
      RAISE EXCEPTION 'Band member character profile not found';
    END IF;

    IF NEW.user_id IS NOT NULL AND NEW.user_id <> v_profile_user_id THEN
      RAISE EXCEPTION 'Band member account does not own the selected character';
    END IF;

    NEW.user_id := v_profile_user_id;
    RETURN NEW;
  END IF;

  IF NEW.user_id IS NOT NULL THEN
    SELECT p.id INTO v_active_profile_id
    FROM public.profiles p
    WHERE p.user_id = NEW.user_id
      AND p.is_active = true
      AND p.died_at IS NULL
    ORDER BY p.updated_at DESC NULLS LAST, p.created_at DESC NULLS LAST, p.id
    LIMIT 1;

    IF v_active_profile_id IS NULL THEN
      RAISE EXCEPTION 'No active character is available for this band membership';
    END IF;

    NEW.profile_id := v_active_profile_id;
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.sync_band_member_character_identity() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.sync_band_member_character_identity() TO service_role;