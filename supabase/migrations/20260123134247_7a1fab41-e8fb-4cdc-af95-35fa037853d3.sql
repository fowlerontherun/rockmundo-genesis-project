-- Add company_id column to venues table
ALTER TABLE venues ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES companies(id) ON DELETE SET NULL;

-- Add is_subsidiary column to labels table if not exists
ALTER TABLE labels ADD COLUMN IF NOT EXISTS is_subsidiary BOOLEAN DEFAULT false;

-- Drop and recreate the trigger function to handle all company types
CREATE OR REPLACE FUNCTION create_subsidiary_entity()
RETURNS TRIGGER AS $$
DECLARE
  v_city_name TEXT;
BEGIN
  -- Get city name for tables that need it
  SELECT name INTO v_city_name FROM cities WHERE id = NEW.headquarters_city_id;
  
  -- Security Firm
  IF NEW.company_type = 'security' THEN
    INSERT INTO security_firms (company_id, name, city_id, reputation, license_tier)
    VALUES (NEW.id, NEW.name, NEW.headquarters_city_id, 50, 1);
  
  -- Merch Factory
  ELSIF NEW.company_type = 'factory' THEN
    INSERT INTO merch_factories (company_id, name, city_id, production_capacity, quality_rating)
    VALUES (NEW.id, NEW.name, NEW.headquarters_city_id, 100, 50);
  
  -- Logistics Company
  ELSIF NEW.company_type = 'logistics' THEN
    INSERT INTO logistics_companies (company_id, name, city_id, fleet_size, license_tier)
    VALUES (NEW.id, NEW.name, NEW.headquarters_city_id, 0, 1);
  
  -- Record Label
  ELSIF NEW.company_type = 'label' THEN
    INSERT INTO labels (company_id, name, headquarters_city, balance, reputation_score, is_subsidiary)
    VALUES (NEW.id, NEW.name, COALESCE(v_city_name, 'Unknown'), NEW.balance, 50, true);
  
  -- Venue
  ELSIF NEW.company_type = 'venue' THEN
    INSERT INTO venues (name, city, capacity, base_payment, venue_type, prestige_level, company_id)
    VALUES (NEW.name, COALESCE(v_city_name, 'Unknown'), 500, 5000, 'club', 1, NEW.id);
  
  -- Rehearsal Studio
  ELSIF NEW.company_type = 'rehearsal' THEN
    INSERT INTO rehearsal_rooms (company_id, name, city_id, hourly_rate, daily_rate, capacity, quality_rating)
    VALUES (NEW.id, NEW.name, NEW.headquarters_city_id, 50, 300, 4, 50);
  
  -- Recording Studio
  ELSIF NEW.company_type = 'recording_studio' THEN
    INSERT INTO recording_studios (company_id, name, city_id, hourly_rate, quality_rating, capacity)
    VALUES (NEW.id, NEW.name, NEW.headquarters_city_id, 200, 50, 1);
  
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;