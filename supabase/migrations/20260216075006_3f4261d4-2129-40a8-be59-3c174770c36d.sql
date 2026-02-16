
-- Create major_events table (event definitions)
CREATE TABLE public.major_events (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL DEFAULT 'sports',
  month INT NOT NULL CHECK (month BETWEEN 1 AND 12),
  audience_size INT NOT NULL DEFAULT 100000,
  min_fame_required INT NOT NULL DEFAULT 0,
  base_cash_reward INT NOT NULL DEFAULT 0,
  max_cash_reward INT NOT NULL DEFAULT 0,
  fame_multiplier NUMERIC NOT NULL DEFAULT 1.0,
  fan_multiplier NUMERIC NOT NULL DEFAULT 1.0,
  image_url TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create major_event_instances table (yearly occurrences)
CREATE TABLE public.major_event_instances (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  event_id UUID NOT NULL REFERENCES public.major_events(id) ON DELETE CASCADE,
  year INT NOT NULL DEFAULT EXTRACT(YEAR FROM now()),
  event_date TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'upcoming',
  invited_band_ids UUID[] DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create major_event_performances table
CREATE TABLE public.major_event_performances (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  instance_id UUID NOT NULL REFERENCES public.major_event_instances(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  band_id UUID REFERENCES public.bands(id),
  song_1_id UUID REFERENCES public.songs(id),
  song_2_id UUID REFERENCES public.songs(id),
  song_3_id UUID REFERENCES public.songs(id),
  status TEXT NOT NULL DEFAULT 'accepted',
  current_song_position INT NOT NULL DEFAULT 1,
  overall_rating NUMERIC(5,2),
  cash_earned INT DEFAULT 0,
  fame_gained INT DEFAULT 0,
  fans_gained INT DEFAULT 0,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create major_event_song_performances table
CREATE TABLE public.major_event_song_performances (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  performance_id UUID NOT NULL REFERENCES public.major_event_performances(id) ON DELETE CASCADE,
  song_id UUID NOT NULL REFERENCES public.songs(id),
  position INT NOT NULL,
  performance_score NUMERIC(4,2),
  crowd_response TEXT,
  commentary JSONB
);

-- Enable RLS
ALTER TABLE public.major_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.major_event_instances ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.major_event_performances ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.major_event_song_performances ENABLE ROW LEVEL SECURITY;

-- RLS policies for major_events (read-only for all authenticated)
CREATE POLICY "Anyone can view major events" ON public.major_events FOR SELECT USING (true);

-- RLS policies for major_event_instances
CREATE POLICY "Anyone can view event instances" ON public.major_event_instances FOR SELECT USING (true);

-- RLS policies for major_event_performances
CREATE POLICY "Users can view their own performances" ON public.major_event_performances FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own performances" ON public.major_event_performances FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own performances" ON public.major_event_performances FOR UPDATE USING (auth.uid() = user_id);

-- RLS policies for major_event_song_performances
CREATE POLICY "Users can view their song performances" ON public.major_event_song_performances FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.major_event_performances p WHERE p.id = performance_id AND p.user_id = auth.uid())
);
CREATE POLICY "Service role can insert song performances" ON public.major_event_song_performances FOR INSERT WITH CHECK (true);

-- Seed the 15 major events
INSERT INTO public.major_events (name, description, category, month, audience_size, min_fame_required, base_cash_reward, max_cash_reward, fame_multiplier, fan_multiplier) VALUES
('Super Bowl Halftime Show', 'The biggest stage in American sports. Perform for millions during the Super Bowl.', 'sports', 2, 500000, 5000, 500000, 2000000, 5.0, 5.0),
('WrestleMania Opening', 'Open the grandest stage of them all with a live performance.', 'sports', 4, 80000, 800, 100000, 500000, 2.0, 2.0),
('BBC Variety Show', 'A beloved British institution — perform on the annual Christmas variety special.', 'tv', 12, 200000, 800, 50000, 200000, 1.5, 1.5),
('Olympics Opening Ceremony', 'Represent music on the world stage at the Olympic Games opening.', 'sports', 7, 1000000, 5000, 750000, 3000000, 6.0, 6.0),
('Olympics Closing Ceremony', 'Close out the Olympic Games with a spectacular performance.', 'sports', 8, 800000, 5000, 500000, 2000000, 5.0, 5.0),
('Men''s World Cup Final', 'Perform at the world''s most-watched sporting event.', 'sports', 6, 1500000, 5000, 1000000, 5000000, 8.0, 8.0),
('Women''s World Cup Final', 'Take the stage at the Women''s World Cup Final.', 'sports', 7, 600000, 5000, 400000, 1500000, 4.0, 4.0),
('Winter Olympics Opening Ceremony', 'Perform at the Winter Games opening ceremony.', 'sports', 2, 500000, 5000, 500000, 2000000, 5.0, 5.0),
('Winter Olympics Closing Ceremony', 'Close the Winter Games with a memorable performance.', 'sports', 2, 400000, 5000, 400000, 1500000, 4.0, 4.0),
('Grammy Awards', 'Perform live at the most prestigious music awards ceremony.', 'music', 1, 300000, 2000, 200000, 800000, 3.0, 3.0),
('MTV VMAs', 'Take the VMA stage — where legendary performances are born.', 'music', 8, 250000, 2000, 150000, 600000, 2.5, 2.5),
('Brit Awards', 'Perform at the UK''s biggest music awards night.', 'music', 2, 200000, 2000, 100000, 500000, 2.0, 2.0),
('New Year''s Eve Times Square', 'Ring in the new year with a live performance in Times Square.', 'holiday', 12, 1000000, 2000, 500000, 2000000, 5.0, 5.0),
('Coachella Main Stage Headline', 'Headline the main stage at the world''s most famous music festival.', 'music', 4, 100000, 800, 300000, 1000000, 2.5, 2.5),
('Glastonbury Pyramid Stage Headline', 'Headline the legendary Pyramid Stage at Glastonbury.', 'music', 6, 120000, 800, 350000, 1200000, 3.0, 3.0);

-- Generate 2026 instances for all events
INSERT INTO public.major_event_instances (event_id, year, event_date, status)
SELECT id, 2026, 
  make_timestamptz(2026, month, 15, 20, 0, 0, 'UTC'),
  'upcoming'
FROM public.major_events;
