-- Add quality tier and unlock requirements to player_merchandise
ALTER TABLE player_merchandise 
  ADD COLUMN IF NOT EXISTS quality_tier VARCHAR(20) DEFAULT 'basic',
  ADD COLUMN IF NOT EXISTS is_limited_edition BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS limited_quantity INTEGER,
  ADD COLUMN IF NOT EXISTS available_until TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS tour_exclusive_tour_id UUID REFERENCES tours(id);

-- Create merch_item_requirements table for unlock requirements
CREATE TABLE IF NOT EXISTS merch_item_requirements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  item_type VARCHAR(100) NOT NULL UNIQUE,
  category VARCHAR(50) NOT NULL,
  min_fame INTEGER DEFAULT 0,
  min_fans INTEGER DEFAULT 0,
  min_level INTEGER DEFAULT 0,
  base_quality_tier VARCHAR(20) DEFAULT 'basic',
  base_cost INTEGER DEFAULT 0,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS on merch_item_requirements
ALTER TABLE merch_item_requirements ENABLE ROW LEVEL SECURITY;

-- Allow all authenticated users to read merch_item_requirements
CREATE POLICY "Anyone can read merch item requirements"
ON merch_item_requirements FOR SELECT
USING (true);

-- Seed the merch_item_requirements with unlock tiers
INSERT INTO merch_item_requirements (item_type, category, min_fame, min_fans, min_level, base_quality_tier, base_cost, description) VALUES
-- Apparel (progressive unlock)
('Basic Tee', 'Apparel', 0, 0, 1, 'poor', 5, 'Simple screen-printed t-shirt'),
('Graphic Tee', 'Apparel', 100, 50, 3, 'basic', 7, 'Standard quality band tee with graphic print'),
('Premium Hoodie', 'Apparel', 500, 200, 5, 'standard', 24, 'High-quality heavyweight hoodie'),
('Tour Crewneck', 'Apparel', 1000, 500, 8, 'premium', 18, 'Tour-exclusive crewneck sweater'),
('Embroidered Cap', 'Apparel', 300, 100, 4, 'standard', 10, 'Quality embroidered cap'),
('Limited Edition Jacket', 'Apparel', 5000, 2000, 15, 'exclusive', 55, 'Numbered limited edition tour jacket'),

-- Accessories (easier unlocks)
('Basic Sticker Pack', 'Accessories', 0, 0, 1, 'poor', 1, 'Simple logo stickers'),
('Holographic Sticker Pack', 'Accessories', 200, 50, 3, 'basic', 2, 'Premium holographic stickers'),
('Lanyard + Laminate', 'Accessories', 300, 100, 4, 'standard', 5, 'VIP-style lanyard and laminate'),
('Enamel Pin', 'Accessories', 150, 50, 3, 'basic', 4, 'Quality enamel pin'),
('Tour Tote Bag', 'Accessories', 400, 150, 5, 'standard', 6, 'Durable canvas tote bag'),
('Collectors Pin Set', 'Accessories', 2000, 800, 10, 'premium', 15, 'Limited collectors pin set'),

-- Collectibles (fame-gated)
('Band Poster', 'Collectibles', 50, 20, 2, 'poor', 2, 'Basic promotional poster'),
('Signed Poster', 'Collectibles', 1000, 400, 7, 'premium', 8, 'Hand-signed poster'),
('Limited Art Print', 'Collectibles', 2500, 1000, 12, 'exclusive', 15, 'Numbered art print'),
('Numbered Vinyl Variant', 'Collectibles', 5000, 2000, 15, 'exclusive', 25, 'Limited colored vinyl'),
('Tour Photo Zine', 'Collectibles', 1500, 600, 9, 'premium', 10, 'Behind-the-scenes photo book'),

-- Experiences (high fame required)
('Soundcheck Access', 'Experiences', 2000, 800, 10, 'premium', 15, 'Watch soundcheck before show'),
('Meet & Greet', 'Experiences', 5000, 2000, 15, 'exclusive', 30, 'Personal meet and greet'),
('VIP Lounge Access', 'Experiences', 10000, 5000, 20, 'exclusive', 50, 'Exclusive VIP lounge'),
('Private Listening Session', 'Experiences', 8000, 3000, 18, 'exclusive', 40, 'Private album preview'),

-- Digital (low barrier)
('Digital Wallpaper Pack', 'Digital', 0, 0, 1, 'poor', 0, 'Phone and desktop wallpapers'),
('Exclusive Remix Pack', 'Digital', 100, 30, 2, 'basic', 3, 'Exclusive song remixes'),
('Behind-the-Scenes Video', 'Digital', 300, 100, 4, 'standard', 5, 'BTS mini documentary'),
('Lyric Book PDF', 'Digital', 50, 20, 2, 'poor', 1, 'Digital lyric book'),

-- Bundles (mid-tier unlocks)
('Starter Fan Pack', 'Bundles', 200, 75, 3, 'basic', 12, 'Tee + stickers + poster'),
('Tour Essentials Bundle', 'Bundles', 800, 300, 6, 'standard', 25, 'Hoodie + cap + tote'),
('Deluxe Fan Bundle', 'Bundles', 2000, 800, 10, 'premium', 45, 'Premium collection of items'),
('Ultimate VIP Bundle', 'Bundles', 7500, 3000, 18, 'exclusive', 100, 'Everything + experiences')

ON CONFLICT (item_type) DO UPDATE SET
  category = EXCLUDED.category,
  min_fame = EXCLUDED.min_fame,
  min_fans = EXCLUDED.min_fans,
  min_level = EXCLUDED.min_level,
  base_quality_tier = EXCLUDED.base_quality_tier,
  base_cost = EXCLUDED.base_cost,
  description = EXCLUDED.description;