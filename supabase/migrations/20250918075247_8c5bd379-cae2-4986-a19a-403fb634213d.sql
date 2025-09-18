-- Clean up duplicate tables and conflicting schemas
-- This migration will remove duplicate table definitions and fix schema conflicts

-- First, let's clean up any duplicate or conflicting tables
-- Drop duplicate cities tables if they exist
DROP TABLE IF EXISTS public.cities_duplicate CASCADE;

-- Remove duplicate player_attributes tables
-- Keep only the main player_attributes table and remove conflicting ones
DROP TABLE IF EXISTS public.player_attributes_old CASCADE;
DROP TABLE IF EXISTS public.player_attributes_backup CASCADE;

-- Drop duplicate skill_definitions tables
DROP TABLE IF EXISTS public.skill_definitions_old CASCADE;
DROP TABLE IF EXISTS public.skill_definitions_backup CASCADE;

-- Ensure gigs table has the correct structure
-- Add missing show_type column if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'gigs' AND column_name = 'show_type') THEN
        ALTER TABLE public.gigs ADD COLUMN show_type VARCHAR DEFAULT 'concert';
    END IF;
END $$;

-- Add missing enum value for show_type if needed
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'show_type') THEN
        CREATE TYPE show_type_enum AS ENUM ('concert', 'festival', 'private', 'street');
    END IF;
EXCEPTION
    WHEN duplicate_object THEN
        -- Type already exists, that's fine
        NULL;
END$$;

-- Clean up any orphaned columns that might be causing conflicts
-- Fix profiles table to ensure it has the correct structure
ALTER TABLE public.profiles 
DROP COLUMN IF EXISTS current_city_id CASCADE;

-- Ensure player_attributes table has a consistent structure
-- Drop and recreate with proper structure if there are conflicts
DROP TABLE IF EXISTS public.player_attributes CASCADE;

CREATE TABLE IF NOT EXISTS public.player_attributes (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    profile_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    attribute_points INTEGER DEFAULT 0,
    charisma INTEGER DEFAULT 10,
    looks INTEGER DEFAULT 10,
    mental_focus INTEGER DEFAULT 10,
    musicality INTEGER DEFAULT 10,
    physical_endurance INTEGER DEFAULT 10,
    stage_presence INTEGER DEFAULT 10,
    crowd_engagement INTEGER DEFAULT 10,
    social_reach INTEGER DEFAULT 10,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.player_attributes ENABLE ROW LEVEL SECURITY;

-- Create policies for player_attributes
CREATE POLICY "Users can view their own attributes" 
ON public.player_attributes 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own attributes" 
ON public.player_attributes 
FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own attributes" 
ON public.player_attributes 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

-- Ensure skill_definitions has a consistent structure
DROP TABLE IF EXISTS public.skill_definitions CASCADE;

CREATE TABLE IF NOT EXISTS public.skill_definitions (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    slug VARCHAR NOT NULL UNIQUE,
    display_name VARCHAR NOT NULL,
    description TEXT,
    tier_caps JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.skill_definitions ENABLE ROW LEVEL SECURITY;

-- Create policy for skill_definitions
CREATE POLICY "Skill definitions are viewable by everyone" 
ON public.skill_definitions 
FOR SELECT 
USING (true);

-- Insert some basic skill definitions
INSERT INTO public.skill_definitions (slug, display_name, description) VALUES
('vocals', 'Vocals', 'Singing and vocal performance skills'),
('guitar', 'Guitar', 'Guitar playing and technique'),
('bass', 'Bass', 'Bass guitar playing skills'),
('drums', 'Drums', 'Drumming and rhythm skills'),
('songwriting', 'Songwriting', 'Ability to write and compose songs'),
('performance', 'Performance', 'Stage presence and live performance'),
('creativity', 'Creativity', 'Creative and artistic abilities'),
('technical', 'Technical', 'Technical music production skills'),
('business', 'Business', 'Music business and industry knowledge'),
('marketing', 'Marketing', 'Promotion and marketing skills')
ON CONFLICT (slug) DO NOTHING;

-- Create trigger for updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_player_attributes_updated_at
    BEFORE UPDATE ON public.player_attributes
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_skill_definitions_updated_at
    BEFORE UPDATE ON public.skill_definitions
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();