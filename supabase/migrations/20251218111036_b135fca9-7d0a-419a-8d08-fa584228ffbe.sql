-- Phase 1: Database Schema Expansion for Fame, Fans & Demographics

-- Age demographics with genre preferences
CREATE TABLE IF NOT EXISTS public.age_demographics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  age_min int NOT NULL,
  age_max int NOT NULL,
  genre_preferences jsonb DEFAULT '{}',
  description text,
  created_at timestamptz DEFAULT now()
);

-- Band fans by country (aggregated from cities)
CREATE TABLE IF NOT EXISTS public.band_country_fans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  band_id uuid NOT NULL REFERENCES bands(id) ON DELETE CASCADE,
  country text NOT NULL,
  total_fans int DEFAULT 0,
  casual_fans int DEFAULT 0,
  dedicated_fans int DEFAULT 0,
  superfans int DEFAULT 0,
  fame int DEFAULT 0,
  last_activity_date timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(band_id, country)
);

-- Band fans by demographic per city
CREATE TABLE IF NOT EXISTS public.band_demographic_fans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  band_id uuid NOT NULL REFERENCES bands(id) ON DELETE CASCADE,
  demographic_id uuid NOT NULL REFERENCES age_demographics(id) ON DELETE CASCADE,
  city_id uuid REFERENCES cities(id) ON DELETE SET NULL,
  country text,
  fan_count int DEFAULT 0,
  engagement_rate numeric DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(band_id, demographic_id, city_id)
);

-- Fame history for tracking changes over time
CREATE TABLE IF NOT EXISTS public.band_fame_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  band_id uuid NOT NULL REFERENCES bands(id) ON DELETE CASCADE,
  city_id uuid REFERENCES cities(id) ON DELETE SET NULL,
  country text,
  scope text DEFAULT 'global', -- 'city', 'country', 'global'
  fame_value int NOT NULL,
  fame_change int DEFAULT 0,
  event_type text,
  recorded_at timestamptz DEFAULT now()
);

-- Extend band_city_fans with country reference
ALTER TABLE public.band_city_fans 
ADD COLUMN IF NOT EXISTS country text,
ADD COLUMN IF NOT EXISTS city_fame int DEFAULT 0;

-- Extend bands with regional fame tracking
ALTER TABLE public.bands 
ADD COLUMN IF NOT EXISTS regional_fame jsonb DEFAULT '{}',
ADD COLUMN IF NOT EXISTS global_fame int DEFAULT 0;

-- Extend radio_stations with requirements
ALTER TABLE public.radio_stations
ADD COLUMN IF NOT EXISTS min_fans_required int DEFAULT 0,
ADD COLUMN IF NOT EXISTS min_fame_required int DEFAULT 0,
ADD COLUMN IF NOT EXISTS requires_local_presence boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS auto_accept_threshold int DEFAULT 80;

-- Enable RLS on new tables
ALTER TABLE public.age_demographics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.band_country_fans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.band_demographic_fans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.band_fame_history ENABLE ROW LEVEL SECURITY;

-- RLS policies for age_demographics (public read)
CREATE POLICY "age_demographics_public_read" ON public.age_demographics
  FOR SELECT USING (true);

-- RLS policies for band_country_fans
CREATE POLICY "band_country_fans_public_read" ON public.band_country_fans
  FOR SELECT USING (true);

CREATE POLICY "band_country_fans_band_member_write" ON public.band_country_fans
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM band_members 
      WHERE band_members.band_id = band_country_fans.band_id 
      AND band_members.user_id = auth.uid()
    )
  );

-- RLS policies for band_demographic_fans  
CREATE POLICY "band_demographic_fans_public_read" ON public.band_demographic_fans
  FOR SELECT USING (true);

CREATE POLICY "band_demographic_fans_band_member_write" ON public.band_demographic_fans
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM band_members 
      WHERE band_members.band_id = band_demographic_fans.band_id 
      AND band_members.user_id = auth.uid()
    )
  );

-- RLS policies for band_fame_history
CREATE POLICY "band_fame_history_public_read" ON public.band_fame_history
  FOR SELECT USING (true);

