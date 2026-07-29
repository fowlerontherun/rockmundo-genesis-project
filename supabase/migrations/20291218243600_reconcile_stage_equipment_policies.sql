-- Reconcile stage-equipment policies and vehicle timestamp trigger for databases
-- where the historical migration used unsupported IF NOT EXISTS syntax.

ALTER TABLE public.band_vehicles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.band_equipment_maintenance_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Band members can view their vehicles"
  ON public.band_vehicles;
CREATE POLICY "Band members can view their vehicles"
  ON public.band_vehicles
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.band_members bm
      WHERE bm.band_id = band_vehicles.band_id
        AND bm.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Band members can manage their vehicles"
  ON public.band_vehicles;
CREATE POLICY "Band members can manage their vehicles"
  ON public.band_vehicles
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.band_members bm
      WHERE bm.band_id = band_vehicles.band_id
        AND bm.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.band_members bm
      WHERE bm.band_id = band_vehicles.band_id
        AND bm.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Band members can view equipment logs"
  ON public.band_equipment_maintenance_logs;
CREATE POLICY "Band members can view equipment logs"
  ON public.band_equipment_maintenance_logs
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.band_members bm
      WHERE bm.band_id = band_equipment_maintenance_logs.band_id
        AND bm.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Band members can manage equipment logs"
  ON public.band_equipment_maintenance_logs;
CREATE POLICY "Band members can manage equipment logs"
  ON public.band_equipment_maintenance_logs
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.band_members bm
      WHERE bm.band_id = band_equipment_maintenance_logs.band_id
        AND bm.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.band_members bm
      WHERE bm.band_id = band_equipment_maintenance_logs.band_id
        AND bm.user_id = auth.uid()
    )
  );

DROP TRIGGER IF EXISTS update_band_vehicles_updated_at
  ON public.band_vehicles;
CREATE TRIGGER update_band_vehicles_updated_at
  BEFORE UPDATE ON public.band_vehicles
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

NOTIFY pgrst, 'reload schema';
