ALTER TABLE public.band_members
DROP CONSTRAINT IF EXISTS band_members_band_id_user_id_key;

CREATE UNIQUE INDEX IF NOT EXISTS band_members_band_id_profile_id_key
ON public.band_members (band_id, profile_id)
WHERE profile_id IS NOT NULL;

UPDATE public.band_members bm
SET user_id = p.user_id
FROM public.profiles p
WHERE bm.profile_id = p.id
  AND COALESCE(bm.is_touring_member, false) = false
  AND bm.user_id IS DISTINCT FROM p.user_id;