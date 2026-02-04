-- Part 1: Company System Expansion - Pricing, Upgrades, and Equipment Integration

-- Recording Studios: Add pricing columns
ALTER TABLE city_studios
ADD COLUMN IF NOT EXISTS mixing_hourly_rate integer DEFAULT 150,
ADD COLUMN IF NOT EXISTS mastering_hourly_rate integer DEFAULT 200,
ADD COLUMN IF NOT EXISTS rush_fee_multiplier numeric DEFAULT 2.0,
ADD COLUMN IF NOT EXISTS minimum_booking_hours integer DEFAULT 2;

-- Recording Studio Equipment: Link to equipment_items catalog
ALTER TABLE recording_studio_equipment
ADD COLUMN IF NOT EXISTS equipment_item_id uuid REFERENCES equipment_items(id);

-- Rehearsal Studios: Add pricing columns  
ALTER TABLE rehearsal_rooms
ADD COLUMN IF NOT EXISTS after_hours_multiplier numeric DEFAULT 1.5,
ADD COLUMN IF NOT EXISTS equipment_rental_tier text DEFAULT 'basic',
ADD COLUMN IF NOT EXISTS allows_recording boolean DEFAULT false;

-- Venues: Add pricing columns
ALTER TABLE venues
ADD COLUMN IF NOT EXISTS venue_cut_percent numeric DEFAULT 30,
ADD COLUMN IF NOT EXISTS bar_revenue_share_percent numeric DEFAULT 25,
ADD COLUMN IF NOT EXISTS private_event_rate integer DEFAULT 10000,
ADD COLUMN IF NOT EXISTS minimum_guarantee integer DEFAULT 500;

-- Security Firms: Add pricing columns
ALTER TABLE security_firms
ADD COLUMN IF NOT EXISTS guard_rate_per_event integer DEFAULT 150,
ADD COLUMN IF NOT EXISTS weekly_discount_percent numeric DEFAULT 10,
ADD COLUMN IF NOT EXISTS vip_premium_multiplier numeric DEFAULT 1.5;

-- Logistics Companies: Add pricing columns
ALTER TABLE logistics_companies
ADD COLUMN IF NOT EXISTS per_km_rate numeric DEFAULT 1.0,
ADD COLUMN IF NOT EXISTS per_day_rate integer DEFAULT 500,
ADD COLUMN IF NOT EXISTS insurance_percent numeric DEFAULT 0.3;

-- Merch Factories: Add pricing columns
ALTER TABLE merch_factories
ADD COLUMN IF NOT EXISTS markup_percent numeric DEFAULT 20,
ADD COLUMN IF NOT EXISTS rush_fee_percent numeric DEFAULT 50,
ADD COLUMN IF NOT EXISTS bulk_discount_100 numeric DEFAULT 5,
ADD COLUMN IF NOT EXISTS bulk_discount_500 numeric DEFAULT 10,
ADD COLUMN IF NOT EXISTS bulk_discount_1000 numeric DEFAULT 15;

-- Security Firm Upgrades Table (new)
CREATE TABLE IF NOT EXISTS security_firm_upgrades (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  security_firm_id uuid NOT NULL REFERENCES security_firms(id) ON DELETE CASCADE,
  upgrade_type text NOT NULL,
  name text NOT NULL,
  level integer NOT NULL DEFAULT 1,
  cost integer NOT NULL,
  effect_value numeric NOT NULL DEFAULT 0,
  effect_description text,
  installed_at timestamp with time zone DEFAULT now(),
  created_at timestamp with time zone DEFAULT now()
);

-- Merch Factory Upgrades Table (new)
CREATE TABLE IF NOT EXISTS merch_factory_upgrades (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  merch_factory_id uuid NOT NULL REFERENCES merch_factories(id) ON DELETE CASCADE,
  upgrade_type text NOT NULL,
  name text NOT NULL,
  level integer NOT NULL DEFAULT 1,
  cost integer NOT NULL,
  effect_value numeric NOT NULL DEFAULT 0,
  effect_description text,
  installed_at timestamp with time zone DEFAULT now(),
  created_at timestamp with time zone DEFAULT now()
);

-- Logistics Company Upgrades Table (new)
CREATE TABLE IF NOT EXISTS logistics_company_upgrades (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  logistics_company_id uuid NOT NULL REFERENCES logistics_companies(id) ON DELETE CASCADE,
  upgrade_type text NOT NULL,
  name text NOT NULL,
  level integer NOT NULL DEFAULT 1,
  cost integer NOT NULL,
  effect_value numeric NOT NULL DEFAULT 0,
  effect_description text,
  installed_at timestamp with time zone DEFAULT now(),
  created_at timestamp with time zone DEFAULT now()
);

