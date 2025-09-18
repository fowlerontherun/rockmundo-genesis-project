-- Continue cleaning up duplicate and conflicting tables
-- Remove all duplicate city table definitions

-- Drop all conflicting cities tables
DROP TABLE IF EXISTS public.cities CASCADE;

-- Create a single clean cities table
CREATE TABLE IF NOT EXISTS public.cities (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    name VARCHAR NOT NULL,
    country VARCHAR NOT NULL,
    population INTEGER DEFAULT 0,
    cost_of_living INTEGER DEFAULT 100,
    music_scene INTEGER DEFAULT 50,
    local_bonus INTEGER DEFAULT 0,
    dominant_genre VARCHAR,
    cultural_events TEXT[] DEFAULT '{}',
    venues INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.cities ENABLE ROW LEVEL SECURITY;

-- Create policy for cities
CREATE POLICY "Cities are viewable by everyone" 
ON public.cities 
FOR SELECT 
USING (true);

-- Drop any remaining conflicting tables that might cause duplicates
DROP TABLE IF EXISTS public.seasons CASCADE;
DROP TABLE IF EXISTS public.attribute_catalog CASCADE;
DROP TABLE IF EXISTS public.attribute_definitions CASCADE;
DROP TABLE IF EXISTS public.busking_locations CASCADE;
DROP TABLE IF EXISTS public.busking_modifiers CASCADE;
DROP TABLE IF EXISTS public.characters CASCADE;
DROP TABLE IF EXISTS public.character_attributes CASCADE;

-- Fix the security issues by setting search_path for functions
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql 
SECURITY DEFINER 
SET search_path = public;

-- Fix handle_new_user function to have proper search_path
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Create profile
  INSERT INTO public.profiles (user_id, username, display_name)
  VALUES (NEW.id, 
          COALESCE(NEW.raw_user_meta_data->>'username', 'Player' || substr(NEW.id::text, 1, 8)),
          COALESCE(NEW.raw_user_meta_data->>'display_name', 'New Player'));
  
  -- Assign default user role
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'user');
  
  -- Create initial skills
  INSERT INTO public.player_skills (user_id)
  VALUES (NEW.id);

  -- Create initial fan demographics
  INSERT INTO public.fan_demographics (user_id)
  VALUES (NEW.id);

  -- Create initial activity
  INSERT INTO public.activity_feed (user_id, activity_type, message)
  VALUES (NEW.id, 'join', 'Welcome to Rockmundo! Your musical journey begins now.');

  -- Grant "First Steps" achievement
  INSERT INTO public.player_achievements (user_id, achievement_id)
  SELECT NEW.id, id FROM public.achievements WHERE name = 'First Steps';

  RETURN NEW;
END;
$$;

-- Insert some sample cities
INSERT INTO public.cities (name, country, population, music_scene, dominant_genre) VALUES
('Nashville', 'USA', 700000, 95, 'Country'),
('Los Angeles', 'USA', 4000000, 90, 'Pop'),
('New York', 'USA', 8500000, 85, 'Hip-Hop'),
('London', 'UK', 9000000, 80, 'Rock'),
('Berlin', 'Germany', 3700000, 75, 'Electronic')
ON CONFLICT DO NOTHING;