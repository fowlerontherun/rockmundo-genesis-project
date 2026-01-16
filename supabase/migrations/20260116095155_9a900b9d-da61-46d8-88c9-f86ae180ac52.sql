-- ============================================
-- Phase 1: Radio System Overhaul & Regional Fame (v1.0.362)
-- ============================================

-- 1. Create radio_invitations table for Phase 3 (if not exists)
CREATE TABLE IF NOT EXISTS public.radio_invitations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  station_id uuid NOT NULL REFERENCES radio_stations(id) ON DELETE CASCADE,
  band_id uuid NOT NULL REFERENCES bands(id) ON DELETE CASCADE,
  invitation_type text NOT NULL CHECK (invitation_type IN ('interview', 'live_lounge', 'guest_dj')),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'declined', 'completed', 'expired')),
  scheduled_at timestamptz,
  expires_at timestamptz DEFAULT (now() + interval '7 days'),
  fame_reward integer DEFAULT 0,
  fan_reward integer DEFAULT 0,
  xp_reward integer DEFAULT 0,
  show_id uuid REFERENCES radio_shows(id),
  created_at timestamptz DEFAULT now(),
  responded_at timestamptz,
  completed_at timestamptz
);

-- Add RLS policies (only if table was just created)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'radio_invitations' AND policyname = 'Users can view their band invitations') THEN
    ALTER TABLE radio_invitations ENABLE ROW LEVEL SECURITY;
    
    CREATE POLICY "Users can view their band invitations" ON radio_invitations
      FOR SELECT USING (
        band_id IN (
          SELECT bm.band_id FROM band_members bm WHERE bm.user_id = auth.uid()
        )
      );
    
    CREATE POLICY "Users can update their band invitations" ON radio_invitations
      FOR UPDATE USING (
        band_id IN (
          SELECT bm.band_id FROM band_members bm WHERE bm.user_id = auth.uid()
        )
      );
  END IF;
END $$;

-- 2. Seed local radio stations for major cities
INSERT INTO radio_stations (name, station_type, city_id, country, quality_level, listener_base, is_active, accepted_genres, min_fame_required)
SELECT 
  c.name || ' FM' as name,
  'local' as station_type,
  c.id as city_id,
  c.country as country,
  CASE 
    WHEN c.population > 10000000 THEN 4
    WHEN c.population > 5000000 THEN 3
    WHEN c.population > 1000000 THEN 2
    ELSE 1
  END as quality_level,
  GREATEST(5000, LEAST(100000, (c.population * 0.001)::integer)) as listener_base,
  true as is_active,
  CASE 
    WHEN c.country IN ('USA', 'United Kingdom', 'Australia', 'Canada') THEN ARRAY['Pop', 'Rock', 'Hip Hop', 'Country', 'R&B']
    WHEN c.country IN ('Japan', 'South Korea') THEN ARRAY['K-Pop/J-Pop', 'Pop', 'Hip Hop', 'EDM']
    WHEN c.country IN ('Brazil', 'Mexico', 'Argentina', 'Colombia', 'Chile', 'Peru') THEN ARRAY['Latin', 'Pop', 'Reggae', 'Hip Hop']
    WHEN c.country IN ('Nigeria', 'Kenya', 'South Africa') THEN ARRAY['Afrobeats/Amapiano', 'African Music', 'Hip Hop', 'R&B']
    WHEN c.country IN ('Germany', 'France', 'Netherlands', 'Belgium') THEN ARRAY['EDM', 'Pop', 'Hip Hop', 'Electronica']
    WHEN c.country IN ('Spain') THEN ARRAY['Latin', 'Flamenco', 'Pop', 'Rock']
    WHEN c.country IN ('India') THEN ARRAY['World Music', 'Pop', 'Hip Hop', 'EDM']
    WHEN c.country IN ('China', 'Thailand', 'Indonesia', 'Philippines', 'Taiwan', 'Singapore') THEN ARRAY['Pop', 'K-Pop/J-Pop', 'EDM', 'Hip Hop']
    WHEN c.country IN ('Russia', 'Poland', 'Czech Republic', 'Hungary') THEN ARRAY['Pop', 'Rock', 'EDM', 'Heavy Metal']
    WHEN c.country IN ('Turkey', 'Egypt', 'UAE') THEN ARRAY['Pop', 'World Music', 'Hip Hop', 'EDM']
    ELSE ARRAY['Pop', 'Rock', 'Hip Hop']
  END as accepted_genres,
  CASE 
    WHEN c.population > 10000000 THEN 100
    WHEN c.population > 5000000 THEN 50
    ELSE 0
  END as min_fame_required
FROM cities c
WHERE c.population > 500000
AND NOT EXISTS (
  SELECT 1 FROM radio_stations rs 
  WHERE rs.city_id = c.id AND rs.station_type = 'local'
)
LIMIT 80;

-- Also add Community Radio stations
INSERT INTO radio_stations (name, station_type, city_id, country, quality_level, listener_base, is_active, accepted_genres, min_fame_required)
SELECT 
  c.name || ' Community Radio' as name,
  'local' as station_type,
  c.id as city_id,
  c.country as country,
  1 as quality_level,
  GREATEST(1000, LEAST(20000, (c.population * 0.002)::integer)) as listener_base,
  true as is_active,
  ARRAY['Indie/Bedroom Pop', 'Lo-Fi Hip Hop', 'Alt R&B/Neo-Soul', 'Synthwave', 'Rock'] as accepted_genres,
  0 as min_fame_required
