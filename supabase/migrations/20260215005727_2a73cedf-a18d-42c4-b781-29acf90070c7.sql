-- Drop the existing complex policy that causes RLS recursion
DROP POLICY IF EXISTS "Company owners can manage rehearsal room upgrades" ON public.rehearsal_room_upgrades;

-- Create simple INSERT policy: allow authenticated users to insert upgrades for rooms they own via company
CREATE POLICY "Authenticated users can insert rehearsal room upgrades"
ON public.rehearsal_room_upgrades
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.rehearsal_rooms rr
    JOIN public.companies c ON c.id = rr.company_id
    WHERE rr.id = room_id
    AND c.owner_id = auth.uid()
  )
);

-- Create simple UPDATE policy
CREATE POLICY "Authenticated users can update rehearsal room upgrades"
ON public.rehearsal_room_upgrades
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.rehearsal_rooms rr
    JOIN public.companies c ON c.id = rr.company_id
    WHERE rr.id = room_id
    AND c.owner_id = auth.uid()
  )
);

-- Create simple DELETE policy
CREATE POLICY "Authenticated users can delete rehearsal room upgrades"
ON public.rehearsal_room_upgrades
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.rehearsal_rooms rr
    JOIN public.companies c ON c.id = rr.company_id
    WHERE rr.id = room_id
    AND c.owner_id = auth.uid()
  )
);