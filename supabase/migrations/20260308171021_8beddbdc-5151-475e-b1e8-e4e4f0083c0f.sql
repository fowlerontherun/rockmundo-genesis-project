
ALTER TABLE public.bands
  ADD COLUMN IF NOT EXISTS reputation_score numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS morale numeric DEFAULT 50;

COMMENT ON COLUMN public.bands.reputation_score IS 'Public image score (-100 to 100), affects sponsorships and media access';
COMMENT ON COLUMN public.bands.morale IS 'Band morale (0-100), affects performance quality and drama risk';
