-- Phase 7: Rehearsal Room Business Management
-- Add company ownership and business fields to rehearsal_rooms

ALTER TABLE public.rehearsal_rooms
ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES public.companies(id),
ADD COLUMN IF NOT EXISTS is_company_owned BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS daily_operating_cost INTEGER DEFAULT 200,
ADD COLUMN IF NOT EXISTS monthly_rent INTEGER DEFAULT 3000,
ADD COLUMN IF NOT EXISTS soundproofing_level INTEGER DEFAULT 50,
ADD COLUMN IF NOT EXISTS recording_capable BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS max_simultaneous_bands INTEGER DEFAULT 1,
ADD COLUMN IF NOT EXISTS amenities JSONB DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS reputation INTEGER DEFAULT 50,
ADD COLUMN IF NOT EXISTS total_bookings INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS total_revenue INTEGER DEFAULT 0;

-- Create index for company-owned rooms
CREATE INDEX IF NOT EXISTS idx_rehearsal_rooms_company ON public.rehearsal_rooms(company_id) WHERE company_id IS NOT NULL;

-- Rehearsal Room Staff table
CREATE TABLE IF NOT EXISTS public.rehearsal_room_staff (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  room_id UUID NOT NULL REFERENCES public.rehearsal_rooms(id) ON DELETE CASCADE,
  name VARCHAR NOT NULL,
  role VARCHAR NOT NULL CHECK (role IN ('manager', 'technician', 'receptionist', 'security', 'maintenance')),
  skill_level INTEGER DEFAULT 50 CHECK (skill_level >= 0 AND skill_level <= 100),
  salary INTEGER NOT NULL DEFAULT 500,
  hire_date TIMESTAMP WITH TIME ZONE DEFAULT now(),
  performance_rating INTEGER DEFAULT 50,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Rehearsal Room Financial Transactions
CREATE TABLE IF NOT EXISTS public.rehearsal_room_transactions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  room_id UUID NOT NULL REFERENCES public.rehearsal_rooms(id) ON DELETE CASCADE,
  transaction_type VARCHAR NOT NULL CHECK (transaction_type IN ('booking_revenue', 'equipment_rental', 'staff_salary', 'maintenance', 'utilities', 'upgrade_cost', 'other_income', 'other_expense')),
  amount INTEGER NOT NULL,
  description TEXT,
  reference_id UUID,
  transaction_date TIMESTAMP WITH TIME ZONE DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Rehearsal Room Upgrades
CREATE TABLE IF NOT EXISTS public.rehearsal_room_upgrades (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  room_id UUID NOT NULL REFERENCES public.rehearsal_rooms(id) ON DELETE CASCADE,
  upgrade_type VARCHAR NOT NULL CHECK (upgrade_type IN ('soundproofing', 'equipment', 'recording_gear', 'climate_control', 'lounge_area', 'storage', 'lighting')),
  name VARCHAR NOT NULL,
  level INTEGER DEFAULT 1 CHECK (level >= 1 AND level <= 5),
  cost INTEGER NOT NULL,
  effect_value INTEGER DEFAULT 0,
  effect_description TEXT,
  installed_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Rehearsal Room Equipment Rentals (additional gear bands can rent)
CREATE TABLE IF NOT EXISTS public.rehearsal_room_equipment (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  room_id UUID NOT NULL REFERENCES public.rehearsal_rooms(id) ON DELETE CASCADE,
  equipment_name VARCHAR NOT NULL,
  equipment_type VARCHAR NOT NULL CHECK (equipment_type IN ('amp', 'drums', 'keyboard', 'pa_system', 'microphone', 'recording_interface', 'effects_pedals', 'other')),
  hourly_rate INTEGER DEFAULT 10,
  daily_rate INTEGER DEFAULT 50,
  condition INTEGER DEFAULT 100 CHECK (condition >= 0 AND condition <= 100),
  is_available BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_rehearsal_room_staff_room ON public.rehearsal_room_staff(room_id);
CREATE INDEX IF NOT EXISTS idx_rehearsal_room_transactions_room ON public.rehearsal_room_transactions(room_id);
CREATE INDEX IF NOT EXISTS idx_rehearsal_room_transactions_date ON public.rehearsal_room_transactions(transaction_date);
CREATE INDEX IF NOT EXISTS idx_rehearsal_room_upgrades_room ON public.rehearsal_room_upgrades(room_id);
CREATE INDEX IF NOT EXISTS idx_rehearsal_room_equipment_room ON public.rehearsal_room_equipment(room_id);

-- Enable RLS
ALTER TABLE public.rehearsal_room_staff ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rehearsal_room_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rehearsal_room_upgrades ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rehearsal_room_equipment ENABLE ROW LEVEL SECURITY;

-- RLS Policies for rehearsal_room_staff
CREATE POLICY "Anyone can view rehearsal room staff" ON public.rehearsal_room_staff
  FOR SELECT USING (true);

CREATE POLICY "Company owners can manage rehearsal room staff" ON public.rehearsal_room_staff
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.rehearsal_rooms rr
      JOIN public.companies c ON rr.company_id = c.id
      WHERE rr.id = room_id AND c.owner_id = auth.uid()
    )
  );

-- RLS Policies for rehearsal_room_transactions
CREATE POLICY "Anyone can view rehearsal room transactions" ON public.rehearsal_room_transactions
  FOR SELECT USING (true);

CREATE POLICY "Company owners can manage rehearsal room transactions" ON public.rehearsal_room_transactions
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.rehearsal_rooms rr
      JOIN public.companies c ON rr.company_id = c.id
      WHERE rr.id = room_id AND c.owner_id = auth.uid()
    )
  );

-- RLS Policies for rehearsal_room_upgrades
CREATE POLICY "Anyone can view rehearsal room upgrades" ON public.rehearsal_room_upgrades
  FOR SELECT USING (true);

CREATE POLICY "Company owners can manage rehearsal room upgrades" ON public.rehearsal_room_upgrades
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.rehearsal_rooms rr
      JOIN public.companies c ON rr.company_id = c.id
      WHERE rr.id = room_id AND c.owner_id = auth.uid()
    )
  );

-- RLS Policies for rehearsal_room_equipment
CREATE POLICY "Anyone can view rehearsal room equipment" ON public.rehearsal_room_equipment
  FOR SELECT USING (true);

CREATE POLICY "Company owners can manage rehearsal room equipment" ON public.rehearsal_room_equipment
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.rehearsal_rooms rr
      JOIN public.companies c ON rr.company_id = c.id
      WHERE rr.id = room_id AND c.owner_id = auth.uid()
    )
  );