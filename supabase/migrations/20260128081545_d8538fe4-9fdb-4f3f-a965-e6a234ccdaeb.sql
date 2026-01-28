-- Fix the create_subsidiary_entity() trigger function with correct column names
CREATE OR REPLACE FUNCTION public.create_subsidiary_entity()
RETURNS TRIGGER AS $$
DECLARE
  v_city_name TEXT;
  v_profile_id UUID;
BEGIN
  -- Get city name
  SELECT name INTO v_city_name FROM cities WHERE id = NEW.headquarters_city_id;
  
  -- Get owner's profile_id from companies.owner_id (which is user_id)
  SELECT id INTO v_profile_id FROM profiles WHERE user_id = NEW.owner_id;
  
  -- Security Firm (fixed columns - no city_id, use license_level not license_tier)
  IF NEW.company_type = 'security' THEN
    INSERT INTO security_firms (company_id, name, license_level, equipment_quality, reputation, max_guards)
    VALUES (NEW.id, NEW.name, 1, 1, 50, 10);
  
  -- Merch Factory (fixed columns - use quality_level not quality_rating)
  ELSIF NEW.company_type = 'factory' THEN
    INSERT INTO merch_factories (company_id, name, city_id, factory_type, quality_level, production_capacity, worker_count, operating_costs_daily)
    VALUES (NEW.id, NEW.name, NEW.headquarters_city_id, 'apparel', 1, 100, 5, 500);
  
  -- Logistics Company (fixed columns - no city_id, use fleet_capacity not fleet_size)
  ELSIF NEW.company_type = 'logistics' THEN
    INSERT INTO logistics_companies (company_id, name, license_tier, fleet_capacity, reputation)
    VALUES (NEW.id, NEW.name, 1, 5, 50);
  
  -- Record Label (CRITICAL: set owner_id from company owner)
  ELSIF NEW.company_type = 'label' THEN
    INSERT INTO labels (company_id, name, headquarters_city, balance, reputation_score, is_subsidiary, owner_id)
    VALUES (NEW.id, NEW.name, COALESCE(v_city_name, 'Unknown'), NEW.balance, 50, true, v_profile_id);
  
  -- Venue (fixed: use location not city, add company_id)
  ELSIF NEW.company_type = 'venue' THEN
    INSERT INTO venues (company_id, name, location, city_id, capacity, base_payment, venue_type, prestige_level)
    VALUES (NEW.id, NEW.name, COALESCE(v_city_name, 'Unknown'), NEW.headquarters_city_id, 500, 5000, 'club', 1);
  
  -- Rehearsal Studio (fixed: use rehearsal_rooms with correct columns)
  ELSIF NEW.company_type = 'rehearsal' THEN
    INSERT INTO rehearsal_rooms (company_id, name, city_id, hourly_rate, capacity, quality_rating)
    VALUES (NEW.id, NEW.name, NEW.headquarters_city_id, 50, 4, 50);
  
  -- Recording Studio (fixed: use city_studios table, not recording_studios)
  ELSIF NEW.company_type = 'recording_studio' THEN
    INSERT INTO city_studios (company_id, name, city_id, hourly_rate, quality_rating, is_company_owned)
    VALUES (NEW.id, NEW.name, NEW.headquarters_city_id, 200, 50, true);
  
  END IF;
  
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'Subsidiary entity creation failed for %: %', NEW.company_type, SQLERRM;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Fix existing orphaned subsidiary labels (set owner_id from parent company)
UPDATE labels l
SET owner_id = p.id
FROM companies c
JOIN profiles p ON p.user_id = c.owner_id
WHERE l.company_id = c.id
AND l.owner_id IS NULL;

-- Create missing security_firms for existing security companies
INSERT INTO security_firms (company_id, name, license_level, equipment_quality, reputation, max_guards)
SELECT c.id, c.name, 1, 1, 50, 10
FROM companies c
LEFT JOIN security_firms sf ON sf.company_id = c.id
WHERE c.company_type = 'security' AND sf.id IS NULL;

-- Create missing merch_factories for existing factory companies
INSERT INTO merch_factories (company_id, name, city_id, factory_type, quality_level, production_capacity, worker_count, operating_costs_daily)
SELECT c.id, c.name, c.headquarters_city_id, 'apparel', 1, 100, 5, 500
FROM companies c
LEFT JOIN merch_factories mf ON mf.company_id = c.id
WHERE c.company_type = 'factory' AND mf.id IS NULL;

-- Create missing logistics_companies for existing logistics companies
INSERT INTO logistics_companies (company_id, name, license_tier, fleet_capacity, reputation)
SELECT c.id, c.name, 1, 5, 50
FROM companies c
LEFT JOIN logistics_companies lc ON lc.company_id = c.id
WHERE c.company_type = 'logistics' AND lc.id IS NULL;

-- Create missing venues for existing venue companies
INSERT INTO venues (company_id, name, location, city_id, capacity, base_payment, venue_type, prestige_level)
SELECT c.id, c.name, COALESCE(ct.name, 'Unknown'), c.headquarters_city_id, 500, 5000, 'club', 1
FROM companies c
LEFT JOIN venues v ON v.company_id = c.id
LEFT JOIN cities ct ON ct.id = c.headquarters_city_id
WHERE c.company_type = 'venue' AND v.id IS NULL;

-- Create missing rehearsal_rooms for existing rehearsal companies
INSERT INTO rehearsal_rooms (company_id, name, city_id, hourly_rate, capacity, quality_rating)
SELECT c.id, c.name, c.headquarters_city_id, 50, 4, 50
FROM companies c
LEFT JOIN rehearsal_rooms rr ON rr.company_id = c.id
WHERE c.company_type = 'rehearsal' AND rr.id IS NULL;

-- Create missing city_studios for existing recording_studio companies
INSERT INTO city_studios (company_id, name, city_id, hourly_rate, quality_rating, is_company_owned)
SELECT c.id, c.name, c.headquarters_city_id, 200, 50, true
FROM companies c
LEFT JOIN city_studios cs ON cs.company_id = c.id
WHERE c.company_type = 'recording_studio' AND cs.id IS NULL;