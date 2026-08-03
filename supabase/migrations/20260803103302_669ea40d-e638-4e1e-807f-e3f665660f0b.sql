UPDATE public.band_members bm
SET user_id = p.user_id
FROM public.profiles p
WHERE bm.profile_id = p.id
  AND bm.band_id = '3b6c8c60-7e8e-456d-858a-d6f1dcb9a296'::uuid
  AND bm.user_id IS NULL
  AND NOT EXISTS (
    SELECT 1
    FROM public.band_members other
    WHERE other.user_id = p.user_id
      AND other.id <> bm.id
  );