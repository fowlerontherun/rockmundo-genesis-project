-- Drop existing streaming_platforms if it has old schema
DROP TABLE IF EXISTS streaming_platforms CASCADE;

-- Create streaming_platforms table
CREATE TABLE streaming_platforms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  platform_name TEXT NOT NULL,
  platform_icon_url TEXT,
  base_payout_per_stream NUMERIC NOT NULL DEFAULT 0.003,
  quality_multiplier NUMERIC NOT NULL DEFAULT 1.0,
  genre_bonuses JSONB DEFAULT '{}'::jsonb,
  is_active BOOLEAN NOT NULL DEFAULT true,
  min_quality_requirement INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create song_releases table
CREATE TABLE song_releases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  song_id UUID NOT NULL REFERENCES songs(id) ON DELETE CASCADE,
  platform_id UUID NOT NULL REFERENCES streaming_platforms(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  band_id UUID REFERENCES bands(id) ON DELETE SET NULL,
  release_date TIMESTAMPTZ NOT NULL DEFAULT now(),
  release_type TEXT NOT NULL DEFAULT 'single',
  is_active BOOLEAN NOT NULL DEFAULT true,
  total_streams BIGINT NOT NULL DEFAULT 0,
  total_revenue INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create streaming_analytics table
CREATE TABLE streaming_analytics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  release_id UUID NOT NULL REFERENCES song_releases(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  streams INTEGER NOT NULL DEFAULT 0,
  revenue INTEGER NOT NULL DEFAULT 0,
  new_followers INTEGER NOT NULL DEFAULT 0,
  playlist_adds INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(release_id, date)
);

-- Create playlists table
CREATE TABLE playlists (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  platform_id UUID NOT NULL REFERENCES streaming_platforms(id) ON DELETE CASCADE,
  playlist_name TEXT NOT NULL,
  curator_type TEXT NOT NULL DEFAULT 'user',
  follower_count BIGINT NOT NULL DEFAULT 0,
  submission_cost INTEGER,
  acceptance_criteria JSONB DEFAULT '{}'::jsonb,
  boost_multiplier NUMERIC NOT NULL DEFAULT 1.5,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create playlist_submissions table
CREATE TABLE playlist_submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  playlist_id UUID NOT NULL REFERENCES playlists(id) ON DELETE CASCADE,
  release_id UUID NOT NULL REFERENCES song_releases(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  submission_status TEXT NOT NULL DEFAULT 'pending',
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  reviewed_at TIMESTAMPTZ
);

-- Create marketplace_listings table
CREATE TABLE marketplace_listings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  song_id UUID NOT NULL REFERENCES songs(id) ON DELETE CASCADE,
  seller_user_id UUID NOT NULL,
  seller_band_id UUID REFERENCES bands(id) ON DELETE SET NULL,
  listing_type TEXT NOT NULL DEFAULT 'fixed_price',
  asking_price INTEGER NOT NULL,
  minimum_bid INTEGER,
  current_bid INTEGER,
  buyout_price INTEGER,
  royalty_percentage INTEGER NOT NULL DEFAULT 0,
  listing_status TEXT NOT NULL DEFAULT 'active',
  expires_at TIMESTAMPTZ,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create marketplace_bids table
CREATE TABLE marketplace_bids (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id UUID NOT NULL REFERENCES marketplace_listings(id) ON DELETE CASCADE,
  bidder_user_id UUID NOT NULL,
  bid_amount INTEGER NOT NULL,
  bid_status TEXT NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create marketplace_transactions table
CREATE TABLE marketplace_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id UUID NOT NULL REFERENCES marketplace_listings(id) ON DELETE CASCADE,
  seller_user_id UUID NOT NULL,
  buyer_user_id UUID NOT NULL,
  song_id UUID NOT NULL REFERENCES songs(id) ON DELETE CASCADE,
  sale_price INTEGER NOT NULL,
  royalty_percentage INTEGER NOT NULL DEFAULT 0,
  transaction_status TEXT NOT NULL DEFAULT 'pending',
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE streaming_platforms ENABLE ROW LEVEL SECURITY;
ALTER TABLE song_releases ENABLE ROW LEVEL SECURITY;
ALTER TABLE streaming_analytics ENABLE ROW LEVEL SECURITY;
ALTER TABLE playlists ENABLE ROW LEVEL SECURITY;
ALTER TABLE playlist_submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE marketplace_listings ENABLE ROW LEVEL SECURITY;
ALTER TABLE marketplace_bids ENABLE ROW LEVEL SECURITY;
ALTER TABLE marketplace_transactions ENABLE ROW LEVEL SECURITY;

-- RLS Policies for streaming_platforms
CREATE POLICY "Platforms viewable by everyone" ON streaming_platforms FOR SELECT USING (is_active = true);
CREATE POLICY "Admins can manage platforms" ON streaming_platforms FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));

-- RLS Policies for song_releases
CREATE POLICY "Users can view their releases" ON song_releases FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create releases" ON song_releases FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their releases" ON song_releases FOR UPDATE USING (auth.uid() = user_id);

-- RLS Policies for streaming_analytics
CREATE POLICY "Users can view their analytics" ON streaming_analytics FOR SELECT USING (
  release_id IN (SELECT id FROM song_releases WHERE user_id = auth.uid())
);

-- RLS Policies for playlists
CREATE POLICY "Playlists viewable by everyone" ON playlists FOR SELECT USING (true);
CREATE POLICY "Admins can manage playlists" ON playlists FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));

-- RLS Policies for playlist_submissions
CREATE POLICY "Users can view their submissions" ON playlist_submissions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create submissions" ON playlist_submissions FOR INSERT WITH CHECK (auth.uid() = user_id);

-- RLS Policies for marketplace_listings
CREATE POLICY "Listings viewable by everyone" ON marketplace_listings FOR SELECT USING (true);
CREATE POLICY "Sellers can create listings" ON marketplace_listings FOR INSERT WITH CHECK (auth.uid() = seller_user_id);
CREATE POLICY "Sellers can update their listings" ON marketplace_listings FOR UPDATE USING (auth.uid() = seller_user_id);
CREATE POLICY "Admins can manage all listings" ON marketplace_listings FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));

-- RLS Policies for marketplace_bids
CREATE POLICY "Users can view bids on their listings" ON marketplace_bids FOR SELECT USING (
  listing_id IN (SELECT id FROM marketplace_listings WHERE seller_user_id = auth.uid()) OR
  bidder_user_id = auth.uid()
);
CREATE POLICY "Users can create bids" ON marketplace_bids FOR INSERT WITH CHECK (auth.uid() = bidder_user_id);

-- RLS Policies for marketplace_transactions
CREATE POLICY "Users can view their transactions" ON marketplace_transactions FOR SELECT USING (
  auth.uid() = seller_user_id OR auth.uid() = buyer_user_id
);
CREATE POLICY "System can create transactions" ON marketplace_transactions FOR INSERT WITH CHECK (true);

-- Seed streaming platforms
INSERT INTO streaming_platforms (platform_name, base_payout_per_stream, quality_multiplier, min_quality_requirement) VALUES
  ('Spotify', 0.003, 1.0, 0),
  ('Apple Music', 0.007, 1.1, 500),
  ('YouTube Music', 0.002, 0.9, 0),
  ('Tidal', 0.013, 1.3, 1200),
  ('SoundCloud', 0.001, 0.8, 0),
  ('Amazon Music', 0.004, 1.0, 300),
  ('Deezer', 0.006, 1.0, 400);