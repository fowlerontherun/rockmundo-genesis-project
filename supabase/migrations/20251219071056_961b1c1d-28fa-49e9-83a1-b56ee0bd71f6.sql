-- ================================================
-- PR SYSTEM: MEDIA OUTLETS & SHOWS
-- ================================================

-- TV Networks (similar to radio_stations)
CREATE TABLE tv_networks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  network_type TEXT CHECK (network_type IN ('local', 'national', 'cable', 'streaming')) DEFAULT 'national',
  country TEXT DEFAULT 'United Kingdom',
  city_id UUID REFERENCES cities(id),
  viewer_base INTEGER DEFAULT 10000,
  quality_level INTEGER DEFAULT 5 CHECK (quality_level >= 1 AND quality_level <= 10),
  min_fame_required INTEGER DEFAULT 0,
  min_fans_required INTEGER DEFAULT 0,
  genres TEXT[],
  logo_url TEXT,
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- TV Shows (with slots per day)
CREATE TABLE tv_shows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  network_id UUID REFERENCES tv_networks(id) ON DELETE CASCADE,
  show_name TEXT NOT NULL,
  show_type TEXT CHECK (show_type IN ('talk_show', 'morning_show', 'late_night', 'music_special', 'variety', 'news', 'entertainment')) DEFAULT 'talk_show',
  host_name TEXT,
  description TEXT,
  days_of_week INTEGER[] DEFAULT ARRAY[1,2,3,4,5], -- 0=Sunday, 1-5=Mon-Fri, 6=Saturday
  time_slot TEXT CHECK (time_slot IN ('morning', 'afternoon', 'prime_time', 'late_night')) DEFAULT 'morning',
  slots_per_day INTEGER DEFAULT 2,
  viewer_reach INTEGER DEFAULT 50000,
  fame_boost_min INTEGER DEFAULT 100,
  fame_boost_max INTEGER DEFAULT 500,
  fan_boost_min INTEGER DEFAULT 200,
  fan_boost_max INTEGER DEFAULT 1500,
  compensation_min INTEGER DEFAULT 500,
  compensation_max INTEGER DEFAULT 5000,
  min_fame_required INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Newspapers
CREATE TABLE newspapers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  newspaper_type TEXT CHECK (newspaper_type IN ('local', 'regional', 'national', 'tabloid', 'broadsheet')) DEFAULT 'national',
  country TEXT DEFAULT 'United Kingdom',
  city_id UUID REFERENCES cities(id),
  circulation INTEGER DEFAULT 50000,
  quality_level INTEGER DEFAULT 5,
  min_fame_required INTEGER DEFAULT 0,
  genres TEXT[],
  logo_url TEXT,
  description TEXT,
  interview_slots_per_day INTEGER DEFAULT 2,
  fame_boost_min INTEGER DEFAULT 50,
  fame_boost_max INTEGER DEFAULT 300,
  fan_boost_min INTEGER DEFAULT 100,
  fan_boost_max INTEGER DEFAULT 800,
  compensation_min INTEGER DEFAULT 100,
  compensation_max INTEGER DEFAULT 2000,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Magazines
CREATE TABLE magazines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  magazine_type TEXT CHECK (magazine_type IN ('music', 'entertainment', 'lifestyle', 'celebrity', 'industry')) DEFAULT 'music',
  country TEXT DEFAULT 'United Kingdom',
  readership INTEGER DEFAULT 100000,
  quality_level INTEGER DEFAULT 5,
  min_fame_required INTEGER DEFAULT 500,
  genres TEXT[],
  logo_url TEXT,
  description TEXT,
  publication_frequency TEXT CHECK (publication_frequency IN ('weekly', 'biweekly', 'monthly')) DEFAULT 'monthly',
  interview_slots_per_issue INTEGER DEFAULT 3,
  fame_boost_min INTEGER DEFAULT 100,
  fame_boost_max INTEGER DEFAULT 400,
  fan_boost_min INTEGER DEFAULT 300,
  fan_boost_max INTEGER DEFAULT 1200,
  compensation_min INTEGER DEFAULT 200,
  compensation_max INTEGER DEFAULT 3000,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- YouTube Channels
CREATE TABLE youtube_channels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_name TEXT NOT NULL,
  channel_type TEXT CHECK (channel_type IN ('music', 'interview', 'reaction', 'documentary', 'entertainment', 'vlog')) DEFAULT 'music',
  subscriber_count INTEGER DEFAULT 10000,
  avg_views INTEGER DEFAULT 5000,
  quality_level INTEGER DEFAULT 5,
  min_fame_required INTEGER DEFAULT 100,
  genres TEXT[],
  host_name TEXT,
  channel_url TEXT,
  description TEXT,
  slots_per_week INTEGER DEFAULT 3,
  fame_boost_min INTEGER DEFAULT 150,
  fame_boost_max INTEGER DEFAULT 600,
  fan_boost_min INTEGER DEFAULT 400,
  fan_boost_max INTEGER DEFAULT 2000,
  compensation_min INTEGER DEFAULT 0,
  compensation_max INTEGER DEFAULT 1500,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Podcasts
