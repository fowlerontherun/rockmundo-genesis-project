
ALTER TABLE public.underworld_products
ADD COLUMN addiction_type TEXT CHECK (addiction_type IN ('alcohol', 'substances', 'gambling', 'partying'));
