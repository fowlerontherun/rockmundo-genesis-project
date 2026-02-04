-- Festival System Major Expansion v1.0.598
-- New tables for performance history, sponsorships, rivalries, reviews, and merch sales

-- 1. Festival Performance History Table
CREATE TABLE festival_performance_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  participation_id UUID REFERENCES festival_participants(id) ON DELETE CASCADE,
  band_id UUID REFERENCES bands(id) ON DELETE CASCADE,
  festival_id UUID REFERENCES game_events(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Performance Metrics
  performance_score INTEGER DEFAULT 0,
  crowd_energy_peak INTEGER DEFAULT 0,
  crowd_energy_avg INTEGER DEFAULT 0,
  songs_performed INTEGER DEFAULT 0,
  setlist_id UUID REFERENCES setlists(id) ON DELETE SET NULL,
  
  -- Rewards Earned
  payment_earned INTEGER DEFAULT 0,
  fame_earned INTEGER DEFAULT 0,
  merch_revenue INTEGER DEFAULT 0,
  new_fans_gained INTEGER DEFAULT 0,
  
  -- Reviews
  critic_score INTEGER,
  fan_score INTEGER,
  review_headline TEXT,
  review_summary TEXT,
  
  -- Highlights
  highlight_moments JSONB DEFAULT '[]',
  
  -- Context
  slot_type TEXT,
  stage_name TEXT,
  performance_date TIMESTAMPTZ,
  attendance_estimate INTEGER,
  weather_conditions TEXT,
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Festival Sponsorships Table
CREATE TABLE festival_sponsorships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  festival_id UUID REFERENCES game_events(id) ON DELETE CASCADE,
  brand_id UUID REFERENCES sponsorship_brands(id) ON DELETE CASCADE,
  sponsorship_type TEXT CHECK (sponsorship_type IN ('title', 'presenting', 'stage', 'category')) DEFAULT 'category',
  
  -- Financial
  sponsorship_amount INTEGER DEFAULT 0,
  revenue_share_percent NUMERIC DEFAULT 0,
  
  -- Impact
  crowd_mood_modifier INTEGER DEFAULT 0,
  merch_sales_modifier NUMERIC DEFAULT 1.0,
  fame_modifier NUMERIC DEFAULT 1.0,
  
  -- Exclusivity
  is_exclusive BOOLEAN DEFAULT false,
  required_mentions INTEGER DEFAULT 0,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  CONSTRAINT unique_festival_sponsor UNIQUE (festival_id, brand_id)
);

-- 3. Festival Rivalries Table
CREATE TABLE festival_rivalries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  festival_id UUID REFERENCES game_events(id) ON DELETE CASCADE,
  band_a_id UUID REFERENCES bands(id) ON DELETE CASCADE,
  band_b_id UUID REFERENCES bands(id) ON DELETE CASCADE,
  
  rivalry_type TEXT CHECK (rivalry_type IN ('genre_clash', 'fame_battle', 'crowd_favorite', 'critical_acclaim')) DEFAULT 'crowd_favorite',
  
  winner_band_id UUID REFERENCES bands(id),
  band_a_score INTEGER,
  band_b_score INTEGER,
  
  fame_stakes INTEGER DEFAULT 500,
  resolved_at TIMESTAMPTZ,
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Festival Reviews Table
CREATE TABLE festival_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  performance_id UUID REFERENCES festival_performance_history(id) ON DELETE CASCADE,
  band_id UUID REFERENCES bands(id) ON DELETE CASCADE,
  
  reviewer_type TEXT CHECK (reviewer_type IN ('critic', 'fan', 'industry', 'blog')) DEFAULT 'fan',
  publication_name TEXT,
  
  score INTEGER CHECK (score >= 0 AND score <= 100),
  headline TEXT,
  review_text TEXT,
  sentiment TEXT CHECK (sentiment IN ('positive', 'neutral', 'negative', 'mixed')) DEFAULT 'neutral',
  
  -- Reputation Effects
  fame_impact INTEGER DEFAULT 0,
  genre_cred_impact INTEGER DEFAULT 0,
  
  -- Visibility
  is_featured BOOLEAN DEFAULT false,
  view_count INTEGER DEFAULT 0,
  
  published_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Festival Merch Sales Table
