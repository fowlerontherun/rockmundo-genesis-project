-- Stage equipment system schema updates

CREATE TABLE IF NOT EXISTS public.band_vehicles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  band_id uuid NOT NULL REFERENCES public.bands(id) ON DELETE CASCADE,
  name text NOT NULL,
  vehicle_type text NOT NULL,
  capacity integer NOT NULL DEFAULT 0 CHECK (capacity >= 0),
  location text,
  condition integer NOT NULL DEFAULT 100 CHECK (condition BETWEEN 0 AND 100),
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.band_stage_equipment
  ADD COLUMN IF NOT EXISTS condition_rating integer NOT NULL DEFAULT 100
    CHECK (condition_rating BETWEEN 0 AND 100),
  ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS vehicle_id uuid REFERENCES public.band_vehicles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS maintenance_due_at timestamptz,
  ADD COLUMN IF NOT EXISTS maintenance_status text NOT NULL DEFAULT 'good',
  ADD COLUMN IF NOT EXISTS in_service boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS size_units integer NOT NULL DEFAULT 1
    CHECK (size_units >= 0);

CREATE INDEX IF NOT EXISTS idx_band_equipment_vehicle_id
  ON public.band_stage_equipment (vehicle_id);

CREATE TABLE IF NOT EXISTS public.band_equipment_maintenance_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  band_equipment_id uuid NOT NULL REFERENCES public.band_stage_equipment(id) ON DELETE CASCADE,
  band_id uuid NOT NULL REFERENCES public.bands(id) ON DELETE CASCADE,
  performed_by uuid REFERENCES public.profiles(id),
  action text NOT NULL,
  cost integer NOT NULL DEFAULT 0 CHECK (cost >= 0),
  notes text,
  condition_before integer,
  condition_after integer,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_equipment_logs_band_id
  ON public.band_equipment_maintenance_logs (band_id);
CREATE INDEX IF NOT EXISTS idx_equipment_logs_equipment_id
  ON public.band_equipment_maintenance_logs (band_equipment_id);

ALTER TABLE public.band_vehicles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.band_equipment_maintenance_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Band members can view their vehicles"
  ON public.band_vehicles;
CREATE POLICY "Band members can view their vehicles"
  ON public.band_vehicles
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.band_members bm
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
      SELECT 1
      FROM public.band_members bm
      WHERE bm.band_id = band_vehicles.band_id
        AND bm.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.band_members bm
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
      SELECT 1
      FROM public.band_members bm
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
      SELECT 1
      FROM public.band_members bm
      WHERE bm.band_id = band_equipment_maintenance_logs.band_id
        AND bm.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.band_members bm
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
