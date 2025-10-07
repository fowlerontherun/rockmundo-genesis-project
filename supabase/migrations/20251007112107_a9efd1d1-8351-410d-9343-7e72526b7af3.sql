-- Extend bands table with all new features
ALTER TABLE bands 
  ADD COLUMN IF NOT EXISTS logo_url text,
  ADD COLUMN IF NOT EXISTS is_solo_artist boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS artist_name varchar,
  ADD COLUMN IF NOT EXISTS chemistry_level integer DEFAULT 0 CHECK (chemistry_level >= 0 AND chemistry_level <= 100),
  ADD COLUMN IF NOT EXISTS cohesion_score integer DEFAULT 0 CHECK (cohesion_score >= 0 AND cohesion_score <= 100),
  ADD COLUMN IF NOT EXISTS performance_count integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS jam_count integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS days_together integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS hidden_skill_rating integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_chemistry_update timestamptz DEFAULT now(),
  ADD COLUMN IF NOT EXISTS next_leadership_vote timestamptz,
  ADD COLUMN IF NOT EXISTS leadership_votes_history jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS fame integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS fame_multiplier numeric DEFAULT 1.0,
  ADD COLUMN IF NOT EXISTS collective_fame_earned integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_fame_calculation timestamptz DEFAULT now();

-- Extend band_members table with role and touring member features
ALTER TABLE band_members
  ADD COLUMN IF NOT EXISTS instrument_role varchar NOT NULL DEFAULT 'Guitar',
  ADD COLUMN IF NOT EXISTS vocal_role varchar,
  ADD COLUMN IF NOT EXISTS is_touring_member boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS touring_member_tier integer CHECK (touring_member_tier >= 1 AND touring_member_tier <= 5),
  ADD COLUMN IF NOT EXISTS touring_member_cost integer,
  ADD COLUMN IF NOT EXISTS skill_contribution integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS chemistry_contribution integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS leadership_votes integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS can_be_leader boolean DEFAULT true;

-- Allow NULL user_id for AI touring members
ALTER TABLE band_members ALTER COLUMN user_id DROP NOT NULL;

-- Create band_leadership_votes table
CREATE TABLE IF NOT EXISTS band_leadership_votes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  band_id uuid NOT NULL REFERENCES bands(id) ON DELETE CASCADE,
  voter_user_id uuid NOT NULL,
  candidate_user_id uuid NOT NULL,
  vote_date timestamptz NOT NULL DEFAULT now(),
  vote_round integer NOT NULL,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_band_leadership_votes_band ON band_leadership_votes(band_id);
CREATE INDEX IF NOT EXISTS idx_band_leadership_votes_round ON band_leadership_votes(band_id, vote_round);

-- Create band_chemistry_events table
CREATE TABLE IF NOT EXISTS band_chemistry_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  band_id uuid NOT NULL REFERENCES bands(id) ON DELETE CASCADE,
  event_type varchar NOT NULL,
  chemistry_change integer NOT NULL,
  event_data jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_band_chemistry_events_band ON band_chemistry_events(band_id);
CREATE INDEX IF NOT EXISTS idx_band_chemistry_events_created ON band_chemistry_events(created_at DESC);

-- Create band_fame_events table
CREATE TABLE IF NOT EXISTS band_fame_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  band_id uuid NOT NULL REFERENCES bands(id) ON DELETE CASCADE,
  event_type varchar NOT NULL,
  fame_gained integer NOT NULL,
  event_data jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_band_fame_events_band ON band_fame_events(band_id);
CREATE INDEX IF NOT EXISTS idx_band_fame_events_created ON band_fame_events(created_at DESC);

-- Enable RLS on new tables
ALTER TABLE band_leadership_votes ENABLE ROW LEVEL SECURITY;
ALTER TABLE band_chemistry_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE band_fame_events ENABLE ROW LEVEL SECURITY;

-- RLS policies for band_leadership_votes
CREATE POLICY "Band members can view votes in their band"
  ON band_leadership_votes FOR SELECT
  USING (band_id IN (
    SELECT band_id FROM band_members WHERE user_id = auth.uid()
  ));

CREATE POLICY "Band members can create votes"
  ON band_leadership_votes FOR INSERT
  WITH CHECK (band_id IN (
    SELECT band_id FROM band_members WHERE user_id = auth.uid() AND NOT is_touring_member
  ) AND voter_user_id = auth.uid());

-- RLS policies for band_chemistry_events
CREATE POLICY "Band members can view chemistry events"
  ON band_chemistry_events FOR SELECT
  USING (band_id IN (
    SELECT band_id FROM band_members WHERE user_id = auth.uid()
  ));

-- RLS policies for band_fame_events
CREATE POLICY "Band fame events are viewable by band members"
  ON band_fame_events FOR SELECT
  USING (band_id IN (
    SELECT band_id FROM band_members WHERE user_id = auth.uid()
  ));