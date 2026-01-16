-- ============================================
-- Self-Promotion & PR System Tables
-- ============================================

-- Self-Promotion Catalog (activity definitions)
CREATE TABLE public.self_promotion_catalog (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  activity_type text NOT NULL UNIQUE,
  name text NOT NULL,
  description text NOT NULL,
  duration_minutes integer DEFAULT 30,
  cooldown_days integer DEFAULT 7,
  base_cost integer DEFAULT 0,
  base_fame_min integer DEFAULT 10,
  base_fame_max integer DEFAULT 50,
  base_fan_min integer DEFAULT 20,
  base_fan_max integer DEFAULT 100,
  requires_release boolean DEFAULT false,
  min_fame_required integer DEFAULT 0,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

-- Self-Promotion Activities (player records)
CREATE TABLE public.self_promotion_activities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id),
  band_id uuid REFERENCES public.bands(id) ON DELETE CASCADE,
  activity_type text NOT NULL,
  promo_focus text DEFAULT 'general',
  status text DEFAULT 'scheduled',
  scheduled_start timestamptz NOT NULL,
  scheduled_end timestamptz NOT NULL,
  cost_paid integer DEFAULT 0,
  fame_gained integer DEFAULT 0,
  fans_gained integer DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

-- Self-Promotion Cooldowns
CREATE TABLE public.self_promotion_cooldowns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  band_id uuid REFERENCES public.bands(id) ON DELETE CASCADE,
  activity_type text NOT NULL,
  cooldown_expires_at timestamptz NOT NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE(band_id, activity_type)
);

-- Band Media Cooldowns (for PR offers)
CREATE TABLE public.band_media_cooldowns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  band_id uuid REFERENCES public.bands(id) ON DELETE CASCADE,
  media_type text NOT NULL,
  outlet_id uuid NOT NULL,
  show_id uuid,
  cooldown_expires_at timestamptz NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Websites Table
CREATE TABLE public.websites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  website_url text,
  country text,
  description text,
  traffic_rank integer DEFAULT 100000,
  min_fame_required integer DEFAULT 0,
  compensation_min integer DEFAULT 50,
  compensation_max integer DEFAULT 500,
  fame_boost_min integer DEFAULT 20,
  fame_boost_max integer DEFAULT 200,
  fan_boost_min integer DEFAULT 50,
  fan_boost_max integer DEFAULT 500,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

-- ============================================
-- Enable RLS on all new tables
-- ============================================

ALTER TABLE public.self_promotion_catalog ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.self_promotion_activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.self_promotion_cooldowns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.band_media_cooldowns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.websites ENABLE ROW LEVEL SECURITY;

-- Self-Promotion Catalog: Anyone can read
CREATE POLICY "Anyone can read self_promotion_catalog"
  ON public.self_promotion_catalog FOR SELECT
  USING (true);

-- Self-Promotion Activities: Users can manage their own
CREATE POLICY "Users can read own self_promotion_activities"
  ON public.self_promotion_activities FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own self_promotion_activities"
  ON public.self_promotion_activities FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own self_promotion_activities"
  ON public.self_promotion_activities FOR UPDATE
  USING (auth.uid() = user_id);

-- Self-Promotion Cooldowns: Users can manage via band membership
CREATE POLICY "Band members can read self_promotion_cooldowns"
  ON public.self_promotion_cooldowns FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM band_members bm
    WHERE bm.band_id = self_promotion_cooldowns.band_id
    AND bm.user_id = auth.uid()
  ));

CREATE POLICY "Band members can insert self_promotion_cooldowns"
  ON public.self_promotion_cooldowns FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM band_members bm
    WHERE bm.band_id = self_promotion_cooldowns.band_id
    AND bm.user_id = auth.uid()
  ));

CREATE POLICY "Band members can update self_promotion_cooldowns"
  ON public.self_promotion_cooldowns FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM band_members bm
    WHERE bm.band_id = self_promotion_cooldowns.band_id
    AND bm.user_id = auth.uid()
  ));

-- Band Media Cooldowns: Band members can read
CREATE POLICY "Band members can read band_media_cooldowns"
  ON public.band_media_cooldowns FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM band_members bm
    WHERE bm.band_id = band_media_cooldowns.band_id
    AND bm.user_id = auth.uid()
  ));

CREATE POLICY "Service role can manage band_media_cooldowns"
  ON public.band_media_cooldowns FOR ALL
  USING (true);

-- Websites: Anyone can read
CREATE POLICY "Anyone can read websites"
  ON public.websites FOR SELECT
  USING (true);

-- ============================================
-- Seed Self-Promotion Activities
-- ============================================

