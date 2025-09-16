-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create user profiles table
CREATE TABLE public.profiles (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  username varchar(50) UNIQUE NOT NULL,
  display_name varchar(100),
  avatar_url text,
  bio text,
  level integer DEFAULT 1,
  experience integer DEFAULT 0,
  cash bigint DEFAULT 10000,
  fame integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create player skills table
CREATE TABLE public.player_skills (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  vocals integer DEFAULT 20,
  guitar integer DEFAULT 20,
  bass integer DEFAULT 20,
  drums integer DEFAULT 20,
  songwriting integer DEFAULT 20,
  performance integer DEFAULT 20,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(user_id)
);

-- Create bands table
CREATE TABLE public.bands (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name varchar(100) NOT NULL,
  genre varchar(50),
  description text,
  popularity integer DEFAULT 0,
  weekly_fans integer DEFAULT 0,
  leader_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  max_members integer DEFAULT 4,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create band members table
CREATE TABLE public.band_members (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  band_id uuid NOT NULL REFERENCES public.bands(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role varchar(50) NOT NULL,
  salary integer DEFAULT 0,
  joined_at timestamptz DEFAULT now(),
  UNIQUE(band_id, user_id)
);

-- Create songs table
CREATE TABLE public.songs (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title varchar(200) NOT NULL,
  genre varchar(50),
  artist_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  band_id uuid REFERENCES public.bands(id) ON DELETE SET NULL,
  plays bigint DEFAULT 0,
  popularity integer DEFAULT 0,
  release_date timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create venues table
CREATE TABLE public.venues (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name varchar(200) NOT NULL,
  location varchar(200),
  capacity integer,
  venue_type varchar(50),
  base_payment integer DEFAULT 500,
  prestige_level integer DEFAULT 1,
  requirements jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now()
);

-- Create gigs table
CREATE TABLE public.gigs (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  venue_id uuid NOT NULL REFERENCES public.venues(id) ON DELETE CASCADE,
  band_id uuid NOT NULL REFERENCES public.bands(id) ON DELETE CASCADE,
  scheduled_date timestamptz NOT NULL,
  payment integer,
  status varchar(20) DEFAULT 'scheduled',
  attendance integer DEFAULT 0,
  fan_gain integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create chart entries table for World Pulse
CREATE TABLE public.chart_entries (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  song_id uuid NOT NULL REFERENCES public.songs(id) ON DELETE CASCADE,
  chart_type varchar(20) NOT NULL, -- 'daily', 'weekly'
  rank integer NOT NULL,
  plays_count bigint DEFAULT 0,
  trend varchar(10) DEFAULT 'same', -- 'up', 'down', 'same'
  trend_change integer DEFAULT 0,
  weeks_on_chart integer DEFAULT 1,
  chart_date date DEFAULT CURRENT_DATE,
  created_at timestamptz DEFAULT now(),
  UNIQUE(song_id, chart_type, chart_date)
);

-- Create game events table for live events
CREATE TABLE public.game_events (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title varchar(200) NOT NULL,
  description text,
  event_type varchar(50) NOT NULL,
  start_date timestamptz NOT NULL,
  end_date timestamptz NOT NULL,
  rewards jsonb DEFAULT '{}',
  requirements jsonb DEFAULT '{}',
  max_participants integer,
  current_participants integer DEFAULT 0,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

-- Create event participants table
CREATE TABLE public.event_participants (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  event_id uuid NOT NULL REFERENCES public.game_events(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  joined_at timestamptz DEFAULT now(),
  performance_score integer DEFAULT 0,
  rewards_claimed boolean DEFAULT false,
  UNIQUE(event_id, user_id)
);

-- Create real-time chat/social features
CREATE TABLE public.global_chat (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  message text NOT NULL,
  channel varchar(50) DEFAULT 'general',
  created_at timestamptz DEFAULT now()
);

-- Create activity feed table
CREATE TABLE public.activity_feed (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  activity_type varchar(50) NOT NULL,
  message text NOT NULL,
  metadata jsonb DEFAULT '{}',
  earnings integer DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

-- Insert some default venues
INSERT INTO public.venues (name, location, capacity, venue_type, base_payment, prestige_level, requirements) VALUES
('The Underground Club', 'Downtown District', 150, 'club', 500, 1, '{"min_popularity": 0}'),
('Midnight Lounge', 'Arts Quarter', 250, 'lounge', 750, 2, '{"min_popularity": 20}'),
('Rock Arena', 'Stadium District', 2000, 'arena', 2500, 4, '{"min_popularity": 60}'),
('The Grand Theater', 'Cultural Center', 1200, 'theater', 1800, 3, '{"min_popularity": 40}'),
('Festival Grounds', 'City Park', 5000, 'festival', 5000, 5, '{"min_popularity": 80}');

-- Enable Row Level Security
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.player_skills ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bands ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.band_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.songs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.venues ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gigs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chart_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.game_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.global_chat ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activity_feed ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
-- Profiles: Users can view all profiles but only edit their own
CREATE POLICY "Profiles are viewable by everyone" ON public.profiles FOR SELECT USING (true);
CREATE POLICY "Users can update their own profile" ON public.profiles FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own profile" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Player skills: Users can view all but only edit their own
CREATE POLICY "Skills are viewable by everyone" ON public.player_skills FOR SELECT USING (true);
CREATE POLICY "Users can update their own skills" ON public.player_skills FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own skills" ON public.player_skills FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Bands: Viewable by all, manageable by members
CREATE POLICY "Bands are viewable by everyone" ON public.bands FOR SELECT USING (true);
CREATE POLICY "Band leaders can update their bands" ON public.bands FOR UPDATE USING (auth.uid() = leader_id);
CREATE POLICY "Authenticated users can create bands" ON public.bands FOR INSERT WITH CHECK (auth.uid() = leader_id);

-- Band members: Viewable by all
CREATE POLICY "Band members are viewable by everyone" ON public.band_members FOR SELECT USING (true);
CREATE POLICY "Band leaders can manage members" ON public.band_members FOR ALL USING (
  EXISTS (SELECT 1 FROM public.bands WHERE id = band_id AND leader_id = auth.uid())
);
CREATE POLICY "Users can join bands" ON public.band_members FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Songs: Viewable by all, manageable by artist/band
CREATE POLICY "Songs are viewable by everyone" ON public.songs FOR SELECT USING (true);
CREATE POLICY "Artists can manage their songs" ON public.songs FOR ALL USING (auth.uid() = artist_id);

-- Venues: Read-only for now
CREATE POLICY "Venues are viewable by everyone" ON public.venues FOR SELECT USING (true);

-- Gigs: Viewable by all, manageable by band members
CREATE POLICY "Gigs are viewable by everyone" ON public.gigs FOR SELECT USING (true);
CREATE POLICY "Band members can manage gigs" ON public.gigs FOR ALL USING (
  EXISTS (SELECT 1 FROM public.band_members WHERE band_id = gigs.band_id AND user_id = auth.uid())
);

-- Chart entries: Read-only
CREATE POLICY "Chart entries are viewable by everyone" ON public.chart_entries FOR SELECT USING (true);

-- Game events: Read-only
CREATE POLICY "Game events are viewable by everyone" ON public.game_events FOR SELECT USING (true);

-- Event participants: Users can view all and manage their own participation
CREATE POLICY "Event participants are viewable by everyone" ON public.event_participants FOR SELECT USING (true);
CREATE POLICY "Users can manage their own participation" ON public.event_participants FOR ALL USING (auth.uid() = user_id);

-- Global chat: Users can view all and post their own messages
CREATE POLICY "Chat messages are viewable by everyone" ON public.global_chat FOR SELECT USING (true);
CREATE POLICY "Users can post messages" ON public.global_chat FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Activity feed: Users can view all and create their own activities
CREATE POLICY "Activities are viewable by everyone" ON public.activity_feed FOR SELECT USING (true);
CREATE POLICY "Users can create their own activities" ON public.activity_feed FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Create functions for automatic updates
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers for updated_at
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_player_skills_updated_at BEFORE UPDATE ON public.player_skills FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_bands_updated_at BEFORE UPDATE ON public.bands FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_songs_updated_at BEFORE UPDATE ON public.songs FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_gigs_updated_at BEFORE UPDATE ON public.gigs FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Create function to handle new user registration
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

  -- Create initial activity
  INSERT INTO public.activity_feed (user_id, activity_type, message)
  VALUES (NEW.id, 'join', 'Welcome to Rockmundo! Your musical journey begins now.');

  RETURN NEW;
END;
$$ language 'plpgsql' SECURITY DEFINER;

-- Create trigger for new users
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Enable realtime for key tables
ALTER PUBLICATION supabase_realtime ADD TABLE public.global_chat;
ALTER PUBLICATION supabase_realtime ADD TABLE public.activity_feed;
ALTER PUBLICATION supabase_realtime ADD TABLE public.chart_entries;