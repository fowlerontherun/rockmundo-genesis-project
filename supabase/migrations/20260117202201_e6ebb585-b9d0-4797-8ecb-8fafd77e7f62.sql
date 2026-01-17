-- Phase 9: Logistics & Transport Companies
-- Allows VIP players to create transport/logistics companies that can be hired by bands for tours

-- Logistics Companies table (company subsidiary for transport services)
CREATE TABLE IF NOT EXISTS logistics_companies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name text NOT NULL,
  license_tier integer NOT NULL DEFAULT 1 CHECK (license_tier >= 1 AND license_tier <= 5),
  fleet_capacity integer NOT NULL DEFAULT 2,
  current_fleet_size integer DEFAULT 0,
  service_quality_rating integer DEFAULT 50 CHECK (service_quality_rating >= 0 AND service_quality_rating <= 100),
  on_time_delivery_rate numeric DEFAULT 0.95,
  total_contracts_completed integer DEFAULT 0,
  total_distance_covered integer DEFAULT 0,
  specializations text[] DEFAULT ARRAY['general']::text[],
  insurance_coverage numeric DEFAULT 50000,
  operating_regions text[] DEFAULT ARRAY['local']::text[],
  reputation integer DEFAULT 50 CHECK (reputation >= 0 AND reputation <= 100),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Fleet vehicles owned by logistics companies
CREATE TABLE IF NOT EXISTS logistics_fleet_vehicles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  logistics_company_id uuid NOT NULL REFERENCES logistics_companies(id) ON DELETE CASCADE,
  vehicle_catalog_id uuid REFERENCES vehicle_catalog(id),
  name text NOT NULL,
  vehicle_type text NOT NULL DEFAULT 'van',
  capacity_units integer DEFAULT 100,
  condition_percent integer DEFAULT 100 CHECK (condition_percent >= 0 AND condition_percent <= 100),
  purchase_cost integer,
  purchase_date timestamptz,
  total_km_traveled integer DEFAULT 0,
  last_maintenance_km integer DEFAULT 0,
  next_maintenance_due timestamptz,
  fuel_efficiency numeric DEFAULT 1.0,
  status text DEFAULT 'available' CHECK (status IN ('available', 'in_transit', 'maintenance', 'retired')),
  assigned_driver_id uuid,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Logistics company drivers/staff
CREATE TABLE IF NOT EXISTS logistics_drivers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  logistics_company_id uuid NOT NULL REFERENCES logistics_companies(id) ON DELETE CASCADE,
  profile_id uuid,
  name text NOT NULL,
  is_npc boolean DEFAULT true,
  license_type text DEFAULT 'standard' CHECK (license_type IN ('standard', 'commercial', 'hazmat', 'oversize')),
  experience_years integer DEFAULT 0,
  skill_level integer DEFAULT 1 CHECK (skill_level >= 1 AND skill_level <= 10),
  reliability_rating integer DEFAULT 70 CHECK (reliability_rating >= 0 AND reliability_rating <= 100),
  salary_per_day integer DEFAULT 150,
  hired_at timestamptz DEFAULT now(),
  status text DEFAULT 'active' CHECK (status IN ('active', 'on_trip', 'off_duty', 'terminated')),
  total_trips_completed integer DEFAULT 0,
  total_km_driven integer DEFAULT 0,
  accidents integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Logistics contracts (bands/companies hiring logistics services)
