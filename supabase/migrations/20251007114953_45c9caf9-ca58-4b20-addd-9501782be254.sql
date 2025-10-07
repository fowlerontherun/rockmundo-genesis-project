-- Extend songs table for marketplace and quality tracking
ALTER TABLE songs ADD COLUMN IF NOT EXISTS band_id uuid REFERENCES bands(id);
ALTER TABLE songs ADD COLUMN IF NOT EXISTS ownership_type text DEFAULT 'personal';
ALTER TABLE songs ADD COLUMN IF NOT EXISTS catalog_status text DEFAULT 'private';
ALTER TABLE songs ADD COLUMN IF NOT EXISTS market_listing_id uuid;
ALTER TABLE songs ADD COLUMN IF NOT EXISTS original_writer_id uuid REFERENCES auth.users(id);
ALTER TABLE songs ADD COLUMN IF NOT EXISTS ai_generated_lyrics boolean DEFAULT false;

-- Create song marketplace listings table
CREATE TABLE IF NOT EXISTS song_market_listings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  song_id uuid NOT NULL REFERENCES songs(id) ON DELETE CASCADE,
  seller_id uuid NOT NULL REFERENCES auth.users(id),
  listing_type text NOT NULL CHECK (listing_type IN ('auction', 'fixed_price')),
  starting_price integer NOT NULL CHECK (starting_price > 0),
  reserve_price integer CHECK (reserve_price IS NULL OR reserve_price >= starting_price),
  current_bid integer,
  current_bidder_id uuid REFERENCES auth.users(id),
  buyout_price integer CHECK (buyout_price IS NULL OR buyout_price > starting_price),
  auction_end_date timestamptz,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'sold', 'cancelled', 'expired')),
  created_at timestamptz DEFAULT now(),
  sold_at timestamptz,
  sold_price integer,
  buyer_id uuid REFERENCES auth.users(id)
);

-- Create bid history table
CREATE TABLE IF NOT EXISTS song_market_bids (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id uuid NOT NULL REFERENCES song_market_listings(id) ON DELETE CASCADE,
  bidder_id uuid NOT NULL REFERENCES auth.users(id),
  bid_amount integer NOT NULL CHECK (bid_amount > 0),
  bid_time timestamptz DEFAULT now(),
  is_winning boolean DEFAULT false
);

-- Create royalties tracking table
CREATE TABLE IF NOT EXISTS song_sales_royalties (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  song_id uuid NOT NULL REFERENCES songs(id),
  original_writer_id uuid NOT NULL REFERENCES auth.users(id),
  buyer_id uuid NOT NULL REFERENCES auth.users(id),
  sale_price integer NOT NULL,
  royalty_percentage integer NOT NULL DEFAULT 10,
  sold_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE song_market_listings ENABLE ROW LEVEL SECURITY;
ALTER TABLE song_market_bids ENABLE ROW LEVEL SECURITY;
ALTER TABLE song_sales_royalties ENABLE ROW LEVEL SECURITY;

-- RLS Policies for song_market_listings
CREATE POLICY "Listings are viewable by everyone" ON song_market_listings
  FOR SELECT USING (status = 'active' OR auth.uid() = seller_id OR auth.uid() = buyer_id);

CREATE POLICY "Users can create their own listings" ON song_market_listings
  FOR INSERT WITH CHECK (auth.uid() = seller_id);

CREATE POLICY "Sellers can update their listings" ON song_market_listings
  FOR UPDATE USING (auth.uid() = seller_id);

-- RLS Policies for song_market_bids
CREATE POLICY "Bids are viewable by listing participants" ON song_market_bids
  FOR SELECT USING (
    listing_id IN (
      SELECT id FROM song_market_listings 
      WHERE seller_id = auth.uid() OR current_bidder_id = auth.uid()
    ) OR bidder_id = auth.uid()
  );

CREATE POLICY "Users can place bids" ON song_market_bids
  FOR INSERT WITH CHECK (auth.uid() = bidder_id);

-- RLS Policies for song_sales_royalties
CREATE POLICY "Royalties viewable by participants" ON song_sales_royalties
  FOR SELECT USING (auth.uid() = original_writer_id OR auth.uid() = buyer_id);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_listings_status ON song_market_listings(status);
CREATE INDEX IF NOT EXISTS idx_listings_seller ON song_market_listings(seller_id);
CREATE INDEX IF NOT EXISTS idx_listings_end_date ON song_market_listings(auction_end_date) WHERE status = 'active';
CREATE INDEX IF NOT EXISTS idx_bids_listing ON song_market_bids(listing_id);
CREATE INDEX IF NOT EXISTS idx_royalties_writer ON song_sales_royalties(original_writer_id);