
-- Backfill missing player_attributes rows for existing profiles
INSERT INTO public.player_attributes (user_id, profile_id)
SELECT p.user_id, p.id
FROM public.profiles p
LEFT JOIN public.player_attributes pa ON pa.profile_id = p.id
WHERE pa.profile_id IS NULL AND p.user_id IS NOT NULL;

-- Backfill missing player_xp_wallet rows for existing profiles
INSERT INTO public.player_xp_wallet (profile_id)
SELECT p.id
FROM public.profiles p
LEFT JOIN public.player_xp_wallet w ON w.profile_id = p.id
WHERE w.profile_id IS NULL;

-- Trigger function: ensure attributes + wallet exist when a profile is created
CREATE OR REPLACE FUNCTION public.ensure_profile_progression_rows()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.user_id IS NOT NULL THEN
    INSERT INTO public.player_attributes (user_id, profile_id)
    VALUES (NEW.user_id, NEW.id)
    ON CONFLICT (profile_id) DO NOTHING;
  END IF;

  INSERT INTO public.player_xp_wallet (profile_id)
  VALUES (NEW.id)
  ON CONFLICT (profile_id) DO NOTHING;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_ensure_profile_progression_rows ON public.profiles;
CREATE TRIGGER trg_ensure_profile_progression_rows
AFTER INSERT ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.ensure_profile_progression_rows();
