-- Add travels_with_band column to band_members
ALTER TABLE public.band_members 
ADD COLUMN IF NOT EXISTS travels_with_band boolean DEFAULT false;

-- Session/touring musicians should travel with the band by default
UPDATE public.band_members 
SET travels_with_band = true 
WHERE is_touring_member = true;