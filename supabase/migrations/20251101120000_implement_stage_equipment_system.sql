-- Stage equipment system schema updates

-- Vehicles available to each band for transporting stage equipment
CREATE TABLE IF NOT EXISTS public.band_vehicles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  band_id UUID NOT NULL REFERENCES public.bands(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  vehicle_type TEXT NOT NULL,
  capacity INTEGER NOT NULL DEFAULT 0 CHECK (capacity >= 0),
  location TEXT,
  condition INTEGER NOT NULL DEFAULT 100 CHECK (condition BETWEEN 0 AND 100),
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Extend the existing band_stage_equipment table with operational columns
ALTER TABLE public.band_stage_equipment
  ADD COLUMN IF NOT EXISTS condition_rating INTEGER NOT NULL DEFAULT 100 CHECK (condition_rating BETWEEN 0 AND 100),
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS vehicle_id UUID REFERENCES public.band_vehicles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS maintenance_due_at TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS maintenance_status TEXT NOT NULL DEFAULT 'good',
  ADD COLUMN IF NOT EXISTS in_service BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS size_units INTEGER NOT NULL DEFAULT 1 CHECK (size_units >= 0);

CREATE INDEX IF NOT EXISTS idx_band_equipment_vehicle_id
  ON public.band_stage_equipment(vehicle_id);

-- Track maintenance and repair history for stage gear
CREATE TABLE IF NOT EXISTS public.band_equipment_maintenance_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  band_equipment_id UUID NOT NULL REFERENCES public.band_stage_equipment(id) ON DELETE CASCADE,
  band_id UUID NOT NULL REFERENCES public.bands(id) ON DELETE CASCADE,
  performed_by UUID REFERENCES public.profiles(id),
  action TEXT NOT NULL,
  cost INTEGER NOT NULL DEFAULT 0 CHECK (cost >= 0),
  notes TEXT,
  condition_before INTEGER,
  condition_after INTEGER,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_equipment_logs_band_id
  ON public.band_equipment_maintenance_logs(band_id);

CREATE INDEX IF NOT EXISTS idx_equipment_logs_equipment_id
  ON public.band_equipment_maintenance_logs(band_equipment_id);

-- Enable row level security so only band members can manage their fleet and logs
ALTER TABLE public.band_vehicles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.band_equipment_maintenance_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY IF NOT EXISTS "Band members can view their vehicles"
  ON public.band_vehicles FOR SELECT
  USING (
    band_id IN (
      SELECT band_id FROM public.band_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY IF NOT EXISTS "Band members can manage their vehicles"
  ON public.band_vehicles FOR ALL
  USING (
    band_id IN (
      SELECT band_id FROM public.band_members WHERE user_id = auth.uid()
    )
  )
  WITH CHECK (
    band_id IN (
      SELECT band_id FROM public.band_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY IF NOT EXISTS "Band members can view equipment logs"
  ON public.band_equipment_maintenance_logs FOR SELECT
  USING (
    band_id IN (
      SELECT band_id FROM public.band_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY IF NOT EXISTS "Band members can manage equipment logs"
  ON public.band_equipment_maintenance_logs FOR ALL
  USING (
    band_id IN (
      SELECT band_id FROM public.band_members WHERE user_id = auth.uid()
    )
  )
  WITH CHECK (
    band_id IN (
      SELECT band_id FROM public.band_members WHERE user_id = auth.uid()
    )
  );

-- Keep vehicle timestamps up to date
CREATE TRIGGER IF NOT EXISTS update_band_vehicles_updated_at
  BEFORE UPDATE ON public.band_vehicles
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