CREATE TABLE IF NOT EXISTS logistics_contracts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  logistics_company_id uuid NOT NULL REFERENCES logistics_companies(id) ON DELETE CASCADE,
  client_band_id uuid REFERENCES bands(id) ON DELETE SET NULL,
  client_company_id uuid REFERENCES companies(id) ON DELETE SET NULL,
  tour_id uuid REFERENCES tours(id) ON DELETE SET NULL,
  contract_type text NOT NULL CHECK (contract_type IN ('tour_transport', 'equipment_haul', 'merch_delivery', 'one_way', 'round_trip')),
  vehicles_required integer DEFAULT 1,
  drivers_required integer DEFAULT 1,
  origin_city_id uuid REFERENCES cities(id),
  destination_city_id uuid REFERENCES cities(id),
  distance_km integer,
  estimated_duration_hours integer,
  cargo_description text,
  cargo_weight_kg integer,
  cargo_value numeric,
  fee_quoted numeric NOT NULL,
  fee_paid numeric DEFAULT 0,
  start_date timestamptz,
  end_date timestamptz,
  actual_start timestamptz,
  actual_end timestamptz,
  status text DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'in_progress', 'completed', 'cancelled', 'disputed')),
  client_rating integer CHECK (client_rating >= 1 AND client_rating <= 5),
  company_rating integer CHECK (company_rating >= 1 AND company_rating <= 5),
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Contract vehicle/driver assignments
CREATE TABLE IF NOT EXISTS logistics_contract_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id uuid NOT NULL REFERENCES logistics_contracts(id) ON DELETE CASCADE,
  vehicle_id uuid NOT NULL REFERENCES logistics_fleet_vehicles(id),
  driver_id uuid NOT NULL REFERENCES logistics_drivers(id),
  leg_number integer DEFAULT 1,
  origin_city_id uuid REFERENCES cities(id),
  destination_city_id uuid REFERENCES cities(id),
  distance_km integer,
  scheduled_departure timestamptz,
  scheduled_arrival timestamptz,
  actual_departure timestamptz,
  actual_arrival timestamptz,
  status text DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'in_transit', 'delayed', 'completed', 'cancelled')),
  delay_minutes integer DEFAULT 0,
  fuel_cost numeric,
  toll_cost numeric,
  incident_notes text,
  created_at timestamptz DEFAULT now()
);

-- Financial transactions for logistics companies
CREATE TABLE IF NOT EXISTS logistics_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  logistics_company_id uuid NOT NULL REFERENCES logistics_companies(id) ON DELETE CASCADE,
  contract_id uuid REFERENCES logistics_contracts(id),
  transaction_type text NOT NULL CHECK (transaction_type IN ('contract_payment', 'fuel_expense', 'maintenance', 'salary', 'vehicle_purchase', 'insurance', 'toll', 'penalty', 'bonus')),
  amount numeric NOT NULL,
  description text,
  transaction_date timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now()
);

-- Logistics company upgrades
CREATE TABLE IF NOT EXISTS logistics_upgrades (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  logistics_company_id uuid NOT NULL REFERENCES logistics_companies(id) ON DELETE CASCADE,
  upgrade_type text NOT NULL CHECK (upgrade_type IN ('fleet_capacity', 'gps_tracking', 'climate_control', 'insurance_premium', 'regional_expansion', 'hazmat_certification', 'oversize_permit')),
  upgrade_level integer DEFAULT 1,
  cost numeric NOT NULL,
  purchased_at timestamptz DEFAULT now(),
  active boolean DEFAULT true,
  expires_at timestamptz,
  created_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE logistics_companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE logistics_fleet_vehicles ENABLE ROW LEVEL SECURITY;
ALTER TABLE logistics_drivers ENABLE ROW LEVEL SECURITY;
ALTER TABLE logistics_contracts ENABLE ROW LEVEL SECURITY;
ALTER TABLE logistics_contract_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE logistics_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE logistics_upgrades ENABLE ROW LEVEL SECURITY;

-- RLS Policies for logistics_companies
CREATE POLICY "Users can view logistics companies they own via company"
ON logistics_companies FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM companies c
    WHERE c.id = logistics_companies.company_id
    AND c.owner_id = auth.uid()
  )
);

CREATE POLICY "Users can manage logistics companies they own"
ON logistics_companies FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM companies c
    WHERE c.id = logistics_companies.company_id
    AND c.owner_id = auth.uid()
  )
);

-- Public view for bands looking to hire
CREATE POLICY "Anyone can view active logistics companies for hiring"
ON logistics_companies FOR SELECT
USING (true);

-- RLS for fleet vehicles
CREATE POLICY "Company owners can manage fleet vehicles"
ON logistics_fleet_vehicles FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM logistics_companies lc
    JOIN companies c ON c.id = lc.company_id
    WHERE lc.id = logistics_fleet_vehicles.logistics_company_id
    AND c.owner_id = auth.uid()
  )
);

