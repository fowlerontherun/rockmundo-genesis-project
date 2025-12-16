-- Table to track XP earned by each player from gigs
CREATE TABLE public.player_gig_xp (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  gig_id UUID NOT NULL REFERENCES public.gigs(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  profile_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  band_id UUID NOT NULL REFERENCES public.bands(id) ON DELETE CASCADE,
  base_xp INTEGER NOT NULL DEFAULT 0,
  performance_bonus_xp INTEGER NOT NULL DEFAULT 0,
  crowd_bonus_xp INTEGER NOT NULL DEFAULT 0,
  milestone_bonus_xp INTEGER NOT NULL DEFAULT 0,
  total_xp INTEGER NOT NULL DEFAULT 0,
  xp_multiplier NUMERIC(3,2) NOT NULL DEFAULT 1.00,
  attendance_count INTEGER DEFAULT 0,
  performance_rating INTEGER DEFAULT 0,
  skill_type_improved TEXT,
  skill_improvement_amount INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(gig_id, user_id)
);

-- Add XP tracking columns to gig_outcomes
ALTER TABLE public.gig_outcomes 
ADD COLUMN IF NOT EXISTS total_xp_awarded INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS xp_breakdown JSONB DEFAULT '{}',
ADD COLUMN IF NOT EXISTS crowd_energy_peak INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS highlight_moments JSONB DEFAULT '[]',
ADD COLUMN IF NOT EXISTS fan_conversions INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS new_followers INTEGER DEFAULT 0;

-- Create gig milestone achievements table
CREATE TABLE public.gig_milestones (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  milestone_type TEXT NOT NULL, -- 'attendance', 'performance', 'streak', 'venue_type', 'revenue'
  threshold_value INTEGER NOT NULL,
  xp_reward INTEGER NOT NULL DEFAULT 50,
  icon TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Track player milestone achievements from gigs
CREATE TABLE public.player_gig_milestones (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  milestone_id UUID NOT NULL REFERENCES public.gig_milestones(id) ON DELETE CASCADE,
  gig_id UUID REFERENCES public.gigs(id) ON DELETE SET NULL,
  achieved_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, milestone_id)
);

-- Enable RLS
ALTER TABLE public.player_gig_xp ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gig_milestones ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.player_gig_milestones ENABLE ROW LEVEL SECURITY;

-- RLS Policies for player_gig_xp
CREATE POLICY "Users can view their own gig XP" ON public.player_gig_xp
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "System can insert gig XP" ON public.player_gig_xp
  FOR INSERT WITH CHECK (true);

-- RLS Policies for gig_milestones (public read)
CREATE POLICY "Anyone can view milestones" ON public.gig_milestones
  FOR SELECT USING (true);

-- RLS Policies for player_gig_milestones
CREATE POLICY "Users can view their own milestone achievements" ON public.player_gig_milestones
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "System can insert milestone achievements" ON public.player_gig_milestones
  FOR INSERT WITH CHECK (true);

-- Seed gig milestones
INSERT INTO public.gig_milestones (name, description, milestone_type, threshold_value, xp_reward, icon) VALUES
('First Gig', 'Complete your first gig', 'streak', 1, 100, 'Star'),
('10 Gigs Strong', 'Complete 10 gigs', 'streak', 10, 250, 'Trophy'),
('Road Warrior', 'Complete 50 gigs', 'streak', 50, 500, 'Medal'),
('Legend Status', 'Complete 100 gigs', 'streak', 100, 1000, 'Crown'),
('Crowd Pleaser', 'Play to 100+ audience', 'attendance', 100, 150, 'Users'),
('Filling Venues', 'Play to 500+ audience', 'attendance', 500, 300, 'Users'),
('Sold Out', 'Play to 1000+ audience', 'attendance', 1000, 500, 'Users'),
('Perfect Show', 'Achieve 95%+ performance rating', 'performance', 95, 200, 'Zap'),
('Flawless', 'Achieve 100% performance rating', 'performance', 100, 400, 'Sparkles'),
('Big Earner', 'Earn $1000+ from a single gig', 'revenue', 1000, 200, 'DollarSign'),
('High Roller', 'Earn $5000+ from a single gig', 'revenue', 5000, 400, 'Banknote'),
('Festival Debut', 'Play at a festival', 'venue_type', 1, 300, 'Music'),
('Arena Ready', 'Play at an arena venue', 'venue_type', 2, 500, 'Building');

-- Create indexes
CREATE INDEX idx_player_gig_xp_user ON public.player_gig_xp(user_id);
CREATE INDEX idx_player_gig_xp_gig ON public.player_gig_xp(gig_id);
CREATE INDEX idx_player_gig_milestones_user ON public.player_gig_milestones(user_id);