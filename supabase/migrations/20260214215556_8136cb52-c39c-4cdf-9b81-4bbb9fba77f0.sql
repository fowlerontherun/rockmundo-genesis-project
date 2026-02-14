
-- Create player_addictions table
CREATE TABLE public.player_addictions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  addiction_type TEXT NOT NULL CHECK (addiction_type IN ('alcohol', 'substances', 'gambling', 'partying')),
  severity INTEGER NOT NULL DEFAULT 20 CHECK (severity >= 0 AND severity <= 100),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'recovering', 'recovered', 'relapsed')),
  triggered_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  recovery_started_at TIMESTAMP WITH TIME ZONE,
  recovered_at TIMESTAMP WITH TIME ZONE,
  recovery_program TEXT CHECK (recovery_program IN ('therapy', 'rehab', 'cold_turkey')),
  days_clean INTEGER NOT NULL DEFAULT 0,
  relapse_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.player_addictions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own addictions"
  ON public.player_addictions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own addictions"
  ON public.player_addictions FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own addictions"
  ON public.player_addictions FOR UPDATE USING (auth.uid() = user_id);

-- Create player_holidays table
CREATE TABLE public.player_holidays (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  destination TEXT NOT NULL,
  started_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  ends_at TIMESTAMP WITH TIME ZONE NOT NULL,
  duration_days INTEGER NOT NULL CHECK (duration_days > 0),
  cost INTEGER NOT NULL DEFAULT 0,
  health_boost_per_day INTEGER NOT NULL DEFAULT 15,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed', 'cancelled')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.player_holidays ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own holidays"
  ON public.player_holidays FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own holidays"
  ON public.player_holidays FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own holidays"
  ON public.player_holidays FOR UPDATE USING (auth.uid() = user_id);

-- Create indexes
CREATE INDEX idx_player_addictions_user ON public.player_addictions(user_id);
CREATE INDEX idx_player_addictions_status ON public.player_addictions(status);
CREATE INDEX idx_player_holidays_user ON public.player_holidays(user_id);
CREATE INDEX idx_player_holidays_status ON public.player_holidays(status);
