-- ============================================
-- PHASE 1: CORE GIG MANAGER & DB INTEGRATION
-- ============================================

-- Extend venues table with attributes
ALTER TABLE venues 
ADD COLUMN IF NOT EXISTS reputation INTEGER DEFAULT 50 CHECK (reputation >= 0 AND reputation <= 100),
ADD COLUMN IF NOT EXISTS genre_bias JSONB DEFAULT '{}',
ADD COLUMN IF NOT EXISTS economy_factor NUMERIC DEFAULT 1.0,
ADD COLUMN IF NOT EXISTS venue_cut NUMERIC DEFAULT 0.20 CHECK (venue_cut >= 0 AND venue_cut <= 1),
ADD COLUMN IF NOT EXISTS audience_type TEXT DEFAULT 'general';

-- Promoters table
CREATE TABLE IF NOT EXISTS promoters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  reputation INTEGER DEFAULT 50 CHECK (reputation >= 0 AND reputation <= 100),
  quality_tier TEXT DEFAULT 'standard' CHECK (quality_tier IN ('amateur', 'standard', 'professional', 'legendary')),
  genre_specialization TEXT[],
  booking_fee NUMERIC DEFAULT 500,
  crowd_engagement_bonus NUMERIC DEFAULT 0,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Venue relationships (loyalty system)
CREATE TABLE IF NOT EXISTS venue_relationships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  band_id UUID REFERENCES bands(id) ON DELETE CASCADE,
  venue_id UUID REFERENCES venues(id) ON DELETE CASCADE,
  loyalty_points INTEGER DEFAULT 0,
  gigs_performed INTEGER DEFAULT 0,
  last_performance_date TIMESTAMPTZ,
  relationship_tier TEXT DEFAULT 'newcomer' CHECK (relationship_tier IN ('newcomer', 'regular', 'favorite', 'legendary')),
  payout_bonus NUMERIC DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(band_id, venue_id)
);

-- AI-generated gig offers
CREATE TABLE IF NOT EXISTS gig_offers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  band_id UUID REFERENCES bands(id) ON DELETE CASCADE,
  venue_id UUID REFERENCES venues(id) ON DELETE CASCADE,
  promoter_id UUID REFERENCES promoters(id) ON DELETE SET NULL,
  offered_date TIMESTAMPTZ NOT NULL,
  slot_type TEXT DEFAULT 'support',
  base_payout NUMERIC DEFAULT 500,
  ticket_price NUMERIC DEFAULT 20,
  expires_at TIMESTAMPTZ NOT NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected', 'expired')),
  offer_reason TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_gig_offers_band_status ON gig_offers(band_id, status);
CREATE INDEX IF NOT EXISTS idx_gig_offers_expires ON gig_offers(expires_at) WHERE status = 'pending';

-- ============================================
-- PHASE 2: TOURS & LOGISTICS
-- ============================================

CREATE TABLE IF NOT EXISTS tours (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  band_id UUID REFERENCES bands(id) ON DELETE CASCADE,
  tour_name TEXT NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE,
  status TEXT DEFAULT 'planned' CHECK (status IN ('planned', 'active', 'completed', 'cancelled')),
  total_gigs INTEGER DEFAULT 0,
  total_revenue NUMERIC DEFAULT 0,
  total_costs NUMERIC DEFAULT 0,
  fame_gained INTEGER DEFAULT 0,
  vehicle_type TEXT,
  crew_size INTEGER DEFAULT 0,
  sponsor_deal_id UUID,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS tour_gigs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tour_id UUID REFERENCES tours(id) ON DELETE CASCADE,
  gig_id UUID REFERENCES gigs(id) ON DELETE CASCADE,
  position INTEGER NOT NULL,
  travel_distance_km INTEGER DEFAULT 0,
  travel_cost NUMERIC DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(tour_id, gig_id)
);

CREATE TABLE IF NOT EXISTS tour_logistics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tour_id UUID REFERENCES tours(id) ON DELETE CASCADE,
  log_date DATE NOT NULL,
  fatigue_level INTEGER DEFAULT 0 CHECK (fatigue_level >= 0 AND fatigue_level <= 100),
  morale_level INTEGER DEFAULT 50 CHECK (morale_level >= 0 AND morale_level <= 100),
  vehicle_condition INTEGER DEFAULT 100 CHECK (vehicle_condition >= 0 AND vehicle_condition <= 100),
  daily_costs NUMERIC DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- PHASE 3: AUDIENCE MEMORY & ANALYTICS
-- ============================================

CREATE TABLE IF NOT EXISTS audience_memory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  city_id UUID REFERENCES cities(id) ON DELETE CASCADE,
  band_id UUID REFERENCES bands(id) ON DELETE CASCADE,
  gigs_attended INTEGER DEFAULT 1,
  avg_experience_score NUMERIC DEFAULT 50,
  last_gig_date TIMESTAMPTZ,
  loyalty_level TEXT DEFAULT 'casual' CHECK (loyalty_level IN ('hostile', 'skeptical', 'casual', 'fan', 'superfan')),
  will_attend_again BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(city_id, band_id)
);

