-- Add company ownership fields to venues table
ALTER TABLE public.venues 
ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES public.companies(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS is_company_owned BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS daily_operating_cost NUMERIC(10,2) DEFAULT 500,
ADD COLUMN IF NOT EXISTS monthly_rent NUMERIC(12,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS staff_count INTEGER DEFAULT 5,
ADD COLUMN IF NOT EXISTS equipment_quality INTEGER DEFAULT 3 CHECK (equipment_quality >= 1 AND equipment_quality <= 5),
ADD COLUMN IF NOT EXISTS sound_system_rating INTEGER DEFAULT 3 CHECK (sound_system_rating >= 1 AND sound_system_rating <= 5),
ADD COLUMN IF NOT EXISTS lighting_rating INTEGER DEFAULT 3 CHECK (lighting_rating >= 1 AND lighting_rating <= 5),
ADD COLUMN IF NOT EXISTS backstage_quality INTEGER DEFAULT 3 CHECK (backstage_quality >= 1 AND backstage_quality <= 5),
ADD COLUMN IF NOT EXISTS parking_spaces INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS has_green_room BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS has_recording_capability BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS alcohol_license BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS total_revenue_lifetime NUMERIC(16,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS total_gigs_hosted INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS avg_attendance_rate NUMERIC(5,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS reputation_score INTEGER DEFAULT 50 CHECK (reputation_score >= 0 AND reputation_score <= 100);

-- Create venue staff table
CREATE TABLE IF NOT EXISTS public.venue_staff (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  venue_id UUID REFERENCES public.venues(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('manager', 'sound_engineer', 'lighting_tech', 'security', 'bartender', 'door_staff', 'cleaner', 'stage_hand')),
  skill_level NUMERIC(3,2) NOT NULL DEFAULT 1.0 CHECK (skill_level >= 1 AND skill_level <= 5),
  salary_weekly NUMERIC(10,2) NOT NULL DEFAULT 400,
  hired_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  performance_rating NUMERIC(3,2) DEFAULT 3.0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create venue bookings table (for managing the venue's calendar)
CREATE TABLE IF NOT EXISTS public.venue_bookings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  venue_id UUID REFERENCES public.venues(id) ON DELETE CASCADE,
  band_id UUID REFERENCES public.bands(id) ON DELETE SET NULL,
  gig_id UUID REFERENCES public.gigs(id) ON DELETE SET NULL,
  booking_type TEXT NOT NULL DEFAULT 'gig' CHECK (booking_type IN ('gig', 'private_event', 'rehearsal', 'recording', 'maintenance', 'closed')),
  booking_date DATE NOT NULL,
  start_time TIME,
  end_time TIME,
  rental_fee NUMERIC(10,2),
  ticket_revenue_share_pct NUMERIC(5,2) DEFAULT 0,
  bar_revenue_share_pct NUMERIC(5,2) DEFAULT 100,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'completed', 'cancelled')),
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create venue financial transactions table
CREATE TABLE IF NOT EXISTS public.venue_financial_transactions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  venue_id UUID REFERENCES public.venues(id) ON DELETE CASCADE,
  transaction_type TEXT NOT NULL CHECK (transaction_type IN ('ticket_revenue', 'bar_revenue', 'rental_income', 'staff_wages', 'maintenance', 'utilities', 'rent', 'equipment', 'other')),
  amount NUMERIC(12,2) NOT NULL,
  description TEXT,
  related_booking_id UUID REFERENCES public.venue_bookings(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create venue upgrades table
CREATE TABLE IF NOT EXISTS public.venue_upgrades (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  venue_id UUID REFERENCES public.venues(id) ON DELETE CASCADE,
  upgrade_type TEXT NOT NULL CHECK (upgrade_type IN ('sound_system', 'lighting', 'capacity', 'backstage', 'bar', 'parking', 'green_room', 'recording', 'security')),
  upgrade_level INTEGER NOT NULL DEFAULT 1,
  cost NUMERIC(12,2) NOT NULL,
  installed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  description TEXT
);

-- Enable RLS
ALTER TABLE public.venue_staff ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.venue_bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.venue_financial_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.venue_upgrades ENABLE ROW LEVEL SECURITY;

-- RLS Policies for venue_staff
CREATE POLICY "Venue owners can view staff"
  ON public.venue_staff FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.venues v
    JOIN public.companies c ON c.id = v.company_id
    WHERE v.id = venue_staff.venue_id AND c.owner_id = auth.uid()
  ));

CREATE POLICY "Venue owners can manage staff"
  ON public.venue_staff FOR ALL
  USING (EXISTS (
    SELECT 1 FROM public.venues v
    JOIN public.companies c ON c.id = v.company_id
    WHERE v.id = venue_staff.venue_id AND c.owner_id = auth.uid()
  ));

-- RLS Policies for venue_bookings
CREATE POLICY "Venue owners can view bookings"
  ON public.venue_bookings FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.venues v
    JOIN public.companies c ON c.id = v.company_id
    WHERE v.id = venue_bookings.venue_id AND c.owner_id = auth.uid()
  ) OR EXISTS (
    SELECT 1 FROM public.band_members bm
    WHERE bm.band_id = venue_bookings.band_id AND bm.user_id = auth.uid()
  ));

CREATE POLICY "Venue owners can manage bookings"
  ON public.venue_bookings FOR ALL
  USING (EXISTS (
    SELECT 1 FROM public.venues v
    JOIN public.companies c ON c.id = v.company_id
    WHERE v.id = venue_bookings.venue_id AND c.owner_id = auth.uid()
  ));

-- RLS Policies for venue_financial_transactions
CREATE POLICY "Venue owners can view transactions"
  ON public.venue_financial_transactions FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.venues v
    JOIN public.companies c ON c.id = v.company_id
    WHERE v.id = venue_financial_transactions.venue_id AND c.owner_id = auth.uid()
  ));

CREATE POLICY "Venue owners can manage transactions"
  ON public.venue_financial_transactions FOR ALL
  USING (EXISTS (
    SELECT 1 FROM public.venues v
    JOIN public.companies c ON c.id = v.company_id
    WHERE v.id = venue_financial_transactions.venue_id AND c.owner_id = auth.uid()
  ));

-- RLS Policies for venue_upgrades
CREATE POLICY "Venue owners can view upgrades"
  ON public.venue_upgrades FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.venues v
    JOIN public.companies c ON c.id = v.company_id
    WHERE v.id = venue_upgrades.venue_id AND c.owner_id = auth.uid()
  ));

CREATE POLICY "Venue owners can manage upgrades"
  ON public.venue_upgrades FOR ALL
  USING (EXISTS (
    SELECT 1 FROM public.venues v
    JOIN public.companies c ON c.id = v.company_id
    WHERE v.id = venue_upgrades.venue_id AND c.owner_id = auth.uid()
  ));

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_venue_staff_venue ON public.venue_staff(venue_id);
CREATE INDEX IF NOT EXISTS idx_venue_bookings_venue ON public.venue_bookings(venue_id);
CREATE INDEX IF NOT EXISTS idx_venue_bookings_date ON public.venue_bookings(booking_date);
CREATE INDEX IF NOT EXISTS idx_venue_financial_transactions_venue ON public.venue_financial_transactions(venue_id);
CREATE INDEX IF NOT EXISTS idx_venue_upgrades_venue ON public.venue_upgrades(venue_id);
CREATE INDEX IF NOT EXISTS idx_venues_company ON public.venues(company_id);

-- Trigger for updated_at
CREATE TRIGGER update_venue_bookings_updated_at
  BEFORE UPDATE ON public.venue_bookings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();