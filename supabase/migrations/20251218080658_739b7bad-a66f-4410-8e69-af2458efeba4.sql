-- Phase 1: Travel blocking columns
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS is_traveling boolean DEFAULT false;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS travel_arrives_at timestamptz;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS travel_manager_enabled boolean DEFAULT false;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS travel_manager_expires_at timestamptz;

-- Phase 2: Band member location tracking
ALTER TABLE band_members ADD COLUMN IF NOT EXISTS current_city_id uuid REFERENCES cities(id);

-- Phase 3: Vehicle catalog table
CREATE TABLE IF NOT EXISTS vehicle_catalog (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  vehicle_type text NOT NULL,
  capacity_units integer NOT NULL DEFAULT 100,
  purchase_cost integer NOT NULL DEFAULT 10000,
  rental_daily_cost integer NOT NULL DEFAULT 100,
  lease_monthly_cost integer DEFAULT 500,
  comfort_rating integer DEFAULT 50 CHECK (comfort_rating >= 0 AND comfort_rating <= 100),
  speed_modifier numeric DEFAULT 1.0,
  fuel_cost_per_km numeric DEFAULT 0.15,
  maintenance_interval_km integer DEFAULT 5000,
  description text,
  image_url text,
  created_at timestamptz DEFAULT now()
);

-- Create band_vehicles table (it didn't exist)
CREATE TABLE IF NOT EXISTS band_vehicles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  band_id uuid NOT NULL REFERENCES bands(id) ON DELETE CASCADE,
  vehicle_catalog_id uuid REFERENCES vehicle_catalog(id),
  name text NOT NULL,
  vehicle_type text NOT NULL DEFAULT 'van',
  capacity_units integer DEFAULT 100,
  condition_percent integer DEFAULT 100 CHECK (condition_percent >= 0 AND condition_percent <= 100),
  rental_daily_cost integer DEFAULT 0,
  is_owned boolean DEFAULT false,
  is_leased boolean DEFAULT false,
  lease_payments_made integer DEFAULT 0,
  lease_payments_total integer DEFAULT 12,
  speed_modifier numeric DEFAULT 1.0,
  comfort_rating integer DEFAULT 50,
  total_km_traveled integer DEFAULT 0,
  last_maintenance_km integer DEFAULT 0,
  breakdown_risk numeric DEFAULT 0,
  rental_start_date timestamptz,
  rental_end_date timestamptz,
  purchase_date timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Phase 5: Tour enhancements
ALTER TABLE tours ADD COLUMN IF NOT EXISTS vehicle_id uuid REFERENCES band_vehicles(id);
ALTER TABLE tours ADD COLUMN IF NOT EXISTS auto_pilot_enabled boolean DEFAULT false;
ALTER TABLE tours ADD COLUMN IF NOT EXISTS total_travel_cost integer DEFAULT 0;
ALTER TABLE tours ADD COLUMN IF NOT EXISTS total_accommodation_cost integer DEFAULT 0;
ALTER TABLE tours ADD COLUMN IF NOT EXISTS travel_manager_booked boolean DEFAULT false;

-- Enable RLS
ALTER TABLE vehicle_catalog ENABLE ROW LEVEL SECURITY;
ALTER TABLE band_vehicles ENABLE ROW LEVEL SECURITY;

-- Public read access for vehicle catalog
CREATE POLICY "Vehicle catalog is publicly readable"
ON vehicle_catalog FOR SELECT
USING (true);

-- Band vehicles RLS - band members can manage
CREATE POLICY "Band members can view their vehicles"
ON band_vehicles FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM band_members bm
    WHERE bm.band_id = band_vehicles.band_id
    AND bm.user_id = auth.uid()
  )
);

CREATE POLICY "Band leaders can manage vehicles"
ON band_vehicles FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM bands b
    WHERE b.id = band_vehicles.band_id
    AND b.leader_id = auth.uid()
  )
);

-- Seed vehicle catalog with realistic options
INSERT INTO vehicle_catalog (name, vehicle_type, capacity_units, purchase_cost, rental_daily_cost, lease_monthly_cost, comfort_rating, speed_modifier, fuel_cost_per_km, description)
VALUES 
  ('Compact Van', 'van', 50, 8000, 40, 350, 30, 1.0, 0.12, 'Basic transport for small bands. Gets the job done but not much room for comfort.'),
  ('Transit Van', 'van', 80, 15000, 60, 550, 40, 1.0, 0.15, 'Popular choice for indie bands. Room for equipment and a few crew members.'),
  ('Mercedes Sprinter', 'sprinter', 120, 35000, 100, 1200, 55, 1.0, 0.18, 'The industry workhorse. Reliable with decent space for mid-size tours.'),
  ('Ford Transit Crew Van', 'sprinter', 100, 28000, 85, 950, 50, 1.0, 0.16, 'Good balance of passenger comfort and cargo space.'),
  ('Prevost Tour Bus', 'tour_bus', 300, 250000, 500, 8000, 85, 0.9, 0.35, 'Professional tour bus with sleeping bunks. The rock star standard.'),
  ('MCI J4500 Coach', 'tour_bus', 280, 200000, 400, 6500, 80, 0.9, 0.32, 'Comfortable coach conversion with lounge area and bunks.'),
  ('Nightliner Sleeper Bus', 'sleeper_bus', 250, 350000, 700, 12000, 95, 0.85, 0.40, 'Luxury sleeper bus with private bunks, shower, and lounge. Travel in style.'),
  ('Double Decker Tour Bus', 'sleeper_bus', 320, 400000, 850, 14000, 92, 0.85, 0.45, 'Maximum capacity with two levels of amenities. For stadium tours.'),
  ('Equipment Truck', 'truck', 500, 45000, 150, 1500, 20, 1.1, 0.25, 'Dedicated equipment hauler. Essential for larger productions.'),
  ('18-Wheeler Equipment Trailer', 'truck', 800, 80000, 250, 2500, 15, 1.15, 0.35, 'Maximum equipment capacity for arena tours and festivals.')
