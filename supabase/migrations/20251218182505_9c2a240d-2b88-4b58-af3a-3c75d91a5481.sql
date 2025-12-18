-- Drop the overly permissive SELECT policy
DROP POLICY IF EXISTS "Bands are viewable by everyone" ON public.bands;

-- Create secure SELECT policy - only band members can view their band's data
CREATE POLICY "Band members can view their band" 
ON public.bands 
FOR SELECT 
TO authenticated
USING (
  auth.uid() = leader_id 
  OR EXISTS (
    SELECT 1 FROM public.band_members 
    WHERE band_members.band_id = bands.id 
    AND band_members.user_id = auth.uid()
  )
);