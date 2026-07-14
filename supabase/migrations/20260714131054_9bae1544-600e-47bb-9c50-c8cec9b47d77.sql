
DROP POLICY IF EXISTS "Band leaders can manage vehicles" ON public.band_vehicles;
DROP POLICY IF EXISTS "Band members can view their vehicles" ON public.band_vehicles;

CREATE POLICY "Band leaders can manage vehicles"
ON public.band_vehicles
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.bands b
    JOIN public.profiles p ON p.id = b.leader_id
    WHERE b.id = band_vehicles.band_id AND p.user_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.bands b
    JOIN public.profiles p ON p.id = b.leader_id
    WHERE b.id = band_vehicles.band_id AND p.user_id = auth.uid()
  )
);

CREATE POLICY "Band members can view their vehicles"
ON public.band_vehicles
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.band_members bm
    JOIN public.profiles p ON p.id = bm.user_id
    WHERE bm.band_id = band_vehicles.band_id AND (p.user_id = auth.uid() OR bm.user_id = auth.uid())
  )
);
