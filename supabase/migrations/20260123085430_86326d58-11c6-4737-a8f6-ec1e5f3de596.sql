-- Add ticket price adjustment columns to gigs
ALTER TABLE public.gigs 
ADD COLUMN IF NOT EXISTS original_ticket_price numeric DEFAULT NULL,
ADD COLUMN IF NOT EXISTS price_adjusted_at timestamp with time zone DEFAULT NULL,
ADD COLUMN IF NOT EXISTS ticket_operator_id text DEFAULT NULL;

-- Add ticket operator to tours
ALTER TABLE public.tours 
ADD COLUMN IF NOT EXISTS ticket_operator_id text DEFAULT NULL;

-- Add has_performed to band_country_fans
ALTER TABLE public.band_country_fans 
ADD COLUMN IF NOT EXISTS has_performed boolean DEFAULT false;

-- Add tout attendance reduction to gig_outcomes
ALTER TABLE public.gig_outcomes 
ADD COLUMN IF NOT EXISTS tout_attendance_reduction integer DEFAULT 0;

-- Create country adjacency table for fame spillover
CREATE TABLE IF NOT EXISTS public.country_adjacency (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  country text NOT NULL,
  neighbor text NOT NULL,
  spillover_rate numeric DEFAULT 0.2,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(country, neighbor)
);

-- Enable RLS
ALTER TABLE public.country_adjacency ENABLE ROW LEVEL SECURITY;

-- Create policy for reading country adjacency (public read)
CREATE POLICY "Anyone can read country adjacency" 
ON public.country_adjacency 
FOR SELECT 
USING (true);

-- Insert major country adjacencies (Europe, Americas, Asia-Pacific)
INSERT INTO public.country_adjacency (country, neighbor) VALUES
-- Europe
('United Kingdom', 'Ireland'), ('Ireland', 'United Kingdom'),
('United Kingdom', 'France'), ('France', 'United Kingdom'),
('France', 'Germany'), ('Germany', 'France'),
('France', 'Spain'), ('Spain', 'France'),
('France', 'Italy'), ('Italy', 'France'),
('France', 'Belgium'), ('Belgium', 'France'),
('Germany', 'Netherlands'), ('Netherlands', 'Germany'),
('Germany', 'Belgium'), ('Belgium', 'Germany'),
('Germany', 'Austria'), ('Austria', 'Germany'),
('Germany', 'Switzerland'), ('Switzerland', 'Germany'),
('Germany', 'Poland'), ('Poland', 'Germany'),
('Italy', 'Switzerland'), ('Switzerland', 'Italy'),
('Italy', 'Austria'), ('Austria', 'Italy'),
('Spain', 'Portugal'), ('Portugal', 'Spain'),
('Netherlands', 'Belgium'), ('Belgium', 'Netherlands'),
('Austria', 'Switzerland'), ('Switzerland', 'Austria'),
('Poland', 'Czech Republic'), ('Czech Republic', 'Poland'),
('Sweden', 'Norway'), ('Norway', 'Sweden'),
('Sweden', 'Denmark'), ('Denmark', 'Sweden'),
('Sweden', 'Finland'), ('Finland', 'Sweden'),
('Norway', 'Finland'), ('Finland', 'Norway'),
-- Americas
('United States', 'Canada'), ('Canada', 'United States'),
('United States', 'Mexico'), ('Mexico', 'United States'),
('Mexico', 'Guatemala'), ('Guatemala', 'Mexico'),
('Brazil', 'Argentina'), ('Argentina', 'Brazil'),
('Brazil', 'Colombia'), ('Colombia', 'Brazil'),
('Argentina', 'Chile'), ('Chile', 'Argentina'),
('Colombia', 'Venezuela'), ('Venezuela', 'Colombia'),
-- Asia-Pacific
('Japan', 'South Korea'), ('South Korea', 'Japan'),
('China', 'Japan'), ('Japan', 'China'),
('China', 'South Korea'), ('South Korea', 'China'),
('Australia', 'New Zealand'), ('New Zealand', 'Australia'),
('India', 'Pakistan'), ('Pakistan', 'India'),
('Thailand', 'Vietnam'), ('Vietnam', 'Thailand'),
('Thailand', 'Malaysia'), ('Malaysia', 'Thailand'),
('Malaysia', 'Singapore'), ('Singapore', 'Malaysia'),
('Indonesia', 'Malaysia'), ('Malaysia', 'Indonesia'),
('Indonesia', 'Australia'), ('Australia', 'Indonesia')
ON CONFLICT (country, neighbor) DO NOTHING;

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_country_adjacency_country ON public.country_adjacency(country);
CREATE INDEX IF NOT EXISTS idx_country_adjacency_neighbor ON public.country_adjacency(neighbor);