CREATE TABLE IF NOT EXISTS gig_analytics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  gig_id UUID REFERENCES gigs(id) ON DELETE CASCADE,
  performance_breakdown JSONB DEFAULT '{}',
  crowd_reaction_highlights TEXT[],
  social_buzz_count INTEGER DEFAULT 0,
  twaater_sentiment NUMERIC DEFAULT 0,
  compared_to_previous JSONB DEFAULT '{}',
  energy_curve JSONB DEFAULT '{}',
  mishap_events JSONB DEFAULT '[]',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- PHASE 4: STAGE EVENTS & SETLIST ENHANCEMENTS
-- ============================================

CREATE TABLE IF NOT EXISTS stage_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  gig_id UUID REFERENCES gigs(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL CHECK (event_type IN ('mishap', 'encore', 'surprise_guest', 'technical_failure', 'crowd_surge', 'perfect_moment')),
  song_position INTEGER,
  severity TEXT DEFAULT 'minor' CHECK (severity IN ('minor', 'moderate', 'major')),
  impact_score NUMERIC DEFAULT 0,
  description TEXT,
  occurred_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add setlist energy tracking
ALTER TABLE setlist_songs
ADD COLUMN IF NOT EXISTS energy_level INTEGER DEFAULT 5 CHECK (energy_level >= 1 AND energy_level <= 10),
ADD COLUMN IF NOT EXISTS tempo_bpm INTEGER,
ADD COLUMN IF NOT EXISTS crowd_engagement_target NUMERIC DEFAULT 1.0;

-- ============================================
-- PHASE 5: MULTIPLAYER & MMO EVENTS
-- ============================================

CREATE TABLE IF NOT EXISTS multiplayer_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_name TEXT NOT NULL,
  event_type TEXT DEFAULT 'battle' CHECK (event_type IN ('battle', 'festival', 'collaboration', 'tournament')),
  venue_id UUID REFERENCES venues(id) ON DELETE CASCADE,
  event_date TIMESTAMPTZ NOT NULL,
  max_participants INTEGER DEFAULT 10,
  entry_fee NUMERIC DEFAULT 0,
  prize_pool NUMERIC DEFAULT 0,
  status TEXT DEFAULT 'upcoming' CHECK (status IN ('upcoming', 'active', 'completed', 'cancelled')),
  voting_enabled BOOLEAN DEFAULT false,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS event_participants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID REFERENCES multiplayer_events(id) ON DELETE CASCADE,
  band_id UUID REFERENCES bands(id) ON DELETE CASCADE,
  gig_id UUID REFERENCES gigs(id) ON DELETE SET NULL,
  performance_score NUMERIC DEFAULT 0,
  crowd_votes INTEGER DEFAULT 0,
  placement INTEGER,
  prize_won NUMERIC DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(event_id, band_id)
);

-- ============================================
-- PHASE 6: CONFLICT DETECTION
-- ============================================

CREATE TABLE IF NOT EXISTS band_conflicts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  band_id UUID REFERENCES bands(id) ON DELETE CASCADE,
  conflict_type TEXT NOT NULL CHECK (conflict_type IN ('double_booking', 'tour_overlap', 'member_unavailable', 'venue_closed')),
  gig_id_1 UUID REFERENCES gigs(id) ON DELETE CASCADE,
  gig_id_2 UUID REFERENCES gigs(id) ON DELETE CASCADE,
  detected_at TIMESTAMPTZ DEFAULT NOW(),
  resolved BOOLEAN DEFAULT false,
  resolution_note TEXT
);

-- ============================================
-- ENHANCE EXISTING TABLES
-- ============================================

