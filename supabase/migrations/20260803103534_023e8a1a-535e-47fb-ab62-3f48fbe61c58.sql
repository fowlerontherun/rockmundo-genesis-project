UPDATE public.band_members bm
SET user_id = p.user_id
FROM public.profiles p
WHERE bm.profile_id = p.id
  AND COALESCE(bm.is_touring_member, false) = false
  AND bm.user_id IS DISTINCT FROM p.user_id;