-- Allow anonymous users to read profile count (for login page stats)
CREATE POLICY "Anyone can count profiles" 
ON public.profiles 
FOR SELECT 
USING (true);

-- Drop the old policy that required authentication
DROP POLICY IF EXISTS "Authenticated users can view profiles" ON public.profiles;