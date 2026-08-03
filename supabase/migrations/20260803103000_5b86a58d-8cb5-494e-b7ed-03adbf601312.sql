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
    SELECT p.user_id
      INTO v_profile_user_id
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
    SELECT p.id
      INTO v_active_profile_id
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

DROP TRIGGER IF EXISTS sync_band_member_character_identity_trigger ON public.band_members;
CREATE TRIGGER sync_band_member_character_identity_trigger
BEFORE INSERT OR UPDATE OF profile_id, user_id, is_touring_member
ON public.band_members
FOR EACH ROW
EXECUTE FUNCTION public.sync_band_member_character_identity();

UPDATE public.band_members bm
   SET user_id = p.user_id
  FROM public.profiles p
 WHERE bm.profile_id = p.id
   AND COALESCE(bm.is_touring_member, false) = false
   AND bm.user_id IS NULL
   AND NOT EXISTS (
     SELECT 1
       FROM public.band_members existing
      WHERE existing.user_id = p.user_id
        AND existing.id <> bm.id
   );

UPDATE public.band_members bm
   SET profile_id = (
     SELECT pr.id
       FROM public.profiles pr
      WHERE pr.user_id = bm.user_id
        AND pr.is_active = true
        AND pr.died_at IS NULL
      ORDER BY pr.updated_at DESC NULLS LAST, pr.created_at DESC NULLS LAST, pr.id
      LIMIT 1
   )
 WHERE bm.profile_id IS NULL
   AND bm.user_id IS NOT NULL
   AND COALESCE(bm.is_touring_member, false) = false
   AND EXISTS (
     SELECT 1
       FROM public.profiles pr
      WHERE pr.user_id = bm.user_id
        AND pr.is_active = true
        AND pr.died_at IS NULL
   );