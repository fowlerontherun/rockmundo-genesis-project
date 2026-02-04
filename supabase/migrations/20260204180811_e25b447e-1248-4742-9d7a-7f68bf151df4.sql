-- MODELING SYSTEM v1.0.597
CREATE TABLE modeling_agencies (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), name TEXT NOT NULL, tier TEXT DEFAULT 'local', region TEXT, min_looks_required INTEGER DEFAULT 30, prestige_level INTEGER DEFAULT 1, description TEXT, is_active BOOLEAN DEFAULT true, created_at TIMESTAMPTZ DEFAULT NOW());
CREATE TABLE fashion_events (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), name TEXT NOT NULL, event_type TEXT DEFAULT 'fashion_week', city_id UUID REFERENCES cities(id), starts_at DATE NOT NULL, ends_at DATE NOT NULL, prestige_level INTEGER DEFAULT 1, min_looks_required INTEGER DEFAULT 50, min_fame_required INTEGER DEFAULT 10000, description TEXT, is_active BOOLEAN DEFAULT true, created_at TIMESTAMPTZ DEFAULT NOW());
CREATE TABLE modeling_gigs (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), agency_id UUID REFERENCES modeling_agencies(id), brand_id UUID REFERENCES sponsorship_brands(id), gig_type TEXT DEFAULT 'photo_shoot', title TEXT NOT NULL, description TEXT, min_looks_required INTEGER DEFAULT 40, min_fame_required INTEGER DEFAULT 0, compensation_min INTEGER DEFAULT 500, compensation_max INTEGER DEFAULT 50000, fame_boost INTEGER DEFAULT 100, looks_boost INTEGER DEFAULT 0, duration_hours INTEGER DEFAULT 4, event_id UUID REFERENCES fashion_events(id), is_available BOOLEAN DEFAULT true, created_at TIMESTAMPTZ DEFAULT NOW());
CREATE TABLE player_modeling_contracts (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL, gig_id UUID REFERENCES modeling_gigs(id) ON DELETE CASCADE NOT NULL, brand_id UUID REFERENCES sponsorship_brands(id), status TEXT DEFAULT 'offered', gig_type TEXT, compensation INTEGER, fame_boost INTEGER, looks_boost INTEGER, shoot_date DATE, scheduled_start TIMESTAMPTZ, scheduled_end TIMESTAMPTZ, completed_at TIMESTAMPTZ, created_at TIMESTAMPTZ DEFAULT NOW());

ALTER TABLE modeling_agencies ENABLE ROW LEVEL SECURITY;
ALTER TABLE fashion_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE modeling_gigs ENABLE ROW LEVEL SECURITY;
ALTER TABLE player_modeling_contracts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read_agencies" ON modeling_agencies FOR SELECT USING (true);
CREATE POLICY "read_events" ON fashion_events FOR SELECT USING (true);
CREATE POLICY "read_gigs" ON modeling_gigs FOR SELECT USING (true);
CREATE POLICY "user_contracts_select" ON player_modeling_contracts FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "user_contracts_insert" ON player_modeling_contracts FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "user_contracts_update" ON player_modeling_contracts FOR UPDATE USING (auth.uid() = user_id);

-- Film enhancements
ALTER TABLE player_film_contracts ADD COLUMN IF NOT EXISTS casting_date DATE;
ALTER TABLE player_film_contracts ADD COLUMN IF NOT EXISTS filming_start DATE;
ALTER TABLE player_film_contracts ADD COLUMN IF NOT EXISTS filming_end DATE;
ALTER TABLE player_film_contracts ADD COLUMN IF NOT EXISTS premiere_date DATE;
ALTER TABLE player_film_contracts ADD COLUMN IF NOT EXISTS box_office_gross BIGINT DEFAULT 0;
ALTER TABLE player_film_contracts ADD COLUMN IF NOT EXISTS sequel_eligible BOOLEAN DEFAULT false;

-- Seed agencies
INSERT INTO modeling_agencies (name, tier, region, min_looks_required, prestige_level) VALUES
('Elite Model Management', 'elite', 'global', 85, 5), ('IMG Models', 'elite', 'global', 80, 5), ('Ford Models', 'international', 'North America', 70, 4), ('Storm Model Management', 'international', 'Europe', 75, 4), ('Next Model Management', 'international', 'global', 60, 3), ('Independent Talent Group', 'local', 'global', 35, 1);

-- Seed fashion events
INSERT INTO fashion_events (name, event_type, starts_at, ends_at, prestige_level, min_looks_required, min_fame_required) VALUES
('Paris Fashion Week', 'fashion_week', '2026-03-02', '2026-03-10', 5, 85, 80000), ('Milan Fashion Week', 'fashion_week', '2026-02-25', '2026-03-03', 5, 80, 70000), ('New York Fashion Week', 'fashion_week', '2026-02-07', '2026-02-15', 5, 75, 60000), ('London Fashion Week', 'fashion_week', '2026-02-14', '2026-02-18', 4, 70, 50000), ('Met Gala', 'gala', '2026-05-04', '2026-05-04', 5, 90, 150000);

-- Seed fashion brands
INSERT INTO sponsorship_brands (name, category, size, wealth_tier, min_fame_required) VALUES
('Versace', 'fashion', 'major', 5, 75000), ('Gucci', 'fashion', 'major', 5, 80000), ('Louis Vuitton', 'fashion', 'major', 5, 100000), ('Prada', 'fashion', 'major', 5, 90000), ('Calvin Klein', 'fashion', 'major', 4, 40000), ('H&M', 'fashion', 'medium', 3, 10000), ('Zara', 'fashion', 'medium', 3, 15000), ('Supreme', 'streetwear', 'small', 3, 25000) ON CONFLICT DO NOTHING;

-- Seed film studios
INSERT INTO film_studios (name, studio_type, country, prestige_level, min_fame_required) VALUES
('Netflix Studios', 'streaming', 'USA', 4, 5000), ('A24', 'independent', 'USA', 5, 10000), ('Universal Pictures', 'major', 'USA', 5, 50000), ('Warner Bros', 'major', 'USA', 5, 50000), ('Paramount Pictures', 'major', 'USA', 5, 40000), ('Blumhouse', 'independent', 'USA', 3, 15000) ON CONFLICT DO NOTHING;