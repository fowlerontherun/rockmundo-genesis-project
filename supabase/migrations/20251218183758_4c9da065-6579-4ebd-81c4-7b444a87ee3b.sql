-- Fix overly restrictive profile policy
-- Allow authenticated users to view profiles (needed for social features)
DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can view band member profiles" ON public.profiles;

-- Create policy that allows all authenticated users to view profiles
CREATE POLICY "Authenticated users can view profiles" 
ON public.profiles 
FOR SELECT 
TO authenticated
USING (true);

-- Fix overly restrictive bands policy
-- Allow authenticated users to view bands (needed for discovery, leaderboards)
DROP POLICY IF EXISTS "Band members can view their band" ON public.bands;

-- Create policy that allows all authenticated users to view bands
CREATE POLICY "Authenticated users can view bands" 
ON public.bands 
FOR SELECT 
TO authenticated
USING (true);