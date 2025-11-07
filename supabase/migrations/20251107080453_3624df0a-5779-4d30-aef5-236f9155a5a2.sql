-- Create territories lookup table
CREATE TABLE IF NOT EXISTS territories (
  code TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  region TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create labels table
CREATE TABLE IF NOT EXISTS labels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR NOT NULL,
  description TEXT,
  headquarters_city TEXT,
  logo_url TEXT,
  created_by UUID REFERENCES auth.users(id),
  roster_slot_capacity INTEGER DEFAULT 10,
  marketing_budget INTEGER DEFAULT 100000,
  genre_focus TEXT[],
  reputation_score INTEGER DEFAULT 50,
  market_share NUMERIC DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create label territories junction table
CREATE TABLE IF NOT EXISTS label_territories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  label_id UUID NOT NULL REFERENCES labels(id) ON DELETE CASCADE,
  territory_code TEXT NOT NULL REFERENCES territories(code),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(label_id, territory_code)
);

-- Create label roster slots
CREATE TABLE IF NOT EXISTS label_roster_slots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  label_id UUID NOT NULL REFERENCES labels(id) ON DELETE CASCADE,
  slot_number INTEGER NOT NULL,
  status TEXT DEFAULT 'available' CHECK (status IN ('available', 'occupied', 'reserved')),
  contract_id UUID,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(label_id, slot_number)
);

-- Create label deal types
CREATE TABLE IF NOT EXISTS label_deal_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR NOT NULL UNIQUE,
  description TEXT,
  royalty_artist_pct INTEGER NOT NULL,
  advance_min INTEGER DEFAULT 0,
  advance_max INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create artist label contracts
CREATE TABLE IF NOT EXISTS artist_label_contracts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  label_id UUID NOT NULL REFERENCES labels(id) ON DELETE CASCADE,
  deal_type_id UUID NOT NULL REFERENCES label_deal_types(id),
  artist_profile_id UUID,
  band_id UUID REFERENCES bands(id) ON DELETE CASCADE,
  roster_slot_id UUID REFERENCES label_roster_slots(id),
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'fulfilled', 'breached', 'expired')),
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  advance_amount INTEGER DEFAULT 0,
  recouped_amount INTEGER DEFAULT 0,
  royalty_artist_pct INTEGER NOT NULL,
  release_quota INTEGER NOT NULL,
  releases_completed INTEGER DEFAULT 0,
  marketing_support INTEGER DEFAULT 0,
  masters_owned_by_artist BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create label releases
CREATE TABLE IF NOT EXISTS label_releases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id UUID NOT NULL REFERENCES artist_label_contracts(id) ON DELETE CASCADE,
  release_id UUID REFERENCES releases(id),
  title TEXT NOT NULL,
  release_type TEXT,
  release_date DATE,
  marketing_budget INTEGER DEFAULT 0,
  units_sold INTEGER DEFAULT 0,
  revenue_generated INTEGER DEFAULT 0,
  status TEXT DEFAULT 'planned' CHECK (status IN ('planned', 'in_production', 'released', 'archived')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create label promotion campaigns
CREATE TABLE IF NOT EXISTS label_promotion_campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  release_id UUID NOT NULL REFERENCES label_releases(id) ON DELETE CASCADE,
  campaign_type TEXT NOT NULL,
  budget INTEGER NOT NULL,
  channels TEXT[] DEFAULT '{}',
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  effectiveness INTEGER DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create label royalty statements
CREATE TABLE IF NOT EXISTS label_royalty_statements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id UUID NOT NULL REFERENCES artist_label_contracts(id) ON DELETE CASCADE,
  release_id UUID REFERENCES label_releases(id),
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  gross_revenue INTEGER NOT NULL,
  label_share INTEGER NOT NULL,
  artist_share INTEGER NOT NULL,
  advance_deduction INTEGER DEFAULT 0,
  net_payout INTEGER NOT NULL,
  paid BOOLEAN DEFAULT false,
  paid_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS on all tables
ALTER TABLE territories ENABLE ROW LEVEL SECURITY;
ALTER TABLE labels ENABLE ROW LEVEL SECURITY;
ALTER TABLE label_territories ENABLE ROW LEVEL SECURITY;
ALTER TABLE label_roster_slots ENABLE ROW LEVEL SECURITY;
ALTER TABLE label_deal_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE artist_label_contracts ENABLE ROW LEVEL SECURITY;
ALTER TABLE label_releases ENABLE ROW LEVEL SECURITY;
ALTER TABLE label_promotion_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE label_royalty_statements ENABLE ROW LEVEL SECURITY;

-- Territories policies
CREATE POLICY "Territories are viewable by everyone" ON territories FOR SELECT USING (true);

-- Labels policies
CREATE POLICY "Labels are viewable by everyone" ON labels FOR SELECT USING (true);
CREATE POLICY "Authenticated users can create labels" ON labels FOR INSERT WITH CHECK (auth.uid() = created_by);
CREATE POLICY "Label owners can update their labels" ON labels FOR UPDATE USING (auth.uid() = created_by);

-- Label territories policies
CREATE POLICY "Label territories are viewable by everyone" ON label_territories FOR SELECT USING (true);
CREATE POLICY "Label owners can manage territories" ON label_territories FOR ALL USING (
  EXISTS (SELECT 1 FROM labels WHERE labels.id = label_territories.label_id AND labels.created_by = auth.uid())
);

-- Label roster slots policies
CREATE POLICY "Roster slots are viewable by everyone" ON label_roster_slots FOR SELECT USING (true);
CREATE POLICY "Label owners can manage roster slots" ON label_roster_slots FOR ALL USING (
  EXISTS (SELECT 1 FROM labels WHERE labels.id = label_roster_slots.label_id AND labels.created_by = auth.uid())
);

-- Deal types policies
CREATE POLICY "Deal types are viewable by everyone" ON label_deal_types FOR SELECT USING (true);

-- Contracts policies
CREATE POLICY "Contracts are viewable by involved parties" ON artist_label_contracts FOR SELECT USING (
  EXISTS (SELECT 1 FROM labels WHERE labels.id = artist_label_contracts.label_id AND labels.created_by = auth.uid())
  OR EXISTS (SELECT 1 FROM bands WHERE bands.id = artist_label_contracts.band_id AND bands.leader_id = auth.uid())
  OR artist_profile_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
);

CREATE POLICY "Label owners can create contracts" ON artist_label_contracts FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM labels WHERE labels.id = label_id AND labels.created_by = auth.uid())
);