INSERT INTO public.self_promotion_catalog (activity_type, name, description, duration_minutes, cooldown_days, base_cost, base_fame_min, base_fame_max, base_fan_min, base_fan_max, min_fame_required) VALUES
('reddit_ama', 'Reddit AMA', 'Host an Ask Me Anything session on music subreddits. Great for connecting with indie fans.', 30, 14, 50, 15, 60, 30, 150, 20),
('twitch_listening', 'Twitch Listening Party', 'Stream a live listening party with chat interaction and behind-the-scenes commentary.', 60, 7, 100, 25, 100, 50, 300, 50),
('instagram_live', 'Instagram Live Session', 'Go live on Instagram to perform acoustic versions and chat with followers.', 45, 5, 75, 20, 80, 40, 200, 30),
('youtube_premiere', 'YouTube Premiere', 'Host a premiere event for your latest music video with live chat.', 90, 14, 150, 40, 150, 100, 500, 100),
('twitter_spaces', 'Twitter/X Spaces', 'Host or join a Spaces conversation about music and your creative process.', 30, 7, 50, 15, 50, 25, 125, 10),
('busking', 'Street Busking', 'Hit the streets and perform for passersby. Low cost, high authenticity.', 120, 3, 0, 10, 40, 20, 100, 0),
('social_ads', 'Social Media Ad Campaign', 'Run targeted ads across platforms to reach new potential fans.', 0, 7, 200, 30, 120, 80, 400, 50),
('street_team', 'Street Team Flyers', 'Distribute flyers and posters around local music venues and hangouts.', 60, 5, 25, 5, 20, 50, 200, 0);

-- ============================================
-- Seed Websites
-- ============================================

INSERT INTO public.websites (name, website_url, country, description, traffic_rank, min_fame_required, compensation_min, compensation_max, fame_boost_min, fame_boost_max, fan_boost_min, fan_boost_max) VALUES
('Pitchfork', 'https://pitchfork.com', 'USA', 'Influential indie music publication known for album reviews and artist features.', 5000, 200, 500, 2000, 100, 400, 200, 800),
('Stereogum', 'https://stereogum.com', 'USA', 'Alternative and indie music blog with news, reviews, and premieres.', 15000, 100, 200, 800, 50, 200, 100, 400),
('Consequence', 'https://consequence.net', 'USA', 'Music and entertainment coverage with festival guides and interviews.', 20000, 75, 150, 600, 40, 150, 80, 300),
('NME', 'https://nme.com', 'UK', 'Legendary British music magazine covering rock, indie, and pop.', 8000, 150, 300, 1200, 80, 300, 150, 600),
('DIY Magazine', 'https://diymag.com', 'UK', 'Indie music magazine featuring emerging artists and live reviews.', 50000, 50, 100, 400, 30, 100, 60, 250),
('The Line of Best Fit', 'https://thelineofbestfit.com', 'UK', 'Tastemaker publication for new music discovery and artist spotlights.', 40000, 60, 120, 500, 35, 120, 70, 280),
('Brooklyn Vegan', 'https://brooklynvegan.com', 'USA', 'NYC-focused music blog covering concerts, tours, and new releases.', 30000, 80, 180, 700, 45, 160, 90, 350),
('Billboard', 'https://billboard.com', 'USA', 'The industry standard for music charts and business news.', 1000, 500, 1000, 5000, 200, 800, 400, 1500),
('Rolling Stone', 'https://rollingstone.com', 'USA', 'Iconic music and pop culture magazine with global reach.', 500, 400, 800, 4000, 180, 700, 350, 1200),
('SPIN', 'https://spin.com', 'USA', 'Alternative music coverage with reviews, features, and playlists.', 25000, 120, 250, 900, 60, 220, 120, 450),
('Paste Magazine', 'https://pastemagazine.com', 'USA', 'Music, film, and culture publication with thoughtful reviews.', 35000, 70, 140, 550, 40, 140, 75, 300),
('Clash Magazine', 'https://clashmusic.com', 'UK', 'UK music magazine covering indie, electronic, and alternative.', 45000, 55, 110, 450, 32, 110, 65, 260),
('The Quietus', 'https://thequietus.com', 'UK', 'Eclectic British music publication for experimental and underground music.', 60000, 40, 80, 350, 25, 90, 50, 200),
('Exclaim!', 'https://exclaim.ca', 'Canada', 'Canadian music magazine covering all genres from coast to coast.', 55000, 45, 90, 380, 28, 95, 55, 220),
('Under the Radar', 'https://undertheradarmag.com', 'USA', 'Indie and alternative music magazine with in-depth artist interviews.', 70000, 35, 70, 300, 20, 80, 45, 180);

-- ============================================
-- Fix Podcast Countries
-- ============================================

UPDATE podcasts SET country = 'USA' WHERE country IS NULL;

-- Update some specific podcasts to other countries for variety
UPDATE podcasts SET country = 'UK' WHERE podcast_name ILIKE '%BBC%' OR podcast_name ILIKE '%british%';
UPDATE podcasts SET country = 'Canada' WHERE podcast_name ILIKE '%canadian%' OR podcast_name ILIKE '%CBC%';

-- ============================================
-- Add indexes for performance
-- ============================================

CREATE INDEX idx_self_promo_activities_band ON public.self_promotion_activities(band_id);
CREATE INDEX idx_self_promo_activities_status ON public.self_promotion_activities(status);
CREATE INDEX idx_self_promo_cooldowns_band ON public.self_promotion_cooldowns(band_id);
CREATE INDEX idx_band_media_cooldowns_band ON public.band_media_cooldowns(band_id);
CREATE INDEX idx_band_media_cooldowns_expires ON public.band_media_cooldowns(cooldown_expires_at);