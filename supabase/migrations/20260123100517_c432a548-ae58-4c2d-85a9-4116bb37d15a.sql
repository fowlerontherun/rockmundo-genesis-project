-- Just add the column
ALTER TABLE public.venues ADD COLUMN IF NOT EXISTS is_legendary BOOLEAN DEFAULT false;