CREATE POLICY "Anyone can view fleet vehicles"
ON logistics_fleet_vehicles FOR SELECT
USING (true);

-- RLS for drivers
CREATE POLICY "Company owners can manage drivers"
ON logistics_drivers FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM logistics_companies lc
    JOIN companies c ON c.id = lc.company_id
    WHERE lc.id = logistics_drivers.logistics_company_id
    AND c.owner_id = auth.uid()
  )
);

CREATE POLICY "Anyone can view drivers"
ON logistics_drivers FOR SELECT
USING (true);

-- RLS for contracts
CREATE POLICY "Company owners can manage contracts"
ON logistics_contracts FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM logistics_companies lc
    JOIN companies c ON c.id = lc.company_id
    WHERE lc.id = logistics_contracts.logistics_company_id
    AND c.owner_id = auth.uid()
  )
);

CREATE POLICY "Band leaders can view and create contracts"
ON logistics_contracts FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM bands b
    WHERE b.id = logistics_contracts.client_band_id
    AND b.leader_id = auth.uid()
  )
);

CREATE POLICY "Band leaders can create contracts"
ON logistics_contracts FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM bands b
    WHERE b.id = logistics_contracts.client_band_id
    AND b.leader_id = auth.uid()
  )
);

-- RLS for contract assignments
CREATE POLICY "Company owners can manage assignments"
ON logistics_contract_assignments FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM logistics_contracts lcon
    JOIN logistics_companies lc ON lc.id = lcon.logistics_company_id
    JOIN companies c ON c.id = lc.company_id
    WHERE lcon.id = logistics_contract_assignments.contract_id
    AND c.owner_id = auth.uid()
  )
);

CREATE POLICY "Anyone can view assignments"
ON logistics_contract_assignments FOR SELECT
USING (true);

-- RLS for transactions
CREATE POLICY "Company owners can view transactions"
ON logistics_transactions FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM logistics_companies lc
    JOIN companies c ON c.id = lc.company_id
    WHERE lc.id = logistics_transactions.logistics_company_id
    AND c.owner_id = auth.uid()
  )
);

CREATE POLICY "Company owners can insert transactions"
ON logistics_transactions FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM logistics_companies lc
    JOIN companies c ON c.id = lc.company_id
    WHERE lc.id = logistics_transactions.logistics_company_id
    AND c.owner_id = auth.uid()
  )
);

-- RLS for upgrades
CREATE POLICY "Company owners can manage upgrades"
ON logistics_upgrades FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM logistics_companies lc
    JOIN companies c ON c.id = lc.company_id
    WHERE lc.id = logistics_upgrades.logistics_company_id
    AND c.owner_id = auth.uid()
  )
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_logistics_companies_company_id ON logistics_companies(company_id);
CREATE INDEX IF NOT EXISTS idx_logistics_fleet_company ON logistics_fleet_vehicles(logistics_company_id);
CREATE INDEX IF NOT EXISTS idx_logistics_drivers_company ON logistics_drivers(logistics_company_id);
CREATE INDEX IF NOT EXISTS idx_logistics_contracts_company ON logistics_contracts(logistics_company_id);
CREATE INDEX IF NOT EXISTS idx_logistics_contracts_band ON logistics_contracts(client_band_id);
CREATE INDEX IF NOT EXISTS idx_logistics_contracts_status ON logistics_contracts(status);
CREATE INDEX IF NOT EXISTS idx_logistics_assignments_contract ON logistics_contract_assignments(contract_id);
CREATE INDEX IF NOT EXISTS idx_logistics_transactions_company ON logistics_transactions(logistics_company_id);

-- Add 'logistics' to company_type enum if not exists (via check constraint update)
-- Update companies table to support logistics type
ALTER TABLE companies DROP CONSTRAINT IF EXISTS companies_company_type_check;
ALTER TABLE companies ADD CONSTRAINT companies_company_type_check 
  CHECK (company_type IN ('holding', 'subsidiary', 'label', 'venue_management', 'security', 'factory', 'studio', 'rehearsal', 'logistics'));