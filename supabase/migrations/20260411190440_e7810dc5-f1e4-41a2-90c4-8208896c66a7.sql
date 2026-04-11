-- Drop the old INSERT policy that incorrectly compares auth.uid() to leader_id (which stores profile_id)
DROP POLICY IF EXISTS "Authenticated users can create bands" ON public.bands;

-- Create a new INSERT policy that allows authenticated users to create bands
-- where leader_id matches one of their profile IDs
CREATE POLICY "Authenticated users can create bands"
ON public.bands
FOR INSERT
TO authenticated
WITH CHECK (
  leader_id IN (
    SELECT id FROM public.profiles WHERE user_id = auth.uid()
  )
);

-- Also fix the UPDATE policy which has the same issue (checks band_members.user_id = auth.uid(), but user_id stores profile_id)
DROP POLICY IF EXISTS "Band members can update their bands" ON public.bands;

CREATE POLICY "Band members can update their bands"
ON public.bands
FOR UPDATE
TO authenticated
USING (
  id IN (
    SELECT bm.band_id FROM band_members bm
    WHERE bm.profile_id IN (
      SELECT p.id FROM profiles p WHERE p.user_id = auth.uid()
    )
  )
);