CREATE POLICY "Label owners can update their contracts" ON artist_label_contracts FOR UPDATE USING (
  EXISTS (SELECT 1 FROM labels WHERE labels.id = label_id AND labels.created_by = auth.uid())
);

-- Releases policies
CREATE POLICY "Releases are viewable by contract parties" ON label_releases FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM artist_label_contracts alc
    JOIN labels l ON l.id = alc.label_id
    WHERE alc.id = label_releases.contract_id
    AND (l.created_by = auth.uid() OR alc.band_id IN (SELECT id FROM bands WHERE leader_id = auth.uid()))
  )
);

CREATE POLICY "Label owners can manage releases" ON label_releases FOR ALL USING (
  EXISTS (
    SELECT 1 FROM artist_label_contracts alc
    JOIN labels l ON l.id = alc.label_id
    WHERE alc.id = label_releases.contract_id AND l.created_by = auth.uid()
  )
);

-- Promotion campaigns policies
CREATE POLICY "Campaigns are viewable by contract parties" ON label_promotion_campaigns FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM label_releases lr
    JOIN artist_label_contracts alc ON alc.id = lr.contract_id
    JOIN labels l ON l.id = alc.label_id
    WHERE lr.id = label_promotion_campaigns.release_id
    AND (l.created_by = auth.uid() OR alc.band_id IN (SELECT id FROM bands WHERE leader_id = auth.uid()))
  )
);

CREATE POLICY "Label owners can manage campaigns" ON label_promotion_campaigns FOR ALL USING (
  EXISTS (
    SELECT 1 FROM label_releases lr
    JOIN artist_label_contracts alc ON alc.id = lr.contract_id
    JOIN labels l ON l.id = alc.label_id
    WHERE lr.id = label_promotion_campaigns.release_id AND l.created_by = auth.uid()
  )
);

-- Royalty statements policies
CREATE POLICY "Royalty statements viewable by parties" ON label_royalty_statements FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM artist_label_contracts alc
    JOIN labels l ON l.id = alc.label_id
    WHERE alc.id = label_royalty_statements.contract_id
    AND (l.created_by = auth.uid() OR alc.band_id IN (SELECT id FROM bands WHERE leader_id = auth.uid()))
  )
);

CREATE POLICY "Label owners can manage statements" ON label_royalty_statements FOR ALL USING (
  EXISTS (
    SELECT 1 FROM artist_label_contracts alc
    JOIN labels l ON l.id = alc.label_id
    WHERE alc.id = label_royalty_statements.contract_id AND l.created_by = auth.uid()
  )
);

-- Insert some default deal types
INSERT INTO label_deal_types (name, description, royalty_artist_pct, advance_min, advance_max) VALUES
  ('Standard Deal', 'Traditional recording contract with standard royalty split', 15, 10000, 50000),
  ('Distribution Deal', 'Distribution only, artist retains ownership', 30, 0, 10000),
  ('360 Deal', 'Comprehensive deal covering all revenue streams', 10, 50000, 200000),
  ('Production Deal', 'Label provides production services and distribution', 20, 5000, 25000),
  ('Licensing Deal', 'Short-term licensing agreement', 40, 0, 5000)
ON CONFLICT (name) DO NOTHING;

-- Insert some default territories
INSERT INTO territories (code, name, region) VALUES
  ('US', 'United States', 'North America'),
  ('UK', 'United Kingdom', 'Europe'),
  ('CA', 'Canada', 'North America'),
  ('AU', 'Australia', 'Oceania'),
  ('JP', 'Japan', 'Asia'),
  ('DE', 'Germany', 'Europe'),
  ('FR', 'France', 'Europe'),
  ('BR', 'Brazil', 'South America'),
  ('MX', 'Mexico', 'North America'),
  ('IT', 'Italy', 'Europe'),
  ('ES', 'Spain', 'Europe'),
  ('KR', 'South Korea', 'Asia'),
  ('CN', 'China', 'Asia'),
  ('IN', 'India', 'Asia'),
  ('WORLDWIDE', 'Worldwide', 'Global')
ON CONFLICT (code) DO NOTHING;