-- Drop the overly permissive SELECT policy
DROP POLICY IF EXISTS "Profiles are viewable by everyone" ON public.profiles;

-- Create a secure SELECT policy - users can only view their own profile
CREATE POLICY "Users can view their own profile" 
ON public.profiles 
FOR SELECT 
TO authenticated
USING (auth.uid() = user_id);

-- Allow users to view profiles of their band members (for gameplay)
CREATE POLICY "Users can view band member profiles" 
ON public.profiles 
FOR SELECT 
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.band_members bm1
    JOIN public.band_members bm2 ON bm1.band_id = bm2.band_id
    WHERE bm1.user_id = auth.uid() 
    AND bm2.user_id = profiles.user_id
  )
);