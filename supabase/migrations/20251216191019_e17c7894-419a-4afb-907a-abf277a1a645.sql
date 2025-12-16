-- Table to track fan conversions from gigs
CREATE TABLE public.gig_fan_conversions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  gig_id UUID NOT NULL REFERENCES public.gigs(id) ON DELETE CASCADE,
  band_id UUID NOT NULL REFERENCES public.bands(id) ON DELETE CASCADE,
  attendance_count INTEGER NOT NULL DEFAULT 0,
  new_fans_gained INTEGER NOT NULL DEFAULT 0,
  repeat_fans INTEGER NOT NULL DEFAULT 0,
  superfans_converted INTEGER NOT NULL DEFAULT 0,
  conversion_rate NUMERIC(5,2) DEFAULT 0,
  fan_demographics JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(gig_id)
);

-- Table to track band's fan base by city
CREATE TABLE public.band_city_fans (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  band_id UUID NOT NULL REFERENCES public.bands(id) ON DELETE CASCADE,
  city_id UUID REFERENCES public.cities(id) ON DELETE SET NULL,
  city_name TEXT NOT NULL,
  total_fans INTEGER NOT NULL DEFAULT 0,
  casual_fans INTEGER NOT NULL DEFAULT 0,
  dedicated_fans INTEGER NOT NULL DEFAULT 0,
  superfans INTEGER NOT NULL DEFAULT 0,
  last_gig_date TIMESTAMP WITH TIME ZONE,
  gigs_in_city INTEGER NOT NULL DEFAULT 0,
  avg_satisfaction NUMERIC(5,2) DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(band_id, city_id)
);

-- Add fan tracking columns to bands table
ALTER TABLE public.bands
ADD COLUMN IF NOT EXISTS total_fans INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS casual_fans INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS dedicated_fans INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS superfans INTEGER DEFAULT 0;

-- Add fan conversion columns to gig_outcomes
ALTER TABLE public.gig_outcomes
ADD COLUMN IF NOT EXISTS casual_fans_gained INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS dedicated_fans_gained INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS superfans_gained INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS repeat_attendees INTEGER DEFAULT 0;

-- Enable RLS
ALTER TABLE public.gig_fan_conversions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.band_city_fans ENABLE ROW LEVEL SECURITY;

-- RLS Policies for gig_fan_conversions
CREATE POLICY "Band members can view fan conversions" ON public.gig_fan_conversions
  FOR SELECT USING (
    band_id IN (SELECT band_id FROM band_members WHERE user_id = auth.uid())
  );

CREATE POLICY "System can insert fan conversions" ON public.gig_fan_conversions
  FOR INSERT WITH CHECK (true);

-- RLS Policies for band_city_fans
CREATE POLICY "Band members can view city fans" ON public.band_city_fans
  FOR SELECT USING (
    band_id IN (SELECT band_id FROM band_members WHERE user_id = auth.uid())
  );

CREATE POLICY "System can manage city fans" ON public.band_city_fans
  FOR ALL USING (true);

-- Create indexes
CREATE INDEX idx_gig_fan_conversions_band ON public.gig_fan_conversions(band_id);
CREATE INDEX idx_band_city_fans_band ON public.band_city_fans(band_id);
CREATE INDEX idx_band_city_fans_city ON public.band_city_fans(city_id);