-- Phase 1: Database Schema Enhancement for City System

-- Add city_id to venues table if not exists
ALTER TABLE public.venues ADD COLUMN IF NOT EXISTS city_id UUID REFERENCES public.cities(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_venues_city_id ON public.venues(city_id);

-- Ensure profiles.current_city_id has proper constraint
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_current_city_id_fkey;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_current_city_id_fkey 
  FOREIGN KEY (current_city_id) REFERENCES public.cities(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_profiles_current_city_id ON public.profiles(current_city_id);

-- Create city_districts table
CREATE TABLE IF NOT EXISTS public.city_districts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  city_id UUID REFERENCES public.cities(id) ON DELETE CASCADE NOT NULL,
  name VARCHAR NOT NULL,
  description TEXT,
  vibe VARCHAR,
  safety_rating INTEGER DEFAULT 50 CHECK (safety_rating >= 0 AND safety_rating <= 100),
  music_scene_rating INTEGER DEFAULT 50 CHECK (music_scene_rating >= 0 AND music_scene_rating <= 100),
  rent_cost INTEGER DEFAULT 100 CHECK (rent_cost >= 0),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_city_districts_city_id ON public.city_districts(city_id);

ALTER TABLE public.city_districts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "City districts are viewable by everyone"
  ON public.city_districts FOR SELECT
  USING (true);

CREATE POLICY "Admins can manage city districts"
  ON public.city_districts FOR ALL
  USING (public.has_role(auth.uid(), 'admin'));

-- Create city_studios table
CREATE TABLE IF NOT EXISTS public.city_studios (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  city_id UUID REFERENCES public.cities(id) ON DELETE CASCADE NOT NULL,
  district_id UUID REFERENCES public.city_districts(id) ON DELETE SET NULL,
  name VARCHAR NOT NULL,
  hourly_rate INTEGER NOT NULL CHECK (hourly_rate >= 0),
  quality_rating INTEGER DEFAULT 50 CHECK (quality_rating >= 0 AND quality_rating <= 100),
  specialties TEXT[],
  equipment_rating INTEGER DEFAULT 50 CHECK (equipment_rating >= 0 AND equipment_rating <= 100),
  available_slots INTEGER DEFAULT 10 CHECK (available_slots >= 0),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_city_studios_city_id ON public.city_studios(city_id);
CREATE INDEX IF NOT EXISTS idx_city_studios_district_id ON public.city_studios(district_id);

ALTER TABLE public.city_studios ENABLE ROW LEVEL SECURITY;

CREATE POLICY "City studios are viewable by everyone"
  ON public.city_studios FOR SELECT
  USING (true);

CREATE POLICY "Admins can manage city studios"
  ON public.city_studios FOR ALL
  USING (public.has_role(auth.uid(), 'admin'));

-- Create city_transport_routes table
CREATE TABLE IF NOT EXISTS public.city_transport_routes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  from_city_id UUID REFERENCES public.cities(id) ON DELETE CASCADE NOT NULL,
  to_city_id UUID REFERENCES public.cities(id) ON DELETE CASCADE NOT NULL,
  transport_type VARCHAR NOT NULL,
  duration_hours INTEGER NOT NULL CHECK (duration_hours > 0),
  base_cost INTEGER NOT NULL CHECK (base_cost >= 0),
  comfort_rating INTEGER DEFAULT 50 CHECK (comfort_rating >= 0 AND comfort_rating <= 100),
  frequency VARCHAR,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  CHECK (from_city_id != to_city_id)
);

CREATE INDEX IF NOT EXISTS idx_transport_routes_from_city ON public.city_transport_routes(from_city_id);
CREATE INDEX IF NOT EXISTS idx_transport_routes_to_city ON public.city_transport_routes(to_city_id);

ALTER TABLE public.city_transport_routes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Transport routes are viewable by everyone"
  ON public.city_transport_routes FOR SELECT
  USING (true);

CREATE POLICY "Admins can manage transport routes"
  ON public.city_transport_routes FOR ALL
  USING (public.has_role(auth.uid(), 'admin'));

-- Create player_travel_history table
CREATE TABLE IF NOT EXISTS public.player_travel_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  profile_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  from_city_id UUID REFERENCES public.cities(id) ON DELETE SET NULL,
  to_city_id UUID REFERENCES public.cities(id) ON DELETE SET NULL NOT NULL,
  transport_type VARCHAR NOT NULL,
  cost_paid INTEGER NOT NULL CHECK (cost_paid >= 0),
  travel_duration_hours INTEGER NOT NULL CHECK (travel_duration_hours > 0),
  departure_time TIMESTAMPTZ NOT NULL,
  arrival_time TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_travel_history_user_id ON public.player_travel_history(user_id);
CREATE INDEX IF NOT EXISTS idx_travel_history_profile_id ON public.player_travel_history(profile_id);
CREATE INDEX IF NOT EXISTS idx_travel_history_created_at ON public.player_travel_history(created_at DESC);

ALTER TABLE public.player_travel_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own travel history"
  ON public.player_travel_history FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own travel records"
  ON public.player_travel_history FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Phase 2: Seed London with Rich Data

-- Get London's city_id
DO $$
DECLARE
  london_id UUID;
  camden_id UUID;
  shoreditch_id UUID;
  soho_id UUID;
  brixton_id UUID;
  westminster_id UUID;
BEGIN
  -- Get or create London
  SELECT id INTO london_id FROM public.cities WHERE name = 'London' AND country = 'United Kingdom' LIMIT 1;
  
  IF london_id IS NULL THEN
    INSERT INTO public.cities (name, country, population, music_scene, cost_of_living, dominant_genre, venues, cultural_events)
    VALUES ('London', 'United Kingdom', 9000000, 95, 180, 'Rock', 50, ARRAY['Notting Hill Carnival', 'BBC Proms', 'Hyde Park British Summer Time'])
    RETURNING id INTO london_id;
  ELSE
    -- Update London with better data
    UPDATE public.cities 
    SET population = 9000000,
        music_scene = 95,
        cost_of_living = 180,
        dominant_genre = 'Rock',
        venues = 50,
        cultural_events = ARRAY['Notting Hill Carnival', 'BBC Proms', 'Hyde Park British Summer Time']
    WHERE id = london_id;
  END IF;

  -- Create London Districts
  INSERT INTO public.city_districts (city_id, name, description, vibe, safety_rating, music_scene_rating, rent_cost)
  VALUES 
    (london_id, 'Camden', 'Historic punk and alternative music hub with legendary venues', 'Alternative/Punk', 70, 90, 120)
    RETURNING id INTO camden_id;
  
  INSERT INTO public.city_districts (city_id, name, description, vibe, safety_rating, music_scene_rating, rent_cost)
  VALUES
    (london_id, 'Shoreditch', 'Trendy area known for indie, electronic, and experimental music', 'Indie/Electronic', 75, 95, 150)
    RETURNING id INTO shoreditch_id;
  
  INSERT INTO public.city_districts (city_id, name, description, vibe, safety_rating, music_scene_rating, rent_cost)
  VALUES
    (london_id, 'Soho', 'Historic entertainment district with jazz clubs and iconic venues', 'Jazz/Blues', 80, 100, 200)
    RETURNING id INTO soho_id;
  
  INSERT INTO public.city_districts (city_id, name, description, vibe, safety_rating, music_scene_rating, rent_cost)
  VALUES
    (london_id, 'Brixton', 'Vibrant multicultural area with reggae, hip-hop, and diverse sounds', 'Reggae/Hip-Hop', 65, 85, 110)
    RETURNING id INTO brixton_id;
  
  INSERT INTO public.city_districts (city_id, name, description, vibe, safety_rating, music_scene_rating, rent_cost)
  VALUES
    (london_id, 'Westminster', 'Prestigious area with classical venues and grand theaters', 'Classical/Theatre', 90, 80, 250)
    RETURNING id INTO westminster_id;

  -- Update existing venues to link to London and districts if they exist
  UPDATE public.venues SET city_id = london_id WHERE city_id IS NULL;

  -- Create London Studios
  INSERT INTO public.city_studios (city_id, district_id, name, hourly_rate, quality_rating, specialties, equipment_rating, available_slots)
  VALUES
    (london_id, camden_id, 'Camden Sound Studio', 50, 60, ARRAY['recording', 'mixing'], 65, 15),
    (london_id, shoreditch_id, 'Electric East Studios', 150, 80, ARRAY['production', 'mixing', 'mastering'], 85, 8),
    (london_id, soho_id, 'Soho Recording Complex', 300, 95, ARRAY['production', 'recording', 'mixing', 'mastering'], 98, 5),
    (london_id, soho_id, 'Abbey Road Studios', 500, 100, ARRAY['production', 'recording', 'mixing', 'mastering'], 100, 3),
    (london_id, brixton_id, 'Brixton Beats Studio', 80, 70, ARRAY['recording', 'production'], 75, 12),
    (london_id, westminster_id, 'Royal Sound Studios', 400, 92, ARRAY['recording', 'mastering'], 95, 6);

  -- Set all existing players' current_city_id to London if NULL
  UPDATE public.profiles SET current_city_id = london_id WHERE current_city_id IS NULL;

END $$;