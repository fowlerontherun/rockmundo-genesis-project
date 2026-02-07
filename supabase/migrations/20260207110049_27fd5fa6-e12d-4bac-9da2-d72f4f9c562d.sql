-- Add is_legal flag to underworld products
ALTER TABLE public.underworld_products 
ADD COLUMN is_legal boolean NOT NULL DEFAULT false;

-- Comment for clarity
COMMENT ON COLUMN public.underworld_products.is_legal IS 'Whether this item is legal (visible in legal stores) or illegal (underworld only)';