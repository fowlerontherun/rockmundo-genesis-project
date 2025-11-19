-- Add allow_applications column to bands table
ALTER TABLE public.bands
ADD COLUMN IF NOT EXISTS allow_applications boolean DEFAULT true;

COMMENT ON COLUMN public.bands.allow_applications IS 'Whether players can apply to join this band without an invitation';