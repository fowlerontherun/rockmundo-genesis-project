-- Add tax and distribution tracking columns to release_sales
ALTER TABLE public.release_sales 
ADD COLUMN IF NOT EXISTS sales_tax_amount integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS sales_tax_rate numeric(5,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS distribution_fee integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS distribution_rate numeric(5,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS net_revenue integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS city_id uuid REFERENCES public.cities(id);

-- Add index for city lookups
CREATE INDEX IF NOT EXISTS idx_release_sales_city_id ON public.release_sales(city_id);