-- Game Balance Configuration Table
CREATE TABLE public.game_balance_config (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  category TEXT NOT NULL,
  key TEXT NOT NULL UNIQUE,
  value NUMERIC NOT NULL,
  description TEXT,
  min_value NUMERIC,
  max_value NUMERIC,
  unit TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.game_balance_config ENABLE ROW LEVEL SECURITY;

-- Everyone can read balance config
CREATE POLICY "Anyone can read game balance" ON public.game_balance_config FOR SELECT USING (true);

-- Only admins can modify (via service role)
CREATE POLICY "Service role can modify game balance" ON public.game_balance_config FOR ALL USING (true);

-- Tutorial Steps Table
CREATE TABLE public.tutorial_steps (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  step_key TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  target_element TEXT,
  target_route TEXT,
  order_index INTEGER NOT NULL DEFAULT 0,
  category TEXT NOT NULL DEFAULT 'general',
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.tutorial_steps ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read tutorial steps" ON public.tutorial_steps FOR SELECT USING (true);

-- Player Tutorial Progress
CREATE TABLE public.player_tutorial_progress (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  step_key TEXT NOT NULL,
  completed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, step_key)
);

ALTER TABLE public.player_tutorial_progress ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own tutorial progress" ON public.player_tutorial_progress FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own tutorial progress" ON public.player_tutorial_progress FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Game Stats View for Admin Dashboard
CREATE OR REPLACE VIEW public.admin_game_stats AS
SELECT 
  (SELECT COUNT(*) FROM profiles) as total_players,
  (SELECT COUNT(*) FROM profiles WHERE updated_at > NOW() - INTERVAL '24 hours') as active_today,
  (SELECT COUNT(*) FROM profiles WHERE updated_at > NOW() - INTERVAL '7 days') as active_week,
  (SELECT COUNT(*) FROM bands) as total_bands,
  (SELECT COUNT(*) FROM songs) as total_songs,
  (SELECT COUNT(*) FROM gigs WHERE status = 'completed') as completed_gigs,
  (SELECT COUNT(*) FROM releases WHERE release_status = 'released') as total_releases,
  (SELECT COALESCE(SUM(band_balance), 0) FROM bands) as total_economy,
  (SELECT COUNT(*) FROM game_activity_logs WHERE created_at > NOW() - INTERVAL '24 hours') as activities_today;

-- Seed initial game balance values
INSERT INTO public.game_balance_config (category, key, value, description, min_value, max_value, unit) VALUES
-- XP & Progression
('xp', 'xp_per_songwriting_session', 15, 'Base XP earned per songwriting session', 5, 50, 'XP'),
('xp', 'xp_per_rehearsal_hour', 10, 'XP earned per hour of rehearsal', 5, 30, 'XP'),
('xp', 'xp_per_gig_performance', 25, 'Base XP for completing a gig', 10, 100, 'XP'),
('xp', 'xp_per_recording_session', 20, 'XP for completing a recording', 10, 50, 'XP'),
('xp', 'daily_xp_cap', 500, 'Maximum XP earnable per day', 100, 2000, 'XP'),

-- Economy
('economy', 'starting_cash', 500, 'Starting cash for new players', 100, 5000, '$'),
('economy', 'rehearsal_room_cost_multiplier', 1.0, 'Multiplier for rehearsal room costs', 0.5, 3.0, 'x'),
('economy', 'gig_booking_fee_percent', 10, 'Percentage of estimated revenue for booking fee', 5, 25, '%'),
('economy', 'band_revenue_share_default', 50, 'Default band share of ticket revenue', 30, 70, '%'),
('economy', 'merch_profit_margin', 60, 'Profit margin on merchandise sales', 30, 80, '%'),

-- Fame & Popularity
('fame', 'fame_per_gig_base', 10, 'Base fame earned per gig', 5, 50, 'fame'),
('fame', 'fame_per_chart_position', 5, 'Fame per chart position gained', 1, 20, 'fame'),
('fame', 'fame_decay_daily', 1, 'Fame lost per day of inactivity', 0, 10, 'fame'),
('fame', 'viral_moment_fame_bonus', 100, 'Fame bonus for viral moments', 50, 500, 'fame'),

-- Performance
('performance', 'rehearsal_bonus_max', 20, 'Maximum bonus from rehearsals (%)', 10, 50, '%'),
('performance', 'chemistry_bonus_max', 15, 'Maximum bonus from band chemistry (%)', 5, 30, '%'),
('performance', 'equipment_quality_weight', 0.15, 'Weight of equipment in performance', 0.05, 0.3, 'weight'),
('performance', 'crowd_satisfaction_threshold', 60, 'Minimum rating for positive crowd reaction', 40, 80, 'rating'),

-- Social
('social', 'twaater_daily_post_limit', 10, 'Maximum Twaats per day', 3, 30, 'posts'),
('social', 'twaater_xp_per_post', 5, 'XP earned per Twaat (first 3)', 1, 20, 'XP'),
('social', 'follower_fame_weight', 0.01, 'Fame contribution per follower', 0.001, 0.1, 'weight');

-- Seed tutorial steps
INSERT INTO public.tutorial_steps (step_key, title, description, target_route, order_index, category) VALUES
('welcome', 'Welcome to Rockmundo!', 'Start your journey as a musician. Create songs, form bands, and become a star!', '/dashboard', 1, 'getting_started'),
('create_song', 'Write Your First Song', 'Head to the Songwriting page to compose your first masterpiece.', '/songwriting', 2, 'getting_started'),
('record_song', 'Record Your Song', 'Visit the Recording Studio to lay down tracks for your song.', '/recording-studio', 3, 'getting_started'),
('join_band', 'Join or Create a Band', 'Musicians shine brighter together. Form a band to unlock gigs!', '/band', 4, 'band'),
('book_rehearsal', 'Practice Makes Perfect', 'Book rehearsal time to improve your performance quality.', '/rehearsals', 5, 'band'),
('book_gig', 'Your First Gig', 'Ready to perform? Book a gig at a local venue!', '/gigs', 6, 'performance'),
('release_music', 'Release Your Music', 'Package your recordings into releases for distribution.', '/release-manager', 7, 'music'),
('social_media', 'Build Your Following', 'Use Twaater to connect with fans and grow your audience.', '/twaater', 8, 'social');

-- Trigger for updated_at
CREATE TRIGGER update_game_balance_config_updated_at
BEFORE UPDATE ON public.game_balance_config
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();