-- Create a security definer function to check rehearsal room ownership
CREATE OR REPLACE FUNCTION public.owns_rehearsal_room(_room_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM rehearsal_rooms rr
    JOIN companies c ON c.id = rr.company_id
    WHERE rr.id = _room_id
    AND c.owner_id = auth.uid()
  )
$$;

REVOKE EXECUTE ON FUNCTION public.owns_rehearsal_room FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.owns_rehearsal_room TO authenticated;

-- Drop existing policies
DROP POLICY IF EXISTS "Authenticated users can insert rehearsal room upgrades" ON public.rehearsal_room_upgrades;
DROP POLICY IF EXISTS "Authenticated users can update rehearsal room upgrades" ON public.rehearsal_room_upgrades;
DROP POLICY IF EXISTS "Authenticated users can delete rehearsal room upgrades" ON public.rehearsal_room_upgrades;

-- Recreate with security definer function
CREATE POLICY "Owners can insert rehearsal room upgrades"
ON public.rehearsal_room_upgrades
FOR INSERT
TO authenticated
WITH CHECK (public.owns_rehearsal_room(room_id));

CREATE POLICY "Owners can update rehearsal room upgrades"
ON public.rehearsal_room_upgrades
FOR UPDATE
TO authenticated
USING (public.owns_rehearsal_room(room_id));

CREATE POLICY "Owners can delete rehearsal room upgrades"
ON public.rehearsal_room_upgrades
FOR DELETE
TO authenticated
USING (public.owns_rehearsal_room(room_id));