
-- Add profile_id column to band_members for character isolation
ALTER TABLE public.band_members 
ADD COLUMN IF NOT EXISTS profile_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL;

-- Backfill existing records: match user_id to active profile
UPDATE public.band_members bm
SET profile_id = p.id
FROM public.profiles p
WHERE bm.user_id = p.user_id
  AND bm.profile_id IS NULL
  AND p.is_active = true
  AND p.died_at IS NULL;

-- For any remaining unmatched (edge case: no active profile), use first alive profile
UPDATE public.band_members bm
SET profile_id = (
  SELECT p.id FROM public.profiles p 
  WHERE p.user_id = bm.user_id AND p.died_at IS NULL 
  ORDER BY p.slot_number ASC LIMIT 1
)
WHERE bm.profile_id IS NULL AND bm.user_id IS NOT NULL;

-- Create index for efficient lookups
CREATE INDEX IF NOT EXISTS idx_band_members_profile_id ON public.band_members(profile_id);
