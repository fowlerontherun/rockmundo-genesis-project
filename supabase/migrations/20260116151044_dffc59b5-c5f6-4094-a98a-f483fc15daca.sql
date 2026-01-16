-- Add new columns to tours table for enhanced tour wizard
ALTER TABLE tours ADD COLUMN IF NOT EXISTS starting_city_id UUID REFERENCES cities(id);
ALTER TABLE tours ADD COLUMN IF NOT EXISTS custom_ticket_price INTEGER;
ALTER TABLE tours ADD COLUMN IF NOT EXISTS stage_setup_tier TEXT DEFAULT 'basic';
ALTER TABLE tours ADD COLUMN IF NOT EXISTS stage_setup_cost NUMERIC DEFAULT 0;
ALTER TABLE tours ADD COLUMN IF NOT EXISTS support_band_id UUID REFERENCES bands(id);
ALTER TABLE tours ADD COLUMN IF NOT EXISTS sponsor_offer_id UUID;
ALTER TABLE tours ADD COLUMN IF NOT EXISTS sponsor_cash_value NUMERIC DEFAULT 0;
ALTER TABLE tours ADD COLUMN IF NOT EXISTS sponsor_fame_penalty INTEGER DEFAULT 0;
ALTER TABLE tours ADD COLUMN IF NOT EXISTS sponsor_ticket_penalty NUMERIC DEFAULT 0;
ALTER TABLE tours ADD COLUMN IF NOT EXISTS merch_boost_multiplier NUMERIC DEFAULT 1.3;
ALTER TABLE tours ADD COLUMN IF NOT EXISTS support_revenue_share NUMERIC DEFAULT 0.1;

-- Add constraint for stage setup tiers
ALTER TABLE tours DROP CONSTRAINT IF EXISTS tours_stage_setup_tier_check;
ALTER TABLE tours ADD CONSTRAINT tours_stage_setup_tier_check 
  CHECK (stage_setup_tier IN ('basic', 'enhanced', 'professional', 'premium', 'spectacular'));

-- Create index for starting city lookups
CREATE INDEX IF NOT EXISTS idx_tours_starting_city ON tours(starting_city_id);

-- Create index for support band lookups
CREATE INDEX IF NOT EXISTS idx_tours_support_band ON tours(support_band_id);