ALTER TABLE public.gig_outcomes
  ADD COLUMN IF NOT EXISTS production_breakdown jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS soundcheck_breakdown jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS production_incidents jsonb NOT NULL DEFAULT '[]'::jsonb;