-- Phase 8: Recording Studio Business Management
-- Add company ownership and business fields to city_studios

ALTER TABLE public.city_studios
ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES public.companies(id),
ADD COLUMN IF NOT EXISTS is_company_owned BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS daily_operating_cost INTEGER DEFAULT 500,
ADD COLUMN IF NOT EXISTS monthly_rent INTEGER DEFAULT 8000,
ADD COLUMN IF NOT EXISTS console_type VARCHAR DEFAULT 'analog',
ADD COLUMN IF NOT EXISTS max_tracks INTEGER DEFAULT 24,
ADD COLUMN IF NOT EXISTS has_live_room BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS has_isolation_booths INTEGER DEFAULT 1,
ADD COLUMN IF NOT EXISTS mastering_capable BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS reputation INTEGER DEFAULT 50,
ADD COLUMN IF NOT EXISTS total_sessions INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS total_revenue INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS albums_recorded INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS hit_songs_recorded INTEGER DEFAULT 0;

-- Create index for company-owned studios
CREATE INDEX IF NOT EXISTS idx_city_studios_company ON public.city_studios(company_id) WHERE company_id IS NOT NULL;

-- Recording Studio Staff table
CREATE TABLE IF NOT EXISTS public.recording_studio_staff (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  studio_id UUID NOT NULL REFERENCES public.city_studios(id) ON DELETE CASCADE,
  name VARCHAR NOT NULL,
  role VARCHAR NOT NULL CHECK (role IN ('chief_engineer', 'assistant_engineer', 'producer', 'studio_manager', 'maintenance_tech', 'runner')),
  skill_level INTEGER DEFAULT 50 CHECK (skill_level >= 0 AND skill_level <= 100),
  specialty VARCHAR CHECK (specialty IN ('rock', 'pop', 'hip_hop', 'electronic', 'jazz', 'classical', 'metal', 'country', 'all_genres')),
  salary INTEGER NOT NULL DEFAULT 800,
  albums_worked INTEGER DEFAULT 0,
  hit_songs INTEGER DEFAULT 0,
  hire_date TIMESTAMP WITH TIME ZONE DEFAULT now(),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Recording Studio Financial Transactions
CREATE TABLE IF NOT EXISTS public.recording_studio_transactions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  studio_id UUID NOT NULL REFERENCES public.city_studios(id) ON DELETE CASCADE,
  transaction_type VARCHAR NOT NULL CHECK (transaction_type IN ('session_revenue', 'mixing_revenue', 'mastering_revenue', 'equipment_rental', 'staff_salary', 'maintenance', 'utilities', 'upgrade_cost', 'other_income', 'other_expense')),
  amount INTEGER NOT NULL,
  description TEXT,
  reference_id UUID,
  band_name VARCHAR,
  transaction_date TIMESTAMP WITH TIME ZONE DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Recording Studio Upgrades
CREATE TABLE IF NOT EXISTS public.recording_studio_upgrades (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  studio_id UUID NOT NULL REFERENCES public.city_studios(id) ON DELETE CASCADE,
  upgrade_type VARCHAR NOT NULL CHECK (upgrade_type IN ('console', 'monitors', 'microphones', 'preamps', 'outboard_gear', 'live_room', 'isolation_booth', 'control_room', 'mastering_suite')),
  name VARCHAR NOT NULL,
  level INTEGER DEFAULT 1 CHECK (level >= 1 AND level <= 5),
  cost INTEGER NOT NULL,
  effect_value INTEGER DEFAULT 0,
  effect_description TEXT,
  installed_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Recording Studio Equipment (high-end gear inventory)
CREATE TABLE IF NOT EXISTS public.recording_studio_equipment (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  studio_id UUID NOT NULL REFERENCES public.city_studios(id) ON DELETE CASCADE,
  equipment_name VARCHAR NOT NULL,
  equipment_type VARCHAR NOT NULL CHECK (equipment_type IN ('microphone', 'preamp', 'compressor', 'equalizer', 'reverb', 'console', 'monitor', 'instrument', 'plugin_bundle', 'other')),
  brand VARCHAR,
  model VARCHAR,
  value INTEGER DEFAULT 0,
  hourly_rental_rate INTEGER DEFAULT 25,
  condition INTEGER DEFAULT 100 CHECK (condition >= 0 AND condition <= 100),
  is_vintage BOOLEAN DEFAULT false,
  is_available BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_recording_studio_staff_studio ON public.recording_studio_staff(studio_id);
CREATE INDEX IF NOT EXISTS idx_recording_studio_transactions_studio ON public.recording_studio_transactions(studio_id);
CREATE INDEX IF NOT EXISTS idx_recording_studio_transactions_date ON public.recording_studio_transactions(transaction_date);
CREATE INDEX IF NOT EXISTS idx_recording_studio_upgrades_studio ON public.recording_studio_upgrades(studio_id);
CREATE INDEX IF NOT EXISTS idx_recording_studio_equipment_studio ON public.recording_studio_equipment(studio_id);

-- Enable RLS
ALTER TABLE public.recording_studio_staff ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recording_studio_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recording_studio_upgrades ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recording_studio_equipment ENABLE ROW LEVEL SECURITY;

-- RLS Policies for recording_studio_staff
CREATE POLICY "Anyone can view recording studio staff" ON public.recording_studio_staff
  FOR SELECT USING (true);

CREATE POLICY "Company owners can manage recording studio staff" ON public.recording_studio_staff
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.city_studios cs
      JOIN public.companies c ON cs.company_id = c.id
      WHERE cs.id = studio_id AND c.owner_id = auth.uid()
    )
  );

-- RLS Policies for recording_studio_transactions
CREATE POLICY "Anyone can view recording studio transactions" ON public.recording_studio_transactions
  FOR SELECT USING (true);

CREATE POLICY "Company owners can manage recording studio transactions" ON public.recording_studio_transactions
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.city_studios cs
      JOIN public.companies c ON cs.company_id = c.id
      WHERE cs.id = studio_id AND c.owner_id = auth.uid()
    )
  );

-- RLS Policies for recording_studio_upgrades
CREATE POLICY "Anyone can view recording studio upgrades" ON public.recording_studio_upgrades
  FOR SELECT USING (true);

CREATE POLICY "Company owners can manage recording studio upgrades" ON public.recording_studio_upgrades
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.city_studios cs
      JOIN public.companies c ON cs.company_id = c.id
      WHERE cs.id = studio_id AND c.owner_id = auth.uid()
    )
  );

-- RLS Policies for recording_studio_equipment
CREATE POLICY "Anyone can view recording studio equipment" ON public.recording_studio_equipment
  FOR SELECT USING (true);

CREATE POLICY "Company owners can manage recording studio equipment" ON public.recording_studio_equipment
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.city_studios cs
      JOIN public.companies c ON cs.company_id = c.id
      WHERE cs.id = studio_id AND c.owner_id = auth.uid()
    )
  );