-- Add INSERT policy for tour_venues table
CREATE POLICY "Users can insert tour venues for their tours"
ON public.tour_venues
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM tours t
    JOIN bands b ON t.band_id = b.id
    WHERE t.id = tour_id
    AND b.leader_id = auth.uid()
  )
);

-- Add UPDATE policy for tour_venues
CREATE POLICY "Users can update tour venues for their tours"
ON public.tour_venues
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM tours t
    JOIN bands b ON t.band_id = b.id
    WHERE t.id = tour_id
    AND b.leader_id = auth.uid()
  )
);

-- Add DELETE policy for tour_venues
CREATE POLICY "Users can delete tour venues for their tours"
ON public.tour_venues
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM tours t
    JOIN bands b ON t.band_id = b.id
    WHERE t.id = tour_id
    AND b.leader_id = auth.uid()
  )
);