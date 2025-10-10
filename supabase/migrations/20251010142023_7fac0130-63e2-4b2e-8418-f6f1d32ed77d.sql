-- Add district_id column to venues table
ALTER TABLE public.venues 
ADD COLUMN IF NOT EXISTS district_id UUID REFERENCES public.city_districts(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_venues_district_id ON public.venues(district_id);

-- Add admin policies for venue management
CREATE POLICY "Admins can insert venues" ON public.venues 
FOR INSERT 
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update venues" ON public.venues 
FOR UPDATE 
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete venues" ON public.venues 
FOR DELETE 
USING (has_role(auth.uid(), 'admin'::app_role));