-- Venue Upgrades Table (new - venues may not have had one)
CREATE TABLE IF NOT EXISTS venue_upgrades (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  venue_id uuid NOT NULL REFERENCES venues(id) ON DELETE CASCADE,
  upgrade_type text NOT NULL,
  name text NOT NULL,
  level integer NOT NULL DEFAULT 1,
  cost integer NOT NULL,
  effect_value numeric NOT NULL DEFAULT 0,
  effect_description text,
  installed_at timestamp with time zone DEFAULT now(),
  created_at timestamp with time zone DEFAULT now()
);

-- Enable RLS on new tables
ALTER TABLE security_firm_upgrades ENABLE ROW LEVEL SECURITY;
ALTER TABLE merch_factory_upgrades ENABLE ROW LEVEL SECURITY;
ALTER TABLE logistics_company_upgrades ENABLE ROW LEVEL SECURITY;
ALTER TABLE venue_upgrades ENABLE ROW LEVEL SECURITY;

-- RLS Policies: Security Firm Upgrades
CREATE POLICY "Users can view security firm upgrades" ON security_firm_upgrades
  FOR SELECT USING (true);

CREATE POLICY "Users can manage own security firm upgrades" ON security_firm_upgrades
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM security_firms sf
      JOIN companies c ON sf.company_id = c.id
      WHERE sf.id = security_firm_upgrades.security_firm_id
      AND c.owner_id = auth.uid()
    )
  );

-- RLS Policies: Merch Factory Upgrades
CREATE POLICY "Users can view merch factory upgrades" ON merch_factory_upgrades
  FOR SELECT USING (true);

CREATE POLICY "Users can manage own merch factory upgrades" ON merch_factory_upgrades
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM merch_factories mf
      JOIN companies c ON mf.company_id = c.id
      WHERE mf.id = merch_factory_upgrades.merch_factory_id
      AND c.owner_id = auth.uid()
    )
  );

-- RLS Policies: Logistics Company Upgrades
CREATE POLICY "Users can view logistics upgrades" ON logistics_company_upgrades
  FOR SELECT USING (true);

CREATE POLICY "Users can manage own logistics upgrades" ON logistics_company_upgrades
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM logistics_companies lc
      JOIN companies c ON lc.company_id = c.id
      WHERE lc.id = logistics_company_upgrades.logistics_company_id
      AND c.owner_id = auth.uid()
    )
  );

-- RLS Policies: Venue Upgrades
CREATE POLICY "Users can view venue upgrades" ON venue_upgrades
  FOR SELECT USING (true);

CREATE POLICY "Users can manage own venue upgrades" ON venue_upgrades
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM venues v
      JOIN companies c ON v.company_id = c.id
      WHERE v.id = venue_upgrades.venue_id
      AND c.owner_id = auth.uid()
    )
  );