CREATE TABLE podcasts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  podcast_name TEXT NOT NULL,
  podcast_type TEXT CHECK (podcast_type IN ('music', 'interview', 'industry', 'storytelling', 'comedy', 'culture')) DEFAULT 'music',
  listener_base INTEGER DEFAULT 20000,
  quality_level INTEGER DEFAULT 5,
  min_fame_required INTEGER DEFAULT 200,
  genres TEXT[],
  host_name TEXT,
  description TEXT,
  episodes_per_week INTEGER DEFAULT 2,
  slots_per_episode INTEGER DEFAULT 1,
  fame_boost_min INTEGER DEFAULT 100,
  fame_boost_max INTEGER DEFAULT 400,
  fan_boost_min INTEGER DEFAULT 300,
  fan_boost_max INTEGER DEFAULT 1000,
  compensation_min INTEGER DEFAULT 100,
  compensation_max INTEGER DEFAULT 1000,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Film Studios & Productions
CREATE TABLE film_studios (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  studio_type TEXT CHECK (studio_type IN ('major', 'independent', 'streaming')) DEFAULT 'major',
  country TEXT DEFAULT 'United Kingdom',
  prestige_level INTEGER DEFAULT 5,
  min_fame_required INTEGER DEFAULT 25000,
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE film_productions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  studio_id UUID REFERENCES film_studios(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  film_type TEXT CHECK (film_type IN ('cameo', 'supporting', 'lead')) DEFAULT 'cameo',
  genre TEXT,
  description TEXT,
  min_fame_required INTEGER DEFAULT 25000,
  compensation_min INTEGER DEFAULT 10000,
  compensation_max INTEGER DEFAULT 500000,
  fame_boost INTEGER DEFAULT 5000,
  fan_boost INTEGER DEFAULT 20000,
  filming_duration_days INTEGER DEFAULT 7,
  is_available BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ================================================
-- PR OFFERS SYSTEM
-- ================================================

CREATE TABLE pr_media_offers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  band_id UUID REFERENCES bands(id) ON DELETE CASCADE,
  media_type TEXT NOT NULL CHECK (media_type IN ('tv', 'radio', 'podcast', 'newspaper', 'magazine', 'youtube', 'film')),
  media_outlet_id UUID, -- references the specific outlet (polymorphic)
  show_id UUID, -- references specific show/program if applicable
  offer_type TEXT NOT NULL CHECK (offer_type IN ('general_promo', 'tour_promo', 'release_promo', 'personal_promo')),
  outlet_name TEXT, -- denormalized for display
  show_name TEXT, -- denormalized for display
  proposed_date DATE NOT NULL,
  time_slot TEXT,
  duration_hours INTEGER DEFAULT 1,
  compensation INTEGER DEFAULT 0,
  fame_boost INTEGER DEFAULT 100,
  fan_boost INTEGER DEFAULT 200,
  ticket_sales_boost_percent INTEGER, -- for tour promo
  release_hype_boost_percent INTEGER, -- for release promo
  linked_tour_id UUID, -- link to active tour
  linked_release_id UUID, -- link to upcoming release
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'declined', 'expired', 'completed', 'missed')),
  expires_at TIMESTAMPTZ NOT NULL,
  accepted_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  CONSTRAINT offer_has_target CHECK (user_id IS NOT NULL OR band_id IS NOT NULL)
);

-- Player Film Contracts (special tracking for film limit)
CREATE TABLE player_film_contracts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  film_id UUID REFERENCES film_productions(id) ON DELETE CASCADE NOT NULL,
  band_id UUID REFERENCES bands(id), -- if representing a band
  status TEXT DEFAULT 'offered' CHECK (status IN ('offered', 'accepted', 'filming', 'completed', 'declined')),
  role_type TEXT CHECK (role_type IN ('cameo', 'supporting', 'lead')),
  compensation INTEGER,
  fame_boost INTEGER,
  fan_boost INTEGER,
  filming_start_date DATE,
  filming_end_date DATE,
  contract_year INTEGER NOT NULL, -- to track 2-per-year limit
  accepted_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  CONSTRAINT unique_film_contract UNIQUE (user_id, film_id, contract_year)
);

-- ================================================
-- VIP PR CONSULTANT SYSTEM
-- ================================================

CREATE TABLE pr_consultants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  specialty TEXT, -- music, film, general
  tier TEXT CHECK (tier IN ('basic', 'premium', 'elite')) DEFAULT 'basic',
  weekly_fee INTEGER DEFAULT 5000,
  success_rate NUMERIC DEFAULT 0.8,
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE player_pr_consultants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  consultant_id UUID REFERENCES pr_consultants(id),
  hired_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  auto_accept_enabled BOOLEAN DEFAULT true,
  target_media_types TEXT[], -- which media types to auto-book
  min_compensation INTEGER DEFAULT 0, -- minimum payout to accept
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  CONSTRAINT unique_active_consultant UNIQUE (user_id)
);

