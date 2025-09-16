-- Add mixing and mastering tracking to songs table
ALTER TABLE public.songs
ADD COLUMN IF NOT EXISTS mix_quality integer,
ADD COLUMN IF NOT EXISTS master_quality integer,
ADD COLUMN IF NOT EXISTS production_cost integer DEFAULT 0;
