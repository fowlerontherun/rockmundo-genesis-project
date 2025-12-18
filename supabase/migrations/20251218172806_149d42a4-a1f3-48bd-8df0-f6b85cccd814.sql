-- Create open_mic_venues table
CREATE TABLE public.open_mic_venues (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  city_id UUID NOT NULL REFERENCES public.cities(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  day_of_week INTEGER NOT NULL CHECK (day_of_week >= 0 AND day_of_week <= 6),
  start_time TIME NOT NULL DEFAULT '20:00:00',
  capacity INTEGER NOT NULL DEFAULT 75,
  description TEXT,
  image_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create open_mic_performances table
CREATE TABLE public.open_mic_performances (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  band_id UUID REFERENCES public.bands(id) ON DELETE SET NULL,
  venue_id UUID NOT NULL REFERENCES public.open_mic_venues(id) ON DELETE CASCADE,
  scheduled_date TIMESTAMP WITH TIME ZONE NOT NULL,
  status TEXT NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'in_progress', 'completed', 'cancelled')),
  song_1_id UUID REFERENCES public.songs(id) ON DELETE SET NULL,
  song_2_id UUID REFERENCES public.songs(id) ON DELETE SET NULL,
  current_song_position INTEGER DEFAULT 0,
  overall_rating NUMERIC(4,2),
  fame_gained INTEGER DEFAULT 0,
  fans_gained INTEGER DEFAULT 0,
  started_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create open_mic_song_performances table
CREATE TABLE public.open_mic_song_performances (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  performance_id UUID NOT NULL REFERENCES public.open_mic_performances(id) ON DELETE CASCADE,
  song_id UUID NOT NULL REFERENCES public.songs(id) ON DELETE CASCADE,
  position INTEGER NOT NULL CHECK (position IN (1, 2)),
  performance_score NUMERIC(4,2),
  crowd_response TEXT CHECK (crowd_response IN ('ecstatic', 'enthusiastic', 'engaged', 'mixed', 'disappointed')),
  commentary TEXT[],
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.open_mic_venues ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.open_mic_performances ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.open_mic_song_performances ENABLE ROW LEVEL SECURITY;

-- Policies for open_mic_venues (read-only for all authenticated)
CREATE POLICY "Anyone can view open mic venues" ON public.open_mic_venues
  FOR SELECT USING (true);

-- Policies for open_mic_performances
CREATE POLICY "Users can view all performances" ON public.open_mic_performances
  FOR SELECT USING (true);

CREATE POLICY "Users can create their own performances" ON public.open_mic_performances
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own performances" ON public.open_mic_performances
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own performances" ON public.open_mic_performances
  FOR DELETE USING (auth.uid() = user_id);

-- Policies for open_mic_song_performances  
CREATE POLICY "Anyone can view song performances" ON public.open_mic_song_performances
  FOR SELECT USING (true);

CREATE POLICY "System can manage song performances" ON public.open_mic_song_performances
  FOR ALL USING (true);

-- Indexes
CREATE INDEX idx_open_mic_venues_city ON public.open_mic_venues(city_id);
CREATE INDEX idx_open_mic_performances_user ON public.open_mic_performances(user_id);
CREATE INDEX idx_open_mic_performances_venue ON public.open_mic_performances(venue_id);
CREATE INDEX idx_open_mic_performances_status ON public.open_mic_performances(status);
CREATE INDEX idx_open_mic_song_performances_performance ON public.open_mic_song_performances(performance_id);

-- Seed data: Create one open mic venue per city with varied days
INSERT INTO public.open_mic_venues (city_id, name, day_of_week, capacity, description)
SELECT 
  c.id,
  CASE (ROW_NUMBER() OVER (ORDER BY c.name)) % 10
    WHEN 0 THEN 'The Rusty Microphone'
    WHEN 1 THEN 'Coffee House Stage'
    WHEN 2 THEN 'The Open Note'
    WHEN 3 THEN 'Acoustic Corner'
    WHEN 4 THEN 'The Songwriter''s Den'
    WHEN 5 THEN 'Unplugged Lounge'
    WHEN 6 THEN 'The Velvet Mic'
    WHEN 7 THEN 'Starlight Cafe'
    WHEN 8 THEN 'The Underground Stage'
    ELSE 'Melody''s Open Stage'
  END,
  ((ROW_NUMBER() OVER (ORDER BY c.name)) % 7)::INTEGER,
  50 + ((ROW_NUMBER() OVER (ORDER BY c.name)) % 100),
  'A welcoming venue for aspiring musicians to showcase their talent'
FROM public.cities c;