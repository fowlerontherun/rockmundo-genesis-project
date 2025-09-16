-- Add failure tracking metadata to gig performances
ALTER TABLE public.gig_performances
ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'completed';

ALTER TABLE public.gig_performances
ADD COLUMN IF NOT EXISTS fame_change INTEGER DEFAULT 0;

ALTER TABLE public.gig_performances
ADD COLUMN IF NOT EXISTS penalty_applied BOOLEAN DEFAULT false;

ALTER TABLE public.gig_performances
ADD COLUMN IF NOT EXISTS penalty_amount DECIMAL(10,2) DEFAULT 0;

ALTER TABLE public.gig_performances
ADD COLUMN IF NOT EXISTS failure_reason TEXT;