ON CONFLICT DO NOTHING;

-- Create function to check if player is in correct city for gig
CREATE OR REPLACE FUNCTION check_player_in_gig_city(p_user_id uuid, p_gig_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_player_city_id uuid;
  v_venue_city_id uuid;
  v_player_city_name text;
  v_venue_city_name text;
  v_is_in_city boolean;
BEGIN
  SELECT current_city_id INTO v_player_city_id
  FROM profiles WHERE user_id = p_user_id;
  
  SELECT v.city_id INTO v_venue_city_id
  FROM gigs g JOIN venues v ON g.venue_id = v.id
  WHERE g.id = p_gig_id;
  
  SELECT name INTO v_player_city_name FROM cities WHERE id = v_player_city_id;
  SELECT name INTO v_venue_city_name FROM cities WHERE id = v_venue_city_id;
  
  v_is_in_city := v_player_city_id = v_venue_city_id;
  
  RETURN jsonb_build_object(
    'is_in_city', v_is_in_city,
    'player_city_id', v_player_city_id,
    'player_city_name', COALESCE(v_player_city_name, 'Unknown'),
    'venue_city_id', v_venue_city_id,
    'venue_city_name', COALESCE(v_venue_city_name, 'Unknown')
  );
END;
$$;

-- Function to apply missed gig consequences
CREATE OR REPLACE FUNCTION apply_missed_gig_consequences(p_gig_id uuid, p_reason text DEFAULT 'not_in_city')
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_gig RECORD;
  v_venue_capacity integer;
  v_estimated_revenue numeric;
  v_fame_penalty integer;
  v_fan_loss integer;
  v_booking_fee numeric;
BEGIN
  SELECT g.*, v.capacity, v.city_id, b.leader_id, b.fame, b.total_fans
  INTO v_gig
  FROM gigs g
  JOIN venues v ON g.venue_id = v.id
  JOIN bands b ON g.band_id = b.id
  WHERE g.id = p_gig_id;
  
  IF v_gig IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Gig not found');
  END IF;
  
  v_venue_capacity := COALESCE(v_gig.capacity, 100);
  v_estimated_revenue := v_venue_capacity * v_gig.ticket_price * 0.5;
  v_booking_fee := GREATEST(50, v_estimated_revenue * 0.1);
  v_fame_penalty := CASE 
    WHEN v_venue_capacity > 5000 THEN 200
    WHEN v_venue_capacity > 1000 THEN 100
    WHEN v_venue_capacity > 500 THEN 50
    ELSE 25
  END;
  v_fan_loss := GREATEST(10, FLOOR(v_gig.total_fans * 0.05));
  
  UPDATE gigs SET status = 'cancelled', cancelled_reason = 'Player not in city: ' || p_reason WHERE id = p_gig_id;
  
  UPDATE bands
  SET band_balance = band_balance - v_booking_fee - (v_estimated_revenue * 0.25),
      fame = GREATEST(0, fame - v_fame_penalty),
      total_fans = GREATEST(0, total_fans - v_fan_loss)
  WHERE id = v_gig.band_id;
  
  UPDATE venue_relationships
  SET loyalty_points = GREATEST(0, loyalty_points - 30),
      relationship_tier = CASE
        WHEN loyalty_points - 30 < 20 THEN 'newcomer'
        WHEN loyalty_points - 30 < 50 THEN 'regular'
        WHEN loyalty_points - 30 < 100 THEN 'favorite'
        ELSE relationship_tier
      END
  WHERE band_id = v_gig.band_id AND venue_id = v_gig.venue_id;
  
  INSERT INTO activity_feed (user_id, activity_type, message, metadata)
  VALUES (
    v_gig.leader_id, 'missed_gig',
    'You missed your gig! Fans are disappointed and you lost fame.',
    jsonb_build_object('gig_id', p_gig_id, 'fame_penalty', v_fame_penalty, 'fan_loss', v_fan_loss, 'financial_penalty', v_booking_fee + (v_estimated_revenue * 0.25))
  );
  
  RETURN jsonb_build_object('success', true, 'fame_penalty', v_fame_penalty, 'fan_loss', v_fan_loss, 'financial_penalty', v_booking_fee + (v_estimated_revenue * 0.25));
END;
$$;