-- Extend gigs table
ALTER TABLE gigs
ADD COLUMN IF NOT EXISTS promoter_id UUID REFERENCES promoters(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS tour_id UUID REFERENCES tours(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS crowd_engagement NUMERIC DEFAULT 1.0,
ADD COLUMN IF NOT EXISTS setlist_quality_score NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS performance_calculation JSONB DEFAULT '{}';

-- Extend gig_outcomes
ALTER TABLE gig_outcomes
ADD COLUMN IF NOT EXISTS skill_performance_avg NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS band_synergy_modifier NUMERIC DEFAULT 1.0,
ADD COLUMN IF NOT EXISTS promoter_modifier NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS audience_memory_impact NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS venue_loyalty_bonus NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS social_buzz_impact NUMERIC DEFAULT 0;

-- ============================================
-- INDEXES FOR PERFORMANCE
-- ============================================

CREATE INDEX IF NOT EXISTS idx_venue_relationships_band ON venue_relationships(band_id);
CREATE INDEX IF NOT EXISTS idx_audience_memory_city_band ON audience_memory(city_id, band_id);
CREATE INDEX IF NOT EXISTS idx_tours_band_status ON tours(band_id, status);
CREATE INDEX IF NOT EXISTS idx_multiplayer_events_date ON multiplayer_events(event_date) WHERE status = 'upcoming';
CREATE INDEX IF NOT EXISTS idx_stage_events_gig ON stage_events(gig_id);

-- ============================================
-- TRIGGERS
-- ============================================

-- Update venue relationships after gig
CREATE OR REPLACE FUNCTION update_venue_relationship()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'completed' AND NEW.band_id IS NOT NULL AND NEW.venue_id IS NOT NULL THEN
    INSERT INTO venue_relationships (band_id, venue_id, gigs_performed, last_performance_date, loyalty_points)
    VALUES (NEW.band_id, NEW.venue_id, 1, NEW.completed_at, 10)
    ON CONFLICT (band_id, venue_id) 
    DO UPDATE SET
      gigs_performed = venue_relationships.gigs_performed + 1,
      last_performance_date = NEW.completed_at,
      loyalty_points = venue_relationships.loyalty_points + 10,
      relationship_tier = CASE
        WHEN venue_relationships.loyalty_points + 10 >= 100 THEN 'legendary'
        WHEN venue_relationships.loyalty_points + 10 >= 50 THEN 'favorite'
        WHEN venue_relationships.loyalty_points + 10 >= 20 THEN 'regular'
        ELSE 'newcomer'
      END,
      payout_bonus = CASE
        WHEN venue_relationships.loyalty_points + 10 >= 100 THEN 0.30
        WHEN venue_relationships.loyalty_points + 10 >= 50 THEN 0.20
        WHEN venue_relationships.loyalty_points + 10 >= 20 THEN 0.10
        ELSE 0
      END;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER gig_venue_relationship_update
AFTER UPDATE ON gigs
FOR EACH ROW
WHEN (NEW.status = 'completed')
EXECUTE FUNCTION update_venue_relationship();

-- Update audience memory
CREATE OR REPLACE FUNCTION update_audience_memory()
RETURNS TRIGGER AS $$
DECLARE
  v_city_id UUID;
  v_band_id UUID;
  v_performance_score NUMERIC;
BEGIN
  -- Get gig details
  SELECT g.band_id, v.city_id INTO v_band_id, v_city_id
  FROM gigs g
  JOIN venues v ON v.id = g.venue_id
  WHERE g.id = NEW.gig_id;
  
  v_performance_score := COALESCE(NEW.overall_rating, 0) * 4; -- Convert to 0-100 scale
  
  -- Update or create audience memory
  INSERT INTO audience_memory (city_id, band_id, gigs_attended, avg_experience_score, last_gig_date)
  VALUES (v_city_id, v_band_id, 1, v_performance_score, NOW())
  ON CONFLICT (city_id, band_id)
  DO UPDATE SET
    gigs_attended = audience_memory.gigs_attended + 1,
    avg_experience_score = (audience_memory.avg_experience_score * audience_memory.gigs_attended + v_performance_score) / (audience_memory.gigs_attended + 1),
    last_gig_date = NOW(),
    loyalty_level = CASE
      WHEN (audience_memory.avg_experience_score * audience_memory.gigs_attended + v_performance_score) / (audience_memory.gigs_attended + 1) >= 80 THEN 'superfan'
      WHEN (audience_memory.avg_experience_score * audience_memory.gigs_attended + v_performance_score) / (audience_memory.gigs_attended + 1) >= 60 THEN 'fan'
      WHEN (audience_memory.avg_experience_score * audience_memory.gigs_attended + v_performance_score) / (audience_memory.gigs_attended + 1) >= 40 THEN 'casual'
      WHEN (audience_memory.avg_experience_score * audience_memory.gigs_attended + v_performance_score) / (audience_memory.gigs_attended + 1) >= 20 THEN 'skeptical'
      ELSE 'hostile'
    END,
    will_attend_again = CASE
      WHEN (audience_memory.avg_experience_score * audience_memory.gigs_attended + v_performance_score) / (audience_memory.gigs_attended + 1) >= 30 THEN true
      ELSE false
    END;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER gig_audience_memory_update
AFTER INSERT ON gig_outcomes
FOR EACH ROW
WHEN (NEW.completed_at IS NOT NULL)
EXECUTE FUNCTION update_audience_memory();

-- Expire old gig offers
CREATE OR REPLACE FUNCTION expire_old_gig_offers()
RETURNS void AS $$
BEGIN
  UPDATE gig_offers
  SET status = 'expired'
  WHERE status = 'pending' AND expires_at < NOW();
END;
$$ LANGUAGE plpgsql;

COMMENT ON TABLE promoters IS 'NPC promoters who offer gigs and affect performance outcomes';
COMMENT ON TABLE venue_relationships IS 'Tracks band loyalty with venues for repeat performance bonuses';
COMMENT ON TABLE gig_offers IS 'AI-generated booking offers from promoters';
COMMENT ON TABLE tours IS 'Multi-gig tour chains with logistics';
COMMENT ON TABLE audience_memory IS 'Per-city fan memory of band performances';
COMMENT ON TABLE gig_analytics IS 'Detailed post-gig performance analytics';
COMMENT ON TABLE stage_events IS 'Random events during performances (mishaps, encores, etc)';
COMMENT ON TABLE multiplayer_events IS 'Shared calendar events like Battle of the Bands';