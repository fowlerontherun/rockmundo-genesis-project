-- Drop existing insert policy
DROP POLICY IF EXISTS "Users can create demo submissions" ON demo_submissions;

-- Create helper function to get profile id from auth user
CREATE OR REPLACE FUNCTION public.get_profile_id_for_user(user_uuid uuid)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id FROM profiles WHERE user_id = user_uuid LIMIT 1;
$$;

-- Create corrected insert policy
CREATE POLICY "Users can create demo submissions" 
ON demo_submissions 
FOR INSERT 
TO authenticated
WITH CHECK (
  (artist_profile_id = public.get_profile_id_for_user(auth.uid())) 
  OR 
  (band_id IN (
    SELECT band_members.band_id
    FROM band_members
    WHERE band_members.user_id = auth.uid() 
    AND band_members.role = 'leader'
  ))
);

-- Also fix the select policy
DROP POLICY IF EXISTS "Users can view their own demo submissions" ON demo_submissions;

CREATE POLICY "Users can view their own demo submissions" 
ON demo_submissions 
FOR SELECT 
TO authenticated
USING (
  (artist_profile_id = public.get_profile_id_for_user(auth.uid())) 
  OR 
  (band_id IN (
    SELECT band_members.band_id
    FROM band_members
    WHERE band_members.user_id = auth.uid()
  ))
);

-- Also fix the update policy
DROP POLICY IF EXISTS "Users can update their own pending demos" ON demo_submissions;

CREATE POLICY "Users can update their own pending demos" 
ON demo_submissions 
FOR UPDATE 
TO authenticated
USING (
  status = 'pending' 
  AND (
    (artist_profile_id = public.get_profile_id_for_user(auth.uid())) 
    OR 
    (band_id IN (
      SELECT band_members.band_id
      FROM band_members
      WHERE band_members.user_id = auth.uid() 
      AND band_members.role = 'leader'
    ))
  )
);