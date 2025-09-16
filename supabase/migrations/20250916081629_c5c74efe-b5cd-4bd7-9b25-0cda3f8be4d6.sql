-- Add missing tables for full MMO functionality

-- Equipment/Gear System
CREATE TABLE public.equipment_items (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name varchar(200) NOT NULL,
  category varchar(50) NOT NULL, -- 'guitar', 'microphone', 'audio', 'clothing'
  subcategory varchar(50),
  price integer NOT NULL,
  rarity varchar(20) DEFAULT 'common', -- 'common', 'rare', 'epic', 'legendary'
  stat_boosts jsonb DEFAULT '{}', -- e.g. {"vocals": 5, "performance": 3}
  description text,
  image_url text,
  created_at timestamptz DEFAULT now()
);

-- Player Equipment Inventory
CREATE TABLE public.player_equipment (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  equipment_id uuid NOT NULL REFERENCES public.equipment_items(id) ON DELETE CASCADE,
  is_equipped boolean DEFAULT false,
  purchased_at timestamptz DEFAULT now(),
  UNIQUE(user_id, equipment_id)
);

-- Extend songs table with more fields
ALTER TABLE public.songs ADD COLUMN IF NOT EXISTS lyrics text;
ALTER TABLE public.songs ADD COLUMN IF NOT EXISTS duration integer DEFAULT 180; -- seconds
ALTER TABLE public.songs ADD COLUMN IF NOT EXISTS quality_score integer DEFAULT 50;
ALTER TABLE public.songs ADD COLUMN IF NOT EXISTS recording_cost integer DEFAULT 500;
ALTER TABLE public.songs ADD COLUMN IF NOT EXISTS status varchar(20) DEFAULT 'draft'; -- 'draft', 'recorded', 'released'

-- Fan demographics and social media
CREATE TABLE public.fan_demographics (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  total_fans integer DEFAULT 0,
  weekly_growth integer DEFAULT 0,
  engagement_rate integer DEFAULT 0,
  age_18_25 integer DEFAULT 0,
  age_26_35 integer DEFAULT 0,
  age_36_45 integer DEFAULT 0,
  age_45_plus integer DEFAULT 0,
  platform_instagram integer DEFAULT 0,
  platform_twitter integer DEFAULT 0,
  platform_youtube integer DEFAULT 0,
  platform_tiktok integer DEFAULT 0,
  updated_at timestamptz DEFAULT now(),
  UNIQUE(user_id)
);

