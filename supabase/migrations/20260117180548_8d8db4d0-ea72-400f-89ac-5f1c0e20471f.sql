-- Phase 3: Private Security Firms
-- Create security_firms table for company-owned security businesses
CREATE TABLE public.security_firms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  license_level INTEGER DEFAULT 1 CHECK (license_level BETWEEN 1 AND 5),
  max_guards INTEGER DEFAULT 10,
  equipment_quality INTEGER DEFAULT 1 CHECK (equipment_quality BETWEEN 1 AND 5),
  reputation INTEGER DEFAULT 0,
  total_contracts_completed INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Create security_guards table for hired guards
CREATE TABLE public.security_guards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  security_firm_id UUID REFERENCES public.security_firms(id) ON DELETE CASCADE NOT NULL,
  profile_id UUID REFERENCES public.profiles(id),
  name TEXT NOT NULL,
  is_npc BOOLEAN DEFAULT true,
  skill_level INTEGER DEFAULT 1 CHECK (skill_level BETWEEN 1 AND 10),
  experience_years INTEGER DEFAULT 0,
  salary_per_event NUMERIC DEFAULT 100,
  hired_at TIMESTAMPTZ DEFAULT now(),
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'on_leave'))
);

-- Create security_contracts table for gig/tour/venue security
CREATE TABLE public.security_contracts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  security_firm_id UUID REFERENCES public.security_firms(id) ON DELETE CASCADE NOT NULL,
  client_band_id UUID REFERENCES public.bands(id),
  client_company_id UUID REFERENCES public.companies(id),
  gig_id UUID REFERENCES public.gigs(id),
  tour_id UUID REFERENCES public.tours(id),
  venue_id UUID REFERENCES public.venues(id),
  contract_type TEXT NOT NULL CHECK (contract_type IN ('gig', 'tour', 'venue_residency', 'event')),
  guards_required INTEGER NOT NULL,
  fee_per_event NUMERIC NOT NULL,
  total_fee NUMERIC,
  start_date DATE,
  end_date DATE,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'active', 'completed', 'cancelled')),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Create security_contract_assignments to track which guards work which contracts
CREATE TABLE public.security_contract_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id UUID REFERENCES public.security_contracts(id) ON DELETE CASCADE NOT NULL,
  guard_id UUID REFERENCES public.security_guards(id) ON DELETE CASCADE NOT NULL,
  assignment_date DATE NOT NULL,
  status TEXT DEFAULT 'assigned' CHECK (status IN ('assigned', 'completed', 'no_show')),
  performance_rating INTEGER CHECK (performance_rating BETWEEN 1 AND 5),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Add security_required field to venues for integration
ALTER TABLE public.venues ADD COLUMN IF NOT EXISTS security_required BOOLEAN DEFAULT false;
ALTER TABLE public.venues ADD COLUMN IF NOT EXISTS min_security_guards INTEGER DEFAULT 0;
ALTER TABLE public.venues ADD COLUMN IF NOT EXISTS security_license_required INTEGER DEFAULT 1;

-- Enable RLS
ALTER TABLE public.security_firms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.security_guards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.security_contracts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.security_contract_assignments ENABLE ROW LEVEL SECURITY;

-- RLS Policies for security_firms
CREATE POLICY "Users can view security firms they own via companies"
ON public.security_firms FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.companies c
    WHERE c.id = security_firms.company_id
    AND c.owner_id = auth.uid()
  )
);

CREATE POLICY "Users can manage security firms they own"
ON public.security_firms FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.companies c
    WHERE c.id = security_firms.company_id
    AND c.owner_id = auth.uid()
  )
);

-- Public view for security firms (for hiring)
CREATE POLICY "Anyone can view active security firms"
ON public.security_firms FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.companies c
    WHERE c.id = security_firms.company_id
    AND c.status = 'active'
  )
);

-- RLS Policies for security_guards
CREATE POLICY "Firm owners can manage guards"
ON public.security_guards FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.security_firms sf
    JOIN public.companies c ON c.id = sf.company_id
    WHERE sf.id = security_guards.security_firm_id
    AND c.owner_id = auth.uid()
  )
);

CREATE POLICY "Players can view if they are the guard"
ON public.security_guards FOR SELECT
USING (profile_id = auth.uid());

-- RLS Policies for security_contracts
CREATE POLICY "Firm owners can manage contracts"
ON public.security_contracts FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.security_firms sf
    JOIN public.companies c ON c.id = sf.company_id
    WHERE sf.id = security_contracts.security_firm_id
    AND c.owner_id = auth.uid()
  )
);

CREATE POLICY "Clients can view their contracts"
ON public.security_contracts FOR SELECT
USING (
  client_band_id IN (
    SELECT band_id FROM public.band_members WHERE user_id = auth.uid()
  )
  OR
  EXISTS (
    SELECT 1 FROM public.companies c
    WHERE c.id = security_contracts.client_company_id
    AND c.owner_id = auth.uid()
  )
);

CREATE POLICY "Band leaders can create contracts"
ON public.security_contracts FOR INSERT
WITH CHECK (
  client_band_id IN (
    SELECT band_id FROM public.band_members 
    WHERE user_id = auth.uid() AND role = 'leader'
  )
  OR
  EXISTS (
    SELECT 1 FROM public.companies c
    WHERE c.id = client_company_id
    AND c.owner_id = auth.uid()
  )
);

-- RLS for assignments
CREATE POLICY "Firm owners can manage assignments"
ON public.security_contract_assignments FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.security_contracts sc
    JOIN public.security_firms sf ON sf.id = sc.security_firm_id
    JOIN public.companies c ON c.id = sf.company_id
    WHERE sc.id = security_contract_assignments.contract_id
    AND c.owner_id = auth.uid()
  )
);

-- Create indexes for performance
CREATE INDEX idx_security_firms_company ON public.security_firms(company_id);
CREATE INDEX idx_security_guards_firm ON public.security_guards(security_firm_id);
CREATE INDEX idx_security_contracts_firm ON public.security_contracts(security_firm_id);
CREATE INDEX idx_security_contracts_gig ON public.security_contracts(gig_id);
CREATE INDEX idx_security_contracts_tour ON public.security_contracts(tour_id);
CREATE INDEX idx_security_contracts_status ON public.security_contracts(status);