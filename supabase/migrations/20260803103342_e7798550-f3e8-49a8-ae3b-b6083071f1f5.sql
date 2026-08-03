DROP INDEX IF EXISTS public.idx_one_band_per_user;

CREATE UNIQUE INDEX IF NOT EXISTS idx_one_band_per_profile
ON public.band_members (profile_id)
WHERE profile_id IS NOT NULL
  AND COALESCE(is_touring_member, false) = false
  AND COALESCE(member_status, 'active') = 'active';