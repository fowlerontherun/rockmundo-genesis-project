-- First, check if we have existing songs table and handle it
DROP TABLE IF EXISTS public.songs CASCADE;

-- Create songs table with proper structure
CREATE TABLE public.songs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  title TEXT NOT NULL,
  genre TEXT NOT NULL,
  lyrics TEXT,
  quality_score INTEGER NOT NULL DEFAULT 50,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'recorded', 'released')),
  streams INTEGER NOT NULL DEFAULT 0,
  revenue DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  chart_position INTEGER,
  release_date TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.songs ENABLE ROW LEVEL SECURITY;

-- Create policies for songs
CREATE POLICY "Users can view their own songs" 
ON public.songs 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own songs" 
ON public.songs 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own songs" 
ON public.songs 
FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own songs" 
ON public.songs 
FOR DELETE 
USING (auth.uid() = user_id);

-- Fix player_equipment table structure
ALTER TABLE public.player_equipment 
ADD COLUMN IF NOT EXISTS equipped BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS condition INTEGER DEFAULT 100,
ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE DEFAULT now();

-- Update existing records
UPDATE public.player_equipment 
SET equipped = COALESCE(is_equipped, false), 
    condition = 100,
    created_at = COALESCE(created_at, now())
WHERE equipped IS NULL OR condition IS NULL OR created_at IS NULL;

-- Add fans column to profiles table
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS fans INTEGER DEFAULT 0;

-- Add gig_performances table
CREATE TABLE IF NOT EXISTS public.gig_performances (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  gig_id UUID,
  performance_score INTEGER,
  earnings DECIMAL(10,2),
  performed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS for gig_performances
ALTER TABLE public.gig_performances ENABLE ROW LEVEL SECURITY;

-- Create policies for gig_performances
CREATE POLICY "Users can view their own gig performances" 
ON public.gig_performances 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own gig performances" 
ON public.gig_performances 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

-- Add missing skill columns
ALTER TABLE public.player_skills 
ADD COLUMN IF NOT EXISTS creativity INTEGER DEFAULT 10,
ADD COLUMN IF NOT EXISTS technical INTEGER DEFAULT 10,
ADD COLUMN IF NOT EXISTS business INTEGER DEFAULT 10,
ADD COLUMN IF NOT EXISTS marketing INTEGER DEFAULT 10,
ADD COLUMN IF NOT EXISTS composition INTEGER DEFAULT 10;

-- Create trigger for songs
CREATE OR REPLACE FUNCTION public.update_songs_updated_at()
RETURNS TRIGGER AS $$
BEGIN
NEW.updated_at = now();
RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_songs_updated_at
BEFORE UPDATE ON public.songs
FOR EACH ROW
EXECUTE FUNCTION public.update_songs_updated_at();