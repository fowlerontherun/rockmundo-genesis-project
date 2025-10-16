-- Add RLS policies for cities table to allow admins to manage cities

-- Allow admins to insert cities
CREATE POLICY "Admins can insert cities"
ON public.cities
FOR INSERT
TO authenticated
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Allow admins to update cities
CREATE POLICY "Admins can update cities"
ON public.cities
FOR UPDATE
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

-- Allow admins to delete cities
CREATE POLICY "Admins can delete cities"
ON public.cities
FOR DELETE
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));