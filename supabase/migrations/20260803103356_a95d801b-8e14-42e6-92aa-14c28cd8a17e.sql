UPDATE public.band_members bm
SET profile_id = (
  SELECT p.id
  FROM public.profiles p
  WHERE p.user_id = bm.user_id
    AND p.is_active = true
    AND p.died_at IS NULL
  ORDER BY p.updated_at DESC NULLS LAST, p.created_at DESC NULLS LAST, p.id
  LIMIT 1
)
WHERE bm.profile_id IS NULL
  AND bm.user_id IS NOT NULL
  AND COALESCE(bm.is_touring_member, false) = false
  AND EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.user_id = bm.user_id
      AND p.is_active = true
      AND p.died_at IS NULL
  );