CREATE POLICY "band_fame_history_band_member_write" ON public.band_fame_history
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM band_members 
      WHERE band_members.band_id = band_fame_history.band_id 
      AND band_members.user_id = auth.uid()
    )
  );

-- Seed age demographics with genre preferences
INSERT INTO public.age_demographics (name, age_min, age_max, genre_preferences, description) VALUES
('Gen Z', 13, 24, '{
  "Hip Hop": 1.4, "Trap": 1.5, "EDM": 1.3, "Pop": 1.2, "K-Pop/J-Pop": 1.5,
  "Hyperpop": 1.4, "Lo-Fi Hip Hop": 1.3, "Drill": 1.4, "Afrobeats/Amapiano": 1.3,
  "Synthwave": 1.1, "Indie/Bedroom Pop": 1.2, "Alt R&B/Neo-Soul": 1.2,
  "Rock": 0.7, "Classical": 0.4, "Jazz": 0.5, "Blues": 0.4, "Country": 0.5
}', 'Digital natives who grew up with streaming and social media'),

('Millennials', 25, 40, '{
  "Indie/Bedroom Pop": 1.3, "Alt R&B/Neo-Soul": 1.2, "EDM": 1.1, "Hip Hop": 1.1,
  "Pop": 1.1, "Modern Rock": 1.2, "Synthwave": 1.2, "Electronica": 1.1,
  "Rock": 0.9, "Punk Rock": 1.0, "R&B": 1.1, "Metalcore/Djent": 1.1,
  "Country": 0.7, "Classical": 0.6, "Jazz": 0.8, "Blues": 0.7
}', 'Grew up during the transition from physical media to digital'),

('Gen X', 41, 56, '{
  "Rock": 1.4, "Heavy Metal": 1.3, "Punk Rock": 1.2, "Blues": 1.2,
  "Modern Rock": 1.1, "Alternative": 1.2, "Country": 1.0, "R&B": 1.0,
  "Jazz": 1.0, "Classical": 0.9, "Reggae": 1.0, "World Music": 0.9,
  "Hip Hop": 0.7, "EDM": 0.5, "Trap": 0.3, "Hyperpop": 0.2, "K-Pop/J-Pop": 0.4
}', 'The MTV generation who witnessed the golden age of rock and grunge'),

('Boomers', 57, 99, '{
  "Classical": 1.4, "Jazz": 1.3, "Blues": 1.3, "Country": 1.2,
  "Rock": 1.2, "Flamenco": 1.1, "World Music": 1.1, "Reggae": 0.9,
  "R&B": 1.0, "Latin": 1.0, "African Music": 0.9, "Folk": 1.2,
  "Heavy Metal": 0.6, "Hip Hop": 0.4, "EDM": 0.3, "Trap": 0.2,
  "Hyperpop": 0.1, "K-Pop/J-Pop": 0.3, "Drill": 0.2
}', 'Experienced the birth of rock and roll and the classic album era')
ON CONFLICT DO NOTHING;

-- Update existing radio stations with requirements
UPDATE public.radio_stations SET
  min_fans_required = CASE 
    WHEN station_type = 'national' THEN 5000
    WHEN station_type = 'regional' THEN 500
    ELSE 50
  END,
  min_fame_required = CASE 
    WHEN station_type = 'national' THEN 1000
    WHEN station_type = 'regional' THEN 200
    ELSE 0
  END,
  requires_local_presence = CASE 
    WHEN station_type = 'local' THEN true
    ELSE false
  END,
  auto_accept_threshold = CASE 
    WHEN station_type = 'local' THEN 70
    WHEN station_type = 'regional' THEN 75
    ELSE 80
  END;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_band_country_fans_band_id ON public.band_country_fans(band_id);
CREATE INDEX IF NOT EXISTS idx_band_country_fans_country ON public.band_country_fans(country);
CREATE INDEX IF NOT EXISTS idx_band_demographic_fans_band_id ON public.band_demographic_fans(band_id);
CREATE INDEX IF NOT EXISTS idx_band_fame_history_band_id ON public.band_fame_history(band_id);
CREATE INDEX IF NOT EXISTS idx_band_fame_history_recorded_at ON public.band_fame_history(recorded_at DESC);