CREATE TABLE pr_consultant_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  consultant_contract_id UUID REFERENCES player_pr_consultants(id) ON DELETE CASCADE,
  media_type TEXT NOT NULL,
  target_type TEXT CHECK (target_type IN ('general', 'tour', 'release', 'personal')) DEFAULT 'general',
  preferred_outlet_id UUID,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'searching', 'fulfilled', 'failed')),
  fulfilled_offer_id UUID REFERENCES pr_media_offers(id),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  fulfilled_at TIMESTAMPTZ
);

-- ================================================
-- INDEXES FOR PERFORMANCE
-- ================================================

CREATE INDEX idx_pr_offers_user ON pr_media_offers(user_id) WHERE user_id IS NOT NULL;
CREATE INDEX idx_pr_offers_band ON pr_media_offers(band_id) WHERE band_id IS NOT NULL;
CREATE INDEX idx_pr_offers_status ON pr_media_offers(status);
CREATE INDEX idx_pr_offers_date ON pr_media_offers(proposed_date);
CREATE INDEX idx_pr_offers_expires ON pr_media_offers(expires_at) WHERE status = 'pending';

CREATE INDEX idx_film_contracts_user ON player_film_contracts(user_id);
CREATE INDEX idx_film_contracts_year ON player_film_contracts(contract_year);

CREATE INDEX idx_tv_shows_network ON tv_shows(network_id);
CREATE INDEX idx_film_productions_studio ON film_productions(studio_id);

-- ================================================
-- ROW LEVEL SECURITY
-- ================================================

ALTER TABLE tv_networks ENABLE ROW LEVEL SECURITY;
ALTER TABLE tv_shows ENABLE ROW LEVEL SECURITY;
ALTER TABLE newspapers ENABLE ROW LEVEL SECURITY;
ALTER TABLE magazines ENABLE ROW LEVEL SECURITY;
ALTER TABLE youtube_channels ENABLE ROW LEVEL SECURITY;
ALTER TABLE podcasts ENABLE ROW LEVEL SECURITY;
ALTER TABLE film_studios ENABLE ROW LEVEL SECURITY;
ALTER TABLE film_productions ENABLE ROW LEVEL SECURITY;
ALTER TABLE pr_media_offers ENABLE ROW LEVEL SECURITY;
ALTER TABLE player_film_contracts ENABLE ROW LEVEL SECURITY;
ALTER TABLE pr_consultants ENABLE ROW LEVEL SECURITY;
ALTER TABLE player_pr_consultants ENABLE ROW LEVEL SECURITY;
ALTER TABLE pr_consultant_requests ENABLE ROW LEVEL SECURITY;

-- Public read for media outlets
CREATE POLICY "Anyone can view tv_networks" ON tv_networks FOR SELECT USING (true);
CREATE POLICY "Anyone can view tv_shows" ON tv_shows FOR SELECT USING (true);
CREATE POLICY "Anyone can view newspapers" ON newspapers FOR SELECT USING (true);
CREATE POLICY "Anyone can view magazines" ON magazines FOR SELECT USING (true);
CREATE POLICY "Anyone can view youtube_channels" ON youtube_channels FOR SELECT USING (true);
CREATE POLICY "Anyone can view podcasts" ON podcasts FOR SELECT USING (true);
CREATE POLICY "Anyone can view film_studios" ON film_studios FOR SELECT USING (true);
CREATE POLICY "Anyone can view film_productions" ON film_productions FOR SELECT USING (true);
CREATE POLICY "Anyone can view pr_consultants" ON pr_consultants FOR SELECT USING (true);

-- Users can view their own PR offers
CREATE POLICY "Users can view own pr_offers" ON pr_media_offers FOR SELECT 
  USING (auth.uid() = user_id OR band_id IN (
    SELECT band_id FROM band_members WHERE user_id = auth.uid()
  ));

CREATE POLICY "Users can update own pr_offers" ON pr_media_offers FOR UPDATE 
  USING (auth.uid() = user_id OR band_id IN (
    SELECT band_id FROM band_members WHERE user_id = auth.uid() AND role = 'leader'
  ));

-- Users can view their own film contracts
CREATE POLICY "Users can view own film_contracts" ON player_film_contracts FOR SELECT 
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update own film_contracts" ON player_film_contracts FOR UPDATE 
  USING (auth.uid() = user_id);

-- Users can manage their own PR consultant
CREATE POLICY "Users can view own pr_consultant" ON player_pr_consultants FOR SELECT 
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own pr_consultant" ON player_pr_consultants FOR INSERT 
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own pr_consultant" ON player_pr_consultants FOR UPDATE 
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own pr_consultant" ON player_pr_consultants FOR DELETE 
  USING (auth.uid() = user_id);

-- PR consultant requests
CREATE POLICY "Users can view own pr_requests" ON pr_consultant_requests FOR SELECT 
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own pr_requests" ON pr_consultant_requests FOR INSERT 
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own pr_requests" ON pr_consultant_requests FOR UPDATE 
  USING (auth.uid() = user_id);