CREATE TABLE festival_merch_sales (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  performance_id UUID REFERENCES festival_performance_history(id) ON DELETE CASCADE,
  band_id UUID REFERENCES bands(id) ON DELETE CASCADE,
  festival_id UUID REFERENCES game_events(id) ON DELETE CASCADE,
  
  -- Sales Data
  tshirts_sold INTEGER DEFAULT 0,
  posters_sold INTEGER DEFAULT 0,
  albums_sold INTEGER DEFAULT 0,
  other_items_sold INTEGER DEFAULT 0,
  
  gross_revenue INTEGER DEFAULT 0,
  festival_cut INTEGER DEFAULT 0,
  net_revenue INTEGER DEFAULT 0,
  
  -- Context
  merch_booth_location TEXT,
  weather_impact NUMERIC DEFAULT 1.0,
  performance_boost NUMERIC DEFAULT 1.0,
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. Add new columns to festival_participants
ALTER TABLE festival_participants ADD COLUMN IF NOT EXISTS setlist_id UUID REFERENCES setlists(id);
ALTER TABLE festival_participants ADD COLUMN IF NOT EXISTS stage_name TEXT;
ALTER TABLE festival_participants ADD COLUMN IF NOT EXISTS performance_time TIME;
ALTER TABLE festival_participants ADD COLUMN IF NOT EXISTS soundcheck_time TIME;
ALTER TABLE festival_participants ADD COLUMN IF NOT EXISTS tech_rider_approved BOOLEAN DEFAULT false;
ALTER TABLE festival_participants ADD COLUMN IF NOT EXISTS is_confirmed_attendance BOOLEAN DEFAULT false;
ALTER TABLE festival_participants ADD COLUMN IF NOT EXISTS arrival_confirmed_at TIMESTAMPTZ;

-- 7. Add new columns to game_events for festival metadata
ALTER TABLE game_events ADD COLUMN IF NOT EXISTS festival_status TEXT DEFAULT 'active';
ALTER TABLE game_events ADD COLUMN IF NOT EXISTS total_stages INTEGER DEFAULT 1;
ALTER TABLE game_events ADD COLUMN IF NOT EXISTS headliner_count INTEGER DEFAULT 1;
ALTER TABLE game_events ADD COLUMN IF NOT EXISTS venue_id UUID REFERENCES venues(id);
ALTER TABLE game_events ADD COLUMN IF NOT EXISTS weather_forecast TEXT;
ALTER TABLE game_events ADD COLUMN IF NOT EXISTS attendance_projection INTEGER;
ALTER TABLE game_events ADD COLUMN IF NOT EXISTS sponsor_ids JSONB DEFAULT '[]';

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_festival_perf_history_band ON festival_performance_history(band_id);
CREATE INDEX IF NOT EXISTS idx_festival_perf_history_festival ON festival_performance_history(festival_id);
CREATE INDEX IF NOT EXISTS idx_festival_perf_history_user ON festival_performance_history(user_id);
CREATE INDEX IF NOT EXISTS idx_festival_sponsorships_festival ON festival_sponsorships(festival_id);
CREATE INDEX IF NOT EXISTS idx_festival_rivalries_festival ON festival_rivalries(festival_id);
CREATE INDEX IF NOT EXISTS idx_festival_reviews_perf ON festival_reviews(performance_id);
CREATE INDEX IF NOT EXISTS idx_festival_merch_perf ON festival_merch_sales(performance_id);

-- Enable RLS on all new tables
ALTER TABLE festival_performance_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE festival_sponsorships ENABLE ROW LEVEL SECURITY;
ALTER TABLE festival_rivalries ENABLE ROW LEVEL SECURITY;
ALTER TABLE festival_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE festival_merch_sales ENABLE ROW LEVEL SECURITY;

-- RLS Policies for festival_performance_history
CREATE POLICY "Users can view all performance history" ON festival_performance_history FOR SELECT USING (true);
CREATE POLICY "Users can insert own performance history" ON festival_performance_history FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own performance history" ON festival_performance_history FOR UPDATE USING (auth.uid() = user_id);

-- RLS Policies for festival_sponsorships (public read)
CREATE POLICY "Anyone can view festival sponsorships" ON festival_sponsorships FOR SELECT USING (true);
CREATE POLICY "Authenticated users can manage sponsorships" ON festival_sponsorships FOR ALL USING (auth.uid() IS NOT NULL);

-- RLS Policies for festival_rivalries (public read)
CREATE POLICY "Anyone can view festival rivalries" ON festival_rivalries FOR SELECT USING (true);
CREATE POLICY "Authenticated users can manage rivalries" ON festival_rivalries FOR ALL USING (auth.uid() IS NOT NULL);

-- RLS Policies for festival_reviews (public read)
CREATE POLICY "Anyone can view festival reviews" ON festival_reviews FOR SELECT USING (true);
CREATE POLICY "Authenticated users can manage reviews" ON festival_reviews FOR ALL USING (auth.uid() IS NOT NULL);

-- RLS Policies for festival_merch_sales (public read)
CREATE POLICY "Anyone can view festival merch sales" ON festival_merch_sales FOR SELECT USING (true);
CREATE POLICY "Authenticated users can manage merch sales" ON festival_merch_sales FOR ALL USING (auth.uid() IS NOT NULL);

-- Seed some initial festival sponsorships for existing festivals
INSERT INTO festival_sponsorships (festival_id, brand_id, sponsorship_type, sponsorship_amount, crowd_mood_modifier, merch_sales_modifier, fame_modifier)
SELECT 
  ge.id as festival_id,
  sb.id as brand_id,
  CASE 
    WHEN sb.wealth_tier >= 5 THEN 'title'
    WHEN sb.wealth_tier >= 4 THEN 'presenting'
    WHEN sb.wealth_tier >= 3 THEN 'stage'
    ELSE 'category'
  END as sponsorship_type,
  sb.wealth_tier * 50000 as sponsorship_amount,
  sb.wealth_tier * 2 as crowd_mood_modifier,
  1.0 + (sb.wealth_tier * 0.05) as merch_sales_modifier,
  1.0 + (sb.wealth_tier * 0.03) as fame_modifier
FROM game_events ge
CROSS JOIN LATERAL (
  SELECT id, wealth_tier FROM sponsorship_brands 
  WHERE category IN ('beverage', 'fashion', 'technology', 'automotive')
  ORDER BY RANDOM() LIMIT 2
) sb
WHERE ge.event_type = 'festival' AND ge.is_active = true
ON CONFLICT (festival_id, brand_id) DO NOTHING;