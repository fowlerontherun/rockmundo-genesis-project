-- Create hospitals table (one per city)
CREATE TABLE public.hospitals (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  city_id uuid NOT NULL REFERENCES public.cities(id) ON DELETE CASCADE,
  name text NOT NULL,
  cost_per_day integer NOT NULL DEFAULT 500,
  effectiveness_rating integer NOT NULL DEFAULT 50 CHECK (effectiveness_rating >= 1 AND effectiveness_rating <= 100),
  description text,
  is_free boolean NOT NULL DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(city_id)
);

-- Enable RLS
ALTER TABLE public.hospitals ENABLE ROW LEVEL SECURITY;

-- Everyone can view hospitals
CREATE POLICY "Hospitals are viewable by everyone"
ON public.hospitals FOR SELECT
USING (true);

-- Add health and energy to profiles if not exists
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS health integer NOT NULL DEFAULT 100 CHECK (health >= 0 AND health <= 100),
ADD COLUMN IF NOT EXISTS energy integer NOT NULL DEFAULT 100 CHECK (energy >= 0 AND energy <= 100);

-- Create player hospitalizations table
CREATE TABLE public.player_hospitalizations (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  hospital_id uuid NOT NULL REFERENCES public.hospitals(id),
  admitted_at timestamp with time zone NOT NULL DEFAULT now(),
  expected_discharge_at timestamp with time zone NOT NULL,
  discharged_at timestamp with time zone,
  health_on_admission integer NOT NULL,
  total_cost integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'admitted' CHECK (status IN ('admitted', 'discharged', 'escaped')),
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.player_hospitalizations ENABLE ROW LEVEL SECURITY;

-- Users can view their own hospitalizations
CREATE POLICY "Users can view their own hospitalizations"
ON public.player_hospitalizations FOR SELECT
USING (auth.uid() = user_id);

-- System can create hospitalizations
CREATE POLICY "System can create hospitalizations"
ON public.player_hospitalizations FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- System can update hospitalizations
CREATE POLICY "System can update hospitalizations"
ON public.player_hospitalizations FOR UPDATE
USING (auth.uid() = user_id);

-- Create index for faster lookups
CREATE INDEX idx_hospitalizations_user_status ON public.player_hospitalizations(user_id, status);
CREATE INDEX idx_hospitals_city ON public.hospitals(city_id);

-- Insert hospitals for existing cities (UK cities are free)
INSERT INTO public.hospitals (city_id, name, cost_per_day, effectiveness_rating, is_free, description)
SELECT 
  c.id,
  c.name || ' General Hospital',
  CASE 
    WHEN c.country = 'United Kingdom' THEN 0
    WHEN c.country = 'United States' THEN 800
    WHEN c.country = 'Germany' THEN 200
    WHEN c.country = 'France' THEN 150
    WHEN c.country = 'Japan' THEN 300
    WHEN c.country = 'Australia' THEN 250
    ELSE 400
  END,
  CASE 
    WHEN c.population > 5000000 THEN 90
    WHEN c.population > 1000000 THEN 80
    WHEN c.population > 500000 THEN 70
    ELSE 60
  END,
  c.country = 'United Kingdom',
  'Main hospital serving ' || c.name
FROM public.cities c
ON CONFLICT (city_id) DO NOTHING;

-- Create trigger to update updated_at
CREATE OR REPLACE FUNCTION update_hospitals_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_hospitals_updated_at
BEFORE UPDATE ON public.hospitals
FOR EACH ROW
EXECUTE FUNCTION update_hospitals_updated_at();