-- Add studio equipment categories to equipment_items if they don't exist
-- Using correct column name 'price' instead of 'base_price'
INSERT INTO equipment_items (name, category, subcategory, rarity, price, stat_boosts, description, brand)
SELECT * FROM (VALUES
  ('Neumann U87', 'microphone', 'studio_mic', 'legendary', 3600, '{"recording_quality": 15}'::jsonb, 'The industry standard large-diaphragm condenser microphone', 'Neumann'),
  ('Shure SM7B', 'microphone', 'studio_mic', 'epic', 400, '{"recording_quality": 10}'::jsonb, 'Dynamic vocal microphone favored for broadcasting and vocals', 'Shure'),
  ('AKG C414 XLII', 'microphone', 'studio_mic', 'epic', 1100, '{"recording_quality": 12}'::jsonb, 'Multi-pattern reference condenser microphone', 'AKG'),
  ('Rode NT1', 'microphone', 'studio_mic', 'rare', 270, '{"recording_quality": 7}'::jsonb, 'Ultra-quiet studio condenser microphone', 'Rode'),
  ('Sennheiser MD 421', 'microphone', 'studio_mic', 'rare', 380, '{"recording_quality": 8}'::jsonb, 'Versatile dynamic mic for instruments and voice', 'Sennheiser'),
  ('Neve 1073 Preamp', 'audio_interface', 'studio_preamp', 'legendary', 4500, '{"recording_quality": 18}'::jsonb, 'Classic British preamp/EQ, warm musical character', 'Neve'),
  ('API 512c Preamp', 'audio_interface', 'studio_preamp', 'epic', 1200, '{"recording_quality": 14}'::jsonb, 'Punchy American preamp with transformer saturation', 'API'),
  ('Universal Audio LA-610', 'audio_interface', 'studio_preamp', 'epic', 2500, '{"recording_quality": 15}'::jsonb, 'Tube preamp with optical compressor', 'Universal Audio'),
  ('SSL VHD Preamp', 'audio_interface', 'studio_preamp', 'rare', 600, '{"recording_quality": 10}'::jsonb, 'Variable harmonic drive preamp', 'SSL'),
  ('Universal Audio 1176', 'studio_equipment', 'studio_compressor', 'legendary', 3500, '{"mix_quality": 15}'::jsonb, 'Legendary FET compressor, fast and aggressive', 'Universal Audio'),
  ('SSL G-Bus Compressor', 'studio_equipment', 'studio_compressor', 'epic', 1800, '{"mix_quality": 12}'::jsonb, 'Classic bus compressor for glue and punch', 'SSL'),
  ('dbx 160A Compressor', 'studio_equipment', 'studio_compressor', 'rare', 500, '{"mix_quality": 8}'::jsonb, 'VCA compressor with simple controls', 'dbx'),
  ('Pultec EQP-1A', 'studio_equipment', 'studio_equalizer', 'legendary', 4000, '{"mix_quality": 16}'::jsonb, 'Tube program EQ with musical curves', 'Pultec'),
  ('Manley Massive Passive', 'studio_equipment', 'studio_equalizer', 'legendary', 5500, '{"mix_quality": 18}'::jsonb, 'Dual-channel tube EQ with wide range', 'Manley'),
  ('Lexicon 480L', 'studio_equipment', 'studio_reverb', 'legendary', 8000, '{"production_quality": 20}'::jsonb, 'Digital reverb used on countless hit records', 'Lexicon'),
  ('EMT 140 Plate Reverb', 'studio_equipment', 'studio_reverb', 'legendary', 15000, '{"production_quality": 22}'::jsonb, 'Classic plate reverb with rich decay', 'EMT'),
  ('Strymon BigSky', 'studio_equipment', 'studio_reverb', 'epic', 480, '{"production_quality": 10}'::jsonb, 'Modern digital reverb with extensive options', 'Strymon'),
  ('SSL AWS 948', 'studio_equipment', 'studio_console', 'legendary', 75000, '{"recording_quality": 25, "mix_quality": 25}'::jsonb, 'Hybrid analog/digital console for tracking and mixing', 'SSL'),
  ('Neve 8048', 'studio_equipment', 'studio_console', 'legendary', 150000, '{"recording_quality": 30, "mix_quality": 28}'::jsonb, 'Classic large-format console with legendary sound', 'Neve'),
  ('API 1608', 'studio_equipment', 'studio_console', 'epic', 60000, '{"recording_quality": 22, "mix_quality": 22}'::jsonb, 'Compact high-quality console with API sound', 'API'),
  ('Genelec 8351B', 'studio_equipment', 'studio_monitor', 'legendary', 7000, '{"mix_quality": 18}'::jsonb, 'Coaxial 3-way monitor with room calibration', 'Genelec'),
  ('Adam S3H', 'studio_equipment', 'studio_monitor', 'epic', 6500, '{"mix_quality": 16}'::jsonb, 'Midfield monitor with ribbon tweeter', 'Adam Audio'),
  ('Yamaha NS-10', 'studio_equipment', 'studio_monitor', 'rare', 800, '{"mix_quality": 8}'::jsonb, 'Industry standard reference monitors', 'Yamaha'),
  ('KRK Rokit 5', 'studio_equipment', 'studio_monitor', 'common', 180, '{"mix_quality": 4}'::jsonb, 'Entry-level studio monitors', 'KRK'),
  ('API 550A EQ', 'studio_equipment', 'studio_outboard', 'epic', 2200, '{"mix_quality": 14}'::jsonb, '3-band EQ with musical frequencies', 'API')
) AS v(name, category, subcategory, rarity, price, stat_boosts, description, brand)
WHERE NOT EXISTS (
  SELECT 1 FROM equipment_items WHERE equipment_items.name = v.name
);