FROM cities c
WHERE c.population > 500000
AND NOT EXISTS (
  SELECT 1 FROM radio_stations rs 
  WHERE rs.city_id = c.id AND rs.name LIKE '%Community%'
)
LIMIT 50;

-- 3. Add radio shows using CORRECT time_slot values (morning_drive, midday, afternoon_drive, evening, late_night, overnight, weekend)
INSERT INTO radio_shows (station_id, show_name, host_name, time_slot, is_active, listener_multiplier)
SELECT 
  rs.id,
  'Morning Drive',
  CASE 
    WHEN rs.country = 'USA' THEN 'Johnny K'
    WHEN rs.country = 'United Kingdom' THEN 'Dave Thompson'
    WHEN rs.country = 'Japan' THEN 'Yuki Tanaka'
    WHEN rs.country = 'Brazil' THEN 'Carlos Silva'
    WHEN rs.country = 'Germany' THEN 'Max Weber'
    ELSE 'DJ Morning'
  END,
  'morning_drive',
  true,
  1.8
FROM radio_stations rs
WHERE NOT EXISTS (
  SELECT 1 FROM radio_shows rsh 
  WHERE rsh.station_id = rs.id AND rsh.time_slot = 'morning_drive'
)
AND rs.is_active = true;

INSERT INTO radio_shows (station_id, show_name, host_name, time_slot, is_active, listener_multiplier)
SELECT 
  rs.id,
  'Midday Mix',
  'DJ Noon',
  'midday',
  true,
  1.0
FROM radio_stations rs
WHERE NOT EXISTS (
  SELECT 1 FROM radio_shows rsh 
  WHERE rsh.station_id = rs.id AND rsh.time_slot = 'midday'
)
AND rs.is_active = true;

INSERT INTO radio_shows (station_id, show_name, host_name, time_slot, is_active, listener_multiplier)
SELECT 
  rs.id,
  'Afternoon Drive',
  'DJ Rush',
  'afternoon_drive',
  true,
  1.5
FROM radio_stations rs
WHERE NOT EXISTS (
  SELECT 1 FROM radio_shows rsh 
  WHERE rsh.station_id = rs.id AND rsh.time_slot = 'afternoon_drive'
)
AND rs.is_active = true;

INSERT INTO radio_shows (station_id, show_name, host_name, time_slot, is_active, listener_multiplier)
SELECT 
  rs.id,
  'Evening Vibes',
  'DJ Sunset',
  'evening',
  true,
  1.3
FROM radio_stations rs
WHERE NOT EXISTS (
  SELECT 1 FROM radio_shows rsh 
  WHERE rsh.station_id = rs.id AND rsh.time_slot = 'evening'
)
AND rs.is_active = true;

INSERT INTO radio_shows (station_id, show_name, host_name, time_slot, is_active, listener_multiplier)
SELECT 
  rs.id,
  'Late Night Sessions',
  'DJ Midnight',
  'late_night',
  true,
  0.5
FROM radio_stations rs
WHERE NOT EXISTS (
  SELECT 1 FROM radio_shows rsh 
  WHERE rsh.station_id = rs.id AND rsh.time_slot = 'late_night'
)
AND rs.is_active = true;

-- 4. Add country column to release_sales for regional tracking
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'release_sales' AND column_name = 'country'
  ) THEN
    ALTER TABLE release_sales ADD COLUMN country text;
  END IF;
END $$;

-- 5. Create utility function to get band country fame
CREATE OR REPLACE FUNCTION get_band_country_fame(p_band_id uuid, p_country text)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_fame integer;
BEGIN
  SELECT fame INTO v_fame
  FROM band_country_fans
  WHERE band_id = p_band_id AND country = p_country;
  
  RETURN COALESCE(v_fame, 0);
END;
$$;

-- 6. Create utility function to add band country fame
CREATE OR REPLACE FUNCTION add_band_country_fame(
  p_band_id uuid, 
  p_country text, 
  p_fame_amount integer DEFAULT 0,
  p_fans_amount integer DEFAULT 0
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO band_country_fans (band_id, country, fame, total_fans, casual_fans, updated_at)
  VALUES (p_band_id, p_country, p_fame_amount, p_fans_amount, p_fans_amount, now())
  ON CONFLICT (band_id, country) 
  DO UPDATE SET 
    fame = band_country_fans.fame + EXCLUDED.fame,
    total_fans = band_country_fans.total_fans + EXCLUDED.total_fans,
    casual_fans = band_country_fans.casual_fans + EXCLUDED.total_fans,
    updated_at = now();
END;
$$;

-- 7. Update national stations to have minimum fame requirements based on quality
UPDATE radio_stations
SET min_fame_required = CASE
  WHEN quality_level >= 8 THEN 5000
  WHEN quality_level >= 6 THEN 2000
  WHEN quality_level >= 4 THEN 500
  WHEN quality_level >= 2 THEN 100
  ELSE 0
END
WHERE station_type = 'national' AND (min_fame_required IS NULL OR min_fame_required = 0);