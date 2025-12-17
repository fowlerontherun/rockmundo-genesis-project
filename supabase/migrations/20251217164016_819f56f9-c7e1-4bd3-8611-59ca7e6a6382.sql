-- Complete the profiles RLS fix - only add missing policies
-- The SELECT policy was already created in previous migration

-- Drop and recreate insert policy if needed
DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can insert their own profile" ON public.profiles;
CREATE POLICY "Users can insert their own profile"
ON public.profiles
FOR INSERT
WITH CHECK (auth.uid() = user_id);