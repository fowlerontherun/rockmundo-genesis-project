-- Create game_calendar_config table
CREATE TABLE IF NOT EXISTS public.game_calendar_config (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  real_world_days_per_game_year INTEGER NOT NULL DEFAULT 120,
  real_world_days_per_game_month INTEGER NOT NULL DEFAULT 10,
  season_start_months JSONB NOT NULL DEFAULT '{"spring": [3,4,5], "summer": [6,7,8], "autumn": [9,10,11], "winter": [12,1,2]}'::jsonb,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create season_genre_modifiers table
CREATE TABLE IF NOT EXISTS public.season_genre_modifiers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  season TEXT NOT NULL CHECK (season IN ('spring', 'summer', 'autumn', 'winter')),
  genre TEXT NOT NULL,
  streams_multiplier NUMERIC NOT NULL DEFAULT 1.0,
  sales_multiplier NUMERIC NOT NULL DEFAULT 1.0,
  gig_attendance_multiplier NUMERIC NOT NULL DEFAULT 1.0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(season, genre)
);

-- Create seasonal_weather_patterns table
CREATE TABLE IF NOT EXISTS public.seasonal_weather_patterns (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  city_id UUID NOT NULL REFERENCES public.cities(id) ON DELETE CASCADE,
  season TEXT NOT NULL CHECK (season IN ('spring', 'summer', 'autumn', 'winter')),
  weather_conditions JSONB NOT NULL DEFAULT '{"sunny": 0.6, "cloudy": 0.25, "rainy": 0.1, "stormy": 0.04, "snowy": 0.01}'::jsonb,
  avg_temperature_celsius INTEGER NOT NULL DEFAULT 15,
  travel_disruption_chance NUMERIC NOT NULL DEFAULT 0.1 CHECK (travel_disruption_chance >= 0 AND travel_disruption_chance <= 1),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(city_id, season)
);

-- Create player_birthday_rewards table
CREATE TABLE IF NOT EXISTS public.player_birthday_rewards (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  profile_id UUID NOT NULL,
  game_year INTEGER NOT NULL,
  xp_awarded INTEGER NOT NULL DEFAULT 250,
  cash_awarded INTEGER NOT NULL DEFAULT 500,
  claimed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(profile_id, game_year)
);

-- Create travel_disruption_events table
CREATE TABLE IF NOT EXISTS public.travel_disruption_events (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  route_id UUID REFERENCES public.city_transport_routes(id) ON DELETE CASCADE,
  disruption_type TEXT NOT NULL CHECK (disruption_type IN ('delayed', 'cancelled', 'expensive')),
  cause TEXT NOT NULL,
  severity INTEGER NOT NULL DEFAULT 1 CHECK (severity >= 1 AND severity <= 5),
  cost_multiplier NUMERIC NOT NULL DEFAULT 1.0,
  delay_hours INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ends_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Add character_birth_date to profiles table
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS character_birth_date DATE;

-- Enable RLS on new tables
ALTER TABLE public.game_calendar_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.season_genre_modifiers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.seasonal_weather_patterns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.player_birthday_rewards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.travel_disruption_events ENABLE ROW LEVEL SECURITY;

-- RLS Policies for game_calendar_config
CREATE POLICY "Calendar config is viewable by everyone"
  ON public.game_calendar_config FOR SELECT
  USING (true);

CREATE POLICY "Admins can manage calendar config"
  ON public.game_calendar_config FOR ALL
  USING (has_role(auth.uid(), 'admin'));

-- RLS Policies for season_genre_modifiers
CREATE POLICY "Season modifiers are viewable by everyone"
  ON public.season_genre_modifiers FOR SELECT
  USING (is_active = true);

CREATE POLICY "Admins can manage season modifiers"
  ON public.season_genre_modifiers FOR ALL
  USING (has_role(auth.uid(), 'admin'));

-- RLS Policies for seasonal_weather_patterns
CREATE POLICY "Weather patterns are viewable by everyone"
  ON public.seasonal_weather_patterns FOR SELECT
  USING (true);

CREATE POLICY "Admins can manage weather patterns"
  ON public.seasonal_weather_patterns FOR ALL
  USING (has_role(auth.uid(), 'admin'));

-- RLS Policies for player_birthday_rewards
CREATE POLICY "Users can view their own birthday rewards"
  ON public.player_birthday_rewards FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can claim their own birthday rewards"
  ON public.player_birthday_rewards FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can view all birthday rewards"
  ON public.player_birthday_rewards FOR SELECT
  USING (has_role(auth.uid(), 'admin'));

-- RLS Policies for travel_disruption_events
CREATE POLICY "Active disruptions are viewable by everyone"
  ON public.travel_disruption_events FOR SELECT
  USING (is_active = true);

CREATE POLICY "Admins can manage disruption events"
  ON public.travel_disruption_events FOR ALL
  USING (has_role(auth.uid(), 'admin'));

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_player_birthday_rewards_profile_year ON public.player_birthday_rewards(profile_id, game_year);
CREATE INDEX IF NOT EXISTS idx_travel_disruption_events_route_active ON public.travel_disruption_events(route_id, is_active);
CREATE INDEX IF NOT EXISTS idx_season_genre_modifiers_season_genre ON public.season_genre_modifiers(season, genre);
CREATE INDEX IF NOT EXISTS idx_seasonal_weather_patterns_city_season ON public.seasonal_weather_patterns(city_id, season);

-- Insert default calendar config
INSERT INTO public.game_calendar_config (real_world_days_per_game_year, real_world_days_per_game_month, is_active)
VALUES (120, 10, true)
ON CONFLICT DO NOTHING;

-- Insert default season modifiers for popular genres
INSERT INTO public.season_genre_modifiers (season, genre, streams_multiplier, sales_multiplier, gig_attendance_multiplier) VALUES
('summer', 'Dance', 1.3, 1.1, 1.2),
('summer', 'Electronic', 1.3, 1.1, 1.2),
('summer', 'Pop', 1.1, 1.0, 1.15),
('winter', 'Pop', 1.2, 1.5, 1.0),
('winter', 'Rock', 1.0, 1.0, 0.9),
('spring', 'Indie', 1.1, 1.0, 1.1),
('autumn', 'Jazz', 1.0, 1.1, 1.0)
ON CONFLICT (season, genre) DO NOTHING;