-- Remove business_acumen and marketing_savvy columns from player_attributes
ALTER TABLE public.player_attributes
DROP COLUMN IF EXISTS business_acumen,
DROP COLUMN IF EXISTS marketing_savvy;

-- Remove business and marketing columns from player_skills
ALTER TABLE public.player_skills
DROP COLUMN IF EXISTS business,
DROP COLUMN IF EXISTS marketing;