-- Social media posts
CREATE TABLE public.social_posts (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  platform varchar(50) NOT NULL,
  content text NOT NULL,
  likes integer DEFAULT 0,
  shares integer DEFAULT 0,
  comments integer DEFAULT 0,
  fan_growth integer DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

-- Achievements system
CREATE TABLE public.achievements (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name varchar(200) NOT NULL,
  description text,
  category varchar(50), -- 'performance', 'social', 'financial', 'creative'
  icon varchar(50),
  rarity varchar(20) DEFAULT 'common',
  requirements jsonb DEFAULT '{}',
  rewards jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now()
);

-- Player achievements
CREATE TABLE public.player_achievements (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  achievement_id uuid NOT NULL REFERENCES public.achievements(id) ON DELETE CASCADE,
  unlocked_at timestamptz DEFAULT now(),
  progress jsonb DEFAULT '{}',
  UNIQUE(user_id, achievement_id)
);

-- Streaming platforms
CREATE TABLE public.streaming_platforms (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name varchar(100) NOT NULL,
  description text,
  revenue_per_play decimal(10,6) DEFAULT 0.003,
  min_followers integer DEFAULT 0,
  icon varchar(50),
  created_at timestamptz DEFAULT now()
);

-- Player streaming accounts
CREATE TABLE public.player_streaming_accounts (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  platform_id uuid NOT NULL REFERENCES public.streaming_platforms(id) ON DELETE CASCADE,
  is_connected boolean DEFAULT false,
  followers integer DEFAULT 0,
  monthly_plays bigint DEFAULT 0,
  monthly_revenue decimal(10,2) DEFAULT 0,
  connected_at timestamptz,
  updated_at timestamptz DEFAULT now(),
  UNIQUE(user_id, platform_id)
);

-- Tours and tour dates
CREATE TABLE public.tours (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  band_id uuid REFERENCES public.bands(id) ON DELETE CASCADE,
  name varchar(200) NOT NULL,
  description text,
  start_date timestamptz NOT NULL,
  end_date timestamptz NOT NULL,
  status varchar(20) DEFAULT 'planned', -- 'planned', 'active', 'completed', 'cancelled'
  total_revenue integer DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

-- Tour venues (specific instances of gigs in a tour)
CREATE TABLE public.tour_venues (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tour_id uuid NOT NULL REFERENCES public.tours(id) ON DELETE CASCADE,
  venue_id uuid NOT NULL REFERENCES public.venues(id) ON DELETE CASCADE,
  date timestamptz NOT NULL,
  ticket_price integer,
  tickets_sold integer DEFAULT 0,
  revenue integer DEFAULT 0,
  status varchar(20) DEFAULT 'scheduled'
);

-- Insert default equipment items
INSERT INTO public.equipment_items (name, category, subcategory, price, rarity, stat_boosts, description) VALUES
-- Guitars
('Acoustic Guitar', 'guitar', 'acoustic', 300, 'common', '{"performance": 5}', 'Basic acoustic guitar for intimate performances'),
('Electric Guitar Starter', 'guitar', 'electric', 800, 'common', '{"guitar": 8, "performance": 3}', 'Entry-level electric guitar'),
('Gibson Les Paul', 'guitar', 'electric', 2500, 'rare', '{"guitar": 15, "performance": 8}', 'Legendary rock guitar with incredible sustain'),
('Fender Stratocaster', 'guitar', 'electric', 3200, 'epic', '{"guitar": 18, "performance": 10}', 'Iconic electric guitar used by legends'),

-- Microphones
('Shure SM58', 'microphone', 'dynamic', 120, 'common', '{"vocals": 6}', 'Industry standard vocal microphone'),
('Condenser Mic Pro', 'microphone', 'condenser', 450, 'rare', '{"vocals": 12, "songwriting": 5}', 'Professional studio condenser microphone'),
('Neumann U87', 'microphone', 'condenser', 1800, 'legendary', '{"vocals": 20, "songwriting": 10}', 'The gold standard of studio microphones'),

-- Audio Equipment
('Studio Headphones', 'audio', 'headphones', 80, 'common', '{"songwriting": 4}', 'Basic studio monitoring headphones'),
('Studio Monitors', 'audio', 'speakers', 600, 'rare', '{"songwriting": 10}', 'Professional studio monitor speakers'),
('Audio Interface Pro', 'audio', 'interface', 1200, 'epic', '{"songwriting": 15}', 'High-end audio interface for recording'),

-- Clothing/Style
('Leather Jacket', 'clothing', 'outerwear', 200, 'common', '{"performance": 8}', 'Classic rock star leather jacket'),
('Stage Boots', 'clothing', 'footwear', 150, 'common', '{"performance": 5}', 'Comfortable boots for long performances'),
('Custom Band T-Shirt', 'clothing', 'shirt', 50, 'common', '{"performance": 3}', 'Show your band pride');

-- Insert default streaming platforms
INSERT INTO public.streaming_platforms (name, description, revenue_per_play, min_followers, icon) VALUES
('Spotify', 'World''s largest music streaming platform', 0.003, 0, 'spotify'),
('Apple Music', 'Premium streaming service by Apple', 0.007, 0, 'apple'),
('YouTube Music', 'Google''s music streaming platform', 0.002, 100, 'youtube'),
('SoundCloud', 'Platform for independent artists', 0.001, 0, 'soundcloud'),
('Bandcamp', 'Direct-to-fan platform with higher payouts', 0.15, 0, 'bandcamp'),
('Tidal', 'High-fidelity streaming platform', 0.01, 0, 'tidal');

-- Insert default achievements
INSERT INTO public.achievements (name, description, category, icon, rarity, requirements, rewards) VALUES
('First Steps', 'Welcome to RockMundo!', 'social', 'star', 'common', '{"join": true}', '{"experience": 100}'),
('Rising Star', 'Reach level 5', 'performance', 'trending-up', 'common', '{"level": 5}', '{"cash": 1000, "fame": 50}'),
('Guitar Hero', 'Reach 50 guitar skill', 'performance', 'guitar', 'rare', '{"guitar_skill": 50}', '{"cash": 2000}'),
('Vocal Powerhouse', 'Reach 50 vocals skill', 'performance', 'mic', 'rare', '{"vocals_skill": 50}', '{"cash": 2000}'),
('Big Spender', 'Spend $10,000 on equipment', 'financial', 'shopping-cart', 'rare', '{"total_spent": 10000}', '{"experience": 500}'),
('Chart Topper', 'Get a song to #1 on daily charts', 'creative', 'crown', 'epic', '{"chart_position": 1}', '{"cash": 5000, "fame": 200}'),
('Millionaire', 'Accumulate $1,000,000', 'financial', 'dollar-sign', 'legendary', '{"total_cash": 1000000}', '{"fame": 500}');

-- Create storage bucket for avatars and music files
INSERT INTO storage.buckets (id, name, public) VALUES 
('avatars', 'avatars', true),
('music', 'music', false),
('equipment', 'equipment', true);

-- Enable RLS on new tables
ALTER TABLE public.equipment_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.player_equipment ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fan_demographics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.social_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.achievements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.player_achievements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.streaming_platforms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.player_streaming_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tours ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tour_venues ENABLE ROW LEVEL SECURITY;

-- RLS Policies for equipment
CREATE POLICY "Equipment items are viewable by everyone" ON public.equipment_items FOR SELECT USING (true);
CREATE POLICY "Player equipment is viewable by everyone" ON public.player_equipment FOR SELECT USING (true);
CREATE POLICY "Users can manage their own equipment" ON public.player_equipment FOR ALL USING (auth.uid() = user_id);

-- RLS Policies for fan demographics
CREATE POLICY "Fan demographics are viewable by everyone" ON public.fan_demographics FOR SELECT USING (true);
CREATE POLICY "Users can manage their own fan data" ON public.fan_demographics FOR ALL USING (auth.uid() = user_id);

-- RLS Policies for social posts
CREATE POLICY "Social posts are viewable by everyone" ON public.social_posts FOR SELECT USING (true);
CREATE POLICY "Users can manage their own posts" ON public.social_posts FOR ALL USING (auth.uid() = user_id);

-- RLS Policies for achievements
CREATE POLICY "Achievements are viewable by everyone" ON public.achievements FOR SELECT USING (true);
CREATE POLICY "Player achievements are viewable by everyone" ON public.player_achievements FOR SELECT USING (true);
CREATE POLICY "Users can manage their own achievements" ON public.player_achievements FOR ALL USING (auth.uid() = user_id);

-- RLS Policies for streaming
CREATE POLICY "Streaming platforms are viewable by everyone" ON public.streaming_platforms FOR SELECT USING (true);
CREATE POLICY "Streaming accounts are viewable by everyone" ON public.player_streaming_accounts FOR SELECT USING (true);
CREATE POLICY "Users can manage their own streaming accounts" ON public.player_streaming_accounts FOR ALL USING (auth.uid() = user_id);

-- RLS Policies for tours
CREATE POLICY "Tours are viewable by everyone" ON public.tours FOR SELECT USING (true);
CREATE POLICY "Users can manage their own tours" ON public.tours FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Tour venues are viewable by everyone" ON public.tour_venues FOR SELECT USING (true);

-- Storage policies
CREATE POLICY "Avatar images are publicly accessible" ON storage.objects FOR SELECT USING (bucket_id = 'avatars');
CREATE POLICY "Users can upload their own avatar" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "Users can update their own avatar" ON storage.objects FOR UPDATE USING (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Equipment images are publicly accessible" ON storage.objects FOR SELECT USING (bucket_id = 'equipment');

-- Initialize fan demographics for new users (update the user creation function)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  -- Create profile
  INSERT INTO public.profiles (user_id, username, display_name)
  VALUES (NEW.id, 
          COALESCE(NEW.raw_user_meta_data->>'username', 'Player' || substr(NEW.id::text, 1, 8)),
          COALESCE(NEW.raw_user_meta_data->>'display_name', 'New Player'));
  
  -- Create initial skills
  INSERT INTO public.player_skills (user_id)
  VALUES (NEW.id);

  -- Create initial fan demographics
  INSERT INTO public.fan_demographics (user_id)
  VALUES (NEW.id);

  -- Create initial activity
  INSERT INTO public.activity_feed (user_id, activity_type, message)
  VALUES (NEW.id, 'join', 'Welcome to Rockmundo! Your musical journey begins now.');

  -- Grant "First Steps" achievement
  INSERT INTO public.player_achievements (user_id, achievement_id)
  SELECT NEW.id, id FROM public.achievements WHERE name = 'First Steps';

  RETURN NEW;
END;
$$ language 'plpgsql' SECURITY DEFINER SET search_path = public;