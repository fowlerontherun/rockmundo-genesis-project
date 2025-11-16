-- Phase 2: Leaderboard & Competitive Features Tables

-- Create leaderboard_seasons table
CREATE TABLE IF NOT EXISTS public.leaderboard_seasons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  start_date TIMESTAMP WITH TIME ZONE NOT NULL,
  end_date TIMESTAMP WITH TIME ZONE NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT false,
  season_number INTEGER,
  reward_pool JSONB DEFAULT '{}',
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create leaderboard_badges table
CREATE TABLE IF NOT EXISTS public.leaderboard_badges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT,
  icon TEXT NOT NULL DEFAULT 'trophy',
  rarity TEXT NOT NULL DEFAULT 'rare',
  tier TEXT,
  season_id UUID REFERENCES public.leaderboard_seasons(id) ON DELETE CASCADE,
  criteria JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create leaderboard_badge_awards table
CREATE TABLE IF NOT EXISTS public.leaderboard_badge_awards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  badge_id UUID NOT NULL REFERENCES public.leaderboard_badges(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  season_id UUID REFERENCES public.leaderboard_seasons(id) ON DELETE CASCADE,
  profile_id UUID,
  awarded_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  rank INTEGER,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create leaderboard_season_snapshots table
CREATE TABLE IF NOT EXISTS public.leaderboard_season_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  season_id UUID NOT NULL REFERENCES public.leaderboard_seasons(id) ON DELETE CASCADE,
  profile_id UUID,
  user_id UUID,
  division TEXT NOT NULL,
  region TEXT NOT NULL,
  instrument TEXT NOT NULL,
  tier TEXT,
  final_rank INTEGER,
  final_score NUMERIC,
  total_revenue NUMERIC,
  total_gigs INTEGER,
  total_achievements INTEGER,
  fame NUMERIC,
  experience NUMERIC,
  breakdown JSONB DEFAULT '{}',
  awarded_badges TEXT[] DEFAULT '{}',
  recorded_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_leaderboard_seasons_active ON public.leaderboard_seasons(is_active);
CREATE INDEX IF NOT EXISTS idx_leaderboard_seasons_dates ON public.leaderboard_seasons(start_date, end_date);
CREATE INDEX IF NOT EXISTS idx_leaderboard_badges_season ON public.leaderboard_badges(season_id);
CREATE INDEX IF NOT EXISTS idx_leaderboard_badges_code ON public.leaderboard_badges(code);
CREATE INDEX IF NOT EXISTS idx_leaderboard_badge_awards_badge ON public.leaderboard_badge_awards(badge_id);
CREATE INDEX IF NOT EXISTS idx_leaderboard_badge_awards_user ON public.leaderboard_badge_awards(user_id);
CREATE INDEX IF NOT EXISTS idx_leaderboard_badge_awards_season ON public.leaderboard_badge_awards(season_id);
CREATE INDEX IF NOT EXISTS idx_leaderboard_snapshots_season ON public.leaderboard_season_snapshots(season_id);
CREATE INDEX IF NOT EXISTS idx_leaderboard_snapshots_profile ON public.leaderboard_season_snapshots(profile_id);
CREATE INDEX IF NOT EXISTS idx_leaderboard_snapshots_rank ON public.leaderboard_season_snapshots(season_id, final_rank);
CREATE INDEX IF NOT EXISTS idx_leaderboard_snapshots_division ON public.leaderboard_season_snapshots(division, region, instrument);

-- Enable RLS on all tables
ALTER TABLE public.leaderboard_seasons ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leaderboard_badges ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leaderboard_badge_awards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leaderboard_season_snapshots ENABLE ROW LEVEL SECURITY;

-- RLS Policies for leaderboard_seasons (public read)
CREATE POLICY "Anyone can view leaderboard seasons"
  ON public.leaderboard_seasons
  FOR SELECT
  USING (true);

-- RLS Policies for leaderboard_badges (public read)
CREATE POLICY "Anyone can view leaderboard badges"
  ON public.leaderboard_badges
  FOR SELECT
  USING (true);

-- RLS Policies for leaderboard_badge_awards (public read, user can see their own)
CREATE POLICY "Anyone can view badge awards"
  ON public.leaderboard_badge_awards
  FOR SELECT
  USING (true);

-- RLS Policies for leaderboard_season_snapshots (public read)
CREATE POLICY "Anyone can view season snapshots"
  ON public.leaderboard_season_snapshots
  FOR SELECT
  USING (true);

-- Add update trigger for leaderboard_seasons
CREATE TRIGGER update_leaderboard_seasons_updated_at
  BEFORE UPDATE ON public.leaderboard_seasons
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Add update trigger for leaderboard_badges
CREATE TRIGGER update_leaderboard_badges_updated_at
  BEFORE UPDATE ON public.leaderboard_badges
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();