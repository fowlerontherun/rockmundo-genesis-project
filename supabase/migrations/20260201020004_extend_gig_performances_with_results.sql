-- Extend gig_performances with detailed performance metadata
ALTER TABLE public.gig_performances
ADD COLUMN IF NOT EXISTS stage_results JSONB DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS audience_reaction JSONB DEFAULT '{}'::jsonb;

-- Backfill existing records with default values
UPDATE public.gig_performances
SET stage_results = COALESCE(stage_results, '[]'::jsonb);

UPDATE public.gig_performances
SET audience_reaction = COALESCE(audience_reaction, '{}'::jsonb);
