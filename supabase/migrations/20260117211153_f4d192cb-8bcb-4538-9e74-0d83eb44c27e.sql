-- Add company ownership columns to venues, city_studios, and rehearsal_rooms

-- Venues table
ALTER TABLE venues ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES companies(id);
ALTER TABLE venues ADD COLUMN IF NOT EXISTS is_company_owned BOOLEAN DEFAULT false;

-- City Studios (recording studios)
ALTER TABLE city_studios ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES companies(id);
ALTER TABLE city_studios ADD COLUMN IF NOT EXISTS is_company_owned BOOLEAN DEFAULT false;
ALTER TABLE city_studios ADD COLUMN IF NOT EXISTS total_revenue NUMERIC DEFAULT 0;
ALTER TABLE city_studios ADD COLUMN IF NOT EXISTS sessions_completed INTEGER DEFAULT 0;

-- Rehearsal rooms
ALTER TABLE rehearsal_rooms ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES companies(id);
ALTER TABLE rehearsal_rooms ADD COLUMN IF NOT EXISTS is_company_owned BOOLEAN DEFAULT false;
ALTER TABLE rehearsal_rooms ADD COLUMN IF NOT EXISTS total_revenue NUMERIC DEFAULT 0;
ALTER TABLE rehearsal_rooms ADD COLUMN IF NOT EXISTS sessions_completed INTEGER DEFAULT 0;

-- Companies table - add negative_balance_since for bankruptcy tracking
ALTER TABLE companies ADD COLUMN IF NOT EXISTS negative_balance_since TIMESTAMPTZ;

-- Create indexes for efficient company ownership queries
CREATE INDEX IF NOT EXISTS idx_venues_company_id ON venues(company_id);
CREATE INDEX IF NOT EXISTS idx_city_studios_company_id ON city_studios(company_id);
CREATE INDEX IF NOT EXISTS idx_rehearsal_rooms_company_id ON rehearsal_rooms(company_id);

-- Update RLS policies for venues to allow company owners to manage
CREATE POLICY "Company owners can view their venues" ON venues
FOR SELECT USING (
  company_id IN (
    SELECT id FROM companies WHERE owner_id = auth.uid()
  )
);

CREATE POLICY "Company owners can update their venues" ON venues
FOR UPDATE USING (
  company_id IN (
    SELECT id FROM companies WHERE owner_id = auth.uid()
  )
);

-- Update RLS policies for city_studios
CREATE POLICY "Company owners can view their studios" ON city_studios
FOR SELECT USING (
  company_id IN (
    SELECT id FROM companies WHERE owner_id = auth.uid()
  )
);

CREATE POLICY "Company owners can update their studios" ON city_studios
FOR UPDATE USING (
  company_id IN (
    SELECT id FROM companies WHERE owner_id = auth.uid()
  )
);

-- Update RLS policies for rehearsal_rooms
CREATE POLICY "Company owners can view their rehearsal rooms" ON rehearsal_rooms
FOR SELECT USING (
  company_id IN (
    SELECT id FROM companies WHERE owner_id = auth.uid()
  )
);

CREATE POLICY "Company owners can update their rehearsal rooms" ON rehearsal_rooms
FOR UPDATE USING (
  company_id IN (
    SELECT id FROM companies WHERE owner_id = auth.uid()
  )
);